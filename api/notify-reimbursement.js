import { createClient } from '@supabase/supabase-js'

// Avisa por email a las admins cuando una integrante crea una solicitud de reintegro.
// Requiere en Vercel: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY
// Opcional: RESEND_FROM (remitente verificado en Resend), SITE_URL
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { reimbursement_id } = req.body ?? {}
  if (!reimbursement_id) return res.status(400).json({ error: 'Falta reimbursement_id' })

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
    return res.status(500).json({ error: 'Faltan variables de entorno (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY)' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Verificar quién llama: solo la dueña de la solicitud puede disparar el aviso
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const { data: { user } = {}, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'No autenticado' })

  const { data: bundle } = await supabase.from('reimbursements')
    .select('id, user_id, status, total_uyu, total_usd, notes, created_at')
    .eq('id', reimbursement_id).single()
  if (!bundle || bundle.user_id !== user.id || bundle.status !== 'pending') {
    return res.status(403).json({ error: 'Solicitud no válida' })
  }

  const [{ data: requester }, { data: admins }, { count: nExpenses }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    supabase.from('profiles').select('id').eq('role', 'admin'),
    supabase.from('expenses').select('id', { count: 'exact', head: true }).eq('reimbursement_id', bundle.id),
  ])

  const emails = []
  for (const a of admins || []) {
    const { data } = await supabase.auth.admin.getUserById(a.id)
    if (data?.user?.email) emails.push(data.user.email)
  }
  if (emails.length === 0) return res.status(200).json({ ok: true, sent: 0 })

  const fmt = (n, cur) => `${cur === 'USD' ? 'U$D' : '$U'} ${Number(n).toLocaleString('es-UY', { minimumFractionDigits: 2 })}`
  const amounts = [
    Number(bundle.total_uyu) > 0 && fmt(bundle.total_uyu, 'UYU'),
    Number(bundle.total_usd) > 0 && fmt(bundle.total_usd, 'USD'),
  ].filter(Boolean).join(' + ') || '—'
  const name = requester?.full_name || user.email
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const link = `${process.env.SITE_URL || `${proto}://${host}`}/reintegros`
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#1d2b36">
      <p><strong>${esc(name)}</strong> solicitó un reintegro.</p>
      <p>Monto: <strong>${esc(amounts)}</strong><br>Gastos: ${nExpenses ?? '—'}</p>
      ${bundle.notes ? `<p>Nota: ${esc(bundle.notes)}</p>` : ''}
      <p><a href="${esc(link)}" style="background:#1a6b8a;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none">Ver solicitudes</a></p>
    </div>`

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || 'Yaqu Pacha Contabilidad <onboarding@resend.dev>',
      to: emails,
      subject: `Nueva solicitud de reintegro: ${name} (${amounts})`,
      html,
    }),
  })
  if (!r.ok) {
    const detail = await r.text()
    return res.status(502).json({ error: 'Resend: ' + detail.slice(0, 300) })
  }
  return res.status(200).json({ ok: true, sent: emails.length })
}
