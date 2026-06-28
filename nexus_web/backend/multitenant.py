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

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL:
    import urllib.parse
    _parsed = urllib.parse.urlparse(DATABASE_URL)
    MASTER_DB = _parsed.path.lstrip("/")
    DB_HOST = _parsed.hostname
    DB_PORT = _parsed.port or 5432
    DB_USER = _parsed.username
    DB_PASS = _parsed.password
else:
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
    """Create a new company database or shared-mode tenant."""
    db_name = f"nexus_emp_{codigo.lower()}"

    # Drop unique constraint on db_name if exists (shared mode needs same db_name)
    conn_fix = get_master_connection()
    try:
        cur_fix = conn_fix.cursor()
        cur_fix.execute("ALTER TABLE mt_empresas DROP CONSTRAINT IF EXISTS mt_empresas_db_name_key")
        conn_fix.commit()
    except Exception:
        conn_fix.rollback()
    finally:
        conn_fix.close()

    # Force uppercase
    codigo = codigo.upper().strip()

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

    # Try to create a separate database (only works on local PostgreSQL)
    db_created = False
    is_cloud = bool(DATABASE_URL)
    if not is_cloud:
        try:
            conn2 = psycopg2.connect(
                host=DB_HOST, port=DB_PORT, database="postgres",
                user=DB_USER, password=DB_PASS
            )
            conn2.autocommit = True
            cur2 = conn2.cursor()
            cur2.execute(f"""
                SELECT pg_terminate_backend(pid) FROM pg_stat_activity
                WHERE datname=%s AND pid <> pg_backend_pid()
            """, (MASTER_DB,))
            cur2.execute(f'CREATE DATABASE "{db_name}" TEMPLATE "{MASTER_DB}"')
            conn2.close()
            db_created = True
        except Exception:
            try: conn2.close()
            except: pass

    if db_created:
        # Separate DB created — configure admin in tenant DB
        tenant_conn = get_tenant_connection(db_name)
        try:
            tcur = tenant_conn.cursor()
            try:
                tcur.execute("UPDATE sys_empresas SET ruc=%s, razon_social=%s, email=%s WHERE activa=true", (ruc, nombre, email))
            except Exception:
                tenant_conn.rollback()
            cleanup_order = [
                "fin_caja_movimientos", "fin_cobros", "fin_pagos", "fin_movimientos_banco",
                "fin_estado_cuenta", "fin_lote_transacciones", "fin_conciliaciones",
                "fin_saldos_favor", "fin_cxc", "fin_cxp",
                "ven_factura_detalles", "ven_facturas", "ven_devolucion_detalles", "ven_devoluciones",
                "ven_cotizacion_detalles", "ven_cotizaciones", "ven_guia_remision_detalles", "ven_guias_remision",
                "ven_nota_debito_detalles", "ven_notas_debito", "ven_facturas_recurrentes",
                "com_compra_detalles", "com_compras", "com_liquidacion_detalles", "com_liquidaciones",
                "sri_retencion_detalles", "sri_retenciones",
                "inv_stock", "inv_stock_series", "inv_ajuste_detalles", "inv_ajustes",
                "inv_transferencia_series", "inv_transferencia_detalles", "inv_transferencias",
                "inv_toma_fisica_detalles", "inv_tomas_fisicas",
                "inv_precios_historial", "inv_precio_historial", "inv_precios", "inv_ofertas", "inv_lotes",
                "inv_producto_bodegas", "inv_productos", "inv_categorias", "inv_marcas",
                "imp_plantillas_etiqueta",
                "srv_repuestos_usados", "srv_seguimientos", "srv_ordenes", "srv_tecnicos",
                "crm_notas", "crm_actividades", "crm_historial_etapas", "crm_oportunidades",
                "crm_automatizaciones", "crm_plantillas",
                "cont_asiento_detalles", "cont_asientos", "cont_presupuestos",
                "nom_permisos", "nom_horas_acumuladas", "nom_roles_pago", "nom_vacaciones",
                "nom_prestamos", "nom_empleados",
                "sys_audit_log", "sys_permisos_usuario",
                "sys_whatsapp_log",
                "ven_clientes", "ven_vendedores", "com_proveedores",
                "fin_cajas", "fin_bancos",
            ]
            for table in cleanup_order:
                try:
                    tcur.execute(f"DELETE FROM {table}")
                    tenant_conn.commit()
                except Exception:
                    tenant_conn.rollback()
            # Insert default client
            try:
                tcur.execute("INSERT INTO ven_clientes (identificacion, razon_social, tipo_identificacion) VALUES ('9999999999999','CONSUMIDOR FINAL','RUC')")
                tenant_conn.commit()
            except Exception:
                tenant_conn.rollback()
            try:
                from passlib.context import CryptContext
                pwd_ctx = CryptContext(schemes=["bcrypt"])
                a_username = admin_username.strip() if admin_username else 'admin'
                a_password = admin_password if admin_password else 'admin123'
                a_nombre = admin_nombre.strip() if admin_nombre else 'Administrador'
                a_email = admin_email.strip() if admin_email else email
                tcur.execute("UPDATE sys_usuarios SET activo=false")
                tcur.execute("""
                    UPDATE sys_usuarios SET username=%s, password_hash=%s, nombre=%s,
                        email=%s, rol='admin', activo=true
                    WHERE id=(SELECT MIN(id) FROM sys_usuarios)
                """, (a_username, pwd_ctx.hash(a_password), a_nombre, a_email))
            except Exception:
                tenant_conn.rollback()
            for mt_table in ["mt_empresas","mt_usuarios","mt_planes","mt_pagos","sys_solicitudes_demo"]:
                try: tcur.execute(f"DROP TABLE IF EXISTS {mt_table} CASCADE")
                except: tenant_conn.rollback()
            tenant_conn.commit()
        except Exception as e:
            tenant_conn.rollback()
        finally:
            tenant_conn.close()
    else:
        # Cloud hosting (Render free, etc.) — use same DB, shared tables
        # Store db_name = MASTER_DB so login connects to same DB
        conn_upd = get_master_connection()
        try:
            cur_upd = conn_upd.cursor()
            cur_upd.execute("UPDATE mt_empresas SET db_name=%s WHERE id=%s", (MASTER_DB, empresa_id))
            conn_upd.commit()
        finally:
            conn_upd.close()
        # Create admin user in the main DB for this company
        try:
            from passlib.context import CryptContext
            pwd_ctx = CryptContext(schemes=["bcrypt"])
            a_username = admin_username.strip() if admin_username else 'admin'
            a_password = admin_password if admin_password else 'admin123'
            a_nombre = admin_nombre.strip() if admin_nombre else 'Administrador'
            a_email = admin_email.strip() if admin_email else email
            main_conn = get_master_connection()
            mcur = main_conn.cursor()
            mcur.execute("SELECT id FROM sys_usuarios WHERE username=%s", (a_username,))
            if not mcur.fetchone():
                mcur.execute("""
                    INSERT INTO sys_usuarios (username, password_hash, nombre, email, rol, activo, sucursal_id)
                    VALUES (%s,%s,%s,%s,'admin',true,1)
                """, (a_username, pwd_ctx.hash(a_password), a_nombre, a_email))
            main_conn.commit()
            main_conn.close()
        except Exception as e:
            print(f"Warning creating admin: {e}")

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


