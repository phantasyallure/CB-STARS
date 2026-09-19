import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import { formatPrice } from '../../lib/format.js'
import { StackedBars, Donut, HBars, CHART_COLORS } from '../../components/charts.jsx'

const RANGES = [7, 30, 90]

function dayKey(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function AnalyticsTab() {
  const { lang, tx } = useLanguage()
  const uiLang = lang === 'en' ? 'en' : 'fr'
  const [days, setDays] = useState(30)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const since = new Date()
    since.setHours(0, 0, 0, 0)
    since.setDate(since.getDate() - (days - 1))
    supabase
      .from('orders')
      .select('id, status, created_at, wilaya, unit_price, product_id, products(name, price)')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true })
      .limit(5000)
      .then(({ data }) => {
        if (cancelled) return
        setOrders(data || [])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [days])

  const stats = useMemo(() => {
    const accepted = orders.filter((o) => o.status === 'confirmed')
    const refused = orders.filter((o) => o.status === 'cancelled')
    const pending = orders.filter((o) => o.status === 'new' || o.status === 'contacted')
    const decided = accepted.length + refused.length
    const revenue = accepted.reduce((sum, o) => sum + Number(o.unit_price ?? o.products?.price ?? 0), 0)

    // one bucket per day, oldest first
    const buckets = new Map()
    const cursor = new Date()
    cursor.setHours(0, 0, 0, 0)
    cursor.setDate(cursor.getDate() - (days - 1))
    for (let i = 0; i < days; i++) {
      buckets.set(dayKey(cursor), {
        label: cursor.toLocaleDateString(uiLang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' }),
        accepted: 0, pending: 0, refused: 0,
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    orders.forEach((o) => {
      const b = buckets.get(dayKey(o.created_at))
      if (!b) return
      if (o.status === 'confirmed') b.accepted += 1
      else if (o.status === 'cancelled') b.refused += 1
      else b.pending += 1
    })

    const tally = (list, keyFn) => {
      const m = new Map()
      list.forEach((o) => { const k = keyFn(o); if (k) m.set(k, (m.get(k) || 0) + 1) })
      return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6)
    }

    return {
      total: orders.length,
      accepted: accepted.length,
      refused: refused.length,
      pending: pending.length,
      rate: decided ? Math.round((accepted.length / decided) * 100) : null,
      revenue,
      daily: [...buckets.values()],
      topProducts: tally(accepted.length ? accepted : orders, (o) => o.products?.name),
      topProductsAreAccepted: accepted.length > 0,
      topWilayas: tally(orders, (o) => o.wilaya),
    }
  }, [orders, days, uiLang])

  const kpis = [
    { label: tx('Commandes reçues', 'Orders received'), value: stats.total, tone: 'neutral' },
    { label: tx('Acceptées', 'Accepted'), value: stats.accepted, tone: 'ok' },
    { label: tx('Refusées', 'Refused'), value: stats.refused, tone: 'danger' },
    { label: tx('En attente', 'Pending'), value: stats.pending, tone: 'warn' },
    { label: tx('Taux d’acceptation', 'Acceptance rate'), value: stats.rate === null ? '—' : `${stats.rate}%`, tone: 'neutral' },
    { label: tx('Chiffre d’affaires accepté', 'Accepted revenue'), value: formatPrice(stats.revenue, uiLang), tone: 'neutral', wide: true },
  ]

  const rangeLabel = (d) => (d === 30 ? tx('30 derniers jours', 'Last 30 days') : tx(`${d} derniers jours`, `Last ${d} days`))

  return (
    <>
      <div className="adm-head">
        <div>
          <h2>{tx('Statistiques', 'Analytics')}</h2>
          <p className="adm-sub">{rangeLabel(days)}</p>
        </div>
        <div className="adm-segment" role="group" aria-label={tx('Période', 'Period')}>
          {RANGES.map((d) => (
            <button key={d} type="button" className={days === d ? 'is-active' : ''} aria-pressed={days === d} onClick={() => setDays(d)}>
              {d} {tx('j', 'd')}
            </button>
          ))}
        </div>
      </div>

      <div className="adm-kpis adm-kpis--six">
        {kpis.map((k) => (
          <div key={k.label} className={`adm-kpi adm-kpi--${k.tone} adm-kpi--plain`}>
            <span className="adm-kpi__label">{k.label}</span>
            <span className={`adm-kpi__value ${k.wide ? 'adm-kpi__value--sm' : ''}`}>{loading ? '…' : k.value}</span>
          </div>
        ))}
      </div>

      <div className="adm-grid-2">
        <section className="adm-card adm-span-2">
          <h3>{tx('Commandes par jour', 'Orders per day')}</h3>
          <div className="legend">
            <span><i style={{ background: CHART_COLORS.accepted }} />{tx('Acceptées', 'Accepted')}</span>
            <span><i style={{ background: CHART_COLORS.pending }} />{tx('En attente', 'Pending')}</span>
            <span><i style={{ background: CHART_COLORS.refused }} />{tx('Refusées', 'Refused')}</span>
          </div>
          {stats.total === 0 && !loading
            ? <p className="adm-hint">{tx('Aucune commande sur cette période.', 'No orders in this period.')}</p>
            : <StackedBars data={stats.daily} ariaLabel={tx('Commandes par jour, acceptées, en attente et refusées', 'Orders per day: accepted, pending and refused')} />}
        </section>

        <section className="adm-card">
          <h3>{tx('Répartition', 'Breakdown')}</h3>
          <div className="donut-wrap">
            <Donut
              ariaLabel={tx('Répartition des commandes par statut', 'Orders split by status')}
              centerValue={stats.total}
              centerLabel={tx('commandes', 'orders')}
              segments={[
                { label: tx('Acceptées', 'Accepted'), value: stats.accepted, color: CHART_COLORS.accepted },
                { label: tx('En attente', 'Pending'), value: stats.pending, color: CHART_COLORS.pending },
                { label: tx('Refusées', 'Refused'), value: stats.refused, color: CHART_COLORS.refused },
              ]}
            />
            <ul className="donut-legend">
              <li><i style={{ background: CHART_COLORS.accepted }} />{tx('Acceptées', 'Accepted')}<strong>{stats.accepted}</strong></li>
              <li><i style={{ background: CHART_COLORS.pending }} />{tx('En attente', 'Pending')}<strong>{stats.pending}</strong></li>
              <li><i style={{ background: CHART_COLORS.refused }} />{tx('Refusées', 'Refused')}<strong>{stats.refused}</strong></li>
            </ul>
          </div>
        </section>

        <section className="adm-card">
          <h3>{stats.topProductsAreAccepted ? tx('Produits les plus acceptés', 'Top accepted products') : tx('Produits les plus commandés', 'Most ordered products')}</h3>
          <HBars items={stats.topProducts} empty={tx('Pas encore de données.', 'No data yet.')} />
        </section>

        <section className="adm-card adm-span-2">
          <h3>{tx('Wilayas les plus actives', 'Top wilayas')}</h3>
          <HBars items={stats.topWilayas} empty={tx('Pas encore de données.', 'No data yet.')} />
        </section>
      </div>
    </>
  )
}
