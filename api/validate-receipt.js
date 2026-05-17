import Anthropic from '@anthropic-ai/sdk'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { base64, mediaType } = req.body ?? {}
  if (!base64 || !mediaType) {
    return res.status(400).json({ error: 'Faltan parámetros' })
  }

  const isImage = mediaType.startsWith('image/')
  const isPdf = mediaType === 'application/pdf'

  if (!isImage && !isPdf) {
    return res.json({
      valid: false, legible: false, tipo: 'otro',
      mensaje: 'Formato no soportado para verificación automática.',
    })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    const filePart = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } }

    const { content } = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          filePart,
          {
            type: 'text',
            text: `Analizá este archivo y determiná si es una factura, ticket o comprobante de pago.
Revisá si el contenido es legible (no está borroso, cortado ni ilegible).
Respondé ÚNICAMENTE con JSON sin markdown:
{"valid": true/false, "legible": true/false, "tipo": "factura"|"ticket"|"recibo"|"otro", "mensaje": "descripción de máximo 80 caracteres en español"}`,
          },
        ],
      }],
    })

    const text = content[0]?.text ?? ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Respuesta inesperada del modelo')

    res.json(JSON.parse(match[0]))
  } catch (err) {
    console.error('validate-receipt:', err)
    res.status(500).json({ error: err.message })
  }
}
