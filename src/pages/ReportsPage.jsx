import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import * as XLSX from 'xlsx'

function fmtRow(amount, currency) {
  if (currency === 'USD') return `U$D ${Number(amount).toLocaleString('es-UY', { minimumFractionDigits: 2 })}`
  return `$U ${Number(amount).toLocaleString('es-UY', { minimumFractionDigits: 2 })}`
}

function reimburseStatus(exp) {
  if (exp.payment_type === 'institutional') return 'not_reimbursable'
  if (exp.reimbursed) return 'reimbursed'
  return 'pending'
}

export default function ReportsPage() {
  const [projects, setProjects] = useState([])
  const [categories, setCategories] = useState([])
  const [users, setUsers] = useState([])
  const [form, setForm] = useState({
    type: 'all',
    project_id: '', user_id: '',
    date_from: '', date_to: '',
  })
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(null)

  // client-side filters & sort applied on preview
  const [reimburseFilter, setReimburseFilter] = useState('all') // all | pending | reimbursed | not_reimbursable
  const [sortDir, setSortDir] = useState('desc') // asc | desc

  useEffect(() => {
    async function load() {
      const [{ data: proj }, { data: u }, { data: cats }] = await Promise.all([
        supabase.from('projects').select('id, name').order('name'),
        supabase.from('profiles').select('id, full_name').order('full_name'),
        supabase.from('categories').select('id, name, icon'),
      ])
      setProjects(proj || [])
      setUsers(u || [])
      setCategories(cats || [])
    }
    load()
  }, [])

  const projectName = id => projects.find(p => p.id === id)?.name ?? '—'
  const userName = id => users.find(u => u.id === id)?.full_name ?? '—'
  const category = id => categories.find(c => c.id === id)

  async function runQuery() {
    setLoading(true)
    let q = supabase.from('expenses').select('*')

    if (form.type === 'project' && form.project_id) q = q.eq('project_id', form.project_id)
    if (form.type === 'user' && form.user_id) q = q.eq('user_id', form.user_id)
    if (form.date_from) q = q.gte('expense_date', form.date_from)
    if (form.date_to) q = q.lte('expense_date', form.date_to)

    const { data, error } = await q
    if (error) console.error('report query error:', error)
    setPreview(data || [])
    setLoading(false)
    return data || []
  }

  // Apply client-side filters and sort to preview
  const filtered = (preview || [])
    .filter(e => reimburseFilter === 'all' || reimburseStatus(e) === reimburseFilter)
    .sort((a, b) => {
      const da = a.expense_date ?? ''
      const db = b.expense_date ?? ''
      return sortDir === 'desc' ? db.localeCompare(da) : da.localeCompare(db)
    })

  const totalUSD = filtered.filter(e => e.currency === 'USD').reduce((s, e) => s + Number(e.amount), 0)
  const totalUYU = filtered.filter(e => e.currency === 'UYU').reduce((s, e) => s + Number(e.amount), 0)

  async function exportExcel() {
    // Export the currently filtered view; if nothing loaded yet, fetch first
    let data = filtered
    if (preview === null) {
      data = await runQuery()
    }
    if (!data.length) { alert('No hay datos para exportar.'); return }

    const rows = data.map(e => {
      const cat = category(e.category_id)
      const status = reimburseStatus(e)
      return {
        'Fecha': e.expense_date ? format(new Date(e.expense_date + 'T00:00:00'), 'dd/MM/yyyy') : '',
        'Descripción': e.description,
        'Categoría': cat?.name ?? '—',
        'Proyecto': projectName(e.project_id),
        'Registrado por': userName(e.user_id),
        'Monto': Number(e.amount),
        'Moneda': e.currency,
        'Tipo de pago': e.payment_type === 'personal' ? 'Personal (reintegro)' : 'Institucional',
        'Estado reintegro': status === 'not_reimbursable' ? 'No reintegrable' : status === 'reimbursed' ? 'Reintegrado' : 'Pendiente',
        'Comprobante': e.receipt_url ? 'Sí' : 'No',
        'Notas': e.notes || '',
      }
    })

    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [10, 30, 20, 28, 20, 12, 8, 18, 16, 12, 30].map(w => ({ wch: w }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Gastos')

    const usd = data.filter(e => e.currency === 'USD').reduce((s, e) => s + Number(e.amount), 0)
    const uyu = data.filter(e => e.currency === 'UYU').reduce((s, e) => s + Number(e.amount), 0)
    const ws2 = XLSX.utils.aoa_to_sheet([
      ['Reporte Yaqupachauy'],
      ['Generado', format(new Date(), 'dd/MM/yyyy HH:mm')],
      [],
      ['Total USD', usd],
      ['Total UYU', uyu],
      ['Cantidad de gastos', data.length],
    ])
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumen')

    XLSX.writeFile(wb, `yaqupachauy_gastos_${format(new Date(), 'yyyyMMdd')}.xlsx`)
  }

  const REIMBURSE_TABS = [
    { value: 'all', label: 'Todos' },
    { value: 'pending', label: '⏳ Pendiente' },
    { value: 'reimbursed', label: '✓ Reintegrado' },
    { value: 'not_reimbursable', label: '🏦 No reintegrable' },
  ]

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Reportes</div>
      </div>

      {/* Filtros de query */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
            <label className="form-label">Tipo de reporte</label>
            <select className="form-control" value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value, project_id: '', user_id: '' }))}>
              <option value="all">Todos los gastos</option>
              <option value="project">Por proyecto</option>
              <option value="user">Por usuaria</option>
            </select>
          </div>

          {form.type === 'project' && (
            <div className="form-group" style={{ marginBottom: 0, minWidth: 220 }}>
              <label className="form-label">Proyecto</label>
              <select className="form-control" value={form.project_id}
                onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}>
                <option value="">Todos los proyectos</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          {form.type === 'user' && (
            <div className="form-group" style={{ marginBottom: 0, minWidth: 180 }}>
              <label className="form-label">Usuaria</label>
              <select className="form-control" value={form.user_id}
                onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))}>
                <option value="">Todas</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Desde</label>
            <input className="form-control" type="date" value={form.date_from}
              onChange={e => setForm(f => ({ ...f, date_from: e.target.value }))} />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Hasta</label>
            <input className="form-control" type="date" value={form.date_to}
              onChange={e => setForm(f => ({ ...f, date_to: e.target.value }))} />
          </div>

          <button className="btn btn-secondary" onClick={runQuery} disabled={loading}>
            {loading ? 'Buscando...' : '🔍 Ver reporte'}
          </button>

          <button className="btn btn-primary" onClick={exportExcel} disabled={loading}>
            📥 Exportar Excel
          </button>
        </div>
      </div>

      {preview !== null && (
        <>
          {/* Filtro estado reintegro */}
          <div className="filter-row" style={{ marginBottom: 16 }}>
            {REIMBURSE_TABS.map(t => (
              <button key={t.value}
                className={`btn btn-sm ${reimburseFilter === t.value ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setReimburseFilter(t.value)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Métricas de la vista filtrada */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            {totalUSD > 0 && (
              <div className="metric-card">
                <div className="metric-label">Total USD</div>
                <div className="metric-value" style={{ fontSize: 20 }}>{fmtRow(totalUSD, 'USD')}</div>
              </div>
            )}
            {totalUYU > 0 && (
              <div className="metric-card">
                <div className="metric-label">Total UYU</div>
                <div className="metric-value" style={{ fontSize: 20 }}>{fmtRow(totalUYU, 'UYU')}</div>
              </div>
            )}
            <div className="metric-card">
              <div className="metric-label">Cantidad de gastos</div>
              <div className="metric-value">{filtered.length}</div>
            </div>
          </div>

          <div className="table-wrap">
            {filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                No hay gastos para los filtros seleccionados.
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th
                      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                      onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}>
                      Fecha {sortDir === 'desc' ? '↓' : '↑'}
                    </th>
                    <th>Descripción</th>
                    <th>Categoría</th>
                    <th>Proyecto</th>
                    <th>Usuaria</th>
                    <th>Monto</th>
                    <th>Reintegro</th>
                    <th>Comprobante</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(exp => {
                    const cat = category(exp.category_id)
                    const status = reimburseStatus(exp)
                    return (
                      <tr key={exp.id}>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--ink-light)' }}>
                          {exp.expense_date
                            ? format(new Date(exp.expense_date + 'T00:00:00'), 'd MMM yyyy', { locale: es })
                            : '—'}
                        </td>
                        <td style={{ fontWeight: 500, color: 'var(--ink)' }}>{exp.description}</td>
                        <td><span className="tag tag-gray">{cat?.icon} {cat?.name ?? '—'}</span></td>
                        <td><span className="tag tag-blue">{projectName(exp.project_id)}</span></td>
                        <td style={{ color: 'var(--ink-light)' }}>{userName(exp.user_id)}</td>
                        <td><span className="amount-neg">{fmtRow(exp.amount, exp.currency)}</span></td>
                        <td>
                          {status === 'not_reimbursable' && <span className="tag tag-teal">🏦 No reintegrable</span>}
                          {status === 'reimbursed' && <span className="tag tag-teal">✓ Reintegrado</span>}
                          {status === 'pending' && <span className="tag tag-amber">⏳ Pendiente</span>}
                        </td>
                        <td>
                          {exp.receipt_url
                            ? <a href={exp.receipt_url} target="_blank" rel="noreferrer">📎</a>
                            : <span style={{ fontSize: 11, color: 'var(--red-mid)' }}>⚠ sin comp.</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
