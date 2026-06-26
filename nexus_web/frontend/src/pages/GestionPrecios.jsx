import { useState, useEffect } from 'react'
import axios from 'axios'
import { useTheme } from '../theme'

const BASE = 'http://localhost:8000/api'

function getHeaders() {
  return { Authorization: 'Bearer ' + localStorage.getItem('nexus_token') }
}

async function fetchAPI(path, params={}) {
  const url = new URL(BASE + path)
  Object.entries(params).forEach(([k,v])=>{ if(v!==undefined&&v!=='') url.searchParams.set(k,v) })
  const r = await fetch(url.toString(), { headers: getHeaders() })
  if(!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

const C = {
  bg:'#0A0F1E', surface:'#111827', sur2:'#1F2937', sur3:'#374151',
  bord2:'#374151', text:'#F9FAFB', muted:'#9CA3AF', hint:'#6B7280',
  blue:'#3B82F6', green:'#10B981', amber:'#F59E0B', red:'#EF4444',
  purple:'#8B5CF6',
  blueD:'rgba(59,130,246,.15)', greenD:'rgba(16,185,129,.15)',
  amberD:'rgba(245,158,11,.15)', redD:'rgba(239,68,68,.15)',
}
const SI = { // style input
  background:C.sur2, color:C.text, border:`1px solid ${C.bord2}`,
  borderRadius:7, padding:'6px 10px', fontSize:12, outline:'none', width:'100%',
}

const fmt$ = v => '$'+Number(v||0).toFixed(2)

export default function GestionPrecios() {
  const C = useTheme()
  const [modo, setModo]           = useState('precios')
  const [productos, setProductos] = useState([])
  const [tiposPrecio, setTiposPrecio] = useState([])
  const [tipoPrecioSel, setTipoPrecioSel] = useState('')
  const [cats, setCats]           = useState([])
  const [marcas, setMarcas]       = useState([])
  const [catFil, setCatFil]       = useState('')
  const [marcaFil, setMarcaFil]   = useState('')
  const [textFil, setTextFil]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [msg, setMsg]             = useState('')
  const [ajTipo, setAjTipo]       = useState('pct_sube')
  const [ajVal, setAjVal]         = useState('')
  const [fechaIni, setFechaIni]   = useState(new Date().toISOString().slice(0,10))
  const [fechaFin, setFechaFin]   = useState('')
  const [descOfer, setDescOfer]   = useState('')

  useEffect(()=>{
    // Cargar catálogos
    fetchAPI('/tipos-precio').then(d=>{ const a=Array.isArray(d)?d:[]; setTiposPrecio(a); if(a[0]) setTipoPrecioSel(String(a[0].id)) }).catch(()=>{})
    fetchAPI('/categorias').then(d=>setCats(Array.isArray(d)?d:[])).catch(()=>{})
    fetchAPI('/marcas').then(d=>setMarcas(Array.isArray(d)?d:[])).catch(()=>{})
    // Cargar productos
    cargar()
  },[]) // eslint-disable-line

  function cargar(cid='', mid='') {
    setLoading(true); setMsg('')
    const params = { limit: 500 }
    if(cid) params.categoria_id = cid
    if(mid) params.marca_id     = mid
    fetchAPI('/gestion-precios/productos', params)
      .then(data => {
        const arr = Array.isArray(data) ? data : []
        console.log('Productos cargados:', arr.length)
        setProductos(arr.map(p => ({
          ...p,
          // pvpEditables: mapa tipoPrecioId → valor editable
          pvpEd: Object.fromEntries(
            (p.precios||[]).map(pr => [
              String(pr.tipo_precio_id),
              +Number(pr.precio_pvp || pr.precio*(1+(p.iva_porcentaje||0)/100)).toFixed(2)
            ])
          ),
          oferta: '',
          sel: false,
        })))
        if(!arr.length) setMsg('⚠️ Sin productos. Configura precios en Inventario.')
      })
      .catch(e => { console.error(e); setMsg('❌ '+e.message) })
      .finally(() => setLoading(false))
  }

  const prodVis = productos.filter(p => {
    if(!textFil) return true
    const q = textFil.toLowerCase()
    return (p.descripcion||'').toLowerCase().includes(q) || (p.codigo||'').toLowerCase().includes(q)
  })

  const selCount = productos.filter(p=>p.sel).length
  const targets  = selCount>0 ? productos.filter(p=>p.sel) : prodVis

  function setProd(id, key, val) {
    setProductos(prev => prev.map(p => p.id===id ? {...p,[key]:val} : p))
  }
  function setPvp(id, tpId, val) {
    setProductos(prev => prev.map(p => p.id===id
      ? {...p, pvpEd:{...p.pvpEd,[String(tpId)]:val}}
      : p
    ))
  }
  function toggleSel(id) { setProd(id,'sel',!productos.find(p=>p.id===id)?.sel) }
  function toggleTodos() {
    const todos = prodVis.every(p=>p.sel)
    setProductos(prev=>prev.map(p=> prodVis.includes(p)?{...p,sel:!todos}:p))
  }

  function aplicarAjuste() {
    if(!ajVal) return
    const v   = parseFloat(ajVal)
    const tid = String(tipoPrecioSel)
    setProductos(prev=>prev.map(p=>{
      if(selCount>0 && !p.sel) return p
      const act = Number(p.pvpEd[tid]||0)
      let nv = act
      if(ajTipo==='pct_sube')   nv = act*(1+v/100)
      if(ajTipo==='pct_baja')   nv = act*(1-v/100)
      if(ajTipo==='monto_sube') nv = act+v
      if(ajTipo==='monto_baja') nv = act-v
      if(ajTipo==='fijo')       nv = v
      if(modo==='precios') return {...p, pvpEd:{...p.pvpEd,[tid]:+Math.max(0,nv).toFixed(2)}}
      return {...p, oferta:+Math.max(0,nv).toFixed(2)}
    }))
  }

  async function guardar() {
    if(!targets.length) return setMsg('⚠️ No hay productos seleccionados')
    if(!tipoPrecioSel)  return setMsg('⚠️ Selecciona lista de precios')
    setSaving(true); setMsg('')
    try {
      if(modo==='precios') {
        const body = targets.map(p=>({
          producto_id:    p.id,
          tipo_precio_id: parseInt(tipoPrecioSel),
          precio_nuevo:   Number(p.pvpEd[String(tipoPrecioSel)]||0),
        })).filter(x=>x.precio_nuevo>0)
        const r = await fetch(BASE+'/precios/batch', {
          method:'POST', headers:{...getHeaders(),'Content-Type':'application/json'},
          body: JSON.stringify(body)
        })
        const d = await r.json()
        setMsg(`✅ ${d.actualizados||body.length} precios actualizados`)
      } else {
        const inv = targets.filter(p=>!p.oferta||Number(p.oferta)<=0)
        if(inv.length) return setMsg(`⚠️ Falta precio de oferta en ${inv.length} productos`)
        const body = targets.map(p=>({
          producto_id:    p.id,
          tipo_precio_id: parseInt(tipoPrecioSel),
          precio_oferta:  Number(p.oferta),
          fecha_inicio:   fechaIni,
          fecha_fin:      fechaFin||null,
          descripcion:    descOfer||null,
        }))
        const r = await fetch(BASE+'/ofertas/batch', {
          method:'POST', headers:{...getHeaders(),'Content-Type':'application/json'},
          body: JSON.stringify(body)
        })
        const d = await r.json()
        setMsg(`✅ ${d.creadas||body.length} ofertas creadas`)
      }
      setProductos(prev=>prev.map(p=>({...p,sel:false})))
    } catch(e) {
      setMsg('❌ '+e.message)
    } finally { setSaving(false) }
  }

  const todosSel = prodVis.length>0 && prodVis.every(p=>p.sel)
  const tipNom   = tiposPrecio.find(t=>String(t.id)===tipoPrecioSel)?.nombre||'—'

  return (
    <div style={{background:C.bg,minHeight:'100vh',color:C.text,
      fontFamily:"'Inter','Segoe UI',sans-serif",display:'flex',flexDirection:'column'}}>

      {/* Header */}
      <div style={{padding:'14px 24px',borderBottom:`1px solid ${C.bord2}`,
        background:C.surface,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontSize:20,fontWeight:900}}>
            {modo==='precios'?'💲 Cambio Masivo de Precios':'🏷 Gestión de Ofertas'}
          </div>
          <div style={{fontSize:12,color:C.muted,marginTop:2}}>
            {loading?'Cargando...':`${prodVis.length} productos · Lista: ${tipNom}`}
            {selCount>0&&<span style={{color:C.blue}}> · {selCount} seleccionados</span>}
          </div>
        </div>
        <div style={{display:'flex',gap:6}}>
          {[['precios','💲 Precios'],['ofertas','🏷 Ofertas']].map(([m,l])=>(
            <button key={m} onClick={()=>{setModo(m);setMsg('')}}
              style={{padding:'7px 18px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13,
                border:`1px solid ${modo===m?C.blue:C.bord2}`,
                background:modo===m?C.blueD:'transparent',color:modo===m?C.blue:C.muted}}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Barra filtros */}
      <div style={{padding:'8px 16px',borderBottom:`1px solid ${C.bord2}`,
        background:C.sur2,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
        <div style={{position:'relative',flex:1,minWidth:200}}>
          <span style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',color:C.hint}}>🔍</span>
          <input value={textFil} onChange={e=>setTextFil(e.target.value)}
            placeholder="Filtrar por código o descripción..."
            style={{...SI,paddingLeft:26}}/>
        </div>
        <select value={catFil} onChange={e=>setCatFil(e.target.value)} style={{...SI,width:140}}>
          <option value="">Todas las cat.</option>
          {cats.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <select value={marcaFil} onChange={e=>setMarcaFil(e.target.value)} style={{...SI,width:130}}>
          <option value="">Todas las marcas</option>
          {marcas.map(m=><option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
        <select value={tipoPrecioSel} onChange={e=>setTipoPrecioSel(e.target.value)}
          style={{...SI,width:150,borderColor:C.blue,background:C.blueD,color:C.blue,fontWeight:700}}>
          {tiposPrecio.map(t=><option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
        <button onClick={()=>cargar(catFil,marcaFil)} disabled={loading}
          style={{padding:'6px 14px',borderRadius:7,border:'none',background:C.blue,
            color:'white',cursor:'pointer',fontSize:12,fontWeight:700,flexShrink:0}}>
          {loading?'⏳':'🔄 Recargar'}
        </button>
      </div>

      {/* Barra ajuste global */}
      <div style={{padding:'8px 16px',borderBottom:`1px solid ${C.bord2}`,
        background:C.surface,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
        <span style={{fontSize:11,color:C.amber,fontWeight:700,flexShrink:0}}>⚡ Ajuste global:</span>
        <select value={ajTipo} onChange={e=>setAjTipo(e.target.value)}
          style={{...SI,width:200,padding:'5px 8px'}}>
          <option value="pct_sube">↑ Subir % sobre precio actual</option>
          <option value="pct_baja">↓ Bajar % sobre precio actual</option>
          <option value="monto_sube">↑ Subir monto fijo $</option>
          <option value="monto_baja">↓ Bajar monto fijo $</option>
          <option value="fijo">= Fijar precio para todos</option>
        </select>
        <input type="number" value={ajVal} onChange={e=>setAjVal(e.target.value)}
          placeholder={ajTipo.includes('pct')?'% ej: 10':'$ ej: 5.00'}
          style={{...SI,width:100,padding:'5px 8px'}}/>
        <button onClick={aplicarAjuste}
          style={{padding:'6px 14px',borderRadius:7,border:'none',background:C.amber,
            color:'#000',cursor:'pointer',fontSize:12,fontWeight:700,flexShrink:0}}>
          Aplicar {selCount>0?`a ${selCount}`:'a todos'}
        </button>
        {modo==='ofertas'&&(<>
          <div style={{width:1,height:22,background:C.bord2}}/>
          <span style={{fontSize:11,color:C.hint}}>Vigencia:</span>
          <input type="date" value={fechaIni} onChange={e=>setFechaIni(e.target.value)}
            style={{...SI,width:130,padding:'5px 8px'}}/>
          <span style={{color:C.hint,fontSize:11}}>→</span>
          <input type="date" value={fechaFin} onChange={e=>setFechaFin(e.target.value)}
            style={{...SI,width:130,padding:'5px 8px'}}/>
          <input value={descOfer} onChange={e=>setDescOfer(e.target.value)}
            placeholder="Descripción..." style={{...SI,width:160,padding:'5px 8px'}}/>
        </>)}
        <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
          {msg&&<span style={{fontSize:11,padding:'4px 10px',borderRadius:6,maxWidth:300,
            color:msg.startsWith('✅')?C.green:msg.startsWith('⚠️')?C.amber:C.red,
            background:msg.startsWith('✅')?C.greenD:msg.startsWith('⚠️')?C.amberD:C.redD}}>
            {msg}</span>}
          <button onClick={guardar} disabled={saving}
            style={{padding:'7px 20px',borderRadius:8,border:'none',flexShrink:0,
              background:saving?C.sur3:C.green,color:saving?C.hint:'white',
              cursor:saving?'not-allowed':'pointer',fontSize:13,fontWeight:700}}>
            {saving?'Guardando...':(modo==='precios'
              ?`💾 Guardar ${targets.length} precios`
              :`🏷 Crear ${targets.length} ofertas`)}
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div style={{flex:1,overflowY:'auto'}}>
        {loading ? (
          <div style={{textAlign:'center',padding:60,color:C.hint,fontSize:15}}>⏳ Cargando productos...</div>
        ) : prodVis.length===0 ? (
          <div style={{textAlign:'center',padding:60}}>
            <div style={{fontSize:40,marginBottom:10}}>📦</div>
            <div style={{fontSize:15,color:C.muted,marginBottom:16}}>No hay productos</div>
            <button onClick={()=>cargar()} style={{padding:'8px 20px',borderRadius:8,
              border:'none',background:C.blue,color:'white',cursor:'pointer',fontWeight:700}}>
              🔄 Reintentar
            </button>
          </div>
        ) : (
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead style={{position:'sticky',top:0,zIndex:2}}>
              <tr style={{background:C.sur3}}>
                <th style={{padding:'8px 12px',width:36}}>
                  <input type="checkbox" checked={todosSel} onChange={toggleTodos}
                    style={{cursor:'pointer',accentColor:C.blue,width:14,height:14}}/>
                </th>
                <th style={{padding:'8px 8px',textAlign:'left',fontSize:10,
                  fontWeight:700,color:C.hint,textTransform:'uppercase',width:75}}>Código</th>
                <th style={{padding:'8px 8px',textAlign:'left',fontSize:10,
                  fontWeight:700,color:C.hint,textTransform:'uppercase'}}>Descripción</th>
                {tiposPrecio.map(tp=>(
                  <th key={tp.id} style={{padding:'8px 10px',textAlign:'right',fontSize:10,
                    fontWeight:700,textTransform:'uppercase',width:130,
                    color:String(tp.id)===tipoPrecioSel?C.blue:C.hint}}>
                    {tp.nombre}
                    {String(tp.id)===tipoPrecioSel&&
                      <span style={{display:'block',fontSize:8,color:C.blue}}>● activo</span>}
                  </th>
                ))}
                {modo==='ofertas'&&(
                  <th style={{padding:'8px 10px',textAlign:'right',fontSize:10,
                    fontWeight:700,color:C.amber,textTransform:'uppercase',width:120}}>
                    Precio Oferta
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {prodVis.map((p,i)=>(
                <tr key={p.id}
                  style={{borderBottom:`1px solid ${C.bord2}`,cursor:'pointer',
                    background:p.sel?'rgba(59,130,246,.08)':i%2===0?'transparent':'rgba(255,255,255,.015)'}}
                  onClick={()=>toggleSel(p.id)}>
                  <td style={{padding:'8px 12px'}} onClick={e=>e.stopPropagation()}>
                    <input type="checkbox" checked={!!p.sel} onChange={()=>toggleSel(p.id)}
                      style={{cursor:'pointer',accentColor:C.blue,width:14,height:14}}/>
                  </td>
                  <td style={{padding:'8px 8px'}}>
                    <code style={{color:C.purple,fontSize:11,fontWeight:700}}>{p.codigo}</code>
                  </td>
                  <td style={{padding:'8px 8px',fontSize:12,color:C.text}}>
                    {p.descripcion}
                    {p.iva_porcentaje>0&&
                      <span style={{marginLeft:5,fontSize:9,color:C.hint,
                        background:C.sur3,padding:'1px 4px',borderRadius:3}}>
                        IVA {p.iva_porcentaje}%
                      </span>}
                    {p.tiene_oferta&&
                      <span style={{marginLeft:4,fontSize:9,color:C.amber,
                        background:C.amberD,padding:'1px 5px',borderRadius:3}}>
                        En oferta
                      </span>}
                  </td>
                  {tiposPrecio.map(tp=>{
                    const tid   = String(tp.id)
                    const esAct = tid===tipoPrecioSel
                    const pvpEd = Number(p.pvpEd?.[tid]||0)
                    const prOri = (p.precios||[]).find(pr=>String(pr.tipo_precio_id)===tid)
                    const pvpOri= Number(prOri?.precio_pvp||prOri?.precio*(1+(p.iva_porcentaje||0)/100)||0)
                    const diff  = pvpEd-pvpOri
                    const pct   = pvpOri>0?diff/pvpOri*100:0
                    return(
                      <td key={tp.id} style={{padding:'5px 10px',textAlign:'right'}}
                        onClick={e=>e.stopPropagation()}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:4}}>
                          {esAct&&Math.abs(pct)>0.1&&(
                            <span style={{fontSize:9,fontWeight:700,
                              color:diff>0?C.red:C.green}}>
                              {diff>0?'+':''}{pct.toFixed(1)}%
                            </span>
                          )}
                          {modo==='precios'?(
                            <input type="number" step="0.01" min="0" value={pvpEd||''}
                              onChange={e=>setPvp(p.id,tp.id,e.target.value)}
                              style={{background:esAct?C.blueD:C.sur2,
                                color:esAct?C.blue:C.muted,
                                border:`1px solid ${esAct?'rgba(59,130,246,.5)':C.bord2}`,
                                borderRadius:6,padding:'4px 6px',fontSize:12,
                                fontWeight:esAct?700:400,
                                textAlign:'right',width:95,outline:'none'}}/>
                          ):(
                            <span style={{fontSize:12,color:C.muted}}>
                              {pvpEd>0?fmt$(pvpEd):'—'}
                            </span>
                          )}
                        </div>
                      </td>
                    )
                  })}
                  {modo==='ofertas'&&(
                    <td style={{padding:'5px 10px'}} onClick={e=>e.stopPropagation()}>
                      <input type="number" step="0.01" min="0" value={p.oferta||''}
                        onChange={e=>setProd(p.id,'oferta',e.target.value)}
                        placeholder="$0.00"
                        style={{background:C.amberD,color:C.amber,
                          border:`1px solid rgba(245,158,11,.5)`,
                          borderRadius:6,padding:'4px 6px',fontSize:12,fontWeight:700,
                          textAlign:'right',width:95,outline:'none'}}/>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}