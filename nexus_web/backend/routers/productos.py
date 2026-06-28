from fastapi import APIRouter, Depends, HTTPException
from database import query, query_one, execute, insert
from auth import get_current_user
from typing import Optional
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["Productos"])


# ── Pydantic Models ──────────────────────────────────────────

class ProductoIn(BaseModel):
    codigo:       str
    descripcion:  str
    marca_id:     Optional[int] = None
    categoria_id: Optional[int] = None
    iva_porcentaje: float = 15.0
    aplica_series: bool = False
    activo:       bool = True
    clase:        Optional[str] = 'MERCADERIA'

class PrecioIn(BaseModel):
    tipo_precio_id: int
    precio: float

class CostoIn(BaseModel):
    costo: float

class OfertaIn(BaseModel):
    tipo_precio_id: int
    precio_oferta:  float
    fecha_inicio:   str
    fecha_fin:      Optional[str] = None
    descripcion:    Optional[str] = None

class ComponenteIn(BaseModel):
    componente_id: int
    cantidad:      float

class SerieIn(BaseModel):
    serie:      str
    bodega_id:  Optional[int] = None
    observaciones: Optional[str] = None

class PrecioBatchItem(BaseModel):
    producto_id:    int
    tipo_precio_id: int
    precio_nuevo:   float  # PVP con IVA — se convierte a base

class OfertaBatchItem(BaseModel):
    producto_id:    int
    tipo_precio_id: int
    precio_oferta:  float   # PVP de oferta con IVA
    fecha_inicio:   str
    fecha_fin:      Optional[str] = None
    descripcion:    Optional[str] = None

class IdsIn(BaseModel):
    ids: list = []


# ── PRODUCTOS CRUD ───────────────────────────────────────────

@router.get("/productos")
def get_productos(
    busqueda: str = "",
    activo: Optional[str] = "true",
    marca_id: Optional[int] = None,
    categoria_id: Optional[int] = None,
    u=Depends(get_current_user)
):
    conds = []
    params = []
    if activo == "true":   conds.append("p.activo=true")
    elif activo == "false": conds.append("p.activo=false")
    if busqueda:
        conds.append("(p.descripcion ILIKE %s OR p.codigo ILIKE %s)")
        params += [f"%{busqueda}%", f"%{busqueda}%"]
    if marca_id:
        conds.append("p.marca_id=%s"); params.append(marca_id)
    if categoria_id:
        conds.append("p.categoria_id=%s"); params.append(categoria_id)
    where = "WHERE " + " AND ".join(conds) if conds else ""
    return query(f"""
        SELECT p.*, m.nombre as marca_nombre, c.nombre as categoria_nombre,
               COALESCE((SELECT SUM(cantidad) FROM inv_stock WHERE producto_id=p.id),0) as stock_total,
               COALESCE(
                   (SELECT
                       CASE WHEN p.iva_porcentaje > 0
                           THEN ROUND(o.precio_oferta / (1 + p.iva_porcentaje/100.0), 4)
                           ELSE o.precio_oferta
                       END
                    FROM inv_ofertas o
                    WHERE o.producto_id=p.id AND o.activa=true
                      AND o.fecha_inicio <= CURRENT_DATE
                      AND o.fecha_fin    >= CURRENT_DATE
                    ORDER BY o.created_at DESC LIMIT 1),
                   (SELECT pr.precio FROM inv_precios pr
                    WHERE pr.producto_id=p.id AND pr.tipo_precio_id=1 AND pr.activo=true
                    LIMIT 1),
                   0
               ) as precio_venta,
               EXISTS(
                   SELECT 1 FROM inv_ofertas o
                   WHERE o.producto_id=p.id AND o.activa=true
                     AND o.fecha_inicio <= CURRENT_DATE
                     AND o.fecha_fin    >= CURRENT_DATE
               ) as tiene_oferta,
               COALESCE(
                   (SELECT pr.precio FROM inv_precios pr
                    WHERE pr.producto_id=p.id AND pr.tipo_precio_id=1 AND pr.activo=true
                    LIMIT 1), 0
               ) as precio_original,
               -- Precio de oferta tal como se ingresó (con IVA) para mostrar en UI
               (SELECT o.precio_oferta FROM inv_ofertas o
                WHERE o.producto_id=p.id AND o.activa=true
                  AND o.fecha_inicio <= CURRENT_DATE
                  AND o.fecha_fin    >= CURRENT_DATE
                ORDER BY o.created_at DESC LIMIT 1
               ) as precio_oferta_pvp,
               (
                   SELECT json_agg(json_build_object(
                       'bodega_id',   b.id,
                       'bodega',      b.nombre,
                       'cantidad',    COALESCE(s.cantidad,0),
                       'es_principal',b.es_principal
                   ) ORDER BY b.es_principal DESC NULLS LAST, COALESCE(s.cantidad,0) DESC)
                   FROM inv_bodegas b
                   LEFT JOIN inv_stock s ON s.bodega_id=b.id AND s.producto_id=p.id
                   WHERE b.activa=true
               ) as stock_bodegas
        FROM inv_productos p
        LEFT JOIN inv_marcas m ON m.id=p.marca_id
        LEFT JOIN inv_categorias c ON c.id=p.categoria_id
        {where} ORDER BY p.descripcion LIMIT 200
    """, params)


