import { Outlet, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, Users, FileText, RotateCcw, ArrowLeftRight,
  Landmark, Building2, GitMerge, ClipboardList, Tag, Warehouse, BarChart3,
  Truck, Award, Settings, LogOut, CreditCard, ChevronDown, ChevronRight,
  ShoppingCart, DollarSign, Box, ScrollText, ClipboardCheck, Sun, Moon, Wrench,
  Target, FileCheck2, Calculator, ArrowUpCircle, Receipt
} from 'lucide-react'
import { useState, useMemo, useEffect } from 'react'
import { useThemeToggle } from '../theme'
import api from '../api'

/* Mapear cada ruta del sidebar a un nombre de módulo */
const pathToModule = {
  '/':                'dashboard',
  '/caja':            'caja',
  '/caja-chica':      'caja',
  '/facturas':        'facturas',
  '/notas-venta':     'notas-venta',
  '/clientes':        'clientes',
  '/cxc':             'cxc',
  '/devoluciones':    'devoluciones',
  '/stock':           'stock',
  '/gestion-precios': 'gestion-precios',
  '/ajustes':         'ajustes',
  '/transferencias':  'transferencias',
  '/etiquetas':       'etiquetas',
  '/kardex':          'kardex',
  '/compras':         'compras',
  '/proveedores':     'proveedores',
  '/cxp-pagar':       'cxp',
  '/bancos':          'bancos',
  '/depositos':       'depositos',
  '/conciliacion':    'conciliacion',
  '/vendedores':      'vendedores',
  '/cotizaciones':    'cotizaciones',
  '/toma-fisica':     'toma-fisica',
  '/servicio-tecnico':'servicio-tecnico',
  '/crm':             'crm',
  '/ordenes-compra':  'ordenes-compra',
  '/retenciones':     'retenciones',
  '/retenciones-emitidas': 'retenciones-emitidas',
  '/retenciones-recibidas': 'retenciones-recibidas',
  '/notas-debito':    'notas-debito',
  '/contabilidad':    'contabilidad',
  '/nomina':          'nomina',
  '/reportes':        'reportes',
  '/configuracion':   'configuracion',
  '/usuarios':        'usuarios',
  '/administracion':  'admin',
  '/guias-remision':  'guias-remision',
  '/liquidaciones':   'liquidaciones',
}

/* ── Permisos basados en modulos_permitidos del usuario ── */
function canAccess(rol, path, modulosPermitidos) {
  const mod = pathToModule[path] || path.replace('/', '')
  if (!Array.isArray(modulosPermitidos)) return true
  return modulosPermitidos.includes(mod)
}

