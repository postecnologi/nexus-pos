import React, { useState, useEffect, useCallback } from 'react'
import api from '../api'
import { useTheme } from '../theme'
import {
  Calculator, Plus, Search, X, Trash2, Eye, ChevronRight, ChevronDown,
  AlertCircle, Check, BookOpen, BarChart3, FileText, List, Download,
  RefreshCw, Lock, CheckCircle, Target, Layers, DollarSign, GitCompare,
  Globe, Building2, Settings, Receipt
} from 'lucide-react'

const fmt$ = v => '$' + Number(v || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const TABS = [
  { key: 'plan', label: 'Plan de Cuentas', icon: List },
  { key: 'asientos', label: 'Asientos', icon: BookOpen },
  { key: 'comprobacion', label: 'Comprobacion', icon: CheckCircle },
  { key: 'balance', label: 'Balance General', icon: BarChart3 },
  { key: 'resultados', label: 'Estado Resultados', icon: FileText },
  { key: 'diario', label: 'Libro Diario', icon: BookOpen },
  { key: 'mayor', label: 'Libro Mayor', icon: FileText },
  { key: 'centros', label: 'Centros Costo', icon: Target },
  { key: 'auxiliares', label: 'Auxiliares', icon: Layers },
  { key: 'presupuesto', label: 'Presupuesto', icon: DollarSign },
  { key: 'conciliacion', label: 'Conciliacion', icon: GitCompare },
  { key: 'monedas', label: 'Monedas', icon: Globe },
  { key: 'consolidado', label: 'Consolidado', icon: Building2 },
  { key: 'config-cuentas', label: 'Configurar Cuentas', icon: Settings },
  { key: 'sri',            label: 'Formularios SRI',    icon: Receipt },
]

const TIPO_BADGE = {
  ACTIVO:     { bg: 'rgba(59,130,246,.15)', color: '#3B82F6' },
  PASIVO:     { bg: 'rgba(239,68,68,.15)',  color: '#EF4444' },
  PATRIMONIO: { bg: 'rgba(139,92,246,.15)', color: '#8B5CF6' },
  INGRESO:    { bg: 'rgba(16,185,129,.15)', color: '#10B981' },
  COSTO:      { bg: 'rgba(245,158,11,.15)', color: '#F59E0B' },
  GASTO:      { bg: 'rgba(249,115,22,.15)', color: '#F97316' },
}

const ESTADO_COLORS = {
  BORRADOR:  { bg: 'rgba(245,158,11,.15)', color: '#F59E0B', border: 'rgba(245,158,11,.3)' },
  APROBADO:  { bg: 'rgba(16,185,129,.15)', color: '#10B981', border: 'rgba(16,185,129,.3)' },
}

function BadgeEstado({ estado }) {
  const s = ESTADO_COLORS[estado] || ESTADO_COLORS.BORRADOR
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
      background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {estado}
    </span>
  )
}

export default function Contabilidad() {
  const C = useTheme()
  const [tab, setTab] = useState('plan')

  const fi = {
    padding: '8px 11px', borderRadius: 8, fontSize: 13,
    border: `1px solid ${C.bord2}`, background: C.sur2,
    color: C.text, outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ padding: 24, minHeight: '100vh', background: C.bg }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Calculator size={22} color={C.blue} />
        <span style={{ fontSize: 20, fontWeight: 800, color: C.text }}>Contabilidad</span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const TIcon = t.icon
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 5,
                padding: '8px 18px', borderRadius: '10px 10px 0 0', border: 'none',
                fontWeight: 700, fontSize: 12, cursor: 'pointer',
                background: tab === t.key ? C.surface : 'transparent',
                color: tab === t.key ? C.blue : C.muted,
                borderBottom: tab === t.key ? `2px solid ${C.blue}` : `2px solid transparent`,
              }}>
              <TIcon size={13} /> {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'plan' && <TabPlanCuentas C={C} fi={fi} />}
      {tab === 'asientos' && <TabAsientos C={C} fi={fi} />}
      {tab === 'comprobacion' && <TabComprobacion C={C} fi={fi} />}
      {tab === 'balance' && <TabBalance C={C} fi={fi} />}
      {tab === 'resultados' && <TabResultados C={C} fi={fi} />}
      {tab === 'diario' && <TabDiario C={C} fi={fi} />}
      {tab === 'mayor' && <TabMayor C={C} fi={fi} />}
      {tab === 'centros' && <TabCentrosCosto C={C} fi={fi} />}
      {tab === 'auxiliares' && <TabAuxiliares C={C} fi={fi} />}
      {tab === 'presupuesto' && <TabPresupuesto C={C} fi={fi} />}
      {tab === 'conciliacion' && <TabConciliacion C={C} fi={fi} />}
      {tab === 'monedas' && <TabMonedas C={C} fi={fi} />}
      {tab === 'consolidado' && <TabConsolidado C={C} fi={fi} />}
      {tab === 'config-cuentas' && <TabConfigCuentas C={C} fi={fi} />}
      {tab === 'sri' && <TabSRIContabilidad C={C} fi={fi} />}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   Tab 1: Plan de Cuentas
   ════════════════════════════════════════════════════════════ */
function TabPlanCuentas({ C, fi }) {
  const [cuentas, setCuentas] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [collapsed, setCollapsed] = useState({})

  const cargar = useCallback(() => {
    setLoading(true)
    api.get('/contabilidad/plan-cuentas')
      .then(r => setCuentas(r.data || []))
      .catch(() => setCuentas([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function inicializar() {
    if (!window.confirm('Inicializar plan de cuentas de Ecuador? Esto creara las cuentas base.')) return
    try {
      await api.post('/contabilidad/plan-cuentas/inicializar')
      cargar()
    } catch (e) {
      alert(e.response?.data?.detail || 'Error al inicializar')
    }
  }

  async function descargarPlantilla() {
    try {
      const resp = await api.get('/contabilidad/plan-cuentas/plantilla-excel', { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([resp.data], { type: resp.headers['content-type'] }))
      const a = document.createElement('a')
      a.href = url; a.download = 'plantilla_plan_cuentas.xlsx'; a.click()
      URL.revokeObjectURL(url)
    } catch { alert('Error al descargar plantilla') }
  }

  async function importarExcel(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reemplazar = window.confirm(
      '¿Desea REEMPLAZAR el plan de cuentas actual?\n\n' +
      'OK = Borrar todo e importar desde cero\n' +
      'Cancelar = Solo agregar cuentas nuevas (no borra las existentes)'
    )
    const form = new FormData()
    form.append('file', file)
    try {
      const r = await api.post(`/contabilidad/plan-cuentas/importar?reemplazar=${reemplazar}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      alert(`${r.data.msg}${r.data.errores?.length ? '\n\nAdvertencias:\n' + r.data.errores.slice(0, 5).join('\n') : ''}`)
      cargar()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al importar')
    }
    e.target.value = ''
  }

  function toggleCollapse(codigo) {
    setCollapsed(prev => ({ ...prev, [codigo]: !prev[codigo] }))
  }

  // Determine which accounts are visible based on collapsed parents
  function isVisible(cuenta, allCuentas) {
    // Find if any parent is collapsed
    for (const c of allCuentas) {
      if (c.codigo !== cuenta.codigo &&
          cuenta.codigo.startsWith(c.codigo) &&
          c.nivel < cuenta.nivel &&
          collapsed[c.codigo]) {
        return false
      }
    }
    return true
  }

  function hasChildren(codigo, allCuentas) {
    return allCuentas.some(c => c.codigo !== codigo && c.codigo.startsWith(codigo) && c.codigo.length > codigo.length)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <button onClick={inicializar}
          style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${C.blue}`,
            background: C.blueD, color: C.blue, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
          Inicializar Plan Ecuador
        </button>
        <button onClick={descargarPlantilla}
          style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid #10B981`,
            background: '#10B98115', color: '#10B981', fontWeight: 700, fontSize: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6 }}>
          ⬇ Plantilla Excel
        </button>
        <label style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid #F59E0B`,
          background: '#F59E0B15', color: '#F59E0B', fontWeight: 700, fontSize: 12, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6 }}>
          ⬆ Importar Excel
          <input type="file" accept=".xlsx,.xls" onChange={importarExcel} style={{ display: 'none' }} />
        </label>
        <button onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            borderRadius: 8, border: 'none', background: C.blue, color: '#fff',
            fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
          <Plus size={14} /> Nueva Cuenta
        </button>
      </div>

      <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
        overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: C.sur2, borderBottom: `1px solid ${C.border}` }}>
              {['Codigo', 'Nombre', 'Tipo', 'Naturaleza'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left',
                  fontWeight: 700, color: C.muted, fontSize: 11,
                  textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: C.hint }}>
                Cargando...</td></tr>
            ) : cuentas.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: C.hint }}>
                No hay cuentas. Use "Inicializar Plan Ecuador" para comenzar.</td></tr>
            ) : cuentas.filter(c => isVisible(c, cuentas)).map(c => {
              const indent = (c.nivel || 1) * 20
              const tipoInfo = TIPO_BADGE[c.tipo] || { bg: 'rgba(107,114,128,.15)', color: '#6B7280' }
              const hasKids = hasChildren(c.codigo, cuentas)
              return (
                <tr key={c.id || c.codigo} style={{ borderBottom: `1px solid ${C.border}` }}
                  onMouseEnter={e => e.currentTarget.style.background = C.sur2}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '8px 12px', paddingLeft: indent, fontWeight: 600,
                    color: C.blue, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {hasKids && (
                      <button onClick={() => toggleCollapse(c.codigo)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer',
                          color: C.muted, padding: 0, marginRight: 4, display: 'inline-flex',
                          verticalAlign: 'middle' }}>
                        {collapsed[c.codigo] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                      </button>
                    )}
                    {c.codigo}
                  </td>
                  <td style={{ padding: '8px 12px', color: C.text,
                    fontWeight: c.nivel <= 2 ? 700 : 400 }}>{c.nombre}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                      background: tipoInfo.bg, color: tipoInfo.color }}>{c.tipo}</span>
                  </td>
                  <td style={{ padding: '8px 12px', color: C.muted, fontSize: 11 }}>
                    {c.naturaleza}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <ModalNuevaCuenta C={C} fi={fi}
          onClose={() => setShowModal(false)}
          onCreada={() => { setShowModal(false); cargar() }}
        />
      )}
    </div>
  )
}

