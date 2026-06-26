from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from database import query, query_one, execute, insert, db
from auth import get_current_user
from typing import Optional
from pydantic import BaseModel
import io
import urllib.parse

router = APIRouter(prefix="/api/servicio-tecnico", tags=["Servicio Tecnico"])

ESTADOS = ["RECIBIDO", "EN_DIAGNOSTICO", "PRESUPUESTADO", "APROBADO",
           "EN_REPARACION", "REPARADO", "ENTREGADO", "CANCELADO"]

PRIORIDADES = ["BAJA", "NORMAL", "ALTA", "URGENTE"]

# Transiciones permitidas: estado_actual -> [estados_destino]
TRANSICIONES = {
    "RECIBIDO":       ["EN_DIAGNOSTICO", "CANCELADO"],
    "EN_DIAGNOSTICO": ["PRESUPUESTADO", "CANCELADO"],
    "PRESUPUESTADO":  ["APROBADO", "CANCELADO"],
    "APROBADO":       ["EN_REPARACION", "CANCELADO"],
    "EN_REPARACION":  ["REPARADO", "CANCELADO"],
    "REPARADO":       ["ENTREGADO", "EN_REPARACION"],
    "ENTREGADO":      [],
    "CANCELADO":      [],
}


# ── Pydantic Models ─────────────────────────────────────────

class OrdenServicioIn(BaseModel):
    cliente_id: int
    tecnico_id: Optional[int] = None
    equipo_tipo: str = "CELULAR"
    equipo_marca: str = ""
    equipo_modelo: str = ""
    equipo_serie: Optional[str] = None
    equipo_color: Optional[str] = None
    equipo_password: Optional[str] = None
    accesorios: Optional[str] = None
    problema_reportado: str
    costo_estimado: float = 0
    anticipo: float = 0
    prioridad: str = "NORMAL"
    fecha_estimada: Optional[str] = None
    observaciones: Optional[str] = None

class AnticipoIn(BaseModel):
    monto: float
    forma_pago: str = "EFECTIVO"
    referencia: str = ""

class SeguimientoIn(BaseModel):
    tipo: str = "NOTA"
    descripcion: str

class EstadoIn(BaseModel):
    estado: str
    descripcion: Optional[str] = None
    dias_garantia: Optional[int] = None
    condiciones_garantia: Optional[str] = None

class TecnicoIn(BaseModel):
    codigo: Optional[str] = None
    nombre: str
    apellidos: Optional[str] = None
    cedula: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    especialidad: Optional[str] = None
    sucursal_id: Optional[int] = None
    activo: bool = True
    crear_usuario: bool = False
    username: Optional[str] = None
    password: Optional[str] = None

class RepuestoIn(BaseModel):
    producto_id: Optional[int] = None
    descripcion: Optional[str] = None
    cantidad: float = 1
    costo: float = 0
    precio: float = 0


# ══════════════════════════════════════════════════════════════
#  TECNICOS CRUD
# ══════════════════════════════════════════════════════════════

@router.get("/tecnicos")
def listar_tecnicos(u=Depends(get_current_user)):
    rows = query("""
        SELECT * FROM srv_tecnicos
        WHERE activo = true
        ORDER BY nombre ASC
    """)
    return rows


@router.post("/tecnicos")
def crear_tecnico(body: TecnicoIn, u=Depends(get_current_user)):
    usuario_id = None
    if body.crear_usuario:
        if not body.username or not body.password:
            raise HTTPException(400, "Username y password son obligatorios para crear usuario")
        existe = query_one("SELECT id FROM sys_usuarios WHERE username=%s", (body.username,))
        if existe:
            raise HTTPException(400, f"Ya existe un usuario con el nombre '{body.username}'")
        from auth import hash_password
        suc = body.sucursal_id or u.get("sucursal_id") or query_one("SELECT id FROM sys_sucursales WHERE activa=true LIMIT 1", ())
        suc_id = suc["id"] if isinstance(suc, dict) else suc
        usuario_id = insert("""
            INSERT INTO sys_usuarios (username, nombre, email, telefono, sucursal_id,
                                      rol, password_hash, activo, created_at)
            VALUES (%s,%s,%s,%s,%s,'tecnico',%s,true,NOW())
        """, (body.username, f"{body.nombre} {body.apellidos or ''}".strip(),
              body.email, body.telefono, suc_id,
              hash_password(body.password)))

    tid = insert("""
        INSERT INTO srv_tecnicos (codigo, nombre, apellidos, cedula, telefono,
                                   email, especialidad, sucursal_id, usuario_id, activo, created_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
    """, (body.codigo, body.nombre, body.apellidos, body.cedula, body.telefono,
          body.email, body.especialidad, body.sucursal_id, usuario_id, body.activo))
    return {
        "id": tid,
        "usuario_id": usuario_id,
        "msg": f"Técnico creado{' con cuenta de usuario' if usuario_id else ''}",
    }


@router.put("/tecnicos/{tid}")
def actualizar_tecnico(tid: int, body: TecnicoIn, u=Depends(get_current_user)):
    existing = query_one("SELECT id FROM srv_tecnicos WHERE id=%s", (tid,))
    if not existing:
        raise HTTPException(404, "Tecnico no encontrado")
    execute("""
        UPDATE srv_tecnicos SET
            codigo=%s, nombre=%s, apellidos=%s, cedula=%s,
            telefono=%s, email=%s, especialidad=%s, sucursal_id=%s, activo=%s
        WHERE id=%s
    """, (body.codigo, body.nombre, body.apellidos, body.cedula,
          body.telefono, body.email, body.especialidad, body.sucursal_id, body.activo, tid))
    return {"msg": "Tecnico actualizado correctamente"}


@router.patch("/tecnicos/{tid}/toggle")
def toggle_tecnico(tid: int, u=Depends(get_current_user)):
    existing = query_one("SELECT id, activo FROM srv_tecnicos WHERE id=%s", (tid,))
    if not existing:
        raise HTTPException(404, "Tecnico no encontrado")
    nuevo = not existing["activo"]
    execute("UPDATE srv_tecnicos SET activo=%s WHERE id=%s", (nuevo, tid))
    return {"activo": nuevo, "msg": "Estado del tecnico actualizado"}


# ══════════════════════════════════════════════════════════════
#  REPUESTOS / PARTES USADAS
# ══════════════════════════════════════════════════════════════

@router.get("/{oid}/repuestos")
def listar_repuestos(oid: int, u=Depends(get_current_user)):
    rows = query("""
        SELECT r.*, p.descripcion AS producto_nombre
        FROM srv_repuestos_usados r
        LEFT JOIN inv_productos p ON p.id = r.producto_id
        WHERE r.orden_id = %s
        ORDER BY r.id ASC
    """, (oid,))
    return rows


@router.post("/{oid}/repuestos")
def agregar_repuesto(oid: int, body: RepuestoIn, u=Depends(get_current_user)):
    orden = query_one("SELECT id FROM srv_ordenes WHERE id=%s", (oid,))
    if not orden:
        raise HTTPException(404, "Orden no encontrada")

    descripcion = body.descripcion or ""
    costo = body.costo
    precio = body.precio

    if body.producto_id:
        prod = query_one("SELECT nombre FROM inv_productos WHERE id=%s", (body.producto_id,))
        if prod:
            descripcion = descripcion or prod["nombre"]
        costo_row = query_one("""
            SELECT costo FROM inv_costos WHERE producto_id=%s
            ORDER BY id DESC LIMIT 1
        """, (body.producto_id,))
        if costo_row and not body.costo:
            costo = float(costo_row["costo"] or 0)

    if not descripcion:
        raise HTTPException(400, "Descripcion del repuesto es obligatoria")

    rid = insert("""
        INSERT INTO srv_repuestos_usados (orden_id, producto_id, descripcion, cantidad, costo, precio, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, NOW())
    """, (oid, body.producto_id, descripcion, body.cantidad, costo, precio))

    # Auto-create seguimiento
    insert("""
        INSERT INTO srv_seguimientos
            (orden_id, usuario_id, fecha, tipo, descripcion)
        VALUES (%s, %s, NOW(), 'REPUESTO', %s)
    """, (oid, u["id"], f"Repuesto: {descripcion} x{body.cantidad}"))

    return {"id": rid, "msg": "Repuesto agregado"}


