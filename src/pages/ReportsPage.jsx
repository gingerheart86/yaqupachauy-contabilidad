import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import * as XLSX from 'xlsx'

export default function ReportsPage() {
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
  const [form, setForm] = useState({
    type: 'project', // project | user | all
    project_id: '', user_id: '',
    date_from: '', date_to: '',
  })
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    async function load() {
      const [{ data: proj }, { data: u }] = await Promise.all([
        supabase.from('projects').select('id, name').order('name'),
        supabase.from('profiles').select('id, full_name').order('full_name'),
      ])
      setProjects(proj || [])
      setUsers(u || [])
    }
    load()
  }, [])

  async function runQuery() {
    setLoading(true)
    let q = supabase.from('expenses')
      .select('*, project:projects(name), category:categories(name, icon), user:profiles(full_name)')
      .order('expense_date', { ascending: false })

    if (form.type === 'project' && form.project_id) q = q.eq('project_id', form.project_id)
    if (form.type === 'user' && form.user_id) q = q.eq('user_id', form.user_id)
    if (form.date_from) q = q.gte('expense_date', form.date_from)
    if (form.date_to) q = q.lte('expense_date', form.date_to)

    const { data } = await q
    setPreview(data || [])
    setLoading(false)
    return data || []
  }

  async function exportExcel() {
    const data = await runQuery()
    if (!data.length) { alert('No hay datos para exportar.'); return }

    const rows = data.map(e => ({
      'Fecha': format(new Date(e.expense_date + 'T00:00:00'), 'dd/MM/yyyy'),
      'Descripción': e.description,
      'Categoría': e.category?.name,
      'Proyecto': e.project?.name,
      'Registrado por': e.user?.full_name,
      'Monto': Number(e.amount),
      'Moneda': e.currency,
      'Tipo de pago': e.payment_type === 'personal' ? 'Personal (reintegro)' : 'Institucional',
      'Reintegrado': e.payment_type === 'personal' ? (e.reimbursed ? 'Sí' : 'No') : '—',
      'Comprobante': e.receipt_url ? 'Sí' : 'No',
      'Notas': e.notes || '',
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    // Ancho de columnas
    ws['!cols'] = [10,30,20,28,20,12,8,18,12,12,30].map(w => ({ wch: w }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Gastos')

    // Hoja de resumen
    const usd = data.filter(e => e.currency === 'USD').reduce((s, e) => s + Number(e.amount), 0)
    const uyu = data.filter(e => e.currency === 'UYU').reduce((s, e) => s + Number(e.amount), 0)
    const summary = [
      ['Reporte Yaqupachauy'],
      ['Generado', format(new Date(), 'dd/MM/yyyy HH:mm')],
      [],
      ['Total USD', usd],
      ['Total UYU', uyu],
      ['Cantidad de gastos', data.length],
    ]
    const ws2 = XLSX.utils.aoa_to_sheet(summary)
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumen')

    const filename = `yaqupachauy_gastos_${format(new Date(), 'yyyyMMdd')}.xlsx`
    XLSX.writeFile(wb, filename)
  }

  function fmtRow(amount, currency) {
    if (currency === 'USD') return `U$D ${Number(amount).toLocaleString('es-UY', { minimumFractionDigits: 2 })}`
    return `$U ${Number(amount).toLocaleString('es-UY', { minimumFractionDigits: 2 })}`
  }

  const totalUSD = (preview || []).filter(e => e.currency === 'USD').reduce((s, e) => s + Number(e.amount), 0)
  const totalUYU = (preview || []).filter(e => e.currency === 'UYU').reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Reportes</div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
            <label className="form-label">Tipo de reporte</label>
            <select className="form-control" value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="all">Todos los gastos</option>
              <option value="project">Por proyecto</option>
              <option value="user">Por usuario</option>
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
              <label className="form-label">Usuario</label>
              <select className="form-control" value={form.user_id}
                onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))}>
                <option value="">Todos</option>
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
          {(totalUSD > 0 || totalUYU > 0) && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
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
                <div className="metric-value">{preview.length}</div>
              </div>
            </div>
          )}

          <div className="table-wrap">
            {preview.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">🔍</div>No hay gastos para los filtros seleccionados.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Descripción</th>
                    <th>Categoría</th>
                    <th>Proyecto</th>
                    <th>Usuario</th>
                    <th>Monto</th>
                    <th>Tipo pago</th>
                    <th>Comprobante</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map(exp => (
                    <tr key={exp.id}>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--ink-light)' }}>
                        {format(new Date(exp.expense_date + 'T00:00:00'), 'd MMM yyyy', { locale: es })}
                      </td>
                      <td style={{ fontWeight: 500, color: 'var(--ink)' }}>{exp.description}</td>
                      <td><span className="tag tag-gray">{exp.category?.icon} {exp.category?.name}</span></td>
                      <td><span className="tag tag-blue">{exp.project?.name}</span></td>
                      <td style={{ color: 'var(--ink-light)' }}>{exp.user?.full_name}</td>
                      <td>
                        <span className="amount-neg">{fmtRow(exp.amount, exp.currency)}</span>
                      </td>
                      <td>
                        {exp.payment_type === 'personal'
                          ? <span className="tag tag-amber">💳 Personal</span>
                          : <span className="tag tag-teal">🏦 Institucional</span>}
                      </td>
                      <td>
                        {exp.receipt_url
                          ? <a href={exp.receipt_url} target="_blank" rel="noreferrer">📎</a>
                          : <span style={{ fontSize: 11, color: 'var(--red-mid)' }}>⚠ sin comp.</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}