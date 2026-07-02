import React, { useState, useEffect } from 'react'
import {
  Search, Plus, Edit2, Eye, ToggleLeft, ToggleRight,
  X, Check, User, Phone, Mail, MapPin, CreditCard,
  Calendar, FileText, Building, Truck
} from 'lucide-react'
import api from '../api'
import { useTheme } from '../theme'

const C = {
  bg:'#0A0F1E', surface:'#111827', sur2:'#1F2937', sur3:'#374151',
  border:'#1F2937', bord2:'#374151',
  text:'#F9FAFB', muted:'#9CA3AF', hint:'#6B7280',
  blue:'#3B82F6', green:'#10B981', amber:'#F59E0B',
  red:'#EF4444', purple:'#8B5CF6', cyan:'#06B6D4',
  greenD:'rgba(16,185,129,.15)', amberD:'rgba(245,158,11,.15)',
  redD:'rgba(239,68,68,.15)', blueD:'rgba(59,130,246,.15)',
}

const FI = {
  width:'100%', padding:'8px 11px', borderRadius:8, fontSize:13,
  border:`1px solid ${C.bord2}`, background:C.sur2,
  color:C.text, outline:'none', boxSizing:'border-box',
}

function Field({ label, children, required, w='half' }) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const flex = w==='full'?'1 1 100%':w==='third'?'0 0 calc(33% - 8px)':'0 0 calc(50% - 6px)'
  return (
    <div style={{ flex, minWidth:120 }}>
      <label style={{ fontSize:11, fontWeight:600, color:C.muted,
        display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:'.04em' }}>
        {label}{required&&<span style={{color:C.red}}> *</span>}
      </label>
      {children}
    </div>
  )
}

function Section({ title, color, children }) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  return (
    <div style={{ background:C.sur2, borderRadius:10, padding:14,
      marginBottom:12, border:`1px solid ${C.bord2}` }}>
      <div style={{ fontSize:11, fontWeight:700, color:color||C.blue,
        marginBottom:12, textTransform:'uppercase', letterSpacing:'.05em' }}>
        {title}
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:12 }}>{children}</div>
    </div>
  )
}

function Modal({ open, onClose, title, children, width=680 }) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  if (!open) return null
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:C.surface, borderRadius:16, padding:28,
        width, maxWidth:'97vw', maxHeight:'93vh', overflow:'auto',
        border:`1px solid ${C.bord2}`, boxShadow:'0 25px 60px rgba(0,0,0,.7)' }}>
        <div style={{ display:'flex', justifyContent:'space-between',
          alignItems:'center', marginBottom:20 }}>
          <h2 style={{ fontSize:16, fontWeight:700, color:C.text, margin:0 }}>{title}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none',
            cursor:'pointer', color:C.hint, fontSize:22, lineHeight:1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const BLANK = {
  tipo_identificacion:'RUC', identificacion:'', razon_social:'',
  nombre_comercial:'', nombres:'', apellidos:'',
  telefono:'', email:'', direccion:'', ciudad:'', provincia:'',
  pais:'Ecuador', codigo_pais:'593', direccion_matriz:'',
  tipo_contribuyente:'JURIDICA', obligado_contabilidad:false,
  contribuyente_especial:'', tipo_proveedor:'BIENES',
  contacto_nombre:'', contacto_telefono:'', contacto_email:'',
  plazo_pago:0, limite_credito:0, activo:true,
}

