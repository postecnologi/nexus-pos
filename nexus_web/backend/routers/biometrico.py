"""
Módulo de Control de Asistencia con Biométrico
Soporta ZKTeco y Anviz. Importación de archivos CSV/Excel.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from database import query, query_one, execute, insert
from auth import get_current_user
from typing import Optional
from datetime import datetime, date, timedelta
import io, csv

router = APIRouter(prefix="/api/biometrico", tags=["Biometrico"])


# ══════════════════════════════════════════════════════════════
#  DISPOSITIVOS
# ══════════════════════════════════════════════════════════════

@router.get("/dispositivos")
def get_dispositivos(sucursal_id: Optional[int] = None, u=Depends(get_current_user)):
    conds = ["1=1"]
    params = []
    if sucursal_id:
        conds.append("b.sucursal_id=%s"); params.append(sucursal_id)
    return query(f"""
        SELECT b.*, s.nombre as sucursal_nombre
        FROM nom_biometricos b
        LEFT JOIN sys_sucursales s ON s.id = b.sucursal_id
        WHERE {' AND '.join(conds)}
        ORDER BY s.nombre, b.nombre
    """, params)


@router.post("/dispositivos")
def crear_dispositivo(data: dict, u=Depends(get_current_user)):
    did = insert("""
        INSERT INTO nom_biometricos (nombre, marca, sucursal_id, device_id, descripcion, activo)
        VALUES (%s,%s,%s,%s,%s,true)
    """, (data["nombre"], data.get("marca","ZKTeco"),
          data.get("sucursal_id"), data.get("device_id",""),
          data.get("descripcion","")))
    return {"id": did, "msg": "Dispositivo registrado"}


@router.put("/dispositivos/{did}")
def actualizar_dispositivo(did: int, data: dict, u=Depends(get_current_user)):
    execute("""
        UPDATE nom_biometricos SET nombre=%s, marca=%s, sucursal_id=%s,
            device_id=%s, descripcion=%s WHERE id=%s
    """, (data["nombre"], data.get("marca","ZKTeco"),
          data.get("sucursal_id"), data.get("device_id",""),
          data.get("descripcion",""), did))
    return {"msg": "Dispositivo actualizado"}


@router.patch("/dispositivos/{did}/toggle")
def toggle_dispositivo(did: int, u=Depends(get_current_user)):
    d = query_one("SELECT activo FROM nom_biometricos WHERE id=%s", (did,))
    if not d: raise HTTPException(404)
    execute("UPDATE nom_biometricos SET activo=%s WHERE id=%s", (not d["activo"], did))
    return {"activo": not d["activo"]}


# ══════════════════════════════════════════════════════════════
#  MAPEO EMPLEADOS ↔ USUARIO BIOMÉTRICO
# ══════════════════════════════════════════════════════════════

@router.get("/mapeo")
def get_mapeo(biometrico_id: Optional[int] = None, u=Depends(get_current_user)):
    conds = ["1=1"]
    params = []
    if biometrico_id:
        conds.append("m.biometrico_id=%s"); params.append(biometrico_id)
    return query(f"""
        SELECT m.*, e.nombres, e.apellidos, e.cedula, e.cargo,
               b.nombre as biometrico_nombre, b.marca
        FROM nom_bio_mapeo m
        JOIN nom_empleados e ON e.id = m.empleado_id
        JOIN nom_biometricos b ON b.id = m.biometrico_id
        WHERE {' AND '.join(conds)}
        ORDER BY e.apellidos, e.nombres
    """, params)


@router.post("/mapeo")
def crear_mapeo(data: dict, u=Depends(get_current_user)):
    existe = query_one(
        "SELECT id FROM nom_bio_mapeo WHERE biometrico_id=%s AND bio_user_id=%s",
        (data["biometrico_id"], data["bio_user_id"])
    )
    if existe:
        execute("UPDATE nom_bio_mapeo SET empleado_id=%s WHERE id=%s",
                (data["empleado_id"], existe["id"]))
        return {"msg": "Mapeo actualizado"}
    mid = insert("""
        INSERT INTO nom_bio_mapeo (biometrico_id, bio_user_id, empleado_id)
        VALUES (%s,%s,%s)
    """, (data["biometrico_id"], data["bio_user_id"], data["empleado_id"]))
    return {"id": mid, "msg": "Mapeo creado"}


@router.delete("/mapeo/{mid}")
def eliminar_mapeo(mid: int, u=Depends(get_current_user)):
    execute("DELETE FROM nom_bio_mapeo WHERE id=%s", (mid,))
    return {"msg": "Mapeo eliminado"}


# ══════════════════════════════════════════════════════════════
#  IMPORTAR ASISTENCIA (CSV / TXT)
# ══════════════════════════════════════════════════════════════

def _parse_datetime(s: str):
    """Intenta parsear fecha/hora en formatos comunes de ZKTeco y Anviz."""
    s = s.strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M:%S", "%Y/%m/%d %H:%M",
                "%d/%m/%Y %H:%M", "%Y-%m-%d %H:%M", "%m/%d/%Y %H:%M:%S",
                "%m/%d/%Y %H:%M"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def _calcular_horas(entrada: datetime, salida: datetime, jornada_horas: float = 8.0):
    """Calcula horas trabajadas y horas extras desde entrada y salida."""
    if not entrada or not salida or salida <= entrada:
        return 0.0, 0.0, 0.0
    total = (salida - entrada).total_seconds() / 3600
    # Descontar 30 min de almuerzo si trabajó más de 5 horas
    trabajadas = max(0, total - 0.5) if total > 5 else total
    extras = max(0, trabajadas - jornada_horas)
    # Horas extras: hasta 4h al 50%, más de 4h al 100%
    extras_50  = min(extras, 4.0)
    extras_100 = max(0, extras - 4.0)
    return round(trabajadas, 2), round(extras_50, 2), round(extras_100, 2)


@router.post("/importar")
async def importar_asistencia(
    biometrico_id: int,
    file: UploadFile = File(...),
    u=Depends(get_current_user)
):
    """
    Importa registros de asistencia desde CSV exportado por ZKTeco o Anviz.
    Formato esperado (flexible, detecta columnas automáticamente):
    - ZKTeco: ID_Empleado, Nombre, Fecha_Hora, Tipo (0=entrada, 1=salida)
    - Anviz:  ID, Fecha, Hora_Entrada, Hora_Salida
    - Genérico: cualquier CSV con columnas de ID/cédula y fecha/hora
    """
    contenido = await file.read()
    try:
        texto = contenido.decode("utf-8")
    except UnicodeDecodeError:
        texto = contenido.decode("latin-1")

    # Detectar delimitador
    delim = "," if texto.count(",") > texto.count(";") else ";"
    reader = csv.DictReader(io.StringIO(texto), delimiter=delim)
    filas = list(reader)

    if not filas:
        raise HTTPException(400, "El archivo está vacío o no tiene el formato correcto")

    # Detectar columnas automáticamente
    cols = [c.lower().strip() for c in (reader.fieldnames or [])]

    def find_col(*candidates):
        for c in candidates:
            for i, col in enumerate(cols):
                if c in col:
                    return reader.fieldnames[i]
        return None

    col_id     = find_col("id","no","número","user","empleado","cedula","código")
    col_fecha  = find_col("fecha","date","time","datetime","hora")
    col_tipo   = find_col("tipo","type","estado","verificacion","io")
    col_salida = find_col("salida","out","fin","hora_salida")
    col_entrada = find_col("entrada","in","inicio","hora_entrada")

    if not col_id or not col_fecha:
        raise HTTPException(400,
            f"No se detectaron columnas de ID y Fecha. Columnas encontradas: {', '.join(reader.fieldnames or [])}")

    # Cargar mapeo biometrico → empleado
    mapeos = {str(m["bio_user_id"]): m["empleado_id"]
              for m in query("SELECT * FROM nom_bio_mapeo WHERE biometrico_id=%s", (biometrico_id,))}

    # Agrupar registros por empleado+fecha
    registros: dict = {}  # (bio_user_id, fecha) → {entradas: [], salidas: []}

    for fila in filas:
        bio_uid = str(fila.get(col_id, "")).strip()
        if not bio_uid:
            continue

        # Formato con columnas separadas de entrada y salida (Anviz style)
        if col_entrada and col_salida:
            fecha_str = str(fila.get(col_fecha, "")).strip()
            ent_str   = str(fila.get(col_entrada, "")).strip()
            sal_str   = str(fila.get(col_salida, "")).strip()
            dt_entrada = _parse_datetime(f"{fecha_str} {ent_str}") if ent_str else _parse_datetime(fecha_str)
            dt_salida  = _parse_datetime(f"{fecha_str} {sal_str}") if sal_str else None
            if dt_entrada:
                key = (bio_uid, dt_entrada.date())
                if key not in registros:
                    registros[key] = {"entradas": [], "salidas": []}
                registros[key]["entradas"].append(dt_entrada)
                if dt_salida:
                    registros[key]["salidas"].append(dt_salida)
        else:
            # Formato ZKTeco: una fila por marca (entrada o salida)
            dt = _parse_datetime(str(fila.get(col_fecha, "")).strip())
            if not dt:
                continue
            tipo = str(fila.get(col_tipo, "0")).strip() if col_tipo else "0"
            key  = (bio_uid, dt.date())
            if key not in registros:
                registros[key] = {"entradas": [], "salidas": []}
            # 0 = entrada, 1 = salida en ZKTeco
            if tipo in ("0", "entrada", "in", "check in"):
                registros[key]["entradas"].append(dt)
            else:
                registros[key]["salidas"].append(dt)

    # Insertar en nom_asistencia
    importados = 0
    sin_mapeo  = set()

    for (bio_uid, fecha), data in registros.items():
        empleado_id = mapeos.get(bio_uid)
        if not empleado_id:
            sin_mapeo.add(bio_uid)
            continue

        entradas = sorted(data["entradas"])
        salidas  = sorted(data["salidas"])
        entrada  = entradas[0] if entradas else None
        salida   = salidas[-1] if salidas else None

        horas_trab, ext_50, ext_100 = _calcular_horas(entrada, salida)

        # Determinar estado
        estado = "FALTA"
        if entrada:
            limite_entrada = entrada.replace(hour=8, minute=15, second=0)
            if entrada > limite_entrada:
                estado = "TARDE"
            elif horas_trab >= 7:
                estado = "NORMAL"
            elif horas_trab >= 4:
                estado = "MEDIO_DIA"
            else:
                estado = "TARDE"

        # Upsert: actualizar si ya existe para ese empleado y fecha
        existe = query_one(
            "SELECT id FROM nom_asistencia WHERE empleado_id=%s AND fecha=%s AND biometrico_id=%s",
            (empleado_id, fecha, biometrico_id)
        )
        if existe:
            execute("""
                UPDATE nom_asistencia SET hora_entrada=%s, hora_salida=%s,
                    horas_trabajadas=%s, horas_extras_50=%s, horas_extras_100=%s, estado=%s
                WHERE id=%s
            """, (entrada, salida, horas_trab, ext_50, ext_100, estado, existe["id"]))
        else:
            insert("""
                INSERT INTO nom_asistencia
                    (empleado_id, biometrico_id, fecha, hora_entrada, hora_salida,
                     horas_trabajadas, horas_extras_50, horas_extras_100, estado)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (empleado_id, biometrico_id, fecha, entrada, salida,
                  horas_trab, ext_50, ext_100, estado))
        importados += 1

    return {
        "importados": importados,
        "sin_mapeo": list(sin_mapeo),
        "msg": f"{importados} registros importados. {len(sin_mapeo)} IDs sin mapeo de empleado."
    }


