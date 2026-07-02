"""
Módulo de Horarios de Trabajo
Define turnos y jornadas por día de semana para cada empleado.
Permite calcular retrasos, horas extras y ausentismo con precisión.
"""
from fastapi import APIRouter, Depends, HTTPException
from database import query, query_one, execute, insert
from auth import get_current_user
from typing import Optional
from datetime import datetime, time, date, timedelta

router = APIRouter(prefix="/api/horarios", tags=["Horarios"])

DIAS = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"]


# ══════════════════════════════════════════════════════════════
#  CRUD HORARIOS
# ══════════════════════════════════════════════════════════════

@router.get("")
def get_horarios(u=Depends(get_current_user)):
    horarios = query("""
        SELECT h.*,
            COUNT(DISTINCT e.id) as empleados_asignados
        FROM nom_horarios h
        LEFT JOIN nom_empleados e ON e.horario_id = h.id AND e.activo = true
        WHERE h.activo = true
        GROUP BY h.id
        ORDER BY h.nombre
    """)
    for h in horarios:
        h["detalle"] = query("""
            SELECT * FROM nom_horario_detalle
            WHERE horario_id=%s ORDER BY dia_semana
        """, (h["id"],))
    return horarios


@router.get("/{hid}")
def get_horario(hid: int, u=Depends(get_current_user)):
    h = query_one("SELECT * FROM nom_horarios WHERE id=%s", (hid,))
    if not h: raise HTTPException(404)
    h["detalle"] = query("SELECT * FROM nom_horario_detalle WHERE horario_id=%s ORDER BY dia_semana", (hid,))
    return h


@router.post("")
def crear_horario(data: dict, u=Depends(get_current_user)):
    hid = insert("""
        INSERT INTO nom_horarios (nombre, descripcion, tolerancia_entrada_min, descanso_min, activo)
        VALUES (%s,%s,%s,%s,true)
    """, (data["nombre"], data.get("descripcion",""),
          int(data.get("tolerancia_entrada_min", 5)),
          int(data.get("descanso_min", 30))))

    # Crear detalle por día de semana
    for dia in data.get("detalle", []):
        _upsert_detalle(hid, dia)

    return {"id": hid, "msg": "Horario creado"}


@router.put("/{hid}")
def actualizar_horario(hid: int, data: dict, u=Depends(get_current_user)):
    execute("""
        UPDATE nom_horarios SET nombre=%s, descripcion=%s,
            tolerancia_entrada_min=%s, descanso_min=%s WHERE id=%s
    """, (data["nombre"], data.get("descripcion",""),
          int(data.get("tolerancia_entrada_min", 5)),
          int(data.get("descanso_min", 30)), hid))

    # Actualizar detalle
    execute("DELETE FROM nom_horario_detalle WHERE horario_id=%s", (hid,))
    for dia in data.get("detalle", []):
        _upsert_detalle(hid, dia)

    return {"msg": "Horario actualizado"}


@router.delete("/{hid}")
def eliminar_horario(hid: int, u=Depends(get_current_user)):
    en_uso = query_one("SELECT id FROM nom_empleados WHERE horario_id=%s AND activo=true LIMIT 1", (hid,))
    if en_uso:
        raise HTTPException(400, "Este horario está asignado a empleados activos")
    execute("UPDATE nom_horarios SET activo=false WHERE id=%s", (hid,))
    return {"msg": "Horario eliminado"}


def _upsert_detalle(horario_id: int, dia: dict):
    es_descanso = dia.get("es_descanso", False)
    insert("""
        INSERT INTO nom_horario_detalle
            (horario_id, dia_semana, hora_entrada, hora_salida, es_descanso, horas_laborables)
        VALUES (%s,%s,%s,%s,%s,%s)
    """, (horario_id,
          int(dia["dia_semana"]),
          dia.get("hora_entrada") if not es_descanso else None,
          dia.get("hora_salida")  if not es_descanso else None,
          es_descanso,
          float(dia.get("horas_laborables", 8)) if not es_descanso else 0))


