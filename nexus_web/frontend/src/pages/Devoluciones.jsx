// ============================================================
//  NEXUS POS — Devoluciones / Nota de Crédito
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

const ESTADOS_SERIE = [
  {v:'DEVUELTA',   l:'Devuelta',    c:'#F59E0B'},
  {v:'DISPONIBLE', l:'Disponible',  c:'#10B981'},
  {v:'DAÑADA',     l:'Dañada',      c:'#EF4444'},
]

const FORMAS_DEV = [
  {v:'EFECTIVO',      l:'Efectivo',         e:'💵'},
  {v:'TRANSFERENCIA', l:'Transferencia',    e:'🏦'},
  {v:'SALDO_FAVOR',   l:'Saldo a favor',    e:'📋'},
]

// ── Buscador de facturas ─────────────────────────────────────
// ── Buscador de facturas (lista inline) ─────────────────────
function BuscadorFactura({onSelect}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [txt, setTxt]     = useState('')
  const [res, setRes]     = useState([])
  const [loading, setLoad]= useState(false)

  async function buscar(v) {
    setTxt(v)
    if(v.length<2){setRes([]);return}
    setLoad(true)
    try{
      const{data}=await api.get('/facturas',{params:{busqueda:v}})
      setRes(data.slice(0,30))
    }catch{}finally{setLoad(false)}
  }

  return(
    <div>
      <div style={{position:'relative',marginBottom:12}}>
        <span style={{position:'absolute',left:12,top:'50%',
          transform:'translateY(-50%)',color:C.hint}}>🔍</span>
        <input value={txt} onChange={e=>buscar(e.target.value)}
          placeholder="Buscar por N° de factura, nombre o RUC del cliente..."
          style={{...FI,paddingLeft:36,fontSize:14,padding:'11px 12px 11px 36px'}}/>
      </div>
      {loading&&<div style={{padding:16,textAlign:'center',color:C.hint,fontSize:13}}>Buscando...</div>}
      {!loading&&res.length>0&&(
        <div style={{background:C.sur2,borderRadius:10,border:`1px solid ${C.bord2}`,overflow:'hidden'}}>
          {res.map((f,i)=>(
            <div key={f.id} onClick={()=>onSelect(f)}
              style={{padding:'12px 16px',cursor:'pointer',
                borderBottom:i<res.length-1?`1px solid ${C.border}`:'none'}}
              onMouseEnter={e=>e.currentTarget.style.background=C.sur3}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <div style={{display:'flex',justifyContent:'space-between',
                alignItems:'center',marginBottom:4}}>
                <code style={{color:C.purple,fontWeight:800,fontSize:14}}>{f.numero_factura}</code>
                <span style={{color:C.green,fontWeight:800,fontSize:15}}>{fmt$(f.total)}</span>
              </div>
              <div style={{display:'flex',gap:16,fontSize:12,flexWrap:'wrap'}}>
                <span style={{color:C.text,fontWeight:600}}>{f.cliente_nombre}</span>
                <span style={{color:C.hint}}>
                  {new Date(f.fecha_emision).toLocaleDateString('es-EC',
                    {day:'2-digit',month:'long',year:'numeric'})}
                </span>
                {f.cliente_ruc&&<span style={{color:C.hint}}>RUC: {f.cliente_ruc}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading&&txt.length>=2&&res.length===0&&(
        <div style={{padding:20,textAlign:'center',color:C.hint,fontSize:13,
          background:C.sur2,borderRadius:10,border:`1px solid ${C.bord2}`}}>
          No se encontraron facturas
        </div>
      )}
    </div>
  )
}

// ── Modal nueva devolución ───────────────────────────────────
function ModalDevolucion({onCerrar, onGuardado}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [paso,      setPaso]      = useState(1) // 1=buscar, 2=seleccionar, 3=forma pago
  const [factura,   setFactura]   = useState(null)
  const [factDet,   setFactDet]   = useState(null)
  const [motivo,    setMotivo]    = useState('')
  const [tipo,      setTipo]      = useState('PARCIAL')
  const [selDets,   setSelDets]   = useState([]) // detalles seleccionados
  const [forma,     setForma]     = useState('EFECTIVO')
  const [bancoOri,  setBancoOri]  = useState('')
  const [bancoDes,  setBancoDes]  = useState('')
  const [refPago,   setRefPago]   = useState('')
  const [saving,    setSaving]    = useState(false)
  const [err,       setErr]       = useState('')

  const BANCOS = ['Banco Pichincha','Banco del Pacífico','Banco Guayaquil',
    'Produbanco','Banco Internacional','Banco Bolivariano','BanEcuador']

  const [bodegas, setBodegas] = useState([])

  async function cargarFactura(f) {
    setFactura(f)
    try {
      const [{data}, {data:bods}] = await Promise.all([
        api.get(`/facturas/${f.id}/para-devolucion`),
        api.get('/bodegas'),
      ])
      setFactDet(data); setBodegas(bods)
      // Inicializar selección con todos los detalles
      setSelDets(data.detalles.map(d=>({
        factura_det_id: d.id,
        producto_id:    d.producto_id,
        bodega_id:      d.bodega_id||null,
        bodega_nombre:  d.bodega_nombre||null,
        descripcion:    d.descripcion,
        codigo:         d.codigo,
        cantidad:       Number(d.cantidad) - Number(d.cantidad_devuelta),
        max_cantidad:   Number(d.cantidad) - Number(d.cantidad_devuelta),
        precio_unitario:Number(d.precio_unitario),
        iva_porcentaje: Number(d.iva_porcentaje),
        aplica_series:  d.aplica_series,
        series_factura: d.series||[],
        serie_id:       null,
        estado_serie:   'DEVUELTA',
        incluir:        true,
      })))
      setPaso(2)
    } catch(e) { setErr(e.response?.data?.detail||e.message) }
  }

  function toggleIncluir(idx) {
    setSelDets(p=>p.map((d,i)=>i===idx?{...d,incluir:!d.incluir}:d))
  }
  function setDet(idx,k,v) {
    setSelDets(p=>p.map((d,i)=>i===idx?{...d,[k]:v}:d))
  }

  // Calcular totales
  const detsActivos = selDets.filter(d=>d.incluir&&d.cantidad>0)
  const sub0  = detsActivos.filter(d=>d.iva_porcentaje===0)
    .reduce((a,d)=>a+d.cantidad*d.precio_unitario,0)
  const subiva = detsActivos.filter(d=>d.iva_porcentaje>0)
    .reduce((a,d)=>a+d.cantidad*d.precio_unitario,0)
  const iva    = subiva * 15/100
  const total  = sub0 + subiva + iva

  async function guardar() {
    if(!motivo.trim()) return setErr('Ingresa el motivo de la devolucion')
    if(detsActivos.length===0) return setErr('Selecciona al menos un producto')
    setSaving(true); setErr('')
    try {
      const {data} = await api.post('/devoluciones',{
        factura_id:       factDet.id,
        motivo,
        tipo_devolucion:  tipo,
        forma_devolucion: forma,
        banco_origen:     bancoOri||null,
        banco_destino:    bancoDes||null,
        referencia_pago:  refPago||null,
        detalles: detsActivos.map(d=>({
          factura_det_id: d.factura_det_id,
          producto_id:    d.producto_id,
          bodega_id:      d.bodega_id,
          serie_id:       d.serie_id||null,
          cantidad:       d.cantidad,
          precio_unitario:d.precio_unitario,
          iva_porcentaje: d.iva_porcentaje,
          estado_serie:   d.estado_serie,  // usado para actualizar inv_series
        }))
      })
      onGuardado(data)
    } catch(e) { setErr(e.response?.data?.detail||e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:9000}}>
      <div style={{background:C.surface,borderRadius:16,padding:28,
        width:820,maxHeight:'92vh',overflowY:'auto',
        border:`1px solid ${C.bord2}`,boxShadow:'0 25px 60px rgba(0,0,0,.7)'}}>

        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',
          alignItems:'center',marginBottom:20}}>
          <div>
            <div style={{fontSize:16,fontWeight:800,color:C.text}}>
              📋 Nueva nota de credito
            </div>
            {factDet&&(
              <div style={{fontSize:12,color:C.muted,marginTop:2}}>
                Factura: <span style={{color:C.purple,fontWeight:700}}>
                  {factDet.numero_factura}
                </span>
                {' '} · {factDet.cliente_nombre}
              </div>
            )}
          </div>
          <button onClick={onCerrar} style={{background:'none',border:'none',
            cursor:'pointer',color:C.hint,fontSize:22}}>x</button>
        </div>

        {/* Pasos */}
        <div style={{display:'flex',gap:4,marginBottom:20}}>
          {[
            {n:1,l:'Buscar factura'},
            {n:2,l:'Productos'},
            {n:3,l:'Devolucion dinero'},
          ].map(({n,l})=>(
            <div key={n} style={{flex:1,textAlign:'center',padding:'6px 0',
              borderRadius:8,fontSize:12,fontWeight:600,
              background:paso===n?C.red:paso>n?C.greenD:C.sur2,
              color:paso===n?'white':paso>n?C.green:C.hint,
              border:`1px solid ${paso===n?C.red:paso>n?C.green:C.bord2}`}}>
              {n}. {l}
            </div>
          ))}
        </div>

        {/* ── PASO 1: Buscar factura ── */}
        {paso===1&&(
          <div style={{flex:1,overflowY:'auto',padding:'4px 2px'}}>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:11,fontWeight:700,color:C.muted,
                display:'block',marginBottom:6,textTransform:'uppercase'}}>
                Factura a devolver
              </label>
              <BuscadorFactura onSelect={cargarFactura}/>
            </div>
            {err&&<div style={{padding:'8px 12px',borderRadius:8,fontSize:12,
              background:C.redD,color:'#FCA5A5'}}>{err}</div>}
          </div>
        )}

        {/* ── PASO 2: Seleccionar productos ── */}
        {paso===2&&factDet&&(
          <div style={{flex:1,overflowY:'auto',padding:'4px 2px'}}>
            {/* Motivo y tipo */}
            <div style={{display:'grid',gridTemplateColumns:'1fr auto',
              gap:12,marginBottom:16}}>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.muted,
                  display:'block',marginBottom:4,textTransform:'uppercase'}}>
                  Motivo de la devolucion *
                </label>
                <input value={motivo} onChange={e=>setMotivo(e.target.value)}
                  placeholder="Ej: Producto defectuoso, error en factura..."
                  style={FI}/>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.muted,
                  display:'block',marginBottom:4,textTransform:'uppercase'}}>
                  Tipo
                </label>
                <div style={{display:'flex',borderRadius:8,overflow:'hidden',
                  border:`1px solid ${C.bord2}`}}>
                  {[['TOTAL','Total'],['PARCIAL','Parcial']].map(([v,l])=>(
                    <button key={v} onClick={()=>{
                        setTipo(v)
                        if(v==='TOTAL') setSelDets(p=>p.map(d=>({...d,incluir:true,
                          cantidad:d.max_cantidad})))
                      }}
                      style={{padding:'8px 14px',border:'none',cursor:'pointer',
                        fontSize:12,fontWeight:600,
                        background:tipo===v?C.red:C.sur2,
                        color:tipo===v?'white':C.muted}}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Productos */}
            <div style={{background:C.sur2,borderRadius:10,
              border:`1px solid ${C.bord2}`,overflow:'hidden',marginBottom:16}}>
              <div style={{padding:'8px 14px',background:C.sur3,
                fontSize:10,fontWeight:700,color:C.hint,
                textTransform:'uppercase',letterSpacing:'.05em',
                display:'grid',gridTemplateColumns:'32px 1fr 80px 80px 160px 90px 90px'}}>
                <span></span>
                <span>Producto</span>
                <span style={{textAlign:'center'}}>Cant.</span>
                <span style={{textAlign:'right'}}>Precio</span>
                <span>Bodega destino</span>
                <span style={{textAlign:'center'}}>Serie</span>
                <span style={{textAlign:'center'}}>Estado serie</span>
              </div>
              {selDets.map((d,idx)=>(
                <div key={idx} style={{padding:'10px 14px',
                  borderBottom:`1px solid ${C.border}`,
                  background:d.incluir?'transparent':C.sur3,
                  opacity:d.incluir?1:.5,
                  display:'grid',gridTemplateColumns:'32px 1fr 80px 80px 160px 90px 90px',
                  gap:8,alignItems:'center'}}>
                  <input type="checkbox" checked={d.incluir}
                    onChange={()=>toggleIncluir(idx)}
                    style={{cursor:'pointer',accentColor:C.red,width:15,height:15}}/>
                  <div>
                    <div style={{fontWeight:600,fontSize:13,color:C.text}}>
                      {d.descripcion}
                    </div>
                    <code style={{fontSize:10,color:C.purple}}>{d.codigo}</code>
                    {d.cantidad_devuelta>0&&(
                      <span style={{fontSize:10,color:C.amber,marginLeft:6}}>
                        (ya devuelto: {d.cantidad_devuelta})
                      </span>
                    )}
                  </div>
                  <input type="number" min="0.01" step="0.01"
                    max={d.max_cantidad} value={d.cantidad}
                    onChange={e=>setDet(idx,'cantidad',
                      Math.min(parseFloat(e.target.value)||0,d.max_cantidad))}
                    disabled={!d.incluir}
                    style={{...FI,textAlign:'center',padding:'5px 6px',fontSize:12}}/>
                  <div style={{textAlign:'right',fontWeight:700,
                    color:C.blue,fontSize:12}}>
                    {fmt$(d.precio_unitario)}
                  </div>
                  {/* Bodega destino */}
                  <div>
                    <select value={d.bodega_id||''}
                      onChange={e=>setDet(idx,'bodega_id',parseInt(e.target.value)||null)}
                      disabled={!d.incluir}
                      style={{...FI,padding:'4px 6px',fontSize:11,
                        borderColor:d.bodega_id?C.green:C.amber,
                        background:d.bodega_id?C.sur2:C.amberD}}>
                      <option value="">-- Bodega --</option>
                      {bodegas.map(b=>(
                        <option key={b.id} value={b.id}>
                          {b.nombre}{b.es_principal?' (principal)':''}
                        </option>
                      ))}
                    </select>
                    {d.bodega_nombre&&!d.bodega_id&&(
                      <div style={{fontSize:9,color:C.hint,marginTop:2}}>
                        Original: {d.bodega_nombre}
                      </div>
                    )}
                  </div>
                  {/* Serie */}
                  <div>
                    {d.aplica_series&&d.series_factura.length>0?(
                      <select value={d.serie_id||''}
                        onChange={e=>setDet(idx,'serie_id',
                          parseInt(e.target.value)||null)}
                        disabled={!d.incluir}
                        style={{...FI,padding:'4px 6px',fontSize:11}}>
                        <option value="">-- Serie --</option>
                        {d.series_factura.map(s=>(
                          <option key={s.id} value={s.id}>{s.serie}</option>
                        ))}
                      </select>
                    ):(
                      <span style={{fontSize:11,color:C.hint}}>—</span>
                    )}
                  </div>
                  {/* Estado serie */}
                  <div>
                    {d.aplica_series?(
                      <select value={d.estado_serie}
                        onChange={e=>setDet(idx,'estado_serie',e.target.value)}
                        disabled={!d.incluir||!d.serie_id}
                        style={{...FI,padding:'4px 6px',fontSize:11,
                          borderColor:ESTADOS_SERIE.find(s=>s.v===d.estado_serie)?.c||C.bord2,
                          color:ESTADOS_SERIE.find(s=>s.v===d.estado_serie)?.c||C.muted}}>
                        {ESTADOS_SERIE.map(s=>(
                          <option key={s.v} value={s.v}>{s.l}</option>
                        ))}
                      </select>
                    ):(
                      <span style={{fontSize:11,color:C.hint}}>—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Totales */}
            <div style={{background:C.sur2,borderRadius:10,padding:'12px 16px',
              border:`1px solid ${C.bord2}`,marginBottom:16,
              display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontSize:13,color:C.muted}}>
                {detsActivos.length} producto{detsActivos.length!==1?'s':''}
              </div>
              <div style={{display:'flex',gap:20}}>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:10,color:C.hint}}>SUBTOTAL</div>
                  <div style={{fontSize:13,fontWeight:700,color:C.muted}}>
                    {fmt$(sub0+subiva)}
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:10,color:C.hint}}>IVA 15%</div>
                  <div style={{fontSize:13,fontWeight:700,color:C.amber}}>
                    {fmt$(iva)}
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:10,color:C.hint}}>TOTAL NC</div>
                  <div style={{fontSize:18,fontWeight:800,color:C.red}}>
                    {fmt$(total)}
                  </div>
                </div>
              </div>
            </div>

            {err&&<div style={{padding:'8px 12px',borderRadius:8,fontSize:12,
              background:C.redD,color:'#FCA5A5',marginBottom:12}}>{err}</div>}

            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button onClick={()=>setPaso(1)}
                style={{padding:'9px 18px',borderRadius:9,cursor:'pointer',
                  border:`1px solid ${C.bord2}`,background:'transparent',
                  color:C.muted,fontSize:13}}>Atras</button>
              <button onClick={()=>{setErr('');setPaso(3)}}
                disabled={!motivo||detsActivos.length===0}
                style={{padding:'9px 22px',borderRadius:9,border:'none',
                  background:(!motivo||detsActivos.length===0)?C.sur3:C.red,
                  color:(!motivo||detsActivos.length===0)?C.hint:'white',
                  cursor:(!motivo||detsActivos.length===0)?'not-allowed':'pointer',
                  fontSize:13,fontWeight:700}}>
                Siguiente
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 3: Forma de devolucion ── */}
        {paso===3&&(
          <div style={{flex:1,overflowY:'auto',padding:'4px 2px'}}>
            <div style={{background:C.sur2,borderRadius:10,padding:'14px 16px',
              marginBottom:18,border:`1px solid ${C.bord2}`}}>
              <div style={{fontSize:11,color:C.hint,marginBottom:4}}>
                TOTAL A DEVOLVER AL CLIENTE
              </div>
              <div style={{fontSize:28,fontWeight:900,color:C.red}}>
                {fmt$(total)}
              </div>
              <div style={{fontSize:12,color:C.muted,marginTop:4}}>
                Motivo: {motivo}
              </div>
            </div>

            {/* Forma de devolucion */}
            <div style={{marginBottom:16}}>
              <label style={{fontSize:11,fontWeight:700,color:C.muted,
                display:'block',marginBottom:8,textTransform:'uppercase'}}>
                Como se devuelve el dinero
              </label>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                {FORMAS_DEV.map(f=>(
                  <button key={f.v} onClick={()=>setForma(f.v)}
                    style={{padding:'12px 8px',borderRadius:10,cursor:'pointer',
                      border:forma===f.v?`1.5px solid ${C.red}`:`1px solid ${C.bord2}`,
                      background:forma===f.v?C.redD:C.sur2,
                      display:'flex',flexDirection:'column',alignItems:'center',
                      gap:6,fontSize:12,fontWeight:forma===f.v?700:400,
                      color:forma===f.v?C.red:C.muted}}>
                    <span style={{fontSize:22}}>{f.e}</span>
                    {f.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Campos extra transferencia */}
            {forma==='TRANSFERENCIA'&&(
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',
                gap:10,marginBottom:14}}>
                <div>
                  <label style={{fontSize:10,color:C.hint,display:'block',
                    marginBottom:3,fontWeight:600}}>BANCO ORIGEN (nuestro)</label>
                  <input value={bancoOri} onChange={e=>setBancoOri(e.target.value)}
                    list="bd-ori" placeholder="Banco que paga" style={FI}/>
                  <datalist id="bd-ori">
                    {BANCOS.map((b,i)=><option key={i} value={b}/>)}
                  </datalist>
                </div>
                <div>
                  <label style={{fontSize:10,color:C.hint,display:'block',
                    marginBottom:3,fontWeight:600}}>BANCO DESTINO (cliente)</label>
                  <input value={bancoDes} onChange={e=>setBancoDes(e.target.value)}
                    list="bd-des" placeholder="Banco del cliente" style={FI}/>
                  <datalist id="bd-des">
                    {BANCOS.map((b,i)=><option key={i} value={b}/>)}
                  </datalist>
                </div>
                <div style={{gridColumn:'1/-1'}}>
                  <input value={refPago} onChange={e=>setRefPago(e.target.value)}
                    placeholder="N° comprobante de transferencia" style={FI}/>
                </div>
              </div>
            )}

            {forma==='SALDO_FAVOR'&&(
              <div style={{padding:'10px 14px',borderRadius:8,marginBottom:14,
                background:C.blueD,border:`1px solid rgba(59,130,246,.3)`,
                fontSize:12,color:C.blue}}>
                El monto se abonara a la cuenta por cobrar pendiente del cliente.
                Si no tiene CXC pendiente, queda como credito a favor.
              </div>
            )}

            {err&&<div style={{padding:'8px 12px',borderRadius:8,fontSize:12,
              background:C.redD,color:'#FCA5A5',marginBottom:12}}>{err}</div>}

            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button onClick={()=>setPaso(2)}
                style={{padding:'9px 18px',borderRadius:9,cursor:'pointer',
                  border:`1px solid ${C.bord2}`,background:'transparent',
                  color:C.muted,fontSize:13}}>Atras</button>
              <button onClick={guardar} disabled={saving}
                style={{padding:'10px 28px',borderRadius:9,border:'none',
                  background:saving?C.sur3:C.red,
                  color:saving?C.hint:'white',
                  cursor:saving?'not-allowed':'pointer',
                  fontSize:14,fontWeight:800,
                  boxShadow:saving?'none':'0 4px 16px rgba(239,68,68,.4)'}}>
                {saving?'Emitiendo...':'Emitir nota de credito'}
              </button>
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
export default function Devoluciones() {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const user = JSON.parse(localStorage.getItem('nexus_user')||'{}')
  const [devoluciones, setDevoluciones] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [busqueda,     setBusqueda]     = useState('')
  const [modal,        setModal]        = useState(false)
  const [ultimaNC,     setUltimaNC]     = useState(null)
  const [proxNC,       setProxNC]       = useState('cargando...')
  const [sucursalNombre, setSucNombre]  = useState('')

  async function cargar(bus=busqueda) {
    setLoading(true)
    try {
      const{data}=await api.get('/devoluciones',{params:{busqueda:bus}})
      setDevoluciones(data)
    } finally { setLoading(false) }
  }

  useEffect(()=>{
    cargar()
    // Cargar sucursal y próximo N° NC
    api.get('/config/sucursales').then(r=>{
      if(user.sucursal_id&&r.data.length>0){
        const suc=r.data.find(x=>x.id===parseInt(user.sucursal_id))
        if(suc){
          setSucNombre(suc.nombre)
          const seq  = parseInt(suc.secuencial_nc||1)
          const cod  = suc.codigo_establecimiento||'001'
          const pto  = suc.punto_emision||'001'
          setProxNC(`${cod}-${pto}-${String(seq).padStart(9,'0')}`)
        }
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

  return (
    <div style={{background:C.bg,minHeight:'100vh',padding:'24px 28px',
      fontFamily:"'Inter','Segoe UI',system-ui,sans-serif",color:C.text}}>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',
        alignItems:'flex-start',marginBottom:24}}>
        <div>
          <h1 style={{margin:0,fontSize:24,fontWeight:800}}>
            📋 Devoluciones / Notas de Credito
          </h1>
          <p style={{margin:'4px 0 0',color:C.muted,fontSize:13}}>
            {devoluciones.length} notas de credito emitidas
          </p>
        </div>
        <button onClick={()=>setModal(true)}
          style={{display:'flex',alignItems:'center',gap:7,
            padding:'10px 20px',borderRadius:10,border:'none',
            background:C.red,color:'white',cursor:'pointer',
            fontSize:14,fontWeight:700,
            boxShadow:'0 4px 14px rgba(239,68,68,.4)'}}>
          + Nueva devolucion
        </button>
      </div>

      {/* Barra de info: sucursal + próximo N° NC */}
      <div style={{display:'flex',alignItems:'center',gap:12,
        marginBottom:16,flexWrap:'wrap'}}>
        {sucursalNombre&&(
          <div style={{display:'flex',alignItems:'center',gap:7,
            padding:'6px 14px',borderRadius:9,
            background:C.greenD,border:`1px solid rgba(16,185,129,.25)`}}>
            <span style={{fontSize:13}}>🏢</span>
            <span style={{fontSize:13,fontWeight:700,color:C.green}}>
              {sucursalNombre}
            </span>
          </div>
        )}
        <div style={{display:'flex',alignItems:'center',gap:7,
          padding:'6px 14px',borderRadius:9,
          background:C.amberD,border:`1px solid rgba(245,158,11,.3)`}}>
          <span style={{fontSize:11,color:C.amber,fontWeight:700,
            textTransform:'uppercase'}}>Próxima NC</span>
          <code style={{fontSize:14,fontWeight:800,color:C.amber}}>{proxNC}</code>
        </div>
      </div>

      {/* Alerta ultima NC */}
      {ultimaNC&&(
        <div style={{marginBottom:16,padding:'12px 16px',borderRadius:10,
          background:C.greenD,border:`1px solid rgba(16,185,129,.3)`,
          display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <span style={{color:C.green,fontWeight:700}}>NC emitida: </span>
            <code style={{color:C.purple,fontWeight:700}}>{ultimaNC.numero_nc}</code>
            <span style={{color:C.muted,marginLeft:8}}>{fmt$(ultimaNC.total)}</span>
          </div>
          <button onClick={()=>setUltimaNC(null)}
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
            placeholder="Buscar por N° NC, cliente o factura..."
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
          <div style={{padding:40,textAlign:'center',color:C.hint}}>
            Cargando...
          </div>
        ):(
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr>
                {['N° NC','Factura original','Cliente','Fecha',
                  'Motivo','Forma dev.','Total','Estado'].map((h,i)=>(
                  <th key={i} style={TH(i>=6?'right':'left')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devoluciones.map(d=>(
                <tr key={d.id}
                  onMouseEnter={e=>e.currentTarget.style.background=C.sur2}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={TD()}>
                    <code style={{color:C.red,fontWeight:700,fontSize:12}}>
                      {d.numero_nc}
                    </code>
                  </td>
                  <td style={TD()}>
                    <code style={{color:C.purple,fontSize:12}}>
                      {d.numero_factura}
                    </code>
                  </td>
                  <td style={TD()}>
                    <div style={{fontWeight:600}}>{d.cliente_nombre}</div>
                  </td>
                  <td style={{...TD(),fontSize:12,color:C.muted}}>
                    {new Date(d.fecha_emision).toLocaleDateString('es-EC')}
                  </td>
                  <td style={{...TD(),fontSize:12,color:C.muted,maxWidth:180,
                    overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {d.motivo}
                  </td>
                  <td style={TD()}>
                    <span style={{fontSize:12,color:C.muted}}>
                      {d.forma_devolucion}
                    </span>
                  </td>
                  <td style={{...TD('right'),fontWeight:800,color:C.red}}>
                    {fmt$(d.total)}
                  </td>
                  <td style={TD()}>
                    <span style={{padding:'3px 10px',borderRadius:20,
                      fontSize:11,fontWeight:700,
                      background:C.greenD,color:C.green}}>
                      {d.estado}
                    </span>
                  </td>
                </tr>
              ))}
              {devoluciones.length===0&&(
                <tr><td colSpan={8} style={{textAlign:'center',
                  padding:'48px 0',color:C.hint,fontSize:13}}>
                  No hay notas de credito emitidas
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {modal&&(
        <ModalDevolucion
          onCerrar={()=>setModal(false)}
          onGuardado={data=>{
            setModal(false)
            setUltimaNC(data)
            cargar()
            // Recalcular próximo número
            api.get('/config/sucursales').then(r=>{
              if(user.sucursal_id&&r.data.length>0){
                const suc=r.data.find(x=>x.id===parseInt(user.sucursal_id))
                if(suc){
                  const seq=parseInt(suc.secuencial_nc||1)
                  const cod=suc.codigo_establecimiento||'001'
                  const pto=suc.punto_emision||'001'
                  setProxNC(`${cod}-${pto}-${String(seq).padStart(9,'0')}`)
                }
              }
            }).catch(()=>{})
          }}
        />
      )}
    </div>
  )
}