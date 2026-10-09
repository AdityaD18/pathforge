"""SQL for learner data. All functions take an open connection (inside a transaction)."""
from __future__ import annotations

from typing import Any
from uuid import UUID

from psycopg import Connection
from psycopg.types.json import Jsonb

PROFILE_COLUMNS = ("display_name", "target_career_id", "weekly_hours", "preferred_formats",
                   "preferred_level", "learning_goal", "theme", "theme_accent")


# --- profiles ------------------------------------------------------------------------------------
def ensure_profile(conn: Connection, user_id: UUID) -> dict:
    """Return the profile, creating it if the signup trigger hasn't (e.g. users predating the migration)."""
    conn.execute("insert into public.profiles (id) values (%s) on conflict (id) do nothing", (user_id,))
    return get_profile(conn, user_id)


def get_profile(conn: Connection, user_id: UUID) -> dict:
    row = conn.execute(
        "select id, display_name, target_career_id, weekly_hours, preferred_formats::text[] as preferred_formats, "
        "preferred_level::text as preferred_level, learning_goal, theme, theme_accent, onboarded_at, created_at, updated_at "
        "from public.profiles where id = %s", (user_id,)).fetchone()
    return row


def update_profile(conn: Connection, user_id: UUID, changes: dict[str, Any]) -> dict:
    sets, params = [], []
    for col in PROFILE_COLUMNS:
        if col in changes:
            cast = {"preferred_formats": "::public.resource_format[]", "preferred_level": "::public.resource_level"}.get(col, "")
            sets.append(f"{col} = %s{cast}")
            params.append(changes[col])
    if "target_career_id" in changes and changes["target_career_id"]:
        sets.append("onboarded_at = coalesce(onboarded_at, now())")
    if sets:
        conn.execute(f"update public.profiles set {', '.join(sets)} where id = %s", (*params, user_id))
    return get_profile(conn, user_id)


# --- mastery -------------------------------------------------------------------------------------
def mastery_rows(conn: Connection, user_id: UUID) -> dict[str, dict]:
    rows = conn.execute(
        "select topic_id, level::text as level, mastery_score::float as mastery_score, confidence::float as confidence, "
        "probabilities, accuracy::float as accuracy, assessment_id, model_version, updated_at "
        "from public.topic_mastery where user_id = %s", (user_id,)).fetchall()
    return {r["topic_id"]: r for r in rows}


def upsert_mastery(conn: Connection, user_id: UUID, topic_id: str, est, accuracy: float, assessment_id: UUID) -> None:
    conn.execute(
        """insert into public.topic_mastery
             (user_id, topic_id, level, mastery_score, confidence, probabilities, accuracy, assessment_id, model_version)
           values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
           on conflict (user_id, topic_id) do update set
             level = excluded.level, mastery_score = excluded.mastery_score, confidence = excluded.confidence,
             probabilities = excluded.probabilities, accuracy = excluded.accuracy,
             assessment_id = excluded.assessment_id, model_version = excluded.model_version""",
        (user_id, topic_id, est.level, est.mastery_score, est.confidence, Jsonb(est.probabilities), accuracy,
         assessment_id, est.model_version))


# --- assessments ---------------------------------------------------------------------------------
ASSESSMENT_COLUMNS = (
    "id, user_id, topic_id, status::text as status, question_ids, predicted_level::text as predicted_level, "
    "mastery_score::float as mastery_score, probabilities, features, accuracy::float as accuracy, model_version, "
    "counted, excluded_reason, started_at, submitted_at")


def open_assessment(conn: Connection, user_id: UUID, topic_id: str) -> dict | None:
    return conn.execute(f"select {ASSESSMENT_COLUMNS} from public.assessments where user_id = %s and topic_id = %s "
                        "and status = 'in_progress' order by started_at desc limit 1", (user_id, topic_id)).fetchone()


def seen_question_ids(conn: Connection, user_id: UUID, topic_id: str) -> list[str]:
    rows = conn.execute("select distinct unnest(question_ids) as qid from public.assessments "  # includes uncounted attempts
                        "where user_id = %s and topic_id = %s and status = 'submitted'", (user_id, topic_id)).fetchall()
    return [r["qid"] for r in rows]


def create_assessment(conn: Connection, user_id: UUID, topic_id: str, question_ids: list[str]) -> dict:
    return conn.execute(f"insert into public.assessments (user_id, topic_id, question_ids) values (%s, %s, %s) "
                        f"returning {ASSESSMENT_COLUMNS}", (user_id, topic_id, question_ids)).fetchone()


def get_assessment(conn: Connection, user_id: UUID, assessment_id: UUID, lock: bool = False) -> dict | None:
    suffix = " for update" if lock else ""
    return conn.execute(f"select {ASSESSMENT_COLUMNS} from public.assessments where id = %s and user_id = %s{suffix}",
                        (assessment_id, user_id)).fetchone()