@router.delete("/repuestos/{rid}")
def eliminar_repuesto(rid: int, u=Depends(get_current_user)):
    existing = query_one("SELECT id FROM srv_repuestos_usados WHERE id=%s", (rid,))
    if not existing:
        raise HTTPException(404, "Repuesto no encontrado")
    execute("DELETE FROM srv_repuestos_usados WHERE id=%s", (rid,))
    return {"msg": "Repuesto eliminado"}


# ══════════════════════════════════════════════════════════════
#  LISTAR ORDENES
# ══════════════════════════════════════════════════════════════

@router.get("")
def listar_ordenes(
    busqueda:    Optional[str] = None,
    estado:      Optional[str] = None,
    prioridad:   Optional[str] = None,
    tecnico_id:  Optional[int] = None,
    sucursal_id: Optional[int] = None,
    fecha_ini:   Optional[str] = None,
    fecha_fin:   Optional[str] = None,
    u=Depends(get_current_user),
):
    conds  = ["1=1"]
    params = []

    if sucursal_id:
        conds.append("o.sucursal_id=%s"); params.append(sucursal_id)
    if estado:
        conds.append("o.estado=%s"); params.append(estado)
    if prioridad:
        conds.append("o.prioridad=%s"); params.append(prioridad)
    if tecnico_id:
        conds.append("o.tecnico_id=%s"); params.append(tecnico_id)
    if fecha_ini:
        conds.append("o.fecha_ingreso::date>=%s"); params.append(fecha_ini)
    if fecha_fin:
        conds.append("o.fecha_ingreso::date<=%s"); params.append(fecha_fin)
    if busqueda:
        conds.append(
            "(o.numero ILIKE %s OR c.razon_social ILIKE %s OR c.identificacion ILIKE %s "
            "OR o.equipo_marca ILIKE %s OR o.equipo_modelo ILIKE %s)"
        )
        params += [f"%{busqueda}%"] * 5

    where = "WHERE " + " AND ".join(conds)
    rows = query(f"""
        SELECT o.*,
               c.razon_social   AS cliente_nombre,
               c.identificacion AS cliente_ruc,
               c.telefono       AS cliente_telefono,
               t.nombre         AS tecnico_nombre,
               suc.nombre       AS sucursal_nombre,
               (SELECT COUNT(*) FROM srv_seguimientos s WHERE s.orden_id = o.id) AS seguimientos_count
        FROM srv_ordenes o
        JOIN ven_clientes c            ON c.id = o.cliente_id
        LEFT JOIN srv_tecnicos t       ON t.id = o.tecnico_id
        LEFT JOIN sys_sucursales suc   ON suc.id = o.sucursal_id
        {where}
        ORDER BY o.created_at DESC, o.id DESC
        LIMIT 300
    """, params)
    return rows


# ══════════════════════════════════════════════════════════════
#  PROXIMO NUMERO
# ══════════════════════════════════════════════════════════════

@router.get("/proximo-numero")
def proximo_numero(u=Depends(get_current_user)):
    suc_id = u.get("sucursal_id")
    suc = (
        query_one("SELECT * FROM sys_sucursales WHERE id=%s", (suc_id,))
        if suc_id else
        query_one("SELECT * FROM sys_sucursales WHERE es_principal=true AND activa=true LIMIT 1")
    )
    cod_est = (suc.get("codigo_establecimiento") or "001") if suc else "001"

    last = query_one("SELECT numero FROM srv_ordenes ORDER BY id DESC LIMIT 1")
    if last and last["numero"]:
        try:
            seq = int(last["numero"].split("-")[-1]) + 1
        except (ValueError, IndexError):
            seq = 1
    else:
        seq = 1

    numero = f"OST-{cod_est}-{str(seq).zfill(5)}"
    return {"numero": numero, "secuencial": seq}


# ══════════════════════════════════════════════════════════════
#  STATS / DASHBOARD
# ══════════════════════════════════════════════════════════════

@router.get("/stats")
def stats(sucursal_id: Optional[int] = None, u=Depends(get_current_user)):
    suc_filter = "WHERE sucursal_id=%s" if sucursal_id else ""
    suc_and = "AND sucursal_id=%s" if sucursal_id else ""
    suc_params = [sucursal_id] if sucursal_id else []

    total = query_one(f"SELECT COUNT(*) AS total FROM srv_ordenes {suc_filter}", suc_params) or {"total": 0}

    por_estado = query(f"""
        SELECT estado, COUNT(*) AS cantidad
        FROM srv_ordenes {suc_filter}
        GROUP BY estado
    """, suc_params)
    estados_dict = {r["estado"]: r["cantidad"] for r in por_estado}

    por_prioridad = query(f"""
        SELECT prioridad, COUNT(*) AS cantidad
        FROM srv_ordenes
        WHERE estado NOT IN ('ENTREGADO','CANCELADO') {suc_and}
        GROUP BY prioridad
    """, suc_params)
    prioridad_dict = {r["prioridad"]: r["cantidad"] for r in por_prioridad}

    promedio = query_one(f"""
        SELECT COALESCE(
            AVG(EXTRACT(EPOCH FROM (fecha_cierre - fecha_ingreso)) / 86400), 0
        ) AS promedio_dias
        FROM srv_ordenes
        WHERE fecha_cierre IS NOT NULL AND estado = 'ENTREGADO' {suc_and}
    """, suc_params) or {"promedio_dias": 0}

    por_sucursal = query("""
        SELECT suc.nombre AS sucursal,
               COUNT(*) AS total,
               COUNT(CASE WHEN o.estado NOT IN ('ENTREGADO','CANCELADO') THEN 1 END) AS pendientes
        FROM srv_ordenes o
        LEFT JOIN sys_sucursales suc ON suc.id = o.sucursal_id
        GROUP BY suc.nombre
        ORDER BY pendientes DESC
    """)

    return {
        "total": total["total"],
        "por_estado": estados_dict,
        "por_prioridad": prioridad_dict,
        "promedio_dias_reparacion": round(float(promedio["promedio_dias"]), 1),
        "por_sucursal": por_sucursal,
    }


# ══════════════════════════════════════════════════════════════
#  CREAR ORDEN
# ══════════════════════════════════════════════════════════════

@router.post("")
def crear_orden(body: OrdenServicioIn, u=Depends(get_current_user)):
    if not body.problema_reportado.strip():
        raise HTTPException(400, "El problema reportado es obligatorio")

    prox = proximo_numero(u)
    numero = prox["numero"]

    suc_id = u.get("sucursal_id")

    orden_id = insert("""
        INSERT INTO srv_ordenes
            (numero, cliente_id, sucursal_id, usuario_id, tecnico_id,
             fecha_ingreso, fecha_estimada,
             equipo_tipo, equipo_marca, equipo_modelo, equipo_serie,
             equipo_color, equipo_password, accesorios,
             problema_reportado, costo_estimado, anticipo,
             prioridad, observaciones, estado, created_at)
        VALUES (%s,%s,%s,%s,%s, NOW(), %s, %s,%s,%s,%s, %s,%s,%s, %s,%s,%s, %s,%s,'RECIBIDO', NOW())
    """, (numero, body.cliente_id, suc_id, u["id"], body.tecnico_id,
          body.fecha_estimada,
          body.equipo_tipo, body.equipo_marca, body.equipo_modelo, body.equipo_serie,
          body.equipo_color, body.equipo_password, body.accesorios,
          body.problema_reportado, body.costo_estimado, body.anticipo,
          body.prioridad, body.observaciones))

    # Auto-crear primer seguimiento
    insert("""
        INSERT INTO srv_seguimientos
            (orden_id, usuario_id, fecha, tipo, descripcion, estado_nuevo)
        VALUES (%s, %s, NOW(), 'NOTA', 'Equipo recibido', 'RECIBIDO')
    """, (orden_id, u["id"]))

    return {"id": orden_id, "numero": numero, "msg": "Orden de servicio creada correctamente"}


# ══════════════════════════════════════════════════════════════
#  DASHBOARD RENDIMIENTO POR TECNICO
# ══════════════════════════════════════════════════════════════

