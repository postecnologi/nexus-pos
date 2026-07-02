// ============================================================
//  NEXUS POS — Cuentas por Cobrar (CXC)
//  Archivo: frontend/src/pages/CXC.jsx
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

// ── Badge estado ─────────────────────────────────────────────
function BadgeEstado({estado, diasVencido}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const cfg = estado==='VENCIDA'
    ? {bg:C.redD,  color:C.red,   label:`Vencida ${diasVencido}d`}
    : estado==='PAGADA'
    ? {bg:C.greenD,color:C.green, label:'Pagada'}
    : {bg:C.amberD,color:C.amber, label:'Pendiente'}
  return (
    <span style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,
      background:cfg.bg,color:cfg.color}}>
      {cfg.label}
    </span>
  )
}

// ── Modal Abonar ─────────────────────────────────────────────
function ModalAbonar({cxc, cuentasBanc=[], onCerrar, onGuardado}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const BANCOS=['Banco Pichincha','Banco del Pacífico','Banco Guayaquil',
    'Produbanco','Banco Internacional','Banco Bolivariano','BanEcuador','Coop. JEP']
  const METODOS=[
    {id:'EFECTIVO',     l:'Efectivo',     e:'💵'},
    {id:'TARJETA',      l:'Tarjeta',      e:'💳'},
    {id:'TRANSFERENCIA',l:'Transferencia',e:'🏦'},
    {id:'DEUNA',        l:'DeUna',        e:'📲'},
    {id:'CHEQUE',       l:'Cheque',       e:'📄'},
  ]
  const [pagos, setPagos]   = useState([])
  const [obs,   setObs]     = useState('')
  const [saving,setSaving]  = useState(false)
  const [err,   setErr]     = useState('')

  const totalPagado = pagos.reduce((a,p)=>a+Number(p.monto||0),0)
  const saldo       = Number(cxc.saldo)
  const falta       = Math.max(0, saldo - totalPagado)
  const listo       = pagos.length>0 && totalPagado>0

  function agregar(id) {
    const uid = id+'_'+Date.now()
    setPagos(p=>[...p,{uid, metodo:id,
      monto: falta>0 ? parseFloat(falta.toFixed(2)) : 0,
      referencia:'', autorizacion:'',
      banco_origen:'', cuenta_bancaria_id:null}])
  }
  const upd=(uid,k,v)=>setPagos(p=>p.map(x=>x.uid===uid?{...x,[k]:v}:x))
  const del=(uid)=>setPagos(p=>p.filter(x=>x.uid!==uid))
  const fi2={padding:'7px 10px',borderRadius:8,fontSize:13,
    border:`1px solid ${C.bord2}`,background:C.sur2,
    color:C.text,outline:'none',width:'100%',marginTop:5}

  async function guardar() {
    if(pagos.length===0) return setErr('Agrega al menos una forma de pago')
    if(totalPagado<=0)   return setErr('El total debe ser mayor a 0')
    setSaving(true); setErr('')
    try {
      // Enviar cada pago como abono separado
      for(const p of pagos){
        await api.post(`/cxc/${cxc.id}/abonar`, {
          monto:             parseFloat(p.monto)||0,
          forma_pago:        p.metodo,
          referencia:        p.referencia||null,
          banco_origen:      p.banco_origen||null,
          cuenta_bancaria_id:p.cuenta_bancaria_id||null,
          observaciones:     obs||null,
        })
      }
      onGuardado({total: totalPagado})
    } catch(e) { setErr(e.response?.data?.detail||e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:9000}}>
      <div style={{background:C.surface,borderRadius:16,padding:28,width:480,
        border:`1px solid ${C.bord2}`,boxShadow:'0 25px 60px rgba(0,0,0,.7)'}}>

        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',
          alignItems:'center',marginBottom:20}}>
          <div style={{fontSize:16,fontWeight:700,color:C.text}}>💰 Registrar abono</div>
          <button onClick={onCerrar} style={{background:'none',border:'none',
            cursor:'pointer',color:C.hint,fontSize:22}}>×</button>
        </div>

        {/* Info cuenta */}
        <div style={{background:C.sur2,borderRadius:10,padding:'12px 14px',
          marginBottom:18,border:`1px solid ${C.bord2}`}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text}}>{cxc.cliente_nombre}</div>
          <div style={{fontSize:11,color:C.muted,marginTop:3}}>
            {cxc.numero_factura&&<span style={{color:C.purple}}>Factura {cxc.numero_factura} · </span>}
            Vence: {new Date(cxc.fecha_vencimiento).toLocaleDateString('es-EC')}
          </div>
          <div style={{display:'flex',gap:20,marginTop:10}}>
            <div>
              <div style={{fontSize:10,color:C.hint}}>MONTO ORIGINAL</div>
              <div style={{fontSize:15,fontWeight:700,color:C.muted}}>{fmt$(cxc.monto)}</div>
            </div>
            <div>
              <div style={{fontSize:10,color:C.hint}}>YA ABONADO</div>
              <div style={{fontSize:15,fontWeight:700,color:C.green}}>{fmt$(cxc.abonado)}</div>
            </div>
            <div>
              <div style={{fontSize:10,color:C.hint}}>SALDO PENDIENTE</div>
              <div style={{fontSize:18,fontWeight:800,color:C.amber}}>{fmt$(cxc.saldo)}</div>
            </div>
          </div>
        </div>

        {/* Forma de pago */}
        <div style={{marginBottom:14}}>
          <label style={{fontSize:11,fontWeight:700,color:C.muted,
            display:'block',marginBottom:6,textTransform:'uppercase'}}>
            Forma de pago
          </label>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
            {METODOS.map(m=>{
              const cnt=pagos.filter(p=>p.metodo===m.id).length
              return(
                <button key={m.id} onClick={()=>agregar(m.id)}
                  style={{padding:'8px 4px',borderRadius:8,cursor:'pointer',fontSize:11,
                    fontWeight:cnt>0?700:400,position:'relative',
                    border:cnt>0?`1.5px solid ${C.blue}`:`1px solid ${C.bord2}`,
                    background:cnt>0?C.blueD:C.sur2,
                    color:cnt>0?C.blue:C.muted}}>
                  {m.e} {m.l}
                  {cnt>1&&<span style={{position:'absolute',top:-4,right:-4,
                    fontSize:9,fontWeight:800,padding:'1px 4px',borderRadius:6,
                    background:C.blue,color:'white'}}>{cnt}</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Líneas de pago */}
        {pagos.map((p,pi)=>{
          const m=METODOS.find(x=>x.id===p.metodo)
          const mismoTipo=pagos.filter(x=>x.metodo===p.metodo).length>1
          return(
            <div key={p.uid} style={{background:C.sur2,borderRadius:10,padding:12,
              marginBottom:8,border:`1px solid ${C.bord2}`}}>
              {/* Header línea */}
              <div style={{display:'flex',justifyContent:'space-between',
                alignItems:'center',marginBottom:8}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:16}}>{m?.e}</span>
                  <span style={{fontSize:13,fontWeight:700,color:C.text}}>{m?.l}</span>
                  {mismoTipo&&<span style={{fontSize:10,padding:'1px 6px',borderRadius:8,
                    background:C.blueD,color:C.blue,fontWeight:700}}>#{pi+1}</span>}
                </div>
                <button onClick={()=>del(p.uid)}
                  style={{padding:'4px 10px',borderRadius:7,cursor:'pointer',
                    border:`1px solid ${C.red}44`,background:C.redD,
                    color:C.red,fontSize:11,fontWeight:700}}>
                  🗑 Quitar
                </button>
              </div>
              {/* Monto */}
              <input type="number" step="0.01" value={p.monto}
                onChange={e=>upd(p.uid,'monto',parseFloat(e.target.value)||0)}
                style={{...fi2,fontSize:18,fontWeight:800,textAlign:'right',
                  background:C.sur3,borderColor:C.blue}}/>
              {/* Campos por tipo */}
              {p.metodo==='TARJETA'&&<>
                <div style={{marginTop:10}}>
                  <div style={{fontSize:10,color:C.hint,marginBottom:2,fontWeight:600}}>N° TARJETA (enmascarado)</div>
                  <input value={p.num_tarjeta||''} onChange={e=>upd(p.uid,'num_tarjeta',e.target.value)}
                    placeholder="4560XXXXXXXX6352" maxLength={19}
                    style={{...fi2,letterSpacing:'2px',fontFamily:'monospace',fontSize:14}}/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:8}}>
                  <div>
                    <div style={{fontSize:10,color:C.hint,marginBottom:2,fontWeight:600}}>N° AUTORIZACIÓN</div>
                    <input value={p.autorizacion||''} onChange={e=>upd(p.uid,'autorizacion',e.target.value)}
                      placeholder="N° autorización" style={fi2}/>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:C.hint,marginBottom:2,fontWeight:600}}>N° LOTE</div>
                    <input value={p.referencia||''} onChange={e=>upd(p.uid,'referencia',e.target.value)}
                      placeholder="N° lote" style={fi2}/>
                  </div>
                </div>
              </>}
              {p.metodo==='TRANSFERENCIA'&&<>
                <div style={{marginTop:10}}>
                  <div style={{fontSize:10,color:C.hint,marginBottom:2,fontWeight:600}}>BANCO ORIGEN (cliente)</div>
                  <input value={p.banco_origen||''} onChange={e=>upd(p.uid,'banco_origen',e.target.value)}
                    placeholder="Banco del cliente" list={"bo-"+p.uid} style={fi2}/>
                  <datalist id={"bo-"+p.uid}>{BANCOS.map((b,i)=><option key={i} value={b}/>)}</datalist>
                </div>
                <div style={{marginTop:8}}>
                  <div style={{fontSize:10,color:C.hint,marginBottom:2,fontWeight:600}}>CUENTA BANCARIA QUE RECIBE</div>
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
                  <div style={{fontSize:10,color:C.hint,marginBottom:2,fontWeight:600}}>N° COMPROBANTE</div>
                  <input value={p.referencia||''} onChange={e=>upd(p.uid,'referencia',e.target.value)}
                    placeholder="N° comprobante de transferencia" style={fi2}/>
                </div>
              </>}
              {p.metodo==='DEUNA'&&<>
                <div style={{marginTop:10}}>
                  <div style={{fontSize:10,color:C.hint,marginBottom:2,fontWeight:600}}>CUENTA BANCARIA QUE RECIBE</div>
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
                  <div style={{fontSize:10,color:C.hint,marginBottom:2,fontWeight:600}}>N° TRANSACCIÓN DEUNA</div>
                  <input value={p.referencia||''} onChange={e=>upd(p.uid,'referencia',e.target.value)}
                    placeholder="Código de transacción DeUna" style={fi2}/>
                </div>
              </>}
              {p.metodo==='CHEQUE'&&<>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:10}}>
                  <div>
                    <div style={{fontSize:10,color:C.hint,marginBottom:2,fontWeight:600}}>N° CHEQUE</div>
                    <input value={p.referencia||''} onChange={e=>upd(p.uid,'referencia',e.target.value)}
                      placeholder="N° cheque" style={fi2}/>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:C.hint,marginBottom:2,fontWeight:600}}>BANCO EMISOR</div>
                    <input value={p.banco_origen||''} onChange={e=>upd(p.uid,'banco_origen',e.target.value)}
                      placeholder="Banco del cheque" list={"bc-"+p.uid} style={fi2}/>
                    <datalist id={"bc-"+p.uid}>{BANCOS.map((b,i)=><option key={i} value={b}/>)}</datalist>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:C.hint,marginBottom:2,fontWeight:600}}>FECHA DEL CHEQUE</div>
                    <input type="date" value={p.fecha_cheque||''} onChange={e=>upd(p.uid,'fecha_cheque',e.target.value)}
                      style={fi2}/>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:C.hint,marginBottom:2,fontWeight:600}}>TITULAR DEL CHEQUE</div>
                    <input value={p.titular_cheque||''} onChange={e=>upd(p.uid,'titular_cheque',e.target.value)}
                      placeholder="Nombre del girador" style={fi2}/>
                  </div>
                </div>
              </>}

            </div>
          )
        })}

        {pagos.length===0&&(
          <div style={{padding:'16px',textAlign:'center',color:C.hint,fontSize:13,
            background:C.sur2,borderRadius:8,marginBottom:12,border:`1px dashed ${C.bord2}`}}>
            Selecciona una forma de pago arriba
          </div>
        )}

        {/* Observaciones */}
        {/* Observaciones */}
        <div style={{marginBottom:16}}>
          <label style={{fontSize:10,color:C.hint,display:'block',marginBottom:3}}>
            OBSERVACIONES
          </label>
          <input value={obs} onChange={e=>setObs(e.target.value)}
            placeholder="Notas adicionales..." style={FI}/>
        </div>

        {err&&<div style={{marginBottom:12,padding:'8px 12px',borderRadius:8,
          background:C.redD,color:'#FCA5A5',fontSize:12,
          border:'1px solid rgba(239,68,68,.3)'}}>⚠️ {err}</div>}

        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <button onClick={onCerrar} style={{padding:'10px 20px',borderRadius:9,
            border:`1px solid ${C.bord2}`,background:'transparent',
            color:C.muted,cursor:'pointer',fontSize:13}}>Cancelar</button>
          <button onClick={guardar} disabled={saving}
            style={{padding:'10px 26px',borderRadius:9,border:'none',
              background:saving?C.sur3:C.green,color:saving?C.hint:'white',
              cursor:saving?'not-allowed':'pointer',fontSize:13,fontWeight:800,
              boxShadow:saving?'none':'0 4px 16px rgba(16,185,129,.4)'}}>
            {saving?'Guardando...':'✓ Registrar abono'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal Historial de abonos ────────────────────────────────
function ModalHistorial({cxc, onCerrar}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [abonos, setAbonos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    api.get(`/cxc/${cxc.id}/abonos`)
      .then(r=>setAbonos(r.data))
      .catch(()=>{})
      .finally(()=>setLoading(false))
  },[cxc.id])

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:9000}}>
      <div style={{background:C.surface,borderRadius:16,padding:28,width:560,
        maxHeight:'80vh',display:'flex',flexDirection:'column',
        border:`1px solid ${C.bord2}`,boxShadow:'0 25px 60px rgba(0,0,0,.7)'}}>
        <div style={{display:'flex',justifyContent:'space-between',
          alignItems:'center',marginBottom:20}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:C.text}}>
              📋 Historial de abonos
            </div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>
              {cxc.cliente_nombre} · {cxc.numero_factura||'Sin factura'}
            </div>
          </div>
          <button onClick={onCerrar} style={{background:'none',border:'none',
            cursor:'pointer',color:C.hint,fontSize:22}}>×</button>
        </div>

        <div style={{flex:1,overflowY:'auto'}}>
          {loading&&<div style={{textAlign:'center',padding:24,color:C.hint}}>Cargando...</div>}
          {!loading&&abonos.length===0&&(
            <div style={{textAlign:'center',padding:24,color:C.hint,fontSize:13}}>
              Sin abonos registrados
            </div>
          )}
          {abonos.map((a,i)=>(
            <div key={i} style={{padding:'12px 14px',borderRadius:10,marginBottom:8,
              background:C.sur2,border:`1px solid ${C.bord2}`,
              display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:C.text}}>
                  {a.forma_pago}
                  {a.banco_origen&&<span style={{color:C.muted,fontWeight:400}}> · {a.banco_origen}</span>}
                  {a.referencia&&<span style={{color:C.hint,fontSize:11}}> ({a.referencia})</span>}
                </div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>
                  {new Date(a.fecha).toLocaleDateString('es-EC')}
                  {a.usuario_nombre&&` · ${a.usuario_nombre}`}
                  {a.observaciones&&` · ${a.observaciones}`}
                </div>
              </div>
              <div style={{fontSize:16,fontWeight:800,color:C.green,flexShrink:0}}>
                {fmt$(a.monto)}
              </div>
            </div>
          ))}
        </div>

        {/* Resumen */}
        <div style={{marginTop:14,padding:'12px 14px',borderRadius:10,
          background:C.sur2,border:`1px solid ${C.bord2}`,
          display:'flex',justifyContent:'space-between'}}>
          <div>
            <div style={{fontSize:10,color:C.hint}}>TOTAL ABONADO</div>
            <div style={{fontSize:16,fontWeight:800,color:C.green}}>
              {fmt$(abonos.reduce((a,x)=>a+Number(x.monto),0))}
            </div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:10,color:C.hint}}>SALDO ACTUAL</div>
            <div style={{fontSize:16,fontWeight:800,color:Number(cxc.saldo)===0?C.green:C.amber}}>
              {fmt$(cxc.saldo)}
            </div>
          </div>
        </div>

        <button onClick={onCerrar} style={{marginTop:14,padding:'9px',borderRadius:9,
          border:`1px solid ${C.bord2}`,background:'transparent',
          color:C.muted,cursor:'pointer',fontSize:13}}>Cerrar</button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  PÁGINA PRINCIPAL CXC
