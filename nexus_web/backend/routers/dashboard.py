from fastapi import APIRouter, Depends
from datetime import date
from database import query, query_one
from auth import get_current_user

router = APIRouter(prefix="/api", tags=["Dashboard"])


@router.get("/dashboard")
def dashboard(u=Depends(get_current_user)):
    hoy    = date.today()
    suc_id = u.get("sucursal_id")

    suc_filter_v  = "AND sucursal_id=%s" if suc_id else ""
    suc_filter_s  = "AND s.sucursal_id=%s" if suc_id else ""
    suc_params    = [suc_id] if suc_id else []

    ventas_hoy = query_one(f"""
        SELECT COALESCE(SUM(total),0) as total, COUNT(*) as facturas
        FROM ven_facturas WHERE estado='EMITIDA' AND fecha_emision=%s {suc_filter_v}
    """, [hoy]+suc_params)

    ventas_mes = query_one(f"""
        SELECT COALESCE(SUM(total),0) as total, COUNT(*) as facturas
        FROM ven_facturas
        WHERE estado='EMITIDA'
          AND fecha_emision >= DATE_TRUNC('month', CURRENT_DATE)
          {suc_filter_v}
    """, suc_params)

    clientes = query_one("SELECT COUNT(*) as n FROM ven_clientes WHERE activo=true")
    productos = query_one("SELECT COUNT(*) as n FROM inv_productos WHERE activo=true")

    if suc_id:
        stock_bajo = query_one("""
            SELECT COUNT(DISTINCT p.id) as n
            FROM inv_productos p
            JOIN inv_stock s ON s.producto_id=p.id
            JOIN inv_bodegas b ON b.id=s.bodega_id
            WHERE p.activo=true AND s.cantidad>0 AND s.cantidad<5
              AND b.sucursal_id=%s
        """, (suc_id,))
    else:
        stock_bajo = query_one("""
            SELECT COUNT(DISTINCT p.id) as n
            FROM inv_productos p
            JOIN inv_stock s ON s.producto_id=p.id
            WHERE p.activo=true AND s.cantidad>0 AND s.cantidad<5
        """)

    if suc_id:
        cxc_pendiente = query_one("""
            SELECT COALESCE(SUM(cx.saldo),0) as total, COUNT(*) as n
            FROM fin_cxc cx
            LEFT JOIN ven_facturas f ON f.id=cx.factura_id
            WHERE cx.estado IN ('PENDIENTE','PARCIAL')
              AND f.sucursal_id=%s
        """, (suc_id,))
    else:
        cxc_pendiente = query_one("""
            SELECT COALESCE(SUM(saldo),0) as total, COUNT(*) as n
            FROM fin_cxc WHERE estado IN ('PENDIENTE','PARCIAL')
        """)

    ventas_semana = query(f"""
        SELECT fecha_emision::date as fecha,
               COALESCE(SUM(total),0) as total,
               COUNT(*) as facturas
        FROM ven_facturas
        WHERE estado='EMITIDA'
          AND fecha_emision >= CURRENT_DATE - INTERVAL '7 days'
          {suc_filter_v}
        GROUP BY fecha_emision::date
        ORDER BY fecha_emision::date
    """, suc_params)

    top_productos = query(f"""
        SELECT p.descripcion, SUM(fd.cantidad) as vendidos,
               SUM(fd.total) as total
        FROM ven_factura_detalles fd
        JOIN inv_productos p ON p.id=fd.producto_id
        JOIN ven_facturas f  ON f.id=fd.factura_id
        WHERE f.estado='EMITIDA'
          AND f.fecha_emision >= CURRENT_DATE - INTERVAL '30 days'
          {suc_filter_v.replace('sucursal_id','f.sucursal_id')}
        GROUP BY p.descripcion
        ORDER BY vendidos DESC LIMIT 5
    """, suc_params)

    sucursal_nombre = None
    if suc_id:
        suc = query_one("SELECT nombre FROM sys_sucursales WHERE id=%s", (suc_id,))
        if suc: sucursal_nombre = suc["nombre"]

    # ── Ventas por hora (hoy) ────────────────────────────────
    try:
        ventas_por_hora = query(f"""
            SELECT EXTRACT(HOUR FROM f.created_at) as hora,
                   COUNT(*) as facturas,
                   SUM(f.total) as total
            FROM ven_facturas f
            WHERE f.estado='EMITIDA' AND f.fecha_emision=CURRENT_DATE
              {suc_filter_v.replace('sucursal_id','f.sucursal_id')}
            GROUP BY hora ORDER BY hora
        """, suc_params)
    except Exception:
        ventas_por_hora = []

    # ── Comparativo mes anterior ─────────────────────────────
    try:
        mes_anterior = query_one(f"""
            SELECT COALESCE(SUM(total),0) as total, COUNT(*) as facturas
            FROM ven_facturas
            WHERE estado='EMITIDA'
              AND fecha_emision >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
              AND fecha_emision < DATE_TRUNC('month', CURRENT_DATE)
              {suc_filter_v}
        """, suc_params)
    except Exception:
        mes_anterior = {"total": 0, "facturas": 0}

    comparativo_mes = {
        "mes_actual":   {"total": ventas_mes["total"], "facturas": ventas_mes["facturas"]},
        "mes_anterior": mes_anterior,
    }

    # ── Rentabilidad top 5 ───────────────────────────────────
    try:
        rentabilidad = query(f"""
            SELECT p.descripcion,
                   SUM(fd.cantidad) as vendidos,
                   SUM(fd.total) as ingreso,
                   SUM(fd.cantidad * COALESCE(co.costo,0)) as costo_total,
                   SUM(fd.total) - SUM(fd.cantidad * COALESCE(co.costo,0)) as utilidad
            FROM ven_factura_detalles fd
            JOIN inv_productos p ON p.id=fd.producto_id
            JOIN ven_facturas f ON f.id=fd.factura_id
            LEFT JOIN inv_costos co ON co.producto_id=p.id
            WHERE f.estado='EMITIDA'
              AND f.fecha_emision >= DATE_TRUNC('month', CURRENT_DATE)
              {suc_filter_v.replace('sucursal_id','f.sucursal_id')}
            GROUP BY p.descripcion ORDER BY utilidad DESC LIMIT 5
        """, suc_params)
    except Exception:
        rentabilidad = []

    # ── Alertas stock bajo ───────────────────────────────────
    try:
        if suc_id:
            alertas_stock = query("""
                SELECT p.codigo, p.descripcion, s.cantidad, s.cantidad_minima,
                       b.nombre as bodega
                FROM inv_stock s
                JOIN inv_productos p ON p.id=s.producto_id
                JOIN inv_bodegas b ON b.id=s.bodega_id
                WHERE s.cantidad_minima > 0
                  AND s.cantidad < s.cantidad_minima
                  AND p.activo=true
                  AND b.sucursal_id=%s
                ORDER BY (s.cantidad / NULLIF(s.cantidad_minima,0))
                LIMIT 8
            """, (suc_id,))
        else:
            alertas_stock = query("""
                SELECT p.codigo, p.descripcion, s.cantidad, s.cantidad_minima,
                       b.nombre as bodega
                FROM inv_stock s
                JOIN inv_productos p ON p.id=s.producto_id
                JOIN inv_bodegas b ON b.id=s.bodega_id
                WHERE s.cantidad_minima > 0
                  AND s.cantidad < s.cantidad_minima
                  AND p.activo=true
                ORDER BY (s.cantidad / NULLIF(s.cantidad_minima,0))
                LIMIT 8
            """)
    except Exception:
        alertas_stock = []

    # ── Cotizaciones pendientes ──────────────────────────────
    try:
        cot = query_one("SELECT COUNT(*) as n FROM ven_cotizaciones WHERE estado IN ('BORRADOR','ENVIADA')")
        cotizaciones_pendientes = cot["n"] if cot else 0
    except Exception:
        cotizaciones_pendientes = 0

    return {
        "ventas_hoy":      ventas_hoy,
        "ventas_mes":      ventas_mes,
        "clientes":        clientes["n"],
        "productos":       productos["n"],
        "stock_bajo":      stock_bajo["n"],
        "cxc_pendiente":   cxc_pendiente,
        "ventas_semana":   ventas_semana,
        "top_productos":   top_productos,
        "sucursal_id":     suc_id,
        "sucursal_nombre": sucursal_nombre,
        "ventas_por_hora":          ventas_por_hora,
        "comparativo_mes":          comparativo_mes,
        "rentabilidad":             rentabilidad,
        "alertas_stock":            alertas_stock,
        "cotizaciones_pendientes":  cotizaciones_pendientes,
    }
