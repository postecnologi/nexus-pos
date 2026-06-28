"""
Router Retenciones — Comprobantes de Retención Ecuador (tipo 07)
Maneja retenciones emitidas (a proveedores) y recibidas (de clientes).
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from database import query, query_one, execute, insert
from auth import get_current_user
from typing import Optional
from pydantic import BaseModel
from datetime import date

router = APIRouter(prefix="/api/retenciones", tags=["Retenciones"])

# ── Códigos de retención comunes Ecuador ────────────────────
CODIGOS_IVA = [
    {"codigo": "1",  "porcentaje": 10,   "descripcion": "10% IVA"},
    {"codigo": "2",  "porcentaje": 20,   "descripcion": "20% IVA"},
    {"codigo": "3",  "porcentaje": 30,   "descripcion": "30% IVA (Bienes)"},
    {"codigo": "4",  "porcentaje": 70,   "descripcion": "70% IVA (Servicios)"},
    {"codigo": "5",  "porcentaje": 100,  "descripcion": "100% IVA"},
    {"codigo": "7",  "porcentaje": 0,    "descripcion": "No retener IVA (0%)"},
]

CODIGOS_RENTA = [
    {"codigo": "303", "porcentaje": 10,    "descripcion": "10% Honorarios profesionales"},
    {"codigo": "304", "porcentaje": 8,     "descripcion": "8% Servicios predomina intelecto"},
    {"codigo": "307", "porcentaje": 2,     "descripcion": "2% Servicios publicidad"},
    {"codigo": "309", "porcentaje": 1,     "descripcion": "1% Transporte"},
    {"codigo": "310", "porcentaje": 1.75,  "descripcion": "1.75% Transferencia bienes muebles"},
    {"codigo": "312", "porcentaje": 1,     "descripcion": "1% Compra bienes no producidos"},
    {"codigo": "320", "porcentaje": 1.75,  "descripcion": "1.75% Arrendamiento bienes inmuebles"},
    {"codigo": "322", "porcentaje": 2.75,  "descripcion": "2.75% Seguros"},
    {"codigo": "332", "porcentaje": 2,     "descripcion": "2% Otras compras bienes"},
    {"codigo": "340", "porcentaje": 1.75,  "descripcion": "1.75% Otras retenciones"},
    {"codigo": "344", "porcentaje": 1,     "descripcion": "1% Otras compras servicios"},
]

# ── Modelos ─────────────────────────────────────────────────

class RetencionDetalleIn(BaseModel):
    tipo_impuesto: str      # IVA, RENTA
    codigo_retencion: str
    porcentaje: float
    base_imponible: float

class RetencionEmitidaIn(BaseModel):
    proveedor_id: int
    compra_id: Optional[int] = None
    fecha_emision: Optional[str] = None
    observaciones: Optional[str] = None
    detalles: list            # List of RetencionDetalleIn dicts

class RetencionRecibidaIn(BaseModel):
    cliente_id: int
    factura_id: Optional[int] = None
    numero: str
    numero_autorizacion: str
    fecha_emision: Optional[str] = None
    observaciones: Optional[str] = None
    detalles: list


# ── 1. Códigos de retención ────────────────────────────────
@router.get("/codigos")
def get_codigos_retencion(u=Depends(get_current_user)):
    """Retorna los códigos de retención comunes agrupados por IVA y RENTA."""
    return {
        "IVA": CODIGOS_IVA,
        "RENTA": CODIGOS_RENTA,
    }


# ── 2. Listar emitidas ─────────────────────────────────────
@router.get("/emitidas")
def get_emitidas(
    fecha_ini: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    proveedor_id: Optional[int] = None,
    busqueda: Optional[str] = None,
    u=Depends(get_current_user),
):
    conds = ["r.tipo='EMITIDA'", "r.estado != 'ELIMINADA'"]
    params = []

    suc_id = u.get("sucursal_id")
    if suc_id:
        conds.append("r.sucursal_id=%s")
        params.append(suc_id)

    if fecha_ini:
        conds.append("DATE(r.fecha_emision) >= %s")
        params.append(fecha_ini)
    if fecha_fin:
        conds.append("DATE(r.fecha_emision) <= %s")
        params.append(fecha_fin)
    if proveedor_id:
        conds.append("r.proveedor_id = %s")
        params.append(proveedor_id)
    if busqueda:
        conds.append("(p.razon_social ILIKE %s OR r.numero ILIKE %s OR p.identificacion ILIKE %s)")
        params += [f"%{busqueda}%"] * 3

    where = "WHERE " + " AND ".join(conds)

    rows = query(f"""
        SELECT r.*,
               p.razon_social AS proveedor_nombre,
               p.identificacion AS proveedor_ruc,
               COALESCE(
                   (SELECT SUM(d.valor_retenido) FROM sri_retencion_detalles d
                    WHERE d.retencion_id=r.id AND d.tipo_impuesto='IVA'), 0
               ) AS iva_retenido,
               COALESCE(
                   (SELECT SUM(d.valor_retenido) FROM sri_retencion_detalles d
                    WHERE d.retencion_id=r.id AND d.tipo_impuesto='RENTA'), 0
               ) AS renta_retenido
        FROM sri_retenciones r
        LEFT JOIN com_proveedores p ON p.id = r.proveedor_id
        {where}
        ORDER BY r.fecha_emision DESC, r.id DESC
        LIMIT 200
    """, params)
    return rows


# ── 3. Listar recibidas ────────────────────────────────────
@router.get("/recibidas")
def get_recibidas(
    fecha_ini: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    cliente_id: Optional[int] = None,
    busqueda: Optional[str] = None,
    u=Depends(get_current_user),
):
    conds = ["r.tipo='RECIBIDA'", "r.estado != 'ELIMINADA'"]
    params = []

    suc_id = u.get("sucursal_id")
    if suc_id:
        conds.append("r.sucursal_id=%s")
        params.append(suc_id)

    if fecha_ini:
        conds.append("DATE(r.fecha_emision) >= %s")
        params.append(fecha_ini)
    if fecha_fin:
        conds.append("DATE(r.fecha_emision) <= %s")
        params.append(fecha_fin)
    if cliente_id:
        conds.append("r.cliente_id = %s")
        params.append(cliente_id)
    if busqueda:
        conds.append("(c.razon_social ILIKE %s OR r.numero ILIKE %s OR c.identificacion ILIKE %s)")
        params += [f"%{busqueda}%"] * 3

    where = "WHERE " + " AND ".join(conds)

    rows = query(f"""
        SELECT r.*,
               c.razon_social AS cliente_nombre,
               c.identificacion AS cliente_ruc,
               COALESCE(
                   (SELECT SUM(d.valor_retenido) FROM sri_retencion_detalles d
                    WHERE d.retencion_id=r.id AND d.tipo_impuesto='IVA'), 0
               ) AS iva_retenido,
               COALESCE(
                   (SELECT SUM(d.valor_retenido) FROM sri_retencion_detalles d
                    WHERE d.retencion_id=r.id AND d.tipo_impuesto='RENTA'), 0
               ) AS renta_retenido
        FROM sri_retenciones r
        LEFT JOIN ven_clientes c ON c.id = r.cliente_id
        {where}
        ORDER BY r.fecha_emision DESC, r.id DESC
        LIMIT 200
    """, params)
    return rows


# ── 4. Próximo número ──────────────────────────────────────
@router.get("/proximo-numero")
def proximo_numero(u=Depends(get_current_user)):
    suc_id = u.get("sucursal_id")
    suc = (
        query_one("SELECT * FROM sys_sucursales WHERE id=%s", (suc_id,))
        if suc_id else
        query_one("SELECT * FROM sys_sucursales WHERE es_principal=true AND activa=true LIMIT 1")
    )
    if not suc:
        return {"numero": "001-001-000000001", "secuencial": 1}
    seq = int(suc.get("secuencial_retencion") or 1)
    cod_est = suc.get("codigo_establecimiento") or "001"
    pto_emis = suc.get("punto_emision") or "001"
    return {
        "numero": f"{cod_est}-{pto_emis}-{str(seq).zfill(9)}",
        "secuencial": seq,
    }


# ── 5. Crear retención emitida ─────────────────────────────
@router.post("/emitidas")
def crear_emitida(body: RetencionEmitidaIn, u=Depends(get_current_user)):
    if not body.detalles:
        raise HTTPException(400, "Debe agregar al menos un detalle de retención")

    # Proveedor
    prov = query_one("SELECT * FROM com_proveedores WHERE id=%s", (body.proveedor_id,))
    if not prov:
        raise HTTPException(404, "Proveedor no encontrado")

    # Sucursal y secuencial
    suc_id = u.get("sucursal_id")
    suc = (
        query_one("SELECT * FROM sys_sucursales WHERE id=%s", (suc_id,))
        if suc_id else
        query_one("SELECT * FROM sys_sucursales WHERE es_principal=true AND activa=true LIMIT 1")
    )
    if not suc:
        raise HTTPException(400, "No hay sucursal configurada")

    suc_id = suc["id"]
    seq = int(suc.get("secuencial_retencion") or 1)
    cod_est = suc.get("codigo_establecimiento") or "001"
    pto_emis = suc.get("punto_emision") or "001"
    numero = f"{cod_est}-{pto_emis}-{str(seq).zfill(9)}"

    fecha_emision = body.fecha_emision or str(date.today())
    periodo_fiscal = fecha_emision[:7]  # YYYY-MM

    # Generar clave de acceso SRI (tipo 07)
    empresa = query_one("SELECT * FROM sys_empresas WHERE activa=true LIMIT 1")
    clave_acceso = None
    if empresa:
        from sri.utils import generar_clave_acceso, TIPO_DOC
        ruc = empresa.get("ruc") or ""
        ambiente = empresa.get("ambiente_sri") or "1"
        serie6 = f"{cod_est}{pto_emis}"[:6].zfill(6)
        fecha_raw = fecha_emision
        partes = str(fecha_raw)[:10].split("-")
        fecha_ddmmaaaa = f"{partes[2]}{partes[1]}{partes[0]}" if len(partes) == 3 else "01012026"
        cod_numerico = str(seq).zfill(8)[-8:]
        try:
            clave_acceso = generar_clave_acceso(
                fecha_ddmmaaaa, TIPO_DOC["RETENCION"], ruc, ambiente,
                serie6, seq, cod_numerico
            )
        except:
            pass

    # Calcular detalles
    total_retenido = 0.0
    detalles_calc = []
    for d in body.detalles:
        det = RetencionDetalleIn(**(d if isinstance(d, dict) else d.dict()))
        valor = round(det.base_imponible * det.porcentaje / 100, 2)
        total_retenido += valor
        detalles_calc.append({
            "tipo_impuesto": det.tipo_impuesto.upper(),
            "codigo_retencion": det.codigo_retencion,
            "porcentaje": det.porcentaje,
            "base_imponible": round(det.base_imponible, 2),
            "valor_retenido": valor,
        })

    total_retenido = round(total_retenido, 2)

    # Insertar cabecera
    rid = insert("""
        INSERT INTO sri_retenciones
            (tipo, numero, compra_id, proveedor_id, sucursal_id,
             usuario_id, fecha_emision, periodo_fiscal, estado,
             estado_sri, clave_acceso, total_retenido, observaciones)
        VALUES ('EMITIDA', %s, %s, %s, %s, %s, %s, %s,
                'EMITIDA', 'NO_ENVIADA', %s, %s, %s)
    """, (
        numero, body.compra_id, body.proveedor_id, suc_id,
        u["id"], fecha_emision, periodo_fiscal,
        clave_acceso, total_retenido, body.observaciones,
    ))

    # Insertar detalles
    for det in detalles_calc:
        insert("""
            INSERT INTO sri_retencion_detalles
                (retencion_id, tipo_impuesto, codigo_retencion,
                 porcentaje, base_imponible, valor_retenido)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            rid, det["tipo_impuesto"], det["codigo_retencion"],
            det["porcentaje"], det["base_imponible"], det["valor_retenido"],
        ))

    # Incrementar secuencial
    execute("UPDATE sys_sucursales SET secuencial_retencion = %s WHERE id = %s",
            (seq + 1, suc_id))

    return {
        "id": rid,
        "numero": numero,
        "total_retenido": total_retenido,
        "clave_acceso": clave_acceso,
        "msg": "Retención emitida creada correctamente",
    }


