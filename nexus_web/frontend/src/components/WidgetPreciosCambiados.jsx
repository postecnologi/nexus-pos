// ============================================================
//  NEXUS POS — Widget: Precios Actualizados
//  Se usa en el Dashboard — muestra cambios recientes de precio
//  con acceso directo a imprimir etiquetas
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { useTheme } from '../theme'

const C = {
  bg:'#0A0F1E', surface:'#111827', sur2:'#1F2937', sur3:'#374151',
  border:'#1F2937', bord2:'#374151',
  text:'#F9FAFB', muted:'#9CA3AF', hint:'#6B7280',
  blue:'#3B82F6', green:'#10B981', amber:'#F59E0B',
  red:'#EF4444', purple:'#8B5CF6',
  greenD:'rgba(16,185,129,.15)', amberD:'rgba(245,158,11,.15)',
  redD:'rgba(239,68,68,.15)', blueD:'rgba(59,130,246,.15)',
}
const fmt$ = v => '$'+Number(v||0).toLocaleString('es-EC',
  {minimumFractionDigits:2,maximumFractionDigits:2})
const fmtHora = d => {
  const diff = (Date.now()-new Date(d).getTime())/1000
  if(diff<60)    return 'hace unos segundos'
  if(diff<3600)  return `hace ${Math.floor(diff/60)} min`
  if(diff<86400) return `hace ${Math.floor(diff/3600)} h`
  return new Date(d).toLocaleDateString('es-EC',{day:'2-digit',month:'2-digit'})
}

