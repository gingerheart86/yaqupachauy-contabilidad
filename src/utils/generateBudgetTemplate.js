import ExcelJS from 'exceljs'

const DEEP   = 'FF042C53'
const MID    = 'FF185FA5'
const BRIGHT = 'FF378ADD'
const PALE   = 'FFB5D4F4'
const MIST   = 'FFE6F1FB'
const TEAL   = 'FF1D9E75'
const WHITE  = 'FFFFFFFF'
const INK    = 'FF1a1f2e'
const FAINT  = 'FFA8B0C8'

function headerRow(ws, row, text, color = MID) {
  ws.mergeCells(`A${row}:F${row}`)
  const c = ws.getCell(`A${row}`)
  c.value = text
  c.font = { bold: true, size: 11, color: { argb: WHITE } }
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } }
  c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  ws.getRow(row).height = 22
}

function fieldRow(ws, row, label, placeholder = '', note = '') {
  const lc = ws.getCell(`A${row}`)
  lc.value = label
  lc.font = { bold: true, size: 10, color: { argb: DEEP } }
  lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MIST } }
  lc.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  lc.border = { bottom: { style: 'thin', color: { argb: PALE } } }

  ws.mergeCells(`B${row}:F${row}`)
  const vc = ws.getCell(`B${row}`)
  if (placeholder) {
    vc.value = placeholder
    vc.font = { italic: true, size: 10, color: { argb: FAINT } }
  }
  vc.border = { bottom: { style: 'thin', color: { argb: PALE } } }
  vc.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  ws.getRow(row).height = 20
  return vc
}

