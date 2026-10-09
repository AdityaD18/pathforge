"""Train, select and evaluate the topic-proficiency classifier.

Usage (from backend/):  python -m ml.train [--learners 2500] [--seed 42]

Pipeline
  1. Simulate learners (SYNTHETIC; see ml/data_generation.py).
  2. Split by learner (GroupShuffleSplit, 80/20) so no learner appears in both sets.
  3. Compare candidate models with 5-fold GroupKFold CV on the training set only,
     selecting by mean log loss (a proper scoring rule, because the app uses the
     predicted probabilities to compute a mastery score).
  4. Refit the selected model on the full training set; evaluate once on the test set
     against two baselines (majority class, tuned accuracy thresholds).
  5. Write the model artifact and metrics.json, which the API serves verbatim.
"""
from __future__ import annotations

import argparse
import json
import platform
import time
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold, GroupShuffleSplit, cross_validate
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from . import evaluate as ev
from .catalog import load_catalog
from .data_generation import ADVANCED_MIN_THETA, BEGINNER_MAX_THETA, DEFAULT_SEED, LEVELS, simulate_learners
from .features import FEATURE_NAMES

ARTIFACT_DIR = Path(__file__).resolve().parent / "artifacts"
DATA_DIR = Path(__file__).resolve().parent / "data"
MODEL_PATH = ARTIFACT_DIR / "proficiency_model.joblib"
METRICS_PATH = ARTIFACT_DIR / "metrics.json"

CANDIDATE_LABELS = {
    "logistic_regression": "Multinomial logistic regression",
    "random_forest": "Random forest",
    "hist_gradient_boosting": "Histogram gradient boosting",
}


def build_candidates(seed: int) -> dict[str, Pipeline]:
    impute = lambda: SimpleImputer(strategy="median", add_indicator=True)  # noqa: E731
    return {
        "logistic_regression": Pipeline([
            ("impute", impute()), ("scale", StandardScaler()),
            ("model", LogisticRegression(C=1.0, max_iter=2000)),
        ]),
        "random_forest": Pipeline([
            ("impute", impute()),
            ("model", RandomForestClassifier(n_estimators=300, min_samples_leaf=10, random_state=seed, n_jobs=-1)),
        ]),
        "hist_gradient_boosting": Pipeline([
            ("impute", impute()),
            ("model", HistGradientBoostingClassifier(max_iter=250, learning_rate=0.05, max_leaf_nodes=15,
                                                     l2_regularization=1.0, random_state=seed)),
        ]),
    }


