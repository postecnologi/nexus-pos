// ============================================================
//  NEXUS POS — Administracion del Sistema
//  Backups, Auditoria, Monitor de Sistema
// ============================================================
import React, { useState, useEffect, useCallback } from 'react'
import {
  Server, Database, HardDrive, Download, Upload, Trash2, RefreshCw,
  Shield, Search, Activity, AlertTriangle, CheckCircle, XCircle,
  Clock, User, FileText, Plus, Monitor, Cpu, MemoryStick, Bell
} from 'lucide-react'
import api from '../api'
import { useTheme } from '../theme'

// ── Badge de accion ──────────────────────────────────────────
const ACCION_COLORS = {
  LOGIN:     { bg: 'rgba(59,130,246,.15)',  color: '#93C5FD' },
  CREAR:     { bg: 'rgba(16,185,129,.15)',  color: '#6EE7B7' },
  EDITAR:    { bg: 'rgba(245,158,11,.15)',  color: '#FCD34D' },
  ELIMINAR:  { bg: 'rgba(239,68,68,.15)',   color: '#FCA5A5' },
  ERROR:     { bg: 'rgba(239,68,68,.25)',   color: '#FCA5A5' },
  BACKUP:    { bg: 'rgba(139,92,246,.15)',  color: '#C4B5FD' },
  RESTAURAR: { bg: 'rgba(6,182,212,.15)',   color: '#67E8F9' },
}

function AccionBadge({ accion }) {
  const s = ACCION_COLORS[accion] || { bg: 'rgba(107,114,128,.15)', color: '#9CA3AF' }
  return (
    <span style={{ padding: '2px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700,
      background: s.bg, color: s.color, textTransform: 'uppercase', letterSpacing: '.04em' }}>
      {accion}
    </span>
  )
}

// ── Progress Bar ─────────────────────────────────────────────
function BarraUso({ pct, color, label, detalle }) {
  const C = useTheme()
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{label}</span>
        <span style={{ fontSize: 11, color: C.muted }}>{detalle}</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: C.sur3, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 4, width: `${Math.min(pct, 100)}%`,
          background: pct > 90 ? '#EF4444' : pct > 70 ? '#F59E0B' : color || '#3B82F6',
          transition: 'width .4s ease' }} />
      </div>
    </div>
  )
}

