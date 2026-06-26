from fastapi import APIRouter, Depends, HTTPException
from database import query, query_one, execute, insert
from auth import get_current_user
from typing import Optional
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["Inventario"])


# ── STOCK ────────────────────────────────────────────────
@router.get("/stock")
def get_stock(bodega_id: Optional[int] = None, u=Depends(get_current_user)):
    where = "WHERE s.cantidad > 0"
    params = []
    if bodega_id:
        where += " AND s.bodega_id=%s"; params.append(bodega_id)
    return query(f"""
        SELECT p.codigo, p.descripcion, b.nombre as bodega,
               s.cantidad, COALESCE(c.costo,0) as costo,
               COALESCE(pr.precio,0) as precio
        FROM inv_stock s
        JOIN inv_productos p ON p.id=s.producto_id
        JOIN inv_bodegas b ON b.id=s.bodega_id
        LEFT JOIN inv_costos c ON c.producto_id=p.id
        LEFT JOIN inv_precios pr ON pr.producto_id=p.id
            AND pr.tipo_precio_id=1 AND pr.activo=true
        {where}
        ORDER BY p.descripcion
    """, params)


# ── BODEGAS ──────────────────────────────────────────────
@router.get("/bodegas")
def get_bodegas(sucursal_id: Optional[int] = None, u=Depends(get_current_user)):
    """Devuelve bodegas con stock total. Si sucursal_id, filtra por sucursal."""
    if sucursal_id:
        return query("""
            SELECT b.*,
                   s.nombre as sucursal_nombre,
                   COALESCE(SUM(st.cantidad),0) as stock_total_bodega
            FROM inv_bodegas b
            LEFT JOIN sys_sucursales s  ON s.id = b.sucursal_id
            LEFT JOIN inv_stock st      ON st.bodega_id = b.id
            WHERE b.activa=true AND b.sucursal_id=%s
            GROUP BY b.id, s.nombre
            ORDER BY b.es_principal DESC NULLS LAST, b.nombre
        """, (sucursal_id,))
    return query("""
        SELECT b.*,
               s.nombre as sucursal_nombre,
               COALESCE(SUM(st.cantidad),0) as stock_total_bodega
        FROM inv_bodegas b
        LEFT JOIN sys_sucursales s ON s.id = b.sucursal_id
        LEFT JOIN inv_stock st     ON st.bodega_id = b.id
        WHERE b.activa=true
        GROUP BY b.id, s.nombre
        ORDER BY b.es_principal DESC NULLS LAST, b.nombre
    """)


# ── MARCAS ───────────────────────────────────────────────
@router.get("/marcas")
def get_marcas(u=Depends(get_current_user)):
    return query("SELECT * FROM inv_marcas WHERE activa=true ORDER BY nombre")


class MarcaIn(BaseModel):
    nombre: str


@router.post("/marcas")
def crear_marca(m: MarcaIn, u=Depends(get_current_user)):
    existe = query_one("SELECT id FROM inv_marcas WHERE nombre ILIKE %s", (m.nombre,))
    if existe: raise HTTPException(400, "La marca ya existe")
    mid = insert("INSERT INTO inv_marcas (nombre, activa) VALUES (%s, true)", (m.nombre,))
    return {"id": mid, "nombre": m.nombre}


# ── CATEGORIAS ───────────────────────────────────────────
@router.get("/categorias")
def get_categorias(u=Depends(get_current_user)):
    return query("SELECT * FROM inv_categorias WHERE activa=true ORDER BY nombre")


class CatIn(BaseModel):
    nombre: str


@router.post("/categorias")
def crear_categoria(c: CatIn, u=Depends(get_current_user)):
    existe = query_one("SELECT id FROM inv_categorias WHERE nombre ILIKE %s", (c.nombre,))
    if existe: raise HTTPException(400, "La categoria ya existe")
    cid = insert("INSERT INTO inv_categorias (nombre, activa) VALUES (%s, true)", (c.nombre,))
    return {"id": cid, "nombre": c.nombre}