function ModalNuevaCuenta({ C, fi, onClose, onCreada }) {
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState('ACTIVO')
  const [naturaleza, setNaturaleza] = useState('DEUDORA')
  const [nivel, setNivel] = useState(1)
  const [padre_id, setPadreId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function guardar() {
    if (!codigo || !nombre) return setError('Codigo y nombre son requeridos')
    setSaving(true)
    setError('')
    try {
      await api.post('/contabilidad/plan-cuentas', {
        codigo, nombre, tipo, naturaleza, nivel: parseInt(nivel),
        padre_id: padre_id ? parseInt(padre_id) : null,
      })
      onCreada()
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al crear cuenta')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000 }}>
      <div style={{ background: C.surface, borderRadius: 16, padding: 28, width: 500,
        border: `1px solid ${C.bord2}`, boxShadow: '0 25px 60px rgba(0,0,0,.7)' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: C.text }}>Nueva Cuenta</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            cursor: 'pointer', color: C.hint }}><X size={18} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={lbl(C)}>Codigo *</label>
            <input value={codigo} onChange={e => setCodigo(e.target.value)}
              placeholder="1.1.01" style={{ ...fi, width: '100%' }} />
          </div>
          <div>
            <label style={lbl(C)}>Nivel</label>
            <input type="number" value={nivel} onChange={e => setNivel(e.target.value)}
              min={1} max={6} style={{ ...fi, width: '100%' }} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={lbl(C)}>Nombre *</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)}
            placeholder="Nombre de la cuenta" style={{ ...fi, width: '100%' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={lbl(C)}>Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)}
              style={{ ...fi, width: '100%' }}>
              {['ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'COSTO', 'GASTO'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={lbl(C)}>Naturaleza</label>
            <select value={naturaleza} onChange={e => setNaturaleza(e.target.value)}
              style={{ ...fi, width: '100%' }}>
              <option value="DEUDORA">DEUDORA</option>
              <option value="ACREEDORA">ACREEDORA</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={lbl(C)}>Padre ID (opcional)</label>
          <input type="number" value={padre_id} onChange={e => setPadreId(e.target.value)}
            placeholder="ID de la cuenta padre" style={{ ...fi, width: '100%' }} />
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            background: C.redD, borderRadius: 8, marginBottom: 12,
            border: `1px solid ${C.red}`, color: C.red, fontSize: 12 }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose}
            style={{ padding: '8px 20px', borderRadius: 8, border: `1px solid ${C.border}`,
              background: 'transparent', color: C.muted, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={guardar} disabled={saving}
            style={{ padding: '8px 24px', borderRadius: 8, border: 'none',
              background: C.blue, color: '#fff', fontWeight: 700, fontSize: 13,
              cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Guardando...' : 'Crear Cuenta'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   Tab 2: Asientos
   ════════════════════════════════════════════════════════════ */
function TabAsientos({ C, fi }) {
  const [asientos, setAsientos] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showDetalle, setShowDetalle] = useState(null)
  const [mesGenerar, setMesGenerar] = useState(new Date().toISOString().slice(0, 7))
  const [generando, setGenerando] = useState(false)
  const [cerrando, setCerrando] = useState(false)

  const cargar = useCallback(() => {
    setLoading(true)
    api.get('/contabilidad/asientos')
      .then(r => setAsientos(r.data || []))
      .catch(() => setAsientos([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function verDetalle(id) {
    try {
      const { data } = await api.get(`/contabilidad/asientos/${id}`)
      setShowDetalle(data)
    } catch { alert('Error al cargar detalle') }
  }

  async function aprobar(id) {
    if (!window.confirm('Aprobar este asiento?')) return
    try {
      await api.patch(`/contabilidad/asientos/${id}/aprobar`)
      cargar()
    } catch (e) {
      alert(e.response?.data?.detail || 'Error al aprobar')
    }
  }

  async function generarAsientos() {
    if (!mesGenerar) return alert('Seleccione un mes')
    if (!window.confirm(`Generar asientos automaticos para ${mesGenerar}?\n\nEsto creara asientos contables para todas las facturas, compras, cobros y pagos del mes que no tengan asiento asociado.`)) return
    setGenerando(true)
    try {
      const { data } = await api.post(`/contabilidad/generar-asientos?mes=${mesGenerar}`)
      alert(data.msg || `${data.generados} asientos generados`)
      cargar()
    } catch (e) {
      alert(e.response?.data?.detail || 'Error al generar asientos')
    } finally { setGenerando(false) }
  }

  async function cierrePeriodo() {
    if (!mesGenerar) return alert('Seleccione un mes')
    if (!window.confirm(`Cerrar el periodo ${mesGenerar}?\n\nEsto generara un asiento de cierre que transfiere el resultado (Ingresos - Costos/Gastos) al Patrimonio.`)) return
    setCerrando(true)
    try {
      const { data } = await api.post(`/contabilidad/cierre-periodo?mes=${mesGenerar}`)
      alert(`${data.msg}\n\nIngresos: ${fmt$(data.ingresos)}\nGastos: ${fmt$(data.gastos)}\nUtilidad: ${fmt$(data.utilidad)}`)
      cargar()
    } catch (e) {
      alert(e.response?.data?.detail || 'Error al cerrar periodo')
    } finally { setCerrando(false) }
  }

  return (
    <div>
      {/* Action bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16,
        alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        {/* Left side: auto-generation */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={lbl(C)}>Mes</label>
            <input type="month" value={mesGenerar} onChange={e => setMesGenerar(e.target.value)}
              style={fi} />
          </div>
          <button onClick={generarAsientos} disabled={generando}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 8, border: `1px solid ${C.green}`,
              background: 'rgba(16,185,129,.1)', color: C.green,
              fontWeight: 700, fontSize: 12, cursor: 'pointer',
              opacity: generando ? 0.6 : 1 }}>
            <RefreshCw size={13} /> {generando ? 'Generando...' : 'Generar Asientos del Mes'}
          </button>
          <button onClick={cierrePeriodo} disabled={cerrando}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 8, border: `1px solid ${C.amber || '#F59E0B'}`,
              background: 'rgba(245,158,11,.1)', color: C.amber || '#F59E0B',
              fontWeight: 700, fontSize: 12, cursor: 'pointer',
              opacity: cerrando ? 0.6 : 1 }}>
            <Lock size={13} /> {cerrando ? 'Cerrando...' : 'Cierre de Periodo'}
          </button>
        </div>
        {/* Right side: new entry */}
        <button onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            borderRadius: 8, border: 'none', background: C.blue, color: '#fff',
            fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
          <Plus size={14} /> Nuevo Asiento
        </button>
      </div>

      <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
        overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: C.sur2, borderBottom: `1px solid ${C.border}` }}>
              {['Numero', 'Fecha', 'Descripcion', 'Tipo', 'Estado', 'Total Debe', 'Acciones'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left',
                  fontWeight: 700, color: C.muted, fontSize: 11,
                  textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: C.hint }}>
                Cargando...</td></tr>
            ) : asientos.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: C.hint }}>
                No hay asientos contables</td></tr>
            ) : asientos.map(a => (
              <tr key={a.id} style={{ borderBottom: `1px solid ${C.border}` }}
                onMouseEnter={e => e.currentTarget.style.background = C.sur2}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '8px 12px', fontWeight: 600, color: C.blue }}>
                  {a.numero}</td>
                <td style={{ padding: '8px 12px', color: C.text }}>
                  {String(a.fecha || '').slice(0, 10)}</td>
                <td style={{ padding: '8px 12px', color: C.text, maxWidth: 200,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.descripcion}</td>
                <td style={{ padding: '8px 12px', color: C.muted, fontSize: 11 }}>
                  {a.tipo}</td>
                <td style={{ padding: '8px 12px' }}><BadgeEstado estado={a.estado} /></td>
                <td style={{ padding: '8px 12px', fontWeight: 700, color: C.text, textAlign: 'right' }}>
                  {fmt$(a.total_debe)}</td>
                <td style={{ padding: '8px 12px' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => verDetalle(a.id)} title="Ver detalle"
                      style={btnIcon(C)}><Eye size={13} /></button>
                    {a.estado === 'BORRADOR' && (
                      <button onClick={() => aprobar(a.id)} title="Aprobar"
                        style={{ ...btnIcon(C), color: C.green }}><Check size={13} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <ModalNuevoAsiento C={C} fi={fi}
          onClose={() => setShowModal(false)}
          onCreado={() => { setShowModal(false); cargar() }}
        />
      )}

      {showDetalle && (
        <ModalDetalleAsiento C={C} data={showDetalle}
          onClose={() => setShowDetalle(null)} />
      )}
    </div>
  )
}

function ModalNuevoAsiento({ C, fi, onClose, onCreado }) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [descripcion, setDescripcion] = useState('')
  const [tipo, setTipo] = useState('MANUAL')
  const [lineas, setLineas] = useState([emptyLinea(), emptyLinea()])
  const [cuentas, setCuentas] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/contabilidad/plan-cuentas')
      .then(r => setCuentas(r.data || []))
      .catch(() => {})
  }, [])

  function emptyLinea() {
    return { cuenta_id: '', descripcion: '', debe: '', haber: '' }
  }

  function updateLinea(idx, field, value) {
    setLineas(prev => {
      const copy = [...prev]
      copy[idx] = { ...copy[idx], [field]: value }
      return copy
    })
  }

  function removeLinea(idx) {
    if (lineas.length <= 2) return
    setLineas(prev => prev.filter((_, i) => i !== idx))
  }

  const totalDebe = lineas.reduce((s, l) => s + (parseFloat(l.debe) || 0), 0)
  const totalHaber = lineas.reduce((s, l) => s + (parseFloat(l.haber) || 0), 0)
  const diferencia = Math.round((totalDebe - totalHaber) * 100) / 100
  const balanced = diferencia === 0 && totalDebe > 0

  async function guardar() {
    if (!descripcion) return setError('Ingrese una descripcion')
    if (!balanced) return setError('El asiento no esta balanceado (Debe = Haber)')
    const lineasValid = lineas.filter(l => l.cuenta_id && (parseFloat(l.debe) > 0 || parseFloat(l.haber) > 0))
    if (lineasValid.length < 2) return setError('Necesita al menos 2 lineas con montos')

    setSaving(true)
    setError('')
    try {
      await api.post('/contabilidad/asientos', {
        fecha, descripcion, tipo,
        detalles: lineasValid.map(l => ({
          cuenta_id: parseInt(l.cuenta_id),
          descripcion: l.descripcion || '',
          debe: parseFloat(l.debe) || 0,
          haber: parseFloat(l.haber) || 0,
        })),
      })
      onCreado()
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al crear asiento')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000 }}>
      <div style={{ background: C.surface, borderRadius: 16, padding: 28, width: 860,
        maxHeight: '92vh', overflowY: 'auto',
        border: `1px solid ${C.bord2}`, boxShadow: '0 25px 60px rgba(0,0,0,.7)' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: C.text }}>Nuevo Asiento Contable</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            cursor: 'pointer', color: C.hint }}><X size={18} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={lbl(C)}>Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              style={{ ...fi, width: '100%' }} />
          </div>
          <div>
            <label style={lbl(C)}>Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)}
              style={{ ...fi, width: '100%' }}>
              {['VENTA', 'COMPRA', 'COBRO', 'PAGO', 'AJUSTE', 'MANUAL'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={lbl(C)}>Descripcion *</label>
            <input value={descripcion} onChange={e => setDescripcion(e.target.value)}
              placeholder="Descripcion del asiento"
              style={{ ...fi, width: '100%' }} />
          </div>
        </div>

        {/* Lineas */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ ...lbl(C), marginBottom: 0 }}>Lineas del Asiento</label>
            <button onClick={() => setLineas(prev => [...prev, emptyLinea()])}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px',
                borderRadius: 6, border: `1px solid ${C.blue}`, background: 'transparent',
                color: C.blue, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              <Plus size={12} /> Agregar linea
            </button>
          </div>

          <div style={{ background: C.sur2, borderRadius: 10, border: `1px solid ${C.border}`,
            overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px 110px 36px',
              gap: 8, padding: '8px 10px', borderBottom: `1px solid ${C.border}` }}>
              {['Cuenta', 'Descripcion', 'Debe', 'Haber', ''].map(h => (
                <span key={h} style={{ fontSize: 10, fontWeight: 700, color: C.muted,
                  textTransform: 'uppercase' }}>{h}</span>
              ))}
            </div>

            {lineas.map((l, idx) => (
              <div key={idx} style={{ display: 'grid',
                gridTemplateColumns: '1fr 1fr 110px 110px 36px',
                gap: 8, padding: '6px 10px', borderBottom: `1px solid ${C.border}`,
                alignItems: 'center' }}>
                <select value={l.cuenta_id}
                  onChange={e => updateLinea(idx, 'cuenta_id', e.target.value)}
                  style={{ ...fi, padding: '5px 6px', fontSize: 11 }}>
                  <option value="">-- Cuenta --</option>
                  {cuentas.map(c => (
                    <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>
                  ))}
                </select>
                <input value={l.descripcion}
                  onChange={e => updateLinea(idx, 'descripcion', e.target.value)}
                  placeholder="Descripcion"
                  style={{ ...fi, padding: '5px 6px', fontSize: 11 }} />
                <input type="number" step="0.01" value={l.debe}
                  onChange={e => updateLinea(idx, 'debe', e.target.value)}
                  placeholder="0.00"
                  style={{ ...fi, padding: '5px 6px', fontSize: 11, textAlign: 'right' }} />
                <input type="number" step="0.01" value={l.haber}
                  onChange={e => updateLinea(idx, 'haber', e.target.value)}
                  placeholder="0.00"
                  style={{ ...fi, padding: '5px 6px', fontSize: 11, textAlign: 'right' }} />
                <button onClick={() => removeLinea(idx)}
                  disabled={lineas.length <= 2}
                  style={{ background: 'none', border: 'none', cursor: 'pointer',
                    color: lineas.length <= 2 ? C.hint : C.red, padding: 2 }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}

            {/* Footer totals */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px 110px 36px',
              gap: 8, padding: '10px 10px', background: C.sur3 || C.sur2 }}>
              <span></span>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textAlign: 'right' }}>TOTALES:</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: C.green, textAlign: 'right' }}>
                {fmt$(totalDebe)}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: C.red, textAlign: 'right' }}>
                {fmt$(totalHaber)}</span>
              <span></span>
            </div>
            {diferencia !== 0 && (
              <div style={{ padding: '6px 10px', background: C.redD, textAlign: 'center',
                fontSize: 11, fontWeight: 700, color: C.red }}>
                Diferencia: {fmt$(Math.abs(diferencia))} -- el asiento debe estar balanceado
              </div>
            )}
          </div>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            background: C.redD, borderRadius: 8, marginBottom: 12,
            border: `1px solid ${C.red}`, color: C.red, fontSize: 12 }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose}
            style={{ padding: '8px 20px', borderRadius: 8, border: `1px solid ${C.border}`,
              background: 'transparent', color: C.muted, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={guardar} disabled={saving || !balanced}
            style={{ padding: '8px 24px', borderRadius: 8, border: 'none',
              background: balanced ? C.blue : C.hint, color: '#fff', fontWeight: 700, fontSize: 13,
              cursor: balanced ? 'pointer' : 'not-allowed', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Guardando...' : 'Guardar Asiento'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalDetalleAsiento({ C, data, onClose }) {
  const detalles = data.detalles || data.lineas || []
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000 }}>
      <div style={{ background: C.surface, borderRadius: 16, padding: 28, width: 700,
        maxHeight: '90vh', overflowY: 'auto',
        border: `1px solid ${C.bord2}`, boxShadow: '0 25px 60px rgba(0,0,0,.7)' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <span style={{ fontSize: 16, fontWeight: 800, color: C.text }}>
              Asiento {data.numero}
            </span>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              {String(data.fecha || '').slice(0, 10)} | {data.tipo}
              {' | '}<BadgeEstado estado={data.estado} />
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            cursor: 'pointer', color: C.hint }}><X size={18} /></button>
        </div>

        <div style={{ background: C.sur2, borderRadius: 10, padding: 14, marginBottom: 14,
          border: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 10, color: C.hint, fontWeight: 600, textTransform: 'uppercase' }}>Descripcion</span>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{data.descripcion}</div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 14 }}>
          <thead>
            <tr style={{ background: C.sur2 }}>
              {['Cuenta', 'Descripcion', 'Debe', 'Haber'].map(h => (
                <th key={h} style={{ padding: '6px 10px', textAlign: 'left',
                  fontWeight: 700, color: C.muted, fontSize: 10, borderBottom: `1px solid ${C.border}` }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {detalles.map((l, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '6px 10px', color: C.blue, fontWeight: 600 }}>
                  {l.cuenta_codigo} - {l.cuenta_nombre}</td>
                <td style={{ padding: '6px 10px', color: C.text }}>{l.descripcion}</td>
                <td style={{ padding: '6px 10px', color: C.green, textAlign: 'right', fontWeight: 700 }}>
                  {parseFloat(l.debe) > 0 ? fmt$(l.debe) : ''}</td>
                <td style={{ padding: '6px 10px', color: C.red, textAlign: 'right', fontWeight: 700 }}>
                  {parseFloat(l.haber) > 0 ? fmt$(l.haber) : ''}</td>
              </tr>
            ))}
            <tr style={{ background: C.sur2 }}>
              <td colSpan={2} style={{ padding: '8px 10px', fontWeight: 700, color: C.muted, textAlign: 'right' }}>
                TOTALES:</td>
              <td style={{ padding: '8px 10px', fontWeight: 800, color: C.green, textAlign: 'right' }}>
                {fmt$(data.total_debe)}</td>
              <td style={{ padding: '8px 10px', fontWeight: 800, color: C.red, textAlign: 'right' }}>
                {fmt$(data.total_haber)}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none',
              background: C.blue, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   Tab 3: Balance de Comprobacion
   ════════════════════════════════════════════════════════════ */
function TabComprobacion({ C, fi }) {
  const today = new Date()
  const yearStart = `${today.getFullYear()}-01-01`
  const [fechaIni, setFechaIni] = useState(yearStart)
  const [fechaFin, setFechaFin] = useState(today.toISOString().slice(0, 10))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  function consultar() {
    setLoading(true)
    api.get('/contabilidad/balance-comprobacion', { params: { fecha_ini: fechaIni, fecha_fin: fechaFin } })
      .then(r => setData(r.data))
      .catch(() => alert('Error al consultar balance de comprobacion'))
      .finally(() => setLoading(false))
  }

  async function exportarExcel() {
    if (!data || !data.cuentas || data.cuentas.length === 0) return
    try {
      const resp = await api.post('/reportes/exportar/excel', {
        titulo: 'Balance de Comprobacion',
        fecha_ini: fechaIni, fecha_fin: fechaFin,
        columnas: [
          { key: 'codigo', label: 'Codigo', width: 14 },
          { key: 'nombre', label: 'Cuenta', width: 30 },
          { key: 'tipo', label: 'Tipo', width: 14 },
          { key: 'total_debe', label: 'Debe', width: 16 },
          { key: 'total_haber', label: 'Haber', width: 16 },
          { key: 'saldo', label: 'Saldo', width: 16 },
        ],
        filas: data.cuentas.map(c => ({
          codigo: c.codigo, nombre: c.nombre, tipo: c.tipo,
          total_debe: parseFloat(c.total_debe), total_haber: parseFloat(c.total_haber),
          saldo: parseFloat(c.saldo),
        })),
        totales: { codigo: 'TOTALES', nombre: '', tipo: '', total_debe: data.total_debe, total_haber: data.total_haber, saldo: data.diferencia },
      }, { responseType: 'blob' })
      downloadBlob(resp.data, 'Balance_Comprobacion.xlsx')
    } catch { alert('Error al exportar') }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={lbl(C)}>Desde</label>
          <input type="date" value={fechaIni} onChange={e => setFechaIni(e.target.value)} style={fi} />
        </div>
        <div>
          <label style={lbl(C)}>Hasta</label>
          <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} style={fi} />
        </div>
        <button onClick={consultar} disabled={loading}
          style={{ padding: '8px 20px', borderRadius: 8, border: 'none',
            background: C.blue, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          {loading ? 'Consultando...' : 'Consultar'}
        </button>
        {data && data.cuentas && data.cuentas.length > 0 && (
          <button onClick={exportarExcel}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px',
              borderRadius: 8, border: `1px solid ${C.green}`,
              background: 'rgba(16,185,129,.1)', color: C.green,
              fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            <Download size={13} /> Excel
          </button>
        )}
      </div>

      {data && (
        <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
          overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.sur2, borderBottom: `1px solid ${C.border}` }}>
                {['Codigo', 'Cuenta', 'Tipo', 'Debe', 'Haber', 'Saldo'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Debe' || h === 'Haber' || h === 'Saldo' ? 'right' : 'left',
                    fontWeight: 700, color: C.muted, fontSize: 11,
                    textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(!data.cuentas || data.cuentas.length === 0) ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: C.hint }}>
                  No hay movimientos en el periodo seleccionado</td></tr>
              ) : data.cuentas.map((c, i) => {
                const tipoInfo = TIPO_BADGE[c.tipo] || { bg: 'rgba(107,114,128,.15)', color: '#6B7280' }
                const saldo = parseFloat(c.saldo)
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}
                    onMouseEnter={e => e.currentTarget.style.background = C.sur2}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: C.blue,
                      fontFamily: 'monospace', fontSize: 12 }}>{c.codigo}</td>
                    <td style={{ padding: '8px 12px', color: C.text }}>{c.nombre}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                        background: tipoInfo.bg, color: tipoInfo.color }}>{c.tipo}</span>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700,
                      color: C.green, fontFamily: 'monospace' }}>{fmt$(c.total_debe)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700,
                      color: C.red, fontFamily: 'monospace' }}>{fmt$(c.total_haber)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800,
                      color: saldo >= 0 ? C.blue : C.red, fontFamily: 'monospace' }}>{fmt$(saldo)}</td>
                  </tr>
                )
              })}
            </tbody>
            {data.cuentas && data.cuentas.length > 0 && (
              <tfoot>
                <tr style={{ background: C.sur2, borderTop: `2px solid ${C.border}` }}>
                  <td colSpan={3} style={{ padding: '10px 12px', fontWeight: 800, color: C.text, fontSize: 13 }}>
                    TOTALES</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800,
                    color: C.green, fontFamily: 'monospace', fontSize: 13 }}>{fmt$(data.total_debe)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800,
                    color: C.red, fontFamily: 'monospace', fontSize: 13 }}>{fmt$(data.total_haber)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800,
                    fontFamily: 'monospace', fontSize: 13,
                    color: Math.abs(data.diferencia) < 0.01 ? C.green : C.red }}>{fmt$(data.diferencia)}</td>
                </tr>
                <tr>
                  <td colSpan={6} style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 800,
                      color: data.cuadrado ? C.green : C.red }}>
                      {data.cuadrado ? 'CUADRADO' : 'DESCUADRADO'}{' '}
                      {data.cuadrado ? '(OK)' : `(Diferencia: ${fmt$(data.diferencia)})`}
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {!data && !loading && (
        <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
          padding: 40, textAlign: 'center', color: C.hint, fontSize: 13 }}>
          Seleccione un periodo y presione "Consultar" para ver el Balance de Comprobacion
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   Tab 4: Balance General
   ════════════════════════════════════════════════════════════ */