@router.get("/productos/buscar-con-precio")
def buscar_productos_con_precio(
    busqueda: str = "",
    tipo_precio_id: Optional[int] = 1,
    u=Depends(get_current_user)
):
    """Busca productos y devuelve el precio según el tipo de precio del cliente"""
    params = [f"%{busqueda}%", f"%{busqueda}%", tipo_precio_id or 1]
    return query("""
        SELECT p.id, p.codigo, p.descripcion, p.iva_porcentaje,
               m.nombre as marca_nombre,
               COALESCE((SELECT SUM(cantidad) FROM inv_stock WHERE producto_id=p.id),0) as stock_total,
               COALESCE((
                   SELECT pr.precio FROM inv_precios pr
                   WHERE pr.producto_id=p.id
                     AND pr.tipo_precio_id=%s
                     AND pr.activo=true
                   LIMIT 1
               ),(
                   SELECT pr2.precio FROM inv_precios pr2
                   WHERE pr2.producto_id=p.id AND pr2.activo=true
                   ORDER BY pr2.tipo_precio_id LIMIT 1
               ), 0) as precio_venta,
               (
                   SELECT json_agg(json_build_object(
                       'bodega_id', b.id,
                       'bodega', b.nombre,
                       'cantidad', COALESCE(s.cantidad,0),
                       'es_principal', b.es_principal
                   ) ORDER BY b.es_principal DESC, b.nombre)
                   FROM inv_bodegas b
                   LEFT JOIN inv_stock s ON s.bodega_id=b.id AND s.producto_id=p.id
                   WHERE b.activa=true
               ) as stock_bodegas
        FROM inv_productos p
        LEFT JOIN inv_marcas m ON m.id=p.marca_id
        WHERE p.activo=true
          AND (p.descripcion ILIKE %s OR p.codigo ILIKE %s)
        ORDER BY p.descripcion LIMIT 20
    """, params)

@router.get("/productos/{pid}")
def get_producto(pid: int, u=Depends(get_current_user)):
    p = query_one("""
        SELECT p.*, m.nombre as marca_nombre, c.nombre as categoria_nombre
        FROM inv_productos p
        LEFT JOIN inv_marcas m ON m.id=p.marca_id
        LEFT JOIN inv_categorias c ON c.id=p.categoria_id
        WHERE p.id=%s
    """, (pid,))
    if not p: raise HTTPException(404, "Producto no encontrado")
    p["stock"] = query("""
        SELECT b.nombre as bodega, s.cantidad
        FROM inv_stock s JOIN inv_bodegas b ON b.id=s.bodega_id
        WHERE s.producto_id=%s
    """, (pid,))
    p["precios"] = query("""
        SELECT tp.nombre as tipo, pr.precio
        FROM inv_precios pr JOIN inv_tipos_precio tp ON tp.id=pr.tipo_precio_id
        WHERE pr.producto_id=%s AND pr.activo=true
    """, (pid,))
    return p

@router.post("/productos")
def crear_producto(p: ProductoIn, u=Depends(get_current_user)):
    from multitenant import verificar_limite
    ok, msg = verificar_limite(u.get("empresa_db", ""), 'productos')
    if not ok:
        raise HTTPException(403, msg)
    pid = insert("""
        INSERT INTO inv_productos
        (codigo, descripcion, marca_id, categoria_id,
         iva_porcentaje, aplica_series, activo, clase)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
    """, (p.codigo, p.descripcion, p.marca_id, p.categoria_id,
          p.iva_porcentaje, p.aplica_series, p.activo, p.clase))
    return {"id": pid, "msg": "Producto creado"}

@router.put("/productos/{pid}")
def actualizar_producto(pid: int, p: ProductoIn, u=Depends(get_current_user)):
    execute("""
        UPDATE inv_productos SET
            codigo=%s, descripcion=%s, marca_id=%s, categoria_id=%s,
            iva_porcentaje=%s, aplica_series=%s, activo=%s, clase=%s
        WHERE id=%s
    """, (p.codigo, p.descripcion, p.marca_id, p.categoria_id,
          p.iva_porcentaje, p.aplica_series, p.activo, p.clase, pid))
    return {"msg": "Actualizado"}

@router.patch("/productos/{pid}/toggle")
def toggle_producto(pid: int, u=Depends(get_current_user)):
    p = query_one("SELECT activo FROM inv_productos WHERE id=%s", (pid,))
    if not p: raise HTTPException(404, "No encontrado")
    execute("UPDATE inv_productos SET activo=%s WHERE id=%s", (not p["activo"], pid))
    return {"activo": not p["activo"]}

@router.delete("/productos/{pid}")
def eliminar_producto(pid: int, u=Depends(get_current_user)):
    # Verificar movimientos
    n = query_one("SELECT COUNT(*) as n FROM ven_factura_detalles WHERE producto_id=%s", (pid,))
    if int(n["n"]) > 0:
        raise HTTPException(400, "El producto tiene facturas — desactívalo en lugar de eliminarlo")
    execute("DELETE FROM inv_productos WHERE id=%s", (pid,))
    return {"msg": "Eliminado"}


# ── PRECIOS DEL PRODUCTO ─────────────────────────────────────

