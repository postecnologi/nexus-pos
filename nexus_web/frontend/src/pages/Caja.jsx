// ============================================================
//  NEXUS POS — Módulo de Caja
// ============================================================
import { useState, useEffect } from 'react'
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

const BILLETES = [
  {k:'billetes_100', label:'$100', val:100},
  {k:'billetes_50',  label:'$50',  val:50},
  {k:'billetes_20',  label:'$20',  val:20},
  {k:'billetes_10',  label:'$10',  val:10},
  {k:'billetes_5',   label:'$5',   val:5},
  {k:'billetes_1',   label:'$1',   val:1},
]
const MONEDAS = [
  {k:'monedas_100', label:'$1.00',  val:1.00},
  {k:'monedas_50',  label:'$0.50',  val:0.50},
  {k:'monedas_25',  label:'$0.25',  val:0.25},
  {k:'monedas_10',  label:'$0.10',  val:0.10},
  {k:'monedas_5',   label:'$0.05',  val:0.05},
  {k:'monedas_1',   label:'$0.01',  val:0.01},
]

const BLANK_ARQUEO = {
  billetes_100:0, billetes_50:0, billetes_20:0,
  billetes_10:0,  billetes_5:0,  billetes_1:0,
  monedas_100:0,  monedas_50:0,  monedas_25:0,
  monedas_10:0,   monedas_5:0,   monedas_1:0,
}

