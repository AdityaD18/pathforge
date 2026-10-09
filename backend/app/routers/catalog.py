from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status

from ml.catalog import load_catalog

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


@router.get("/careers")
def careers():
    c = load_catalog()
    return [{"id": car.id, "title": car.title, "icon": car.icon, "description": car.description,
             "topics": [{"topic_id": t, "name": c.topics[t].name, "weight": w}
                        for t, w in sorted(car.topics.items(), key=lambda kv: (-kv[1], c.topics[kv[0]].name))]}
            for car in c.careers.values()]


@router.get("/topics")
def topics():
    c = load_catalog()
    return [{"id": t.id, "name": t.name, "domain": t.domain, "description": t.description, "est_hours": t.est_hours,
             "prerequisites": list(t.prerequisites), "depth": c.depth(t.id),
             "question_count": len(c.questions_for(t.id)), "resource_count": len(c.resources_for(t.id))}
            for t in sorted(c.topics.values(), key=lambda t: (c.depth(t.id), t.name))]


@router.get("/resources")
def resources(topic: str | None = Query(None, max_length=64, pattern=r"^[a-z0-9-]+$")):
    c = load_catalog()
    if topic and topic not in c.topics:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown topic '{topic}'")
    items = c.resources_for(topic) if topic else list(c.resources.values())
    return [{"id": r.id, "topic_id": r.topic, "title": r.title, "provider": r.provider, "url": r.url, "format": r.format,
             "difficulty": r.difficulty, "est_minutes": r.minutes, "description": r.description, "tags": list(r.tags)}
            for r in items]
