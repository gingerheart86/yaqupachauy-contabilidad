import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const EMPTY_CAT = { name: '', icon: '' }
const EMPTY_ACT = { name: '', description: '', place: '', category_id: '', budget_usd: '', budget_uyu: '' }
const EMPTY_GRP = { name: '' }
const EMPTY_SUP = { razon_social: '', name: '' }

function fmt(amount, currency) {
  if (!amount) return '—'
  if (currency === 'USD') return `U$D ${Number(amount).toLocaleString('es-UY', { minimumFractionDigits: 2 })}`
  return `$U ${Number(amount).toLocaleString('es-UY', { minimumFractionDigits: 2 })}`
}

export default function CategoriesPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const [categories, setCategories] = useState([])
  const [activities, setActivities] = useState([])
  const [groups, setGroups] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)

  const [catModal, setCatModal] = useState(false)
  const [editingCat, setEditingCat] = useState(null)
  const [catForm, setCatForm] = useState(EMPTY_CAT)
  const [savingCat, setSavingCat] = useState(false)

  const [actModal, setActModal] = useState(false)
  const [editingAct, setEditingAct] = useState(null)
  const [actForm, setActForm] = useState(EMPTY_ACT)
  const [savingAct, setSavingAct] = useState(false)

  const [filterCategory, setFilterCategory] = useState('')

  const [grpModal, setGrpModal] = useState(false)
  const [editingGrp, setEditingGrp] = useState(null)
  const [grpForm, setGrpForm] = useState(EMPTY_GRP)
  const [savingGrp, setSavingGrp] = useState(false)

  const [supModal, setSupModal] = useState(false)
  const [editingSup, setEditingSup] = useState(null)
  const [supForm, setSupForm] = useState(EMPTY_SUP)
  const [savingSup, setSavingSup] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: cats }, { data: acts }, { data: grps }, { data: sups }] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('activities').select('*, categories(name, icon)').order('name'),
      supabase.from('groups').select('*').order('name'),
      supabase.from('suppliers').select('*, requester:requested_by(full_name)').order('razon_social'),
    ])
    setCategories(cats || [])
    setActivities(acts || [])
    setGroups(grps || [])
    setSuppliers(sups || [])
    setLoading(false)
  }

  // — Categories CRUD —
  function openNewCat() { setEditingCat(null); setCatForm(EMPTY_CAT); setCatModal(true) }
  function openEditCat(cat) { setEditingCat(cat); setCatForm({ name: cat.name, icon: cat.icon || '' }); setCatModal(true) }

  async function saveCat(e) {
    e.preventDefault()
    setSavingCat(true)
    const payload = { name: catForm.name.trim(), icon: catForm.icon.trim() || null }
    const { error } = editingCat
      ? await supabase.from('categories').update(payload).eq('id', editingCat.id)
      : await supabase.from('categories').insert(payload)
    if (error) alert('Error: ' + error.message)
    else { setCatModal(false); setEditingCat(null); setCatForm(EMPTY_CAT); loadData() }
    setSavingCat(false)
  }

  async function toggleCat(cat) {
    await supabase.from('categories').update({ active: !cat.active }).eq('id', cat.id)
    loadData()
  }

  // — Activities CRUD —
  function openNewAct() { setEditingAct(null); setActForm(EMPTY_ACT); setActModal(true) }
  function openEditAct(act) {
    setEditingAct(act)
    setActForm({ name: act.name, description: act.description || '', place: act.place || '', category_id: act.category_id || '', budget_usd: act.budget_usd ?? '', budget_uyu: act.budget_uyu ?? '' })
    setActModal(true)
  }

  async function saveAct(e) {
    e.preventDefault()
    setSavingAct(true)
    const payload = {
      name: actForm.name.trim(),
      description: actForm.description || null,
      place: actForm.place || null,
      category_id: actForm.category_id || null,
      budget_usd: actForm.budget_usd ? parseFloat(actForm.budget_usd) : null,
      budget_uyu: actForm.budget_uyu ? parseFloat(actForm.budget_uyu) : null,
    }
    const { error } = editingAct
      ? await supabase.from('activities').update(payload).eq('id', editingAct.id)
      : await supabase.from('activities').insert(payload)
    if (error) alert('Error: ' + error.message)
    else { setActModal(false); setEditingAct(null); setActForm(EMPTY_ACT); loadData() }
    setSavingAct(false)
  }

  async function toggleAct(act) {
    await supabase.from('activities').update({ active: !act.active }).eq('id', act.id)
    loadData()
  }

  // — Groups CRUD —
  function openNewGrp() { setEditingGrp(null); setGrpForm(EMPTY_GRP); setGrpModal(true) }
  function openEditGrp(g) { setEditingGrp(g); setGrpForm({ name: g.name }); setGrpModal(true) }

  async function saveGrp(e) {
    e.preventDefault()
    setSavingGrp(true)
    const { error } = editingGrp
      ? await supabase.from('groups').update({ name: grpForm.name.trim() }).eq('id', editingGrp.id)
      : await supabase.from('groups').insert({ name: grpForm.name.trim() })
    if (error) alert('Error: ' + error.message)
    else { setGrpModal(false); setEditingGrp(null); setGrpForm(EMPTY_GRP); loadData() }
    setSavingGrp(false)
  }

  async function deleteGrp(g) {
    if (!confirm(`¿Eliminar el grupo "${g.name}"?`)) return
    const { error } = await supabase.from('groups').delete().eq('id', g.id)
    if (error) alert('Error: ' + error.message)
    else loadData()
  }

  // — Suppliers CRUD —
  function openNewSup() { setEditingSup(null); setSupForm(EMPTY_SUP); setSupModal(true) }
  function openEditSup(s) { setEditingSup(s); setSupForm({ razon_social: s.razon_social, name: s.name || '' }); setSupModal(true) }

  async function saveSup(e) {
    e.preventDefault()
    setSavingSup(true)
    const payload = { razon_social: supForm.razon_social.trim(), name: supForm.name.trim() || null, status: 'active', active: true }
    const { error } = editingSup
      ? await supabase.from('suppliers').update(payload).eq('id', editingSup.id)
      : await supabase.from('suppliers').insert(payload)
    if (error) alert('Error: ' + error.message)
    else { setSupModal(false); setEditingSup(null); setSupForm(EMPTY_SUP); loadData() }
    setSavingSup(false)
  }

  async function toggleSup(s) {
    await supabase.from('suppliers').update({ active: !s.active }).eq('id', s.id)
    loadData()
  }

  async function approveSup(s) {
    await supabase.from('suppliers').update({ status: 'active', active: true }).eq('id', s.id)
    loadData()
  }

  async function rejectSup(s) {
    if (!confirm(`¿Rechazar la solicitud de "${s.razon_social}"?`)) return
    await supabase.from('suppliers').update({ status: 'rejected', active: false }).eq('id', s.id)
    loadData()
  }

  const filteredActivities = filterCategory
    ? activities.filter(a => String(a.category_id) === filterCategory)
    : activities

  const pendingSuppliers = suppliers.filter(s => s.status === 'pending')
  const activeSuppliers = suppliers.filter(s => s.status !== 'pending')

  if (loading) return <div className="empty-state">Cargando...</div>

  return (
    <div>

      {/* ── CATEGORÍAS ── */}
      <div className="page-header">
        <div className="page-title">Categorías</div>
        {isAdmin && <button className="btn btn-primary" onClick={openNewCat}>+ Nueva categoría</button>}
      </div>

      {categories.length === 0 ? (
        <div className="empty-state">No hay categorías creadas todavía.</div>
      ) : (
        <div className="table-wrap" style={{ marginBottom: 40 }}>
          <table>
            <thead><tr>
              <th>Ícono</th><th>Nombre</th><th>Estado</th>
              {isAdmin && <th>Acciones</th>}
            </tr></thead>
            <tbody>
              {categories.map(cat => (
                <tr key={cat.id} style={{ opacity: cat.active === false ? 0.5 : 1 }}>
                  <td style={{ fontSize: 20 }}>{cat.icon || '—'}</td>
                  <td>{cat.name}</td>
                  <td><span className={`tag ${cat.active === false ? 'tag-gray' : 'tag-green'}`}>{cat.active === false ? 'Inactiva' : 'Activa'}</span></td>
                  {isAdmin && (
                    <td><div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEditCat(cat)}>Editar</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleCat(cat)}>{cat.active === false ? 'Activar' : 'Desactivar'}</button>
                    </div></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ACTIVIDADES ── */}
      <div className="page-header">
        <div className="page-title">Actividades</div>
        {isAdmin && <button className="btn btn-primary" onClick={openNewAct}>+ Nueva actividad</button>}
      </div>

      <div className="filter-row">
        <select className="form-control" style={{ maxWidth: 220 }}
          value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c.id} value={String(c.id)}>{c.icon} {c.name}</option>)}
        </select>
      </div>

      {filteredActivities.length === 0 ? (
        <div className="empty-state">No hay actividades{filterCategory ? ' para esta categoría' : ' creadas todavía'}.</div>
      ) : (
        <div className="table-wrap" style={{ marginBottom: 40 }}>
          <table>
            <thead><tr>
              <th>Nombre</th><th>Categoría</th><th>Lugar</th>
              <th style={{ textAlign: 'right' }}>Presup. USD</th>
              <th style={{ textAlign: 'right' }}>Presup. UYU</th>
              <th>Estado</th>
              {isAdmin && <th>Acciones</th>}
            </tr></thead>
            <tbody>
              {filteredActivities.map(act => (
                <tr key={act.id} style={{ opacity: act.active === false ? 0.5 : 1 }}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{act.name}</div>
                    {act.description && <div style={{ fontSize: 11, color: 'var(--ink-light)' }}>{act.description}</div>}
                  </td>
                  <td>{act.categories ? <span className="tag tag-gray">{act.categories.icon} {act.categories.name}</span> : '—'}</td>
                  <td>{act.place || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(act.budget_usd, 'USD')}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(act.budget_uyu, 'UYU')}</td>
                  <td><span className={`tag ${act.active === false ? 'tag-gray' : 'tag-green'}`}>{act.active === false ? 'Inactiva' : 'Activa'}</span></td>
                  {isAdmin && (
                    <td><div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEditAct(act)}>Editar</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleAct(act)}>{act.active === false ? 'Activar' : 'Desactivar'}</button>
                    </div></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── PROVEEDORES ── */}
      <div className="page-header" style={{ marginTop: 8 }}>
        <div className="page-title">Proveedores</div>
        {isAdmin && <button className="btn btn-primary" onClick={openNewSup}>+ Nuevo proveedor</button>}
      </div>

      {/* Solicitudes pendientes — solo admin */}
      {isAdmin && pendingSuppliers.length > 0 && (
        <div className="card" style={{ marginBottom: 20, border: '1px solid #f0c87a', background: '#fffbf0' }}>
          <div style={{ fontWeight: 600, marginBottom: 12, color: '#92600a' }}>⏳ Solicitudes pendientes de aprobación ({pendingSuppliers.length})</div>
          {pendingSuppliers.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 500 }}>{s.razon_social}</span>
                {s.name && <span style={{ color: 'var(--ink-light)', marginLeft: 8, fontSize: 13 }}>{s.name}</span>}
                {s.requester?.full_name && (
                  <span style={{ fontSize: 11, color: 'var(--ink-faint)', marginLeft: 8 }}>
                    solicitado por {s.requester.full_name}
                  </span>
                )}
              </div>
              <button className="btn btn-sm btn-primary" onClick={() => approveSup(s)}>Aprobar</button>
              <button className="btn btn-sm btn-ghost" style={{ color: 'var(--red-mid)' }} onClick={() => rejectSup(s)}>Rechazar</button>
            </div>
          ))}
        </div>
      )}

      {activeSuppliers.length === 0 ? (
        <div className="empty-state">No hay proveedores cargados todavía.</div>
      ) : (
        <div className="table-wrap" style={{ marginBottom: 40 }}>
          <table>
            <thead><tr>
              <th>Razón Social</th><th>Nombre comercial</th><th>Estado</th>
              {isAdmin && <th>Acciones</th>}
            </tr></thead>
            <tbody>
              {activeSuppliers.map(s => (
                <tr key={s.id} style={{ opacity: s.status === 'rejected' || !s.active ? 0.45 : 1 }}>
                  <td style={{ fontWeight: 500 }}>{s.razon_social}</td>
                  <td style={{ color: 'var(--ink-light)' }}>{s.name || '—'}</td>
                  <td>
                    {s.status === 'rejected'
                      ? <span className="tag tag-gray">Rechazado</span>
                      : s.active
                        ? <span className="tag tag-green">Activo</span>
                        : <span className="tag tag-gray">Inactivo</span>}
                  </td>
                  {isAdmin && s.status !== 'rejected' && (
                    <td><div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEditSup(s)}>Editar</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleSup(s)}>{s.active ? 'Desactivar' : 'Activar'}</button>
                    </div></td>
                  )}
                  {isAdmin && s.status === 'rejected' && <td />}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── GRUPOS (solo admin) ── */}
      {isAdmin && (
        <>
          <div className="page-header" style={{ marginTop: 8 }}>
            <div className="page-title">Grupos</div>
            <button className="btn btn-primary" onClick={openNewGrp}>+ Nuevo grupo</button>
          </div>
          {groups.length === 0 ? (
            <div className="empty-state">No hay grupos creados todavía.</div>
          ) : (
            <div className="table-wrap" style={{ marginBottom: 40 }}>
              <table>
                <thead><tr><th>Nombre</th><th>Acciones</th></tr></thead>
                <tbody>
                  {groups.map(g => (
                    <tr key={g.id}>
                      <td style={{ fontWeight: 500 }}>{g.name}</td>
                      <td><div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEditGrp(g)}>Editar</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-mid)' }} onClick={() => deleteGrp(g)}>Eliminar</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── MODAL PROVEEDOR ── */}
      {supModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setSupModal(false)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div className="modal-title">{editingSup ? 'Editar proveedor' : 'Nuevo proveedor'}</div>
              <button className="modal-close" onClick={() => setSupModal(false)}>✕</button>
            </div>
            <form onSubmit={saveSup}>
              <div className="form-group">
                <label className="form-label">Razón Social *</label>
                <input className="form-control" value={supForm.razon_social}
                  onChange={e => setSupForm(f => ({ ...f, razon_social: e.target.value }))}
                  placeholder="Nombre legal del proveedor" required />
              </div>
              <div className="form-group">
                <label className="form-label">Nombre comercial</label>
                <input className="form-control" value={supForm.name}
                  onChange={e => setSupForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Nombre por el que se lo conoce (opcional)" />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setSupModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={savingSup}>
                  {savingSup ? 'Guardando...' : editingSup ? 'Guardar cambios' : 'Crear proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL GRUPO ── */}
      {grpModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setGrpModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editingGrp ? 'Editar grupo' : 'Nuevo grupo'}</div>
              <button className="modal-close" onClick={() => setGrpModal(false)}>✕</button>
            </div>
            <form onSubmit={saveGrp}>
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input className="form-control" value={grpForm.name}
                  onChange={e => setGrpForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Investigación" required />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setGrpModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={savingGrp}>
                  {savingGrp ? 'Guardando...' : editingGrp ? 'Guardar cambios' : 'Crear grupo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL CATEGORÍA ── */}
      {catModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setCatModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editingCat ? 'Editar categoría' : 'Nueva categoría'}</div>
              <button className="modal-close" onClick={() => setCatModal(false)}>✕</button>
            </div>
            <form onSubmit={saveCat}>
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input className="form-control" value={catForm.name}
                  onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Logística" required />
              </div>
              <div className="form-group">
                <label className="form-label">Ícono (emoji)</label>
                <input className="form-control" value={catForm.icon}
                  onChange={e => setCatForm(f => ({ ...f, icon: e.target.value }))}
                  placeholder="Ej: 🚢" style={{ maxWidth: 100 }} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setCatModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={savingCat}>
                  {savingCat ? 'Guardando...' : editingCat ? 'Guardar cambios' : 'Crear categoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL ACTIVIDAD ── */}
      {actModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setActModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editingAct ? 'Editar actividad' : 'Nueva actividad'}</div>
              <button className="modal-close" onClick={() => setActModal(false)}>✕</button>
            </div>
            <form onSubmit={saveAct}>
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input className="form-control" value={actForm.name}
                  onChange={e => setActForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Avistamiento en Punta del Este" required />
              </div>
              <div className="form-group">
                <label className="form-label">Descripción</label>
                <textarea className="form-control" value={actForm.description}
                  onChange={e => setActForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Descripción breve..." />
              </div>
              <div className="form-group">
                <label className="form-label">Categoría *</label>
                <select className="form-control" value={actForm.category_id}
                  onChange={e => setActForm(f => ({ ...f, category_id: e.target.value }))} required>
                  <option value="">Seleccionar categoría...</option>
                  {categories.filter(c => c.active !== false).map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Lugar</label>
                <input className="form-control" value={actForm.place}
                  onChange={e => setActForm(f => ({ ...f, place: e.target.value }))}
                  placeholder="Ej: Maldonado, Uruguay" />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Presupuesto USD</label>
                  <input className="form-control" type="number" step="0.01" value={actForm.budget_usd}
                    onChange={e => setActForm(f => ({ ...f, budget_usd: e.target.value }))} placeholder="Opcional" />
                </div>
                <div className="form-group">
                  <label className="form-label">Presupuesto UYU</label>
                  <input className="form-control" type="number" step="0.01" value={actForm.budget_uyu}
                    onChange={e => setActForm(f => ({ ...f, budget_uyu: e.target.value }))} placeholder="Opcional" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setActModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={savingAct}>
                  {savingAct ? 'Guardando...' : editingAct ? 'Guardar cambios' : 'Crear actividad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
