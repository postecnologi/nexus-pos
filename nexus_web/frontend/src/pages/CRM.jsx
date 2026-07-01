// ============================================================
//  NEXUS POS — CRM
//  Archivo: frontend/src/pages/CRM.jsx
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../api'
import {
  Target, Plus, Search, Filter, Phone, Mail, MessageCircle,
  Calendar, DollarSign, Users, TrendingUp, Activity, Clock,
  ChevronDown, Loader2, AlertCircle, RefreshCw, X, Check,
  GripVertical, ExternalLink, FileText, Edit3, Star, Eye,
  Upload, Zap, BarChart3, Settings, Trash2, ArrowRight
} from 'lucide-react'
import { useTheme } from '../theme'

// ── Formateadores ────────────────────────────────────────────
const fmt$ = v => '$' + Number(v || 0).toLocaleString('es-EC',
  { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtN = v => Number(v || 0).toLocaleString('es-EC')
const fmtPct = v => Number(v || 0).toFixed(1) + '%'
const fmtDate = v => v ? new Date(v + 'T00:00:00').toLocaleDateString('es-EC') : '—'
const fmtDateTime = v => {
  if (!v) return '—'
  const d = new Date(v)
  return d.toLocaleDateString('es-EC') + ' ' + d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })
}
const diasDesde = v => {
  if (!v) return 0
  return Math.floor((Date.now() - new Date(v).getTime()) / 86400000)
}

// ── Iconos de tipo de actividad ─────────────────────────────
const TIPO_ICONS = {
  LLAMADA: '📞', EMAIL: '📧', REUNION: '🤝',
  WHATSAPP: '💬', TAREA: '✅', SEGUIMIENTO: '🔄',
}

// ── BuscadorCliente (autocompletado) ────────────────────────
function BuscadorCliente({ value, onChange, placeholder, C }) {
  const [txt, setTxt] = useState('')
  const [res, setRes] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef()

  const FI = {
    padding: '8px 11px', borderRadius: 8, fontSize: 13,
    border: `1px solid ${C.bord2}`, background: C.sur2,
    color: C.text, outline: 'none', boxSizing: 'border-box', width: '100%',
  }

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
    } catch { /* ignore */ }
  }

  function pick(c) { onChange(c); setTxt(c.razon_social); setOpen(false); setRes([]) }
  function limpiar() { onChange(null); setTxt(''); setRes([]); setOpen(false) }

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 220 }}>
      <div style={{ position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.hint, pointerEvents: 'none' }} />
        <input value={txt} onChange={e => buscar(e.target.value)}
          onFocus={() => txt.length >= 2 && setOpen(true)}
          placeholder={placeholder || "Buscar cliente..."}
          style={{
            ...FI, paddingLeft: 30, paddingRight: value ? 28 : 10,
            borderColor: value ? 'rgba(16,185,129,.5)' : C.bord2,
            background: value ? 'rgba(16,185,129,.08)' : C.sur2,
          }} />
        {value && (
          <button onClick={limpiar} style={{
            position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', color: C.hint,
            fontSize: 16, lineHeight: 1, padding: 2,
          }}>×</button>
        )}
      </div>
      {open && res.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          zIndex: 900, background: C.surface, borderRadius: 10,
          border: `1px solid ${C.bord2}`, boxShadow: '0 12px 32px rgba(0,0,0,.6)',
          maxHeight: 260, overflowY: 'auto',
        }}>
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

// ── Modal genérico ──────────────────────────────────────────
function Modal({ open, onClose, title, children, C, width = 520 }) {
  if (!open) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.surface, borderRadius: 16, width, maxWidth: '92vw',
        maxHeight: '90vh', overflow: 'auto', border: `1px solid ${C.bord2}`,
        boxShadow: '0 24px 64px rgba(0,0,0,.5)',
      }}>
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text }}>{title}</h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: C.hint, padding: 4,
          }}><X size={18} /></button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  )
}

// ── Estilos compartidos ─────────────────────────────────────
function getStyles(C) {
  const FI = {
    padding: '8px 11px', borderRadius: 8, fontSize: 13,
    border: `1px solid ${C.bord2}`, background: C.sur2,
    color: C.text, outline: 'none', boxSizing: 'border-box', width: '100%',
  }
  const FI_SELECT = { ...FI, cursor: 'pointer', appearance: 'auto' }
  const BTN = (color = C.blue, bg = C.blueD) => ({
    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    border: `1px solid ${color}33`, background: bg, color,
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
  })
  return { FI, FI_SELECT, BTN }
}

