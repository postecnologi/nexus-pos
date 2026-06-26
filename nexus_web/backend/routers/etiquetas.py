from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from database import query, query_one, execute, insert
from auth import get_current_user
from typing import Optional
from pathlib import Path
import uuid

router = APIRouter(prefix="/api", tags=["Etiquetas"])

# ── Carpeta de uploads (misma que main.py pero relativa a routers/) ──
UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"

ALLOWED_TYPES = {"image/jpeg","image/png","image/gif","image/webp","image/svg+xml"}
MAX_SIZE_MB   = 5


# ══════════════════════════════════════════════════════════════
#  ENDPOINT ESPECIAL PARA ETIQUETAS — trae todos los precios
# ══════════════════════════════════════════════════════════════

@router.get("/gestion-precios/productos")
def get_productos_gestion_precios(
    busqueda:     Optional[str] = None,
    categoria_id: Optional[int] = None,
    marca_id:     Optional[int] = None,
    limit:        int = 500,
    u=Depends(get_current_user)
):
    """Todos los productos con TODOS sus precios PVP para gestión masiva"""
    conds  = ["p.activo=true"]
    params = []
    if busqueda:
        conds.append("(p.descripcion ILIKE %s OR p.codigo ILIKE %s)")
        params += [f"%{busqueda}%", f"%{busqueda}%"]
    if categoria_id:
        conds.append("p.categoria_id=%s"); params.append(categoria_id)
    if marca_id:
        conds.append("p.marca_id=%s"); params.append(marca_id)
    where = "WHERE " + " AND ".join(conds)
    return query(f"""
        SELECT
            p.id, p.codigo, p.descripcion,
            p.iva_porcentaje,
            m.nombre as marca_nombre,
            c.nombre as categoria_nombre,
            COALESCE((SELECT SUM(cantidad) FROM inv_stock WHERE producto_id=p.id),0) as stock_total,
            (
                SELECT json_agg(json_build_object(
                    'tipo_precio_id', pr.tipo_precio_id,
                    'tipo_nombre',    tp.nombre,
                    'precio',         pr.precio,
                    'precio_pvp',     ROUND(pr.precio*(1+p.iva_porcentaje/100.0),2)
                ) ORDER BY tp.nombre)
                FROM inv_precios pr
                JOIN inv_tipos_precio tp ON tp.id=pr.tipo_precio_id
                WHERE pr.producto_id=p.id AND pr.activo=true
            ) as precios,
            EXISTS(
                SELECT 1 FROM inv_ofertas o
                WHERE o.producto_id=p.id AND o.activa=true
                  AND o.fecha_inicio <= CURRENT_DATE
                  AND (o.fecha_fin IS NULL OR o.fecha_fin >= CURRENT_DATE)
            ) as tiene_oferta
        FROM inv_productos p
        LEFT JOIN inv_marcas m ON m.id=p.marca_id
        LEFT JOIN inv_categorias c ON c.id=p.categoria_id
        {where}
        ORDER BY p.descripcion
        LIMIT %s
    """, params + [limit]) or []