# ══════════════════════════════════════════════════════════════
#  REGISTROS DE ASISTENCIA
# ══════════════════════════════════════════════════════════════

@router.get("/registros")
def get_registros(
    desde: Optional[str] = None,
    hasta: Optional[str] = None,
    empleado_id: Optional[int] = None,
    biometrico_id: Optional[int] = None,
    estado: Optional[str] = None,
    u=Depends(get_current_user)
):
    conds = ["1=1"]
    params = []
    if desde:
        conds.append("a.fecha>=%s"); params.append(desde)
    if hasta:
        conds.append("a.fecha<=%s"); params.append(hasta)
    if empleado_id:
        conds.append("a.empleado_id=%s"); params.append(empleado_id)
    if biometrico_id:
        conds.append("a.biometrico_id=%s"); params.append(biometrico_id)
    if estado:
        conds.append("a.estado=%s"); params.append(estado)
    return query(f"""
        SELECT a.*, e.nombres, e.apellidos, e.cedula, e.cargo,
               b.nombre as biometrico_nombre, b.marca
        FROM nom_asistencia a
        JOIN nom_empleados e ON e.id = a.empleado_id
        LEFT JOIN nom_biometricos b ON b.id = a.biometrico_id
        WHERE {' AND '.join(conds)}
        ORDER BY a.fecha DESC, e.apellidos
        LIMIT 500
    """, params)