# ── 6. Crear retención recibida ────────────────────────────
@router.post("/recibidas")
def crear_recibida(body: RetencionRecibidaIn, u=Depends(get_current_user)):
    if not body.detalles:
        raise HTTPException(400, "Debe agregar al menos un detalle de retención")
    if not body.numero_autorizacion or len(body.numero_autorizacion.strip()) < 10:
        raise HTTPException(400, "El numero de autorizacion del SRI es obligatorio")

    # Cliente
    cli = query_one("SELECT * FROM ven_clientes WHERE id=%s", (body.cliente_id,))
    if not cli:
        raise HTTPException(404, "Cliente no encontrado")

    suc_id = u.get("sucursal_id")
    if not suc_id:
        suc = query_one("SELECT id FROM sys_sucursales WHERE es_principal=true AND activa=true LIMIT 1")
        suc_id = suc["id"] if suc else None

    fecha_emision = body.fecha_emision or str(date.today())
    periodo_fiscal = fecha_emision[:7]

    # Calcular detalles
    total_retenido = 0.0
    detalles_calc = []
    for d in body.detalles:
        det = RetencionDetalleIn(**(d if isinstance(d, dict) else d.dict()))
        valor = round(det.base_imponible * det.porcentaje / 100, 2)
        total_retenido += valor
        detalles_calc.append({
            "tipo_impuesto": det.tipo_impuesto.upper(),
            "codigo_retencion": det.codigo_retencion,
            "porcentaje": det.porcentaje,
            "base_imponible": round(det.base_imponible, 2),
            "valor_retenido": valor,
        })

    total_retenido = round(total_retenido, 2)

    rid = insert("""
        INSERT INTO sri_retenciones
            (tipo, numero, numero_autorizacion, factura_id, cliente_id, sucursal_id,
             usuario_id, fecha_emision, periodo_fiscal, estado,
             estado_sri, total_retenido, observaciones)
        VALUES ('RECIBIDA', %s, %s, %s, %s, %s, %s, %s, %s,
                'EMITIDA', 'N/A', %s, %s)
    """, (
        body.numero, body.numero_autorizacion.strip(),
        body.factura_id, body.cliente_id, suc_id,
        u["id"], fecha_emision, periodo_fiscal,
        total_retenido, body.observaciones,
    ))

    for det in detalles_calc:
        insert("""
            INSERT INTO sri_retencion_detalles
                (retencion_id, tipo_impuesto, codigo_retencion,
                 porcentaje, base_imponible, valor_retenido)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            rid, det["tipo_impuesto"], det["codigo_retencion"],
            det["porcentaje"], det["base_imponible"], det["valor_retenido"],
        ))

    # If linked to a sale invoice, reduce the CXC saldo
    cxc_msg = None
    if body.factura_id:
        cxc = query_one(
            "SELECT id, saldo FROM fin_cxc WHERE factura_id=%s AND saldo>0",
            (body.factura_id,))
        if cxc:
            nuevo_saldo = max(0, float(cxc['saldo']) - total_retenido)
            execute("UPDATE fin_cxc SET saldo=%s WHERE id=%s", (nuevo_saldo, cxc['id']))
            cxc_msg = f"CXC actualizada: saldo anterior ${float(cxc['saldo']):.2f} -> nuevo saldo ${nuevo_saldo:.2f}"

    return {
        "id": rid,
        "numero": body.numero,
        "total_retenido": total_retenido,
        "msg": "Retencion recibida registrada correctamente",
        "cxc_msg": cxc_msg,
    }


# ── Resumen (DEBE ir antes de /{rid}) ─────────────────────
@router.get("/resumen")
def resumen_retenciones_ruta(
    anio: Optional[int] = None,
    u=Depends(get_current_user),
):
    anio_val = anio or date.today().year
    emitidas = query_one("SELECT COUNT(*) AS cantidad, COALESCE(SUM(total_retenido),0) AS total FROM sri_retenciones WHERE tipo='EMITIDA' AND estado!='ANULADA' AND EXTRACT(YEAR FROM fecha_emision)=%s", (anio_val,))
    recibidas = query_one("SELECT COUNT(*) AS cantidad, COALESCE(SUM(total_retenido),0) AS total FROM sri_retenciones WHERE tipo='RECIBIDA' AND estado!='ANULADA' AND EXTRACT(YEAR FROM fecha_emision)=%s", (anio_val,))
    por_mes = query("SELECT tipo, TO_CHAR(fecha_emision,'YYYY-MM') AS mes, COUNT(*) AS cantidad, COALESCE(SUM(total_retenido),0) AS total FROM sri_retenciones WHERE estado!='ANULADA' AND EXTRACT(YEAR FROM fecha_emision)=%s GROUP BY tipo, TO_CHAR(fecha_emision,'YYYY-MM') ORDER BY mes", (anio_val,))
    return {"anio": anio_val, "emitidas": emitidas, "recibidas": recibidas, "por_mes": por_mes}

# ── 7. Detalle de retención ────────────────────────────────
@router.get("/{rid}")
def get_retencion(rid: int, u=Depends(get_current_user)):
    r = query_one("""
        SELECT r.*,
               p.razon_social AS proveedor_nombre,
               p.identificacion AS proveedor_ruc,
               p.direccion AS proveedor_dir,
               p.tipo_identificacion AS proveedor_tipo_id,
               c.razon_social AS cliente_nombre,
               c.identificacion AS cliente_ruc,
               c.direccion AS cliente_dir,
               c.tipo_identificacion AS cliente_tipo_id,
               emp.razon_social AS empresa_nombre,
               emp.ruc AS empresa_ruc,
               emp.direccion AS empresa_dir,
               emp.logo_base64
        FROM sri_retenciones r
        LEFT JOIN com_proveedores p ON p.id = r.proveedor_id
        LEFT JOIN ven_clientes c ON c.id = r.cliente_id
        LEFT JOIN sys_empresas emp ON emp.activa = true
        WHERE r.id = %s
    """, (rid,))
    if not r:
        raise HTTPException(404, "Retención no encontrada")

    r["detalles"] = query("""
        SELECT * FROM sri_retencion_detalles
        WHERE retencion_id = %s ORDER BY id
    """, (rid,))

    # Info de compra/factura relacionada
    if r.get("compra_id"):
        compra = query_one("SELECT num_documento, fecha, total FROM com_compras WHERE id=%s",
                           (r["compra_id"],))
        r["compra_ref"] = compra
    if r.get("factura_id"):
        factura = query_one("SELECT numero_factura, fecha_emision, total FROM ven_facturas WHERE id=%s",
                            (r["factura_id"],))
        r["factura_ref"] = factura

    return r


# ── 8. Anular retención ────────────────────────────────────
@router.patch("/{rid}/anular")
def anular_retencion(rid: int, u=Depends(get_current_user)):
    r = query_one("SELECT estado FROM sri_retenciones WHERE id=%s", (rid,))
    if not r:
        raise HTTPException(404, "Retención no encontrada")
    if r["estado"] == "ANULADA":
        raise HTTPException(400, "La retención ya está anulada")
    execute("UPDATE sri_retenciones SET estado='ANULADA' WHERE id=%s", (rid,))
    return {"msg": "Retención anulada correctamente"}


# ── 9. XML de retención (tipo 07) ──────────────────────────
@router.get("/{rid}/xml")
def descargar_xml_retencion(rid: int, u=Depends(get_current_user)):
    r = query_one("""
        SELECT r.*,
               p.razon_social AS sujeto_razon,
               p.identificacion AS sujeto_ruc,
               p.tipo_identificacion AS sujeto_tipo_id,
               p.direccion AS sujeto_dir
        FROM sri_retenciones r
        LEFT JOIN com_proveedores p ON p.id = r.proveedor_id
        WHERE r.id = %s
    """, (rid,))
    if not r:
        raise HTTPException(404)
    if r["tipo"] != "EMITIDA":
        raise HTTPException(400, "Solo se puede generar XML para retenciones emitidas")

    empresa = query_one("SELECT * FROM sys_empresas WHERE activa=true LIMIT 1")
    if not empresa:
        raise HTTPException(400, "Configure la empresa primero")

    suc = query_one("SELECT * FROM sys_sucursales WHERE id=%s", (r.get("sucursal_id"),))

    detalles = query("""
        SELECT * FROM sri_retencion_detalles WHERE retencion_id=%s ORDER BY id
    """, (rid,))

    # Info doc sustento (compra)
    doc_sustento = None
    if r.get("compra_id"):
        doc_sustento = query_one(
            "SELECT num_documento, fecha, total FROM com_compras WHERE id=%s",
            (r["compra_id"],))

    from sri.xml_generator_retencion import generar_xml_retencion
    xml_str = generar_xml_retencion(r, empresa, suc, detalles, doc_sustento)

    num = (r.get("numero") or "retencion").replace("-", "")
    return Response(
        content=xml_str,
        media_type="application/xml",
        headers={"Content-Disposition": f'attachment; filename="RET_{num}.xml"'},
    )


# ── 10. PDF de retención ───────────────────────────────────
@router.get("/{rid}/pdf")
def descargar_pdf_retencion(rid: int, u=Depends(get_current_user)):
    r = query_one("""
        SELECT r.*,
               p.razon_social AS proveedor_nombre,
               p.identificacion AS proveedor_ruc,
               p.tipo_identificacion AS proveedor_tipo_id,
               p.direccion AS proveedor_dir,
               c.razon_social AS cliente_nombre,
               c.identificacion AS cliente_ruc,
               c.tipo_identificacion AS cliente_tipo_id,
               c.direccion AS cliente_dir
        FROM sri_retenciones r
        LEFT JOIN com_proveedores p ON p.id = r.proveedor_id
        LEFT JOIN ven_clientes c ON c.id = r.cliente_id
        WHERE r.id = %s
    """, (rid,))
    if not r:
        raise HTTPException(404)

    empresa = query_one("SELECT * FROM sys_empresas WHERE activa=true LIMIT 1")
    detalles = query("""
        SELECT * FROM sri_retencion_detalles WHERE retencion_id=%s ORDER BY id
    """, (rid,))

    from sri.ride_retencion import generar_ride_retencion
    pdf_bytes = generar_ride_retencion(r, empresa, detalles)

    num = (r.get("numero") or "retencion").replace("-", "")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="RET_{num}.pdf"'},
    )


# ── 11. Auto-sugerir retencion desde compra ───────────────
@router.post("/auto-sugerir")
def sugerir_retencion(compra_id: int, u=Depends(get_current_user)):
    """Auto-suggests retention lines based on purchase and supplier type."""
    compra = query_one("""
        SELECT c.*, p.tipo_contribuyente, p.obligado_contabilidad,
               p.tipo_identificacion, p.razon_social, p.identificacion
        FROM com_compras c
        JOIN com_proveedores p ON p.id=c.proveedor_id
        WHERE c.id=%s
    """, (compra_id,))
    if not compra:
        raise HTTPException(404, "Compra no encontrada")

    sugerencias = []
    sub_iva = float(compra.get('subtotal_iva', 0) or 0)
    iva = float(compra.get('iva', 0) or 0)
    sub_0 = float(compra.get('subtotal_0', 0) or 0)
    total_base = sub_iva + sub_0

    tipo_contrib = (compra.get('tipo_contribuyente') or 'NATURAL').upper()
    obligado = compra.get('obligado_contabilidad', False)

    # IVA retention suggestions
    if iva > 0:
        if tipo_contrib == 'NATURAL' and not obligado:
            sugerencias.append({
                "tipo_impuesto": "IVA", "codigo_retencion": "5",
                "porcentaje": 100, "base_imponible": sub_iva,
                "descripcion": "100% IVA - Persona natural no obligada contabilidad",
            })
        elif tipo_contrib == 'NATURAL' and obligado:
            sugerencias.append({
                "tipo_impuesto": "IVA", "codigo_retencion": "3",
                "porcentaje": 30, "base_imponible": sub_iva,
                "descripcion": "30% IVA - Bienes",
            })
        elif tipo_contrib == 'JURIDICA':
            sugerencias.append({
                "tipo_impuesto": "IVA", "codigo_retencion": "3",
                "porcentaje": 30, "base_imponible": sub_iva,
                "descripcion": "30% IVA - Bienes a sociedad",
            })

    # Renta retention suggestions
    if total_base > 0:
        if tipo_contrib == 'NATURAL' and not obligado:
            sugerencias.append({
                "tipo_impuesto": "RENTA", "codigo_retencion": "340",
                "porcentaje": 1.75, "base_imponible": total_base,
                "descripcion": "1.75% Renta - Otras retenciones",
            })
        else:
            sugerencias.append({
                "tipo_impuesto": "RENTA", "codigo_retencion": "312",
                "porcentaje": 1, "base_imponible": total_base,
                "descripcion": "1% Renta - Compra bienes",
            })

    # Auto-calculate valor_retenido for each
    for s in sugerencias:
        s["valor_retenido"] = round(s["base_imponible"] * s["porcentaje"] / 100, 2)

    return {
        "compra": {
            "id": compra['id'],
            "num_documento": compra.get('num_documento', ''),
            "proveedor": compra.get('razon_social', ''),
            "ruc": compra.get('identificacion', ''),
        },
        "tipo_contribuyente": tipo_contrib,
        "obligado_contabilidad": obligado,
        "sugerencias": sugerencias,
        "total_sugerido": round(sum(s['valor_retenido'] for s in sugerencias), 2),
    }


# ── 12. Resumen de retenciones ────────────────────────────
@router.get("/resumen")
def resumen_retenciones(
    anio: Optional[int] = None,
    u=Depends(get_current_user),
):
    anio_val = anio or date.today().year
    emitidas = query_one("""
        SELECT COUNT(*) AS cantidad,
               COALESCE(SUM(total_retenido), 0) AS total
        FROM sri_retenciones
        WHERE tipo='EMITIDA' AND estado != 'ANULADA'
          AND EXTRACT(YEAR FROM fecha_emision) = %s
    """, (anio_val,))
    recibidas = query_one("""
        SELECT COUNT(*) AS cantidad,
               COALESCE(SUM(total_retenido), 0) AS total
        FROM sri_retenciones
        WHERE tipo='RECIBIDA' AND estado != 'ANULADA'
          AND EXTRACT(YEAR FROM fecha_emision) = %s
    """, (anio_val,))
    por_mes = query("""
        SELECT tipo,
               TO_CHAR(fecha_emision, 'YYYY-MM') AS mes,
               COUNT(*) AS cantidad,
               COALESCE(SUM(total_retenido), 0) AS total
        FROM sri_retenciones
        WHERE estado != 'ANULADA'
          AND EXTRACT(YEAR FROM fecha_emision) = %s
        GROUP BY tipo, TO_CHAR(fecha_emision, 'YYYY-MM')
        ORDER BY mes
    """, (anio_val,))
    return {
        "anio": anio_val,
        "emitidas": emitidas,
        "recibidas": recibidas,
        "por_mes": por_mes,
    }


# ── 13. Procesar retencion en SRI (firmar + enviar + autorizar) ──
@router.post("/{rid}/procesar-sri")
def procesar_retencion_sri(rid: int, u=Depends(get_current_user)):
    """Full flow: sign XML -> send to SRI -> query authorization."""
    ret = query_one("SELECT * FROM sri_retenciones WHERE id=%s", (rid,))
    if not ret:
        raise HTTPException(404, "Retencion no encontrada")
    if ret.get('tipo') != 'EMITIDA':
        raise HTTPException(400, "Solo retenciones emitidas pueden ser procesadas en SRI")
    if ret.get('estado_sri') == 'AUTORIZADA':
        raise HTTPException(400, "La retencion ya esta autorizada")

    empresa = query_one("SELECT * FROM sys_empresas WHERE activa=true LIMIT 1")
    if not empresa:
        raise HTTPException(400, "Configure la empresa primero")
    ambiente = empresa.get('ambiente_sri', '1')

    suc = query_one("SELECT * FROM sys_sucursales WHERE id=%s", (ret.get('sucursal_id'),))
    detalles = query("SELECT * FROM sri_retencion_detalles WHERE retencion_id=%s ORDER BY id", (rid,))

    doc_sustento = None
    if ret.get('compra_id'):
        doc_sustento = query_one(
            "SELECT num_documento, fecha, total FROM com_compras WHERE id=%s",
            (ret['compra_id'],))

    # 1. Generate XML
    from sri.xml_generator_retencion import generar_xml_retencion
    xml_str = generar_xml_retencion(ret, empresa, suc, detalles, doc_sustento)

    # 2. Sign
    try:
        from sri.firma import firmar_xml
        xml_firmado = firmar_xml(xml_str)
    except Exception as e:
        execute("UPDATE sri_retenciones SET estado_sri='ERROR_FIRMA' WHERE id=%s", (rid,))
        return {"estado": "ERROR_FIRMA", "msg": str(e)}

    # 3. Send to SRI
    from sri.ws_client import enviar_comprobante, consultar_autorizacion
    result_envio = enviar_comprobante(xml_firmado, ambiente)

    if not result_envio.get('recibido'):
        execute("UPDATE sri_retenciones SET estado_sri='RECHAZADA' WHERE id=%s", (rid,))
        return {"estado": "RECHAZADA", "mensajes": result_envio.get('mensajes', [])}

    # 4. Query authorization
    clave = ret.get('clave_acceso', '')
    result_aut = consultar_autorizacion(clave, ambiente)

    if result_aut.get('autorizado'):
        execute(
            "UPDATE sri_retenciones SET estado_sri='AUTORIZADA', numero_autorizacion=%s WHERE id=%s",
            (result_aut.get('numero_autorizacion'), rid))
        return {
            "estado": "AUTORIZADA",
            "numero_autorizacion": result_aut.get('numero_autorizacion'),
        }

    execute("UPDATE sri_retenciones SET estado_sri='RECIBIDA' WHERE id=%s", (rid,))
    return {"estado": "RECIBIDA", "mensajes": result_aut.get('mensajes', [])}


# ── 14. Consultar autorizacion SRI ───────────────────────
@router.get("/{rid}/consultar-sri")
def consultar_retencion_sri(rid: int, u=Depends(get_current_user)):
    """Query retention authorization status in SRI."""
    ret = query_one("SELECT clave_acceso, estado_sri FROM sri_retenciones WHERE id=%s", (rid,))
    if not ret:
        raise HTTPException(404, "Retencion no encontrada")
    if not ret.get('clave_acceso'):
        raise HTTPException(400, "Sin clave de acceso")

    empresa = query_one("SELECT ambiente_sri FROM sys_empresas WHERE activa=true LIMIT 1")
    from sri.ws_client import consultar_autorizacion
    result = consultar_autorizacion(
        ret['clave_acceso'],
        empresa.get('ambiente_sri', '1') if empresa else '1',
    )

    if result.get('autorizado'):
        execute(
            "UPDATE sri_retenciones SET estado_sri='AUTORIZADA', numero_autorizacion=%s WHERE id=%s",
            (result.get('numero_autorizacion'), rid))
    return result


# ── 15. Enviar retencion por email al proveedor ──────────
@router.post("/{rid}/enviar-email")
def enviar_retencion_email(rid: int, u=Depends(get_current_user)):
    """Send retention PDF + XML to supplier via email."""
    ret = query_one("""
        SELECT r.*, p.razon_social, p.email, p.identificacion
        FROM sri_retenciones r
        LEFT JOIN com_proveedores p ON p.id=r.proveedor_id
        WHERE r.id=%s
    """, (rid,))
    if not ret:
        raise HTTPException(404, "Retencion no encontrada")
    if not ret.get('email'):
        raise HTTPException(400, "El proveedor no tiene email registrado")

    empresa = query_one("SELECT * FROM sys_empresas WHERE activa=true LIMIT 1")
    empresa_nombre = empresa.get('razon_social', '') if empresa else ''

    # Generate PDF
    det_data = query_one("""
        SELECT r.*,
               p.razon_social AS proveedor_nombre,
               p.identificacion AS proveedor_ruc,
               p.tipo_identificacion AS proveedor_tipo_id,
               p.direccion AS proveedor_dir
        FROM sri_retenciones r
        LEFT JOIN com_proveedores p ON p.id = r.proveedor_id
        WHERE r.id = %s
    """, (rid,))
    detalles = query("SELECT * FROM sri_retencion_detalles WHERE retencion_id=%s ORDER BY id", (rid,))

    from sri.ride_retencion import generar_ride_retencion
    pdf_bytes = generar_ride_retencion(det_data, empresa, detalles)

    # Generate XML (only for emitidas)
    xml_str = None
    if ret.get('tipo') == 'EMITIDA':
        suc = query_one("SELECT * FROM sys_sucursales WHERE id=%s", (ret.get('sucursal_id'),))
        doc_sustento = None
        if ret.get('compra_id'):
            doc_sustento = query_one(
                "SELECT num_documento, fecha, total FROM com_compras WHERE id=%s",
                (ret['compra_id'],))
        from sri.xml_generator_retencion import generar_xml_retencion
        xml_str = generar_xml_retencion(det_data, empresa, suc, detalles, doc_sustento)

    numero = ret.get('numero', '')
    html = f"""<div style="font-family:Arial;padding:20px;">
        <h2>{empresa_nombre}</h2>
        <p>Estimado/a <b>{ret['razon_social']}</b>,</p>
        <p>Adjunto el comprobante de retencion N. <b>{numero}</b></p>
        <p>Total retenido: <b>${float(ret.get('total_retenido', 0)):.2f}</b></p>
    </div>"""

    from sri.email_sender import enviar_comprobante_email
    result = enviar_comprobante_email(
        destinatario_email=ret['email'],
        destinatario_nombre=ret['razon_social'],
        asunto=f"Retencion {numero} - {empresa_nombre}",
        cuerpo_html=html,
        pdf_bytes=pdf_bytes,
        pdf_nombre=f"RET_{numero.replace('-', '')}.pdf",
        xml_str=xml_str,
        xml_nombre=f"RET_{numero.replace('-', '')}.xml",
    )
    return result


# ── 16. Generar asiento contable para retencion ──────────
@router.post("/{rid}/asiento-contable")
def generar_asiento_retencion(rid: int, u=Depends(get_current_user)):
    """Generate accounting entry for a retention."""
    ret = query_one("SELECT * FROM sri_retenciones WHERE id=%s", (rid,))
    if not ret:
        raise HTTPException(404, "Retencion no encontrada")

    detalles = query("SELECT * FROM sri_retencion_detalles WHERE retencion_id=%s", (rid,))
    if not detalles:
        raise HTTPException(400, "La retencion no tiene detalles")

    from routers.contabilidad import crear_asiento_automatico

    lineas = []
    if ret['tipo'] == 'EMITIDA':
        # We withhold from supplier: Debit CXP, Credit RetencionesPorPagar
        for d in detalles:
            valor = float(d['valor_retenido'])
            if d['tipo_impuesto'] == 'IVA':
                lineas.append(("2.1.01", f"Ret IVA {d['porcentaje']}%", valor, 0))
                lineas.append(("2.1.03", f"Ret IVA por pagar", 0, valor))
            else:
                lineas.append(("2.1.01", f"Ret Renta {d['codigo_retencion']}", valor, 0))
                lineas.append(("2.1.03", f"Ret Renta por pagar", 0, valor))
    else:
        # Client withholds from us: Debit Anticipo IR/IVA, Credit CXC
        for d in detalles:
            valor = float(d['valor_retenido'])
            lineas.append(("1.1.06", f"Ret recibida {d['tipo_impuesto']} {d['porcentaje']}%", valor, 0))
            lineas.append(("1.1.03", f"Ret recibida", 0, valor))

    asiento_id = crear_asiento_automatico(
        str(ret['fecha_emision']), f"Retencion {ret['numero']}",
        'RETENCION', 'RETENCION', rid, lineas, u['id'],
    )

    return {"msg": "Asiento contable generado", "asiento_id": asiento_id}
