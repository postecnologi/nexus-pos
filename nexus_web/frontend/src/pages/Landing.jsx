import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const FEATURES = [
  { icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', title: 'Facturacion Electronica SRI', desc: 'Facturas, notas de credito, debito, retenciones, guias de remision y liquidaciones. 100% compatible con el SRI.', color: '#3B82F6' },
  { icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', title: 'Inventario Inteligente', desc: 'Stock en tiempo real, kardex, lotes, series, tomas fisicas, transferencias entre bodegas y alertas automaticas.', color: '#10B981' },
  { icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', title: 'Finanzas y Bancos', desc: 'Cuentas por cobrar/pagar, caja, bancos, conciliacion bancaria, flujo de efectivo y control financiero completo.', color: '#F59E0B' },
  { icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', title: 'Reportes y Analisis', desc: 'Mas de 22 reportes exportables a PDF y Excel. Dashboards en tiempo real con KPIs de tu negocio.', color: '#8B5CF6' },
  { icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', title: 'CRM Integrado', desc: 'Pipeline de ventas Kanban, seguimiento de oportunidades, scoring automatico y WhatsApp integrado.', color: '#EC4899' },
  { icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', title: 'Servicio Tecnico', desc: 'Ordenes de trabajo con timeline, asignacion de tecnicos, repuestos, garantias y facturacion directa.', color: '#F97316' },
  { icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z', title: 'Contabilidad', desc: 'Plan de cuentas, asientos automaticos, balance general, estado de resultados, multi-moneda y presupuestos.', color: '#06B6D4' },
  { icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', title: 'Nomina Ecuador', desc: 'IESS automatico (9.45%/11.15%), decimos, vacaciones, horas extras, permisos, fondos de reserva y liquidaciones.', color: '#14B8A6' },
  { icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', title: 'Multi-Empresa', desc: 'Cada empresa tiene su propia base de datos aislada. Ideal para franquicias y grupos empresariales.', color: '#7C3AED' },
]

const COMPARE = [
  ['Facturacion electronica SRI', true, true, true, true, true],
  ['Inventario con series y lotes', true, true, false, false, true],
  ['CRM con pipeline Kanban', true, true, false, false, true],
  ['Servicio tecnico', true, false, false, false, false],
  ['Nomina 100% Ecuador', true, true, false, false, true],
  ['Contabilidad multi-moneda', true, true, false, true, true],
  ['Multi-empresa (BD aislada)', true, true, false, false, true],
  ['WhatsApp integrado', true, false, false, false, false],
  ['App instalable (PWA)', true, false, false, true, false],
  ['Sin costo de implementacion', true, false, true, true, false],
  ['Soporte en espanol Ecuador', true, false, true, true, false],
]

const STATS = [
  { n: '450+', l: 'Funcionalidades' },
  { n: '35', l: 'Modulos' },
  { n: '22+', l: 'Reportes' },
  { n: '99.9%', l: 'Disponibilidad' },
]

function Icon({ d, size = 24, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
}

const CSS = `
  * { box-sizing: border-box; }
  .landing { font-family: 'Inter','Segoe UI',sans-serif; color: #1F2937; overflow-x: hidden; }
  .nav-inner { max-width:1200px; margin:0 auto; padding:0 20px; display:flex; align-items:center; justify-content:space-between; height:64px; }
  .nav-links { display:flex; gap:24px; align-items:center; }
  .nav-burger { display:none; background:none; border:none; cursor:pointer; padding:8px; }
  .nav-mobile { display:none; flex-direction:column; padding:16px 20px; gap:12px; background:rgba(15,23,42,.98); border-top:1px solid rgba(255,255,255,.08); }
  .hero { min-height:100vh; display:flex; align-items:center; justify-content:center; text-align:center; padding:100px 20px 60px; position:relative; overflow:hidden; }
  .hero h1 { font-size:clamp(32px,5vw,64px); font-weight:900; color:white; line-height:1.1; margin-bottom:24px; letter-spacing:-0.03em; }
  .hero p { font-size:clamp(15px,2vw,20px); color:#94A3B8; line-height:1.7; max-width:650px; margin:0 auto 40px; }
  .stats { display:flex; gap:40px; justify-content:center; margin-top:56px; flex-wrap:wrap; }
  .section { padding:80px 20px; }
  .section-title { font-size:clamp(24px,3.5vw,42px); font-weight:800; margin-bottom:16px; }
  .grid-features { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:16px; }
  .feature-card { background:white; border-radius:16px; padding:24px; border:1px solid #E2E8F0; transition:all .25s; }
  .feature-card:hover { transform:translateY(-4px); box-shadow:0 12px 40px rgba(0,0,0,.08); }
  .grid-sectors { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:40px; }
  .compare-table { width:100%; border-collapse:collapse; font-size:13px; }
  .compare-table th, .compare-table td { padding:10px 8px; text-align:center; }
  .compare-table th:first-child, .compare-table td:first-child { text-align:left; padding-left:16px; }
  .compare-table thead tr { background:#F3F4F6; border-bottom:2px solid #E2E8F0; }
  .compare-table tbody tr { border-bottom:1px solid #F1F5F9; }
  .compare-scroll { overflow-x:auto; -webkit-overflow-scrolling:touch; }
  .btns-row { display:flex; gap:16px; justify-content:center; flex-wrap:wrap; }
  .btn-primary { padding:14px 36px; border-radius:12px; border:none; background:linear-gradient(135deg,#7C3AED,#10B981); color:white; font-size:16px; font-weight:700; cursor:pointer; box-shadow:0 8px 32px rgba(124,58,237,.4); }
  .btn-secondary { padding:14px 36px; border-radius:12px; border:1px solid rgba(255,255,255,.15); background:rgba(255,255,255,.05); color:white; font-size:16px; font-weight:600; cursor:pointer; }
  .btn-wa { padding:16px 36px; border-radius:12px; border:1px solid rgba(255,255,255,.2); background:rgba(37,211,102,.15); color:#25D366; text-decoration:none; font-size:16px; font-weight:700; display:inline-block; }
  .check { display:inline-flex; width:22px; height:22px; border-radius:50%; align-items:center; justify-content:center; font-size:12px; font-weight:700; }
  .info-cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:16px; text-align:left; }
  .footer { padding:28px 20px; background:#0F172A; border-top:1px solid rgba(255,255,255,.05); }
  .footer-inner { max-width:1200px; margin:0 auto; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; }
  @media(max-width:768px) {
    .nav-links { display:none !important; }
    .nav-burger { display:flex !important; }
    .nav-mobile.open { display:flex !important; }
    .stats { gap:24px; }
    .stats > div { min-width:70px; }
    .grid-features { grid-template-columns:1fr; }
    .grid-sectors { grid-template-columns:1fr 1fr; }
    .compare-table { font-size:12px; min-width:600px; }
    .compare-table th, .compare-table td { padding:8px 6px; }
    .info-cards { grid-template-columns:1fr; }
    .btn-primary, .btn-secondary, .btn-wa { width:100%; text-align:center; padding:14px 20px; }
    .btns-row { flex-direction:column; align-items:stretch; }
    .section { padding:60px 16px; }
    .footer-inner { flex-direction:column; text-align:center; }
  }
`

export default function Landing() {
  const nav = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const scrollTo = id => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); setMenuOpen(false) }

  return (
    <div className="landing">
      <style>{CSS}</style>

      {/* Nav */}
      <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:100, background:'rgba(15,23,42,.95)', backdropFilter:'blur(12px)', borderBottom:'1px solid rgba(255,255,255,.08)' }}>
        <div className="nav-inner">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#7C3AED,#10B981)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:900, fontSize:14 }}>N</div>
            <span style={{ color:'white', fontSize:20, fontWeight:800 }}>NEXUS <span style={{ color:'#10B981' }}>IA</span></span>
          </div>
          <div className="nav-links">
            {['Caracteristicas','Sectores','Comparativa','Contacto'].map(s => (
              <a key={s} onClick={() => scrollTo(s.toLowerCase())} style={{ color:'#CBD5E1', fontSize:13, fontWeight:500, cursor:'pointer', textDecoration:'none' }}>{s}</a>
            ))}
            <button onClick={() => nav('/login')} style={{ padding:'8px 16px', borderRadius:8, border:'1px solid rgba(124,58,237,.4)', background:'transparent', color:'#A78BFA', fontSize:13, fontWeight:600, cursor:'pointer' }}>Iniciar sesion</button>
            <button onClick={() => nav('/registro')} style={{ padding:'8px 16px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#7C3AED,#10B981)', color:'white', fontSize:13, fontWeight:700, cursor:'pointer' }}>Prueba gratis</button>
          </div>
          <button className="nav-burger" onClick={() => setMenuOpen(!menuOpen)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d={menuOpen ? "M6 6l12 12M6 18L18 6" : "M4 6h16M4 12h16M4 18h16"} /></svg>
          </button>
        </div>
        {menuOpen && (
          <div className="nav-mobile open">
            {['Caracteristicas','Sectores','Comparativa','Contacto'].map(s => (
              <a key={s} onClick={() => scrollTo(s.toLowerCase())} style={{ color:'#CBD5E1', fontSize:15, fontWeight:500, cursor:'pointer', textDecoration:'none', padding:'8px 0' }}>{s}</a>
            ))}
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button onClick={() => { nav('/login'); setMenuOpen(false) }} style={{ flex:1, padding:'10px', borderRadius:8, border:'1px solid rgba(124,58,237,.4)', background:'transparent', color:'#A78BFA', fontSize:14, fontWeight:600, cursor:'pointer' }}>Iniciar sesion</button>
              <button onClick={() => { nav('/registro'); setMenuOpen(false) }} style={{ flex:1, padding:'10px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#7C3AED,#10B981)', color:'white', fontSize:14, fontWeight:700, cursor:'pointer' }}>Prueba gratis</button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="hero" style={{ background:'linear-gradient(135deg,#0F172A 0%,#1E1B4B 40%,#312E81 70%,#4C1D95 100%)' }}>
        <div style={{ position:'absolute', top:'10%', left:'5%', width:350, height:350, borderRadius:'50%', background:'rgba(124,58,237,.12)', filter:'blur(100px)' }} />
        <div style={{ position:'absolute', bottom:'10%', right:'5%', width:280, height:280, borderRadius:'50%', background:'rgba(16,185,129,.1)', filter:'blur(80px)' }} />
        <div style={{ position:'relative', zIndex:1, maxWidth:800 }}>
          <div style={{ display:'inline-block', padding:'6px 16px', borderRadius:20, background:'rgba(16,185,129,.15)', border:'1px solid rgba(16,185,129,.3)', color:'#6EE7B7', fontSize:13, fontWeight:600, marginBottom:24 }}>
            Sistema de facturacion electronica #1 en Ecuador
          </div>
          <h1>Tu negocio, <br /><span style={{ background:'linear-gradient(135deg,#A78BFA,#10B981)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>completamente digital</span></h1>
          <p>Sistema ERP completo para cualquier tipo de empresa: comercio, produccion, manufactura, servicios y mas. Facturacion electronica SRI, inventario, CRM, contabilidad, nomina. Todo en un solo sistema, desde cualquier dispositivo.</p>
          <div className="btns-row">
            <button className="btn-primary" onClick={() => nav('/registro')}>Solicitar prueba gratuita</button>
            <button className="btn-secondary" onClick={() => scrollTo('caracteristicas')}>Ver funcionalidades</button>
          </div>
          <div className="stats">
            {STATS.map(s => (
              <div key={s.l} style={{ textAlign:'center' }}>
                <div style={{ fontSize:28, fontWeight:900, color:'white' }}>{s.n}</div>
                <div style={{ fontSize:12, color:'#94A3B8', fontWeight:500 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="caracteristicas" className="section" style={{ background:'#F8FAFC' }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <h2 className="section-title" style={{ color:'#0F172A' }}>Todo lo que necesitas en un solo sistema</h2>
            <p style={{ fontSize:17, color:'#64748B', maxWidth:550, margin:'0 auto' }}>Desde una tienda hasta una fabrica. NEXUS se adapta a cualquier tipo de empresa.</p>
          </div>
          <div className="grid-features">
            {FEATURES.map(f => (
              <div key={f.title} className="feature-card">
                <div style={{ width:44, height:44, borderRadius:12, background:f.color+'12', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14 }}>
                  <Icon d={f.icon} size={22} color={f.color} />
                </div>
                <h3 style={{ fontSize:16, fontWeight:700, marginBottom:6, color:'#0F172A' }}>{f.title}</h3>
                <p style={{ fontSize:13, color:'#64748B', lineHeight:1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sectors */}
      <section id="sectores" className="section" style={{ background:'#0F172A' }}>
        <div style={{ maxWidth:1000, margin:'0 auto', textAlign:'center' }}>
          <h2 className="section-title" style={{ color:'white' }}>Se adapta a cualquier industria</h2>
          <p style={{ color:'#94A3B8', marginBottom:32, fontSize:16 }}>No importa tu giro de negocio, NEXUS se configura para tus necesidades</p>
          <div className="grid-sectors">
            {['Comercio y Retail','Restaurantes','Farmacias','Ferreterias','Tecnologia','Manufactura','Distribucion','Servicios'].map(s => (
              <div key={s} style={{ padding:'14px 16px', borderRadius:10, background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', color:'#E2E8F0', fontSize:14, fontWeight:600 }}>{s}</div>
            ))}
          </div>
          <div className="info-cards">
            {[
              { t:'Multi-empresa', d:'Cada empresa tiene su propia base de datos aislada. Perfecto para franquicias.', c:'#7C3AED' },
              { t:'WhatsApp integrado', d:'Notifica a tus clientes automaticamente: facturas, cobros, citas.', c:'#25D366' },
              { t:'Cualquier dispositivo', d:'Computadora, tablet o celular. Instalable como app nativa.', c:'#3B82F6' },
              { t:'100% Ecuador', d:'Cumple con SRI, IESS y legislacion laboral ecuatoriana.', c:'#EF4444' },
            ].map(f => (
              <div key={f.t} style={{ padding:20, background:'rgba(255,255,255,.03)', borderRadius:12, border:'1px solid rgba(255,255,255,.06)' }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:f.c, marginBottom:10 }} />
                <h4 style={{ color:'white', fontWeight:700, fontSize:15, marginBottom:6 }}>{f.t}</h4>
                <p style={{ color:'#94A3B8', fontSize:13, lineHeight:1.6 }}>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section id="comparativa" className="section" style={{ background:'#F8FAFC' }}>
        <div style={{ maxWidth:900, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:40 }}>
            <h2 className="section-title" style={{ color:'#0F172A' }}>NEXUS vs la competencia</h2>
            <p style={{ color:'#64748B', fontSize:16 }}>Comparado con los sistemas mas populares en Ecuador</p>
          </div>
          <div className="compare-scroll" style={{ background:'white', borderRadius:16, border:'1px solid #E2E8F0', boxShadow:'0 4px 24px rgba(0,0,0,.06)' }}>
            <table className="compare-table">
              <thead>
                <tr>
                  <th style={{ textAlign:'left', color:'#64748B', fontWeight:600, fontSize:12 }}>Funcionalidad</th>
                  {['NEXUS IA','Odoo','TINI','Alegra','SAP B1'].map(s => (
                    <th key={s} style={{ fontWeight:700, fontSize:12, color:s==='NEXUS IA' ? '#7C3AED' : '#374151', whiteSpace:'nowrap' }}>{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(([feat,...vals], i) => (
                  <tr key={i}>
                    <td style={{ color:'#374151', fontWeight:500, fontSize:13 }}>{feat}</td>
                    {vals.map((v, j) => (
                      <td key={j}>
                        {v ? <span className="check" style={{ background:j===0?'#10B981':'#D1FAE5', color:j===0?'white':'#059669' }}>&#10003;</span>
                           : <span style={{ color:'#CBD5E1' }}>—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contacto" className="section" style={{ background:'linear-gradient(135deg,#1E1B4B 0%,#312E81 50%,#4C1D95 100%)', textAlign:'center' }}>
        <div style={{ maxWidth:700, margin:'0 auto' }}>
          <h2 className="section-title" style={{ color:'white' }}>Lleva tu negocio al siguiente nivel</h2>
          <p style={{ fontSize:17, color:'#C4B5FD', marginBottom:36, lineHeight:1.7 }}>
            Solicita tu prueba gratuita y nuestro equipo configurara el sistema personalizado para tu empresa. Sin compromiso.
          </p>
          <div className="btns-row" style={{ marginBottom:40 }}>
            <button className="btn-primary" onClick={() => nav('/registro')}>Solicitar prueba gratuita</button>
            <a className="btn-wa" href="https://wa.me/593999038296?text=Hola%2C%20quiero%20informacion%20sobre%20NEXUS%20IA" target="_blank" rel="noopener">Escribenos por WhatsApp</a>
          </div>
          <div style={{ display:'flex', gap:24, justifyContent:'center', flexWrap:'wrap', color:'#94A3B8', fontSize:14 }}>
            <span>postecnologi@gmail.com</span>
            <span>+593 99 903 8296</span>
            <span>Quito, Ecuador</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:22, height:22, borderRadius:6, background:'linear-gradient(135deg,#7C3AED,#10B981)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:900, fontSize:9 }}>N</div>
            <span style={{ color:'#64748B', fontSize:12 }}>2026 NEXUS IA by POS-TECNOLOGI. Todos los derechos reservados.</span>
          </div>
          <div style={{ display:'flex', gap:20 }}>
            {[{l:'Manual',h:'/manual'},{l:'Terminos',h:'/legal/terminos'},{l:'Privacidad',h:'/legal/privacidad'},{l:'Soporte',h:'/legal/soporte'}].map(s => (
              <a key={s.l} href={s.h} style={{ color:'#64748B', fontSize:12, textDecoration:'none' }}>{s.l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
