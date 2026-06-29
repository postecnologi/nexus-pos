import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '../theme'
import api from '../api'
import {
  User, Calendar, Clock, FileText, Download, DollarSign,
  Plus, Check, X, AlertTriangle, LogOut
} from 'lucide-react'

const fmt = v => parseFloat(v || 0).toFixed(2)
const fmtMoney = v => `$${fmt(v)}`

const TIPOS_PERMISO = [
  { id: 'PERSONAL', nombre: 'Personal' },
  { id: 'MEDICO', nombre: 'Médico' },
  { id: 'CALAMIDAD', nombre: 'Calamidad Doméstica' },
  { id: 'ESTUDIOS', nombre: 'Estudios' },
]
const ESTADO_COLORS = { SOLICITADO: '#F59E0B', APROBADO: '#10B981', RECHAZADO: '#EF4444', APROBADA: '#10B981' }

export default function PortalEmpleado() {
  const t = useTheme()
  const [tab, setTab] = useState('perfil')
  const [perfil, setPerfil] = useState(null)
  const [error, setError] = useState(null)
  const user = JSON.parse(localStorage.getItem('nexus_user') || '{}')

  useEffect(() => {
    api.get('/nomina/portal/mi-perfil')
      .then(r => setPerfil(r.data))
      .catch(err => setError(err.response?.data?.detail || 'Error al cargar perfil'))
  }, [])

  const logout = () => {
    localStorage.removeItem('nexus_token')
    localStorage.removeItem('nexus_user')
    window.location.href = '/login'
  }

  const sty = {
    page: { minHeight: '100vh', background: t.bg, color: t.text },
    header: {
      background: t.surface, borderBottom: `1px solid ${t.border}`, padding: '16px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    },
    content: { maxWidth: 1000, margin: '0 auto', padding: 20 },
    card: { background: t.surface, borderRadius: 10, border: `1px solid ${t.border}`, padding: 20, marginBottom: 16 },
    input: {
      background: t.sur2, border: `1px solid ${t.border}`, borderRadius: 6, padding: '8px 12px',
      color: t.text, fontSize: 13, width: '100%', outline: 'none', boxSizing: 'border-box',
    },
    select: {
      background: t.sur2, border: `1px solid ${t.border}`, borderRadius: 6, padding: '8px 12px',
      color: t.text, fontSize: 13, width: '100%', outline: 'none', boxSizing: 'border-box',
    },
    btn: (color = t.blue) => ({
      background: color, color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px',
      fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
    }),
    btnOutline: (color = t.blue) => ({
      background: 'transparent', color, border: `1px solid ${color}`, borderRadius: 6, padding: '7px 15px',
      fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
    }),
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
    th: { padding: '10px 12px', textAlign: 'left', borderBottom: `2px solid ${t.border}`, fontWeight: 700, color: t.muted, fontSize: 11, textTransform: 'uppercase' },
    td: { padding: '10px 12px', borderBottom: `1px solid ${t.border}`, fontSize: 12 },
    badge: (color) => ({
      display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: color + '22', color, border: `1px solid ${color}44`,
    }),
    label: { fontSize: 11, fontWeight: 600, color: t.muted, marginBottom: 4, display: 'block' },
    modal: {
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    },
    modalContent: {
      background: t.surface, borderRadius: 12, border: `1px solid ${t.border}`, padding: 24,
      width: '90%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
    },
  }

  const TABS = [
    { id: 'perfil', label: 'Mi Perfil', icon: User },
    { id: 'roles', label: 'Mis Roles de Pago', icon: DollarSign },
    { id: 'vacaciones', label: 'Mis Vacaciones', icon: Calendar },
    { id: 'permisos', label: 'Mis Permisos', icon: Clock },
  ]

  if (error) return (
    <div style={sty.page}>
      <div style={sty.header}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Portal del Empleado</h2>
        <button onClick={logout} style={sty.btn('#EF4444')}><LogOut size={14} /> Salir</button>
      </div>
      <div style={{ ...sty.content, textAlign: 'center', paddingTop: 60 }}>
        <AlertTriangle size={48} color={t.amber} />
        <p style={{ fontSize: 16, marginTop: 16 }}>{error}</p>
        <p style={{ color: t.muted }}>Contacte al administrador para vincular su cuenta.</p>
      </div>
    </div>
  )

  return (
    <div style={sty.page}>
      {/* Header */}
      <div style={sty.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', background: t.blue + '22',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <User size={20} color={t.blue} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Portal del Empleado</h2>
            <span style={{ fontSize: 12, color: t.muted }}>{perfil ? `${perfil.nombres} ${perfil.apellidos}` : 'Cargando...'}</span>
          </div>
        </div>
        <button onClick={logout} style={sty.btn('#EF4444')}><LogOut size={14} /> Salir</button>
      </div>

      <div style={sty.content}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap', borderBottom: `2px solid ${t.border}` }}>
          {TABS.map(tb => {
            const Icon = tb.icon
            const active = tab === tb.id
            return (
              <button key={tb.id} onClick={() => setTab(tb.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px',
                  background: active ? t.blueD : 'transparent',
                  color: active ? t.blue : t.muted, border: 'none',
                  borderBottom: active ? `2px solid ${t.blue}` : '2px solid transparent',
                  cursor: 'pointer', fontSize: 12, fontWeight: active ? 700 : 500,
                  borderRadius: '6px 6px 0 0', marginBottom: -2,
                }}>
                <Icon size={14} />{tb.label}
              </button>
            )
          })}
        </div>

        {tab === 'perfil' && perfil && <TabPerfil sty={sty} t={t} perfil={perfil} />}
        {tab === 'roles' && <TabMisRoles sty={sty} t={t} />}
        {tab === 'vacaciones' && perfil && <TabMisVacaciones sty={sty} t={t} perfil={perfil} />}
        {tab === 'permisos' && <TabMisPermisos sty={sty} t={t} />}
      </div>
    </div>
  )
}


// ── MI PERFIL ─────────────────────────────────────────────────────
function TabPerfil({ sty, t, perfil }) {
  const p = perfil
  const Info = ({ label, value }) => (
    <div style={{ flex: 1, minWidth: 180, marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: t.muted, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{value || '-'}</div>
    </div>
  )

  return (
    <>
      {/* Cards resumen */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Salario', value: fmtMoney(p.salario_base), color: t.blue },
          { label: 'Años Servicio', value: p.anos_servicio, color: t.purple },
          { label: 'Vacaciones Disponibles', value: `${p.dias_vacaciones_disponibles} días`, color: t.green },
          { label: 'Vacaciones Tomadas', value: `${p.dias_vacaciones_tomados} días`, color: t.amber },
        ].map((s, i) => (
          <div key={i} style={{
            flex: 1, minWidth: 160, padding: '16px 20px', background: s.color + '15',
            borderRadius: 10, border: `1px solid ${s.color}33`, textAlign: 'center',
          }}>
            <div style={{ fontSize: 11, color: t.muted, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={sty.card}>
        <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: t.blue }}>Datos Personales</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Info label="Nombres" value={`${p.nombres} ${p.apellidos}`} />
          <Info label="Cédula" value={p.cedula} />
          <Info label="Email" value={p.email} />
          <Info label="Teléfono" value={p.telefono} />
        </div>
      </div>

      <div style={sty.card}>
        <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: t.blue }}>Datos Laborales</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Info label="Cargo" value={p.cargo} />
          <Info label="Departamento" value={p.departamento} />
          <Info label="Tipo Contrato" value={p.tipo_contrato} />
          <Info label="Fecha Ingreso" value={p.fecha_ingreso?.substring?.(0, 10)} />
          <Info label="Región" value={p.region} />
        </div>
      </div>

      <div style={sty.card}>
        <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: t.blue }}>Datos Bancarios</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Info label="Banco" value={p.banco} />
          <Info label="Cuenta" value={p.cuenta_bancaria} />
          <Info label="Tipo Cuenta" value={p.tipo_cuenta} />
        </div>
      </div>
    </>
  )
}


// ── MIS ROLES DE PAGO ─────────────────────────────────────────────
function TabMisRoles({ sty, t }) {
  const [roles, setRoles] = useState([])

  useEffect(() => {
    api.get('/nomina/portal/mis-roles').then(r => setRoles(r.data)).catch(() => {})
  }, [])

  const verPdf = async (rid) => {
    try {
      const resp = await api.get(`/nomina/portal/mis-roles/${rid}/pdf`, { responseType: 'blob' })
      const ct = resp.headers['content-type'] || 'text/html'
      window.open(URL.createObjectURL(new Blob([resp.data], { type: ct })), '_blank')
    } catch (e) { alert('Error al generar PDF') }
  }

  return (
    <div style={sty.card}>
      <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Mis Roles de Pago</h3>
      <table style={sty.table}>
        <thead>
          <tr>
            {['Periodo', 'Salario', 'Total Ingresos', 'IESS', 'Descuentos', 'Neto a Pagar', ''].map(h =>
              <th key={h} style={sty.th}>{h}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {roles.map(r => (
            <tr key={r.id}
              onMouseEnter={ev => ev.currentTarget.style.background = t.sur2}
              onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
              <td style={{ ...sty.td, fontWeight: 600 }}>{r.periodo}</td>
              <td style={sty.td}>{fmtMoney(r.salario_base)}</td>
              <td style={sty.td}>{fmtMoney(r.total_ingresos)}</td>
              <td style={sty.td}>{fmtMoney(r.aporte_iess_personal)}</td>
              <td style={sty.td}>{fmtMoney(r.total_descuentos)}</td>
              <td style={{ ...sty.td, fontWeight: 700, color: t.green }}>{fmtMoney(r.neto_a_pagar)}</td>
              <td style={sty.td}>
                <button onClick={() => verPdf(r.id)} style={{ ...sty.btn(), padding: '4px 10px', fontSize: 11 }}>
                  <Download size={12} /> PDF
                </button>
              </td>
            </tr>
          ))}
          {!roles.length && (
            <tr><td colSpan={7} style={{ ...sty.td, textAlign: 'center', color: t.muted, padding: 30 }}>
              No hay roles de pago disponibles
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}


// ── MIS VACACIONES ────────────────────────────────────────────────
function TabMisVacaciones({ sty, t, perfil }) {
  const [vacaciones, setVacaciones] = useState([])
  const [modal, setModal] = useState(false)

  const load = () => {
    api.get('/nomina/portal/mis-vacaciones').then(r => setVacaciones(r.data)).catch(() => {})
  }
  useEffect(() => { load() }, [])

  return (
    <>
      {/* Resumen */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Disponibles', value: `${perfil.dias_vacaciones_disponibles} días`, color: t.green },
          { label: 'Tomados', value: `${perfil.dias_vacaciones_tomados} días`, color: t.amber },
          { label: 'Por Permisos', value: `${perfil.dias_por_permisos} días`, color: t.red },
        ].map((s, i) => (
          <div key={i} style={{
            flex: 1, minWidth: 140, padding: '14px 20px', background: s.color + '15',
            borderRadius: 10, border: `1px solid ${s.color}33`, textAlign: 'center',
          }}>
            <div style={{ fontSize: 11, color: t.muted, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ ...sty.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Historial de Vacaciones</h3>
        <button onClick={() => setModal(true)} style={sty.btn()}>
          <Plus size={14} /> Solicitar Vacaciones
        </button>
      </div>

      <div style={sty.card}>
        <table style={sty.table}>
          <thead>
            <tr>
              {['Inicio', 'Fin', 'Días', 'Valor', 'Estado', 'Observaciones'].map(h =>
                <th key={h} style={sty.th}>{h}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {vacaciones.map(v => (
              <tr key={v.id}>
                <td style={sty.td}>{v.fecha_inicio?.substring(0, 10)}</td>
                <td style={sty.td}>{v.fecha_fin?.substring(0, 10)}</td>
                <td style={sty.td}>{v.dias_tomados}</td>
                <td style={sty.td}>{fmtMoney(v.valor)}</td>
                <td style={sty.td}><span style={sty.badge(ESTADO_COLORS[v.estado] || t.green)}>{v.estado}</span></td>
                <td style={sty.td}>{v.observaciones || '-'}</td>
              </tr>
            ))}
            {!vacaciones.length && (
              <tr><td colSpan={6} style={{ ...sty.td, textAlign: 'center', color: t.muted, padding: 30 }}>
                No hay registros de vacaciones
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && <SolicitarVacacionModal sty={sty} t={t} perfil={perfil}
        onClose={() => setModal(false)} onSaved={() => { setModal(false); load() }} />}
    </>
  )
}

function SolicitarVacacionModal({ sty, t, perfil, onClose, onSaved }) {
  const [form, setForm] = useState({ fecha_inicio: '', fecha_fin: '', dias_tomados: '', observaciones: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    if (form.fecha_inicio && form.fecha_fin) {
      const d1 = new Date(form.fecha_inicio)
      const d2 = new Date(form.fecha_fin)
      const diff = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)) + 1
      if (diff > 0) set('dias_tomados', diff)
    }
  }, [form.fecha_inicio, form.fecha_fin])

  const save = async () => {
    if (!form.fecha_inicio || !form.fecha_fin || !form.dias_tomados) {
      alert('Complete las fechas'); return
    }
    if (parseInt(form.dias_tomados) > perfil.dias_vacaciones_disponibles) {
      alert(`Solo tiene ${perfil.dias_vacaciones_disponibles} días disponibles`); return
    }
    setSaving(true)
    try {
      await api.post('/nomina/portal/solicitar-vacacion', {
        empleado_id: perfil.id,
        fecha_inicio: form.fecha_inicio,
        fecha_fin: form.fecha_fin,
        dias_tomados: parseInt(form.dias_tomados),
        observaciones: form.observaciones,
      })
      alert('Vacaciones registradas')
      onSaved()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error')
    }
    setSaving(false)
  }

  return (
    <div style={sty.modal} onClick={onClose}>
      <div style={sty.modalContent} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Solicitar Vacaciones</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{
          padding: 12, background: t.greenD, borderRadius: 8, border: `1px solid ${t.green}33`, marginBottom: 16, fontSize: 12,
        }}>
          Días disponibles: <strong style={{ color: t.green }}>{perfil.dias_vacaciones_disponibles}</strong>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={sty.label}>Fecha Inicio *</label>
            <input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} style={sty.input} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={sty.label}>Fecha Fin *</label>
            <input type="date" value={form.fecha_fin} onChange={e => set('fecha_fin', e.target.value)} style={sty.input} />
          </div>
          <div style={{ width: 80 }}>
            <label style={sty.label}>Días</label>
            <input type="number" value={form.dias_tomados} onChange={e => set('dias_tomados', e.target.value)} style={sty.input} />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={sty.label}>Observaciones</label>
          <input value={form.observaciones} onChange={e => set('observaciones', e.target.value)} style={sty.input}
            placeholder="Motivo o comentarios..." />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={sty.btnOutline(t.muted)}>Cancelar</button>
          <button onClick={save} disabled={saving} style={sty.btn()}>
            {saving ? 'Enviando...' : 'Solicitar'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ── MIS PERMISOS ──────────────────────────────────────────────────
function TabMisPermisos({ sty, t }) {
  const [permisos, setPermisos] = useState([])
  const [modal, setModal] = useState(false)

  const load = () => {
    api.get('/nomina/portal/mis-permisos').then(r => setPermisos(r.data)).catch(() => {})
  }
  useEffect(() => { load() }, [])

  return (
    <>
      <div style={{ ...sty.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Mis Permisos</h3>
        <button onClick={() => setModal(true)} style={sty.btn()}>
          <Plus size={14} /> Solicitar Permiso
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Solicitados', value: permisos.filter(p => p.estado === 'SOLICITADO').length, color: '#F59E0B' },
          { label: 'Aprobados', value: permisos.filter(p => p.estado === 'APROBADO').length, color: '#10B981' },
          { label: 'Rechazados', value: permisos.filter(p => p.estado === 'RECHAZADO').length, color: '#EF4444' },
        ].map((s, i) => (
          <div key={i} style={{
            flex: 1, minWidth: 120, padding: '12px 16px', background: s.color + '15',
            borderRadius: 10, border: `1px solid ${s.color}33`, textAlign: 'center',
          }}>
            <div style={{ fontSize: 11, color: t.muted, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={sty.card}>
        <table style={sty.table}>
          <thead>
            <tr>
              {['Fecha', 'Tipo', 'Modalidad', 'Duración', 'Motivo', 'Estado'].map(h =>
                <th key={h} style={sty.th}>{h}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {permisos.map(p => (
              <tr key={p.id}
                onMouseEnter={ev => ev.currentTarget.style.background = t.sur2}
                onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                <td style={sty.td}>{p.fecha?.substring(0, 10)}</td>
                <td style={sty.td}><span style={sty.badge(ESTADO_COLORS[p.tipo] || t.blue)}>{p.tipo}</span></td>
                <td style={sty.td}>{p.modalidad === 'HORAS' ? 'Horas' : 'Día completo'}</td>
                <td style={sty.td}>
                  {p.modalidad === 'HORAS'
                    ? `${parseFloat(p.horas || 0)}h`
                    : `${parseFloat(p.dias || 1)} día(s)`}
                </td>
                <td style={{ ...sty.td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={p.motivo}>{p.motivo}</td>
                <td style={sty.td}>
                  <span style={sty.badge(ESTADO_COLORS[p.estado] || t.muted)}>{p.estado}</span>
                  {p.vacacion_descontada && <span style={{ fontSize: 10, color: t.amber, display: 'block', marginTop: 2 }}>Vac. descontada</span>}
                </td>
              </tr>
            ))}
            {!permisos.length && (
              <tr><td colSpan={6} style={{ ...sty.td, textAlign: 'center', color: t.muted, padding: 30 }}>
                No tiene permisos registrados
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && <SolicitarPermisoModal sty={sty} t={t}
        onClose={() => setModal(false)} onSaved={() => { setModal(false); load() }} />}
    </>
  )
}

function SolicitarPermisoModal({ sty, t, onClose, onSaved }) {
  const [form, setForm] = useState({
    tipo: 'PERSONAL', modalidad: 'HORAS',
    fecha: new Date().toISOString().substring(0, 10),
    hora_salida: '', hora_regreso: '', horas: '', dias: '1', motivo: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    if (form.modalidad === 'HORAS' && form.hora_salida && form.hora_regreso) {
      const [h1, m1] = form.hora_salida.split(':').map(Number)
      const [h2, m2] = form.hora_regreso.split(':').map(Number)
      const diff = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60
      if (diff > 0) set('horas', diff.toFixed(2))
    }
  }, [form.hora_salida, form.hora_regreso, form.modalidad])

  const save = async () => {
    if (!form.motivo || !form.fecha) {
      alert('Complete fecha y motivo'); return
    }
    if (form.modalidad === 'HORAS' && (!form.horas || parseFloat(form.horas) <= 0)) {
      alert('Indique las horas'); return
    }
    setSaving(true)
    try {
      await api.post('/nomina/portal/solicitar-permiso', null, { params: {
        tipo: form.tipo,
        modalidad: form.modalidad,
        fecha: form.fecha,
        motivo: form.motivo,
        horas: parseFloat(form.horas) || 0,
        dias: parseFloat(form.dias) || 1,
        hora_salida: form.hora_salida || null,
        hora_regreso: form.hora_regreso || null,
      }})
      alert('Permiso solicitado')
      onSaved()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error')
    }
    setSaving(false)
  }

  return (
    <div style={sty.modal} onClick={onClose}>
      <div style={sty.modalContent} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Solicitar Permiso</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={sty.label}>Tipo *</label>
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)} style={sty.select}>
              {TIPOS_PERMISO.map(tp => <option key={tp.id} value={tp.id}>{tp.nombre}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={sty.label}>Fecha *</label>
            <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} style={sty.input} />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={sty.label}>Modalidad *</label>
          <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
            {[{ v: 'HORAS', l: 'Horas' }, { v: 'DIA_COMPLETO', l: 'Día completo' }].map(opt => (
              <label key={opt.v} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: t.text }}>
                <input type="radio" name="modalidad_portal" value={opt.v} checked={form.modalidad === opt.v}
                  onChange={e => set('modalidad', e.target.value)} />
                {opt.l}
              </label>
            ))}
          </div>
        </div>

        {form.modalidad === 'HORAS' && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={sty.label}>Hora Salida</label>
              <input type="time" value={form.hora_salida} onChange={e => set('hora_salida', e.target.value)} style={sty.input} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={sty.label}>Hora Regreso</label>
              <input type="time" value={form.hora_regreso} onChange={e => set('hora_regreso', e.target.value)} style={sty.input} />
            </div>
            <div style={{ width: 100 }}>
              <label style={sty.label}>Horas *</label>
              <input type="number" value={form.horas} onChange={e => set('horas', e.target.value)}
                style={sty.input} step="0.5" min="0.5" />
            </div>
          </div>
        )}

        {form.modalidad === 'DIA_COMPLETO' && (
          <div style={{ marginBottom: 12, width: 120 }}>
            <label style={sty.label}>Días</label>
            <input type="number" value={form.dias} onChange={e => set('dias', e.target.value)}
              style={sty.input} min="1" />
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label style={sty.label}>Motivo *</label>
          <textarea value={form.motivo} onChange={e => set('motivo', e.target.value)}
            style={{ ...sty.input, minHeight: 60, resize: 'vertical' }} placeholder="Describa el motivo..." />
        </div>

        {form.tipo === 'PERSONAL' && (
          <div style={{
            padding: 10, background: t.amberD, borderRadius: 8, border: `1px solid ${t.amber}33`,
            marginBottom: 12, fontSize: 12, color: t.amber,
          }}>
            <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Los permisos personales se descuentan de vacaciones.
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={sty.btnOutline(t.muted)}>Cancelar</button>
          <button onClick={save} disabled={saving} style={sty.btn()}>
            {saving ? 'Enviando...' : 'Solicitar'}
          </button>
        </div>
      </div>
    </div>
  )
}
