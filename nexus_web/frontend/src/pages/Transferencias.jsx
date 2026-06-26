// ============================================================
//  NEXUS POS — Transferencias entre bodegas
// ============================================================
import { useState, useEffect, useRef } from 'react'
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
}
const fmt$ = v => '$'+Number(v||0).toLocaleString('es-EC',
  {minimumFractionDigits:2,maximumFractionDigits:2})
const FI = {
  padding:'8px 11px', borderRadius:8, fontSize:13,
  border:`1px solid ${C.bord2}`, background:C.sur2,
  color:C.text, outline:'none', boxSizing:'border-box', width:'100%'
}

// ── Modal nueva transferencia ─────────────────────────────────
function ModalTransferencia({bodegas, bodegasOrigen, onCerrar, onGuardado}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [bodOrigen,  setBodOrigen]  = useState('')
  const [bodDestino, setBodDestino] = useState('')

  // Preseleccionar bodega principal de la sucursal
  useEffect(()=>{
    if(bodegasOrigen.length>0){
      const principal = bodegasOrigen.find(b=>b.es_principal)||bodegasOrigen[0]
      if(principal) setBodOrigen(String(principal.id))
    }
  },[bodegasOrigen])
  const [obs,        setObs]        = useState('')
  const [productos,  setProductos]  = useState([])  // stock de bodega origen
  const [items,      setItems]      = useState([])  // productos seleccionados
  const [loading,      setLoading]      = useState(false)
  const [saving,       setSaving]        = useState(false)
  const [err,          setErr]           = useState('')
  const [busProd,      setBusProd]       = useState('')
  const [busResultados,setBusResultados] = useState([])
  const busRef = useRef()

  // Ya no cargamos todo el stock — buscamos por producto
  async function cargarStock(bodId) {
    if(!bodId) return
    setItems([]); setBusResultados([]); setBusProd('')
  }

  async function buscarProductos(txt) {
    if(txt.length<2){setBusResultados([]);return}
    try{
      const{data}=await api.get('/productos',{params:{
        busqueda:txt,activo:'true'
      }})
      setBusResultados(data.slice(0,12))
    }catch{}
  }

  function agregarProducto(p, stockEnOrigen) {
    setBusProd(''); setBusResultados([])
    if(stockEnOrigen<=0){
      setErr(`Sin stock de "${p.descripcion}" en la bodega origen`); return
    }
    setErr('')
    setItems(prev=>{
      if(prev.find(i=>i.pid===p.id)) return prev
      // Series disponibles en bodega origen
      const seriesEnOrigen = (p.stock_bodegas||[])
        .find(b=>b.bodega_id===parseInt(bodOrigen))
      return [...prev,{
        pid:           p.id,
        codigo:        p.codigo,
        descripcion:   p.descripcion,
        aplica_series: p.aplica_series,
        max:           stockEnOrigen,
        cantidad:      1,
        series_disp:   [],   // se cargarán al expandir
        series_sel:    [],
        series_cargadas: false,
      }]
    })
    // Cargar series si aplica
    if(p.aplica_series && bodOrigen){
      api.get(`/productos/${p.id}/series-bodega`,
        {params:{bodega_id:parseInt(bodOrigen)}})
        .then(r=>{
          setItems(prev=>prev.map(i=>
            i.pid===p.id?{...i,series_disp:r.data,series_cargadas:true}:i
          ))
        }).catch(()=>{})
    }
  }

  function toggleProducto(p) {
    setItems(prev => {
      const existe = prev.find(i=>i.pid===p.id)
      if(existe) return prev.filter(i=>i.pid!==p.id)
      return [...prev, {
        pid:           p.id,
        codigo:        p.codigo,
        descripcion:   p.descripcion,
        aplica_series: p.aplica_series,
        max:           Number(p.cantidad),
        cantidad:      Number(p.cantidad),
        series_disp:   p.series||[],
        series_sel:    [],  // series seleccionadas para transferir
      }]
    })
  }

  function setCant(pid, v) {
    setItems(prev=>prev.map(i=>i.pid===pid
      ?{...i, cantidad:Math.min(Math.max(1,parseFloat(v)||1),i.max)}:i))
  }

  function toggleSerie(pid, serieId) {
    setItems(prev=>prev.map(i=>{
      if(i.pid!==pid) return i
      const sel = i.series_sel.includes(serieId)
        ? i.series_sel.filter(s=>s!==serieId)
        : [...i.series_sel, serieId]
      return {...i, series_sel:sel, cantidad:sel.length||i.cantidad}
    }))
  }

  async function guardar() {
    if(!bodOrigen)  return setErr('Selecciona la bodega origen')
    if(!bodDestino) return setErr('Selecciona la bodega destino')
    if(bodOrigen===bodDestino) return setErr('Las bodegas deben ser diferentes')
    if(items.length===0) return setErr('Selecciona al menos un producto')
    setSaving(true); setErr('')
    try {
      const {data} = await api.post('/transferencias',{
        bodega_origen_id:  parseInt(bodOrigen),
        bodega_destino_id: parseInt(bodDestino),
        observaciones:     obs||null,
        detalles: items.map(i=>({
          producto_id: i.pid,
          cantidad:    i.aplica_series&&i.series_sel.length>0
            ? i.series_sel.length : i.cantidad,
          series:      i.series_sel,
        }))
      })
      onGuardado(data)
    } catch(e) { setErr(e.response?.data?.detail||e.message) }
    finally { setSaving(false) }
  }

  const bodOrigenNombre  = bodegas.find(b=>b.id===parseInt(bodOrigen))?.nombre
  const bodDestinoNombre = bodegas.find(b=>b.id===parseInt(bodDestino))?.nombre

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:9000}}>
      <div style={{background:C.surface,borderRadius:16,padding:28,
        width:900,maxHeight:'94vh',overflowY:'auto',
        border:`1px solid ${C.bord2}`,boxShadow:'0 25px 60px rgba(0,0,0,.7)'}}>

        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',
          alignItems:'center',marginBottom:20}}>
          <div style={{fontSize:16,fontWeight:800,color:C.text}}>
            🔄 Nueva transferencia de bodega
          </div>
          <button onClick={onCerrar} style={{background:'none',border:'none',
            cursor:'pointer',color:C.hint,fontSize:22}}>x</button>
        </div>

        {/* Selección de bodegas */}
        <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',
          gap:12,alignItems:'end',marginBottom:20}}>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:C.muted,
              display:'block',marginBottom:6,textTransform:'uppercase'}}>
              Bodega origen *
            </label>
            <select value={bodOrigen}
              onChange={e=>{setBodOrigen(e.target.value);cargarStock(e.target.value)}}
              style={{...FI,borderColor:bodOrigen?C.green:C.bord2,
                background:bodOrigen?C.greenD:C.sur2}}>
              <option value="">-- Selecciona --</option>
              {bodegasOrigen.map(b=>(
                <option key={b.id} value={b.id}
                  disabled={b.id===parseInt(bodDestino)}>
                  {b.nombre}{b.es_principal?' ★':''}
                </option>
              ))}
            </select>
          </div>

          <div style={{textAlign:'center',paddingBottom:10}}>
            <div style={{fontSize:24,color:C.blue}}>→</div>
          </div>

          <div>
            <label style={{fontSize:11,fontWeight:700,color:C.muted,
              display:'block',marginBottom:6,textTransform:'uppercase'}}>
              Bodega destino *
            </label>
            <select value={bodDestino} onChange={e=>setBodDestino(e.target.value)}
              style={{...FI,borderColor:bodDestino?C.blue:C.bord2,
                background:bodDestino?C.blueD:C.sur2}}>
              <option value="">-- Selecciona --</option>
              {bodegas.map(b=>(
                <option key={b.id} value={b.id}
                  disabled={b.id===parseInt(bodOrigen)}>
                  {b.nombre}{b.es_principal?' ★':''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Observaciones */}
        <div style={{marginBottom:16}}>
          <input value={obs} onChange={e=>setObs(e.target.value)}
            placeholder="Observaciones (opcional)..."
            style={FI}/>
        </div>

        {/* Buscador de productos + items seleccionados */}
        {bodOrigen&&(
          <div>
            {/* Buscador */}
            <div style={{background:C.sur2,borderRadius:10,padding:'10px 12px',
              border:`1px solid ${C.bord2}`,marginBottom:12,
              display:'flex',gap:8,alignItems:'center'}}>
              <div style={{position:'relative',flex:1}}>
                <span style={{position:'absolute',left:12,top:'50%',
                  transform:'translateY(-50%)',color:C.hint}}>📦</span>
                <input
                  ref={busRef}
                  value={busProd}
                  onChange={e=>{setBusProd(e.target.value);buscarProductos(e.target.value)}}
                  placeholder="Buscar producto por código o descripción..."
                  style={{...FI,paddingLeft:34,border:`1px dashed ${C.bord2}`}}/>
              </div>
            </div>

            {/* Dropdown resultados búsqueda */}
            {busResultados.length>0&&(
              <div style={{background:C.surface,borderRadius:10,
                border:`1px solid ${C.bord2}`,marginBottom:12,
                boxShadow:'0 8px 24px rgba(0,0,0,.4)',overflow:'hidden',
                maxHeight:260,overflowY:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',tableLayout:'fixed'}}>
                  <colgroup>
                    <col style={{width:'14%'}}/><col style={{width:'46%'}}/>
                    <col style={{width:'14%'}}/><col style={{width:'14%'}}/>
                    <col style={{width:'12%'}}/>
                  </colgroup>
                  <thead>
                    <tr style={{background:C.sur3}}>
                      {['Código','Descripción','Stock bodega','Precio',''].map((h,i)=>(
                        <th key={i} style={{padding:'7px 10px',fontSize:10,
                          fontWeight:700,color:C.hint,textAlign:i>=2?'center':'left',
                          borderBottom:`1px solid ${C.bord2}`,
                          textTransform:'uppercase'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {busResultados.map(p=>{
                      const stk = p.stock_bodegas
                        ? Number(p.stock_bodegas.find(b=>b.bodega_id===parseInt(bodOrigen))?.cantidad||0)
                        : 0
                      return(
                        <tr key={p.id}
                          onClick={()=>agregarProducto(p,stk)}
                          style={{cursor:'pointer',borderBottom:`1px solid ${C.border}`}}
                          onMouseEnter={e=>e.currentTarget.style.background=C.sur2}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          <td style={{padding:'8px 10px'}}>
                            <code style={{fontSize:11,color:C.purple,fontWeight:700}}>
                              {p.codigo}
                            </code>
                          </td>
                          <td style={{padding:'8px 10px',fontSize:12,fontWeight:600,
                            color:C.text,overflow:'hidden',textOverflow:'ellipsis',
                            whiteSpace:'nowrap'}}>{p.descripcion}</td>
                          <td style={{padding:'8px 10px',textAlign:'center'}}>
                            <span style={{padding:'2px 8px',borderRadius:20,
                              fontSize:11,fontWeight:700,
                              background:stk>0?C.greenD:C.redD,
                              color:stk>0?C.green:C.red}}>{stk}</span>
                          </td>
                          <td style={{padding:'8px 10px',textAlign:'right',
                            fontWeight:700,fontSize:12,color:C.blue}}>
                            {fmt$(p.precio_venta)}
                          </td>
                          <td style={{padding:'8px 10px',textAlign:'center'}}>
                            <span style={{fontSize:11,color:C.blue,fontWeight:700}}>
                              + Agregar
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Items seleccionados */}
            {items.length>0&&(
              <div style={{background:C.sur2,borderRadius:10,
                border:`1px solid ${C.bord2}`,overflow:'hidden',maxHeight:400,overflowY:'auto'}}>
                {items.map((it,i)=>{
                  return(
                    <div key={it.pid} style={{
                      borderBottom:i<items.length-1?`1px solid ${C.border}`:'none',
                      background:'rgba(59,130,246,.04)'}}>

                      {/* Fila ítem */}
                      <div style={{display:'grid',
                        gridTemplateColumns:'1fr 100px 90px 36px',
                        gap:8,alignItems:'center',padding:'10px 14px'}}>
                        <div>
                          <div style={{fontWeight:600,fontSize:13,color:C.text}}>
                            {it.descripcion}
                          </div>
                          <div style={{display:'flex',gap:8,alignItems:'center',marginTop:2}}>
                            <code style={{fontSize:11,color:C.purple}}>{it.codigo}</code>
                            <span style={{fontSize:10,color:C.hint}}>
                              max: {it.max} u.
                            </span>
                            {it.aplica_series&&(
                              <span style={{fontSize:10,padding:'1px 6px',
                                borderRadius:6,background:C.blueD,color:C.blue,
                                fontWeight:700}}>Series</span>
                            )}
                          </div>
                        </div>
                        <div style={{textAlign:'center'}}>
                          <span style={{fontSize:11,color:C.hint}}>Cantidad</span>
                          <input type="number" min="1" max={it.max}
                            value={it.cantidad}
                            onChange={e=>setCant(it.pid,e.target.value)}
                            disabled={it.aplica_series&&it.series_disp.length>0}
                            style={{...FI,textAlign:'center',padding:'5px 8px',
                              marginTop:2,fontSize:13,fontWeight:700,
                              background:'rgba(59,130,246,.1)',
                              borderColor:C.blue}}/>
                        </div>
                        <span style={{padding:'3px 8px',borderRadius:20,
                          fontSize:12,fontWeight:700,textAlign:'center',
                          background:C.greenD,color:C.green,display:'block'}}>
                          {it.aplica_series&&it.series_sel.length>0
                            ?`${it.series_sel.length} s.`:`${it.cantidad} u.`}
                        </span>
                        <button onClick={()=>setItems(p=>p.filter(x=>x.pid!==it.pid))}
                          style={{background:'none',border:'none',cursor:'pointer',
                            color:C.hint,fontSize:18,padding:0}}
                          onMouseEnter={e=>e.currentTarget.style.color=C.red}
                          onMouseLeave={e=>e.currentTarget.style.color=C.hint}>
                          x
                        </button>
                      </div>

                      {/* Series del producto si está seleccionado */}
                      {it.aplica_series&&it.series_disp.length>0&&(
                        <div style={{padding:'8px 14px 12px 58px',
                          borderTop:`1px solid ${C.border}`}}>
                          <div style={{fontSize:10,fontWeight:700,color:C.hint,
                            textTransform:'uppercase',marginBottom:8}}>
                            Selecciona las series a transferir
                            {it.series_disp.filter(s=>s.estado==='EXHIBICION').length>0&&(
                              <span style={{marginLeft:8,color:C.purple,fontWeight:700}}>
                                · {it.series_disp.filter(s=>s.estado==='EXHIBICION').length} en percha
                              </span>
                            )}
                          </div>

                          {/* Primero las de percha */}
                          {it.series_disp.filter(s=>s.estado==='EXHIBICION').length>0&&(
                            <div style={{marginBottom:8}}>
                              <div style={{fontSize:9,fontWeight:700,color:C.purple,
                                textTransform:'uppercase',letterSpacing:'.05em',
                                marginBottom:5,paddingLeft:2}}>
                                En percha
                              </div>
                              <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                                {it.series_disp.filter(s=>s.estado==='EXHIBICION').map(s=>{
                                  const isSel = it.series_sel.includes(s.id)
                                  return(
                                    <button key={s.id}
                                      onClick={()=>toggleSerie(it.pid,s.id)}
                                      style={{padding:'5px 12px',borderRadius:8,
                                        cursor:'pointer',fontSize:11,fontWeight:700,
                                        border:`1.5px solid ${isSel?C.blue:C.purple}`,
                                        background:isSel?C.blueD:'rgba(139,92,246,.2)',
                                        color:isSel?C.blue:C.purple}}>
                                      {s.serie}
                                      <span style={{marginLeft:5,fontSize:9,
                                        padding:'1px 4px',borderRadius:3,
                                        background:'rgba(139,92,246,.3)',
                                        color:C.purple}}>PERCHA</span>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {/* Luego las disponibles */}
                          {it.series_disp.filter(s=>s.estado==='DISPONIBLE').length>0&&(
                            <div>
                              {it.series_disp.filter(s=>s.estado==='EXHIBICION').length>0&&(
                                <div style={{fontSize:9,fontWeight:700,color:C.hint,
                                  textTransform:'uppercase',letterSpacing:'.05em',
                                  marginBottom:5,paddingLeft:2}}>
                                  Disponibles
                                </div>
                              )}
                              <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                                {it.series_disp.filter(s=>s.estado==='DISPONIBLE').map(s=>{
                                  const isSel = it.series_sel.includes(s.id)
                                  return(
                                    <button key={s.id}
                                      onClick={()=>toggleSerie(it.pid,s.id)}
                                      style={{padding:'5px 12px',borderRadius:8,
                                        cursor:'pointer',fontSize:11,fontWeight:700,
                                        border:`1.5px solid ${isSel?C.blue:C.bord2}`,
                                        background:isSel?C.blueD:C.sur3,
                                        color:isSel?C.blue:C.muted}}>
                                      {s.serie}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {it.series_sel.length>0&&(
                            <div style={{marginTop:8,fontSize:11,color:C.blue,fontWeight:600}}>
                              {it.series_sel.length} serie{it.series_sel.length!==1?'s':''} seleccionada{it.series_sel.length!==1?'s':''}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Sin series disponibles */}
                      {it.aplica_series&&it.series_cargadas&&it.series_disp.length===0&&(
                        <div style={{padding:'6px 14px 10px 58px',
                          fontSize:11,color:C.amber}}>
                          Sin series disponibles en esta bodega
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Resumen selección */}
        {items.length>0&&(
          <div style={{marginTop:14,padding:'12px 16px',borderRadius:10,
            background:C.blueD,border:`1px solid rgba(59,130,246,.3)`,
            display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontSize:13,color:C.blue,fontWeight:600}}>
              {items.length} producto{items.length!==1?'s':''} · {' '}
              {items.reduce((a,i)=>a+(i.aplica_series&&i.series_sel.length>0
                ?i.series_sel.length:i.cantidad),0)} unidades
            </div>
            {bodOrigenNombre&&bodDestinoNombre&&(
              <div style={{fontSize:12,color:C.blue}}>
                {bodOrigenNombre} → {bodDestinoNombre}
              </div>
            )}
          </div>
        )}

        {err&&(
          <div style={{marginTop:12,padding:'8px 12px',borderRadius:8,fontSize:12,
            background:C.redD,color:'#FCA5A5',
            border:'1px solid rgba(239,68,68,.3)'}}>
            {err}
          </div>
        )}

        <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:20}}>
          <button onClick={onCerrar}
            style={{padding:'10px 20px',borderRadius:9,cursor:'pointer',
              border:`1px solid ${C.bord2}`,background:'transparent',
              color:C.muted,fontSize:13}}>Cancelar</button>
          <button onClick={guardar}
            disabled={saving||items.length===0||!bodOrigen||!bodDestino}
            style={{padding:'10px 28px',borderRadius:9,border:'none',
              background:(saving||items.length===0||!bodOrigen||!bodDestino)
                ?C.sur3:C.blue,
              color:(saving||items.length===0||!bodOrigen||!bodDestino)
                ?C.hint:'white',
              cursor:(saving||items.length===0||!bodOrigen||!bodDestino)
                ?'not-allowed':'pointer',
              fontSize:14,fontWeight:800,
              boxShadow:(saving||items.length===0||!bodOrigen||!bodDestino)
                ?'none':'0 4px 16px rgba(59,130,246,.4)'}}>
            {saving?'Transfiriendo...':'🔄 Confirmar transferencia'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal detalle transferencia ───────────────────────────────
function ModalDetalle({tr, onCerrar, onAnulada}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [detalle, setDetalle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [anulando,setAnulando]= useState(false)

  useEffect(()=>{
    api.get(`/transferencias/${tr.id}/detalle`)
      .then(r=>setDetalle(r.data))
      .catch(()=>{})
      .finally(()=>setLoading(false))
  },[tr.id])

  async function anular() {
    if(!window.confirm('¿Anular esta transferencia? Se revertirá el stock.')) return
    setAnulando(true)
    try {
      await api.patch(`/transferencias/${tr.id}/anular`)
      onAnulada()
    } catch(e) { alert(e.response?.data?.detail||e.message) }
    finally { setAnulando(false) }
  }

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:9000}}>
      <div style={{background:C.surface,borderRadius:16,padding:28,width:680,
        maxHeight:'85vh',overflowY:'auto',
        border:`1px solid ${C.bord2}`,boxShadow:'0 25px 60px rgba(0,0,0,.7)'}}>

        <div style={{display:'flex',justifyContent:'space-between',
          alignItems:'center',marginBottom:20}}>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:C.text}}>
              🔄 Transferencia
              <code style={{marginLeft:10,color:C.blue,fontSize:14}}>
                {tr.numero}
              </code>
            </div>
            <div style={{fontSize:12,color:C.muted,marginTop:3}}>
              <span style={{color:C.green,fontWeight:600}}>{tr.bodega_origen}</span>
              <span style={{margin:'0 8px',color:C.hint}}>→</span>
              <span style={{color:C.blue,fontWeight:600}}>{tr.bodega_destino}</span>
              <span style={{marginLeft:10,color:C.hint}}>
                {new Date(tr.fecha).toLocaleDateString('es-EC',
                  {day:'2-digit',month:'long',year:'numeric'})}
              </span>
            </div>
          </div>
          <button onClick={onCerrar} style={{background:'none',border:'none',
            cursor:'pointer',color:C.hint,fontSize:22}}>x</button>
        </div>

        {loading?(
          <div style={{padding:24,textAlign:'center',color:C.hint}}>Cargando...</div>
        ):detalle&&(
          <div>
            {detalle.observaciones&&(
              <div style={{padding:'8px 12px',borderRadius:8,marginBottom:14,
                background:C.sur2,color:C.muted,fontSize:12,
                border:`1px solid ${C.bord2}`}}>
                📝 {detalle.observaciones}
              </div>
            )}

            {detalle.detalles.map((d,i)=>(
              <div key={i} style={{marginBottom:10,background:C.sur2,
                borderRadius:10,border:`1px solid ${C.bord2}`,overflow:'hidden'}}>
                <div style={{padding:'10px 14px',display:'flex',
                  justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontWeight:600,color:C.text}}>{d.descripcion}</div>
                    <code style={{fontSize:11,color:C.purple}}>{d.codigo}</code>
                  </div>
                  <span style={{padding:'3px 12px',borderRadius:20,
                    fontSize:13,fontWeight:700,
                    background:C.greenD,color:C.green}}>
                    {Number(d.cantidad).toFixed(0)} u.
                  </span>
                </div>
                {d.series&&d.series.length>0&&(
                  <div style={{padding:'8px 14px',borderTop:`1px solid ${C.border}`}}>
                    <div style={{fontSize:10,color:C.hint,
                      fontWeight:700,textTransform:'uppercase',marginBottom:6}}>
                      Series transferidas
                    </div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                      {d.series.map((s,j)=>(
                        <span key={j} style={{padding:'2px 10px',borderRadius:6,
                          fontSize:11,fontWeight:700,
                          background:'rgba(139,92,246,.15)',color:C.purple,
                          border:'1px solid rgba(139,92,246,.3)'}}>
                          {s.serie}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:16}}>
              {tr.estado!=='ANULADA'&&(
                <button onClick={anular} disabled={anulando}
                  style={{padding:'9px 18px',borderRadius:9,cursor:'pointer',
                    border:`1px solid ${C.red}`,background:C.redD,
                    color:C.red,fontSize:13,fontWeight:600}}>
                  {anulando?'Anulando...':'Anular transferencia'}
                </button>
              )}
              <button onClick={onCerrar}
                style={{padding:'9px 20px',borderRadius:9,cursor:'pointer',
                  border:`1px solid ${C.bord2}`,background:'transparent',
                  color:C.muted,fontSize:13}}>Cerrar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  PÁGINA PRINCIPAL
// ════════════════════════════════════════════════════════════
export default function Transferencias() {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const user = JSON.parse(localStorage.getItem('nexus_user')||'{}')
  const [transferencias, setTransferencias] = useState([])
  const [bodegas,        setBodegas]        = useState([])  // todas — para destino
  const [bodegasOrigen,  setBodegasOrigen]  = useState([])  // solo de la sucursal
  const [loading,        setLoading]        = useState(true)
  const [busqueda,       setBusqueda]       = useState('')
  const [modal,          setModal]          = useState(false)
  const [modalDet,       setModalDet]       = useState(null)
  const [ultimaTr,       setUltimaTr]       = useState(null)
  const [proxNum,        setProxNum]        = useState('...')
  const [sucNombre,      setSucNombre]      = useState('')

  async function cargar(bus=busqueda) {
    setLoading(true)
    try {
      const{data}=await api.get('/transferencias',{params:{busqueda:bus}})
      setTransferencias(data)
    } finally{setLoading(false)}
  }

  useEffect(()=>{
    cargar()
    // Bodegas de la sucursal del usuario (para origen)
    api.get('/bodegas',{params:{sucursal_id:user.sucursal_id||undefined}})
      .then(r=>setBodegasOrigen(r.data)).catch(()=>{})
    // Todas las bodegas (para destino — puede ser otra sucursal)
    api.get('/bodegas').then(r=>setBodegas(r.data)).catch(()=>{})
    api.get('/transferencias/proximo-numero').then(r=>setProxNum(r.data.numero)).catch(()=>{})
    api.get('/config/sucursales').then(r=>{
      if(user.sucursal_id&&r.data.length>0){
        const suc=r.data.find(x=>x.id===parseInt(user.sucursal_id))
        if(suc) setSucNombre(suc.nombre)
      }
    }).catch(()=>{})
  },[])

  const TH=(a='left')=>({padding:'11px 14px',fontSize:10,fontWeight:700,
    color:C.hint,textAlign:a,background:C.sur3,
    borderBottom:`1px solid ${C.bord2}`,textTransform:'uppercase',
    letterSpacing:'.05em',whiteSpace:'nowrap'})
  const TD=(a='left')=>({padding:'12px 14px',fontSize:13,
    borderBottom:`1px solid ${C.border}`,verticalAlign:'middle',
    color:C.text,textAlign:a})

  return(
    <div style={{background:C.bg,minHeight:'100vh',padding:'24px 28px',
      fontFamily:"'Inter','Segoe UI',system-ui,sans-serif",color:C.text}}>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',
        alignItems:'flex-start',marginBottom:20}}>
        <div>
          <h1 style={{margin:0,fontSize:24,fontWeight:800}}>
            🔄 Transferencias de Bodega
          </h1>
          <p style={{margin:'4px 0 0',color:C.muted,fontSize:13}}>
            Mover productos y series entre bodegas
          </p>
        </div>
        <button onClick={()=>setModal(true)}
          style={{display:'flex',alignItems:'center',gap:7,
            padding:'10px 20px',borderRadius:10,border:'none',
            background:C.blue,color:'white',cursor:'pointer',
            fontSize:14,fontWeight:700,
            boxShadow:'0 4px 14px rgba(59,130,246,.4)'}}>
          + Nueva transferencia
        </button>
      </div>

      {/* Info bar */}
      <div style={{display:'flex',gap:12,marginBottom:20,flexWrap:'wrap'}}>
        {sucNombre&&(
          <div style={{display:'flex',alignItems:'center',gap:7,padding:'6px 14px',
            borderRadius:9,background:C.greenD,border:`1px solid rgba(16,185,129,.25)`}}>
            <span>🏢</span>
            <span style={{fontSize:13,fontWeight:700,color:C.green}}>{sucNombre}</span>
          </div>
        )}
        <div style={{display:'flex',alignItems:'center',gap:7,padding:'6px 14px',
          borderRadius:9,background:C.blueD,border:`1px solid rgba(59,130,246,.3)`}}>
          <span style={{fontSize:11,color:C.blue,fontWeight:700}}>PRÓXIMA</span>
          <code style={{fontSize:14,fontWeight:800,color:C.blue}}>{proxNum}</code>
        </div>
      </div>

      {/* Alerta última transferencia */}
      {ultimaTr&&(
        <div style={{marginBottom:16,padding:'12px 16px',borderRadius:10,
          background:C.greenD,border:`1px solid rgba(16,185,129,.3)`,
          display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span>
            <span style={{color:C.green,fontWeight:700}}>Transferencia confirmada: </span>
            <code style={{color:C.blue,fontWeight:700}}>{ultimaTr.numero}</code>
          </span>
          <button onClick={()=>setUltimaTr(null)}
            style={{background:'none',border:'none',cursor:'pointer',
              color:C.hint,fontSize:18}}>x</button>
        </div>
      )}

      {/* Filtros */}
      <div style={{background:C.surface,borderRadius:12,padding:'12px 16px',
        border:`1px solid ${C.bord2}`,marginBottom:16,
        display:'flex',gap:10,alignItems:'center'}}>
        <div style={{position:'relative',flex:1}}>
          <span style={{position:'absolute',left:12,top:'50%',
            transform:'translateY(-50%)',color:C.hint}}>🔍</span>
          <input value={busqueda} onChange={e=>setBusqueda(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&cargar(busqueda)}
            placeholder="Buscar por N° transferencia o bodega..."
            style={{...FI,paddingLeft:32}}/>
        </div>
        <button onClick={()=>cargar(busqueda)}
          style={{padding:'8px 16px',borderRadius:9,border:'none',
            background:C.blue,color:'white',cursor:'pointer',
            fontSize:13,fontWeight:600}}>Buscar</button>
      </div>

      {/* Tabla */}
      <div style={{background:C.surface,borderRadius:12,
        border:`1px solid ${C.bord2}`,overflow:'hidden'}}>
        {loading?(
          <div style={{padding:40,textAlign:'center',color:C.hint}}>Cargando...</div>
        ):(
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr>
                {['N° Transferencia','Origen','Destino','Productos',
                  'Series','Fecha','Estado',''].map((h,i)=>(
                  <th key={i} style={TH(i>=3&&i<=4?'center':'left')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transferencias.map(t=>(
                <tr key={t.id}
                  onMouseEnter={e=>e.currentTarget.style.background=C.sur2}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={TD()}>
                    <code style={{color:C.blue,fontWeight:700,fontSize:13}}>
                      {t.numero||`TR-${t.id}`}
                    </code>
                  </td>
                  <td style={TD()}>
                    <span style={{color:C.green,fontWeight:600,fontSize:12}}>
                      {t.bodega_origen}
                    </span>
                  </td>
                  <td style={TD()}>
                    <span style={{color:C.blue,fontWeight:600,fontSize:12}}>
                      {t.bodega_destino}
                    </span>
                  </td>
                  <td style={{...TD('center')}}>
                    <span style={{padding:'2px 10px',borderRadius:20,
                      fontSize:12,fontWeight:700,
                      background:C.purpleD||'rgba(139,92,246,.15)',
                      color:C.purple}}>
                      {t.num_productos}
                    </span>
                  </td>
                  <td style={{...TD('center')}}>
                    {Number(t.num_series)>0?(
                      <span style={{padding:'2px 10px',borderRadius:20,
                        fontSize:12,fontWeight:700,
                        background:C.blueD,color:C.blue}}>
                        {t.num_series}
                      </span>
                    ):<span style={{color:C.hint,fontSize:12}}>—</span>}
                  </td>
                  <td style={{...TD(),fontSize:12,color:C.muted}}>
                    {new Date(t.fecha).toLocaleDateString('es-EC',
                      {day:'2-digit',month:'2-digit',year:'numeric'})}
                  </td>
                  <td style={TD()}>
                    <span style={{padding:'3px 10px',borderRadius:20,
                      fontSize:11,fontWeight:700,
                      background:t.estado==='CONFIRMADA'?C.greenD:C.redD,
                      color:t.estado==='CONFIRMADA'?C.green:C.red}}>
                      {t.estado}
                    </span>
                  </td>
                  <td style={{...TD('center')}}>
                    <button onClick={()=>setModalDet(t)}
                      style={{padding:'5px 12px',borderRadius:7,cursor:'pointer',
                        border:`1px solid ${C.bord2}`,background:C.sur2,
                        color:C.muted,fontSize:12}}>
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
              {transferencias.length===0&&(
                <tr><td colSpan={8} style={{textAlign:'center',
                  padding:'48px 0',color:C.hint,fontSize:13}}>
                  No hay transferencias registradas
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {modal&&(
        <ModalTransferencia
          bodegas={bodegas}
          bodegasOrigen={bodegasOrigen}
          onCerrar={()=>setModal(false)}
          onGuardado={data=>{
            setModal(false)
            setUltimaTr(data)
            cargar()
            api.get('/transferencias/proximo-numero')
              .then(r=>setProxNum(r.data.numero)).catch(()=>{})
          }}
        />
      )}

      {modalDet&&(
        <ModalDetalle
          tr={modalDet}
          onCerrar={()=>setModalDet(null)}
          onAnulada={()=>{setModalDet(null);cargar()}}
        />
      )}
    </div>
  )
}