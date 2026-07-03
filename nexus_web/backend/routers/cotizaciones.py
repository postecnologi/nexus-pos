from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from database import query, query_one, execute, insert, db
from auth import get_current_user
from typing import Optional
from pydantic import BaseModel
from datetime import date, timedelta
import io

router = APIRouter(prefix="/api/cotizaciones", tags=["Cotizaciones"])


# ── Pydantic Models ─────────────────────────────────────────

class CotDetIn(BaseModel):
    producto_id: int
    cantidad: float
    precio_unitario: float
    descuento_pct: float = 0
    iva_porcentaje: float = 15.0
    descripcion: Optional[str] = None

class CotizacionIn(BaseModel):
    cliente_id: int
    vendedor_id: Optional[int] = None
    sucursal_id: Optional[int] = None
    observaciones: Optional[str] = None
    descuento_global_pct: float = 0
    fecha_validez: Optional[str] = None
    detalles: list

class EstadoIn(BaseModel):
    estado: str


# ── Helpers ──────────────────────────────────────────────────

def _calcular_totales(detalles, descuento_global_pct, iva_pct_default=15.0):
    """Calcula subtotal_0, subtotal_iva, iva, total de una lista de detalles."""
    subtotal_0 = 0.0
    subtotal_base = 0.0
    iva_monto_total = 0.0
    detalles_calc = []

    for det in detalles:
        pu   = float(det.get("precio_unitario", 0))
        cant = float(det.get("cantidad", 0))
        dp   = float(det.get("descuento_pct", 0))
        dg   = float(descuento_global_pct)
        iv   = float(det.get("iva_porcentaje", iva_pct_default))

        linea_pvp = round(cant * pu * (1 - dp / 100) * (1 - dg / 100), 4)

        if iv == 0:
            subtotal_0 += linea_pvp
            base_l = linea_pvp
            iva_l = 0.0
        else:
            base_l = round(linea_pvp / (1 + iv / 100), 4)
            iva_l  = round(linea_pvp - base_l, 4)
            subtotal_base   += base_l
            iva_monto_total += iva_l

        detalles_calc.append({
            "producto_id": det.get("producto_id"),
            "descripcion": det.get("descripcion", ""),
            "cantidad": cant,
            "precio_unitario": pu,
            "descuento_pct": dp,
            "subtotal": round(base_l, 4),
            "iva_porcentaje": iv,
            "iva_valor": round(iva_l, 4),
            "total": round(linea_pvp, 4),
        })

    return {
        "subtotal_0":   round(subtotal_0, 2),
        "subtotal_iva": round(subtotal_base, 2),
        "iva":          round(iva_monto_total, 2),
        "total":        round(subtotal_0 + subtotal_base + iva_monto_total, 2),
        "detalles":     detalles_calc,
    }


# ══════════════════════════════════════════════════════════════
#  LISTAR COTIZACIONES
# ══════════════════════════════════════════════════════════════

