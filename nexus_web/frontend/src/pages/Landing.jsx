import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const FEATURES = [
  { icon: '🧾', title: 'Facturacion Electronica', desc: 'Emision de facturas, notas de credito, debito, retenciones, guias y liquidaciones 100% compatibles con el SRI.' },
  { icon: '📦', title: 'Inventario Completo', desc: 'Stock en tiempo real, kardex, lotes, tomas fisicas, transferencias entre bodegas y alertas de minimos.' },
  { icon: '💰', title: 'Finanzas y Bancos', desc: 'Cuentas por cobrar/pagar, caja, bancos, conciliacion bancaria y flujo de efectivo en un solo lugar.' },
  { icon: '📊', title: 'Reportes Avanzados', desc: 'Mas de 22 reportes exportables a PDF y Excel. Ventas, compras, inventario, impuestos y mas.' },
  { icon: '👥', title: 'CRM Integrado', desc: 'Pipeline de ventas, seguimiento de oportunidades, actividades, scoring y automatizaciones.' },
  { icon: '🔧', title: 'Servicio Tecnico', desc: 'Ordenes de trabajo, seguimiento, tecnicos, repuestos, garantias y facturacion integrada.' },
  { icon: '📋', title: 'Contabilidad', desc: 'Plan de cuentas, asientos, balance general, estado de resultados, multi-moneda y presupuestos.' },
  { icon: '👷', title: 'Nomina Ecuador', desc: 'Calculo automatico de IESS, decimos, vacaciones, horas extras, permisos y liquidaciones.' },
  { icon: '🏢', title: 'Multi-Empresa', desc: 'Cada empresa tiene su propia base de datos aislada. Perfecto para franquicias y grupos.' },
]

const PLANS = [
  { name: 'Basico', price: 15, users: 3, products: '500', invoices: '100/mes', color: '#3B82F6',
    features: ['Facturacion SRI', 'Inventario basico', 'Reportes', 'Clientes y proveedores', 'Soporte por email'] },
  { name: 'Profesional', price: 35, users: 10, products: '5,000', invoices: '500/mes', color: '#7C3AED', popular: true,
    features: ['Todo del Basico', 'CRM completo', 'Servicio tecnico', 'Contabilidad', 'Nomina', 'Soporte prioritario'] },
  { name: 'Empresarial', price: 75, users: 50, products: 'Ilimitados', invoices: 'Ilimitadas', color: '#F59E0B',
    features: ['Todo del Profesional', 'Multi-sucursal', 'Multi-moneda', 'API completa', 'Backups diarios', 'Soporte 24/7'] },
]

const STATS = [
  { n: '431+', l: 'Funcionalidades' },
  { n: '35', l: 'Modulos' },
  { n: '22+', l: 'Reportes' },
  { n: '99.9%', l: 'Disponibilidad' },
]

