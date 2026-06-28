"""
Notas de Venta — Comprobantes internos que NO van al SRI.
Descuentan inventario igual que una factura pero sin secuencial SRI.
"""
from fastapi import APIRouter, Depends, HTTPException
from database import query, query_one, execute, insert
from auth import get_current_user
from typing import Optional
from pydantic import BaseModel
from datetime import date

router = APIRouter(prefix="/api/notas-venta", tags=["NotasVenta"])


class NotaVentaIn(BaseModel):
    cliente_id: int
    vendedor_id: Optional[int] = None
    sucursal_id: Optional[int] = None
    observaciones: Optional[str] = None
    descuento_global_pct: float = 0
    detalles: list
    pagos: list


@router.get("")
def listar_notas(
    busqueda: str = "",
    fecha_ini: str = "",
    fecha_fin: str = "",
    estado: str = "",
    limit: int = 50,
    u=Depends(get_current_user),
):
    conds = ["1=1"]
    params = []
    if busqueda:
        conds.append("(n.numero ILIKE %s OR c.razon_social ILIKE %s)")
        params += [f"%{busqueda}%"] * 2
    if fecha_ini:
        conds.append("n.fecha >= %s")
        params.append(fecha_ini)
    if fecha_fin:
        conds.append("n.fecha <= %s")
        params.append(fecha_fin)
    if estado:
        conds.append("n.estado = %s")
        params.append(estado)
    where = " AND ".join(conds)
    params.append(limit)
    return query(f"""
        SELECT n.*, c.razon_social as cliente_nombre, c.identificacion as cliente_ruc,
               v.nombre as vendedor_nombre
        FROM ven_notas_venta n
        LEFT JOIN ven_clientes c ON c.id = n.cliente_id
        LEFT JOIN ven_vendedores v ON v.id = n.vendedor_id
        WHERE {where}
        ORDER BY n.id DESC LIMIT %s
    """, params)


