import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function ProfilePage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [groupName, setGroupName] = useState('')
  const [nameMsg, setNameMsg] = useState(null)
  const [savingName, setSavingName] = useState(false)

  const [email, setEmail] = useState('')
  const [emailMsg, setEmailMsg] = useState(null)
  const [savingEmail, setSavingEmail] = useState(false)

  const [pwdCurrent, setPwdCurrent] = useState('')
  const [pwdNew, setPwdNew] = useState('')
  const [pwdConfirm, setPwdConfirm] = useState('')
  const [pwdMsg, setPwdMsg] = useState(null)
  const [savingPwd, setSavingPwd] = useState(false)
  const [showPwdCurrent, setShowPwdCurrent] = useState(false)
  const [showPwdNew, setShowPwdNew] = useState(false)
  const [showPwdConfirm, setShowPwdConfirm] = useState(false)

  const [avatarUrl, setAvatarUrl] = useState(null)
  const [avatarMsg, setAvatarMsg] = useState(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileRef = useRef()

  const EMPTY_BANK = { bank: '', currency: 'UYU', account: '', holder: '' }
  const [bankAccounts, setBankAccounts] = useState([])
  const [bankModal, setBankModal] = useState(false)
  const [editingBank, setEditingBank] = useState(null)
  const [bankForm, setBankForm] = useState(EMPTY_BANK)
  const [savingBank, setSavingBank] = useState(false)

  useEffect(() => {
    if (profile) setName(profile.full_name || '')
    if (user) setEmail(user.email || '')
    if (profile?.avatar_url) setAvatarUrl(profile.avatar_url)
  }, [profile, user])

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('*, group:groups(name)').eq('id', user.id).single()
      .then(({ data }) => { if (data?.group?.name) setGroupName(data.group.name) })
  }, [user])

  useEffect(() => {
    if (user) loadBankAccounts()
  }, [user])

  // — Nombre —

  async function saveName(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSavingName(true)
    setNameMsg(null)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: name.trim() })
      .eq('id', user.id)
    setNameMsg(error
      ? { type: 'error', text: 'Error: ' + error.message }
      : { type: 'success', text: 'Nombre actualizado.' }
    )
    setSavingName(false)
  }

  // — Email —

  async function saveEmail(e) {
    e.preventDefault()
    if (!email.trim()) return
    setSavingEmail(true)
    setEmailMsg(null)
    const { error } = await supabase.auth.updateUser({ email: email.trim() })
    setEmailMsg(error
      ? { type: 'error', text: 'Error: ' + error.message }
      : { type: 'success', text: 'Se envió un correo de confirmación a la nueva dirección.' }
    )
    setSavingEmail(false)
  }

  // — Contraseña —

  async function savePassword(e) {
    e.preventDefault()
    setPwdMsg(null)
    if (!pwdNew) return
    if (pwdNew.length < 6) { setPwdMsg({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres.' }); return }
    if (pwdNew !== pwdConfirm) { setPwdMsg({ type: 'error', text: 'Las contraseñas no coinciden.' }); return }
    setSavingPwd(true)
    const { error } = await supabase.auth.updateUser({ password: pwdNew })
    if (error) {
      setPwdMsg({ type: 'error', text: 'Error: ' + error.message })
    } else {
      setPwdMsg({ type: 'success', text: 'Contraseña actualizada.' })
      setPwdCurrent(''); setPwdNew(''); setPwdConfirm('')
    }
    setSavingPwd(false)
  }

  // — Cuentas bancarias —

  async function loadBankAccounts() {
    const { data } = await supabase.from('bank_accounts').select('*').eq('user_id', user.id).order('created_at')
    setBankAccounts(data || [])
  }

  function openNewBank() {
    setEditingBank(null)
    setBankForm(EMPTY_BANK)
    setBankModal(true)
  }

  function openEditBank(acc) {
    setEditingBank(acc)
    setBankForm({ bank: acc.bank, currency: acc.currency, account: acc.account, holder: acc.holder })
    setBankModal(true)
  }

  async function saveBankAccount(e) {
    e.preventDefault()
    if (!bankForm.bank.trim() || !bankForm.account.trim() || !bankForm.holder.trim()) return
    setSavingBank(true)
    const payload = {
      bank: bankForm.bank.trim(),
      currency: bankForm.currency,
      account: bankForm.account.trim(),
      holder: bankForm.holder.trim(),
      user_id: user.id,
    }
    const { error } = editingBank
      ? await supabase.from('bank_accounts').update(payload).eq('id', editingBank.id)
      : await supabase.from('bank_accounts').insert(payload)
    if (error) alert('Error: ' + error.message)
    else { setBankModal(false); setEditingBank(null); setBankForm(EMPTY_BANK); loadBankAccounts() }
    setSavingBank(false)
  }

  async function deleteBankAccount(acc) {
    if (!confirm(`¿Eliminar la cuenta ${acc.bank} (${acc.account})?`)) return
    const { error } = await supabase.from('bank_accounts').delete().eq('id', acc.id)
    if (error) alert('Error: ' + error.message)
    else loadBankAccounts()
  }

  // — Avatar —

  async function handleAvatarChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploadingAvatar(true)
    setAvatarMsg(null)

    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      const isBucketMissing = uploadError.message?.toLowerCase().includes('bucket')
      setAvatarMsg({
        type: 'error',
        text: isBucketMissing
          ? 'El bucket "avatars" no existe en Supabase Storage. Crealo desde el panel de Supabase.'
          : 'Error al subir: ' + uploadError.message,
      })
      setUploadingAvatar(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id)

    if (profileError) {
      setAvatarMsg({ type: 'error', text: 'Error al guardar: ' + profileError.message })
    } else {
      setAvatarUrl(publicUrl + '?t=' + Date.now())
      setAvatarMsg({ type: 'success', text: 'Foto actualizada.' })
    }
    setUploadingAvatar(false)
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Mi Perfil</div>
      </div>

      {/* ── Fila 1: Avatar + Nombre ── */}
      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 32, alignItems: 'flex-start' }}>
        {/* Columna izquierda: avatar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, minWidth: 100 }}>
          <div style={{
            width: 88, height: 88, borderRadius: '50%', overflow: 'hidden',
            background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, color: 'var(--ink-faint)', flexShrink: 0,
          }}>
            {avatarUrl
              ? <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : '👤'}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current.click()} disabled={uploadingAvatar}>
            {uploadingAvatar ? 'Subiendo...' : 'Cambiar foto'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
          {avatarMsg && (
            <div className={`alert alert-${avatarMsg.type}`} style={{ padding: '4px 10px', fontSize: 12, textAlign: 'center' }}>
              {avatarMsg.text}
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--ink-faint)', textAlign: 'center' }}>JPG o PNG · 200×200 px</div>
        </div>

        {/* Columna derecha: nombre */}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Nombre</div>
          <form onSubmit={saveName}>
            <div className="form-group">
              <label className="form-label">Nombre completo</label>
              <input className="form-control" value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Tu nombre completo" />
            </div>
            {groupName && (
              <div className="form-group">
                <label className="form-label">Grupo</label>
                <input className="form-control" value={groupName} readOnly
                  style={{ background: 'var(--surface)', color: 'var(--ink-light)', cursor: 'default' }} />
              </div>
            )}
            {nameMsg && (
              <div className={`alert alert-${nameMsg.type}`} style={{ marginBottom: 12 }}>{nameMsg.text}</div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn-primary" disabled={savingName}>
                {savingName ? 'Guardando...' : 'Guardar nombre'}
              </button>
              <button type="button" className="btn btn-ghost" disabled={savingName}
                onClick={async () => { await saveName({ preventDefault: () => {} }); navigate('/') }}>
                Guardar y salir
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Fila 2: Email + Contraseña ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Email */}
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Email</div>
          <form onSubmit={saveEmail}>
            <div className="form-group">
              <label className="form-label">Dirección de email</label>
              <input className="form-control" type="email" value={email}
                onChange={e => setEmail(e.target.value)} />
              <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 4 }}>
                Al cambiar el email recibirás un correo de confirmación.
              </div>
            </div>
            {emailMsg && (
              <div className={`alert alert-${emailMsg.type}`} style={{ marginBottom: 12 }}>{emailMsg.text}</div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn-primary" disabled={savingEmail}>
                {savingEmail ? 'Guardando...' : 'Actualizar email'}
              </button>
              <button type="button" className="btn btn-ghost" disabled={savingEmail}
                onClick={async () => { await saveEmail({ preventDefault: () => {} }); navigate('/') }}>
                Guardar y salir
              </button>
            </div>
          </form>
        </div>

        {/* Contraseña */}
        <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 16 }}>Contraseña</div>
        <form onSubmit={savePassword}>
          <div className="form-group">
            <label className="form-label">Contraseña actual</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 360 }}>
              <input className="form-control" type={showPwdCurrent ? 'text' : 'password'} value={pwdCurrent}
                onChange={e => setPwdCurrent(e.target.value)}
                placeholder="••••••••" style={{ flex: 1 }} />
              <button type="button" onClick={() => setShowPwdCurrent(v => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '0 4px', color: 'var(--ink-light)' }}>
                {showPwdCurrent ? '🙈' : '👁'}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Nueva contraseña</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 360 }}>
              <input className="form-control" type={showPwdNew ? 'text' : 'password'} value={pwdNew}
                onChange={e => setPwdNew(e.target.value)}
                placeholder="Mínimo 6 caracteres" style={{ flex: 1 }} />
              <button type="button" onClick={() => setShowPwdNew(v => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '0 4px', color: 'var(--ink-light)' }}>
                {showPwdNew ? '🙈' : '👁'}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Confirmar nueva contraseña</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 360 }}>
              <input className="form-control" type={showPwdConfirm ? 'text' : 'password'} value={pwdConfirm}
                onChange={e => setPwdConfirm(e.target.value)}
                placeholder="••••••••" style={{ flex: 1 }} />
              <button type="button" onClick={() => setShowPwdConfirm(v => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '0 4px', color: 'var(--ink-light)' }}>
                {showPwdConfirm ? '🙈' : '👁'}
              </button>
            </div>
          </div>
          {pwdMsg && (
            <div className={`alert alert-${pwdMsg.type}`} style={{ marginBottom: 12 }}>{pwdMsg.text}</div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn btn-primary" disabled={savingPwd}>
              {savingPwd ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
            <button type="button" className="btn btn-ghost" disabled={savingPwd}
              onClick={async () => { await savePassword({ preventDefault: () => {} }); navigate('/') }}>
              Guardar y salir
            </button>
          </div>
        </form>
      </div>

      </div>{/* ── fin fila 2 grid ── */}

      {/* — Cuentas bancarias — */}
      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 600 }}>Cuentas bancarias para reintegros</div>
          <button className="btn btn-primary btn-sm" onClick={openNewBank}>+ Agregar cuenta</button>
        </div>

        {bankAccounts.length === 0 ? (
          <div style={{ color: 'var(--ink-faint)', fontSize: 13 }}>No tenés cuentas registradas todavía.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {bankAccounts.map(acc => (
              <div key={acc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{acc.bank}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 2 }}>
                    {acc.account} · {acc.holder} · <span className={`tag tag-${acc.currency === 'USD' ? 'blue' : 'green'}`} style={{ fontSize: 11 }}>{acc.currency}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEditBank(acc)}>Editar</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger, #e53e3e)' }} onClick={() => deleteBankAccount(acc)}>Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* — Modal cuenta bancaria — */}
      {bankModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setBankModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editingBank ? 'Editar cuenta' : 'Nueva cuenta bancaria'}</div>
              <button className="modal-close" onClick={() => setBankModal(false)}>✕</button>
            </div>
            <form onSubmit={saveBankAccount}>
              <div className="form-group">
                <label className="form-label">Banco / Institución *</label>
                <input className="form-control" value={bankForm.bank}
                  onChange={e => setBankForm(f => ({ ...f, bank: e.target.value }))}
                  placeholder="Ej: BROU, Santander, OCA" required />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Número de cuenta *</label>
                  <input className="form-control" value={bankForm.account}
                    onChange={e => setBankForm(f => ({ ...f, account: e.target.value }))}
                    placeholder="Ej: 001-12345/67" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Moneda *</label>
                  <select className="form-control" value={bankForm.currency}
                    onChange={e => setBankForm(f => ({ ...f, currency: e.target.value }))}>
                    <option value="UYU">UYU – Pesos uruguayos</option>
                    <option value="USD">USD – Dólares</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Titular de la cuenta *</label>
                <input className="form-control" value={bankForm.holder}
                  onChange={e => setBankForm(f => ({ ...f, holder: e.target.value }))}
                  placeholder="Nombre completo del titular" required />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setBankModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={savingBank}>
                  {savingBank ? 'Guardando...' : editingBank ? 'Guardar cambios' : 'Agregar cuenta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
