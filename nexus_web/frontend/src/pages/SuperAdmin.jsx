import { useState, useEffect } from 'react'
import api from '../api'

export default function SuperAdmin() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [empresas, setEmpresas] = useState([])
  const [planes, setPlanes] = useState([])
  const [tab, setTab] = useState('empresas')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createMsg, setCreateMsg] = useState('')
  const [newEmp, setNewEmp] = useState({ codigo: '', nombre: '', ruc: '', email: '', plan: 'BASICO', admin_nombre: '', admin_username: '', admin_password: '', admin_email: '', dias_prueba: 15 })
  const [editEmp, setEditEmp] = useState(null)
  const [saToken, setSaToken] = useState(localStorage.getItem('nexus_sa_token') || '')

  useEffect(() => {
    if (saToken) {
      setLoggedIn(true)
      loadData()
    }
  }, [saToken])

  async function handleLogin(e) {
    e.preventDefault()
    setLoginError('')
    try {
      const body = new URLSearchParams(loginForm)
      const { data } = await api.post('/superadmin/login', body)
      localStorage.setItem('nexus_sa_token', data.access_token)
      setSaToken(data.access_token)
    } catch (err) {
      setLoginError(err.response?.data?.detail || 'Error de autenticacion')
    }
  }

  function saApi() {
    const h = { Authorization: `Bearer ${saToken}` }
    return {
      get: (url) => api.get(url, { headers: h }),
      post: (url, data, config) => api.post(url, data, { ...config, headers: { ...h, ...(config?.headers || {}) } }),
      put: (url, data) => api.put(url, data, { headers: h }),
      patch: (url, data) => api.patch(url, data, { headers: h }),
      delete: (url) => api.delete(url, { headers: h }),
    }
  }
  const sa = saToken ? saApi() : null

  async function loadData() {
    try {
      const sa = saApi()
      const [empRes, planRes] = await Promise.all([
        sa.get('/superadmin/empresas'),
        sa.get('/superadmin/planes'),
      ])
      setEmpresas(empRes.data)
      setPlanes(planRes.data)
    } catch (err) {
      console.error('Error loading data:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('nexus_sa_token')
        setSaToken('')
        setLoggedIn(false)
      }
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true)
    setCreateMsg('')
    try {
      const sa = saApi()
      const { data } = await sa.post('/superadmin/empresas', newEmp, {
        headers: { 'Content-Type': 'application/json' }
      })
      setCreateMsg(data.msg || 'Empresa creada exitosamente')
      setNewEmp({ codigo: '', nombre: '', ruc: '', email: '', plan: 'BASICO', admin_nombre: '', admin_username: '', admin_password: '', admin_email: '' })
      setShowCreate(false)
      loadData()
    } catch (err) {
      setCreateMsg('Error: ' + (err.response?.data?.detail || err.message))
    } finally {
      setCreating(false)
    }
  }

  async function toggleEmpresa(id) {
    try {
      const sa = saApi()
      await sa.patch(`/superadmin/empresas/${id}/toggle`)
      loadData()
    } catch (err) {
      alert('Error: ' + (err.response?.data?.detail || err.message))
    }
  }

  function handleLogout() {
    localStorage.removeItem('nexus_sa_token')
    setSaToken('')
    setLoggedIn(false)
  }

  const inputStyle = {
    fontSize: 14, padding: '10px 14px', borderRadius: 8,
    border: '1.5px solid #E5E7EB', background: '#F9FAFB',
    width: '100%', boxSizing: 'border-box',
  }

  // ── Login form ──
  if (!loggedIn) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg,#1E1B4B 0%,#312E81 50%,#4C1D95 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.97)', borderRadius: 20, padding: 44,
          width: 400, boxShadow: '0 25px 80px rgba(0,0,0,0.4)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              width: 56, height: 56, margin: '0 auto 12px',
              background: 'linear-gradient(135deg,#7C3AED,#DB2777)',
              borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 800, fontSize: 22,
            }}>SA</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1E293B' }}>NEXUS Super Admin</h1>
            <p style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>Panel de administracion multi-empresa</p>
          </div>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Usuario</label>
              <input type="text" value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})}
                placeholder="superadmin" required style={inputStyle} />
            </div>
            <div style={{ marginBottom: 22 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Contrasena</label>
              <input type="password" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                required style={inputStyle} />
            </div>
            {loginError && (
              <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
                {loginError}
              </div>
            )}
            <button type="submit" style={{
              width: '100%', padding: 13, fontSize: 14, fontWeight: 600, color: 'white',
              background: 'linear-gradient(135deg,#7C3AED,#DB2777)', border: 'none',
              borderRadius: 10, cursor: 'pointer',
            }}>Iniciar sesion</button>
          </form>
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <a href="/login" style={{ fontSize: 12, color: '#6B7280', textDecoration: 'underline' }}>Ir al login normal</a>
          </div>
        </div>
      </div>
    )
  }

  // ── Dashboard ──
  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg,#1E1B4B,#312E81)',
        padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, background: 'linear-gradient(135deg,#7C3AED,#DB2777)',
            borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 800, fontSize: 14,
          }}>SA</div>
          <span style={{ color: 'white', fontWeight: 700, fontSize: 18 }}>NEXUS Super Admin</span>
        </div>
        <button onClick={handleLogout} style={{
          background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none',
          padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
        }}>Cerrar sesion</button>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
        {/* Stats cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
            <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>Total Empresas</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#1E293B', marginTop: 4 }}>{empresas.length}</div>
          </div>
          <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
            <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>Empresas Activas</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#10B981', marginTop: 4 }}>{empresas.filter(e => e.activa).length}</div>
          </div>
          <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
            <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>Planes Disponibles</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#3B82F6', marginTop: 4 }}>{planes.length}</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[{id:'solicitudes',label:'Solicitudes'},{id:'empresas',label:'Empresas'},{id:'suscripciones',label:'Suscripciones'},{id:'planes',label:'Planes'}].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 13,
              background: tab === t.id ? '#312E81' : 'white',
              color: tab === t.id ? 'white' : '#374151',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Solicitudes tab */}
        {tab === 'solicitudes' && <TabSolicitudes sa={sa} />}

        {createMsg && (
          <div style={{
            padding: '12px 16px', borderRadius: 10, marginBottom: 16, fontSize: 13,
            background: createMsg.startsWith('Error') ? '#FEE2E2' : '#D1FAE5',
            color: createMsg.startsWith('Error') ? '#DC2626' : '#065F46',
          }}>{createMsg}</div>
        )}

        {/* Empresas tab */}
        {tab === 'empresas' && (
          <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Empresas registradas</h2>
              <button onClick={() => setShowCreate(!showCreate)} style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: '#7C3AED', color: 'white', fontWeight: 600, fontSize: 13,
              }}>{showCreate ? 'Cancelar' : '+ Nueva empresa'}</button>
            </div>

            {showCreate && (
              <div style={{ padding: 20, borderBottom: '1px solid #F3F4F6', background: '#FAFAFA' }}>
                <form onSubmit={handleCreate}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Datos de la empresa</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Codigo *</label>
                      <input value={newEmp.codigo} onChange={e => setNewEmp({...newEmp, codigo: e.target.value})}
                        placeholder="001" required style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Nombre empresa *</label>
                      <input value={newEmp.nombre} onChange={e => setNewEmp({...newEmp, nombre: e.target.value})}
                        placeholder="Mi Empresa S.A." required style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>RUC</label>
                      <input value={newEmp.ruc} onChange={e => setNewEmp({...newEmp, ruc: e.target.value})}
                        placeholder="0990123456001" style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Email empresa</label>
                      <input value={newEmp.email} onChange={e => setNewEmp({...newEmp, email: e.target.value})}
                        placeholder="empresa@mail.com" type="email" style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Plan</label>
                      <select value={newEmp.plan} onChange={e => setNewEmp({...newEmp, plan: e.target.value})}
                        style={{...inputStyle, cursor: 'pointer'}}>
                        {planes.map(p => <option key={p.nombre} value={p.nombre}>{p.nombre} - ${p.precio_mensual}/mes</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Dias de prueba</label>
                      <select value={newEmp.dias_prueba} onChange={e => setNewEmp({...newEmp, dias_prueba: parseInt(e.target.value)})}
                        style={{...inputStyle, cursor: 'pointer'}}>
                        <option value={7}>7 dias</option>
                        <option value={15}>15 dias</option>
                        <option value={30}>30 dias</option>
                        <option value={60}>60 dias</option>
                        <option value={0}>Sin limite</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Administrador de la empresa</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Nombre completo *</label>
                      <input value={newEmp.admin_nombre} onChange={e => setNewEmp({...newEmp, admin_nombre: e.target.value})}
                        placeholder="Juan Perez" required style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Usuario *</label>
                      <input value={newEmp.admin_username} onChange={e => setNewEmp({...newEmp, admin_username: e.target.value})}
                        placeholder="jperez" required style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Contrasena *</label>
                      <input value={newEmp.admin_password} onChange={e => setNewEmp({...newEmp, admin_password: e.target.value})}
                        placeholder="********" type="password" required style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Email admin</label>
                      <input value={newEmp.admin_email} onChange={e => setNewEmp({...newEmp, admin_email: e.target.value})}
                        placeholder="admin@empresa.com" type="email" style={inputStyle} />
                    </div>
                  </div>
                  <button type="submit" disabled={creating} style={{
                    padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: '#10B981', color: 'white', fontWeight: 600, fontSize: 13,
                    opacity: creating ? 0.6 : 1,
                  }}>{creating ? 'Creando base de datos...' : 'Crear empresa'}</button>
                </form>
              </div>
            )}

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F3F4F6', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left' }}>Codigo</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left' }}>Nombre</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left' }}>RUC</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left' }}>Base de datos</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left' }}>Plan</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center' }}>Usuarios</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center' }}>Estado</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {empresas.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>No hay empresas registradas</td></tr>
                ) : empresas.map(emp => (
                  <tr key={emp.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 13, color: '#1F2937' }}>{emp.codigo}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#111827' }}>{emp.nombre}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151' }}>{emp.ruc || '-'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <code style={{ fontSize: 11, background: '#EDE9FE', color: '#5B21B6', padding: '3px 8px', borderRadius: 4, fontWeight: 600 }}>{emp.db_name}</code>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151', fontWeight: 600 }}>{emp.plan || '-'}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#1F2937' }}>{emp.usuarios_activos || 0}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                        background: emp.activa ? '#D1FAE5' : '#FEE2E2',
                        color: emp.activa ? '#065F46' : '#DC2626',
                      }}>{emp.activa ? 'ACTIVA' : 'INACTIVA'}</span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button onClick={() => setEditEmp(emp)} style={{
                          padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                          fontSize: 11, fontWeight: 600, background: '#EDE9FE', color: '#7C3AED',
                        }}>Editar</button>
                        <button onClick={() => toggleEmpresa(emp.id)} style={{
                          padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                          fontSize: 11, fontWeight: 600,
                          background: emp.activa ? '#FEE2E2' : '#D1FAE5',
                          color: emp.activa ? '#DC2626' : '#065F46',
                        }}>{emp.activa ? 'Desactivar' : 'Activar'}</button>
                        <button onClick={async () => {
                          if (!confirm('ELIMINAR empresa "' + emp.nombre + '"? Se borrara la base de datos completa. Esta accion no se puede deshacer.')) return
                          try { await sa.delete('/superadmin/empresas/' + emp.id); loadData() }
                          catch (e) { alert('Error: ' + (e.response?.data?.detail || e.message)) }
                        }} style={{
                          padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                          fontSize: 11, fontWeight: 600, background: '#7F1D1D', color: 'white',
                        }}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal Editar Empresa */}
        {editEmp && <ModalEditEmpresa emp={editEmp} sa={sa} planes={planes}
          onClose={() => setEditEmp(null)} onSaved={() => { setEditEmp(null); loadData() }} />}

        {/* Suscripciones tab */}
        {tab === 'suscripciones' && <TabSuscripciones sa={sa} />}

        {/* Planes tab */}
        {tab === 'planes' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
              {planes.map(plan => (
                <PlanCard key={plan.id} plan={plan} sa={sa} onUpdate={async()=>{const r=await sa.get('/superadmin/planes');setPlanes(r.data)}} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PlanCard({ plan, sa, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [f, setF] = useState({...plan})
  const guardar = async () => {
    try {
      const params = new URLSearchParams({
        nombre: f.nombre, max_usuarios: f.max_usuarios,
        max_productos: f.max_productos, max_facturas_mes: f.max_facturas_mes,
        precio_mensual: f.precio_mensual,
      })
      await sa.put(`/superadmin/planes/${plan.id}?${params}`, {})
      setEditing(false)
      onUpdate()
    } catch(e) { alert(e.response?.data?.detail || e.message) }
  }
  return (
    <div style={{
      background: 'white', borderRadius: 12, padding: 24,
      boxShadow: '0 1px 3px rgba(0,0,0,.08)',
      border: editing ? '2px solid #7C3AED' : '1px solid #E5E7EB',
    }}>
      {!editing ? (
        <>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>{plan.nombre}</h3>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#7C3AED', marginBottom: 16, textAlign: 'center' }}>
            ${plan.precio_mensual}<span style={{ fontSize: 14, color: '#6B7280' }}>/mes</span>
          </div>
          <div style={{ fontSize: 13, color: '#374151', lineHeight: 2, textAlign: 'center' }}>
            <div>Hasta {plan.max_usuarios} usuarios</div>
            <div>Hasta {plan.max_productos >= 99999 ? 'ilimitados' : plan.max_productos.toLocaleString()} productos</div>
            <div>Hasta {plan.max_facturas_mes >= 99999 ? 'ilimitadas' : plan.max_facturas_mes.toLocaleString()} facturas/mes</div>
          </div>
          <button onClick={() => { setF({...plan}); setEditing(true) }}
            style={{ marginTop: 12, width: '100%', padding: '8px', borderRadius: 8, border: '1px solid #D1D5DB',
              background: '#F9FAFB', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#374151' }}>
            Editar plan
          </button>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              {k:'nombre', l:'Nombre', type:'text'},
              {k:'precio_mensual', l:'Precio mensual ($)', type:'number'},
              {k:'max_usuarios', l:'Max usuarios', type:'number'},
              {k:'max_productos', l:'Max productos', type:'number'},
              {k:'max_facturas_mes', l:'Max facturas/mes', type:'number'},
            ].map(({k,l,type}) => (
              <div key={k}>
                <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>{l}</label>
                <input type={type} value={f[k]}
                  onChange={e => setF(p => ({...p, [k]: type==='number' ? parseFloat(e.target.value)||0 : e.target.value}))}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={guardar}
              style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: '#7C3AED',
                color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              Guardar
            </button>
            <button onClick={() => setEditing(false)}
              style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid #D1D5DB',
                background: 'white', cursor: 'pointer', fontSize: 12, color: '#6B7280' }}>
              Cancelar
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function TabSuscripciones({ sa }) {
  const [data, setData] = useState(null)
  const [showPago, setShowPago] = useState(null)
  const [pagoForm, setPagoForm] = useState({ monto: 0, metodo: 'TRANSFERENCIA', referencia: '', meses: 1, observaciones: '' })
  const [historial, setHistorial] = useState([])
  const [showHist, setShowHist] = useState(null)

  useEffect(() => { cargar() }, [])
  async function cargar() {
    if (!sa) return
    try { const r = await sa.get('/superadmin/suscripciones'); setData(r.data) } catch {}
  }

  async function registrarPago() {
    try {
      const params = new URLSearchParams({
        empresa_id: showPago.id, monto: pagoForm.monto, metodo: pagoForm.metodo,
        referencia: pagoForm.referencia, meses: pagoForm.meses, observaciones: pagoForm.observaciones,
      })
      await sa.post(`/superadmin/pagos?${params}`, {})
      alert('Pago registrado')
      setShowPago(null)
      cargar()
    } catch (e) { alert(e.response?.data?.detail || e.message) }
  }

  async function verificarVencimientos() {
    try {
      const r = await sa.post('/superadmin/verificar-vencimientos', {})
      alert(r.data.msg)
      cargar()
    } catch (e) { alert(e.response?.data?.detail || e.message) }
  }

  async function verHistorial(eid) {
    try {
      const r = await sa.get(`/superadmin/pagos/${eid}/historial`)
      setHistorial(r.data)
      setShowHist(eid)
    } catch {}
  }

  if (!data) return <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>Cargando...</div>

  const colEstado = { ACTIVA: '#10B981', POR_VENCER: '#F59E0B', VENCIDA: '#EF4444', SIN_FECHA: '#6B7280' }
  const res = data.resumen || {}

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { l: 'Total Empresas', v: res.total_empresas, c: '#3B82F6' },
          { l: 'Activas', v: res.activas, c: '#10B981' },
          { l: 'Por Vencer', v: res.por_vencer, c: '#F59E0B' },
          { l: 'Vencidas', v: res.vencidas, c: '#EF4444' },
          { l: 'Ingresos Totales', v: `$${(res.ingresos_totales||0).toFixed(2)}`, c: '#7C3AED' },
        ].map((k, i) => (
          <div key={i} style={{ background: 'white', borderRadius: 10, padding: 16, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: k.c }}>{k.v}</div>
            <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ marginBottom: 16 }}>
        <button onClick={verificarVencimientos}
          style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#EF4444',
            color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
          Verificar Vencimientos (desactivar expiradas)
        </button>
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              {['Empresa', 'Plan', 'Precio', 'Vencimiento', 'Días', 'Estado', 'Pagos', 'Total Pagado', 'Acciones'].map(h => (
                <th key={h} style={{ padding: '10px 12px', fontWeight: 700, fontSize: 11, color: '#374151', textAlign: 'left', background: '#F3F4F6' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data.empresas || []).map(e => (
              <tr key={e.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ fontWeight: 700, color: '#111827' }}>{e.nombre}</div>
                  <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>{e.codigo}</div>
                </td>
                <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1F2937' }}>{e.plan}</td>
                <td style={{ padding: '10px 12px', fontWeight: 700, color: '#7C3AED' }}>${e.precio_mensual || 0}</td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: '#1F2937', fontWeight: 600 }}>{e.fecha_vencimiento ? String(e.fecha_vencimiento).slice(0, 10) : '—'}</td>
                <td style={{ padding: '10px 12px', fontWeight: 700, color: colEstado[e.estado_suscripcion] || '#6B7280' }}>
                  {e.dias_restantes != null ? `${e.dias_restantes}d` : '—'}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: `${colEstado[e.estado_suscripcion] || '#6B7280'}18`,
                    color: colEstado[e.estado_suscripcion] || '#6B7280' }}>
                    {(e.estado_suscripcion || '').replace('_', ' ')}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', fontWeight: 700, color: '#1F2937' }}>{e.total_pagos}</td>
                <td style={{ padding: '10px 12px', fontWeight: 700, color: '#059669' }}>${Number(e.total_pagado || 0).toFixed(2)}</td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => { setShowPago(e); setPagoForm({ monto: e.precio_mensual || 0, metodo: 'TRANSFERENCIA', referencia: '', meses: 1, observaciones: '' }) }}
                      style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#059669', color: 'white', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                      Pago
                    </button>
                    <button onClick={() => verHistorial(e.id)}
                      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #D1D5DB', background: 'white', cursor: 'pointer', fontSize: 11, color: '#374151' }}>
                      Historial
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Pago */}
      {showPago && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000 }}
          onClick={() => setShowPago(null)}>
          <div style={{ background: 'white', borderRadius: 16, padding: 28, width: 420 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16 }}>Registrar Pago — {showPago.nombre}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Monto ($)</label>
                <input type="number" value={pagoForm.monto} onChange={e => setPagoForm(p => ({ ...p, monto: parseFloat(e.target.value) || 0 }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, fontWeight: 700, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Meses</label>
                <select value={pagoForm.meses} onChange={e => setPagoForm(p => ({ ...p, meses: parseInt(e.target.value) }))}
                  style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, boxSizing: 'border-box' }}>
                  {[1, 2, 3, 6, 12].map(m => <option key={m} value={m}>{m} {m === 1 ? 'mes' : 'meses'}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Método</label>
                <select value={pagoForm.metodo} onChange={e => setPagoForm(p => ({ ...p, metodo: e.target.value }))}
                  style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, boxSizing: 'border-box' }}>
                  {['TRANSFERENCIA', 'EFECTIVO', 'TARJETA', 'DEPOSITO', 'PAYPHONE'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Referencia</label>
                <input value={pagoForm.referencia} onChange={e => setPagoForm(p => ({ ...p, referencia: e.target.value }))}
                  placeholder="N° transferencia, comprobante..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Observaciones</label>
                <textarea value={pagoForm.observaciones} onChange={e => setPagoForm(p => ({ ...p, observaciones: e.target.value }))}
                  rows={2} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={registrarPago}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#10B981', color: 'white', cursor: 'pointer', fontWeight: 700 }}>
                Registrar Pago
              </button>
              <button onClick={() => setShowPago(null)}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #D1D5DB', background: 'white', cursor: 'pointer', color: '#6B7280' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Historial */}
      {showHist && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000 }}
          onClick={() => setShowHist(null)}>
          <div style={{ background: 'white', borderRadius: 16, padding: 28, width: 560, maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16 }}>Historial de Pagos</h3>
            {historial.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF' }}>Sin pagos registrados</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #E5E7EB', background: '#F3F4F6' }}>
                    {['Fecha', 'Monto', 'Metodo', 'Meses', 'Periodo', 'Referencia'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, color: '#374151', fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historial.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                      <td style={{ padding: '8px 10px', color: '#1F2937', fontWeight: 600 }}>{String(p.fecha).slice(0, 10)}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: '#059669' }}>${Number(p.monto).toFixed(2)}</td>
                      <td style={{ padding: '8px 10px', color: '#1F2937' }}>{p.metodo}</td>
                      <td style={{ padding: '8px 10px', color: '#1F2937', fontWeight: 600 }}>{p.meses_pagados}</td>
                      <td style={{ padding: '8px 10px', fontSize: 12, color: '#374151' }}>{String(p.periodo_inicio).slice(0, 10)} - {String(p.periodo_fin).slice(0, 10)}</td>
                      <td style={{ padding: '8px 10px', color: '#374151' }}>{p.referencia || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button onClick={() => setShowHist(null)}
              style={{ marginTop: 16, width: '100%', padding: '8px', borderRadius: 8, border: '1px solid #D1D5DB', background: 'white', cursor: 'pointer' }}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ModalEditEmpresa({ emp, sa, planes, onClose, onSaved }) {
  const [tab, setTab] = useState('datos')
  const [form, setForm] = useState({ nombre: emp.nombre || '', ruc: emp.ruc || '', email: emp.email || '', plan: emp.plan || 'BASICO' })
  const [adminForm, setAdminForm] = useState({ admin_nombre: '', admin_username: '', admin_password: '', admin_email: '' })
  const [adminActual, setAdminActual] = useState(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (sa) sa.get(`/superadmin/empresas/${emp.id}/admin`).then(r => {
      setAdminActual(r.data)
      setAdminForm(f => ({ ...f, admin_nombre: r.data.nombre || '', admin_username: r.data.username || '', admin_email: r.data.email || '' }))
    }).catch(() => {})
  }, [])

  const inputS = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, boxSizing: 'border-box' }
  const labelS = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }

  async function guardarDatos() {
    try {
      await sa.put(`/superadmin/empresas/${emp.id}`, form)
      setMsg('Datos actualizados')
      setTimeout(onSaved, 800)
    } catch (e) { setMsg('Error: ' + (e.response?.data?.detail || e.message)) }
  }

  async function resetAdmin() {
    if (!adminForm.admin_username || !adminForm.admin_nombre) {
      setMsg('Nombre y usuario son obligatorios'); return
    }
    try {
      const r = await sa.post(`/superadmin/empresas/${emp.id}/reset-admin`, adminForm)
      setMsg(r.data.msg)
    } catch (e) { setMsg('Error: ' + (e.response?.data?.detail || e.message)) }
  }

  function generarPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    let pw = ''
    for (let i = 0; i < 8; i++) pw += chars[Math.floor(Math.random() * chars.length)]
    setAdminForm(p => ({...p, admin_password: pw}))
    setMsg(`Nueva contrasena generada: ${pw}  —  Guardale y enviala al cliente`)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000 }}
      onClick={onClose}>
      <div style={{ background: 'white', borderRadius: 16, padding: 28, width: 520, maxHeight: '85vh', overflow: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: '#111827' }}>Editar: {emp.nombre}</h3>
          <code style={{ fontSize: 11, background: '#EDE9FE', color: '#5B21B6', padding: '3px 8px', borderRadius: 4 }}>{emp.codigo}</code>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {[{id:'datos',label:'Datos Empresa'},{id:'admin',label:'Admin / Contrasena'}].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 12,
              background: tab === t.id ? '#7C3AED' : '#F3F4F6',
              color: tab === t.id ? 'white' : '#374151',
            }}>{t.label}</button>
          ))}
        </div>

        {tab === 'datos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={labelS}>Nombre empresa</label>
              <input value={form.nombre} onChange={e => setForm(p => ({...p, nombre: e.target.value}))} style={inputS} />
            </div>
            <div>
              <label style={labelS}>RUC</label>
              <input value={form.ruc} onChange={e => setForm(p => ({...p, ruc: e.target.value}))} style={inputS} />
            </div>
            <div>
              <label style={labelS}>Email</label>
              <input value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} type="email" style={inputS} />
            </div>
            <div>
              <label style={labelS}>Plan</label>
              <select value={form.plan} onChange={e => setForm(p => ({...p, plan: e.target.value}))} style={{...inputS, cursor: 'pointer'}}>
                {planes.map(p => <option key={p.nombre} value={p.nombre}>{p.nombre} - ${p.precio_mensual}/mes</option>)}
              </select>
            </div>
            <button onClick={guardarDatos}
              style={{ padding: '10px', borderRadius: 8, border: 'none', background: '#7C3AED', color: 'white', cursor: 'pointer', fontWeight: 700, marginTop: 4 }}>
              Guardar cambios
            </button>
          </div>
        )}

        {tab === 'admin' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {adminActual && adminActual.username && (
              <div style={{ padding: 14, background: '#EDE9FE', borderRadius: 8, fontSize: 13 }}>
                <div style={{ fontWeight: 700, color: '#5B21B6', marginBottom: 4 }}>Admin actual:</div>
                <div style={{ color: '#374151' }}><strong>Usuario:</strong> {adminActual.username}</div>
                <div style={{ color: '#374151' }}><strong>Nombre:</strong> {adminActual.nombre}</div>
                <div style={{ color: '#374151' }}><strong>Email:</strong> {adminActual.email || '-'}</div>
                <div style={{ color: '#9CA3AF', fontSize: 11, marginTop: 4 }}>La contrasena no se puede ver por seguridad</div>
              </div>
            )}
            <div style={{ padding: 12, background: '#FEF3C7', borderRadius: 8, fontSize: 12, color: '#92400E', fontWeight: 500 }}>
              Cambia las credenciales del admin. Deja la contrasena vacia para mantener la actual.
            </div>
            <div>
              <label style={labelS}>Nombre completo *</label>
              <input value={adminForm.admin_nombre} onChange={e => setAdminForm(p => ({...p, admin_nombre: e.target.value}))}
                placeholder="Juan Perez" style={inputS} />
            </div>
            <div>
              <label style={labelS}>Usuario *</label>
              <input value={adminForm.admin_username} onChange={e => setAdminForm(p => ({...p, admin_username: e.target.value}))}
                placeholder="jperez" style={inputS} />
            </div>
            <div>
              <label style={labelS}>Nueva contrasena (vacia = mantener actual)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={adminForm.admin_password} onChange={e => setAdminForm(p => ({...p, admin_password: e.target.value}))}
                  placeholder="Dejar vacio para no cambiar" style={{...inputS, flex: 1}} />
                <button onClick={generarPassword} type="button"
                  style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#3B82F6', color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                  Generar
                </button>
              </div>
            </div>
            <div>
              <label style={labelS}>Email</label>
              <input value={adminForm.admin_email} onChange={e => setAdminForm(p => ({...p, admin_email: e.target.value}))}
                type="email" placeholder="admin@empresa.com" style={inputS} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={resetAdmin}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#F59E0B', color: 'white', cursor: 'pointer', fontWeight: 700 }}>
                Guardar cambios
              </button>
              {adminForm.admin_password && (
                <a href={`https://wa.me/?text=${encodeURIComponent(`Hola! Tus credenciales de NEXUS IA:\n\nWeb: pos-tecnologi.com/login\nCodigo empresa: ${emp.codigo}\nUsuario: ${adminForm.admin_username}\nContrasena: ${adminForm.admin_password}\n\nGuarda estos datos.`)}`}
                  target="_blank" rel="noopener"
                  style={{ padding: '10px 14px', borderRadius: 8, border: 'none', background: '#25D366', color: 'white', cursor: 'pointer', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', fontSize: 13 }}>
                  Enviar por WhatsApp
                </a>
              )}
            </div>
          </div>
        )}

        {msg && <div style={{ marginTop: 12, padding: 10, borderRadius: 8, fontSize: 13, fontWeight: 600, textAlign: 'center',
          background: msg.startsWith('Error') ? '#FEE2E2' : '#D1FAE5',
          color: msg.startsWith('Error') ? '#DC2626' : '#065F46' }}>{msg}</div>}

        <button onClick={onClose}
          style={{ marginTop: 12, width: '100%', padding: '8px', borderRadius: 8, border: '1px solid #D1D5DB', background: 'white', cursor: 'pointer', color: '#374151', fontWeight: 600 }}>
          Cerrar
        </button>
      </div>
    </div>
  )
}

