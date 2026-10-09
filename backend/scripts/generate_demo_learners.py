"""Generate DEMO learner accounts with weeks of realistic history, for showcasing the app.

How it stays honest
  * Only the learners' *answers* are simulated (same IRT-style answer model as ml/data_generation.py,
    with per-persona knowledge that grows as they complete resources).
  * Everything else goes through the real FastAPI app: item selection, scoring, the proficiency
    model, mastery updates, roadmap changes, recommendations and adaptation events.
  * Accounts use @example.com addresses (a domain reserved for examples) and are documented as demo
    data in the README.

The simulation runs against a LOCAL database (scripts/reset_local_db.sh), then timestamps are
shifted onto a realistic multi-week timeline and exported as SQL for the hosted project.

    DATABASE_URL=postgresql://postgres@/pathforge?host=/tmp&port=54329 \
      python -m scripts.generate_demo_learners --out /path/demo_learners.sql --password '...'
"""
from __future__ import annotations

import argparse
import bisect
import json
import math
import os
import random
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

import jwt
import psycopg
from psycopg.rows import dict_row

SECRET = "demo-generator-secret-at-least-32-characters"
os.environ.setdefault("SUPABASE_JWT_SECRET", SECRET)
os.environ["SUPABASE_JWT_SECRET"] = SECRET
os.environ.setdefault("ENVIRONMENT", "test")

from fastapi.testclient import TestClient

from app.config import get_settings
from ml.catalog import EXPECTED_SECONDS, load_catalog
from ml.data_generation import GUESS_RATE, SLIP_RATE, item_params

IST = timezone(timedelta(hours=5, minutes=30))
NAMESPACE = uuid.UUID("6f1c2a9e-3b8d-4c5e-9a1f-2d7e8b4c6a10")


@dataclass
class Persona:
    key: str
    name: str
    email: str
    weeks: int
    career: str
    weekly_hours: int
    formats: list[str]
    goal: str
    seed: int
    theta: dict[str, float]
    default_theta: float = -0.6
    speed: float = 0.0               # log-time offset; negative = faster reader
    overconfidence: float = 0.0
    career_history: list[tuple[int, str]] = field(default_factory=list)  # (week, career) switches
    hours_change: tuple[int, int] | None = None                          # (week, new hours)
    rapid_attempt: tuple[int, str] | None = None                         # (week, topic) — a not-counted attempt
    explore: list[tuple[int, str]] = field(default_factory=list)         # (week, topic) extra diagnostics
    keep_remaining: int = 0  # once this few roadmap topics remain, keep studying them but don't retake (in progress)
    extra_topics: list[str] = field(default_factory=list)  # explored once the path is nearly done

    @property
    def user_id(self) -> uuid.UUID:
        return uuid.uuid5(NAMESPACE, self.email)


PERSONAS = [
    Persona(
        key="priya", name="Priya Sharma", email="priya.sharma@example.com", weeks=13, career="data-analyst",
        weekly_hours=6, formats=["interactive", "video"], seed=11,
        goal="Move from Excel reporting to answering product questions with SQL and Python.",
        theta={"git-version-control": 1.3, "python-fundamentals": -0.1, "sql-fundamentals": 0.35,
               "statistics-foundations": 0.1, "probability": -0.6, "pandas-wrangling": -0.9,
               "data-visualization": -0.5, "exploratory-analysis": -1.1, "advanced-sql": -0.9},
        speed=-0.05, overconfidence=0.2, rapid_attempt=(6, "probability"),
        explore=[(0, "git-version-control")], keep_remaining=2,
        extra_topics=["database-design", "software-testing", "data-structures-algorithms"],
    ),
    Persona(
        key="arjun", name="Arjun Mehta", email="arjun.mehta@example.com", weeks=10, career="ml-engineer",
        weekly_hours=10, formats=["course", "documentation"], seed=23,
        goal="Deploy and monitor the models I build at work instead of handing over notebooks.",
        theta={"python-fundamentals": 1.4, "git-version-control": 1.1, "sql-fundamentals": 0.9,
               "data-structures-algorithms": 0.3, "software-testing": 0.1, "statistics-foundations": 0.6,
               "probability": 0.3, "linear-algebra": 0.2, "pandas-wrangling": 1.0, "data-visualization": 0.4,
               "exploratory-analysis": 0.1, "ml-foundations": -0.5, "model-evaluation": -0.9,
               "feature-engineering": -0.9, "deep-learning": -1.3, "docker-containers": -0.2, "mlops": -1.6},
        speed=-0.15, overconfidence=-0.1, hours_change=(4, 12),
        explore=[(0, "git-version-control"), (0, "sql-fundamentals")],
    ),
    Persona(
        key="sara", name="Sara Thomas", email="sara.thomas@example.com", weeks=7, career="backend-developer",
        weekly_hours=8, formats=["article", "interactive"], seed=37,
        goal="Build accessible React interfaces and get my first frontend role.",
        theta={"html-css": 0.9, "javascript": 0.15, "typescript": -0.8, "react": -1.1, "http-rest-apis": 0.4,
               "git-version-control": 0.6, "software-testing": -0.6, "python-fundamentals": -0.2},
        speed=0.05, overconfidence=0.1, career_history=[(1, "frontend-developer")],
    ),
]