# ── STOCK COMPLETO ───────────────────────────────────────
@router.get("/inventario/stock")
def get_stock_completo(
    bodega_id: Optional[int] = None,
    busqueda:  str = "",
    solo_stock: bool = False,
    u=Depends(get_current_user)
):
    conds  = ["p.activo=true"]
    params = [1]
    if busqueda:
        conds.append("(p.descripcion ILIKE %s OR p.codigo ILIKE %s)")
        params += [f"%{busqueda}%", f"%{busqueda}%"]
    if bodega_id:
        conds.append("s.bodega_id=%s"); params.append(bodega_id)
    if solo_stock:
        conds.append("COALESCE(s.cantidad,0) > 0")
    where = "WHERE " + " AND ".join(conds)
    return query(f"""
        SELECT DISTINCT ON (p.id, COALESCE(s.bodega_id, 0))
               p.id, p.codigo, p.descripcion,
               p.aplica_series,
               COALESCE(m.nombre,'—') as marca,
               COALESCE(cat.nombre,'—') as categoria,
               COALESCE(b.nombre,'Sin bodega') as bodega,
               COALESCE(s.bodega_id, 0) as bodega_id,
               COALESCE(s.cantidad, 0) as cantidad,
               COALESCE(s.cantidad_minima, 0) as cantidad_minima,
               COALESCE(c.costo, 0) as costo,
               COALESCE(pr.precio, 0) as precio,
               (SELECT COUNT(*) FROM inv_series
                WHERE producto_id=p.id AND estado='DISPONIBLE') as series_disponibles
        FROM inv_productos p
        LEFT JOIN inv_stock s ON s.producto_id=p.id
        LEFT JOIN inv_bodegas b ON b.id=s.bodega_id
        LEFT JOIN inv_marcas m ON m.id=p.marca_id
        LEFT JOIN inv_categorias cat ON cat.id=p.categoria_id
        LEFT JOIN inv_costos c ON c.producto_id=p.id
        LEFT JOIN inv_precios pr ON pr.producto_id=p.id
            AND pr.tipo_precio_id=%s AND pr.activo=true
        {where}
        ORDER BY p.id, COALESCE(s.bodega_id,0), p.descripcion
        LIMIT 500
    """, params)


# ── AJUSTE DE STOCK ──────────────────────────────────────
class AjusteIn(BaseModel):
    producto_id: int
    bodega_id:   int
    cantidad:    float
    motivo:      str = "Ajuste manual"


@router.post("/inventario/ajuste")
def ajustar_stock(a: AjusteIn, u=Depends(get_current_user)):
    actual = query_one("""
        SELECT cantidad FROM inv_stock WHERE producto_id=%s AND bodega_id=%s
    """, (a.producto_id, a.bodega_id))
    cant_anterior = float(actual["cantidad"]) if actual else 0
    if actual:
        execute("""
            UPDATE inv_stock SET cantidad=%s
            WHERE producto_id=%s AND bodega_id=%s
        """, (a.cantidad, a.producto_id, a.bodega_id))
    else:
        insert("""
            INSERT INTO inv_stock (producto_id, bodega_id, cantidad)
            VALUES (%s,%s,%s)
        """, (a.producto_id, a.bodega_id, a.cantidad))
    # Registrar en movimientos si existe la tabla
    try:
        insert("""
            INSERT INTO inv_movimientos
            (producto_id, bodega_id, tipo, cantidad_anterior,
             cantidad_nueva, motivo, usuario_id, fecha)
            VALUES (%s,%s,'AJUSTE',%s,%s,%s,%s,CURRENT_DATE)
        """, (a.producto_id, a.bodega_id, cant_anterior,
              a.cantidad, a.motivo, u["id"]))
    except: pass  # La tabla puede no existir aun
    return {"msg": "Ajuste registrado", "anterior": cant_anterior, "nuevo": a.cantidad}