function TabBalance({ C, fi }) {
  const [fechaCorte, setFechaCorte] = useState(new Date().toISOString().slice(0, 10))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  function consultar() {
    setLoading(true)
    api.get('/contabilidad/balance-general', { params: { fecha_corte: fechaCorte } })
      .then(r => setData(r.data))
      .catch(() => alert('Error al consultar balance'))
      .finally(() => setLoading(false))
  }

  async function exportarExcel() {
    if (!data) return
    const allRows = []
    const addSection = (title, accounts) => {
      if (!accounts || accounts.length === 0) return
      allRows.push({ codigo: '', nombre: title, saldo: '' })
      accounts.forEach(a => allRows.push({ codigo: a.codigo, nombre: a.nombre, saldo: parseFloat(a.saldo) }))
    }
    addSection('--- ACTIVOS ---', data.activos)
    addSection('--- PASIVOS ---', data.pasivos)
    addSection('--- PATRIMONIO ---', data.patrimonio)

    try {
      const resp = await api.post('/reportes/exportar/excel', {
        titulo: `Balance General al ${fechaCorte}`,
        columnas: [
          { key: 'codigo', label: 'Codigo', width: 14 },
          { key: 'nombre', label: 'Cuenta', width: 35 },
          { key: 'saldo', label: 'Saldo', width: 18 },
        ],
        filas: allRows,
        resumen: {
          'Total Activo': fmt$(data.total_activo),
          'Total Pasivo + Patrimonio': fmt$(data.total_pasivo_patrimonio),
        },
      }, { responseType: 'blob' })
      downloadBlob(resp.data, 'Balance_General.xlsx')
    } catch { alert('Error al exportar') }
  }

  function renderSection(title, accounts, color) {
    if (!accounts || accounts.length === 0) return null
    const total = accounts.reduce((s, a) => s + (parseFloat(a.saldo) || 0), 0)
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color, marginBottom: 8, padding: '6px 12px',
          background: `${color}15`, borderRadius: 8, border: `1px solid ${color}30` }}>
          {title}
        </div>
        {accounts.map((a, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 12px 5px ' + ((a.nivel || 1) * 16) + 'px',
            borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
            <span style={{ color: C.text, fontWeight: a.nivel <= 2 ? 700 : 400 }}>
              <span style={{ color: C.muted, fontFamily: 'monospace', marginRight: 8, fontSize: 11 }}>{a.codigo}</span>
              {a.nombre}
            </span>
            <span style={{ fontWeight: 700, color, fontFamily: 'monospace' }}>{fmt$(a.saldo)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px',
          fontWeight: 800, fontSize: 13, color, background: `${color}10`, borderRadius: '0 0 8px 8px' }}>
          <span>Total {title}</span>
          <span>{fmt$(total)}</span>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={lbl(C)}>Fecha de corte</label>
          <input type="date" value={fechaCorte} onChange={e => setFechaCorte(e.target.value)}
            style={fi} />
        </div>
        <button onClick={consultar} disabled={loading}
          style={{ padding: '8px 20px', borderRadius: 8, border: 'none',
            background: C.blue, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          {loading ? 'Consultando...' : 'Consultar'}
        </button>
        {data && (
          <button onClick={exportarExcel}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px',
              borderRadius: 8, border: `1px solid ${C.green}`,
              background: 'rgba(16,185,129,.1)', color: C.green,
              fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            <Download size={13} /> Exportar Excel
          </button>
        )}
      </div>

      {data && (
        <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
          padding: 20 }}>
          {renderSection('ACTIVO', data.activos, C.blue)}
          {renderSection('PASIVO', data.pasivos, C.red)}
          {renderSection('PATRIMONIO', data.patrimonio, C.purple)}

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px',
            background: C.sur2, borderRadius: 10, border: `1px solid ${C.border}`, marginTop: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 10, color: C.muted, display: 'block' }}>TOTAL ACTIVO</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: C.blue }}>{fmt$(data.total_activo)}</span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 10, color: C.muted, display: 'block' }}>TOTAL PASIVO + PATRIMONIO</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: C.purple }}>{fmt$(data.total_pasivo_patrimonio)}</span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 10, color: C.muted, display: 'block' }}>DIFERENCIA</span>
              <span style={{ fontSize: 16, fontWeight: 800,
                color: Math.abs(data.diferencia || 0) < 0.01 ? C.green : C.red }}>
                {fmt$(data.diferencia)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   Tab 5: Estado de Resultados
   ════════════════════════════════════════════════════════════ */
function TabResultados({ C, fi }) {
  const today = new Date()
  const yearStart = `${today.getFullYear()}-01-01`
  const [fechaIni, setFechaIni] = useState(yearStart)
  const [fechaFin, setFechaFin] = useState(today.toISOString().slice(0, 10))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  function consultar() {
    setLoading(true)
    api.get('/contabilidad/estado-resultados', { params: { fecha_ini: fechaIni, fecha_fin: fechaFin } })
      .then(r => setData(r.data))
      .catch(() => alert('Error al consultar'))
      .finally(() => setLoading(false))
  }

  async function exportarExcel() {
    if (!data) return
    const allRows = []
    const addSection = (title, accounts) => {
      if (!accounts || accounts.length === 0) return
      allRows.push({ codigo: '', nombre: title, saldo: '' })
      accounts.forEach(a => allRows.push({ codigo: a.codigo, nombre: a.nombre, saldo: parseFloat(a.saldo) }))
    }
    addSection('--- INGRESOS ---', data.ingresos)
    addSection('--- COSTOS ---', data.costos)
    addSection('--- GASTOS ---', data.gastos)

    try {
      const resp = await api.post('/reportes/exportar/excel', {
        titulo: `Estado de Resultados ${fechaIni} al ${fechaFin}`,
        fecha_ini: fechaIni, fecha_fin: fechaFin,
        columnas: [
          { key: 'codigo', label: 'Codigo', width: 14 },
          { key: 'nombre', label: 'Cuenta', width: 35 },
          { key: 'saldo', label: 'Monto', width: 18 },
        ],
        filas: allRows,
        resumen: {
          'Total Ingresos': fmt$(data.total_ingresos),
          'Total Costos': fmt$(data.total_costos),
          'Total Gastos': fmt$(data.total_gastos),
          'Utilidad Bruta': fmt$(data.utilidad_bruta),
          'Utilidad Neta': fmt$(data.utilidad_neta),
        },
      }, { responseType: 'blob' })
      downloadBlob(resp.data, 'Estado_Resultados.xlsx')
    } catch { alert('Error al exportar') }
  }

  function renderSection(title, accounts, color) {
    if (!accounts || accounts.length === 0) return null
    const total = accounts.reduce((s, a) => s + (parseFloat(a.saldo) || 0), 0)
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color, marginBottom: 8, padding: '6px 12px',
          background: `${color}15`, borderRadius: 8, border: `1px solid ${color}30` }}>
          {title}
        </div>
        {accounts.map((a, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 12px 5px ' + ((a.nivel || 1) * 16) + 'px',
            borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
            <span style={{ color: C.text }}>
              <span style={{ color: C.muted, fontFamily: 'monospace', marginRight: 8, fontSize: 11 }}>{a.codigo}</span>
              {a.nombre}
            </span>
            <span style={{ fontWeight: 700, color, fontFamily: 'monospace' }}>{fmt$(a.saldo)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px',
          fontWeight: 800, fontSize: 13, color }}>
          <span>Total {title}</span>
          <span>{fmt$(total)}</span>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={lbl(C)}>Desde</label>
          <input type="date" value={fechaIni} onChange={e => setFechaIni(e.target.value)} style={fi} />
        </div>
        <div>
          <label style={lbl(C)}>Hasta</label>
          <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} style={fi} />
        </div>
        <button onClick={consultar} disabled={loading}
          style={{ padding: '8px 20px', borderRadius: 8, border: 'none',
            background: C.blue, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          {loading ? 'Consultando...' : 'Consultar'}
        </button>
        {data && (
          <button onClick={exportarExcel}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px',
              borderRadius: 8, border: `1px solid ${C.green}`,
              background: 'rgba(16,185,129,.1)', color: C.green,
              fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            <Download size={13} /> Exportar Excel
          </button>
        )}
      </div>

      {data && (
        <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
          padding: 20 }}>
          {renderSection('INGRESOS', data.ingresos, C.green)}
          {renderSection('COSTOS', data.costos, C.amber)}
          {renderSection('GASTOS', data.gastos, C.red)}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <div style={{ background: C.sur2, borderRadius: 10, padding: '12px 24px',
              border: `1px solid ${C.border}`, textAlign: 'right' }}>
              <div style={{ display: 'flex', gap: 24, marginBottom: 8 }}>
                <div>
                  <span style={{ fontSize: 10, color: C.muted, display: 'block' }}>UTILIDAD BRUTA</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{fmt$(data.utilidad_bruta)}</span>
                </div>
                <div>
                  <span style={{ fontSize: 10, color: C.muted, display: 'block' }}>TOTAL GASTOS</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.red }}>{fmt$(data.total_gastos)}</span>
                </div>
              </div>
              <span style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>
                {(data.utilidad_neta || 0) >= 0 ? 'UTILIDAD DEL PERIODO' : 'PERDIDA DEL PERIODO'}
              </span>
              <span style={{ fontSize: 22, fontWeight: 800,
                color: (data.utilidad_neta || 0) >= 0 ? C.green : C.red }}>
                {fmt$(data.utilidad_neta)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   Tab 6: Libro Diario
   ════════════════════════════════════════════════════════════ */
function TabDiario({ C, fi }) {
  const today = new Date()
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const [fechaIni, setFechaIni] = useState(monthStart)
  const [fechaFin, setFechaFin] = useState(today.toISOString().slice(0, 10))
  const [asientos, setAsientos] = useState([])
  const [loading, setLoading] = useState(false)

  function consultar() {
    setLoading(true)
    api.get('/contabilidad/libro-diario', { params: { fecha_ini: fechaIni, fecha_fin: fechaFin } })
      .then(r => setAsientos(r.data?.asientos || []))
      .catch(() => alert('Error al consultar'))
      .finally(() => setLoading(false))
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-end' }}>
        <div>
          <label style={lbl(C)}>Desde</label>
          <input type="date" value={fechaIni} onChange={e => setFechaIni(e.target.value)} style={fi} />
        </div>
        <div>
          <label style={lbl(C)}>Hasta</label>
          <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} style={fi} />
        </div>
        <button onClick={consultar} disabled={loading}
          style={{ padding: '8px 20px', borderRadius: 8, border: 'none',
            background: C.blue, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          {loading ? 'Consultando...' : 'Consultar'}
        </button>
      </div>

      {asientos.length > 0 && (
        <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
          overflow: 'auto' }}>
          {asientos.map((asiento, ai) => (
            <div key={ai} style={{ borderBottom: `2px solid ${C.bord2}` }}>
              {/* Asiento header */}
              <div style={{ background: C.sur2, padding: '10px 14px', display: 'flex',
                justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 700, color: C.blue, fontSize: 13, marginRight: 12 }}>
                    {asiento.numero}
                  </span>
                  <span style={{ color: C.text, fontSize: 12 }}>{asiento.descripcion}</span>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: C.muted }}>
                    {String(asiento.fecha || '').slice(0, 10)}
                  </span>
                  <span style={{ fontSize: 10, color: C.hint, background: C.sur3 || C.sur2,
                    padding: '2px 8px', borderRadius: 4 }}>{asiento.tipo}</span>
                </div>
              </div>
              {/* Lineas */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    {['Cuenta', 'Descripcion', 'Debe', 'Haber'].map(h => (
                      <th key={h} style={{ padding: '6px 14px', textAlign: 'left',
                        fontWeight: 700, color: C.hint, fontSize: 10, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(asiento.detalles || []).map((l, li) => (
                    <tr key={li} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '5px 14px', color: C.blue, fontWeight: 600 }}>
                        {l.cuenta_codigo} - {l.cuenta_nombre}</td>
                      <td style={{ padding: '5px 14px', color: C.text }}>{l.descripcion}</td>
                      <td style={{ padding: '5px 14px', color: C.green, textAlign: 'right', fontWeight: 700 }}>
                        {parseFloat(l.debe) > 0 ? fmt$(l.debe) : ''}</td>
                      <td style={{ padding: '5px 14px', color: C.red, textAlign: 'right', fontWeight: 700 }}>
                        {parseFloat(l.haber) > 0 ? fmt$(l.haber) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {!loading && asientos.length === 0 && (
        <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
          padding: 40, textAlign: 'center', color: C.hint, fontSize: 13 }}>
          Presione "Consultar" para ver el libro diario del periodo
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   Tab 7: Libro Mayor
   ════════════════════════════════════════════════════════════ */
function TabMayor({ C, fi }) {
  const today = new Date()
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const [cuentas, setCuentas] = useState([])
  const [cuentaId, setCuentaId] = useState('')
  const [fechaIni, setFechaIni] = useState(monthStart)
  const [fechaFin, setFechaFin] = useState(today.toISOString().slice(0, 10))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/contabilidad/plan-cuentas')
      .then(r => setCuentas(r.data || []))
      .catch(() => {})
  }, [])

  function consultar() {
    if (!cuentaId) return alert('Seleccione una cuenta')
    setLoading(true)
    api.get('/contabilidad/libro-mayor', {
      params: { cuenta_id: cuentaId, fecha_ini: fechaIni, fecha_fin: fechaFin }
    })
      .then(r => setData(r.data || null))
      .catch(() => alert('Error al consultar'))
      .finally(() => setLoading(false))
  }

  const movimientos = data?.movimientos || []

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 280 }}>
          <label style={lbl(C)}>Cuenta</label>
          <select value={cuentaId} onChange={e => setCuentaId(e.target.value)}
            style={{ ...fi, width: '100%' }}>
            <option value="">-- Seleccione cuenta --</option>
            {cuentas.map(c => (
              <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl(C)}>Desde</label>
          <input type="date" value={fechaIni} onChange={e => setFechaIni(e.target.value)} style={fi} />
        </div>
        <div>
          <label style={lbl(C)}>Hasta</label>
          <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} style={fi} />
        </div>
        <button onClick={consultar} disabled={loading}
          style={{ padding: '8px 20px', borderRadius: 8, border: 'none',
            background: C.blue, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          {loading ? 'Consultando...' : 'Consultar'}
        </button>
      </div>

      {data && (
        <div>
          {/* Account header */}
          <div style={{ background: C.sur2, borderRadius: 10, padding: '10px 16px',
            marginBottom: 12, border: `1px solid ${C.border}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontWeight: 700, color: C.blue, fontSize: 13 }}>
                {data.cuenta?.codigo} - {data.cuenta?.nombre}
              </span>
              <span style={{ fontSize: 11, color: C.muted, marginLeft: 12 }}>
                {data.cuenta?.tipo} | {data.cuenta?.naturaleza}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
              <span style={{ color: C.muted }}>Saldo Inicial: <b style={{ color: C.text }}>{fmt$(data.saldo_inicial)}</b></span>
              <span style={{ color: C.muted }}>Saldo Final: <b style={{ color: C.blue }}>{fmt$(data.saldo_final)}</b></span>
            </div>
          </div>

          <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
            overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: C.sur2, borderBottom: `1px solid ${C.border}` }}>
                  {['Fecha', 'Asiento', 'Descripcion', 'Debe', 'Haber', 'Saldo'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left',
                      fontWeight: 700, color: C.muted, fontSize: 11,
                      textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {movimientos.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center', color: C.hint }}>
                    Sin movimientos en el periodo</td></tr>
                ) : movimientos.map((m, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}
                    onMouseEnter={e => e.currentTarget.style.background = C.sur2}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '8px 12px', color: C.text }}>
                      {String(m.fecha || '').slice(0, 10)}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: C.blue }}>
                      {m.asiento_numero}</td>
                    <td style={{ padding: '8px 12px', color: C.text, maxWidth: 240,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.descripcion}</td>
                    <td style={{ padding: '8px 12px', color: C.green, textAlign: 'right', fontWeight: 700 }}>
                      {parseFloat(m.debe) > 0 ? fmt$(m.debe) : ''}</td>
                    <td style={{ padding: '8px 12px', color: C.red, textAlign: 'right', fontWeight: 700 }}>
                      {parseFloat(m.haber) > 0 ? fmt$(m.haber) : ''}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 800, color: C.text, textAlign: 'right',
                      fontFamily: 'monospace' }}>
                      {fmt$(m.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !data && (
        <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
          padding: 40, textAlign: 'center', color: C.hint, fontSize: 13 }}>
          Seleccione una cuenta y presione "Consultar" para ver el libro mayor
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   Tab 8: Centros de Costo
   ════════════════════════════════════════════════════════════ */
function TabCentrosCosto({ C, fi }) {
  const today = new Date()
  const yearStart = `${today.getFullYear()}-01-01`
  const [centros, setCentros] = useState([])
  const [loading, setLoading] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState(false)
  const [fechaIni, setFechaIni] = useState(yearStart)
  const [fechaFin, setFechaFin] = useState(today.toISOString().slice(0, 10))
  const [centroId, setCentroId] = useState('')
  const [reporte, setReporte] = useState(null)
  const [loadingRep, setLoadingRep] = useState(false)

  const cargar = useCallback(() => {
    setLoading(true)
    api.get('/contabilidad/centros-costo')
      .then(r => setCentros(r.data || []))
      .catch(() => setCentros([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function crear() {
    if (!codigo || !nombre) return alert('Codigo y nombre son requeridos')
    setSaving(true)
    try {
      await api.post(`/contabilidad/centros-costo?codigo=${encodeURIComponent(codigo)}&nombre=${encodeURIComponent(nombre)}`)
      setCodigo(''); setNombre('')
      cargar()
    } catch (e) {
      alert(e.response?.data?.detail || 'Error al crear')
    } finally { setSaving(false) }
  }

  function consultarReporte() {
    setLoadingRep(true)
    const params = { fecha_ini: fechaIni, fecha_fin: fechaFin }
    if (centroId) params.centro_id = centroId
    api.get('/contabilidad/reporte-centro-costo', { params })
      .then(r => setReporte(r.data))
      .catch(() => alert('Error al consultar reporte'))
      .finally(() => setLoadingRep(false))
  }

  return (
    <div>
      {/* Create form */}
      <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
        padding: 16, marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10, display: 'block' }}>
          Nuevo Centro de Costo</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={lbl(C)}>Codigo</label>
            <input value={codigo} onChange={e => setCodigo(e.target.value)}
              placeholder="CC-001" style={{ ...fi, width: 120 }} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={lbl(C)}>Nombre</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder="Nombre del centro de costo" style={{ ...fi, width: '100%' }} />
          </div>
          <button onClick={crear} disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              borderRadius: 8, border: 'none', background: C.blue, color: '#fff',
              fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            <Plus size={14} /> {saving ? 'Creando...' : 'Crear'}
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
        overflow: 'auto', marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: C.sur2, borderBottom: `1px solid ${C.border}` }}>
              {['Codigo', 'Nombre', 'Estado'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left',
                  fontWeight: 700, color: C.muted, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} style={{ padding: 30, textAlign: 'center', color: C.hint }}>Cargando...</td></tr>
            ) : centros.length === 0 ? (
              <tr><td colSpan={3} style={{ padding: 30, textAlign: 'center', color: C.hint }}>No hay centros de costo</td></tr>
            ) : centros.map(cc => (
              <tr key={cc.id} style={{ borderBottom: `1px solid ${C.border}` }}
                onMouseEnter={e => e.currentTarget.style.background = C.sur2}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '8px 12px', fontWeight: 600, color: C.blue, fontFamily: 'monospace' }}>{cc.codigo}</td>
                <td style={{ padding: '8px 12px', color: C.text }}>{cc.nombre}</td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                    background: 'rgba(16,185,129,.15)', color: '#10B981' }}>ACTIVO</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Report */}
      <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10, display: 'block' }}>
          Reporte por Centro de Costo</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <label style={lbl(C)}>Desde</label>
            <input type="date" value={fechaIni} onChange={e => setFechaIni(e.target.value)} style={fi} />
          </div>
          <div>
            <label style={lbl(C)}>Hasta</label>
            <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} style={fi} />
          </div>
          <div>
            <label style={lbl(C)}>Centro (opcional)</label>
            <select value={centroId} onChange={e => setCentroId(e.target.value)} style={fi}>
              <option value="">-- Todos --</option>
              {centros.map(cc => <option key={cc.id} value={cc.id}>{cc.codigo} - {cc.nombre}</option>)}
            </select>
          </div>
          <button onClick={consultarReporte} disabled={loadingRep}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none',
              background: C.blue, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            {loadingRep ? 'Consultando...' : 'Consultar'}
          </button>
        </div>

        {reporte && reporte.centros && reporte.centros.map((centro, ci) => (
          <div key={ci} style={{ marginBottom: 16, borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <div style={{ background: C.sur2, padding: '10px 14px', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: C.blue, fontSize: 13 }}>
                {centro.codigo} - {centro.nombre}
              </span>
              <span style={{ fontSize: 12, color: C.muted }}>
                Debe: <b style={{ color: C.green }}>{fmt$(centro.total_debe)}</b>
                {' | '}Haber: <b style={{ color: C.red }}>{fmt$(centro.total_haber)}</b>
              </span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Cuenta', 'Nombre', 'Debe', 'Haber'].map(h => (
                    <th key={h} style={{ padding: '6px 12px', textAlign: h === 'Debe' || h === 'Haber' ? 'right' : 'left',
                      fontWeight: 700, color: C.hint, fontSize: 10 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {centro.cuentas.map((cu, cui) => (
                  <tr key={cui} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '5px 12px', color: C.blue, fontFamily: 'monospace', fontWeight: 600 }}>{cu.cuenta_codigo}</td>
                    <td style={{ padding: '5px 12px', color: C.text }}>{cu.cuenta_nombre}</td>
                    <td style={{ padding: '5px 12px', textAlign: 'right', color: C.green, fontWeight: 700 }}>{fmt$(cu.total_debe)}</td>
                    <td style={{ padding: '5px 12px', textAlign: 'right', color: C.red, fontWeight: 700 }}>{fmt$(cu.total_haber)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   Tab 9: Auxiliares (CXC, CXP, Bancos)
   ════════════════════════════════════════════════════════════ */
function TabAuxiliares({ C, fi }) {
  const [subTab, setSubTab] = useState('cxc')
  const [fechaCorte, setFechaCorte] = useState(new Date().toISOString().slice(0, 10))
  const [dataCxc, setDataCxc] = useState(null)
  const [dataCxp, setDataCxp] = useState(null)
  const [dataBancos, setDataBancos] = useState(null)
  const [loading, setLoading] = useState(false)

  function consultar() {
    setLoading(true)
    const endpoint = subTab === 'cxc' ? 'auxiliar-cxc'
      : subTab === 'cxp' ? 'auxiliar-cxp' : 'auxiliar-bancos'
    api.get(`/contabilidad/${endpoint}`, { params: { fecha_corte: fechaCorte } })
      .then(r => {
        if (subTab === 'cxc') setDataCxc(r.data)
        else if (subTab === 'cxp') setDataCxp(r.data)
        else setDataBancos(r.data)
      })
      .catch(() => alert('Error al consultar auxiliar'))
      .finally(() => setLoading(false))
  }

  const subTabs = [
    { key: 'cxc', label: 'Cuentas por Cobrar' },
    { key: 'cxp', label: 'Cuentas por Pagar' },
    { key: 'bancos', label: 'Bancos' },
  ]

  function BadgeConciliado({ conciliado }) {
    return (
      <span style={{ fontSize: 12, fontWeight: 800, padding: '4px 14px', borderRadius: 8,
        background: conciliado ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)',
        color: conciliado ? '#10B981' : '#EF4444',
        border: `1px solid ${conciliado ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)'}` }}>
        {conciliado ? 'CONCILIADO' : 'DIFERENCIA'}
      </span>
    )
  }

  function renderResumen(data) {
    if (!data) return null
    return (
      <div style={{ display: 'flex', gap: 16, padding: '14px 16px', background: C.sur2,
        borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 16,
        alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 10, color: C.muted, display: 'block', textTransform: 'uppercase' }}>Saldo Operativo</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: C.blue }}>{fmt$(data.total_operativo)}</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 10, color: C.muted, display: 'block', textTransform: 'uppercase' }}>Saldo Contable</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: C.purple || '#8B5CF6' }}>{fmt$(data.total_contable)}</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 10, color: C.muted, display: 'block', textTransform: 'uppercase' }}>Diferencia</span>
          <span style={{ fontSize: 18, fontWeight: 800,
            color: Math.abs(data.diferencia) < 0.01 ? C.green : C.red }}>{fmt$(data.diferencia)}</span>
        </div>
        <BadgeConciliado conciliado={data.conciliado} />
      </div>
    )
  }

  const currentData = subTab === 'cxc' ? dataCxc : subTab === 'cxp' ? dataCxp : dataBancos

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {subTabs.map(st => (
          <button key={st.key} onClick={() => setSubTab(st.key)}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none',
              fontWeight: 700, fontSize: 12, cursor: 'pointer',
              background: subTab === st.key ? C.blue : C.sur2,
              color: subTab === st.key ? '#fff' : C.muted }}>
            {st.label}
          </button>
        ))}
      </div>

      {/* Date + consult */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-end' }}>
        <div>
          <label style={lbl(C)}>Fecha de corte</label>
          <input type="date" value={fechaCorte} onChange={e => setFechaCorte(e.target.value)} style={fi} />
        </div>
        <button onClick={consultar} disabled={loading}
          style={{ padding: '8px 20px', borderRadius: 8, border: 'none',
            background: C.blue, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          {loading ? 'Consultando...' : 'Consultar'}
        </button>
      </div>

      {renderResumen(currentData)}

      {/* CXC detail */}
      {subTab === 'cxc' && dataCxc && dataCxc.clientes && (
        <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.sur2, borderBottom: `1px solid ${C.border}` }}>
                {['Cliente', 'Identificacion', 'Saldo Operativo'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Saldo Operativo' ? 'right' : 'left',
                    fontWeight: 700, color: C.muted, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataCxc.clientes.length === 0 ? (
                <tr><td colSpan={3} style={{ padding: 30, textAlign: 'center', color: C.hint }}>Sin saldos pendientes</td></tr>
              ) : dataCxc.clientes.map((cl, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}
                  onMouseEnter={e => e.currentTarget.style.background = C.sur2}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '8px 12px', color: C.text, fontWeight: 600 }}>{cl.razon_social}</td>
                  <td style={{ padding: '8px 12px', color: C.muted, fontFamily: 'monospace' }}>{cl.identificacion}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: C.blue, fontFamily: 'monospace' }}>
                    {fmt$(cl.saldo_operativo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CXP detail */}
      {subTab === 'cxp' && dataCxp && dataCxp.proveedores && (
        <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.sur2, borderBottom: `1px solid ${C.border}` }}>
                {['Proveedor', 'Identificacion', 'Saldo Operativo'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Saldo Operativo' ? 'right' : 'left',
                    fontWeight: 700, color: C.muted, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataCxp.proveedores.length === 0 ? (
                <tr><td colSpan={3} style={{ padding: 30, textAlign: 'center', color: C.hint }}>Sin saldos pendientes</td></tr>
              ) : dataCxp.proveedores.map((pr, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}
                  onMouseEnter={e => e.currentTarget.style.background = C.sur2}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '8px 12px', color: C.text, fontWeight: 600 }}>{pr.razon_social}</td>
                  <td style={{ padding: '8px 12px', color: C.muted, fontFamily: 'monospace' }}>{pr.identificacion}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: C.blue, fontFamily: 'monospace' }}>
                    {fmt$(pr.saldo_operativo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bancos detail */}
      {subTab === 'bancos' && dataBancos && dataBancos.cuentas && (
        <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.sur2, borderBottom: `1px solid ${C.border}` }}>
                {['Banco', 'Cuenta', 'Numero', 'Saldo Operativo'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Saldo Operativo' ? 'right' : 'left',
                    fontWeight: 700, color: C.muted, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataBancos.cuentas.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 30, textAlign: 'center', color: C.hint }}>Sin cuentas bancarias</td></tr>
              ) : dataBancos.cuentas.map((cb, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}
                  onMouseEnter={e => e.currentTarget.style.background = C.sur2}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '8px 12px', color: C.text, fontWeight: 600 }}>{cb.banco || '-'}</td>
                  <td style={{ padding: '8px 12px', color: C.blue }}>{cb.nombre}</td>
                  <td style={{ padding: '8px 12px', color: C.muted, fontFamily: 'monospace' }}>{cb.numero}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: C.blue, fontFamily: 'monospace' }}>
                    {fmt$(cb.saldo_operativo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!currentData && !loading && (
        <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
          padding: 40, textAlign: 'center', color: C.hint, fontSize: 13 }}>
          Seleccione fecha de corte y presione "Consultar"
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   Tab 10: Presupuesto
   ════════════════════════════════════════════════════════════ */
function TabPresupuesto({ C, fi }) {
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [editMontos, setEditMontos] = useState({})
  const [cuentas, setCuentas] = useState([])
  const [cuentaId, setCuentaId] = useState('')
  const [saving, setSaving] = useState(false)

  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

  useEffect(() => {
    api.get('/contabilidad/plan-cuentas')
      .then(r => setCuentas((r.data || []).filter(c => c.es_movimiento)))
      .catch(() => {})
  }, [])

  function consultar() {
    setLoading(true)
    api.get('/contabilidad/presupuesto', { params: { anio } })
      .then(r => setData(r.data))
      .catch(() => alert('Error al consultar presupuesto'))
      .finally(() => setLoading(false))
  }

  function startEdit(pres) {
    setEditRow(pres.cuenta_id)
    const montos = {}
    for (let i = 1; i <= 12; i++) {
      const k = `mes_${String(i).padStart(2, '0')}`
      montos[k] = parseFloat(pres[k]) || 0
    }
    setEditMontos(montos)
  }

  function startNew() {
    if (!cuentaId) return alert('Seleccione una cuenta')
    setEditRow(parseInt(cuentaId))
    const montos = {}
    for (let i = 1; i <= 12; i++) montos[`mes_${String(i).padStart(2, '0')}`] = 0
    setEditMontos(montos)
    setEditMode(true)
  }

  async function guardar() {
    setSaving(true)
    try {
      await api.post(`/contabilidad/presupuesto?anio=${anio}&cuenta_id=${editRow}`, { montos: editMontos })
      setEditRow(null); setEditMode(false)
      consultar()
    } catch (e) {
      alert(e.response?.data?.detail || 'Error al guardar')
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={lbl(C)}>Anio</label>
          <input type="number" value={anio} onChange={e => setAnio(parseInt(e.target.value) || new Date().getFullYear())}
            min={2020} max={2030} style={{ ...fi, width: 100 }} />
        </div>
        <button onClick={consultar} disabled={loading}
          style={{ padding: '8px 20px', borderRadius: 8, border: 'none',
            background: C.blue, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          {loading ? 'Consultando...' : 'Consultar'}
        </button>
        <button onClick={() => setEditMode(!editMode)}
          style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${C.blue}`,
            background: editMode ? C.blue : 'transparent', color: editMode ? '#fff' : C.blue,
            fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
          {editMode ? 'Modo Vista' : 'Modo Edicion'}
        </button>
        {editMode && (
          <>
            <div style={{ minWidth: 220 }}>
              <label style={lbl(C)}>Agregar Cuenta</label>
              <select value={cuentaId} onChange={e => setCuentaId(e.target.value)} style={{ ...fi, width: '100%' }}>
                <option value="">-- Cuenta --</option>
                {cuentas.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>)}
              </select>
            </div>
            <button onClick={startNew}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                borderRadius: 8, border: 'none', background: C.green, color: '#fff',
                fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              <Plus size={14} /> Agregar
            </button>
          </>
        )}
      </div>

      {data && data.presupuestos && (
        <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
          overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 1200 }}>
            <thead>
              <tr style={{ background: C.sur2, borderBottom: `1px solid ${C.border}` }}>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: C.muted,
                  fontSize: 10, textTransform: 'uppercase', position: 'sticky', left: 0,
                  background: C.sur2, zIndex: 1, minWidth: 180 }}>Cuenta</th>
                {MESES.map((m, i) => (
                  <th key={i} colSpan={1} style={{ padding: '8px 4px', textAlign: 'center',
                    fontWeight: 700, color: C.muted, fontSize: 10, textTransform: 'uppercase',
                    minWidth: 130 }}>
                    <div>{m}</div>
                    <div style={{ display: 'flex', gap: 2, justifyContent: 'center', fontSize: 8, marginTop: 2 }}>
                      <span style={{ color: C.blue }}>Pres</span>
                      <span>|</span>
                      <span style={{ color: C.green }}>Real</span>
                    </div>
                  </th>
                ))}
                <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: C.muted,
                  fontSize: 10, textTransform: 'uppercase', minWidth: 60 }}>Acc</th>
              </tr>
            </thead>
            <tbody>
              {data.presupuestos.length === 0 ? (
                <tr><td colSpan={14} style={{ padding: 30, textAlign: 'center', color: C.hint }}>
                  No hay presupuestos para este anio. Use "Modo Edicion" para agregar.</td></tr>
              ) : data.presupuestos.map((p, pi) => {
                const isEditing = editRow === p.cuenta_id
                return (
                  <tr key={pi} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '6px 10px', fontWeight: 600, color: C.text, fontSize: 11,
                      position: 'sticky', left: 0, background: C.surface, zIndex: 1,
                      borderRight: `1px solid ${C.border}` }}>
                      <span style={{ color: C.blue, fontFamily: 'monospace', marginRight: 4, fontSize: 10 }}>{p.cuenta_codigo}</span>
                      {p.cuenta_nombre}
                    </td>
                    {MESES.map((_, mi) => {
                      const mk = `mes_${String(mi + 1).padStart(2, '0')}`
                      const rk = `real_${String(mi + 1).padStart(2, '0')}`
                      const pres = parseFloat(isEditing ? (editMontos[mk] || 0) : (p[mk] || 0))
                      const real = parseFloat(p[rk] || 0)
                      const overBudget = pres > 0 && Math.abs(real) > pres
                      return (
                        <td key={mi} style={{ padding: '4px 4px', textAlign: 'center', fontSize: 10 }}>
                          {isEditing ? (
                            <input type="number" step="0.01"
                              value={editMontos[mk] || ''}
                              onChange={e => setEditMontos(prev => ({ ...prev, [mk]: e.target.value }))}
                              style={{ ...fi, width: 60, padding: '3px 4px', fontSize: 10, textAlign: 'right' }} />
                          ) : (
                            <span style={{ color: C.blue, fontWeight: 600 }}>{pres > 0 ? fmt$(pres) : '-'}</span>
                          )}
                          <div style={{ color: overBudget ? '#EF4444' : C.green, fontWeight: 700,
                            background: overBudget ? 'rgba(239,68,68,.1)' : 'transparent',
                            borderRadius: 4, padding: '1px 2px', marginTop: 1 }}>
                            {real !== 0 ? fmt$(real) : '-'}
                          </div>
                        </td>
                      )
                    })}
                    <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button onClick={guardar} disabled={saving}
                            style={{ ...btnIcon(C), color: C.green }}><Check size={12} /></button>
                          <button onClick={() => { setEditRow(null); setEditMode(false) }}
                            style={btnIcon(C)}><X size={12} /></button>
                        </div>
                      ) : editMode ? (
                        <button onClick={() => startEdit(p)} style={btnIcon(C)} title="Editar">
                          <FileText size={12} />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!data && !loading && (
        <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
          padding: 40, textAlign: 'center', color: C.hint, fontSize: 13 }}>
          Seleccione un anio y presione "Consultar" para ver el presupuesto
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   Tab 11: Conciliacion de Modulos
   ════════════════════════════════════════════════════════════ */
function TabConciliacion({ C, fi }) {
  const [fechaCorte, setFechaCorte] = useState(new Date().toISOString().slice(0, 10))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  function consultar() {
    setLoading(true)
    api.get('/contabilidad/conciliacion-modulos', { params: { fecha_corte: fechaCorte } })
      .then(r => setData(r.data))
      .catch(() => alert('Error al consultar conciliacion'))
      .finally(() => setLoading(false))
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-end' }}>
        <div>
          <label style={lbl(C)}>Fecha de corte</label>
          <input type="date" value={fechaCorte} onChange={e => setFechaCorte(e.target.value)} style={fi} />
        </div>
        <button onClick={consultar} disabled={loading}
          style={{ padding: '8px 20px', borderRadius: 8, border: 'none',
            background: C.blue, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          {loading ? 'Consultando...' : 'Consultar'}
        </button>
      </div>

      {data && data.modulos && (
        <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
          overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.sur2, borderBottom: `1px solid ${C.border}` }}>
                {['Modulo', 'Cuenta', 'Saldo Operativo', 'Saldo Contable', 'Diferencia', 'Estado'].map(h => (
                  <th key={h} style={{ padding: '12px 14px',
                    textAlign: ['Saldo Operativo', 'Saldo Contable', 'Diferencia'].includes(h) ? 'right' : 'left',
                    fontWeight: 700, color: C.muted, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.modulos.map((m, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}
                  onMouseEnter={e => e.currentTarget.style.background = C.sur2}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: C.text, fontSize: 13 }}>{m.modulo}</td>
                  <td style={{ padding: '12px 14px', color: C.blue, fontFamily: 'monospace', fontWeight: 600 }}>{m.cuenta}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700,
                    color: C.blue, fontFamily: 'monospace', fontSize: 13 }}>{fmt$(m.saldo_operativo)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700,
                    color: C.purple || '#8B5CF6', fontFamily: 'monospace', fontSize: 13 }}>{fmt$(m.saldo_contable)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800,
                    color: Math.abs(m.diferencia) < 0.01 ? C.green : C.red,
                    fontFamily: 'monospace', fontSize: 13 }}>{fmt$(m.diferencia)}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, padding: '4px 14px', borderRadius: 8,
                      background: m.conciliado ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)',
                      color: m.conciliado ? '#10B981' : '#EF4444',
                      border: `1px solid ${m.conciliado ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)'}` }}>
                      {m.conciliado ? 'CONCILIADO' : 'DIFERENCIA'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary */}
          <div style={{ padding: '14px 16px', background: C.sur2, borderTop: `2px solid ${C.border}`,
            display: 'flex', justifyContent: 'center', gap: 30 }}>
            {data.modulos.every(m => m.conciliado) ? (
              <span style={{ fontSize: 16, fontWeight: 800, color: '#10B981' }}>
                TODOS LOS MODULOS CONCILIADOS
              </span>
            ) : (
              <span style={{ fontSize: 16, fontWeight: 800, color: '#EF4444' }}>
                {data.modulos.filter(m => !m.conciliado).length} MODULO(S) CON DIFERENCIAS
              </span>
            )}
          </div>
        </div>
      )}

      {!data && !loading && (
        <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
          padding: 40, textAlign: 'center', color: C.hint, fontSize: 13 }}>
          Seleccione fecha de corte y presione "Consultar" para ver la conciliacion entre modulos
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   Tab 12: Monedas (Multi-Currency)
   ════════════════════════════════════════════════════════════ */
function TabMonedas({ C, fi }) {
  const today = new Date()
  const yearStart = `${today.getFullYear()}-01-01`
  const [monedas, setMonedas] = useState([])
  const [loading, setLoading] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [simbolo, setSimbolo] = useState('$')
  const [saving, setSaving] = useState(false)

  // Exchange rate state
  const [monedaId, setMonedaId] = useState('')
  const [tcFecha, setTcFecha] = useState(today.toISOString().slice(0, 10))
  const [tcTasa, setTcTasa] = useState('')
  const [savingTc, setSavingTc] = useState(false)
  const [tiposCambio, setTiposCambio] = useState([])
  const [loadingTc, setLoadingTc] = useState(false)

  // Diferencia cambio
  const [fechaIni, setFechaIni] = useState(yearStart)
  const [fechaFin, setFechaFin] = useState(today.toISOString().slice(0, 10))
  const [difCambio, setDifCambio] = useState(null)
  const [loadingDif, setLoadingDif] = useState(false)

  const cargar = useCallback(() => {
    setLoading(true)
    api.get('/contabilidad/monedas')
      .then(r => setMonedas(r.data || []))
      .catch(() => setMonedas([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function crearMoneda() {
    if (!codigo || !nombre) return alert('Codigo y nombre son requeridos')
    if (codigo.length < 2 || codigo.length > 5) return alert('Codigo debe tener entre 2 y 5 caracteres')
    setSaving(true)
    try {
      await api.post(`/contabilidad/monedas?codigo=${encodeURIComponent(codigo)}&nombre=${encodeURIComponent(nombre)}&simbolo=${encodeURIComponent(simbolo)}`)
      setCodigo(''); setNombre(''); setSimbolo('$')
      cargar()
    } catch (e) {
      alert(e.response?.data?.detail || 'Error al crear moneda')
    } finally { setSaving(false) }
  }

  function cargarTiposCambio(mid) {
    if (!mid) { setTiposCambio([]); return }
    setLoadingTc(true)
    api.get('/contabilidad/tipos-cambio', { params: { moneda_id: mid } })
      .then(r => setTiposCambio(r.data || []))
      .catch(() => setTiposCambio([]))
      .finally(() => setLoadingTc(false))
  }

  function selectMoneda(mid) {
    setMonedaId(mid)
    cargarTiposCambio(mid)
  }

  async function registrarTc() {
    if (!monedaId || !tcFecha || !tcTasa) return alert('Complete moneda, fecha y tasa')
    setSavingTc(true)
    try {
      await api.post(`/contabilidad/tipos-cambio?moneda_id=${monedaId}&fecha=${tcFecha}&tasa=${tcTasa}`)
      setTcTasa('')
      cargarTiposCambio(monedaId)
    } catch (e) {
      alert(e.response?.data?.detail || 'Error al registrar tipo de cambio')
    } finally { setSavingTc(false) }
  }

  function consultarDiferencias() {
    setLoadingDif(true)
    api.get('/contabilidad/diferencia-cambio', { params: { fecha_ini: fechaIni, fecha_fin: fechaFin } })
      .then(r => setDifCambio(r.data))
      .catch(() => alert('Error al consultar diferencias de cambio'))
      .finally(() => setLoadingDif(false))
  }

  return (
    <div>
      {/* Create currency form */}
      <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
        padding: 16, marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10, display: 'block' }}>
          Nueva Moneda</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={lbl(C)}>Codigo (3 letras)</label>
            <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())}
              placeholder="EUR" maxLength={5} style={{ ...fi, width: 90 }} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={lbl(C)}>Nombre</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder="Nombre de la moneda" style={{ ...fi, width: '100%' }} />
          </div>
          <div>
            <label style={lbl(C)}>Simbolo</label>
            <input value={simbolo} onChange={e => setSimbolo(e.target.value)}
              placeholder="$" maxLength={5} style={{ ...fi, width: 60 }} />
          </div>
          <button onClick={crearMoneda} disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              borderRadius: 8, border: 'none', background: C.blue, color: '#fff',
              fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            <Plus size={14} /> {saving ? 'Creando...' : 'Crear'}
          </button>
        </div>
      </div>

      {/* Currency list */}
      <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
        overflow: 'auto', marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: C.sur2, borderBottom: `1px solid ${C.border}` }}>
              {['Codigo', 'Nombre', 'Simbolo', 'Base'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left',
                  fontWeight: 700, color: C.muted, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: 30, textAlign: 'center', color: C.hint }}>Cargando...</td></tr>
            ) : monedas.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: 30, textAlign: 'center', color: C.hint }}>No hay monedas registradas</td></tr>
            ) : monedas.map(m => (
              <tr key={m.id} style={{ borderBottom: `1px solid ${C.border}` }}
                onMouseEnter={e => e.currentTarget.style.background = C.sur2}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '8px 12px', fontWeight: 700, color: C.blue, fontFamily: 'monospace' }}>{m.codigo}</td>
                <td style={{ padding: '8px 12px', color: C.text }}>{m.nombre}</td>
                <td style={{ padding: '8px 12px', color: C.muted, fontSize: 14, fontWeight: 700 }}>{m.simbolo}</td>
                <td style={{ padding: '8px 12px' }}>
                  {m.es_base && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                      background: 'rgba(16,185,129,.15)', color: '#10B981' }}>BASE</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Exchange rate section */}
      <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
        padding: 16, marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10, display: 'block' }}>
          Tipos de Cambio</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ minWidth: 200 }}>
            <label style={lbl(C)}>Moneda</label>
            <select value={monedaId} onChange={e => selectMoneda(e.target.value)}
              style={{ ...fi, width: '100%' }}>
              <option value="">-- Seleccione moneda --</option>
              {monedas.filter(m => !m.es_base).map(m => (
                <option key={m.id} value={m.id}>{m.codigo} - {m.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={lbl(C)}>Fecha</label>
            <input type="date" value={tcFecha} onChange={e => setTcFecha(e.target.value)} style={fi} />
          </div>
          <div>
            <label style={lbl(C)}>Tasa (USD por 1 unidad)</label>
            <input type="number" step="0.000001" value={tcTasa}
              onChange={e => setTcTasa(e.target.value)}
              placeholder="0.000000" style={{ ...fi, width: 140 }} />
          </div>
          <button onClick={registrarTc} disabled={savingTc}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              borderRadius: 8, border: 'none', background: C.green, color: '#fff',
              fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: savingTc ? 0.6 : 1 }}>
            {savingTc ? 'Registrando...' : 'Registrar'}
          </button>
        </div>

        {/* Exchange rate history */}
        {monedaId && (
          <div style={{ borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: C.sur2, borderBottom: `1px solid ${C.border}` }}>
                  {['Fecha', 'Moneda', 'Tasa (USD)'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Tasa (USD)' ? 'right' : 'left',
                      fontWeight: 700, color: C.muted, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingTc ? (
                  <tr><td colSpan={3} style={{ padding: 20, textAlign: 'center', color: C.hint }}>Cargando...</td></tr>
                ) : tiposCambio.length === 0 ? (
                  <tr><td colSpan={3} style={{ padding: 20, textAlign: 'center', color: C.hint }}>Sin tipos de cambio registrados</td></tr>
                ) : tiposCambio.map((tc, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}
                    onMouseEnter={e => e.currentTarget.style.background = C.sur2}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '6px 12px', color: C.text }}>{String(tc.fecha || '').slice(0, 10)}</td>
                    <td style={{ padding: '6px 12px', color: C.blue, fontWeight: 600 }}>{tc.codigo} - {tc.moneda}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, color: C.text, fontFamily: 'monospace' }}>
                      {Number(tc.tasa).toFixed(6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Exchange rate difference report */}
      <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
        padding: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10, display: 'block' }}>
          Reporte de Diferencia en Cambio</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <label style={lbl(C)}>Desde</label>
            <input type="date" value={fechaIni} onChange={e => setFechaIni(e.target.value)} style={fi} />
          </div>
          <div>
            <label style={lbl(C)}>Hasta</label>
            <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} style={fi} />
          </div>
          <button onClick={consultarDiferencias} disabled={loadingDif}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none',
              background: C.blue, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            {loadingDif ? 'Consultando...' : 'Consultar'}
          </button>
        </div>

        {difCambio && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 16px',
              background: C.sur2, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 12 }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: 10, color: C.muted, display: 'block', textTransform: 'uppercase' }}>
                  Total Diferencia en Cambio</span>
                <span style={{ fontSize: 20, fontWeight: 800,
                  color: difCambio.total_diferencia >= 0 ? C.green : C.red }}>
                  {fmt$(difCambio.total_diferencia)}
                </span>
              </div>
            </div>

            {difCambio.movimientos && difCambio.movimientos.length > 0 && (
              <div style={{ borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: C.sur2, borderBottom: `1px solid ${C.border}` }}>
                      {['Fecha', 'Descripcion', 'Cuenta', 'Moneda', 'Monto Orig.', 'Tasa', 'Valor Actual', 'Diferencia'].map(h => (
                        <th key={h} style={{ padding: '8px 10px',
                          textAlign: ['Monto Orig.', 'Tasa', 'Valor Actual', 'Diferencia'].includes(h) ? 'right' : 'left',
                          fontWeight: 700, color: C.muted, fontSize: 10, textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {difCambio.movimientos.map((m, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}
                        onMouseEnter={e => e.currentTarget.style.background = C.sur2}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '6px 10px', color: C.text }}>{String(m.fecha || '').slice(0, 10)}</td>
                        <td style={{ padding: '6px 10px', color: C.text, maxWidth: 180,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.descripcion}</td>
                        <td style={{ padding: '6px 10px', color: C.blue, fontWeight: 600, fontSize: 10 }}>
                          {m.cuenta_codigo}</td>
                        <td style={{ padding: '6px 10px', fontWeight: 700, color: C.muted }}>{m.moneda}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: C.text }}>
                          {Number(m.monto_moneda || 0).toFixed(2)}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: C.muted }}>
                          {Number(m.tasa_cambio || 0).toFixed(6)}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700,
                          fontFamily: 'monospace', color: C.text }}>{fmt$(m.valor_actual)}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 800,
                          fontFamily: 'monospace',
                          color: (m.diferencia || 0) >= 0 ? C.green : C.red }}>
                          {fmt$(m.diferencia)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {difCambio.movimientos && difCambio.movimientos.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: C.hint, fontSize: 12 }}>
                No hay movimientos en moneda extranjera en el periodo seleccionado
              </div>
            )}
          </>
        )}

        {!difCambio && !loadingDif && (
          <div style={{ padding: 20, textAlign: 'center', color: C.hint, fontSize: 12 }}>
            Seleccione un periodo y presione "Consultar" para ver las diferencias en cambio
          </div>
        )}
      </div>
    </div>
  )
}


