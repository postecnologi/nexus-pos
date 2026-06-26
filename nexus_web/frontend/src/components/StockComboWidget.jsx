import { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react'
import api from '../api'

export default function StockComboWidget({ pid, bodegas }) {
  const [bodega, setBodega]   = useState(bodegas[0]?.id || 1)
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (pid) cargar() }, [pid, bodega])

  async function cargar() {
    setLoading(true)
    try {
      const { data: d } = await api.get(`/productos/${pid}/stock-combo`, {
        params: { bodega_id: bodega }
      })
      setData(d)
    } catch { setData(null) }
    finally { setLoading(false) }
  }

  if (!data || !data.es_combo) return null

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>
          📦 Stock disponible del combo
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={bodega} onChange={e => setBodega(e.target.value)}
            style={{ fontSize: 12, padding: '4px 8px', width: 160 }}>
            {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
          <button onClick={cargar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Stock total disponible */}
      <div style={{
        background: data.stock_disponible > 0 ? '#F0FDF4' : '#FEF2F2',
        borderRadius: 10, padding: '12px 16px', marginBottom: 10,
        display: 'flex', alignItems: 'center', gap: 10
      }}>
        {data.stock_disponible > 0
          ? <CheckCircle size={20} color="#059669" />
          : <AlertTriangle size={20} color="#DC2626" />}
        <div>
          <div style={{ fontSize: 14, fontWeight: 700,
            color: data.stock_disponible > 0 ? '#166534' : '#DC2626' }}>
            {data.stock_disponible > 0
              ? `${data.stock_disponible} combos disponibles`
              : 'Sin stock — faltan componentes'}
          </div>
          <div style={{ fontSize: 11, color: '#6B7280' }}>
            Limitado por el componente con menor stock
          </div>
        </div>
      </div>

      {/* Tabla de componentes */}
      <table style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>Componente</th>
            <th style={{ textAlign: 'right' }}>Necesario</th>
            <th style={{ textAlign: 'right' }}>Disponible</th>
            <th style={{ textAlign: 'right' }}>Combos posibles</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {data.componentes.map((c, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 600 }}>{c.descripcion}</td>
              <td style={{ textAlign: 'right' }}>{Number(c.cant_requerida).toFixed(0)}</td>
              <td style={{ textAlign: 'right' }}>
                <span style={{ fontWeight: 700,
                  color: c.alcanza ? '#059669' : '#DC2626' }}>
                  {Number(c.stock_disponible).toFixed(0)}
                </span>
              </td>
              <td style={{ textAlign: 'right', fontWeight: 700 }}>
                {c.stock_combo}
              </td>
              <td>
                {c.alcanza
                  ? <span className="badge badge-green">✓ OK</span>
                  : <span className="badge badge-red">⚠️ Insuficiente</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}