export default function WidgetPreciosCambiados() {
  const C = useTheme()
  const navigate  = useNavigate()
  const [cambios, setCambios]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [horas,   setHoras]     = useState(72)
  const [selImp,  setSelImp]    = useState([])  // ids seleccionados para imprimir
  const [expanded,setExpanded]  = useState(true)

  const cargar = useCallback(async()=>{
    setLoading(true)
    try{
      const{data}=await api.get('/precios/cambios-recientes',{params:{horas}})
      setCambios(data)
    }catch{}finally{setLoading(false)}
  },[horas])

  useEffect(()=>{cargar()},[cargar])

  // Auto-refresh cada 2 minutos
  useEffect(()=>{
    const t=setInterval(cargar, 120_000)
    return ()=>clearInterval(t)
  },[cargar])

  function toggleSel(pid) {
    setSelImp(p=>p.includes(pid)?p.filter(x=>x!==pid):[...p,pid])
  }
  function selTodos() {
    setSelImp(selImp.length===cambios.length?[]:cambios.map(c=>c.producto_id))
  }

  async function marcarImpreso(ids) {
    try{
      await api.post('/precios/marcar-impreso', {ids})
      setCambios(p=>p.filter(c=>!ids.includes(c.id)))
      setSelImp([])
    }catch(e){ alert('Error: '+e.message) }
  }

  async function marcarTodos() {
    if(!window.confirm('¿Marcar todos los cambios como impresos?')) return
    try{
      await api.post('/precios/marcar-impreso-todos')
      setCambios([])
      setSelImp([])
    }catch(e){ alert('Error: '+e.message) }
  }

  function irAImprimir(idsHistorial, prodsOverride) {
    const base = prodsOverride || cambios.filter(c=>selImp.includes(c.producto_id))
    const prods = base.map(c=>({
      // Solo campos del producto — sin datos del historial que contaminen variables
      id:             c.producto_id,
      codigo:         c.codigo,
      descripcion:    c.descripcion,
      codigo_barras:  c.codigo_barras,
      marca_nombre:   c.marca_nombre,
      categoria_nombre: c.categoria_nombre,
      iva_porcentaje: c.iva_porcentaje||0,
      stock_total:    c.stock_total,
      precio_venta:   Number((c.precios||[])[0]?.precio||0),
      precios:        c.precios||[],
      // Oferta: vacío — esto viene del historial de precios, NO de ofertas
      tiene_oferta:   false,
      precio_oferta:  null,
      fecha_fin_oferta: null,
      fecha_ini_oferta: null,
      desc_oferta:    null,
    }))
    sessionStorage.setItem('nexus_etiqueta_prods', JSON.stringify(prods))
    sessionStorage.setItem('nexus_etiqueta_historial_ids', JSON.stringify(idsHistorial||[]))
    const tipoPrecioId = base[0]?.tipo_precio_id
    if(tipoPrecioId) sessionStorage.setItem('nexus_tipo_precio_sel', String(tipoPrecioId))
    navigate('/etiquetas?from=dashboard')
  }

  const nuevos = cambios.filter(c=>Number(c.precio_nuevo)>Number(c.precio_anterior)).length
  const bajas  = cambios.filter(c=>Number(c.precio_nuevo)<Number(c.precio_anterior)).length

  return(
    <div style={{
      background:C.surface,
      borderRadius:16,
      border:`1px solid ${C.bord2}`,
      overflow:'hidden',
      fontFamily:"'Inter','Segoe UI',system-ui,sans-serif",
    }}>
      {/* Header */}
      <div style={{
        padding:'14px 18px',
        background:'linear-gradient(135deg,rgba(59,130,246,.12),rgba(139,92,246,.08))',
        borderBottom:`1px solid ${C.bord2}`,
        display:'flex',justifyContent:'space-between',alignItems:'center',
        cursor:'pointer',
      }} onClick={()=>setExpanded(p=>!p)}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{
            width:36,height:36,borderRadius:10,
            background:'rgba(245,158,11,.2)',
            display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:18,
          }}>💲</div>
          <div>
            <div style={{fontSize:14,fontWeight:800,color:C.text}}>
              Actualizaciones de Precio
            </div>
            <div style={{fontSize:11,color:C.muted,marginTop:1}}>
              Últimas {horas}h ·{' '}
              {loading?'Cargando...':`${cambios.length} cambio${cambios.length!==1?'s':''}`}
            </div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {/* Badges */}
          {!loading&&cambios.length>0&&<>
            {nuevos>0&&(
              <span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,
                background:C.redD,color:C.red,border:`1px solid rgba(239,68,68,.3)`}}>
                ↑ {nuevos} subidas
              </span>
            )}
            {bajas>0&&(
              <span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,
                background:C.greenD,color:C.green,border:`1px solid rgba(16,185,129,.3)`}}>
                ↓ {bajas} bajas
              </span>
            )}
          </>}
          <span style={{color:C.hint,fontSize:16}}>{expanded?'▲':'▼'}</span>
        </div>
      </div>

      {expanded&&(
        <div>
          {/* Toolbar */}
          <div style={{
            padding:'8px 16px',
            borderBottom:`1px solid ${C.border}`,
            display:'flex',gap:8,alignItems:'center',
            background:C.sur2,flexWrap:'wrap',
          }}>
            {/* Filtro de período */}
            <div style={{display:'flex',borderRadius:7,overflow:'hidden',
              border:`1px solid ${C.bord2}`}}>
              {[[24,'24h'],[72,'3 días'],[168,'7 días']].map(([h,l])=>(
                <button key={h} onClick={()=>setHoras(h)}
                  style={{padding:'4px 10px',border:'none',cursor:'pointer',
                    fontSize:11,fontWeight:horas===h?700:400,
                    background:horas===h?C.blue:C.sur2,
                    color:horas===h?'white':C.hint}}>
                  {l}
                </button>
              ))}
            </div>
            <button onClick={cargar}
              style={{padding:'4px 10px',borderRadius:7,cursor:'pointer',
                border:`1px solid ${C.bord2}`,background:'transparent',
                color:C.hint,fontSize:11}}>
              ↻ Actualizar
            </button>
            {cambios.length>0&&<>
              <button onClick={selTodos}
                style={{padding:'4px 10px',borderRadius:7,cursor:'pointer',
                  border:`1px solid ${C.bord2}`,background:'transparent',
                  color:C.muted,fontSize:11,fontWeight:600}}>
                {selImp.length===cambios.length?'Deselec.':'Selec. todos'}
              </button>
              <button onClick={marcarTodos}
                style={{padding:'4px 10px',borderRadius:7,cursor:'pointer',
                  border:`1px solid ${C.bord2}`,background:'transparent',
                  color:C.hint,fontSize:11}}>
                ✅ Todo impreso
              </button>
              {selImp.length>0&&<>
                <button onClick={()=>{
                    const ids = cambios.filter(c=>selImp.includes(c.producto_id)).map(c=>c.id)
                    irAImprimir(ids)
                  }}
                  style={{padding:'5px 12px',borderRadius:7,border:'none',
                    background:C.amber,color:'#000',cursor:'pointer',
                    fontSize:11,fontWeight:800,display:'flex',alignItems:'center',gap:4}}>
                  🖨 Imprimir ({selImp.length})
                </button>
                <button onClick={()=>{
                    const ids = cambios.filter(c=>selImp.includes(c.producto_id)).map(c=>c.id)
                    marcarImpreso(ids)
                  }}
                  style={{padding:'5px 12px',borderRadius:7,border:'none',
                    background:C.greenD,color:C.green,cursor:'pointer',
                    border:`1px solid rgba(16,185,129,.3)`,
                    fontSize:11,fontWeight:700}}>
                  ✅ Marcar impreso
                </button>
              </>}
            </>}
          </div>

          {/* Lista de cambios */}
          <div style={{maxHeight:420,overflowY:'auto'}}>
            {loading&&(
              <div style={{padding:24,textAlign:'center',color:C.hint,fontSize:13}}>
                Cargando cambios...
              </div>
            )}
            {!loading&&cambios.length===0&&(
              <div style={{padding:32,textAlign:'center'}}>
                <div style={{fontSize:28,marginBottom:8}}>✅</div>
                <div style={{color:C.muted,fontSize:13}}>
                  Sin cambios de precio en las últimas {horas}h
                </div>
              </div>
            )}
            {!loading&&cambios.map((c,i)=>{
              const subio   = Number(c.precio_nuevo) > Number(c.precio_anterior)
              const igual   = Number(c.precio_nuevo) === Number(c.precio_anterior)
              const varPct  = Number(c.variacion_pct||0)
              const isSel   = selImp.includes(c.producto_id)
              const hasStock= Number(c.stock_total||0)>0

              return(
                <div key={c.id}
                  onClick={()=>toggleSel(c.producto_id)}
                  style={{
                    padding:'11px 16px',
                    borderBottom:`1px solid ${C.border}`,
                    cursor:'pointer',
                    background: isSel
                      ? 'rgba(245,158,11,.08)'
                      : i%2===0?'transparent':C.sur2,
                    transition:'background .15s',
                    display:'flex',alignItems:'center',gap:12,
                  }}
                  onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background=C.sur2}}
                  onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background=i%2===0?'transparent':C.sur2}}>

                  {/* Checkbox visual */}
                  <div style={{
                    width:18,height:18,borderRadius:5,flexShrink:0,
                    border:`2px solid ${isSel?C.amber:C.bord2}`,
                    background:isSel?C.amber:'transparent',
                    display:'flex',alignItems:'center',justifyContent:'center',
                  }}>
                    {isSel&&<span style={{fontSize:11,color:'#000',fontWeight:900}}>✓</span>}
                  </div>

                  {/* Flecha subida/bajada */}
                  <div style={{
                    width:32,height:32,borderRadius:8,flexShrink:0,
                    background: subio?C.redD: igual?C.sur3:C.greenD,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:16,
                  }}>
                    {subio?'↑': igual?'=':'↓'}
                  </div>

                  {/* Info producto */}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                      <span style={{fontSize:13,fontWeight:700,color:C.text,
                        overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
                        maxWidth:200}}>
                        {c.descripcion}
                      </span>
                      <code style={{fontSize:10,color:C.purple,flexShrink:0}}>
                        {c.codigo}
                      </code>
                      <span style={{fontSize:10,padding:'1px 6px',borderRadius:10,
                        background:C.sur3,color:C.hint,flexShrink:0}}>
                        {c.tipo_precio_nombre}
                      </span>
                      {!hasStock&&(
                        <span style={{fontSize:9,padding:'1px 5px',borderRadius:10,
                          background:C.amberD,color:C.amber,flexShrink:0}}>
                          Sin stock
                        </span>
                      )}
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginTop:4}}>
                      {/* Precio anterior */}
                      <span style={{fontSize:12,color:C.hint,textDecoration:'line-through'}}>
                        {fmt$(c.precio_anterior_pvp||c.precio_anterior)}
                        <span style={{fontSize:9,color:C.hint,marginLeft:2}}>c/IVA</span>
                      </span>
                      <span style={{color:C.hint,fontSize:12}}>→</span>
                      {/* Precio nuevo */}
                      <span style={{fontSize:14,fontWeight:800,
                        color:subio?C.red: igual?C.muted:C.green}}>
                        {fmt$(c.precio_nuevo_pvp||c.precio_nuevo)}
                      </span>
                      {/* Variación */}
                      {!igual&&(
                        <span style={{fontSize:11,fontWeight:700,
                          padding:'1px 7px',borderRadius:10,
                          background:subio?C.redD:C.greenD,
                          color:subio?C.red:C.green}}>
                          {varPct>0?'+':''}{varPct}%
                        </span>
                      )}
                      <span style={{fontSize:10,color:C.hint,marginLeft:'auto'}}>
                        {fmtHora(c.created_at)}
                        {c.usuario_nombre&&` · ${c.usuario_nombre}`}
                      </span>
                    </div>
                  </div>

                  {/* Botón imprimir individual */}
                  <div style={{display:'flex',gap:4,flexShrink:0}}>
                    <button
                      onClick={e=>{
                        e.stopPropagation()
                        const prod = {
                          id:              c.producto_id,
                          codigo:          c.codigo,
                          descripcion:     c.descripcion,
                          codigo_barras:   c.codigo_barras,
                          marca_nombre:    c.marca_nombre,
                          categoria_nombre:c.categoria_nombre,
                          iva_porcentaje:  c.iva_porcentaje||0,
                          stock_total:     c.stock_total,
                          precio_venta:    Number((c.precios||[])[0]?.precio||0),
                          precios:         c.precios||[],
                          tiene_oferta:    false,
                          precio_oferta:   null,
                          fecha_fin_oferta:null,
                          fecha_ini_oferta:null,
                          desc_oferta:     null,
                        }
                        sessionStorage.setItem('nexus_etiqueta_prods', JSON.stringify([prod]))
                        sessionStorage.setItem('nexus_etiqueta_historial_ids', JSON.stringify([c.id]))
                        if(c.tipo_precio_id) sessionStorage.setItem('nexus_tipo_precio_sel', String(c.tipo_precio_id))
                        navigate('/etiquetas?from=dashboard')
                      }}
                      title="Ir a imprimir etiqueta"
                      style={{padding:'5px 9px',borderRadius:7,cursor:'pointer',
                        border:`1px solid ${C.amber}44`,background:'rgba(245,158,11,.1)',
                        color:C.amber,fontSize:12,fontWeight:700}}
                      onMouseEnter={e=>{e.currentTarget.style.background='rgba(245,158,11,.25)'}}
                      onMouseLeave={e=>{e.currentTarget.style.background='rgba(245,158,11,.1)'}}>
                      🏷
                    </button>
                    <button
                      onClick={e=>{e.stopPropagation();marcarImpreso([c.id])}}
                      title="Marcar como impreso"
                      style={{padding:'5px 9px',borderRadius:7,cursor:'pointer',
                        border:`1px solid rgba(16,185,129,.3)`,background:C.greenD,
                        color:C.green,fontSize:11,fontWeight:700}}
                      onMouseEnter={e=>{e.currentTarget.style.opacity='.7'}}
                      onMouseLeave={e=>{e.currentTarget.style.opacity='1'}}>
                      ✅
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          {!loading&&cambios.length>0&&(
            <div style={{
              padding:'8px 16px',
              borderTop:`1px solid ${C.border}`,
              display:'flex',justifyContent:'space-between',alignItems:'center',
              background:C.sur2,
            }}>
              <span style={{fontSize:11,color:C.hint}}>
                {selImp.length>0
                  ? `${selImp.length} selec. — Imprimir 🏷 o marcar impreso ✅`
                  : 'Clic en un producto para seleccionar · ✅ para marcar impreso sin imprimir'}
              </span>
              {selImp.length>0&&(
                <div style={{display:'flex',gap:6}}>
                  <button onClick={()=>{
                      const ids=cambios.filter(x=>selImp.includes(x.producto_id)).map(x=>x.id)
                      marcarImpreso(ids)
                    }}
                    style={{padding:'6px 12px',borderRadius:8,cursor:'pointer',
                      border:`1px solid rgba(16,185,129,.3)`,background:C.greenD,
                      color:C.green,fontSize:12,fontWeight:700}}>
                    ✅ Marcar impreso
                  </button>
                  <button onClick={()=>{
                      const ids=cambios.filter(x=>selImp.includes(x.producto_id)).map(x=>x.id)
                      irAImprimir(ids)
                    }}
                    style={{padding:'6px 14px',borderRadius:8,border:'none',
                      background:C.amber,color:'#000',cursor:'pointer',
                      fontSize:12,fontWeight:800}}>
                    🖨 Imprimir {selImp.length}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}