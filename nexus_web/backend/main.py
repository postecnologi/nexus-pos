import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from pathlib import Path
from database import execute, query_one, insert, set_tenant_db, clear_tenant_db

from routers import (
    auth, dashboard, productos, clientes, proveedores, vendedores,
    facturas, inventario, compras, devoluciones, transferencias, ajustes,
    cxc, cxp, caja, bancos, conciliacion, configuracion, etiquetas, sri,
    usuarios, reportes, kardex, cotizaciones, toma_fisica, servicio_tecnico,
    crm, retenciones, notas_debito, contabilidad,
    guias_remision, liquidaciones, nomina, admin, superadmin,
    whatsapp, depositos, notas_venta, ordenes_compra, crm_comunicaciones,
    biometrico,
)

app = FastAPI(title="NEXUS POS API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Middleware Multi-Tenant ───────────────────────────────────
MULTI_TENANT = os.getenv("MULTI_TENANT", "false").lower() == "true"

class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        # The tenant DB is set from the JWT token in auth.get_current_user,
        # but also support explicit X-Tenant-DB header for flexibility
        tenant_db = request.headers.get("X-Tenant-DB")
        if tenant_db:
            set_tenant_db(tenant_db)
        try:
            response = await call_next(request)
            return response
        finally:
            clear_tenant_db()

if MULTI_TENANT:
    app.add_middleware(TenantMiddleware)

# ── Middleware de Auditoría Automática ────────────────────────
AUDIT_METHOD_MAP = {"POST": "CREAR", "PUT": "EDITAR", "PATCH": "EDITAR", "DELETE": "ELIMINAR"}
AUDIT_SKIP_OK = {"/api/auth/", "/api/admin/audit", "/api/nomina/portal/"}
AUDIT_SKIP_ALL = {"/api/admin/audit"}

class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        method = request.method
        path = request.url.path
        status = response.status_code
        is_error = status >= 400
        should_log = (method in AUDIT_METHOD_MAP and status < 400) or (is_error and method != "GET")
        skip = AUDIT_SKIP_ALL if status >= 400 else AUDIT_SKIP_OK
        if should_log and not any(path.startswith(s) for s in skip):
            try:
                from jose import jwt as _jwt
                from auth import SECRET_KEY, ALGORITHM
                from database import query_one as _qo, insert as _ins
                uid = 0
                nombre = ""
                auth_header = request.headers.get("authorization", "")
                if auth_header.startswith("Bearer "):
                    payload = _jwt.decode(auth_header[7:], SECRET_KEY, algorithms=[ALGORITHM])
                    uid = int(payload.get("sub", 0))
                    if uid:
                        user = _qo("SELECT nombre FROM sys_usuarios WHERE id=%s", (uid,))
                        nombre = user["nombre"] if user else ""
                parts = path.replace("/api/", "").split("/")
                modulo = parts[0] if parts else path
                if status >= 500:
                    accion = "ERROR"
                    detalle = f"500 {method} {path}"
                elif status == 401:
                    accion = "LOGIN_FALLIDO"
                    detalle = f"Intento fallido {method} {path}"
                elif status == 403:
                    accion = "ACCESO_DENEGADO"
                    detalle = f"Sin permiso {method} {path}"
                elif status in (400, 422):
                    accion = "VALIDACION"
                    detalle = f"{status} {method} {path}"
                else:
                    accion = AUDIT_METHOD_MAP[method]
                    detalle = f"{method} {path}"
                _ins("INSERT INTO sys_audit_log (usuario_id, usuario_nombre, accion, modulo, detalle, ip) VALUES (%s,%s,%s,%s,%s,%s)",
                    (uid, nombre, accion, modulo, detalle[:500], request.client.host if request.client else ""))
            except Exception:
                pass
        return response

app.add_middleware(AuditMiddleware)

# ── Carpeta de imágenes estáticas ─────────────────────────────
UPLOAD_DIR = Path(__file__).parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


# ── Migraciones automáticas ──────────────────────────────────
ALL_MIGRATIONS = []

@app.on_event("startup")
def run_migrations():
    migrations = [
        "ALTER TABLE ven_facturas ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT",
        "ALTER TABLE ven_facturas ADD COLUMN IF NOT EXISTS fecha_anulacion TIMESTAMP",
        "ALTER TABLE ven_facturas ADD COLUMN IF NOT EXISTS anulado_por INTEGER REFERENCES sys_usuarios(id)",
        "ALTER TABLE ven_facturas ADD COLUMN IF NOT EXISTS estado_sri VARCHAR(20) DEFAULT 'NO_ENVIADA'",
        "ALTER TABLE ven_facturas ADD COLUMN IF NOT EXISTS clave_acceso VARCHAR(49)",
        "ALTER TABLE inv_ofertas ADD COLUMN IF NOT EXISTS etiqueta_impresa BOOLEAN DEFAULT false",
        "ALTER TABLE inv_ofertas ADD COLUMN IF NOT EXISTS etiqueta_impresa_at TIMESTAMP",
        "ALTER TABLE inv_precios_historial ADD COLUMN IF NOT EXISTS impreso BOOLEAN DEFAULT false",
        "ALTER TABLE inv_precios_historial ADD COLUMN IF NOT EXISTS impreso_at TIMESTAMP",
        "ALTER TABLE ven_devoluciones ADD COLUMN IF NOT EXISTS clave_acceso VARCHAR(49)",
        "ALTER TABLE ven_devoluciones ADD COLUMN IF NOT EXISTS estado_sri VARCHAR(20) DEFAULT 'NO_ENVIADA'",
        "ALTER TABLE ven_facturas ADD COLUMN IF NOT EXISTS numero_autorizacion VARCHAR(49)",
        "ALTER TABLE ven_facturas ADD COLUMN IF NOT EXISTS fecha_autorizacion TIMESTAMP",
        "ALTER TABLE sys_usuarios ADD COLUMN IF NOT EXISTS rol VARCHAR(20) DEFAULT 'admin'",
        "ALTER TABLE sys_usuarios ADD COLUMN IF NOT EXISTS email VARCHAR(200)",
        "ALTER TABLE sys_usuarios ADD COLUMN IF NOT EXISTS telefono VARCHAR(50)",
        "ALTER TABLE sys_usuarios ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()",
        """CREATE TABLE IF NOT EXISTS sys_permisos_usuario (
            id SERIAL PRIMARY KEY,
            usuario_id INTEGER NOT NULL REFERENCES sys_usuarios(id) ON DELETE CASCADE,
            modulo VARCHAR(50) NOT NULL,
            acciones VARCHAR(200) DEFAULT 'ver,crear,editar,eliminar',
            UNIQUE(usuario_id, modulo)
        )""",
        "ALTER TABLE sys_permisos_usuario ADD COLUMN IF NOT EXISTS acciones VARCHAR(200) DEFAULT 'ver,crear,editar,eliminar'",
        "ALTER TABLE ven_facturas ADD COLUMN IF NOT EXISTS email_enviado BOOLEAN DEFAULT false",
        "ALTER TABLE ven_facturas ADD COLUMN IF NOT EXISTS email_enviado_at TIMESTAMP",
        """CREATE TABLE IF NOT EXISTS sys_config_smtp (
            id SERIAL PRIMARY KEY,
            smtp_host VARCHAR(200) DEFAULT '',
            smtp_port INTEGER DEFAULT 587,
            smtp_user VARCHAR(200) DEFAULT '',
            smtp_password VARCHAR(200) DEFAULT '',
            smtp_from_name VARCHAR(200) DEFAULT '',
            smtp_from_email VARCHAR(200) DEFAULT '',
            smtp_use_tls BOOLEAN DEFAULT true,
            activo BOOLEAN DEFAULT true,
            updated_at TIMESTAMP DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS ven_cotizaciones (
            id SERIAL PRIMARY KEY,
            numero VARCHAR(30) NOT NULL,
            cliente_id INTEGER REFERENCES ven_clientes(id),
            vendedor_id INTEGER REFERENCES ven_vendedores(id),
            sucursal_id INTEGER REFERENCES sys_sucursales(id),
            fecha DATE DEFAULT CURRENT_DATE,
            fecha_validez DATE,
            subtotal_0 NUMERIC(12,2) DEFAULT 0,
            subtotal_iva NUMERIC(12,2) DEFAULT 0,
            iva NUMERIC(12,2) DEFAULT 0,
            total NUMERIC(12,2) DEFAULT 0,
            descuento_global_pct NUMERIC(5,2) DEFAULT 0,
            observaciones TEXT,
            estado VARCHAR(20) DEFAULT 'BORRADOR',
            factura_id INTEGER REFERENCES ven_facturas(id),
            usuario_id INTEGER REFERENCES sys_usuarios(id),
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS ven_cotizacion_detalles (
            id SERIAL PRIMARY KEY,
            cotizacion_id INTEGER REFERENCES ven_cotizaciones(id) ON DELETE CASCADE,
            producto_id INTEGER REFERENCES inv_productos(id),
            descripcion TEXT,
            cantidad NUMERIC(12,4),
            precio_unitario NUMERIC(12,4),
            descuento_pct NUMERIC(5,2) DEFAULT 0,
            subtotal NUMERIC(12,4),
            iva_porcentaje NUMERIC(5,2) DEFAULT 15,
            iva_valor NUMERIC(12,4) DEFAULT 0,
            total NUMERIC(12,4)
        )""",
        """CREATE TABLE IF NOT EXISTS inv_tomas_fisicas (
            id SERIAL PRIMARY KEY,
            numero VARCHAR(30) NOT NULL,
            bodega_id INTEGER REFERENCES inv_bodegas(id),
            sucursal_id INTEGER,
            usuario_id INTEGER REFERENCES sys_usuarios(id),
            fecha TIMESTAMP DEFAULT NOW(),
            estado VARCHAR(20) DEFAULT 'EN_PROCESO',
            observaciones TEXT,
            total_productos INTEGER DEFAULT 0,
            total_diferencias INTEGER DEFAULT 0,
            ajuste_id INTEGER
        )""",
        """CREATE TABLE IF NOT EXISTS inv_toma_fisica_detalles (
            id SERIAL PRIMARY KEY,
            toma_id INTEGER REFERENCES inv_tomas_fisicas(id) ON DELETE CASCADE,
            producto_id INTEGER REFERENCES inv_productos(id),
            stock_sistema NUMERIC(12,4) DEFAULT 0,
            stock_contado NUMERIC(12,4),
            diferencia NUMERIC(12,4) DEFAULT 0,
            observaciones TEXT
        )""",
        """CREATE TABLE IF NOT EXISTS srv_ordenes (
            id SERIAL PRIMARY KEY,
            numero VARCHAR(30) NOT NULL,
            cliente_id INTEGER REFERENCES ven_clientes(id),
            sucursal_id INTEGER,
            usuario_id INTEGER REFERENCES sys_usuarios(id),
            tecnico_id INTEGER REFERENCES ven_vendedores(id),
            fecha_ingreso TIMESTAMP DEFAULT NOW(),
            fecha_estimada DATE,
            fecha_cierre TIMESTAMP,
            equipo_tipo VARCHAR(100),
            equipo_marca VARCHAR(100),
            equipo_modelo VARCHAR(100),
            equipo_serie VARCHAR(100),
            equipo_color VARCHAR(50),
            equipo_password VARCHAR(100),
            accesorios TEXT,
            problema_reportado TEXT NOT NULL,
            diagnostico TEXT,
            solucion TEXT,
            costo_estimado NUMERIC(12,2) DEFAULT 0,
            costo_final NUMERIC(12,2) DEFAULT 0,
            anticipo NUMERIC(12,2) DEFAULT 0,
            estado VARCHAR(20) DEFAULT 'RECIBIDO',
            prioridad VARCHAR(10) DEFAULT 'NORMAL',
            observaciones TEXT,
            factura_id INTEGER,
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS srv_seguimientos (
            id SERIAL PRIMARY KEY,
            orden_id INTEGER REFERENCES srv_ordenes(id) ON DELETE CASCADE,
            usuario_id INTEGER REFERENCES sys_usuarios(id),
            fecha TIMESTAMP DEFAULT NOW(),
            tipo VARCHAR(30) DEFAULT 'NOTA',
            descripcion TEXT NOT NULL,
            estado_anterior VARCHAR(20),
            estado_nuevo VARCHAR(20),
            fotos TEXT
        )""",
        """CREATE TABLE IF NOT EXISTS fin_saldos_favor (
            id SERIAL PRIMARY KEY,
            cliente_id INTEGER REFERENCES ven_clientes(id),
            orden_servicio_id INTEGER,
            tipo VARCHAR(20) DEFAULT 'ANTICIPO',
            monto NUMERIC(12,2),
            saldo NUMERIC(12,2),
            referencia VARCHAR(100),
            fecha TIMESTAMP DEFAULT NOW(),
            usuario_id INTEGER REFERENCES sys_usuarios(id)
        )""",
        """CREATE TABLE IF NOT EXISTS srv_tecnicos (
            id SERIAL PRIMARY KEY,
            codigo VARCHAR(20),
            nombre VARCHAR(200) NOT NULL,
            apellidos VARCHAR(200),
            cedula VARCHAR(20),
            telefono VARCHAR(50),
            email VARCHAR(200),
            especialidad VARCHAR(200),
            sucursal_id INTEGER,
            usuario_id INTEGER,
            activo BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        "ALTER TABLE srv_tecnicos ADD COLUMN IF NOT EXISTS usuario_id INTEGER",
        "ALTER TABLE srv_ordenes DROP CONSTRAINT IF EXISTS srv_ordenes_tecnico_id_fkey",
        """CREATE TABLE IF NOT EXISTS srv_repuestos_usados (
            id SERIAL PRIMARY KEY,
            orden_id INTEGER REFERENCES srv_ordenes(id) ON DELETE CASCADE,
            producto_id INTEGER,
            descripcion VARCHAR(300) NOT NULL,
            cantidad NUMERIC(12,4) DEFAULT 1,
            costo NUMERIC(12,2) DEFAULT 0,
            precio NUMERIC(12,2) DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        "ALTER TABLE srv_ordenes ADD COLUMN IF NOT EXISTS dias_garantia INTEGER DEFAULT 0",
        "ALTER TABLE srv_ordenes ADD COLUMN IF NOT EXISTS condiciones_garantia TEXT",
        """ALTER TABLE srv_ordenes ADD COLUMN IF NOT EXISTS condiciones_recepcion TEXT DEFAULT 'El cliente acepta que los trabajos se realizarán bajo previo diagnóstico. El plazo estimado puede variar según disponibilidad de repuestos.'""",
        """CREATE TABLE IF NOT EXISTS sri_retenciones (
            id SERIAL PRIMARY KEY,
            tipo VARCHAR(10) NOT NULL,
            numero VARCHAR(30),
            factura_id INTEGER,
            compra_id INTEGER,
            cliente_id INTEGER,
            proveedor_id INTEGER,
            sucursal_id INTEGER,
            usuario_id INTEGER,
            fecha_emision DATE DEFAULT CURRENT_DATE,
            periodo_fiscal VARCHAR(7),
            estado VARCHAR(20) DEFAULT 'EMITIDA',
            estado_sri VARCHAR(20) DEFAULT 'NO_ENVIADA',
            clave_acceso VARCHAR(49),
            numero_autorizacion VARCHAR(49),
            total_retenido NUMERIC(12,2) DEFAULT 0,
            observaciones TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS sri_retencion_detalles (
            id SERIAL PRIMARY KEY,
            retencion_id INTEGER REFERENCES sri_retenciones(id) ON DELETE CASCADE,
            tipo_impuesto VARCHAR(10) NOT NULL,
            codigo_retencion VARCHAR(10) NOT NULL,
            porcentaje NUMERIC(5,2) NOT NULL,
            base_imponible NUMERIC(12,2) NOT NULL,
            valor_retenido NUMERIC(12,2) NOT NULL
        )""",
        # ── Lotes y Vencimientos ──
        """CREATE TABLE IF NOT EXISTS inv_lotes (
            id SERIAL PRIMARY KEY,
            producto_id INTEGER REFERENCES inv_productos(id),
            bodega_id INTEGER,
            lote VARCHAR(50) NOT NULL,
            fecha_fabricacion DATE,
            fecha_vencimiento DATE,
            cantidad NUMERIC(12,4) DEFAULT 0,
            estado VARCHAR(20) DEFAULT 'DISPONIBLE',
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        "ALTER TABLE inv_productos ADD COLUMN IF NOT EXISTS costo NUMERIC(12,4) DEFAULT 0",
        "ALTER TABLE inv_productos ADD COLUMN IF NOT EXISTS maneja_lotes BOOLEAN DEFAULT false",
        # ── Unidades de Medida ──
        """CREATE TABLE IF NOT EXISTS inv_unidades_medida (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR(50) NOT NULL,
            abreviatura VARCHAR(10) NOT NULL,
            activa BOOLEAN DEFAULT true
        )""",
        """INSERT INTO inv_unidades_medida (nombre, abreviatura)
        SELECT * FROM (VALUES
            ('Unidad','UND'),('Caja','CJA'),('Docena','DOC'),
            ('Kilogramo','KG'),('Litro','LT'),('Metro','MT'),
            ('Par','PAR'),('Paquete','PAQ'),('Rollo','ROL')
        ) AS t(nombre, abreviatura)
        WHERE NOT EXISTS (SELECT 1 FROM inv_unidades_medida LIMIT 1)""",
        "ALTER TABLE inv_productos ADD COLUMN IF NOT EXISTS unidad_medida_id INTEGER",
        "ALTER TABLE inv_productos ADD COLUMN IF NOT EXISTS factor_conversion NUMERIC(12,4) DEFAULT 1",
        # ── Guias de Remision (tipo 06) ──
        """CREATE TABLE IF NOT EXISTS ven_guias_remision (
            id SERIAL PRIMARY KEY, numero VARCHAR(30), factura_id INTEGER,
            cliente_id INTEGER, sucursal_id INTEGER, usuario_id INTEGER,
            fecha_emision DATE DEFAULT CURRENT_DATE, fecha_inicio_transporte DATE,
            fecha_fin_transporte DATE,
            transportista_ruc VARCHAR(13), transportista_razon VARCHAR(200),
            placa VARCHAR(20), ruta TEXT,
            dir_partida TEXT, dir_destino TEXT,
            motivo TEXT DEFAULT 'Venta',
            estado VARCHAR(20) DEFAULT 'EMITIDA',
            estado_sri VARCHAR(20) DEFAULT 'NO_ENVIADA',
            clave_acceso VARCHAR(49),
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS ven_guia_remision_detalles (
            id SERIAL PRIMARY KEY, guia_id INTEGER REFERENCES ven_guias_remision(id) ON DELETE CASCADE,
            producto_id INTEGER, descripcion TEXT, cantidad NUMERIC(12,4)
        )""",
        "ALTER TABLE sys_sucursales ADD COLUMN IF NOT EXISTS secuencial_guia_remision INTEGER DEFAULT 1",
        # ── Liquidaciones de Compra (tipo 03) ──
        """CREATE TABLE IF NOT EXISTS com_liquidaciones (
            id SERIAL PRIMARY KEY, numero VARCHAR(30),
            proveedor_nombre VARCHAR(200) NOT NULL, proveedor_ruc VARCHAR(13),
            proveedor_direccion TEXT,
            sucursal_id INTEGER, usuario_id INTEGER,
            fecha_emision DATE DEFAULT CURRENT_DATE,
            subtotal_0 NUMERIC(12,2) DEFAULT 0, subtotal_iva NUMERIC(12,2) DEFAULT 0,
            iva NUMERIC(12,2) DEFAULT 0, total NUMERIC(12,2) DEFAULT 0,
            estado VARCHAR(20) DEFAULT 'EMITIDA',
            estado_sri VARCHAR(20) DEFAULT 'NO_ENVIADA',
            clave_acceso VARCHAR(49),
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS com_liquidacion_detalles (
            id SERIAL PRIMARY KEY, liquidacion_id INTEGER REFERENCES com_liquidaciones(id) ON DELETE CASCADE,
            descripcion TEXT, cantidad NUMERIC(12,4), precio_unitario NUMERIC(12,4),
            iva_porcentaje NUMERIC(5,2) DEFAULT 15,
            subtotal NUMERIC(12,2), iva_valor NUMERIC(12,2), total NUMERIC(12,2)
        )""",
        "ALTER TABLE sys_sucursales ADD COLUMN IF NOT EXISTS secuencial_liquidacion INTEGER DEFAULT 1",
        # ── Multi-Moneda (Multi-Currency) ──
        """CREATE TABLE IF NOT EXISTS cont_monedas (
            id SERIAL PRIMARY KEY,
            codigo VARCHAR(5) NOT NULL UNIQUE,
            nombre VARCHAR(50) NOT NULL,
            simbolo VARCHAR(5) DEFAULT '$',
            es_base BOOLEAN DEFAULT false,
            activa BOOLEAN DEFAULT true
        )""",
        """CREATE TABLE IF NOT EXISTS cont_tipos_cambio (
            id SERIAL PRIMARY KEY,
            moneda_id INTEGER REFERENCES cont_monedas(id),
            fecha DATE NOT NULL,
            tasa NUMERIC(12,6) NOT NULL,
            UNIQUE(moneda_id, fecha)
        )""",
        "ALTER TABLE cont_asiento_detalles ADD COLUMN IF NOT EXISTS moneda_id INTEGER",
        "ALTER TABLE cont_asiento_detalles ADD COLUMN IF NOT EXISTS monto_moneda NUMERIC(12,2)",
        "ALTER TABLE cont_asiento_detalles ADD COLUMN IF NOT EXISTS tasa_cambio NUMERIC(12,6)",
        """INSERT INTO cont_monedas (codigo, nombre, simbolo, es_base) VALUES
            ('USD', 'Dolar Estadounidense', '$', true),
            ('EUR', 'Euro', '€', false),
            ('COP', 'Peso Colombiano', 'COP', false),
            ('PEN', 'Sol Peruano', 'S/', false)
        ON CONFLICT DO NOTHING""",
        # ── Multi-Empresa / Consolidacion ──
        """CREATE TABLE IF NOT EXISTS cont_empresas_grupo (
            id SERIAL PRIMARY KEY,
            empresa_id INTEGER,
            nombre VARCHAR(200) NOT NULL,
            ruc VARCHAR(13),
            es_matriz BOOLEAN DEFAULT false,
            activa BOOLEAN DEFAULT true
        )""",
        "ALTER TABLE ven_facturas ADD COLUMN IF NOT EXISTS notas_internas TEXT",
        "ALTER TABLE com_compras ADD COLUMN IF NOT EXISTS estado_recepcion VARCHAR(20) DEFAULT 'COMPLETA'",
        "ALTER TABLE com_compras ADD COLUMN IF NOT EXISTS calificacion_proveedor INTEGER",
        """CREATE TABLE IF NOT EXISTS ven_facturas_recurrentes (
            id SERIAL PRIMARY KEY,
            cliente_id INTEGER REFERENCES ven_clientes(id),
            vendedor_id INTEGER,
            sucursal_id INTEGER,
            frecuencia VARCHAR(20) DEFAULT 'MENSUAL',
            dia_emision INTEGER DEFAULT 1,
            proximo_emision DATE,
            descripcion TEXT,
            detalles_json TEXT,
            activa BOOLEAN DEFAULT true,
            total NUMERIC(12,2) DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        # ── Audit Log ──
        """CREATE TABLE IF NOT EXISTS sys_audit_log (
            id SERIAL PRIMARY KEY,
            usuario_id INTEGER,
            usuario_nombre VARCHAR(200),
            accion VARCHAR(30) NOT NULL,
            modulo VARCHAR(50),
            detalle TEXT,
            ip VARCHAR(50),
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        "CREATE INDEX IF NOT EXISTS idx_audit_fecha ON sys_audit_log(created_at DESC)",
        "CREATE INDEX IF NOT EXISTS idx_audit_usuario ON sys_audit_log(usuario_id)",
        "ALTER TABLE fin_movimientos_bancarios ALTER COLUMN tipo TYPE VARCHAR(50)",
        "ALTER TABLE fin_movimientos_bancarios ALTER COLUMN concepto TYPE VARCHAR(500)",
        # ── Ordenes de Compra ──
        """CREATE TABLE IF NOT EXISTS com_ordenes_compra (
            id SERIAL PRIMARY KEY,
            numero VARCHAR(30) NOT NULL,
            proveedor_id INTEGER,
            sucursal_id INTEGER,
            bodega_id INTEGER,
            fecha_emision DATE DEFAULT CURRENT_DATE,
            fecha_vencimiento DATE,
            plazo_dias INTEGER DEFAULT 30,
            subtotal_0 NUMERIC(12,2) DEFAULT 0,
            subtotal_iva NUMERIC(12,2) DEFAULT 0,
            iva NUMERIC(12,2) DEFAULT 0,
            total NUMERIC(12,2) DEFAULT 0,
            descuento_global_pct NUMERIC(5,2) DEFAULT 0,
            observaciones TEXT,
            estado VARCHAR(20) DEFAULT 'PENDIENTE',
            usuario_id INTEGER,
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS com_orden_compra_detalles (
            id SERIAL PRIMARY KEY,
            orden_compra_id INTEGER REFERENCES com_ordenes_compra(id) ON DELETE CASCADE,
            producto_id INTEGER,
            descripcion TEXT,
            cantidad NUMERIC(12,4),
            precio_unitario NUMERIC(12,4),
            descuento_pct NUMERIC(5,2) DEFAULT 0,
            subtotal NUMERIC(12,2),
            iva_porcentaje NUMERIC(5,2) DEFAULT 15,
            iva_valor NUMERIC(12,2) DEFAULT 0,
            total NUMERIC(12,2)
        )""",
        "ALTER TABLE sys_sucursales ADD COLUMN IF NOT EXISTS secuencial_orden_compra INTEGER DEFAULT 0",
        # ── Notas de Venta ──
        """CREATE TABLE IF NOT EXISTS ven_notas_venta (
            id SERIAL PRIMARY KEY,
            numero VARCHAR(30) NOT NULL,
            cliente_id INTEGER REFERENCES ven_clientes(id),
            vendedor_id INTEGER,
            sucursal_id INTEGER,
            bodega_id INTEGER,
            fecha DATE DEFAULT CURRENT_DATE,
            subtotal_0 NUMERIC(12,2) DEFAULT 0,
            subtotal_iva NUMERIC(12,2) DEFAULT 0,
            iva NUMERIC(12,2) DEFAULT 0,
            total NUMERIC(12,2) DEFAULT 0,
            descuento_global_pct NUMERIC(5,2) DEFAULT 0,
            observaciones TEXT,
            estado VARCHAR(20) DEFAULT 'EMITIDA',
            usuario_id INTEGER,
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS ven_nota_venta_detalles (
            id SERIAL PRIMARY KEY,
            nota_venta_id INTEGER REFERENCES ven_notas_venta(id) ON DELETE CASCADE,
            producto_id INTEGER,
            descripcion TEXT,
            cantidad NUMERIC(12,4),
            precio_unitario NUMERIC(12,4),
            descuento_pct NUMERIC(5,2) DEFAULT 0,
            subtotal NUMERIC(12,2),
            iva_porcentaje NUMERIC(5,2) DEFAULT 15,
            iva_valor NUMERIC(12,2) DEFAULT 0,
            total NUMERIC(12,2)
        )""",
        "ALTER TABLE sys_sucursales ADD COLUMN IF NOT EXISTS secuencial_nota_venta INTEGER DEFAULT 0",
        # ── Depositos Bancarios ──
        """CREATE TABLE IF NOT EXISTS fin_depositos (
            id SERIAL PRIMARY KEY,
            cuenta_bancaria_id INTEGER,
            fecha DATE DEFAULT CURRENT_DATE,
            total NUMERIC(12,2) DEFAULT 0,
            cantidad_pagos INTEGER DEFAULT 0,
            metodos_pago VARCHAR(200),
            referencia VARCHAR(200),
            observaciones TEXT,
            estado VARCHAR(20) DEFAULT 'PENDIENTE',
            fecha_confirmacion TIMESTAMP,
            usuario_id INTEGER,
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS fin_deposito_pagos (
            id SERIAL PRIMARY KEY,
            deposito_id INTEGER REFERENCES fin_depositos(id) ON DELETE CASCADE,
            pago_id INTEGER,
            monto NUMERIC(12,2)
        )""",
        "ALTER TABLE ven_pagos ADD COLUMN IF NOT EXISTS pendiente_deposito BOOLEAN DEFAULT true",
        "ALTER TABLE ven_pagos ADD COLUMN IF NOT EXISTS liquidacion_id INTEGER",
        # ── Solicitudes Demo ──
        """CREATE TABLE IF NOT EXISTS sys_solicitudes_demo (
            id SERIAL PRIMARY KEY,
            empresa_nombre VARCHAR(300) NOT NULL,
            ruc VARCHAR(13),
            email VARCHAR(200),
            telefono VARCHAR(50),
            contacto_nombre VARCHAR(200),
            giro_negocio VARCHAR(100),
            ciudad VARCHAR(100),
            estado VARCHAR(20) DEFAULT 'NUEVA',
            notas TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        # ── WhatsApp ──
        """CREATE TABLE IF NOT EXISTS sys_whatsapp_config (
            id SERIAL PRIMARY KEY,
            phone_number_id VARCHAR(50),
            api_token VARCHAR(500),
            business_name VARCHAR(200),
            default_country_code VARCHAR(5) DEFAULT '593',
            activo BOOLEAN DEFAULT true,
            updated_at TIMESTAMP DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS sys_whatsapp_plantillas (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR(200) NOT NULL,
            tipo VARCHAR(30) NOT NULL,
            contenido TEXT NOT NULL,
            activa BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS sys_whatsapp_log (
            id SERIAL PRIMARY KEY,
            telefono VARCHAR(20),
            mensaje TEXT,
            tipo VARCHAR(20) DEFAULT 'TEXTO',
            estado VARCHAR(20) DEFAULT 'ENVIADO',
            respuesta TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        """INSERT INTO sys_whatsapp_plantillas (nombre, tipo, contenido)
        SELECT * FROM (VALUES
            ('Factura emitida', 'FACTURA', 'Hola {cliente_nombre}, se ha emitido su factura {numero_factura} por ${total}. Gracias por su compra.'),
            ('Recordatorio de cobro', 'COBRO', 'Hola {cliente_nombre}, le recordamos que tiene un saldo pendiente de ${saldo} con vencimiento {fecha_vencimiento}.'),
            ('Bienvenida', 'BIENVENIDA', 'Bienvenido/a {cliente_nombre} a nuestra empresa. Estamos para servirle.'),
            ('Cita servicio tecnico', 'CITA', 'Hola {cliente_nombre}, su equipo {equipo} esta listo para retirar. Orden #{numero_orden}.')
        ) AS t(nombre, tipo, contenido)
        WHERE NOT EXISTS (SELECT 1 FROM sys_whatsapp_plantillas LIMIT 1)""",
        "ALTER TABLE nom_permisos ALTER COLUMN modalidad TYPE VARCHAR(20)",
        """CREATE TABLE IF NOT EXISTS cont_config_cuentas (
            id SERIAL PRIMARY KEY,
            -- Ventas / Ingresos
            ventas_ingreso_id INTEGER REFERENCES cont_plan_cuentas(id),
            ventas_iva_cobrado_id INTEGER REFERENCES cont_plan_cuentas(id),
            ventas_cxc_id INTEGER REFERENCES cont_plan_cuentas(id),
            ventas_caja_id INTEGER REFERENCES cont_plan_cuentas(id),
            ventas_banco_id INTEGER REFERENCES cont_plan_cuentas(id),
            ventas_descuento_id INTEGER REFERENCES cont_plan_cuentas(id),
            -- Compras
            compras_inventario_id INTEGER REFERENCES cont_plan_cuentas(id),
            compras_iva_pagado_id INTEGER REFERENCES cont_plan_cuentas(id),
            compras_cxp_id INTEGER REFERENCES cont_plan_cuentas(id),
            compras_costo_ventas_id INTEGER REFERENCES cont_plan_cuentas(id),
            -- Nomina
            nomina_sueldos_gasto_id INTEGER REFERENCES cont_plan_cuentas(id),
            nomina_sueldos_pagar_id INTEGER REFERENCES cont_plan_cuentas(id),
            nomina_iess_patronal_gasto_id INTEGER REFERENCES cont_plan_cuentas(id),
            nomina_iess_pagar_id INTEGER REFERENCES cont_plan_cuentas(id),
            nomina_decimos_pagar_id INTEGER REFERENCES cont_plan_cuentas(id),
            nomina_fondos_reserva_id INTEGER REFERENCES cont_plan_cuentas(id),
            -- Caja y Bancos
            caja_id INTEGER REFERENCES cont_plan_cuentas(id),
            banco_id INTEGER REFERENCES cont_plan_cuentas(id),
            -- Retenciones
            retencion_ir_id INTEGER REFERENCES cont_plan_cuentas(id),
            retencion_iva_id INTEGER REFERENCES cont_plan_cuentas(id),
            -- Impuestos
            iva_por_pagar_id INTEGER REFERENCES cont_plan_cuentas(id),
            updated_at TIMESTAMP DEFAULT NOW()
        )""",
        "INSERT INTO cont_config_cuentas (id) SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM cont_config_cuentas)",
        # Config por vendedor: SMTP + WhatsApp Evolution API
        """CREATE TABLE IF NOT EXISTS crm_config_vendedor (
            id SERIAL PRIMARY KEY,
            vendedor_id INTEGER REFERENCES ven_vendedores(id) ON DELETE CASCADE UNIQUE,
            smtp_host VARCHAR(200),
            smtp_port INTEGER DEFAULT 587,
            smtp_user VARCHAR(200),
            smtp_password VARCHAR(500),
            smtp_tls BOOLEAN DEFAULT true,
            smtp_from_nombre VARCHAR(200),
            wa_instancia VARCHAR(100),
            wa_conectado BOOLEAN DEFAULT false,
            wa_telefono VARCHAR(30),
            evolution_url VARCHAR(300),
            evolution_key VARCHAR(300),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )""",
        # Historial de comunicaciones CRM
        """CREATE TABLE IF NOT EXISTS crm_comunicaciones (
            id SERIAL PRIMARY KEY,
            cliente_id INTEGER REFERENCES ven_clientes(id),
            lead_id INTEGER,
            vendedor_id INTEGER REFERENCES ven_vendedores(id),
            tipo VARCHAR(20) NOT NULL,
            direccion VARCHAR(200),
            asunto VARCHAR(500),
            contenido TEXT,
            estado VARCHAR(20) DEFAULT 'ENVIADO',
            error_msg TEXT,
            wa_msg_id VARCHAR(200),
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        # Biométrico — dispositivos
        """CREATE TABLE IF NOT EXISTS nom_biometricos (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR(100) NOT NULL,
            marca VARCHAR(30) DEFAULT 'ZKTeco',
            sucursal_id INTEGER REFERENCES sys_sucursales(id),
            device_id VARCHAR(50) DEFAULT '',
            descripcion TEXT,
            activo BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        # Biométrico — mapeo usuario biométrico ↔ empleado
        """CREATE TABLE IF NOT EXISTS nom_bio_mapeo (
            id SERIAL PRIMARY KEY,
            biometrico_id INTEGER NOT NULL REFERENCES nom_biometricos(id) ON DELETE CASCADE,
            bio_user_id VARCHAR(50) NOT NULL,
            empleado_id INTEGER NOT NULL REFERENCES nom_empleados(id) ON DELETE CASCADE,
            UNIQUE(biometrico_id, bio_user_id)
        )""",
        # Biométrico — registros de asistencia
        """CREATE TABLE IF NOT EXISTS nom_asistencia (
            id SERIAL PRIMARY KEY,
            empleado_id INTEGER NOT NULL REFERENCES nom_empleados(id) ON DELETE CASCADE,
            biometrico_id INTEGER REFERENCES nom_biometricos(id),
            fecha DATE NOT NULL,
            hora_entrada TIMESTAMP,
            hora_salida TIMESTAMP,
            horas_trabajadas NUMERIC(5,2) DEFAULT 0,
            horas_extras_50 NUMERIC(5,2) DEFAULT 0,
            horas_extras_100 NUMERIC(5,2) DEFAULT 0,
            estado VARCHAR(20) DEFAULT 'NORMAL',
            observacion TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(empleado_id, fecha, biometrico_id)
        )""",
    ]
    ALL_MIGRATIONS.extend(migrations)
    for sql in migrations:
        try:
            execute(sql)
        except:
            pass


# ── Fecha/hora del servidor (no manipulable) ─────────────────
from fastapi.responses import JSONResponse
@app.get("/api/server-time")
def server_time():
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone(timedelta(hours=-5)))
    return JSONResponse({
        "datetime": now.isoformat(),
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%H:%M:%S"),
        "year": now.year,
        "month": now.month,
        "day": now.day,
    })


# ── Registrar routers ─────────────────────────────────────────
app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(productos.router)
app.include_router(clientes.router)
app.include_router(proveedores.router)
app.include_router(vendedores.router)
app.include_router(facturas.router)
app.include_router(inventario.router)
app.include_router(compras.router)
app.include_router(devoluciones.router)
app.include_router(transferencias.router)
app.include_router(ajustes.router)
app.include_router(cxc.router)
app.include_router(cxp.router)
app.include_router(caja.router)
app.include_router(bancos.router)
app.include_router(conciliacion.router)
app.include_router(configuracion.router)
app.include_router(etiquetas.router)
app.include_router(sri.router)
app.include_router(usuarios.router)
app.include_router(reportes.router)
app.include_router(kardex.router)
app.include_router(cotizaciones.router)
app.include_router(toma_fisica.router)
app.include_router(servicio_tecnico.router)
app.include_router(crm.router)
app.include_router(retenciones.router)
app.include_router(notas_debito.router)
app.include_router(contabilidad.router)
app.include_router(guias_remision.router)
app.include_router(liquidaciones.router)
app.include_router(nomina.router)
app.include_router(admin.router)
app.include_router(whatsapp.router)
app.include_router(depositos.router)
app.include_router(notas_venta.router)
app.include_router(ordenes_compra.router)
app.include_router(crm_comunicaciones.router)
app.include_router(biometrico.router)
if MULTI_TENANT:
    app.include_router(superadmin.router)

# ── Multi-Tenant startup ────────────────────────────────────
@app.on_event("startup")
def init_multitenant():
    if MULTI_TENANT:
        from multitenant import init_master_tables, ensure_superadmin
        init_master_tables()
        ensure_superadmin()

# ── Migraciones Notas Débito + Contabilidad ──────────────────
_nd_ct_migrations = [
    """CREATE TABLE IF NOT EXISTS ven_notas_debito (
        id SERIAL PRIMARY KEY, numero VARCHAR(30) NOT NULL,
        cliente_id INTEGER, factura_id INTEGER, sucursal_id INTEGER, usuario_id INTEGER,
        fecha_emision DATE DEFAULT CURRENT_DATE,
        subtotal_0 NUMERIC(12,2) DEFAULT 0, subtotal_iva NUMERIC(12,2) DEFAULT 0,
        iva NUMERIC(12,2) DEFAULT 0, total NUMERIC(12,2) DEFAULT 0,
        motivo TEXT NOT NULL, estado VARCHAR(20) DEFAULT 'EMITIDA',
        estado_sri VARCHAR(20) DEFAULT 'NO_ENVIADA', clave_acceso VARCHAR(49),
        created_at TIMESTAMP DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS ven_nota_debito_detalles (
        id SERIAL PRIMARY KEY, nota_debito_id INTEGER REFERENCES ven_notas_debito(id) ON DELETE CASCADE,
        descripcion TEXT NOT NULL, cantidad NUMERIC(12,4) DEFAULT 1,
        precio_unitario NUMERIC(12,4), iva_porcentaje NUMERIC(5,2) DEFAULT 15,
        subtotal NUMERIC(12,2), iva_valor NUMERIC(12,2), total NUMERIC(12,2)
    )""",
    """CREATE TABLE IF NOT EXISTS cont_plan_cuentas (
        id SERIAL PRIMARY KEY, codigo VARCHAR(20) NOT NULL UNIQUE,
        nombre VARCHAR(200) NOT NULL, tipo VARCHAR(20) NOT NULL,
        naturaleza VARCHAR(10) NOT NULL, padre_id INTEGER,
        nivel INTEGER DEFAULT 1, es_movimiento BOOLEAN DEFAULT false,
        activa BOOLEAN DEFAULT true
    )""",
    """CREATE TABLE IF NOT EXISTS cont_asientos (
        id SERIAL PRIMARY KEY, numero VARCHAR(30) NOT NULL,
        fecha DATE NOT NULL DEFAULT CURRENT_DATE, descripcion TEXT NOT NULL,
        tipo VARCHAR(30), referencia_tipo VARCHAR(30), referencia_id INTEGER,
        estado VARCHAR(20) DEFAULT 'BORRADOR', usuario_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS cont_asiento_detalles (
        id SERIAL PRIMARY KEY, asiento_id INTEGER REFERENCES cont_asientos(id) ON DELETE CASCADE,
        cuenta_id INTEGER, descripcion TEXT,
        debe NUMERIC(12,2) DEFAULT 0, haber NUMERIC(12,2) DEFAULT 0
    )""",
    """CREATE TABLE IF NOT EXISTS cont_centros_costo (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(20) NOT NULL,
        nombre VARCHAR(200) NOT NULL,
        padre_id INTEGER,
        activo BOOLEAN DEFAULT true
    )""",
    """ALTER TABLE cont_asiento_detalles ADD COLUMN IF NOT EXISTS centro_costo_id INTEGER""",
    """CREATE TABLE IF NOT EXISTS cont_presupuestos (
        id SERIAL PRIMARY KEY,
        anio INTEGER NOT NULL,
        cuenta_id INTEGER REFERENCES cont_plan_cuentas(id),
        centro_costo_id INTEGER,
        mes_01 NUMERIC(12,2) DEFAULT 0, mes_02 NUMERIC(12,2) DEFAULT 0,
        mes_03 NUMERIC(12,2) DEFAULT 0, mes_04 NUMERIC(12,2) DEFAULT 0,
        mes_05 NUMERIC(12,2) DEFAULT 0, mes_06 NUMERIC(12,2) DEFAULT 0,
        mes_07 NUMERIC(12,2) DEFAULT 0, mes_08 NUMERIC(12,2) DEFAULT 0,
        mes_09 NUMERIC(12,2) DEFAULT 0, mes_10 NUMERIC(12,2) DEFAULT 0,
        mes_11 NUMERIC(12,2) DEFAULT 0, mes_12 NUMERIC(12,2) DEFAULT 0,
        UNIQUE(anio, cuenta_id, centro_costo_id)
    )""",
]
@app.on_event("startup")
def run_nd_ct_migrations():
    ALL_MIGRATIONS.extend(_nd_ct_migrations)
    for sql in _nd_ct_migrations:
        try: execute(sql)
        except: pass

# ── Migraciones CRM (separadas para claridad) ────────────────
_crm_migrations = [
    """CREATE TABLE IF NOT EXISTS crm_etapas (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        color VARCHAR(20) DEFAULT '#3B82F6',
        orden INTEGER DEFAULT 0,
        es_ganada BOOLEAN DEFAULT false,
        es_perdida BOOLEAN DEFAULT false,
        activa BOOLEAN DEFAULT true
    )""",
    """CREATE TABLE IF NOT EXISTS crm_oportunidades (
        id SERIAL PRIMARY KEY,
        titulo VARCHAR(300) NOT NULL,
        cliente_id INTEGER REFERENCES ven_clientes(id),
        vendedor_id INTEGER,
        etapa_id INTEGER,
        valor_estimado NUMERIC(12,2) DEFAULT 0,
        probabilidad INTEGER DEFAULT 50,
        fecha_cierre_estimada DATE,
        fecha_cierre_real DATE,
        fuente VARCHAR(50),
        notas TEXT,
        estado VARCHAR(20) DEFAULT 'ABIERTA',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS crm_actividades (
        id SERIAL PRIMARY KEY,
        oportunidad_id INTEGER,
        cliente_id INTEGER,
        vendedor_id INTEGER,
        tipo VARCHAR(30) NOT NULL,
        titulo VARCHAR(300) NOT NULL,
        descripcion TEXT,
        fecha_programada TIMESTAMP,
        fecha_completada TIMESTAMP,
        duracion_min INTEGER DEFAULT 0,
        resultado TEXT,
        canal VARCHAR(30),
        referencia VARCHAR(200),
        estado VARCHAR(20) DEFAULT 'PENDIENTE',
        created_at TIMESTAMP DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS crm_notas (
        id SERIAL PRIMARY KEY,
        oportunidad_id INTEGER,
        cliente_id INTEGER,
        usuario_id INTEGER,
        contenido TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
    )""",
]
@app.on_event("startup")
def run_crm_migrations():
    ALL_MIGRATIONS.extend(_crm_migrations)
    for sql in _crm_migrations:
        try: execute(sql)
        except: pass
    try:
        existing = query_one("SELECT COUNT(*) as n FROM crm_etapas")
        if existing and existing["n"] == 0:
            for nombre, color, orden, ganada, perdida in [
                ('Prospecto','#6B7280',1,False,False),
                ('Contactado','#3B82F6',2,False,False),
                ('Propuesta','#8B5CF6',3,False,False),
                ('Negociación','#F59E0B',4,False,False),
                ('Ganada','#10B981',5,True,False),
                ('Perdida','#EF4444',6,False,True),
            ]:
                insert("INSERT INTO crm_etapas (nombre,color,orden,es_ganada,es_perdida) VALUES (%s,%s,%s,%s,%s)",
                       (nombre, color, orden, ganada, perdida))
    except: pass

# ── Migraciones CRM v2: Automatizaciones, Historial, Plantillas, Score ──
_crm_v2_migrations = [
    """CREATE TABLE IF NOT EXISTS crm_automatizaciones (
        id SERIAL PRIMARY KEY,
        etapa_id INTEGER,
        accion VARCHAR(30) NOT NULL,
        config TEXT,
        activa BOOLEAN DEFAULT true
    )""",
    """CREATE TABLE IF NOT EXISTS crm_historial_etapas (
        id SERIAL PRIMARY KEY,
        oportunidad_id INTEGER,
        etapa_anterior_id INTEGER,
        etapa_nueva_id INTEGER,
        usuario_id INTEGER,
        fecha TIMESTAMP DEFAULT NOW(),
        tiempo_en_etapa_horas NUMERIC(12,2) DEFAULT 0
    )""",
    """CREATE TABLE IF NOT EXISTS crm_plantillas (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(200) NOT NULL,
        tipo VARCHAR(20) NOT NULL,
        asunto VARCHAR(300),
        contenido TEXT NOT NULL,
        activa BOOLEAN DEFAULT true
    )""",
    "ALTER TABLE crm_oportunidades ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0",
    "ALTER TABLE crm_oportunidades ADD COLUMN IF NOT EXISTS cotizacion_id INTEGER",
]
@app.on_event("startup")
def run_crm_v2_migrations():
    ALL_MIGRATIONS.extend(_crm_v2_migrations)
    for sql in _crm_v2_migrations:
        try: execute(sql)
        except: pass

# ── Migraciones Nómina (RRHH — Ecuador) ────────────────────────
_nomina_migrations = [
    """CREATE TABLE IF NOT EXISTS nom_empleados (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(20),
        cedula VARCHAR(15) NOT NULL,
        nombres VARCHAR(200) NOT NULL,
        apellidos VARCHAR(200) NOT NULL,
        fecha_nacimiento DATE,
        genero VARCHAR(10),
        estado_civil VARCHAR(20),
        direccion TEXT,
        telefono VARCHAR(50),
        email VARCHAR(200),
        cargo VARCHAR(200),
        departamento VARCHAR(200),
        sucursal_id INTEGER,
        fecha_ingreso DATE NOT NULL,
        fecha_salida DATE,
        tipo_contrato VARCHAR(30) DEFAULT 'INDEFINIDO',
        salario_base NUMERIC(12,2) NOT NULL,
        tiene_fondos_reserva BOOLEAN DEFAULT false,
        decimo_tercero_acumulado BOOLEAN DEFAULT true,
        decimo_cuarto_acumulado BOOLEAN DEFAULT true,
        region VARCHAR(20) DEFAULT 'SIERRA',
        num_cargas_familiares INTEGER DEFAULT 0,
        cuenta_bancaria VARCHAR(30),
        banco VARCHAR(100),
        tipo_cuenta VARCHAR(20),
        usuario_id INTEGER,
        vendedor_id INTEGER,
        tecnico_id INTEGER,
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS nom_roles_pago (
        id SERIAL PRIMARY KEY,
        empleado_id INTEGER REFERENCES nom_empleados(id),
        periodo VARCHAR(7) NOT NULL,
        fecha_pago DATE,
        dias_trabajados INTEGER DEFAULT 30,
        salario_base NUMERIC(12,2),
        horas_extras_50 NUMERIC(12,2) DEFAULT 0,
        horas_extras_100 NUMERIC(12,2) DEFAULT 0,
        valor_horas_extras_50 NUMERIC(12,2) DEFAULT 0,
        valor_horas_extras_100 NUMERIC(12,2) DEFAULT 0,
        comisiones NUMERIC(12,2) DEFAULT 0,
        bonificaciones NUMERIC(12,2) DEFAULT 0,
        total_ingresos NUMERIC(12,2) DEFAULT 0,
        aporte_iess_personal NUMERIC(12,2) DEFAULT 0,
        aporte_iess_patronal NUMERIC(12,2) DEFAULT 0,
        prestamos_iess NUMERIC(12,2) DEFAULT 0,
        prestamos_empresa NUMERIC(12,2) DEFAULT 0,
        anticipo NUMERIC(12,2) DEFAULT 0,
        otros_descuentos NUMERIC(12,2) DEFAULT 0,
        total_descuentos NUMERIC(12,2) DEFAULT 0,
        neto_a_pagar NUMERIC(12,2) DEFAULT 0,
        decimo_tercero NUMERIC(12,2) DEFAULT 0,
        decimo_cuarto NUMERIC(12,2) DEFAULT 0,
        fondos_reserva NUMERIC(12,2) DEFAULT 0,
        vacaciones_provision NUMERIC(12,2) DEFAULT 0,
        estado VARCHAR(20) DEFAULT 'BORRADOR',
        created_at TIMESTAMP DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS nom_vacaciones (
        id SERIAL PRIMARY KEY,
        empleado_id INTEGER REFERENCES nom_empleados(id),
        fecha_inicio DATE NOT NULL,
        fecha_fin DATE NOT NULL,
        dias_tomados INTEGER NOT NULL,
        dias_derecho INTEGER NOT NULL,
        valor NUMERIC(12,2) DEFAULT 0,
        estado VARCHAR(20) DEFAULT 'APROBADA',
        observaciones TEXT,
        created_at TIMESTAMP DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS nom_config (
        id SERIAL PRIMARY KEY,
        sbu NUMERIC(12,2) DEFAULT 470,
        aporte_personal_pct NUMERIC(5,2) DEFAULT 9.45,
        aporte_patronal_pct NUMERIC(5,2) DEFAULT 11.15,
        fondos_reserva_pct NUMERIC(5,2) DEFAULT 8.33,
        anio INTEGER DEFAULT 2026,
        updated_at TIMESTAMP DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS nom_prestamos (
        id SERIAL PRIMARY KEY,
        empleado_id INTEGER REFERENCES nom_empleados(id),
        tipo VARCHAR(20) DEFAULT 'ANTICIPO',
        monto_total NUMERIC(12,2) NOT NULL,
        cuotas INTEGER DEFAULT 1,
        monto_cuota NUMERIC(12,2),
        saldo NUMERIC(12,2),
        cuotas_pagadas INTEGER DEFAULT 0,
        fecha DATE DEFAULT CURRENT_DATE,
        estado VARCHAR(20) DEFAULT 'ACTIVO',
        observaciones TEXT,
        created_at TIMESTAMP DEFAULT NOW()
    )""",
]
@app.on_event("startup")
def run_nomina_migrations():
    ALL_MIGRATIONS.extend(_nomina_migrations)
    for sql in _nomina_migrations:
        try: execute(sql)
        except: pass


# ── Migraciones Permisos Laborales ──────────────────────────────
_permisos_migrations = [
    """CREATE TABLE IF NOT EXISTS nom_permisos (
        id SERIAL PRIMARY KEY,
        empleado_id INTEGER REFERENCES nom_empleados(id),
        tipo VARCHAR(20) NOT NULL,
        modalidad VARCHAR(10) NOT NULL,
        fecha DATE NOT NULL,
        hora_salida TIME,
        hora_regreso TIME,
        horas NUMERIC(5,2) DEFAULT 0,
        dias NUMERIC(5,2) DEFAULT 0,
        motivo TEXT NOT NULL,
        adjunto TEXT,
        estado VARCHAR(20) DEFAULT 'SOLICITADO',
        aprobado_por INTEGER,
        fecha_aprobacion TIMESTAMP,
        descuenta_vacacion BOOLEAN DEFAULT false,
        vacacion_descontada BOOLEAN DEFAULT false,
        observaciones TEXT,
        created_at TIMESTAMP DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS nom_horas_acumuladas (
        id SERIAL PRIMARY KEY,
        empleado_id INTEGER REFERENCES nom_empleados(id) UNIQUE,
        horas_acumuladas NUMERIC(5,2) DEFAULT 0,
        dias_descontados INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW()
    )""",
]
@app.on_event("startup")
def limpiar_audit_log_antiguo():
    try:
        execute("DELETE FROM sys_audit_log WHERE created_at < NOW() - INTERVAL '90 days'")
    except:
        pass

@app.on_event("startup")
def run_permisos_migrations():
    ALL_MIGRATIONS.extend(_permisos_migrations)
    for sql in _permisos_migrations:
        try: execute(sql)
        except: pass


# ── Aplicar migraciones a TODAS las BD de empresas ──────────
@app.on_event("startup")
def sync_tenant_databases():
    if not MULTI_TENANT:
        return
    try:
        from multitenant import get_master_connection, get_tenant_connection
        conn = get_master_connection()
        cur = conn.cursor()
        cur.execute("SELECT id, codigo, db_name FROM mt_empresas")
        empresas = [dict(r) for r in cur.fetchall()]
        conn.close()

        if not empresas:
            return

        print(f"Sincronizando migraciones en {len(empresas)} empresa(s)...")
        total_mig = len(ALL_MIGRATIONS)
        for emp in empresas:
            ok = 0
            try:
                t_conn = get_tenant_connection(emp["db_name"])
                t_cur = t_conn.cursor()
                for sql in ALL_MIGRATIONS:
                    try:
                        t_cur.execute(sql)
                        t_conn.commit()
                        ok += 1
                    except Exception:
                        t_conn.rollback()
                t_conn.close()
                print(f"  {emp['codigo']}: {ok}/{total_mig} migraciones OK")
            except Exception as e:
                print(f"  {emp['codigo']}: ERROR - {e}")
        # Seed data for each tenant (CRM stages, currencies, etc.)
        for emp in empresas:
            try:
                t_conn = get_tenant_connection(emp["db_name"])
                t_cur = t_conn.cursor()
                try:
                    t_cur.execute("SELECT COUNT(*) as n FROM crm_etapas")
                    if t_cur.fetchone()["n"] == 0:
                        for nombre, color, orden, ganada, perdida in [
                            ('Prospecto','#6B7280',1,False,False),
                            ('Contactado','#3B82F6',2,False,False),
                            ('Propuesta','#8B5CF6',3,False,False),
                            ('Negociacion','#F59E0B',4,False,False),
                            ('Ganada','#10B981',5,True,False),
                            ('Perdida','#EF4444',6,False,True),
                        ]:
                            t_cur.execute("INSERT INTO crm_etapas (nombre,color,orden,es_ganada,es_perdida) VALUES (%s,%s,%s,%s,%s)",
                                          (nombre, color, orden, ganada, perdida))
                    t_conn.commit()
                except Exception:
                    t_conn.rollback()
                t_conn.close()
            except Exception:
                pass

        print("Sincronizacion completada.")
    except Exception as e:
        print(f"Error sync tenants: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
