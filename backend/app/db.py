"""PostgreSQL connection pool (psycopg 3).

Endpoints are plain ``def`` functions, so FastAPI runs them in a threadpool and the
blocking driver never stalls the event loop.
"""
from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from psycopg import Connection
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from .config import get_settings

_pool: ConnectionPool | None = None


def open_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        s = get_settings()
        _pool = ConnectionPool(
            s.database_url,
            min_size=s.db_pool_min,
            max_size=s.db_pool_max,
            # prepare_threshold=None keeps us compatible with Supabase's transaction-mode pooler.
            kwargs={"row_factory": dict_row, "prepare_threshold": None, "autocommit": False},
            open=True,
            timeout=10,
        )
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


@contextmanager
def transaction() -> Iterator[Connection]:
    """Yield a connection inside a transaction: commit on success, roll back on error."""
    with open_pool().connection() as conn:
        with conn.transaction():
            yield conn


def get_conn() -> Iterator[Connection]:
    """FastAPI dependency: one transaction per request."""
    with transaction() as conn:
        yield conn
