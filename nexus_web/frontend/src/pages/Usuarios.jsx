// ============================================================
//  NEXUS POS — Usuarios y Permisos
//  Gestión de usuarios, roles y accesos del sistema
// ============================================================
import React, { useState, useEffect } from 'react'
import { Users, Plus, Edit2, ToggleLeft, ToggleRight, Shield, Key, Search, RotateCcw, Save, X, Check } from 'lucide-react'
import api from '../api'
import { useTheme } from '../theme'

// ── paleta ────────────────────────────────────────────────────
const C = {
  bg:'#0A0F1E', surface:'#111827', sur2:'#1F2937', sur3:'#374151',
  border:'#1F2937', bord2:'#374151',
  text:'#F9FAFB', muted:'#9CA3AF', hint:'#6B7280',
  blue:'#3B82F6', green:'#10B981', amber:'#F59E0B', red:'#EF4444',
  purple:'#8B5CF6', cyan:'#06B6D4',
  blueD:'rgba(59,130,246,.15)', greenD:'rgba(16,185,129,.15)',
  amberD:'rgba(245,158,11,.15)', redD:'rgba(239,68,68,.15)',
  purpleD:'rgba(139,92,246,.15)',
}

// ── colores de roles ──────────────────────────────────────────
const ROLE_COLORS = {
  admin:     { bg: C.redD,    color: '#FCA5A5' },
  gerente:   { bg: C.purpleD, color: '#C4B5FD' },
  vendedor:  { bg: C.blueD,   color: '#93C5FD' },
  cajero:    { bg: C.greenD,  color: '#6EE7B7' },
  bodeguero: { bg: C.amberD,  color: '#FCD34D' },
  contador:  { bg: 'rgba(6,182,212,.15)', color: '#67E8F9' },
}

const ROLES_FALLBACK = [
  { nombre: 'admin',     descripcion: 'Acceso total al sistema' },
  { nombre: 'gerente',   descripcion: 'Gestión general y reportes' },
  { nombre: 'vendedor',  descripcion: 'Ventas y consulta de productos' },
  { nombre: 'cajero',    descripcion: 'Facturación y cobros' },
  { nombre: 'bodeguero', descripcion: 'Inventario y stock' },
  { nombre: 'contador',  descripcion: 'Contabilidad y finanzas' },
]