@router.get("/productos/{pid}/precios")
def get_precios_producto(pid: int, u=Depends(get_current_user)):
    return query("""
        SELECT pr.*, tp.nombre as tipo_nombre
        FROM inv_precios pr
        JOIN inv_tipos_precio tp ON tp.id=pr.tipo_precio_id
        WHERE pr.producto_id=%s AND pr.activo=true
    """, (pid,))

@router.post("/productos/{pid}/precios")
def guardar_precio(pid: int, p: PrecioIn, u=Depends(get_current_user)):
    existe = query_one("""
        SELECT id, precio FROM inv_precios WHERE producto_id=%s AND tipo_precio_id=%s
    """, (pid, p.tipo_precio_id))
    if existe:
        precio_anterior = float(existe["precio"] or 0)
        # Solo registrar historial si el precio cambia
        if abs(precio_anterior - p.precio) > 0.001:
            try:
                insert("""
                    INSERT INTO inv_precios_historial
                        (producto_id, tipo_precio_id, precio_anterior, precio_nuevo, usuario_id)
                    VALUES (%s,%s,%s,%s,%s)
                """, (pid, p.tipo_precio_id, precio_anterior, p.precio, u["id"]))
            except: pass
        execute("""
            UPDATE inv_precios SET precio=%s, updated_at=NOW(), updated_by=%s
            WHERE producto_id=%s AND tipo_precio_id=%s
        """, (p.precio, u["id"], pid, p.tipo_precio_id))
    else:
        insert("""
            INSERT INTO inv_precios (producto_id, tipo_precio_id, precio, activo, updated_by)
            VALUES (%s,%s,%s,true,%s)
        """, (pid, p.tipo_precio_id, p.precio, u["id"]))
        # Registrar como precio inicial
        try:
            insert("""
                INSERT INTO inv_precios_historial
                    (producto_id, tipo_precio_id, precio_anterior, precio_nuevo, usuario_id)
                VALUES (%s,%s,0,%s,%s)
            """, (pid, p.tipo_precio_id, p.precio, u["id"]))
        except: pass
    return {"msg": "Precio guardado"}


# ── TIPOS DE PRECIO ──────────────────────────────────────────

@router.get("/tipos-precio")
def get_tipos_precio(u=Depends(get_current_user)):
    return query("SELECT * FROM inv_tipos_precio ORDER BY id")


# ── CAMBIO MASIVO DE PRECIOS ────────────────────────────────

@router.post("/precios/batch")
def cambiar_precios_batch(items: list[PrecioBatchItem], u=Depends(get_current_user)):
    """Cambia precios de múltiples productos de una vez"""
    actualizados = 0
    for item in items:
        # Obtener IVA del producto para convertir PVP a base
        prod = query_one("SELECT iva_porcentaje FROM inv_productos WHERE id=%s", (item.producto_id,))
        if not prod: continue
        iva = float(prod.get("iva_porcentaje") or 0)
        precio_base = round(item.precio_nuevo / (1 + iva/100), 4) if iva > 0 else item.precio_nuevo

        existe = query_one("""
            SELECT id, precio FROM inv_precios
            WHERE producto_id=%s AND tipo_precio_id=%s
        """, (item.producto_id, item.tipo_precio_id))

        if existe:
            precio_anterior = float(existe["precio"] or 0)
            if abs(precio_anterior - precio_base) > 0.001:
                try:
                    insert("""
                        INSERT INTO inv_precios_historial
                            (producto_id, tipo_precio_id, precio_anterior, precio_nuevo, usuario_id)
                        VALUES (%s,%s,%s,%s,%s)
                    """, (item.producto_id, item.tipo_precio_id, precio_anterior, precio_base, u["id"]))
                except: pass
            execute("""
                UPDATE inv_precios SET precio=%s, updated_at=NOW(), updated_by=%s
                WHERE producto_id=%s AND tipo_precio_id=%s
            """, (precio_base, u["id"], item.producto_id, item.tipo_precio_id))
        else:
            insert("""
                INSERT INTO inv_precios (producto_id, tipo_precio_id, precio, activo, updated_by)
                VALUES (%s,%s,%s,true,%s)
            """, (item.producto_id, item.tipo_precio_id, precio_base, u["id"]))
        actualizados += 1
    return {"actualizados": actualizados, "msg": f"{actualizados} precios actualizados"}


# ── OFERTA MASIVA ────────────────────────────────────────────

@router.post("/ofertas/batch")
def crear_ofertas_batch(items: list[OfertaBatchItem], u=Depends(get_current_user)):
    """Crea ofertas para múltiples productos"""
    creadas = 0
    for item in items:
        execute("""
            UPDATE inv_ofertas SET activa=false
            WHERE producto_id=%s AND tipo_precio_id=%s
        """, (item.producto_id, item.tipo_precio_id))
        insert("""
            INSERT INTO inv_ofertas
                (producto_id, tipo_precio_id, precio_oferta,
                 fecha_inicio, fecha_fin, descripcion, activa, created_by)
            VALUES (%s,%s,%s,%s,%s,%s,true,%s)
        """, (item.producto_id, item.tipo_precio_id, item.precio_oferta,
              item.fecha_inicio, item.fecha_fin or None,
              item.descripcion or None, u["id"]))
        creadas += 1
    return {"creadas": creadas, "msg": f"{creadas} ofertas creadas"}


