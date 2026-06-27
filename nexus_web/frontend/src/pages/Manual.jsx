import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const MANUAL = [
  {
    id: 'inicio',
    title: 'Primeros Pasos',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    steps: [
      { t: 'Iniciar sesion', d: 'Ingresa a pos-tecnologi.com/login. Escribe tu codigo de empresa, usuario y contrasena. Haz clic en "Iniciar sesion".' },
      { t: 'Dashboard', d: 'Al entrar veras el panel principal con un resumen de tus ventas del dia, del mes, clientes activos, stock bajo y cuentas por cobrar.' },
      { t: 'Navegacion', d: 'En el menu lateral izquierdo encontraras todos los modulos organizados por grupos: Ventas, Inventario, Finanzas, etc. Haz clic en cualquiera para acceder.' },
      { t: 'Tema claro/oscuro', d: 'En la parte inferior del menu lateral hay un boton de sol/luna para cambiar entre tema claro y oscuro.' },
      { t: 'Cerrar sesion', d: 'Haz clic en el boton de cerrar sesion en la parte inferior del menu lateral.' },
    ],
  },
  {
    id: 'clientes',
    title: 'Clientes',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    steps: [
      { t: 'Crear cliente', d: 'Ve a Clientes → clic en "+ Nuevo". Llena los datos: RUC/Cedula, nombre, direccion, telefono, email. El tipo de identificacion (RUC, Cedula, Pasaporte) es obligatorio para la facturacion SRI.' },
      { t: 'Buscar cliente', d: 'Usa la barra de busqueda en la parte superior. Puedes buscar por nombre, cedula o RUC.' },
      { t: 'Editar cliente', d: 'Haz clic en el boton "Editar" al lado del cliente que quieres modificar.' },
      { t: 'Consumidor Final', d: 'El sistema viene con un cliente "CONSUMIDOR FINAL" (RUC 9999999999999) para ventas sin identificacion del comprador.' },
    ],
  },
  {
    id: 'productos',
    title: 'Productos e Inventario',
    icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    steps: [
      { t: 'Crear producto', d: 'Ve a Inventario → Productos → "+ Nuevo". Ingresa: codigo, descripcion, categoria, marca, precio de venta, IVA (15% por defecto). Puedes activar "Maneja series" para productos con numero de serie.' },
      { t: 'Categorias y marcas', d: 'Antes de crear productos, crea tus categorias (Celulares, Accesorios, etc.) y marcas (Samsung, Apple, etc.) desde el mismo modulo de productos.' },
      { t: 'Stock', d: 'Ve a Inventario → Stock para ver las cantidades disponibles en cada bodega. El stock se actualiza automaticamente con cada venta, compra o ajuste.' },
      { t: 'Ajustes de inventario', d: 'Para corregir cantidades, ve a Inventario → Ajustes → "+ Nuevo ajuste". Selecciona el tipo (entrada o salida), la bodega y los productos.' },
      { t: 'Transferencias', d: 'Para mover productos entre bodegas, ve a Inventario → Transferencias → "+ Nueva".' },
    ],
  },
  {
    id: 'facturas',
    title: 'Facturacion',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    steps: [
      { t: 'Crear factura', d: 'Ve a Facturacion → clic en "+ Nueva" o presiona F4. Selecciona el cliente, agrega productos con F2, define cantidades y precios.' },
      { t: 'Buscar productos', d: 'Presiona F2 o haz clic en "Agregar producto". Puedes buscar por codigo, nombre o codigo de barras.' },
      { t: 'Formas de pago', d: 'Al finalizar, presiona F8 o "Emitir". Selecciona la forma de pago: efectivo, tarjeta, transferencia, credito. Puedes combinar varias formas de pago.' },
      { t: 'Reimprimir', d: 'Presiona F9 o busca la factura en el listado y haz clic en "PDF" para descargarla.' },
      { t: 'Anular factura', d: 'Busca la factura → clic en "Anular". Debes ingresar el motivo de anulacion. Segun el SRI, las facturas anuladas generan una nota de credito.' },
      { t: 'Borradores', d: 'Puedes guardar una factura como borrador (sin emitir) y cargarla despues para completarla.' },
      { t: 'Atajos de teclado', d: 'F2: buscar producto | F4: nueva factura | F8: emitir/pagar | F9: reimprimir | ESC: cerrar' },
    ],
  },
  {
    id: 'compras',
    title: 'Compras',
    icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z',
    steps: [
      { t: 'Registrar compra', d: 'Ve a Compras → "+ Nueva compra". Selecciona el proveedor, agrega los productos con cantidades y costos. El sistema actualiza el stock automaticamente.' },
      { t: 'Proveedores', d: 'Crea tus proveedores en Compras → Proveedores → "+ Nuevo". Ingresa RUC, nombre, direccion, telefono y contacto.' },
      { t: 'Cuentas por pagar', d: 'Si la compra es a credito, se genera automaticamente una cuenta por pagar en Finanzas → CXP.' },
    ],
  },
  {
    id: 'finanzas',
    title: 'Finanzas',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    steps: [
      { t: 'Cuentas por cobrar', d: 'Ve a Finanzas → CXC para ver todas las facturas pendientes de cobro. Puedes registrar abonos parciales o pagos completos.' },
      { t: 'Cuentas por pagar', d: 'Ve a Finanzas → CXP para ver las compras pendientes de pago a proveedores.' },
      { t: 'Caja', d: 'Abre y cierra caja diariamente. Registra movimientos de efectivo, arqueos y transferencias.' },
      { t: 'Bancos', d: 'Registra tus cuentas bancarias y lleva el control de movimientos. Puedes hacer conciliacion bancaria.' },
    ],
  },
  {
    id: 'reportes',
    title: 'Reportes',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    steps: [
      { t: 'Generar reporte', d: 'Ve a Reportes, selecciona el tipo de reporte (Ventas, Compras, Inventario, etc.), define el rango de fechas y filtros.' },
      { t: 'Exportar', d: 'Todos los reportes se pueden exportar a PDF y Excel con un clic en los botones correspondientes.' },
      { t: 'Filtros', d: 'Puedes filtrar por: fechas, cliente, vendedor, producto, categoria, sucursal y mas.' },
    ],
  },
  {
    id: 'crm',
    title: 'CRM (Ventas)',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    steps: [
      { t: 'Oportunidades', d: 'Crea oportunidades de venta y muevalas por el pipeline Kanban: Prospecto → Contactado → Propuesta → Negociacion → Ganada/Perdida.' },
      { t: 'Actividades', d: 'Programa llamadas, reuniones, emails y tareas vinculadas a cada oportunidad.' },
      { t: 'Scoring', d: 'El sistema asigna automaticamente un puntaje a cada oportunidad segun su probabilidad de cierre.' },
    ],
  },
  {
    id: 'nomina',
    title: 'Nomina',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    steps: [
      { t: 'Empleados', d: 'Registra tus empleados con todos sus datos: cedula, cargo, salario, fecha de ingreso, tipo de contrato, datos bancarios.' },
      { t: 'Generar rol de pago', d: 'Ve a Nomina → "+ Nuevo rol". Selecciona el empleado y el periodo. El sistema calcula automaticamente: IESS (9.45% personal, 11.15% patronal), decimos, vacaciones, fondos de reserva.' },
      { t: 'Horas extras', d: 'Registra horas extras al 50% (diurnas) y 100% (nocturnas/feriados). Se calculan automaticamente en el rol.' },
      { t: 'Permisos', d: 'Los empleados pueden solicitar permisos (horas o dias). Cuando acumulan 8 horas de permiso, se descuenta un dia de vacaciones.' },
    ],
  },
  {
    id: 'config',
    title: 'Configuracion',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    steps: [
      { t: 'Datos de la empresa', d: 'Ve a Configuracion para editar: razon social, RUC, direccion, logo, datos tributarios. Estos datos aparecen en las facturas.' },
      { t: 'Sucursales', d: 'Si tienes mas de una sucursal, crealas aqui. Cada sucursal tiene su propio secuencial de facturacion.' },
      { t: 'Usuarios', d: 'Ve a Usuarios para crear cuentas para tu equipo. Asigna roles (admin, vendedor, cajero, bodeguero) y permisos especificos por modulo.' },
      { t: 'Vendedores', d: 'Registra tus vendedores para asignarlos a facturas y llevar comisiones.' },
    ],
  },
]

