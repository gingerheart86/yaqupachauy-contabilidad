import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

function fmt(amount, currency) {
  if (!amount) return '—'
  if (currency === 'USD') return `U$D ${Number(amount).toLocaleString('es-UY', { minimumFractionDigits: 2 })}`
  return `$U ${Number(amount).toLocaleString('es-UY', { minimumFractionDigits: 2 })}`
}

function fmtDate(d) {
  if (!d) return '—'
  return format(new Date(d + 'T00:00:00'), 'd MMM yyyy', { locale: es })
}

const EMPTY = { name: '', description: '', start_date: '', end_date: '', budget_usd: '', budget_uyu: '' }

export default function ProjectsPage() {
  const { user, profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [projects, setProjects] = useState([])
  const [totals, setTotals] = useState({})
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [editingProject, setEditingProject] = useState(null)

  // panel de asignación
  const [assignProject, setAssignProject] = useState(null)
  const [viewProject, setViewProject] = useState(null)
  const [panelExpenses, setPanelExpenses] = useState([])
  const [panelCategories, setPanelCategories] = useState([])
  const [panelUsers, setPanelUsers] = useState([])
  const [panelSuppliers, setPanelSuppliers] = useState([])
  const [panelLoading, setPanelLoading] = useState(false)
  const [viewExpense, setViewExpense] = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: proj }, { data: exp }] = await Promise.all([
      supabase.from('projects').select('*').order('active', { ascending: false }).order('name'),
      supabase.from('expenses').select('project_id, amount, currency'),
    ])
    const t = {}
    ;(exp || []).forEach(e => {
      if (!e.project_id) return
      if (!t[e.project_id]) t[e.project_id] = { USD: 0, UYU: 0 }
      t[e.project_id][e.currency] = (t[e.project_id][e.currency] || 0) + Number(e.amount)
    })
    setProjects(proj || [])
    setTotals(t)
    setLoading(false)
  }

  async function loadPanelData(proj) {
    setPanelLoading(true)
    let q = supabase.from('expenses').select('*')
      .or(`project_id.is.null,project_id.eq.${proj.id}`)
      .order('expense_date', { ascending: false })
    if (proj.start_date) q = q.gte('expense_date', proj.start_date)
    if (proj.end_date) q = q.lte('expense_date', proj.end_date)
    const [{ data: exps }, { data: cats }, { data: users }, { data: sups }] = await Promise.all([
      q,
      supabase.from('categories').select('id, name, icon'),
      supabase.from('profiles').select('id, full_name'),
      supabase.from('suppliers').select('id, razon_social'),
    ])
    setPanelExpenses(exps || [])
    setPanelCategories(cats || [])
    setPanelUsers(users || [])
    setPanelSuppliers(sups || [])
    setPanelLoading(false)
  }

  async function loadViewData(proj) {
    setPanelLoading(true)
    const [{ data: exps }, { data: cats }, { data: users }] = await Promise.all([
      supabase.from('expenses').select('*').eq('project_id', proj.id).order('expense_date', { ascending: false }),
      supabase.from('categories').select('id, name, icon'),
      supabase.from('profiles').select('id, full_name'),
    ])
    setPanelExpenses(exps || [])
    setPanelCategories(cats || [])
    setPanelUsers(users || [])
    setPanelLoading(false)
  }

  function openAssign(proj) {
    setAssignProject(proj)
    loadPanelData(proj)
  }

  function openView(proj) {
    setViewProject(proj)
    loadViewData(proj)
  }

  async function assignExp(expId) {
    await supabase.from('expenses').update({ project_id: assignProject.id }).eq('id', expId)
    setPanelExpenses(prev => prev.map(e => e.id === expId ? { ...e, project_id: assignProject.id } : e))
    loadData()
  }

  async function unassignExp(expId) {
    await supabase.from('expenses').update({ project_id: null }).eq('id', expId)
    setPanelExpenses(prev => prev.map(e => e.id === expId ? { ...e, project_id: null } : e))
    loadData()
  }

  async function saveProject(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      description: form.description || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      budget_usd: form.budget_usd ? parseFloat(form.budget_usd) : null,
      budget_uyu: form.budget_uyu ? parseFloat(form.budget_uyu) : null,
      created_by: user.id,
    }
    const { error } = await supabase.from('projects').insert(payload)
    if (error) alert('Error: ' + error.message)
    else { setShowModal(false); setForm(EMPTY); loadData() }
    setSaving(false)
  }

  async function updateProject(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      description: form.description || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      budget_usd: form.budget_usd ? parseFloat(form.budget_usd) : null,
      budget_uyu: form.budget_uyu ? parseFloat(form.budget_uyu) : null,
    }
    const { error } = await supabase.from('projects').update(payload).eq('id', editingProject.id)
    if (error) alert('Error: ' + error.message)
    else { setEditingProject(null); setForm(EMPTY); loadData() }
    setSaving(false)
  }

  async function deleteProject(proj) {
    if (!confirm(`¿Eliminar el proyecto "${proj.name}"? Esta acción no se puede deshacer.`)) return
    const { count } = await supabase.from('expenses').select('*', { count: 'exact', head: true }).eq('project_id', proj.id)
    if (count > 0) { alert(`No se puede eliminar: hay ${count} gasto${count !== 1 ? 's' : ''} asociados a este proyecto.`); return }
    const { data: deleted, error } = await supabase.from('projects').delete().eq('id', proj.id).select()
    if (error) { alert('Error: ' + error.message); return }
    if (!deleted || deleted.length === 0) { alert('No se pudo eliminar. Ejecutá la política RLS de DELETE en la tabla projects desde el SQL Editor de Supabase.'); return }
    loadData()
  }

  function openEdit(proj) {
    setForm({
      name: proj.name,
      description: proj.description || '',
      start_date: proj.start_date || '',
      end_date: proj.end_date || '',
      budget_usd: proj.budget_usd ?? '',
      budget_uyu: proj.budget_uyu ?? '',
    })
    setEditingProject(proj)
  }

  async function toggleActive(proj) {
    await supabase.from('projects').update({ active: !proj.active }).eq('id', proj.id)
    loadData()
  }

  function pct(spent, budget) {
    if (!budget || budget === 0) return null
    return Math.min(100, Math.round((spent / budget) * 100))
  }

  const catName = (id, cats) => { const c = (cats || panelCategories).find(c => c.id === id); return c ? `${c.icon || ''} ${c.name}` : '—' }
  const userName = (id) => panelUsers.find(u => u.id === id)?.full_name ?? '—'
  const supName  = (id) => panelSuppliers.find(s => s.id === id)?.razon_social ?? '—'
  const projName = (id) => projects.find(p => p.id === id)?.name ?? null

  if (loading) return <div className="empty-state">Cargando...</div>

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Proyectos</div>
        {isAdmin && <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setShowModal(true) }}>+ Nuevo proyecto</button>}
      </div>

      {projects.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">🌊</div>No hay proyectos creados todavía.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {projects.map(proj => {
            const t = totals[proj.id] || { USD: 0, UYU: 0 }
            const pctUSD = pct(t.USD, proj.budget_usd)
            const pctUYU = pct(t.UYU, proj.budget_uyu)

            return (
              <div key={proj.id} className="card" style={{ opacity: proj.active ? 1 : 0.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 15, color: 'var(--ink)' }}>{proj.name}</div>
                    {proj.description && <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 2 }}>{proj.description}</div>}
                  </div>
                  {!proj.active && <span className="tag tag-gray">Cerrado</span>}
                </div>

                {(proj.start_date || proj.end_date) && (
                  <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginBottom: 12 }}>
                    📅 {proj.start_date && format(new Date(proj.start_date + 'T00:00:00'), 'MMM yyyy', { locale: es })}
                    {proj.start_date && proj.end_date && ' – '}
                    {proj.end_date && format(new Date(proj.end_date + 'T00:00:00'), 'MMM yyyy', { locale: es })}
                  </div>
                )}

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: 'var(--ink-light)' }}>Ejecutado USD</span>
                      <span style={{ fontWeight: 500 }}>{fmt(t.USD, 'USD')}</span>
                    </div>
                    {proj.budget_usd && (
                      <>
                        <div className="progress-bar">
                          <div className={`progress-fill${pctUSD > 90 ? ' danger' : pctUSD > 70 ? ' warning' : ''}`}
                            style={{ width: `${pctUSD}%` }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-faint)' }}>
                          <span>{pctUSD}% ejecutado</span>
                          <span>Presup. {fmt(proj.budget_usd, 'USD')}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {(t.UYU > 0 || proj.budget_uyu) && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: 'var(--ink-light)' }}>Ejecutado UYU</span>
                        <span style={{ fontWeight: 500 }}>{fmt(t.UYU, 'UYU')}</span>
                      </div>
                      {proj.budget_uyu && (
                        <>
                          <div className="progress-bar">
                            <div className={`progress-fill${pctUYU > 90 ? ' danger' : pctUYU > 70 ? ' warning' : ''}`}
                              style={{ width: `${pctUYU}%` }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-faint)' }}>
                            <span>{pctUYU}% ejecutado</span>
                            <span>Presup. {fmt(proj.budget_uyu, 'UYU')}</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                  {isAdmin && (
                    <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => openAssign(proj)}>
                      Asignar gastos
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => openView(proj)}>
                    Ver gastos
                  </button>
                  {isAdmin && (
                    <>
                      <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => openEdit(proj)}>Editar</button>
                      <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => toggleActive(proj)}>
                        {proj.active ? 'Cerrar' : 'Reabrir'}
                      </button>
                      <button className="btn btn-ghost btn-sm" style={{ flex: 1, color: 'var(--danger, #e53e3e)' }}
                        onClick={() => deleteProject(proj)}>Eliminar</button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── PANEL ASIGNAR GASTOS ── */}
      {assignProject && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setAssignProject(null)}>
          <div className="modal" style={{ maxWidth: 860, width: '95vw' }}>
            <div className="modal-header">
              <div className="modal-title">Asignar gastos — {assignProject.name}</div>
              <button className="modal-close" onClick={() => setAssignProject(null)}>✕</button>
            </div>

            {assignProject.start_date || assignProject.end_date ? (
              <div style={{ fontSize: 12, color: 'var(--ink-light)', marginBottom: 12 }}>
                Mostrando gastos entre {fmtDate(assignProject.start_date)} y {fmtDate(assignProject.end_date)}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--ink-light)', marginBottom: 12 }}>
                Este proyecto no tiene rango de fechas — se muestran todos los gastos.
              </div>
            )}

            {panelLoading ? (
              <div className="empty-state">Cargando gastos...</div>
            ) : panelExpenses.length === 0 ? (
              <div className="empty-state">No hay gastos en este período.</div>
            ) : (
              <div className="table-wrap" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Descripción</th>
                      <th>Monto</th>
                      <th>Por</th>
                      <th style={{ width: 100 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {panelExpenses.map(exp => {
                      const isThisProject = exp.project_id === assignProject.id
                      return (
                        <tr key={exp.id} style={{ background: isThisProject ? 'var(--teal-mist)' : undefined }}>
                          <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--ink-light)' }}>{fmtDate(exp.expense_date)}</td>
                          <td style={{ fontWeight: 500 }}>
                            {exp.description}
                            {exp.category_id && <span className="tag tag-gray" style={{ fontSize: 10, marginLeft: 6 }}>{catName(exp.category_id)}</span>}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {fmt(exp.amount, exp.currency)}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--ink-light)', whiteSpace: 'nowrap' }}>{userName(exp.user_id)}</td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => setViewExpense(exp)} style={{ marginRight: 4 }}>Ver</button>
                            {isThisProject
                              ? <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-mid)' }} onClick={() => unassignExp(exp.id)}>Quitar</button>
                              : <button className="btn btn-primary btn-sm" onClick={() => assignExp(exp.id)}>Agregar</button>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL DETALLE GASTO ── */}
      {viewExpense && (
        <div className="modal-backdrop" style={{ zIndex: 300 }} onClick={e => e.target === e.currentTarget && setViewExpense(null)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ fontSize: 16 }}>Detalle del gasto</div>
              <button className="modal-close" onClick={() => setViewExpense(null)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              {[
                ['Fecha', fmtDate(viewExpense.expense_date)],
                ['Descripción', viewExpense.description],
                ['Monto', `${fmt(viewExpense.amount, viewExpense.currency)} ${viewExpense.currency}`],
                ['Categoría', catName(viewExpense.category_id)],
                ['Registrado por', userName(viewExpense.user_id)],
                viewExpense.supplier_id && ['Proveedor', supName(viewExpense.supplier_id)],
                viewExpense.invoice_number && ['Nº Factura', viewExpense.invoice_number],
                viewExpense.notes && ['Notas', viewExpense.notes],
              ].filter(Boolean).map(([label, value]) => (
                <div key={label} style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                  <span style={{ minWidth: 110, color: 'var(--ink-light)', fontWeight: 500 }}>{label}</span>
                  <span style={{ flex: 1, color: 'var(--ink)' }}>{value}</span>
                </div>
              ))}
              {viewExpense.receipt_url && (
                <div style={{ display: 'flex', gap: 12, paddingTop: 4 }}>
                  <span style={{ minWidth: 110, color: 'var(--ink-light)', fontWeight: 500 }}>Comprobante</span>
                  <a href={viewExpense.receipt_url} target="_blank" rel="noreferrer"
                    className="btn btn-ghost btn-sm">Ver comprobante ↗</a>
                </div>
              )}
            </div>
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              {viewExpense.project_id === assignProject?.id
                ? <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-mid)' }}
                    onClick={() => { unassignExp(viewExpense.id); setViewExpense(null) }}>Quitar del proyecto</button>
                : <button className="btn btn-primary btn-sm"
                    onClick={() => { assignExp(viewExpense.id); setViewExpense(null) }}>Agregar al proyecto</button>
              }
              <button className="btn btn-ghost" onClick={() => setViewExpense(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── PANEL VER GASTOS ── */}
      {viewProject && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setViewProject(null)}>
          <div className="modal" style={{ maxWidth: 800, width: '95vw' }}>
            <div className="modal-header">
              <div className="modal-title">Gastos de {viewProject.name}</div>
              <button className="modal-close" onClick={() => setViewProject(null)}>✕</button>
            </div>

            {panelLoading ? (
              <div className="empty-state">Cargando...</div>
            ) : panelExpenses.length === 0 ? (
              <div className="empty-state">No hay gastos asignados a este proyecto.</div>
            ) : (
              <>
                {/* totales */}
                {['USD', 'UYU'].map(cur => {
                  const total = panelExpenses.filter(e => e.currency === cur).reduce((s, e) => s + Number(e.amount), 0)
                  if (!total) return null
                  return (
                    <div key={cur} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
                      <span style={{ color: 'var(--ink-light)' }}>Total {cur}</span>
                      <strong>{fmt(total, cur)}</strong>
                    </div>
                  )
                })}
                <div className="table-wrap" style={{ maxHeight: '60vh', overflowY: 'auto', marginTop: 12 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Descripción</th>
                        <th>Categoría</th>
                        <th>Monto</th>
                        <th>Registrado por</th>
                        <th>Tipo de pago</th>
                      </tr>
                    </thead>
                    <tbody>
                      {panelExpenses.map(exp => (
                        <tr key={exp.id}>
                          <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--ink-light)' }}>{fmtDate(exp.expense_date)}</td>
                          <td style={{ fontWeight: 500 }}>{exp.description}</td>
                          <td><span className="tag tag-gray" style={{ fontSize: 11 }}>{catName(exp.category_id)}</span></td>
                          <td style={{ whiteSpace: 'nowrap' }}>{fmt(exp.amount, exp.currency)} <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{exp.currency}</span></td>
                          <td style={{ fontSize: 12, color: 'var(--ink-light)' }}>{userName(exp.user_id)}</td>
                          <td>
                            {exp.payment_type === 'personal'
                              ? <span className="tag tag-amber" style={{ fontSize: 11 }}>💳 Personal</span>
                              : <span className="tag tag-teal" style={{ fontSize: 11 }}>🏦 Institucional</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL CREAR / EDITAR PROYECTO ── */}
      {(showModal || editingProject) && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && (showModal ? setShowModal(false) : setEditingProject(null))}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editingProject ? 'Editar proyecto' : 'Nuevo proyecto'}</div>
              <button className="modal-close" onClick={() => editingProject ? setEditingProject(null) : setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={editingProject ? updateProject : saveProject}>
              <div className="form-group">
                <label className="form-label">Nombre del proyecto *</label>
                <input className="form-control" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Monitoreo ballenas jorobadas 2026" required />
              </div>
              <div className="form-group">
                <label className="form-label">Descripción</label>
                <textarea className="form-control" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Descripción breve del proyecto..." />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Fecha de inicio</label>
                  <input className="form-control" type="date" value={form.start_date}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha de fin</label>
                  <input className="form-control" type="date" value={form.end_date}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Presupuesto USD</label>
                  <input className="form-control" type="number" step="0.01" value={form.budget_usd}
                    onChange={e => setForm(f => ({ ...f, budget_usd: e.target.value }))}
                    placeholder="Opcional" />
                </div>
                <div className="form-group">
                  <label className="form-label">Presupuesto UYU</label>
                  <input className="form-control" type="number" step="0.01" value={form.budget_uyu}
                    onChange={e => setForm(f => ({ ...f, budget_uyu: e.target.value }))}
                    placeholder="Opcional" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" className="btn btn-ghost" onClick={() => editingProject ? setEditingProject(null) : setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : editingProject ? 'Guardar cambios' : 'Crear proyecto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
