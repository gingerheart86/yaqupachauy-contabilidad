import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

function fmt(amount, currency) {
  if (!amount && amount !== 0) return '—'
  if (currency === 'USD') return `U$D ${Number(amount).toLocaleString('es-UY', { minimumFractionDigits: 2 })}`
  return `$U ${Number(amount).toLocaleString('es-UY', { minimumFractionDigits: 2 })}`
}

function today() { return new Date().toISOString().slice(0, 10) }

function fmtDate(d) {
  if (!d) return '—'
  return format(new Date(d.includes('T') ? d : d + 'T00:00:00'), 'd MMM yyyy', { locale: es })
}

export default function ReimbursementsPage() {
  const { user, profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const [expenses, setExpenses]           = useState([])
  const [reimbursements, setReimbursements] = useState([])
  const [credits, setCredits]             = useState([])
  const [creditApps, setCreditApps]       = useState([])
  const [users, setUsers]                 = useState([])
  const [bankAccounts, setBankAccounts]   = useState({})
  const [loading, setLoading]             = useState(true)

  const [tab, setTab] = useState(isAdmin ? 'solicitudes' : 'pendientes')
  const [filterUser, setFilterUser] = useState('')
  const [expanded, setExpanded] = useState(null)

  // Member: selección de gastos
  const [selected, setSelected] = useState(new Set())
  const [bundleNote, setBundleNote] = useState('')
  const [creating, setCreating] = useState(false)

  // Admin: registrar reintegro (bundle nuevo ya pagado)
  const [registerModal, setRegisterModal] = useState(false)
  const [registerDate, setRegisterDate]   = useState(today())
  const [regCreditId, setRegCreditId]     = useState('')
  const [regCreditAmt, setRegCreditAmt]   = useState('')
  const [registering, setRegistering]     = useState(false)

  // Admin: pago de bundle existente (pendiente)
  const [payModal, setPayModal]         = useState(null)
  const [payDate, setPayDate]           = useState(today())
  const [payCreditId, setPayCreditId]   = useState('')
  const [payCreditAmt, setPayCreditAmt] = useState('')
  const [paying, setPaying]             = useState(false)

  // Admin: nuevo crédito
  const [creditModal, setCreditModal]   = useState(false)
  const [creditForm, setCreditForm]     = useState({ user_id: '', amount: '', currency: 'UYU', description: '' })
  const [savingCredit, setSavingCredit] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [
      { data: exp },
      { data: reimb },
      { data: cred },
      { data: apps },
      { data: userList },
      { data: banks },
    ] = await Promise.all([
      supabase.from('expenses').select('*').eq('payment_type', 'personal').order('expense_date', { ascending: false }),
      supabase.from('reimbursements').select('*').order('created_at', { ascending: false }),
      supabase.from('credits').select('*').order('created_at', { ascending: false }),
      supabase.from('credit_applications').select('*'),
      supabase.from('profiles').select('id, full_name'),
      supabase.from('bank_accounts').select('*'),
    ])
    setExpenses(exp || [])
    setReimbursements(reimb || [])
    setCredits(cred || [])
    setCreditApps(apps || [])
    setUsers(userList || [])
    const byUser = {}
    ;(banks || []).forEach(b => { if (!byUser[b.user_id]) byUser[b.user_id] = []; byUser[b.user_id].push(b) })
    setBankAccounts(byUser)
    setLoading(false)
  }

  const userName = id => users.find(u => u.id === id)?.full_name ?? '—'

  // — Gastos pendientes sin bundle (propios o filtrado por admin) —
  const pendingExpenses = expenses.filter(e =>
    !e.reimbursement_id && !e.reimbursed &&
    (isAdmin ? (!filterUser || e.user_id === filterUser) : e.user_id === user.id)
  )

  const selArr = pendingExpenses.filter(e => selected.has(e.id))
  const selUYU = selArr.filter(e => e.currency === 'UYU').reduce((s, e) => s + Number(e.amount), 0)
  const selUSD = selArr.filter(e => e.currency === 'USD').reduce((s, e) => s + Number(e.amount), 0)

  function toggleSelect(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  // — Crear bundle de reintegro —
  // Member: crea solicitud pendiente
  async function createBundle() {
    if (selected.size === 0) return
    setCreating(true)
    const { data: bundle, error } = await supabase.from('reimbursements').insert({
      user_id: user.id, status: 'pending',
      total_uyu: selUYU, total_usd: selUSD,
      notes: bundleNote.trim() || null,
    }).select().single()
    if (error) { alert('Error: ' + error.message); setCreating(false); return }
    await supabase.from('expenses').update({ reimbursement_id: bundle.id }).in('id', [...selected])
    setSelected(new Set()); setBundleNote(''); setCreating(false)
    setTab('solicitudes'); loadData()
  }

  // Admin: crea bundle y lo paga en un solo paso
  async function registerAndPay() {
    if (selected.size === 0 || !filterUser) return
    setRegistering(true)
    const targetUserId = filterUser
    const { data: bundle, error } = await supabase.from('reimbursements').insert({
      user_id: targetUserId, status: 'paid',
      total_uyu: selUYU, total_usd: selUSD,
      notes: bundleNote.trim() || null,
      paid_at: registerDate, paid_by: user.id,
    }).select().single()
    if (error) { alert('Error: ' + error.message); setRegistering(false); return }

    await supabase.from('expenses')
      .update({ reimbursement_id: bundle.id, reimbursed: true, reimbursed_at: registerDate, reimbursed_by: user.id })
      .in('id', [...selected])

    if (regCreditId && Number(regCreditAmt) > 0) {
      const credit = credits.find(c => c.id === regCreditId)
      if (credit) {
        const newRemaining = Math.max(0, Number(credit.remaining) - Number(regCreditAmt))
        await supabase.from('credits').update({ remaining: newRemaining }).eq('id', regCreditId)
        await supabase.from('credit_applications').insert({
          credit_id: regCreditId, reimbursement_id: bundle.id, amount: Number(regCreditAmt),
        })
      }
    }

    setSelected(new Set()); setBundleNote(''); setRegisterModal(false)
    setRegCreditId(''); setRegCreditAmt(''); setRegistering(false)
    setTab('historial'); loadData()
  }

  // — Pagar bundle —
  async function payBundle() {
    if (!payModal) return
    setPaying(true)

    await supabase.from('reimbursements').update({
      status: 'paid', paid_at: payDate, paid_by: user.id,
    }).eq('id', payModal.id)

    const bundleExpIds = expenses.filter(e => e.reimbursement_id === payModal.id).map(e => e.id)
    if (bundleExpIds.length > 0) {
      await supabase.from('expenses').update({
        reimbursed: true, reimbursed_at: payDate, reimbursed_by: user.id,
      }).in('id', bundleExpIds)
    }

    if (payCreditId && Number(payCreditAmt) > 0) {
      const credit = credits.find(c => c.id === payCreditId)
      if (credit) {
        const newRemaining = Math.max(0, Number(credit.remaining) - Number(payCreditAmt))
        await supabase.from('credits').update({ remaining: newRemaining }).eq('id', payCreditId)
        await supabase.from('credit_applications').insert({
          credit_id: payCreditId, reimbursement_id: payModal.id, amount: Number(payCreditAmt),
        })
      }
    }

    setPayModal(null); setPayCreditId(''); setPayCreditAmt('')
    setPaying(false); loadData()
  }

  // — Deshacer pago de bundle —
  async function undoPay(bundle) {
    if (!confirm('¿Deshacer el pago de esta solicitud?')) return
    await supabase.from('reimbursements').update({ status: 'pending', paid_at: null, paid_by: null }).eq('id', bundle.id)
    const ids = expenses.filter(e => e.reimbursement_id === bundle.id).map(e => e.id)
    if (ids.length > 0) {
      await supabase.from('expenses').update({ reimbursed: false, reimbursed_at: null, reimbursed_by: null }).in('id', ids)
    }
    loadData()
  }

  // — Cancelar bundle (member retira solicitud) —
  async function cancelBundle(bundle) {
    if (!confirm('¿Retirar esta solicitud? Los gastos volverán a estar disponibles.')) return
    await supabase.from('expenses').update({ reimbursement_id: null }).eq('reimbursement_id', bundle.id)
    await supabase.from('reimbursements').delete().eq('id', bundle.id)
    loadData()
  }

  // — Guardar crédito —
  async function saveCredit(e) {
    e.preventDefault()
    setSavingCredit(true)
    const { error } = await supabase.from('credits').insert({
      user_id: creditForm.user_id, amount: Number(creditForm.amount),
      currency: creditForm.currency, description: creditForm.description.trim() || null,
      remaining: Number(creditForm.amount), created_by: user.id,
    })
    if (error) alert('Error: ' + error.message)
    else { setCreditModal(false); setCreditForm({ user_id: '', amount: '', currency: 'UYU', description: '' }); loadData() }
    setSavingCredit(false)
  }

  // — Listas filtradas —
  const myReimbs = reimbursements.filter(r =>
    (isAdmin ? (!filterUser || r.user_id === filterUser) : r.user_id === user.id)
  )
  const pendingBundles = myReimbs.filter(r => r.status === 'pending')
  const paidBundles    = myReimbs.filter(r => r.status === 'paid')
  const myCredits      = isAdmin
    ? credits.filter(c => !filterUser || c.user_id === filterUser)
    : credits.filter(c => c.user_id === user.id)

  const userCredits = payModal
    ? credits.filter(c => c.user_id === payModal.user_id && Number(c.remaining) > 0)
    : []

  if (loading) return <div className="empty-state">Cargando...</div>

  const TABS = isAdmin
    ? [['pendientes', 'Gastos pendientes', pendingExpenses.length], ['solicitudes', 'Solicitudes', pendingBundles.length], ['historial', 'Historial', 0], ['creditos', 'Créditos', 0]]
    : [['pendientes', 'Mis gastos', pendingExpenses.length], ['solicitudes', 'Mis solicitudes', pendingBundles.length], ['creditos', 'Mis créditos', 0]]

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Reintegros</div>
        {isAdmin && (
          <button className="btn btn-primary btn-sm" onClick={() => setCreditModal(true)}>
            + Crédito / Adelanto
          </button>
        )}
      </div>

      {/* Filtro por usuario (admin) */}
      {isAdmin && (
        <div style={{ marginBottom: 14 }}>
          <select className="form-control" style={{ maxWidth: 240, fontSize: 13 }}
            value={filterUser} onChange={e => setFilterUser(e.target.value)}>
            <option value="">Todas las integrantes</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
        {TABS.map(([key, label, count]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '8px 16px', fontSize: 13,
            fontWeight: tab === key ? 600 : 400,
            color: tab === key ? 'var(--ocean-bright)' : 'var(--ink-light)',
            borderBottom: tab === key ? '2px solid var(--ocean-bright)' : '2px solid transparent',
            marginBottom: -2,
          }}>
            {label}
            {count > 0 && (
              <span style={{ marginLeft: 6, background: 'var(--red-mid)', color: '#fff', fontSize: 10, borderRadius: 10, padding: '1px 6px' }}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: Gastos pendientes (member) ── */}
      {tab === 'pendientes' && (
        <div>
          {selected.size > 0 && (
            <div style={{ background: 'var(--ocean-mist)', border: '1px solid var(--ocean-pale)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{selected.size} gasto{selected.size !== 1 ? 's' : ''} seleccionado{selected.size !== 1 ? 's' : ''}</span>
                {selUYU > 0 && <span style={{ marginLeft: 10, color: 'var(--ocean-deep)', fontWeight: 500 }}>{fmt(selUYU, 'UYU')}</span>}
                {selUSD > 0 && <span style={{ marginLeft: 8, color: 'var(--ocean-deep)', fontWeight: 500 }}>{fmt(selUSD, 'USD')}</span>}
              </div>
              <input className="form-control" style={{ maxWidth: 220, fontSize: 13 }}
                value={bundleNote} onChange={e => setBundleNote(e.target.value)}
                placeholder={isAdmin ? 'Nota opcional...' : 'Nota para el admin (opcional)'} />
              {isAdmin ? (
                <button className="btn btn-primary btn-sm"
                  disabled={!filterUser}
                  title={!filterUser ? 'Seleccioná una integrante primero' : ''}
                  onClick={() => { setRegisterDate(today()); setRegCreditId(''); setRegCreditAmt(''); setRegisterModal(true) }}>
                  Registrar reintegro
                </button>
              ) : (
                <button className="btn btn-primary btn-sm" disabled={creating} onClick={createBundle}>
                  {creating ? 'Enviando...' : 'Solicitar reintegro'}
                </button>
              )}
            </div>
          )}

          {pendingExpenses.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">✅</div>Sin gastos pendientes de reintegro.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>
                      <input type="checkbox"
                        checked={selected.size === pendingExpenses.length && pendingExpenses.length > 0}
                        onChange={e => setSelected(e.target.checked ? new Set(pendingExpenses.map(x => x.id)) : new Set())} />
                    </th>
                    <th>Fecha</th>
                    <th>Descripción</th>
                    <th>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingExpenses.map(exp => (
                    <tr key={exp.id} onClick={() => toggleSelect(exp.id)}
                      style={{ cursor: 'pointer', background: selected.has(exp.id) ? 'var(--ocean-mist)' : undefined }}>
                      <td onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(exp.id)} onChange={() => toggleSelect(exp.id)} />
                      </td>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--ink-light)', fontSize: 12 }}>{fmtDate(exp.expense_date)}</td>
                      <td style={{ fontWeight: 500 }}>
                        {exp.description}
                        {exp.notes && <div style={{ fontSize: 11, color: 'var(--ink-faint)', fontWeight: 400 }}>{exp.notes}</div>}
                      </td>
                      <td><span className="amount-neg">{fmt(exp.amount, exp.currency)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Solicitudes (admin y member) ── */}
      {tab === 'solicitudes' && (
        <div>
          {pendingBundles.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">✅</div>Sin solicitudes pendientes.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {pendingBundles.map(bundle => {
                const bundleExps = expenses.filter(e => e.reimbursement_id === bundle.id)
                const isExpanded = expanded === bundle.id
                const appliedAmt = creditApps.filter(a => a.reimbursement_id === bundle.id).reduce((s, a) => s + Number(a.amount), 0)
                return (
                  <div key={bundle.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {isAdmin && <div style={{ fontWeight: 600, fontSize: 14 }}>{userName(bundle.user_id)}</div>}
                        <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: isAdmin ? 2 : 0 }}>
                          Solicitado el {fmtDate(bundle.created_at)}
                          {bundle.notes && <span style={{ marginLeft: 8, fontStyle: 'italic' }}>· {bundle.notes}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {bundle.total_uyu > 0 && <span className="amount-neg">{fmt(bundle.total_uyu, 'UYU')}</span>}
                        {bundle.total_usd > 0 && <span className="amount-neg">{fmt(bundle.total_usd, 'USD')}</span>}
                        <span className="tag tag-amber">⏳ Pendiente</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(isExpanded ? null : bundle.id)}>
                          {isExpanded ? '▲ Ocultar' : `▼ Ver gastos (${bundleExps.length})`}
                        </button>
                        {isAdmin && (
                          <button className="btn btn-primary btn-sm"
                            onClick={() => { setPayModal(bundle); setPayDate(today()); setPayCreditId(''); setPayCreditAmt('') }}>
                            Pagar
                          </button>
                        )}
                        {!isAdmin && (
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-mid)' }} onClick={() => cancelBundle(bundle)}>
                            Retirar
                          </button>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ borderTop: '1px solid var(--border)', padding: '0 16px 12px' }}>
                        {isAdmin && (
                          <div style={{ padding: '10px 0 6px', fontSize: 12, color: 'var(--ink-light)' }}>
                            Cuenta bancaria: {(bankAccounts[bundle.user_id] || []).length > 0
                              ? (bankAccounts[bundle.user_id] || []).map(b => `${b.bank} ${b.account} (${b.currency})`).join(' · ')
                              : <span style={{ color: 'var(--red-mid)' }}>Sin cuenta registrada</span>}
                          </div>
                        )}
                        <table style={{ fontSize: 13 }}>
                          <thead>
                            <tr>
                              <th>Fecha</th>
                              <th>Descripción</th>
                              <th>Monto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bundleExps.map(exp => (
                              <tr key={exp.id}>
                                <td style={{ color: 'var(--ink-light)', whiteSpace: 'nowrap' }}>{fmtDate(exp.expense_date)}</td>
                                <td>{exp.description}</td>
                                <td><span className="amount-neg">{fmt(exp.amount, exp.currency)}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Historial ── */}
      {tab === 'historial' && (
        <div>
          {paidBundles.length === 0 ? (
            <div className="empty-state">Sin reintegros pagados todavía.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {paidBundles.map(bundle => {
                const bundleExps = expenses.filter(e => e.reimbursement_id === bundle.id)
                const isExpanded = expanded === bundle.id
                const applied = creditApps.filter(a => a.reimbursement_id === bundle.id).reduce((s, a) => s + Number(a.amount), 0)
                return (
                  <div key={bundle.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {isAdmin && <div style={{ fontWeight: 600, fontSize: 14 }}>{userName(bundle.user_id)}</div>}
                        <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 2 }}>
                          Pagado el {fmtDate(bundle.paid_at)}
                          {isAdmin && bundle.paid_by && ` por ${userName(bundle.paid_by)}`}
                          {applied > 0 && <span style={{ marginLeft: 8, color: 'var(--teal-deep)' }}>· {fmt(applied, 'UYU')} de crédito aplicado</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {bundle.total_uyu > 0 && <span style={{ fontWeight: 500 }}>{fmt(bundle.total_uyu, 'UYU')}</span>}
                        {bundle.total_usd > 0 && <span style={{ fontWeight: 500 }}>{fmt(bundle.total_usd, 'USD')}</span>}
                        <span className="tag tag-teal">✓ Pagado</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(isExpanded ? null : bundle.id)}>
                          {isExpanded ? '▲ Ocultar' : `▼ Ver (${bundleExps.length})`}
                        </button>
                        {isAdmin && (
                          <button className="btn btn-ghost btn-sm" onClick={() => undoPay(bundle)}>Deshacer</button>
                        )}
                      </div>
                    </div>
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid var(--border)', padding: '0 16px 12px' }}>
                        <table style={{ fontSize: 13 }}>
                          <thead><tr><th>Fecha</th><th>Descripción</th><th>Monto</th></tr></thead>
                          <tbody>
                            {bundleExps.map(exp => (
                              <tr key={exp.id}>
                                <td style={{ color: 'var(--ink-light)', whiteSpace: 'nowrap' }}>{fmtDate(exp.expense_date)}</td>
                                <td>{exp.description}</td>
                                <td>{fmt(exp.amount, exp.currency)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Créditos ── */}
      {tab === 'creditos' && (
        <div>
          {myCredits.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💳</div>
              {isAdmin ? 'Sin créditos registrados.' : 'No tenés créditos ni adelantos.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {myCredits.map(c => {
                const used = Number(c.amount) - Number(c.remaining)
                const pct = Number(c.amount) > 0 ? (used / Number(c.amount)) * 100 : 0
                return (
                  <div key={c.id} className="card">
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {isAdmin && <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{userName(c.user_id)}</div>}
                        <div style={{ fontWeight: 500 }}>{c.description || 'Adelanto'}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 2 }}>{fmtDate(c.created_at)}</div>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: 120 }}>
                        <div style={{ fontSize: 18, fontWeight: 300 }}>{fmt(c.remaining, c.currency)}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>disponible de {fmt(c.amount, c.currency)}</div>
                      </div>
                    </div>
                    <div className="progress-bar" style={{ marginTop: 10 }}>
                      <div className="progress-fill" style={{ width: `${pct}%`, background: pct >= 90 ? 'var(--teal-bright)' : 'var(--ocean-light)' }} />
                    </div>
                    {used > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 4 }}>
                        {fmt(used, c.currency)} utilizado
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: Pagar bundle ── */}
      {payModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setPayModal(null)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <div className="modal-title">Confirmar pago</div>
              <button className="modal-close" onClick={() => setPayModal(null)}>✕</button>
            </div>

            <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
              <div style={{ fontWeight: 600 }}>{userName(payModal.user_id)}</div>
              <div style={{ color: 'var(--ink-light)', marginTop: 2 }}>
                {payModal.total_uyu > 0 && <span>{fmt(payModal.total_uyu, 'UYU')} </span>}
                {payModal.total_usd > 0 && <span>{fmt(payModal.total_usd, 'USD')}</span>}
                {' · '}{expenses.filter(e => e.reimbursement_id === payModal.id).length} gastos
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Fecha de pago</label>
              <input className="form-control" type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
            </div>

            {userCredits.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-mid)', marginBottom: 10 }}>Aplicar crédito / adelanto (opcional)</div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Crédito</label>
                    <select className="form-control" value={payCreditId} onChange={e => { setPayCreditId(e.target.value); setPayCreditAmt('') }}>
                      <option value="">Sin crédito</option>
                      {userCredits.map(c => (
                        <option key={c.id} value={c.id}>{c.description || 'Adelanto'} · {fmt(c.remaining, c.currency)} disp.</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Monto a descontar</label>
                    <input className="form-control" type="number" step="0.01" value={payCreditAmt}
                      onChange={e => setPayCreditAmt(e.target.value)}
                      disabled={!payCreditId}
                      max={payCreditId ? credits.find(c => c.id === payCreditId)?.remaining : undefined}
                      placeholder="0.00" />
                  </div>
                </div>
                {payCreditId && payCreditAmt > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--teal-deep)', background: 'var(--teal-mist)', padding: '6px 10px', borderRadius: 6 }}>
                    Se descontarán {fmt(payCreditAmt, credits.find(c => c.id === payCreditId)?.currency)} del crédito seleccionado.
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setPayModal(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={paying || !payDate} onClick={payBundle}>
                {paying ? 'Guardando...' : 'Confirmar pago'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Registrar reintegro (admin crea + paga de una) ── */}
      {registerModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setRegisterModal(false)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <div className="modal-title">Registrar reintegro</div>
              <button className="modal-close" onClick={() => setRegisterModal(false)}>✕</button>
            </div>

            <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
              <div style={{ fontWeight: 600 }}>{userName(filterUser)}</div>
              <div style={{ color: 'var(--ink-light)', marginTop: 2 }}>
                {selUYU > 0 && <span>{fmt(selUYU, 'UYU')} </span>}
                {selUSD > 0 && <span>{fmt(selUSD, 'USD')}</span>}
                {' · '}{selected.size} gasto{selected.size !== 1 ? 's' : ''}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Fecha de pago</label>
              <input className="form-control" type="date" value={registerDate} onChange={e => setRegisterDate(e.target.value)} />
            </div>

            {credits.filter(c => c.user_id === filterUser && Number(c.remaining) > 0).length > 0 && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-mid)', marginBottom: 10 }}>Aplicar crédito / adelanto (opcional)</div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Crédito</label>
                    <select className="form-control" value={regCreditId} onChange={e => { setRegCreditId(e.target.value); setRegCreditAmt('') }}>
                      <option value="">Sin crédito</option>
                      {credits.filter(c => c.user_id === filterUser && Number(c.remaining) > 0).map(c => (
                        <option key={c.id} value={c.id}>{c.description || 'Adelanto'} · {fmt(c.remaining, c.currency)} disp.</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Monto a descontar</label>
                    <input className="form-control" type="number" step="0.01" value={regCreditAmt}
                      onChange={e => setRegCreditAmt(e.target.value)} disabled={!regCreditId} placeholder="0.00"
                      max={regCreditId ? credits.find(c => c.id === regCreditId)?.remaining : undefined} />
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setRegisterModal(false)}>Cancelar</button>
              <button className="btn btn-primary" disabled={registering || !registerDate} onClick={registerAndPay}>
                {registering ? 'Guardando...' : 'Confirmar reintegro'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Nuevo crédito ── */}
      {creditModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setCreditModal(false)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div className="modal-title">Agregar crédito / adelanto</div>
              <button className="modal-close" onClick={() => setCreditModal(false)}>✕</button>
            </div>
            <form onSubmit={saveCredit}>
              <div className="form-group">
                <label className="form-label">Integrante *</label>
                <select className="form-control" value={creditForm.user_id}
                  onChange={e => setCreditForm(f => ({ ...f, user_id: e.target.value }))} required>
                  <option value="">Seleccionar...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Monto *</label>
                  <input className="form-control" type="number" step="0.01" value={creditForm.amount}
                    onChange={e => setCreditForm(f => ({ ...f, amount: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Moneda</label>
                  <select className="form-control" value={creditForm.currency}
                    onChange={e => setCreditForm(f => ({ ...f, currency: e.target.value }))}>
                    <option value="UYU">UYU</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Descripción</label>
                <input className="form-control" value={creditForm.description}
                  onChange={e => setCreditForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Ej: Adelanto junio 2026" />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setCreditModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={savingCredit}>
                  {savingCredit ? 'Guardando...' : 'Registrar crédito'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
