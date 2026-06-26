"""
Multi-tenant system for NEXUS POS SaaS.
Each company gets its own PostgreSQL database.
"""
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

MASTER_DB = os.getenv("DB_NAME", "nexus_db")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5433"))
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASS = os.getenv("DB_PASSWORD", "")
MULTI_TENANT = os.getenv("MULTI_TENANT", "false").lower() == "true"


def get_master_connection():
    return psycopg2.connect(
        host=DB_HOST, port=DB_PORT, database=MASTER_DB,
        user=DB_USER, password=DB_PASS, cursor_factory=RealDictCursor
    )


def get_tenant_connection(db_name):
    return psycopg2.connect(
        host=DB_HOST, port=DB_PORT, database=db_name,
        user=DB_USER, password=DB_PASS, cursor_factory=RealDictCursor
    )


def init_master_tables():
    """Create master tables if they don't exist."""
    if not MULTI_TENANT:
        return
    conn = get_master_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS mt_empresas (
                id SERIAL PRIMARY KEY,
                codigo VARCHAR(20) NOT NULL UNIQUE,
                nombre VARCHAR(300) NOT NULL,
                ruc VARCHAR(13),
                email VARCHAR(200),
                telefono VARCHAR(50),
                db_name VARCHAR(100) NOT NULL UNIQUE,
                plan VARCHAR(30) DEFAULT 'BASICO',
                max_usuarios INTEGER DEFAULT 5,
                activa BOOLEAN DEFAULT true,
                fecha_registro TIMESTAMP DEFAULT NOW(),
                fecha_vencimiento DATE,
                logo_url TEXT
            );
            CREATE TABLE IF NOT EXISTS mt_usuarios (
                id SERIAL PRIMARY KEY,
                empresa_id INTEGER REFERENCES mt_empresas(id),
                username VARCHAR(100) NOT NULL,
                nombre VARCHAR(200) NOT NULL,
                email VARCHAR(200),
                password_hash VARCHAR(200) NOT NULL,
                es_superadmin BOOLEAN DEFAULT false,
                activo BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(empresa_id, username)
            );
            CREATE TABLE IF NOT EXISTS mt_planes (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(50) NOT NULL UNIQUE,
                max_usuarios INTEGER DEFAULT 5,
                max_productos INTEGER DEFAULT 500,
                max_facturas_mes INTEGER DEFAULT 100,
                precio_mensual NUMERIC(8,2) DEFAULT 0,
                caracteristicas TEXT,
                activo BOOLEAN DEFAULT true
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS mt_pagos (
                id SERIAL PRIMARY KEY,
                empresa_id INTEGER REFERENCES mt_empresas(id),
                monto NUMERIC(12,2) NOT NULL,
                metodo VARCHAR(30) DEFAULT 'TRANSFERENCIA',
                referencia VARCHAR(200),
                meses_pagados INTEGER DEFAULT 1,
                periodo_inicio DATE,
                periodo_fin DATE,
                observaciones TEXT,
                fecha TIMESTAMP DEFAULT NOW()
            );
        """)
        # Insert default plans
        cur.execute("""
            INSERT INTO mt_planes (nombre, max_usuarios, max_productos, max_facturas_mes, precio_mensual)
            VALUES
                ('BASICO', 3, 500, 100, 15),
                ('PROFESIONAL', 10, 5000, 500, 35),
                ('EMPRESARIAL', 50, 99999, 99999, 75)
            ON CONFLICT DO NOTHING
        """)
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"Error init master: {e}")
    finally:
        conn.close()


def create_tenant_database(codigo, nombre, ruc='', email='',
                            admin_nombre='', admin_username='', admin_password='', admin_email=''):
    """Create a new company database by cloning the current one."""
    db_name = f"nexus_emp_{codigo.lower()}"

    # Register in master
    conn = get_master_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO mt_empresas (codigo, nombre, ruc, email, db_name)
            VALUES (%s, %s, %s, %s, %s) RETURNING id
        """, (codigo, nombre, ruc, email, db_name))
        empresa_id = cur.fetchone()["id"]
        conn.commit()
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        conn.close()
        raise Exception(f"Ya existe una empresa con codigo '{codigo}'")
    finally:
        if not conn.closed:
            conn.close()

    # Create the database as a copy of the template (current DB)
    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT, database="postgres",
        user=DB_USER, password=DB_PASS
    )
    conn.autocommit = True
    try:
        cur = conn.cursor()
        # Terminate connections to template DB to allow copy
        cur.execute("""
            SELECT pg_terminate_backend(pid) FROM pg_stat_activity
            WHERE datname=%s AND pid <> pg_backend_pid()
        """, (MASTER_DB,))
        cur.execute(f'CREATE DATABASE "{db_name}" TEMPLATE "{MASTER_DB}"')
    except Exception as e:
        # If copy fails, try creating empty DB
        try:
            cur.execute(f'CREATE DATABASE "{db_name}"')
        except Exception:
            pass
        conn.close()
        raise Exception(f"BD creada pero sin datos template: {e}")
    finally:
        if not conn.closed:
            conn.close()

    # Update company info in the new database
    tenant_conn = get_tenant_connection(db_name)
    try:
        tcur = tenant_conn.cursor()
        # Update empresa info if table exists
        try:
            tcur.execute("""
                UPDATE sys_empresas SET ruc=%s, razon_social=%s, email=%s WHERE activa=true
            """, (ruc, nombre, email))
        except Exception:
            tenant_conn.rollback()
        # Clean transactional data for fresh start
        cleanup_tables = [
            "ven_factura_detalles", "ven_facturas",
            "com_compras", "crm_oportunidades",
            "srv_ordenes", "nom_empleados",
        ]
        for table in cleanup_tables:
            try:
                tcur.execute(f"DELETE FROM {table}")
            except Exception:
                tenant_conn.rollback()
        # Setup admin user for this company
        try:
            from passlib.context import CryptContext
            pwd_ctx = CryptContext(schemes=["bcrypt"])
            a_username = admin_username.strip() if admin_username else 'admin'
            a_password = admin_password if admin_password else 'admin123'
            a_nombre = admin_nombre.strip() if admin_nombre else 'Administrador'
            a_email = admin_email.strip() if admin_email else email
            # Deactivate all existing users
            tcur.execute("UPDATE sys_usuarios SET activo=false")
            # Update first admin user with new credentials
            tcur.execute("""
                UPDATE sys_usuarios SET username=%s, password_hash=%s, nombre=%s,
                    email=%s, rol='admin', activo=true
                WHERE id=(SELECT MIN(id) FROM sys_usuarios)
            """, (a_username, pwd_ctx.hash(a_password), a_nombre, a_email))
        except Exception:
            tenant_conn.rollback()
        # Remove master tenant tables from the copy
        for mt_table in ["mt_empresas", "mt_usuarios", "mt_planes"]:
            try:
                tcur.execute(f"DROP TABLE IF EXISTS {mt_table} CASCADE")
            except Exception:
                tenant_conn.rollback()
        tenant_conn.commit()
    except Exception as e:
        tenant_conn.rollback()
        print(f"Warning setting up tenant: {e}")
    finally:
        tenant_conn.close()

    return {
        "empresa_id": empresa_id,
        "db_name": db_name,
        "msg": f"Empresa '{nombre}' creada con BD '{db_name}'"
    }


