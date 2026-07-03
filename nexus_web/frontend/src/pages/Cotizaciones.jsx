// ============================================================
//  NEXUS POS — Cotizaciones / Proformas
// ============================================================
import { useState, useEffect, useRef } from 'react'
import api from '../api'
import {
  FileText, Plus, Search, Download, Mail, Trash2,
  Edit3, CheckCircle, XCircle, Send, ShoppingCart,
  ChevronDown, X, Package
} from 'lucide-react'
import { useTheme } from '../theme'

const C = {
  bg:'#0A0F1E', surface:'#111827', sur2:'#1F2937', sur3:'#374151',
  border:'#1F2937', bord2:'#374151',
  text:'#F9FAFB', muted:'#9CA3AF', hint:'#6B7280',
  blue:'#3B82F6', green:'#10B981', amber:'#F59E0B',
  red:'#EF4444', purple:'#8B5CF6', cyan:'#06B6D4',
  greenD:'rgba(16,185,129,.15)', amberD:'rgba(245,158,11,.15)',
  redD:'rgba(239,68,68,.15)', blueD:'rgba(59,130,246,.15)',
  purpleD:'rgba(139,92,246,.15)',
}
const fmt$ = v => '$'+Number(v||0).toLocaleString('es-EC',{minimumFractionDigits:2,maximumFractionDigits:2})
const FI = {
  padding:'8px 11px', borderRadius:8, fontSize:13,
  border:`1px solid ${C.bord2}`, background:C.sur2,
  color:C.text, outline:'none', boxSizing:'border-box', width:'100%'
}

const ESTADO_COLORS = {
  BORRADOR:  { bg:'rgba(156,163,175,.15)', color:'#9CA3AF', label:'Borrador' },
  ENVIADA:   { bg:'rgba(59,130,246,.15)',   color:'#3B82F6', label:'Enviada' },
  APROBADA:  { bg:'rgba(16,185,129,.15)',   color:'#10B981', label:'Aprobada' },
  RECHAZADA: { bg:'rgba(239,68,68,.15)',    color:'#EF4444', label:'Rechazada' },
  FACTURADA: { bg:'rgba(139,92,246,.15)',   color:'#8B5CF6', label:'Facturada' },
}

function Badge({estado}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const s = ESTADO_COLORS[estado] || ESTADO_COLORS.BORRADOR
  return (
    <span style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,
      background:s.bg,color:s.color,border:`1px solid ${s.color}30`}}>
      {s.label}
    </span>
  )
}


