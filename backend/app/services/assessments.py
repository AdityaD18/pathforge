"""Assessment lifecycle: start (adaptive item selection) → submit (scoring, inference, adaptation)."""
from __future__ import annotations

import random
import statistics
from uuid import UUID

from fastapi import HTTPException, status
from psycopg import Connection

from ml.catalog import load_catalog
from ml.features import RAPID_GUESS_MS, ResponseRecord, attempt_validity
from ml.inference import get_model
from ml.item_selection import select_questions

from .. import repository as repo
from ..schemas import SubmitAssessment
from .adaptation import describe_change
from .learner_state import load_state, recommendations

_rng = random.SystemRandom()


def _topic_or_404(topic_id: str):
    c = load_catalog()
    if topic_id not in c.topics:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown topic '{topic_id}'")
    return c.topics[topic_id]


def _public_questions(question_ids: list[str]) -> list[dict]:
    c = load_catalog()
    return [{"id": q.id, "difficulty": q.difficulty, "prompt": q.prompt, "options": list(q.options),
             "expected_seconds": q.expected_seconds} for q in (c.questions[i] for i in question_ids)]


def _topic_payload(topic_id: str) -> dict:
    t = load_catalog().topics[topic_id]
    return {"id": t.id, "name": t.name, "domain": t.domain, "description": t.description}


def start(conn: Connection, user_id: UUID, topic_id: str) -> dict:
    _topic_or_404(topic_id)
    repo.ensure_profile(conn, user_id)
    existing = repo.open_assessment(conn, user_id, topic_id)
    if existing:  # resume rather than creating duplicates
        return {"assessment": existing, "topic": _topic_payload(topic_id), "questions": _public_questions(existing["question_ids"]),
                "resumed": True}
    prior = repo.mastery_rows(conn, user_id).get(topic_id)
    seen = repo.seen_question_ids(conn, user_id, topic_id)
    rng = random.Random(_rng.random())
    chosen = select_questions(load_catalog().questions_for(topic_id), prior["level"] if prior else None, seen, rng)
    row = repo.create_assessment(conn, user_id, topic_id, [q.id for q in chosen])
    return {"assessment": row, "topic": _topic_payload(topic_id), "questions": _public_questions(row["question_ids"]),
            "resumed": False}


def get(conn: Connection, user_id: UUID, assessment_id: UUID) -> dict:
    row = repo.get_assessment(conn, user_id, assessment_id)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assessment not found")
    payload = {"assessment": row, "topic": _topic_payload(row["topic_id"])}
    if row["status"] == "in_progress":
        payload["questions"] = _public_questions(row["question_ids"])
    else:
        payload["review"] = _review(row, repo.responses_for(conn, assessment_id))
        payload["evidence"] = _evidence(row["question_ids"], repo.responses_for(conn, assessment_id))
    return payload


def _review(row: dict, responses: list[dict]) -> list[dict]:
    c = load_catalog()
    by_q = {r["question_id"]: r for r in responses}
    out = []
    for qid in row["question_ids"]:
        q = c.questions[qid]
        r = by_q.get(qid)
        out.append({"id": q.id, "difficulty": q.difficulty, "prompt": q.prompt, "options": list(q.options),
                    "correct_index": q.correct_index, "explanation": q.explanation,
                    "selected_index": r["selected_index"] if r else None, "is_correct": r["is_correct"] if r else None,
                    "confidence": r["confidence"] if r else None, "time_ms": r["time_ms"] if r else None})
    return out


def _evidence(question_ids: list[str], responses: list[dict]) -> dict:
    """Human-readable summary of what the model saw (used in the result explanation)."""
    c = load_catalog()
    by_diff: dict[str, list[bool]] = {}
    for r in responses:
        by_diff.setdefault(c.questions[r["question_id"]].difficulty, []).append(r["is_correct"])
    sure = [r for r in responses if r["confidence"] == 3]
    return {
        "correct": sum(r["is_correct"] for r in responses),
        "total": len(responses),
        "by_difficulty": [{"difficulty": d, "correct": sum(v), "total": len(v)} for d in ("easy", "medium", "hard")
                          if (v := by_diff.get(d))],
        "median_seconds": round(statistics.median(r["time_ms"] for r in responses) / 1000, 1) if responses else None,
        "rapid_answers": sum(1 for r in responses if r["time_ms"] < RAPID_GUESS_MS),
        "sure_answers": len(sure),
        "sure_but_wrong": sum(1 for r in sure if not r["is_correct"]),
    }


