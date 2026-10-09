"""Verify Supabase access tokens sent by the frontend as ``Authorization: Bearer <jwt>``."""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import Settings, get_settings

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    id: UUID
    email: str | None


@lru_cache(maxsize=4)
def _jwks_client(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(url, cache_keys=True, lifespan=600)


def decode_token(token: str, settings: Settings) -> dict:
    options = {"require": ["exp", "sub", "aud"]}
    if settings.supabase_jwt_secret:
        return jwt.decode(token, settings.supabase_jwt_secret, algorithms=["HS256"],
                          audience=settings.supabase_jwt_audience, options=options)
    signing_key = _jwks_client(settings.jwks_url).get_signing_key_from_jwt(token)
    return jwt.decode(token, signing_key.key, algorithms=["ES256", "RS256", "EdDSA"],
                      audience=settings.supabase_jwt_audience, options=options)


def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    settings: Settings = Depends(get_settings),
) -> CurrentUser:
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or missing access token",
                                 headers={"WWW-Authenticate": "Bearer"})
    if creds is None or creds.scheme.lower() != "bearer":
        raise unauthorized
    try:
        claims = decode_token(creds.credentials, settings)
        user_id = UUID(claims["sub"])
    except (jwt.PyJWTError, ValueError, KeyError):
        raise unauthorized from None
    if claims.get("role") not in (None, "authenticated"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Token role is not allowed")
    return CurrentUser(id=user_id, email=claims.get("email"))
