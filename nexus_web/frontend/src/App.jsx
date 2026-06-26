import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './theme'
import { ToastProvider } from './components/Toast'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Proveedores from './pages/Proveedores'
import Vendedores from './pages/Vendedores'
import Configuracion from './pages/Configuracion'
import Clientes from './pages/Clientes'
import Facturas from './pages/Facturas'
import GestionPrecios from './pages/GestionPrecios'
import Stock from './pages/Stock'
import Reportes from './pages/Reportes'
import CXC from './pages/CXC'
import Compras from './pages/Compras'
import CXP from './pages/CXP'
import Devoluciones from './pages/Devoluciones'
import Transferencias from './pages/Transferencias'
import Caja from './pages/Caja'
import Bancos from './pages/Bancos'
import Conciliacion from './pages/Conciliacion'
import Ajustes from './pages/Ajustes'
import Etiquetas from './pages/Etiquetas'
import Usuarios from './pages/Usuarios'
import Kardex from './pages/Kardex'
import Cotizaciones from './pages/Cotizaciones'
import TomaFisica from './pages/TomaFisica'
import ServicioTecnico from './pages/ServicioTecnico'
import CRM from './pages/CRM'
import Retenciones from './pages/Retenciones'
import NotasDebito from './pages/NotasDebito'
import Contabilidad from './pages/Contabilidad'
import Nomina from './pages/Nomina'
import Administracion from './pages/Administracion'
import Layout from './components/Layout'
import PrintFactura from './pages/PrintFactura'
import NotFound from './pages/NotFound'
import SuperAdmin from './pages/SuperAdmin'
import Landing from './pages/Landing'

function useAuth() {
  return !!localStorage.getItem('nexus_token')
}

function PrivateRoute({ children }) {
  const auth = useAuth()
  if (!auth) return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ children }) {
  const auth = useAuth()
  if (auth) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <ThemeProvider>
    <ToastProvider>
    <BrowserRouter>
      <Routes>
        {/* Landing page */}
        <Route path="/landing" element={<Landing />} />

        <Route path="/login" element={
          <PublicRoute><Login /></PublicRoute>
        } />

        {/* Super Admin panel - outside normal auth */}
        <Route path="/superadmin" element={<SuperAdmin />} />

        {/* Impresión: fuera del Layout */}
        <Route path="/facturas/:id/print" element={
          <PrivateRoute><PrintFactura /></PrivateRoute>
        } />

        <Route path="/" element={
          <PrivateRoute><Layout /></PrivateRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="proveedores"  element={<Proveedores />} />
          <Route path="vendedores"   element={<Vendedores />} />
          <Route path="configuracion"element={<Configuracion />} />
          <Route path="clientes"     element={<Clientes />} />
          <Route path="facturas"     element={<Facturas />} />
          <Route path="gestion-precios" element={<GestionPrecios />} />
          <Route path="stock"        element={<Stock />} />
          <Route path="reportes"     element={<Reportes />} />
          <Route path="cxc"          element={<CXC />} />
          <Route path="compras"       element={<Compras />} />
          <Route path="cxp-pagar"      element={<CXP />} />
          <Route path="devoluciones"    element={<Devoluciones />} />
          <Route path="transferencias"  element={<Transferencias />} />
          <Route path="caja"           element={<Caja />} />
          <Route path="bancos"         element={<Bancos />} />
          <Route path="conciliacion"    element={<Conciliacion />} />
          <Route path="ajustes"         element={<Ajustes />} />
          <Route path="etiquetas"       element={<Etiquetas />} />
          <Route path="usuarios"        element={<Usuarios />} />
          <Route path="kardex"          element={<Kardex />} />
          <Route path="cotizaciones"   element={<Cotizaciones />} />
          <Route path="toma-fisica"    element={<TomaFisica />} />
          <Route path="servicio-tecnico" element={<ServicioTecnico />} />
          <Route path="crm" element={<CRM />} />
          <Route path="retenciones" element={<Retenciones />} />
          <Route path="notas-debito" element={<NotasDebito />} />
          <Route path="contabilidad" element={<Contabilidad />} />
          <Route path="nomina" element={<Nomina />} />
          <Route path="administracion" element={<Administracion />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
    </ToastProvider>
    </ThemeProvider>
  )
}