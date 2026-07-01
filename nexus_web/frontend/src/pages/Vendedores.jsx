// ============================================================
//  NEXUS POS — Vendedores  (diseño propio, colores vibrantes)
//  Búsqueda por código, nombre y cédula
// ============================================================
import React, { useState, useEffect } from 'react'
import { Search, Plus, Edit2, Eye, X, Target, TrendingUp, Building, Users } from 'lucide-react'
import api from '../api'
import { useTheme } from '../theme'

// ── paleta propia ─────────────────────────────────────────────
const C = {
  bg:        '#0F172A',
  surface:   '#1E293B',
  surface2:  '#263245',
  border:    '#334155',
  border2:   '#475569',
  text:      '#F1F5F9',
  muted:     '#94A3B8',
  hint:      '#64748B',
  blue:      '#3B82F6',
  blueD:     '#1D4ED8',
  blueL:     '#EFF6FF',
  purple:    '#8B5CF6',
  green:     '#10B981',
  amber:     '#F59E0B',
  red:       '#EF4444',
  cyan:      '#06B6D4',
}

const fmt$ = v => '$'+Number(v||0).toLocaleString('es-EC',{minimumFractionDigits:2,maximumFractionDigits:2})

function BarMeta({pct}) {
  const C = useTheme()
  if (pct==null||pct===0) return <span style={{color:C.hint,fontSize:11}}>Sin meta</span>
  const color = pct>=100?C.green:pct>=70?C.amber:C.red
  return (
    <div style={{display:'flex',alignItems:'center',gap:7}}>
      <div style={{width:70,height:6,borderRadius:3,background:C.border,overflow:'hidden'}}>
        <div style={{width:`${Math.min(pct,100)}%`,height:'100%',background:color,borderRadius:3,transition:'width .4s'}}/>
      </div>
      <span style={{fontSize:11,fontWeight:700,color}}>{pct}%</span>
    </div>
  )
}