@router.get("/dashboard-tecnicos")
def dashboard_tecnicos(fecha_ini: Optional[str] = None, fecha_fin: Optional[str] = None, u=Depends(get_current_user)):
    """Technician performance dashboard."""
    date_filter = ""
    params = []
    if fecha_ini and fecha_fin:
        date_filter = "AND o.fecha_ingreso::date BETWEEN %s AND %s"
        params = [fecha_ini, fecha_fin]

    tecnicos = query(f"""
        SELECT t.id, t.nombre, t.apellidos, t.especialidad,
               COUNT(o.id) as total_ordenes,
               COUNT(CASE WHEN o.estado='ENTREGADO' THEN 1 END) as completadas,
               COUNT(CASE WHEN o.estado NOT IN ('ENTREGADO','CANCELADO') THEN 1 END) as en_proceso,
               COALESCE(AVG(CASE WHEN o.fecha_cierre IS NOT NULL
                   THEN EXTRACT(EPOCH FROM o.fecha_cierre-o.fecha_ingreso)/86400 END),0) as promedio_dias,
               COALESCE(SUM(CASE WHEN o.estado='ENTREGADO' THEN o.costo_final ELSE 0 END),0) as ingresos
        FROM srv_tecnicos t
        LEFT JOIN srv_ordenes o ON o.tecnico_id=t.id {date_filter}
        WHERE t.activo=true
        GROUP BY t.id, t.nombre, t.apellidos, t.especialidad
        ORDER BY completadas DESC
    """, params)

    return {"tecnicos": tecnicos}


# ══════════════════════════════════════════════════════════════
#  HISTORIAL DEL EQUIPO
# ══════════════════════════════════════════════════════════════

@router.get("/historial-equipo")
def historial_equipo(serie: Optional[str] = None, marca: Optional[str] = None,
                      modelo: Optional[str] = None, cliente_id: Optional[int] = None,
                      u=Depends(get_current_user)):
    """Find previous service orders for the same device."""
    conds = ["1=1"]
    params = []
    if serie:
        conds.append("o.equipo_serie ILIKE %s")
        params.append(f"%{serie}%")
    if marca:
        conds.append("o.equipo_marca ILIKE %s")
        params.append(f"%{marca}%")
    if modelo:
        conds.append("o.equipo_modelo ILIKE %s")
        params.append(f"%{modelo}%")
    if cliente_id:
        conds.append("o.cliente_id=%s")
        params.append(cliente_id)
    if not serie and not marca and not modelo and not cliente_id:
        raise HTTPException(400, "Proporcione al menos un filtro")
    where = "WHERE " + " AND ".join(conds)

    return query(f"""
        SELECT o.id, o.numero, o.fecha_ingreso, o.equipo_tipo, o.equipo_marca,
               o.equipo_modelo, o.equipo_serie, o.problema_reportado, o.solucion,
               o.estado, o.costo_final, c.razon_social as cliente
        FROM srv_ordenes o
        JOIN ven_clientes c ON c.id=o.cliente_id
        {where} ORDER BY o.fecha_ingreso DESC
    """, params)


# ══════════════════════════════════════════════════════════════
#  DETALLE ORDEN
# ══════════════════════════════════════════════════════════════

@router.get("/{oid}")
def detalle_orden(oid: int, u=Depends(get_current_user)):
    orden = query_one("""
        SELECT o.*,
               c.razon_social    AS cliente_nombre,
               c.identificacion  AS cliente_ruc,
               c.telefono        AS cliente_telefono,
               c.email           AS cliente_email,
               c.direccion       AS cliente_direccion,
               t.nombre          AS tecnico_nombre,
               t.apellidos       AS tecnico_apellidos,
               t.telefono        AS tecnico_telefono,
               t.email           AS tecnico_email,
               t.especialidad    AS tecnico_especialidad,
               usr.nombre        AS usuario_nombre,
               suc.nombre        AS sucursal_nombre
        FROM srv_ordenes o
        JOIN ven_clientes c            ON c.id = o.cliente_id
        LEFT JOIN srv_tecnicos t       ON t.id = o.tecnico_id
        LEFT JOIN sys_usuarios usr     ON usr.id = o.usuario_id
        LEFT JOIN sys_sucursales suc   ON suc.id = o.sucursal_id
        WHERE o.id = %s LIMIT 1
    """, (oid,))
    if not orden:
        raise HTTPException(404, "Orden no encontrada")

    seguimientos = query("""
        SELECT s.*, usr.nombre AS usuario_nombre
        FROM srv_seguimientos s
        LEFT JOIN sys_usuarios usr ON usr.id = s.usuario_id
        WHERE s.orden_id = %s
        ORDER BY s.fecha ASC, s.id ASC
    """, (oid,))
    orden["seguimientos"] = seguimientos

    # Repuestos
    repuestos = query("""
        SELECT r.*, p.descripcion AS producto_nombre
        FROM srv_repuestos_usados r
        LEFT JOIN inv_productos p ON p.id = r.producto_id
        WHERE r.orden_id = %s
        ORDER BY r.id ASC
    """, (oid,))
    orden["repuestos"] = repuestos
    orden["total_repuestos"] = sum(float(r.get("cantidad") or 0) * float(r.get("precio") or 0) for r in repuestos)

    # Tecnico object
    if orden.get("tecnico_id"):
        tecnico = query_one("SELECT * FROM srv_tecnicos WHERE id=%s", (orden["tecnico_id"],))
        orden["tecnico"] = tecnico
    else:
        orden["tecnico"] = None

    return orden


# ══════════════════════════════════════════════════════════════
#  ACTUALIZAR ORDEN
# ══════════════════════════════════════════════════════════════

@router.put("/{oid}")
def actualizar_orden(oid: int, body: OrdenServicioIn, u=Depends(get_current_user)):
    orden = query_one("SELECT estado FROM srv_ordenes WHERE id=%s", (oid,))
    if not orden:
        raise HTTPException(404, "Orden no encontrada")
    if orden["estado"] in ("ENTREGADO", "CANCELADO"):
        raise HTTPException(400, "No se puede editar una orden en estado " + orden["estado"])

    execute("""
        UPDATE srv_ordenes SET
            cliente_id=%s, tecnico_id=%s,
            equipo_tipo=%s, equipo_marca=%s, equipo_modelo=%s, equipo_serie=%s,
            equipo_color=%s, equipo_password=%s, accesorios=%s,
            problema_reportado=%s, costo_estimado=%s, anticipo=%s,
            prioridad=%s, fecha_estimada=%s, observaciones=%s
        WHERE id=%s
    """, (body.cliente_id, body.tecnico_id,
          body.equipo_tipo, body.equipo_marca, body.equipo_modelo, body.equipo_serie,
          body.equipo_color, body.equipo_password, body.accesorios,
          body.problema_reportado, body.costo_estimado, body.anticipo,
          body.prioridad, body.fecha_estimada, body.observaciones, oid))

    return {"msg": "Orden actualizada correctamente"}


# ══════════════════════════════════════════════════════════════
#  CAMBIAR ESTADO
# ══════════════════════════════════════════════════════════════