function TabSolicitudes({ sa }) {
  const [data, setData] = useState([])
  const [crearPara, setCrearPara] = useState(null)
  const [crearForm, setCrearForm] = useState({ admin_username: '', admin_password: '', dias_prueba: 15 })
  const [crearMsg, setCrearMsg] = useState('')
  const [creando, setCreando] = useState(false)

  useEffect(() => { if (sa) sa.get('/superadmin/solicitudes').then(r => setData(r.data)).catch(() => {}) }, [])

  const marcar = async (id, estado) => {
    try {
      const params = new URLSearchParams({ estado })
      await sa.patch(`/superadmin/solicitudes/${id}?${params}`, {})
      setData(d => d.map(s => s.id === id ? { ...s, estado } : s))
    } catch {}
  }

  const crearEmpresa = async () => {
    if (!crearForm.admin_username || !crearForm.admin_password) {
      setCrearMsg('Usuario y contrasena son obligatorios'); return
    }
    setCreando(true); setCrearMsg('')
    try {
      const s = crearPara
      const { data: r } = await sa.post('/superadmin/empresas', {
        codigo: s.empresa_nombre.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase(),
        nombre: s.empresa_nombre, ruc: s.ruc || '', email: s.email || '',
        plan: 'BASICO', admin_nombre: s.contacto_nombre,
        admin_username: crearForm.admin_username, admin_password: crearForm.admin_password,
        admin_email: s.email || '', dias_prueba: crearForm.dias_prueba,
      }, { headers: { 'Content-Type': 'application/json' } })
      setCrearMsg(`Empresa creada! Codigo: ${r.codigo_empresa || r.empresa_id}. Enviale al cliente: Usuario: ${crearForm.admin_username} / Contrasena: ${crearForm.admin_password}`)
      marcar(s.id, 'CONVERTIDA')
    } catch (e) { setCrearMsg('Error: ' + (e.response?.data?.detail || e.message)) }
    finally { setCreando(false) }
  }

  const colEstado = { NUEVA: '#3B82F6', CONTACTADA: '#F59E0B', CONVERTIDA: '#10B981', DESCARTADA: '#9CA3AF' }

  return (
    <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', fontWeight: 700, fontSize: 16, color: '#111827' }}>
        Solicitudes de prueba gratuita ({data.length})
      </div>
      {data.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>No hay solicitudes todavia</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F3F4F6', borderBottom: '2px solid #E5E7EB' }}>
              {['Fecha', 'Empresa', 'Contacto', 'Email', 'Telefono', 'Giro', 'Ciudad', 'Estado', 'Acciones'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#374151' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '10px 12px', fontSize: 12, color: '#374151' }}>{String(s.created_at).slice(0, 10)}</td>
                <td style={{ padding: '10px 12px', fontWeight: 700, color: '#111827' }}>{s.empresa_nombre}</td>
                <td style={{ padding: '10px 12px', color: '#1F2937' }}>{s.contacto_nombre}</td>
                <td style={{ padding: '10px 12px', color: '#374151' }}>{s.email}</td>
                <td style={{ padding: '10px 12px' }}>
                  <a href={`https://wa.me/593${(s.telefono||'').replace(/^0/,'')}`} target="_blank" rel="noopener"
                    style={{ color: '#25D366', fontWeight: 700, textDecoration: 'none' }}>{s.telefono}</a>
                </td>
                <td style={{ padding: '10px 12px', color: '#374151' }}>{s.giro_negocio || '-'}</td>
                <td style={{ padding: '10px 12px', color: '#374151' }}>{s.ciudad || '-'}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: `${colEstado[s.estado] || '#6B7280'}18`, color: colEstado[s.estado] || '#6B7280' }}>
                    {s.estado}
                  </span>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {s.estado === 'NUEVA' && (
                      <button onClick={() => marcar(s.id, 'CONTACTADA')}
                        style={{ padding: '3px 8px', borderRadius: 6, border: 'none', background: '#FEF3C7', color: '#92400E', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                        Contactada
                      </button>
                    )}
                    {s.estado !== 'CONVERTIDA' && (
                      <button onClick={() => { setCrearPara(s); setCrearForm({ admin_username: '', admin_password: '' }); setCrearMsg('') }}
                        style={{ padding: '3px 8px', borderRadius: 6, border: 'none', background: '#7C3AED', color: 'white', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                        Crear Empresa
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal Crear Empresa desde Solicitud */}
      {crearPara && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000 }}
          onClick={() => setCrearPara(null)}>
          <div style={{ background: 'white', borderRadius: 16, padding: 28, width: 460, maxHeight: '85vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', color: '#111827' }}>Crear empresa para: {crearPara.contacto_nombre}</h3>

            <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 16, marginBottom: 16, fontSize: 13, color: '#374151', lineHeight: 1.8 }}>
              <div><strong>Empresa:</strong> {crearPara.empresa_nombre}</div>
              <div><strong>RUC:</strong> {crearPara.ruc || '-'}</div>
              <div><strong>Email:</strong> {crearPara.email}</div>
              <div><strong>Telefono:</strong> {crearPara.telefono}</div>
              <div><strong>Giro:</strong> {crearPara.giro_negocio || '-'}</div>
              <div><strong>Ciudad:</strong> {crearPara.ciudad || '-'}</div>
            </div>

            <div style={{ fontSize: 14, fontWeight: 700, color: '#7C3AED', marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #EDE9FE' }}>
              Credenciales para el cliente
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Usuario *</label>
                <input value={crearForm.admin_username} onChange={e => setCrearForm(p => ({...p, admin_username: e.target.value}))}
                  placeholder="jperez" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Contrasena *</label>
                <input value={crearForm.admin_password} onChange={e => setCrearForm(p => ({...p, admin_password: e.target.value}))}
                  placeholder="MiClave123" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Dias de prueba</label>
                <select value={crearForm.dias_prueba} onChange={e => setCrearForm(p => ({...p, dias_prueba: parseInt(e.target.value)}))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, boxSizing: 'border-box', cursor: 'pointer' }}>
                  <option value={7}>7 dias</option>
                  <option value={15}>15 dias</option>
                  <option value={30}>30 dias</option>
                  <option value={60}>60 dias</option>
                  <option value={0}>Sin limite</option>
                </select>
              </div>
            </div>

            {crearMsg && <div style={{ padding: 12, borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 12, textAlign: 'center',
              background: crearMsg.startsWith('Error') ? '#FEE2E2' : '#D1FAE5',
              color: crearMsg.startsWith('Error') ? '#DC2626' : '#065F46',
              whiteSpace: 'pre-wrap' }}>{crearMsg}</div>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={crearEmpresa} disabled={creando}
                style={{ flex: 1, padding: '12px', borderRadius: 8, border: 'none', background: creando ? '#9CA3AF' : '#7C3AED',
                  color: 'white', cursor: creando ? 'default' : 'pointer', fontWeight: 700, fontSize: 14 }}>
                {creando ? 'Creando...' : 'Crear empresa y usuario'}
              </button>
              <button onClick={() => setCrearPara(null)}
                style={{ padding: '12px 20px', borderRadius: 8, border: '1px solid #D1D5DB', background: 'white', cursor: 'pointer', color: '#374151' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
