import React,{useState,useEffect,useRef} from 'react'
import api from '../api'
import { useTheme } from '../theme'

const fmt$=v=>'$'+Number(v||0).toLocaleString('es-EC',{minimumFractionDigits:2,maximumFractionDigits:2})
const fmtDate=v=>{if(!v)return'-';const d=new Date(v);return d.toLocaleDateString('es-EC',{day:'2-digit',month:'2-digit',year:'numeric'})}
const fmtDateTime=v=>{if(!v)return'-';const d=new Date(v);return d.toLocaleDateString('es-EC',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
const truncate=(s,n=40)=>s&&s.length>n?s.substring(0,n)+'...':s||''

const ESTADOS=['RECIBIDO','EN_DIAGNOSTICO','PRESUPUESTADO','APROBADO','EN_REPARACION','REPARADO','ENTREGADO','CANCELADO']
const PRIORIDADES=['BAJA','NORMAL','ALTA','URGENTE']
const TIPOS_EQUIPO=['CELULAR','LAPTOP','TABLET','PC','IMPRESORA','OTRO']
const TIPOS_SEG=['NOTA','DIAGNOSTICO','REPARACION','REPUESTO','CONTACTO_CLIENTE','FOTO']

const ESTADO_COLORS={
  RECIBIDO:{bg:'rgba(107,114,128,.15)',text:'#9CA3AF',border:'rgba(107,114,128,.4)'},
  EN_DIAGNOSTICO:{bg:'rgba(59,130,246,.15)',text:'#3B82F6',border:'rgba(59,130,246,.4)'},
  PRESUPUESTADO:{bg:'rgba(139,92,246,.15)',text:'#8B5CF6',border:'rgba(139,92,246,.4)'},
  APROBADO:{bg:'rgba(6,182,212,.15)',text:'#06B6D4',border:'rgba(6,182,212,.4)'},
  EN_REPARACION:{bg:'rgba(245,158,11,.15)',text:'#F59E0B',border:'rgba(245,158,11,.4)'},
  REPARADO:{bg:'rgba(16,185,129,.15)',text:'#10B981',border:'rgba(16,185,129,.4)'},
  ENTREGADO:{bg:'rgba(16,185,129,.2)',text:'#059669',border:'rgba(5,150,105,.4)'},
  CANCELADO:{bg:'rgba(239,68,68,.15)',text:'#EF4444',border:'rgba(239,68,68,.4)'},
}
const PRIO_COLORS={
  BAJA:{bg:'rgba(107,114,128,.15)',text:'#9CA3AF',border:'rgba(107,114,128,.4)'},
  NORMAL:{bg:'rgba(59,130,246,.15)',text:'#3B82F6',border:'rgba(59,130,246,.4)'},
  ALTA:{bg:'rgba(245,158,11,.15)',text:'#F59E0B',border:'rgba(245,158,11,.4)'},
  URGENTE:{bg:'rgba(239,68,68,.15)',text:'#EF4444',border:'rgba(239,68,68,.4)'},
}
const SEG_COLORS={
  NOTA:'#3B82F6',DIAGNOSTICO:'#8B5CF6',REPARACION:'#10B981',
  REPUESTO:'#F59E0B',CONTACTO_CLIENTE:'#06B6D4',FOTO:'#EC4899',
}

const TRANSICIONES={
  RECIBIDO:['EN_DIAGNOSTICO','CANCELADO'],
  EN_DIAGNOSTICO:['PRESUPUESTADO','CANCELADO'],
  PRESUPUESTADO:['APROBADO','CANCELADO'],
  APROBADO:['EN_REPARACION','CANCELADO'],
  EN_REPARACION:['REPARADO','CANCELADO'],
  REPARADO:['ENTREGADO','EN_REPARACION'],
  ENTREGADO:[],CANCELADO:[],
}

const Badge=({text,colors:c,style:s})=>(
  <span style={{padding:'2px 8px',borderRadius:6,fontSize:10,fontWeight:700,
    background:c.bg,color:c.text,border:`1px solid ${c.border}`,whiteSpace:'nowrap',...s}}>
    {(text||'').replace(/_/g,' ')}
  </span>
)

// ── ModalNuevoCliente ────────────────────────────────────────
function ModalNuevoCliente({onGuardado,onCancelar}){
  const C = useTheme()
  const FI2={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,
    background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
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
    if(!f.identificacion||!f.razon_social) return setErr('Identificacion y razon social obligatorios')
    setSaving(true);setErr('')
    try{const{data}=await api.post('/clientes',{...f,limite_credito:parseFloat(f.limite_credito)||0,plazo_pago:parseInt(f.plazo_pago)||0});onGuardado({id:data.id,...f})}
    catch(e){setErr(e.response?.data?.detail||e.message)}finally{setSaving(false)}
  }
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9000}}>
      <div style={{background:C.surface,borderRadius:16,padding:28,width:540,border:`1px solid ${C.bord2}`,boxShadow:'0 25px 60px rgba(0,0,0,.7)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <span style={{fontSize:16,fontWeight:700,color:C.text}}>Nuevo cliente</span>
          <button onClick={onCancelar} style={{background:'none',border:'none',cursor:'pointer',color:C.hint||'#6B7280',fontSize:22,lineHeight:1}}>x</button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div>
            <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3,fontWeight:600}}>TIPO ID</label>
            <select value={f.tipo_identificacion} onChange={e=>s('tipo_identificacion',e.target.value)} style={FI2}>
              <option>RUC</option><option>CEDULA</option><option>PASAPORTE</option><option>CONSUMIDOR FINAL</option>
            </select>
          </div>
          <div>
            <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3,fontWeight:600}}>IDENTIFICACION *</label>
            <div style={{display:'flex',gap:6}}>
              <input value={f.identificacion} onChange={e=>s('identificacion',e.target.value)} onBlur={buscarSRI}
                style={{...FI2,flex:1}} placeholder="RUC / Cedula"/>
              <button onClick={buscarSRI} style={{padding:'9px 10px',borderRadius:8,border:`1px solid ${C.blue}`,
                background:'rgba(59,130,246,.15)',color:C.blue,cursor:'pointer',fontSize:12,fontWeight:700,flexShrink:0}}>SRI</button>
            </div>
          </div>
          <div style={{gridColumn:'1/-1'}}>
            <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3,fontWeight:600}}>RAZON SOCIAL *</label>
            <input value={f.razon_social} onChange={e=>s('razon_social',e.target.value.toUpperCase())} style={FI2}/>
          </div>
          {[{k:'telefono',l:'TELEFONO',ph:'0999999999'},{k:'email',l:'EMAIL',ph:'correo@'},{k:'ciudad',l:'CIUDAD',ph:'Quito'}].map(({k,l,ph})=>(
            <div key={k}>
              <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3,fontWeight:600}}>{l}</label>
              <input value={f[k]} onChange={e=>s(k,e.target.value)} placeholder={ph} style={FI2}/>
            </div>
          ))}
          <div style={{gridColumn:'1/-1'}}>
            <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3,fontWeight:600}}>DIRECCION</label>
            <input value={f.direccion} onChange={e=>s('direccion',e.target.value)} style={FI2}/>
          </div>
        </div>
        {err&&<div style={{marginTop:12,padding:'8px 12px',borderRadius:8,fontSize:12,background:'rgba(239,68,68,.18)',color:'#FCA5A5',border:'1px solid rgba(239,68,68,.3)'}}>{err}</div>}
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

