from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from database import query, query_one, execute, insert, db
from auth import get_current_user
from typing import Optional
from pydantic import BaseModel
from datetime import date, datetime
from urllib.parse import quote
import json

router = APIRouter(prefix="/api/crm", tags=["CRM"])


# ── Pydantic Models ─────────────────────────────────────────

class EtapaIn(BaseModel):
    nombre: str
    color: str = "#3B82F6"
    orden: int = 0
    es_ganada: bool = False
    es_perdida: bool = False
    activa: bool = True

class OportunidadIn(BaseModel):
    titulo: str
    cliente_id: int
    vendedor_id: Optional[int] = None
    etapa_id: Optional[int] = None
    valor_estimado: float = 0
    probabilidad: int = 50
    fecha_cierre_estimada: Optional[str] = None
    fuente: Optional[str] = None
    notas: Optional[str] = None

class CambioEtapaIn(BaseModel):
    etapa_id: int

class ActividadIn(BaseModel):
    oportunidad_id: Optional[int] = None
    cliente_id: Optional[int] = None
    tipo: str  # LLAMADA, EMAIL, REUNION, WHATSAPP, TAREA, SEGUIMIENTO
    titulo: str
    descripcion: Optional[str] = None
    fecha_programada: Optional[str] = None

class CompletarActividadIn(BaseModel):
    resultado: Optional[str] = None
    duracion_min: int = 0

class NotaIn(BaseModel):
    oportunidad_id: Optional[int] = None
    cliente_id: Optional[int] = None
    contenido: str

class WhatsAppIn(BaseModel):
    telefono: str
    mensaje: str
    cliente_id: Optional[int] = None
    oportunidad_id: Optional[int] = None

class EmailCRMIn(BaseModel):
    destinatario: str
    asunto: str
    mensaje: str
    cliente_id: Optional[int] = None
    oportunidad_id: Optional[int] = None


# ══════════════════════════════════════════════════════════════
#  ETAPAS (Pipeline stages)
# ══════════════════════════════════════════════════════════════

@router.get("/etapas")
def listar_etapas(u=Depends(get_current_user)):
    return query("SELECT * FROM crm_etapas WHERE activa=true ORDER BY orden")

@router.post("/etapas")
def crear_etapa(d: EtapaIn, u=Depends(get_current_user)):
    eid = insert(
        """INSERT INTO crm_etapas (nombre, color, orden, es_ganada, es_perdida, activa)
           VALUES (%s,%s,%s,%s,%s,%s)""",
        (d.nombre, d.color, d.orden, d.es_ganada, d.es_perdida, d.activa)
    )
    return {"id": eid, "ok": True}

@router.put("/etapas/{eid}")
def actualizar_etapa(eid: int, d: EtapaIn, u=Depends(get_current_user)):
    execute(
        """UPDATE crm_etapas SET nombre=%s, color=%s, orden=%s,
           es_ganada=%s, es_perdida=%s, activa=%s WHERE id=%s""",
        (d.nombre, d.color, d.orden, d.es_ganada, d.es_perdida, d.activa, eid)
    )
    return {"ok": True}


# ══════════════════════════════════════════════════════════════
#  PIPELINE (Kanban view)
# ══════════════════════════════════════════════════════════════

@router.get("/pipeline")
def obtener_pipeline(u=Depends(get_current_user)):
    etapas = query("SELECT * FROM crm_etapas WHERE activa=true ORDER BY orden")
    result = []
    for et in etapas:
        opps = query("""
            SELECT o.*, c.razon_social AS cliente_nombre,
                   v.nombre AS vendedor_nombre
            FROM crm_oportunidades o
            LEFT JOIN ven_clientes c ON c.id = o.cliente_id
            LEFT JOIN ven_vendedores v ON v.id = o.vendedor_id
            WHERE o.etapa_id = %s AND o.estado = 'ABIERTA'
            ORDER BY o.updated_at DESC
        """, (et["id"],))
        total_valor = sum(float(op.get("valor_estimado") or 0) for op in opps)
        result.append({
            **et,
            "oportunidades": opps,
            "count": len(opps),
            "total_valor": round(total_valor, 2),
        })
    return result


# ══════════════════════════════════════════════════════════════
#  OPORTUNIDADES
# ══════════════════════════════════════════════════════════════

