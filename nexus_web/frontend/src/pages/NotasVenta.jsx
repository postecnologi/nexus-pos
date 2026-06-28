import { useState, useEffect, useRef } from 'react'
import api from '../api'
import { useTheme } from '../theme'

export default function NotasVenta() {
  const C = useTheme()
  const isDark = C.bg === '#0A0F1E'
  const FI = { width:'100%', padding:'10px 14px', borderRadius:10,
    border:`1.5px solid ${isDark?'#334155':'#D1D5DB'}`,
    background:isDark?'#1E293B':'#F9FAFB', color:isDark?'#F1F5F9':'#111827',
    fontSize:14, boxSizing:'border-box', outline:'none' }

  const [notas, setNotas] = useState([])
  const [vista, setVista] = useState('lista')
  const [detalle, setDetalle] = useState(null)
  const [busq, setBusq] = useState('')

  // Form
  const [clientes, setClientes] = useState([])
  const [productos, setProductos] = useState([])
  const [buscaCli, setBuscaCli] = useState('')
  const [buscaProd, setBuscaProd] = useState('')
  const [clienteSel, setClienteSel] = useState(null)
  const [detalles, setDetalles] = useState([])
  const [pagos, setPagos] = useState([{ forma_pago: 'EFECTIVO', monto: 0 }])
  const [obs, setObs] = useState('')
  const [descGlobal, setDescGlobal] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => { cargarNotas() }, [])

  async function cargarNotas() {
    try {
      const { data } = await api.get('/notas-venta', { params: { busqueda: busq, limit: 100 } })
      setNotas(data)
    } catch {}
  }

  async function buscarClientes(q) {
    setBuscaCli(q)
    if (q.length < 2) { setClientes([]); return }
    try { const { data } = await api.get('/clientes', { params: { busqueda: q } }); setClientes(data) } catch {}
  }

  async function buscarProductos(q) {
    setBuscaProd(q)
    if (q.length < 2) { setProductos([]); return }
    try { const { data } = await api.get('/productos/buscar-con-precio', { params: { q } }); setProductos(data) } catch {}
  }

  function agregarProducto(p) {
    const existe = detalles.find(d => d.producto_id === p.id)
    if (existe) {
      setDetalles(ds => ds.map(d => d.producto_id === p.id ? { ...d, cantidad: d.cantidad + 1 } : d))
    } else {
      setDetalles(ds => [...ds, {
        producto_id: p.id, descripcion: p.descripcion || p.nombre, cantidad: 1,
        precio_unitario: p.precio_venta || p.precio || 0, iva_porcentaje: p.iva_porcentaje || 15, descuento_pct: 0,
      }])
    }
    setBuscaProd('')
    setProductos([])
  }

  function quitarProducto(idx) { setDetalles(ds => ds.filter((_, i) => i !== idx)) }
  function updDetalle(idx, k, v) { setDetalles(ds => ds.map((d, i) => i === idx ? { ...d, [k]: v } : d)) }

  const calcTotal = () => {
    let sub0 = 0, subIva = 0, iva = 0
    for (const d of detalles) {
      const sub = d.cantidad * d.precio_unitario * (1 - (d.descuento_pct || 0) / 100) * (1 - descGlobal / 100)
      const ivaVal = sub * d.iva_porcentaje / 100
      if (d.iva_porcentaje > 0) subIva += sub; else sub0 += sub
      iva += ivaVal
    }
    return { sub0, subIva, iva, total: sub0 + subIva + iva }
  }
  const totales = calcTotal()

  async function emitir() {
    if (!clienteSel) return alert('Selecciona un cliente')
    if (!detalles.length) return alert('Agrega al menos un producto')
    const totalPagos = pagos.reduce((s, p) => s + Number(p.monto || 0), 0)
    if (Math.abs(totalPagos - totales.total) > 0.02) {
      pagos[0].monto = totales.total
    }
    setSaving(true)
    try {
      const { data } = await api.post('/notas-venta', {
        cliente_id: clienteSel.id, detalles, pagos,
        observaciones: obs, descuento_global_pct: descGlobal,
      })
      alert(`Nota de Venta ${data.numero} creada - Total: $${data.total}`)
      limpiar()
      cargarNotas()
      setVista('lista')
    } catch (e) { alert(e.response?.data?.detail || 'Error') }
    finally { setSaving(false) }
  }

  function limpiar() {
    setClienteSel(null); setDetalles([]); setPagos([{ forma_pago: 'EFECTIVO', monto: 0 }])
    setObs(''); setDescGlobal(0); setBuscaCli(''); setBuscaProd('')
  }

  async function anular(id) {
    const motivo = prompt('Motivo de anulacion:')
    if (!motivo) return
    try {
      await api.post(`/notas-venta/${id}/anular?motivo=${encodeURIComponent(motivo)}`)
      cargarNotas()
      setDetalle(null)
    } catch (e) { alert(e.response?.data?.detail || 'Error') }
  }

  async function verDetalle(id) {
    try { const { data } = await api.get(`/notas-venta/${id}`); setDetalle(data) } catch {}
  }

  const fmt$ = n => `$${Number(n || 0).toFixed(2)}`

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.tx }}>Notas de Venta</h1>
          <p style={{ fontSize: 13, color: C.hint }}>Comprobantes internos — no van al SRI</p>
        </div>
        <button onClick={() => { limpiar(); setVista(vista === 'nueva' ? 'lista' : 'nueva') }}
          style={{ padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: vista === 'nueva' ? C.red : C.blue, color: 'white', fontWeight: 700 }}>
          {vista === 'nueva' ? 'Cancelar' : '+ Nueva Nota de Venta'}
        </button>
      </div>

      {/* LISTA */}
      {vista === 'lista' && (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
            <input value={busq} onChange={e => setBusq(e.target.value)} onKeyDown={e => e.key === 'Enter' && cargarNotas()}
              placeholder="Buscar por numero o cliente..." style={{ ...FI, maxWidth: 400 }} />
            <button onClick={cargarNotas} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: C.blue, color: 'white', cursor: 'pointer', fontWeight: 600 }}>Buscar</button>
          </div>
          <div style={{ background: C.sur, borderRadius: 14, border: `1px solid ${C.bord}`, overflow: 'hidden' }}>
            {notas.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: C.hint }}>No hay notas de venta</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.bord}` }}>
                    {['Numero', 'Fecha', 'Cliente', 'Total', 'Estado', 'Acciones'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: C.hint, fontSize: 11, fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {notas.map(n => (
                    <tr key={n.id} style={{ borderBottom: `1px solid ${C.bord}` }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: C.tx }}>{n.numero}</td>
                      <td style={{ padding: '10px 12px', color: C.tx }}>{String(n.fecha).slice(0, 10)}</td>
                      <td style={{ padding: '10px 12px', color: C.tx }}>{n.cliente_nombre}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: C.green }}>{fmt$(n.total)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                          background: n.estado === 'ANULADA' ? `${C.red}20` : `${C.green}20`,
                          color: n.estado === 'ANULADA' ? C.red : C.green }}>{n.estado}</span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => verDetalle(n.id)} style={{ padding: '3px 10px', borderRadius: 6, border: `1px solid ${C.bord}`, background: 'transparent', color: C.tx, cursor: 'pointer', fontSize: 11 }}>Ver</button>
                          {n.estado !== 'ANULADA' && (
                            <button onClick={() => anular(n.id)} style={{ padding: '3px 10px', borderRadius: 6, border: 'none', background: `${C.red}20`, color: C.red, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Anular</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* NUEVA */}
      {vista === 'nueva' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
          {/* Left: Products */}
          <div>
            {/* Client search */}
            <div style={{ background: C.sur, borderRadius: 12, padding: 16, border: `1px solid ${C.bord}`, marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.tx, display: 'block', marginBottom: 6 }}>Cliente</label>
              {clienteSel ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: C.tx }}>{clienteSel.razon_social}</div>
                    <div style={{ fontSize: 12, color: C.hint }}>{clienteSel.identificacion}</div>
                  </div>
                  <button onClick={() => setClienteSel(null)} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.bord}`, background: 'transparent', color: C.red, cursor: 'pointer', fontSize: 11 }}>Cambiar</button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <input value={buscaCli} onChange={e => buscarClientes(e.target.value)}
                    placeholder="Buscar por nombre o cedula..." style={FI} />
                  {clientes.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: isDark ? '#1E293B' : 'white', border: `1px solid ${C.bord}`, borderRadius: 8, maxHeight: 200, overflow: 'auto', zIndex: 10 }}>
                      {clientes.map(c => (
                        <div key={c.id} onClick={() => { setClienteSel(c); setClientes([]) }}
                          style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: `1px solid ${C.bord}`, color: C.tx, fontSize: 13 }}>
                          <strong>{c.razon_social}</strong> — {c.identificacion}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Product search */}
            <div style={{ background: C.sur, borderRadius: 12, padding: 16, border: `1px solid ${C.bord}`, marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.tx, display: 'block', marginBottom: 6 }}>Agregar producto</label>
              <div style={{ position: 'relative' }}>
                <input value={buscaProd} onChange={e => buscarProductos(e.target.value)}
                  placeholder="Buscar producto por nombre o codigo..." style={FI} />
                {productos.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: isDark ? '#1E293B' : 'white', border: `1px solid ${C.bord}`, borderRadius: 8, maxHeight: 250, overflow: 'auto', zIndex: 10 }}>
                    {productos.map(p => (
                      <div key={p.id} onClick={() => agregarProducto(p)}
                        style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: `1px solid ${C.bord}`, color: C.tx, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                        <span><strong>{p.codigo}</strong> — {p.descripcion || p.nombre}</span>
                        <span style={{ color: C.green, fontWeight: 700 }}>{fmt$(p.precio_venta || p.precio)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Detail table */}
            <div style={{ background: C.sur, borderRadius: 12, border: `1px solid ${C.bord}`, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.bord}` }}>
                    {['Producto', 'Cant', 'Precio', 'IVA%', 'Subtotal', ''].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: C.hint, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detalles.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center', color: C.hint }}>Agrega productos</td></tr>
                  ) : detalles.map((d, i) => {
                    const sub = d.cantidad * d.precio_unitario * (1 - (d.descuento_pct || 0) / 100)
                    return (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.bord}` }}>
                        <td style={{ padding: '8px 10px', color: C.tx, maxWidth: 200 }}>{d.descripcion}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <input type="number" value={d.cantidad} min={1}
                            onChange={e => updDetalle(i, 'cantidad', parseFloat(e.target.value) || 1)}
                            style={{ ...FI, width: 60, padding: '4px 8px', textAlign: 'center' }} />
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <input type="number" value={d.precio_unitario} step="0.01"
                            onChange={e => updDetalle(i, 'precio_unitario', parseFloat(e.target.value) || 0)}
                            style={{ ...FI, width: 80, padding: '4px 8px', textAlign: 'right' }} />
                        </td>
                        <td style={{ padding: '8px 10px', color: C.hint }}>{d.iva_porcentaje}%</td>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: C.green }}>{fmt$(sub)}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <button onClick={() => quitarProducto(i)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 16 }}>x</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: Totals + Pay */}
          <div>
            <div style={{ background: C.sur, borderRadius: 12, padding: 16, border: `1px solid ${C.bord}`, marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 12 }}>Resumen</h3>
              <div style={{ fontSize: 13, color: C.tx, lineHeight: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal 0%</span><span>{fmt$(totales.sub0)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal IVA</span><span>{fmt$(totales.subIva)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>IVA</span><span>{fmt$(totales.iva)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 18, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.bord}` }}>
                  <span>TOTAL</span><span style={{ color: C.green }}>{fmt$(totales.total)}</span>
                </div>
              </div>
            </div>

            <div style={{ background: C.sur, borderRadius: 12, padding: 16, border: `1px solid ${C.bord}`, marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 12 }}>Forma de pago</h3>
              <select value={pagos[0].forma_pago} onChange={e => setPagos([{ ...pagos[0], forma_pago: e.target.value, monto: totales.total }])}
                style={FI}>
                {['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'DEPOSITO', 'CREDITO'].map(f => (
                  <option key={f} value={f} style={{ background: isDark ? '#1E293B' : 'white', color: isDark ? '#F1F5F9' : '#111827' }}>{f}</option>
                ))}
              </select>
            </div>

            <div style={{ background: C.sur, borderRadius: 12, padding: 16, border: `1px solid ${C.bord}`, marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.tx, display: 'block', marginBottom: 6 }}>Observaciones</label>
              <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2}
                placeholder="Notas (opcional)" style={{ ...FI, resize: 'vertical' }} />
            </div>

            <button onClick={emitir} disabled={saving} style={{
              width: '100%', padding: '14px', borderRadius: 12, border: 'none',
              background: saving ? '#9CA3AF' : C.green, color: 'white',
              fontSize: 16, fontWeight: 700, cursor: saving ? 'default' : 'pointer',
            }}>{saving ? 'Guardando...' : 'Emitir Nota de Venta'}</button>
          </div>
        </div>
      )}

      {/* Modal Detalle */}
      {detalle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000 }}
          onClick={() => setDetalle(null)}>
          <div style={{ background: isDark ? '#0F172A' : '#FFFFFF', borderRadius: 16, padding: 28, width: 560, maxHeight: '85vh', overflow: 'auto', border: `1.5px solid ${isDark ? '#334155' : '#E2E8F0'}` }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ color: isDark ? '#F1F5F9' : '#0F172A', margin: 0 }}>Nota de Venta: {detalle.numero}</h3>
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: detalle.estado === 'ANULADA' ? `${C.red}20` : `${C.green}20`,
                color: detalle.estado === 'ANULADA' ? C.red : C.green }}>{detalle.estado}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16, fontSize: 13, color: isDark ? '#CBD5E1' : '#374151' }}>
              <div><strong>Cliente:</strong> {detalle.cliente_nombre}</div>
              <div><strong>RUC:</strong> {detalle.cliente_ruc}</div>
              <div><strong>Fecha:</strong> {String(detalle.fecha).slice(0, 10)}</div>
              <div><strong>Vendedor:</strong> {detalle.vendedor_nombre || '-'}</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 16 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.bord}` }}>
                  {['Producto', 'Cant', 'Precio', 'Subtotal'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: C.hint, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(detalle.detalles || []).map(d => (
                  <tr key={d.id} style={{ borderBottom: `1px solid ${C.bord}` }}>
                    <td style={{ padding: '6px 8px', color: isDark ? '#E2E8F0' : '#1F2937' }}>{d.producto_nombre || d.descripcion}</td>
                    <td style={{ padding: '6px 8px', color: isDark ? '#E2E8F0' : '#1F2937' }}>{d.cantidad}</td>
                    <td style={{ padding: '6px 8px', color: isDark ? '#E2E8F0' : '#1F2937' }}>{fmt$(d.precio_unitario)}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 700, color: C.green }}>{fmt$(d.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ textAlign: 'right', fontSize: 20, fontWeight: 800, color: C.green, marginBottom: 16 }}>
              Total: {fmt$(detalle.total)}
            </div>
            {detalle.observaciones && <div style={{ padding: 10, background: isDark ? '#1E293B' : '#F3F4F6', borderRadius: 8, fontSize: 12, color: isDark ? '#94A3B8' : '#64748B', marginBottom: 12 }}>{detalle.observaciones}</div>}
            <button onClick={() => setDetalle(null)}
              style={{ width: '100%', padding: '8px', borderRadius: 8, border: `1px solid ${C.bord}`, background: 'transparent', color: C.tx, cursor: 'pointer' }}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  )
}
