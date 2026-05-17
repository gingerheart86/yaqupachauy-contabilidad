import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

function fmt(amount, currency) {
  if (currency === 'USD') return `U$D ${Number(amount).toLocaleString('es-UY', { minimumFractionDigits: 2 })}`
  return `$U ${Number(amount).toLocaleString('es-UY', { minimumFractionDigits: 2 })}`
}

const DEPARTAMENTOS = ['Artigas','Canelones','Cerro Largo','Colonia','Durazno','Flores','Florida',
  'Lavalleja','Maldonado','Montevideo','Paysandú','Río Negro','Rivera','Rocha',
  'Salto','San José','Soriano','Tacuarembó','Treinta y Tres','Exterior de UY']

const EMPTY_FORM = {
  description: '', amount: '', currency: 'UYU',
  project_id: '', activity_id: '', category_id: '',
  expense_date: new Date().toISOString().slice(0, 10),
  payment_type: 'institutional', invoice_number: '', supplier_id: '', notes: '',
}

export default function ExpensesPage() {
  const { user, profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const [expenses, setExpenses] = useState([])
  const [projects, setProjects] = useState([])
  const [categories, setCategories] = useState([])
  const [activities, setActivities] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [suppliers, setSuppliers] = useState([])
  const [showSupReq, setShowSupReq] = useState(false)
  const [supReqForm, setSupReqForm] = useState({ razon_social: '', name: '' })
  const [supReqSent, setSupReqSent] = useState(false)
  const [savingSupReq, setSavingSupReq] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const [receiptValidation, setReceiptValidation] = useState(null) // null | 'checking' | { valid, legible, tipo, mensaje }
  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [errors, setErrors] = useState({})
  const [duplicateWarning, setDuplicateWarning] = useState(null)
  const [filterProject, setFilterProject] = useState('')
  const [filterUser, setFilterUser] = useState('')
  const [filterDept, setFilterDept] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: exp }, { data: proj }, { data: cats }, { data: userList }] = await Promise.all([
      supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
      supabase.from('projects').select('id, name').eq('active', true).order('name'),
      supabase.from('categories').select('id, name, icon').order('name'),
      supabase.from('profiles').select('id, full_name'),
    ])
    setExpenses(exp || [])
    setProjects(proj || [])
    setCategories(cats || [])
    setUsers(userList || [])
    setLoading(false)

    supabase.from('activities').select('id, name, category_id').eq('active', true).order('name')
      .then(({ data: acts }) => setActivities(acts || []))
    supabase.from('suppliers').select('id, razon_social, name, category_id').eq('active', true).eq('status', 'active').order('razon_social')
      .then(({ data: sups }) => setSuppliers(sups || []))
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

  function handleCategoryChange(catId) {
    setForm(f => ({
      ...f,
      category_id: catId,
      activity_id: activities.find(a => a.id === f.activity_id && String(a.category_id) === catId) ? f.activity_id : '',
    }))
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
    if (!f.category_id) e.category_id = 'Seleccioná una categoría'
    if (!f.expense_date) e.expense_date = 'Requerido'
    return e
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate(form)
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})

    if (editingExpense) { await updateExpense(); return }

    const dup = await checkDuplicate(form)
    if (dup && !duplicateWarning) { setDuplicateWarning(dup); return }
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
      project_id: form.project_id || null,
      activity_id: form.activity_id || null,
      category_id: form.category_id ? parseInt(form.category_id) : null,
      supplier_id: form.supplier_id || null,
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

  async function submitSupplierRequest(e) {
    e.preventDefault()
    setSavingSupReq(true)
    await supabase.from('suppliers').insert({
      razon_social: supReqForm.razon_social.trim(),
      name: supReqForm.name.trim() || null,
      status: 'pending',
      active: false,
      requested_by: user.id,
    })
    setSupReqSent(true)
    setSavingSupReq(false)
  }

  async function handleReceiptChange(file) {
    setReceipt(file || null)
    setReceiptValidation(null)
    if (!file) return

    setReceiptValidation('checking')
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await fetch('/api/validate-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mediaType: file.type }),
      })
      const data = await res.json()
      setReceiptValidation(data.error ? null : data)
    } catch {
      setReceiptValidation(null)
    }
  }

  function openNew() {
    setEditingExpense(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setDuplicateWarning(null)
    setReceipt(null)
    setReceiptValidation(null)
    setFilterDept('')
    setShowModal(true)
  }

  function openEdit(exp) {
    setEditingExpense(exp)
    setReceiptValidation(null)
    setFilterDept('')
    setForm({
      description: exp.description || '',
      amount: exp.amount ?? '',
      currency: exp.currency || 'USD',
      project_id: exp.project_id || '',
      activity_id: exp.activity_id || '',
      category_id: exp.category_id ? String(exp.category_id) : '',
      expense_date: exp.expense_date || '',
      payment_type: exp.payment_type || 'institutional',
      invoice_number: exp.invoice_number || '',
      supplier_id: exp.supplier_id || '',
      notes: exp.notes || '',
    })
    setErrors({})
    setDuplicateWarning(null)
    setReceipt(null)
    setShowModal(true)
  }

  async function updateExpense() {
    setSaving(true)
    let receipt_url = editingExpense.receipt_url
    let receipt_filename = editingExpense.receipt_filename

    if (receipt) {
      const ext = receipt.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('receipts').upload(path, receipt, { upsert: false })
      if (uploadError) {
        alert('Error al subir el comprobante: ' + uploadError.message)
        setSaving(false)
        return
      }
      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(path)
      receipt_url = publicUrl
      receipt_filename = receipt.name
    }

    const { error } = await supabase.from('expenses').update({
      description: form.description.trim(),
      amount: parseFloat(form.amount),
      currency: form.currency,
      project_id: form.project_id || null,
      activity_id: form.activity_id || null,
      category_id: form.category_id ? parseInt(form.category_id) : null,
      expense_date: form.expense_date,
      payment_type: form.payment_type,
      invoice_number: form.invoice_number || null,
      supplier_id: form.supplier_id || null,
      notes: form.notes || null,
      receipt_url,
      receipt_filename,
    }).eq('id', editingExpense.id)

    if (error) { alert('Error al guardar: ' + error.message); setSaving(false); return }
    setSaving(false)
    setShowModal(false)
    setEditingExpense(null)
    setForm(EMPTY_FORM)
    setReceipt(null)
    loadData()
  }

  async function deleteExpense(exp) {
    if (!confirm(`¿Eliminar el gasto "${exp.description}"? Esta acción no se puede deshacer.`)) return
    const { error } = await supabase.from('expenses').delete().eq('id', exp.id)
    if (error) alert('Error: ' + error.message)
    else loadData()
  }

  const filtered = expenses.filter(e => {
    if (!isAdmin && e.user_id !== user.id) return false
    if (filterProject && e.project_id !== filterProject) return false
    if (filterUser && e.user_id !== filterUser) return false
    return true
  })

  const userName = (id) => users.find(u => u.id === id)?.full_name ?? id
  const supplierName = (id) => { const s = suppliers.find(s => s.id === id); return s ? s.razon_social : '—' }
  const filteredSuppliers = suppliers.filter(s =>
    (!form.category_id || !s.category_id || String(s.category_id) === String(form.category_id)) &&
    (!filterDept || s.name === filterDept)
  )

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Gastos</div>
        <button className="btn btn-primary" onClick={openNew}>+ Nuevo gasto</button>
      </div>

      {isAdmin && (
        <div className="filter-row">
          <select className="form-control" value={filterUser} onChange={e => setFilterUser(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="">Todos los usuarios</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.full_name ?? u.id}</option>)}
          </select>
        </div>
      )}

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
                <th>Proveedor</th>
                <th>Nº Factura</th>
                <th>Categoría</th>
                {isAdmin && <th>Usuario</th>}
                <th>Tipo de pago</th>
                <th>Monto</th>
                <th>Comprobante</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(exp => (
                <tr key={exp.id}>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--ink-light)' }}>
                    {exp.expense_date ? format(new Date(exp.expense_date + 'T00:00:00'), 'd MMM yyyy', { locale: es }) : '—'}
                  </td>
                  <td style={{ fontWeight: 500, color: 'var(--ink)' }}>{exp.description}</td>
                  <td style={{ color: 'var(--ink-light)', fontSize: 12 }}>{exp.supplier_id ? supplierName(exp.supplier_id) : '—'}</td>
                  <td style={{ color: 'var(--ink-light)', fontSize: 12 }}>{exp.invoice_number || '—'}</td>
                  <td><span className="tag tag-gray">{categories.find(c => c.id === exp.category_id)?.icon} {categories.find(c => c.id === exp.category_id)?.name}</span></td>
                  {isAdmin && <td style={{ color: 'var(--ink-light)' }}>{userName(exp.user_id)}</td>}
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
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(isAdmin || exp.user_id === user.id) && (
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(exp)}>Editar</button>
                      )}
                      {isAdmin && (
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger, #e53e3e)' }}
                          onClick={() => deleteExpense(exp)}>Eliminar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showSupReq && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowSupReq(false)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div className="modal-title">Solicitar nuevo proveedor</div>
              <button className="modal-close" onClick={() => setShowSupReq(false)}>✕</button>
            </div>
            {supReqSent ? (
              <>
                <div className="alert alert-success" style={{ marginBottom: 16 }}>
                  ✅ Solicitud enviada. Una administradora debe aprobarla antes de que puedas seleccionarla.
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={() => setShowSupReq(false)}>Cerrar</button>
                </div>
              </>
            ) : (
              <form onSubmit={submitSupplierRequest}>
                <p style={{ fontSize: 13, color: 'var(--ink-light)', marginBottom: 16 }}>
                  La solicitud será revisada por una administradora. Una vez aprobada aparecerá en la lista.
                </p>
                <div className="form-group">
                  <label className="form-label">Razón Social *</label>
                  <input className="form-control" value={supReqForm.razon_social}
                    onChange={e => setSupReqForm(f => ({ ...f, razon_social: e.target.value }))}
                    placeholder="Nombre legal del proveedor" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Nombre comercial</label>
                  <input className="form-control" value={supReqForm.name}
                    onChange={e => setSupReqForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Opcional" />
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowSupReq(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={savingSupReq}>
                    {savingSupReq ? 'Enviando...' : 'Enviar solicitud'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editingExpense ? 'Editar gasto' : 'Nuevo gasto'}</div>
              <button className="modal-close" onClick={() => { setShowModal(false); setEditingExpense(null) }}>✕</button>
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

              {/* 1. Fecha + Quién pagó */}
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

              {/* 2. Descripción */}
              <div className="form-group">
                <label className="form-label">Descripción *</label>
                <input className="form-control" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Ej: Combustible campaña norte" />
                {errors.description && <div className="field-error">{errors.description}</div>}
              </div>

              {/* 3. Monto + Moneda */}
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

              {/* 4. Categoría */}
              <div className="form-group">
                <label className="form-label">Categoría *</label>
                <select className="form-control" value={form.category_id}
                  onChange={e => handleCategoryChange(e.target.value)}>
                  <option value="">Seleccionar categoría...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
                {errors.category_id && <div className="field-error">{errors.category_id}</div>}
              </div>

              {/* 5. Actividad (filtrada por categoría) */}
              <div className="form-group">
                <label className="form-label">Actividad</label>
                <select className="form-control" value={form.activity_id}
                  onChange={e => handleActivityChange(e.target.value)}>
                  <option value="">Sin actividad</option>
                  {activities
                    .filter(a => !form.category_id || String(a.category_id) === String(form.category_id))
                    .map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              {/* 6. Departamento + Proveedor */}
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Departamento</label>
                  <select className="form-control" value={filterDept}
                    onChange={e => { setFilterDept(e.target.value); setForm(f => ({ ...f, supplier_id: '' })) }}>
                    <option value="">Todos</option>
                    {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Proveedor</label>
                  <select className="form-control" value={form.supplier_id}
                    onChange={e => {
                      if (e.target.value === '__request__') {
                        setSupReqForm({ razon_social: '', name: '' })
                        setSupReqSent(false)
                        setShowSupReq(true)
                      } else {
                        setForm(f => ({ ...f, supplier_id: e.target.value }))
                      }
                    }}>
                    <option value="">Sin proveedor</option>
                    {filteredSuppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.razon_social}</option>
                    ))}
                    <option value="__request__">+ Solicitar nuevo proveedor...</option>
                  </select>
                </div>
              </div>

              {/* 7. Número de factura */}
              <div className="form-group">
                <label className="form-label">Número de factura</label>
                <input className="form-control" value={form.invoice_number}
                  onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))}
                  placeholder="Ej: 0001-00012345" />
              </div>

              {/* 8. Notas */}
              <div className="form-group">
                <label className="form-label">Notas</label>
                <textarea className="form-control" value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Detalles adicionales..." />
              </div>

              <div className="form-group">
                <label className="form-label">Comprobante / Factura</label>
                <label
                  className={`upload-zone${dragOver ? ' drag-over' : ''}`}
                  style={{ display: 'block' }}
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragEnter={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); handleReceiptChange(e.dataTransfer.files[0]) }}
                >
                  <div className="upload-icon">
                    {receiptValidation === 'checking' ? '⏳' : receipt ? '📄' : '📷'}
                  </div>
                  {receipt
                    ? <p style={{ fontWeight: 500 }}>{receipt.name}</p>
                    : <p>Arrastrá o hacé clic para subir una foto o PDF</p>
                  }
                  <small>JPG, PNG o PDF · máx. 10 MB</small>
                  <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                    onChange={e => handleReceiptChange(e.target.files[0])} />
                </label>
                {receiptValidation === 'checking' && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-light)' }}>
                    🔍 Verificando comprobante con IA...
                  </div>
                )}
                {receiptValidation && receiptValidation !== 'checking' && (
                  <div style={{
                    marginTop: 8, padding: '8px 12px', borderRadius: 8, fontSize: 12,
                    background: receiptValidation.valid && receiptValidation.legible
                      ? 'var(--teal-mist, #e6f7f5)'
                      : 'var(--amber-mist, #fff8e6)',
                    color: receiptValidation.valid && receiptValidation.legible
                      ? 'var(--teal-dark, #0d6e5e)'
                      : 'var(--amber-dark, #92600a)',
                    display: 'flex', alignItems: 'flex-start', gap: 6,
                  }}>
                    <span>
                      {receiptValidation.valid && receiptValidation.legible ? '✅' : '⚠️'}
                    </span>
                    <div>
                      <strong>
                        {receiptValidation.valid && receiptValidation.legible
                          ? `Comprobante válido (${receiptValidation.tipo})`
                          : !receiptValidation.legible
                            ? 'Documento poco legible'
                            : 'No parece un comprobante'}
                      </strong>
                      <div style={{ marginTop: 2, opacity: 0.85 }}>{receiptValidation.mensaje}</div>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : editingExpense ? 'Guardar cambios' : 'Guardar gasto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