@router.get("/etiquetas/productos")
def get_productos_etiquetas(
    busqueda:   Optional[str] = None,
    categoria_id: Optional[int] = None,
    marca_id:   Optional[int] = None,
    con_stock:  bool = True,   # solo productos con stock > 0
    limit:      int  = 100,
    u=Depends(get_current_user)
):
    """Productos con TODOS sus precios para el editor de etiquetas"""
    conds  = ["p.activo=true"]
    params = []

    if busqueda:
        conds.append("(p.descripcion ILIKE %s OR p.codigo ILIKE %s)")
        params += [f"%{busqueda}%", f"%{busqueda}%"]
    if categoria_id:
        conds.append("p.categoria_id=%s")
        params.append(categoria_id)
    if marca_id:
        conds.append("p.marca_id=%s")
        params.append(marca_id)
    if con_stock:
        conds.append("""
            EXISTS (
                SELECT 1 FROM inv_stock s
                WHERE s.producto_id=p.id AND s.cantidad>0
            )
        """)

    where = "WHERE " + " AND ".join(conds)

    productos = query(f"""
        SELECT
            p.id, p.codigo, p.descripcion,
            p.codigo_barras,
            p.iva_porcentaje,
            m.nombre  as marca_nombre,
            c.nombre  as categoria_nombre,
            COALESCE((SELECT SUM(cantidad) FROM inv_stock WHERE producto_id=p.id),0) as stock_total,
            (
                SELECT json_agg(json_build_object(
                    'tipo_precio_id', pr.tipo_precio_id,
                    'tipo_nombre',    tp.nombre,
                    'precio',         pr.precio,
                    'precio_pvp',     ROUND(pr.precio*(1+p.iva_porcentaje/100.0),2)
                ) ORDER BY tp.nombre)
                FROM inv_precios pr
                JOIN inv_tipos_precio tp ON tp.id=pr.tipo_precio_id
                WHERE pr.producto_id=p.id AND pr.activo=true
            ) as precios,
            EXISTS(
                SELECT 1 FROM inv_ofertas o
                WHERE o.producto_id=p.id AND o.activa=true
                  AND o.fecha_inicio <= CURRENT_DATE
                  AND o.fecha_fin    >= CURRENT_DATE
            ) as tiene_oferta,
            (SELECT o.precio_oferta FROM inv_ofertas o
             WHERE o.producto_id=p.id AND o.activa=true
               AND o.fecha_inicio <= CURRENT_DATE
               AND o.fecha_fin    >= CURRENT_DATE
             ORDER BY o.created_at DESC LIMIT 1
            ) as precio_oferta,
            (SELECT o.fecha_fin FROM inv_ofertas o
             WHERE o.producto_id=p.id AND o.activa=true
               AND o.fecha_inicio <= CURRENT_DATE
               AND o.fecha_fin    >= CURRENT_DATE
             ORDER BY o.created_at DESC LIMIT 1
            ) as fecha_fin_oferta,
            (SELECT o.fecha_inicio FROM inv_ofertas o
             WHERE o.producto_id=p.id AND o.activa=true
               AND o.fecha_inicio <= CURRENT_DATE
               AND o.fecha_fin    >= CURRENT_DATE
             ORDER BY o.created_at DESC LIMIT 1
            ) as fecha_ini_oferta,
            (SELECT o.descripcion FROM inv_ofertas o
             WHERE o.producto_id=p.id AND o.activa=true
               AND o.fecha_inicio <= CURRENT_DATE
               AND o.fecha_fin    >= CURRENT_DATE
             ORDER BY o.created_at DESC LIMIT 1
            ) as desc_oferta
        FROM inv_productos p
        LEFT JOIN inv_marcas     m ON m.id=p.marca_id
        LEFT JOIN inv_categorias c ON c.id=p.categoria_id
        {where}
        ORDER BY p.descripcion
        LIMIT %s
    """, params + [limit])

    # Si no tiene precios, agregar array vacío
    for prod in productos:
        if not prod.get("precios"):
            prod["precios"] = []

    return productos


@router.get("/etiquetas/plantillas")
def get_plantillas_etiquetas(u=Depends(get_current_user)):
    try:
        execute("""
            CREATE TABLE IF NOT EXISTS cfg_etiquetas_plantillas (
                id         SERIAL PRIMARY KEY,
                nombre     VARCHAR(100) NOT NULL,
                datos      TEXT NOT NULL,
                usuario_id INTEGER REFERENCES sys_usuarios(id),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """)
    except: pass
    return query("""
        SELECT id, nombre, datos, created_at
        FROM cfg_etiquetas_plantillas
        WHERE usuario_id=%s OR usuario_id IS NULL
        ORDER BY updated_at DESC
    """, (u["id"],)) or []

@router.post("/etiquetas/plantillas")
def guardar_plantilla_etiqueta(body: dict, u=Depends(get_current_user)):
    nombre = body.get("nombre","Sin nombre")
    datos  = body.get("datos","")
    pid    = body.get("id")
    if pid:
        execute("""
            UPDATE cfg_etiquetas_plantillas
            SET nombre=%s, datos=%s, updated_at=NOW()
            WHERE id=%s AND usuario_id=%s
        """, (nombre, datos, pid, u["id"]))
        return {"id": pid, "msg": "Actualizada"}
    new_id = insert("""
        INSERT INTO cfg_etiquetas_plantillas (nombre, datos, usuario_id)
        VALUES (%s,%s,%s)
    """, (nombre, datos, u["id"]))
    return {"id": new_id, "msg": "Guardada"}