// ── Modal Cambiar Contraseña ──────────────────────────────────
function ModalPassword({ usuario, onClose, onSaved }) {
  const C = useTheme()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState('')

  async function guardar() {
    if (!password.trim()) return setErr('La contraseña es obligatoria')
    if (password.length < 6) return setErr('Mínimo 6 caracteres')
    if (password !== confirm) return setErr('Las contraseñas no coinciden')
    setSaving(true); setErr('')
    try {
      await api.patch(`/usuarios/${usuario.id}/password`, { password })
      onSaved()
    } catch (e) { setErr(e.response?.data?.detail || e.message) }
    finally { setSaving(false) }
  }

  const fi = { width:'100%', padding:'9px 12px', borderRadius:8, fontSize:13,
    border:`1px solid ${C.border}`, background:C.sur2, color:C.text,
    outline:'none', boxSizing:'border-box' }
  const lbl = { fontSize:11, fontWeight:600, color:C.muted, display:'block',
    marginBottom:4, textTransform:'uppercase', letterSpacing:'.05em' }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',display:'flex',
      alignItems:'center',justifyContent:'center',zIndex:9100}}>
      <div style={{background:C.surface,borderRadius:16,padding:28,width:400,
        border:`1px solid ${C.border}`,boxShadow:'0 25px 60px rgba(0,0,0,.6)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <Key size={18} style={{color:C.amber}}/>
            <span style={{fontSize:16,fontWeight:700,color:C.text}}>Cambiar contraseña</span>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:20}}>×</button>
        </div>

        <div style={{padding:'10px 14px',borderRadius:8,background:C.sur2,
          border:`1px solid ${C.border}`,marginBottom:18,fontSize:13,color:C.muted}}>
          Usuario: <strong style={{color:C.text}}>{usuario.username}</strong> — {usuario.nombre_completo}
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <label style={lbl}>Nueva contraseña <span style={{color:C.red}}>*</span></label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres" style={fi}/>
          </div>
          <div>
            <label style={lbl}>Confirmar contraseña <span style={{color:C.red}}>*</span></label>
            <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)}
              placeholder="Repite la contraseña" style={fi}/>
          </div>
        </div>

        {err && <div style={{marginTop:14,padding:'9px 14px',borderRadius:8,
          background:C.redD,border:'1px solid rgba(239,68,68,.3)',
          color:'#FCA5A5',fontSize:13}}>{err}</div>}

        <div style={{display:'flex',gap:10,marginTop:22,justifyContent:'flex-end'}}>
          <button onClick={onClose} style={{padding:'9px 20px',borderRadius:9,
            border:`1px solid ${C.border}`,background:'transparent',
            color:C.muted,cursor:'pointer',fontSize:13}}>Cancelar</button>
          <button onClick={guardar} disabled={saving} style={{padding:'9px 24px',
            borderRadius:9,border:'none',background:C.amber,color:'#1F2937',
            cursor:'pointer',fontSize:13,fontWeight:700}}>
            {saving ? 'Guardando...' : 'Cambiar contraseña'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal Crear / Editar Usuario ──────────────────────────────
function ModalUsuario({ usuario, sucursales, roles, onClose, onSaved }) {
  const C = useTheme()
  const esEdit = !!usuario?.id
  const [form, setForm] = useState({
    username:         usuario?.username         ?? '',
    nombre_completo:  usuario?.nombre_completo  ?? '',
    email:            usuario?.email            ?? '',
    telefono:         usuario?.telefono         ?? '',
    sucursal_id:      usuario?.sucursal_id      ?? '',
    rol:              usuario?.rol              ?? 'vendedor',
    password:         '',
    activo:           usuario?.activo           ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')
  const s = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function guardar() {
    if (!form.username.trim()) return setErr('El nombre de usuario es obligatorio')
    if (!form.nombre_completo.trim()) return setErr('El nombre completo es obligatorio')
    if (!esEdit && !form.password.trim()) return setErr('La contraseña es obligatoria para nuevos usuarios')
    if (!esEdit && form.password.length < 6) return setErr('La contraseña debe tener mínimo 6 caracteres')
    setSaving(true); setErr('')
    try {
      const payload = {
        ...form,
        nombre: form.nombre_completo,
        sucursal_id: form.sucursal_id ? Number(form.sucursal_id) : null,
      }
      delete payload.nombre_completo
      // On edit, don't send empty password
      if (esEdit && !payload.password.trim()) delete payload.password
      if (esEdit) await api.put(`/usuarios/${usuario.id}`, payload)
      else        await api.post('/usuarios', payload)
      onSaved()
    } catch (e) { setErr(e.response?.data?.detail || e.message) }
    finally { setSaving(false) }
  }

  const fi = { width:'100%', padding:'9px 12px', borderRadius:8, fontSize:13,
    border:`1px solid ${C.border}`, background:C.sur2, color:C.text,
    outline:'none', boxSizing:'border-box' }
  const lbl = { fontSize:11, fontWeight:600, color:C.muted, display:'block',
    marginBottom:4, textTransform:'uppercase', letterSpacing:'.05em' }

  const rolActual = roles.find(r => r.nombre === form.rol)

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',display:'flex',
      alignItems:'center',justifyContent:'center',zIndex:9000}}>
      <div style={{background:C.surface,borderRadius:16,padding:28,width:560,
        maxHeight:'90vh',overflowY:'auto',border:`1px solid ${C.border}`,
        boxShadow:'0 25px 60px rgba(0,0,0,.6)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            {esEdit ? <Edit2 size={18} style={{color:C.blue}}/> : <Plus size={18} style={{color:C.green}}/>}
            <span style={{fontSize:16,fontWeight:700,color:C.text}}>
              {esEdit ? 'Editar usuario' : 'Nuevo usuario'}
            </span>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:20}}>×</button>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <div>
            <label style={lbl}>Username <span style={{color:C.red}}>*</span></label>
            <input value={form.username} onChange={e=>s('username',e.target.value)}
              disabled={esEdit} placeholder="ej: jperez"
              style={{...fi,opacity:esEdit?.6:1}}/>
          </div>

          <div>
            <label style={lbl}>Nombre completo <span style={{color:C.red}}>*</span></label>
            <input value={form.nombre_completo} onChange={e=>s('nombre_completo',e.target.value)}
              placeholder="Juan Pérez" style={fi}/>
          </div>

          <div>
            <label style={lbl}>Email</label>
            <input type="email" value={form.email} onChange={e=>s('email',e.target.value)}
              placeholder="correo@empresa.com" style={fi}/>
          </div>

          <div>
            <label style={lbl}>Teléfono</label>
            <input value={form.telefono} onChange={e=>s('telefono',e.target.value)}
              placeholder="0999999999" style={fi}/>
          </div>

          <div style={{gridColumn:'1/-1'}}>
            <label style={lbl}>Sucursal</label>
            <select value={form.sucursal_id} onChange={e=>s('sucursal_id',e.target.value)} style={fi}>
              <option value="">— Sin asignar —</option>
              {sucursales.map(sc=><option key={sc.id} value={sc.id}>{sc.nombre}</option>)}
            </select>
          </div>

          <div style={{gridColumn:'1/-1'}}>
            <label style={lbl}>Rol <span style={{color:C.red}}>*</span></label>
            <select value={form.rol} onChange={e=>s('rol',e.target.value)} style={fi}>
              {roles.map(r=>(
                <option key={r.nombre} value={r.nombre}>
                  {r.nombre.charAt(0).toUpperCase()+r.nombre.slice(1)} — {r.descripcion}
                </option>
              ))}
            </select>
            {rolActual && (
              <div style={{marginTop:6,display:'flex',alignItems:'center',gap:8}}>
                <span style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,
                  background:ROLE_COLORS[form.rol]?.bg||C.blueD,
                  color:ROLE_COLORS[form.rol]?.color||'#93C5FD'}}>
                  {form.rol}
                </span>
                <span style={{fontSize:11,color:C.hint}}>{rolActual.descripcion}</span>
              </div>
            )}
          </div>

          <div style={{gridColumn:'1/-1'}}>
            <label style={lbl}>
              Contraseña {!esEdit && <span style={{color:C.red}}>*</span>}
            </label>
            <input type="password" value={form.password} onChange={e=>s('password',e.target.value)}
              placeholder={esEdit ? 'Dejar vacío para mantener la actual' : 'Mínimo 6 caracteres'}
              style={fi}/>
            {esEdit && (
              <div style={{fontSize:11,color:C.hint,marginTop:4}}>
                Dejar vacío para mantener la contraseña actual
              </div>
            )}
          </div>

          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <input type="checkbox" id="uact" checked={form.activo}
              onChange={e=>s('activo',e.target.checked)}
              style={{width:16,height:16,cursor:'pointer',accentColor:C.blue}}/>
            <label htmlFor="uact" style={{color:C.text,fontSize:13,cursor:'pointer'}}>Usuario activo</label>
          </div>
        </div>

        {err && <div style={{marginTop:14,padding:'9px 14px',borderRadius:8,
          background:C.redD,border:'1px solid rgba(239,68,68,.3)',
          color:'#FCA5A5',fontSize:13}}>{err}</div>}

        <div style={{display:'flex',gap:10,marginTop:22,justifyContent:'flex-end'}}>
          <button onClick={onClose} style={{padding:'9px 20px',borderRadius:9,
            border:`1px solid ${C.border}`,background:'transparent',
            color:C.muted,cursor:'pointer',fontSize:13}}>Cancelar</button>
          <button onClick={guardar} disabled={saving} style={{padding:'9px 24px',
            borderRadius:9,border:'none',background:C.blue,color:'white',
            cursor:'pointer',fontSize:13,fontWeight:700}}>
            {saving ? 'Guardando...' : esEdit ? 'Guardar cambios' : 'Crear usuario'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Definición de módulos, grupos y acciones ─────────────────
const ACCIONES = ['ver','crear','editar','eliminar']
const ACCION_LABELS = { ver:'VER', crear:'CREAR', editar:'EDITAR', eliminar:'ELIMINAR' }
const ACCION_COLORS = {
  ver:      { bg:'rgba(59,130,246,.18)', color:C.blue,  border:'rgba(59,130,246,.4)' },
  crear:    { bg:'rgba(16,185,129,.18)', color:C.green, border:'rgba(16,185,129,.4)' },
  editar:   { bg:'rgba(245,158,11,.18)', color:C.amber, border:'rgba(245,158,11,.4)' },
  eliminar: { bg:'rgba(239,68,68,.18)',  color:C.red,   border:'rgba(239,68,68,.4)' },
}
const GRUPOS = [
  {nombre:'Principal', modulos:['dashboard']},
  {nombre:'Ventas', modulos:['facturas','notas-venta','clientes','cxc','devoluciones','cotizaciones','crm','notas-debito','guias-remision']},
  {nombre:'Inventario', modulos:['productos','stock','gestion-precios','etiquetas','transferencias','ajustes','kardex','toma-fisica']},
  {nombre:'Compras', modulos:['compras','proveedores','retenciones','liquidaciones']},
  {nombre:'Finanzas', modulos:['caja','bancos','depositos','conciliacion','cxp']},
  {nombre:'Contabilidad', modulos:['contabilidad']},
  {nombre:'Servicio', modulos:['servicio-tecnico']},
  {nombre:'RRHH', modulos:['vendedores','nomina']},
  {nombre:'Reportes', modulos:['reportes']},
  {nombre:'Sistema', modulos:['configuracion','usuarios','sri']},
]
const MOD_NOMBRES = {
  'dashboard':'Dashboard','facturas':'Facturación','notas-venta':'Notas de Venta','clientes':'Clientes',
  'cxc':'CXC','devoluciones':'Devoluciones','cotizaciones':'Cotizaciones',
  'crm':'CRM','notas-debito':'Notas de Débito','guias-remision':'Guías Remisión',
  'productos':'Productos','stock':'Stock','gestion-precios':'Precios',
  'etiquetas':'Etiquetas','transferencias':'Transferencias','ajustes':'Ajustes',
  'kardex':'Kardex','toma-fisica':'Toma Física',
  'compras':'Compras','proveedores':'Proveedores',
  'retenciones':'Retenciones','liquidaciones':'Liquidaciones',
  'caja':'Caja','bancos':'Bancos','depositos':'Depósitos','conciliacion':'Conciliación','cxp':'CXP',
  'contabilidad':'Contabilidad',
  'servicio-tecnico':'Servicio Técnico',
  'vendedores':'Vendedores','nomina':'Nómina',
  'reportes':'Reportes',
  'configuracion':'Configuración','usuarios':'Usuarios','sri':'Facturación Electrónica',
}
const ALL_MODULOS = GRUPOS.flatMap(g => g.modulos)

// ── Modal Permisos (granular) ────────────────────────────────
function ModalPermisos({ usuario, roles, onClose }) {
  const C = useTheme()
  // permisos: {modulo: [acciones]}  e.g. {"facturas":["ver","crear"], "dashboard":["ver"]}
  const [permisos, setPermisos]           = useState({})
  const [personalizado, setPersonalizado] = useState(false)
  const [plantillas, setPlantillas]       = useState({}) // {rolName: {modulo:[acciones]}}
  const [loading, setLoading]             = useState(true)
  const [saving, setSaving]               = useState(false)
  const [msg, setMsg]                     = useState(null)

  // Cargar permisos actuales y plantillas de roles
  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const [perm, rolesData] = await Promise.all([
          api.get(`/usuarios/${usuario.id}/permisos`),
          api.get('/usuarios/roles').catch(() => ({ data: [] })),
        ])
        setPermisos(perm.data.permisos || {})
        setPersonalizado(!!perm.data.personalizado)
        const map = {}
        ;(rolesData.data || []).forEach(r => { if (r.permisos) map[r.nombre] = r.permisos })
        setPlantillas(map)
      } catch (e) {
        console.error(e)
        setMsg({ type:'err', text:'Error al cargar permisos' })
      } finally { setLoading(false) }
    })()
  }, [usuario.id])

  // Toggle a single action for a module
  function toggleAccion(modulo, accion) {
    setPermisos(prev => {
      const curr = prev[modulo] || []
      let next
      if (accion === 'ver') {
        // Unchecking VER removes all actions for this module
        if (curr.includes('ver')) {
          next = []
        } else {
          next = ['ver']
        }
      } else {
        if (curr.includes(accion)) {
          next = curr.filter(a => a !== accion)
        } else {
          // Auto-check VER when any other action is checked
          next = curr.includes('ver') ? [...curr, accion] : ['ver', ...curr, accion]
        }
      }
      const out = { ...prev }
      if (next.length === 0) delete out[modulo]
      else out[modulo] = next
      return out
    })
  }

  function aplicarPlantilla(rol) {
    const pl = plantillas[rol]
    if (pl) setPermisos(JSON.parse(JSON.stringify(pl)))
  }

  async function guardar() {
    setSaving(true); setMsg(null)
    try {
      await api.post(`/usuarios/${usuario.id}/permisos`, { permisos })
      setMsg({ type:'ok', text:'Permisos guardados correctamente' })
      setPersonalizado(true)
    } catch (e) {
      setMsg({ type:'err', text: e.response?.data?.detail || e.message })
    } finally { setSaving(false) }
  }

  async function resetear() {
    setSaving(true); setMsg(null)
    try {
      await api.delete(`/usuarios/${usuario.id}/permisos`)
      const perm = await api.get(`/usuarios/${usuario.id}/permisos`)
      setPermisos(perm.data.permisos || {})
      setPersonalizado(false)
      setMsg({ type:'ok', text:'Permisos reseteados a la plantilla del rol' })
    } catch (e) {
      setMsg({ type:'err', text: e.response?.data?.detail || e.message })
    } finally { setSaving(false) }
  }

  const rc = ROLE_COLORS[usuario.rol] || { bg:C.blueD, color:'#93C5FD' }
  const modulosConAcceso = Object.keys(permisos).filter(m => permisos[m]?.length > 0).length
  const presetRoles = ['admin','gerente','vendedor','cajero','bodeguero','contador']

  // Check if current permisos matches a preset exactly
  function matchesPreset(rol) {
    const pl = plantillas[rol]
    if (!pl) return false
    const plKeys = Object.keys(pl).filter(k => pl[k]?.length > 0).sort()
    const curKeys = Object.keys(permisos).filter(k => permisos[k]?.length > 0).sort()
    if (plKeys.length !== curKeys.length) return false
    return plKeys.every(k =>
      curKeys.includes(k) &&
      pl[k].length === (permisos[k]||[]).length &&
      pl[k].every(a => (permisos[k]||[]).includes(a))
    )
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',display:'flex',
      alignItems:'center',justifyContent:'center',zIndex:9200}}>
      <div style={{background:C.surface,borderRadius:16,padding:28,width:780,
        maxHeight:'90vh',overflowY:'auto',border:`1px solid ${C.border}`,
        boxShadow:'0 25px 60px rgba(0,0,0,.6)'}}>

        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <Shield size={20} style={{color:C.purple}}/>
            <span style={{fontSize:17,fontWeight:700,color:C.text}}>
              Permisos de {usuario.nombre_completo}
            </span>
            <span style={{padding:'3px 12px',borderRadius:20,fontSize:11,fontWeight:700,
              background:rc.bg,color:rc.color,textTransform:'capitalize'}}>
              {usuario.rol}
            </span>
            {personalizado && (
              <span style={{padding:'3px 10px',borderRadius:20,fontSize:10,fontWeight:700,
                background:C.amberD,color:'#FCD34D',textTransform:'uppercase',letterSpacing:'.05em'}}>
                Personalizado
              </span>
            )}
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',
            color:C.muted,fontSize:22,lineHeight:1}}>×</button>
        </div>

        {loading ? (
          <div style={{padding:40,textAlign:'center',color:C.hint,fontSize:13}}>
            Cargando permisos...
          </div>
        ) : (
          <>
            {/* Preset buttons row */}
            <div style={{marginBottom:18}}>
              <div style={{fontSize:11,fontWeight:600,color:C.hint,textTransform:'uppercase',
                letterSpacing:'.05em',marginBottom:8}}>
                Aplicar plantilla de rol
              </div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
                {presetRoles.map(rol => {
                  const prc = ROLE_COLORS[rol] || { bg:C.blueD, color:'#93C5FD' }
                  const isActive = matchesPreset(rol)
                  return (
                    <button key={rol} onClick={() => aplicarPlantilla(rol)}
                      disabled={!plantillas[rol]}
                      style={{padding:'6px 14px',borderRadius:8,fontSize:12,fontWeight:600,
                        cursor:plantillas[rol]?'pointer':'not-allowed',
                        border: isActive ? `2px solid ${prc.color}` : `1px solid ${C.bord2}`,
                        background: isActive ? prc.bg : C.sur2,
                        color: isActive ? prc.color : C.muted,
                        textTransform:'capitalize',transition:'all .15s',
                        opacity:plantillas[rol]?1:.5}}>
                      {rol}
                    </button>
                  )
                })}
                <div style={{width:1,height:24,background:C.bord2,margin:'0 4px'}}/>
                <button onClick={resetear} disabled={saving}
                  style={{padding:'6px 14px',borderRadius:8,fontSize:12,fontWeight:600,
                    cursor:'pointer',border:`1px solid ${C.bord2}`,background:C.sur2,
                    color:C.amber,display:'flex',alignItems:'center',gap:5,transition:'all .15s'}}>
                  <RotateCcw size={12}/> Resetear a plantilla del rol
                </button>
              </div>
            </div>

            {/* Permissions grid by group */}
            <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:18}}>
              {GRUPOS.map(grupo => (
                <div key={grupo.nombre} style={{background:C.sur2,borderRadius:10,
                  border:`1px solid ${C.border}`,overflow:'hidden'}}>
                  {/* Group header */}
                  <div style={{padding:'8px 14px',background:C.sur3,
                    borderBottom:`1px solid ${C.border}`,
                    display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <span style={{fontSize:12,fontWeight:700,color:C.text,
                      textTransform:'uppercase',letterSpacing:'.06em'}}>
                      {grupo.nombre}
                    </span>
                    <div style={{display:'flex',gap:16,alignItems:'center'}}>
                      {ACCIONES.map(acc => (
                        <span key={acc} style={{fontSize:10,fontWeight:700,
                          color:ACCION_COLORS[acc].color,textTransform:'uppercase',
                          letterSpacing:'.04em',width:52,textAlign:'center'}}>
                          {ACCION_LABELS[acc]}
                        </span>
                      ))}
                    </div>
                  </div>
                  {/* Module rows */}
                  <div style={{display:'flex',flexDirection:'column'}}>
                    {grupo.modulos.map((mod, idx) => {
                      const acciones = permisos[mod] || []
                      const tieneVer = acciones.includes('ver')
                      return (
                        <div key={mod} style={{
                          display:'flex',alignItems:'center',justifyContent:'space-between',
                          padding:'8px 14px',
                          borderBottom: idx < grupo.modulos.length - 1
                            ? `1px solid ${C.border}` : 'none',
                          background: tieneVer ? 'rgba(59,130,246,.04)' : 'transparent',
                          transition:'background .15s'}}>
                          {/* Module name */}
                          <span style={{fontSize:13,fontWeight: tieneVer ? 600 : 400,
                            color: tieneVer ? C.text : C.muted,minWidth:160}}>
                            {MOD_NOMBRES[mod] || mod}
                          </span>
                          {/* Action checkboxes */}
                          <div style={{display:'flex',gap:16,alignItems:'center'}}>
                            {ACCIONES.map(acc => {
                              const checked = acciones.includes(acc)
                              const disabled = acc !== 'ver' && !tieneVer
                              const ac = ACCION_COLORS[acc]
                              return (
                                <div key={acc} style={{width:52,display:'flex',justifyContent:'center'}}>
                                  <label style={{
                                    display:'flex',alignItems:'center',justifyContent:'center',
                                    width:32,height:24,borderRadius:5,cursor: disabled ? 'not-allowed' : 'pointer',
                                    background: checked ? ac.bg : 'transparent',
                                    border:`1px solid ${checked ? ac.border : C.border}`,
                                    opacity: disabled ? 0.35 : 1,
                                    transition:'all .15s'}}>
                                    <input type="checkbox" checked={checked}
                                      disabled={disabled}
                                      onChange={() => toggleAccion(mod, acc)}
                                      style={{width:14,height:14,cursor: disabled ? 'not-allowed' : 'pointer',
                                        accentColor:ac.color,flexShrink:0}}/>
                                  </label>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Message */}
            {msg && (
              <div style={{marginBottom:14,padding:'9px 14px',borderRadius:8,
                background: msg.type==='ok' ? C.greenD : C.redD,
                border:`1px solid ${msg.type==='ok' ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)'}`,
                color: msg.type==='ok' ? '#6EE7B7' : '#FCA5A5',
                fontSize:13,display:'flex',alignItems:'center',gap:8}}>
                {msg.type==='ok' ? <Check size={14}/> : <X size={14}/>}
                {msg.text}
              </div>
            )}

            {/* Footer */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:12,color:C.hint}}>
                {modulosConAcceso} de {ALL_MODULOS.length} módulos con acceso
              </span>
              <div style={{display:'flex',gap:10}}>
                <button onClick={onClose} style={{padding:'9px 20px',borderRadius:9,
                  border:`1px solid ${C.border}`,background:'transparent',
                  color:C.muted,cursor:'pointer',fontSize:13}}>
                  Cancelar
                </button>
                <button onClick={guardar} disabled={saving}
                  style={{padding:'9px 24px',borderRadius:9,border:'none',
                    background:C.blue,color:'white',cursor:'pointer',
                    fontSize:13,fontWeight:700,display:'flex',alignItems:'center',gap:6}}>
                  <Save size={14}/>
                  {saving ? 'Guardando...' : 'Guardar permisos'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
export default function Usuarios() {
  const C = useTheme()
  const [usuarios,   setUsuarios]   = useState([])
  const [sucursales, setSucursales] = useState([])
  const [roles,      setRoles]      = useState(ROLES_FALLBACK)
  const [loading,    setLoading]    = useState(true)
  const [busqueda,   setBusqueda]   = useState('')
  const [filtActivo, setFiltActivo] = useState('true')
  const [modal,      setModal]      = useState(null)   // null|'nuevo'|usuarioObj
  const [pwModal,    setPwModal]    = useState(null)    // null|usuarioObj
  const [permModal,  setPermModal]  = useState(null)    // null|usuarioObj

  async function cargar(bus = busqueda) {
    setLoading(true)
    try {
      const params = { busqueda: bus || undefined }
      if (filtActivo !== '') params.activo = filtActivo
      const [u, s, r] = await Promise.all([
        api.get('/usuarios', { params }),
        api.get('/sucursales').catch(() => ({ data: [] })),
        api.get('/usuarios/roles').catch(() => ({ data: ROLES_FALLBACK })),
      ])
      setUsuarios(u.data)
      setSucursales(s.data)
      if (r.data?.length) setRoles(r.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [filtActivo])

  async function toggleActivo(u) {
    try {
      await api.patch(`/usuarios/${u.id}/toggle`)
      cargar()
    } catch (e) { console.error(e) }
  }

  const activos = usuarios.filter(u => u.activo).length

  const TH = { padding:'11px 14px', fontSize:11, fontWeight:700, color:C.hint,
    textTransform:'uppercase', letterSpacing:'.06em',
    borderBottom:`1px solid ${C.border}`, background:C.surface,
    whiteSpace:'nowrap', textAlign:'left' }
  const TD = { padding:'12px 14px', fontSize:13, color:C.text,
    borderBottom:`1px solid ${C.border}`, verticalAlign:'middle' }

  return (
    <div style={{background:C.bg,minHeight:'100vh',padding:'24px 28px',
      fontFamily:"'Inter','Segoe UI',system-ui,sans-serif",color:C.text}}>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <Shield size={24} style={{color:C.blue}}/>
            <h1 style={{margin:0,fontSize:24,fontWeight:800,color:C.text}}>Usuarios y Permisos</h1>
          </div>
          <p style={{margin:'4px 0 0',color:C.muted,fontSize:13}}>
            {activos} usuarios activos · {usuarios.length} total
          </p>
        </div>
        <button onClick={()=>setModal('nuevo')}
          style={{display:'flex',alignItems:'center',gap:7,padding:'10px 20px',
            borderRadius:10,border:'none',background:C.blue,color:'white',
            cursor:'pointer',fontSize:14,fontWeight:700,
            boxShadow:'0 4px 14px rgba(59,130,246,.4)'}}>
          <Plus size={16}/> Nuevo usuario
        </button>
      </div>

      {/* Filtros */}
      <div style={{background:C.surface,borderRadius:12,padding:'14px 16px',
        border:`1px solid ${C.border}`,marginBottom:16,
        display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>

        <div style={{position:'relative',flex:1,minWidth:260}}>
          <Search size={15} style={{position:'absolute',left:12,top:'50%',
            transform:'translateY(-50%)',color:C.hint}}/>
          <input value={busqueda}
            onChange={e=>setBusqueda(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&cargar(busqueda)}
            placeholder="Buscar por usuario, nombre o email..."
            style={{paddingLeft:34,width:'100%',padding:'9px 12px 9px 34px',
              borderRadius:9,border:`1px solid ${C.border}`,
              background:C.sur2,color:C.text,fontSize:13,
              outline:'none',boxSizing:'border-box'}}/>
        </div>

        <button onClick={()=>cargar(busqueda)}
          style={{padding:'9px 16px',borderRadius:9,border:'none',
            background:C.blue,color:'white',cursor:'pointer',
            fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:6}}>
          <Search size={13}/> Buscar
        </button>

        <div style={{display:'flex',borderRadius:9,overflow:'hidden',
          border:`1px solid ${C.border}`}}>
          {[['true','Activos'],['false','Inactivos'],['','Todos']].map(([v,l])=>(
            <button key={v} onClick={()=>setFiltActivo(v)}
              style={{padding:'9px 14px',border:'none',cursor:'pointer',fontSize:12,fontWeight:600,
                background:filtActivo===v?C.blue:C.sur2,
                color:filtActivo===v?'white':C.muted,transition:'all .15s'}}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div style={{background:C.surface,borderRadius:12,border:`1px solid ${C.border}`,overflow:'hidden'}}>
        {loading ? (
          <div style={{padding:40,textAlign:'center',color:C.hint,fontSize:13}}>Cargando usuarios...</div>
        ) : usuarios.length === 0 ? (
          <div style={{padding:40,textAlign:'center',color:C.hint,fontSize:13}}>
            No se encontraron usuarios
          </div>
        ) : (
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr>
                {['Usuario','Nombre','Email','Sucursal','Rol','Estado','Acciones'].map((h,i)=>(
                  <th key={i} style={{...TH,textAlign:i>=4?'center':'left'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => {
                const rc = ROLE_COLORS[u.rol] || { bg:C.blueD, color:'#93C5FD' }
                return (
                  <tr key={u.id}
                    onMouseEnter={e=>e.currentTarget.style.background=C.sur2}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>

                    {/* Usuario */}
                    <td style={TD}>
                      <code style={{fontSize:12,color:C.purple,fontWeight:700,
                        background:C.purpleD,padding:'2px 8px',borderRadius:4}}>
                        {u.username}
                      </code>
                    </td>

                    {/* Nombre */}
                    <td style={TD}>
                      <div style={{fontWeight:700,color:C.text}}>{u.nombre_completo}</div>
                      {u.telefono && <div style={{fontSize:11,color:C.hint}}>{u.telefono}</div>}
                    </td>

                    {/* Email */}
                    <td style={{...TD,color:C.muted,fontSize:12}}>
                      {u.email || <span style={{color:C.hint}}>—</span>}
                    </td>

                    {/* Sucursal */}
                    <td style={TD}>
                      {u.sucursal_nombre
                        ? <span style={{background:C.blueD,color:'#93C5FD',
                            padding:'3px 10px',borderRadius:6,fontSize:12,fontWeight:600}}>
                            {u.sucursal_nombre}
                          </span>
                        : <span style={{color:C.hint,fontSize:12}}>—</span>
                      }
                    </td>

                    {/* Rol */}
                    <td style={{...TD,textAlign:'center'}}>
                      <span style={{padding:'3px 12px',borderRadius:20,fontSize:11,fontWeight:700,
                        background:rc.bg,color:rc.color,textTransform:'capitalize'}}>
                        {u.rol}
                      </span>
                    </td>

                    {/* Estado */}
                    <td style={{...TD,textAlign:'center'}}>
                      <button onClick={()=>toggleActivo(u)} title={u.activo?'Desactivar':'Activar'}
                        style={{background:'none',border:'none',cursor:'pointer',
                          display:'inline-flex',alignItems:'center',gap:6}}>
                        {u.activo
                          ? <ToggleRight size={22} style={{color:C.green}}/>
                          : <ToggleLeft size={22} style={{color:C.hint}}/>
                        }
                        <span style={{fontSize:11,fontWeight:700,
                          color:u.activo?C.green:C.hint}}>
                          {u.activo?'Activo':'Inactivo'}
                        </span>
                      </button>
                    </td>

                    {/* Acciones */}
                    <td style={{...TD,textAlign:'center'}}>
                      <div style={{display:'flex',gap:5,justifyContent:'center'}}>
                        <button onClick={()=>setModal(u)} title="Editar usuario"
                          style={{padding:'5px 9px',borderRadius:7,
                            border:`1px solid ${C.border}`,background:C.sur2,
                            color:C.muted,cursor:'pointer',display:'inline-flex',
                            alignItems:'center',gap:4,fontSize:12}}>
                          <Edit2 size={13}/>
                        </button>
                        <button onClick={()=>setPwModal(u)} title="Cambiar contraseña"
                          style={{padding:'5px 9px',borderRadius:7,
                            border:`1px solid ${C.border}`,background:C.sur2,
                            color:C.amber,cursor:'pointer',display:'inline-flex',
                            alignItems:'center',gap:4,fontSize:12}}>
                          <Key size={13}/>
                        </button>
                        <button onClick={()=>setPermModal(u)} title="Permisos"
                          style={{padding:'5px 9px',borderRadius:7,
                            border:`1px solid ${C.border}`,background:C.sur2,
                            color:C.purple,cursor:'pointer',display:'inline-flex',
                            alignItems:'center',gap:4,fontSize:12}}>
                          <Shield size={13}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {modal && (
        <ModalUsuario
          usuario={modal==='nuevo'?null:modal}
          sucursales={sucursales}
          roles={roles}
          onClose={()=>setModal(null)}
          onSaved={()=>{setModal(null);cargar()}}
        />
      )}
      {pwModal && (
        <ModalPassword
          usuario={pwModal}
          onClose={()=>setPwModal(null)}
          onSaved={()=>{setPwModal(null);cargar()}}
        />
      )}
      {permModal && (
        <ModalPermisos
          usuario={permModal}
          roles={roles}
          onClose={()=>setPermModal(null)}
        />
      )}
    </div>
  )
}
