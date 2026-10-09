"""PathForge AI API."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

import psycopg
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from ml.catalog import load_catalog
from ml.inference import ModelNotTrainedError, get_model

from . import repository as repo
from .config import get_settings
from .db import close_pool, open_pool, transaction
from .routers import assessments, catalog, me, ml

log = logging.getLogger("pathforge")


def catalog_sync_status() -> dict:
    """Compare the database's catalog rows with the JSON catalog the API serves."""
    c = load_catalog()
    with transaction() as conn:
        db = repo.catalog_ids(conn)
    expected = {"topics": set(c.topics), "resources": set(c.resources), "questions": set(c.questions)}
    missing = {k: sorted(expected[k] - db[k]) for k in expected if expected[k] - db[k]}
    return {"in_sync": not missing, "missing_in_database": missing}


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_catalog()
    try:
        get_model()
    except ModelNotTrainedError as exc:  # keep serving catalog/health; assessment submits will 503
        log.error("%s", exc)
    open_pool()
    try:
        sync = catalog_sync_status()
        if not sync["in_sync"]:
            log.warning("Database catalog is out of sync with ml/catalog_data; run supabase/seed.sql. %s", sync)
    except psycopg.Error as exc:
        log.error("Database check failed at startup: %s", exc)
    yield
    close_pool()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="PathForge AI API", version="1.0.0", lifespan=lifespan,
                  docs_url="/docs" if settings.environment != "production" else None)
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=False,
                       allow_methods=["GET", "POST", "PUT", "DELETE"], allow_headers=["Authorization", "Content-Type"])

    @app.exception_handler(ModelNotTrainedError)
    def _model_missing(_: Request, exc: ModelNotTrainedError):
        return JSONResponse({"detail": "The proficiency model is not available. Run `python -m ml.train`."},
                            status_code=status.HTTP_503_SERVICE_UNAVAILABLE)

    @app.exception_handler(psycopg.errors.ForeignKeyViolation)
    def _fk(_: Request, exc):
        log.warning("Foreign key violation: %s", exc.diag.message_primary)
        return JSONResponse({"detail": "A referenced record does not exist (has the account or catalog been removed?)."},
                            status_code=status.HTTP_409_CONFLICT)

    @app.exception_handler(psycopg.errors.IntegrityError)
    def _integrity(_: Request, exc):
        log.warning("Integrity error: %s", exc.diag.message_primary)
        return JSONResponse({"detail": "The request conflicts with existing data."}, status_code=status.HTTP_409_CONFLICT)

    @app.exception_handler(psycopg.OperationalError)
    def _db_down(_: Request, exc):
        log.error("Database unavailable: %s", exc)
        return JSONResponse({"detail": "The database is temporarily unavailable."}, status_code=status.HTTP_503_SERVICE_UNAVAILABLE)

    @app.exception_handler(psycopg.Error)
    def _db_error(_: Request, exc):
        log.exception("Database error")
        return JSONResponse({"detail": "Unexpected database error."}, status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @app.get("/health", tags=["health"])
    def health():
        out = {"status": "ok", "environment": settings.environment}
        try:
            out["model_version"] = get_model().version
        except ModelNotTrainedError:
            out["status"], out["model_version"] = "degraded", None
        try:
            out["catalog"] = catalog_sync_status()
            out["database"] = "ok"
        except psycopg.Error:
            out["status"], out["database"] = "degraded", "unavailable"
        return out

    for r in (catalog.router, me.router, assessments.router, ml.router):
        app.include_router(r)
    return app


app = create_app()
