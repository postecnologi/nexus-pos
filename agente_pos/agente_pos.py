"""
NEXUS POS — Agente Local de Terminal de Pago
============================================
Este script se instala en el PC del cajero.
Se conecta al sistema NEXUS en la nube y al pinpad físico por TCP.

Uso:
    python agente_pos.py

Configuración:
    Edita el archivo config.json en la misma carpeta.

Requisitos:
    pip install requests

Procesadores soportados:
    - DATAFAST  (Banco del Austro, Bolivariano, Internacional, etc.)
    - MEDIANET  (Banco Pichincha)
"""

import socket
import json
import time
import logging
import os
import sys
from datetime import datetime

try:
    import requests
except ImportError:
    print("Instala requests: pip install requests")
    sys.exit(1)


# ── Configuración ──────────────────────────────────────────────
CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")

CONFIG_DEFAULT = {
    "nexus_url": "https://api.pos-tecnologi.com/api",
    "terminal_id": 1,
    "usuario": "admin",
    "password": "admin123",
    "pinpad_ip": "127.0.0.1",
    "pinpad_puerto": 2020,
    "procesador": "DATAFAST",
    "polling_segundos": 2,
    "timeout_pinpad": 120
}

def cargar_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            return {**CONFIG_DEFAULT, **json.load(f)}
    else:
        with open(CONFIG_FILE, "w") as f:
            json.dump(CONFIG_DEFAULT, f, indent=2)
        print(f"✅ Archivo de config creado: {CONFIG_FILE}")
        print("   Edita config.json con los datos de tu terminal antes de continuar.")
        input("Presiona Enter cuando hayas configurado...")
        return cargar_config()

# ── Logging ────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("agente_pos.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)
log = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════
#  PROTOCOLOS DE PINPAD
# ══════════════════════════════════════════════════════════════

class ProtocoloDatafast:
    """
    Protocolo para terminales Datafast (PC-POS / Agente Integrador Datafast).
    Datafast instala un software en el PC que actúa como puente al pinpad.
    La comunicación es via TCP a localhost:PUERTO.

    NOTA: Este protocolo es una implementación de referencia.
    Datafast entrega la documentación técnica oficial al contratar el servicio.
    Solicitar en: integraciones@datafast.com.ec
    """

    @staticmethod
    def construir_mensaje(transaccion: dict) -> bytes:
        """
        Construye el mensaje de solicitud de pago para Datafast.
        Formato basado en el protocolo Datafast PC-POS v2.
        """
        monto_centavos = int(float(transaccion["monto"]) * 100)

        # Tipo de diferido
        diferido_tipo = transaccion.get("diferido_tipo") or ""
        cuotas = int(transaccion.get("diferido_cuotas") or 0)

        # Código de diferido Datafast:
        # 0 = Contado
        # 1 = CIB (Con Intereses del Banco)
        # 2 = Sin intereses (MSI)
        if cuotas > 0 and diferido_tipo == "CIB":
            cod_diferido = "1"
        elif cuotas > 0 and diferido_tipo == "MSI":
            cod_diferido = "2"
        else:
            cod_diferido = "0"
            cuotas = 0

        mensaje = {
            "TipoTransaccion": "VENTA",
            "Monto": str(monto_centavos).zfill(12),
            "Moneda": "840",          # 840 = USD
            "Diferido": cod_diferido,
            "NumeroCuotas": str(cuotas).zfill(2),
            "TipoTarjeta": "CREDITO", # CREDITO o DEBITO
            "IDTransaccion": str(transaccion["id"]),
        }

        payload = json.dumps(mensaje)
        # Datafast usa longitud fija como header: 4 bytes con el tamaño
        header = len(payload).to_bytes(4, byteorder='big')
        return header + payload.encode("ascii")

    @staticmethod
    def parsear_respuesta(datos: bytes) -> dict:
        """Parsea la respuesta del pinpad Datafast."""
        try:
            # Saltar los primeros 4 bytes de header de longitud
            payload = datos[4:].decode("ascii").strip()
            resp = json.loads(payload)
            codigo = resp.get("CodigoRespuesta", "99")
            aprobado = codigo == "00"
            return {
                "aprobado": aprobado,
                "codigo_respuesta": codigo,
                "codigo_autorizacion": resp.get("CodigoAutorizacion", ""),
                "mensaje_respuesta": resp.get("MensajeRespuesta", "RECHAZADO"),
                "tarjeta_ultimos4": resp.get("UltimosDigitos", ""),
                "tarjeta_tipo": resp.get("TipoTarjeta", ""),
                "lote": resp.get("NumeroLote", ""),
            }
        except Exception as e:
            return {
                "aprobado": False,
                "codigo_respuesta": "99",
                "mensaje_respuesta": f"Error parseando respuesta: {str(e)}",
                "codigo_autorizacion": "", "tarjeta_ultimos4": "",
                "tarjeta_tipo": "", "lote": "",
            }