# ── RESUMEN INVENTARIO ───────────────────────────────────
@router.get("/inventario/resumen")
def resumen_inventario(u=Depends(get_current_user)):
    return {
        "total_productos": query_one(
            "SELECT COUNT(*) as n FROM inv_productos WHERE activo=true")["n"],
        "con_stock": query_one("""
            SELECT COUNT(DISTINCT producto_id) as n FROM inv_stock WHERE cantidad > 0
        """)["n"],
        "sin_stock": query_one("""
            SELECT COUNT(*) as n FROM inv_productos p WHERE activo=true
            AND COALESCE((SELECT SUM(cantidad) FROM inv_stock WHERE producto_id=p.id),0) = 0
        """)["n"],
        "stock_bajo": query_one("""
            SELECT COUNT(*) as n FROM inv_productos p WHERE activo=true
            AND COALESCE((SELECT SUM(cantidad) FROM inv_stock WHERE producto_id=p.id),0) BETWEEN 1 AND 5
        """)["n"],
        "bajo_minimo": query_one("""
            SELECT COUNT(DISTINCT s.producto_id) as n
            FROM inv_stock s
            WHERE s.cantidad_minima > 0
            AND s.cantidad < s.cantidad_minima
        """)["n"],
        "valor_inventario": query_one("""
            SELECT COALESCE(SUM(s.cantidad * c.costo), 0) as total
            FROM inv_stock s
            JOIN inv_costos c ON c.producto_id=s.producto_id
        """)["total"],
        "por_categoria": query("""
            SELECT cat.nombre, COUNT(p.id) as productos,
                   COALESCE(SUM(s.cantidad),0) as unidades
            FROM inv_categorias cat
            LEFT JOIN inv_productos p ON p.categoria_id=cat.id AND p.activo=true
            LEFT JOIN inv_stock s ON s.producto_id=p.id
            WHERE cat.activa=true
            GROUP BY cat.nombre ORDER BY unidades DESC LIMIT 8
        """),
    }


# ── STOCK AGRUPADO ───────────────────────────────────────
@router.get("/inventario/stock-agrupado")
def stock_agrupado(
    busqueda:   Optional[str] = None,
    bodega_id:  Optional[int] = None,
    solo_stock: bool = False,
    u=Depends(get_current_user)
):
    """Devuelve productos con su stock desglosado por bodega"""
    conds  = ["p.activo=true"]
    params = []
    if busqueda:
        conds.append("(p.descripcion ILIKE %s OR p.codigo ILIKE %s)")
        params += [f"%{busqueda}%"]*2
    if solo_stock:
        conds.append("COALESCE(total_stock.total,0) > 0")
    where = "WHERE " + " AND ".join(conds)

    # Filtro de bodega como clausula separada (evita f-string anidado)
    bod_filter_stock  = "WHERE bodega_id=%s"      if bodega_id else ""
    bod_filter_bodegas= "AND b.id=%s"             if bodega_id else ""
    if bodega_id:
        params_stock  = [bodega_id]
        params_bodegas= [bodega_id]
    else:
        params_stock  = []
        params_bodegas= []

    # Usar query directa sin f-string anidado
    sql = f"""
        SELECT
            p.id, p.codigo, p.descripcion,
            COALESCE(p.aplica_series, false) as aplica_series,
            p.iva_porcentaje, p.activo,
            p.marca_id, p.categoria_id, p.clase,
            COALESCE(p.es_compuesto, false) as es_compuesto,
            m.nombre as marca_nombre,
            cat.nombre as categoria_nombre,
            COALESCE(total_stock.total, 0) as stock_total,
            COALESCE(
                (SELECT pr.precio FROM inv_precios pr
                 WHERE pr.producto_id=p.id AND pr.tipo_precio_id=1
                   AND pr.activo=true LIMIT 1), 0
            ) as precio_venta,
            COALESCE(
                (SELECT cs.costo FROM inv_costos cs
                 WHERE cs.producto_id=p.id
                 LIMIT 1), 0
            ) as costo,
            (
                SELECT json_agg(json_build_object(
                    'bodega_id',   b.id,
                    'bodega',      b.nombre,
                    'es_principal',b.es_principal,
                    'cantidad',    COALESCE(s.cantidad,0)
                ) ORDER BY b.es_principal DESC NULLS LAST, b.nombre)
                FROM inv_bodegas b
                LEFT JOIN inv_stock s ON s.bodega_id=b.id AND s.producto_id=p.id
                WHERE b.activa=true {bod_filter_bodegas}
            ) as stock_bodegas,
            (SELECT COUNT(*) FROM inv_series
             WHERE producto_id=p.id AND estado IN ('DISPONIBLE','EXHIBICION')) as series_disponibles
        FROM inv_productos p
        LEFT JOIN inv_marcas m         ON m.id = p.marca_id
        LEFT JOIN inv_categorias cat   ON cat.id = p.categoria_id
        LEFT JOIN (
            SELECT producto_id, SUM(cantidad) as total
            FROM inv_stock {bod_filter_stock}
            GROUP BY producto_id
        ) total_stock ON total_stock.producto_id = p.id
        {where}
        ORDER BY p.descripcion
        LIMIT 500
    """

    # Params: primero los de bodega (subqueries), luego los del WHERE
    all_params = params_bodegas + params_stock + params
    return query(sql, all_params)