// ── Modal Vendedor ────────────────────────────────────────────
function ModalVendedor({vendedor, sucursales, onClose, onSaved}) {
  const C = useTheme()
  const esEdit = !!vendedor?.id
  const [form, setForm] = useState({
    cedula:              vendedor?.cedula              ?? '',
    nombre:              vendedor?.nombre              ?? '',
    apellidos:           vendedor?.apellidos           ?? '',
    email:               vendedor?.email               ?? '',
    telefono:            vendedor?.telefono            ?? '',
    ciudad:              vendedor?.ciudad              ?? '',
    direccion:           vendedor?.direccion           ?? '',
    sucursal_id:         vendedor?.sucursal_id         ?? '',
    comision_pct:        vendedor?.comision_pct        ?? 0,
    meta_mensual:        vendedor?.meta_mensual        ?? '',
    observaciones:       vendedor?.observaciones       ?? '',
    activo:              vendedor?.activo              ?? true,
  })
  const [saving,setSaving]=useState(false)
  const [err,setErr]=useState('')
  const s=(k,v)=>setForm(f=>({...f,[k]:v}))

  async function guardar() {
    if (!form.cedula.trim()||!form.nombre.trim()) return setErr('Cédula y nombre son obligatorios')
    if (!form.sucursal_id) return setErr('Selecciona una sucursal')
    setSaving(true); setErr('')
    try {
      const payload={...form,
        sucursal_id:Number(form.sucursal_id),
        comision_pct:parseFloat(form.comision_pct)||0,
        meta_mensual:form.meta_mensual!==''?parseFloat(form.meta_mensual):null,
      }
      if (esEdit) await api.put(`/vendedores/${vendedor.id}`,payload)
      else        await api.post('/vendedores',payload)
      onSaved()
    } catch(e){setErr(e.response?.data?.detail||e.message)} finally{setSaving(false)}
  }

  const fi={width:'100%',padding:'9px 12px',borderRadius:8,fontSize:13,
    border:`1px solid ${C.border}`,background:C.sur2,color:C.text,
    outline:'none',boxSizing:'border-box'}
  const lbl={fontSize:11,fontWeight:600,color:C.muted,display:'block',
    marginBottom:4,textTransform:'uppercase',letterSpacing:'.05em'}

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',display:'flex',
      alignItems:'center',justifyContent:'center',zIndex:9000}}>
      <div style={{background:C.surface,borderRadius:16,padding:28,width:560,
        maxHeight:'90vh',overflowY:'auto',border:`1px solid ${C.border}`,
        boxShadow:'0 25px 60px rgba(0,0,0,.6)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}>
          <div style={{fontSize:16,fontWeight:700,color:C.text}}>
            {esEdit?'✏️ Editar vendedor':'➕ Nuevo vendedor'}
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:20}}>×</button>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          {[
            {k:'cedula',l:'Cédula / RUC',req:true,disabled:esEdit},
            {k:'nombre',l:'Nombres',req:true},
            {k:'apellidos',l:'Apellidos'},
            {k:'telefono',l:'Teléfono'},
            {k:'email',l:'Email',full:false},
            {k:'ciudad',l:'Ciudad'},
          ].map(({k,l,req,disabled,full})=>(
            <div key={k} style={full===false?{}:{gridColumn:'1/-1'}}>
              <label style={lbl}>{l}{req&&<span style={{color:C.red}}> *</span>}</label>
              <input value={form[k]} onChange={e=>s(k,e.target.value)}
                disabled={disabled} style={{...fi,opacity:disabled?.6:1}}/>
            </div>
          ))}

          <div style={{gridColumn:'1/-1'}}>
            <label style={lbl}>Sucursal <span style={{color:C.red}}>*</span></label>
            <select value={form.sucursal_id} onChange={e=>s('sucursal_id',e.target.value)} style={fi}>
              <option value="">— Selecciona —</option>
              {sucursales.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>

          <div>
            <label style={lbl}>Comisión (%)</label>
            <input type="number" min="0" max="100" step="0.1" value={form.comision_pct}
              onChange={e=>s('comision_pct',e.target.value)} style={fi}/>
          </div>

          <div>
            <label style={lbl}>Meta mensual ($)</label>
            <input type="number" min="0" step="100" value={form.meta_mensual}
              onChange={e=>s('meta_mensual',e.target.value)} placeholder="Ej: 5000" style={fi}/>
          </div>

          <div style={{gridColumn:'1/-1'}}>
            <label style={lbl}>Observaciones</label>
            <textarea value={form.observaciones} onChange={e=>s('observaciones',e.target.value)}
              style={{...fi,height:60,resize:'vertical',fontFamily:'inherit'}}/>
          </div>

          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <input type="checkbox" id="vact" checked={form.activo}
              onChange={e=>s('activo',e.target.checked)}
              style={{width:16,height:16,cursor:'pointer',accentColor:C.blue}}/>
            <label htmlFor="vact" style={{color:C.text,fontSize:13,cursor:'pointer'}}>Vendedor activo</label>
          </div>
        </div>

        {err&&<div style={{marginTop:14,padding:'9px 14px',borderRadius:8,
          background:'rgba(239,68,68,.15)',border:'1px solid rgba(239,68,68,.3)',
          color:'#FCA5A5',fontSize:13}}>⚠️ {err}</div>}

        <div style={{display:'flex',gap:10,marginTop:22,justifyContent:'flex-end'}}>
          <button onClick={onClose} style={{padding:'9px 20px',borderRadius:9,
            border:`1px solid ${C.border}`,background:'transparent',
            color:C.muted,cursor:'pointer',fontSize:13}}>Cancelar</button>
          <button onClick={guardar} disabled={saving} style={{padding:'9px 24px',
            borderRadius:9,border:'none',background:C.blue,color:'white',
            cursor:'pointer',fontSize:13,fontWeight:700}}>
            {saving?'Guardando...':esEdit?'Guardar cambios':'Crear vendedor'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal Ver ────────────────────────────────────────────────
function ModalVer({vendedor:v, onClose}) {
  const C = useTheme()
  if (!v) return null
  const cumplimiento = v.meta_mensual>0
    ? Math.round((v.ventas_mes_actual/v.meta_mensual)*100)
    : null

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',display:'flex',
      alignItems:'center',justifyContent:'center',zIndex:9000}}>
      <div style={{background:C.surface,borderRadius:16,padding:28,width:480,
        border:`1px solid ${C.border}`,boxShadow:'0 25px 60px rgba(0,0,0,.6)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div style={{fontSize:16,fontWeight:700,color:C.text}}>👤 {v.nombre} {v.apellidos||''}</div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:20}}>×</button>
        </div>
        {[
          ['Cédula/RUC', v.cedula],
          ['Sucursal',   v.sucursal_nombre||'—'],
          ['Teléfono',   v.telefono||'—'],
          ['Email',      v.email||'—'],
          ['Ciudad',     v.ciudad||'—'],
          ['Ingreso',    v.fecha_ingreso?new Date(v.fecha_ingreso).toLocaleDateString('es-EC'):'—'],
          ['Comisión',   `${Number(v.comision_pct||0).toFixed(1)}%`],
          ['Meta mensual', v.meta_mensual>0?fmt$(v.meta_mensual):'Sin meta'],
          ['Ventas mes', fmt$(v.ventas_mes_actual)],
        ].map(([k,val])=>(
          <div key={k} style={{display:'flex',justifyContent:'space-between',
            padding:'8px 0',borderBottom:`1px solid ${C.border}`,fontSize:13}}>
            <span style={{color:C.muted}}>{k}</span>
            <span style={{color:C.text,fontWeight:500}}>{val}</span>
          </div>
        ))}
        {cumplimiento!==null&&(
          <div style={{marginTop:14}}>
            <div style={{fontSize:11,color:C.muted,marginBottom:6}}>CUMPLIMIENTO DE META</div>
            <BarMeta pct={cumplimiento}/>
          </div>
        )}
        <button onClick={onClose} style={{marginTop:20,width:'100%',padding:'9px',
          borderRadius:9,border:`1px solid ${C.border}`,background:'transparent',
          color:C.muted,cursor:'pointer',fontSize:13}}>Cerrar</button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
export default function Vendedores() {
  const C = useTheme()
  const [vendedores,  setVendedores]  = useState([])
  const [sucursales,  setSucursales]  = useState([])
  const [loading,     setLoading]     = useState(true)
  const [busqueda,    setBusqueda]    = useState('')
  const [filtActivo,  setFiltActivo]  = useState('true')
  const [filtSuc,     setFiltSuc]     = useState('')
  const [modal,       setModal]       = useState(null)   // null|'nuevo'|vendedorObj
  const [verModal,    setVerModal]    = useState(null)

  async function cargar(bus=busqueda) {
    setLoading(true)
    try {
      const [v,s] = await Promise.all([
        api.get('/vendedores',{params:{busqueda:bus,activo:filtActivo,sucursal_id:filtSuc||undefined}}),
        api.get('/vendedores/sucursales/lista').catch(()=>({data:[]})),
      ])
      setVendedores(v.data); setSucursales(s.data)
    } catch(e){console.error(e)} finally{setLoading(false)}
  }

  useEffect(()=>{cargar()},[filtActivo,filtSuc])

  const activos     = vendedores.filter(v=>v.activo).length
  const conMeta     = vendedores.filter(v=>v.meta_mensual>0).length
  const totalVentas = vendedores.reduce((a,v)=>a+Number(v.ventas_mes_actual||0),0)

  const KPIs = [
    {label:'Activos',          value:activos,           color:C.blue,   icon:'👥'},
    {label:'Con meta',         value:conMeta,           color:C.purple, icon:'🎯'},
    {label:'Ventas del mes',   value:fmt$(totalVentas), color:C.green,  icon:'📈'},
    {label:'Sucursales',       value:sucursales.length, color:C.amber,  icon:'🏢'},
  ]

  const TH={padding:'11px 14px',fontSize:11,fontWeight:700,color:C.hint,
    textTransform:'uppercase',letterSpacing:'.06em',
    borderBottom:`1px solid ${C.border}`,background:C.surface,
    whiteSpace:'nowrap',textAlign:'left'}
  const TD={padding:'12px 14px',fontSize:13,color:C.text,
    borderBottom:`1px solid ${C.border}`,verticalAlign:'middle'}

  return (
    <div style={{background:C.bg,minHeight:'100vh',padding:'24px 28px',
      fontFamily:"'Inter','Segoe UI',system-ui,sans-serif",color:C.text}}>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24}}>
        <div>
          <h1 style={{margin:0,fontSize:24,fontWeight:800,color:C.text}}>👥 Vendedores</h1>
          <p style={{margin:'4px 0 0',color:C.muted,fontSize:13}}>
            {activos} vendedores activos · {sucursales.length} sucursales
          </p>
        </div>
        <button onClick={()=>setModal('nuevo')}
          style={{display:'flex',alignItems:'center',gap:7,padding:'10px 20px',
            borderRadius:10,border:'none',background:C.blue,color:'white',
            cursor:'pointer',fontSize:14,fontWeight:700,
            boxShadow:`0 4px 14px rgba(59,130,246,.4)`}}>
          ＋ Nuevo vendedor
        </button>
      </div>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:24}}>
        {KPIs.map((k,i)=>(
          <div key={i} style={{background:C.surface,borderRadius:12,padding:'16px 18px',
            border:`1px solid ${C.border}`,
            display:'flex',alignItems:'center',gap:14}}>
            <div style={{fontSize:28,lineHeight:1}}>{k.icon}</div>
            <div>
              <div style={{fontSize:11,color:C.hint,fontWeight:600,textTransform:'uppercase',
                letterSpacing:'.05em'}}>{k.label}</div>
              <div style={{fontSize:22,fontWeight:800,color:k.color,marginTop:2}}>{k.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{background:C.surface,borderRadius:12,padding:'14px 16px',
        border:`1px solid ${C.border}`,marginBottom:16,
        display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>

        {/* Búsqueda: código, nombre, cédula */}
        <div style={{position:'relative',flex:1,minWidth:260}}>
          <Search size={15} style={{position:'absolute',left:12,top:'50%',
            transform:'translateY(-50%)',color:C.hint}}/>
          <input value={busqueda}
            onChange={e=>setBusqueda(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&cargar(busqueda)}
            placeholder="Buscar por código, nombre o cédula..."
            style={{paddingLeft:34,width:'100%',padding:'9px 12px 9px 34px',
              borderRadius:9,border:`1px solid ${C.border}`,
              background:C.sur2,color:C.text,fontSize:13,
              outline:'none',boxSizing:'border-box'}}/>
        </div>

        <button onClick={()=>cargar(busqueda)}
          style={{padding:'9px 16px',borderRadius:9,border:'none',
            background:C.blue,color:'white',cursor:'pointer',
            fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:6}}>
          <Search size={13}/> Buscar
        </button>

        <select value={filtSuc} onChange={e=>setFiltSuc(e.target.value)}
          style={{padding:'9px 12px',borderRadius:9,border:`1px solid ${C.border}`,
            background:C.sur2,color:C.text,fontSize:13,outline:'none'}}>
          <option value="">Todas las sucursales</option>
          {sucursales.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>

        <div style={{display:'flex',borderRadius:9,overflow:'hidden',
          border:`1px solid ${C.border}`}}>
          {[['true','Activos'],['false','Inactivos'],['','Todos']].map(([v,l])=>(
            <button key={v} onClick={()=>setFiltActivo(v)}
              style={{padding:'9px 14px',border:'none',cursor:'pointer',fontSize:12,fontWeight:600,
                background:filtActivo===v?C.blue:C.sur2,
                color:filtActivo===v?'white':C.muted,transition:'all .15s'}}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div style={{background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,overflow:'hidden'}}>
        {loading ? (
          <div style={{padding:40,textAlign:'center',color:C.hint,fontSize:13}}>Cargando vendedores...</div>
        ) : vendedores.length===0 ? (
          <div style={{padding:40,textAlign:'center',color:C.hint,fontSize:13}}>
            No se encontraron vendedores
          </div>
        ) : (
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr>
                {['Código','Nombre','Sucursal','Cédula','Teléfono','Comisión','Meta mensual','Ventas mes','Cumplimiento','Estado',''].map((h,i)=>(
                  <th key={i} style={{...TH,textAlign:i>=5&&i<=8?'center':'left'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendedores.map(v=>{
                const cumpl = v.meta_mensual>0
                  ? Math.round((v.ventas_mes_actual/v.meta_mensual)*100)
                  : null
                return (
                  <tr key={v.id}
                    onMouseEnter={e=>e.currentTarget.style.background=C.sur2}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>

                    <td style={TD}>
                      <code style={{fontSize:12,color:C.purple,fontWeight:700}}>{v.codigo||'—'}</code>
                    </td>

                    <td style={TD}>
                      <div style={{fontWeight:700,color:C.text}}>{v.nombre} {v.apellidos||''}</div>
                      {v.email&&<div style={{fontSize:11,color:C.hint}}>{v.email}</div>}
                    </td>

                    <td style={TD}>
                      {v.sucursal_nombre
                        ? <span style={{background:'rgba(59,130,246,.15)',color:'#93C5FD',
                            padding:'3px 10px',borderRadius:6,fontSize:12,fontWeight:600}}>
                            {v.sucursal_nombre}
                          </span>
                        : <span style={{color:C.hint}}>—</span>
                      }
                    </td>

                    <td style={{...TD}}>
                      <span style={{fontFamily:'monospace',fontSize:12,color:C.muted}}>{v.cedula||'—'}</span>
                    </td>

                    <td style={{...TD,color:C.muted,fontSize:12}}>{v.telefono||'—'}</td>

                    <td style={{...TD,textAlign:'center'}}>
                      <span style={{background:'rgba(6,182,212,.15)',color:'#67E8F9',
                        padding:'3px 10px',borderRadius:20,fontSize:12,fontWeight:700}}>
                        {Number(v.comision_pct||0).toFixed(1)}%
                      </span>
                    </td>

                    <td style={{...TD,textAlign:'center',color:'#A78BFA',fontWeight:600}}>
                      {v.meta_mensual>0?fmt$(v.meta_mensual):<span style={{color:C.hint,fontSize:11}}>Sin meta</span>}
                    </td>

                    <td style={{...TD,textAlign:'center',color:'#6EE7B7',fontWeight:700}}>
                      {fmt$(v.ventas_mes_actual)}
                    </td>

                    <td style={{...TD,textAlign:'center'}}>
                      <BarMeta pct={cumpl}/>
                    </td>

                    <td style={{...TD,textAlign:'center'}}>
                      <span style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,
                        background:v.activo?'rgba(16,185,129,.15)':'rgba(100,116,139,.15)',
                        color:v.activo?C.green:C.hint}}>
                        {v.activo?'Activo':'Inactivo'}
                      </span>
                    </td>

                    <td style={{...TD,textAlign:'center'}}>
                      <div style={{display:'flex',gap:5,justifyContent:'center'}}>
                        <button onClick={()=>setVerModal(v)} title="Ver detalle"
                          style={{padding:'5px 9px',borderRadius:7,
                            border:`1px solid ${C.border}`,background:C.sur2,
                            color:C.muted,cursor:'pointer',fontSize:13}}>
                          👁
                        </button>
                        <button onClick={()=>setModal(v)} title="Editar"
                          style={{padding:'5px 9px',borderRadius:7,
                            border:`1px solid ${C.border}`,background:C.sur2,
                            color:C.muted,cursor:'pointer',fontSize:13}}>
                          ✏️
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

      {modal&&(
        <ModalVendedor
          vendedor={modal==='nuevo'?null:modal}
          sucursales={sucursales}
          onClose={()=>setModal(null)}
          onSaved={()=>{setModal(null);cargar()}}
        />
      )}
      {verModal&&<ModalVer vendedor={verModal} onClose={()=>setVerModal(null)}/>}
    </div>
  )
}