// ============================================================
//  NEXUS POS — Kardex (Historial de Movimientos de Producto)
//  Archivo: frontend/src/pages/Kardex.jsx
// ============================================================
import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../api'
import {
  Search, Filter, Calendar, Package, ArrowUpCircle, ArrowDownCircle,
  FileSpreadsheet, FileText, Loader2, AlertCircle, ChevronDown, X,
  ClipboardList, TrendingUp, TrendingDown, Activity
} from 'lucide-react'
import { useTheme } from '../theme'

// -- Paleta oscura (misma que Reportes) -----------------------
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

const fmtN = v => Number(v||0).toLocaleString('es-EC',
  {minimumFractionDigits:2, maximumFractionDigits:2})
const fmtDate = v => v ? new Date(v+'T00:00:00').toLocaleDateString('es-EC') : '-'

const hoy = () => new Date().toISOString().slice(0,10)
const primerDiaMes = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0,10) }

// -- Estilos reutilizables ------------------------------------
const FI = {
  padding:'8px 11px', borderRadius:8, fontSize:13,
  border:`1px solid ${C.bord2}`, background:C.sur2,
  color:C.text, outline:'none', boxSizing:'border-box', width:'100%',
}
const FI_SELECT = { ...FI, cursor:'pointer', appearance:'auto' }

// -- Colores por tipo de movimiento ---------------------------
const TIPO_COLORS = {
  VENTA:          { bg: C.blueD,   text: C.blue,   label: 'Venta' },
  COMPRA:         { bg: C.greenD,  text: C.green,  label: 'Compra' },
  AJUSTE:         { bg: C.amberD,  text: C.amber,  label: 'Ajuste' },
  TRANSFERENCIA:  { bg: C.purpleD, text: C.purple, label: 'Transferencia' },
  DEVOLUCION:     { bg: C.redD,    text: C.red,    label: 'Devolucion' },
}

const TIPOS_FILTRO = [
  { value: 'ALL',            label: 'Todos' },
  { value: 'VENTA',          label: 'Venta' },
  { value: 'COMPRA',         label: 'Compra' },
  { value: 'AJUSTE',         label: 'Ajuste' },
  { value: 'TRANSFERENCIA',  label: 'Transferencia' },
  { value: 'DEVOLUCION',     label: 'Devolucion' },
]


// =============================================================
//  Buscador de Producto (autocompletado)
// =============================================================
function BuscadorProducto({ value, onChange }) {
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
    if (value) setTxt(value.descripcion || '')
    else setTxt('')
  }, [value])

  async function buscar(v) {
    setTxt(v)
    if (v.length < 2) { setRes([]); setOpen(false); return }
    try {
      const { data } = await api.get('/productos', { params: { busqueda: v, activo: 'true' } })
      setRes(data.slice(0, 10)); setOpen(true)
    } catch { /* ignore */ }
  }

  function pick(p) {
    onChange(p)
    setTxt(p.descripcion)
    setOpen(false); setRes([])
  }

  function limpiar() {
    onChange(null)
    setTxt(''); setRes([]); setOpen(false)
  }

  return (
    <div ref={ref} style={{ position:'relative', flex:1, maxWidth:500 }}>
      <div style={{ position:'relative' }}>
        <Search size={14} style={{ position:'absolute', left:10, top:'50%',
          transform:'translateY(-50%)', color:C.hint, pointerEvents:'none' }} />
        <input value={txt}
          onChange={e => buscar(e.target.value)}
          onFocus={() => txt.length >= 2 && setOpen(true)}
          placeholder="Buscar producto por nombre o codigo..."
          style={{ ...FI, paddingLeft:32, paddingRight: value ? 28 : 10,
            borderColor: value ? 'rgba(16,185,129,.5)' : C.bord2,
            background: value ? 'rgba(16,185,129,.08)' : C.sur2 }} />
        {value && (
          <button onClick={limpiar}
            style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)',
              background:'none', border:'none', cursor:'pointer', color:C.hint,
              fontSize:16, lineHeight:1, padding:2 }}>
            <X size={14} />
          </button>
        )}
      </div>
      {open && res.length > 0 && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0,
          zIndex:900, background:C.surface, borderRadius:10,
          border:`1px solid ${C.bord2}`, boxShadow:'0 12px 32px rgba(0,0,0,.6)',
          maxHeight:300, overflowY:'auto' }}>
          {res.map(p => (
            <div key={p.id} onClick={() => pick(p)}
              style={{ padding:'9px 12px', cursor:'pointer', borderBottom:`1px solid ${C.border}` }}
              onMouseEnter={e => e.currentTarget.style.background = C.sur2}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ fontWeight:600, fontSize:13, color:C.text }}>{p.descripcion}</div>
              <div style={{ fontSize:11, color:C.muted, display:'flex', gap:12 }}>
                <span>Cod: {p.codigo}</span>
                {p.marca_nombre && <span>Marca: {p.marca_nombre}</span>}
                <span>Stock: {Number(p.stock_total||0).toLocaleString('es-EC')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


// =============================================================
//  Badge de tipo de movimiento
// =============================================================
function TipoBadge({ tipo }) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const c = TIPO_COLORS[tipo] || { bg:C.sur3, text:C.muted, label:tipo }
  return (
    <span style={{ display:'inline-block', padding:'3px 10px', borderRadius:6,
      fontSize:11, fontWeight:700, background:c.bg, color:c.text, letterSpacing:'.02em' }}>
      {c.label}
    </span>
  )
}


// =============================================================
//  KPI Card
// =============================================================
function KpiCard({ icon:Icon, label, value, color }) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const bgD = `${color}15`
  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12,
      padding:'16px 18px', display:'flex', alignItems:'center', gap:14, flex:1, minWidth:180 }}>
      <div style={{ width:40, height:40, borderRadius:10, background:bgD,
        display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <div style={{ fontSize:11, color:C.muted, marginBottom:2 }}>{label}</div>
        <div style={{ fontSize:18, fontWeight:800, color:C.text }}>{value}</div>
      </div>
    </div>
  )
}


