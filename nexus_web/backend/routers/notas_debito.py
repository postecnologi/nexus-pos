"""
Router Notas de Debito — Documento electronico tipo 05 Ecuador
Cargos adicionales al cliente: intereses mora, ajustes precio, etc.
Referencia siempre a una factura original.
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from database import query, query_one, execute, insert
from auth import get_current_user
from typing import Optional
from pydantic import BaseModel
from datetime import date

router = APIRouter(prefix="/api/notas-debito", tags=["Notas Debito"])


# ── Modelos ─────────────────────────────────────────────────
class NDDetalleIn(BaseModel):
    descripcion: str
    cantidad: float = 1
    precio_unitario: float
    iva_porcentaje: float = 15.0

class NotaDebitoIn(BaseModel):
    cliente_id: int
    factura_id: Optional[int] = None
    motivo: str
    detalles: list  # List of NDDetalleIn dicts


# ── 1. Listar notas de debito ──────────────────────────────
@router.get("/")
def get_notas_debito(
    fecha_ini: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    cliente_id: Optional[int] = None,
    busqueda: Optional[str] = None,
    u=Depends(get_current_user),
):
    conds = ["1=1"]
    params = []

    suc_id = u.get("sucursal_id")
    if suc_id:
        conds.append("nd.sucursal_id=%s")
        params.append(suc_id)

    if fecha_ini:
        conds.append("nd.fecha_emision >= %s")
        params.append(fecha_ini)
    if fecha_fin:
        conds.append("nd.fecha_emision <= %s")
        params.append(fecha_fin)
    if cliente_id:
        conds.append("nd.cliente_id = %s")
        params.append(cliente_id)
    if busqueda:
        conds.append("(c.razon_social ILIKE %s OR nd.numero ILIKE %s OR nd.motivo ILIKE %s)")
        params += [f"%{busqueda}%"] * 3

    where = "WHERE " + " AND ".join(conds)

    return query(f"""
        SELECT nd.*,
               c.razon_social AS cliente_nombre,
               c.identificacion AS cliente_ruc,
               f.numero_factura
        FROM ven_notas_debito nd
        LEFT JOIN ven_clientes c ON c.id = nd.cliente_id
        LEFT JOIN ven_facturas f ON f.id = nd.factura_id
        {where}
        ORDER BY nd.fecha_emision DESC, nd.id DESC
        LIMIT 200
    """, params)


# ── 2. Proximo numero ──────────────────────────────────────
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
    seq = int(suc.get("secuencial_nota_debito") or 1)
    cod_est = suc.get("codigo_establecimiento") or "001"
    pto_emis = suc.get("punto_emision") or "001"
    return {
        "numero": f"{cod_est}-{pto_emis}-{str(seq).zfill(9)}",
        "secuencial": seq,
    }


# ── 3. Crear nota de debito ────────────────────────────────
@router.post("/")
def crear_nota_debito(body: NotaDebitoIn, u=Depends(get_current_user)):
    if not body.detalles:
        raise HTTPException(400, "Debe incluir al menos un detalle")

    # Validar cliente
    cliente = query_one("SELECT * FROM ven_clientes WHERE id=%s", (body.cliente_id,))
    if not cliente:
        raise HTTPException(404, "Cliente no encontrado")

    # Validar factura si se proporciona
    factura = None
    if body.factura_id:
        factura = query_one(
            "SELECT * FROM ven_facturas WHERE id=%s",
            (body.factura_id,))
        if not factura:
            raise HTTPException(404, "Factura referenciada no encontrada")

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
    seq = int(suc.get("secuencial_nota_debito") or 1)
    cod_est = suc.get("codigo_establecimiento") or "001"
    pto_emis = suc.get("punto_emision") or "001"
    numero = f"{cod_est}-{pto_emis}-{str(seq).zfill(9)}"

    emp = query_one("SELECT * FROM sys_empresas WHERE activa=true LIMIT 1")
    iva_pct_default = float(emp["iva_porcentaje"]) if emp and emp.get("iva_porcentaje") else 15.0

    # Calcular totales
    sub0 = 0.0
    subiva = 0.0
    detalles_calc = []
    for d in body.detalles:
        det = NDDetalleIn(**(d if isinstance(d, dict) else d.dict()))
        cant = det.cantidad
        pu = det.precio_unitario
        iv_pct = det.iva_porcentaje
        subtotal_linea = round(cant * pu, 2)
        iva_val = round(subtotal_linea * iv_pct / 100, 2) if iv_pct > 0 else 0.0
        total_linea = round(subtotal_linea + iva_val, 2)

        if iv_pct == 0:
            sub0 += subtotal_linea
        else:
            subiva += subtotal_linea

        detalles_calc.append({
            "descripcion": det.descripcion,
            "cantidad": cant,
            "precio_unitario": pu,
            "iva_porcentaje": iv_pct,
            "subtotal": subtotal_linea,
            "iva_valor": iva_val,
            "total": total_linea,
        })

    iva_monto = round(subiva * iva_pct_default / 100, 2)
    total = round(sub0 + subiva + iva_monto, 2)

    # Generar clave de acceso SRI (tipo 05)
    clave_acceso = None
    if emp:
        try:
            from sri.utils import generar_clave_acceso, TIPO_DOC
            ruc = emp.get("ruc") or ""
            ambiente = emp.get("ambiente_sri") or "1"
            serie6 = f"{cod_est}{pto_emis}"[:6].zfill(6)
            fecha_e = date.today().strftime("%d%m%Y")
            cod_numerico = str(seq).zfill(8)[-8:]
            clave_acceso = generar_clave_acceso(
                fecha_e, TIPO_DOC["NOTA_DEBITO"], ruc, ambiente,
                serie6, seq, cod_numerico
            )
        except Exception as e:
            print(f"Error generando clave SRI para ND: {e}")

    # Insertar cabecera
    nd_id = insert("""
        INSERT INTO ven_notas_debito
            (numero, cliente_id, factura_id, sucursal_id, usuario_id,
             fecha_emision, subtotal_0, subtotal_iva, iva, total,
             motivo, estado, estado_sri, clave_acceso)
        VALUES (%s, %s, %s, %s, %s, CURRENT_DATE, %s, %s, %s, %s,
                %s, 'EMITIDA', 'NO_ENVIADA', %s)
    """, (
        numero, body.cliente_id, body.factura_id, suc_id, u["id"],
        round(sub0, 2), round(subiva, 2), iva_monto, total,
        body.motivo, clave_acceso,
    ))

    # Insertar detalles
    for det in detalles_calc:
        insert("""
            INSERT INTO ven_nota_debito_detalles
                (nota_debito_id, descripcion, cantidad, precio_unitario,
                 iva_porcentaje, subtotal, iva_valor, total)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            nd_id, det["descripcion"], det["cantidad"], det["precio_unitario"],
            det["iva_porcentaje"], det["subtotal"], det["iva_valor"], det["total"],
        ))

    # Incrementar secuencial
    execute("UPDATE sys_sucursales SET secuencial_nota_debito = %s WHERE id = %s",
            (seq + 1, suc_id))

    # Crear CXC si hay total > 0
    if total > 0:
        try:
            insert("""
                INSERT INTO fin_cxc
                    (cliente_id, tipo, numero_documento, fecha_emision,
                     fecha_vencimiento, monto, saldo, estado, usuario_id)
                VALUES (%s, 'NOTA_DEBITO', %s, CURRENT_DATE,
                        CURRENT_DATE + INTERVAL '30 days', %s, %s, 'PENDIENTE', %s)
            """, (body.cliente_id, numero, total, total, u["id"]))
        except Exception as e:
            print(f"Error creando CXC para ND: {e}")

    return {
        "id": nd_id,
        "numero": numero,
        "total": total,
        "clave_acceso": clave_acceso,
        "msg": "Nota de debito emitida correctamente",
    }


