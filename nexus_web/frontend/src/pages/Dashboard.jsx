// ============================================================
//  NEXUS POS — Dashboard (tema oscuro, filtrado por sucursal)
// ============================================================
import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid,
         Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'
import api from '../api'
import WidgetPreciosCambiados from '../components/WidgetPreciosCambiados'
import WidgetOfertas from '../components/WidgetOfertas'
import { useTheme } from '../theme'

const C = {
  bg:'#0A0F1E', surface:'#111827', sur2:'#1F2937', sur3:'#374151',
  bord2:'#374151', border:'#1F2937',
  text:'#F9FAFB', muted:'#9CA3AF', hint:'#6B7280',
  blue:'#3B82F6', green:'#10B981', amber:'#F59E0B',
  red:'#EF4444', purple:'#8B5CF6', cyan:'#06B6D4',
  greenD:'rgba(16,185,129,.15)', amberD:'rgba(245,158,11,.15)',
  redD:'rgba(239,68,68,.15)',   blueD:'rgba(59,130,246,.15)',
}
const fmt$ = v => '$'+Number(v||0).toLocaleString('es-EC',
  {minimumFractionDigits:2,maximumFractionDigits:2})

// ── KPI Card ─────────────────────────────────────────────────
function KpiCard({title, value, subtitle, icon, color, trend}) {
  const C = useTheme()
  const up   = trend > 0
  const zero = trend === 0 || trend == null
  return(
    <div style={{
      background:C.surface, borderRadius:14,
      border:`1px solid ${C.bord2}`, padding:'18px 20px',
      display:'flex', flexDirection:'column', gap:8,
      position:'relative', overflow:'hidden',
    }}>
      {/* Glow de fondo */}
      <div style={{
        position:'absolute', top:-20, right:-20,
        width:80, height:80, borderRadius:'50%',
        background:`${color}22`, filter:'blur(20px)',
        pointerEvents:'none',
      }}/>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div style={{fontSize:28}}>{icon}</div>
        {!zero&&(
          <span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:10,
            background:up?C.greenD:C.redD, color:up?C.green:C.red}}>
            {up?'↑':'↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <div style={{fontSize:24,fontWeight:900,color:C.text,lineHeight:1}}>{value}</div>
        <div style={{fontSize:11,fontWeight:700,color:C.muted,marginTop:4,
          textTransform:'uppercase',letterSpacing:'.05em'}}>{title}</div>
        {subtitle&&<div style={{fontSize:11,color:C.hint,marginTop:2}}>{subtitle}</div>}
      </div>
    </div>
  )
}

// ── Tooltip oscuro para recharts ──────────────────────────────
function DarkTooltip({active, payload, label}) {
  const C = useTheme()
  if(!active||!payload?.length) return null
  return(
    <div style={{background:C.sur2,border:`1px solid ${C.bord2}`,
      borderRadius:8,padding:'8px 12px',fontSize:12}}>
      <div style={{color:C.muted,marginBottom:4}}>{label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{color:p.color,fontWeight:700}}>
          {fmt$(p.value)}
        </div>
      ))}
    </div>
  )
}

