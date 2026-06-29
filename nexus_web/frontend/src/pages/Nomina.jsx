import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '../theme'
import api from '../api'
import {
  Users, Calculator, Calendar, DollarSign, FileText, Settings, ClipboardList,
  Plus, Search, Edit2, Check, X, ChevronDown, Download, Eye, Trash2,
  RefreshCw, AlertTriangle, Briefcase, CreditCard, Award, Clock
} from 'lucide-react'

// ── Helpers ──────────────────────────────────────────────────────
const fmt = v => parseFloat(v || 0).toFixed(2)
const fmtMoney = v => `$${fmt(v)}`

const TABS = [
  { id: 'empleados',   label: 'Empleados',    icon: Users },
  { id: 'roles',       label: 'Rol de Pagos', icon: Calculator },
  { id: 'prestamos',   label: 'Prestamos',    icon: CreditCard },
  { id: 'vacaciones',  label: 'Vacaciones',   icon: Calendar },
  { id: 'permisos',    label: 'Permisos',     icon: Clock },
  { id: 'decimos',     label: 'Decimos',      icon: DollarSign },
  { id: 'liquidacion', label: 'Liquidacion',  icon: Briefcase },
  { id: 'reportes',    label: 'Reportes',     icon: FileText },
  { id: 'config',      label: 'Config',       icon: Settings },
]

const REGIONES = ['SIERRA', 'COSTA', 'ORIENTE', 'INSULAR']
const TIPOS_CONTRATO = ['INDEFINIDO', 'FIJO', 'EVENTUAL', 'TEMPORAL', 'PRUEBA']
const GENEROS = ['MASCULINO', 'FEMENINO', 'OTRO']
const ESTADOS_CIVILES = ['SOLTERO', 'CASADO', 'DIVORCIADO', 'VIUDO', 'UNION_LIBRE']
const MOTIVOS_LIQUIDACION = [
  { id: 'RENUNCIA', label: 'Renuncia Voluntaria' },
  { id: 'DESPIDO_INTEMPESTIVO', label: 'Despido Intempestivo' },
  { id: 'DESAHUCIO', label: 'Desahucio' },
  { id: 'MUTUO_ACUERDO', label: 'Mutuo Acuerdo' },
]

export default function Nomina() {
  const t = useTheme()
  const [tab, setTab] = useState('empleados')

  const sty = {
    page: { padding: 20, minHeight: '100vh', background: t.bg, color: t.text },
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
    modal: {
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    },
    modalContent: {
      background: t.surface, borderRadius: 12, border: `1px solid ${t.border}`, padding: 24,
      width: '90%', maxWidth: 800, maxHeight: '90vh', overflowY: 'auto',
    },
    label: { fontSize: 11, fontWeight: 600, color: t.muted, marginBottom: 4, display: 'block' },
  }

  return (
    <div style={sty.page}>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>Nomina</h2>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap', borderBottom: `2px solid ${t.border}`, paddingBottom: 0 }}>
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

      {tab === 'empleados' && <TabEmpleados sty={sty} t={t} />}
      {tab === 'roles' && <TabRoles sty={sty} t={t} />}
      {tab === 'prestamos' && <TabPrestamos sty={sty} t={t} />}
      {tab === 'vacaciones' && <TabVacaciones sty={sty} t={t} />}
      {tab === 'permisos' && <TabPermisos sty={sty} t={t} />}
      {tab === 'decimos' && <TabDecimos sty={sty} t={t} />}
      {tab === 'liquidacion' && <TabLiquidacion sty={sty} t={t} />}
      {tab === 'reportes' && <TabReportes sty={sty} t={t} />}
      {tab === 'config' && <TabConfig sty={sty} t={t} />}
    </div>
  )
}


