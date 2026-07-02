"""
Módulo de Alertas Automáticas
Revisa condiciones del negocio y notifica por email.
Tipos: stock_bajo, factura_vencer, cobro_vencido, cumpleanos_cliente
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from database import query, query_one, execute, insert
from auth import get_current_user
from typing import Optional
from datetime import date, datetime, timedelta
import smtplib, ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

router = APIRouter(prefix="/api/alertas", tags=["Alertas"])


# ══════════════════════════════════════════════════════════════
#  CONFIGURACIÓN DE ALERTAS
# ══════════════════════════════════════════════════════════════

@router.get("/config")
def get_config(u=Depends(get_current_user)):
    cfg = query_one("SELECT * FROM sys_alertas_config LIMIT 1")
    if not cfg:
        return {
            "email_destino": "", "email_activo": False,
            "alerta_stock_bajo": True, "stock_dias_revision": 1,
            "alerta_facturas_vencer": True, "facturas_dias_aviso": 3,
            "alerta_cobros_vencidos": True, "cobros_dias_gracia": 1,
            "alerta_cumpleanos": True, "hora_envio": "07:00",
        }
    return cfg


@router.put("/config")
def save_config(data: dict, u=Depends(get_current_user)):
    existe = query_one("SELECT id FROM sys_alertas_config LIMIT 1")
    if existe:
        campos = ["email_destino","email_activo","alerta_stock_bajo","stock_dias_revision",
                  "alerta_facturas_vencer","facturas_dias_aviso","alerta_cobros_vencidos",
                  "cobros_dias_gracia","alerta_cumpleanos","hora_envio"]
        sets = ",".join(f"{c}=%s" for c in campos if c in data)
        vals = [data[c] for c in campos if c in data]
        if sets:
            execute(f"UPDATE sys_alertas_config SET {sets} WHERE id=%s", vals + [existe["id"]])
    else:
        insert("""INSERT INTO sys_alertas_config
            (email_destino,email_activo,alerta_stock_bajo,stock_dias_revision,
             alerta_facturas_vencer,facturas_dias_aviso,alerta_cobros_vencidos,
             cobros_dias_gracia,alerta_cumpleanos,hora_envio)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (data.get("email_destino",""), data.get("email_activo",False),
             data.get("alerta_stock_bajo",True), data.get("stock_dias_revision",1),
             data.get("alerta_facturas_vencer",True), data.get("facturas_dias_aviso",3),
             data.get("alerta_cobros_vencidos",True), data.get("cobros_dias_gracia",1),
             data.get("alerta_cumpleanos",True), data.get("hora_envio","07:00")))
    return {"msg": "Configuración guardada"}


# ══════════════════════════════════════════════════════════════
#  HISTORIAL DE ALERTAS
# ══════════════════════════════════════════════════════════════

@router.get("/historial")
def get_historial(limite: int = 50, u=Depends(get_current_user)):
    return query("""
        SELECT * FROM sys_alertas_log
        ORDER BY created_at DESC LIMIT %s
    """, (limite,))


# ══════════════════════════════════════════════════════════════
#  VERIFICAR ALERTAS (se llama manualmente o por scheduler)
# ══════════════════════════════════════════════════════════════

@router.post("/verificar")
def verificar_alertas(bg: BackgroundTasks, u=Depends(get_current_user)):
    """Dispara la verificación de alertas en background."""
    bg.add_task(_verificar_y_notificar)
    return {"msg": "Verificando alertas en segundo plano..."}


@router.get("/preview")
def preview_alertas(u=Depends(get_current_user)):
    """Previsualiza qué alertas se enviarían ahora sin enviar emails."""
    return _recopilar_alertas()