// ── Vista de sesión activa ────────────────────────────────────
function SesionActiva({caja, sesionId, onCerrada}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [arqueo,     setArqueo]     = useState(BLANK_ARQUEO)
  const [arqueoExtra, setArqueoExtra] = useState({
    tarjeta_contado:0, transferencia_contado:0,
    medianet_contado:0, deuna_contado:0,
  })
  const [concepto,   setConcepto]   = useState('')
  const [montoMov,   setMontoMov]   = useState('')
  const [tipoMov,    setTipoMov]    = useState('EGRESO')
  const [obsClose,   setObsClose]   = useState('')
  const [modo,       setModo]       = useState('resumen') // resumen|arqueo|movimiento
  const [saving,     setSaving]     = useState(false)
  const [resultado,  setResultado]  = useState(null)

  async function cargar() {
    try {
      const{data}=await api.get('/caja/sesion-activa',{params:{caja_id:caja.id}})
      setData(data)
    }catch(e){console.error(e)}finally{setLoading(false)}
  }

  useEffect(()=>{ cargar() },[])

  const totalContado = [
    ...BILLETES.map(b=>arqueo[b.k]*b.val),
    ...MONEDAS.map(m=>arqueo[m.k]*m.val),
  ].reduce((a,v)=>a+v,0)

  async function registrarMovimiento() {
    if(!concepto||!montoMov) return
    await api.post('/caja/movimiento',{
      sesion_id: sesionId,
      tipo:      tipoMov,
      concepto,
      monto:     parseFloat(montoMov),
    })
    setConcepto(''); setMontoMov(''); cargar()
  }

  async function cerrar() {
    setSaving(true)
    try {
      const{data}=await api.post('/caja/cerrar',{
        sesion_id: sesionId,
        ...arqueo,
        observaciones: obsClose,
      })
      setResultado(data)
    }catch(e){alert(e.response?.data?.detail||e.message)}
    finally{setSaving(false)}
  }

  if(loading) return(
    <div style={{padding:40,textAlign:'center',color:C.hint}}>Cargando sesión...</div>
  )
  if(resultado) return(
    <ResultadoCierre resultado={resultado} caja={caja} onAceptar={onCerrada}/>
  )
  if(!data) return null

  const ef_sis = Number(data.ventas?.efectivo||0) +
                 Number(data.cxc_cobrado||0) -
                 Number(data.egresos||0) +
                 Number(data.monto_apertura||0)

  return(
    <div style={{background:C.surface,borderRadius:14,border:`1px solid ${C.bord2}`,overflow:'hidden'}}>
      {/* Header sesión */}
      <div style={{background:'linear-gradient(135deg,#0f2035,#0a1628)',
        padding:'16px 20px',borderBottom:`1px solid ${C.bord2}`}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:C.text}}>
              🏦 {caja.nombre}
              <span style={{marginLeft:10,fontSize:12,padding:'2px 10px',
                borderRadius:20,background:C.greenD,color:C.green,fontWeight:700}}>
                ABIERTA
              </span>
            </div>
            <div style={{fontSize:12,color:C.muted,marginTop:3}}>
              Apertura: {new Date(data.fecha_apertura).toLocaleString('es-EC')}
              {' · '}Monto inicial: {fmt$(data.monto_apertura)}
            </div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:11,color:C.hint}}>EFECTIVO EN SISTEMA</div>
            <div style={{fontSize:24,fontWeight:900,color:C.green}}>{fmt$(ef_sis)}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',borderBottom:`1px solid ${C.bord2}`}}>
        {[
          {v:'resumen',   l:'📊 Resumen'},
          {v:'movimiento',l:'💵 Movimiento'},
          {v:'arqueo',    l:'🔢 Arqueo y cierre'},
        ].map(({v,l})=>(
          <button key={v} onClick={()=>setModo(v)}
            style={{flex:1,padding:'12px 8px',border:'none',cursor:'pointer',
              fontSize:13,fontWeight:600,
              background:modo===v?C.sur2:'transparent',
              color:modo===v?C.text:C.hint,
              borderBottom:modo===v?`2px solid ${C.blue}`:'2px solid transparent'}}>
            {l}
          </button>
        ))}
      </div>

      <div style={{padding:20}}>
        {/* ── RESUMEN ── */}
        {modo==='resumen'&&(
          <div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}}>
              {[
                {l:'Ventas del día',    v:data.ventas?.total_ventas,    c:C.green,  e:'🛒'},
                {l:'Facturas emitidas', v:data.ventas?.num_facturas,    c:C.blue,   e:'🧾', noFmt:true},
                {l:'Abonos CXC',       v:data.cxc_cobrado,              c:C.cyan,   e:'💳'},
                {l:'Efectivo ventas',  v:data.ventas?.efectivo,         c:C.green,  e:'💵'},
                {l:'Tarjeta',          v:data.ventas?.tarjeta,          c:C.purple, e:'💳'},
                {l:'Transferencia',    v:data.ventas?.transferencia,    c:C.amber,  e:'🏦'},
                {l:'Medianet/DeUna',   v:Number(data.ventas?.medianet||0)+Number(data.ventas?.deuna||0), c:C.cyan, e:'📱'},
                {l:'Crédito',          v:data.ventas?.credito,          c:C.red,    e:'📋'},
                {l:'Egresos',          v:data.egresos,                  c:C.red,    e:'⬇️'},
              ].map((k,i)=>(
                <div key={i} style={{background:C.sur2,borderRadius:10,
                  padding:'12px 14px',border:`1px solid ${C.bord2}`}}>
                  <div style={{fontSize:10,color:C.hint,fontWeight:600,
                    textTransform:'uppercase'}}>{k.e} {k.l}</div>
                  <div style={{fontSize:18,fontWeight:800,color:k.c,marginTop:5}}>
                    {k.noFmt?k.v:fmt$(k.v)}
                  </div>
                </div>
              ))}
            </div>

            {/* Movimientos del día */}
            {data.movimientos?.length>0&&(
              <div>
                <div style={{fontSize:11,fontWeight:700,color:C.hint,
                  textTransform:'uppercase',marginBottom:8}}>Movimientos</div>
                {data.movimientos.map((m,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',
                    alignItems:'center',padding:'8px 12px',borderRadius:8,
                    marginBottom:5,background:C.sur2,border:`1px solid ${C.bord2}`}}>
                    <div>
                      <span style={{fontSize:12,fontWeight:600,
                        color:m.tipo==='EGRESO'?C.red:C.green}}>
                        {m.tipo==='EGRESO'?'↓':'↑'} {m.concepto}
                      </span>
                      <span style={{marginLeft:8,fontSize:11,color:C.hint}}>
                        {new Date(m.fecha).toLocaleTimeString('es-EC')}
                      </span>
                    </div>
                    <span style={{fontWeight:700,
                      color:m.tipo==='EGRESO'?C.red:C.green}}>
                      {(m.tipo==='EGRESO' ? '-' : '+') + fmt$(m.monto)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── MOVIMIENTO ── */}
        {modo==='movimiento'&&(
          <div style={{maxWidth:400}}>
            <div style={{display:'flex',gap:8,marginBottom:14}}>
              {[['EGRESO','Egreso'],['INGRESO','Ingreso']].map(([v,l])=>(
                <button key={v} onClick={()=>setTipoMov(v)}
                  style={{flex:1,padding:'10px',borderRadius:9,cursor:'pointer',
                    border:`1.5px solid ${tipoMov===v?(v==='EGRESO'?C.red:C.green):C.bord2}`,
                    background:tipoMov===v?(v==='EGRESO'?C.redD:C.greenD):'transparent',
                    color:tipoMov===v?(v==='EGRESO'?C.red:C.green):C.muted,
                    fontWeight:700,fontSize:14}}>
                  {v==='EGRESO'?'↓':'↑'} {l}
                </button>
              ))}
            </div>
            <div style={{marginBottom:10}}>
              <label style={{fontSize:11,color:C.muted,display:'block',
                marginBottom:4,fontWeight:600,textTransform:'uppercase'}}>Concepto *</label>
              <input value={concepto} onChange={e=>setConcepto(e.target.value)}
                placeholder="Ej: Pago proveedor, gastos limpieza..."
                style={FI}/>
            </div>
            <div style={{marginBottom:16}}>
              <label style={{fontSize:11,color:C.muted,display:'block',
                marginBottom:4,fontWeight:600,textTransform:'uppercase'}}>Monto *</label>
              <input type="number" step="0.01" value={montoMov}
                onChange={e=>setMontoMov(e.target.value)}
                style={{...FI,fontSize:20,fontWeight:800,textAlign:'right'}}/>
            </div>
            <button onClick={registrarMovimiento}
              disabled={!concepto||!montoMov}
              style={{width:'100%',padding:'11px',borderRadius:9,border:'none',
                background:(!concepto||!montoMov)?C.sur3:
                  tipoMov==='EGRESO'?C.red:C.green,
                color:(!concepto||!montoMov)?C.hint:'white',
                cursor:(!concepto||!montoMov)?'not-allowed':'pointer',
                fontSize:14,fontWeight:700}}>
              Registrar {tipoMov==='EGRESO'?'egreso':'ingreso'}
            </button>
          </div>
        )}

        {/* ── ARQUEO Y CIERRE ── */}
        {modo==='arqueo'&&(
          <div>
            {/* Sección efectivo */}
            <div style={{background:C.sur2,borderRadius:10,padding:14,
              border:`1px solid ${C.bord2}`,marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:700,color:C.amber,
                marginBottom:12,textTransform:'uppercase'}}>
                💵 Conteo de efectivo
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                <div>
                  <div style={{fontSize:10,color:C.hint,fontWeight:700,
                    textTransform:'uppercase',marginBottom:8}}>Billetes</div>
                  {BILLETES.map(b=>(
                    <div key={b.k} style={{display:'flex',alignItems:'center',
                      gap:8,marginBottom:7}}>
                      <div style={{width:52,fontSize:13,fontWeight:700,
                        color:C.amber,textAlign:'right'}}>{b.label}</div>
                      <input type="number" min="0" value={arqueo[b.k]}
                        onChange={e=>setArqueo(p=>({...p,[b.k]:parseInt(e.target.value)||0}))}
                        style={{...FI,width:65,textAlign:'center',padding:'5px 6px'}}/>
                      <div style={{fontSize:11,color:C.muted,width:65,textAlign:'right'}}>
                        {fmt$(arqueo[b.k]*b.val)}
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{fontSize:10,color:C.hint,fontWeight:700,
                    textTransform:'uppercase',marginBottom:8}}>Monedas</div>
                  {MONEDAS.map(m=>(
                    <div key={m.k} style={{display:'flex',alignItems:'center',
                      gap:8,marginBottom:7}}>
                      <div style={{width:52,fontSize:13,fontWeight:700,
                        color:C.cyan,textAlign:'right'}}>{m.label}</div>
                      <input type="number" min="0" value={arqueo[m.k]}
                        onChange={e=>setArqueo(p=>({...p,[m.k]:parseInt(e.target.value)||0}))}
                        style={{...FI,width:65,textAlign:'center',padding:'5px 6px'}}/>
                      <div style={{fontSize:11,color:C.muted,width:65,textAlign:'right'}}>
                        {fmt$(arqueo[m.k]*m.val)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${C.bord2}`,
                display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:12,color:C.hint}}>Total efectivo contado</span>
                <span style={{fontSize:18,fontWeight:800,color:C.amber}}>
                  {fmt$(totalContado)}
                </span>
              </div>
            </div>

            {/* Sección tarjetas y transferencias */}
            <div style={{background:C.sur2,borderRadius:10,padding:14,
              border:`1px solid ${C.bord2}`,marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:700,color:C.purple,
                marginBottom:12,textTransform:'uppercase'}}>
                💳 Tarjetas y depósitos
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                {[
                  {k:'tarjeta_contado',      l:'Tarjeta',         sis:Number(data.ventas?.tarjeta||0),       c:C.purple},
                  {k:'transferencia_contado',l:'Transferencia',   sis:Number(data.ventas?.transferencia||0), c:C.blue},
                  {k:'medianet_contado',     l:'Medianet',        sis:Number(data.ventas?.medianet||0),      c:C.cyan},
                  {k:'deuna_contado',        l:'De Una',          sis:Number(data.ventas?.deuna||0),         c:C.cyan},
                ].map(f=>{
                  const val = Number(arqueoExtra[f.k]||0)
                  const dif = val - f.sis
                  return(
                    <div key={f.k} style={{background:C.sur3,borderRadius:8,padding:'10px 12px'}}>
                      <div style={{fontSize:10,color:C.hint,fontWeight:700,
                        textTransform:'uppercase',marginBottom:6}}>{f.l}</div>
                      <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:6}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:9,color:C.hint,marginBottom:2}}>Sistema</div>
                          <div style={{fontSize:13,fontWeight:700,color:f.c}}>
                            {fmt$(f.sis)}
                          </div>
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:9,color:C.hint,marginBottom:2}}>Comprobantes</div>
                          <input type="number" step="0.01" min="0"
                            value={arqueoExtra[f.k]||''}
                            onChange={e=>setArqueoExtra(p=>({...p,[f.k]:parseFloat(e.target.value)||0}))}
                            placeholder="0.00"
                            style={{...FI,padding:'4px 7px',fontSize:12,fontWeight:700}}/>
                        </div>
                      </div>
                      {val>0&&(
                        <div style={{fontSize:10,fontWeight:700,
                          color:dif===0?C.green:dif>0?C.amber:C.red}}>
                          {dif===0?'✅ Cuadrado':dif>0?`+${fmt$(dif)} sobrante`:`${fmt$(dif)} faltante`}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Resumen general */}
            <div style={{background:C.sur2,borderRadius:12,padding:'14px 18px',
              marginBottom:14,border:`1px solid ${C.bord2}`}}>
              <div style={{fontSize:11,fontWeight:700,color:C.hint,
                textTransform:'uppercase',marginBottom:12}}>Resumen del cierre</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
                {[
                  {l:'Efectivo sistema', v:ef_sis,          c:C.green},
                  {l:'Efectivo contado', v:totalContado,     c:C.amber},
                  {l:'Diferencia efect.',v:totalContado-ef_sis,
                    c:(totalContado-ef_sis)===0?C.green:(totalContado-ef_sis)>0?C.amber:C.red},
                  {l:'Total otras formas',
                    v:Number(data.ventas?.tarjeta||0)+Number(data.ventas?.transferencia||0)+
                      Number(data.ventas?.medianet||0)+Number(data.ventas?.deuna||0),
                    c:C.blue},
                ].map((k,i)=>(
                  <div key={i} style={{textAlign:'center'}}>
                    <div style={{fontSize:9,color:C.hint,textTransform:'uppercase',
                      fontWeight:600,marginBottom:4}}>{k.l}</div>
                    <div style={{fontSize:16,fontWeight:800,color:k.c}}>
                      {fmt$(k.v)}
                    </div>
                    {i===2&&k.v!==0&&(
                      <div style={{fontSize:10,fontWeight:700,color:k.c}}>
                        {k.v>0?'SOBRANTE':k.v<0?'FALTANTE':'CUADRADO'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{marginBottom:14}}>
              <label style={{fontSize:11,color:C.muted,display:'block',
                marginBottom:4,fontWeight:600,textTransform:'uppercase'}}>
                Observaciones del cierre
              </label>
              <input value={obsClose} onChange={e=>setObsClose(e.target.value)}
                placeholder="Notas del cierre..." style={FI}/>
            </div>

            <button onClick={cerrar} disabled={saving}
              style={{width:'100%',padding:'13px',borderRadius:10,border:'none',
                background:saving?C.sur3:C.red,color:saving?C.hint:'white',
                cursor:saving?'not-allowed':'pointer',fontSize:15,fontWeight:800,
                boxShadow:saving?'none':'0 4px 16px rgba(239,68,68,.4)'}}>
              {saving?'Cerrando...':'🔒 Cerrar caja'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Resultado del cierre ──────────────────────────────────────
function ResultadoCierre({resultado, caja, onAceptar}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const color = resultado.diferencia===0?C.green:
                resultado.diferencia>0?C.amber:C.red

  return(
    <div style={{background:C.surface,borderRadius:14,padding:32,
      border:`1px solid ${C.bord2}`,textAlign:'center'}}>
      <div style={{fontSize:48,marginBottom:16}}>
        {resultado.diferencia===0?'✅':resultado.diferencia>0?'⬆️':'⬇️'}
      </div>
      <div style={{fontSize:20,fontWeight:800,color:C.text,marginBottom:8}}>
        Caja {caja.nombre} cerrada
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',
        gap:12,maxWidth:400,margin:'20px auto'}}>
        {[
          {l:'Efectivo sistema', v:resultado.efectivo_sis},
          {l:'Total contado',    v:resultado.total_contado},
          {l:'Diferencia',       v:resultado.diferencia,   c:color},
        ].map((r,i)=>(
          <div key={i} style={{background:C.sur2,borderRadius:10,padding:'12px'}}>
            <div style={{fontSize:10,color:C.hint,marginBottom:4}}>{r.l}</div>
            <div style={{fontSize:16,fontWeight:800,color:r.c||C.text}}>
              {fmt$(r.v)}
            </div>
          </div>
        ))}
      </div>
      <div style={{fontSize:18,fontWeight:800,color,marginBottom:20}}>
        {resultado.estado}
      </div>
      <button onClick={onAceptar}
        style={{padding:'11px 32px',borderRadius:10,border:'none',
          background:C.blue,color:'white',cursor:'pointer',
          fontSize:14,fontWeight:700}}>
        Aceptar
      </button>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  PÁGINA PRINCIPAL
// ════════════════════════════════════════════════════════════
export default function Caja() {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const user = JSON.parse(localStorage.getItem('nexus_user')||'{}')
  const [cajas,       setCajas]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [cajaActiva,  setCajaActiva]  = useState(null)
  const [sesionId,    setSesionId]    = useState(null)
  const [modalAbrir,  setModalAbrir]  = useState(null)
  const [montoAp,     setMontoAp]     = useState('0')
  const [modalNueva,  setModalNueva]  = useState(false)
  const [formNueva,   setFormNueva]   = useState({nombre:'',tipo:'SUCURSAL'})
  const [sucNombre,   setSucNombre]   = useState('')
  const [saving,      setSaving]      = useState(false)
  const [vista,       setVista]       = useState('cajas')   // cajas | historial
  const [cajaHist,    setCajaHist]    = useState(null)
  const [historial,   setHistorial]   = useState([])
  const [loadHist,    setLoadHist]    = useState(false)
  const [sesionDetalle, setSesionDet] = useState(null)

  async function cargar() {
    setLoading(true)
    try {
      const{data}=await api.get('/cajas')
      setCajas(data)
      // Si hay una caja con sesión activa, activarla
      const activa = data.find(c=>c.sesion_activa_id)
      if(activa&&!cajaActiva){
        setCajaActiva(activa)
        setSesionId(activa.sesion_activa_id)
      }
    }finally{setLoading(false)}
  }

  useEffect(()=>{
    cargar()
    api.get('/config/sucursales').then(r=>{
      if(user.sucursal_id){
        const suc=r.data.find(x=>x.id===parseInt(user.sucursal_id))
        if(suc) setSucNombre(suc.nombre)
      }
    }).catch(()=>{})
  },[])

  async function abrirCaja() {
    if(!modalAbrir) return
    setSaving(true)
    try{
      const{data}=await api.post('/caja/abrir',{
        caja_id:        modalAbrir.id,
        monto_apertura: parseFloat(montoAp)||0,
      })
      setCajaActiva(modalAbrir)
      setSesionId(data.id)
      setModalAbrir(null); setMontoAp('0')
    }catch(e){alert(e.response?.data?.detail||e.message)}
    finally{setSaving(false)}
  }

  async function verHistorial(c) {
    setCajaHist(c); setVista('historial'); setLoadHist(true)
    try {
      const{data}=await api.get('/caja/historial',{params:{caja_id:c.id}})
      setHistorial(data)
    }finally{setLoadHist(false)}
  }

  async function eliminarCaja(c) {
    if(!window.confirm(`¿Eliminar la caja "${c.nombre}"? Esta acción no se puede deshacer.`)) return
    try {
      await api.delete(`/cajas/${c.id}`)
      cargar()
    } catch(e) {
      alert(e.response?.data?.detail||'No se puede eliminar esta caja')
    }
  }

  async function crearCaja() {
    if(!formNueva.nombre.trim()) return
    await api.post('/cajas',{...formNueva,
      usuario_id:formNueva.tipo==='PERSONAL'?user.id:null})
    setModalNueva(false)
    setFormNueva({nombre:'',tipo:'SUCURSAL'})
    cargar()
  }

  if(cajaActiva&&sesionId) return(
    <div style={{background:C.bg,minHeight:'100vh',padding:'24px 28px',
      fontFamily:"'Inter','Segoe UI',system-ui,sans-serif",color:C.text}}>
      <div style={{display:'flex',justifyContent:'space-between',
        alignItems:'center',marginBottom:20}}>
        <div>
          <h1 style={{margin:0,fontSize:22,fontWeight:800}}>🏦 Caja</h1>
          {sucNombre&&<p style={{margin:'4px 0 0',color:C.green,fontSize:13,fontWeight:600}}>
            🏢 {sucNombre}
          </p>}
        </div>
        <button onClick={()=>{setCajaActiva(null);setSesionId(null);cargar()}}
          style={{padding:'8px 16px',borderRadius:8,cursor:'pointer',
            border:`1px solid ${C.bord2}`,background:C.sur2,
            color:C.muted,fontSize:13}}>
          ← Cambiar caja
        </button>
      </div>
      <SesionActiva
        caja={cajaActiva}
        sesionId={sesionId}
        onCerrada={()=>{setCajaActiva(null);setSesionId(null);cargar()}}
      />
    </div>
  )

  return(
    <div style={{background:C.bg,minHeight:'100vh',padding:'24px 28px',
      fontFamily:"'Inter','Segoe UI',system-ui,sans-serif",color:C.text}}>

      <div style={{display:'flex',justifyContent:'space-between',
        alignItems:'flex-start',marginBottom:24}}>
        <div>
          <h1 style={{margin:0,fontSize:24,fontWeight:800}}>🏦 Caja</h1>
          {sucNombre&&(
            <div style={{display:'flex',alignItems:'center',gap:7,marginTop:6,
              padding:'5px 12px',borderRadius:8,width:'fit-content',
              background:C.greenD,border:`1px solid rgba(16,185,129,.25)`}}>
              <span>🏢</span>
              <span style={{fontSize:13,fontWeight:700,color:C.green}}>{sucNombre}</span>
            </div>
          )}
        </div>
        <button onClick={()=>setModalNueva(true)}
          style={{padding:'10px 18px',borderRadius:10,border:'none',
            background:C.blue,color:'white',cursor:'pointer',
            fontSize:13,fontWeight:700,
            boxShadow:'0 4px 14px rgba(59,130,246,.4)'}}>
          + Nueva caja
        </button>
      </div>

      {loading?(
        <div style={{padding:40,textAlign:'center',color:C.hint}}>Cargando...</div>
      ):(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14}}>
          {cajas.map(c=>{
            const abierta = !!c.sesion_activa_id
            return(
              <div key={c.id} style={{background:C.surface,borderRadius:14,
                border:`1.5px solid ${abierta?C.green:C.bord2}`,
                overflow:'hidden',
                boxShadow:abierta?'0 0 20px rgba(16,185,129,.15)':'none'}}>
                <div style={{padding:'16px 18px',
                  background:abierta?'rgba(16,185,129,.08)':'transparent'}}>
                  <div style={{display:'flex',justifyContent:'space-between',
                    alignItems:'flex-start'}}>
                    <div>
                      <div style={{fontSize:15,fontWeight:800,color:C.text}}>
                        {c.nombre}
                      </div>
                      <div style={{fontSize:11,color:C.hint,marginTop:2}}>
                        {c.tipo==='PERSONAL'?'👤 Personal':'🏢 Sucursal'}
                        {c.usuario_nombre&&` · ${c.usuario_nombre}`}
                      </div>
                    </div>
                    <span style={{padding:'3px 12px',borderRadius:20,fontSize:11,
                      fontWeight:700,
                      background:abierta?C.greenD:C.sur3,
                      color:abierta?C.green:C.hint}}>
                      {abierta?'Abierta':'Cerrada'}
                    </span>
                  </div>
                </div>
                <div style={{padding:'12px 18px',
                  borderTop:`1px solid ${C.bord2}`}}>
                  {abierta?(
                    <button onClick={()=>{setCajaActiva(c);setSesionId(c.sesion_activa_id)}}
                      style={{width:'100%',padding:'10px',borderRadius:9,
                        border:`1px solid ${C.green}`,background:C.greenD,
                        color:C.green,cursor:'pointer',fontSize:13,fontWeight:700}}>
                      Ingresar a la caja →
                    </button>
                  ):(
                    <div style={{display:'flex',gap:8}}>
                      <button onClick={()=>{setModalAbrir(c);setMontoAp('0')}}
                        style={{flex:1,padding:'10px',borderRadius:9,
                          border:'none',background:C.blue,color:'white',
                          cursor:'pointer',fontSize:13,fontWeight:700}}>
                        Abrir caja
                      </button>
                      <button onClick={()=>verHistorial(c)}
                        title="Ver historial"
                        style={{padding:'10px 12px',borderRadius:9,cursor:'pointer',
                          border:`1px solid ${C.bord2}`,background:C.sur2,
                          color:C.hint,fontSize:13}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor=C.blue;e.currentTarget.style.color=C.blue}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor=C.bord2;e.currentTarget.style.color=C.hint}}>
                        📋
                      </button>
                      <button onClick={()=>eliminarCaja(c)}
                        title="Eliminar caja"
                        style={{padding:'10px 12px',borderRadius:9,cursor:'pointer',
                          border:`1px solid ${C.bord2}`,background:C.sur2,
                          color:C.hint,fontSize:13}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor=C.red;e.currentTarget.style.color=C.red}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor=C.bord2;e.currentTarget.style.color=C.hint}}>
                        🗑
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {cajas.length===0&&(
            <div style={{gridColumn:'1/-1',padding:40,textAlign:'center',
              color:C.hint,fontSize:13,background:C.surface,
              borderRadius:14,border:`1px solid ${C.bord2}`}}>
              No hay cajas configuradas para esta sucursal
            </div>
          )}
        </div>
      )}

      {/* ── VISTA HISTORIAL ── */}
      {vista==='historial'&&cajaHist&&(
        <div style={{background:C.surface,borderRadius:14,
          border:`1px solid ${C.bord2}`,overflow:'hidden',marginTop:8}}>
          {/* Header */}
          <div style={{padding:'14px 20px',borderBottom:`1px solid ${C.bord2}`,
            display:'flex',justifyContent:'space-between',alignItems:'center',
            background:'rgba(59,130,246,.06)'}}>
            <div>
              <div style={{fontSize:15,fontWeight:800,color:C.text}}>
                📋 Historial — {cajaHist.nombre}
              </div>
              <div style={{fontSize:12,color:C.muted,marginTop:2}}>
                Últimas 30 sesiones
              </div>
            </div>
            <button onClick={()=>{setVista('cajas');setSesionDet(null)}}
              style={{padding:'8px 16px',borderRadius:8,cursor:'pointer',
                border:`1px solid ${C.bord2}`,background:C.sur2,
                color:C.muted,fontSize:13}}>
              ← Volver
            </button>
          </div>

          {loadHist?(
            <div style={{padding:32,textAlign:'center',color:C.hint}}>Cargando...</div>
          ):(
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:C.sur3}}>
                  {['Apertura','Cierre','Monto inicial','Efectivo sistema',
                    'Total contado','Diferencia','Estado',''].map((h,i)=>(
                    <th key={i} style={{padding:'10px 14px',fontSize:10,fontWeight:700,
                      color:C.hint,textTransform:'uppercase',letterSpacing:'.05em',
                      borderBottom:`1px solid ${C.bord2}`,textAlign:i>=2?'right':'left'}}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historial.map(s=>{
                  const dif = Number(s.diferencia||0)
                  const difColor = dif===0?C.green:dif>0?C.amber:C.red
                  return(
                    <tr key={s.id}
                      onMouseEnter={e=>e.currentTarget.style.background=C.sur2}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <td style={{padding:'11px 14px',fontSize:12,color:C.text}}>
                        {new Date(s.fecha_apertura).toLocaleString('es-EC',
                          {day:'2-digit',month:'2-digit',year:'numeric',
                           hour:'2-digit',minute:'2-digit'})}
                      </td>
                      <td style={{padding:'11px 14px',fontSize:12,
                        color:s.fecha_cierre?C.muted:C.green}}>
                        {s.fecha_cierre
                          ?new Date(s.fecha_cierre).toLocaleString('es-EC',
                            {day:'2-digit',month:'2-digit',year:'numeric',
                             hour:'2-digit',minute:'2-digit'})
                          :'Abierta'}
                      </td>
                      <td style={{padding:'11px 14px',fontSize:12,
                        color:C.muted,textAlign:'right'}}>
                        {fmt$(s.monto_apertura)}
                      </td>
                      <td style={{padding:'11px 14px',fontSize:13,
                        fontWeight:700,color:C.blue,textAlign:'right'}}>
                        {fmt$(s.total_efectivo_sistema)}
                      </td>
                      <td style={{padding:'11px 14px',fontSize:13,
                        fontWeight:700,color:C.amber,textAlign:'right'}}>
                        {fmt$(s.total_contado)}
                      </td>
                      <td style={{padding:'11px 14px',textAlign:'right'}}>
                        <span style={{padding:'3px 10px',borderRadius:20,
                          fontSize:12,fontWeight:700,
                          background:dif===0?C.greenD:dif>0?C.amberD:C.redD,
                          color:difColor}}>
                          {dif>0?'+':''}{fmt$(dif)}
                        </span>
                      </td>
                      <td style={{padding:'11px 14px'}}>
                        <span style={{padding:'3px 10px',borderRadius:20,
                          fontSize:11,fontWeight:700,
                          background:s.estado==='ABIERTA'?C.greenD:C.sur3,
                          color:s.estado==='ABIERTA'?C.green:C.hint}}>
                          {s.estado==='ABIERTA'?'Abierta':
                           dif===0?'Cuadrado':dif>0?'Sobrante':'Faltante'}
                        </span>
                      </td>
                      <td style={{padding:'11px 14px',textAlign:'center'}}>
                        <button onClick={()=>setSesionDet(sesionDetalle?.id===s.id?null:s)}
                          style={{padding:'4px 12px',borderRadius:7,cursor:'pointer',
                            border:`1px solid ${C.bord2}`,background:C.sur2,
                            color:C.muted,fontSize:11}}>
                          {sesionDetalle?.id===s.id?'Ocultar':'Ver'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {historial.length===0&&(
                  <tr><td colSpan={8} style={{padding:'40px 0',textAlign:'center',
                    color:C.hint,fontSize:13}}>
                    Sin sesiones registradas
                  </td></tr>
                )}
              </tbody>
            </table>
          )}

          {/* Detalle de sesión expandida */}
          {sesionDetalle&&(
            <div style={{padding:'16px 20px',borderTop:`1px solid ${C.bord2}`,
              background:C.sur2}}>
              <div style={{fontSize:12,fontWeight:700,color:C.muted,
                textTransform:'uppercase',marginBottom:12}}>
                Detalle del arqueo
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:8,marginBottom:14}}>
                {[
                  {l:'Ventas efectivo',   v:sesionDetalle.total_efectivo_sistema,    c:C.green},
                  {l:'Tarjeta',           v:sesionDetalle.total_tarjeta_sistema,     c:C.purple},
                  {l:'Transferencia',     v:sesionDetalle.total_transferencia_sistema,c:C.amber},
                  {l:'Medianet',          v:sesionDetalle.total_medianet_sistema,    c:C.cyan},
                  {l:'CXC cobrado',       v:sesionDetalle.total_cxc_cobrado,         c:C.blue},
                  {l:'Egresos',           v:sesionDetalle.total_egresos,             c:C.red},
                ].map((k,i)=>(
                  <div key={i} style={{background:C.sur3,borderRadius:8,padding:'10px 12px'}}>
                    <div style={{fontSize:9,color:C.hint,textTransform:'uppercase',fontWeight:600}}>
                      {k.l}
                    </div>
                    <div style={{fontSize:15,fontWeight:800,color:k.c,marginTop:4}}>
                      {fmt$(k.v)}
                    </div>
                  </div>
                ))}
              </div>
              {/* Billetes y monedas */}
              {sesionDetalle.total_contado>0&&(
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:C.hint,
                    marginBottom:8,textTransform:'uppercase'}}>
                    Conteo físico
                  </div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                    {[
                      {k:'billetes_100',l:'$100',v:100},
                      {k:'billetes_50', l:'$50', v:50},
                      {k:'billetes_20', l:'$20', v:20},
                      {k:'billetes_10', l:'$10', v:10},
                      {k:'billetes_5',  l:'$5',  v:5},
                      {k:'billetes_1',  l:'$1',  v:1},
                      {k:'monedas_100', l:'$1.00',v:1},
                      {k:'monedas_50',  l:'$0.50',v:.5},
                      {k:'monedas_25',  l:'$0.25',v:.25},
                      {k:'monedas_10',  l:'$0.10',v:.1},
                      {k:'monedas_5',   l:'$0.05',v:.05},
                      {k:'monedas_1',   l:'$0.01',v:.01},
                    ].filter(d=>sesionDetalle[d.k]>0).map((d,i)=>(
                      <div key={i} style={{padding:'5px 12px',borderRadius:8,
                        background:C.sur3,border:`1px solid ${C.bord2}`,
                        fontSize:11,color:C.muted}}>
                        <span style={{fontWeight:700,color:C.amber}}>{d.l}</span>
                        {' × '}{sesionDetalle[d.k]}
                        {' = '}
                        <span style={{color:C.text,fontWeight:600}}>
                          {fmt$(sesionDetalle[d.k]*d.v)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {sesionDetalle.observaciones&&(
                    <div style={{marginTop:10,padding:'8px 12px',borderRadius:8,
                      background:C.sur3,fontSize:12,color:C.muted}}>
                      📝 {sesionDetalle.observaciones}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal abrir caja */}
      {modalAbrir&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:9000}}>
          <div style={{background:C.surface,borderRadius:16,padding:28,width:380,
            border:`1px solid ${C.bord2}`,boxShadow:'0 25px 60px rgba(0,0,0,.7)'}}>
            <div style={{fontSize:16,fontWeight:800,color:C.text,marginBottom:20}}>
              🔓 Abrir caja — {modalAbrir.nombre}
            </div>
            <div style={{marginBottom:16}}>
              <label style={{fontSize:11,color:C.muted,display:'block',
                marginBottom:4,fontWeight:600,textTransform:'uppercase'}}>
                Monto de apertura (efectivo en caja)
              </label>
              <input type="number" step="0.01" value={montoAp}
                onChange={e=>setMontoAp(e.target.value)}
                style={{...FI,fontSize:22,fontWeight:800,textAlign:'right'}}/>
            </div>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button onClick={()=>setModalAbrir(null)}
                style={{padding:'9px 18px',borderRadius:9,cursor:'pointer',
                  border:`1px solid ${C.bord2}`,background:'transparent',
                  color:C.muted,fontSize:13}}>Cancelar</button>
              <button onClick={abrirCaja} disabled={saving}
                style={{padding:'9px 24px',borderRadius:9,border:'none',
                  background:saving?C.sur3:C.green,color:saving?C.hint:'white',
                  cursor:saving?'not-allowed':'pointer',
                  fontSize:13,fontWeight:700}}>
                {saving?'Abriendo...':'Abrir caja'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nueva caja */}
      {modalNueva&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:9000}}>
          <div style={{background:C.surface,borderRadius:16,padding:28,width:380,
            border:`1px solid ${C.bord2}`,boxShadow:'0 25px 60px rgba(0,0,0,.7)'}}>
            <div style={{fontSize:16,fontWeight:800,color:C.text,marginBottom:20}}>
              ➕ Nueva caja
            </div>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:11,color:C.muted,display:'block',
                marginBottom:4,fontWeight:600,textTransform:'uppercase'}}>
                Nombre *
              </label>
              <input value={formNueva.nombre}
                onChange={e=>setFormNueva(f=>({...f,nombre:e.target.value}))}
                placeholder="Ej: Caja Principal, Caja Juan..." style={FI}/>
            </div>
            <div style={{marginBottom:16}}>
              <label style={{fontSize:11,color:C.muted,display:'block',
                marginBottom:4,fontWeight:600,textTransform:'uppercase'}}>
                Tipo
              </label>
              <div style={{display:'flex',gap:8}}>
                {[['SUCURSAL','🏢 Sucursal'],['PERSONAL','👤 Personal']].map(([v,l])=>(
                  <button key={v} onClick={()=>setFormNueva(f=>({...f,tipo:v}))}
                    style={{flex:1,padding:'10px',borderRadius:9,cursor:'pointer',
                      border:`1.5px solid ${formNueva.tipo===v?C.blue:C.bord2}`,
                      background:formNueva.tipo===v?C.blueD:'transparent',
                      color:formNueva.tipo===v?C.blue:C.muted,
                      fontSize:13,fontWeight:600}}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button onClick={()=>setModalNueva(false)}
                style={{padding:'9px 18px',borderRadius:9,cursor:'pointer',
                  border:`1px solid ${C.bord2}`,background:'transparent',
                  color:C.muted,fontSize:13}}>Cancelar</button>
              <button onClick={crearCaja} disabled={!formNueva.nombre.trim()}
                style={{padding:'9px 24px',borderRadius:9,border:'none',
                  background:formNueva.nombre.trim()?C.blue:C.sur3,
                  color:formNueva.nombre.trim()?'white':C.hint,
                  cursor:formNueva.nombre.trim()?'pointer':'not-allowed',
                  fontSize:13,fontWeight:700}}>
                Crear caja
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}