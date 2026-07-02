"""
NEXUS POS — Agente de Terminal de Pago
Versión 1.0
"""
import socket, json, time, logging, os, sys, winreg, subprocess
from datetime import datetime

try:
    import requests
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests", "-q"])
    import requests

# ── Rutas ──────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(sys.argv[0]))
CONFIG_FILE = os.path.join(BASE_DIR, "config.json")
LOG_FILE    = os.path.join(BASE_DIR, "agente_nexus.log")

# URL del sistema — ya configurada, el cliente no la toca
NEXUS_URL_DEFAULT = "https://api.pos-tecnologi.com/api"

# ── Logging ────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)
log = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════
#  CONFIGURACIÓN INTERACTIVA (primera ejecución)
# ══════════════════════════════════════════════════════════════

def limpiar():
    os.system("cls" if os.name == "nt" else "clear")

def titulo(texto):
    print("\n" + "═" * 55)
    print(f"  {texto}")
    print("═" * 55)

def pedir(pregunta, default="", requerido=True):
    while True:
        if default:
            entrada = input(f"  {pregunta} [{default}]: ").strip()
            valor = entrada if entrada else default
        else:
            entrada = input(f"  {pregunta}: ").strip()
            valor = entrada
        if valor or not requerido:
            return valor
        print("  ⚠️  Este campo es obligatorio.")

def pedir_opcion(pregunta, opciones):
    """Muestra opciones numeradas y retorna el valor elegido."""
    print(f"\n  {pregunta}")
    for i, (val, label) in enumerate(opciones, 1):
        print(f"    [{i}] {label}")
    while True:
        entrada = input("  Opción: ").strip()
        if entrada.isdigit() and 1 <= int(entrada) <= len(opciones):
            return opciones[int(entrada)-1][0]
        print("  ⚠️  Ingresa un número válido.")

