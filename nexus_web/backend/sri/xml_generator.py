"""
Generador de XML para comprobantes electrónicos SRI — Ecuador
Soporta: Factura (01), Nota de Crédito (04)
Basado en ficha técnica SRI versión 2.1.0
"""
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom.minidom import parseString
from .utils import (
    tipo_id_a_codigo_sri, forma_pago_a_codigo_sri,
    codigo_iva_sri, generar_clave_acceso, TIPO_DOC,
)


def _el(parent, tag, text=None, **attrs):
    e = SubElement(parent, tag, **attrs)
    if text is not None:
        e.text = str(text)
    return e


def generar_xml_factura(factura: dict, empresa: dict, sucursal: dict,
                        cliente: dict, detalles: list, pagos: list) -> str:
    """
    Genera el XML de una factura electrónica según esquema SRI.
    Retorna el XML como string UTF-8.
    """
    ambiente    = empresa.get("ambiente_sri") or "1"
    ruc         = empresa.get("ruc") or ""
    cod_est     = sucursal.get("codigo_establecimiento") or "001"
    pto_emis    = sucursal.get("punto_emision") or "001"
    seq         = factura.get("secuencial") or 1
    serie6      = f"{cod_est}{pto_emis}"[:6].zfill(6)

    fecha_raw   = factura.get("fecha_emision")
    if hasattr(fecha_raw, "strftime"):
        fecha_ddmmaaaa = fecha_raw.strftime("%d%m%Y")
        fecha_ddmmaaaa_slash = fecha_raw.strftime("%d/%m/%Y")
    else:
        partes = str(fecha_raw)[:10].split("-")
        fecha_ddmmaaaa = f"{partes[2]}{partes[1]}{partes[0]}" if len(partes)==3 else "01012026"
        fecha_ddmmaaaa_slash = f"{partes[2]}/{partes[1]}/{partes[0]}" if len(partes)==3 else "01/01/2026"

    cod_numerico = str(factura.get("id", 1)).zfill(8)[-8:]

    clave = factura.get("clave_acceso") or generar_clave_acceso(
        fecha_ddmmaaaa, TIPO_DOC["FACTURA"], ruc, ambiente,
        serie6, seq, cod_numerico
    )

    root = Element("factura", id="comprobante", version="2.1.0")

    # ── infoTributaria ──
    it = _el(root, "infoTributaria")
    _el(it, "ambiente", ambiente)
    _el(it, "tipoEmision", "1")
    _el(it, "razonSocial", empresa.get("razon_social", ""))
    if empresa.get("nombre_comercial"):
        _el(it, "nombreComercial", empresa["nombre_comercial"])
    _el(it, "ruc", ruc)
    _el(it, "claveAcceso", clave)
    _el(it, "codDoc", TIPO_DOC["FACTURA"])
    _el(it, "estab", cod_est)
    _el(it, "ptoEmi", pto_emis)
    _el(it, "secuencial", str(seq).zfill(9))
    _el(it, "dirMatriz", empresa.get("direccion") or "S/N")

    # ── infoFactura ──
    inf = _el(root, "infoFactura")
    _el(inf, "fechaEmision", fecha_ddmmaaaa_slash)
    if sucursal.get("direccion"):
        _el(inf, "dirEstablecimiento", sucursal["direccion"])
    if empresa.get("contribuyente_especial"):
        _el(inf, "contribuyenteEspecial", empresa["contribuyente_especial"])
    _el(inf, "obligadoContabilidad",
        "SI" if empresa.get("obligado_contabilidad") else "NO")

    tipo_id_cli = tipo_id_a_codigo_sri(cliente.get("tipo_identificacion") or "RUC")
    _el(inf, "tipoIdentificacionComprador", tipo_id_cli)
    _el(inf, "razonSocialComprador", cliente.get("razon_social") or "CONSUMIDOR FINAL")
    _el(inf, "identificacionComprador", cliente.get("identificacion") or "9999999999999")
    if cliente.get("direccion"):
        _el(inf, "direccionComprador", cliente["direccion"])

    total_sin_imp = float(factura.get("subtotal_0", 0)) + float(factura.get("subtotal_iva", 0))
    _el(inf, "totalSinImpuestos", f"{total_sin_imp:.2f}")
    _el(inf, "totalDescuento", f"{float(factura.get('descuento_total', 0)):.2f}")

    # totalConImpuestos
    tci = _el(inf, "totalConImpuestos")

    sub0 = float(factura.get("subtotal_0", 0))
    if sub0 > 0:
        ti = _el(tci, "totalImpuesto")
        _el(ti, "codigo", "2")
        _el(ti, "codigoPorcentaje", "0")
        _el(ti, "baseImponible", f"{sub0:.2f}")
        _el(ti, "valor", "0.00")

    sub_iva = float(factura.get("subtotal_iva", 0))
    iva_monto = float(factura.get("iva", 0))
    iva_pct = float(empresa.get("iva_porcentaje", 15))
    if sub_iva > 0:
        cod_iva = codigo_iva_sri(iva_pct)
        ti = _el(tci, "totalImpuesto")
        _el(ti, "codigo", cod_iva["codigo"])
        _el(ti, "codigoPorcentaje", cod_iva["codigo_porcentaje"])
        _el(ti, "baseImponible", f"{sub_iva:.2f}")
        _el(ti, "valor", f"{iva_monto:.2f}")

    _el(inf, "propina", "0.00")
    _el(inf, "importeTotal", f"{float(factura.get('total', 0)):.2f}")
    _el(inf, "moneda", "DOLAR")

    # pagos
    pags = _el(inf, "pagos")
    for p in pagos:
        pago_el = _el(pags, "pago")
        _el(pago_el, "formaPago", forma_pago_a_codigo_sri(p.get("forma_pago", "EFECTIVO")))
        _el(pago_el, "total", f"{float(p.get('monto', 0)):.2f}")
        if p.get("forma_pago") == "CREDITO":
            _el(pago_el, "plazo", str(p.get("plazo", 30)))
            _el(pago_el, "unidadTiempo", "dias")

    # ── detalles ──
    dets = _el(root, "detalles")
    for d in detalles:
        det = _el(dets, "detalle")
        _el(det, "codigoPrincipal", d.get("codigo") or str(d.get("producto_id", "")))
        _el(det, "descripcion", d.get("descripcion") or "")
        cant = float(d.get("cantidad", 1))
        _el(det, "cantidad", f"{cant:.2f}")
        pu = float(d.get("precio_unitario", 0))
        _el(det, "precioUnitario", f"{pu:.6f}")
        desc = float(d.get("descuento", 0))
        _el(det, "descuento", f"{desc:.2f}")
        subtotal_linea = float(d.get("subtotal", 0))
        _el(det, "precioTotalSinImpuesto", f"{subtotal_linea:.2f}")

        imps = _el(det, "impuestos")
        imp = _el(imps, "impuesto")
        iva_det = float(d.get("iva_porcentaje", iva_pct))
        cod = codigo_iva_sri(iva_det)
        _el(imp, "codigo", cod["codigo"])
        _el(imp, "codigoPorcentaje", cod["codigo_porcentaje"])
        _el(imp, "tarifa", str(int(cod["tarifa"])))
        _el(imp, "baseImponible", f"{subtotal_linea:.2f}")
        _el(imp, "valor", f"{float(d.get('iva_valor', 0)):.2f}")

    # ── infoAdicional ──
    info_ad = _el(root, "infoAdicional")
    if cliente.get("email"):
        _el(info_ad, "campoAdicional", cliente["email"], nombre="email")
    if cliente.get("direccion"):
        _el(info_ad, "campoAdicional", cliente["direccion"], nombre="direccion")
    if cliente.get("telefono"):
        _el(info_ad, "campoAdicional", cliente["telefono"], nombre="telefono")

    xml_str = tostring(root, encoding="unicode", xml_declaration=False)
    xml_str = '<?xml version="1.0" encoding="UTF-8"?>\n' + xml_str
    return parseString(xml_str).toprettyxml(indent="  ", encoding=None)