# ── 4. Detalle de nota de debito ───────────────────────────
@router.get("/{nid}")
def get_nota_debito(nid: int, u=Depends(get_current_user)):
    nd = query_one("""
        SELECT nd.*,
               c.razon_social AS cliente_nombre,
               c.identificacion AS cliente_ruc,
               c.tipo_identificacion AS cliente_tipo_id,
               c.direccion AS cliente_dir,
               c.email AS cliente_email,
               f.numero_factura,
               f.fecha_emision AS factura_fecha,
               emp.razon_social AS empresa_nombre,
               emp.ruc AS empresa_ruc,
               emp.direccion AS empresa_dir,
               emp.logo_base64
        FROM ven_notas_debito nd
        LEFT JOIN ven_clientes c ON c.id = nd.cliente_id
        LEFT JOIN ven_facturas f ON f.id = nd.factura_id
        LEFT JOIN sys_empresas emp ON emp.activa = true
        WHERE nd.id = %s
    """, (nid,))
    if not nd:
        raise HTTPException(404, "Nota de debito no encontrada")

    nd["detalles"] = query("""
        SELECT * FROM ven_nota_debito_detalles
        WHERE nota_debito_id = %s ORDER BY id
    """, (nid,))

    return nd


# ── 5. Anular nota de debito ──────────────────────────────
@router.patch("/{nid}/anular")
def anular_nota_debito(nid: int, u=Depends(get_current_user)):
    nd = query_one("SELECT estado, numero FROM ven_notas_debito WHERE id=%s", (nid,))
    if not nd:
        raise HTTPException(404, "Nota de debito no encontrada")
    if nd["estado"] == "ANULADA":
        raise HTTPException(400, "La nota de debito ya esta anulada")
    execute("UPDATE ven_notas_debito SET estado='ANULADA' WHERE id=%s", (nid,))

    # Anular CXC relacionada
    try:
        execute("""
            UPDATE fin_cxc SET estado='ANULADA'
            WHERE tipo='NOTA_DEBITO' AND numero_documento=%s
        """, (nd["numero"],))
    except:
        pass

    return {"msg": "Nota de debito anulada correctamente"}