# ── PRICE HISTORY ────────────────────────────────────────────

@router.get("/precios/cambios-recientes")
def get_cambios_precios_recientes(
    horas: int = 72,
    limit: int = 50,
    u=Depends(get_current_user)
):
    """Cambios de precio de las últimas N horas para el dashboard"""
    suc_id = u.get("sucursal_id")
    return query("""
        SELECT
            h.id,
            h.producto_id,
            h.tipo_precio_id,
            p.codigo,
            p.descripcion,
            p.codigo_barras,
            m.nombre  as marca_nombre,
            c.nombre  as categoria_nombre,
            tp.nombre as tipo_precio_nombre,
            h.precio_anterior,
            h.precio_nuevo,
            -- También los precios con IVA para mostrar PVP
            ROUND(h.precio_anterior * (1 + p.iva_porcentaje/100.0), 2) as precio_anterior_pvp,
            ROUND(h.precio_nuevo    * (1 + p.iva_porcentaje/100.0), 2) as precio_nuevo_pvp,
            p.iva_porcentaje,
            ROUND(((h.precio_nuevo - h.precio_anterior) /
                NULLIF(h.precio_anterior,0)) * 100, 1) as variacion_pct,
            h.created_at,
            u.nombre  as usuario_nombre,
            COALESCE((SELECT SUM(cantidad) FROM inv_stock WHERE producto_id=p.id),0) as stock_total,
            (
                SELECT json_agg(json_build_object(
                    'tipo_precio_id', pr.tipo_precio_id,
                    'tipo_nombre',    tp2.nombre,
                    'precio',         pr.precio,
                    'precio_pvp',     ROUND(pr.precio*(1+p.iva_porcentaje/100.0),2)
                ) ORDER BY tp2.nombre)
                FROM inv_precios pr
                JOIN inv_tipos_precio tp2 ON tp2.id=pr.tipo_precio_id
                WHERE pr.producto_id=p.id AND pr.activo=true
            ) as precios
        FROM inv_precios_historial h
        JOIN inv_productos    p  ON p.id  = h.producto_id
        JOIN inv_tipos_precio tp ON tp.id = h.tipo_precio_id
        LEFT JOIN inv_marcas     m ON m.id = p.marca_id
        LEFT JOIN inv_categorias c ON c.id = p.categoria_id
        LEFT JOIN sys_usuarios   u ON u.id = h.usuario_id
        WHERE h.created_at >= NOW() - INTERVAL '%s hours'
          AND h.precio_anterior != h.precio_nuevo
          AND h.impreso = false
          AND (
            %s = 0  -- 0 = sin filtro sucursal
            OR EXISTS (
                SELECT 1 FROM inv_stock s
                JOIN inv_bodegas b ON b.id=s.bodega_id
                WHERE s.producto_id=p.id
                  AND b.sucursal_id=%s
                  AND s.cantidad>0
            )
          )
        ORDER BY h.created_at DESC
        LIMIT %s
    """, (horas, suc_id or 0, suc_id or 0, limit))


@router.get("/precios/pendientes-etiqueta")
def get_pendientes_etiqueta(u=Depends(get_current_user)):
    """Productos con precio cambiado sin etiqueta reimpresa (últimas 7 días)"""
    return query("""
        SELECT DISTINCT ON (h.producto_id, h.tipo_precio_id)
            h.producto_id,
            p.codigo, p.descripcion, p.codigo_barras,
            tp.nombre as tipo_precio_nombre,
            h.precio_anterior,
            h.precio_nuevo,
            h.created_at,
            COALESCE((SELECT SUM(cantidad) FROM inv_stock WHERE producto_id=p.id),0) as stock_total,
            (
                SELECT json_agg(json_build_object(
                    'tipo_precio_id', pr.tipo_precio_id,
                    'tipo_nombre',    tp2.nombre,
                    'precio',         pr.precio
                ) ORDER BY tp2.nombre)
                FROM inv_precios pr
                JOIN inv_tipos_precio tp2 ON tp2.id=pr.tipo_precio_id
                WHERE pr.producto_id=p.id AND pr.activo=true
            ) as precios
        FROM inv_precios_historial h
        JOIN inv_productos    p  ON p.id  = h.producto_id
        JOIN inv_tipos_precio tp ON tp.id = h.tipo_precio_id
        WHERE h.created_at >= NOW() - INTERVAL '7 days'
          AND h.precio_anterior != h.precio_nuevo
        ORDER BY h.producto_id, h.tipo_precio_id, h.created_at DESC
    """)

@router.post("/precios/marcar-impreso")
def marcar_impreso(body: IdsIn, u=Depends(get_current_user)):
    """Marcar cambios de precio como impresos — desaparecen del widget"""
    ids = body.ids
    if not ids: return {"msg": "Sin IDs"}
    placeholders = ",".join(["%s"]*len(ids))
    execute(f"""
        UPDATE inv_precios_historial
        SET impreso=true, impreso_at=NOW()
        WHERE id IN ({placeholders})
    """, ids)
    return {"msg": f"{len(ids)} cambio(s) marcados como impresos"}

