import { allow, body, handle, HttpError, json, query } from './_lib/http.js'
import { requireAdmin } from './_lib/auth.js'
import { PROVIDERS, providerById, loadKeys } from './_lib/providers.js'

// Manage the API keys used for AI background removal.
// The full key is never sent back to the browser — only the last 4 characters.
export const onRequest = handle(async (context) => {
  const { request } = context
  allow(context, ['GET', 'PUT', 'DELETE'])
  const { db } = await requireAdmin(context, 'settings')

  if (request.method === 'GET') {
    const keys = await loadKeys(db, context.env)
    return json({
      providers: PROVIDERS.map((p) => ({
        id: p.id,
        label: p.label,
        help: p.help,
        configured: !!keys[p.id],
        source: keys[p.id]?.source || null,
        hint: keys[p.id] ? keys[p.id].key.slice(-4) : null,
      })),
    })
  }

  if (request.method === 'PUT') {
    const { provider, apiKey } = await body(context)
    if (!providerById(provider)) throw new HttpError(400, 'Unknown provider.')
    const clean = String(apiKey || '').trim()
    if (clean.length < 10) throw new HttpError(400, 'That does not look like an API key.')
    const { error } = await db
      .from('ai_keys')
      .upsert({ provider, api_key: clean, updated_at: new Date().toISOString() })
    if (error) throw new HttpError(500, error.message)
    return json({ ok: true })
  }

  // DELETE
  const provider = query(context).get('provider')
  if (!providerById(provider)) throw new HttpError(400, 'Unknown provider.')
  const { error } = await db.from('ai_keys').delete().eq('provider', provider)
  if (error) throw new HttpError(500, error.message)
  return json({ ok: true })
})
