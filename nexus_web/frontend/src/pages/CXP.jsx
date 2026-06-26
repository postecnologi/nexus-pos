// ============================================================
//  NEXUS POS — Cuentas por Pagar (CXP)
//  Archivo: frontend/src/pages/CXP.jsx
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
  {minimumFractionDigits:2, maximumFractionDigits:2})

const FI = {
  padding:'8px 11px', borderRadius:8, fontSize:13,
  border:`1px solid ${C.bord2}`, background:C.sur2,
  color:C.text, outline:'none', boxSizing:'border-box', width:'100%'
}

const BANCOS = [
  'Banco Pichincha','Banco del Pacífico','Banco Guayaquil',
  'Produbanco','Banco Internacional','Banco Bolivariano',
  'BanEcuador','Cooperativa JEP','Banco Solidario'
]

// ── Badge estado ─────────────────────────────────────────────
function BadgeEstado({estado, diasVencido}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const cfg = estado==='VENCIDA'
    ? {bg:C.redD,  color:C.red,   label:`Vencida ${diasVencido||0}d`}
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

// ── Modal Pagar ──────────────────────────────────────────────
function ModalPagar({cxp, cuentasBanc=[], onCerrar, onGuardado}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [form, setForm] = useState({
    monto:            Number(cxp.saldo).toFixed(2),
    forma_pago:       'TRANSFERENCIA',
    referencia:       '',
    banco_origen:     '',
    banco_destino:    '',
    banco_tarjeta:    '',
    autorizacion:     '',
    fecha_cheque:     '',
    titular_cheque:   '',
    cuenta_bancaria_id: null,
    observaciones:    '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')
  const s = (k,v) => setForm(f=>({...f,[k]:v}))

  async function pagar() {
    if (!form.monto || parseFloat(form.monto)<=0)
      return setErr('Ingresa un monto válido')
    setSaving(true); setErr('')
    try {
      const {data} = await api.post(`/cxp/${cxp.id}/pagar`, {
        ...form, monto: parseFloat(form.monto)
      })
      onGuardado(data)
    } catch(e) { setErr(e.response?.data?.detail||e.message) }
    finally { setSaving(false) }
  }

  const METODOS = ['EFECTIVO','TRANSFERENCIA','CHEQUE','TARJETA']

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:9000}}>
      <div style={{background:C.surface,borderRadius:16,padding:28,width:500,
        maxHeight:'90vh',overflowY:'auto',
        border:`1px solid ${C.bord2}`,boxShadow:'0 25px 60px rgba(0,0,0,.7)'}}>

        <div style={{display:'flex',justifyContent:'space-between',
          alignItems:'center',marginBottom:20}}>
          <div style={{fontSize:16,fontWeight:800,color:C.text}}>💸 Registrar pago</div>
          <button onClick={onCerrar} style={{background:'none',border:'none',
            cursor:'pointer',color:C.hint,fontSize:22}}>×</button>
        </div>

        {/* Info cuenta */}
        <div style={{background:C.sur2,borderRadius:10,padding:'12px 14px',
          marginBottom:18,border:`1px solid ${C.bord2}`}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text}}>{cxp.proveedor_nombre}</div>
          <div style={{fontSize:11,color:C.muted,marginTop:3}}>
            {cxp.numero_compra&&<span style={{color:C.purple}}>Compra {cxp.numero_compra}</span>}
            {cxp.numero_factura_prov&&<span style={{color:C.muted}}> · Fact. {cxp.numero_factura_prov}</span>}
            <span style={{marginLeft:8}}>Vence: </span>
            <span style={{color:cxp.estado_calculado==='VENCIDA'?C.red:C.amber,fontWeight:600}}>
              {new Date(cxp.fecha_vencimiento).toLocaleDateString('es-EC')}
            </span>
          </div>
          <div style={{display:'flex',gap:20,marginTop:10}}>
            <div>
              <div style={{fontSize:10,color:C.hint}}>MONTO ORIGINAL</div>
              <div style={{fontSize:15,fontWeight:700,color:C.muted}}>{fmt$(cxp.monto)}</div>
            </div>
            <div>
              <div style={{fontSize:10,color:C.hint}}>YA PAGADO</div>
              <div style={{fontSize:15,fontWeight:700,color:C.green}}>{fmt$(cxp.pagado)}</div>
            </div>
            <div>
              <div style={{fontSize:10,color:C.hint}}>SALDO A PAGAR</div>
              <div style={{fontSize:20,fontWeight:800,color:C.amber}}>{fmt$(cxp.saldo)}</div>
            </div>
          </div>
        </div>

        {/* Monto */}
        <div style={{marginBottom:14}}>
          <label style={{fontSize:11,fontWeight:700,color:C.muted,
            display:'block',marginBottom:4,textTransform:'uppercase'}}>
            Monto del pago *
          </label>
          <input type="number" step="0.01" max={cxp.saldo} value={form.monto}
            onChange={e=>s('monto',e.target.value)}
            style={{...FI,fontSize:22,fontWeight:800,textAlign:'right',
              border:`1px solid ${C.amber}`}}/>
          <div style={{display:'flex',gap:8,marginTop:6}}>
            {[25,50,75,100].map(pct=>(
              <button key={pct} onClick={()=>s('monto',(cxp.saldo*pct/100).toFixed(2))}
                style={{flex:1,padding:'5px',borderRadius:7,
                  border:`1px solid ${C.bord2}`,background:C.sur3,
                  color:C.muted,cursor:'pointer',fontSize:11,fontWeight:600}}>
                {pct}%
              </button>
            ))}
          </div>
        </div>

        {/* Forma de pago */}
        <div style={{marginBottom:14}}>
          <label style={{fontSize:11,fontWeight:700,color:C.muted,
            display:'block',marginBottom:6,textTransform:'uppercase'}}>
            Forma de pago
          </label>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6}}>
            {METODOS.map(m=>(
              <button key={m} onClick={()=>s('forma_pago',m)}
                style={{padding:'8px 4px',borderRadius:8,cursor:'pointer',
                  fontSize:11,fontWeight:form.forma_pago===m?700:400,
                  border:form.forma_pago===m?`1.5px solid ${C.amber}`:`1px solid ${C.bord2}`,
                  background:form.forma_pago===m?C.amberD:C.sur2,
                  color:form.forma_pago===m?C.amber:C.muted}}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Campos extra transferencia */}
        {form.forma_pago==='TRANSFERENCIA'&&(
          <div style={{marginBottom:14}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
              <div>
                <label style={{fontSize:10,color:C.hint,display:'block',marginBottom:3,fontWeight:600}}>
                  BANCO DESTINO (proveedor)
                </label>
                <input value={form.banco_destino} onChange={e=>s('banco_destino',e.target.value)}
                  placeholder="Banco del proveedor" list="bancos-cxp-d" style={FI}/>
                <datalist id="bancos-cxp-d">
                  {BANCOS.map((b,i)=><option key={i} value={b}/>)}
                </datalist>
              </div>
              <div>
                <label style={{fontSize:10,color:C.hint,display:'block',marginBottom:3,fontWeight:600}}>
                  N° COMPROBANTE
                </label>
                <input value={form.referencia} onChange={e=>s('referencia',e.target.value)}
                  placeholder="N° transferencia" style={FI}/>
              </div>
            </div>
            <div>
              <label style={{fontSize:10,color:C.hint,display:'block',marginBottom:3,fontWeight:600}}>
                CUENTA BANCARIA QUE PAGA (nuestra)
              </label>
              <select value={form.cuenta_bancaria_id||''}
                onChange={e=>s('cuenta_bancaria_id',parseInt(e.target.value)||null)}
                style={{...FI,borderColor:form.cuenta_bancaria_id?C.red:C.bord2,
                  background:form.cuenta_bancaria_id?C.redD:C.sur2}}>
                <option value="">-- Selecciona cuenta --</option>
                {(cuentasBanc||[]).map(c=>(
                  <option key={c.id} value={c.id}>
                    {c.banco} — {c.numero||c.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {form.forma_pago==='TARJETA'&&(
          <div style={{marginBottom:14}}>
            <div style={{marginBottom:8}}>
              <label style={{fontSize:10,color:C.hint,display:'block',marginBottom:3,fontWeight:600}}>
                N° TARJETA (enmascarado)
              </label>
              <input value={form.banco_tarjeta||''} onChange={e=>s('banco_tarjeta',e.target.value)}
                placeholder="4560XXXXXXXX6352" maxLength={19}
                style={{...FI,letterSpacing:'2px',fontFamily:'monospace'}}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div>
                <label style={{fontSize:10,color:C.hint,display:'block',marginBottom:3,fontWeight:600}}>N° AUTORIZACIÓN</label>
                <input value={form.autorizacion||''} onChange={e=>s('autorizacion',e.target.value)}
                  placeholder="N° autorización" style={FI}/>
              </div>
              <div>
                <label style={{fontSize:10,color:C.hint,display:'block',marginBottom:3,fontWeight:600}}>N° LOTE</label>
                <input value={form.referencia} onChange={e=>s('referencia',e.target.value)}
                  placeholder="N° lote" style={FI}/>
              </div>
            </div>
          </div>
        )}

        {form.forma_pago==='CHEQUE'&&(
          <div style={{marginBottom:14}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
              <div>
                <label style={{fontSize:10,color:C.hint,display:'block',marginBottom:3,fontWeight:600}}>N° CHEQUE</label>
                <input value={form.referencia} onChange={e=>s('referencia',e.target.value)}
                  placeholder="N° cheque" style={FI}/>
              </div>
              <div>
                <label style={{fontSize:10,color:C.hint,display:'block',marginBottom:3,fontWeight:600}}>FECHA DEL CHEQUE</label>
                <input type="date" value={form.fecha_cheque||''} onChange={e=>s('fecha_cheque',e.target.value)}
                  style={FI}/>
              </div>
            </div>
            <div style={{marginBottom:8}}>
              <label style={{fontSize:10,color:C.hint,display:'block',marginBottom:3,fontWeight:600}}>
                CUENTA BANCARIA QUE EMITE (nuestra)
              </label>
              <select value={form.cuenta_bancaria_id||''}
                onChange={e=>s('cuenta_bancaria_id',parseInt(e.target.value)||null)}
                style={{...FI,borderColor:form.cuenta_bancaria_id?C.red:C.bord2,
                  background:form.cuenta_bancaria_id?C.redD:C.sur2}}>
                <option value="">-- Selecciona cuenta --</option>
                {(cuentasBanc||[]).map(c=>(
                  <option key={c.id} value={c.id}>
                    {c.banco} — {c.numero||c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{fontSize:10,color:C.hint,display:'block',marginBottom:3,fontWeight:600}}>TITULAR DEL CHEQUE</label>
              <input value={form.titular_cheque||''} onChange={e=>s('titular_cheque',e.target.value)}
                placeholder="A nombre de..." style={FI}/>
            </div>
          </div>
        )}

        {/* Observaciones */}
        <div style={{marginBottom:16}}>
          <label style={{fontSize:10,color:C.hint,display:'block',marginBottom:3,fontWeight:600}}>
            OBSERVACIONES
          </label>
          <input value={form.observaciones} onChange={e=>s('observaciones',e.target.value)}
            placeholder="Notas del pago..." style={FI}/>
        </div>

        {err&&<div style={{marginBottom:12,padding:'8px 12px',borderRadius:8,fontSize:12,
          background:C.redD,color:'#FCA5A5',
          border:'1px solid rgba(239,68,68,.3)'}}>⚠️ {err}</div>}

        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <button onClick={onCerrar} style={{padding:'10px 20px',borderRadius:9,
            border:`1px solid ${C.bord2}`,background:'transparent',
            color:C.muted,cursor:'pointer',fontSize:13}}>Cancelar</button>
          <button onClick={pagar} disabled={saving}
            style={{padding:'10px 28px',borderRadius:9,border:'none',
              background:saving?C.sur3:C.green,color:saving?C.hint:'white',
              cursor:saving?'not-allowed':'pointer',fontSize:13,fontWeight:800,
              boxShadow:saving?'none':'0 4px 16px rgba(16,185,129,.4)'}}>
            {saving?'Guardando...':'✓ Registrar pago'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal Historial de pagos ──────────────────────────────────
function ModalHistorial({cxp, onCerrar}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [pagos,   setPagos]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    api.get(`/cxp/${cxp.id}/pagos`)
      .then(r=>setPagos(r.data))
      .catch(()=>{})
      .finally(()=>setLoading(false))
  },[cxp.id])

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:9000}}>
      <div style={{background:C.surface,borderRadius:16,padding:28,width:560,
        maxHeight:'80vh',display:'flex',flexDirection:'column',
        border:`1px solid ${C.bord2}`,boxShadow:'0 25px 60px rgba(0,0,0,.7)'}}>

        <div style={{display:'flex',justifyContent:'space-between',
          alignItems:'center',marginBottom:20}}>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:C.text}}>📋 Historial de pagos</div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>
              {cxp.proveedor_nombre}
              {cxp.numero_compra&&<span style={{color:C.purple}}> · {cxp.numero_compra}</span>}
              {cxp.numero_factura_prov&&<span style={{color:C.hint}}> · Fact. {cxp.numero_factura_prov}</span>}
            </div>
          </div>
          <button onClick={onCerrar} style={{background:'none',border:'none',
            cursor:'pointer',color:C.hint,fontSize:22}}>×</button>
        </div>

        <div style={{flex:1,overflowY:'auto'}}>
          {loading&&<div style={{textAlign:'center',padding:24,color:C.hint}}>Cargando...</div>}
          {!loading&&pagos.length===0&&(
            <div style={{textAlign:'center',padding:24,color:C.hint,fontSize:13}}>
              Sin pagos registrados
            </div>
          )}
          {pagos.map((p,i)=>(
            <div key={i} style={{padding:'12px 14px',borderRadius:10,marginBottom:8,
              background:C.sur2,border:`1px solid ${C.bord2}`,
              display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:C.text}}>
                  {p.forma_pago}
                  {p.banco_origen&&<span style={{color:C.muted,fontWeight:400}}> · {p.banco_origen}</span>}
                  {p.banco_destino&&<span style={{color:C.hint,fontWeight:400}}> → {p.banco_destino}</span>}
                </div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>
                  {new Date(p.fecha).toLocaleDateString('es-EC')}
                  {p.usuario_nombre&&` · ${p.usuario_nombre}`}
                  {p.referencia&&<span style={{color:C.hint}}> · {p.referencia}</span>}
                  {p.observaciones&&<span style={{color:C.hint}}> · {p.observaciones}</span>}
                </div>
              </div>
              <div style={{fontSize:17,fontWeight:800,color:C.green,flexShrink:0}}>
                {fmt$(p.monto)}
              </div>
            </div>
          ))}
        </div>

        {/* Resumen */}
        <div style={{marginTop:14,padding:'12px 14px',borderRadius:10,
          background:C.sur2,border:`1px solid ${C.bord2}`,
          display:'flex',justifyContent:'space-between'}}>
          <div>
            <div style={{fontSize:10,color:C.hint}}>TOTAL PAGADO</div>
            <div style={{fontSize:17,fontWeight:800,color:C.green}}>
              {fmt$(pagos.reduce((a,p)=>a+Number(p.monto),0))}
            </div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:10,color:C.hint}}>SALDO ACTUAL</div>
            <div style={{fontSize:17,fontWeight:800,
              color:Number(cxp.saldo)===0?C.green:C.amber}}>
              {fmt$(cxp.saldo)}
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
//  PÁGINA PRINCIPAL CXP
// ════════════════════════════════════════════════════════════
export default function CXP() {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const user = JSON.parse(localStorage.getItem('nexus_user')||'{}')
  const [cuentas,    setCuentas]    = useState([])
  const [cuentasBanc,setCuentasBanc]= useState([])
  const [sucursales, setSucursales] = useState([])
  const [sucursalId, setSucursalId] = useState(user.sucursal_id||null)
  const [resumen,    setResumen]    = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [busqueda,   setBusqueda]   = useState('')
  const [filtro,     setFiltro]     = useState('todas')
  const [selected,   setSelected]   = useState([])
  const [modalPago,  setModalPago]  = useState(null)
  const [modalHist,  setModalHist]  = useState(null)
  const [msg,        setMsg]        = useState('')

  async function cargar(bus=busqueda) {
    setLoading(true)
    try {
      const params = { busqueda:bus }
      if (filtro!=='todas') params.estado = filtro
      if (sucursalId) params.sucursal_id = sucursalId
      const [c,r,cb,s] = await Promise.all([
        api.get('/cxp', {params}),
        api.get('/cxp/resumen', {params:{sucursal_id:sucursalId||undefined}}),
        api.get('/bancos/cuentas').catch(()=>({data:[]})),
        api.get('/config/sucursales').catch(()=>({data:[]})),
      ])
      setCuentas(c.data); setResumen(r.data)
      setCuentasBanc(cb.data||[]); setSucursales(s.data||[])
    } catch(e){ console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(()=>{ cargar() },[filtro, sucursalId])

  function toggleSelect(id) {
    setSelected(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id])
  }
  function selectAll() {
    setSelected(selected.length===cuentas.length?[]:cuentas.map(c=>c.id))
  }

  const TH = (a='left') => ({padding:'10px 12px',fontSize:10,fontWeight:700,
    color:C.hint,textAlign:a,background:C.sur3,
    borderBottom:`1px solid ${C.bord2}`,textTransform:'uppercase',
    letterSpacing:'.05em',whiteSpace:'nowrap'})
  const TD = (a='left') => ({padding:'11px 12px',fontSize:13,
    borderBottom:`1px solid ${C.border}`,verticalAlign:'middle',
    color:C.text,textAlign:a})

  const KPIs = resumen ? [
    {l:'Total a pagar',   v:fmt$(resumen.total_cartera),   c:C.amber,  bg:C.amberD},
    {l:'Vencido',         v:fmt$(resumen.total_vencido),   c:C.red,    bg:C.redD},
    {l:'Por vencer',      v:fmt$(resumen.total_por_vencer),c:C.blue,   bg:C.blueD},
    {l:'Ctas. vencidas',  v:resumen.cuentas_vencidas,      c:C.red,    bg:C.redD},
  ] : []

  return (
    <div style={{background:C.bg,minHeight:'100vh',padding:'24px 28px',
      fontFamily:"'Inter','Segoe UI',system-ui,sans-serif",color:C.text}}>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',
        alignItems:'flex-start',marginBottom:24}}>
        <div>
          <h1 style={{margin:0,fontSize:24,fontWeight:800}}>💸 Cuentas por Pagar</h1>
          <p style={{margin:'4px 0 0',color:C.muted,fontSize:13}}>
            {resumen?.cuentas_pendientes||0} cuentas con saldo pendiente
            {sucursalId&&sucursales.length>0&&(
              <span style={{marginLeft:8,color:C.blue,fontWeight:600}}>
                · {sucursales.find(s=>s.id===sucursalId)?.nombre}
              </span>
            )}
            {!sucursalId&&<span style={{marginLeft:8,color:C.hint}}> · Todas las sucursales</span>}
          </p>
        </div>
      </div>

      {msg&&(
        <div style={{marginBottom:16,padding:'10px 16px',borderRadius:9,fontSize:13,
          background:msg.startsWith('✅')?C.greenD:C.redD,
          color:msg.startsWith('✅')?C.green:'#FCA5A5',
          border:`1px solid ${msg.startsWith('✅')?'rgba(16,185,129,.3)':'rgba(239,68,68,.3)'}`}}>
          {msg}
        </div>
      )}

      {/* KPIs */}
      {resumen&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',
          gap:12,marginBottom:24}}>
          {KPIs.map((k,i)=>(
            <div key={i} style={{background:C.surface,borderRadius:12,
              padding:'16px 18px',border:`1px solid ${C.bord2}`}}>
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
          <input value={busqueda} onChange={e=>setBusqueda(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&cargar(busqueda)}
            placeholder="Buscar por proveedor o RUC..."
            style={{...FI,paddingLeft:32}}/>
        </div>
        <button onClick={()=>cargar(busqueda)}
          style={{padding:'8px 16px',borderRadius:9,border:'none',
            background:C.blue,color:'white',cursor:'pointer',
            fontSize:13,fontWeight:600}}>
          Buscar
        </button>
        {/* Selector sucursal */}
        <select value={sucursalId||''}
          onChange={e=>setSucursalId(e.target.value?parseInt(e.target.value):null)}
          style={{...FI,width:180,
            background:sucursalId?'rgba(59,130,246,.12)':C.sur2,
            borderColor:sucursalId?C.blue:C.bord2,
            color:sucursalId?C.blue:C.text}}>
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
                background:filtro===v?C.amber:C.sur2,
                color:filtro===v?'#000':C.muted,
                transition:'all .15s'}}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div style={{background:C.surface,borderRadius:12,
        border:`1px solid ${C.bord2}`,overflow:'hidden'}}>
        {loading?(
          <div style={{padding:40,textAlign:'center',color:C.hint}}>Cargando...</div>
        ):cuentas.length===0?(
          <div style={{padding:40,textAlign:'center',color:C.hint,fontSize:13}}>
            No hay cuentas por pagar
          </div>
        ):(
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr>
                <th style={{...TH(),paddingLeft:16}}>
                  <input type="checkbox"
                    checked={selected.length===cuentas.length&&cuentas.length>0}
                    onChange={selectAll}
                    style={{cursor:'pointer',accentColor:C.amber}}/>
                </th>
                <th style={TH()}>Proveedor</th>
                <th style={TH()}>Compra / Factura</th>
                <th style={TH('center')}>Emisión</th>
                <th style={TH('center')}>Vencimiento</th>
                <th style={TH('right')}>Monto</th>
                <th style={TH('right')}>Pagado</th>
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
                        style={{cursor:'pointer',accentColor:C.amber}}/>
                    </td>

                    <td style={TD()}>
                      <div style={{fontWeight:700}}>{c.proveedor_nombre}</div>
                      <div style={{fontSize:11,color:C.hint}}>{c.proveedor_ruc}</div>
                    </td>

                    <td style={TD()}>
                      {c.numero_compra&&(
                        <code style={{fontSize:11,color:C.purple,fontWeight:700,display:'block'}}>
                          {c.numero_compra}
                        </code>
                      )}
                      {c.numero_factura_prov&&(
                        <span style={{fontSize:11,color:C.muted}}>
                          Fact: {c.numero_factura_prov}
                        </span>
                      )}
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
                      {Number(c.pagado)>0?fmt$(c.pagado):'—'}
                    </td>

                    <td style={{...TD('right'),fontWeight:800,fontSize:14,
                      color:vencida?C.red:C.amber}}>
                      {fmt$(c.saldo)}
                    </td>

                    <td style={TD('center')}>
                      <BadgeEstado estado={c.estado_calculado}
                        diasVencido={c.dias_vencido}/>
                    </td>

                    <td style={TD('center')}>
                      <div style={{display:'flex',gap:5,justifyContent:'center'}}>
                        <button onClick={()=>setModalPago(c)}
                          title="Registrar pago"
                          style={{padding:'5px 10px',borderRadius:7,
                            border:`1px solid ${C.green}`,
                            background:`rgba(16,185,129,.15)`,
                            color:C.green,cursor:'pointer',
                            fontSize:12,fontWeight:700}}>
                          💸 Pagar
                        </button>
                        <button onClick={()=>setModalHist(c)}
                          title="Ver historial"
                          style={{padding:'5px 9px',borderRadius:7,
                            border:`1px solid ${C.bord2}`,
                            background:C.sur2,color:C.muted,
                            cursor:'pointer',fontSize:12}}>
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

      {modalPago&&(
        <ModalPagar
          cxp={modalPago}
          cuentasBanc={cuentasBanc}
          onCerrar={()=>setModalPago(null)}
          onGuardado={()=>{
            setModalPago(null)
            setMsg('✅ Pago registrado correctamente')
            cargar()
            setTimeout(()=>setMsg(''),4000)
          }}
        />
      )}
      {modalHist&&(
        <ModalHistorial
          cxp={modalHist}
          onCerrar={()=>setModalHist(null)}
        />
      )}
    </div>
  )
}