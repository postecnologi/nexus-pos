// ============================================================
//  NEXUS POS — Módulo Bancario
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
const hoy = () => new Date().toISOString().split('T')[0]

const TIPOS = [
  {v:'DEPOSITO_EFECTIVO',      l:'Depósito efectivo',      e:'💵', c:C.green},
  {v:'LOTE_TARJETA',           l:'Lote tarjeta',            e:'💳', c:C.purple},
  {v:'TRANSFERENCIA_RECIBIDA', l:'Transferencia recibida',  e:'📥', c:C.blue},
  {v:'PAGO_PROVEEDOR',         l:'Pago proveedor',          e:'📤', c:C.red},
  {v:'OTRO',                   l:'Otro movimiento',         e:'🔄', c:C.hint},
]
const TARJETAS = ['VISA','MASTERCARD','AMEX','DINERS','OTHER']
const BANCOS_LIST = ['Banco Pichincha','Banco del Pacífico','Banco Guayaquil',
  'Produbanco','Banco Internacional','Banco Bolivariano','BanEcuador','Mutualista Pichincha']

// ── Modal nueva cuenta ────────────────────────────────────────
function ModalCuenta({cuenta, bancosList, onCerrar, onGuardado}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [form, setForm] = useState({
    banco_id:      cuenta?.banco_id      || '',
    nombre:        cuenta?.nombre        || '',
    numero:        cuenta?.numero        || '',
    tipo:          cuenta?.tipo          || 'CORRIENTE',
    saldo_inicial: cuenta?.saldo_inicial || 0,
  })
  const [saving, setSaving] = useState(false)

  async function guardar() {
    if(!form.banco_id || !form.nombre) return
    setSaving(true)
    try {
      if(cuenta) await api.put(`/bancos/cuentas/${cuenta.id}`, form)
      else       await api.post('/bancos/cuentas', form)
      onGuardado()
    } catch(e) { alert(e.response?.data?.detail||e.message) }
    finally { setSaving(false) }
  }

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:9000}}>
      <div style={{background:C.surface,borderRadius:16,padding:28,width:440,
        border:`1px solid ${C.bord2}`,boxShadow:'0 25px 60px rgba(0,0,0,.7)'}}>
        <div style={{fontSize:16,fontWeight:800,color:C.text,marginBottom:20}}>
          {cuenta?'✏️ Editar cuenta':'🏦 Nueva cuenta bancaria'}
        </div>
        <div style={{marginBottom:10}}>
          <label style={{fontSize:11,color:C.muted,display:'block',
            marginBottom:4,fontWeight:600,textTransform:'uppercase'}}>Banco *</label>
          <select value={form.banco_id}
            onChange={e=>setForm(p=>({...p,banco_id:parseInt(e.target.value)||''}))}
            style={FI}>
            <option value="">-- Selecciona banco --</option>
            {bancosList.map(b=>(
              <option key={b.id} value={b.id}>{b.nombre}</option>
            ))}
          </select>
        </div>
        {[
          {k:'nombre', l:'Nombre de la cuenta *', placeholder:'Ej: Cuenta corriente principal'},
          {k:'numero', l:'Número de cuenta',      placeholder:'Ej: 2200123456'},
        ].map(f=>(
          <div key={f.k} style={{marginBottom:10}}>
            <label style={{fontSize:11,color:C.muted,display:'block',
              marginBottom:4,fontWeight:600,textTransform:'uppercase'}}>{f.l}</label>
            <input value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))}
              placeholder={f.placeholder} style={FI}/>
          </div>
        ))}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
          <div>
            <label style={{fontSize:11,color:C.muted,display:'block',
              marginBottom:4,fontWeight:600,textTransform:'uppercase'}}>Tipo</label>
            <select value={form.tipo}
              onChange={e=>setForm(p=>({...p,tipo:e.target.value}))} style={FI}>
              <option value="CORRIENTE">Corriente</option>
              <option value="AHORROS">Ahorros</option>
            </select>
          </div>
          <div>
            <label style={{fontSize:11,color:C.muted,display:'block',
              marginBottom:4,fontWeight:600,textTransform:'uppercase'}}>Saldo inicial</label>
            <input type="number" step="0.01" value={form.saldo_inicial}
              onChange={e=>setForm(p=>({...p,saldo_inicial:parseFloat(e.target.value)||0}))}
              style={{...FI,textAlign:'right'}}/>
          </div>
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <button onClick={onCerrar}
            style={{padding:'9px 18px',borderRadius:9,cursor:'pointer',
              border:`1px solid ${C.bord2}`,background:'transparent',
              color:C.muted,fontSize:13}}>Cancelar</button>
          <button onClick={guardar} disabled={saving||!form.banco_id||!form.nombre}
            style={{padding:'9px 22px',borderRadius:9,border:'none',
              background:(saving||!form.banco_id||!form.nombre)?C.sur3:C.blue,
              color:(saving||!form.banco_id||!form.nombre)?C.hint:'white',
              cursor:(saving||!form.banco_id||!form.nombre)?'not-allowed':'pointer',
              fontSize:13,fontWeight:700}}>
            {saving?'Guardando...':'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal nuevo movimiento ────────────────────────────────────
function ModalMovimiento({cuentas, onCerrar, onGuardado}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [tipo,        setTipo]        = useState('DEPOSITO_EFECTIVO')
  const [cuentaId,    setCuentaId]    = useState(cuentas[0]?.id||'')
  const [concepto,    setConcepto]    = useState('')
  const [monto,       setMonto]       = useState('')
  const [fecha,       setFecha]       = useState(hoy())
  const [referencia,  setReferencia]  = useState('')
  const [bancoOrigen, setBancoOrigen] = useState('')
  const [obs,         setObs]         = useState('')
  const [transacciones, setTransacciones] = useState([])
  const [newVoucher,  setNewVoucher]  = useState('')
  const [newTarjeta,  setNewTarjeta]  = useState('VISA')
  const [newMonto,    setNewMonto]    = useState('')
  const [saving,      setSaving]      = useState(false)
  const [err,         setErr]         = useState('')

  const tipoInfo = TIPOS.find(t=>t.v===tipo)
  const esLote   = tipo==='LOTE_TARJETA'
  const totalLote = transacciones.reduce((a,t)=>a+Number(t.monto),0)

  function agregarTransaccion() {
    if(!newMonto) return
    setTransacciones(p=>[...p,{
      voucher:newVoucher, tarjeta_tipo:newTarjeta,
      monto:parseFloat(newMonto), id:Date.now()
    }])
    setNewVoucher(''); setNewMonto('')
    if(!monto) setMonto(String(parseFloat(newMonto)))
    else setMonto(p=>String(parseFloat(p)+parseFloat(newMonto)))
  }

  async function guardar() {
    if(!cuentaId)  return setErr('Selecciona una cuenta bancaria')
    if(!concepto)  return setErr('Ingresa el concepto')
    if(!monto)     return setErr('Ingresa el monto')
    if(esLote&&transacciones.length===0) return setErr('Agrega al menos una transacción')
    setSaving(true); setErr('')
    try {
      await api.post('/bancos/movimientos',{
        cuenta_id:     parseInt(cuentaId),
        tipo, concepto,
        monto:         parseFloat(monto),
        fecha,
        referencia:    referencia||null,
        banco_origen:  bancoOrigen||null,
        observaciones: obs||null,
        transacciones: esLote?transacciones:[],
      })
      onGuardado()
    } catch(e) { setErr(e.response?.data?.detail||e.message) }
    finally { setSaving(false) }
  }

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:9000}}>
      <div style={{background:C.surface,borderRadius:16,padding:28,
        width:680,maxHeight:'92vh',overflowY:'auto',
        border:`1px solid ${C.bord2}`,boxShadow:'0 25px 60px rgba(0,0,0,.7)'}}>

        <div style={{fontSize:16,fontWeight:800,color:C.text,marginBottom:20}}>
          💰 Nuevo movimiento bancario
        </div>

        {/* Tipo */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:6,marginBottom:16}}>
          {TIPOS.map(t=>(
            <button key={t.v} onClick={()=>setTipo(t.v)}
              style={{padding:'8px 4px',borderRadius:9,cursor:'pointer',
                border:`1.5px solid ${tipo===t.v?t.c:C.bord2}`,
                background:tipo===t.v?`${t.c}22`:C.sur2,
                display:'flex',flexDirection:'column',alignItems:'center',gap:4,
                color:tipo===t.v?t.c:C.hint,fontSize:11,fontWeight:tipo===t.v?700:400}}>
              <span style={{fontSize:18}}>{t.e}</span>
              <span style={{textAlign:'center',lineHeight:1.2}}>{t.l}</span>
            </button>
          ))}
        </div>

        {/* Campos principales */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
          <div>
            <label style={{fontSize:11,color:C.muted,display:'block',
              marginBottom:4,fontWeight:600,textTransform:'uppercase'}}>
              Cuenta bancaria *
            </label>
            <select value={cuentaId} onChange={e=>setCuentaId(e.target.value)} style={FI}>
              {cuentas.map(c=>(
                <option key={c.id} value={c.id}>
                  {c.banco} — {c.numero_cuenta}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{fontSize:11,color:C.muted,display:'block',
              marginBottom:4,fontWeight:600,textTransform:'uppercase'}}>Fecha</label>
            <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={FI}/>
          </div>
        </div>

        <div style={{marginBottom:10}}>
          <label style={{fontSize:11,color:C.muted,display:'block',
            marginBottom:4,fontWeight:600,textTransform:'uppercase'}}>Concepto *</label>
          <input value={concepto} onChange={e=>setConcepto(e.target.value)}
            placeholder={tipo==='DEPOSITO_EFECTIVO'?'Depósito efectivo del día...':
                         tipo==='LOTE_TARJETA'?'Lote tarjetas del día...':
                         tipo==='PAGO_PROVEEDOR'?'Pago a proveedor...':''}
            style={FI}/>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:12}}>
          <div>
            <label style={{fontSize:11,color:C.muted,display:'block',
              marginBottom:4,fontWeight:600,textTransform:'uppercase'}}>
              Monto total *
            </label>
            <input type="number" step="0.01" value={monto}
              onChange={e=>setMonto(e.target.value)}
              style={{...FI,fontSize:16,fontWeight:800,textAlign:'right',
                borderColor:tipoInfo?.c}}/>
          </div>
          <div>
            <label style={{fontSize:11,color:C.muted,display:'block',
              marginBottom:4,fontWeight:600,textTransform:'uppercase'}}>
              N° referencia / comprobante
            </label>
            <input value={referencia} onChange={e=>setReferencia(e.target.value)}
              placeholder="N° depósito, lote..." style={FI}/>
          </div>
          {(tipo==='TRANSFERENCIA_RECIBIDA'||tipo==='PAGO_PROVEEDOR')&&(
            <div>
              <label style={{fontSize:11,color:C.muted,display:'block',
                marginBottom:4,fontWeight:600,textTransform:'uppercase'}}>
                Banco {tipo==='PAGO_PROVEEDOR'?'destino':'origen'}
              </label>
              <input value={bancoOrigen} onChange={e=>setBancoOrigen(e.target.value)}
                list="banco-orig" placeholder="Banco..." style={FI}/>
              <datalist id="banco-orig">
                {BANCOS_LIST.map((b,i)=><option key={i} value={b}/>)}
              </datalist>
            </div>
          )}
        </div>

        {/* Transacciones de lote */}
        {esLote&&(
          <div style={{background:C.sur2,borderRadius:10,padding:14,
            border:`1px solid ${C.bord2}`,marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:C.purple,
              textTransform:'uppercase',marginBottom:10}}>
              💳 Vouchers del lote
            </div>

            {/* Input nueva transacción */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 120px 110px auto',
              gap:8,marginBottom:10}}>
              <input value={newVoucher} onChange={e=>setNewVoucher(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&agregarTransaccion()}
                placeholder="N° voucher (opcional)" style={{...FI,fontSize:12}}/>
              <select value={newTarjeta} onChange={e=>setNewTarjeta(e.target.value)}
                style={{...FI,fontSize:12}}>
                {TARJETAS.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
              <input type="number" step="0.01" value={newMonto}
                onChange={e=>setNewMonto(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&agregarTransaccion()}
                placeholder="Monto"
                style={{...FI,fontSize:12,fontWeight:700,textAlign:'right'}}/>
              <button onClick={agregarTransaccion} disabled={!newMonto}
                style={{padding:'8px 14px',borderRadius:8,border:'none',
                  background:newMonto?C.purple:C.sur3,
                  color:newMonto?'white':C.hint,
                  cursor:newMonto?'pointer':'not-allowed',fontWeight:700,fontSize:13}}>
                + Add
              </button>
            </div>

            {/* Lista transacciones */}
            {transacciones.length>0&&(
              <div>
                <div style={{display:'grid',
                  gridTemplateColumns:'1fr 90px 100px 36px',
                  gap:8,padding:'5px 8px',
                  fontSize:9,fontWeight:700,color:C.hint,
                  textTransform:'uppercase'}}>
                  <span>Voucher</span><span>Tarjeta</span>
                  <span style={{textAlign:'right'}}>Monto</span><span></span>
                </div>
                {transacciones.map((t,i)=>(
                  <div key={t.id} style={{display:'grid',
                    gridTemplateColumns:'1fr 90px 100px 36px',
                    gap:8,padding:'6px 8px',borderRadius:6,marginBottom:3,
                    background:C.sur3,alignItems:'center'}}>
                    <code style={{fontSize:11,color:C.purple}}>
                      {t.voucher||'—'}
                    </code>
                    <span style={{fontSize:11,padding:'2px 8px',borderRadius:6,
                      background:C.blueD,color:C.blue,textAlign:'center',
                      fontWeight:700}}>
                      {t.tarjeta_tipo}
                    </span>
                    <span style={{textAlign:'right',fontWeight:700,
                      fontSize:13,color:C.text}}>{fmt$(t.monto)}</span>
                    <button onClick={()=>setTransacciones(p=>p.filter((_,j)=>j!==i))}
                      style={{background:'none',border:'none',cursor:'pointer',
                        color:C.hint,fontSize:16}}
                      onMouseEnter={e=>e.currentTarget.style.color=C.red}
                      onMouseLeave={e=>e.currentTarget.style.color=C.hint}>
                      x
                    </button>
                  </div>
                ))}
                <div style={{display:'flex',justifyContent:'space-between',
                  padding:'8px 8px 0',borderTop:`1px solid ${C.bord2}`,marginTop:6}}>
                  <span style={{fontSize:12,color:C.muted}}>
                    {transacciones.length} transacciones
                  </span>
                  <span style={{fontSize:14,fontWeight:800,color:C.purple}}>
                    {fmt$(totalLote)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{marginBottom:16}}>
          <label style={{fontSize:11,color:C.muted,display:'block',
            marginBottom:4,fontWeight:600,textTransform:'uppercase'}}>
            Observaciones
          </label>
          <input value={obs} onChange={e=>setObs(e.target.value)}
            placeholder="Notas adicionales..." style={FI}/>
        </div>

        {err&&(
          <div style={{padding:'8px 12px',borderRadius:8,fontSize:12,
            background:C.redD,color:'#FCA5A5',marginBottom:12}}>
            {err}
          </div>
        )}

        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <button onClick={onCerrar}
            style={{padding:'9px 18px',borderRadius:9,cursor:'pointer',
              border:`1px solid ${C.bord2}`,background:'transparent',
              color:C.muted,fontSize:13}}>Cancelar</button>
          <button onClick={guardar} disabled={saving}
            style={{padding:'9px 24px',borderRadius:9,border:'none',
              background:saving?C.sur3:tipoInfo?.c||C.blue,
              color:saving?C.hint:'white',
              cursor:saving?'not-allowed':'pointer',
              fontSize:13,fontWeight:700}}>
            {saving?'Guardando...':'Registrar movimiento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Panel de conciliación de lote ────────────────────────────
function PanelLote({mov, onCerrar, onActualizado}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [transacciones, setTransacciones] = useState([])
  const [loading,       setLoading]       = useState(true)

  async function cargar() {
    const{data}=await api.get(`/bancos/movimientos/${mov.id}/transacciones`)
    setTransacciones(data); setLoading(false)
  }

  useEffect(()=>{cargar()},[])

  async function toggleConciliar(t) {
    if(t.conciliada) await api.patch(`/bancos/lote/${t.id}/desconciliar`)
    else             await api.patch(`/bancos/lote/${t.id}/conciliar`)
    cargar(); onActualizado()
  }

  const totalConciliado = transacciones.filter(t=>t.conciliada).reduce((a,t)=>a+Number(t.monto),0)
  const totalPendiente  = transacciones.filter(t=>!t.conciliada).reduce((a,t)=>a+Number(t.monto),0)

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:9000}}>
      <div style={{background:C.surface,borderRadius:16,padding:28,width:620,
        maxHeight:'88vh',overflowY:'auto',
        border:`1px solid ${C.bord2}`,boxShadow:'0 25px 60px rgba(0,0,0,.7)'}}>

        <div style={{display:'flex',justifyContent:'space-between',
          alignItems:'center',marginBottom:16}}>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:C.text}}>
              💳 Conciliación de lote
            </div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>
              {mov.concepto} · {mov.banco} · {mov.referencia||''}
            </div>
          </div>
          <button onClick={onCerrar} style={{background:'none',border:'none',
            cursor:'pointer',color:C.hint,fontSize:22}}>x</button>
        </div>

        {/* KPIs */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',
          gap:8,marginBottom:16}}>
          {[
            {l:'Total lote',      v:Number(mov.monto),  c:C.blue},
            {l:'Conciliado',      v:totalConciliado,     c:C.green},
            {l:'Pendiente',       v:totalPendiente,      c:totalPendiente>0?C.amber:C.green},
          ].map((k,i)=>(
            <div key={i} style={{background:C.sur2,borderRadius:10,
              padding:'10px 14px',border:`1px solid ${C.bord2}`,textAlign:'center'}}>
              <div style={{fontSize:9,color:C.hint,textTransform:'uppercase',
                fontWeight:600,marginBottom:4}}>{k.l}</div>
              <div style={{fontSize:17,fontWeight:800,color:k.c}}>{fmt$(k.v)}</div>
            </div>
          ))}
        </div>

        {/* Transacciones */}
        {loading?(
          <div style={{padding:20,textAlign:'center',color:C.hint}}>Cargando...</div>
        ):(
          <div style={{background:C.sur2,borderRadius:10,border:`1px solid ${C.bord2}`,
            overflow:'hidden'}}>
            <div style={{display:'grid',
              gridTemplateColumns:'1fr 90px 110px 110px',
              padding:'8px 12px',background:C.sur3,
              fontSize:9,fontWeight:700,color:C.hint,textTransform:'uppercase',gap:8}}>
              <span>Voucher</span><span>Tarjeta</span>
              <span style={{textAlign:'right'}}>Monto</span>
              <span style={{textAlign:'center'}}>Estado</span>
            </div>
            {transacciones.map(t=>(
              <div key={t.id} style={{display:'grid',
                gridTemplateColumns:'1fr 90px 110px 110px',
                padding:'10px 12px',gap:8,alignItems:'center',
                borderBottom:`1px solid ${C.border}`,
                background:t.conciliada?C.greenD:'transparent',
                transition:'background .2s'}}>
                <code style={{fontSize:12,color:t.conciliada?C.green:C.purple,
                  fontWeight:700}}>
                  {t.voucher||'Sin voucher'}
                </code>
                <span style={{padding:'2px 8px',borderRadius:6,fontSize:11,
                  fontWeight:700,textAlign:'center',
                  background:C.blueD,color:C.blue}}>
                  {t.tarjeta_tipo||'—'}
                </span>
                <span style={{textAlign:'right',fontWeight:700,fontSize:13,
                  color:t.conciliada?C.green:C.text}}>
                  {fmt$(t.monto)}
                </span>
                <div style={{textAlign:'center'}}>
                  <span style={{padding:'3px 10px',borderRadius:20,fontSize:10,fontWeight:700,
                    background:t.conciliada?`${C.green}20`:`${C.amber}20`,
                    color:t.conciliada?C.green:C.amber}}>
                    {t.conciliada?'Conciliado':'Pendiente'}
                  </span>
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
export default function Bancos() {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [cuentas,     setCuentas]     = useState([])
  const [bancosList,  setBancosList]  = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [resumen,     setResumen]     = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [tab,         setTab]         = useState('movimientos') // movimientos|cuentas
  const [filtCuenta,  setFiltCuenta]  = useState('')
  const [filtFecIni,  setFiltFecIni]  = useState(hoy())
  const [filtFecFin,  setFiltFecFin]  = useState(hoy())
  const [filtTipo,    setFiltTipo]    = useState('')
  const [filtEstado,  setFiltEstado]  = useState('')
  const [modalMov,    setModalMov]    = useState(false)
  const [modalCuenta, setModalCuenta] = useState(null) // null=cerrado, false=nuevo, obj=editar
  const [panelLote,   setPanelLote]   = useState(null)
  const [sucNombre,   setSucNombre]   = useState('')

  const user = JSON.parse(localStorage.getItem('nexus_user')||'{}')

  async function cargar() {
    setLoading(true)
    try {
      const[c,m,r,bl]=await Promise.all([
        api.get('/bancos/cuentas'),
        api.get('/bancos/movimientos',{params:{
          cuenta_id: filtCuenta||undefined,
          fecha_ini: filtFecIni||undefined,
          fecha_fin: filtFecFin||undefined,
          tipo:      filtTipo||undefined,
          estado:    filtEstado||undefined,
        }}),
        api.get('/bancos/resumen'),
        api.get('/bancos/lista').catch(()=>({data:[]})),
      ])
      setCuentas(c.data); setMovimientos(m.data); setResumen(r.data)
      setBancosList(bl.data||[])
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

  async function conciliarMov(mov) {
    await api.patch(`/bancos/movimientos/${mov.id}/conciliar`)
    cargar()
  }

  const TH=(a='left')=>({padding:'10px 14px',fontSize:10,fontWeight:700,
    color:C.hint,textAlign:a,background:C.sur3,
    borderBottom:`1px solid ${C.bord2}`,textTransform:'uppercase',
    letterSpacing:'.05em',whiteSpace:'nowrap'})
  const TD=(a='left')=>({padding:'11px 14px',fontSize:13,
    borderBottom:`1px solid ${C.border}`,verticalAlign:'middle',
    color:C.text,textAlign:a})

  return(
    <div style={{background:C.bg,minHeight:'100vh',padding:'24px 28px',
      fontFamily:"'Inter','Segoe UI',system-ui,sans-serif",color:C.text}}>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',
        alignItems:'flex-start',marginBottom:20}}>
        <div>
          <h1 style={{margin:0,fontSize:24,fontWeight:800}}>🏦 Bancos</h1>
          {sucNombre&&(
            <div style={{display:'flex',alignItems:'center',gap:7,marginTop:5,
              padding:'4px 12px',borderRadius:8,width:'fit-content',
              background:C.greenD,border:`1px solid rgba(16,185,129,.25)`}}>
              <span style={{fontSize:13,fontWeight:700,color:C.green}}>🏢 {sucNombre}</span>
            </div>
          )}
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>setModalCuenta(false)}
            style={{padding:'9px 16px',borderRadius:9,cursor:'pointer',
              border:`1px solid ${C.bord2}`,background:C.sur2,
              color:C.muted,fontSize:13,fontWeight:600}}>
            + Nueva cuenta
          </button>
          <button onClick={()=>setModalMov(true)}
            style={{padding:'10px 20px',borderRadius:10,border:'none',
              background:C.blue,color:'white',cursor:'pointer',
              fontSize:14,fontWeight:700,
              boxShadow:'0 4px 14px rgba(59,130,246,.4)'}}>
            + Nuevo movimiento
          </button>
        </div>
      </div>

      {/* KPIs */}
      {resumen&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:20}}>
          {[
            {l:'Cuentas activas',   v:resumen.cuentas,          c:C.blue,   noFmt:true},
            {l:'Total ingresos',    v:resumen.total_ingresos,    c:C.green},
            {l:'Total egresos',     v:resumen.total_egresos,     c:C.red},
            {l:'Movimientos pend.', v:resumen.pendientes,        c:C.amber,  noFmt:true},
          ].map((k,i)=>(
            <div key={i} style={{background:C.surface,borderRadius:12,
              padding:'14px 16px',border:`1px solid ${C.bord2}`}}>
              <div style={{fontSize:10,color:C.hint,fontWeight:600,
                textTransform:'uppercase'}}>{k.l}</div>
              <div style={{fontSize:22,fontWeight:800,color:k.c,marginTop:6}}>
                {k.noFmt?k.v:fmt$(k.v)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{display:'flex',gap:4,marginBottom:16,
        borderBottom:`1px solid ${C.bord2}`,paddingBottom:0}}>
        {[['movimientos','📋 Movimientos'],['cuentas','🏦 Cuentas']].map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)}
            style={{padding:'10px 20px',border:'none',cursor:'pointer',
              fontSize:13,fontWeight:600,background:'transparent',
              color:tab===v?C.text:C.hint,
              borderBottom:tab===v?`2px solid ${C.blue}`:'2px solid transparent',
              marginBottom:-1}}>
            {l}
          </button>
        ))}
      </div>

      {/* ── TAB MOVIMIENTOS ── */}
      {tab==='movimientos'&&(
        <div>
          {/* Filtros */}
          <div style={{background:C.surface,borderRadius:12,padding:'12px 16px',
            border:`1px solid ${C.bord2}`,marginBottom:14,
            display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
            <select value={filtCuenta} onChange={e=>setFiltCuenta(e.target.value)}
              style={{...FI,width:200}}>
              <option value="">Todas las cuentas</option>
              {cuentas.map(c=>(
                <option key={c.id} value={c.id}>{c.banco} — {c.numero_cuenta}</option>
              ))}
            </select>
            <input type="date" value={filtFecIni}
              onChange={e=>setFiltFecIni(e.target.value)}
              style={{...FI,width:140}}/>
            <span style={{color:C.hint,fontSize:13}}>a</span>
            <input type="date" value={filtFecFin}
              onChange={e=>setFiltFecFin(e.target.value)}
              style={{...FI,width:140}}/>
            <select value={filtTipo} onChange={e=>setFiltTipo(e.target.value)}
              style={{...FI,width:180}}>
              <option value="">Todos los tipos</option>
              {TIPOS.map(t=><option key={t.v} value={t.v}>{t.e} {t.l}</option>)}
            </select>
            <select value={filtEstado} onChange={e=>setFiltEstado(e.target.value)}
              style={{...FI,width:150}}>
              <option value="">Todos</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="CONCILIADO">Conciliado</option>
            </select>
            <button onClick={cargar}
              style={{padding:'8px 16px',borderRadius:9,border:'none',
                background:C.blue,color:'white',cursor:'pointer',
                fontSize:13,fontWeight:600}}>
              Buscar
            </button>
          </div>

          <div style={{background:C.surface,borderRadius:12,
            border:`1px solid ${C.bord2}`,overflow:'hidden'}}>
            {loading?(
              <div style={{padding:40,textAlign:'center',color:C.hint}}>Cargando...</div>
            ):(
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead>
                  <tr>
                    {['Fecha','Tipo','Concepto','Banco / Cuenta','Referencia',
                      'Monto','Estado',''].map((h,i)=>(
                      <th key={i} style={TH(i===5?'right':'left')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map(m=>{
                    const tipo = TIPOS.find(t=>t.v===m.tipo)
                    const esLote = m.tipo==='LOTE_TARJETA'
                    const conciliado = m.estado==='CONCILIADO'
                    return(
                      <tr key={m.id}
                        onMouseEnter={e=>e.currentTarget.style.background=C.sur2}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <td style={{...TD(),fontSize:12,color:C.muted}}>
                          {new Date(m.fecha+'T12:00:00').toLocaleDateString('es-EC')}
                        </td>
                        <td style={TD()}>
                          <span style={{padding:'3px 10px',borderRadius:20,
                            fontSize:11,fontWeight:700,
                            background:`${tipo?.c||C.hint}22`,color:tipo?.c||C.hint}}>
                            {tipo?.e} {tipo?.l}
                          </span>
                        </td>
                        <td style={TD()}>
                          <div style={{fontWeight:600}}>{m.concepto}</div>
                          {m.banco_origen&&(
                            <div style={{fontSize:11,color:C.hint}}>
                              {m.banco_origen}
                            </div>
                          )}
                          {esLote&&(
                            <div style={{fontSize:10,color:C.purple,marginTop:2}}>
                              {m.num_transacciones} vouchers
                              {m.num_conciliadas>0&&` · ${m.num_conciliadas} conciliados`}
                            </div>
                          )}
                        </td>
                        <td style={{...TD(),fontSize:12,color:C.muted}}>
                          <div style={{fontWeight:600,color:C.text}}>{m.banco}</div>
                          <div style={{fontSize:11}}>{m.numero_cuenta}</div>
                        </td>
                        <td style={{...TD(),fontSize:11,color:C.hint}}>
                          {m.referencia||'—'}
                        </td>
                        <td style={{...TD('right'),fontWeight:800,
                          color:['PAGO_PROVEEDOR','OTRO'].includes(m.tipo)?C.red:C.green}}>
                          {['PAGO_PROVEEDOR','OTRO'].includes(m.tipo)?'-':'+'}{fmt$(m.monto)}
                        </td>
                        <td style={TD()}>
                          <span style={{padding:'3px 10px',borderRadius:20,
                            fontSize:11,fontWeight:700,
                            background:conciliado?C.greenD:C.amberD,
                            color:conciliado?C.green:C.amber}}>
                            {conciliado?'✅ Conciliado':'⏳ Pendiente'}
                          </span>
                        </td>
                        <td style={{...TD('center')}}>
                          <div style={{display:'flex',gap:5,justifyContent:'center'}}>
                            {esLote&&(
                              <button onClick={()=>setPanelLote(m)}
                                title="Ver vouchers"
                                style={{padding:'4px 10px',borderRadius:7,
                                  cursor:'pointer',fontSize:11,fontWeight:700,
                                  border:`1px solid ${C.purple}44`,
                                  background:'rgba(139,92,246,.1)',
                                  color:C.purple}}>
                                Vouchers
                              </button>
                            )}
                            <span style={{padding:'3px 10px',borderRadius:20,fontSize:10,fontWeight:700,
                              background:conciliado?`${C.green}20`:`${C.amber}20`,
                              color:conciliado?C.green:C.amber}}>
                              {conciliado?'Conciliado':'Pendiente'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {movimientos.length===0&&(
                    <tr><td colSpan={8} style={{padding:'40px 0',
                      textAlign:'center',color:C.hint,fontSize:13}}>
                      No hay movimientos registrados
                    </td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── TAB CUENTAS ── */}
      {tab==='cuentas'&&(
        <div style={{display:'grid',
          gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
          {cuentas.map(c=>(
            <div key={c.id} style={{background:C.surface,borderRadius:14,
              border:`1px solid ${C.bord2}`,overflow:'hidden'}}>
              <div style={{padding:'14px 16px',
                background:'linear-gradient(135deg,#0f1f35,#0a1628)'}}>
                <div style={{fontSize:15,fontWeight:800,color:C.text}}>
                  🏦 {c.banco||c.nombre}
                </div>
                <div style={{fontSize:12,color:C.muted,marginTop:3}}>
                  {c.tipo} · {c.numero||c.nombre}
                </div>
                {c.titular&&(
                  <div style={{fontSize:11,color:C.hint,marginTop:2}}>
                    {c.titular}
                  </div>
                )}
              </div>
              <div style={{padding:'12px 16px'}}>
                <div style={{fontSize:10,color:C.hint,textTransform:'uppercase',
                  fontWeight:600}}>Saldo actual</div>
                <div style={{fontSize:22,fontWeight:800,
                  color:Number(c.saldo_actual)>=0?C.green:C.red}}>
                  {fmt$(c.saldo_actual)}
                </div>
                <div style={{display:'flex',gap:8,marginTop:12}}>
                  <button onClick={()=>setModalCuenta(c)}
                    style={{flex:1,padding:'8px',borderRadius:8,cursor:'pointer',
                      border:`1px solid ${C.bord2}`,background:C.sur2,
                      color:C.muted,fontSize:12}}>
                    ✏️ Editar
                  </button>
                  <button onClick={async()=>{
                    if(!window.confirm('¿Eliminar esta cuenta?')) return
                    try{await api.delete(`/bancos/cuentas/${c.id}`);cargar()}
                    catch(e){alert(e.response?.data?.detail||e.message)}
                  }}
                    style={{padding:'8px 12px',borderRadius:8,cursor:'pointer',
                      border:`1px solid ${C.bord2}`,background:C.sur2,
                      color:C.hint,fontSize:12}}>
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
          {cuentas.length===0&&(
            <div style={{gridColumn:'1/-1',padding:40,textAlign:'center',
              color:C.hint,fontSize:13,background:C.surface,
              borderRadius:14,border:`1px solid ${C.bord2}`}}>
              No hay cuentas bancarias configuradas
            </div>
          )}
        </div>
      )}

      {/* Modales */}
      {modalMov&&(
        <ModalMovimiento
          cuentas={cuentas}
          onCerrar={()=>setModalMov(false)}
          onGuardado={()=>{setModalMov(false);cargar()}}
        />
      )}
      {modalCuenta!==null&&(
        <ModalCuenta
          cuenta={modalCuenta||null}
          bancosList={bancosList}
          onCerrar={()=>setModalCuenta(null)}
          onGuardado={()=>{setModalCuenta(null);cargar()}}
        />
      )}
      {panelLote&&(
        <PanelLote
          mov={panelLote}
          onCerrar={()=>setPanelLote(null)}
          onActualizado={cargar}
        />
      )}
    </div>
  )
}