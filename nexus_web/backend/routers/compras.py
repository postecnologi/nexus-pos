from fastapi import APIRouter, Depends, HTTPException
from database import query, query_one, execute, insert
from auth import get_current_user
from typing import Optional
from pydantic import BaseModel

router = APIRouter(prefix="/api/compras", tags=["Compras"])


class CompraDetalleIn(BaseModel):
    producto_id:     int
    bodega_id:       Optional[int] = None
    cantidad:        float
    precio_unitario: float
    descuento_pct:   float = 0
    iva_porcentaje:  float = 15.0

class CompraIn(BaseModel):
    proveedor_id:          int
    sucursal_id:           Optional[int] = None
    bodega_id:             Optional[int] = None
    numero_factura_prov:   Optional[str] = None
    fecha_emision:         Optional[str] = None
    fecha_vencimiento:     Optional[str] = None
    descuento_global_pct:  float = 0
    observaciones:         Optional[str] = None
    plazo_dias:            int = 30
    detalles:              list


@router.get("/proximo-numero")
def proximo_numero_compra(u=Depends(get_current_user)):
    suc_id = u.get("sucursal_id")
    suc = (
        query_one("SELECT * FROM sys_sucursales WHERE id=%s", (suc_id,))
        if suc_id else
        query_one("SELECT * FROM sys_sucursales WHERE es_principal=true AND activa=true LIMIT 1")
    )
    if not suc:
        return {"numero": "001-001-000000001"}
    ultimo = query_one("SELECT MAX(id) as max_id FROM com_compras")
    seq = int(ultimo["max_id"] or 0) + 1
    cod_est  = suc.get("codigo_establecimiento") or "001"
    pto_emis = suc.get("punto_emision")          or "001"
    return {
        "numero":     f"C-{cod_est}-{pto_emis}-{str(seq).zfill(9)}",
        "secuencial": seq,
    }


@router.get("")
def get_compras(
    busqueda:   Optional[str] = None,
    fecha_ini:  Optional[str] = None,
    fecha_fin:  Optional[str] = None,
    u=Depends(get_current_user)
):
    conds  = ["c.estado IN ('CONFIRMADA','BORRADOR')"]
    params = []
    if busqueda:
        conds.append("(p.razon_social ILIKE %s OR c.num_documento ILIKE %s)")
        params += [f"%{busqueda}%"]*2
    if fecha_ini: conds.append("DATE(c.fecha)>=%s"); params.append(fecha_ini)
    if fecha_fin: conds.append("DATE(c.fecha)<=%s"); params.append(fecha_fin)
    where = "WHERE " + " AND ".join(conds)
    return query(f"""
        SELECT c.*,
               p.razon_social as proveedor_nombre,
               p.identificacion as proveedor_ruc,
               s.nombre as sucursal_nombre,
               b.nombre as bodega_nombre,
               cxp.saldo as cxp_saldo,
               cxp.id    as cxp_id
        FROM com_compras c
        JOIN com_proveedores p    ON p.id = c.proveedor_id
        LEFT JOIN sys_sucursales s ON s.id = c.sucursal_id
        LEFT JOIN inv_bodegas b    ON b.id = c.bodega_id
        LEFT JOIN fin_cxp cxp     ON cxp.compra_id = c.id
        {where}
        ORDER BY c.fecha DESC, c.id DESC
        LIMIT 200
    """, params)


