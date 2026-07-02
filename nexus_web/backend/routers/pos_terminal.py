"""
Integración de terminales de pago (Pinpad) para Ecuador.
Soporta: Datafast y Medianet (Banco Pichincha).

Arquitectura:
  [Browser] → [FastAPI VPS] ← polling cada 2s → [Agente local PC] → [Pinpad TCP]

El agente local es un script Python que el comercio instala en el PC del cajero.
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from database import query, query_one, execute, insert
from auth import get_current_user
from typing import Optional
from datetime import datetime
from pathlib import Path

router = APIRouter(prefix="/api/pos", tags=["POS Terminal"])

# Ruta al ejecutable del agente (relativa al backend)
AGENTE_EXE = Path(__file__).resolve().parent.parent.parent.parent / "agente_pos" / "AgenteNexusPOS.exe"


@router.get("/agente/descargar")
def descargar_agente(u=Depends(get_current_user)):
    """Descarga el ejecutable del agente para instalar en el PC de la caja."""
    if not AGENTE_EXE.exists():
        raise HTTPException(404, "El archivo del agente no está disponible en el servidor")
    return FileResponse(
        path=str(AGENTE_EXE),
        filename="AgenteNexusPOS.exe",
        media_type="application/octet-stream"
    )


# ══════════════════════════════════════════════════════════════
#  CONFIGURACIÓN DE TERMINALES
# ══════════════════════════════════════════════════════════════

@router.get("/terminales")
def get_terminales(sucursal_id: Optional[int] = None, u=Depends(get_current_user)):
    conds = ["1=1"]
    params = []
    if sucursal_id:
        conds.append("t.sucursal_id=%s"); params.append(sucursal_id)
    return query(f"""
        SELECT t.*, s.nombre as sucursal_nombre, c.nombre as caja_nombre
        FROM pos_terminales t
        LEFT JOIN sys_sucursales s ON s.id = t.sucursal_id
        LEFT JOIN caj_cajas c ON c.id = t.caja_id
        WHERE {' AND '.join(conds)}
        ORDER BY s.nombre, c.nombre, t.nombre
    """, params)

@router.post("/terminales")
def crear_terminal(data: dict, u=Depends(get_current_user)):
    tid = insert("""
        INSERT INTO pos_terminales
            (nombre, procesador, sucursal_id, caja_id, terminal_id, activo)
        VALUES (%s,%s,%s,%s,%s,true)
    """, (data["nombre"], data.get("procesador","DATAFAST"),
          data.get("sucursal_id"), data.get("caja_id") or None,
          data.get("terminal_id","")))
    return {"id": tid, "msg": "Terminal registrado"}

@router.put("/terminales/{tid}")
def actualizar_terminal(tid: int, data: dict, u=Depends(get_current_user)):
    execute("""
        UPDATE pos_terminales SET nombre=%s, procesador=%s,
            sucursal_id=%s, caja_id=%s, terminal_id=%s WHERE id=%s
    """, (data["nombre"], data.get("procesador","DATAFAST"),
          data.get("sucursal_id"), data.get("caja_id") or None,
          data.get("terminal_id",""), tid))
    return {"msg": "Terminal actualizado"}

@router.patch("/terminales/{tid}/toggle")
def toggle_terminal(tid: int, u=Depends(get_current_user)):
    t = query_one("SELECT activo FROM pos_terminales WHERE id=%s", (tid,))
    if not t: raise HTTPException(404)
    execute("UPDATE pos_terminales SET activo=%s WHERE id=%s", (not t["activo"], tid))
    return {"activo": not t["activo"]}


# ══════════════════════════════════════════════════════════════
#  TRANSACCIONES DE PAGO
# ══════════════════════════════════════════════════════════════

@router.post("/cobro")
def iniciar_cobro(data: dict, u=Depends(get_current_user)):
    """
    El cajero inicia un cobro con tarjeta desde el sistema.
    Crea una transacción PENDIENTE que el agente local va a procesar.
    """
    terminal_id = data.get("terminal_id")
    if not terminal_id:
        raise HTTPException(400, "Selecciona un terminal")

    terminal = query_one("SELECT * FROM pos_terminales WHERE id=%s AND activo=true", (terminal_id,))
    if not terminal:
        raise HTTPException(404, "Terminal no encontrado o inactivo")

    # Cancelar cualquier transacción pendiente anterior en ese terminal
    execute("""
        UPDATE pos_transacciones SET estado='CANCELADA'
        WHERE terminal_id=%s AND estado='PENDIENTE'
    """, (terminal_id,))

    tid = insert("""
        INSERT INTO pos_transacciones
            (terminal_id, procesador, monto, diferido_tipo, diferido_cuotas,
             factura_ref, usuario_id, estado)
        VALUES (%s,%s,%s,%s,%s,%s,%s,'PENDIENTE')
    """, (terminal_id, terminal["procesador"],
          float(data.get("monto", 0)),
          data.get("diferido_tipo") or None,
          int(data.get("diferido_cuotas", 0)),
          data.get("factura_ref") or None,
          u.get("id")))

    return {"id": tid, "msg": "Cobro enviado al terminal. Espere que el cliente pague."}


@router.get("/cobro/{tid}/estado")
def estado_cobro(tid: int, u=Depends(get_current_user)):
    """El browser hace polling aquí para saber si el pago fue aprobado."""
    t = query_one("SELECT * FROM pos_transacciones WHERE id=%s", (tid,))
    if not t: raise HTTPException(404)
    return t


@router.post("/cobro/{tid}/cancelar")
def cancelar_cobro(tid: int, u=Depends(get_current_user)):
    execute("UPDATE pos_transacciones SET estado='CANCELADA' WHERE id=%s AND estado='PENDIENTE'", (tid,))
    return {"msg": "Cobro cancelado"}


# ══════════════════════════════════════════════════════════════
#  ENDPOINTS PARA EL AGENTE LOCAL
# ══════════════════════════════════════════════════════════════

@router.get("/agente/pendientes")
def get_pendientes(terminal_id: int, u=Depends(get_current_user)):
    """
    El agente local llama a este endpoint cada 2 segundos.
    Si hay una transacción pendiente, la devuelve para procesarla.
    """
    pendiente = query_one("""
        SELECT t.*, tr.procesador, tr.nombre as terminal_nombre
        FROM pos_transacciones t
        JOIN pos_terminales tr ON tr.id = t.terminal_id
        WHERE t.terminal_id=%s AND t.estado='PENDIENTE'
        ORDER BY t.created_at ASC
        LIMIT 1
    """, (terminal_id,))

    if pendiente:
        # Marcar como PROCESANDO para que el agente la tome una sola vez
        execute("UPDATE pos_transacciones SET estado='PROCESANDO', updated_at=NOW() WHERE id=%s",
                (pendiente["id"],))
        pendiente["estado"] = "PROCESANDO"

    return pendiente or {}


@router.post("/agente/respuesta")
def respuesta_agente(data: dict, u=Depends(get_current_user)):
    """
    El agente local reporta el resultado del pinpad.
    El browser que está haciendo polling recibirá el resultado.
    """
    tid = data.get("transaccion_id")
    if not tid:
        raise HTTPException(400, "transaccion_id requerido")

    aprobado = data.get("aprobado", False)
    estado   = "APROBADO" if aprobado else "RECHAZADO"

    execute("""
        UPDATE pos_transacciones SET
            estado=%s,
            codigo_autorizacion=%s,
            codigo_respuesta=%s,
            mensaje_respuesta=%s,
            tarjeta_ultimos4=%s,
            tarjeta_tipo=%s,
            lote=%s,
            updated_at=NOW()
        WHERE id=%s
    """, (estado,
          data.get("codigo_autorizacion", ""),
          data.get("codigo_respuesta", ""),
          data.get("mensaje_respuesta", ""),
          data.get("tarjeta_ultimos4", ""),
          data.get("tarjeta_tipo", ""),
          data.get("lote", ""),
          tid))

    return {"msg": f"Transacción {estado}"}


@router.post("/agente/heartbeat")
def heartbeat_agente(data: dict, u=Depends(get_current_user)):
    """El agente reporta que está activo."""
    terminal_id = data.get("terminal_id")
    if terminal_id:
        execute("UPDATE pos_terminales SET ultimo_heartbeat=NOW(), agente_activo=true WHERE id=%s",
                (terminal_id,))
    return {"ok": True}


# ══════════════════════════════════════════════════════════════
#  HISTORIAL DE TRANSACCIONES
# ══════════════════════════════════════════════════════════════

@router.get("/historial")
def get_historial(
    desde: Optional[str] = None,
    hasta: Optional[str] = None,
    terminal_id: Optional[int] = None,
    estado: Optional[str] = None,
    u=Depends(get_current_user)
):
    conds = ["1=1"]
    params = []
    if desde:   conds.append("t.created_at::date>=%s"); params.append(desde)
    if hasta:   conds.append("t.created_at::date<=%s"); params.append(hasta)
    if terminal_id: conds.append("t.terminal_id=%s"); params.append(terminal_id)
    if estado:  conds.append("t.estado=%s"); params.append(estado)

    return query(f"""
        SELECT t.*, tr.nombre as terminal_nombre, tr.procesador,
               u.nombre as cajero_nombre
        FROM pos_transacciones t
        JOIN pos_terminales tr ON tr.id = t.terminal_id
        LEFT JOIN sys_usuarios u ON u.id = t.usuario_id
        WHERE {' AND '.join(conds)}
        ORDER BY t.created_at DESC
        LIMIT 200
    """, params)