/* ════════════════════════════════════════════════════════════
   Tab 13: Consolidado (Multi-Company)
   ════════════════════════════════════════════════════════════ */
function TabConsolidado({ C, fi }) {
  const [empresas, setEmpresas] = useState([])
  const [loading, setLoading] = useState(false)
  const [nombre, setNombre] = useState('')
  const [ruc, setRuc] = useState('')
  const [esMatriz, setEsMatriz] = useState(false)
  const [saving, setSaving] = useState(false)

  // Consolidado
  const [fechaCorte, setFechaCorte] = useState(new Date().toISOString().slice(0, 10))
  const [consolidado, setConsolidado] = useState(null)
  const [loadingCons, setLoadingCons] = useState(false)

  const cargar = useCallback(() => {
    setLoading(true)
    api.get('/contabilidad/empresas-grupo')
      .then(r => setEmpresas(r.data || []))
      .catch(() => setEmpresas([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function crearEmpresa() {
    if (!nombre) return alert('Nombre es requerido')
    setSaving(true)
    try {
      await api.post(`/contabilidad/empresas-grupo?nombre=${encodeURIComponent(nombre)}&ruc=${encodeURIComponent(ruc)}&es_matriz=${esMatriz}`)
      setNombre(''); setRuc(''); setEsMatriz(false)
      cargar()
    } catch (e) {
      alert(e.response?.data?.detail || 'Error al crear empresa')
    } finally { setSaving(false) }
  }

  function generarConsolidado() {
    setLoadingCons(true)
    api.get('/contabilidad/consolidado', { params: { fecha_corte: fechaCorte } })
      .then(r => setConsolidado(r.data))
      .catch(() => alert('Error al generar consolidado'))
      .finally(() => setLoadingCons(false))
  }

  const balance = consolidado?.empresa_actual

  function renderSection(title, accounts, color) {
    if (!accounts || accounts.length === 0) return null
    const total = accounts.reduce((s, a) => s + (parseFloat(a.saldo) || 0), 0)
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color, marginBottom: 6, padding: '5px 10px',
          background: `${color}15`, borderRadius: 8, border: `1px solid ${color}30` }}>
          {title}
        </div>
        {accounts.map((a, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between',
            padding: '4px 10px 4px ' + ((a.nivel || 1) * 14) + 'px',
            borderBottom: `1px solid ${C.border}`, fontSize: 11 }}>
            <span style={{ color: C.text }}>
              <span style={{ color: C.muted, fontFamily: 'monospace', marginRight: 6, fontSize: 10 }}>{a.codigo}</span>
              {a.nombre}
            </span>
            <span style={{ fontWeight: 700, color, fontFamily: 'monospace' }}>{fmt$(a.saldo)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px',
          fontWeight: 800, fontSize: 12, color }}>
          <span>Total {title}</span>
          <span>{fmt$(total)}</span>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Add company form */}
      <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
        padding: 16, marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10, display: 'block' }}>
          Agregar Empresa al Grupo</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={lbl(C)}>Nombre / Razon Social</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder="Nombre de la empresa" style={{ ...fi, width: '100%' }} />
          </div>
          <div>
            <label style={lbl(C)}>RUC</label>
            <input value={ruc} onChange={e => setRuc(e.target.value)}
              placeholder="0000000000001" maxLength={13} style={{ ...fi, width: 140 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 2 }}>
            <input type="checkbox" id="es_matriz" checked={esMatriz}
              onChange={e => setEsMatriz(e.target.checked)} />
            <label htmlFor="es_matriz" style={{ fontSize: 12, color: C.text, cursor: 'pointer' }}>
              Es Matriz
            </label>
          </div>
          <button onClick={crearEmpresa} disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              borderRadius: 8, border: 'none', background: C.blue, color: '#fff',
              fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            <Plus size={14} /> {saving ? 'Agregando...' : 'Agregar'}
          </button>
        </div>
      </div>

      {/* Company list */}
      <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
        overflow: 'auto', marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: C.sur2, borderBottom: `1px solid ${C.border}` }}>
              {['Nombre', 'RUC', 'Tipo'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left',
                  fontWeight: 700, color: C.muted, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} style={{ padding: 30, textAlign: 'center', color: C.hint }}>Cargando...</td></tr>
            ) : empresas.length === 0 ? (
              <tr><td colSpan={3} style={{ padding: 30, textAlign: 'center', color: C.hint }}>
                No hay empresas en el grupo. Agregue empresas para habilitar la consolidacion.</td></tr>
            ) : empresas.map(emp => (
              <tr key={emp.id} style={{ borderBottom: `1px solid ${C.border}` }}
                onMouseEnter={e => e.currentTarget.style.background = C.sur2}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '8px 12px', fontWeight: 600, color: C.text }}>{emp.nombre}</td>
                <td style={{ padding: '8px 12px', color: C.muted, fontFamily: 'monospace' }}>{emp.ruc || '-'}</td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                    background: emp.es_matriz ? 'rgba(59,130,246,.15)' : 'rgba(107,114,128,.15)',
                    color: emp.es_matriz ? '#3B82F6' : '#6B7280' }}>
                    {emp.es_matriz ? 'MATRIZ' : 'SUBSIDIARIA'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Generate consolidated report */}
      <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
        padding: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10, display: 'block' }}>
          Balance General Consolidado</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <label style={lbl(C)}>Fecha de corte</label>
            <input type="date" value={fechaCorte} onChange={e => setFechaCorte(e.target.value)} style={fi} />
          </div>
          <button onClick={generarConsolidado} disabled={loadingCons}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none',
              background: C.blue, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            {loadingCons ? 'Generando...' : 'Generar Consolidado'}
          </button>
        </div>

        {consolidado && (
          <>
            <div style={{ padding: '10px 14px', background: C.sur2, borderRadius: 10,
              border: `1px solid ${C.border}`, marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 4 }}>
                {consolidado.titulo}
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>
                Fecha de corte: {consolidado.fecha_corte}
                {consolidado.empresas_grupo && consolidado.empresas_grupo.length > 0 && (
                  <span> | Empresas del grupo: {consolidado.empresas_grupo.length}</span>
                )}
              </div>
            </div>

            {balance && (
              <div style={{ marginBottom: 14 }}>
                {renderSection('ACTIVO', balance.activos, C.blue)}
                {renderSection('PASIVO', balance.pasivos, C.red)}
                {renderSection('PATRIMONIO', balance.patrimonio, C.purple || '#8B5CF6')}

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px',
                  background: C.sur2, borderRadius: 10, border: `1px solid ${C.border}`, marginTop: 10 }}>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 10, color: C.muted, display: 'block' }}>TOTAL ACTIVO</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: C.blue }}>{fmt$(balance.total_activo)}</span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 10, color: C.muted, display: 'block' }}>UTILIDAD</span>
                    <span style={{ fontSize: 15, fontWeight: 800,
                      color: (balance.utilidad_ejercicio || 0) >= 0 ? C.green : C.red }}>
                      {fmt$(balance.utilidad_ejercicio)}</span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 10, color: C.muted, display: 'block' }}>PASIVO + PATRIMONIO</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: C.purple || '#8B5CF6' }}>
                      {fmt$(balance.total_pasivo_patrimonio)}</span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 10, color: C.muted, display: 'block' }}>DIFERENCIA</span>
                    <span style={{ fontSize: 15, fontWeight: 800,
                      color: Math.abs(balance.diferencia || 0) < 0.01 ? C.green : C.red }}>
                      {fmt$(balance.diferencia)}</span>
                  </div>
                </div>
              </div>
            )}

            {consolidado.nota && (
              <div style={{ padding: '10px 14px', background: 'rgba(59,130,246,.08)', borderRadius: 10,
                border: `1px solid rgba(59,130,246,.2)`, fontSize: 12, color: C.blue, fontStyle: 'italic' }}>
                {consolidado.nota}
              </div>
            )}
          </>
        )}

        {!consolidado && !loadingCons && (
          <div style={{ padding: 20, textAlign: 'center', color: C.hint, fontSize: 12 }}>
            Seleccione una fecha y presione "Generar Consolidado" para ver el balance consolidado
          </div>
        )}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   Tab: Configurar Cuentas Contables
