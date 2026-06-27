import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

export default function Registro() {
  const nav = useNavigate()
  const [form, setForm] = useState({
    empresa_nombre: '', ruc: '', email: '', telefono: '',
    admin_nombre: '', giro_negocio: '', ciudad: '',
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.empresa_nombre || !form.admin_nombre || !form.email || !form.telefono) {
      setError('Por favor completa todos los campos obligatorios'); return
    }
    setLoading(true)
    try {
      await api.post('/auth/solicitar-demo', form)
      setResult(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al enviar solicitud')
    } finally {
      setLoading(false)
    }
  }

  const inputS = {
    width: '100%', padding: '12px 16px', borderRadius: 10, fontSize: 14,
    border: '1px solid #D1D5DB', boxSizing: 'border-box', outline: 'none',
  }
  const labelS = { fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }

  if (result) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg,#0F172A 0%,#1E1B4B 40%,#312E81 70%,#4C1D95 100%)' }}>
        <div style={{ background: 'white', borderRadius: 20, padding: 40, maxWidth: 500, width: '90%', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28, color: '#059669' }}>
            &#10003;
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>Solicitud recibida</h2>
          <p style={{ color: '#64748B', marginBottom: 24, fontSize: 15, lineHeight: 1.7 }}>
            Gracias por tu interes en NEXUS. Nuestro equipo se pondra en contacto contigo
            en las proximas 24 horas para configurar tu cuenta personalizada.
          </p>
          <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 20, marginBottom: 24, textAlign: 'left', fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
            <div><strong>Empresa:</strong> {form.empresa_nombre}</div>
            <div><strong>Contacto:</strong> {form.admin_nombre}</div>
            <div><strong>Email:</strong> {form.email}</div>
            <div><strong>Telefono:</strong> {form.telefono}</div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <a href={`https://wa.me/593999038296?text=Hola%2C%20acabo%20de%20solicitar%20una%20demo%20de%20NEXUS%20para%20mi%20empresa%20${encodeURIComponent(form.empresa_nombre)}`}
              target="_blank" rel="noopener"
              style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', textDecoration: 'none',
                background: '#25D366', color: 'white', fontSize: 14, fontWeight: 700, textAlign: 'center', cursor: 'pointer' }}>
              Escribenos por WhatsApp
            </a>
            <button onClick={() => nav('/')} style={{
              flex: 1, padding: '12px', borderRadius: 12, border: '1px solid #D1D5DB',
              background: 'white', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg,#0F172A 0%,#1E1B4B 40%,#312E81 70%,#4C1D95 100%)',
      padding: '40px 16px' }}>
      <div style={{ background: 'white', borderRadius: 20, padding: '40px 36px', maxWidth: 540, width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#7C3AED,#EC4899)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 18, marginBottom: 12 }}>N</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>Solicita tu prueba gratuita</h1>
          <p style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.6 }}>
            Dejanos tus datos y nuestro equipo configurara tu sistema
            personalizado en menos de 24 horas.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelS}>Nombre de la empresa *</label>
              <input value={form.empresa_nombre} onChange={e => set('empresa_nombre', e.target.value)}
                placeholder="Mi Empresa S.A." required style={inputS} />
            </div>
            <div>
              <label style={labelS}>RUC / Cedula</label>
              <input value={form.ruc} onChange={e => set('ruc', e.target.value)}
                placeholder="0990123456001" style={inputS} />
            </div>
            <div>
              <label style={labelS}>Ciudad</label>
              <input value={form.ciudad} onChange={e => set('ciudad', e.target.value)}
                placeholder="Quito" style={inputS} />
            </div>
            <div>
              <label style={labelS}>Giro del negocio</label>
              <select value={form.giro_negocio} onChange={e => set('giro_negocio', e.target.value)}
                style={{...inputS, cursor: 'pointer'}}>
                <option value="">Seleccionar...</option>
                <option>Comercio / Tienda</option>
                <option>Restaurante / Alimentos</option>
                <option>Farmacia</option>
                <option>Ferreteria</option>
                <option>Tecnologia / Computacion</option>
                <option>Ropa / Calzado</option>
                <option>Produccion / Manufactura</option>
                <option>Servicios profesionales</option>
                <option>Distribucion / Logistica</option>
                <option>Salud / Clinica</option>
                <option>Educacion</option>
                <option>Otro</option>
              </select>
            </div>
            <div>
              <label style={labelS}>Nombre del contacto *</label>
              <input value={form.admin_nombre} onChange={e => set('admin_nombre', e.target.value)}
                placeholder="Juan Perez" required style={inputS} />
            </div>
            <div>
              <label style={labelS}>Email *</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="info@miempresa.com" required style={inputS} />
            </div>
            <div>
              <label style={labelS}>Telefono / WhatsApp *</label>
              <input value={form.telefono} onChange={e => set('telefono', e.target.value)}
                placeholder="099 903 8296" required style={inputS} />
            </div>
          </div>

          {error && <div style={{ padding: 12, background: '#FEE2E2', borderRadius: 8, color: '#DC2626', fontSize: 13, fontWeight: 600, marginBottom: 16, textAlign: 'center' }}>{error}</div>}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '14px', borderRadius: 12, border: 'none',
            background: loading ? '#9CA3AF' : 'linear-gradient(135deg,#7C3AED,#EC4899)',
            color: 'white', fontSize: 16, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
          }}>{loading ? 'Enviando...' : 'Solicitar prueba gratuita'}</button>

          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#94A3B8' }}>
            Ya tienes cuenta?{' '}
            <span onClick={() => nav('/login')} style={{ color: '#7C3AED', fontWeight: 600, cursor: 'pointer' }}>Iniciar sesion</span>
          </p>
        </form>
      </div>
    </div>
  )
}
