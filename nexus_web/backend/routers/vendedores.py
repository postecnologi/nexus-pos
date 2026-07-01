from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import query, query_one, execute, insert
from auth import get_current_user

router = APIRouter(prefix="/api", tags=["Vendedores"])


class VendedorIn(BaseModel):
    codigo:           Optional[str] = None
    nombre:           str
    apellidos:        Optional[str] = None
    cedula:           Optional[str] = None
    telefono:         Optional[str] = None
    email:            Optional[str] = None
    direccion:        Optional[str] = None
    ciudad:           Optional[str] = None
    fecha_ingreso:    Optional[str] = None
    fecha_nacimiento: Optional[str] = None
    sucursal_id:      Optional[int] = None
    comision_pct:     float = 0
    meta_mensual:     float = 0
    observaciones:    Optional[str] = None
    activo:           bool = True


class MetaSucursalIn(BaseModel):
    meta_mensual_vendedores: float


@router.get("/sucursales")
def get_sucursales(u=Depends(get_current_user)):
    return query("SELECT * FROM sys_sucursales WHERE activa=true ORDER BY nombre")


@router.get("/vendedores")
def get_vendedores(
    busqueda: str = "",
    activo: Optional[str] = "true",
    sucursal_id: Optional[int] = None,
    u=Depends(get_current_user)
):
    conds=[]; params=[]
    if activo=="true":    conds.append("v.activo=true")
    elif activo=="false": conds.append("v.activo=false")
    if sucursal_id: conds.append("v.sucursal_id=%s"); params.append(sucursal_id)
    if busqueda:
        conds.append("(v.nombre ILIKE %s OR v.cedula ILIKE %s OR v.codigo ILIKE %s)")
        params += [f"%{busqueda}%"]*3
    where = "WHERE "+" AND ".join(conds) if conds else ""
    rows = query(f"""
        SELECT v.id, v.codigo, v.nombre, v.apellidos, v.cedula,
               v.telefono, v.email, v.direccion, v.ciudad,
               v.fecha_ingreso, v.fecha_nacimiento,
               v.sucursal_id, v.activo, v.observaciones, v.created_at,
               CAST(COALESCE(v.comision_pct, 0) AS FLOAT)  as comision_pct,
               CAST(COALESCE(v.meta_mensual, 0) AS FLOAT)  as meta_mensual,
               s.nombre as sucursal_nombre,
               CAST(COALESCE(s.meta_mensual_vendedores, 0) AS FLOAT) as meta_sucursal,
               COALESCE(
                 (SELECT COUNT(*) FROM ven_vendedores v2
                  WHERE v2.sucursal_id=v.sucursal_id AND v2.activo=true), 1
               ) as vendedores_en_sucursal,
               CAST(COALESCE(
                 (SELECT SUM(f.subtotal_0 + f.subtotal_iva)
                  FROM ven_facturas f
                  WHERE f.vendedor_id=v.id
                  AND DATE_TRUNC('month', f.fecha_emision)=DATE_TRUNC('month', CURRENT_DATE)
                  AND f.estado='EMITIDA'), 0
               ) AS FLOAT) as ventas_mes_actual
        FROM ven_vendedores v
        LEFT JOIN sys_sucursales s ON s.id=v.sucursal_id
        {where}
        ORDER BY v.nombre
    """, params)
    return rows


@router.get("/vendedores/{vid}")
def get_vendedor(vid: int, u=Depends(get_current_user)):
    v = query_one("""
        SELECT v.*, s.nombre as sucursal_nombre
        FROM ven_vendedores v
        LEFT JOIN sys_sucursales s ON s.id=v.sucursal_id
        WHERE v.id=%s
    """, (vid,))
    if not v: raise HTTPException(404, "Vendedor no encontrado")
    return v


def _generar_codigo(nombre: str, apellidos: str = "") -> str:
    import re, unicodedata
    def limpiar(s):
        s = unicodedata.normalize('NFD', s or '')
        s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
        return re.sub(r'[^A-Z0-9]', '', s.upper())
    partes = limpiar(nombre)[:3] + limpiar(apellidos)[:3]
    base = partes[:6] if partes else "VEN"
    # Buscar siguiente número disponible para evitar duplicados
    n = 1
    while True:
        codigo = f"{base}{n:02d}"
        if not query_one("SELECT id FROM ven_vendedores WHERE codigo=%s", (codigo,)):
            return codigo
        n += 1