def get_empresa_db(empresa_id=None, codigo=None):
    """Get the database name for a company."""
    conn = get_master_connection()
    try:
        cur = conn.cursor()
        if empresa_id:
            cur.execute("SELECT db_name FROM mt_empresas WHERE id=%s AND activa=true", (empresa_id,))
        elif codigo:
            cur.execute("SELECT db_name FROM mt_empresas WHERE codigo=%s AND activa=true", (codigo,))
        else:
            return None
        row = cur.fetchone()
        return row["db_name"] if row else None
    finally:
        conn.close()


def list_empresas():
    """List all companies with details."""
    conn = get_master_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT e.*, p.nombre as plan_nombre, p.precio_mensual,
                   (SELECT COUNT(*) FROM mt_usuarios WHERE empresa_id=e.id AND activo=true) as usuarios_activos
            FROM mt_empresas e
            LEFT JOIN mt_planes p ON p.nombre=e.plan
            ORDER BY e.fecha_registro DESC
        """)
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def get_empresa_detail(empresa_id):
    """Get single company detail."""
    conn = get_master_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT e.*, p.nombre as plan_nombre, p.precio_mensual,
                   (SELECT COUNT(*) FROM mt_usuarios WHERE empresa_id=e.id AND activo=true) as usuarios_activos
            FROM mt_empresas e
            LEFT JOIN mt_planes p ON p.nombre=e.plan
            WHERE e.id=%s
        """, (empresa_id,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def toggle_empresa(empresa_id):
    """Toggle active status of a company."""
    conn = get_master_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE mt_empresas SET activa = NOT activa WHERE id=%s
            RETURNING id, codigo, nombre, activa
        """, (empresa_id,))
        row = cur.fetchone()
        conn.commit()
        return dict(row) if row else None
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def list_planes():
    """List all active plans."""
    conn = get_master_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM mt_planes WHERE activo=true ORDER BY precio_mensual")
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def superadmin_login(username, password):
    """Login for super admin users (stored in mt_usuarios with es_superadmin=true)."""
    from passlib.context import CryptContext
    pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

    conn = get_master_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT * FROM mt_usuarios
            WHERE username=%s AND es_superadmin=true AND activo=true AND empresa_id IS NULL
        """, (username,))
        user = cur.fetchone()
        if not user:
            return None
        if not pwd_ctx.verify(password, user["password_hash"]):
            return None
        return dict(user)
    finally:
        conn.close()


def ensure_superadmin():
    """Create default superadmin if none exists."""
    if not MULTI_TENANT:
        return
    conn = get_master_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) as n FROM mt_usuarios WHERE es_superadmin=true")
        row = cur.fetchone()
        if row and row["n"] == 0:
            from passlib.context import CryptContext
            pwd = CryptContext(schemes=["bcrypt"]).hash("superadmin123")
            cur.execute("""
                INSERT INTO mt_usuarios (username, nombre, email, password_hash, es_superadmin)
                VALUES ('superadmin', 'Super Administrador', '', %s, true)
                ON CONFLICT DO NOTHING
            """, (pwd,))
            conn.commit()
            print("Default superadmin created: superadmin / superadmin123")
    except Exception as e:
        conn.rollback()
        print(f"Error creating superadmin: {e}")
    finally:
        conn.close()
