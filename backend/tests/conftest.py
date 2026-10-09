"""Shared fixtures. API/database tests need a local PostgreSQL server.

Set TEST_DATABASE_ADMIN_URL (default: postgresql://postgres@localhost:5432/postgres). The fixtures
create a throwaway database named ``pathforge_test``, apply the Supabase auth stub, every migration
and the seed, and drop it afterwards. Tests that need the database are skipped if it's unreachable.
"""
from __future__ import annotations

import os
import time
import uuid
from pathlib import Path

import jwt
import psycopg
import pytest
from psycopg.conninfo import make_conninfo

ROOT = Path(__file__).resolve().parents[2]
ADMIN_URL = os.environ.get("TEST_DATABASE_ADMIN_URL", "postgresql://postgres@localhost:5432/postgres")
TEST_DB = "pathforge_test"
JWT_SECRET = "test-secret-with-at-least-32-characters-ok"


def _db_url(name: str) -> str:
    return make_conninfo(ADMIN_URL, dbname=name)


@pytest.fixture(scope="session")
def database_url():
    try:
        admin = psycopg.connect(ADMIN_URL, autocommit=True, connect_timeout=3)
    except psycopg.OperationalError as exc:
        pytest.skip(f"PostgreSQL not reachable at TEST_DATABASE_ADMIN_URL ({exc})")
    admin.execute(f'drop database if exists "{TEST_DB}" with (force)')
    admin.execute(f'create database "{TEST_DB}"')
    url = _db_url(TEST_DB)
    files = [ROOT / "backend/tests/sql/supabase_auth_stub.sql", *sorted((ROOT / "supabase/migrations").glob("*.sql")),
             ROOT / "supabase/seed.sql"]
    with psycopg.connect(url, autocommit=True) as conn:
        for f in files:
            conn.execute(f.read_text())
    yield url
    admin.execute(f'drop database if exists "{TEST_DB}" with (force)')
    admin.close()


@pytest.fixture(scope="session")
def client(database_url):
    os.environ.update({"DATABASE_URL": database_url, "SUPABASE_JWT_SECRET": JWT_SECRET, "ENVIRONMENT": "test",
                       "CORS_ORIGINS": "http://localhost:3000"})
    from fastapi.testclient import TestClient

    from app.config import get_settings
    get_settings.cache_clear()
    from app.main import create_app

    with TestClient(create_app()) as c:
        yield c


def make_token(user_id: uuid.UUID, email: str = "learner@example.com", **overrides) -> str:
    secret = overrides.pop("secret", JWT_SECRET)
    claims = {"sub": str(user_id), "email": email, "aud": "authenticated", "role": "authenticated",
              "exp": int(time.time()) + 3600, "iat": int(time.time())}
    claims.update(overrides)
    return jwt.encode(claims, secret, algorithm="HS256")


@pytest.fixture
def new_user(database_url):
    """Create an auth user (the signup trigger creates the profile) and return (id, auth headers)."""
    uid = uuid.uuid4()
    with psycopg.connect(database_url, autocommit=True) as conn:
        conn.execute("insert into auth.users (id, email, raw_user_meta_data) values (%s, %s, %s)",
                     (uid, f"{uid}@example.com", '{"display_name": "Test Learner"}'))
    return uid, {"Authorization": f"Bearer {make_token(uid)}"}
