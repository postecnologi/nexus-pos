"""
Super Admin router for multi-tenant management.
Only accessible by superadmin users.
"""
from fastapi import APIRouter, HTTPException, Form
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/superadmin", tags=["SuperAdmin"])


class EmpresaCreate(BaseModel):
    codigo: str
    nombre: str
    ruc: str = ""
    email: str = ""
    plan: str = "BASICO"
    admin_nombre: str = ""
    admin_username: str = ""
    admin_password: str = ""
    admin_email: str = ""


# ── Login ──────────────────────────────────────────────────────
@router.post("/login")
def sa_login(username: str = Form(...), password: str = Form(...)):
    """Login for super admin - separate from company login."""
    from multitenant import superadmin_login, MULTI_TENANT
    from auth import create_token
    if not MULTI_TENANT:
        raise HTTPException(400, "Multi-tenant no esta habilitado")
    user = superadmin_login(username, password)
    if not user:
        raise HTTPException(401, "Credenciales invalidas")
    token = create_token({"sub": str(user["id"]), "superadmin": True})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "nombre": user["nombre"],
            "es_superadmin": True,
        }
    }


# ── Empresas ───────────────────────────────────────────────────
@router.get("/empresas")
def listar_empresas():
    from multitenant import list_empresas
    return list_empresas()


@router.post("/empresas")
def crear_empresa(data: EmpresaCreate):
    from multitenant import create_tenant_database
    try:
        result = create_tenant_database(
            codigo=data.codigo, nombre=data.nombre,
            ruc=data.ruc, email=data.email,
            admin_nombre=data.admin_nombre,
            admin_username=data.admin_username,
            admin_password=data.admin_password,
            admin_email=data.admin_email,
        )
        return result
    except Exception as e:
        raise HTTPException(400, str(e))


@router.get("/empresas/{eid}")
def detalle_empresa(eid: int):
    from multitenant import get_empresa_detail
    emp = get_empresa_detail(eid)
    if not emp:
        raise HTTPException(404, "Empresa no encontrada")
    return emp


@router.get("/empresas/{eid}/admin")
def get_admin_empresa(eid: int):
    """Get current admin user for a company."""
    from multitenant import get_master_connection, get_tenant_connection
    conn = get_master_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT db_name FROM mt_empresas WHERE id=%s", (eid,))
        emp = cur.fetchone()
        if not emp: raise HTTPException(404, "Empresa no encontrada")
    finally:
        conn.close()
    try:
        t_conn = get_tenant_connection(emp["db_name"])
        tcur = t_conn.cursor()
        tcur.execute("SELECT id, username, nombre, email FROM sys_usuarios WHERE rol='admin' AND activo=true LIMIT 1")
        admin = tcur.fetchone()
        t_conn.close()
        return dict(admin) if admin else {"username": "", "nombre": "", "email": ""}
    except Exception:
        return {"username": "", "nombre": "", "email": ""}

class EmpresaUpdate(BaseModel):
    nombre: Optional[str] = None
    ruc: Optional[str] = None
    email: Optional[str] = None
    plan: Optional[str] = None

class AdminReset(BaseModel):
    admin_nombre: str
    admin_username: str
    admin_password: str = ""
    admin_email: str = ""

@router.put("/empresas/{eid}")
def actualizar_empresa(eid: int, data: EmpresaUpdate):
    from multitenant import get_master_connection
    conn = get_master_connection()
    try:
        cur = conn.cursor()
        fields = []; params = []
        if data.nombre is not None: fields.append("nombre=%s"); params.append(data.nombre)
        if data.ruc is not None: fields.append("ruc=%s"); params.append(data.ruc)
        if data.email is not None: fields.append("email=%s"); params.append(data.email)
        if data.plan is not None: fields.append("plan=%s"); params.append(data.plan)
        if not fields: return {"msg": "Sin cambios"}
        params.append(eid)
        cur.execute(f"UPDATE mt_empresas SET {','.join(fields)} WHERE id=%s", params)
        if cur.rowcount == 0: raise HTTPException(404, "Empresa no encontrada")
        conn.commit()
        return {"msg": "Empresa actualizada"}
    finally:
        conn.close()