@router.patch("/{oid}/estado")
def cambiar_estado(oid: int, body: EstadoIn, u=Depends(get_current_user)):
    orden = query_one("SELECT estado FROM srv_ordenes WHERE id=%s", (oid,))
    if not orden:
        raise HTTPException(404, "Orden no encontrada")

    actual = orden["estado"]
    nuevo  = body.estado.upper()

    if nuevo not in ESTADOS:
        raise HTTPException(400, f"Estado no valido. Permitidos: {', '.join(ESTADOS)}")

    permitidos = TRANSICIONES.get(actual, [])
    if nuevo not in permitidos:
        raise HTTPException(400, f"No se puede pasar de {actual} a {nuevo}. Permitidos: {', '.join(permitidos)}")

    # Actualizar estado
    if nuevo == "ENTREGADO":
        execute("UPDATE srv_ordenes SET estado=%s, fecha_cierre=NOW() WHERE id=%s", (nuevo, oid))
    elif nuevo == "REPARADO":
        # Save warranty info when marking as repaired
        updates = ["estado=%s"]
        params = [nuevo]
        if body.dias_garantia is not None:
            updates.append("dias_garantia=%s")
            params.append(body.dias_garantia)
        if body.condiciones_garantia is not None:
            updates.append("condiciones_garantia=%s")
            params.append(body.condiciones_garantia)
        params.append(oid)
        execute(f"UPDATE srv_ordenes SET {', '.join(updates)} WHERE id=%s", params)
    else:
        execute("UPDATE srv_ordenes SET estado=%s WHERE id=%s", (nuevo, oid))

    # Auto-crear seguimiento
    desc = body.descripcion or f"Estado cambiado de {actual} a {nuevo}"
    insert("""
        INSERT INTO srv_seguimientos
            (orden_id, usuario_id, fecha, tipo, descripcion, estado_anterior, estado_nuevo)
        VALUES (%s, %s, NOW(), 'NOTA', %s, %s, %s)
    """, (oid, u["id"], desc, actual, nuevo))

    # Auto-notify client
    notif_info = {}
    try:
        orden_n = query_one("""
            SELECT o.numero, o.equipo_marca, o.equipo_modelo, o.costo_estimado,
                   c.razon_social, c.telefono, c.email
            FROM srv_ordenes o JOIN ven_clientes c ON c.id=o.cliente_id
            WHERE o.id=%s
        """, (oid,))

        mensajes_estado = {
            'EN_DIAGNOSTICO': f"Su equipo {orden_n.get('equipo_marca','')} {orden_n.get('equipo_modelo','')} esta siendo diagnosticado.",
            'PRESUPUESTADO': f"El presupuesto para su equipo es ${float(orden_n.get('costo_estimado',0)):.2f}. Responda para aprobar.",
            'EN_REPARACION': f"Su equipo esta en reparacion. Le avisaremos cuando este listo.",
            'REPARADO': f"Su equipo esta listo! Puede pasar a retirarlo.",
            'ENTREGADO': f"Gracias por confiar en nosotros. Su equipo ha sido entregado.",
        }

        msg = mensajes_estado.get(nuevo)
        if msg and orden_n:
            texto_completo = f"Orden #{orden_n['numero']}: {msg}"

            # Send WhatsApp link (log activity)
            if orden_n.get('telefono'):
                tel = orden_n['telefono'].replace(' ','').replace('-','')
                if tel.startswith('0'): tel = '593' + tel[1:]
                wa_link = f"https://wa.me/{tel}?text={urllib.parse.quote(texto_completo)}"
                insert("""INSERT INTO srv_seguimientos (orden_id, usuario_id, fecha, tipo, descripcion, estado_nuevo)
                    VALUES (%s,%s,NOW(),'CONTACTO_CLIENTE',%s,%s)""",
                    (oid, u['id'], f"Notificacion WhatsApp: {msg}", nuevo))
                notif_info['whatsapp_link'] = wa_link

            # Send email if configured
            if orden_n.get('email'):
                try:
                    from sri.email_sender import enviar_comprobante_email, smtp_configurado
                    if smtp_configurado():
                        empresa = query_one("SELECT razon_social FROM sys_empresas WHERE activa=true LIMIT 1")
                        html = f"""<div style="font-family:Arial;padding:20px;">
                            <h2>{empresa.get('razon_social','') if empresa else ''}</h2>
                            <p>Estimado/a <b>{orden_n['razon_social']}</b>,</p>
                            <p>{msg}</p>
                            <p>Orden: <b>{orden_n['numero']}</b></p>
                            <p style="color:#666;font-size:12px;">Este mensaje fue enviado automaticamente.</p>
                        </div>"""
                        enviar_comprobante_email(
                            destinatario_email=orden_n['email'],
                            destinatario_nombre=orden_n['razon_social'],
                            asunto=f"Orden {orden_n['numero']} - {nuevo.replace('_',' ')}",
                            cuerpo_html=html)
                        notif_info['email_sent'] = True
                except Exception:
                    pass
            notif_info['mensaje'] = texto_completo
    except Exception:
        pass

    return {"msg": f"Estado cambiado a {nuevo}", "estado": nuevo, "notificacion": notif_info}


# ══════════════════════════════════════════════════════════════
#  AGREGAR SEGUIMIENTO
# ══════════════════════════════════════════════════════════════

@router.post("/{oid}/seguimiento")
def agregar_seguimiento(oid: int, body: SeguimientoIn, u=Depends(get_current_user)):
    orden = query_one("SELECT id FROM srv_ordenes WHERE id=%s", (oid,))
    if not orden:
        raise HTTPException(404, "Orden no encontrada")

    tipos_validos = ["NOTA", "DIAGNOSTICO", "REPARACION", "REPUESTO", "CONTACTO_CLIENTE", "FOTO"]
    tipo = body.tipo.upper()
    if tipo not in tipos_validos:
        tipo = "NOTA"

    seg_id = insert("""
        INSERT INTO srv_seguimientos
            (orden_id, usuario_id, fecha, tipo, descripcion)
        VALUES (%s, %s, NOW(), %s, %s)
    """, (oid, u["id"], tipo, body.descripcion))

    # If tipo is DIAGNOSTICO, update diagnostico field
    if tipo == "DIAGNOSTICO":
        execute("UPDATE srv_ordenes SET diagnostico=%s WHERE id=%s", (body.descripcion, oid))
    elif tipo == "REPARACION":
        execute("UPDATE srv_ordenes SET solucion=%s WHERE id=%s", (body.descripcion, oid))

    return {"id": seg_id, "msg": "Seguimiento agregado"}


# ══════════════════════════════════════════════════════════════
#  GENERAR PDF / INFORME
# ══════════════════════════════════════════════════════════════

