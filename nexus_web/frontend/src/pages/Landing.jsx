import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const FEATURES = [
  { icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', title: 'Facturacion Electronica SRI', desc: 'Facturas, notas de credito, debito, retenciones, guias de remision y liquidaciones. 100% compatible con el SRI.', color: '#3B82F6' },
  { icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', title: 'Inventario Inteligente', desc: 'Stock en tiempo real, kardex, lotes, series, tomas fisicas, transferencias entre bodegas y alertas automaticas.', color: '#10B981' },
  { icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', title: 'Finanzas y Bancos', desc: 'CXC, CXP, caja, bancos, conciliacion bancaria, flujo de efectivo y control financiero completo.', color: '#F59E0B' },
  { icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', title: 'Reportes y Analisis', desc: 'Mas de 22 reportes exportables a PDF y Excel. Dashboards en tiempo real con KPIs de tu negocio.', color: '#8B5CF6' },
  { icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', title: 'CRM Integrado', desc: 'Pipeline de ventas Kanban, seguimiento de oportunidades, scoring automatico y WhatsApp integrado.', color: '#EC4899' },
  { icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', title: 'Servicio Tecnico', desc: 'Ordenes de trabajo con timeline, asignacion de tecnicos, repuestos, garantias y facturacion directa.', color: '#F97316' },
  { icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z', title: 'Contabilidad', desc: 'Plan de cuentas, asientos automaticos, balance general, estado de resultados, multi-moneda y presupuestos.', color: '#06B6D4' },
  { icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', title: 'Nomina Ecuador', desc: 'IESS automatico (9.45%/11.15%), decimos, vacaciones, horas extras, permisos, fondos de reserva y liquidaciones.', color: '#14B8A6' },
  { icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', title: 'Multi-Empresa', desc: 'Cada empresa tiene su propia base de datos aislada. Ideal para franquicias y grupos empresariales.', color: '#7C3AED' },
]

const SECTORS = [
  { name: 'Comercio y Retail', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z' },
  { name: 'Restaurantes', icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6' },
  { name: 'Farmacias', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
  { name: 'Ferreterias', icon: 'M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z' },
  { name: 'Tecnologia', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { name: 'Manufactura', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
  { name: 'Distribucion', icon: 'M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0' },
  { name: 'Servicios', icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
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

export default function Landing() {
  const nav = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const scrollTo = id => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); setMenuOpen(false) }

  return (
    <div style={{ fontFamily: "'Inter','Segoe UI',sans-serif", color: '#1F2937', overflowX: 'hidden' }}>
      {/* Nav */}
      <style>{`@media(max-width:768px){.nav-links{display:none!important}.nav-burger{display:flex!important}.nav-mobile{display:flex!important}}`}</style>
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(15,23,42,.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#7C3AED,#10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 14 }}>N</div>
            <span style={{ color: 'white', fontSize: 20, fontWeight: 800 }}>NEXUS <span style={{ color: '#10B981' }}>IA</span></span>
          </div>
          <div className="nav-links" style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
            {['Caracteristicas', 'Sectores', 'Comparativa', 'Contacto'].map(s => (
              <a key={s} onClick={() => scrollTo(s.toLowerCase())} style={{ color: '#CBD5E1', fontSize: 13, fontWeight: 500, cursor: 'pointer', textDecoration: 'none' }}>{s}</a>
            ))}
            <button onClick={() => nav('/login')} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(124,58,237,.4)', background: 'transparent', color: '#A78BFA', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Iniciar sesion</button>
            <button onClick={() => nav('/registro')} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#7C3AED,#10B981)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Prueba gratis</button>
          </div>
          <button className="nav-burger" onClick={() => setMenuOpen(!menuOpen)} style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d={menuOpen ? "M6 6l12 12M6 18L18 6" : "M4 6h16M4 12h16M4 18h16"} /></svg>
          </button>
        </div>
        {menuOpen && (
          <div className="nav-mobile" style={{ display: 'none', flexDirection: 'column', padding: '16px 24px', gap: 12, background: 'rgba(15,23,42,.98)', borderTop: '1px solid rgba(255,255,255,.08)' }}>
            {['Caracteristicas', 'Sectores', 'Comparativa', 'Contacto'].map(s => (
              <a key={s} onClick={() => scrollTo(s.toLowerCase())} style={{ color: '#CBD5E1', fontSize: 15, fontWeight: 500, cursor: 'pointer', textDecoration: 'none', padding: '8px 0' }}>{s}</a>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => { nav('/login'); setMenuOpen(false) }} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid rgba(124,58,237,.4)', background: 'transparent', color: '#A78BFA', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Iniciar sesion</button>
              <button onClick={() => { nav('/registro'); setMenuOpen(false) }} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#7C3AED,#10B981)', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Prueba gratis</button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#0F172A 0%,#1E1B4B 40%,#312E81 70%,#4C1D95 100%)', textAlign: 'center', padding: '120px 24px 80px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '10%', left: '10%', width: 400, height: 400, borderRadius: '50%', background: 'rgba(124,58,237,.12)', filter: 'blur(100px)' }} />
        <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: 300, height: 300, borderRadius: '50%', background: 'rgba(16,185,129,.1)', filter: 'blur(80px)' }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 800 }}>
          <div style={{ display: 'inline-block', padding: '6px 16px', borderRadius: 20, background: 'rgba(16,185,129,.15)', border: '1px solid rgba(16,185,129,.3)', color: '#6EE7B7', fontSize: 13, fontWeight: 600, marginBottom: 24 }}>
            El sistema ERP que se adapta a tu negocio
          </div>
          <h1 style={{ fontSize: 'clamp(36px,5vw,64px)', fontWeight: 900, color: 'white', lineHeight: 1.1, marginBottom: 24, letterSpacing: '-0.03em' }}>
            Tu negocio, <br /><span style={{ background: 'linear-gradient(135deg,#A78BFA,#10B981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>completamente digital</span>
          </h1>
          <p style={{ fontSize: 'clamp(16px,2vw,20px)', color: '#94A3B8', lineHeight: 1.7, maxWidth: 650, margin: '0 auto 40px' }}>
            Sistema ERP completo para cualquier tipo de empresa: comercio, produccion, manufactura,
            servicios y mas. Facturacion electronica SRI, inventario, CRM, contabilidad, nomina.
            Todo en un solo sistema, desde cualquier dispositivo.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => nav('/registro')} style={{ padding: '14px 36px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#7C3AED,#10B981)', color: 'white', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 32px rgba(124,58,237,.4)' }}>Solicitar prueba gratuita</button>
            <button onClick={() => scrollTo('caracteristicas')} style={{ padding: '14px 36px', borderRadius: 12, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.05)', color: 'white', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>Ver funcionalidades</button>
          </div>
          <div style={{ display: 'flex', gap: 48, justifyContent: 'center', marginTop: 64, flexWrap: 'wrap' }}>
            {STATS.map(s => (
              <div key={s.l}>
                <div style={{ fontSize: 32, fontWeight: 900, color: 'white' }}>{s.n}</div>
                <div style={{ fontSize: 13, color: '#94A3B8', fontWeight: 500 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="caracteristicas" style={{ padding: '100px 24px', background: '#F8FAFC' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <h2 style={{ fontSize: 'clamp(28px,3.5vw,42px)', fontWeight: 800, color: '#0F172A', marginBottom: 16 }}>Todo lo que necesitas en un solo sistema</h2>
            <p style={{ fontSize: 18, color: '#64748B', maxWidth: 600, margin: '0 auto' }}>Desde una tienda hasta una fabrica. NEXUS se adapta a cualquier tipo de empresa.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ background: 'white', borderRadius: 16, padding: 28, border: '1px solid #E2E8F0', transition: 'all .25s', cursor: 'default' }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = `0 16px 48px ${f.color}18`; e.currentTarget.style.borderColor = f.color + '40' }}
                onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#E2E8F0' }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: f.color + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Icon d={f.icon} size={24} color={f.color} />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, color: '#0F172A' }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sectors */}
      <section id="sectores" style={{ padding: '80px 24px', background: '#0F172A' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: 'white', marginBottom: 16 }}>Se adapta a cualquier industria</h2>
          <p style={{ color: '#94A3B8', marginBottom: 40, fontSize: 16 }}>No importa tu giro de negocio, NEXUS se configura para tus necesidades especificas</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 16, marginBottom: 48 }}>
            {SECTORS.map(s => (
              <div key={s.name} style={{ padding: '20px 16px', borderRadius: 12, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', gap: 12, transition: 'all .2s' }}
                onMouseOver={e => { e.currentTarget.style.background = 'rgba(124,58,237,.12)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,.3)' }}
                onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.08)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(124,58,237,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon d={s.icon} size={18} color="#A78BFA" />
                </div>
                <span style={{ color: '#E2E8F0', fontSize: 14, fontWeight: 600 }}>{s.name}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: 20, textAlign: 'left' }}>
            {[
              { t: 'Multi-empresa', d: 'Cada empresa tiene su propia base de datos aislada. Perfecto para franquicias y grupos empresariales.', c: '#7C3AED' },
              { t: 'WhatsApp integrado', d: 'Notifica a tus clientes automaticamente: facturas, cobros, citas de servicio tecnico y mas.', c: '#25D366' },
              { t: 'Cualquier dispositivo', d: 'Funciona en computadora, tablet o celular. Instalable como app sin necesidad de descargar nada.', c: '#3B82F6' },
              { t: '100% Ecuador', d: 'Cumple con SRI, IESS y legislacion laboral ecuatoriana. Disenado por ecuatorianos para ecuatorianos.', c: '#EF4444' },
            ].map(f => (
              <div key={f.t} style={{ padding: 24, background: 'rgba(255,255,255,.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,.06)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: f.c, marginBottom: 12 }} />
                <h4 style={{ color: 'white', fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{f.t}</h4>
                <p style={{ color: '#94A3B8', fontSize: 13, lineHeight: 1.6 }}>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section id="comparativa" style={{ padding: '100px 24px', background: '#F8FAFC' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ fontSize: 'clamp(28px,3.5vw,38px)', fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>NEXUS vs la competencia</h2>
            <p style={{ color: '#64748B', fontSize: 16 }}>Comparado con los sistemas mas populares en Ecuador</p>
          </div>
          <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', border: '1px solid #E2E8F0', boxShadow: '0 4px 24px rgba(0,0,0,.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                  <th style={{ padding: '14px 20px', textAlign: 'left', color: '#64748B', fontWeight: 600, fontSize: 13 }}>Funcionalidad</th>
                  {['NEXUS IA', 'Odoo', 'TINI', 'Alegra', 'SAP B1'].map(s => (
                    <th key={s} style={{ padding: '14px 12px', textAlign: 'center', fontWeight: 700, fontSize: 13, color: s === 'NEXUS IA' ? '#7C3AED' : '#374151' }}>{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Facturacion electronica SRI', true, true, true, true, true],
                  ['Inventario con series y lotes', true, true, false, false, true],
                  ['CRM con pipeline Kanban', true, true, false, false, true],
                  ['Servicio tecnico', true, false, false, false, false],
                  ['Nomina 100% Ecuador', true, true, false, false, true],
                  ['Contabilidad multi-moneda', true, true, false, true, true],
                  ['Multi-empresa (BD aislada)', true, true, false, false, true],
                  ['WhatsApp integrado', true, false, false, false, false],
                  ['PWA (app en celular)', true, false, false, true, false],
                  ['Sin costo de implementacion', true, false, true, true, false],
                  ['Soporte en espanol Ecuador', true, false, true, true, false],
                ].map(([feat, ...vals], i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px 20px', color: '#374151', fontWeight: 500 }}>{feat}</td>
                    {vals.map((v, j) => (
                      <td key={j} style={{ padding: '12px', textAlign: 'center' }}>
                        {v ? <span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: '50%', background: j === 0 ? '#10B981' : '#D1FAE5', alignItems: 'center', justifyContent: 'center', color: j === 0 ? 'white' : '#059669', fontSize: 12, fontWeight: 700 }}>&#10003;</span>
                           : <span style={{ color: '#CBD5E1', fontSize: 18 }}>—</span>}
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
      <section id="contacto" style={{ padding: '100px 24px', background: 'linear-gradient(135deg,#1E1B4B 0%,#312E81 50%,#4C1D95 100%)', textAlign: 'center' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(28px,3.5vw,42px)', fontWeight: 800, color: 'white', marginBottom: 16 }}>Lleva tu negocio al siguiente nivel</h2>
          <p style={{ fontSize: 18, color: '#C4B5FD', marginBottom: 40, lineHeight: 1.7 }}>
            Solicita tu prueba gratuita y nuestro equipo configurara el sistema
            personalizado para tu empresa. Sin compromiso.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
            <button onClick={() => nav('/registro')} style={{ padding: '16px 40px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#7C3AED,#10B981)', color: 'white', fontSize: 17, fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 32px rgba(124,58,237,.4)' }}>Solicitar prueba gratuita</button>
            <a href="https://wa.me/593999038296?text=Hola%2C%20quiero%20informacion%20sobre%20NEXUS%20IA" target="_blank" rel="noopener"
              style={{ padding: '16px 40px', borderRadius: 12, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(37,211,102,.15)', color: '#25D366', textDecoration: 'none', fontSize: 17, fontWeight: 700, cursor: 'pointer', display: 'inline-block' }}>Escribenos por WhatsApp</a>
          </div>
          <div style={{ display: 'flex', gap: 32, justifyContent: 'center', flexWrap: 'wrap', color: '#94A3B8', fontSize: 14 }}>
            <span>postecnologi@gmail.com</span>
            <span>+593 99 903 8296</span>
            <span>Quito, Ecuador</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '32px 24px', background: '#0F172A', borderTop: '1px solid rgba(255,255,255,.05)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg,#7C3AED,#10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 10 }}>N</div>
            <span style={{ color: '#64748B', fontSize: 13 }}>2026 NEXUS IA by POS-TECNOLOGI. Todos los derechos reservados.</span>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            {['Terminos', 'Privacidad', 'Soporte'].map(s => (
              <a key={s} href="#" style={{ color: '#64748B', fontSize: 13, textDecoration: 'none' }}>{s}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