# ══════════════════════════════════════════════════════════════
#  ASIGNAR HORARIO A EMPLEADO
# ══════════════════════════════════════════════════════════════

@router.post("/asignar")
def asignar_horario(data: dict, u=Depends(get_current_user)):
    empleado_ids = data.get("empleado_ids", [])
    horario_id   = data.get("horario_id")
    if not empleado_ids:
        raise HTTPException(400, "Selecciona al menos un empleado")

    for eid in empleado_ids:
        execute("UPDATE nom_empleados SET horario_id=%s WHERE id=%s", (horario_id, eid))

    return {"msg": f"Horario asignado a {len(empleado_ids)} empleado(s)"}


# ══════════════════════════════════════════════════════════════
#  CÁLCULO DE ASISTENCIA CON HORARIO
# ══════════════════════════════════════════════════════════════

def _str_to_time(s) -> Optional[time]:
    if not s: return None
    try:
        if isinstance(s, time): return s
        if isinstance(s, datetime): return s.time()
        parts = str(s).split(":")
        return time(int(parts[0]), int(parts[1]))
    except: return None

def calcular_novedad(entrada_dt: Optional[datetime], salida_dt: Optional[datetime],
                     detalle: dict, tolerancia_min: int, descanso_min: int) -> dict:
    """
    Calcula minutos_retraso, horas_extras_50, horas_extras_100
    comparando la asistencia real con el horario programado.
    """
    resultado = {
        "minutos_retraso":  0,
        "horas_trabajadas": 0.0,
        "horas_extras_50":  0.0,
        "horas_extras_100": 0.0,
        "estado":           "FALTA",
        "observacion":      "",
    }

    if detalle.get("es_descanso"):
        resultado["estado"] = "DESCANSO"
        return resultado

    h_entrada_prog = _str_to_time(detalle.get("hora_entrada"))
    h_salida_prog  = _str_to_time(detalle.get("hora_salida"))
    horas_lab      = float(detalle.get("horas_laborables") or 8)

    if not h_entrada_prog:
        return resultado  # Sin horario definido para ese día

    if not entrada_dt:
        resultado["estado"] = "FALTA"
        return resultado

    # ── Retraso ────────────────────────────────────────────
    ref_fecha = entrada_dt.date()
    prog_entrada_dt = datetime.combine(ref_fecha, h_entrada_prog)
    tolerancia_dt   = prog_entrada_dt + timedelta(minutes=tolerancia_min)

    retraso_min = 0
    if entrada_dt > tolerancia_dt:
        retraso_min = int((entrada_dt - prog_entrada_dt).total_seconds() / 60)
        resultado["estado"] = "TARDE"
    else:
        resultado["estado"] = "NORMAL"

    resultado["minutos_retraso"] = retraso_min

    # ── Horas trabajadas ───────────────────────────────────
    if salida_dt and salida_dt > entrada_dt:
        bruto_seg  = (salida_dt - entrada_dt).total_seconds()
        neto_horas = max(0, bruto_seg / 3600 - descanso_min / 60)
        resultado["horas_trabajadas"] = round(neto_horas, 2)

        if neto_horas < 4:
            resultado["estado"] = "MEDIO_DIA" if neto_horas >= 2 else "TARDE"

        # ── Horas extras ───────────────────────────────────
        extras = max(0, neto_horas - horas_lab)
        if extras > 0:
            # Ecuador: primeras 4h extras al 50%, restantes al 100%
            resultado["horas_extras_50"]  = round(min(extras, 4.0), 2)
            resultado["horas_extras_100"] = round(max(0, extras - 4.0), 2)
            if resultado["estado"] == "NORMAL":
                resultado["observacion"] = f"+{extras:.1f}h extras"

        # ── Salida anticipada ─────────────────────────────
        if h_salida_prog and salida_dt:
            prog_salida_dt = datetime.combine(ref_fecha, h_salida_prog)
            if salida_dt < prog_salida_dt - timedelta(minutes=5):
                falta_min = int((prog_salida_dt - salida_dt).total_seconds() / 60)
                resultado["observacion"] = f"Salió {falta_min}min antes"
    else:
        resultado["horas_trabajadas"] = 0

    return resultado


