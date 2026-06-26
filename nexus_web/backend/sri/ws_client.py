"""
Cliente web services SRI — Ecuador
Envío y consulta de comprobantes electrónicos
"""
import base64
from .utils import WS_URLS


def enviar_comprobante(xml_firmado: str, ambiente: str = "1") -> dict:
    """
    Envía un comprobante firmado al SRI (recepción).
    Retorna: {recibido, estado, mensajes}

    Requiere: pip install zeep
    """
    try:
        from zeep import Client
        from zeep.exceptions import Fault
    except ImportError:
        raise ImportError(
            "Falta la librería 'zeep' para web services SRI. "
            "Ejecute: pip install zeep"
        )

    url = WS_URLS.get(ambiente, WS_URLS["1"])["recepcion"]

    try:
        xml_bytes = xml_firmado.encode("utf-8") if isinstance(xml_firmado, str) else xml_firmado
        xml_b64 = base64.b64encode(xml_bytes)

        client = Client(url)
        response = client.service.validarComprobante(xml_b64)

        estado = response.estado if hasattr(response, "estado") else "DESCONOCIDO"
        mensajes = []

        if hasattr(response, "comprobantes") and response.comprobantes:
            for comp in response.comprobantes.comprobante:
                if hasattr(comp, "mensajes") and comp.mensajes:
                    for msg in comp.mensajes.mensaje:
                        mensajes.append({
                            "tipo":           getattr(msg, "tipo", ""),
                            "identificador":  getattr(msg, "identificador", ""),
                            "mensaje":        getattr(msg, "mensaje", ""),
                            "informacionAdicional": getattr(msg, "informacionAdicional", ""),
                        })

        return {
            "recibido": estado == "RECIBIDA",
            "estado":   estado,
            "mensajes": mensajes,
        }

    except Fault as e:
        return {
            "recibido": False,
            "estado":   "ERROR_SOAP",
            "mensajes": [{"tipo": "ERROR", "mensaje": str(e)}],
        }
    except Exception as e:
        return {
            "recibido": False,
            "estado":   "ERROR_CONEXION",
            "mensajes": [{"tipo": "ERROR", "mensaje": f"Error de conexión: {str(e)}"}],
        }


def consultar_autorizacion(clave_acceso: str, ambiente: str = "1") -> dict:
    """
    Consulta el estado de autorización de un comprobante en el SRI.
    Retorna: {autorizado, estado, numero_autorizacion, fecha_autorizacion, mensajes, xml_autorizado}
    """
    try:
        from zeep import Client
        from zeep.exceptions import Fault
    except ImportError:
        raise ImportError("Falta 'zeep'. Ejecute: pip install zeep")

    url = WS_URLS.get(ambiente, WS_URLS["1"])["autorizacion"]

    try:
        client = Client(url)
        response = client.service.autorizacionComprobante(clave_acceso)

        if not hasattr(response, "autorizaciones") or not response.autorizaciones:
            return {
                "autorizado": False,
                "estado": "NO_ENCONTRADO",
                "numero_autorizacion": None,
                "fecha_autorizacion": None,
                "mensajes": [{"tipo": "INFO", "mensaje": "Comprobante no encontrado en SRI"}],
                "xml_autorizado": None,
            }

        autorizaciones = response.autorizaciones.autorizacion
        if not autorizaciones:
            return {
                "autorizado": False,
                "estado": "SIN_AUTORIZACION",
                "numero_autorizacion": None,
                "fecha_autorizacion": None,
                "mensajes": [],
                "xml_autorizado": None,
            }

        aut = autorizaciones[0] if isinstance(autorizaciones, list) else autorizaciones
        estado = getattr(aut, "estado", "DESCONOCIDO")
        num_aut = getattr(aut, "numeroAutorizacion", None)
        fecha_aut = getattr(aut, "fechaAutorizacion", None)
        xml_aut = getattr(aut, "comprobante", None)

        mensajes = []
        if hasattr(aut, "mensajes") and aut.mensajes:
            for msg in aut.mensajes.mensaje:
                mensajes.append({
                    "tipo":           getattr(msg, "tipo", ""),
                    "identificador":  getattr(msg, "identificador", ""),
                    "mensaje":        getattr(msg, "mensaje", ""),
                    "informacionAdicional": getattr(msg, "informacionAdicional", ""),
                })

        return {
            "autorizado":           estado == "AUTORIZADO",
            "estado":               estado,
            "numero_autorizacion":  num_aut,
            "fecha_autorizacion":   str(fecha_aut) if fecha_aut else None,
            "mensajes":             mensajes,
            "xml_autorizado":       xml_aut,
        }

    except Fault as e:
        return {
            "autorizado": False,
            "estado": "ERROR_SOAP",
            "numero_autorizacion": None,
            "fecha_autorizacion": None,
            "mensajes": [{"tipo": "ERROR", "mensaje": str(e)}],
            "xml_autorizado": None,
        }
    except Exception as e:
        return {
            "autorizado": False,
            "estado": "ERROR_CONEXION",
            "numero_autorizacion": None,
            "fecha_autorizacion": None,
            "mensajes": [{"tipo": "ERROR", "mensaje": f"Error: {str(e)}"}],
            "xml_autorizado": None,
        }
