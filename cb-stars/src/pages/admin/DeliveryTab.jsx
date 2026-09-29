import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import { WILAYAS } from '../../data/wilayas.js'
import { IconSearch, IconTruck } from '../../components/AdminIcons.jsx'

// Two delivery prices per wilaya: Home (À domicile) and Office (Au bureau).
// Empty = that option is not offered for the wilaya, 0 = free delivery.
// The key is the same French label the order form stores (e.g. "16 - Alger").
const FIELDS = ['home', 'office']

export default function DeliveryTab() {
  const { tx } = useLanguage()
  const { notify } = useOutletContext()
  const [saved, setSaved] = useState({})   // wilaya -> { home: "600", office: "400" }
  const [drafts, setDrafts] = useState({}) // wilaya -> what is typed now
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [bulk, setBulk] = useState({ home: '', office: '' })

  const load = useCallback(async () => {
    setLoadError(false)
    const { data, error } = await supabase.from('delivery_rates').select('wilaya, price, office_price')
    if (error) {
      setLoadError(true)
      setLoading(false)
      return
    }
    const s = (v) => (v === null || v === undefined ? '' : String(Number(v)))
    const map = Object.fromEntries((data || []).map((r) => [r.wilaya, { home: s(r.price), office: s(r.office_price) }]))
    setSaved(map)
    setDrafts(map)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const val = (map, w, f) => String(map[w]?.[f] ?? '').trim()
  const isDirty = (w) => FIELDS.some((f) => val(drafts, w, f) !== val(saved, w, f))
  const changed = useMemo(() => WILAYAS.filter(isDirty), [drafts, saved])
  const filled = WILAYAS.filter((w) => FIELDS.some((f) => val(saved, w, f) !== '')).length

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? WILAYAS.filter((w) => w.toLowerCase().includes(q)) : WILAYAS
  }, [query])

  const setOne = (w, f, v) => setDrafts((d) => ({ ...d, [w]: { ...(d[w] || {}), [f]: v } }))

  const applyToAll = (f) => {
    const n = Number(bulk[f])
    if (bulk[f].trim() === '' || !(n >= 0)) {
      notify(tx('Entrez un prix valide (0 ou plus).', 'Enter a valid price (0 or more).'), 'err')
      return
    }
    setDrafts((d) => Object.fromEntries(WILAYAS.map((w) => [w, { ...(d[w] || {}), [f]: String(n) }])))
  }

  const save = async () => {
    const upserts = []
    const removals = []
    for (const w of changed) {
      const h = val(drafts, w, 'home')
      const o = val(drafts, w, 'office')
      if (h === '' && o === '') { removals.push(w); continue }
      const hn = h === '' ? null : Number(h)
      const on = o === '' ? null : Number(o)
      if ((hn !== null && !(hn >= 0)) || (on !== null && !(on >= 0))) {
        notify(tx(`Prix invalide pour ${w}.`, `Invalid price for ${w}.`), 'err')
        return
      }
      upserts.push({ wilaya: w, price: hn, office_price: on, updated_at: new Date().toISOString() })
    }
    setSaving(true)
    try {
      if (upserts.length) {
        const { error } = await supabase.from('delivery_rates').upsert(upserts, { onConflict: 'wilaya' })
        if (error) throw error
      }
      if (removals.length) {
        const { error } = await supabase.from('delivery_rates').delete().in('wilaya', removals)
        if (error) throw error
      }
      notify(tx('Tarifs de livraison enregistrés.', 'Delivery prices saved.'))
      await load()
    } catch (err) {
      notify(err.message || tx('Échec de l’enregistrement.', 'Could not save.'), 'err')
    }
    setSaving(false)
  }

  const label = (f) => (f === 'home' ? tx('À domicile', 'Home') : tx('Au bureau', 'Office'))

  return (
    <>
      <div className="adm-head">
        <div>
          <h2>{tx('Livraison', 'Delivery')}</h2>
          <p className="adm-sub">
            {tx(
              'Deux prix par wilaya : à domicile et au bureau. Le client choisit son mode de livraison et le total se met à jour automatiquement.',
              'Two prices per wilaya: home and office. The customer picks a delivery method and the total updates automatically.'
            )}
          </p>
        </div>
      </div>

      {loadError && (
        <div className="adm-card adm-empty">
          <IconTruck />
          <h3>{tx('Table de livraison introuvable', 'Delivery table not found')}</h3>
          <p>
            {tx(
              'Exécutez à nouveau supabase/schema.sql dans le SQL Editor de Supabase, puis rechargez cette page.',
              'Run supabase/schema.sql again in the Supabase SQL Editor, then reload this page.'
            )}
          </p>
        </div>
      )}

      {!loadError && (
        <>
          <div className="adm-card stock-settings">
            <div className="stock-settings__row">
              {FIELDS.map((f) => (
                <div className="field" key={f}>
                  <label htmlFor={`bulk-${f}`}>{tx('Même prix — ', 'Same price — ')}{label(f)}</label>
                  <div className="inline-input">
                    <input id={`bulk-${f}`} type="number" min="0" step="1" inputMode="numeric" placeholder={f === 'home' ? '600' : '400'} value={bulk[f]} onChange={(e) => setBulk((b) => ({ ...b, [f]: e.target.value }))} />
                    <span>DA</span>
                    <button type="button" className="adm-btn adm-btn--small" onClick={() => applyToAll(f)}>{tx('Appliquer partout', 'Apply to all')}</button>
                  </div>
                </div>
              ))}
              <p className="adm-hint">
                {tx(
                  'Puis modifiez les wilayas qui diffèrent. Rien n’est enregistré avant de cliquer sur « Enregistrer ». Vide = option non proposée, 0 = livraison gratuite.',
                  'Then adjust the wilayas that differ. Nothing is saved until you click “Save”. Empty = option not offered, 0 = free delivery.'
                )}
              </p>
            </div>
          </div>

          <div className="adm-toolbar">
            <label className="adm-search">
              <IconSearch />
              <input type="search" placeholder={tx('Rechercher une wilaya…', 'Search a wilaya…')} value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <span className="adm-hint drow-count">
              {tx(`${filled} wilaya(s) sur ${WILAYAS.length} ont un prix`, `${filled} of ${WILAYAS.length} wilayas have a price`)}
            </span>
          </div>

          <div className="adm-card adm-card--flush">
            {loading && <p className="adm-hint adm-pad">{tx('Chargement…', 'Loading…')}</p>}
            {!loading && rows.length === 0 && <p className="adm-hint adm-pad">{tx('Aucune wilaya trouvée.', 'No wilaya found.')}</p>}
            {!loading && rows.length > 0 && (
              <div className="drow drow--head" aria-hidden="true">
                <span>Wilaya</span>
                <span>{label('home')}</span>
                <span>{label('office')}</span>
              </div>
            )}
            <ul className="plist">
              {rows.map((w) => (
                <li key={w} className={`drow ${isDirty(w) ? 'is-dirty' : ''}`}>
                  <label htmlFor={`d-${w}-home`}>{w}</label>
                  {FIELDS.map((f) => (
                    <div className="drow__input" key={f}>
                      <input
                        id={`d-${w}-${f}`}
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        placeholder="—"
                        aria-label={`${w} — ${label(f)}`}
                        value={drafts[w]?.[f] ?? ''}
                        onChange={(e) => setOne(w, f, e.target.value)}
                      />
                      <span>DA</span>
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          </div>

          {changed.length > 0 && (
            <div className="dbar" role="status">
              <span>{tx(`${changed.length} modification(s) non enregistrée(s)`, `${changed.length} unsaved change(s)`)}</span>
              <span className="dbar__actions">
                <button type="button" className="adm-btn adm-btn--small" onClick={() => setDrafts(saved)} disabled={saving}>{tx('Annuler', 'Discard')}</button>
                <button type="button" className="adm-btn adm-btn--small adm-btn--solid" onClick={save} disabled={saving}>{saving ? '…' : tx('Enregistrer', 'Save')}</button>
              </span>
            </div>
          )}
        </>
      )}
    </>
  )
}
