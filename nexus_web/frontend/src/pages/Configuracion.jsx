import React, { useState, useEffect } from 'react'
import {
  Building, MapPin, Warehouse, Check, X,
  Plus, Edit2, ToggleLeft, ToggleRight, ChevronDown,
  ChevronUp, Star, Package, Shield, Upload, FileCheck, AlertTriangle
} from 'lucide-react'
import api from '../api'
import LogoUploader from '../components/LogoUploader'
import { useTheme } from '../theme'

const C = {
  bg:'#0A0F1E', surface:'#111827', sur2:'#1F2937', sur3:'#374151',
  bord2:'#374151', text:'#F9FAFB', muted:'#9CA3AF', hint:'#6B7280',
  blue:'#3B82F6', green:'#10B981', amber:'#F59E0B', red:'#EF4444',
  purple:'#8B5CF6', cyan:'#06B6D4',
  blueD:'rgba(59,130,246,.15)', greenD:'rgba(16,185,129,.15)',
  amberD:'rgba(245,158,11,.15)', redD:'rgba(239,68,68,.15)',
}

const SI = {
  background:C.sur2, color:C.text, border:`1px solid ${C.bord2}`,
  borderRadius:7, padding:'7px 10px', fontSize:13, outline:'none',
  width:'100%', boxSizing:'border-box',
}

function Modal({ open, onClose, title, children, width=660 }) {
  const C = useTheme()
  if(!open) return null
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.surface,borderRadius:14,padding:24,width,
        maxWidth:'96vw',maxHeight:'92vh',overflow:'auto',
        border:`1px solid ${C.bord2}`,boxShadow:'0 24px 60px rgba(0,0,0,.7)'}}>
        <div style={{display:'flex',justifyContent:'space-between',
          alignItems:'center',marginBottom:18}}>
          <div style={{fontSize:16,fontWeight:700,color:C.text}}>{title}</div>
          <button onClick={onClose} style={{background:'none',border:'none',
            cursor:'pointer',color:C.hint,fontSize:20}}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Section({ title, color, children }) {
  const C = useTheme()
  return(
    <div style={{background:C.sur2,borderRadius:10,padding:14,marginBottom:12,
      border:`1px solid ${C.bord2}`}}>
      <div style={{fontSize:11,fontWeight:700,color:color||C.blue,
        textTransform:'uppercase',letterSpacing:'.05em',marginBottom:10}}>
        {title}
      </div>
      <div style={{display:'flex',flexWrap:'wrap',gap:12}}>{children}</div>
    </div>
  )
}

function Field({ label, children, required, w='half' }) {
  const C = useTheme()
  const flex = w==='full'?'1 1 100%':w==='third'?'0 0 calc(33% - 8px)':'0 0 calc(50% - 6px)'
  return(
    <div style={{flex,minWidth:120}}>
      <label style={{fontSize:11,fontWeight:600,color:C.muted,
        display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'.04em'}}>
        {label}{required&&<span style={{color:C.red}}> *</span>}
      </label>
      {children}
    </div>
  )
}

const BLANK_SUC = {
  codigo:'',nombre:'',direccion:'',ciudad:'',provincia:'',
  pais:'Ecuador',telefono:'',email:'',codigo_establecimiento:'001',
  punto_emision:'001',contribuyente_especial:'',obligado_contabilidad:false,
  es_principal:false,meta_mensual_vendedores:0,activa:true,
  secuencial_factura:1,secuencial_nc:1,secuencial_nota_debito:1,
  secuencial_retencion:1,secuencial_guia_remision:1,secuencial_liquidacion:1
}
const BLANK_BOD = {
  sucursal_id:'',nombre:'',descripcion:'',direccion:'',
  responsable:'',telefono:'',es_principal:false,activa:true
}
const TABS = [
  {id:'empresa',  icon:Building,  label:'Empresa'   },
  {id:'sucursales',icon:MapPin,   label:'Sucursales'},
  {id:'bodegas',  icon:Warehouse, label:'Bodegas'   },
  {id:'sri',      icon:Shield,    label:'Facturación Electrónica'},
]