@router.get("/oportunidades")
def listar_oportunidades(
    vendedor_id: Optional[int] = None,
    etapa_id: Optional[int] = None,
    estado: Optional[str] = None,
    busqueda: Optional[str] = None,
    fecha_ini: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    u=Depends(get_current_user)
):
    sql = """
        SELECT o.*, c.razon_social AS cliente_nombre,
               v.nombre AS vendedor_nombre,
               e.nombre AS etapa_nombre, e.color AS etapa_color
        FROM crm_oportunidades o
        LEFT JOIN ven_clientes c ON c.id = o.cliente_id
        LEFT JOIN ven_vendedores v ON v.id = o.vendedor_id
        LEFT JOIN crm_etapas e ON e.id = o.etapa_id
        WHERE 1=1
    """
    params = []
    if vendedor_id:
        sql += " AND o.vendedor_id=%s"
        params.append(vendedor_id)
    if etapa_id:
        sql += " AND o.etapa_id=%s"
        params.append(etapa_id)
    if estado:
        sql += " AND o.estado=%s"
        params.append(estado)
    if busqueda:
        sql += " AND (o.titulo ILIKE %s OR c.razon_social ILIKE %s)"
        params += [f"%{busqueda}%", f"%{busqueda}%"]
    if fecha_ini:
        sql += " AND o.created_at >= %s"
        params.append(fecha_ini)
    if fecha_fin:
        sql += " AND o.created_at <= %s"
        params.append(fecha_fin + " 23:59:59")
    sql += " ORDER BY o.updated_at DESC"
    return query(sql, tuple(params))

@router.post("/oportunidades")
def crear_oportunidad(d: OportunidadIn, u=Depends(get_current_user)):
    # default etapa
    etapa = d.etapa_id
    if not etapa:
        primera = query_one("SELECT id FROM crm_etapas WHERE activa=true ORDER BY orden LIMIT 1")
        etapa = primera["id"] if primera else None
    oid = insert(
        """INSERT INTO crm_oportunidades
           (titulo, cliente_id, vendedor_id, etapa_id, valor_estimado,
            probabilidad, fecha_cierre_estimada, fuente, notas, estado)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,'ABIERTA')""",
        (d.titulo, d.cliente_id, d.vendedor_id, etapa, d.valor_estimado,
         d.probabilidad, d.fecha_cierre_estimada or None, d.fuente, d.notas)
    )
    return {"id": oid, "ok": True}

@router.get("/oportunidades/{oid}")
def detalle_oportunidad(oid: int, u=Depends(get_current_user)):
    opp = query_one("""
        SELECT o.*, c.razon_social AS cliente_nombre, c.telefono AS cliente_telefono,
               c.email AS cliente_email, c.identificacion AS cliente_identificacion,
               v.nombre AS vendedor_nombre,
               e.nombre AS etapa_nombre, e.color AS etapa_color,
               cot.numero AS cotizacion_numero, cot.total AS cotizacion_total,
               cot.estado AS cotizacion_estado
        FROM crm_oportunidades o
        LEFT JOIN ven_clientes c ON c.id = o.cliente_id
        LEFT JOIN ven_vendedores v ON v.id = o.vendedor_id
        LEFT JOIN crm_etapas e ON e.id = o.etapa_id
        LEFT JOIN ven_cotizaciones cot ON cot.id = o.cotizacion_id
        WHERE o.id = %s
    """, (oid,))
    if not opp:
        raise HTTPException(404, "Oportunidad no encontrada")
    actividades = query(
        """SELECT * FROM crm_actividades
           WHERE oportunidad_id=%s ORDER BY created_at DESC""", (oid,))
    notas = query(
        """SELECT n.*, u.nombre AS usuario_nombre
           FROM crm_notas n
           LEFT JOIN sys_usuarios u ON u.id = n.usuario_id
           WHERE n.oportunidad_id=%s ORDER BY created_at DESC""", (oid,))
    opp["actividades"] = actividades
    opp["notas"] = notas
    return opp

@router.put("/oportunidades/{oid}")
def actualizar_oportunidad(oid: int, d: OportunidadIn, u=Depends(get_current_user)):
    execute(
        """UPDATE crm_oportunidades
           SET titulo=%s, cliente_id=%s, vendedor_id=%s, etapa_id=%s,
               valor_estimado=%s, probabilidad=%s, fecha_cierre_estimada=%s,
               fuente=%s, notas=%s, updated_at=NOW()
           WHERE id=%s""",
        (d.titulo, d.cliente_id, d.vendedor_id, d.etapa_id, d.valor_estimado,
         d.probabilidad, d.fecha_cierre_estimada or None, d.fuente, d.notas, oid)
    )
    return {"ok": True}

