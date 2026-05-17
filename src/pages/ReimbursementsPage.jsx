import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

function fmt(amount, currency) {
  if (currency === 'USD') return `U$D ${Number(amount).toLocaleString('es-UY', { minimumFractionDigits: 2 })}`
  return `$U ${Number(amount).toLocaleString('es-UY', { minimumFractionDigits: 2 })}`
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function ReimbursementsPage() {
  const { user, profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const [expenses, setExpenses] = useState([])
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
  const [bankAccounts, setBankAccounts] = useState({})
  const [loading, setLoading] = useState(true)

  const [filter, setFilter] = useState('pending') // pending | done | all
  const [filterUser, setFilterUser] = useState('')  // user_id or ''

  const [reimburseModal, setReimburseModal] = useState(null) // expense object
  const [reimburseDate, setReimburseDate] = useState(today())
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: exp }, { data: banks }, { data: proj }, { data: userList }] = await Promise.all([
      supabase.from('expenses').select('*').eq('payment_type', 'personal').order('expense_date', { ascending: false }),
      supabase.from('bank_accounts').select('*'),
      supabase.from('projects').select('id, name'),
      supabase.from('profiles').select('id, full_name'),
    ])

    setExpenses(exp || [])
    setProjects(proj || [])
    setUsers(userList || [])

    const byUser = {}
    ;(banks || []).forEach(b => {
      if (!byUser[b.user_id]) byUser[b.user_id] = []
      byUser[b.user_id].push(b)
    })
    setBankAccounts(byUser)
    setLoading(false)
  }

  function openReimburseModal(exp) {
    setReimburseDate(today())
    setReimburseModal(exp)
  }

  async function confirmReimbursement() {
    if (!reimburseModal) return
    setSaving(true)
    await supabase.from('expenses').update({
      reimbursed: true,
      reimbursed_at: reimburseDate,
      reimbursed_by: user.id,
    }).eq('id', reimburseModal.id)
    setSaving(false)
    setReimburseModal(null)
    loadData()
  }

  async function undoReimbursement(exp) {
    await supabase.from('expenses').update({
      reimbursed: false,
      reimbursed_at: null,
      reimbursed_by: null,
    }).eq('id', exp.id)
    loadData()
  }

  const userName = id => users.find(u => u.id === id)?.full_name ?? '—'
  const projectName = id => projects.find(p => p.id === id)?.name ?? '—'

  const base = expenses
    .filter(e => isAdmin || e.user_id === user.id)
    .filter(e => !filterUser || e.user_id === filterUser)

  const pending = base
    .filter(e => !e.reimbursed)
    .sort((a, b) => (b.expense_date ?? '').localeCompare(a.expense_date ?? ''))

  const done = base
    .filter(e => e.reimbursed)
    .sort((a, b) => (b.reimbursed_at ?? '').localeCompare(a.reimbursed_at ?? ''))

  const filtered = filter === 'pending' ? pending : filter === 'done' ? done : [...pending, ...done]

  const pendingUSD = pending.filter(e => e.currency === 'USD').reduce((s, e) => s + Number(e.amount), 0)
  const pendingUYU = pending.filter(e => e.currency === 'UYU').reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Reintegros</div>
      </div>

      {(pendingUSD > 0 || pendingUYU > 0) && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {pendingUSD > 0 && (
            <div className="metric-card" style={{ flex: 1 }}>
              <div className="metric-label">Pendiente USD</div>
              <div className="metric-value" style={{ color: 'var(--red-mid)' }}>{fmt(pendingUSD, 'USD')}</div>
            </div>
          )}
          {pendingUYU > 0 && (
            <div className="metric-card" style={{ flex: 1 }}>
              <div className="metric-label">Pendiente UYU</div>
              <div className="metric-value" style={{ color: 'var(--red-mid)' }}>{fmt(pendingUYU, 'UYU')}</div>
            </div>
          )}
        </div>
      )}

      <div className="filter-row" style={{ flexWrap: 'wrap', gap: 8 }}>
        {['pending', 'done', 'all'].map(v => (
          <button key={v} className={`btn btn-sm ${filter === v ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(v)}>
            {{ pending: 'Pendientes', done: 'Reintegrados', all: 'Todos' }[v]}
          </button>
        ))}
        {isAdmin && users.length > 0 && (
          <select className="form-control" style={{ fontSize: 13, padding: '4px 8px', minWidth: 160, marginLeft: 'auto' }}
            value={filterUser} onChange={e => setFilterUser(e.target.value)}>
            <option value="">Todas las integrantes</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        )}
      </div>

      <div className="table-wrap">
        {loading ? <div className="empty-state">Cargando...</div>
          : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✅</div>
              {filter === 'pending' ? '¡Sin reintegros pendientes!' : 'No hay registros.'}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Fecha gasto</th>
                  <th>Descripción</th>
                  <th>Proyecto</th>
                  {isAdmin && <th>Integrante</th>}
                  <th>Monto</th>
                  {isAdmin && <th>Cuenta bancaria</th>}
                  <th>Estado</th>
                  {isAdmin && <th>Acción</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(exp => (
                  <tr key={exp.id}>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--ink-light)' }}>
                      {exp.expense_date
                        ? format(new Date(exp.expense_date + 'T00:00:00'), 'd MMM yyyy', { locale: es })
                        : '—'}
                    </td>
                    <td style={{ fontWeight: 500, color: 'var(--ink)' }}>
                      {exp.description}
                      {exp.notes && <div style={{ fontSize: 11, color: 'var(--ink-light)', fontWeight: 400 }}>{exp.notes}</div>}
                    </td>
                    <td><span className="tag tag-blue">{projectName(exp.project_id)}</span></td>
                    {isAdmin && <td style={{ color: 'var(--ink-light)' }}>{userName(exp.user_id)}</td>}
                    <td>
                      <span className="amount-neg">{fmt(exp.amount, exp.currency)}</span>
                    </td>
                    {isAdmin && (
                      <td>
                        {(bankAccounts[exp.user_id] || [])
                          .filter(b => b.currency === exp.currency)
                          .map(b => (
                            <div key={b.id} style={{ fontSize: 12, lineHeight: 1.5 }}>
                              <span style={{ fontWeight: 500 }}>{b.bank}</span>
                              <br />
                              <span style={{ color: 'var(--ink-light)' }}>{b.account} · {b.holder}</span>
                            </div>
                          ))
                        }
                        {!(bankAccounts[exp.user_id] || []).some(b => b.currency === exp.currency) && (
                          <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Sin cuenta {exp.currency}</span>
                        )}
                      </td>
                    )}
                    <td>
                      {exp.reimbursed
                        ? (
                          <div>
                            <span className="tag tag-teal">✓ Reintegrado</span>
                            {exp.reimbursed_at && (
                              <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 2 }}>
                                {format(new Date(exp.reimbursed_at), 'd MMM yyyy', { locale: es })}
                                {exp.reimbursed_by && ` · ${userName(exp.reimbursed_by)}`}
                              </div>
                            )}
                          </div>
                        )
                        : <span className="tag tag-amber">⏳ Pendiente</span>
                      }
                    </td>
                    {isAdmin && (
                      <td>
                        {!exp.reimbursed
                          ? <button className="btn btn-sm btn-primary" onClick={() => openReimburseModal(exp)}>Reintegrar</button>
                          : <button className="btn btn-sm btn-ghost" onClick={() => undoReimbursement(exp)}>Deshacer</button>
                        }
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>

      {reimburseModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setReimburseModal(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <div className="modal-title">Confirmar reintegro</div>
              <button className="modal-close" onClick={() => setReimburseModal(null)}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-light)', marginBottom: 16 }}>
              <strong style={{ color: 'var(--ink)' }}>{reimburseModal.description}</strong>
              <br />
              {fmt(reimburseModal.amount, reimburseModal.currency)} · {userName(reimburseModal.user_id)}
            </div>
            <div className="form-group">
              <label className="form-label">Fecha de reintegro</label>
              <input className="form-control" type="date" value={reimburseDate}
                onChange={e => setReimburseDate(e.target.value)} required />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setReimburseModal(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={saving || !reimburseDate}
                onClick={confirmReimbursement}>
                {saving ? 'Guardando...' : 'Confirmar reintegro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
