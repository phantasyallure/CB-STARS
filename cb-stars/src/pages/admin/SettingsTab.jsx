import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { apiFetch } from '../../lib/api.js'
import { isValidPixelId, isValidTikTokPixelId } from '../../lib/pixel.js'
import PixelCard from './PixelCard.jsx'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import { IconCheckCircle, IconKey, IconTrash } from '../../components/AdminIcons.jsx'

export default function SettingsTab() {
  const { tx } = useLanguage()
  const { notify } = useOutletContext()

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
          ? tx('Les fonctions serveur ne répondent pas (déployez sur Cloudflare Pages ou lancez « npm run pages:dev »).', 'Server functions are not responding (deploy to Cloudflare Pages or run "npm run pages:dev").')
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

      <PixelCard
        settingKey="fb_pixel_id"
        notify={notify}
        title={tx('Pixel Facebook (Meta)', 'Facebook (Meta) Pixel')}
        description={tx(
          'Collez l’identifiant de votre pixel. Il suit les visites, les fiches produit vues et les commandes envoyées, pour vos publicités Facebook et Instagram.',
          'Paste your pixel ID. It tracks visits, product views and submitted orders for your Facebook and Instagram ads.'
        )}
        label={tx('Identifiant du pixel', 'Pixel ID')}
        placeholder="1234567890123456"
        inputMode="numeric"
        validate={isValidPixelId}
        invalidMessage={tx('L’identifiant ne contient que des chiffres (6 à 20).', 'The ID is digits only (6 to 20).')}
        liveText={tx('Actif : PageView, ViewContent, Purchase', 'Live: PageView, ViewContent, Purchase')}
        whereToFind={tx('Où le trouver : Meta Events Manager > Sources de données > votre pixel.', 'Where to find it: Meta Events Manager > Data sources > your pixel.')}
      />

      <PixelCard
        settingKey="tiktok_pixel_id"
        notify={notify}
        title={tx('Pixel TikTok', 'TikTok Pixel')}
        description={tx(
          'Collez l’identifiant de votre pixel TikTok. Il suit les visites, les fiches produit vues et les commandes envoyées (chaque commande compte comme un achat, événement CompletePayment), pour vos publicités TikTok.',
          'Paste your TikTok pixel ID. It tracks visits, product views and submitted orders (each order counts as a purchase, the CompletePayment event) for your TikTok ads.'
        )}
        label={tx('Identifiant du pixel', 'Pixel ID')}
        placeholder="CXXXXXXXXXXXXXXXXXXX"
        validate={isValidTikTokPixelId}
        invalidMessage={tx('L’identifiant contient 8 à 32 lettres et chiffres, sans espace.', 'The ID is 8 to 32 letters and digits, no spaces.')}
        liveText={tx('Actif : page vue, ViewContent, CompletePayment', 'Live: page view, ViewContent, CompletePayment')}
        whereToFind={tx('Où le trouver : TikTok Ads Manager > Assets > Events > votre pixel.', 'Where to find it: TikTok Ads Manager > Assets > Events > your pixel.')}
      />

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