class Clock:
    """Maps real wall-clock moments of API calls onto a virtual multi-week timeline."""

    def __init__(self, conn: psycopg.Connection):
        self.conn = conn
        self.real: list[datetime] = []
        self.virtual: list[datetime] = []

    def mark(self, virtual: datetime) -> None:
        real = self.conn.execute("select clock_timestamp() as t").fetchone()["t"]
        if self.virtual and virtual <= self.virtual[-1]:
            virtual = self.virtual[-1] + timedelta(minutes=3)
        self.real.append(real)
        self.virtual.append(virtual)

    def shift(self, t: datetime | None) -> datetime | None:
        if t is None:
            return None
        i = bisect.bisect_right(self.real, t) - 1
        if i < 0:
            return self.virtual[0] - (self.real[0] - t)
        return self.virtual[i] + (t - self.real[i])


def evening(start: datetime, week: int, day: int, hour: float) -> datetime:
    """A moment on a given week/day at an IST evening hour."""
    d = (start + timedelta(weeks=week, days=day)).astimezone(IST)
    h = int(hour)
    m = int((hour - h) * 60)
    return d.replace(hour=h, minute=m, second=random.randint(0, 59), microsecond=0).astimezone(timezone.utc)


def run_persona(client: TestClient, conn: psycopg.Connection, p: Persona, clock: Clock, start: datetime) -> None:
    rng = random.Random(p.seed)
    random.seed(p.seed)
    c = load_catalog()
    params = item_params(c)
    theta = dict(p.theta)
    th = lambda t: theta.get(t, p.default_theta)
    now = int(datetime.now(timezone.utc).timestamp())
    token = jwt.encode({"sub": str(p.user_id), "email": p.email, "aud": "authenticated", "role": "authenticated",
                        "iat": now, "exp": now + 7200}, SECRET, algorithm="HS256")
    h = {"Authorization": f"Bearer {token}"}

    def call(method: str, url: str, **kw):
        r = client.request(method, url, headers=h, **kw)
        if r.status_code >= 400:
            raise RuntimeError(f"{p.key}: {method} {url} -> {r.status_code} {r.text}")
        return r.json() if r.content else None

    assessed: set[str] = set()

    def assess(topic: str, when: datetime, rapid: bool = False) -> dict:
        assessed.add(topic)
        clock.mark(when)
        a = call("POST", "/api/assessments", json={"topic_id": topic})
        responses = []
        for q in a["questions"]:
            qp = params[q["id"]]
            question = c.questions[q["id"]]
            if rapid:
                correct = rng.random() < GUESS_RATE
                conf, ms = rng.choice([1, 1, 2]), rng.randint(900, 2400)
            else:
                knows = rng.random() < 1 / (1 + math.exp(-1.7 * qp.a * (th(topic) - qp.b)))
                correct = (rng.random() > SLIP_RATE) if knows else (rng.random() < GUESS_RATE)
                u = rng.random()
                if knows:
                    # Confidence grows with competence: strong learners mark known items "sure" more often.
                    p_sure = min(0.92, 0.62 + 0.12 * max(th(topic), 0) + 0.1 * p.overconfidence)
                    conf = 3 if u < p_sure else (2 if u < 0.97 else 1)
                else:
                    conf = 1 if u < 0.5 - 0.15 * p.overconfidence else (3 if u < 0.62 else 2)
                secs = EXPECTED_SECONDS[question.difficulty] * math.exp(p.speed + 0.1 * (qp.b - th(topic))
                                                                         - 0.1 * knows + rng.gauss(0, 0.35))
                ms = int(min(max(secs, 6.0), 240.0) * 1000)
            pick = question.correct_index if correct else rng.choice([i for i in range(4) if i != question.correct_index])
            responses.append({"question_id": q["id"], "selected_index": pick, "confidence": conf, "time_ms": ms})
        clock.mark(when + timedelta(seconds=sum(r["time_ms"] for r in responses) / 1000 + 20))
        return call("POST", f"/api/assessments/{a['assessment']['id']}/submit", json={"responses": responses})

    def study(topic: str, week: int, days: list[int], save_extra: bool) -> None:
        recs = call("GET", f"/api/me/recommendations?topic={topic}&limit=4")["items"]
        for i, day in enumerate(days[: len(recs)]):
            rid = recs[i]["resource_id"]
            clock.mark(evening(start, week, day, 19.5 + rng.random()))
            call("PUT", f"/api/me/resources/{rid}/progress", json={"status": "in_progress"})
            clock.mark(evening(start, week, day + 1, 20.5 + rng.random()))
            call("PUT", f"/api/me/resources/{rid}/progress", json={"status": "completed", "rating": rng.choice([4, 4, 5, 5, 3])})
            theta[topic] = th(topic) + rng.uniform(0.6, 0.9)
        if not recs:  # every resource for this topic is done: the learner keeps practising
            theta[topic] = th(topic) + rng.uniform(0.5, 0.8)
        if save_extra and len(recs) > len(days):
            clock.mark(evening(start, week, days[-1], 22.0))
            call("PUT", f"/api/me/resources/{recs[-1]['resource_id']}/progress", json={"status": "saved"})

    # --- week 0: sign-up and onboarding ------------------------------------------------------------
    clock.mark(evening(start, 0, 0, 19.0))
    conn.execute("insert into auth.users (id, email, raw_user_meta_data) values (%s, %s, %s) on conflict do nothing",
                 (p.user_id, p.email, json.dumps({"display_name": p.name})))
    conn.commit()
    clock.mark(evening(start, 0, 0, 19.1))
    call("PUT", "/api/me/profile", json={"target_career_id": p.career, "weekly_hours": p.weekly_hours,
                                         "preferred_formats": p.formats, "learning_goal": p.goal})

    for week in range(p.weeks):
        for wk, career in p.career_history:
            if wk == week:
                clock.mark(evening(start, week, 0, 18.8))
                call("PUT", "/api/me/profile", json={"target_career_id": career})
        if p.hours_change and p.hours_change[0] == week:
            clock.mark(evening(start, week, 0, 18.9))
            call("PUT", "/api/me/profile", json={"weekly_hours": p.hours_change[1]})
        for wk, topic in p.explore:
            if wk == week:
                assess(topic, evening(start, week, 0, 19.3 + rng.random() / 2))

        steps = [s for s in call("GET", "/api/me/roadmap")["steps"] if s["status"] in ("ready", "in_progress")]
        if not steps:
            break
        nearly_done = len(steps) <= p.keep_remaining
        focus = steps[week % len(steps)]["topic_id"] if nearly_done else steps[0]["topic_id"]
        if next(s for s in steps if s["topic_id"] == focus)["mastery_score"] is None:
            assess(focus, evening(start, week, 0, 20.0 + rng.random()))
        if p.rapid_attempt and p.rapid_attempt[0] == week:
            assess(p.rapid_attempt[1], evening(start, week, 2, 22.6), rapid=True)
        study(focus, week, [1, 3] if rng.random() < 0.75 else [2], save_extra=rng.random() < 0.4)
        if nearly_done and p.extra_topics:  # exploring beyond the career path
            extra = p.extra_topics[week % len(p.extra_topics)]
            if extra not in assessed:
                assess(extra, evening(start, week, 3, 21.0 + rng.random()))
            study(extra, week, [4], save_extra=False)
        if nearly_done or len(call("GET", "/api/me/roadmap")["steps"]) <= p.keep_remaining:
            continue  # nearly done: still studying, next retake hasn't happened yet
        result = assess(focus, evening(start, week, 5, 20.0 + rng.random()))
        # A strong week: also try the next unlocked topic right away.
        unlocked = (result.get("adaptation") or {}).get("changes", {}).get("unlocked") or []
        if unlocked and week < p.weeks - 1 and rng.random() < 0.6:
            assess(unlocked[0]["id"], evening(start, week, 6, 19.5 + rng.random()))


