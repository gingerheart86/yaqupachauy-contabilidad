import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const adminNavItems = [
  { to: '/', icon: '📊', label: 'Dashboard', group: 'Principal' },
  { to: '/gastos', icon: '🧾', label: 'Gastos', group: null },
  { to: '/proyectos', icon: '🔵', label: 'Proyectos', group: null },
  { to: '/reintegros', icon: '↩', label: 'Reintegros', group: 'Finanzas' },
  { to: '/reportes', icon: '📄', label: 'Reportes', group: null },
  { to: '/categorias', icon: '🏷️', label: 'Categorías y Actividades', group: 'Administración' },
  { to: '/usuarios', icon: '👥', label: 'Usuarios', group: null },
  { to: '/perfil', icon: '👤', label: 'Mi Perfil', group: 'Cuenta' },
]

const memberNavItems = [
  { to: '/gastos', icon: '🧾', label: 'Mis Gastos', group: null },
  { to: '/reintegros', icon: '↩', label: 'Mis Reintegros', group: null },
  { to: '/perfil', icon: '👤', label: 'Mi Perfil', group: null },
]

export default function Sidebar() {
  const { profile, signOut } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  const items = isAdmin ? adminNavItems : memberNavItems

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="whale">🐋</span>
        <div className="org-name">Yaqupachauy</div>
        <div className="app-label">Gestión financiera</div>
      </div>

      <nav className="nav-section">
        {items.map(item => (
          <div key={item.to}>
            {item.group && <div className="nav-group-label">{item.group}</div>}
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          </div>
        ))}
      </nav>

      <div className="sidebar-user">
        <div className="user-avatar">
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            : initials
          }
        </div>
        <div className="user-info">
          <div className="name">{profile?.full_name ?? 'Usuario'}</div>
          <div className="role">{profile?.role === 'admin' ? 'Administradora' : 'Integrante'}</div>
        </div>
        <button className="btn-signout" onClick={signOut} title="Cerrar sesión">✕</button>
      </div>
    </aside>
  )
}