def asistente_configuracion():
    """Guía al usuario paso a paso para configurar el agente."""
    limpiar()
    print()
    print("  ╔═══════════════════════════════════════════════╗")
    print("  ║        NEXUS POS — Agente de Terminal         ║")
    print("  ║          Configuración inicial                ║")
    print("  ╚═══════════════════════════════════════════════╝")
    print()
    print("  Este asistente configura la conexión entre el sistema")
    print("  NEXUS y el terminal de pago (pinpad) de esta caja.")
    print()
    input("  Presiona Enter para continuar...")

    # ── Paso 1: Datos de acceso ───────────────────────────────
    limpiar()
    titulo("PASO 1 DE 3 — Datos de acceso al sistema NEXUS")
    print()
    print("  El sistema ya está configurado para conectarse a:")
    print(f"  🌐  {NEXUS_URL_DEFAULT}")
    print()
    print("  Ingresa los datos de acceso de tu empresa:")
    print()
    empresa_codigo = pedir("Código de empresa (te lo dio NEXUS al registrarte, ej: FARMACIABC)")
    usuario        = pedir("Usuario", "admin")
    password       = pedir("Contraseña")

    # Verificar credenciales
    print()
    print("  Verificando credenciales...", end="", flush=True)
    try:
        r = requests.post(f"{NEXUS_URL_DEFAULT}/auth/login",
            data={"username": usuario, "password": password,
                  "empresa_codigo": empresa_codigo}, timeout=10)
        if r.status_code == 200:
            token = r.json().get("access_token")
            empresa_nombre = r.json().get("empresa_nombre", empresa_codigo)
            print(f" ✅ Conectado — {empresa_nombre}")
        else:
            detalle = ""
            try: detalle = r.json().get("detail","")
            except: pass
            print(f" ❌ Error")
            print(f"\n  {detalle or 'Datos incorrectos. Verifica código de empresa, usuario y contraseña.'}")
            input("\n  Presiona Enter para salir...")
            return None
    except Exception as e:
        print(f" ❌ Error de conexión")
        print(f"\n  No se pudo conectar al servidor.")
        print(f"  Verifica que tengas internet activo.")
        input("\n  Presiona Enter para salir...")
        return None

    # ── Paso 2: Terminal asignado ─────────────────────────────
    limpiar()
    titulo("PASO 2 DE 3 — Terminal de pago asignado a esta caja")
    print()

    # Obtener terminales del sistema
    try:
        res = requests.get(f"{NEXUS_URL_DEFAULT}/pos/terminales",
            headers={"Authorization": f"Bearer {token}"}, timeout=10)
        terminales = res.json() if res.status_code == 200 else []
    except Exception:
        terminales = []

    terminal_id = None
    procesador  = "DATAFAST"

    if terminales:
        print("  Terminales registrados en el sistema:")
        print()
        opciones = [(str(t["id"]), f"{t['nombre']} — {t['procesador']} · {t.get('caja_nombre') or t.get('sucursal_nombre','Sin asignar')}") for t in terminales]
        opciones.append(("0", "Ingresar ID manualmente"))
        sel = pedir_opcion("¿Cuál terminal corresponde a este PC?", opciones)
        if sel == "0":
            terminal_id = int(pedir("ID del terminal (ver en Configuración → Terminales POS)"))
        else:
            terminal_id = int(sel)
            t_sel = next((t for t in terminales if t["id"] == terminal_id), None)
            if t_sel:
                procesador = t_sel.get("procesador", "DATAFAST")
    else:
        print("  No se encontraron terminales en el sistema.")
        print("  Primero créalo en: Sistema → Configuración → Terminales POS")
        print()
        terminal_id = int(pedir("ID del terminal"))
        procesador = pedir_opcion("Procesador de pago:", [
            ("DATAFAST", "Datafast (Banco del Austro, Bolivariano, Internacional, etc.)"),
            ("MEDIANET", "Medianet (Banco Pichincha)"),
        ])

    # ── Paso 3: Datos del pinpad ──────────────────────────────
    limpiar()
    titulo("PASO 3 DE 3 — Datos del pinpad físico")
    print()
    print("  El software del terminal (Datafast o Medianet) debe")
    print("  estar instalado y abierto en este mismo PC.")
    print()

    print("  ¿Dónde está instalado el software del terminal?")
    ubicacion = pedir_opcion("Ubicación:", [
        ("local", "En este mismo PC (127.0.0.1) — lo más común"),
        ("red",   "En otro PC de la red (ingresar IP manualmente)"),
    ])

    if ubicacion == "local":
        pinpad_ip = "127.0.0.1"
    else:
        pinpad_ip = pedir("IP del PC con el software del terminal (ej: 192.168.1.10)")

    puerto_default = "2020" if procesador == "DATAFAST" else "3000"
    pinpad_puerto  = int(pedir("Puerto del terminal", puerto_default))

    # ── Resumen ───────────────────────────────────────────────
    limpiar()
    titulo("✅ Configuración lista — Resumen")
    print()
    print(f"  🌐  Sistema NEXUS:  {NEXUS_URL_DEFAULT}")
    print(f"  👤  Usuario:        {usuario}")
    print(f"  🖥️   Terminal ID:    {terminal_id}")
    print(f"  💳  Procesador:     {procesador}")
    print(f"  📡  Pinpad:         {pinpad_ip}:{pinpad_puerto}")
    print()

    agregar_arranque_resp = input("  ¿Iniciar automáticamente con Windows? [S/n]: ").strip().lower()
    arranque = agregar_arranque_resp != "n"

    print()
    confirmar = input("  ¿Guardar y comenzar? [S/n]: ").strip().lower()
    if confirmar == "n":
        print("  Cancelado.")
        return None

    config = {
        "nexus_url":        NEXUS_URL_DEFAULT,
        "empresa_codigo":   empresa_codigo,
        "usuario":          usuario,
        "password":         password,
        "terminal_id":      terminal_id,
        "procesador":       procesador,
        "pinpad_ip":        pinpad_ip,
        "pinpad_puerto":    pinpad_puerto,
        "polling_segundos": 2,
        "timeout_pinpad":   120,
    }

    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)

    if arranque:
        agregar_a_arranque_windows()

    print()
    print("  ✅ Configuración guardada correctamente.")
    print()
    return config


# ══════════════════════════════════════════════════════════════
#  ARRANQUE AUTOMÁTICO DE WINDOWS
# ══════════════════════════════════════════════════════════════

def agregar_a_arranque_windows():
    """Registra el agente en el arranque automático de Windows."""
    exe = os.path.abspath(sys.argv[0])
    clave = r"Software\Microsoft\Windows\CurrentVersion\Run"
    try:
        reg = winreg.OpenKey(winreg.HKEY_CURRENT_USER, clave, 0, winreg.KEY_SET_VALUE)
        winreg.SetValueEx(reg, "AgenteNexusPOS", 0, winreg.REG_SZ, f'"{exe}"')
        winreg.CloseKey(reg)
        print("  ✅ Registrado en arranque de Windows")
    except Exception as e:
        log.warning(f"No se pudo registrar en arranque de Windows: {e}")

