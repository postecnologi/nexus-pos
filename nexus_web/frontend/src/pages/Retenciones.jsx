import React, { useState, useEffect, useCallback } from 'react'
import api from '../api'
import { useTheme } from '../theme'
import {
  FileCheck2, Plus, Search, X, Trash2, Eye, Download, FileText,
  ChevronDown, AlertCircle, Ban, Send, Mail, BookOpen, RefreshCw, Zap
} from 'lucide-react'

const fmt$ = v => '$' + Number(v || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const ESTADO_COLORS = {
  EMITIDA:  { bg: 'rgba(16,185,129,.15)', color: '#10B981', border: 'rgba(16,185,129,.3)' },
  ANULADA:  { bg: 'rgba(239,68,68,.15)',   color: '#EF4444', border: 'rgba(239,68,68,.3)' },
}

const SRI_ESTADO_COLORS = {
  NO_ENVIADA:  { bg: 'rgba(156,163,175,.15)', color: '#9CA3AF', border: 'rgba(156,163,175,.3)' },
  AUTORIZADA:  { bg: 'rgba(16,185,129,.15)',   color: '#10B981', border: 'rgba(16,185,129,.3)' },
  RECHAZADA:   { bg: 'rgba(239,68,68,.15)',    color: '#EF4444', border: 'rgba(239,68,68,.3)' },
  RECIBIDA:    { bg: 'rgba(245,158,11,.15)',   color: '#F59E0B', border: 'rgba(245,158,11,.3)' },
  ERROR_FIRMA: { bg: 'rgba(239,68,68,.15)',    color: '#EF4444', border: 'rgba(239,68,68,.3)' },
  'N/A':       { bg: 'rgba(156,163,175,.1)',   color: '#6B7280', border: 'rgba(156,163,175,.2)' },
}

function Badge({ estado }) {
  const s = ESTADO_COLORS[estado] || ESTADO_COLORS.EMITIDA
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
      background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {estado}
    </span>
  )
}

function SriBadge({ estado }) {
  const s = SRI_ESTADO_COLORS[estado] || SRI_ESTADO_COLORS.NO_ENVIADA
  return (
    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 5,
      background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {estado || 'N/A'}
    </span>
  )
}