export default function Proveedores() {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [proveedores, setProveedores] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [busqueda,    setBusqueda]    = useState('')
  const [filtActivo,  setFiltActivo]  = useState('true')
  const [modalForm,   setModalForm]   = useState(false)
  const [modalVer,    setModalVer]    = useState(false)
  const [provEdit,    setProvEdit]    = useState(null)
  const [provVer,     setProvVer]     = useState(null)
  const [form,        setForm]        = useState(BLANK)
  const [msg,         setMsg]         = useState('')
  const [saving,      setSaving]      = useState(false)

  useEffect(() => { cargar() }, [])
  useEffect(() => { cargar() }, [filtActivo])

  async function cargar(bus=busqueda) {
    setLoading(true)
    try {
      const { data } = await api.get('/proveedores', {
        params: { busqueda:bus, activo:filtActivo }
      })
      setProveedores(data)
    } finally { setLoading(false) }
  }

  function set(k,v) { setForm(f=>({...f,[k]:v})) }

  function abrirNuevo() {
    setForm(BLANK); setProvEdit(null); setMsg(''); setModalForm(true)
  }

  function abrirEditar(p) {
    setForm({
      tipo_identificacion:    p.tipo_identificacion    || 'RUC',
      identificacion:         p.identificacion         || '',
      razon_social:           p.razon_social           || '',
      nombre_comercial:       p.nombre_comercial       || '',
      nombres:                p.nombres                || '',
      apellidos:              p.apellidos              || '',
      telefono:               p.telefono               || '',
      email:                  p.email                  || '',
      direccion:              p.direccion              || '',
      ciudad:                 p.ciudad                 || '',
      provincia:              p.provincia              || '',
      pais:                   p.pais                   || 'Ecuador',
      codigo_pais:            p.codigo_pais            || '593',
      direccion_matriz:       p.direccion_matriz       || '',
      tipo_contribuyente:     p.tipo_contribuyente     || 'JURIDICA',
      obligado_contabilidad:  p.obligado_contabilidad  || false,
      contribuyente_especial: p.contribuyente_especial || '',
      tipo_proveedor:         p.tipo_proveedor         || 'BIENES',
      contacto_nombre:        p.contacto_nombre        || '',
      contacto_telefono:      p.contacto_telefono      || '',
      contacto_email:         p.contacto_email         || '',
      plazo_pago:             p.plazo_pago             || 0,
      limite_credito:         p.limite_credito         || 0,
      activo:                 p.activo !== false,
    })
    setProvEdit(p); setMsg(''); setModalForm(true)
  }

  async function guardar() {
    if (!form.identificacion || !form.razon_social) {
      setMsg('⚠️ Identificación y razón social son obligatorios'); return
    }
    if (!form.email) {
      setMsg('⚠️ El email es obligatorio para comprobantes electrónicos'); return
    }
    setSaving(true); setMsg('')
    try {
      const body = {
        ...form,
        limite_credito: parseFloat(form.limite_credito)||0,
        plazo_pago:     parseInt(form.plazo_pago)||0,
      }
      if (provEdit) await api.put(`/proveedores/${provEdit.id}`, body)
      else          await api.post('/proveedores', body)
      setModalForm(false); cargar()
    } catch(e) {
      setMsg('❌ '+(e.response?.data?.detail||e.message))
    } finally { setSaving(false) }
  }

  async function toggleActivo(p) {
    await api.patch(`/proveedores/${p.id}/toggle`); cargar()
  }

  const TH = { padding:'11px 14px', fontSize:11, fontWeight:700,
    color:C.hint, textTransform:'uppercase', letterSpacing:'.05em',
    borderBottom:`1px solid ${C.bord2}`, background:C.sur3,
    whiteSpace:'nowrap', textAlign:'left' }
  const TD = { padding:'12px 14px', fontSize:13,
    borderBottom:`1px solid ${C.border}`, verticalAlign:'middle', color:C.text }

  return (
    <div style={{ background:C.bg, minHeight:'100vh', padding:'24px 28px',
      fontFamily:"'Inter','Segoe UI',system-ui,sans-serif", color:C.text }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between',
        alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <h1 style={{ margin:0, fontSize:24, fontWeight:800 }}>🚚 Proveedores</h1>
          <p style={{ margin:'4px 0 0', color:C.muted, fontSize:13 }}>
            {proveedores.length} proveedores encontrados
          </p>
        </div>
        <button onClick={abrirNuevo}
          style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 20px',
            borderRadius:10, border:'none', background:C.blue, color:'white',
            cursor:'pointer', fontSize:14, fontWeight:700,
            boxShadow:'0 4px 14px rgba(59,130,246,.4)' }}>
          <Plus size={15}/> Nuevo proveedor
        </button>
      </div>

      {/* Filtros */}
      <div style={{ background:C.surface, borderRadius:12, padding:'12px 16px',
        border:`1px solid ${C.bord2}`, marginBottom:16,
        display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:240 }}>
          <Search size={15} style={{ position:'absolute', left:12,
            top:'50%', transform:'translateY(-50%)', color:C.hint }}/>
          <input placeholder="Buscar por nombre, RUC, teléfono o email..."
            value={busqueda} onChange={e=>setBusqueda(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&cargar(busqueda)}
            style={{ ...FI, paddingLeft:34 }}/>
        </div>
        <button onClick={()=>cargar(busqueda)}
          style={{ padding:'8px 16px', borderRadius:9, border:'none',
            background:C.blue, color:'white', cursor:'pointer',
            fontSize:13, fontWeight:600 }}>
          Buscar
        </button>
        <div style={{ display:'flex', borderRadius:9, overflow:'hidden',
          border:`1px solid ${C.bord2}` }}>
          {[['true','Activos'],['false','Inactivos'],['','Todos']].map(([v,l])=>(
            <button key={v} onClick={()=>setFiltActivo(v)}
              style={{ padding:'8px 14px', border:'none', cursor:'pointer',
                fontSize:12, fontWeight:600, transition:'all .15s',
                background:filtActivo===v?C.blue:C.sur2,
                color:filtActivo===v?'white':C.muted }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div style={{ background:C.surface, borderRadius:12,
        border:`1px solid ${C.bord2}`, overflow:'hidden' }}>
        {loading ? (
          <div style={{ padding:40, textAlign:'center', color:C.hint }}>
            Cargando proveedores...
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                {['Identificación','Razón Social','Teléfono',
                  'Email','Ciudad','Tipo','Crédito','Estado',''].map((h,i)=>(
                  <th key={i} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {proveedores.map(p=>(
                <tr key={p.id}
                  onMouseEnter={e=>e.currentTarget.style.background=C.sur2}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={TD}>
                    <span style={{ padding:'2px 7px', borderRadius:6, fontSize:9,
                      fontWeight:700, marginRight:5, background:C.blueD, color:C.blue }}>
                      {p.tipo_identificacion}
                    </span>
                    <code style={{ color:C.blue, fontSize:12, fontWeight:700 }}>
                      {p.identificacion}
                    </code>
                  </td>
                  <td style={TD}>
                    <div style={{ fontWeight:700 }}>{p.razon_social}</div>
                    {p.obligado_contabilidad&&(
                      <span style={{ fontSize:9, padding:'1px 6px', borderRadius:6,
                        background:C.amberD, color:C.amber, fontWeight:700 }}>
                        Oblig. contabilidad
                      </span>
                    )}
                  </td>
                  <td style={{ ...TD, fontSize:12, color:C.muted }}>{p.telefono||'—'}</td>
                  <td style={{ ...TD, fontSize:12, color:C.muted }}>{p.email||'—'}</td>
                  <td style={{ ...TD, fontSize:12, color:C.muted }}>{p.ciudad||'—'}</td>
                  <td style={TD}>
                    <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11,
                      fontWeight:700, background:C.blueD, color:C.blue }}>
                      {p.tipo_proveedor}
                    </span>
                  </td>
                  <td style={TD}>
                    {Number(p.limite_credito||0)>0 ? (
                      <div>
                        <div style={{ fontWeight:700, color:C.blue, fontSize:12 }}>
                          ${Number(p.limite_credito).toFixed(2)}
                        </div>
                        <div style={{ fontSize:10, color:C.hint }}>
                          {p.plazo_pago} días
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize:11, color:C.hint }}>Contado</span>
                    )}
                  </td>

                  <td style={TD}>
                    <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11,
                      fontWeight:700, background:p.activo?C.greenD:C.sur3,
                      color:p.activo?C.green:C.hint }}>
                      {p.activo?'Activo':'Inactivo'}
                    </span>
                  </td>
                  <td style={{ ...TD, textAlign:'center' }}>
                    <div style={{ display:'flex', gap:5, justifyContent:'center' }}>
                      <button onClick={()=>{setProvVer(p);setModalVer(true)}}
                        title="Ver detalle"
                        style={{ padding:'5px 9px', borderRadius:7, cursor:'pointer',
                          border:`1px solid ${C.bord2}`, background:C.sur2, color:C.blue }}>
                        <Eye size={13}/>
                      </button>
                      <button onClick={()=>abrirEditar(p)} title="Editar"
                        style={{ padding:'5px 9px', borderRadius:7, cursor:'pointer',
                          border:`1px solid ${C.bord2}`, background:C.sur2, color:C.muted }}>
                        <Edit2 size={13}/>
                      </button>
                      <button onClick={()=>toggleActivo(p)}
                        style={{ padding:'5px 9px', borderRadius:7, cursor:'pointer',
                          border:`1px solid ${C.bord2}`, background:C.sur2 }}>
                        {p.activo
                          ? <ToggleRight size={14} color={C.green}/>
                          : <ToggleLeft  size={14} color={C.hint}/>}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {proveedores.length===0&&(
                <tr><td colSpan={9} style={{ textAlign:'center',
                  padding:'48px 0', color:C.hint, fontSize:13 }}>
                  No se encontraron proveedores
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── MODAL CREAR / EDITAR ── */}
      <Modal open={modalForm} onClose={()=>setModalForm(false)}
        title={provEdit?`✏️ Editar: ${provEdit.razon_social}`:'➕ Nuevo proveedor'}>

        <Section title="📋 Identificación fiscal (SRI)" color={C.blue}>
          <Field label="Tipo identificación" required w="third">
            <select value={form.tipo_identificacion}
              onChange={e=>set('tipo_identificacion',e.target.value)} style={FI}>
              <option value="RUC">RUC</option>
              <option value="CEDULA">Cédula</option>
              <option value="PASAPORTE">Pasaporte</option>
            </select>
          </Field>
          <Field label="Número de identificación" required w="third">
            <div style={{display:'flex',gap:6}}>
              <input value={form.identificacion}
                onChange={e=>set('identificacion',e.target.value)}
                onBlur={async e=>{
                  const val = e.target.value.trim()
                  if (val.length >= 10 && !form.razon_social) {
                    try {
                      const r = await api.get(`/sri/consulta-ruc/${val}`)
                      const d = r.data
                      if (d.razon_social) {
                        set('razon_social', d.razon_social)
                        if (d.tipo_contribuyente) set('tipo_contribuyente',
                          d.tipo_contribuyente.includes('NATURAL')?'NATURAL':'JURIDICA')
                        if (d.obligado_contabilidad !== undefined) set('obligado_contabilidad', d.obligado_contabilidad)
                        if (d.direccion) set('direccion', d.direccion)
                      }
                    } catch {}
                  }
                }}
                placeholder="RUC o cédula" style={{...FI,flex:1}}/>
              <button type="button" onClick={async()=>{
                  const val = form.identificacion.trim()
                  if (!val) return
                  try {
                    const r = await api.get(`/sri/consulta-ruc/${val}`)
                    const d = r.data
                    if (d.razon_social) {
                      set('razon_social', d.razon_social)
                      if (d.tipo_contribuyente) set('tipo_contribuyente',
                        d.tipo_contribuyente.includes('NATURAL')?'NATURAL':'JURIDICA')
                      if (d.obligado_contabilidad !== undefined) set('obligado_contabilidad', d.obligado_contabilidad)
                      if (d.direccion) set('direccion', d.direccion)
                    } else { alert(d.mensaje || 'No se encontraron datos en el SRI') }
                  } catch(e) { alert(e.response?.data?.detail || 'Error al consultar SRI') }
                }}
                style={{padding:'0 10px',borderRadius:7,border:`1px solid ${C.blue}44`,
                  background:`rgba(59,130,246,.1)`,color:C.blue,cursor:'pointer',
                  fontSize:11,fontWeight:700,whiteSpace:'nowrap'}}>
                🔍 SRI
              </button>
            </div>
          </Field>
          <Field label="Tipo contribuyente" w="third">
            <select value={form.tipo_contribuyente}
              onChange={e=>set('tipo_contribuyente',e.target.value)} style={FI}>
              <option value="NATURAL">Persona Natural</option>
              <option value="JURIDICA">Persona Jurídica</option>
              <option value="PUBLICA">Entidad Pública</option>
            </select>
          </Field>
          <Field label="Razón social" required w="half">
            <input value={form.razon_social}
              onChange={e=>set('razon_social',e.target.value.toUpperCase())}
              placeholder="Razón social o nombre completo" style={FI}/>
          </Field>
          <Field label="Nombre comercial" w="half">
            <input value={form.nombre_comercial}
              onChange={e=>set('nombre_comercial',e.target.value)}
              placeholder="Nombre con el que opera" style={FI}/>
          </Field>
          <Field label="Contribuyente especial N°" w="third">
            <input value={form.contribuyente_especial}
              onChange={e=>set('contribuyente_especial',e.target.value)}
              placeholder="N° resolución (si aplica)" style={FI}/>
          </Field>
          <Field label="Obligado a llevar contabilidad" w="third">
            <select value={form.obligado_contabilidad?'true':'false'}
              onChange={e=>set('obligado_contabilidad',e.target.value==='true')} style={FI}>
              <option value="false">No</option>
              <option value="true">Sí</option>
            </select>
          </Field>
          <Field label="Tipo de proveedor" w="third">
            <select value={form.tipo_proveedor}
              onChange={e=>set('tipo_proveedor',e.target.value)} style={FI}>
              <option value="BIENES">Bienes</option>
              <option value="SERVICIOS">Servicios</option>
              <option value="BIENES Y SERVICIOS">Bienes y Servicios</option>
              <option value="IMPORTADOR">Importador</option>
            </select>
          </Field>
        </Section>

        <Section title="📍 Datos de ubicación y contacto" color={C.muted}>
          <Field label="Nombres" w="half">
            <input value={form.nombres}
              onChange={e=>set('nombres',e.target.value)}
              placeholder="Nombres (persona natural)" style={FI}/>
          </Field>
          <Field label="Apellidos" w="half">
            <input value={form.apellidos}
              onChange={e=>set('apellidos',e.target.value)}
              placeholder="Apellidos" style={FI}/>
          </Field>
          <Field label="Teléfono" w="third">
            <input value={form.telefono}
              onChange={e=>set('telefono',e.target.value)}
              placeholder="0999999999" style={FI}/>
          </Field>
          <Field label="Email" required w="third">
            <input type="email" value={form.email}
              onChange={e=>set('email',e.target.value)}
              placeholder="email@proveedor.com" style={FI}/>
            <div style={{ fontSize:10, color:C.blue, marginTop:3 }}>
              ✉️ Para envío de órdenes de compra
            </div>
          </Field>
          <Field label="Ciudad" w="third">
            <input value={form.ciudad}
              onChange={e=>set('ciudad',e.target.value)}
              placeholder="Quito, Guayaquil..." style={FI}/>
          </Field>
          <Field label="Provincia" w="half">
            <input value={form.provincia}
              onChange={e=>set('provincia',e.target.value)}
              placeholder="Pichincha, Guayas..." style={FI}/>
          </Field>
          <Field label="País" w="half">
            <input value={form.pais}
              onChange={e=>set('pais',e.target.value)}
              placeholder="Ecuador" style={FI}/>
          </Field>
          <Field label="Dirección" w="half">
            <input value={form.direccion}
              onChange={e=>set('direccion',e.target.value)}
              placeholder="Calle principal y secundaria" style={FI}/>
          </Field>
          <Field label="Dirección de matriz (SRI)" w="half">
            <input value={form.direccion_matriz}
              onChange={e=>set('direccion_matriz',e.target.value)}
              placeholder="Dirección registrada en el SRI" style={FI}/>
          </Field>
        </Section>

        <Section title="👤 Contacto comercial" color={C.purple}>
          <Field label="Nombre del contacto" w="third">
            <input value={form.contacto_nombre}
              onChange={e=>set('contacto_nombre',e.target.value)}
              placeholder="Nombre del ejecutivo/vendedor" style={FI}/>
          </Field>
          <Field label="Teléfono del contacto" w="third">
            <input value={form.contacto_telefono}
              onChange={e=>set('contacto_telefono',e.target.value)}
              placeholder="0999999999" style={FI}/>
          </Field>
          <Field label="Email del contacto" w="third">
            <input type="email" value={form.contacto_email}
              onChange={e=>set('contacto_email',e.target.value)}
              placeholder="contacto@proveedor.com" style={FI}/>
          </Field>
        </Section>

        <Section title="💼 Condiciones de compra" color={C.green}>
          <Field label="Límite de crédito $" w="third">
            <input type="number" step="0.01" value={form.limite_credito}
              onChange={e=>set('limite_credito',e.target.value)}
              placeholder="0 = contado" style={FI}/>
          </Field>
          <Field label="Días de crédito" w="third">
            <input type="number" value={form.plazo_pago}
              onChange={e=>set('plazo_pago',e.target.value)}
              placeholder="0 = contado" style={FI}/>
          </Field>
          <Field label="Estado" w="third">
            <select value={form.activo?'true':'false'}
              onChange={e=>set('activo',e.target.value==='true')} style={FI}>
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </Field>
        </Section>

        {msg&&(
          <div style={{ padding:'8px 12px', borderRadius:8, fontSize:13, margin:'8px 0',
            background:msg.startsWith('❌')?C.redD:C.amberD,
            color:msg.startsWith('❌')?'#FCA5A5':'#FCD34D',
            border:`1px solid ${msg.startsWith('❌')?'rgba(239,68,68,.3)':'rgba(245,158,11,.3)'}` }}>
            {msg}
          </div>
        )}
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:14 }}>
          <button onClick={()=>setModalForm(false)}
            style={{ padding:'9px 20px', borderRadius:9, cursor:'pointer',
              border:`1px solid ${C.bord2}`, background:'transparent',
              color:C.muted, fontSize:13 }}>
            Cancelar
          </button>
          <button onClick={guardar} disabled={saving}
            style={{ padding:'9px 24px', borderRadius:9, border:'none',
              background:saving?C.sur3:C.blue, color:saving?C.hint:'white',
              cursor:saving?'not-allowed':'pointer', fontSize:13, fontWeight:700,
              display:'flex', alignItems:'center', gap:6 }}>
            <Check size={14}/>
            {saving?'Guardando...':provEdit?'Actualizar':'Crear proveedor'}
          </button>
        </div>
      </Modal>

      {/* ── MODAL VER ── */}
      <Modal open={modalVer} onClose={()=>setModalVer(false)}
        title={`🚚 ${provVer?.razon_social}`} width={520}>
        {provVer&&(
          <div>
            <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
              {[
                { label:provVer.tipo_identificacion, c:C.blue,   bg:C.blueD },
                { label:provVer.tipo_contribuyente,  c:C.purple, bg:'rgba(139,92,246,.15)' },
                { label:provVer.tipo_proveedor,      c:C.cyan,   bg:'rgba(6,182,212,.15)' },
                provVer.obligado_contabilidad&&{ label:'Oblig. contabilidad', c:C.amber, bg:C.amberD },
                provVer.contribuyente_especial&&{ label:`Contrib. especial #${provVer.contribuyente_especial}`, c:C.amber, bg:C.amberD },
                { label:provVer.activo?'Activo':'Inactivo', c:provVer.activo?C.green:C.hint, bg:provVer.activo?C.greenD:C.sur3 },
              ].filter(Boolean).map((b,i)=>(
                <span key={i} style={{ padding:'3px 10px', borderRadius:20,
                  fontSize:11, fontWeight:700, background:b.bg, color:b.c }}>
                  {b.label}
                </span>
              ))}
            </div>

            {[
              { icon:FileText,   label:'RUC / Identificación', value:provVer.identificacion },
              { icon:Building,   label:'Razón social',         value:provVer.razon_social },
              { icon:Truck,      label:'Nombre comercial',     value:provVer.nombre_comercial||'—' },
              { icon:Phone,      label:'Teléfono',             value:provVer.telefono||'—' },
              { icon:Mail,       label:'Email',                value:provVer.email||'—' },
              { icon:MapPin,     label:'Dirección',            value:provVer.direccion||'—' },
              { icon:MapPin,     label:'Ciudad / Provincia',   value:[provVer.ciudad,provVer.provincia].filter(Boolean).join(', ')||'—' },
              { icon:MapPin,     label:'Dirección matriz SRI', value:provVer.direccion_matriz||'—' },
              { icon:User,       label:'Contacto',             value:provVer.contacto_nombre||'—' },
              { icon:Phone,      label:'Tel. contacto',        value:provVer.contacto_telefono||'—' },
              { icon:Mail,       label:'Email contacto',       value:provVer.contacto_email||'—' },
              { icon:CreditCard, label:'Crédito / Plazo',      value:Number(provVer.limite_credito||0)>0?`$${Number(provVer.limite_credito).toFixed(2)} — ${provVer.plazo_pago} días`:'Contado' },
              { icon:Calendar,   label:'Proveedor desde',      value:provVer.created_at?new Date(provVer.created_at).toLocaleDateString('es-EC',{year:'numeric',month:'long',day:'numeric'}):'—' },
            ].map((r,i)=>(
              <div key={i} style={{ display:'flex', gap:12, alignItems:'center',
                padding:'8px 12px', background:i%2===0?C.sur2:'transparent',
                borderRadius:6, marginBottom:3 }}>
                <r.icon size={14} color={C.hint} style={{ flexShrink:0 }}/>
                <div style={{ display:'flex', justifyContent:'space-between',
                  width:'100%', gap:12 }}>
                  <span style={{ fontSize:11, color:C.hint }}>{r.label}</span>
                  <span style={{ fontSize:13, fontWeight:600, color:C.text,
                    textAlign:'right', maxWidth:'60%' }}>
                    {r.value}
                  </span>
                </div>
              </div>
            ))}

            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:18 }}>
              <button onClick={()=>setModalVer(false)}
                style={{ padding:'9px 20px', borderRadius:9, cursor:'pointer',
                  border:`1px solid ${C.bord2}`, background:'transparent',
                  color:C.muted, fontSize:13 }}>
                Cerrar
              </button>
              <button onClick={()=>{setModalVer(false);abrirEditar(provVer)}}
                style={{ padding:'9px 20px', borderRadius:9, border:'none',
                  background:C.blue, color:'white', cursor:'pointer',
                  fontSize:13, fontWeight:700,
                  display:'flex', alignItems:'center', gap:6 }}>
                <Edit2 size={14}/> Editar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}