@router.get("/resumen")
def get_resumen(
    periodo: str,  # YYYY-MM
    biometrico_id: Optional[int] = None,
    u=Depends(get_current_user)
):
    """Resumen mensual por empleado: días trabajados, faltas, tardanzas, horas extras."""
    anio, mes = int(periodo[:4]), int(periodo[5:7])
    desde = date(anio, mes, 1)
    hasta = date(anio, mes + 1, 1) - timedelta(days=1) if mes < 12 else date(anio, 12, 31)

    conds = ["a.fecha>=%s AND a.fecha<=%s"]
    params = [desde, hasta]
    if biometrico_id:
        conds.append("a.biometrico_id=%s"); params.append(biometrico_id)

    return query(f"""
        SELECT e.id as empleado_id, e.nombres, e.apellidos, e.cedula, e.cargo,
               COUNT(*) FILTER (WHERE a.estado='NORMAL')    as dias_normal,
               COUNT(*) FILTER (WHERE a.estado='TARDE')     as dias_tarde,
               COUNT(*) FILTER (WHERE a.estado='MEDIO_DIA') as medio_dia,
               COUNT(*) FILTER (WHERE a.estado='FALTA')     as faltas,
               COALESCE(SUM(a.horas_trabajadas),0)          as total_horas,
               COALESCE(SUM(a.horas_extras_50),0)           as total_extras_50,
               COALESCE(SUM(a.horas_extras_100),0)          as total_extras_100
        FROM nom_asistencia a
        JOIN nom_empleados e ON e.id = a.empleado_id
        WHERE {' AND '.join(conds)}
        GROUP BY e.id, e.nombres, e.apellidos, e.cedula, e.cargo
        ORDER BY e.apellidos
    """, params)