class ProtocoloMedianet:
    """
    Protocolo para terminales Medianet (Banco Pichincha — POS Mediager).
    Medianet instala su software "Mediager" en el PC del cajero.
    Comunicación TCP a localhost:PUERTO.

    NOTA: Protocolo de referencia.
    Solicitar documentación técnica oficial a Banco Pichincha / Medianet.
    Contacto: soporte_pos@pichincha.com
    """

    STX = b'\x02'  # Start of Text
    ETX = b'\x03'  # End of Text
    FS  = b'\x1C'  # Field Separator

    @classmethod
    def construir_mensaje(cls, transaccion: dict) -> bytes:
        """Construye mensaje para el protocolo Medianet/Mediager."""
        monto = f"{float(transaccion['monto']):.2f}"

        diferido_tipo = transaccion.get("diferido_tipo") or ""
        cuotas = int(transaccion.get("diferido_cuotas") or 0)

        # Medianet: tipo pago 01=contado, 02=diferido CIB, 03=diferido sin intereses
        if cuotas > 0 and diferido_tipo == "CIB":
            tipo_pago = "02"
        elif cuotas > 0 and diferido_tipo == "MSI":
            tipo_pago = "03"
        else:
            tipo_pago = "01"
            cuotas = 0

        campos = [
            "0200",                    # Tipo mensaje: solicitud de venta
            monto,                     # Monto
            "840",                     # Moneda USD
            tipo_pago,                 # Tipo de pago
            str(cuotas).zfill(2),      # Número de cuotas
            str(transaccion["id"]),    # Referencia local
            "00",                      # Tipo tarjeta (00=cualquiera)
        ]

        cuerpo = cls.FS.join(c.encode("ascii") for c in campos)
        return cls.STX + cuerpo + cls.ETX

    @classmethod
    def parsear_respuesta(cls, datos: bytes) -> dict:
        """Parsea la respuesta del protocolo Medianet."""
        try:
            # Remover STX y ETX
            if datos.startswith(cls.STX): datos = datos[1:]
            if datos.endswith(cls.ETX): datos = datos[:-1]

            campos = datos.split(cls.FS)
            campos = [c.decode("ascii", errors="replace").strip() for c in campos]

            # Posiciones según protocolo Medianet (referencia)
            # [0]=tipo_resp [1]=codigo [2]=autorizacion [3]=monto [4]=tarjeta [5]=tipo [6]=lote
            codigo = campos[1] if len(campos) > 1 else "99"
            aprobado = codigo == "00"

            return {
                "aprobado": aprobado,
                "codigo_respuesta": codigo,
                "codigo_autorizacion": campos[2] if len(campos) > 2 else "",
                "mensaje_respuesta": "APROBADO" if aprobado else "RECHAZADO",
                "tarjeta_ultimos4": (campos[4][-4:] if len(campos) > 4 and campos[4] else ""),
                "tarjeta_tipo": campos[5] if len(campos) > 5 else "",
                "lote": campos[6] if len(campos) > 6 else "",
            }
        except Exception as e:
            return {
                "aprobado": False, "codigo_respuesta": "99",
                "mensaje_respuesta": f"Error: {str(e)}",
                "codigo_autorizacion": "", "tarjeta_ultimos4": "",
                "tarjeta_tipo": "", "lote": "",
            }


