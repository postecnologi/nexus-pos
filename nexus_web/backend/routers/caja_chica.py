"""
Módulo de Caja Chica
Control de gastos menores con foto del recibo y reembolso mensual.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from database import query, query_one, execute, insert
from auth import get_current_user
from typing import Optional
from datetime import date
from pathlib import Path
import shutil, uuid

router = APIRouter(prefix="/api/caja-chica", tags=["Caja Chica"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "caja_chica"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ══════════════════════════════════════════════════════════════
#  FONDOS
# ══════════════════════════════════════════════════════════════

@router.get("/fondos")
def get_fondos(u=Depends(get_current_user)):
    return query("""
        SELECT f.*, s.nombre as sucursal_nombre,
               us.nombre as responsable_nombre,
               COALESCE((
                   SELECT SUM(g.monto) FROM fin_caja_chica_gastos g
                   WHERE g.fondo_id = f.id AND g.estado = 'APROBADO'
                     AND g.fecha >= DATE_TRUNC('month', CURRENT_DATE)
               ), 0) as gastado_mes,
               f.monto_asignado - COALESCE((
                   SELECT SUM(g.monto) FROM fin_caja_chica_gastos g
                   WHERE g.fondo_id = f.id AND g.estado = 'APROBADO'
                     AND g.reembolsado = false
               ), 0) as saldo_disponible
        FROM fin_caja_chica_fondos f
        LEFT JOIN sys_sucursales s ON s.id = f.sucursal_id
        LEFT JOIN sys_usuarios us ON us.id = f.responsable_id
        WHERE f.activo = true
        ORDER BY f.nombre
    """)


@router.post("/fondos")
def crear_fondo(data: dict, u=Depends(get_current_user)):
    fid = insert("""
        INSERT INTO fin_caja_chica_fondos
            (nombre, sucursal_id, responsable_id, monto_asignado, descripcion, activo)
        VALUES (%s,%s,%s,%s,%s,true)
    """, (data["nombre"], data.get("sucursal_id"),
          data.get("responsable_id") or u.get("id"),
          float(data.get("monto_asignado", 0)),
          data.get("descripcion","")))
    return {"id": fid, "msg": "Fondo creado"}


@router.put("/fondos/{fid}")
def actualizar_fondo(fid: int, data: dict, u=Depends(get_current_user)):
    execute("""
        UPDATE fin_caja_chica_fondos SET nombre=%s, monto_asignado=%s,
            responsable_id=%s, descripcion=%s WHERE id=%s
    """, (data["nombre"], float(data.get("monto_asignado",0)),
          data.get("responsable_id"), data.get("descripcion",""), fid))
    return {"msg": "Fondo actualizado"}


# ══════════════════════════════════════════════════════════════
#  GASTOS
# ══════════════════════════════════════════════════════════════

@router.get("/gastos")
def get_gastos(
    fondo_id: Optional[int] = None,
    desde: Optional[str] = None,
    hasta: Optional[str] = None,
    estado: Optional[str] = None,
    u=Depends(get_current_user)
):
    conds = ["1=1"]
    params = []
    if fondo_id: conds.append("g.fondo_id=%s"); params.append(fondo_id)
    if desde:    conds.append("g.fecha>=%s");   params.append(desde)
    if hasta:    conds.append("g.fecha<=%s");   params.append(hasta)
    if estado:   conds.append("g.estado=%s");   params.append(estado)
    return query(f"""
        SELECT g.*, f.nombre as fondo_nombre,
               u.nombre as usuario_nombre,
               ap.nombre as aprobado_por_nombre
        FROM fin_caja_chica_gastos g
        JOIN fin_caja_chica_fondos f ON f.id = g.fondo_id
        LEFT JOIN sys_usuarios u  ON u.id  = g.usuario_id
        LEFT JOIN sys_usuarios ap ON ap.id = g.aprobado_por
        WHERE {' AND '.join(conds)}
        ORDER BY g.fecha DESC, g.created_at DESC
        LIMIT 200
    """, params)


@router.post("/gastos")
def registrar_gasto(data: dict, u=Depends(get_current_user)):
    fondo = query_one("SELECT * FROM fin_caja_chica_fondos WHERE id=%s AND activo=true",
                      (data["fondo_id"],))
    if not fondo:
        raise HTTPException(404, "Fondo no encontrado")

    gid = insert("""
        INSERT INTO fin_caja_chica_gastos
            (fondo_id, fecha, concepto, categoria, monto, proveedor,
             numero_recibo, usuario_id, estado, observacion)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'PENDIENTE',%s)
    """, (data["fondo_id"],
          data.get("fecha", str(date.today())),
          data["concepto"],
          data.get("categoria", "VARIOS"),
          float(data["monto"]),
          data.get("proveedor",""),
          data.get("numero_recibo",""),
          u.get("id"),
          data.get("observacion","")))
    return {"id": gid, "msg": "Gasto registrado"}


@router.post("/gastos/{gid}/foto")
async def subir_foto(gid: int, file: UploadFile = File(...), u=Depends(get_current_user)):
    ext  = Path(file.filename).suffix.lower() if file.filename else ".jpg"
    nombre = f"gasto_{gid}_{uuid.uuid4().hex[:8]}{ext}"
    ruta = UPLOAD_DIR / nombre
    with open(ruta, "wb") as f:
        shutil.copyfileobj(file.file, f)
    url = f"/uploads/caja_chica/{nombre}"
    execute("UPDATE fin_caja_chica_gastos SET foto_recibo=%s WHERE id=%s", (url, gid))
    return {"url": url}


@router.patch("/gastos/{gid}/aprobar")
def aprobar_gasto(gid: int, u=Depends(get_current_user)):
    g = query_one("SELECT * FROM fin_caja_chica_gastos WHERE id=%s", (gid,))
    if not g: raise HTTPException(404)
    if g["estado"] == "APROBADO": raise HTTPException(400, "Ya está aprobado")
    execute("""
        UPDATE fin_caja_chica_gastos
        SET estado='APROBADO', aprobado_por=%s, aprobado_at=NOW()
        WHERE id=%s
    """, (u.get("id"), gid))
    # Asiento contable automático
    try:
        from routers.contabilidad import generar_asiento_automatico
        generar_asiento_automatico('caja_chica_gasto', {
            "referencia": f"CC-{gid}",
            "monto":      float(g.get("monto", 0)),
            "concepto":   g.get("concepto", "Gasto caja chica"),
        })
    except Exception:
        pass
    return {"msg": "Gasto aprobado"}


@router.patch("/gastos/{gid}/rechazar")
def rechazar_gasto(gid: int, data: dict = {}, u=Depends(get_current_user)):
    execute("""
        UPDATE fin_caja_chica_gastos
        SET estado='RECHAZADO', observacion=%s WHERE id=%s
    """, (data.get("motivo",""), gid))
    return {"msg": "Gasto rechazado"}


# ══════════════════════════════════════════════════════════════
#  REEMBOLSO
# ══════════════════════════════════════════════════════════════

@router.post("/fondos/{fid}/reembolso")
def generar_reembolso(fid: int, u=Depends(get_current_user)):
    """
    Marca todos los gastos aprobados no reembolsados como reembolsados
    y genera el total a reponer al fondo.
    """
    gastos = query("""
        SELECT id, monto FROM fin_caja_chica_gastos
        WHERE fondo_id=%s AND estado='APROBADO' AND reembolsado=false
    """, (fid,))

    if not gastos:
        raise HTTPException(400, "No hay gastos aprobados pendientes de reembolso")

    total = sum(float(g["monto"]) for g in gastos)
    ids   = [g["id"] for g in gastos]

    # Marcar como reembolsados
    execute(f"""
        UPDATE fin_caja_chica_gastos
        SET reembolsado=true, reembolsado_at=NOW()
        WHERE id = ANY(ARRAY{ids}::integer[])
    """)

    # Registrar en log
    insert("""
        INSERT INTO fin_caja_chica_reembolsos
            (fondo_id, total_reembolsado, num_gastos, usuario_id)
        VALUES (%s,%s,%s,%s)
    """, (fid, total, len(gastos), u.get("id")))

    # Asiento contable automático del reembolso
    try:
        from routers.contabilidad import generar_asiento_automatico
        generar_asiento_automatico('caja_chica_reembolso', {
            "referencia":  f"CC-REIMB-{fid}",
            "monto":       total,
            "num_gastos":  len(gastos),
        })
    except Exception:
        pass

    return {
        "msg": f"Reembolso generado: ${total:.2f} por {len(gastos)} gastos",
        "total": total,
        "num_gastos": len(gastos)
    }


@router.get("/fondos/{fid}/reembolsos")
def get_reembolsos(fid: int, u=Depends(get_current_user)):
    return query("""
        SELECT r.*, u.nombre as usuario_nombre
        FROM fin_caja_chica_reembolsos r
        LEFT JOIN sys_usuarios u ON u.id = r.usuario_id
        WHERE r.fondo_id=%s
        ORDER BY r.created_at DESC
    """, (fid,))


# ══════════════════════════════════════════════════════════════
#  RESUMEN
# ══════════════════════════════════════════════════════════════

@router.get("/resumen")
def get_resumen(fondo_id: Optional[int] = None, u=Depends(get_current_user)):
    cond = "AND g.fondo_id=%s" if fondo_id else ""
    params = (fondo_id,) if fondo_id else ()
    return query_one(f"""
        SELECT
            COUNT(*) FILTER (WHERE g.estado='PENDIENTE')  as pendientes,
            COUNT(*) FILTER (WHERE g.estado='APROBADO')   as aprobados,
            COUNT(*) FILTER (WHERE g.estado='RECHAZADO')  as rechazados,
            COALESCE(SUM(g.monto) FILTER (WHERE g.estado='APROBADO'
                AND g.fecha >= DATE_TRUNC('month', CURRENT_DATE)), 0) as gasto_mes,
            COALESCE(SUM(g.monto) FILTER (WHERE g.estado='APROBADO'
                AND g.reembolsado=false), 0) as pendiente_reembolso
        FROM fin_caja_chica_gastos g
        WHERE 1=1 {cond}
    """, params)
