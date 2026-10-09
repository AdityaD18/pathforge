"""Unit tests for catalog integrity, features, item selection, roadmap, ranking and inference."""
import math
import random

import networkx as nx
import pytest

from ml.catalog import load_catalog
from ml.data_generation import simulate_learners, theta_to_level
from ml.features import FEATURE_NAMES, ResponseRecord, attempt_validity, extract_features
from ml.inference import ProficiencyModel, load_metrics
from ml.item_selection import ITEMS_PER_ASSESSMENT, select_questions
from ml.ranking import LearnerContext, focus_topics, rank_resources, target_level
from ml.recommender import ContentIndex
from ml.roadmap import MASTERED_THRESHOLD, build_roadmap, check_prerequisite_order, required_topics


@pytest.fixture(scope="module")
def catalog():
    return load_catalog()


@pytest.fixture(scope="module")
def index(catalog):
    return ContentIndex.build(catalog)


# --- catalog -------------------------------------------------------------------------------
def test_catalog_is_a_dag_with_complete_coverage(catalog):
    assert nx.is_directed_acyclic_graph(catalog.graph)
    for tid in catalog.topics:
        assert len(catalog.questions_for(tid)) >= 6
        assert len(catalog.resources_for(tid)) >= 3


def test_option_shuffle_is_deterministic_and_balanced(catalog):
    again = load_catalog.__wrapped__()
    assert all(again.questions[q].options == catalog.questions[q].options for q in catalog.questions)
    positions = [q.correct_index for q in catalog.questions.values()]
    assert all(positions.count(i) > len(positions) * 0.15 for i in range(4))


# --- features ------------------------------------------------------------------------------
def _r(diff, ok, conf=3, secs=30):
    return ResponseRecord(diff, ok, conf, secs * 1000)


def test_features_values():
    resp = [_r("easy", True), _r("medium", True), _r("hard", False, conf=3), _r("hard", True, conf=1)]
    f = extract_features(resp, prereq_accuracies=[0.5, 1.0], n_prerequisites=4, topic_depth=2)
    assert list(f) == list(FEATURE_NAMES)
    assert f["accuracy"] == 0.75
    assert f["weighted_score"] == pytest.approx((1 + 2 + 3) / 9)
    assert f["acc_hard"] == 0.5
    assert f["sure_wrong_rate"] == 0.25 and f["guess_correct_rate"] == 0.25
    assert f["prereq_mean_accuracy"] == 0.75 and f["prereq_coverage"] == 0.5


def test_features_missing_values_are_nan():
    f = extract_features([_r("easy", False)], [], n_prerequisites=0, topic_depth=0)
    assert math.isnan(f["acc_hard"]) and math.isnan(f["prereq_mean_accuracy"])
    assert math.isnan(f["log_time_ratio_correct"])
    assert f["prereq_coverage"] == 1.0


@pytest.mark.parametrize("bad", [[], [ResponseRecord("trivial", True, 3, 1000)], [ResponseRecord("easy", True, 5, 1000)]])
def test_features_reject_invalid_input(bad):
    with pytest.raises(ValueError):
        extract_features(bad, [], 0, 0)


# --- item selection --------------------------------------------------------------------------
def test_item_selection_prefers_unseen_and_orders_by_difficulty(catalog):
    qs = catalog.questions_for("sql-fundamentals")
    first = select_questions(qs, None, rng=random.Random(1))
    assert len(first) == ITEMS_PER_ASSESSMENT
    assert [q.difficulty for q in first] == ["easy", "easy", "medium", "medium", "hard"]
    second = select_questions(qs, "intermediate", seen_ids=[q.id for q in first], rng=random.Random(2))
    assert [q.difficulty for q in second] == ["easy", "medium", "medium", "hard", "hard"]
    unseen_hard = {q.id for q in qs if q.difficulty == "hard"} - {q.id for q in first}
    assert unseen_hard <= {q.id for q in second}


# --- synthetic data --------------------------------------------------------------------------
def test_simulation_is_reproducible_and_labelled_synthetic():
    a = simulate_learners(40, seed=7)
    b = simulate_learners(40, seed=7)
    assert a.equals(b)
    assert a["is_synthetic"].all()
    assert set(a["level"]) <= {"beginner", "intermediate", "advanced"}
    assert all(theta_to_level(t) == lvl for t, lvl in zip(a.true_theta, a.level))


# --- roadmap ---------------------------------------------------------------------------------
def test_roadmap_respects_prerequisites_for_random_states(catalog):
    rng = random.Random(3)
    for _ in range(200):
        career = rng.choice(sorted(catalog.careers))
        mastery = {t: rng.random() for t in catalog.topics if rng.random() < 0.5}
        rm = build_roadmap(catalog, career, mastery, weekly_hours=rng.randint(1, 30))
        assert check_prerequisite_order(catalog, rm) == []


def test_roadmap_excludes_mastered_and_includes_ancestors(catalog):
    rm = build_roadmap(catalog, "ml-engineer", {"python-fundamentals": 0.95}, weekly_hours=10)
    ids = [s["topic_id"] for s in rm["steps"]]
    assert "python-fundamentals" not in ids
    assert "exploratory-analysis" in ids  # not a career topic, but an ancestor of ml-foundations
    assert required_topics(catalog, "ml-engineer") == {n["topic_id"] for n in rm["graph"]["nodes"]}
    first = rm["steps"][0]
    assert first["status"] == "ready" and first["unmet_prerequisites"] == []