def _generar_pdf_orden(oid: int) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    orden = query_one("""
        SELECT o.*,
               c.razon_social    AS cliente_nombre,
               c.identificacion  AS cliente_ruc,
               c.telefono        AS cliente_telefono,
               c.email           AS cliente_email,
               c.direccion       AS cliente_direccion,
               t.nombre          AS tecnico_nombre,
               usr.nombre        AS usuario_nombre,
               emp.razon_social  AS empresa_nombre,
               emp.ruc           AS empresa_ruc,
               emp.direccion     AS empresa_dir,
               emp.telefono      AS empresa_telefono
        FROM srv_ordenes o
        JOIN ven_clientes c         ON c.id = o.cliente_id
        LEFT JOIN srv_tecnicos t    ON t.id = o.tecnico_id
        LEFT JOIN sys_usuarios usr  ON usr.id = o.usuario_id
        LEFT JOIN sys_empresas emp  ON emp.activa = true
        WHERE o.id = %s LIMIT 1
    """, (oid,))
    if not orden:
        return b""

    seguimientos = query("""
        SELECT s.*, usr.nombre AS usuario_nombre
        FROM srv_seguimientos s
        LEFT JOIN sys_usuarios usr ON usr.id = s.usuario_id
        WHERE s.orden_id = %s
        ORDER BY s.fecha ASC, s.id ASC
    """, (oid,))

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=18*mm, rightMargin=18*mm,
                            topMargin=18*mm, bottomMargin=18*mm)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle("TitleOST", parent=styles["Heading1"],
                                  fontSize=16, spaceAfter=4,
                                  textColor=colors.HexColor("#1E3A5F"))
    normal = styles["Normal"]
    small = ParagraphStyle("Small", parent=normal, fontSize=9, leading=12)
    section_hdr = ParagraphStyle("SecHdr", parent=normal,
                                  fontSize=11, textColor=colors.HexColor("#1E3A5F"),
                                  spaceBefore=8, spaceAfter=4)

    elems = []

    # ── Header empresa ──
    empresa = orden.get("empresa_nombre") or "EMPRESA"
    elems.append(Paragraph(f"<b>{empresa}</b>", title_style))
    elems.append(Paragraph(f"RUC: {orden.get('empresa_ruc', '')}", small))
    if orden.get("empresa_dir"):
        elems.append(Paragraph(f"Dir: {orden['empresa_dir']}", small))
    if orden.get("empresa_telefono"):
        elems.append(Paragraph(f"Tel: {orden['empresa_telefono']}", small))
    elems.append(Spacer(1, 6*mm))

    # ── Titulo orden ──
    elems.append(Paragraph(
        f"<b>ORDEN DE SERVICIO TECNICO N.deg {orden['numero']}</b>",
        ParagraphStyle("OSTNum", parent=normal, fontSize=14,
                       textColor=colors.HexColor("#2563EB"))))
    elems.append(Spacer(1, 3*mm))

    # ── Info general ──
    fecha_ing = str(orden.get("fecha_ingreso", ""))[:16]
    fecha_est = str(orden.get("fecha_estimada", "")) or "-"
    fecha_cierre = str(orden.get("fecha_cierre", "") or "-")[:16]
    info_data = [
        ["Fecha Ingreso:", fecha_ing, "Estado:", orden.get("estado", "")],
        ["Fecha Estimada:", fecha_est, "Prioridad:", orden.get("prioridad", "")],
        ["Fecha Cierre:", fecha_cierre, "Tecnico:", orden.get("tecnico_nombre") or "-"],
        ["Recibido por:", orden.get("usuario_nombre") or "-", "", ""],
    ]
    info_t = Table(info_data, colWidths=[85, 140, 60, 120])
    info_t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.gray),
        ("TEXTCOLOR", (2, 0), (2, -1), colors.gray),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
        ("FONTNAME", (3, 0), (3, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elems.append(info_t)
    elems.append(Spacer(1, 4*mm))

    # ── Cliente ──
    elems.append(Paragraph("<b>DATOS DEL CLIENTE</b>", section_hdr))
    cli_data = [
        ["Nombre:", orden.get("cliente_nombre", ""), "RUC/CI:", orden.get("cliente_ruc", "")],
        ["Telefono:", orden.get("cliente_telefono") or "-", "Email:", orden.get("cliente_email") or "-"],
        ["Direccion:", orden.get("cliente_direccion") or "-", "", ""],
    ]
    cli_t = Table(cli_data, colWidths=[60, 180, 50, 120])
    cli_t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.gray),
        ("TEXTCOLOR", (2, 0), (2, -1), colors.gray),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elems.append(cli_t)
    elems.append(Spacer(1, 4*mm))

    # ── Equipo ──
    elems.append(Paragraph("<b>DATOS DEL EQUIPO</b>", section_hdr))
    eq_data = [
        ["Tipo:", orden.get("equipo_tipo", ""), "Marca:", orden.get("equipo_marca", "")],
        ["Modelo:", orden.get("equipo_modelo", ""), "Color:", orden.get("equipo_color") or "-"],
        ["N. Serie:", orden.get("equipo_serie") or "-", "Password:", orden.get("equipo_password") or "-"],
    ]
    eq_t = Table(eq_data, colWidths=[55, 180, 55, 120])
    eq_t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.gray),
        ("TEXTCOLOR", (2, 0), (2, -1), colors.gray),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elems.append(eq_t)

    if orden.get("accesorios"):
        elems.append(Paragraph(f"<b>Accesorios:</b> {orden['accesorios']}", small))
    elems.append(Spacer(1, 4*mm))

    # ── Problema / Diagnostico / Solucion ──
    elems.append(Paragraph("<b>PROBLEMA REPORTADO</b>", section_hdr))
    elems.append(Paragraph(orden.get("problema_reportado", ""), small))

    if orden.get("diagnostico"):
        elems.append(Paragraph("<b>DIAGNOSTICO</b>", section_hdr))
        elems.append(Paragraph(orden["diagnostico"], small))

    if orden.get("solucion"):
        elems.append(Paragraph("<b>SOLUCION APLICADA</b>", section_hdr))
        elems.append(Paragraph(orden["solucion"], small))

    elems.append(Spacer(1, 4*mm))

    # ── Costos ──
    elems.append(Paragraph("<b>COSTOS</b>", section_hdr))
    fmt = lambda v: f"${float(v or 0):,.2f}"
    costo_data = [
        ["Costo Estimado:", fmt(orden.get("costo_estimado")),
         "Anticipo:", fmt(orden.get("anticipo"))],
        ["Costo Final:", fmt(orden.get("costo_final")),
         "Saldo:", fmt(float(orden.get("costo_final") or 0) - float(orden.get("anticipo") or 0))],
    ]
    cost_t = Table(costo_data, colWidths=[85, 100, 55, 100])
    cost_t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.gray),
        ("TEXTCOLOR", (2, 0), (2, -1), colors.gray),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
        ("FONTNAME", (3, 0), (3, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elems.append(cost_t)
    elems.append(Spacer(1, 5*mm))

    # ── Repuestos ──
    repuestos = query("""
        SELECT * FROM srv_repuestos_usados WHERE orden_id=%s ORDER BY id ASC
    """, (oid,))
    if repuestos:
        elems.append(Paragraph("<b>REPUESTOS / PARTES USADAS</b>", section_hdr))
        rep_data = [["Descripcion", "Cant.", "Precio", "Total"]]
        total_rep = 0
        for r in repuestos:
            cant = float(r.get("cantidad") or 0)
            precio = float(r.get("precio") or 0)
            total_r = cant * precio
            total_rep += total_r
            rep_data.append([
                r.get("descripcion", ""),
                f"{cant:g}",
                fmt(precio),
                fmt(total_r),
            ])
        rep_data.append(["", "", "TOTAL:", fmt(total_rep)])
        rep_t = Table(rep_data, colWidths=[220, 40, 70, 80])
        rep_t.setStyle(TableStyle([
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F3F4F6")),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.gray),
            ("FONTNAME", (2, -1), (-1, -1), "Helvetica-Bold"),
            ("LINEABOVE", (0, -1), (-1, -1), 0.5, colors.gray),
        ]))
        elems.append(rep_t)
        elems.append(Spacer(1, 4*mm))

    # ── Timeline seguimientos ──
    if seguimientos:
        elems.append(Paragraph("<b>HISTORIAL DE SEGUIMIENTO</b>", section_hdr))
        for seg in seguimientos:
            fecha_s = str(seg.get("fecha", ""))[:16]
            tipo_s  = seg.get("tipo", "NOTA")
            user_s  = seg.get("usuario_nombre", "")
            desc_s  = seg.get("descripcion", "")
            estado_txt = ""
            if seg.get("estado_anterior") and seg.get("estado_nuevo"):
                estado_txt = f" [{seg['estado_anterior']} -> {seg['estado_nuevo']}]"
            elems.append(Paragraph(
                f"<b>{fecha_s}</b> | {tipo_s}{estado_txt} | {user_s}<br/>{desc_s}",
                ParagraphStyle("SegItem", parent=small, fontSize=8, leading=11,
                               leftIndent=10, spaceBefore=2, spaceAfter=2,
                               borderPadding=4)
            ))
        elems.append(Spacer(1, 6*mm))

    # ── Observaciones ──
    if orden.get("observaciones"):
        elems.append(Paragraph("<b>Observaciones:</b>", small))
        elems.append(Paragraph(orden["observaciones"], small))
        elems.append(Spacer(1, 4*mm))

    # ── Firmas ──
    elems.append(Spacer(1, 15*mm))
    firma_data = [
        ["_________________________", "", "_________________________"],
        ["Tecnico Responsable", "", "Cliente"],
        [orden.get("tecnico_nombre") or "", "", orden.get("cliente_nombre") or ""],
    ]
    firma_t = Table(firma_data, colWidths=[170, 60, 170])
    firma_t.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTSIZE", (0, 1), (-1, 1), 8),
        ("TEXTCOLOR", (0, 1), (-1, 1), colors.gray),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    elems.append(firma_t)

    # ── Pie ──
    elems.append(Spacer(1, 8*mm))
    elems.append(Paragraph(
        "Documento generado automaticamente - Orden de Servicio Tecnico",
        ParagraphStyle("Footer", parent=small, fontSize=7, textColor=colors.gray,
                       alignment=1)
    ))

    doc.build(elems)
    return buf.getvalue()


@router.get("/{oid}/informe")
def descargar_informe(oid: int, u=Depends(get_current_user)):
    orden = query_one("SELECT numero FROM srv_ordenes WHERE id=%s", (oid,))
    if not orden:
        raise HTTPException(404, "Orden no encontrada")

    pdf_bytes = _generar_pdf_orden(oid)
    if not pdf_bytes:
        raise HTTPException(500, "Error generando PDF")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="OrdenServicio_{orden["numero"]}.pdf"'
        },
    )


# ══════════════════════════════════════════════════════════════
#  RECIBO DE RECEPCION PDF
# ══════════════════════════════════════════════════════════════