PROTOCOLOS = {
    "DATAFAST": ProtocoloDatafast,
    "MEDIANET": ProtocoloMedianet,
}


# ══════════════════════════════════════════════════════════════
#  COMUNICACIÓN CON EL PINPAD
# ══════════════════════════════════════════════════════════════

def enviar_a_pinpad(config: dict, transaccion: dict) -> dict:
    """Envía la transacción al pinpad físico y espera respuesta."""
    procesador = transaccion.get("procesador", config["procesador"])
    protocolo  = PROTOCOLOS.get(procesador)

    if not protocolo:
        return {"aprobado": False, "mensaje_respuesta": f"Procesador {procesador} no soportado",
                "codigo_respuesta": "99", "codigo_autorizacion": "",
                "tarjeta_ultimos4": "", "tarjeta_tipo": "", "lote": ""}

    mensaje = protocolo.construir_mensaje(transaccion)

    log.info(f"Enviando ${transaccion['monto']} al pinpad {config['pinpad_ip']}:{config['pinpad_puerto']}")
    log.info(f"Diferido: {transaccion.get('diferido_tipo')} x{transaccion.get('diferido_cuotas')} cuotas")

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(config["timeout_pinpad"])
        sock.connect((config["pinpad_ip"], config["pinpad_puerto"]))
        sock.sendall(mensaje)

        # Esperar respuesta (hasta timeout_pinpad segundos — el cliente tiene tiempo de pagar)
        respuesta = b""
        while True:
            chunk = sock.recv(4096)
            if not chunk:
                break
            respuesta += chunk
            # Para Medianet: termina con ETX
            if procesador == "MEDIANET" and b'\x03' in respuesta:
                break
            # Para Datafast: verificar longitud del header
            if procesador == "DATAFAST" and len(respuesta) >= 4:
                longitud = int.from_bytes(respuesta[:4], 'big')
                if len(respuesta) >= longitud + 4:
                    break

        sock.close()
        resultado = protocolo.parsear_respuesta(respuesta)
        log.info(f"Respuesta pinpad: {'APROBADO' if resultado['aprobado'] else 'RECHAZADO'} - {resultado.get('codigo_autorizacion','')}")
        return resultado

    except socket.timeout:
        log.warning("Timeout esperando respuesta del pinpad")
        return {"aprobado": False, "codigo_respuesta": "TO",
                "mensaje_respuesta": "Tiempo de espera agotado — el cliente no pagó",
                "codigo_autorizacion": "", "tarjeta_ultimos4": "", "tarjeta_tipo": "", "lote": ""}
    except ConnectionRefusedError:
        log.error(f"No se pudo conectar al pinpad en {config['pinpad_ip']}:{config['pinpad_puerto']}")
        return {"aprobado": False, "codigo_respuesta": "CN",
                "mensaje_respuesta": "No se pudo conectar al pinpad. Verifica que el software del terminal esté abierto.",
                "codigo_autorizacion": "", "tarjeta_ultimos4": "", "tarjeta_tipo": "", "lote": ""}
    except Exception as e:
        log.error(f"Error comunicando con pinpad: {e}")
        return {"aprobado": False, "codigo_respuesta": "ER",
                "mensaje_respuesta": str(e)[:200],
                "codigo_autorizacion": "", "tarjeta_ultimos4": "", "tarjeta_tipo": "", "lote": ""}


# ══════════════════════════════════════════════════════════════
#  COMUNICACIÓN CON EL VPS (NEXUS)
# ══════════════════════════════════════════════════════════════