export default function Landing() {
  const nav = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const scrollTo = id => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMenuOpen(false)
  }

  return (
    <div style={{ fontFamily: "'Inter','Segoe UI',sans-serif", color: '#1F2937', overflowX: 'hidden' }}>
      {/* Nav */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(15,23,42,.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,.08)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#7C3AED,#EC4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 14 }}>N</div>
            <span style={{ color: 'white', fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>NEXUS <span style={{ color: '#A78BFA' }}>POS</span></span>
          </div>
          <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
            {['Caracteristicas', 'Planes', 'Contacto'].map(s => (
              <a key={s} onClick={() => scrollTo(s.toLowerCase())} style={{ color: '#CBD5E1', fontSize: 14, fontWeight: 500, cursor: 'pointer', textDecoration: 'none' }}
                onMouseOver={e => e.target.style.color='white'} onMouseOut={e => e.target.style.color='#CBD5E1'}>{s}</a>
            ))}
            <button onClick={() => nav('/login')} style={{
              padding: '8px 20px', borderRadius: 8, border: '1px solid rgba(124,58,237,.5)',
              background: 'transparent', color: '#A78BFA', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>Iniciar sesion</button>
            <button onClick={() => nav('/registro')} style={{
              padding: '8px 20px', borderRadius: 8, border: 'none',
              background: 'linear-gradient(135deg,#7C3AED,#EC4899)', color: 'white',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>Prueba gratis</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg,#0F172A 0%,#1E1B4B 40%,#312E81 70%,#4C1D95 100%)',
        textAlign: 'center', padding: '120px 24px 80px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '10%', left: '10%', width: 400, height: 400, borderRadius: '50%', background: 'rgba(124,58,237,.12)', filter: 'blur(100px)' }} />
        <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: 300, height: 300, borderRadius: '50%', background: 'rgba(236,72,153,.1)', filter: 'blur(80px)' }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 800 }}>
          <div style={{ display: 'inline-block', padding: '6px 16px', borderRadius: 20, background: 'rgba(124,58,237,.2)', border: '1px solid rgba(124,58,237,.3)', color: '#C4B5FD', fontSize: 13, fontWeight: 600, marginBottom: 24 }}>
            El ERP #1 para Ecuador
          </div>
          <h1 style={{ fontSize: 'clamp(36px,5vw,64px)', fontWeight: 900, color: 'white', lineHeight: 1.1, marginBottom: 24, letterSpacing: '-0.03em' }}>
            Tu negocio, <br /><span style={{ background: 'linear-gradient(135deg,#A78BFA,#EC4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>completamente digital</span>
          </h1>
          <p style={{ fontSize: 'clamp(16px,2vw,20px)', color: '#94A3B8', lineHeight: 1.7, marginBottom: 40, maxWidth: 600, margin: '0 auto 40px' }}>
            Facturacion electronica SRI, inventario, CRM, contabilidad, nomina y mas.
            Todo en un solo sistema. Sin instalaciones. Desde cualquier dispositivo.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => nav('/registro')} style={{
              padding: '14px 36px', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg,#7C3AED,#EC4899)', color: 'white',
              fontSize: 16, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 8px 32px rgba(124,58,237,.4)',
            }}>Comenzar gratis</button>
            <button onClick={() => scrollTo('caracteristicas')} style={{
              padding: '14px 36px', borderRadius: 12, border: '1px solid rgba(255,255,255,.15)',
              background: 'rgba(255,255,255,.05)', color: 'white',
              fontSize: 16, fontWeight: 600, cursor: 'pointer',
            }}>Ver funcionalidades</button>
          </div>
          {/* Stats */}
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
            <h2 style={{ fontSize: 'clamp(28px,3.5vw,42px)', fontWeight: 800, color: '#0F172A', marginBottom: 16 }}>Todo lo que necesitas</h2>
            <p style={{ fontSize: 18, color: '#64748B', maxWidth: 600, margin: '0 auto' }}>
              Un sistema completo que reemplaza a Odoo, SAP y TINI. Disenado especificamente para Ecuador.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{
                background: 'white', borderRadius: 16, padding: 28,
                border: '1px solid #E2E8F0',
                transition: 'transform .2s, box-shadow .2s',
              }}
                onMouseOver={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 12px 40px rgba(0,0,0,.08)' }}
                onMouseOut={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>{f.icon}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#0F172A' }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section style={{ padding: '80px 24px', background: '#0F172A' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: 'white', marginBottom: 16 }}>NEXUS vs la competencia</h2>
          <p style={{ color: '#94A3B8', marginBottom: 40, fontSize: 16 }}>Comparado con los sistemas mas populares en Ecuador</p>
          <div style={{ background: 'rgba(255,255,255,.05)', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,.08)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,.1)' }}>
                  <th style={{ padding: '14px 20px', textAlign: 'left', color: '#94A3B8', fontWeight: 600 }}>Funcion</th>
                  {['NEXUS', 'Odoo', 'TINI', 'Alegra'].map(s => (
                    <th key={s} style={{ padding: '14px 16px', color: s === 'NEXUS' ? '#A78BFA' : '#94A3B8', fontWeight: 700 }}>{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Facturacion SRI', true, true, true, true],
                  ['CRM integrado', true, true, false, false],
                  ['Servicio tecnico', true, false, false, false],
                  ['Nomina Ecuador', true, true, false, false],
                  ['Contabilidad completa', true, true, false, true],
                  ['Multi-empresa SaaS', true, true, false, false],
                  ['WhatsApp integrado', true, false, false, false],
                  ['Desde $15/mes', true, false, true, true],
                ].map(([feat, ...vals], i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                    <td style={{ padding: '12px 20px', color: '#E2E8F0', fontWeight: 500 }}>{feat}</td>
                    {vals.map((v, j) => (
                      <td key={j} style={{ padding: '12px 16px', textAlign: 'center', fontSize: 16 }}>
                        {v ? <span style={{ color: j === 0 ? '#10B981' : '#94A3B8' }}>✓</span> : <span style={{ color: '#475569' }}>—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="planes" style={{ padding: '100px 24px', background: '#F8FAFC' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <h2 style={{ fontSize: 'clamp(28px,3.5vw,42px)', fontWeight: 800, color: '#0F172A', marginBottom: 16 }}>Planes simples, sin sorpresas</h2>
            <p style={{ fontSize: 18, color: '#64748B' }}>Prueba 14 dias gratis. Sin tarjeta de credito.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
            {PLANS.map(p => (
              <div key={p.name} style={{
                background: 'white', borderRadius: 20, padding: 36,
                border: p.popular ? '2px solid #7C3AED' : '1px solid #E2E8F0',
                position: 'relative',
                boxShadow: p.popular ? '0 16px 48px rgba(124,58,237,.15)' : 'none',
              }}>
                {p.popular && (
                  <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                    padding: '4px 16px', borderRadius: 20, background: '#7C3AED', color: 'white',
                    fontSize: 11, fontWeight: 700, letterSpacing: '.05em' }}>MAS POPULAR</div>
                )}
                <h3 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>{p.name}</h3>
                <div style={{ marginBottom: 24 }}>
                  <span style={{ fontSize: 48, fontWeight: 900, color: p.color }}>${p.price}</span>
                  <span style={{ fontSize: 16, color: '#94A3B8' }}>/mes</span>
                </div>
                <div style={{ fontSize: 14, color: '#64748B', marginBottom: 24, lineHeight: 2 }}>
                  <div>Hasta {p.users} usuarios</div>
                  <div>{p.products} productos</div>
                  <div>{p.invoices} facturas</div>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, marginBottom: 28 }}>
                  {p.features.map(f => (
                    <li key={f} style={{ fontSize: 14, color: '#374151', padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#10B981', fontWeight: 700 }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
                <button onClick={() => nav('/registro')} style={{
                  width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                  background: p.popular ? 'linear-gradient(135deg,#7C3AED,#EC4899)' : '#F1F5F9',
                  color: p.popular ? 'white' : '#374151',
                  fontSize: 15, fontWeight: 700, cursor: 'pointer',
                }}>Comenzar ahora</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact / CTA */}
      <section id="contacto" style={{
        padding: '100px 24px',
        background: 'linear-gradient(135deg,#1E1B4B 0%,#312E81 50%,#4C1D95 100%)',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(28px,3.5vw,42px)', fontWeight: 800, color: 'white', marginBottom: 16 }}>
            Lleva tu negocio al siguiente nivel
          </h2>
          <p style={{ fontSize: 18, color: '#C4B5FD', marginBottom: 40, lineHeight: 1.7 }}>
            Unete a las empresas que ya confian en NEXUS POS para gestionar su negocio de manera profesional.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
            <button onClick={() => nav('/registro')} style={{
              padding: '16px 40px', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg,#7C3AED,#EC4899)', color: 'white',
              fontSize: 17, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 8px 32px rgba(124,58,237,.4)',
            }}>Comenzar prueba gratuita</button>
            <a href="https://wa.me/593999999999?text=Hola%2C%20quiero%20información%20sobre%20NEXUS%20POS" target="_blank" rel="noopener"
              style={{
                padding: '16px 40px', borderRadius: 12, border: '1px solid rgba(255,255,255,.2)',
                background: 'rgba(37,211,102,.15)', color: '#25D366', textDecoration: 'none',
                fontSize: 17, fontWeight: 700, cursor: 'pointer', display: 'inline-block',
              }}>Escribenos por WhatsApp</a>
          </div>
          <div style={{ display: 'flex', gap: 32, justifyContent: 'center', flexWrap: 'wrap', color: '#94A3B8', fontSize: 14 }}>
            <span>info@nexuspos.ec</span>
            <span>+593 99 999 9999</span>
            <span>Guayaquil, Ecuador</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '32px 24px', background: '#0F172A', borderTop: '1px solid rgba(255,255,255,.05)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ color: '#64748B', fontSize: 13 }}>
            2026 NEXUS POS. Todos los derechos reservados.
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
