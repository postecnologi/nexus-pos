# NEXUS POS — Estado del Proyecto
**Empresa:** POS Tecnologi — Ecuador  
**Stack:** React 19 + Vite 8 (frontend) + FastAPI + PostgreSQL (backend)  
**Última actualización:** Junio 2026

---

## Cómo ejecutar

**Terminal 1 — Backend:**
```
cd C:\nexus_pos\nexus_web\backend
..\..\..\.venv\Scripts\activate
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 — Frontend:**
```
cd C:\nexus_pos\nexus_web\frontend
npm run dev
```

- Frontend: http://localhost:5173
- Backend docs: http://localhost:8000/docs
- Login: admin / admin123

---

## Estructura del proyecto

```
C:\nexus_pos\
  .env                       ← Variables de entorno (BD, JWT, etc.)
  nexus_web\
    backend\
      main.py                ← FastAPI — registro de routers y migraciones
      database.py            ← Conexión PostgreSQL (lee de .env)
      auth.py                ← JWT + bcrypt (lee de .env)
      routers\
        auth.py              ← Login, /me
        dashboard.py         ← KPIs, ventas semana, top productos
        productos.py         ← CRUD productos, precios, costos, ofertas, combos, series
        clientes.py          ← CRUD clientes con campos SRI
        proveedores.py       ← CRUD proveedores con campos SRI
        vendedores.py        ← CRUD vendedores, metas, comisiones
        facturas.py          ← Crear, listar, detalle, anular SRI, reportes ventas
        inventario.py        ← Stock, bodegas, marcas, categorías, resumen, ajuste rápido
        compras.py           ← Ingreso mercadería, stock automático, CXP
        devoluciones.py      ← Notas de crédito, reversa stock/series
        transferencias.py    ← Transferencias entre bodegas con series
        ajustes.py           ← Cargos y descargos de inventario
        cxc.py               ← Cuentas por cobrar, abonos, recordatorios
        cxp.py               ← Cuentas por pagar, pagos
        caja.py              ← Apertura/cierre, conteo billetes, movimientos
        bancos.py            ← Cuentas bancarias, movimientos, lotes tarjeta
        conciliacion.py      ← Conciliación bancaria, importar CSV
        configuracion.py     ← Empresa, sucursales, bodegas, secuenciales SRI
        etiquetas.py         ← Gestión precios, etiquetas, plantillas, imágenes
    frontend\
      src\
        App.jsx              ← Rutas y autenticación
        api.js               ← Axios con interceptors JWT
        index.css            ← Estilos globales
        pages\
          Login.jsx           ✅
          Dashboard.jsx       ✅
          Clientes.jsx        ✅
          Proveedores.jsx     ✅
          Vendedores.jsx      ✅
          Stock.jsx           ✅ (Inventario)
          Configuracion.jsx   ✅
          Facturas.jsx        ✅
          Compras.jsx         ✅
          Devoluciones.jsx    ✅
          Transferencias.jsx  ✅
          Ajustes.jsx         ✅
          CXC.jsx             ✅
          CXP.jsx             ✅
          Caja.jsx            ✅
          Bancos.jsx          ✅
          Conciliacion.jsx    ✅
          GestionPrecios.jsx  ✅
          Etiquetas.jsx       ✅
          Reportes.jsx        ✅
          PrintFactura.jsx    ✅
          Productos.jsx       ✅
        components\
          Layout.jsx              ✅ Sidebar + navegación
          ModalProducto.jsx       ✅ Modal 5 pestañas
          StockComboWidget.jsx    ✅ Stock virtual combos
          WidgetPreciosCambiados.jsx ✅
          WidgetOfertas.jsx       ✅
          LogoUploader.jsx        ✅