// ══════════════════════════════════════════════════════════════════
//  TAB EMPLEADOS
// ══════════════════════════════════════════════════════════════════
function TabEmpleados({ sty, t }) {
  const [empleados, setEmpleados] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroActivo, setFiltroActivo] = useState('true')
  const [modal, setModal] = useState(null) // null | 'new' | empleado obj
  const [vendedores, setVendedores] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [tecnicos, setTecnicos] = useState([])

  const load = useCallback(() => {
    api.get('/nomina/empleados', { params: { busqueda, activo: filtroActivo } })
      .then(r => setEmpleados(r.data)).catch(() => {})
  }, [busqueda, filtroActivo])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    api.get('/vendedores').then(r => setVendedores(r.data || [])).catch(() => {})
    api.get('/usuarios').then(r => setUsuarios(r.data || [])).catch(() => {})
    api.get('/servicio-tecnico/tecnicos').then(r => setTecnicos(r.data || [])).catch(() => setTecnicos([]))
  }, [])

  const toggle = (id) => {
    api.patch(`/nomina/empleados/${id}/toggle`).then(() => load()).catch(() => {})
  }

  return (
    <>
      <div style={{ ...sty.card, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: t.muted }} />
          <input placeholder="Buscar por nombre, cedula, codigo..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            style={{ ...sty.input, paddingLeft: 32 }} />
        </div>
        <select value={filtroActivo} onChange={e => setFiltroActivo(e.target.value)} style={{ ...sty.select, width: 140 }}>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
          <option value="">Todos</option>
        </select>
        <button onClick={() => setModal('new')} style={sty.btn()}>
          <Plus size={14} /> Nuevo Empleado
        </button>
      </div>

      <div style={sty.card}>
        <table style={sty.table}>
          <thead>
            <tr>
              {['Codigo', 'Nombre', 'Cedula', 'Cargo', 'Departamento', 'Salario', 'Ingreso', 'Estado', ''].map(h =>
                <th key={h} style={sty.th}>{h}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {empleados.map(e => (
              <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => setModal(e)}
                onMouseEnter={ev => ev.currentTarget.style.background = t.sur2}
                onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                <td style={sty.td}>{e.codigo}</td>
                <td style={sty.td}><strong>{e.apellidos} {e.nombres}</strong></td>
                <td style={sty.td}>{e.cedula}</td>
                <td style={sty.td}>{e.cargo}</td>
                <td style={sty.td}>{e.departamento}</td>
                <td style={sty.td}>{fmtMoney(e.salario_base)}</td>
                <td style={sty.td}>{e.fecha_ingreso?.substring(0, 10)}</td>
                <td style={sty.td}>
                  <span style={sty.badge(e.activo ? t.green : t.red)}>
                    {e.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td style={{ ...sty.td, display: 'flex', gap: 4 }}>
                  <button onClick={ev => { ev.stopPropagation(); toggle(e.id) }}
                    style={{ ...sty.btnOutline(e.activo ? t.red : t.green), padding: '4px 10px', fontSize: 11 }}>
                    {e.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={ev => { ev.stopPropagation(); descargarDoc(`/nomina/empleados/${e.id}/certificado-trabajo`) }}
                    style={{ ...sty.btnOutline(t.blue), padding: '4px 10px', fontSize: 11 }}
                    title="Certificado de Trabajo">
                    <Award size={12} />
                  </button>
                </td>
              </tr>
            ))}
            {!empleados.length && (
              <tr><td colSpan={9} style={{ ...sty.td, textAlign: 'center', color: t.muted, padding: 30 }}>
                No hay empleados registrados
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <EmpleadoModal sty={sty} t={t} emp={modal === 'new' ? null : modal}
          vendedores={vendedores} usuarios={usuarios} tecnicos={tecnicos}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />
      )}
    </>
  )
}

function EmpleadoModal({ sty, t, emp, vendedores, usuarios, tecnicos, onClose, onSaved }) {
  const isEdit = !!emp
  const [form, setForm] = useState({
    codigo: '', cedula: '', nombres: '', apellidos: '',
    fecha_nacimiento: '', genero: '', estado_civil: '',
    direccion: '', telefono: '', email: '',
    cargo: '', departamento: '', sucursal_id: '',
    fecha_ingreso: '', fecha_salida: '', tipo_contrato: 'INDEFINIDO',
    salario_base: '', tiene_fondos_reserva: false,
    decimo_tercero_acumulado: true, decimo_cuarto_acumulado: true,
    region: 'SIERRA', num_cargas_familiares: 0,
    cuenta_bancaria: '', banco: '', tipo_cuenta: '',
    usuario_id: '', vendedor_id: '', tecnico_id: '', activo: true,
    ...(emp || {}),
    fecha_nacimiento: emp?.fecha_nacimiento?.substring?.(0, 10) || '',
    fecha_ingreso: emp?.fecha_ingreso?.substring?.(0, 10) || '',
    fecha_salida: emp?.fecha_salida?.substring?.(0, 10) || '',
    salario_base: emp?.salario_base || '',
    sucursal_id: emp?.sucursal_id || '',
    usuario_id: emp?.usuario_id || '',
    vendedor_id: emp?.vendedor_id || '',
    tecnico_id: emp?.tecnico_id || '',
    num_cargas_familiares: emp?.num_cargas_familiares || 0,
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const save = async () => {
    if (!form.cedula || !form.nombres || !form.apellidos || !form.fecha_ingreso || !form.salario_base) {
      alert('Complete los campos obligatorios: cedula, nombres, apellidos, fecha ingreso, salario')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        salario_base: parseFloat(form.salario_base) || 0,
        sucursal_id: form.sucursal_id ? parseInt(form.sucursal_id) : null,
        usuario_id: form.usuario_id ? parseInt(form.usuario_id) : null,
        vendedor_id: form.vendedor_id ? parseInt(form.vendedor_id) : null,
        tecnico_id: form.tecnico_id ? parseInt(form.tecnico_id) : null,
        num_cargas_familiares: parseInt(form.num_cargas_familiares) || 0,
        fecha_salida: form.fecha_salida || null,
        fecha_nacimiento: form.fecha_nacimiento || null,
      }
      if (isEdit) {
        await api.put(`/nomina/empleados/${emp.id}`, payload)
      } else {
        await api.post('/nomina/empleados', payload)
      }
      onSaved()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al guardar')
    }
    setSaving(false)
  }

  const Field = ({ label, name, type = 'text', required, ...props }) => (
    <div style={{ flex: 1, minWidth: 160 }}>
      <label style={sty.label}>{label}{required && ' *'}</label>
      <input type={type} value={form[name] || ''} onChange={e => set(name, e.target.value)}
        style={sty.input} {...props} />
    </div>
  )

  const Select = ({ label, name, options, ...props }) => (
    <div style={{ flex: 1, minWidth: 160 }}>
      <label style={sty.label}>{label}</label>
      <select value={form[name] || ''} onChange={e => set(name, e.target.value)} style={sty.select} {...props}>
        <option value="">-- Seleccione --</option>
        {options.map(o => typeof o === 'string'
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>
        )}
      </select>
    </div>
  )

  const Checkbox = ({ label, name }) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.text, cursor: 'pointer' }}>
      <input type="checkbox" checked={!!form[name]} onChange={e => set(name, e.target.checked)} />
      {label}
    </label>
  )

  return (
    <div style={sty.modal} onClick={onClose}>
      <div style={sty.modalContent} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            {isEdit ? 'Editar Empleado' : 'Nuevo Empleado'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {/* Datos Personales */}
        <div style={{ fontSize: 13, fontWeight: 700, color: t.blue, marginBottom: 8, marginTop: 8 }}>Datos Personales</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <Field label="Cedula" name="cedula" required />
          <Field label="Nombres" name="nombres" required />
          <Field label="Apellidos" name="apellidos" required />
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <Field label="Fecha Nacimiento" name="fecha_nacimiento" type="date" />
          <Select label="Genero" name="genero" options={GENEROS} />
          <Select label="Estado Civil" name="estado_civil" options={ESTADOS_CIVILES} />
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <Field label="Direccion" name="direccion" />
          <Field label="Telefono" name="telefono" />
          <Field label="Email" name="email" type="email" />
        </div>

        {/* Datos Laborales */}
        <div style={{ fontSize: 13, fontWeight: 700, color: t.blue, marginBottom: 8, marginTop: 16 }}>Datos Laborales</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <Field label="Codigo" name="codigo" />
          <Field label="Cargo" name="cargo" />
          <Field label="Departamento" name="departamento" />
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <Field label="Fecha Ingreso" name="fecha_ingreso" type="date" required />
          <Field label="Fecha Salida" name="fecha_salida" type="date" />
          <Select label="Tipo Contrato" name="tipo_contrato" options={TIPOS_CONTRATO} />
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <Field label="Salario Base ($)" name="salario_base" type="number" required />
          <Select label="Region" name="region" options={REGIONES} />
          <Field label="Cargas Familiares" name="num_cargas_familiares" type="number" />
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 12 }}>
          <Checkbox label="Tiene Fondos de Reserva" name="tiene_fondos_reserva" />
          <Checkbox label="Decimo 13ro Mensualizado" name="decimo_tercero_acumulado" />
          <Checkbox label="Decimo 14to Mensualizado" name="decimo_cuarto_acumulado" />
        </div>

        {/* Datos Bancarios */}
        <div style={{ fontSize: 13, fontWeight: 700, color: t.blue, marginBottom: 8, marginTop: 16 }}>Datos Bancarios</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <Field label="Banco" name="banco" />
          <Field label="Numero Cuenta" name="cuenta_bancaria" />
          <Select label="Tipo Cuenta" name="tipo_cuenta" options={['AHORROS', 'CORRIENTE']} />
        </div>

        {/* Vincular */}
        <div style={{ fontSize: 13, fontWeight: 700, color: t.blue, marginBottom: 8, marginTop: 16 }}>Vincular con</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <Select label="Vendedor" name="vendedor_id"
            options={vendedores.map(v => ({ value: v.id, label: `${v.nombre} ${v.apellidos || ''}` }))} />
          <Select label="Usuario Sistema" name="usuario_id"
            options={usuarios.map(u => ({ value: u.id, label: u.nombre || u.username }))} />
          <Select label="Tecnico" name="tecnico_id"
            options={tecnicos.map(tc => ({ value: tc.id, label: tc.nombre }))} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {isEdit && (
            <div style={{ display: 'flex', gap: 8 }}>
              {!emp.usuario_id && (
                <button onClick={async () => {
                  const pass = prompt('Contraseña para el empleado (mínimo 4 caracteres):', '123456')
                  if (!pass || pass.length < 4) { alert('Contraseña debe tener al menos 4 caracteres'); return }
                  try {
                    const r = await api.post(`/nomina/empleados/${emp.id}/crear-acceso?password=${encodeURIComponent(pass)}`)
                    alert(r.data.msg)
                  } catch (err) { alert(err.response?.data?.detail || 'Error') }
                }} style={sty.btn('#8B5CF6')}>
                  <Users size={14} /> Crear Acceso Portal
                </button>
              )}
              {emp.usuario_id && (
                <>
                  <span style={{ fontSize: 11, color: '#10B981', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Check size={14} /> Portal activo (usuario: {emp.cedula})
                  </span>
                  <button onClick={async () => {
                    const pass = prompt('Nueva contraseña (mínimo 4 caracteres):')
                    if (!pass || pass.length < 4) { alert('Mínimo 4 caracteres'); return }
                    try {
                      await api.patch(`/usuarios/${emp.usuario_id}/password`, { password: pass })
                      alert('Contraseña actualizada')
                    } catch (err) { alert(err.response?.data?.detail || 'Error') }
                  }} style={sty.btnOutline('#8B5CF6')}>
                    <Edit2 size={12} /> Cambiar Contraseña
                  </button>
                </>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
            <button onClick={onClose} style={sty.btnOutline(t.muted)}>Cancelar</button>
            <button onClick={save} disabled={saving} style={sty.btn()}>
              {saving ? 'Guardando...' : (isEdit ? 'Actualizar' : 'Crear Empleado')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


// ══════════════════════════════════════════════════════════════════
//  TAB ROL DE PAGOS
// ══════════════════════════════════════════════════════════════════
function TabRoles({ sty, t }) {
  const hoy = new Date()
  const [periodo, setPeriodo] = useState(`${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`)
  const [roles, setRoles] = useState([])
  const [calculating, setCalculating] = useState(false)
  const [detalle, setDetalle] = useState(null)

  const load = useCallback(() => {
    api.get('/nomina/roles', { params: { periodo } })
      .then(r => setRoles(r.data)).catch(() => {})
  }, [periodo])

  useEffect(() => { load() }, [load])

  const calcular = async () => {
    setCalculating(true)
    try {
      await api.post('/nomina/roles/calcular', { periodo })
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al calcular')
    }
    setCalculating(false)
  }

  const aprobarTodos = async () => {
    if (!confirm('Aprobar todos los roles del periodo?')) return
    try {
      await api.post('/nomina/roles/aprobar-todos', { periodo })
      load()
    } catch (err) { alert('Error') }
  }

  const verPdf = async (rid) => {
    try {
      const resp = await api.get(`/nomina/roles/${rid}/pdf`, { responseType: 'blob' })
      const ct = resp.headers['content-type'] || 'text/html'
      window.open(URL.createObjectURL(new Blob([resp.data], { type: ct })), '_blank')
    } catch (e) { alert('Error al generar PDF') }
  }
  const descargarDoc = async (url) => {
    try {
      const resp = await api.get(url, { responseType: 'blob' })
      const ct = resp.headers['content-type'] || 'text/html'
      window.open(URL.createObjectURL(new Blob([resp.data], { type: ct })), '_blank')
    } catch (e) { alert('Error al generar documento') }
  }

  const totalIngresos = roles.reduce((s, r) => s + parseFloat(r.total_ingresos || 0), 0)
  const totalNeto = roles.reduce((s, r) => s + parseFloat(r.neto_a_pagar || 0), 0)

  return (
    <>
      <div style={{ ...sty.card, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 0, minWidth: 160 }}>
          <label style={sty.label}>Periodo</label>
          <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)} style={sty.input} />
        </div>
        <button onClick={calcular} disabled={calculating} style={sty.btn()}>
          <Calculator size={14} /> {calculating ? 'Calculando...' : 'Calcular Nomina'}
        </button>
        {roles.length > 0 && (
          <button onClick={aprobarTodos} style={sty.btn(t.green)}>
            <Check size={14} /> Aprobar Todos
          </button>
        )}
        {roles.length > 0 && roles.some(r => r.estado === 'APROBADO') && (
          <>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <select
                onChange={e => {
                  if (e.target.value) {
                    descargarDoc(`/nomina/archivo-bancario?periodo=${periodo}&banco=${e.target.value}`)
                    e.target.value = ''
                  }
                }}
                style={{ ...sty.select, width: 'auto', minWidth: 140, fontSize: 11, padding: '7px 10px' }}
                defaultValue=""
              >
                <option value="" disabled>Archivo Bancario</option>
                <option value="PICHINCHA">Banco Pichincha</option>
                <option value="GUAYAQUIL">Banco Guayaquil</option>
                <option value="PACIFICO">Banco Pacifico</option>
                <option value="GENERAL">General CSV</option>
              </select>
            </div>
            <button onClick={() => descargarDoc(`/nomina/archivo-iess?periodo=${periodo}`)}
              style={sty.btn(t.purple)}>
              <Download size={14} /> Archivo IESS
            </button>
          </>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, fontSize: 13 }}>
          <span style={{ color: t.muted }}>Empleados: <strong style={{ color: t.text }}>{roles.length}</strong></span>
          <span style={{ color: t.muted }}>Total Ingresos: <strong style={{ color: t.blue }}>{fmtMoney(totalIngresos)}</strong></span>
          <span style={{ color: t.muted }}>Total Neto: <strong style={{ color: t.green }}>{fmtMoney(totalNeto)}</strong></span>
        </div>
      </div>

      <div style={sty.card}>
        <table style={sty.table}>
          <thead>
            <tr>
              {['Empleado', 'Salario', 'H.Extras', 'Comisiones', 'Total Ing.', 'IESS', 'Descuentos', 'Neto', 'Estado', ''].map(h =>
                <th key={h} style={sty.th}>{h}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {roles.map(r => (
              <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setDetalle(r)}
                onMouseEnter={ev => ev.currentTarget.style.background = t.sur2}
                onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                <td style={sty.td}><strong>{r.apellidos} {r.nombres}</strong><br /><span style={{ color: t.muted, fontSize: 11 }}>{r.cedula}</span></td>
                <td style={sty.td}>{fmtMoney(r.salario_base)}</td>
                <td style={sty.td}>{fmtMoney(parseFloat(r.valor_horas_extras_50 || 0) + parseFloat(r.valor_horas_extras_100 || 0))}</td>
                <td style={sty.td}>{fmtMoney(r.comisiones)}</td>
                <td style={{ ...sty.td, fontWeight: 600 }}>{fmtMoney(r.total_ingresos)}</td>
                <td style={sty.td}>{fmtMoney(r.aporte_iess_personal)}</td>
                <td style={sty.td}>{fmtMoney(r.total_descuentos)}</td>
                <td style={{ ...sty.td, fontWeight: 700, color: t.green }}>{fmtMoney(r.neto_a_pagar)}</td>
                <td style={sty.td}>
                  <span style={sty.badge(r.estado === 'APROBADO' ? t.green : t.amber)}>
                    {r.estado}
                  </span>
                </td>
                <td style={sty.td}>
                  <button onClick={ev => { ev.stopPropagation(); verPdf(r.id) }}
                    style={{ ...sty.btnOutline(t.blue), padding: '4px 8px', fontSize: 11 }}>
                    <FileText size={12} /> PDF
                  </button>
                </td>
              </tr>
            ))}
            {!roles.length && (
              <tr><td colSpan={10} style={{ ...sty.td, textAlign: 'center', color: t.muted, padding: 30 }}>
                No hay roles para este periodo. Presione "Calcular Nomina".
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {detalle && <RolDetalleModal sty={sty} t={t} rol={detalle} onClose={() => { setDetalle(null); load() }} />}
    </>
  )
}

function RolDetalleModal({ sty, t, rol, onClose }) {
  const [detail, setDetail] = useState(null)
  useEffect(() => {
    api.get(`/nomina/roles/${rol.id}`).then(r => setDetail(r.data)).catch(() => {})
  }, [rol.id])

  const aprobar = async () => {
    try {
      await api.patch(`/nomina/roles/${rol.id}/aprobar`)
      onClose()
    } catch (err) { alert(err.response?.data?.detail || 'Error') }
  }

  const r = detail || rol
  const Row = ({ label, value, bold }) => (
    <tr>
      <td style={{ ...sty.td, fontWeight: bold ? 700 : 400 }}>{label}</td>
      <td style={{ ...sty.td, textAlign: 'right', fontWeight: bold ? 700 : 400 }}>{fmtMoney(value)}</td>
    </tr>
  )

  return (
    <div style={sty.modal} onClick={onClose}>
      <div style={{ ...sty.modalContent, maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            Rol de Pagos - {r.apellidos} {r.nombres}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ fontSize: 12, color: t.muted, marginBottom: 16 }}>
          Periodo: <strong>{r.periodo}</strong> | Cedula: <strong>{r.cedula}</strong> | Cargo: <strong>{r.cargo || '-'}</strong>
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, color: t.blue, marginBottom: 4 }}>INGRESOS</div>
        <table style={sty.table}>
          <tbody>
            <Row label="Salario Base" value={r.salario_base} />
            <Row label="Horas Extras 50%" value={r.valor_horas_extras_50} />
            <Row label="Horas Extras 100%" value={r.valor_horas_extras_100} />
            <Row label="Comisiones" value={r.comisiones} />
            <Row label="Bonificaciones" value={r.bonificaciones} />
            <Row label="TOTAL INGRESOS" value={r.total_ingresos} bold />
          </tbody>
        </table>

        <div style={{ fontSize: 13, fontWeight: 700, color: t.red, marginBottom: 4, marginTop: 16 }}>DESCUENTOS</div>
        <table style={sty.table}>
          <tbody>
            <Row label="Aporte IESS Personal (9.45%)" value={r.aporte_iess_personal} />
            <Row label="Prestamos IESS" value={r.prestamos_iess} />
            <Row label="Prestamos Empresa" value={r.prestamos_empresa} />
            <Row label="Anticipos" value={r.anticipo} />
            <Row label="Otros Descuentos" value={r.otros_descuentos} />
            <Row label="TOTAL DESCUENTOS" value={r.total_descuentos} bold />
          </tbody>
        </table>

        <div style={{ fontSize: 13, fontWeight: 700, color: t.purple, marginBottom: 4, marginTop: 16 }}>PROVISIONES / BENEFICIOS</div>
        <table style={sty.table}>
          <tbody>
            <Row label="Decimo Tercero" value={r.decimo_tercero} />
            <Row label="Decimo Cuarto" value={r.decimo_cuarto} />
            <Row label="Fondos de Reserva" value={r.fondos_reserva} />
            <Row label="Vacaciones (Provision)" value={r.vacaciones_provision} />
            <Row label="Aporte Patronal IESS (11.15%)" value={r.aporte_iess_patronal} />
          </tbody>
        </table>

        <div style={{
          marginTop: 20, padding: '12px 16px', background: t.greenD, borderRadius: 8,
          border: `1px solid ${t.green}44`, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: t.green }}>NETO A PAGAR</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: t.green }}>{fmtMoney(r.neto_a_pagar)}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          {r.estado === 'BORRADOR' && (
            <button onClick={aprobar} style={sty.btn(t.green)}>
              <Check size={14} /> Aprobar
            </button>
          )}
          <button onClick={() => verPdf(r.id)} style={sty.btnOutline(t.blue)}>
            <FileText size={14} /> Ver PDF
          </button>
          <button onClick={onClose} style={sty.btnOutline(t.muted)}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}


// ══════════════════════════════════════════════════════════════════
//  TAB VACACIONES
// ══════════════════════════════════════════════════════════════════
function TabVacaciones({ sty, t }) {
  const [vacaciones, setVacaciones] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [filtroEmp, setFiltroEmp] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState(false)

  const load = useCallback(() => {
    const params = {}
    if (filtroEmp) params.empleado_id = filtroEmp
    api.get('/nomina/vacaciones', { params }).then(r => setVacaciones(r.data)).catch(() => {})
  }, [filtroEmp])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    api.get('/nomina/empleados', { params: { activo: 'true' } }).then(r => setEmpleados(r.data)).catch(() => {})
  }, [])

  const exportPdf = async () => {
    try {
      const params = {}
      if (filtroEmp) params.empleado_id = filtroEmp
      const resp = await api.get('/nomina/vacaciones/reporte-pdf', { params, responseType: 'blob' })
      const ct = resp.headers['content-type'] || 'text/html'
      window.open(URL.createObjectURL(new Blob([resp.data], { type: ct })), '_blank')
    } catch (e) { alert('Error al generar reporte') }
  }

  const filtered = busqueda
    ? vacaciones.filter(v => `${v.apellidos} ${v.nombres} ${v.cedula}`.toLowerCase().includes(busqueda.toLowerCase()))
    : vacaciones

  const totalDias = filtered.reduce((s, v) => s + (parseInt(v.dias_tomados) || 0), 0)
  const totalValor = filtered.reduce((s, v) => s + (parseFloat(v.valor) || 0), 0)

  return (
    <>
      <div style={{ ...sty.card, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <label style={sty.label}>Buscar</label>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 28, color: t.muted }} />
          <input placeholder="Buscar por nombre, cedula..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            style={{ ...sty.input, paddingLeft: 32 }} />
        </div>
        <div style={{ minWidth: 180 }}>
          <label style={sty.label}>Empleado</label>
          <select value={filtroEmp} onChange={e => setFiltroEmp(e.target.value)} style={sty.select}>
            <option value="">Todos</option>
            {empleados.map(e => <option key={e.id} value={e.id}>{e.apellidos} {e.nombres}</option>)}
          </select>
        </div>
        <button onClick={exportPdf} style={sty.btn(t.purple)}>
          <Download size={14} /> Exportar PDF
        </button>
        <button onClick={() => setModal(true)} style={sty.btn()}>
          <Plus size={14} /> Solicitar Vacaciones
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Registros', value: filtered.length, color: t.blue },
          { label: 'Total Dias', value: totalDias, color: t.amber },
          { label: 'Total Valor', value: fmtMoney(totalValor), color: t.green },
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

      <div style={sty.card}>
        <table style={sty.table}>
          <thead>
            <tr>
              {['Empleado', 'Fecha Inicio', 'Fecha Fin', 'Dias', 'Dias Derecho', 'Valor', 'Estado', 'Observaciones'].map(h =>
                <th key={h} style={sty.th}>{h}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map(v => (
              <tr key={v.id}
                onMouseEnter={ev => ev.currentTarget.style.background = t.sur2}
                onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                <td style={sty.td}><strong>{v.apellidos} {v.nombres}</strong><br/><span style={{ color: t.muted, fontSize: 11 }}>{v.cedula}</span></td>
                <td style={sty.td}>{v.fecha_inicio?.substring(0, 10)}</td>
                <td style={sty.td}>{v.fecha_fin?.substring(0, 10)}</td>
                <td style={sty.td}>{v.dias_tomados}</td>
                <td style={sty.td}>{v.dias_derecho}</td>
                <td style={sty.td}>{fmtMoney(v.valor)}</td>
                <td style={sty.td}><span style={sty.badge(t.green)}>{v.estado}</span></td>
                <td style={sty.td}>{v.observaciones || '-'}</td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={8} style={{ ...sty.td, textAlign: 'center', color: t.muted, padding: 30 }}>
                No hay registros de vacaciones
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && <VacacionModal sty={sty} t={t} empleados={empleados} onClose={() => setModal(false)} onSaved={() => { setModal(false); load() }} />}
    </>
  )
}

function VacacionModal({ sty, t, empleados, onClose, onSaved }) {
  const [form, setForm] = useState({ empleado_id: '', fecha_inicio: '', fecha_fin: '', dias_tomados: '', observaciones: '' })
  const [disponibles, setDisponibles] = useState(null)
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    if (form.empleado_id) {
      api.get(`/nomina/empleados/${form.empleado_id}/vacaciones-disponibles`)
        .then(r => setDisponibles(r.data)).catch(() => setDisponibles(null))
    } else {
      setDisponibles(null)
    }
  }, [form.empleado_id])

  // Auto-calculate days
  useEffect(() => {
    if (form.fecha_inicio && form.fecha_fin) {
      const d1 = new Date(form.fecha_inicio)
      const d2 = new Date(form.fecha_fin)
      const diff = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)) + 1
      if (diff > 0) set('dias_tomados', diff)
    }
  }, [form.fecha_inicio, form.fecha_fin])

  const save = async () => {
    if (!form.empleado_id || !form.fecha_inicio || !form.fecha_fin || !form.dias_tomados) {
      alert('Complete todos los campos'); return
    }
    setSaving(true)
    try {
      await api.post('/nomina/vacaciones', {
        ...form,
        empleado_id: parseInt(form.empleado_id),
        dias_tomados: parseInt(form.dias_tomados),
      })
      onSaved()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error')
    }
    setSaving(false)
  }

  return (
    <div style={sty.modal} onClick={onClose}>
      <div style={{ ...sty.modalContent, maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Solicitar Vacaciones</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={sty.label}>Empleado *</label>
          <select value={form.empleado_id} onChange={e => set('empleado_id', e.target.value)} style={sty.select}>
            <option value="">-- Seleccione --</option>
            {empleados.map(e => <option key={e.id} value={e.id}>{e.apellidos} {e.nombres}</option>)}
          </select>
        </div>

        {disponibles && (
          <div style={{
            padding: 12, background: t.blueD, borderRadius: 8, border: `1px solid ${t.blue}33`, marginBottom: 12, fontSize: 12,
          }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span>Anos servicio: <strong>{disponibles.anos_servicio}</strong></span>
              <span>Dias/ano: <strong>{disponibles.dias_por_ano}</strong></span>
              <span>Tomados: <strong>{disponibles.dias_tomados}</strong></span>
              {disponibles.dias_por_permisos > 0 && (
                <span style={{ color: t.amber }}>Desc. por permisos: <strong>{disponibles.dias_por_permisos}</strong></span>
              )}
              <span style={{ color: t.green, fontWeight: 700 }}>Disponibles: <strong>{disponibles.dias_disponibles}</strong></span>
              <span>Valor/dia: <strong>{fmtMoney(disponibles.valor_diario)}</strong></span>
            </div>
          </div>
        )}

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
            <label style={sty.label}>Dias</label>
            <input type="number" value={form.dias_tomados} onChange={e => set('dias_tomados', e.target.value)} style={sty.input} />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={sty.label}>Observaciones</label>
          <input value={form.observaciones} onChange={e => set('observaciones', e.target.value)} style={sty.input} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={sty.btnOutline(t.muted)}>Cancelar</button>
          <button onClick={save} disabled={saving} style={sty.btn()}>
            {saving ? 'Guardando...' : 'Registrar Vacaciones'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ══════════════════════════════════════════════════════════════════
//  TAB PERMISOS
// ══════════════════════════════════════════════════════════════════
const TIPO_COLORS = { PERSONAL: '#3B82F6', MEDICO: '#10B981', CALAMIDAD: '#EF4444', MATERNIDAD: '#EC4899', PATERNIDAD: '#06B6D4', ESTUDIOS: '#8B5CF6', SIN_SUELDO: '#6B7280' }
const ESTADO_COLORS = { SOLICITADO: '#F59E0B', APROBADO: '#10B981', RECHAZADO: '#EF4444' }

function TabPermisos({ sty, t }) {
  const [permisos, setPermisos] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [tiposPermiso, setTiposPermiso] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [fechaIni, setFechaIni] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [modal, setModal] = useState(false)

  const load = useCallback(() => {
    const params = {}
    if (filtroEstado) params.estado = filtroEstado
    if (fechaIni) params.fecha_ini = fechaIni
    if (fechaFin) params.fecha_fin = fechaFin
    api.get('/nomina/permisos', { params }).then(r => setPermisos(r.data)).catch(() => {})
  }, [filtroEstado, fechaIni, fechaFin])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    api.get('/nomina/empleados', { params: { activo: 'true' } }).then(r => setEmpleados(r.data)).catch(() => {})
    api.get('/nomina/permisos/tipos').then(r => setTiposPermiso(r.data)).catch(() => {})
  }, [])

  const aprobar = async (pid) => {
    try {
      const r = await api.patch(`/nomina/permisos/${pid}/aprobar`)
      alert(r.data.msg)
      load()
    } catch (err) { alert(err.response?.data?.detail || 'Error') }
  }

  const rechazar = async (pid) => {
    const obs = prompt('Motivo del rechazo (opcional):')
    if (obs === null) return
    try {
      await api.patch(`/nomina/permisos/${pid}/rechazar`, null, { params: { observaciones: obs } })
      load()
    } catch (err) { alert(err.response?.data?.detail || 'Error') }
  }

  const filtered = busqueda
    ? permisos.filter(p => `${p.apellidos} ${p.nombres} ${p.cedula} ${p.tipo} ${p.motivo}`.toLowerCase().includes(busqueda.toLowerCase()))
    : permisos

  const solicitados = filtered.filter(p => p.estado === 'SOLICITADO').length
  const aprobados = filtered.filter(p => p.estado === 'APROBADO').length
  const rechazados = filtered.filter(p => p.estado === 'RECHAZADO').length

  const exportPdf = async () => {
    try {
      const params = {}
      if (filtroEstado) params.estado = filtroEstado
      if (fechaIni) params.fecha_ini = fechaIni
      if (fechaFin) params.fecha_fin = fechaFin
      const resp = await api.get('/nomina/permisos/reporte-pdf', { params, responseType: 'blob' })
      const ct = resp.headers['content-type'] || 'text/html'
      window.open(URL.createObjectURL(new Blob([resp.data], { type: ct })), '_blank')
    } catch (e) { alert('Error al generar reporte') }
  }

  return (
    <>
      {/* Filter bar */}
      <div style={{ ...sty.card, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <label style={sty.label}>Buscar</label>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 28, color: t.muted }} />
          <input placeholder="Buscar por nombre, cedula, tipo, motivo..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            style={{ ...sty.input, paddingLeft: 32 }} />
        </div>
        <div style={{ minWidth: 130 }}>
          <label style={sty.label}>Estado</label>
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={sty.select}>
            <option value="">Todos</option>
            <option value="SOLICITADO">Solicitados</option>
            <option value="APROBADO">Aprobados</option>
            <option value="RECHAZADO">Rechazados</option>
          </select>
        </div>
        <div style={{ minWidth: 130 }}>
          <label style={sty.label}>Desde</label>
          <input type="date" value={fechaIni} onChange={e => setFechaIni(e.target.value)} style={sty.input} />
        </div>
        <div style={{ minWidth: 130 }}>
          <label style={sty.label}>Hasta</label>
          <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} style={sty.input} />
        </div>
        <button onClick={exportPdf} style={sty.btn(t.purple)}>
          <Download size={14} /> PDF
        </button>
        <button onClick={() => setModal(true)} style={sty.btn()}>
          <Plus size={14} /> Solicitar Permiso
        </button>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Solicitados', value: solicitados, color: t.amber },
          { label: 'Aprobados', value: aprobados, color: t.green },
          { label: 'Rechazados', value: rechazados, color: t.red },
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

      {/* Table */}
      <div style={sty.card}>
        <table style={sty.table}>
          <thead>
            <tr>
              {['Fecha', 'Empleado', 'Tipo', 'Modalidad', 'Horas/Dias', 'Motivo', 'Estado', 'Acciones'].map(h =>
                <th key={h} style={sty.th}>{h}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id}
                onMouseEnter={ev => ev.currentTarget.style.background = t.sur2}
                onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                <td style={sty.td}>{p.fecha?.substring(0, 10)}</td>
                <td style={sty.td}><strong>{p.apellidos} {p.nombres}</strong><br/><span style={{ color: t.muted, fontSize: 11 }}>{p.cedula}</span></td>
                <td style={sty.td}>
                  <span style={sty.badge(TIPO_COLORS[p.tipo] || t.blue)}>{p.tipo}</span>
                </td>
                <td style={sty.td}>{p.modalidad === 'HORAS' ? 'Horas' : 'Dia completo'}</td>
                <td style={sty.td}>
                  {p.modalidad === 'HORAS'
                    ? `${parseFloat(p.horas || 0)}h${p.hora_salida ? ` (${p.hora_salida?.substring(0,5)}-${p.hora_regreso?.substring(0,5)})` : ''}`
                    : `${parseFloat(p.dias || 1)} dia(s)`
                  }
                </td>
                <td style={{ ...sty.td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={p.motivo}>{p.motivo}</td>
                <td style={sty.td}>
                  <span style={sty.badge(ESTADO_COLORS[p.estado] || t.muted)}>{p.estado}</span>
                  {p.vacacion_descontada && <span style={{ fontSize: 10, color: t.amber, display: 'block', marginTop: 2 }}>Vac. descontada</span>}
                </td>
                <td style={{ ...sty.td, whiteSpace: 'nowrap' }}>
                  {p.estado === 'SOLICITADO' && (
                    <>
                      <button onClick={() => aprobar(p.id)}
                        style={{ ...sty.btn(t.green), padding: '4px 10px', fontSize: 11, marginRight: 4 }}>
                        <Check size={12} /> Aprobar
                      </button>
                      <button onClick={() => rechazar(p.id)}
                        style={{ ...sty.btn(t.red), padding: '4px 10px', fontSize: 11 }}>
                        <X size={12} /> Rechazar
                      </button>
                    </>
                  )}
                  {p.estado !== 'SOLICITADO' && p.aprobado_por_nombre && (
                    <span style={{ fontSize: 11, color: t.muted }}>{p.aprobado_por_nombre}</span>
                  )}
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={8} style={{ ...sty.td, textAlign: 'center', color: t.muted, padding: 30 }}>
                No hay permisos registrados
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && <PermisoModal sty={sty} t={t} empleados={empleados} tiposPermiso={tiposPermiso}
        onClose={() => setModal(false)} onSaved={() => { setModal(false); load() }} />}
    </>
  )
}

function PermisoModal({ sty, t, empleados, tiposPermiso, onClose, onSaved }) {
  const [form, setForm] = useState({
    empleado_id: '', tipo: 'PERSONAL', modalidad: 'HORAS',
    fecha: new Date().toISOString().substring(0, 10),
    hora_salida: '', hora_regreso: '', horas: '', dias: '1', motivo: '',
  })
  const [saving, setSaving] = useState(false)
  const [horasAcum, setHorasAcum] = useState(null)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const tipoInfo = tiposPermiso.find(tp => tp.id === form.tipo)

  // Load accumulated hours when employee + PERSONAL + HORAS selected
  useEffect(() => {
    if (form.empleado_id && form.tipo === 'PERSONAL') {
      api.get(`/nomina/permisos/horas-acumuladas/${form.empleado_id}`)
        .then(r => setHorasAcum(r.data)).catch(() => setHorasAcum(null))
    } else {
      setHorasAcum(null)
    }
  }, [form.empleado_id, form.tipo])

  // Auto-calculate hours from time range
  useEffect(() => {
    if (form.modalidad === 'HORAS' && form.hora_salida && form.hora_regreso) {
      const [h1, m1] = form.hora_salida.split(':').map(Number)
      const [h2, m2] = form.hora_regreso.split(':').map(Number)
      const diff = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60
      if (diff > 0) set('horas', diff.toFixed(2))
    }
  }, [form.hora_salida, form.hora_regreso, form.modalidad])

  const save = async () => {
    if (!form.empleado_id || !form.motivo || !form.fecha) {
      alert('Complete empleado, fecha y motivo'); return
    }
    if (form.modalidad === 'HORAS' && (!form.horas || parseFloat(form.horas) <= 0)) {
      alert('Indique las horas del permiso'); return
    }
    setSaving(true)
    try {
      const r = await api.post('/nomina/permisos', null, { params: {
        empleado_id: parseInt(form.empleado_id),
        tipo: form.tipo,
        modalidad: form.modalidad,
        fecha: form.fecha,
        motivo: form.motivo,
        horas: parseFloat(form.horas) || 0,
        dias: parseFloat(form.dias) || 1,
        hora_salida: form.hora_salida || null,
        hora_regreso: form.hora_regreso || null,
      }})
      alert(r.data.msg)
      onSaved()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al solicitar permiso')
    }
    setSaving(false)
  }

  return (
    <div style={sty.modal} onClick={onClose}>
      <div style={{ ...sty.modalContent, maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Solicitar Permiso</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={sty.label}>Empleado *</label>
          <select value={form.empleado_id} onChange={e => set('empleado_id', e.target.value)} style={sty.select}>
            <option value="">-- Seleccione --</option>
            {empleados.map(e => <option key={e.id} value={e.id}>{e.apellidos} {e.nombres} - {e.cedula}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={sty.label}>Tipo de Permiso *</label>
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)} style={sty.select}>
              {tiposPermiso.map(tp => <option key={tp.id} value={tp.id}>{tp.nombre}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={sty.label}>Fecha *</label>
            <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} style={sty.input} />
          </div>
        </div>

        {/* Modalidad radio */}
        <div style={{ marginBottom: 12 }}>
          <label style={sty.label}>Modalidad *</label>
          <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
            {[{ v: 'HORAS', l: 'Horas' }, { v: 'DIA_COMPLETO', l: 'Dia completo' }].map(opt => (
              <label key={opt.v} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: t.text }}>
                <input type="radio" name="modalidad" value={opt.v} checked={form.modalidad === opt.v}
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
            <label style={sty.label}>Dias</label>
            <input type="number" value={form.dias} onChange={e => set('dias', e.target.value)}
              style={sty.input} min="1" />
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label style={sty.label}>Motivo *</label>
          <textarea value={form.motivo} onChange={e => set('motivo', e.target.value)}
            style={{ ...sty.input, minHeight: 60, resize: 'vertical' }} placeholder="Describa el motivo del permiso..." />
        </div>

        {/* Info box for PERSONAL */}
        {form.tipo === 'PERSONAL' && (
          <div style={{
            padding: 10, background: t.amberD, borderRadius: 8, border: `1px solid ${t.amber}33`,
            marginBottom: 12, fontSize: 12, color: t.amber,
          }}>
            <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Si es permiso PERSONAL, se descuenta de vacaciones.
            {form.modalidad === 'HORAS' && ' Las horas se acumulan; al llegar a 8h se descuenta 1 dia.'}
          </div>
        )}

        {/* Show accumulated hours for PERSONAL+HORAS */}
        {form.tipo === 'PERSONAL' && form.modalidad === 'HORAS' && horasAcum && (
          <div style={{
            padding: 10, background: t.blueD, borderRadius: 8, border: `1px solid ${t.blue}33`,
            marginBottom: 12, fontSize: 12,
          }}>
            <span>Horas acumuladas: <strong>{horasAcum.horas_acumuladas}h</strong></span>
            <span style={{ marginLeft: 12 }}>Dias descontados: <strong>{horasAcum.dias_descontados}</strong></span>
            <span style={{ marginLeft: 12 }}>Faltan: <strong>{horasAcum.horas_para_proximo_dia}h</strong> para descontar 1 dia</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={sty.btnOutline(t.muted)}>Cancelar</button>
          <button onClick={save} disabled={saving} style={sty.btn()}>
            {saving ? 'Guardando...' : 'Solicitar Permiso'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ══════════════════════════════════════════════════════════════════
//  TAB DECIMOS
// ══════════════════════════════════════════════════════════════════
function TabDecimos({ sty, t }) {
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [dt13, setDt13] = useState([])
  const [dt14, setDt14] = useState([])
  const [showing, setShowing] = useState(null) // '13' | '14'

  const calcular13 = () => {
    api.get('/nomina/decimo-tercero', { params: { anio } })
      .then(r => { setDt13(r.data); setShowing('13') }).catch(() => {})
  }

  const calcular14 = () => {
    api.get('/nomina/decimo-cuarto', { params: { anio } })
      .then(r => { setDt14(r.data); setShowing('14') }).catch(() => {})
  }

  const data = showing === '13' ? dt13 : dt14

  return (
    <>
      <div style={{ ...sty.card, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label style={sty.label}>Ano</label>
          <input type="number" value={anio} onChange={e => setAnio(parseInt(e.target.value))}
            style={{ ...sty.input, width: 100 }} />
        </div>
        <button onClick={calcular13} style={sty.btn()}>
          <Calculator size={14} /> Calcular Decimo Tercero
        </button>
        <button onClick={calcular14} style={sty.btn(t.purple)}>
          <Calculator size={14} /> Calcular Decimo Cuarto
        </button>
        {showing && (
          <div style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 700, color: t.blue }}>
            {showing === '13' ? 'Decimo Tercer Sueldo' : 'Decimo Cuarto Sueldo'}
          </div>
        )}
      </div>

      {data.length > 0 && (
        <div style={sty.card}>
          <table style={sty.table}>
            <thead>
              <tr>
                {showing === '13'
                  ? ['Empleado', 'Cedula', 'Cargo', 'Total Ganado', 'Decimo 13ro', 'Mensualizado'].map(h => <th key={h} style={sty.th}>{h}</th>)
                  : ['Empleado', 'Cedula', 'Region', 'Fecha Pago', 'SBU', 'Dias Trab.', 'Decimo 14to', 'Mensualizado'].map(h => <th key={h} style={sty.th}>{h}</th>)
                }
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={i}>
                  <td style={sty.td}><strong>{d.apellidos} {d.nombres}</strong></td>
                  <td style={sty.td}>{d.cedula}</td>
                  {showing === '13' ? (
                    <>
                      <td style={sty.td}>{d.cargo}</td>
                      <td style={sty.td}>{fmtMoney(d.total_ganado)}</td>
                      <td style={{ ...sty.td, fontWeight: 700, color: t.green }}>{fmtMoney(d.decimo_tercero)}</td>
                      <td style={sty.td}>
                        <span style={sty.badge(d.mensualizado ? t.blue : t.amber)}>
                          {d.mensualizado ? 'Si' : 'No'}
                        </span>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={sty.td}>{d.region}</td>
                      <td style={sty.td}>{d.fecha_pago}</td>
                      <td style={sty.td}>{fmtMoney(d.sbu)}</td>
                      <td style={sty.td}>{d.dias_trabajados}</td>
                      <td style={{ ...sty.td, fontWeight: 700, color: t.green }}>{fmtMoney(d.decimo_cuarto)}</td>
                      <td style={sty.td}>
                        <span style={sty.badge(d.mensualizado ? t.blue : t.amber)}>
                          {d.mensualizado ? 'Si' : 'No'}
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={showing === '13' ? 4 : 6} style={{ ...sty.td, fontWeight: 700, textAlign: 'right' }}>TOTAL:</td>
                <td style={{ ...sty.td, fontWeight: 800, color: t.green, fontSize: 14 }}>
                  {fmtMoney(data.reduce((s, d) => s + parseFloat(showing === '13' ? d.decimo_tercero : d.decimo_cuarto), 0))}
                </td>
                <td style={sty.td}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  )
}


// ══════════════════════════════════════════════════════════════════
//  TAB LIQUIDACION
// ══════════════════════════════════════════════════════════════════
function TabLiquidacion({ sty, t }) {
  const [empleados, setEmpleados] = useState([])
  const [empId, setEmpId] = useState('')
  const [motivo, setMotivo] = useState('RENUNCIA')
  const [fechaSalida, setFechaSalida] = useState(new Date().toISOString().substring(0, 10))
  const [result, setResult] = useState(null)
  const [calculating, setCalculating] = useState(false)

  useEffect(() => {
    api.get('/nomina/empleados', { params: { activo: 'true' } }).then(r => setEmpleados(r.data)).catch(() => {})
  }, [])

  const calcular = async () => {
    if (!empId) { alert('Seleccione un empleado'); return }
    setCalculating(true)
    try {
      const r = await api.post(`/nomina/empleados/${empId}/liquidacion`, { motivo, fecha_salida: fechaSalida })
      setResult(r.data)
    } catch (err) {
      alert(err.response?.data?.detail || 'Error')
    }
    setCalculating(false)
  }

  return (
    <>
      <div style={sty.card}>
        <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Calcular Liquidacion</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={sty.label}>Empleado *</label>
            <select value={empId} onChange={e => setEmpId(e.target.value)} style={sty.select}>
              <option value="">-- Seleccione --</option>
              {empleados.map(e => <option key={e.id} value={e.id}>{e.apellidos} {e.nombres} - {e.cedula}</option>)}
            </select>
          </div>
          <div style={{ minWidth: 200 }}>
            <label style={sty.label}>Motivo *</label>
            <select value={motivo} onChange={e => setMotivo(e.target.value)} style={sty.select}>
              {MOTIVOS_LIQUIDACION.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div style={{ minWidth: 160 }}>
            <label style={sty.label}>Fecha Salida</label>
            <input type="date" value={fechaSalida} onChange={e => setFechaSalida(e.target.value)} style={sty.input} />
          </div>
          <button onClick={calcular} disabled={calculating} style={sty.btn(t.amber)}>
            <Calculator size={14} /> {calculating ? 'Calculando...' : 'Calcular'}
          </button>
        </div>

        <div style={{ marginTop: 8, padding: 8, background: t.redD, borderRadius: 6, border: `1px solid ${t.red}33`, fontSize: 11, color: t.red, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={14} />
          ATENCION: Al calcular la liquidacion, el empleado sera marcado como INACTIVO automaticamente.
        </div>
      </div>

      {result && (
        <div style={sty.card}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>
            Liquidacion - {result.apellidos} {result.nombres}
          </h3>
          <div style={{ fontSize: 12, color: t.muted, marginBottom: 16 }}>
            Cedula: <strong>{result.cedula}</strong> | Cargo: <strong>{result.cargo}</strong> |
            Ingreso: <strong>{result.fecha_ingreso}</strong> | Salida: <strong>{result.fecha_salida}</strong> |
            Anos: <strong>{result.anos_servicio}</strong> | Motivo: <strong>{result.motivo}</strong>
          </div>

          <table style={sty.table}>
            <thead>
              <tr>
                <th style={sty.th}>Concepto</th>
                <th style={{ ...sty.th, textAlign: 'right' }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={sty.td}>Decimo Tercero Proporcional</td>
                <td style={{ ...sty.td, textAlign: 'right' }}>{fmtMoney(result.desglose.decimo_tercero_proporcional)}</td>
              </tr>
              <tr>
                <td style={sty.td}>Decimo Cuarto Proporcional</td>
                <td style={{ ...sty.td, textAlign: 'right' }}>{fmtMoney(result.desglose.decimo_cuarto_proporcional)}</td>
              </tr>
              <tr>
                <td style={sty.td}>Vacaciones No Gozadas ({result.desglose.vacaciones_no_gozadas_dias} dias)</td>
                <td style={{ ...sty.td, textAlign: 'right' }}>{fmtMoney(result.desglose.vacaciones_no_gozadas_valor)}</td>
              </tr>
              <tr>
                <td style={sty.td}>Fondos de Reserva</td>
                <td style={{ ...sty.td, textAlign: 'right' }}>{fmtMoney(result.desglose.fondos_reserva)}</td>
              </tr>
              {result.desglose.desahucio > 0 && (
                <tr>
                  <td style={sty.td}>Bonificacion por Desahucio</td>
                  <td style={{ ...sty.td, textAlign: 'right' }}>{fmtMoney(result.desglose.desahucio)}</td>
                </tr>
              )}
              {result.desglose.despido_intempestivo > 0 && (
                <tr>
                  <td style={sty.td}>Indemnizacion por Despido Intempestivo</td>
                  <td style={{ ...sty.td, textAlign: 'right' }}>{fmtMoney(result.desglose.despido_intempestivo)}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr style={{ background: t.greenD }}>
                <td style={{ ...sty.td, fontWeight: 800, fontSize: 14 }}>TOTAL LIQUIDACION</td>
                <td style={{ ...sty.td, textAlign: 'right', fontWeight: 800, fontSize: 16, color: t.green }}>
                  {fmtMoney(result.total_liquidacion)}
                </td>
              </tr>
            </tfoot>
          </table>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={() => descargarDoc(`/nomina/empleados/${result.empleado_id}/acta-finiquito?motivo=${result.motivo}`)}
              style={sty.btn(t.purple)}>
              <FileText size={14} /> Acta de Finiquito
            </button>
          </div>
        </div>
      )}
    </>
  )
}


// ══════════════════════════════════════════════════════════════════
//  TAB PRESTAMOS
// ══════════════════════════════════════════════════════════════════
function TabPrestamos({ sty, t }) {
  const [prestamos, setPrestamos] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [modal, setModal] = useState(false)
  const [abonarModal, setAbonarModal] = useState(null)

  const load = () => {
    api.get('/nomina/prestamos').then(r => setPrestamos(r.data)).catch(() => {})
    api.get('/nomina/empleados', { params: { activo: 'true' } }).then(r => setEmpleados(r.data)).catch(() => {})
  }
  useEffect(() => { load() }, [])

  return (
    <>
      <div style={{ ...sty.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Prestamos y Anticipos</h3>
        <button onClick={() => setModal(true)} style={sty.btn()}>
          <Plus size={14} /> Nuevo Prestamo / Anticipo
        </button>
      </div>

      <div style={sty.card}>
        <table style={sty.table}>
          <thead>
            <tr>
              {['Empleado', 'Tipo', 'Monto Total', 'Cuotas', 'Cuota', 'Pagadas', 'Saldo', 'Fecha', 'Estado', ''].map(h =>
                <th key={h} style={sty.th}>{h}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {prestamos.map(p => (
              <tr key={p.id}>
                <td style={sty.td}><strong>{p.apellidos} {p.nombres}</strong><br/><span style={{ color: t.muted, fontSize: 11 }}>{p.cedula}</span></td>
                <td style={sty.td}>
                  <span style={sty.badge(p.tipo === 'ANTICIPO' ? t.amber : t.blue)}>{p.tipo}</span>
                </td>
                <td style={sty.td}>{fmtMoney(p.monto_total)}</td>
                <td style={sty.td}>{p.cuotas}</td>
                <td style={sty.td}>{fmtMoney(p.monto_cuota)}</td>
                <td style={sty.td}>{p.cuotas_pagadas} / {p.cuotas}</td>
                <td style={{ ...sty.td, fontWeight: 700, color: parseFloat(p.saldo) > 0 ? t.red : t.green }}>{fmtMoney(p.saldo)}</td>
                <td style={sty.td}>{p.fecha?.substring(0, 10)}</td>
                <td style={sty.td}>
                  <span style={sty.badge(p.estado === 'PAGADO' ? t.green : t.amber)}>{p.estado}</span>
                </td>
                <td style={sty.td}>
                  {p.estado === 'ACTIVO' && parseFloat(p.saldo) > 0 && (
                    <button onClick={() => setAbonarModal(p)}
                      style={{ ...sty.btn(t.green), padding: '4px 10px', fontSize: 11 }}>
                      <DollarSign size={12} /> Abonar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!prestamos.length && (
              <tr><td colSpan={10} style={{ ...sty.td, textAlign: 'center', color: t.muted, padding: 30 }}>
                No hay prestamos activos
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && <PrestamoModal sty={sty} t={t} empleados={empleados} onClose={() => setModal(false)} onSaved={() => { setModal(false); load() }} />}
      {abonarModal && <AbonarModal sty={sty} t={t} prestamo={abonarModal} onClose={() => setAbonarModal(null)} onSaved={() => { setAbonarModal(null); load() }} />}
    </>
  )
}

function PrestamoModal({ sty, t, empleados, onClose, onSaved }) {
  const [form, setForm] = useState({ empleado_id: '', tipo: 'ANTICIPO', monto_total: '', cuotas: 1, observaciones: '' })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const cuotaMensual = form.monto_total && form.cuotas ? (parseFloat(form.monto_total) / parseInt(form.cuotas)).toFixed(2) : '0.00'

  const save = async () => {
    if (!form.empleado_id || !form.monto_total) {
      alert('Complete empleado y monto'); return
    }
    setSaving(true)
    try {
      await api.post('/nomina/prestamos', null, { params: {
        empleado_id: parseInt(form.empleado_id),
        tipo: form.tipo,
        monto_total: parseFloat(form.monto_total),
        cuotas: parseInt(form.cuotas) || 1,
        observaciones: form.observaciones,
      }})
      onSaved()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error')
    }
    setSaving(false)
  }

  return (
    <div style={sty.modal} onClick={onClose}>
      <div style={{ ...sty.modalContent, maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Nuevo Prestamo / Anticipo</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={sty.label}>Empleado *</label>
          <select value={form.empleado_id} onChange={e => set('empleado_id', e.target.value)} style={sty.select}>
            <option value="">-- Seleccione --</option>
            {empleados.map(e => <option key={e.id} value={e.id}>{e.apellidos} {e.nombres} - {e.cedula}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={sty.label}>Tipo *</label>
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)} style={sty.select}>
              <option value="ANTICIPO">Anticipo</option>
              <option value="PRESTAMO">Prestamo</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={sty.label}>Monto Total *</label>
            <input type="number" value={form.monto_total} onChange={e => set('monto_total', e.target.value)} style={sty.input} step="0.01" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={sty.label}>Cuotas</label>
            <input type="number" value={form.cuotas} onChange={e => set('cuotas', e.target.value)} style={sty.input} min="1" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={sty.label}>Cuota Mensual</label>
            <div style={{ ...sty.input, background: t.bg, fontWeight: 700, color: t.blue }}>${cuotaMensual}</div>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={sty.label}>Observaciones</label>
          <input value={form.observaciones} onChange={e => set('observaciones', e.target.value)} style={sty.input} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={sty.btnOutline(t.muted)}>Cancelar</button>
          <button onClick={save} disabled={saving} style={sty.btn()}>
            {saving ? 'Guardando...' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AbonarModal({ sty, t, prestamo, onClose, onSaved }) {
  const [monto, setMonto] = useState(prestamo.monto_cuota || '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!monto || parseFloat(monto) <= 0) { alert('Ingrese un monto valido'); return }
    setSaving(true)
    try {
      await api.patch(`/nomina/prestamos/${prestamo.id}/abonar`, null, { params: { monto: parseFloat(monto) } })
      onSaved()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error')
    }
    setSaving(false)
  }

  return (
    <div style={sty.modal} onClick={onClose}>
      <div style={{ ...sty.modalContent, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Abonar Prestamo</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ marginBottom: 12, fontSize: 12, color: t.muted }}>
          <strong>{prestamo.apellidos} {prestamo.nombres}</strong> - Saldo: <strong style={{ color: t.red }}>{fmtMoney(prestamo.saldo)}</strong>
          <br/>Cuota sugerida: <strong>{fmtMoney(prestamo.monto_cuota)}</strong>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={sty.label}>Monto a Abonar *</label>
          <input type="number" value={monto} onChange={e => setMonto(e.target.value)} style={sty.input} step="0.01" />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={sty.btnOutline(t.muted)}>Cancelar</button>
          <button onClick={save} disabled={saving} style={sty.btn(t.green)}>
            {saving ? 'Procesando...' : 'Registrar Abono'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ══════════════════════════════════════════════════════════════════
//  TAB REPORTES
// ══════════════════════════════════════════════════════════════════
function TabReportes({ sty, t }) {
  const hoy = new Date()
  const [periodo, setPeriodo] = useState(`${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`)
  const [reporte, setReporte] = useState(null)
  const [tipoReporte, setTipoReporte] = useState('')

  const cargar = async (tipo) => {
    try {
      const url = tipo === 'planilla' ? '/nomina/reporte-planilla'
        : tipo === 'iess' ? '/nomina/reporte-iess'
        : '/nomina/reporte-provisiones'
      const r = await api.get(url, { params: { periodo } })
      setReporte(r.data)
      setTipoReporte(tipo)
    } catch (err) {
      alert(err.response?.data?.detail || 'Error')
    }
  }

  return (
    <>
      <div style={{ ...sty.card, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label style={sty.label}>Periodo</label>
          <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)} style={sty.input} />
        </div>
        <button onClick={() => cargar('planilla')} style={sty.btn()}>
          <FileText size={14} /> Planilla General
        </button>
        <button onClick={() => cargar('iess')} style={sty.btn(t.purple)}>
          <FileText size={14} /> Reporte IESS
        </button>
        <button onClick={() => cargar('provisiones')} style={sty.btn(t.amber)}>
          <FileText size={14} /> Provisiones
        </button>
      </div>

      {reporte && tipoReporte === 'planilla' && (
        <div style={sty.card}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Planilla General - {reporte.periodo}</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={sty.table}>
              <thead>
                <tr>
                  {['Empleado', 'Cedula', 'Salario', 'H.Extras', 'Comisiones', 'Total Ing.', 'IESS Pers.', 'Desc.', 'D.13ro', 'D.14to', 'F.Reserva', 'Neto'].map(h =>
                    <th key={h} style={sty.th}>{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {(reporte.roles || []).map((r, i) => (
                  <tr key={i}>
                    <td style={sty.td}><strong>{r.apellidos} {r.nombres}</strong></td>
                    <td style={sty.td}>{r.cedula}</td>
                    <td style={sty.td}>{fmtMoney(r.salario_base)}</td>
                    <td style={sty.td}>{fmtMoney(parseFloat(r.valor_horas_extras_50 || 0) + parseFloat(r.valor_horas_extras_100 || 0))}</td>
                    <td style={sty.td}>{fmtMoney(r.comisiones)}</td>
                    <td style={{ ...sty.td, fontWeight: 600 }}>{fmtMoney(r.total_ingresos)}</td>
                    <td style={sty.td}>{fmtMoney(r.aporte_iess_personal)}</td>
                    <td style={sty.td}>{fmtMoney(r.total_descuentos)}</td>
                    <td style={sty.td}>{fmtMoney(r.decimo_tercero)}</td>
                    <td style={sty.td}>{fmtMoney(r.decimo_cuarto)}</td>
                    <td style={sty.td}>{fmtMoney(r.fondos_reserva)}</td>
                    <td style={{ ...sty.td, fontWeight: 700, color: t.green }}>{fmtMoney(r.neto_a_pagar)}</td>
                  </tr>
                ))}
              </tbody>
              {reporte.totales && (
                <tfoot>
                  <tr style={{ background: t.sur2 }}>
                    <td colSpan={2} style={{ ...sty.td, fontWeight: 700 }}>TOTALES ({reporte.totales.empleados} empleados)</td>
                    <td style={{ ...sty.td, fontWeight: 700 }}>{fmtMoney(reporte.totales.salario_base)}</td>
                    <td style={sty.td}></td><td style={sty.td}></td>
                    <td style={{ ...sty.td, fontWeight: 700 }}>{fmtMoney(reporte.totales.total_ingresos)}</td>
                    <td style={{ ...sty.td, fontWeight: 700 }}>{fmtMoney(reporte.totales.aporte_iess_personal)}</td>
                    <td style={{ ...sty.td, fontWeight: 700 }}>{fmtMoney(reporte.totales.total_descuentos)}</td>
                    <td style={{ ...sty.td, fontWeight: 700 }}>{fmtMoney(reporte.totales.decimo_tercero)}</td>
                    <td style={{ ...sty.td, fontWeight: 700 }}>{fmtMoney(reporte.totales.decimo_cuarto)}</td>
                    <td style={{ ...sty.td, fontWeight: 700 }}>{fmtMoney(reporte.totales.fondos_reserva)}</td>
                    <td style={{ ...sty.td, fontWeight: 800, color: t.green, fontSize: 14 }}>{fmtMoney(reporte.totales.neto_a_pagar)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {reporte && tipoReporte === 'iess' && (
        <div style={sty.card}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Reporte IESS - {reporte.periodo}</h3>
          <table style={sty.table}>
            <thead>
              <tr>
                {['Cedula', 'Empleado', 'Sueldo', 'Total Ingresos', 'Aporte Personal', 'Aporte Patronal', 'Total Aporte', 'F.Reserva'].map(h =>
                  <th key={h} style={sty.th}>{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {(reporte.roles || []).map((r, i) => (
                <tr key={i}>
                  <td style={sty.td}>{r.cedula}</td>
                  <td style={sty.td}><strong>{r.apellidos} {r.nombres}</strong></td>
                  <td style={sty.td}>{fmtMoney(r.salario_base)}</td>
                  <td style={sty.td}>{fmtMoney(r.total_ingresos)}</td>
                  <td style={sty.td}>{fmtMoney(r.aporte_iess_personal)}</td>
                  <td style={sty.td}>{fmtMoney(r.aporte_iess_patronal)}</td>
                  <td style={{ ...sty.td, fontWeight: 600 }}>{fmtMoney(r.total_aporte)}</td>
                  <td style={sty.td}>{fmtMoney(r.fondos_reserva)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: t.sur2 }}>
                <td colSpan={4} style={{ ...sty.td, fontWeight: 700, textAlign: 'right' }}>TOTALES:</td>
                <td style={{ ...sty.td, fontWeight: 700 }}>{fmtMoney(reporte.total_aporte_personal)}</td>
                <td style={{ ...sty.td, fontWeight: 700 }}>{fmtMoney(reporte.total_aporte_patronal)}</td>
                <td style={{ ...sty.td, fontWeight: 800, color: t.blue }}>{fmtMoney(reporte.total_general)}</td>
                <td style={{ ...sty.td, fontWeight: 700 }}>{fmtMoney(reporte.total_fondos_reserva)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {reporte && tipoReporte === 'provisiones' && (
        <div style={sty.card}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Provisiones - {reporte.periodo}</h3>
          <table style={sty.table}>
            <thead>
              <tr>
                {['Empleado', 'Cedula', 'Ingresos', 'D.13ro', 'D.14to', 'F.Reserva', 'Vacaciones', 'Total Prov.'].map(h =>
                  <th key={h} style={sty.th}>{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {(reporte.roles || []).map((r, i) => (
                <tr key={i}>
                  <td style={sty.td}><strong>{r.apellidos} {r.nombres}</strong></td>
                  <td style={sty.td}>{r.cedula}</td>
                  <td style={sty.td}>{fmtMoney(r.total_ingresos)}</td>
                  <td style={sty.td}>{fmtMoney(r.decimo_tercero)}</td>
                  <td style={sty.td}>{fmtMoney(r.decimo_cuarto)}</td>
                  <td style={sty.td}>{fmtMoney(r.fondos_reserva)}</td>
                  <td style={sty.td}>{fmtMoney(r.vacaciones_provision)}</td>
                  <td style={{ ...sty.td, fontWeight: 700, color: t.purple }}>{fmtMoney(r.total_provisiones)}</td>
                </tr>
              ))}
            </tbody>
            {reporte.totales && (
              <tfoot>
                <tr style={{ background: t.sur2 }}>
                  <td colSpan={3} style={{ ...sty.td, fontWeight: 700, textAlign: 'right' }}>TOTALES:</td>
                  <td style={{ ...sty.td, fontWeight: 700 }}>{fmtMoney(reporte.totales.decimo_tercero)}</td>
                  <td style={{ ...sty.td, fontWeight: 700 }}>{fmtMoney(reporte.totales.decimo_cuarto)}</td>
                  <td style={{ ...sty.td, fontWeight: 700 }}>{fmtMoney(reporte.totales.fondos_reserva)}</td>
                  <td style={{ ...sty.td, fontWeight: 700 }}>{fmtMoney(reporte.totales.vacaciones)}</td>
                  <td style={{ ...sty.td, fontWeight: 800, color: t.purple, fontSize: 14 }}>{fmtMoney(reporte.totales.total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </>
  )
}


// ══════════════════════════════════════════════════════════════════
//  TAB CONFIG
// ══════════════════════════════════════════════════════════════════
function TabConfig({ sty, t }) {
  const [config, setConfig] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/nomina/config').then(r => setConfig(r.data)).catch(() => {})
  }, [])

  const set = (k, v) => setConfig(p => ({ ...p, [k]: v }))

  const save = async () => {
    setSaving(true)
    try {
      await api.put('/nomina/config', {
        sbu: parseFloat(config.sbu),
        aporte_personal_pct: parseFloat(config.aporte_personal_pct),
        aporte_patronal_pct: parseFloat(config.aporte_patronal_pct),
        fondos_reserva_pct: parseFloat(config.fondos_reserva_pct),
        anio: parseInt(config.anio),
      })
      alert('Configuracion guardada')
    } catch (err) {
      alert('Error al guardar')
    }
    setSaving(false)
  }

  if (!config) return <div style={sty.card}>Cargando...</div>

  return (
    <>
      <div style={sty.card}>
        <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Configuracion de Nomina</h3>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ minWidth: 200 }}>
            <label style={sty.label}>SBU (Salario Basico Unificado) $</label>
            <input type="number" value={config.sbu} onChange={e => set('sbu', e.target.value)}
              style={sty.input} step="0.01" />
          </div>
          <div style={{ minWidth: 200 }}>
            <label style={sty.label}>Aporte Personal IESS %</label>
            <input type="number" value={config.aporte_personal_pct} onChange={e => set('aporte_personal_pct', e.target.value)}
              style={sty.input} step="0.01" />
          </div>
          <div style={{ minWidth: 200 }}>
            <label style={sty.label}>Aporte Patronal IESS %</label>
            <input type="number" value={config.aporte_patronal_pct} onChange={e => set('aporte_patronal_pct', e.target.value)}
              style={sty.input} step="0.01" />
          </div>
          <div style={{ minWidth: 200 }}>
            <label style={sty.label}>Fondos de Reserva %</label>
            <input type="number" value={config.fondos_reserva_pct} onChange={e => set('fondos_reserva_pct', e.target.value)}
              style={sty.input} step="0.01" />
          </div>
          <div style={{ minWidth: 120 }}>
            <label style={sty.label}>Ano Fiscal</label>
            <input type="number" value={config.anio} onChange={e => set('anio', e.target.value)}
              style={sty.input} />
          </div>
        </div>

        <button onClick={save} disabled={saving} style={sty.btn()}>
          {saving ? 'Guardando...' : 'Guardar Configuracion'}
        </button>
      </div>

      {/* Tabla de Impuesto a la Renta */}
      <div style={sty.card}>
        <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Tabla de Impuesto a la Renta 2026 (Referencia)</h3>
        <table style={sty.table}>
          <thead>
            <tr>
              <th style={sty.th}>Fraccion Basica</th>
              <th style={sty.th}>Exceso Hasta</th>
              <th style={sty.th}>% Fraccion Excedente</th>
            </tr>
          </thead>
          <tbody>
            {[
              [0, 11902, '0%'],
              [11902, 15159, '5%'],
              [15159, 19682, '10%'],
              [19682, 26031, '12%'],
              [26031, 34255, '15%'],
              [34255, 45407, '20%'],
              [45407, 60450, '25%'],
              [60450, 80605, '30%'],
              [80605, 'En adelante', '35%'],
            ].map((row, i) => (
              <tr key={i}>
                <td style={sty.td}>{fmtMoney(row[0])}</td>
                <td style={sty.td}>{typeof row[1] === 'number' ? fmtMoney(row[1]) : row[1]}</td>
                <td style={{ ...sty.td, fontWeight: 600 }}>{row[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 11, color: t.muted, marginTop: 8 }}>
          * Tabla referencial del SRI para el ano fiscal 2026. Los valores son aproximados y deben verificarse con la normativa vigente.
        </p>
      </div>

      {/* Info IESS */}
      <div style={sty.card}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>Tasas IESS Vigentes</h3>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Aporte Personal', value: `${config.aporte_personal_pct}%`, color: t.blue },
            { label: 'Aporte Patronal', value: `${config.aporte_patronal_pct}%`, color: t.purple },
            { label: 'Total Aporte', value: `${(parseFloat(config.aporte_personal_pct) + parseFloat(config.aporte_patronal_pct)).toFixed(2)}%`, color: t.green },
            { label: 'Fondos de Reserva', value: `${config.fondos_reserva_pct}%`, color: t.amber },
          ].map((item, i) => (
            <div key={i} style={{
              padding: '12px 20px', background: item.color + '15', borderRadius: 8,
              border: `1px solid ${item.color}33`, minWidth: 140, textAlign: 'center',
            }}>
              <div style={{ fontSize: 11, color: t.muted, marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