def quitar_de_arranque_windows():
    clave = r"Software\Microsoft\Windows\CurrentVersion\Run"
    try:
        reg = winreg.OpenKey(winreg.HKEY_CURRENT_USER, clave, 0, winreg.KEY_SET_VALUE)
        winreg.DeleteValue(reg, "AgenteNexusPOS")
        winreg.CloseKey(reg)
    except Exception:
        pass


# ══════════════════════════════════════════════════════════════
#  PROTOCOLOS DE PINPAD
# ══════════════════════════════════════════════════════════════

class ProtocoloDatafast:
    @staticmethod
    def construir_mensaje(transaccion):
        monto_centavos = int(float(transaccion["monto"]) * 100)
        diferido_tipo  = transaccion.get("diferido_tipo") or ""
        cuotas         = int(transaccion.get("diferido_cuotas") or 0)
        cod_diferido   = "1" if (cuotas > 0 and diferido_tipo == "CIB") else \
                         "2" if (cuotas > 0 and diferido_tipo == "MSI") else "0"
        if cod_diferido == "0": cuotas = 0
        payload = json.dumps({
            "TipoTransaccion": "VENTA",
            "Monto":           str(monto_centavos).zfill(12),
            "Moneda":          "840",
            "Diferido":        cod_diferido,
            "NumeroCuotas":    str(cuotas).zfill(2),
            "IDTransaccion":   str(transaccion["id"]),
        })
        return len(payload).to_bytes(4, 'big') + payload.encode("ascii")

    @staticmethod
    def parsear_respuesta(datos):
        try:
            resp   = json.loads(datos[4:].decode("ascii").strip())
            codigo = resp.get("CodigoRespuesta", "99")
            return {"aprobado": codigo == "00", "codigo_respuesta": codigo,
                    "codigo_autorizacion": resp.get("CodigoAutorizacion",""),
                    "mensaje_respuesta":   resp.get("MensajeRespuesta","RECHAZADO"),
                    "tarjeta_ultimos4":    resp.get("UltimosDigitos",""),
                    "tarjeta_tipo":        resp.get("TipoTarjeta",""),
                    "lote":                resp.get("NumeroLote","")}
        except Exception as e:
            return {"aprobado": False, "codigo_respuesta": "99",
                    "mensaje_respuesta": f"Error: {e}",
                    "codigo_autorizacion":"","tarjeta_ultimos4":"","tarjeta_tipo":"","lote":""}


class ProtocoloMedianet:
    STX = b'\x02'; ETX = b'\x03'; FS = b'\x1C'

    @classmethod
    def construir_mensaje(cls, transaccion):
        monto  = f"{float(transaccion['monto']):.2f}"
        cuotas = int(transaccion.get("diferido_cuotas") or 0)
        tipo   = transaccion.get("diferido_tipo") or ""
        tp     = "02" if (cuotas > 0 and tipo == "CIB") else \
                 "03" if (cuotas > 0 and tipo == "MSI") else "01"
        if tp == "01": cuotas = 0
        campos = ["0200", monto, "840", tp, str(cuotas).zfill(2), str(transaccion["id"]), "00"]
        return cls.STX + cls.FS.join(c.encode("ascii") for c in campos) + cls.ETX

    @classmethod
    def parsear_respuesta(cls, datos):
        try:
            if datos.startswith(cls.STX): datos = datos[1:]
            if datos.endswith(cls.ETX):   datos = datos[:-1]
            campos = [c.decode("ascii", errors="replace").strip() for c in datos.split(cls.FS)]
            codigo = campos[1] if len(campos) > 1 else "99"
            return {"aprobado": codigo == "00", "codigo_respuesta": codigo,
                    "codigo_autorizacion": campos[2] if len(campos) > 2 else "",
                    "mensaje_respuesta":   "APROBADO" if codigo == "00" else "RECHAZADO",
                    "tarjeta_ultimos4":    (campos[4][-4:] if len(campos) > 4 and campos[4] else ""),
                    "tarjeta_tipo":        campos[5] if len(campos) > 5 else "",
                    "lote":                campos[6] if len(campos) > 6 else ""}
        except Exception as e:
            return {"aprobado": False, "codigo_respuesta": "99",
                    "mensaje_respuesta": str(e),
                    "codigo_autorizacion":"","tarjeta_ultimos4":"","tarjeta_tipo":"","lote":""}


