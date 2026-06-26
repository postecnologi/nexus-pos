import { useState, useEffect } from 'react'
import { Search, Plus, Eye, Edit, ToggleLeft, ToggleRight } from 'lucide-react'
import api from '../api'

export default function Productos() {
  const [productos, setProductos] = useState([])
  const [busqueda, setBusqueda]   = useState('')
  const [filtro, setFiltro]       = useState('true')
  const [loading, setLoading]     = useState(true)

  useEffect(() => { cargar() }, [filtro])

  async function cargar(bus = busqueda) {
    setLoading(true)
    try {
      const { data } = await api.get('/productos', {
        params: { busqueda: bus, activo: filtro }
      })
      setProductos(data)
    } finally { setLoading(false) }
  }

  async function toggleActivo(p) {
    await api.patch ? null : null
    // Llamamos al endpoint de NEXUS directamente con un workaround
    // por ahora mostramos el estado
    alert(`Función disponible en el módulo completo.\nProducto: ${p.descripcion}`)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Productos</h1>
          <p className="page-subtitle">{productos.length} productos encontrados</p>
        </div>
        <button className="btn btn-purple">
          <Plus size={16} /> Nuevo Producto
        </button>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{
              position: 'absolute', left: 12, top: '50%',
              transform: 'translateY(-50%)', color: '#94A3B8'
            }} />
            <input
              placeholder="Buscar por código o descripción..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && cargar(busqueda)}
              style={{ paddingLeft: 36 }}
            />
          </div>
          {['true','false',''].map(v => (
            <button key={v}
              className={`btn ${filtro===v ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFiltro(v)}>
              {v==='true' ? 'Activos' : v==='false' ? 'Inactivos' : 'Todos'}
            </button>
          ))}
          <button className="btn btn-primary" onClick={() => cargar(busqueda)}>
            <Search size={16} /> Buscar
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="loading">Cargando productos...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Descripción</th>
                <th>Marca</th>
                <th>Categoría</th>
                <th style={{ textAlign: 'right' }}>Stock</th>
                <th style={{ textAlign: 'right' }}>Precio</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productos.map(p => (
                <tr key={p.id}>
                  <td><code style={{ fontSize: 12, color: '#2563EB' }}>{p.codigo}</code></td>
                  <td style={{ fontWeight: 600 }}>{p.descripcion}</td>
                  <td style={{ color: '#6B7280' }}>{p.marca_nombre || '—'}</td>
                  <td style={{ color: '#6B7280' }}>{p.categoria_nombre || '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={`badge ${Number(p.stock_total)>0?'badge-green':'badge-red'}`}>
                      {Number(p.stock_total).toFixed(0)} u.
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: '#DC2626' }}>
                    ${Number(p.precio_venta || 0).toFixed(2)}
                  </td>
                  <td>
                    <span className={`badge ${p.activo ? 'badge-green' : 'badge-gray'}`}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost" style={{ padding: '4px 8px' }}
                        title="Ver">
                        <Eye size={14} />
                      </button>
                      <button className="btn btn-ghost" style={{ padding: '4px 8px' }}
                        title="Editar">
                        <Edit size={14} />
                      </button>
                      <button className="btn btn-ghost" style={{ padding: '4px 8px' }}
                        onClick={() => toggleActivo(p)}
                        title={p.activo ? 'Desactivar' : 'Activar'}>
                        {p.activo
                          ? <ToggleRight size={14} color="#059669" />
                          : <ToggleLeft  size={14} color="#6B7280" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {productos.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>
                  Sin productos
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}