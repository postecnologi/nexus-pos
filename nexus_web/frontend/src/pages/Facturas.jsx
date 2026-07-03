import React,{useState,useEffect,useRef} from 'react'
import api from '../api'
import { useTheme } from '../theme'

// ── Paleta ───────────────────────────────────────────────────
const C={
  bg:'#0A0F1E', surface:'#111827', sur2:'#1F2937', sur3:'#374151',
  border:'#1F2937', bord2:'#374151', bord3:'#4B5563',
  text:'#F9FAFB', muted:'#9CA3AF', hint:'#6B7280',
  blue:'#3B82F6', blueGlow:'rgba(59,130,246,.35)',
  green:'#10B981', greenD:'rgba(16,185,129,.18)',
  amber:'#F59E0B', amberD:'rgba(245,158,11,.18)',
  red:'#EF4444', redD:'rgba(239,68,68,.18)',
  purple:'#8B5CF6', purpleD:'rgba(139,92,246,.18)',
  cyan:'#06B6D4',
}

const fmt$=v=>'$'+Number(v||0).toLocaleString('es-EC',{minimumFractionDigits:2,maximumFractionDigits:2})
const IVA=15

// ── Input base — los componentes con useTheme() redefinen FI localmente ──
const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:'1px solid #374151',
  background:'#1F2937',color:'#F9FAFB',outline:'none',boxSizing:'border-box',width:'100%'}

