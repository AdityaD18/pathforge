"""Motivation and progress insights derived only from the learner's stored activity.

Everything here is computed from real rows (assessments, answers, resource progress, adaptation events);
nothing is estimated or padded. Days are bucketed in the learner's own time zone so streaks match their calendar.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from psycopg import Connection

from ml.catalog import load_catalog
from ml.roadmap import MASTERED_THRESHOLD, required_topics

from .learner_state import LearnerState

ACTIVITY_DAYS = 26 * 7          # calendar heatmap span (26 weeks)
WEEKLY_ACTIVE_DAYS_GOAL = 5     # "active days this week" ring target


def resolve_tz(name: str | None) -> ZoneInfo | timezone:
    if not name:
        return timezone.utc
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return timezone.utc


def _activity_rows(conn: Connection, user_id: UUID) -> dict[str, list[datetime]]:
    assessments = conn.execute(
        "select submitted_at from public.assessments where user_id = %s and status = 'submitted' and submitted_at is not null",
        (user_id,)).fetchall()
    completed = conn.execute(
        "select completed_at from public.resource_progress where user_id = %s and completed_at is not null",
        (user_id,)).fetchall()
    return {"assessments": [r["submitted_at"] for r in assessments], "resources": [r["completed_at"] for r in completed]}


def _streaks(active: set[date], today: date) -> dict:
    longest, run, prev = 0, 0, None
    longest_end = None
    for d in sorted(active):
        run = run + 1 if prev and (d - prev).days == 1 else 1
        if run > longest:
            longest, longest_end = run, d
        prev = d
    # The current streak survives until the end of the day after the last active day.
    current = 0
    cursor = today if today in active else today - timedelta(days=1)
    while cursor in active:
        current += 1
        cursor -= timedelta(days=1)
    return {"current": current, "longest": longest, "active_today": today in active,
            "longest_ended": longest_end.isoformat() if longest_end else None}


def _first_streak_day(active: set[date], length: int) -> date | None:
    run, prev = 0, None
    for d in sorted(active):
        run = run + 1 if prev and (d - prev).days == 1 else 1
        if run >= length:
            return d
        prev = d
    return None


def build(conn: Connection, user_id: UUID, state: LearnerState, history: list[dict], responses: list[dict],
          events: list[dict], tz_name: str | None = None) -> dict:
    c = load_catalog()
    tz = resolve_tz(tz_name)
    now = datetime.now(timezone.utc)
    today = now.astimezone(tz).date()
    local = lambda ts: ts.astimezone(tz).date()  # noqa: E731

    # --- daily activity and streaks ---------------------------------------------------------------
    rows = _activity_rows(conn, user_id)
    per_day: dict[date, dict[str, int]] = defaultdict(lambda: {"assessments": 0, "resources": 0})
    for ts in rows["assessments"]:
        per_day[local(ts)]["assessments"] += 1
    for ts in rows["resources"]:
        per_day[local(ts)]["resources"] += 1
    active = {d for d, v in per_day.items() if v["assessments"] or v["resources"]}

    start = today - timedelta(days=today.weekday()) - timedelta(weeks=25)  # Monday, 26 weeks ago
    daily = []
    d = start
    while d <= today:
        v = per_day.get(d, {"assessments": 0, "resources": 0})
        daily.append({"date": d.isoformat(), "assessments": v["assessments"], "resources": v["resources"],
                      "total": v["assessments"] + v["resources"]})
        d += timedelta(days=1)

    week_start = today - timedelta(days=today.weekday())
    week_days = [week_start + timedelta(days=i) for i in range(7)]
    week = {"active_days": sum(1 for x in week_days if x in active), "goal": WEEKLY_ACTIVE_DAYS_GOAL,
            "days": [{"date": x.isoformat(), "active": x in active, "future": x > today} for x in week_days]}
    streak = _streaks(active, today)

    # --- career readiness ---------------------------------------------------------------------------
    readiness = None
    if state.career_id:
        career = c.careers[state.career_id]
        parts = []
        for tid, w in sorted(career.topics.items(), key=lambda kv: (-kv[1], c.topics[kv[0]].name)):
            score = state.mastery.get(tid)
            credit = min((score or 0.0) / MASTERED_THRESHOLD, 1.0)
            parts.append({"topic_id": tid, "name": c.topics[tid].name, "weight": w, "mastery_score": score,
                          "credit": round(credit, 4)})
        total_w = sum(p["weight"] for p in parts)
        readiness = {
            "score": round(sum(p["weight"] * p["credit"] for p in parts) / total_w, 4) if total_w else 0.0,
            "career_title": career.title,
            "formula": "Weighted average over the career's goal topics of min(mastery ÷ 70%, 1); "
                       "core topics weigh 3, supporting topics 1–2, unassessed topics count as 0.",
            "topics": parts,
        }

    # --- topic status breakdown (whole roadmap, including prerequisites) ------------------------------
    breakdown = None
    if state.career_id:
        req = required_topics(c, state.career_id)
        counts = {"mastered": 0, "developing": 0, "beginning": 0, "not_assessed": 0}
        for t in req:
            s = state.mastery.get(t)
            key = "not_assessed" if s is None else "mastered" if s >= MASTERED_THRESHOLD else "developing" if s >= 0.4 else "beginning"
            counts[key] += 1
        breakdown = {"total": len(req), **counts}

    # --- remaining topics over time (from recorded plan changes) --------------------------------------
    burndown = []
    for e in sorted(events, key=lambda e: e["created_at"]):
        rm = (e["changes"] or {}).get("roadmap") or {}
        if rm.get("remaining_after") is None:
            continue
        if not burndown and rm.get("remaining_before") is not None and e["trigger"] != "profile":
            burndown.append({"at": e["created_at"].isoformat(), "remaining": rm["remaining_before"], "trigger": "start"})
        burndown.append({"at": e["created_at"].isoformat(), "remaining": rm["remaining_after"], "trigger": e["trigger"],
                         "weeks": rm.get("weeks_after")})
    rm_now = state.roadmap()
    forecast = None
    if rm_now:
        s = rm_now["summary"]
        forecast = {"remaining": s["remaining"], "estimated_weeks": s["estimated_weeks"],
                    "finish_date": (today + timedelta(weeks=s["estimated_weeks"])).isoformat() if s["remaining"] else today.isoformat(),
                    "weekly_hours": int(state.profile["weekly_hours"])}

    # --- per-topic mastery history ----------------------------------------------------------------------
    topic_history: dict[str, list[dict]] = defaultdict(list)
    for h in history:
        topic_history[h["topic_id"]].append({"at": h["submitted_at"].isoformat(), "score": h["mastery_score"]})

    badges = _badges(c, state, history, responses, events, rows, active, streak, breakdown, topic_history)

    return {
        "today": today.isoformat(),
        "daily": daily,
        "streak": streak,
        "week": week,
        "readiness": readiness,
        "breakdown": breakdown,
        "burndown": burndown,
        "forecast": forecast,
        "topic_history": [{"topic_id": t, "name": c.topics[t].name, "points": pts} for t, pts in sorted(
            topic_history.items(), key=lambda kv: c.topics[kv[0]].name)],
        "badges": badges,
    }


def _badge(id_: str, name: str, description: str, icon: str, progress: float, label: str, earned_at=None) -> dict:
    earned = progress >= 1.0
    return {"id": id_, "name": name, "description": description, "icon": icon, "earned": earned,
            "earned_at": (earned_at.isoformat() if hasattr(earned_at, "isoformat") else earned_at) if earned else None,
            "progress": round(min(progress, 1.0), 4), "progress_label": label}


def _nth(timestamps: list[datetime], n: int):
    ts = sorted(timestamps)
    return ts[n - 1] if len(ts) >= n else None


def _badges(c, state, history, responses, events, rows, active, streak, breakdown, topic_history) -> list[dict]:
    out = []
    n_assess = len(history)
    out.append(_badge("first-step", "First step", "Submit your first counted assessment.", "footprints",
                      min(n_assess, 1), f"{min(n_assess, 1)}/1", history[0]["submitted_at"] if history else None))

    mastered_events = sorted((e["created_at"] for e in events if (e["changes"] or {}).get("newly_mastered")))
    n_mastered = sum(1 for s in state.mastery.values() if s >= MASTERED_THRESHOLD)
    out.append(_badge("first-mastery", "First mastery", "Reach 70% estimated mastery on any topic.", "medal",
                      min(n_mastered, 1), f"{min(n_mastered, 1)}/1", mastered_events[0] if mastered_events else None))

    topics_assessed = len(state.mastery_rows)
    fifth_topic = None
    seen = []
    for h in history:
        if h["topic_id"] not in seen:
            seen.append(h["topic_id"])
            if len(seen) == 5:
                fifth_topic = h["submitted_at"]
    out.append(_badge("explorer", "Explorer", "Get a mastery estimate on 5 different topics.", "compass",
                      topics_assessed / 5, f"{min(topics_assessed, 5)}/5", fifth_topic))

    for length, name, icon in ((3, "On a roll", "flame"), (7, "Week-long streak", "zap")):
        out.append(_badge(f"streak-{length}", name, f"Be active {length} days in a row.", icon,
                          streak["longest"] / length, f"{min(streak['longest'], length)}/{length} days",
                          _first_streak_day(active, length)))

    done = rows["resources"]
    for n, name, icon in ((5, "Bookworm", "book-open"), (15, "Library card", "library")):
        out.append(_badge(f"resources-{n}", name, f"Complete {n} learning resources.", icon,
                          len(done) / n, f"{min(len(done), n)}/{n}", _nth(done, n)))

    hard_right = [r for r in responses if r["difficulty"] == "hard" and r["is_correct"]]
    out.append(_badge("hard-10", "Deep end", "Answer 10 hard questions correctly.", "mountain",
                      len(hard_right) / 10, f"{min(len(hard_right), 10)}/10"))

    sure = [r for r in responses if r["confidence"] == 3]
    sure_acc = (sum(r["is_correct"] for r in sure) / len(sure)) if sure else 0.0
    calibrated = len(sure) >= 10 and sure_acc >= 0.8
    out.append(_badge("calibrated", "Know what you know",
                      "Give 10+ answers marked “sure” and get at least 80% of them right.", "target",
                      1.0 if calibrated else min(min(len(sure) / 10, 1.0) * min(sure_acc / 0.8, 1.0), 0.99),
                      f"{len(sure)} sure answers, {round(sure_acc * 100)}% right" if sure else "no sure answers yet"))

    best_gain, gain_at = 0.0, None
    for pts in topic_history.values():
        low = None
        for p in pts:
            low = p["score"] if low is None else min(low, p["score"])
            if p["score"] - low > best_gain:
                best_gain, gain_at = p["score"] - low, p["at"]
    out.append(_badge("comeback", "Comeback", "Raise a topic's mastery by 30 points or more.", "trending-up",
                      best_gain / 0.30, f"best gain {round(best_gain * 100)} pts", gain_at))

    if breakdown and breakdown["total"]:
        half = -(-breakdown["total"] // 2)
        out.append(_badge("halfway", "Halfway there", "Master half of the topics on your roadmap.", "flag",
                          breakdown["mastered"] / half, f"{min(breakdown['mastered'], half)}/{half} topics"))
        out.append(_badge("path-complete", "Path complete", "Master every topic on your roadmap.", "trophy",
                          breakdown["mastered"] / breakdown["total"], f"{breakdown['mastered']}/{breakdown['total']} topics"))
    return out