@router.post("/precios/marcar-impreso-todos")
def marcar_impreso_todos(u=Depends(get_current_user)):
    """Marcar TODOS los cambios pendientes como impresos"""
    execute("""
        UPDATE inv_precios_historial
        SET impreso=true, impreso_at=NOW()
        WHERE impreso=false
    """)
    return {"msg": "Todos marcados como impresos"}


# ── COSTOS DEL PRODUCTO ──────────────────────────────────────

@router.get("/productos/{pid}/costos")
def get_costos(pid: int, u=Depends(get_current_user)):
    return query_one("""
        SELECT costo as costo_actual,
               COALESCE(costo_anterior, 0) as costo_anterior,
               COALESCE(costo_promedio, 0) as costo_promedio
        FROM inv_costos WHERE producto_id=%s
    """, (pid,)) or {"costo_actual": 0, "costo_anterior": 0, "costo_promedio": 0}

@router.post("/productos/{pid}/costo")
def guardar_costo(pid: int, c: CostoIn, u=Depends(get_current_user)):
    existe = query_one("SELECT id, costo, costo_promedio FROM inv_costos WHERE producto_id=%s", (pid,))
    if existe:
        costo_anterior  = float(existe["costo"] or 0)
        costo_promedio  = float(existe["costo_promedio"] or 0)
        # Calcular nuevo promedio (promedio simple de anterior y nuevo)
        nuevo_promedio  = round((costo_anterior + c.costo) / 2, 4) if costo_anterior > 0 else c.costo
        execute("""
            UPDATE inv_costos SET
                costo_anterior=%s,
                costo=%s,
                costo_promedio=%s,
                updated_at=NOW()
            WHERE producto_id=%s
        """, (costo_anterior, c.costo, nuevo_promedio, pid))
    else:
        insert("""
            INSERT INTO inv_costos (producto_id, costo, costo_anterior, costo_promedio)
            VALUES (%s,%s,0,%s)
        """, (pid, c.costo, c.costo))
    return {"msg": "Costo guardado"}


# ── OFERTAS POR PRODUCTO ─────────────────────────────────────

@router.get("/productos/{pid}/ofertas")
def get_ofertas_producto(pid: int, u=Depends(get_current_user)):
    return query("""
        SELECT o.*, tp.nombre as tipo_nombre
        FROM inv_ofertas o
        JOIN inv_tipos_precio tp ON tp.id=o.tipo_precio_id
        WHERE o.producto_id=%s
        ORDER BY o.activa DESC, o.fecha_fin DESC
    """, (pid,))

@router.post("/productos/{pid}/ofertas")
def crear_oferta(pid: int, o: OfertaIn, u=Depends(get_current_user)):
    # Desactivar ofertas anteriores del mismo tipo
    execute("""
        UPDATE inv_ofertas SET activa=false
        WHERE producto_id=%s AND tipo_precio_id=%s
    """, (pid, o.tipo_precio_id))
    oid = insert("""
        INSERT INTO inv_ofertas
        (producto_id, tipo_precio_id, precio_oferta,
         fecha_inicio, fecha_fin, descripcion, activa, created_by)
        VALUES (%s,%s,%s,%s,%s,%s,true,%s)
    """, (pid, o.tipo_precio_id, o.precio_oferta,
          o.fecha_inicio, o.fecha_fin or None,
          o.descripcion or None, u["id"]))
    return {"id": oid, "msg": "Oferta creada"}

@router.delete("/ofertas/{oid}")
def eliminar_oferta(oid: int, u=Depends(get_current_user)):
    execute("UPDATE inv_ofertas SET activa=false WHERE id=%s", (oid,))
    return {"msg": "Oferta desactivada"}


# ── STOCK POR BODEGA (por producto) ──────────────────────────

@router.get("/productos/{pid}/stock")
def get_stock_producto(pid: int, u=Depends(get_current_user)):
    return query("""
        SELECT b.id as bodega_id, b.nombre as bodega,
               COALESCE(s.cantidad, 0) as cantidad
        FROM inv_bodegas b
        LEFT JOIN inv_stock s ON s.bodega_id=b.id AND s.producto_id=%s
        WHERE b.activa=true
        ORDER BY b.es_principal DESC, b.nombre
    """, (pid,))


# ── COMBOS / PRODUCTOS COMPUESTOS ───────────────────────────

@router.get("/productos/{pid}/costo-combo")
def get_costo_combo(pid: int, u=Depends(get_current_user)):
    """Calcula el costo total del combo sumando costos de componentes"""
    componentes = query("""
        SELECT pc.cantidad,
               COALESCE(c.costo, 0) as costo_unitario,
               p.descripcion as nombre,
               p.codigo
        FROM inv_producto_componentes pc
        JOIN inv_productos p ON p.id=pc.componente_id
        LEFT JOIN inv_costos c ON c.producto_id=pc.componente_id
        WHERE pc.producto_id=%s
    """, (pid,))
    total = sum(float(c['cantidad']) * float(c['costo_unitario']) for c in componentes)
    return {
        "costo_calculado": round(total, 4),
        "componentes": componentes,
        "tiene_componentes": len(componentes) > 0
    }

