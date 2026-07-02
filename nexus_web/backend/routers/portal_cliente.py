"""
Portal del Cliente — acceso externo para clientes ver sus documentos.
Genera links seguros con token temporal (sin login).
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from database import query, query_one, execute, insert
from auth import get_current_user
from typing import Optional
from datetime import datetime, timedelta
import secrets, hashlib

router = APIRouter(prefix="/api/portal-cliente", tags=["Portal Cliente"])


def _generar_token(cliente_id: int) -> str:
    raw = f"{cliente_id}-{secrets.token_hex(16)}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


# ══════════════════════════════════════════════════════════════
#  ADMIN — Gestionar acceso de clientes
# ══════════════════════════════════════════════════════════════

@router.get("/accesos")
def get_accesos(u=Depends(get_current_user)):
    return query("""
        SELECT a.*, cl.razon_social, cl.email, cl.identificacion
        FROM portal_clientes_acceso a
        JOIN ven_clientes cl ON cl.id = a.cliente_id
        ORDER BY cl.razon_social
    """)


@router.post("/crear-acceso/{cliente_id}")
def crear_acceso(cliente_id: int, u=Depends(get_current_user)):
    cliente = query_one("SELECT * FROM ven_clientes WHERE id=%s", (cliente_id,))
    if not cliente:
        raise HTTPException(404, "Cliente no encontrado")

    token = _generar_token(cliente_id)
    existe = query_one("SELECT id FROM portal_clientes_acceso WHERE cliente_id=%s", (cliente_id,))
    if existe:
        execute("UPDATE portal_clientes_acceso SET token=%s, activo=true, updated_at=NOW() WHERE cliente_id=%s",
                (token, cliente_id))
    else:
        insert("""INSERT INTO portal_clientes_acceso (cliente_id, token, activo)
            VALUES (%s,%s,true)""", (cliente_id, token))

    return {"token": token, "cliente": cliente["razon_social"],
            "url": f"/portal-cliente/{token}"}


@router.patch("/accesos/{cliente_id}/toggle")
def toggle_acceso(cliente_id: int, u=Depends(get_current_user)):
    a = query_one("SELECT activo FROM portal_clientes_acceso WHERE cliente_id=%s", (cliente_id,))
    if not a: raise HTTPException(404)
    execute("UPDATE portal_clientes_acceso SET activo=%s WHERE cliente_id=%s",
            (not a["activo"], cliente_id))
    return {"activo": not a["activo"]}


# ══════════════════════════════════════════════════════════════
#  PORTAL PÚBLICO — acceso por token
# ══════════════════════════════════════════════════════════════

def _get_cliente_by_token(token: str):
    acceso = query_one("""
        SELECT a.*, cl.razon_social, cl.email, cl.identificacion,
               cl.telefono, cl.direccion
        FROM portal_clientes_acceso a
        JOIN ven_clientes cl ON cl.id = a.cliente_id
        WHERE a.token = %s AND a.activo = true
    """, (token,))
    if not acceso:
        raise HTTPException(404, "Acceso no válido o desactivado")
    return acceso


@router.get("/datos/{token}")
def portal_datos(token: str):
    """Retorna los datos del portal del cliente (sin autenticación — token en URL)."""
    acceso = _get_cliente_by_token(token)
    cliente_id = acceso["cliente_id"]
    empresa = query_one("SELECT razon_social, telefono, email FROM sys_empresas WHERE activa=true LIMIT 1") or {}

    # Facturas
    facturas = query("""
        SELECT id, numero_factura, fecha_emision, subtotal_0, subtotal_iva,
               iva, total, estado, forma_pago
        FROM ven_facturas
        WHERE cliente_id = %s AND estado NOT IN ('BORRADOR','HISTORICO')
        ORDER BY fecha_emision DESC
        LIMIT 50
    """, (cliente_id,))

    # Cuenta corriente (CxC)
    cxc = query("""
        SELECT id, fecha_emision, fecha_vencimiento,
               valor_total, valor_pagado, saldo, estado
        FROM fin_cxc
        WHERE cliente_id = %s
        ORDER BY fecha_vencimiento DESC
        LIMIT 20
    """, (cliente_id,))

    # Resumen
    resumen = query_one("""
        SELECT
            COALESCE(SUM(total),0) as total_compras,
            COUNT(*) as num_facturas,
            COUNT(*) FILTER (WHERE estado='EMITIDA' AND fecha_emision >= CURRENT_DATE - INTERVAL '30 days') as facturas_mes
        FROM ven_facturas
        WHERE cliente_id = %s AND estado NOT IN ('BORRADOR','HISTORICO','ANULADA')
    """, (cliente_id,)) or {}

    saldo_pendiente = query_one("""
        SELECT COALESCE(SUM(saldo),0) as total
        FROM fin_cxc
        WHERE cliente_id = %s AND estado = 'PENDIENTE' AND saldo > 0
    """, (cliente_id,)) or {"total": 0}

    return {
        "empresa": dict(empresa),
        "cliente": {
            "razon_social": acceso["razon_social"],
            "identificacion": acceso["identificacion"],
            "email": acceso["email"],
            "telefono": acceso["telefono"],
        },
        "resumen": {
            "total_compras":    float(resumen.get("total_compras", 0)),
            "num_facturas":     int(resumen.get("num_facturas", 0)),
            "facturas_mes":     int(resumen.get("facturas_mes", 0)),
            "saldo_pendiente":  float(saldo_pendiente["total"]),
        },
        "facturas": [dict(f) for f in facturas],
        "cxc":      [dict(c) for c in cxc],
    }
