import React, { useState, useEffect, useCallback } from 'react'
import api from '../api'
import { useTheme } from '../theme'
import {
  FileText, Plus, Search, X, Trash2, Eye, Download, Ban, AlertCircle
} from 'lucide-react'

const fmt$ = v => '$' + Number(v || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const ESTADO_COLORS = {
  EMITIDA: { bg: 'rgba(16,185,129,.15)', color: '#10B981', border: 'rgba(16,185,129,.3)' },
  ANULADA: { bg: 'rgba(239,68,68,.15)',  color: '#EF4444', border: 'rgba(239,68,68,.3)' },
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

export default function NotasDebito() {
  const C = useTheme()
  const [datos, setDatos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [fechaIni, setFechaIni] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showDetalle, setShowDetalle] = useState(null)

  const cargar = useCallback(() => {
    setLoading(true)
    const params = {}
    if (busqueda) params.busqueda = busqueda
    if (fechaIni) params.fecha_ini = fechaIni
    if (fechaFin) params.fecha_fin = fechaFin
    api.get('/notas-debito/', { params })
      .then(r => setDatos(r.data || []))
      .catch(() => setDatos([]))
      .finally(() => setLoading(false))
  }, [busqueda, fechaIni, fechaFin])

  useEffect(() => { cargar() }, [cargar])

  async function anular(id) {
    if (!window.confirm('Anular esta nota de debito?')) return
    try {
      await api.patch(`/notas-debito/${id}/anular`)
      cargar()
    } catch (e) {
      alert(e.response?.data?.detail || 'Error al anular')
    }
  }

  async function verDetalle(id) {
    try {
      const { data } = await api.get(`/notas-debito/${id}`)
      setShowDetalle(data)
    } catch { alert('Error al cargar detalle') }
  }

  function descargarPDF(id) {
    api.get(`/notas-debito/${id}/pdf`, { responseType: 'blob' })
      .then(r => {
        const url = window.URL.createObjectURL(new Blob([r.data]))
        const a = document.createElement('a')
        a.href = url
        a.download = `nota_debito_${id}.pdf`
        a.click()
        window.URL.revokeObjectURL(url)
      })
      .catch(() => alert('Error al descargar PDF'))
  }

  function descargarXML(id) {
    api.get(`/notas-debito/${id}/xml`, { responseType: 'blob' })
      .then(r => {
        const url = window.URL.createObjectURL(new Blob([r.data]))
        const a = document.createElement('a')
        a.href = url
        a.download = `nota_debito_${id}.xml`
        a.click()
        window.URL.revokeObjectURL(url)
      })
      .catch(() => alert('Error al descargar XML'))
  }

  const fi = {
    padding: '8px 11px', borderRadius: 8, fontSize: 13,
    border: `1px solid ${C.bord2}`, background: C.sur2,
    color: C.text, outline: 'none', boxSizing: 'border-box',
  }

  const statsEmitidas = datos.filter(d => d.estado === 'EMITIDA').length
  const statsAnuladas = datos.filter(d => d.estado === 'ANULADA').length
  const statsTotal = datos.reduce((s, d) => s + (d.estado !== 'ANULADA' ? Number(d.total || 0) : 0), 0)

  return (
    <div style={{ padding: 24, minHeight: '100vh', background: C.bg }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileText size={22} color={C.blue} />
          <span style={{ fontSize: 20, fontWeight: 800, color: C.text }}>Notas de Debito</span>
          <div style={{ display: 'flex', gap: 10, marginLeft: 16 }}>
            <span style={{ fontSize: 11, color: C.green, background: C.greenD, padding: '2px 10px',
              borderRadius: 6, fontWeight: 600 }}>Emitidas: {statsEmitidas}</span>
            <span style={{ fontSize: 11, color: C.red, background: C.redD, padding: '2px 10px',
              borderRadius: 6, fontWeight: 600 }}>Anuladas: {statsAnuladas}</span>
            <span style={{ fontSize: 11, color: C.blue, background: C.blueD, padding: '2px 10px',
              borderRadius: 6, fontWeight: 600 }}>Total: {fmt$(statsTotal)}</span>
          </div>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px',
            borderRadius: 10, border: 'none', background: C.blue, color: '#fff',
            fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          <Plus size={15} /> Nueva Nota de Debito
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: C.hint }} />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por cliente, RUC o numero..."
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
              {['Numero', 'Fecha', 'Cliente', 'RUC', 'Factura Ref', 'Motivo', 'Total', 'Estado', 'Acciones'
              ].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left',
                  fontWeight: 700, color: C.muted, fontSize: 11,
                  textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: C.hint }}>
                Cargando...</td></tr>
            ) : datos.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: C.hint }}>
                No hay notas de debito</td></tr>
            ) : datos.map(r => (
              <tr key={r.id} style={{ borderBottom: `1px solid ${C.border}` }}
                onMouseEnter={e => e.currentTarget.style.background = C.sur2}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '8px 12px', fontWeight: 600, color: C.blue }}>
                  {r.numero}</td>
                <td style={{ padding: '8px 12px', color: C.text }}>
                  {String(r.fecha || '').slice(0, 10)}</td>
                <td style={{ padding: '8px 12px', color: C.text, maxWidth: 180,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.cliente_nombre}</td>
                <td style={{ padding: '8px 12px', color: C.muted, fontFamily: 'monospace', fontSize: 11 }}>
                  {r.cliente_ruc}</td>
                <td style={{ padding: '8px 12px', color: C.muted, fontSize: 11 }}>
                  {r.factura_referencia || '-'}</td>
                <td style={{ padding: '8px 12px', color: C.text, maxWidth: 160,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.motivo || '-'}</td>
                <td style={{ padding: '8px 12px', fontWeight: 700, color: C.text, textAlign: 'right' }}>
                  {fmt$(r.total)}</td>
                <td style={{ padding: '8px 12px' }}><Badge estado={r.estado} /></td>
                <td style={{ padding: '8px 12px' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => verDetalle(r.id)} title="Ver detalle"
                      style={btnIcon(C)}><Eye size={13} /></button>
                    {r.estado !== 'ANULADA' && (
                      <>
                        <button onClick={() => descargarPDF(r.id)} title="PDF"
                          style={btnIcon(C)}><Download size={13} /></button>
                        <button onClick={() => descargarXML(r.id)} title="XML"
                          style={btnIcon(C)}><FileText size={13} /></button>
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
        <ModalCrearNotaDebito
          C={C} fi={fi}
          onClose={() => setShowModal(false)}
          onCreada={() => { setShowModal(false); cargar() }}
        />
      )}

      {/* Modal Detalle */}
      {showDetalle && (
        <ModalDetalleNotaDebito
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
   Modal: Crear Nota de Debito
   ════════════════════════════════════════════════════════════ */
function ModalCrearNotaDebito({ C, fi, onClose, onCreada }) {
  const [busqCli, setBusqCli] = useState('')
  const [clientes, setClientes] = useState([])
  const [selectedCliente, setSelectedCliente] = useState(null)
  const [showSearch, setShowSearch] = useState(false)
  const [numero, setNumero] = useState('')
  const [facturaRef, setFacturaRef] = useState('')
  const [motivo, setMotivo] = useState('')
  const [detalles, setDetalles] = useState([emptyDetalle()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/notas-debito/proximo-numero')
      .then(r => setNumero(r.data.numero || r.data.proximo_numero || ''))
      .catch(() => {})
  }, [])

  function emptyDetalle() {
    return { descripcion: '', cantidad: 1, precio_unitario: '', iva_porcentaje: 15 }
  }

  async function buscarCliente(q) {
    if (!q || q.length < 2) return
    try {
      const { data } = await api.get('/clientes', { params: { busqueda: q } })
      setClientes(Array.isArray(data) ? data : (data.items || []))
      setShowSearch(true)
    } catch {}
  }

  function seleccionarCliente(c) {
    setSelectedCliente(c)
    setBusqCli(c.razon_social)
    setShowSearch(false)
  }

  function updateDetalle(idx, field, value) {
    setDetalles(prev => {
      const copy = [...prev]
      copy[idx] = { ...copy[idx], [field]: value }
      return copy
    })
  }

  function removeDetalle(idx) {
    if (detalles.length <= 1) return
    setDetalles(prev => prev.filter((_, i) => i !== idx))
  }

  function calcRow(d) {
    const cant = parseFloat(d.cantidad) || 0
    const pu = parseFloat(d.precio_unitario) || 0
    const ivaPct = parseFloat(d.iva_porcentaje) || 0
    const subtotal = Math.round(cant * pu * 100) / 100
    const iva = Math.round(subtotal * ivaPct / 100 * 100) / 100
    const total = Math.round((subtotal + iva) * 100) / 100
    return { subtotal, iva, total }
  }

  const totals = detalles.reduce((acc, d) => {
    const r = calcRow(d)
    return { subtotal: acc.subtotal + r.subtotal, iva: acc.iva + r.iva, total: acc.total + r.total }
  }, { subtotal: 0, iva: 0, total: 0 })

  async function guardar() {
    if (!selectedCliente) return setError('Seleccione un cliente')
    if (!motivo.trim()) return setError('Ingrese el motivo')
    const detsValid = detalles.filter(d => d.descripcion && parseFloat(d.precio_unitario) > 0)
    if (detsValid.length === 0) return setError('Agregue al menos un detalle valido')

    setSaving(true)
    setError('')
    try {
      await api.post('/notas-debito/', {
        cliente_id: selectedCliente.id,
        factura_referencia: facturaRef || null,
        motivo,
        detalles: detsValid.map(d => ({
          descripcion: d.descripcion,
          cantidad: parseFloat(d.cantidad) || 1,
          precio_unitario: parseFloat(d.precio_unitario),
          iva_porcentaje: parseFloat(d.iva_porcentaje) || 0,
        })),
      })
      onCreada()
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al guardar')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000 }}>
      <div style={{ background: C.surface, borderRadius: 16, padding: 28, width: 820,
        maxHeight: '92vh', overflowY: 'auto',
        border: `1px solid ${C.bord2}`, boxShadow: '0 25px 60px rgba(0,0,0,.7)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: C.text }}>
            Nueva Nota de Debito
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            cursor: 'pointer', color: C.hint, fontSize: 22 }}>
            <X size={18} />
          </button>
        </div>

        {/* Cliente search */}
        <div style={{ marginBottom: 14 }}>
          <label style={lbl(C)}>Cliente *</label>
          <div style={{ position: 'relative' }}>
            <input value={busqCli}
              onChange={e => { setBusqCli(e.target.value); buscarCliente(e.target.value) }}
              placeholder="Buscar cliente por nombre o RUC..."
              style={{ ...fi, width: '100%' }} />
            {showSearch && clientes.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                background: C.sur2, border: `1px solid ${C.bord2}`, borderRadius: 8,
                maxHeight: 180, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
                {clientes.map(c => (
                  <div key={c.id} onClick={() => seleccionarCliente(c)}
                    style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                      color: C.text, borderBottom: `1px solid ${C.border}` }}
                    onMouseEnter={ev => ev.currentTarget.style.background = C.sur3}
                    onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                    <span style={{ fontWeight: 600 }}>{c.razon_social}</span>
                    <span style={{ color: C.hint, marginLeft: 8, fontFamily: 'monospace', fontSize: 11 }}>
                      {c.identificacion}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {selectedCliente && (
            <div style={{ marginTop: 4, fontSize: 11, color: C.green }}>
              Seleccionado: {selectedCliente.razon_social} ({selectedCliente.identificacion})
            </div>
          )}
        </div>

        {/* Row: Numero + Factura Ref */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={lbl(C)}>Numero (auto)</label>
            <input value={numero} readOnly
              style={{ ...fi, width: '100%', opacity: 0.7 }} />
          </div>
          <div>
            <label style={lbl(C)}>Factura Referencia</label>
            <input value={facturaRef} onChange={e => setFacturaRef(e.target.value)}
              placeholder="001-001-000000001"
              style={{ ...fi, width: '100%' }} />
          </div>
        </div>

        {/* Motivo */}
        <div style={{ marginBottom: 14 }}>
          <label style={lbl(C)}>Motivo *</label>
          <textarea value={motivo} onChange={e => setMotivo(e.target.value)}
            placeholder="Describa el motivo de la nota de debito..."
            rows={3}
            style={{ ...fi, width: '100%', resize: 'vertical', fontFamily: 'inherit' }} />
        </div>

        {/* Detalles */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ ...lbl(C), marginBottom: 0 }}>Detalles</label>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 100px 70px 90px 80px 90px 36px',
              gap: 8, padding: '8px 10px', borderBottom: `1px solid ${C.border}` }}>
              {['Descripcion', 'Cant.', 'P.Unit.', 'IVA %', 'Subtotal', 'IVA', 'Total', ''].map(h => (
                <span key={h} style={{ fontSize: 10, fontWeight: 700, color: C.muted,
                  textTransform: 'uppercase' }}>{h}</span>
              ))}
            </div>

            {/* Rows */}
            {detalles.map((d, idx) => {
              const r = calcRow(d)
              return (
                <div key={idx} style={{ display: 'grid',
                  gridTemplateColumns: '1fr 70px 100px 70px 90px 80px 90px 36px',
                  gap: 8, padding: '6px 10px', borderBottom: `1px solid ${C.border}`,
                  alignItems: 'center' }}>
                  <input value={d.descripcion}
                    onChange={e => updateDetalle(idx, 'descripcion', e.target.value)}
                    placeholder="Descripcion"
                    style={{ ...fi, padding: '5px 6px', fontSize: 11 }} />
                  <input type="number" min="1" value={d.cantidad}
                    onChange={e => updateDetalle(idx, 'cantidad', e.target.value)}
                    style={{ ...fi, padding: '5px 6px', fontSize: 11, textAlign: 'right' }} />
                  <input type="number" step="0.01" value={d.precio_unitario}
                    onChange={e => updateDetalle(idx, 'precio_unitario', e.target.value)}
                    placeholder="0.00"
                    style={{ ...fi, padding: '5px 6px', fontSize: 11, textAlign: 'right' }} />
                  <input type="number" step="1" value={d.iva_porcentaje}
                    onChange={e => updateDetalle(idx, 'iva_porcentaje', e.target.value)}
                    style={{ ...fi, padding: '5px 6px', fontSize: 11, textAlign: 'right' }} />
                  <span style={{ fontSize: 11, color: C.text, textAlign: 'right', paddingRight: 4 }}>
                    {fmt$(r.subtotal)}</span>
                  <span style={{ fontSize: 11, color: C.amber, textAlign: 'right', paddingRight: 4 }}>
                    {fmt$(r.iva)}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.green, textAlign: 'right',
                    paddingRight: 6 }}>
                    {fmt$(r.total)}</span>
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

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <div style={{ background: C.sur2, borderRadius: 10, padding: '10px 20px',
            border: `1px solid ${C.border}`, display: 'flex', gap: 20, alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 10, color: C.muted, display: 'block' }}>SUBTOTAL</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{fmt$(totals.subtotal)}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 10, color: C.muted, display: 'block' }}>IVA</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.amber }}>{fmt$(totals.iva)}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 10, color: C.muted, display: 'block' }}>TOTAL</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: C.green }}>{fmt$(totals.total)}</span>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            background: C.redD, borderRadius: 8, marginBottom: 12,
            border: `1px solid ${C.red}`, color: C.red, fontSize: 12 }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* Buttons */}
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
            {saving ? 'Guardando...' : 'Guardar Nota de Debito'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   Modal: Detalle Nota de Debito
   ════════════════════════════════════════════════════════════ */
function ModalDetalleNotaDebito({ C, data, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000 }}>
      <div style={{ background: C.surface, borderRadius: 16, padding: 28, width: 700,
        maxHeight: '90vh', overflowY: 'auto',
        border: `1px solid ${C.bord2}`, boxShadow: '0 25px 60px rgba(0,0,0,.7)' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <span style={{ fontSize: 16, fontWeight: 800, color: C.text }}>
              Nota de Debito {data.numero}
            </span>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              {String(data.fecha || '').slice(0, 10)}
              {' | '}<Badge estado={data.estado} />
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            cursor: 'pointer', color: C.hint, fontSize: 22 }}><X size={18} /></button>
        </div>

        {/* Info */}
        <div style={{ background: C.sur2, borderRadius: 10, padding: 14, marginBottom: 14,
          border: `1px solid ${C.border}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <span style={{ fontSize: 10, color: C.hint, fontWeight: 600, textTransform: 'uppercase' }}>Cliente</span>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{data.cliente_nombre}</div>
            </div>
            <div>
              <span style={{ fontSize: 10, color: C.hint, fontWeight: 600, textTransform: 'uppercase' }}>RUC/CI</span>
              <div style={{ fontSize: 13, color: C.text, fontFamily: 'monospace' }}>{data.cliente_ruc}</div>
            </div>
            {data.factura_referencia && (
              <div>
                <span style={{ fontSize: 10, color: C.hint, fontWeight: 600, textTransform: 'uppercase' }}>Factura Referencia</span>
                <div style={{ fontSize: 13, color: C.text }}>{data.factura_referencia}</div>
              </div>
            )}
            <div>
              <span style={{ fontSize: 10, color: C.hint, fontWeight: 600, textTransform: 'uppercase' }}>Motivo</span>
              <div style={{ fontSize: 13, color: C.text }}>{data.motivo}</div>
            </div>
          </div>
        </div>

        {/* Detalles */}
        {(data.detalles || []).length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.blue, marginBottom: 6 }}>Detalles</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: C.sur2 }}>
                  {['Descripcion', 'Cant.', 'P.Unit.', 'IVA %', 'Subtotal', 'IVA', 'Total'].map(h => (
                    <th key={h} style={{ padding: '6px 10px', textAlign: 'left',
                      fontWeight: 700, color: C.muted, fontSize: 10, borderBottom: `1px solid ${C.border}` }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data.detalles || []).map((d, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '6px 10px', color: C.text }}>{d.descripcion}</td>
                    <td style={{ padding: '6px 10px', color: C.text, textAlign: 'right' }}>{d.cantidad}</td>
                    <td style={{ padding: '6px 10px', color: C.text, textAlign: 'right' }}>{fmt$(d.precio_unitario)}</td>
                    <td style={{ padding: '6px 10px', color: C.text, textAlign: 'right' }}>{d.iva_porcentaje}%</td>
                    <td style={{ padding: '6px 10px', color: C.text, textAlign: 'right' }}>{fmt$(d.subtotal)}</td>
                    <td style={{ padding: '6px 10px', color: C.amber, textAlign: 'right' }}>{fmt$(d.iva)}</td>
                    <td style={{ padding: '6px 10px', color: C.green, textAlign: 'right', fontWeight: 700 }}>{fmt$(d.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Total */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <div style={{ background: C.sur2, borderRadius: 10, padding: '10px 20px',
            border: `1px solid ${C.border}`, display: 'flex', gap: 20, alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 10, color: C.muted, display: 'block' }}>SUBTOTAL</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{fmt$(data.subtotal)}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 10, color: C.muted, display: 'block' }}>IVA</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.amber }}>{fmt$(data.iva_total)}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 10, color: C.muted, display: 'block' }}>TOTAL</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: C.green }}>{fmt$(data.total)}</span>
            </div>
          </div>
        </div>

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