def _recopilar_alertas() -> dict:
    cfg = query_one("SELECT * FROM sys_alertas_config LIMIT 1") or {}
    alertas = {"stock_bajo": [], "facturas_vencer": [], "cobros_vencidos": [], "cumpleanos": []}
    hoy = date.today()

    # ── Stock bajo ─────────────────────────────────────────────
    if cfg.get("alerta_stock_bajo", True):
        productos = query("""
            SELECT p.codigo, p.descripcion as nombre,
                   COALESCE(SUM(s.cantidad),0) as stock_actual,
                   p.stock_minimo
            FROM inv_productos p
            LEFT JOIN inv_stock s ON s.producto_id = p.id
            WHERE p.activo = true AND p.stock_minimo > 0
            GROUP BY p.id, p.codigo, p.descripcion, p.stock_minimo
            HAVING COALESCE(SUM(s.cantidad),0) <= p.stock_minimo
            ORDER BY p.descripcion
        """)
        alertas["stock_bajo"] = [dict(p) for p in productos]

    # ── Facturas por vencer ────────────────────────────────────
    if cfg.get("alerta_facturas_vencer", True):
        dias = int(cfg.get("facturas_dias_aviso", 3))
        limite = hoy + timedelta(days=dias)
        facturas = query("""
            SELECT c.id, c.saldo, c.fecha_vencimiento,
                   cl.razon_social as cliente, cl.email as cliente_email,
                   cl.telefono as cliente_telefono
            FROM fin_cxc c
            JOIN ven_clientes cl ON cl.id = c.cliente_id
            WHERE c.estado = 'PENDIENTE'
              AND c.saldo > 0
              AND c.fecha_vencimiento BETWEEN %s AND %s
            ORDER BY c.fecha_vencimiento
        """, (hoy, limite))
        alertas["facturas_vencer"] = [dict(f) for f in facturas]

    # ── Cobros vencidos ────────────────────────────────────────
    if cfg.get("alerta_cobros_vencidos", True):
        gracia = int(cfg.get("cobros_dias_gracia", 1))
        limite_venc = hoy - timedelta(days=gracia)
        cobros = query("""
            SELECT c.id, c.saldo, c.fecha_vencimiento,
                   cl.razon_social as cliente, cl.email as cliente_email,
                   cl.telefono as cliente_telefono,
                   (CURRENT_DATE - c.fecha_vencimiento) as dias_vencido
            FROM fin_cxc c
            JOIN ven_clientes cl ON cl.id = c.cliente_id
            WHERE c.estado = 'PENDIENTE'
              AND c.saldo > 0
              AND c.fecha_vencimiento < %s
            ORDER BY c.fecha_vencimiento
        """, (limite_venc,))
        alertas["cobros_vencidos"] = [dict(c) for c in cobros]

    # ── Cumpleaños clientes ────────────────────────────────────
    if cfg.get("alerta_cumpleanos", True):
        manana = hoy + timedelta(days=1)
        cumples = query("""
            SELECT id, razon_social as nombre, email, telefono, fecha_nacimiento
            FROM ven_clientes
            WHERE activo = true
              AND fecha_nacimiento IS NOT NULL
              AND EXTRACT(MONTH FROM fecha_nacimiento) = %s
              AND EXTRACT(DAY FROM fecha_nacimiento) IN (%s, %s)
        """, (hoy.month, hoy.day, manana.day))
        alertas["cumpleanos"] = [dict(c) for c in cumples]

    return alertas


def _enviar_email_alerta(cfg: dict, asunto: str, html: str):
    smtp_cfg = query_one("SELECT * FROM sys_config_smtp LIMIT 1")
    if not smtp_cfg or not smtp_cfg.get("host"):
        return False
    destino = cfg.get("email_destino", "")
    if not destino:
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = asunto
        msg["From"] = f"NEXUS POS <{smtp_cfg['from_email'] or smtp_cfg['username']}>"
        msg["To"] = destino
        msg.attach(MIMEText(html, "html"))
        ctx = ssl.create_default_context()
        if smtp_cfg.get("use_tls", True):
            srv = smtplib.SMTP(smtp_cfg["host"], smtp_cfg.get("port", 587), timeout=15)
            srv.starttls(context=ctx)
        else:
            srv = smtplib.SMTP_SSL(smtp_cfg["host"], smtp_cfg.get("port", 465), context=ctx, timeout=15)
        srv.login(smtp_cfg["username"], smtp_cfg["password"])
        srv.sendmail(smtp_cfg["username"], [destino], msg.as_string())
        srv.quit()
        return True
    except Exception as e:
        print(f"Error email alerta: {e}")
        return False