// =============================================================
//  Componente Principal: Kardex
// =============================================================
export default function Kardex() {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [producto, setProducto] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState('')

  // Filtros
  const [bodegaId, setBodegaId] = useState('')
  const [fechaIni, setFechaIni] = useState(primerDiaMes())
  const [fechaFin, setFechaFin] = useState(hoy())
  const [tipo, setTipo] = useState('ALL')

  // Bodegas para el dropdown
  const [bodegas, setBodegas] = useState([])
  useEffect(() => {
    api.get('/bodegas').then(r => setBodegas(r.data || [])).catch(() => {})
  }, [])

  // Cargar kardex cuando cambia producto o filtros
  const cargar = useCallback(async () => {
    if (!producto) return
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (bodegaId) params.bodega_id = bodegaId
      if (fechaIni) params.fecha_ini = fechaIni
      if (fechaFin) params.fecha_fin = fechaFin
      if (tipo && tipo !== 'ALL') params.tipo = tipo
      const { data: d } = await api.get(`/kardex/${producto.id}`, { params })
      setData(d)
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al cargar kardex')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [producto, bodegaId, fechaIni, fechaFin, tipo])

  useEffect(() => { cargar() }, [cargar])

  // Exportar
  const handleExport = async (format) => {
    if (!data?.movimientos || data.movimientos.length === 0) return
    setExporting(format)
    try {
      const columnas = [
        { key:'fecha',           label:'Fecha',    width:12 },
        { key:'tipo',            label:'Tipo',     width:14 },
        { key:'documento',       label:'Documento', width:16 },
        { key:'detalle',         label:'Detalle',  width:22 },
        { key:'bodega_nombre',   label:'Bodega',   width:14 },
        { key:'entrada',         label:'Entrada',  width:10 },
        { key:'salida',          label:'Salida',   width:10 },
        { key:'saldo_acumulado', label:'Saldo',    width:10 },
      ]
      const exportBody = {
        titulo: `Kardex - ${data.producto?.descripcion || ''}`,
        fecha_ini: fechaIni || null,
        fecha_fin: fechaFin || null,
        resumen: data.resumen,
        columnas,
        filas: data.movimientos,
        totales: {
          entrada: data.resumen.total_entradas,
          salida:  data.resumen.total_salidas,
        },
      }
      const endpoint = format === 'excel'
        ? '/reportes/exportar/excel'
        : '/reportes/exportar/pdf'
      const response = await api.post(endpoint, exportBody, { responseType:'blob' })
      const ext = format === 'excel' ? 'xlsx' : 'pdf'
      let filename = `kardex_${data.producto?.codigo || 'producto'}.${ext}`
      const cd = response.headers['content-disposition']
      if (cd) {
        const match = cd.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
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
      setError(`Error al exportar: ${e.response?.data?.detail || e.message}`)
    } finally {
      setExporting('')
    }
  }

  const movs = data?.movimientos || []
  const resumen = data?.resumen || {}
  const prod = data?.producto || producto || {}

  // ── Tabla header style ─────────────────────────────────────
  const TH = (align='left') => ({
    padding:'10px 12px', textAlign:align, fontSize:11, fontWeight:700,
    color:C.muted, textTransform:'uppercase', letterSpacing:'.04em',
    borderBottom:`1px solid ${C.bord2}`, whiteSpace:'nowrap',
    position:'sticky', top:0, background:C.surface, zIndex:2,
  })
  const TD = (align='left') => ({
    padding:'9px 12px', textAlign:align, fontSize:13, color:C.text,
    borderBottom:`1px solid ${C.border}`, whiteSpace:'nowrap',
  })

  return (
    <div style={{ background:C.bg, minHeight:'100vh', padding:'24px 28px',
      fontFamily:"'Inter','Segoe UI',system-ui,sans-serif", color:C.text }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, margin:0, display:'flex',
            alignItems:'center', gap:10 }}>
            <ClipboardList size={22} color={C.blue} />
            Kardex de Producto
          </h1>
          <p style={{ fontSize:13, color:C.muted, margin:'4px 0 0' }}>
            Historial completo de movimientos de inventario
          </p>
        </div>
        {/* Export buttons */}
        {data && movs.length > 0 && (
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => handleExport('excel')} disabled={exporting==='excel'}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px',
                borderRadius:8, border:`1px solid ${C.green}33`, cursor:exporting?'not-allowed':'pointer',
                background:`${C.green}15`, color:C.green, fontSize:12, fontWeight:700,
                opacity:exporting==='excel'?0.5:1, transition:'all .15s' }}>
              {exporting==='excel' ? <Loader2 size={14} className="spin" /> : <FileSpreadsheet size={14} />}
              Excel
            </button>
            <button onClick={() => handleExport('pdf')} disabled={exporting==='pdf'}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px',
                borderRadius:8, border:`1px solid ${C.red}33`, cursor:exporting?'not-allowed':'pointer',
                background:`${C.red}15`, color:C.red, fontSize:12, fontWeight:700,
                opacity:exporting==='pdf'?0.5:1, transition:'all .15s' }}>
              {exporting==='pdf' ? <Loader2 size={14} className="spin" /> : <FileText size={14} />}
              PDF
            </button>
          </div>
        )}
      </div>

      {/* ── Buscador de producto ─────────────────────────────── */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12,
        padding:'16px 20px', marginBottom:20 }}>
        <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:8,
          textTransform:'uppercase', letterSpacing:'.04em' }}>
          Seleccionar Producto
        </div>
        <BuscadorProducto value={producto} onChange={p => { setProducto(p); if(!p) setData(null) }} />
      </div>

      {/* ── Producto seleccionado: info + filtros ────────────── */}
      {producto && (
        <>
          {/* Info del producto */}
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12,
            padding:'16px 20px', marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
              <div style={{ width:44, height:44, borderRadius:10, background:C.blueD,
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Package size={20} color={C.blue} />
              </div>
              <div style={{ flex:1, minWidth:200 }}>
                <div style={{ fontSize:16, fontWeight:700, color:C.text }}>
                  {prod.descripcion || producto.descripcion}
                </div>
                <div style={{ fontSize:12, color:C.muted, display:'flex', gap:16, flexWrap:'wrap', marginTop:2 }}>
                  <span>Codigo: <b style={{color:C.text}}>{prod.codigo || producto.codigo}</b></span>
                  {(prod.marca || producto.marca_nombre) &&
                    <span>Marca: <b style={{color:C.text}}>{prod.marca || producto.marca_nombre}</b></span>}
                  {(prod.categoria || producto.categoria_nombre) &&
                    <span>Categoria: <b style={{color:C.text}}>{prod.categoria || producto.categoria_nombre}</b></span>}
                </div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:11, color:C.muted }}>Stock Actual</div>
                <div style={{ fontSize:22, fontWeight:800, color:C.blue }}>
                  {fmtN(prod.stock_actual ?? producto.stock_total ?? 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12,
            padding:'14px 20px', marginBottom:16, display:'flex', alignItems:'center',
            gap:12, flexWrap:'wrap' }}>
            <Filter size={14} color={C.hint} />
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <Calendar size={13} color={C.hint} />
              <input type="date" value={fechaIni} onChange={e => setFechaIni(e.target.value)}
                style={{ ...FI, width:140 }} />
              <span style={{ color:C.hint, fontSize:12 }}>a</span>
              <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)}
                style={{ ...FI, width:140 }} />
            </div>
            <select value={bodegaId} onChange={e => setBodegaId(e.target.value)}
              style={{ ...FI_SELECT, width:180 }}>
              <option value="">Todas las bodegas</option>
              {bodegas.map(b => (
                <option key={b.id} value={b.id}>{b.nombre}</option>
              ))}
            </select>
            <select value={tipo} onChange={e => setTipo(e.target.value)}
              style={{ ...FI_SELECT, width:160 }}>
              {TIPOS_FILTRO.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* KPI cards */}
          {data && (
            <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
              <KpiCard icon={Activity} label="Movimientos" color={C.blue}
                value={resumen.num_movimientos ?? 0} />
              <KpiCard icon={ArrowUpCircle} label="Total Entradas" color={C.green}
                value={fmtN(resumen.total_entradas)} />
              <KpiCard icon={ArrowDownCircle} label="Total Salidas" color={C.red}
                value={fmtN(resumen.total_salidas)} />
              <KpiCard icon={Package} label="Stock Actual" color={C.cyan}
                value={fmtN(resumen.stock_actual)} />
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ background:C.redD, border:`1px solid ${C.red}33`, borderRadius:10,
              padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
              <AlertCircle size={16} color={C.red} />
              <span style={{ fontSize:13, color:C.red }}>{error}</span>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ textAlign:'center', padding:40 }}>
              <Loader2 size={28} color={C.blue} className="spin"
                style={{ animation:'spin 1s linear infinite' }} />
              <div style={{ fontSize:13, color:C.muted, marginTop:8 }}>Cargando movimientos...</div>
            </div>
          )}

          {/* Tabla de movimientos */}
          {!loading && data && (
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12,
              overflow:'hidden' }}>
              {movs.length === 0 ? (
                <div style={{ padding:40, textAlign:'center', color:C.hint, fontSize:13 }}>
                  No se encontraron movimientos con los filtros seleccionados
                </div>
              ) : (
                <div style={{ overflowX:'auto', maxHeight:'60vh', overflowY:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr>
                        <th style={TH()}>Fecha</th>
                        <th style={TH()}>Tipo</th>
                        <th style={TH()}>Documento</th>
                        <th style={TH()}>Detalle</th>
                        <th style={TH()}>Bodega</th>
                        <th style={TH('right')}>Entrada</th>
                        <th style={TH('right')}>Salida</th>
                        <th style={TH('right')}>Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movs.map((m, i) => (
                        <tr key={i}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.03)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <td style={TD()}>{fmtDate(m.fecha)}</td>
                          <td style={TD()}><TipoBadge tipo={m.tipo} /></td>
                          <td style={TD()}>{m.documento || '-'}</td>
                          <td style={{ ...TD(), maxWidth:220, overflow:'hidden',
                            textOverflow:'ellipsis', whiteSpace:'nowrap' }}
                            title={m.detalle}>{m.detalle || '-'}</td>
                          <td style={TD()}>{m.bodega_nombre || '-'}</td>
                          <td style={{ ...TD('right'), color: m.entrada > 0 ? C.green : C.hint,
                            fontWeight: m.entrada > 0 ? 700 : 400 }}>
                            {m.entrada > 0 ? `+${fmtN(m.entrada)}` : '-'}
                          </td>
                          <td style={{ ...TD('right'), color: m.salida > 0 ? C.red : C.hint,
                            fontWeight: m.salida > 0 ? 700 : 400 }}>
                            {m.salida > 0 ? `-${fmtN(m.salida)}` : '-'}
                          </td>
                          <td style={{ ...TD('right'), fontWeight:700,
                            color: m.saldo_acumulado >= 0 ? C.text : C.red }}>
                            {fmtN(m.saldo_acumulado)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {/* Footer totals */}
                    <tfoot>
                      <tr style={{ background:C.sur2 }}>
                        <td colSpan={5} style={{ ...TD('right'), fontWeight:700, color:C.muted,
                          fontSize:12, textTransform:'uppercase', letterSpacing:'.04em' }}>
                          Totales ({movs.length} movimientos)
                        </td>
                        <td style={{ ...TD('right'), fontWeight:800, color:C.green, fontSize:14 }}>
                          +{fmtN(resumen.total_entradas)}
                        </td>
                        <td style={{ ...TD('right'), fontWeight:800, color:C.red, fontSize:14 }}>
                          -{fmtN(resumen.total_salidas)}
                        </td>
                        <td style={{ ...TD('right'), fontWeight:800, color:C.blue, fontSize:14 }}>
                          {fmtN(movs.length > 0 ? movs[movs.length-1].saldo_acumulado : 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Sin producto seleccionado */}
      {!producto && (
        <div style={{ textAlign:'center', padding:'80px 20px' }}>
          <Package size={48} color={C.hint} style={{ marginBottom:16, opacity:.5 }} />
          <div style={{ fontSize:16, fontWeight:600, color:C.muted, marginBottom:6 }}>
            Selecciona un producto
          </div>
          <div style={{ fontSize:13, color:C.hint }}>
            Busca por nombre o codigo para ver su historial de movimientos
          </div>
        </div>
      )}

      {/* Spin animation */}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