@router.post("/recalcular-asistencia")
def recalcular_asistencia(data: dict, u=Depends(get_current_user)):
    """
    Recalcula toda la asistencia de un período aplicando los horarios asignados.
    Útil al cambiar horarios o al importar datos del biométrico.
    """
    desde = data.get("desde", str(date.today().replace(day=1)))
    hasta = data.get("hasta", str(date.today()))
    empleado_id = data.get("empleado_id")

    conds = ["a.fecha>=%s AND a.fecha<=%s AND e.horario_id IS NOT NULL"]
    params = [desde, hasta]
    if empleado_id:
        conds.append("a.empleado_id=%s"); params.append(empleado_id)

    registros = query(f"""
        SELECT a.*, e.horario_id,
               h.tolerancia_entrada_min, h.descanso_min
        FROM nom_asistencia a
        JOIN nom_empleados e ON e.id = a.empleado_id
        JOIN nom_horarios h ON h.id = e.horario_id
        WHERE {' AND '.join(conds)}
    """, params)

    actualizados = 0
    for reg in registros:
        dia_semana = date.fromisoformat(str(reg["fecha"])[:10]).weekday()  # 0=Lunes
        detalle = query_one("""
            SELECT * FROM nom_horario_detalle
            WHERE horario_id=%s AND dia_semana=%s
        """, (reg["horario_id"], dia_semana))

        if not detalle:
            continue

        novedad = calcular_novedad(
            reg.get("hora_entrada"),
            reg.get("hora_salida"),
            detalle,
            int(reg.get("tolerancia_entrada_min") or 5),
            int(reg.get("descanso_min") or 30)
        )

        execute("""
            UPDATE nom_asistencia SET
                estado=%s, minutos_retraso=%s, horas_trabajadas=%s,
                horas_extras_50=%s, horas_extras_100=%s, observacion=%s
            WHERE id=%s
        """, (novedad["estado"], novedad["minutos_retraso"],
              novedad["horas_trabajadas"], novedad["horas_extras_50"],
              novedad["horas_extras_100"], novedad["observacion"],
              reg["id"]))
        actualizados += 1

    return {"actualizados": actualizados,
            "msg": f"{actualizados} registros recalculados con horarios"}


# ══════════════════════════════════════════════════════════════
#  REPORTE DE NOVEDADES (retrasos, faltas, extras)
# ══════════════════════════════════════════════════════════════

@router.get("/reporte/novedades")
def reporte_novedades(
    desde: str, hasta: str,
    empleado_id: Optional[int] = None,
    u=Depends(get_current_user)
):
    conds = ["a.fecha>=%s AND a.fecha<=%s"]
    params = [desde, hasta]
    if empleado_id:
        conds.append("a.empleado_id=%s"); params.append(empleado_id)

    return query(f"""
        SELECT
            e.id as empleado_id,
            e.nombres || ' ' || e.apellidos as empleado,
            e.cedula, e.cargo,
            COUNT(*) FILTER (WHERE a.estado='NORMAL')    as dias_normal,
            COUNT(*) FILTER (WHERE a.estado='TARDE')     as dias_tarde,
            COUNT(*) FILTER (WHERE a.estado='MEDIO_DIA') as medio_dia,
            COUNT(*) FILTER (WHERE a.estado='FALTA')     as faltas,
            COUNT(*) FILTER (WHERE a.estado='DESCANSO')  as dias_descanso,
            COALESCE(SUM(a.minutos_retraso),0)            as total_min_retraso,
            COALESCE(SUM(a.horas_trabajadas),0)           as total_horas,
            COALESCE(SUM(a.horas_extras_50),0)            as total_extras_50,
            COALESCE(SUM(a.horas_extras_100),0)           as total_extras_100
        FROM nom_asistencia a
        JOIN nom_empleados e ON e.id = a.empleado_id
        WHERE {' AND '.join(conds)}
        GROUP BY e.id, e.nombres, e.apellidos, e.cedula, e.cargo
        ORDER BY e.apellidos
    """, params)
