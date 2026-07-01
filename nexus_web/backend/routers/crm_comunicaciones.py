"""
CRM Comunicaciones — Email por vendedor (SMTP corporativo).
"""
from fastapi import APIRouter, Depends, HTTPException
from database import query, query_one, execute, insert
from auth import get_current_user
from typing import Optional
import smtplib, ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

router = APIRouter(prefix="/api/crm-com", tags=["CRM Comunicaciones"])


# ── Helpers ──────────────────────────────────────────────────────

def _get_config_vendedor(vendedor_id: int):
    return query_one("SELECT * FROM crm_config_vendedor WHERE vendedor_id=%s", (vendedor_id,))

def _get_vendedor_by_user(user_id: int):
    return query_one("""
        SELECT v.id, v.nombre, v.apellidos, v.email, v.codigo
        FROM ven_vendedores v
        JOIN nom_empleados e ON e.vendedor_id = v.id
        WHERE e.usuario_id = %s AND v.activo = true
        LIMIT 1
    """, (user_id,))


# ══════════════════════════════════════════════════════════════════
#  CONFIGURACION POR VENDEDOR
# ══════════════════════════════════════════════════════════════════

@router.get("/config/{vendedor_id}")
def get_config(vendedor_id: int, u=Depends(get_current_user)):
    cfg = _get_config_vendedor(vendedor_id)
    if not cfg:
        return {"vendedor_id": vendedor_id, "smtp_host": "", "smtp_port": 587,
                "smtp_user": "", "smtp_tls": True, "smtp_from_nombre": ""}
    safe = {k: v for k, v in cfg.items() if k not in ('smtp_password', 'evolution_key', 'evolution_url',
                                                        'wa_instancia', 'wa_telefono', 'wa_conectado')}
    safe["smtp_password"] = "●●●●●●●●" if cfg.get("smtp_password") else ""
    safe["smtp_configurado"] = bool(cfg.get("smtp_host") and cfg.get("smtp_user"))
    return safe


@router.put("/config/{vendedor_id}")
def save_config(vendedor_id: int, data: dict, u=Depends(get_current_user)):
    campos_permitidos = {"smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_tls", "smtp_from_nombre"}
    filtered = {}
    for k, v in data.items():
        if k not in campos_permitidos:
            continue
        if k == 'smtp_password' and v and set(v) <= {'●', '•', '*'}:
            continue  # Es placeholder, no actualizar
        filtered[k] = v
    if not filtered:
        raise HTTPException(400, "No hay campos validos")

    existe = query_one("SELECT id FROM crm_config_vendedor WHERE vendedor_id=%s", (vendedor_id,))
    if existe:
        sets = ", ".join(f"{k}=%s" for k in filtered)
        execute(f"UPDATE crm_config_vendedor SET {sets}, updated_at=NOW() WHERE vendedor_id=%s",
                list(filtered.values()) + [vendedor_id])
    else:
        filtered["vendedor_id"] = vendedor_id
        cols = ", ".join(filtered.keys())
        vals = ", ".join(["%s"] * len(filtered))
        insert(f"INSERT INTO crm_config_vendedor ({cols}) VALUES ({vals})", list(filtered.values()))

    return {"msg": "Configuracion guardada"}


@router.post("/config/{vendedor_id}/test-smtp")
def test_smtp(vendedor_id: int, u=Depends(get_current_user)):
    cfg = _get_config_vendedor(vendedor_id)
    if not cfg or not cfg.get("smtp_host"):
        raise HTTPException(400, "No hay configuracion SMTP para este vendedor")
    try:
        ctx = ssl.create_default_context()
        if cfg.get("smtp_tls"):
            server = smtplib.SMTP(cfg["smtp_host"], cfg.get("smtp_port", 587), timeout=10)
            server.starttls(context=ctx)
        else:
            server = smtplib.SMTP_SSL(cfg["smtp_host"], cfg.get("smtp_port", 465), context=ctx, timeout=10)
        server.login(cfg["smtp_user"], cfg["smtp_password"])
        server.quit()
        return {"ok": True, "msg": "Conexion SMTP exitosa"}
    except Exception as e:
        raise HTTPException(400, f"Error SMTP: {str(e)}")


# ══════════════════════════════════════════════════════════════════
#  EMAIL
# ══════════════════════════════════════════════════════════════════

