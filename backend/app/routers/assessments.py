from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from psycopg import Connection

from ml.catalog import load_catalog

from .. import repository as repo
from ..auth import CurrentUser, current_user
from ..db import get_conn
from ..schemas import StartAssessment, SubmitAssessment
from ..services import assessments as svc

router = APIRouter(prefix="/api/assessments", tags=["assessments"])


@router.get("")
def list_assessments(topic: str | None = Query(None, max_length=64, pattern=r"^[a-z0-9-]+$"),
                     limit: int = Query(50, ge=1, le=200),
                     user: CurrentUser = Depends(current_user), conn: Connection = Depends(get_conn)):
    c = load_catalog()
    rows = repo.list_assessments(conn, user.id, topic, limit)
    return [{**r, "topic_name": c.topics[r["topic_id"]].name} for r in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
def start_assessment(body: StartAssessment, user: CurrentUser = Depends(current_user), conn: Connection = Depends(get_conn)):
    return svc.start(conn, user.id, body.topic_id)


@router.get("/{assessment_id}")
def get_assessment(assessment_id: UUID, user: CurrentUser = Depends(current_user), conn: Connection = Depends(get_conn)):
    return svc.get(conn, user.id, assessment_id)


@router.post("/{assessment_id}/submit")
def submit_assessment(assessment_id: UUID, body: SubmitAssessment, user: CurrentUser = Depends(current_user),
                      conn: Connection = Depends(get_conn)):
    return svc.submit(conn, user.id, assessment_id, body)
