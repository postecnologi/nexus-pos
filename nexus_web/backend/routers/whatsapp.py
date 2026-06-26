"""
WhatsApp notification system for NEXUS POS.
Uses WhatsApp Cloud API (Meta Business) for sending messages.
Also supports simple wa.me links for manual sending.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from database import query, query_one, execute, insert
from auth import get_current_user
import os
import httpx

router = APIRouter(prefix="/api/whatsapp", tags=["WhatsApp"])

# ── Config ──
WA_API_URL = "https://graph.facebook.com/v18.0"

@router.get("/config")
def get_config(u=Depends(get_current_user)):
    config = query_one("SELECT * FROM sys_whatsapp_config WHERE activo=true")
    if config:
        config.pop("api_token", None)  # Don't expose token
    return config or {}

class WAConfig(BaseModel):
    phone_number_id: str = ""
    api_token: str = ""
    business_name: str = ""
    default_country_code: str = "593"  # Ecuador
    activo: bool = True

@router.post("/config")
def save_config(c: WAConfig, u=Depends(get_current_user)):
    existing = query_one("SELECT id FROM sys_whatsapp_config LIMIT 1")
    if existing:
        execute("""
            UPDATE sys_whatsapp_config
            SET phone_number_id=%s, api_token=%s, business_name=%s,
                default_country_code=%s, activo=%s, updated_at=NOW()
            WHERE id=%s
        """, (c.phone_number_id, c.api_token, c.business_name,
              c.default_country_code, c.activo, existing["id"]))
    else:
        insert("""
            INSERT INTO sys_whatsapp_config
                (phone_number_id, api_token, business_name, default_country_code, activo)
            VALUES (%s,%s,%s,%s,%s)
        """, (c.phone_number_id, c.api_token, c.business_name,
              c.default_country_code, c.activo))
    return {"msg": "Configuracion guardada"}

def format_phone(phone, country_code="593"):
    """Format phone number for WhatsApp API. Ecuador: 593XXXXXXXXX"""
    phone = ''.join(c for c in phone if c.isdigit())
    if phone.startswith('0'):
        phone = country_code + phone[1:]
    elif not phone.startswith(country_code):
        phone = country_code + phone
    return phone

async def send_whatsapp_message(to_phone, message, config=None):
    """Send a WhatsApp text message via Cloud API."""
    if not config:
        config = query_one("SELECT * FROM sys_whatsapp_config WHERE activo=true")
    if not config or not config.get("api_token"):
        return {"ok": False, "error": "WhatsApp no configurado"}

    phone = format_phone(to_phone, config.get("default_country_code", "593"))

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{WA_API_URL}/{config['phone_number_id']}/messages",
                headers={
                    "Authorization": f"Bearer {config['api_token']}",
                    "Content-Type": "application/json",
                },
                json={
                    "messaging_product": "whatsapp",
                    "to": phone,
                    "type": "text",
                    "text": {"body": message}
                },
                timeout=15,
            )
            data = resp.json()
            # Log the message
            insert("""
                INSERT INTO sys_whatsapp_log (telefono, mensaje, tipo, estado, respuesta)
                VALUES (%s,%s,'TEXTO',%s,%s)
            """, (phone, message[:500],
                  'ENVIADO' if resp.status_code == 200 else 'ERROR',
                  str(data)[:500]))

            if resp.status_code == 200:
                return {"ok": True, "message_id": data.get("messages", [{}])[0].get("id")}
            return {"ok": False, "error": str(data)}
        except Exception as e:
            return {"ok": False, "error": str(e)}

# ── Send message endpoint ──
class SendMsg(BaseModel):
    telefono: str
    mensaje: str

@router.post("/enviar")
async def enviar_mensaje(data: SendMsg, u=Depends(get_current_user)):
    result = await send_whatsapp_message(data.telefono, data.mensaje)
    if not result["ok"]:
        raise HTTPException(400, result.get("error", "Error enviando mensaje"))
    return result

# ── Quick link (wa.me) ──
@router.get("/link")
def generar_link(telefono: str, mensaje: str = "", u=Depends(get_current_user)):
    """Generate a wa.me link for manual WhatsApp messaging."""
    config = query_one("SELECT default_country_code FROM sys_whatsapp_config WHERE activo=true")
    cc = config["default_country_code"] if config else "593"
    phone = format_phone(telefono, cc)
    import urllib.parse
    link = f"https://wa.me/{phone}"
    if mensaje:
        link += f"?text={urllib.parse.quote(mensaje)}"
    return {"link": link, "telefono": phone}

# ── Notification templates ──
@router.get("/plantillas")
def listar_plantillas(u=Depends(get_current_user)):
    return query("SELECT * FROM sys_whatsapp_plantillas WHERE activa=true ORDER BY nombre")

class Plantilla(BaseModel):
    nombre: str
    tipo: str  # FACTURA, COBRO, CITA, BIENVENIDA, CUSTOM
    contenido: str
    activa: bool = True

@router.post("/plantillas")
def crear_plantilla(p: Plantilla, u=Depends(get_current_user)):
    pid = insert("""
        INSERT INTO sys_whatsapp_plantillas (nombre, tipo, contenido, activa)
        VALUES (%s,%s,%s,%s)
    """, (p.nombre, p.tipo, p.contenido, p.activa))
    return {"id": pid, "msg": "Plantilla creada"}

@router.put("/plantillas/{pid}")
def editar_plantilla(pid: int, p: Plantilla, u=Depends(get_current_user)):
    execute("""
        UPDATE sys_whatsapp_plantillas SET nombre=%s, tipo=%s, contenido=%s, activa=%s
        WHERE id=%s
    """, (p.nombre, p.tipo, p.contenido, p.activa, pid))
    return {"msg": "Plantilla actualizada"}

# ── Send from template ──
class SendTemplate(BaseModel):
    plantilla_id: int
    telefono: str
    variables: dict = {}  # {cliente_nombre, total, numero_factura, etc}

@router.post("/enviar-plantilla")
async def enviar_desde_plantilla(data: SendTemplate, u=Depends(get_current_user)):
    plantilla = query_one("SELECT * FROM sys_whatsapp_plantillas WHERE id=%s", (data.plantilla_id,))
    if not plantilla:
        raise HTTPException(404, "Plantilla no encontrada")

    mensaje = plantilla["contenido"]
    for key, val in data.variables.items():
        mensaje = mensaje.replace(f"{{{key}}}", str(val))

    result = await send_whatsapp_message(data.telefono, mensaje)
    if not result["ok"]:
        raise HTTPException(400, result.get("error", "Error enviando"))
    return result

# ── Quick sends for common scenarios ──
@router.post("/notificar-factura/{factura_id}")
async def notificar_factura(factura_id: int, u=Depends(get_current_user)):
    """Send invoice notification to client via WhatsApp."""
    fac = query_one("""
        SELECT f.numero_factura, f.total, c.razon_social, c.telefono
        FROM ven_facturas f JOIN ven_clientes c ON c.id=f.cliente_id
        WHERE f.id=%s
    """, (factura_id,))
    if not fac: raise HTTPException(404, "Factura no encontrada")
    if not fac.get("telefono"): raise HTTPException(400, "Cliente sin telefono")

    config = query_one("SELECT business_name FROM sys_whatsapp_config WHERE activo=true")
    empresa = config["business_name"] if config else "NEXUS POS"

    msg = (f"Hola {fac['razon_social']},\n\n"
           f"Se ha emitido su factura *{fac['numero_factura']}* "
           f"por un total de *${fac['total']}*.\n\n"
           f"Gracias por su compra.\n{empresa}")

    result = await send_whatsapp_message(fac["telefono"], msg)
    return result

@router.post("/notificar-cobro/{cxc_id}")
async def notificar_cobro(cxc_id: int, u=Depends(get_current_user)):
    """Send payment reminder to client."""
    cxc = query_one("""
        SELECT c.valor_total, c.saldo, c.fecha_vencimiento,
               cl.razon_social, cl.telefono
        FROM fin_cxc c JOIN ven_clientes cl ON cl.id=c.cliente_id
        WHERE c.id=%s
    """, (cxc_id,))
    if not cxc: raise HTTPException(404, "CXC no encontrada")
    if not cxc.get("telefono"): raise HTTPException(400, "Cliente sin telefono")

    msg = (f"Hola {cxc['razon_social']},\n\n"
           f"Le recordamos que tiene un saldo pendiente de *${cxc['saldo']}* "
           f"con vencimiento {cxc['fecha_vencimiento']}.\n\n"
           f"Agradecemos su pronto pago.")

    result = await send_whatsapp_message(cxc["telefono"], msg)
    return result

# ── Message log ──
@router.get("/log")
def ver_log(u=Depends(get_current_user)):
    return query("""
        SELECT * FROM sys_whatsapp_log ORDER BY created_at DESC LIMIT 100
    """)
