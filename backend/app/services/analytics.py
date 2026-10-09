"""Progress analytics computed from the learner's own stored history."""
from __future__ import annotations

import statistics
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from uuid import UUID

from psycopg import Connection

from ml.catalog import load_catalog
from ml.roadmap import required_topics

from .. import repository as repo
from .learner_state import load_state

CONFIDENCE_LABELS = {1: "Guess", 2: "Unsure", 3: "Sure"}


def build(conn: Connection, user_id: UUID) -> dict:
    c = load_catalog()
    state = load_state(conn, user_id)
    history = repo.submitted_history(conn, user_id)
    responses = repo.response_stats(conn, user_id)

    timeline = [{"assessment_id": str(h["id"]), "topic_id": h["topic_id"], "topic_name": c.topics[h["topic_id"]].name,
                 "level": h["level"], "mastery_score": h["mastery_score"], "accuracy": h["accuracy"],
                 "submitted_at": h["submitted_at"].isoformat()} for h in history]

    # Heatmap: accuracy per topic × difficulty across every answer the learner has given.
    cells: dict[tuple[str, str], list[bool]] = defaultdict(list)
    for r in responses:
        cells[(r["topic_id"], r["difficulty"])].append(r["is_correct"])
    if state.career_id:
        heat_topics = sorted(required_topics(c, state.career_id), key=lambda t: (c.depth(t), c.topics[t].name))
    else:
        heat_topics = sorted({r["topic_id"] for r in responses}, key=lambda t: (c.depth(t), c.topics[t].name))
    heatmap = {
        "difficulties": ["easy", "medium", "hard"],
        "rows": [{"topic_id": t, "topic_name": c.topics[t].name,
                  "mastery_score": state.mastery.get(t),
                  "cells": [{"difficulty": d, "correct": sum(cells[(t, d)]), "total": len(cells[(t, d)]),
                             "accuracy": (sum(cells[(t, d)]) / len(cells[(t, d)])) if cells[(t, d)] else None}
                            for d in ("easy", "medium", "hard")]}
                 for t in heat_topics],
    }

    confidence = []
    for level in (1, 2, 3):
        rs = [r for r in responses if r["confidence"] == level]
        confidence.append({"confidence": level, "label": CONFIDENCE_LABELS[level], "answers": len(rs),
                           "accuracy": (sum(r["is_correct"] for r in rs) / len(rs)) if rs else None})

    pace = []
    for d in ("easy", "medium", "hard"):
        times = [r["time_ms"] / 1000 for r in responses if r["difficulty"] == d]
        pace.append({"difficulty": d, "answers": len(times), "median_seconds": round(statistics.median(times), 1) if times else None,
                     "expected_seconds": {"easy": 30, "medium": 45, "hard": 60}[d]})

    # Weekly activity for the last 12 weeks (assessments submitted, resources completed).
    now = datetime.now(timezone.utc)
    week0 = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(weeks=11)
    weeks = [week0 + timedelta(weeks=i) for i in range(12)]

    def bucket(ts):
        if ts is None or ts < week0:
            return None
        return min((ts - week0).days // 7, 11)

    activity = [{"week_start": w.date().isoformat(), "assessments": 0, "resources_completed": 0} for w in weeks]
    for h in history:
        if (b := bucket(h["submitted_at"])) is not None:
            activity[b]["assessments"] += 1
    for p in state.progress.values():
        if p["status"] == "completed" and (b := bucket(p["completed_at"])) is not None:
            activity[b]["resources_completed"] += 1

    by_status = {s: 0 for s in ("saved", "in_progress", "completed")}
    minutes_completed, by_format = 0, defaultdict(int)
    for rid, p in state.progress.items():
        by_status[p["status"]] += 1
        if p["status"] == "completed":
            minutes_completed += c.resources[rid].minutes
            by_format[c.resources[rid].format] += 1

    return {
        "totals": {
            "assessments": len(history),
            "topics_assessed": len(state.mastery_rows),
            "answers": len(responses),
            "overall_accuracy": (sum(r["is_correct"] for r in responses) / len(responses)) if responses else None,
            "resources_completed": by_status["completed"],
            "hours_completed": round(minutes_completed / 60, 1),
        },
        "timeline": timeline,
        "heatmap": heatmap,
        "confidence_calibration": confidence,
        "pace": pace,
        "activity": activity,
        "resources": {"by_status": by_status, "completed_by_format": dict(by_format)},
    }