def generar_xml_nota_credito(nc: dict, empresa: dict, sucursal: dict,
                              cliente: dict, detalles: list,
                              factura_ref: dict) -> str:
    """
    Genera el XML de una Nota de Crédito electrónica según esquema SRI.
    """
    ambiente    = empresa.get("ambiente_sri") or "1"
    ruc         = empresa.get("ruc") or ""
    cod_est     = sucursal.get("codigo_establecimiento") or "001"
    pto_emis    = sucursal.get("punto_emision") or "001"
    seq         = nc.get("secuencial") or 1
    serie6      = f"{cod_est}{pto_emis}"[:6].zfill(6)

    fecha_raw   = nc.get("fecha")
    if hasattr(fecha_raw, "strftime"):
        fecha_ddmmaaaa = fecha_raw.strftime("%d%m%Y")
        fecha_ddmmaaaa_slash = fecha_raw.strftime("%d/%m/%Y")
    else:
        partes = str(fecha_raw)[:10].split("-")
        fecha_ddmmaaaa = f"{partes[2]}{partes[1]}{partes[0]}" if len(partes)==3 else "01012026"
        fecha_ddmmaaaa_slash = f"{partes[2]}/{partes[1]}/{partes[0]}" if len(partes)==3 else "01/01/2026"

    cod_numerico = str(nc.get("id", 1)).zfill(8)[-8:]

    clave = nc.get("clave_acceso") or generar_clave_acceso(
        fecha_ddmmaaaa, TIPO_DOC["NOTA_CREDITO"], ruc, ambiente,
        serie6, seq, cod_numerico
    )

    root = Element("notaCredito", id="comprobante", version="1.1.0")

    # ── infoTributaria ──
    it = _el(root, "infoTributaria")
    _el(it, "ambiente", ambiente)
    _el(it, "tipoEmision", "1")
    _el(it, "razonSocial", empresa.get("razon_social", ""))
    if empresa.get("nombre_comercial"):
        _el(it, "nombreComercial", empresa["nombre_comercial"])
    _el(it, "ruc", ruc)
    _el(it, "claveAcceso", clave)
    _el(it, "codDoc", TIPO_DOC["NOTA_CREDITO"])
    _el(it, "estab", cod_est)
    _el(it, "ptoEmi", pto_emis)
    _el(it, "secuencial", str(seq).zfill(9))
    _el(it, "dirMatriz", empresa.get("direccion") or "S/N")

    # ── infoNotaCredito ──
    inc = _el(root, "infoNotaCredito")
    _el(inc, "fechaEmision", fecha_ddmmaaaa_slash)
    if sucursal.get("direccion"):
        _el(inc, "dirEstablecimiento", sucursal["direccion"])

    tipo_id_cli = tipo_id_a_codigo_sri(cliente.get("tipo_identificacion") or "RUC")
    _el(inc, "tipoIdentificacionComprador", tipo_id_cli)
    _el(inc, "razonSocialComprador", cliente.get("razon_social") or "")
    _el(inc, "identificacionComprador", cliente.get("identificacion") or "")

    if empresa.get("contribuyente_especial"):
        _el(inc, "contribuyenteEspecial", empresa["contribuyente_especial"])
    _el(inc, "obligadoContabilidad",
        "SI" if empresa.get("obligado_contabilidad") else "NO")

    # Documento modificado (factura original)
    _el(inc, "codDocModificado", TIPO_DOC["FACTURA"])
    _el(inc, "numDocModificado", factura_ref.get("numero_factura") or "")

    fecha_fac = factura_ref.get("fecha_emision")
    if hasattr(fecha_fac, "strftime"):
        _el(inc, "fechaEmisionDocSustento", fecha_fac.strftime("%d/%m/%Y"))
    else:
        p = str(fecha_fac)[:10].split("-")
        _el(inc, "fechaEmisionDocSustento", f"{p[2]}/{p[1]}/{p[0]}" if len(p)==3 else "")

    total_sin_imp = float(nc.get("subtotal_0", 0)) + float(nc.get("subtotal_iva", 0))
    _el(inc, "totalSinImpuestos", f"{total_sin_imp:.2f}")
    _el(inc, "valorModificacion", f"{float(nc.get('total', 0)):.2f}")
    _el(inc, "moneda", "DOLAR")
    _el(inc, "motivo", nc.get("motivo") or nc.get("razon_modificacion") or "Devolución")

    # totalConImpuestos
    iva_pct = float(empresa.get("iva_porcentaje", 15))
    tci = _el(inc, "totalConImpuestos")

    sub0 = float(nc.get("subtotal_0", 0))
    if sub0 > 0:
        ti = _el(tci, "totalImpuesto")
        _el(ti, "codigo", "2")
        _el(ti, "codigoPorcentaje", "0")
        _el(ti, "baseImponible", f"{sub0:.2f}")
        _el(ti, "tarifa", "0")
        _el(ti, "valor", "0.00")

    sub_iva = float(nc.get("subtotal_iva", 0))
    iva_monto = float(nc.get("iva", 0))
    if sub_iva > 0:
        cod = codigo_iva_sri(iva_pct)
        ti = _el(tci, "totalImpuesto")
        _el(ti, "codigo", cod["codigo"])
        _el(ti, "codigoPorcentaje", cod["codigo_porcentaje"])
        _el(ti, "baseImponible", f"{sub_iva:.2f}")
        _el(ti, "tarifa", str(int(cod["tarifa"])))
        _el(ti, "valor", f"{iva_monto:.2f}")

    # ── detalles ──
    dets = _el(root, "detalles")
    for d in detalles:
        det = _el(dets, "detalle")
        _el(det, "codigoInterno", d.get("codigo") or str(d.get("producto_id", "")))
        _el(det, "descripcion", d.get("descripcion") or "")
        cant = float(d.get("cantidad", 1))
        _el(det, "cantidad", f"{cant:.2f}")
        pu = float(d.get("precio_unitario", 0))
        _el(det, "precioUnitario", f"{pu:.6f}")
        desc = float(d.get("descuento", 0) if d.get("descuento") else 0)
        _el(det, "descuento", f"{desc:.2f}")
        subtotal_linea = float(d.get("subtotal", 0))
        _el(det, "precioTotalSinImpuesto", f"{subtotal_linea:.2f}")

        imps = _el(det, "impuestos")
        imp = _el(imps, "impuesto")
        iva_det = float(d.get("iva_porcentaje", iva_pct))
        cod = codigo_iva_sri(iva_det)
        _el(imp, "codigo", cod["codigo"])
        _el(imp, "codigoPorcentaje", cod["codigo_porcentaje"])
        _el(imp, "tarifa", str(int(cod["tarifa"])))
        _el(imp, "baseImponible", f"{subtotal_linea:.2f}")
        _el(imp, "valor", f"{float(d.get('iva_valor', 0)):.2f}")

    # ── infoAdicional ──
    info_ad = _el(root, "infoAdicional")
    if cliente.get("email"):
        _el(info_ad, "campoAdicional", cliente["email"], nombre="email")
    if cliente.get("direccion"):
        _el(info_ad, "campoAdicional", cliente["direccion"], nombre="direccion")

    xml_str = tostring(root, encoding="unicode", xml_declaration=False)
    xml_str = '<?xml version="1.0" encoding="UTF-8"?>\n' + xml_str
    return parseString(xml_str).toprettyxml(indent="  ", encoding=None)
