import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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

function ProtectedLayout() {
  const { user, loading } = useAuth()

  if (loading) return (
    <div className="loading-screen">
      <span style={{ fontSize: 32 }}>🐋</span>
      Cargando...
    </div>
  )

  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-area">
        <div className="page-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/gastos" element={<ExpensesPage />} />
            <Route path="/proyectos" element={<ProjectsPage />} />
            <Route path="/reintegros" element={<ReimbursementsPage />} />
            <Route path="/reportes" element={<ReportsPage />} />
            <Route path="/categorias" element={<CategoriesPage />} />
            <Route path="/perfil" element={<ProfilePage />} />
            <Route path="/usuarios" element={<UsersPage />} />
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
