import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

function fmt(amount, currency) {
  if (currency === 'USD') return `U$D ${Number(amount).toLocaleString('es-UY', { minimumFractionDigits: 2 })}`
  return `$U ${Number(amount).toLocaleString('es-UY', { minimumFractionDigits: 2 })}`
}

export default function Dashboard() {
  const { profile } = useAuth()
  const [expenses, setExpenses] = useState([])
  const [metrics, setMetrics] = useState({ thisMonth: { USD: 0, UYU: 0 }, pendingReimbursement: { USD: 0, UYU: 0 }, receiptsTotal: 0, receiptsMissing: 0, activeProjects: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)

      // Últimos 10 gastos
      const { data: recentExpenses } = await supabase
        .from('expenses')
        .select('*, project:projects(name), category:categories(name, icon), user:profiles(full_name)')
        .order('expense_date', { ascending: false })
        .limit(10)

      // Gastos de este mes
      const { data: monthExpenses } = await supabase
        .from('expenses')
        .select('amount, currency')
        .gte('expense_date', monthStart)

      // Pendientes de reintegro
      const { data: pendingReimb } = await supabase
        .from('expenses')
        .select('amount, currency')
        .eq('payment_type', 'personal')
        .eq('reimbursed', false)

      // Facturas
      const { data: receiptData } = await supabase
        .from('expenses')
        .select('receipt_url')

      // Proyectos activos
      const { count: activeProjects } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('active', true)

      const thisMonth = { USD: 0, UYU: 0 };
      (monthExpenses || []).forEach(e => { thisMonth[e.currency] = (thisMonth[e.currency] || 0) + Number(e.amount) })

      const pendingReimbursement = { USD: 0, UYU: 0 };
      (pendingReimb || []).forEach(e => { pendingReimbursement[e.currency] = (pendingReimbursement[e.currency] || 0) + Number(e.amount) })

      const receiptsTotal = receiptData?.length ?? 0
      const receiptsMissing = receiptData?.filter(e => !e.receipt_url).length ?? 0

      setExpenses(recentExpenses || [])
      setMetrics({ thisMonth, pendingReimbursement, receiptsTotal, receiptsMissing, activeProjects: activeProjects ?? 0 })
      setLoading(false)
    }
    load()
  }, [])

  const monthName = format(new Date(), 'MMMM yyyy', { locale: es })

  if (loading) return <div className="empty-state"><div className="empty-icon">🌊</div>Cargando...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Bienvenida, {profile?.full_name?.split(' ')[0]} 👋</div>
          <div style={{ fontSize: 13, color: 'var(--ink-light)', marginTop: 2, textTransform: 'capitalize' }}>{monthName}</div>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-label">Gastos este mes</div>
          {metrics.thisMonth.USD > 0 && <div className="metric-value" style={{ fontSize: 20 }}>{fmt(metrics.thisMonth.USD, 'USD')}</div>}
          {metrics.thisMonth.UYU > 0 && <div className="metric-value" style={{ fontSize: 20 }}>{fmt(metrics.thisMonth.UYU, 'UYU')}</div>}
          {metrics.thisMonth.USD === 0 && metrics.thisMonth.UYU === 0 && <div className="metric-value">$0</div>}
        </div>
        <div className="metric-card">
          <div className="metric-label">Pendiente de reintegro</div>
          {metrics.pendingReimbursement.USD > 0 && <div className="metric-value" style={{ fontSize: 20, color: 'var(--red-mid)' }}>{fmt(metrics.pendingReimbursement.USD, 'USD')}</div>}
          {metrics.pendingReimbursement.UYU > 0 && <div className="metric-value" style={{ fontSize: 20, color: 'var(--red-mid)' }}>{fmt(metrics.pendingReimbursement.UYU, 'UYU')}</div>}
          {metrics.pendingReimbursement.USD === 0 && metrics.pendingReimbursement.UYU === 0 && <div className="metric-value" style={{ color: 'var(--teal-bright)' }}>$0 ✓</div>}
        </div>
        <div className="metric-card">
          <div className="metric-label">Facturas cargadas</div>
          <div className="metric-value">{metrics.receiptsTotal}</div>
          {metrics.receiptsMissing > 0 && <div className="metric-sub" style={{ color: 'var(--red-mid)' }}>⚠ {metrics.receiptsMissing} sin comprobante</div>}
        </div>
        <div className="metric-card">
          <div className="metric-label">Proyectos activos</div>
          <div className="metric-value">{metrics.activeProjects}</div>
        </div>
      </div>

      <div className="page-header" style={{ marginBottom: 12 }}>
        <div className="page-title" style={{ fontSize: 16 }}>Últimos gastos</div>
      </div>

      <div className="table-wrap">
        {expenses.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">🐬</div>No hay gastos registrados todavía.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Categoría</th>
                <th>Proyecto</th>
                <th>Registrado por</th>
                <th>Monto</th>
                <th>Comprobante</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(exp => (
                <tr key={exp.id}>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--ink-light)' }}>
                    {format(new Date(exp.expense_date + 'T00:00:00'), 'd MMM', { locale: es })}
                  </td>
                  <td style={{ fontWeight: 500, color: 'var(--ink)' }}>{exp.description}</td>
                  <td>
                    <span className="tag tag-gray">{exp.category?.icon} {exp.category?.name}</span>
                  </td>
                  <td>
                    <span className="tag tag-blue">{exp.project?.name}</span>
                  </td>
                  <td style={{ color: 'var(--ink-light)' }}>{exp.user?.full_name}</td>
                  <td>
                    <span className="amount-neg">{fmt(exp.amount, exp.currency)}</span>
                    {' '}
                    <span className={exp.currency === 'USD' ? 'currency-usd' : 'currency-uyu'}>{exp.currency}</span>
                  </td>
                  <td>
                    {exp.receipt_url
                      ? <a href={exp.receipt_url} target="_blank" rel="noreferrer" title="Ver comprobante">📎</a>
                      : <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>sin comp.</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
