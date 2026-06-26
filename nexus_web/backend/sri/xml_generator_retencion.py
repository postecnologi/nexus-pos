"""
Generador de XML para Comprobante de Retención (tipo 07) — SRI Ecuador
Basado en ficha técnica SRI versión 2.0.0
"""
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom.minidom import parseString
from .utils import (
    tipo_id_a_codigo_sri, generar_clave_acceso, TIPO_DOC,
)


def _el(parent, tag, text=None, **attrs):
    e = SubElement(parent, tag, **attrs)
    if text is not None:
        e.text = str(text)
    return e


def generar_xml_retencion(retencion: dict, empresa: dict, sucursal: dict,
                          detalles: list, doc_sustento: dict = None) -> str:
    """
    Genera el XML de un comprobante de retención según esquema SRI tipo 07.
    Retorna el XML como string UTF-8.
    """
    ambiente   = empresa.get("ambiente_sri") or "1"
    ruc        = empresa.get("ruc") or ""
    cod_est    = (sucursal or {}).get("codigo_establecimiento") or "001"
    pto_emis   = (sucursal or {}).get("punto_emision") or "001"
    serie6     = f"{cod_est}{pto_emis}"[:6].zfill(6)

    # Extraer secuencial del número
    numero_ret = retencion.get("numero") or "001-001-000000001"
    partes_num = numero_ret.split("-")
    seq = int(partes_num[2]) if len(partes_num) == 3 else 1

    # Fecha
    fecha_raw = retencion.get("fecha_emision")
    if hasattr(fecha_raw, "strftime"):
        fecha_ddmmaaaa = fecha_raw.strftime("%d%m%Y")
        fecha_slash    = fecha_raw.strftime("%d/%m/%Y")
    else:
        partes = str(fecha_raw)[:10].split("-")
        fecha_ddmmaaaa = f"{partes[2]}{partes[1]}{partes[0]}" if len(partes) == 3 else "01012026"
        fecha_slash    = f"{partes[2]}/{partes[1]}/{partes[0]}" if len(partes) == 3 else "01/01/2026"

    cod_numerico = str(retencion.get("id", 1)).zfill(8)[-8:]

    clave = retencion.get("clave_acceso") or generar_clave_acceso(
        fecha_ddmmaaaa, TIPO_DOC["RETENCION"], ruc, ambiente,
        serie6, seq, cod_numerico
    )

    # Periodo fiscal MM/AAAA
    pf = retencion.get("periodo_fiscal") or ""
    if pf and len(pf) >= 7:
        periodo_fiscal = f"{pf[5:7]}/{pf[:4]}"
    else:
        periodo_fiscal = f"{fecha_slash[3:5]}/{fecha_slash[6:10]}" if len(fecha_slash) >= 10 else "01/2026"

    root = Element("comprobanteRetencion", id="comprobante", version="2.0.0")

    # ── infoTributaria ──
    it = _el(root, "infoTributaria")
    _el(it, "ambiente", ambiente)
    _el(it, "tipoEmision", "1")
    _el(it, "razonSocial", empresa.get("razon_social", ""))
    if empresa.get("nombre_comercial"):
        _el(it, "nombreComercial", empresa["nombre_comercial"])
    _el(it, "ruc", ruc)
    _el(it, "claveAcceso", clave)
    _el(it, "codDoc", TIPO_DOC["RETENCION"])  # "07"
    _el(it, "estab", cod_est)
    _el(it, "ptoEmi", pto_emis)
    _el(it, "secuencial", str(seq).zfill(9))
    _el(it, "dirMatriz", empresa.get("direccion") or "S/N")

    # ── infoCompRetencion ──
    icr = _el(root, "infoCompRetencion")
    _el(icr, "fechaEmision", fecha_slash)

    dir_est = (sucursal or {}).get("direccion") or empresa.get("direccion") or "S/N"
    _el(icr, "dirEstablecimiento", dir_est)

    if empresa.get("contribuyente_especial"):
        _el(icr, "contribuyenteEspecial", empresa["contribuyente_especial"])

    _el(icr, "obligadoContabilidad",
        "SI" if empresa.get("obligado_contabilidad") else "NO")

    # Sujeto retenido
    tipo_id = tipo_id_a_codigo_sri(retencion.get("sujeto_tipo_id") or "RUC")
    _el(icr, "tipoIdentificacionSujetoRetenido", tipo_id)
    _el(icr, "razonSocialSujetoRetenido", retencion.get("sujeto_razon") or "")
    _el(icr, "identificacionSujetoRetenido", retencion.get("sujeto_ruc") or "")
    _el(icr, "periodoFiscal", periodo_fiscal)

    # ── docsSustento > docSustento ──
    docs = _el(root, "docsSustento")
    doc_s = _el(docs, "docSustento")
    _el(doc_s, "codSustento", "01")  # 01 = Factura

    # Documento sustento info
    if doc_sustento:
        num_doc = doc_sustento.get("num_documento") or ""
        # Quitar prefijo C- si existe
        if num_doc.startswith("C-"):
            num_doc = num_doc[2:]
        _el(doc_s, "numDocSustento", num_doc.replace("-", ""))

        fecha_doc = doc_sustento.get("fecha")
        if hasattr(fecha_doc, "strftime"):
            _el(doc_s, "fechaEmisionDocSustento", fecha_doc.strftime("%d/%m/%Y"))
        elif fecha_doc:
            p = str(fecha_doc)[:10].split("-")
            _el(doc_s, "fechaEmisionDocSustento",
                f"{p[2]}/{p[1]}/{p[0]}" if len(p) == 3 else "")
    else:
        _el(doc_s, "numDocSustento", "000000000")
        _el(doc_s, "fechaEmisionDocSustento", fecha_slash)

    # ── retenciones > retencion (dentro de docSustento) ──
    rets_el = _el(doc_s, "retenciones")
    for d in detalles:
        ret = _el(rets_el, "retencion")
        # codigo: 1=renta, 2=iva
        tipo_imp = str(d.get("tipo_impuesto", "")).upper()
        if tipo_imp == "IVA":
            _el(ret, "codigo", "2")
        else:
            _el(ret, "codigo", "1")
        _el(ret, "codigoRetencion", str(d.get("codigo_retencion", "")))
        _el(ret, "baseImponible", f"{float(d.get('base_imponible', 0)):.2f}")
        _el(ret, "porcentajeRetener", f"{float(d.get('porcentaje', 0)):.2f}")
        _el(ret, "valorRetenido", f"{float(d.get('valor_retenido', 0)):.2f}")

    # ── infoAdicional ──
    info_ad = _el(root, "infoAdicional")
    if retencion.get("observaciones"):
        _el(info_ad, "campoAdicional", retencion["observaciones"], nombre="observaciones")

    xml_str = tostring(root, encoding="unicode", xml_declaration=False)
    xml_str = '<?xml version="1.0" encoding="UTF-8"?>\n' + xml_str
    return parseString(xml_str).toprettyxml(indent="  ", encoding=None)
