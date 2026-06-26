"""
Generador RIDE (PDF) para Comprobante de Retención — SRI Ecuador
Requiere: pip install reportlab
"""
import io


def generar_ride_retencion(retencion: dict, empresa: dict, detalles: list) -> bytes:
    """Genera el PDF RIDE de una retención. Retorna bytes del PDF."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm, cm
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    except ImportError:
        raise ImportError("Falta 'reportlab'. Ejecute: pip install reportlab")

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                            leftMargin=1.5*cm, rightMargin=1.5*cm,
                            topMargin=1*cm, bottomMargin=1.5*cm)

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("Header", parent=styles["Heading1"],
                              fontSize=14, spaceAfter=2*mm))
    styles.add(ParagraphStyle("SubHeader", parent=styles["Normal"],
                              fontSize=9, spaceAfter=1*mm))
    styles.add(ParagraphStyle("Small", parent=styles["Normal"], fontSize=7))
    styles.add(ParagraphStyle("SmallBold", parent=styles["Normal"],
                              fontSize=7, fontName="Helvetica-Bold"))

    elements = []
    w = A4[0] - 3*cm

    # ── Encabezado empresa ──
    ruc_emp = empresa.get("ruc", "") if empresa else ""
    razon_emp = empresa.get("razon_social", "") if empresa else ""
    dir_emp = empresa.get("direccion", "") if empresa else ""
    numero_ret = retencion.get("numero", "")
    clave = retencion.get("clave_acceso", "")
    num_aut = retencion.get("numero_autorizacion") or clave
    ambiente = "PRUEBAS" if (empresa or {}).get("ambiente_sri") == "1" else "PRODUCCION"

    header_data = [
        [Paragraph(f"<b>{razon_emp}</b>", styles["Header"]),
         Paragraph(f"<b>R.U.C.: {ruc_emp}</b>", styles["SubHeader"])],
        [Paragraph(f"Dir: {dir_emp}", styles["Small"]),
         Paragraph(f"<b>COMPROBANTE DE RETENCION</b><br/>No. {numero_ret}",
                   styles["SubHeader"])],
        [Paragraph(f"Obligado a llevar contabilidad: "
                   f"{'SI' if (empresa or {}).get('obligado_contabilidad') else 'NO'}",
                   styles["Small"]),
         Paragraph(f"AMBIENTE: {ambiente}", styles["Small"])],
    ]
    header_table = Table(header_data, colWidths=[w*0.55, w*0.45])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.black),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.grey),
        ("BACKGROUND", (1, 0), (1, 0), colors.HexColor("#f0f0f0")),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 3*mm))

    # Clave de acceso
    if clave:
        elements.append(Paragraph(f"<b>Clave de Acceso:</b> {clave}", styles["Small"]))
    if num_aut and num_aut != clave:
        elements.append(Paragraph(f"<b>No. Autorizacion:</b> {num_aut}", styles["Small"]))
    elements.append(Spacer(1, 3*mm))

    # ── Datos del sujeto retenido ──
    es_emitida = retencion.get("tipo") == "EMITIDA"

    if es_emitida:
        nombre_sujeto = retencion.get("proveedor_nombre", "")
        ruc_sujeto = retencion.get("proveedor_ruc", "")
        dir_sujeto = retencion.get("proveedor_dir", "") or ""
        label_sujeto = "Sujeto Retenido (Proveedor)"
    else:
        nombre_sujeto = retencion.get("cliente_nombre", "")
        ruc_sujeto = retencion.get("cliente_ruc", "")
        dir_sujeto = retencion.get("cliente_dir", "") or ""
        label_sujeto = "Agente de Retencion (Cliente)"

    fecha_em = retencion.get("fecha_emision", "")
    if hasattr(fecha_em, "strftime"):
        fecha_em = fecha_em.strftime("%d/%m/%Y")
    else:
        fecha_em = str(fecha_em)[:10]

    sujeto_data = [
        [label_sujeto + ":", nombre_sujeto, "RUC/CI:", ruc_sujeto],
        ["Fecha Emision:", fecha_em, "Direccion:", dir_sujeto],
        ["Ejercicio Fiscal:", retencion.get("periodo_fiscal", ""), "", ""],
    ]
    sujeto_table = Table(sujeto_data, colWidths=[w*0.20, w*0.30, w*0.12, w*0.38])
    sujeto_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.black),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
    ]))
    elements.append(sujeto_table)
    elements.append(Spacer(1, 4*mm))

    # ── Detalles de retención ──
    # Separar IVA y RENTA
    det_iva = [d for d in detalles if str(d.get("tipo_impuesto", "")).upper() == "IVA"]
    det_renta = [d for d in detalles if str(d.get("tipo_impuesto", "")).upper() == "RENTA"]

    for grupo_label, grupo_detalles in [("Retenciones IVA", det_iva),
                                        ("Retenciones Renta", det_renta)]:
        if not grupo_detalles:
            continue

        elements.append(Paragraph(f"<b>{grupo_label}</b>", styles["SubHeader"]))
        elements.append(Spacer(1, 1*mm))

        det_header = ["Impuesto", "Cod. Ret.", "% Retencion", "Base Imponible", "Valor Retenido"]
        det_data = [det_header]
        subtotal_grupo = 0.0
        for d in grupo_detalles:
            valor_ret = float(d.get("valor_retenido", 0))
            subtotal_grupo += valor_ret
            det_data.append([
                str(d.get("tipo_impuesto", "")),
                str(d.get("codigo_retencion", "")),
                f"{float(d.get('porcentaje', 0)):.2f}%",
                f"${float(d.get('base_imponible', 0)):,.2f}",
                f"${valor_ret:,.2f}",
            ])
        det_data.append(["", "", "", "Subtotal:", f"${subtotal_grupo:,.2f}"])

        det_table = Table(det_data, colWidths=[w*0.15, w*0.15, w*0.18, w*0.26, w*0.26])
        det_table.setStyle(TableStyle([
            ("FONTSIZE", (0, 0), (-1, -1), 7),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e0e0e0")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.black),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.grey),
            ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("TOPPADDING", (0, 0), (-1, -1), 1),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ]))
        elements.append(det_table)
        elements.append(Spacer(1, 3*mm))

    # ── Total general ──
    total = float(retencion.get("total_retenido", 0))
    total_data = [
        ["TOTAL RETENIDO:", f"${total:,.2f}"],
    ]
    total_table = Table(total_data, colWidths=[w*0.74, w*0.26])
    total_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.black),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f0f0f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(total_table)
    elements.append(Spacer(1, 5*mm))

    # ── Observaciones ──
    obs = retencion.get("observaciones")
    if obs:
        elements.append(Paragraph(f"<b>Observaciones:</b> {obs}", styles["Small"]))

    doc.build(elements)
    return buffer.getvalue()
