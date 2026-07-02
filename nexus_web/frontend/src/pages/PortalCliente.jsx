// ============================================================
//  NEXUS POS — Portal del Cliente (acceso por token en URL)
//  Ruta: /portal-cliente/:token
// ============================================================
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api'

const fmt$ = v => '$' + Number(v||0).toLocaleString('es-EC',
  { minimumFractionDigits:2, maximumFractionDigits:2 })
const fmtFecha = v => v ? new Date(v+'T00:00:00').toLocaleDateString('es-EC') : '—'

const C = {
  bg:'#0A0F1E', surface:'#111827', sur2:'#1F2937',
  border:'#1F2937', bord2:'#374151',
  text:'#F9FAFB', muted:'#9CA3AF', hint:'#6B7280',
  blue:'#3B82F6', green:'#10B981', amber:'#F59E0B', red:'#EF4444',
}

export default function PortalCliente() {
  const { token } = useParams()
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)
  const [tab, setTab]       = useState('facturas')

  useEffect(() => {
    api.get(`/portal-cliente/datos/${token}`)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.detail || 'Acceso no válido'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return (
    <div style={{background:C.bg,minHeight:'100vh',display:'flex',
      alignItems:'center',justifyContent:'center',color:C.muted,fontFamily:'Inter,system-ui'}}>
      Cargando...
    </div>
  )

  if (error) return (
    <div style={{background:C.bg,minHeight:'100vh',display:'flex',
      alignItems:'center',justifyContent:'center',fontFamily:'Inter,system-ui'}}>
      <div style={{textAlign:'center',color:C.muted}}>
        <div style={{fontSize:48,marginBottom:16}}>🔒</div>
        <div style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:8}}>Acceso no disponible</div>
        <div style={{fontSize:14}}>{error}</div>
      </div>
    </div>
  )

  const { empresa, cliente, resumen, facturas, cxc } = data

  const ESTADO_FAC = {
    EMITIDA:    { color:C.green,  bg:'rgba(16,185,129,.15)',  label:'Emitida'    },
    AUTORIZADA: { color:C.green,  bg:'rgba(16,185,129,.15)',  label:'Autorizada' },
    ANULADA:    { color:C.red,    bg:'rgba(239,68,68,.15)',   label:'Anulada'    },
  }

  const ESTADO_CXC = {
    PENDIENTE: { color:C.amber, bg:'rgba(245,158,11,.15)', label:'Pendiente' },
    PAGADA:    { color:C.green, bg:'rgba(16,185,129,.15)', label:'Pagada'    },
    VENCIDA:   { color:C.red,   bg:'rgba(239,68,68,.15)',  label:'Vencida'   },
  }

  return (
    <div style={{background:C.bg,minHeight:'100vh',fontFamily:"'Inter','Segoe UI',system-ui,sans-serif",color:C.text}}>

      {/* Header */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,
        padding:'16px 24px',display:'flex',justifyContent:'space-between',
        alignItems:'center',flexWrap:'wrap',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          {empresa.logo_url && (
            <img src={empresa.logo_url} alt="Logo"
              style={{height:40,objectFit:'contain',borderRadius:6}}/>
          )}
          <div>
            <div style={{fontWeight:800,fontSize:16,color:C.text}}>{empresa.razon_social}</div>
            <div style={{fontSize:11,color:C.muted}}>📞 {empresa.telefono} · ✉️ {empresa.email}</div>
          </div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontWeight:700,fontSize:14,color:C.text}}>{cliente.razon_social}</div>
          <div style={{fontSize:11,color:C.muted}}>{cliente.identificacion}</div>
        </div>
      </div>

      <div style={{padding:'24px',maxWidth:900,margin:'0 auto'}}>

        {/* KPIs */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:24}}>
          {[
            {icon:'🧾',label:'Total compras',value:fmt$(resumen.total_compras),color:C.blue},
            {icon:'📄',label:'N° facturas',value:resumen.num_facturas,color:C.blue},
            {icon:'📅',label:'Facturas este mes',value:resumen.facturas_mes,color:C.green},
            {icon:'⚠️',label:'Saldo pendiente',value:fmt$(resumen.saldo_pendiente),
             color:resumen.saldo_pendiente>0?C.red:C.green},
          ].map((k,i)=>(
            <div key={i} style={{background:C.surface,borderRadius:12,padding:'16px',
              border:`1px solid ${C.bord2}`,textAlign:'center'}}>
              <div style={{fontSize:24,marginBottom:8}}>{k.icon}</div>
              <div style={{fontSize:20,fontWeight:900,color:k.color}}>{k.value}</div>
              <div style={{fontSize:10,color:C.muted,fontWeight:600,
                textTransform:'uppercase',marginTop:4}}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Alerta saldo vencido */}
        {resumen.saldo_pendiente > 0 && (
          <div style={{padding:'12px 16px',borderRadius:10,marginBottom:20,
            background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.2)',
            color:C.red,fontSize:13,display:'flex',alignItems:'center',gap:10}}>
            ⚠️ Tienes un saldo pendiente de <strong>{fmt$(resumen.saldo_pendiente)}</strong>.
            Por favor comunícate con {empresa.razon_social} para regularizarlo.
          </div>
        )}

        {/* Tabs */}
        <div style={{display:'flex',gap:4,marginBottom:16,borderBottom:`1px solid ${C.border}`}}>
          {[['facturas','🧾 Mis Facturas'],['cuenta','💰 Estado de Cuenta']].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)}
              style={{padding:'10px 20px',border:'none',background:'none',cursor:'pointer',
                fontSize:13,fontWeight:tab===id?700:400,
                color:tab===id?C.blue:C.muted,
                borderBottom:tab===id?`2px solid ${C.blue}`:'2px solid transparent',
                marginBottom:-1}}>
              {label}
            </button>
          ))}
        </div>

        {/* Facturas */}
        {tab === 'facturas' && (
          <div style={{background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,overflow:'hidden'}}>
            {facturas.length === 0 ? (
              <div style={{padding:40,textAlign:'center',color:C.muted}}>
                No tienes facturas registradas
              </div>
            ) : (
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr>
                    {['N° Factura','Fecha','Subtotal','IVA','Total','Forma pago','Estado'].map(h=>(
                      <th key={h} style={{padding:'12px 14px',textAlign:'left',
                        fontSize:10,fontWeight:700,color:C.hint,textTransform:'uppercase',
                        borderBottom:`1px solid ${C.border}`,background:C.sur2}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {facturas.map(f=>{
                    const est = ESTADO_FAC[f.estado] || {color:C.muted,bg:C.sur2,label:f.estado}
                    return (
                      <tr key={f.id} style={{borderBottom:`1px solid ${C.border}`}}>
                        <td style={{padding:'12px 14px',fontWeight:700,color:C.blue}}>
                          {f.numero_factura || `#${f.id}`}
                        </td>
                        <td style={{padding:'12px 14px',color:C.muted}}>{fmtFecha(f.fecha_emision)}</td>
                        <td style={{padding:'12px 14px'}}>{fmt$(f.subtotal_0+f.subtotal_iva)}</td>
                        <td style={{padding:'12px 14px',color:C.muted}}>{fmt$(f.iva)}</td>
                        <td style={{padding:'12px 14px',fontWeight:700,color:C.green}}>{fmt$(f.total)}</td>
                        <td style={{padding:'12px 14px',color:C.muted,fontSize:11}}>
                          {f.forma_pago||'—'}
                        </td>
                        <td style={{padding:'12px 14px'}}>
                          <span style={{padding:'3px 10px',borderRadius:20,fontSize:11,
                            fontWeight:700,background:est.bg,color:est.color}}>
                            {est.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Estado de cuenta */}
        {tab === 'cuenta' && (
          <div style={{background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,overflow:'hidden'}}>
            {cxc.length === 0 ? (
              <div style={{padding:40,textAlign:'center',color:C.muted}}>
                No tienes cuentas por cobrar registradas
              </div>
            ) : (
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr>
                    {['Fecha emisión','Fecha vencimiento','Total','Pagado','Saldo','Estado'].map(h=>(
                      <th key={h} style={{padding:'12px 14px',textAlign:'left',
                        fontSize:10,fontWeight:700,color:C.hint,textTransform:'uppercase',
                        borderBottom:`1px solid ${C.border}`,background:C.sur2}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cxc.map(c=>{
                    const vencida = c.estado==='PENDIENTE' && c.fecha_vencimiento < new Date().toISOString().slice(0,10)
                    const est = vencida ? ESTADO_CXC.VENCIDA : (ESTADO_CXC[c.estado]||{color:C.muted,bg:C.sur2,label:c.estado})
                    return (
                      <tr key={c.id} style={{borderBottom:`1px solid ${C.border}`,
                        background:vencida?'rgba(239,68,68,.04)':'transparent'}}>
                        <td style={{padding:'12px 14px',color:C.muted}}>{fmtFecha(c.fecha_emision)}</td>
                        <td style={{padding:'12px 14px',color:vencida?C.red:C.muted}}>
                          {fmtFecha(c.fecha_vencimiento)}
                        </td>
                        <td style={{padding:'12px 14px'}}>{fmt$(c.valor_total)}</td>
                        <td style={{padding:'12px 14px',color:C.green}}>{fmt$(c.valor_pagado)}</td>
                        <td style={{padding:'12px 14px',fontWeight:700,
                          color:parseFloat(c.saldo)>0?C.red:C.green}}>
                          {fmt$(c.saldo)}
                        </td>
                        <td style={{padding:'12px 14px'}}>
                          <span style={{padding:'3px 10px',borderRadius:20,fontSize:11,
                            fontWeight:700,background:est.bg,color:est.color}}>
                            {est.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        <div style={{marginTop:24,textAlign:'center',fontSize:11,color:C.hint}}>
          Portal de clientes · {empresa.razon_social} · Powered by NEXUS POS
        </div>
      </div>
    </div>
  )
}
