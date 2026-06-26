"""
Generador RIDE (Representación Impresa del Documento Electrónico)
Genera PDF de facturas y notas de crédito autorizadas por el SRI.

Requiere: pip install reportlab
"""
import io
from datetime import datetime


def generar_ride_factura(factura: dict, empresa: dict, cliente: dict,
                         detalles: list, pagos: list) -> bytes:
    """Genera el PDF RIDE de una factura. Retorna bytes del PDF."""
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

    # ── Encabezado empresa ──
    ruc = empresa.get("ruc", "")
    razon = empresa.get("razon_social", "")
    dir_emp = empresa.get("direccion", "")
    num_fac = factura.get("numero_factura", "")
    clave = factura.get("clave_acceso", "")
    num_aut = factura.get("numero_autorizacion") or clave
    fecha_aut = factura.get("fecha_autorizacion") or ""
    ambiente = "PRUEBAS" if empresa.get("ambiente_sri") == "1" else "PRODUCCIÓN"

    header_data = [
        [Paragraph(f"<b>{razon}</b>", styles["Header"]),
         Paragraph(f"<b>R.U.C.: {ruc}</b>", styles["SubHeader"])],
        [Paragraph(f"Dir: {dir_emp}", styles["Small"]),
         Paragraph(f"<b>FACTURA</b><br/>No. {num_fac}", styles["SubHeader"])],
        [Paragraph(f"Obligado a llevar contabilidad: {'SÍ' if empresa.get('obligado_contabilidad') else 'NO'}", styles["Small"]),
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

    # Clave de acceso
    if clave:
        elements.append(Paragraph(f"<b>Clave de Acceso:</b> {clave}", styles["Small"]))
    if num_aut and num_aut != clave:
        elements.append(Paragraph(f"<b>Número de Autorización:</b> {num_aut}", styles["Small"]))
    if fecha_aut:
        elements.append(Paragraph(f"<b>Fecha de Autorización:</b> {fecha_aut}", styles["Small"]))
    elements.append(Spacer(1, 3*mm))

    # ── Datos del cliente ──
    fecha_em = factura.get("fecha_emision", "")
    if hasattr(fecha_em, "strftime"):
        fecha_em = fecha_em.strftime("%d/%m/%Y")

    cli_data = [
        ["Razón Social:", cliente.get("razon_social", ""), "RUC/CI:", cliente.get("identificacion", "")],
        ["Fecha Emisión:", str(fecha_em), "Dirección:", cliente.get("direccion", "") or ""],
    ]
    cli_table = Table(cli_data, colWidths=[w*0.15, w*0.35, w*0.12, w*0.38])
    cli_table.setStyle(TableStyle([
        ("FONTSIZE", (0,0), (-1,-1), 7),
        ("FONTNAME", (0,0), (0,-1), "Helvetica-Bold"),
        ("FONTNAME", (2,0), (2,-1), "Helvetica-Bold"),
        ("BOX", (0,0), (-1,-1), 0.5, colors.black),
        ("INNERGRID", (0,0), (-1,-1), 0.25, colors.grey),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING", (0,0), (-1,-1), 1),
        ("BOTTOMPADDING", (0,0), (-1,-1), 1),
    ]))
    elements.append(cli_table)
    elements.append(Spacer(1, 3*mm))

    # ── Detalles ──
    det_header = ["Cod.", "Descripción", "Cant.", "P.Unit.", "Desc.", "Subtotal"]
    det_data = [det_header]
    for d in detalles:
        det_data.append([
            d.get("codigo", ""),
            d.get("descripcion", ""),
            f"{float(d.get('cantidad', 0)):.2f}",
            f"${float(d.get('precio_unitario', 0)):.2f}",
            f"${float(d.get('descuento', 0)):.2f}",
            f"${float(d.get('subtotal', 0)):.2f}",
        ])

    det_table = Table(det_data, colWidths=[w*0.10, w*0.40, w*0.08, w*0.14, w*0.10, w*0.18])
    det_table.setStyle(TableStyle([
        ("FONTSIZE", (0,0), (-1,-1), 7),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#e0e0e0")),
        ("BOX", (0,0), (-1,-1), 0.5, colors.black),
        ("INNERGRID", (0,0), (-1,-1), 0.25, colors.grey),
        ("ALIGN", (2,1), (-1,-1), "RIGHT"),
        ("TOPPADDING", (0,0), (-1,-1), 1),
        ("BOTTOMPADDING", (0,0), (-1,-1), 1),
    ]))
    elements.append(det_table)
    elements.append(Spacer(1, 3*mm))

    # ── Totales ──
    sub0 = float(factura.get("subtotal_0", 0))
    sub_iva = float(factura.get("subtotal_iva", 0))
    iva = float(factura.get("iva", 0))
    total = float(factura.get("total", 0))
    iva_pct = int(float(empresa.get("iva_porcentaje", 15)))

    totales_data = [
        ["SUBTOTAL 0%:", f"${sub0:.2f}"],
        [f"SUBTOTAL {iva_pct}%:", f"${sub_iva:.2f}"],
        [f"IVA {iva_pct}%:", f"${iva:.2f}"],
        ["TOTAL:", f"${total:.2f}"],
    ]
    totales_table = Table(totales_data, colWidths=[w*0.75, w*0.25])
    totales_table.setStyle(TableStyle([
        ("FONTSIZE", (0,0), (-1,-1), 8),
        ("FONTNAME", (0,-1), (-1,-1), "Helvetica-Bold"),
        ("ALIGN", (0,0), (-1,-1), "RIGHT"),
        ("BOX", (0,0), (-1,-1), 0.5, colors.black),
        ("LINEABOVE", (0,-1), (-1,-1), 1, colors.black),
        ("TOPPADDING", (0,0), (-1,-1), 1),
        ("BOTTOMPADDING", (0,0), (-1,-1), 1),
    ]))
    elements.append(totales_table)
    elements.append(Spacer(1, 3*mm))

    # ── Formas de pago ──
    if pagos:
        pago_header = ["Forma de Pago", "Valor"]
        pago_data = [pago_header]
        for p in pagos:
            pago_data.append([
                p.get("forma_pago", ""),
                f"${float(p.get('monto', 0)):.2f}",
            ])
        pago_table = Table(pago_data, colWidths=[w*0.75, w*0.25])
        pago_table.setStyle(TableStyle([
            ("FONTSIZE", (0,0), (-1,-1), 7),
            ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
            ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#e0e0e0")),
            ("BOX", (0,0), (-1,-1), 0.5, colors.black),
            ("ALIGN", (1,0), (1,-1), "RIGHT"),
        ]))
        elements.append(pago_table)

    doc.build(elements)
    return buffer.getvalue()
