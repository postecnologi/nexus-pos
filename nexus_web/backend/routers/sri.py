"""
Router SRI — Facturación Electrónica Ecuador
Endpoints para generar XML, firmar, enviar al SRI, consultar y descargar RIDE.
"""
import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from database import query, query_one, execute
from auth import get_current_user
from typing import Optional
from pydantic import BaseModel

router = APIRouter(prefix="/api/sri", tags=["SRI"])


# ── Estado del certificado ───────────────────────────────────

@router.get("/certificado")
def estado_certificado(u=Depends(get_current_user)):
    """Verifica si hay certificado .p12 configurado y si es válido."""
    from sri.firma import verificar_certificado
    password = os.getenv("SRI_P12_PASSWORD", "")
    return verificar_certificado(p12_password=password)


@router.post("/certificado")
async def subir_certificado(file: UploadFile = File(...), u=Depends(get_current_user)):
    """Sube un certificado .p12 para firma electrónica."""
    if not file.filename.lower().endswith(".p12"):
        raise HTTPException(400, "El archivo debe ser .p12")
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(400, "Archivo muy grande (máx 10MB)")
    from sri.firma import guardar_certificado
    dest = guardar_certificado(data, file.filename)
    return {"msg": "Certificado guardado", "archivo": dest.name}


class P12PasswordIn(BaseModel):
    password: str

@router.post("/certificado/verificar")
def verificar_password_cert(body: P12PasswordIn, u=Depends(get_current_user)):
    """Verifica que la contraseña del .p12 sea correcta."""
    from sri.firma import verificar_certificado
    result = verificar_certificado(p12_password=body.password)
    return result


# ── Generar XML + Firmar + Enviar Factura ────────────────────

@router.post("/factura/{fid}/procesar")
def procesar_factura_sri(fid: int, u=Depends(get_current_user)):
    """
    Flujo completo: genera XML → firma → envía al SRI → consulta autorización.
    Actualiza el estado_sri de la factura.
    """
    f = query_one("""
        SELECT f.*, c.razon_social as cli_razon, c.identificacion as cli_ruc,
               c.tipo_identificacion as cli_tipo_id, c.direccion as cli_dir,
               c.email as cli_email, c.telefono as cli_tel
        FROM ven_facturas f
        JOIN ven_clientes c ON c.id = f.cliente_id
        WHERE f.id=%s
    """, (fid,))
    if not f:
        raise HTTPException(404, "Factura no encontrada")
    if f.get("estado") != "EMITIDA":
        raise HTTPException(400, "Solo se pueden procesar facturas EMITIDAS")
    if f.get("estado_sri") == "AUTORIZADA":
        raise HTTPException(400, "La factura ya está AUTORIZADA")

    empresa = query_one("SELECT * FROM sys_empresas WHERE activa=true LIMIT 1")
    if not empresa:
        raise HTTPException(400, "Configure la empresa primero")

    suc = query_one("SELECT * FROM sys_sucursales WHERE id=%s", (f.get("sucursal_id"),))
    if not suc:
        raise HTTPException(400, "Sucursal no encontrada")

    detalles = query("""
        SELECT fd.*, p.codigo, p.descripcion
        FROM ven_factura_detalles fd
        JOIN inv_productos p ON p.id = fd.producto_id
        WHERE fd.factura_id=%s ORDER BY fd.id
    """, (fid,))

    pagos = query("SELECT * FROM ven_pagos WHERE factura_id=%s", (fid,))

    # Extraer secuencial del número de factura
    partes = (f.get("numero_factura") or "001-001-000000001").split("-")
    seq = int(partes[2]) if len(partes) == 3 else 1

    cliente = {
        "razon_social": f["cli_razon"],
        "identificacion": f["cli_ruc"],
        "tipo_identificacion": f.get("cli_tipo_id") or "RUC",
        "direccion": f.get("cli_dir"),
        "email": f.get("cli_email"),
        "telefono": f.get("cli_tel"),
    }

    factura_data = {**f, "secuencial": seq}

    # 1. Generar XML
    from sri.xml_generator import generar_xml_factura
    xml_str = generar_xml_factura(factura_data, empresa, suc, cliente, detalles, pagos)

    # 2. Firmar
    try:
        from sri.firma import firmar_xml
        xml_firmado = firmar_xml(xml_str)
    except (ImportError, FileNotFoundError) as e:
        execute("UPDATE ven_facturas SET estado_sri='ERROR_FIRMA' WHERE id=%s", (fid,))
        return {
            "estado": "ERROR_FIRMA",
            "msg": str(e),
            "xml_generado": True,
            "firmado": False,
        }

    # 3. Enviar al SRI
    from sri.ws_client import enviar_comprobante
    ambiente = empresa.get("ambiente_sri") or "1"
    resultado_envio = enviar_comprobante(xml_firmado, ambiente)

    if not resultado_envio["recibido"]:
        execute("UPDATE ven_facturas SET estado_sri='RECHAZADA' WHERE id=%s", (fid,))
        return {
            "estado": "RECHAZADA",
            "msg": "El SRI rechazó el comprobante",
            "xml_generado": True,
            "firmado": True,
            "enviado": False,
            "mensajes_sri": resultado_envio["mensajes"],
        }

    # 4. Consultar autorización
    from sri.ws_client import consultar_autorizacion
    clave = f.get("clave_acceso") or ""
    resultado_aut = consultar_autorizacion(clave, ambiente)

    if resultado_aut["autorizado"]:
        execute("""
            UPDATE ven_facturas SET
                estado_sri='AUTORIZADA',
                numero_autorizacion=%s,
                fecha_autorizacion=%s
            WHERE id=%s
        """, (resultado_aut["numero_autorizacion"],
              resultado_aut["fecha_autorizacion"], fid))
        estado_final = "AUTORIZADA"

        # Enviar email automático al cliente si está configurado SMTP
        email_enviado = False
        try:
            from sri.email_sender import smtp_configurado
            if smtp_configurado() and f.get("cli_email"):
                enviar_factura_email(fid, u)
                email_enviado = True
        except:
            pass
    else:
        execute("UPDATE ven_facturas SET estado_sri='RECIBIDA' WHERE id=%s", (fid,))
        estado_final = "RECIBIDA"
        email_enviado = False

    return {
        "estado": estado_final,
        "msg": f"Factura {estado_final}",
        "xml_generado": True,
        "firmado": True,
        "enviado": True,
        "autorizado": resultado_aut["autorizado"],
        "numero_autorizacion": resultado_aut.get("numero_autorizacion"),
        "fecha_autorizacion": resultado_aut.get("fecha_autorizacion"),
        "mensajes_sri": resultado_aut.get("mensajes", []),
        "email_enviado": email_enviado,
    }


