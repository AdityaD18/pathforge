"""Prerequisite-aware learning roadmap generation with NetworkX.

Given a target career and the learner's current mastery estimates, the roadmap
  * includes every career topic plus all of its transitive prerequisites,
  * drops topics already mastered,
  * orders the rest with a priority-aware topological sort, which guarantees that
    every unmastered prerequisite appears before the topics that depend on it,
  * schedules steps into weeks using the learner's weekly study hours.
"""
from __future__ import annotations

import math
from typing import Mapping

import networkx as nx

from .catalog import Catalog

MASTERED_THRESHOLD = 0.70   # mastery score at or above which a topic counts as mastered
NEAR_MASTERY = 0.40         # partially-known topics get a small priority boost to finish them


def topic_state(score: float | None) -> str:
    if score is None:
        return "not_assessed"
    if score >= MASTERED_THRESHOLD:
        return "mastered"
    if score >= NEAR_MASTERY:
        return "developing"
    return "beginning"


def required_topics(catalog: Catalog, career_id: str) -> set[str]:
    goals = set(catalog.careers[career_id].topics)
    required = set(goals)
    for t in goals:
        required |= nx.ancestors(catalog.graph, t)
    return required


def build_roadmap(catalog: Catalog, career_id: str, mastery: Mapping[str, float], weekly_hours: int) -> dict:
    if career_id not in catalog.careers:
        raise KeyError(f"Unknown career {career_id!r}")
    if weekly_hours < 1:
        raise ValueError("weekly_hours must be >= 1")

    career = catalog.careers[career_id]
    required = required_topics(catalog, career_id)
    sub = catalog.graph.subgraph(required)
    mastered = {t for t in required if mastery.get(t, -1.0) >= MASTERED_THRESHOLD}

    # Priority: career importance plus the importance of everything this topic unlocks.
    priority: dict[str, float] = {}
    for t in required:
        own = career.topics.get(t, 0)
        downstream = sum(career.topics.get(d, 0) for d in nx.descendants(sub, t))
        partial = 0.5 if NEAR_MASTERY <= mastery.get(t, -1.0) < MASTERED_THRESHOLD else 0.0
        priority[t] = 2.0 * own + 0.5 * downstream + partial

    pending = sub.subgraph(required - mastered)
    order = list(nx.lexicographical_topological_sort(
        pending, key=lambda t: (-priority[t], catalog.depth(t), t)))

    steps, cumulative = [], 0.0
    for position, tid in enumerate(order, start=1):
        topic = catalog.topics[tid]
        score = mastery.get(tid)
        prereqs = list(topic.prerequisites)
        unmet = [p for p in prereqs if p not in mastered]
        status = "locked" if unmet else ("in_progress" if score is not None else "ready")
        remaining = max(1.0, topic.est_hours * (1.0 - (score or 0.0)))
        start_week = math.floor(cumulative / weekly_hours) + 1
        cumulative += remaining
        end_week = max(start_week, math.ceil(cumulative / weekly_hours))
        unlocks = sorted(d for d in sub.successors(tid))
        steps.append({
            "order": position,
            "topic_id": tid,
            "name": topic.name,
            "domain": topic.domain,
            "status": status,
            "mastery_score": score,
            "state": topic_state(score),
            "career_weight": career.topics.get(tid, 0),
            "is_goal": tid in career.topics,
            "prerequisites": prereqs,
            "unmet_prerequisites": unmet,
            "unlocks": unlocks,
            "est_hours_remaining": round(remaining, 1),
            "start_week": start_week,
            "end_week": end_week,
            "priority": round(priority[tid], 2),
            "reason": _reason(catalog, career, tid, score, unmet, unlocks),
        })

    nodes = []
    for tid in sorted(required, key=lambda t: (catalog.depth(t), t)):
        score = mastery.get(tid)
        step = next((s for s in steps if s["topic_id"] == tid), None)
        nodes.append({
            "topic_id": tid, "name": catalog.topics[tid].name, "domain": catalog.topics[tid].domain,
            "depth": catalog.depth(tid), "mastery_score": score, "state": topic_state(score),
            "status": "mastered" if tid in mastered else step["status"],
            "order": step["order"] if step else None, "is_goal": tid in career.topics,
            "career_weight": career.topics.get(tid, 0),
        })
    edges = [{"source": u, "target": v} for u, v in sub.edges()]

    total_hours = round(sum(s["est_hours_remaining"] for s in steps), 1)
    return {
        "career_id": career_id,
        "career_title": career.title,
        "weekly_hours": weekly_hours,
        "steps": steps,
        "graph": {"nodes": nodes, "edges": edges},
        "summary": {
            "required_topics": len(required),
            "mastered": len(mastered),
            "remaining": len(steps),
            "ready_now": sum(1 for s in steps if s["status"] in ("ready", "in_progress")),
            "total_hours_remaining": total_hours,
            "estimated_weeks": math.ceil(total_hours / weekly_hours) if steps else 0,
            "progress": round(len(mastered) / len(required), 4) if required else 1.0,
        },
    }


def _reason(catalog: Catalog, career, tid: str, score: float | None, unmet: list[str], unlocks: list[str]) -> str:
    parts = []
    weight = career.topics.get(tid, 0)
    if weight:
        label = {3: "Core", 2: "Important", 1: "Supporting"}[weight]
        parts.append(f"{label} skill for {career.title}")
    else:
        parts.append(f"Prerequisite on the path to {career.title}")
    if unlocks:
        names = [catalog.topics[u].name for u in unlocks[:2]]
        more = f" and {len(unlocks) - 2} more" if len(unlocks) > 2 else ""
        parts.append(f"unlocks {', '.join(names)}{more}")
    if score is not None:
        parts.append(f"currently estimated at {round(score * 100)}% mastery")
    if unmet:
        parts.append("waiting on " + ", ".join(catalog.topics[p].name for p in unmet))
    return "; ".join(parts) + "."


def check_prerequisite_order(catalog: Catalog, roadmap: dict) -> list[str]:
    """Return a list of constraint violations (empty means the roadmap is valid)."""
    problems = []
    position = {s["topic_id"]: s["order"] for s in roadmap["steps"]}
    mastered = {n["topic_id"] for n in roadmap["graph"]["nodes"] if n["status"] == "mastered"}
    required = {n["topic_id"] for n in roadmap["graph"]["nodes"]}
    for s in roadmap["steps"]:
        if s["topic_id"] in mastered:
            problems.append(f"{s['topic_id']} is mastered but still scheduled")
        for p in catalog.topics[s["topic_id"]].prerequisites:
            if p not in required:
                problems.append(f"{p} (prerequisite of {s['topic_id']}) missing from roadmap")
            elif p not in mastered and position.get(p, math.inf) >= s["order"]:
                problems.append(f"{s['topic_id']} scheduled before its prerequisite {p}")
    missing = required - mastered - set(position)
    problems += [f"{t} is required but not scheduled" for t in sorted(missing)]
    return problems