@router.post("")
def crear_nota_venta(f: NotaVentaIn, u=Depends(get_current_user)):
    if not f.detalles:
        raise HTTPException(400, "Debe tener al menos un producto")

    suc_id = f.sucursal_id or u.get("sucursal_id")
    suc = query_one("SELECT * FROM sys_sucursales WHERE id=%s", (suc_id,)) if suc_id else \
          query_one("SELECT * FROM sys_sucursales WHERE activa=true LIMIT 1")
    if not suc:
        raise HTTPException(400, "Sucursal no encontrada")

    # Generate sequential number
    sec = suc.get("secuencial_nota_venta", 0) or 0
    sec += 1
    numero = f"NV-{sec:06d}"

    # Calculate totals
    subtotal_0 = 0
    subtotal_iva = 0
    iva_total = 0
    total = 0
    desc_pct = f.descuento_global_pct or 0

    for d in f.detalles:
        cant = float(d.get("cantidad", 1))
        precio = float(d.get("precio_unitario", 0))
        iva_pct = float(d.get("iva_porcentaje", 15))
        desc_linea = float(d.get("descuento_pct", 0))
        sub = cant * precio * (1 - desc_linea / 100) * (1 - desc_pct / 100)
        iva_val = sub * iva_pct / 100
        if iva_pct > 0:
            subtotal_iva += sub
        else:
            subtotal_0 += sub
        iva_total += iva_val
        total += sub + iva_val

    # Get bodega
    bod_id = query_one("SELECT id FROM inv_bodegas WHERE es_principal=true AND activa=true LIMIT 1") or \
             query_one("SELECT id FROM inv_bodegas WHERE activa=true LIMIT 1")
    bodega_id = bod_id["id"] if bod_id else None

    # Insert nota de venta
    nota_id = insert("""
        INSERT INTO ven_notas_venta
            (numero, cliente_id, vendedor_id, sucursal_id, bodega_id,
             fecha, subtotal_0, subtotal_iva, iva, total,
             descuento_global_pct, observaciones, estado, usuario_id, created_at)
        VALUES (%s,%s,%s,%s,%s,CURRENT_DATE,%s,%s,%s,%s,%s,%s,'EMITIDA',%s,NOW())
    """, (numero, f.cliente_id, f.vendedor_id, suc_id, bodega_id,
          round(subtotal_0, 2), round(subtotal_iva, 2), round(iva_total, 2), round(total, 2),
          desc_pct, f.observaciones, u["id"]))

    # Insert details and discount stock
    for d in f.detalles:
        cant = float(d.get("cantidad", 1))
        precio = float(d.get("precio_unitario", 0))
        iva_pct = float(d.get("iva_porcentaje", 15))
        desc_linea = float(d.get("descuento_pct", 0))
        sub = cant * precio * (1 - desc_linea / 100) * (1 - desc_pct / 100)
        iva_val = sub * iva_pct / 100

        insert("""
            INSERT INTO ven_nota_venta_detalles
                (nota_venta_id, producto_id, descripcion, cantidad, precio_unitario,
                 descuento_pct, subtotal, iva_porcentaje, iva_valor, total)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (nota_id, d.get("producto_id"), d.get("descripcion", ""),
              cant, precio, desc_linea, round(sub, 2), iva_pct,
              round(iva_val, 2), round(sub + iva_val, 2)))

        # Discount stock
        if d.get("producto_id") and bodega_id:
            execute("""
                UPDATE inv_stock SET cantidad = cantidad - %s
                WHERE producto_id = %s AND bodega_id = %s
            """, (cant, d["producto_id"], bodega_id))

    # Register payments
    for pago in f.pagos:
        insert("""
            INSERT INTO ven_pagos
                (factura_id, forma_pago, monto, referencia, fecha, pendiente_deposito)
            VALUES (%s,%s,%s,%s,CURRENT_DATE,%s)
        """, (nota_id, pago["forma_pago"], pago["monto"],
              pago.get("referencia"), pago["forma_pago"] != "CREDITO"))

    # Update sequential
    execute("UPDATE sys_sucursales SET secuencial_nota_venta=%s WHERE id=%s", (sec, suc_id))

    return {"id": nota_id, "numero": numero, "total": round(total, 2)}


@router.get("/{nid}")
def detalle_nota(nid: int, u=Depends(get_current_user)):
    nota = query_one("""
        SELECT n.*, c.razon_social as cliente_nombre, c.identificacion as cliente_ruc,
               c.direccion as cliente_direccion, c.telefono as cliente_telefono,
               v.nombre as vendedor_nombre, s.nombre as sucursal_nombre
        FROM ven_notas_venta n
        LEFT JOIN ven_clientes c ON c.id = n.cliente_id
        LEFT JOIN ven_vendedores v ON v.id = n.vendedor_id
        LEFT JOIN sys_sucursales s ON s.id = n.sucursal_id
        WHERE n.id = %s
    """, (nid,))
    if not nota:
        raise HTTPException(404, "Nota de venta no encontrada")

    nota["detalles"] = query("""
        SELECT d.*, p.codigo as producto_codigo, p.descripcion as producto_nombre
        FROM ven_nota_venta_detalles d
        LEFT JOIN inv_productos p ON p.id = d.producto_id
        WHERE d.nota_venta_id = %s ORDER BY d.id
    """, (nid,))

    return nota


@router.post("/{nid}/anular")
def anular_nota(nid: int, motivo: str = "Anulada", u=Depends(get_current_user)):
    nota = query_one("SELECT * FROM ven_notas_venta WHERE id=%s", (nid,))
    if not nota:
        raise HTTPException(404)
    if nota["estado"] == "ANULADA":
        raise HTTPException(400, "Ya esta anulada")

    # Return stock
    detalles = query("SELECT * FROM ven_nota_venta_detalles WHERE nota_venta_id=%s", (nid,))
    for d in detalles:
        if d.get("producto_id") and nota.get("bodega_id"):
            execute("""
                UPDATE inv_stock SET cantidad = cantidad + %s
                WHERE producto_id = %s AND bodega_id = %s
            """, (d["cantidad"], d["producto_id"], nota["bodega_id"]))

    execute("""
        UPDATE ven_notas_venta SET estado='ANULADA', observaciones=COALESCE(observaciones,'') || ' | Anulada: ' || %s
        WHERE id=%s
    """, (motivo, nid))

    return {"msg": "Nota de venta anulada, stock devuelto"}