PROTOCOLOS = {"DATAFAST": ProtocoloDatafast, "MEDIANET": ProtocoloMedianet}


# ══════════════════════════════════════════════════════════════
#  COMUNICACIÓN CON EL PINPAD
# ══════════════════════════════════════════════════════════════

def enviar_a_pinpad(config, transaccion):
    procesador = transaccion.get("procesador", config["procesador"])
    protocolo  = PROTOCOLOS.get(procesador)
    if not protocolo:
        return {"aprobado": False, "codigo_respuesta": "99",
                "mensaje_respuesta": f"Procesador {procesador} no soportado",
                "codigo_autorizacion":"","tarjeta_ultimos4":"","tarjeta_tipo":"","lote":""}

    mensaje = protocolo.construir_mensaje(transaccion)
    log.info(f"Enviando ${transaccion['monto']} → {config['pinpad_ip']}:{config['pinpad_puerto']}")

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(config["timeout_pinpad"])
        sock.connect((config["pinpad_ip"], config["pinpad_puerto"]))
        sock.sendall(mensaje)
        respuesta = b""
        while True:
            chunk = sock.recv(4096)
            if not chunk: break
            respuesta += chunk
            if procesador == "MEDIANET" and b'\x03' in respuesta: break
            if procesador == "DATAFAST" and len(respuesta) >= 4:
                lng = int.from_bytes(respuesta[:4], 'big')
                if len(respuesta) >= lng + 4: break
        sock.close()
        resultado = protocolo.parsear_respuesta(respuesta)
        log.info(f"{'APROBADO' if resultado['aprobado'] else 'RECHAZADO'} — auth: {resultado.get('codigo_autorizacion','')}")
        return resultado
    except socket.timeout:
        return {"aprobado": False, "codigo_respuesta": "TO",
                "mensaje_respuesta": "Tiempo de espera agotado",
                "codigo_autorizacion":"","tarjeta_ultimos4":"","tarjeta_tipo":"","lote":""}
    except ConnectionRefusedError:
        return {"aprobado": False, "codigo_respuesta": "CN",
                "mensaje_respuesta": f"No se pudo conectar al pinpad. Verifica que el software del terminal esté abierto.",
                "codigo_autorizacion":"","tarjeta_ultimos4":"","tarjeta_tipo":"","lote":""}
    except Exception as e:
        return {"aprobado": False, "codigo_respuesta": "ER",
                "mensaje_respuesta": str(e)[:200],
                "codigo_autorizacion":"","tarjeta_ultimos4":"","tarjeta_tipo":"","lote":""}


# ══════════════════════════════════════════════════════════════
#  CLIENTE NEXUS
# ══════════════════════════════════════════════════════════════

class ClienteNexus:
    def __init__(self, config):
        self.base = config["nexus_url"].rstrip("/")
        self.terminal_id = config["terminal_id"]
        self.config = config
        self.token  = None

    def login(self):
        try:
            r = requests.post(f"{self.base}/auth/login",
                data={"username":       self.config["usuario"],
                      "password":       self.config["password"],
                      "empresa_codigo": self.config.get("empresa_codigo", "")},
                timeout=10)
            if r.status_code == 200:
                self.token = r.json().get("access_token")
                return True
            log.error(f"Login rechazado: {r.text[:100]}")
        except Exception as e:
            log.error(f"Error login: {e}")
        return False

    def H(self): return {"Authorization": f"Bearer {self.token}"}

    def get_pendiente(self):
        try:
            r = requests.get(f"{self.base}/pos/agente/pendientes",
                params={"terminal_id": self.terminal_id}, headers=self.H(), timeout=10)
            if r.status_code == 401: self.login(); return {}
            return r.json() if r.status_code == 200 else {}
        except Exception: return {}

    def reportar(self, tid, resultado):
        try:
            requests.post(f"{self.base}/pos/agente/respuesta",
                json={**resultado, "transaccion_id": tid}, headers=self.H(), timeout=10)
        except Exception as e:
            log.error(f"Error reportando: {e}")

    def heartbeat(self):
        try:
            requests.post(f"{self.base}/pos/agente/heartbeat",
                json={"terminal_id": self.terminal_id}, headers=self.H(), timeout=5)
        except Exception: pass