@router.post("/email/enviar")
def enviar_email(data: dict, u=Depends(get_current_user)):
    vendedor_id = data.get("vendedor_id")
    destinatario = data.get("destinatario", "").strip()
    asunto = data.get("asunto", "").strip()
    contenido = data.get("contenido", "").strip()
    cliente_id = data.get("cliente_id")

    if not destinatario or not asunto or not contenido:
        raise HTTPException(400, "Destinatario, asunto y contenido son obligatorios")

    cfg = _get_config_vendedor(vendedor_id) if vendedor_id else None

    # Usar SMTP del vendedor si tiene config, sino SMTP global
    if cfg and cfg.get("smtp_host") and cfg.get("smtp_user") and cfg.get("smtp_password"):
        smtp_host = cfg["smtp_host"]
        smtp_port = cfg.get("smtp_port", 587)
        smtp_user = cfg["smtp_user"]
        smtp_pass = cfg["smtp_password"]
        smtp_tls = cfg.get("smtp_tls", True)
        from_name = cfg.get("smtp_from_nombre") or smtp_user
        from_addr = smtp_user
    else:
        # Fallback a config global
        gcfg = query_one("SELECT * FROM sys_config_smtp LIMIT 1")
        if not gcfg:
            raise HTTPException(400, "No hay configuracion SMTP. Configure el SMTP del vendedor o el SMTP global.")
        smtp_host = gcfg.get("host", "")
        smtp_port = gcfg.get("port", 587)
        smtp_user = gcfg.get("username", "")
        smtp_pass = gcfg.get("password", "")
        smtp_tls = gcfg.get("use_tls", True)
        from_name = gcfg.get("from_name", smtp_user)
        from_addr = gcfg.get("from_email", smtp_user)

    # Construir email
    msg = MIMEMultipart("alternative")
    msg["Subject"] = asunto
    msg["From"] = f"{from_name} <{from_addr}>"
    msg["To"] = destinatario

    html_body = contenido.replace("\n", "<br>") if "<" not in contenido else contenido
    msg.attach(MIMEText(contenido, "plain"))
    msg.attach(MIMEText(f"<html><body>{html_body}</body></html>", "html"))

    try:
        ctx = ssl.create_default_context()
        if smtp_tls:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=15)
            server.starttls(context=ctx)
        else:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port, context=ctx, timeout=15)
        server.login(smtp_user, smtp_pass)
        server.sendmail(from_addr, [destinatario], msg.as_string())
        server.quit()
        estado = "ENVIADO"
        error_msg = None
    except Exception as e:
        estado = "ERROR"
        error_msg = str(e)[:300]
        raise HTTPException(500, f"Error al enviar email: {error_msg}")
    finally:
        insert("""
            INSERT INTO crm_comunicaciones
                (cliente_id, vendedor_id, tipo, direccion, asunto, contenido, estado, error_msg)
            VALUES (%s,%s,'EMAIL',%s,%s,%s,%s,%s)
        """, (cliente_id, vendedor_id, destinatario, asunto, contenido[:2000], estado, error_msg))

    return {"ok": True, "msg": f"Email enviado a {destinatario}"}



# ══════════════════════════════════════════════════════════════════
#  HISTORIAL DE COMUNICACIONES
# ══════════════════════════════════════════════════════════════════

@router.get("/historial")
def get_historial(
    cliente_id: Optional[int] = None,
    vendedor_id: Optional[int] = None,
    tipo: Optional[str] = None,
    u=Depends(get_current_user)
):
    conds = ["1=1"]
    params = []
    if cliente_id:
        conds.append("c.cliente_id=%s"); params.append(cliente_id)
    if vendedor_id:
        conds.append("c.vendedor_id=%s"); params.append(vendedor_id)
    if tipo:
        conds.append("c.tipo=%s"); params.append(tipo)
    where = "WHERE " + " AND ".join(conds)
    return query(f"""
        SELECT c.*, v.nombre as vendedor_nombre, cl.nombre as cliente_nombre
        FROM crm_comunicaciones c
        LEFT JOIN ven_vendedores v ON v.id = c.vendedor_id
        LEFT JOIN ven_clientes cl ON cl.id = c.cliente_id
        {where}
        ORDER BY c.created_at DESC
        LIMIT 100
    """, params)
