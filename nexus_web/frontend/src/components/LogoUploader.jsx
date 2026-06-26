// ============================================================
//  NEXUS POS — Componente subida de logo
//  Uso: <LogoUploader /> dentro de Configuracion.jsx
//  en la sección de datos de empresa
// ============================================================
import { useState, useEffect, useRef } from 'react'
import api from '../api'

export default function LogoUploader() {
  const [logo,    setLogo]    = useState(null)   // base64 actual
  const [preview, setPreview] = useState(null)   // preview local
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState('')
  const [msgType, setMsgType] = useState('ok')   // 'ok' | 'error'
  const fileRef = useRef()

  useEffect(() => {
    // Cargar logo actual de la empresa
    api.get('/config/empresa')
      .then(r => {
        if (r.data?.logo_base64) {
          setLogo(r.data.logo_base64)
          setPreview(r.data.logo_base64)
        }
      })
      .catch(() => {})
  }, [])

  function onFileChange(e) {
    const file = e.target.files[0]
    if (!file) return

    // Validar tipo
    if (!['image/png','image/jpeg','image/jpg','image/webp'].includes(file.type)) {
      setMsg('Solo se aceptan imágenes PNG, JPG o WebP')
      setMsgType('error')
      return
    }
    // Validar tamaño (máx 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setMsg('La imagen no puede superar 2MB')
      setMsgType('error')
      return
    }

    const reader = new FileReader()
    reader.onload = ev => {
      setPreview(ev.target.result)
      setMsg('')
    }
    reader.readAsDataURL(file)
  }

  async function guardar() {
    if (!preview) return
    setSaving(true); setMsg('')
    try {
      await api.post('/config/empresa/logo', { logo_base64: preview })
      setLogo(preview)
      setMsg('Logo guardado correctamente')
      setMsgType('ok')
    } catch(e) {
      setMsg(e.response?.data?.detail || 'Error al guardar el logo')
      setMsgType('error')
    } finally { setSaving(false) }
  }

  async function eliminar() {
    if (!window.confirm('¿Eliminar el logo de la empresa?')) return
    setSaving(true)
    try {
      await api.delete('/config/empresa/logo')
      setLogo(null); setPreview(null)
      setMsg('Logo eliminado')
      setMsgType('ok')
    } catch(e) {
      setMsg('Error al eliminar')
      setMsgType('error')
    } finally { setSaving(false) }
  }

  const cambio = preview !== logo

  return (
    <div style={{
      background: '#F8FAFC', borderRadius: 12, padding: 20,
      border: '1px solid #E2E8F0', marginBottom: 16
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginBottom: 4 }}>
        Logo de la empresa
      </div>
      <div style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>
        Aparecerá en las facturas y documentos del sistema. Formatos: PNG, JPG, WebP. Máx 2MB.
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* Preview */}
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            width: 140, height: 140, borderRadius: 10, cursor: 'pointer',
            border: `2px dashed ${preview ? '#2563EB' : '#CBD5E1'}`,
            background: preview ? 'white' : '#F1F5F9',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0,
            transition: 'border-color .2s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor='#2563EB'}
          onMouseLeave={e => e.currentTarget.style.borderColor=preview?'#2563EB':'#CBD5E1'}
        >
          {preview ? (
            <img src={preview} alt="Logo"
              style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }}/>
          ) : (
            <div style={{ textAlign: 'center', color: '#94A3B8' }}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>🖼️</div>
              <div style={{ fontSize: 11 }}>Clic para subir</div>
            </div>
          )}
        </div>

        {/* Controles */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={onFileChange}
            style={{ display: 'none' }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                padding: '9px 16px', borderRadius: 8, cursor: 'pointer',
                border: '1px solid #CBD5E1', background: 'white',
                fontSize: 13, fontWeight: 600, color: '#374151',
                display: 'flex', alignItems: 'center', gap: 7
              }}
            >
              📁 Seleccionar imagen
            </button>

            {cambio && (
              <button
                onClick={guardar}
                disabled={saving}
                style={{
                  padding: '9px 16px', borderRadius: 8, cursor: 'pointer',
                  border: 'none', background: '#2563EB',
                  fontSize: 13, fontWeight: 700, color: 'white',
                  display: 'flex', alignItems: 'center', gap: 7
                }}
              >
                {saving ? '⏳ Guardando...' : '✓ Guardar logo'}
              </button>
            )}

            {logo && !cambio && (
              <button
                onClick={eliminar}
                disabled={saving}
                style={{
                  padding: '9px 16px', borderRadius: 8, cursor: 'pointer',
                  border: '1px solid #FCA5A5', background: '#FEF2F2',
                  fontSize: 13, fontWeight: 600, color: '#DC2626',
                  display: 'flex', alignItems: 'center', gap: 7
                }}
              >
                🗑 Eliminar logo
              </button>
            )}

            {cambio && preview && (
              <button
                onClick={() => { setPreview(logo); setMsg('') }}
                style={{
                  padding: '9px 16px', borderRadius: 8, cursor: 'pointer',
                  border: '1px solid #E2E8F0', background: 'white',
                  fontSize: 13, color: '#64748B'
                }}
              >
                Cancelar cambio
              </button>
            )}

            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4, lineHeight: 1.5 }}>
              Recomendado: fondo blanco o transparente,<br/>
              mínimo 200×200px para buena calidad de impresión.
            </div>
          </div>
        </div>
      </div>

      {msg && (
        <div style={{
          marginTop: 14, padding: '8px 14px', borderRadius: 8, fontSize: 13,
          background: msgType === 'ok' ? '#ECFDF5' : '#FEF2F2',
          color:      msgType === 'ok' ? '#065F46' : '#991B1B',
          border: `1px solid ${msgType === 'ok' ? '#A7F3D0' : '#FECACA'}`,
        }}>
          {msgType === 'ok' ? '✅' : '⚠️'} {msg}
        </div>
      )}
    </div>
  )
}