@router.get("/factura/{fid}/consultar")
def consultar_factura_sri(fid: int, u=Depends(get_current_user)):
    """Consulta el estado de una factura en el SRI por su clave de acceso."""
    f = query_one("SELECT clave_acceso, estado_sri FROM ven_facturas WHERE id=%s", (fid,))
    if not f:
        raise HTTPException(404, "Factura no encontrada")
    if not f.get("clave_acceso"):
        raise HTTPException(400, "La factura no tiene clave de acceso")

    empresa = query_one("SELECT ambiente_sri FROM sys_empresas WHERE activa=true LIMIT 1")
    ambiente = empresa.get("ambiente_sri", "1") if empresa else "1"

    from sri.ws_client import consultar_autorizacion
    resultado = consultar_autorizacion(f["clave_acceso"], ambiente)

    if resultado["autorizado"]:
        execute("""
            UPDATE ven_facturas SET
                estado_sri='AUTORIZADA',
                numero_autorizacion=%s,
                fecha_autorizacion=%s
            WHERE id=%s
        """, (resultado["numero_autorizacion"], resultado["fecha_autorizacion"], fid))

    return resultado


@router.get("/factura/{fid}/xml")
def descargar_xml_factura(fid: int, u=Depends(get_current_user)):
    """Genera y descarga el XML de una factura (sin firmar)."""
    f = query_one("""
        SELECT f.*, c.razon_social as cli_razon, c.identificacion as cli_ruc,
               c.tipo_identificacion as cli_tipo_id, c.direccion as cli_dir,
               c.email as cli_email, c.telefono as cli_tel
        FROM ven_facturas f
        JOIN ven_clientes c ON c.id = f.cliente_id
        WHERE f.id=%s
    """, (fid,))
    if not f:
        raise HTTPException(404)

    empresa = query_one("SELECT * FROM sys_empresas WHERE activa=true LIMIT 1")
    suc = query_one("SELECT * FROM sys_sucursales WHERE id=%s", (f.get("sucursal_id"),))
    detalles = query("""
        SELECT fd.*, p.codigo, p.descripcion
        FROM ven_factura_detalles fd
        JOIN inv_productos p ON p.id=fd.producto_id
        WHERE fd.factura_id=%s ORDER BY fd.id
    """, (fid,))
    pagos = query("SELECT * FROM ven_pagos WHERE factura_id=%s", (fid,))

    partes = (f.get("numero_factura") or "").split("-")
    seq = int(partes[2]) if len(partes) == 3 else 1
    cliente = {
        "razon_social": f["cli_razon"], "identificacion": f["cli_ruc"],
        "tipo_identificacion": f.get("cli_tipo_id") or "RUC",
        "direccion": f.get("cli_dir"), "email": f.get("cli_email"),
        "telefono": f.get("cli_tel"),
    }

    from sri.xml_generator import generar_xml_factura
    xml = generar_xml_factura({**f, "secuencial": seq}, empresa, suc, cliente, detalles, pagos)

    num = f.get("numero_factura", "factura").replace("-", "")
    return Response(content=xml, media_type="application/xml",
                    headers={"Content-Disposition": f'attachment; filename="FAC_{num}.xml"'})