════════════════════════════════════════════════════════════ */
const GRUPOS_CONFIG = {
  ventas:    { label: 'Ventas / Ingresos',   color: '#10B981' },
  compras:   { label: 'Compras / Costos',    color: '#F59E0B' },
  nomina:    { label: 'Nomina / RRHH',       color: '#8B5CF6' },
  bancos:    { label: 'Caja y Bancos',       color: '#3B82F6' },
  impuestos: { label: 'Impuestos / Retenciones', color: '#EF4444' },
}

function TabConfigCuentas({ C, fi }) {
  const [config, setConfig] = useState({})
  const [campos, setCampos] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.get('/contabilidad/config-cuentas').then(r => {
      setConfig(r.data.config || {})
      setCampos(r.data.campos || [])
      setCuentas(r.data.cuentas_movimiento || [])
    }).catch(() => {})
  }, [])

  const handleChange = (campo, val) => {
    setConfig(p => ({ ...p, [campo]: val || null }))
    setSaved(false)
  }

  const save = async () => {
    setSaving(true)
    try {
      await api.put('/contabilidad/config-cuentas', config)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      alert(e.response?.data?.detail || 'Error al guardar')
    }
    setSaving(false)
  }

  // Agrupar campos por grupo
  const grupos = {}
  campos.forEach(([campo, label, grupo]) => {
    if (!grupos[grupo]) grupos[grupo] = []
    grupos[grupo].push({ campo, label })
  })

  return (
    <div>
      {/* Info */}
      <div style={{ background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.2)',
        borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 12, color: C.blue }}>
        <strong>¿Para qué sirve esto?</strong> — Define qué cuenta del plan de cuentas corresponde a cada tipo
        de transaccion. Una vez configurado, el sistema genera asientos contables automaticamente
        en estado <strong>BORRADOR</strong> cada vez que creas una factura, compra o apruebas la nomina.
        El contador solo revisa y aprueba.
      </div>

      {Object.entries(grupos).map(([grupo, items]) => {
        const g = GRUPOS_CONFIG[grupo] || { label: grupo, color: C.blue }
        return (
          <div key={grupo} style={{ background: C.surface, borderRadius: 12,
            border: `1px solid ${C.border}`, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: g.color,
              marginBottom: 16, paddingBottom: 8, borderBottom: `2px solid ${g.color}33` }}>
              {g.label}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
              {items.map(({ campo, label }) => (
                <div key={campo}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: C.muted,
                    display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    {label}
                  </label>
                  <select
                    value={config[campo] || ''}
                    onChange={e => handleChange(campo, e.target.value)}
                    style={{ ...fi, width: '100%' }}
                  >
                    <option value="">— Sin configurar —</option>
                    {cuentas.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.codigo} — {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
        {saved && (
          <span style={{ color: '#10B981', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            ✓ Configuracion guardada
          </span>
        )}
        <button onClick={save} disabled={saving}
          style={{ padding: '10px 24px', borderRadius: 8, border: 'none',
            background: '#10B981', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          {saving ? 'Guardando...' : 'Guardar Configuracion'}
        </button>
      </div>
    </div>
  )
}


/* ── Helpers ── */
function btnIcon(C) {
  return {
    background: 'none', border: `1px solid ${C.border}`, borderRadius: 6,
    cursor: 'pointer', padding: '4px 6px', color: C.muted, display: 'flex',
    alignItems: 'center',
  }
}

function lbl(C) {
  return {
    fontSize: 11, fontWeight: 600, color: C.muted,
    display: 'block', marginBottom: 3, textTransform: 'uppercase',
  }
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(new Blob([blob]))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

// ══════════════════════════════════════════════════════════════
//  TAB FORMULARIOS SRI
// ══════════════════════════════════════════════════════════════
function TabSRIContabilidad({ C, fi }) {
  const hoy = new Date()
  const periodoActual = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`
  const [periodo, setPeriodo] = useState(periodoActual)
  const [anio, setAnio]       = useState(hoy.getFullYear())
  const [datos104, setDatos104] = useState(null)
  const [datosATS, setDatosATS] = useState(null)
  const [loading104, setLoading104] = useState(false)
  const [loadingATS, setLoadingATS] = useState(false)

  const calcular104 = async () => {
    setLoading104(true); setDatos104(null)
    try { const r = await api.get('/sri/formulario104', { params: { periodo } }); setDatos104(r.data) }
    catch(e) { alert(e.response?.data?.detail || 'Error al calcular') }
    setLoading104(false)
  }

  const calcularATS = async () => {
    setLoadingATS(true); setDatosATS(null)
    try { const r = await api.get('/sri/ats', { params: { periodo } }); setDatosATS(r.data) }
    catch(e) { alert(e.response?.data?.detail || 'Error al calcular') }
    setLoadingATS(false)
  }

  const descargar = async (url, filename, params) => {
    try {
      const r = await api.get(url, { responseType: 'blob', params })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(new Blob([r.data]))
      link.download = filename; link.click()
    } catch { alert('Error al descargar') }
  }

  const fmtN = v => `$${parseFloat(v||0).toLocaleString('es-EC',{minimumFractionDigits:2,maximumFractionDigits:2})}`

  const card = { background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
    padding: 20, marginBottom: 16 }
  const btn = (color='#3B82F6') => ({ padding:'9px 20px', borderRadius:8, border:'none',
    background:color, color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer',
    display:'inline-flex', alignItems:'center', gap:6 })
  const btnO = (color='#10B981') => ({ padding:'9px 18px', borderRadius:8,
    border:`1px solid ${color}44`, background:`${color}15`, color,
    fontWeight:700, fontSize:12, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6 })
  const lbl = { fontSize:11, fontWeight:600, color:C.muted, display:'block', marginBottom:4 }

  return (
    <div>
      {/* Selector período */}
      <div style={{...card, display:'flex', gap:16, alignItems:'flex-end', flexWrap:'wrap'}}>
        <div>
          <label style={lbl}>Período mensual</label>
          <input type="month" value={periodo} onChange={e=>setPeriodo(e.target.value)}
            style={{...fi, width:160}} />
        </div>
        <div>
          <label style={lbl}>Año (para RDEP)</label>
          <input type="number" value={anio} onChange={e=>setAnio(parseInt(e.target.value))}
            style={{...fi, width:100}} min="2020" max={hoy.getFullYear()+1} />
        </div>
        <div style={{marginLeft:'auto', fontSize:12, color:C.muted, padding:'8px 0'}}>
          Basado en documentos registrados en el sistema
        </div>
      </div>

      {/* Formulario 104 */}
      <div style={card}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
          <div>
            <div style={{fontWeight:800, fontSize:15, color:C.text}}>📋 Formulario 104 — Declaración de IVA</div>
            <div style={{fontSize:12, color:C.muted, marginTop:2}}>
              IVA cobrado en ventas vs IVA pagado en compras — período {periodo}
            </div>
          </div>
          <div style={{display:'flex', gap:8}}>
            <button onClick={calcular104} disabled={loading104} style={btn()}>
              {loading104 ? 'Calculando...' : 'Calcular'}
            </button>
            {datos104 && (
              <button onClick={()=>descargar('/sri/formulario104/excel',`F104_${periodo}.xlsx`,{periodo})}
                style={btnO()}>
                <Download size={13}/> Excel
              </button>
            )}
          </div>
        </div>

        {datos104 && (
          <div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:12}}>
              {[
                {l:'Ventas base 0%',       v:datos104.ventas_base_0,   col:C.muted},
                {l:'Ventas base 15%',      v:datos104.ventas_base_iva, col:'#3B82F6'},
                {l:'IVA cobrado',          v:datos104.ventas_iva,      col:'#3B82F6'},
                {l:'Compras base 0%',      v:datos104.compras_base_0,  col:C.muted},
                {l:'Compras base 15%',     v:datos104.compras_base_iva,col:'#8B5CF6'},
                {l:'Crédito tributario',   v:datos104.credito_tributario,col:'#8B5CF6'},
                {l:'Retenciones IVA recibidas',v:datos104.retenciones_recibidas,col:'#F59E0B'},
              ].map((it,i)=>(
                <div key={i} style={{padding:'10px 14px', borderRadius:9,
                  background:C.sur2, border:`1px solid ${C.border}`}}>
                  <div style={{fontSize:10, color:C.muted, fontWeight:700,
                    textTransform:'uppercase', letterSpacing:'.04em', marginBottom:4}}>{it.l}</div>
                  <div style={{fontSize:16, fontWeight:800, color:it.col}}>{fmtN(it.v)}</div>
                </div>
              ))}
            </div>
            {/* Resultado destacado */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
              <div style={{padding:'16px 20px', borderRadius:10,
                background: datos104.iva_a_pagar > 0 ? 'rgba(239,68,68,.1)' : 'rgba(16,185,129,.06)',
                border: `2px solid ${datos104.iva_a_pagar > 0 ? '#EF4444' : '#10B981'}`}}>
                <div style={{fontSize:11, fontWeight:700, color:datos104.iva_a_pagar>0?'#EF4444':'#10B981',
                  textTransform:'uppercase', marginBottom:4}}>
                  {datos104.iva_a_pagar > 0 ? '⚠️ IVA A PAGAR' : '✅ Sin saldo a pagar'}
                </div>
                <div style={{fontSize:28, fontWeight:900,
                  color:datos104.iva_a_pagar>0?'#EF4444':'#10B981'}}>
                  {fmtN(datos104.iva_a_pagar)}
                </div>
              </div>
              <div style={{padding:'16px 20px', borderRadius:10,
                background:'rgba(16,185,129,.06)', border:'1px solid rgba(16,185,129,.2)'}}>
                <div style={{fontSize:11, fontWeight:700, color:'#10B981',
                  textTransform:'uppercase', marginBottom:4}}>Crédito a favor</div>
                <div style={{fontSize:28, fontWeight:900, color:'#10B981'}}>
                  {fmtN(datos104.credito_a_favor)}
                </div>
              </div>
            </div>
            <div style={{marginTop:10, fontSize:11, color:C.muted}}>
              Basado en {datos104.num_facturas} facturas de venta y {datos104.num_compras} compras del período
            </div>
          </div>
        )}
      </div>

      {/* ATS */}
      <div style={card}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
          <div>
            <div style={{fontWeight:800, fontSize:15, color:C.text}}>📑 ATS — Anexo Transaccional Simplificado</div>
            <div style={{fontSize:12, color:C.muted, marginTop:2}}>
              Detalle completo de ventas y compras para presentar al SRI — período {periodo}
            </div>
          </div>
          <div style={{display:'flex', gap:8}}>
            <button onClick={calcularATS} disabled={loadingATS} style={btn('#8B5CF6')}>
              {loadingATS ? 'Calculando...' : 'Calcular'}
            </button>
            {datosATS && (
              <button onClick={()=>descargar('/sri/ats/excel',`ATS_${periodo}.xlsx`,{periodo})}
                style={btnO()}>
                <Download size={13}/> Excel (2 hojas)
              </button>
            )}
          </div>
        </div>

        {datosATS && (
          <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10}}>
            {[
              {l:'Facturas venta', v:datosATS.resumen?.total_ventas,       col:'#3B82F6', u:'documentos'},
              {l:'Base IVA ventas',v:fmtN(datosATS.resumen?.base_iva_ventas), col:'#3B82F6', u:'gravado'},
              {l:'Facturas compra',v:datosATS.resumen?.total_compras,      col:'#8B5CF6', u:'documentos'},
              {l:'Base IVA compras',v:fmtN(datosATS.resumen?.base_iva_compras),col:'#8B5CF6',u:'gravado'},
            ].map((it,i)=>(
              <div key={i} style={{padding:'12px', borderRadius:9, textAlign:'center',
                background:C.sur2, border:`1px solid ${C.border}`}}>
                <div style={{fontSize:20, fontWeight:900, color:it.col}}>{it.v}</div>
                <div style={{fontSize:11, fontWeight:700, color:C.muted, marginTop:4}}>{it.l}</div>
                <div style={{fontSize:10, color:C.hint}}>{it.u}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RDEP */}
      <div style={card}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <div style={{fontWeight:800, fontSize:15, color:C.text}}>👔 RDEP — Relación de Dependencia</div>
            <div style={{fontSize:12, color:C.muted, marginTop:2}}>
              Reporte anual de ingresos por empleado — año {anio}
            </div>
          </div>
          <button onClick={()=>descargar('/sri/rdep/excel',`RDEP_${anio}.xlsx`,{anio})}
            style={btn('#F59E0B')}>
            <Download size={13}/> Descargar RDEP {anio}
          </button>
        </div>
      </div>

      {/* Aviso */}
      <div style={{padding:'12px 16px', borderRadius:10, fontSize:12, lineHeight:1.7,
        background:'rgba(245,158,11,.06)', border:'1px solid rgba(245,158,11,.2)', color:'#F59E0B'}}>
        ⚠️ <strong>Importante:</strong> Estos formularios son de apoyo para su contador.
        Verifique los valores con un profesional contable antes de la declaración oficial al SRI.
        Los resultados dependen de que todos los documentos estén correctamente ingresados.
      </div>
    </div>
  )
}
