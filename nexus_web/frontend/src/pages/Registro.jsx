import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

export default function Registro() {
  const nav = useNavigate()
  const [form, setForm] = useState({
    empresa_nombre: '', ruc: '', email: '', telefono: '',
    admin_nombre: '', admin_username: '', admin_password: '', admin_password2: '',
    plan: 'BASICO',
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.admin_password !== form.admin_password2) {
      setError('Las contrasenas no coinciden'); return
    }
    if (form.admin_password.length < 6) {
      setError('La contrasena debe tener al menos 6 caracteres'); return
    }
    setLoading(true)
    try {
      const { data } = await api.post('/auth/registro', form)
      setResult(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al registrar')
    } finally {
      setLoading(false)
    }
  }

  const inputS = {
    width: '100%', padding: '12px 16px', borderRadius: 10, fontSize: 14,
    border: '1px solid #D1D5DB', boxSizing: 'border-box', outline: 'none',
    transition: 'border .2s',
  }
  const labelS = { fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }

  if (result) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg,#0F172A 0%,#1E1B4B 40%,#312E81 70%,#4C1D95 100%)' }}>
        <div style={{ background: 'white', borderRadius: 20, padding: 40, maxWidth: 500, width: '90%', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>
            &#10003;
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>Registro exitoso</h2>
          <p style={{ color: '#64748B', marginBottom: 24, fontSize: 15, lineHeight: 1.6 }}>
            Tu empresa ha sido creada. Guarda estos datos para iniciar sesion:
          </p>
          <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 20, marginBottom: 24, textAlign: 'left' }}>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>Codigo de empresa</span>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#7C3AED', letterSpacing: '.05em' }}>{result.codigo_empresa}</div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>Usuario</span>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>{result.username}</div>
            </div>
            <div style={{ padding: 10, background: '#FEF3C7', borderRadius: 8, fontSize: 12, color: '#92400E', marginTop: 12 }}>
              Anota tu codigo de empresa, lo necesitaras cada vez que inicies sesion.
            </div>
          </div>
          <button onClick={() => nav('/login')} style={{
            width: '100%', padding: '14px', borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg,#7C3AED,#EC4899)', color: 'white',
            fontSize: 16, fontWeight: 700, cursor: 'pointer',
          }}>Ir a iniciar sesion</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg,#0F172A 0%,#1E1B4B 40%,#312E81 70%,#4C1D95 100%)',
      padding: '40px 16px' }}>
      <div style={{ background: 'white', borderRadius: 20, padding: '40px 36px', maxWidth: 580, width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#7C3AED,#EC4899)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 18, marginBottom: 12 }}>N</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>Crea tu cuenta gratis</h1>
          <p style={{ fontSize: 14, color: '#94A3B8' }}>14 dias de prueba sin compromiso. Sin tarjeta de credito.</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Empresa */}
          <div style={{ fontSize: 14, fontWeight: 700, color: '#7C3AED', marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #EDE9FE' }}>
            Datos de tu empresa
          </div>
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
              <label style={labelS}>Telefono</label>
              <input value={form.telefono} onChange={e => set('telefono', e.target.value)}
                placeholder="099 123 4567" style={inputS} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelS}>Email de la empresa *</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="info@miempresa.com" required style={inputS} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelS}>Plan</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { id: 'BASICO', name: 'Basico', price: '$15/mes', desc: '3 usuarios' },
                  { id: 'PROFESIONAL', name: 'Profesional', price: '$35/mes', desc: '10 usuarios' },
                  { id: 'EMPRESARIAL', name: 'Empresarial', price: '$75/mes', desc: '50 usuarios' },
                ].map(p => (
                  <button key={p.id} type="button" onClick={() => set('plan', p.id)} style={{
                    flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                    border: form.plan === p.id ? '2px solid #7C3AED' : '1px solid #E5E7EB',
                    background: form.plan === p.id ? '#F5F3FF' : 'white',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: form.plan === p.id ? '#7C3AED' : '#374151' }}>{p.name}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: form.plan === p.id ? '#7C3AED' : '#0F172A' }}>{p.price}</div>
                    <div style={{ fontSize: 10, color: '#94A3B8' }}>{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Admin */}
          <div style={{ fontSize: 14, fontWeight: 700, color: '#7C3AED', marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #EDE9FE' }}>
            Tu cuenta de administrador
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelS}>Nombre completo *</label>
              <input value={form.admin_nombre} onChange={e => set('admin_nombre', e.target.value)}
                placeholder="Juan Perez" required style={inputS} />
            </div>
            <div>
              <label style={labelS}>Usuario *</label>
              <input value={form.admin_username} onChange={e => set('admin_username', e.target.value)}
                placeholder="jperez" required style={inputS} />
            </div>
            <div>
              <label style={labelS}>&nbsp;</label>
              <div style={{ fontSize: 11, color: '#94A3B8', padding: '12px 0' }}>Este sera tu usuario para entrar al sistema</div>
            </div>
            <div>
              <label style={labelS}>Contrasena *</label>
              <input type="password" value={form.admin_password} onChange={e => set('admin_password', e.target.value)}
                placeholder="Minimo 6 caracteres" required style={inputS} />
            </div>
            <div>
              <label style={labelS}>Confirmar contrasena *</label>
              <input type="password" value={form.admin_password2} onChange={e => set('admin_password2', e.target.value)}
                placeholder="Repite tu contrasena" required style={inputS} />
            </div>
          </div>

          {error && <div style={{ padding: 12, background: '#FEE2E2', borderRadius: 8, color: '#DC2626', fontSize: 13, fontWeight: 600, marginBottom: 16, textAlign: 'center' }}>{error}</div>}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '14px', borderRadius: 12, border: 'none',
            background: loading ? '#9CA3AF' : 'linear-gradient(135deg,#7C3AED,#EC4899)',
            color: 'white', fontSize: 16, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
          }}>{loading ? 'Creando tu empresa...' : 'Registrarme gratis'}</button>

          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#94A3B8' }}>
            Ya tienes cuenta?{' '}
            <span onClick={() => nav('/login')} style={{ color: '#7C3AED', fontWeight: 600, cursor: 'pointer' }}>Iniciar sesion</span>
          </p>
        </form>
      </div>
    </div>
  )
}
