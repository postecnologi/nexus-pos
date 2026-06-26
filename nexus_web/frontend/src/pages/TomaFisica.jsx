// ============================================================
//  NEXUS POS — Toma Fisica de Inventario (Physical Inventory Count)
// ============================================================
import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../api'
import { useTheme } from '../theme'

const C = {
  bg:'#0A0F1E', surface:'#111827', sur2:'#1F2937', sur3:'#374151',
  border:'#1F2937', bord2:'#374151',
  text:'#F9FAFB', muted:'#9CA3AF', hint:'#6B7280',
  blue:'#3B82F6', green:'#10B981', amber:'#F59E0B',
  red:'#EF4444', purple:'#8B5CF6', cyan:'#06B6D4',
  greenD:'rgba(16,185,129,.15)', amberD:'rgba(245,158,11,.15)',
  redD:'rgba(239,68,68,.15)', blueD:'rgba(59,130,246,.15)',
  purpleD:'rgba(139,92,246,.15)', cyanD:'rgba(6,182,212,.15)',
}

const FI = {
  padding:'8px 11px', borderRadius:8, fontSize:13,
  border:`1px solid ${C.bord2}`, background:C.sur2,
  color:C.text, outline:'none', boxSizing:'border-box', width:'100%',
}

const TH = (a='left') => ({
  padding:'11px 14px', fontSize:10, fontWeight:700,
  color:C.hint, textAlign:a, background:C.sur3,
  borderBottom:`1px solid ${C.bord2}`, textTransform:'uppercase',
  letterSpacing:'.05em', whiteSpace:'nowrap',
})

const TD = (a='left') => ({
  padding:'12px 14px', fontSize:13,
  borderBottom:`1px solid ${C.border}`, verticalAlign:'middle',
  color:C.text, textAlign:a,
})

// Estado badges
function EstadoBadge({ estado }) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const map = {
    EN_PROCESO: { bg: C.amberD, color: C.amber, label: 'En Proceso' },
    FINALIZADA: { bg: C.greenD, color: C.green, label: 'Finalizada' },
    ANULADA:    { bg: C.redD,   color: C.red,   label: 'Anulada' },
  }
  const s = map[estado] || map.EN_PROCESO
  return (
    <span style={{ padding:'3px 12px', borderRadius:20, fontSize:11,
      fontWeight:700, background:s.bg, color:s.color }}>
      {s.label}
    </span>
  )
}

