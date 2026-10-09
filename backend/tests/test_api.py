"""End-to-end API tests against a real PostgreSQL schema (migrations + seed)."""
from __future__ import annotations

import time
import uuid

import psycopg
import pytest

from ml.catalog import load_catalog
from ml.roadmap import MASTERED_THRESHOLD

from .conftest import make_token


def answer_all(questions, correct: bool, confidence: int = 3, seconds: int = 15):
    c = load_catalog()
    out = []
    for q in questions:
        right = c.questions[q["id"]].correct_index
        out.append({"question_id": q["id"], "selected_index": right if correct else (right + 1) % 4,
                    "confidence": confidence, "time_ms": seconds * 1000})
    return out


def take(client, headers, topic, correct=True, confidence=3, seconds=15):
    r = client.post("/api/assessments", json={"topic_id": topic}, headers=headers)
    assert r.status_code == 201, r.text
    data = r.json()
    r = client.post(f"/api/assessments/{data['assessment']['id']}/submit",
                    json={"responses": answer_all(data["questions"], correct, confidence, seconds)}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


# --- health, catalog, auth -----------------------------------------------------------------------
def test_health_reports_model_and_catalog_sync(client):
    body = client.get("/health").json()
    assert body["status"] == "ok" and body["database"] == "ok"
    assert body["catalog"]["in_sync"] is True and body["model_version"]


def test_catalog_endpoints_are_public(client):
    assert len(client.get("/api/catalog/careers").json()) == 6
    topics = client.get("/api/catalog/topics").json()
    assert len(topics) == 26 and all(t["question_count"] >= 6 for t in topics)
    assert all(r["topic_id"] == "react" for r in client.get("/api/catalog/resources?topic=react").json())
    assert client.get("/api/catalog/resources?topic=nope").status_code == 404
    assert client.get("/api/catalog/resources?topic=DROP%20TABLE").status_code == 422


@pytest.mark.parametrize("headers", [
    {},
    {"Authorization": "Bearer not-a-jwt"},
    {"Authorization": f"Bearer {make_token(uuid.uuid4(), secret='wrong-secret-wrong-secret-wrong-secret')}"},
    {"Authorization": f"Bearer {make_token(uuid.uuid4(), exp=int(time.time()) - 10)}"},
    {"Authorization": f"Bearer {make_token(uuid.uuid4(), aud='anon')}"},
])
def test_protected_endpoints_reject_bad_tokens(client, headers):
    assert client.get("/api/me/profile", headers=headers).status_code == 401


def test_token_for_deleted_user_is_rejected_cleanly(client):
    headers = {"Authorization": f"Bearer {make_token(uuid.uuid4())}"}
    r = client.get("/api/me/profile", headers=headers)
    assert r.status_code == 409 and "does not exist" in r.json()["detail"]


# --- profile --------------------------------------------------------------------------------------
def test_profile_created_by_trigger_and_updatable(client, new_user):
    _, h = new_user
    p = client.get("/api/me/profile", headers=h).json()
    assert p["display_name"] == "Test Learner" and p["target_career_id"] is None and p["onboarded_at"] is None
    r = client.put("/api/me/profile", headers=h, json={"target_career_id": "data-analyst", "weekly_hours": 8,
                                                        "preferred_formats": ["video", "interactive", "video"],
                                                        "learning_goal": "Build dashboards for my team"})
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["preferred_formats"] == ["video", "interactive"] and p["onboarded_at"] is not None
    events = client.get("/api/me/events", headers=h).json()
    assert events[0]["trigger"] == "profile" and "Data Analyst" in events[0]["summary"]


@pytest.mark.parametrize("payload", [
    {"weekly_hours": 0}, {"weekly_hours": 61}, {"preferred_formats": ["podcast"]}, {"target_career_id": "astronaut"},
    {"unknown_field": 1}, {"learning_goal": "x" * 501},
])
def test_profile_validation(client, new_user, payload):
    _, h = new_user
    assert client.put("/api/me/profile", headers=h, json=payload).status_code == 422


def test_roadmap_requires_career(client, new_user):
    _, h = new_user
    assert client.get("/api/me/roadmap", headers=h).status_code == 409
    rec = client.get("/api/me/recommendations", headers=h).json()
    assert rec["items"] == [] and rec["empty_reason"] == "no_career"


# --- assessments -----------------------------------------------------------------------------------
def test_assessment_hides_answers_and_resumes(client, new_user):
    _, h = new_user
    a = client.post("/api/assessments", json={"topic_id": "sql-fundamentals"}, headers=h).json()
    assert len(a["questions"]) == 5 and not a["resumed"]
    assert all("correct_index" not in q and "explanation" not in q for q in a["questions"])
    again = client.post("/api/assessments", json={"topic_id": "sql-fundamentals"}, headers=h).json()
    assert again["resumed"] and again["assessment"]["id"] == a["assessment"]["id"]
    assert client.post("/api/assessments", json={"topic_id": "unknown-topic"}, headers=h).status_code == 404


def test_submit_validation(client, new_user):
    _, h = new_user
    a = client.post("/api/assessments", json={"topic_id": "git-version-control"}, headers=h).json()
    url = f"/api/assessments/{a['assessment']['id']}/submit"
    full = answer_all(a["questions"], True)
    assert client.post(url, json={"responses": full[:-1]}, headers=h).status_code == 422          # incomplete
    assert client.post(url, json={"responses": full + [full[0]]}, headers=h).status_code == 422    # duplicate
    bad = [{**full[0], "question_id": "sql-e1"}] + full[1:]
    assert client.post(url, json={"responses": bad}, headers=h).status_code == 422                # foreign question
    assert client.post(url, json={"responses": [{**r, "confidence": 4} for r in full]}, headers=h).status_code == 422
    assert client.post(url, json={"responses": full}, headers=h).status_code == 200
    assert client.post(url, json={"responses": full}, headers=h).status_code == 409               # double submit


def test_assessments_are_private(client, new_user, database_url):
    _, h = new_user
    a = client.post("/api/assessments", json={"topic_id": "probability"}, headers=h).json()
    other = uuid.uuid4()
    with psycopg.connect(database_url, autocommit=True) as conn:
        conn.execute("insert into auth.users (id, email) values (%s, %s)", (other, f"{other}@example.com"))
    oh = {"Authorization": f"Bearer {make_token(other)}"}
    assert client.get(f"/api/assessments/{a['assessment']['id']}", headers=oh).status_code == 404
    assert client.post(f"/api/assessments/{a['assessment']['id']}/submit",
                       json={"responses": answer_all(a["questions"], True)}, headers=oh).status_code == 404


def test_full_adaptive_loop(client, new_user):
    _, h = new_user
    client.put("/api/me/profile", headers=h, json={"target_career_id": "data-analyst", "weekly_hours": 6,
                                                    "preferred_formats": ["interactive"]})
    before = client.get("/api/me/roadmap", headers=h).json()
    assert before["summary"]["mastered"] == 0
    adv = next(s for s in before["steps"] if s["topic_id"] == "advanced-sql")
    assert adv["status"] == "locked" and "sql-fundamentals" in adv["unmet_prerequisites"]
    # advanced SQL resources are not recommendable yet
    assert client.get("/api/me/recommendations?topic=advanced-sql", headers=h).status_code == 409

    weak = take(client, h, "sql-fundamentals", correct=False, confidence=1, seconds=80)
    assert weak["estimate"]["level"] == "beginner" and weak["estimate"]["mastery_score"] < MASTERED_THRESHOLD
    assert weak["adaptation"]["changes"]["topic"]["previous_score"] is None
    assert len(weak["review"]) == 5 and all("correct_index" in q for q in weak["review"])

    strong = take(client, h, "sql-fundamentals", correct=True, confidence=3, seconds=12)
    est = strong["estimate"]
    assert est["level"] == "advanced" and est["mastery_score"] >= MASTERED_THRESHOLD
    assert strong["previous"]["level"] == "beginner"
    changes = strong["adaptation"]["changes"]
    assert {"id": "sql-fundamentals", "name": "SQL Fundamentals"} in changes["newly_mastered"]
    assert "advanced-sql" in {u["id"] for u in changes["unlocked"]}
    assert "Unlocked" in strong["adaptation"]["summary"]

    after = client.get("/api/me/roadmap", headers=h).json()
    assert after["summary"]["mastered"] == 1
    assert "sql-fundamentals" not in {s["topic_id"] for s in after["steps"]}
    assert next(s for s in after["steps"] if s["topic_id"] == "advanced-sql")["status"] == "ready"
    recs = client.get("/api/me/recommendations?topic=advanced-sql", headers=h).json()
    assert recs["items"] and all(i["topic_id"] == "advanced-sql" for i in recs["items"])

    # second attempt used unseen questions where available
    hist = client.get("/api/assessments?topic=sql-fundamentals", headers=h).json()
    assert len(hist) == 2 and all(a["status"] == "submitted" for a in hist)
    first_q, second_q = set(hist[1]["question_ids"]), set(hist[0]["question_ids"])
    assert len(first_q & second_q) <= 4

    mastery = client.get("/api/me/mastery", headers=h).json()
    assert mastery[0]["topic_id"] == "sql-fundamentals" and mastery[0]["state"] == "mastered"

    dash = client.get("/api/me/dashboard", headers=h).json()
    assert dash["stats"]["assessments_taken"] == 2 and dash["career"]["id"] == "data-analyst"
    assert any(r["topic_id"] == "sql-fundamentals" and r["assessed"] for r in dash["radar"])
    assert dash["recent_events"][0]["trigger"] == "assessment"


def test_rapid_guess_attempt_is_stored_but_not_counted(client, new_user):
    _, h = new_user
    client.put("/api/me/profile", headers=h, json={"target_career_id": "data-analyst"})
    a = client.post("/api/assessments", json={"topic_id": "sql-fundamentals"}, headers=h).json()
    r = client.post(f"/api/assessments/{a['assessment']['id']}/submit",
                    json={"responses": answer_all(a["questions"], True, confidence=3, seconds=1)}, headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["counted"] is False and body["estimate"] is None and "under 3 seconds" in body["excluded_reason"]
    assert body["evidence"]["rapid_answers"] == 5 and len(body["review"]) == 5
    assert body["assessment"]["counted"] is False
    assert client.get("/api/me/mastery", headers=h).json() == []
    assert "not counted" in client.get("/api/me/events", headers=h).json()[0]["summary"]
    assert client.get("/api/me/analytics", headers=h).json()["totals"]["assessments"] == 0
    roadmap = client.get("/api/me/roadmap", headers=h).json()
    assert roadmap["summary"]["mastered"] == 0


def test_recommendations_explanations_and_progress(client, new_user):
    _, h = new_user
    client.put("/api/me/profile", headers=h, json={"target_career_id": "frontend-developer", "preferred_formats": ["article"]})
    recs = client.get("/api/me/recommendations?limit=6", headers=h).json()
    assert recs["items"] and recs["focus_topics"]
    top = recs["items"][0]
    assert top["reasons"] and top["components"] and top["resource"]["url"].startswith("https://")
    assert abs(sum(c["contribution"] for c in top["components"]) - top["score"]) < 1e-3
    only_video = client.get("/api/me/recommendations?format=video", headers=h).json()
    assert all(i["resource"]["format"] == "video" for i in only_video["items"])
    assert client.get("/api/me/recommendations?format=podcast", headers=h).status_code == 422

    rid = top["resource_id"]
    assert client.put(f"/api/me/resources/{rid}/progress", json={"status": "in_progress"}, headers=h).status_code == 200
    done = client.put(f"/api/me/resources/{rid}/progress", json={"status": "completed", "rating": 5}, headers=h).json()
    assert done["status"] == "completed" and done["completed_at"] and done["rating"] == 5
    after = client.get("/api/me/recommendations?limit=30", headers=h).json()
    assert rid not in {i["resource_id"] for i in after["items"]}
    mine = client.get("/api/me/resources", headers=h).json()
    assert mine[0]["id"] == rid and mine[0]["progress"]["status"] == "completed"
    assert client.put("/api/me/resources/r-nope/progress", json={"status": "saved"}, headers=h).status_code == 404
    assert client.put(f"/api/me/resources/{rid}/progress", json={"status": "done"}, headers=h).status_code == 422
    assert client.delete(f"/api/me/resources/{rid}/progress", headers=h).status_code == 204
    assert client.delete(f"/api/me/resources/{rid}/progress", headers=h).status_code == 404


def test_analytics_reflect_history(client, new_user):
    _, h = new_user
    empty = client.get("/api/me/analytics", headers=h).json()
    assert empty["totals"]["assessments"] == 0 and empty["totals"]["overall_accuracy"] is None
    client.put("/api/me/profile", headers=h, json={"target_career_id": "backend-developer"})
    take(client, h, "http-rest-apis", correct=True)
    take(client, h, "python-fundamentals", correct=False, confidence=3)
    a = client.get("/api/me/analytics", headers=h).json()
    assert a["totals"]["assessments"] == 2 and a["totals"]["answers"] == 10
    assert a["totals"]["overall_accuracy"] == 0.5
    sure = next(c for c in a["confidence_calibration"] if c["confidence"] == 3)
    assert sure["answers"] == 10 and sure["accuracy"] == 0.5
    http_row = next(r for r in a["heatmap"]["rows"] if r["topic_id"] == "http-rest-apis")
    assert all(cell["accuracy"] in (None, 1.0) for cell in http_row["cells"])
    assert sum(w["assessments"] for w in a["activity"]) == 2
    assert [t["topic_id"] for t in a["timeline"]] == ["http-rest-apis", "python-fundamentals"]


def test_ml_metrics_endpoint(client):
    m = client.get("/api/ml/metrics").json()
    assert m["data"]["synthetic"] is True and m["serving"]["matches_metrics"] is True
    keys = {r["key"] for r in m["test"]["comparison"]}
    assert {"majority_class", "accuracy_thresholds", m["test"]["selected_model"]} <= keys
    assert all(f["description"] for f in m["features"])
