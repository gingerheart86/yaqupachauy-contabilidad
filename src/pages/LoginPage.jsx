import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) setError('Email o contraseña incorrectos')
    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <span className="whale-big">🐋🐬</span>
          <h1>Yaqu Pacha Uruguay</h1>
          <p>Sistema de gestión financiera</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-control"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <input
              className="form-control"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-faint)', marginTop: 20 }}>
          Para crear tu cuenta, pedile a un administrador.
        </p>
      </div>
    </div>
  )
}
