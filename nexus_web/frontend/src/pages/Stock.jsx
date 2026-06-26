// ============================================================
//  NEXUS POS — Inventario (Stock por bodega + Series)
// ============================================================
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Plus, ChevronDown, ChevronRight, Edit2, Eye,
         Package, ToggleLeft, ToggleRight, X, Check, Trash2 } from 'lucide-react'
import ModalProducto from '../components/ModalProducto'
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
const fmt$ = v => '$'+Number(v||0).toLocaleString('es-EC',{minimumFractionDigits:2,maximumFractionDigits:2})
const FI = {
  padding:'8px 11px', borderRadius:8, fontSize:13,
  border:`1px solid ${C.bord2}`, background:C.sur2,
  color:C.text, outline:'none', boxSizing:'border-box', width:'100%'
}

// ── Modal contenedor ──────────────────────────────────────────
function Modal({open,onClose,title,children,width=500}){
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  if(!open) return null
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.surface,borderRadius:16,padding:28,
        width,maxWidth:'97vw',maxHeight:'90vh',overflow:'auto',
        border:`1px solid ${C.bord2}`,boxShadow:'0 25px 60px rgba(0,0,0,.7)'}}>
        <div style={{display:'flex',justifyContent:'space-between',
          alignItems:'center',marginBottom:20}}>
          <h2 style={{margin:0,fontSize:16,fontWeight:700,color:C.text}}>{title}</h2>
          <button onClick={onClose} style={{background:'none',border:'none',
            cursor:'pointer',color:C.hint,fontSize:22}}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Panel de series por bodega ────────────────────────────────
