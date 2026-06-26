"""
Utilidades SRI — Ecuador
Mapeos, clave de acceso, validaciones
"""

# Tipos de documento electrónico SRI
TIPO_DOC = {
    "FACTURA":       "01",
    "LIQUIDACION":   "03",
    "NOTA_CREDITO":  "04",
    "NOTA_DEBITO":   "05",
    "GUIA_REMISION": "06",
    "RETENCION":     "07",
}

# Mapeo tipo_identificacion texto → código SRI
TIPO_ID_SRI = {
    "RUC":              "04",
    "CEDULA":           "05",
    "CÉDULA":           "05",
    "PASAPORTE":        "06",
    "CONSUMIDOR_FINAL": "07",
    "IDENTIFICACION_EXTERIOR": "08",
}

# Mapeo forma de pago → código SRI
FORMA_PAGO_SRI = {
    "EFECTIVO":          "01",
    "CHEQUE":            "20",
    "TRANSFERENCIA":     "20",
    "TARJETA_DEBITO":    "16",
    "TARJETA":           "19",
    "TARJETA_CREDITO":   "19",
    "DINERO_ELECTRONICO":"17",
    "MEDIANET":          "17",
    "DEUNA":             "17",
    "CREDITO":           "01",
    "OTROS":             "20",
}

# Códigos IVA SRI
CODIGO_IVA = {
    0:    {"codigo": "0", "codigo_porcentaje": "0", "tarifa": 0},
    5:    {"codigo": "2", "codigo_porcentaje": "5", "tarifa": 5},
    12:   {"codigo": "2", "codigo_porcentaje": "2", "tarifa": 12},
    13:   {"codigo": "2", "codigo_porcentaje": "10","tarifa": 13},
    14:   {"codigo": "2", "codigo_porcentaje": "3", "tarifa": 14},
    15:   {"codigo": "2", "codigo_porcentaje": "4", "tarifa": 15},
}

# Tipos de ambiente SRI
AMBIENTE = {
    "1": "PRUEBAS",
    "2": "PRODUCCION",
}

# URLs web services SRI
WS_URLS = {
    "1": {  # Pruebas
        "recepcion":    "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl",
        "autorizacion": "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl",
    },
    "2": {  # Producción
        "recepcion":    "https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl",
        "autorizacion": "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl",
    },
}


def tipo_id_a_codigo_sri(tipo_texto: str) -> str:
    return TIPO_ID_SRI.get(tipo_texto.upper().strip(), "07")


def forma_pago_a_codigo_sri(forma: str) -> str:
    return FORMA_PAGO_SRI.get(forma.upper().strip(), "20")


def codigo_iva_sri(porcentaje: float) -> dict:
    pct = int(porcentaje)
    return CODIGO_IVA.get(pct, CODIGO_IVA[15])


def generar_clave_acceso(
    fecha_emision: str,
    tipo_comprobante: str,
    ruc: str,
    ambiente: str,
    serie: str,
    secuencial: int,
    codigo_numerico: str,
    tipo_emision: str = "1",
) -> str:
    """
    Genera la clave de acceso de 49 dígitos según ficha técnica SRI.
    fecha_emision: formato ddmmaaaa (8 dígitos)
    tipo_comprobante: 01, 03, 04, 05, 06, 07
    ruc: 13 dígitos
    ambiente: 1=pruebas, 2=producción
    serie: 6 dígitos (establecimiento + punto emisión)
    secuencial: número secuencial
    codigo_numerico: 8 dígitos
    tipo_emision: 1=normal
    """
    fecha8  = fecha_emision[:8].zfill(8)
    tipo2   = tipo_comprobante[:2].zfill(2)
    ruc13   = ruc[:13].zfill(13)
    amb1    = ambiente[:1]
    serie6  = serie[:6].zfill(6)
    seq9    = str(secuencial).zfill(9)
    cod8    = codigo_numerico[:8].zfill(8)
    temis1  = tipo_emision[:1]

    clave48 = f"{fecha8}{tipo2}{ruc13}{amb1}{serie6}{seq9}{cod8}{temis1}"

    if len(clave48) != 48:
        raise ValueError(f"Clave base debe ser 48 dígitos, tiene {len(clave48)}")

    # Dígito verificador módulo 11
    factores = [2, 3, 4, 5, 6, 7] * 8
    suma = sum(int(c) * f for c, f in zip(reversed(clave48), factores))
    residuo = suma % 11
    dv = 11 - residuo
    if dv == 11:
        dv = 0
    elif dv == 10:
        dv = 1

    return clave48 + str(dv)


def validar_ruc(ruc: str) -> bool:
    if not ruc or len(ruc) != 13:
        return False
    if not ruc.isdigit():
        return False
    provincia = int(ruc[:2])
    if provincia < 1 or provincia > 24:
        return False
    return True


def validar_cedula(cedula: str) -> bool:
    if not cedula or len(cedula) != 10:
        return False
    if not cedula.isdigit():
        return False
    provincia = int(cedula[:2])
    if provincia < 1 or provincia > 24:
        return False
    coefs = [2, 1, 2, 1, 2, 1, 2, 1, 2]
    total = 0
    for i in range(9):
        val = int(cedula[i]) * coefs[i]
        if val >= 10:
            val -= 9
        total += val
    verificador = (10 - (total % 10)) % 10
    return verificador == int(cedula[9])
