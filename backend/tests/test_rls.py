"""Row-level security checks, executed as Supabase's `authenticated` and `anon` roles."""
from __future__ import annotations

import uuid

import psycopg
import pytest


@pytest.fixture
def two_users(database_url):
    a, b = uuid.uuid4(), uuid.uuid4()
    with psycopg.connect(database_url, autocommit=True) as conn:
        for u in (a, b):
            conn.execute("insert into auth.users (id, email) values (%s, %s)", (u, f"{u}@example.com"))
        conn.execute("insert into public.assessments (user_id, topic_id, question_ids) values (%s, 'sql-fundamentals', '{sql-e1}')", (b,))
        conn.execute("insert into public.resource_progress (user_id, resource_id) values (%s, 'r-sql-bolt')", (b,))
    return a, b


def as_role(database_url, role: str, user: uuid.UUID | None = None):
    conn = psycopg.connect(database_url)
    conn.execute(f"set role {role}")
    if user:
        conn.execute("select set_config('request.jwt.claim.sub', %s, false)", (str(user),))
    return conn


def scalar(conn, sql, *params):
    return conn.execute(sql, params).fetchone()[0]


def test_learner_sees_only_own_rows(database_url, two_users):
    a, b = two_users
    with as_role(database_url, "authenticated", a) as conn:
        assert scalar(conn, "select count(*) from public.profiles") == 1
        assert scalar(conn, "select count(*) from public.assessments") == 0
        assert scalar(conn, "select count(*) from public.resource_progress") == 0
        assert scalar(conn, "select count(*) from public.resources") > 100


def test_answer_keys_are_not_readable_by_clients(database_url, two_users):
    a, _ = two_users
    for role, user in (("authenticated", a), ("anon", None)):
        with as_role(database_url, role, user) as conn:
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                conn.execute("select correct_index from public.questions limit 1")
            conn.rollback()


def test_clients_cannot_write_scores_or_catalog(database_url, two_users):
    a, _ = two_users
    statements = [
        ("insert into public.assessments (user_id, topic_id, question_ids) values (%s, 'sql-fundamentals', '{sql-e1}')", (a,)),
        ("insert into public.topic_mastery (user_id, topic_id, level, mastery_score, confidence, probabilities, accuracy, "
         "assessment_id, model_version) values (%s, 'sql-fundamentals', 'advanced', 1, 1, '{}', 1, gen_random_uuid(), 'x')", (a,)),
        ("update public.topics set name = 'hacked'", ()),
        ("delete from public.resources", ()),
    ]
    for sql, params in statements:
        with as_role(database_url, "authenticated", a) as conn:
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                conn.execute(sql, params)
            conn.rollback()


def test_progress_writes_limited_to_owner(database_url, two_users):
    a, b = two_users
    with as_role(database_url, "authenticated", a) as conn:
        conn.execute("insert into public.resource_progress (user_id, resource_id) values (%s, 'r-sql-bolt')", (a,))
        with pytest.raises(psycopg.errors.InsufficientPrivilege):  # RLS WITH CHECK violation
            conn.execute("insert into public.resource_progress (user_id, resource_id) values (%s, 'r-py-tutorial')", (b,))
        conn.rollback()
    with as_role(database_url, "authenticated", a) as conn:
        assert conn.execute("update public.profiles set weekly_hours = 20 where id = %s", (b,)).rowcount == 0
        assert conn.execute("delete from public.resource_progress where user_id = %s", (b,)).rowcount == 0


def test_anon_has_catalog_only(database_url, two_users):
    with as_role(database_url, "anon") as conn:
        assert scalar(conn, "select count(*) from public.topics") == 26
        for table in ("profiles", "assessments", "topic_mastery", "resource_progress"):
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                conn.execute(f"select 1 from public.{table}")
            conn.rollback()
            conn.execute("set role anon")
