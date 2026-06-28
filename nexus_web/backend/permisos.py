"""
Sistema de permisos granulares — NEXUS POS
Cada usuario tiene permisos por módulo con acciones: ver, crear, editar, eliminar.
Los roles son plantillas que precargan permisos, pero el admin puede personalizar.
"""
from fastapi import Depends, HTTPException
from auth import get_current_user

ACCIONES = ["ver", "crear", "editar", "eliminar"]

MODULOS = [
    {"id": "dashboard",       "nombre": "Dashboard",              "grupo": "Principal",  "icono": "LayoutDashboard"},
    {"id": "facturas",        "nombre": "Facturación",            "grupo": "Ventas",     "icono": "FileText"},
    {"id": "notas-venta",     "nombre": "Notas de Venta",         "grupo": "Ventas",     "icono": "Receipt"},
    {"id": "clientes",        "nombre": "Clientes",               "grupo": "Ventas",     "icono": "Users"},
    {"id": "cxc",             "nombre": "Cuentas por Cobrar",     "grupo": "Ventas",     "icono": "DollarSign"},
    {"id": "devoluciones",    "nombre": "Devoluciones",           "grupo": "Ventas",     "icono": "RotateCcw"},
    {"id": "cotizaciones",    "nombre": "Cotizaciones",           "grupo": "Ventas",     "icono": "ClipboardList"},
    {"id": "productos",       "nombre": "Productos",              "grupo": "Inventario", "icono": "Package"},
    {"id": "stock",           "nombre": "Stock / Inventario",     "grupo": "Inventario", "icono": "Boxes"},
    {"id": "gestion-precios", "nombre": "Gestión de Precios",     "grupo": "Inventario", "icono": "Tags"},
    {"id": "etiquetas",       "nombre": "Etiquetas",              "grupo": "Inventario", "icono": "Tag"},
    {"id": "transferencias",  "nombre": "Transferencias",         "grupo": "Inventario", "icono": "ArrowRightLeft"},
    {"id": "ajustes",         "nombre": "Ajustes Inventario",     "grupo": "Inventario", "icono": "ClipboardList"},
    {"id": "kardex",          "nombre": "Kardex",                 "grupo": "Inventario", "icono": "ScrollText"},
    {"id": "toma-fisica",     "nombre": "Toma Física",            "grupo": "Inventario", "icono": "ClipboardCheck"},
    {"id": "servicio-tecnico","nombre": "Servicio Tecnico",       "grupo": "Servicio",   "icono": "Wrench"},
    {"id": "crm",             "nombre": "CRM",                    "grupo": "Ventas",     "icono": "Target"},
    {"id": "compras",         "nombre": "Compras",                "grupo": "Compras",    "icono": "ShoppingCart"},
    {"id": "retenciones",     "nombre": "Retenciones",            "grupo": "Compras",    "icono": "FileCheck2"},
    {"id": "proveedores",     "nombre": "Proveedores",            "grupo": "Compras",    "icono": "Truck"},
    {"id": "caja",            "nombre": "Caja",                   "grupo": "Finanzas",   "icono": "Wallet"},
    {"id": "bancos",          "nombre": "Bancos",                 "grupo": "Finanzas",   "icono": "Landmark"},
    {"id": "conciliacion",    "nombre": "Conciliación",           "grupo": "Finanzas",   "icono": "CheckSquare"},
    {"id": "cxp",             "nombre": "Cuentas por Pagar",      "grupo": "Finanzas",   "icono": "CreditCard"},
    {"id": "vendedores",      "nombre": "Vendedores",             "grupo": "RRHH",       "icono": "UserCheck"},
    {"id": "nomina",          "nombre": "Nomina",                 "grupo": "RRHH",       "icono": "Calculator"},
    {"id": "notas-debito",    "nombre": "Notas de Débito",        "grupo": "Ventas",     "icono": "FileMinus"},
    {"id": "guias-remision",  "nombre": "Guías de Remisión",     "grupo": "Ventas",     "icono": "Truck"},
    {"id": "liquidaciones",   "nombre": "Liquidaciones Compra",  "grupo": "Compras",    "icono": "FileInput"},
    {"id": "contabilidad",    "nombre": "Contabilidad",           "grupo": "Contabilidad","icono": "Calculator"},
    {"id": "reportes",        "nombre": "Reportes",               "grupo": "Reportes",   "icono": "BarChart3"},
    {"id": "configuracion",   "nombre": "Configuración",          "grupo": "Sistema",    "icono": "Settings"},
    {"id": "usuarios",        "nombre": "Usuarios",               "grupo": "Sistema",    "icono": "Shield"},
    {"id": "sri",             "nombre": "Facturación Electrónica", "grupo": "Sistema",    "icono": "FileCheck"},
    {"id": "admin",           "nombre": "Administración",          "grupo": "Sistema",    "icono": "Server"},
]

def _todas_acciones():
    return {m["id"]: list(ACCIONES) for m in MODULOS}

def _acciones_modulos(modulo_ids, acciones=None):
    acc = acciones or list(ACCIONES)
    return {mid: list(acc) for mid in modulo_ids}