def get_plan_empresa(db_name):
    if not MULTI_TENANT:
        return None
    try:
        conn = get_master_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT e.codigo, e.nombre, e.plan, e.activa, e.fecha_vencimiento,
                   p.max_usuarios, p.max_productos, p.max_facturas_mes, p.precio_mensual
            FROM mt_empresas e
            LEFT JOIN mt_planes p ON p.nombre = e.plan
            WHERE e.db_name = %s
        """, (db_name,))
        r = cur.fetchone()
        conn.close()
        return dict(r) if r else None
    except Exception:
        return None


def verificar_limite(db_name, tipo):
    plan = get_plan_empresa(db_name)
    if not plan:
        return True, ""
    try:
        from database import query_one as qo
        if tipo == 'usuarios':
            actual = qo("SELECT COUNT(*) as n FROM sys_usuarios WHERE activo=true")
            limite = plan.get("max_usuarios", 999)
            if actual and int(actual["n"]) >= limite:
                return False, f"Limite de {limite} usuarios alcanzado (Plan {plan['plan']}). Contacte a soporte para cambiar de plan."
        elif tipo == 'productos':
            actual = qo("SELECT COUNT(*) as n FROM inv_productos WHERE activo=true")
            limite = plan.get("max_productos", 99999)
            if actual and int(actual["n"]) >= limite:
                return False, f"Limite de {limite} productos alcanzado (Plan {plan['plan']}). Contacte a soporte para cambiar de plan."
        elif tipo == 'facturas':
            actual = qo("SELECT COUNT(*) as n FROM ven_facturas WHERE fecha >= date_trunc('month', CURRENT_DATE)")
            limite = plan.get("max_facturas_mes", 99999)
            if actual and int(actual["n"]) >= limite:
                return False, f"Limite de {limite} facturas/mes alcanzado (Plan {plan['plan']}). Contacte a soporte para cambiar de plan."
    except Exception:
        pass
    return True, ""


def get_uso_empresa(db_name):
    plan = get_plan_empresa(db_name)
    if not plan:
        return None
    try:
        from database import query_one as qo
        usuarios = qo("SELECT COUNT(*) as n FROM sys_usuarios WHERE activo=true")
        productos = qo("SELECT COUNT(*) as n FROM inv_productos WHERE activo=true")
        facturas_mes = qo("SELECT COUNT(*) as n FROM ven_facturas WHERE fecha >= date_trunc('month', CURRENT_DATE)")
        return {
            "plan": plan["plan"],
            "precio": float(plan.get("precio_mensual", 0)),
            "usuarios": {"actual": int(usuarios["n"]) if usuarios else 0, "limite": plan.get("max_usuarios", 0)},
            "productos": {"actual": int(productos["n"]) if productos else 0, "limite": plan.get("max_productos", 0)},
            "facturas_mes": {"actual": int(facturas_mes["n"]) if facturas_mes else 0, "limite": plan.get("max_facturas_mes", 0)},
            "empresa": plan.get("nombre", ""),
            "codigo": plan.get("codigo", ""),
            "vencimiento": str(plan.get("fecha_vencimiento", "")) if plan.get("fecha_vencimiento") else None,
        }
    except Exception:
        return None