function Icon({ d, size = 24, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
}

export default function Manual() {
  const nav = useNavigate()
  const [active, setActive] = useState('inicio')
  const [mobileMenu, setMobileMenu] = useState(false)
  const current = MANUAL.find(m => m.id === active)

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <style>{`@media(max-width:768px){.manual-sidebar{display:none!important}.manual-burger{display:flex!important}.manual-sidebar-mobile{display:flex!important}}`}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#0F172A,#1E1B4B)', padding: '20px 20px', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="manual-burger" onClick={() => setMobileMenu(!mobileMenu)} style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d={mobileMenu ? "M6 6l12 12M6 18L18 6" : "M4 6h16M4 12h16M4 18h16"} /></svg>
            </button>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#7C3AED,#10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 12 }}>N</div>
            <span style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Manual de Usuario</span>
          </div>
          <button onClick={() => nav('/')} style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,.2)', background: 'transparent', color: '#CBD5E1', fontSize: 13, cursor: 'pointer' }}>Volver al inicio</button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', gap: 24, padding: '24px 20px' }}>
        {/* Sidebar */}
        <aside className="manual-sidebar" style={{ width: 240, flexShrink: 0 }}>
          <div style={{ position: 'sticky', top: 90, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {MANUAL.map(m => (
              <button key={m.id} onClick={() => setActive(m.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10,
                border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: active === m.id ? 700 : 500, textAlign: 'left',
                background: active === m.id ? '#EDE9FE' : 'transparent',
                color: active === m.id ? '#7C3AED' : '#475569',
              }}>
                <Icon d={m.icon} size={18} color={active === m.id ? '#7C3AED' : '#94A3B8'} />
                {m.title}
              </button>
            ))}
          </div>
        </aside>

        {/* Mobile sidebar */}
        {mobileMenu && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,.4)' }} onClick={() => setMobileMenu(false)}>
            <div className="manual-sidebar-mobile" style={{ display: 'flex', flexDirection: 'column', width: 260, background: 'white', height: '100%', padding: '80px 16px 20px', gap: 4, boxShadow: '4px 0 24px rgba(0,0,0,.1)' }} onClick={e => e.stopPropagation()}>
              {MANUAL.map(m => (
                <button key={m.id} onClick={() => { setActive(m.id); setMobileMenu(false) }} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10,
                  border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: active === m.id ? 700 : 500, textAlign: 'left',
                  background: active === m.id ? '#EDE9FE' : 'transparent',
                  color: active === m.id ? '#7C3AED' : '#475569',
                }}>
                  <Icon d={m.icon} size={18} color={active === m.id ? '#7C3AED' : '#94A3B8'} />
                  {m.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <main style={{ flex: 1, minWidth: 0 }}>
          {current && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon d={current.icon} size={24} color="#7C3AED" />
                </div>
                <h1 style={{ fontSize: 'clamp(22px,3vw,32px)', fontWeight: 800, color: '#0F172A' }}>{current.title}</h1>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {current.steps.map((s, i) => (
                  <div key={i} style={{ background: 'white', borderRadius: 14, padding: '20px 24px', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#7C3AED', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0, marginTop: 2 }}>{i + 1}</div>
                      <div>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>{s.t}</h3>
                        <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.7 }}>{s.d}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Help box */}
          <div style={{ marginTop: 40, padding: 24, background: 'linear-gradient(135deg,#EDE9FE,#F0FDF4)', borderRadius: 14, border: '1px solid #E2E8F0', textAlign: 'center' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Necesitas ayuda?</h3>
            <p style={{ color: '#64748B', fontSize: 14, marginBottom: 16 }}>Nuestro equipo esta listo para asistirte</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="https://wa.me/593999038296" target="_blank" rel="noopener" style={{ padding: '10px 24px', borderRadius: 10, background: '#25D366', color: 'white', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>WhatsApp</a>
              <a href="mailto:postecnologi@gmail.com" style={{ padding: '10px 24px', borderRadius: 10, background: '#3B82F6', color: 'white', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>Email</a>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