@router.delete("/etiquetas/plantillas/{pid}")
def eliminar_plantilla_etiqueta(pid: int, u=Depends(get_current_user)):
    execute("DELETE FROM cfg_etiquetas_plantillas WHERE id=%s AND usuario_id=%s", (pid, u["id"]))
    return {"msg": "Eliminada"}


@router.get("/etiquetas/categorias")
def get_categorias_etiquetas(u=Depends(get_current_user)):
    """Categorías que tienen productos con stock"""
    return query("""
        SELECT c.id, c.nombre,
               COUNT(DISTINCT p.id) as num_productos,
               COALESCE(SUM(s.cantidad),0) as stock_total
        FROM inv_categorias c
        JOIN inv_productos p ON p.categoria_id=c.id AND p.activo=true
        JOIN inv_stock s ON s.producto_id=p.id AND s.cantidad>0
        GROUP BY c.id, c.nombre
        ORDER BY c.nombre
    """)


@router.get("/etiquetas/marcas")
def get_marcas_etiquetas(u=Depends(get_current_user)):
    """Marcas que tienen productos con stock"""
    return query("""
        SELECT m.id, m.nombre,
               COUNT(DISTINCT p.id) as num_productos,
               COALESCE(SUM(s.cantidad),0) as stock_total
        FROM inv_marcas m
        JOIN inv_productos p ON p.marca_id=m.id AND p.activo=true
        JOIN inv_stock s ON s.producto_id=p.id AND s.cantidad>0
        GROUP BY m.id, m.nombre
        ORDER BY m.nombre
    """)



# ══════════════════════════════════════════════════════════════
#  GESTIÓN DE IMÁGENES
# ══════════════════════════════════════════════════════════════

@router.post("/imagenes/subir")
async def subir_imagen(
    file: UploadFile = File(...),
    carpeta: str = "etiquetas",
    u=Depends(get_current_user)
):
    # Validar tipo
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Tipo no permitido: {file.content_type}. Use JPG, PNG, GIF, WEBP o SVG")

    # Leer y validar tamaño
    data = await file.read()
    if len(data) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"Imagen muy grande (máx {MAX_SIZE_MB}MB)")

    # Crear subcarpeta
    sub = UPLOAD_DIR / carpeta
    sub.mkdir(parents=True, exist_ok=True)

    # Nombre único
    ext      = Path(file.filename).suffix.lower() or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    dest     = sub / filename

    # Guardar
    dest.write_bytes(data)

    url = f"/uploads/{carpeta}/{filename}"
    return {"url": url, "filename": filename, "carpeta": carpeta}


@router.get("/imagenes")
def listar_imagenes(carpeta: str = "etiquetas", u=Depends(get_current_user)):
    sub = UPLOAD_DIR / carpeta
    if not sub.exists():
        return []
    files = []
    for f in sorted(sub.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if f.is_file() and f.suffix.lower() in {".jpg",".jpeg",".png",".gif",".webp",".svg"}:
            size_kb = round(f.stat().st_size / 1024, 1)
            files.append({
                "filename": f.name,
                "url": f"/uploads/{carpeta}/{f.name}",
                "size_kb": size_kb,
                "carpeta": carpeta,
            })
    return files


@router.delete("/imagenes/{carpeta}/{filename}")
def eliminar_imagen(carpeta: str, filename: str, u=Depends(get_current_user)):
    # Sanitizar — no permitir rutas relativas
    if ".." in carpeta or ".." in filename:
        raise HTTPException(400, "Ruta inválida")
    dest = UPLOAD_DIR / carpeta / filename
    if not dest.exists():
        raise HTTPException(404, "Imagen no encontrada")
    dest.unlink()
    return {"msg": "Imagen eliminada"}