def _generar_pdf_recibo_recepcion(oid: int) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    orden = query_one("""
        SELECT o.*,
               c.razon_social    AS cliente_nombre,
               c.identificacion  AS cliente_ruc,
               c.telefono        AS cliente_telefono,
               c.email           AS cliente_email,
               c.direccion       AS cliente_direccion,
               t.nombre          AS tecnico_nombre,
               usr.nombre        AS usuario_nombre,
               emp.razon_social  AS empresa_nombre,
               emp.ruc           AS empresa_ruc,
               emp.direccion     AS empresa_dir,
               emp.telefono      AS empresa_telefono
        FROM srv_ordenes o
        JOIN ven_clientes c         ON c.id = o.cliente_id
        LEFT JOIN srv_tecnicos t    ON t.id = o.tecnico_id
        LEFT JOIN sys_usuarios usr  ON usr.id = o.usuario_id
        LEFT JOIN sys_empresas emp  ON emp.activa = true
        WHERE o.id = %s LIMIT 1
    """, (oid,))
    if not orden:
        return b""

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=18*mm, rightMargin=18*mm,
                            topMargin=18*mm, bottomMargin=18*mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("TitleRec", parent=styles["Heading1"],
                                  fontSize=16, spaceAfter=4,
                                  textColor=colors.HexColor("#1E3A5F"), alignment=1)
    normal = styles["Normal"]
    small = ParagraphStyle("Small", parent=normal, fontSize=9, leading=12)
    center = ParagraphStyle("Center", parent=small, alignment=1)
    section_hdr = ParagraphStyle("SecHdr", parent=normal,
                                  fontSize=11, textColor=colors.HexColor("#1E3A5F"),
                                  spaceBefore=8, spaceAfter=4)

    elems = []
    fmt = lambda v: f"${float(v or 0):,.2f}"

    # ── Header empresa ──
    empresa = orden.get("empresa_nombre") or "EMPRESA"
    elems.append(Paragraph(f"<b>{empresa}</b>", title_style))
    elems.append(Paragraph(f"RUC: {orden.get('empresa_ruc', '')}", center))
    if orden.get("empresa_dir"):
        elems.append(Paragraph(f"{orden['empresa_dir']}", center))
    if orden.get("empresa_telefono"):
        elems.append(Paragraph(f"Tel: {orden['empresa_telefono']}", center))
    elems.append(Spacer(1, 6*mm))

    # ── Titulo ──
    elems.append(Paragraph(
        "<b>RECIBO DE RECEPCION DE EQUIPO</b>",
        ParagraphStyle("ReciboTitle", parent=normal, fontSize=14, alignment=1,
                       textColor=colors.HexColor("#2563EB"))))
    elems.append(Spacer(1, 4*mm))

    # ── Orden info ──
    fecha_ing = str(orden.get("fecha_ingreso", ""))[:16]
    info_data = [
        ["Orden N.:", orden.get("numero", "")],
        ["Fecha de Recepcion:", fecha_ing],
        ["Recibido por:", orden.get("usuario_nombre") or "-"],
    ]
    info_t = Table(info_data, colWidths=[120, 300])
    info_t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.gray),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elems.append(info_t)
    elems.append(Spacer(1, 4*mm))

    # ── Cliente ──
    elems.append(Paragraph("<b>DATOS DEL CLIENTE</b>", section_hdr))
    cli_data = [
        ["Nombre:", orden.get("cliente_nombre", ""), "RUC/CI:", orden.get("cliente_ruc", "")],
        ["Telefono:", orden.get("cliente_telefono") or "-", "Email:", orden.get("cliente_email") or "-"],
        ["Direccion:", orden.get("cliente_direccion") or "-", "", ""],
    ]
    cli_t = Table(cli_data, colWidths=[60, 180, 50, 120])
    cli_t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.gray),
        ("TEXTCOLOR", (2, 0), (2, -1), colors.gray),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elems.append(cli_t)
    elems.append(Spacer(1, 4*mm))

    # ── Equipo ──
    elems.append(Paragraph("<b>DATOS DEL EQUIPO</b>", section_hdr))
    eq_data = [
        ["Tipo:", orden.get("equipo_tipo", ""), "Marca:", orden.get("equipo_marca", "")],
        ["Modelo:", orden.get("equipo_modelo", ""), "Color:", orden.get("equipo_color") or "-"],
        ["N. Serie:", orden.get("equipo_serie") or "-", "Password:", orden.get("equipo_password") or "-"],
    ]
    eq_t = Table(eq_data, colWidths=[55, 180, 55, 120])
    eq_t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.gray),
        ("TEXTCOLOR", (2, 0), (2, -1), colors.gray),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elems.append(eq_t)

    if orden.get("accesorios"):
        elems.append(Spacer(1, 2*mm))
        elems.append(Paragraph(f"<b>Accesorios entregados:</b> {orden['accesorios']}", small))
    elems.append(Spacer(1, 4*mm))

    # ── Problema reportado ──
    elems.append(Paragraph("<b>PROBLEMA REPORTADO</b>", section_hdr))
    elems.append(Paragraph(orden.get("problema_reportado", ""), small))
    elems.append(Spacer(1, 4*mm))

    # ── Costos ──
    costo_est = float(orden.get("costo_estimado") or 0)
    anticipo_val = float(orden.get("anticipo") or 0)
    if costo_est > 0 or anticipo_val > 0:
        elems.append(Paragraph("<b>ESTIMACION DE COSTOS</b>", section_hdr))
        cost_data = [
            ["Costo Estimado:", fmt(costo_est)],
            ["Anticipo Recibido:", fmt(anticipo_val)],
        ]
        cost_t = Table(cost_data, colWidths=[120, 120])
        cost_t.setStyle(TableStyle([
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("TEXTCOLOR", (0, 0), (0, -1), colors.gray),
            ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        elems.append(cost_t)
        elems.append(Spacer(1, 4*mm))

    # ── Condiciones de recepcion ──
    condiciones = orden.get("condiciones_recepcion") or (
        "El cliente acepta que los trabajos se realizaran bajo previo diagnostico. "
        "El plazo estimado puede variar segun disponibilidad de repuestos."
    )
    elems.append(Paragraph("<b>TERMINOS Y CONDICIONES</b>", section_hdr))
    elems.append(Paragraph(condiciones, ParagraphStyle(
        "Cond", parent=small, fontSize=8, leading=11, textColor=colors.gray)))
    elems.append(Spacer(1, 3*mm))
    cond_items = [
        "1. El equipo sera diagnosticado antes de proceder con la reparacion.",
        "2. Si no se aprueba el presupuesto, se cobrara unicamente el diagnostico.",
        "3. No nos hacemos responsables por equipos no retirados despues de 90 dias.",
        "4. La garantia aplica unicamente sobre la reparacion realizada.",
        "5. El anticipo no es reembolsable una vez iniciado el diagnostico.",
    ]
    for item in cond_items:
        elems.append(Paragraph(item, ParagraphStyle(
            "CondItem", parent=small, fontSize=8, leading=10, textColor=colors.gray,
            leftIndent=10)))
    elems.append(Spacer(1, 6*mm))

    # ── Firmas ──
    elems.append(Spacer(1, 10*mm))
    firma_data = [
        ["_________________________", "", "_________________________"],
        ["Tecnico / Receptor", "", "Cliente"],
        [orden.get("tecnico_nombre") or orden.get("usuario_nombre") or "", "", orden.get("cliente_nombre") or ""],
    ]
    firma_t = Table(firma_data, colWidths=[170, 60, 170])
    firma_t.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTSIZE", (0, 1), (-1, 1), 8),
        ("TEXTCOLOR", (0, 1), (-1, 1), colors.gray),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    elems.append(firma_t)

    # ── Pie ──
    elems.append(Spacer(1, 8*mm))
    elems.append(Paragraph(
        "Recibo de recepcion - Servicio Tecnico - Documento generado automaticamente",
        ParagraphStyle("Footer", parent=small, fontSize=7, textColor=colors.gray,
                       alignment=1)
    ))

    doc.build(elems)
    return buf.getvalue()


@router.get("/{oid}/recibo-recepcion")
def descargar_recibo_recepcion(oid: int, u=Depends(get_current_user)):
    orden = query_one("SELECT numero FROM srv_ordenes WHERE id=%s", (oid,))
    if not orden:
        raise HTTPException(404, "Orden no encontrada")

    pdf_bytes = _generar_pdf_recibo_recepcion(oid)
    if not pdf_bytes:
        raise HTTPException(500, "Error generando recibo de recepcion PDF")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="Recibo_Recepcion_{orden["numero"]}.pdf"'
        },
    )


# ══════════════════════════════════════════════════════════════
#  ELIMINAR ORDEN
# ══════════════════════════════════════════════════════════════

@router.delete("/{oid}")
def eliminar_orden(oid: int, u=Depends(get_current_user)):
    orden = query_one("SELECT estado FROM srv_ordenes WHERE id=%s", (oid,))
    if not orden:
        raise HTTPException(404, "Orden no encontrada")
    if orden["estado"] != "RECIBIDO":
        raise HTTPException(400, "Solo se puede eliminar ordenes en estado RECIBIDO")

    execute("DELETE FROM srv_repuestos_usados WHERE orden_id=%s", (oid,))
    execute("DELETE FROM srv_seguimientos WHERE orden_id=%s", (oid,))
    execute("DELETE FROM srv_ordenes WHERE id=%s", (oid,))
    return {"msg": "Orden eliminada"}


# ══════════════════════════════════════════════════════════════
#  REGISTRAR ANTICIPO
# ══════════════════════════════════════════════════════════════

@router.post("/{oid}/anticipo")
def registrar_anticipo(oid: int, body: AnticipoIn, u=Depends(get_current_user)):
    orden = query_one("SELECT id, cliente_id, anticipo, numero FROM srv_ordenes WHERE id=%s", (oid,))
    if not orden:
        raise HTTPException(404, "Orden no encontrada")
    if body.monto <= 0:
        raise HTTPException(400, "El monto debe ser mayor a 0")

    # Create record in fin_saldos_favor
    sf_id = insert("""
        INSERT INTO fin_saldos_favor
            (cliente_id, orden_servicio_id, tipo, monto, saldo, referencia, fecha, usuario_id)
        VALUES (%s, %s, 'ANTICIPO', %s, %s, %s, NOW(), %s)
    """, (orden["cliente_id"], oid, body.monto, body.monto,
          body.referencia or f"{body.forma_pago} - Orden {orden['numero']}", u["id"]))

    # Update anticipo on the order (add to existing)
    nuevo_anticipo = float(orden.get("anticipo") or 0) + body.monto
    execute("UPDATE srv_ordenes SET anticipo=%s WHERE id=%s", (nuevo_anticipo, oid))

    # Create seguimiento entry
    insert("""
        INSERT INTO srv_seguimientos
            (orden_id, usuario_id, fecha, tipo, descripcion)
        VALUES (%s, %s, NOW(), 'NOTA', %s)
    """, (oid, u["id"], f"Anticipo recibido: ${body.monto:,.2f} ({body.forma_pago})"))

    return {"id": sf_id, "monto": body.monto, "anticipo_total": nuevo_anticipo,
            "msg": "Anticipo registrado correctamente"}


# ══════════════════════════════════════════════════════════════
#  RECIBO ANTICIPO PDF
# ══════════════════════════════════════════════════════════════

def _generar_pdf_recibo_anticipo(oid: int) -> bytes:
    from reportlab.lib.pagesizes import A5
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    orden = query_one("""
        SELECT o.*,
               c.razon_social    AS cliente_nombre,
               c.identificacion  AS cliente_ruc,
               c.telefono        AS cliente_telefono,
               emp.razon_social  AS empresa_nombre,
               emp.ruc           AS empresa_ruc,
               emp.direccion     AS empresa_dir,
               emp.telefono      AS empresa_telefono
        FROM srv_ordenes o
        JOIN ven_clientes c         ON c.id = o.cliente_id
        LEFT JOIN sys_empresas emp  ON emp.activa = true
        WHERE o.id = %s LIMIT 1
    """, (oid,))
    if not orden:
        return b""

    # Get last anticipo record
    ultimo_anticipo = query_one("""
        SELECT * FROM fin_saldos_favor
        WHERE orden_servicio_id=%s AND tipo='ANTICIPO'
        ORDER BY fecha DESC LIMIT 1
    """, (oid,))

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A5,
                            leftMargin=14*mm, rightMargin=14*mm,
                            topMargin=14*mm, bottomMargin=14*mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Title", parent=styles["Heading1"],
                                  fontSize=14, spaceAfter=2,
                                  textColor=colors.HexColor("#1E3A5F"),
                                  alignment=1)
    normal = styles["Normal"]
    small = ParagraphStyle("Small", parent=normal, fontSize=9, leading=12)
    center = ParagraphStyle("Center", parent=small, alignment=1)

    elems = []

    empresa = orden.get("empresa_nombre") or "EMPRESA"
    elems.append(Paragraph(f"<b>{empresa}</b>", title_style))
    elems.append(Paragraph(f"RUC: {orden.get('empresa_ruc', '')}", center))
    if orden.get("empresa_dir"):
        elems.append(Paragraph(f"{orden['empresa_dir']}", center))
    elems.append(Spacer(1, 6*mm))

    elems.append(Paragraph("<b>RECIBO DE ANTICIPO</b>",
        ParagraphStyle("Recibo", parent=normal, fontSize=13, alignment=1,
                       textColor=colors.HexColor("#2563EB"))))
    elems.append(Spacer(1, 4*mm))

    fmt = lambda v: f"${float(v or 0):,.2f}"
    fecha_str = str(ultimo_anticipo.get("fecha", ""))[:16] if ultimo_anticipo else "-"

    info_data = [
        ["Orden N.:", orden.get("numero", "")],
        ["Cliente:", orden.get("cliente_nombre", "")],
        ["RUC/CI:", orden.get("cliente_ruc", "")],
        ["Equipo:", f"{orden.get('equipo_tipo', '')} {orden.get('equipo_marca', '')} {orden.get('equipo_modelo', '')}"],
        ["Fecha:", fecha_str],
    ]
    info_t = Table(info_data, colWidths=[70, 200])
    info_t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.gray),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elems.append(info_t)
    elems.append(Spacer(1, 5*mm))

    monto_anticipo = float(ultimo_anticipo.get("monto", 0)) if ultimo_anticipo else 0
    ref = (ultimo_anticipo.get("referencia") or "-") if ultimo_anticipo else "-"
    anticipo_total = float(orden.get("anticipo") or 0)
    costo_est = float(orden.get("costo_estimado") or 0)
    costo_fin = float(orden.get("costo_final") or 0)
    saldo = max(0, (costo_fin if costo_fin > 0 else costo_est) - anticipo_total)

    cost_data = [
        ["Monto recibido:", fmt(monto_anticipo)],
        ["Forma de pago:", ref],
        ["", ""],
        ["Total anticipo acumulado:", fmt(anticipo_total)],
        ["Costo estimado:", fmt(costo_est)],
        ["Saldo pendiente:", fmt(saldo)],
    ]
    cost_t = Table(cost_data, colWidths=[140, 130])
    cost_t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.gray),
        ("FONTNAME", (1, 0), (1, 0), "Helvetica-Bold"),
        ("FONTNAME", (1, 3), (1, 5), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 12),
        ("FONTSIZE", (1, 0), (1, 0), 14),
        ("TEXTCOLOR", (1, 0), (1, 0), colors.HexColor("#10B981")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 1), (-1, 1), 0.5, colors.gray),
        ("LINEBELOW", (0, 4), (-1, 4), 0.5, colors.gray),
    ]))
    elems.append(cost_t)
    elems.append(Spacer(1, 10*mm))

    elems.append(Paragraph("_________________________", center))
    elems.append(Paragraph("Firma / Sello", center))
    elems.append(Spacer(1, 6*mm))
    elems.append(Paragraph(
        "Este recibo no constituye factura. Documento generado automaticamente.",
        ParagraphStyle("Footer", parent=small, fontSize=7, textColor=colors.gray,
                       alignment=1)))

    doc.build(elems)
    return buf.getvalue()