export default function Configuracion() {
  const C = useTheme()
  const [tab, setTab]               = useState('empresa')
  const [empresa, setEmpresa]       = useState(null)
  const [sucursales, setSucursales] = useState([])
  const [bodegas, setBodegas]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [msg, setMsg]               = useState('')
  const [saving, setSaving]         = useState(false)

  const [formEmp, setFormEmp] = useState({
    ruc:'',razon_social:'',nombre_comercial:'',direccion:'',
    telefono:'',email:'',website:'',representante_legal:'',
    contribuyente_tipo:'JURIDICA',obligado_contabilidad:false,
    regimen:'GENERAL',iva_porcentaje:15,ambiente_sri:'1',moneda:'DOLAR'
  })

  const [modalSuc, setModalSuc]   = useState(false)
  const [sucEdit, setSucEdit]     = useState(null)
  const [formSuc, setFormSuc]     = useState(BLANK_SUC)
  const [expandSuc, setExpandSuc] = useState(null)

  const [modalSeq, setModalSeq]   = useState(false)
  const [seqSuc, setSeqSuc]       = useState(null)
  const [formSeq, setFormSeq]     = useState({
    secuencial_factura:1,secuencial_nc:1,secuencial_nota_debito:1,
    secuencial_retencion:1,secuencial_guia_remision:1,secuencial_liquidacion:1
  })

  const [modalBod, setModalBod] = useState(false)
  const [bodEdit, setBodEdit]   = useState(null)
  const [formBod, setFormBod]   = useState(BLANK_BOD)

  useEffect(()=>{ cargarTodo() },[])

  async function cargarTodo() {
    setLoading(true)
    try {
      const [emp,suc,bod] = await Promise.all([
        api.get('/config/empresa').catch(()=>({data:null})),
        api.get('/config/sucursales').catch(()=>({data:[]})),
        api.get('/config/bodegas').catch(()=>({data:[]})),
      ])
      if(emp.data) {
        setEmpresa(emp.data)
        setFormEmp({
          ruc:emp.data.ruc||'',razon_social:emp.data.razon_social||'',
          nombre_comercial:emp.data.nombre_comercial||'',
          direccion:emp.data.direccion||'',telefono:emp.data.telefono||'',
          email:emp.data.email||'',website:emp.data.website||'',
          representante_legal:emp.data.representante_legal||'',
          contribuyente_tipo:emp.data.contribuyente_tipo||'JURIDICA',
          obligado_contabilidad:emp.data.obligado_contabilidad||false,
          regimen:emp.data.regimen||'GENERAL',
          iva_porcentaje:emp.data.iva_porcentaje||15,
          ambiente_sri:emp.data.ambiente_sri||'1',
          moneda:emp.data.moneda||'DOLAR',
        })
      }
      setSucursales(Array.isArray(suc.data)?suc.data:[])
      setBodegas(Array.isArray(bod.data)?bod.data:[])
    } finally { setLoading(false) }
  }

  const setE=(k,v)=>setFormEmp(f=>({...f,[k]:v}))
  const setS=(k,v)=>setFormSuc(f=>({...f,[k]:v}))
  const setB=(k,v)=>setFormBod(f=>({...f,[k]:v}))

  async function guardarEmpresa() {
    if(!formEmp.ruc||!formEmp.razon_social){setMsg('⚠️ RUC y razón social son obligatorios');return}
    setSaving(true);setMsg('')
    try {
      await api.put('/config/empresa',formEmp)
      setMsg('✅ Empresa guardada correctamente');cargarTodo()
    } catch(e){setMsg('❌ '+(e.response?.data?.detail||e.message))}
    finally{setSaving(false)}
  }

  function abrirNuevaSuc(){setFormSuc(BLANK_SUC);setSucEdit(null);setModalSuc(true)}
  function abrirEditarSuc(s){
    setFormSuc({...BLANK_SUC,...s,
      activa:s.activa!==false,
      es_principal:s.es_principal||false,
    })
    setSucEdit(s);setModalSuc(true)
  }

  async function guardarSucursal(){
    if(!formSuc.codigo||!formSuc.nombre){setMsg('⚠️ Código y nombre son obligatorios');return}
    setSaving(true)
    try {
      if(sucEdit) await api.put(`/config/sucursales/${sucEdit.id}`,formSuc)
      else await api.post('/config/sucursales',formSuc)
      setModalSuc(false);cargarTodo()
    } catch(e){setMsg('❌ '+(e.response?.data?.detail||e.message))}
    finally{setSaving(false)}
  }

  async function toggleSuc(s){await api.patch(`/config/sucursales/${s.id}/toggle`);cargarTodo()}

  async function abrirSecuenciales(s){
    setSeqSuc(s)
    try {
      const{data}=await api.get(`/config/sucursales/${s.id}/secuenciales`)
      setFormSeq({
        secuencial_factura:data.secuencial_factura||1,
        secuencial_nc:data.secuencial_nc||1,
        secuencial_nota_debito:data.secuencial_nota_debito||1,
        secuencial_retencion:data.secuencial_retencion||1,
        secuencial_guia_remision:data.secuencial_guia_remision||1,
        secuencial_liquidacion:data.secuencial_liquidacion||1,
      })
    } catch {}
    setModalSeq(true)
  }

  async function guardarSecuenciales(){
    setSaving(true)
    try {
      await api.put(`/config/sucursales/${seqSuc.id}/secuenciales`,formSeq)
      setMsg('✅ Secuenciales actualizados');setModalSeq(false)
    } catch(e){setMsg('❌ '+(e.response?.data?.detail||e.message))}
    finally{setSaving(false)}
  }

  function abrirNuevaBod(sucursal_id=''){setFormBod({...BLANK_BOD,sucursal_id});setBodEdit(null);setModalBod(true)}
  function abrirEditarBod(b){
    setFormBod({
      sucursal_id:b.sucursal_id||'',nombre:b.nombre||'',
      descripcion:b.descripcion||'',direccion:b.direccion||'',
      responsable:b.responsable||'',telefono:b.telefono||'',
      es_principal:b.es_principal||false,activa:b.activa!==false,
    })
    setBodEdit(b);setModalBod(true)
  }

  async function guardarBodega(){
    if(!formBod.nombre){setMsg('⚠️ El nombre de la bodega es obligatorio');return}
    setSaving(true)
    try {
      const body={...formBod,sucursal_id:formBod.sucursal_id||null}
      if(bodEdit) await api.put(`/config/bodegas/${bodEdit.id}`,body)
      else await api.post('/config/bodegas',body)
      setModalBod(false);cargarTodo()
    } catch(e){setMsg('❌ '+(e.response?.data?.detail||e.message))}
    finally{setSaving(false)}
  }

  async function toggleBod(b){await api.patch(`/config/bodegas/${b.id}/toggle`);cargarTodo()}

  if(loading) return(
    <div style={{background:C.bg,minHeight:'100vh',display:'flex',
      alignItems:'center',justifyContent:'center',color:C.muted,fontSize:15}}>
      ⏳ Cargando configuración...
    </div>
  )

  return(
    <div style={{background:C.bg,minHeight:'100vh',color:C.text,
      fontFamily:"'Inter','Segoe UI',sans-serif"}}>

      {/* Header */}
      <div style={{padding:'18px 28px',borderBottom:`1px solid ${C.bord2}`,
        background:C.surface,marginBottom:0}}>
        <div style={{fontSize:20,fontWeight:900}}>⚙️ Configuración</div>
        <div style={{fontSize:12,color:C.muted,marginTop:2}}>Empresa, sucursales y bodegas</div>
      </div>

      {/* Tabs */}
      <div style={{padding:'0 24px',background:C.surface,
        borderBottom:`1px solid ${C.bord2}`,display:'flex',gap:0}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>{setTab(t.id);setMsg('')}}
            style={{padding:'12px 20px',border:'none',background:'transparent',
              cursor:'pointer',fontSize:13,fontWeight:600,
              display:'flex',alignItems:'center',gap:6,
              color:tab===t.id?C.blue:C.hint,
              borderBottom:`2px solid ${tab===t.id?C.blue:'transparent'}`,
              transition:'all .15s'}}>
            <t.icon size={14}/>{t.label}
          </button>
        ))}
      </div>

      <div style={{padding:'20px 24px',maxWidth:900}}>
        {msg&&(
          <div style={{padding:'10px 14px',borderRadius:8,fontSize:13,marginBottom:16,
            color:msg.startsWith('❌')?C.red:msg.startsWith('✅')?C.green:C.amber,
            background:msg.startsWith('❌')?C.redD:msg.startsWith('✅')?C.greenD:C.amberD,
            border:`1px solid ${msg.startsWith('❌')?'rgba(239,68,68,.3)':msg.startsWith('✅')?'rgba(16,185,129,.3)':'rgba(245,158,11,.3)'}`}}>
            {msg}
          </div>
        )}

        {/* ── TAB EMPRESA ── */}
        {tab==='empresa'&&(
          <div>
            <Section title="🏢 Datos de la empresa (SRI)" color={C.blue}>
              <Field label="RUC" required w="third">
                <input value={formEmp.ruc} onChange={e=>setE('ruc',e.target.value)}
                  placeholder="1712345678001" style={SI}/>
              </Field>
              <Field label="Tipo contribuyente" w="third">
                <select value={formEmp.contribuyente_tipo}
                  onChange={e=>setE('contribuyente_tipo',e.target.value)} style={SI}>
                  <option value="NATURAL">Persona Natural</option>
                  <option value="JURIDICA">Persona Jurídica</option>
                  <option value="PUBLICA">Entidad Pública</option>
                </select>
              </Field>
              <Field label="Régimen" w="third">
                <select value={formEmp.regimen} onChange={e=>setE('regimen',e.target.value)} style={SI}>
                  <option value="GENERAL">Régimen General</option>
                  <option value="RIMPE">RIMPE</option>
                  <option value="RIMPE_EMPRENDEDOR">RIMPE Emprendedor</option>
                </select>
              </Field>
              <Field label="Razón social" required w="full">
                <input value={formEmp.razon_social}
                  onChange={e=>setE('razon_social',e.target.value.toUpperCase())}
                  placeholder="Razón social registrada en el SRI" style={SI}/>
              </Field>
              <Field label="Nombre comercial" w="half">
                <input value={formEmp.nombre_comercial}
                  onChange={e=>setE('nombre_comercial',e.target.value)}
                  placeholder="Nombre con que opera" style={SI}/>
              </Field>
              <Field label="Representante legal" w="half">
                <input value={formEmp.representante_legal}
                  onChange={e=>setE('representante_legal',e.target.value)}
                  placeholder="Nombre completo" style={SI}/>
              </Field>
              <Field label="Obligado contabilidad" w="third">
                <select value={formEmp.obligado_contabilidad?'true':'false'}
                  onChange={e=>setE('obligado_contabilidad',e.target.value==='true')} style={SI}>
                  <option value="false">No</option>
                  <option value="true">Sí</option>
                </select>
              </Field>
              <Field label="IVA %" w="third">
                <select value={formEmp.iva_porcentaje}
                  onChange={e=>setE('iva_porcentaje',Number(e.target.value))} style={SI}>
                  <option value={0}>0%</option>
                  <option value={5}>5%</option>
                  <option value={15}>15%</option>
                </select>
              </Field>
              <Field label="Ambiente SRI" w="third">
                <select value={formEmp.ambiente_sri}
                  onChange={e=>setE('ambiente_sri',e.target.value)} style={SI}>
                  <option value="1">1 — Pruebas</option>
                  <option value="2">2 — Producción</option>
                </select>
              </Field>
            </Section>

            <Section title="📍 Contacto y ubicación" color={C.cyan}>
              <Field label="Dirección" w="full">
                <input value={formEmp.direccion} onChange={e=>setE('direccion',e.target.value)}
                  placeholder="Dirección principal" style={SI}/>
              </Field>
              <Field label="Teléfono" w="third">
                <input value={formEmp.telefono} onChange={e=>setE('telefono',e.target.value)}
                  placeholder="022345678" style={SI}/>
              </Field>
              <Field label="Email" w="third">
                <input type="email" value={formEmp.email} onChange={e=>setE('email',e.target.value)}
                  placeholder="empresa@email.com" style={SI}/>
              </Field>
              <Field label="Sitio web" w="third">
                <input value={formEmp.website} onChange={e=>setE('website',e.target.value)}
                  placeholder="www.empresa.com" style={SI}/>
              </Field>
            </Section>

            <LogoUploader/>

            <div style={{display:'flex',justifyContent:'flex-end',marginTop:16}}>
              <button onClick={guardarEmpresa} disabled={saving}
                style={{padding:'10px 24px',borderRadius:9,border:'none',
                  background:C.green,color:'white',cursor:'pointer',
                  fontSize:14,fontWeight:700,display:'flex',alignItems:'center',gap:6}}>
                <Check size={15}/>{saving?'Guardando...':'Guardar empresa'}
              </button>
            </div>
          </div>
        )}

        {/* ── TAB SUCURSALES ── */}
        {tab==='sucursales'&&(
          <div>
            <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}>
              <button onClick={abrirNuevaSuc}
                style={{padding:'8px 18px',borderRadius:8,border:'none',
                  background:C.blue,color:'white',cursor:'pointer',
                  fontSize:13,fontWeight:700,display:'flex',alignItems:'center',gap:6}}>
                <Plus size={14}/> Nueva sucursal
              </button>
            </div>

            {sucursales.length===0?(
              <div style={{textAlign:'center',padding:40,color:C.hint,
                background:C.surface,borderRadius:12,border:`1px solid ${C.bord2}`}}>
                Sin sucursales — crea la primera con el botón de arriba
              </div>
            ):sucursales.map(s=>(
              <div key={s.id} style={{marginBottom:10,background:C.surface,
                borderRadius:12,border:`1px solid ${C.bord2}`,overflow:'hidden'}}>
                {/* Fila sucursal */}
                <div style={{display:'flex',alignItems:'center',gap:12,
                  padding:'13px 16px',cursor:'pointer'}}
                  onClick={()=>setExpandSuc(expandSuc===s.id?null:s.id)}>
                  <div style={{width:38,height:38,borderRadius:9,flexShrink:0,
                    background:s.es_principal?C.blueD:C.sur2,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    border:`1px solid ${s.es_principal?C.blue:C.bord2}`}}>
                    {s.es_principal
                      ?<Star size={16} color={C.blue}/>
                      :<MapPin size={16} color={C.hint}/>}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontWeight:700,fontSize:14,color:C.text}}>{s.nombre}</span>
                      <code style={{fontSize:10,color:C.hint}}>#{s.codigo}</code>
                      {s.es_principal&&<span style={{fontSize:9,padding:'1px 6px',
                        borderRadius:4,background:C.blueD,color:C.blue,fontWeight:700}}>Principal</span>}
                      <span style={{fontSize:9,padding:'1px 6px',borderRadius:4,fontWeight:700,
                        background:s.activa?C.greenD:C.sur3,color:s.activa?C.green:C.hint}}>
                        {s.activa?'Activa':'Inactiva'}
                      </span>
                    </div>
                    <div style={{fontSize:11,color:C.hint,marginTop:2}}>
                      {[s.ciudad,s.provincia].filter(Boolean).join(', ')||s.direccion||'—'}
                      <span style={{color:C.purple,marginLeft:8}}>· {s.num_bodegas||0} bodegas</span>
                      <span style={{color:C.blue,marginLeft:8}}>· {s.num_vendedores||0} vendedores</span>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:4,alignItems:'center',flexShrink:0}}>
                    <div style={{fontSize:10,color:C.hint,textAlign:'right',marginRight:4}}>
                      <div>Est: {s.codigo_establecimiento} | Emi: {s.punto_emision}</div>
                    </div>
                    <button onClick={e=>{e.stopPropagation();abrirSecuenciales(s)}}
                      style={{padding:'4px 8px',borderRadius:6,border:`1px solid ${C.bord2}`,
                        background:C.sur2,color:C.purple,cursor:'pointer',
                        fontSize:10,fontWeight:700}}>
                      #
                    </button>
                    <button onClick={e=>{e.stopPropagation();abrirEditarSuc(s)}}
                      style={{padding:'4px 7px',borderRadius:6,border:`1px solid ${C.bord2}`,
                        background:C.sur2,color:C.hint,cursor:'pointer'}}>
                      <Edit2 size={12}/>
                    </button>
                    <button onClick={e=>{e.stopPropagation();toggleSuc(s)}}
                      style={{padding:'4px 7px',borderRadius:6,border:`1px solid ${C.bord2}`,
                        background:C.sur2,cursor:'pointer'}}>
                      {s.activa
                        ?<ToggleRight size={14} color={C.green}/>
                        :<ToggleLeft size={14} color={C.hint}/>}
                    </button>
                    {expandSuc===s.id
                      ?<ChevronUp size={15} color={C.hint}/>
                      :<ChevronDown size={15} color={C.hint}/>}
                  </div>
                </div>

                {/* Bodegas expandidas */}
                {expandSuc===s.id&&(
                  <div style={{borderTop:`1px solid ${C.bord2}`,padding:'12px 16px',
                    background:C.sur2}}>
                    <div style={{display:'flex',justifyContent:'space-between',
                      alignItems:'center',marginBottom:10}}>
                      <span style={{fontSize:12,fontWeight:700,color:C.muted}}>
                        📦 Bodegas de {s.nombre}
                      </span>
                      <button onClick={()=>abrirNuevaBod(s.id)}
                        style={{padding:'4px 10px',borderRadius:6,border:`1px solid ${C.bord2}`,
                          background:C.sur3,color:C.text,cursor:'pointer',
                          fontSize:11,display:'flex',alignItems:'center',gap:4}}>
                        <Plus size={11}/> Nueva bodega
                      </button>
                    </div>
                    {bodegas.filter(b=>b.sucursal_id===s.id).length===0?(
                      <div style={{textAlign:'center',padding:16,color:C.hint,fontSize:12}}>
                        Sin bodegas — agrega la primera
                      </div>
                    ):(
                      <div style={{display:'grid',
                        gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:8}}>
                        {bodegas.filter(b=>b.sucursal_id===s.id).map(b=>(
                          <div key={b.id} style={{background:C.surface,borderRadius:8,
                            padding:'10px 12px',border:`1px solid ${C.bord2}`}}>
                            <div style={{display:'flex',justifyContent:'space-between',
                              alignItems:'flex-start'}}>
                              <div>
                                <div style={{display:'flex',alignItems:'center',gap:5}}>
                                  <Warehouse size={13}
                                    color={b.es_principal?C.blue:C.hint}/>
                                  <span style={{fontWeight:600,fontSize:13,color:C.text}}>
                                    {b.nombre}
                                  </span>
                                  {b.es_principal&&(
                                    <span style={{fontSize:8,padding:'1px 5px',
                                      borderRadius:3,background:C.blueD,
                                      color:C.blue,fontWeight:700}}>
                                      Principal
                                    </span>
                                  )}
                                </div>
                                {b.descripcion&&(
                                  <div style={{fontSize:11,color:C.hint,marginTop:2}}>
                                    {b.descripcion}
                                  </div>
                                )}
                                {b.responsable&&(
                                  <div style={{fontSize:11,color:C.hint}}>
                                    👤 {b.responsable}
                                  </div>
                                )}
                                <div style={{fontSize:11,color:C.purple,
                                  marginTop:3,fontWeight:600}}>
                                  <Package size={10} style={{marginRight:3}}/>
                                  {Number(b.total_stock||0).toFixed(0)} u. en stock
                                </div>
                              </div>
                              <div style={{display:'flex',gap:3}}>
                                <button onClick={()=>abrirEditarBod(b)}
                                  style={{padding:'3px 5px',borderRadius:5,
                                    border:`1px solid ${C.bord2}`,background:C.sur2,
                                    color:C.hint,cursor:'pointer'}}>
                                  <Edit2 size={11}/>
                                </button>
                                <button onClick={()=>toggleBod(b)}
                                  style={{padding:'3px 5px',borderRadius:5,
                                    border:`1px solid ${C.bord2}`,background:C.sur2,
                                    cursor:'pointer'}}>
                                  {b.activa
                                    ?<ToggleRight size={12} color={C.green}/>
                                    :<ToggleLeft size={12} color={C.hint}/>}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── TAB BODEGAS ── */}
        {tab==='bodegas'&&(
          <div>
            <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}>
              <button onClick={()=>abrirNuevaBod()}
                style={{padding:'8px 18px',borderRadius:8,border:'none',
                  background:C.blue,color:'white',cursor:'pointer',
                  fontSize:13,fontWeight:700,display:'flex',alignItems:'center',gap:6}}>
                <Plus size={14}/> Nueva bodega
              </button>
            </div>
            <div style={{background:C.surface,borderRadius:12,
              border:`1px solid ${C.bord2}`,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{background:C.sur3}}>
                    {['Bodega','Sucursal','Responsable','Teléfono','Stock','Estado',''].map(h=>(
                      <th key={h} style={{padding:'9px 12px',textAlign:'left',fontSize:10,
                        fontWeight:700,color:C.hint,textTransform:'uppercase'}}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bodegas.map((b,i)=>(
                    <tr key={b.id} style={{borderBottom:`1px solid ${C.bord2}`,
                      background:i%2===0?'transparent':'rgba(255,255,255,.01)'}}>
                      <td style={{padding:'10px 12px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <Warehouse size={13} color={b.es_principal?C.blue:C.hint}/>
                          <div>
                            <div style={{fontWeight:600,fontSize:13,color:C.text}}>
                              {b.nombre}
                              {b.es_principal&&(
                                <span style={{marginLeft:5,fontSize:9,padding:'1px 5px',
                                  borderRadius:3,background:C.blueD,color:C.blue,fontWeight:700}}>
                                  Principal
                                </span>
                              )}
                            </div>
                            {b.descripcion&&(
                              <div style={{fontSize:11,color:C.hint}}>{b.descripcion}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{padding:'10px 12px',fontSize:12,color:C.muted}}>
                        {b.sucursal_nombre||'—'}
                      </td>
                      <td style={{padding:'10px 12px',fontSize:12,color:C.muted}}>
                        {b.responsable||'—'}
                      </td>
                      <td style={{padding:'10px 12px',fontSize:12,color:C.muted}}>
                        {b.telefono||'—'}
                      </td>
                      <td style={{padding:'10px 12px'}}>
                        <span style={{fontSize:11,padding:'2px 8px',borderRadius:5,fontWeight:700,
                          background:Number(b.total_stock||0)>0?C.greenD:C.sur3,
                          color:Number(b.total_stock||0)>0?C.green:C.hint}}>
                          {Number(b.total_stock||0).toFixed(0)} u.
                        </span>
                      </td>
                      <td style={{padding:'10px 12px'}}>
                        <span style={{fontSize:11,padding:'2px 8px',borderRadius:5,fontWeight:700,
                          background:b.activa?C.greenD:C.sur3,
                          color:b.activa?C.green:C.hint}}>
                          {b.activa?'Activa':'Inactiva'}
                        </span>
                      </td>
                      <td style={{padding:'10px 8px'}}>
                        <div style={{display:'flex',gap:4}}>
                          <button onClick={()=>abrirEditarBod(b)}
                            style={{padding:'4px 7px',borderRadius:6,border:`1px solid ${C.bord2}`,
                              background:C.sur2,color:C.hint,cursor:'pointer'}}>
                            <Edit2 size={12}/>
                          </button>
                          <button onClick={()=>toggleBod(b)}
                            style={{padding:'4px 7px',borderRadius:6,border:`1px solid ${C.bord2}`,
                              background:C.sur2,cursor:'pointer'}}>
                            {b.activa
                              ?<ToggleRight size={13} color={C.green}/>
                              :<ToggleLeft size={13} color={C.hint}/>}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {bodegas.length===0&&(
                    <tr><td colSpan={7} style={{textAlign:'center',padding:40,color:C.hint}}>
                      Sin bodegas configuradas
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════ SRI ══════════ */}
        {tab==='sri'&&<PanelSRI msg={msg} setMsg={setMsg}/>}
      </div>

      {/* ── MODAL SUCURSAL ── */}
      <Modal open={modalSuc} onClose={()=>setModalSuc(false)}
        title={sucEdit?`✏️ Editar: ${sucEdit.nombre}`:'➕ Nueva sucursal'}>
        <Section title="🏢 Identificación SRI" color={C.blue}>
          <Field label="Código" required w="third">
            <input value={formSuc.codigo}
              onChange={e=>setS('codigo',e.target.value.toUpperCase())}
              placeholder="SUC001" style={SI}/>
          </Field>
          <Field label="Establecimiento SRI" required w="third">
            <input value={formSuc.codigo_establecimiento}
              onChange={e=>setS('codigo_establecimiento',e.target.value)}
              placeholder="001" style={SI}/>
            <div style={{fontSize:10,color:C.blue,marginTop:2}}>3 dígitos — asignado por el SRI</div>
          </Field>
          <Field label="Punto de emisión" required w="third">
            <input value={formSuc.punto_emision}
              onChange={e=>setS('punto_emision',e.target.value)}
              placeholder="001" style={SI}/>
            <div style={{fontSize:10,color:C.blue,marginTop:2}}>3 dígitos — para facturas</div>
          </Field>
          <Field label="Nombre de la sucursal" required w="full">
            <input value={formSuc.nombre}
              onChange={e=>setS('nombre',e.target.value.toUpperCase())}
              placeholder="Nombre de la sucursal" style={SI}/>
          </Field>
          <Field label="Contribuyente especial N°" w="third">
            <input value={formSuc.contribuyente_especial}
              onChange={e=>setS('contribuyente_especial',e.target.value)}
              placeholder="Si aplica" style={SI}/>
          </Field>
          <Field label="Obligado contabilidad" w="third">
            <select value={formSuc.obligado_contabilidad?'true':'false'}
              onChange={e=>setS('obligado_contabilidad',e.target.value==='true')} style={SI}>
              <option value="false">No</option>
              <option value="true">Sí</option>
            </select>
          </Field>
          <Field label="¿Es principal?" w="third">
            <select value={formSuc.es_principal?'true':'false'}
              onChange={e=>setS('es_principal',e.target.value==='true')} style={SI}>
              <option value="false">No</option>
              <option value="true">Sí</option>
            </select>
          </Field>
        </Section>

        <Section title="📍 Ubicación y contacto" color={C.cyan}>
          <Field label="Dirección" w="full">
            <input value={formSuc.direccion} onChange={e=>setS('direccion',e.target.value)}
              placeholder="Dirección completa" style={SI}/>
          </Field>
          <Field label="Ciudad" w="third">
            <input value={formSuc.ciudad} onChange={e=>setS('ciudad',e.target.value)}
              placeholder="Quito, Guayaquil..." style={SI}/>
          </Field>
          <Field label="Provincia" w="third">
            <input value={formSuc.provincia} onChange={e=>setS('provincia',e.target.value)}
              placeholder="Pichincha, Guayas..." style={SI}/>
          </Field>
          <Field label="País" w="third">
            <input value={formSuc.pais} onChange={e=>setS('pais',e.target.value)} style={SI}/>
          </Field>
          <Field label="Teléfono" w="half">
            <input value={formSuc.telefono} onChange={e=>setS('telefono',e.target.value)}
              placeholder="022345678" style={SI}/>
          </Field>
          <Field label="Email" w="half">
            <input type="email" value={formSuc.email} onChange={e=>setS('email',e.target.value)}
              placeholder="sucursal@empresa.com" style={SI}/>
          </Field>
        </Section>

        <Section title="🔢 Secuenciales SRI" color={C.amber}>
          <div style={{flex:'1 1 100%',padding:'8px 10px',borderRadius:7,
            background:C.amberD,fontSize:11,color:C.amber,marginBottom:4}}>
            ⚠️ Solo cambia estos números si la empresa ya operaba antes. El SRI rechaza duplicados.
          </div>
          {[
            {key:'secuencial_factura',      label:'Factura',           code:'01'},
            {key:'secuencial_nc',           label:'Nota de crédito',   code:'04'},
            {key:'secuencial_nota_debito',  label:'Nota de débito',    code:'05'},
            {key:'secuencial_retencion',    label:'Retención',         code:'07'},
            {key:'secuencial_guia_remision',label:'Guía de remisión',  code:'06'},
            {key:'secuencial_liquidacion',  label:'Liquidación',       code:'03'},
          ].map(item=>(
            <div key={item.key} style={{flex:'0 0 calc(33% - 8px)',minWidth:140}}>
              <label style={{fontSize:10,fontWeight:700,color:C.muted,
                display:'block',marginBottom:4,textTransform:'uppercase'}}>
                {item.label} <span style={{color:C.hint}}>(tipo {item.code})</span>
              </label>
              <input type="number" min="1" value={formSuc[item.key]}
                onChange={e=>setS(item.key,parseInt(e.target.value)||1)}
                style={{...SI,color:C.amber,fontWeight:700}}/>
              <div style={{fontSize:9,color:C.hint,marginTop:2}}>
                Próximo: {String(formSuc[item.key]).padStart(9,'0')}
              </div>
            </div>
          ))}
        </Section>

        <Section title="🎯 Meta de vendedores" color={C.green}>
          <Field label="Meta mensual $" w="half">
            <input type="number" step="0.01" value={formSuc.meta_mensual_vendedores}
              onChange={e=>setS('meta_mensual_vendedores',e.target.value)}
              placeholder="0" style={SI}/>
          </Field>
          <Field label="Estado" w="half">
            <select value={formSuc.activa?'true':'false'}
              onChange={e=>setS('activa',e.target.value==='true')} style={SI}>
              <option value="true">Activa</option>
              <option value="false">Inactiva</option>
            </select>
          </Field>
        </Section>

        <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:14}}>
          <button onClick={()=>setModalSuc(false)}
            style={{padding:'9px 18px',borderRadius:8,border:`1px solid ${C.bord2}`,
              background:'transparent',color:C.muted,cursor:'pointer',fontSize:13}}>
            Cancelar
          </button>
          <button onClick={guardarSucursal} disabled={saving}
            style={{padding:'9px 20px',borderRadius:8,border:'none',
              background:C.blue,color:'white',cursor:'pointer',
              fontSize:13,fontWeight:700,display:'flex',alignItems:'center',gap:6}}>
            <Check size={14}/>{saving?'Guardando...':sucEdit?'Actualizar':'Crear sucursal'}
          </button>
        </div>
      </Modal>

      {/* ── MODAL SECUENCIALES ── */}
      <Modal open={modalSeq} onClose={()=>setModalSeq(false)}
        title={`🔢 Secuenciales — ${seqSuc?.nombre}`} width={500}>
        {seqSuc&&(
          <div>
            <div style={{padding:'10px 14px',borderRadius:8,marginBottom:16,
              background:C.blueD,fontSize:12,color:C.blue,border:`1px solid rgba(59,130,246,.3)`}}>
              ℹ️ Estab: <strong>{seqSuc.codigo_establecimiento}</strong> | 
              Emisión: <strong>{seqSuc.punto_emision}</strong> — 
              El número que ingreses será el <strong>próximo a usar</strong>.
            </div>
            {[
              {key:'secuencial_factura',       label:'🧾 Factura',              color:C.blue},
              {key:'secuencial_nc',            label:'📋 Nota de crédito',      color:C.green},
              {key:'secuencial_nota_debito',   label:'📄 Nota de débito',       color:C.amber},
              {key:'secuencial_retencion',     label:'🧮 Retención',            color:C.purple},
              {key:'secuencial_guia_remision', label:'🚚 Guía de remisión',     color:C.cyan},
              {key:'secuencial_liquidacion',   label:'📑 Liquidación compra',   color:C.red},
            ].map((r,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:14,
                padding:'10px 14px',background:i%2===0?C.sur2:C.surface,
                borderRadius:8,marginBottom:6}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:C.text}}>{r.label}</div>
                  <div style={{fontSize:10,color:C.hint}}>
                    Formato: {seqSuc.codigo_establecimiento}-{seqSuc.punto_emision}-{String(formSeq[r.key]).padStart(9,'0')}
                  </div>
                </div>
                <input type="number" min="1" value={formSeq[r.key]}
                  onChange={e=>setFormSeq(f=>({...f,[r.key]:parseInt(e.target.value)||1}))}
                  style={{...SI,width:110,textAlign:'right',fontWeight:700,
                    fontSize:16,color:r.color,borderColor:r.color+'44'}}/>
              </div>
            ))}
            <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:16}}>
              <button onClick={()=>setModalSeq(false)}
                style={{padding:'9px 18px',borderRadius:8,border:`1px solid ${C.bord2}`,
                  background:'transparent',color:C.muted,cursor:'pointer',fontSize:13}}>
                Cancelar
              </button>
              <button onClick={guardarSecuenciales} disabled={saving}
                style={{padding:'9px 20px',borderRadius:8,border:'none',
                  background:C.green,color:'white',cursor:'pointer',
                  fontSize:13,fontWeight:700,display:'flex',alignItems:'center',gap:6}}>
                <Check size={14}/>{saving?'Guardando...':'Guardar secuenciales'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL BODEGA ── */}
      <Modal open={modalBod} onClose={()=>setModalBod(false)}
        title={bodEdit?`✏️ Editar: ${bodEdit.nombre}`:'➕ Nueva bodega'} width={540}>
        <Section title="📦 Datos de la bodega" color={C.purple}>
          <Field label="Sucursal" w="full">
            <select value={formBod.sucursal_id}
              onChange={e=>setB('sucursal_id',e.target.value)} style={SI}>
              <option value="">— Sin sucursal asignada —</option>
              {sucursales.map(s=>(
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </Field>
          <Field label="Nombre de la bodega" required w="full">
            <input value={formBod.nombre}
              onChange={e=>setB('nombre',e.target.value.toUpperCase())}
              placeholder="Bodega principal, Bodega repuestos..." style={SI}/>
          </Field>
          <Field label="Descripción" w="full">
            <input value={formBod.descripcion}
              onChange={e=>setB('descripcion',e.target.value)}
              placeholder="Descripción opcional" style={SI}/>
          </Field>
          <Field label="Responsable" w="half">
            <input value={formBod.responsable}
              onChange={e=>setB('responsable',e.target.value)}
              placeholder="Nombre del responsable" style={SI}/>
          </Field>
          <Field label="Teléfono" w="half">
            <input value={formBod.telefono}
              onChange={e=>setB('telefono',e.target.value)}
              placeholder="Teléfono de la bodega" style={SI}/>
          </Field>
          <Field label="Dirección" w="full">
            <input value={formBod.direccion}
              onChange={e=>setB('direccion',e.target.value)}
              placeholder="Dirección si es diferente a la sucursal" style={SI}/>
          </Field>
          <div style={{flex:'1 1 100%',display:'flex',gap:20}}>
            <label style={{display:'flex',gap:6,alignItems:'center',
              fontSize:13,cursor:'pointer',color:C.text}}>
              <input type="checkbox" checked={formBod.es_principal}
                onChange={e=>setB('es_principal',e.target.checked)}
                style={{width:'auto',accentColor:C.blue}}/>
              Bodega principal de la sucursal
            </label>
            <label style={{display:'flex',gap:6,alignItems:'center',
              fontSize:13,cursor:'pointer',color:C.text}}>
              <input type="checkbox" checked={formBod.activa}
                onChange={e=>setB('activa',e.target.checked)}
                style={{width:'auto',accentColor:C.blue}}/>
              Bodega activa
            </label>
          </div>
        </Section>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:14}}>
          <button onClick={()=>setModalBod(false)}
            style={{padding:'9px 18px',borderRadius:8,border:`1px solid ${C.bord2}`,
              background:'transparent',color:C.muted,cursor:'pointer',fontSize:13}}>
            Cancelar
          </button>
          <button onClick={guardarBodega} disabled={saving}
            style={{padding:'9px 20px',borderRadius:8,border:'none',
              background:C.purple,color:'white',cursor:'pointer',
              fontSize:13,fontWeight:700,display:'flex',alignItems:'center',gap:6}}>
            <Check size={14}/>{saving?'Guardando...':bodEdit?'Actualizar':'Crear bodega'}
          </button>
        </div>
      </Modal>
    </div>
  )
}


// ══════════════════════════════════════════════════════════════
//  PANEL SRI — Facturación Electrónica
// ══════════════════════════════════════════════════════════════
function PanelSRI({ msg, setMsg }) {
  const C = useTheme()
  const [cert, setCert]       = useState(null)
  const [estado, setEstado]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUpl]   = useState(false)
  const [password, setPass]   = useState('')
  const [verifying, setVerif] = useState(false)
  const [processing, setProc] = useState(false)
  const [procResult, setProcR]= useState(null)

  useEffect(()=>{ cargar() },[])

  async function cargar() {
    setLoading(true)
    try {
      const [r1, r2] = await Promise.all([
        api.get('/sri/certificado').catch(()=>({data:{valido:false}})),
        api.get('/sri/estado').catch(()=>({data:null})),
      ])
      setCert(r1.data)
      setEstado(r2.data)
    } catch {} finally { setLoading(false) }
  }

  async function subirCert(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.p12')) {
      setMsg('El archivo debe ser .p12')
      return
    }
    setUpl(true)
    try {
      const form = new FormData()
      form.append('file', file)
      await api.post('/sri/certificado', form)
      setMsg('Certificado subido correctamente')
      cargar()
    } catch (e) {
      setMsg('Error: '+(e.response?.data?.detail||e.message))
    } finally { setUpl(false) }
  }

  async function verificarPass() {
    if (!password) return
    setVerif(true)
    try {
      const { data } = await api.post('/sri/certificado/verificar', { password })
      setCert(data)
      if (data.valido) setMsg('Certificado verificado correctamente')
      else setMsg('Contraseña incorrecta: '+(data.error||''))
    } catch (e) {
      setMsg('Error: '+(e.response?.data?.detail||e.message))
    } finally { setVerif(false) }
  }

  async function procesarPendientes() {
    setProc(true)
    setProcR(null)
    try {
      const { data } = await api.post('/sri/facturas/procesar-pendientes')
      setProcR(data)
      setMsg(`${data.procesadas} factura(s) procesadas`)
      cargar()
    } catch (e) {
      setMsg('Error: '+(e.response?.data?.detail||e.message))
    } finally { setProc(false) }
  }

  if (loading) return <div style={{textAlign:'center',padding:40,color:C.hint}}>Cargando...</div>

  const stats = estado?.facturas || {}

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>

      {/* ── Estado general ── */}
      <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
        {[
          { label:'Ambiente',   value: estado?.ambiente_nombre || 'PRUEBAS',
            color: estado?.ambiente==='2' ? C.green : C.amber,
            bg: estado?.ambiente==='2' ? C.greenD : C.amberD },
          { label:'RUC',        value: estado?.ruc || 'No configurado', color:C.blue, bg:C.blueD },
          { label:'Certificado',value: estado?.tiene_certificado ? 'Activo' : 'No configurado',
            color: estado?.tiene_certificado ? C.green : C.red,
            bg: estado?.tiene_certificado ? C.greenD : C.redD },
        ].map((k,i) => (
          <div key={i} style={{flex:'1 1 200px',padding:'14px 16px',borderRadius:10,
            background:k.bg,border:`1px solid ${k.color}33`}}>
            <div style={{fontSize:10,fontWeight:700,color:k.color,textTransform:'uppercase',
              letterSpacing:'.05em',marginBottom:4}}>{k.label}</div>
            <div style={{fontSize:15,fontWeight:800,color:k.color}}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── Estadísticas facturas ── */}
      <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
        {[
          { label:'Autorizadas',  value:stats.autorizadas||0,  color:C.green, bg:C.greenD },
          { label:'Pendientes',   value:stats.pendientes||0,   color:C.amber, bg:C.amberD },
          { label:'Recibidas',    value:stats.recibidas||0,    color:C.cyan,  bg:'rgba(6,182,212,.15)' },
          { label:'Rechazadas',   value:stats.rechazadas||0,   color:C.red,   bg:C.redD },
          { label:'Error firma',  value:stats.error_firma||0,  color:C.red,   bg:C.redD },
        ].map((k,i) => (
          <div key={i} style={{flex:'1 1 120px',padding:'12px 14px',borderRadius:10,
            background:k.bg,border:`1px solid ${k.color}33`,textAlign:'center'}}>
            <div style={{fontSize:22,fontWeight:900,color:k.color}}>{k.value}</div>
            <div style={{fontSize:10,fontWeight:600,color:k.color,textTransform:'uppercase'}}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Certificado .p12 ── */}
      <div style={{background:C.sur2,borderRadius:10,padding:16,border:`1px solid ${C.bord2}`}}>
        <div style={{fontSize:11,fontWeight:700,color:C.blue,textTransform:'uppercase',
          letterSpacing:'.05em',marginBottom:12,display:'flex',alignItems:'center',gap:6}}>
          <Shield size={14}/> Certificado de firma electrónica (.p12)
        </div>

        {cert?.valido ? (
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <FileCheck size={16} color={C.green}/>
              <span style={{fontSize:13,fontWeight:700,color:C.green}}>Certificado válido</span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,fontSize:12}}>
              <div><span style={{color:C.muted}}>Sujeto:</span> <span style={{color:C.text}}>{cert.sujeto}</span></div>
              <div><span style={{color:C.muted}}>Emisor:</span> <span style={{color:C.text}}>{cert.emisor}</span></div>
              <div><span style={{color:C.muted}}>Válido desde:</span> <span style={{color:C.text}}>{cert.valido_desde?.slice(0,10)}</span></div>
              <div><span style={{color:C.muted}}>Válido hasta:</span> <span style={{color:C.text,fontWeight:700}}>{cert.valido_hasta?.slice(0,10)}</span></div>
              <div><span style={{color:C.muted}}>Archivo:</span> <span style={{color:C.text}}>{cert.archivo}</span></div>
            </div>
          </div>
        ) : (
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
            <AlertTriangle size={16} color={C.amber}/>
            <span style={{fontSize:13,color:C.amber}}>
              {cert?.error || 'No hay certificado configurado'}
            </span>
          </div>
        )}

        <div style={{display:'flex',gap:12,marginTop:14,alignItems:'center',flexWrap:'wrap'}}>
          <label style={{padding:'8px 16px',borderRadius:8,border:`1px solid ${C.blue}44`,
            background:C.blueD,color:C.blue,cursor:'pointer',fontSize:12,fontWeight:700,
            display:'flex',alignItems:'center',gap:6}}>
            <Upload size={14}/> {uploading ? 'Subiendo...' : 'Subir certificado .p12'}
            <input type="file" accept=".p12" onChange={subirCert}
              style={{display:'none'}} disabled={uploading}/>
          </label>

          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            <input type="password" value={password} onChange={e=>setPass(e.target.value)}
              placeholder="Contraseña del .p12"
              onKeyDown={e=>e.key==='Enter'&&verificarPass()}
              style={{padding:'8px 12px',borderRadius:8,fontSize:12,
                border:`1px solid ${C.bord2}`,background:C.sur3,color:C.text,
                outline:'none',width:200}}/>
            <button onClick={verificarPass} disabled={verifying||!password}
              style={{padding:'8px 14px',borderRadius:8,border:'none',
                background:C.green,color:'white',cursor:'pointer',
                fontSize:12,fontWeight:700,opacity:verifying||!password?.5:1}}>
              {verifying?'Verificando...':'Verificar'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Procesar pendientes ── */}
      <div style={{background:C.sur2,borderRadius:10,padding:16,border:`1px solid ${C.bord2}`}}>
        <div style={{fontSize:11,fontWeight:700,color:C.purple,textTransform:'uppercase',
          letterSpacing:'.05em',marginBottom:12}}>
          Envío masivo al SRI
        </div>
        <div style={{fontSize:13,color:C.muted,marginBottom:12}}>
          Procesa todas las facturas pendientes: genera XML, firma con el certificado y envía al SRI.
        </div>
        <button onClick={procesarPendientes} disabled={processing||!cert?.valido}
          style={{padding:'10px 24px',borderRadius:8,border:'none',
            background:cert?.valido?C.purple:C.sur3,
            color:cert?.valido?'white':C.hint,
            cursor:cert?.valido?'pointer':'not-allowed',
            fontSize:13,fontWeight:700}}>
          {processing?'Procesando...':'Procesar facturas pendientes'}
        </button>
        {!cert?.valido&&(
          <div style={{fontSize:11,color:C.amber,marginTop:8}}>
            Configure y verifique el certificado .p12 antes de enviar al SRI
          </div>
        )}

        {procResult&&(
          <div style={{marginTop:14,maxHeight:300,overflowY:'auto'}}>
            <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:8}}>
              Resultado: {procResult.procesadas} factura(s)
            </div>
            {procResult.resultados?.map((r,i)=>(
              <div key={i} style={{padding:'8px 12px',borderRadius:8,marginBottom:4,
                background:r.estado==='AUTORIZADA'?C.greenD:r.estado==='RECHAZADA'?C.redD:C.amberD,
                fontSize:12,display:'flex',justifyContent:'space-between'}}>
                <span style={{color:r.estado==='AUTORIZADA'?C.green:r.estado==='RECHAZADA'?C.red:C.amber,
                  fontWeight:700}}>{r.numero}</span>
                <span style={{color:r.estado==='AUTORIZADA'?C.green:r.estado==='RECHAZADA'?C.red:C.amber}}>
                  {r.estado} {r.msg&&`— ${r.msg}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Info ambiente ── */}
      <div style={{padding:'12px 16px',borderRadius:8,fontSize:12,
        background:estado?.ambiente==='2'?C.greenD:C.amberD,
        color:estado?.ambiente==='2'?C.green:C.amber,
        border:`1px solid ${estado?.ambiente==='2'?C.green:C.amber}33`}}>
        <strong>Ambiente {estado?.ambiente==='2'?'PRODUCCIÓN':'PRUEBAS'}:</strong>{' '}
        {estado?.ambiente==='2'
          ? 'Las facturas se envían al SRI real. Tienen validez tributaria.'
          : 'Las facturas se envían al servidor de pruebas del SRI. No tienen validez tributaria. Cambie a Producción en la pestaña Empresa cuando esté listo.'}
      </div>

      {/* ── Configuración Email ── */}
      <EmailConfig setMsg={setMsg}/>
    </div>
  )
}

function EmailConfig({ setMsg }) {
  const C = useTheme()
  const [cfg, setCfg] = useState(null)
  const [form, setForm] = useState({
    smtp_host:'smtp.gmail.com', smtp_port:587, smtp_user:'', smtp_password:'',
    smtp_from_name:'', smtp_from_email:'', smtp_use_tls:true
  })
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showPass, setShowPass] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    try {
      const { data } = await api.get('/sri/email/config')
      setCfg(data)
      if (data.configurado) {
        setForm({
          smtp_host: data.host||'smtp.gmail.com', smtp_port: data.port||587,
          smtp_user: data.user||'', smtp_password: '',
          smtp_from_name: data.from_name||'', smtp_from_email: data.from_email||'',
          smtp_use_tls: data.use_tls!==false
        })
      }
    } catch {}
  }

  const sf = (k, v) => setForm(p => ({...p, [k]: v}))

  async function guardar() {
    if (!form.smtp_host || !form.smtp_user) {
      setMsg('Servidor y usuario son obligatorios')
      return
    }
    if (!cfg?.configurado && !form.smtp_password) {
      setMsg('La contraseña es obligatoria')
      return
    }
    setSaving(true)
    try {
      const body = {...form}
      if (!body.smtp_password) delete body.smtp_password
      if (!body.smtp_from_email) body.smtp_from_email = body.smtp_user
      if (!body.smtp_from_name) body.smtp_from_name = 'NEXUS POS'
      await api.post('/sri/email/config', body)
      setMsg('Configuración de email guardada')
      setEditing(false)
      cargar()
    } catch (e) {
      setMsg('Error: '+(e.response?.data?.detail||e.message))
    } finally { setSaving(false) }
  }

  async function testEmail() {
    setTesting(true)
    try {
      const { data } = await api.post('/sri/email/test')
      if (data.enviado) setMsg('Email de prueba enviado. Revisa tu bandeja de entrada.')
      else setMsg('Error: '+(data.error||'No se pudo enviar'))
    } catch (e) {
      setMsg('Error: '+(e.response?.data?.detail||e.message))
    } finally { setTesting(false) }
  }

  const INP = {padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,
    background:C.sur3,color:C.text,outline:'none',width:'100%',boxSizing:'border-box'}

  const PRESETS = [
    {name:'Gmail',        host:'smtp.gmail.com',         port:587, tls:true,
     hint:'Usa "Contraseña de aplicación" de myaccount.google.com > Seguridad'},
    {name:'Outlook/Hotmail', host:'smtp-mail.outlook.com', port:587, tls:true,
     hint:'Usa tu contraseña normal de Outlook'},
    {name:'Yahoo',        host:'smtp.mail.yahoo.com',    port:587, tls:true,
     hint:'Activa "Acceso de apps menos seguras" en Yahoo'},
    {name:'Personalizado',host:'',                       port:587, tls:true,
     hint:'Ingresa los datos de tu servidor SMTP'},
  ]

  return (
    <div style={{background:C.sur2,borderRadius:10,padding:16,border:`1px solid ${C.bord2}`}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <div style={{fontSize:11,fontWeight:700,color:C.cyan,textTransform:'uppercase',letterSpacing:'.05em'}}>
          📧 Correo electrónico (SMTP)
        </div>
        {cfg?.configurado && !editing && (
          <button onClick={()=>setEditing(true)}
            style={{padding:'5px 12px',borderRadius:6,border:`1px solid ${C.bord2}`,
              background:C.sur3,color:C.muted,cursor:'pointer',fontSize:11,fontWeight:600}}>
            Editar
          </button>
        )}
      </div>

      <div style={{fontSize:12,color:C.muted,marginBottom:14}}>
        El SRI obliga a enviar el RIDE (PDF) + XML al email del cliente.
        Al autorizar una factura, se envía automáticamente.
      </div>

      {cfg?.configurado && !editing ? (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <FileCheck size={16} color={C.green}/>
            <span style={{fontSize:13,fontWeight:700,color:C.green}}>Correo configurado</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,fontSize:12,
            padding:'12px 14px',borderRadius:8,background:C.sur3}}>
            <div><span style={{color:C.muted}}>Servidor:</span> <span style={{color:C.text,fontWeight:600}}>{cfg.host}:{cfg.port}</span></div>
            <div><span style={{color:C.muted}}>Usuario:</span> <span style={{color:C.text,fontWeight:600}}>{cfg.user}</span></div>
            <div><span style={{color:C.muted}}>Remitente:</span> <span style={{color:C.text,fontWeight:600}}>{cfg.from_name}</span></div>
            <div><span style={{color:C.muted}}>Email:</span> <span style={{color:C.text,fontWeight:600}}>{cfg.from_email}</span></div>
          </div>
          <button onClick={testEmail} disabled={testing}
            style={{padding:'9px 18px',borderRadius:8,border:'none',alignSelf:'flex-start',
              background:C.cyan,color:'white',cursor:'pointer',
              fontSize:12,fontWeight:700,opacity:testing?.6:1}}>
            {testing?'Enviando...':'📧 Enviar email de prueba'}
          </button>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          {/* Presets */}
          <div>
            <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:6}}>PROVEEDOR DE CORREO</div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {PRESETS.map(p=>(
                <button key={p.name} onClick={()=>{
                  if(p.host) sf('smtp_host',p.host)
                  sf('smtp_port',p.port)
                  sf('smtp_use_tls',p.tls)
                }}
                  style={{padding:'6px 14px',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',
                    border:`1px solid ${form.smtp_host===p.host&&p.host?C.cyan:C.bord2}`,
                    background:form.smtp_host===p.host&&p.host?'rgba(6,182,212,.15)':C.sur3,
                    color:form.smtp_host===p.host&&p.host?C.cyan:C.muted}}>
                  {p.name}
                </button>
              ))}
            </div>
            {PRESETS.find(p=>p.host===form.smtp_host)?.hint&&(
              <div style={{fontSize:11,color:C.amber,marginTop:6}}>
                💡 {PRESETS.find(p=>p.host===form.smtp_host)?.hint}
              </div>
            )}
          </div>

          <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:10}}>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:4}}>SERVIDOR SMTP *</label>
              <input value={form.smtp_host} onChange={e=>sf('smtp_host',e.target.value)}
                placeholder="smtp.gmail.com" style={INP}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:4}}>PUERTO</label>
              <input type="number" value={form.smtp_port} onChange={e=>sf('smtp_port',parseInt(e.target.value)||587)}
                style={INP}/>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:4}}>USUARIO / EMAIL *</label>
              <input value={form.smtp_user} onChange={e=>sf('smtp_user',e.target.value)}
                placeholder="tu-correo@gmail.com" style={INP}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:4}}>
                CONTRASEÑA {cfg?.configurado?'(dejar vacío para mantener)':'*'}
              </label>
              <div style={{position:'relative'}}>
                <input type={showPass?'text':'password'} value={form.smtp_password}
                  onChange={e=>sf('smtp_password',e.target.value)}
                  placeholder={cfg?.configurado?'••••••••':'Contraseña o App Password'}
                  style={{...INP,paddingRight:36}}/>
                <button onClick={()=>setShowPass(!showPass)}
                  style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',
                    background:'none',border:'none',cursor:'pointer',color:C.hint,fontSize:14}}>
                  {showPass?'🙈':'👁'}
                </button>
              </div>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:4}}>NOMBRE DEL REMITENTE</label>
              <input value={form.smtp_from_name} onChange={e=>sf('smtp_from_name',e.target.value)}
                placeholder="Nombre de tu empresa" style={INP}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:C.muted,display:'block',marginBottom:4}}>EMAIL DEL REMITENTE</label>
              <input value={form.smtp_from_email} onChange={e=>sf('smtp_from_email',e.target.value)}
                placeholder="Igual al usuario si se deja vacío" style={INP}/>
            </div>
          </div>

          <div style={{display:'flex',gap:10,alignItems:'center'}}>
            <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:12,color:C.text}}>
              <input type="checkbox" checked={form.smtp_use_tls}
                onChange={e=>sf('smtp_use_tls',e.target.checked)}/>
              Usar TLS (recomendado)
            </label>
          </div>

          <div style={{display:'flex',gap:8,marginTop:4}}>
            <button onClick={guardar} disabled={saving}
              style={{padding:'10px 24px',borderRadius:8,border:'none',
                background:C.green,color:'white',cursor:'pointer',
                fontSize:13,fontWeight:700,opacity:saving?.6:1}}>
              {saving?'Guardando...':'Guardar configuración'}
            </button>
            {cfg?.configurado&&(
              <button onClick={()=>setEditing(false)}
                style={{padding:'10px 18px',borderRadius:8,border:`1px solid ${C.bord2}`,
                  background:'transparent',color:C.muted,cursor:'pointer',fontSize:13}}>
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}