import { useState } from 'react'
import api from '../api'

export default function Login() {
  const [form, setForm]   = useState({ username: '', password: '', empresa_codigo: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showEmpresa, setShowEmpresa] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const body = new URLSearchParams({
        username: form.username,
        password: form.password,
        empresa_codigo: form.empresa_codigo || '',
      })
      const { data } = await api.post('/auth/login', body)
      localStorage.setItem('nexus_token', data.access_token)
      localStorage.setItem('nexus_user',  JSON.stringify(data.user))
      window.location.href = '/dashboard'
    } catch (err) {
      setError(err.response?.data?.detail || 'Error de conexion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg,#0F172A 0%,#1E293B 40%,#1E3A5F 70%,#2563EB 100%)',
      backgroundSize: '400% 400%',
      animation: 'gradientShift 12s ease infinite',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Subtle background orbs */}
      <div style={{
        position:'absolute', width:400, height:400, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(59,130,246,.15) 0%, transparent 70%)',
        top:'-10%', right:'-5%', pointerEvents:'none',
      }}/>
      <div style={{
        position:'absolute', width:300, height:300, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(139,92,246,.1) 0%, transparent 70%)',
        bottom:'-5%', left:'-3%', pointerEvents:'none',
      }}/>

      <div style={{
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(20px)',
        borderRadius: 20, padding: 44,
        width: 400, boxShadow: '0 25px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,.1)',
        animation: 'floatCard 6s ease-in-out infinite, fadeIn 0.5s ease-out',
        position: 'relative', zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 60, height: 60, margin: '0 auto 14px',
            background: 'linear-gradient(135deg,#2563EB,#7C3AED)',
            borderRadius: 16, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 800, fontSize: 26,
            boxShadow: '0 8px 24px rgba(37,99,235,.35)',
          }}>N</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.02em' }}>NEXUS POS</h1>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
            Sistema de gestion Ecuador
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Toggle empresa field */}
          <div style={{ textAlign: 'right', marginBottom: 8 }}>
            <button type="button" onClick={() => setShowEmpresa(!showEmpresa)}
              style={{
                background: 'none', border: 'none', color: '#6B7280',
                fontSize: 11, cursor: 'pointer', textDecoration: 'underline',
                padding: 0,
              }}>
              {showEmpresa ? 'Ocultar codigo empresa' : 'Acceso multi-empresa'}
            </button>
          </div>
          {showEmpresa && (
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                Codigo de empresa
              </label>
              <input
                type="text"
                placeholder="Ej: 001 (vacio = empresa principal)"
                value={form.empresa_codigo}
                onChange={e => setForm({...form, empresa_codigo: e.target.value})}
                style={{
                  fontSize: 14, padding: '11px 14px', borderRadius: 10,
                  border: '1.5px solid #E5E7EB', background: '#F9FAFB',
                  transition: 'all 0.2s ease', width: '100%', boxSizing: 'border-box',
                }}
                onFocus={e => {
                  e.target.style.borderColor = '#8B5CF6'
                  e.target.style.boxShadow = '0 0 0 3px rgba(139,92,246,.12)'
                  e.target.style.background = '#FFFFFF'
                }}
                onBlur={e => {
                  e.target.style.borderColor = '#E5E7EB'
                  e.target.style.boxShadow = 'none'
                  e.target.style.background = '#F9FAFB'
                }}
              />
            </div>
          )}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Usuario
            </label>
            <input
              type="text"
              placeholder="Ingresa tu usuario"
              value={form.username}
              onChange={e => setForm({...form, username: e.target.value})}
              required
              style={{
                fontSize: 14, padding: '11px 14px', borderRadius: 10,
                border: '1.5px solid #E5E7EB', background: '#F9FAFB',
                transition: 'all 0.2s ease',
              }}
              onFocus={e => {
                e.target.style.borderColor = '#3B82F6'
                e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,.12)'
                e.target.style.background = '#FFFFFF'
              }}
              onBlur={e => {
                e.target.style.borderColor = '#E5E7EB'
                e.target.style.boxShadow = 'none'
                e.target.style.background = '#F9FAFB'
              }}
            />
          </div>
          <div style={{ marginBottom: 26 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Contrasena
            </label>
            <input
              type="password"
              placeholder="Ingresa tu contrasena"
              value={form.password}
              onChange={e => setForm({...form, password: e.target.value})}
              required
              style={{
                fontSize: 14, padding: '11px 14px', borderRadius: 10,
                border: '1.5px solid #E5E7EB', background: '#F9FAFB',
                transition: 'all 0.2s ease',
              }}
              onFocus={e => {
                e.target.style.borderColor = '#3B82F6'
                e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,.12)'
                e.target.style.background = '#FFFFFF'
              }}
              onBlur={e => {
                e.target.style.borderColor = '#E5E7EB'
                e.target.style.boxShadow = 'none'
                e.target.style.background = '#F9FAFB'
              }}
            />
          </div>
          {error && (
            <div style={{
              background: '#FEE2E2', color: '#DC2626', padding: '10px 14px',
              borderRadius: 10, fontSize: 13, marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 8,
              border: '1px solid rgba(220,38,38,.2)',
            }}>
              <span style={{fontSize:15}}>!</span>
              {error}
            </div>
          )}
          <button type="submit" className="btn btn-primary"
            style={{
              width: '100%', justifyContent: 'center', padding: '13px',
              fontSize: 14, borderRadius: 10,
              boxShadow: loading ? 'none' : '0 4px 14px rgba(37,99,235,.35)',
              opacity: loading ? 0.8 : 1,
            }}
            disabled={loading}>
            {loading ? (
              <span style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{
                  width:16, height:16, border:'2px solid rgba(255,255,255,.3)',
                  borderTopColor:'white', borderRadius:'50%',
                  display:'inline-block', animation:'spin 0.8s linear infinite',
                }}/>
                Iniciando sesion...
              </span>
            ) : 'Iniciar sesion'}
          </button>
        </form>

        {/* Footer */}
        <div style={{
          textAlign:'center', marginTop:28, paddingTop:18,
          borderTop:'1px solid #F3F4F6',
        }}>
          <span style={{fontSize:11, color:'#9CA3AF', letterSpacing:'.02em'}}>
            Powered by NEXUS POS v2.0
          </span>
        </div>
      </div>

      <style>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes floatCard {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