@router.get("/{oid}/recibo-anticipo")
def descargar_recibo_anticipo(oid: int, u=Depends(get_current_user)):
    orden = query_one("SELECT numero FROM srv_ordenes WHERE id=%s", (oid,))
    if not orden:
        raise HTTPException(404, "Orden no encontrada")

    pdf_bytes = _generar_pdf_recibo_anticipo(oid)
    if not pdf_bytes:
        raise HTTPException(500, "Error generando recibo PDF")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="Recibo_Anticipo_{orden["numero"]}.pdf"'
        },
    )


# ══════════════════════════════════════════════════════════════
#  NOTIFICAR CLIENTE (WhatsApp / Email manual)
# ══════════════════════════════════════════════════════════════

@router.post("/{oid}/notificar")
def notificar_cliente(oid: int, canal: str = 'WHATSAPP', mensaje: str = '', u=Depends(get_current_user)):
    """Manually notify client about their order."""
    orden = query_one("""
        SELECT o.numero, c.razon_social, c.telefono, c.email
        FROM srv_ordenes o JOIN ven_clientes c ON c.id=o.cliente_id WHERE o.id=%s
    """, (oid,))
    if not orden:
        raise HTTPException(404, "Orden no encontrada")

    if canal == 'WHATSAPP' and orden.get('telefono'):
        tel = orden['telefono'].replace(' ', '').replace('-', '')
        if tel.startswith('0'):
            tel = '593' + tel[1:]
        default_msg = f"Orden {orden['numero']}"
        link = f"https://wa.me/{tel}?text={urllib.parse.quote(mensaje or default_msg)}"
        insert("INSERT INTO srv_seguimientos (orden_id,usuario_id,fecha,tipo,descripcion) VALUES (%s,%s,NOW(),'CONTACTO_CLIENTE',%s)",
               (oid, u['id'], f"WhatsApp: {mensaje[:200]}"))
        return {"canal": "WHATSAPP", "link": link}

    elif canal == 'EMAIL' and orden.get('email'):
        from sri.email_sender import enviar_comprobante_email
        result = enviar_comprobante_email(orden['email'], orden['razon_social'],
            f"Orden {orden['numero']}", f"<p>{mensaje}</p>")
        insert("INSERT INTO srv_seguimientos (orden_id,usuario_id,fecha,tipo,descripcion) VALUES (%s,%s,NOW(),'CONTACTO_CLIENTE',%s)",
               (oid, u['id'], f"Email: {mensaje[:200]}"))
        return {"canal": "EMAIL", **(result if isinstance(result, dict) else {"ok": True})}

    raise HTTPException(400, "El cliente no tiene telefono/email registrado")