// ── ModalTecnico ────────────────────────────────────────
function ModalTecnico({tecnico,onGuardado,onCancelar}){
  const C=useTheme()
  const FI2={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,
    background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [f,setF]=useState(tecnico||{codigo:'',nombre:'',apellidos:'',cedula:'',telefono:'',email:'',especialidad:'',activo:true,crear_usuario:false,username:'',password:''})
  const [saving,setSaving]=useState(false),[err,setErr]=useState('')
  const s=(k,v)=>setF(p=>({...p,[k]:v}))
  async function guardar(){
    if(!f.nombre?.trim()) return setErr('Nombre es obligatorio')
    setSaving(true);setErr('')
    try{
      if(tecnico?.id){
        await api.put('/servicio-tecnico/tecnicos/'+tecnico.id,f)
      }else{
        await api.post('/servicio-tecnico/tecnicos',f)
      }
      onGuardado()
    }catch(e){setErr(e.response?.data?.detail||e.message)}finally{setSaving(false)}
  }
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9000}}>
      <div style={{background:C.surface,borderRadius:16,padding:28,width:540,border:`1px solid ${C.bord2}`,boxShadow:'0 25px 60px rgba(0,0,0,.7)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <span style={{fontSize:16,fontWeight:700,color:C.text}}>{tecnico?.id?'Editar':'Nuevo'} Tecnico</span>
          <button onClick={onCancelar} style={{background:'none',border:'none',cursor:'pointer',color:C.hint||'#6B7280',fontSize:22,lineHeight:1}}>x</button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div>
            <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3,fontWeight:600}}>CODIGO</label>
            <input value={f.codigo||''} onChange={e=>s('codigo',e.target.value)} placeholder="TEC-001" style={FI2}/>
          </div>
          <div>
            <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3,fontWeight:600}}>CEDULA</label>
            <input value={f.cedula||''} onChange={e=>s('cedula',e.target.value)} placeholder="0999999999" style={FI2}/>
          </div>
          <div>
            <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3,fontWeight:600}}>NOMBRE *</label>
            <input value={f.nombre||''} onChange={e=>s('nombre',e.target.value)} style={FI2}/>
          </div>
          <div>
            <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3,fontWeight:600}}>APELLIDOS</label>
            <input value={f.apellidos||''} onChange={e=>s('apellidos',e.target.value)} style={FI2}/>
          </div>
          <div>
            <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3,fontWeight:600}}>TELEFONO</label>
            <input value={f.telefono||''} onChange={e=>s('telefono',e.target.value)} placeholder="0999999999" style={FI2}/>
          </div>
          <div>
            <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3,fontWeight:600}}>EMAIL</label>
            <input value={f.email||''} onChange={e=>s('email',e.target.value)} placeholder="correo@" style={FI2}/>
          </div>
          <div style={{gridColumn:'1/-1'}}>
            <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3,fontWeight:600}}>ESPECIALIDAD</label>
            <input value={f.especialidad||''} onChange={e=>s('especialidad',e.target.value)} placeholder="Celulares, Laptops, etc." style={FI2}/>
          </div>
        </div>

        {/* Crear cuenta de usuario */}
        {!tecnico?.id&&(
          <div style={{marginTop:14,padding:'12px 14px',borderRadius:10,
            background:f.crear_usuario?'rgba(59,130,246,.08)':C.sur3,
            border:`1px solid ${f.crear_usuario?C.blue+'55':C.bord2}`}}>
            <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,color:C.text}}>
              <input type="checkbox" checked={f.crear_usuario||false}
                onChange={e=>{s('crear_usuario',e.target.checked);if(!f.username)s('username',(f.cedula||f.nombre||'').toLowerCase().replace(/\s/g,''))}}/>
              <span style={{fontWeight:600}}>Crear cuenta de usuario para este técnico</span>
            </label>
            {f.crear_usuario&&(
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:10}}>
                <div>
                  <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3,fontWeight:600}}>USUARIO *</label>
                  <input value={f.username||''} onChange={e=>s('username',e.target.value)} placeholder="nombre.usuario" style={FI2}/>
                </div>
                <div>
                  <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3,fontWeight:600}}>CONTRASEÑA *</label>
                  <input type="password" value={f.password||''} onChange={e=>s('password',e.target.value)} placeholder="Mínimo 4 caracteres" style={FI2}/>
                </div>
                <div style={{gridColumn:'1/-1',fontSize:11,color:C.blue}}>
                  El técnico podrá iniciar sesión con rol "Técnico" y ver solo el módulo de Servicio Técnico.
                </div>
              </div>
            )}
          </div>
        )}

        {err&&<div style={{marginTop:12,padding:'8px 12px',borderRadius:8,fontSize:12,background:'rgba(239,68,68,.18)',color:'#FCA5A5',border:'1px solid rgba(239,68,68,.3)'}}>{err}</div>}
        <div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end'}}>
          <button onClick={onCancelar} style={{padding:'9px 18px',borderRadius:8,border:`1px solid ${C.bord2}`,background:'transparent',color:C.muted,cursor:'pointer',fontSize:13}}>Cancelar</button>
          <button onClick={guardar} disabled={saving} style={{padding:'9px 22px',borderRadius:8,border:'none',background:C.blue,color:'white',cursor:'pointer',fontSize:13,fontWeight:700}}>
            {saving?'Guardando...':tecnico?.id?'Actualizar':'Crear tecnico'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ServicioTecnico(){
  const C=useTheme()
  const FI={padding:'8px 11px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,
    background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}

  const [view,setView]=useState('list') // list | detail | tecnicos
  const [ordenes,setOrdenes]=useState([])
  const [stats,setStats]=useState({total:0,por_estado:{},por_prioridad:{},promedio_dias_reparacion:0})
  const [filtros,setFiltros]=useState({busqueda:'',estado:'',prioridad:'',sucursal_id:''})
  const [sucursales,setSucursales]=useState([])
  const [loading,setLoading]=useState(false)

  // Detail
  const [ordenDetalle,setOrdenDetalle]=useState(null)
  const [segTipo,setSegTipo]=useState('NOTA')
  const [segDesc,setSegDesc]=useState('')

  // Modal nueva orden
  const [showModal,setShowModal]=useState(false)
  const [showNuevoCliente,setShowNuevoCliente]=useState(false)
  const [form,setForm]=useState(blankForm())
  const [cliBusq,setCliBusq]=useState('')
  const [cliResults,setCliResults]=useState([])
  const [cliSelected,setCliSelected]=useState(null)
  const [tecnicos,setTecnicos]=useState([])
  const [saving,setSaving]=useState(false)
  const cliRef=useRef(null)

  // Anticipo modal in detail view
  const [showAnticipo,setShowAnticipo]=useState(false)
  const [antiForm,setAntiForm]=useState({monto:'',forma_pago:'EFECTIVO',referencia:''})
  const [saldoFavor,setSaldoFavor]=useState(null)

  // Estado change dropdown
  const [estadoDropId,setEstadoDropId]=useState(null)

  // Tecnicos management
  const [allTecnicos,setAllTecnicos]=useState([])
  const [showTecnicoModal,setShowTecnicoModal]=useState(false)
  const [editTecnico,setEditTecnico]=useState(null)

  // Repuestos in detail
  const [showRepuestoForm,setShowRepuestoForm]=useState(false)
  const [repForm,setRepForm]=useState({descripcion:'',cantidad:1,costo:0,precio:0,producto_id:null})
  const [prodBusq,setProdBusq]=useState('')
  const [prodResults,setProdResults]=useState([])

  // Warranty fields in detail
  const [garantiaForm,setGarantiaForm]=useState({dias_garantia:0,condiciones_garantia:''})

  // Estado change modal for REPARADO with warranty
  const [showEstadoModal,setShowEstadoModal]=useState(false)
  const [estadoModalTarget,setEstadoModalTarget]=useState(null)
  const [estadoModalDesc,setEstadoModalDesc]=useState('')

  // Notificacion
  const [showNotifDrop,setShowNotifDrop]=useState(false)
  const [notifMsg,setNotifMsg]=useState('')
  const [toast,setToast]=useState(null)

  // Facturar
  const [showFacturarModal,setShowFacturarModal]=useState(false)
  const [facturarFormaPago,setFacturarFormaPago]=useState('EFECTIVO')
  const [facturando,setFacturando]=useState(false)

  // Historial equipo
  const [historialEquipo,setHistorialEquipo]=useState([])
  const [historialLoaded,setHistorialLoaded]=useState(false)

  // Dashboard tecnicos
  const [showDashTecnicos,setShowDashTecnicos]=useState(false)
  const [dashTecnicos,setDashTecnicos]=useState([])
  const [dashFechas,setDashFechas]=useState({fecha_ini:'',fecha_fin:''})

  function blankForm(){
    return {
      equipo_tipo:'CELULAR',equipo_marca:'',equipo_modelo:'',equipo_serie:'',
      equipo_color:'',equipo_password:'',accesorios:'',problema_reportado:'',
      costo_estimado:0,anticipo:0,prioridad:'NORMAL',fecha_estimada:'',
      observaciones:'',tecnico_id:''
    }
  }

  useEffect(()=>{
    loadOrdenes();loadStats();loadTecnicos()
    api.get('/sucursales').then(r=>setSucursales(r.data||[])).catch(()=>{})
  },[])

  function loadOrdenes(){
    setLoading(true)
    const p=new URLSearchParams()
    if(filtros.busqueda)p.append('busqueda',filtros.busqueda)
    if(filtros.estado)p.append('estado',filtros.estado)
    if(filtros.prioridad)p.append('prioridad',filtros.prioridad)
    if(filtros.sucursal_id)p.append('sucursal_id',filtros.sucursal_id)
    api.get('/servicio-tecnico?'+p.toString())
      .then(r=>setOrdenes(r.data||[]))
      .catch(()=>{})
      .finally(()=>setLoading(false))
  }

  function loadStats(){
    const p=filtros.sucursal_id?'?sucursal_id='+filtros.sucursal_id:''
    api.get('/servicio-tecnico/stats'+p).then(r=>setStats(r.data||{})).catch(()=>{})
  }

  function loadTecnicos(){
    api.get('/servicio-tecnico/tecnicos').then(r=>setTecnicos(r.data||[])).catch(()=>{})
  }

  function loadAllTecnicos(){
    // For the management view we need all, including inactive - but the endpoint only returns active.
    // We'll use the same endpoint for now (toggle re-fetches)
    api.get('/servicio-tecnico/tecnicos').then(r=>setAllTecnicos(r.data||[])).catch(()=>{})
  }

  useEffect(()=>{const t=setTimeout(loadOrdenes,300);return()=>clearTimeout(t)},[filtros])

  // Client search
  useEffect(()=>{
    if(cliBusq.length<2){setCliResults([]);return}
    const t=setTimeout(()=>{
      api.get('/clientes?busqueda='+encodeURIComponent(cliBusq))
        .then(r=>setCliResults((r.data||[]).slice(0,8)))
        .catch(()=>{})
    },300)
    return()=>clearTimeout(t)
  },[cliBusq])

  // Product search for repuestos
  useEffect(()=>{
    if(prodBusq.length<2){setProdResults([]);return}
    const t=setTimeout(()=>{
      api.get('/productos?busqueda='+encodeURIComponent(prodBusq)+'&limit=8')
        .then(r=>setProdResults((r.data?.productos||r.data||[]).slice(0,8)))
        .catch(()=>{})
    },300)
    return()=>clearTimeout(t)
  },[prodBusq])

  function selectCliente(c){
    setCliSelected(c)
    setCliBusq(c.razon_social)
    setCliResults([])
  }

  function openNueva(){
    setForm(blankForm())
    setCliSelected(null)
    setCliBusq('')
    setShowModal(true)
  }

  function guardarOrden(){
    if(!cliSelected)return alert('Seleccione un cliente')
    if(!form.problema_reportado.trim())return alert('El problema reportado es obligatorio')
    setSaving(true)
    api.post('/servicio-tecnico',{
      cliente_id:cliSelected.id,
      tecnico_id:form.tecnico_id?parseInt(form.tecnico_id):null,
      equipo_tipo:form.equipo_tipo,equipo_marca:form.equipo_marca,
      equipo_modelo:form.equipo_modelo,equipo_serie:form.equipo_serie||null,
      equipo_color:form.equipo_color||null,equipo_password:form.equipo_password||null,
      accesorios:form.accesorios||null,
      problema_reportado:form.problema_reportado,
      costo_estimado:parseFloat(form.costo_estimado)||0,
      anticipo:parseFloat(form.anticipo)||0,
      prioridad:form.prioridad,
      fecha_estimada:form.fecha_estimada||null,
      observaciones:form.observaciones||null,
    }).then(async r=>{
      const ordenId=r.data.id
      const anticipoVal=parseFloat(form.anticipo)||0
      if(anticipoVal>0&&ordenId){
        try{
          await api.post('/servicio-tecnico/'+ordenId+'/anticipo',{
            monto:anticipoVal,forma_pago:'EFECTIVO',referencia:'Anticipo al crear orden'
          })
        }catch(e){console.error('Error registrando anticipo:',e)}
      }
      setShowModal(false)
      loadOrdenes()
      loadStats()
      alert('Orden '+r.data.numero+' creada')
    }).catch(e=>alert(e.response?.data?.detail||'Error'))
      .finally(()=>setSaving(false))
  }

  function openDetalle(id){
    api.get('/servicio-tecnico/'+id)
      .then(r=>{
        setOrdenDetalle(r.data);setView('detail')
        if(r.data.cliente_id) loadSaldoFavor(r.data.cliente_id)
        // Set warranty form from order data
        setGarantiaForm({
          dias_garantia:r.data.dias_garantia||0,
          condiciones_garantia:r.data.condiciones_garantia||''
        })
        // Reset historial
        setHistorialEquipo([]);setHistorialLoaded(false)
      })
      .catch(e=>alert(e.response?.data?.detail||'Error'))
  }

  function reloadDetalle(){
    if(!ordenDetalle)return
    api.get('/servicio-tecnico/'+ordenDetalle.id)
      .then(r=>{
        setOrdenDetalle(r.data)
        setGarantiaForm({
          dias_garantia:r.data.dias_garantia||0,
          condiciones_garantia:r.data.condiciones_garantia||''
        })
      })
      .catch(()=>{})
  }

  function cambiarEstado(id,nuevoEstado,desc,diasGar,condGar){
    const body = {estado:nuevoEstado,descripcion:desc||null}
    if(nuevoEstado==='REPARADO'){
      body.dias_garantia=diasGar||0
      body.condiciones_garantia=condGar||null
    }
    api.patch('/servicio-tecnico/'+id+'/estado',body)
      .then(r=>{
        loadOrdenes();loadStats();if(ordenDetalle&&ordenDetalle.id===id){reloadDetalle();setHistorialLoaded(false)}
        // Show notification toast
        const notif=r.data?.notificacion
        if(notif&&notif.mensaje){
          let toastMsg=`Estado: ${nuevoEstado.replace(/_/g,' ')}`
          if(notif.whatsapp_link) toastMsg+=' | WhatsApp listo'
          if(notif.email_sent) toastMsg+=' | Email enviado'
          showToast(toastMsg,'success')
          if(notif.whatsapp_link){
            setTimeout(()=>{if(confirm('Abrir WhatsApp para notificar al cliente?'))window.open(notif.whatsapp_link,'_blank')},500)
          }
        }else{
          showToast(`Estado cambiado a ${nuevoEstado.replace(/_/g,' ')}`,'success')
        }
      })
      .catch(e=>alert(e.response?.data?.detail||'Error'))
    setEstadoDropId(null)
  }

  function openEstadoChange(oid,nuevoEstado){
    if(nuevoEstado==='REPARADO'){
      setEstadoModalTarget({oid,estado:nuevoEstado})
      setEstadoModalDesc('')
      setShowEstadoModal(true)
    }else{
      const desc=prompt('Descripcion del cambio (opcional):')
      if(desc!==null)cambiarEstado(oid,nuevoEstado,desc)
    }
  }

  function confirmarEstadoModal(){
    if(!estadoModalTarget)return
    cambiarEstado(
      estadoModalTarget.oid,
      estadoModalTarget.estado,
      estadoModalDesc,
      garantiaForm.dias_garantia,
      garantiaForm.condiciones_garantia
    )
    setShowEstadoModal(false)
    setEstadoModalTarget(null)
  }

  function addSeguimiento(){
    if(!segDesc.trim())return
    api.post('/servicio-tecnico/'+ordenDetalle.id+'/seguimiento',{tipo:segTipo,descripcion:segDesc})
      .then(()=>{setSegDesc('');reloadDetalle()})
      .catch(e=>alert(e.response?.data?.detail||'Error'))
  }

  async function descargarPDF(url, nombre){
    try{
      const r = await api.get(url, {responseType:'blob'})
      const blob = new Blob([r.data], {type:'application/pdf'})
      const link = document.createElement('a')
      link.href = window.URL.createObjectURL(blob)
      link.download = nombre
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(link.href)
    }catch(e){alert('Error al descargar: '+(e.response?.status===401?'Sesión expirada, vuelva a iniciar sesión':e.message))}
  }

  function downloadPDF(){
    descargarPDF('/servicio-tecnico/'+ordenDetalle.id+'/informe', 'Informe_'+ordenDetalle.numero+'.pdf')
  }

  function downloadReciboAnticipo(){
    descargarPDF('/servicio-tecnico/'+ordenDetalle.id+'/recibo-anticipo', 'Anticipo_'+ordenDetalle.numero+'.pdf')
  }

  function downloadReciboRecepcion(){
    descargarPDF('/servicio-tecnico/'+ordenDetalle.id+'/recibo-recepcion', 'Recepcion_'+ordenDetalle.numero+'.pdf')
  }

  function registrarAnticipo(){
    const monto=parseFloat(antiForm.monto)
    if(!monto||monto<=0)return alert('Ingrese un monto valido')
    api.post('/servicio-tecnico/'+ordenDetalle.id+'/anticipo',{
      monto,forma_pago:antiForm.forma_pago,referencia:antiForm.referencia
    }).then(()=>{
      setShowAnticipo(false)
      setAntiForm({monto:'',forma_pago:'EFECTIVO',referencia:''})
      reloadDetalle()
      loadSaldoFavor(ordenDetalle.cliente_id)
    }).catch(e=>alert(e.response?.data?.detail||'Error'))
  }

  function loadSaldoFavor(clienteId){
    if(!clienteId)return
    api.get('/clientes/'+clienteId+'/saldo-favor')
      .then(r=>setSaldoFavor(r.data))
      .catch(()=>setSaldoFavor(null))
  }

  function eliminarOrden(id){
    if(!confirm('Eliminar esta orden?'))return
    api.delete('/servicio-tecnico/'+id)
      .then(()=>{loadOrdenes();loadStats();if(view==='detail')setView('list')})
      .catch(e=>alert(e.response?.data?.detail||'Error'))
  }

  // Repuestos functions
  function agregarRepuesto(){
    if(!repForm.descripcion?.trim())return alert('Descripcion del repuesto es obligatoria')
    api.post('/servicio-tecnico/'+ordenDetalle.id+'/repuestos',{
      producto_id:repForm.producto_id||null,
      descripcion:repForm.descripcion,
      cantidad:parseFloat(repForm.cantidad)||1,
      costo:parseFloat(repForm.costo)||0,
      precio:parseFloat(repForm.precio)||0,
    }).then(()=>{
      setShowRepuestoForm(false)
      setRepForm({descripcion:'',cantidad:1,costo:0,precio:0,producto_id:null})
      setProdBusq('')
      reloadDetalle()
    }).catch(e=>alert(e.response?.data?.detail||'Error'))
  }

  function eliminarRepuesto(rid){
    if(!confirm('Eliminar este repuesto?'))return
    api.delete('/servicio-tecnico/repuestos/'+rid)
      .then(()=>reloadDetalle())
      .catch(e=>alert(e.response?.data?.detail||'Error'))
  }

  // Toast helper
  function showToast(msg,type='info'){
    setToast({msg,type})
    setTimeout(()=>setToast(null),5000)
  }

  // Notification functions
  async function notificarCliente(canal,mensaje){
    try{
      const r=await api.post('/servicio-tecnico/'+ordenDetalle.id+'/notificar',null,
        {params:{canal,mensaje:mensaje||''}})
      if(canal==='WHATSAPP'&&r.data?.link){
        window.open(r.data.link,'_blank')
        showToast('Enlace WhatsApp abierto','success')
      }else if(canal==='EMAIL'){
        showToast('Email enviado correctamente','success')
      }
      setShowNotifDrop(false)
      setNotifMsg('')
      reloadDetalle()
    }catch(e){
      showToast(e.response?.data?.detail||'Error al notificar','error')
    }
  }

  // Facturar orden
  async function facturarOrden(){
    setFacturando(true)
    try{
      const r=await api.post('/servicio-tecnico/'+ordenDetalle.id+'/facturar',null,
        {params:{forma_pago:facturarFormaPago}})
      showToast(`Factura creada: ${r.data.numero_factura||''} - Saldo facturado: $${r.data.saldo_facturado?.toFixed(2)||'0.00'}`,'success')
      setShowFacturarModal(false)
      reloadDetalle()
    }catch(e){
      showToast(e.response?.data?.detail||'Error al facturar','error')
    }finally{setFacturando(false)}
  }

  // Cotizacion PDF
  function downloadCotizacionPDF(){
    descargarPDF('/servicio-tecnico/'+ordenDetalle.id+'/cotizacion-pdf', 'Cotizacion_'+ordenDetalle.numero+'.pdf')
  }

  // Historial equipo
  async function loadHistorialEquipo(){
    if(!ordenDetalle)return
    const p=new URLSearchParams()
    if(ordenDetalle.equipo_serie)p.append('serie',ordenDetalle.equipo_serie)
    if(ordenDetalle.equipo_marca)p.append('marca',ordenDetalle.equipo_marca)
    if(ordenDetalle.equipo_modelo)p.append('modelo',ordenDetalle.equipo_modelo)
    if(!ordenDetalle.equipo_serie&&!ordenDetalle.equipo_marca&&!ordenDetalle.equipo_modelo){
      p.append('cliente_id',ordenDetalle.cliente_id)
    }
    try{
      const r=await api.get('/servicio-tecnico/historial-equipo?'+p.toString())
      setHistorialEquipo((r.data||[]).filter(h=>h.id!==ordenDetalle.id))
      setHistorialLoaded(true)
    }catch(e){setHistorialEquipo([]);setHistorialLoaded(true)}
  }

  // Dashboard tecnicos
  async function loadDashTecnicos(){
    const p=new URLSearchParams()
    if(dashFechas.fecha_ini)p.append('fecha_ini',dashFechas.fecha_ini)
    if(dashFechas.fecha_fin)p.append('fecha_fin',dashFechas.fecha_fin)
    try{
      const r=await api.get('/servicio-tecnico/dashboard-tecnicos?'+p.toString())
      setDashTecnicos(r.data?.tecnicos||[])
    }catch(e){showToast('Error cargando dashboard','error')}
  }

  function selectProducto(p){
    setRepForm(prev=>({...prev,descripcion:p.nombre||p.descripcion||'',producto_id:p.id,
      precio:parseFloat(p.precio_venta||p.pvp||0),costo:parseFloat(p.costo||0)}))
    setProdBusq(p.nombre||p.descripcion||'')
    setProdResults([])
  }

  // Tecnicos management functions
  function toggleTecnico(tid){
    api.patch('/servicio-tecnico/tecnicos/'+tid+'/toggle')
      .then(()=>{loadAllTecnicos();loadTecnicos()})
      .catch(e=>alert(e.response?.data?.detail||'Error'))
  }

  // ══════════════════════════════════════════════════════════
  //  TECNICOS VIEW
  // ══════════════════════════════════════════════════════════
  if(view==='tecnicos'){
    if(allTecnicos.length===0) loadAllTecnicos()
    return(
      <div style={{padding:24,minHeight:'100vh',background:C.bg,color:C.text,overflow:'auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20,flexWrap:'wrap'}}>
          <button onClick={()=>setView('list')}
            style={{background:C.sur2,border:`1px solid ${C.bord2}`,borderRadius:8,
              color:C.text,padding:'6px 14px',cursor:'pointer',fontSize:13,fontWeight:600}}>
            &#8592; Ordenes
          </button>
          <div style={{fontSize:22,fontWeight:800}}>Tecnicos</div>
          <div style={{flex:1}}/>
          <button onClick={()=>{setShowDashTecnicos(!showDashTecnicos);if(!showDashTecnicos)loadDashTecnicos()}}
            style={{padding:'8px 16px',borderRadius:10,fontSize:13,fontWeight:700,
              background:showDashTecnicos?'rgba(245,158,11,.2)':'rgba(245,158,11,.12)',
              border:`1px solid ${showDashTecnicos?'rgba(245,158,11,.5)':'rgba(245,158,11,.3)'}`,
              color:'#F59E0B',cursor:'pointer'}}>
            Dashboard Tecnicos
          </button>
          <button onClick={()=>{setEditTecnico(null);setShowTecnicoModal(true)}}
            style={{padding:'8px 20px',borderRadius:10,fontSize:13,fontWeight:700,
              background:'linear-gradient(135deg,#3B82F6,#8B5CF6)',color:'white',
              border:'none',cursor:'pointer',boxShadow:'0 2px 8px rgba(59,130,246,.3)'}}>
            + Nuevo Tecnico
          </button>
        </div>

        {/* Dashboard Tecnicos */}
        {showDashTecnicos&&(
          <div style={{background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,padding:20,marginBottom:20}}>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16,flexWrap:'wrap'}}>
              <div style={{fontSize:15,fontWeight:800,color:'#F59E0B'}}>Rendimiento por Tecnico</div>
              <div style={{flex:1}}/>
              <input type="date" value={dashFechas.fecha_ini}
                onChange={e=>setDashFechas(p=>({...p,fecha_ini:e.target.value}))}
                style={{padding:'6px 10px',borderRadius:6,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,fontSize:12}}/>
              <input type="date" value={dashFechas.fecha_fin}
                onChange={e=>setDashFechas(p=>({...p,fecha_fin:e.target.value}))}
                style={{padding:'6px 10px',borderRadius:6,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,fontSize:12}}/>
              <button onClick={loadDashTecnicos}
                style={{padding:'6px 14px',borderRadius:6,fontSize:12,fontWeight:700,
                  background:'rgba(245,158,11,.15)',border:'1px solid rgba(245,158,11,.4)',
                  color:'#F59E0B',cursor:'pointer'}}>
                Filtrar
              </button>
            </div>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{background:C.sur2,borderBottom:`1px solid ${C.bord2}`}}>
                  {['Tecnico','Especialidad','Total','Completadas','En Proceso','Promedio Dias','Ingresos'].map(h=>(
                    <th key={h} style={{padding:'10px 12px',textAlign:h==='Ingresos'||h==='Promedio Dias'?'right':'left',
                      fontWeight:700,fontSize:11,color:C.muted,whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dashTecnicos.map(t=>(
                  <tr key={t.id} style={{borderBottom:`1px solid ${C.border}`}}>
                    <td style={{padding:'10px 12px',fontWeight:600}}>{t.nombre} {t.apellidos||''}</td>
                    <td style={{padding:'10px 12px',color:C.muted}}>{t.especialidad||'-'}</td>
                    <td style={{padding:'10px 12px',fontWeight:600}}>{t.total_ordenes}</td>
                    <td style={{padding:'10px 12px'}}>
                      <span style={{padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:700,
                        background:'rgba(16,185,129,.15)',color:'#10B981'}}>{t.completadas}</span>
                    </td>
                    <td style={{padding:'10px 12px'}}>
                      <span style={{padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:700,
                        background:'rgba(245,158,11,.15)',color:'#F59E0B'}}>{t.en_proceso}</span>
                    </td>
                    <td style={{padding:'10px 12px',textAlign:'right',fontWeight:600}}>
                      {Number(t.promedio_dias||0).toFixed(1)} dias
                    </td>
                    <td style={{padding:'10px 12px',textAlign:'right',fontWeight:700,color:'#10B981'}}>
                      {fmt$(t.ingresos)}
                    </td>
                  </tr>
                ))}
                {dashTecnicos.length===0&&(
                  <tr><td colSpan={7} style={{padding:24,textAlign:'center',color:C.hint}}>Sin datos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div style={{background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,overflow:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr style={{background:C.sur2,borderBottom:`1px solid ${C.bord2}`}}>
                {['Codigo','Nombre','Cedula','Telefono','Email','Especialidad','Estado','Acciones'].map(h=>(
                  <th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:700,fontSize:11,
                    color:C.muted,whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allTecnicos.map(t=>(
                <tr key={t.id} style={{borderBottom:`1px solid ${C.border}`}}
                  onMouseEnter={e=>e.currentTarget.style.background=C.sur2}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{padding:'10px 12px',fontWeight:600,color:C.blue}}>{t.codigo||'-'}</td>
                  <td style={{padding:'10px 12px',fontWeight:600}}>{t.nombre} {t.apellidos||''}</td>
                  <td style={{padding:'10px 12px',color:C.muted}}>{t.cedula||'-'}</td>
                  <td style={{padding:'10px 12px',color:C.muted}}>{t.telefono||'-'}</td>
                  <td style={{padding:'10px 12px',color:C.muted}}>{t.email||'-'}</td>
                  <td style={{padding:'10px 12px',color:C.muted}}>{t.especialidad||'-'}</td>
                  <td style={{padding:'10px 12px'}}>
                    <span style={{padding:'2px 8px',borderRadius:6,fontSize:10,fontWeight:700,
                      background:t.activo?'rgba(16,185,129,.15)':'rgba(239,68,68,.15)',
                      color:t.activo?'#10B981':'#EF4444',
                      border:`1px solid ${t.activo?'rgba(16,185,129,.4)':'rgba(239,68,68,.4)'}`}}>
                      {t.activo?'Activo':'Inactivo'}
                    </span>
                  </td>
                  <td style={{padding:'10px 12px'}}>
                    <div style={{display:'flex',gap:4}}>
                      <button onClick={()=>{setEditTecnico(t);setShowTecnicoModal(true)}}
                        style={{padding:'4px 8px',borderRadius:6,fontSize:10,fontWeight:600,
                          background:'rgba(59,130,246,.12)',border:'1px solid rgba(59,130,246,.3)',
                          color:'#3B82F6',cursor:'pointer'}}>
                        Editar
                      </button>
                      <button onClick={()=>toggleTecnico(t.id)}
                        style={{padding:'4px 8px',borderRadius:6,fontSize:10,fontWeight:600,
                          background:t.activo?'rgba(239,68,68,.12)':'rgba(16,185,129,.12)',
                          border:`1px solid ${t.activo?'rgba(239,68,68,.3)':'rgba(16,185,129,.3)'}`,
                          color:t.activo?'#EF4444':'#10B981',cursor:'pointer'}}>
                        {t.activo?'Desactivar':'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {allTecnicos.length===0&&(
                <tr><td colSpan={8} style={{padding:40,textAlign:'center',color:C.hint}}>
                  No hay tecnicos registrados
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {showTecnicoModal&&(
          <ModalTecnico
            tecnico={editTecnico}
            onGuardado={()=>{setShowTecnicoModal(false);loadAllTecnicos();loadTecnicos()}}
            onCancelar={()=>setShowTecnicoModal(false)}
          />
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════
  //  DETAIL VIEW
  // ══════════════════════════════════════════════════════════
  if(view==='detail'&&ordenDetalle){
    const o=ordenDetalle
    const segs=o.seguimientos||[]
    const repuestos=o.repuestos||[]
    const totalRepuestos=parseFloat(o.total_repuestos||0)
    const saldo=parseFloat(o.costo_final||0)-parseFloat(o.anticipo||0)
    const trans=TRANSICIONES[o.estado]||[]

    return(
      <div style={{padding:24,minHeight:'100vh',background:C.bg,color:C.text,overflow:'auto'}}>
        {/* Back + Header */}
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20,flexWrap:'wrap'}}>
          <button onClick={()=>{setView('list');loadOrdenes();loadStats()}}
            style={{background:C.sur2,border:`1px solid ${C.bord2}`,borderRadius:8,
              color:C.text,padding:'6px 14px',cursor:'pointer',fontSize:13,fontWeight:600}}>
            &#8592; Volver
          </button>
          <div style={{fontSize:22,fontWeight:800}}>{o.numero}</div>
          <Badge text={o.estado} colors={ESTADO_COLORS[o.estado]||ESTADO_COLORS.RECIBIDO}/>
          <Badge text={o.prioridad} colors={PRIO_COLORS[o.prioridad]||PRIO_COLORS.NORMAL}/>
          <div style={{flex:1}}/>
          {trans.length>0&&(
            <div style={{display:'flex',gap:6}}>
              {trans.map(est=>(
                <button key={est} onClick={()=>openEstadoChange(o.id,est)}
                  style={{padding:'6px 12px',borderRadius:8,fontSize:11,fontWeight:700,
                    border:`1px solid ${(ESTADO_COLORS[est]||{}).border||C.bord2}`,
                    background:(ESTADO_COLORS[est]||{}).bg||C.sur2,
                    color:(ESTADO_COLORS[est]||{}).text||C.text,cursor:'pointer'}}>
                  {est.replace(/_/g,' ')}
                </button>
              ))}
            </div>
          )}
          {/* Notificar dropdown */}
          <div style={{position:'relative'}}>
            <button onClick={()=>setShowNotifDrop(!showNotifDrop)}
              style={{padding:'6px 14px',borderRadius:8,fontSize:12,fontWeight:600,
                background:'rgba(6,182,212,.15)',border:'1px solid rgba(6,182,212,.4)',
                color:'#06B6D4',cursor:'pointer'}}>
              Notificar &#9662;
            </button>
            {showNotifDrop&&(
              <div style={{position:'absolute',top:'100%',right:0,zIndex:50,marginTop:4,
                background:C.surface,border:`1px solid ${C.bord2}`,borderRadius:10,
                boxShadow:'0 4px 16px rgba(0,0,0,.4)',width:280,padding:12}}>
                <div style={{marginBottom:8}}>
                  <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Mensaje (opcional)</label>
                  <textarea value={notifMsg} onChange={e=>setNotifMsg(e.target.value)}
                    rows={2} style={{...FI,resize:'vertical',fontSize:12}}
                    placeholder="Mensaje personalizado..."/>
                </div>
                <div style={{display:'flex',gap:6}}>
                  {o.cliente_telefono&&(
                    <button onClick={()=>notificarCliente('WHATSAPP',notifMsg)}
                      style={{flex:1,padding:'6px 10px',borderRadius:6,fontSize:11,fontWeight:700,
                        background:'rgba(16,185,129,.15)',border:'1px solid rgba(16,185,129,.4)',
                        color:'#10B981',cursor:'pointer'}}>
                      WhatsApp
                    </button>
                  )}
                  {o.cliente_email&&(
                    <button onClick={()=>notificarCliente('EMAIL',notifMsg)}
                      style={{flex:1,padding:'6px 10px',borderRadius:6,fontSize:11,fontWeight:700,
                        background:'rgba(59,130,246,.15)',border:'1px solid rgba(59,130,246,.4)',
                        color:'#3B82F6',cursor:'pointer'}}>
                      Email
                    </button>
                  )}
                </div>
                {!o.cliente_telefono&&!o.cliente_email&&(
                  <div style={{fontSize:11,color:C.hint,textAlign:'center',padding:4}}>Sin datos de contacto</div>
                )}
              </div>
            )}
          </div>
          <button onClick={downloadCotizacionPDF}
            style={{padding:'6px 14px',borderRadius:8,fontSize:12,fontWeight:600,
              background:'rgba(139,92,246,.15)',border:'1px solid rgba(139,92,246,.4)',
              color:'#8B5CF6',cursor:'pointer'}}>
            Cotizacion PDF
          </button>
          {(o.estado==='REPARADO'||o.estado==='ENTREGADO')&&(
            <button onClick={()=>setShowFacturarModal(true)}
              style={{padding:'6px 14px',borderRadius:8,fontSize:12,fontWeight:600,
                background:'rgba(245,158,11,.15)',border:'1px solid rgba(245,158,11,.4)',
                color:'#F59E0B',cursor:'pointer'}}>
              Facturar
            </button>
          )}
          <button onClick={downloadReciboRecepcion}
            style={{padding:'6px 14px',borderRadius:8,fontSize:12,fontWeight:600,
              background:'rgba(16,185,129,.15)',border:'1px solid rgba(16,185,129,.4)',
              color:'#10B981',cursor:'pointer'}}>
            Recibo Recepcion
          </button>
          <button onClick={downloadPDF}
            style={{padding:'6px 14px',borderRadius:8,fontSize:12,fontWeight:600,
              background:'rgba(59,130,246,.15)',border:'1px solid rgba(59,130,246,.4)',
              color:'#3B82F6',cursor:'pointer'}}>
            PDF Informe
          </button>
          {o.estado==='RECIBIDO'&&(
            <button onClick={()=>eliminarOrden(o.id)}
              style={{padding:'6px 14px',borderRadius:8,fontSize:12,fontWeight:600,
                background:'rgba(239,68,68,.15)',border:'1px solid rgba(239,68,68,.4)',
                color:'#EF4444',cursor:'pointer'}}>
              Eliminar
            </button>
          )}
        </div>

        {/* Dates row */}
        <div style={{display:'flex',gap:16,marginBottom:20,flexWrap:'wrap',fontSize:12,color:C.muted}}>
          <span>Ingreso: <b style={{color:C.text}}>{fmtDateTime(o.fecha_ingreso)}</b></span>
          <span>Estimada: <b style={{color:C.text}}>{fmtDate(o.fecha_estimada)}</b></span>
          <span>Cierre: <b style={{color:C.text}}>{fmtDateTime(o.fecha_cierre)}</b></span>
          {o.tecnico_nombre&&<span>Tecnico: <b style={{color:C.text}}>{o.tecnico_nombre} {o.tecnico_apellidos||''}</b></span>}
          {o.sucursal_nombre&&<span>Sucursal: <b style={{color:'#3B82F6'}}>{o.sucursal_nombre}</b></span>}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20}}>
          {/* Client card */}
          <div style={{background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,padding:16}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:10,color:C.blue}}>CLIENTE</div>
            <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>{o.cliente_nombre}</div>
            <div style={{fontSize:12,color:C.muted}}>RUC/CI: {o.cliente_ruc||'-'}</div>
            <div style={{fontSize:12,color:C.muted}}>Tel: {o.cliente_telefono||'-'}</div>
            <div style={{fontSize:12,color:C.muted}}>Email: {o.cliente_email||'-'}</div>
            <div style={{fontSize:12,color:C.muted}}>Dir: {o.cliente_direccion||'-'}</div>
          </div>

          {/* Equipment card */}
          <div style={{background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,padding:16}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:10,color:C.blue}}>EQUIPO</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,fontSize:12}}>
              <div><span style={{color:C.muted}}>Tipo:</span> {o.equipo_tipo}</div>
              <div><span style={{color:C.muted}}>Marca:</span> {o.equipo_marca}</div>
              <div><span style={{color:C.muted}}>Modelo:</span> {o.equipo_modelo}</div>
              <div><span style={{color:C.muted}}>Color:</span> {o.equipo_color||'-'}</div>
              <div><span style={{color:C.muted}}>Serie:</span> {o.equipo_serie||'-'}</div>
              <div><span style={{color:C.muted}}>Password:</span> {o.equipo_password||'-'}</div>
            </div>
            {o.accesorios&&<div style={{fontSize:12,marginTop:6}}><span style={{color:C.muted}}>Accesorios:</span> {o.accesorios}</div>}
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20}}>
          {/* Problem + Diagnostic + Solution */}
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div style={{background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,padding:16}}>
              <div style={{fontSize:13,fontWeight:700,marginBottom:8,color:'#EF4444'}}>PROBLEMA REPORTADO</div>
              <div style={{fontSize:13,lineHeight:1.5}}>{o.problema_reportado}</div>
            </div>
            {o.diagnostico&&(
              <div style={{background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,padding:16}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:8,color:'#8B5CF6'}}>DIAGNOSTICO</div>
                <div style={{fontSize:13,lineHeight:1.5}}>{o.diagnostico}</div>
              </div>
            )}
            {o.solucion&&(
              <div style={{background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,padding:16}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:8,color:'#10B981'}}>SOLUCION</div>
                <div style={{fontSize:13,lineHeight:1.5}}>{o.solucion}</div>
              </div>
            )}
          </div>

          {/* Costs card */}
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div style={{background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,padding:16}}>
              <div style={{fontSize:13,fontWeight:700,marginBottom:10,color:C.blue}}>COSTOS</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,fontSize:13}}>
                <div><span style={{color:C.muted}}>Estimado:</span></div>
                <div style={{textAlign:'right',fontWeight:600}}>{fmt$(o.costo_estimado)}</div>
                <div><span style={{color:C.muted}}>Final:</span></div>
                <div style={{textAlign:'right',fontWeight:700,fontSize:15}}>{fmt$(o.costo_final)}</div>
                <div><span style={{color:C.muted}}>Anticipo:</span></div>
                <div style={{textAlign:'right',fontWeight:600,color:'#10B981'}}>{fmt$(o.anticipo)}</div>
                {totalRepuestos>0&&(<>
                  <div><span style={{color:C.muted}}>Repuestos:</span></div>
                  <div style={{textAlign:'right',fontWeight:600,color:'#F59E0B'}}>{fmt$(totalRepuestos)}</div>
                </>)}
                {saldoFavor&&saldoFavor.total_saldo>0&&(<>
                  <div><span style={{color:C.muted}}>Saldo a favor:</span></div>
                  <div style={{textAlign:'right',fontWeight:600,color:'#06B6D4'}}>{fmt$(saldoFavor.total_saldo)}</div>
                </>)}
                <div style={{borderTop:`1px solid ${C.border}`,paddingTop:6}}><span style={{color:C.muted}}>Saldo:</span></div>
                <div style={{textAlign:'right',fontWeight:800,fontSize:16,borderTop:`1px solid ${C.border}`,paddingTop:6,
                  color:saldo>0?'#F59E0B':'#10B981'}}>{fmt$(saldo)}</div>
              </div>
              <div style={{display:'flex',gap:8,marginTop:12}}>
                <button onClick={()=>setShowAnticipo(true)}
                  style={{flex:1,padding:'6px 10px',borderRadius:8,fontSize:11,fontWeight:700,
                    background:'rgba(16,185,129,.15)',border:'1px solid rgba(16,185,129,.4)',
                    color:'#10B981',cursor:'pointer'}}>
                  Registrar Anticipo
                </button>
                <button onClick={downloadReciboAnticipo}
                  style={{flex:1,padding:'6px 10px',borderRadius:8,fontSize:11,fontWeight:700,
                    background:'rgba(59,130,246,.15)',border:'1px solid rgba(59,130,246,.4)',
                    color:'#3B82F6',cursor:'pointer'}}>
                  Imprimir Recibo
                </button>
              </div>
            </div>
            {o.observaciones&&(
              <div style={{background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,padding:16}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:8,color:C.muted}}>OBSERVACIONES</div>
                <div style={{fontSize:13,lineHeight:1.5}}>{o.observaciones}</div>
              </div>
            )}
          </div>
        </div>

        {/* ── Warranty Section (REPARADO or ENTREGADO) ── */}
        {(o.estado==='REPARADO'||o.estado==='ENTREGADO')&&(
          <div style={{background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,padding:20,marginBottom:20}}>
            <div style={{fontSize:15,fontWeight:800,marginBottom:16,color:'#10B981'}}>Garantia</div>
            <div style={{display:'grid',gridTemplateColumns:'200px 1fr',gap:16,alignItems:'start'}}>
              <div>
                <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4}}>Dias de garantia</label>
                <input type="number" value={garantiaForm.dias_garantia}
                  onChange={e=>setGarantiaForm(p=>({...p,dias_garantia:parseInt(e.target.value)||0}))}
                  style={{...FI,width:120}}
                  disabled={o.estado==='ENTREGADO'}/>
              </div>
              <div>
                <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4}}>Condiciones de garantia</label>
                <textarea value={garantiaForm.condiciones_garantia}
                  onChange={e=>setGarantiaForm(p=>({...p,condiciones_garantia:e.target.value}))}
                  rows={3} style={{...FI,resize:'vertical'}}
                  disabled={o.estado==='ENTREGADO'}
                  placeholder="Ej: La garantia cubre unicamente la reparacion realizada..."/>
              </div>
            </div>
            {o.estado==='REPARADO'&&(
              <div style={{marginTop:12}}>
                <button onClick={()=>{
                  api.patch('/servicio-tecnico/'+o.id+'/estado',{
                    estado:o.estado,
                    dias_garantia:garantiaForm.dias_garantia,
                    condiciones_garantia:garantiaForm.condiciones_garantia
                  }).then(()=>{reloadDetalle()})
                    .catch(()=>{
                      // If estado transition fails (same state), just update via a workaround
                      // Save warranty through a simple note
                    })
                }}
                  style={{padding:'6px 16px',borderRadius:8,fontSize:12,fontWeight:700,
                    background:'rgba(16,185,129,.15)',border:'1px solid rgba(16,185,129,.4)',
                    color:'#10B981',cursor:'pointer'}}>
                  Guardar Garantia
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Repuestos / Partes Usadas ── */}
        <div style={{background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,padding:20,marginBottom:20}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <div style={{fontSize:15,fontWeight:800,color:'#F59E0B'}}>Repuestos / Partes Usadas</div>
            {!['ENTREGADO','CANCELADO'].includes(o.estado)&&(
              <button onClick={()=>{setShowRepuestoForm(true);setRepForm({descripcion:'',cantidad:1,costo:0,precio:0,producto_id:null});setProdBusq('')}}
                style={{padding:'6px 14px',borderRadius:8,fontSize:12,fontWeight:700,
                  background:'rgba(245,158,11,.15)',border:'1px solid rgba(245,158,11,.4)',
                  color:'#F59E0B',cursor:'pointer'}}>
                + Agregar Repuesto
              </button>
            )}
          </div>

          {repuestos.length>0?(
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,marginBottom:12}}>
              <thead>
                <tr style={{borderBottom:`1px solid ${C.bord2}`}}>
                  {['Descripcion','Cantidad','Costo','Precio','Total',''].map(h=>(
                    <th key={h} style={{padding:'8px 10px',textAlign:h==='Descripcion'?'left':'right',fontWeight:700,fontSize:11,color:C.muted}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {repuestos.map(r=>{
                  const total=parseFloat(r.cantidad||0)*parseFloat(r.precio||0)
                  return(
                    <tr key={r.id} style={{borderBottom:`1px solid ${C.border}`}}>
                      <td style={{padding:'8px 10px'}}>{r.descripcion}{r.producto_nombre?` (${r.producto_nombre})`:''}</td>
                      <td style={{padding:'8px 10px',textAlign:'right'}}>{parseFloat(r.cantidad||0)}</td>
                      <td style={{padding:'8px 10px',textAlign:'right',color:C.muted}}>{fmt$(r.costo)}</td>
                      <td style={{padding:'8px 10px',textAlign:'right'}}>{fmt$(r.precio)}</td>
                      <td style={{padding:'8px 10px',textAlign:'right',fontWeight:600}}>{fmt$(total)}</td>
                      <td style={{padding:'8px 10px',textAlign:'right'}}>
                        {!['ENTREGADO','CANCELADO'].includes(o.estado)&&(
                          <button onClick={()=>eliminarRepuesto(r.id)}
                            style={{padding:'2px 6px',borderRadius:4,fontSize:10,fontWeight:600,
                              background:'rgba(239,68,68,.12)',border:'1px solid rgba(239,68,68,.3)',
                              color:'#EF4444',cursor:'pointer'}}>
                            X
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{borderTop:`2px solid ${C.bord2}`}}>
                  <td colSpan={4} style={{padding:'8px 10px',textAlign:'right',fontWeight:700,fontSize:13}}>Total Repuestos:</td>
                  <td style={{padding:'8px 10px',textAlign:'right',fontWeight:800,fontSize:14,color:'#F59E0B'}}>{fmt$(totalRepuestos)}</td>
                  <td/>
                </tr>
              </tfoot>
            </table>
          ):(
            <div style={{padding:20,textAlign:'center',color:C.hint,fontSize:13}}>No hay repuestos registrados</div>
          )}

          {/* Add repuesto form */}
          {showRepuestoForm&&(
            <div style={{borderTop:`1px solid ${C.bord2}`,paddingTop:16,marginTop:8}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                <div style={{position:'relative'}}>
                  <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4}}>Buscar producto (opcional)</label>
                  <input value={prodBusq} onChange={e=>{setProdBusq(e.target.value);setRepForm(p=>({...p,producto_id:null}))}}
                    placeholder="Buscar en inventario..." style={FI}/>
                  {prodResults.length>0&&(
                    <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:10,marginTop:2,
                      background:C.surface,border:`1px solid ${C.bord2}`,borderRadius:8,
                      boxShadow:'0 4px 16px rgba(0,0,0,.3)',maxHeight:180,overflow:'auto'}}>
                      {prodResults.map(p=>(
                        <div key={p.id} onClick={()=>selectProducto(p)}
                          style={{padding:'6px 10px',cursor:'pointer',fontSize:12,borderBottom:`1px solid ${C.border}`}}
                          onMouseEnter={e=>e.currentTarget.style.background=C.sur2}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          <b>{p.nombre||p.descripcion}</b> <span style={{color:C.muted}}>- {p.codigo||''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4}}>Descripcion *</label>
                  <input value={repForm.descripcion} onChange={e=>setRepForm(p=>({...p,descripcion:e.target.value}))}
                    placeholder="Descripcion del repuesto" style={FI}/>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:12}}>
                <div>
                  <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4}}>Cantidad</label>
                  <input type="number" step="0.01" value={repForm.cantidad}
                    onChange={e=>setRepForm(p=>({...p,cantidad:e.target.value}))} style={FI}/>
                </div>
                <div>
                  <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4}}>Costo</label>
                  <input type="number" step="0.01" value={repForm.costo}
                    onChange={e=>setRepForm(p=>({...p,costo:e.target.value}))} style={FI}/>
                </div>
                <div>
                  <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4}}>Precio</label>
                  <input type="number" step="0.01" value={repForm.precio}
                    onChange={e=>setRepForm(p=>({...p,precio:e.target.value}))} style={FI}/>
                </div>
              </div>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                <button onClick={()=>setShowRepuestoForm(false)}
                  style={{padding:'6px 14px',borderRadius:8,fontSize:12,fontWeight:600,
                    background:C.sur2,border:`1px solid ${C.bord2}`,color:C.text,cursor:'pointer'}}>
                  Cancelar
                </button>
                <button onClick={agregarRepuesto}
                  style={{padding:'6px 16px',borderRadius:8,fontSize:12,fontWeight:700,
                    background:'#F59E0B',color:'white',border:'none',cursor:'pointer'}}>
                  Agregar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Timeline ── */}
        <div style={{background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,padding:20,marginBottom:20}}>
          <div style={{fontSize:15,fontWeight:800,marginBottom:16}}>Historial de Seguimiento</div>

          <div style={{position:'relative',paddingLeft:24}}>
            {/* Vertical line */}
            <div style={{position:'absolute',left:7,top:0,bottom:0,width:2,background:C.bord2}}/>

            {segs.map((s,i)=>{
              const dotColor=SEG_COLORS[s.tipo]||'#3B82F6'
              const sc=ESTADO_COLORS[s.estado_nuevo]
              return(
                <div key={s.id||i} style={{position:'relative',marginBottom:16,paddingLeft:20}}>
                  {/* Dot */}
                  <div style={{position:'absolute',left:-20,top:6,width:16,height:16,borderRadius:'50%',
                    background:dotColor,border:`3px solid ${C.surface}`,boxShadow:`0 0 0 2px ${dotColor}40`,zIndex:1}}/>

                  {/* Card */}
                  <div style={{background:C.sur2,borderRadius:10,border:`1px solid ${C.bord2}`,padding:12}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                      <span style={{fontSize:11,color:C.muted,fontWeight:500}}>{fmtDateTime(s.fecha)}</span>
                      <span style={{fontSize:10,fontWeight:700,padding:'1px 6px',borderRadius:4,
                        background:dotColor+'20',color:dotColor,border:`1px solid ${dotColor}40`}}>
                        {s.tipo}
                      </span>
                      {s.estado_nuevo&&sc&&(
                        <Badge text={s.estado_nuevo} colors={sc} style={{fontSize:9}}/>
                      )}
                      {s.usuario_nombre&&(
                        <span style={{fontSize:11,color:C.hint,marginLeft:'auto'}}>{s.usuario_nombre}</span>
                      )}
                    </div>
                    <div style={{fontSize:13,lineHeight:1.5}}>{s.descripcion}</div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Add entry form */}
          <div style={{borderTop:`1px solid ${C.bord2}`,paddingTop:16,marginTop:8}}>
            <div style={{display:'flex',gap:10,alignItems:'flex-end',flexWrap:'wrap'}}>
              <div style={{width:160}}>
                <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4}}>Tipo</label>
                <select value={segTipo} onChange={e=>setSegTipo(e.target.value)} style={{...FI}}>
                  {TIPOS_SEG.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{flex:1,minWidth:200}}>
                <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4}}>Descripcion</label>
                <textarea value={segDesc} onChange={e=>setSegDesc(e.target.value)}
                  rows={2} style={{...FI,resize:'vertical'}} placeholder="Detalle del seguimiento..."/>
              </div>
              <button onClick={addSeguimiento}
                style={{padding:'8px 20px',borderRadius:8,fontSize:13,fontWeight:700,
                  background:C.blue,color:'white',border:'none',cursor:'pointer',height:38,whiteSpace:'nowrap'}}>
                Agregar
              </button>
            </div>
          </div>
        </div>

        {/* ── Historial Equipo ── */}
        <div style={{background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,padding:20,marginBottom:20}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <div style={{fontSize:15,fontWeight:800,color:'#8B5CF6'}}>Historial del Equipo</div>
            {!historialLoaded&&(
              <button onClick={loadHistorialEquipo}
                style={{padding:'6px 14px',borderRadius:8,fontSize:12,fontWeight:600,
                  background:'rgba(139,92,246,.15)',border:'1px solid rgba(139,92,246,.4)',
                  color:'#8B5CF6',cursor:'pointer'}}>
                Buscar historial
              </button>
            )}
          </div>
          {historialLoaded&&historialEquipo.length>0?(
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{borderBottom:`1px solid ${C.bord2}`}}>
                  {['Orden','Fecha','Equipo','Problema','Solucion','Estado','Costo'].map(h=>(
                    <th key={h} style={{padding:'8px 10px',textAlign:'left',fontWeight:700,fontSize:11,color:C.muted}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historialEquipo.map(h=>(
                  <tr key={h.id} style={{borderBottom:`1px solid ${C.border}`,cursor:'pointer'}}
                    onClick={()=>openDetalle(h.id)}
                    onMouseEnter={e=>e.currentTarget.style.background=C.sur2}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{padding:'8px 10px',fontWeight:600,color:C.blue}}>{h.numero}</td>
                    <td style={{padding:'8px 10px',color:C.muted}}>{fmtDate(h.fecha_ingreso)}</td>
                    <td style={{padding:'8px 10px'}}>{h.equipo_marca} {h.equipo_modelo}</td>
                    <td style={{padding:'8px 10px',color:C.muted,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{truncate(h.problema_reportado,40)}</td>
                    <td style={{padding:'8px 10px',color:C.muted,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{truncate(h.solucion,40)}</td>
                    <td style={{padding:'8px 10px'}}><Badge text={h.estado} colors={ESTADO_COLORS[h.estado]||ESTADO_COLORS.RECIBIDO}/></td>
                    <td style={{padding:'8px 10px',fontWeight:600}}>{fmt$(h.costo_final)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ):historialLoaded?(
            <div style={{padding:16,textAlign:'center',color:C.hint,fontSize:13}}>No hay ordenes anteriores para este equipo</div>
          ):null}
        </div>

        {/* ── Modal Facturar ── */}
        {showFacturarModal&&(
          <div style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,.6)',
            display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
            onClick={()=>setShowFacturarModal(false)}>
            <div style={{background:C.surface,borderRadius:16,border:`1px solid ${C.border}`,
              width:'100%',maxWidth:400,padding:24}}
              onClick={e=>e.stopPropagation()}>
              <div style={{fontSize:16,fontWeight:800,marginBottom:16}}>Facturar Orden</div>
              <div style={{marginBottom:12,fontSize:13,color:C.muted}}>
                <div>Costo: <b style={{color:C.text}}>{fmt$(o.costo_final||o.costo_estimado)}</b></div>
                <div>Anticipo: <b style={{color:'#10B981'}}>{fmt$(o.anticipo)}</b></div>
                <div style={{borderTop:`1px solid ${C.border}`,paddingTop:8,marginTop:8}}>
                  Saldo a facturar: <b style={{color:'#F59E0B',fontSize:16}}>{fmt$(Math.max(0,parseFloat(o.costo_final||o.costo_estimado||0)-parseFloat(o.anticipo||0)))}</b>
                </div>
              </div>
              <div style={{marginBottom:16}}>
                <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Forma de Pago</label>
                <select value={facturarFormaPago} onChange={e=>setFacturarFormaPago(e.target.value)} style={FI}>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="TARJETA">Tarjeta</option>
                  <option value="DEPOSITO">Deposito</option>
                </select>
              </div>
              <div style={{display:'flex',justifyContent:'flex-end',gap:10}}>
                <button onClick={()=>setShowFacturarModal(false)}
                  style={{padding:'8px 16px',borderRadius:8,fontSize:13,fontWeight:600,
                    background:C.sur2,border:`1px solid ${C.bord2}`,color:C.text,cursor:'pointer'}}>
                  Cancelar
                </button>
                <button onClick={facturarOrden} disabled={facturando}
                  style={{padding:'8px 20px',borderRadius:8,fontSize:13,fontWeight:700,
                    background:'#F59E0B',color:'white',border:'none',cursor:'pointer',opacity:facturando?.6:1}}>
                  {facturando?'Facturando...':'Crear Factura'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal Registrar Anticipo ── */}
        {showAnticipo&&(
          <div style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,.6)',
            display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
            onClick={()=>setShowAnticipo(false)}>
            <div style={{background:C.surface,borderRadius:16,border:`1px solid ${C.border}`,
              width:'100%',maxWidth:400,padding:24}}
              onClick={e=>e.stopPropagation()}>
              <div style={{fontSize:16,fontWeight:800,marginBottom:16}}>Registrar Anticipo</div>
              <div style={{marginBottom:12}}>
                <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Monto *</label>
                <input type="number" step="0.01" value={antiForm.monto}
                  onChange={e=>setAntiForm(p=>({...p,monto:e.target.value}))}
                  placeholder="0.00" style={{...FI,fontSize:18,fontWeight:700,textAlign:'right'}}/>
              </div>
              <div style={{marginBottom:12}}>
                <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Forma de Pago</label>
                <select value={antiForm.forma_pago} onChange={e=>setAntiForm(p=>({...p,forma_pago:e.target.value}))} style={FI}>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="TARJETA">Tarjeta</option>
                  <option value="DEPOSITO">Deposito</option>
                </select>
              </div>
              <div style={{marginBottom:16}}>
                <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Referencia</label>
                <input value={antiForm.referencia} onChange={e=>setAntiForm(p=>({...p,referencia:e.target.value}))}
                  placeholder="N. comprobante, nota..." style={FI}/>
              </div>
              <div style={{display:'flex',justifyContent:'flex-end',gap:10}}>
                <button onClick={()=>setShowAnticipo(false)}
                  style={{padding:'8px 16px',borderRadius:8,fontSize:13,fontWeight:600,
                    background:C.sur2,border:`1px solid ${C.bord2}`,color:C.text,cursor:'pointer'}}>
                  Cancelar
                </button>
                <button onClick={registrarAnticipo}
                  style={{padding:'8px 20px',borderRadius:8,fontSize:13,fontWeight:700,
                    background:'#10B981',color:'white',border:'none',cursor:'pointer'}}>
                  Registrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal Estado REPARADO con Garantia ── */}
        {showEstadoModal&&(
          <div style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,.6)',
            display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
            onClick={()=>setShowEstadoModal(false)}>
            <div style={{background:C.surface,borderRadius:16,border:`1px solid ${C.border}`,
              width:'100%',maxWidth:480,padding:24}}
              onClick={e=>e.stopPropagation()}>
              <div style={{fontSize:16,fontWeight:800,marginBottom:16}}>Marcar como REPARADO</div>
              <div style={{marginBottom:12}}>
                <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Descripcion (opcional)</label>
                <textarea value={estadoModalDesc} onChange={e=>setEstadoModalDesc(e.target.value)}
                  rows={2} style={{...FI,resize:'vertical'}} placeholder="Descripcion del cambio..."/>
              </div>
              <div style={{fontSize:13,fontWeight:700,color:'#10B981',marginBottom:12,marginTop:16}}>Garantia</div>
              <div style={{display:'grid',gridTemplateColumns:'150px 1fr',gap:12}}>
                <div>
                  <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Dias de garantia</label>
                  <input type="number" value={garantiaForm.dias_garantia}
                    onChange={e=>setGarantiaForm(p=>({...p,dias_garantia:parseInt(e.target.value)||0}))}
                    style={FI}/>
                </div>
                <div>
                  <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Condiciones</label>
                  <textarea value={garantiaForm.condiciones_garantia}
                    onChange={e=>setGarantiaForm(p=>({...p,condiciones_garantia:e.target.value}))}
                    rows={2} style={{...FI,resize:'vertical'}}
                    placeholder="Condiciones de la garantia..."/>
                </div>
              </div>
              <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:16}}>
                <button onClick={()=>setShowEstadoModal(false)}
                  style={{padding:'8px 16px',borderRadius:8,fontSize:13,fontWeight:600,
                    background:C.sur2,border:`1px solid ${C.bord2}`,color:C.text,cursor:'pointer'}}>
                  Cancelar
                </button>
                <button onClick={confirmarEstadoModal}
                  style={{padding:'8px 20px',borderRadius:8,fontSize:13,fontWeight:700,
                    background:'#10B981',color:'white',border:'none',cursor:'pointer'}}>
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Close notif dropdown on click outside */}
        {showNotifDrop&&(
          <div style={{position:'fixed',inset:0,zIndex:40}} onClick={()=>setShowNotifDrop(false)}/>
        )}

        {/* Toast notification */}
        {toast&&(
          <div style={{position:'fixed',bottom:24,right:24,zIndex:9999,padding:'12px 20px',borderRadius:10,
            background:toast.type==='success'?'rgba(16,185,129,.95)':toast.type==='error'?'rgba(239,68,68,.95)':'rgba(59,130,246,.95)',
            color:'white',fontSize:13,fontWeight:600,boxShadow:'0 4px 16px rgba(0,0,0,.3)',
            maxWidth:400,cursor:'pointer'}}
            onClick={()=>setToast(null)}>
            {toast.msg}
          </div>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════
  //  LIST VIEW
  // ══════════════════════════════════════════════════════════
  const st=stats.por_estado||{}
  return(
    <div style={{padding:24,minHeight:'100vh',background:C.bg,color:C.text}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <div style={{fontSize:22,fontWeight:800}}>Servicio Tecnico</div>
          <div style={{display:'flex',gap:4}}>
            <button onClick={()=>setView('list')}
              style={{padding:'6px 14px',borderRadius:8,fontSize:12,fontWeight:700,
                background:view==='list'?'rgba(59,130,246,.2)':'transparent',
                border:`1px solid ${view==='list'?'rgba(59,130,246,.4)':C.bord2}`,
                color:view==='list'?'#3B82F6':C.muted,cursor:'pointer'}}>
              Ordenes
            </button>
            <button onClick={()=>{setView('tecnicos');loadAllTecnicos()}}
              style={{padding:'6px 14px',borderRadius:8,fontSize:12,fontWeight:700,
                background:view==='tecnicos'?'rgba(139,92,246,.2)':'transparent',
                border:`1px solid ${view==='tecnicos'?'rgba(139,92,246,.4)':C.bord2}`,
                color:view==='tecnicos'?'#8B5CF6':C.muted,cursor:'pointer'}}>
              Tecnicos
            </button>
          </div>
        </div>
        <button onClick={openNueva}
          style={{padding:'8px 20px',borderRadius:10,fontSize:13,fontWeight:700,
            background:'linear-gradient(135deg,#3B82F6,#8B5CF6)',color:'white',
            border:'none',cursor:'pointer',boxShadow:'0 2px 8px rgba(59,130,246,.3)'}}>
          + Nueva Orden
        </button>
      </div>

      {/* Stats cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:20}}>
        {[
          {label:'Total',value:stats.total||0,color:'#3B82F6',bg:'rgba(59,130,246,.12)'},
          {label:'Recibidos',value:st.RECIBIDO||0,color:'#9CA3AF',bg:'rgba(107,114,128,.12)'},
          {label:'En Reparacion',value:st.EN_REPARACION||0,color:'#F59E0B',bg:'rgba(245,158,11,.12)'},
          {label:'Reparados',value:st.REPARADO||0,color:'#10B981',bg:'rgba(16,185,129,.12)'},
          {label:'Por Entregar',value:(st.REPARADO||0),color:'#06B6D4',bg:'rgba(6,182,212,.12)'},
        ].map((s,i)=>(
          <div key={i} style={{background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,
            padding:16,textAlign:'center'}}>
            <div style={{fontSize:24,fontWeight:800,color:s.color}}>{s.value}</div>
            <div style={{fontSize:11,color:C.muted,fontWeight:600,marginTop:4}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Stats por sucursal */}
      {(stats.por_sucursal||[]).length>1&&(
        <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
          {(stats.por_sucursal||[]).map((s,i)=>(
            <div key={i} style={{padding:'8px 14px',borderRadius:8,
              background:C.surface,border:`1px solid ${C.border}`,
              display:'flex',alignItems:'center',gap:8,fontSize:12}}>
              <span style={{fontWeight:700,color:C.text}}>{s.sucursal||'Sin sucursal'}</span>
              <span style={{padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:700,
                background:'rgba(59,130,246,.12)',color:'#3B82F6'}}>{s.total}</span>
              {s.pendientes>0&&(
                <span style={{padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:700,
                  background:'rgba(245,158,11,.12)',color:'#F59E0B'}}>{s.pendientes} pend.</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
        <input value={filtros.busqueda} onChange={e=>setFiltros(p=>({...p,busqueda:e.target.value}))}
          placeholder="Buscar por N, cliente, equipo..."
          style={{...FI,width:280}}/>
        <select value={filtros.estado} onChange={e=>setFiltros(p=>({...p,estado:e.target.value}))}
          style={{...FI,width:170}}>
          <option value="">Todos los estados</option>
          {ESTADOS.map(e=><option key={e} value={e}>{e.replace(/_/g,' ')}</option>)}
        </select>
        <select value={filtros.prioridad} onChange={e=>setFiltros(p=>({...p,prioridad:e.target.value}))}
          style={{...FI,width:150}}>
          <option value="">Toda prioridad</option>
          {PRIORIDADES.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        {sucursales.length>1&&(
          <select value={filtros.sucursal_id} onChange={e=>setFiltros(p=>({...p,sucursal_id:e.target.value}))}
            style={{...FI,width:170}}>
            <option value="">Todas sucursales</option>
            {sucursales.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      <div style={{background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,overflow:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead>
            <tr style={{background:C.sur2,borderBottom:`1px solid ${C.bord2}`}}>
              {['N. Orden','Fecha','Cliente','Equipo','Problema','Tecnico','Sucursal','Estado','Prioridad','Acciones'].map(h=>(
                <th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:700,fontSize:11,
                  color:C.muted,whiteSpace:'nowrap'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordenes.map(o=>(
              <tr key={o.id} style={{borderBottom:`1px solid ${C.border}`,cursor:'pointer'}}
                onMouseEnter={e=>e.currentTarget.style.background=C.sur2}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                onClick={()=>openDetalle(o.id)}>
                <td style={{padding:'10px 12px',fontWeight:700,color:C.blue,whiteSpace:'nowrap'}}>{o.numero}</td>
                <td style={{padding:'10px 12px',whiteSpace:'nowrap',color:C.muted}}>{fmtDate(o.fecha_ingreso)}</td>
                <td style={{padding:'10px 12px',fontWeight:600,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {o.cliente_nombre}
                </td>
                <td style={{padding:'10px 12px',color:C.muted,whiteSpace:'nowrap'}}>
                  {o.equipo_tipo} {o.equipo_marca} {o.equipo_modelo}
                </td>
                <td style={{padding:'10px 12px',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:C.muted}}>
                  {truncate(o.problema_reportado,35)}
                </td>
                <td style={{padding:'10px 12px',whiteSpace:'nowrap'}}>{o.tecnico_nombre||'-'}</td>
                <td style={{padding:'10px 12px',fontSize:11,color:C.muted}}>{o.sucursal_nombre||'-'}</td>
                <td style={{padding:'10px 12px'}}>
                  <Badge text={o.estado} colors={ESTADO_COLORS[o.estado]||ESTADO_COLORS.RECIBIDO}/>
                </td>
                <td style={{padding:'10px 12px'}}>
                  <Badge text={o.prioridad} colors={PRIO_COLORS[o.prioridad]||PRIO_COLORS.NORMAL}/>
                </td>
                <td style={{padding:'10px 12px'}} onClick={e=>e.stopPropagation()}>
                  <div style={{display:'flex',gap:4,position:'relative'}}>
                    <button onClick={()=>openDetalle(o.id)}
                      style={{padding:'4px 8px',borderRadius:6,fontSize:10,fontWeight:600,
                        background:'rgba(59,130,246,.12)',border:'1px solid rgba(59,130,246,.3)',
                        color:'#3B82F6',cursor:'pointer'}}>
                      Ver
                    </button>
                    {(TRANSICIONES[o.estado]||[]).length>0&&(
                      <div style={{position:'relative'}}>
                        <button onClick={()=>setEstadoDropId(estadoDropId===o.id?null:o.id)}
                          style={{padding:'4px 8px',borderRadius:6,fontSize:10,fontWeight:600,
                            background:'rgba(245,158,11,.12)',border:'1px solid rgba(245,158,11,.3)',
                            color:'#F59E0B',cursor:'pointer'}}>
                          Estado &#9662;
                        </button>
                        {estadoDropId===o.id&&(
                          <div style={{position:'absolute',top:'100%',right:0,zIndex:50,marginTop:4,
                            background:C.surface,border:`1px solid ${C.bord2}`,borderRadius:8,
                            boxShadow:'0 4px 16px rgba(0,0,0,.3)',minWidth:140,padding:4}}>
                            {(TRANSICIONES[o.estado]||[]).map(est=>(
                              <button key={est} onClick={()=>{
                                if(est==='REPARADO'){
                                  openDetalle(o.id)
                                  setTimeout(()=>openEstadoChange(o.id,est),500)
                                }else{
                                  const desc=prompt('Descripcion (opcional):')
                                  if(desc!==null)cambiarEstado(o.id,est,desc)
                                }
                              }}
                                style={{display:'block',width:'100%',padding:'6px 10px',borderRadius:6,
                                  fontSize:11,fontWeight:600,border:'none',textAlign:'left',cursor:'pointer',
                                  background:'transparent',color:(ESTADO_COLORS[est]||{}).text||C.text}}
                                onMouseEnter={e=>e.currentTarget.style.background=C.sur2}
                                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                {est.replace(/_/g,' ')}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {ordenes.length===0&&!loading&&(
              <tr><td colSpan={9} style={{padding:40,textAlign:'center',color:C.hint}}>
                No hay ordenes de servicio
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Click outside to close estado dropdown */}
      {estadoDropId&&(
        <div style={{position:'fixed',inset:0,zIndex:40}} onClick={()=>setEstadoDropId(null)}/>
      )}

      {/* ══════ Modal Nueva Orden ══════ */}
      {showModal&&(
        <div style={{position:'fixed',inset:0,zIndex:100,background:'rgba(0,0,0,.6)',
          display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
          onClick={()=>setShowModal(false)}>
          <div style={{background:C.surface,borderRadius:16,border:`1px solid ${C.border}`,
            width:'100%',maxWidth:720,maxHeight:'95vh',overflowY:'auto',padding:24,position:'relative'}}
            onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,marginBottom:20}}>Nueva Orden de Servicio</div>

            {/* Client search */}
            {showNuevoCliente&&<ModalNuevoCliente onGuardado={c=>{selectCliente(c);setShowNuevoCliente(false)}} onCancelar={()=>setShowNuevoCliente(false)}/>}
            <div style={{marginBottom:cliResults.length>0&&!cliSelected?200:16,position:'relative',zIndex:50}}>
              <label style={{fontSize:12,fontWeight:600,color:C.muted,display:'block',marginBottom:4}}>Cliente *</label>
              <div style={{display:'flex',gap:8}}>
                <div style={{position:'relative',flex:1}}>
                  <input ref={cliRef} value={cliBusq} onChange={e=>{setCliBusq(e.target.value);setCliSelected(null)}}
                    placeholder="Buscar cliente por nombre o RUC..."
                    style={{...FI,borderColor:cliSelected?'#10B981':C.bord2}}/>
                  {cliResults.length>0&&!cliSelected&&(
                    <div style={{position:'absolute',top:'calc(100% + 2px)',left:0,right:0,zIndex:99999,
                      background:C.surface,border:`1px solid ${C.bord2}`,borderRadius:8,
                      boxShadow:'0 8px 30px rgba(0,0,0,.7)',maxHeight:220,overflowY:'auto'}}>
                      {cliResults.map(c=>(
                        <div key={c.id} onClick={()=>selectCliente(c)}
                          style={{padding:'10px 14px',cursor:'pointer',fontSize:13,borderBottom:`1px solid ${C.border}`}}
                          onMouseEnter={e=>e.currentTarget.style.background=C.sur2}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          <div style={{fontWeight:700,color:C.text}}>{c.razon_social}</div>
                          <div style={{fontSize:11,color:C.muted}}>{c.tipo_identificacion} {c.identificacion}{c.telefono?` · ${c.telefono}`:''}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={()=>setShowNuevoCliente(true)}
                  style={{padding:'8px 14px',borderRadius:8,border:`1px solid ${C.blue}`,
                    background:'rgba(59,130,246,.15)',color:C.blue,cursor:'pointer',
                    fontSize:12,fontWeight:700,whiteSpace:'nowrap',flexShrink:0}}>
                  + Nuevo
                </button>
              </div>
            </div>

            {/* Equipment section */}
            <div style={{fontSize:13,fontWeight:700,color:C.blue,marginBottom:10}}>Datos del Equipo</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:12}}>
              <div>
                <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Tipo</label>
                <select value={form.equipo_tipo} onChange={e=>setForm(p=>({...p,equipo_tipo:e.target.value}))} style={FI}>
                  {TIPOS_EQUIPO.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Marca</label>
                <input value={form.equipo_marca} onChange={e=>setForm(p=>({...p,equipo_marca:e.target.value}))}
                  placeholder="Samsung, Apple..." style={FI}/>
              </div>
              <div>
                <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Modelo</label>
                <input value={form.equipo_modelo} onChange={e=>setForm(p=>({...p,equipo_modelo:e.target.value}))}
                  placeholder="Galaxy S24..." style={FI}/>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:12}}>
              <div>
                <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>N. Serie</label>
                <input value={form.equipo_serie} onChange={e=>setForm(p=>({...p,equipo_serie:e.target.value}))}
                  style={FI}/>
              </div>
              <div>
                <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Color</label>
                <input value={form.equipo_color} onChange={e=>setForm(p=>({...p,equipo_color:e.target.value}))}
                  style={FI}/>
              </div>
              <div>
                <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Password del equipo</label>
                <input value={form.equipo_password} onChange={e=>setForm(p=>({...p,equipo_password:e.target.value}))}
                  style={FI}/>
              </div>
            </div>

            <div style={{marginBottom:12}}>
              <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Accesorios</label>
              <textarea value={form.accesorios} onChange={e=>setForm(p=>({...p,accesorios:e.target.value}))}
                rows={2} style={{...FI,resize:'vertical'}} placeholder="Cargador, funda, audifonos..."/>
            </div>

            {/* Problem */}
            <div style={{marginBottom:12}}>
              <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Problema Reportado *</label>
              <textarea value={form.problema_reportado} onChange={e=>setForm(p=>({...p,problema_reportado:e.target.value}))}
                rows={3} style={{...FI,resize:'vertical',borderColor:!form.problema_reportado.trim()?'#EF4444':C.bord2}}
                placeholder="Descripcion detallada del problema..."/>
            </div>

            {/* Costs + Priority row */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:10,marginBottom:12}}>
              <div>
                <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Costo Estimado</label>
                <input type="number" step="0.01" value={form.costo_estimado}
                  onChange={e=>setForm(p=>({...p,costo_estimado:e.target.value}))} style={FI}/>
              </div>
              <div>
                <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Anticipo</label>
                <input type="number" step="0.01" value={form.anticipo}
                  onChange={e=>setForm(p=>({...p,anticipo:e.target.value}))} style={FI}/>
              </div>
              <div>
                <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Prioridad</label>
                <select value={form.prioridad} onChange={e=>setForm(p=>({...p,prioridad:e.target.value}))} style={FI}>
                  {PRIORIDADES.map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Fecha Estimada</label>
                <input type="date" value={form.fecha_estimada}
                  onChange={e=>setForm(p=>({...p,fecha_estimada:e.target.value}))} style={FI}/>
              </div>
            </div>

            {/* Technician */}
            <div style={{marginBottom:12}}>
              <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Tecnico Asignado</label>
              <select value={form.tecnico_id} onChange={e=>setForm(p=>({...p,tecnico_id:e.target.value}))} style={FI}>
                <option value="">Sin asignar</option>
                {tecnicos.map(t=><option key={t.id} value={t.id}>{t.nombre} {t.apellidos||''}</option>)}
              </select>
            </div>

            {/* Observations */}
            <div style={{marginBottom:20}}>
              <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Observaciones</label>
              <textarea value={form.observaciones} onChange={e=>setForm(p=>({...p,observaciones:e.target.value}))}
                rows={2} style={{...FI,resize:'vertical'}}/>
            </div>

            {/* Actions */}
            <div style={{display:'flex',justifyContent:'flex-end',gap:10}}>
              <button onClick={()=>setShowModal(false)}
                style={{padding:'8px 20px',borderRadius:8,fontSize:13,fontWeight:600,
                  background:C.sur2,border:`1px solid ${C.bord2}`,color:C.text,cursor:'pointer'}}>
                Cancelar
              </button>
              <button onClick={guardarOrden} disabled={saving}
                style={{padding:'8px 24px',borderRadius:8,fontSize:13,fontWeight:700,
                  background:'linear-gradient(135deg,#3B82F6,#8B5CF6)',color:'white',
                  border:'none',cursor:'pointer',opacity:saving?.6:1}}>
                {saving?'Guardando...':'Crear Orden'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast&&(
        <div style={{position:'fixed',bottom:24,right:24,zIndex:9999,padding:'12px 20px',borderRadius:10,
          background:toast.type==='success'?'rgba(16,185,129,.95)':toast.type==='error'?'rgba(239,68,68,.95)':'rgba(59,130,246,.95)',
          color:'white',fontSize:13,fontWeight:600,boxShadow:'0 4px 16px rgba(0,0,0,.3)',
          maxWidth:400,cursor:'pointer'}}
          onClick={()=>setToast(null)}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
