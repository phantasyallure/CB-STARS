import { allow, body, handle, HttpError } from './_lib/http.js'
import { requireAdmin } from './_lib/auth.js'
import { PROVIDERS, providerById, loadKeys } from './_lib/providers.js'

// Manage the API keys used for AI background removal.
// The full key is never sent back to the browser — only the last 4 characters.
export default handle(async (req, res) => {
  allow(req, ['GET', 'PUT', 'DELETE'])
  const { db } = await requireAdmin(req, 'settings')

  if (req.method === 'GET') {
    const keys = await loadKeys(db)
    res.status(200).json({
      providers: PROVIDERS.map((p) => ({
        id: p.id,
        label: p.label,
        help: p.help,
        configured: !!keys[p.id],
        source: keys[p.id]?.source || null,
        hint: keys[p.id] ? keys[p.id].key.slice(-4) : null,
      })),
    })
    return
  }

  if (req.method === 'PUT') {
    const { provider, apiKey } = body(req)
    if (!providerById(provider)) throw new HttpError(400, 'Unknown provider.')
    const clean = String(apiKey || '').trim()
    if (clean.length < 10) throw new HttpError(400, 'That does not look like an API key.')
    const { error } = await db
      .from('ai_keys')
      .upsert({ provider, api_key: clean, updated_at: new Date().toISOString() })
    if (error) throw new HttpError(500, error.message)
    res.status(200).json({ ok: true })
    return
  }

  const provider = req.query?.provider
  if (!providerById(provider)) throw new HttpError(400, 'Unknown provider.')
  const { error } = await db.from('ai_keys').delete().eq('provider', provider)
  if (error) throw new HttpError(500, error.message)
  res.status(200).json({ ok: true })
})