@router.get("")
def listar_cotizaciones(
    busqueda:  Optional[str] = None,
    estado:    Optional[str] = None,
    fecha_ini: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    u=Depends(get_current_user),
):
    conds  = ["1=1"]
    params = []
    if estado:
        conds.append("co.estado=%s"); params.append(estado)
    if fecha_ini:
        conds.append("co.fecha>=%s"); params.append(fecha_ini)
    if fecha_fin:
        conds.append("co.fecha<=%s"); params.append(fecha_fin)
    if busqueda:
        conds.append(
            "(c.razon_social ILIKE %s OR c.identificacion ILIKE %s OR co.numero ILIKE %s)"
        )
        params += [f"%{busqueda}%"] * 3

    where = "WHERE " + " AND ".join(conds)
    rows = query(f"""
        SELECT co.*,
               c.razon_social  AS cliente_nombre,
               c.identificacion AS cliente_ruc,
               v.nombre         AS vendedor_nombre
        FROM ven_cotizaciones co
        JOIN ven_clientes c        ON c.id = co.cliente_id
        LEFT JOIN ven_vendedores v ON v.id = co.vendedor_id
        {where}
        ORDER BY co.created_at DESC, co.id DESC
        LIMIT 200
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

    last = query_one(
        "SELECT numero FROM ven_cotizaciones ORDER BY id DESC LIMIT 1"
    )
    if last and last["numero"]:
        try:
            seq = int(last["numero"].split("-")[-1]) + 1
        except (ValueError, IndexError):
            seq = 1
    else:
        seq = 1

    numero = f"COT-{cod_est}-{str(seq).zfill(9)}"
    return {"numero": numero, "secuencial": seq}


# ══════════════════════════════════════════════════════════════
#  DETALLE COTIZACION
# ══════════════════════════════════════════════════════════════

@router.get("/{cid}")
def detalle_cotizacion(cid: int, u=Depends(get_current_user)):
    co = query_one("""
        SELECT co.*,
               c.razon_social  AS cliente_nombre,
               c.identificacion AS cliente_ruc,
               c.email          AS cliente_email,
               c.direccion      AS cliente_dir,
               c.telefono       AS cliente_telefono,
               v.nombre         AS vendedor_nombre,
               s.nombre         AS sucursal_nombre,
               emp.razon_social AS empresa_nombre,
               emp.ruc          AS empresa_ruc,
               emp.direccion    AS empresa_dir,
               emp.iva_porcentaje,
               emp.logo_base64
        FROM ven_cotizaciones co
        JOIN ven_clientes c        ON c.id = co.cliente_id
        LEFT JOIN ven_vendedores v ON v.id = co.vendedor_id
        LEFT JOIN sys_sucursales s ON s.id = co.sucursal_id
        LEFT JOIN sys_empresas emp ON emp.activa = true
        WHERE co.id = %s LIMIT 1
    """, (cid,))
    if not co:
        raise HTTPException(404, "Cotización no encontrada")

    detalles = query("""
        SELECT cd.*, p.descripcion AS prod_descripcion, p.codigo
        FROM ven_cotizacion_detalles cd
        JOIN inv_productos p ON p.id = cd.producto_id
        WHERE cd.cotizacion_id = %s
        ORDER BY cd.id
    """, (cid,))
    co["detalles"] = detalles
    return co


# ══════════════════════════════════════════════════════════════
#  CREAR COTIZACION
# ══════════════════════════════════════════════════════════════

@router.post("")
def crear_cotizacion(body: CotizacionIn, u=Depends(get_current_user)):
    if not body.detalles:
        raise HTTPException(400, "La cotización debe tener al menos un producto")

    suc_id = body.sucursal_id or u.get("sucursal_id")

    emp = query_one("SELECT iva_porcentaje FROM sys_empresas WHERE activa=true LIMIT 1")
    iva_pct = float(emp["iva_porcentaje"]) if emp else 15.0

    calc = _calcular_totales(body.detalles, body.descuento_global_pct, iva_pct)

    # Obtener próximo número
    prox = proximo_numero(u)
    numero = prox["numero"]

    # Fecha validez: 15 días por defecto
    fv = body.fecha_validez or str(date.today() + timedelta(days=15))

    cot_id = insert("""
        INSERT INTO ven_cotizaciones
            (numero, cliente_id, vendedor_id, sucursal_id,
             fecha, fecha_validez,
             subtotal_0, subtotal_iva, iva, total,
             descuento_global_pct, observaciones, estado, usuario_id, created_at)
        VALUES (%s,%s,%s,%s, CURRENT_DATE, %s, %s,%s,%s,%s, %s,%s,'BORRADOR',%s, NOW())
    """, (numero, body.cliente_id, body.vendedor_id, suc_id,
          fv,
          calc["subtotal_0"], calc["subtotal_iva"], calc["iva"], calc["total"],
          body.descuento_global_pct, body.observaciones, u["id"]))

    for d in calc["detalles"]:
        insert("""
            INSERT INTO ven_cotizacion_detalles
                (cotizacion_id, producto_id, descripcion, cantidad,
                 precio_unitario, descuento_pct, subtotal,
                 iva_porcentaje, iva_valor, total)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (cot_id, d["producto_id"], d["descripcion"],
              d["cantidad"], d["precio_unitario"], d["descuento_pct"],
              d["subtotal"], d["iva_porcentaje"], d["iva_valor"], d["total"]))

    return {"id": cot_id, "numero": numero, "total": calc["total"],
            "msg": "Cotización creada correctamente"}


# ══════════════════════════════════════════════════════════════
#  ACTUALIZAR COTIZACION
# ══════════════════════════════════════════════════════════════

