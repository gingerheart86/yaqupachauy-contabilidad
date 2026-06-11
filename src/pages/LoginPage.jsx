import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const { signIn } = useAuth()
  const location = useLocation()
  const successMsg = location.state?.message || ''

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [resetMode, setResetMode] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMsg, setResetMsg] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) setError('Email o contraseña incorrectos')
    setLoading(false)
  }

  async function handleReset(e) {
    e.preventDefault()
    setResetMsg(null)
    setResetLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: window.location.origin,
    })
    if (error) {
      setResetMsg({ type: 'error', text: 'Error: ' + error.message })
    } else {
      setResetMsg({ type: 'success', text: `Te mandamos un link a ${resetEmail} para restablecer tu contraseña.` })
      setResetEmail('')
    }
    setResetLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <span className="whale-big">🐋🐬</span>
          <h1>Yaqu Pacha Uruguay</h1>
          <p>Sistema de gestión financiera</p>
        </div>

        {!resetMode ? (
          <>
            {successMsg && <div className="alert alert-success">{successMsg}</div>}
            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-control" type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com" required autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Contraseña</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input className="form-control" type={showPassword ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" required style={{ flex: 1 }} />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: '0 4px', color: 'var(--ink-light)', flexShrink: 0 }}>
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <button className="btn btn-primary" type="submit" disabled={loading}
                style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}>
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: 16 }}>
              <button onClick={() => { setResetMode(true); setError('') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--ocean-bright)', textDecoration: 'underline' }}>
                ¿Olvidaste tu contraseña?
              </button>
            </p>
            <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-faint)', marginTop: 8 }}>
              Para crear tu cuenta, pedile a un administrador.
            </p>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Restablecer contraseña</div>
            <p style={{ fontSize: 13, color: 'var(--ink-light)', marginBottom: 16 }}>
              Ingresá tu email y te mandamos un link para crear una nueva contraseña.
            </p>
            {resetMsg && <div className={`alert alert-${resetMsg.type}`} style={{ marginBottom: 12 }}>{resetMsg.text}</div>}
            <form onSubmit={handleReset}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-control" type="email" value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  placeholder="tu@email.com" required autoFocus />
              </div>
              <button className="btn btn-primary" type="submit" disabled={resetLoading}
                style={{ width: '100%', justifyContent: 'center' }}>
                {resetLoading ? 'Enviando...' : 'Enviar link'}
              </button>
            </form>
            <p style={{ textAlign: 'center', marginTop: 16 }}>
              <button onClick={() => { setResetMode(false); setResetMsg(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--ink-light)', textDecoration: 'underline' }}>
                ← Volver al login
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
