import { useState, useEffect } from 'react'
import api from '../api'
import { useTheme } from '../theme'

export default function Depositos() {
  const C = useTheme()
  const [tab, setTab] = useState('pendientes')
  const [pendientes, setPendientes] = useState(null)
  const [depositos, setDepositos] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [selected, setSelected] = useState([])
  const [showCrear, setShowCrear] = useState(false)
  const [crearForm, setCrearForm] = useState({ cuenta_bancaria_id: '', referencia: '', observaciones: '', fecha_deposito: new Date().toISOString().slice(0, 10) })
  const [detalle, setDetalle] = useState(null)
  const [filtroMetodo, setFiltroMetodo] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    try {
      const [pend, deps, ctas] = await Promise.all([
        api.get('/depositos/pendientes'),
        api.get('/depositos'),
        api.get('/bancos/cuentas'),
      ])
      setPendientes(pend.data)
      setDepositos(deps.data)
      setCuentas(ctas.data)
      if (ctas.data.length && !crearForm.cuenta_bancaria_id) {
        setCrearForm(f => ({ ...f, cuenta_bancaria_id: ctas.data[0].id }))
      }
    } catch {}
  }

  function togglePago(id) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }

  function selectAll(pagos) {
    const ids = pagos.map(p => p.id)
    const allSelected = ids.every(id => selected.includes(id))
    if (allSelected) setSelected(s => s.filter(id => !ids.includes(id)))
    else setSelected(s => [...new Set([...s, ...ids])])
  }

  async function crearDeposito() {
    if (!selected.length) return alert('Selecciona al menos un pago')
    if (!crearForm.cuenta_bancaria_id) return alert('Selecciona una cuenta bancaria')
    try {
      await api.post('/depositos', { ...crearForm, pago_ids: selected })
      setSelected([])
      setShowCrear(false)
      cargar()
      setTab('depositos')
    } catch (e) { alert(e.response?.data?.detail || 'Error') }
  }

  async function confirmar(did) {
    const ref = prompt('Numero de comprobante del banco (opcional):')
    try {
      await api.post(`/depositos/${did}/confirmar?referencia_banco=${encodeURIComponent(ref || '')}`)
      cargar()
      setDetalle(null)
    } catch (e) { alert(e.response?.data?.detail || 'Error') }
  }

  async function anular(did) {
    if (!confirm('Anular este deposito? Los pagos volveran a pendientes.')) return
    try {
      await api.post(`/depositos/${did}/anular`)
      cargar()
      setDetalle(null)
    } catch (e) { alert(e.response?.data?.detail || 'Error') }
  }

  async function verDetalle(did) {
    try {
      const { data } = await api.get(`/depositos/${did}`)
      setDetalle(data)
    } catch {}
  }

  const fmt$ = n => `$${Number(n || 0).toFixed(2)}`
  const metodoColor = { EFECTIVO: '#F59E0B', TARJETA: '#3B82F6', TRANSFERENCIA: '#10B981', DEPOSITO: '#8B5CF6', MEDIANET: '#EC4899', DEUNA: '#06B6D4' }

  const pagosFiltrados = pendientes?.pagos?.filter(p => !filtroMetodo || p.forma_pago === filtroMetodo) || []

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.tx }}>Depositos Bancarios</h1>
          <p style={{ fontSize: 13, color: C.hint }}>Liquidacion de cobros: efectivo, voucher, transferencias</p>
        </div>
        {selected.length > 0 && (
          <button onClick={() => setShowCrear(true)} style={{
            padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: C.blue, color: 'white', fontWeight: 700, fontSize: 14,
          }}>Crear deposito ({selected.length} pagos | {fmt$(pagosFiltrados.filter(p => selected.includes(p.id)).reduce((s, p) => s + Number(p.monto), 0))})</button>
        )}
      </div>

      {/* KPIs */}
      {pendientes && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginBottom: 20 }}>
          <div style={{ background: C.sur, borderRadius: 12, padding: 16, border: `1px solid ${C.bord}` }}>
            <div style={{ fontSize: 12, color: C.hint, fontWeight: 600 }}>Pendiente de depositar</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: C.amber }}>{fmt$(pendientes.total_pendiente)}</div>
            <div style={{ fontSize: 12, color: C.hint }}>{pendientes.total_transacciones} transacciones</div>
          </div>
          {pendientes.por_metodo.map(m => (
            <div key={m.metodo} style={{ background: C.sur, borderRadius: 12, padding: 16, border: `1px solid ${C.bord}` }}>
              <div style={{ fontSize: 12, color: C.hint, fontWeight: 600 }}>{m.metodo}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: metodoColor[m.metodo] || C.tx }}>{fmt$(m.total)}</div>
              <div style={{ fontSize: 12, color: C.hint }}>{m.cantidad} pagos</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[{ id: 'pendientes', l: 'Pendientes' }, { id: 'depositos', l: 'Depositos' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: 13,
            background: tab === t.id ? C.blue : C.sur,
            color: tab === t.id ? 'white' : C.tx,
          }}>{t.l}</button>
        ))}
      </div>

      {/* Pendientes */}
      {tab === 'pendientes' && (
        <div style={{ background: C.sur, borderRadius: 14, border: `1px solid ${C.bord}`, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.bord}`, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.tx }}>Filtrar:</span>
            {['', 'EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'DEPOSITO'].map(m => (
              <button key={m} onClick={() => setFiltroMetodo(m)} style={{
                padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: filtroMetodo === m ? (metodoColor[m] || C.blue) : `${C.bord}`,
                color: filtroMetodo === m ? 'white' : C.hint,
              }}>{m || 'Todos'}</button>
            ))}
            {pagosFiltrados.length > 0 && (
              <button onClick={() => selectAll(pagosFiltrados)} style={{
                marginLeft: 'auto', padding: '4px 12px', borderRadius: 6, border: `1px solid ${C.bord}`,
                background: 'transparent', cursor: 'pointer', fontSize: 12, color: C.hint,
              }}>Seleccionar todos</button>
            )}
          </div>
          {pagosFiltrados.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.hint }}>No hay pagos pendientes de depositar</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.bord}` }}>
                  <th style={{ padding: '10px 12px', width: 30 }}></th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: C.hint, fontSize: 11 }}>Fecha</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: C.hint, fontSize: 11 }}>Factura</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: C.hint, fontSize: 11 }}>Cliente</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: C.hint, fontSize: 11 }}>Metodo</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: C.hint, fontSize: 11 }}>Referencia</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', color: C.hint, fontSize: 11 }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {pagosFiltrados.map(p => (
                  <tr key={p.id} onClick={() => togglePago(p.id)} style={{
                    borderBottom: `1px solid ${C.bord}`, cursor: 'pointer',
                    background: selected.includes(p.id) ? `${C.blue}15` : 'transparent',
                  }}>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <input type="checkbox" checked={selected.includes(p.id)} readOnly
                        style={{ cursor: 'pointer', accentColor: C.blue }} />
                    </td>
                    <td style={{ padding: '8px 12px', color: C.tx }}>{String(p.fecha).slice(0, 10)}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: C.tx }}>{p.numero_factura}</td>
                    <td style={{ padding: '8px 12px', color: C.tx }}>{p.cliente}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: `${metodoColor[p.forma_pago] || C.hint}20`,
                        color: metodoColor[p.forma_pago] || C.hint }}>{p.forma_pago}</span>
                    </td>
                    <td style={{ padding: '8px 12px', color: C.hint, fontSize: 12 }}>{p.referencia || '-'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: C.green }}>{fmt$(p.monto)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: `2px solid ${C.bord}` }}>
                  <td colSpan={6} style={{ padding: '10px 12px', fontWeight: 700, color: C.tx }}>
                    {selected.length} seleccionados
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, fontSize: 15, color: C.green }}>
                    {fmt$(pagosFiltrados.filter(p => selected.includes(p.id)).reduce((s, p) => s + Number(p.monto), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {/* Depositos */}
      {tab === 'depositos' && (
        <div style={{ background: C.sur, borderRadius: 14, border: `1px solid ${C.bord}`, overflow: 'hidden' }}>
          {depositos.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.hint }}>No hay depositos creados</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.bord}` }}>
                  {['#', 'Fecha', 'Cuenta', 'Metodos', 'Pagos', 'Total', 'Estado', 'Acciones'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: C.hint, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {depositos.map(d => (
                  <tr key={d.id} style={{ borderBottom: `1px solid ${C.bord}` }}>
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: C.tx }}>{d.id}</td>
                    <td style={{ padding: '8px 12px', color: C.tx }}>{String(d.fecha).slice(0, 10)}</td>
                    <td style={{ padding: '8px 12px', color: C.tx }}>{d.cuenta_nombre} - {d.banco_nombre}</td>
                    <td style={{ padding: '8px 12px' }}>
                      {(d.metodos_pago || '').split(',').map(m => (
                        <span key={m} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, marginRight: 4,
                          background: `${metodoColor[m] || C.hint}20`, color: metodoColor[m] || C.hint }}>{m}</span>
                      ))}
                    </td>
                    <td style={{ padding: '8px 12px', color: C.tx, fontWeight: 600 }}>{d.cantidad_pagos}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: C.green }}>{fmt$(d.total)}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: d.estado === 'CONFIRMADO' ? `${C.green}20` : `${C.amber}20`,
                        color: d.estado === 'CONFIRMADO' ? C.green : C.amber }}>{d.estado}</span>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => verDetalle(d.id)} style={{ padding: '3px 8px', borderRadius: 6, border: `1px solid ${C.bord}`, background: 'transparent', color: C.tx, cursor: 'pointer', fontSize: 11 }}>Ver</button>
                        {d.estado === 'PENDIENTE' && (
                          <>
                            <button onClick={() => confirmar(d.id)} style={{ padding: '3px 8px', borderRadius: 6, border: 'none', background: C.green, color: 'white', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Confirmar</button>
                            <button onClick={() => anular(d.id)} style={{ padding: '3px 8px', borderRadius: 6, border: 'none', background: C.red, color: 'white', cursor: 'pointer', fontSize: 11 }}>Anular</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal Crear Deposito */}
      {showCrear && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000 }}
          onClick={() => setShowCrear(false)}>
          <div style={{ background: C.sur, borderRadius: 16, padding: 28, width: 440, border: `1px solid ${C.bord}`, boxShadow: '0 20px 60px rgba(0,0,0,.5)', colorScheme: C.bg === '#F8FAFC' || C.bg === '#ffffff' ? 'light' : 'dark' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16, color: C.tx, fontSize: 18, fontWeight: 800 }}>Crear Deposito</h3>
            <div style={{ background: `${C.blue}15`, padding: 16, borderRadius: 12, marginBottom: 20, border: `1px solid ${C.blue}30` }}>
              <div style={{ fontSize: 13, color: C.hint, marginBottom: 4 }}>Total a depositar</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: C.blue }}>
                {fmt$(pagosFiltrados.filter(p => selected.includes(p.id)).reduce((s, p) => s + Number(p.monto), 0))}
              </div>
              <div style={{ fontSize: 12, color: C.hint }}>{selected.length} pagos seleccionados</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: C.tx, display: 'block', marginBottom: 6 }}>Cuenta bancaria destino *</label>
                <select value={crearForm.cuenta_bancaria_id} onChange={e => setCrearForm(f => ({ ...f, cuenta_bancaria_id: parseInt(e.target.value) }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.bord}`, background: C.sur, color: C.tx, fontSize: 14, boxSizing: 'border-box' }}>
                  {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre} - {c.numero}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: C.tx, display: 'block', marginBottom: 6 }}>Fecha del deposito</label>
                <input type="date" value={crearForm.fecha_deposito || new Date().toISOString().slice(0, 10)}
                  onChange={e => setCrearForm(f => ({ ...f, fecha_deposito: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.bord}`, background: C.sur, color: C.tx, fontSize: 14, boxSizing: 'border-box', colorScheme: C.bg === '#0F172A' ? 'dark' : 'light' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: C.tx, display: 'block', marginBottom: 6 }}>Referencia / Comprobante</label>
                <input value={crearForm.referencia} onChange={e => setCrearForm(f => ({ ...f, referencia: e.target.value }))}
                  placeholder="Numero de papeleta" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.bord}`, background: C.sur, color: C.tx, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: C.tx, display: 'block', marginBottom: 6 }}>Observaciones</label>
                <textarea value={crearForm.observaciones} onChange={e => setCrearForm(f => ({ ...f, observaciones: e.target.value }))}
                  rows={2} placeholder="Notas adicionales (opcional)"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.bord}`, background: C.bg, color: C.tx, fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={crearDeposito} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: C.blue, color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>Crear deposito</button>
              <button onClick={() => setShowCrear(false)} style={{ padding: '12px 24px', borderRadius: 10, border: `1px solid ${C.bord}`, background: C.bg, color: C.tx, cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle */}
      {detalle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000 }}
          onClick={() => setDetalle(null)}>
          <div style={{ background: C.sur, borderRadius: 16, padding: 28, width: 560, maxHeight: '80vh', overflow: 'auto', border: `1px solid ${C.bord}`, boxShadow: '0 20px 60px rgba(0,0,0,.5)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: C.tx, marginBottom: 16 }}>Deposito #{detalle.id}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div><span style={{ fontSize: 12, color: C.hint }}>Cuenta</span><div style={{ fontWeight: 600, color: C.tx }}>{detalle.cuenta_nombre}</div></div>
              <div><span style={{ fontSize: 12, color: C.hint }}>Banco</span><div style={{ fontWeight: 600, color: C.tx }}>{detalle.banco_nombre}</div></div>
              <div><span style={{ fontSize: 12, color: C.hint }}>Fecha</span><div style={{ fontWeight: 600, color: C.tx }}>{String(detalle.fecha).slice(0, 10)}</div></div>
              <div><span style={{ fontSize: 12, color: C.hint }}>Estado</span><div style={{ fontWeight: 700, color: detalle.estado === 'CONFIRMADO' ? C.green : C.amber }}>{detalle.estado}</div></div>
              <div><span style={{ fontSize: 12, color: C.hint }}>Total</span><div style={{ fontSize: 20, fontWeight: 800, color: C.green }}>{fmt$(detalle.total)}</div></div>
              <div><span style={{ fontSize: 12, color: C.hint }}>Referencia</span><div style={{ fontWeight: 600, color: C.tx }}>{detalle.referencia || '-'}</div></div>
            </div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: C.tx, marginBottom: 8 }}>Pagos incluidos ({detalle.pagos?.length || 0})</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.bord}` }}>
                  {['Fecha', 'Factura', 'Cliente', 'Metodo', 'Monto'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: C.hint, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(detalle.pagos || []).map(p => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${C.bord}` }}>
                    <td style={{ padding: '6px 8px', color: C.tx }}>{String(p.pago_fecha).slice(0, 10)}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 600, color: C.tx }}>{p.numero_factura}</td>
                    <td style={{ padding: '6px 8px', color: C.tx }}>{p.cliente}</td>
                    <td style={{ padding: '6px 8px' }}>
                      <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                        background: `${metodoColor[p.forma_pago] || C.hint}20`, color: metodoColor[p.forma_pago] || C.hint }}>{p.forma_pago}</span>
                    </td>
                    <td style={{ padding: '6px 8px', fontWeight: 700, color: C.green }}>{fmt$(p.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => setDetalle(null)} style={{ marginTop: 16, width: '100%', padding: '8px', borderRadius: 8, border: `1px solid ${C.bord}`, background: 'transparent', color: C.tx, cursor: 'pointer' }}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  )
}
