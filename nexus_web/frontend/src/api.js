import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
})

// Agregar token y tenant en cada request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('nexus_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  // Send tenant DB header if user belongs to a specific company
  try {
    const user = JSON.parse(localStorage.getItem('nexus_user') || '{}')
    if (user.empresa_db) config.headers['X-Tenant-DB'] = user.empresa_db
  } catch (_) {}
  return config
})

// Si expira el token, redirigir al login
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('nexus_token')
      localStorage.removeItem('nexus_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api