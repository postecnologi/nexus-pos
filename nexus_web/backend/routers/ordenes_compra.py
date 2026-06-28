"""
Ordenes de Compra — Pedidos a proveedores que NO afectan inventario ni CXP.
Cuando se aprueba, se puede convertir en compra.
"""
from fastapi import APIRouter, Depends, HTTPException
from database import query, query_one, execute, insert
from auth import get_current_user
from typing import Optional
from pydantic import BaseModel
from datetime import date

router = APIRouter(prefix="/api/ordenes-compra", tags=["OrdenesCompra"])


@router.get("/proximo-numero")
def proximo_numero(u=Depends(get_current_user)):
    suc_id = u.get("sucursal_id")
    suc = query_one("SELECT secuencial_orden_compra FROM sys_sucursales WHERE id=%s", (suc_id,)) if suc_id else \
          query_one("SELECT secuencial_orden_compra FROM sys_sucursales WHERE activa=true LIMIT 1")
    sec = (suc.get("secuencial_orden_compra", 0) or 0) + 1 if suc else 1
    return {"numero": f"OC-{sec:06d}"}


class OrdenCompraIn(BaseModel):
    proveedor_id: int
    sucursal_id: Optional[int] = None
    bodega_id: Optional[int] = None
    numero_factura_prov: Optional[str] = None
    fecha_emision: Optional[str] = None
    fecha_vencimiento: Optional[str] = None
    plazo_dias: int = 30
    descuento_global_pct: float = 0
    observaciones: Optional[str] = None
    detalles: list


@router.get("")
def listar(busqueda: str = "", estado: str = "", limit: int = 50, u=Depends(get_current_user)):
    conds = ["1=1"]; params = []
    if busqueda:
        conds.append("(oc.numero ILIKE %s OR p.razon_social ILIKE %s)")
        params += [f"%{busqueda}%"] * 2
    if estado:
        conds.append("oc.estado = %s"); params.append(estado)
    where = " AND ".join(conds)
    params.append(limit)
    return query(f"""
        SELECT oc.*, p.razon_social as proveedor_nombre
        FROM com_ordenes_compra oc
        LEFT JOIN com_proveedores p ON p.id = oc.proveedor_id
        WHERE {where} ORDER BY oc.id DESC LIMIT %s
    """, params)


@router.post("")
def crear(f: OrdenCompraIn, u=Depends(get_current_user)):
    if not f.detalles:
        raise HTTPException(400, "Debe tener al menos un producto")

    suc_id = f.sucursal_id or u.get("sucursal_id")
    suc = query_one("SELECT * FROM sys_sucursales WHERE id=%s", (suc_id,)) if suc_id else \
          query_one("SELECT * FROM sys_sucursales WHERE activa=true LIMIT 1")
    if not suc:
        raise HTTPException(400, "Sucursal no encontrada")

    sec = (suc.get("secuencial_orden_compra", 0) or 0) + 1
    numero = f"OC-{sec:06d}"

    subtotal_0 = 0; subtotal_iva = 0; iva_total = 0; total = 0
    desc_pct = f.descuento_global_pct or 0

    for d in f.detalles:
        cant = float(d.get("cantidad", 1))
        precio = float(d.get("precio_unitario", 0))
        iva_pct = float(d.get("iva_porcentaje", 15))
        desc_linea = float(d.get("descuento_pct", 0))
        sub = cant * precio * (1 - desc_linea / 100) * (1 - desc_pct / 100)
        iva_val = sub * iva_pct / 100
        if iva_pct > 0: subtotal_iva += sub
        else: subtotal_0 += sub
        iva_total += iva_val
        total += sub + iva_val

    oc_id = insert("""
        INSERT INTO com_ordenes_compra
            (numero, proveedor_id, sucursal_id, bodega_id,
             fecha_emision, fecha_vencimiento, plazo_dias,
             subtotal_0, subtotal_iva, iva, total,
             descuento_global_pct, observaciones, estado, usuario_id, created_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'PENDIENTE',%s,NOW())
    """, (numero, f.proveedor_id, suc_id, f.bodega_id,
          f.fecha_emision or str(date.today()),
          f.fecha_vencimiento, f.plazo_dias,
          round(subtotal_0, 2), round(subtotal_iva, 2),
          round(iva_total, 2), round(total, 2),
          desc_pct, f.observaciones, u["id"]))

    for d in f.detalles:
        cant = float(d.get("cantidad", 1))
        precio = float(d.get("precio_unitario", 0))
        iva_pct = float(d.get("iva_porcentaje", 15))
        desc_linea = float(d.get("descuento_pct", 0))
        sub = cant * precio * (1 - desc_linea / 100) * (1 - desc_pct / 100)
        iva_val = sub * iva_pct / 100
        insert("""
            INSERT INTO com_orden_compra_detalles
                (orden_compra_id, producto_id, descripcion, cantidad, precio_unitario,
                 descuento_pct, subtotal, iva_porcentaje, iva_valor, total)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (oc_id, d.get("producto_id"), d.get("descripcion", ""),
              cant, precio, desc_linea, round(sub, 2), iva_pct,
              round(iva_val, 2), round(sub + iva_val, 2)))

    execute("UPDATE sys_sucursales SET secuencial_orden_compra=%s WHERE id=%s", (sec, suc_id))

    return {"id": oc_id, "numero_compra": numero, "total": round(total, 2)}


@router.get("/{oid}")
def detalle(oid: int, u=Depends(get_current_user)):
    oc = query_one("""
        SELECT oc.*, p.razon_social as proveedor_nombre
        FROM com_ordenes_compra oc
        LEFT JOIN com_proveedores p ON p.id = oc.proveedor_id
        WHERE oc.id = %s
    """, (oid,))
    if not oc: raise HTTPException(404)
    oc["detalles"] = query("""
        SELECT d.*, pr.codigo as producto_codigo, pr.descripcion as producto_nombre
        FROM com_orden_compra_detalles d
        LEFT JOIN inv_productos pr ON pr.id = d.producto_id
        WHERE d.orden_compra_id = %s ORDER BY d.id
    """, (oid,))
    return oc


@router.post("/{oid}/aprobar")
def aprobar(oid: int, u=Depends(get_current_user)):
    oc = query_one("SELECT estado FROM com_ordenes_compra WHERE id=%s", (oid,))
    if not oc: raise HTTPException(404)
    if oc["estado"] != "PENDIENTE":
        raise HTTPException(400, "Solo se pueden aprobar ordenes pendientes")
    execute("UPDATE com_ordenes_compra SET estado='APROBADA' WHERE id=%s", (oid,))
    return {"msg": "Orden aprobada"}


@router.post("/{oid}/anular")
def anular(oid: int, u=Depends(get_current_user)):
    oc = query_one("SELECT estado FROM com_ordenes_compra WHERE id=%s", (oid,))
    if not oc: raise HTTPException(404)
    if oc["estado"] == "CONVERTIDA":
        raise HTTPException(400, "No se puede anular una orden ya convertida en compra")
    execute("UPDATE com_ordenes_compra SET estado='ANULADA' WHERE id=%s", (oid,))
    return {"msg": "Orden anulada"}