@router.patch("/oportunidades/{oid}/etapa")
def mover_etapa(oid: int, d: CambioEtapaIn, u=Depends(get_current_user)):
    etapa = query_one("SELECT * FROM crm_etapas WHERE id=%s", (d.etapa_id,))
    if not etapa:
        raise HTTPException(404, "Etapa no encontrada")

    # Record stage history before updating
    try:
        opp = query_one("SELECT etapa_id, updated_at FROM crm_oportunidades WHERE id=%s", (oid,))
        if opp:
            tiempo = 0
            if opp.get('updated_at'):
                try:
                    upd = opp['updated_at']
                    if isinstance(upd, datetime):
                        delta = datetime.now() - upd
                        tiempo = round(delta.total_seconds() / 3600, 2)
                except:
                    pass
            insert("""INSERT INTO crm_historial_etapas
                (oportunidad_id, etapa_anterior_id, etapa_nueva_id, usuario_id, tiempo_en_etapa_horas)
                VALUES (%s,%s,%s,%s,%s)""",
                (oid, opp.get('etapa_id'), d.etapa_id, u['id'], tiempo))
    except:
        pass

    estado = "ABIERTA"
    fecha_cierre = None
    if etapa["es_ganada"]:
        estado = "GANADA"
        fecha_cierre = datetime.now()
    elif etapa["es_perdida"]:
        estado = "PERDIDA"
        fecha_cierre = datetime.now()
    execute(
        """UPDATE crm_oportunidades
           SET etapa_id=%s, estado=%s, fecha_cierre_real=%s, updated_at=NOW()
           WHERE id=%s""",
        (d.etapa_id, estado, fecha_cierre, oid)
    )

    # Execute automatizations for the new stage
    try:
        autos = query("SELECT * FROM crm_automatizaciones WHERE etapa_id=%s AND activa=true", (d.etapa_id,))
        opp_data = query_one("SELECT * FROM crm_oportunidades WHERE id=%s", (oid,))
        for auto in autos:
            cfg = json.loads(auto.get('config') or '{}')
            if auto['accion'] == 'CREAR_ACTIVIDAD':
                insert("""INSERT INTO crm_actividades (oportunidad_id, cliente_id, tipo, titulo, estado)
                    VALUES (%s,%s,%s,%s,'PENDIENTE')""",
                    (oid, opp_data.get('cliente_id'), cfg.get('tipo', 'TAREA'),
                     cfg.get('titulo', f"Seguimiento - {etapa['nombre']}")))
            elif auto['accion'] == 'CAMBIAR_PROBABILIDAD':
                execute("UPDATE crm_oportunidades SET probabilidad=%s WHERE id=%s",
                        (cfg.get('probabilidad', 50), oid))
    except:
        pass

    # Update score based on stage progression
    try:
        score = int(etapa.get('orden', 1)) * 15
        execute("UPDATE crm_oportunidades SET score=%s WHERE id=%s", (score, oid))
    except:
        pass

    return {"ok": True, "estado": estado}

@router.delete("/oportunidades/{oid}")
def eliminar_oportunidad(oid: int, u=Depends(get_current_user)):
    execute("DELETE FROM crm_oportunidades WHERE id=%s", (oid,))
    return {"ok": True}


# ══════════════════════════════════════════════════════════════
#  ACTIVIDADES
# ══════════════════════════════════════════════════════════════

@router.get("/actividades")
def listar_actividades(
    vendedor_id: Optional[int] = None,
    tipo: Optional[str] = None,
    estado: Optional[str] = None,
    fecha_ini: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    u=Depends(get_current_user)
):
    sql = """
        SELECT a.*, c.razon_social AS cliente_nombre,
               o.titulo AS oportunidad_titulo
        FROM crm_actividades a
        LEFT JOIN ven_clientes c ON c.id = a.cliente_id
        LEFT JOIN crm_oportunidades o ON o.id = a.oportunidad_id
        WHERE 1=1
    """
    params = []
    if vendedor_id:
        sql += " AND a.vendedor_id=%s"
        params.append(vendedor_id)
    if tipo:
        sql += " AND a.tipo=%s"
        params.append(tipo)
    if estado:
        sql += " AND a.estado=%s"
        params.append(estado)
    if fecha_ini:
        sql += " AND a.fecha_programada >= %s"
        params.append(fecha_ini)
    if fecha_fin:
        sql += " AND a.fecha_programada <= %s"
        params.append(fecha_fin + " 23:59:59")
    sql += " ORDER BY a.fecha_programada ASC NULLS LAST, a.created_at DESC"
    return query(sql, tuple(params))

