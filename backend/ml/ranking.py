"""Explainable ranking of learning resources for one learner.

Score = weighted sum of interpretable components, each in [0, 1]:

  relevance     0.35  TF-IDF cosine similarity between the resource and a query built
                      from the focus topic, the learner's goal and target career
                      (normalised by the best match within that topic)
  priority      0.25  how early the resource's topic sits among the learner's next roadmap steps
  level_fit     0.20  resource difficulty vs. the level implied by the learner's mastery estimate
  format_fit    0.12  matches the learner's preferred formats (neutral 0.5 if none chosen)
  time_fit      0.08  fits within one week of the learner's study budget

Candidates come only from topics that are unlocked (all prerequisites mastered),
so recommendations never jump ahead of the prerequisite graph.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, Mapping, Sequence

from .catalog import Catalog
from .recommender import ContentIndex
from .roadmap import MASTERED_THRESHOLD, NEAR_MASTERY

WEIGHTS = {"relevance": 0.35, "priority": 0.25, "level_fit": 0.20, "format_fit": 0.12, "time_fit": 0.08}
LEVEL_ORDER = {"beginner": 0, "intermediate": 1, "advanced": 2}
MAX_PER_TOPIC = 3
FOCUS_TOPICS = 3


@dataclass(frozen=True)
class LearnerContext:
    career_title: str | None
    learning_goal: str | None
    preferred_formats: Sequence[str]
    preferred_level: str | None
    weekly_hours: int
    excluded_resource_ids: frozenset[str] = field(default_factory=frozenset)


def target_level(score: float | None, preferred_level: str | None) -> str:
    """Resource level a learner should work at for a topic, from the mastery estimate."""
    if score is None:
        return preferred_level or "beginner"
    if score < NEAR_MASTERY:
        return "beginner"
    if score < MASTERED_THRESHOLD:
        return "intermediate"
    return "advanced"


def focus_topics(roadmap: dict, limit: int = FOCUS_TOPICS) -> list[dict]:
    """The next unlocked, unmastered roadmap steps (in roadmap order)."""
    return [s for s in roadmap["steps"] if s["status"] in ("ready", "in_progress")][:limit]


def build_query(catalog: Catalog, topic_id: str, ctx: LearnerContext) -> str:
    t = catalog.topics[topic_id]
    parts = [t.name, t.description]
    if ctx.learning_goal:
        parts.append(ctx.learning_goal)
    if ctx.career_title:
        parts.append(ctx.career_title)
    return " ".join(parts)


def rank_resources(
    catalog: Catalog,
    index: ContentIndex,
    topics: Sequence[dict],
    mastery: Mapping[str, float],
    ctx: LearnerContext,
    limit: int = 9,
    formats: Iterable[str] | None = None,
    levels: Iterable[str] | None = None,
) -> list[dict]:
    """Rank resources for the given focus topics (each a roadmap step dict with topic_id)."""
    format_filter = set(formats or [])
    level_filter = set(levels or [])
    budget_minutes = ctx.weekly_hours * 60
    ranked: list[dict] = []

    for rank_pos, step in enumerate(topics):
        tid = step["topic_id"]
        topic = catalog.topics[tid]
        query = build_query(catalog, tid, ctx)
        sims = index.similarity(query)
        candidates = [r for r in catalog.resources_for(tid) if r.id not in ctx.excluded_resource_ids
                      and (not format_filter or r.format in format_filter)
                      and (not level_filter or r.difficulty in level_filter)]
        if not candidates:
            continue
        best_sim = max(sims[index.position(r.id)] for r in candidates) or 1.0
        score = mastery.get(tid)
        level = target_level(score, ctx.preferred_level)
        priority = 1.0 - rank_pos / max(len(topics), 1) if len(topics) > 1 else 1.0

        for r in candidates:
            sim = float(sims[index.position(r.id)])
            gap = abs(LEVEL_ORDER[r.difficulty] - LEVEL_ORDER[level])
            components = {
                "relevance": sim / best_sim if best_sim > 0 else 0.0,
                "priority": priority,
                "level_fit": {0: 1.0, 1: 0.4, 2: 0.0}[gap],
                "format_fit": (1.0 if r.format in ctx.preferred_formats else 0.0) if ctx.preferred_formats else 0.5,
                "time_fit": 1.0 if r.minutes <= budget_minutes else budget_minutes / r.minutes,
            }
            total = sum(WEIGHTS[k] * v for k, v in components.items())
            ranked.append({
                "resource_id": r.id,
                "topic_id": tid,
                "topic_name": topic.name,
                "score": round(total, 4),
                "cosine_similarity": round(sim, 4),
                "components": [{"name": k, "weight": WEIGHTS[k], "value": round(v, 4), "contribution": round(WEIGHTS[k] * v, 4)}
                               for k, v in components.items()],
                "target_level": level,
                "matched_terms": index.shared_terms(query, r.id),
                "reasons": _reasons(r, step, score, level, components, ctx),
            })

    ranked.sort(key=lambda x: (-x["score"], x["resource_id"]))
    per_topic: dict[str, int] = {}
    diverse = []
    for item in ranked:  # cap each topic so one topic doesn't crowd out the rest
        if per_topic.get(item["topic_id"], 0) < MAX_PER_TOPIC:
            diverse.append(item)
            per_topic[item["topic_id"]] = per_topic.get(item["topic_id"], 0) + 1
    return diverse[:limit]


def _reasons(resource, step: dict, score: float | None, level: str, comp: dict, ctx: LearnerContext) -> list[str]:
    reasons = []
    if step.get("order"):
        reasons.append(f"{step['name']} is step {step['order']} of your roadmap and all its prerequisites are met.")
    if score is None:
        reasons.append(f"You haven't assessed {step['name']} yet, so this starts at the {level} level.")
    else:
        reasons.append(f"Your estimated mastery of {step['name']} is {round(score * 100)}%, which suggests {level} material.")
    if comp["level_fit"] == 1.0:
        reasons.append(f"Its difficulty ({resource.difficulty}) matches that level.")
    elif comp["level_fit"] > 0:
        reasons.append(f"Its difficulty ({resource.difficulty}) is one step from your target level.")
    if ctx.preferred_formats and comp["format_fit"] == 1.0:
        reasons.append(f"It's a {resource.format}, one of your preferred formats.")
    if comp["time_fit"] < 1.0:
        reasons.append(f"At about {round(resource.minutes / 60)} hours it spans more than one week of your study time.")
    return reasons
