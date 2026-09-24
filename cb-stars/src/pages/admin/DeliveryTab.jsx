import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import { WILAYAS } from '../../data/wilayas.js'
import { IconSearch, IconTruck } from '../../components/AdminIcons.jsx'

// One delivery price per wilaya. Empty = no delivery fee shown to the customer,
// 0 = free delivery. The key is the same French label the order form stores
// (e.g. "16 - Alger"), so orders can look their fee up directly.
export default function DeliveryTab() {
  const { tx } = useLanguage()
  const { notify } = useOutletContext()
  const [saved, setSaved] = useState({})   // wilaya -> "600" (as stored)
  const [drafts, setDrafts] = useState({}) // wilaya -> what is typed now
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [bulk, setBulk] = useState('')

  const load = useCallback(async () => {
    setLoadError(false)
    const { data, error } = await supabase.from('delivery_rates').select('wilaya, price')
    if (error) {
      setLoadError(true)
      setLoading(false)
      return
    }
    const map = Object.fromEntries((data || []).map((r) => [r.wilaya, String(Number(r.price))]))
    setSaved(map)
    setDrafts(map)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const val = (map, w) => (map[w] === undefined ? '' : String(map[w]).trim())
  const changed = useMemo(
    () => WILAYAS.filter((w) => val(drafts, w) !== val(saved, w)),
    [drafts, saved]
  )
  const filled = WILAYAS.filter((w) => val(saved, w) !== '').length

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? WILAYAS.filter((w) => w.toLowerCase().includes(q)) : WILAYAS
  }, [query])

  const setOne = (w, v) => setDrafts((d) => ({ ...d, [w]: v }))

  const applyToAll = () => {
    const n = Number(bulk)
    if (bulk.trim() === '' || !(n >= 0)) {
      notify(tx('Entrez un prix valide (0 ou plus).', 'Enter a valid price (0 or more).'), 'err')
      return
    }
    setDrafts(Object.fromEntries(WILAYAS.map((w) => [w, String(n)])))
  }

  const save = async () => {
    const upserts = []
    const removals = []
    for (const w of changed) {
      const v = val(drafts, w)
      if (v === '') { removals.push(w); continue }
      const n = Number(v)
      if (!(n >= 0)) {
        notify(tx(`Prix invalide pour ${w}.`, `Invalid price for ${w}.`), 'err')
        return
      }
      upserts.push({ wilaya: w, price: n, updated_at: new Date().toISOString() })
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

  return (
    <>
      <div className="adm-head">
        <div>
          <h2>{tx('Livraison', 'Delivery')}</h2>
          <p className="adm-sub">
            {tx(
              'Un prix par wilaya. Le client le voit dès qu’il choisit sa wilaya dans le formulaire de commande.',
              'One price per wilaya. Customers see it as soon as they pick their wilaya in the order form.'
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
              <div className="field">
                <label htmlFor="bulk-price">{tx('Même prix pour toutes les wilayas', 'Same price for every wilaya')}</label>
                <div className="inline-input">
                  <input id="bulk-price" type="number" min="0" step="1" inputMode="numeric" placeholder="600" value={bulk} onChange={(e) => setBulk(e.target.value)} />
                  <span>DA</span>
                  <button type="button" className="adm-btn adm-btn--small" onClick={applyToAll}>{tx('Appliquer partout', 'Apply to all')}</button>
                </div>
              </div>
              <p className="adm-hint">
                {tx(
                  'Puis modifiez les wilayas qui diffèrent. Rien n’est enregistré avant de cliquer sur « Enregistrer ». Vide = aucun frais affiché, 0 = livraison gratuite.',
                  'Then adjust the wilayas that differ. Nothing is saved until you click “Save”. Empty = no fee shown, 0 = free delivery.'
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
            <ul className="plist">
              {rows.map((w) => {
                const dirty = val(drafts, w) !== val(saved, w)
                return (
                  <li key={w} className={`drow ${dirty ? 'is-dirty' : ''}`}>
                    <label htmlFor={`d-${w}`}>{w}</label>
                    <div className="drow__input">
                      <input
                        id={`d-${w}`}
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        placeholder="—"
                        value={drafts[w] ?? ''}
                        onChange={(e) => setOne(w, e.target.value)}
                      />
                      <span>DA</span>
                    </div>
                  </li>
                )
              })}
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