TABLES = {
    "assessments": ("id", ["started_at", "submitted_at", "created_at", "updated_at"]),
    "assessment_responses": ("id", ["created_at"]),
    "topic_mastery": (None, ["updated_at"]),
    "resource_progress": (None, ["completed_at", "created_at", "updated_at"]),
    "adaptation_events": ("id", ["created_at"]),
}


def export(conn: psycopg.Connection, personas: list[Persona], clocks: dict[str, Clock], password: str) -> str:
    out = ["-- PathForge DEMO learners (simulated answers; all scores computed by the real app). Generated by",
           "-- backend/scripts/generate_demo_learners.py. Safe to re-run: existing demo rows are replaced.", ""]
    ids = [str(p.user_id) for p in personas]
    id_list = ", ".join(f"'{i}'" for i in ids)
    out.append(f"delete from auth.users where id in ({id_list});  -- cascades to all learner tables")

    for p in personas:
        clock = clocks[p.key]
        prof = conn.execute("select *, preferred_formats::text[] as formats from public.profiles where id = %s",
                            (p.user_id,)).fetchone()
        created = clock.shift(prof["created_at"])
        meta = json.dumps({"display_name": p.name, "demo_account": True}).replace("'", "''")
        out.append(
            "insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, "
            "raw_app_meta_data, raw_user_meta_data, created_at, updated_at, last_sign_in_at, confirmation_token, "
            "recovery_token, email_change_token_new, email_change) values ("
            f"'00000000-0000-0000-0000-000000000000', '{p.user_id}', 'authenticated', 'authenticated', '{p.email}', "
            f"extensions.crypt('{password}', extensions.gen_salt('bf')), '{created.isoformat()}', "
            "'{\"provider\":\"email\",\"providers\":[\"email\"]}', "
            f"'{meta}', '{created.isoformat()}', '{created.isoformat()}', '{clock.virtual[-1].isoformat()}', '', '', '', '');")
        out.append(
            "insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at) "
            f"values ('{p.user_id}', '{p.user_id}', "
            f"'{{\"sub\":\"{p.user_id}\",\"email\":\"{p.email}\",\"email_verified\":true}}', 'email', "
            f"'{clock.virtual[-1].isoformat()}', '{created.isoformat()}', '{created.isoformat()}');")
        upd = {k: prof[k] for k in ("display_name", "target_career_id", "weekly_hours", "learning_goal")}
        out.append(
            "update public.profiles set display_name = {dn}, target_career_id = {tc}, weekly_hours = {wh}, "
            "preferred_formats = {pf}::public.resource_format[], learning_goal = {lg}, onboarded_at = '{ob}', "
            "created_at = '{cr}' where id = '{uid}';".format(
                dn="'" + upd["display_name"].replace("'", "''") + "'", tc=f"'{upd['target_career_id']}'",
                wh=upd["weekly_hours"], pf="'{" + ",".join(prof["formats"]) + "}'",
                lg="'" + upd["learning_goal"].replace("'", "''") + "'",
                ob=clock.shift(prof["onboarded_at"]).isoformat(), cr=created.isoformat(), uid=p.user_id))

    for table, (_, cols) in TABLES.items():
        rows = []
        for p in personas:
            clock = clocks[p.key]
            if table == "assessment_responses":
                q = ("select r.* from public.assessment_responses r join public.assessments a on a.id = r.assessment_id "
                     "where a.user_id = %s")
            else:
                q = f"select * from public.{table} where user_id = %s"
            for r in conn.execute(q, (p.user_id,)).fetchall():
                for col in cols:
                    r[col] = clock.shift(r[col])
                rows.append(r)
        if table == "assessments":  # start time = submit time minus the time actually spent answering
            spent = {}
            for p in personas:
                for s in conn.execute("select assessment_id, sum(time_ms) ms from public.assessment_responses r join "
                                      "public.assessments a on a.id = r.assessment_id where a.user_id = %s group by 1",
                                      (p.user_id,)).fetchall():
                    spent[s["assessment_id"]] = s["ms"]
            for r in rows:
                if r["submitted_at"]:
                    r["started_at"] = r["submitted_at"] - timedelta(milliseconds=int(spent.get(r["id"], 0)) + 20000)
                    r["created_at"] = r["started_at"]
                    r["updated_at"] = r["submitted_at"]
        payload = json.dumps(rows, default=lambda o: o.isoformat() if isinstance(o, datetime) else str(o)).replace("'", "''")
        out.append(f"insert into public.{table} select * from jsonb_populate_recordset(null::public.{table}, '{payload}'::jsonb);")
    return "\n".join(out) + "\n"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--password", required=True)
    ap.add_argument("--end", default=None, help="ISO date the timeline ends (default: yesterday)")
    args = ap.parse_args()

    get_settings.cache_clear()
    from app.main import create_app

    end = datetime.fromisoformat(args.end).replace(tzinfo=timezone.utc) if args.end else \
        datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=1)
    conn = psycopg.connect(os.environ["DATABASE_URL"], row_factory=dict_row)
    clocks = {}
    with TestClient(create_app()) as client:
        for p in PERSONAS:
            clock = Clock(conn)
            start = end - timedelta(weeks=p.weeks)
            run_persona(client, conn, p, clock, start)
            clocks[p.key] = clock
            n = conn.execute("select count(*) n from public.assessments where user_id = %s", (p.user_id,)).fetchone()["n"]
            print(f"{p.name}: {n} assessments, timeline {start.date()} → {clock.virtual[-1].date()}")
    sql = export(conn, PERSONAS, clocks, args.password)
    with open(args.out, "w") as fh:
        fh.write(sql)
    print(f"Wrote {args.out} ({len(sql) // 1024} KB)")


if __name__ == "__main__":
    main()
