import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import { ColorDotRow } from '../../components/ColorDots.jsx'
import { IconWarning, IconCheckCircle, IconBan, IconLayers } from '../../components/AdminIcons.jsx'

export default function StockTab() {
  const { tx } = useLanguage()
  const { alerts, refreshAlerts, notify } = useOutletContext()
  const [products, setProducts] = useState([])
  const [drafts, setDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all | low | out
  const [threshold, setThreshold] = useState(String(alerts.threshold ?? 3))
  const [autoDec, setAutoDec] = useState(true)
  const [savingId, setSavingId] = useState(null)

  const load = useCallback(async () => {
    const [{ data }, { data: settings }] = await Promise.all([
      supabase.from('products').select('id, name, images, stock, colors, created_at').order('name'),
      supabase.from('site_settings').select('key, value').in('key', ['low_stock_threshold', 'auto_decrement_stock']),
    ])
    setProducts(data || [])
    setDrafts(Object.fromEntries((data || []).map((p) => [p.id, String(p.stock ?? 0)])))
    const map = Object.fromEntries((settings || []).map((s) => [s.key, s.value]))
    if (map.low_stock_threshold !== undefined) setThreshold(map.low_stock_threshold)
    setAutoDec(map.auto_decrement_stock !== 'false')
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const limit = Math.max(0, parseInt(threshold, 10) || 0)
  const statusOf = (stock) => (stock <= 0 ? 'out' : stock <= limit ? 'low' : 'ok')

  const counts = useMemo(() => {
    const c = { ok: 0, low: 0, out: 0, units: 0 }
    products.forEach((p) => {
      c[statusOf(Number(p.stock))] += 1
      c.units += Math.max(0, Number(p.stock) || 0)
    })
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, limit])

  const rows = useMemo(() => {
    const rank = { out: 0, low: 1, ok: 2 }
    return products
      .filter((p) => {
        const st = statusOf(Number(p.stock))
        return filter === 'all' || st === filter
      })
      .sort((a, b) => rank[statusOf(Number(a.stock))] - rank[statusOf(Number(b.stock))] || Number(a.stock) - Number(b.stock))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, filter, limit])

  const saveStock = async (p) => {
    const value = Math.max(0, parseInt(drafts[p.id], 10) || 0)
    setSavingId(p.id)
    const { error } = await supabase.from('products').update({ stock: value }).eq('id', p.id)
    setSavingId(null)
    if (error) { notify(error.message, 'err'); return }
    setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, stock: value } : x)))
    setDrafts((d) => ({ ...d, [p.id]: String(value) }))
    refreshAlerts()
  }

  const bump = (p, delta) =>
    setDrafts((d) => ({ ...d, [p.id]: String(Math.max(0, (parseInt(d[p.id], 10) || 0) + delta)) }))

  const saveSetting = async (key, value) => {
    const { error } = await supabase.from('site_settings').upsert({ key, value: String(value), updated_at: new Date().toISOString() })
    if (error) { notify(error.message, 'err'); return false }
    return true
  }

  const saveThreshold = async () => {
    const ok = await saveSetting('low_stock_threshold', limit)
    if (ok) { setThreshold(String(limit)); notify(tx('Seuil d’alerte enregistré.', 'Alert threshold saved.')); refreshAlerts() }
  }

  const toggleAuto = async (checked) => {
    setAutoDec(checked)
    const ok = await saveSetting('auto_decrement_stock', checked)
    if (!ok) setAutoDec(!checked)
  }

  const summary = [
    { key: 'ok', icon: IconCheckCircle, label: tx('En stock', 'In stock'), value: counts.ok, tone: 'ok' },
    { key: 'low', icon: IconWarning, label: tx('Presque épuisés', 'Running low'), value: counts.low, tone: 'warn' },
    { key: 'out', icon: IconBan, label: tx('Épuisés', 'Sold out'), value: counts.out, tone: 'danger' },
    { key: 'units', icon: IconLayers, label: tx('Pièces au total', 'Pieces in total'), value: counts.units, tone: 'neutral' },
  ]

  return (
    <>
      <div className="adm-head">
        <div>
          <h2>{tx('Stock', 'Stock')}</h2>
          <p className="adm-sub">{tx('Les produits presque épuisés remontent en premier.', 'Products running out come first.')}</p>
        </div>
      </div>

      <div className="adm-kpis">
        {summary.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.key} className={`adm-kpi adm-kpi--${s.tone}`}>
              <span className="adm-kpi__icon"><Icon /></span>
              <span>
                <span className="adm-kpi__value">{s.value}</span>
                <span className="adm-kpi__label">{s.label}</span>
              </span>
            </div>
          )
        })}
      </div>

      <div className="adm-card stock-settings">
        <div className="stock-settings__row">
          <div className="field">
            <label htmlFor="threshold">{tx('Alerter quand il reste', 'Warn me when this many are left')}</label>
            <div className="inline-input">
              <input id="threshold" type="number" min="0" step="1" inputMode="numeric" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
              <span>{tx('pièce(s) ou moins', 'piece(s) or fewer')}</span>
              <button type="button" className="adm-btn adm-btn--small adm-btn--solid" onClick={saveThreshold}>{tx('Enregistrer', 'Save')}</button>
            </div>
          </div>
          <label className="adm-switch">
            <input type="checkbox" checked={autoDec} onChange={(e) => toggleAuto(e.target.checked)} />
            <span className="adm-switch__track" aria-hidden="true" />
            <span>
              {tx('Retirer 1 pièce du stock quand une commande est acceptée', 'Take 1 piece out of stock when an order is accepted')}
              <small>{tx('Si une commande acceptée est modifiée, la pièce est remise en stock.', 'If an accepted order is changed back, the piece returns to stock.')}</small>
            </span>
          </label>
        </div>
      </div>

      <div className="adm-tabs" role="tablist" aria-label={tx('Filtrer', 'Filter')}>
        {[
          ['all', tx('Tous', 'All'), products.length],
          ['low', tx('Presque épuisés', 'Running low'), counts.low],
          ['out', tx('Épuisés', 'Sold out'), counts.out],
        ].map(([id, label, n]) => (
          <button key={id} type="button" role="tab" aria-selected={filter === id} className={`adm-tab ${filter === id ? 'is-active' : ''}`} onClick={() => setFilter(id)}>
            {label} <span>{n}</span>
          </button>
        ))}
      </div>

      <div className="adm-card adm-card--flush">
        {loading && <p className="adm-hint adm-pad">{tx('Chargement…', 'Loading…')}</p>}
        {!loading && rows.length === 0 && <p className="adm-hint adm-pad">{tx('Rien à afficher ici.', 'Nothing to show here.')}</p>}

        <ul className="plist">
          {rows.map((p) => {
            const stock = Number(p.stock)
            const st = statusOf(stock)
            const dirty = String(stock) !== String(drafts[p.id])
            return (
              <li key={p.id} className={`prow prow--${st}`}>
                <div className="prow__thumb">
                  {p.images?.[0] ? <img src={p.images[0]} alt="" /> : <span className="signature">CB</span>}
                </div>
                <div className="prow__info">
                  <strong>{p.name}</strong>
                  {st === 'out' && <span className="adm-pill adm-pill--danger"><IconBan /> {tx('Épuisé', 'Sold out')}</span>}
                  {st === 'low' && (
                    <span className="adm-pill adm-pill--warn"><IconWarning /> {stock === 1 ? tx('Dernière pièce, bientôt épuisé', 'Last piece, about to sell out') : tx(`Plus que ${stock} : bientôt épuisé`, `Only ${stock} left, almost gone`)}</span>
                  )}
                  <ColorDotRow colors={p.colors || []} max={8} />
                </div>
                <div className="stepper">
                  <button type="button" onClick={() => bump(p, -1)} aria-label={tx('Moins', 'Less')}>−</button>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={drafts[p.id] ?? ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                    aria-label={`${tx('Stock de', 'Stock for')} ${p.name}`}
                  />
                  <button type="button" onClick={() => bump(p, 1)} aria-label={tx('Plus', 'More')}>+</button>
                </div>
                <button type="button" className="adm-btn adm-btn--small adm-btn--solid prow__save" disabled={!dirty || savingId === p.id} onClick={() => saveStock(p)}>
                  {savingId === p.id ? '…' : tx('Mettre à jour', 'Update')}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </>
  )
}