// ── ModalNuevoCliente ────────────────────────────────────────
function ModalNuevoCliente({onGuardado,onCancelar}){
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [f,setF]=useState({tipo_identificacion:'RUC',identificacion:'',razon_social:'',
    telefono:'',email:'',ciudad:'',direccion:'',tipo_contribuyente:'NATURAL',activo:true,
    limite_credito:0,plazo_pago:0})
  const [saving,setSaving]=useState(false),[err,setErr]=useState('')
  const s=(k,v)=>setF(p=>({...p,[k]:v}))
  async function buscarSRI(){
    if(f.identificacion.length<10) return
    try{const{data}=await api.get(`/sri/consulta/${f.identificacion}`);if(data?.razon_social)s('razon_social',data.razon_social)}catch{}
  }
  async function guardar(){
    if(!f.identificacion||!f.razon_social) return setErr('Identificación y razón social obligatorios')
    setSaving(true);setErr('')
    try{const{data}=await api.post('/clientes',{...f,limite_credito:parseFloat(f.limite_credito)||0,plazo_pago:parseInt(f.plazo_pago)||0});onGuardado({id:data.id,...f})}
    catch(e){setErr(e.response?.data?.detail||e.message)}finally{setSaving(false)}
  }
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9000}}>
      <div style={{background:C.surface,borderRadius:16,padding:28,width:540,border:`1px solid ${C.bord2}`,boxShadow:'0 25px 60px rgba(0,0,0,.7)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <span style={{fontSize:16,fontWeight:700,color:C.text}}>Nuevo cliente</span>
          <button onClick={onCancelar} style={{background:'none',border:'none',cursor:'pointer',color:C.hint,fontSize:22,lineHeight:1}}>×</button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div>
            <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3,fontWeight:600}}>TIPO ID</label>
            <select value={f.tipo_identificacion} onChange={e=>s('tipo_identificacion',e.target.value)} style={FI}>
              <option>RUC</option><option>CEDULA</option><option>PASAPORTE</option><option>CONSUMIDOR FINAL</option>
            </select>
          </div>
          <div>
            <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3,fontWeight:600}}>IDENTIFICACIÓN *</label>
            <div style={{display:'flex',gap:6}}>
              <input value={f.identificacion} onChange={e=>s('identificacion',e.target.value)} onBlur={buscarSRI}
                style={{...FI,flex:1}} placeholder="RUC / Cédula"/>
              <button onClick={buscarSRI} style={{padding:'9px 10px',borderRadius:8,border:`1px solid ${C.blue}`,
                background:'rgba(59,130,246,.15)',color:C.blue,cursor:'pointer',fontSize:12,fontWeight:700,flexShrink:0}}>SRI</button>
            </div>
          </div>
          <div style={{gridColumn:'1/-1'}}>
            <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3,fontWeight:600}}>RAZÓN SOCIAL *</label>
            <input value={f.razon_social} onChange={e=>s('razon_social',e.target.value.toUpperCase())} style={FI}/>
          </div>
          {[{k:'telefono',l:'TELÉFONO',ph:'0999999999'},{k:'email',l:'EMAIL',ph:'correo@'},{k:'ciudad',l:'CIUDAD',ph:'Quito'}].map(({k,l,ph})=>(
            <div key={k}>
              <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3,fontWeight:600}}>{l}</label>
              <input value={f[k]} onChange={e=>s(k,e.target.value)} placeholder={ph} style={FI}/>
            </div>
          ))}
          <div style={{gridColumn:'1/-1'}}>
            <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3,fontWeight:600}}>DIRECCIÓN</label>
            <input value={f.direccion} onChange={e=>s('direccion',e.target.value)} style={FI}/>
          </div>
        </div>
        {err&&<div style={{marginTop:12,padding:'8px 12px',borderRadius:8,fontSize:12,background:C.redD,color:'#FCA5A5',border:`1px solid rgba(239,68,68,.3)`}}>{err}</div>}
        <div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end'}}>
          <button onClick={onCancelar} style={{padding:'9px 18px',borderRadius:8,border:`1px solid ${C.bord2}`,background:'transparent',color:C.muted,cursor:'pointer',fontSize:13}}>Cancelar</button>
          <button onClick={guardar} disabled={saving} style={{padding:'9px 22px',borderRadius:8,border:'none',background:C.blue,color:'white',cursor:'pointer',fontSize:13,fontWeight:700}}>
            {saving?'Guardando...':'Crear cliente'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── SelectorCliente ──────────────────────────────────────────
function SelectorCliente({value,onChange,onVendedor}){
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [txt,setTxt]=useState(''),[res,setRes]=useState([]),[open,setOpen]=useState(false),[nuevo,setNuevo]=useState(false)
  const ref=useRef()
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false)};document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h)},[])
  async function buscar(v){setTxt(v);if(v.length<2){setRes([]);setOpen(false);return}
    try{const{data}=await api.get('/clientes',{params:{busqueda:v,activo:'true'}});setRes(data.slice(0,8));setOpen(true)}catch{}}
  function pick(c){onChange(c);if(c.vendedor_id)onVendedor(String(c.vendedor_id));setTxt(c.razon_social);setOpen(false);setRes([])}

  if(value) return(
    <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:10,
      background:C.greenD,border:`1px solid rgba(16,185,129,.3)`}}>
      <span style={{fontSize:16}}>🏢</span>
      <div style={{flex:1}}>
        <div style={{fontWeight:700,fontSize:14,color:C.text}}>{value.razon_social}</div>
        <div style={{fontSize:11,color:C.muted}}>{value.tipo_identificacion} {value.identificacion}{value.email&&` · ${value.email}`}</div>
      </div>
      <button onClick={()=>{onChange(null);setTxt('')}} style={{background:'none',border:'none',cursor:'pointer',color:C.hint,fontSize:20}}>×</button>
    </div>
  )

  return(
    <div ref={ref} style={{position:'relative'}}>
      {nuevo&&<ModalNuevoCliente onGuardado={c=>{pick(c);setNuevo(false)}} onCancelar={()=>setNuevo(false)}/>}
      <div style={{display:'flex',gap:8}}>
        <div style={{position:'relative',flex:1}}>
          <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:14,color:C.hint}}>🔍</span>
          <input value={txt} onChange={e=>buscar(e.target.value)} onFocus={()=>txt.length>=2&&setOpen(true)}
            placeholder="Buscar por nombre, RUC o cédula..."
            style={{...FI,paddingLeft:34}}/>
        </div>
        <button onClick={()=>setNuevo(true)} style={{padding:'9px 16px',borderRadius:8,border:`1px solid ${C.blue}`,
          background:'rgba(59,130,246,.15)',color:C.blue,cursor:'pointer',fontSize:13,fontWeight:700,whiteSpace:'nowrap',flexShrink:0}}>
          + Nuevo
        </button>
      </div>
      {open&&res.length>0&&(
        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,zIndex:800,
          background:C.surface,borderRadius:12,border:`1px solid ${C.bord2}`,
          boxShadow:'0 12px 32px rgba(0,0,0,.6)',overflow:'hidden'}}>
          {res.map(c=>(
            <div key={c.id} onClick={()=>pick(c)} style={{padding:'10px 14px',cursor:'pointer',borderBottom:`1px solid ${C.border}`}}
              onMouseEnter={e=>e.currentTarget.style.background=C.sur2}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <div style={{fontWeight:600,fontSize:13,color:C.text}}>{c.razon_social}</div>
              <div style={{fontSize:11,color:C.muted}}>{c.tipo_identificacion} {c.identificacion}{c.vendedor_nombre&&<span style={{marginLeft:8,color:C.purple}}>· {c.vendedor_nombre}</span>}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── BuscadorProducto ─────────────────────────────────────────
function BuscadorProducto({onAgregar,tipoPrecioId}){
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [txt,setTxt]=useState(''),[res,setRes]=useState([]),[open,setOpen]=useState(false)
  const ref=useRef()
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false)};document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h)},[])
  const lastResults = useRef([])
  async function buscar(v){setTxt(v);if(v.length<2){setRes([]);lastResults.current=[];setOpen(false);return}
    try{const params={busqueda:v,activo:'true'};if(tipoPrecioId&&tipoPrecioId>1)params.tipo_precio_id=tipoPrecioId;const{data}=await api.get('/productos',{params});const r=data.slice(0,12);setRes(r);lastResults.current=r;setOpen(true)}catch{}}
  function agregar(p){onAgregar(p);setTxt('');setRes([]);lastResults.current=[];setOpen(false)}
  function handleEnter(e){
    if(e.key==='Enter'){
      e.preventDefault()
      const r=lastResults.current
      if(r.length===1){agregar(r[0])}
      else if(r.length>1){
        const exact=r.find(p=>p.codigo?.toLowerCase()===txt.toLowerCase())
        if(exact) agregar(exact)
      }
    }
  }

  return(
    <div ref={ref} style={{position:'relative',flex:1}}>
      <div style={{position:'relative'}}>
        <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:14,color:C.hint}}>📦</span>
        <input value={txt} onChange={e=>buscar(e.target.value)} onKeyDown={handleEnter}
          placeholder="Buscar producto por código o descripción... (o escanear código de barras)"
          style={{...FI,paddingLeft:34,background:C.sur2,border:`1px dashed ${C.bord2}`}}/>
      </div>
      {open&&res.length>0&&(
        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,zIndex:800,
          background:C.surface,borderRadius:12,border:`1px solid ${C.bord2}`,
          boxShadow:'0 12px 32px rgba(0,0,0,.6)',overflow:'hidden',maxHeight:340,overflowY:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',tableLayout:'fixed'}}>
            <colgroup><col style={{width:'15%'}}/><col style={{width:'45%'}}/><col style={{width:'20%'}}/><col style={{width:'20%'}}/></colgroup>
            <thead>
              <tr style={{background:C.sur3}}>
                {['Código','Descripción','Stock','Precio'].map((h,i)=>(
                  <th key={i} style={{padding:'7px 10px',fontSize:10,fontWeight:700,color:C.hint,
                    textAlign:i>=2?'center':'left',borderBottom:`1px solid ${C.bord2}`,textTransform:'uppercase'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {res.map(p=>{
                const stk=Number(p.stock_total||0)
                return(
                  <tr key={p.id} onClick={()=>agregar(p)} style={{cursor:'pointer',borderBottom:`1px solid ${C.border}`}}
                    onMouseEnter={e=>e.currentTarget.style.background=C.sur2}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{padding:'8px 10px'}}><code style={{fontSize:11,color:C.purple,fontWeight:700}}>{p.codigo}</code></td>
                    <td style={{padding:'8px 10px',fontSize:12,fontWeight:600,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {p.descripcion}
                      {p.stock_bodegas&&p.stock_bodegas.length>0&&(
                        <div style={{display:'flex',gap:3,marginTop:3,flexWrap:'wrap'}}>
                          {p.stock_bodegas.map((b,i)=>(
                            <span key={i} style={{fontSize:9,padding:'1px 6px',borderRadius:8,
                              fontWeight:600,background:Number(b.cantidad)>0?C.greenD:C.redD,
                              color:Number(b.cantidad)>0?C.green:C.red}}>
                              {b.bodega}:{Number(b.cantidad||0).toFixed(0)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{padding:'8px 10px',textAlign:'center'}}>
                      <span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,
                        background:stk>5?C.greenD:stk>0?C.amberD:C.redD,
                        color:stk>5?C.green:stk>0?C.amber:C.red}}>{stk}</span>
                    </td>
                    <td style={{padding:'8px 10px',textAlign:'right',fontWeight:800,fontSize:13,
                      color:p.tiene_oferta?C.amber:C.blue}}>
                      {p.tiene_oferta&&p.precio_original>0&&(
                        <div style={{fontSize:10,color:C.hint,textDecoration:'line-through'}}>
                          {fmt$(p.precio_original*(1+(Number(p.iva_porcentaje||0)/100)))}
                        </div>
                      )}
                      <div>
                        {p.tiene_oferta
                          ? fmt$(p.precio_oferta_pvp||0)
                          : fmt$(p.precio_venta*(1+(Number(p.iva_porcentaje||0)/100)))}
                      </div>
                      {p.tiene_oferta&&<span style={{fontSize:9,
                        padding:'1px 4px',borderRadius:4,background:C.amberD,color:C.amber,fontWeight:700}}>
                        🏷 OFERTA c/IVA
                      </span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}


// ── BuscadorVendedor ─────────────────────────────────────────
function BuscadorVendedor({value, onChange}){
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [txt,setTxt]=useState(''),[res,setRes]=useState([]),[open,setOpen]=useState(false)
  const ref=useRef()
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false)}
    document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h)
  },[])

  // Inicializar texto con vendedor actual
  useEffect(()=>{
    if(value?.nombre) setTxt(`${value.nombre} ${value.apellidos||''}`.trim())
    else if(!value) setTxt('')
  },[value])

  async function buscar(v){
    setTxt(v)
    if(v.length<1){setRes([]);setOpen(false);return}
    try{
      const{data}=await api.get('/vendedores',{params:{busqueda:v,activo:'true'}})
      setRes(data.slice(0,8));setOpen(true)
    }catch{}
  }

  function pick(v){
    onChange(v)
    setTxt(`${v.nombre} ${v.apellidos||''}`.trim())
    setOpen(false);setRes([])
  }

  function limpiar(){onChange(null);setTxt('');setRes([]);setOpen(false)}

  return(
    <div ref={ref} style={{position:'relative',width:'100%'}}>
      <div style={{position:'relative'}}>
        <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',
          fontSize:13,color:C.hint,pointerEvents:'none'}}>👤</span>
        <input value={txt} onChange={e=>buscar(e.target.value)}
          onFocus={()=>{if(txt.length>=1)setOpen(true)}}
          placeholder="Buscar vendedor por nombre o cédula..."
          style={{...FI,paddingLeft:30,paddingRight:value?28:12,
            borderColor:value?'rgba(59,130,246,.5)':C.bord2,
            background:value?'rgba(59,130,246,.08)':C.sur2}}/>
        {value&&(
          <button onClick={limpiar}
            style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',
              background:'none',border:'none',cursor:'pointer',color:C.hint,
              fontSize:16,lineHeight:1,padding:2}}>×</button>
        )}
      </div>
      {value&&(
        <div style={{fontSize:10,color:C.blue,marginTop:3,paddingLeft:4,fontWeight:600}}>
          {value.sucursal_nombre&&`${value.sucursal_nombre} · `}
          {value.cedula&&`Cédula: ${value.cedula}`}
        </div>
      )}
      {open&&res.length>0&&(
        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,zIndex:900,
          background:C.surface,borderRadius:10,border:`1px solid ${C.bord2}`,
          boxShadow:'0 12px 32px rgba(0,0,0,.6)',overflow:'hidden'}}>
          {res.map(v=>(
            <div key={v.id} onClick={()=>pick(v)}
              style={{padding:'9px 14px',cursor:'pointer',borderBottom:`1px solid ${C.border}`}}
              onMouseEnter={e=>e.currentTarget.style.background=C.sur2}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontWeight:700,fontSize:13,color:C.text}}>
                    {v.nombre} {v.apellidos||''}
                  </div>
                  <div style={{fontSize:11,color:C.muted,marginTop:1}}>
                    {v.cedula&&<span>Cédula: {v.cedula}</span>}
                    {v.codigo&&<span style={{marginLeft:8,color:C.purple}}>· Cód: {v.codigo}</span>}
                    {v.sucursal_nombre&&<span style={{marginLeft:8,color:C.cyan}}>· {v.sucursal_nombre}</span>}
                  </div>
                </div>
                {v.activo&&(
                  <span style={{fontSize:10,padding:'2px 8px',borderRadius:20,
                    background:C.greenD,color:C.green,fontWeight:700,flexShrink:0}}>
                    Activo
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// -- ModalReimprimir --
function ModalReimprimir({onCerrar, onImprimir, onSRI, onRIDE, onXML, onEmail, onTicket, onDuplicar, esNotaVenta}){
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [q,setQ]=useState(''),[fecha,setFecha]=useState(''),[res,setRes]=useState([]),[loading,setLoading]=useState(false)
  async function buscar(){
    setLoading(true)
    try{const{data}=await api.get('/reimprimir/buscar',{params:{q,fecha}});setRes(data)}
    catch{}finally{setLoading(false)}
  }
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9000}}>
      <div style={{background:C.surface,borderRadius:16,padding:28,width:680,maxHeight:'80vh',
        display:'flex',flexDirection:'column',border:`1px solid ${C.bord2}`,boxShadow:'0 25px 60px rgba(0,0,0,.7)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:C.text}}>{esNotaVenta ? 'Reimprimir nota de venta' : 'Reimprimir factura'}</div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>Busca por numero de factura, nombre o cedula/RUC del cliente</div>
          </div>
          <button onClick={onCerrar} style={{background:'none',border:'none',cursor:'pointer',color:C.hint,fontSize:22}}>x</button>
        </div>
        <div style={{display:'flex',gap:8,marginBottom:14}}>
          <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&buscar()}
            placeholder="N factura, nombre o RUC del cliente..."
            style={{...FI,flex:1}}/>
          <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}
            style={{...FI,width:160}}/>
          <button onClick={buscar} style={{padding:'9px 18px',borderRadius:8,border:'none',
            background:C.blue,color:'white',cursor:'pointer',fontSize:13,fontWeight:700}}>Buscar</button>
        </div>
        <div style={{flex:1,overflowY:'auto'}}>
          {loading&&<div style={{textAlign:'center',padding:24,color:C.hint}}>Buscando...</div>}
          {!loading&&res.length===0&&q&&<div style={{textAlign:'center',padding:24,color:C.hint,fontSize:13}}>Sin resultados</div>}
          {res.map(f=>(
            <div key={f.id} style={{padding:'12px 14px',borderRadius:10,marginBottom:8,
              background:C.sur2,border:`1px solid ${C.bord2}`,
              display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <code style={{fontSize:13,fontWeight:700,color:C.purple}}>{f.numero_factura}</code>
                  <span style={{fontSize:11,color:C.muted}}>{f.fecha_emision?.toString().slice(0,10)}</span>
                </div>
                <div style={{fontSize:13,color:C.text,marginTop:3,fontWeight:600}}>{f.cliente_nombre}</div>
                <div style={{fontSize:11,color:C.muted}}>{f.cliente_ruc}</div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontSize:16,fontWeight:800,color:C.green}}>{fmt$(f.total)}</div>
                <div style={{display:'flex',gap:4,marginTop:6,flexWrap:'wrap'}}>
                  <button onClick={()=>onImprimir(f.id)}
                    style={{padding:'5px 10px',borderRadius:6,
                      border:`1px solid ${C.blue}44`,background:C.blueD,
                      color:C.blue,cursor:'pointer',fontSize:11,fontWeight:700}}>
                    Imprimir
                  </button>
                  <button onClick={()=>onSRI(f.id)}
                    style={{padding:'5px 10px',borderRadius:6,
                      border:`1px solid ${C.purple}44`,background:C.purpleD,
                      color:C.purple,cursor:'pointer',fontSize:11,fontWeight:700}}>
                    SRI
                  </button>
                  <button onClick={()=>onRIDE(f.id)}
                    style={{padding:'5px 10px',borderRadius:6,
                      border:`1px solid ${C.green}44`,background:C.greenD,
                      color:C.green,cursor:'pointer',fontSize:11,fontWeight:700}}>
                    PDF
                  </button>
                  <button onClick={()=>onXML(f.id)}
                    style={{padding:'5px 10px',borderRadius:6,
                      border:`1px solid ${C.cyan}44`,background:'rgba(6,182,212,.12)',
                      color:C.cyan,cursor:'pointer',fontSize:11,fontWeight:700}}>
                    XML
                  </button>
                  <button onClick={()=>onEmail(f.id)}
                    style={{padding:'5px 10px',borderRadius:6,
                      border:`1px solid ${C.green}44`,background:C.greenD,
                      color:C.green,cursor:'pointer',fontSize:11,fontWeight:700}}>
                    Email
                  </button>
                  {onTicket&&<button onClick={()=>onTicket(f.id)}
                    style={{padding:'5px 10px',borderRadius:6,
                      border:`1px solid ${C.amber}44`,background:C.amberD,
                      color:C.amber,cursor:'pointer',fontSize:11,fontWeight:700}}>
                    Ticket
                  </button>}
                  {onDuplicar&&<button onClick={()=>onDuplicar(f.id)}
                    style={{padding:'5px 10px',borderRadius:6,
                      border:`1px solid ${C.cyan}44`,background:'rgba(6,182,212,.12)',
                      color:C.cyan,cursor:'pointer',fontSize:11,fontWeight:700}}>
                    Duplicar
                  </button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// -- ModalRecurrentes --
function ModalRecurrentes({onCerrar}){
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [recurrentes,setRecurrentes]=useState([]),[loading,setLoading]=useState(true)
  useEffect(()=>{
    api.get('/facturas/recurrentes').then(r=>setRecurrentes(r.data)).catch(()=>{}).finally(()=>setLoading(false))
  },[])
  async function desactivar(rid){
    try{await api.delete(`/facturas/recurrentes/${rid}`);setRecurrentes(p=>p.filter(r=>r.id!==rid))}catch{}
  }
  async function procesar(){
    try{const{data}=await api.post('/facturas/recurrentes/procesar');alert(data.msg)}catch(e){alert(e.response?.data?.detail||e.message)}
  }
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9000}}>
      <div style={{background:C.surface,borderRadius:16,padding:28,width:560,maxHeight:'70vh',
        display:'flex',flexDirection:'column',border:`1px solid ${C.bord2}`,boxShadow:'0 25px 60px rgba(0,0,0,.7)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
          <div style={{fontSize:16,fontWeight:700,color:C.text}}>Facturas recurrentes</div>
          <button onClick={onCerrar} style={{background:'none',border:'none',cursor:'pointer',color:C.hint,fontSize:22}}>x</button>
        </div>
        <div style={{display:'flex',gap:8,marginBottom:14}}>
          <button onClick={procesar} style={{padding:'8px 16px',borderRadius:8,border:'none',
            background:C.green,color:'white',cursor:'pointer',fontSize:12,fontWeight:700}}>
            Procesar pendientes
          </button>
        </div>
        <div style={{flex:1,overflowY:'auto'}}>
          {loading&&<div style={{textAlign:'center',padding:24,color:C.hint}}>Cargando...</div>}
          {!loading&&recurrentes.length===0&&<div style={{textAlign:'center',padding:24,color:C.hint,fontSize:13}}>No hay facturas recurrentes</div>}
          {recurrentes.map(r=>(
            <div key={r.id} style={{padding:'12px 14px',borderRadius:10,marginBottom:8,
              background:C.sur2,border:`1px solid ${C.bord2}`,
              display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:C.text}}>{r.cliente_nombre}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>
                  {r.frecuencia} | Dia {r.dia_emision} | Prox: {r.proximo_emision?.toString().slice(0,10)}
                </div>
                {r.descripcion&&<div style={{fontSize:11,color:C.hint,marginTop:2}}>{r.descripcion}</div>}
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontSize:14,fontWeight:800,color:C.green}}>{fmt$(r.total)}</div>
                <button onClick={()=>desactivar(r.id)}
                  style={{marginTop:4,padding:'4px 10px',borderRadius:6,cursor:'pointer',
                    border:`1px solid ${C.red}44`,background:C.redD,
                    color:C.red,fontSize:11,fontWeight:700}}>
                  Desactivar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// -- ModalBorradores --
function ModalBorradores({onCerrar,onCargar,onEmitir}){
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [borradores,setBorradores]=useState([]),[loading,setLoading]=useState(true)
  useEffect(()=>{
    api.get('/facturas/borradores').then(r=>setBorradores(r.data)).catch(()=>{}).finally(()=>setLoading(false))
  },[])
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9000}}>
      <div style={{background:C.surface,borderRadius:16,padding:28,width:560,maxHeight:'70vh',
        display:'flex',flexDirection:'column',border:`1px solid ${C.bord2}`,boxShadow:'0 25px 60px rgba(0,0,0,.7)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
          <div style={{fontSize:16,fontWeight:700,color:C.text}}>Borradores guardados</div>
          <button onClick={onCerrar} style={{background:'none',border:'none',cursor:'pointer',color:C.hint,fontSize:22}}>x</button>
        </div>
        <div style={{flex:1,overflowY:'auto'}}>
          {loading&&<div style={{textAlign:'center',padding:24,color:C.hint}}>Cargando...</div>}
          {!loading&&borradores.length===0&&<div style={{textAlign:'center',padding:24,color:C.hint,fontSize:13}}>No hay borradores</div>}
          {borradores.map(b=>(
            <div key={b.id} style={{padding:'12px 14px',borderRadius:10,marginBottom:8,
              background:C.sur2,border:`1px solid ${C.bord2}`,
              display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:C.text}}>{b.cliente_nombre}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>
                  #{b.id} | {b.created_at?.toString().slice(0,10)}
                </div>
                {b.observaciones&&<div style={{fontSize:11,color:C.hint,marginTop:2}}>{b.observaciones}</div>}
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontSize:14,fontWeight:800,color:C.amber}}>{fmt$(b.total)}</div>
                <div style={{display:'flex',gap:4,marginTop:4}}>
                  <button onClick={()=>{onCargar(b.id);onCerrar()}}
                    style={{padding:'5px 14px',borderRadius:6,cursor:'pointer',
                      border:`1px solid ${C.blue}44`,background:'rgba(59,130,246,.12)',
                      color:C.blue,fontSize:11,fontWeight:700}}>
                    Cargar
                  </button>
                  <button onClick={async()=>{
                    if(!confirm('¿Eliminar este borrador?')) return
                    try{
                      await api.delete(`/facturas/${b.id}`)
                      setBorradores(p=>p.filter(x=>x.id!==b.id))
                    }catch(e){alert(e.response?.data?.detail||'No se pudo eliminar')}
                  }}
                    style={{padding:'5px 10px',borderRadius:6,cursor:'pointer',
                      border:`1px solid ${C.red}44`,background:C.redD,
                      color:C.red,fontSize:11,fontWeight:700}}>
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── ModalCobro ───────────────────────────────────────────────
function ModalCobro({total,pagos,setPagos,onConfirmar,onCancelar,cuentasBanc=[]}){
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const BANCOS=['Banco Pichincha','Banco del Pacífico','Banco Guayaquil','Produbanco','Banco Internacional','Banco Bolivariano','BanEcuador','Coop. JEP']
  const METODOS=[
    {id:'EFECTIVO',     l:'Efectivo',     e:'💵'},
    {id:'TARJETA',      l:'Tarjeta',      e:'💳'},
    {id:'TRANSFERENCIA',l:'Transferencia',e:'🏦'},
    {id:'DEUNA',        l:'DeUna',        e:'📲'},
    {id:'CHEQUE',       l:'Cheque',        e:'📄'},
    {id:'CREDITO',      l:'Crédito',      e:'📋'},
  ]
  const totalPagado=pagos.reduce((a,p)=>a+Number(p.monto||0),0)
  const falta=Math.max(0,total-totalPagado)
  const vuelto=Math.max(0,totalPagado-total)
  const listo=pagos.length>0&&totalPagado>=total-0.005

  // Agregar nueva línea de pago (permite múltiples del mismo tipo)
  function agregar(id){
    const uid = id+'_'+Date.now()
    setPagos(p=>[...p,{uid,metodo:id,monto:falta>0?parseFloat(falta.toFixed(2)):0,
      referencia:'',autorizacion:'',banco_origen:'',cuenta_bancaria_id:null,
      num_tarjeta:'',fecha_cheque:'',titular_cheque:''}])
  }
  // Actualizar por uid único
  const upd=(uid,k,v)=>setPagos(p=>p.map(x=>x.uid===uid?{...x,[k]:v}:x))
  const del=(uid)=>setPagos(p=>p.filter(x=>x.uid!==uid))
  const fi2={...FI,marginTop:6}
  const listCampo=(uid,k,ph,lid)=>(
    <><input value={pagos.find(p=>p.uid===uid)?.[k]||''} onChange={e=>upd(uid,k,e.target.value)}
      placeholder={ph} list={lid} style={fi2}/>
    <datalist id={lid}>{BANCOS.map((b,i)=><option key={i} value={b}/>)}</datalist></>
  )

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9000}}>
      <div style={{background:C.surface,borderRadius:16,padding:28,width:500,maxHeight:'90vh',overflowY:'auto',
        border:`1px solid ${C.bord2}`,boxShadow:'0 25px 60px rgba(0,0,0,.8)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <span style={{fontSize:16,fontWeight:700,color:C.text}}>💳 Cobro</span>
          <button onClick={onCancelar} style={{background:'none',border:'none',cursor:'pointer',color:C.hint,fontSize:22}}>×</button>
        </div>

        {/* Total */}
        <div style={{borderRadius:12,padding:'16px 20px',marginBottom:18,
          background:'linear-gradient(135deg,#1e3a5f,#0f2540)',
          border:`1px solid rgba(59,130,246,.3)`,
          display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:12,color:'#93C5FD',fontWeight:600,textTransform:'uppercase',letterSpacing:'.05em'}}>Total a cobrar</span>
          <span style={{fontSize:28,fontWeight:800,color:'white'}}>{fmt$(total)}</span>
        </div>

        {/* Métodos — cada clic agrega una línea */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:18}}>
          {METODOS.map(m=>{
            const cnt=pagos.filter(p=>p.metodo===m.id).length
            return(
              <button key={m.id} onClick={()=>agregar(m.id)}
                style={{padding:'12px 8px',borderRadius:10,cursor:'pointer',
                  border:cnt>0?`1.5px solid ${C.blue}`:`1px solid ${C.bord2}`,
                  background:cnt>0?'rgba(59,130,246,.2)':C.sur2,
                  color:cnt>0?C.blue:C.muted,
                  display:'flex',flexDirection:'column',alignItems:'center',gap:5,
                  fontSize:12,fontWeight:cnt>0?700:400,transition:'all .15s',
                  position:'relative'}}>
                <span style={{fontSize:20}}>{m.e}</span>
                {m.l}
                {cnt>1&&<span style={{position:'absolute',top:6,right:8,
                  fontSize:10,fontWeight:800,padding:'1px 5px',borderRadius:8,
                  background:C.blue,color:'white'}}>{cnt}</span>}
              </button>
            )
          })}
        </div>

        {/* Detalle */}
        {pagos.map((p,pi)=>{
          const m=METODOS.find(x=>x.id===p.metodo)
          const mismoTipo=pagos.filter(x=>x.metodo===p.metodo).length>1
          return(
            <div key={p.uid||pi} style={{borderRadius:10,padding:'14px',marginBottom:10,
              background:C.sur2,border:`1px solid ${C.bord2}`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:18}}>{m?.e}</span>
                  <span style={{fontSize:13,fontWeight:700,color:C.text}}>{m?.l}</span>
                  {mismoTipo&&<span style={{fontSize:11,padding:'1px 7px',borderRadius:10,
                    background:C.blueD,color:C.blue,fontWeight:700}}>#{pi+1}</span>}
                </div>
                <button onClick={()=>del(p.uid)}
                  style={{padding:'5px 12px',borderRadius:8,cursor:'pointer',
                    border:`1px solid ${C.red}44`,background:C.redD,
                    color:C.red,fontSize:12,fontWeight:700,
                    display:'flex',alignItems:'center',gap:4}}>
                  🗑 Quitar
                </button>
              </div>
              <input type="number" step="0.01" value={p.monto}
                onChange={e=>upd(p.uid,'monto',parseFloat(e.target.value)||0)}
                style={{...FI,fontSize:20,fontWeight:800,textAlign:'right',
                  background:C.sur3,borderColor:C.blue}}/>

              {p.metodo==='TARJETA'&&<>
                {/* Botón pinpad */}
                <PinpadBtn monto={p.monto} onAprobado={(res)=>{
                  upd(p.uid,'num_tarjeta', res.tarjeta_ultimos4 ? `****${res.tarjeta_ultimos4}` : '')
                  upd(p.uid,'autorizacion', res.codigo_autorizacion)
                  upd(p.uid,'referencia', res.lote)
                }} C={C} />
                <div style={{marginTop:10}}>
                  <div style={{fontSize:10,color:C.muted,marginBottom:2,fontWeight:600}}>N° TARJETA (enmascarado)</div>
                  <input value={p.num_tarjeta||''} onChange={e=>upd(p.uid,'num_tarjeta',e.target.value)}
                    placeholder="4560XXXXXXXX6352" maxLength={19}
                    style={{...fi2,letterSpacing:'2px',fontFamily:'monospace',fontSize:14}}/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:8}}>
                  <div>
                    <div style={{fontSize:10,color:C.muted,marginBottom:2,fontWeight:600}}>N° AUTORIZACIÓN</div>
                    <input value={p.autorizacion||''} onChange={e=>upd(p.uid,'autorizacion',e.target.value)}
                      placeholder="N° autorización" style={fi2}/>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:C.muted,marginBottom:2,fontWeight:600}}>N° LOTE</div>
                    <input value={p.referencia||''} onChange={e=>upd(p.uid,'referencia',e.target.value)}
                      placeholder="N° lote" style={fi2}/>
                  </div>
                </div>
              </>}
              {p.metodo==='TRANSFERENCIA'&&<>
                <div style={{marginTop:10}}>
                  <div style={{fontSize:10,color:C.muted,marginBottom:2,fontWeight:600}}>BANCO ORIGEN (cliente)</div>
                  <input value={p.banco_origen||''} onChange={e=>upd(p.uid,'banco_origen',e.target.value)}
                    placeholder="Banco del cliente" list={"bo-"+p.uid} style={fi2}/>
                  <datalist id={"bo-"+p.uid}>{BANCOS.map((b,i)=><option key={i} value={b}/>)}</datalist>
                </div>
                <div style={{marginTop:8}}>
                  <div style={{fontSize:10,color:C.muted,marginBottom:2,fontWeight:600}}>CUENTA BANCARIA QUE RECIBE</div>
                  <select value={p.cuenta_bancaria_id||''}
                    onChange={e=>upd(p.uid,'cuenta_bancaria_id',parseInt(e.target.value)||null)}
                    style={{...fi2,borderColor:p.cuenta_bancaria_id?C.green:C.bord2,
                      background:p.cuenta_bancaria_id?C.greenD:C.sur2}}>
                    <option value="">-- Selecciona cuenta --</option>
                    {(cuentasBanc||[]).map(c=>(
                      <option key={c.id} value={c.id}>{c.banco} — {c.numero||c.nombre}</option>
                    ))}
                  </select>
                </div>
                <div style={{marginTop:8}}>
                  <div style={{fontSize:10,color:C.muted,marginBottom:2,fontWeight:600}}>N° COMPROBANTE</div>
                  <input value={p.referencia||''} onChange={e=>upd(p.uid,'referencia',e.target.value)}
                    placeholder="N° comprobante de transferencia" style={fi2}/>
                </div>
              </>}
              {p.metodo==='DEUNA'&&<>
                <div style={{marginTop:10}}>
                  <div style={{fontSize:10,color:C.muted,marginBottom:2,fontWeight:600}}>CUENTA BANCARIA QUE RECIBE</div>
                  <select value={p.cuenta_bancaria_id||''}
                    onChange={e=>upd(p.uid,'cuenta_bancaria_id',parseInt(e.target.value)||null)}
                    style={{...fi2,borderColor:p.cuenta_bancaria_id?C.green:C.bord2,
                      background:p.cuenta_bancaria_id?C.greenD:C.sur2}}>
                    <option value="">-- Selecciona cuenta --</option>
                    {(cuentasBanc||[]).map(c=>(
                      <option key={c.id} value={c.id}>{c.banco} — {c.numero||c.nombre}</option>
                    ))}
                  </select>
                </div>
                <div style={{marginTop:8}}>
                  <div style={{fontSize:10,color:C.muted,marginBottom:2,fontWeight:600}}>N° TRANSACCIÓN DEUNA</div>
                  <input value={p.referencia||''} onChange={e=>upd(p.uid,'referencia',e.target.value)}
                    placeholder="Código de transacción DeUna" style={fi2}/>
                </div>
              </>}
              {p.metodo==='CHEQUE'&&<>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:10}}>
                  <div>
                    <div style={{fontSize:10,color:C.muted,marginBottom:2,fontWeight:600}}>N° CHEQUE</div>
                    <input value={p.referencia||''} onChange={e=>upd(p.uid,'referencia',e.target.value)}
                      placeholder="N° cheque" style={fi2}/>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:C.muted,marginBottom:2,fontWeight:600}}>BANCO EMISOR</div>
                    <input value={p.banco_origen||''} onChange={e=>upd(p.uid,'banco_origen',e.target.value)}
                      placeholder="Banco del cheque" list={"bc-"+p.uid} style={fi2}/>
                    <datalist id={"bc-"+p.uid}>{BANCOS.map((b,i)=><option key={i} value={b}/>)}</datalist>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:C.muted,marginBottom:2,fontWeight:600}}>FECHA DEL CHEQUE</div>
                    <input type="date" value={p.fecha_cheque||''} onChange={e=>upd(p.uid,'fecha_cheque',e.target.value)}
                      style={fi2}/>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:C.muted,marginBottom:2,fontWeight:600}}>TITULAR DEL CHEQUE</div>
                    <input value={p.titular_cheque||''} onChange={e=>upd(p.uid,'titular_cheque',e.target.value)}
                      placeholder="Nombre del girador" style={fi2}/>
                  </div>
                </div>
              </>}
            </div>
          )
        })}

        {/* Resumen */}
        <div style={{display:'flex',justifyContent:'space-between',padding:'12px 16px',
          borderRadius:10,background:C.sur2,border:`1px solid ${C.bord2}`}}>
          <div>
            <div style={{fontSize:11,color:C.muted}}>Pagado</div>
            <div style={{fontSize:20,fontWeight:800,color:C.green}}>{fmt$(totalPagado)}</div>
          </div>
          {falta>0.005&&<div style={{textAlign:'right'}}>
            <div style={{fontSize:11,color:C.muted}}>Falta</div>
            <div style={{fontSize:20,fontWeight:800,color:C.red}}>{fmt$(falta)}</div>
          </div>}
          {vuelto>0.005&&<div style={{textAlign:'right'}}>
            <div style={{fontSize:11,color:C.muted}}>Vuelto</div>
            <div style={{fontSize:20,fontWeight:800,color:C.cyan}}>{fmt$(vuelto)}</div>
          </div>}
        </div>

        <div style={{display:'flex',gap:10,marginTop:18,justifyContent:'flex-end'}}>
          <button onClick={onCancelar} style={{padding:'10px 20px',borderRadius:10,
            border:`1px solid ${C.bord2}`,background:'transparent',color:C.muted,cursor:'pointer',fontSize:13}}>Cancelar</button>
          <button onClick={onConfirmar} disabled={!listo}
            style={{padding:'10px 28px',borderRadius:10,border:'none',fontSize:14,fontWeight:800,
              background:listo?C.green:C.sur3,color:listo?'white':C.hint,
              cursor:listo?'pointer':'not-allowed',
              boxShadow:listo?`0 4px 16px rgba(16,185,129,.4)`:'none'}}>
            ✓ Confirmar cobro
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  PÁGINA PRINCIPAL
// ════════════════════════════════════════════════════════════
export default function Facturas({ modo = 'factura' }){
  const esNotaVenta = modo === 'nota_venta'
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const user=JSON.parse(localStorage.getItem('nexus_user')||'{}')
  const [cliente,   setCliente]   =useState(null)
  const [vendedor,setVendedor]=useState(null)
  const [vendedores,setVendedores]=useState([])
  const [bodegas,   setBodegas]   =useState([])
  const [items,     setItems]     =useState([])
  const [descGlobal,setDescGlobal]=useState(0)
  const [obs,       setObs]       =useState('')
  const [pagos,     setPagos]     =useState([])
  const [modalCobro,setModalCobro]=useState(false)
  const [modalReimp,setModalReimp]=useState(false)
  const [saving,    setSaving]    =useState(false)
  const [msg,       setMsg]       =useState('')
  const [ultimaFact,setUltimaFact]=useState(null)
  const [proxNum,   setProxNum]   =useState('cargando...')
  const [cajaAbierta,   setCajaAbierta]   = useState(null)
  const [cuentasBanc,   setCuentasBanc]   = useState([])
  const [sucursalNombre, setSucursalNombre] = useState('')
  const [saldoFavorCli,  setSaldoFavorCli]  = useState(null)
  const [modalBorradores,setModalBorradores]   = useState(false)
  const [modalRecurrentes,setModalRecurrentes] = useState(false)
  const [modalCotizacion,setModalCotizacion]   = useState(false)
  const [clientePrecioTipo,setClientePrecioTipo] = useState(null)

  useEffect(()=>{
    Promise.all([
      api.get('/vendedores').catch(()=>({data:[]})),
      api.get('/bodegas', {params:{sucursal_id:user.sucursal_id||undefined}}).catch(()=>({data:[]})),
      api.get(esNotaVenta ? '/notas-venta/proximo-numero' : '/facturas-proximo-numero').catch(()=>({data:{numero: esNotaVenta ? 'NV-000001' : '001-001-000000001'}})),
      api.get('/config/sucursales').catch(()=>({data:[]})),
      api.get('/caja/verificar-abierta').catch(()=>({data:{abierta:false}})),
      api.get('/bancos/cuentas').catch(()=>({data:[]})),
    ]).then(([v,b,n,s,caja,ctas])=>{
      setCuentasBanc(ctas.data||[])
      const vends=v.data;setBodegas(b.data);setProxNum(n.data.numero)
      if(user.sucursal_id&&s.data.length>0){
        const suc=s.data.find(x=>x.id===parseInt(user.sucursal_id))
        if(suc) setSucursalNombre(suc.nombre)
      }
      setCajaAbierta(caja.data.abierta?caja.data.sesion:false)
      // Preseleccionar vendedor del usuario si tiene uno asignado
      if(user.vendedor_id){
        const vUser=vends.find(x=>x.id===parseInt(user.vendedor_id))
        if(vUser) setVendedor(vUser)
      }
    })
  },[])

  // ── Atajos de teclado ─────────────────────────────────────
  useEffect(() => {
    function handleKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        if (e.key === 'Escape') { e.target.blur(); return }
        return
      }
      switch(e.key) {
        case 'F2':
          e.preventDefault()
          const prodInput = document.querySelector('input[placeholder*="producto"]') ||
                           document.querySelector('input[placeholder*="código"]')
          if (prodInput) prodInput.focus()
          break
        case 'F4':
          e.preventDefault()
          limpiar()
          setTimeout(() => {
            const cliInput = document.querySelector('input[placeholder*="nombre, RUC"]') ||
                            document.querySelector('input[placeholder*="cliente"]')
            if (cliInput) cliInput.focus()
          }, 100)
          break
        case 'F8':
          e.preventDefault()
          if (cliente && items.length > 0 && !saving) emitir()
          break
        case 'F9':
          e.preventDefault()
          setModalReimp(true)
          break
        case 'Escape':
          e.preventDefault()
          if (modalCobro) setModalCobro(false)
          else if (modalReimp) setModalReimp(false)
          break
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

  // Load saldo a favor and price type when client changes
  useEffect(()=>{
    if(cliente&&cliente.id){
      api.get('/clientes/'+cliente.id+'/saldo-favor')
        .then(r=>setSaldoFavorCli(r.data))
        .catch(()=>setSaldoFavorCli(null))
      api.get('/facturas/precio-cliente/'+cliente.id)
        .then(r=>setClientePrecioTipo(r.data?.tipo_precio_id||null))
        .catch(()=>setClientePrecioTipo(null))
    } else {
      setSaldoFavorCli(null)
      setClientePrecioTipo(null)
    }
  },[cliente])

  // lin() = total con IVA por línea (precio ya viene CON IVA)
  const lin   = it => it.cant * it.precio * (1-(it.desc||0)/100)
  // Base sin IVA por línea
  const linBase = it => {
    const ivaPct = Number(it.iva||0)
    const totConIva = lin(it)
    return ivaPct>0 ? totConIva/(1+ivaPct/100) : totConIva
  }
  // Totales
  const sub0  = items.filter(i=>Number(i.iva||0)===0).reduce((a,i)=>a+lin(i),0)
  const sub15 = items.filter(i=>Number(i.iva||0)!==0).reduce((a,i)=>a+lin(i),0)
  const subt  = sub0+sub15
  const dMto  = subt*(Number(descGlobal)||0)/100
  const descF = 1-(Number(descGlobal)||0)/100
  const s0f   = sub0*descF
  const s15f  = sub15*descF
  // IVA = diferencia entre total con IVA y base sin IVA
  const base15f = items.filter(i=>Number(i.iva||0)!==0).reduce((a,i)=>a+linBase(i),0)*descF
  const iva   = s15f - base15f
  const total = s0f + s15f  // ya incluye IVA

  function agregarProducto(p){
    const bodPpal=bodegas.find(b=>b.es_principal)||bodegas[0]
    // Prioridad: 1) bodega principal de la sucursal  2) bodega con más stock  3) cualquiera
    const bodegas_prod = p.stock_bodegas||[]
    const bodPpalSuc = bodegas.find(b=>b.es_principal)  // principal de la sucursal del usuario
    const mejorBod   = bodegas_prod.length>0
      ? bodegas_prod.reduce((a,b)=>Number(b.cantidad||0)>Number(a.cantidad||0)?b:a)
      : null
    const bodId = bodPpalSuc?.id || mejorBod?.bodega_id || bodPpal?.id || null

    const ivaPct = Number(p.iva_porcentaje??IVA)
    // Precio de venta: si tiene oferta usar precio_oferta, si no calcular PVP con IVA
    const precioBase = Number(p.precio_venta||0)
    const precioPVP  = p.tiene_oferta
      ? Number(p.precio_oferta_pvp||p.precio_oferta||0)
      : parseFloat((precioBase*(1+ivaPct/100)).toFixed(2))

    const nuevoItem = {
      pid:p.id, codigo:p.codigo, desc_prod:p.descripcion,
      cant:1, precio:precioPVP, desc:0,
      iva: ivaPct, stock:Number(p.stock_total||0),
      stock_bodegas:bodegas_prod,
      bodega_id:bodId,
      aplica_series:p.aplica_series||false,
      series_ids:[],   // array de ids de series seleccionadas (una por unidad)
      series:[],
      series_loading:false,
      tiene_oferta:     p.tiene_oferta||false,
      precio_original:  Number(p.precio_original||0),
      precio_oferta_pvp:Number(p.precio_oferta_pvp||0),
    }
    // Siempre agregar nueva línea — el usuario elige la bodega después
    setItems(prev=>[...prev, nuevoItem])
    // Si aplica series, cargar las disponibles de esa bodega
    if(p.aplica_series && bodId){
      // Cargar series para la última línea agregada (por índice)
      api.get(`/productos/${p.id}/series-bodega`,{params:{bodega_id:bodId}})
        .then(r=>{
          setItems(prev=>{
            // Actualizar solo la última línea de este producto con esta bodega
            const lastIdx = [...prev].map((it,i)=>({it,i}))
              .filter(({it})=>it.pid===p.id&&it.bodega_id===bodId)
              .pop()?.i
            if(lastIdx==null) return prev
            return prev.map((it,i)=>i===lastIdx?{...it,series:r.data}:it)
          })
        }).catch(()=>{})
    }
  }

  const setIt=(idx,k,v)=>{
    setItems(prev=>prev.map((it,i)=>{
      if(i!==idx) return it
      const val=['cant','precio','desc'].includes(k)?parseFloat(v)||0:v
      const updated={...it,[k]:val}
      // Si cambia bodega y el producto aplica series - recargar series
      if(k==='bodega_id'&&it.aplica_series){
        const bid=parseInt(v)||null
        if(bid){
          api.get(`/productos/${it.pid}/series-bodega`,{params:{bodega_id:bid}})
            .then(r=>setItems(p2=>p2.map((x,j)=>
              j===idx?{...x,series:r.data,series_ids:[]}:x
            ))).catch(()=>{})
        }
        return {...updated,series:[],series_ids:[]}
      }
      return updated
    }))
  }

  async function emitir(){
    if(cajaAbierta===false) return setMsg('🔒 Debes abrir la caja antes de facturar')
    if(!cliente)         return setMsg('⚠️ Selecciona un cliente')
    if(!vendedor)        return setMsg('⚠️ Selecciona un vendedor')
    if(items.length===0) return setMsg('⚠️ Agrega al menos un producto')
    // Verificar series obligatorias
    const faltaSerie = items.find(it=>
      it.aplica_series && it.series && it.series.length>0 &&
      (it.series_ids||[]).filter(Boolean).length < Number(it.cant)
    )
    if(faltaSerie) return setMsg(
      `Selecciona ${Number(faltaSerie.cant)} serie(s) para: ${faltaSerie.desc_prod} (${(faltaSerie.series_ids||[]).filter(Boolean).length} de ${Number(faltaSerie.cant)} seleccionadas)`
    )
    setMsg('');setModalCobro(true)
  }

  async function enviarSRI(facId) {
    try {
      setMsg('📡 Enviando al SRI...')
      const { data } = await api.post(`/sri/factura/${facId}/procesar`)
      if (data.estado === 'AUTORIZADA') {
        setMsg(`✅ Factura AUTORIZADA por el SRI — Aut: ${data.numero_autorizacion||''}`)
      } else if (data.estado === 'RECIBIDA') {
        setMsg('⏳ Factura recibida por el SRI, pendiente de autorización')
      } else if (data.estado === 'ERROR_FIRMA') {
        setMsg('⚠️ Error de firma: '+data.msg+'. Configure el certificado .p12 en Configuración > Facturación Electrónica')
      } else {
        const msgs = (data.mensajes_sri||[]).map(m=>m.mensaje).join('; ')
        setMsg(`❌ ${data.estado}: ${msgs||data.msg||'Error al procesar'}`)
      }
    } catch(e) {
      setMsg('❌ Error SRI: '+(e.response?.data?.detail||e.message))
    }
  }

  async function descargarArchivo(url, nombre, tipo='application/pdf') {
    try {
      const r = await api.get(url, {responseType:'blob'})
      const blob = new Blob([r.data], {type})
      const link = document.createElement('a')
      link.href = window.URL.createObjectURL(blob)
      link.download = nombre
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(link.href)
    } catch(e) { setMsg('Error al descargar: '+e.message) }
  }

  function descargarRIDE(facId) {
    descargarArchivo(`/sri/factura/${facId}/ride`, `RIDE_${facId}.pdf`)
  }

  function descargarTicket(facId) {
    descargarArchivo(`/facturas/${facId}/ticket`, `Ticket_${facId}.txt`, 'text/plain')
  }

  function descargarXML(facId) {
    descargarArchivo(`/sri/factura/${facId}/xml`, `FAC_${facId}.xml`, 'application/xml')
  }

  async function enviarEmail(facId) {
    try {
      setMsg('📧 Enviando al cliente...')
      const { data } = await api.post(`/sri/factura/${facId}/enviar-email`)
      if (data.enviado) {
        setMsg(`✅ Factura enviada a ${data.email_destino}`)
      } else {
        setMsg(`❌ ${data.error}`)
      }
    } catch(e) {
      setMsg('❌ '+(e.response?.data?.detail||e.message))
    }
  }

  async function guardarBorrador(){
    if(!cliente)         return setMsg('Selecciona un cliente')
    if(!vendedor)        return setMsg('Selecciona un vendedor')
    if(items.length===0) return setMsg('Agrega al menos un producto')
    setSaving(true);setMsg('')
    try{
      const{data}=await api.post('/facturas/borrador',{
        cliente_id:cliente.id,vendedor_id:vendedor?.id||null,
        sucursal_id:user.sucursal_id||null,observaciones:obs,
        descuento_global_pct:Number(descGlobal)||0,
        detalles:items.map(it=>({
          producto_id:it.pid,descripcion:it.desc_prod,cantidad:it.cant,
          precio_unitario:it.precio,descuento_pct:it.desc||0,
          iva_porcentaje:it.iva,bodega_id:it.bodega_id||null
        })),
        pagos:[]
      })
      setMsg('Borrador guardado #'+data.id)
      limpiar()
    }catch(e){setMsg('Error: '+(e.response?.data?.detail||e.message))}
    finally{setSaving(false)}
  }

  async function duplicarFactura(facId){
    try{
      const{data}=await api.post(`/facturas/${facId}/duplicar`)
      setMsg('Factura duplicada como borrador #'+data.id)
    }catch(e){setMsg('Error: '+(e.response?.data?.detail||e.message))}
  }

  async function cargarBorrador(bId){
    try{
      const{data:f}=await api.get(`/facturas/${bId}/detalle`)
      // Set client
      const cli={id:f.cliente_id,razon_social:f.cliente_nombre,identificacion:f.cliente_ruc,
        tipo_identificacion:f.tipo_identificacion||'RUC',email:f.cliente_email}
      setCliente(cli)
      // Set vendor
      if(f.vendedor_id){
        setVendedor({id:f.vendedor_id,nombre:f.vendedor_nombre||''})
      }
      setDescGlobal(Number(f.descuento_global_pct||0))
      setObs(f.observaciones||'')
      // Set items from details
      const newItems=(f.detalles||[]).map(d=>({
        pid:d.producto_id,codigo:d.codigo||'',desc_prod:d.descripcion||'',
        cant:Number(d.cantidad),precio:Number(d.precio_unitario),
        desc:Number(d.descuento||0),iva:Number(d.iva_porcentaje||15),
        stock:999,stock_bodegas:[],bodega_id:null,
        aplica_series:false,series_ids:[],series:[],
        tiene_oferta:false,precio_original:0,precio_oferta_pvp:0
      }))
      setItems(newItems)
      setMsg('Borrador #'+bId+' cargado')
    }catch(e){setMsg('Error al cargar borrador: '+(e.response?.data?.detail||e.message))}
  }

  async function abrirImpresion(facId) {
    try {
      const {data:f} = await api.get(`/facturas/${facId}/detalle`)
      // Los datos de empresa vienen directamente en f (no en f.empresa)
      const empNombre = f.empresa_nombre || f.razon_social || 'MI EMPRESA S.A.'
      const empRuc    = f.empresa_ruc    || f.ruc          || ''
      const empDir    = f.empresa_dir    || f.direccion    || ''
      // Fecha — puede venir como string ISO o como timestamp
      let fecha = ''
      try {
        const raw = f.fecha_emision
        if(raw) {
          // Si tiene T o Z es ISO, si no agregar T12:00 para evitar offset
          const d = new Date(String(raw).includes('T') ? raw : raw+'T12:00:00')
          fecha = d.toLocaleDateString('es-EC',{day:'2-digit',month:'2-digit',year:'numeric'})
        }
      } catch {}
      const fmt = v => '$'+Number(v||0).toFixed(2)
      // Logo: viene como base64 en logo_base64
      const logoB64 = f.logo_base64
      const logo = logoB64 ? `<img src="${logoB64}" style="max-height:60px;max-width:100px;object-fit:contain"/>` : ''
      // DEBUG — ver qué series llegan
      console.log('DETALLES:', JSON.stringify(f.detalles?.map(d=>({desc:d.descripcion, series:d.series}))))
      const filas = (f.detalles||[]).map((d,i)=>{
        // Normalizar series — puede venir como array de strings o array de objetos
        const seriesArr = (d.series||[]).map(s=>
          typeof s === 'string' ? s : (s.serie || s.numero_serie || String(s))
        ).filter(Boolean)
        const seriesHtml = seriesArr.length>0
          ? `<div style="font-size:9px;color:#6b7280;margin-top:3px;line-height:1.6">
              <span style="font-weight:700;margin-right:4px">S/N:</span>
              ${seriesArr.map(s=>`<span style="background:#f3e8ff;color:#7c3aed;
                padding:1px 6px;border-radius:3px;margin-right:4px;font-family:monospace;font-size:9px">
                ${s}</span>`).join('')}
             </div>` : ''
        return `
        <tr style="background:${i%2===0?'#fff':'#f9fafb'}">
          <td class="td td-c" style="color:#7c3aed;font-weight:700">${d.codigo||''}</td>
          <td class="td">
            ${d.descripcion||''}
            ${seriesHtml}
          </td>
          <td class="td td-c">${Number(d.cantidad).toFixed(0)}</td>
          <td class="td td-r">${fmt(d.precio_unitario)}</td>
          <td class="td td-c">${Number(d.descuento||0)>0?Number(d.descuento).toFixed(0)+'%':'—'}</td>
          <td class="td td-r">${Number(d.iva_porcentaje||0)===0?fmt(d.subtotal):'—'}</td>
          <td class="td td-r">${Number(d.iva_porcentaje||0)>0?fmt(d.subtotal):'—'}</td>
          <td class="td td-r" style="color:#d97706">${Number(d.iva_valor||d.iva||0)>0?fmt(d.iva_valor||d.iva):'$0.00'}</td>
          <td class="td td-r"><b>${fmt(d.total)}</b></td>
        </tr>`
      }).join('')
      const pagosHtml = (f.pagos||[]).map(p=>`
        <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:11px">
          <span>${p.forma_pago}${p.banco_tarjeta?' · '+p.banco_tarjeta:''}${p.referencia?' ('+p.referencia+')':''}</span>
          <b>${fmt(p.monto)}</b>
        </div>`).join('')
      const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/>
        <title>Factura ${f.numero_factura}</title>
        <style>
          *{margin:0;padding:0;box-sizing:border-box}
          body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#000;background:#f3f4f6;padding:16px}
          .wrap{background:#fff;max-width:900px;margin:0 auto;border:1px solid #d1d5db;padding:16px}
          @page{size:A4;margin:10mm 14mm}
          @media print{body{background:#fff;padding:0}.no-print{display:none!important}.wrap{border:none;padding:0}}
          table{width:100%;border-collapse:collapse}
          .th{background:#1e293b;color:#fff;padding:6px 7px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
          .td{padding:5px 7px;border-bottom:1px solid #e5e7eb;vertical-align:middle;font-size:10px}
          .td-r{text-align:right}.td-c{text-align:center}
          .label{font-size:9px;font-weight:700;color:#6b7280;text-transform:uppercase}
        </style></head><body>
        <div class="no-print" style="max-width:900px;margin:0 auto 10px;display:flex;gap:8px">
          <button onclick="window.print()" style="padding:8px 20px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:700">🖨 Imprimir</button>
          <button onclick="window.close()" style="padding:8px 16px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px">✕ Cerrar</button>
        </div>
        <div class="wrap">
          <div style="display:grid;grid-template-columns:1fr 1px 220px;border:1.5px solid #1e293b;margin-bottom:10px">
            <div style="display:flex;gap:12px;align-items:center;padding:10px">
              ${logo}
              <div>
                <div style="font-size:14px;font-weight:800">${empNombre}</div>
                <div style="font-size:10px">RUC: ${empRuc}</div>
                <div style="font-size:10px">Dir: ${empDir}</div>
                <div style="font-size:10px">Sucursal: ${f.sucursal_nombre||''}</div>
              </div>
            </div>
            <div style="background:#1e293b"></div>
            <div style="padding:12px;text-align:center">
              <div style="font-size:9px;color:#6b7280;font-weight:700">FACTURA &nbsp; N°</div>
              <div style="font-size:15px;font-weight:800;color:#1d4ed8;margin:4px 0">${f.numero_factura}</div>
              <div style="font-size:9px;color:#6b7280;text-transform:uppercase">FECHA DE EMISIÓN</div>
              <div style="font-size:12px;font-weight:700">${fecha}</div>
            </div>
          </div>
          <div style="border:1.5px solid #1e293b;padding:8px 10px;margin-bottom:10px">
            <div style="display:grid;grid-template-columns:auto 1fr auto 1fr;gap:4px 12px;margin-bottom:4px">
              <span class="label">Cédula</span><span style="font-size:10px">${f.cliente_ruc||''}</span>
              <span class="label">Tipo</span><span style="font-size:10px">CEDULA</span>
            </div>
            <div style="font-size:13px;font-weight:700;margin-bottom:4px">CLIENTE &nbsp; ${f.cliente_nombre||''}</div>
            <div style="display:grid;grid-template-columns:auto 1fr auto 1fr;gap:3px 12px">
              <span class="label">Dirección</span><span style="font-size:10px">${f.cliente_direccion||''}</span>
              <span class="label">Vendedor</span><span style="font-size:10px">${f.vendedor_nombre||''}</span>
              <span class="label">Email</span><span style="font-size:10px">${f.cliente_email||''}</span>
            </div>
          </div>
          <table style="margin-bottom:10px">
            <thead><tr>
              <th class="th td-c">Código</th><th class="th">Descripción</th>
              <th class="th td-c">Cant.</th><th class="th td-r">P. Unit.</th>
              <th class="th td-c">Desc%</th><th class="th td-r">Sub 0%</th>
              <th class="th td-r">Sub 15%</th><th class="th td-r" style="color:#fbbf24">IVA</th>
              <th class="th td-r">Total</th>
            </tr></thead>
            <tbody>${filas}</tbody>
          </table>
          <div style="display:grid;grid-template-columns:1fr 260px;gap:12px">
            <div style="border:1.5px solid #1e293b;padding:8px">
              <div class="label" style="margin-bottom:6px">Forma de pago</div>
              ${pagosHtml}
            </div>
            <div style="border:1.5px solid #1e293b;padding:8px">
              <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:10px;border-bottom:1px solid #e5e7eb"><span>Subtotal 0%</span><span>${fmt(f.subtotal_0)}</span></div>
              <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:10px;border-bottom:1px solid #e5e7eb"><span>Subtotal 15%</span><span>${fmt(f.subtotal_iva)}</span></div>
              <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:10px;color:#d97706;border-bottom:1px solid #e5e7eb"><span><b>IVA 15%</b></span><span><b>${fmt(f.iva)}</b></span></div>
              <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;font-weight:800;border-top:2px solid #1e293b;margin-top:2px"><span>TOTAL</span><span>${fmt(f.total)}</span></div>
            </div>
          </div>
          <div style="margin-top:12px;text-align:center;font-size:9px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:8px">
            ${empNombre} · RUC ${empRuc} · ${empDir}<br/>
            ${f.numero_factura} - ${fecha}
          </div>
          ${f.clave_acceso ? `
          <div style="margin-top:10px;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px">
            <div style="font-size:8px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:6px;text-align:center;letter-spacing:.05em">
              NÚMERO DE AUTORIZACIÓN SRI
            </div>
            <!-- Código de barras Code128 generado con SVG puro -->
            <div style="text-align:center;margin-bottom:4px">
              <svg id="barcode-auth" xmlns="http://www.w3.org/2000/svg"></svg>
            </div>
            <div style="font-family:monospace;font-size:8px;color:#374151;text-align:center;letter-spacing:.04em;word-break:break-all;margin:4px 0">
              ${f.clave_acceso}
            </div>
            <div style="font-size:8px;color:#94a3b8;text-align:center;margin-top:2px">
              ${f.ambiente_sri==='2'?'AMBIENTE PRODUCCIÓN':'AMBIENTE PRUEBAS'} · TIPO: FACTURA · EMISIÓN NORMAL
            </div>
          </div>
          <script>
          (function(){
            // Code128B encoder puro sin dependencias
            var CODE128B_START=104,STOP=106,CODEB=[
              32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,
              48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,
              65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,
              82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,
              99,100,101,102,103,104,105,106,107
            ];
            // Patrones de barras Code128 (11 bits cada uno)
            var PAT=[
              '11011001100','11001101100','11001100110','10010011000','10010001100',
              '10001001100','10011001000','10011000100','10001100100','11001001000',
              '11001000100','11000100100','10110011100','10011011100','10011001110',
              '10111001100','10011101100','10011100110','11001110010','11001011100',
              '11001001110','11011100100','11001110100','11101101110','11101001100',
              '11100101100','11100100110','11101100100','11100110100','11100110010',
              '11011011000','11011000110','11000110110','10100011000','10001011000',
              '10001000110','10110001000','10001101000','10001100010','11010001000',
              '11000101000','11000100010','10110111000','10110001110','10001101110',
              '10111011000','10111000110','10001110110','11101110110','11010001110',
              '11000101110','11011101000','11011100010','11011101110','11101011000',
              '11101000110','11100010110','11101101000','11101100010','11100011010',
              '11101111010','11001000010','11110001010','10100110000','10100001100',
              '10010110000','10010000110','10000101100','10000100110','10110010000',
              '10110000100','10011010000','10011000010','10000110100','10000110010',
              '11000010010','11001010000','11110111010','11000010100','10001111010',
              '10100111100','10010111100','10010011110','10111100100','10011110100',
              '10011110010','11110100100','11110010100','11110010010','11011011110',
              '11011110110','11110110110','10101111000','10100011110','10001011110',
              '10111101000','10111100010','11110101000','11110100010','10111011110',
              '10111101110','11101011110','11110101110','11010000100','11010010000',
              '11010011100','1100011101011'
            ];
            var text='${f.clave_acceso}';
            var svg=document.getElementById('barcode-auth');
            // Codificar
            var vals=[CODE128B_START];
            var chk=CODE128B_START;
            for(var i=0;i<text.length;i++){
              var c=text.charCodeAt(i)-32;
              vals.push(c); chk+=c*(i+1);
            }
            vals.push(chk%103);
            vals.push(STOP);
            // Construir patrón de bits
            var bits='';
            for(var i=0;i<vals.length;i++) bits+=PAT[vals[i]]||'';
            bits+='11'; // terminador
            // Dibujar SVG
            var bw=1.2,bh=40,margin=10;
            var w=bits.length*bw+margin*2;
            svg.setAttribute('width',w);
            svg.setAttribute('height',bh+16);
            svg.setAttribute('viewBox','0 0 '+w+' '+(bh+16));
            var x=margin;
            for(var i=0;i<bits.length;i++){
              if(bits[i]==='1'){
                var rect=document.createElementNS('http://www.w3.org/2000/svg','rect');
                rect.setAttribute('x',x);
                rect.setAttribute('y',0);
                rect.setAttribute('width',bw);
                rect.setAttribute('height',bh);
                rect.setAttribute('fill','#000');
                svg.appendChild(rect);
              }
              x+=bw;
            }
          })();
          </script>` : ''}
        </div>
      </body></html>`
      const win = window.open('','_blank','width=960,height=800')
      if(!win){alert('Habilita las ventanas emergentes para imprimir');return}
      win.document.write(html)
      win.document.close()
      setTimeout(()=>win.print(), 600)
    } catch(e) {
      setMsg('❌ Error al imprimir: '+e.message)
    }
  }

    async function confirmarPago(){
    setSaving(true)
    try{
      const{data}=await api.post(esNotaVenta ? '/notas-venta' : '/facturas',{
        cliente_id:cliente.id,vendedor_id:vendedor?.id||null,
        sucursal_id:user.sucursal_id||null,observaciones:obs,
        descuento_global_pct:Number(descGlobal)||0,
        detalles:items.flatMap(it=>{
          if(it.aplica_series && (it.series_ids||[]).filter(Boolean).length>0) {
            return (it.series_ids||[]).filter(Boolean).map(sid=>({
              producto_id:it.pid, descripcion:it.desc_prod, cantidad:1,
              precio_unitario:it.precio, descuento_pct:it.desc||0,
              iva_porcentaje:it.iva, bodega_id:it.bodega_id||null,
              serie_id:sid
            }))
          }
          return [{producto_id:it.pid, descripcion:it.desc_prod, cantidad:it.cant,
            precio_unitario:it.precio, descuento_pct:it.desc||0,
            iva_porcentaje:it.iva, bodega_id:it.bodega_id||null,
            serie_id:null}]
        }),
        pagos:pagos.map(p=>({forma_pago:p.metodo,monto:p.monto,
          referencia:p.referencia||null,banco_tarjeta:p.num_tarjeta||p.banco_tarjeta||null,
          banco_origen:p.banco_origen||null,banco_destino:p.banco_destino||null,
          cuenta_bancaria_id:p.cuenta_bancaria_id||null})),
      })
      setModalCobro(false)
      setUltimaFact({id:data.id,numero:data.numero_factura||data.numero,total:data.total})
      if(!esNotaVenta && data.id) abrirImpresion(data.id)
      setCliente(null);setItems([]);setVendedor(null)
      setObs('');setDescGlobal(0);setPagos([])
      api.get(esNotaVenta ? '/notas-venta/proximo-numero' : '/facturas-proximo-numero').then(r=>setProxNum(r.data.numero)).catch(()=>{})
    }catch(e){setMsg('❌ '+(e.response?.data?.detail||e.message));setModalCobro(false)}
    finally{setSaving(false)}
  }

  const limpiar=()=>{setCliente(null);setItems([]);setObs('');setDescGlobal(0);setMsg('');setVendedor(null);setSaldoFavorCli(null);setClientePrecioTipo(null)}

  const TH=(a='left')=>({padding:'10px 12px',fontSize:10,fontWeight:700,color:C.hint,
    textAlign:a,background:C.sur3,borderBottom:`1px solid ${C.bord2}`,
    textTransform:'uppercase',letterSpacing:'.05em',whiteSpace:'nowrap'})
  const TD=(a='left')=>({padding:'9px 10px',fontSize:13,borderBottom:`1px solid ${C.border}`,
    verticalAlign:'middle',color:C.text,textAlign:a})

  return(
    <div style={{fontFamily:"'Inter','Segoe UI',system-ui,sans-serif",
      background:C.bg,minHeight:'100vh',display:'flex',flexDirection:'column',color:C.text}}>

      {/* ── TOPBAR ── */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.bord2}`,
        padding:'0 20px',height:56,display:'flex',alignItems:'center',
        justifyContent:'space-between',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:20}}>🧾</span>
            <span style={{fontSize:14,fontWeight:800,color:C.text}}>{esNotaVenta ? 'Nueva nota de venta' : 'Nueva factura'}</span>
          </div>
          {/* Sucursal y Bodega activa */}
          {sucursalNombre&&(
            <div style={{display:'flex',alignItems:'center',gap:6,
              padding:'4px 12px',borderRadius:8,
              background:'rgba(16,185,129,.12)',border:`1px solid rgba(16,185,129,.25)`}}>
              <span style={{fontSize:11,color:C.green}}>🏢</span>
              <span style={{fontSize:12,fontWeight:600,color:C.green}}>{sucursalNombre}</span>
              {bodegas.find(b=>b.es_principal)&&(
                <>
                  <span style={{color:C.bord2,fontSize:11}}>|</span>
                  <span style={{fontSize:11,color:C.cyan}}>📦</span>
                  <span style={{fontSize:11,fontWeight:600,color:C.cyan}}>
                    {bodegas.find(b=>b.es_principal)?.nombre}
                  </span>
                </>
              )}
            </div>
          )}
          {/* Número de factura */}
          <div style={{display:'flex',alignItems:'center',gap:8,
            padding:'5px 14px',borderRadius:8,
            background:'rgba(139,92,246,.15)',border:`1px solid rgba(139,92,246,.3)`}}>
            <span style={{fontSize:10,color:C.purple,fontWeight:700,textTransform:'uppercase'}}>N°</span>
            <code style={{fontSize:14,fontWeight:800,color:C.purple}}>{proxNum}</code>
          </div>
          <span style={{fontSize:12,color:C.hint}}>
            {new Date().toLocaleDateString('es-EC',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
          </span>
          {ultimaFact&&(
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',borderRadius:8,
              background:C.greenD,border:`1px solid rgba(16,185,129,.3)`}}>
              <span>✅</span>
              <span style={{fontSize:12,fontWeight:700,color:C.green}}>
                {ultimaFact.numero} — {fmt$(ultimaFact.total)}
              </span>
              <button
                onClick={()=>abrirImpresion(ultimaFact.id)}
                style={{marginLeft:6,padding:'3px 10px',borderRadius:6,cursor:'pointer',
                  border:'none',background:C.green,color:'white',
                  fontSize:11,fontWeight:700}}>
                🖨 Imprimir
              </button>
              <button onClick={()=>enviarSRI(ultimaFact.id)}
                style={{padding:'3px 10px',borderRadius:6,cursor:'pointer',
                  border:`1px solid ${C.purple}55`,background:C.purpleD,
                  color:C.purple,fontSize:11,fontWeight:700}}>
                📡 SRI
              </button>
              <button onClick={()=>descargarRIDE(ultimaFact.id)}
                style={{padding:'3px 10px',borderRadius:6,cursor:'pointer',
                  border:`1px solid ${C.blue}55`,background:'rgba(59,130,246,.12)',
                  color:C.blue,fontSize:11,fontWeight:700}}>
                PDF
              </button>
              <button onClick={()=>enviarEmail(ultimaFact.id)}
                style={{padding:'3px 10px',borderRadius:6,cursor:'pointer',
                  border:`1px solid ${C.green}55`,background:C.greenD,
                  color:C.green,fontSize:11,fontWeight:700}}>
                📧 Email
              </button>
              <button onClick={()=>descargarTicket(ultimaFact.id)}
                style={{padding:'3px 10px',borderRadius:6,cursor:'pointer',
                  border:`1px solid ${C.amber}55`,background:C.amberD,
                  color:C.amber,fontSize:11,fontWeight:700}}>
                🧾 Ticket
              </button>
            </div>
          )}
        </div>
        <div style={{display:'flex',gap:8}}>
          {!esNotaVenta && <button onClick={()=>setModalCotizacion(true)}
            style={{padding:'8px 14px',borderRadius:8,border:`1px solid ${C.purple}44`,
              background:'rgba(139,92,246,.12)',color:C.purple,cursor:'pointer',fontSize:12,
              display:'flex',alignItems:'center',gap:6,fontWeight:600}}>
            📋 Desde cotización
          </button>}
          {!esNotaVenta && <button onClick={()=>setModalBorradores(true)}
            style={{padding:'8px 14px',borderRadius:8,border:`1px solid ${C.amber}44`,
              background:C.amberD,color:C.amber,cursor:'pointer',fontSize:12,
              display:'flex',alignItems:'center',gap:6,fontWeight:600}}>
            Borradores
          </button>}
          <button onClick={()=>setModalReimp(true)}
            style={{padding:'8px 14px',borderRadius:8,border:`1px solid ${C.bord2}`,
              background:C.sur2,color:C.muted,cursor:'pointer',fontSize:12,
              display:'flex',alignItems:'center',gap:6,fontWeight:600}}>
            Reimprimir
          </button>
          {(items.length>0||cliente)&&(
            <button onClick={limpiar}
              style={{padding:'8px 14px',borderRadius:8,
                border:`1px solid rgba(239,68,68,.3)`,
                background:C.redD,color:C.red,cursor:'pointer',fontSize:12,fontWeight:600}}>
              Limpiar
            </button>
          )}
          {!esNotaVenta && <button onClick={guardarBorrador} disabled={saving||!cliente||items.length===0}
            style={{padding:'8px 16px',borderRadius:8,border:'none',fontSize:13,fontWeight:700,
              background:(saving||!cliente||items.length===0)?C.sur3:C.amber,
              color:(saving||!cliente||items.length===0)?C.hint:'white',
              cursor:(saving||!cliente||items.length===0)?'not-allowed':'pointer'}}>
            {saving?'Guardando...':'Borrador'}
          </button>}
        </div>
      </div>

      {/* ── CABECERA ── */}
      <div style={{padding:'12px 16px 0',flexShrink:0}}>
        <div style={{background:C.surface,borderRadius:12,padding:'14px 16px',
          border:`1px solid ${C.bord2}`}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:14,alignItems:'end'}}>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:C.hint,marginBottom:6,
                textTransform:'uppercase',letterSpacing:'.06em'}}>Cliente</div>
              <SelectorCliente value={cliente} onChange={setCliente} onVendedor={vid=>{ const vObj=vendedores.find(x=>x.id===parseInt(vid)); if(vObj) setVendedor(vObj) }}/>
            </div>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:C.hint,marginBottom:6,
                textTransform:'uppercase',letterSpacing:'.06em'}}>Vendedor</div>
              <BuscadorVendedor value={vendedor} onChange={setVendedor}/>
            </div>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:C.hint,marginBottom:6,
                textTransform:'uppercase',letterSpacing:'.06em'}}>Desc. Global %</div>
              <input type="number" min="0" max="100" step="0.5" value={descGlobal}
                onChange={e=>setDescGlobal(e.target.value)}
                style={{...FI,width:90,textAlign:'center',fontWeight:800,fontSize:16}}/>
            </div>
          </div>
        </div>
      </div>

      {/* Price type indicator */}
      {clientePrecioTipo&&clientePrecioTipo>1&&(
        <div style={{margin:'0 16px',marginTop:4,padding:'6px 16px',borderRadius:10,
          background:'rgba(139,92,246,.12)',border:'1px solid rgba(139,92,246,.25)',
          display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:12,fontWeight:600,color:C.purple}}>
            Tipo de precio del cliente: #{clientePrecioTipo} (aplicado automaticamente al buscar productos)
          </span>
        </div>
      )}

      {/* Saldo a favor banner */}
      {saldoFavorCli&&saldoFavorCli.total_saldo>0&&(
        <div style={{margin:'0 16px',padding:'10px 16px',borderRadius:10,
          background:'rgba(16,185,129,.15)',border:'1px solid rgba(16,185,129,.35)',
          display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:18}}>&#128176;</span>
          <span style={{fontSize:13,fontWeight:600,color:C.green}}>
            Este cliente tiene {fmt$(saldoFavorCli.total_saldo)} de saldo a favor (anticipos). Se aplicara al cobrar.
          </span>
        </div>
      )}

      {/* ── CUERPO ── */}
      <div className="factura-body" style={{flex:1,display:'grid',gridTemplateColumns:'1fr 280px',gap:12,padding:12,minHeight:0}}>

        {/* Tabla */}
        <div style={{background:C.surface,borderRadius:12,border:`1px solid ${C.bord2}`,
          display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{padding:'10px 12px',borderBottom:`1px solid ${C.bord2}`,
            background:C.sur2,display:'flex',gap:8,position:'relative',zIndex:10}}>
            <BuscadorProducto onAgregar={agregarProducto} tipoPrecioId={clientePrecioTipo}/>
          </div>
          <div style={{flex:1,overflowY:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',tableLayout:'fixed'}}>
              <colgroup>
                <col style={{width:'18%'}}/><col style={{width:'10%'}}/>
                <col style={{width:'8%'}}/><col style={{width:'8%'}}/><col style={{width:'9%'}}/>
                <col style={{width:'6%'}}/><col style={{width:'8%'}}/><col style={{width:'8%'}}/>
                <col style={{width:'8%'}}/><col style={{width:'5%'}}/>
              </colgroup>
              <thead style={{position:'sticky',top:0,zIndex:2}}>
                <tr>
                  <th style={TH()}>Descripción</th>
                  <th style={TH('center')}>Bodega</th>
                  <th style={TH('center')}>Stock</th>
                  <th style={TH('center')}>Cant.</th>
                  <th style={TH('right')}>Precio</th>
                  <th style={TH('center')}>Desc%</th>
                  <th style={TH('right')}>Base</th>
                  <th style={TH('right')}>IVA</th>
                  <th style={TH('right')}>Total</th>
                  <th style={TH('center')}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it,idx)=>{
                  const tot=lin(it)
                  const stockBodega = it.stock_bodegas&&it.bodega_id
                    ? Number(it.stock_bodegas.find(b=>b.bodega_id===it.bodega_id)?.cantidad||0)
                    : it.stock
                  const bajo=stockBodega < it.cant
                  return(
                    <tr key={idx} style={{background:idx%2===0?'transparent':C.sur2}}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(59,130,246,.06)'}
                      onMouseLeave={e=>e.currentTarget.style.background=idx%2===0?'transparent':C.sur2}>
                      <td style={{...TD(),overflow:'hidden'}}>
                        <div style={{display:'flex',alignItems:'baseline',gap:5}}>
                          <code style={{fontSize:10,color:C.purple,fontWeight:700,flexShrink:0}}>{it.codigo}</code>
                          <span style={{fontSize:12,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{it.desc_prod}</span>
                        </div>
                        {it.aplica_series&&(
                          <div style={{marginTop:4}}>
                            {it.series&&it.series.length>0?(
                              Array.from({length:Math.max(1,Number(it.cant)||1)},(_,i)=>{
                                const sid  = (it.series_ids||[])[i]||''
                                const sel  = sid ? it.series.find(s=>s.id===parseInt(sid)) : null
                                const usadas = (it.series_ids||[]).filter((_,j)=>j!==i).map(Number)
                                return(
                                  <div key={i} style={{marginBottom:4}}>
                                    <div style={{display:'flex',alignItems:'center',gap:3}}>
                                      <span style={{fontSize:9,color:C.hint,width:12,flexShrink:0,textAlign:'right'}}>{i+1}.</span>
                                      <select value={sid}
                                        onChange={e=>{
                                          const ids=[...(it.series_ids||[])]
                                          ids[i]=parseInt(e.target.value)||null
                                          setIt(idx,'series_ids',ids)
                                        }}
                                        onClick={e=>e.stopPropagation()}
                                        style={{flex:1,fontSize:10,padding:'2px 5px',borderRadius:6,
                                          border:`1px solid ${sid?C.green:C.amber}`,
                                          background:sid?C.greenD:C.amberD,
                                          color:sid?C.green:C.amber,
                                          outline:'none',cursor:'pointer'}}>
                                        <option value="">-- Serie {i+1} --</option>
                                        {it.series.filter(s=>s.estado==='EXHIBICION'&&!usadas.includes(s.id)).length>0&&(
                                          <optgroup label="En percha">
                                            {it.series.filter(s=>s.estado==='EXHIBICION'&&!usadas.includes(s.id)).map(s=>(
                                              <option key={s.id} value={s.id}>{s.serie} (percha)</option>
                                            ))}
                                          </optgroup>
                                        )}
                                        {it.series.filter(s=>s.estado==='DISPONIBLE'&&!usadas.includes(s.id)).length>0&&(
                                          <optgroup label="Disponibles">
                                            {it.series.filter(s=>s.estado==='DISPONIBLE'&&!usadas.includes(s.id)).map(s=>(
                                              <option key={s.id} value={s.id}>{s.serie}</option>
                                            ))}
                                          </optgroup>
                                        )}
                                      </select>
                                    </div>
                                    {sel&&(
                                      <div style={{display:'flex',gap:4,paddingLeft:16,marginTop:2}}>
                                        <span style={{fontSize:9,padding:'1px 6px',borderRadius:5,fontWeight:700,
                                          background:sel.estado==='EXHIBICION'?'rgba(139,92,246,.2)':C.greenD,
                                          color:sel.estado==='EXHIBICION'?C.purple:C.green}}>
                                          {sel.estado==='EXHIBICION'?'Percha':'Disponible'}
                                        </span>
                                        <code style={{fontSize:9,color:C.hint}}>{sel.serie}</code>
                                      </div>
                                    )}
                                  </div>
                                )
                              })
                            ):(
                              <span style={{fontSize:10,color:C.red,fontWeight:600}}>Sin series en esta bodega</span>
                            )}
                            {Number(it.cant)>1&&it.series&&it.series.length>0&&(
                              <div style={{fontSize:9,color:(it.series_ids||[]).filter(Boolean).length>=Number(it.cant)?C.green:C.amber,marginTop:2}}>
                                {(it.series_ids||[]).filter(Boolean).length}/{Number(it.cant)} seleccionadas
                              </div>
                            )}
                          </div>
                        )}
                        {bajo&&<div style={{fontSize:10,color:C.red}}>⚠ Stock insuficiente</div>}
                      </td>
                      <td style={{...TD('center'),padding:'6px 6px'}}>
                        <select value={it.bodega_id||''} onChange={e=>setIt(idx,'bodega_id',parseInt(e.target.value)||null)}
                          style={{...FI,padding:'3px 4px',fontSize:10,
                            background:it.bodega_id?C.sur2:C.amberD,
                            border:`1px solid ${it.bodega_id?C.bord2:C.amber}`}}>
                          <option value="">— Bodega —</option>
                          {/* Usar stock_bodegas del producto (más confiable que el array global) */}
                          {(it.stock_bodegas&&it.stock_bodegas.length>0
                            ? it.stock_bodegas
                            : bodegas.map(b=>({bodega_id:b.id,bodega:b.nombre,cantidad:0}))
                          ).map(b=>{
                            const stk = Number(b.cantidad||0)
                            return(
                              <option key={b.bodega_id} value={b.bodega_id}>
                                {b.bodega}{stk>0?` (${stk} u.)`:''}
                              </option>
                            )
                          })}
                        </select>
                      </td>
                      <td style={TD('center')}>
                        <span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,
                            background:stockBodega>5?C.greenD:stockBodega>0?C.amberD:C.redD,
                            color:stockBodega>5?C.green:stockBodega>0?C.amber:C.red}}>
                            {stockBodega}
                          </span>
                      </td>
                      <td style={{...TD('center'),padding:'6px 6px'}}>
                        <input type="number" min="1" value={it.cant}
                          onChange={e=>{
                            const v=Number(e.target.value)
                            if(v>stockBodega&&stockBodega>0)
                              return setMsg(`⚠️ Stock insuficiente: solo ${stockBodega} u. en esta bodega`)
                            setMsg('')
                            setIt(idx,'cant',v)
                          }}
                          style={{...FI,width:'100%',textAlign:'center',padding:'4px 2px',fontSize:11,
                            background:bajo?C.redD:C.sur2,border:`1px solid ${bajo?C.red:C.bord2}`}}/>
                      </td>
                      {/* Precio: solo lectura */}
                      <td style={{...TD('right'),fontWeight:700,
                        color:it.tiene_oferta?C.amber:C.blue,fontSize:13}}>
                        {it.tiene_oferta&&it.precio_original>0&&(
                          <div style={{fontSize:9,color:C.hint,textDecoration:'line-through',
                            textAlign:'right'}}>
                            {fmt$(it.precio_original)}
                          </div>
                        )}
                        {fmt$(it.precio)}
                        {it.tiene_oferta&&(
                          <div style={{fontSize:8,color:C.amber,fontWeight:700,textAlign:'right'}}>
                            🏷 OFERTA
                          </div>
                        )}
                      </td>
                      <td style={{...TD('center'),padding:'6px 6px'}}>
                        <input type="number" min="0" max="100" value={it.desc||0}
                          onChange={e=>setIt(idx,'desc',e.target.value)}
                          style={{...FI,width:'100%',textAlign:'center',padding:'4px 2px',fontSize:11}}/>
                      </td>
                      {/* Subtotal sin IVA e IVA por línea */}
                      {(()=>{
                        const ivaPct  = Number(it.iva||0)
                        const totConIva = tot
                        const base    = ivaPct>0 ? totConIva/(1+ivaPct/100) : totConIva
                        const ivaVal  = totConIva - base
                        return(<>
                          <td style={{...TD('right'),fontSize:11,color:C.muted}}>
                            {fmt$(base)}
                          </td>
                          <td style={{...TD('right'),fontSize:11,
                            color:ivaPct>0?C.amber:C.hint}}>
                            {ivaPct>0 ? fmt$(ivaVal) : '—'}
                          </td>
                        </>)
                      })()}
                      <td style={{...TD('right'),fontWeight:800,color:C.text,fontSize:13}}>{fmt$(tot)}</td>
                      <td style={{...TD('center'),padding:'4px 6px'}}>
                        <button onClick={()=>setItems(p=>p.filter((_,i)=>i!==idx))}
                          title="Quitar producto"
                          style={{background:'rgba(239,68,68,.12)',border:'1px solid rgba(239,68,68,.3)',
                            cursor:'pointer',color:C.red,
                            fontSize:14,lineHeight:1,padding:'4px 8px',borderRadius:6,
                            fontWeight:700}}
                          onMouseEnter={e=>e.currentTarget.style.background='rgba(239,68,68,.3)'}
                          onMouseLeave={e=>e.currentTarget.style.background='rgba(239,68,68,.12)'}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {items.length===0&&(
                  <tr><td colSpan={10} style={{textAlign:'center',padding:'48px 0',color:C.hint,fontSize:13}}>
                    Busca un producto para agregarlo a la factura
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Observaciones */}
          <div style={{padding:'10px 12px',borderTop:`1px solid ${C.bord2}`,background:C.sur2,
            display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:10,fontWeight:700,color:C.hint,whiteSpace:'nowrap',textTransform:'uppercase'}}>Obs.</span>
            <input value={obs} onChange={e=>setObs(e.target.value)}
              placeholder="Notas adicionales para la factura..."
              style={{...FI,flex:1,padding:'6px 10px'}}/>
          </div>
        </div>

        {/* Panel totales */}
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div style={{background:C.surface,borderRadius:12,border:`1px solid ${C.bord2}`,padding:16,flex:1}}>
            <div style={{fontSize:10,fontWeight:700,color:C.hint,textTransform:'uppercase',
              letterSpacing:'.06em',marginBottom:14}}>Resumen</div>

            {[
              {l:'Subtotal bruto', v:subt, c:C.text},
              dMto>0&&{l:`Desc. ${descGlobal}%`, v:-dMto, c:C.red},
              {l:'Subtotal 0%',   v:s0f,  c:C.muted,sm:true},
              {l:'Subtotal 15%',  v:s15f, c:C.muted,sm:true},
              {l:'IVA 15%',       v:iva,  c:C.amber},
            ].filter(Boolean).map((r,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',
                padding:'6px 0',borderBottom:`1px solid ${C.border}`,fontSize:r.sm?11:12}}>
                <span style={{color:r.c}}>{r.l}</span>
                <span style={{fontWeight:600,color:r.c}}>{r.v<0?'-'+fmt$(Math.abs(r.v)):fmt$(r.v)}</span>
              </div>
            ))}

            {/* Total grande */}
            <div style={{marginTop:12,padding:'14px 16px',borderRadius:10,
              background:'linear-gradient(135deg,#1e3a5f,#0f2540)',
              border:`1px solid rgba(59,130,246,.3)`,
              display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:11,color:'#93C5FD',fontWeight:700,textTransform:'uppercase'}}>Total</span>
              <span style={{fontSize:22,fontWeight:900,color:'white'}}>{fmt$(total)}</span>
            </div>

            <div style={{fontSize:11,color:C.hint,textAlign:'center',marginTop:8}}>
              {items.length} ítem{items.length!==1?'s':''} · {items.reduce((a,i)=>a+i.cant,0)} unidades
            </div>

            {msg&&<div style={{marginTop:10,padding:'8px 12px',borderRadius:8,fontSize:12,
              background:C.redD,color:'#FCA5A5',border:`1px solid rgba(239,68,68,.3)`}}>{msg}</div>}
          </div>

          {/* Botón cobrar */}
          <button onClick={emitir} disabled={saving||!cliente||items.length===0}
            style={{padding:'16px',borderRadius:12,border:'none',fontSize:15,fontWeight:800,
              cursor:(saving||!cliente||items.length===0)?'not-allowed':'pointer',
              background:(saving||!cliente||items.length===0)?C.sur3:C.green,
              color:(saving||!cliente||items.length===0)?C.hint:'white',
              boxShadow:(saving||!cliente||items.length===0)?'none':'0 4px 20px rgba(16,185,129,.45)',
              transition:'all .2s'}}>
            {saving?'⏳ Emitiendo...':items.length===0?'Agrega productos':'💰 Cobrar '+fmt$(total)}
          </button>
        </div>
      </div>

      {modalCobro&&<ModalCobro total={total} pagos={pagos} setPagos={setPagos}
        cuentasBanc={cuentasBanc}
        onConfirmar={confirmarPago} onCancelar={()=>setModalCobro(false)}/>}
      {modalReimp&&<ModalReimprimir onCerrar={()=>setModalReimp(false)}
        onImprimir={abrirImpresion} onSRI={enviarSRI} onRIDE={descargarRIDE}
        onXML={descargarXML} onEmail={enviarEmail} onTicket={descargarTicket}
        onDuplicar={id=>{duplicarFactura(id);setModalReimp(false)}} esNotaVenta={esNotaVenta}/>}
      {modalCotizacion&&<ModalCargarCotizacion
        C={C}
        onCerrar={()=>setModalCotizacion(false)}
        onCargar={cot=>{
          setModalCotizacion(false)
          // Cargar cliente y productos de la cotización
          if(cot.cliente_id) setCliente({id:cot.cliente_id,razon_social:cot.cliente_nombre,identificacion:cot.cliente_ruc,email:cot.cliente_email||''})
          if(cot.detalles?.length) setItems(cot.detalles.map((d,i)=>({
            uid:Date.now()+i, producto_id:d.producto_id, descripcion:d.descripcion,
            codigo:d.codigo||'', cantidad:d.cantidad, precio:d.precio_unitario,
            iva:d.iva_pct||15, descuento:d.descuento_pct||0,
            subtotal_0:0, subtotal_iva:0, total_iva:0, total:d.total||0,
            bodega_id:'', lotes:[]
          })))
          setObs(cot.observaciones||'')
          setMsg(`✅ Cotización ${cot.numero} cargada`)
        }}
      />}
      {modalBorradores&&<ModalBorradores onCerrar={()=>setModalBorradores(false)}
        onCargar={cargarBorrador}
        onEmitir={data=>{setUltimaFact({id:data.id,numero:data.numero_factura,total:0});
          api.get('/facturas-proximo-numero').then(r=>setProxNum(r.data.numero)).catch(()=>{})}}/>}
      {modalRecurrentes&&<ModalRecurrentes onCerrar={()=>setModalRecurrentes(false)}/>}

    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  COMPONENTE PINPAD — Cobro con terminal físico
// ══════════════════════════════════════════════════════════════
function PinpadBtn({ monto, onAprobado, C }) {
  const [abierto, setAbierto] = useState(false)
  const [terminales, setTerminales] = useState([])
  const [terminalId, setTerminalId] = useState('')
  const [diferidoTipo, setDiferidoTipo] = useState('')
  const [diferidoCuotas, setDiferidoCuotas] = useState(0)
  const [estado, setEstado] = useState('IDLE') // IDLE | ENVIANDO | ESPERANDO | APROBADO | RECHAZADO | ERROR
  const [mensaje, setMensaje] = useState('')
  const [transId, setTransId] = useState(null)
  const pollingRef = useRef(null)

  useEffect(() => {
    if (abierto && terminales.length === 0) {
      api.get('/pos/terminales').then(r => {
        const activos = (r.data || []).filter(t => t.activo)
        setTerminales(activos)
        if (activos.length === 1) setTerminalId(activos[0].id)
      }).catch(() => {})
    }
  }, [abierto])

  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current) }, [])

  const iniciar = async () => {
    if (!terminalId) return alert('Selecciona un terminal')
    setEstado('ENVIANDO')
    try {
      const r = await api.post('/pos/cobro', {
        terminal_id: parseInt(terminalId),
        monto: parseFloat(monto),
        diferido_tipo: diferidoTipo || null,
        diferido_cuotas: parseInt(diferidoCuotas) || 0,
      })
      setTransId(r.data.id)
      setEstado('ESPERANDO')
      setMensaje('Esperando que el cliente pague en el terminal...')
      // Polling cada 2 segundos para ver el resultado
      pollingRef.current = setInterval(async () => {
        try {
          const res = await api.get(`/pos/cobro/${r.data.id}/estado`)
          const t = res.data
          if (t.estado === 'APROBADO') {
            clearInterval(pollingRef.current)
            setEstado('APROBADO')
            setMensaje(`✅ Aprobado — Auth: ${t.codigo_autorizacion || '—'} · Tarjeta: ****${t.tarjeta_ultimos4 || '----'}`)
            onAprobado(t)
          } else if (t.estado === 'RECHAZADO' || t.estado === 'ERROR') {
            clearInterval(pollingRef.current)
            setEstado('RECHAZADO')
            setMensaje(`❌ ${t.mensaje_respuesta || 'Transacción rechazada'}`)
          } else if (t.estado === 'CANCELADA') {
            clearInterval(pollingRef.current)
            setEstado('IDLE')
          }
        } catch {}
      }, 2000)
    } catch(e) {
      setEstado('ERROR')
      setMensaje(e.response?.data?.detail || 'Error al conectar con el terminal')
    }
  }

  const cancelar = async () => {
    if (pollingRef.current) clearInterval(pollingRef.current)
    if (transId) { try { await api.post(`/pos/cobro/${transId}/cancelar`) } catch {} }
    setEstado('IDLE'); setTransId(null); setMensaje('')
  }

  const cerrar = () => {
    cancelar()
    setAbierto(false)
    setEstado('IDLE')
    setMensaje('')
    setDiferidoTipo('')
    setDiferidoCuotas(0)
  }

  const CUOTAS_OPCIONES = [3, 6, 9, 12, 18, 24]

  return (
    <>
      <button onClick={() => setAbierto(true)}
        style={{width:'100%',marginTop:8,padding:'10px',borderRadius:8,border:'none',
          background:'linear-gradient(135deg,#1D4ED8,#7C3AED)',
          color:'white',fontWeight:700,fontSize:13,cursor:'pointer',
          display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
        💳 Cobrar con Pinpad / Terminal
      </button>

      {abierto && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}>
          <div style={{background:C.surface,borderRadius:16,padding:28,width:420,
            border:`1px solid ${C.border}`,boxShadow:'0 30px 80px rgba(0,0,0,.6)'}}>

            {/* Header */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <div>
                <div style={{fontWeight:800,fontSize:16,color:C.text}}>💳 Cobro con Terminal</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>
                  Monto: <strong style={{color:C.green}}>${parseFloat(monto).toFixed(2)}</strong>
                </div>
              </div>
              <button onClick={cerrar}
                style={{background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:22}}>×</button>
            </div>

            {estado === 'IDLE' && (
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                {/* Seleccionar terminal */}
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:C.muted,display:'block',marginBottom:4}}>
                    TERMINAL
                  </label>
                  {terminales.length === 0
                    ? <div style={{padding:'10px 14px',borderRadius:8,background:'rgba(245,158,11,.1)',
                        border:'1px solid rgba(245,158,11,.3)',fontSize:12,color:'#F59E0B'}}>
                        ⚠️ No hay terminales configurados. Ve a Configuración → Terminales POS.
                      </div>
                    : <select value={terminalId} onChange={e=>setTerminalId(e.target.value)}
                        style={{width:'100%',padding:'9px 12px',borderRadius:8,fontSize:13,
                          background:C.sur2,border:`1px solid ${C.border}`,color:C.text,outline:'none'}}>
                        <option value="">— Seleccionar terminal —</option>
                        {terminales.map(t=>(
                          <option key={t.id} value={t.id}>
                            {t.nombre} ({t.procesador}) {t.agente_activo ? '🟢' : '🔴'}
                          </option>
                        ))}
                      </select>
                  }
                </div>

                {/* Diferido */}
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:C.muted,display:'block',marginBottom:4}}>
                    FORMA DE PAGO
                  </label>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {[['','Contado'],['CIB','Con intereses banco (CIB)'],['MSI','Sin intereses']].map(([val,lab])=>(
                      <button key={val} onClick={()=>{setDiferidoTipo(val);if(!val)setDiferidoCuotas(0)}}
                        style={{padding:'6px 12px',borderRadius:7,border:'none',cursor:'pointer',fontSize:11,fontWeight:600,
                          background:diferidoTipo===val?C.blue:'rgba(255,255,255,.08)',
                          color:diferidoTipo===val?'#fff':C.muted}}>
                        {lab}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cuotas */}
                {diferidoTipo && (
                  <div>
                    <label style={{fontSize:11,fontWeight:700,color:C.muted,display:'block',marginBottom:4}}>
                      CUOTAS
                    </label>
                    <div style={{display:'flex',gap:6}}>
                      {CUOTAS_OPCIONES.map(c=>(
                        <button key={c} onClick={()=>setDiferidoCuotas(c)}
                          style={{flex:1,padding:'8px 4px',borderRadius:7,border:'none',cursor:'pointer',
                            fontSize:13,fontWeight:700,
                            background:diferidoCuotas===c?C.blue:'rgba(255,255,255,.08)',
                            color:diferidoCuotas===c?'#fff':C.muted}}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={iniciar} disabled={!terminalId || (diferidoTipo && !diferidoCuotas)}
                  style={{padding:'13px',borderRadius:10,border:'none',cursor:'pointer',fontWeight:800,fontSize:14,
                    background:'linear-gradient(135deg,#1D4ED8,#7C3AED)',color:'white',
                    opacity:(!terminalId || (diferidoTipo && !diferidoCuotas))?0.5:1}}>
                  Enviar ${parseFloat(monto).toFixed(2)} al terminal →
                </button>
              </div>
            )}

            {/* Esperando pago */}
            {estado === 'ESPERANDO' && (
              <div style={{textAlign:'center',padding:'20px 0'}}>
                <div style={{fontSize:48,marginBottom:16,animation:'spin 2s linear infinite',display:'inline-block'}}>💳</div>
                <div style={{fontWeight:700,fontSize:15,color:C.text,marginBottom:8}}>
                  Esperando pago del cliente...
                </div>
                <div style={{fontSize:12,color:C.muted,marginBottom:24}}>
                  El cliente debe insertar/acercar su tarjeta al terminal
                </div>
                <div style={{padding:'10px',borderRadius:8,background:'rgba(59,130,246,.1)',
                  border:'1px solid rgba(59,130,246,.3)',fontSize:12,color:C.blue,marginBottom:16}}>
                  {diferidoTipo
                    ? `Diferido ${diferidoTipo} · ${diferidoCuotas} cuotas`
                    : 'Pago de contado'}
                </div>
                <button onClick={cancelar}
                  style={{padding:'9px 20px',borderRadius:8,border:`1px solid ${C.border}`,
                    background:'transparent',color:C.muted,cursor:'pointer',fontSize:13}}>
                  Cancelar
                </button>
                <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
              </div>
            )}

            {/* Aprobado */}
            {estado === 'APROBADO' && (
              <div style={{textAlign:'center',padding:'20px 0'}}>
                <div style={{fontSize:56,marginBottom:12}}>✅</div>
                <div style={{fontWeight:800,fontSize:18,color:C.green,marginBottom:8}}>¡Pago Aprobado!</div>
                <div style={{fontSize:13,color:C.muted,marginBottom:24}}>{mensaje}</div>
                <button onClick={cerrar}
                  style={{padding:'11px 32px',borderRadius:10,border:'none',
                    background:C.green,color:'white',fontWeight:700,fontSize:14,cursor:'pointer'}}>
                  Continuar →
                </button>
              </div>
            )}

            {/* Rechazado / Error */}
            {(estado === 'RECHAZADO' || estado === 'ERROR') && (
              <div style={{textAlign:'center',padding:'20px 0'}}>
                <div style={{fontSize:56,marginBottom:12}}>❌</div>
                <div style={{fontWeight:800,fontSize:16,color:'#EF4444',marginBottom:8}}>
                  {estado === 'RECHAZADO' ? 'Pago Rechazado' : 'Error de conexión'}
                </div>
                <div style={{fontSize:12,color:C.muted,marginBottom:24,padding:'10px',
                  borderRadius:8,background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.2)'}}>
                  {mensaje}
                </div>
                <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                  <button onClick={()=>setEstado('IDLE')}
                    style={{padding:'10px 24px',borderRadius:9,border:'none',
                      background:C.blue,color:'white',fontWeight:700,fontSize:13,cursor:'pointer'}}>
                    Intentar de nuevo
                  </button>
                  <button onClick={cerrar}
                    style={{padding:'10px 20px',borderRadius:9,border:`1px solid ${C.border}`,
                      background:'transparent',color:C.muted,cursor:'pointer',fontSize:13}}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ══════════════════════════════════════════════════════════════
//  Modal: Cargar cotización aprobada en factura
// ══════════════════════════════════════════════════════════════
function ModalCargarCotizacion({ C, onCerrar, onCargar }) {
  const [cots, setCots]       = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    api.get('/cotizaciones', { params: { estado: 'APROBADA' } })
      .then(r => setCots(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const cargar = async (cot) => {
    try {
      const r = await api.get(`/cotizaciones/${cot.id}`)
      onCargar(r.data)
    } catch(e) { alert(e.response?.data?.detail || 'Error al cargar cotización') }
  }

  const filtradas = cots.filter(c =>
    !busqueda ||
    c.numero?.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.cliente_nombre?.toLowerCase().includes(busqueda.toLowerCase())
  )

  const fmt$ = v => '$' + Number(v||0).toLocaleString('es-EC',{minimumFractionDigits:2,maximumFractionDigits:2})
  const fi = { width:'100%', padding:'9px 12px', borderRadius:8, fontSize:13,
    background:C.sur2, border:`1px solid ${C.bord2}`, color:C.text, outline:'none' }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}>
      <div style={{background:C.surface,borderRadius:14,border:`1px solid ${C.bord2}`,
        padding:28,width:580,maxHeight:'80vh',display:'flex',flexDirection:'column',
        boxShadow:'0 25px 60px rgba(0,0,0,.5)'}}>

        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <div>
            <div style={{fontWeight:800,fontSize:16,color:C.text}}>📋 Cargar desde cotización</div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>
              Solo se muestran cotizaciones aprobadas
            </div>
          </div>
          <button onClick={onCerrar}
            style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:22}}>×</button>
        </div>

        <input value={busqueda} onChange={e=>setBusqueda(e.target.value)}
          style={{...fi,marginBottom:12}} placeholder="Buscar por número o cliente..." />

        <div style={{flex:1,overflowY:'auto'}}>
          {loading ? (
            <div style={{textAlign:'center',padding:30,color:C.muted}}>Cargando...</div>
          ) : filtradas.length === 0 ? (
            <div style={{textAlign:'center',padding:30,color:C.muted}}>
              {busqueda ? 'No se encontraron cotizaciones' : 'No hay cotizaciones aprobadas disponibles'}
            </div>
          ) : filtradas.map(cot => (
            <div key={cot.id}
              onClick={() => cargar(cot)}
              style={{padding:'12px 16px',borderRadius:10,marginBottom:8,cursor:'pointer',
                background:C.sur2,border:`1px solid ${C.bord2}`,
                display:'flex',justifyContent:'space-between',alignItems:'center',
                transition:'all .15s'}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=C.purple}
              onMouseLeave={e=>e.currentTarget.style.borderColor=C.bord2}>
              <div>
                <div style={{fontWeight:700,fontSize:13,color:C.blue}}>{cot.numero}</div>
                <div style={{fontSize:12,color:C.text,marginTop:2}}>{cot.cliente_nombre}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:1}}>
                  Válida hasta: {cot.fecha_validez ? String(cot.fecha_validez).slice(0,10) : '—'}
                </div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:18,fontWeight:900,color:C.green}}>{fmt$(cot.total)}</div>
                <div style={{marginTop:6}}>
                  <span style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,
                    background:'rgba(139,92,246,.15)',color:C.purple}}>APROBADA</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{marginTop:16,paddingTop:12,borderTop:`1px solid ${C.bord2}`,
          fontSize:11,color:C.hint}}>
          💡 Al cargar, se llena automáticamente el cliente y los productos. Puedes modificar antes de emitir.
        </div>
      </div>
    </div>
  )
}
