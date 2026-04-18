import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function UsersPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviting, setInviting] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setUsers(data || [])
    setLoading(false)
  }

  async function inviteUser(e) {
    e.preventDefault()
    setInviting(true)
    setMsg('')
    const { error } = await supabase.auth.admin.inviteUserByEmail(inviteEmail, {
      data: { full_name: inviteName }
    })
    if (error) {
      setMsg('Error: ' + error.message)
    } else {
      setMsg(`Invitación enviada a ${inviteEmail}`)
      setInviteEmail('')
      setInviteName('')
    }
    setInviting(false)
  }

  async function toggleRole(u) {
    const newRole = u.role === 'admin' ? 'member' : 'admin'
    await supabase.from('profiles').update({ role: newRole }).eq('id', u.id)
    loadUsers()
  }

  if (!isAdmin) return (
    <div className="empty-state">
      <div className="empty-icon">🔒</div>
      Solo las administradoras pueden gestionar usuarios.
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Usuarios</div>
        <button className="btn btn-primary" onClick={() => setShowInvite(true)}>+ Invitar persona</button>
      </div>

      <div className="table-wrap">
        {loading ? <div className="empty-state">Cargando...</div> : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Miembro desde</th>
                {isAdmin && <th>Acción</th>}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--ocean-mist)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'var(--ocean-mid)', flexShrink: 0 }}>
                        {u.full_name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 500, color: 'var(--ink)' }}>{u.full_name}</span>
                    </div>
                  </td>
                  <td>
                    {u.role === 'admin'
                      ? <span className="tag tag-blue">👑 Administradora</span>
                      : <span className="tag tag-gray">Integrante</span>
                    }
                  </td>
                  <td style={{ color: 'var(--ink-light)', fontSize: 12 }}>
                    {new Date(u.created_at).toLocaleDateString('es-UY')}
                  </td>
                  {isAdmin && u.id !== profile.id && (
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleRole(u)}>
                        {u.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
                      </button>
                    </td>
                  )}
                  {isAdmin && u.id === profile.id && <td style={{ color: 'var(--ink-faint)', fontSize: 12 }}>Sos vos</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showInvite && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowInvite(false)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div className="modal-title">Invitar persona</div>
              <button className="modal-close" onClick={() => setShowInvite(false)}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-light)', marginBottom: 16 }}>
              Le llegará un email para que pueda crear su contraseña y acceder a la app.
            </p>
            {msg && <div className={`alert ${msg.startsWith('Error') ? 'alert-error' : 'alert-success'}`}>{msg}</div>}
            <form onSubmit={inviteUser}>
              <div className="form-group">
                <label className="form-label">Nombre completo</label>
                <input className="form-control" value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  placeholder="Ej: Romina Díaz" required />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-control" type="email" value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="romina@email.com" required />
              </div>
              <div className="form-hint" style={{ marginBottom: 16 }}>
                💡 Para invitar usuarios necesitás activar la Service Role Key de Supabase o usar el panel de Supabase → Authentication → Invite user.
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowInvite(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={inviting}>{inviting ? 'Enviando...' : 'Enviar invitación'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