@router.post("/productos/{pid}/actualizar-costo-combo")
def actualizar_costo_combo(pid: int, u=Depends(get_current_user)):
    """Recalcula y actualiza el costo del combo desde sus componentes"""
    data = get_costo_combo(pid, u)
    if not data["tiene_componentes"]:
        raise HTTPException(400, "El producto no tiene componentes")
    nuevo_costo = data["costo_calculado"]
    # Guardar con historial
    existe = query_one("SELECT id, costo FROM inv_costos WHERE producto_id=%s", (pid,))
    if existe:
        costo_ant = float(existe["costo"] or 0)
        promedio  = round((costo_ant + nuevo_costo) / 2, 4) if costo_ant > 0 else nuevo_costo
        execute("""
            UPDATE inv_costos SET
                costo_anterior=%s, costo=%s, costo_promedio=%s, updated_at=NOW()
            WHERE producto_id=%s
        """, (costo_ant, nuevo_costo, promedio, pid))
    else:
        insert("""
            INSERT INTO inv_costos (producto_id, costo, costo_anterior, costo_promedio)
            VALUES (%s,%s,0,%s)
        """, (pid, nuevo_costo, nuevo_costo))
    return {"msg": "Costo actualizado", "costo": nuevo_costo}


@router.get("/productos/{pid}/componentes")
def get_componentes(pid: int, u=Depends(get_current_user)):
    return query("""
        SELECT pc.*, p.descripcion as componente_nombre, p.codigo
        FROM inv_producto_componentes pc
        JOIN inv_productos p ON p.id=pc.componente_id
        WHERE pc.producto_id=%s
    """, (pid,))

@router.post("/productos/{pid}/componentes")
def agregar_componente(pid: int, c: ComponenteIn, u=Depends(get_current_user)):
    # Verificar que tabla existe
    try:
        existe = query_one("""
            SELECT id FROM inv_producto_componentes
            WHERE producto_id=%s AND componente_id=%s
        """, (pid, c.componente_id))
        if existe:
            execute("""
                UPDATE inv_producto_componentes SET cantidad=%s
                WHERE producto_id=%s AND componente_id=%s
            """, (c.cantidad, pid, c.componente_id))
        else:
            insert("""
                INSERT INTO inv_producto_componentes
                (producto_id, componente_id, cantidad)
                VALUES (%s,%s,%s)
            """, (pid, c.componente_id, c.cantidad))
        return {"msg": "Componente guardado"}
    except Exception as ex:
        raise HTTPException(400, f"Error: {str(ex)}")

@router.delete("/productos/{pid}/componentes/{cid}")
def eliminar_componente(pid: int, cid: int, u=Depends(get_current_user)):
    execute("""
        DELETE FROM inv_producto_componentes
        WHERE producto_id=%s AND componente_id=%s
    """, (pid, cid))
    return {"msg": "Componente eliminado"}

@router.get("/productos/{pid}/stock-combo")
def get_stock_combo(pid: int, bodega_id: Optional[int] = None, u=Depends(get_current_user)):
    """Calcula el stock disponible de un combo basado en sus componentes"""
    componentes = query("""
        SELECT pc.componente_id, pc.cantidad as cant_requerida,
               p.descripcion, p.codigo,
               COALESCE(s.cantidad, 0) as stock_disponible,
               b.nombre as bodega
        FROM inv_producto_componentes pc
        JOIN inv_productos p ON p.id=pc.componente_id
        LEFT JOIN inv_stock s ON s.producto_id=pc.componente_id
            AND s.bodega_id=%s
        LEFT JOIN inv_bodegas b ON b.id=s.bodega_id
        WHERE pc.producto_id=%s
    """, (bodega_id or 1, pid))

    if not componentes:
        return {"es_combo": False, "stock_disponible": 0, "componentes": []}

    detalles = []
    for c in componentes:
        cant_req  = float(c["cant_requerida"])
        cant_disp = float(c["stock_disponible"])
        stock_combo = int(cant_disp / cant_req) if cant_req > 0 else 0
        detalles.append({
            **c,
            "stock_combo": stock_combo,
            "alcanza": cant_disp >= cant_req,
        })

    # Stock del combo = mínimo de lo que alcanza para cada componente
    stock_total = min(d["stock_combo"] for d in detalles) if detalles else 0
    faltantes   = [d for d in detalles if not d["alcanza"]]

    return {
        "es_combo":        True,
        "stock_disponible": stock_total,
        "componentes":     detalles,
        "tiene_faltantes": len(faltantes) > 0,
        "faltantes":       faltantes,
    }


# ── SERIES POR PRODUCTO ─────────────────────────────────────

@router.get("/productos/{pid}/series")
def get_series(pid: int, bodega_id: Optional[int] = None, u=Depends(get_current_user)):
    cond = "WHERE s.producto_id=%s"
    params = [pid]
    if bodega_id:
        cond += " AND s.bodega_id=%s"; params.append(bodega_id)
    return query(f"""
        SELECT s.*, b.nombre as bodega
        FROM inv_series s
        LEFT JOIN inv_bodegas b ON b.id=s.bodega_id
        {cond} ORDER BY s.estado, s.serie
    """, params)

