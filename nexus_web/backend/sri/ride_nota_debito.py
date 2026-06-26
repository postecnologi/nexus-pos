"""
Generador RIDE para Nota de Debito (tipo 05)
Genera PDF con reportlab.
"""
import io


def generar_ride_nota_debito(nd: dict, empresa: dict, detalles: list) -> bytes:
    """Genera el PDF RIDE de una Nota de Debito. Retorna bytes del PDF."""
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
    styles.add(ParagraphStyle("Header", parent=styles["Heading1"], fontSize=14, spaceAfter=2*mm))
    styles.add(ParagraphStyle("SubHeader", parent=styles["Normal"], fontSize=9, spaceAfter=1*mm))
    styles.add(ParagraphStyle("Small", parent=styles["Normal"], fontSize=7))
    styles.add(ParagraphStyle("SmallBold", parent=styles["Normal"], fontSize=7, fontName="Helvetica-Bold"))

    elements = []
    w = A4[0] - 3*cm

    ruc = empresa.get("ruc", "")
    razon = empresa.get("razon_social", "")
    dir_emp = empresa.get("direccion", "")
    numero = nd.get("numero", "")
    clave = nd.get("clave_acceso", "")
    ambiente = "PRUEBAS" if empresa.get("ambiente_sri") == "1" else "PRODUCCION"

    # ── Encabezado empresa ──
    header_data = [
        [Paragraph(f"<b>{razon}</b>", styles["Header"]),
         Paragraph(f"<b>R.U.C.: {ruc}</b>", styles["SubHeader"])],
        [Paragraph(f"Dir: {dir_emp}", styles["Small"]),
         Paragraph(f"<b>NOTA DE DEBITO</b><br/>No. {numero}", styles["SubHeader"])],
        [Paragraph(f"Obligado a llevar contabilidad: {'SI' if empresa.get('obligado_contabilidad') else 'NO'}", styles["Small"]),
         Paragraph(f"AMBIENTE: {ambiente}", styles["Small"])],
    ]
    header_table = Table(header_data, colWidths=[w*0.55, w*0.45])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("BOX", (0,0), (-1,-1), 0.5, colors.black),
        ("INNERGRID", (0,0), (-1,-1), 0.25, colors.grey),
        ("BACKGROUND", (1,0), (1,0), colors.HexColor("#f0f0f0")),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 3*mm))

    # ── Clave de acceso ──
    if clave:
        clave_data = [[Paragraph(f"<b>CLAVE DE ACCESO:</b> {clave}", styles["Small"])]]
        clave_table = Table(clave_data, colWidths=[w])
        clave_table.setStyle(TableStyle([
            ("BOX", (0,0), (-1,-1), 0.5, colors.black),
            ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#f8f8f8")),
        ]))
        elements.append(clave_table)
        elements.append(Spacer(1, 3*mm))

    # ── Datos del cliente ──
    fecha = str(nd.get("fecha_emision", ""))[:10]
    cli_data = [
        [Paragraph(f"<b>Razon Social:</b> {nd.get('cliente_nombre', '')}", styles["Small"]),
         Paragraph(f"<b>RUC/CI:</b> {nd.get('cliente_ruc', '')}", styles["Small"])],
        [Paragraph(f"<b>Fecha Emision:</b> {fecha}", styles["Small"]),
         Paragraph(f"<b>Direccion:</b> {nd.get('cliente_dir', '')}", styles["Small"])],
    ]
    cli_table = Table(cli_data, colWidths=[w*0.5, w*0.5])
    cli_table.setStyle(TableStyle([
        ("BOX", (0,0), (-1,-1), 0.5, colors.black),
        ("INNERGRID", (0,0), (-1,-1), 0.25, colors.grey),
    ]))
    elements.append(cli_table)
    elements.append(Spacer(1, 3*mm))

    # ── Motivo ──
    motivo_data = [[Paragraph(f"<b>MOTIVO:</b> {nd.get('motivo', '')}", styles["Small"])]]
    motivo_table = Table(motivo_data, colWidths=[w])
    motivo_table.setStyle(TableStyle([
        ("BOX", (0,0), (-1,-1), 0.5, colors.black),
        ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#fffff0")),
    ]))
    elements.append(motivo_table)
    elements.append(Spacer(1, 3*mm))

    # ── Documento modificado ──
    if nd.get("numero_factura"):
        ref_data = [[
            Paragraph(f"<b>Doc. Modificado:</b> FACTURA", styles["Small"]),
            Paragraph(f"<b>No.:</b> {nd.get('numero_factura', '')}", styles["Small"]),
            Paragraph(f"<b>Fecha:</b> {str(nd.get('factura_fecha', ''))[:10]}", styles["Small"]),
        ]]
        ref_table = Table(ref_data, colWidths=[w*0.33, w*0.33, w*0.34])
        ref_table.setStyle(TableStyle([
            ("BOX", (0,0), (-1,-1), 0.5, colors.black),
            ("INNERGRID", (0,0), (-1,-1), 0.25, colors.grey),
        ]))
        elements.append(ref_table)
        elements.append(Spacer(1, 3*mm))

    # ── Detalles ──
    det_header = ["Descripcion", "Cant.", "P. Unit.", "IVA%", "Subtotal", "IVA", "Total"]
    det_data = [det_header]
    for d in detalles:
        det_data.append([
            Paragraph(d.get("descripcion", ""), styles["Small"]),
            f"{float(d.get('cantidad', 0)):.2f}",
            f"${float(d.get('precio_unitario', 0)):.2f}",
            f"{float(d.get('iva_porcentaje', 0)):.0f}%",
            f"${float(d.get('subtotal', 0)):.2f}",
            f"${float(d.get('iva_valor', 0)):.2f}",
            f"${float(d.get('total', 0)):.2f}",
        ])

    col_w = [w*0.30, w*0.08, w*0.12, w*0.08, w*0.14, w*0.14, w*0.14]
    det_table = Table(det_data, colWidths=col_w)
    det_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#2563EB")),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONTSIZE", (0,0), (-1,-1), 7),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("BOX", (0,0), (-1,-1), 0.5, colors.black),
        ("INNERGRID", (0,0), (-1,-1), 0.25, colors.grey),
        ("ALIGN", (1,0), (-1,-1), "RIGHT"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ]))
    elements.append(det_table)
    elements.append(Spacer(1, 4*mm))

    # ── Totales ──
    totals = [
        ["Subtotal 0%:", f"${float(nd.get('subtotal_0', 0)):.2f}"],
        ["Subtotal IVA:", f"${float(nd.get('subtotal_iva', 0)):.2f}"],
        ["IVA:", f"${float(nd.get('iva', 0)):.2f}"],
        ["TOTAL:", f"${float(nd.get('total', 0)):.2f}"],
    ]
    tot_table = Table(totals, colWidths=[w*0.7, w*0.3])
    tot_table.setStyle(TableStyle([
        ("ALIGN", (0,0), (0,-1), "RIGHT"),
        ("ALIGN", (1,0), (1,-1), "RIGHT"),
        ("FONTNAME", (0,-1), (-1,-1), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,-1), 8),
        ("BOX", (0,0), (-1,-1), 0.5, colors.black),
        ("INNERGRID", (0,0), (-1,-1), 0.25, colors.grey),
        ("BACKGROUND", (0,-1), (-1,-1), colors.HexColor("#f0f0f0")),
    ]))
    elements.append(tot_table)

    doc.build(elements)
    return buffer.getvalue()