# ── STOCK POR BODEGA ─────────────────────────────────────
@router.get("/bodegas/{bod_id}/stock")
def stock_bodega(bod_id: int, u=Depends(get_current_user)):
    """Stock disponible en una bodega con sus series"""
    productos = query("""
        SELECT p.id, p.codigo, p.descripcion, p.aplica_series,
               COALESCE(s.cantidad,0) as cantidad
        FROM inv_stock s
        JOIN inv_productos p ON p.id = s.producto_id
        WHERE s.bodega_id=%s AND s.cantidad > 0
        ORDER BY p.descripcion
    """, (bod_id,))

    for p in productos:
        if p.get("aplica_series"):
            p["series"] = query("""
                SELECT id, serie, estado
                FROM inv_series
                WHERE producto_id=%s AND bodega_id=%s
                  AND estado IN ('DISPONIBLE','EXHIBICION')
                ORDER BY serie
            """, (p["id"], bod_id))
        else:
            p["series"] = []

    return productos


# ── SUGERIR COMPRA ──────────────────────────────────────
@router.get("/inventario/sugerir-compra")
def sugerir_compra(u=Depends(get_current_user)):
    """Suggest products to reorder based on min stock and sales velocity."""
    productos = query("""
        SELECT p.id, p.codigo, p.descripcion,
               COALESCE(m.nombre,'') as marca,
               COALESCE(SUM(s.cantidad),0) as stock_actual,
               COALESCE(MAX(s.cantidad_minima),0) as stock_minimo,
               COALESCE(co.costo,0) as costo,
               COALESCE((
                   SELECT SUM(fd.cantidad) FROM ven_factura_detalles fd
                   JOIN ven_facturas f ON f.id=fd.factura_id
                   WHERE fd.producto_id=p.id AND f.estado='EMITIDA'
                     AND f.fecha_emision >= CURRENT_DATE - INTERVAL '30 days'
               ),0) as ventas_30d
        FROM inv_productos p
        LEFT JOIN inv_stock s ON s.producto_id=p.id
        LEFT JOIN inv_marcas m ON m.id=p.marca_id
        LEFT JOIN inv_costos co ON co.producto_id=p.id
        WHERE p.activo=true
        GROUP BY p.id, p.codigo, p.descripcion, m.nombre, co.costo
        HAVING COALESCE(SUM(s.cantidad),0) <= COALESCE(MAX(s.cantidad_minima),0)
            OR (COALESCE(SUM(s.cantidad),0) < COALESCE((
                SELECT SUM(fd.cantidad) FROM ven_factura_detalles fd
                JOIN ven_facturas f ON f.id=fd.factura_id
                WHERE fd.producto_id=p.id AND f.estado='EMITIDA'
                AND f.fecha_emision >= CURRENT_DATE - INTERVAL '30 days'
            ),0) * 1.5)
        ORDER BY stock_actual ASC
    """)

    for p in productos:
        ventas = float(p.get('ventas_30d',0))
        stock = float(p.get('stock_actual',0))
        minimo = float(p.get('stock_minimo',0))
        sugerido = max(minimo * 2, ventas * 2) - stock
        p['cantidad_sugerida'] = max(int(sugerido), 1)
        p['inversion_estimada'] = round(p['cantidad_sugerida'] * float(p.get('costo',0)), 2)
        p['urgencia'] = 'CRITICO' if stock <= 0 else 'BAJO' if stock <= minimo else 'PREVISION'

    total_inversion = sum(float(p['inversion_estimada']) for p in productos)
    return {
        "titulo": "Sugerencia de Compra",
        "productos": productos,
        "total_productos": len(productos),
        "inversion_total": round(total_inversion, 2),
    }