@router.post("/empresas/{eid}/reset-admin")
def reset_admin_empresa(eid: int, data: AdminReset):
    """Reset or create the admin user for a company."""
    from multitenant import get_master_connection, get_tenant_connection
    from passlib.context import CryptContext
    pwd_ctx = CryptContext(schemes=["bcrypt"])

    conn = get_master_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT db_name FROM mt_empresas WHERE id=%s", (eid,))
        emp = cur.fetchone()
        if not emp: raise HTTPException(404, "Empresa no encontrada")
    finally:
        conn.close()

    tenant_conn = get_tenant_connection(emp["db_name"])
    try:
        tcur = tenant_conn.cursor()
        tcur.execute("SELECT id FROM sys_usuarios WHERE rol='admin' AND activo=true LIMIT 1")
        admin = tcur.fetchone()
        if admin:
            if data.admin_password:
                tcur.execute("""
                    UPDATE sys_usuarios SET username=%s, password_hash=%s, nombre=%s, email=%s
                    WHERE id=%s
                """, (data.admin_username, pwd_ctx.hash(data.admin_password),
                      data.admin_nombre, data.admin_email, admin["id"]))
            else:
                tcur.execute("""
                    UPDATE sys_usuarios SET username=%s, nombre=%s, email=%s
                    WHERE id=%s
                """, (data.admin_username, data.admin_nombre, data.admin_email, admin["id"]))
        else:
            pw = data.admin_password or 'admin123'
            tcur.execute("""
                INSERT INTO sys_usuarios (username, password_hash, nombre, email, rol, activo, sucursal_id)
                VALUES (%s, %s, %s, %s, 'admin', true, 1)
            """, (data.admin_username, pwd_ctx.hash(pw), data.admin_nombre, data.admin_email))
        tenant_conn.commit()
        return {"msg": f"Admin '{data.admin_username}' configurado"}
    finally:
        tenant_conn.close()

@router.patch("/empresas/{eid}/toggle")
def toggle_empresa_ep(eid: int):
    from multitenant import toggle_empresa
    result = toggle_empresa(eid)
    if not result:
        raise HTTPException(404, "Empresa no encontrada")
    return result


# ── Planes ─────────────────────────────────────────────────────
@router.get("/planes")
def listar_planes():
    from multitenant import list_planes
    return list_planes()

@router.put("/planes/{pid}")
def actualizar_plan(pid: int, nombre: str = None, max_usuarios: int = None,
                     max_productos: int = None, max_facturas_mes: int = None,
                     precio_mensual: float = None):
    from multitenant import get_master_connection
    conn = get_master_connection()
    try:
        cur = conn.cursor()
        fields = []; params = []
        if nombre is not None: fields.append("nombre=%s"); params.append(nombre)
        if max_usuarios is not None: fields.append("max_usuarios=%s"); params.append(max_usuarios)
        if max_productos is not None: fields.append("max_productos=%s"); params.append(max_productos)
        if max_facturas_mes is not None: fields.append("max_facturas_mes=%s"); params.append(max_facturas_mes)
        if precio_mensual is not None: fields.append("precio_mensual=%s"); params.append(precio_mensual)
        if not fields: return {"msg": "Sin cambios"}
        params.append(pid)
        cur.execute(f"UPDATE mt_planes SET {','.join(fields)} WHERE id=%s", params)
        conn.commit()
        return {"msg": "Plan actualizado"}
    finally:
        conn.close()

