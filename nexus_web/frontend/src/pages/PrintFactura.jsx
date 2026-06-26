// ============================================================
//  NEXUS POS — Factura imprimible con logo
//  Archivo: frontend/src/pages/PrintFactura.jsx
// ============================================================
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api'

const fmt$ = v => '$' + Number(v||0).toLocaleString('es-EC',
  { minimumFractionDigits:2, maximumFractionDigits:2 })

export default function PrintFactura() {
  const { id }      = useParams()
  const [f, setF]   = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.get(`/facturas/${id}/detalle`)
      .then(r => {
        setF(r.data)
        setTimeout(() => window.print(), 900)
      })
      .catch(() => setError('No se pudo cargar la factura'))
  }, [id])

  if (err) return (
    <div style={{padding:40,textAlign:'center',fontFamily:'Arial,sans-serif'}}>
      <p style={{color:'red',marginBottom:12}}>{err}</p>
      <button onClick={()=>window.close()}
        style={{padding:'8px 20px',cursor:'pointer'}}>Cerrar</button>
    </div>
  )
  if (!f) return (
    <div style={{padding:40,textAlign:'center',fontFamily:'Arial,sans-serif',color:'#374151'}}>
      Cargando factura...
    </div>
  )

  const tieneDescuento = Number(f.descuento_global_pct||0) > 0
  const descMonto = tieneDescuento
    ? (Number(f.subtotal_0)+Number(f.subtotal_iva)) * Number(f.descuento_global_pct) / 100
    : 0

  return (
    <>
      <style>{`
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#000;background:#fff}
        @page{size:A4;margin:10mm 14mm}
        @media print{
          .no-print{display:none!important}
          body{font-size:10px}
          .factura-wrap{padding:0!important}
        }
        table{width:100%;border-collapse:collapse}
        .th{background:#1E293B;color:#fff;padding:6px 7px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
        .td{padding:5px 7px;border-bottom:1px solid #E5E7EB;vertical-align:middle}
        .td-r{text-align:right}
        .td-c{text-align:center}
        .box{border:1.5px solid #1E293B}
        .divider-v{width:1px;background:#1E293B}
        .divider-h{border-top:1px solid #1E293B}
        .label{font-size:9px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.05em}
        .value{font-size:11px;color:#111827}
        .total-row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #E5E7EB;font-size:11px}
      `}</style>

      {/* Controles pantalla */}
      <div className="no-print" style={{position:'fixed',top:10,right:10,
        display:'flex',gap:8,zIndex:999}}>
        <button onClick={()=>window.print()}
          style={{padding:'8px 18px',background:'#2563EB',color:'white',
            border:'none',borderRadius:7,cursor:'pointer',fontSize:13,fontWeight:700}}>
          🖨️ Imprimir
        </button>
        <button onClick={()=>window.close()}
          style={{padding:'8px 14px',background:'#6B7280',color:'white',
            border:'none',borderRadius:7,cursor:'pointer',fontSize:13}}>
          ✕ Cerrar
        </button>
      </div>

      <div className="factura-wrap" style={{maxWidth:780,margin:'0 auto',padding:'20px 0'}}>

        {/* ── CABECERA ── */}
        <div className="box" style={{marginBottom:0}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1.5px 210px'}}>

            {/* Logo + datos empresa */}
            <div style={{padding:'12px 14px',display:'flex',gap:14,alignItems:'flex-start'}}>
              {f.logo_base64 ? (
                <img src={f.logo_base64} alt="Logo"
                  style={{width:80,height:80,objectFit:'contain',flexShrink:0,
                    borderRadius:4,border:'1px solid #E5E7EB'}}/>
              ) : (
                <div style={{width:80,height:80,background:'#F1F5F9',
                  borderRadius:4,border:'1px solid #E5E7EB',flexShrink:0,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:9,color:'#94A3B8',textAlign:'center',lineHeight:1.4}}>
                  SIN<br/>LOGO
                </div>
              )}
              <div>
                <div style={{fontSize:14,fontWeight:900,color:'#0F172A',marginBottom:5,lineHeight:1.2}}>
                  {f.empresa_nombre || 'NEXUS POS'}
                </div>
                {f.empresa_ruc&&<div style={{fontSize:10,color:'#374151',marginBottom:2}}>
                  <strong>RUC:</strong> {f.empresa_ruc}
                </div>}
                {f.empresa_dir&&<div style={{fontSize:10,color:'#374151',marginBottom:2}}>
                  <strong>Dir:</strong> {f.empresa_dir}
                </div>}
                {f.empresa_tel&&<div style={{fontSize:10,color:'#374151',marginBottom:2}}>
                  <strong>Tel:</strong> {f.empresa_tel}
                </div>}
                {f.sucursal_nombre&&<div style={{fontSize:10,color:'#374151'}}>
                  <strong>Sucursal:</strong> {f.sucursal_nombre}
                </div>}
              </div>
            </div>

            <div className="divider-v"/>

            {/* N° Factura */}
            <div style={{padding:'14px',display:'flex',flexDirection:'column',
              alignItems:'center',justifyContent:'center',textAlign:'center',gap:6}}>
              <div style={{fontSize:9,fontWeight:700,color:'#6B7280',
                textTransform:'uppercase',letterSpacing:'.1em'}}>
                Factura
              </div>
              <div style={{fontSize:9,color:'#94A3B8'}}>N°</div>
              <div style={{fontSize:13,fontWeight:900,color:'#0F172A',
                letterSpacing:'.02em',wordBreak:'break-all'}}>
                {f.numero_factura}
              </div>
              <div style={{marginTop:6,paddingTop:6,borderTop:'1px solid #E5E7EB',
                width:'100%'}}>
                <div style={{fontSize:8,color:'#94A3B8',marginBottom:3}}>
                  FECHA DE EMISIÓN
                </div>
                <div style={{fontSize:11,fontWeight:700,color:'#0F172A'}}>
                  {new Date(f.fecha_emision).toLocaleDateString('es-EC',
                    {day:'2-digit',month:'2-digit',year:'numeric'})}
                </div>
              </div>
              {f.autorizacion_sri&&(
                <div style={{marginTop:4,paddingTop:4,borderTop:'1px solid #E5E7EB',width:'100%'}}>
                  <div style={{fontSize:8,color:'#94A3B8',marginBottom:2}}>AUTORIZACIÓN SRI</div>
                  <div style={{fontSize:8,fontWeight:700,wordBreak:'break-all',color:'#374151'}}>
                    {f.autorizacion_sri}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Datos cliente */}
          <div className="divider-h" style={{padding:'8px 14px'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px 20px'}}>
              <div className="total-row" style={{borderBottom:'none',padding:'2px 0'}}>
                <span className="label" style={{marginRight:8}}>
                  {f.tipo_identificacion==='RUC'?'RUC':'Cédula'}
                </span>
                <span className="value" style={{fontWeight:700}}>{f.cliente_ruc}</span>
              </div>
              <div className="total-row" style={{borderBottom:'none',padding:'2px 0'}}>
                <span className="label" style={{marginRight:8}}>Tipo</span>
                <span className="value">{f.tipo_identificacion}</span>
              </div>
              <div style={{gridColumn:'1/-1',display:'flex',gap:8,alignItems:'baseline',
                padding:'2px 0'}}>
                <span className="label">Cliente</span>
                <span style={{fontSize:12,fontWeight:800,color:'#0F172A'}}>{f.cliente_nombre}</span>
              </div>
              {f.cliente_dir&&<div style={{display:'flex',gap:8,padding:'2px 0'}}>
                <span className="label">Dirección</span>
                <span className="value">{f.cliente_dir}</span>
              </div>}
              {f.vendedor_nombre&&<div style={{display:'flex',gap:8,padding:'2px 0'}}>
                <span className="label">Vendedor</span>
                <span className="value">{f.vendedor_nombre}</span>
              </div>}
              {f.cliente_email&&<div style={{display:'flex',gap:8,padding:'2px 0'}}>
                <span className="label">Email</span>
                <span className="value">{f.cliente_email}</span>
              </div>}
            </div>
          </div>
        </div>

        {/* ── DETALLE PRODUCTOS ── */}
        <table style={{border:'1.5px solid #1E293B',borderTop:'none'}}>
          <thead>
            <tr>
              {['Código','Descripción','Cant.','P. Unit.','Desc%',
                'Sub 0%','Sub 15%','IVA','Total'].map((h,i)=>(
                <th key={i} className="th"
                  style={{textAlign:i===1?'left':'center',
                    borderRight:i<8?'1px solid #334155':'none'}}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {f.detalles.map((d,i)=>{
              const es0  = Number(d.iva_porcentaje)===0
              const s0   = es0  ? Number(d.subtotal) : 0
              const s15  = !es0 ? Number(d.subtotal) : 0
              return (
                <tr key={i} style={{background:i%2===0?'white':'#F9FAFB'}}>
                  <td className="td td-c" style={{fontFamily:'monospace',fontSize:10,
                    color:'#7C3AED',borderRight:'1px solid #E5E7EB'}}>{d.codigo}</td>
                  <td className="td" style={{fontWeight:500,borderRight:'1px solid #E5E7EB'}}>
                    {d.descripcion}
                  </td>
                  <td className="td td-c" style={{borderRight:'1px solid #E5E7EB'}}>
                    {Number(d.cantidad).toFixed(0)}
                  </td>
                  <td className="td td-r" style={{borderRight:'1px solid #E5E7EB'}}>
                    {fmt$(d.precio_unitario)}
                  </td>
                  <td className="td td-c" style={{borderRight:'1px solid #E5E7EB'}}>
                    {Number(d.descuento_pct||0)>0?`${Number(d.descuento_pct).toFixed(1)}%`:'—'}
                  </td>
                  <td className="td td-r" style={{borderRight:'1px solid #E5E7EB'}}>
                    {s0>0?fmt$(s0):'—'}
                  </td>
                  <td className="td td-r" style={{borderRight:'1px solid #E5E7EB'}}>
                    {s15>0?fmt$(s15):'—'}
                  </td>
                  <td className="td td-r" style={{borderRight:'1px solid #E5E7EB'}}>
                    {fmt$(d.iva||0)}
                  </td>
                  <td className="td td-r" style={{fontWeight:700}}>{fmt$(d.total)}</td>
                </tr>
              )
            })}
            {/* Filas vacías */}
            {Array(Math.max(0,4-f.detalles.length)).fill(0).map((_,i)=>(
              <tr key={`e${i}`} style={{height:22,borderBottom:'1px solid #F1F5F9'}}>
                {Array(9).fill(0).map((_,j)=><td key={j}>&nbsp;</td>)}
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── TOTALES + PAGOS ── */}
        <div className="box" style={{borderTop:'none',
          display:'grid',gridTemplateColumns:'1fr 1.5px 210px'}}>

          {/* Pagos */}
          <div style={{padding:'10px 14px'}}>
            <div className="label" style={{marginBottom:8}}>Forma de pago</div>
            {f.pagos.map((p,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',
                marginBottom:4,fontSize:11}}>
                <span style={{fontWeight:600}}>
                  {p.forma_pago}
                  {p.banco_tarjeta&&` · ${p.banco_tarjeta}`}
                  {p.banco_origen&&` · ${p.banco_origen}`}
                  {p.banco_destino&&` → ${p.banco_destino}`}
                  {p.referencia&&<span style={{color:'#6B7280',fontSize:10}}> ({p.referencia})</span>}
                </span>
                <span style={{fontWeight:700}}>{fmt$(p.monto)}</span>
              </div>
            ))}
            {f.observaciones&&(
              <div style={{marginTop:10,padding:'6px 8px',background:'#F8FAFC',
                borderRadius:4,fontSize:10,color:'#374151',
                border:'1px solid #E5E7EB'}}>
                <strong>Observaciones:</strong> {f.observaciones}
              </div>
            )}
          </div>

          <div className="divider-v"/>

          {/* Totales */}
          <div style={{padding:'10px 14px'}}>
            {[
              {l:'Subtotal 0%',   v:f.subtotal_0},
              {l:'Subtotal 15%',  v:f.subtotal_iva},
              tieneDescuento&&{l:`Descuento ${f.descuento_global_pct}%`, v:-descMonto, c:'#DC2626'},
              {l:'IVA 15%',       v:f.iva, c:'#D97706'},
            ].filter(Boolean).map((r,i)=>(
              <div key={i} className="total-row">
                <span style={{color:r.c||'#374151',fontWeight:600,
                  fontSize:10,textTransform:'uppercase'}}>{r.l}</span>
                <span style={{color:r.c||'#111827',fontWeight:700}}>
                  {r.v<0?`-${fmt$(Math.abs(r.v))}`:fmt$(r.v)}
                </span>
              </div>
            ))}
            {/* Total grande */}
            <div style={{display:'flex',justifyContent:'space-between',
              padding:'7px 0 2px',borderTop:'2px solid #0F172A',marginTop:4}}>
              <span style={{fontSize:13,fontWeight:900,textTransform:'uppercase',
                letterSpacing:'.04em'}}>TOTAL</span>
              <span style={{fontSize:15,fontWeight:900,color:'#0F172A'}}>{fmt$(f.total)}</span>
            </div>
          </div>
        </div>

        {/* ── PIE ── */}
        <div style={{borderLeft:'1.5px solid #1E293B',borderRight:'1.5px solid #1E293B',
          borderBottom:'1.5px solid #1E293B',padding:'8px 14px',textAlign:'center'}}>
          <div style={{fontSize:9,color:'#6B7280',lineHeight:1.7}}>
            {f.empresa_nombre} · RUC {f.empresa_ruc} · {f.empresa_dir}
          </div>
          <div style={{fontFamily:'monospace',fontSize:8,color:'#94A3B8',marginTop:4,
            letterSpacing:1}}>
            {f.numero_factura?.replace(/-/g,'')} · {new Date().toLocaleDateString('es-EC')}
          </div>
        </div>

      </div>
    </>
  )
}