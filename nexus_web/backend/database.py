import os
import threading
from pathlib import Path
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import ThreadedConnectionPool
from contextlib import contextmanager

load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    import urllib.parse
    parsed = urllib.parse.urlparse(DATABASE_URL)
    DB_CONFIG = {
        "host":     parsed.hostname,
        "port":     parsed.port or 5432,
        "database": parsed.path.lstrip("/"),
        "user":     parsed.username,
        "password": parsed.password,
    }
else:
    DB_CONFIG = {
        "host":     os.getenv("DB_HOST", "localhost"),
        "port":     int(os.getenv("DB_PORT", "5433")),
        "database": os.getenv("DB_NAME", "nexus_db"),
        "user":     os.getenv("DB_USER", "postgres"),
        "password": os.getenv("DB_PASSWORD", ""),
    }

# Thread-local storage for tenant database override
_tenant_local = threading.local()

# Pool de conexiones por base de datos: evita abrir/cerrar conexión en cada query
_pools: dict[str, ThreadedConnectionPool] = {}
_pools_lock = threading.Lock()

POOL_MIN = 2   # conexiones siempre abiertas
POOL_MAX = 10  # máximo simultáneo (VPS 1GB: no subir mucho)


def _get_pool(db_name: str) -> ThreadedConnectionPool:
    if db_name not in _pools:
        with _pools_lock:
            if db_name not in _pools:
                config = dict(DB_CONFIG)
                config["database"] = db_name
                _pools[db_name] = ThreadedConnectionPool(
                    POOL_MIN, POOL_MAX,
                    cursor_factory=RealDictCursor,
                    **config
                )
    return _pools[db_name]


def set_tenant_db(db_name):
    _tenant_local.db_name = db_name


def clear_tenant_db():
    _tenant_local.db_name = None


def get_current_db():
    return getattr(_tenant_local, 'db_name', None) or DB_CONFIG["database"]


def get_connection():
    """Obtiene conexión del pool (no usar directamente — usar db())."""
    db_name = get_current_db()
    pool = _get_pool(db_name)
    conn = pool.getconn()
    # Asegura que las conexiones recicladas del pool estén en estado limpio
    if conn.closed:
        pool.putconn(conn, close=True)
        conn = pool.getconn()
    conn.cursor_factory = RealDictCursor
    return conn, pool


@contextmanager
def db():
    conn, pool = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)  # devuelve al pool, no cierra


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