@router.post("/planes")
def crear_plan(nombre: str, max_usuarios: int = 5, max_productos: int = 500,
                max_facturas_mes: int = 100, precio_mensual: float = 0):
    from multitenant import get_master_connection
    conn = get_master_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO mt_planes (nombre, max_usuarios, max_productos, max_facturas_mes, precio_mensual)
            VALUES (%s,%s,%s,%s,%s) RETURNING id
        """, (nombre, max_usuarios, max_productos, max_facturas_mes, precio_mensual))
        pid = cur.fetchone()["id"]
        conn.commit()
        return {"id": pid, "msg": "Plan creado"}
    finally:
        conn.close()


# ══════════════════════════════════════════════════════════════
#  PAGOS Y SUSCRIPCIONES
# ══════════════════════════════════════════════════════════════

@router.get("/pagos")
def listar_pagos(empresa_id: Optional[int] = None):
    from multitenant import get_master_connection
    conn = get_master_connection()
    try:
        cur = conn.cursor()
        conds = ["1=1"]; params = []
        if empresa_id:
            conds.append("p.empresa_id=%s"); params.append(empresa_id)
        where = "WHERE " + " AND ".join(conds)
        cur.execute(f"""
            SELECT p.*, e.nombre as empresa_nombre, e.codigo as empresa_codigo
            FROM mt_pagos p
            JOIN mt_empresas e ON e.id=p.empresa_id
            {where} ORDER BY p.fecha DESC LIMIT 200
        """, params)
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()

@router.post("/pagos")
def registrar_pago(empresa_id: int, monto: float, metodo: str = "TRANSFERENCIA",
                    referencia: str = "", meses: int = 1, observaciones: str = ""):
    """Registrar un pago y extender la suscripción."""
    from multitenant import get_master_connection
    from datetime import date, timedelta
    conn = get_master_connection()
    try:
        cur = conn.cursor()
        # Get current empresa
        cur.execute("SELECT * FROM mt_empresas WHERE id=%s", (empresa_id,))
        emp = cur.fetchone()
        if not emp: raise HTTPException(404, "Empresa no encontrada")

        # Calculate new expiration
        venc_actual = emp.get("fecha_vencimiento") or date.today()
        if isinstance(venc_actual, str):
            venc_actual = date.fromisoformat(venc_actual)
        if venc_actual < date.today():
            venc_actual = date.today()
        nueva_venc = venc_actual + timedelta(days=30 * meses)

        # Register payment
        cur.execute("""
            INSERT INTO mt_pagos (empresa_id, monto, metodo, referencia, meses_pagados,
                                   periodo_inicio, periodo_fin, observaciones)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
        """, (empresa_id, monto, metodo, referencia, meses, venc_actual, nueva_venc, observaciones))
        pago_id = cur.fetchone()["id"]

        # Update empresa expiration and activate
        cur.execute("""
            UPDATE mt_empresas SET fecha_vencimiento=%s, activa=true WHERE id=%s
        """, (nueva_venc, empresa_id))

        conn.commit()
        return {
            "id": pago_id,
            "msg": f"Pago registrado. Suscripción extendida hasta {nueva_venc}",
            "fecha_vencimiento": str(nueva_venc),
            "monto": monto,
        }
    finally:
        conn.close()

@router.get("/suscripciones")
def estado_suscripciones():
    """Overview of all subscriptions with payment status."""
    from multitenant import get_master_connection
    conn = get_master_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT e.id, e.codigo, e.nombre, e.ruc, e.plan, e.activa,
                   e.fecha_registro, e.fecha_vencimiento,
                   p.precio_mensual,
                   COALESCE(e.fecha_vencimiento, CURRENT_DATE) - CURRENT_DATE as dias_restantes,
                   CASE
                       WHEN e.fecha_vencimiento IS NULL THEN 'SIN_FECHA'
                       WHEN e.fecha_vencimiento < CURRENT_DATE THEN 'VENCIDA'
                       WHEN e.fecha_vencimiento < CURRENT_DATE + INTERVAL '7 days' THEN 'POR_VENCER'
                       ELSE 'ACTIVA'
                   END as estado_suscripcion,
                   (SELECT COUNT(*) FROM mt_pagos WHERE empresa_id=e.id) as total_pagos,
                   (SELECT COALESCE(SUM(monto),0) FROM mt_pagos WHERE empresa_id=e.id) as total_pagado,
                   (SELECT MAX(fecha) FROM mt_pagos WHERE empresa_id=e.id) as ultimo_pago
            FROM mt_empresas e
            LEFT JOIN mt_planes p ON p.nombre=e.plan
            ORDER BY dias_restantes ASC NULLS FIRST
        """)
        empresas = [dict(r) for r in cur.fetchall()]

        # Summary
        total = len(empresas)
        activas = sum(1 for e in empresas if e.get('estado_suscripcion') == 'ACTIVA')
        vencidas = sum(1 for e in empresas if e.get('estado_suscripcion') == 'VENCIDA')
        por_vencer = sum(1 for e in empresas if e.get('estado_suscripcion') == 'POR_VENCER')
        ingresos_total = sum(float(e.get('total_pagado', 0)) for e in empresas)

        return {
            "resumen": {
                "total_empresas": total,
                "activas": activas,
                "vencidas": vencidas,
                "por_vencer": por_vencer,
                "ingresos_totales": round(ingresos_total, 2),
            },
            "empresas": empresas,
        }
    finally:
        conn.close()

@router.post("/verificar-vencimientos")
def verificar_vencimientos():
    """Check all subscriptions and deactivate expired ones."""
    from multitenant import get_master_connection
    conn = get_master_connection()
    try:
        cur = conn.cursor()
        # Find expired active companies
        cur.execute("""
            SELECT id, codigo, nombre, fecha_vencimiento
            FROM mt_empresas
            WHERE activa=true AND fecha_vencimiento IS NOT NULL AND fecha_vencimiento < CURRENT_DATE
        """)
        vencidas = [dict(r) for r in cur.fetchall()]

        desactivadas = 0
        for emp in vencidas:
            cur.execute("UPDATE mt_empresas SET activa=false WHERE id=%s", (emp['id'],))
            desactivadas += 1

        conn.commit()
        return {
            "verificadas": len(vencidas),
            "desactivadas": desactivadas,
            "empresas_desactivadas": [e['nombre'] for e in vencidas],
            "msg": f"{desactivadas} empresa(s) desactivadas por vencimiento" if desactivadas else "Todas las suscripciones están al día",
        }
    finally:
        conn.close()

@router.get("/pagos/{empresa_id}/historial")
def historial_pagos_empresa(empresa_id: int):
    from multitenant import get_master_connection
    conn = get_master_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT * FROM mt_pagos WHERE empresa_id=%s ORDER BY fecha DESC
        """, (empresa_id,))
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


# ══════════════════════════════════════════════════════════════
#  SOLICITUDES DE DEMO
# ══════════════════════════════════════════════════════════════

@router.get("/solicitudes")
def listar_solicitudes():
    from database import query
    return query("SELECT * FROM sys_solicitudes_demo ORDER BY created_at DESC LIMIT 100")

@router.patch("/solicitudes/{sid}")
def actualizar_solicitud(sid: int, estado: str = "CONTACTADA", notas: str = ""):
    from database import execute
    execute("UPDATE sys_solicitudes_demo SET estado=%s, notas=%s WHERE id=%s", (estado, notas, sid))
    return {"msg": "Solicitud actualizada"}
