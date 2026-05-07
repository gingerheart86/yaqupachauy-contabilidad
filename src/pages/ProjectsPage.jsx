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

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: proj }, { data: exp }] = await Promise.all([
      supabase.from('projects').select('*').order('active', { ascending: false }).order('name'),
      supabase.from('expenses').select('project_id, amount, currency'),
    ])
    // Sum per project per currency
    const t = {}
    ;(exp || []).forEach(e => {
      if (!t[e.project_id]) t[e.project_id] = { USD: 0, UYU: 0 }
      t[e.project_id][e.currency] = (t[e.project_id][e.currency] || 0) + Number(e.amount)
    })
    setProjects(proj || [])
    setTotals(t)
    setLoading(false)
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
    const { error } = await supabase.from('projects').delete().eq('id', proj.id)
    if (error) alert('Error: ' + error.message)
    else loadData()
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
                  {/* USD */}
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

                  {/* UYU */}
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

                {isAdmin && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    <button className="btn btn-ghost btn-sm" style={{ flex: 1 }}
                      onClick={() => openEdit(proj)}>
                      Editar
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ flex: 1 }}
                      onClick={() => toggleActive(proj)}>
                      {proj.active ? 'Cerrar' : 'Reabrir'}
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ flex: 1, color: 'var(--danger, #e53e3e)' }}
                      onClick={() => deleteProject(proj)}>
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

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