class ClienteNexus:
    def __init__(self, config: dict):
        self.base = config["nexus_url"].rstrip("/")
        self.terminal_id = config["terminal_id"]
        self.token = None
        self.config = config

    def login(self) -> bool:
        try:
            r = requests.post(f"{self.base}/auth/login",
                data={"username": self.config["usuario"], "password": self.config["password"]},
                timeout=10)
            if r.status_code == 200:
                self.token = r.json().get("access_token")
                log.info("✅ Conectado a NEXUS")
                return True
            log.error(f"Login fallido: {r.text[:100]}")
            return False
        except Exception as e:
            log.error(f"Error conectando a NEXUS: {e}")
            return False

    def headers(self):
        return {"Authorization": f"Bearer {self.token}"}

    def get_pendiente(self) -> dict:
        try:
            r = requests.get(f"{self.base}/pos/agente/pendientes",
                params={"terminal_id": self.terminal_id},
                headers=self.headers(), timeout=10)
            if r.status_code == 401:
                self.login()
                return {}
            if r.status_code == 200:
                return r.json()
            return {}
        except Exception:
            return {}

    def reportar_resultado(self, transaccion_id: int, resultado: dict):
        try:
            requests.post(f"{self.base}/pos/agente/respuesta",
                json={**resultado, "transaccion_id": transaccion_id},
                headers=self.headers(), timeout=10)
        except Exception as e:
            log.error(f"Error reportando resultado: {e}")

    def heartbeat(self):
        try:
            requests.post(f"{self.base}/pos/agente/heartbeat",
                json={"terminal_id": self.terminal_id},
                headers=self.headers(), timeout=5)
        except Exception:
            pass


# ══════════════════════════════════════════════════════════════
#  BUCLE PRINCIPAL
# ══════════════════════════════════════════════════════════════

def main():
    print("=" * 55)
    print("  NEXUS POS — Agente de Terminal de Pago")
    print("=" * 55)

    config = cargar_config()
    cliente = ClienteNexus(config)

    log.info(f"Terminal ID: {config['terminal_id']}")
    log.info(f"Procesador: {config['procesador']}")
    log.info(f"Pinpad: {config['pinpad_ip']}:{config['pinpad_puerto']}")
    log.info(f"NEXUS: {config['nexus_url']}")

    if not cliente.login():
        log.error("No se pudo conectar a NEXUS. Verifica usuario/contraseña y URL.")
        input("Presiona Enter para salir...")
        return

    log.info(f"✅ Agente activo — polling cada {config['polling_segundos']}s")
    log.info("Esperando transacciones del sistema...")

    heartbeat_counter = 0

    while True:
        try:
            pendiente = cliente.get_pendiente()

            if pendiente and pendiente.get("id"):
                tid = pendiente["id"]
                monto = pendiente.get("monto", 0)
                diferido = pendiente.get("diferido_tipo") or "Contado"
                cuotas = pendiente.get("diferido_cuotas") or 0

                log.info(f"━━━ Nueva transacción #{tid} ━━━")
                log.info(f"    Monto: ${monto}")
                log.info(f"    Pago: {'Contado' if not cuotas else f'{diferido} {cuotas} cuotas'}")
                log.info(f"    Enviando al pinpad...")

                resultado = enviar_a_pinpad(config, pendiente)
                cliente.reportar_resultado(tid, resultado)

                if resultado["aprobado"]:
                    log.info(f"✅ APROBADO — Auth: {resultado.get('codigo_autorizacion')}")
                else:
                    log.warning(f"❌ RECHAZADO — {resultado.get('mensaje_respuesta')}")

            # Heartbeat cada 30 polls
            heartbeat_counter += 1
            if heartbeat_counter >= 30:
                cliente.heartbeat()
                heartbeat_counter = 0

        except KeyboardInterrupt:
            log.info("Agente detenido por el usuario.")
            break
        except Exception as e:
            log.error(f"Error inesperado: {e}")

        time.sleep(config["polling_segundos"])


if __name__ == "__main__":
    main()