// ── Widget Lotes por Vencer ──────────────────────────────────
function WidgetLotesPorVencer() {
  const C = useTheme()
  const [lotes, setLotes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/lotes/por-vencer', { params: { dias: 60 } })
      .then(r => setLotes(r.data || []))
      .catch(() => setLotes([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null
  if (lotes.length === 0) return null

  const vencidos = lotes.filter(l => Number(l.dias_para_vencer) < 0)
  const criticos = lotes.filter(l => { const d = Number(l.dias_para_vencer); return d >= 0 && d <= 30 })
  const alerta = lotes.filter(l => { const d = Number(l.dias_para_vencer); return d > 30 && d <= 60 })

  return (
    <div style={{marginTop:24}}>
      <div style={{background:C.surface, borderRadius:14, padding:'18px 20px',
        border:`1px solid ${C.bord2}`}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
          <div style={{fontSize:14, fontWeight:700, color:C.text}}>
            Lotes por Vencer
          </div>
          <div style={{display:'flex', gap:8}}>
            {vencidos.length > 0 && (
              <span style={{padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
                background:C.redD, color:C.red}}>
                {vencidos.length} vencido{vencidos.length !== 1 ? 's' : ''}
              </span>
            )}
            {criticos.length > 0 && (
              <span style={{padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
                background:C.amberD, color:C.amber}}>
                {criticos.length} critico{criticos.length !== 1 ? 's' : ''}
              </span>
            )}
            {alerta.length > 0 && (
              <span style={{padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
                background:C.greenD, color:C.green}}>
                {alerta.length} por vencer
              </span>
            )}
          </div>
        </div>
        <div style={{display:'flex', flexDirection:'column', gap:8, maxHeight:280, overflowY:'auto'}}>
          {lotes.slice(0, 15).map((l, i) => {
            const dias = Number(l.dias_para_vencer)
            const isVencido = dias < 0
            const isCritico = dias >= 0 && dias <= 30
            const color = isVencido ? C.red : isCritico ? C.amber : C.green
            const bg = isVencido ? C.redD : isCritico ? C.amberD : C.greenD
            return (
              <div key={l.id || i} style={{display:'flex', alignItems:'center', gap:10,
                padding:'8px 10px', borderRadius:8, background:bg,
                border:`1px solid ${color}25`}}>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:12, fontWeight:600, color:C.text,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                    {l.producto}
                  </div>
                  <div style={{fontSize:10, color:C.hint}}>
                    Lote: {l.lote} {l.bodega ? `| ${l.bodega}` : ''} | Cant: {Number(l.cantidad||0).toFixed(0)}
                  </div>
                </div>
                <span style={{padding:'2px 10px', borderRadius:10, fontSize:11,
                  fontWeight:800, flexShrink:0, background:color, color:'#fff'}}>
                  {isVencido ? 'VENCIDO' : `${dias}d`}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  PÁGINA PRINCIPAL
// ════════════════════════════════════════════════════════════
export default function Dashboard() {
  const C = useTheme()
  const user = JSON.parse(localStorage.getItem('nexus_user')||'{}')
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    api.get('/dashboard')
      .then(r=>setData(r.data))
      .catch(()=>setData({}))
      .finally(()=>setLoading(false))
  },[])

  if(loading) return(
    <div style={{background:C.bg,minHeight:'100vh',display:'flex',
      alignItems:'center',justifyContent:'center',
      fontFamily:"'Inter',system-ui,sans-serif",color:C.hint,fontSize:14}}>
      Cargando dashboard...
    </div>
  )

  const {
    ventas_hoy, ventas_mes, clientes, productos,
    stock_bajo, cxc_pendiente,
    ventas_semana=[], top_productos=[],
    sucursal_nombre,
    ventas_por_hora=[], comparativo_mes={},
    rentabilidad=[], alertas_stock=[],
    cotizaciones_pendientes=0,
  } = data||{}

  const COLORS_BAR = ['#3B82F6','#10B981','#8B5CF6','#F59E0B','#EF4444']

  return(
    <div style={{
      background:C.bg, minHeight:'100vh',
      padding:'24px 28px',
      fontFamily:"'Inter','Segoe UI',system-ui,sans-serif",
      color:C.text,
    }}>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',
        alignItems:'flex-start',marginBottom:24}}>
        <div>
          <h1 style={{margin:0,fontSize:26,fontWeight:900,color:C.text}}>
            Dashboard
          </h1>
          <p style={{margin:'4px 0 0',color:C.muted,fontSize:13}}>
            Bienvenido, <strong style={{color:C.text}}>{user.nombre||user.username}</strong>
            {sucursal_nombre&&(
              <span style={{marginLeft:10,padding:'2px 10px',borderRadius:20,
                background:C.greenD,color:C.green,fontSize:12,fontWeight:700,
                border:`1px solid rgba(16,185,129,.25)`}}>
                🏢 {sucursal_nombre}
              </span>
            )}
          </p>
        </div>
        <div style={{fontSize:12,color:C.hint,padding:'6px 12px',
          background:C.surface,borderRadius:8,border:`1px solid ${C.bord2}`}}>
          {new Date().toLocaleDateString('es-EC',
            {weekday:'long',year:'numeric',month:'long',day:'numeric'})}
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',
        gap:14,marginBottom:24}}>
        <KpiCard
          icon="💰" title="Ventas hoy" color={C.blue}
          value={fmt$(ventas_hoy?.total)}
          subtitle={`${ventas_hoy?.facturas||0} factura${ventas_hoy?.facturas!==1?'s':''}`}/>
        <KpiCard
          icon="📅" title="Ventas del mes" color={C.purple}
          value={fmt$(ventas_mes?.total)}
          subtitle={`${ventas_mes?.facturas||0} facturas`}/>
        <KpiCard
          icon="👥" title="Clientes" color={C.green}
          value={clientes||0}
          subtitle="Activos en el sistema"/>
        <KpiCard
          icon="⚠️" title="Stock bajo" color={C.amber}
          value={stock_bajo||0}
          subtitle="Menos de 5 unidades"
          trend={stock_bajo>0?null:0}/>
        <KpiCard
          icon="📋" title="CXC pendiente" color={C.red}
          value={fmt$(cxc_pendiente?.total)}
          subtitle={`${cxc_pendiente?.n||0} cuenta${cxc_pendiente?.n!==1?'s':''}`}/>
      </div>

      {/* Gráficos */}
      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',
        gap:16,marginBottom:24}}>

        {/* Ventas 7 días */}
        <div style={{background:C.surface,borderRadius:14,padding:'18px 20px',
          border:`1px solid ${C.bord2}`}}>
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:16}}>
            📈 Ventas últimos 7 días
            {sucursal_nombre&&(
              <span style={{marginLeft:8,fontSize:11,color:C.hint,fontWeight:400}}>
                · {sucursal_nombre}
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={ventas_semana}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.bord2}/>
              <XAxis dataKey="fecha" tick={{fontSize:10,fill:C.hint}}
                tickFormatter={v=>new Date(v+'T12:00').toLocaleDateString('es',
                  {day:'2-digit',month:'short'})}
                stroke={C.bord2}/>
              <YAxis tick={{fontSize:10,fill:C.hint}}
                tickFormatter={v=>'$'+v} stroke={C.bord2}/>
              <Tooltip content={<DarkTooltip/>}/>
              <Line type="monotone" dataKey="total" stroke={C.blue}
                strokeWidth={2.5} dot={{fill:C.blue,r:4,strokeWidth:0}}
                activeDot={{r:6,fill:C.blue}}/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top productos */}
        <div style={{background:C.surface,borderRadius:14,padding:'18px 20px',
          border:`1px solid ${C.bord2}`}}>
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:16}}>
            🏆 Top 5 productos (30 días)
          </div>
          {top_productos.length===0?(
            <div style={{color:C.hint,fontSize:13,textAlign:'center',padding:'20px 0'}}>
              Sin ventas registradas
            </div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {top_productos.map((p,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{
                    width:26,height:26,borderRadius:7,flexShrink:0,
                    background:`${COLORS_BAR[i]}22`,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:11,fontWeight:800,color:COLORS_BAR[i],
                  }}>{i+1}</div>
                  <div style={{flex:1,fontSize:12,color:C.text,fontWeight:500,
                    overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {p.descripcion?.substring(0,26)}
                  </div>
                  {/* Barra mini */}
                  <div style={{width:60,background:C.sur2,borderRadius:4,height:5}}>
                    <div style={{
                      width:`${Math.round((p.vendidos/top_productos[0].vendidos)*100)}%`,
                      height:5,borderRadius:4,background:COLORS_BAR[i],
                    }}/>
                  </div>
                  <div style={{fontSize:12,fontWeight:700,color:COLORS_BAR[i],
                    width:36,textAlign:'right',flexShrink:0}}>
                    {Number(p.vendidos).toFixed(0)}u
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Widgets de alertas */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginTop:24}}>
        <WidgetPreciosCambiados/>
        <WidgetOfertas/>
      </div>

      {/* Lotes por vencer */}
      <WidgetLotesPorVencer/>

      {/* ── Row: Comparativo Mes + Ventas por Hora ─────────── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:16,marginTop:24}}>

        {/* Card vs Mes Anterior */}
        <div style={{background:C.surface,borderRadius:14,padding:'18px 20px',
          border:`1px solid ${C.bord2}`,display:'flex',flexDirection:'column',gap:14}}>
          <div style={{fontSize:14,fontWeight:700,color:C.text}}>
            📊 vs. Mes Anterior
          </div>
          {(()=>{
            const actual   = Number(comparativo_mes?.mes_actual?.total||0)
            const anterior = Number(comparativo_mes?.mes_anterior?.total||0)
            const pct      = anterior>0 ? (((actual-anterior)/anterior)*100) : (actual>0?100:0)
            const up       = pct >= 0
            return(
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                <div>
                  <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',
                    letterSpacing:'.05em',fontWeight:700}}>Mes actual</div>
                  <div style={{fontSize:22,fontWeight:900,color:C.text}}>{fmt$(actual)}</div>
                  <div style={{fontSize:11,color:C.hint}}>
                    {comparativo_mes?.mes_actual?.facturas||0} facturas
                  </div>
                </div>
                <div>
                  <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',
                    letterSpacing:'.05em',fontWeight:700}}>Mes anterior</div>
                  <div style={{fontSize:18,fontWeight:700,color:C.hint}}>{fmt$(anterior)}</div>
                  <div style={{fontSize:11,color:C.hint}}>
                    {comparativo_mes?.mes_anterior?.facturas||0} facturas
                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:6,
                  padding:'6px 12px',borderRadius:8,
                  background:up?C.greenD:C.redD}}>
                  <span style={{fontSize:18}}>{up?'📈':'📉'}</span>
                  <span style={{fontSize:14,fontWeight:800,
                    color:up?C.green:C.red}}>
                    {up?'+':''}{pct.toFixed(1)}%
                  </span>
                  <span style={{fontSize:11,color:C.muted,marginLeft:4}}>
                    {up?'crecimiento':'descenso'}
                  </span>
                </div>
              </div>
            )
          })()}
        </div>

        {/* Bar chart Ventas por Hora */}
        <div style={{background:C.surface,borderRadius:14,padding:'18px 20px',
          border:`1px solid ${C.bord2}`}}>
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:16}}>
            🕐 Ventas por Hora (Hoy)
          </div>
          {ventas_por_hora.length===0?(
            <div style={{color:C.hint,fontSize:13,textAlign:'center',padding:'40px 0'}}>
              Sin ventas registradas hoy
            </div>
          ):(
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={ventas_por_hora}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.bord2}/>
                <XAxis dataKey="hora" tick={{fontSize:10,fill:C.hint}}
                  tickFormatter={v=>`${String(Math.floor(v)).padStart(2,'0')}:00`}
                  stroke={C.bord2}/>
                <YAxis tick={{fontSize:10,fill:C.hint}}
                  tickFormatter={v=>'$'+v} stroke={C.bord2}/>
                <Tooltip content={<DarkTooltip/>}/>
                <Bar dataKey="total" radius={[4,4,0,0]}>
                  {ventas_por_hora.map((_,i)=>(
                    <Cell key={i} fill={C.cyan}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Row: Rentabilidad + Alertas Stock ──────────────── */}
      <div style={{display:'grid',gridTemplateColumns:'3fr 2fr',gap:16,marginTop:24}}>

        {/* Tabla Rentabilidad */}
        <div style={{background:C.surface,borderRadius:14,padding:'18px 20px',
          border:`1px solid ${C.bord2}`}}>
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:16}}>
            💎 Top 5 Rentabilidad (Mes)
          </div>
          {rentabilidad.length===0?(
            <div style={{color:C.hint,fontSize:13,textAlign:'center',padding:'20px 0'}}>
              Sin datos de rentabilidad
            </div>
          ):(
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${C.bord2}`}}>
                    {['Producto','Vendidos','Ingreso','Costo','Utilidad','Margen'].map(h=>(
                      <th key={h} style={{padding:'6px 8px',textAlign:h==='Producto'?'left':'right',
                        color:C.muted,fontWeight:700,fontSize:10,textTransform:'uppercase',
                        letterSpacing:'.05em'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rentabilidad.map((r,i)=>{
                    const ingreso = Number(r.ingreso||0)
                    const costo   = Number(r.costo_total||0)
                    const util    = Number(r.utilidad||0)
                    const margen  = ingreso>0?((util/ingreso)*100):0
                    return(
                      <tr key={i} style={{borderBottom:`1px solid ${C.sur2}`}}>
                        <td style={{padding:'8px',color:C.text,fontWeight:500,
                          maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',
                          whiteSpace:'nowrap'}}>
                          {r.descripcion?.substring(0,30)}
                        </td>
                        <td style={{padding:'8px',textAlign:'right',color:C.muted}}>
                          {Number(r.vendidos||0).toFixed(0)}
                        </td>
                        <td style={{padding:'8px',textAlign:'right',color:C.text,fontWeight:600}}>
                          {fmt$(ingreso)}
                        </td>
                        <td style={{padding:'8px',textAlign:'right',color:C.hint}}>
                          {fmt$(costo)}
                        </td>
                        <td style={{padding:'8px',textAlign:'right',color:C.green,fontWeight:700}}>
                          {fmt$(util)}
                        </td>
                        <td style={{padding:'8px',textAlign:'right'}}>
                          <span style={{padding:'2px 8px',borderRadius:10,fontSize:11,
                            fontWeight:700,
                            background:margen>=30?C.greenD:margen>=15?C.amberD:C.redD,
                            color:margen>=30?C.green:margen>=15?C.amber:C.red}}>
                            {margen.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Alertas Stock Bajo */}
        <div style={{background:C.surface,borderRadius:14,padding:'18px 20px',
          border:`1px solid ${C.bord2}`}}>
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:16}}>
            🔴 Alertas Stock Bajo
          </div>
          {alertas_stock.length===0?(
            <div style={{color:C.green,fontSize:13,textAlign:'center',padding:'20px 0'}}>
              Todo el stock dentro de niveles normales
            </div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {alertas_stock.map((a,i)=>{
                const qty = Number(a.cantidad||0)
                const min = Number(a.cantidad_minima||1)
                const isZero = qty <= 0
                return(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:10,
                    padding:'8px 10px',borderRadius:8,
                    background:isZero?C.redD:C.amberD,
                    border:`1px solid ${isZero?'rgba(239,68,68,.25)':'rgba(245,158,11,.25)'}`}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:600,color:C.text,
                        overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {a.descripcion?.substring(0,28)}
                      </div>
                      <div style={{fontSize:10,color:C.hint}}>
                        {a.codigo} · {a.bodega}
                      </div>
                    </div>
                    <span style={{padding:'2px 10px',borderRadius:10,fontSize:11,
                      fontWeight:800,flexShrink:0,
                      background:isZero?C.red:C.amber,
                      color:isZero?'#fff':'#000'}}>
                      {qty} / {min}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Row: Cotizaciones Pendientes ──────────────────── */}
      {cotizaciones_pendientes > 0 && (
        <div style={{marginTop:24}}>
          <a href="/cotizaciones" style={{textDecoration:'none',display:'block'}}>
            <div style={{background:C.surface,borderRadius:14,padding:'16px 20px',
              border:`1px solid ${C.bord2}`,display:'flex',alignItems:'center',gap:14,
              cursor:'pointer',transition:'border-color .2s'}}>
              <div style={{width:42,height:42,borderRadius:10,
                background:C.blueD,display:'flex',alignItems:'center',
                justifyContent:'center',fontSize:20}}>
                📝
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:15,fontWeight:700,color:C.text}}>
                  {cotizaciones_pendientes} cotizacion{cotizaciones_pendientes!==1?'es':''} pendiente{cotizaciones_pendientes!==1?'s':''}
                </div>
                <div style={{fontSize:11,color:C.hint}}>
                  Borrador o enviadas sin convertir a factura
                </div>
              </div>
              <div style={{fontSize:20,color:C.blue}}>→</div>
            </div>
          </a>
        </div>
      )}

    </div>
  )
}