@router.get("/factura/{fid}/ride")
def descargar_ride_factura(fid: int, u=Depends(get_current_user)):
    """Genera y descarga el RIDE (PDF) de una factura."""
    f = query_one("""
        SELECT f.*, c.razon_social as cli_razon, c.identificacion as cli_ruc,
               c.tipo_identificacion as cli_tipo_id, c.direccion as cli_dir,
               c.email as cli_email
        FROM ven_facturas f
        JOIN ven_clientes c ON c.id=f.cliente_id
        WHERE f.id=%s
    """, (fid,))
    if not f:
        raise HTTPException(404)

    empresa = query_one("SELECT * FROM sys_empresas WHERE activa=true LIMIT 1")
    detalles = query("""
        SELECT fd.*, p.codigo, p.descripcion
        FROM ven_factura_detalles fd
        JOIN inv_productos p ON p.id=fd.producto_id
        WHERE fd.factura_id=%s ORDER BY fd.id
    """, (fid,))
    pagos = query("SELECT * FROM ven_pagos WHERE factura_id=%s", (fid,))

    cliente = {
        "razon_social": f["cli_razon"], "identificacion": f["cli_ruc"],
        "tipo_identificacion": f.get("cli_tipo_id") or "RUC",
        "direccion": f.get("cli_dir"), "email": f.get("cli_email"),
    }

    from sri.ride import generar_ride_factura
    pdf_bytes = generar_ride_factura(f, empresa, cliente, detalles, pagos)

    num = f.get("numero_factura", "factura").replace("-", "")
    return Response(content=pdf_bytes, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="RIDE_{num}.pdf"'})


# ── Procesamiento masivo ─────────────────────────────────────

@router.post("/facturas/procesar-pendientes")
def procesar_facturas_pendientes(u=Depends(get_current_user)):
    """Procesa todas las facturas que no han sido enviadas al SRI."""
    pendientes = query("""
        SELECT id, numero_factura FROM ven_facturas
        WHERE estado='EMITIDA'
          AND (estado_sri IS NULL OR estado_sri IN ('NO_ENVIADA','RECHAZADA','ERROR_FIRMA'))
        ORDER BY id
        LIMIT 20
    """)
    resultados = []
    for fac in pendientes:
        try:
            result = procesar_factura_sri(fac["id"], u)
            resultados.append({
                "id": fac["id"],
                "numero": fac["numero_factura"],
                **result,
            })
        except Exception as e:
            resultados.append({
                "id": fac["id"],
                "numero": fac["numero_factura"],
                "estado": "ERROR",
                "msg": str(e),
            })
    return {
        "procesadas": len(resultados),
        "resultados": resultados,
    }


# ── Migraciones columnas SRI ─────────────────────────────────

@router.get("/estado")
def estado_sri_general(u=Depends(get_current_user)):
    """Resumen del estado SRI del sistema."""
    from sri.firma import verificar_certificado, get_cert_path
    empresa = query_one("SELECT ambiente_sri, ruc FROM sys_empresas WHERE activa=true LIMIT 1")

    cert_info = verificar_certificado(p12_password=os.getenv("SRI_P12_PASSWORD", ""))
    tiene_cert = get_cert_path() is not None

    stats = query_one("""
        SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN estado_sri='AUTORIZADA' THEN 1 END) as autorizadas,
            COUNT(CASE WHEN estado_sri='RECHAZADA' THEN 1 END) as rechazadas,
            COUNT(CASE WHEN estado_sri IN ('NO_ENVIADA',NULL) OR estado_sri IS NULL THEN 1 END) as pendientes,
            COUNT(CASE WHEN estado_sri='RECIBIDA' THEN 1 END) as recibidas,
            COUNT(CASE WHEN estado_sri='ERROR_FIRMA' THEN 1 END) as error_firma
        FROM ven_facturas WHERE estado='EMITIDA'
    """)

    return {
        "ambiente": empresa.get("ambiente_sri", "1") if empresa else "1",
        "ambiente_nombre": "PRUEBAS" if (empresa or {}).get("ambiente_sri") == "1" else "PRODUCCIÓN",
        "ruc": empresa.get("ruc", "") if empresa else "",
        "tiene_certificado": tiene_cert,
        "certificado": cert_info,
        "facturas": stats,
    }


# ══════════════════════════════════════════════════════════════
#  EMAIL — Envío de comprobantes al cliente
# ══════════════════════════════════════════════════════════════

@router.get("/email/config")
def estado_email(u=Depends(get_current_user)):
    from sri.email_sender import get_smtp_config, smtp_configurado
    cfg = get_smtp_config()
    return {
        "configurado": smtp_configurado(),
        "host": cfg["host"],
        "port": cfg["port"],
        "user": cfg["user"],
        "from_name": cfg["from_name"],
        "from_email": cfg["from_email"] or cfg["user"],
        "use_tls": cfg["use_tls"],
    }


class SmtpConfigIn(BaseModel):
    smtp_host:       str
    smtp_port:       int = 587
    smtp_user:       str
    smtp_password:   str
    smtp_from_name:  str = "NEXUS POS"
    smtp_from_email: str = ""
    smtp_use_tls:    bool = True


@router.post("/email/config")
def guardar_config_email(cfg: SmtpConfigIn, u=Depends(get_current_user)):
    """Guarda la configuración SMTP en la base de datos."""
    existing = query_one("SELECT id, smtp_password FROM sys_config_smtp LIMIT 1")
    password = cfg.smtp_password if cfg.smtp_password else (existing.get("smtp_password","") if existing else "")
    if existing:
        execute("""
            UPDATE sys_config_smtp SET
                smtp_host=%s, smtp_port=%s, smtp_user=%s, smtp_password=%s,
                smtp_from_name=%s, smtp_from_email=%s, smtp_use_tls=%s,
                activo=true, updated_at=NOW()
            WHERE id=%s
        """, (cfg.smtp_host, cfg.smtp_port, cfg.smtp_user, password,
              cfg.smtp_from_name, cfg.smtp_from_email or cfg.smtp_user,
              cfg.smtp_use_tls, existing["id"]))
    else:
        from database import insert
        insert("""
            INSERT INTO sys_config_smtp
                (smtp_host, smtp_port, smtp_user, smtp_password,
                 smtp_from_name, smtp_from_email, smtp_use_tls, activo)
            VALUES (%s,%s,%s,%s,%s,%s,%s,true)
        """, (cfg.smtp_host, cfg.smtp_port, cfg.smtp_user, cfg.smtp_password,
              cfg.smtp_from_name, cfg.smtp_from_email or cfg.smtp_user,
              cfg.smtp_use_tls))
    return {"msg": "Configuración SMTP guardada"}


@router.post("/email/test")
def test_email(u=Depends(get_current_user)):
    """Envía un email de prueba al correo configurado."""
    from sri.email_sender import enviar_comprobante_email, get_smtp_config
    cfg = get_smtp_config()
    destino = cfg["from_email"] or cfg["user"]
    if not destino:
        raise HTTPException(400, "Configure SMTP_USER en .env primero")

    result = enviar_comprobante_email(
        destinatario_email=destino,
        destinatario_nombre="Administrador",
        asunto="NEXUS POS — Prueba de correo",
        cuerpo_html="<h2>Correo de prueba</h2><p>Si recibes este mensaje, el SMTP está configurado correctamente.</p>",
    )
    return result


@router.post("/factura/{fid}/enviar-email")
def enviar_factura_email(fid: int, u=Depends(get_current_user)):
    """
    Envía la factura al email del cliente con RIDE (PDF) + XML adjuntos.
    """
    f = query_one("""
        SELECT f.*, c.razon_social as cli_razon, c.identificacion as cli_ruc,
               c.tipo_identificacion as cli_tipo_id, c.direccion as cli_dir,
               c.email as cli_email, c.telefono as cli_tel
        FROM ven_facturas f
        JOIN ven_clientes c ON c.id = f.cliente_id
        WHERE f.id=%s
    """, (fid,))
    if not f:
        raise HTTPException(404, "Factura no encontrada")

    cli_email = f.get("cli_email")
    if not cli_email:
        raise HTTPException(400,
            "El cliente no tiene email registrado. "
            "Agregue el email en el módulo Clientes antes de enviar.")

    empresa = query_one("SELECT * FROM sys_empresas WHERE activa=true LIMIT 1")
    if not empresa:
        raise HTTPException(400, "Configure la empresa primero")

    suc = query_one("SELECT * FROM sys_sucursales WHERE id=%s", (f.get("sucursal_id"),))
    detalles = query("""
        SELECT fd.*, p.codigo, p.descripcion
        FROM ven_factura_detalles fd
        JOIN inv_productos p ON p.id=fd.producto_id
        WHERE fd.factura_id=%s ORDER BY fd.id
    """, (fid,))
    pagos = query("SELECT * FROM ven_pagos WHERE factura_id=%s", (fid,))

    cliente = {
        "razon_social": f["cli_razon"], "identificacion": f["cli_ruc"],
        "tipo_identificacion": f.get("cli_tipo_id") or "RUC",
        "direccion": f.get("cli_dir"), "email": cli_email,
        "telefono": f.get("cli_tel"),
    }

    # Generar RIDE PDF
    from sri.ride import generar_ride_factura
    pdf_bytes = generar_ride_factura(f, empresa, cliente, detalles, pagos)

    # Generar XML
    partes = (f.get("numero_factura") or "").split("-")
    seq = int(partes[2]) if len(partes) == 3 else 1
    from sri.xml_generator import generar_xml_factura
    xml_str = generar_xml_factura({**f, "secuencial": seq}, empresa, suc, cliente, detalles, pagos)

    # Preparar email
    num_fac = f.get("numero_factura", "")
    num_clean = num_fac.replace("-", "")
    fecha = f.get("fecha_emision")
    if hasattr(fecha, "strftime"):
        fecha_str = fecha.strftime("%d/%m/%Y")
    else:
        fecha_str = str(fecha)[:10] if fecha else ""

    from sri.email_sender import enviar_comprobante_email, generar_html_factura
    html = generar_html_factura(
        empresa_nombre=empresa.get("razon_social", ""),
        numero_factura=num_fac,
        cliente_nombre=f["cli_razon"],
        total=float(f.get("total", 0)),
        fecha=fecha_str,
        clave_acceso=f.get("clave_acceso", ""),
    )

    result = enviar_comprobante_email(
        destinatario_email=cli_email,
        destinatario_nombre=f["cli_razon"],
        asunto=f"Factura Electrónica {num_fac} — {empresa.get('razon_social', '')}",
        cuerpo_html=html,
        pdf_bytes=pdf_bytes,
        pdf_nombre=f"RIDE_{num_clean}.pdf",
        xml_str=xml_str,
        xml_nombre=f"FAC_{num_clean}.xml",
    )

    if result["enviado"]:
        try:
            execute("""
                UPDATE ven_facturas SET email_enviado=true, email_enviado_at=NOW()
                WHERE id=%s
            """, (fid,))
        except:
            pass

    return {
        **result,
        "numero_factura": num_fac,
        "cliente": f["cli_razon"],
        "email_destino": cli_email,
    }