```

---

## Módulos completados

### Autenticación
- Login con JWT (tokens de 8 horas)
- Soporte contraseñas texto plano (legacy Flet) + bcrypt
- PrivateRoute / PublicRoute
- Secrets en .env (no hardcodeados)

### Dashboard
- KPIs: ventas hoy, ventas mes, clientes, productos, stock bajo, CXC pendiente
- Gráfico ventas últimos 7 días
- Top 5 productos del mes
- Filtro por sucursal del usuario

### Clientes
- CRUD completo con todos los campos SRI
- Tipo identificación, RUC, tipo contribuyente
- Obligado contabilidad, contribuyente especial
- Dirección matriz SRI, provincia, país
- Vendedor fijo, tipo de precio, días de crédito
- Historial de facturas y CXC por cliente

### Proveedores
- CRUD completo con campos SRI
- Nombre comercial adicional
- Contacto comercial (ejecutivo del proveedor)
- Tipo de proveedor (Bienes/Servicios/Importador)

### Vendedores
- CRUD completo
- Asignación a sucursal
- Meta individual + meta prorrateada de sucursal
- % Comisión sobre base imponible
- Barra de cumplimiento en tiempo real
- Rendimiento del mes actual

### Inventario (Stock)
- Stock por bodega con filtros y búsqueda
- Stock agrupado por producto con desglose por bodega
- Productos CRUD con expand de precios
- Resumen KPIs + barras por categoría
- Modal producto con 5 pestañas (Datos, Costos/Precios, Ofertas, Stock, Combo)
- 3 costos (actual, anterior, promedio) + calculadora de márgenes
- Ofertas con fechas de vigencia
- Stock por bodega (cantidad mínima y máxima)
- Combos con costo calculado automático desde componentes
- Stock virtual para combos
- Series/IMEI por producto y bodega
- Marcas y categorías CRUD
- Cambio masivo de precios (batch)
- Ofertas masivas (batch)
- Historial de cambios de precio con tracking de impresión
- Ajustes de inventario (cargos y descargos) con series

### Facturación
- Crear facturas con cálculo automático IVA (base + IVA)
- Secuenciales SRI por sucursal (001-001-000000001)
- Clave de acceso SRI (49 dígitos, módulo 11)
- Descuento por línea + descuento global
- Múltiples formas de pago por factura (efectivo, tarjeta, transferencia, Medianet, DeUna, crédito)
- Descuento automático de stock por bodega
- Registro de series vendidas
- Generación automática de CXC para ventas a crédito
- Generación automática de movimientos bancarios
- Anulación SRI (solo facturas no autorizadas, con motivo, reversa stock/series/CXC)
- Reimprimir facturas (búsqueda por número, cliente, fecha)
- Impresión de factura (PrintFactura)
- Validación de stock antes de facturar (incluye combos)

### Compras
- Ingreso de mercadería con número secuencial
- Aumento automático de stock en bodega
- Registro de series/IMEI en compra
- Actualización de costos del producto
- Generación automática de CXP
- Múltiples productos por compra con descuento
- Anulación de compra (reversa stock + anula CXP)

### Devoluciones (Notas de Crédito)
- Emisión de NC con secuencial SRI
- Devolución total o parcial
- Reversa automática de stock y series
- Formas de devolución: efectivo, transferencia, saldo a favor
- Si es saldo a favor, abona automáticamente CXC pendiente
- Documento modificado (referencia a factura original)

### Transferencias entre bodegas
- Transferencia con número secuencial
- Mover stock de bodega origen a destino
- Transferencia de series/IMEI
- Anulación (reversa stock y series)

### CXC (Cuentas por Cobrar)
- Listado con filtros (estado, cliente, sucursal, búsqueda)
- Estado calculado: PENDIENTE, VENCIDA, PAGADA
- Días vencido automático
- Resumen por sucursal (cartera, vencido, por vencer)
- Registro de abonos con forma de pago
- Movimiento bancario automático al abonar
- Envío de recordatorios (preparado para SMTP)

### CXP (Cuentas por Pagar)
- Listado con filtros (estado, búsqueda)
- Registro de pagos parciales o totales
- Movimiento bancario automático al pagar
- Resumen (cartera, vencido, por vencer)
- Historial de pagos por cuenta

### Caja
- CRUD de cajas por sucursal (de sucursal o personales)
- Apertura con monto inicial
- Registro de ingresos y egresos manuales
- Cierre con conteo de billetes y monedas
- Cálculo automático: efectivo sistema vs contado (sobrante/faltante/cuadrado)
- Desglose por forma de pago (efectivo, tarjeta, transferencia, Medianet, DeUna, crédito)
- Incluye cobros CXC del período
- Historial de sesiones por caja

### Bancos
- CRUD de cuentas bancarias (corriente, ahorros)
- Catálogo de bancos del sistema
- Registro de movimientos bancarios (depósito, lote tarjeta, transferencia, pago proveedor)
- Lotes de tarjeta con transacciones individuales (voucher, tipo tarjeta)
- Conciliación por transacción individual
- Resumen bancario

### Conciliación Bancaria
- Crear conciliación mensual por cuenta
- Carga automática de movimientos del sistema del período
- Agregar líneas manuales del estado de cuenta del banco
- Importar estado de cuenta desde CSV
- Conciliar/desconciliar líneas individuales
- Match automático sistema-banco
- Cierre de conciliación (marca movimientos como conciliados)
- Cálculo de diferencia banco vs libros

### Gestión de Precios
- Vista de todos los productos con todos sus precios PVP
- Cambio masivo de precios (batch)
- Widget de cambios recientes (últimas 72 horas)
- Pendientes de reimprimir etiqueta
- Marcar como impreso (individual y masivo)

### Etiquetas
- Editor de etiquetas
- Guardar/cargar plantillas por usuario
- Ofertas próximas pendientes de imprimir
- Marcar ofertas como impresas
- Subir imágenes para etiquetas
- Galería de imágenes

### Configuración
- Empresa: todos los datos SRI (RUC, régimen, ambiente, IVA)
- Logo de empresa (base64)
- Sucursales: código establecimiento, punto emisión, ubicación
- Secuenciales por sucursal: Factura, NC, ND, Retención, Guía, Liquidación
- Bodegas: con responsable, múltiples por sucursal
- Meta de ventas por sucursal

### Reportes
- Reporte de ventas por rango de fechas
- Resumen: facturas, subtotales, IVA, total
- Desglose por día
- Desglose por vendedor

---

## Módulos pendientes

### Alta prioridad
- [ ] **Facturación electrónica SRI** — firma digital .p12, generación XML, envío al SRI, RIDE PDF
- [ ] **Usuarios y permisos** — CRUD de usuarios, roles por módulo (soloVer ya preparado)

### Media prioridad
- [ ] **Comisiones** — tablas de rangos por % de cumplimiento de meta
- [ ] **Reportes avanzados** — inventario, comisiones, CxC aging, rentabilidad
- [ ] **Notificaciones por email** — configurar SMTP para recordatorios CXC

### Futuro
- [ ] **Retenciones** — módulo para emisión de retenciones SRI
- [ ] **Guías de remisión** — documento SRI para transporte de mercadería
- [ ] **Liquidaciones de compra** — documento SRI
- [ ] **Notas de débito** — documento SRI

---

## Base de datos

**Conexión:** configurada en .env (localhost:5433 / nexus_db / postgres)

**Tablas principales:**

| Tabla | Módulo |
|---|---|
| sys_empresas | Configuración |
| sys_sucursales | Configuración + Vendedores |
| sys_usuarios | Autenticación |
| sys_bancos | Bancos |
| inv_productos | Inventario |
| inv_stock | Inventario |
| inv_bodegas | Inventario + Configuración |
| inv_marcas | Inventario |
| inv_categorias | Inventario |
| inv_precios | Inventario |
| inv_tipos_precio | Inventario |
| inv_costos | Inventario |
| inv_ofertas | Inventario |
| inv_producto_componentes | Inventario (combos) |
| inv_series | Inventario |
| inv_precios_historial | Gestión Precios |
| inv_transferencias | Transferencias |
| inv_transferencia_detalles | Transferencias |
| inv_transferencia_series | Transferencias |
| inv_ajustes | Ajustes |
| inv_ajuste_detalles | Ajustes |
| inv_movimientos | Inventario (log) |
| ven_clientes | Clientes |
| ven_vendedores | Vendedores |
| ven_facturas | Facturación |
| ven_factura_detalles | Facturación |
| ven_factura_series | Facturación |
| ven_pagos | Facturación |
| ven_devoluciones | Devoluciones |
| ven_devolucion_detalles | Devoluciones |
| com_proveedores | Proveedores |
| com_compras | Compras |
| com_compra_detalles | Compras |
| fin_cxc | CXC |
| fin_cxc_abonos | CXC |
| fin_cxp | CXP |
| fin_cxp_pagos | CXP |
| fin_cuentas_bancarias | Bancos |
| fin_movimientos_bancarios | Bancos |
| fin_lote_transacciones | Bancos |
| fin_conciliaciones | Conciliación |
| fin_estado_cuenta | Conciliación |
| caj_cajas | Caja |
| caj_sesiones | Caja |
| caj_movimientos | Caja |
| cfg_etiquetas_plantillas | Etiquetas |

---

## Notas técnicas importantes

- **JWT expira en 8 horas** — configurado en .env como JWT_EXPIRE_MINUTES
- **Secrets en .env** — JWT_SECRET_KEY y credenciales BD no están hardcodeadas
- **Stock de combos** es virtual — se calcula desde componentes, al facturar descuenta cada uno
- **Secuenciales SRI** — formato: 001-001-000000001 (estab-emision-secuencial)
- **Clave de acceso SRI** — 49 dígitos, módulo 11, generada automáticamente al facturar
- **Ambiente SRI** — 1=Pruebas, 2=Producción (configurar antes de facturación electrónica)
- **Anulación de facturas** — solo para facturas NO enviadas al SRI; para autorizadas usar NC
- **soloVer prop** en ModalProducto — preparado para sistema de permisos
- **meta_mensual vendedores** — individual tiene prioridad sobre prorrateada de sucursal
- **Backend modularizado** — 19 routers en carpeta routers/, main.py solo registra
- **Migraciones automáticas** — columnas nuevas se crean al iniciar si no existen