def main(n_learners: int = 2500, seed: int = DEFAULT_SEED) -> dict:
    t0 = time.time()
    catalog = load_catalog()
    np.random.seed(seed)

    df = simulate_learners(n_learners, seed, catalog)
    DATA_DIR.mkdir(exist_ok=True)
    df.to_csv(DATA_DIR / "synthetic_attempts.csv", index=False)

    splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=seed)
    train_idx, test_idx = next(splitter.split(df, groups=df["learner_id"]))
    train, test = df.iloc[train_idx].reset_index(drop=True), df.iloc[test_idx].reset_index(drop=True)
    assert set(train.learner_id).isdisjoint(test.learner_id)
    X_tr, y_tr, X_te, y_te = train[list(FEATURE_NAMES)], train["level"], test[list(FEATURE_NAMES)], test["level"]

    # --- model selection (training data only) -------------------------------------------------
    cv = GroupKFold(n_splits=5)
    candidates = build_candidates(seed)
    cv_results = {}
    for key, pipe in candidates.items():
        res = cross_validate(pipe, X_tr, y_tr, groups=train["learner_id"], cv=cv,
                             scoring={"neg_log_loss": "neg_log_loss", "f1_macro": "f1_macro"}, n_jobs=1)
        cv_results[key] = {"log_loss_mean": float(-res["test_neg_log_loss"].mean()), "log_loss_std": float(res["test_neg_log_loss"].std()),
                           "macro_f1_mean": float(res["test_f1_macro"].mean()), "macro_f1_std": float(res["test_f1_macro"].std())}
        print(f"  CV {key:24s} log loss {cv_results[key]['log_loss_mean']:.4f}  macro-F1 {cv_results[key]['macro_f1_mean']:.4f}")
    selected = min(cv_results, key=lambda k: cv_results[k]["log_loss_mean"])
    print(f"Selected: {selected}")

    # --- held-out evaluation ------------------------------------------------------------------
    test_rows = []
    fitted = {}
    for key, pipe in candidates.items():
        pipe.fit(X_tr, y_tr)
        fitted[key] = pipe
        proba = pipe.predict_proba(X_te)
        pred = pipe.classes_[proba.argmax(axis=1)]
        test_rows.append({"key": key, "name": CANDIDATE_LABELS[key], "kind": "model", "selected": key == selected,
                          **ev.classification_metrics(y_te, pred, proba, list(pipe.classes_))})

    majority = DummyClassifier(strategy="most_frequent").fit(X_tr, y_tr)
    maj_pred = majority.predict(X_te)
    test_rows.append({"key": "majority_class", "name": f"Majority class (always '{maj_pred[0]}')", "kind": "baseline",
                      "selected": False, **ev.classification_metrics(y_te, maj_pred, majority.predict_proba(X_te), list(majority.classes_))})

    thresh = ev.ThresholdBaseline().fit(X_tr["accuracy"].to_numpy(), y_tr.to_numpy())
    th_pred = thresh.predict(X_te["accuracy"].to_numpy())
    test_rows.append({"key": "accuracy_thresholds", "kind": "baseline", "selected": False,
                      "name": f"Raw accuracy thresholds (< {thresh.low:.2f} beginner, ≥ {thresh.high:.2f} advanced; tuned on train)",
                      **ev.classification_metrics(y_te, th_pred)})

    best = fitted[selected]
    classes = list(best.classes_)
    proba = best.predict_proba(X_te)
    pred = np.asarray(classes)[proba.argmax(axis=1)]
    mastery = ev.mastery_from_proba(proba, classes)
    bins = ev.calibration_bins(y_te, proba, classes)

    metrics = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "data": {
            "synthetic": True,
            "description": "Simulated learners answering PathForge's real question bank under a documented IRT-style "
                           "generative model (ml/data_generation.py). Labels are the simulator's latent ability levels.",
            "seed": seed, "n_learners": int(df.learner_id.nunique()), "n_attempts": int(len(df)),
            "n_train": int(len(train)), "n_test": int(len(test)),
            "n_train_learners": int(train.learner_id.nunique()), "n_test_learners": int(test.learner_id.nunique()),
            "split": "GroupShuffleSplit by learner, 80/20",
            "class_balance": {lvl: float((df.level == lvl).mean()) for lvl in LEVELS},
            "label_thresholds": {"beginner_below_theta": BEGINNER_MAX_THETA, "advanced_above_theta": ADVANCED_MIN_THETA},
            "catalog_fingerprint": catalog.fingerprint,
        },
        "features": [{"name": f} for f in FEATURE_NAMES],
        "model_selection": {"criterion": "Mean 5-fold GroupKFold log loss on the training set", "selected": selected,
                            "cv": [{"key": k, "name": CANDIDATE_LABELS[k], **v} for k, v in cv_results.items()]},
        "test": {
            "comparison": test_rows,
            "selected_model": selected,
            "per_class": ev.per_class_report(y_te, pred),
            "confusion_matrix": ev.confusion(y_te, pred),
            "baseline_confusion_matrix": ev.confusion(y_te, th_pred),
            "calibration": {"bins": bins, "expected_calibration_error": ev.expected_calibration_error(bins)},
            "macro_f1_gain_vs_thresholds": ev.grouped_bootstrap_diff(test["learner_id"], y_te, pred, th_pred, seed=seed),
            "score_validity_spearman": ev.score_validity(test, mastery),
            "feature_importance": ev.feature_importance(best, X_te, y_te, seed),
            "behavioural_checks": ev.behavioural_checks(best),
        },
        "system_checks": {"roadmap": ev.evaluate_roadmaps(seed=seed), "recommender": ev.evaluate_recommender(seed=seed)},
        "environment": {"python": platform.python_version(), "scikit_learn": sklearn.__version__,
                        "numpy": np.__version__, "pandas": pd.__version__},
    }

    version = f"{selected}-s{seed}-{catalog.fingerprint[:8]}"
    metrics["model_version"] = version
    ARTIFACT_DIR.mkdir(exist_ok=True)
    joblib.dump({"pipeline": best, "feature_names": list(FEATURE_NAMES), "classes": classes, "model_key": selected,
                 "model_name": CANDIDATE_LABELS[selected], "version": version, "trained_at": metrics["generated_at"],
                 "sklearn_version": sklearn.__version__, "synthetic_training_data": True}, MODEL_PATH)
    METRICS_PATH.write_text(json.dumps(metrics, indent=2))
    print(f"Saved {MODEL_PATH.name} ({version}) and metrics.json in {time.time() - t0:.1f}s")
    sel = next(r for r in test_rows if r["selected"])
    thr = next(r for r in test_rows if r["key"] == "accuracy_thresholds")
    print(f"Test macro-F1 {sel['macro_f1']:.3f} vs thresholds {thr['macro_f1']:.3f}; accuracy {sel['accuracy']:.3f} vs {thr['accuracy']:.3f}")
    for chk in metrics["test"]["behavioural_checks"]:
        status = "PASS" if chk["passed"] else "FAIL"
        outcome = f"{chk['predicted']} ({chk['mastery_score']:.2f})" if chk["counted"] else "not counted (validity rule)"
        print(f"  [{status}] {chk['case']}: {outcome}")
    return metrics


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--learners", type=int, default=2500)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    args = parser.parse_args()
    main(args.learners, args.seed)
