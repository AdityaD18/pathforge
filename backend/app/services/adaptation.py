"""Describe how a learner's plan changed after new evidence (the adaptive loop's audit trail)."""
from __future__ import annotations

from ml.catalog import load_catalog
from ml.roadmap import MASTERED_THRESHOLD


def _mastered(scores: dict[str, float]) -> set[str]:
    return {t for t, s in scores.items() if s >= MASTERED_THRESHOLD}


def _available(roadmap: dict | None) -> set[str]:
    if not roadmap:
        return set()
    return {s["topic_id"] for s in roadmap["steps"] if s["status"] in ("ready", "in_progress")}


def describe_change(
    *,
    mastery_before: dict[str, float],
    mastery_after: dict[str, float],
    roadmap_before: dict | None,
    roadmap_after: dict | None,
    recs_before: list[str],
    recs_after: list[str],
    topic: dict | None = None,
) -> tuple[str, dict]:
    """Return (one-paragraph summary, structured changes) for an adaptation event."""
    c = load_catalog()
    name = lambda t: c.topics[t].name  # noqa: E731
    changes: dict = {}
    sentences: list[str] = []

    if topic:
        changes["topic"] = topic
        prev = topic.get("previous_score")
        new = topic["new_score"]
        if prev is None:
            sentences.append(f"{name(topic['id'])}: first estimate is {topic['new_level']} ({round(new * 100)}% mastery).")
        else:
            delta = round((new - prev) * 100)
            direction = "up" if delta > 0 else ("down" if delta < 0 else "unchanged")
            moved = f"{direction} {abs(delta)} points" if delta else "unchanged"
            sentences.append(f"{name(topic['id'])}: {topic['previous_level']} → {topic['new_level']}, "
                             f"mastery {round(prev * 100)}% → {round(new * 100)}% ({moved}).")

    gained = sorted(_mastered(mastery_after) - _mastered(mastery_before))
    lost = sorted(_mastered(mastery_before) - _mastered(mastery_after))
    changes["newly_mastered"] = [{"id": t, "name": name(t)} for t in gained]
    changes["no_longer_mastered"] = [{"id": t, "name": name(t)} for t in lost]
    if gained:
        sentences.append("Now mastered: " + ", ".join(name(t) for t in gained) + ".")
    if lost:
        sentences.append("No longer counted as mastered: " + ", ".join(name(t) for t in lost) + ".")

    unlocked = sorted(_available(roadmap_after) - _available(roadmap_before) - set(gained))
    if topic:
        unlocked = [t for t in unlocked if t != topic["id"]]
    changes["unlocked"] = [{"id": t, "name": name(t)} for t in unlocked]
    if unlocked:
        sentences.append("Unlocked: " + ", ".join(name(t) for t in unlocked) + ".")

    if roadmap_before is not None or roadmap_after is not None:
        sb = (roadmap_before or {}).get("summary", {})
        sa = (roadmap_after or {}).get("summary", {})
        nb = roadmap_before["steps"][0]["topic_id"] if roadmap_before and roadmap_before["steps"] else None
        na = roadmap_after["steps"][0]["topic_id"] if roadmap_after and roadmap_after["steps"] else None
        changes["roadmap"] = {"remaining_before": sb.get("remaining"), "remaining_after": sa.get("remaining"),
                              "weeks_before": sb.get("estimated_weeks"), "weeks_after": sa.get("estimated_weeks"),
                              "next_step_before": nb, "next_step_after": na}
        wb, wa = sb.get("estimated_weeks"), sa.get("estimated_weeks")
        if wb is not None and wa is not None and wb != wa:
            sentences.append(f"Estimated time to goal: {wb} → {wa} weeks.")
        if na and na != nb:
            sentences.append(f"Next step is now {name(na)}.")
        if roadmap_after is not None and not roadmap_after["steps"]:
            sentences.append("Every topic on your roadmap is mastered.")

    added = [r for r in recs_after if r not in recs_before]
    removed = [r for r in recs_before if r not in recs_after]
    changes["recommendations"] = {"added": added, "removed": removed}
    if added:
        sentences.append(f"{len(added)} new resource{'s' if len(added) != 1 else ''} in your top recommendations.")

    if not sentences:
        sentences.append("No change to your plan.")
    return " ".join(sentences), changes
