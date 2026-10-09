"""LOCAL TEST HARNESS ONLY — a minimal stand-in for Supabase Auth (GoTrue).

Use it to click through the full app on a machine where `supabase start` (Docker)
isn't available. It implements only what supabase-js calls in PathForge:
sign-up, password sign-in, refresh, get-user and sign-out. Users are written to
the local database's ``auth.users`` (from tests/sql/supabase_auth_stub.sql), so the
real profile trigger runs. Passwords are kept in memory only.

    DATABASE_URL=postgresql://... SUPABASE_JWT_SECRET=... \
      uvicorn scripts.local_auth_mock:app --port 54321

Then point the frontend at it: NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
It refuses to start against anything but a local database.
"""
from __future__ import annotations

import hashlib
import os
import secrets
import time
import uuid
from urllib.parse import urlparse

import jwt
import psycopg
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from psycopg.conninfo import conninfo_to_dict

DATABASE_URL = os.environ["DATABASE_URL"]
SECRET = os.environ["SUPABASE_JWT_SECRET"]
_host = conninfo_to_dict(DATABASE_URL).get("host") or urlparse(DATABASE_URL).hostname or ""
if _host not in ("", "localhost", "127.0.0.1", "::1") and not _host.startswith("/"):
    raise SystemExit("local_auth_mock only runs against a local database")

app = FastAPI(title="Local Supabase Auth stand-in (test only)")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

_passwords: dict[str, str] = {}          # email -> salted hash
_users: dict[str, dict] = {}             # id -> user object
_refresh: dict[str, str] = {}            # refresh token -> user id


def _hash(pw: str, salt: str) -> str:
    return salt + ":" + hashlib.sha256((salt + pw).encode()).hexdigest()


def _session(user: dict) -> dict:
    now = int(time.time())
    token = jwt.encode({"sub": user["id"], "email": user["email"], "aud": "authenticated", "role": "authenticated",
                        "iat": now, "exp": now + 3600, "session_id": str(uuid.uuid4())}, SECRET, algorithm="HS256")
    refresh = secrets.token_urlsafe(24)
    _refresh[refresh] = user["id"]
    return {"access_token": token, "token_type": "bearer", "expires_in": 3600, "expires_at": now + 3600,
            "refresh_token": refresh, "user": user}


def _user_from_bearer(request: Request) -> dict:
    auth = request.headers.get("authorization", "")
    try:
        claims = jwt.decode(auth.removeprefix("Bearer "), SECRET, algorithms=["HS256"], audience="authenticated")
        return _users[claims["sub"]]
    except Exception:
        raise HTTPException(401, {"msg": "invalid JWT"}) from None


def _error(status: int, code: str, msg: str):
    return JSONResponse({"code": status, "error_code": code, "msg": msg}, status_code=status)


@app.post("/auth/v1/signup")
async def signup(request: Request):
    body = await request.json()
    email, password = (body.get("email") or "").strip().lower(), body.get("password") or ""
    if not email or len(password) < 6:
        return _error(422, "weak_password", "Password should be at least 6 characters.")
    if email in _passwords:
        return _error(422, "user_already_exists", "User already registered")
    uid = str(uuid.uuid4())
    meta = body.get("data") or {}
    with psycopg.connect(DATABASE_URL, autocommit=True) as conn:
        conn.execute("insert into auth.users (id, email, raw_user_meta_data) values (%s, %s, %s)",
                     (uid, email, psycopg.types.json.Jsonb(meta)))
    user = {"id": uid, "aud": "authenticated", "role": "authenticated", "email": email, "user_metadata": meta,
            "app_metadata": {"provider": "email"}, "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    _users[uid] = user
    _passwords[email] = _hash(password, secrets.token_hex(8))
    return _session(user)


@app.post("/auth/v1/token")
async def token(request: Request, grant_type: str):
    body = await request.json()
    if grant_type == "password":
        email = (body.get("email") or "").strip().lower()
        stored = _passwords.get(email)
        if not stored or _hash(body.get("password") or "", stored.split(":")[0]) != stored:
            return _error(400, "invalid_credentials", "Invalid login credentials")
        user = next(u for u in _users.values() if u["email"] == email)
        return _session(user)
    if grant_type == "refresh_token":
        uid = _refresh.pop(body.get("refresh_token", ""), None)
        if not uid:
            return _error(400, "refresh_token_not_found", "Invalid Refresh Token")
        return _session(_users[uid])
    return _error(400, "unsupported_grant_type", "unsupported grant type")


@app.get("/auth/v1/user")
def get_user(request: Request):
    return _user_from_bearer(request)


@app.post("/auth/v1/logout")
def logout():
    return Response(status_code=204)


@app.get("/auth/v1/.well-known/jwks.json")
def jwks():
    return {"keys": []}  # HS256 tokens: supabase-js falls back to /user for verification
