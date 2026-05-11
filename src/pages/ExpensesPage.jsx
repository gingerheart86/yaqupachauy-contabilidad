import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

function fmt(amount, currency) {
  if (currency === 'USD') return `U$D ${Number(amount).toLocaleString('es-UY', { minimumFractionDigits: 2 })}`
  return `$U ${Number(amount).toLocaleString('es-UY', { minimumFractionDigits: 2 })}`
}

const EMPTY_FORM = {
  description: '', amount: '', currency: 'USD',
  project_id: '', activity_id: '', category_id: '',
  expense_date: new Date().toISOString().slice(0, 10),
  payment_type: 'institutional', notes: '',
}

export default function ExpensesPage() {
  const { user, profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const [expenses, setExpenses] = useState([])
  const [projects, setProjects] = useState([])
  const [categories, setCategories] = useState([])
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [receipt, setReceipt] = useState(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [duplicateWarning, setDuplicateWarning] = useState(null)
  const [filterProject, setFilterProject] = useState('')
  const [filterUser, setFilterUser] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: exp }, { data: proj }, { data: cats }, { data: acts }] = await Promise.all([
      supabase.from('expenses')
        .select('*, project:projects(name), category:categories(name, icon), user:profiles(full_name)')
        .order('expense_date', { ascending: false }),
      supabase.from('projects').select('id, name').eq('active', true).order('name'),
      supabase.from('categories').select('*').order('name'),
      supabase.from('activities').select('id, name, project_id, category_id').eq('active', true).order('name'),
    ])
    setExpenses(exp || [])
    setProjects(proj || [])
    setCategories(cats || [])
    setActivities(acts || [])
    setLoading(false)
  }

  // Detección de duplicados: mismo monto + descripción similar + mismo proyecto en los últimos 7 días
  async function checkDuplicate(formData) {
    if (!formData.description || !formData.amount || !formData.project_id) return null
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    const { data } = await supabase
      .from('expenses')
      .select('id, description, expense_date, amount')
      .eq('project_id', formData.project_id)
      .eq('amount', parseFloat(formData.amount))
      .eq('currency', formData.currency)
      .gte('expense_date', sevenDaysAgo)
    if (data && data.length > 0) {
      const similar = data.find(e =>
        e.description.toLowerCase().includes(formData.description.toLowerCase().slice(0, 6)) ||
        formData.description.toLowerCase().includes(e.description.toLowerCase().slice(0, 6))
      )
      return similar || null
    }
    return null
  }

  function handleProjectChange(projectId) {
    setForm(f => ({ ...f, project_id: projectId, activity_id: '', category_id: '' }))
  }

  function handleActivityChange(activityId) {
    const act = activities.find(a => a.id === activityId)
    setForm(f => ({
      ...f,
      activity_id: activityId,
      category_id: act?.category_id ? String(act.category_id) : f.category_id,
    }))
  }

  function validate(f) {
    const e = {}
    if (!f.description.trim()) e.description = 'Requerido'
    if (!f.amount || isNaN(f.amount) || Number(f.amount) <= 0) e.amount = 'Ingresá un monto válido'
    if (!f.project_id) e.project_id = 'Seleccioná un proyecto'
    if (!f.category_id) e.category_id = 'Seleccioná una categoría'
    if (!f.expense_date) e.expense_date = 'Requerido'
    return e
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate(form)
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})

    // Check duplicate
    const dup = await checkDuplicate(form)
    if (dup && !duplicateWarning) {
      setDuplicateWarning(dup)
      return
    }
    setDuplicateWarning(null)
    await saveExpense()
  }

  async function saveExpense() {
    setSaving(true)
    let receipt_url = null
    let receipt_filename = null

    if (receipt) {
      const ext = receipt.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(path, receipt, { upsert: false })

      if (uploadError) {
        alert('Error al subir el comprobante: ' + uploadError.message)
        setSaving(false)
        return
      }

      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(path)
      receipt_url = publicUrl
      receipt_filename = receipt.name
    }

    const { error } = await supabase.from('expenses').insert({
      ...form,
      amount: parseFloat(form.amount),
      category_id: form.category_id ? parseInt(form.category_id) : null,
      activity_id: form.activity_id || null,
      user_id: user.id,
      receipt_url,
      receipt_filename,
    })

    if (error) { alert('Error al guardar: ' + error.message); setSaving(false); return }

    setSaving(false)
    setShowModal(false)
    setForm(EMPTY_FORM)
    setReceipt(null)
    loadData()
  }

  function openNew() {
    setForm(EMPTY_FORM)
    setErrors({})
    setDuplicateWarning(null)
    setReceipt(null)
    setShowModal(true)
  }

  const filtered = expenses.filter(e => {
    if (filterProject && e.project_id !== filterProject) return false
    if (filterUser && e.user_id !== filterUser) return false
    return true
  })

  // Unique users from expenses
  const users = [...new Map(expenses.map(e => [e.user_id, e.user])).entries()]
    .map(([id, u]) => ({ id, full_name: u?.full_name }))

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Gastos</div>
        <button className="btn btn-primary" onClick={openNew}>+ Nuevo gasto</button>
      </div>

      <div className="filter-row">
        <select className="form-control" value={filterProject} onChange={e => setFilterProject(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">Todos los proyectos</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {isAdmin && (
          <select className="form-control" value={filterUser} onChange={e => setFilterUser(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="">Todos los usuarios</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        )}
      </div>

      <div className="table-wrap">
        {loading ? (
          <div className="empty-state">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">🐋</div>No hay gastos registrados.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Categoría</th>
                <th>Proyecto</th>
                {isAdmin && <th>Usuario</th>}
                <th>Tipo de pago</th>
                <th>Monto</th>
                <th>Comprobante</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(exp => (
                <tr key={exp.id}>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--ink-light)' }}>
                    {format(new Date(exp.expense_date + 'T00:00:00'), 'd MMM yyyy', { locale: es })}
                  </td>
                  <td style={{ fontWeight: 500, color: 'var(--ink)' }}>{exp.description}</td>
                  <td><span className="tag tag-gray">{exp.category?.icon} {exp.category?.name}</span></td>
                  <td><span className="tag tag-blue">{exp.project?.name}</span></td>
                  {isAdmin && <td style={{ color: 'var(--ink-light)' }}>{exp.user?.full_name}</td>}
                  <td>
                    {exp.payment_type === 'personal'
                      ? <span className="tag tag-amber">💳 Personal</span>
                      : <span className="tag tag-teal">🏦 Institucional</span>
                    }
                  </td>
                  <td>
                    <span className="amount-neg">{fmt(exp.amount, exp.currency)}</span>
                    {' '}
                    <span className={exp.currency === 'USD' ? 'currency-usd' : 'currency-uyu'}>{exp.currency}</span>
                  </td>
                  <td>
                    {exp.receipt_url
                      ? <a href={exp.receipt_url} target="_blank" rel="noreferrer" title={exp.receipt_filename}>📎</a>
                      : <span style={{ fontSize: 11, color: 'var(--red-mid)' }}>⚠ sin comp.</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Nuevo gasto</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            {duplicateWarning && (
              <div className="alert alert-error" style={{ marginBottom: 16 }}>
                ⚠️ Ya existe un gasto similar: <strong>{duplicateWarning.description}</strong> por {fmt(duplicateWarning.amount, form.currency)} el {format(new Date(duplicateWarning.expense_date + 'T00:00:00'), 'd MMM', { locale: es })}.<br />
                <span style={{ fontSize: 12 }}>¿Es un gasto diferente? Hacé clic en "Guardar de todas formas".</span>
                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  <button className="btn btn-sm btn-primary" onClick={saveExpense}>Guardar de todas formas</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => setDuplicateWarning(null)}>Cancelar</button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Descripción *</label>
                <input className="form-control" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Ej: Combustible campaña norte" />
                {errors.description && <div className="field-error">{errors.description}</div>}
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Monto *</label>
                  <input className="form-control" type="number" step="0.01" min="0.01" value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00" />
                  {errors.amount && <div className="field-error">{errors.amount}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Moneda *</label>
                  <select className="form-control" value={form.currency}
                    onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                    <option value="USD">USD – Dólares</option>
                    <option value="UYU">UYU – Pesos uruguayos</option>
                  </select>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Proyecto *</label>
                  <select className="form-control" value={form.project_id}
                    onChange={e => handleProjectChange(e.target.value)}>
                    <option value="">Seleccionar proyecto...</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  {errors.project_id && <div className="field-error">{errors.project_id}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Actividad</label>
                  <select className="form-control" value={form.activity_id}
                    disabled={!form.project_id}
                    onChange={e => handleActivityChange(e.target.value)}>
                    <option value="">Sin actividad</option>
                    {activities
                      .filter(a => a.project_id === form.project_id)
                      .map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Categoría *</label>
                <select className="form-control" value={form.category_id}
                  disabled={!!form.activity_id}
                  onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                  <option value="">Seleccionar categoría...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
                {form.activity_id && (
                  <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 3 }}>
                    Autocompletado desde la actividad
                  </div>
                )}
                {errors.category_id && <div className="field-error">{errors.category_id}</div>}
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Fecha del gasto *</label>
                  <input className="form-control" type="date" value={form.expense_date}
                    onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
                  {errors.expense_date && <div className="field-error">{errors.expense_date}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">¿Quién pagó?</label>
                  <select className="form-control" value={form.payment_type}
                    onChange={e => setForm(f => ({ ...f, payment_type: e.target.value }))}>
                    <option value="institutional">🏦 La ONG (institucional)</option>
                    <option value="personal">💳 Yo (necesito reintegro)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notas</label>
                <textarea className="form-control" value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Detalles adicionales, número de factura, etc." />
              </div>

              <div className="form-group">
                <label className="form-label">Comprobante / Factura</label>
                <label className={`upload-zone${receipt ? ' drag-over' : ''}`} style={{ display: 'block' }}>
                  <div className="upload-icon">{receipt ? '✅' : '📷'}</div>
                  {receipt
                    ? <p style={{ fontWeight: 500 }}>{receipt.name}</p>
                    : <p>Hacé clic para subir una foto o PDF</p>
                  }
                  <small>JPG, PNG o PDF · máx. 10 MB</small>
                  <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                    onChange={e => setReceipt(e.target.files[0] || null)} />
                </label>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar gasto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