def complete_assessment(conn: Connection, assessment_id: UUID, est, accuracy: float, counted: bool = True,
                        excluded_reason: str | None = None) -> dict:
    return conn.execute(
        f"""update public.assessments set status = 'submitted', submitted_at = now(), predicted_level = %s,
              mastery_score = %s, probabilities = %s, features = %s, accuracy = %s, model_version = %s,
              counted = %s, excluded_reason = %s
            where id = %s returning {ASSESSMENT_COLUMNS}""",
        (est.level, est.mastery_score, Jsonb(est.probabilities), Jsonb(est.features), accuracy, est.model_version,
         counted, excluded_reason, assessment_id)).fetchone()


def insert_responses(conn: Connection, assessment_id: UUID, rows: list[dict]) -> None:
    with conn.cursor() as cur:
        cur.executemany(
            "insert into public.assessment_responses (assessment_id, question_id, selected_index, is_correct, confidence, time_ms) "
            "values (%s, %s, %s, %s, %s, %s)",
            [(assessment_id, r["question_id"], r["selected_index"], r["is_correct"], r["confidence"], r["time_ms"]) for r in rows])


def responses_for(conn: Connection, assessment_id: UUID) -> list[dict]:
    return conn.execute("select question_id, selected_index, is_correct, confidence, time_ms from public.assessment_responses "
                        "where assessment_id = %s", (assessment_id,)).fetchall()


def list_assessments(conn: Connection, user_id: UUID, topic_id: str | None, limit: int) -> list[dict]:
    where, params = "user_id = %s", [user_id]
    if topic_id:
        where += " and topic_id = %s"
        params.append(topic_id)
    return conn.execute(f"select {ASSESSMENT_COLUMNS} from public.assessments where {where} "
                        "order by started_at desc limit %s", (*params, limit)).fetchall()


# --- resource progress -----------------------------------------------------------------------------
def progress_rows(conn: Connection, user_id: UUID) -> dict[str, dict]:
    rows = conn.execute("select resource_id, status::text as status, rating, completed_at, updated_at "
                        "from public.resource_progress where user_id = %s", (user_id,)).fetchall()
    return {r["resource_id"]: r for r in rows}


def upsert_progress(conn: Connection, user_id: UUID, resource_id: str, status: str, rating: int | None) -> dict:
    return conn.execute(
        """insert into public.resource_progress (user_id, resource_id, status, rating, completed_at)
           values (%s, %s, %s, %s, case when %s = 'completed' then now() end)
           on conflict (user_id, resource_id) do update set status = excluded.status,
             rating = coalesce(excluded.rating, public.resource_progress.rating),
             completed_at = case when excluded.status = 'completed'
                                 then coalesce(public.resource_progress.completed_at, now()) end
           returning resource_id, status::text as status, rating, completed_at, updated_at""",
        (user_id, resource_id, status, rating, status)).fetchone()


def delete_progress(conn: Connection, user_id: UUID, resource_id: str) -> bool:
    return conn.execute("delete from public.resource_progress where user_id = %s and resource_id = %s",
                        (user_id, resource_id)).rowcount > 0


# --- adaptation events -------------------------------------------------------------------------------
def insert_event(conn: Connection, user_id: UUID, trigger: str, summary: str, changes: dict,
                 assessment_id: UUID | None = None) -> dict:
    return conn.execute(
        "insert into public.adaptation_events (user_id, trigger, assessment_id, summary, changes) values (%s, %s, %s, %s, %s) "
        "returning id, trigger, assessment_id, summary, changes, created_at",
        (user_id, trigger, assessment_id, summary, Jsonb(changes))).fetchone()


def list_events(conn: Connection, user_id: UUID, limit: int) -> list[dict]:
    return conn.execute("select id, trigger, assessment_id, summary, changes, created_at from public.adaptation_events "
                        "where user_id = %s order by created_at desc limit %s", (user_id, limit)).fetchall()


# --- analytics ------------------------------------------------------------------------------------
def submitted_history(conn: Connection, user_id: UUID) -> list[dict]:
    return conn.execute(
        "select id, topic_id, predicted_level::text as level, mastery_score::float as mastery_score, accuracy::float as accuracy, "
        "submitted_at from public.assessments where user_id = %s and status = 'submitted' and counted order by submitted_at",
        (user_id,)).fetchall()


def response_stats(conn: Connection, user_id: UUID) -> list[dict]:
    return conn.execute(
        """select a.topic_id, q.difficulty::text as difficulty, r.confidence, r.is_correct, r.time_ms
           from public.assessment_responses r
           join public.assessments a on a.id = r.assessment_id
           join public.questions q on q.id = r.question_id
           where a.user_id = %s and a.counted""", (user_id,)).fetchall()


# --- catalog consistency ------------------------------------------------------------------------------
def catalog_ids(conn: Connection) -> dict[str, set[str]]:
    return {
        "topics": {r["id"] for r in conn.execute("select id from public.topics").fetchall()},
        "resources": {r["id"] for r in conn.execute("select id from public.resources").fetchall()},
        "questions": {r["id"] for r in conn.execute("select id from public.questions").fetchall()},
    }