export default function Retenciones() {
  const C = useTheme()
  const [tab, setTab] = useState('emitidas')
  const [emitidas, setEmitidas] = useState([])
  const [recibidas, setRecibidas] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [fechaIni, setFechaIni] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showDetalle, setShowDetalle] = useState(null)
  const [codigos, setCodigos] = useState({ IVA: [], RENTA: [] })
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api.get('/retenciones/codigos').then(r => setCodigos(r.data)).catch(() => {})
  }, [])

  const cargar = useCallback(() => {
    setLoading(true)
    const params = {}
    if (busqueda) params.busqueda = busqueda
    if (fechaIni) params.fecha_ini = fechaIni
    if (fechaFin) params.fecha_fin = fechaFin
    const p1 = api.get('/retenciones/emitidas', { params }).then(r => setEmitidas(r.data || []))
    const p2 = api.get('/retenciones/recibidas', { params }).then(r => setRecibidas(r.data || []))
    Promise.all([p1, p2]).finally(() => setLoading(false))
  }, [busqueda, fechaIni, fechaFin])

  useEffect(() => { cargar() }, [cargar])

  async function anular(id) {
    if (!window.confirm('Anular esta retencion?')) return
    try {
      await api.patch(`/retenciones/${id}/anular`)
      cargar()
    } catch (e) {
      alert(e.response?.data?.detail || 'Error al anular')
    }
  }

  async function verDetalle(id) {
    try {
      const { data } = await api.get(`/retenciones/${id}`)
      setShowDetalle(data)
    } catch { alert('Error al cargar detalle') }
  }

  async function procesarSRI(id) {
    if (!window.confirm('Procesar esta retencion en el SRI? (Firmar, enviar y autorizar)')) return
    try {
      const { data } = await api.post(`/retenciones/${id}/procesar-sri`)
      alert(`Estado SRI: ${data.estado}${data.numero_autorizacion ? '\nAutorizacion: ' + data.numero_autorizacion : ''}${data.msg ? '\n' + data.msg : ''}`)
      cargar()
    } catch (e) {
      alert(e.response?.data?.detail || 'Error al procesar en SRI')
    }
  }

  async function consultarSRI(id) {
    try {
      const { data } = await api.get(`/retenciones/${id}/consultar-sri`)
      alert(`Estado: ${data.autorizado ? 'AUTORIZADA' : 'Pendiente'}${data.numero_autorizacion ? '\nAutorizacion: ' + data.numero_autorizacion : ''}`)
      cargar()
    } catch (e) {
      alert(e.response?.data?.detail || 'Error al consultar SRI')
    }
  }

  async function enviarEmail(id) {
    try {
      const { data } = await api.post(`/retenciones/${id}/enviar-email`)
      if (data.enviado) {
        alert('Email enviado correctamente')
      } else {
        alert('Error: ' + (data.error || 'No se pudo enviar el email'))
      }
    } catch (e) {
      alert(e.response?.data?.detail || 'Error al enviar email')
    }
  }

  async function generarAsiento(id) {
    if (!window.confirm('Generar asiento contable para esta retencion?')) return
    try {
      const { data } = await api.post(`/retenciones/${id}/asiento-contable`)
      alert(data.msg + (data.asiento_id ? ' (ID: ' + data.asiento_id + ')' : ''))
    } catch (e) {
      alert(e.response?.data?.detail || 'Error al generar asiento contable')
    }
  }

  function descargarPDF(id) {
    window.open(`${import.meta.env.VITE_API_URL||'http://localhost:8000/api'}/retenciones/${id}/pdf?token=${localStorage.getItem('nexus_token')}`, '_blank')
  }

  function descargarXML(id) {
    window.open(`${import.meta.env.VITE_API_URL||'http://localhost:8000/api'}/retenciones/${id}/xml?token=${localStorage.getItem('nexus_token')}`, '_blank')
  }

  const fi = {
    padding: '8px 11px', borderRadius: 8, fontSize: 13,
    border: `1px solid ${C.bord2}`, background: C.sur2,
    color: C.text, outline: 'none', boxSizing: 'border-box',
  }

  const datos = tab === 'emitidas' ? emitidas : recibidas
  const esEmitida = tab === 'emitidas'

  return (
    <div style={{ padding: 24, minHeight: '100vh', background: C.bg }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileCheck2 size={22} color={C.blue} />
          <span style={{ fontSize: 20, fontWeight: 800, color: C.text }}>Retenciones SRI</span>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px',
            borderRadius: 10, border: 'none', background: C.blue, color: '#fff',
            fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          <Plus size={15} /> Nueva Retencion
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {['emitidas', 'recibidas'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '8px 24px', borderRadius: '10px 10px 0 0', border: 'none',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
              background: tab === t ? C.surface : 'transparent',
              color: tab === t ? C.blue : C.muted,
              borderBottom: tab === t ? `2px solid ${C.blue}` : `2px solid transparent`,
            }}>
            {t === 'emitidas' ? 'Emitidas (a Proveedores)' : 'Recibidas (de Clientes)'}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: C.hint }} />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, RUC o numero..."
            style={{ ...fi, width: '100%', paddingLeft: 30 }} />
        </div>
        <input type="date" value={fechaIni} onChange={e => setFechaIni(e.target.value)}
          style={{ ...fi, width: 150 }} />
        <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)}
          style={{ ...fi, width: 150 }} />
      </div>

      {/* Table */}
      <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
        overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: C.sur2, borderBottom: `1px solid ${C.border}` }}>
              {['Numero', 'Fecha', esEmitida ? 'Proveedor' : 'Cliente', 'RUC',
                'IVA Ret.', 'Renta Ret.', 'Total', 'Estado', 'SRI', 'Acciones'
              ].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left',
                  fontWeight: 700, color: C.muted, fontSize: 11,
                  textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: C.hint }}>
                Cargando...</td></tr>
            ) : datos.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: C.hint }}>
                No hay retenciones {tab}</td></tr>
            ) : datos.map(r => (
              <tr key={r.id} style={{ borderBottom: `1px solid ${C.border}` }}
                onMouseEnter={e => e.currentTarget.style.background = C.sur2}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '8px 12px', fontWeight: 600, color: C.blue }}>
                  {r.numero}</td>
                <td style={{ padding: '8px 12px', color: C.text }}>
                  {String(r.fecha_emision || '').slice(0, 10)}</td>
                <td style={{ padding: '8px 12px', color: C.text, maxWidth: 180,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {esEmitida ? r.proveedor_nombre : r.cliente_nombre}</td>
                <td style={{ padding: '8px 12px', color: C.muted, fontFamily: 'monospace', fontSize: 11 }}>
                  {esEmitida ? r.proveedor_ruc : r.cliente_ruc}</td>
                <td style={{ padding: '8px 12px', color: C.amber, textAlign: 'right' }}>
                  {fmt$(r.iva_retenido)}</td>
                <td style={{ padding: '8px 12px', color: C.purple, textAlign: 'right' }}>
                  {fmt$(r.renta_retenido)}</td>
                <td style={{ padding: '8px 12px', fontWeight: 700, color: C.text, textAlign: 'right' }}>
                  {fmt$(r.total_retenido)}</td>
                <td style={{ padding: '8px 12px' }}><Badge estado={r.estado} /></td>
                <td style={{ padding: '8px 12px' }}><SriBadge estado={r.estado_sri} /></td>
                <td style={{ padding: '8px 12px' }}>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    <button onClick={() => verDetalle(r.id)} title="Ver detalle"
                      style={btnIcon(C)}><Eye size={13} /></button>
                    {esEmitida && r.estado !== 'ANULADA' && (
                      <>
                        <button onClick={() => descargarPDF(r.id)} title="PDF"
                          style={btnIcon(C)}><Download size={13} /></button>
                        <button onClick={() => descargarXML(r.id)} title="XML"
                          style={btnIcon(C)}><FileText size={13} /></button>
                        {r.estado_sri !== 'AUTORIZADA' && (
                          <button onClick={() => procesarSRI(r.id)} title="Procesar SRI"
                            style={{ ...btnIcon(C), color: C.blue }}><Send size={13} /></button>
                        )}
                        {r.clave_acceso && (
                          <button onClick={() => consultarSRI(r.id)} title="Consultar SRI"
                            style={{ ...btnIcon(C), color: C.amber }}><RefreshCw size={13} /></button>
                        )}
                        <button onClick={() => enviarEmail(r.id)} title="Enviar Email"
                          style={{ ...btnIcon(C), color: C.purple }}><Mail size={13} /></button>
                      </>
                    )}
                    {r.estado !== 'ANULADA' && (
                      <>
                        <button onClick={() => generarAsiento(r.id)} title="Asiento Contable"
                          style={{ ...btnIcon(C), color: C.green }}><BookOpen size={13} /></button>
                        <button onClick={() => anular(r.id)} title="Anular"
                          style={{ ...btnIcon(C), color: C.red }}><Ban size={13} /></button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Crear */}
      {showModal && (
        <ModalCrearRetencion
          C={C} fi={fi} codigos={codigos}
          tipo={tab === 'emitidas' ? 'EMITIDA' : 'RECIBIDA'}
          onClose={() => { setShowModal(false); setMsg('') }}
          onCreada={() => { setShowModal(false); cargar() }}
        />
      )}

      {/* Modal Detalle */}
      {showDetalle && (
        <ModalDetalleRetencion
          C={C} data={showDetalle}
          onClose={() => setShowDetalle(null)}
        />
      )}
    </div>
  )
}

function btnIcon(C) {
  return {
    background: 'none', border: `1px solid ${C.border}`, borderRadius: 6,
    cursor: 'pointer', padding: '4px 6px', color: C.muted, display: 'flex',
    alignItems: 'center',
  }
}

/* ════════════════════════════════════════════════════════════
   Modal: Crear Retencion
   ════════════════════════════════════════════════════════════ */
function ModalCrearRetencion({ C, fi, codigos, tipo, onClose, onCreada }) {
  const esEmitida = tipo === 'EMITIDA'
  const [busqProv, setBusqProv] = useState('')
  const [proveedores, setProveedores] = useState([])
  const [clientes, setClientes] = useState([])
  const [selectedEntity, setSelectedEntity] = useState(null)
  const [showSearch, setShowSearch] = useState(false)
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [numero, setNumero] = useState('')
  const [numeroRecibida, setNumeroRecibida] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [detalles, setDetalles] = useState([emptyDetalle()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // Compra search (emitida) and factura search (recibida)
  const [busqCompra, setBusqCompra] = useState('')
  const [compras, setCompras] = useState([])
  const [selectedCompra, setSelectedCompra] = useState(null)
  const [showCompraSearch, setShowCompraSearch] = useState(false)
  const [loadingSugerencia, setLoadingSugerencia] = useState(false)
  const [busqFactura, setBusqFactura] = useState('')
  const [facturas, setFacturas] = useState([])
  const [selectedFactura, setSelectedFactura] = useState(null)
  const [showFacturaSearch, setShowFacturaSearch] = useState(false)

  useEffect(() => {
    if (esEmitida) {
      api.get('/retenciones/proximo-numero').then(r => setNumero(r.data.numero)).catch(() => {})
    }
  }, [esEmitida])

  function emptyDetalle() {
    return { tipo_impuesto: 'RENTA', codigo_retencion: '', porcentaje: 0, base_imponible: '' }
  }

  async function buscarEntidad(q) {
    if (!q || q.length < 2) return
    try {
      if (esEmitida) {
        const { data } = await api.get('/proveedores', { params: { busqueda: q } })
        setProveedores(Array.isArray(data) ? data : (data.items || []))
      } else {
        const { data } = await api.get('/clientes', { params: { busqueda: q } })
        setClientes(Array.isArray(data) ? data : (data.items || []))
      }
      setShowSearch(true)
    } catch {}
  }

  function seleccionarEntidad(e) {
    setSelectedEntity(e)
    setBusqProv(e.razon_social)
    setShowSearch(false)
  }

  async function buscarCompras(q) {
    if (!q || q.length < 2) return
    try {
      const { data } = await api.get('/compras', { params: { busqueda: q, limit: 10 } })
      setCompras(Array.isArray(data) ? data : (data.items || []))
      setShowCompraSearch(true)
    } catch {}
  }

  async function seleccionarCompra(c) {
    setSelectedCompra(c)
    setBusqCompra(c.num_documento || `Compra #${c.id}`)
    setShowCompraSearch(false)
    // Auto-suggest retention lines
    setLoadingSugerencia(true)
    try {
      const { data } = await api.post(`/retenciones/auto-sugerir?compra_id=${c.id}`)
      if (data.sugerencias && data.sugerencias.length > 0) {
        setDetalles(data.sugerencias.map(s => ({
          tipo_impuesto: s.tipo_impuesto,
          codigo_retencion: s.codigo_retencion,
          porcentaje: s.porcentaje,
          base_imponible: s.base_imponible,
        })))
      }
      // Auto-select the supplier if not already selected
      if (!selectedEntity && data.compra) {
        const provRes = await api.get('/proveedores', { params: { busqueda: data.compra.ruc } })
        const provList = Array.isArray(provRes.data) ? provRes.data : (provRes.data.items || [])
        if (provList.length > 0) {
          seleccionarEntidad(provList[0])
        }
      }
    } catch {}
    setLoadingSugerencia(false)
  }

  async function buscarFacturas(q) {
    if (!q || q.length < 2) return
    try {
      const { data } = await api.get('/facturas', { params: { busqueda: q, limit: 10 } })
      setFacturas(Array.isArray(data) ? data : (data.items || []))
      setShowFacturaSearch(true)
    } catch {}
  }

  function seleccionarFactura(f) {
    setSelectedFactura(f)
    setBusqFactura(f.numero_factura || `Factura #${f.id}`)
    setShowFacturaSearch(false)
  }

  function updateDetalle(idx, field, value) {
    setDetalles(prev => {
      const copy = [...prev]
      copy[idx] = { ...copy[idx], [field]: value }
      // Auto-fill porcentaje when selecting codigo
      if (field === 'codigo_retencion') {
        const lista = copy[idx].tipo_impuesto === 'IVA' ? codigos.IVA : codigos.RENTA
        const found = lista.find(c => c.codigo === value)
        if (found) copy[idx].porcentaje = found.porcentaje
      }
      return copy
    })
  }

  function removeDetalle(idx) {
    if (detalles.length <= 1) return
    setDetalles(prev => prev.filter((_, i) => i !== idx))
  }

  function calcValor(d) {
    const base = parseFloat(d.base_imponible) || 0
    return Math.round(base * (d.porcentaje || 0) / 100 * 100) / 100
  }

  const totalRetenido = detalles.reduce((s, d) => s + calcValor(d), 0)

  async function guardar() {
    if (!selectedEntity) return setError('Seleccione un ' + (esEmitida ? 'proveedor' : 'cliente'))
    const detsValid = detalles.filter(d => d.codigo_retencion && parseFloat(d.base_imponible) > 0)
    if (detsValid.length === 0) return setError('Agregue al menos un detalle de retencion valido')
    if (!esEmitida && !numeroRecibida) return setError('Ingrese el numero de la retencion del cliente')

    setSaving(true)
    setError('')
    try {
      const body = {
        fecha_emision: fecha,
        observaciones: observaciones || null,
        detalles: detsValid.map(d => ({
          tipo_impuesto: d.tipo_impuesto,
          codigo_retencion: d.codigo_retencion,
          porcentaje: d.porcentaje,
          base_imponible: parseFloat(d.base_imponible),
        })),
      }
      if (esEmitida) {
        body.proveedor_id = selectedEntity.id
        if (selectedCompra) body.compra_id = selectedCompra.id
        await api.post('/retenciones/emitidas', body)
      } else {
        body.cliente_id = selectedEntity.id
        body.numero = numeroRecibida
        if (selectedFactura) body.factura_id = selectedFactura.id
        const { data: result } = await api.post('/retenciones/recibidas', body)
        if (result.cxc_msg) {
          alert(result.cxc_msg)
        }
      }
      onCreada()
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al guardar')
    } finally { setSaving(false) }
  }

  const listaEntidades = esEmitida ? proveedores : clientes

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000 }}>
      <div style={{ background: C.surface, borderRadius: 16, padding: 28, width: 780,
        maxHeight: '92vh', overflowY: 'auto',
        border: `1px solid ${C.bord2}`, boxShadow: '0 25px 60px rgba(0,0,0,.7)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: C.text }}>
            {esEmitida ? 'Nueva Retencion Emitida' : 'Registrar Retencion Recibida'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            cursor: 'pointer', color: C.hint, fontSize: 22 }}>
            <X size={18} />
          </button>
        </div>

        {/* Proveedor/Cliente search */}
        <div style={{ marginBottom: 14 }}>
          <label style={lbl(C)}>{esEmitida ? 'Proveedor' : 'Cliente'} *</label>
          <div style={{ position: 'relative' }}>
            <input value={busqProv}
              onChange={e => { setBusqProv(e.target.value); buscarEntidad(e.target.value) }}
              placeholder={`Buscar ${esEmitida ? 'proveedor' : 'cliente'} por nombre o RUC...`}
              style={{ ...fi, width: '100%' }} />
            {showSearch && listaEntidades.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                background: C.sur2, border: `1px solid ${C.bord2}`, borderRadius: 8,
                maxHeight: 180, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
                {listaEntidades.map(e => (
                  <div key={e.id} onClick={() => seleccionarEntidad(e)}
                    style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                      color: C.text, borderBottom: `1px solid ${C.border}` }}
                    onMouseEnter={ev => ev.currentTarget.style.background = C.sur3}
                    onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                    <span style={{ fontWeight: 600 }}>{e.razon_social}</span>
                    <span style={{ color: C.hint, marginLeft: 8, fontFamily: 'monospace', fontSize: 11 }}>
                      {e.identificacion}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {selectedEntity && (
            <div style={{ marginTop: 4, fontSize: 11, color: C.green }}>
              Seleccionado: {selectedEntity.razon_social} ({selectedEntity.identificacion})
            </div>
          )}
        </div>

        {/* Compra search (emitida) */}
        {esEmitida && (
          <div style={{ marginBottom: 14 }}>
            <label style={lbl(C)}>Compra (referencia)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input value={busqCompra}
                  onChange={e => { setBusqCompra(e.target.value); buscarCompras(e.target.value) }}
                  placeholder="Buscar compra por numero o proveedor..."
                  style={{ ...fi, width: '100%' }} />
                {showCompraSearch && compras.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: C.sur2, border: `1px solid ${C.bord2}`, borderRadius: 8,
                    maxHeight: 150, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
                    {compras.map(c => (
                      <div key={c.id} onClick={() => seleccionarCompra(c)}
                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                          color: C.text, borderBottom: `1px solid ${C.border}` }}
                        onMouseEnter={ev => ev.currentTarget.style.background = C.sur3}
                        onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                        <span style={{ fontWeight: 600 }}>{c.num_documento || `#${c.id}`}</span>
                        <span style={{ color: C.hint, marginLeft: 8, fontSize: 11 }}>
                          {fmt$(c.total)} - {String(c.fecha || '').slice(0, 10)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {selectedCompra && (
                <button onClick={() => { setSelectedCompra(null); setBusqCompra('') }}
                  style={{ ...fi, padding: '6px 10px', cursor: 'pointer', color: C.red, border: `1px solid ${C.red}` }}>
                  <X size={14} />
                </button>
              )}
            </div>
            {selectedCompra && (
              <div style={{ marginTop: 4, fontSize: 11, color: C.blue }}>
                Compra: {selectedCompra.num_documento || '#' + selectedCompra.id} - {fmt$(selectedCompra.total)}
                {loadingSugerencia && <span style={{ marginLeft: 8, color: C.amber }}>Cargando sugerencias...</span>}
              </div>
            )}
          </div>
        )}

        {/* Factura search (recibida) */}
        {!esEmitida && (
          <div style={{ marginBottom: 14 }}>
            <label style={lbl(C)}>Factura vinculada (opcional)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input value={busqFactura}
                  onChange={e => { setBusqFactura(e.target.value); buscarFacturas(e.target.value) }}
                  placeholder="Buscar factura por numero..."
                  style={{ ...fi, width: '100%' }} />
                {showFacturaSearch && facturas.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: C.sur2, border: `1px solid ${C.bord2}`, borderRadius: 8,
                    maxHeight: 150, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
                    {facturas.map(f => (
                      <div key={f.id} onClick={() => seleccionarFactura(f)}
                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                          color: C.text, borderBottom: `1px solid ${C.border}` }}
                        onMouseEnter={ev => ev.currentTarget.style.background = C.sur3}
                        onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                        <span style={{ fontWeight: 600 }}>{f.numero_factura}</span>
                        <span style={{ color: C.hint, marginLeft: 8, fontSize: 11 }}>
                          {fmt$(f.total)} - {String(f.fecha_emision || '').slice(0, 10)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {selectedFactura && (
                <button onClick={() => { setSelectedFactura(null); setBusqFactura('') }}
                  style={{ ...fi, padding: '6px 10px', cursor: 'pointer', color: C.red, border: `1px solid ${C.red}` }}>
                  <X size={14} />
                </button>
              )}
            </div>
            {selectedFactura && (
              <div style={{ marginTop: 4, fontSize: 11, color: C.blue }}>
                Factura: {selectedFactura.numero_factura} - {fmt$(selectedFactura.total)}
                <span style={{ color: C.amber, marginLeft: 8 }}>(La CXC se reducira por el total retenido)</span>
              </div>
            )}
          </div>
        )}

        {/* Row: Fecha + Numero */}
        <div style={{ display: 'grid', gridTemplateColumns: esEmitida ? '1fr 1fr' : '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={lbl(C)}>Fecha Emision</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              style={{ ...fi, width: '100%' }} />
          </div>
          {esEmitida ? (
            <div>
              <label style={lbl(C)}>Numero (auto)</label>
              <input value={numero} readOnly
                style={{ ...fi, width: '100%', opacity: 0.7 }} />
            </div>
          ) : (
            <>
              <div>
                <label style={lbl(C)}>Numero del comprobante *</label>
                <input value={numeroRecibida} onChange={e => setNumeroRecibida(e.target.value)}
                  placeholder="001-001-000000001"
                  style={{ ...fi, width: '100%' }} />
              </div>
              <div>
                <label style={lbl(C)}>Observaciones</label>
                <input value={observaciones} onChange={e => setObservaciones(e.target.value)}
                  style={{ ...fi, width: '100%' }} />
              </div>
            </>
          )}
        </div>

        {esEmitida && (
          <div style={{ marginBottom: 14 }}>
            <label style={lbl(C)}>Observaciones</label>
            <input value={observaciones} onChange={e => setObservaciones(e.target.value)}
              style={{ ...fi, width: '100%' }} />
          </div>
        )}

        {/* Detalles de retencion */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ ...lbl(C), marginBottom: 0 }}>Detalles de Retencion</label>
            <button onClick={() => setDetalles(prev => [...prev, emptyDetalle()])}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px',
                borderRadius: 6, border: `1px solid ${C.blue}`, background: 'transparent',
                color: C.blue, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              <Plus size={12} /> Agregar linea
            </button>
          </div>

          <div style={{ background: C.sur2, borderRadius: 10, border: `1px solid ${C.border}`,
            overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 90px 130px 110px 36px',
              gap: 8, padding: '8px 10px', borderBottom: `1px solid ${C.border}` }}>
              {['Tipo', 'Codigo', '%', 'Base Imponible', 'Valor Ret.', ''].map(h => (
                <span key={h} style={{ fontSize: 10, fontWeight: 700, color: C.muted,
                  textTransform: 'uppercase' }}>{h}</span>
              ))}
            </div>

            {/* Rows */}
            {detalles.map((d, idx) => {
              const listaCodex = d.tipo_impuesto === 'IVA' ? codigos.IVA : codigos.RENTA
              return (
                <div key={idx} style={{ display: 'grid',
                  gridTemplateColumns: '100px 1fr 90px 130px 110px 36px',
                  gap: 8, padding: '6px 10px', borderBottom: `1px solid ${C.border}`,
                  alignItems: 'center' }}>
                  {/* Tipo */}
                  <select value={d.tipo_impuesto}
                    onChange={e => {
                      updateDetalle(idx, 'tipo_impuesto', e.target.value)
                      updateDetalle(idx, 'codigo_retencion', '')
                      updateDetalle(idx, 'porcentaje', 0)
                    }}
                    style={{ ...fi, padding: '5px 6px', fontSize: 11 }}>
                    <option value="RENTA">Renta</option>
                    <option value="IVA">IVA</option>
                  </select>
                  {/* Codigo */}
                  <select value={d.codigo_retencion}
                    onChange={e => updateDetalle(idx, 'codigo_retencion', e.target.value)}
                    style={{ ...fi, padding: '5px 6px', fontSize: 11 }}>
                    <option value="">-- Seleccione --</option>
                    {listaCodex.map(c => (
                      <option key={c.codigo} value={c.codigo}>
                        {c.codigo} - {c.descripcion}
                      </option>
                    ))}
                  </select>
                  {/* Porcentaje */}
                  <input value={d.porcentaje} readOnly
                    style={{ ...fi, padding: '5px 6px', fontSize: 11, textAlign: 'right', opacity: 0.7 }} />
                  {/* Base imponible */}
                  <input type="number" step="0.01" value={d.base_imponible}
                    onChange={e => updateDetalle(idx, 'base_imponible', e.target.value)}
                    placeholder="0.00"
                    style={{ ...fi, padding: '5px 6px', fontSize: 11, textAlign: 'right' }} />
                  {/* Valor calculado */}
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.green, textAlign: 'right',
                    paddingRight: 6 }}>
                    {fmt$(calcValor(d))}
                  </span>
                  {/* Remove */}
                  <button onClick={() => removeDetalle(idx)}
                    disabled={detalles.length <= 1}
                    style={{ background: 'none', border: 'none', cursor: 'pointer',
                      color: detalles.length <= 1 ? C.hint : C.red, padding: 2 }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Total */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <div style={{ background: C.sur2, borderRadius: 10, padding: '10px 20px',
            border: `1px solid ${C.border}`, textAlign: 'right' }}>
            <span style={{ fontSize: 11, color: C.muted, marginRight: 12 }}>TOTAL RETENIDO:</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: C.green }}>{fmt$(totalRetenido)}</span>
          </div>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            background: C.redD, borderRadius: 8, marginBottom: 12,
            border: `1px solid ${C.red}`, color: C.red, fontSize: 12 }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* Botones */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose}
            style={{ padding: '8px 20px', borderRadius: 8, border: `1px solid ${C.border}`,
              background: 'transparent', color: C.muted, fontWeight: 600, fontSize: 13,
              cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={guardar} disabled={saving}
            style={{ padding: '8px 24px', borderRadius: 8, border: 'none',
              background: C.blue, color: '#fff', fontWeight: 700, fontSize: 13,
              cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Guardando...' : 'Guardar Retencion'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   Modal: Detalle de Retencion
   ════════════════════════════════════════════════════════════ */
function ModalDetalleRetencion({ C, data, onClose }) {
  const esEmitida = data.tipo === 'EMITIDA'
  const detallesIVA = (data.detalles || []).filter(d => d.tipo_impuesto === 'IVA')
  const detallesRenta = (data.detalles || []).filter(d => d.tipo_impuesto === 'RENTA')

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000 }}>
      <div style={{ background: C.surface, borderRadius: 16, padding: 28, width: 680,
        maxHeight: '90vh', overflowY: 'auto',
        border: `1px solid ${C.bord2}`, boxShadow: '0 25px 60px rgba(0,0,0,.7)' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <span style={{ fontSize: 16, fontWeight: 800, color: C.text }}>
              Retencion {data.numero}
            </span>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              {esEmitida ? 'Emitida a proveedor' : 'Recibida de cliente'}
              {' | '}{String(data.fecha_emision || '').slice(0, 10)}
              {' | '}<Badge estado={data.estado} />
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            cursor: 'pointer', color: C.hint, fontSize: 22 }}><X size={18} /></button>
        </div>

        {/* Info entity */}
        <div style={{ background: C.sur2, borderRadius: 10, padding: 14, marginBottom: 14,
          border: `1px solid ${C.border}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <span style={{ fontSize: 10, color: C.hint, fontWeight: 600, textTransform: 'uppercase' }}>
                {esEmitida ? 'Proveedor' : 'Cliente'}
              </span>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                {esEmitida ? data.proveedor_nombre : data.cliente_nombre}
              </div>
            </div>
            <div>
              <span style={{ fontSize: 10, color: C.hint, fontWeight: 600, textTransform: 'uppercase' }}>RUC/CI</span>
              <div style={{ fontSize: 13, color: C.text, fontFamily: 'monospace' }}>
                {esEmitida ? data.proveedor_ruc : data.cliente_ruc}
              </div>
            </div>
            <div>
              <span style={{ fontSize: 10, color: C.hint, fontWeight: 600, textTransform: 'uppercase' }}>Periodo Fiscal</span>
              <div style={{ fontSize: 13, color: C.text }}>{data.periodo_fiscal}</div>
            </div>
            {data.clave_acceso && (
              <div>
                <span style={{ fontSize: 10, color: C.hint, fontWeight: 600, textTransform: 'uppercase' }}>Clave Acceso</span>
                <div style={{ fontSize: 10, color: C.text, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {data.clave_acceso}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Detalles IVA */}
        {detallesIVA.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.amber, marginBottom: 6 }}>
              Retenciones IVA
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: C.sur2 }}>
                  {['Codigo', 'Porcentaje', 'Base Imponible', 'Valor Retenido'].map(h => (
                    <th key={h} style={{ padding: '6px 10px', textAlign: 'left',
                      fontWeight: 700, color: C.muted, fontSize: 10, borderBottom: `1px solid ${C.border}` }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detallesIVA.map(d => (
                  <tr key={d.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '6px 10px', color: C.text }}>{d.codigo_retencion}</td>
                    <td style={{ padding: '6px 10px', color: C.text }}>{d.porcentaje}%</td>
                    <td style={{ padding: '6px 10px', color: C.text, textAlign: 'right' }}>{fmt$(d.base_imponible)}</td>
                    <td style={{ padding: '6px 10px', color: C.amber, textAlign: 'right', fontWeight: 700 }}>{fmt$(d.valor_retenido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Detalles Renta */}
        {detallesRenta.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.purple, marginBottom: 6 }}>
              Retenciones Renta
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: C.sur2 }}>
                  {['Codigo', 'Porcentaje', 'Base Imponible', 'Valor Retenido'].map(h => (
                    <th key={h} style={{ padding: '6px 10px', textAlign: 'left',
                      fontWeight: 700, color: C.muted, fontSize: 10, borderBottom: `1px solid ${C.border}` }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detallesRenta.map(d => (
                  <tr key={d.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '6px 10px', color: C.text }}>{d.codigo_retencion}</td>
                    <td style={{ padding: '6px 10px', color: C.text }}>{d.porcentaje}%</td>
                    <td style={{ padding: '6px 10px', color: C.text, textAlign: 'right' }}>{fmt$(d.base_imponible)}</td>
                    <td style={{ padding: '6px 10px', color: C.purple, textAlign: 'right', fontWeight: 700 }}>{fmt$(d.valor_retenido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Total */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <div style={{ background: C.sur2, borderRadius: 10, padding: '10px 20px',
            border: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 11, color: C.muted, marginRight: 12 }}>TOTAL RETENIDO:</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: C.green }}>
              {fmt$(data.total_retenido)}
            </span>
          </div>
        </div>

        {data.observaciones && (
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
            <strong>Observaciones:</strong> {data.observaciones}
          </div>
        )}

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

function lbl(C) {
  return {
    fontSize: 11, fontWeight: 600, color: C.muted,
    display: 'block', marginBottom: 3, textTransform: 'uppercase',
  }
}