def submit(conn: Connection, user_id: UUID, assessment_id: UUID, body: SubmitAssessment) -> dict:
    c = load_catalog()
    row = repo.get_assessment(conn, user_id, assessment_id, lock=True)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assessment not found")
    if row["status"] != "in_progress":
        raise HTTPException(status.HTTP_409_CONFLICT, "This assessment has already been submitted")
    expected, received = set(row["question_ids"]), {r.question_id for r in body.responses}
    if expected != received:
        missing, extra = sorted(expected - received), sorted(received - expected)
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT,
                            {"message": "Answer every question in this assessment exactly once",
                             "missing": missing, "unexpected": extra})

    topic = c.topics[row["topic_id"]]
    state = load_state(conn, user_id)
    mastery_before = state.mastery
    previous = state.mastery_rows.get(topic.id)

    scored = [{"question_id": r.question_id, "selected_index": r.selected_index, "confidence": r.confidence,
               "time_ms": r.time_ms, "is_correct": r.selected_index == c.questions[r.question_id].correct_index}
              for r in body.responses]
    records = [ResponseRecord(c.questions[s["question_id"]].difficulty, s["is_correct"], s["confidence"], s["time_ms"])
               for s in scored]
    prereq_acc = [state.mastery_rows[p]["accuracy"] for p in topic.prerequisites if p in state.mastery_rows]
    estimate = get_model().predict(records, prereq_acc, len(topic.prerequisites), c.depth(topic.id))
    accuracy = sum(s["is_correct"] for s in scored) / len(scored)
    counted, excluded_reason = attempt_validity(records)

    roadmap_before = state.roadmap(mastery_before)
    recs_before = [i["resource_id"] for i in recommendations(state, limit=5, mastery=mastery_before)["items"]] \
        if roadmap_before else []

    repo.insert_responses(conn, assessment_id, scored)
    updated = repo.complete_assessment(conn, assessment_id, estimate, accuracy, counted, excluded_reason)
    if not counted:
        event = repo.insert_event(conn, user_id, "assessment",
                                  f"{topic.name}: attempt not counted. {excluded_reason} Retake it when you have a few minutes.",
                                  {"topic": {"id": topic.id, "name": topic.name}, "not_counted": True}, assessment_id)
        responses = repo.responses_for(conn, assessment_id)
        return {"assessment": updated, "topic": _topic_payload(topic.id), "counted": False, "excluded_reason": excluded_reason,
                "estimate": None,
                "previous": {"level": previous["level"], "mastery_score": previous["mastery_score"]} if previous else None,
                "evidence": _evidence(row["question_ids"], responses), "review": _review(updated, responses),
                "adaptation": event}

    repo.upsert_mastery(conn, user_id, topic.id, estimate, accuracy, assessment_id)

    mastery_after = {**mastery_before, topic.id: estimate.mastery_score}
    roadmap_after = state.roadmap(mastery_after)
    recs_after = [i["resource_id"] for i in recommendations(state, limit=5, mastery=mastery_after)["items"]] \
        if roadmap_after else []

    summary, changes = describe_change(
        mastery_before=mastery_before, mastery_after=mastery_after,
        roadmap_before=roadmap_before, roadmap_after=roadmap_after,
        recs_before=recs_before, recs_after=recs_after,
        topic={"id": topic.id, "name": topic.name,
               "previous_level": previous["level"] if previous else None,
               "previous_score": previous["mastery_score"] if previous else None,
               "new_level": estimate.level, "new_score": estimate.mastery_score},
    )
    event = repo.insert_event(conn, user_id, "assessment", summary, changes, assessment_id)
    responses = repo.responses_for(conn, assessment_id)
    return {
        "assessment": updated,
        "topic": _topic_payload(topic.id),
        "counted": True,
        "excluded_reason": None,
        "estimate": {"level": estimate.level, "mastery_score": estimate.mastery_score, "confidence": estimate.confidence,
                     "probabilities": estimate.probabilities, "model_version": estimate.model_version,
                     "features": estimate.features},
        "previous": {"level": previous["level"], "mastery_score": previous["mastery_score"]} if previous else None,
        "evidence": _evidence(row["question_ids"], responses),
        "review": _review(updated, responses),
        "adaptation": event,
    }