PLANTILLAS_ROL = {
    "admin": {
        "nombre": "Administrador",
        "descripcion": "Acceso total al sistema",
        "permisos": _todas_acciones(),
    },
    "gerente": {
        "nombre": "Gerente",
        "descripcion": "Todo excepto gestión de usuarios",
        "permisos": {m["id"]: list(ACCIONES) for m in MODULOS if m["id"] != "usuarios"},
    },
    "vendedor": {
        "nombre": "Vendedor",
        "descripcion": "Facturación, clientes, CRM y cobranza",
        "permisos": {
            "dashboard": ["ver"],
            "facturas": ["ver", "crear"],
            "clientes": ["ver", "crear", "editar"],
            "cotizaciones": ["ver", "crear", "editar"],
            "crm": ["ver", "crear", "editar"],
            "devoluciones": ["ver"],
            "notas-debito": ["ver"],
            "productos": ["ver"],
            "stock": ["ver"],
            "cxc": ["ver"],
            "caja": ["ver", "crear"],
            "reportes": ["ver"],
        },
    },
    "cajero": {
        "nombre": "Cajero",
        "descripcion": "Facturación, caja y cobranza básica",
        "permisos": {
            "dashboard": ["ver"],
            "facturas": ["ver", "crear"],
            "caja": ["ver", "crear", "editar"],
            "clientes": ["ver", "crear"],
            "productos": ["ver"],
            "cxc": ["ver"],
            "devoluciones": ["ver"],
        },
    },
    "bodeguero": {
        "nombre": "Bodeguero",
        "descripcion": "Inventario, compras, transferencias y kardex",
        "permisos": {
            "dashboard": ["ver"],
            "stock": ["ver", "crear", "editar"],
            "productos": ["ver", "editar"],
            "compras": ["ver", "crear"],
            "transferencias": ["ver", "crear"],
            "ajustes": ["ver", "crear"],
            "kardex": ["ver"],
            "toma-fisica": ["ver", "crear"],
            "proveedores": ["ver", "crear", "editar"],
            "etiquetas": ["ver", "crear"],
            "gestion-precios": ["ver", "editar"],
            "guias-remision": ["ver", "crear"],
            "liquidaciones": ["ver"],
        },
    },
    "contador": {
        "nombre": "Contador",
        "descripcion": "Contabilidad, reportes, finanzas, retenciones y SRI",
        "permisos": {
            "dashboard": ["ver"],
            "contabilidad": ["ver", "crear", "editar", "eliminar"],
            "reportes": ["ver"],
            "cxc": ["ver", "editar"],
            "cxp": ["ver", "editar"],
            "bancos": ["ver", "crear", "editar"],
            "conciliacion": ["ver", "crear", "editar"],
            "retenciones": ["ver", "crear", "editar"],
            "notas-debito": ["ver", "crear"],
            "sri": ["ver", "crear"],
            "nomina": ["ver", "crear", "editar"],
            "configuracion": ["ver"],
            "liquidaciones": ["ver", "crear"],
        },
    },
    "tecnico": {
        "nombre": "Técnico",
        "descripcion": "Servicio técnico, órdenes asignadas y repuestos",
        "permisos": {
            "dashboard": ["ver"],
            "servicio-tecnico": ["ver", "crear", "editar"],
            "productos": ["ver"],
            "stock": ["ver"],
            "clientes": ["ver", "crear"],
        },
    },
}


def get_permisos_usuario(usuario_id: int) -> dict | None:
    """Lee permisos granulares desde la BD. Retorna dict {modulo: [acciones]} o None."""
    from database import query
    rows = query(
        "SELECT modulo, acciones FROM sys_permisos_usuario WHERE usuario_id=%s",
        (usuario_id,))
    if not rows:
        return None
    permisos = {}
    for r in rows:
        acciones = r.get("acciones") or "ver"
        permisos[r["modulo"]] = [a.strip() for a in acciones.split(",") if a.strip()]
    return permisos


def get_permisos_efectivos(usuario_id: int, rol: str) -> dict:
    """Retorna los permisos efectivos: de la BD si existen, sino de la plantilla."""
    permisos_db = get_permisos_usuario(usuario_id)
    if permisos_db is not None:
        return permisos_db
    if rol == "admin":
        return _todas_acciones()
    if permisos_db is not None:
        return permisos_db
    plantilla = PLANTILLAS_ROL.get(rol, PLANTILLAS_ROL["vendedor"])
    return plantilla["permisos"]


def tiene_acceso(usuario_id: int, rol: str, modulo: str, accion: str = "ver") -> bool:
    permisos = get_permisos_efectivos(usuario_id, rol)
    acciones_modulo = permisos.get(modulo, [])
    return accion in acciones_modulo


def requiere_rol(*roles_permitidos):
    def verificar(u=Depends(get_current_user)):
        rol = u.get("rol", "vendedor")
        if rol == "admin":
            return u
        if rol not in roles_permitidos:
            raise HTTPException(403, f"Se requiere rol: {', '.join(roles_permitidos)}")
        return u
    return verificar


def requiere_modulo(modulo: str, accion: str = "ver"):
    def verificar(u=Depends(get_current_user)):
        rol = u.get("rol", "vendedor")
        if not tiene_acceso(u["id"], rol, modulo, accion):
            raise HTTPException(403, f"No tiene permiso '{accion}' en '{modulo}'")
        return u
    return verificar
