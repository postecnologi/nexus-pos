import { useState, useEffect } from 'react'
import { X, Check, Plus, Trash2 } from 'lucide-react'
import StockComboWidget from './StockComboWidget'
import api from '../api'

// ── SeriesTab — gestión de series dentro del modal ──────────
function SeriesTab({ pid, soloVer, bodegas=[] }) {
  const [series,    setSeries]   = useState([])
  const [loading,   setLoading]  = useState(true)
  const [filtro,    setFiltro]   = useState('todas')
  const [busq,      setBusq]     = useState('')
  // Formulario nueva serie
  const [nuevaSerie, setNuevaSerie] = useState('')
  const [bodegaId,   setBodegaId]  = useState('')
  const [guardando,  setGuardando] = useState(false)
  const [msg,        setMsg]       = useState('')
  // Ingreso masivo
  const [masivo,     setMasivo]    = useState(false)
  const [textMasivo, setTextMasivo]= useState('')

  function cargar() {
    if(!pid) return
    setLoading(true)
    api.get(`/productos/${pid}/series`)
      .then(r=>setSeries(r.data||[]))
      .catch(()=>setSeries([]))
      .finally(()=>setLoading(false))
  }
  useEffect(()=>{ cargar() },[pid])

  // Auto-seleccionar primera bodega
  useEffect(()=>{
    if(bodegas.length>0&&!bodegaId)
      setBodegaId(String(bodegas[0].id))
  },[bodegas])

  async function agregarSerie(serie) {
    if(!serie.trim()) return false
    try {
      await api.post(`/productos/${pid}/series`, {
        serie: serie.trim().toUpperCase(),
        bodega_id: bodegaId ? parseInt(bodegaId) : null,
      })
      return true
    } catch(e) {
      const msg = e.response?.data?.detail || e.message
      setMsg(`❌ ${serie}: ${msg}`)
      return false
    }
  }

  async function handleAgregar() {
    if(!nuevaSerie.trim()) return
    setGuardando(true); setMsg('')
    const ok = await agregarSerie(nuevaSerie)
    if(ok) {
      setMsg(`✅ Serie ${nuevaSerie.toUpperCase()} agregada`)
      setNuevaSerie('')
      cargar()
    }
    setGuardando(false)
  }

  async function handleMasivo() {
    const series = textMasivo.split(/[\n,;]+/).map(s=>s.trim()).filter(Boolean)
    if(!series.length) return
    setGuardando(true); setMsg('')
    let ok=0, fail=0
    for(const s of series) {
      const r = await agregarSerie(s)
      r ? ok++ : fail++
    }
    setMsg(`✅ ${ok} agregadas${fail>0?` · ❌ ${fail} fallaron`:''}`)
    setTextMasivo('')
    cargar()
    setGuardando(false)
  }

  async function eliminarSerie(sid) {
    if(!window.confirm('¿Eliminar esta serie?')) return
    try {
      await api.delete(`/series/${sid}`)
      setSeries(p=>p.filter(s=>s.id!==sid))
    } catch(e) { setMsg('❌ '+(e.response?.data?.detail||e.message)) }
  }

  async function cambiarEstado(sid, estado) {
    try {
      await api.patch(`/series/${sid}/estado`, null, {params:{estado}})
      setSeries(p=>p.map(s=>s.id===sid?{...s,estado}:s))
      setMsg(`✅ Estado cambiado a ${estado}`)
    } catch(e) { setMsg('❌ '+(e.response?.data?.detail||e.message)) }
  }

  const seriesFilt = series.filter(s=>{
    const matchF = filtro==='todas'||s.estado?.toLowerCase()===filtro
    const matchB = !busq||s.numero_serie?.toLowerCase().includes(busq.toLowerCase())
      ||s.serie?.toLowerCase().includes(busq.toLowerCase())
    return matchF&&matchB
  })
  const conteo = {
    todas:       series.length,
    disponible:  series.filter(s=>s.estado==='DISPONIBLE').length,
    vendida:     series.filter(s=>s.estado==='VENDIDA').length,
    reservada:   series.filter(s=>s.estado==='RESERVADA').length,
    exhibicion:  series.filter(s=>s.estado==='EXHIBICION').length,
  }
  const EC = {
    DISPONIBLE: {bg:'rgba(16,185,129,.15)', color:'#10B981'},
    VENDIDA:    {bg:'rgba(107,114,128,.15)',color:'#9CA3AF'},
    RESERVADA:  {bg:'rgba(245,158,11,.15)', color:'#F59E0B'},
    TRANSFERIDA:{bg:'rgba(59,130,246,.15)', color:'#3B82F6'},
    DAÑADA:     {bg:'rgba(239,68,68,.15)',  color:'#EF4444'},
    EXHIBICION: {bg:'rgba(139,92,246,.15)', color:'#8B5CF6'},
  }
  const FI = {background:'#1F2937',color:'#F9FAFB',border:'1px solid #374151',
    borderRadius:7,padding:'8px 10px',fontSize:13}

  return(
    <div>
      {/* Formulario ingreso — solo si no es soloVer */}
      {!soloVer&&(
        <div style={{background:'#0F172A',borderRadius:12,padding:16,
          marginBottom:16,border:'1px solid #1E3A5F'}}>
          <div style={{display:'flex',justifyContent:'space-between',
            alignItems:'center',marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:'#A78BFA'}}>
              ➕ Ingresar Series / IMEI
            </div>
            <button onClick={()=>{setMasivo(p=>!p);setMsg('')}}
              style={{fontSize:11,padding:'4px 10px',borderRadius:6,cursor:'pointer',
                border:`1px solid ${masivo?'#A78BFA':'#374151'}`,
                background:masivo?'rgba(139,92,246,.15)':'transparent',
                color:masivo?'#A78BFA':'#6B7280',fontWeight:600}}>
              {masivo?'▲ Uno por uno':'📋 Ingreso masivo'}
            </button>
          </div>

          {/* Bodega selector */}
          <div style={{marginBottom:10}}>
            <label style={{fontSize:10,color:'#6B7280',fontWeight:700,
              textTransform:'uppercase',display:'block',marginBottom:4}}>
              📦 Bodega destino
            </label>
            <select value={bodegaId} onChange={e=>setBodegaId(e.target.value)}
              style={{...FI,width:'100%'}}>
              <option value="">— Sin bodega —</option>
              {bodegas.map(b=>(
                <option key={b.id} value={b.id}>{b.nombre}</option>
              ))}
            </select>
          </div>

          {!masivo ? (
            /* Ingreso individual */
            <div style={{display:'flex',gap:8}}>
              <input
                value={nuevaSerie}
                onChange={e=>setNuevaSerie(e.target.value.toUpperCase())}
                onKeyDown={e=>e.key==='Enter'&&handleAgregar()}
                placeholder="Número de serie / IMEI..."
                style={{...FI,flex:1,fontFamily:'monospace',fontSize:14,
                  fontWeight:700,letterSpacing:'.05em'}}/>
              <button onClick={handleAgregar} disabled={guardando||!nuevaSerie.trim()}
                style={{padding:'8px 18px',borderRadius:7,border:'none',
                  background:guardando||!nuevaSerie.trim()?'#374151':'#8B5CF6',
                  color:'white',cursor:guardando?'wait':'pointer',
                  fontSize:13,fontWeight:700,flexShrink:0}}>
                {guardando?'...':'+ Agregar'}
              </button>
            </div>
          ) : (
            /* Ingreso masivo */
            <div>
              <div style={{fontSize:11,color:'#6B7280',marginBottom:6}}>
                Pega o escribe las series separadas por salto de línea, coma o punto y coma:
              </div>
              <textarea
                value={textMasivo}
                onChange={e=>setTextMasivo(e.target.value.toUpperCase())}
                placeholder={"SN001\nSN002\nSN003"}
                rows={5}
                style={{...FI,width:'100%',fontFamily:'monospace',
                  fontSize:12,resize:'vertical',display:'block',marginBottom:8}}/>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:11,color:'#6B7280'}}>
                  {textMasivo.split(/[\n,;]+/).filter(s=>s.trim()).length} series a ingresar
                </span>
                <button onClick={handleMasivo}
                  disabled={guardando||!textMasivo.trim()}
                  style={{padding:'8px 18px',borderRadius:7,border:'none',
                    background:guardando||!textMasivo.trim()?'#374151':'#8B5CF6',
                    color:'white',cursor:guardando?'wait':'pointer',
                    fontSize:13,fontWeight:700}}>
                  {guardando?'Guardando...':'📋 Ingresar todas'}
                </button>
              </div>
            </div>
          )}

          {/* Mensaje */}
          {msg&&(
            <div style={{marginTop:8,padding:'6px 10px',borderRadius:6,fontSize:12,
              background:msg.startsWith('✅')?'rgba(16,185,129,.12)':'rgba(239,68,68,.12)',
              color:msg.startsWith('✅')?'#10B981':'#EF4444',
              border:`1px solid ${msg.startsWith('✅')?'rgba(16,185,129,.3)':'rgba(239,68,68,.3)'}`}}>
              {msg}
            </div>
          )}
        </div>
      )}

      {/* Contadores */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8,marginBottom:14}}>
        {[['todas','Total','#3B82F6'],['disponible','Disponibles','#10B981'],
          ['vendida','Vendidas','#6B7280'],['reservada','Reservadas','#F59E0B'],
          ['exhibicion','Exhibición','#8B5CF6']].map(([k,l,col])=>(
          <div key={k} onClick={()=>setFiltro(k)}
            style={{background:filtro===k?`${col}22`:'#0F172A',borderRadius:10,
              padding:'10px 14px',cursor:'pointer',
              border:`1.5px solid ${filtro===k?col:'#1E3A5F'}`,transition:'all .15s'}}>
            <div style={{fontSize:10,color:'#6B7280',fontWeight:700,textTransform:'uppercase'}}>{l}</div>
            <div style={{fontSize:22,fontWeight:900,color:filtro===k?col:'#F9FAFB',marginTop:2}}>
              {conteo[k]}
            </div>
          </div>
        ))}
      </div>

      {/* Buscador */}
      <div style={{position:'relative',marginBottom:12}}>
        <span style={{position:'absolute',left:10,top:'50%',
          transform:'translateY(-50%)',color:'#6B7280',fontSize:13}}>🔍</span>
        <input value={busq} onChange={e=>setBusq(e.target.value)}
          placeholder="Buscar número de serie / IMEI..."
          style={{...FI,paddingLeft:32,width:'100%'}}/>
      </div>

      {/* Tabla */}
      {loading ? (
        <div style={{textAlign:'center',padding:30,color:'#6B7280'}}>Cargando...</div>
      ) : seriesFilt.length===0 ? (
        <div style={{textAlign:'center',padding:30,color:'#6B7280',fontSize:13}}>
          {busq?'Sin resultados para esa búsqueda':'Sin series registradas — usa el formulario de arriba'}
        </div>
      ) : (
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{background:'#1F2937'}}>
              {['#','Serie / IMEI','Estado','Bodega','Factura','Acciones'].map((h,i)=>(
                <th key={i} style={{padding:'9px 12px',textAlign:'left',
                  fontSize:10,fontWeight:700,color:'#6B7280',textTransform:'uppercase'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {seriesFilt.map((s,i)=>{
              const est = EC[s.estado]||{bg:'#1F2937',color:'#9CA3AF'}
              const serie = s.numero_serie||s.serie||'—'
              return(
                <tr key={s.id||i} style={{borderBottom:'1px solid #1F2937',
                  background:i%2===0?'transparent':'rgba(255,255,255,.01)'}}>
                  <td style={{padding:'9px 12px',color:'#6B7280',fontSize:11}}>{i+1}</td>
                  <td style={{padding:'9px 12px'}}>
                    <code style={{color:'#A78BFA',fontSize:12,fontWeight:700}}>{serie}</code>
                  </td>
                  <td style={{padding:'9px 12px'}}>
                    <span style={{padding:'2px 10px',borderRadius:20,fontSize:11,
                      fontWeight:700,background:est.bg,color:est.color}}>
                      {s.estado||'—'}
                    </span>
                  </td>
                  <td style={{padding:'9px 12px',fontSize:12,color:'#9CA3AF'}}>{s.bodega_nombre||'—'}</td>
                  <td style={{padding:'9px 12px',fontSize:11,color:'#6B7280'}}>{s.factura_numero||'—'}</td>
                  <td style={{padding:'9px 6px'}}>
                    {!soloVer&&!['VENDIDA','TRANSFERIDA'].includes(s.estado)&&(
                      <div style={{display:'flex',gap:4,alignItems:'center'}}>
                        {/* Cambiar estado */}
                        <select
                          value={s.estado}
                          onChange={e=>cambiarEstado(s.id,e.target.value)}
                          style={{fontSize:10,padding:'3px 5px',borderRadius:5,
                            background:'#1F2937',color:'#9CA3AF',
                            border:'1px solid #374151',cursor:'pointer'}}>
                          <option value="DISPONIBLE">Disponible</option>
                          <option value="EXHIBICION">Exhibición</option>
                          <option value="RESERVADA">Reservada</option>
                          <option value="DAÑADA">Dañada</option>
                        </select>
                        {/* Eliminar solo disponibles */}
                        {s.estado==='DISPONIBLE'&&(
                          <button onClick={()=>eliminarSerie(s.id)}
                            title="Eliminar serie"
                            style={{background:'none',border:'none',cursor:'pointer',
                              padding:'3px 5px',color:'#374151'}}
                            onMouseEnter={e=>e.currentTarget.style.color='#EF4444'}
                            onMouseLeave={e=>e.currentTarget.style.color='#374151'}>
                            <Trash2 size={12}/>
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

function Field({ label, children, required, half }) {
  return (
    <div style={{ marginBottom: 12, flex: half ? '0 0 calc(50% - 6px)' : '1 1 100%' }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', display: 'block', marginBottom: 4 }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
      </label>
      {children}
    </div>
  )
}

const TABS = ['Datos', 'Costos y Precios', 'Ofertas', 'Stock x Bodega', 'Series', 'Combo', 'Lotes']

export default function ModalProducto({ open, onClose, producto, marcas, categorias, tiposPrecio, bodegas, onGuardado, soloVer = false, tabInicial = 0 }) {
  const esNuevo  = !producto?.id && !soloVer
  const [tab, setTab] = useState(tabInicial)
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  // ── Pestaña 1: Datos ──────────────────────────────────
  const [unidades, setUnidades] = useState([])
  useEffect(() => {
    api.get('/unidades-medida').then(r => setUnidades(r.data||[])).catch(() => {})
  }, [])

  const blank = {
    codigo:'', descripcion:'', marca_id:'', categoria_id:'',
    iva_porcentaje:15, aplica_series:false, activo:true,
    clase:'MERCADERIA', tipo_producto:'SIMPLE', es_compuesto:false,
    unidad_medida_id:'',
  }
  const [form, setForm] = useState(blank)

  // ── Pestaña 2: Costos y Precios ───────────────────────
  const [costo, setCosto]   = useState(0)
  const [costos, setCostos] = useState({ costo_actual: 0, costo_anterior: 0, costo_promedio: 0 })
  const [costoCombo, setCostoCombo] = useState(null)  // costo calculado desde componentes
  const esCombo = form.tipo_producto === 'COMBO'
  const [precios, setPrecios] = useState([])

  // ── Pestaña 3: Ofertas ────────────────────────────────
  const [ofertas, setOfertas]     = useState([])
  const [formOferta, setFormOferta] = useState({
    tipo_precio_id: '', precio_oferta: 0,
    fecha_inicio: new Date().toISOString().slice(0,10),
    fecha_fin: '', descripcion: ''
  })

  // ── Pestaña 4: Stock x Bodega ─────────────────────────
  const [stockBod, setStockBod] = useState([])

  // ── Pestaña 5: Combo ──────────────────────────────────
  const [componentes, setComponentes] = useState([])
  const [busComp, setBusComp]         = useState('')
  const [resComp, setResComp]         = useState([])
  const [cantComp, setCantComp]       = useState(1)

  // ── Pestaña 6: Lotes ──────────────────────────────────────
  const [lotes, setLotes]             = useState([])
  const [formLote, setFormLote]       = useState({ lote:'', bodega_id:'', fecha_fabricacion:'', fecha_vencimiento:'', cantidad:0 })

  // Cargar datos al abrir
  useEffect(() => { setTab(tabInicial) }, [tabInicial, open])

  useEffect(() => {
    if (!open) return
    setTab(0); setMsg('')
    if (producto) {
      setForm({
        codigo:         producto.codigo || '',
        descripcion:    producto.descripcion || '',
        marca_id:       producto.marca_id != null ? String(producto.marca_id) : '',
        categoria_id:   producto.categoria_id != null ? String(producto.categoria_id) : '',
        iva_porcentaje: producto.iva_porcentaje || 15,
        aplica_series:  producto.aplica_series || false,
        activo:         producto.activo !== false,
        clase:          producto.clase || 'MERCADERIA',
        tipo_producto:  producto.es_compuesto ? 'COMBO' : 'SIMPLE',
        unidad_medida_id: producto.unidad_medida_id != null ? String(producto.unidad_medida_id) : '',
      })
      cargarExtras(producto.id)
    } else {
      setForm(blank)
      setCosto(0)
      setPrecios(tiposPrecio.map(t => ({ tipo_precio_id: t.id, nombre: t.nombre, precio: 0 })))
      setOfertas([]); setStockBod([]); setComponentes([])
    }
  }, [open, producto])

  async function cargarCostoCombo(pid) {
    try {
      const { data } = await api.get(`/productos/${pid}/costo-combo`)
      setCostoCombo(data)
      return data
    } catch { return null }
  }

  async function cargarExtras(pid) {
    const [pr, of, st, co] = await Promise.all([
      api.get(`/productos/${pid}/precios`).catch(() => ({ data: [] })),
      api.get(`/productos/${pid}/ofertas`).catch(() => ({ data: [] })),
      api.get(`/productos/${pid}/stock`).catch(() => ({ data: [] })),
      api.get(`/productos/${pid}/componentes`).catch(() => ({ data: [] })),
    ])
    // Precios — combinar con tipos disponibles
    const pMap = {}
    pr.data.forEach(p => { pMap[p.tipo_precio_id] = p.precio })
    setPrecios(tiposPrecio.map(t => ({
      tipo_precio_id: t.id, nombre: t.nombre,
      precio: pMap[t.id] || 0
    })))
    // Los 3 costos
    const { data: costoData } = await api.get(`/productos/${pid}/costos`).catch(() => ({ data: {} }))
    setCostos({
      costo_actual:    costoData.costo_actual    || 0,
      costo_anterior:  costoData.costo_anterior  || 0,
      costo_promedio:  costoData.costo_promedio  || 0,
    })
    setCosto(costoData.costo_actual || 0)
    // Cargar costo combo si aplica
    cargarCostoCombo(pid)
    setOfertas(of.data)
    setStockBod(st.data)
    setComponentes(co.data)
    // Cargar lotes
    api.get(`/productos/${pid}/lotes`).then(r => setLotes(r.data||[])).catch(() => setLotes([]))
  }

  async function guardar() {
    if (!form.codigo || !form.descripcion) {
      setMsg('⚠️ Código y descripción son obligatorios'); return
    }
    setSaving(true); setMsg('')
    try {
      const body = { 
        ...form, 
        marca_id:     form.marca_id     ? parseInt(form.marca_id)     : null,
        categoria_id: form.categoria_id ? parseInt(form.categoria_id) : null,
        es_compuesto: form.tipo_producto === 'COMBO',
        unidad_medida_id: form.unidad_medida_id ? parseInt(form.unidad_medida_id) : null,
      }
      let pid = producto?.id
      if (esNuevo) {
        const { data } = await api.post('/productos', body); pid = data.id
      } else {
        await api.put(`/productos/${pid}`, body)
      }
      // Costo
      if (costo > 0) await api.post(`/productos/${pid}/costo`, { costo: parseFloat(costo) })
      // Precios
      for (const p of precios) {
        if (p.precio > 0) await api.post(`/productos/${pid}/precios`, {
          tipo_precio_id: p.tipo_precio_id, precio: parseFloat(p.precio)
        })
      }
      onGuardado(); onClose()
    } catch (e) {
      setMsg('❌ ' + (e.response?.data?.detail || e.message))
    } finally { setSaving(false) }
  }

  async function agregarOferta() {
    if (!formOferta.tipo_precio_id || !formOferta.precio_oferta) {
      setMsg('⚠️ Tipo de precio y precio oferta son obligatorios'); return
    }
    await api.post(`/productos/${producto?.id}/ofertas`, {
      ...formOferta,
      precio_oferta: parseFloat(formOferta.precio_oferta),
      tipo_precio_id: parseInt(formOferta.tipo_precio_id),
    })
    const { data } = await api.get(`/productos/${producto?.id}/ofertas`)
    setOfertas(data)
    setFormOferta({ tipo_precio_id: '', precio_oferta: 0, fecha_inicio: new Date().toISOString().slice(0,10), fecha_fin: '', descripcion: '' })
  }

  async function eliminarOferta(oid) {
    await api.delete(`/ofertas/${oid}`)
    setOfertas(ofertas.filter(o => o.id !== oid))
  }

  async function buscarComponentes(txt) {
    setBusComp(txt)
    if (txt.length < 2) { setResComp([]); return }
    const { data } = await api.get('/productos', { params: { busqueda: txt, activo: 'true' } })
    setResComp(data.filter(p => p.id !== producto?.id).slice(0, 8))
  }

  async function agregarComponente(comp) {
    setResComp([]); setBusComp('')
    await api.post(`/productos/${producto?.id}/componentes`, {
      componente_id: comp.id, cantidad: cantComp
    })
    const { data } = await api.get(`/productos/${producto?.id}/componentes`)
    setComponentes(data)
    // Recalcular costo del combo automáticamente
    cargarCostoCombo(producto?.id)
  }

  async function eliminarComponente(cid) {
    await api.delete(`/productos/${producto?.id}/componentes/${cid}`)
    setComponentes(componentes.filter(c => c.componente_id !== cid))
    cargarCostoCombo(producto?.id)
  }

  if (!open) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
    }}>
      <div style={{
        background: '#111827', borderRadius: 16, width: 740,
        maxWidth: '96vw', maxHeight: '92vh', display: 'flex',
        flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
        border: '1px solid #374151',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 24px', borderBottom: '1px solid #374151',
          background: 'linear-gradient(135deg,rgba(139,92,246,.12),rgba(59,130,246,.08))',
          borderRadius: '16px 16px 0 0',
        }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#F9FAFB', margin: 0 }}>
              {soloVer ? `👁️ ${producto?.descripcion?.substring(0,40)}` : esNuevo ? '➕ Nuevo Producto' : `✏️ ${producto?.descripcion?.substring(0,40)}`}
            </h2>
            {producto?.codigo && <div style={{fontSize:11,color:'#6B7280',marginTop:2}}>
              Código: <code style={{color:'#8B5CF6'}}>{producto.codigo}</code>
            </div>}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {soloVer && (
              <span style={{
                background: 'rgba(59,130,246,.15)', color: '#60A5FA',
                fontSize: 11, fontWeight: 700, padding: '3px 10px',
                borderRadius: 20, border: '1px solid rgba(59,130,246,.3)'
              }}>👁️ Solo lectura</span>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer',
              color: '#6B7280', padding: 4, borderRadius: 6 }}
              onMouseEnter={e=>e.currentTarget.style.color='#EF4444'}
              onMouseLeave={e=>e.currentTarget.style.color='#6B7280'}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #374151', padding: '0 20px', background: '#111827', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {TABS.map((t, i) => (
            <button key={i} onClick={() => setTab(i)} style={{
              padding: '10px 14px', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, background: 'transparent', whiteSpace: 'nowrap',
              borderBottom: tab === i ? '2px solid #8B5CF6' : '2px solid transparent',
              color: tab === i ? '#A78BFA' : '#6B7280',
              transition: 'all 0.15s',
            }}>{t}</button>
          ))}
        </div>

        {/* Contenido */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24, background: '#111827' }}>

          {/* ── PESTAÑA 1: DATOS ── */}
          {tab === 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <Field label="Código" required half>
                <input value={form.codigo}
                  onChange={e => !soloVer && setForm({...form, codigo: e.target.value.toUpperCase()})}
                  placeholder="Ej: 001-SAM" disabled={soloVer}
                  style={{background:'#1F2937',color:'#F9FAFB',border:'1px solid #374151',borderRadius:7,padding:'8px 10px',width:'100%',fontSize:13,opacity:soloVer?0.6:1}} />
              </Field>
              <Field label="Clase" half>
                <select value={form.clase} onChange={e => setForm({...form, clase: e.target.value})}
                  style={{background:'#1F2937',color:'#F9FAFB',border:'1px solid #374151',borderRadius:7,padding:'8px 10px',width:'100%',fontSize:13}}>
                  <option value="MERCADERIA">Mercadería</option>
                  <option value="SERVICIO">Servicio</option>
                  <option value="ACTIVO FIJO">Activo fijo</option>
                </select>
              </Field>
              <Field label="Descripción" required>
                <input value={form.descripcion}
                  onChange={e => !soloVer && setForm({...form, descripcion: e.target.value.toUpperCase()})}
                  placeholder="Nombre completo del producto" disabled={soloVer}
                  style={{background:'#1F2937',color:'#F9FAFB',border:'1px solid #374151',borderRadius:7,padding:'8px 10px',width:'100%',fontSize:13,opacity:soloVer?0.6:1}} />
              </Field>
              <Field label="Marca" half>
                <select value={form.marca_id} onChange={e => setForm({...form, marca_id: e.target.value})}
                  style={{background:'#1F2937',color:'#F9FAFB',border:'1px solid #374151',borderRadius:7,padding:'8px 10px',width:'100%',fontSize:13}}>
                  <option value="">— Sin marca —</option>
                  {marcas.map(m => <option key={m.id} value={String(m.id)}>{m.nombre}</option>)}
                </select>
              </Field>
              <Field label="Categoría" half>
                <select value={form.categoria_id} onChange={e => setForm({...form, categoria_id: e.target.value})}
                  style={{background:'#1F2937',color:'#F9FAFB',border:'1px solid #374151',borderRadius:7,padding:'8px 10px',width:'100%',fontSize:13}}>
                  <option value="">— Sin categoría —</option>
                  {categorias.map(c => <option key={c.id} value={String(c.id)}>{c.nombre}</option>)}
                </select>
              </Field>
              <Field label="IVA %" half>
                <select value={form.iva_porcentaje}
                  onChange={e => setForm({...form, iva_porcentaje: Number(e.target.value)})}
                  style={{background:'#1F2937',color:'#F9FAFB',border:'1px solid #374151',borderRadius:7,padding:'8px 10px',width:'100%',fontSize:13}}>
                  <option value={0}>0% — Sin IVA</option>
                  <option value={5}>5%</option>
                  <option value={12}>12%</option>
                  <option value={15}>15%</option>
                </select>
              </Field>
              <Field label="Tipo de producto" half>
                <select value={form.tipo_producto}
                  onChange={e => setForm({...form, tipo_producto: e.target.value})}
                  style={{background:'#1F2937',color:'#F9FAFB',border:'1px solid #374151',borderRadius:7,padding:'8px 10px',width:'100%',fontSize:13}}>
                  <option value="SIMPLE">Simple</option>
                  <option value="COMBO">Combo / Compuesto</option>
                  <option value="SERVICIO">Servicio</option>
                </select>
              </Field>
              <Field label="Unidad de Medida" half>
                <select value={form.unidad_medida_id || ''}
                  onChange={e => setForm({...form, unidad_medida_id: e.target.value})}
                  style={{background:'#1F2937',color:'#F9FAFB',border:'1px solid #374151',borderRadius:7,padding:'8px 10px',width:'100%',fontSize:13}}>
                  <option value="">-- Sin unidad --</option>
                  {(unidades||[]).map(u => <option key={u.id} value={String(u.id)}>{u.nombre} ({u.abreviatura})</option>)}
                </select>
              </Field>
              <div style={{ display: 'flex', gap: 20, width: '100%', marginTop: 4 }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13,
                  cursor: 'pointer', color: '#9CA3AF' }}>
                  <input type="checkbox" checked={form.activo}
                    onChange={e => setForm({...form, activo: e.target.checked})}
                    style={{ width: 'auto', accentColor:'#10B981' }} />
                  Producto activo
                </label>
              </div>
            </div>
          )}

          {/* ── PESTAÑA 2: COSTOS Y PRECIOS ── */}
          {tab === 1 && (
            <div>
              {/* Los 3 costos */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div style={{ background: '#0F172A', borderRadius: 10, padding: 14, border:'1px solid #1E3A5F' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6 }}>COSTO ANTERIOR</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#94A3B8' }}>
                    ${Number(costos.costo_anterior || 0).toFixed(2)}
                  </div>
                  <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>Solo lectura</div>
                </div>
                <div style={{ background: '#0F172A', borderRadius: 10, padding: 14, border:'1px solid #1E3A5F' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#3B82F6', marginBottom: 6 }}>COSTO PROMEDIO</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#60A5FA' }}>
                    ${Number(costos.costo_promedio || 0).toFixed(2)}
                  </div>
                  <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>Calculado automáticamente</div>
                </div>
                <div style={{ background: '#0F172A', borderRadius: 10, padding: 14, border:'1px solid #10B98133' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#10B981', marginBottom: 6 }}>
                    COSTO ACTUAL *
                    {costoCombo?.tiene_componentes && (
                      <span style={{ marginLeft: 6, background: 'rgba(16,185,129,.2)', color: '#10B981',
                        fontSize: 9, padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>
                        COMBO
                      </span>
                    )}
                  </div>
                  <input type="number" step="0.01" value={costo}
                    onChange={e => !soloVer && setCosto(e.target.value)}
                    disabled={soloVer}
                    style={{ fontSize: 18, fontWeight: 700, color: '#10B981',
                      background: 'transparent', border: 'none',
                      borderBottom: soloVer ? '1px solid #374151' : '2px solid #10B981',
                      borderRadius: 0, padding: '2px 0', width: '100%' }} />
                  <div style={{ fontSize: 10, color: '#166534', marginTop: 2 }}>Editable</div>
                </div>
              </div>

              {/* Precios de venta */}
              <div style={{ fontSize: 13, fontWeight: 700, color: '#A78BFA', marginBottom: 12, textTransform:'uppercase', letterSpacing:'.05em' }}>
                🏷️ Precios de venta por tipo
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                {precios.map((p, i) => {
                  const costoNum  = parseFloat(costo) || 0
                  const ivaNum    = parseFloat(form.iva_porcentaje) || 0
                  // p.precio guarda la BASE — calculamos PVP para mostrar
                  const baseNum   = parseFloat(p.precio) || 0
                  const pvp       = parseFloat((baseNum * (1 + ivaNum/100)).toFixed(2))
                  const ivaVal    = parseFloat((baseNum * ivaNum / 100).toFixed(2))
                  // Ganancia respecto al costo
                  const ganancia  = costoNum > 0 && baseNum > 0 ? baseNum - costoNum : 0
                  const margenPct = costoNum > 0 && baseNum > 0
                    ? ((baseNum - costoNum) / costoNum * 100).toFixed(1) : null
                  const bajoCosto = costoNum > 0 && baseNum > 0 && baseNum < costoNum

                  function setPvp(val) {
                    // Usuario ingresa PVP → calcular base
                    const pvpN = parseFloat(val) || 0
                    const base = parseFloat((pvpN / (1 + ivaNum/100)).toFixed(4))
                    const np = [...precios]
                    np[i] = { ...p, precio: base }
                    setPrecios(np)
                  }

                  function setMargen(val) {
                    // Usuario ingresa % margen → recalcular base y PVP
                    const pct = parseFloat(val) || 0
                    if(costoNum <= 0) return
                    const base = parseFloat((costoNum * (1 + pct/100)).toFixed(4))
                    const np = [...precios]
                    np[i] = { ...p, precio: base }
                    setPrecios(np)
                  }

                  return (
                    <div key={i} style={{
                      background: bajoCosto ? 'rgba(239,68,68,.08)' : '#0F172A',
                      borderRadius: 12, padding: 16,
                      border: `1.5px solid ${bajoCosto ? '#EF4444' : '#1E3A5F'}`
                    }}>
                      {/* Nombre del tipo */}
                      <div style={{fontSize:12,fontWeight:700,color:'#94A3B8',
                        marginBottom:10,textTransform:'uppercase',letterSpacing:'.05em'}}>
                        {p.nombre}
                      </div>

                      {/* Input PVP — campo principal */}
                      <div style={{marginBottom:10}}>
                        <label style={{fontSize:10,color:'#F59E0B',display:'block',
                          marginBottom:4,fontWeight:700,textTransform:'uppercase'}}>
                          💲 Precio con IVA (PVP)
                        </label>
                        <input type="number" step="0.01"
                          value={pvp || ''}
                          onChange={e => setPvp(e.target.value)}
                          placeholder="0.00"
                          style={{fontSize:20,fontWeight:900,
                            color: bajoCosto?'#EF4444':'#F59E0B',
                            background:'#1E293B',
                            border:`2px solid ${bajoCosto?'#EF4444':'#F59E0B'}44`,
                            borderRadius:8,padding:'8px 10px',width:'100%'}}/>
                      </div>

                      {/* Desglose calculado */}
                      <div style={{background:'#1E293B',borderRadius:8,padding:'10px 12px',
                        border:'1px solid #334155',marginBottom:10}}>
                        <div style={{display:'flex',justifyContent:'space-between',
                          fontSize:11,marginBottom:5}}>
                          <span style={{color:'#64748B'}}>Base (sin IVA):</span>
                          <span style={{color:'#F1F5F9',fontWeight:700}}>${baseNum.toFixed(2)}</span>
                        </div>
                        <div style={{display:'flex',justifyContent:'space-between',
                          fontSize:11,marginBottom:5}}>
                          <span style={{color:'#64748B'}}>IVA {ivaNum}%:</span>
                          <span style={{color:'#F59E0B',fontWeight:700}}>+${ivaVal.toFixed(2)}</span>
                        </div>
                        <div style={{display:'flex',justifyContent:'space-between',
                          fontSize:12,fontWeight:800,paddingTop:5,
                          borderTop:'1px solid #334155'}}>
                          <span style={{color:'#94A3B8'}}>PVP:</span>
                          <span style={{color:'#10B981'}}>${pvp.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Ganancia editable */}
                      {costoNum > 0 && (
                        <div style={{background:'#0A0F1E',borderRadius:8,padding:'10px 12px',
                          border:`1px solid ${bajoCosto?'#EF444444':'#10B98133'}`}}>
                          <div style={{fontSize:10,color:'#64748B',fontWeight:700,
                            textTransform:'uppercase',marginBottom:8}}>
                            📊 Margen sobre costo
                          </div>
                          <div style={{display:'flex',gap:8,alignItems:'center'}}>
                            {/* % editable */}
                            <div style={{flex:1}}>
                              <label style={{fontSize:9,color:'#64748B',display:'block',marginBottom:3}}>
                                % Margen
                              </label>
                              <div style={{display:'flex',alignItems:'center',gap:4}}>
                                <input type="number" step="0.1"
                                  value={margenPct||''}
                                  onChange={e => setMargen(e.target.value)}
                                  placeholder="0"
                                  style={{width:70,fontSize:14,fontWeight:800,
                                    color:bajoCosto?'#EF4444':'#10B981',
                                    background:'#1E293B',
                                    border:`1px solid ${bajoCosto?'#EF4444':'#10B981'}44`,
                                    borderRadius:6,padding:'5px 6px',textAlign:'center'}}/>
                                <span style={{color:'#64748B',fontSize:13}}>%</span>
                              </div>
                            </div>
                            {/* Ganancia calculada */}
                            <div style={{flex:1}}>
                              <label style={{fontSize:9,color:'#64748B',display:'block',marginBottom:3}}>
                                Ganancia $
                              </label>
                              <div style={{fontSize:14,fontWeight:800,
                                color:bajoCosto?'#EF4444':'#10B981',
                                padding:'5px 6px'}}>
                                {bajoCosto?'-':'+'}{Math.abs(ganancia).toFixed(2)}
                              </div>
                            </div>
                            {/* Costo referencia */}
                            <div style={{flex:1}}>
                              <label style={{fontSize:9,color:'#64748B',display:'block',marginBottom:3}}>
                                Costo base
                              </label>
                              <div style={{fontSize:12,color:'#64748B',padding:'5px 6px'}}>
                                ${costoNum.toFixed(2)}
                              </div>
                            </div>
                          </div>
                          {bajoCosto && (
                            <div style={{fontSize:10,color:'#EF4444',
                              marginTop:6,fontWeight:600}}>
                              ⚠️ Estás vendiendo por debajo del costo
                            </div>
                          )}
                          {/* Botones rápidos de margen */}
                          <div style={{display:'flex',gap:4,marginTop:8,flexWrap:'wrap'}}>
                            {[10,20,30,40,50].map(m=>(
                              <button key={m} onClick={()=>setMargen(m)}
                                style={{padding:'3px 8px',borderRadius:6,cursor:'pointer',
                                  fontSize:10,fontWeight:700,border:'none',
                                  background: margenPct && Math.abs(parseFloat(margenPct)-m)<0.5
                                    ? '#10B981' : '#1E293B',
                                  color: margenPct && Math.abs(parseFloat(margenPct)-m)<0.5
                                    ? 'white' : '#64748B'}}>
                                {m}%
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── PESTAÑA 3: OFERTAS ── */}
          {tab === 2 && (
            <div>
              {esNuevo ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>
                  Guarda el producto primero para agregar ofertas
                </div>
              ) : (
                <>
                  {/* Formulario nueva oferta */}
                  <div style={{ background: '#0F172A', borderRadius: 10, padding: 16, marginBottom: 20,
                    border: '1.5px solid #1E3A5F' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B', marginBottom: 12 }}>
                      🏷️ Nueva oferta
                    </div>
                    {/* Desglose del precio de oferta */}
                    {parseFloat(formOferta.precio_oferta) > 0 && (
                      <div style={{background:'#1E293B',borderRadius:8,padding:'10px 14px',
                        marginBottom:12,border:'1px solid #334155',
                        display:'flex',gap:20,alignItems:'center',flexWrap:'wrap'}}>
                        {(() => {
                          const pvp     = parseFloat(formOferta.precio_oferta)||0
                          const iva     = parseFloat(form.iva_porcentaje)||0
                          const base    = parseFloat((pvp/(1+iva/100)).toFixed(4))
                          const ivaVal  = parseFloat((pvp-base).toFixed(4))
                          return <>
                            <div>
                              <div style={{fontSize:9,color:'#64748B',fontWeight:600,textTransform:'uppercase'}}>Base sin IVA</div>
                              <div style={{fontSize:15,fontWeight:800,color:'#F1F5F9'}}>${base.toFixed(2)}</div>
                            </div>
                            <div style={{fontSize:16,color:'#334155'}}>+</div>
                            <div>
                              <div style={{fontSize:9,color:'#64748B',fontWeight:600,textTransform:'uppercase'}}>IVA {iva}%</div>
                              <div style={{fontSize:15,fontWeight:800,color:'#F59E0B'}}>${ivaVal.toFixed(2)}</div>
                            </div>
                            <div style={{fontSize:16,color:'#334155'}}>=</div>
                            <div>
                              <div style={{fontSize:9,color:'#64748B',fontWeight:600,textTransform:'uppercase'}}>PVP (precio ingresado)</div>
                              <div style={{fontSize:17,fontWeight:900,color:'#10B981'}}>${pvp.toFixed(2)}</div>
                            </div>
                            {/* Comparar con precio normal */}
                            {precios.length>0&&precios[0].precio>0&&(
                              <div style={{marginLeft:'auto',padding:'6px 12px',borderRadius:8,
                                background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.3)'}}>
                                <div style={{fontSize:9,color:'#64748B',textTransform:'uppercase'}}>Descuento vs precio normal</div>
                                <div style={{fontSize:13,fontWeight:800,color:'#EF4444'}}>
                                  -{(((parseFloat(precios[0].precio)*(1+parseFloat(form.iva_porcentaje)/100))-pvp)/
                                    (parseFloat(precios[0].precio)*(1+parseFloat(form.iva_porcentaje)/100))*100).toFixed(1)}%
                                </div>
                              </div>
                            )}
                          </>
                        })()}
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: 3 }}>Tipo precio</label>
                        <select value={formOferta.tipo_precio_id}
                          onChange={e => setFormOferta({...formOferta, tipo_precio_id: e.target.value})}
                          style={{background:'#1E293B',color:'#F1F5F9',border:'1px solid #334155',
                            borderRadius:6,padding:'6px 8px',width:'100%'}}>
                          <option value="">Selecciona...</option>
                          {tiposPrecio.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: 3 }}>
                          Precio oferta $ <span style={{color:'#F59E0B',fontWeight:400}}>(con IVA incluido)</span>
                        </label>
                        <input type="number" step="0.01" value={formOferta.precio_oferta}
                          onChange={e => setFormOferta({...formOferta, precio_oferta: e.target.value})}
                          style={{background:'#1E293B',color:'#F59E0B',border:'1px solid #F59E0B44',
                            borderRadius:6,padding:'6px 8px',fontSize:15,fontWeight:700,width:'100%'}} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: 3 }}>Descripción</label>
                        <input value={formOferta.descripcion}
                          onChange={e => setFormOferta({...formOferta, descripcion: e.target.value})}
                          placeholder="Ej: Oferta navidad"
                          style={{background:'#1E293B',color:'#F1F5F9',border:'1px solid #334155',
                            borderRadius:6,padding:'6px 8px',width:'100%'}} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: 3 }}>Fecha inicio</label>
                        <input type="date" value={formOferta.fecha_inicio}
                          onChange={e => setFormOferta({...formOferta, fecha_inicio: e.target.value})}
                          style={{background:'#1E293B',color:'#F1F5F9',border:'1px solid #334155',
                            borderRadius:6,padding:'6px 8px',width:'100%'}} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: 3 }}>Fecha fin</label>
                        <input type="date" value={formOferta.fecha_fin}
                          onChange={e => setFormOferta({...formOferta, fecha_fin: e.target.value})}
                          style={{background:'#1E293B',color:'#F1F5F9',border:'1px solid #334155',
                            borderRadius:6,padding:'6px 8px',width:'100%'}} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        {!soloVer && (
                        <button className="btn btn-warning" style={{ width: '100%' }} onClick={agregarOferta}>
                          <Plus size={14} /> Agregar oferta
                        </button>
                      )}
                      </div>
                    </div>
                  </div>

                  {/* Lista de ofertas */}
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginBottom: 10 }}>
                    Ofertas registradas
                  </div>
                  {ofertas.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 30, color: '#94A3B8', fontSize: 13 }}>
                      Sin ofertas para este producto
                    </div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Tipo precio</th>
                          <th>Precio oferta</th>
                          <th>Descripción</th>
                          <th>Inicio</th>
                          <th>Fin</th>
                          <th>Estado</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {ofertas.map(o => {
                          const pvp    = Number(o.precio_oferta)||0
                          const iva    = parseFloat(form.iva_porcentaje)||0
                          const base   = pvp/(1+iva/100)
                          const ivaVal = pvp - base
                          const hoy    = new Date().toISOString().slice(0,10)
                          const activa = o.activa && o.fecha_inicio<=hoy && (o.fecha_fin>=hoy||!o.fecha_fin)
                          return(
                            <tr key={o.id} style={{background:activa?'rgba(16,185,129,.05)':'transparent'}}>
                              <td style={{color:'#94A3B8'}}>{o.tipo_nombre}</td>
                              <td>
                                <div style={{fontSize:10,color:'#64748B'}}>
                                  Base: <span style={{color:'#F1F5F9',fontWeight:600}}>${base.toFixed(2)}</span>
                                  {' + '}IVA: <span style={{color:'#F59E0B',fontWeight:600}}>${ivaVal.toFixed(2)}</span>
                                </div>
                                <div style={{fontSize:14,fontWeight:800,color:activa?'#10B981':'#F87171'}}>
                                  PVP: ${pvp.toFixed(2)}
                                </div>
                              </td>
                              <td style={{ color: '#64748B' }}>{o.descripcion || '—'}</td>
                              <td style={{ fontSize: 12, color:'#94A3B8' }}>{o.fecha_inicio?.slice(0,10)}</td>
                              <td style={{ fontSize: 12, color:'#94A3B8' }}>{o.fecha_fin?.slice(0,10) || '—'}</td>
                              <td>
                                <span style={{padding:'2px 8px',borderRadius:10,fontSize:11,fontWeight:700,
                                  background:activa?'rgba(16,185,129,.15)':'rgba(107,114,128,.15)',
                                  color:activa?'#10B981':'#9CA3AF'}}>
                                  {activa?'✨ Activa':o.activa?'Programada':'Inactiva'}
                                </span>
                              </td>
                              <td>
                                <button className="btn btn-ghost" style={{ padding: '3px 6px' }}
                                  onClick={() => eliminarOferta(o.id)}>
                                  <Trash2 size={13} color="#EF4444" />
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── PESTAÑA 4: STOCK X BODEGA ── */}
          {tab === 3 && (
            <div>
              {esNuevo ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>
                  Guarda el producto primero para ver el stock por bodega
                </div>
              ) : (
                <>
                  <div style={{ background: '#EFF6FF', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#1D4ED8' }}>
                    ℹ️ La cantidad se actualiza automáticamente con <strong>Compras</strong> y <strong>Movimientos</strong>.
                    Aquí puedes configurar el <strong>stock mínimo y máximo</strong> por bodega.
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>Bodega</th>
                        <th style={{ textAlign: 'right' }}>Stock actual</th>
                        <th style={{ textAlign: 'right' }}>Mínimo</th>
                        <th style={{ textAlign: 'right' }}>Máximo</th>
                        {!soloVer && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {stockBod.map((s, i) => {
                        const cant = Number(s.cantidad)
                        const min  = Number(s.cantidad_minima)
                        const max  = Number(s.cantidad_maxima)
                        const alerta = min > 0 && cant < min
                        return (
                          <tr key={s.bodega_id}>
                            <td style={{ fontWeight: 600 }}>
                              {s.bodega}
                              {alerta && <span className="badge badge-red" style={{ marginLeft: 6, fontSize: 10 }}>⚠️ Bajo mínimo</span>}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <span className={`badge ${cant > min && min > 0 ? 'badge-green' : alerta ? 'badge-red' : cant > 0 ? 'badge-green' : 'badge-gray'}`}>
                                {cant.toFixed(0)} u.
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {soloVer ? (
                                <span style={{ fontSize: 13, fontWeight: 600, color: '#D97706' }}>{min.toFixed(0)}</span>
                              ) : (
                                <input type="number" step="1" value={s.cantidad_minima}
                                  onChange={e => {
                                    const ns = [...stockBod]
                                    ns[i] = { ...s, cantidad_minima: e.target.value }
                                    setStockBod(ns)
                                  }}
                                  style={{ width: 80, textAlign: 'right', padding: '4px 8px' }} />
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {soloVer ? (
                                <span style={{ fontSize: 13, fontWeight: 600, color: '#7C3AED' }}>{max.toFixed(0)}</span>
                              ) : (
                                <input type="number" step="1" value={s.cantidad_maxima}
                                  onChange={e => {
                                    const ns = [...stockBod]
                                    ns[i] = { ...s, cantidad_maxima: e.target.value }
                                    setStockBod(ns)
                                  }}
                                  style={{ width: 80, textAlign: 'right', padding: '4px 8px' }} />
                              )}
                            </td>
                            {!soloVer && (
                              <td>
                                <button className="btn btn-success" style={{ padding: '4px 10px', fontSize: 11 }}
                                  onClick={async () => {
                                    await api.put(`/productos/${producto.id}/stock-minimo`, {
                                      bodega_id:       s.bodega_id,
                                      cantidad_minima: parseFloat(s.cantidad_minima) || 0,
                                      cantidad_maxima: parseFloat(s.cantidad_maxima) || 0,
                                    })
                                    const { data } = await api.get(`/productos/${producto.id}/stock`)
                                    setStockBod(data)
                                  }}>
                                  <Check size={13} /> Guardar
                                </button>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <div style={{ marginTop: 14, padding: 12, background: '#F0FDF4', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>
                        Total: {stockBod.reduce((a, s) => a + Number(s.cantidad), 0).toFixed(0)} unidades
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>en todas las bodegas</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: '#D97706', fontWeight: 600 }}>
                        Bodegas bajo mínimo: {stockBod.filter(s => Number(s.cantidad_minima) > 0 && Number(s.cantidad) < Number(s.cantidad_minima)).length}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── PESTAÑA 5: SERIES / IMEI ── */}
          {tab === 4 && (
            <div>
              {/* Toggle aplica series */}
              <div style={{background:'#0F172A',borderRadius:10,padding:16,
                marginBottom:20,border:'1px solid #1E3A5F'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:'#F9FAFB',marginBottom:4}}>
                      Control por Series / IMEI
                    </div>
                    <div style={{fontSize:12,color:'#6B7280'}}>
                      Activa esto para registrar y controlar cada unidad individualmente por número de serie o IMEI
                    </div>
                  </div>
                  <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',flexShrink:0}}>
                    <span style={{fontSize:12,color:form.aplica_series?'#10B981':'#6B7280',fontWeight:700}}>
                      {form.aplica_series?'ACTIVADO':'DESACTIVADO'}
                    </span>
                    <div onClick={()=>!soloVer&&setForm({...form,aplica_series:!form.aplica_series})}
                      style={{
                        width:48,height:26,borderRadius:13,cursor:soloVer?'default':'pointer',
                        background:form.aplica_series?'#10B981':'#374151',
                        position:'relative',transition:'background .2s',
                      }}>
                      <div style={{
                        position:'absolute',top:3,
                        left:form.aplica_series?22:3,
                        width:20,height:20,borderRadius:'50%',
                        background:'white',transition:'left .2s',
                        boxShadow:'0 1px 4px rgba(0,0,0,.3)',
                      }}/>
                    </div>
                  </label>
                </div>
              </div>

              {/* Lista de series si ya tiene */}
              {!esNuevo && form.aplica_series && (
                <SeriesTab pid={producto?.id} soloVer={soloVer} bodegas={bodegas||[]}/>
              )}
              {!esNuevo && !form.aplica_series && (
                <div style={{textAlign:'center',padding:40,color:'#6B7280',fontSize:13}}>
                  Activa el control por series para ver y registrar números de serie / IMEI
                </div>
              )}
              {esNuevo && (
                <div style={{textAlign:'center',padding:40,color:'#6B7280',fontSize:13}}>
                  Guarda el producto primero para gestionar series
                </div>
              )}
            </div>
          )}

          {/* ── PESTAÑA 6: COMBO ── */}
          {tab === 5 && (
            <div>
              {esNuevo ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>
                  Guarda el producto primero para agregar componentes
                </div>
              ) : (
                <>
                  {/* Stock disponible del combo por bodega */}
                  {!esNuevo && bodegas.length > 0 && (
                    <StockComboWidget pid={producto?.id} bodegas={bodegas} />
                  )}

                  {/* Resumen de costo del combo */}
                  {costoCombo && costoCombo.tiene_componentes && (
                    <div style={{ background: '#0F172A', borderRadius: 10, padding: 14, marginBottom: 16,
                      border:'1px solid #10B98133' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#10B981' }}>
                          💰 Costo calculado del combo
                        </div>
                        {!soloVer && (
                          <button className="btn btn-success" style={{ fontSize: 11, padding: '4px 12px' }}
                            onClick={async () => {
                              await api.post(`/productos/${producto.id}/actualizar-costo-combo`)
                              const cc = await cargarCostoCombo(producto.id)
                              if (cc) setCosto(cc.costo_calculado)
                              // Recargar costos con historial
                              const { data: cd } = await api.get(`/productos/${producto.id}/costos`)
                              setCostos({ costo_actual: cd.costo_actual||0, costo_anterior: cd.costo_anterior||0, costo_promedio: cd.costo_promedio||0 })
                            }}>
                            🔄 Actualizar costo
                          </button>
                        )}
                      </div>
                      <table style={{ fontSize: 12, width:'100%', borderCollapse:'collapse' }}>
                        <thead>
                          <tr style={{background:'#1F2937'}}>
                            <th style={{padding:'8px 10px',textAlign:'left',color:'#6B7280',fontSize:10}}>Componente</th>
                            <th style={{padding:'8px 10px',textAlign:'right',color:'#6B7280',fontSize:10}}>Cantidad</th>
                            <th style={{padding:'8px 10px',textAlign:'right',color:'#6B7280',fontSize:10}}>Costo unit.</th>
                            <th style={{padding:'8px 10px',textAlign:'right',color:'#6B7280',fontSize:10}}>Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {costoCombo.componentes.map((c, i) => (
                            <tr key={i} style={{borderBottom:'1px solid #1F2937'}}>
                              <td style={{padding:'8px 10px',color:'#F9FAFB'}}>{c.nombre}</td>
                              <td style={{padding:'8px 10px',textAlign:'right',color:'#9CA3AF'}}>{Number(c.cantidad).toFixed(2)}</td>
                              <td style={{padding:'8px 10px',textAlign:'right',color:'#9CA3AF'}}>${Number(c.costo_unitario).toFixed(2)}</td>
                              <td style={{padding:'8px 10px',textAlign:'right',fontWeight:700,color:'#F9FAFB'}}>
                                ${(Number(c.cantidad) * Number(c.costo_unitario)).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                          <tr style={{ borderTop: '2px solid #374151' }}>
                            <td colSpan={3} style={{ fontWeight: 700, textAlign: 'right', padding:'8px 10px', color:'#9CA3AF' }}>TOTAL COSTO COMBO:</td>
                            <td style={{ textAlign: 'right', fontWeight: 800, color: '#10B981', fontSize: 15, padding:'8px 10px' }}>
                              ${Number(costoCombo.costo_calculado).toFixed(2)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div style={{ background: '#0F172A', borderRadius: 10, padding: 16, marginBottom: 20,
                    border:'1px solid #4C1D95' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#A78BFA', marginBottom: 10 }}>
                      ➕ Agregar componente
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <input placeholder="Buscar producto componente..."
                          value={busComp} onChange={e => buscarComponentes(e.target.value)}
                          style={{background:'#1F2937',color:'#F9FAFB',border:'1px solid #374151',
                            borderRadius:7,padding:'8px 10px',width:'100%'}} />
                        {resComp.length > 0 && (
                          <div style={{
                            position: 'absolute', top: '100%', left: 0, right: 0,
                            background: '#1F2937', borderRadius: 8,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                            border:'1px solid #374151',
                            zIndex: 10, maxHeight: 200, overflow: 'auto'
                          }}>
                            {resComp.map(p => (
                              <div key={p.id}
                                onClick={() => agregarComponente(p)}
                                style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13,
                                  borderBottom: '1px solid #374151', color:'#F9FAFB' }}
                                onMouseEnter={e => e.currentTarget.style.background='#374151'}
                                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                                <strong style={{color:'#A78BFA'}}>{p.codigo}</strong> — {p.descripcion}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ width: 100 }}>
                        <input type="number" step="0.01" value={cantComp}
                          onChange={e => setCantComp(e.target.value)}
                          placeholder="Cant."
                          style={{background:'#1F2937',color:'#F9FAFB',border:'1px solid #374151',
                            borderRadius:7,padding:'8px 10px',width:'100%'}} />
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 700, color: '#A78BFA', marginBottom: 10 }}>
                    Componentes del combo
                  </div>
                  {componentes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 30, color: '#94A3B8', fontSize: 13 }}>
                      Sin componentes — busca productos arriba para agregar
                    </div>
                  ) : (
                    <table style={{width:'100%',borderCollapse:'collapse'}}>
                      <thead>
                        <tr style={{background:'#1F2937'}}>
                          <th style={{padding:'8px 12px',textAlign:'left',color:'#6B7280',fontSize:10}}>Código</th>
                          <th style={{padding:'8px 12px',textAlign:'left',color:'#6B7280',fontSize:10}}>Componente</th>
                          <th style={{padding:'8px 12px',textAlign:'right',color:'#6B7280',fontSize:10}}>Cantidad</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {componentes.map(c => (
                          <tr key={c.componente_id} style={{borderBottom:'1px solid #1F2937'}}>
                            <td style={{padding:'8px 12px'}}>
                              <code style={{ color: '#A78BFA', fontSize: 11 }}>{c.codigo}</code>
                            </td>
                            <td style={{ padding:'8px 12px', fontWeight: 600, color:'#F9FAFB' }}>{c.componente_nombre}</td>
                            <td style={{ padding:'8px 12px', textAlign: 'right', fontWeight: 700, color:'#10B981' }}>
                              {Number(c.cantidad).toFixed(2)}
                            </td>
                            <td style={{padding:'8px 6px'}}>
                              <button style={{ background:'none', border:'none', cursor:'pointer', padding:'3px 6px' }}
                                onClick={() => eliminarComponente(c.componente_id)}>
                                <Trash2 size={13} color="#EF4444" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── PESTANA 7: LOTES ── */}
          {tab === 6 && (
            <div>
              {esNuevo ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>
                  Guarda el producto primero para gestionar lotes
                </div>
              ) : (
                <>
                  {/* Formulario nuevo lote */}
                  {!soloVer && (
                    <div style={{ background: '#0F172A', borderRadius: 10, padding: 16, marginBottom: 20,
                      border: '1px solid #1E3A5F' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B', marginBottom: 12 }}>
                        + Nuevo Lote
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: 3 }}>Lote *</label>
                          <input value={formLote.lote}
                            onChange={e => setFormLote({...formLote, lote: e.target.value.toUpperCase()})}
                            placeholder="Ej: LOT-2026-001"
                            style={{background:'#1E293B',color:'#F1F5F9',border:'1px solid #334155',
                              borderRadius:6,padding:'6px 8px',width:'100%',fontSize:13}} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: 3 }}>Bodega</label>
                          <select value={formLote.bodega_id}
                            onChange={e => setFormLote({...formLote, bodega_id: e.target.value})}
                            style={{background:'#1E293B',color:'#F1F5F9',border:'1px solid #334155',
                              borderRadius:6,padding:'6px 8px',width:'100%',fontSize:13}}>
                            <option value="">-- Sin bodega --</option>
                            {(bodegas||[]).map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: 3 }}>Cantidad</label>
                          <input type="number" step="0.01" value={formLote.cantidad}
                            onChange={e => setFormLote({...formLote, cantidad: e.target.value})}
                            style={{background:'#1E293B',color:'#F1F5F9',border:'1px solid #334155',
                              borderRadius:6,padding:'6px 8px',width:'100%',fontSize:13}} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: 3 }}>Fabricacion</label>
                          <input type="date" value={formLote.fecha_fabricacion}
                            onChange={e => setFormLote({...formLote, fecha_fabricacion: e.target.value})}
                            style={{background:'#1E293B',color:'#F1F5F9',border:'1px solid #334155',
                              borderRadius:6,padding:'6px 8px',width:'100%',fontSize:13}} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: 3 }}>Vencimiento</label>
                          <input type="date" value={formLote.fecha_vencimiento}
                            onChange={e => setFormLote({...formLote, fecha_vencimiento: e.target.value})}
                            style={{background:'#1E293B',color:'#F1F5F9',border:'1px solid #334155',
                              borderRadius:6,padding:'6px 8px',width:'100%',fontSize:13}} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                          <button onClick={async () => {
                            if (!formLote.lote.trim()) { setMsg('Lote es obligatorio'); return }
                            try {
                              await api.post(`/productos/${producto?.id}/lotes`, {
                                ...formLote,
                                bodega_id: formLote.bodega_id ? parseInt(formLote.bodega_id) : null,
                                cantidad: parseFloat(formLote.cantidad) || 0,
                              })
                              setFormLote({ lote:'', bodega_id:'', fecha_fabricacion:'', fecha_vencimiento:'', cantidad:0 })
                              const { data } = await api.get(`/productos/${producto?.id}/lotes`)
                              setLotes(data)
                              setMsg('Lote creado')
                            } catch(e) { setMsg('Error: '+(e.response?.data?.detail||e.message)) }
                          }}
                            style={{padding:'8px 18px',borderRadius:7,border:'none',
                              background:'#F59E0B',color:'#000',cursor:'pointer',
                              fontSize:13,fontWeight:700,width:'100%'}}>
                            + Crear Lote
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tabla de lotes */}
                  {lotes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 30, color: '#94A3B8', fontSize: 13 }}>
                      Sin lotes registrados para este producto
                    </div>
                  ) : (
                    <div style={{overflowX:'auto'}}>
                      <table style={{width:'100%',borderCollapse:'collapse'}}>
                        <thead>
                          <tr style={{background:'#1F2937'}}>
                            {['Lote','Bodega','Fabricacion','Vencimiento','Cantidad','Estado','Dias p/ vencer'].map((h,i)=>(
                              <th key={i} style={{padding:'9px 12px',textAlign:i>=4?'right':'left',
                                fontSize:10,fontWeight:700,color:'#6B7280',textTransform:'uppercase',
                                borderBottom:'1px solid #374151'}}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {lotes.map((l,i) => {
                            const dias = l.dias_para_vencer != null ? Number(l.dias_para_vencer) : null
                            const colorDias = dias === null ? '#6B7280'
                              : dias < 0 ? '#1F2937'
                              : dias <= 30 ? '#EF4444'
                              : dias <= 60 ? '#F59E0B'
                              : '#10B981'
                            const bgDias = dias === null ? 'transparent'
                              : dias < 0 ? 'rgba(31,41,55,.8)'
                              : dias <= 30 ? 'rgba(239,68,68,.15)'
                              : dias <= 60 ? 'rgba(245,158,11,.15)'
                              : 'rgba(16,185,129,.15)'
                            return (
                              <tr key={l.id||i} style={{borderBottom:'1px solid #1F2937',
                                opacity: dias!==null && dias<0 ? 0.5 : 1}}>
                                <td style={{padding:'9px 12px'}}>
                                  <code style={{color:'#A78BFA',fontSize:12,fontWeight:700}}>{l.lote}</code>
                                </td>
                                <td style={{padding:'9px 12px',fontSize:12,color:'#9CA3AF'}}>{l.bodega_nombre||'--'}</td>
                                <td style={{padding:'9px 12px',fontSize:12,color:'#9CA3AF'}}>
                                  {l.fecha_fabricacion ? new Date(l.fecha_fabricacion+'T00:00:00').toLocaleDateString('es-EC') : '--'}
                                </td>
                                <td style={{padding:'9px 12px',fontSize:12,color:'#9CA3AF'}}>
                                  {l.fecha_vencimiento ? new Date(l.fecha_vencimiento+'T00:00:00').toLocaleDateString('es-EC') : '--'}
                                </td>
                                <td style={{padding:'9px 12px',textAlign:'right',fontWeight:700,color:'#F9FAFB'}}>
                                  {Number(l.cantidad||0).toFixed(2)}
                                </td>
                                <td style={{padding:'9px 12px'}}>
                                  <span style={{padding:'2px 10px',borderRadius:20,fontSize:11,fontWeight:700,
                                    background: l.estado==='DISPONIBLE'?'rgba(16,185,129,.15)':'rgba(107,114,128,.15)',
                                    color: l.estado==='DISPONIBLE'?'#10B981':'#9CA3AF'}}>
                                    {l.estado||'--'}
                                  </span>
                                </td>
                                <td style={{padding:'9px 12px',textAlign:'right'}}>
                                  {dias !== null ? (
                                    <span style={{padding:'3px 10px',borderRadius:20,fontSize:11,
                                      fontWeight:700,background:bgDias,color:colorDias}}>
                                      {dias < 0 ? 'VENCIDO' : `${dias} dias`}
                                    </span>
                                  ) : '--'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {msg && (
            <div style={{
              marginTop: 12, padding: '8px 12px', borderRadius: 6, fontSize: 13,
              background: msg.startsWith('❌') ? 'rgba(239,68,68,.15)' : 'rgba(245,158,11,.15)',
              color: msg.startsWith('❌') ? '#EF4444' : '#F59E0B',
              border: `1px solid ${msg.startsWith('❌') ? 'rgba(239,68,68,.3)' : 'rgba(245,158,11,.3)'}`,
            }}>{msg}</div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid #374151',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#0A0F1E', borderRadius: '0 0 16px 16px',
        }}>
          <div style={{ fontSize: 12, color: '#6B7280' }}>
            {tab === 0 ? 'Datos principales del producto'
              : tab === 1 ? 'Define el costo y los precios de venta'
              : tab === 2 ? 'Ofertas y descuentos por fechas'
              : tab === 3 ? 'Stock disponible por bodega'
              : tab === 4 ? 'Series / IMEI -- control por unidad'
              : tab === 5 ? 'Productos que componen este combo'
              : 'Gestion de lotes y vencimientos'}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose}
              style={{padding:'8px 16px',borderRadius:8,cursor:'pointer',
                border:'1px solid #374151',background:'transparent',
                color:'#9CA3AF',fontSize:13,fontWeight:600}}>
              Cancelar
            </button>
            {(tab === 0 || tab === 1 || tab === 2) && !soloVer && (
              <button onClick={guardar} disabled={saving}
                style={{padding:'8px 20px',borderRadius:8,cursor:'pointer',border:'none',
                  background:'#8B5CF6',color:'white',fontSize:13,fontWeight:700,
                  display:'flex',alignItems:'center',gap:6,
                  opacity:saving?.7:1,
                  boxShadow:'0 4px 14px rgba(139,92,246,.4)'}}>
                <Check size={15} />
                {saving ? 'Guardando...' : esNuevo ? 'Crear producto' : 'Guardar cambios'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}