@router.put("/{cid}")
def actualizar_cotizacion(cid: int, body: CotizacionIn, u=Depends(get_current_user)):
    co = query_one("SELECT estado FROM ven_cotizaciones WHERE id=%s", (cid,))
    if not co:
        raise HTTPException(404, "Cotización no encontrada")
    if co["estado"] not in ("BORRADOR", "ENVIADA"):
        raise HTTPException(400, "Solo se puede editar cotizaciones en estado BORRADOR o ENVIADA")

    if not body.detalles:
        raise HTTPException(400, "La cotización debe tener al menos un producto")

    emp = query_one("SELECT iva_porcentaje FROM sys_empresas WHERE activa=true LIMIT 1")
    iva_pct = float(emp["iva_porcentaje"]) if emp else 15.0

    calc = _calcular_totales(body.detalles, body.descuento_global_pct, iva_pct)

    fv = body.fecha_validez or str(date.today() + timedelta(days=15))

    execute("""
        UPDATE ven_cotizaciones SET
            cliente_id=%s, vendedor_id=%s, sucursal_id=%s,
            fecha_validez=%s,
            subtotal_0=%s, subtotal_iva=%s, iva=%s, total=%s,
            descuento_global_pct=%s, observaciones=%s
        WHERE id=%s
    """, (body.cliente_id, body.vendedor_id,
          body.sucursal_id or u.get("sucursal_id"),
          fv,
          calc["subtotal_0"], calc["subtotal_iva"], calc["iva"], calc["total"],
          body.descuento_global_pct, body.observaciones, cid))

    # Borrar detalles anteriores y reinsertar
    execute("DELETE FROM ven_cotizacion_detalles WHERE cotizacion_id=%s", (cid,))

    for d in calc["detalles"]:
        insert("""
            INSERT INTO ven_cotizacion_detalles
                (cotizacion_id, producto_id, descripcion, cantidad,
                 precio_unitario, descuento_pct, subtotal,
                 iva_porcentaje, iva_valor, total)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (cid, d["producto_id"], d["descripcion"],
              d["cantidad"], d["precio_unitario"], d["descuento_pct"],
              d["subtotal"], d["iva_porcentaje"], d["iva_valor"], d["total"]))

    return {"id": cid, "total": calc["total"],
            "msg": "Cotización actualizada correctamente"}


# ══════════════════════════════════════════════════════════════
#  CAMBIAR ESTADO
# ══════════════════════════════════════════════════════════════

@router.patch("/{cid}/estado")
def cambiar_estado(cid: int, body: EstadoIn, u=Depends(get_current_user)):
    co = query_one("SELECT estado FROM ven_cotizaciones WHERE id=%s", (cid,))
    if not co:
        raise HTTPException(404, "Cotización no encontrada")

    nuevo = body.estado.upper()
    permitidos = ("ENVIADA", "APROBADA", "RECHAZADA")
    if nuevo not in permitidos:
        raise HTTPException(400, f"Estado no válido. Permitidos: {', '.join(permitidos)}")

    actual = co["estado"]
    # Reglas de transición
    if actual == "FACTURADA":
        raise HTTPException(400, "No se puede cambiar el estado de una cotización ya facturada")
    if actual == "RECHAZADA" and nuevo != "ENVIADA":
        raise HTTPException(400, "Una cotización rechazada solo puede volver a ENVIADA")

    execute("UPDATE ven_cotizaciones SET estado=%s WHERE id=%s", (nuevo, cid))
    return {"msg": f"Estado cambiado a {nuevo}", "estado": nuevo}


# ══════════════════════════════════════════════════════════════
#  CONVERTIR A FACTURA
# ══════════════════════════════════════════════════════════════

@router.post("/{cid}/convertir-factura")
def convertir_a_factura(cid: int, u=Depends(get_current_user)):
    co = query_one("""
        SELECT co.*, c.plazo_pago
        FROM ven_cotizaciones co
        JOIN ven_clientes c ON c.id = co.cliente_id
        WHERE co.id=%s
    """, (cid,))
    if not co:
        raise HTTPException(404, "Cotización no encontrada")
    if co["estado"] != "APROBADA":
        raise HTTPException(400, "Solo se puede facturar una cotización APROBADA")

    suc_id = co.get("sucursal_id") or u.get("sucursal_id")
    suc = (
        query_one("SELECT * FROM sys_sucursales WHERE id=%s", (suc_id,))
        if suc_id else
        query_one("SELECT * FROM sys_sucursales WHERE es_principal=true AND activa=true LIMIT 1")
    )
    if not suc:
        raise HTTPException(400, "No hay sucursal configurada")

    seq      = int(suc.get("secuencial_factura") or 1)
    cod_est  = suc.get("codigo_establecimiento") or "001"
    pto_emis = suc.get("punto_emision") or "001"

    # Buscar siguiente disponible
    while True:
        num_factura = f"{cod_est}-{pto_emis}-{str(seq).zfill(9)}"
        existe = query_one(
            "SELECT id FROM ven_facturas WHERE numero_factura=%s AND sucursal_id=%s",
            (num_factura, suc_id)
        )
        if not existe:
            break
        seq += 1

    # Obtener bodega principal
    bod_principal = query_one("""
        SELECT id FROM inv_bodegas
        WHERE sucursal_id=%s AND es_principal=true AND activa=true LIMIT 1
    """, (suc_id,))
    bod_fac_id = bod_principal["id"] if bod_principal else (
        query_one("SELECT id FROM inv_bodegas WHERE activa=true LIMIT 1") or {}
    ).get("id")

    # Crear factura
    fac_id = insert("""
        INSERT INTO ven_facturas
            (numero_factura, cliente_id, vendedor_id, sucursal_id, bodega_id,
             fecha_emision, subtotal_0, subtotal_iva, iva, total,
             descuento_global_pct, observaciones, estado, usuario_id, created_at)
        VALUES (%s,%s,%s,%s,%s, CURRENT_DATE, %s,%s,%s,%s, %s,%s,'EMITIDA',%s, NOW())
    """, (num_factura, co["cliente_id"], co["vendedor_id"], suc_id, bod_fac_id,
          co["subtotal_0"], co["subtotal_iva"], co["iva"], co["total"],
          co["descuento_global_pct"],
          f"Generada desde cotización {co['numero']}. {co.get('observaciones') or ''}".strip(),
          u["id"]))

    # Incrementar secuencial
    execute("UPDATE sys_sucursales SET secuencial_factura=%s WHERE id=%s", (seq + 1, suc_id))

    # Copiar detalles
    detalles = query(
        "SELECT * FROM ven_cotizacion_detalles WHERE cotizacion_id=%s ORDER BY id",
        (cid,)
    )
    for det in detalles:
        insert("""
            INSERT INTO ven_factura_detalles
                (factura_id, producto_id, descripcion, cantidad,
                 precio_unitario, descuento, subtotal,
                 iva_porcentaje, iva_valor, total)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (fac_id, det["producto_id"], det["descripcion"],
              det["cantidad"], det["precio_unitario"], det["descuento_pct"],
              det["subtotal"], det["iva_porcentaje"], det["iva_valor"], det["total"]))

        # Descontar stock
        try:
            bod = query_one("""
                SELECT id FROM inv_bodegas
                WHERE sucursal_id=%s AND es_principal=true AND activa=true LIMIT 1
            """, (suc_id,))
            if bod:
                execute("""
                    UPDATE inv_stock SET cantidad=cantidad-%s
                    WHERE producto_id=%s AND bodega_id=%s
                """, (det["cantidad"], det["producto_id"], bod["id"]))
        except:
            pass

    # Crear pago EFECTIVO por defecto
    insert("""
        INSERT INTO ven_pagos
            (factura_id, forma_pago, monto, referencia, fecha)
        VALUES (%s, 'EFECTIVO', %s, %s, CURRENT_DATE)
    """, (fac_id, float(co["total"]), f"Cotización {co['numero']}"))

    # Marcar cotización como FACTURADA
    execute("""
        UPDATE ven_cotizaciones SET estado='FACTURADA', factura_id=%s WHERE id=%s
    """, (fac_id, cid))

    return {
        "msg": "Factura generada correctamente",
        "factura_id": fac_id,
        "numero_factura": num_factura,
        "total": float(co["total"]),
    }


