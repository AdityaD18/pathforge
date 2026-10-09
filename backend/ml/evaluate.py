"""Evaluation utilities: held-out metrics, baselines, calibration, importance and system checks.

Nothing in this module invents numbers; every value is computed from model
predictions on held-out data or from running the roadmap/recommender code.
"""
from __future__ import annotations

import random
from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy.stats import spearmanr
from sklearn.inspection import permutation_importance
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    cohen_kappa_score,
    confusion_matrix,
    f1_score,
    log_loss,
    precision_recall_fscore_support,
)

from .data_generation import LEVELS
from .features import FEATURE_DESCRIPTIONS, FEATURE_NAMES

ORDINAL = {lvl: i for i, lvl in enumerate(LEVELS)}


def mastery_from_proba(proba: np.ndarray, classes: list[str]) -> np.ndarray:
    """Expected proficiency on a 0–1 scale: P(intermediate)·0.5 + P(advanced)·1."""
    idx = {c: i for i, c in enumerate(classes)}
    return proba[:, idx["intermediate"]] * 0.5 + proba[:, idx["advanced"]]


def _ordered_proba(proba: np.ndarray, classes: list[str]) -> np.ndarray:
    idx = [list(classes).index(lvl) for lvl in LEVELS]
    return proba[:, idx]


def classification_metrics(y_true, y_pred, proba: np.ndarray | None = None, classes: list[str] | None = None) -> dict:
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)
    out = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "macro_f1": float(f1_score(y_true, y_pred, average="macro", labels=list(LEVELS), zero_division=0)),
        "balanced_accuracy": float(balanced_accuracy_score(y_true, y_pred)),
        "quadratic_kappa": float(cohen_kappa_score([ORDINAL[v] for v in y_true], [ORDINAL[v] for v in y_pred],
                                                   weights="quadratic")),
        "log_loss": None,
        "brier": None,
    }
    if proba is not None and classes is not None:
        p = np.clip(_ordered_proba(proba, classes), 1e-9, 1)
        onehot = np.eye(len(LEVELS))[[ORDINAL[v] for v in y_true]]
        # sklearn's log_loss expects probability columns in sorted label order.
        sorted_labels = sorted(LEVELS)
        p_sorted = p[:, [LEVELS.index(lbl) for lbl in sorted_labels]]
        out["log_loss"] = float(log_loss(y_true, p_sorted, labels=sorted_labels))
        out["brier"] = float(np.mean(np.sum((p - onehot) ** 2, axis=1)))
    return out


@dataclass
class ThresholdBaseline:
    """The rule a non-ML app would use: bucket raw accuracy into levels.

    Thresholds are tuned on the TRAINING set to maximise macro-F1, so the
    comparison against the model is fair rather than a strawman.
    """

    low: float = 0.4
    high: float = 0.8

    def fit(self, accuracy: np.ndarray, y: np.ndarray) -> "ThresholdBaseline":
        grid = np.round(np.arange(0.05, 1.0, 0.05), 2)
        best = (-1.0, self.low, self.high)
        for lo in grid:
            for hi in grid:
                if hi <= lo:
                    continue
                score = f1_score(y, self._predict(accuracy, lo, hi), average="macro", labels=list(LEVELS), zero_division=0)
                if score > best[0]:
                    best = (score, float(lo), float(hi))
        _, self.low, self.high = best
        return self

    @staticmethod
    def _predict(acc: np.ndarray, lo: float, hi: float) -> np.ndarray:
        return np.where(acc < lo, "beginner", np.where(acc >= hi, "advanced", "intermediate"))

    def predict(self, accuracy: np.ndarray) -> np.ndarray:
        return self._predict(accuracy, self.low, self.high)


def per_class_report(y_true, y_pred) -> list[dict]:
    p, r, f, s = precision_recall_fscore_support(y_true, y_pred, labels=list(LEVELS), zero_division=0)
    return [{"level": lvl, "precision": float(p[i]), "recall": float(r[i]), "f1": float(f[i]), "support": int(s[i])}
            for i, lvl in enumerate(LEVELS)]


def confusion(y_true, y_pred) -> dict:
    return {"labels": list(LEVELS), "matrix": confusion_matrix(y_true, y_pred, labels=list(LEVELS)).tolist()}


def calibration_bins(y_true, proba: np.ndarray, classes: list[str], n_bins: int = 10) -> list[dict]:
    """Reliability of the top-class probability: mean confidence vs observed accuracy per bin."""
    conf = proba.max(axis=1)
    pred = np.asarray(classes)[proba.argmax(axis=1)]
    hit = (pred == np.asarray(y_true)).astype(float)
    edges = np.linspace(1 / 3, 1.0, n_bins + 1)  # top-class probability of 3 classes is >= 1/3
    bins = []
    for i in range(n_bins):
        mask = (conf >= edges[i]) & ((conf < edges[i + 1]) if i < n_bins - 1 else (conf <= edges[i + 1]))
        if mask.sum() == 0:
            continue
        bins.append({"bin_start": float(edges[i]), "bin_end": float(edges[i + 1]), "mean_confidence": float(conf[mask].mean()),
                     "observed_accuracy": float(hit[mask].mean()), "count": int(mask.sum())})
    return bins


