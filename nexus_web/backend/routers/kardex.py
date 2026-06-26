"""
Módulo Kardex — NEXUS POS
Historial de movimientos de producto (ventas, compras, ajustes,
transferencias, devoluciones) con saldo acumulado.
"""
from fastapi import APIRouter, Depends, HTTPException
from database import query, query_one
from auth import get_current_user
from typing import Optional

router = APIRouter(prefix="/api/kardex", tags=["Kardex"])


# ══════════════════════════════════════════════════════════════
#  1.  GET /api/kardex/resumen  — Top productos por movimiento
#      (debe ir ANTES de /{producto_id} para que FastAPI
#       no lo interprete como un producto_id)
# ══════════════════════════════════════════════════════════════
@router.get("/resumen")
def kardex_resumen(
    fecha_ini: str,
    fecha_fin: str,
    limit: int = 20,
    u=Depends(get_current_user),
):
    """Top productos por cantidad de movimientos en un rango de fechas."""
    sql = """
        WITH movs AS (
            -- Ventas
            SELECT fd.producto_id, 'VENTA' AS tipo, f.fecha_emision::date AS fecha
            FROM ven_factura_detalles fd
            JOIN ven_facturas f ON f.id = fd.factura_id
            WHERE f.estado = 'EMITIDA'
              AND f.fecha_emision::date BETWEEN %s AND %s

            UNION ALL
            -- Compras
            SELECT cd.producto_id, 'COMPRA', c.fecha::date
            FROM com_compra_detalles cd
            JOIN com_compras c ON c.id = cd.compra_id
            WHERE c.estado = 'CONFIRMADA'
              AND c.fecha::date BETWEEN %s AND %s

            UNION ALL
            -- Ajustes
            SELECT ad.producto_id, 'AJUSTE', a.fecha::date
            FROM inv_ajuste_detalles ad
            JOIN inv_ajustes a ON a.id = ad.ajuste_id
            WHERE a.fecha::date BETWEEN %s AND %s

            UNION ALL
            -- Transferencias
            SELECT td.producto_id, 'TRANSFERENCIA', t.fecha::date
            FROM inv_transferencia_detalles td
            JOIN inv_transferencias t ON t.id = td.transferencia_id
            WHERE t.fecha::date BETWEEN %s AND %s

            UNION ALL
            -- Devoluciones
            SELECT dd.producto_id, 'DEVOLUCION', d.fecha::date
            FROM ven_devolucion_detalles dd
            JOIN ven_devoluciones d ON d.id = dd.devolucion_id
            WHERE d.fecha::date BETWEEN %s AND %s
        )
        SELECT m.producto_id,
               p.codigo,
               p.descripcion,
               COALESCE(ma.nombre, '') AS marca,
               COUNT(*) AS num_movimientos,
               COALESCE((SELECT SUM(s.cantidad) FROM inv_stock s
                         WHERE s.producto_id = m.producto_id), 0) AS stock_actual
        FROM movs m
        JOIN inv_productos p ON p.id = m.producto_id
        LEFT JOIN inv_marcas ma ON ma.id = p.marca_id
        GROUP BY m.producto_id, p.codigo, p.descripcion, ma.nombre
        ORDER BY num_movimientos DESC
        LIMIT %s
    """
    params = [fecha_ini, fecha_fin] * 5 + [limit]
    return query(sql, params)