export async function generateBudgetTemplate({ categories = [], groups = [], users = [] } = {}) {
  const wb = new ExcelJS.Workbook()
  wb.creator  = 'Yaqu Pacha Uruguay'
  wb.created  = new Date()
  wb.modified = new Date()

  // ──────────────────────────────────────────────────
  //  HOJA 1 — PORTADA DEL PROYECTO
  // ──────────────────────────────────────────────────
  const ws1 = wb.addWorksheet('Portada del Proyecto', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
    views: [{ showGridLines: false }],
  })

  ws1.columns = [
    { width: 26 },
    { width: 22 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
  ]

  // Logo
  try {
    const logoResp = await fetch('/logo-yp.png')
    const logoBuffer = await logoResp.arrayBuffer()
    const logoId = wb.addImage({ buffer: logoBuffer, extension: 'png' })
    ws1.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 220, height: 88 } })
  } catch (_) { /* sin logo si no se puede cargar */ }

  // Filas 1–3: espacio para el logo
  ws1.getRow(1).height = 30
  ws1.getRow(2).height = 30
  ws1.getRow(3).height = 30

  // Título principal
  ws1.mergeCells('A4:F4')
  const titleCell = ws1.getCell('A4')
  titleCell.value = 'YAQU PACHA URUGUAY — PRESUPUESTO DE PROYECTO'
  titleCell.font = { bold: true, size: 14, color: { argb: WHITE } }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DEEP } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
  ws1.getRow(4).height = 28

  ws1.getRow(5).height = 8 // separador

  // ── DATOS DEL PROYECTO ──
  let r = 6
  headerRow(ws1, r++, 'DATOS DEL PROYECTO')
  fieldRow(ws1, r++, 'Nombre del proyecto', 'Completar...')
  fieldRow(ws1, r++, 'Fecha de inicio', 'DD/MM/AAAA')
  fieldRow(ws1, r++, 'Fecha de fin', 'DD/MM/AAAA')
  fieldRow(ws1, r++, 'Duración', 'Ej: 12 meses (Jun 2025 – May 2026)')
  ws1.getRow(r++).height = 8

  // ── FASES ──
  headerRow(ws1, r++, 'FASES DEL PROYECTO')
  fieldRow(ws1, r++, 'Fase 1', 'Ej: Salidas de campo (Jun – Oct 2025)')
  fieldRow(ws1, r++, 'Fase 2', 'Ej: Análisis y redacción (Nov 2025 – Ene 2026)')
  fieldRow(ws1, r++, 'Fase 3', 'Completar si aplica')
  ws1.getRow(r++).height = 8

  // ── EQUIPO DE TRABAJO ──
  headerRow(ws1, r++, 'EQUIPO DE TRABAJO')

  // Grupo de trabajo con dropdown
  const grpLbl = ws1.getCell(`A${r}`)
  grpLbl.value = 'Grupo de trabajo'
  grpLbl.font = { bold: true, size: 10, color: { argb: DEEP } }
  grpLbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MIST } }
  grpLbl.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  grpLbl.border = { bottom: { style: 'thin', color: { argb: PALE } } }
  ws1.mergeCells(`B${r}:F${r}`)
  const grpVal = ws1.getCell(`B${r}`)
  grpVal.border = { bottom: { style: 'thin', color: { argb: PALE } } }
  grpVal.alignment = { vertical: 'middle', indent: 1 }
  if (groups.length > 0) {
    grpVal.dataValidation = {
      type: 'list', allowBlank: true,
      formulae: [`"${groups.map(g => g.name).join(',')}"`],
    }
    grpVal.value = ''
    grpVal.font = { italic: true, size: 10, color: { argb: FAINT } }
    grpVal.value = groups.length > 0 ? `(${groups.map(g => g.name).join(' / ')})` : ''
    grpVal.font = { italic: true, size: 10, color: { argb: FAINT } }
  }
  ws1.getRow(r).height = 20
  r++

  // Integrantes
  const memberRows = Math.max(users.length, 1)
  for (let i = 0; i < memberRows; i++) {
    const lc = ws1.getCell(`A${r + i}`)
    lc.value = i === 0 ? 'Integrantes' : ''
    lc.font = { bold: i === 0, size: 10, color: { argb: DEEP } }
    lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MIST } }
    lc.alignment = { vertical: 'middle', indent: 1 }
    lc.border = { bottom: { style: 'thin', color: { argb: PALE } } }
    ws1.mergeCells(`B${r + i}:F${r + i}`)
    const vc = ws1.getCell(`B${r + i}`)
    vc.value = users[i]?.full_name || ''
    vc.font = { size: 10, color: { argb: INK } }
    vc.border = { bottom: { style: 'thin', color: { argb: PALE } } }
    vc.alignment = { vertical: 'middle', indent: 1 }
    ws1.getRow(r + i).height = 19
  }
  r += memberRows
  ws1.getRow(r++).height = 8

  // ── FINANCIAMIENTO ──
  headerRow(ws1, r++, 'FINANCIAMIENTO', TEAL)
  fieldRow(ws1, r++, 'Organización financiadora', 'Ej: WWF, GEF, Embajada de...')
  fieldRow(ws1, r++, 'Monto solicitado $U', '0')
  fieldRow(ws1, r++, 'Monto solicitado U$D', '0')
  fieldRow(ws1, r++, 'Fecha de envío del presupuesto', 'DD/MM/AAAA')
  fieldRow(ws1, r++, 'Estado', 'Ej: En preparación / Enviado / Aprobado')

  // ──────────────────────────────────────────────────
  //  HOJA 2 — PRESUPUESTO (datos)
  // ──────────────────────────────────────────────────
  const ws2 = wb.addWorksheet('Presupuesto', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  })

  ws2.columns = [
    { key: 'objetivo',   header: 'objetivo',   width: 34 },
    { key: 'actividad',  header: 'actividad',  width: 30 },
    { key: 'categoria',  header: 'categoria',  width: 22 },
    { key: 'detalle',    header: 'detalle',    width: 44 },
    { key: 'monto_uyu',  header: 'monto_uyu',  width: 14 },
    { key: 'monto_usd',  header: 'monto_usd',  width: 14 },
  ]

  // Estilo encabezado
  ws2.getRow(1).eachCell(cell => {
    cell.font = { bold: true, size: 11, color: { argb: WHITE } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DEEP } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = { right: { style: 'thin', color: { argb: BRIGHT } } }
  })
  ws2.getRow(1).height = 26

  // Dropdown de categorías en columna C (filas 2–200)
  const catList = categories.map(c => c.name).join(',')
  if (catList) {
    for (let row = 2; row <= 200; row++) {
      ws2.getCell(`C${row}`).dataValidation = {
        type: 'list', allowBlank: true,
        formulae: [`"${catList}"`],
        showErrorMessage: true,
        errorTitle: 'Categoría inválida',
        error: 'Seleccioná una categoría de la lista',
      }
    }
  }

  // Formato numérico en columnas E y F
  for (let row = 2; row <= 200; row++) {
    ws2.getCell(`E${row}`).numFmt = '#,##0.00'
    ws2.getCell(`F${row}`).numFmt = '#,##0.00'
  }

  // Datos de ejemplo basados en el CSV de referencia
  // (categorías mapeadas a las que suelen existir en la app)
  const catByName = n => {
    const c = categories.find(c => c.name.toLowerCase().includes(n.toLowerCase()))
    return c ? c.name : n
  }

  const ejemplos = [
    ['SALIDAS DE CAMPO 2025', 'Parte 1. Salidas de campo – registro y foto-id',  catByName('Honorarios'),    '5 meses trabajo de campo 3 personas',                       360000,  8780],
    ['SALIDAS DE CAMPO 2025', 'Parte 1. Salidas de campo – registro y foto-id',  catByName('Transporte'),    'Combustible 120km – 895 lt nafta super',                     60000,  1463],
    ['SALIDAS DE CAMPO 2025', 'Parte 1. Salidas de campo – registro y foto-id',  catByName('Equipamiento'),  '1 Batería Dron DJI Mini 3 Pro',                                  0,   190],
    ['SALIDAS DE CAMPO 2025', 'Parte 1. Salidas de campo – registro y foto-id',  catByName('Equipamiento'),  '1 Batería Dron DJI Mavic 2 Zoom',                                0,   170],
    ['SALIDAS DE CAMPO 2025', 'Parte 1. Salidas de campo – registro y foto-id',  catByName('Equipamiento'),  '2 Baterías con cargador cámaras Canon P100',                     0,    60],
    ['SALIDAS DE CAMPO 2025', 'Parte 2. Catálogo foto-id y análisis de datos',   catByName('Honorarios'),    '5 meses selección, edición y publicación – 2 personas',     180000,  4390],
    ['SALIDAS DE CAMPO 2025', 'Parte 2. Catálogo foto-id y análisis de datos',   catByName('Honorarios'),    '2 investigadores catálogo y análisis 15h/sem 5 meses',           0,  7200],
    ['SALIDAS DE CAMPO 2025', 'Parte 2. Catálogo foto-id y análisis de datos',   catByName('Honorarios'),    '2 investigadores redacción informe final 20h US$20/hora',        0,   800],
    ['ESTUDIO REGISTROS 2023-2024', 'Parte 1. Orden y selección material',       catByName('Honorarios'),    'Selección fotografías y frames de video 2024 – 3 meses',    180000,  4390],
    ['ESTUDIO REGISTROS 2023-2024', 'Parte 1. Orden y selección material',       catByName('Honorarios'),    'Selección fotografías y frames de video 2023 – 3 meses',    180000,  4390],
    ['ESTUDIO REGISTROS 2023-2024', 'Parte 2. Análisis y catálogo foto-id',      catByName('Honorarios'),    'Catálogo foto-id 2024 – 2 invest. 15h/sem 3 meses',             0,  4320],
    ['ESTUDIO REGISTROS 2023-2024', 'Parte 2. Análisis y catálogo foto-id',      catByName('Honorarios'),    'Catálogo foto-id 2023 – 2 invest. 15h/sem 3 meses',             0,  4320],
    ['ESTUDIO REGISTROS 2023-2024', 'Parte 2. Análisis y catálogo foto-id',      catByName('Honorarios'),    'Base de datos y análisis 23-24 – 2 invest. 4 meses',            0,  5760],
    ['ESTUDIO REGISTROS 2023-2024', 'Parte 2. Análisis y catálogo foto-id',      catByName('Honorarios'),    '2 investigadores redacción informe final 20h',                   0,   800],
    ['EDUCACIÓN AMBIENTAL Y DIVULGACIÓN', 'Creación y difusión material educativo', catByName('Honorarios'), 'Diseño librillo BFA – diseñador 20h US$12/hora',                 0,   240],
    ['EDUCACIÓN AMBIENTAL Y DIVULGACIÓN', 'Creación y difusión material educativo', catByName('Impresión') || 'Materiales', 'Impresión librillo BFA 3.000 ejemplares',     360000,  8780],
    ['EDUCACIÓN AMBIENTAL Y DIVULGACIÓN', 'Creación y difusión material educativo', catByName('Honorarios'), 'Redes sociales – 50h US$12/hora',                               0,   570],
    ['EDUCACIÓN AMBIENTAL Y DIVULGACIÓN', 'Creación y difusión material educativo', catByName('Honorarios'), 'Edición audiovisual resumen temporada – 4h US$12/hora',          0,   460],
    ['EDUCACIÓN AMBIENTAL Y DIVULGACIÓN', 'Creación y difusión material educativo', catByName('Actividades') || 'Actividades', 'Teatro títere gigante – 3 intervenciones US$100 c/u', 0, 300],
    ['EDUCACIÓN AMBIENTAL Y DIVULGACIÓN', 'Creación y difusión material educativo', catByName('Impresión') || 'Materiales', 'Exposición 15 fotografías cierre temporada US$15/foto', 0, 225],
  ]

  ejemplos.forEach((row, i) => {
    const exRow = ws2.addRow({
      objetivo:  row[0], actividad: row[1], categoria: row[2],
      detalle:   row[3], monto_uyu: row[4], monto_usd: row[5],
    })
    exRow.height = 19
    const bg = i % 2 === 0 ? 'FFF4F7FB' : 'FFFFFFFF'
    exRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      cell.font = { size: 10 }
      cell.alignment = { vertical: 'middle', wrapText: false }
    })
    // Montos en negrita
    exRow.getCell('E').font = { size: 10, bold: true }
    exRow.getCell('F').font = { size: 10, bold: true }
  })

  // ── Descargar ──
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = 'Plantilla_Presupuesto_YaquPacha.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}