function PanelSeries({producto, bodegas, onClose}){
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [series,  setSeries]  = useState([])
  const [loading, setLoading] = useState(true)
  const [bodSel,  setBodSel]  = useState('')
  const [nueva,   setNueva]   = useState('')
  const [bodNueva,setBodNueva]= useState('')
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState('')
  const [soloActivas, setSoloActivas] = useState(true)  // ocultar vendidas por defecto

  async function cargar(){
    setLoading(true)
    try{
      const{data}=await api.get(`/productos/${producto.id}/series`,
        {params:{bodega_id:bodSel||undefined}})
      setSeries(data)
    }finally{setLoading(false)}
  }

  useEffect(()=>{cargar()},[bodSel])

  async function agregar(){
    if(!nueva.trim()) return setMsg('⚠️ Ingresa el número de serie')
    setSaving(true); setMsg('')
    try{
      await api.post(`/productos/${producto.id}/series`,{
        serie:nueva.trim(), bodega_id:bodNueva||null
      })
      setNueva(''); cargar()
    }catch(e){setMsg('❌ '+(e.response?.data?.detail||e.message))}
    finally{setSaving(false)}
  }

  async function cambiarEstado(sid, estado){
    await api.patch(`/series/${sid}/estado`,null,{params:{estado}})
    cargar()
  }

  async function eliminar(sid){
    if(!window.confirm('¿Eliminar esta serie?')) return
    try{await api.delete(`/series/${sid}`); cargar()}
    catch(e){setMsg('❌ '+(e.response?.data?.detail||e.message))}
  }

  const ESTADOS = ['DISPONIBLE','EXHIBICION','DEVUELTA','DAÑADA','VENDIDA','TRANSFERIDA']
  const ESTADO_COLOR = {
    DISPONIBLE:  {bg:C.greenD,                        c:C.green},
    EXHIBICION:  {bg:'rgba(139,92,246,.18)',            c:C.purple},
    DEVUELTA:    {bg:C.amberD,                         c:C.amber},
    DAÑADA:      {bg:C.redD,                           c:C.red},
    VENDIDA:     {bg:C.blueD,                          c:C.blue},
    TRANSFERIDA: {bg:'rgba(6,182,212,.15)',             c:C.cyan},
  }
  const ESTADO_LABEL = {
    DISPONIBLE:'Disponible', EXHIBICION:'En percha',
    DEVUELTA:'Devuelta', DAÑADA:'Dañada',
    VENDIDA:'Vendida', TRANSFERIDA:'Transferida',
  }

  return(
    <Modal open={true} onClose={onClose}
      title={`📋 Series — ${producto.descripcion}`} width={640}>
      {/* Filtro bodega */}
      <div style={{display:'flex',gap:10,marginBottom:14}}>
        <select value={bodSel} onChange={e=>setBodSel(e.target.value)}
          style={{...FI,width:200}}>
          <option value="">Todas las bodegas</option>
          {bodegas.map(b=><option key={b.id} value={b.id}>{b.nombre}</option>)}
        </select>
        <div style={{fontSize:13,color:C.muted,display:'flex',alignItems:'center',gap:6}}>
          <span style={{fontWeight:700,color:C.green,fontSize:16}}>
            {series.filter(s=>s.estado==='DISPONIBLE').length}
          </span>
          <span style={{fontSize:13,color:C.muted}}> disponibles · </span>
          <span style={{fontWeight:700,color:C.purple,fontSize:16}}>
            {series.filter(s=>s.estado==='EXHIBICION').length}
          </span>
          <span style={{fontSize:13,color:C.muted}}> en percha · </span>
          <span style={{fontSize:13,color:C.hint}}>{series.length} total</span>
          {series.filter(s=>['VENDIDA','TRANSFERIDA'].includes(s.estado)).length>0&&(
            <span style={{fontSize:12,color:C.hint,marginLeft:4}}>
              · <span style={{color:C.blue}}>
                  {series.filter(s=>['VENDIDA','TRANSFERIDA'].includes(s.estado)).length}
                </span> vendidas
            </span>
          )}
        </div>
      </div>

      {/* Tabla de series */}
      <div style={{background:C.sur2,borderRadius:10,border:`1px solid ${C.bord2}`,
        overflow:'hidden',marginBottom:16,maxHeight:300,overflowY:'auto'}}>
        {/* Toggle ocultar vendidas */}
        <div style={{display:'flex',justifyContent:'flex-end',marginBottom:8}}>
          <label style={{display:'flex',gap:7,alignItems:'center',
            fontSize:12,cursor:'pointer',color:C.muted}}>
            <input type="checkbox" checked={soloActivas}
              onChange={e=>setSoloActivas(e.target.checked)}
              style={{cursor:'pointer',accentColor:C.purple,width:14,height:14}}/>
            Ocultar vendidas y transferidas
          </label>
        </div>

        {(() => {
          const seriesFiltradas = soloActivas
            ? series.filter(s=>!['VENDIDA','TRANSFERIDA'].includes(s.estado))
            : series
          return loading?(
            <div style={{padding:20,textAlign:'center',color:C.hint}}>Cargando...</div>
          ):seriesFiltradas.length===0?(
            <div style={{padding:20,textAlign:'center',color:C.hint,fontSize:13}}>
              {soloActivas&&series.length>0
                ? <span>Todas las series están vendidas o transferidas.
                    <button onClick={()=>setSoloActivas(false)}
                      style={{marginLeft:8,background:'none',border:'none',
                        cursor:'pointer',color:C.blue,textDecoration:'underline',
                        fontSize:12}}>
                      Ver todas
                    </button>
                  </span>
                : 'Sin series registradas'
              }
            </div>
          ):(
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:C.sur3}}>
                {['Serie / IMEI','Bodega','Estado',''].map((h,i)=>(
                  <th key={i} style={{padding:'8px 12px',fontSize:10,fontWeight:700,
                    color:C.hint,textTransform:'uppercase',letterSpacing:'.05em',
                    borderBottom:`1px solid ${C.bord2}`,textAlign:'left'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {seriesFiltradas.map(s=>{
                const ec = ESTADO_COLOR[s.estado]||ESTADO_COLOR.DISPONIBLE
                return(
                  <tr key={s.id} style={{borderBottom:`1px solid ${C.border}`}}>
                    <td style={{padding:'9px 12px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <code style={{fontSize:13,fontWeight:700,color:C.purple}}>
                          {s.serie}
                        </code>
                        {s.estado==='EXHIBICION'&&(
                          <span style={{fontSize:9,padding:'2px 7px',borderRadius:6,
                            background:'rgba(139,92,246,.2)',color:C.purple,
                            fontWeight:700}}>
                            📦 EN PERCHA
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{padding:'9px 12px',fontSize:12,color:C.muted}}>
                      {s.bodega||'—'}
                    </td>
                    <td style={{padding:'9px 12px'}}>
                      <span style={{padding:'3px 10px',borderRadius:20,fontSize:11,
                        fontWeight:700,background:ec.bg,color:ec.c}}>
                        {ESTADO_LABEL[s.estado]||s.estado}
                      </span>
                    </td>
                    <td style={{padding:'9px 8px',textAlign:'center'}}>
                      <div style={{display:'flex',gap:4,justifyContent:'center'}}>
                        {/* Solo se puede toggle percha desde DISPONIBLE o EXHIBICION */}
                        {(s.estado==='DISPONIBLE'||s.estado==='EXHIBICION')&&(
                          <>
                            <button
                              onClick={()=>cambiarEstado(s.id,
                                s.estado==='EXHIBICION'?'DISPONIBLE':'EXHIBICION')}
                              title={s.estado==='EXHIBICION'?'Quitar de percha':'Poner en percha'}
                              style={{padding:'4px 10px',borderRadius:6,cursor:'pointer',
                                border:`1px solid rgba(139,92,246,.4)`,
                                background:s.estado==='EXHIBICION'
                                  ?'rgba(139,92,246,.25)':C.sur3,
                                color:C.purple,fontSize:10,fontWeight:700,
                                whiteSpace:'nowrap'}}>
                              {s.estado==='EXHIBICION'?'📦 Quitar':'📦 Percha'}
                            </button>
                            <button onClick={()=>eliminar(s.id)}
                              title="Eliminar serie"
                              style={{background:'none',border:'none',cursor:'pointer',
                                color:C.hint,padding:4,borderRadius:4}}
                              onMouseEnter={e=>e.currentTarget.style.color=C.red}
                              onMouseLeave={e=>e.currentTarget.style.color=C.hint}>
                              <Trash2 size={13}/>
                            </button>
                          </>
                        )}
                        {/* Vendida/Transferida/Dañada/Devuelta — solo lectura */}
                        {!['DISPONIBLE','EXHIBICION'].includes(s.estado)&&(
                          <span style={{fontSize:10,color:C.hint,fontStyle:'italic'}}>
                            Solo lectura
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          )
        })()}
      </div>

      {/* Agregar nueva serie */}
      <div style={{background:C.sur2,borderRadius:10,padding:14,
        border:`1px solid ${C.bord2}`}}>
        <div style={{fontSize:11,fontWeight:700,color:C.muted,
          textTransform:'uppercase',marginBottom:10}}>
          ➕ Agregar serie / IMEI
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 160px auto',gap:8}}>
          <input value={nueva} onChange={e=>setNueva(e.target.value.toUpperCase())}
            onKeyDown={e=>e.key==='Enter'&&agregar()}
            placeholder="Número de serie o IMEI"
            style={FI}/>
          <select value={bodNueva} onChange={e=>setBodNueva(e.target.value)}
            style={FI}>
            <option value="">Sin bodega</option>
            {bodegas.map(b=>(
              <option key={b.id} value={b.id}>{b.nombre}</option>
            ))}
          </select>
          <button onClick={agregar} disabled={saving}
            style={{padding:'8px 16px',borderRadius:8,border:'none',
              background:saving?C.sur3:C.green,color:saving?C.hint:'white',
              cursor:saving?'not-allowed':'pointer',fontSize:13,fontWeight:700,
              whiteSpace:'nowrap'}}>
            {saving?'...':'+ Agregar'}
          </button>
        </div>
        {msg&&(
          <div style={{marginTop:8,padding:'6px 10px',borderRadius:6,fontSize:12,
            background:msg.startsWith('❌')?C.redD:C.amberD,
            color:msg.startsWith('❌')?'#FCA5A5':'#FCD34D'}}>
            {msg}
          </div>
        )}
      </div>
    </Modal>
  )
}

// ════════════════════════════════════════════════════════════
//  PÁGINA PRINCIPAL
// ════════════════════════════════════════════════════════════
export default function Stock(){
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [productos,  setProductos]  = useState([])
  const [bodegas,    setBodegas]    = useState([])
  const [marcas,     setMarcas]     = useState([])
  const [cats,       setCats]       = useState([])
  const [tiposP,     setTiposP]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [resumen,    setResumen]    = useState(null)

  // Filtros
  const [bus,        setBus]        = useState('')
  const [bodSel,     setBodSel]     = useState('')
  const [soloStock,  setSoloStock]  = useState(false)

  // Modales
  const [modalProd,  setModalProd]  = useState(false)
  const [modalTabInicial, setModalTabInicial] = useState(0)
  const [modalMarca, setModalMarca] = useState(false)
  const [modalCat,   setModalCat]   = useState(false)
  const [prodEdit,   setProdEdit]   = useState(null)
  const [modalSeries,setModalSeries]= useState(null)  // producto obj

  // Expandido
  const [expanded,   setExpanded]   = useState(new Set())

  // Formularios marca/cat
  const [fMarca,     setFMarca]     = useState('')
  const [fCat,       setFCat]       = useState('')

  const cargar = useCallback(async()=>{
    setLoading(true)
    try{
      const[p,b,m,c,tp,r]=await Promise.all([
        api.get('/inventario/stock-agrupado',{params:{
          busqueda:bus,bodega_id:bodSel||undefined,solo_stock:soloStock
        }}),
        api.get('/bodegas'),
        api.get('/marcas'),
        api.get('/categorias'),
        api.get('/tipos-precio'),
        api.get('/inventario/resumen'),
      ])
      setProductos(p.data); setBodegas(b.data)
      setMarcas(m.data); setCats(c.data)
      setTiposP(tp.data); setResumen(r.data)
    }finally{setLoading(false)}
  },[bus,bodSel,soloStock])

  useEffect(()=>{cargar()},[bodSel,soloStock])

  function toggleExpand(id){
    setExpanded(prev=>{
      const n=new Set(prev)
      n.has(id)?n.delete(id):n.add(id)
      return n
    })
  }

  async function guardarMarca(){
    if(!fMarca.trim()) return
    await api.post('/marcas',{nombre:fMarca.toUpperCase()})
    setFMarca(''); setModalMarca(false); cargar()
  }

  async function guardarCat(){
    if(!fCat.trim()) return
    await api.post('/categorias',{nombre:fCat.toUpperCase()})
    setFCat(''); setModalCat(false); cargar()
  }

  async function toggleActivo(p){
    await api.patch(`/productos/${p.id}/toggle`); cargar()
  }

  // KPIs
  const KPI_DATA = resumen ? [
    {l:'Total productos', v:resumen.total_productos, c:C.purple},
    {l:'Con stock',       v:resumen.con_stock,       c:C.green},
    {l:'Sin stock',       v:resumen.sin_stock,       c:C.red},
    {l:'Stock bajo',      v:resumen.stock_bajo,      c:C.amber},
    {l:'Valor inventario',v:fmt$(resumen.valor_inventario), c:C.blue},
  ] : []

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
          <h1 style={{margin:0,fontSize:24,fontWeight:800}}>📦 Inventario</h1>
          <p style={{margin:'4px 0 0',color:C.muted,fontSize:13}}>
            Stock por bodega · Productos · Series
          </p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>setModalMarca(true)}
            style={{padding:'9px 14px',borderRadius:9,border:`1px solid ${C.bord2}`,
              background:C.sur2,color:C.muted,cursor:'pointer',fontSize:12,fontWeight:600}}>
            🏷 Nueva marca
          </button>
          <button onClick={()=>setModalCat(true)}
            style={{padding:'9px 14px',borderRadius:9,border:`1px solid ${C.bord2}`,
              background:C.sur2,color:C.muted,cursor:'pointer',fontSize:12,fontWeight:600}}>
            📂 Nueva categoría
          </button>
          <button onClick={()=>{setProdEdit(null);setModalProd(true)}}
            style={{display:'flex',alignItems:'center',gap:7,
              padding:'9px 18px',borderRadius:9,border:'none',
              background:C.purple,color:'white',cursor:'pointer',
              fontSize:13,fontWeight:700,
              boxShadow:'0 4px 14px rgba(139,92,246,.4)'}}>
            <Plus size={15}/> Nuevo producto
          </button>
        </div>
      </div>

      {/* KPIs */}
      {resumen&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',
          gap:10,marginBottom:20}}>
          {KPI_DATA.map((k,i)=>(
            <div key={i} style={{background:C.surface,borderRadius:12,
              padding:'14px 16px',border:`1px solid ${C.bord2}`}}>
              <div style={{fontSize:10,color:C.hint,fontWeight:600,
                textTransform:'uppercase',letterSpacing:'.05em'}}>{k.l}</div>
              <div style={{fontSize:20,fontWeight:800,color:k.c,marginTop:6}}>{k.v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div style={{background:C.surface,borderRadius:12,padding:'12px 16px',
        border:`1px solid ${C.bord2}`,marginBottom:14,
        display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
        <div style={{position:'relative',flex:1,minWidth:220}}>
          <Search size={15} style={{position:'absolute',left:12,
            top:'50%',transform:'translateY(-50%)',color:C.hint}}/>
          <input placeholder="Buscar por código o descripción..."
            value={bus} onChange={e=>setBus(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&cargar()}
            style={{...FI,paddingLeft:34}}/>
        </div>
        <select value={bodSel} onChange={e=>setBodSel(e.target.value)}
          style={{...FI,width:190}}>
          <option value="">Todas las bodegas</option>
          {bodegas.map(b=>(
            <option key={b.id} value={b.id}>{b.nombre}</option>
          ))}
        </select>
        <label style={{display:'flex',gap:7,alignItems:'center',
          fontSize:13,cursor:'pointer',color:C.muted,whiteSpace:'nowrap'}}>
          <input type="checkbox" checked={soloStock}
            onChange={e=>setSoloStock(e.target.checked)}
            style={{cursor:'pointer',accentColor:C.blue,width:15,height:15}}/>
          Solo con stock
        </label>
        <button onClick={cargar}
          style={{padding:'8px 16px',borderRadius:9,border:'none',
            background:C.blue,color:'white',cursor:'pointer',
            fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:6}}>
          <Search size={13}/> Buscar
        </button>
      </div>

      {/* Tabla */}
      <div style={{background:C.surface,borderRadius:12,
        border:`1px solid ${C.bord2}`,overflow:'hidden'}}>
        {loading?(
          <div style={{padding:40,textAlign:'center',color:C.hint}}>
            Cargando inventario...
          </div>
        ):(
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr>
                <th style={{...TH(),width:32}}></th>
                <th style={TH()}>Código</th>
                <th style={TH()}>Descripción</th>
                <th style={TH()}>Categoría</th>
                <th style={TH('right')}>Stock total</th>
                <th style={TH('right')}>Costo</th>
                <th style={TH('right')}>Precio</th>
                <th style={TH('center')}>Estado</th>
                <th style={TH('center')}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productos.map(p=>{
                const isOpen = expanded.has(p.id)
                const stk = Number(p.stock_total||0)
                const bajo = stk>0&&stk<=5
                const cero = stk===0
                return(
                  <React.Fragment key={p.id}>
                    {/* Fila principal */}
                    <tr style={{background:isOpen?C.sur2:'transparent',
                      cursor:'pointer'}}
                      onClick={()=>toggleExpand(p.id)}
                      onMouseEnter={e=>!isOpen&&(e.currentTarget.style.background=C.sur2)}
                      onMouseLeave={e=>!isOpen&&(e.currentTarget.style.background='transparent')}>

                      <td style={{...TD('center'),padding:'10px 8px'}}>
                        <span style={{color:C.hint,transition:'transform .2s',
                          display:'inline-block',
                          transform:isOpen?'rotate(90deg)':'rotate(0deg)'}}>
                          <ChevronRight size={14}/>
                        </span>
                      </td>

                      <td style={TD()}>
                        <code style={{fontSize:12,color:C.purple,fontWeight:700}}>
                          {p.codigo}
                        </code>
                      </td>

                      <td style={TD()}>
                        <div style={{fontWeight:600}}>{p.descripcion}</div>
                        <div style={{display:'flex',gap:5,marginTop:3,flexWrap:'wrap'}}>
                          {p.marca_nombre&&(
                            <span style={{fontSize:10,color:C.hint}}>{p.marca_nombre}</span>
                          )}
                          {p.aplica_series&&(
                            <span style={{fontSize:10,padding:'1px 6px',borderRadius:6,
                              background:C.blueD,color:C.blue,fontWeight:700}}>
                              Series{p.series_disponibles>0?` (${p.series_disponibles})`:' (0)'}
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{...TD(),fontSize:12,color:C.hint}}>
                        {p.categoria_nombre||'—'}
                      </td>

                      <td style={{...TD('right')}}>
                        <span style={{padding:'3px 10px',borderRadius:20,
                          fontSize:12,fontWeight:700,
                          background:cero?C.redD:bajo?C.amberD:C.greenD,
                          color:cero?C.red:bajo?C.amber:C.green}}>
                          {stk.toFixed(0)} u.
                        </span>
                      </td>

                      <td style={{...TD('right'),fontSize:12,color:C.hint}}>
                        {fmt$(p.costo)}
                      </td>

                      <td style={{...TD('right'),fontWeight:700,color:C.blue}}>
                        {fmt$(Number(p.precio_venta||0) * (1 + Number(p.iva_porcentaje||0)/100))}
                      </td>

                      <td style={{...TD('center')}}>
                        <span style={{padding:'3px 10px',borderRadius:20,
                          fontSize:11,fontWeight:700,
                          background:p.activo?C.greenD:C.sur3,
                          color:p.activo?C.green:C.hint}}>
                          {p.activo?'Activo':'Inactivo'}
                        </span>
                      </td>

                      <td style={{...TD('center')}}
                        onClick={e=>e.stopPropagation()}>
                        <div style={{display:'flex',gap:5,justifyContent:'center'}}>
                          <button onClick={()=>{setProdEdit(p);setModalProd(true)}}
                            title="Editar"
                            style={{padding:'5px 9px',borderRadius:7,cursor:'pointer',
                              border:`1px solid ${C.bord2}`,background:C.sur2,
                              color:C.muted}}>
                            <Edit2 size={13}/>
                          </button>
                          <button onClick={()=>toggleActivo(p)}
                            title={p.activo?'Desactivar':'Activar'}
                            style={{padding:'5px 9px',borderRadius:7,cursor:'pointer',
                              border:`1px solid ${C.bord2}`,background:C.sur2}}>
                            {p.activo
                              ?<ToggleRight size={14} color={C.green}/>
                              :<ToggleLeft  size={14} color={C.hint}/>}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Fila expandida: stock por bodega */}
                    {isOpen&&(
                      <tr style={{background:C.sur3}}>
                        <td colSpan={9} style={{padding:'0 0 0 48px'}}>
                          <div style={{padding:'10px 16px 14px'}}>
                            <div style={{fontSize:11,fontWeight:700,color:C.hint,
                              textTransform:'uppercase',letterSpacing:'.05em',
                              marginBottom:10}}>
                              Stock por bodega
                            </div>
                            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                              {(p.stock_bodegas||[]).map((b,i)=>{
                                const cant=Number(b.cantidad||0)
                                const min=Number(b.min||0)
                                const alertaBajo=min>0&&cant<min
                                const alertaCero=cant===0
                                return(
                                  <div key={i} style={{
                                    background:alertaCero?C.redD:alertaBajo?C.amberD:C.greenD,
                                    border:`1px solid ${alertaCero?C.red:alertaBajo?C.amber:C.green}44`,
                                    borderRadius:10,padding:'10px 14px',minWidth:140}}>
                                    <div style={{fontSize:11,color:C.muted,
                                      fontWeight:600,marginBottom:4}}>
                                      {b.bodega}
                                      {b.es_principal&&(
                                        <span style={{marginLeft:5,fontSize:9,
                                          color:C.blue}}>★</span>
                                      )}
                                    </div>
                                    <div style={{fontSize:20,fontWeight:800,
                                      color:alertaCero?C.red:alertaBajo?C.amber:C.green}}>
                                      {cant.toFixed(0)}
                                      <span style={{fontSize:11,fontWeight:400,
                                        color:C.hint,marginLeft:3}}>u.</span>
                                    </div>
                                    {min>0&&(
                                      <div style={{fontSize:10,color:C.hint,marginTop:2}}>
                                        Mín: {min.toFixed(0)}
                                        {Number(b.max)>0&&` · Máx: ${Number(b.max).toFixed(0)}`}
                                        {alertaBajo&&(
                                          <span style={{color:C.amber,
                                            fontWeight:700,marginLeft:4}}>
                                            ⚠ Bajo mínimo
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                              {(!p.stock_bodegas||p.stock_bodegas.length===0)&&(
                                <div style={{color:C.hint,fontSize:13}}>
                                  Sin stock en ninguna bodega
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
              {productos.length===0&&(
                <tr><td colSpan={9} style={{textAlign:'center',
                  padding:'48px 0',color:C.hint,fontSize:13}}>
                  No se encontraron productos
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal producto */}
      <ModalProducto
        open={modalProd}
        onClose={()=>setModalProd(false)}
        producto={prodEdit}
        marcas={marcas}
        categorias={cats}
        tiposPrecio={tiposP}
        bodegas={bodegas}
        onGuardado={()=>{setModalProd(false);cargar()}}
      />

      {/* Modal series — ahora se maneja dentro de ModalProducto pestaña Series */}

      {/* Modal marca */}
      <Modal open={modalMarca} onClose={()=>setModalMarca(false)}
        title="🏷 Nueva marca" width={380}>
        <div style={{marginBottom:12}}>
          <label style={{fontSize:11,fontWeight:600,color:C.muted,
            display:'block',marginBottom:4,textTransform:'uppercase'}}>
            Nombre *
          </label>
          <input value={fMarca} onChange={e=>setFMarca(e.target.value.toUpperCase())}
            onKeyDown={e=>e.key==='Enter'&&guardarMarca()}
            placeholder="Ej: SAMSUNG, APPLE, LG..." style={FI}/>
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <button onClick={()=>setModalMarca(false)}
            style={{padding:'9px 18px',borderRadius:8,cursor:'pointer',
              border:`1px solid ${C.bord2}`,background:'transparent',
              color:C.muted,fontSize:13}}>Cancelar</button>
          <button onClick={guardarMarca} disabled={!fMarca.trim()}
            style={{padding:'9px 18px',borderRadius:8,border:'none',
              background:fMarca.trim()?C.blue:C.sur3,
              color:fMarca.trim()?'white':C.hint,
              cursor:fMarca.trim()?'pointer':'not-allowed',
              fontSize:13,fontWeight:700}}>
            <Check size={14} style={{marginRight:5,verticalAlign:'middle'}}/>
            Guardar
          </button>
        </div>
      </Modal>

      {/* Modal categoría */}
      <Modal open={modalCat} onClose={()=>setModalCat(false)}
        title="📂 Nueva categoría" width={380}>
        <div style={{marginBottom:12}}>
          <label style={{fontSize:11,fontWeight:600,color:C.muted,
            display:'block',marginBottom:4,textTransform:'uppercase'}}>
            Nombre *
          </label>
          <input value={fCat} onChange={e=>setFCat(e.target.value.toUpperCase())}
            onKeyDown={e=>e.key==='Enter'&&guardarCat()}
            placeholder="Ej: CELULARES, ACCESORIOS..." style={FI}/>
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <button onClick={()=>setModalCat(false)}
            style={{padding:'9px 18px',borderRadius:8,cursor:'pointer',
              border:`1px solid ${C.bord2}`,background:'transparent',
              color:C.muted,fontSize:13}}>Cancelar</button>
          <button onClick={guardarCat} disabled={!fCat.trim()}
            style={{padding:'9px 18px',borderRadius:8,border:'none',
              background:fCat.trim()?C.purple:C.sur3,
              color:fCat.trim()?'white':C.hint,
              cursor:fCat.trim()?'pointer':'not-allowed',
              fontSize:13,fontWeight:700}}>
            <Check size={14} style={{marginRight:5,verticalAlign:'middle'}}/>
            Guardar
          </button>
        </div>
      </Modal>
    </div>
  )
}