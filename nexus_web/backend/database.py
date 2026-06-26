import os
import threading
from pathlib import Path
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager

load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

DB_CONFIG = {
    "host":     os.getenv("DB_HOST", "localhost"),
    "port":     int(os.getenv("DB_PORT", "5433")),
    "database": os.getenv("DB_NAME", "nexus_db"),
    "user":     os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", ""),
}

# Thread-local storage for tenant database override
_tenant_local = threading.local()


def set_tenant_db(db_name):
    """Set the current tenant database for this thread/request."""
    _tenant_local.db_name = db_name


def clear_tenant_db():
    """Clear tenant database override."""
    _tenant_local.db_name = None


def get_current_db():
    """Get the current database name (tenant or default)."""
    return getattr(_tenant_local, 'db_name', None) or DB_CONFIG["database"]


def get_connection():
    config = dict(DB_CONFIG)
    config["database"] = get_current_db()
    return psycopg2.connect(**config, cursor_factory=RealDictCursor)


@contextmanager
def db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def query(sql, params=None):
    with db() as conn:
        cur = conn.cursor()
        cur.execute(sql, params or ())
        return [dict(r) for r in cur.fetchall()]


def query_one(sql, params=None):
    with db() as conn:
        cur = conn.cursor()
        cur.execute(sql, params or ())
        r = cur.fetchone()
        return dict(r) if r else None


def execute(sql, params=None):
    with db() as conn:
        cur = conn.cursor()
        cur.execute(sql, params or ())


def insert(sql, params=None):
    with db() as conn:
        cur = conn.cursor()
        cur.execute(sql + " RETURNING id", params or ())
        return cur.fetchone()["id"]
