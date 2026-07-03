// ============================================================
//  NEXUS POS — Caja Chica
//  Control de gastos menores con foto del recibo y reembolso
// ============================================================
import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../theme'
import api from '../api'
import { Plus, RefreshCw, Check, X, DollarSign, FileText,
         Camera, AlertTriangle, Download } from 'lucide-react'

const fmt$ = v => '$'+Number(v||0).toLocaleString('es-EC',{minimumFractionDigits:2,maximumFractionDigits:2})
const fmtF = v => v ? new Date(v+'T00:00:00').toLocaleDateString('es-EC') : '—'

const CATEGORIAS = ['ALIMENTACION','TRANSPORTE','MATERIALES','SERVICIOS','LIMPIEZA',
                    'COMUNICACIONES','MANTENIMIENTO','VARIOS']

const ESTADO_COLORS = {
  PENDIENTE:  { bg:'rgba(245,158,11,.15)', color:'#F59E0B' },
  APROBADO:   { bg:'rgba(16,185,129,.15)', color:'#10B981' },
  RECHAZADO:  { bg:'rgba(239,68,68,.15)',  color:'#EF4444' },
}

export default function CajaChica() {
  const C = useTheme()
  const [tab, setTab]         = useState('gastos')
  const [fondos, setFondos]   = useState([])
  const [gastos, setGastos]   = useState([])
  const [resumen, setResumen] = useState({})
  const [fondoSel, setFondoSel] = useState('')
  const [sucursales, setSucursales] = useState([])
  const [usuarios, setUsuarios]     = useState([])
  const [modalFondo, setModalFondo] = useState(null)
  const [modalGasto, setModalGasto] = useState(false)
  const [loading, setLoading]       = useState(false)
  const [msg, setMsg]               = useState(null)

  const cargar = async () => {
    setLoading(true)
    try {
      const [f, g, r] = await Promise.all([
        api.get('/caja-chica/fondos'),
        api.get('/caja-chica/gastos', { params: fondoSel ? { fondo_id: fondoSel } : {} }),
        api.get('/caja-chica/resumen', { params: fondoSel ? { fondo_id: fondoSel } : {} }),
      ])
      setFondos(f.data || [])
      setGastos(g.data || [])
      setResumen(r.data || {})
      if (!fondoSel && f.data?.length > 0) setFondoSel(f.data[0].id)
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    cargar()
    api.get('/sucursales').then(r=>setSucursales(r.data||[])).catch(()=>{})
    api.get('/usuarios').then(r=>setUsuarios(r.data||[])).catch(()=>{})
  }, [])

  useEffect(() => { if(fondoSel) cargar() }, [fondoSel])

  const aprobar = async (gid) => {
    try { await api.patch(`/caja-chica/gastos/${gid}/aprobar`); cargar() }
    catch(e) { setMsg({ok:false, text:e.response?.data?.detail||'Error'}) }
  }

  const rechazar = async (gid) => {
    const motivo = prompt('Motivo del rechazo (opcional):')
    if (motivo === null) return
    try { await api.patch(`/caja-chica/gastos/${gid}/rechazar`, { motivo }); cargar() }
    catch(e) { setMsg({ok:false, text:e.response?.data?.detail||'Error'}) }
  }

  const reembolsar = async (fid) => {
    if (!confirm('¿Generar reembolso de todos los gastos aprobados pendientes?')) return
    try {
      const r = await api.post(`/caja-chica/fondos/${fid}/reembolso`)
      setMsg({ok:true, text:r.data.msg})
      cargar()
    } catch(e) { setMsg({ok:false, text:e.response?.data?.detail||'Error'}) }
  }

  const sty = {
    card: { background:C.surface, borderRadius:12, border:`1px solid ${C.border}`, padding:20, marginBottom:16 },
    btn:  (col=C.blue) => ({ padding:'8px 16px', borderRadius:8, border:'none', background:col,
           color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer',
           display:'inline-flex', alignItems:'center', gap:6 }),
    btnO: (col=C.blue) => ({ padding:'8px 14px', borderRadius:8,
           border:`1px solid ${col}44`, background:`${col}15`, color:col,
           fontWeight:700, fontSize:12, cursor:'pointer',
           display:'inline-flex', alignItems:'center', gap:6 }),
  }

  const fondoActual = fondos.find(f=>f.id===parseInt(fondoSel))

  return (
    <div style={{padding:20,minHeight:'100vh',background:C.bg,color:C.text,
      fontFamily:"'Inter','Segoe UI',system-ui,sans-serif"}}>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{margin:0,fontSize:22,fontWeight:900,color:C.text}}>💼 Caja Chica</h1>
          <p style={{margin:'4px 0 0',color:C.muted,fontSize:13}}>
            Control de gastos menores y reembolsos
          </p>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button onClick={()=>setModalFondo({})} style={sty.btnO(C.purple)}>
            <Plus size={13}/> Nuevo fondo
          </button>
          <button onClick={()=>setModalGasto(true)} disabled={!fondoSel}
            style={{...sty.btn(),opacity:!fondoSel?.5:1}}>
            <Plus size={13}/> Registrar gasto
          </button>
        </div>
      </div>

      {msg && (
        <div style={{padding:'10px 16px',borderRadius:8,marginBottom:16,fontSize:13,
          background:msg.ok?'rgba(16,185,129,.1)':'rgba(239,68,68,.1)',
          border:`1px solid ${msg.ok?'#10B98133':'#EF444433'}`,
          color:msg.ok?C.green:C.red,display:'flex',justifyContent:'space-between'}}>
          {msg.ok?'✅':'❌'} {msg.text}
          <button onClick={()=>setMsg(null)} style={{background:'none',border:'none',cursor:'pointer',color:C.muted}}>×</button>
        </div>
      )}

      {/* KPIs del resumen */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
        {[
          {icon:'⏳',label:'Pendientes de aprobar',v:resumen.pendientes||0,    col:C.amber},
          {icon:'✅',label:'Aprobados este mes',   v:fmt$(resumen.gasto_mes),   col:C.green},
          {icon:'💰',label:'Por reembolsar',       v:fmt$(resumen.pendiente_reembolso), col:C.red},
          {icon:'❌',label:'Rechazados',            v:resumen.rechazados||0,     col:C.muted},
        ].map((k,i)=>(
          <div key={i} style={{background:C.surface,borderRadius:12,padding:'14px 16px',
            border:`1px solid ${C.border}`,textAlign:'center'}}>
            <div style={{fontSize:22,marginBottom:4}}>{k.icon}</div>
            <div style={{fontSize:18,fontWeight:900,color:k.col}}>{k.v}</div>
            <div style={{fontSize:10,color:C.muted,fontWeight:600,textTransform:'uppercase',marginTop:2}}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Selector de fondo */}
      {fondos.length > 0 && (
        <div style={{...sty.card,display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:200}}>
            <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:4}}>Fondo</label>
            <select value={fondoSel} onChange={e=>setFondoSel(e.target.value)}
              style={{width:'100%',padding:'8px 12px',borderRadius:8,fontSize:13,
                background:C.sur2,border:`1px solid ${C.bord2}`,color:C.text,outline:'none'}}>
              <option value="">— Todos los fondos —</option>
              {fondos.map(f=>(
                <option key={f.id} value={f.id}>
                  {f.nombre} · Asignado: {fmt$(f.monto_asignado)} · Disponible: {fmt$(f.saldo_disponible)}
                </option>
              ))}
            </select>
          </div>
          {fondoActual && (
            <button onClick={()=>reembolsar(fondoActual.id)} style={sty.btnO(C.green)}>
              <RefreshCw size={13}/> Generar reembolso
            </button>
          )}
          {fondoActual && (
            <button onClick={()=>setModalFondo(fondoActual)} style={sty.btnO(C.blue)}>
              ✏️ Editar fondo
            </button>
          )}
        </div>
      )}

      {fondos.length === 0 && (
        <div style={{...sty.card,textAlign:'center',padding:40,color:C.muted}}>
          <DollarSign size={40} style={{opacity:.3,marginBottom:12}}/>
          <div style={{fontSize:14,fontWeight:600}}>No hay fondos de caja chica</div>
          <div style={{fontSize:12,marginTop:4}}>Crea un fondo con el botón "Nuevo fondo"</div>
        </div>
      )}

      {/* Lista de gastos */}
      {fondos.length > 0 && (
        <div style={{background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr>
                {['Fecha','Concepto','Categoría','Proveedor','Monto','Recibo','Estado','Acciones'].map(h=>(
                  <th key={h} style={{padding:'11px 14px',textAlign:'left',fontSize:10,
                    fontWeight:700,color:C.hint,textTransform:'uppercase',
                    borderBottom:`1px solid ${C.border}`,background:C.surface,
                    letterSpacing:'.05em'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gastos.length === 0 && (
                <tr><td colSpan={8} style={{padding:30,textAlign:'center',color:C.muted}}>
                  Sin gastos registrados
                </td></tr>
              )}
              {gastos.map(g => {
                const est = ESTADO_COLORS[g.estado] || ESTADO_COLORS.PENDIENTE
                return (
                  <tr key={g.id} style={{borderBottom:`1px solid ${C.border}`}}
                    onMouseEnter={e=>e.currentTarget.style.background=C.sur2}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{padding:'10px 14px',color:C.muted,fontSize:12}}>{fmtF(g.fecha)}</td>
                    <td style={{padding:'10px 14px'}}>
                      <div style={{fontWeight:600,color:C.text}}>{g.concepto}</div>
                      {g.observacion && <div style={{fontSize:10,color:C.hint}}>{g.observacion}</div>}
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      <span style={{padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:600,
                        background:'rgba(139,92,246,.15)',color:C.purple}}>{g.categoria}</span>
                    </td>
                    <td style={{padding:'10px 14px',color:C.muted,fontSize:12}}>{g.proveedor||'—'}</td>
                    <td style={{padding:'10px 14px',fontWeight:700,color:C.green}}>{fmt$(g.monto)}</td>
                    <td style={{padding:'10px 14px',textAlign:'center'}}>
                      {g.foto_recibo
                        ? <a href={g.foto_recibo} target="_blank" rel="noreferrer"
                            style={{color:C.blue,fontSize:12}}>📷 Ver</a>
                        : <span style={{color:C.hint,fontSize:11}}>—</span>}
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      <span style={{padding:'3px 10px',borderRadius:20,fontSize:11,
                        fontWeight:700,background:est.bg,color:est.color}}>
                        {g.estado}
                      </span>
                      {g.reembolsado && <span style={{marginLeft:4,fontSize:10,color:C.muted}}>✓ Reembolsado</span>}
                    </td>
                    <td style={{padding:'10px 14px',whiteSpace:'nowrap'}}>
                      {g.estado === 'PENDIENTE' && (
                        <div style={{display:'flex',gap:4}}>
                          <button onClick={()=>aprobar(g.id)}
                            style={{...sty.btn(C.green),padding:'4px 10px',fontSize:11}}>
                            <Check size={11}/> Aprobar
                          </button>
                          <button onClick={()=>rechazar(g.id)}
                            style={{...sty.btnO(C.red),padding:'4px 10px',fontSize:11}}>
                            <X size={11}/>
                          </button>
                        </div>
                      )}
                      {g.estado === 'APROBADO' && !g.reembolsado && (
                        <span style={{fontSize:11,color:C.amber}}>⏳ Pendiente reembolso</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal fondo */}
      {modalFondo !== null && (
        <ModalFondo fondo={modalFondo} sucursales={sucursales} usuarios={usuarios}
          C={C} sty={sty}
          onClose={()=>setModalFondo(null)}
          onSaved={()=>{setModalFondo(null);cargar()}} />
      )}

      {/* Modal gasto */}
      {modalGasto && (
        <ModalGasto fondos={fondos} fondoSel={fondoSel} C={C} sty={sty}
          onClose={()=>setModalGasto(false)}
          onSaved={()=>{setModalGasto(false);cargar()}} />
      )}
    </div>
  )
}

// ── Modal Fondo ───────────────────────────────────────────────
function ModalFondo({ fondo, sucursales, usuarios, C, sty, onClose, onSaved }) {
  const esEdit = !!fondo?.id
  const [form, setForm] = useState({
    nombre: fondo?.nombre||'', sucursal_id: fondo?.sucursal_id||'',
    responsable_id: fondo?.responsable_id||'',
    monto_asignado: fondo?.monto_asignado||0, descripcion: fondo?.descripcion||''
  })
  const [saving, setSaving] = useState(false)
  const fi = {width:'100%',padding:'9px 12px',borderRadius:8,fontSize:13,
    background:C.sur2,border:`1px solid ${C.bord2}`,color:C.text,outline:'none',boxSizing:'border-box'}

  const guardar = async () => {
    if (!form.nombre) return alert('El nombre es obligatorio')
    setSaving(true)
    try {
      if (esEdit) await api.put(`/caja-chica/fondos/${fondo.id}`, form)
      else        await api.post('/caja-chica/fondos', form)
      onSaved()
    } catch(e) { alert(e.response?.data?.detail||'Error') }
    setSaving(false)
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}>
      <div style={{background:C.surface,borderRadius:14,border:`1px solid ${C.bord2}`,
        padding:28,width:440}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div style={{fontWeight:800,fontSize:15,color:C.text}}>
            {esEdit?'✏️ Editar fondo':'➕ Nuevo fondo de caja chica'}
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:22}}>×</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:4}}>Nombre *</label>
            <input value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))}
              style={fi} placeholder="Ej: Caja chica oficina principal"/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:4}}>Monto asignado $</label>
              <input type="number" min="0" step="0.01" value={form.monto_asignado}
                onChange={e=>setForm(p=>({...p,monto_asignado:e.target.value}))}
                style={fi}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:4}}>Sucursal</label>
              <select value={form.sucursal_id} onChange={e=>setForm(p=>({...p,sucursal_id:e.target.value}))} style={fi}>
                <option value="">— General —</option>
                {sucursales.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:4}}>Responsable</label>
            <select value={form.responsable_id} onChange={e=>setForm(p=>({...p,responsable_id:e.target.value}))} style={fi}>
              <option value="">— Seleccionar —</option>
              {usuarios.map(u=><option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:4}}>Descripción</label>
            <input value={form.descripcion} onChange={e=>setForm(p=>({...p,descripcion:e.target.value}))}
              style={fi} placeholder="Uso del fondo..."/>
          </div>
        </div>
        <div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end'}}>
          <button onClick={onClose}
            style={{padding:'9px 20px',borderRadius:8,border:`1px solid ${C.bord2}`,
              background:'transparent',color:C.muted,cursor:'pointer',fontSize:13}}>Cancelar</button>
          <button onClick={guardar} disabled={saving}
            style={{...sty.btn(),padding:'9px 24px'}}>
            {saving?'Guardando...':'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal Gasto ───────────────────────────────────────────────
function ModalGasto({ fondos, fondoSel, C, sty, onClose, onSaved }) {
  const hoy = new Date().toISOString().slice(0,10)
  const [form, setForm] = useState({
    fondo_id: fondoSel||'', fecha:hoy, concepto:'', categoria:'VARIOS',
    monto:'', proveedor:'', numero_recibo:'', observacion:''
  })
  const [foto, setFoto]     = useState(null)
  const [saving, setSaving] = useState(false)
  const [gastoId, setGastoId] = useState(null)
  const fileRef = useRef()
  const fi = {width:'100%',padding:'9px 12px',borderRadius:8,fontSize:13,
    background:C.sur2,border:`1px solid ${C.bord2}`,color:C.text,outline:'none',boxSizing:'border-box'}

  const guardar = async () => {
    if (!form.concepto || !form.monto || !form.fondo_id)
      return alert('Fondo, concepto y monto son obligatorios')
    setSaving(true)
    try {
      const r = await api.post('/caja-chica/gastos', form)
      const gid = r.data.id
      setGastoId(gid)
      if (foto) {
        const fd = new FormData(); fd.append('file', foto)
        await api.post(`/caja-chica/gastos/${gid}/foto`, fd,
          { headers:{'Content-Type':'multipart/form-data'} })
      }
      onSaved()
    } catch(e) { alert(e.response?.data?.detail||'Error') }
    setSaving(false)
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}>
      <div style={{background:C.surface,borderRadius:14,border:`1px solid ${C.bord2}`,
        padding:28,width:500,maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div style={{fontWeight:800,fontSize:15,color:C.text}}>➕ Registrar gasto</div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:22}}>×</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:4}}>Fondo *</label>
              <select value={form.fondo_id} onChange={e=>setForm(p=>({...p,fondo_id:e.target.value}))} style={fi}>
                <option value="">— Seleccionar —</option>
                {fondos.map(f=><option key={f.id} value={f.id}>{f.nombre}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:4}}>Fecha *</label>
              <input type="date" value={form.fecha} onChange={e=>setForm(p=>({...p,fecha:e.target.value}))} style={fi}/>
            </div>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:4}}>Concepto *</label>
            <input value={form.concepto} onChange={e=>setForm(p=>({...p,concepto:e.target.value}))}
              style={fi} placeholder="Descripción del gasto"/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:4}}>Categoría</label>
              <select value={form.categoria} onChange={e=>setForm(p=>({...p,categoria:e.target.value}))} style={fi}>
                {CATEGORIAS.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:4}}>Monto $ *</label>
              <input type="number" min="0" step="0.01" value={form.monto}
                onChange={e=>setForm(p=>({...p,monto:e.target.value}))} style={fi} placeholder="0.00"/>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:4}}>Proveedor</label>
              <input value={form.proveedor} onChange={e=>setForm(p=>({...p,proveedor:e.target.value}))}
                style={fi} placeholder="Nombre del proveedor"/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:4}}>N° Recibo</label>
              <input value={form.numero_recibo} onChange={e=>setForm(p=>({...p,numero_recibo:e.target.value}))}
                style={fi} placeholder="Número de factura/recibo"/>
            </div>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:4}}>Observación</label>
            <input value={form.observacion} onChange={e=>setForm(p=>({...p,observacion:e.target.value}))}
              style={fi} placeholder="Nota adicional (opcional)"/>
          </div>

          {/* Foto del recibo */}
          <div style={{padding:'12px 16px',borderRadius:10,
            background:C.sur2,border:`1px solid ${C.bord2}`}}>
            <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:8}}>
              📷 Foto del recibo (opcional)
            </div>
            <div style={{display:'flex',gap:10,alignItems:'center'}}>
              <button onClick={()=>fileRef.current?.click()}
                style={{...sty.btnO(C.blue),padding:'7px 14px',fontSize:12}}>
                <Camera size={13}/> {foto?'Cambiar foto':'Subir foto'}
              </button>
              {foto && <span style={{fontSize:12,color:C.green}}>✅ {foto.name}</span>}
              <input ref={fileRef} type="file" accept="image/*,application/pdf"
                style={{display:'none'}} onChange={e=>setFoto(e.target.files?.[0]||null)}/>
            </div>
          </div>
        </div>

        <div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end'}}>
          <button onClick={onClose}
            style={{padding:'9px 20px',borderRadius:8,border:`1px solid ${C.bord2}`,
              background:'transparent',color:C.muted,cursor:'pointer',fontSize:13}}>Cancelar</button>
          <button onClick={guardar} disabled={saving}
            style={{...sty.btn(),padding:'9px 24px'}}>
            {saving?'Guardando...':'Registrar gasto'}
          </button>
        </div>
      </div>
    </div>
  )
}