// ── Selector Cliente (autocomplete) ──────────────────────────
function SelectorCliente({value, onChange}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [txt, setTxt] = useState('')
  const [res, setRes] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    const h = e => { if(ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  async function buscar(v) {
    setTxt(v)
    if(v.length < 2) { setRes([]); setOpen(false); return }
    try {
      const {data} = await api.get('/clientes', {params:{busqueda:v,activo:'true'}})
      setRes(data.slice(0,8)); setOpen(true)
    } catch {}
  }

  function pick(c) {
    onChange(c)
    setTxt(c.razon_social)
    setOpen(false); setRes([])
  }

  if(value) return (
    <div style={{display:'flex',alignItems:'center',gap:8,padding:'7px 11px',
      borderRadius:8,background:C.sur2,border:`1px solid ${C.bord2}`}}>
      <span style={{flex:1,fontSize:13,color:C.text}}>
        {value.razon_social} <span style={{color:C.hint,fontSize:11}}>({value.identificacion})</span>
      </span>
      <button onClick={()=>{onChange(null);setTxt('')}} style={{background:'none',border:'none',
        cursor:'pointer',color:C.hint,fontSize:16,lineHeight:1}}>
        <X size={14}/>
      </button>
    </div>
  )

  return (
    <div ref={ref} style={{position:'relative'}}>
      <input value={txt} onChange={e=>buscar(e.target.value)}
        placeholder="Buscar cliente por nombre o RUC..."
        style={{...FI,paddingLeft:32}}/>
      <Search size={14} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:C.hint}}/>
      {open && res.length > 0 && (
        <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:100,
          background:C.surface,border:`1px solid ${C.bord2}`,borderRadius:8,
          maxHeight:250,overflowY:'auto',boxShadow:'0 12px 32px rgba(0,0,0,.6)'}}>
          {res.map(c => (
            <div key={c.id} onClick={()=>pick(c)}
              style={{padding:'8px 12px',cursor:'pointer',fontSize:12,color:C.text,
                borderBottom:`1px solid ${C.border}`}}
              onMouseEnter={e=>e.currentTarget.style.background=C.sur2}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <span style={{fontWeight:600}}>{c.razon_social}</span>
              <span style={{color:C.hint,marginLeft:8}}>{c.identificacion}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


// ── Buscador Productos (autocomplete) ────────────────────────
function BuscadorProducto({onAdd}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [txt, setTxt] = useState('')
  const [res, setRes] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    const h = e => { if(ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  async function buscar(v) {
    setTxt(v)
    if(v.length < 2) { setRes([]); setOpen(false); return }
    try {
      const {data} = await api.get('/productos', {params:{busqueda:v}})
      setRes((Array.isArray(data) ? data : data.items || []).slice(0,10))
      setOpen(true)
    } catch {}
  }

  function pick(p) {
    onAdd({
      producto_id: p.id,
      codigo: p.codigo,
      descripcion: p.descripcion,
      cantidad: 1,
      precio_unitario: parseFloat(p.precio_con_iva || p.precio_venta || 0),
      descuento_pct: 0,
      iva_porcentaje: parseFloat(p.iva_porcentaje || 15),
    })
    setTxt(''); setRes([]); setOpen(false)
  }

  return (
    <div ref={ref} style={{position:'relative'}}>
      <input value={txt} onChange={e=>buscar(e.target.value)}
        placeholder="Buscar producto por nombre o codigo..."
        style={{...FI,paddingLeft:32}}/>
      <Package size={14} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:C.hint}}/>
      {open && res.length > 0 && (
        <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:100,
          background:C.surface,border:`1px solid ${C.bord2}`,borderRadius:8,
          maxHeight:280,overflowY:'auto',boxShadow:'0 12px 32px rgba(0,0,0,.6)'}}>
          {res.map(p => (
            <div key={p.id} onClick={()=>pick(p)}
              style={{padding:'8px 12px',cursor:'pointer',fontSize:12,color:C.text,
                borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}
              onMouseEnter={e=>e.currentTarget.style.background=C.sur2}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <div>
                <span style={{color:C.hint,marginRight:6}}>{p.codigo}</span>
                <span style={{fontWeight:600}}>{p.descripcion}</span>
              </div>
              <span style={{color:C.green,fontWeight:700,fontSize:12}}>
                {fmt$(p.precio_con_iva || p.precio_venta)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


// ── Modal Crear/Editar Cotizacion ────────────────────────────
function ModalCotizacion({cotizacion, onClose, onSaved}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const isEdit = !!cotizacion
  const [cliente, setCliente] = useState(
    cotizacion ? {id:cotizacion.cliente_id, razon_social:cotizacion.cliente_nombre,
      identificacion:cotizacion.cliente_ruc} : null
  )
  const [vendedorId, setVendedorId] = useState(cotizacion?.vendedor_id || '')
  const [vendedores, setVendedores] = useState([])
  const [observaciones, setObservaciones] = useState(cotizacion?.observaciones || '')
  const [fechaValidez, setFechaValidez] = useState(
    cotizacion?.fecha_validez ? String(cotizacion.fecha_validez).slice(0,10) : ''
  )
  const [descGlobal, setDescGlobal] = useState(cotizacion?.descuento_global_pct || 0)
  const [items, setItems] = useState([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.get('/vendedores').then(r => setVendedores(r.data || [])).catch(()=>{})
    if(isEdit && cotizacion?.id) {
      api.get(`/cotizaciones/${cotizacion.id}`).then(r => {
        const dets = r.data.detalles || []
        setItems(dets.map(d => ({
          producto_id: d.producto_id,
          codigo: d.codigo || '',
          descripcion: d.descripcion || d.prod_descripcion || '',
          cantidad: parseFloat(d.cantidad),
          precio_unitario: parseFloat(d.precio_unitario),
          descuento_pct: parseFloat(d.descuento_pct || 0),
          iva_porcentaje: parseFloat(d.iva_porcentaje || 15),
        })))
      }).catch(()=>{})
    }
  }, [])

  function addItem(item) {
    // Check if product already exists
    const idx = items.findIndex(i => i.producto_id === item.producto_id)
    if(idx >= 0) {
      const copy = [...items]
      copy[idx].cantidad += 1
      setItems(copy)
    } else {
      setItems([...items, item])
    }
  }

  function updateItem(idx, key, val) {
    const copy = [...items]
    copy[idx][key] = val
    setItems(copy)
  }

  function removeItem(idx) {
    setItems(items.filter((_,i) => i !== idx))
  }

  // Calculate totals
  const dg = parseFloat(descGlobal) || 0
  let subtotal0 = 0, subtotalIva = 0, ivaTotal = 0
  items.forEach(it => {
    const cant = parseFloat(it.cantidad) || 0
    const pu = parseFloat(it.precio_unitario) || 0
    const dp = parseFloat(it.descuento_pct) || 0
    const iv = parseFloat(it.iva_porcentaje) || 15
    const lineaPvp = cant * pu * (1 - dp/100) * (1 - dg/100)
    if(iv === 0) {
      subtotal0 += lineaPvp
    } else {
      const base = lineaPvp / (1 + iv/100)
      subtotalIva += base
      ivaTotal += lineaPvp - base
    }
  })
  const total = subtotal0 + subtotalIva + ivaTotal

  async function guardar() {
    if(!cliente) return setErr('Seleccione un cliente')
    if(items.length === 0) return setErr('Agregue al menos un producto')
    setSaving(true); setErr('')
    const payload = {
      cliente_id: cliente.id,
      vendedor_id: vendedorId ? parseInt(vendedorId) : null,
      sucursal_id: null,
      observaciones,
      descuento_global_pct: dg,
      fecha_validez: fechaValidez || null,
      detalles: items.map(it => ({
        producto_id: it.producto_id,
        cantidad: parseFloat(it.cantidad) || 0,
        precio_unitario: parseFloat(it.precio_unitario) || 0,
        descuento_pct: parseFloat(it.descuento_pct) || 0,
        iva_porcentaje: parseFloat(it.iva_porcentaje) || 15,
        descripcion: it.descripcion || '',
      })),
    }
    try {
      if(isEdit) {
        await api.put(`/cotizaciones/${cotizacion.id}`, payload)
      } else {
        await api.post('/cotizaciones', payload)
      }
      onSaved()
    } catch(e) {
      setErr(e.response?.data?.detail || e.message)
    } finally { setSaving(false) }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:9000,padding:20}}>
      <div style={{background:C.surface,borderRadius:16,padding:0,width:900,
        maxHeight:'95vh',display:'flex',flexDirection:'column',
        border:`1px solid ${C.bord2}`,boxShadow:'0 25px 60px rgba(0,0,0,.7)'}}>

        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
          padding:'18px 24px',borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <FileText size={20} style={{color:C.blue}}/>
            <span style={{fontSize:16,fontWeight:700,color:C.text}}>
              {isEdit ? 'Editar cotizacion' : 'Nueva cotizacion'}
            </span>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',
            cursor:'pointer',color:C.hint,fontSize:22,lineHeight:1}}>
            <X size={20}/>
          </button>
        </div>

        {/* Body scrollable */}
        <div style={{flex:1,overflowY:'auto',padding:'20px 24px'}}>
          {/* Cliente + Vendedor */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:16}}>
            <div>
              <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4,fontWeight:600,
                textTransform:'uppercase'}}>CLIENTE *</label>
              <SelectorCliente value={cliente} onChange={setCliente}/>
            </div>
            <div>
              <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4,fontWeight:600,
                textTransform:'uppercase'}}>VENDEDOR</label>
              <select value={vendedorId} onChange={e=>setVendedorId(e.target.value)} style={FI}>
                <option value="">-- Sin vendedor --</option>
                {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
              </select>
            </div>
          </div>

          {/* Fecha validez + Descuento global */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:16}}>
            <div>
              <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4,fontWeight:600,
                textTransform:'uppercase'}}>FECHA VALIDEZ</label>
              <input type="date" value={fechaValidez} onChange={e=>setFechaValidez(e.target.value)} style={FI}/>
            </div>
            <div>
              <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4,fontWeight:600,
                textTransform:'uppercase'}}>DESCUENTO GLOBAL %</label>
              <input type="number" min="0" max="100" step="0.5" value={descGlobal}
                onChange={e=>setDescGlobal(e.target.value)} style={FI}/>
            </div>
          </div>

          {/* Product search */}
          <div style={{marginBottom:14}}>
            <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4,fontWeight:600,
              textTransform:'uppercase'}}>AGREGAR PRODUCTO</label>
            <BuscadorProducto onAdd={addItem}/>
          </div>

          {/* Products table */}
          {items.length > 0 && (
            <div style={{border:`1px solid ${C.bord2}`,borderRadius:10,overflow:'hidden',marginBottom:16}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead>
                  <tr style={{background:C.sur2}}>
                    {['Codigo','Descripcion','Cant.','P.Unit.','Dto%','IVA%','Total',''].map(h =>
                      <th key={h} style={{padding:'8px 10px',textAlign:'left',color:C.muted,
                        fontWeight:600,fontSize:11,textTransform:'uppercase',
                        borderBottom:`1px solid ${C.bord2}`}}>{h}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {items.map((it,idx) => {
                    const cant = parseFloat(it.cantidad)||0
                    const pu = parseFloat(it.precio_unitario)||0
                    const dp = parseFloat(it.descuento_pct)||0
                    const lineaTotal = cant * pu * (1-dp/100) * (1-dg/100)
                    return (
                      <tr key={idx} style={{borderBottom:`1px solid ${C.border}`}}>
                        <td style={{padding:'6px 10px',color:C.hint}}>{it.codigo}</td>
                        <td style={{padding:'6px 10px',color:C.text,maxWidth:200,overflow:'hidden',
                          textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{it.descripcion}</td>
                        <td style={{padding:'6px 6px',width:70}}>
                          <input type="number" min="0.01" step="1" value={it.cantidad}
                            onChange={e=>updateItem(idx,'cantidad',e.target.value)}
                            style={{...FI,width:60,padding:'4px 6px',textAlign:'center',fontSize:12}}/>
                        </td>
                        <td style={{padding:'6px 6px',width:90}}>
                          <input type="number" min="0" step="0.01" value={it.precio_unitario}
                            onChange={e=>updateItem(idx,'precio_unitario',e.target.value)}
                            style={{...FI,width:80,padding:'4px 6px',textAlign:'right',fontSize:12}}/>
                        </td>
                        <td style={{padding:'6px 6px',width:60}}>
                          <input type="number" min="0" max="100" step="0.5" value={it.descuento_pct}
                            onChange={e=>updateItem(idx,'descuento_pct',e.target.value)}
                            style={{...FI,width:50,padding:'4px 6px',textAlign:'center',fontSize:12}}/>
                        </td>
                        <td style={{padding:'6px 10px',color:C.muted,fontSize:11}}>{it.iva_porcentaje}%</td>
                        <td style={{padding:'6px 10px',color:C.green,fontWeight:700,textAlign:'right'}}>
                          {fmt$(lineaTotal)}
                        </td>
                        <td style={{padding:'6px 6px',width:30}}>
                          <button onClick={()=>removeItem(idx)} style={{background:'none',border:'none',
                            cursor:'pointer',color:C.red,padding:2}}>
                            <Trash2 size={14}/>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Totales */}
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
            <div style={{background:C.sur2,borderRadius:10,padding:16,minWidth:260,
              border:`1px solid ${C.bord2}`}}>
              {[
                {l:'Subtotal 0%', v:subtotal0},
                {l:'Subtotal IVA', v:subtotalIva},
                {l:'IVA', v:ivaTotal},
              ].map(r => (
                <div key={r.l} style={{display:'flex',justifyContent:'space-between',
                  padding:'4px 0',fontSize:13,color:C.muted}}>
                  <span>{r.l}</span>
                  <span style={{color:C.text}}>{fmt$(r.v)}</span>
                </div>
              ))}
              <div style={{display:'flex',justifyContent:'space-between',
                padding:'8px 0 0',fontSize:16,fontWeight:800,color:C.text,
                borderTop:`1px solid ${C.bord2}`,marginTop:6}}>
                <span>TOTAL</span>
                <span style={{color:C.green}}>{fmt$(total)}</span>
              </div>
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4,fontWeight:600,
              textTransform:'uppercase'}}>OBSERVACIONES</label>
            <textarea value={observaciones} onChange={e=>setObservaciones(e.target.value)}
              rows={3} placeholder="Notas, condiciones de pago, tiempo de entrega..."
              style={{...FI,resize:'vertical'}}/>
          </div>

          {err && (
            <div style={{marginTop:14,padding:'8px 12px',borderRadius:8,fontSize:12,
              background:C.redD,color:'#FCA5A5',border:'1px solid rgba(239,68,68,.3)'}}>
              {err}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{display:'flex',gap:10,padding:'16px 24px',
          borderTop:`1px solid ${C.border}`,justifyContent:'flex-end'}}>
          <button onClick={onClose} style={{padding:'9px 20px',borderRadius:8,
            border:`1px solid ${C.bord2}`,background:'transparent',color:C.muted,
            cursor:'pointer',fontSize:13}}>
            Cancelar
          </button>
          <button onClick={guardar} disabled={saving}
            style={{padding:'9px 24px',borderRadius:8,border:'none',
              background:C.blue,color:'white',cursor:'pointer',fontSize:13,fontWeight:700,
              opacity:saving?0.6:1}}>
            {saving ? 'Guardando...' : (isEdit ? 'Actualizar' : 'Guardar cotizacion')}
          </button>
        </div>
      </div>
    </div>
  )
}


// ── Dropdown Acciones ────────────────────────────────────────
function AccionesDropdown({cot, onEstado, onFacturar, onPDF, onEmail, onEditar, onEliminar}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [open, setOpen] = useState(false)
  const [pos, setPos]   = useState({top:0, right:0})
  const ref = useRef()
  const btnRef = useRef()

  useEffect(() => {
    const h = e => { if(ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const toggleOpen = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setOpen(o => !o)
  }

  const estado = cot.estado

  return (
    <div ref={ref} style={{display:'inline-block'}}>
      <button ref={btnRef} onClick={toggleOpen}
        style={{padding:'5px 10px',borderRadius:6,border:`1px solid ${C.bord2}`,
          background:C.sur2,color:C.muted,cursor:'pointer',fontSize:11,fontWeight:600,
          display:'flex',alignItems:'center',gap:4}}>
        Acciones <ChevronDown size={12}/>
      </button>
      {open && (
        <div style={{position:'fixed',top:pos.top,right:pos.right,zIndex:9999,
          background:C.surface,border:`1px solid ${C.bord2}`,borderRadius:8,minWidth:170,
          boxShadow:'0 12px 32px rgba(0,0,0,.8)',overflow:'hidden'}}>

          {(estado === 'BORRADOR' || estado === 'ENVIADA') && (
            <Item icon={<Edit3 size={13}/>} label="Editar" onClick={()=>{setOpen(false);onEditar()}}/>
          )}

          {estado === 'BORRADOR' && (
            <Item icon={<Send size={13}/>} label="Marcar Enviada" color={C.blue}
              onClick={()=>{setOpen(false);onEstado('ENVIADA')}}/>
          )}

          {(estado === 'ENVIADA' || estado === 'BORRADOR') && (
            <Item icon={<CheckCircle size={13}/>} label="Aprobar" color={C.green}
              onClick={()=>{setOpen(false);onEstado('APROBADA')}}/>
          )}

          {(estado === 'ENVIADA' || estado === 'BORRADOR') && (
            <Item icon={<XCircle size={13}/>} label="Rechazar" color={C.red}
              onClick={()=>{setOpen(false);onEstado('RECHAZADA')}}/>
          )}

          {estado === 'RECHAZADA' && (
            <Item icon={<Send size={13}/>} label="Reenviar" color={C.blue}
              onClick={()=>{setOpen(false);onEstado('ENVIADA')}}/>
          )}

          {estado === 'APROBADA' && (
            <Item icon={<ShoppingCart size={13}/>} label="Facturar" color={C.purple}
              onClick={()=>{setOpen(false);onFacturar()}}/>
          )}

          <div style={{borderTop:`1px solid ${C.border}`}}/>

          <Item icon={<Download size={13}/>} label="Descargar PDF"
            onClick={()=>{setOpen(false);onPDF()}}/>

          <Item icon={<Mail size={13}/>} label="Enviar por email"
            onClick={()=>{setOpen(false);onEmail()}}/>

          {estado === 'BORRADOR' && (
            <>
              <div style={{borderTop:`1px solid ${C.border}`}}/>
              <Item icon={<Trash2 size={13}/>} label="Eliminar" color={C.red}
                onClick={()=>{setOpen(false);onEliminar()}}/>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Item({icon, label, color, onClick}) {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  return (
    <button onClick={onClick}
      style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'8px 14px',
        background:'transparent',border:'none',cursor:'pointer',
        color:color||C.text,fontSize:12,textAlign:'left'}}
      onMouseEnter={e=>e.currentTarget.style.background=C.sur2}
      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
      {icon} {label}
    </button>
  )
}


// ══════════════════════════════════════════════════════════════
//  PAGINA PRINCIPAL
// ══════════════════════════════════════════════════════════════
export default function Cotizaciones() {
  const C = useTheme()
  const FI={padding:'9px 12px',borderRadius:8,fontSize:13,border:`1px solid ${C.bord2}`,background:C.sur2,color:C.text,outline:'none',boxSizing:'border-box',width:'100%'}
  const [cots, setCots] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [modal, setModal] = useState(null)
  const [msg, setMsg] = useState('')
  const [emailModal, setEmailModal] = useState(null) // cotizacion para enviar email

  async function cargar() {
    setLoading(true)
    try {
      const params = {}
      if(busqueda) params.busqueda = busqueda
      if(filtroEstado) params.estado = filtroEstado
      const {data} = await api.get('/cotizaciones', {params})
      setCots(data)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [filtroEstado])

  function buscar(e) {
    e.preventDefault()
    cargar()
  }

  // Stats
  const stats = {
    total: cots.length,
    borrador: cots.filter(c=>c.estado==='BORRADOR').length,
    enviadas: cots.filter(c=>c.estado==='ENVIADA').length,
    aprobadas: cots.filter(c=>c.estado==='APROBADA').length,
  }

  async function cambiarEstado(cid, estado) {
    try {
      await api.patch(`/cotizaciones/${cid}/estado`, {estado})
      flash(`Estado cambiado a ${estado}`)
      cargar()
    } catch(e) { flash(e.response?.data?.detail || 'Error', true) }
  }

  async function facturar(cid) {
    if(!window.confirm('Convertir esta cotizacion aprobada en factura?')) return
    try {
      const {data} = await api.post(`/cotizaciones/${cid}/convertir-factura`)
      flash(`Factura ${data.numero_factura} generada - Total: ${fmt$(data.total)}`)
      cargar()
    } catch(e) { flash(e.response?.data?.detail || 'Error al facturar', true) }
  }

  async function descargarPDF(cid, numero) {
    try {
      const resp = await api.get(`/cotizaciones/${cid}/pdf`, {responseType:'blob'})
      const url = window.URL.createObjectURL(new Blob([resp.data], {type:'application/pdf'}))
      const a = document.createElement('a')
      a.href = url; a.download = `Cotizacion_${numero}.pdf`; a.click()
      window.URL.revokeObjectURL(url)
    } catch(e) { flash('Error descargando PDF', true) }
  }

  async function enviarEmail(cot) {
    setEmailModal(cot)
  }

  async function eliminar(cid) {
    if(!window.confirm('Eliminar esta cotizacion?')) return
    try {
      await api.delete(`/cotizaciones/${cid}`)
      flash('Cotizacion eliminada')
      cargar()
    } catch(e) { flash(e.response?.data?.detail || 'Error', true) }
  }

  function flash(text, isError) {
    setMsg(text)
    setTimeout(() => setMsg(''), 4000)
  }

  return (
    <div style={{padding:24,minHeight:'100vh',background:C.bg,color:C.text}}>

      {/* Flash message */}
      {msg && (
        <div style={{position:'fixed',top:20,right:20,zIndex:9999,padding:'12px 20px',
          borderRadius:10,background:C.surface,border:`1px solid ${C.bord2}`,
          boxShadow:'0 8px 24px rgba(0,0,0,.5)',fontSize:13,color:C.text,maxWidth:400}}>
          {msg}
        </div>
      )}

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,margin:0,
            background:'linear-gradient(135deg,#3B82F6,#8B5CF6)',WebkitBackgroundClip:'text',
            WebkitTextFillColor:'transparent'}}>
            Cotizaciones / Proformas
          </h1>
          <p style={{fontSize:13,color:C.muted,margin:'4px 0 0'}}>
            Gestione sus cotizaciones y convierta en facturas
          </p>
        </div>
        <button onClick={()=>setModal('new')}
          style={{display:'flex',alignItems:'center',gap:8,padding:'10px 20px',
            borderRadius:10,border:'none',background:'linear-gradient(135deg,#3B82F6,#2563EB)',
            color:'white',cursor:'pointer',fontSize:13,fontWeight:700,
            boxShadow:'0 4px 12px rgba(59,130,246,.3)'}}>
          <Plus size={16}/> Nueva cotizacion
        </button>
      </div>

      {/* Stats cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
        {[
          {label:'Total', value:stats.total, color:C.blue, bg:C.blueD},
          {label:'Borrador', value:stats.borrador, color:C.muted, bg:'rgba(156,163,175,.1)'},
          {label:'Enviadas', value:stats.enviadas, color:C.blue, bg:C.blueD},
          {label:'Aprobadas', value:stats.aprobadas, color:C.green, bg:C.greenD},
        ].map(s => (
          <div key={s.label} style={{background:C.surface,borderRadius:12,padding:'16px 18px',
            border:`1px solid ${C.border}`}}>
            <div style={{fontSize:11,color:C.muted,fontWeight:600,textTransform:'uppercase',
              marginBottom:6}}>{s.label}</div>
            <div style={{fontSize:24,fontWeight:800,color:s.color}}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:12,marginBottom:16,alignItems:'center',flexWrap:'wrap'}}>
        <form onSubmit={buscar} style={{display:'flex',gap:8,flex:1,minWidth:250}}>
          <div style={{position:'relative',flex:1}}>
            <Search size={14} style={{position:'absolute',left:10,top:'50%',
              transform:'translateY(-50%)',color:C.hint}}/>
            <input value={busqueda} onChange={e=>setBusqueda(e.target.value)}
              placeholder="Buscar por numero, cliente o RUC..."
              style={{...FI,paddingLeft:32}}/>
          </div>
          <button type="submit" style={{padding:'8px 16px',borderRadius:8,border:'none',
            background:C.blue,color:'white',cursor:'pointer',fontSize:12,fontWeight:600}}>
            Buscar
          </button>
        </form>
        <select value={filtroEstado} onChange={e=>setFiltroEstado(e.target.value)}
          style={{...FI,width:160}}>
          <option value="">Todos los estados</option>
          <option value="BORRADOR">Borrador</option>
          <option value="ENVIADA">Enviada</option>
          <option value="APROBADA">Aprobada</option>
          <option value="RECHAZADA">Rechazada</option>
          <option value="FACTURADA">Facturada</option>
        </select>
      </div>

      {/* Table */}
      <div style={{background:C.surface,borderRadius:12,border:`1px solid ${C.border}`}}>
        {loading ? (
          <div style={{padding:40,textAlign:'center',color:C.muted}}>Cargando...</div>
        ) : cots.length === 0 ? (
          <div style={{padding:40,textAlign:'center',color:C.hint}}>
            No se encontraron cotizaciones
          </div>
        ) : (
          <div style={{overflowX:'auto',borderRadius:12}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead>
                <tr style={{background:C.sur2}}>
                  {['Numero','Fecha','Cliente','Vendedor','Total','Estado','Validez','Acciones'].map(h =>
                    <th key={h} style={{padding:'10px 14px',textAlign:'left',color:C.muted,
                      fontWeight:600,fontSize:11,textTransform:'uppercase',
                      borderBottom:`1px solid ${C.bord2}`,whiteSpace:'nowrap'}}>{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {cots.map(co => (
                  <tr key={co.id} style={{borderBottom:`1px solid ${C.border}`}}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.02)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{padding:'10px 14px',fontWeight:600,color:C.blue,whiteSpace:'nowrap'}}>
                      {co.numero}
                    </td>
                    <td style={{padding:'10px 14px',color:C.muted,whiteSpace:'nowrap'}}>
                      {co.fecha ? String(co.fecha).slice(0,10) : ''}
                    </td>
                    <td style={{padding:'10px 14px',color:C.text,maxWidth:200,overflow:'hidden',
                      textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {co.cliente_nombre}
                      {co.cliente_ruc && (
                        <span style={{color:C.hint,fontSize:11,marginLeft:6}}>{co.cliente_ruc}</span>
                      )}
                    </td>
                    <td style={{padding:'10px 14px',color:C.muted}}>
                      {co.vendedor_nombre || '--'}
                    </td>
                    <td style={{padding:'10px 14px',fontWeight:700,color:C.green,whiteSpace:'nowrap'}}>
                      {fmt$(co.total)}
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      <Badge estado={co.estado}/>
                    </td>
                    <td style={{padding:'10px 14px',color:C.muted,fontSize:12,whiteSpace:'nowrap'}}>
                      {co.fecha_validez ? String(co.fecha_validez).slice(0,10) : '--'}
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      <AccionesDropdown
                        cot={co}
                        onEstado={(est) => cambiarEstado(co.id, est)}
                        onFacturar={() => facturar(co.id)}
                        onPDF={() => descargarPDF(co.id, co.numero)}
                        onEmail={() => enviarEmail(co)}
                        onEditar={() => setModal(co)}
                        onEliminar={() => eliminar(co.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal cotización */}
      {modal && (
        <ModalCotizacion
          cotizacion={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); cargar() }}
        />
      )}

      {/* Modal enviar email */}
      {emailModal && (
        <ModalEnviarEmail
          cot={emailModal}
          onClose={() => setEmailModal(null)}
          onSent={(msg) => { setEmailModal(null); flash(msg); cargar() }}
        />
      )}
    </div>
  )
}

// ── Modal Enviar Email ────────────────────────────────────────
function ModalEnviarEmail({ cot, onClose, onSent }) {
  const C = useTheme()
  const [email, setEmail]     = useState(cot.cliente_email || '')
  const [mensaje, setMensaje] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr]         = useState('')

  const enviar = async () => {
    if (!email) return setErr('Ingresa el email del destinatario')
    setSending(true); setErr('')
    try {
      const r = await api.post(`/cotizaciones/${cot.id}/enviar-email`, { email, mensaje })
      onSent(r.data.msg || '✅ Email enviado')
    } catch(e) { setErr(e.response?.data?.detail || 'Error al enviar') }
    setSending(false)
  }

  const fi = { background:C.sur2, border:`1px solid ${C.bord2}`, borderRadius:8,
    padding:'9px 12px', color:C.text, fontSize:13, width:'100%', outline:'none', boxSizing:'border-box' }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}>
      <div style={{background:C.surface,borderRadius:14,border:`1px solid ${C.bord2}`,
        padding:28,width:460,boxShadow:'0 25px 60px rgba(0,0,0,.5)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div>
            <div style={{fontWeight:800,fontSize:16,color:C.text}}>✉️ Enviar cotización por email</div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>
              {cot.numero} · ${parseFloat(cot.total||0).toLocaleString('es-EC',{minimumFractionDigits:2})}
            </div>
          </div>
          <button onClick={onClose}
            style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:22}}>×</button>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:C.muted,display:'block',marginBottom:4}}>
              Email destinatario *
            </label>
            <input value={email} onChange={e=>setEmail(e.target.value)}
              style={fi} placeholder="cliente@empresa.com" type="email"/>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:C.muted,display:'block',marginBottom:4}}>
              Mensaje personalizado (opcional)
            </label>
            <textarea value={mensaje} onChange={e=>setMensaje(e.target.value)}
              style={{...fi,minHeight:80,resize:'vertical',fontFamily:'inherit'}}
              placeholder="Estimado cliente, adjunto encontrará la cotización solicitada..."/>
          </div>
          <div style={{padding:'10px 14px',borderRadius:8,background:'rgba(59,130,246,.06)',
            border:'1px solid rgba(59,130,246,.15)',fontSize:11,color:C.muted}}>
            📎 Se adjunta automáticamente el PDF con el detalle completo de la cotización.
            Al enviarlo, el estado cambia a <strong style={{color:C.blue}}>ENVIADA</strong>.
          </div>
        </div>

        {err && <div style={{marginTop:12,padding:'9px 14px',borderRadius:8,fontSize:13,
          background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.3)',
          color:'#FCA5A5'}}>{err}</div>}

        <div style={{display:'flex',gap:10,marginTop:20,justifyContent:'flex-end'}}>
          <button onClick={onClose}
            style={{padding:'9px 20px',borderRadius:9,border:`1px solid ${C.bord2}`,
              background:'transparent',color:C.muted,cursor:'pointer',fontSize:13}}>
            Cancelar
          </button>
          <button onClick={enviar} disabled={sending||!email}
            style={{padding:'9px 24px',borderRadius:9,border:'none',
              background:C.blue,color:'white',cursor:'pointer',fontSize:13,fontWeight:700,
              opacity:!email?.5:1}}>
            {sending ? 'Enviando...' : '✉️ Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}