@router.post("")
def crear_compra(f: CompraIn, u=Depends(get_current_user)):
    if not f.detalles:
        raise HTTPException(400, "La compra debe tener al menos un producto")

    # Sucursal y secuencial
    suc_id = f.sucursal_id or u.get("sucursal_id")
    suc = (
        query_one("SELECT * FROM sys_sucursales WHERE id=%s", (suc_id,))
        if suc_id else
        query_one("SELECT * FROM sys_sucursales WHERE es_principal=true AND activa=true LIMIT 1")
    )
    if not suc:
        raise HTTPException(400, "No hay sucursal configurada")

    # Obtener el ultimo numero de compra para generar el siguiente
    ultimo = query_one("SELECT MAX(id) as max_id FROM com_compras")
    seq = int(ultimo["max_id"] or 0) + 1
    cod_est  = suc.get("codigo_establecimiento") or "001"
    pto_emis = suc.get("punto_emision")          or "001"
    num_compra = f"C-{cod_est}-{pto_emis}-{str(seq).zfill(9)}"

    # IVA empresa
    emp     = query_one("SELECT iva_porcentaje FROM sys_empresas WHERE activa=true LIMIT 1")
    iva_pct = float(emp["iva_porcentaje"]) if emp else 15.0

    # Bodega por defecto
    bodega_default = f.bodega_id
    if not bodega_default and suc_id:
        bod = query_one("""
            SELECT id FROM inv_bodegas
            WHERE sucursal_id=%s AND es_principal=true AND activa=true LIMIT 1
        """, (suc_id,))
        if bod: bodega_default = bod["id"]

    # Calcular totales
    subtotal_0 = subtotal_iva = 0.0
    for det in f.detalles:
        pu    = float(det["precio_unitario"])
        cant  = float(det["cantidad"])
        dp    = float(det.get("descuento_pct", 0))
        dg    = float(f.descuento_global_pct)
        iv    = float(det.get("iva_porcentaje", iva_pct))
        linea = cant * pu * (1-dp/100) * (1-dg/100)
        if iv == 0: subtotal_0   += linea
        else:       subtotal_iva += linea

    iva_monto    = round(subtotal_iva * iva_pct / 100, 2)
    total        = round(subtotal_0 + subtotal_iva + iva_monto, 2)
    subtotal_0   = round(subtotal_0,   2)
    subtotal_iva = round(subtotal_iva, 2)

    # Fecha vencimiento
    from datetime import date, timedelta
    plazo = int(f.plazo_dias or 30)
    fecha_venc = f.fecha_vencimiento or str(date.today() + timedelta(days=plazo))

    # Insertar cabecera
    # Fecha de emision — puede ser diferente a hoy
    fecha_emis = f.fecha_emision or str(date.today())

    compra_id = insert("""
        INSERT INTO com_compras
            (num_documento, proveedor_id, sucursal_id, bodega_id,
             fecha, subtotal_0, subtotal_iva, iva, total,
             descuento, observaciones, estado, usuario_id)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'CONFIRMADA',%s)
    """, (
        num_compra, f.proveedor_id, suc_id, bodega_default,
        fecha_emis, subtotal_0, subtotal_iva, iva_monto, total,
        f.descuento_global_pct, f.observaciones, u["id"]
    ))

    # Detalles + aumentar stock
    for det in f.detalles:
        pu     = float(det["precio_unitario"])
        cant   = float(det["cantidad"])
        dp     = float(det.get("descuento_pct", 0))
        dg     = float(f.descuento_global_pct)
        iv     = float(det.get("iva_porcentaje", iva_pct))
        linea  = round(cant * pu * (1-dp/100) * (1-dg/100), 2)
        iva_l  = round(linea * iv/100, 2) if iv > 0 else 0.0
        bod_id = det.get("bodega_id") or bodega_default

        # Costo anterior
        try:
            prod_ant = query_one("SELECT costo FROM inv_productos WHERE id=%s", (det["producto_id"],))
            costo_ant = float(prod_ant["costo"]) if prod_ant and prod_ant.get("costo") else 0.0
        except Exception:
            costo_ant = 0.0

        insert("""
            INSERT INTO com_compra_detalles
                (compra_id, producto_id, cantidad, precio_unitario,
                 descuento, subtotal, iva_porcentaje, iva_valor, total)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            compra_id, det["producto_id"], cant, pu, dp,
            linea, iv, iva_l, round(linea+iva_l, 2)
        ))

        # Aumentar stock en bodega
        if bod_id:
            try:
                existe = query_one(
                    "SELECT id FROM inv_stock WHERE producto_id=%s AND bodega_id=%s",
                    (det["producto_id"], bod_id))
                if existe:
                    execute("""
                        UPDATE inv_stock SET cantidad = cantidad + %s
                        WHERE producto_id=%s AND bodega_id=%s
                    """, (cant, det["producto_id"], bod_id))
                else:
                    insert("""
                        INSERT INTO inv_stock (producto_id, bodega_id, cantidad)
                        VALUES (%s,%s,%s)
                    """, (det["producto_id"], bod_id, cant))
            except: pass

        # Registrar series si vienen en el detalle
        for serie_num in (det.get("series") or []):
            serie_num = str(serie_num).upper().strip()
            if not serie_num: continue
            try:
                # Verificar que no exista ya
                existe_serie = query_one(
                    "SELECT id FROM inv_series WHERE serie=%s AND producto_id=%s",
                    (serie_num, det["producto_id"]))
                if not existe_serie:
                    insert("""
                        INSERT INTO inv_series
                            (producto_id, bodega_id, serie, estado, compra_id)
                        VALUES (%s,%s,%s,'DISPONIBLE',%s)
                    """, (det["producto_id"], bod_id, serie_num, compra_id))
            except: pass

        # Actualizar costo del producto (costo promedio)
        try:
            execute("""
                UPDATE inv_productos SET costo=%s
                WHERE id=%s
            """, (pu, det["producto_id"]))
        except: pass

    # Crear CXP
    insert("""
        INSERT INTO fin_cxp
            (compra_id, proveedor_id, fecha_emision,
             fecha_vencimiento, valor_total, valor_pagado, saldo, estado)
        VALUES (%s,%s,%s,%s,%s,0,%s,'PENDIENTE')
    """, (compra_id, f.proveedor_id, fecha_emis, fecha_venc, total, total))

    # Incrementar secuencial
    # No hay secuencial en sys_sucursales para compras — se usa MAX(id)
    pass

    return {
        "id":            compra_id,
        "num_documento": num_compra,
        "numero_compra": num_compra,
        "total":         total,
        "msg":           "Compra ingresada correctamente"
    }


@router.get("/{cid}/detalle")
def detalle_compra(cid: int, u=Depends(get_current_user)):
    c = query_one("""
        SELECT c.*,
               c.num_documento as numero_compra,
               p.razon_social as proveedor_nombre,
               p.identificacion as proveedor_ruc,
               p.direccion as proveedor_dir,
               p.telefono as proveedor_tel,
               p.email as proveedor_email,
               s.nombre as sucursal_nombre,
               b.nombre as bodega_nombre,
               emp.razon_social as empresa_nombre,
               emp.ruc as empresa_ruc,
               emp.logo_base64
        FROM com_compras c
        JOIN com_proveedores p    ON p.id = c.proveedor_id
        LEFT JOIN sys_sucursales s ON s.id = c.sucursal_id
        LEFT JOIN inv_bodegas b    ON b.id = c.bodega_id
        LEFT JOIN sys_empresas emp ON emp.activa=true
        WHERE c.id=%s LIMIT 1
    """, (cid,))
    if not c: raise HTTPException(404, "Compra no encontrada")
    c["detalles"] = query("""
        SELECT cd.*, p.descripcion, p.codigo
        FROM com_compra_detalles cd
        JOIN inv_productos p ON p.id = cd.producto_id
        WHERE cd.compra_id=%s
    """, (cid,))
    return c


@router.patch("/{cid}/anular")
def anular_compra(cid: int, u=Depends(get_current_user)):
    c = query_one("SELECT estado, sucursal_id, bodega_id FROM com_compras WHERE id=%s", (cid,))
    if not c: raise HTTPException(404)
    if c["estado"] == "ANULADA": raise HTTPException(400, "Ya esta anulada")
    execute("UPDATE com_compras SET estado='ANULADA' WHERE id=%s", (cid,))
    # Revertir stock
    detalles = query("""
        SELECT producto_id, cantidad, bodega_id
        FROM com_compra_detalles WHERE compra_id=%s
    """, (cid,))
    for d in detalles:
        if d["bodega_id"]:
            try:
                execute("""
                    UPDATE inv_stock SET cantidad = cantidad - %s
                    WHERE producto_id=%s AND bodega_id=%s
                """, (d["cantidad"], d["producto_id"], d["bodega_id"]))
            except: pass
    # Anular CXP
    execute("UPDATE fin_cxp SET estado='ANULADA', saldo=0 WHERE compra_id=%s", (cid,))
    return {"msg": "Compra anulada y stock revertido"}


# ── ESTADISTICAS PROVEEDOR ──────────────────────────────
@router.get("/estadisticas-proveedor/{pid}")
def estadisticas_proveedor(pid: int, u=Depends(get_current_user)):
    """Supplier evaluation: purchase history, avg delivery time, amounts."""
    stats = query_one("""
        SELECT COUNT(*) as total_compras,
               COALESCE(SUM(total),0) as monto_total,
               COALESCE(AVG(total),0) as promedio_compra,
               MIN(fecha) as primera_compra,
               MAX(fecha) as ultima_compra
        FROM com_compras WHERE proveedor_id=%s AND estado='CONFIRMADA'
    """, (pid,))

    productos = query("""
        SELECT p.descripcion, SUM(cd.cantidad) as total_comprado,
               ROUND(AVG(cd.precio_unitario)::numeric,2) as precio_promedio
        FROM com_compra_detalles cd
        JOIN com_compras c ON c.id=cd.compra_id
        JOIN inv_productos p ON p.id=cd.producto_id
        WHERE c.proveedor_id=%s AND c.estado='CONFIRMADA'
        GROUP BY p.descripcion ORDER BY total_comprado DESC LIMIT 10
    """, (pid,))

    return {"proveedor_id": pid, "estadisticas": stats, "top_productos": productos}


# ── COMPRAS PENDIENTES DE RECEPCION ─────────────────────
@router.get("/pendientes-recepcion")
def compras_pendientes(u=Depends(get_current_user)):
    """Purchases pending full reception."""
    return query("""
        SELECT c.*, p.razon_social as proveedor_nombre
        FROM com_compras c
        JOIN com_proveedores p ON p.id=c.proveedor_id
        WHERE c.estado='CONFIRMADA' AND c.estado_recepcion='PARCIAL'
        ORDER BY c.fecha DESC
    """)


# ── HISTORIAL DE PRECIOS DE COMPRA ──────────────────────
@router.get("/historial-precios/{producto_id}")
def historial_precios_compra(producto_id: int, u=Depends(get_current_user)):
    """Purchase price history for a product across suppliers."""
    return query("""
        SELECT cd.precio_unitario, DATE(c.fecha) as fecha,
               p.razon_social as proveedor, c.num_documento
        FROM com_compra_detalles cd
        JOIN com_compras c ON c.id=cd.compra_id
        JOIN com_proveedores p ON p.id=c.proveedor_id
        WHERE cd.producto_id=%s AND c.estado='CONFIRMADA'
        ORDER BY c.fecha DESC LIMIT 50
    """, (producto_id,))