@router.post("/actividades")
def crear_actividad(d: ActividadIn, u=Depends(get_current_user)):
    # If oportunidad provided, grab the client from it
    cid = d.cliente_id
    if d.oportunidad_id and not cid:
        opp = query_one("SELECT cliente_id FROM crm_oportunidades WHERE id=%s", (d.oportunidad_id,))
        if opp:
            cid = opp["cliente_id"]
    aid = insert(
        """INSERT INTO crm_actividades
           (oportunidad_id, cliente_id, vendedor_id, tipo, titulo,
            descripcion, fecha_programada, estado)
           VALUES (%s,%s,%s,%s,%s,%s,%s,'PENDIENTE')""",
        (d.oportunidad_id, cid, u.get("vendedor_id") or u.get("id"),
         d.tipo, d.titulo, d.descripcion, d.fecha_programada or None)
    )
    return {"id": aid, "ok": True}

@router.patch("/actividades/{aid}/completar")
def completar_actividad(aid: int, d: CompletarActividadIn, u=Depends(get_current_user)):
    execute(
        """UPDATE crm_actividades
           SET estado='COMPLETADA', fecha_completada=NOW(),
               resultado=%s, duracion_min=%s
           WHERE id=%s""",
        (d.resultado, d.duracion_min, aid)
    )
    return {"ok": True}

@router.delete("/actividades/{aid}")
def eliminar_actividad(aid: int, u=Depends(get_current_user)):
    execute("DELETE FROM crm_actividades WHERE id=%s", (aid,))
    return {"ok": True}


# ══════════════════════════════════════════════════════════════
#  NOTAS
# ══════════════════════════════════════════════════════════════

@router.post("/notas")
def crear_nota(d: NotaIn, u=Depends(get_current_user)):
    nid = insert(
        """INSERT INTO crm_notas (oportunidad_id, cliente_id, usuario_id, contenido)
           VALUES (%s,%s,%s,%s)""",
        (d.oportunidad_id, d.cliente_id, u["id"], d.contenido)
    )
    return {"id": nid, "ok": True}


# ══════════════════════════════════════════════════════════════
#  HISTORIAL DE CLIENTE (360 view)
# ══════════════════════════════════════════════════════════════

@router.get("/clientes/{cid}/historial")
def historial_cliente(cid: int, u=Depends(get_current_user)):
    cliente = query_one("SELECT * FROM ven_clientes WHERE id=%s", (cid,))
    if not cliente:
        raise HTTPException(404, "Cliente no encontrado")

    oportunidades = query("""
        SELECT o.*, e.nombre AS etapa_nombre, e.color AS etapa_color,
               v.nombre AS vendedor_nombre
        FROM crm_oportunidades o
        LEFT JOIN crm_etapas e ON e.id = o.etapa_id
        LEFT JOIN ven_vendedores v ON v.id = o.vendedor_id
        WHERE o.cliente_id=%s ORDER BY o.created_at DESC
    """, (cid,))

    actividades = query("""
        SELECT a.*, o.titulo AS oportunidad_titulo
        FROM crm_actividades a
        LEFT JOIN crm_oportunidades o ON o.id = a.oportunidad_id
        WHERE a.cliente_id=%s ORDER BY a.created_at DESC
    """, (cid,))

    notas = query("""
        SELECT n.*, u.nombre AS usuario_nombre
        FROM crm_notas n
        LEFT JOIN sys_usuarios u ON u.id = n.usuario_id
        WHERE n.cliente_id=%s ORDER BY n.created_at DESC
    """, (cid,))

    facturas = query("""
        SELECT id, numero, fecha, total, estado
        FROM ven_facturas
        WHERE cliente_id=%s ORDER BY fecha DESC LIMIT 50
    """, (cid,))

    cotizaciones = query("""
        SELECT id, numero, fecha, total, estado
        FROM ven_cotizaciones
        WHERE cliente_id=%s ORDER BY fecha DESC LIMIT 50
    """, (cid,))

    # Build unified chronological timeline
    timeline = []
    for o in oportunidades:
        timeline.append({"tipo": "OPORTUNIDAD", "fecha": str(o.get("created_at") or ""), "data": o})
    for a in actividades:
        timeline.append({"tipo": "ACTIVIDAD", "fecha": str(a.get("created_at") or ""), "data": a})
    for n in notas:
        timeline.append({"tipo": "NOTA", "fecha": str(n.get("created_at") or ""), "data": n})
    for f in facturas:
        timeline.append({"tipo": "FACTURA", "fecha": str(f.get("fecha") or ""), "data": f})
    for c in cotizaciones:
        timeline.append({"tipo": "COTIZACION", "fecha": str(c.get("fecha") or ""), "data": c})
    timeline.sort(key=lambda x: x["fecha"], reverse=True)

    return {
        "cliente": cliente,
        "oportunidades": oportunidades,
        "actividades": actividades,
        "notas": notas,
        "facturas": facturas,
        "cotizaciones": cotizaciones,
        "timeline": timeline,
    }