@router.post("/vendedores")
def crear_vendedor(v: VendedorIn, u=Depends(get_current_user)):
    codigo = (v.codigo or "").strip() or _generar_codigo(v.nombre, v.apellidos or "")
    existe = query_one(
        "SELECT id FROM ven_vendedores WHERE codigo=%s", (codigo,))
    if existe: raise HTTPException(400, "Ya existe un vendedor con ese código")
    vid = insert("""
        INSERT INTO ven_vendedores
        (codigo, nombre, apellidos, cedula, telefono, email,
         direccion, ciudad, fecha_ingreso, fecha_nacimiento,
         sucursal_id, comision_pct, meta_mensual, observaciones, activo)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (codigo, v.nombre, v.apellidos, v.cedula, v.telefono, v.email,
          v.direccion, v.ciudad,
          v.fecha_ingreso or None, v.fecha_nacimiento or None,
          v.sucursal_id, v.comision_pct, v.meta_mensual,
          v.observaciones, v.activo))
    return {"id": vid, "msg": "Vendedor creado"}


@router.put("/vendedores/{vid}")
def actualizar_vendedor(vid: int, v: VendedorIn, u=Depends(get_current_user)):
    existe = query_one(
        "SELECT id FROM ven_vendedores WHERE codigo=%s AND id!=%s", (v.codigo, vid))
    if existe: raise HTTPException(400, "Ya existe otro vendedor con ese código")
    execute("""
        UPDATE ven_vendedores SET
            codigo=%s, nombre=%s, apellidos=%s, cedula=%s, telefono=%s,
            email=%s, direccion=%s, ciudad=%s, fecha_ingreso=%s,
            fecha_nacimiento=%s, sucursal_id=%s, comision_pct=%s,
            meta_mensual=%s, observaciones=%s, activo=%s
        WHERE id=%s
    """, (v.codigo, v.nombre, v.apellidos, v.cedula, v.telefono, v.email,
          v.direccion, v.ciudad,
          v.fecha_ingreso or None, v.fecha_nacimiento or None,
          v.sucursal_id, v.comision_pct, v.meta_mensual,
          v.observaciones, v.activo, vid))
    return {"msg": "Vendedor actualizado"}


@router.patch("/vendedores/{vid}/toggle")
def toggle_vendedor(vid: int, u=Depends(get_current_user)):
    v = query_one("SELECT activo FROM ven_vendedores WHERE id=%s", (vid,))
    if not v: raise HTTPException(404)
    execute("UPDATE ven_vendedores SET activo=%s WHERE id=%s", (not v["activo"], vid))
    return {"activo": not v["activo"]}


@router.get("/vendedores/{vid}/ventas")
def get_ventas_vendedor(vid: int, mes: Optional[str] = None, u=Depends(get_current_user)):
    """Ventas del vendedor por mes con porcentaje de cumplimiento de meta"""
    if mes:
        fecha = mes + "-01"
    else:
        from datetime import date
        fecha = date.today().replace(day=1).isoformat()

    ventas = query_one("""
        SELECT
            COALESCE(SUM(subtotal_0 + subtotal_iva), 0) as base_imponible,
            COALESCE(SUM(total), 0) as total_ventas,
            COUNT(*) as num_facturas
        FROM ven_facturas
        WHERE vendedor_id=%s
        AND DATE_TRUNC('month', fecha_emision)=DATE_TRUNC('month', %s::date)
        AND estado='EMITIDA'
    """, (vid, fecha))

    vendedor = query_one("""
        SELECT v.meta_mensual,
               COALESCE(s.meta_mensual_vendedores,0) as meta_sucursal,
               COALESCE(
                   (SELECT COUNT(*) FROM ven_vendedores v2
                    WHERE v2.sucursal_id=v.sucursal_id AND v2.activo=true), 1
               ) as total_vendedores
        FROM ven_vendedores v
        LEFT JOIN sys_sucursales s ON s.id=v.sucursal_id
        WHERE v.id=%s
    """, (vid,))

    meta_individual  = float(vendedor["meta_mensual"]  or 0)
    meta_sucursal    = float(vendedor["meta_sucursal"]  or 0)
    total_vend      = int(vendedor["total_vendedores"] or 1)
    meta_prorrateada = round(meta_sucursal / total_vend, 2) if total_vend > 0 else 0
    meta_efectiva   = meta_individual if meta_individual > 0 else meta_prorrateada
    base_imponible  = float(ventas["base_imponible"] or 0)
    pct_cumplimiento = round((base_imponible / meta_efectiva * 100), 2) if meta_efectiva > 0 else 0

    return {
        "base_imponible":   base_imponible,
        "total_ventas":     float(ventas["total_ventas"] or 0),
        "num_facturas":     int(ventas["num_facturas"] or 0),
        "meta_individual":  meta_individual,
        "meta_sucursal":    meta_sucursal,
        "meta_prorrateada": meta_prorrateada,
        "meta_efectiva":    meta_efectiva,
        "pct_cumplimiento": pct_cumplimiento,
        "mes":              fecha[:7],
    }


@router.put("/sucursales/{sid}/meta")
def actualizar_meta_sucursal(sid: int, m: MetaSucursalIn, u=Depends(get_current_user)):
    # Verificar si existe la columna, si no la creamos
    try:
        execute("""
            UPDATE sys_sucursales SET meta_mensual_vendedores=%s WHERE id=%s
        """, (m.meta_mensual_vendedores, sid))
    except:
        execute("""
            ALTER TABLE sys_sucursales
            ADD COLUMN IF NOT EXISTS meta_mensual_vendedores NUMERIC(12,2) DEFAULT 0
        """)
        execute("""
            UPDATE sys_sucursales SET meta_mensual_vendedores=%s WHERE id=%s
        """, (m.meta_mensual_vendedores, sid))
    return {"msg": "Meta actualizada"}
