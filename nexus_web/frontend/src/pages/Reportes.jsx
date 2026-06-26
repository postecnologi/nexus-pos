// ============================================================
//  NEXUS POS — Reportes
//  Archivo: frontend/src/pages/Reportes.jsx
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../api'
import {
  BarChart3, Download, FileSpreadsheet, FileText, Search, Filter,
  Calendar, DollarSign, Package, Users, Wallet, ShoppingCart, TrendingUp,
  ChevronDown, Loader2, AlertCircle, RefreshCw
} from 'lucide-react'
import { useTheme } from '../theme'

// ── Paleta oscura ────────────────────────────────────────────
const C = {
  bg:'#0A0F1E', surface:'#111827', sur2:'#1F2937', sur3:'#374151',
  border:'#1F2937', bord2:'#374151',
  text:'#F9FAFB', muted:'#9CA3AF', hint:'#6B7280',
  blue:'#3B82F6', green:'#10B981', amber:'#F59E0B', red:'#EF4444',
  purple:'#8B5CF6', cyan:'#06B6D4',
  blueD:'rgba(59,130,246,.15)', greenD:'rgba(16,185,129,.15)',
  amberD:'rgba(245,158,11,.15)', redD:'rgba(239,68,68,.15)',
  purpleD:'rgba(139,92,246,.15)',
}

// ── Formateadores ────────────────────────────────────────────
const fmt$ = v => '$'+Number(v||0).toLocaleString('es-EC',
  {minimumFractionDigits:2,maximumFractionDigits:2})
const fmtN = v => Number(v||0).toLocaleString('es-EC')
const fmtPct = v => Number(v||0).toFixed(1)+'%'
const fmtDate = v => v ? new Date(v+'T00:00:00').toLocaleDateString('es-EC') : '—'

// ── Fechas por defecto ───────────────────────────────────────
const hoy = () => new Date().toISOString().slice(0,10)
const primerDiaMes = () => {
  const d = new Date(); d.setDate(1)
  return d.toISOString().slice(0,10)
}
const mesActual = () => new Date().toISOString().slice(0,7)

// ── Estilos reutilizables ────────────────────────────────────
const FI = {
  padding:'8px 11px', borderRadius:8, fontSize:13,
  border:`1px solid ${C.bord2}`, background:C.sur2,
  color:C.text, outline:'none', boxSizing:'border-box', width:'100%',
}
const FI_SELECT = { ...FI, cursor:'pointer', appearance:'auto' }

