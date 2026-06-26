from dotenv import load_dotenv
import os

load_dotenv()

APP_NAME    = os.getenv('APP_NAME', 'NEXUS by POS Tecnologi')
APP_VERSION = os.getenv('APP_VERSION', '1.0.0')
DEBUG       = os.getenv('DEBUG', 'False').lower() == 'true'

# Colores del sistema
AZUL        = '#1A56DB'
AZUL_OSCURO = '#1E429F'
VERDE       = '#0E9F6E'
ROJO        = '#E02424'
NARANJA     = '#C27803'
GRIS        = '#6B7280'
FONDO       = '#F3F4F6'
BLANCO      = '#FFFFFF'
TEXTO       = '#111928'

# IVA Ecuador
IVA = 15.0