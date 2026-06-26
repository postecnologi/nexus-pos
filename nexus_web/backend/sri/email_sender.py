"""
Envío de comprobantes electrónicos por email.
En Ecuador el SRI obliga a enviar RIDE (PDF) + XML al email del cliente.
"""
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent.parent.parent / ".env")


def get_smtp_config() -> dict:
    """Lee config SMTP: primero de la BD, luego del .env como fallback."""
    try:
        from database import query_one
        row = query_one("SELECT * FROM sys_config_smtp WHERE activo=true LIMIT 1")
        if row and row.get("smtp_host"):
            return {
                "host":       row["smtp_host"],
                "port":       int(row.get("smtp_port") or 587),
                "user":       row.get("smtp_user") or "",
                "password":   row.get("smtp_password") or "",
                "from_name":  row.get("smtp_from_name") or "NEXUS POS",
                "from_email": row.get("smtp_from_email") or row.get("smtp_user") or "",
                "use_tls":    row.get("smtp_use_tls", True),
            }
    except:
        pass

    return {
        "host":       os.getenv("SMTP_HOST", ""),
        "port":       int(os.getenv("SMTP_PORT", "587")),
        "user":       os.getenv("SMTP_USER", ""),
        "password":   os.getenv("SMTP_PASSWORD", ""),
        "from_name":  os.getenv("SMTP_FROM_NAME", "NEXUS POS"),
        "from_email": os.getenv("SMTP_FROM_EMAIL", ""),
        "use_tls":    os.getenv("SMTP_USE_TLS", "true").lower() == "true",
    }


def smtp_configurado() -> bool:
    cfg = get_smtp_config()
    return bool(cfg["host"] and cfg["user"] and cfg["password"])


def enviar_comprobante_email(
    destinatario_email: str,
    destinatario_nombre: str,
    asunto: str,
    cuerpo_html: str,
    pdf_bytes: bytes = None,
    pdf_nombre: str = "comprobante.pdf",
    xml_str: str = None,
    xml_nombre: str = "comprobante.xml",
) -> dict:
    cfg = get_smtp_config()

    if not cfg["host"] or not cfg["user"]:
        return {"enviado": False, "error": "SMTP no configurado. Configure en .env o Configuración > Email."}

    if not destinatario_email:
        return {"enviado": False, "error": "El cliente no tiene email registrado."}

    msg = MIMEMultipart("mixed")
    msg["From"] = f"{cfg['from_name']} <{cfg['from_email'] or cfg['user']}>"
    msg["To"] = destinatario_email
    msg["Subject"] = asunto

    msg.attach(MIMEText(cuerpo_html, "html", "utf-8"))

    if pdf_bytes:
        pdf_part = MIMEApplication(pdf_bytes, _subtype="pdf")
        pdf_part.add_header("Content-Disposition", "attachment", filename=pdf_nombre)
        msg.attach(pdf_part)

    if xml_str:
        xml_bytes = xml_str.encode("utf-8") if isinstance(xml_str, str) else xml_str
        xml_part = MIMEApplication(xml_bytes, _subtype="xml")
        xml_part.add_header("Content-Disposition", "attachment", filename=xml_nombre)
        msg.attach(xml_part)

    try:
        if cfg["use_tls"]:
            server = smtplib.SMTP(cfg["host"], cfg["port"], timeout=15)
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(cfg["host"], cfg["port"], timeout=15)

        server.login(cfg["user"], cfg["password"])
        server.sendmail(
            cfg["from_email"] or cfg["user"],
            [destinatario_email],
            msg.as_string()
        )
        server.quit()
        return {"enviado": True, "email": destinatario_email}

    except smtplib.SMTPAuthenticationError:
        return {"enviado": False, "error": "Error de autenticación SMTP. Verifique usuario y contraseña."}
    except smtplib.SMTPConnectError:
        return {"enviado": False, "error": f"No se pudo conectar a {cfg['host']}:{cfg['port']}"}
    except Exception as e:
        return {"enviado": False, "error": str(e)}


def generar_html_factura(empresa_nombre: str, numero_factura: str,
                          cliente_nombre: str, total: float,
                          fecha: str, clave_acceso: str = "") -> str:
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <div style="background:#1e3a5f;color:white;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
        <h2 style="margin:0;font-size:18px;">{empresa_nombre}</h2>
        <p style="margin:5px 0 0;opacity:.8;font-size:13px;">Comprobante Electrónico</p>
      </div>
      <div style="background:#f8f9fa;padding:24px;border:1px solid #e0e0e0;">
        <p style="font-size:14px;color:#333;">
          Estimado/a <strong>{cliente_nombre}</strong>,
        </p>
        <p style="font-size:14px;color:#333;">
          Adjunto encontrará su comprobante electrónico:
        </p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr style="background:#e8f0fe;">
            <td style="padding:10px 14px;font-size:13px;font-weight:bold;color:#555;">N° Factura</td>
            <td style="padding:10px 14px;font-size:14px;font-weight:bold;color:#1a73e8;">{numero_factura}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;font-size:13px;font-weight:bold;color:#555;border-top:1px solid #e0e0e0;">Fecha</td>
            <td style="padding:10px 14px;font-size:13px;color:#333;border-top:1px solid #e0e0e0;">{fecha}</td>
          </tr>
          <tr style="background:#e8f0fe;">
            <td style="padding:10px 14px;font-size:13px;font-weight:bold;color:#555;">Total</td>
            <td style="padding:10px 14px;font-size:16px;font-weight:bold;color:#1a73e8;">${total:.2f}</td>
          </tr>
          {f'''<tr>
            <td style="padding:10px 14px;font-size:13px;font-weight:bold;color:#555;border-top:1px solid #e0e0e0;">Clave de Acceso</td>
            <td style="padding:10px 14px;font-size:11px;color:#666;border-top:1px solid #e0e0e0;word-break:break-all;">{clave_acceso}</td>
          </tr>''' if clave_acceso else ''}
        </table>
        <p style="font-size:12px;color:#888;">
          Se adjuntan el RIDE (PDF) y el archivo XML del comprobante electrónico.
        </p>
      </div>
      <div style="background:#f0f0f0;padding:14px;text-align:center;border-radius:0 0 8px 8px;border:1px solid #e0e0e0;border-top:none;">
        <p style="margin:0;font-size:11px;color:#999;">
          Este correo fue generado automáticamente por {empresa_nombre}.<br/>
          Documento autorizado por el SRI.
        </p>
      </div>
    </div>
    """