// ── BuscadorCliente (autocompletado) ────────────────────────
function BuscadorCliente({ value, onChange, placeholder }) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [txt, setTxt] = useState('')
  const [res, setRes] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    if (value) setTxt(value.razon_social || '')
    else setTxt('')
  }, [value])

  async function buscar(v) {
    setTxt(v)
    if (v.length < 2) { setRes([]); setOpen(false); return }
    try {
      const { data } = await api.get('/clientes', { params: { busqueda: v, activo: 'true' } })
      setRes(data.slice(0, 8)); setOpen(true)
    } catch {}
  }

  function pick(c) {
    onChange(c)
    setTxt(c.razon_social)
    setOpen(false); setRes([])
  }

  function limpiar() {
    onChange(null)
    setTxt(''); setRes([]); setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 220 }}>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
          fontSize: 13, color: C.hint, pointerEvents: 'none' }}>🔍</span>
        <input value={txt}
          onChange={e => buscar(e.target.value)}
          onFocus={() => txt.length >= 2 && setOpen(true)}
          placeholder={placeholder || "Buscar cliente..."}
          style={{ ...FI, paddingLeft: 30, paddingRight: value ? 28 : 10,
            borderColor: value ? 'rgba(16,185,129,.5)' : C.bord2,
            background: value ? 'rgba(16,185,129,.08)' : C.sur2 }} />
        {value && (
          <button onClick={limpiar}
            style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: C.hint,
              fontSize: 16, lineHeight: 1, padding: 2 }}>×</button>
        )}
      </div>
      {open && res.length > 0 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          zIndex: 900, background: C.surface, borderRadius: 10,
          border: `1px solid ${C.bord2}`, boxShadow: '0 12px 32px rgba(0,0,0,.6)',
          maxHeight: 260, overflowY: 'auto' }}>
          {res.map(c => (
            <div key={c.id} onClick={() => pick(c)}
              style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: `1px solid ${C.border}` }}
              onMouseEnter={e => e.currentTarget.style.background = C.sur2}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{c.razon_social}</div>
              <div style={{ fontSize: 11, color: C.muted }}>
                {c.tipo_identificacion} {c.identificacion}
                {c.telefono && <span style={{ marginLeft: 8 }}>📞 {c.telefono}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const TH = (a='left') => ({
  padding:'10px 12px', fontSize:10, fontWeight:700,
  color:C.hint, textAlign:a, background:C.sur3,
  borderBottom:`1px solid ${C.bord2}`, textTransform:'uppercase',
  letterSpacing:'.05em', whiteSpace:'nowrap',
})
const TD = (a='left') => ({
  padding:'11px 12px', fontSize:13,
  borderBottom:`1px solid ${C.border}`, verticalAlign:'middle',
  color:C.text, textAlign:a,
})

// ── Definicion de tabs ───────────────────────────────────────
const TABS = [
  { id:'ventas',     label:'Ventas',      icon:DollarSign },
  { id:'productos',  label:'Productos',   icon:Package },
  { id:'inventario', label:'Inventario',   icon:BarChart3 },
  { id:'cxc',        label:'CXC Cartera', icon:Wallet },
  { id:'compras',    label:'Compras',      icon:ShoppingCart },
  { id:'comisiones', label:'Comisiones',   icon:TrendingUp },
  { id:'caja',       label:'Caja',         icon:Users },
  { id:'ats',        label:'ATS',          icon:FileText },
  { id:'form104',    label:'Form. 104',    icon:FileText },
  { id:'form103',    label:'Form. 103',    icon:FileText },
  { id:'rentabilidad',    label:'Rentabilidad',    icon:TrendingUp },
  { id:'pareto',          label:'Pareto 80/20',    icon:Users },
  { id:'stockMuerto',     label:'Stock Muerto',    icon:Package },
  { id:'cxpAging',        label:'CXP Aging',       icon:Wallet },
  { id:'comparativo',     label:'Comparativo',     icon:BarChart3 },
  { id:'servTecnico',     label:'Serv. Técnico',   icon:Wallet },
  { id:'nominaRep',       label:'Nómina',          icon:Users },
  { id:'devolucionesRep', label:'Devoluciones',     icon:FileText },
  { id:'ejecutivo',       label:'Ejecutivo',        icon:TrendingUp },
  { id:'sugerirCompra',  label:'Sugerir Compra',   icon:ShoppingCart },
  { id:'abc',            label:'ABC Pareto',       icon:BarChart3 },
  { id:'rotacion',       label:'Rotacion',         icon:RefreshCw },
  { id:'flujoCaja',      label:'Flujo Caja',       icon:DollarSign },
]

// ════════════════════════════════════════════════════════════
//  COMPONENTES AUXILIARES
// ════════════════════════════════════════════════════════════

// ── KPI Card ─────────────────────────────────────────────────
function KpiCard({ label, value, color, bgColor, icon:Icon }) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  return (
    <div style={{background:C.surface, borderRadius:12, padding:'16px 18px',
      border:`1px solid ${C.bord2}`, flex:1, minWidth:140}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
        <div>
          <div style={{fontSize:11, color:C.hint, fontWeight:600,
            textTransform:'uppercase', letterSpacing:'.05em'}}>{label}</div>
          <div style={{fontSize:20, fontWeight:800, color, marginTop:6}}>{value}</div>
        </div>
        {Icon && (
          <div style={{padding:8, borderRadius:8, background:bgColor||'transparent'}}>
            <Icon size={18} color={color} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Boton de exportar ────────────────────────────────────────
function ExportButton({ icon:Icon, label, color, onClick, loading }) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  return (
    <button onClick={onClick} disabled={loading}
      style={{display:'flex', alignItems:'center', gap:6, padding:'8px 14px',
        borderRadius:8, border:`1px solid ${color}33`, cursor:loading?'not-allowed':'pointer',
        background:`${color}15`, color, fontSize:12, fontWeight:700,
        opacity:loading?0.5:1, transition:'all .15s'}}>
      {loading ? <Loader2 size={14} className="spin" /> : <Icon size={14} />}
      {label}
    </button>
  )
}

// ── Tabla generica ───────────────────────────────────────────
function DataTable({ columns, rows, emptyMsg }) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  if (!rows || rows.length === 0) {
    return (
      <div style={{padding:40, textAlign:'center', color:C.hint, fontSize:13}}>
        {emptyMsg || 'No hay datos para mostrar'}
      </div>
    )
  }
  return (
    <div style={{overflowX:'auto'}}>
      <table style={{width:'100%', borderCollapse:'collapse'}}>
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i} style={TH(col.align||'left')}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}
              onMouseEnter={e=>e.currentTarget.style.background=C.sur2}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              {columns.map((col, ci) => (
                <td key={ci} style={TD(col.align||'left')}>
                  {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  CONFIGURACION POR TAB
// ════════════════════════════════════════════════════════════

// ── Tab VENTAS ───────────────────────────────────────────────
function useTabVentas() {
  const [vendedores, setVendedores] = useState([])
  const [sucursales, setSucursales] = useState([])

  useEffect(() => {
    api.get('/vendedores').then(r => setVendedores(r.data)).catch(() => {})
    api.get('/sucursales').then(r => setSucursales(r.data)).catch(() => {})
  }, [])

  const defaultFiltros = { fecha_ini:primerDiaMes(), fecha_fin:hoy(), cliente_obj:null, vendedor_id:'', sucursal_id:'' }

  const fetchData = async (filtros) => {
    const params = {
      fecha_ini: filtros.fecha_ini, fecha_fin: filtros.fecha_fin,
      ...(filtros.cliente_obj && { cliente_id: filtros.cliente_obj.id }),
      ...(filtros.vendedor_id && { vendedor_id: filtros.vendedor_id }),
      ...(filtros.sucursal_id && { sucursal_id: filtros.sucursal_id }),
    }
    const { data } = await api.get('/reportes/ventas', { params })
    return data
  }

  const renderFiltros = (filtros, setFiltro) => (
    <>
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <Calendar size={14} color={C.hint} />
        <input type="date" value={filtros.fecha_ini}
          onChange={e => setFiltro('fecha_ini', e.target.value)} style={{...FI, width:150}} />
        <span style={{color:C.hint, fontSize:12}}>a</span>
        <input type="date" value={filtros.fecha_fin}
          onChange={e => setFiltro('fecha_fin', e.target.value)} style={{...FI, width:150}} />
      </div>
      <BuscadorCliente
        value={filtros.cliente_obj}
        onChange={c => setFiltro('cliente_obj', c)}
        placeholder="Buscar por nombre, RUC o cédula..."
      />
      <select value={filtros.vendedor_id} onChange={e => setFiltro('vendedor_id', e.target.value)}
        style={{...FI_SELECT, width:170}}>
        <option value="">Todos los vendedores</option>
        {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
      </select>
      <select value={filtros.sucursal_id} onChange={e => setFiltro('sucursal_id', e.target.value)}
        style={{...FI_SELECT, width:170}}>
        <option value="">Todas las sucursales</option>
        {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
      </select>
    </>
  )

  const kpis = (resumen) => resumen ? [
    { label:'Facturas', value:fmtN(resumen.facturas), color:C.blue, bgColor:C.blueD, icon:FileText },
    { label:'Subtotal 0%', value:fmt$(resumen.subtotal_0), color:C.muted, bgColor:C.sur2, icon:DollarSign },
    { label:'Subtotal IVA', value:fmt$(resumen.subtotal_iva), color:C.cyan, bgColor:'rgba(6,182,212,.15)', icon:DollarSign },
    { label:'IVA', value:fmt$(resumen.iva), color:C.amber, bgColor:C.amberD, icon:DollarSign },
    { label:'Total', value:fmt$(resumen.total), color:C.green, bgColor:C.greenD, icon:DollarSign },
  ] : []

  const columns = [
    { key:'numero_factura', label:'N° Factura', render:v => <code style={{color:C.purple, fontWeight:700, fontSize:12}}>{v||'—'}</code> },
    { key:'fecha', label:'Fecha', render:v => <span style={{color:C.muted, fontSize:12}}>{fmtDate(v)}</span> },
    { key:'cliente', label:'Cliente' },
    { key:'ruc', label:'RUC', render:v => <span style={{fontFamily:'monospace', fontSize:12, color:C.muted}}>{v||'—'}</span> },
    { key:'vendedor', label:'Vendedor' },
    { key:'sucursal', label:'Sucursal' },
    { key:'total', label:'Total', align:'right', render:v => <strong style={{color:C.green}}>{fmt$(v)}</strong> },
  ]

  return { defaultFiltros, fetchData, renderFiltros, kpis, columns }
}

// ── Tab PRODUCTOS FACTURADOS ─────────────────────────────────
function useTabProductos() {
  const [marcas, setMarcas] = useState([])
  const [categorias, setCategorias] = useState([])

  useEffect(() => {
    api.get('/marcas').then(r => setMarcas(r.data)).catch(() => {})
    api.get('/categorias').then(r => setCategorias(r.data)).catch(() => {})
  }, [])

  const defaultFiltros = { fecha_ini:primerDiaMes(), fecha_fin:hoy(), agrupar:'producto', marca_id:'', categoria_id:'', cliente_obj:null }

  const fetchData = async (filtros) => {
    const params = {
      fecha_ini: filtros.fecha_ini, fecha_fin: filtros.fecha_fin,
      agrupar: filtros.agrupar,
      ...(filtros.marca_id && { marca_id: filtros.marca_id }),
      ...(filtros.categoria_id && { categoria_id: filtros.categoria_id }),
      ...(filtros.cliente_obj && { cliente_id: filtros.cliente_obj.id }),
    }
    const { data } = await api.get('/reportes/productos-facturados', { params })
    return data
  }

  const renderFiltros = (filtros, setFiltro) => (
    <>
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <Calendar size={14} color={C.hint} />
        <input type="date" value={filtros.fecha_ini}
          onChange={e => setFiltro('fecha_ini', e.target.value)} style={{...FI, width:150}} />
        <span style={{color:C.hint, fontSize:12}}>a</span>
        <input type="date" value={filtros.fecha_fin}
          onChange={e => setFiltro('fecha_fin', e.target.value)} style={{...FI, width:150}} />
      </div>
      <BuscadorCliente
        value={filtros.cliente_obj}
        onChange={c => setFiltro('cliente_obj', c)}
        placeholder="Filtrar por cliente..."
      />
      <select value={filtros.agrupar} onChange={e => setFiltro('agrupar', e.target.value)}
        style={{...FI_SELECT, width:150}}>
        <option value="producto">Por Producto</option>
        <option value="cliente">Por Cliente</option>
        <option value="marca">Por Marca</option>
        <option value="categoria">Por Categoría</option>
        <option value="vendedor">Por Vendedor</option>
      </select>
      <select value={filtros.marca_id} onChange={e => setFiltro('marca_id', e.target.value)}
        style={{...FI_SELECT, width:150}}>
        <option value="">Todas las marcas</option>
        {marcas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
      </select>
      <select value={filtros.categoria_id} onChange={e => setFiltro('categoria_id', e.target.value)}
        style={{...FI_SELECT, width:150}}>
        <option value="">Todas las categorías</option>
        {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>
    </>
  )

  const kpis = (resumen) => resumen ? [
    { label:'Facturas', value:fmtN(resumen.facturas), color:C.blue, bgColor:C.blueD, icon:FileText },
    { label:'Productos Distintos', value:fmtN(resumen.productos_distintos), color:C.purple, bgColor:C.purpleD, icon:Package },
    { label:'Unidades', value:fmtN(resumen.unidades), color:C.cyan, bgColor:'rgba(6,182,212,.15)', icon:Package },
    { label:'Total', value:fmt$(resumen.total), color:C.green, bgColor:C.greenD, icon:DollarSign },
  ] : []

  const getColumns = (agrupar) => {
    const base = [
      { key:'grupo', label:'Grupo', render:v => <strong>{v||'—'}</strong> },
    ]
    if (agrupar === 'producto') {
      base.push({ key:'marca', label:'Marca', render:v => <span style={{color:C.muted}}>{v||'—'}</span> })
      base.push({ key:'categoria', label:'Categoría', render:v => <span style={{color:C.muted}}>{v||'—'}</span> })
    }
    base.push({ key:'unidades', label:'Unidades', align:'right', render:v => <span style={{fontWeight:700}}>{fmtN(v)}</span> })
    base.push({ key:'total', label:'Total', align:'right', render:v => <strong style={{color:C.green}}>{fmt$(v)}</strong> })
    return base
  }

  return { defaultFiltros, fetchData, renderFiltros, kpis, getColumns, dynamicColumns:true }
}

// ── Tab INVENTARIO ───────────────────────────────────────────
function useTabInventario() {
  const [bodegas, setBodegas] = useState([])
  const [marcas, setMarcas] = useState([])
  const [categorias, setCategorias] = useState([])

  useEffect(() => {
    api.get('/bodegas').then(r => setBodegas(r.data)).catch(() => {})
    api.get('/marcas').then(r => setMarcas(r.data)).catch(() => {})
    api.get('/categorias').then(r => setCategorias(r.data)).catch(() => {})
  }, [])

  const defaultFiltros = { bodega_id:'', marca_id:'', categoria_id:'', solo_stock:false }

  const fetchData = async (filtros) => {
    const params = {
      ...(filtros.bodega_id && { bodega_id: filtros.bodega_id }),
      ...(filtros.marca_id && { marca_id: filtros.marca_id }),
      ...(filtros.categoria_id && { categoria_id: filtros.categoria_id }),
      ...(filtros.solo_stock && { solo_stock: true }),
    }
    const { data } = await api.get('/reportes/inventario', { params })
    return data
  }

  const renderFiltros = (filtros, setFiltro) => (
    <>
      <select value={filtros.bodega_id} onChange={e => setFiltro('bodega_id', e.target.value)}
        style={{...FI_SELECT, width:170}}>
        <option value="">Todas las bodegas</option>
        {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
      </select>
      <select value={filtros.marca_id} onChange={e => setFiltro('marca_id', e.target.value)}
        style={{...FI_SELECT, width:160}}>
        <option value="">Todas las marcas</option>
        {marcas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
      </select>
      <select value={filtros.categoria_id} onChange={e => setFiltro('categoria_id', e.target.value)}
        style={{...FI_SELECT, width:160}}>
        <option value="">Todas las categor&iacute;as</option>
        {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>
      <label style={{display:'flex', alignItems:'center', gap:6, cursor:'pointer',
        fontSize:13, color:C.muted, userSelect:'none'}}>
        <input type="checkbox" checked={filtros.solo_stock}
          onChange={e => setFiltro('solo_stock', e.target.checked)}
          style={{accentColor:C.blue, cursor:'pointer'}} />
        Solo con stock
      </label>
    </>
  )

  const kpis = (resumen) => resumen ? [
    { label:'Total Productos', value:fmtN(resumen.total_productos), color:C.blue, bgColor:C.blueD, icon:Package },
    { label:'Con Stock', value:fmtN(resumen.con_stock), color:C.green, bgColor:C.greenD, icon:Package },
    { label:'Sin Stock', value:fmtN(resumen.sin_stock), color:C.red, bgColor:C.redD, icon:AlertCircle },
    { label:'Valor Costo', value:fmt$(resumen.valor_costo_total), color:C.amber, bgColor:C.amberD, icon:DollarSign },
    { label:'Valor Venta', value:fmt$(resumen.valor_venta_total), color:C.green, bgColor:C.greenD, icon:DollarSign },
  ] : []

  const columns = [
    { key:'codigo', label:'Código', render:v => <code style={{color:C.purple, fontWeight:700, fontSize:12}}>{v||'—'}</code> },
    { key:'producto', label:'Producto', render:v => <strong>{v||'—'}</strong> },
    { key:'marca', label:'Marca', render:v => <span style={{color:C.muted}}>{v||'—'}</span> },
    { key:'categoria', label:'Categoría', render:v => <span style={{color:C.muted}}>{v||'—'}</span> },
    { key:'stock', label:'Stock', align:'right', render:v => {
      const n = Number(v||0)
      const color = n > 0 ? C.green : C.red
      return <span style={{fontWeight:700, color}}>{fmtN(v)}</span>
    }},
    { key:'costo', label:'Costo', align:'right', render:v => <span style={{color:C.muted}}>{fmt$(v)}</span> },
    { key:'precio', label:'Precio', align:'right', render:v => <span style={{color:C.text}}>{fmt$(v)}</span> },
    { key:'valor_costo', label:'Valor Costo', align:'right', render:v => <span style={{color:C.amber}}>{fmt$(v)}</span> },
    { key:'valor_venta', label:'Valor Venta', align:'right', render:v => <strong style={{color:C.green}}>{fmt$(v)}</strong> },
  ]

  return { defaultFiltros, fetchData, renderFiltros, kpis, columns, noDates:true }
}

// ── Tab CXC CARTERA (Aging) ──────────────────────────────────
function useTabCxcAging() {
  const [sucursales, setSucursales] = useState([])

  useEffect(() => {
    api.get('/sucursales').then(r => setSucursales(r.data)).catch(() => {})
  }, [])

  const defaultFiltros = { sucursal_id:'' }

  const fetchData = async (filtros) => {
    const params = {
      ...(filtros.sucursal_id && { sucursal_id: filtros.sucursal_id }),
    }
    const { data } = await api.get('/reportes/cxc-aging', { params })
    return data
  }

  const renderFiltros = (filtros, setFiltro) => (
    <>
      <select value={filtros.sucursal_id} onChange={e => setFiltro('sucursal_id', e.target.value)}
        style={{...FI_SELECT, width:200}}>
        <option value="">Todas las sucursales</option>
        {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
      </select>
    </>
  )

  const agingBadge = (label, value, color, bgColor) => (
    <div style={{display:'inline-flex', flexDirection:'column', alignItems:'center',
      padding:'8px 14px', borderRadius:8, background:bgColor, minWidth:80}}>
      <span style={{fontSize:10, color:C.hint, fontWeight:600, textTransform:'uppercase',
        marginBottom:4}}>{label}</span>
      <span style={{fontSize:16, fontWeight:800, color}}>{fmt$(value)}</span>
    </div>
  )

  const kpis = (resumen) => resumen ? [
    { label:'Total Cartera', value:fmt$(resumen.total_cartera), color:C.blue, bgColor:C.blueD, icon:Wallet },
    { label:'Vigente', value:fmt$(resumen.vigente), color:C.green, bgColor:C.greenD, icon:DollarSign },
    { label:'1-30 días', value:fmt$(resumen['1_30']), color:C.amber, bgColor:C.amberD, icon:Calendar },
    { label:'31-60 días', value:fmt$(resumen['31_60']), color:'#F97316', bgColor:'rgba(249,115,22,.15)', icon:Calendar },
    { label:'61-90 días', value:fmt$(resumen['61_90']), color:C.red, bgColor:C.redD, icon:Calendar },
    { label:'+90 días', value:fmt$(resumen['90_mas']), color:'#DC2626', bgColor:'rgba(220,38,38,.15)', icon:AlertCircle },
  ] : []

  const columns = [
    { key:'cliente', label:'Cliente', render:v => <strong>{v||'—'}</strong> },
    { key:'ruc', label:'RUC', render:v => <span style={{fontFamily:'monospace', fontSize:12, color:C.muted}}>{v||'—'}</span> },
    { key:'factura', label:'Factura', render:v => <code style={{color:C.purple, fontWeight:700, fontSize:12}}>{v||'—'}</code> },
    { key:'fecha_emision', label:'Fecha Emisión', render:v => <span style={{color:C.muted, fontSize:12}}>{fmtDate(v)}</span> },
    { key:'vencimiento', label:'Vencimiento', render:v => <span style={{color:C.muted, fontSize:12}}>{fmtDate(v)}</span> },
    { key:'monto', label:'Monto', align:'right', render:v => <span style={{color:C.text}}>{fmt$(v)}</span> },
    { key:'saldo', label:'Saldo', align:'right', render:v => <strong style={{color:C.amber}}>{fmt$(v)}</strong> },
    { key:'dias_vencido', label:'Días Vencido', align:'right', render:(v,row) => {
      const n = Number(v||0)
      const color = n <= 0 ? C.green : n <= 30 ? C.amber : n <= 60 ? '#F97316' : C.red
      return <span style={{fontWeight:700, color}}>{n}</span>
    }},
    { key:'rango', label:'Rango', render:(v) => {
      const colors = {
        'Vigente':{bg:C.greenD, c:C.green}, '1-30':{bg:C.amberD, c:C.amber},
        '31-60':{bg:'rgba(249,115,22,.15)', c:'#F97316'}, '61-90':{bg:C.redD, c:C.red},
        '+90':{bg:'rgba(220,38,38,.15)', c:'#DC2626'},
      }
      const cfg = colors[v] || {bg:C.sur2, c:C.muted}
      return <span style={{padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
        background:cfg.bg, color:cfg.c}}>{v||'—'}</span>
    }},
  ]

  return { defaultFiltros, fetchData, renderFiltros, kpis, columns, noDates:true }
}

// ── Tab COMPRAS ──────────────────────────────────────────────
function useTabCompras() {
  const defaultFiltros = { fecha_ini:primerDiaMes(), fecha_fin:hoy(), proveedor:'' }

  const fetchData = async (filtros) => {
    const params = {
      fecha_ini: filtros.fecha_ini, fecha_fin: filtros.fecha_fin,
      ...(filtros.proveedor && { proveedor_id: filtros.proveedor }),
    }
    const { data } = await api.get('/reportes/compras', { params })
    return data
  }

  const renderFiltros = (filtros, setFiltro) => (
    <>
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <Calendar size={14} color={C.hint} />
        <input type="date" value={filtros.fecha_ini}
          onChange={e => setFiltro('fecha_ini', e.target.value)} style={{...FI, width:150}} />
        <span style={{color:C.hint, fontSize:12}}>a</span>
        <input type="date" value={filtros.fecha_fin}
          onChange={e => setFiltro('fecha_fin', e.target.value)} style={{...FI, width:150}} />
      </div>
      <div style={{position:'relative', minWidth:200}}>
        <Search size={14} color={C.hint} style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)'}} />
        <input value={filtros.proveedor} placeholder="Buscar proveedor..."
          onChange={e => setFiltro('proveedor', e.target.value)}
          style={{...FI, paddingLeft:30}} />
      </div>
    </>
  )

  const kpis = (resumen) => resumen ? [
    { label:'Compras', value:fmtN(resumen.compras), color:C.blue, bgColor:C.blueD, icon:ShoppingCart },
    { label:'Subtotal 0%', value:fmt$(resumen.subtotal_0), color:C.muted, bgColor:C.sur2, icon:DollarSign },
    { label:'Subtotal IVA', value:fmt$(resumen.subtotal_iva), color:C.cyan, bgColor:'rgba(6,182,212,.15)', icon:DollarSign },
    { label:'IVA', value:fmt$(resumen.iva), color:C.amber, bgColor:C.amberD, icon:DollarSign },
    { label:'Total', value:fmt$(resumen.total), color:C.green, bgColor:C.greenD, icon:DollarSign },
  ] : []

  const columns = [
    { key:'numero_documento', label:'N° Documento', render:v => <code style={{color:C.purple, fontWeight:700, fontSize:12}}>{v||'—'}</code> },
    { key:'fecha', label:'Fecha', render:v => <span style={{color:C.muted, fontSize:12}}>{fmtDate(v)}</span> },
    { key:'proveedor', label:'Proveedor', render:v => <strong>{v||'—'}</strong> },
    { key:'ruc', label:'RUC', render:v => <span style={{fontFamily:'monospace', fontSize:12, color:C.muted}}>{v||'—'}</span> },
    { key:'total', label:'Total', align:'right', render:v => <strong style={{color:C.green}}>{fmt$(v)}</strong> },
  ]

  return { defaultFiltros, fetchData, renderFiltros, kpis, columns }
}

// ── Tab COMISIONES ───────────────────────────────────────────
function useTabComisiones() {
  const defaultFiltros = { mes: mesActual() }

  const fetchData = async (filtros) => {
    const { data } = await api.get('/reportes/comisiones', { params: { mes: filtros.mes } })
    return data
  }

  const renderFiltros = (filtros, setFiltro) => (
    <>
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <Calendar size={14} color={C.hint} />
        <input type="month" value={filtros.mes}
          onChange={e => setFiltro('mes', e.target.value)}
          style={{...FI, width:180}} />
      </div>
    </>
  )

  const kpis = (resumen) => resumen ? [
    { label:'Vendedores', value:fmtN(resumen.vendedores), color:C.blue, bgColor:C.blueD, icon:Users },
    { label:'Total Ventas', value:fmt$(resumen.total_ventas), color:C.green, bgColor:C.greenD, icon:DollarSign },
    { label:'Total Comisiones', value:fmt$(resumen.total_comisiones), color:C.purple, bgColor:C.purpleD, icon:TrendingUp },
  ] : []

  const columns = [
    { key:'codigo', label:'Código', render:v => <code style={{color:C.purple, fontWeight:700, fontSize:12}}>{v||'—'}</code> },
    { key:'vendedor', label:'Vendedor', render:v => <strong>{v||'—'}</strong> },
    { key:'sucursal', label:'Sucursal', render:v => <span style={{color:C.muted}}>{v||'—'}</span> },
    { key:'meta', label:'Meta', align:'right', render:v => <span style={{color:C.muted}}>{fmt$(v)}</span> },
    { key:'ventas', label:'Ventas', align:'right', render:v => <strong style={{color:C.text}}>{fmt$(v)}</strong> },
    { key:'pct_cumplimiento', label:'% Cumplimiento', align:'center', render:(v) => {
      const pct = Number(v||0)
      const barColor = pct >= 100 ? C.green : pct >= 70 ? C.amber : C.red
      return (
        <div style={{display:'flex', alignItems:'center', gap:8, justifyContent:'center'}}>
          <div style={{width:80, height:8, borderRadius:4, background:C.sur3, overflow:'hidden'}}>
            <div style={{width:`${Math.min(pct,100)}%`, height:'100%', borderRadius:4,
              background:barColor, transition:'width .3s'}} />
          </div>
          <span style={{fontSize:11, fontWeight:700, color:barColor, minWidth:40}}>{fmtPct(v)}</span>
        </div>
      )
    }},
    { key:'comision_pct', label:'Comisión %', align:'right', render:v => <span style={{color:C.cyan}}>{fmtPct(v)}</span> },
    { key:'comision_valor', label:'Comisión $', align:'right', render:v => <strong style={{color:C.green}}>{fmt$(v)}</strong> },
  ]

  return { defaultFiltros, fetchData, renderFiltros, kpis, columns, noDates:true }
}

// ── Tab CAJA ─────────────────────────────────────────────────
function useTabCaja() {
  const defaultFiltros = { fecha_ini:primerDiaMes(), fecha_fin:hoy() }

  const fetchData = async (filtros) => {
    const params = { fecha_ini: filtros.fecha_ini, fecha_fin: filtros.fecha_fin }
    const { data } = await api.get('/reportes/caja', { params })
    return data
  }

  const renderFiltros = (filtros, setFiltro) => (
    <>
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <Calendar size={14} color={C.hint} />
        <input type="date" value={filtros.fecha_ini}
          onChange={e => setFiltro('fecha_ini', e.target.value)} style={{...FI, width:150}} />
        <span style={{color:C.hint, fontSize:12}}>a</span>
        <input type="date" value={filtros.fecha_fin}
          onChange={e => setFiltro('fecha_fin', e.target.value)} style={{...FI, width:150}} />
      </div>
    </>
  )

  const kpis = (resumen) => resumen ? [
    { label:'Sesiones', value:fmtN(resumen.sesiones), color:C.blue, bgColor:C.blueD, icon:Users },
    { label:'Total Efectivo', value:fmt$(resumen.total_efectivo), color:C.green, bgColor:C.greenD, icon:DollarSign },
    { label:'Total Tarjeta', value:fmt$(resumen.total_tarjeta), color:C.purple, bgColor:C.purpleD, icon:Wallet },
    { label:'Total Diferencia', value:fmt$(resumen.total_diferencia), color:
      Number(resumen.total_diferencia||0) === 0 ? C.green :
      Number(resumen.total_diferencia||0) > 0 ? C.amber : C.red,
      bgColor: Number(resumen.total_diferencia||0) === 0 ? C.greenD : C.amberD, icon:AlertCircle },
  ] : []

  const columns = [
    { key:'fecha', label:'Fecha', render:v => <span style={{color:C.muted, fontSize:12}}>{fmtDate(v)}</span> },
    { key:'caja', label:'Caja', render:v => <strong>{v||'—'}</strong> },
    { key:'usuario', label:'Usuario' },
    { key:'apertura', label:'Apertura', align:'right', render:v => <span style={{color:C.muted}}>{fmt$(v)}</span> },
    { key:'efectivo', label:'Efectivo', align:'right', render:v => <span style={{color:C.green}}>{fmt$(v)}</span> },
    { key:'tarjeta', label:'Tarjeta', align:'right', render:v => <span style={{color:C.purple}}>{fmt$(v)}</span> },
    { key:'transferencia', label:'Transferencia', align:'right', render:v => <span style={{color:C.cyan}}>{fmt$(v)}</span> },
    { key:'contado', label:'Contado', align:'right', render:v => <span style={{color:C.text}}>{fmt$(v)}</span> },
    { key:'diferencia', label:'Diferencia', align:'right', render:v => {
      const n = Number(v||0)
      const color = n === 0 ? C.green : n > 0 ? C.amber : C.red
      return <strong style={{color}}>{fmt$(v)}</strong>
    }},
    { key:'estado', label:'Estado', align:'center', render:v => {
      const cfg = v === 'CERRADA'
        ? { bg:C.greenD, c:C.green }
        : v === 'ABIERTA'
        ? { bg:C.blueD, c:C.blue }
        : { bg:C.amberD, c:C.amber }
      return <span style={{padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
        background:cfg.bg, color:cfg.c}}>{v||'—'}</span>
    }},
  ]

  return { defaultFiltros, fetchData, renderFiltros, kpis, columns }
}

// ── Tab ATS ─────────────────────────────────────────────────
function useTabAts() {
  const defaultFiltros = { mes: mesActual() }

  const fetchData = async (filtros) => {
    const { data } = await api.get('/reportes/ats', { params: { mes: filtros.mes } })
    return {
      titulo: `ATS — ${filtros.mes}`,
      resumen: data.resumen,
      detalle: data.ventas,
      compras: data.compras,
      retenciones: data.retenciones,
      anulados: data.anulados,
      notas_credito: data.notas_credito,
      periodo: data.periodo,
    }
  }

  const renderFiltros = (filtros, setFiltro) => (
    <>
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <Calendar size={14} color={C.hint} />
        <input type="month" value={filtros.mes}
          onChange={e => setFiltro('mes', e.target.value)}
          style={{...FI, width:180}} />
      </div>
    </>
  )

  const kpis = (resumen) => resumen ? [
    { label:'Ventas', value:fmtN(resumen.num_ventas), color:C.green, bgColor:C.greenD, icon:DollarSign },
    { label:'Total Ventas', value:fmt$(resumen.total_ventas), color:C.green, bgColor:C.greenD, icon:DollarSign },
    { label:'Compras', value:fmtN(resumen.num_compras), color:C.blue, bgColor:C.blueD, icon:ShoppingCart },
    { label:'Total Compras', value:fmt$(resumen.total_compras), color:C.blue, bgColor:C.blueD, icon:ShoppingCart },
    { label:'Retenciones', value:fmtN(resumen.num_retenciones), color:C.purple, bgColor:C.purpleD, icon:FileText },
    { label:'Anulados', value:fmtN(resumen.num_anulados), color:C.red, bgColor:C.redD, icon:AlertCircle },
  ] : []

  const columns = [
    { key:'numero_factura', label:'N. Factura', render:v => <code style={{color:C.purple, fontWeight:700, fontSize:12}}>{v||'--'}</code> },
    { key:'fecha_emision', label:'Fecha', render:v => <span style={{color:C.muted, fontSize:12}}>{fmtDate(v)}</span> },
    { key:'razon_social', label:'Cliente' },
    { key:'identificacion', label:'RUC/CI', render:v => <span style={{fontFamily:'monospace', fontSize:12, color:C.muted}}>{v||'--'}</span> },
    { key:'subtotal_0', label:'Sub. 0%', align:'right', render:v => <span style={{color:C.muted}}>{fmt$(v)}</span> },
    { key:'subtotal_iva', label:'Sub. IVA', align:'right', render:v => <span style={{color:C.cyan}}>{fmt$(v)}</span> },
    { key:'iva', label:'IVA', align:'right', render:v => <span style={{color:C.amber}}>{fmt$(v)}</span> },
    { key:'total', label:'Total', align:'right', render:v => <strong style={{color:C.green}}>{fmt$(v)}</strong> },
  ]

  return { defaultFiltros, fetchData, renderFiltros, kpis, columns, noDates:true, isAts:true }
}

// ── Tab FORMULARIO 104 (IVA) ────────────────────────────────
function useTabForm104() {
  const defaultFiltros = { mes: mesActual() }

  const fetchData = async (filtros) => {
    const { data } = await api.get('/reportes/formulario-104', { params: { mes: filtros.mes } })
    return {
      titulo: `Formulario 104 IVA - ${filtros.mes}`,
      resumen: {
        iva_causado: data.iva_causado,
        credito_tributario: data.credito_tributario,
        retenciones_recibidas: data.retenciones_iva_recibidas,
        impuesto_a_pagar: data.impuesto_a_pagar,
      },
      detalle: [
        { concepto: 'Ventas gravadas con tarifa IVA', base: data.ventas_tarifa_iva.base, impuesto: data.ventas_tarifa_iva.impuesto },
        { concepto: 'Ventas tarifa 0%', base: data.ventas_tarifa_0.base, impuesto: 0 },
        { concepto: 'Compras gravadas con tarifa IVA', base: data.compras_tarifa_iva.base, impuesto: data.compras_tarifa_iva.impuesto },
        { concepto: 'Credito tributario (IVA compras)', base: null, impuesto: data.credito_tributario },
        { concepto: 'Retenciones IVA recibidas', base: null, impuesto: data.retenciones_iva_recibidas },
        { concepto: 'IVA causado', base: null, impuesto: data.iva_causado },
        { concepto: 'IMPUESTO A PAGAR', base: null, impuesto: data.impuesto_a_pagar },
      ],
      _raw: data,
    }
  }

  const renderFiltros = (filtros, setFiltro) => (
    <>
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <Calendar size={14} color={C.hint} />
        <input type="month" value={filtros.mes}
          onChange={e => setFiltro('mes', e.target.value)}
          style={{...FI, width:180}} />
      </div>
    </>
  )

  const kpis = (resumen) => resumen ? [
    { label:'IVA Causado', value:fmt$(resumen.iva_causado), color:C.amber, bgColor:C.amberD, icon:DollarSign },
    { label:'Credito Tributario', value:fmt$(resumen.credito_tributario), color:C.blue, bgColor:C.blueD, icon:DollarSign },
    { label:'Ret. IVA Recibidas', value:fmt$(resumen.retenciones_recibidas), color:C.purple, bgColor:C.purpleD, icon:DollarSign },
    { label:'Impuesto a Pagar', value:fmt$(resumen.impuesto_a_pagar), color:C.green, bgColor:C.greenD, icon:DollarSign },
  ] : []

  const columns = [
    { key:'concepto', label:'Concepto', render:v => {
      const bold = v === 'IMPUESTO A PAGAR' || v === 'IVA causado'
      return <span style={{fontWeight:bold?800:400, color:bold?C.green:C.text}}>{v}</span>
    }},
    { key:'base', label:'Base Imponible', align:'right', render:v => v !== null && v !== undefined ? <span style={{color:C.cyan}}>{fmt$(v)}</span> : <span style={{color:C.hint}}>--</span> },
    { key:'impuesto', label:'Impuesto', align:'right', render:(v,row) => {
      const bold = row.concepto === 'IMPUESTO A PAGAR'
      return <span style={{fontWeight:bold?800:600, color:bold?C.green:C.amber}}>{fmt$(v)}</span>
    }},
  ]

  return { defaultFiltros, fetchData, renderFiltros, kpis, columns, noDates:true }
}

// ── Tab FORMULARIO 103 (Retenciones Fuente) ────────────────
function useTabForm103() {
  const defaultFiltros = { mes: mesActual() }

  const fetchData = async (filtros) => {
    const { data } = await api.get('/reportes/formulario-103', { params: { mes: filtros.mes } })
    return {
      titulo: `Formulario 103 Retenciones - ${filtros.mes}`,
      resumen: {
        total_retenido: data.total_retenido,
        num_codigos: data.num_codigos,
      },
      detalle: (data.retenciones || []).map(r => ({
        codigo_retencion: r.codigo_retencion,
        porcentaje: Number(r.porcentaje),
        base_imponible: Number(r.base_imponible),
        valor_retenido: Number(r.valor_retenido),
        num_comprobantes: Number(r.num_comprobantes),
      })),
    }
  }

  const renderFiltros = (filtros, setFiltro) => (
    <>
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <Calendar size={14} color={C.hint} />
        <input type="month" value={filtros.mes}
          onChange={e => setFiltro('mes', e.target.value)}
          style={{...FI, width:180}} />
      </div>
    </>
  )

  const kpis = (resumen) => resumen ? [
    { label:'Codigos', value:fmtN(resumen.num_codigos), color:C.blue, bgColor:C.blueD, icon:FileText },
    { label:'Total Retenido', value:fmt$(resumen.total_retenido), color:C.green, bgColor:C.greenD, icon:DollarSign },
  ] : []

  const columns = [
    { key:'codigo_retencion', label:'Codigo', render:v => <code style={{color:C.purple, fontWeight:700, fontSize:12}}>{v||'--'}</code> },
    { key:'porcentaje', label:'%', align:'center', render:v => <span style={{fontWeight:700}}>{fmtPct(v)}</span> },
    { key:'base_imponible', label:'Base Imponible', align:'right', render:v => <span style={{color:C.cyan}}>{fmt$(v)}</span> },
    { key:'valor_retenido', label:'Valor Retenido', align:'right', render:v => <strong style={{color:C.green}}>{fmt$(v)}</strong> },
    { key:'num_comprobantes', label:'Comprobantes', align:'center', render:v => <span style={{fontWeight:600}}>{fmtN(v)}</span> },
  ]

  return { defaultFiltros, fetchData, renderFiltros, kpis, columns, noDates:true }
}

// ── Tab RENTABILIDAD ─────────────────────────────────────────
function useTabRentabilidad() {
  const defaultFiltros = { fecha_ini:primerDiaMes(), fecha_fin:hoy() }

  const fetchData = async (filtros) => {
    const { data } = await api.get('/reportes/rentabilidad', {
      params: { fecha_ini: filtros.fecha_ini, fecha_fin: filtros.fecha_fin }
    })
    return data
  }

  const renderFiltros = (filtros, setFiltro) => (
    <>
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <Calendar size={14} color={C.hint} />
        <input type="date" value={filtros.fecha_ini}
          onChange={e => setFiltro('fecha_ini', e.target.value)} style={{...FI, width:150}} />
        <span style={{color:C.hint, fontSize:12}}>a</span>
        <input type="date" value={filtros.fecha_fin}
          onChange={e => setFiltro('fecha_fin', e.target.value)} style={{...FI, width:150}} />
      </div>
    </>
  )

  const kpis = (resumen) => resumen ? [
    { label:'Productos', value:fmtN(resumen.productos), color:C.blue, bgColor:C.blueD, icon:Package },
    { label:'Ingreso Total', value:fmt$(resumen.total_ingreso), color:C.green, bgColor:C.greenD, icon:DollarSign },
    { label:'Costo Total', value:fmt$(resumen.total_costo), color:C.red, bgColor:C.redD, icon:DollarSign },
    { label:'Utilidad', value:fmt$(resumen.total_utilidad), color:C.amber, bgColor:C.amberD, icon:TrendingUp },
    { label:'Margen Global', value:fmtPct(resumen.margen_global), color:C.cyan, bgColor:'rgba(6,182,212,.15)', icon:TrendingUp },
  ] : []

  const columns = [
    { key:'codigo', label:'Código', render:v => <code style={{color:C.purple, fontWeight:700, fontSize:12}}>{v||'—'}</code> },
    { key:'descripcion', label:'Producto', render:v => <strong>{v||'—'}</strong> },
    { key:'marca', label:'Marca', render:v => <span style={{color:C.muted}}>{v||'—'}</span> },
    { key:'categoria', label:'Categoría', render:v => <span style={{color:C.muted}}>{v||'—'}</span> },
    { key:'unidades', label:'Uds.', align:'right', render:v => <span style={{fontWeight:700}}>{fmtN(v)}</span> },
    { key:'ingreso', label:'Ingreso', align:'right', render:v => <span style={{color:C.green}}>{fmt$(v)}</span> },
    { key:'costo_total', label:'Costo', align:'right', render:v => <span style={{color:C.red}}>{fmt$(v)}</span> },
    { key:'utilidad', label:'Utilidad', align:'right', render:v => <strong style={{color:C.amber}}>{fmt$(v)}</strong> },
    { key:'margen_pct', label:'Margen %', align:'right', render:v => {
      const n = Number(v||0)
      const color = n >= 30 ? C.green : n >= 15 ? C.amber : C.red
      return <span style={{fontWeight:700, color}}>{fmtPct(v)}</span>
    }},
  ]

  return { defaultFiltros, fetchData, renderFiltros, kpis, columns }
}

// ── Tab PARETO (Clientes Rentables) ─────────────────────────
function useTabPareto() {
  const defaultFiltros = { fecha_ini:primerDiaMes(), fecha_fin:hoy() }

  const fetchData = async (filtros) => {
    const { data } = await api.get('/reportes/clientes-rentables', {
      params: { fecha_ini: filtros.fecha_ini, fecha_fin: filtros.fecha_fin }
    })
    return data
  }

  const renderFiltros = (filtros, setFiltro) => (
    <>
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <Calendar size={14} color={C.hint} />
        <input type="date" value={filtros.fecha_ini}
          onChange={e => setFiltro('fecha_ini', e.target.value)} style={{...FI, width:150}} />
        <span style={{color:C.hint, fontSize:12}}>a</span>
        <input type="date" value={filtros.fecha_fin}
          onChange={e => setFiltro('fecha_fin', e.target.value)} style={{...FI, width:150}} />
      </div>
    </>
  )

  const kpis = (resumen) => resumen ? [
    { label:'Total Clientes', value:fmtN(resumen.total_clientes), color:C.blue, bgColor:C.blueD, icon:Users },
    { label:'Total Ventas', value:fmt$(resumen.total_ventas), color:C.green, bgColor:C.greenD, icon:DollarSign },
    { label:'Clientes Pareto (80%)', value:fmtN(resumen.clientes_pareto)+' clientes = 80% ventas', color:C.amber, bgColor:C.amberD, icon:TrendingUp },
    { label:'% Clientes Pareto', value:fmtPct(resumen.pct_clientes_pareto), color:C.purple, bgColor:C.purpleD, icon:Users },
  ] : []

  const columns = [
    { key:'cliente', label:'Cliente', render:v => <strong>{v||'—'}</strong> },
    { key:'ruc', label:'RUC', render:v => <span style={{fontFamily:'monospace', fontSize:12, color:C.muted}}>{v||'—'}</span> },
    { key:'facturas', label:'Facturas', align:'right', render:v => <span style={{fontWeight:600}}>{fmtN(v)}</span> },
    { key:'total', label:'Total', align:'right', render:v => <strong style={{color:C.green}}>{fmt$(v)}</strong> },
    { key:'pct_total', label:'% del Total', align:'right', render:v => <span style={{fontWeight:700}}>{fmtPct(v)}</span> },
    { key:'pct_acumulado', label:'% Acum.', align:'center', render:(v, row) => {
      const n = Number(v||0)
      const isPareto = row.es_pareto
      return <span style={{padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
        background: isPareto ? C.greenD : C.sur3,
        color: isPareto ? C.green : C.muted}}>{fmtPct(v)}</span>
    }},
  ]

  return { defaultFiltros, fetchData, renderFiltros, kpis, columns }
}

// ── Tab STOCK MUERTO ────────────────────────────────────────
function useTabStockMuerto() {
  const defaultFiltros = { dias: 90 }

  const fetchData = async (filtros) => {
    const { data } = await api.get('/reportes/stock-muerto', {
      params: { dias: filtros.dias }
    })
    return data
  }

  const renderFiltros = (filtros, setFiltro) => (
    <>
      <div style={{display:'flex', gap:12, alignItems:'center'}}>
        <span style={{fontSize:12, color:C.hint, fontWeight:600}}>Días sin movimiento:</span>
        {[30, 60, 90, 120].map(d => (
          <button key={d} onClick={() => setFiltro('dias', d)}
            style={{padding:'6px 14px', borderRadius:8, border:'none', cursor:'pointer',
              fontSize:12, fontWeight:700,
              background: Number(filtros.dias) === d ? C.blue : C.sur3,
              color: Number(filtros.dias) === d ? 'white' : C.muted,
              transition:'all .15s'}}>
            {d}+
          </button>
        ))}
      </div>
    </>
  )

  const kpis = (resumen) => resumen ? [
    { label:'Productos', value:fmtN(resumen.productos), color:C.red, bgColor:C.redD, icon:Package },
    { label:'Valor Retenido', value:fmt$(resumen.valor_total_retenido), color:C.amber, bgColor:C.amberD, icon:DollarSign },
  ] : []

  const columns = [
    { key:'codigo', label:'Código', render:v => <code style={{color:C.purple, fontWeight:700, fontSize:12}}>{v||'—'}</code> },
    { key:'descripcion', label:'Producto', render:v => <strong>{v||'—'}</strong> },
    { key:'marca', label:'Marca', render:v => <span style={{color:C.muted}}>{v||'—'}</span> },
    { key:'categoria', label:'Categoría', render:v => <span style={{color:C.muted}}>{v||'—'}</span> },
    { key:'stock', label:'Stock', align:'right', render:v => <span style={{fontWeight:700}}>{fmtN(v)}</span> },
    { key:'costo_unitario', label:'Costo U.', align:'right', render:v => <span style={{color:C.muted}}>{fmt$(v)}</span> },
    { key:'valor_costo', label:'Valor Costo', align:'right', render:v => <strong style={{color:C.amber}}>{fmt$(v)}</strong> },
    { key:'ultima_venta', label:'Última Venta', render:v => <span style={{color:C.muted, fontSize:12}}>{v ? fmtDate(String(v).slice(0,10)) : 'Nunca'}</span> },
    { key:'dias_sin_venta', label:'Días', align:'right', render:v => {
      const n = Number(v||0)
      const color = n > 180 ? C.red : n > 90 ? C.amber : C.muted
      return <span style={{fontWeight:800, color}}>{n}</span>
    }},
  ]

  return { defaultFiltros, fetchData, renderFiltros, kpis, columns, noDates:true }
}

// ── Tab CXP AGING (Cuentas por Pagar) ───────────────────────
function useTabCxpAging() {
  const defaultFiltros = {}

  const fetchData = async () => {
    const { data } = await api.get('/reportes/cxp-aging')
    return data
  }

  const renderFiltros = () => (
    <span style={{fontSize:12, color:C.hint}}>Todas las cuentas por pagar pendientes</span>
  )

  const kpis = (resumen) => resumen ? [
    { label:'Total Cartera', value:fmt$(resumen.total_cartera), color:C.blue, bgColor:C.blueD, icon:Wallet },
    { label:'Vigente', value:fmt$(resumen.vigente), color:C.green, bgColor:C.greenD, icon:DollarSign },
    { label:'1-30 días', value:fmt$(resumen['1_30']), color:C.amber, bgColor:C.amberD, icon:Calendar },
    { label:'31-60 días', value:fmt$(resumen['31_60']), color:'#F97316', bgColor:'rgba(249,115,22,.15)', icon:Calendar },
    { label:'61-90 días', value:fmt$(resumen['61_90']), color:C.red, bgColor:C.redD, icon:Calendar },
    { label:'+90 días', value:fmt$(resumen['90_mas']), color:'#DC2626', bgColor:'rgba(220,38,38,.15)', icon:AlertCircle },
  ] : []

  const columns = [
    { key:'proveedor', label:'Proveedor', render:v => <strong>{v||'—'}</strong> },
    { key:'ruc', label:'RUC', render:v => <span style={{fontFamily:'monospace', fontSize:12, color:C.muted}}>{v||'—'}</span> },
    { key:'num_documento', label:'Documento', render:v => <code style={{color:C.purple, fontWeight:700, fontSize:12}}>{v||'—'}</code> },
    { key:'fecha_emision', label:'Emisión', render:v => <span style={{color:C.muted, fontSize:12}}>{fmtDate(v)}</span> },
    { key:'fecha_vencimiento', label:'Vencimiento', render:v => <span style={{color:C.muted, fontSize:12}}>{fmtDate(v)}</span> },
    { key:'monto', label:'Monto', align:'right', render:v => <span style={{color:C.text}}>{fmt$(v)}</span> },
    { key:'saldo', label:'Saldo', align:'right', render:v => <strong style={{color:C.amber}}>{fmt$(v)}</strong> },
    { key:'dias_vencido', label:'Días Vencido', align:'right', render:(v) => {
      const n = Number(v||0)
      const color = n <= 0 ? C.green : n <= 30 ? C.amber : n <= 60 ? '#F97316' : C.red
      return <span style={{fontWeight:700, color}}>{n}</span>
    }},
    { key:'rango', label:'Rango', render:(v) => {
      const colors = {
        'VIGENTE':{bg:C.greenD, c:C.green}, '1-30':{bg:C.amberD, c:C.amber},
        '31-60':{bg:'rgba(249,115,22,.15)', c:'#F97316'}, '61-90':{bg:C.redD, c:C.red},
        '90+':{bg:'rgba(220,38,38,.15)', c:'#DC2626'},
      }
      const cfg = colors[v] || {bg:C.sur2, c:C.muted}
      return <span style={{padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
        background:cfg.bg, color:cfg.c}}>{v||'—'}</span>
    }},
  ]

  return { defaultFiltros, fetchData, renderFiltros, kpis, columns, noDates:true }
}

// ── Tab COMPARATIVO DE VENTAS ───────────────────────────────
function useTabComparativo() {
  const prevMonthStart = () => {
    const d = new Date(); d.setMonth(d.getMonth()-1); d.setDate(1)
    return d.toISOString().slice(0,10)
  }
  const prevMonthEnd = () => {
    const d = new Date(); d.setDate(0)
    return d.toISOString().slice(0,10)
  }

  const defaultFiltros = {
    periodo1_ini: prevMonthStart(), periodo1_fin: prevMonthEnd(),
    periodo2_ini: primerDiaMes(), periodo2_fin: hoy(),
  }

  const fetchData = async (filtros) => {
    const { data } = await api.get('/reportes/comparativo-ventas', {
      params: {
        periodo1_ini: filtros.periodo1_ini, periodo1_fin: filtros.periodo1_fin,
        periodo2_ini: filtros.periodo2_ini, periodo2_fin: filtros.periodo2_fin,
      }
    })
    // Build detalle rows for the table from daily breakdowns
    const rows = []
    ;(data.dias_p1||[]).forEach(d => rows.push({periodo:'Período 1', fecha:d.fecha, facturas:d.facturas, total:d.total}))
    ;(data.dias_p2||[]).forEach(d => rows.push({periodo:'Período 2', fecha:d.fecha, facturas:d.facturas, total:d.total}))
    return {
      titulo: data.titulo,
      resumen: {
        total_p1: data.periodo1.total, facturas_p1: data.periodo1.facturas,
        total_p2: data.periodo2.total, facturas_p2: data.periodo2.facturas,
        variacion_pct: data.variacion_pct, diferencia: data.diferencia,
      },
      detalle: rows,
    }
  }

  const renderFiltros = (filtros, setFiltro) => (
    <>
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <span style={{fontSize:11, color:C.hint, fontWeight:700}}>P1:</span>
        <input type="date" value={filtros.periodo1_ini}
          onChange={e => setFiltro('periodo1_ini', e.target.value)} style={{...FI, width:140}} />
        <span style={{color:C.hint, fontSize:12}}>a</span>
        <input type="date" value={filtros.periodo1_fin}
          onChange={e => setFiltro('periodo1_fin', e.target.value)} style={{...FI, width:140}} />
      </div>
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <span style={{fontSize:11, color:C.cyan, fontWeight:700}}>P2:</span>
        <input type="date" value={filtros.periodo2_ini}
          onChange={e => setFiltro('periodo2_ini', e.target.value)} style={{...FI, width:140}} />
        <span style={{color:C.hint, fontSize:12}}>a</span>
        <input type="date" value={filtros.periodo2_fin}
          onChange={e => setFiltro('periodo2_fin', e.target.value)} style={{...FI, width:140}} />
      </div>
    </>
  )

  const kpis = (resumen) => resumen ? [
    { label:'Período 1 — Facturas', value:fmtN(resumen.facturas_p1), color:C.muted, bgColor:C.sur2, icon:FileText },
    { label:'Período 1 — Total', value:fmt$(resumen.total_p1), color:C.blue, bgColor:C.blueD, icon:DollarSign },
    { label:'Período 2 — Facturas', value:fmtN(resumen.facturas_p2), color:C.muted, bgColor:C.sur2, icon:FileText },
    { label:'Período 2 — Total', value:fmt$(resumen.total_p2), color:C.cyan, bgColor:'rgba(6,182,212,.15)', icon:DollarSign },
    { label:'Variación', value:(resumen.variacion_pct >= 0 ? '↑ ' : '↓ ') + fmtPct(Math.abs(resumen.variacion_pct)),
      color: resumen.variacion_pct >= 0 ? C.green : C.red,
      bgColor: resumen.variacion_pct >= 0 ? C.greenD : C.redD, icon:TrendingUp },
    { label:'Diferencia', value:fmt$(resumen.diferencia),
      color: resumen.diferencia >= 0 ? C.green : C.red,
      bgColor: resumen.diferencia >= 0 ? C.greenD : C.redD, icon:DollarSign },
  ] : []

  const columns = [
    { key:'periodo', label:'Período', render:v => <span style={{fontWeight:700, color: v==='Período 1' ? C.blue : C.cyan}}>{v}</span> },
    { key:'fecha', label:'Fecha', render:v => <span style={{color:C.muted, fontSize:12}}>{fmtDate(v)}</span> },
    { key:'facturas', label:'Facturas', align:'right', render:v => <span style={{fontWeight:600}}>{fmtN(v)}</span> },
    { key:'total', label:'Total', align:'right', render:v => <strong style={{color:C.green}}>{fmt$(v)}</strong> },
  ]

  return { defaultFiltros, fetchData, renderFiltros, kpis, columns, noDates:true }
}

// ── Tab SERVICIO TECNICO ────────────────────────────────────
function useTabServTecnico() {
  const defaultFiltros = { fecha_ini:primerDiaMes(), fecha_fin:hoy() }

  const fetchData = async (filtros) => {
    const { data } = await api.get('/reportes/servicio-tecnico', {
      params: { fecha_ini: filtros.fecha_ini, fecha_fin: filtros.fecha_fin }
    })
    return data
  }

  const renderFiltros = (filtros, setFiltro) => (
    <>
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <Calendar size={14} color={C.hint} />
        <input type="date" value={filtros.fecha_ini}
          onChange={e => setFiltro('fecha_ini', e.target.value)} style={{...FI, width:150}} />
        <span style={{color:C.hint, fontSize:12}}>a</span>
        <input type="date" value={filtros.fecha_fin}
          onChange={e => setFiltro('fecha_fin', e.target.value)} style={{...FI, width:150}} />
      </div>
    </>
  )

  const kpis = (resumen) => resumen ? [
    { label:'Total Ordenes', value:fmtN(resumen.total_ordenes), color:C.blue, bgColor:C.blueD, icon:FileText },
    { label:'Entregadas', value:fmtN(resumen.entregadas), color:C.green, bgColor:C.greenD, icon:Package },
    { label:'En Proceso', value:fmtN(resumen.en_proceso), color:C.amber, bgColor:C.amberD, icon:RefreshCw },
    { label:'Ingresos', value:fmt$(resumen.ingresos), color:C.green, bgColor:C.greenD, icon:DollarSign },
    { label:'Prom. Días', value:String(resumen.promedio_dias), color:C.cyan, bgColor:'rgba(6,182,212,.15)', icon:Calendar },
  ] : []

  const columns = [
    { key:'numero', label:'N° Orden', render:v => <code style={{color:C.purple, fontWeight:700, fontSize:12}}>{v||'—'}</code> },
    { key:'fecha', label:'Fecha', render:v => <span style={{color:C.muted, fontSize:12}}>{fmtDate(v)}</span> },
    { key:'cliente', label:'Cliente', render:v => <strong>{v||'—'}</strong> },
    { key:'equipo_tipo', label:'Equipo' },
    { key:'equipo_marca', label:'Marca Eq.' },
    { key:'tecnico', label:'Técnico', render:v => <span style={{color:C.cyan}}>{v||'—'}</span> },
    { key:'estado', label:'Estado', render:v => {
      const cfg = v === 'ENTREGADO' ? {bg:C.greenD, c:C.green}
        : v === 'CANCELADO' ? {bg:C.redD, c:C.red}
        : {bg:C.amberD, c:C.amber}
      return <span style={{padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
        background:cfg.bg, color:cfg.c}}>{v||'—'}</span>
    }},
    { key:'costo_final', label:'Costo Final', align:'right', render:v => <strong style={{color:C.green}}>{fmt$(v)}</strong> },
    { key:'dias', label:'Días', align:'right', render:v => <span style={{fontWeight:700}}>{Number(v||0)}</span> },
  ]

  return { defaultFiltros, fetchData, renderFiltros, kpis, columns }
}

// ── Tab NOMINA ──────────────────────────────────────────────
function useTabNomina() {
  const defaultFiltros = { periodo: mesActual() }

  const fetchData = async (filtros) => {
    const { data } = await api.get('/reportes/nomina', {
      params: { periodo: filtros.periodo }
    })
    return data
  }

  const renderFiltros = (filtros, setFiltro) => (
    <>
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <Calendar size={14} color={C.hint} />
        <input type="month" value={filtros.periodo}
          onChange={e => setFiltro('periodo', e.target.value)}
          style={{...FI, width:180}} />
      </div>
    </>
  )

  const kpis = (resumen) => resumen ? [
    { label:'Empleados', value:fmtN(resumen.empleados), color:C.blue, bgColor:C.blueD, icon:Users },
    { label:'Total Ingresos', value:fmt$(resumen.total_ingresos), color:C.green, bgColor:C.greenD, icon:DollarSign },
    { label:'IESS Patronal', value:fmt$(resumen.total_iess_patronal), color:C.amber, bgColor:C.amberD, icon:DollarSign },
    { label:'Neto a Pagar', value:fmt$(resumen.total_neto), color:C.cyan, bgColor:'rgba(6,182,212,.15)', icon:DollarSign },
    { label:'Provisiones', value:fmt$(resumen.total_provisiones), color:C.purple, bgColor:C.purpleD, icon:DollarSign },
    { label:'Costo Total Empresa', value:fmt$(resumen.costo_total_empresa), color:C.red, bgColor:C.redD, icon:DollarSign },
  ] : []

  const columns = [
    { key:'empleado', label:'Empleado', render:v => <strong>{v||'—'}</strong> },
    { key:'cedula', label:'Cédula', render:v => <span style={{fontFamily:'monospace', fontSize:12, color:C.muted}}>{v||'—'}</span> },
    { key:'cargo', label:'Cargo', render:v => <span style={{color:C.muted}}>{v||'—'}</span> },
    { key:'salario_base', label:'Salario Base', align:'right', render:v => <span>{fmt$(v)}</span> },
    { key:'total_ingresos', label:'Ingresos', align:'right', render:v => <span style={{color:C.green}}>{fmt$(v)}</span> },
    { key:'total_descuentos', label:'Descuentos', align:'right', render:v => <span style={{color:C.red}}>{fmt$(v)}</span> },
    { key:'neto_a_pagar', label:'Neto', align:'right', render:v => <strong style={{color:C.cyan}}>{fmt$(v)}</strong> },
    { key:'aporte_iess_patronal', label:'IESS Patr.', align:'right', render:v => <span style={{color:C.amber}}>{fmt$(v)}</span> },
  ]

  return { defaultFiltros, fetchData, renderFiltros, kpis, columns, noDates:true }
}

// ── Tab DEVOLUCIONES ────────────────────────────────────────
function useTabDevoluciones() {
  const defaultFiltros = { fecha_ini:primerDiaMes(), fecha_fin:hoy() }

  const fetchData = async (filtros) => {
    const { data } = await api.get('/reportes/devoluciones', {
      params: { fecha_ini: filtros.fecha_ini, fecha_fin: filtros.fecha_fin }
    })
    return data
  }

  const renderFiltros = (filtros, setFiltro) => (
    <>
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <Calendar size={14} color={C.hint} />
        <input type="date" value={filtros.fecha_ini}
          onChange={e => setFiltro('fecha_ini', e.target.value)} style={{...FI, width:150}} />
        <span style={{color:C.hint, fontSize:12}}>a</span>
        <input type="date" value={filtros.fecha_fin}
          onChange={e => setFiltro('fecha_fin', e.target.value)} style={{...FI, width:150}} />
      </div>
    </>
  )

  const kpis = (resumen) => resumen ? [
    { label:'Devoluciones', value:fmtN(resumen.total_devoluciones), color:C.red, bgColor:C.redD, icon:FileText },
    { label:'Monto Total', value:fmt$(resumen.monto_total), color:C.amber, bgColor:C.amberD, icon:DollarSign },
  ] : []

  const columns = [
    { key:'numero', label:'N° NC', render:v => <code style={{color:C.purple, fontWeight:700, fontSize:12}}>{v||'—'}</code> },
    { key:'fecha', label:'Fecha', render:v => <span style={{color:C.muted, fontSize:12}}>{fmtDate(v)}</span> },
    { key:'cliente', label:'Cliente', render:v => <strong>{v||'—'}</strong> },
    { key:'ruc', label:'RUC', render:v => <span style={{fontFamily:'monospace', fontSize:12, color:C.muted}}>{v||'—'}</span> },
    { key:'factura_ref', label:'Factura Ref.', render:v => <code style={{color:C.cyan, fontSize:12}}>{v||'—'}</code> },
    { key:'motivo', label:'Motivo', render:v => <span style={{color:C.muted, fontSize:12}}>{v||'—'}</span> },
    { key:'total', label:'Total', align:'right', render:v => <strong style={{color:C.red}}>{fmt$(v)}</strong> },
    { key:'estado', label:'Estado', render:v => {
      return <span style={{padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
        background:C.greenD, color:C.green}}>{v||'—'}</span>
    }},
  ]

  return { defaultFiltros, fetchData, renderFiltros, kpis, columns }
}

// ── Tab DASHBOARD EJECUTIVO ─────────────────────────────────
function useTabEjecutivo() {
  const defaultFiltros = { fecha_ini:primerDiaMes(), fecha_fin:hoy() }

  const fetchData = async (filtros) => {
    const { data } = await api.get('/reportes/dashboard-ejecutivo', {
      params: { fecha_ini: filtros.fecha_ini, fecha_fin: filtros.fecha_fin }
    })
    return data
  }

  const renderFiltros = (filtros, setFiltro) => (
    <>
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <Calendar size={14} color={C.hint} />
        <input type="date" value={filtros.fecha_ini}
          onChange={e => setFiltro('fecha_ini', e.target.value)} style={{...FI, width:150}} />
        <span style={{color:C.hint, fontSize:12}}>a</span>
        <input type="date" value={filtros.fecha_fin}
          onChange={e => setFiltro('fecha_fin', e.target.value)} style={{...FI, width:150}} />
      </div>
    </>
  )

  const kpis = (_resumen, rawData) => rawData ? [
    { label:'Ventas', value:fmt$(rawData.ventas?.total), color:C.green, bgColor:C.greenD, icon:DollarSign },
    { label:'Facturas', value:fmtN(rawData.ventas?.facturas), color:C.blue, bgColor:C.blueD, icon:FileText },
    { label:'Compras', value:fmt$(rawData.compras?.total), color:C.red, bgColor:C.redD, icon:ShoppingCart },
    { label:'Utilidad Bruta', value:fmt$(rawData.utilidad_bruta), color:C.amber, bgColor:C.amberD, icon:TrendingUp },
    { label:'Nómina', value:fmt$(rawData.costo_nomina), color:C.purple, bgColor:C.purpleD, icon:Users },
    { label:'Utilidad Neta', value:fmt$(rawData.utilidad_neta),
      color: rawData.utilidad_neta >= 0 ? C.green : C.red,
      bgColor: rawData.utilidad_neta >= 0 ? C.greenD : C.redD, icon:TrendingUp },
    { label:'CXC Pendiente', value:fmt$(rawData.cxc_pendiente), color:C.cyan, bgColor:'rgba(6,182,212,.15)', icon:Wallet },
    { label:'CXP Pendiente', value:fmt$(rawData.cxp_pendiente), color:'#F97316', bgColor:'rgba(249,115,22,.15)', icon:Wallet },
    { label:'Valor Inventario', value:fmt$(rawData.valor_inventario), color:C.blue, bgColor:C.blueD, icon:Package },
    { label:'Margen Bruto', value:fmtPct(rawData.margen_bruto_pct), color:C.green, bgColor:C.greenD, icon:TrendingUp },
  ] : []

  const columns = []

  return { defaultFiltros, fetchData, renderFiltros, kpis, columns, isEjecutivo:true }
}


// ── Tab SUGERIR COMPRA ──────────────────────────────────────
function useTabSugerirCompra() {
  const defaultFiltros = {}

  const fetchData = async () => {
    const { data } = await api.get('/inventario/sugerir-compra')
    return {
      titulo: data.titulo,
      resumen: { total_productos: data.total_productos, inversion_total: data.inversion_total },
      detalle: data.productos,
    }
  }

  const renderFiltros = () => (
    <span style={{fontSize:12, color:C.hint}}>Productos que necesitan reabastecimiento</span>
  )

  const kpis = (resumen) => resumen ? [
    { label:'Productos Sugeridos', value:fmtN(resumen.total_productos), color:C.amber, bgColor:C.amberD, icon:ShoppingCart },
    { label:'Inversion Total', value:fmt$(resumen.inversion_total), color:C.blue, bgColor:C.blueD, icon:DollarSign },
  ] : []

  const columns = [
    { key:'codigo', label:'Codigo', render:v => <code style={{color:C.purple, fontWeight:700, fontSize:12}}>{v||'--'}</code> },
    { key:'descripcion', label:'Producto', render:v => <strong>{v||'--'}</strong> },
    { key:'marca', label:'Marca', render:v => <span style={{color:C.muted}}>{v||'--'}</span> },
    { key:'stock_actual', label:'Stock Actual', align:'right', render:v => {
      const n = Number(v||0)
      const color = n <= 0 ? C.red : n <= 5 ? C.amber : C.green
      return <span style={{fontWeight:700, color}}>{fmtN(v)}</span>
    }},
    { key:'stock_minimo', label:'Minimo', align:'right', render:v => <span style={{color:C.muted}}>{fmtN(v)}</span> },
    { key:'ventas_30d', label:'Ventas 30d', align:'right', render:v => <span style={{fontWeight:600, color:C.cyan}}>{fmtN(v)}</span> },
    { key:'cantidad_sugerida', label:'Cant. Sugerida', align:'right', render:v => <strong style={{color:C.blue}}>{fmtN(v)}</strong> },
    { key:'inversion_estimada', label:'Inversion', align:'right', render:v => <span style={{color:C.amber}}>{fmt$(v)}</span> },
    { key:'urgencia', label:'Urgencia', render:v => {
      const cfg = v === 'CRITICO' ? {bg:C.redD, c:C.red}
        : v === 'BAJO' ? {bg:C.amberD, c:C.amber}
        : {bg:C.blueD, c:C.blue}
      return <span style={{padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
        background:cfg.bg, color:cfg.c}}>{v||'--'}</span>
    }},
  ]

  return { defaultFiltros, fetchData, renderFiltros, kpis, columns, noDates:true }
}

// ── Tab ABC PARETO (Productos) ─────────────────────────────
function useTabAbcPareto() {
  const defaultFiltros = { fecha_ini:primerDiaMes(), fecha_fin:hoy() }

  const fetchData = async (filtros) => {
    const { data } = await api.get('/inventario/abc', {
      params: { fecha_ini: filtros.fecha_ini, fecha_fin: filtros.fecha_fin }
    })
    return data
  }

  const renderFiltros = (filtros, setFiltro) => (
    <>
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <Calendar size={14} color={C.hint} />
        <input type="date" value={filtros.fecha_ini}
          onChange={e => setFiltro('fecha_ini', e.target.value)} style={{...FI, width:150}} />
        <span style={{color:C.hint, fontSize:12}}>a</span>
        <input type="date" value={filtros.fecha_fin}
          onChange={e => setFiltro('fecha_fin', e.target.value)} style={{...FI, width:150}} />
      </div>
    </>
  )

  const kpis = (resumen) => resumen ? [
    { label:'Total Productos', value:fmtN(resumen.total_productos), color:C.blue, bgColor:C.blueD, icon:Package },
    { label:'Total Ventas', value:fmt$(resumen.total_ventas), color:C.green, bgColor:C.greenD, icon:DollarSign },
    { label:'Clase A (80%)', value:fmtN(resumen.clase_A), color:C.green, bgColor:C.greenD, icon:TrendingUp },
    { label:'Clase B (15%)', value:fmtN(resumen.clase_B), color:C.amber, bgColor:C.amberD, icon:TrendingUp },
    { label:'Clase C (5%)', value:fmtN(resumen.clase_C), color:C.red, bgColor:C.redD, icon:TrendingUp },
  ] : []

  const columns = [
    { key:'codigo', label:'Codigo', render:v => <code style={{color:C.purple, fontWeight:700, fontSize:12}}>{v||'--'}</code> },
    { key:'descripcion', label:'Producto', render:v => <strong>{v||'--'}</strong> },
    { key:'marca', label:'Marca', render:v => <span style={{color:C.muted}}>{v||'--'}</span> },
    { key:'unidades', label:'Unidades', align:'right', render:v => <span style={{fontWeight:600}}>{fmtN(v)}</span> },
    { key:'total_ventas', label:'Ventas', align:'right', render:v => <strong style={{color:C.green}}>{fmt$(v)}</strong> },
    { key:'pct_acumulado', label:'% Acum.', align:'right', render:v => <span style={{fontWeight:700}}>{fmtPct(v)}</span> },
    { key:'clasificacion', label:'Clase', render:v => {
      const cfg = v === 'A' ? {bg:C.greenD, c:C.green}
        : v === 'B' ? {bg:C.amberD, c:C.amber}
        : {bg:C.redD, c:C.red}
      return <span style={{padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
        background:cfg.bg, color:cfg.c}}>{v||'--'}</span>
    }},
  ]

  return { defaultFiltros, fetchData, renderFiltros, kpis, columns }
}

// ── Tab ROTACION DE INVENTARIO ─────────────────────────────
function useTabRotacion() {
  const defaultFiltros = { fecha_ini:primerDiaMes(), fecha_fin:hoy() }

  const fetchData = async (filtros) => {
    const { data } = await api.get('/inventario/rotacion', {
      params: { fecha_ini: filtros.fecha_ini, fecha_fin: filtros.fecha_fin }
    })
    return {
      titulo: 'Rotacion de Inventario',
      resumen: { total_productos: data.length },
      detalle: data,
    }
  }

  const renderFiltros = (filtros, setFiltro) => (
    <>
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <Calendar size={14} color={C.hint} />
        <input type="date" value={filtros.fecha_ini}
          onChange={e => setFiltro('fecha_ini', e.target.value)} style={{...FI, width:150}} />
        <span style={{color:C.hint, fontSize:12}}>a</span>
        <input type="date" value={filtros.fecha_fin}
          onChange={e => setFiltro('fecha_fin', e.target.value)} style={{...FI, width:150}} />
      </div>
    </>
  )

  const kpis = (resumen) => resumen ? [
    { label:'Productos', value:fmtN(resumen.total_productos), color:C.blue, bgColor:C.blueD, icon:Package },
  ] : []

  const columns = [
    { key:'codigo', label:'Codigo', render:v => <code style={{color:C.purple, fontWeight:700, fontSize:12}}>{v||'--'}</code> },
    { key:'descripcion', label:'Producto', render:v => <strong>{v||'--'}</strong> },
    { key:'stock_actual', label:'Stock', align:'right', render:v => <span style={{fontWeight:600}}>{fmtN(v)}</span> },
    { key:'vendidos', label:'Vendidos', align:'right', render:v => <span style={{fontWeight:600, color:C.cyan}}>{fmtN(v)}</span> },
    { key:'indice_rotacion', label:'Indice Rotacion', align:'right', render:v => {
      const n = Number(v||0)
      const color = n >= 3 ? C.green : n >= 1 ? C.amber : C.red
      return <strong style={{color}}>{Number(v||0).toFixed(2)}</strong>
    }},
  ]

  return { defaultFiltros, fetchData, renderFiltros, kpis, columns }
}

// ── Tab FLUJO DE CAJA ──────────────────────────────────────
function useTabFlujoCaja() {
  const defaultFiltros = {}

  const fetchData = async () => {
    const { data } = await api.get('/reportes/flujo-caja', { params: { meses: 3 } })
    return {
      titulo: data.titulo,
      resumen: {
        total_ingresos: data.total_ingresos,
        total_egresos: data.total_egresos,
        flujo_neto_total: data.flujo_neto_total,
      },
      detalle: data.meses,
    }
  }

  const renderFiltros = () => (
    <span style={{fontSize:12, color:C.hint}}>Proyeccion de flujo de caja (3 meses)</span>
  )

  const kpis = (resumen) => resumen ? [
    { label:'Total Ingresos', value:fmt$(resumen.total_ingresos), color:C.green, bgColor:C.greenD, icon:DollarSign },
    { label:'Total Egresos', value:fmt$(resumen.total_egresos), color:C.red, bgColor:C.redD, icon:DollarSign },
    { label:'Flujo Neto', value:fmt$(resumen.flujo_neto_total),
      color: resumen.flujo_neto_total >= 0 ? C.green : C.red,
      bgColor: resumen.flujo_neto_total >= 0 ? C.greenD : C.redD, icon:TrendingUp },
  ] : []

  const columns = [
    { key:'mes', label:'Mes', render:v => <strong style={{color:C.blue}}>{v||'--'}</strong> },
    { key:'ingresos_esperados', label:'Ingresos', align:'right', render:v => <span style={{color:C.green, fontWeight:600}}>{fmt$(v)}</span> },
    { key:'cxc_por_cobrar', label:'CXC', align:'right', render:v => <span style={{color:C.cyan}}>{fmt$(v)}</span> },
    { key:'egresos_esperados', label:'Egresos', align:'right', render:v => <span style={{color:C.red, fontWeight:600}}>{fmt$(v)}</span> },
    { key:'cxp_por_pagar', label:'CXP', align:'right', render:v => <span style={{color:'#F97316'}}>{fmt$(v)}</span> },
    { key:'nomina_estimada', label:'Nomina', align:'right', render:v => <span style={{color:C.purple}}>{fmt$(v)}</span> },
    { key:'flujo_neto', label:'Flujo Neto', align:'right', render:v => {
      const n = Number(v||0)
      const color = n >= 0 ? C.green : C.red
      return <strong style={{color}}>{fmt$(v)}</strong>
    }},
  ]

  return { defaultFiltros, fetchData, renderFiltros, kpis, columns, noDates:true }
}


// ════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════
export default function Reportes() {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [activeTab, setActiveTab] = useState('ventas')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState('')

  // Filtros por tab - se guardan independientemente
  const [filtrosMap, setFiltrosMap] = useState({})

  // Hooks de cada tab
  const tabVentas     = useTabVentas()
  const tabProductos  = useTabProductos()
  const tabInventario = useTabInventario()
  const tabCxc        = useTabCxcAging()
  const tabCompras    = useTabCompras()
  const tabComisiones = useTabComisiones()
  const tabCaja       = useTabCaja()
  const tabAts        = useTabAts()
  const tabForm104    = useTabForm104()
  const tabForm103    = useTabForm103()
  const tabRentabilidad = useTabRentabilidad()
  const tabPareto       = useTabPareto()
  const tabStockMuerto  = useTabStockMuerto()
  const tabCxpAging     = useTabCxpAging()
  const tabComparativo  = useTabComparativo()
  const tabServTecnico  = useTabServTecnico()
  const tabNomina       = useTabNomina()
  const tabDevoluciones = useTabDevoluciones()
  const tabEjecutivo    = useTabEjecutivo()
  const tabSugerirCompra = useTabSugerirCompra()
  const tabAbcPareto     = useTabAbcPareto()
  const tabRotacion      = useTabRotacion()
  const tabFlujoCaja     = useTabFlujoCaja()

  const tabConfigs = {
    ventas: tabVentas,
    productos: tabProductos,
    inventario: tabInventario,
    cxc: tabCxc,
    compras: tabCompras,
    comisiones: tabComisiones,
    caja: tabCaja,
    ats: tabAts,
    form104: tabForm104,
    form103: tabForm103,
    rentabilidad: tabRentabilidad,
    pareto: tabPareto,
    stockMuerto: tabStockMuerto,
    cxpAging: tabCxpAging,
    comparativo: tabComparativo,
    servTecnico: tabServTecnico,
    nominaRep: tabNomina,
    devolucionesRep: tabDevoluciones,
    ejecutivo: tabEjecutivo,
    sugerirCompra: tabSugerirCompra,
    abc: tabAbcPareto,
    rotacion: tabRotacion,
    flujoCaja: tabFlujoCaja,
  }

  const config = tabConfigs[activeTab]

  // Filtros activos del tab actual
  const filtros = filtrosMap[activeTab] || config.defaultFiltros

  const setFiltro = useCallback((key, value) => {
    setFiltrosMap(prev => ({
      ...prev,
      [activeTab]: { ...(prev[activeTab] || config.defaultFiltros), [key]:value }
    }))
  }, [activeTab, config.defaultFiltros])

  // Cargar datos
  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await config.fetchData(filtros)
      setData(result)
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || 'Error al cargar reporte'
      setError(msg)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [config, filtros])

  // Cargar al cambiar tab o filtros relevantes
  useEffect(() => {
    cargar()
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // Obtener columnas (pueden ser dinamicas para productos)
  const columns = config.dynamicColumns
    ? config.getColumns(filtros.agrupar)
    : config.columns

  // Calcular totales para exportacion
  const calculateTotals = (detalle, cols) => {
    if (!detalle || detalle.length === 0) return {}
    const totals = {}
    cols.forEach(col => {
      if (col.align === 'right' && col.key !== 'codigo' && col.key !== 'ruc') {
        const sum = detalle.reduce((acc, row) => acc + Number(row[col.key] || 0), 0)
        if (!isNaN(sum) && sum !== 0) totals[col.key] = sum
      }
    })
    return totals
  }

  // Exportar a Excel o PDF
  const handleExport = async (format) => {
    if (!data?.detalle || data.detalle.length === 0) {
      setError('Primero consulte datos antes de exportar')
      return
    }
    setExporting(format)
    try {
      const sanitize = (obj) => {
        if (obj === null || obj === undefined) return obj
        if (typeof obj === 'object' && !Array.isArray(obj)) {
          const clean = {}
          for (const [k, v] of Object.entries(obj)) {
            clean[k] = typeof v === 'object' && v !== null && !Array.isArray(v) ? String(v) : v
          }
          return clean
        }
        return obj
      }
      const exportBody = {
        titulo: data.titulo || `Reporte ${TABS.find(t=>t.id===activeTab)?.label || ''}`,
        fecha_ini: filtros.fecha_ini || null,
        fecha_fin: filtros.fecha_fin || null,
        resumen: data.resumen,
        columnas: columns.map(c => ({ key:c.key, label:c.label, width:c.width||15 })),
        filas: data.detalle.map(sanitize),
        totales: calculateTotals(data.detalle, columns),
      }
      const endpoint = format === 'excel'
        ? '/reportes/exportar/excel'
        : '/reportes/exportar/pdf'

      const response = await api.post(endpoint, exportBody, { responseType:'blob' })

      const ext = format === 'excel' ? 'xlsx' : 'pdf'
      const contentDisposition = response.headers['content-disposition']
      let filename = `reporte_${activeTab}.${ext}`
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (match && match[1]) filename = match[1].replace(/['"]/g, '')
      }

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (e) {
      let errMsg = e.message
      if (e.response?.data instanceof Blob) {
        try { errMsg = await e.response.data.text() } catch {}
      } else if (e.response?.data?.detail) {
        errMsg = e.response.data.detail
      }
      setError(`Error al exportar ${format.toUpperCase()}: ${errMsg}`)
    } finally {
      setExporting('')
    }
  }

  const kpiCards = config.isEjecutivo ? config.kpis(data?.resumen, data) : config.kpis(data?.resumen)

  return (
    <div style={{background:C.bg, minHeight:'100vh', padding:'24px 28px',
      fontFamily:"'Inter','Segoe UI',system-ui,sans-serif", color:C.text}}>

      {/* Header */}
      <div style={{display:'flex', justifyContent:'space-between',
        alignItems:'flex-start', marginBottom:24}}>
        <div>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            <BarChart3 size={28} color={C.blue} />
            <h1 style={{margin:0, fontSize:24, fontWeight:800}}>Reportes</h1>
          </div>
          <p style={{margin:'4px 0 0', color:C.muted, fontSize:13}}>
            Consulta y exporta informaci&oacute;n del negocio
          </p>
        </div>
        {/* Exportar */}
        <div style={{display:'flex', gap:8}}>
          <ExportButton icon={FileSpreadsheet} label="Excel" color={C.green}
            onClick={() => handleExport('excel')}
            loading={exporting === 'excel'} />
          <ExportButton icon={FileText} label="PDF" color={C.red}
            onClick={() => handleExport('pdf')}
            loading={exporting === 'pdf'} />
        </div>
      </div>

      {/* Tab bar */}
      <div style={{display:'flex', gap:2, marginBottom:20, background:C.surface,
        borderRadius:12, padding:4, border:`1px solid ${C.bord2}`, overflowX:'auto'}}>
        {TABS.map(tab => {
          const active = activeTab === tab.id
          const Icon = tab.icon
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{display:'flex', alignItems:'center', gap:6,
                padding:'10px 16px', borderRadius:8, border:'none',
                cursor:'pointer', fontSize:13, fontWeight:active ? 700 : 500,
                background: active ? C.blue : 'transparent',
                color: active ? 'white' : C.muted,
                transition:'all .15s', whiteSpace:'nowrap', flexShrink:0}}>
              <Icon size={15} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Filtros */}
      <div style={{background:C.surface, borderRadius:12, padding:'12px 16px',
        border:`1px solid ${C.bord2}`, marginBottom:16,
        display:'flex', gap:10, alignItems:'center', flexWrap:'wrap'}}>
        <Filter size={16} color={C.hint} />
        {config.renderFiltros(filtros, setFiltro)}
        <button onClick={cargar}
          style={{display:'flex', alignItems:'center', gap:6,
            padding:'8px 18px', borderRadius:9, border:'none',
            background:C.blue, color:'white', cursor:'pointer',
            fontSize:13, fontWeight:600, marginLeft:'auto',
            transition:'all .15s'}}>
          <Search size={14} />
          Consultar
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{marginBottom:16, padding:'10px 16px', borderRadius:9, fontSize:13,
          background:C.redD, color:'#FCA5A5',
          display:'flex', alignItems:'center', gap:8,
          border:'1px solid rgba(239,68,68,.3)'}}>
          <AlertCircle size={16} />
          {error}
          <button onClick={() => setError('')}
            style={{marginLeft:'auto', background:'none', border:'none',
              color:'#FCA5A5', cursor:'pointer', fontSize:16}}>x</button>
        </div>
      )}

      {/* KPIs */}
      {kpiCards.length > 0 && (
        <div style={{display:'flex', gap:12, marginBottom:20, flexWrap:'wrap'}}>
          {kpiCards.map((k, i) => (
            <KpiCard key={i} {...k} />
          ))}
        </div>
      )}

      {/* Tabla */}
      <div style={{background:C.surface, borderRadius:12,
        border:`1px solid ${C.bord2}`, overflow:'hidden'}}>
        {loading ? (
          <div style={{padding:48, textAlign:'center', color:C.hint,
            display:'flex', flexDirection:'column', alignItems:'center', gap:12}}>
            <Loader2 size={28} color={C.blue} style={{animation:'spin 1s linear infinite'}} />
            <span>Cargando reporte...</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : (
          <DataTable columns={columns}
            rows={data?.detalle}
            emptyMsg="No hay datos para el rango seleccionado" />
        )}
      </div>

      {/* ATS extra sections */}
      {activeTab === 'ats' && data && (
        <div style={{marginTop:16, display:'flex', gap:8, flexWrap:'wrap'}}>
          <button onClick={async () => {
            try {
              const mes = filtros.mes || mesActual()
              const response = await api.get('/reportes/ats/xml', {
                params: { mes }, responseType: 'blob',
                headers: { Accept: 'application/xml' }
              })
              const url = window.URL.createObjectURL(new Blob([response.data]))
              const link = document.createElement('a')
              link.href = url
              link.setAttribute('download', `ATS_${mes}.xml`)
              document.body.appendChild(link)
              link.click()
              link.parentNode.removeChild(link)
              window.URL.revokeObjectURL(url)
            } catch (e) {
              setError('Error al descargar XML: ' + (e.response?.data?.detail || e.message))
            }
          }}
            style={{display:'flex', alignItems:'center', gap:6, padding:'10px 18px',
              borderRadius:9, border:'none', cursor:'pointer',
              background:'#059669', color:'white', fontSize:13, fontWeight:700}}>
            <Download size={15} /> Descargar XML (SRI)
          </button>
          <ExportButton icon={FileSpreadsheet} label="Descargar Excel" color={C.green}
            onClick={() => handleExport('excel')}
            loading={exporting === 'excel'} />
        </div>
      )}

      {/* ATS Compras table */}
      {activeTab === 'ats' && data?.compras?.length > 0 && (
        <div style={{background:C.surface, borderRadius:12, border:`1px solid ${C.bord2}`,
          overflow:'hidden', marginTop:16}}>
          <div style={{padding:'12px 16px', borderBottom:`1px solid ${C.bord2}`,
            fontSize:13, fontWeight:700, color:C.blue}}>
            Compras del periodo ({data.compras.length})
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%', borderCollapse:'collapse'}}>
              <thead>
                <tr>
                  {['N. Documento','Fecha','Proveedor','RUC','Sub. 0%','Sub. IVA','IVA','Total'].map((h,i) => (
                    <th key={i} style={TH(i>=4?'right':'left')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.compras.map((c,i) => (
                  <tr key={i}
                    onMouseEnter={e=>e.currentTarget.style.background=C.sur2}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={TD()}><code style={{color:C.purple, fontWeight:700, fontSize:12}}>{c.num_documento||'--'}</code></td>
                    <td style={TD()}><span style={{color:C.muted, fontSize:12}}>{fmtDate(String(c.fecha).slice(0,10))}</span></td>
                    <td style={TD()}>{c.razon_social||'--'}</td>
                    <td style={TD()}><span style={{fontFamily:'monospace', fontSize:12, color:C.muted}}>{c.identificacion||'--'}</span></td>
                    <td style={TD('right')}><span style={{color:C.muted}}>{fmt$(c.subtotal_0)}</span></td>
                    <td style={TD('right')}><span style={{color:C.cyan}}>{fmt$(c.subtotal_iva)}</span></td>
                    <td style={TD('right')}><span style={{color:C.amber}}>{fmt$(c.iva)}</span></td>
                    <td style={TD('right')}><strong style={{color:C.green}}>{fmt$(c.total)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pie con conteo y totales */}
      {data?.detalle?.length > 0 && (
        <div style={{marginTop:12, display:'flex', gap:20, justifyContent:'space-between',
          alignItems:'center', padding:'12px 16px', background:C.surface,
          borderRadius:10, border:`1px solid ${C.bord2}`}}>
          <div style={{fontSize:12, color:C.hint}}>
            {data.detalle.length} registro{data.detalle.length !== 1 ? 's' : ''}
          </div>
          <div style={{display:'flex', gap:16}}>
            {columns.filter(c => c.align === 'right' && c.key !== 'codigo' && c.key !== 'ruc').slice(-2).map(col => {
              const sum = data.detalle.reduce((a, r) => a + Number(r[col.key]||0), 0)
              if (sum === 0) return null
              return (
                <div key={col.key} style={{fontSize:13, color:C.muted}}>
                  {col.label}: <strong style={{color:C.green}}>{fmt$(sum)}</strong>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
