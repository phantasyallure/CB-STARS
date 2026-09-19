import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { apiFetch } from '../../lib/api.js'
import { isValidPixelId } from '../../lib/pixel.js'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import { IconCheckCircle, IconKey, IconTrash } from '../../components/AdminIcons.jsx'

export default function SettingsTab() {
  const { tx } = useLanguage()
  const { notify } = useOutletContext()

  /* ---------- Facebook Pixel ---------- */
  const [pixel, setPixel] = useState('')
  const [savedPixel, setSavedPixel] = useState('')
  const [pixelBusy, setPixelBusy] = useState(false)

  useEffect(() => {
    supabase.from('site_settings').select('value').eq('key', 'fb_pixel_id').maybeSingle().then(({ data }) => {
      setPixel(data?.value || '')
      setSavedPixel(data?.value || '')
    })
  }, [])

  const pixelValid = pixel.trim() === '' || isValidPixelId(pixel)

  const savePixel = async (e) => {
    e.preventDefault()
    if (!pixelValid) return
    setPixelBusy(true)
    const value = pixel.trim()
    const { error } = await supabase.from('site_settings').upsert({ key: 'fb_pixel_id', value, updated_at: new Date().toISOString() })
    setPixelBusy(false)
    if (error) { notify(error.message, 'err'); return }
    setSavedPixel(value)
    notify(value ? tx('Pixel enregistré. Il est actif sur la boutique.', 'Pixel saved. It is now live on the store.') : tx('Pixel désactivé.', 'Pixel turned off.'))
  }

  /* ---------- AI keys ---------- */
  const [providers, setProviders] = useState([])
  const [keyDrafts, setKeyDrafts] = useState({})
  const [aiError, setAiError] = useState('')
  const [busyProvider, setBusyProvider] = useState(null)

  const loadKeys = useCallback(async () => {
    try {
      const { providers: list } = await apiFetch('ai-keys')
      setProviders(list)
      setAiError('')
    } catch (err) {
      setAiError(
        err.code === 'API_UNAVAILABLE'
          ? tx('Les fonctions serveur ne répondent pas (déployez sur Vercel ou lancez « vercel dev »).', 'Server functions are not responding (deploy to Vercel or run "vercel dev").')
          : err.message
      )
    }
  }, [tx])

  useEffect(() => { loadKeys() }, [loadKeys])

  const saveKey = async (id) => {
    setBusyProvider(id)
    try {
      await apiFetch('ai-keys', { method: 'PUT', body: { provider: id, apiKey: keyDrafts[id] } })
      setKeyDrafts((d) => ({ ...d, [id]: '' }))
      notify(tx('Clé enregistrée.', 'Key saved.'))
      await loadKeys()
    } catch (err) { notify(err.message, 'err') }
    setBusyProvider(null)
  }

  const removeKey = async (id) => {
    if (!confirm(tx('Supprimer cette clé ?', 'Delete this key?'))) return
    setBusyProvider(id)
    try {
      await apiFetch(`ai-keys?provider=${id}`, { method: 'DELETE' })
      notify(tx('Clé supprimée.', 'Key deleted.'))
      await loadKeys()
    } catch (err) { notify(err.message, 'err') }
    setBusyProvider(null)
  }

  const order = providers.filter((p) => p.configured).map((p) => p.label)

  return (
    <>
      <div className="adm-head">
        <div>
          <h2>{tx('Réglages', 'Settings')}</h2>
          <p className="adm-sub">{tx('Suivi publicitaire et intelligence artificielle.', 'Ad tracking and artificial intelligence.')}</p>
        </div>
      </div>

      <section className="adm-card">
        <h3>{tx('Pixel Facebook (Meta)', 'Facebook (Meta) Pixel')}</h3>
        <p className="adm-hint">
          {tx(
            'Collez l’identifiant de votre pixel. Il suit les visites, les fiches produit vues et les commandes envoyées, pour vos publicités Facebook et Instagram.',
            'Paste your pixel ID. It tracks visits, product views and submitted orders for your Facebook and Instagram ads.'
          )}
        </p>
        <form className="settings-form" onSubmit={savePixel}>
          <div className="field">
            <label htmlFor="pixel">{tx('Identifiant du pixel', 'Pixel ID')}</label>
            <input id="pixel" type="text" inputMode="numeric" placeholder="1234567890123456" value={pixel} onChange={(e) => setPixel(e.target.value)} aria-invalid={!pixelValid} />
            {!pixelValid && <span className="adm-error">{tx('L’identifiant ne contient que des chiffres (6 à 20).', 'The ID is digits only (6 to 20).')}</span>}
          </div>
          <button type="submit" className="adm-btn adm-btn--solid" disabled={pixelBusy || !pixelValid || pixel.trim() === savedPixel}>
            {pixelBusy ? '…' : tx('Enregistrer', 'Save')}
          </button>
        </form>
        {savedPixel && (
          <p className="adm-status adm-status--ok"><IconCheckCircle /> {tx('Actif : PageView, ViewContent, Purchase', 'Live: PageView, ViewContent, Purchase')}</p>
        )}
        <p className="adm-hint">{tx('Où le trouver : Meta Events Manager > Sources de données > votre pixel.', 'Where to find it: Meta Events Manager > Data sources > your pixel.')}</p>
      </section>

      <section className="adm-card">
        <h3>{tx('Suppression d’arrière-plan par IA', 'AI background removal')}</h3>
        <p className="adm-hint">
          {tx(
            'Dans le formulaire produit, « Utiliser l’IA » retire le fond d’une photo. Les services sont essayés dans l’ordre ci-dessous ; si l’un a atteint sa limite, le suivant prend le relais.',
            'In the product form, “Use AI” removes a photo’s background. Services are tried in the order below; if one hits its limit, the next one takes over.'
          )}
        </p>
        {aiError && <p className="adm-error">{aiError}</p>}
        {order.length > 0 && (
          <p className="adm-status">{tx('Ordre actuel', 'Current order')}: {order.join(' → ')}</p>
        )}

        <ul className="klist">
          {providers.map((p, i) => (
            <li key={p.id} className="krow">
              <div className="krow__head">
                <span className="krow__n">{i + 1}</span>
                <div>
                  <strong>{p.label}</strong>
                  <small>{p.help}</small>
                </div>
                {p.configured ? (
                  <span className="adm-pill adm-pill--ok"><IconCheckCircle /> {tx('Clé active', 'Key active')} …{p.hint}{p.source === 'env' ? ` (${tx('serveur', 'server')})` : ''}</span>
                ) : (
                  <span className="adm-pill adm-pill--muted">{tx('Non configuré', 'Not set')}</span>
                )}
              </div>
              <div className="krow__form">
                <input
                  type="password"
                  autoComplete="off"
                  placeholder={p.configured ? tx('Remplacer la clé…', 'Replace the key…') : tx('Coller la clé API…', 'Paste the API key…')}
                  value={keyDrafts[p.id] || ''}
                  onChange={(e) => setKeyDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                  aria-label={`${p.label} API key`}
                />
                <button type="button" className="adm-btn adm-btn--small adm-btn--solid" disabled={busyProvider === p.id || (keyDrafts[p.id] || '').trim().length < 10} onClick={() => saveKey(p.id)}>
                  <IconKey /> {tx('Enregistrer', 'Save')}
                </button>
                {p.configured && p.source === 'admin' && (
                  <button type="button" className="adm-btn adm-btn--small adm-btn--danger" disabled={busyProvider === p.id} onClick={() => removeKey(p.id)} aria-label={tx('Supprimer la clé', 'Delete key')}>
                    <IconTrash />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <p className="adm-hint">{tx('Les clés sont stockées côté serveur et ne sont jamais renvoyées au navigateur (seuls les 4 derniers caractères s’affichent).', 'Keys are stored server-side and never sent back to the browser (only the last 4 characters show).')}</p>
      </section>
    </>
  )
}