// ════════════════════════════════════════════════════════════
export default function CXC() {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const user = JSON.parse(localStorage.getItem('nexus_user')||'{}')
  const [cuentas,    setCuentas]   = useState([])
  const [cuentasBanc,setCuentasBanc]=useState([])
  const [resumen,    setResumen]   = useState(null)
  const [loading,    setLoading]   = useState(true)
  const [busqueda,   setBusqueda]  = useState('')
  const [filtro,     setFiltro]    = useState('todas')
  const [selected,   setSelected]  = useState([])
  const [modalAbon,  setModalAbon] = useState(null)
  const [modalHist,  setModalHist] = useState(null)
  const [msgRecord,  setMsgRecord] = useState('')
  const [sendingRec, setSendingRec]= useState(false)
  const [sucursales, setSucursales]= useState([])
  // Por defecto: sucursal del usuario logueado, null = todas
  const [sucursalId, setSucursalId]= useState(user.sucursal_id||null)

  async function cargar(bus=busqueda) {
    setLoading(true)
    try {
      const params = { busqueda:bus }
      if (filtro!=='todas') params.estado = filtro
      if (sucursalId)       params.sucursal_id = sucursalId
      const [c,r,s,cb] = await Promise.all([
        api.get('/cxc',          {params}),
        api.get('/cxc/resumen',  {params:{sucursal_id:sucursalId||undefined}}),
        api.get('/config/sucursales').catch(()=>({data:[]})),
        api.get('/bancos/cuentas').catch(()=>({data:[]})),
      ])
      setCuentas(c.data); setResumen(r.data); setSucursales(s.data)
      setCuentasBanc(cb.data||[])
    } catch(e){console.error(e)}
    finally{setLoading(false)}
  }

  useEffect(()=>{cargar()},[filtro, sucursalId])

  function toggleSelect(id) {
    setSelected(prev => prev.includes(id)
      ? prev.filter(x=>x!==id)
      : [...prev,id])
  }
  function selectAll() {
    setSelected(selected.length===cuentas.length?[]:cuentas.map(c=>c.id))
  }

  async function enviarRecordatorio() {
    if (selected.length===0) return
    setSendingRec(true); setMsgRecord('')
    let enviados = 0, errores = 0
    for (const id of selected) {
      try {
        await api.post(`/alertas/recordatorio-cobro/${id}`)
        enviados++
      } catch(e) {
        errores++
      }
    }
    setMsgRecord(`✅ ${enviados} recordatorio(s) enviado(s)${errores>0?` · ${errores} sin email`:''}.`)
    setSelected([])
    setSendingRec(false)
  }

  const TH=(a='left')=>({padding:'10px 12px',fontSize:10,fontWeight:700,
    color:C.hint,textAlign:a,background:C.sur3,
    borderBottom:`1px solid ${C.bord2}`,textTransform:'uppercase',
    letterSpacing:'.05em',whiteSpace:'nowrap'})
  const TD=(a='left')=>({padding:'11px 12px',fontSize:13,
    borderBottom:`1px solid ${C.border}`,verticalAlign:'middle',
    color:C.text,textAlign:a})

  const KPIs = resumen ? [
    {l:'Total cartera',   v:fmt$(resumen.total_cartera),   c:C.blue,   bg:C.blueD},
    {l:'Vencido',         v:fmt$(resumen.total_vencido),   c:C.red,    bg:C.redD},
    {l:'Por vencer',      v:fmt$(resumen.total_por_vencer),c:C.amber,  bg:C.amberD},
    {l:'Ctas. vencidas',  v:resumen.cuentas_vencidas,      c:C.red,    bg:C.redD},
  ] : []

  return (
    <div style={{background:C.bg,minHeight:'100vh',padding:'24px 28px',
      fontFamily:"'Inter','Segoe UI',system-ui,sans-serif",color:C.text}}>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',
        alignItems:'flex-start',marginBottom:24}}>
        <div>
          <h1 style={{margin:0,fontSize:24,fontWeight:800}}>💳 Cuentas por Cobrar</h1>
          <p style={{margin:'4px 0 0',color:C.muted,fontSize:13}}>
            {resumen?.cuentas_pendientes||0} cuentas con saldo pendiente
            {sucursalId && sucursales.length>0 && (
              <span style={{marginLeft:8,color:C.blue,fontWeight:600}}>
                · {sucursales.find(s=>s.id===sucursalId)?.nombre||''}
              </span>
            )}
            {!sucursalId&&<span style={{marginLeft:8,color:C.hint}}>· Todas las sucursales</span>}
          </p>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          {selected.length>0&&(
            <button onClick={enviarRecordatorio} disabled={sendingRec}
              style={{padding:'9px 18px',borderRadius:9,border:`1px solid ${C.purple}`,
                background:`rgba(139,92,246,.15)`,color:C.purple,
                cursor:'pointer',fontSize:13,fontWeight:700}}>
              📧 Recordatorio ({selected.length})
            </button>
          )}
        </div>
      </div>

      {msgRecord&&(
        <div style={{marginBottom:16,padding:'10px 16px',borderRadius:9,fontSize:13,
          background:msgRecord.startsWith('✅')?C.greenD:C.redD,
          color:msgRecord.startsWith('✅')?C.green:'#FCA5A5',
          border:`1px solid ${msgRecord.startsWith('✅')?'rgba(16,185,129,.3)':'rgba(239,68,68,.3)'}`}}>
          {msgRecord}
        </div>
      )}

      {/* KPIs */}
      {resumen&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:24}}>
          {KPIs.map((k,i)=>(
            <div key={i} style={{background:C.surface,borderRadius:12,padding:'16px 18px',
              border:`1px solid ${C.bord2}`}}>
              <div style={{fontSize:11,color:C.hint,fontWeight:600,
                textTransform:'uppercase',letterSpacing:'.05em'}}>{k.l}</div>
              <div style={{fontSize:22,fontWeight:800,color:k.c,marginTop:6}}>{k.v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div style={{background:C.surface,borderRadius:12,padding:'12px 16px',
        border:`1px solid ${C.bord2}`,marginBottom:16,
        display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
        <div style={{position:'relative',flex:1,minWidth:240}}>
          <span style={{position:'absolute',left:12,top:'50%',
            transform:'translateY(-50%)',color:C.hint}}>🔍</span>
          <input value={busqueda}
            onChange={e=>setBusqueda(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&cargar(busqueda)}
            placeholder="Buscar por cliente, RUC o N° factura..."
            style={{...FI,paddingLeft:32}}/>
        </div>
        <button onClick={()=>cargar(busqueda)}
          style={{padding:'8px 16px',borderRadius:9,border:'none',
            background:C.blue,color:'white',cursor:'pointer',
            fontSize:13,fontWeight:600}}>
          Buscar
        </button>

        {/* Selector de sucursal */}
        <select value={sucursalId||''}
          onChange={e=>setSucursalId(e.target.value?parseInt(e.target.value):null)}
          style={{...FI,width:180,background:sucursalId?'rgba(59,130,246,.12)':C.sur2,
            borderColor:sucursalId?C.blue:C.bord2,color:sucursalId?C.blue:C.text}}>
          <option value="">🏢 Todas las sucursales</option>
          {sucursales.map(s=>(
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>

        <div style={{display:'flex',borderRadius:9,overflow:'hidden',
          border:`1px solid ${C.bord2}`}}>
          {[
            {v:'todas',    l:'Todas'},
            {v:'VENCIDA',  l:'Vencidas'},
            {v:'PENDIENTE',l:'Por vencer'},
          ].map(({v,l})=>(
            <button key={v} onClick={()=>setFiltro(v)}
              style={{padding:'8px 14px',border:'none',cursor:'pointer',
                fontSize:12,fontWeight:600,
                background:filtro===v?C.blue:C.sur2,
                color:filtro===v?'white':C.muted,transition:'all .15s'}}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div style={{background:C.surface,borderRadius:12,
        border:`1px solid ${C.bord2}`,overflow:'hidden'}}>
        {loading ? (
          <div style={{padding:40,textAlign:'center',color:C.hint}}>Cargando...</div>
        ) : cuentas.length===0 ? (
          <div style={{padding:40,textAlign:'center',color:C.hint,fontSize:13}}>
            No hay cuentas por cobrar
          </div>
        ) : (
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr>
                <th style={{...TH(),paddingLeft:16}}>
                  <input type="checkbox"
                    checked={selected.length===cuentas.length&&cuentas.length>0}
                    onChange={selectAll}
                    style={{cursor:'pointer',accentColor:C.blue}}/>
                </th>
                <th style={TH()}>Cliente</th>
                <th style={TH()}>Factura</th>
                <th style={TH('center')}>Emisión</th>
                <th style={TH('center')}>Vencimiento</th>
                <th style={TH('right')}>Monto</th>
                <th style={TH('right')}>Abonado</th>
                <th style={TH('right')}>Saldo</th>
                <th style={TH('center')}>Estado</th>
                <th style={TH('center')}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cuentas.map(c=>{
                const vencida = c.estado_calculado==='VENCIDA'
                const rowBg   = vencida?'rgba(239,68,68,.04)':'transparent'
                return (
                  <tr key={c.id} style={{background:rowBg}}
                    onMouseEnter={e=>e.currentTarget.style.background=C.sur2}
                    onMouseLeave={e=>e.currentTarget.style.background=rowBg}>

                    <td style={{...TD(),paddingLeft:16}}>
                      <input type="checkbox"
                        checked={selected.includes(c.id)}
                        onChange={()=>toggleSelect(c.id)}
                        style={{cursor:'pointer',accentColor:C.blue}}/>
                    </td>

                    <td style={TD()}>
                      <div style={{fontWeight:700}}>{c.cliente_nombre}</div>
                      <div style={{fontSize:11,color:C.hint}}>
                        {c.cliente_ruc}
                        {c.cliente_telefono&&` · ${c.cliente_telefono}`}
                      </div>
                      {c.cliente_email&&(
                        <div style={{fontSize:10,color:C.cyan}}>{c.cliente_email}</div>
                      )}
                    </td>

                    <td style={TD()}>
                      <code style={{fontSize:12,color:C.purple,fontWeight:700}}>
                        {c.numero_factura||'—'}
                      </code>
                    </td>

                    <td style={{...TD('center'),fontSize:12,color:C.muted}}>
                      {new Date(c.fecha_emision).toLocaleDateString('es-EC')}
                    </td>

                    <td style={{...TD('center'),fontSize:12,
                      color:vencida?C.red:C.muted,fontWeight:vencida?700:400}}>
                      {new Date(c.fecha_vencimiento).toLocaleDateString('es-EC')}
                    </td>

                    <td style={{...TD('right'),color:C.muted}}>{fmt$(c.monto)}</td>

                    <td style={{...TD('right'),color:C.green,fontWeight:600}}>
                      {c.abonado>0?fmt$(c.abonado):'—'}
                    </td>

                    <td style={{...TD('right'),fontWeight:800,
                      color:vencida?C.red:C.amber,fontSize:14}}>
                      {fmt$(c.saldo)}
                    </td>

                    <td style={{...TD('center')}}>
                      <BadgeEstado estado={c.estado_calculado}
                        diasVencido={c.dias_vencido}/>
                    </td>

                    <td style={{...TD('center')}}>
                      <div style={{display:'flex',gap:5,justifyContent:'center'}}>
                        <button onClick={()=>setModalAbon(c)}
                          title="Registrar abono"
                          style={{padding:'5px 10px',borderRadius:7,
                            border:`1px solid ${C.green}`,
                            background:`rgba(16,185,129,.15)`,
                            color:C.green,cursor:'pointer',fontSize:12,fontWeight:700}}>
                          💰 Abonar
                        </button>
                        <button onClick={()=>setModalHist(c)}
                          title="Ver historial"
                          style={{padding:'5px 9px',borderRadius:7,
                            border:`1px solid ${C.bord2}`,
                            background:C.sur2,color:C.muted,cursor:'pointer',fontSize:12}}>
                          📋
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Totales al pie */}
      {cuentas.length>0&&(
        <div style={{marginTop:12,display:'flex',gap:20,justifyContent:'flex-end',
          padding:'12px 16px',background:C.surface,borderRadius:10,
          border:`1px solid ${C.bord2}`}}>
          <div style={{fontSize:12,color:C.hint}}>
            {cuentas.length} cuenta{cuentas.length!==1?'s':''}
          </div>
          <div style={{fontSize:13,color:C.muted}}>
            Total saldo: <strong style={{color:C.amber}}>
              {fmt$(cuentas.reduce((a,c)=>a+Number(c.saldo),0))}
            </strong>
          </div>
          <div style={{fontSize:13,color:C.muted}}>
            Vencido: <strong style={{color:C.red}}>
              {fmt$(cuentas.filter(c=>c.estado_calculado==='VENCIDA')
                .reduce((a,c)=>a+Number(c.saldo),0))}
            </strong>
          </div>
        </div>
      )}

      {modalAbon&&(
        <ModalAbonar
          cxc={modalAbon}
          cuentasBanc={cuentasBanc}
          onCerrar={()=>setModalAbon(null)}
          onGuardado={()=>{setModalAbon(null);cargar()}}
        />
      )}
      {modalHist&&(
        <ModalHistorial
          cxc={modalHist}
          onCerrar={()=>setModalHist(null)}
        />
      )}
    </div>
  )
}