// ── Export to Excel ──────────────────────────────────────────
function exportToExcel(toma, detalles) {
  const headers = ['Codigo', 'Producto', 'Stock Sistema', 'Stock Contado', 'Diferencia', 'Observaciones']
  const rows = detalles.map(d => [
    d.codigo || '',
    d.descripcion || '',
    Number(d.stock_sistema || 0),
    d.stock_contado != null ? Number(d.stock_contado) : '',
    d.stock_contado != null ? Number(d.diferencia || 0) : '',
    d.observaciones || '',
  ])
  const sep = '\t'
  const bom = '﻿'
  const csv = bom + headers.join(sep) + '\n' + rows.map(r => r.join(sep)).join('\n')
  const blob = new Blob([csv], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Toma_Fisica_${toma.numero || 'export'}.xls`
  a.click()
  URL.revokeObjectURL(url)
}


// ── Modal Nueva Toma ────────────────────────────────────────
function ModalNuevaToma({ bodegas, onCerrar, onCreada }) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [bodegaId, setBodegaId] = useState(bodegas[0]?.id || '')
  const [obs, setObs] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function crear() {
    if (!bodegaId) return setErr('Selecciona una bodega')
    setSaving(true); setErr('')
    try {
      const { data } = await api.post('/toma-fisica', {
        bodega_id: parseInt(bodegaId),
        observaciones: obs || null,
      })
      onCreada(data)
    } catch (e) {
      setErr(e.response?.data?.detail || e.message)
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:9000 }}>
      <div style={{ background:C.surface, borderRadius:16, padding:28,
        width:480, border:`1px solid ${C.bord2}`,
        boxShadow:'0 25px 60px rgba(0,0,0,.7)' }}>

        <div style={{ display:'flex', justifyContent:'space-between',
          alignItems:'center', marginBottom:20 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:C.cyan }}>
              Nueva Toma Fisica
            </div>
            <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>
              Se cargaran todos los productos con stock en la bodega seleccionada
            </div>
          </div>
          <button onClick={onCerrar} style={{ background:'none', border:'none',
            cursor:'pointer', color:C.hint, fontSize:22 }}>x</button>
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:11, fontWeight:700, color:C.muted,
            display:'block', marginBottom:6, textTransform:'uppercase' }}>
            Bodega *
          </label>
          <select value={bodegaId} onChange={e => setBodegaId(e.target.value)}
            style={{ ...FI, borderColor: bodegaId ? C.cyan : C.bord2 }}>
            <option value="">-- Selecciona bodega --</option>
            {bodegas.map(b => (
              <option key={b.id} value={b.id}>
                {b.nombre}{b.es_principal ? ' (Principal)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:11, fontWeight:700, color:C.muted,
            display:'block', marginBottom:6, textTransform:'uppercase' }}>
            Observaciones
          </label>
          <input value={obs} onChange={e => setObs(e.target.value)}
            placeholder="Notas opcionales..."
            style={FI} />
        </div>

        {err && (
          <div style={{ padding:'8px 12px', borderRadius:8, fontSize:12,
            background:C.redD, color:'#FCA5A5', marginBottom:12,
            border:'1px solid rgba(239,68,68,.3)' }}>
            {err}
          </div>
        )}

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onCerrar}
            style={{ padding:'10px 20px', borderRadius:9, cursor:'pointer',
              border:`1px solid ${C.bord2}`, background:'transparent',
              color:C.muted, fontSize:13 }}>
            Cancelar
          </button>
          <button onClick={crear} disabled={saving}
            style={{ padding:'10px 28px', borderRadius:9, border:'none',
              background: saving ? C.sur3 : C.cyan,
              color: saving ? C.hint : 'white',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize:14, fontWeight:800,
              boxShadow: saving ? 'none' : `0 4px 16px ${C.cyan}44` }}>
            {saving ? 'Creando...' : 'Crear Toma Fisica'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ── Resumen de Finalizacion ─────────────────────────────────
function ModalResumen({ resumen, onCerrar }) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:9000 }}>
      <div style={{ background:C.surface, borderRadius:16, padding:28,
        width:480, border:`1px solid ${C.bord2}`,
        boxShadow:'0 25px 60px rgba(0,0,0,.7)' }}>

        <div style={{ textAlign:'center', marginBottom:20 }}>
          <div style={{ fontSize:40, marginBottom:8 }}>OK</div>
          <div style={{ fontSize:18, fontWeight:800, color:C.green }}>
            Toma Fisica Finalizada
          </div>
        </div>

        <div style={{ background:C.sur2, borderRadius:10, padding:16,
          border:`1px solid ${C.bord2}`, marginBottom:16 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:24, fontWeight:800, color:C.blue }}>
                {resumen.total_productos}
              </div>
              <div style={{ fontSize:11, color:C.muted }}>Total productos</div>
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:24, fontWeight:800, color:C.green }}>
                {resumen.sin_diferencia}
              </div>
              <div style={{ fontSize:11, color:C.muted }}>Sin diferencia</div>
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:24, fontWeight:800, color:C.amber }}>
                {resumen.con_diferencia}
              </div>
              <div style={{ fontSize:11, color:C.muted }}>Con diferencia</div>
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:14, fontWeight:700, color:C.purple }}>
                {resumen.ajuste_numero || 'N/A'}
              </div>
              <div style={{ fontSize:11, color:C.muted }}>N Ajuste generado</div>
            </div>
          </div>
        </div>

        <div style={{ display:'flex', justifyContent:'center' }}>
          <button onClick={onCerrar}
            style={{ padding:'10px 32px', borderRadius:9, border:'none',
              background:C.green, color:'white', cursor:'pointer',
              fontSize:14, fontWeight:700 }}>
            Aceptar
          </button>
        </div>
      </div>
    </div>
  )
}


// ── Vista de Conteo (detail / counting view) ────────────────
function VistaConteo({ tomaId, onVolver }) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [toma, setToma] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [cambios, setCambios] = useState({})  // {producto_id: {stock_contado, observaciones}}
  const [saving, setSaving] = useState(false)
  const [finalizando, setFinalizando] = useState(false)
  const [resumen, setResumen] = useState(null)
  const [msg, setMsg] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/toma-fisica/${tomaId}`)
      setToma(data)
      // Inicializar cambios con valores existentes
      const init = {}
      for (const d of data.detalles) {
        init[d.producto_id] = {
          stock_contado: d.stock_contado != null ? String(d.stock_contado) : '',
          observaciones: d.observaciones || '',
        }
      }
      setCambios(init)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [tomaId])

  useEffect(() => { cargar() }, [cargar])

  if (loading) return (
    <div style={{ padding:40, textAlign:'center', color:C.hint }}>Cargando toma fisica...</div>
  )
  if (!toma) return (
    <div style={{ padding:40, textAlign:'center', color:C.red }}>Toma fisica no encontrada</div>
  )

  const detalles = toma.detalles || []
  const filtrados = busqueda
    ? detalles.filter(d =>
        (d.codigo || '').toLowerCase().includes(busqueda.toLowerCase()) ||
        (d.descripcion || '').toLowerCase().includes(busqueda.toLowerCase())
      )
    : detalles

  const contados = detalles.filter(d => {
    const c = cambios[d.producto_id]
    return c && c.stock_contado !== '' && c.stock_contado != null
  }).length
  const total = detalles.length
  const pct = total > 0 ? Math.round((contados / total) * 100) : 0
  const todosContados = contados === total && total > 0
  const esFinalizada = toma.estado === 'FINALIZADA'

  function setConteo(pid, campo, valor) {
    setCambios(prev => ({
      ...prev,
      [pid]: { ...prev[pid], [campo]: valor },
    }))
  }

  function getDiferencia(d) {
    const c = cambios[d.producto_id]
    if (!c || c.stock_contado === '' || c.stock_contado == null) return null
    return parseFloat(c.stock_contado) - parseFloat(d.stock_sistema)
  }

  async function guardarConteos() {
    setSaving(true); setMsg('')
    try {
      const conteos = []
      for (const d of detalles) {
        const c = cambios[d.producto_id]
        if (c && c.stock_contado !== '' && c.stock_contado != null) {
          conteos.push({
            producto_id: d.producto_id,
            stock_contado: parseFloat(c.stock_contado),
            observaciones: c.observaciones || null,
          })
        }
      }
      if (conteos.length === 0) {
        setMsg('No hay conteos para guardar')
        setSaving(false)
        return
      }
      await api.patch(`/toma-fisica/${tomaId}/contar-lote`, { conteos })
      setMsg(`${conteos.length} conteos guardados correctamente`)
      await cargar()
    } catch (e) {
      setMsg(e.response?.data?.detail || e.message)
    } finally { setSaving(false) }
  }

  async function finalizar() {
    if (!window.confirm('Finalizar la toma fisica? Se generara un ajuste automatico con las diferencias encontradas.')) return
    setFinalizando(true); setMsg('')
    try {
      // Primero guardar conteos pendientes
      const conteos = []
      for (const d of detalles) {
        const c = cambios[d.producto_id]
        if (c && c.stock_contado !== '' && c.stock_contado != null) {
          conteos.push({
            producto_id: d.producto_id,
            stock_contado: parseFloat(c.stock_contado),
            observaciones: c.observaciones || null,
          })
        }
      }
      if (conteos.length > 0) {
        await api.patch(`/toma-fisica/${tomaId}/contar-lote`, { conteos })
      }
      const { data } = await api.post(`/toma-fisica/${tomaId}/finalizar`)
      setResumen(data)
    } catch (e) {
      setMsg(e.response?.data?.detail || e.message)
    } finally { setFinalizando(false) }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between',
        alignItems:'flex-start', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={onVolver}
            style={{ padding:'8px 14px', borderRadius:8, border:`1px solid ${C.bord2}`,
              background:C.sur2, color:C.muted, cursor:'pointer', fontSize:13 }}>
            Volver
          </button>
          <div>
            <h2 style={{ margin:0, fontSize:20, fontWeight:800, color:C.text }}>
              Toma Fisica{' '}
              <code style={{ color:C.cyan }}>{toma.numero}</code>
            </h2>
            <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>
              {toma.bodega_nombre} ·{' '}
              {new Date(toma.fecha).toLocaleString('es-EC')} ·{' '}
              {toma.usuario_nombre}
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <EstadoBadge estado={toma.estado} />
          <button onClick={() => exportToExcel(toma, detalles)}
            style={{ padding:'8px 14px', borderRadius:8, border:`1px solid ${C.bord2}`,
              background:C.sur2, color:C.muted, cursor:'pointer', fontSize:12, fontWeight:600 }}>
            Exportar Excel
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ background:C.sur2, borderRadius:10, padding:'14px 18px',
        border:`1px solid ${C.bord2}`, marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between',
          alignItems:'center', marginBottom:8 }}>
          <span style={{ fontSize:13, fontWeight:700, color:C.text }}>
            Progreso de conteo
          </span>
          <span style={{ fontSize:13, fontWeight:700,
            color: pct === 100 ? C.green : C.amber }}>
            {contados} de {total} contados ({pct}%)
          </span>
        </div>
        <div style={{ width:'100%', height:8, background:C.sur3, borderRadius:4, overflow:'hidden' }}>
          <div style={{ width:`${pct}%`, height:'100%', borderRadius:4, transition:'width 0.3s',
            background: pct === 100
              ? 'linear-gradient(90deg,#10B981,#06B6D4)'
              : 'linear-gradient(90deg,#F59E0B,#EF4444)' }} />
        </div>
      </div>

      {/* Search + actions */}
      <div style={{ display:'flex', gap:10, marginBottom:14, alignItems:'center' }}>
        <div style={{ position:'relative', flex:1 }}>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar producto por codigo o descripcion..."
            style={{ ...FI, paddingLeft:12 }} />
        </div>
        {!esFinalizada && (
          <>
            <button onClick={guardarConteos} disabled={saving}
              style={{ padding:'10px 20px', borderRadius:9, border:'none',
                background: saving ? C.sur3 : C.blue,
                color: saving ? C.hint : 'white',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize:13, fontWeight:700, whiteSpace:'nowrap',
                boxShadow: saving ? 'none' : `0 4px 14px ${C.blue}44` }}>
              {saving ? 'Guardando...' : 'Guardar conteo'}
            </button>
            {todosContados && (
              <button onClick={finalizar} disabled={finalizando}
                style={{ padding:'10px 20px', borderRadius:9, border:'none',
                  background: finalizando ? C.sur3 : C.green,
                  color: finalizando ? C.hint : 'white',
                  cursor: finalizando ? 'not-allowed' : 'pointer',
                  fontSize:13, fontWeight:700, whiteSpace:'nowrap',
                  boxShadow: finalizando ? 'none' : `0 4px 14px ${C.green}44` }}>
                {finalizando ? 'Finalizando...' : 'Finalizar toma'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Message */}
      {msg && (
        <div style={{ padding:'8px 14px', borderRadius:8, marginBottom:12,
          background: C.blueD, color:C.blue, fontSize:12, fontWeight:600,
          border:`1px solid ${C.blue}33`,
          display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span>{msg}</span>
          <button onClick={() => setMsg('')} style={{ background:'none', border:'none',
            color:C.hint, cursor:'pointer', fontSize:16 }}>x</button>
        </div>
      )}

      {/* Counting table */}
      <div style={{ background:C.surface, borderRadius:12,
        border:`1px solid ${C.bord2}`, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>
              <th style={TH()}>Codigo</th>
              <th style={TH()}>Producto</th>
              <th style={TH('center')}>Stock Sistema</th>
              <th style={TH('center')}>Stock Contado</th>
              <th style={TH('center')}>Diferencia</th>
              <th style={TH()}>Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map(d => {
              const c = cambios[d.producto_id] || { stock_contado: '', observaciones: '' }
              const dif = getDiferencia(d)
              const difColor = dif === null ? C.hint
                : dif === 0 ? C.green
                : dif > 0 ? C.amber
                : C.red
              const difBg = dif === null ? 'transparent'
                : dif === 0 ? C.greenD
                : dif > 0 ? C.amberD
                : C.redD
              const difLabel = dif === null ? '--'
                : dif === 0 ? '0'
                : dif > 0 ? `+${dif.toFixed(2)}`
                : dif.toFixed(2)

              return (
                <tr key={d.producto_id}
                  onMouseEnter={e => e.currentTarget.style.background = C.sur2}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={TD()}>
                    <code style={{ color:C.purple, fontWeight:700, fontSize:12 }}>
                      {d.codigo}
                    </code>
                  </td>
                  <td style={{ ...TD(), fontWeight:600, fontSize:13 }}>
                    {d.descripcion}
                  </td>
                  <td style={{ ...TD('center'), fontWeight:700, color:C.muted }}>
                    {Number(d.stock_sistema).toFixed(2)}
                  </td>
                  <td style={{ ...TD('center'), padding:'8px 6px' }}>
                    {esFinalizada ? (
                      <span style={{ fontWeight:700, fontSize:14, color:C.text }}>
                        {d.stock_contado != null ? Number(d.stock_contado).toFixed(2) : '--'}
                      </span>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={c.stock_contado}
                        onChange={e => setConteo(d.producto_id, 'stock_contado', e.target.value)}
                        placeholder="--"
                        style={{ ...FI, width:100, textAlign:'center', fontWeight:700,
                          fontSize:14, padding:'6px 8px', margin:'0 auto',
                          borderColor: c.stock_contado !== '' ? C.cyan + '66' : C.bord2 }}
                      />
                    )}
                  </td>
                  <td style={{ ...TD('center') }}>
                    <span style={{ padding:'3px 10px', borderRadius:16, fontSize:12,
                      fontWeight:700, background:difBg, color:difColor }}>
                      {difLabel}
                    </span>
                  </td>
                  <td style={{ ...TD(), padding:'8px 6px' }}>
                    {esFinalizada ? (
                      <span style={{ fontSize:12, color:C.muted }}>
                        {d.observaciones || '--'}
                      </span>
                    ) : (
                      <input
                        value={c.observaciones}
                        onChange={e => setConteo(d.producto_id, 'observaciones', e.target.value)}
                        placeholder="--"
                        style={{ ...FI, fontSize:12, padding:'6px 8px' }}
                      />
                    )}
                  </td>
                </tr>
              )
            })}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding:'40px 0', textAlign:'center',
                  color:C.hint, fontSize:13 }}>
                  {busqueda ? 'No se encontraron productos con ese filtro' : 'No hay productos en esta toma'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Resumen modal */}
      {resumen && (
        <ModalResumen resumen={resumen} onCerrar={() => { setResumen(null); onVolver() }} />
      )}
    </div>
  )
}


// ════════════════════════════════════════════════════════════
//  PAGINA PRINCIPAL
// ════════════════════════════════════════════════════════════
export default function TomaFisica() {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [tomas, setTomas]       = useState([])
  const [bodegas, setBodegas]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [vistaId, setVistaId]   = useState(null)  // toma id to view
  const [filtroEstado, setFiltroEstado] = useState('')
  const [fechaIni, setFechaIni] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [ultimaCreada, setUltimaCreada] = useState(null)

  async function cargar() {
    setLoading(true)
    try {
      const params = {}
      if (filtroEstado) params.estado = filtroEstado
      if (fechaIni) params.fecha_ini = fechaIni
      if (fechaFin) params.fecha_fin = fechaFin
      const { data } = await api.get('/toma-fisica', { params })
      setTomas(data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => {
    cargar()
    api.get('/bodegas').then(r => setBodegas(r.data)).catch(() => {})
  }, [])

  useEffect(() => { cargar() }, [filtroEstado, fechaIni, fechaFin])

  async function eliminarToma(id) {
    if (!window.confirm('Eliminar esta toma fisica? Esta accion no se puede deshacer.')) return
    try {
      await api.delete(`/toma-fisica/${id}`)
      cargar()
    } catch (e) {
      alert(e.response?.data?.detail || e.message)
    }
  }

  // ── If viewing a specific toma ─────────────────────
  if (vistaId) {
    return (
      <div style={{ background:C.bg, minHeight:'100vh', padding:'24px 28px',
        fontFamily:"'Inter','Segoe UI',system-ui,sans-serif", color:C.text }}>
        <VistaConteo tomaId={vistaId} onVolver={() => { setVistaId(null); cargar() }} />
      </div>
    )
  }

  // ── List view ──────────────────────────────────────
  return (
    <div style={{ background:C.bg, minHeight:'100vh', padding:'24px 28px',
      fontFamily:"'Inter','Segoe UI',system-ui,sans-serif", color:C.text }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between',
        alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <h1 style={{ margin:0, fontSize:24, fontWeight:800 }}>
            Toma Fisica de Inventario
          </h1>
          <p style={{ margin:'4px 0 0', color:C.muted, fontSize:13 }}>
            Conteo fisico de productos en bodega
          </p>
        </div>
        <button onClick={() => setModal(true)}
          style={{ display:'flex', alignItems:'center', gap:7,
            padding:'10px 18px', borderRadius:10, border:'none',
            background:C.cyan, color:'white', cursor:'pointer',
            fontSize:13, fontWeight:700,
            boxShadow:'0 4px 14px rgba(6,182,212,.35)' }}>
          + Nueva toma
        </button>
      </div>

      {/* Alert last created */}
      {ultimaCreada && (
        <div style={{ marginBottom:16, padding:'12px 16px', borderRadius:10,
          background:C.greenD, border:'1px solid rgba(16,185,129,.3)',
          display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span>
            <span style={{ color:C.green, fontWeight:700 }}>Toma creada: </span>
            <code style={{ color:C.blue, fontWeight:700 }}>{ultimaCreada.numero}</code>
            <span style={{ color:C.muted, marginLeft:8 }}>
              ({ultimaCreada.total_productos} productos cargados)
            </span>
          </span>
          <button onClick={() => setUltimaCreada(null)}
            style={{ background:'none', border:'none', cursor:'pointer',
              color:C.hint, fontSize:18 }}>x</button>
        </div>
      )}

      {/* Filters */}
      <div style={{ background:C.surface, borderRadius:12, padding:'12px 16px',
        border:`1px solid ${C.bord2}`, marginBottom:14,
        display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
        {/* Estado filter */}
        <div style={{ display:'flex', borderRadius:9, overflow:'hidden',
          border:`1px solid ${C.bord2}` }}>
          {[['', 'Todos'], ['EN_PROCESO', 'En Proceso'], ['FINALIZADA', 'Finalizadas']].map(([v, l]) => (
            <button key={v} onClick={() => setFiltroEstado(v)}
              style={{ padding:'8px 14px', border:'none', cursor:'pointer',
                fontSize:12, fontWeight:600,
                background: filtroEstado === v
                  ? (v === 'EN_PROCESO' ? C.amber : v === 'FINALIZADA' ? C.green : C.blue)
                  : C.sur2,
                color: filtroEstado === v ? 'white' : C.muted }}>
              {l}
            </button>
          ))}
        </div>
        {/* Date filters */}
        <input type="date" value={fechaIni} onChange={e => setFechaIni(e.target.value)}
          style={{ ...FI, width:150, fontSize:12 }} />
        <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)}
          style={{ ...FI, width:150, fontSize:12 }} />
        {(fechaIni || fechaFin) && (
          <button onClick={() => { setFechaIni(''); setFechaFin('') }}
            style={{ padding:'8px 12px', borderRadius:8, border:'none',
              background:C.sur3, color:C.muted, cursor:'pointer', fontSize:11 }}>
            Limpiar fechas
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background:C.surface, borderRadius:12,
        border:`1px solid ${C.bord2}`, overflow:'hidden' }}>
        {loading ? (
          <div style={{ padding:40, textAlign:'center', color:C.hint }}>
            Cargando tomas fisicas...
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                {['Numero', 'Fecha', 'Bodega', 'Estado', 'Productos', 'Diferencias', 'Usuario', 'Acciones'].map((h, i) => (
                  <th key={i} style={TH(i >= 4 && i <= 5 ? 'center' : 'left')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tomas.map(t => (
                <tr key={t.id}
                  onMouseEnter={e => e.currentTarget.style.background = C.sur2}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={TD()}>
                    <code style={{ color:C.cyan, fontWeight:700, fontSize:12 }}>
                      {t.numero}
                    </code>
                  </td>
                  <td style={{ ...TD(), fontSize:12, color:C.muted }}>
                    {new Date(t.fecha).toLocaleDateString('es-EC',
                      { day:'2-digit', month:'2-digit', year:'numeric' })}
                  </td>
                  <td style={{ ...TD(), fontSize:12, color:C.muted }}>
                    {t.bodega_nombre || '--'}
                  </td>
                  <td style={TD()}>
                    <EstadoBadge estado={t.estado} />
                  </td>
                  <td style={{ ...TD('center') }}>
                    <span style={{ padding:'2px 8px', borderRadius:20, fontSize:12,
                      fontWeight:700, background:C.purpleD, color:C.purple }}>
                      {t.total_productos || 0}
                    </span>
                  </td>
                  <td style={{ ...TD('center') }}>
                    <span style={{ padding:'2px 8px', borderRadius:20, fontSize:12,
                      fontWeight:700,
                      background: (t.total_diferencias || 0) > 0 ? C.redD : C.greenD,
                      color: (t.total_diferencias || 0) > 0 ? C.red : C.green }}>
                      {t.total_diferencias || 0}
                    </span>
                  </td>
                  <td style={{ ...TD(), fontSize:12, color:C.hint }}>
                    {t.usuario_nombre || '--'}
                  </td>
                  <td style={{ ...TD('center'), whiteSpace:'nowrap' }}>
                    <div style={{ display:'flex', gap:6, justifyContent:'center' }}>
                      <button onClick={() => setVistaId(t.id)}
                        style={{ padding:'5px 12px', borderRadius:8, cursor:'pointer',
                          border:`1px solid ${C.bord2}`, background:C.sur2,
                          color:C.cyan, fontSize:11, fontWeight:600 }}>
                        {t.estado === 'EN_PROCESO' ? 'Contar' : 'Ver'}
                      </button>
                      {t.estado === 'EN_PROCESO' && (
                        <button onClick={() => eliminarToma(t.id)}
                          style={{ padding:'5px 10px', borderRadius:8, cursor:'pointer',
                            border:`1px solid ${C.bord2}`, background:C.sur2,
                            color:C.red, fontSize:11, fontWeight:600 }}>
                          Eliminar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {tomas.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding:'48px 0', textAlign:'center',
                    color:C.hint, fontSize:13 }}>
                    No hay tomas fisicas registradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal nueva toma */}
      {modal && (
        <ModalNuevaToma
          bodegas={bodegas}
          onCerrar={() => setModal(false)}
          onCreada={data => {
            setModal(false)
            setUltimaCreada(data)
            cargar()
          }}
        />
      )}
    </div>
  )
}