def expected_calibration_error(bins: list[dict]) -> float:
    total = sum(b["count"] for b in bins)
    return float(sum(b["count"] / total * abs(b["mean_confidence"] - b["observed_accuracy"]) for b in bins))


def grouped_bootstrap_diff(groups, y_true, pred_a, pred_b, n_boot: int = 500, seed: int = 0) -> dict:
    """95% CI for macro-F1(model A) − macro-F1(model B), resampling whole learners."""
    rng = np.random.default_rng(seed)
    groups = np.asarray(groups)
    uniq = np.unique(groups)
    index_by_group = {g: np.flatnonzero(groups == g) for g in uniq}
    y_true, pred_a, pred_b = map(np.asarray, (y_true, pred_a, pred_b))
    diffs = []
    for _ in range(n_boot):
        sample = rng.choice(uniq, size=len(uniq), replace=True)
        idx = np.concatenate([index_by_group[g] for g in sample])
        fa = f1_score(y_true[idx], pred_a[idx], average="macro", labels=list(LEVELS), zero_division=0)
        fb = f1_score(y_true[idx], pred_b[idx], average="macro", labels=list(LEVELS), zero_division=0)
        diffs.append(fa - fb)
    diffs = np.array(diffs)
    return {"mean": float(diffs.mean()), "ci_low": float(np.percentile(diffs, 2.5)), "ci_high": float(np.percentile(diffs, 97.5)),
            "n_boot": n_boot}


def score_validity(test: pd.DataFrame, mastery: np.ndarray) -> dict:
    """Does the 0–1 mastery score track the simulator's latent ability better than raw accuracy?"""
    def rho(x):
        return float(spearmanr(x, test["true_theta"]).statistic)
    return {"model_mastery_score": rho(mastery), "raw_accuracy": rho(test["accuracy"]),
            "difficulty_weighted_score": rho(test["weighted_score"])}


def feature_importance(pipeline, X: pd.DataFrame, y, seed: int) -> list[dict]:
    result = permutation_importance(pipeline, X, y, scoring="f1_macro", n_repeats=5, random_state=seed, n_jobs=1)
    rows = [{"feature": name, "description": FEATURE_DESCRIPTIONS[name], "importance_mean": float(result.importances_mean[i]),
             "importance_std": float(result.importances_std[i])} for i, name in enumerate(FEATURE_NAMES)]
    return sorted(rows, key=lambda r: r["importance_mean"], reverse=True)


# ---------------------------------------------------------------------------
# System checks for the non-learned components
# ---------------------------------------------------------------------------

def evaluate_roadmaps(n_states: int = 600, seed: int = 0) -> dict:
    """Generate roadmaps for random learner states and count prerequisite violations."""
    from .catalog import load_catalog
    from .roadmap import build_roadmap, check_prerequisite_order

    c = load_catalog()
    rng = random.Random(seed)
    violations, steps_total, checked = 0, 0, 0
    for _ in range(n_states):
        career = rng.choice(sorted(c.careers))
        mastery = {t: rng.random() for t in c.topics if rng.random() < 0.4}
        roadmap = build_roadmap(c, career, mastery, weekly_hours=rng.randint(2, 20))
        problems = check_prerequisite_order(c, roadmap)
        violations += len(problems)
        steps_total += len(roadmap["steps"])
        checked += 1
    return {"roadmaps_checked": checked, "steps_checked": steps_total, "prerequisite_violations": violations}


def evaluate_recommender(k: int = 3, seed: int = 0) -> dict:
    """Sanity check of the TF-IDF content index on a topic-retrieval task.

    For each topic, the topic's description (which never appears in resource text)
    is used as a query over ALL resources; a hit is a resource curated for that
    topic. This measures whether the content representation captures topical
    relevance. It is not a measure of learner satisfaction.
    """
    from .catalog import load_catalog
    from .recommender import ContentIndex

    c = load_catalog()
    index = ContentIndex.build(c)
    rng = np.random.default_rng(seed)
    p_at_k, rr, rand_p, rand_rr = [], [], [], []
    for t in c.topics.values():
        relevant = {r.id for r in c.resources_for(t.id)}
        scores = index.similarity(t.description)
        ranked = [index.resource_ids[i] for i in np.argsort(-scores, kind="stable")]
        p_at_k.append(len(relevant & set(ranked[:k])) / k)
        rr.append(1.0 / (1 + next(i for i, rid in enumerate(ranked) if rid in relevant)))
        for _ in range(50):
            perm = list(rng.permutation(index.resource_ids))
            rand_p.append(len(relevant & set(perm[:k])) / k)
            rand_rr.append(1.0 / (1 + next(i for i, rid in enumerate(perm) if rid in relevant)))
    return {"task": "topic retrieval from topic description", "k": k, "queries": len(c.topics), "corpus_size": len(index.resource_ids),
            "tfidf": {"precision_at_k": float(np.mean(p_at_k)), "mrr": float(np.mean(rr))},
            "random": {"precision_at_k": float(np.mean(rand_p)), "mrr": float(np.mean(rand_rr))}}
