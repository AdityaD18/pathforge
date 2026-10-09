"""Endpoints scoped to the signed-in learner."""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from psycopg import Connection

from ml.catalog import load_catalog
from ml.roadmap import topic_state

from .. import repository as repo
from ..auth import CurrentUser, current_user
from ..db import get_conn
from ..schemas import Profile, ProfileUpdate, ResourceProgressUpdate
from ..services import analytics
from ..services.adaptation import describe_change
from ..services.learner_state import load_state, recommendations, resource_payload

router = APIRouter(prefix="/api/me", tags=["learner"])

FormatParam = Literal["video", "article", "course", "interactive", "book", "documentation"]
LevelParam = Literal["beginner", "intermediate", "advanced"]


@router.get("/profile", response_model=Profile)
def get_profile(user: CurrentUser = Depends(current_user), conn: Connection = Depends(get_conn)):
    return repo.ensure_profile(conn, user.id)


@router.put("/profile", response_model=Profile)
def update_profile(body: ProfileUpdate, user: CurrentUser = Depends(current_user), conn: Connection = Depends(get_conn)):
    c = load_catalog()
    changes = body.model_dump(exclude_unset=True)
    if changes.get("target_career_id") and changes["target_career_id"] not in c.careers:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"Unknown career '{changes['target_career_id']}'")

    before = load_state(conn, user.id)
    roadmap_before = before.roadmap()
    recs_before = [i["resource_id"] for i in recommendations(before, limit=5)["items"]] if roadmap_before else []
    profile = repo.update_profile(conn, user.id, changes)

    plan_fields = ("target_career_id", "weekly_hours", "preferred_formats", "preferred_level", "learning_goal")
    if any(f in changes and changes[f] != before.profile[f] for f in plan_fields):
        after = load_state(conn, user.id)
        roadmap_after = after.roadmap()
        recs_after = [i["resource_id"] for i in recommendations(after, limit=5)["items"]] if roadmap_after else []
        summary, diff = describe_change(mastery_before=before.mastery, mastery_after=after.mastery,
                                        roadmap_before=roadmap_before, roadmap_after=roadmap_after,
                                        recs_before=recs_before, recs_after=recs_after)
        if "target_career_id" in changes and changes["target_career_id"] != before.profile["target_career_id"]:
            title = c.careers[changes["target_career_id"]].title if changes["target_career_id"] else "no career"
            summary = f"Target set to {title}. " + summary
        diff["profile_fields"] = sorted(f for f in plan_fields if f in changes and changes[f] != before.profile[f])
        repo.insert_event(conn, user.id, "profile", summary, diff)
    return profile


@router.get("/mastery")
def mastery(user: CurrentUser = Depends(current_user), conn: Connection = Depends(get_conn)):
    c = load_catalog()
    rows = repo.mastery_rows(conn, user.id)
    return [{**r, "topic_name": c.topics[t].name, "state": topic_state(r["mastery_score"])} for t, r in sorted(rows.items())]


@router.get("/roadmap")
def roadmap(user: CurrentUser = Depends(current_user), conn: Connection = Depends(get_conn)):
    state = load_state(conn, user.id)
    rm = state.roadmap()
    if rm is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Choose a target career to generate a roadmap")
    return rm


@router.get("/recommendations")
def get_recommendations(limit: int = Query(9, ge=1, le=30),
                        format: list[FormatParam] | None = Query(None),
                        level: list[LevelParam] | None = Query(None),
                        topic: str | None = Query(None, max_length=64, pattern=r"^[a-z0-9-]+$"),
                        user: CurrentUser = Depends(current_user), conn: Connection = Depends(get_conn)):
    state = load_state(conn, user.id)
    return recommendations(state, limit=limit, formats=format, levels=level, topic_id=topic)


@router.get("/resources")
def my_resources(user: CurrentUser = Depends(current_user), conn: Connection = Depends(get_conn)):
    c = load_catalog()
    progress = repo.progress_rows(conn, user.id)
    items = [{**resource_payload(c, rid, progress), "topic_name": c.topics[c.resources[rid].topic].name,
              "updated_at": p["updated_at"]} for rid, p in progress.items() if rid in c.resources]
    return sorted(items, key=lambda i: i["updated_at"], reverse=True)


@router.put("/resources/{resource_id}/progress")
def set_progress(resource_id: str, body: ResourceProgressUpdate, user: CurrentUser = Depends(current_user),
                 conn: Connection = Depends(get_conn)):
    c = load_catalog()
    if resource_id not in c.resources:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown resource '{resource_id}'")
    state = load_state(conn, user.id)
    previous = state.progress.get(resource_id)
    row = repo.upsert_progress(conn, user.id, resource_id, body.status, body.rating)
    if body.status == "completed" and (previous is None or previous["status"] != "completed"):
        r = c.resources[resource_id]
        repo.insert_event(conn, user.id, "progress",
                          f"Completed “{r.title}” ({c.topics[r.topic].name}). It is now excluded from recommendations; "
                          f"take the {c.topics[r.topic].name} assessment to update your mastery estimate.",
                          {"resource_id": resource_id, "topic_id": r.topic})
    return row


@router.delete("/resources/{resource_id}/progress", status_code=status.HTTP_204_NO_CONTENT)
def clear_progress(resource_id: str, user: CurrentUser = Depends(current_user), conn: Connection = Depends(get_conn)):
    if not repo.delete_progress(conn, user.id, resource_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No saved progress for this resource")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/events")
def events(limit: int = Query(20, ge=1, le=100), user: CurrentUser = Depends(current_user), conn: Connection = Depends(get_conn)):
    return repo.list_events(conn, user.id, limit)


@router.get("/analytics")
def get_analytics(user: CurrentUser = Depends(current_user), conn: Connection = Depends(get_conn)):
    return analytics.build(conn, user.id)


@router.get("/dashboard")
def dashboard(user: CurrentUser = Depends(current_user), conn: Connection = Depends(get_conn)):
    c = load_catalog()
    state = load_state(conn, user.id)
    rm = state.roadmap()
    career = c.careers.get(state.career_id) if state.career_id else None
    radar = []
    if career:
        for tid, weight in sorted(career.topics.items(), key=lambda kv: (-kv[1], c.topics[kv[0]].name)):
            score = state.mastery.get(tid)
            radar.append({"topic_id": tid, "name": c.topics[tid].name, "weight": weight, "mastery_score": score,
                          "assessed": score is not None})
    recs = recommendations(state, limit=3) if rm else {"items": [], "focus_topics": [], "empty_reason": "no_career"}
    history = repo.submitted_history(conn, user.id)
    return {
        "profile": state.profile,
        "career": {"id": career.id, "title": career.title, "icon": career.icon, "description": career.description} if career else None,
        "roadmap_summary": rm["summary"] if rm else None,
        "next_steps": rm["steps"][:4] if rm else [],
        "radar": radar,
        "recommendations": recs,
        "recent_events": repo.list_events(conn, user.id, 5),
        "stats": {
            "assessments_taken": len(history),
            "topics_assessed": len(state.mastery_rows),
            "average_mastery": (sum(state.mastery.values()) / len(state.mastery)) if state.mastery else None,
            "resources_completed": sum(1 for p in state.progress.values() if p["status"] == "completed"),
            "resources_in_progress": sum(1 for p in state.progress.values() if p["status"] == "in_progress"),
        },
    }
