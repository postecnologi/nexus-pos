// ============================================================
//  NEXUS POS — Conciliación Bancaria
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
const fmtFecha = d => d ? new Date(d+'T12:00').toLocaleDateString('es-EC',
  {day:'2-digit',month:'2-digit',year:'numeric'}) : '—'
const FI = {
  padding:'8px 11px', borderRadius:8, fontSize:13,
  border:`1px solid ${C.bord2}`, background:C.sur2,
  color:C.text, outline:'none', boxSizing:'border-box', width:'100%'
}
const hoy = () => new Date().toISOString().split('T')[0]
const primerDiaMes = () => {
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
}

// ── Modal nueva conciliación ──────────────────────────────────
function ModalNueva({cuentas, onCerrar, onCreada}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const periodoActual = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  }
  const [form, setForm] = useState({
    cuenta_id:    cuentas[0]?.id||'',
    periodo:      periodoActual(),
    saldo_banco:  '',
    saldo_sistema:'',
  })
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  async function guardar() {
    if(!form.cuenta_id) return setErr('Selecciona una cuenta')
    if(!form.periodo) return setErr('Selecciona el período')
    setSaving(true); setErr('')
    try {
      const{data}=await api.post('/conciliaciones',{
        cuenta_id:    parseInt(form.cuenta_id),
        periodo:      form.periodo,
        saldo_banco:  parseFloat(form.saldo_banco)||0,
        saldo_sistema:parseFloat(form.saldo_sistema)||0,
      })
      onCreada(data.id)
    }catch(e){ setErr(e.response?.data?.detail||e.message) }
    finally{ setSaving(false) }
  }

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:9000}}>
      <div style={{background:C.surface,borderRadius:16,padding:28,width:480,
        border:`1px solid ${C.bord2}`,boxShadow:'0 25px 60px rgba(0,0,0,.7)'}}>
        <div style={{fontSize:16,fontWeight:800,color:C.text,marginBottom:20}}>
          🔍 Nueva conciliación bancaria
        </div>

        <div style={{marginBottom:12}}>
          <label style={{fontSize:11,color:C.muted,display:'block',
            marginBottom:4,fontWeight:600,textTransform:'uppercase'}}>
            Cuenta bancaria *
          </label>
          <select value={form.cuenta_id}
            onChange={e=>setForm(p=>({...p,cuenta_id:e.target.value}))} style={FI}>
            {cuentas.map(c=>(
              <option key={c.id} value={c.id}>{c.banco} — {c.numero_cuenta}</option>
            ))}
          </select>
        </div>

        <div style={{marginBottom:12}}>
          <label style={{fontSize:11,color:C.muted,display:'block',
            marginBottom:4,fontWeight:600,textTransform:'uppercase'}}>
            Período (mes) *
          </label>
          <input type="month" value={form.periodo}
            onChange={e=>setForm(p=>({...p,periodo:e.target.value}))}
            style={FI}/>
          <div style={{fontSize:11,color:C.hint,marginTop:3}}>
            Se cargará todo el mes seleccionado
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
          <div>
            <label style={{fontSize:11,color:C.muted,display:'block',
              marginBottom:4,fontWeight:600,textTransform:'uppercase'}}>
              Saldo inicial banco
            </label>
            <input type="number" step="0.01" value={form.saldo_banco}
              onChange={e=>setForm(p=>({...p,saldo_banco:e.target.value}))}
              placeholder="Según estado de cuenta"
              style={{...FI,textAlign:'right'}}/>
          </div>
          <div>
            <label style={{fontSize:11,color:C.muted,display:'block',
              marginBottom:4,fontWeight:600,textTransform:'uppercase'}}>
              Saldo inicial sistema
            </label>
            <input type="number" step="0.01" value={form.saldo_sistema}
              onChange={e=>setForm(p=>({...p,saldo_sistema:e.target.value}))}
              placeholder="Según libros"
              style={{...FI,textAlign:'right'}}/>
          </div>
        </div>

        <div style={{padding:'10px 12px',borderRadius:8,marginBottom:14,
          background:C.blueD,border:`1px solid rgba(59,130,246,.3)`,
          fontSize:12,color:C.blue}}>
          Los movimientos del sistema del período se cargarán automáticamente.
          Luego podrás agregar las líneas del estado de cuenta del banco.
        </div>

        {err&&<div style={{padding:'8px 12px',borderRadius:8,fontSize:12,
          background:C.redD,color:'#FCA5A5',marginBottom:12}}>{err}</div>}

        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <button onClick={onCerrar}
            style={{padding:'9px 18px',borderRadius:9,cursor:'pointer',
              border:`1px solid ${C.bord2}`,background:'transparent',
              color:C.muted,fontSize:13}}>Cancelar</button>
          <button onClick={guardar} disabled={saving}
            style={{padding:'9px 24px',borderRadius:9,border:'none',
              background:saving?C.sur3:C.blue,
              color:saving?C.hint:'white',
              cursor:saving?'not-allowed':'pointer',
              fontSize:13,fontWeight:700}}>
            {saving?'Creando...':'Crear conciliación'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Vista detalle de conciliación ────────────────────────────
function DetalleConciliacion({concId, onVolver}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [tab,        setTab]        = useState('banco')  // banco|sistema|resumen
  const [modalLinea, setModalLinea] = useState(false)
  const [formLinea,  setFormLinea]  = useState({fecha:hoy(),descripcion:'',referencia:'',debito:'',credito:'',saldo:''})
  const [fileSaving, setFileSaving] = useState(false)
  const [cerrando,   setCerrando]   = useState(false)
  const [err,        setErr]        = useState('')
  const fileRef = useRef()

  async function cargar() {
    setLoading(true)
    try {
      const{data}=await api.get(`/conciliaciones/${concId}`)
      setData(data)
    }finally{setLoading(false)}
  }

  useEffect(()=>{cargar()},[concId])

  async function toggleLinea(l) {
    if(l.conciliado)
      await api.patch(`/conciliaciones/linea/${l.id}/desconciliar`)
    else
      await api.patch(`/conciliaciones/linea/${l.id}/conciliar`)
    cargar()
  }

  async function agregarLinea() {
    if(!formLinea.descripcion) return
    await api.post(`/conciliaciones/${concId}/linea`,{
      ...formLinea,
      debito:  parseFloat(formLinea.debito)||0,
      credito: parseFloat(formLinea.credito)||0,
      saldo:   parseFloat(formLinea.saldo)||0,
    })
    setModalLinea(false)
    setFormLinea({fecha:hoy(),descripcion:'',referencia:'',debito:'',credito:'',saldo:''})
    cargar()
  }

  async function eliminarLinea(lid) {
    if(!window.confirm('¿Eliminar esta línea?')) return
    try{ await api.delete(`/conciliaciones/linea/${lid}`); cargar() }
    catch(e){ alert(e.response?.data?.detail||e.message) }
  }

  async function importarCSV(e) {
    const file = e.target.files[0]; if(!file) return
    setFileSaving(true)
    try{
      const fd = new FormData(); fd.append('file',file)
      const{data}=await api.post(`/conciliaciones/${concId}/importar-csv`,fd,
        {headers:{'Content-Type':'multipart/form-data'}})
      alert(`Importadas: ${data.importadas}${data.errores?.length?'\nErrores: '+data.errores.join('\n'):''}`)
      cargar()
    }catch(e){ alert(e.response?.data?.detail||e.message) }
    finally{ setFileSaving(false); e.target.value='' }
  }

  async function cerrar() {
    if(!window.confirm('¿Cerrar esta conciliación? No se podrá modificar después.')) return
    setCerrando(true); setErr('')
    try{ await api.post(`/conciliaciones/${concId}/cerrar`); cargar() }
    catch(e){ setErr(e.response?.data?.detail||e.message) }
    finally{ setCerrando(false) }
  }

  if(loading) return(
    <div style={{padding:40,textAlign:'center',color:C.hint}}>Cargando...</div>
  )
  if(!data) return null

  const cerrada    = data.estado==='CERRADA'
  const difColor   = data.diferencia===0?C.green:Math.abs(data.diferencia)<0.01?C.green:
                     data.diferencia>0?C.amber:C.red
  const lineasBanco = data.lineas?.filter(l=>!l.movimiento_id)||[]
  const lineasSis   = data.lineas?.filter(l=> l.movimiento_id)||[]

  return(
    <div>
      {/* Header */}
      <div style={{background:C.surface,borderRadius:14,padding:'16px 20px',
        border:`1px solid ${C.bord2}`,marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <button onClick={onVolver}
              style={{background:'none',border:'none',cursor:'pointer',
                color:C.blue,fontSize:13,padding:0,marginBottom:6}}>
              ← Volver a conciliaciones
            </button>
            <div style={{fontSize:16,fontWeight:800,color:C.text}}>
              🔍 Conciliación — {data.banco}
              <code style={{marginLeft:10,fontSize:13,color:C.purple}}>
                {data.numero_cuenta}
              </code>
            </div>
            <div style={{fontSize:12,color:C.muted,marginTop:3}}>
              Período: <strong>{data.periodo}</strong>
            </div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <span style={{padding:'4px 14px',borderRadius:20,fontSize:12,fontWeight:700,
              background:cerrada?C.greenD:C.amberD,
              color:cerrada?C.green:C.amber}}>
              {cerrada?'✅ Cerrada':'⏳ En proceso'}
            </span>
            {!cerrada&&(
              <button onClick={cerrar} disabled={cerrando||data.pendientes>0}
                style={{padding:'9px 18px',borderRadius:9,border:'none',
                  background:(cerrando||data.pendientes>0)?C.sur3:C.green,
                  color:(cerrando||data.pendientes>0)?C.hint:'white',
                  cursor:(cerrando||data.pendientes>0)?'not-allowed':'pointer',
                  fontSize:13,fontWeight:700}}>
                {cerrando?'Cerrando...':data.pendientes>0?`${data.pendientes} pendientes`:'Cerrar conciliación'}
              </button>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',
          gap:10,marginTop:16}}>
          {[
            {l:'Saldo ini. banco',  v:data.saldo_banco||0, c:C.blue},
            {l:'Saldo fin. banco',  v:data.saldo_banco_fin||data.saldo_banco||0, c:C.blue},
            {l:'Saldo ini. libro',  v:data.saldo_sistema||0, c:C.purple},
            {l:'Saldo fin. libro',  v:data.saldo_libro_fin||data.saldo_sistema||0, c:C.purple},
            {l:'Diferencia',        v:data.diferencia,       c:difColor},
            {l:'Líneas pendientes', v:data.pendientes,       c:data.pendientes>0?C.amber:C.green, noFmt:true},
          ].map((k,i)=>(
            <div key={i} style={{background:C.sur2,borderRadius:10,
              padding:'10px 12px',border:`1px solid ${C.bord2}`,textAlign:'center'}}>
              <div style={{fontSize:9,color:C.hint,textTransform:'uppercase',
                fontWeight:600,marginBottom:3}}>{k.l}</div>
              <div style={{fontSize:15,fontWeight:800,color:k.c}}>
                {k.noFmt?k.v:fmt$(k.v)}
              </div>
            </div>
          ))}
        </div>

        {err&&<div style={{marginTop:10,padding:'8px 12px',borderRadius:8,fontSize:12,
          background:C.redD,color:'#FCA5A5'}}>{err}</div>}
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:0,marginBottom:0,
        background:C.surface,borderRadius:'12px 12px 0 0',
        border:`1px solid ${C.bord2}`,borderBottom:'none'}}>
        {[
          ['banco',   `🏦 Banco (${lineasBanco.length})`],
          ['sistema', `💻 Sistema (${lineasSis.length})`],
          ['resumen', '📊 Resumen'],
        ].map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)}
            style={{flex:1,padding:'12px 16px',border:'none',cursor:'pointer',
              fontSize:13,fontWeight:600,background:'transparent',
              color:tab===v?C.text:C.hint,
              borderBottom:tab===v?`2px solid ${C.blue}`:'2px solid transparent',
              borderRadius:tab===v?'12px 12px 0 0':'0'}}>
            {l}
          </button>
        ))}
      </div>

      {/* Tabla de líneas */}
      <div style={{background:C.surface,border:`1px solid ${C.bord2}`,
        borderTop:'none',borderRadius:'0 0 12px 12px',overflow:'hidden'}}>

        {/* Toolbar */}
        {tab!=='resumen'&&!cerrada&&(
          <div style={{padding:'10px 16px',borderBottom:`1px solid ${C.bord2}`,
            display:'flex',gap:8,alignItems:'center',background:C.sur2}}>
            {tab==='banco'&&(
              <>
                <button onClick={()=>setModalLinea(true)}
                  style={{padding:'7px 14px',borderRadius:8,border:'none',
                    background:C.blue,color:'white',cursor:'pointer',
                    fontSize:12,fontWeight:700}}>
                  + Agregar línea manual
                </button>
                <button onClick={()=>fileRef.current?.click()}
                  disabled={fileSaving}
                  style={{padding:'7px 14px',borderRadius:8,cursor:'pointer',
                    border:`1px solid ${C.bord2}`,background:C.sur2,
                    color:C.muted,fontSize:12,fontWeight:600}}>
                  {fileSaving?'Importando...':'📄 Importar CSV'}
                </button>
                <input ref={fileRef} type="file" accept=".csv"
                  onChange={importarCSV} style={{display:'none'}}/>
                <span style={{fontSize:11,color:C.hint}}>
                  CSV: fecha, descripcion, referencia, debito, credito, saldo
                </span>
              </>
            )}
          </div>
        )}

        {/* ── TAB BANCO ── */}
        {tab==='banco'&&(
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:C.sur3}}>
                {['Fecha','Descripción','Referencia','Débito','Crédito','Saldo','Estado',''].map((h,i)=>(
                  <th key={i} style={{padding:'9px 12px',fontSize:10,fontWeight:700,
                    color:C.hint,textTransform:'uppercase',letterSpacing:'.04em',
                    borderBottom:`1px solid ${C.bord2}`,
                    textAlign:i>=3&&i<=5?'right':'left'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lineasBanco.map(l=>(
                <tr key={l.id}
                  style={{background:l.conciliado?'rgba(16,185,129,.05)':'transparent',
                    opacity:l.conciliado?.8:1}}
                  onMouseEnter={e=>!l.conciliado&&(e.currentTarget.style.background=C.sur2)}
                  onMouseLeave={e=>!l.conciliado&&(e.currentTarget.style.background='transparent')}>
                  <td style={{padding:'9px 12px',fontSize:12,color:C.muted}}>
                    {fmtFecha(l.fecha)}
                  </td>
                  <td style={{padding:'9px 12px',fontSize:13,color:C.text,fontWeight:600}}>
                    {l.descripcion}
                  </td>
                  <td style={{padding:'9px 12px',fontSize:11,color:C.hint}}>
                    {l.referencia||'—'}
                  </td>
                  <td style={{padding:'9px 12px',textAlign:'right',
                    fontWeight:700,fontSize:13,
                    color:Number(l.debito)>0?C.red:C.hint}}>
                    {Number(l.debito)>0?fmt$(l.debito):'—'}
                  </td>
                  <td style={{padding:'9px 12px',textAlign:'right',
                    fontWeight:700,fontSize:13,
                    color:Number(l.credito)>0?C.green:C.hint}}>
                    {Number(l.credito)>0?fmt$(l.credito):'—'}
                  </td>
                  <td style={{padding:'9px 12px',textAlign:'right',
                    fontSize:12,color:C.muted}}>
                    {Number(l.saldo)>0?fmt$(l.saldo):'—'}
                  </td>
                  <td style={{padding:'9px 12px'}}>
                    <span style={{padding:'2px 8px',borderRadius:20,fontSize:10,
                      fontWeight:700,
                      background:l.conciliado?C.greenD:C.amberD,
                      color:l.conciliado?C.green:C.amber}}>
                      {l.conciliado?'Conciliado':'Pendiente'}
                    </span>
                  </td>
                  <td style={{padding:'9px 8px',textAlign:'center'}}>
                    <div style={{display:'flex',gap:4,justifyContent:'center'}}>
                      {!cerrada&&(
                        <button onClick={()=>toggleLinea(l)}
                          style={{padding:'4px 10px',borderRadius:7,cursor:'pointer',
                            border:`1px solid ${l.conciliado?C.green:C.bord2}`,
                            background:l.conciliado?C.greenD:C.sur3,
                            color:l.conciliado?C.green:C.muted,
                            fontSize:11,fontWeight:700}}>
                          {l.conciliado?'✅':'Conciliar'}
                        </button>
                      )}
                      {!cerrada&&!l.conciliado&&(
                        <button onClick={()=>eliminarLinea(l.id)}
                          style={{background:'none',border:'none',cursor:'pointer',
                            color:C.hint,fontSize:15,padding:'2px 6px'}}
                          onMouseEnter={e=>e.currentTarget.style.color=C.red}
                          onMouseLeave={e=>e.currentTarget.style.color=C.hint}>
                          x
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {lineasBanco.length===0&&(
                <tr><td colSpan={8} style={{padding:'32px 0',textAlign:'center',
                  color:C.hint,fontSize:13}}>
                  Sin líneas del banco. Agrega manualmente o importa un CSV.
                </td></tr>
              )}
            </tbody>
            {lineasBanco.length>0&&(
              <tfoot>
                <tr style={{background:C.sur3,borderTop:`2px solid ${C.bord2}`}}>
                  <td colSpan={3} style={{padding:'10px 12px',fontSize:12,
                    fontWeight:700,color:C.muted}}>
                    TOTALES BANCO
                  </td>
                  <td style={{padding:'10px 12px',textAlign:'right',
                    fontWeight:800,fontSize:13,color:C.red}}>
                    {fmt$(data.tot_deb_banco)}
                  </td>
                  <td style={{padding:'10px 12px',textAlign:'right',
                    fontWeight:800,fontSize:13,color:C.green}}>
                    {fmt$(data.tot_cred_banco)}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        )}

        {/* ── TAB SISTEMA ── */}
        {tab==='sistema'&&(
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:C.sur3}}>
                {['Fecha','Tipo','Descripción','Referencia','Débito','Crédito','Estado',''].map((h,i)=>(
                  <th key={i} style={{padding:'9px 12px',fontSize:10,fontWeight:700,
                    color:C.hint,textTransform:'uppercase',letterSpacing:'.04em',
                    borderBottom:`1px solid ${C.bord2}`,
                    textAlign:i>=4&&i<=5?'right':'left'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lineasSis.map(l=>{
                const esIngreso = Number(l.credito)>0
                return(
                  <tr key={l.id}
                    style={{background:l.conciliado?'rgba(16,185,129,.05)':'transparent'}}
                    onMouseEnter={e=>!l.conciliado&&(e.currentTarget.style.background=C.sur2)}
                    onMouseLeave={e=>!l.conciliado&&(e.currentTarget.style.background='transparent')}>
                    <td style={{padding:'9px 12px',fontSize:12,color:C.muted}}>
                      {fmtFecha(l.fecha)}
                    </td>
                    <td style={{padding:'9px 12px'}}>
                      <span style={{fontSize:10,padding:'2px 8px',borderRadius:6,
                        background:esIngreso?C.greenD:C.redD,
                        color:esIngreso?C.green:C.red,fontWeight:700}}>
                        {esIngreso?'Ingreso':'Egreso'}
                      </span>
                    </td>
                    <td style={{padding:'9px 12px',fontSize:13,color:C.text,fontWeight:600}}>
                      {l.descripcion}
                    </td>
                    <td style={{padding:'9px 12px',fontSize:11,color:C.hint}}>
                      {l.referencia||'—'}
                    </td>
                    <td style={{padding:'9px 12px',textAlign:'right',
                      fontWeight:700,fontSize:13,
                      color:Number(l.debito)>0?C.red:C.hint}}>
                      {Number(l.debito)>0?fmt$(l.debito):'—'}
                    </td>
                    <td style={{padding:'9px 12px',textAlign:'right',
                      fontWeight:700,fontSize:13,
                      color:Number(l.credito)>0?C.green:C.hint}}>
                      {Number(l.credito)>0?fmt$(l.credito):'—'}
                    </td>
                    <td style={{padding:'9px 12px'}}>
                      <span style={{padding:'2px 8px',borderRadius:20,fontSize:10,
                        fontWeight:700,
                        background:l.conciliado?C.greenD:C.amberD,
                        color:l.conciliado?C.green:C.amber}}>
                        {l.conciliado?'Conciliado':'Pendiente'}
                      </span>
                    </td>
                    <td style={{padding:'9px 8px',textAlign:'center'}}>
                      {!cerrada&&(
                        <button onClick={()=>toggleLinea(l)}
                          style={{padding:'4px 10px',borderRadius:7,cursor:'pointer',
                            border:`1px solid ${l.conciliado?C.green:C.bord2}`,
                            background:l.conciliado?C.greenD:C.sur3,
                            color:l.conciliado?C.green:C.muted,
                            fontSize:11,fontWeight:700}}>
                          {l.conciliado?'✅':'Conciliar'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {lineasSis.length===0&&(
                <tr><td colSpan={8} style={{padding:'32px 0',textAlign:'center',
                  color:C.hint,fontSize:13}}>
                  Sin movimientos del sistema en este período
                </td></tr>
              )}
            </tbody>
            {lineasSis.length>0&&(
              <tfoot>
                <tr style={{background:C.sur3,borderTop:`2px solid ${C.bord2}`}}>
                  <td colSpan={4} style={{padding:'10px 12px',fontSize:12,
                    fontWeight:700,color:C.muted}}>TOTALES SISTEMA</td>
                  <td style={{padding:'10px 12px',textAlign:'right',
                    fontWeight:800,fontSize:13,color:C.red}}>
                    {fmt$(data.tot_deb_sis)}
                  </td>
                  <td style={{padding:'10px 12px',textAlign:'right',
                    fontWeight:800,fontSize:13,color:C.green}}>
                    {fmt$(data.tot_cred_sis)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        )}

        {/* ── TAB RESUMEN ── */}
        {tab==='resumen'&&(
          <div style={{padding:24}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>

              {/* Columna Banco */}
              <div style={{background:C.sur2,borderRadius:12,padding:16,
                border:`1px solid ${C.bord2}`}}>
                <div style={{fontSize:13,fontWeight:800,color:C.blue,
                  marginBottom:14,textTransform:'uppercase'}}>
                  🏦 Estado de cuenta banco
                </div>
                {[
                  {l:'Saldo inicial',         v:data.saldo_banco||0, bold:false},
                  {l:'(+) Total créditos',     v:data.tot_cred_banco,  c:C.green},
                  {l:'(-) Total débitos',      v:data.tot_deb_banco,   c:C.red},
                  {l:'Saldo final banco',      v:data.saldo_banco_fin||data.saldo_banco||0, bold:true, c:C.blue},
                ].map((r,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',
                    padding:'8px 0',borderBottom:i<3?`1px solid ${C.border}`:'none'}}>
                    <span style={{fontSize:13,color:r.bold?C.text:C.muted}}>{r.l}</span>
                    <span style={{fontSize:r.bold?16:13,fontWeight:r.bold?800:600,
                      color:r.c||(r.bold?C.blue:C.text)}}>
                      {fmt$(r.v)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Columna Sistema */}
              <div style={{background:C.sur2,borderRadius:12,padding:16,
                border:`1px solid ${C.bord2}`}}>
                <div style={{fontSize:13,fontWeight:800,color:C.purple,
                  marginBottom:14,textTransform:'uppercase'}}>
                  💻 Libros del sistema
                </div>
                {[
                  {l:'Saldo inicial',         v:data.saldo_sistema||0, bold:false},
                  {l:'(+) Total ingresos',    v:data.tot_cred_sis,    c:C.green},
                  {l:'(-) Total egresos',     v:data.tot_deb_sis,     c:C.red},
                  {l:'Saldo final libro',     v:data.saldo_libro_fin||data.saldo_sistema||0, bold:true, c:C.purple},
                ].map((r,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',
                    padding:'8px 0',borderBottom:i<3?`1px solid ${C.border}`:'none'}}>
                    <span style={{fontSize:13,color:r.bold?C.text:C.muted}}>{r.l}</span>
                    <span style={{fontSize:r.bold?16:13,fontWeight:r.bold?800:600,
                      color:r.c||(r.bold?C.purple:C.text)}}>
                      {fmt$(r.v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Diferencia */}
            <div style={{marginTop:16,background:C.sur2,borderRadius:12,padding:20,
              border:`2px solid ${difColor}44`,textAlign:'center'}}>
              <div style={{fontSize:11,color:C.hint,textTransform:'uppercase',
                fontWeight:600,marginBottom:8}}>
                Diferencia (Banco - Libro)
              </div>
              <div style={{fontSize:36,fontWeight:900,color:difColor}}>
                {fmt$(data.diferencia)}
              </div>
              <div style={{fontSize:16,fontWeight:700,color:difColor,marginTop:6}}>
                {Math.abs(data.diferencia)<0.01?'✅ CONCILIADO':
                 data.diferencia>0?'⬆ BANCO MAYOR AL LIBRO':
                 '⬇ LIBRO MAYOR AL BANCO'}
              </div>
              {data.pendientes>0&&(
                <div style={{marginTop:10,fontSize:12,color:C.amber}}>
                  {data.pendientes} línea{data.pendientes!==1?'s':''} pendiente{data.pendientes!==1?'s':''} de conciliar
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal agregar línea manual */}
      {modalLinea&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:9000}}>
          <div style={{background:C.surface,borderRadius:16,padding:28,width:480,
            border:`1px solid ${C.bord2}`,boxShadow:'0 25px 60px rgba(0,0,0,.7)'}}>
            <div style={{fontSize:15,fontWeight:800,color:C.text,marginBottom:16}}>
              + Agregar línea del banco
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
              <div>
                <label style={{fontSize:10,color:C.muted,display:'block',marginBottom:3,
                  fontWeight:600,textTransform:'uppercase'}}>Fecha *</label>
                <input type="date" value={formLinea.fecha}
                  onChange={e=>setFormLinea(p=>({...p,fecha:e.target.value}))} style={FI}/>
              </div>
              <div>
                <label style={{fontSize:10,color:C.muted,display:'block',marginBottom:3,
                  fontWeight:600,textTransform:'uppercase'}}>Referencia</label>
                <input value={formLinea.referencia}
                  onChange={e=>setFormLinea(p=>({...p,referencia:e.target.value}))}
                  placeholder="N° transacción..." style={FI}/>
              </div>
            </div>
            <div style={{marginBottom:10}}>
              <label style={{fontSize:10,color:C.muted,display:'block',marginBottom:3,
                fontWeight:600,textTransform:'uppercase'}}>Descripción *</label>
              <input value={formLinea.descripcion}
                onChange={e=>setFormLinea(p=>({...p,descripcion:e.target.value}))}
                placeholder="Descripción del movimiento..." style={FI}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:16}}>
              {[
                {k:'debito',  l:'Débito (-)',  c:C.red},
                {k:'credito', l:'Crédito (+)', c:C.green},
                {k:'saldo',   l:'Saldo',       c:C.blue},
              ].map(f=>(
                <div key={f.k}>
                  <label style={{fontSize:10,color:f.c,display:'block',marginBottom:3,
                    fontWeight:700,textTransform:'uppercase'}}>{f.l}</label>
                  <input type="number" step="0.01" value={formLinea[f.k]}
                    onChange={e=>setFormLinea(p=>({...p,[f.k]:e.target.value}))}
                    style={{...FI,textAlign:'right',borderColor:f.c+'44'}}/>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button onClick={()=>setModalLinea(false)}
                style={{padding:'9px 18px',borderRadius:9,cursor:'pointer',
                  border:`1px solid ${C.bord2}`,background:'transparent',
                  color:C.muted,fontSize:13}}>Cancelar</button>
              <button onClick={agregarLinea}
                disabled={!formLinea.descripcion}
                style={{padding:'9px 22px',borderRadius:9,border:'none',
                  background:formLinea.descripcion?C.blue:C.sur3,
                  color:formLinea.descripcion?'white':C.hint,
                  cursor:formLinea.descripcion?'pointer':'not-allowed',
                  fontSize:13,fontWeight:700}}>
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  PÁGINA PRINCIPAL
// ════════════════════════════════════════════════════════════
export default function Conciliacion() {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const user      = JSON.parse(localStorage.getItem('nexus_user')||'{}')
  const [concs,   setConcs]   = useState([])
  const [cuentas, setCuentas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtCta, setFiltCta] = useState('')
  const [modal,   setModal]   = useState(false)
  const [detalle, setDetalle] = useState(null)
  const [sucNom,  setSucNom]  = useState('')

  async function cargar() {
    setLoading(true)
    try {
      const[c,ct]=await Promise.all([
        api.get('/conciliaciones',{params:{cuenta_id:filtCta||undefined}}),
        api.get('/bancos/cuentas'),
      ])
      setConcs(c.data); setCuentas(ct.data)
    }finally{setLoading(false)}
  }

  useEffect(()=>{
    cargar()
    api.get('/config/sucursales').then(r=>{
      if(user.sucursal_id){
        const s=r.data.find(x=>x.id===parseInt(user.sucursal_id))
        if(s) setSucNom(s.nombre)
      }
    }).catch(()=>{})
  },[])

  if(detalle) return(
    <div style={{background:C.bg,minHeight:'100vh',padding:'24px 28px',
      fontFamily:"'Inter','Segoe UI',system-ui,sans-serif",color:C.text}}>
      <DetalleConciliacion
        concId={detalle}
        onVolver={()=>{setDetalle(null);cargar()}}
      />
    </div>
  )

  const TH=(a='left')=>({padding:'11px 14px',fontSize:10,fontWeight:700,
    color:C.hint,textAlign:a,background:C.sur3,
    borderBottom:`1px solid ${C.bord2}`,textTransform:'uppercase'})
  const TD=(a='left')=>({padding:'12px 14px',fontSize:13,
    borderBottom:`1px solid ${C.border}`,verticalAlign:'middle',color:C.text,textAlign:a})

  return(
    <div style={{background:C.bg,minHeight:'100vh',padding:'24px 28px',
      fontFamily:"'Inter','Segoe UI',system-ui,sans-serif",color:C.text}}>

      <div style={{display:'flex',justifyContent:'space-between',
        alignItems:'flex-start',marginBottom:20}}>
        <div>
          <h1 style={{margin:0,fontSize:24,fontWeight:800}}>🔍 Conciliación Bancaria</h1>
          {sucNom&&(
            <div style={{display:'flex',alignItems:'center',gap:7,marginTop:5,
              padding:'4px 12px',borderRadius:8,width:'fit-content',
              background:C.greenD,border:`1px solid rgba(16,185,129,.25)`}}>
              <span style={{fontSize:13,fontWeight:700,color:C.green}}>🏢 {sucNom}</span>
            </div>
          )}
        </div>
        <button onClick={()=>setModal(true)} disabled={cuentas.length===0}
          style={{padding:'10px 20px',borderRadius:10,border:'none',
            background:cuentas.length===0?C.sur3:C.blue,
            color:cuentas.length===0?C.hint:'white',
            cursor:cuentas.length===0?'not-allowed':'pointer',
            fontSize:14,fontWeight:700,
            boxShadow:cuentas.length===0?'none':'0 4px 14px rgba(59,130,246,.4)'}}>
          + Nueva conciliación
        </button>
      </div>

      {cuentas.length===0&&(
        <div style={{padding:'16px 20px',borderRadius:10,marginBottom:16,
          background:C.amberD,border:`1px solid rgba(245,158,11,.3)`,
          fontSize:13,color:C.amber}}>
          Primero configura las cuentas bancarias en el módulo de Bancos.
        </div>
      )}

      {/* Filtro */}
      <div style={{background:C.surface,borderRadius:12,padding:'12px 16px',
        border:`1px solid ${C.bord2}`,marginBottom:14,
        display:'flex',gap:10,alignItems:'center'}}>
        <select value={filtCta} onChange={e=>{setFiltCta(e.target.value);cargar()}}
          style={{...FI,width:260}}>
          <option value="">Todas las cuentas</option>
          {cuentas.map(c=>(
            <option key={c.id} value={c.id}>{c.banco} — {c.numero_cuenta}</option>
          ))}
        </select>
        <button onClick={cargar}
          style={{padding:'8px 16px',borderRadius:9,border:'none',
            background:C.blue,color:'white',cursor:'pointer',
            fontSize:13,fontWeight:600}}>
          Actualizar
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
                {['Cuenta','Período','Saldo banco','Saldo libro','Diferencia',
                  'Líneas','Estado',''].map((h,i)=>(
                  <th key={i} style={TH(i>=2&&i<=4?'right':'left')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {concs.map(c=>{
                const dif = Number(c.diferencia||0)
                const cerrada = c.estado==='CERRADA'
                const difC = dif===0?C.green:Math.abs(dif)<0.01?C.green:dif>0?C.amber:C.red
                return(
                  <tr key={c.id}
                    onMouseEnter={e=>e.currentTarget.style.background=C.sur2}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={TD()}>
                      <div style={{fontWeight:700}}>{c.banco}</div>
                      <div style={{fontSize:11,color:C.hint}}>{c.numero_cuenta}</div>
                    </td>
                    <td style={{...TD(),fontSize:12,color:C.muted}}>
                      <span style={{fontWeight:700,color:C.text}}>{c.periodo}</span>
                    </td>
                    <td style={{...TD('right'),fontWeight:700,color:C.blue}}>
                      {cerrada?fmt$(c.saldo_banco_fin):'—'}
                    </td>
                    <td style={{...TD('right'),fontWeight:700,color:C.purple}}>
                      {cerrada?fmt$(c.saldo_libro_fin):'—'}
                    </td>
                    <td style={{...TD('right')}}>
                      {cerrada?(
                        <span style={{fontWeight:800,color:difC}}>{fmt$(dif)}</span>
                      ):'—'}
                    </td>
                    <td style={TD()}>
                      <span style={{fontSize:12,color:C.muted}}>
                        {c.lineas_conciliadas}/{c.total_lineas}
                        {' '}conciliadas
                      </span>
                    </td>
                    <td style={TD()}>
                      <span style={{padding:'3px 10px',borderRadius:20,fontSize:11,
                        fontWeight:700,
                        background:cerrada?C.greenD:C.amberD,
                        color:cerrada?C.green:C.amber}}>
                        {cerrada?'✅ Cerrada':'⏳ En proceso'}
                      </span>
                    </td>
                    <td style={{...TD('center')}}>
                      <button onClick={()=>setDetalle(c.id)}
                        style={{padding:'5px 14px',borderRadius:8,cursor:'pointer',
                          border:`1px solid ${C.blue}44`,background:C.blueD,
                          color:C.blue,fontSize:12,fontWeight:700}}>
                        Abrir →
                      </button>
                    </td>
                  </tr>
                )
              })}
              {concs.length===0&&(
                <tr><td colSpan={8} style={{padding:'40px 0',textAlign:'center',
                  color:C.hint,fontSize:13}}>
                  No hay conciliaciones. Crea la primera.
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {modal&&(
        <ModalNueva
          cuentas={cuentas}
          onCerrar={()=>setModal(false)}
          onCreada={id=>{setModal(false);setDetalle(id);cargar()}}
        />
      )}
    </div>
  )
}