@router.get("/productos/{pid}/series-bodega")
def get_series_bodega(pid: int, bodega_id: Optional[int] = None, u=Depends(get_current_user)):
    conds = ["s.producto_id=%s", "s.estado IN ('DISPONIBLE','EXHIBICION')"]
    params = [pid]
    if bodega_id:
        conds.append("s.bodega_id=%s")
        params.append(bodega_id)
    where = " AND ".join(conds)
    return query(f"""
        SELECT s.id, s.serie, s.estado, s.bodega_id, b.nombre as bodega
        FROM inv_series s
        LEFT JOIN inv_bodegas b ON b.id = s.bodega_id
        WHERE {where}
        ORDER BY CASE s.estado WHEN 'EXHIBICION' THEN 0 ELSE 1 END, s.serie
    """, params)

@router.post("/productos/{pid}/series")
def agregar_serie(pid: int, s: SerieIn, u=Depends(get_current_user)):
    existe = query_one(
        "SELECT id FROM inv_series WHERE serie=%s AND producto_id=%s",
        (s.serie, pid))
    if existe:
        raise HTTPException(400, f"La serie {s.serie} ya existe para este producto")
    sid = insert("""
        INSERT INTO inv_series (producto_id, bodega_id, serie, estado)
        VALUES (%s,%s,%s,'DISPONIBLE')
    """, (pid, s.bodega_id, s.serie.upper().strip()))
    return {"id": sid, "msg": "Serie agregada"}

@router.patch("/series/{sid}/estado")
def cambiar_estado_serie(sid: int, estado: str, u=Depends(get_current_user)):
    if estado not in ('DISPONIBLE','VENDIDA','TRANSFERIDA','DEVUELTA','DAÑADA','EXHIBICION'):
        raise HTTPException(400, "Estado inválido")
    execute("UPDATE inv_series SET estado=%s WHERE id=%s", (estado, sid))
    return {"msg": "Estado actualizado"}

@router.delete("/series/{sid}")
def eliminar_serie(sid: int, u=Depends(get_current_user)):
    s = query_one("SELECT estado FROM inv_series WHERE id=%s", (sid,))
    if not s: raise HTTPException(404)
    if s["estado"] in ("VENDIDA", "TRANSFERIDA"):
        raise HTTPException(400, "No se puede eliminar una serie vendida o transferida")
    execute("DELETE FROM inv_series WHERE id=%s", (sid,))
    return {"msg": "Serie eliminada"}


# ── OFFER LABEL TRACKING ────────────────────────────────────

@router.get("/ofertas/proximas-etiqueta")
def get_ofertas_proximas(
    dias_anticipacion: int = 2,
    u=Depends(get_current_user)
):
    """Ofertas que empiezan dentro de N días o ya activas — pendientes de imprimir"""
    suc_id = u.get("sucursal_id")
    return query("""
        SELECT
            o.id,
            o.producto_id,
            p.codigo,
            p.descripcion,
            p.codigo_barras,
            p.iva_porcentaje,
            m.nombre  as marca_nombre,
            c.nombre  as categoria_nombre,
            tp.nombre as tipo_precio_nombre,
            o.precio_oferta,
            o.fecha_inicio,
            o.fecha_fin,
            o.descripcion as descripcion_oferta,
            o.etiqueta_impresa,
            o.etiqueta_impresa_at,
            CASE
                WHEN o.fecha_inicio <= CURRENT_DATE AND o.fecha_fin >= CURRENT_DATE
                    THEN 'ACTIVA'
                WHEN o.fecha_inicio > CURRENT_DATE
                    THEN 'PROXIMA'
                ELSE 'VENCIDA'
            END as estado_oferta,
            (o.fecha_inicio - CURRENT_DATE) as dias_para_inicio,
            COALESCE((SELECT SUM(s.cantidad) FROM inv_stock s
                JOIN inv_bodegas b ON b.id=s.bodega_id
                WHERE s.producto_id=p.id
                AND (%s = 0 OR b.sucursal_id=%s)
            ),0) as stock_total,
            (
                SELECT json_agg(json_build_object(
                    'tipo_precio_id', pr.tipo_precio_id,
                    'tipo_nombre',    tp2.nombre,
                    'precio',         pr.precio,
                    'precio_pvp',     ROUND(pr.precio*(1+p.iva_porcentaje/100.0),2)
                ) ORDER BY tp2.nombre)
                FROM inv_precios pr
                JOIN inv_tipos_precio tp2 ON tp2.id=pr.tipo_precio_id
                WHERE pr.producto_id=p.id AND pr.activo=true
            ) as precios
        FROM inv_ofertas o
        JOIN inv_productos    p  ON p.id  = o.producto_id
        JOIN inv_tipos_precio tp ON tp.id = o.tipo_precio_id
        LEFT JOIN inv_marcas     m ON m.id = p.marca_id
        LEFT JOIN inv_categorias c ON c.id = p.categoria_id
        WHERE o.activa = true
          AND o.fecha_fin >= CURRENT_DATE
          AND o.fecha_inicio <= CURRENT_DATE + INTERVAL '%s days'
          AND (
            %s = 0
            OR EXISTS (
                SELECT 1 FROM inv_stock s2
                JOIN inv_bodegas b2 ON b2.id=s2.bodega_id
                WHERE s2.producto_id=p.id
                  AND b2.sucursal_id=%s
                  AND s2.cantidad>0
            )
          )
        ORDER BY o.etiqueta_impresa ASC, o.fecha_inicio ASC
    """, (suc_id or 0, suc_id or 0,
          dias_anticipacion,
          suc_id or 0, suc_id or 0))


