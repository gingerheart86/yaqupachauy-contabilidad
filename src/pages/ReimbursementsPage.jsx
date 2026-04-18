import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

function fmt(amount, currency) {
  if (currency === 'USD') return `U$D ${Number(amount).toLocaleString('es-UY', { minimumFractionDigits: 2 })}`
  return `$U ${Number(amount).toLocaleString('es-UY', { minimumFractionDigits: 2 })}`
}

export default function ReimbursementsPage() {
  const { user, profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending') // pending | done | all

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data } = await supabase
      .from('expenses')
      .select('*, project:projects(name), category:categories(name, icon), user:profiles(full_name), reimburser:profiles!expenses_reimbursed_by_fkey(full_name)')
      .eq('payment_type', 'personal')
      .order('expense_date', { ascending: false })
    setExpenses(data || [])
    setLoading(false)
  }

  async function markReimbursed(exp) {
    await supabase.from('expenses').update({
      reimbursed: true,
      reimbursed_at: new Date().toISOString(),
      reimbursed_by: user.id,
    }).eq('id', exp.id)
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

  const filtered = expenses.filter(e => {
    if (filter === 'pending') return !e.reimbursed
    if (filter === 'done') return e.reimbursed
    return true
  }).filter(e => isAdmin || e.user_id === user.id)

  // Totals pending
  const pending = expenses.filter(e => !e.reimbursed && (isAdmin || e.user_id === user.id))
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
              <div className="metric-label">Pendiente de reintegro USD</div>
              <div className="metric-value" style={{ color: 'var(--red-mid)' }}>{fmt(pendingUSD, 'USD')}</div>
            </div>
          )}
          {pendingUYU > 0 && (
            <div className="metric-card" style={{ flex: 1 }}>
              <div className="metric-label">Pendiente de reintegro UYU</div>
              <div className="metric-value" style={{ color: 'var(--red-mid)' }}>{fmt(pendingUYU, 'UYU')}</div>
            </div>
          )}
        </div>
      )}

      <div className="filter-row">
        {['pending', 'done', 'all'].map(v => (
          <button key={v} className={`btn btn-sm ${filter === v ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(v)}>
            {{ pending: 'Pendientes', done: 'Reintegrados', all: 'Todos' }[v]}
          </button>
        ))}
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
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Proyecto</th>
                  {isAdmin && <th>Integrante</th>}
                  <th>Monto</th>
                  <th>Estado</th>
                  {isAdmin && <th>Acción</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(exp => (
                  <tr key={exp.id}>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--ink-light)' }}>
                      {format(new Date(exp.expense_date + 'T00:00:00'), 'd MMM yyyy', { locale: es })}
                    </td>
                    <td style={{ fontWeight: 500, color: 'var(--ink)' }}>
                      {exp.description}
                      {exp.notes && <div style={{ fontSize: 11, color: 'var(--ink-light)', fontWeight: 400 }}>{exp.notes}</div>}
                    </td>
                    <td><span className="tag tag-blue">{exp.project?.name}</span></td>
                    {isAdmin && <td style={{ color: 'var(--ink-light)' }}>{exp.user?.full_name}</td>}
                    <td>
                      <span className="amount-neg">{fmt(exp.amount, exp.currency)}</span>
                    </td>
                    <td>
                      {exp.reimbursed
                        ? (
                          <div>
                            <span className="tag tag-teal">✓ Reintegrado</span>
                            {exp.reimbursed_at && (
                              <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 2 }}>
                                {format(new Date(exp.reimbursed_at), 'd MMM yyyy', { locale: es })}
                                {exp.reimburser?.full_name && ` · ${exp.reimburser.full_name}`}
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
                          ? <button className="btn btn-sm btn-primary" onClick={() => markReimbursed(exp)}>Marcar reintegrado</button>
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
    </div>
  )
}
