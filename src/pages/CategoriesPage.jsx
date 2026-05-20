import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const EMPTY_CAT = { name: '', icon: '' }
const EMPTY_ACT = { name: '', description: '', place: '', category_id: '', budget_usd: '', budget_uyu: '' }
const EMPTY_GRP = { name: '' }
const EMPTY_SUP = { razon_social: '', name: '', category_id: '' }
const PAGE = 5

function fmt(amount, currency) {
  if (!amount) return null
  if (currency === 'USD') return `U$D ${Number(amount).toLocaleString('es-UY', { minimumFractionDigits: 2 })}`
  return `$U ${Number(amount).toLocaleString('es-UY', { minimumFractionDigits: 2 })}`
}

function PageNav({ page, total, onPage }) {
  const pages = Math.ceil(total / PAGE)
  if (pages <= 1) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, justifyContent: 'center' }}>
      <button className="btn btn-ghost btn-sm" onClick={() => onPage(page - 1)} disabled={page === 0}>←</button>
      <span style={{ fontSize: 13, color: 'var(--ink-light)' }}>{page + 1} / {pages}</span>
      <button className="btn btn-ghost btn-sm" onClick={() => onPage(page + 1)} disabled={page >= pages - 1}>→</button>
    </div>
  )
}

export default function CategoriesPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const [categories, setCategories] = useState([])
  const [activities, setActivities] = useState([])
  const [groups, setGroups] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)

  // pagination
  const [catPage, setCatPage] = useState(0)
  const [actPage, setActPage] = useState(0)
  const [supPage, setSupPage] = useState(0)
  const [grpPage, setGrpPage] = useState(0)

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
  const [filterSupCat, setFilterSupCat] = useState('')

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

  // — Categories —
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

  async function deleteCat(cat) {
    if (!confirm(`¿Eliminar la categoría "${cat.name}"?`)) return
    const [{ count: expCount }, { count: actCount }, { count: supCount }] = await Promise.all([
      supabase.from('expenses').select('*', { count: 'exact', head: true }).eq('category_id', cat.id),
      supabase.from('activities').select('*', { count: 'exact', head: true }).eq('category_id', cat.id),
      supabase.from('suppliers').select('*', { count: 'exact', head: true }).eq('category_id', cat.id),
    ])
    if (expCount > 0) {
      alert(`No se puede eliminar: hay ${expCount} gasto${expCount !== 1 ? 's' : ''} en esta categoría.`)
      return
    }
    if (actCount > 0) {
      alert(`No se puede eliminar: hay ${actCount} actividad${actCount !== 1 ? 'es' : ''} en esta categoría.\nEliminalas primero desde el panel de Actividades.`)
      return
    }
    if (supCount > 0) {
      alert(`No se puede eliminar: hay ${supCount} proveedor${supCount !== 1 ? 'es' : ''} asignado${supCount !== 1 ? 's' : ''} a esta categoría.\nDesasignalos primero editando cada proveedor.`)
      return
    }
    const { data: deleted, error } = await supabase.from('categories').delete().eq('id', cat.id).select()
    if (error) { alert(`Error al eliminar: ${error.message}`); return }
    if (!deleted || deleted.length === 0) { alert('No se pudo eliminar. Verificá que tenés permiso de borrar en Supabase (política RLS de DELETE en tabla categories).'); return }
    loadData()
  }

  // — Activities —
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

  async function deleteAct(act) {
    if (!confirm(`¿Eliminar la actividad "${act.name}"?`)) return
    const { count } = await supabase.from('expenses').select('*', { count: 'exact', head: true }).eq('activity_id', act.id)
    if (count > 0) { alert(`No se puede eliminar: hay ${count} gasto${count !== 1 ? 's' : ''} asociado${count !== 1 ? 's' : ''} a esta actividad.`); return }
    const { error } = await supabase.from('activities').delete().eq('id', act.id)
    if (error) alert('Error: ' + error.message)
    else loadData()
  }

  // — Groups —
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

  // — Suppliers —
  function openNewSup() { setEditingSup(null); setSupForm(EMPTY_SUP); setSupModal(true) }
  function openEditSup(s) { setEditingSup(s); setSupForm({ razon_social: s.razon_social, name: s.name || '', category_id: s.category_id ? String(s.category_id) : '' }); setSupModal(true) }

  async function saveSup(e) {
    e.preventDefault()
    setSavingSup(true)
    const payload = { razon_social: supForm.razon_social.trim(), name: supForm.name.trim() || null, category_id: supForm.category_id ? parseInt(supForm.category_id) : null, status: 'active', active: true }
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

  async function deleteSup(s) {
    if (!confirm(`¿Anular el proveedor "${s.razon_social}"? Esta acción no se puede deshacer.`)) return
    const { count } = await supabase.from('expenses').select('*', { count: 'exact', head: true }).eq('supplier_id', s.id)
    if (count > 0) { alert(`No se puede anular: hay ${count} gasto${count !== 1 ? 's' : ''} registrado${count !== 1 ? 's' : ''} con este proveedor.`); return }
    const { error } = await supabase.from('suppliers').delete().eq('id', s.id)
    if (error) { alert('Error al anular: ' + error.message); return }
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

  // — Derived lists —
  const filteredActivities = filterCategory
    ? activities.filter(a => String(a.category_id) === filterCategory)
    : activities

  const pendingSuppliers = suppliers.filter(s => s.status === 'pending')
  const activeSuppliers = suppliers.filter(s => s.status !== 'pending' && (!filterSupCat || String(s.category_id) === filterSupCat))

  // paginated slices
  const catSlice = categories.slice(catPage * PAGE, (catPage + 1) * PAGE)
  const actSlice = filteredActivities.slice(actPage * PAGE, (actPage + 1) * PAGE)
  const supSlice = activeSuppliers.slice(supPage * PAGE, (supPage + 1) * PAGE)
  const grpSlice = groups.slice(grpPage * PAGE, (grpPage + 1) * PAGE)

  const rowStyle = { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border)' }
  const panelStyle = { background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: '16px' }
  const panelHeader = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }
  const panelTitle = { fontWeight: 700, fontSize: 15 }
  const smBtns = { display: 'flex', gap: 4, flexShrink: 0 }

  if (loading) return <div className="empty-state">Cargando...</div>

  return (
    <div>

      {/* ── GRID 2×2 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

        {/* ── CATEGORÍAS ── */}
        <div style={panelStyle}>
          <div style={panelHeader}>
            <span style={panelTitle}>Categorías</span>
            {isAdmin && <button className="btn btn-primary btn-sm" onClick={openNewCat}>+ Nueva</button>}
          </div>
          {categories.length === 0
            ? <div className="empty-state" style={{ padding: '8px 0' }}>Sin categorías.</div>
            : <>
                {catSlice.map(cat => (
                  <div key={cat.id} style={{ ...rowStyle, opacity: cat.active === false ? 0.5 : 1 }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{cat.icon || '📦'}</span>
                    <span style={{ flex: 1, fontWeight: 500, fontSize: 13 }}>{cat.name}</span>
                    <span className={`tag ${cat.active === false ? 'tag-gray' : 'tag-green'}`} style={{ fontSize: 11 }}>
                      {cat.active === false ? 'Inactiva' : 'Activa'}
                    </span>
                    {isAdmin && (
                      <div style={smBtns}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEditCat(cat)}>Editar</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleCat(cat)}>{cat.active === false ? 'Activar' : 'Pausar'}</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-mid)' }} onClick={() => deleteCat(cat)}>Eliminar</button>
                      </div>
                    )}
                  </div>
                ))}
                <PageNav page={catPage} total={categories.length} onPage={setCatPage} />
              </>
          }
        </div>

        {/* ── ACTIVIDADES ── */}
        <div style={panelStyle}>
          <div style={panelHeader}>
            <span style={panelTitle}>Actividades</span>
            {isAdmin && <button className="btn btn-primary btn-sm" onClick={openNewAct}>+ Nueva</button>}
          </div>
          <div style={{ marginBottom: 10 }}>
            <select className="form-control" style={{ fontSize: 13 }}
              value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setActPage(0) }}>
              <option value="">Todas las categorías</option>
              {categories.map(c => <option key={c.id} value={String(c.id)}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          {filteredActivities.length === 0
            ? <div className="empty-state" style={{ padding: '8px 0' }}>Sin actividades{filterCategory ? ' en esta categoría' : ''}.</div>
            : <>
                {actSlice.map(act => (
                  <div key={act.id} style={{ ...rowStyle, flexWrap: 'wrap', opacity: act.active === false ? 0.5 : 1 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{act.name}</div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                        {act.categories && <span className="tag tag-gray" style={{ fontSize: 11 }}>{act.categories.icon} {act.categories.name}</span>}
                        {act.place && <span className="tag tag-gray" style={{ fontSize: 11 }}>📍 {act.place}</span>}
                        <span className={`tag ${act.active === false ? 'tag-gray' : 'tag-green'}`} style={{ fontSize: 11 }}>
                          {act.active === false ? 'Inactiva' : 'Activa'}
                        </span>
                      </div>
                    </div>
                    {isAdmin && (
                      <div style={smBtns}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEditAct(act)}>Editar</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleAct(act)}>{act.active === false ? 'Activar' : 'Pausar'}</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-mid)' }} onClick={() => deleteAct(act)}>Eliminar</button>
                      </div>
                    )}
                  </div>
                ))}
                <PageNav page={actPage} total={filteredActivities.length} onPage={setActPage} />
              </>
          }
        </div>

        {/* ── PROVEEDORES ── */}
        <div style={panelStyle}>
          <div style={panelHeader}>
            <span style={panelTitle}>Proveedores</span>
            {isAdmin && <button className="btn btn-primary btn-sm" onClick={openNewSup}>+ Nuevo</button>}
          </div>
          <div style={{ marginBottom: 10 }}>
            <select className="form-control" style={{ fontSize: 13 }}
              value={filterSupCat} onChange={e => { setFilterSupCat(e.target.value); setSupPage(0) }}>
              <option value="">Todas las categorías</option>
              {categories.map(c => <option key={c.id} value={String(c.id)}>{c.icon} {c.name}</option>)}
            </select>
          </div>

          {isAdmin && pendingSuppliers.length > 0 && (
            <div style={{ background: '#fffbf0', border: '1px solid #f0c87a', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: '#92600a', marginBottom: 8 }}>⏳ Pendientes ({pendingSuppliers.length})</div>
              {pendingSuppliers.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #f0c87a' }}>
                  <div style={{ flex: 1, fontSize: 13 }}>
                    <span style={{ fontWeight: 500 }}>{s.razon_social}</span>
                    {s.requester?.full_name && <span style={{ fontSize: 11, color: '#92600a', marginLeft: 6 }}>({s.requester.full_name})</span>}
                  </div>
                  <button className="btn btn-sm btn-primary" onClick={() => approveSup(s)}>Aprobar</button>
                  <button className="btn btn-sm btn-ghost" style={{ color: 'var(--red-mid)' }} onClick={() => rejectSup(s)}>Rechazar</button>
                </div>
              ))}
            </div>
          )}

          {activeSuppliers.length === 0
            ? <div className="empty-state" style={{ padding: '8px 0' }}>Sin proveedores.</div>
            : <>
                {supSlice.map(s => {
                  const cat = categories.find(c => c.id === s.category_id)
                  return (
                    <div key={s.id} style={{ ...rowStyle, flexWrap: 'wrap', opacity: !s.active ? 0.5 : 1 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{s.razon_social}</div>
                        <div style={{ display: 'flex', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                          {s.name && <span className="tag tag-gray" style={{ fontSize: 11 }}>📍 {s.name}</span>}
                          {cat && <span className="tag tag-gray" style={{ fontSize: 11 }}>{cat.icon} {cat.name}</span>}
                        </div>
                      </div>
                      <span className={`tag ${s.active ? 'tag-green' : 'tag-gray'}`} style={{ fontSize: 11 }}>
                        {s.active ? 'Activo' : 'Inactivo'}
                      </span>
                      {isAdmin && s.status !== 'rejected' && (
                        <div style={smBtns}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEditSup(s)}>Editar</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => toggleSup(s)}>{s.active ? 'Pausar' : 'Activar'}</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-mid)' }} onClick={() => deleteSup(s)}>Anular</button>
                        </div>
                      )}
                    </div>
                  )
                })}
                <PageNav page={supPage} total={activeSuppliers.length} onPage={setSupPage} />
              </>
          }
        </div>

        {/* ── GRUPOS (solo admin) ── */}
        {isAdmin && (
          <div style={panelStyle}>
            <div style={panelHeader}>
              <span style={panelTitle}>Grupos</span>
              <button className="btn btn-primary btn-sm" onClick={openNewGrp}>+ Nuevo</button>
            </div>
            {groups.length === 0
              ? <div className="empty-state" style={{ padding: '8px 0' }}>Sin grupos.</div>
              : <>
                  {grpSlice.map(g => (
                    <div key={g.id} style={rowStyle}>
                      <span style={{ flex: 1, fontWeight: 500, fontSize: 13 }}>👥 {g.name}</span>
                      <div style={smBtns}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEditGrp(g)}>Editar</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-mid)' }} onClick={() => deleteGrp(g)}>Eliminar</button>
                      </div>
                    </div>
                  ))}
                  <PageNav page={grpPage} total={groups.length} onPage={setGrpPage} />
                </>
            }
          </div>
        )}

      </div>

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
                <label className="form-label">Categoría</label>
                <select className="form-control" value={supForm.category_id}
                  onChange={e => setSupForm(f => ({ ...f, category_id: e.target.value }))}>
                  <option value="">Sin categoría</option>
                  {categories.map(c => <option key={c.id} value={String(c.id)}>{c.icon} {c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Departamento</label>
                <select className="form-control" value={supForm.name}
                  onChange={e => setSupForm(f => ({ ...f, name: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {['Artigas','Canelones','Cerro Largo','Colonia','Durazno','Flores','Florida',
                    'Lavalleja','Maldonado','Montevideo','Paysandú','Río Negro','Rivera','Rocha',
                    'Salto','San José','Soriano','Tacuarembó','Treinta y Tres','Exterior de UY'
                  ].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
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