@router.post("/aplicar-a-nomina")
def aplicar_asistencia_a_nomina(data: dict, u=Depends(get_current_user)):
    """
    Toma el resumen de asistencia de un período y aplica las horas extras
    al rol de pagos de cada empleado (si está en BORRADOR).
    """
    periodo = data.get("periodo")  # YYYY-MM
    biometrico_id = data.get("biometrico_id")
    if not periodo:
        raise HTTPException(400, "Se requiere el periodo")

    resumen = get_resumen(periodo, biometrico_id, u)
    aplicados = 0
    sin_rol   = []

    for emp in resumen:
        rol = query_one(
            "SELECT id FROM nom_roles_pago WHERE empleado_id=%s AND periodo=%s AND estado='BORRADOR'",
            (emp["empleado_id"], periodo)
        )
        if not rol:
            sin_rol.append(f"{emp['apellidos']} {emp['nombres']}")
            continue

        # Actualizar novedades del rol con horas extras del biométrico
        from routers.nomina import _float as nf
        rol_data = query_one("SELECT * FROM nom_roles_pago WHERE id=%s", (rol["id"],))
        salario  = float(rol_data.get("salario_base") or 0)
        valor_hora = round(salario / 240, 4)
        h50   = float(emp["total_extras_50"] or 0)
        h100  = float(emp["total_extras_100"] or 0)
        val50  = round(valor_hora * 1.5 * h50, 2)
        val100 = round(valor_hora * 2.0 * h100, 2)
        comisiones = float(rol_data.get("comisiones") or 0)
        bonif      = float(rol_data.get("bonificaciones") or 0)
        total_ing  = round(salario + val50 + val100 + comisiones + bonif, 2)
        pct_pers   = float(rol_data.get("porcentaje_iess_personal") or 9.45) / 100
        pct_patr   = float(rol_data.get("porcentaje_iess_patronal") or 12.15) / 100
        ap         = round(total_ing * pct_pers, 2)
        app        = round(total_ing * pct_patr, 2)
        prestamos  = float(rol_data.get("prestamos_empresa") or 0)
        anticipo   = float(rol_data.get("anticipo") or 0)
        otros      = float(rol_data.get("otros_descuentos") or 0)
        total_desc = round(ap + float(rol_data.get("prestamos_iess") or 0) + prestamos + anticipo + otros, 2)
        neto       = round(total_ing - total_desc, 2)

        execute("""
            UPDATE nom_roles_pago SET
                horas_extras_50=%s, horas_extras_100=%s,
                valor_horas_extras_50=%s, valor_horas_extras_100=%s,
                total_ingresos=%s, aporte_iess_personal=%s, aporte_iess_patronal=%s,
                total_descuentos=%s, neto_a_pagar=%s
            WHERE id=%s
        """, (h50, h100, val50, val100, total_ing, ap, app, total_desc, neto, rol["id"]))
        aplicados += 1

    return {
        "aplicados": aplicados,
        "sin_rol": sin_rol,
        "msg": f"Horas extras aplicadas a {aplicados} roles. {len(sin_rol)} empleados sin rol en BORRADOR."
    }
