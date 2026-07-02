"""
NEXUS POS — Agente de Biométrico
Versión 1.0

Conecta directamente al biométrico ZKTeco o Anviz por red
y sube la asistencia automáticamente al sistema NEXUS.

Sin exportar CSV — sincronización automática.
"""
import json, time, logging, os, sys, winreg, subprocess
from datetime import datetime, date, timedelta

# Instalar dependencias si no están
def instalar(paquete):
    subprocess.check_call([sys.executable, "-m", "pip", "install", paquete, "-q"],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

try:
    import requests
except ImportError:
    print("Instalando dependencias..."); instalar("requests"); import requests

try:
    from zk import ZK, const
    PYZK_OK = True
except ImportError:
    PYZK_OK = False  # Se instala al configurar si el dispositivo es ZKTeco


BASE_DIR    = os.path.dirname(os.path.abspath(sys.argv[0]))
CONFIG_FILE = os.path.join(BASE_DIR, "config_biometrico.json")
LOG_FILE    = os.path.join(BASE_DIR, "agente_biometrico.log")
SYNC_FILE   = os.path.join(BASE_DIR, "ultima_sincronizacion.txt")

NEXUS_URL_DEFAULT = "https://api.pos-tecnologi.com/api"

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
#  HELPERS UI
# ══════════════════════════════════════════════════════════════

def limpiar():
    os.system("cls" if os.name == "nt" else "clear")

def titulo(t):
    print("\n" + "═" * 55)
    print(f"  {t}")
    print("═" * 55)

def pedir(preg, default="", requerido=True):
    while True:
        val = input(f"  {preg}{f' [{default}]' if default else ''}: ").strip()
        val = val or default
        if val or not requerido: return val
        print("  ⚠️  Campo obligatorio.")

def pedir_opcion(preg, opciones):
    print(f"\n  {preg}")
    for i, (v, l) in enumerate(opciones, 1):
        print(f"    [{i}] {l}")
    while True:
        e = input("  Opción: ").strip()
        if e.isdigit() and 1 <= int(e) <= len(opciones):
            return opciones[int(e)-1][0]
        print("  ⚠️  Número inválido.")


# ══════════════════════════════════════════════════════════════
#  CLIENTE NEXUS
# ══════════════════════════════════════════════════════════════

class ClienteNexus:
    def __init__(self, config):
        self.base  = config["nexus_url"].rstrip("/")
        self.bio_id = config["biometrico_id"]
        self.config = config
        self.token  = None

    def login(self):
        try:
            r = requests.post(f"{self.base}/auth/login",
                data={"username":       self.config["usuario"],
                      "password":       self.config["password"],
                      "empresa_codigo": self.config.get("empresa_codigo","")},
                timeout=10)
            if r.status_code == 200:
                self.token = r.json().get("access_token")
                return True
            log.error(f"Login rechazado: {r.text[:100]}")
        except Exception as e:
            log.error(f"Error login: {e}")
        return False

    def H(self): return {"Authorization": f"Bearer {self.token}"}

    def subir_registros(self, registros: list) -> dict:
        """Envía los registros de asistencia al servidor."""
        try:
            r = requests.post(f"{self.base}/biometrico/agente/sincronizar",
                json={"biometrico_id": self.bio_id, "registros": registros},
                headers=self.H(), timeout=30)
            if r.status_code == 401:
                self.login()
                return {"importados": 0, "error": "Token expirado, reintentando..."}
            return r.json()
        except Exception as e:
            return {"importados": 0, "error": str(e)}

    def subir_usuarios(self, usuarios: list):
        """Sube la lista de usuarios del biométrico para mapeo."""
        try:
            requests.post(f"{self.base}/biometrico/agente/usuarios",
                json={"biometrico_id": self.bio_id, "usuarios": usuarios},
                headers=self.H(), timeout=15)
        except Exception: pass

    def heartbeat(self):
        try:
            requests.post(f"{self.base}/biometrico/agente/heartbeat",
                json={"biometrico_id": self.bio_id},
                headers=self.H(), timeout=5)
        except Exception: pass


# ══════════════════════════════════════════════════════════════
#  CONEXIÓN ZKTeco
# ══════════════════════════════════════════════════════════════

def conectar_zkteco(ip, puerto=4370, timeout=30):
    """Conecta al dispositivo ZKTeco y retorna la conexión."""
    if not PYZK_OK:
        log.info("Instalando librería ZKTeco (pyzk)...")
        instalar("pyzk")
        from zk import ZK
    else:
        from zk import ZK

    zk = ZK(ip, port=int(puerto), timeout=timeout, password=0, force_udp=False, ommit_ping=True)
    return zk.connect()


def leer_asistencia_zkteco(config, desde: date = None):
    """
    Lee los registros de asistencia del ZKTeco.
    Retorna lista de dicts con: bio_user_id, fecha, hora, tipo (0=entrada,1=salida)
    """
    ip     = config["bio_ip"]
    puerto = config.get("bio_puerto", 4370)

    log.info(f"Conectando a ZKTeco {ip}:{puerto}...")
    conn = conectar_zkteco(ip, puerto)
    log.info("✅ Conectado al biométrico")

    try:
        # Obtener usuarios
        usuarios = conn.get_users()
        lista_usuarios = [{"id": str(u.user_id), "nombre": u.name or ""} for u in usuarios]

        # Obtener registros de asistencia
        asistencias = conn.get_attendance()
        registros = []

        for a in asistencias:
            if desde and a.timestamp.date() < desde:
                continue  # Saltar registros anteriores a la fecha de corte
            registros.append({
                "bio_user_id": str(a.user_id),
                "fecha":       a.timestamp.strftime("%Y-%m-%d"),
                "hora":        a.timestamp.strftime("%H:%M:%S"),
                "datetime":    a.timestamp.isoformat(),
                "tipo":        int(a.punch),  # 0=Check In, 1=Check Out, 4=OT In, 5=OT Out
            })

        conn.disconnect()
        return lista_usuarios, registros

    except Exception as e:
        try: conn.disconnect()
        except: pass
        raise e


# ══════════════════════════════════════════════════════════════
#  CONEXIÓN ANVIZ
# ══════════════════════════════════════════════════════════════

def leer_asistencia_anviz(config, desde: date = None):
    """
    Lee registros de asistencia de un dispositivo Anviz via TCP.
    El protocolo Anviz usa comandos binarios sobre TCP (puerto 5005 por defecto).

    NOTA: Implementación de referencia. Solicitar documentación oficial a Anviz.
    Contacto: support@anviz.com — Protocolo: Anviz CrossChex Cloud Protocol
    """
    import socket

    ip     = config["bio_ip"]
    puerto = int(config.get("bio_puerto", 5005))

    log.info(f"Conectando a Anviz {ip}:{puerto}...")

    # Comando Anviz para obtener registros (protocolo simplificado)
    # En producción: usar el SDK oficial de Anviz o su API REST
    CMD_GET_RECORDS = bytes([
        0xA5, 0x00,  # Header
        0x00, 0x00,  # Device ID
        0x04,        # Command: Get Records
        0x00, 0x00, 0x00, 0x00,  # From date (0 = all)
        0x00,        # Checksum (calcular en producción)
    ])

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(15)
        sock.connect((ip, puerto))
        sock.sendall(CMD_GET_RECORDS)
        respuesta = sock.recv(65536)
        sock.close()

        # Parsear respuesta Anviz (formato propietario)
        # TODO: implementar parser completo con documentación oficial
        registros = []
        log.info(f"Anviz respondió {len(respuesta)} bytes — parseo pendiente de documentación oficial")
        return [], registros

    except Exception as e:
        raise Exception(f"Error conectando a Anviz {ip}:{puerto}: {e}")


# ══════════════════════════════════════════════════════════════
#  SINCRONIZACIÓN PRINCIPAL
# ══════════════════════════════════════════════════════════════

def leer_ultima_sync():
    """Retorna la fecha de la última sincronización exitosa."""
    if os.path.exists(SYNC_FILE):
        try:
            with open(SYNC_FILE) as f:
                return date.fromisoformat(f.read().strip())
        except: pass
    return date.today() - timedelta(days=30)  # Por defecto: últimos 30 días

def guardar_ultima_sync(fecha: date):
    with open(SYNC_FILE, "w") as f:
        f.write(fecha.isoformat())

def sincronizar_dispositivo(dispositivo: dict, cliente: ClienteNexus, desde: date):
    """Sincroniza un solo biométrico."""
    bio_id = dispositivo["biometrico_id"]
    marca  = dispositivo.get("marca", "ZKTECO")
    ip     = dispositivo["bio_ip"]

    print(f"\n  ► #{bio_id} {marca} ({ip}) — registros desde {desde}...")

    try:
        # Pasar config del dispositivo específico
        cfg_bio = {**dispositivo}
        if marca == "ZKTECO":
            usuarios, registros = leer_asistencia_zkteco(cfg_bio, desde)
        elif marca == "ANVIZ":
            usuarios, registros = leer_asistencia_anviz(cfg_bio, desde)
        else:
            print(f"  ❌ Marca '{marca}' no soportada"); return

        print(f"     {len(registros)} marcaciones leídas")

        if not registros:
            print("     Sin registros nuevos"); return

        if usuarios:
            cliente.bio_id = bio_id
            cliente.subir_usuarios(usuarios)

        cliente.bio_id = bio_id
        resultado = cliente.subir_registros(registros)

        if resultado.get("importados", 0) > 0:
            print(f"     ✅ {resultado['importados']} registros guardados")
        if resultado.get("sin_mapeo"):
            print(f"     ⚠️  Sin mapeo: {', '.join(resultado['sin_mapeo'][:3])}")
        if resultado.get("error"):
            print(f"     ❌ {resultado['error']}")

    except Exception as e:
        log.error(f"Error #{bio_id}: {e}")
        print(f"     ❌ Error: {e}")


def sincronizar(config, cliente: ClienteNexus, manual=False):
    """Sincroniza TODOS los biométricos configurados."""
    desde = leer_ultima_sync() if not manual else date.today() - timedelta(days=30)

    # Soporte para config con lista de dispositivos (multi) o uno solo (legacy)
    dispositivos = config.get("dispositivos")
    if not dispositivos:
        # Config antigua con un solo dispositivo
        dispositivos = [{"biometrico_id": config["biometrico_id"],
                         "marca": config.get("marca","ZKTECO"),
                         "bio_ip": config["bio_ip"],
                         "bio_puerto": config.get("bio_puerto", 4370)}]

    total_imp = 0
    for disp in dispositivos:
        sincronizar_dispositivo(disp, cliente, desde)

    guardar_ultima_sync(date.today())
    print(f"\n  Sync completada — {datetime.now().strftime('%H:%M:%S')}")


# ══════════════════════════════════════════════════════════════
#  ASISTENTE DE CONFIGURACIÓN
# ══════════════════════════════════════════════════════════════

def asistente_configuracion():
    limpiar()
    print()
    print("  ╔═══════════════════════════════════════════════╗")
    print("  ║      NEXUS POS — Agente Biométrico            ║")
    print("  ║         Configuración inicial                 ║")
    print("  ╚═══════════════════════════════════════════════╝")
    print()
    print("  Conecta tu biométrico ZKTeco o Anviz al sistema")
    print("  NEXUS sin exportar archivos CSV manualmente.")
    print()
    input("  Presiona Enter para continuar...")

    # Paso 1: Acceso a NEXUS
    limpiar()
    titulo("PASO 1 DE 3 — Acceso al sistema NEXUS")
    print()
    print(f"  🌐  {NEXUS_URL_DEFAULT}")
    print()
    empresa_codigo = pedir("Código de empresa")
    usuario        = pedir("Usuario", "admin")
    password       = pedir("Contraseña")

    print("\n  Verificando credenciales...", end="", flush=True)
    try:
        r = requests.post(f"{NEXUS_URL_DEFAULT}/auth/login",
            data={"username": usuario, "password": password,
                  "empresa_codigo": empresa_codigo}, timeout=10)
        if r.status_code != 200:
            print(f" ❌\n\n  {r.json().get('detail','Datos incorrectos')}")
            input("\n  Presiona Enter para salir..."); return None
        token = r.json().get("access_token")
        empresa_nombre = r.json().get("empresa_nombre", empresa_codigo)
        print(f" ✅ {empresa_nombre}")
    except Exception as e:
        print(f" ❌\n\n  Sin conexión a internet: {e}")
        input("\n  Presiona Enter para salir..."); return None

    # Paso 2: Seleccionar biométrico registrado en NEXUS
    limpiar()
    titulo("PASO 2 DE 3 — Biométrico asignado")
    print()

    try:
        res = requests.get(f"{NEXUS_URL_DEFAULT}/biometrico/dispositivos",
            headers={"Authorization": f"Bearer {token}"}, timeout=10)
        dispositivos = res.json() if res.status_code == 200 else []
    except Exception:
        dispositivos = []

    bio_id = None
    marca  = "ZKTECO"

    if dispositivos:
        opciones = [(str(d["id"]), f"{d['nombre']} — {d['marca']} · {d.get('sucursal_nombre','Sin sucursal')}") for d in dispositivos]
        opciones.append(("0", "Ingresar ID manualmente"))
        sel = pedir_opcion("¿Cuál biométrico conecta este agente?", opciones)
        if sel == "0":
            bio_id = int(pedir("ID del biométrico (ver en Nómina → Asistencia → Dispositivos)"))
            marca  = pedir_opcion("Marca:", [("ZKTECO","ZKTeco"),("ANVIZ","Anviz")])
        else:
            bio_id = int(sel)
            d_sel  = next((d for d in dispositivos if d["id"] == bio_id), None)
            if d_sel: marca = d_sel.get("marca","ZKTECO").upper()
    else:
        print("  No hay biométricos registrados en el sistema.")
        print("  Créalo primero en: Nómina → Asistencia → Dispositivos → + Nuevo dispositivo")
        print()
        bio_id = int(pedir("ID del biométrico"))
        marca  = pedir_opcion("Marca:", [("ZKTECO","ZKTeco"),("ANVIZ","Anviz")])

    # Paso 3: Agregar biométricos (pueden ser varios)
    limpiar()
    titulo("PASO 3 DE 3 — Biométricos en la red")
    print()
    print("  Este agente puede manejar TODOS los biométricos de la red.")
    print("  Agrega cada uno con su IP. Puedes ver la IP en el equipo:")
    print("  ZKTeco: Menú → Comunicación → Ethernet → Dirección IP")
    print("  Anviz:  Menú → Config → Network → IP")
    print()

    dispositivos = []
    # El primero ya está seleccionado del paso 2
    primer_ip     = pedir("IP del primer biométrico (ej: 192.168.1.100)")
    primer_puerto = pedir("Puerto", "4370" if marca == "ZKTECO" else "5005")
    dispositivos.append({
        "biometrico_id": bio_id,
        "marca":         marca,
        "bio_ip":        primer_ip,
        "bio_puerto":    int(primer_puerto),
    })
    _probar_conexion(primer_ip, primer_puerto)

    # Agregar más biométricos
    while True:
        print()
        mas = input("  ¿Agregar otro biométrico? [s/N]: ").strip().lower()
        if mas != "s":
            break

        print()
        # Seleccionar el siguiente dispositivo del sistema
        try:
            res = requests.get(f"{NEXUS_URL_DEFAULT}/biometrico/dispositivos",
                headers={"Authorization": f"Bearer {token}"}, timeout=10)
            disp_sistema = [d for d in (res.json() if res.status_code == 200 else [])
                            if not any(x["biometrico_id"] == d["id"] for x in dispositivos)]
        except Exception:
            disp_sistema = []

        if disp_sistema:
            opciones = [(str(d["id"]), f"{d['nombre']} — {d['marca']} · {d.get('sucursal_nombre','')}") for d in disp_sistema]
            opciones.append(("0","Ingresar ID manualmente"))
            sel2  = pedir_opcion("¿Cuál biométrico?", opciones)
            if sel2 == "0":
                bio_id2 = int(pedir("ID del biométrico"))
                marca2  = pedir_opcion("Marca:", [("ZKTECO","ZKTeco"),("ANVIZ","Anviz")])
            else:
                bio_id2 = int(sel2)
                d2 = next((d for d in disp_sistema if d["id"] == bio_id2), None)
                marca2 = d2.get("marca","ZKTECO").upper() if d2 else "ZKTECO"
        else:
            bio_id2 = int(pedir("ID del biométrico"))
            marca2  = pedir_opcion("Marca:", [("ZKTECO","ZKTeco"),("ANVIZ","Anviz")])

        ip2     = pedir("IP del biométrico")
        puerto2 = pedir("Puerto", "4370" if marca2 == "ZKTECO" else "5005")
        dispositivos.append({
            "biometrico_id": bio_id2,
            "marca":         marca2,
            "bio_ip":        ip2,
            "bio_puerto":    int(puerto2),
        })
        _probar_conexion(ip2, puerto2)

    # Intervalo
    print()
    intervalo = pedir_opcion("¿Cada cuánto sincronizar?", [
        ("60",   "Cada hora"),
        ("30",   "Cada 30 minutos"),
        ("10",   "Cada 10 minutos"),
        ("1440", "Una vez al día"),
    ])

    # Resumen
    limpiar()
    titulo("✅ Configuración lista — Resumen")
    print()
    print(f"  🌐  Sistema NEXUS  : {NEXUS_URL_DEFAULT}")
    print(f"  🏢  Empresa        : {empresa_codigo}")
    print(f"  ⏱️   Sync cada      : {intervalo} minutos")
    print()
    print(f"  📡  Biométricos ({len(dispositivos)}):")
    for d in dispositivos:
        print(f"      #{d['biometrico_id']} {d['marca']} — {d['bio_ip']}:{d['bio_puerto']}")
    print()

    arranque  = input("  ¿Iniciar automáticamente con Windows? [S/n]: ").strip().lower() != "n"
    confirmar = input("  ¿Guardar y comenzar? [S/n]: ").strip().lower()
    if confirmar == "n": return None

    config = {
        "nexus_url":      NEXUS_URL_DEFAULT,
        "empresa_codigo": empresa_codigo,
        "usuario":        usuario,
        "password":       password,
        "dispositivos":   dispositivos,
        "intervalo_min":  int(intervalo),
    }

    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)

    if arranque:
        agregar_arranque()

    print("\n  ✅ Configuración guardada.\n")
    return config


