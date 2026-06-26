import React,{useState,useEffect,useRef} from 'react'
import api from '../api'
import ModalProducto from '../components/ModalProducto'
import { useTheme } from '../theme'

const C={
  bg:'#0A0F1E',surface:'#111827',sur2:'#1F2937',sur3:'#374151',
  border:'#1F2937',bord2:'#374151',
  text:'#F9FAFB',muted:'#9CA3AF',hint:'#6B7280',
  blue:'#3B82F6',green:'#10B981',amber:'#F59E0B',
  red:'#EF4444',purple:'#8B5CF6',cyan:'#06B6D4',
  greenD:'rgba(16,185,129,.15)',amberD:'rgba(245,158,11,.15)',
  redD:'rgba(239,68,68,.15)',blueD:'rgba(59,130,246,.15)',
}
const fmt$=v=>'$'+Number(v||0).toLocaleString('es-EC',{minimumFractionDigits:2,maximumFractionDigits:2})
const IVA=15
const FI={padding:'8px 11px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,
  background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}


// ── Modal Nuevo Proveedor (formulario completo) ──────────────
const PROV_BLANK = {
  tipo_identificacion:'RUC', identificacion:'', razon_social:'',
  nombre_comercial:'', nombres:'', apellidos:'',
  telefono:'', email:'', direccion:'', ciudad:'', provincia:'',
  pais:'Ecuador', codigo_pais:'593', direccion_matriz:'',
  tipo_contribuyente:'JURIDICA', obligado_contabilidad:false,
  contribuyente_especial:'', tipo_proveedor:'BIENES',
  contacto_nombre:'', contacto_telefono:'', contacto_email:'',
  plazo_pago:30, limite_credito:0, activo:true,
}

