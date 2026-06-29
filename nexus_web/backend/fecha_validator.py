from datetime import date, datetime, timedelta
from fastapi import HTTPException

MAX_DIAS_PASADO = 30
MAX_DIAS_FUTURO = 1

def validar_fecha(fecha_str, campo="fecha", permitir_pasado_dias=MAX_DIAS_PASADO, permitir_futuro_dias=MAX_DIAS_FUTURO):
    if not fecha_str:
        return str(date.today())
    try:
        if isinstance(fecha_str, date):
            f = fecha_str
        else:
            f = datetime.strptime(str(fecha_str)[:10], "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, f"Formato de {campo} invalido. Use YYYY-MM-DD")

    hoy = date.today()
    if f > hoy + timedelta(days=permitir_futuro_dias):
        raise HTTPException(400, f"La {campo} no puede ser mayor a {permitir_futuro_dias} dia(s) en el futuro")
    if f < hoy - timedelta(days=permitir_pasado_dias):
        raise HTTPException(400, f"La {campo} no puede ser mayor a {permitir_pasado_dias} dias en el pasado")
    return str(f)


def fecha_servidor():
    return str(date.today())