@router.post("/ofertas/{oid}/marcar-impresa")
def marcar_oferta_impresa(oid: int, u=Depends(get_current_user)):
    execute("""
        UPDATE inv_ofertas
        SET etiqueta_impresa=true, etiqueta_impresa_at=NOW()
        WHERE id=%s
    """, (oid,))
    return {"msg": "Oferta marcada como impresa"}

@router.post("/ofertas/marcar-impresas")
def marcar_ofertas_impresas(body: IdsIn, u=Depends(get_current_user)):
    ids = body.ids
    if not ids: return {"msg": "Sin IDs"}
    placeholders = ",".join(["%s"]*len(ids))
    execute(f"""
        UPDATE inv_ofertas SET etiqueta_impresa=true, etiqueta_impresa_at=NOW()
        WHERE id IN ({placeholders})
    """, ids)
    return {"msg": f"{len(ids)} oferta(s) marcadas"}

@router.post("/ofertas/{oid}/desmarcar-impresa")
def desmarcar_oferta_impresa(oid: int, u=Depends(get_current_user)):
    """Por si se equivocaron al marcar"""
    execute("""
        UPDATE inv_ofertas SET etiqueta_impresa=false, etiqueta_impresa_at=NULL
        WHERE id=%s
    """, (oid,))
    return {"msg": "Oferta desmarcada"}


# ══════════════════════════════════════════════════════════════
#  LOTES Y VENCIMIENTOS
# ══════════════════════════════════════════════════════════════

class LoteIn(BaseModel):
    lote:              str
    bodega_id:         Optional[int] = None
    fecha_fabricacion: Optional[str] = None
    fecha_vencimiento: Optional[str] = None
    cantidad:          float = 0

@router.get("/productos/{pid}/lotes")
def get_lotes_producto(pid: int, u=Depends(get_current_user)):
    return query("""
        SELECT l.*, b.nombre as bodega_nombre,
               (l.fecha_vencimiento - CURRENT_DATE) as dias_para_vencer
        FROM inv_lotes l
        LEFT JOIN inv_bodegas b ON b.id=l.bodega_id
        WHERE l.producto_id=%s
        ORDER BY l.fecha_vencimiento ASC NULLS LAST
    """, (pid,))

@router.post("/productos/{pid}/lotes")
def crear_lote(pid: int, l: LoteIn, u=Depends(get_current_user)):
    lid = insert("""
        INSERT INTO inv_lotes (producto_id, bodega_id, lote, fecha_fabricacion,
                               fecha_vencimiento, cantidad, estado)
        VALUES (%s,%s,%s,%s,%s,%s,'DISPONIBLE')
    """, (pid, l.bodega_id, l.lote, l.fecha_fabricacion or None,
          l.fecha_vencimiento or None, l.cantidad))
    return {"id": lid, "msg": "Lote creado"}

@router.get("/lotes/por-vencer")
def lotes_por_vencer(dias: int = 30, u=Depends(get_current_user)):
    return query("""
        SELECT l.id, l.lote, l.fecha_vencimiento, l.cantidad, l.estado,
               p.codigo, p.descripcion as producto,
               b.nombre as bodega,
               (l.fecha_vencimiento - CURRENT_DATE) as dias_para_vencer
        FROM inv_lotes l
        JOIN inv_productos p ON p.id=l.producto_id
        LEFT JOIN inv_bodegas b ON b.id=l.bodega_id
        WHERE l.estado='DISPONIBLE'
          AND l.fecha_vencimiento IS NOT NULL
          AND l.fecha_vencimiento <= CURRENT_DATE + INTERVAL '%s days'
        ORDER BY l.fecha_vencimiento ASC
    """, (dias,))

@router.patch("/lotes/{lid}")
def actualizar_lote(lid: int, cantidad: Optional[float] = None,
                    estado: Optional[str] = None, u=Depends(get_current_user)):
    lote = query_one("SELECT id FROM inv_lotes WHERE id=%s", (lid,))
    if not lote:
        raise HTTPException(404, "Lote no encontrado")
    if cantidad is not None:
        execute("UPDATE inv_lotes SET cantidad=%s WHERE id=%s", (cantidad, lid))
    if estado is not None:
        execute("UPDATE inv_lotes SET estado=%s WHERE id=%s", (estado, lid))
    return {"msg": "Lote actualizado"}


# ══════════════════════════════════════════════════════════════
#  UNIDADES DE MEDIDA
# ══════════════════════════════════════════════════════════════

class UnidadMedidaIn(BaseModel):
    nombre:      str
    abreviatura: str
    activa:      bool = True

@router.get("/unidades-medida")
def get_unidades_medida(u=Depends(get_current_user)):
    return query("SELECT * FROM inv_unidades_medida WHERE activa=true ORDER BY nombre")

@router.post("/unidades-medida")
def crear_unidad_medida(um: UnidadMedidaIn, u=Depends(get_current_user)):
    uid = insert("""
        INSERT INTO inv_unidades_medida (nombre, abreviatura, activa)
        VALUES (%s, %s, %s)
    """, (um.nombre, um.abreviatura, um.activa))
    return {"id": uid, "msg": "Unidad de medida creada"}