function ModalNuevoProveedor({onGuardado, onCancelar}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [form, setForm] = useState(PROV_BLANK)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const s = (k,v) => setForm(f=>({...f,[k]:v}))

  const fi = { style:{width:'100%',padding:'8px 10px',borderRadius:8,fontSize:13,
    border:'1px solid #334155',background:'#1F2937',color:'#F9FAFB',
    outline:'none',boxSizing:'border-box'}}
  const lbl = (t,req) => (
    <label style={{fontSize:11,fontWeight:600,color:'#9CA3AF',
      display:'block',marginBottom:3,textTransform:'uppercase'}}>
      {t}{req&&<span style={{color:'#EF4444'}}> *</span>}
    </label>
  )

  async function guardar() {
    if (!form.identificacion||!form.razon_social)
      return setMsg('⚠️ Identificación y razón social son obligatorios')
    setSaving(true); setMsg('')
    try {
      const {data} = await api.post('/proveedores', {
        ...form,
        limite_credito: parseFloat(form.limite_credito)||0,
        plazo_pago:     parseInt(form.plazo_pago)||0,
      })
      onGuardado({id:data.id, ...form})
    } catch(e) { setMsg('❌ '+(e.response?.data?.detail||e.message)) }
    finally { setSaving(false) }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:9000}}>
      <div style={{background:'#111827',borderRadius:16,padding:28,width:620,
        maxHeight:'90vh',overflowY:'auto',
        border:'1px solid #374151',boxShadow:'0 25px 60px rgba(0,0,0,.7)'}}>
        <div style={{display:'flex',justifyContent:'space-between',
          alignItems:'center',marginBottom:20}}>
          <span style={{fontSize:16,fontWeight:800,color:'#F9FAFB'}}>🏭 Nuevo proveedor</span>
          <button onClick={onCancelar} style={{background:'none',border:'none',
            cursor:'pointer',color:'#6B7280',fontSize:22}}>×</button>
        </div>
        {/* Sección fiscal */}
        <div style={{background:'#1F2937',borderRadius:10,padding:14,marginBottom:12,
          border:'1px solid #374151'}}>
          <div style={{fontSize:11,fontWeight:700,color:'#3B82F6',marginBottom:12,
            textTransform:'uppercase'}}>📋 Identificación fiscal (SRI)</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
            <div>
              {lbl('Tipo ID',true)}
              <select {...fi} value={form.tipo_identificacion}
                onChange={e=>s('tipo_identificacion',e.target.value)}>
                <option value="RUC">RUC</option>
                <option value="CEDULA">Cédula</option>
                <option value="PASAPORTE">Pasaporte</option>
              </select>
            </div>
            <div>
              {lbl('Identificación',true)}
              <input {...fi} value={form.identificacion}
                onChange={e=>s('identificacion',e.target.value)} placeholder="RUC o cédula"/>
            </div>
            <div>
              {lbl('Tipo contribuyente')}
              <select {...fi} value={form.tipo_contribuyente}
                onChange={e=>s('tipo_contribuyente',e.target.value)}>
                <option value="NATURAL">Persona Natural</option>
                <option value="JURIDICA">Persona Jurídica</option>
                <option value="PUBLICA">Entidad Pública</option>
              </select>
            </div>
            <div style={{gridColumn:'1/-1'}}>
              {lbl('Razón social',true)}
              <input {...fi} value={form.razon_social}
                onChange={e=>s('razon_social',e.target.value.toUpperCase())}
                placeholder="Razón social o nombre completo"/>
            </div>
            <div>
              {lbl('Nombre comercial')}
              <input {...fi} value={form.nombre_comercial}
                onChange={e=>s('nombre_comercial',e.target.value)}/>
            </div>
            <div>
              {lbl('Tipo proveedor')}
              <select {...fi} value={form.tipo_proveedor}
                onChange={e=>s('tipo_proveedor',e.target.value)}>
                <option value="BIENES">Bienes</option>
                <option value="SERVICIOS">Servicios</option>
                <option value="BIENES Y SERVICIOS">Bienes y Servicios</option>
                <option value="IMPORTADOR">Importador</option>
              </select>
            </div>
            <div>
              {lbl('Obligado a contabilidad')}
              <select {...fi} value={form.obligado_contabilidad?'true':'false'}
                onChange={e=>s('obligado_contabilidad',e.target.value==='true')}>
                <option value="false">No</option>
                <option value="true">Sí</option>
              </select>
            </div>
          </div>
        </div>
        {/* Sección contacto */}
        <div style={{background:'#1F2937',borderRadius:10,padding:14,marginBottom:12,
          border:'1px solid #374151'}}>
          <div style={{fontSize:11,fontWeight:700,color:'#9CA3AF',marginBottom:12,
            textTransform:'uppercase'}}>📍 Contacto y ubicación</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
            <div>
              {lbl('Teléfono')}
              <input {...fi} value={form.telefono}
                onChange={e=>s('telefono',e.target.value)} placeholder="0999999999"/>
            </div>
            <div>
              {lbl('Email',true)}
              <input {...fi} type="email" value={form.email}
                onChange={e=>s('email',e.target.value)} placeholder="email@proveedor.com"/>
            </div>
            <div>
              {lbl('Ciudad')}
              <input {...fi} value={form.ciudad}
                onChange={e=>s('ciudad',e.target.value)} placeholder="Quito"/>
            </div>
            <div style={{gridColumn:'1/-1'}}>
              {lbl('Dirección')}
              <input {...fi} value={form.direccion}
                onChange={e=>s('direccion',e.target.value)}/>
            </div>
          </div>
        </div>
        {/* Condiciones */}
        <div style={{background:'#1F2937',borderRadius:10,padding:14,marginBottom:12,
          border:'1px solid #374151'}}>
          <div style={{fontSize:11,fontWeight:700,color:'#10B981',marginBottom:12,
            textTransform:'uppercase'}}>💼 Condiciones de compra</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div>
              {lbl('Días de crédito')}
              <input {...fi} type="number" value={form.plazo_pago}
                onChange={e=>s('plazo_pago',e.target.value)} placeholder="30"/>
            </div>
            <div>
              {lbl('Límite de crédito $')}
              <input {...fi} type="number" step="0.01" value={form.limite_credito}
                onChange={e=>s('limite_credito',e.target.value)} placeholder="0"/>
            </div>
          </div>
        </div>

        {msg&&<div style={{marginBottom:12,padding:'8px 12px',borderRadius:8,fontSize:12,
          background:'rgba(239,68,68,.15)',color:'#FCA5A5',
          border:'1px solid rgba(239,68,68,.3)'}}>{msg}</div>}

        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <button onClick={onCancelar} style={{padding:'10px 20px',borderRadius:9,
            border:'1px solid #374151',background:'transparent',
            color:'#9CA3AF',cursor:'pointer',fontSize:13}}>Cancelar</button>
          <button onClick={guardar} disabled={saving}
            style={{padding:'10px 26px',borderRadius:9,border:'none',
              background:saving?'#374151':'#F59E0B',
              color:saving?'#9CA3AF':'#000',
              cursor:saving?'not-allowed':'pointer',fontSize:13,fontWeight:800}}>
            {saving?'Guardando...':'✓ Crear proveedor'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Selector proveedor ───────────────────────────────────────
function SelectorProveedor({value,onChange}){
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [txt,setTxt]=useState(''),[res,setRes]=useState([]),[open,setOpen]=useState(false)
  const ref=useRef()
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false)}
    document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h)
  },[])
  async function buscar(v){
    setTxt(v)
    if(v.length<2){setRes([]);setOpen(false);return}
    try{const{data}=await api.get('/proveedores',{params:{busqueda:v,activo:'true'}});setRes(data.slice(0,8));setOpen(true)}catch{}
  }
  function pick(p){onChange(p);setTxt(p.razon_social);setOpen(false);setRes([])}

  if(value) return(
    <div style={{display:'flex',alignItems:'center',gap:10,padding:'9px 14px',borderRadius:10,
      background:C.greenD,border:`1px solid rgba(16,185,129,.3)`}}>
      <span style={{fontSize:16}}>🏭</span>
      <div style={{flex:1}}>
        <div style={{fontWeight:700,fontSize:14,color:C.text}}>{value.razon_social}</div>
        <div style={{fontSize:11,color:C.muted}}>{value.tipo_identificacion} {value.identificacion}
          {value.telefono&&` · ${value.telefono}`}
        </div>
      </div>
      <button onClick={()=>{onChange(null);setTxt('')}} style={{background:'none',border:'none',cursor:'pointer',color:C.hint,fontSize:20}}>×</button>
    </div>
  )
  return(
    <div ref={ref} style={{position:'relative'}}>
      <div style={{display:'flex',gap:8}}>
        <div style={{position:'relative',flex:1}}>
          <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:C.hint}}>🔍</span>
          <input value={txt} onChange={e=>buscar(e.target.value)} onFocus={()=>txt.length>=2&&setOpen(true)}
            placeholder="Buscar proveedor por nombre o RUC..."
            style={{...FI,paddingLeft:34}}/>
        </div>
        <button onClick={()=>onChange('__nuevo__')}
          style={{padding:'9px 14px',borderRadius:8,border:`1px solid ${C.amber}`,
            background:`rgba(245,158,11,.15)`,color:C.amber,cursor:'pointer',
            fontSize:13,fontWeight:700,whiteSpace:'nowrap',flexShrink:0}}>
          + Nuevo
        </button>
      </div>
      {open&&res.length>0&&(
        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,zIndex:800,
          background:C.surface,borderRadius:10,border:`1px solid ${C.bord2}`,
          boxShadow:'0 12px 32px rgba(0,0,0,.6)',overflow:'hidden'}}>
          {res.map(p=>(
            <div key={p.id} onClick={()=>pick(p)}
              style={{padding:'10px 14px',cursor:'pointer',borderBottom:`1px solid ${C.border}`}}
              onMouseEnter={e=>e.currentTarget.style.background=C.sur2}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <div style={{fontWeight:600,fontSize:13,color:C.text}}>{p.razon_social}</div>
              <div style={{fontSize:11,color:C.muted}}>{p.tipo_identificacion} {p.identificacion}
                {p.ciudad&&` · ${p.ciudad}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── SeriesInput — ingreso de series en compras ───────────────
function SeriesInput({series, onAgregar, onQuitar}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [val, setVal] = React.useState('')
  function handleAdd(){
    const s=val.trim().toUpperCase()
    if(!s) return
    onAgregar(s); setVal('')
  }
  return(
    <div style={{marginTop:5}}>
      {series.length>0&&(
        <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:5}}>
          {series.map((s,i)=>(
            <span key={i} style={{display:'inline-flex',alignItems:'center',gap:4,
              padding:'2px 8px',borderRadius:6,fontSize:10,fontWeight:700,
              background:'rgba(139,92,246,.15)',color:C.purple,
              border:'1px solid rgba(139,92,246,.3)'}}>
              {s}
              <button onClick={()=>onQuitar(s)}
                style={{background:'none',border:'none',cursor:'pointer',
                  color:C.purple,fontSize:12,lineHeight:1,padding:0}}>x</button>
            </span>
          ))}
        </div>
      )}
      <div style={{display:'flex',gap:4}}>
        <input value={val} onChange={e=>setVal(e.target.value.toUpperCase())}
          onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();handleAdd()}}}
          placeholder="Serie / IMEI + Enter"
          style={{...FI,fontSize:10,padding:'3px 7px',flex:1,
            borderColor:'rgba(139,92,246,.4)',background:'rgba(139,92,246,.05)'}}/>
        <button onClick={handleAdd} disabled={!val.trim()}
          style={{padding:'3px 10px',borderRadius:6,border:'none',fontSize:10,
            fontWeight:700,cursor:val.trim()?'pointer':'not-allowed',
            background:val.trim()?C.purple:C.sur3,
            color:val.trim()?'white':C.hint}}>+</button>
      </div>
      {series.length>0&&(
        <div style={{fontSize:9,color:C.hint,marginTop:2}}>
          {series.length} serie{series.length!==1?'s':''} ingresada{series.length!==1?'s':''}
        </div>
      )}
    </div>
  )
}

// ── Buscador de productos ────────────────────────────────────
function BuscadorProducto({onAgregar}){
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [txt,setTxt]=useState(''),[res,setRes]=useState([]),[open,setOpen]=useState(false)
  const ref=useRef()
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false)}
    document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h)
  },[])
  async function buscar(v){
    setTxt(v)
    if(v.length<2){setRes([]);setOpen(false);return}
    try{const{data}=await api.get('/productos',{params:{busqueda:v,activo:'true'}});setRes(data.slice(0,12));setOpen(true)}catch{}
  }
  function agregar(p){onAgregar(p);setTxt('');setRes([]);setOpen(false)}
  return(
    <div ref={ref} style={{position:'relative',flex:1}}>
      <div style={{position:'relative'}}>
        <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:C.hint}}>📦</span>
        <input value={txt} onChange={e=>buscar(e.target.value)}
          placeholder="Buscar producto por código o descripción..."
          style={{...FI,paddingLeft:34,border:`1px dashed ${C.bord2}`,background:C.sur2}}/>
      </div>
      {open&&res.length>0&&(
        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,zIndex:800,
          background:C.surface,borderRadius:10,border:`1px solid ${C.bord2}`,
          boxShadow:'0 12px 32px rgba(0,0,0,.6)',overflow:'hidden',maxHeight:320,overflowY:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',tableLayout:'fixed'}}>
            <colgroup><col style={{width:'15%'}}/><col style={{width:'50%'}}/><col style={{width:'15%'}}/><col style={{width:'20%'}}/></colgroup>
            <thead>
              <tr style={{background:C.sur3}}>
                {['Código','Descripción','Stock','Costo actual'].map((h,i)=>(
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
                    <td style={{padding:'8px 10px',fontSize:12,fontWeight:600,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.descripcion}</td>
                    <td style={{padding:'8px 10px',textAlign:'center'}}>
                      <span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,
                        background:stk>0?C.greenD:C.redD,color:stk>0?C.green:C.red}}>{stk}</span>
                    </td>
                    <td style={{padding:'8px 10px',textAlign:'right',fontWeight:700,fontSize:13,color:C.amber}}>
                      {fmt$(p.costo||0)}
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

// ════════════════════════════════════════════════════════════
//  PÁGINA PRINCIPAL
// ════════════════════════════════════════════════════════════
export default function Compras(){
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const user=JSON.parse(localStorage.getItem('nexus_user')||'{}')

  const [proveedor,   setProveedor]  =useState(null)

  function handleSetProveedor(p) {
    if (p === '__nuevo__') { setModalNuevoProv(true); return }
    setProveedor(p)
    // Usar plazo del proveedor si tiene
    if (p?.plazo_pago && parseInt(p.plazo_pago) > 0) {
      handlePlazo(parseInt(p.plazo_pago))
    }
  }
  const [bodegas,     setBodegas]    =useState([])
  const [bodegaId,    setBodegaId]   =useState(null)
  const [items,       setItems]      =useState([])
  const [descGlobal,  setDescGlobal] =useState(0)
  const [plazo,       setPlazo]      =useState(30)
  const [fechaVenc,   setFechaVenc]  =useState('')
  const [fechaEmision, setFechaEmision]=useState(new Date().toISOString().slice(0,10))
  const [numFactProv, setNumFactProv]=useState('')
  const [obs,         setObs]        =useState('')
  const [pagos,       setPagos]      =useState([])
  const [saving,      setSaving]     =useState(false)
  const [msg,         setMsg]        =useState('')
  const [proxNum,     setProxNum]    =useState('cargando...')
  const [ultimaComp,  setUltimaComp] =useState(null)
  const [sucursalNombre,setSucNombre]=useState('')
  const [modalNuevoProv, setModalNuevoProv] = useState(false)
  const [modalNuevoProd, setModalNuevoProd] = useState(false)
  const [marcas,    setMarcas]    = useState([])
  const [cats,      setCats]      = useState([])
  const [tiposP,    setTiposP]    = useState([])

  useEffect(()=>{
    const hoy=new Date()
    const venc=new Date(hoy.getTime()+30*24*60*60*1000)
    setFechaVenc(venc.toISOString().slice(0,10))
    Promise.all([
      api.get('/bodegas',{params:{sucursal_id:user.sucursal_id||undefined}}).catch(()=>({data:[]})),
      api.get('/compras/proximo-numero').catch(()=>({data:{numero:'C-001-001-000000001'}})),
      api.get('/config/sucursales').catch(()=>({data:[]})),
      api.get('/marcas').catch(()=>({data:[]})),
      api.get('/categorias').catch(()=>({data:[]})),
      api.get('/tipos-precio').catch(()=>({data:[]})),
    ]).then(([b,n,s,m,c,tp])=>{
      setMarcas(m.data); setCats(c.data); setTiposP(tp.data)
      setBodegas(b.data)
      setProxNum(n.data.numero)
      const bodPpal=b.data.find(x=>x.es_principal)||b.data[0]
      if(bodPpal) setBodegaId(bodPpal.id)
      if(user.sucursal_id&&s.data.length>0){
        const suc=s.data.find(x=>x.id===parseInt(user.sucursal_id))
        if(suc) setSucNombre(suc.nombre)
      }
    })
  },[])

  // Cálculos
  const lin   =it=>it.cant*it.precio*(1-(it.desc||0)/100)
  const sub0  =items.filter(i=>i.iva===0).reduce((a,i)=>a+lin(i),0)
  const sub15 =items.filter(i=>i.iva!==0).reduce((a,i)=>a+lin(i),0)
  const subt  =sub0+sub15
  const dMto  =subt*(Number(descGlobal)||0)/100
  const s0f   =sub0*(1-(Number(descGlobal)||0)/100)
  const s15f  =sub15*(1-(Number(descGlobal)||0)/100)
  const iva   =s15f*IVA/100
  const total =s0f+s15f+iva

  function agregarProducto(p){
    setItems(prev=>{
      const idx=prev.findIndex(i=>i.pid===p.id)
      if(idx>=0) return prev.map((it,i)=>i===idx?{...it,cant:it.cant+1}:it)
      return [...prev,{
        pid:p.id,codigo:p.codigo,desc_prod:p.descripcion,
        cant:1,precio:Number(p.costo||0),
        desc:0,iva:Number(p.iva_porcentaje??IVA),
        stock:Number(p.stock_total||0),
        aplica_series:p.aplica_series||false,
        series:[],
      }]
    })
  }

  const setIt=(idx,k,v)=>setItems(prev=>prev.map((it,i)=>i===idx
    ?{...it,[k]:['cant','precio','desc'].includes(k)?parseFloat(v)||0:v}:it))

  function agregarSerie(idx, serie) {
    const s = serie.trim().toUpperCase()
    if(!s) return
    setItems(prev=>prev.map((it,i)=>{
      if(i!==idx) return it
      if(it.series.includes(s)) return it  // no duplicar
      return {...it, series:[...it.series, s], cant:it.series.length+1}
    }))
  }

  function quitarSerie(idx, serie) {
    setItems(prev=>prev.map((it,i)=>{
      if(i!==idx) return it
      const nuevas = it.series.filter(s=>s!==serie)
      return {...it, series:nuevas, cant:Math.max(1,nuevas.length)}
    }))
  }

  // Actualizar fecha vencimiento al cambiar plazo
  function handlePlazo(v){
    setPlazo(v)
    const d=new Date()
    d.setDate(d.getDate()+parseInt(v)||30)
    setFechaVenc(d.toISOString().slice(0,10))
  }

  const limpiar=()=>{
    setProveedor(null);setItems([]);setObs('');setDescGlobal(0)
    setNumFactProv('');setPlazo(30);setMsg('')
    const d=new Date();d.setDate(d.getDate()+30)
    setFechaVenc(d.toISOString().slice(0,10))
  }

  async function ingresar(){
    if(!proveedor)         return setMsg('⚠️ Selecciona un proveedor')
    if(items.length===0)   return setMsg('⚠️ Agrega al menos un producto')
    if(!bodegaId)          return setMsg('⚠️ Selecciona una bodega')
    setMsg('');setSaving(true)
    try{
      const{data}=await api.post('/compras',{
        proveedor_id:         proveedor.id,
        sucursal_id:          user.sucursal_id||null,
        bodega_id:            bodegaId,
        numero_factura_prov:  numFactProv||null,
        fecha_emision:        fechaEmision,
        fecha_vencimiento:    fechaVenc,
        plazo_dias:           parseInt(plazo)||30,
        descuento_global_pct: Number(descGlobal)||0,
        observaciones:        obs,
        detalles: items.map(it=>({
          producto_id:     it.pid,
          cantidad:        it.cant,
          precio_unitario: it.precio,
          descuento_pct:   it.desc||0,
          iva_porcentaje:  it.iva,
          bodega_id:       bodegaId,
          series:          it.series||[],
        })),
      })
      setUltimaComp({numero:data.numero_compra,total:data.total})
      limpiar()
      // Actualizar próximo número
      api.get('/compras/proximo-numero').then(r=>setProxNum(r.data.numero)).catch(()=>{})
    }catch(e){setMsg('❌ '+(e.response?.data?.detail||e.message))}
    finally{setSaving(false)}
  }

  const TH=(a='left')=>({padding:'10px 12px',fontSize:10,fontWeight:700,color:C.hint,
    textAlign:a,background:C.sur3,borderBottom:`1px solid ${C.bord2}`,
    textTransform:'uppercase',letterSpacing:'.05em',whiteSpace:'nowrap'})
  const TD=(a='left')=>({padding:'9px 10px',fontSize:13,
    borderBottom:`1px solid ${C.border}`,verticalAlign:'middle',color:C.text,textAlign:a})

  return(
    <div style={{fontFamily:"'Inter','Segoe UI',system-ui,sans-serif",
      background:C.bg,minHeight:'100vh',display:'flex',flexDirection:'column',color:C.text}}>

      {/* ── TOPBAR ── */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.bord2}`,
        padding:'0 20px',height:56,display:'flex',alignItems:'center',
        justifyContent:'space-between',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:20}}>📦</span>
            <span style={{fontSize:14,fontWeight:800,color:C.text}}>Ingreso de compra</span>
          </div>
          {/* Número compra */}
          <div style={{display:'flex',alignItems:'center',gap:6,padding:'4px 12px',
            borderRadius:8,background:C.amberD,border:`1px solid rgba(245,158,11,.3)`}}>
            <span style={{fontSize:10,color:C.amber,fontWeight:700}}>N°</span>
            <code style={{fontSize:14,fontWeight:800,color:C.amber}}>{proxNum}</code>
          </div>
          {/* Sucursal */}
          {sucursalNombre&&(
            <div style={{display:'flex',alignItems:'center',gap:6,padding:'4px 12px',
              borderRadius:8,background:C.greenD,border:`1px solid rgba(16,185,129,.25)`}}>
              <span style={{fontSize:11,color:C.green}}>🏢</span>
              <span style={{fontSize:12,fontWeight:600,color:C.green}}>{sucursalNombre}</span>
            </div>
          )}
          {/* Última compra */}
          {ultimaComp&&(
            <div style={{display:'flex',alignItems:'center',gap:6,padding:'4px 12px',
              borderRadius:8,background:C.greenD,border:`1px solid rgba(16,185,129,.3)`}}>
              <span>✅</span>
              <span style={{fontSize:12,fontWeight:700,color:C.green}}>
                {ultimaComp.numero} — {fmt$(ultimaComp.total)}
              </span>
              <button onClick={()=>setUltimaComp(null)}
                style={{background:'none',border:'none',cursor:'pointer',color:C.hint,fontSize:14}}>×</button>
            </div>
          )}
        </div>
        <div style={{display:'flex',gap:8}}>
          {(items.length>0||proveedor)&&(
            <button onClick={limpiar}
              style={{padding:'8px 14px',borderRadius:8,border:`1px solid rgba(239,68,68,.3)`,
                background:C.redD,color:C.red,cursor:'pointer',fontSize:12,fontWeight:600}}>
              🗑 Limpiar
            </button>
          )}
          <button onClick={ingresar} disabled={saving||!proveedor||items.length===0}
            style={{padding:'8px 20px',borderRadius:8,border:'none',fontSize:13,fontWeight:800,
              background:(saving||!proveedor||items.length===0)?C.sur3:C.amber,
              color:(saving||!proveedor||items.length===0)?C.hint:'#000',
              cursor:(saving||!proveedor||items.length===0)?'not-allowed':'pointer'}}>
            {saving?'Ingresando...':'📥 Ingresar compra'}
          </button>
        </div>
      </div>

      {/* ── CABECERA ── */}
      <div style={{padding:'12px 16px 0',flexShrink:0}}>
        <div style={{background:C.surface,borderRadius:12,padding:'14px 16px',
          border:`1px solid ${C.bord2}`}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr auto auto auto auto',gap:14,alignItems:'end'}}>
            {/* Proveedor */}
            <div>
              <div style={{fontSize:10,fontWeight:700,color:C.hint,marginBottom:6,
                textTransform:'uppercase',letterSpacing:'.06em'}}>Proveedor</div>
              <SelectorProveedor value={proveedor} onChange={handleSetProveedor}/>
            </div>
            {/* Bodega */}
            <div>
              <div style={{fontSize:10,fontWeight:700,color:C.hint,marginBottom:6,
                textTransform:'uppercase',letterSpacing:'.06em'}}>Bodega destino</div>
              <select value={bodegaId||''} onChange={e=>setBodegaId(parseInt(e.target.value)||null)}
                style={{...FI,width:180,borderColor:bodegaId?C.bord2:C.amber,
                  background:bodegaId?C.sur2:C.amberD}}>
                <option value="">— Bodega —</option>
                {bodegas.map(b=>(
                  <option key={b.id} value={b.id}>
                    {b.nombre}{b.es_principal?' ★':''}
                  </option>
                ))}
              </select>
            </div>
            {/* Fecha emisión del proveedor */}
            <div>
              <div style={{fontSize:10,fontWeight:700,color:C.hint,marginBottom:6,
                textTransform:'uppercase',letterSpacing:'.06em'}}>Fecha emisión</div>
              <input type="date" value={fechaEmision}
                onChange={e=>setFechaEmision(e.target.value)}
                style={{...FI,width:150}}/>
            </div>
            {/* N° Factura proveedor */}
            <div>
              <div style={{fontSize:10,fontWeight:700,color:C.hint,marginBottom:6,
                textTransform:'uppercase',letterSpacing:'.06em'}}>N° Fact. proveedor</div>
              <input value={numFactProv} onChange={e=>setNumFactProv(e.target.value)}
                placeholder="001-001-000000001"
                style={{...FI,width:180}}/>
            </div>
            {/* Plazo */}
            <div>
              <div style={{fontSize:10,fontWeight:700,color:C.hint,marginBottom:6,
                textTransform:'uppercase',letterSpacing:'.06em'}}>Plazo (días)</div>
              <input type="number" min="1" value={plazo}
                onChange={e=>handlePlazo(e.target.value)}
                style={{...FI,width:90,textAlign:'center',fontWeight:700}}/>
            </div>
            {/* Fecha vencimiento */}
            <div>
              <div style={{fontSize:10,fontWeight:700,color:C.hint,marginBottom:6,
                textTransform:'uppercase',letterSpacing:'.06em'}}>Vence</div>
              <input type="date" value={fechaVenc} onChange={e=>setFechaVenc(e.target.value)}
                style={{...FI,width:150}}/>
            </div>
            {/* Descuento global */}
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

      {/* ── CUERPO ── */}
      <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 280px',gap:12,padding:12,minHeight:0}}>

        {/* Tabla */}
        <div style={{background:C.surface,borderRadius:12,border:`1px solid ${C.bord2}`,
          display:'flex',flexDirection:'column',overflow:'hidden'}}>
          {/* Buscador */}
          <div style={{padding:'10px 12px',borderBottom:`1px solid ${C.bord2}`,
            background:C.sur2,display:'flex',gap:8}}>
            <BuscadorProducto onAgregar={agregarProducto}/>
            <button onClick={()=>setModalNuevoProd(true)}
              style={{padding:'9px 14px',borderRadius:8,
                border:`1px solid ${C.purple}`,
                background:`rgba(139,92,246,.15)`,color:C.purple,
                cursor:'pointer',fontSize:12,fontWeight:700,
                whiteSpace:'nowrap',flexShrink:0}}>
              + Producto
            </button>
          </div>

          {/* Grid */}
          <div style={{flex:1,overflowY:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',tableLayout:'fixed'}}>
              <colgroup>
                <col style={{width:'11%'}}/><col style={{width:'32%'}}/>
                <col style={{width:'7%'}}/><col style={{width:'7%'}}/><col style={{width:'12%'}}/>
                <col style={{width:'7%'}}/><col style={{width:'8%'}}/><col style={{width:'9%'}}/>
                <col style={{width:'7%'}}/>
              </colgroup>
              <thead style={{position:'sticky',top:0,zIndex:2}}>
                <tr>
                  <th style={TH()}>Código</th>
                  <th style={TH()}>Descripción</th>
                  <th style={TH('center')}>Stock</th>
                  <th style={TH('center')}>Cant.</th>
                  <th style={TH('right')}>P. Compra</th>
                  <th style={TH('center')}>Desc%</th>
                  <th style={TH('center')}>IVA</th>
                  <th style={TH('right')}>Total</th>
                  <th style={TH()}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it,idx)=>{
                  const tot=lin(it)
                  return(
                    <tr key={idx} style={{background:idx%2===0?'transparent':C.sur2}}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(245,158,11,.05)'}
                      onMouseLeave={e=>e.currentTarget.style.background=idx%2===0?'transparent':C.sur2}>
                      <td style={TD()}><code style={{fontSize:11,color:C.purple,fontWeight:700}}>{it.codigo}</code></td>
                      <td style={{...TD(),overflow:'hidden'}}>
                        <div style={{fontSize:12,fontWeight:600,whiteSpace:'nowrap',
                          overflow:'hidden',textOverflow:'ellipsis'}}>{it.desc_prod}</div>
                        <div style={{fontSize:10,color:C.hint}}>
                          Stock actual: <span style={{color:it.stock>0?C.green:C.red,fontWeight:600}}>{it.stock}</span>
                        </div>
                        {it.aplica_series&&(
                          <SeriesInput
                            series={it.series}
                            onAgregar={s=>agregarSerie(idx,s)}
                            onQuitar={s=>quitarSerie(idx,s)}
                          />
                        )}
                      </td>
                      <td style={TD('center')}>
                        <span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,
                          background:it.stock>5?C.greenD:it.stock>0?C.amberD:C.redD,
                          color:it.stock>5?C.green:it.stock>0?C.amber:C.red}}>{it.stock}</span>
                      </td>
                      <td style={{...TD('center'),padding:'6px 6px'}}>
                        <input type="number" min="0.01" value={it.cant}
                          onChange={e=>setIt(idx,'cant',e.target.value)}
                          style={{...FI,width:'100%',textAlign:'center',padding:'5px 4px'}}/>
                      </td>
                      <td style={{...TD('right'),padding:'6px 8px'}}>
                        <input type="number" step="0.01" value={it.precio}
                          onChange={e=>setIt(idx,'precio',e.target.value)}
                          style={{...FI,width:'100%',textAlign:'right',padding:'5px 6px',
                            color:C.amber,fontWeight:700}}/>
                      </td>
                      <td style={{...TD('center'),padding:'6px 6px'}}>
                        <input type="number" min="0" max="100" value={it.desc||0}
                          onChange={e=>setIt(idx,'desc',e.target.value)}
                          style={{...FI,width:'100%',textAlign:'center',padding:'5px 4px'}}/>
                      </td>
                      <td style={TD('center')}>
                        <span style={{padding:'2px 6px',borderRadius:20,fontSize:10,fontWeight:700,
                          background:it.iva>0?C.blueD:C.sur3,
                          color:it.iva>0?C.blue:C.hint}}>{it.iva}%</span>
                      </td>
                      <td style={{...TD('right'),fontWeight:800,color:C.text}}>{fmt$(tot)}</td>
                      <td style={TD('center')}>
                        <button onClick={()=>setItems(p=>p.filter((_,i)=>i!==idx))}
                          style={{background:'none',border:'none',cursor:'pointer',
                            color:C.hint,fontSize:16,lineHeight:1,padding:4}}
                          onMouseEnter={e=>e.currentTarget.style.color=C.red}
                          onMouseLeave={e=>e.currentTarget.style.color=C.hint}>×</button>
                      </td>
                    </tr>
                  )
                })}
                {items.length===0&&(
                  <tr><td colSpan={9} style={{textAlign:'center',padding:'48px 0',
                    color:C.hint,fontSize:13}}>
                    Busca un producto para agregarlo a la compra
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Observaciones */}
          <div style={{padding:'10px 12px',borderTop:`1px solid ${C.bord2}`,
            background:C.sur2,display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:10,fontWeight:700,color:C.hint,
              whiteSpace:'nowrap',textTransform:'uppercase'}}>Obs.</span>
            <input value={obs} onChange={e=>setObs(e.target.value)}
              placeholder="Notas adicionales de la compra..."
              style={{...FI,flex:1,padding:'6px 10px'}}/>
          </div>
        </div>

        {/* ── Panel totales ── */}
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div style={{background:C.surface,borderRadius:12,border:`1px solid ${C.bord2}`,
            padding:16,flex:1}}>
            <div style={{fontSize:10,fontWeight:700,color:C.hint,textTransform:'uppercase',
              letterSpacing:'.06em',marginBottom:14}}>Resumen</div>

            {/* CXP info */}
            <div style={{background:C.amberD,borderRadius:8,padding:'10px 12px',
              marginBottom:14,border:`1px solid rgba(245,158,11,.3)`}}>
              <div style={{fontSize:10,color:C.amber,fontWeight:700,marginBottom:4}}>
                CRÉDITO AL PROVEEDOR
              </div>
              <div style={{fontSize:12,color:C.muted}}>
                Plazo: <span style={{color:C.amber,fontWeight:700}}>{plazo} días</span>
              </div>
              <div style={{fontSize:12,color:C.muted}}>
                Vence: <span style={{color:C.amber,fontWeight:700}}>
                  {fechaVenc?new Date(fechaVenc+'T12:00').toLocaleDateString('es-EC'):'—'}
                </span>
              </div>
              <div style={{fontSize:11,color:C.hint,marginTop:4}}>
                Se generará en CXP automáticamente
              </div>
            </div>

            {[
              {l:'Subtotal bruto', v:subt,  c:C.text},
              dMto>0&&{l:`Desc. ${descGlobal}%`, v:-dMto, c:C.red},
              {l:'Subtotal 0%',   v:s0f,  c:C.muted,sm:true},
              {l:'Subtotal 15%',  v:s15f, c:C.muted,sm:true},
              {l:'IVA 15%',       v:iva,  c:C.amber},
            ].filter(Boolean).map((r,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',
                padding:'5px 0',borderBottom:`1px solid ${C.border}`,fontSize:r.sm?11:12}}>
                <span style={{color:r.c}}>{r.l}</span>
                <span style={{fontWeight:600,color:r.c}}>
                  {r.v<0?'-'+fmt$(Math.abs(r.v)):fmt$(r.v)}
                </span>
              </div>
            ))}

            {/* Total */}
            <div style={{marginTop:12,padding:'14px 16px',borderRadius:10,
              background:'linear-gradient(135deg,#1c2018,#2d3000)',
              border:`1px solid rgba(245,158,11,.3)`,
              display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:11,color:'#FCD34D',fontWeight:700,textTransform:'uppercase'}}>Total</span>
              <span style={{fontSize:22,fontWeight:900,color:'white'}}>{fmt$(total)}</span>
            </div>

            <div style={{fontSize:11,color:C.hint,textAlign:'center',marginTop:8}}>
              {items.length} ítem{items.length!==1?'s':''} · {items.reduce((a,i)=>a+i.cant,0)} unidades
            </div>

            {msg&&(
              <div style={{marginTop:10,padding:'8px 12px',borderRadius:8,fontSize:12,
                background:msg.startsWith('❌')?C.redD:C.amberD,
                color:msg.startsWith('❌')?'#FCA5A5':'#FCD34D',
                border:`1px solid ${msg.startsWith('❌')?'rgba(239,68,68,.3)':'rgba(245,158,11,.3)'}`}}>
                {msg}
              </div>
            )}
          </div>

          {/* Botón ingresar */}
          <button onClick={ingresar}
            disabled={saving||!proveedor||items.length===0||!bodegaId}
            style={{padding:'16px',borderRadius:12,border:'none',fontSize:15,fontWeight:800,
              cursor:(saving||!proveedor||items.length===0||!bodegaId)?'not-allowed':'pointer',
              background:(saving||!proveedor||items.length===0||!bodegaId)?C.sur3:C.amber,
              color:(saving||!proveedor||items.length===0||!bodegaId)?C.hint:'#000',
              boxShadow:(saving||!proveedor||items.length===0||!bodegaId)?'none':'0 4px 20px rgba(245,158,11,.4)',
              transition:'all .2s'}}>
            {saving?'⏳ Ingresando...':
              !proveedor?'Selecciona proveedor':
              items.length===0?'Agrega productos':
              !bodegaId?'Selecciona bodega':
              '📥 Ingresar '+fmt$(total)}
          </button>
        </div>
      </div>
    {/* Modal nuevo proveedor */}
      {modalNuevoProv&&(
        <ModalNuevoProveedor
          onGuardado={p=>{setProveedor(p);setModalNuevoProv(false);handlePlazo(p.plazo_pago||30)}}
          onCancelar={()=>setModalNuevoProv(false)}
        />
      )}

      {/* Modal nuevo producto */}
      {modalNuevoProd&&(
        <ModalProducto
          open={modalNuevoProd}
          onClose={()=>setModalNuevoProd(false)}
          producto={null}
          marcas={marcas}
          categorias={cats}
          tiposPrecio={tiposP}
          bodegas={bodegas}
          onGuardado={()=>setModalNuevoProd(false)}
        />
      )}
    </div>
  )
}