// ═════════════════════════════════════════════════════════════
//  KPI Cards
// ═════════════════════════════════════════════════════════════
function KPICards({ C }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/crm/dashboard').then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 20, color: C.muted, fontSize: 13 }}>Cargando KPIs...</div>

  const cards = [
    { label: 'Oportunidades Abiertas', value: fmtN(data?.total_abiertas||data?.oportunidades_abiertas||0), icon: Target, color: C.blue, bg: C.blueD },
    { label: 'Valor Pipeline', value: fmt$(data?.valor_pipeline||0), icon: DollarSign, color: C.green, bg: C.greenD },
    { label: 'Ganadas este mes', value: fmtN(data?.ganadas_mes?.count||data?.ganadas_mes||0), icon: TrendingUp, color: C.amber, bg: C.amberD },
    { label: 'Conversión %', value: fmtPct(data?.tasa_conversion||data?.conversion||0), icon: Activity, color: C.purple, bg: C.purpleD },
    { label: 'Actividades Pendientes', value: fmtN(data?.actividades_pendientes_hoy||data?.actividades_pendientes||0), icon: Clock, color: C.cyan, bg: 'rgba(6,182,212,.15)' },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 20 }}>
      {cards.map((c, i) => {
        const Icon = c.icon
        return (
          <div key={i} style={{
            background: C.surface, borderRadius: 12, padding: '16px 18px',
            border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: c.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={18} style={{ color: c.color }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 2 }}>{c.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{c.value}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
//  Tab 1: PIPELINE (Kanban)
// ═════════════════════════════════════════════════════════════
function PipelineTab({ C, onNewOpp, refreshKey }) {
  const [stages, setStages] = useState([])
  const [loading, setLoading] = useState(true)
  const [dragItem, setDragItem] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    api.get('/crm/pipeline').then(r => setStages(r.data || [])).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load, refreshKey])

  function onDragStart(e, opp) {
    setDragItem(opp)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', opp.id)
  }

  function onDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }

  async function onDrop(e, etapaId) {
    e.preventDefault()
    if (!dragItem || dragItem.etapa_id === etapaId) { setDragItem(null); return }
    try {
      await api.patch(`/crm/oportunidades/${dragItem.id}/etapa?etapa_id=${etapaId}`)
      load()
    } catch { /* ignore */ }
    setDragItem(null)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.muted }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 12 }}>
      <div style={{ display: 'flex', gap: 14, minHeight: 400 }}>
        {stages.map(stage => (
          <div key={stage.id}
            onDragOver={onDragOver}
            onDrop={e => onDrop(e, stage.id)}
            style={{
              minWidth: 280, maxWidth: 320, flex: '0 0 280px',
              background: C.surface, borderRadius: 12,
              border: `1px solid ${C.border}`,
              borderTop: `3px solid ${stage.color || C.blue}`,
              display: 'flex', flexDirection: 'column',
            }}>
            {/* Column header */}
            <div style={{
              padding: '12px 14px', borderBottom: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{stage.nombre}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {stage.oportunidades?.length || 0} oportunidades · {fmt$(stage.oportunidades?.reduce((s, o) => s + (o.valor_estimado || 0), 0))}
                </div>
              </div>
              <div style={{
                background: (stage.color || C.blue) + '22', color: stage.color || C.blue,
                fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
              }}>
                {stage.oportunidades?.length || 0}
              </div>
            </div>

            {/* Cards */}
            <div style={{ flex: 1, padding: 8, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(stage.oportunidades || []).map(opp => (
                <div key={opp.id}
                  draggable
                  onDragStart={e => onDragStart(e, opp)}
                  style={{
                    background: C.sur2, borderRadius: 10, padding: '12px 14px',
                    border: `1px solid ${C.border}`, cursor: 'grab',
                    transition: 'box-shadow .15s, transform .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.3)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>{opp.titulo}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{opp.cliente_nombre || '—'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.green }}>{fmt$(opp.valor_estimado)}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {(opp.score != null && opp.score > 0) && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                          background: opp.score >= 60 ? 'rgba(16,185,129,.18)' : opp.score >= 30 ? 'rgba(245,158,11,.18)' : 'rgba(239,68,68,.18)',
                          color: opp.score >= 60 ? '#10B981' : opp.score >= 30 ? '#F59E0B' : '#EF4444',
                        }}>{opp.score}pts</span>
                      )}
                      <span style={{ fontSize: 11, color: C.muted }}>{opp.probabilidad || 0}%</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: C.hint }}>{opp.vendedor_nombre || '—'}</span>
                    <span style={{ fontSize: 10, color: C.hint }}>{diasDesde(opp.fecha_creacion)} dias</span>
                  </div>
                  {/* Probability bar */}
                  <div style={{ marginTop: 8, height: 3, borderRadius: 2, background: C.sur3 }}>
                    <div style={{
                      height: '100%', borderRadius: 2, width: `${Math.min(opp.probabilidad || 0, 100)}%`,
                      background: (opp.probabilidad || 0) >= 70 ? C.green : (opp.probabilidad || 0) >= 40 ? C.amber : C.red,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
//  Tab 2: OPORTUNIDADES (tabla)
// ═════════════════════════════════════════════════════════════
function OportunidadesTab({ C, onNewOpp, refreshKey }) {
  const { FI, FI_SELECT } = getStyles(C)
  const [opps, setOpps] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [etapas, setEtapas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtros, setFiltros] = useState({ vendedor: '', etapa: '', estado: '', busqueda: '' })
  const [detailOpp, setDetailOpp] = useState(null)

  useEffect(() => {
    api.get('/vendedores').then(r => setVendedores(r.data || [])).catch(() => {})
    api.get('/crm/pipeline').then(r => setEtapas(r.data || [])).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = {}
    if (filtros.vendedor) params.vendedor_id = filtros.vendedor
    if (filtros.etapa) params.etapa_id = filtros.etapa
    if (filtros.estado) params.estado = filtros.estado
    if (filtros.busqueda) params.busqueda = filtros.busqueda
    api.get('/crm/oportunidades', { params })
      .then(r => setOpps(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [filtros, refreshKey])

  const estadoColor = e => {
    if (e === 'ganada') return { bg: C.greenD, color: C.green }
    if (e === 'perdida') return { bg: C.redD, color: C.red }
    return { bg: C.blueD, color: C.blue }
  }

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 280 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.hint }} />
          <input placeholder="Buscar oportunidad..." value={filtros.busqueda}
            onChange={e => setFiltros(f => ({ ...f, busqueda: e.target.value }))}
            style={{ ...FI, paddingLeft: 30 }} />
        </div>
        <select value={filtros.vendedor} onChange={e => setFiltros(f => ({ ...f, vendedor: e.target.value }))}
          style={{ ...FI_SELECT, width: 'auto', minWidth: 140 }}>
          <option value="">Todos los vendedores</option>
          {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
        </select>
        <select value={filtros.etapa} onChange={e => setFiltros(f => ({ ...f, etapa: e.target.value }))}
          style={{ ...FI_SELECT, width: 'auto', minWidth: 130 }}>
          <option value="">Todas las etapas</option>
          {etapas.map(et => <option key={et.id} value={et.id}>{et.nombre}</option>)}
        </select>
        <select value={filtros.estado} onChange={e => setFiltros(f => ({ ...f, estado: e.target.value }))}
          style={{ ...FI_SELECT, width: 'auto', minWidth: 120 }}>
          <option value="">Todos los estados</option>
          <option value="abierta">Abiertas</option>
          <option value="ganada">Ganadas</option>
          <option value="perdida">Perdidas</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: C.muted }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>
      ) : (
        <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
            <thead>
              <tr>
                {['Título', 'Cliente', 'Vendedor', 'Etapa', 'Valor', 'Probabilidad', 'Fecha', 'Estado'].map(h => (
                  <th key={h} style={{
                    padding: '10px 12px', fontSize: 10, fontWeight: 700, color: C.hint,
                    textAlign: 'left', background: C.sur3, borderBottom: `1px solid ${C.bord2}`,
                    textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {opps.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 13 }}>No hay oportunidades</td></tr>
              ) : opps.map(o => {
                const ec = estadoColor(o.estado)
                const etapa = etapas.find(e => e.id === o.etapa_id)
                return (
                  <tr key={o.id} style={{ cursor: 'pointer' }}
                    onClick={() => setDetailOpp(o)}
                    onMouseEnter={e => e.currentTarget.style.background = C.sur2}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '11px 12px', fontSize: 13, color: C.text, borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>{o.titulo}</td>
                    <td style={{ padding: '11px 12px', fontSize: 13, color: C.text, borderBottom: `1px solid ${C.border}` }}>{o.cliente_nombre || '—'}</td>
                    <td style={{ padding: '11px 12px', fontSize: 13, color: C.text, borderBottom: `1px solid ${C.border}` }}>{o.vendedor_nombre || '—'}</td>
                    <td style={{ padding: '11px 12px', fontSize: 13, borderBottom: `1px solid ${C.border}` }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: (etapa?.color || C.blue) + '22', color: etapa?.color || C.blue,
                      }}>{etapa?.nombre || o.etapa_nombre || '—'}</span>
                    </td>
                    <td style={{ padding: '11px 12px', fontSize: 13, color: C.green, borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>{fmt$(o.valor_estimado)}</td>
                    <td style={{ padding: '11px 12px', fontSize: 13, borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 4, borderRadius: 2, background: C.sur3, maxWidth: 80 }}>
                          <div style={{
                            height: '100%', borderRadius: 2, width: `${Math.min(o.probabilidad || 0, 100)}%`,
                            background: (o.probabilidad || 0) >= 70 ? C.green : (o.probabilidad || 0) >= 40 ? C.amber : C.red,
                          }} />
                        </div>
                        <span style={{ fontSize: 11, color: C.muted }}>{o.probabilidad || 0}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '11px 12px', fontSize: 12, color: C.muted, borderBottom: `1px solid ${C.border}` }}>{fmtDate(o.fecha_creacion?.slice(0, 10))}</td>
                    <td style={{ padding: '11px 12px', fontSize: 13, borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: ec.bg, color: ec.color }}>
                        {(o.estado || 'abierta').charAt(0).toUpperCase() + (o.estado || 'abierta').slice(1)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      <OportunidadDetailModal opp={detailOpp} onClose={() => setDetailOpp(null)} C={C} />

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
//  Tab 3: ACTIVIDADES
// ═════════════════════════════════════════════════════════════
function ActividadesTab({ C, refreshKey }) {
  const { FI, FI_SELECT, BTN } = getStyles(C)
  const [actividades, setActividades] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtros, setFiltros] = useState({ tipo: '', estado: '', busqueda: '' })
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ tipo: 'LLAMADA', titulo: '', descripcion: '', cliente_id: '', oportunidad_id: '', fecha_programada: '' })
  const [clienteSel, setClienteSel] = useState(null)
  const [oppsCliente, setOppsCliente] = useState([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    const params = {}
    if (filtros.tipo) params.tipo = filtros.tipo
    if (filtros.estado) params.estado = filtros.estado
    if (filtros.busqueda) params.busqueda = filtros.busqueda
    api.get('/crm/actividades', { params })
      .then(r => setActividades(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [filtros])

  useEffect(() => { load() }, [load, refreshKey])

  async function completar(act) {
    try {
      await api.patch(`/crm/actividades/${act.id}/completar`)
      load()
    } catch { /* ignore */ }
  }

  async function guardarActividad() {
    if (!form.titulo) return
    setSaving(true)
    try {
      const payload = { ...form }
      if (clienteSel) payload.cliente_id = clienteSel.id
      await api.post('/crm/actividades', payload)
      setShowNew(false)
      setForm({ tipo: 'LLAMADA', titulo: '', descripcion: '', cliente_id: '', oportunidad_id: '', fecha_programada: '' })
      setClienteSel(null)
      setOppsCliente([])
      load()
    } catch { /* ignore */ }
    setSaving(false)
  }

  useEffect(() => {
    if (clienteSel) {
      api.get('/crm/oportunidades', { params: { cliente_id: clienteSel.id } })
        .then(r => setOppsCliente(r.data || [])).catch(() => {})
    } else {
      setOppsCliente([])
    }
  }, [clienteSel])

  const pendientes = actividades.filter(a => a.estado === 'pendiente' || !a.estado || a.estado === 'programada')
  const completadas = actividades.filter(a => a.estado === 'completada')

  return (
    <div>
      {/* Filters + new button */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 280 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.hint }} />
          <input placeholder="Buscar actividad..." value={filtros.busqueda}
            onChange={e => setFiltros(f => ({ ...f, busqueda: e.target.value }))}
            style={{ ...FI, paddingLeft: 30 }} />
        </div>
        <select value={filtros.tipo} onChange={e => setFiltros(f => ({ ...f, tipo: e.target.value }))}
          style={{ ...FI_SELECT, width: 'auto', minWidth: 130 }}>
          <option value="">Todos los tipos</option>
          {Object.keys(TIPO_ICONS).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filtros.estado} onChange={e => setFiltros(f => ({ ...f, estado: e.target.value }))}
          style={{ ...FI_SELECT, width: 'auto', minWidth: 130 }}>
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendientes</option>
          <option value="completada">Completadas</option>
        </select>
        <button onClick={() => setShowNew(true)} style={BTN()}>
          <Plus size={14} /> Nueva actividad
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: C.muted }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Pending */}
          {pendientes.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: C.amber, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Pendientes ({pendientes.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendientes.map(a => (
                  <div key={a.id} style={{
                    background: C.surface, borderRadius: 10, padding: '14px 16px',
                    border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 14,
                  }}>
                    <span style={{ fontSize: 22 }}>{TIPO_ICONS[a.tipo] || '📋'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{a.titulo}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                        {a.cliente_nombre && <span>{a.cliente_nombre} · </span>}
                        <span>{fmtDateTime(a.fecha_programada)}</span>
                        {a.tipo && <span style={{ marginLeft: 8, padding: '1px 6px', borderRadius: 4, background: C.sur3, fontSize: 10, color: C.hint }}>{a.tipo}</span>}
                      </div>
                    </div>
                    <button onClick={() => completar(a)} style={{
                      ...BTN(C.green, C.greenD), padding: '6px 12px', fontSize: 12,
                    }}>
                      <Check size={13} /> Completar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed */}
          {completadas.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Completadas ({completadas.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {completadas.map(a => (
                  <div key={a.id} style={{
                    background: C.surface, borderRadius: 10, padding: '14px 16px',
                    border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 14,
                    opacity: 0.7,
                  }}>
                    <span style={{ fontSize: 22 }}>{TIPO_ICONS[a.tipo] || '📋'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{a.titulo}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                        {a.cliente_nombre && <span>{a.cliente_nombre} · </span>}
                        <span>{fmtDateTime(a.fecha_programada)}</span>
                      </div>
                    </div>
                    <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: C.greenD, color: C.green }}>Completada</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendientes.length === 0 && completadas.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>No hay actividades</div>
          )}
        </div>
      )}

      {/* New activity modal */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="Nueva Actividad" C={C}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Tipo</label>
            <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} style={FI_SELECT}>
              {Object.keys(TIPO_ICONS).map(t => <option key={t} value={t}>{TIPO_ICONS[t]} {t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Título *</label>
            <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} style={FI} placeholder="Título de la actividad" />
          </div>
          <div>
            <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Descripción</label>
            <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              style={{ ...FI, minHeight: 60, resize: 'vertical' }} placeholder="Descripción..." />
          </div>
          <div>
            <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Cliente</label>
            <BuscadorCliente value={clienteSel} onChange={setClienteSel} C={C} />
          </div>
          {oppsCliente.length > 0 && (
            <div>
              <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Oportunidad</label>
              <select value={form.oportunidad_id} onChange={e => setForm(f => ({ ...f, oportunidad_id: e.target.value }))} style={FI_SELECT}>
                <option value="">Sin oportunidad</option>
                {oppsCliente.map(o => <option key={o.id} value={o.id}>{o.titulo}</option>)}
              </select>
            </div>
          )}
          <div>
            <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Fecha programada</label>
            <input type="datetime-local" value={form.fecha_programada} onChange={e => setForm(f => ({ ...f, fecha_programada: e.target.value }))} style={FI} />
          </div>
          <button onClick={guardarActividad} disabled={saving || !form.titulo}
            style={{ ...BTN(), opacity: (saving || !form.titulo) ? 0.5 : 1, justifyContent: 'center', marginTop: 6 }}>
            {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={14} />}
            {saving ? 'Guardando...' : 'Crear Actividad'}
          </button>
        </div>
      </Modal>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
//  Oportunidad Detail Modal (with stage history + score)
// ═════════════════════════════════════════════════════════════
function OportunidadDetailModal({ opp, onClose, C }) {
  const [historial, setHistorial] = useState([])
  const [loadingH, setLoadingH] = useState(false)
  const [score, setScore] = useState(null)

  useEffect(() => {
    if (!opp) return
    setLoadingH(true)
    api.get(`/crm/oportunidades/${opp.id}/historial-etapas`)
      .then(r => setHistorial(r.data || []))
      .catch(() => setHistorial([]))
      .finally(() => setLoadingH(false))
    setScore(opp.score || null)
  }, [opp])

  async function recalcularScore() {
    if (!opp) return
    try {
      const { data } = await api.post(`/crm/oportunidades/${opp.id}/recalcular-score`)
      setScore(data.score)
    } catch { /* ignore */ }
  }

  if (!opp) return null

  return (
    <Modal open={!!opp} onClose={onClose} title={opp.titulo || 'Detalle'} C={C} width={620}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>Cliente</div><div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{opp.cliente_nombre || '--'}</div></div>
          <div><div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>Vendedor</div><div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{opp.vendedor_nombre || '--'}</div></div>
          <div><div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>Valor estimado</div><div style={{ fontSize: 14, color: C.green, fontWeight: 700 }}>{fmt$(opp.valor_estimado)}</div></div>
          <div><div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>Probabilidad</div><div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{opp.probabilidad || 0}%</div></div>
          <div><div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>Fecha creacion</div><div style={{ fontSize: 14, color: C.text }}>{fmtDate(opp.fecha_creacion?.slice(0, 10))}</div></div>
          <div><div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>Estado</div><div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{opp.estado || 'abierta'}</div></div>
          {opp.fuente && <div><div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>Fuente</div><div style={{ fontSize: 14, color: C.text }}>{opp.fuente}</div></div>}
          {opp.fecha_cierre_estimada && <div><div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>Fecha cierre est.</div><div style={{ fontSize: 14, color: C.text }}>{fmtDate(opp.fecha_cierre_estimada)}</div></div>}
        </div>

        {/* Score */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
          background: C.sur2, borderRadius: 10, border: `1px solid ${C.border}`,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>Score del Lead</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontSize: 20, fontWeight: 800,
                color: (score || 0) >= 60 ? '#10B981' : (score || 0) >= 30 ? '#F59E0B' : '#EF4444',
              }}>{score ?? opp.score ?? '--'}</span>
              <span style={{ fontSize: 11, color: C.hint }}>/ 100</span>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: C.sur3, maxWidth: 200 }}>
                <div style={{
                  height: '100%', borderRadius: 3, transition: 'width .3s',
                  width: `${Math.min(score || opp.score || 0, 100)}%`,
                  background: (score || opp.score || 0) >= 60 ? '#10B981' : (score || opp.score || 0) >= 30 ? '#F59E0B' : '#EF4444',
                }} />
              </div>
            </div>
          </div>
          <button onClick={recalcularScore} style={{
            background: 'none', border: `1px solid ${C.border}`, borderRadius: 8,
            padding: '5px 12px', fontSize: 11, color: C.blue, cursor: 'pointer', fontWeight: 600,
          }}>
            <RefreshCw size={12} /> Recalcular
          </button>
        </div>

        {opp.notas && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Notas</div>
            <div style={{ fontSize: 13, color: C.text, background: C.sur2, padding: 12, borderRadius: 8, border: `1px solid ${C.border}`, whiteSpace: 'pre-wrap' }}>{opp.notas}</div>
          </div>
        )}

        {/* Stage history timeline */}
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={14} style={{ color: C.blue }} /> Historial de Etapas
          </div>
          {loadingH ? (
            <div style={{ padding: 12, textAlign: 'center', color: C.muted, fontSize: 12 }}>Cargando...</div>
          ) : historial.length === 0 ? (
            <div style={{ padding: 12, textAlign: 'center', color: C.hint, fontSize: 12, background: C.sur2, borderRadius: 8 }}>
              Sin movimientos de etapa registrados
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {historial.map((h, i) => (
                <div key={h.id} style={{ display: 'flex', gap: 12, position: 'relative' }}>
                  {/* Timeline line */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%', background: C.blue,
                      border: `2px solid ${C.surface}`, zIndex: 1, flexShrink: 0,
                    }} />
                    {i < historial.length - 1 && (
                      <div style={{ width: 2, flex: 1, background: C.border, minHeight: 20 }} />
                    )}
                  </div>
                  {/* Content */}
                  <div style={{ paddingBottom: 12, flex: 1 }}>
                    <div style={{ fontSize: 12, color: C.text }}>
                      <span style={{ color: C.hint }}>{h.etapa_anterior || '(inicio)'}</span>
                      <ArrowRight size={11} style={{ margin: '0 4px', color: C.hint, verticalAlign: 'middle' }} />
                      <span style={{ fontWeight: 600, color: C.blue }}>{h.etapa_nueva || '?'}</span>
                    </div>
                    <div style={{ fontSize: 10, color: C.hint, marginTop: 2 }}>
                      {fmtDateTime(h.fecha)} · {h.usuario_nombre || ''}
                      {h.tiempo_en_etapa_horas > 0 && (
                        <span style={{ marginLeft: 8, color: C.muted }}>
                          ({Number(h.tiempo_en_etapa_horas).toFixed(1)}h en etapa anterior)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ═════════════════════════════════════════════════════════════
//  Tab 4: CLIENTES 360
// ═════════════════════════════════════════════════════════════
function Clientes360Tab({ C }) {
  const { FI, BTN } = getStyles(C)
  const [cliente, setCliente] = useState(null)
  const [historial, setHistorial] = useState(null)
  const [loading, setLoading] = useState(false)
  const [subTab, setSubTab] = useState('oportunidades')
  const [showWA, setShowWA] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const [showNewOpp, setShowNewOpp] = useState(false)
  const [showNewNote, setShowNewNote] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    if (!cliente) { setHistorial(null); return }
    setLoading(true)
    api.get(`/crm/clientes/${cliente.id}/historial`)
      .then(r => setHistorial(r.data))
      .catch(() => setHistorial(null))
      .finally(() => setLoading(false))
  }, [cliente])

  async function handleImportCSV(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post('/crm/importar-contactos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setImportResult(data)
    } catch (err) {
      setImportResult({ importados: 0, errores: [err.response?.data?.detail || 'Error al importar'] })
    }
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const subTabs = [
    { key: 'oportunidades', label: 'Oportunidades' },
    { key: 'actividades', label: 'Actividades' },
    { key: 'notas', label: 'Notas' },
    { key: 'comunicaciones', label: '📡 Comunicaciones' },
    { key: 'facturas', label: 'Facturas' },
    { key: 'cotizaciones', label: 'Cotizaciones' },
  ]

  const [comunicaciones, setComunicaciones] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [vendedorSelId, setVendedorSelId] = useState('')
  const [msgEmail, setMsgEmail] = useState({ dest: '', asunto: '', contenido: '' })
  const [msgWa, setMsgWa] = useState({ tel: '', texto: '' })
  const [sendingEmail, setSendingEmail] = useState(false)
  const [sendingWa, setSendingWa] = useState(false)
  const [comMsg, setComMsg] = useState(null)

  useEffect(() => {
    api.get('/vendedores').then(r => setVendedores(r.data || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (subTab === 'comunicaciones' && cliente) {
      api.get(`/crm-com/historial?cliente_id=${cliente.id}`)
        .then(r => setComunicaciones(r.data)).catch(() => {})
    }
  }, [subTab, cliente])

  const enviarEmail = async () => {
    if (!msgEmail.dest || !msgEmail.asunto || !msgEmail.contenido) {
      setComMsg({ok:false,text:'Complete todos los campos del email'}); return
    }
    setSendingEmail(true); setComMsg(null)
    try {
      await api.post('/crm-com/email/enviar', {
        vendedor_id: vendedorSelId ? parseInt(vendedorSelId) : null,
        destinatario: msgEmail.dest,
        asunto: msgEmail.asunto,
        contenido: msgEmail.contenido,
        cliente_id: cliente?.id,
      })
      setComMsg({ok:true, text:'Email enviado correctamente'})
      setMsgEmail({dest:'',asunto:'',contenido:''})
      api.get(`/crm-com/historial?cliente_id=${cliente.id}`).then(r=>setComunicaciones(r.data)).catch(()=>{})
    } catch(e) { setComMsg({ok:false, text:e.response?.data?.detail||'Error al enviar'}) }
    setSendingEmail(false)
  }

  const enviarWa = async () => {
    if (!msgWa.tel || !msgWa.texto) {
      setComMsg({ok:false,text:'Complete teléfono y mensaje'}); return
    }
    setSendingWa(true); setComMsg(null)
    try {
      await api.post('/crm-com/whatsapp/enviar', {
        vendedor_id: vendedorSelId ? parseInt(vendedorSelId) : null,
        telefono: msgWa.tel,
        mensaje: msgWa.texto,
        cliente_id: cliente?.id,
      })
      setComMsg({ok:true, text:'Mensaje WhatsApp enviado'})
      setMsgWa({tel:'',texto:''})
      api.get(`/crm-com/historial?cliente_id=${cliente.id}`).then(r=>setComunicaciones(r.data)).catch(()=>{})
    } catch(e) { setComMsg({ok:false, text:e.response?.data?.detail||'Error al enviar'}) }
    setSendingWa(false)
  }

  return (
    <div>
      {/* Client search + import */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px', maxWidth: 400 }}>
          <BuscadorCliente value={cliente} onChange={setCliente} placeholder="Buscar cliente para vista 360..." C={C} />
        </div>
        <input ref={fileRef} type="file" accept=".csv" onChange={handleImportCSV} style={{ display: 'none' }} />
        <button onClick={() => fileRef.current?.click()} disabled={importing}
          style={{ ...BTN(C.amber, C.amberD), opacity: importing ? 0.5 : 1 }}>
          {importing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={14} />}
          {importing ? 'Importando...' : 'Importar CSV'}
        </button>
      </div>
      {importResult && (
        <div style={{
          padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: 13,
          background: importResult.importados > 0 ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)',
          border: `1px solid ${importResult.importados > 0 ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)'}`,
          color: C.text,
        }}>
          <strong>{importResult.importados}</strong> contactos importados.
          {importResult.errores?.length > 0 && (
            <div style={{ marginTop: 4, fontSize: 11, color: C.red }}>
              Errores: {importResult.errores.slice(0, 5).join(', ')}
              {importResult.errores.length > 5 && ` ... y ${importResult.errores.length - 5} mas`}
            </div>
          )}
          <button onClick={() => setImportResult(null)} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: C.hint, fontSize: 11, marginLeft: 8,
          }}>Cerrar</button>
        </div>
      )}

      {!cliente && (
        <div style={{ padding: 60, textAlign: 'center', color: C.muted }}>
          <Users size={48} style={{ marginBottom: 12, opacity: 0.3 }} />
          <div style={{ fontSize: 14 }}>Selecciona un cliente para ver su vista 360</div>
        </div>
      )}

      {cliente && loading && (
        <div style={{ padding: 40, textAlign: 'center', color: C.muted }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>
      )}

      {cliente && !loading && (
        <>
          {/* Client info card */}
          <div style={{
            background: C.surface, borderRadius: 12, padding: '18px 22px',
            border: `1px solid ${C.border}`, marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 700, color: 'white',
                }}>
                  {(cliente.razon_social || 'C')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{cliente.razon_social}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>
                    {cliente.tipo_identificacion} {cliente.identificacion}
                    {cliente.telefono && <span style={{ marginLeft: 10 }}>📞 {cliente.telefono}</span>}
                    {cliente.email && <span style={{ marginLeft: 10 }}>📧 {cliente.email}</span>}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => setShowWA(true)} style={BTN(C.green, C.greenD)} title="WhatsApp">
                  <MessageCircle size={14} /> WhatsApp
                </button>
                <button onClick={() => setShowEmail(true)} style={BTN(C.blue, C.blueD)} title="Email">
                  <Mail size={14} /> Email
                </button>
                <button onClick={() => { if (cliente.telefono) window.open(`tel:${cliente.telefono}`) }} style={BTN(C.cyan, 'rgba(6,182,212,.15)')} title="Llamar">
                  <Phone size={14} /> Llamar
                </button>
                <button onClick={() => setShowNewOpp(true)} style={BTN(C.purple, C.purpleD)} title="Nueva Oportunidad">
                  <Plus size={14} /> Oportunidad
                </button>
                <button onClick={() => setShowNewNote(true)} style={BTN(C.amber, C.amberD)} title="Nueva Nota">
                  <Plus size={14} /> Nota
                </button>
              </div>
            </div>
          </div>

          {/* Sub tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
            {subTabs.map(t => (
              <button key={t.key} onClick={() => setSubTab(t.key)} style={{
                padding: '8px 16px', fontSize: 12, fontWeight: subTab === t.key ? 700 : 400,
                color: subTab === t.key ? C.blue : C.muted, background: 'none',
                border: 'none', borderBottom: subTab === t.key ? `2px solid ${C.blue}` : '2px solid transparent',
                cursor: 'pointer', marginBottom: -1,
              }}>{t.label}</button>
            ))}
          </div>

          {/* Sub tab content */}
          {subTab === 'oportunidades' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(historial?.oportunidades || []).length === 0
                ? <div style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 13 }}>Sin oportunidades</div>
                : (historial.oportunidades || []).map(o => (
                  <div key={o.id} style={{
                    background: C.surface, borderRadius: 10, padding: '12px 16px',
                    border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{o.titulo}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{o.etapa_nombre || '—'} · {o.vendedor_nombre || '—'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.green }}>{fmt$(o.valor_estimado)}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{o.probabilidad || 0}%</div>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {subTab === 'actividades' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(historial?.actividades || []).length === 0
                ? <div style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 13 }}>Sin actividades</div>
                : (historial.actividades || []).map(a => (
                  <div key={a.id} style={{
                    background: C.surface, borderRadius: 10, padding: '12px 16px',
                    border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <span style={{ fontSize: 20 }}>{TIPO_ICONS[a.tipo] || '📋'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{a.titulo}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{fmtDateTime(a.fecha_programada)}</div>
                    </div>
                    <span style={{
                      padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                      background: a.estado === 'completada' ? C.greenD : C.amberD,
                      color: a.estado === 'completada' ? C.green : C.amber,
                    }}>{a.estado || 'pendiente'}</span>
                  </div>
                ))}
            </div>
          )}

          {subTab === 'notas' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(historial?.notas || []).length === 0
                ? <div style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 13 }}>Sin notas</div>
                : (historial.notas || []).map(n => (
                  <div key={n.id} style={{
                    background: C.surface, borderRadius: 10, padding: '12px 16px',
                    border: `1px solid ${C.border}`,
                  }}>
                    <div style={{ fontSize: 13, color: C.text, whiteSpace: 'pre-wrap' }}>{n.contenido || n.texto}</div>
                    <div style={{ fontSize: 11, color: C.hint, marginTop: 6 }}>{fmtDateTime(n.fecha_creacion)} · {n.usuario_nombre || ''}</div>
                  </div>
                ))}
            </div>
          )}

          {subTab === 'comunicaciones' && (
            <div>
              {/* Selector de vendedor */}
              <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:16,flexWrap:'wrap'}}>
                <div style={{flex:1,minWidth:200}}>
                  <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Vendedor que envía</label>
                  <select value={vendedorSelId} onChange={e=>setVendedorSelId(e.target.value)} style={FI}>
                    <option value="">— Seleccionar vendedor —</option>
                    {vendedores.map(v=><option key={v.id} value={v.id}>{v.nombre} {v.apellidos||''}</option>)}
                  </select>
                </div>
              </div>

              {/* Email */}
              <div style={{background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,padding:16,marginBottom:12}}>
                <div style={{fontSize:13,fontWeight:700,color:C.blue,marginBottom:12}}>✉️ Enviar Email</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                  <div>
                    <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Destinatario</label>
                    <input value={msgEmail.dest} onChange={e=>setMsgEmail(p=>({...p,dest:e.target.value}))}
                      style={FI} placeholder={cliente?.email||'email@ejemplo.com'} />
                  </div>
                  <div>
                    <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Asunto</label>
                    <input value={msgEmail.asunto} onChange={e=>setMsgEmail(p=>({...p,asunto:e.target.value}))}
                      style={FI} placeholder="Asunto del email" />
                  </div>
                </div>
                <textarea value={msgEmail.contenido} onChange={e=>setMsgEmail(p=>({...p,contenido:e.target.value}))}
                  style={{...FI,minHeight:80,resize:'vertical',marginBottom:10}}
                  placeholder="Escriba el mensaje..." />
                <button onClick={enviarEmail} disabled={sendingEmail||!vendedorSelId}
                  style={{...BTN(C.blue,C.blueD),opacity:(!vendedorSelId?0.5:1)}}>
                  {sendingEmail?'Enviando...':'✉️ Enviar Email'}
                </button>
                {!vendedorSelId && <span style={{fontSize:11,color:C.muted,marginLeft:10}}>Seleccione un vendedor primero</span>}
              </div>

              {/* WhatsApp */}
              <div style={{background:C.surface,borderRadius:10,border:`1px solid ${C.border}`,padding:16,marginBottom:12}}>
                <div style={{fontSize:13,fontWeight:700,color:C.green,marginBottom:12}}>💬 Enviar WhatsApp</div>
                <div style={{display:'grid',gridTemplateColumns:'200px 1fr',gap:10,marginBottom:10}}>
                  <div>
                    <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Teléfono</label>
                    <input value={msgWa.tel} onChange={e=>setMsgWa(p=>({...p,tel:e.target.value}))}
                      style={FI} placeholder={cliente?.telefono||'0991234567'} />
                  </div>
                  <div>
                    <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Mensaje</label>
                    <input value={msgWa.texto} onChange={e=>setMsgWa(p=>({...p,texto:e.target.value}))}
                      style={FI} placeholder="Mensaje de WhatsApp..." />
                  </div>
                </div>
                <button onClick={enviarWa} disabled={sendingWa||!vendedorSelId}
                  style={{...BTN(C.green,'rgba(16,185,129,.15)'),opacity:(!vendedorSelId?0.5:1)}}>
                  {sendingWa?'Enviando...':'💬 Enviar WhatsApp'}
                </button>
              </div>

              {comMsg && (
                <div style={{padding:'9px 14px',borderRadius:8,marginBottom:12,
                  background:comMsg.ok?'rgba(16,185,129,.15)':'rgba(239,68,68,.15)',
                  border:`1px solid ${comMsg.ok?'#10B98144':'#EF444444'}`,
                  color:comMsg.ok?'#10B981':'#FCA5A5',fontSize:13}}>
                  {comMsg.ok?'✅':'⚠️'} {comMsg.text}
                </div>
              )}

              {/* Historial */}
              <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:8}}>Historial de comunicaciones</div>
              {comunicaciones.length === 0
                ? <div style={{padding:20,textAlign:'center',color:C.muted,fontSize:13}}>Sin comunicaciones registradas</div>
                : comunicaciones.map(com=>(
                  <div key={com.id} style={{background:C.surface,borderRadius:8,
                    border:`1px solid ${C.border}`,padding:'10px 14px',marginBottom:8,
                    display:'flex',gap:10,alignItems:'flex-start'}}>
                    <div style={{fontSize:18,flexShrink:0}}>{com.tipo==='EMAIL'?'✉️':'💬'}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:12,fontWeight:600,color:C.text}}>
                          {com.vendedor_nombre||'Sistema'} → {com.direccion}
                        </span>
                        <span style={{fontSize:10,color:C.muted,flexShrink:0,marginLeft:8}}>
                          {new Date(com.created_at).toLocaleString('es-EC')}
                        </span>
                      </div>
                      {com.asunto && <div style={{fontSize:11,color:C.blue,marginTop:2}}>{com.asunto}</div>}
                      <div style={{fontSize:12,color:C.muted,marginTop:4,
                        overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'100%'}}>
                        {com.contenido}
                      </div>
                      {com.estado==='ERROR' && <div style={{fontSize:11,color:'#EF4444',marginTop:2}}>❌ {com.error_msg}</div>}
                    </div>
                    <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,flexShrink:0,
                      background: com.estado==='ENVIADO'?'rgba(16,185,129,.15)':'rgba(239,68,68,.15)',
                      color: com.estado==='ENVIADO'?'#10B981':'#EF4444'}}>
                      {com.estado}
                    </span>
                  </div>
                ))
              }
            </div>
          )}

          {subTab === 'facturas' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(historial?.facturas || []).length === 0
                ? <div style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 13 }}>Sin facturas</div>
                : (historial.facturas || []).map(f => (
                  <div key={f.id} style={{
                    background: C.surface, borderRadius: 10, padding: '12px 16px',
                    border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{f.numero || `#${f.id}`}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{fmtDate(f.fecha)}</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.green }}>{fmt$(f.total)}</div>
                  </div>
                ))}
            </div>
          )}

          {subTab === 'cotizaciones' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(historial?.cotizaciones || []).length === 0
                ? <div style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 13 }}>Sin cotizaciones</div>
                : (historial.cotizaciones || []).map(q => (
                  <div key={q.id} style={{
                    background: C.surface, borderRadius: 10, padding: '12px 16px',
                    border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{q.numero || `#${q.id}`}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{fmtDate(q.fecha)} · {q.estado || ''}</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.blue }}>{fmt$(q.total)}</div>
                  </div>
                ))}
            </div>
          )}
        </>
      )}

      {/* WhatsApp modal */}
      <WhatsAppModal open={showWA} onClose={() => setShowWA(false)} cliente={cliente} C={C} />

      {/* Email modal */}
      <EmailModal open={showEmail} onClose={() => setShowEmail(false)} cliente={cliente} C={C} />

      {/* New opportunity modal */}
      <NuevaOportunidadModal open={showNewOpp} onClose={() => setShowNewOpp(false)} cliente={cliente} C={C} onCreated={() => {
        setShowNewOpp(false)
        // Refresh historial
        if (cliente) {
          api.get(`/crm/clientes/${cliente.id}/historial`).then(r => setHistorial(r.data)).catch(() => {})
        }
      }} />

      {/* New note modal */}
      <NuevaNotaModal open={showNewNote} onClose={() => setShowNewNote(false)} cliente={cliente} C={C} onCreated={() => {
        setShowNewNote(false)
        if (cliente) {
          api.get(`/crm/clientes/${cliente.id}/historial`).then(r => setHistorial(r.data)).catch(() => {})
        }
      }} />

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
//  WhatsApp Modal
// ═════════════════════════════════════════════════════════════
function WhatsAppModal({ open, onClose, cliente, C }) {
  const { FI, FI_SELECT, BTN } = getStyles(C)
  const [phone, setPhone] = useState('')
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [plantillas, setPlantillas] = useState([])

  useEffect(() => {
    if (open && cliente) {
      setPhone(cliente.telefono || cliente.celular || '')
      setMsg('')
      api.get('/crm/plantillas', { params: { tipo: 'WHATSAPP' } })
        .then(r => setPlantillas(r.data || [])).catch(() => {})
    }
  }, [open, cliente])

  function usarPlantilla(e) {
    const p = plantillas.find(x => x.id === parseInt(e.target.value))
    if (p) setMsg(p.contenido)
  }

  async function enviar() {
    if (!phone) return
    setSending(true)
    try {
      const { data } = await api.post('/crm/whatsapp/enviar', { telefono: phone, mensaje: msg, cliente_id: cliente?.id })
      if (data.link) window.open(data.link, '_blank')
      onClose()
    } catch { /* ignore */ }
    setSending(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="Enviar WhatsApp" C={C} width={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Telefono</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} style={FI} placeholder="+593..." />
        </div>
        {plantillas.length > 0 && (
          <div>
            <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Usar plantilla</label>
            <select onChange={usarPlantilla} style={FI_SELECT} defaultValue="">
              <option value="">Seleccionar plantilla...</option>
              {plantillas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
        )}
        <div>
          <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Mensaje</label>
          <textarea value={msg} onChange={e => setMsg(e.target.value)}
            style={{ ...FI, minHeight: 80, resize: 'vertical' }} placeholder="Escribe tu mensaje..." />
        </div>
        <button onClick={enviar} disabled={sending || !phone}
          style={{ ...BTN(C.green, C.greenD), justifyContent: 'center', opacity: (sending || !phone) ? 0.5 : 1 }}>
          {sending ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <MessageCircle size={14} />}
          {sending ? 'Enviando...' : 'Abrir WhatsApp'}
        </button>
      </div>
    </Modal>
  )
}

// ═════════════════════════════════════════════════════════════
//  Email Modal
// ═════════════════════════════════════════════════════════════
function EmailModal({ open, onClose, cliente, C }) {
  const { FI, FI_SELECT, BTN } = getStyles(C)
  const [dest, setDest] = useState('')
  const [asunto, setAsunto] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [plantillas, setPlantillas] = useState([])

  useEffect(() => {
    if (open && cliente) {
      setDest(cliente.email || '')
      setAsunto('')
      setMensaje('')
      setResult(null)
      api.get('/crm/plantillas', { params: { tipo: 'EMAIL' } })
        .then(r => setPlantillas(r.data || [])).catch(() => {})
    }
  }, [open, cliente])

  function usarPlantilla(e) {
    const p = plantillas.find(x => x.id === parseInt(e.target.value))
    if (p) {
      setMensaje(p.contenido)
      if (p.asunto) setAsunto(p.asunto)
    }
  }

  async function enviar() {
    if (!dest) return
    setSending(true)
    try {
      await api.post('/crm/email/enviar', { destinatario: dest, asunto, mensaje, cliente_id: cliente?.id })
      setResult({ ok: true, msg: 'Email enviado correctamente' })
      setTimeout(() => onClose(), 1500)
    } catch (err) {
      setResult({ ok: false, msg: err.response?.data?.detail || 'Error al enviar email' })
    }
    setSending(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="Enviar Email" C={C} width={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Destinatario</label>
          <input value={dest} onChange={e => setDest(e.target.value)} style={FI} placeholder="email@ejemplo.com" />
        </div>
        {plantillas.length > 0 && (
          <div>
            <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Usar plantilla</label>
            <select onChange={usarPlantilla} style={FI_SELECT} defaultValue="">
              <option value="">Seleccionar plantilla...</option>
              {plantillas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
        )}
        <div>
          <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Asunto</label>
          <input value={asunto} onChange={e => setAsunto(e.target.value)} style={FI} placeholder="Asunto del email" />
        </div>
        <div>
          <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Mensaje</label>
          <textarea value={mensaje} onChange={e => setMensaje(e.target.value)}
            style={{ ...FI, minHeight: 100, resize: 'vertical' }} placeholder="Escribe tu mensaje..." />
        </div>
        {result && (
          <div style={{
            padding: '8px 12px', borderRadius: 8, fontSize: 12,
            background: result.ok ? C.greenD : C.redD,
            color: result.ok ? C.green : C.red,
            border: `1px solid ${result.ok ? C.green : C.red}33`,
          }}>{result.msg}</div>
        )}
        <button onClick={enviar} disabled={sending || !dest}
          style={{ ...BTN(), justifyContent: 'center', opacity: (sending || !dest) ? 0.5 : 1 }}>
          {sending ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Mail size={14} />}
          {sending ? 'Enviando...' : 'Enviar Email'}
        </button>
      </div>
    </Modal>
  )
}

// ═════════════════════════════════════════════════════════════
//  Modal Nueva Oportunidad
// ═════════════════════════════════════════════════════════════
function NuevaOportunidadModal({ open, onClose, cliente, C, onCreated }) {
  const { FI, FI_SELECT, BTN } = getStyles(C)
  const [vendedores, setVendedores] = useState([])
  const [etapas, setEtapas] = useState([])
  const [clienteSel, setClienteSel] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    titulo: '', vendedor_id: '', etapa_id: '', valor_estimado: '',
    probabilidad: 50, fecha_cierre_estimada: '', fuente: '', notas: '',
  })

  useEffect(() => {
    if (open) {
      api.get('/vendedores').then(r => setVendedores(r.data || [])).catch(() => {})
      api.get('/crm/pipeline').then(r => {
        const st = r.data || []
        setEtapas(st)
        if (st.length > 0 && !form.etapa_id) setForm(f => ({ ...f, etapa_id: st[0].id }))
      }).catch(() => {})
      if (cliente) setClienteSel(cliente)
    }
  }, [open])

  async function guardar() {
    if (!form.titulo) return
    setSaving(true)
    try {
      const payload = { ...form }
      if (clienteSel) payload.cliente_id = clienteSel.id
      if (payload.valor_estimado) payload.valor_estimado = parseFloat(payload.valor_estimado)
      if (payload.probabilidad) payload.probabilidad = parseInt(payload.probabilidad)
      await api.post('/crm/oportunidades', payload)
      setForm({ titulo: '', vendedor_id: '', etapa_id: '', valor_estimado: '', probabilidad: 50, fecha_cierre_estimada: '', fuente: '', notas: '' })
      setClienteSel(null)
      if (onCreated) onCreated()
    } catch { /* ignore */ }
    setSaving(false)
  }

  const FUENTES = ['Referido', 'Web', 'Redes Sociales', 'Llamada', 'Visita', 'Otro']

  return (
    <Modal open={open} onClose={onClose} title="Nueva Oportunidad" C={C} width={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Título *</label>
          <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} style={FI} placeholder="Nombre de la oportunidad" />
        </div>
        <div>
          <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Cliente</label>
          <BuscadorCliente value={clienteSel} onChange={setClienteSel} C={C} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Vendedor</label>
            <select value={form.vendedor_id} onChange={e => setForm(f => ({ ...f, vendedor_id: e.target.value }))} style={FI_SELECT}>
              <option value="">Seleccionar...</option>
              {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Etapa</label>
            <select value={form.etapa_id} onChange={e => setForm(f => ({ ...f, etapa_id: e.target.value }))} style={FI_SELECT}>
              <option value="">Seleccionar...</option>
              {etapas.map(et => <option key={et.id} value={et.id}>{et.nombre}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Valor estimado</label>
            <input type="number" step="0.01" value={form.valor_estimado} onChange={e => setForm(f => ({ ...f, valor_estimado: e.target.value }))} style={FI} placeholder="0.00" />
          </div>
          <div>
            <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Probabilidad: {form.probabilidad}%</label>
            <input type="range" min="0" max="100" value={form.probabilidad} onChange={e => setForm(f => ({ ...f, probabilidad: e.target.value }))}
              style={{ width: '100%', accentColor: C.blue }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Fecha cierre estimada</label>
            <input type="date" value={form.fecha_cierre_estimada} onChange={e => setForm(f => ({ ...f, fecha_cierre_estimada: e.target.value }))} style={FI} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Fuente</label>
            <select value={form.fuente} onChange={e => setForm(f => ({ ...f, fuente: e.target.value }))} style={FI_SELECT}>
              <option value="">Seleccionar...</option>
              {FUENTES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Notas</label>
          <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
            style={{ ...FI, minHeight: 60, resize: 'vertical' }} placeholder="Notas adicionales..." />
        </div>
        <button onClick={guardar} disabled={saving || !form.titulo}
          style={{ ...BTN(), justifyContent: 'center', opacity: (saving || !form.titulo) ? 0.5 : 1, marginTop: 6 }}>
          {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={14} />}
          {saving ? 'Guardando...' : 'Crear Oportunidad'}
        </button>
      </div>
    </Modal>
  )
}

// ═════════════════════════════════════════════════════════════
//  Modal Nueva Nota
// ═════════════════════════════════════════════════════════════
function NuevaNotaModal({ open, onClose, cliente, C, onCreated }) {
  const { FI, BTN } = getStyles(C)
  const [texto, setTexto] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) setTexto('') }, [open])

  async function guardar() {
    if (!texto || !cliente) return
    setSaving(true)
    try {
      await api.post(`/crm/clientes/${cliente.id}/notas`, { contenido: texto })
      if (onCreated) onCreated()
    } catch { /* ignore */ }
    setSaving(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="Nueva Nota" C={C} width={440}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Nota para {cliente?.razon_social}</label>
          <textarea value={texto} onChange={e => setTexto(e.target.value)}
            style={{ ...FI, minHeight: 100, resize: 'vertical' }} placeholder="Escribe una nota..." />
        </div>
        <button onClick={guardar} disabled={saving || !texto}
          style={{ ...BTN(C.amber, C.amberD), justifyContent: 'center', opacity: (saving || !texto) ? 0.5 : 1 }}>
          {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={14} />}
          {saving ? 'Guardando...' : 'Guardar Nota'}
        </button>
      </div>
    </Modal>
  )
}

// ═════════════════════════════════════════════════════════════
//  Tab 5: FORECAST (Pronostico de Ventas)
// ═════════════════════════════════════════════════════════════
function ForecastTab({ C }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/crm/forecast').then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.muted }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
        <div style={{ background: C.surface, borderRadius: 12, padding: '18px 20px', border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 4 }}>Pipeline Total</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.blue }}>{fmt$(data?.total_pipeline || 0)}</div>
        </div>
        <div style={{ background: C.surface, borderRadius: 12, padding: '18px 20px', border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 4 }}>Valor Ponderado (Forecast)</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.green }}>{fmt$(data?.total_ponderado || 0)}</div>
        </div>
      </div>

      {/* Monthly table */}
      <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
          <thead>
            <tr>
              {['Mes', 'Oportunidades', 'Valor Total', 'Valor Ponderado'].map(h => (
                <th key={h} style={{
                  padding: '10px 14px', fontSize: 10, fontWeight: 700, color: C.hint,
                  textAlign: 'left', background: C.sur3, borderBottom: `1px solid ${C.bord2}`,
                  textTransform: 'uppercase', letterSpacing: '.05em',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(!data?.por_mes || data.por_mes.length === 0) ? (
              <tr><td colSpan={4} style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 13 }}>
                No hay oportunidades con fecha de cierre estimada
              </td></tr>
            ) : data.por_mes.map((m, i) => (
              <tr key={i}>
                <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: C.text, borderBottom: `1px solid ${C.border}` }}>{m.mes}</td>
                <td style={{ padding: '11px 14px', fontSize: 13, color: C.text, borderBottom: `1px solid ${C.border}` }}>{m.oportunidades}</td>
                <td style={{ padding: '11px 14px', fontSize: 13, color: C.blue, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{fmt$(m.valor_total)}</td>
                <td style={{ padding: '11px 14px', fontSize: 13, color: C.green, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>{fmt$(m.valor_ponderado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
//  Tab 6: EMBUDO (Funnel Report)
// ═════════════════════════════════════════════════════════════
function EmbudoTab({ C }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/crm/reporte-embudo').then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.muted }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>

  const etapas = data?.etapas || []
  const maxTotal = Math.max(...etapas.map(e => e.actual + (e.ganadas || 0) + (e.perdidas || 0)), 1)

  return (
    <div>
      {/* Visual funnel bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {etapas.map((e, i) => {
          const total = e.actual + (e.ganadas || 0) + (e.perdidas || 0)
          const pct = Math.max((total / maxTotal) * 100, 8)
          return (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 120, fontSize: 12, fontWeight: 600, color: C.text, textAlign: 'right', flexShrink: 0 }}>
                {e.nombre}
              </div>
              <div style={{ flex: 1, position: 'relative' }}>
                <div style={{
                  height: 36, borderRadius: 8, width: `${pct}%`,
                  background: `${e.color || C.blue}44`,
                  border: `1px solid ${e.color || C.blue}66`,
                  display: 'flex', alignItems: 'center', paddingLeft: 12,
                  transition: 'width .3s ease',
                  minWidth: 80,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: e.color || C.blue }}>{total}</span>
                </div>
              </div>
              <div style={{ width: 60, fontSize: 11, color: C.muted, textAlign: 'right', flexShrink: 0 }}>
                {e.conversion_pct != null ? `${e.conversion_pct}%` : ''}
              </div>
              {i < etapas.length - 1 && (
                <ArrowRight size={12} style={{ color: C.hint, flexShrink: 0 }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Detail table */}
      <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
          <thead>
            <tr>
              {['Etapa', 'Actuales', 'Ganadas', 'Perdidas', 'Conversion %', 'Tiempo Prom. (hrs)'].map(h => (
                <th key={h} style={{
                  padding: '10px 14px', fontSize: 10, fontWeight: 700, color: C.hint,
                  textAlign: 'left', background: C.sur3, borderBottom: `1px solid ${C.bord2}`,
                  textTransform: 'uppercase', letterSpacing: '.05em',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {etapas.map(e => (
              <tr key={e.id}>
                <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: e.color || C.blue, display: 'inline-block' }} />
                    <span style={{ color: C.text }}>{e.nombre}</span>
                  </span>
                </td>
                <td style={{ padding: '11px 14px', fontSize: 13, color: C.text, borderBottom: `1px solid ${C.border}` }}>{e.actual}</td>
                <td style={{ padding: '11px 14px', fontSize: 13, color: C.green, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{e.ganadas}</td>
                <td style={{ padding: '11px 14px', fontSize: 13, color: C.red, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{e.perdidas}</td>
                <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, borderBottom: `1px solid ${C.border}`, color: C.blue }}>
                  {e.conversion_pct != null ? `${e.conversion_pct}%` : '--'}
                </td>
                <td style={{ padding: '11px 14px', fontSize: 13, color: C.muted, borderBottom: `1px solid ${C.border}` }}>{e.tiempo_promedio_horas}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
//  Tab 7: AUTOMATIZACIONES
// ═════════════════════════════════════════════════════════════
function AutomatizacionesTab({ C }) {
  const { FI, FI_SELECT, BTN } = getStyles(C)
  const [autos, setAutos] = useState([])
  const [etapas, setEtapas] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ etapa_id: '', accion: 'CREAR_ACTIVIDAD', config: '{}' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get('/crm/automatizaciones'),
      api.get('/crm/etapas'),
    ]).then(([a, e]) => {
      setAutos(a.data || [])
      setEtapas(e.data || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function crear() {
    if (!form.etapa_id || !form.accion) return
    setSaving(true)
    try {
      await api.post('/crm/automatizaciones', null, { params: form })
      setForm({ etapa_id: '', accion: 'CREAR_ACTIVIDAD', config: '{}' })
      load()
    } catch { /* ignore */ }
    setSaving(false)
  }

  async function eliminar(id) {
    try { await api.delete(`/crm/automatizaciones/${id}`); load() } catch { /* ignore */ }
  }

  const ACCIONES = [
    { value: 'CREAR_ACTIVIDAD', label: 'Crear actividad de seguimiento' },
    { value: 'CAMBIAR_PROBABILIDAD', label: 'Cambiar probabilidad' },
    { value: 'ENVIAR_EMAIL', label: 'Enviar email (plantilla)' },
    { value: 'ENVIAR_WHATSAPP', label: 'Enviar WhatsApp (plantilla)' },
  ]

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.muted }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>

  return (
    <div>
      {/* Create form */}
      <div style={{
        background: C.surface, borderRadius: 12, padding: 20,
        border: `1px solid ${C.border}`, marginBottom: 20,
      }}>
        <h4 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={16} style={{ color: C.amber }} /> Nueva Automatizacion
        </h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 180px' }}>
            <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Cuando llega a etapa</label>
            <select value={form.etapa_id} onChange={e => setForm(f => ({ ...f, etapa_id: e.target.value }))} style={FI_SELECT}>
              <option value="">Seleccionar etapa...</option>
              {etapas.map(et => <option key={et.id} value={et.id}>{et.nombre}</option>)}
            </select>
          </div>
          <div style={{ flex: '1 1 220px' }}>
            <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Ejecutar accion</label>
            <select value={form.accion} onChange={e => setForm(f => ({ ...f, accion: e.target.value }))} style={FI_SELECT}>
              {ACCIONES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          <div style={{ flex: '1 1 180px' }}>
            <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Config (JSON)</label>
            <input value={form.config} onChange={e => setForm(f => ({ ...f, config: e.target.value }))} style={FI} placeholder='{"titulo":"Seguimiento"}' />
          </div>
          <button onClick={crear} disabled={saving || !form.etapa_id}
            style={{ ...BTN(C.green, C.greenD), opacity: (saving || !form.etapa_id) ? 0.5 : 1 }}>
            {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={14} />}
            Crear
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {autos.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>
            No hay automatizaciones configuradas
          </div>
        ) : autos.map(a => (
          <div key={a.id} style={{
            background: C.surface, borderRadius: 10, padding: '14px 16px',
            border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Zap size={16} style={{ color: C.amber }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                  Cuando llega a <span style={{ color: C.blue }}>{a.etapa_nombre || '?'}</span> → {ACCIONES.find(x => x.value === a.accion)?.label || a.accion}
                </div>
                <div style={{ fontSize: 11, color: C.hint, marginTop: 2 }}>Config: {a.config || '{}'}</div>
              </div>
            </div>
            <button onClick={() => eliminar(a.id)} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: C.red, padding: 6,
            }}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
//  Tab 8: PLANTILLAS
// ═════════════════════════════════════════════════════════════
function PlantillasTab({ C }) {
  const { FI, FI_SELECT, BTN } = getStyles(C)
  const [plantillas, setPlantillas] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ nombre: '', tipo: 'EMAIL', asunto: '', contenido: '' })
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    api.get('/crm/plantillas').then(r => setPlantillas(r.data || [])).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function guardar() {
    if (!form.nombre || !form.contenido) return
    setSaving(true)
    try {
      if (editId) {
        await api.put(`/crm/plantillas/${editId}`, null, { params: { nombre: form.nombre, contenido: form.contenido, asunto: form.asunto } })
      } else {
        await api.post('/crm/plantillas', null, { params: form })
      }
      setShowNew(false)
      setEditId(null)
      setForm({ nombre: '', tipo: 'EMAIL', asunto: '', contenido: '' })
      load()
    } catch { /* ignore */ }
    setSaving(false)
  }

  async function eliminar(id) {
    try { await api.delete(`/crm/plantillas/${id}`); load() } catch { /* ignore */ }
  }

  function editar(p) {
    setForm({ nombre: p.nombre, tipo: p.tipo, asunto: p.asunto || '', contenido: p.contenido })
    setEditId(p.id)
    setShowNew(true)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.muted }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text }}>Plantillas de Email / WhatsApp</h4>
        <button onClick={() => { setEditId(null); setForm({ nombre: '', tipo: 'EMAIL', asunto: '', contenido: '' }); setShowNew(true) }}
          style={BTN()}><Plus size={14} /> Nueva plantilla</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {plantillas.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13, gridColumn: '1/-1' }}>
            No hay plantillas creadas
          </div>
        ) : plantillas.map(p => (
          <div key={p.id} style={{
            background: C.surface, borderRadius: 12, padding: '16px 18px',
            border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {p.tipo === 'EMAIL' ? <Mail size={14} style={{ color: C.blue }} /> : <MessageCircle size={14} style={{ color: C.green }} />}
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{p.nombre}</span>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                background: p.tipo === 'EMAIL' ? C.blueD : C.greenD,
                color: p.tipo === 'EMAIL' ? C.blue : C.green,
              }}>{p.tipo}</span>
            </div>
            {p.asunto && <div style={{ fontSize: 11, color: C.muted }}>Asunto: {p.asunto}</div>}
            <div style={{
              fontSize: 12, color: C.hint, background: C.sur2, padding: 10, borderRadius: 8,
              maxHeight: 60, overflow: 'hidden', border: `1px solid ${C.border}`,
            }}>{p.contenido}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => editar(p)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: C.blue, fontSize: 12, fontWeight: 600,
              }}><Edit3 size={13} /> Editar</button>
              <button onClick={() => eliminar(p.id)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: C.red, fontSize: 12, fontWeight: 600,
              }}><Trash2 size={13} /> Eliminar</button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={showNew} onClose={() => { setShowNew(false); setEditId(null) }}
        title={editId ? 'Editar Plantilla' : 'Nueva Plantilla'} C={C} width={520}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Nombre *</label>
              <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} style={FI} placeholder="Nombre de la plantilla" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Tipo</label>
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} style={FI_SELECT} disabled={!!editId}>
                <option value="EMAIL">Email</option>
                <option value="WHATSAPP">WhatsApp</option>
              </select>
            </div>
          </div>
          {form.tipo === 'EMAIL' && (
            <div>
              <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Asunto</label>
              <input value={form.asunto} onChange={e => setForm(f => ({ ...f, asunto: e.target.value }))} style={FI} placeholder="Asunto del email" />
            </div>
          )}
          <div>
            <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Contenido *</label>
            <textarea value={form.contenido} onChange={e => setForm(f => ({ ...f, contenido: e.target.value }))}
              style={{ ...FI, minHeight: 120, resize: 'vertical' }} placeholder="Escribe el contenido de la plantilla..." />
          </div>
          <button onClick={guardar} disabled={saving || !form.nombre || !form.contenido}
            style={{ ...BTN(), justifyContent: 'center', opacity: (saving || !form.nombre || !form.contenido) ? 0.5 : 1, marginTop: 6 }}>
            {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
            {saving ? 'Guardando...' : editId ? 'Actualizar' : 'Crear Plantilla'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
//  Componente Principal: CRM
// ═════════════════════════════════════════════════════════════
export default function CRM() {
  const C = useTheme()
  const { BTN } = getStyles(C)
  const [tab, setTab] = useState('pipeline')
  const [showNewOpp, setShowNewOpp] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const tabs = [
    { key: 'pipeline', label: 'Pipeline' },
    { key: 'oportunidades', label: 'Oportunidades' },
    { key: 'actividades', label: 'Actividades' },
    { key: 'clientes360', label: 'Clientes 360' },
    { key: 'forecast', label: 'Forecast' },
    { key: 'embudo', label: 'Embudo' },
    { key: 'automatizaciones', label: 'Automatizaciones' },
    { key: 'plantillas', label: 'Plantillas' },
  ]

  return (
    <div style={{ padding: '24px 28px', minHeight: '100%', background: C.bg }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: C.blueD, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Target size={20} style={{ color: C.blue }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>CRM</h1>
            <p style={{ margin: 0, fontSize: 12, color: C.muted }}>Gestión de relaciones con clientes</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setRefreshKey(k => k + 1)} style={BTN(C.muted, 'transparent')} title="Refrescar">
            <RefreshCw size={14} />
          </button>
          <button onClick={() => setShowNewOpp(true)} style={BTN()}>
            <Plus size={14} /> Nueva oportunidad
          </button>
        </div>
      </div>

      {/* KPIs */}
      <KPICards C={C} />

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 20,
        borderBottom: `1px solid ${C.border}`, paddingBottom: 0,
      }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '10px 20px', fontSize: 13, fontWeight: tab === t.key ? 700 : 400,
            color: tab === t.key ? C.blue : C.muted,
            background: tab === t.key ? C.blueD : 'none',
            border: 'none',
            borderBottom: tab === t.key ? `2px solid ${C.blue}` : '2px solid transparent',
            borderRadius: tab === t.key ? '8px 8px 0 0' : '8px 8px 0 0',
            cursor: 'pointer', marginBottom: -1,
            transition: 'all .15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'pipeline' && <PipelineTab C={C} onNewOpp={() => setShowNewOpp(true)} refreshKey={refreshKey} />}
      {tab === 'oportunidades' && <OportunidadesTab C={C} onNewOpp={() => setShowNewOpp(true)} refreshKey={refreshKey} />}
      {tab === 'actividades' && <ActividadesTab C={C} refreshKey={refreshKey} />}
      {tab === 'clientes360' && <Clientes360Tab C={C} />}
      {tab === 'forecast' && <ForecastTab C={C} />}
      {tab === 'embudo' && <EmbudoTab C={C} />}
      {tab === 'automatizaciones' && <AutomatizacionesTab C={C} />}
      {tab === 'plantillas' && <PlantillasTab C={C} />}

      {/* Global new opportunity modal */}
      <NuevaOportunidadModal open={showNewOpp} onClose={() => setShowNewOpp(false)} C={C} onCreated={() => {
        setShowNewOpp(false)
        setRefreshKey(k => k + 1)
      }} />

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