# ══════════════════════════════════════════════════════════════
#  ELIMINAR COTIZACION
# ══════════════════════════════════════════════════════════════

@router.delete("/{cid}")
def eliminar_cotizacion(cid: int, u=Depends(get_current_user)):
    co = query_one("SELECT estado FROM ven_cotizaciones WHERE id=%s", (cid,))
    if not co:
        raise HTTPException(404, "Cotización no encontrada")
    if co["estado"] != "BORRADOR":
        raise HTTPException(400, "Solo se puede eliminar cotizaciones en estado BORRADOR")

    execute("DELETE FROM ven_cotizacion_detalles WHERE cotizacion_id=%s", (cid,))
    execute("DELETE FROM ven_cotizaciones WHERE id=%s", (cid,))
    return {"msg": "Cotización eliminada"}


# ══════════════════════════════════════════════════════════════
#  ENVIAR EMAIL
# ══════════════════════════════════════════════════════════════

@router.post("/{cid}/enviar-email")
def enviar_email(cid: int, data: dict = {}, u=Depends(get_current_user)):
    co = query_one("""
        SELECT co.*, c.email AS cliente_email, c.razon_social AS cliente_nombre,
               c.telefono AS cliente_telefono
        FROM ven_cotizaciones co
        JOIN ven_clientes c ON c.id = co.cliente_id
        WHERE co.id=%s
    """, (cid,))
    if not co:
        raise HTTPException(404, "Cotización no encontrada")

    email_dest = data.get("email") or co.get("cliente_email")
    if not email_dest:
        raise HTTPException(400, "El cliente no tiene email registrado")

    smtp_cfg = query_one("SELECT * FROM sys_config_smtp WHERE activo=true LIMIT 1")
    if not smtp_cfg:
        raise HTTPException(400, "No hay configuración SMTP. Configúralo en Administración → Sistema")

    empresa = query_one("SELECT * FROM sys_empresas WHERE activa=true LIMIT 1") or {}
    pdf_bytes = _generar_pdf_cotizacion(cid)

    mensaje_extra = data.get("mensaje", "")
    total_fmt = f"${float(co.get('total',0)):,.2f}"
    validez = str(co.get('fecha_validez',''))[:10] if co.get('fecha_validez') else 'A convenir'

    html_body = f"""
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc">
        <div style="background:#1D4ED8;padding:24px 28px;border-radius:10px 10px 0 0">
            <h2 style="margin:0;color:white;font-size:20px">{empresa.get('razon_social','')}</h2>
            <p style="margin:4px 0 0;color:#BFDBFE;font-size:13px">Cotización de servicios/productos</p>
        </div>
        <div style="background:white;padding:28px;border-radius:0 0 10px 10px;border:1px solid #e2e8f0">
            <p style="font-size:14px;color:#1e293b">Estimado/a <strong>{co['cliente_nombre']}</strong>,</p>
            <p style="font-size:13px;color:#475569">
                Adjunto encontrará la <strong>Cotización {co['numero']}</strong> que hemos preparado para usted.
            </p>
            {f'<p style="font-size:13px;color:#475569;background:#f1f5f9;padding:12px;border-radius:8px">{mensaje_extra}</p>' if mensaje_extra else ''}
            <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:20px;margin:20px 0;text-align:center">
                <div style="font-size:12px;color:#1D4ED8;font-weight:700;text-transform:uppercase;margin-bottom:6px">Total cotización</div>
                <div style="font-size:36px;font-weight:900;color:#1D4ED8">{total_fmt}</div>
                <div style="font-size:12px;color:#64748b;margin-top:6px">Válida hasta: {validez}</div>
            </div>
            <p style="font-size:13px;color:#475569">
                El detalle completo se encuentra en el archivo PDF adjunto.<br>
                Estamos a su disposición para cualquier consulta o ajuste.
            </p>
            <div style="border-top:1px solid #e2e8f0;margin-top:20px;padding-top:16px;font-size:12px;color:#94a3b8">
                <strong style="color:#475569">{empresa.get('razon_social','')}</strong><br>
                {f"📞 {empresa.get('telefono','')}" if empresa.get('telefono') else ''}
                {f" · ✉️ {empresa.get('email','')}" if empresa.get('email') else ''}<br>
                Powered by NEXUS POS
            </div>
        </div>
    </div>"""

    import smtplib, ssl
    from email.mime.multipart import MIMEMultipart
    from email.mime.base import MIMEBase
    from email.mime.text import MIMEText
    from email import encoders

    msg = MIMEMultipart("mixed")
    from_name  = smtp_cfg.get('smtp_from_name') or empresa.get('razon_social','')
    from_email = smtp_cfg.get('smtp_from_email') or smtp_cfg.get('smtp_user','')
    msg["From"]    = f"{from_name} <{from_email}>"
    msg["To"]      = email_dest
    msg["Subject"] = f"Cotización {co['numero']} — {from_name} — {total_fmt}"

    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(f"Cotización {co['numero']} por {total_fmt}. Ver PDF adjunto.", "plain"))
    alt.attach(MIMEText(html_body, "html"))
    msg.attach(alt)

    attach = MIMEBase("application", "pdf")
    attach.set_payload(pdf_bytes)
    encoders.encode_base64(attach)
    attach.add_header("Content-Disposition", f"attachment; filename=Cotizacion_{co['numero']}.pdf")
    msg.attach(attach)

    try:
        ctx = ssl.create_default_context()
        if smtp_cfg.get("smtp_use_tls", True):
            srv = smtplib.SMTP(smtp_cfg["smtp_host"], smtp_cfg.get("smtp_port", 587), timeout=15)
            srv.starttls(context=ctx)
        else:
            srv = smtplib.SMTP_SSL(smtp_cfg["smtp_host"], smtp_cfg.get("smtp_port", 465), context=ctx, timeout=15)
        srv.login(smtp_cfg.get("smtp_user",""), smtp_cfg.get("smtp_password",""))
        srv.sendmail(from_email, [email_dest], msg.as_string())
        srv.quit()
    except Exception as e:
        raise HTTPException(500, f"Error SMTP: {str(e)}")

    if co["estado"] == "BORRADOR":
        execute("UPDATE ven_cotizaciones SET estado='ENVIADA' WHERE id=%s", (cid,))

    return {"msg": f"✅ Email enviado a {email_dest}", "email": email_dest}


