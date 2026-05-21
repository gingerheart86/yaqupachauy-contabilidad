import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Sidebar from './components/Sidebar'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import ExpensesPage from './pages/ExpensesPage'
import ProjectsPage from './pages/ProjectsPage'
import ReimbursementsPage from './pages/ReimbursementsPage'
import ReportsPage from './pages/ReportsPage'
import UsersPage from './pages/UsersPage'
import CategoriesPage from './pages/CategoriesPage'
import ProfilePage from './pages/ProfilePage'

function AdminOnly({ children }) {
  const { profile, loading } = useAuth()
  if (loading) return null
  if (profile?.role !== 'admin') return <Navigate to="/" replace />
  return children
}

function ProtectedLayout() {
  const { user, loading } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()
  const [fromInvite] = useState(() => window.location.hash.includes('type=invite'))

  useEffect(() => {
    if (!loading && user && fromInvite) {
      navigate('/perfil', { state: { fromInvite: true } })
    }
  }, [loading, user])

  if (loading) return (
    <div className="loading-screen">
      <span style={{ fontSize: 32 }}>🐋</span>
      Cargando...
    </div>
  )

  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="app-layout">
      {/* overlay móvil */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="main-area">
        {/* topbar móvil */}
        <div className="mobile-topbar">
          <button className="hamburger-btn" onClick={() => setSidebarOpen(true)}>☰</button>
          <img src="/logo-yp.png" alt="Yaqu Pacha Uruguay" className="mobile-topbar-logo" />
        </div>

        <div className="page-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/gastos" element={<ExpensesPage />} />
            <Route path="/reintegros" element={<ReimbursementsPage />} />
            <Route path="/reportes" element={<ReportsPage />} />
            <Route path="/perfil" element={<ProfilePage />} />
            <Route path="/proyectos" element={<AdminOnly><ProjectsPage /></AdminOnly>} />
            <Route path="/categorias" element={<AdminOnly><CategoriesPage /></AdminOnly>} />
            <Route path="/usuarios" element={<AdminOnly><UsersPage /></AdminOnly>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

function AuthRoute() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/" replace />
  return <LoginPage />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<AuthRoute />} />
          <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