# ══════════════════════════════════════════════════════════════
#  FACTURAR ORDEN
# ══════════════════════════════════════════════════════════════

@router.post("/{oid}/facturar")
def facturar_orden(oid: int, forma_pago: str = 'EFECTIVO', u=Depends(get_current_user)):
    """Create an invoice from a service order."""
    orden = query_one("""
        SELECT o.*, c.razon_social FROM srv_ordenes o
        JOIN ven_clientes c ON c.id=o.cliente_id WHERE o.id=%s
    """, (oid,))
    if not orden:
        raise HTTPException(404, "Orden no encontrada")
    if orden['estado'] not in ('REPARADO', 'ENTREGADO'):
        raise HTTPException(400, "Solo se pueden facturar ordenes REPARADO o ENTREGADO")

    costo = float(orden.get('costo_final') or orden.get('costo_estimado') or 0)
    anticipo = float(orden.get('anticipo') or 0)
    saldo = max(0, costo - anticipo)

    if saldo <= 0:
        return {"msg": "No hay saldo por facturar (anticipo cubre el total)", "saldo": 0}

    # Get repuestos as invoice details
    repuestos = query("SELECT * FROM srv_repuestos_usados WHERE orden_id=%s", (oid,))

    detalles = []
    total_rep = 0
    for r in repuestos:
        precio = float(r.get('precio') or r.get('costo') or 0)
        cant = float(r.get('cantidad') or 1)
        total_rep += precio * cant
        detalles.append({
            "producto_id": r.get('producto_id') or 0,
            "descripcion": r.get('descripcion', 'Repuesto'),
            "cantidad": cant,
            "precio_unitario": precio,
            "iva_porcentaje": 15,
        })

    # Add labor as a line
    mano_obra = saldo - total_rep
    if mano_obra > 0:
        detalles.append({
            "producto_id": 0,
            "descripcion": f"Servicio tecnico - Orden {orden['numero']}",
            "cantidad": 1,
            "precio_unitario": mano_obra,
            "iva_porcentaje": 15,
        })

    if not detalles:
        detalles.append({
            "producto_id": 0,
            "descripcion": f"Reparacion - Orden {orden['numero']}",
            "cantidad": 1,
            "precio_unitario": saldo,
            "iva_porcentaje": 15,
        })

    # Create invoice via facturas router
    from routers.facturas import crear_factura, FacturaIn
    body = FacturaIn(
        cliente_id=orden['cliente_id'],
        sucursal_id=orden.get('sucursal_id'),
        observaciones=f"Orden de servicio: {orden['numero']}",
        descuento_global_pct=0,
        detalles=detalles,
        pagos=[{"forma_pago": forma_pago, "monto": saldo}]
    )
    result = crear_factura(body, u)

    # Link invoice to order
    try:
        execute("UPDATE srv_ordenes SET factura_id=%s WHERE id=%s", (result['id'], oid))
    except Exception:
        pass

    return {**result, "orden": orden['numero'], "saldo_facturado": saldo}


# ══════════════════════════════════════════════════════════════
#  COTIZACION PDF
# ══════════════════════════════════════════════════════════════

@router.get("/{oid}/cotizacion-pdf")
def cotizacion_reparacion_pdf(oid: int, u=Depends(get_current_user)):
    """Generate a repair quotation PDF to send to client for approval."""
    orden = query_one("""
        SELECT o.*, c.razon_social, c.identificacion, c.telefono, c.email, c.direccion,
               t.nombre as tecnico_nombre, t.apellidos as tecnico_apellidos,
               emp.razon_social as empresa_nombre, emp.ruc as empresa_ruc
        FROM srv_ordenes o
        JOIN ven_clientes c ON c.id=o.cliente_id
        LEFT JOIN srv_tecnicos t ON t.id=o.tecnico_id
        LEFT JOIN sys_empresas emp ON emp.activa=true
        WHERE o.id=%s
    """, (oid,))
    if not orden:
        raise HTTPException(404, "Orden no encontrada")

    repuestos = query("SELECT * FROM srv_repuestos_usados WHERE orden_id=%s", (oid,))

    # Generate PDF with reportlab
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm, cm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=2*cm, rightMargin=2*cm,
                            topMargin=1.5*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    elements = []

    elements.append(Paragraph(f"<b>{orden.get('empresa_nombre','')}</b>", styles["Title"]))
    elements.append(Paragraph(f"RUC: {orden.get('empresa_ruc','')}", styles["Normal"]))
    elements.append(Spacer(1, 8*mm))
    elements.append(Paragraph("<b>COTIZACION DE REPARACION</b>", styles["Heading1"]))
    elements.append(Paragraph(f"Orden: {orden['numero']}", styles["Normal"]))
    elements.append(Spacer(1, 5*mm))

    # Client + device info
    info = [
        ["Cliente:", orden.get('razon_social', '')],
        ["Equipo:", f"{orden.get('equipo_tipo','')} {orden.get('equipo_marca','')} {orden.get('equipo_modelo','')}"],
        ["Problema:", (orden.get('problema_reportado','') or '')[:100]],
        ["Diagnostico:", (orden.get('diagnostico','') or '')[:100]],
    ]
    t = Table(info, colWidths=[80, 350])
    t.setStyle(TableStyle([("FONTSIZE",(0,0),(-1,-1),9), ("FONTNAME",(0,0),(0,-1),"Helvetica-Bold")]))
    elements.append(t)
    elements.append(Spacer(1, 8*mm))

    # Repuestos table
    if repuestos:
        elements.append(Paragraph("<b>REPUESTOS / PARTES</b>", styles["Heading3"]))
        data = [["Descripcion","Cant.","Precio","Total"]]
        total_rep = 0
        for r in repuestos:
            total_line = float(r.get('cantidad',1)) * float(r.get('precio',0))
            total_rep += total_line
            data.append([r.get('descripcion',''), f"{float(r.get('cantidad',1)):.0f}",
                         f"${float(r.get('precio',0)):.2f}", f"${total_line:.2f}"])
        data.append(["","","Subtotal:", f"${total_rep:.2f}"])

        t2 = Table(data, colWidths=[220, 50, 70, 80])
        t2.setStyle(TableStyle([
            ("FONTSIZE",(0,0),(-1,-1),9), ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),
            ("GRID",(0,0),(-1,-1),0.3,colors.grey), ("BACKGROUND",(0,0),(-1,0),colors.HexColor("#e2e8f0")),
            ("FONTNAME",(0,-1),(-1,-1),"Helvetica-Bold"), ("ALIGN",(1,0),(-1,-1),"RIGHT"),
        ]))
        elements.append(t2)
        elements.append(Spacer(1, 5*mm))

    # Total
    costo = float(orden.get('costo_estimado',0))
    elements.append(Paragraph(f"<b>COSTO ESTIMADO TOTAL: ${costo:.2f}</b>", styles["Heading2"]))
    elements.append(Spacer(1, 10*mm))
    elements.append(Paragraph("Esta cotizacion tiene una validez de 15 dias.", styles["Normal"]))
    elements.append(Spacer(1, 15*mm))

    # Approval signature
    elements.append(Paragraph("APROBACION DEL CLIENTE:", styles["Normal"]))
    elements.append(Spacer(1, 15*mm))
    sig = [["_"*30, "_"*15], ["Firma", "Fecha"]]
    t3 = Table(sig, colWidths=[200, 150])
    t3.setStyle(TableStyle([("ALIGN",(0,0),(-1,-1),"CENTER"), ("FONTSIZE",(0,0),(-1,-1),9)]))
    elements.append(t3)

    doc.build(elements)

    return Response(content=buf.getvalue(), media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Cotizacion_{orden["numero"]}.pdf"'})