# ══════════════════════════════════════════════════════════════
#  2.  GET /api/kardex/{producto_id}  — Historial de movimientos
# ══════════════════════════════════════════════════════════════
@router.get("/{producto_id}")
def kardex_producto(
    producto_id: int,
    bodega_id:  Optional[int] = None,
    fecha_ini:  Optional[str] = None,
    fecha_fin:  Optional[str] = None,
    tipo:       Optional[str] = None,
    u=Depends(get_current_user),
):
    # ── Verificar que el producto existe ──────────────────────
    prod = query_one("""
        SELECT p.id, p.codigo, p.descripcion,
               COALESCE(m.nombre,'') AS marca,
               COALESCE(c.nombre,'') AS categoria,
               COALESCE((SELECT SUM(s.cantidad) FROM inv_stock s
                         WHERE s.producto_id = p.id), 0) AS stock_actual
        FROM inv_productos p
        LEFT JOIN inv_marcas    m ON m.id = p.marca_id
        LEFT JOIN inv_categorias c ON c.id = p.categoria_id
        WHERE p.id = %s
    """, [producto_id])
    if not prod:
        raise HTTPException(404, "Producto no encontrado")

    tipos_solicitar = []
    if tipo and tipo.upper() != "ALL":
        tipos_solicitar = [tipo.upper()]
    else:
        tipos_solicitar = ["VENTA", "COMPRA", "AJUSTE", "TRANSFERENCIA", "DEVOLUCION"]

    movimientos = []

    # ── VENTAS ────────────────────────────────────────────────
    if "VENTA" in tipos_solicitar:
        conds = [
            "fd.producto_id = %s",
            "f.estado = 'EMITIDA'",
        ]
        params = [producto_id]
        if bodega_id:
            conds.append("f.bodega_id = %s")
            params.append(bodega_id)
        if fecha_ini:
            conds.append("f.fecha_emision::date >= %s")
            params.append(fecha_ini)
        if fecha_fin:
            conds.append("f.fecha_emision::date <= %s")
            params.append(fecha_fin)
        where = " AND ".join(conds)
        rows = query(f"""
            SELECT f.fecha_emision::date AS fecha,
                   'VENTA' AS tipo,
                   f.numero_factura AS documento,
                   COALESCE(cl.razon_social, '') AS detalle,
                   fd.cantidad,
                   COALESCE(b.nombre, '') AS bodega_nombre
            FROM ven_factura_detalles fd
            JOIN ven_facturas f       ON f.id  = fd.factura_id
            LEFT JOIN ven_clientes cl ON cl.id = f.cliente_id
            LEFT JOIN inv_bodegas  b  ON b.id  = f.bodega_id
            WHERE {where}
        """, params)
        for r in rows:
            movimientos.append({
                "fecha":         str(r["fecha"]),
                "tipo":          "VENTA",
                "documento":     r["documento"] or "",
                "detalle":       r["detalle"],
                "entrada":       0,
                "salida":        float(r["cantidad"]),
                "bodega_nombre": r.get("bodega_nombre") or "",
            })

    # ── COMPRAS ───────────────────────────────────────────────
    if "COMPRA" in tipos_solicitar:
        conds = [
            "cd.producto_id = %s",
            "c.estado = 'CONFIRMADA'",
        ]
        params = [producto_id]
        if bodega_id:
            conds.append("c.bodega_id = %s")
            params.append(bodega_id)
        if fecha_ini:
            conds.append("c.fecha::date >= %s")
            params.append(fecha_ini)
        if fecha_fin:
            conds.append("c.fecha::date <= %s")
            params.append(fecha_fin)
        where = " AND ".join(conds)
        rows = query(f"""
            SELECT c.fecha::date AS fecha,
                   'COMPRA' AS tipo,
                   c.num_documento AS documento,
                   COALESCE(pr.razon_social, '') AS detalle,
                   cd.cantidad,
                   COALESCE(b.nombre, '') AS bodega_nombre
            FROM com_compra_detalles cd
            JOIN com_compras c             ON c.id  = cd.compra_id
            LEFT JOIN com_proveedores pr   ON pr.id = c.proveedor_id
            LEFT JOIN inv_bodegas     b    ON b.id  = c.bodega_id
            WHERE {where}
        """, params)
        for r in rows:
            movimientos.append({
                "fecha":         str(r["fecha"]),
                "tipo":          "COMPRA",
                "documento":     r["documento"] or "",
                "detalle":       r["detalle"],
                "entrada":       float(r["cantidad"]),
                "salida":        0,
                "bodega_nombre": r.get("bodega_nombre") or "",
            })

    # ── AJUSTES ───────────────────────────────────────────────
    if "AJUSTE" in tipos_solicitar:
        conds = [
            "ad.producto_id = %s",
        ]
        params = [producto_id]
        if bodega_id:
            conds.append("a.bodega_id = %s")
            params.append(bodega_id)
        if fecha_ini:
            conds.append("a.fecha::date >= %s")
            params.append(fecha_ini)
        if fecha_fin:
            conds.append("a.fecha::date <= %s")
            params.append(fecha_fin)
        where = " AND ".join(conds)
        rows = query(f"""
            SELECT a.fecha::date AS fecha,
                   'AJUSTE' AS tipo,
                   a.numero AS documento,
                   COALESCE(a.motivo, '') AS detalle,
                   ad.cantidad,
                   a.tipo AS ajuste_tipo,
                   COALESCE(b.nombre, '') AS bodega_nombre,
                   a.bodega_id
            FROM inv_ajuste_detalles ad
            JOIN inv_ajustes  a ON a.id = ad.ajuste_id
            LEFT JOIN inv_bodegas b ON b.id = a.bodega_id
            WHERE {where}
        """, params)
        for r in rows:
            es_cargo = r["ajuste_tipo"] == "CARGO"
            movimientos.append({
                "fecha":         str(r["fecha"]),
                "tipo":          "AJUSTE",
                "documento":     r["documento"] or "",
                "detalle":       r["detalle"],
                "entrada":       float(r["cantidad"]) if es_cargo else 0,
                "salida":        float(r["cantidad"]) if not es_cargo else 0,
                "bodega_nombre": r["bodega_nombre"],
            })

    # ── TRANSFERENCIAS ────────────────────────────────────────
    if "TRANSFERENCIA" in tipos_solicitar:
        conds = [
            "td.producto_id = %s",
        ]
        params = [producto_id]
        if fecha_ini:
            conds.append("t.fecha::date >= %s")
            params.append(fecha_ini)
        if fecha_fin:
            conds.append("t.fecha::date <= %s")
            params.append(fecha_fin)
        # Si filtran por bodega, mostrar sólo los movimientos de esa bodega
        bod_filter = ""
        if bodega_id:
            bod_filter = " AND (t.bodega_origen_id = %s OR t.bodega_destino_id = %s)"
            params += [bodega_id, bodega_id]
        where = " AND ".join(conds)
        rows = query(f"""
            SELECT t.fecha::date AS fecha,
                   'TRANSFERENCIA' AS tipo,
                   t.numero AS documento,
                   td.cantidad,
                   t.bodega_origen_id,
                   t.bodega_destino_id,
                   COALESCE(bo.nombre, '') AS bodega_origen_nombre,
                   COALESCE(bd.nombre, '') AS bodega_destino_nombre
            FROM inv_transferencia_detalles td
            JOIN inv_transferencias t ON t.id = td.transferencia_id
            LEFT JOIN inv_bodegas bo ON bo.id = t.bodega_origen_id
            LEFT JOIN inv_bodegas bd ON bd.id = t.bodega_destino_id
            WHERE {where}{bod_filter}
        """, params)
        for r in rows:
            detalle = f"{r['bodega_origen_nombre']} -> {r['bodega_destino_nombre']}"
            # Salida desde bodega origen
            if not bodega_id or bodega_id == r["bodega_origen_id"]:
                movimientos.append({
                    "fecha":         str(r["fecha"]),
                    "tipo":          "TRANSFERENCIA",
                    "documento":     r["documento"] or "",
                    "detalle":       detalle,
                    "entrada":       0,
                    "salida":        float(r["cantidad"]),
                    "bodega_nombre": r["bodega_origen_nombre"],
                })
            # Entrada a bodega destino
            if not bodega_id or bodega_id == r["bodega_destino_id"]:
                movimientos.append({
                    "fecha":         str(r["fecha"]),
                    "tipo":          "TRANSFERENCIA",
                    "documento":     r["documento"] or "",
                    "detalle":       detalle,
                    "entrada":       float(r["cantidad"]),
                    "salida":        0,
                    "bodega_nombre": r["bodega_destino_nombre"],
                })

    # ── DEVOLUCIONES ──────────────────────────────────────────
    if "DEVOLUCION" in tipos_solicitar:
        conds = [
            "dd.producto_id = %s",
        ]
        params = [producto_id]
        if fecha_ini:
            conds.append("d.fecha::date >= %s")
            params.append(fecha_ini)
        if fecha_fin:
            conds.append("d.fecha::date <= %s")
            params.append(fecha_fin)
        where = " AND ".join(conds)
        rows = query(f"""
            SELECT d.fecha::date AS fecha,
                   'DEVOLUCION' AS tipo,
                   d.numero AS documento,
                   COALESCE(d.motivo, '') AS detalle,
                   dd.cantidad,
                   COALESCE(s.nombre, '') AS bodega_nombre
            FROM ven_devolucion_detalles dd
            JOIN ven_devoluciones d      ON d.id = dd.devolucion_id
            LEFT JOIN sys_sucursales s   ON s.id = d.sucursal_id
            WHERE {where}
        """, params)
        for r in rows:
            movimientos.append({
                "fecha":         str(r["fecha"]),
                "tipo":          "DEVOLUCION",
                "documento":     r["documento"] or "",
                "detalle":       r["detalle"],
                "entrada":       float(r["cantidad"]),
                "salida":        0,
                "bodega_nombre": r.get("bodega_nombre") or "",
            })

    # ── Ordenar por fecha y calcular saldo acumulado ─────────
    movimientos.sort(key=lambda m: m["fecha"])
    saldo = 0
    for m in movimientos:
        saldo += m["entrada"] - m["salida"]
        m["saldo_acumulado"] = round(saldo, 4)

    total_entradas = sum(m["entrada"] for m in movimientos)
    total_salidas  = sum(m["salida"]  for m in movimientos)

    return {
        "producto":    prod,
        "movimientos": movimientos,
        "resumen": {
            "stock_actual":    float(prod["stock_actual"]),
            "total_entradas":  round(total_entradas, 4),
            "total_salidas":   round(total_salidas, 4),
            "num_movimientos": len(movimientos),
        },
    }
