import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email, full_name, role, group_id } = req.body ?? {}
  if (!email?.trim()) return res.status(400).json({ error: 'Email requerido' })

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Variables de entorno no configuradas en Vercel (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY)' })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email.trim(), {
    data: {
      full_name: full_name?.trim() || '',
      role: role || 'member',
      group_id: group_id || null,
    },
    redirectTo: process.env.SITE_URL,
  })

  if (error) return res.status(400).json({ error: error.message })

  return res.status(200).json({ ok: true })
}