def test_roadmap_status_and_schedule(catalog):
    rm = build_roadmap(catalog, "data-analyst", {"sql-fundamentals": 0.5}, weekly_hours=5)
    sql = next(s for s in rm["steps"] if s["topic_id"] == "sql-fundamentals")
    adv = next(s for s in rm["steps"] if s["topic_id"] == "advanced-sql")
    assert sql["status"] == "in_progress" and adv["status"] == "locked"
    assert adv["unmet_prerequisites"] == ["sql-fundamentals"]
    weeks = [(s["start_week"], s["end_week"]) for s in rm["steps"]]
    assert all(a <= b for a, b in weeks) and weeks == sorted(weeks)
    assert rm["summary"]["estimated_weeks"] == math.ceil(rm["summary"]["total_hours_remaining"] / 5)


def test_roadmap_complete_when_everything_mastered(catalog):
    req = required_topics(catalog, "frontend-developer")
    rm = build_roadmap(catalog, "frontend-developer", {t: MASTERED_THRESHOLD for t in req}, weekly_hours=8)
    assert rm["steps"] == [] and rm["summary"]["progress"] == 1.0


def test_roadmap_rejects_bad_input(catalog):
    with pytest.raises(KeyError):
        build_roadmap(catalog, "astronaut", {}, 5)
    with pytest.raises(ValueError):
        build_roadmap(catalog, "data-analyst", {}, 0)


# --- recommender & ranking -----------------------------------------------------------------
def test_tfidf_similarity_finds_topic_resources(catalog, index):
    sims = index.similarity("window functions partition by rank running totals")
    best = index.resource_ids[int(sims.argmax())]
    assert catalog.resources[best].topic == "advanced-sql"
    assert index.shared_terms("window functions", best)


def test_ranking_only_recommends_unlocked_topics(catalog, index):
    rm = build_roadmap(catalog, "data-scientist", {}, weekly_hours=6)
    focus = focus_topics(rm)
    ctx = LearnerContext("Data Scientist", "I want to run experiments", ["video"], None, 6)
    recs = rank_resources(catalog, index, focus, {}, ctx, limit=20)
    unlocked = {s["topic_id"] for s in rm["steps"] if not s["unmet_prerequisites"]}
    assert recs and {r["topic_id"] for r in recs} <= unlocked
    for r in recs:
        assert sum(c["contribution"] for c in r["components"]) == pytest.approx(r["score"], abs=1e-3)
        assert r["reasons"]
    assert [r["score"] for r in recs] == sorted([r["score"] for r in recs], reverse=True)


def test_ranking_level_fit_and_exclusions(catalog, index):
    step = {"topic_id": "sql-fundamentals", "name": "SQL Fundamentals", "order": 1}
    excluded = frozenset({"r-sql-bolt"})
    ctx = LearnerContext(None, None, [], None, 10, excluded)
    recs = rank_resources(catalog, index, [step], {"sql-fundamentals": 0.1}, ctx)
    assert "r-sql-bolt" not in {r["resource_id"] for r in recs}
    assert all(r["target_level"] == "beginner" for r in recs)
    assert target_level(0.55, None) == "intermediate" and target_level(None, "advanced") == "advanced"


def test_ranking_filters(catalog, index):
    step = {"topic_id": "react", "name": "React", "order": 1}
    ctx = LearnerContext(None, None, [], None, 10)
    recs = rank_resources(catalog, index, [step], {}, ctx, formats=["article"])
    assert recs and all(catalog.resources[r["resource_id"]].format == "article" for r in recs)


# --- trained model -------------------------------------------------------------------------
def test_model_loads_and_predicts_monotonically():
    model = ProficiencyModel.load()
    weak = model.predict([_r("easy", False, 1, 70), _r("easy", True, 1, 60), _r("medium", False, 2, 90),
                          _r("medium", False, 1, 80), _r("hard", False, 1, 120)], [], 0, 0)
    strong = model.predict([_r("easy", True, 3, 12), _r("easy", True, 3, 15), _r("medium", True, 3, 20),
                            _r("medium", True, 3, 25), _r("hard", True, 3, 30)], [], 0, 0)
    assert weak.level == "beginner" and strong.level == "advanced"
    assert 0 <= weak.mastery_score < strong.mastery_score <= 1
    assert sum(strong.probabilities.values()) == pytest.approx(1, abs=1e-3)


def test_rapid_guessing_is_not_counted():
    rapid_wrong = [_r(d, False, 1, 1) for d in ("easy", "easy", "medium", "medium", "hard")]
    counted, reason = attempt_validity(rapid_wrong)
    assert counted is False and "under 3 seconds" in reason
    two_rapid = rapid_wrong[:2] + [_r("medium", True, 3, 40)] * 3
    assert attempt_validity(two_rapid) == (True, None)
    f = extract_features(rapid_wrong, [], 0, 0)
    assert f["rapid_guess_rate"] == 1.0


def test_metrics_are_consistent_with_artifact():
    m = load_metrics()
    model = ProficiencyModel.load()
    assert m["model_version"] == model.version
    assert m["data"]["synthetic"] is True
    rows = {r["key"]: r for r in m["test"]["comparison"]}
    assert rows[m["test"]["selected_model"]]["macro_f1"] > rows["accuracy_thresholds"]["macro_f1"]
    assert m["system_checks"]["roadmap"]["prerequisite_violations"] == 0
    assert all(c["passed"] for c in m["test"]["behavioural_checks"]), m["test"]["behavioural_checks"]
