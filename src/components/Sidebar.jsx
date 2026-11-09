import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

const adminNavItems = [
  { to: '/', icon: '📊', label: 'Dashboard', group: 'Principal' },
  { to: '/gastos', icon: '💰', label: 'Gastos', group: null },
  { to: '/proyectos', icon: '💻', label: 'Proyectos', group: null },
  { to: '/reintegros', icon: '↩', label: 'Reintegros', group: 'Finanzas' },
  { to: '/reportes', icon: '📄', label: 'Reportes', group: null },
  { to: '/categorias', icon: '🏷️', label: 'Categorías y Actividades', group: 'Administración' },
  { to: '/usuarios', icon: '👥', label: 'Usuarios', group: null },
  { to: '/perfil', icon: '👤', label: 'Mi Perfil', group: 'Cuenta' },
]

const memberNavItems = [
  { to: '/', icon: '📊', label: 'Dashboard', group: null },
  { to: '/gastos', icon: '💰', label: 'Mis Gastos', group: null },
  { to: '/reintegros', icon: '↩', label: 'Mis Reintegros', group: null },
  { to: '/reportes', icon: '📄', label: 'Mis Reportes', group: null },
  { to: '/perfil', icon: '👤', label: 'Mi Perfil', group: 'Cuenta' },
]

export default function Sidebar({ open, onClose }) {
  const { profile, signOut } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  const items = isAdmin ? adminNavItems : memberNavItems

  // Admin: cantidad de solicitudes de reintegro pendientes (se refresca al navegar y cada minuto)
  const location = useLocation()
  const [pendingReimb, setPendingReimb] = useState(0)
  useEffect(() => {
    if (!isAdmin) return
    let alive = true
    const load = () => supabase.from('reimbursements')
      .select('id', { count: 'exact', head: true }).eq('status', 'pending')
      .then(({ count }) => { if (alive) setPendingReimb(count || 0) })
    load()
    const t = setInterval(load, 60000)
    return () => { alive = false; clearInterval(t) }
  }, [isAdmin, location.pathname])

  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      <div className="sidebar-logo">
        <img src="/logo-yp.png" alt="Yaqu Pacha Uruguay" className="sidebar-logo-img" />
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
              onClick={onClose}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {isAdmin && item.to === '/reintegros' && pendingReimb > 0 && (
                <span title={`${pendingReimb} solicitud(es) pendiente(s)`} style={{
                  marginLeft: 'auto', background: 'var(--red-mid)', color: '#fff',
                  fontSize: 10, fontWeight: 600, borderRadius: 10, padding: '1px 7px',
                }}>{pendingReimb}</span>
              )}
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
