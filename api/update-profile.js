import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).end()

  const { userId, updates } = req.body ?? {}
  if (!userId || !updates) return res.status(400).json({ error: 'userId y updates requeridos' })

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Variables de entorno no configuradas' })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await supabase.from('profiles').update(updates).eq('id', userId)
  if (error) return res.status(400).json({ error: error.message })
  return res.status(200).json({ ok: true })
}
