"""Assemble a learner's current state and derive roadmap and recommendations from it."""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from uuid import UUID

from fastapi import HTTPException, status
from psycopg import Connection

from ml.catalog import Catalog, load_catalog
from ml.ranking import LearnerContext, focus_topics, rank_resources
from ml.recommender import ContentIndex
from ml.roadmap import MASTERED_THRESHOLD, build_roadmap

from .. import repository as repo


@lru_cache(maxsize=1)
def content_index() -> ContentIndex:
    return ContentIndex.build(load_catalog())


@dataclass
class LearnerState:
    user_id: UUID
    profile: dict
    mastery_rows: dict[str, dict]
    progress: dict[str, dict]

    @property
    def mastery(self) -> dict[str, float]:
        return {t: r["mastery_score"] for t, r in self.mastery_rows.items()}

    @property
    def career_id(self) -> str | None:
        return self.profile["target_career_id"]

    def roadmap(self, mastery: dict[str, float] | None = None) -> dict | None:
        if not self.career_id:
            return None
        return build_roadmap(load_catalog(), self.career_id, self.mastery if mastery is None else mastery,
                             int(self.profile["weekly_hours"]))

    def context(self) -> LearnerContext:
        c = load_catalog()
        completed = frozenset(rid for rid, p in self.progress.items() if p["status"] == "completed")
        return LearnerContext(
            career_title=c.careers[self.career_id].title if self.career_id else None,
            learning_goal=self.profile["learning_goal"],
            preferred_formats=tuple(self.profile["preferred_formats"] or ()),
            preferred_level=self.profile["preferred_level"],
            weekly_hours=int(self.profile["weekly_hours"]),
            excluded_resource_ids=completed,
        )


def load_state(conn: Connection, user_id: UUID) -> LearnerState:
    profile = repo.ensure_profile(conn, user_id)
    return LearnerState(user_id, profile, repo.mastery_rows(conn, user_id), repo.progress_rows(conn, user_id))


def resource_payload(catalog: Catalog, resource_id: str, progress: dict[str, dict]) -> dict:
    r = catalog.resources[resource_id]
    p = progress.get(resource_id)
    return {"id": r.id, "topic_id": r.topic, "title": r.title, "provider": r.provider, "url": r.url, "format": r.format,
            "difficulty": r.difficulty, "est_minutes": r.minutes, "description": r.description, "tags": list(r.tags),
            "progress": {"status": p["status"], "rating": p["rating"]} if p else None}


def unmet_prerequisites(catalog: Catalog, topic_id: str, mastery: dict[str, float]) -> list[str]:
    return [p for p in catalog.topics[topic_id].prerequisites if mastery.get(p, -1) < MASTERED_THRESHOLD]


def recommendations(state: LearnerState, limit: int = 9, formats=None, levels=None, topic_id: str | None = None,
                    mastery: dict[str, float] | None = None) -> dict:
    catalog = load_catalog()
    mastery = state.mastery if mastery is None else mastery
    ctx = state.context()

    if topic_id:
        if topic_id not in catalog.topics:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown topic '{topic_id}'")
        unmet = unmet_prerequisites(catalog, topic_id, mastery)
        if unmet:
            names = ", ".join(catalog.topics[p].name for p in unmet)
            raise HTTPException(status.HTTP_409_CONFLICT,
                                f"{catalog.topics[topic_id].name} is locked until you master: {names}.")
        focus = [{"topic_id": topic_id, "name": catalog.topics[topic_id].name, "order": None}]
    else:
        roadmap = state.roadmap(mastery)
        if roadmap is None:
            return {"items": [], "focus_topics": [], "empty_reason": "no_career"}
        focus = focus_topics(roadmap)
        if not focus:
            return {"items": [], "focus_topics": [], "empty_reason": "roadmap_complete"}

    ranked = rank_resources(catalog, content_index(), focus, mastery, ctx, limit=limit, formats=formats, levels=levels)
    items = [{**r, "resource": resource_payload(catalog, r["resource_id"], state.progress)} for r in ranked]
    return {
        "items": items,
        "focus_topics": [{"topic_id": f["topic_id"], "name": f["name"], "order": f.get("order"),
                          "mastery_score": mastery.get(f["topic_id"])} for f in focus],
        "empty_reason": None if items else "filters_exclude_all",
    }