# ══════════════════════════════════════════════════════════════
#  WHATSAPP (wa.me link)
# ══════════════════════════════════════════════════════════════

@router.post("/whatsapp/enviar")
def enviar_whatsapp(d: WhatsAppIn, u=Depends(get_current_user)):
    # Sanitize phone
    phone = d.telefono.replace(" ", "").replace("-", "").replace("+", "")
    if not phone.startswith("593") and len(phone) == 10:
        phone = "593" + phone[1:]  # Convert 09xxx to 5939xxx
    encoded = quote(d.mensaje)
    link = f"https://wa.me/{phone}?text={encoded}"

    # Auto-log activity
    cid = d.cliente_id
    if d.oportunidad_id and not cid:
        opp = query_one("SELECT cliente_id FROM crm_oportunidades WHERE id=%s", (d.oportunidad_id,))
        if opp:
            cid = opp["cliente_id"]

    insert(
        """INSERT INTO crm_actividades
           (oportunidad_id, cliente_id, vendedor_id, tipo, titulo,
            descripcion, estado, fecha_completada, canal)
           VALUES (%s,%s,%s,'WHATSAPP',%s,%s,'COMPLETADA',NOW(),'WHATSAPP')""",
        (d.oportunidad_id, cid, u.get("id"),
         f"WhatsApp a {d.telefono}", d.mensaje)
    )
    return {"ok": True, "link": link}


# ══════════════════════════════════════════════════════════════
#  EMAIL desde CRM
# ══════════════════════════════════════════════════════════════

