import { useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'

const EMPTY = { objective: '', activity_name: '', category_id: '', detail: '', amount_uyu: '', amount_usd: '' }

function fmtNum(n, cur) {
  if (!n && n !== 0) return '—'
  if (cur === 'USD') return `U$D ${Number(n).toLocaleString('es-UY', { minimumFractionDigits: 2 })}`
  return `$U ${Number(n).toLocaleString('es-UY', { minimumFractionDigits: 2 })}`
}

export default function BudgetModal({ project, onClose }) {
  const [items, setItems]         = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading]     = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm]   = useState(EMPTY)
  const [addForm, setAddForm]     = useState(EMPTY)
  const [adding, setAdding]       = useState(false)
  const [saving, setSaving]       = useState(false)

  // Import
  const importRef = useRef()
  const [importRows, setImportRows]     = useState(null)
  const [categoryMap, setCategoryMap]   = useState({})
  const [importing, setImporting]       = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: its }, { data: cats }] = await Promise.all([
      supabase.from('budget_items').select('*').eq('project_id', project.id)
        .order('sort_order').order('created_at'),
      supabase.from('categories').select('*').order('name'),
    ])
    setItems(its || [])
    setCategories(cats || [])
    setLoading(false)
  }

  const catName = id => { const c = categories.find(c => c.id === id); return c ? `${c.icon || ''} ${c.name}` : '—' }
  const totalUYU = items.reduce((s, i) => s + Number(i.amount_uyu || 0), 0)
  const totalUSD = items.reduce((s, i) => s + Number(i.amount_usd || 0), 0)

  // Agrupar por objetivo
  const grouped = items.reduce((acc, item) => {
    const key = item.objective || '__sin__'
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  // — CRUD —
  async function startEdit(item) {
    setEditingId(item.id)
    setEditForm({
      objective: item.objective || '',
      activity_name: item.activity_name || '',
      category_id: item.category_id ? String(item.category_id) : '',
      detail: item.detail || '',
      amount_uyu: item.amount_uyu || '',
      amount_usd: item.amount_usd || '',
    })
  }

  async function saveEdit() {
    setSaving(true)
    await supabase.from('budget_items').update({
      objective: editForm.objective.trim() || null,
      activity_name: editForm.activity_name.trim() || null,
      category_id: editForm.category_id ? parseInt(editForm.category_id) : null,
      detail: editForm.detail.trim(),
      amount_uyu: Number(editForm.amount_uyu) || 0,
      amount_usd: Number(editForm.amount_usd) || 0,
    }).eq('id', editingId)
    setEditingId(null)
    setSaving(false)
    loadData()
  }

  async function saveAdd() {
    if (!addForm.detail.trim()) return
    setSaving(true)
    await supabase.from('budget_items').insert({
      project_id: project.id,
      objective: addForm.objective.trim() || null,
      activity_name: addForm.activity_name.trim() || null,
      category_id: addForm.category_id ? parseInt(addForm.category_id) : null,
      detail: addForm.detail.trim(),
      amount_uyu: Number(addForm.amount_uyu) || 0,
      amount_usd: Number(addForm.amount_usd) || 0,
      sort_order: items.length,
    })
    setAdding(false)
    setAddForm(EMPTY)
    setSaving(false)
    loadData()
  }

  async function deleteItem(id) {
    if (!confirm('¿Eliminar esta línea del presupuesto?')) return
    await supabase.from('budget_items').delete().eq('id', id)
    loadData()
  }

  // — EXPORT —
  function exportExcel() {
    const wb = XLSX.utils.book_new()

    // ── Hoja presupuesto ──
    const rows = []
    rows.push([`PRESUPUESTO: ${project.name}`])
    if (project.description) rows.push([project.description])
    rows.push([`Período: ${project.start_date || '—'} → ${project.end_date || '—'}`])
    rows.push([])
    rows.push(['Objetivo', 'Actividad', 'Categoría', 'Detalle', 'Monto $U', 'Monto U$D'])

    Object.entries(grouped).forEach(([obj, its]) => {
      its.forEach(item => {
        rows.push([
          obj === '__sin__' ? '' : obj,
          item.activity_name || '',
          catName(item.category_id),
          item.detail,
          Number(item.amount_uyu) || 0,
          Number(item.amount_usd) || 0,
        ])
      })
      const subUYU = its.reduce((s, i) => s + Number(i.amount_uyu || 0), 0)
      const subUSD = its.reduce((s, i) => s + Number(i.amount_usd || 0), 0)
      rows.push(['', '', '', `Subtotal ${obj === '__sin__' ? 'sin objetivo' : obj}`, subUYU || '', subUSD || ''])
      rows.push([])
    })

    rows.push(['', '', '', 'TOTAL GENERAL', totalUYU || '', totalUSD || ''])

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 36 }, { wch: 28 }, { wch: 20 }, { wch: 42 }, { wch: 14 }, { wch: 14 }]
    // Bold the header row (row 5, index 4)
    XLSX.utils.book_append_sheet(wb, ws, 'Presupuesto')

    // ── Hoja plantilla ──
    const tmpl = [
      ['objetivo', 'actividad', 'categoria', 'detalle', 'monto_uyu', 'monto_usd'],
      ['Salidas de campo 2025', 'Trabajo de campo', 'Transporte', 'Combustible viaje Rocha 120km', 60000, 0],
      ['Salidas de campo 2025', 'Trabajo de campo', 'Honorarios', '3 personas 5 meses', 360000, 0],
      ['Estudio registros', 'Foto-id 2024', 'Honorarios', '2 investigadores 15h/sem 3 meses', 0, 4320],
    ]
    const wsTmpl = XLSX.utils.aoa_to_sheet(tmpl)
    wsTmpl['!cols'] = ws['!cols']
    XLSX.utils.book_append_sheet(wb, wsTmpl, 'Plantilla importación')

    XLSX.writeFile(wb, `Presupuesto_${project.name.replace(/\s+/g, '_')}.xlsx`)
  }

  // — IMPORT —
  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(ws, { defval: '' })
      // Normalizar claves
      const normalized = raw.map(r => {
        const obj = {}
        Object.entries(r).forEach(([k, v]) => { obj[k.toLowerCase().trim().replace(/ /g, '_')] = v })
        return obj
      }).filter(r => (r.detalle || r.detail || '').toString().trim())

      setImportRows(normalized)

      // Autocompletar mapeo de categorías
      const uniqueCats = [...new Set(normalized.map(r => (r.categoria || r.category || '').toString().trim()))].filter(Boolean)
      const map = {}
      uniqueCats.forEach(cat => {
        const match = categories.find(c => c.name.toLowerCase() === cat.toLowerCase())
        map[cat] = match ? String(match.id) : ''
      })
      setCategoryMap(map)
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  async function confirmImport() {
    if (!importRows?.length) return
    setImporting(true)
    const toInsert = importRows.map((r, i) => ({
      project_id: project.id,
      objective: (r.objetivo || r.objective || '').toString().trim() || null,
      activity_name: (r.actividad || r.activity || '').toString().trim() || null,
      category_id: categoryMap[(r.categoria || r.category || '').toString().trim()]
        ? parseInt(categoryMap[(r.categoria || r.category || '').toString().trim()])
        : null,
      detail: (r.detalle || r.detail || '').toString().trim(),
      amount_uyu: Number(r.monto_uyu || r.amount_uyu || r.uyu || 0),
      amount_usd: Number(r.monto_usd || r.amount_usd || r.usd || 0),
      sort_order: items.length + i,
    }))
    const { error } = await supabase.from('budget_items').insert(toInsert)
    if (error) alert('Error al importar: ' + error.message)
    else { setImportRows(null); loadData() }
    setImporting(false)
  }

  const inputStyle = { padding: '4px 8px', fontSize: 12, border: '1px solid var(--border-mid)', borderRadius: 6, background: 'var(--surface)', width: '100%', fontFamily: 'inherit' }
  const uniqueCats = importRows ? [...new Set(importRows.map(r => (r.categoria || r.category || '').toString().trim()))].filter(Boolean) : []

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 900, width: '96vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div>
            <div className="modal-title">Presupuesto — {project.name}</div>
            {(project.start_date || project.end_date) && (
              <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 2 }}>
                {project.start_date || '—'} → {project.end_date || '—'}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input ref={importRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />
            <button className="btn btn-ghost btn-sm" onClick={() => importRef.current.click()}>↑ Importar Excel</button>
            <button className="btn btn-ghost btn-sm" onClick={exportExcel} disabled={items.length === 0}>↓ Exportar Excel</button>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Totales */}
        {(totalUYU > 0 || totalUSD > 0) && (
          <div style={{ display: 'flex', gap: 12, padding: '10px 0', flexShrink: 0 }}>
            {totalUYU > 0 && (
              <div className="metric-card" style={{ flex: 1, padding: '10px 14px' }}>
                <div className="metric-label">Total presupuestado UYU</div>
                <div className="metric-value" style={{ fontSize: 20 }}>{fmtNum(totalUYU, 'UYU')}</div>
              </div>
            )}
            {totalUSD > 0 && (
              <div className="metric-card" style={{ flex: 1, padding: '10px 14px' }}>
                <div className="metric-label">Total presupuestado USD</div>
                <div className="metric-value" style={{ fontSize: 20 }}>{fmtNum(totalUSD, 'USD')}</div>
              </div>
            )}
          </div>
        )}

        {/* Tabla */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {loading ? <div className="empty-state">Cargando...</div> : (
            <>
              <div className="table-wrap">
                <table style={{ fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th>Objetivo</th>
                      <th>Actividad</th>
                      <th>Categoría</th>
                      <th>Detalle</th>
                      <th style={{ textAlign: 'right' }}>$U</th>
                      <th style={{ textAlign: 'right' }}>U$D</th>
                      <th style={{ width: 80 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.id}>
                        {editingId === item.id ? (
                          <>
                            <td><input style={inputStyle} value={editForm.objective} onChange={e => setEditForm(f => ({ ...f, objective: e.target.value }))} placeholder="Objetivo" /></td>
                            <td><input style={inputStyle} value={editForm.activity_name} onChange={e => setEditForm(f => ({ ...f, activity_name: e.target.value }))} placeholder="Actividad" /></td>
                            <td>
                              <select style={inputStyle} value={editForm.category_id} onChange={e => setEditForm(f => ({ ...f, category_id: e.target.value }))}>
                                <option value="">—</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                              </select>
                            </td>
                            <td><input style={inputStyle} value={editForm.detail} onChange={e => setEditForm(f => ({ ...f, detail: e.target.value }))} placeholder="Detalle *" required /></td>
                            <td><input style={{ ...inputStyle, textAlign: 'right' }} type="number" value={editForm.amount_uyu} onChange={e => setEditForm(f => ({ ...f, amount_uyu: e.target.value }))} placeholder="0" /></td>
                            <td><input style={{ ...inputStyle, textAlign: 'right' }} type="number" value={editForm.amount_usd} onChange={e => setEditForm(f => ({ ...f, amount_usd: e.target.value }))} placeholder="0" /></td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <button className="btn btn-primary btn-sm" disabled={saving} onClick={saveEdit}>✓</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)} style={{ marginLeft: 4 }}>✕</button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ color: 'var(--ink-light)', fontSize: 11 }}>{item.objective || ''}</td>
                            <td style={{ color: 'var(--ink-light)', fontSize: 11 }}>{item.activity_name || ''}</td>
                            <td><span className="tag tag-gray" style={{ fontSize: 11 }}>{item.category_id ? catName(item.category_id) : '—'}</span></td>
                            <td style={{ fontWeight: 500 }}>{item.detail}</td>
                            <td style={{ textAlign: 'right', color: item.amount_uyu ? 'var(--ink)' : 'var(--ink-faint)' }}>{item.amount_uyu ? fmtNum(item.amount_uyu, 'UYU') : '—'}</td>
                            <td style={{ textAlign: 'right', color: item.amount_usd ? 'var(--ink)' : 'var(--ink-faint)' }}>{item.amount_usd ? fmtNum(item.amount_usd, 'USD') : '—'}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => startEdit(item)}>Editar</button>
                              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-mid)', marginLeft: 4 }} onClick={() => deleteItem(item.id)}>✕</button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}

                    {/* Fila de agregar */}
                    {adding && (
                      <tr style={{ background: 'var(--ocean-mist)' }}>
                        <td><input style={inputStyle} value={addForm.objective} onChange={e => setAddForm(f => ({ ...f, objective: e.target.value }))} placeholder="Objetivo" /></td>
                        <td><input style={inputStyle} value={addForm.activity_name} onChange={e => setAddForm(f => ({ ...f, activity_name: e.target.value }))} placeholder="Actividad" /></td>
                        <td>
                          <select style={inputStyle} value={addForm.category_id} onChange={e => setAddForm(f => ({ ...f, category_id: e.target.value }))}>
                            <option value="">—</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                          </select>
                        </td>
                        <td><input style={inputStyle} value={addForm.detail} onChange={e => setAddForm(f => ({ ...f, detail: e.target.value }))} placeholder="Detalle *" autoFocus /></td>
                        <td><input style={{ ...inputStyle, textAlign: 'right' }} type="number" value={addForm.amount_uyu} onChange={e => setAddForm(f => ({ ...f, amount_uyu: e.target.value }))} placeholder="0" /></td>
                        <td><input style={{ ...inputStyle, textAlign: 'right' }} type="number" value={addForm.amount_usd} onChange={e => setAddForm(f => ({ ...f, amount_usd: e.target.value }))} placeholder="0" /></td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="btn btn-primary btn-sm" disabled={saving || !addForm.detail.trim()} onClick={saveAdd}>✓</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setAdding(false); setAddForm(EMPTY) }} style={{ marginLeft: 4 }}>✕</button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {!adding && (
                <div style={{ padding: '10px 0' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setAdding(true); setAddForm(EMPTY) }}>+ Agregar línea</button>
                </div>
              )}

              {items.length === 0 && !adding && (
                <div className="empty-state" style={{ padding: '24px 0' }}>
                  Sin líneas de presupuesto. Importá un Excel o agregá líneas manualmente.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── MODAL IMPORT PREVIEW ── */}
      {importRows && (
        <div className="modal-backdrop" style={{ zIndex: 300 }} onClick={e => e.target === e.currentTarget && setImportRows(null)}>
          <div className="modal" style={{ maxWidth: 700, width: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ flexShrink: 0 }}>
              <div className="modal-title">Importar presupuesto</div>
              <button className="modal-close" onClick={() => setImportRows(null)}>✕</button>
            </div>

            <div style={{ fontSize: 13, color: 'var(--ink-light)', marginBottom: 12, flexShrink: 0 }}>
              Se van a importar <strong>{importRows.length} líneas</strong>. Mapeá las categorías del archivo a las de la app:
            </div>

            {uniqueCats.length > 0 && (
              <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', padding: 14, marginBottom: 14, flexShrink: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 10 }}>Mapeo de categorías</div>
                {uniqueCats.map(cat => (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <span style={{ minWidth: 160, fontSize: 13, fontWeight: 500 }}>{cat}</span>
                    <span style={{ color: 'var(--ink-faint)' }}>→</span>
                    <select className="form-control" style={{ flex: 1, fontSize: 13 }}
                      value={categoryMap[cat] || ''}
                      onChange={e => setCategoryMap(m => ({ ...m, [cat]: e.target.value }))}>
                      <option value="">Sin categoría</option>
                      {categories.map(c => <option key={c.id} value={String(c.id)}>{c.icon} {c.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              <div className="table-wrap">
                <table style={{ fontSize: 12 }}>
                  <thead>
                    <tr><th>Objetivo</th><th>Actividad</th><th>Categoría (archivo)</th><th>Detalle</th><th>$U</th><th>U$D</th></tr>
                  </thead>
                  <tbody>
                    {importRows.map((r, i) => (
                      <tr key={i}>
                        <td style={{ color: 'var(--ink-light)' }}>{r.objetivo || r.objective || ''}</td>
                        <td style={{ color: 'var(--ink-light)' }}>{r.actividad || r.activity || ''}</td>
                        <td><span className="tag tag-gray" style={{ fontSize: 11 }}>{r.categoria || r.category || '—'}</span></td>
                        <td style={{ fontWeight: 500 }}>{r.detalle || r.detail}</td>
                        <td style={{ textAlign: 'right' }}>{r.monto_uyu || r.amount_uyu || ''}</td>
                        <td style={{ textAlign: 'right' }}>{r.monto_usd || r.amount_usd || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16, flexShrink: 0 }}>
              <button className="btn btn-ghost" onClick={() => setImportRows(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={importing} onClick={confirmImport}>
                {importing ? 'Importando...' : `Importar ${importRows.length} líneas`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
