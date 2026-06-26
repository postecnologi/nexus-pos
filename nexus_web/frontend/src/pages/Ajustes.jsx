// ============================================================
//  NEXUS POS — Ajustes de Inventario (Cargos y Descargos)
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
const fmt$ = v => '$'+Number(v||0).toLocaleString('es-EC',{minimumFractionDigits:2,maximumFractionDigits:2})
const FI = {
  padding:'8px 11px', borderRadius:8, fontSize:13,
  border:`1px solid ${C.bord2}`, background:C.sur2,
  color:C.text, outline:'none', boxSizing:'border-box', width:'100%'
}

const MOTIVOS_CARGO = [
  'Ingreso inicial de inventario',
  'Devolución de cliente',
  'Sobrante en conteo físico',
  'Producto encontrado',
  'Corrección de error',
  'Donación recibida',
  'Otro',
]
const MOTIVOS_DESCARGO = [
  'Producto dañado',
  'Producto vencido',
  'Robo o hurto',
  'Muestra o degustación',
  'Faltante en conteo físico',
  'Uso interno',
  'Descarte por calidad',
  'Corrección de error',
  'Otro',
]

// ── Buscador de productos ─────────────────────────────────────
function BuscadorProducto({onAgregar, tipo}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [txt, setTxt]   = useState('')
  const [res, setRes]   = useState([])
  const ref = useRef()

  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setRes([])}
    document.addEventListener('mousedown',h); return()=>document.removeEventListener('mousedown',h)
  },[])

  async function buscar(v) {
    setTxt(v)
    if(v.length<2){setRes([]);return}
    try{
      const{data}=await api.get('/productos',{params:{busqueda:v,activo:'true'}})
      setRes(data.slice(0,10))
    }catch{}
  }

  const accentColor = tipo==='CARGO' ? C.green : C.red

  return(
    <div ref={ref} style={{position:'relative'}}>
      <div style={{position:'relative'}}>
        <span style={{position:'absolute',left:12,top:'50%',
          transform:'translateY(-50%)',color:C.hint}}>📦</span>
        <input value={txt} onChange={e=>buscar(e.target.value)}
          placeholder="Buscar producto por código o descripción..."
          style={{...FI,paddingLeft:34,
            borderColor:accentColor+'44'}}/>
      </div>
      {res.length>0&&(
        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,
          zIndex:900,background:C.surface,borderRadius:10,
          border:`1px solid ${C.bord2}`,boxShadow:'0 12px 32px rgba(0,0,0,.6)',
          overflow:'hidden',maxHeight:320,overflowY:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <tbody>
              {res.map(p=>(
                <tr key={p.id}
                  onClick={()=>{onAgregar(p);setTxt('');setRes([])}}
                  style={{cursor:'pointer',borderBottom:`1px solid ${C.border}`}}
                  onMouseEnter={e=>e.currentTarget.style.background=C.sur2}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{padding:'8px 12px',width:100}}>
                    <code style={{fontSize:11,color:C.purple,fontWeight:700}}>{p.codigo}</code>
                  </td>
                  <td style={{padding:'8px 12px',fontSize:13,color:C.text,fontWeight:600}}>
                    {p.descripcion}
                    {p.aplica_series&&<span style={{marginLeft:6,fontSize:10,
                      padding:'1px 6px',borderRadius:6,background:C.blueD,color:C.blue,fontWeight:700}}>
                      Series
                    </span>}
                  </td>
                  <td style={{padding:'8px 12px',textAlign:'right',fontSize:12,
                    fontWeight:700,color:accentColor}}>
                    Stock: {Number(p.stock_total||0).toFixed(0)}
                  </td>
                  <td style={{padding:'8px 12px',textAlign:'center',
                    fontSize:11,color:C.blue,fontWeight:700}}>
                    + Agregar
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Modal nuevo ajuste ────────────────────────────────────────
function ModalAjuste({tipo, bodegas, onCerrar, onGuardado}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [motivo,    setMotivo]    = useState('')
  const [motivoOtro,setMotivoOtro]= useState('')
  const [bodegaId,  setBodegaId]  = useState(bodegas[0]?.id||'')
  const [obs,       setObs]       = useState('')
  const [items,     setItems]     = useState([])
  const [saving,    setSaving]    = useState(false)
  const [err,       setErr]       = useState('')

  const esCargo    = tipo==='CARGO'
  const colorTipo  = esCargo ? C.green : C.red
  const colorTipoD = esCargo ? C.greenD : C.redD
  const motivos    = esCargo ? MOTIVOS_CARGO : MOTIVOS_DESCARGO
  const motivoFinal= motivo==='Otro' ? motivoOtro : motivo

  function agregarProducto(p) {
    if(items.find(i=>i.pid===p.id)) return
    setItems(prev=>[...prev,{
      pid:           p.id,
      codigo:        p.codigo,
      descripcion:   p.descripcion,
      aplica_series: p.aplica_series||false,
      stock_actual:  Number(p.stock_total||0),
      cantidad:      1,
      costo:         Number(p.costo||0),
      motivo_det:    '',
      serie_id:      null,
      estado_serie:  'DISPONIBLE',
      series_disp:   [],
    }])
    // Cargar series si aplica
    if(p.aplica_series && bodegaId){
      api.get(`/productos/${p.id}/series-bodega`,{params:{bodega_id:bodegaId}})
        .then(r=>setItems(prev=>prev.map(i=>
          i.pid===p.id?{...i,series_disp:r.data}:i
        ))).catch(()=>{})
    }
  }

  function setItem(pid,k,v) {
    setItems(prev=>prev.map(i=>i.pid===pid?{...i,[k]:v}:i))
  }

  async function guardar() {
    if(!motivoFinal)     return setErr('Selecciona o escribe el motivo')
    if(!bodegaId)        return setErr('Selecciona la bodega')
    if(items.length===0) return setErr('Agrega al menos un producto')
    setSaving(true); setErr('')
    try{
      const{data}=await api.post('/ajustes',{
        tipo,
        motivo:       motivoFinal,
        bodega_id:    parseInt(bodegaId),
        observaciones:obs||null,
        detalles: items.map(i=>({
          producto_id:  i.pid,
          cantidad:     parseFloat(i.cantidad)||1,
          costo:        parseFloat(i.costo)||0,
          serie_id:     i.serie_id||null,
          motivo_det:   i.motivo_det||null,
          estado_serie: i.estado_serie,
        }))
      })
      onGuardado(data)
    }catch(e){ setErr(e.response?.data?.detail||e.message) }
    finally{ setSaving(false) }
  }

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:9000}}>
      <div style={{background:C.surface,borderRadius:16,padding:28,
        width:860,maxHeight:'93vh',overflowY:'auto',
        border:`1px solid ${C.bord2}`,boxShadow:'0 25px 60px rgba(0,0,0,.7)'}}>

        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',
          alignItems:'center',marginBottom:20}}>
          <div>
            <div style={{fontSize:16,fontWeight:800,color:colorTipo}}>
              {esCargo?'📦 Nuevo Cargo de Inventario':'📤 Nuevo Descargo de Inventario'}
            </div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>
              {esCargo
                ?'Aumenta el stock de productos en la bodega'
                :'Reduce el stock de productos de la bodega'}
            </div>
          </div>
          <button onClick={onCerrar} style={{background:'none',border:'none',
            cursor:'pointer',color:C.hint,fontSize:22}}>x</button>
        </div>

        {/* Motivo y bodega */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:C.muted,
              display:'block',marginBottom:6,textTransform:'uppercase'}}>
              Motivo *
            </label>
            <select value={motivo} onChange={e=>setMotivo(e.target.value)}
              style={{...FI,borderColor:motivo?colorTipo:C.bord2,
                background:motivo?colorTipoD:C.sur2}}>
              <option value="">-- Selecciona el motivo --</option>
              {motivos.map((m,i)=>(<option key={i} value={m}>{m}</option>))}
            </select>
            {motivo==='Otro'&&(
              <input value={motivoOtro} onChange={e=>setMotivoOtro(e.target.value)}
                placeholder="Describe el motivo..."
                style={{...FI,marginTop:8}}/>
            )}
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:C.muted,
              display:'block',marginBottom:6,textTransform:'uppercase'}}>
              Bodega *
            </label>
            <select value={bodegaId} onChange={e=>setBodegaId(e.target.value)}
              style={{...FI,borderColor:bodegaId?C.blue:C.bord2}}>
              <option value="">-- Selecciona bodega --</option>
              {bodegas.map(b=>(
                <option key={b.id} value={b.id}>
                  {b.nombre}{b.es_principal?' ★':''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Buscador */}
        <div style={{marginBottom:12}}>
          <BuscadorProducto onAgregar={agregarProducto} tipo={tipo}/>
        </div>

        {/* Lista de ítems */}
        {items.length>0&&(
          <div style={{background:C.sur2,borderRadius:10,
            border:`1px solid ${C.bord2}`,overflow:'hidden',marginBottom:16}}>
            {/* Header tabla */}
            <div style={{display:'grid',
              gridTemplateColumns:'1fr 80px 90px 90px 1fr 36px',
              gap:8,padding:'8px 12px',background:C.sur3,
              fontSize:10,fontWeight:700,color:C.hint,
              textTransform:'uppercase'}}>
              <span>Producto</span>
              <span style={{textAlign:'center'}}>Cant.</span>
              <span style={{textAlign:'right'}}>Costo</span>
              <span style={{textAlign:'center'}}>
                {esCargo?'Serie (opcional)':'Serie / Estado'}
              </span>
              <span>Motivo específico</span>
              <span></span>
            </div>

            {items.map(it=>(
              <div key={it.pid} style={{
                borderBottom:`1px solid ${C.border}`,padding:'10px 12px'}}>
                <div style={{display:'grid',
                  gridTemplateColumns:'1fr 80px 90px 90px 1fr 36px',
                  gap:8,alignItems:'center'}}>
                  {/* Producto */}
                  <div>
                    <div style={{fontWeight:600,fontSize:13,color:C.text}}>
                      {it.descripcion}
                    </div>
                    <div style={{display:'flex',gap:8,marginTop:2,alignItems:'center'}}>
                      <code style={{fontSize:11,color:C.purple}}>{it.codigo}</code>
                      {!esCargo&&(
                        <span style={{fontSize:10,color:C.hint}}>
                          Stock: {it.stock_actual} u.
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Cantidad */}
                  <input type="number" min="0.01" step="0.01" value={it.cantidad}
                    onChange={e=>setItem(it.pid,'cantidad',e.target.value)}
                    style={{...FI,padding:'5px 8px',textAlign:'center',
                      fontWeight:700,fontSize:14,
                      borderColor:colorTipo+'66'}}/>
                  {/* Costo */}
                  <input type="number" min="0" step="0.01" value={it.costo}
                    onChange={e=>setItem(it.pid,'costo',e.target.value)}
                    style={{...FI,padding:'5px 8px',textAlign:'right',fontSize:12}}/>
                  {/* Serie */}
                  <div>
                    {it.aplica_series&&it.series_disp.length>0?(
                      <select value={it.serie_id||''}
                        onChange={e=>setItem(it.pid,'serie_id',parseInt(e.target.value)||null)}
                        style={{...FI,padding:'4px 6px',fontSize:11,
                          borderColor:it.serie_id?colorTipo:C.bord2}}>
                        <option value="">-- Serie --</option>
                        {it.series_disp.map(s=>(
                          <option key={s.id} value={s.id}>
                            {s.serie}{s.estado==='EXHIBICION'?' (percha)':''}
                          </option>
                        ))}
                      </select>
                    ):(
                      <span style={{fontSize:11,color:C.hint}}>—</span>
                    )}
                    {/* Estado serie en descargo */}
                    {!esCargo&&it.aplica_series&&it.serie_id&&(
                      <select value={it.estado_serie}
                        onChange={e=>setItem(it.pid,'estado_serie',e.target.value)}
                        style={{...FI,padding:'3px 5px',fontSize:10,marginTop:3,
                          color:it.estado_serie==='DAÑADA'?C.red:
                                it.estado_serie==='DEVUELTA'?C.amber:C.hint}}>
                        <option value="DAÑADA">Dañada</option>
                        <option value="DEVUELTA">Devuelta</option>
                        <option value="DISPONIBLE">Disponible</option>
                      </select>
                    )}
                  </div>
                  {/* Motivo específico */}
                  <input value={it.motivo_det}
                    onChange={e=>setItem(it.pid,'motivo_det',e.target.value)}
                    placeholder="Detalle opcional..."
                    style={{...FI,padding:'5px 8px',fontSize:12}}/>
                  {/* Eliminar */}
                  <button onClick={()=>setItems(p=>p.filter(i=>i.pid!==it.pid))}
                    style={{background:'none',border:'none',cursor:'pointer',
                      color:C.hint,fontSize:18,padding:0}}
                    onMouseEnter={e=>e.currentTarget.style.color=C.red}
                    onMouseLeave={e=>e.currentTarget.style.color=C.hint}>
                    x
                  </button>
                </div>
              </div>
            ))}

            {/* Totales */}
            <div style={{padding:'10px 14px',background:C.sur3,
              display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:12,color:C.muted}}>
                {items.length} producto{items.length!==1?'s':''} ·{' '}
                {items.reduce((a,i)=>a+(parseFloat(i.cantidad)||0),0).toFixed(0)} unidades
              </span>
              <span style={{fontSize:13,fontWeight:700,
                color:esCargo?C.green:C.red}}>
                {esCargo?'↑ CARGO':'↓ DESCARGO'}
              </span>
            </div>
          </div>
        )}

        {/* Observaciones */}
        <div style={{marginBottom:16}}>
          <label style={{fontSize:11,fontWeight:700,color:C.muted,
            display:'block',marginBottom:4,textTransform:'uppercase'}}>
            Observaciones
          </label>
          <input value={obs} onChange={e=>setObs(e.target.value)}
            placeholder="Notas adicionales del ajuste..."
            style={FI}/>
        </div>

        {err&&(
          <div style={{padding:'8px 12px',borderRadius:8,fontSize:12,
            background:C.redD,color:'#FCA5A5',marginBottom:12,
            border:'1px solid rgba(239,68,68,.3)'}}>
            {err}
          </div>
        )}

        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <button onClick={onCerrar}
            style={{padding:'10px 20px',borderRadius:9,cursor:'pointer',
              border:`1px solid ${C.bord2}`,background:'transparent',
              color:C.muted,fontSize:13}}>
            Cancelar
          </button>
          <button onClick={guardar} disabled={saving}
            style={{padding:'10px 28px',borderRadius:9,border:'none',
              background:saving?C.sur3:colorTipo,
              color:saving?C.hint:'white',
              cursor:saving?'not-allowed':'pointer',
              fontSize:14,fontWeight:800,
              boxShadow:saving?'none':`0 4px 16px ${colorTipo}44`}}>
            {saving?'Procesando...':`Confirmar ${esCargo?'cargo':'descargo'}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal detalle ajuste ──────────────────────────────────────
function ModalDetalle({ajuste, onCerrar}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    api.get(`/ajustes/${ajuste.id}/detalle`)
      .then(r=>setData(r.data))
      .catch(()=>{})
      .finally(()=>setLoading(false))
  },[ajuste.id])

  const esCargo = ajuste.tipo==='CARGO'
  const color   = esCargo ? C.green : C.red

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:9000}}>
      <div style={{background:C.surface,borderRadius:16,padding:28,width:640,
        maxHeight:'85vh',overflowY:'auto',
        border:`1px solid ${C.bord2}`,boxShadow:'0 25px 60px rgba(0,0,0,.7)'}}>

        <div style={{display:'flex',justifyContent:'space-between',
          alignItems:'center',marginBottom:20}}>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:color}}>
              {esCargo?'📦':'📤'} {ajuste.tipo}
              <code style={{marginLeft:10,fontSize:13,color:C.blue}}>
                {ajuste.numero}
              </code>
            </div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>
              {ajuste.bodega_nombre} ·{' '}
              {new Date(ajuste.fecha).toLocaleString('es-EC')} ·{' '}
              {ajuste.usuario_nombre}
            </div>
          </div>
          <button onClick={onCerrar} style={{background:'none',border:'none',
            cursor:'pointer',color:C.hint,fontSize:22}}>x</button>
        </div>

        {/* Motivo */}
        <div style={{padding:'10px 14px',borderRadius:8,marginBottom:16,
          background:colorTipo?C.greenD:C.redD||C.sur2,
          border:`1px solid ${color}33`}}>
          <span style={{fontSize:11,color:C.hint}}>Motivo: </span>
          <span style={{fontSize:13,fontWeight:600,color:C.text}}>
            {ajuste.motivo}
          </span>
          {ajuste.observaciones&&(
            <div style={{fontSize:12,color:C.muted,marginTop:4}}>
              {ajuste.observaciones}
            </div>
          )}
        </div>

        {loading?(
          <div style={{padding:20,textAlign:'center',color:C.hint}}>Cargando...</div>
        ):data&&(
          <div style={{background:C.sur2,borderRadius:10,
            border:`1px solid ${C.bord2}`,overflow:'hidden'}}>
            <div style={{display:'grid',
              gridTemplateColumns:'1fr 60px 80px 100px',
              padding:'8px 12px',background:C.sur3,
              fontSize:10,fontWeight:700,color:C.hint,
              textTransform:'uppercase',gap:8}}>
              <span>Producto</span>
              <span style={{textAlign:'center'}}>Cant.</span>
              <span style={{textAlign:'right'}}>Costo</span>
              <span>Serie</span>
            </div>
            {data.detalles?.map((d,i)=>(
              <div key={i} style={{display:'grid',
                gridTemplateColumns:'1fr 60px 80px 100px',
                gap:8,padding:'10px 12px',
                borderBottom:`1px solid ${C.border}`,
                alignItems:'center'}}>
                <div>
                  <div style={{fontWeight:600,fontSize:13,color:C.text}}>
                    {d.descripcion}
                  </div>
                  <code style={{fontSize:11,color:C.purple}}>{d.codigo}</code>
                  {d.motivo_det&&(
                    <div style={{fontSize:11,color:C.hint,marginTop:2}}>
                      {d.motivo_det}
                    </div>
                  )}
                </div>
                <span style={{textAlign:'center',fontWeight:700,
                  fontSize:14,color:color}}>
                  {esCargo?'+':'-'}{Number(d.cantidad).toFixed(0)}
                </span>
                <span style={{textAlign:'right',fontSize:12,color:C.muted}}>
                  {Number(d.costo)>0?fmt$(d.costo):'—'}
                </span>
                <div>
                  {d.serie?(
                    <code style={{fontSize:11,color:C.purple,fontWeight:700}}>
                      {d.serie}
                    </code>
                  ):<span style={{color:C.hint,fontSize:11}}>—</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{display:'flex',justifyContent:'flex-end',marginTop:16}}>
          <button onClick={onCerrar}
            style={{padding:'9px 20px',borderRadius:9,cursor:'pointer',
              border:`1px solid ${C.bord2}`,background:'transparent',
              color:C.muted,fontSize:13}}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  PÁGINA PRINCIPAL
// ════════════════════════════════════════════════════════════
export default function Ajustes() {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const user = JSON.parse(localStorage.getItem('nexus_user')||'{}')
  const [ajustes,    setAjustes]    = useState([])
  const [bodegas,    setBodegas]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [busqueda,   setBusqueda]   = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')  // '' | 'CARGO' | 'DESCARGO'
  const [modal,      setModal]      = useState(null) // null | 'CARGO' | 'DESCARGO'
  const [detalle,    setDetalle]    = useState(null)
  const [ultimoAj,   setUltimoAj]  = useState(null)
  const [sucNombre,  setSucNombre]  = useState('')

  async function cargar(bus=busqueda) {
    setLoading(true)
    try{
      const{data}=await api.get('/ajustes',{params:{
        tipo:filtroTipo||undefined, busqueda:bus||undefined
      }})
      setAjustes(data)
    }finally{setLoading(false)}
  }

  useEffect(()=>{
    cargar()
    api.get('/bodegas').then(r=>setBodegas(r.data)).catch(()=>{})
    api.get('/config/sucursales').then(r=>{
      if(user.sucursal_id){
        const s=r.data.find(x=>x.id===parseInt(user.sucursal_id))
        if(s) setSucNombre(s.nombre)
      }
    }).catch(()=>{})
  },[])

  useEffect(()=>{ cargar() },[filtroTipo])

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
            🔄 Ajustes de Inventario
          </h1>
          <p style={{margin:'4px 0 0',color:C.muted,fontSize:13}}>
            Cargos y descargos de stock
            {sucNombre&&(
              <span style={{marginLeft:8,color:C.green,fontWeight:600}}>
                · 🏢 {sucNombre}
              </span>
            )}
          </p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>setModal('DESCARGO')}
            style={{display:'flex',alignItems:'center',gap:7,
              padding:'10px 18px',borderRadius:10,border:'none',
              background:C.red,color:'white',cursor:'pointer',
              fontSize:13,fontWeight:700,
              boxShadow:'0 4px 14px rgba(239,68,68,.35)'}}>
            📤 Nuevo descargo
          </button>
          <button onClick={()=>setModal('CARGO')}
            style={{display:'flex',alignItems:'center',gap:7,
              padding:'10px 18px',borderRadius:10,border:'none',
              background:C.green,color:'white',cursor:'pointer',
              fontSize:13,fontWeight:700,
              boxShadow:'0 4px 14px rgba(16,185,129,.35)'}}>
            📦 Nuevo cargo
          </button>
        </div>
      </div>

      {/* Alerta último ajuste */}
      {ultimoAj&&(
        <div style={{marginBottom:16,padding:'12px 16px',borderRadius:10,
          background:C.greenD,border:`1px solid rgba(16,185,129,.3)`,
          display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span>
            <span style={{color:C.green,fontWeight:700}}>Ajuste confirmado: </span>
            <code style={{color:C.blue,fontWeight:700}}>{ultimoAj.numero}</code>
          </span>
          <button onClick={()=>setUltimoAj(null)}
            style={{background:'none',border:'none',cursor:'pointer',
              color:C.hint,fontSize:18}}>x</button>
        </div>
      )}

      {/* Filtros */}
      <div style={{background:C.surface,borderRadius:12,padding:'12px 16px',
        border:`1px solid ${C.bord2}`,marginBottom:14,
        display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
        <div style={{position:'relative',flex:1,minWidth:220}}>
          <span style={{position:'absolute',left:12,top:'50%',
            transform:'translateY(-50%)',color:C.hint}}>🔍</span>
          <input value={busqueda} onChange={e=>setBusqueda(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&cargar(busqueda)}
            placeholder="Buscar por N° o motivo..."
            style={{...FI,paddingLeft:32}}/>
        </div>
        <button onClick={()=>cargar(busqueda)}
          style={{padding:'8px 16px',borderRadius:9,border:'none',
            background:C.blue,color:'white',cursor:'pointer',
            fontSize:13,fontWeight:600}}>
          Buscar
        </button>
        {/* Filtro tipo */}
        <div style={{display:'flex',borderRadius:9,overflow:'hidden',
          border:`1px solid ${C.bord2}`}}>
          {[['','Todos'],['CARGO','📦 Cargos'],['DESCARGO','📤 Descargos']].map(([v,l])=>(
            <button key={v} onClick={()=>setFiltroTipo(v)}
              style={{padding:'8px 14px',border:'none',cursor:'pointer',
                fontSize:12,fontWeight:600,
                background:filtroTipo===v
                  ?(v==='CARGO'?C.green:v==='DESCARGO'?C.red:C.blue)
                  :C.sur2,
                color:filtroTipo===v?'white':C.muted}}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div style={{background:C.surface,borderRadius:12,
        border:`1px solid ${C.bord2}`,overflow:'hidden'}}>
        {loading?(
          <div style={{padding:40,textAlign:'center',color:C.hint}}>
            Cargando ajustes...
          </div>
        ):(
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr>
                {['N° Ajuste','Tipo','Motivo','Bodega',
                  'Productos','Unidades','Fecha','Usuario',''].map((h,i)=>(
                  <th key={i} style={TH(i>=4&&i<=5?'center':'left')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ajustes.map(a=>{
                const esCargo = a.tipo==='CARGO'
                return(
                  <tr key={a.id}
                    onMouseEnter={e=>e.currentTarget.style.background=C.sur2}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={TD()}>
                      <code style={{color:C.blue,fontWeight:700,fontSize:12}}>
                        {a.numero}
                      </code>
                    </td>
                    <td style={TD()}>
                      <span style={{padding:'3px 12px',borderRadius:20,
                        fontSize:11,fontWeight:700,
                        background:esCargo?C.greenD:C.redD,
                        color:esCargo?C.green:C.red}}>
                        {esCargo?'↑ CARGO':'↓ DESCARGO'}
                      </span>
                    </td>
                    <td style={{...TD(),maxWidth:200,overflow:'hidden',
                      textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:12}}>
                      {a.motivo}
                    </td>
                    <td style={{...TD(),fontSize:12,color:C.muted}}>
                      {a.bodega_nombre}
                    </td>
                    <td style={{...TD('center')}}>
                      <span style={{padding:'2px 8px',borderRadius:20,
                        fontSize:12,fontWeight:700,
                        background:'rgba(139,92,246,.15)',color:C.purple}}>
                        {a.num_productos}
                      </span>
                    </td>
                    <td style={{...TD('center'),fontWeight:700,
                      color:esCargo?C.green:C.red}}>
                      {esCargo?'+':'-'}{Number(a.total_unidades||0).toFixed(0)}
                    </td>
                    <td style={{...TD(),fontSize:12,color:C.muted}}>
                      {new Date(a.fecha).toLocaleDateString('es-EC',
                        {day:'2-digit',month:'2-digit',year:'numeric'})}
                    </td>
                    <td style={{...TD(),fontSize:12,color:C.hint}}>
                      {a.usuario_nombre||'—'}
                    </td>
                    <td style={{...TD('center')}}>
                      <button onClick={()=>setDetalle(a)}
                        style={{padding:'5px 12px',borderRadius:8,cursor:'pointer',
                          border:`1px solid ${C.bord2}`,background:C.sur2,
                          color:C.muted,fontSize:11}}>
                        Ver
                      </button>
                    </td>
                  </tr>
                )
              })}
              {ajustes.length===0&&(
                <tr><td colSpan={9} style={{padding:'48px 0',textAlign:'center',
                  color:C.hint,fontSize:13}}>
                  No hay ajustes registrados
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal nuevo ajuste */}
      {modal&&(
        <ModalAjuste
          tipo={modal}
          bodegas={bodegas}
          onCerrar={()=>setModal(null)}
          onGuardado={data=>{
            setModal(null)
            setUltimoAj(data)
            cargar()
          }}
        />
      )}

      {/* Modal detalle */}
      {detalle&&(
        <ModalDetalle
          ajuste={detalle}
          onCerrar={()=>setDetalle(null)}
        />
      )}
    </div>
  )
}