# ── 6. XML nota de debito (tipo 05) ───────────────────────
@router.get("/{nid}/xml")
def descargar_xml_nota_debito(nid: int, u=Depends(get_current_user)):
    nd = query_one("""
        SELECT nd.*,
               c.razon_social AS cliente_nombre,
               c.identificacion AS cliente_ruc,
               c.tipo_identificacion AS cliente_tipo_id,
               c.direccion AS cliente_dir,
               c.email AS cliente_email
        FROM ven_notas_debito nd
        LEFT JOIN ven_clientes c ON c.id = nd.cliente_id
        WHERE nd.id = %s
    """, (nid,))
    if not nd:
        raise HTTPException(404)

    empresa = query_one("SELECT * FROM sys_empresas WHERE activa=true LIMIT 1")
    if not empresa:
        raise HTTPException(400, "Configure la empresa primero")

    suc = query_one("SELECT * FROM sys_sucursales WHERE id=%s", (nd.get("sucursal_id"),))

    detalles = query("""
        SELECT * FROM ven_nota_debito_detalles WHERE nota_debito_id=%s ORDER BY id
    """, (nid,))

    factura_ref = None
    if nd.get("factura_id"):
        factura_ref = query_one(
            "SELECT numero_factura, fecha_emision, total FROM ven_facturas WHERE id=%s",
            (nd["factura_id"],))

    from sri.xml_generator_nota_debito import generar_xml_nota_debito
    xml_str = generar_xml_nota_debito(nd, empresa, suc, detalles, factura_ref)

    num = (nd.get("numero") or "nota_debito").replace("-", "")
    return Response(
        content=xml_str,
        media_type="application/xml",
        headers={"Content-Disposition": f'attachment; filename="ND_{num}.xml"'},
    )


# ── 7. PDF nota de debito ─────────────────────────────────
@router.get("/{nid}/pdf")
def descargar_pdf_nota_debito(nid: int, u=Depends(get_current_user)):
    nd = query_one("""
        SELECT nd.*,
               c.razon_social AS cliente_nombre,
               c.identificacion AS cliente_ruc,
               c.tipo_identificacion AS cliente_tipo_id,
               c.direccion AS cliente_dir,
               c.email AS cliente_email
        FROM ven_notas_debito nd
        LEFT JOIN ven_clientes c ON c.id = nd.cliente_id
        WHERE nd.id = %s
    """, (nid,))
    if not nd:
        raise HTTPException(404)

    empresa = query_one("SELECT * FROM sys_empresas WHERE activa=true LIMIT 1")
    detalles = query("""
        SELECT * FROM ven_nota_debito_detalles WHERE nota_debito_id=%s ORDER BY id
    """, (nid,))

    from sri.ride_nota_debito import generar_ride_nota_debito
    pdf_bytes = generar_ride_nota_debito(nd, empresa, detalles)

    num = (nd.get("numero") or "nota_debito").replace("-", "")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="ND_{num}.pdf"'},
    )