# ══════════════════════════════════════════════════════════════
#  GENERAR PDF
# ══════════════════════════════════════════════════════════════

def _generar_pdf_cotizacion(cid: int) -> bytes:
    """Genera un PDF de la cotización y retorna los bytes."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    co = query_one("""
        SELECT co.*,
               c.razon_social  AS cliente_nombre,
               c.identificacion AS cliente_ruc,
               c.email          AS cliente_email,
               c.direccion      AS cliente_dir,
               c.telefono       AS cliente_telefono,
               v.nombre         AS vendedor_nombre,
               s.nombre         AS sucursal_nombre,
               emp.razon_social AS empresa_nombre,
               emp.ruc          AS empresa_ruc,
               emp.direccion    AS empresa_dir,
               emp.telefono     AS empresa_telefono
        FROM ven_cotizaciones co
        JOIN ven_clientes c        ON c.id = co.cliente_id
        LEFT JOIN ven_vendedores v ON v.id = co.vendedor_id
        LEFT JOIN sys_sucursales s ON s.id = co.sucursal_id
        LEFT JOIN sys_empresas emp ON emp.activa = true
        WHERE co.id = %s LIMIT 1
    """, (cid,))
    if not co:
        return b""

    detalles = query("""
        SELECT cd.*, p.descripcion AS prod_descripcion, p.codigo
        FROM ven_cotizacion_detalles cd
        JOIN inv_productos p ON p.id = cd.producto_id
        WHERE cd.cotizacion_id = %s ORDER BY cd.id
    """, (cid,))

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=20*mm, rightMargin=20*mm,
                            topMargin=20*mm, bottomMargin=20*mm)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle("TitleCot", parent=styles["Heading1"],
                                  fontSize=16, spaceAfter=4, textColor=colors.HexColor("#1E3A5F"))
    normal = styles["Normal"]
    small = ParagraphStyle("Small", parent=normal, fontSize=9, leading=12)

    elems = []

    # Header empresa
    empresa = co.get("empresa_nombre") or "EMPRESA"
    elems.append(Paragraph(f"<b>{empresa}</b>", title_style))
    elems.append(Paragraph(f"RUC: {co.get('empresa_ruc', '')}", small))
    if co.get("empresa_dir"):
        elems.append(Paragraph(f"Dir: {co['empresa_dir']}", small))
    elems.append(Spacer(1, 6*mm))

    # Cotizacion info
    elems.append(Paragraph(f"<b>COTIZACIÓN / PROFORMA  N.° {co['numero']}</b>",
                            ParagraphStyle("CotNum", parent=normal, fontSize=14,
                                           textColor=colors.HexColor("#2563EB"))))
    elems.append(Spacer(1, 3*mm))

    fecha_str = str(co.get("fecha", ""))
    validez_str = str(co.get("fecha_validez", ""))
    info_data = [
        ["Fecha:", fecha_str, "Estado:", co.get("estado", "")],
        ["Validez:", validez_str, "Vendedor:", co.get("vendedor_nombre") or "—"],
    ]
    info_table = Table(info_data, colWidths=[60, 120, 60, 120])
    info_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.gray),
        ("TEXTCOLOR", (2, 0), (2, -1), colors.gray),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
        ("FONTNAME", (3, 0), (3, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elems.append(info_table)
    elems.append(Spacer(1, 4*mm))

    # Cliente
    elems.append(Paragraph("<b>CLIENTE</b>", ParagraphStyle("SecHdr", parent=normal,
                            fontSize=10, textColor=colors.HexColor("#1E3A5F"))))
    cli_data = [
        ["Razón Social:", co.get("cliente_nombre", ""), "RUC/CI:", co.get("cliente_ruc", "")],
        ["Dirección:", co.get("cliente_dir") or "—", "Email:", co.get("cliente_email") or "—"],
    ]
    cli_table = Table(cli_data, colWidths=[70, 160, 50, 120])
    cli_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.gray),
        ("TEXTCOLOR", (2, 0), (2, -1), colors.gray),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elems.append(cli_table)
    elems.append(Spacer(1, 6*mm))

    # Detalles tabla
    det_header = ["#", "Código", "Descripción", "Cant.", "P.Unit.", "Dto%", "IVA%", "Total"]
    det_rows = [det_header]
    for i, d in enumerate(detalles, 1):
        det_rows.append([
            str(i),
            d.get("codigo") or "",
            (d.get("descripcion") or d.get("prod_descripcion") or "")[:50],
            f"{float(d['cantidad']):,.2f}",
            f"${float(d['precio_unitario']):,.4f}",
            f"{float(d['descuento_pct']):,.1f}",
            f"{float(d['iva_porcentaje']):,.0f}",
            f"${float(d['total']):,.2f}",
        ])

    col_w = [22, 60, 160, 40, 55, 35, 35, 60]
    det_table = Table(det_rows, colWidths=col_w, repeatRows=1)
    det_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563EB")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9FAFB")]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elems.append(det_table)
    elems.append(Spacer(1, 5*mm))

    # Totales
    fmt = lambda v: f"${float(v or 0):,.2f}"
    totales_data = [
        ["", "", "Subtotal 0%:", fmt(co["subtotal_0"])],
        ["", "", "Subtotal IVA:", fmt(co["subtotal_iva"])],
        ["", "", "IVA:", fmt(co["iva"])],
        ["", "", "TOTAL:", fmt(co["total"])],
    ]
    tot_table = Table(totales_data, colWidths=[160, 100, 80, 70])
    tot_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("FONTNAME", (2, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (2, -1), (-1, -1), 11),
        ("LINEABOVE", (2, -1), (-1, -1), 1, colors.HexColor("#2563EB")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elems.append(tot_table)

    # Observaciones
    if co.get("observaciones"):
        elems.append(Spacer(1, 6*mm))
        elems.append(Paragraph("<b>Observaciones:</b>", small))
        elems.append(Paragraph(co["observaciones"], small))

    # Pie
    elems.append(Spacer(1, 10*mm))
    elems.append(Paragraph(
        "Este documento es una cotización/proforma y no tiene validez tributaria.",
        ParagraphStyle("Footer", parent=small, fontSize=8, textColor=colors.gray)
    ))

    doc.build(elems)
    return buf.getvalue()


@router.get("/{cid}/pdf")
def descargar_pdf(cid: int, u=Depends(get_current_user)):
    # Validar que existe
    co = query_one("SELECT numero FROM ven_cotizaciones WHERE id=%s", (cid,))
    if not co:
        raise HTTPException(404, "Cotización no encontrada")

    pdf_bytes = _generar_pdf_cotizacion(cid)
    if not pdf_bytes:
        raise HTTPException(500, "Error generando PDF")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="Cotizacion_{co["numero"]}.pdf"'
        },
    )