def _verificar_y_notificar():
    cfg = query_one("SELECT * FROM sys_alertas_config LIMIT 1") or {}
    if not cfg.get("email_activo"):
        return

    alertas = _recopilar_alertas()
    hoy = date.today()

    total = (len(alertas["stock_bajo"]) + len(alertas["facturas_vencer"]) +
             len(alertas["cobros_vencidos"]) + len(alertas["cumpleanos"]))

    if total == 0:
        return

    # Construir email HTML
    secciones = ""

    if alertas["stock_bajo"]:
        filas = "".join(f"""
            <tr>
                <td style="padding:8px;border-bottom:1px solid #e2e8f0">{p['codigo']}</td>
                <td style="padding:8px;border-bottom:1px solid #e2e8f0">{p['nombre']}</td>
                <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:center;color:#EF4444;font-weight:700">{float(p['stock_actual']):.0f}</td>
                <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:center">{float(p['stock_minimo']):.0f}</td>
            </tr>""" for p in alertas["stock_bajo"])
        secciones += f"""
        <div style="margin-bottom:24px">
            <h3 style="color:#EF4444;margin:0 0 12px">⚠️ Stock bajo — {len(alertas['stock_bajo'])} producto(s)</h3>
            <table style="width:100%;border-collapse:collapse;font-size:13px">
                <thead><tr style="background:#FEE2E2">
                    <th style="padding:8px;text-align:left">Código</th>
                    <th style="padding:8px;text-align:left">Producto</th>
                    <th style="padding:8px;text-align:center">Stock actual</th>
                    <th style="padding:8px;text-align:center">Mínimo</th>
                </tr></thead>
                <tbody>{filas}</tbody>
            </table>
        </div>"""

    if alertas["cobros_vencidos"]:
        total_venc = sum(float(c["saldo"]) for c in alertas["cobros_vencidos"])
        filas = "".join(f"""
            <tr>
                <td style="padding:8px;border-bottom:1px solid #e2e8f0">{c['cliente']}</td>
                <td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#EF4444;font-weight:700">${float(c['saldo']):.2f}</td>
                <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:center">{str(c['fecha_vencimiento'])[:10]}</td>
                <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:center;color:#EF4444">{c.get('dias_vencido',0)} días</td>
            </tr>""" for c in alertas["cobros_vencidos"])
        secciones += f"""
        <div style="margin-bottom:24px">
            <h3 style="color:#EF4444;margin:0 0 12px">🔴 Cobros VENCIDOS — ${total_venc:.2f} en riesgo</h3>
            <table style="width:100%;border-collapse:collapse;font-size:13px">
                <thead><tr style="background:#FEE2E2">
                    <th style="padding:8px;text-align:left">Cliente</th>
                    <th style="padding:8px;text-align:left">Saldo</th>
                    <th style="padding:8px;text-align:center">Venció</th>
                    <th style="padding:8px;text-align:center">Días vencido</th>
                </tr></thead>
                <tbody>{filas}</tbody>
            </table>
        </div>"""

    if alertas["facturas_vencer"]:
        filas = "".join(f"""
            <tr>
                <td style="padding:8px;border-bottom:1px solid #e2e8f0">{f['cliente']}</td>
                <td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#F59E0B;font-weight:700">${float(f['saldo']):.2f}</td>
                <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:center">{str(f['fecha_vencimiento'])[:10]}</td>
            </tr>""" for f in alertas["facturas_vencer"])
        secciones += f"""
        <div style="margin-bottom:24px">
            <h3 style="color:#F59E0B;margin:0 0 12px">🟡 Facturas por vencer — {len(alertas['facturas_vencer'])} cuenta(s)</h3>
            <table style="width:100%;border-collapse:collapse;font-size:13px">
                <thead><tr style="background:#FEF3C7">
                    <th style="padding:8px;text-align:left">Cliente</th>
                    <th style="padding:8px;text-align:left">Saldo</th>
                    <th style="padding:8px;text-align:center">Vence</th>
                </tr></thead>
                <tbody>{filas}</tbody>
            </table>
        </div>"""

    if alertas["cumpleanos"]:
        lista = "".join(f"<li style='padding:4px 0'><strong>{c['nombre']}</strong> — {c.get('telefono','')}</li>"
                        for c in alertas["cumpleanos"])
        secciones += f"""
        <div style="margin-bottom:24px">
            <h3 style="color:#10B981;margin:0 0 12px">🎂 Cumpleaños hoy/mañana</h3>
            <ul style="margin:0;padding-left:20px;font-size:13px">{lista}</ul>
        </div>"""

    html = f"""
    <div style="font-family:'Segoe UI',sans-serif;max-width:680px;margin:0 auto;background:#f8fafc;padding:20px">
        <div style="background:#0F172A;color:white;padding:20px 24px;border-radius:10px 10px 0 0">
            <h2 style="margin:0;font-size:18px">📊 Alertas del día — {hoy.strftime('%d/%m/%Y')}</h2>
            <p style="margin:4px 0 0;color:#94A3B8;font-size:13px">NEXUS POS — Resumen automático</p>
        </div>
        <div style="background:white;padding:24px;border-radius:0 0 10px 10px;border:1px solid #e2e8f0">
            {secciones}
            <p style="color:#94A3B8;font-size:11px;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:12px">
                Este email fue generado automáticamente por NEXUS POS.<br>
                Para cambiar la configuración de alertas: Sistema → Configuración → Alertas
            </p>
        </div>
    </div>"""

    enviado = _enviar_email_alerta(cfg, f"📊 Alertas NEXUS — {hoy.strftime('%d/%m/%Y')}", html)

    # Registrar en log
    insert("""INSERT INTO sys_alertas_log
        (tipo, total_items, email_enviado, detalle, created_at)
        VALUES ('DIARIO',%s,%s,%s,NOW())""",
        (total, enviado, f"Stock:{len(alertas['stock_bajo'])} Vencidos:{len(alertas['cobros_vencidos'])} PorVencer:{len(alertas['facturas_vencer'])} Cumples:{len(alertas['cumpleanos'])}"))