const grupos = [
  {
    label: 'Principal',
    icon: LayoutDashboard,
    items: [
      { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard'       },
    ]
  },
  {
    label: 'Ventas',
    icon: ShoppingCart,
    items: [
      { to: '/caja',            icon: Landmark,      label: 'Caja'              },
      { to: '/facturas',        icon: FileText,      label: 'Facturas'          },
      { to: '/notas-venta',     icon: Receipt,       label: 'Notas de Venta'    },
      { to: '/devoluciones',    icon: RotateCcw,     label: 'Devoluciones'      },
      { to: '/cotizaciones',    icon: ClipboardList, label: 'Cotizaciones'      },
      { to: '/crm',             icon: Target,        label: 'CRM'               },
      { to: '/notas-debito',    icon: FileText,      label: 'Notas de Debito'   },
    ]
  },
  {
    label: 'Clientes',
    icon: Users,
    items: [
      { to: '/clientes',        icon: Users,       label: 'Clientes'            },
      { to: '/cxc',             icon: CreditCard,  label: 'Cuentas por Cobrar'  },
      { to: '/retenciones-recibidas', icon: FileCheck2, label: 'Retenciones'    },
    ]
  },
  {
    label: 'Inventario',
    icon: Box,
    items: [
      { to: '/stock',           icon: Warehouse,      label: 'Inventario'     },
      { to: '/gestion-precios', icon: Tag,            label: 'Precios/Ofertas'},
      { to: '/ajustes',         icon: ClipboardList,  label: 'Ajustes'        },
      { to: '/transferencias',  icon: ArrowLeftRight, label: 'Transferencias' },
      { to: '/etiquetas',       icon: Tag,            label: 'Etiquetas'      },
      { to: '/kardex',          icon: ScrollText,     label: 'Kardex'         },
      { to: '/toma-fisica',     icon: ClipboardCheck, label: 'Toma Fisica'    },
    ]
  },
  {
    label: 'Compras',
    icon: Package,
    items: [
      { to: '/compras',         icon: Package,    label: 'Compras'              },
      { to: '/ordenes-compra',  icon: ClipboardList, label: 'Ordenes de Compra'  },
    ]
  },
  {
    label: 'Proveedores',
    icon: Truck,
    items: [
      { to: '/proveedores',     icon: Truck,      label: 'Proveedores'          },
      { to: '/cxp-pagar',       icon: CreditCard, label: 'Cuentas por Pagar'    },
      { to: '/retenciones-emitidas', icon: FileCheck2, label: 'Retenciones'     },
    ]
  },
  {
    label: 'Finanzas',
    icon: DollarSign,
    items: [
      { to: '/bancos',          icon: Building2,     label: 'Bancos'            },
      { to: '/depositos',       icon: ArrowUpCircle, label: 'Depósitos'         },
      { to: '/caja-chica',      icon: DollarSign,    label: 'Caja Chica'        },
      { to: '/conciliacion',    icon: GitMerge,      label: 'Conciliación'      },
    ]
  },
  {
    label: 'Contabilidad',
    icon: Calculator,
    items: [
      { to: '/contabilidad',    icon: Calculator, label: 'Contabilidad'       },
    ]
  },
  {
    label: 'Servicio',
    icon: Wrench,
    items: [
      { to: '/servicio-tecnico', icon: Wrench,     label: 'Ordenes de Servicio'},
    ]
  },
  {
    label: 'RRHH',
    icon: Award,
    items: [
      { to: '/vendedores',      icon: Award,      label: 'Vendedores'         },
      { to: '/nomina',          icon: Calculator,  label: 'Nomina'             },
    ]
  },
  {
    label: 'Reportes',
    icon: BarChart3,
    items: [
      { to: '/reportes',        icon: BarChart3,  label: 'Reportes'           },
    ]
  },
  {
    label: 'Config.',
    icon: Settings,
    items: [
      { to: '/configuracion',   icon: Settings,   label: 'Configuración'      },
      { to: '/usuarios',        icon: Users,       label: 'Usuarios'           },
      { to: '/administracion',  icon: Settings,    label: 'Administración'     },
    ]
  },
]

export default function Layout() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const user              = JSON.parse(localStorage.getItem('nexus_user') || '{}')
  const rol               = (user.rol || 'admin').toLowerCase()
  const modulosPermitidos = user.modulos_permitidos

  if (rol === 'empleado') return <Navigate to="/portal-empleado" replace />

  // Filtrar sidebar según modulos_permitidos del usuario
  const gruposFiltrados = useMemo(() => {
    return grupos
      .map(g => ({
        ...g,
        items: g.items.filter(item => canAccess(rol, item.to, modulosPermitidos)),
      }))
      .filter(g => g.items.length > 0)
  }, [rol, modulosPermitidos])

  const [collapsed, setCollapsed] = useState(false)
  const [sucursales, setSucursales] = useState([])
  const [sucActiva, setSucActiva] = useState(localStorage.getItem('nexus_sucursal_id') || '')
  const esAdmin = rol === 'admin' || rol === 'gerente'

  // Badge counts for sidebar items
  const [badges, setBadges] = useState({})

  useEffect(() => {
    if (esAdmin) {
      api.get('/sucursales').then(r => setSucursales(r.data || [])).catch(() => {})
    }
    // Fetch badge counts silently
    Promise.allSettled([
      api.get('/cxc?estado=VENCIDA&limit=1').then(r => {
        const total = r.headers?.['x-total-count'] || (Array.isArray(r.data) ? r.data.length : 0)
        return { key: '/cxc', count: Number(total) || 0 }
      }),
      api.get('/servicio-tecnico?estado=EN_PROCESO&limit=1').then(r => {
        const total = r.headers?.['x-total-count'] || (Array.isArray(r.data) ? r.data.length : 0)
        return { key: '/servicio-tecnico', count: Number(total) || 0 }
      }),
    ]).then(results => {
      const b = {}
      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value.count > 0) {
          b[r.value.key] = r.value.count
        }
      })
      if (Object.keys(b).length > 0) setBadges(b)
    })
  }, [esAdmin])

  function cambiarSucursal(val) {
    setSucActiva(val)
    if (val) {
      localStorage.setItem('nexus_sucursal_id', val)
      const u = JSON.parse(localStorage.getItem('nexus_user') || '{}')
      u.sucursal_id = parseInt(val)
      localStorage.setItem('nexus_user', JSON.stringify(u))
    } else {
      localStorage.removeItem('nexus_sucursal_id')
      const u = JSON.parse(localStorage.getItem('nexus_user') || '{}')
      u.sucursal_id = null
      localStorage.setItem('nexus_user', JSON.stringify(u))
    }
    window.location.reload()
  }

  // Inicializar grupos abiertos — abrir el que contiene la ruta actual
  const initOpen = () => {
    const obj = {}
    gruposFiltrados.forEach(g => {
      const activo = g.items.some(i => i.to === '/' ? location.pathname === '/' : location.pathname.startsWith(i.to))
      obj[g.label] = activo || g.label === 'Principal'
    })
    return obj
  }
  const [open, setOpen] = useState(initOpen)

  function toggleGrupo(label) {
    setOpen(prev => ({...prev, [label]: !prev[label]}))
  }

  function logout() {
    localStorage.removeItem('nexus_token')
    localStorage.removeItem('nexus_user')
    window.location.href = '/'
  }

  const { toggle: toggleTheme, isDark } = useThemeToggle()
  const C = isDark ? {
    bg:'#0F172A', sur:'#1E293B', bord:'#334155',
    text:'#F1F5F9', muted:'#94A3B8', hint:'#64748B',
    blue:'#3B82F6', blueD:'rgba(59,130,246,.15)', active:'rgba(59,130,246,.2)',
  } : {
    bg:'#E5E7EB', sur:'#FFFFFF', bord:'#D1D5DB',
    text:'#111827', muted:'#4B5563', hint:'#6B7280',
    blue:'#2563EB', blueD:'rgba(37,99,235,.1)', active:'rgba(37,99,235,.15)',
  }

  const [mobileMenu, setMobileMenu] = useState(false)

  return (
    <div style={{display:'flex', height:'100vh', overflow:'hidden', background:C.bg}}>
      <style>{`@media(max-width:768px){.nexus-sidebar{display:none!important}.nexus-mobile-btn{display:flex!important}.nexus-sidebar-mobile{display:flex!important}main{padding-top:50px!important}}`}</style>

      {/* Mobile menu button */}
      <button className="nexus-mobile-btn" onClick={() => setMobileMenu(!mobileMenu)} style={{
        display: 'none', position: 'fixed', top: 10, left: 10, zIndex: 999,
        width: 40, height: 40, borderRadius: 10, border: 'none',
        background: C.sur, color: C.tx, cursor: 'pointer', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,.2)',
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={mobileMenu ? "M6 6l12 12M6 18L18 6" : "M4 6h16M4 12h16M4 18h16"} /></svg>
      </button>

      {/* Mobile sidebar overlay */}
      {mobileMenu && (
        <div className="nexus-sidebar-mobile" onClick={() => setMobileMenu(false)} style={{
          display: 'none', position: 'fixed', inset: 0, zIndex: 998, background: 'rgba(0,0,0,.5)',
        }} />
      )}

      {/* Sidebar */}
      <aside className={mobileMenu ? "nexus-sidebar-mobile" : "nexus-sidebar"} style={{
        width: collapsed ? 56 : 210,
        background: C.sur,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s',
        flexShrink: 0,
        borderRight: `1px solid ${C.bord}`,
        overflow: 'hidden',
        ...(mobileMenu ? { position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 999, width: 210, display: 'flex' } : {}),
      }}>

        {/* Logo + toggle */}
        <div style={{padding:'14px 12px', borderBottom:`1px solid ${C.bord}`,
          display:'flex', alignItems:'center', gap:8, flexShrink:0}}>
          <div style={{width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#3B82F6,#8B5CF6)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:14, fontWeight:900, color:'white', flexShrink:0}}>N</div>
          {!collapsed&&(
            <div style={{overflow:'hidden'}}>
              <div style={{fontSize:13, fontWeight:800, color:C.text, whiteSpace:'nowrap'}}>NEXUS POS</div>
              <div style={{fontSize:10, color:C.hint, whiteSpace:'nowrap'}}>v2.0</div>
            </div>
          )}
          <button onClick={()=>setCollapsed(c=>!c)}
            style={{marginLeft:'auto', background:'none', border:'none',
              cursor:'pointer', color:C.hint, padding:2, flexShrink:0}}>
            {collapsed ? <ChevronRight size={14}/> : <ChevronDown size={14} style={{transform:'rotate(-90deg)'}}/>}
          </button>
        </div>

        {/* Nav grupos */}
        <nav style={{flex:1, overflowY:'auto', padding:'8px 0',
          scrollbarWidth:'thin', scrollbarColor:`${C.bord} transparent`}}>
          {gruposFiltrados.map(g => {
            const GIcon = g.icon
            const abierto = open[g.label]
            const tieneActivo = g.items.some(i =>
              i.to==='/dashboard' ? location.pathname==='/' : location.pathname.startsWith(i.to)
            )
            return (
              <div key={g.label}>
                {/* Cabecera del grupo */}
                <button onClick={()=>!collapsed&&toggleGrupo(g.label)}
                  title={collapsed?g.label:undefined}
                  style={{
                    width:'100%', display:'flex', alignItems:'center', gap:8,
                    padding: collapsed ? '8px 0' : '6px 12px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    background: tieneActivo&&collapsed ? C.blueD : 'none',
                    border:'none', cursor:'pointer',
                    color: tieneActivo ? C.blue : C.muted,
                    fontSize:11, fontWeight:700, textTransform:'uppercase',
                    letterSpacing:'.05em',
                  }}>
                  <GIcon size={collapsed?18:13} style={{flexShrink:0}}/>
                  {!collapsed&&(
                    <>
                      <span style={{flex:1, textAlign:'left'}}>{g.label}</span>
                      {g.items.length>1&&(
                        <span style={{transition:'transform .2s',
                          transform:abierto?'rotate(90deg)':'rotate(0deg)',
                          display:'flex', color:C.hint}}>
                          <ChevronRight size={12}/>
                        </span>
                      )}
                    </>
                  )}
                </button>

                {/* Items del grupo — smooth expand/collapse */}
                {!collapsed && (
                  <div style={{
                    overflow:'hidden',
                    maxHeight: abierto ? g.items.length * 40 : 0,
                    opacity: abierto ? 1 : 0,
                    transition: 'max-height 0.25s ease, opacity 0.2s ease',
                  }}>
                    {g.items.map(item => {
                      const IIcon = item.icon
                      const isActive = item.to==='/dashboard'
                        ? location.pathname==='/'
                        : location.pathname.startsWith(item.to)
                      const badgeCount = badges[item.to]
                      return (
                        <NavLink key={item.to} to={item.to}
                          style={{
                            display:'flex', alignItems:'center', gap:8,
                            padding:'6px 12px 6px 28px',
                            textDecoration:'none',
                            color: isActive ? C.blue : C.muted,
                            background: isActive ? C.active : 'transparent',
                            fontSize:12, fontWeight: isActive ? 700 : 400,
                            borderLeft: isActive ? `3px solid ${C.blue}` : '3px solid transparent',
                            transition:'all .15s',
                          }}
                          onMouseEnter={e=>{if(!isActive)e.currentTarget.style.background='rgba(255,255,255,.04)'}}
                          onMouseLeave={e=>{if(!isActive)e.currentTarget.style.background='transparent'}}
                        >
                          <IIcon size={13} style={{flexShrink:0}}/>
                          <span style={{flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                            {item.label}
                          </span>
                          {badgeCount > 0 && (
                            <span style={{
                              background: item.to==='/cxc' ? '#EF4444' : '#3B82F6',
                              color:'white', fontSize:9, fontWeight:700,
                              padding:'1px 6px', borderRadius:10, minWidth:18,
                              textAlign:'center', lineHeight:'16px', flexShrink:0,
                            }}>{badgeCount > 99 ? '99+' : badgeCount}</span>
                          )}
                        </NavLink>
                      )
                    })}
                  </div>
                )}

                {/* Collapsed: iconos individuales */}
                {collapsed && g.items.map(item => {
                  const IIcon = item.icon
                  const isActive = item.to==='/dashboard'
                    ? location.pathname==='/'
                    : location.pathname.startsWith(item.to)
                  return (
                    <NavLink key={item.to} to={item.to} title={item.label}
                      style={{
                        display:'flex', alignItems:'center', justifyContent:'center',
                        padding:'7px 0',
                        color: isActive ? C.blue : C.hint,
                        background: isActive ? C.active : 'transparent',
                        textDecoration:'none',
                      }}>
                      <IIcon size={16}/>
                    </NavLink>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* Toggle tema */}
        <div style={{borderTop:`1px solid ${C.bord}`, padding:'6px 12px',
          display:'flex', alignItems:'center', justifyContent: collapsed?'center':'flex-start',
          gap:8, flexShrink:0}}>
          <button onClick={toggleTheme} title={isDark?'Cambiar a modo claro':'Cambiar a modo oscuro'}
            style={{background:isDark?'rgba(245,158,11,.12)':'rgba(59,130,246,.12)',
              border:`1px solid ${isDark?'rgba(245,158,11,.3)':'rgba(59,130,246,.3)'}`,
              borderRadius:8, cursor:'pointer', padding:'5px 8px',
              display:'flex', alignItems:'center', gap:6, color:isDark?'#F59E0B':'#2563EB'}}>
            {isDark?<Sun size={14}/>:<Moon size={14}/>}
            {!collapsed&&<span style={{fontSize:11,fontWeight:600}}>{isDark?'Claro':'Oscuro'}</span>}
          </button>
        </div>

        {/* Usuario + logout */}
        <div style={{borderTop:`1px solid ${C.bord}`, padding:'10px 12px',
          display:'flex', alignItems:'center', gap:8, flexShrink:0}}>
          <div style={{width:28, height:28, borderRadius:'50%',
            background:'linear-gradient(135deg,#8B5CF6,#3B82F6)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:11, fontWeight:700, color:'white', flexShrink:0}}>
            {(user.nombre||'U')[0].toUpperCase()}
          </div>
          {!collapsed&&(
            <>
              <div style={{flex:1, overflow:'hidden'}}>
                <div style={{fontSize:11, fontWeight:600, color:C.text,
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                  {user.nombre||'Usuario'}
                </div>
                <div style={{fontSize:10, color:C.hint}}>{user.rol||''}</div>
              </div>
              <button onClick={logout} title="Cerrar sesión"
                style={{background:'none', border:'none', cursor:'pointer',
                  color:C.hint, padding:4, flexShrink:0}}
                onMouseEnter={e=>e.currentTarget.style.color='#EF4444'}
                onMouseLeave={e=>e.currentTarget.style.color=C.hint}>
                <LogOut size={14}/>
              </button>
            </>
          )}
          {collapsed&&(
            <button onClick={logout} title="Cerrar sesión"
              style={{background:'none',border:'none',cursor:'pointer',
                color:C.hint,padding:2}}
              onMouseEnter={e=>e.currentTarget.style.color='#EF4444'}
              onMouseLeave={e=>e.currentTarget.style.color=C.hint}>
              <LogOut size={13}/>
            </button>
          )}
        </div>
      </aside>

      {/* Contenido */}
      <main style={{flex:1, overflow:'auto', display:'flex', flexDirection:'column'}}>
        {esAdmin && sucursales.length > 1 && (
          <div style={{background:'rgba(30,41,59,.95)', borderBottom:`1px solid ${C.bord}`,
            padding:'6px 20px', display:'flex', alignItems:'center', gap:10, flexShrink:0}}>
            <span style={{fontSize:11, color:C.hint, fontWeight:600}}>SUCURSAL:</span>
            <select value={sucActiva} onChange={e => cambiarSucursal(e.target.value)}
              style={{padding:'4px 10px', borderRadius:6, fontSize:12, fontWeight:600,
                border:`1px solid ${C.bord}`, background:'#0F172A', color:sucActiva?'#3B82F6':'#10B981',
                cursor:'pointer', outline:'none'}}>
              <option value="" style={{color:'#10B981'}}>Todas las sucursales</option>
              {sucursales.map(s => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
            {!sucActiva && (
              <span style={{fontSize:10, color:'#10B981', padding:'2px 8px', borderRadius:4,
                background:'rgba(16,185,129,.12)', border:'1px solid rgba(16,185,129,.25)'}}>
                Vista global — datos de todas las sucursales
              </span>
            )}
          </div>
        )}
        <Outlet/>
      </main>
    </div>
  )
}