def _probar_conexion(ip, puerto):
    import socket
    print(f"  Probando {ip}:{puerto}...", end="", flush=True)
    try:
        s = socket.socket(); s.settimeout(4)
        s.connect((ip, int(puerto))); s.close()
        print(" ✅")
    except Exception:
        print(" ⚠️  (sin respuesta — verifica que el equipo esté encendido)")


# ══════════════════════════════════════════════════════════════
#  ARRANQUE WINDOWS
# ══════════════════════════════════════════════════════════════

def agregar_arranque():
    exe = os.path.abspath(sys.argv[0])
    try:
        reg = winreg.OpenKey(winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Run", 0, winreg.KEY_SET_VALUE)
        winreg.SetValueEx(reg, "AgenteNexusBiometrico", 0, winreg.REG_SZ, f'"{exe}"')
        winreg.CloseKey(reg)
        print("  ✅ Registrado en arranque de Windows")
    except Exception as e:
        log.warning(f"No se pudo registrar en arranque: {e}")

def quitar_arranque():
    try:
        reg = winreg.OpenKey(winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Run", 0, winreg.KEY_SET_VALUE)
        winreg.DeleteValue(reg, "AgenteNexusBiometrico")
        winreg.CloseKey(reg)
    except: pass


# ══════════════════════════════════════════════════════════════
#  BUCLE PRINCIPAL
# ══════════════════════════════════════════════════════════════

def ejecutar_agente(config):
    cliente = ClienteNexus(config)

    limpiar()
    print()
    print("  ╔═══════════════════════════════════════════════╗")
    print("  ║      NEXUS POS — Agente Biométrico activo     ║")
    print("  ╚═══════════════════════════════════════════════╝")
    print()
    dispositivos = config.get("dispositivos") or [{"biometrico_id": config.get("biometrico_id"),
        "marca": config.get("marca","ZKTECO"), "bio_ip": config.get("bio_ip",""),
        "bio_puerto": config.get("bio_puerto",4370)}]
    print(f"  Empresa    : {config.get('empresa_codigo','—')}")
    print(f"  Sync cada  : {config.get('intervalo_min',60)} minutos")
    for d in dispositivos:
        print(f"  Biométrico : #{d['biometrico_id']} {d.get('marca','')} — {d.get('bio_ip','')}:{d.get('bio_puerto','')}")
    print()
    print("  Conectando a NEXUS...", end="", flush=True)

    if not cliente.login():
        print(" ❌\n\n  No se pudo conectar. Revisa credenciales y conexión a internet.")
        input("\n  Presiona Enter para volver al menú..."); return

    print(" ✅")
    print()
    print("  Agente activo. Sincronizando automáticamente.")
    print("  Presiona Ctrl+C para detener.")
    print()

    # Sincronizar inmediatamente al iniciar
    sincronizar(config, cliente)

    intervalo_seg = config["intervalo_min"] * 60
    ultima_sync   = time.time()
    hb_counter    = 0

    while True:
        try:
            ahora = time.time()
            if ahora - ultima_sync >= intervalo_seg:
                print(f"\n  [{datetime.now().strftime('%H:%M')}] Sincronizando...")
                sincronizar(config, cliente)
                ultima_sync = time.time()

            hb_counter += 1
            if hb_counter >= 30:
                cliente.heartbeat(); hb_counter = 0

            # Mostrar cuenta regresiva
            faltan = int(intervalo_seg - (time.time() - ultima_sync))
            mins, segs = divmod(faltan, 60)
            print(f"\r  Próxima sync en {mins:02d}:{segs:02d}  ", end="", flush=True)

        except KeyboardInterrupt:
            print("\n\n  Agente detenido.")
            break
        except Exception as e:
            log.error(f"Error: {e}")

        time.sleep(1)


def menu_principal(config):
    limpiar()
    print()
    print("  ╔═══════════════════════════════════════════════╗")
    print("  ║      NEXUS POS — Agente Biométrico            ║")
    print("  ╚═══════════════════════════════════════════════╝")
    print()
    disps = config.get("dispositivos") or [{"biometrico_id": config.get("biometrico_id"),
        "marca": config.get("marca",""), "bio_ip": config.get("bio_ip","")}]
    print(f"  Empresa    : {config.get('empresa_codigo','—')}")
    print(f"  Sync cada  : {config.get('intervalo_min',60)} minutos")
    print(f"  Dispositivos ({len(disps)}):")
    for d in disps:
        print(f"    #{d['biometrico_id']} {d.get('marca','')} — {d.get('bio_ip','')}:{d.get('bio_puerto','')}")
    print()
    print("  [1] Iniciar agente (sync automático)")
    print("  [2] Sincronizar ahora (manual)")
    print("  [3] Reconfigurar")
    print("  [4] Agregar a arranque de Windows")
    print("  [5] Quitar de arranque de Windows")
    print("  [6] Salir")
    print()
    return input("  Opción: ").strip()


def main():
    if not os.path.exists(CONFIG_FILE):
        config = asistente_configuracion()
        if config:
            ejecutar_agente(config)
        return

    with open(CONFIG_FILE) as f:
        config = json.load(f)

    while True:
        op = menu_principal(config)
        if op == "1":
            ejecutar_agente(config)
        elif op == "2":
            cliente = ClienteNexus(config)
            if cliente.login():
                sincronizar(config, cliente, manual=True)
            input("\n  Presiona Enter para continuar...")
        elif op == "3":
            config = asistente_configuracion() or config
        elif op == "4":
            agregar_arranque()
            input("\n  ✅ Registrado. Presiona Enter...")
        elif op == "5":
            quitar_arranque()
            print("\n  ✅ Quitado del arranque.")
            input("  Presiona Enter...")
        elif op == "6":
            break


if __name__ == "__main__":
    main()
