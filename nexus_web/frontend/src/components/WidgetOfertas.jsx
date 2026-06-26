// ============================================================
//  NEXUS POS — Widget: Ofertas Próximas / Activas
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
const fmtDate = d => d ? new Date(d+'T12:00').toLocaleDateString('es-EC',
  {day:'2-digit',month:'short'}) : ''

export default function WidgetOfertas() {
  const C = useTheme()
  const navigate   = useNavigate()
  const [ofertas,  setOfertas]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [dias,     setDias]     = useState(2)
  const [selIds,   setSelIds]   = useState([])
  const [expanded, setExpanded] = useState(true)
  const [verImpr,  setVerImpr]  = useState(false) // ver ya impresas

  const cargar = useCallback(async()=>{
    setLoading(true)
    try{
      const{data}=await api.get('/ofertas/proximas-etiqueta',
        {params:{dias_anticipacion:dias}})
      setOfertas(data)
    }catch{}finally{setLoading(false)}
  },[dias])

  useEffect(()=>{cargar()},[cargar])

  const ofertasFilt = verImpr
    ? ofertas
    : ofertas.filter(o=>!o.etiqueta_impresa)

  const activas  = ofertas.filter(o=>o.estado_oferta==='ACTIVA'&&!o.etiqueta_impresa).length
  const proximas = ofertas.filter(o=>o.estado_oferta==='PROXIMA'&&!o.etiqueta_impresa).length

  function toggleSel(id) {
    setSelIds(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id])
  }
  function selTodos() {
    const ids = ofertasFilt.filter(o=>!o.etiqueta_impresa).map(o=>o.id)
    setSelIds(selIds.length===ids.length?[]:ids)
  }

  async function marcarImpresas(ids) {
    try{
      await api.post('/ofertas/marcar-impresas', {ids})
      setOfertas(p=>p.map(o=>ids.includes(o.id)
        ? {...o,etiqueta_impresa:true,etiqueta_impresa_at:new Date().toISOString()}
        : o))
      setSelIds([])
    }catch(e){alert('Error: '+e.message)}
  }

  async function desmarcar(id, e) {
    e.stopPropagation()
    try{
      await api.post(`/ofertas/${id}/desmarcar-impresa`)
      setOfertas(p=>p.map(o=>o.id===id
        ? {...o,etiqueta_impresa:false,etiqueta_impresa_at:null} : o))
    }catch{}
  }

  function irAImprimir(ofertasSelec) {
    const prods = ofertasSelec.map(o=>({
      // Campos del producto — explícitos para no contaminar
      id:               o.producto_id,
      codigo:           o.codigo,
      descripcion:      o.descripcion,
      codigo_barras:    o.codigo_barras,
      marca_nombre:     o.marca_nombre,
      categoria_nombre: o.categoria_nombre,
      iva_porcentaje:   o.iva_porcentaje||0,
      stock_total:      o.stock_total,
      // Precios NORMALES — sin mezclar con precio de oferta
      precio_venta:     Number((o.precios||[])[0]?.precio||0),
      precios:          o.precios||[],
      // Oferta — campos separados y explícitos
      tiene_oferta:     true,
      precio_oferta:    o.precio_oferta,
      fecha_fin_oferta: o.fecha_fin,
      fecha_ini_oferta: o.fecha_inicio,
      desc_oferta:      o.descripcion_oferta||o.desc_oferta||'',
      _es_oferta:       true,
      _oferta_id:       o.id,
    }))
    sessionStorage.setItem('nexus_etiqueta_prods', JSON.stringify(prods))
    sessionStorage.setItem('nexus_oferta_ids', JSON.stringify(ofertasSelec.map(o=>o.id)))
    navigate('/etiquetas?from=oferta')
  }

  if(ofertas.length===0&&!loading&&ofertasFilt.length===0&&!verImpr) return(
    <div style={{background:C.surface,borderRadius:16,border:`1px solid ${C.bord2}`,
      padding:'18px 20px',display:'flex',alignItems:'center',gap:12}}>
      <span style={{fontSize:24}}>🏷</span>
      <div>
        <div style={{fontSize:14,fontWeight:700,color:C.text}}>Ofertas</div>
        <div style={{fontSize:12,color:C.hint,marginTop:2}}>
          Sin ofertas próximas ni activas para los próximos {dias} días
        </div>
      </div>
      <button onClick={()=>setDias(7)}
        style={{marginLeft:'auto',padding:'5px 12px',borderRadius:7,cursor:'pointer',
          border:`1px solid ${C.bord2}`,background:'transparent',
          color:C.hint,fontSize:11}}>
        Ver 7 días
      </button>
    </div>
  )

  return(
    <div style={{background:C.surface,borderRadius:16,
      border:`1px solid ${C.bord2}`,overflow:'hidden',
      fontFamily:"'Inter','Segoe UI',system-ui,sans-serif"}}>

      {/* Header */}
      <div style={{padding:'14px 18px',
        background:'linear-gradient(135deg,rgba(245,158,11,.12),rgba(239,68,68,.08))',
        borderBottom:`1px solid ${C.bord2}`,
        display:'flex',justifyContent:'space-between',alignItems:'center',
        cursor:'pointer'}}
        onClick={()=>setExpanded(p=>!p)}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:36,height:36,borderRadius:10,
            background:'rgba(245,158,11,.2)',
            display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>
            🏷
          </div>
          <div>
            <div style={{fontSize:14,fontWeight:800,color:C.text}}>
              Ofertas — Etiquetas pendientes
            </div>
            <div style={{fontSize:11,color:C.muted,marginTop:1}}>
              {loading?'Cargando...':`Próximos ${dias} días`}
            </div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {activas>0&&(
            <span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,
              background:C.greenD,color:C.green,border:`1px solid rgba(16,185,129,.3)`}}>
              ✨ {activas} activa{activas!==1?'s':''}
            </span>
          )}
          {proximas>0&&(
            <span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,
              background:C.amberD,color:C.amber,border:`1px solid rgba(245,158,11,.3)`}}>
              ⏳ {proximas} próxima{proximas!==1?'s':''}
            </span>
          )}
          <span style={{color:C.hint,fontSize:16}}>{expanded?'▲':'▼'}</span>
        </div>
      </div>

      {expanded&&(
        <div>
          {/* Toolbar */}
          <div style={{padding:'8px 16px',borderBottom:`1px solid ${C.border}`,
            background:C.sur2,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            {/* Días anticipación */}
            <div style={{display:'flex',borderRadius:7,overflow:'hidden',
              border:`1px solid ${C.bord2}`}}>
              {[[1,'1d'],[2,'2d'],[5,'5d'],[7,'7d']].map(([d,l])=>(
                <button key={d} onClick={()=>setDias(d)}
                  style={{padding:'4px 10px',border:'none',cursor:'pointer',
                    fontSize:11,fontWeight:dias===d?700:400,
                    background:dias===d?C.amber:'transparent',
                    color:dias===d?'#000':C.hint}}>
                  {l}
                </button>
              ))}
            </div>
            <button onClick={cargar}
              style={{padding:'4px 10px',borderRadius:7,cursor:'pointer',
                border:`1px solid ${C.bord2}`,background:'transparent',
                color:C.hint,fontSize:11}}>
              ↻
            </button>
            <button onClick={()=>setVerImpr(p=>!p)}
              style={{padding:'4px 10px',borderRadius:7,cursor:'pointer',
                border:`1px solid ${verImpr?C.green:C.bord2}`,
                background:verImpr?C.greenD:'transparent',
                color:verImpr?C.green:C.hint,fontSize:11}}>
              {verImpr?'✅ Mostrando impresas':'Ver impresas'}
            </button>
            {ofertasFilt.filter(o=>!o.etiqueta_impresa).length>0&&<>
              <button onClick={selTodos}
                style={{padding:'4px 10px',borderRadius:7,cursor:'pointer',
                  border:`1px solid ${C.bord2}`,background:'transparent',
                  color:C.muted,fontSize:11,fontWeight:600}}>
                {selIds.length?'Deselec.':'Selec. todos'}
              </button>
              {selIds.length>0&&<>
                <button onClick={()=>irAImprimir(ofertas.filter(o=>selIds.includes(o.id)))}
                  style={{padding:'5px 12px',borderRadius:7,border:'none',
                    background:C.amber,color:'#000',cursor:'pointer',
                    fontSize:11,fontWeight:800}}>
                  🖨 Imprimir ({selIds.length})
                </button>
                <button onClick={()=>marcarImpresas(selIds)}
                  style={{padding:'5px 12px',borderRadius:7,cursor:'pointer',
                    border:`1px solid rgba(16,185,129,.3)`,background:C.greenD,
                    color:C.green,fontSize:11,fontWeight:700}}>
                  ✅ Marcar impreso
                </button>
              </>}
            </>}
          </div>

          {/* Lista */}
          <div style={{maxHeight:380,overflowY:'auto'}}>
            {loading&&<div style={{padding:20,textAlign:'center',color:C.hint,fontSize:13}}>Cargando...</div>}
            {!loading&&ofertasFilt.length===0&&(
              <div style={{padding:28,textAlign:'center'}}>
                <div style={{fontSize:24,marginBottom:8}}>
                  {verImpr?'📭':'✅'}
                </div>
                <div style={{color:C.muted,fontSize:13}}>
                  {verImpr?'Sin ofertas impresas':'Todas las etiquetas de oferta ya están impresas'}
                </div>
              </div>
            )}
            {!loading&&ofertasFilt.map((o,i)=>{
              const isSel   = selIds.includes(o.id)
              const activa  = o.estado_oferta==='ACTIVA'
              const proxima = o.estado_oferta==='PROXIMA'
              const impresa = o.etiqueta_impresa
              const diasRest = Number(o.dias_para_inicio||0)

              return(
                <div key={o.id}
                  onClick={()=>!impresa&&toggleSel(o.id)}
                  style={{
                    padding:'11px 16px',
                    borderBottom:`1px solid ${C.border}`,
                    cursor:impresa?'default':'pointer',
                    background: impresa?'rgba(16,185,129,.03)':
                      isSel?'rgba(245,158,11,.08)':
                      i%2===0?'transparent':C.sur2,
                    opacity:impresa?.6:1,
                    display:'flex',alignItems:'center',gap:12,
                  }}
                  onMouseEnter={e=>{ if(!impresa&&!isSel) e.currentTarget.style.background=C.sur2 }}
                  onMouseLeave={e=>{ if(!impresa&&!isSel) e.currentTarget.style.background=i%2===0?'transparent':C.sur2 }}>

                  {/* Checkbox */}
                  {!impresa&&(
                    <div style={{width:18,height:18,borderRadius:5,flexShrink:0,
                      border:`2px solid ${isSel?C.amber:C.bord2}`,
                      background:isSel?C.amber:'transparent',
                      display:'flex',alignItems:'center',justifyContent:'center'}}>
                      {isSel&&<span style={{fontSize:11,color:'#000',fontWeight:900}}>✓</span>}
                    </div>
                  )}
                  {impresa&&<span style={{fontSize:16,flexShrink:0}}>✅</span>}

                  {/* Badge estado */}
                  <div style={{
                    width:56,height:36,borderRadius:8,flexShrink:0,
                    background: activa?'rgba(16,185,129,.15)':
                      proxima?'rgba(245,158,11,.15)':'rgba(107,114,128,.15)',
                    display:'flex',flexDirection:'column',
                    alignItems:'center',justifyContent:'center',
                  }}>
                    <div style={{fontSize:activa?11:14,fontWeight:800,
                      color:activa?C.green:proxima?C.amber:C.hint}}>
                      {activa?'ACTIVA':proxima?`${diasRest}d`:'—'}
                    </div>
                    {proxima&&<div style={{fontSize:8,color:C.hint}}>para inicio</div>}
                  </div>

                  {/* Info */}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                      <span style={{fontSize:13,fontWeight:700,color:C.text,
                        overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:180}}>
                        {o.descripcion}
                      </span>
                      <code style={{fontSize:10,color:C.purple,flexShrink:0}}>{o.codigo}</code>
                      <span style={{fontSize:10,padding:'1px 5px',borderRadius:8,
                        background:C.sur3,color:C.hint,flexShrink:0}}>
                        {o.tipo_precio_nombre}
                      </span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginTop:3}}>
                      <span style={{fontSize:14,fontWeight:900,color:C.amber}}>
                        {fmt$(o.precio_oferta)}
                      </span>
                      <span style={{fontSize:11,color:C.hint}}>
                        {fmtDate(o.fecha_inicio)} → {fmtDate(o.fecha_fin)}
                      </span>
                      {o.descripcion_oferta&&(
                        <span style={{fontSize:10,color:C.hint,fontStyle:'italic'}}>
                          "{o.descripcion_oferta}"
                        </span>
                      )}
                      {Number(o.stock_total||0)===0&&(
                        <span style={{fontSize:9,padding:'1px 5px',borderRadius:8,
                          background:C.amberD,color:C.amber}}>Sin stock</span>
                      )}
                    </div>
                    {impresa&&o.etiqueta_impresa_at&&(
                      <div style={{fontSize:9,color:C.green,marginTop:2}}>
                        Impresa: {new Date(o.etiqueta_impresa_at).toLocaleString('es-EC',
                          {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
                      </div>
                    )}
                  </div>

                  {/* Botones */}
                  <div style={{display:'flex',gap:4,flexShrink:0}}>
                    {!impresa&&(
                      <button
                        onClick={e=>{e.stopPropagation();irAImprimir([o])}}
                        title="Imprimir etiqueta de oferta"
                        style={{padding:'5px 9px',borderRadius:7,cursor:'pointer',
                          border:`1px solid ${C.amber}44`,background:'rgba(245,158,11,.1)',
                          color:C.amber,fontSize:12,fontWeight:700}}
                        onMouseEnter={e=>e.currentTarget.style.background='rgba(245,158,11,.25)'}
                        onMouseLeave={e=>e.currentTarget.style.background='rgba(245,158,11,.1)'}>
                        🏷
                      </button>
                    )}
                    {!impresa&&(
                      <button
                        onClick={e=>{e.stopPropagation();marcarImpresas([o.id])}}
                        title="Marcar como impresa"
                        style={{padding:'5px 9px',borderRadius:7,cursor:'pointer',
                          border:`1px solid rgba(16,185,129,.3)`,background:C.greenD,
                          color:C.green,fontSize:11,fontWeight:700}}
                        onMouseEnter={e=>e.currentTarget.style.opacity='.7'}
                        onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
                        ✅
                      </button>
                    )}
                    {impresa&&(
                      <button
                        onClick={e=>desmarcar(o.id,e)}
                        title="Desmarcar (me equivoqué)"
                        style={{padding:'4px 8px',borderRadius:7,cursor:'pointer',
                          border:`1px solid ${C.bord2}`,background:'transparent',
                          color:C.hint,fontSize:10}}
                        onMouseEnter={e=>e.currentTarget.style.color=C.red}
                        onMouseLeave={e=>e.currentTarget.style.color=C.hint}>
                        ↩
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}