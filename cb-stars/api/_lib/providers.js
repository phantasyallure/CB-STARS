// Background-removal providers, tried in this order. When one runs out of
// quota (or fails), the next configured one is used.

export const PROVIDERS = [
  { id: 'gemini', label: 'Google Gemini', env: 'GEMINI_API_KEY', help: 'aistudio.google.com/apikey' },
  { id: 'openai', label: 'OpenAI (ChatGPT image)', env: 'OPENAI_API_KEY', help: 'platform.openai.com/api-keys' },
  { id: 'removebg', label: 'remove.bg', env: 'REMOVEBG_API_KEY', help: 'remove.bg/api' },
  { id: 'clipdrop', label: 'Clipdrop', env: 'CLIPDROP_API_KEY', help: 'clipdrop.co/apis' },
]

export function providerById(id) {
  return PROVIDERS.find((p) => p.id === id)
}

// Keys saved in the admin panel win; environment variables are the fallback.
export async function loadKeys(db) {
  const { data } = await db.from('ai_keys').select('provider, api_key')
  const saved = Object.fromEntries((data || []).map((r) => [r.provider, r.api_key]))
  const result = {}
  for (const p of PROVIDERS) {
    if (saved[p.id]) result[p.id] = { key: saved[p.id], source: 'admin' }
    else if (process.env[p.env]) result[p.id] = { key: process.env[p.env], source: 'env' }
  }
  return result
}