// ── Stat Card ────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }) {
  const C = useTheme()
  return (
    <div style={{ background: C.sur2, borderRadius: 10, padding: '14px 18px',
      border: `1px solid ${C.bord2}`, flex: '1 1 140px', minWidth: 140 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Icon size={14} style={{ color: color || C.blue }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: C.muted,
          textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{value}</div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  TAB: BACKUPS
// ══════════════════════════════════════════════════════════════
function TabBackups() {
  const C = useTheme()
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [creando, setCreando] = useState(false)
  const [restaurando, setRestaurando] = useState(false)
  const [showRestore, setShowRestore] = useState(false)
  const [restoreFile, setRestoreFile] = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/admin/backups')
      setBackups(r.data || [])
    } catch { setBackups([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function crearBackup() {
    setCreando(true); setMsg('')
    try {
      const r = await api.post('/admin/backups/crear')
      setMsg(r.data?.msg || 'Backup creado')
      cargar()
    } catch (e) { setMsg('Error: ' + (e.response?.data?.detail || e.message)) }
    finally { setCreando(false) }
  }

  async function descargar(nombre) {
    try {
      const r = await api.get(`/admin/backups/${nombre}/descargar`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([r.data]))
      const a = document.createElement('a')
      a.href = url; a.download = nombre; a.click()
      window.URL.revokeObjectURL(url)
    } catch (e) { setMsg('Error al descargar: ' + e.message) }
  }

  async function eliminar(nombre) {
    if (!confirm(`Eliminar backup "${nombre}"?`)) return
    try {
      await api.delete(`/admin/backups/${nombre}`)
      cargar()
    } catch (e) { setMsg('Error: ' + e.message) }
  }

  async function restaurar() {
    if (!restoreFile) return
    setRestaurando(true); setMsg('')
    try {
      const fd = new FormData()
      fd.append('file', restoreFile)
      const r = await api.post('/admin/backups/restaurar', fd)
      setMsg(r.data?.msg || 'Restaurado')
      setShowRestore(false); setRestoreFile(null)
      cargar()
    } catch (e) { setMsg('Error: ' + (e.response?.data?.detail || e.message)) }
    finally { setRestaurando(false) }
  }

  const btnStyle = (color, bg) => ({
    padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
    border: `1px solid ${color}`, background: bg, color,
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
  })

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Database size={18} style={{ color: C.blue }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Backups de Base de Datos</span>
          <span style={{ fontSize: 11, color: C.muted, padding: '2px 8px',
            background: C.blueD, borderRadius: 6 }}>{backups.length} archivos</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={crearBackup} disabled={creando}
            style={btnStyle('#10B981', 'rgba(16,185,129,.15)')}>
            <Plus size={14} /> {creando ? 'Creando...' : 'Crear Backup'}
          </button>
          <button onClick={() => setShowRestore(true)}
            style={btnStyle('#F59E0B', 'rgba(245,158,11,.15)')}>
            <Upload size={14} /> Restaurar
          </button>
          <button onClick={cargar} style={btnStyle(C.muted, 'transparent')}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 12,
          background: msg.startsWith('Error') ? 'rgba(239,68,68,.12)' : 'rgba(16,185,129,.12)',
          color: msg.startsWith('Error') ? '#FCA5A5' : '#6EE7B7',
          border: `1px solid ${msg.startsWith('Error') ? 'rgba(239,68,68,.25)' : 'rgba(16,185,129,.25)'}` }}>
          {msg}
        </div>
      )}

      {/* Restore modal */}
      {showRestore && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9100 }}>
          <div style={{ background: C.surface, borderRadius: 16, padding: 28, width: 460,
            border: `1px solid ${C.bord2}`, boxShadow: '0 25px 60px rgba(0,0,0,.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Restaurar Base de Datos</span>
              <button onClick={() => { setShowRestore(false); setRestoreFile(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 20 }}>
                x
              </button>
            </div>

            <div style={{ padding: 14, borderRadius: 10, background: 'rgba(239,68,68,.1)',
              border: '1px solid rgba(239,68,68,.25)', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <AlertTriangle size={16} style={{ color: '#EF4444' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#FCA5A5' }}>ADVERTENCIA</span>
              </div>
              <p style={{ fontSize: 12, color: '#FCA5A5', margin: 0, lineHeight: 1.5 }}>
                Esta accion reemplazara TODOS los datos actuales de la base de datos.
                Se creara un backup automatico antes de restaurar, pero esta operacion
                es potencialmente destructiva. Asegurese de que el archivo SQL es correcto.
              </p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: 'block',
                marginBottom: 6, textTransform: 'uppercase' }}>Archivo SQL</label>
              <input type="file" accept=".sql" onChange={e => setRestoreFile(e.target.files[0])}
                style={{ fontSize: 12, color: C.text }} />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowRestore(false); setRestoreFile(null) }}
                style={btnStyle(C.muted, 'transparent')}>
                Cancelar
              </button>
              <button onClick={restaurar} disabled={!restoreFile || restaurando}
                style={{ ...btnStyle('#EF4444', 'rgba(239,68,68,.15)'),
                  opacity: (!restoreFile || restaurando) ? 0.5 : 1 }}>
                <Upload size={14} /> {restaurando ? 'Restaurando...' : 'Restaurar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Cargando...</div>
      ) : backups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.hint }}>
          No hay backups disponibles. Cree uno con el boton "Crear Backup".
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.bord2}` }}>
                {['Archivo', 'Fecha', 'Tamano', 'Acciones'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left',
                    fontSize: 10, fontWeight: 700, color: C.muted,
                    textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {backups.map(b => (
                <tr key={b.nombre} style={{ borderBottom: `1px solid ${C.border}` }}
                  onMouseEnter={e => e.currentTarget.style.background = C.sur2}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '10px 12px', color: C.text, fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Database size={14} style={{ color: C.blue }} />
                      {b.nombre}
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', color: C.muted }}>
                    {new Date(b.fecha).toLocaleString()}
                  </td>
                  <td style={{ padding: '10px 12px', color: C.muted }}>{b.tamano_mb} MB</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => descargar(b.nombre)} title="Descargar"
                        style={{ background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.3)',
                          borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#3B82F6' }}>
                        <Download size={13} />
                      </button>
                      <button onClick={() => eliminar(b.nombre)} title="Eliminar"
                        style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)',
                          borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#EF4444' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  TAB: AUDITORIA
// ══════════════════════════════════════════════════════════════
function TabAuditoria() {
  const C = useTheme()
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [filtros, setFiltros] = useState({ modulo: '', accion: '', fecha_ini: '', fecha_fin: '' })
  const [trigger, setTrigger] = useState(0)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (filtros.modulo) params.modulo = filtros.modulo
      if (filtros.accion) params.accion = filtros.accion
      if (filtros.fecha_ini) params.fecha_ini = filtros.fecha_ini
      if (filtros.fecha_fin) params.fecha_fin = filtros.fecha_fin
      const [logsR, statsR] = await Promise.all([
        api.get('/admin/audit-log', { params }),
        api.get('/admin/audit-log/stats'),
      ])
      setLogs(logsR.data || [])
      setStats(statsR.data || null)
    } catch { setLogs([]); setStats(null) }
    finally { setLoading(false) }
  }, [filtros, trigger])

  useEffect(() => { cargar() }, [cargar])

  const fi = { padding: '7px 10px', borderRadius: 7, fontSize: 12, border: `1px solid ${C.bord2}`,
    background: C.sur2, color: C.text, outline: 'none' }

  return (
    <div>
      {/* Stats */}
      {stats && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <StatCard icon={FileText} label="Total registros" value={stats.total || 0} color={C.blue} />
          <StatCard icon={Clock} label="Hoy" value={stats.hoy || 0} color="#10B981" />
          <StatCard icon={AlertTriangle} label="Errores recientes"
            value={stats.ultimos_errores?.length || 0} color="#EF4444" />
        </div>
      )}

      {/* Stats breakdown */}
      {stats && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          {/* Por accion */}
          <div style={{ flex: '1 1 280px', background: C.sur2, borderRadius: 10, padding: 14,
            border: `1px solid ${C.bord2}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase',
              letterSpacing: '.05em', marginBottom: 10 }}>Por Accion</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(stats.por_accion || []).map(a => (
                <div key={a.accion} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AccionBadge accion={a.accion} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{a.n}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Por usuario */}
          <div style={{ flex: '1 1 280px', background: C.sur2, borderRadius: 10, padding: 14,
            border: `1px solid ${C.bord2}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase',
              letterSpacing: '.05em', marginBottom: 10 }}>Por Usuario</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(stats.por_usuario || []).slice(0, 5).map(u => (
                <div key={u.usuario_nombre} style={{ display: 'flex', justifyContent: 'space-between',
                  fontSize: 12 }}>
                  <span style={{ color: C.text }}>{u.usuario_nombre || '(sistema)'}</span>
                  <span style={{ color: C.muted, fontWeight: 700 }}>{u.n}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: 10, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 4 }}>
            Modulo</label>
          <input value={filtros.modulo} onChange={e => setFiltros(p => ({ ...p, modulo: e.target.value }))}
            placeholder="Ej: facturas" style={fi} />
        </div>
        <div>
          <label style={{ fontSize: 10, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 4 }}>
            Accion</label>
          <select value={filtros.accion} onChange={e => setFiltros(p => ({ ...p, accion: e.target.value }))}
            style={fi}>
            <option value="">Todas</option>
            {['LOGIN', 'LOGIN_FALLIDO', 'CREAR', 'EDITAR', 'ELIMINAR', 'VALIDACION', 'ACCESO_DENEGADO', 'ERROR', 'BACKUP', 'RESTAURAR'].map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 10, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 4 }}>
            Desde</label>
          <input type="date" value={filtros.fecha_ini}
            onChange={e => setFiltros(p => ({ ...p, fecha_ini: e.target.value }))}
            style={fi} />
        </div>
        <div>
          <label style={{ fontSize: 10, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 4 }}>
            Hasta</label>
          <input type="date" value={filtros.fecha_fin}
            onChange={e => setFiltros(p => ({ ...p, fecha_fin: e.target.value }))}
            style={fi} />
        </div>
        <button onClick={cargar} style={{ padding: '7px 14px', borderRadius: 7, fontSize: 12,
          fontWeight: 700, border: `1px solid ${C.bord2}`, background: C.blueD, color: C.blue,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Search size={13} /> Filtrar
        </button>
        <button onClick={() => { setFiltros({ modulo: '', accion: '', fecha_ini: '', fecha_fin: '' }); setTrigger(t => t + 1) }}
          style={{ padding: '7px 14px', borderRadius: 7, fontSize: 12,
            border: `1px solid ${C.bord2}`, background: 'transparent', color: C.muted,
            cursor: 'pointer' }}>
          Limpiar
        </button>
        <div style={{ marginLeft: 'auto' }}>
          <select
            onChange={async e => {
              const val = e.target.value
              if (!val) return
              const msgs = {
                '30': 'registros de mas de 30 dias',
                '60': 'registros de mas de 60 dias',
                '90': 'registros de mas de 90 dias',
                'all': 'TODOS los registros',
              }
              if (!confirm(`¿Borrar ${msgs[val]}? Esta accion no se puede deshacer.`)) {
                e.target.value = ''; return
              }
              try {
                await api.delete(`/admin/audit-log/limpiar?dias=${val}`)
                setTrigger(t => t + 1)
              } catch (err) { alert(err.response?.data?.detail || 'Error') }
              e.target.value = ''
            }}
            style={{ padding: '7px 10px', borderRadius: 7, fontSize: 12,
              border: `1px solid #EF444444`, background: '#EF444415', color: '#EF4444',
              cursor: 'pointer', fontWeight: 600 }}
            defaultValue=""
          >
            <option value="" disabled>Borrar registros...</option>
            <option value="30">Mas de 30 dias</option>
            <option value="60">Mas de 60 dias</option>
            <option value="90">Mas de 90 dias</option>
            <option value="all">Borrar todos</option>
          </select>
        </div>
      </div>

      {/* Log table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Cargando...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.bord2}` }}>
                {['Fecha', 'Usuario', 'Accion', 'Modulo', 'Detalle'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10,
                    fontWeight: 700, color: C.muted, textTransform: 'uppercase',
                    letterSpacing: '.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 30, textAlign: 'center', color: C.hint }}>
                    No hay registros de auditoria
                  </td>
                </tr>
              ) : logs.map(log => (
                <tr key={log.id} style={{ borderBottom: `1px solid ${C.border}` }}
                  onMouseEnter={e => e.currentTarget.style.background = C.sur2}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '8px 12px', color: C.muted, whiteSpace: 'nowrap', fontSize: 11 }}>
                    {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                  </td>
                  <td style={{ padding: '8px 12px', color: C.text, fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <User size={12} style={{ color: C.blue }} />
                      {log.usuario_nombre || log.username || '-'}
                    </div>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <AccionBadge accion={log.accion} />
                  </td>
                  <td style={{ padding: '8px 12px', color: C.muted }}>{log.modulo || '-'}</td>
                  <td style={{ padding: '8px 12px', color: C.hint, maxWidth: 300,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.detalle || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  TAB: SISTEMA
// ══════════════════════════════════════════════════════════════
function PlanInfo() {
  const C = useTheme()
  const [plan, setPlan] = useState(null)
  useEffect(() => {
    api.get('/auth/mi-plan').then(r => { if (r.data && r.data.plan && r.data.plan !== 'Sin limite') setPlan(r.data) }).catch(() => {})
  }, [])
  if (!plan) return null

  const barra = (actual, limite) => {
    const pct = limite > 0 ? Math.min((actual / limite) * 100, 100) : 0
    const color = pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#10B981'
    return (
      <div style={{ marginTop: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.muted, marginBottom: 3 }}>
          <span>{actual} / {limite >= 99999 ? 'Ilimitado' : limite.toLocaleString()}</span>
          <span style={{ color, fontWeight: 700 }}>{limite >= 99999 ? '' : `${Math.round(pct)}%`}</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: C.sur3 }}>
          <div style={{ height: '100%', borderRadius: 3, background: color, width: `${pct}%`, transition: 'width .3s' }} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: C.sur2, borderRadius: 10, padding: 16, border: `1px solid ${C.bord2}`, marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>📋</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Mi Plan</span>
        </div>
        <span style={{ padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: '#7C3AED20', color: '#7C3AED' }}>{plan.plan}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div style={{ background: C.surface, borderRadius: 8, padding: 12, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Usuarios</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{plan.usuarios.actual}</div>
          {barra(plan.usuarios.actual, plan.usuarios.limite)}
        </div>
        <div style={{ background: C.surface, borderRadius: 8, padding: 12, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Productos</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{plan.productos.actual}</div>
          {barra(plan.productos.actual, plan.productos.limite)}
        </div>
        <div style={{ background: C.surface, borderRadius: 8, padding: 12, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Facturas / mes</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{plan.facturas_mes.actual}</div>
          {barra(plan.facturas_mes.actual, plan.facturas_mes.limite)}
        </div>
      </div>
      {plan.vencimiento && (
        <div style={{ marginTop: 10, fontSize: 12, color: C.muted, textAlign: 'center' }}>
          Vencimiento: <strong style={{ color: C.text }}>{plan.vencimiento}</strong>
        </div>
      )}
    </div>
  )
}

function TabSistema() {
  const C = useTheme()
  const [estado, setEstado] = useState(null)
  const [loading, setLoading] = useState(false)
  const [errores, setErrores] = useState([])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [estR, errR] = await Promise.all([
        api.get('/admin/sistema/estado'),
        api.get('/admin/sistema/errores-recientes'),
      ])
      setEstado(estR.data)
      setErrores(errR.data || [])
    } catch { setEstado(null); setErrores([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Cargando...</div>
  if (!estado) return <div style={{ textAlign: 'center', padding: 40, color: C.hint }}>No se pudo obtener el estado del sistema</div>

  const { servidor, base_datos, disco, memoria, aplicacion, datos } = estado
  const dbOk = base_datos.estado === 'OK'

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={18} style={{ color: '#10B981' }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Estado del Sistema</span>
        </div>
        <button onClick={cargar} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
          border: `1px solid ${C.bord2}`, background: C.blueD, color: C.blue,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={13} /> Verificar Estado
        </button>
      </div>

      {/* Status Cards Row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {/* Database status */}
        <div style={{ flex: '1 1 220px', background: C.sur2, borderRadius: 10, padding: 16,
          border: `1px solid ${dbOk ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Database size={16} style={{ color: dbOk ? '#10B981' : '#EF4444' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Base de Datos</span>
            {dbOk ? <CheckCircle size={14} style={{ color: '#10B981', marginLeft: 'auto' }} />
                   : <XCircle size={14} style={{ color: '#EF4444', marginLeft: 'auto' }} />}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: C.muted }}>Estado</span>
              <span style={{ color: dbOk ? '#10B981' : '#EF4444', fontWeight: 700 }}>{base_datos.estado}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: C.muted }}>Tamano</span>
              <span style={{ color: C.text, fontWeight: 600 }}>{base_datos.tamano}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: C.muted }}>Tablas</span>
              <span style={{ color: C.text, fontWeight: 600 }}>{base_datos.tablas}</span>
            </div>
          </div>
        </div>

        {/* Server */}
        <div style={{ flex: '1 1 220px', background: C.sur2, borderRadius: 10, padding: 16,
          border: `1px solid ${C.bord2}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Server size={16} style={{ color: C.blue }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Servidor</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: C.muted }}>OS</span>
              <span style={{ color: C.text, fontWeight: 600 }}>{servidor.os}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: C.muted }}>Python</span>
              <span style={{ color: C.text, fontWeight: 600 }}>{servidor.python}</span>
            </div>
          </div>
        </div>

        {/* App */}
        <div style={{ flex: '1 1 220px', background: C.sur2, borderRadius: 10, padding: 16,
          border: `1px solid ${C.bord2}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Monitor size={16} style={{ color: '#8B5CF6' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Aplicacion</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: C.muted }}>Version</span>
              <span style={{ color: C.text, fontWeight: 600 }}>{aplicacion.version}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: C.muted }}>Framework</span>
              <span style={{ color: C.text, fontWeight: 600 }}>{aplicacion.framework}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: C.muted }}>Endpoints</span>
              <span style={{ color: C.text, fontWeight: 600 }}>{aplicacion.endpoints}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Resource Usage */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {/* Disk */}
        <div style={{ flex: '1 1 300px', background: C.sur2, borderRadius: 10, padding: 16,
          border: `1px solid ${C.bord2}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <HardDrive size={16} style={{ color: '#F59E0B' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Disco</span>
          </div>
          <BarraUso pct={disco.pct_usado} color="#F59E0B"
            label="Uso de disco"
            detalle={`${disco.usado_gb} / ${disco.total_gb} GB (${disco.pct_usado}%)`} />
          <div style={{ fontSize: 11, color: C.muted }}>
            Libre: {disco.libre_gb} GB
          </div>
        </div>

        {/* Memory */}
        <div style={{ flex: '1 1 300px', background: C.sur2, borderRadius: 10, padding: 16,
          border: `1px solid ${C.bord2}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Cpu size={16} style={{ color: '#8B5CF6' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Memoria RAM</span>
          </div>
          <BarraUso pct={memoria.pct_usado} color="#8B5CF6"
            label="Uso de memoria"
            detalle={`${memoria.usado_gb} / ${memoria.total_gb} GB (${memoria.pct_usado}%)`} />
        </div>
      </div>

      {/* Data counts */}
      {datos && Object.keys(datos).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase',
            letterSpacing: '.05em', marginBottom: 10 }}>Datos del Sistema</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <StatCard icon={User} label="Usuarios" value={datos.usuarios ?? 0} color="#3B82F6" />
            <StatCard icon={FileText} label="Productos" value={datos.productos ?? 0} color="#10B981" />
            <StatCard icon={User} label="Clientes" value={datos.clientes ?? 0} color="#8B5CF6" />
            <StatCard icon={FileText} label="Facturas" value={datos.facturas ?? 0} color="#F59E0B" />
          </div>
        </div>
      )}

      {/* Plan info */}
      <PlanInfo />

      {/* Recent errors */}
      {errores.length > 0 && (
        <div style={{ background: C.sur2, borderRadius: 10, padding: 16,
          border: `1px solid rgba(239,68,68,.2)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <AlertTriangle size={16} style={{ color: '#EF4444' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Errores Recientes</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {errores.slice(0, 5).map(e => (
              <div key={e.id} style={{ padding: '8px 12px', borderRadius: 6,
                background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.12)',
                fontSize: 12, display: 'flex', gap: 12 }}>
                <span style={{ color: C.muted, whiteSpace: 'nowrap', fontSize: 11 }}>
                  {e.created_at ? new Date(e.created_at).toLocaleString() : ''}
                </span>
                <span style={{ color: '#FCA5A5' }}>{e.detalle || '-'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  MAIN PAGE
// ══════════════════════════════════════════════════════════════
const TABS = [
  { id: 'backups',    label: 'Backups',   icon: Database  },
  { id: 'auditoria',  label: 'Auditoria', icon: Shield    },
  { id: 'alertas',    label: 'Alertas',   icon: Bell      },
  { id: 'sistema',    label: 'Sistema',   icon: Activity  },
]

export default function Administracion() {
  const C = useTheme()
  const [tab, setTab] = useState('backups')

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Server size={20} style={{ color: 'white' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.text }}>
              Administracion del Sistema
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: C.muted }}>
              Backups, auditoria y monitoreo del sistema
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: C.sur2,
        borderRadius: 10, padding: 4, border: `1px solid ${C.bord2}`, width: 'fit-content' }}>
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding: '8px 18px', borderRadius: 8, fontSize: 12, fontWeight: active ? 700 : 500,
                border: 'none', cursor: 'pointer',
                background: active ? C.blue : 'transparent',
                color: active ? 'white' : C.muted,
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all .15s',
              }}>
              <Icon size={14} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div style={{ background: C.surface, borderRadius: 12, padding: 20,
        border: `1px solid ${C.bord2}`, minHeight: 400 }}>
        {tab === 'backups'   && <TabBackups />}
        {tab === 'auditoria' && <TabAuditoria />}
        {tab === 'alertas'   && <TabAlertas />}
        {tab === 'sistema'   && <TabSistema />}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  TAB ALERTAS AUTOMÁTICAS
// ══════════════════════════════════════════════════════════════
function TabAlertas() {
  const C = useTheme()
  const hoy = new Date().toISOString().slice(0,7)
  const [cfg, setCfg] = useState(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [historial, setHistorial] = useState([])
  const [preview, setPreview] = useState(null)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    api.get('/alertas/config').then(r => setCfg(r.data)).catch(() => {})
    api.get('/alertas/historial?limite=10').then(r => setHistorial(r.data||[])).catch(() => {})
  }, [])

  const guardar = async () => {
    setSaving(true); setMsg(null)
    try {
      await api.put('/alertas/config', cfg)
      setMsg({ ok: true, text: 'Configuración guardada' })
    } catch(e) { setMsg({ ok: false, text: e.response?.data?.detail || 'Error' }) }
    setSaving(false)
  }

  const probar = async () => {
    setTesting(true); setMsg(null)
    try {
      const r = await api.get('/alertas/preview')
      setPreview(r.data)
    } catch(e) { setMsg({ ok: false, text: 'Error al obtener preview' }) }
    setTesting(false)
  }

  const enviarAhora = async () => {
    try {
      await api.post('/alertas/verificar')
      setMsg({ ok: true, text: 'Verificación iniciada — revisa tu email en unos segundos' })
      setTimeout(() => api.get('/alertas/historial?limite=10').then(r=>setHistorial(r.data||[])), 3000)
    } catch(e) { setMsg({ ok: false, text: 'Error' }) }
  }

  const s = (k, v) => setCfg(p => ({ ...p, [k]: v }))
  const fi = { background:C.sur2, border:`1px solid ${C.bord2}`, borderRadius:7,
    padding:'8px 12px', color:C.text, fontSize:13, outline:'none', boxSizing:'border-box' }
  const lbl = { fontSize:11, fontWeight:600, color:C.muted, display:'block', marginBottom:4 }
  const card = { background:C.surface, borderRadius:12, border:`1px solid ${C.bord2}`,
    padding:20, marginBottom:16 }

  if (!cfg) return <div style={{color:C.muted,padding:20}}>Cargando...</div>

  return (
    <div>
      <div style={card}>
        <div style={{fontWeight:700,fontSize:15,color:C.text,marginBottom:4}}>🔔 Alertas automáticas por email</div>
        <div style={{fontSize:12,color:C.muted,marginBottom:20}}>
          Cada día a la hora configurada el sistema revisa el negocio y envía un resumen por email.
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          <div style={{gridColumn:'1/-1',display:'flex',alignItems:'center',gap:12,padding:'12px 16px',
            borderRadius:10,background:cfg.email_activo?'rgba(16,185,129,.08)':'rgba(100,116,139,.08)',
            border:`1px solid ${cfg.email_activo?'rgba(16,185,129,.3)':C.bord2}`}}>
            <input type="checkbox" checked={!!cfg.email_activo} onChange={e=>s('email_activo',e.target.checked)}
              style={{width:18,height:18,cursor:'pointer',accentColor:C.green}}/>
            <div>
              <div style={{fontWeight:700,fontSize:13,color:cfg.email_activo?C.green:C.muted}}>
                {cfg.email_activo ? '✅ Alertas activas' : '⭕ Alertas desactivadas'}
              </div>
              <div style={{fontSize:11,color:C.hint}}>El email se envía automáticamente cada día</div>
            </div>
          </div>

          <div>
            <label style={lbl}>Email destinatario (gerente/admin)</label>
            <input value={cfg.email_destino||''} onChange={e=>s('email_destino',e.target.value)}
              style={{...fi,width:'100%'}} placeholder="gerente@empresa.com" />
          </div>
          <div>
            <label style={lbl}>Hora de envío diario</label>
            <input type="time" value={cfg.hora_envio||'07:00'} onChange={e=>s('hora_envio',e.target.value)}
              style={{...fi,width:'100%'}} />
          </div>
        </div>

        <div style={{marginTop:20,display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12}}>
          {[
            ['alerta_stock_bajo','⚠️ Stock bajo','Cuando un producto baja del mínimo','stock_dias_revision','Revisar cada (días)'],
            ['alerta_facturas_vencer','🟡 Facturas por vencer','Días antes del vencimiento','facturas_dias_aviso','Avisar con (días) de anticipación'],
            ['alerta_cobros_vencidos','🔴 Cobros vencidos','Cuentas que ya pasaron la fecha','cobros_dias_gracia','Días de gracia'],
            ['alerta_cumpleanos','🎂 Cumpleaños clientes','Clientes que cumplen hoy o mañana',null,null],
          ].map(([key,titulo,desc,keyNum,labelNum])=>(
            <div key={key} style={{padding:'12px 16px',borderRadius:10,
              background:cfg[key]?'rgba(59,130,246,.06)':C.sur2,
              border:`1px solid ${cfg[key]?'rgba(59,130,246,.2)':C.bord2}`}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:keyNum?10:0}}>
                <input type="checkbox" checked={!!cfg[key]} onChange={e=>s(key,e.target.checked)}
                  style={{width:16,height:16,cursor:'pointer',accentColor:C.blue}}/>
                <div>
                  <div style={{fontWeight:700,fontSize:13,color:C.text}}>{titulo}</div>
                  <div style={{fontSize:11,color:C.muted}}>{desc}</div>
                </div>
              </div>
              {keyNum && cfg[key] && (
                <div style={{marginTop:8}}>
                  <label style={lbl}>{labelNum}</label>
                  <input type="number" min="1" max="30" value={cfg[keyNum]||1}
                    onChange={e=>s(keyNum,parseInt(e.target.value)||1)}
                    style={{...fi,width:80}} />
                </div>
              )}
            </div>
          ))}
        </div>

        {msg && (
          <div style={{marginTop:14,padding:'9px 14px',borderRadius:8,fontSize:13,
            background:msg.ok?'rgba(16,185,129,.1)':'rgba(239,68,68,.1)',
            border:`1px solid ${msg.ok?'#10B98133':'#EF444433'}`,
            color:msg.ok?C.green:C.red}}>
            {msg.ok?'✅':'❌'} {msg.text}
          </div>
        )}

        <div style={{display:'flex',gap:10,marginTop:20,flexWrap:'wrap'}}>
          <button onClick={probar} disabled={testing}
            style={{padding:'9px 18px',borderRadius:9,border:`1px solid ${C.bord2}`,
              background:C.sur2,color:C.text,cursor:'pointer',fontSize:13,fontWeight:600}}>
            {testing?'Verificando...':'👁️ Ver preview'}
          </button>
          <button onClick={enviarAhora}
            style={{padding:'9px 18px',borderRadius:9,border:'none',
              background:'rgba(16,185,129,.2)',color:C.green,cursor:'pointer',fontSize:13,fontWeight:600}}>
            📧 Enviar ahora
          </button>
          <button onClick={guardar} disabled={saving}
            style={{padding:'9px 24px',borderRadius:9,border:'none',
              background:C.blue,color:'white',cursor:'pointer',fontSize:13,fontWeight:700,marginLeft:'auto'}}>
            {saving?'Guardando...':'Guardar configuración'}
          </button>
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <div style={card}>
          <div style={{fontWeight:700,fontSize:14,color:C.text,marginBottom:12}}>
            👁️ Vista previa — qué se enviaría ahora
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
            {[
              ['⚠️','Stock bajo',preview.stock_bajo?.length||0,'productos',C.amber],
              ['🔴','Cobros vencidos',preview.cobros_vencidos?.length||0,'cuentas',C.red],
              ['🟡','Por vencer',preview.facturas_vencer?.length||0,'facturas',C.amber],
              ['🎂','Cumpleaños',preview.cumpleanos?.length||0,'clientes',C.green],
            ].map(([ico,lab,n,unit,col])=>(
              <div key={lab} style={{padding:'12px',borderRadius:10,textAlign:'center',
                background:n>0?`${col}15`:C.sur2,border:`1px solid ${n>0?col+'33':C.bord2}`}}>
                <div style={{fontSize:24}}>{ico}</div>
                <div style={{fontSize:22,fontWeight:900,color:n>0?col:C.muted}}>{n}</div>
                <div style={{fontSize:11,color:C.muted}}>{lab}</div>
                <div style={{fontSize:10,color:C.hint}}>{unit}</div>
              </div>
            ))}
          </div>
          {preview.cobros_vencidos?.length > 0 && (
            <div style={{marginTop:12}}>
              <div style={{fontSize:11,fontWeight:700,color:C.red,marginBottom:6}}>Cobros vencidos:</div>
              {preview.cobros_vencidos.slice(0,3).map((c,i)=>(
                <div key={i} style={{fontSize:12,color:C.muted,padding:'4px 0'}}>
                  • {c.cliente} — <strong style={{color:C.red}}>${parseFloat(c.saldo).toFixed(2)}</strong>
                  {' '}({c.dias_vencido} días vencido)
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Historial */}
      {historial.length > 0 && (
        <div style={card}>
          <div style={{fontWeight:700,fontSize:14,color:C.text,marginBottom:12}}>
            📋 Últimas 10 alertas enviadas
          </div>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${C.bord2}`}}>
                {['Fecha','Items','Email','Detalle'].map(h=>(
                  <th key={h} style={{padding:'6px 10px',textAlign:'left',
                    color:C.muted,fontWeight:700,fontSize:10,textTransform:'uppercase'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historial.map(h=>(
                <tr key={h.id} style={{borderBottom:`1px solid ${C.sur2}`}}>
                  <td style={{padding:'8px 10px',color:C.text}}>
                    {new Date(h.created_at).toLocaleString('es-EC')}
                  </td>
                  <td style={{padding:'8px 10px',color:C.blue,fontWeight:700}}>{h.total_items}</td>
                  <td style={{padding:'8px 10px'}}>
                    <span style={{padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:600,
                      background:h.email_enviado?'rgba(16,185,129,.15)':'rgba(239,68,68,.15)',
                      color:h.email_enviado?C.green:C.red}}>
                      {h.email_enviado?'Enviado':'No enviado'}
                    </span>
                  </td>
                  <td style={{padding:'8px 10px',color:C.muted,fontSize:11}}>{h.detalle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  TAB FORMULARIOS SRI
// ══════════════════════════════════════════════════════════════
function TabSRI() {
  const C = useTheme()
  const hoy = new Date()
  const periodoActual = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`
  const [periodo, setPeriodo] = useState(periodoActual)
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [datos104, setDatos104] = useState(null)
  const [datosATS, setDatosATS] = useState(null)
  const [loading104, setLoading104] = useState(false)
  const [loadingATS, setLoadingATS] = useState(false)

  const calcular104 = async () => {
    setLoading104(true); setDatos104(null)
    try {
      const r = await api.get('/sri/formulario104', { params: { periodo } })
      setDatos104(r.data)
    } catch(e) { alert(e.response?.data?.detail || 'Error') }
    setLoading104(false)
  }

  const calcularATS = async () => {
    setLoadingATS(true); setDatosATS(null)
    try {
      const r = await api.get('/sri/ats', { params: { periodo } })
      setDatosATS(r.data)
    } catch(e) { alert(e.response?.data?.detail || 'Error') }
    setLoadingATS(false)
  }

  const descargar = async (url, filename) => {
    try {
      const r = await api.get(url, { responseType: 'blob', params: url.includes('rdep') ? { anio } : { periodo } })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(new Blob([r.data]))
      link.download = filename; link.click()
    } catch(e) { alert('Error al descargar') }
  }

  const fi = { background:C.sur2, border:`1px solid ${C.bord2}`, borderRadius:7,
    padding:'8px 12px', color:C.text, fontSize:13, outline:'none' }
  const card = { background:C.surface, borderRadius:12, border:`1px solid ${C.bord2}`, padding:20, marginBottom:16 }
  const fmtN = v => `$${parseFloat(v||0).toLocaleString('es-EC',{minimumFractionDigits:2,maximumFractionDigits:2})}`

  return (
    <div>
      <div style={{...card, display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap'}}>
        <div>
          <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:4}}>
            Período (mes)
          </label>
          <input type="month" value={periodo} onChange={e=>setPeriodo(e.target.value)} style={fi} />
        </div>
        <div>
          <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:4}}>
            Año (para RDEP)
          </label>
          <input type="number" value={anio} onChange={e=>setAnio(parseInt(e.target.value))}
            style={{...fi,width:100}} min="2020" max={hoy.getFullYear()+1} />
        </div>
      </div>

      {/* Formulario 104 */}
      <div style={card}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <div>
            <div style={{fontWeight:700,fontSize:15,color:C.text}}>📋 Formulario 104 — Declaración IVA</div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>
              Resumen mensual de IVA cobrado en ventas vs IVA pagado en compras
            </div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={calcular104} disabled={loading104}
              style={{padding:'9px 18px',borderRadius:9,border:'none',
                background:C.blue,color:'white',cursor:'pointer',fontSize:13,fontWeight:700}}>
              {loading104?'Calculando...':'Calcular'}
            </button>
            {datos104 && (
              <button onClick={()=>descargar('/sri/formulario104/excel',`F104_${periodo}.xlsx`)}
                style={{padding:'9px 18px',borderRadius:9,border:`1px solid ${C.green}44`,
                  background:'rgba(16,185,129,.1)',color:C.green,cursor:'pointer',fontSize:13,fontWeight:700}}>
                ⬇️ Excel
              </button>
            )}
          </div>
        </div>

        {datos104 && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
            {[
              {label:'Ventas base 0%',val:datos104.ventas_base_0,col:C.muted},
              {label:'Ventas base IVA 15%',val:datos104.ventas_base_iva,col:C.blue},
              {label:'IVA cobrado',val:datos104.ventas_iva,col:C.blue},
              {label:'Compras base 0%',val:datos104.compras_base_0,col:C.muted},
              {label:'Compras base IVA',val:datos104.compras_base_iva,col:C.purple},
              {label:'Crédito tributario',val:datos104.credito_tributario,col:C.purple},
              {label:'Retenciones recibidas',val:datos104.retenciones_recibidas,col:C.amber},
              {label:'IVA A PAGAR',val:datos104.iva_a_pagar,col:C.red,grande:true},
              {label:'Crédito a favor',val:datos104.credito_a_favor,col:C.green,grande:datos104.credito_a_favor>0},
            ].map((item,i)=>(
              <div key={i} style={{padding:'12px 16px',borderRadius:10,
                background:C.sur2,border:`1px solid ${C.bord2}`}}>
                <div style={{fontSize:10,fontWeight:700,color:C.muted,
                  textTransform:'uppercase',letterSpacing:'.04em',marginBottom:4}}>
                  {item.label}
                </div>
                <div style={{fontSize:item.grande?22:16,fontWeight:item.grande?900:700,color:item.col}}>
                  {fmtN(item.val)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ATS */}
      <div style={card}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <div>
            <div style={{fontWeight:700,fontSize:15,color:C.text}}>📑 ATS — Anexo Transaccional</div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>
              Detalle de todas las ventas y compras del período para declarar al SRI
            </div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={calcularATS} disabled={loadingATS}
              style={{padding:'9px 18px',borderRadius:9,border:'none',
                background:C.purple,color:'white',cursor:'pointer',fontSize:13,fontWeight:700}}>
              {loadingATS?'Calculando...':'Calcular'}
            </button>
            {datosATS && (
              <button onClick={()=>descargar('/sri/ats/excel',`ATS_${periodo}.xlsx`)}
                style={{padding:'9px 18px',borderRadius:9,border:`1px solid ${C.green}44`,
                  background:'rgba(16,185,129,.1)',color:C.green,cursor:'pointer',fontSize:13,fontWeight:700}}>
                ⬇️ Excel
              </button>
            )}
          </div>
        </div>

        {datosATS && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
            {[
              {l:'Facturas de venta',v:datosATS.resumen?.total_ventas,col:C.blue,u:'documentos'},
              {l:'Total ventas IVA',v:fmtN(datosATS.resumen?.base_iva_ventas),col:C.blue,u:'base gravada'},
              {l:'Facturas de compra',v:datosATS.resumen?.total_compras,col:C.purple,u:'documentos'},
              {l:'Total compras IVA',v:fmtN(datosATS.resumen?.base_iva_compras),col:C.purple,u:'base gravada'},
            ].map((item,i)=>(
              <div key={i} style={{padding:'12px',borderRadius:10,background:C.sur2,
                border:`1px solid ${C.bord2}`,textAlign:'center'}}>
                <div style={{fontSize:20,fontWeight:900,color:item.col}}>{item.v}</div>
                <div style={{fontSize:11,fontWeight:700,color:C.muted,marginTop:4}}>{item.l}</div>
                <div style={{fontSize:10,color:C.hint}}>{item.u}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RDEP */}
      <div style={card}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontWeight:700,fontSize:15,color:C.text}}>👔 RDEP — Relación de Dependencia</div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>
              Reporte anual de ingresos de empleados en relación de dependencia
            </div>
          </div>
          <button onClick={()=>descargar('/sri/rdep/excel',`RDEP_${anio}.xlsx`)}
            style={{padding:'9px 18px',borderRadius:9,border:'none',
              background:C.amber,color:'#000',cursor:'pointer',fontSize:13,fontWeight:700}}>
            ⬇️ Descargar RDEP {anio}
          </button>
        </div>
      </div>

      <div style={{padding:'12px 16px',borderRadius:10,
        background:'rgba(245,158,11,.06)',border:'1px solid rgba(245,158,11,.2)',
        fontSize:12,color:C.amber,lineHeight:1.7}}>
        ⚠️ <strong>Importante:</strong> Estos formularios son referenciales y de apoyo para su contador.
        Siempre verifique los valores con un profesional contable antes de presentar la declaración oficial al SRI.
        Los valores dependen de que todos los documentos estén correctamente ingresados en el sistema.
      </div>
    </div>
  )
}