# ── ANALISIS ABC (PARETO) ──────────────────────────────
@router.get("/inventario/abc")
def analisis_abc(fecha_ini: str, fecha_fin: str, u=Depends(get_current_user)):
    """ABC/Pareto analysis of products by sales value."""
    productos = query("""
        SELECT p.id, p.codigo, p.descripcion,
               COALESCE(m.nombre,'') as marca,
               SUM(fd.cantidad) as unidades, SUM(fd.total) as total_ventas
        FROM ven_factura_detalles fd
        JOIN ven_facturas f ON f.id=fd.factura_id
        JOIN inv_productos p ON p.id=fd.producto_id
        LEFT JOIN inv_marcas m ON m.id=p.marca_id
        WHERE f.estado='EMITIDA' AND f.fecha_emision BETWEEN %s AND %s
        GROUP BY p.id, p.codigo, p.descripcion, m.nombre
        ORDER BY total_ventas DESC
    """, (fecha_ini, fecha_fin))

    gran_total = sum(float(p['total_ventas']) for p in productos)
    acumulado = 0
    for p in productos:
        acumulado += float(p['total_ventas'])
        pct_acum = round(acumulado / gran_total * 100, 1) if gran_total > 0 else 0
        p['pct_acumulado'] = pct_acum
        p['clasificacion'] = 'A' if pct_acum <= 80 else 'B' if pct_acum <= 95 else 'C'

    a_count = sum(1 for p in productos if p['clasificacion']=='A')
    b_count = sum(1 for p in productos if p['clasificacion']=='B')
    c_count = sum(1 for p in productos if p['clasificacion']=='C')

    return {
        "titulo": "Analisis ABC (Pareto)",
        "fecha_ini": fecha_ini, "fecha_fin": fecha_fin,
        "resumen": {"total_productos": len(productos), "total_ventas": round(gran_total,2),
                     "clase_A": a_count, "clase_B": b_count, "clase_C": c_count},
        "detalle": productos,
    }


# ── ALERTAS DE STOCK ────────────────────────────────────
@router.get("/inventario/alertas-stock")
def alertas_stock(u=Depends(get_current_user)):
    """Products with stock below minimum."""
    return query("""
        SELECT p.id, p.codigo, p.descripcion, m.nombre as marca,
               s.cantidad, s.cantidad_minima, b.nombre as bodega,
               CASE WHEN s.cantidad <= 0 THEN 'SIN_STOCK'
                    WHEN s.cantidad < s.cantidad_minima THEN 'BAJO_MINIMO'
                    ELSE 'OK' END as alerta
        FROM inv_stock s
        JOIN inv_productos p ON p.id=s.producto_id
        JOIN inv_bodegas b ON b.id=s.bodega_id
        LEFT JOIN inv_marcas m ON m.id=p.marca_id
        WHERE p.activo=true AND s.cantidad_minima > 0 AND s.cantidad < s.cantidad_minima
        ORDER BY s.cantidad ASC, p.descripcion
    """)


# ── ROTACION DE INVENTARIO ──────────────────────────────
@router.get("/inventario/rotacion")
def rotacion_inventario(fecha_ini: str, fecha_fin: str, u=Depends(get_current_user)):
    """Inventory turnover report."""
    return query("""
        SELECT p.codigo, p.descripcion,
               COALESCE(SUM(st.cantidad),0) as stock_actual,
               COALESCE(co.costo,0) as costo,
               COALESCE((SELECT SUM(fd.cantidad) FROM ven_factura_detalles fd
                JOIN ven_facturas f ON f.id=fd.factura_id
                WHERE fd.producto_id=p.id AND f.estado='EMITIDA'
                AND f.fecha_emision BETWEEN %s AND %s),0) as vendidos,
               CASE WHEN COALESCE(SUM(st.cantidad),0) > 0
                   THEN ROUND(COALESCE((SELECT SUM(fd.cantidad) FROM ven_factura_detalles fd
                       JOIN ven_facturas f ON f.id=fd.factura_id
                       WHERE fd.producto_id=p.id AND f.estado='EMITIDA'
                       AND f.fecha_emision BETWEEN %s AND %s),0) / SUM(st.cantidad)::numeric, 2)
                   ELSE 0 END as indice_rotacion
        FROM inv_productos p
        LEFT JOIN inv_stock st ON st.producto_id=p.id
        LEFT JOIN inv_costos co ON co.producto_id=p.id
        WHERE p.activo=true
        GROUP BY p.id, p.codigo, p.descripcion, co.costo
        HAVING COALESCE(SUM(st.cantidad),0) > 0
        ORDER BY indice_rotacion DESC
    """, (fecha_ini, fecha_fin, fecha_ini, fecha_fin))