@router.post("/email/enviar")
def enviar_email_crm(d: EmailCRMIn, u=Depends(get_current_user)):
    from sri.email_sender import get_smtp_config, smtp_configurado
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    if not smtp_configurado():
        raise HTTPException(400, "SMTP no configurado. Vaya a Configuracion > Email.")

    cfg = get_smtp_config()
    msg = MIMEMultipart("alternative")
    msg["From"] = f"{cfg['from_name']} <{cfg['from_email'] or cfg['user']}>"
    msg["To"] = d.destinatario
    msg["Subject"] = d.asunto

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <div style="background:#1e3a5f;color:white;padding:16px 20px;border-radius:8px 8px 0 0;">
        <h3 style="margin:0;">{d.asunto}</h3>
      </div>
      <div style="background:#f8f9fa;padding:20px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;">
        <p style="font-size:14px;color:#333;white-space:pre-wrap;">{d.mensaje}</p>
      </div>
      <p style="font-size:11px;color:#999;text-align:center;margin-top:10px;">
        Enviado desde NEXUS POS CRM
      </p>
    </div>
    """
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        if cfg["use_tls"]:
            server = smtplib.SMTP(cfg["host"], cfg["port"], timeout=15)
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(cfg["host"], cfg["port"], timeout=15)
        server.login(cfg["user"], cfg["password"])
        server.sendmail(cfg["from_email"] or cfg["user"], [d.destinatario], msg.as_string())
        server.quit()
    except Exception as e:
        raise HTTPException(500, f"Error enviando email: {str(e)}")

    # Auto-log activity
    cid = d.cliente_id
    if d.oportunidad_id and not cid:
        opp = query_one("SELECT cliente_id FROM crm_oportunidades WHERE id=%s", (d.oportunidad_id,))
        if opp:
            cid = opp["cliente_id"]

    insert(
        """INSERT INTO crm_actividades
           (oportunidad_id, cliente_id, vendedor_id, tipo, titulo,
            descripcion, estado, fecha_completada, canal, referencia)
           VALUES (%s,%s,%s,'EMAIL',%s,%s,'COMPLETADA',NOW(),'EMAIL',%s)""",
        (d.oportunidad_id, cid, u.get("id"),
         f"Email: {d.asunto}", d.mensaje, d.destinatario)
    )
    return {"ok": True, "enviado": True}


# ══════════════════════════════════════════════════════════════
#  AUTOMATIZACIONES
# ══════════════════════════════════════════════════════════════

@router.get("/automatizaciones")
def get_automatizaciones(u=Depends(get_current_user)):
    return query("""
        SELECT a.*, e.nombre as etapa_nombre
        FROM crm_automatizaciones a
        LEFT JOIN crm_etapas e ON e.id=a.etapa_id
        WHERE a.activa=true ORDER BY e.orden
    """)

@router.post("/automatizaciones")
def crear_automatizacion(etapa_id: int, accion: str, config: str = '{}', u=Depends(get_current_user)):
    """Actions: CREAR_ACTIVIDAD, ENVIAR_EMAIL, ENVIAR_WHATSAPP, CAMBIAR_PROBABILIDAD"""
    aid = insert("INSERT INTO crm_automatizaciones (etapa_id, accion, config) VALUES (%s,%s,%s)",
                 (etapa_id, accion, config))
    return {"id": aid, "msg": "Automatizacion creada"}

@router.delete("/automatizaciones/{aid}")
def eliminar_automatizacion(aid: int, u=Depends(get_current_user)):
    execute("DELETE FROM crm_automatizaciones WHERE id=%s", (aid,))
    return {"msg": "Eliminada"}


# ══════════════════════════════════════════════════════════════
#  HISTORIAL DE ETAPAS
# ══════════════════════════════════════════════════════════════

@router.get("/oportunidades/{oid}/historial-etapas")
def historial_etapas(oid: int, u=Depends(get_current_user)):
    return query("""
        SELECT h.*, ea.nombre as etapa_anterior, en.nombre as etapa_nueva,
               u.nombre as usuario_nombre
        FROM crm_historial_etapas h
        LEFT JOIN crm_etapas ea ON ea.id=h.etapa_anterior_id
        LEFT JOIN crm_etapas en ON en.id=h.etapa_nueva_id
        LEFT JOIN sys_usuarios u ON u.id=h.usuario_id
        WHERE h.oportunidad_id=%s ORDER BY h.fecha ASC
    """, (oid,))


# ══════════════════════════════════════════════════════════════
#  SCORING DE LEADS
# ══════════════════════════════════════════════════════════════

@router.post("/oportunidades/{oid}/recalcular-score")
def recalcular_score(oid: int, u=Depends(get_current_user)):
    opp = query_one("""
        SELECT o.*, e.orden FROM crm_oportunidades o
        LEFT JOIN crm_etapas e ON e.id=o.etapa_id WHERE o.id=%s""", (oid,))
    if not opp:
        raise HTTPException(404)

    score = 0
    score += int(opp.get('orden', 1) or 1) * 15  # Stage progression
    score += min(int(opp.get('probabilidad', 0) or 0) // 10, 10)  # Probability bonus

    activities = query_one(
        "SELECT COUNT(*) as n FROM crm_actividades WHERE oportunidad_id=%s AND estado='COMPLETADA'", (oid,))
    score += min(int(activities['n']) * 5, 30)  # Activity bonus (max 30)

    recent = query_one(
        "SELECT COUNT(*) as n FROM crm_actividades WHERE oportunidad_id=%s AND created_at > NOW() - INTERVAL '7 days'",
        (oid,))
    if int(recent['n']) > 0:
        score += 10  # Recent activity bonus

    if opp.get('valor_estimado') and float(opp['valor_estimado']) > 1000:
        score += 10  # High value bonus

    score = min(score, 100)
    execute("UPDATE crm_oportunidades SET score=%s WHERE id=%s", (score, oid))
    return {"score": score}


# ══════════════════════════════════════════════════════════════
#  FORECAST (Pronostico de Ventas)
# ══════════════════════════════════════════════════════════════

@router.get("/forecast")
def forecast_ventas(u=Depends(get_current_user)):
    """Sales forecast based on pipeline weighted by probability."""
    por_mes = query("""
        SELECT TO_CHAR(o.fecha_cierre_estimada, 'YYYY-MM') as mes,
               COUNT(*) as oportunidades,
               SUM(o.valor_estimado) as valor_total,
               SUM(o.valor_estimado * o.probabilidad / 100) as valor_ponderado
        FROM crm_oportunidades o
        WHERE o.estado='ABIERTA' AND o.fecha_cierre_estimada IS NOT NULL
        GROUP BY TO_CHAR(o.fecha_cierre_estimada, 'YYYY-MM')
        ORDER BY mes
    """)

    total_pipeline = query_one(
        "SELECT COALESCE(SUM(valor_estimado),0) as total FROM crm_oportunidades WHERE estado='ABIERTA'")
    total_ponderado = query_one(
        "SELECT COALESCE(SUM(valor_estimado * probabilidad / 100),0) as total FROM crm_oportunidades WHERE estado='ABIERTA'")

    return {
        "por_mes": por_mes,
        "total_pipeline": float(total_pipeline['total']),
        "total_ponderado": round(float(total_ponderado['total']), 2),
    }


# ══════════════════════════════════════════════════════════════
#  REPORTE EMBUDO (Funnel)
# ══════════════════════════════════════════════════════════════

@router.get("/reporte-embudo")
def reporte_embudo(fecha_ini: Optional[str] = None, fecha_fin: Optional[str] = None,
                   u=Depends(get_current_user)):
    """Funnel report: how many opportunities in each stage with conversion rates."""
    etapas = query("SELECT * FROM crm_etapas WHERE activa=true ORDER BY orden")
    result = []
    for etapa in etapas:
        actual = query_one(
            "SELECT COUNT(*) as n FROM crm_oportunidades WHERE etapa_id=%s", (etapa['id'],))
        ganadas = query_one(
            "SELECT COUNT(*) as n FROM crm_oportunidades WHERE etapa_id=%s AND estado='GANADA'", (etapa['id'],))
        perdidas = query_one(
            "SELECT COUNT(*) as n FROM crm_oportunidades WHERE etapa_id=%s AND estado='PERDIDA'", (etapa['id'],))
        tiempo_promedio = query_one("""
            SELECT COALESCE(AVG(tiempo_en_etapa_horas),0) as promedio
            FROM crm_historial_etapas WHERE etapa_nueva_id=%s
        """, (etapa['id'],))
        result.append({
            **etapa,
            "actual": actual['n'],
            "ganadas": ganadas['n'],
            "perdidas": perdidas['n'],
            "tiempo_promedio_horas": round(float(tiempo_promedio['promedio']), 1),
        })

    # Conversion rates between consecutive stages
    for i in range(1, len(result)):
        prev_total = result[i - 1]['actual'] + result[i - 1].get('ganadas', 0) + result[i - 1].get('perdidas', 0)
        curr_total = result[i]['actual'] + result[i].get('ganadas', 0) + result[i].get('perdidas', 0)
        result[i]['conversion_pct'] = round(curr_total / prev_total * 100, 1) if prev_total > 0 else 0
    if result:
        result[0]['conversion_pct'] = 100

    return {"etapas": result}


# ══════════════════════════════════════════════════════════════
#  PLANTILLAS EMAIL/WHATSAPP
# ══════════════════════════════════════════════════════════════

@router.get("/plantillas")
def get_plantillas(tipo: Optional[str] = None, u=Depends(get_current_user)):
    if tipo:
        return query("SELECT * FROM crm_plantillas WHERE tipo=%s AND activa=true ORDER BY nombre", (tipo,))
    return query("SELECT * FROM crm_plantillas WHERE activa=true ORDER BY tipo, nombre")

@router.post("/plantillas")
def crear_plantilla(nombre: str, tipo: str, contenido: str, asunto: str = '', u=Depends(get_current_user)):
    pid = insert("INSERT INTO crm_plantillas (nombre, tipo, asunto, contenido) VALUES (%s,%s,%s,%s)",
                 (nombre, tipo, asunto, contenido))
    return {"id": pid, "msg": "Plantilla creada"}

@router.put("/plantillas/{pid}")
def actualizar_plantilla(pid: int, nombre: str, contenido: str, asunto: str = '', u=Depends(get_current_user)):
    execute("UPDATE crm_plantillas SET nombre=%s, asunto=%s, contenido=%s WHERE id=%s",
            (nombre, asunto, contenido, pid))
    return {"msg": "Plantilla actualizada"}

@router.delete("/plantillas/{pid}")
def eliminar_plantilla(pid: int, u=Depends(get_current_user)):
    execute("DELETE FROM crm_plantillas WHERE id=%s", (pid,))
    return {"msg": "Eliminada"}


# ══════════════════════════════════════════════════════════════
#  IMPORTAR CONTACTOS CSV
# ══════════════════════════════════════════════════════════════

@router.post("/importar-contactos")
async def importar_contactos(file: UploadFile = File(...), u=Depends(get_current_user)):
    """Import contacts from CSV: nombre,email,telefono"""
    content = await file.read()
    lines = content.decode('utf-8-sig', 'replace').splitlines()
    importados = 0
    errores = []
    for i, line in enumerate(lines[1:], 2):
        parts = line.split(',')
        if len(parts) < 2:
            continue
        try:
            nombre = parts[0].strip()
            email = parts[1].strip() if len(parts) > 1 else ''
            telefono = parts[2].strip() if len(parts) > 2 else ''
            if not nombre:
                continue
            existing = query_one(
                "SELECT id FROM ven_clientes WHERE razon_social ILIKE %s OR email=%s",
                (nombre, email))
            if not existing:
                insert("""INSERT INTO ven_clientes
                    (razon_social, email, telefono, tipo_identificacion, identificacion, activo, created_at)
                    VALUES (%s,%s,%s,'PASAPORTE',%s,true,NOW())""",
                    (nombre, email, telefono, f'IMP-{i}'))
                importados += 1
        except Exception as e:
            errores.append(f"Linea {i}: {str(e)[:50]}")
    return {"importados": importados, "errores": errores}


# ══════════════════════════════════════════════════════════════
#  DASHBOARD CRM
# ══════════════════════════════════════════════════════════════

@router.get("/dashboard")
def dashboard_crm(u=Depends(get_current_user)):
    # Total oportunidades abiertas
    total = query_one("SELECT COUNT(*) AS cnt FROM crm_oportunidades WHERE estado='ABIERTA'")
    total_abiertas = total["cnt"] if total else 0

    # Por etapa
    por_etapa = query("""
        SELECT e.nombre, e.color, COUNT(o.id) AS cnt,
               COALESCE(SUM(o.valor_estimado), 0) AS valor
        FROM crm_etapas e
        LEFT JOIN crm_oportunidades o ON o.etapa_id = e.id AND o.estado = 'ABIERTA'
        WHERE e.activa = true
        GROUP BY e.id, e.nombre, e.color, e.orden
        ORDER BY e.orden
    """)

    # Valor total pipeline
    vtotal = query_one(
        "SELECT COALESCE(SUM(valor_estimado),0) AS total FROM crm_oportunidades WHERE estado='ABIERTA'")
    valor_pipeline = float(vtotal["total"]) if vtotal else 0

    # Conversion rate (ganadas / (ganadas + perdidas))
    ganadas = query_one("SELECT COUNT(*) AS cnt FROM crm_oportunidades WHERE estado='GANADA'")
    perdidas = query_one("SELECT COUNT(*) AS cnt FROM crm_oportunidades WHERE estado='PERDIDA'")
    g = ganadas["cnt"] if ganadas else 0
    p = perdidas["cnt"] if perdidas else 0
    tasa_conversion = round(g / (g + p) * 100, 1) if (g + p) > 0 else 0

    # Actividades pendientes hoy
    pend_hoy = query_one("""
        SELECT COUNT(*) AS cnt FROM crm_actividades
        WHERE estado='PENDIENTE' AND DATE(fecha_programada) <= CURRENT_DATE
    """)
    actividades_hoy = pend_hoy["cnt"] if pend_hoy else 0

    # Top vendedores por deals cerrados
    top_vendedores = query("""
        SELECT v.nombre, COUNT(o.id) AS deals,
               COALESCE(SUM(o.valor_estimado),0) AS valor
        FROM crm_oportunidades o
        JOIN ven_vendedores v ON v.id = o.vendedor_id
        WHERE o.estado = 'GANADA'
        GROUP BY v.id, v.nombre
        ORDER BY valor DESC
        LIMIT 5
    """)

    # Valor forecast (valor * probabilidad / 100)
    forecast = query_one("""
        SELECT COALESCE(SUM(valor_estimado * probabilidad / 100.0), 0) AS total
        FROM crm_oportunidades WHERE estado='ABIERTA'
    """)
    valor_forecast = round(float(forecast["total"]), 2) if forecast else 0

    # Ganadas este mes
    ganadas_mes = query_one("""
        SELECT COUNT(*) AS cnt, COALESCE(SUM(valor_estimado),0) AS valor
        FROM crm_oportunidades
        WHERE estado='GANADA' AND DATE_TRUNC('month', fecha_cierre_real) = DATE_TRUNC('month', CURRENT_DATE)
    """)

    return {
        "total_abiertas": total_abiertas,
        "por_etapa": por_etapa,
        "valor_pipeline": valor_pipeline,
        "tasa_conversion": tasa_conversion,
        "actividades_pendientes_hoy": actividades_hoy,
        "top_vendedores": top_vendedores,
        "valor_forecast": valor_forecast,
        "ganadas_mes": {
            "count": ganadas_mes["cnt"] if ganadas_mes else 0,
            "valor": float(ganadas_mes["valor"]) if ganadas_mes else 0,
        },
    }