# ══════════════════════════════════════════════════════════════
#  MENÚ PRINCIPAL
# ══════════════════════════════════════════════════════════════

def menu_principal(config):
    limpiar()
    print()
    print("  ╔═══════════════════════════════════════════════╗")
    print("  ║        NEXUS POS — Agente de Terminal         ║")
    print("  ╚═══════════════════════════════════════════════╝")
    print()
    print(f"  Empresa     : {config.get('empresa_codigo','—')}")
    print(f"  Usuario     : {config.get('usuario','—')}")
    print(f"  Terminal ID : {config['terminal_id']}")
    print(f"  Procesador  : {config['procesador']}")
    print(f"  Pinpad      : {config['pinpad_ip']}:{config['pinpad_puerto']}")
    print()
    print("  [1] Iniciar agente")
    print("  [2] Reconfigurar")
    print("  [3] Agregar a arranque de Windows")
    print("  [4] Quitar de arranque de Windows")
    print("  [5] Salir")
    print()
    return input("  Opción: ").strip()


# ══════════════════════════════════════════════════════════════
#  BUCLE PRINCIPAL DEL AGENTE
# ══════════════════════════════════════════════════════════════

def ejecutar_agente(config):
    cliente = ClienteNexus(config)

    limpiar()
    print()
    print("  ╔═══════════════════════════════════════════════╗")
    print("  ║        NEXUS POS — Agente activo              ║")
    print("  ╚═══════════════════════════════════════════════╝")
    print()
    print(f"  Terminal  : #{config['terminal_id']} · {config['procesador']}")
    print(f"  Pinpad    : {config['pinpad_ip']}:{config['pinpad_puerto']}")
    print(f"  Sistema   : {config['nexus_url']}")
    print()
    print("  Conectando...", end="", flush=True)

    if not cliente.login():
        print(" ❌")
        print("\n  No se pudo conectar. Verifica internet y credenciales.")
        input("\n  Presiona Enter para volver al menú...")
        return

    print(" ✅")
    print()
    print("  Esperando transacciones del sistema...")
    print("  (Presiona Ctrl+C para detener)")
    print()

    hb = 0
    while True:
        try:
            pendiente = cliente.get_pendiente()
            if pendiente and pendiente.get("id"):
                tid   = pendiente["id"]
                monto = pendiente.get("monto", 0)
                cuotas = pendiente.get("diferido_cuotas") or 0
                tipo   = pendiente.get("diferido_tipo") or "Contado"
                print(f"\n  ► Cobro #{tid}  ${monto}  {'Contado' if not cuotas else f'{tipo} {cuotas} cuotas'}")
                print(f"    Enviando al pinpad...", end="", flush=True)
                resultado = enviar_a_pinpad(config, pendiente)
                cliente.reportar(tid, resultado)
                if resultado["aprobado"]:
                    print(f" ✅ APROBADO — Auth: {resultado.get('codigo_autorizacion','—')}")
                else:
                    print(f" ❌ RECHAZADO — {resultado.get('mensaje_respuesta','')}")
            hb += 1
            if hb >= 30:
                cliente.heartbeat(); hb = 0
        except KeyboardInterrupt:
            print("\n\n  Agente detenido.")
            break
        except Exception as e:
            log.error(f"Error: {e}")
        time.sleep(config["polling_segundos"])


# ══════════════════════════════════════════════════════════════
#  ENTRADA PRINCIPAL
# ══════════════════════════════════════════════════════════════

def main():
    # Primera vez: ejecutar asistente
    if not os.path.exists(CONFIG_FILE):
        config = asistente_configuracion()
        if not config:
            return
        ejecutar_agente(config)
        return

    # Config existente: mostrar menú
    with open(CONFIG_FILE) as f:
        config = json.load(f)

    while True:
        opcion = menu_principal(config)
        if opcion == "1":
            ejecutar_agente(config)
        elif opcion == "2":
            config = asistente_configuracion()
            if not config:
                with open(CONFIG_FILE) as f:
                    config = json.load(f)
        elif opcion == "3":
            agregar_a_arranque_windows()
            input("\n  Presiona Enter para continuar...")
        elif opcion == "4":
            quitar_de_arranque_windows()
            print("\n  ✅ Quitado del arranque de Windows.")
            input("  Presiona Enter para continuar...")
        elif opcion == "5":
            break


if __name__ == "__main__":
    main()
