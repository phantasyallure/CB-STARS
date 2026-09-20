import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import { formatDateTime, formatPrice } from '../../lib/format.js'
import { colorName, normalizeHex } from '../../data/colors.js'
import { IconReceipt, IconSearch, IconCheck, IconX } from '../../components/AdminIcons.jsx'

export const STATUSES = ['new', 'contacted', 'confirmed', 'cancelled']

// DB values stay new | contacted | confirmed | cancelled; "confirmed" is shown as
// Accepted and "cancelled" as Refused everywhere in the admin.
export function statusLabel(status, tx) {
  return {
    new: tx('Nouvelle', 'New'),
    contacted: tx('Contactée', 'Contacted'),
    confirmed: tx('Acceptée', 'Accepted'),
    cancelled: tx('Refusée', 'Refused'),
  }[status] || status
}

export default function OrdersTab() {
  const { lang, tx } = useLanguage()
  const { refreshAlerts, notify } = useOutletContext()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, products(name, price)')
      .order('created_at', { ascending: false })
      .limit(500)
    setOrders(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const updateStatus = async (id, status) => {
    const previous = orders
    setOrders((list) => list.map((o) => (o.id === id ? { ...o, status } : o)))
    const { error } = await supabase.from('orders').update({ status }).eq('id', id)
    if (error) {
      setOrders(previous)
      notify(error.message, 'err')
      return
    }
    refreshAlerts()
  }

  const counts = useMemo(() => {
    const c = { all: orders.length }
    STATUSES.forEach((s) => { c[s] = orders.filter((o) => o.status === s).length })
    return c
  }, [orders])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return orders.filter((o) => {
      if (filter !== 'all' && o.status !== filter) return false
      if (!q) return true
      return `${o.first_name} ${o.last_name} ${o.phone} ${o.wilaya} ${o.commune || ''} ${o.products?.name || ''}`.toLowerCase().includes(q)
    })
  }, [orders, filter, query])

  const uiLang = lang === 'en' ? 'en' : 'fr'

  return (
    <>
      <div className="adm-head">
        <div>
          <h2>{tx('Commandes', 'Orders')}</h2>
          <p className="adm-sub">{tx('Acceptez ou refusez chaque commande après avoir appelé le client.', 'Accept or refuse each order after calling the customer.')}</p>
        </div>
      </div>

      <div className="adm-toolbar">
        <label className="adm-search">
          <IconSearch aria-hidden="true" />
          <input type="search" placeholder={tx('Nom, téléphone, wilaya, produit', 'Name, phone, wilaya, product')} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={tx('Rechercher', 'Search')} />
        </label>
      </div>

      <div className="adm-tabs" role="tablist">
        {['all', ...STATUSES].map((s) => (
          <button key={s} type="button" role="tab" aria-selected={filter === s} className={`adm-tab ${filter === s ? 'is-active' : ''}`} onClick={() => setFilter(s)}>
            {s === 'all' ? tx('Toutes', 'All') : statusLabel(s, tx)} <span>{counts[s]}</span>
          </button>
        ))}
      </div>

      <div className="adm-card adm-card--flush">
        {loading && <p className="adm-hint adm-pad">{tx('Chargement…', 'Loading…')}</p>}
        {!loading && rows.length === 0 && (
          <div className="adm-empty">
            <IconReceipt />
            <h3>{tx('Aucune commande', 'No orders')}</h3>
          </div>
        )}

        <ul className="olist">
          {rows.map((o) => {
            const hex = normalizeHex(o.color)
            const price = o.unit_price ?? o.products?.price
            return (
              <li key={o.id} className={`orow orow--${o.status}`}>
                <div className="orow__who">
                  <strong>{o.first_name} {o.last_name}</strong>
                  <a href={`tel:${o.phone}`}>{o.phone}</a>
                  <span>{o.wilaya}{o.commune ? ` — ${o.commune}` : ''}</span>
                </div>
                <div className="orow__item">
                  <span>{o.products?.name || tx('Produit supprimé', 'Deleted product')}</span>
                  <span className="orow__tags">
                    {hex && (
                      <span className="adm-tag">
                        <span className="color-dot" style={{ '--c': hex, '--dot': '12px' }} />
                        {colorName(hex, uiLang) || hex}
                      </span>
                    )}
                    {o.size && <span className="adm-tag">{tx('Taille', 'Size')} {o.size}</span>}
                    {price != null && <span className="adm-tag">{formatPrice(price, uiLang)}</span>}
                  </span>
                  <small>{formatDateTime(o.created_at, uiLang)}</small>
                </div>
                <div className="orow__status">
                  <span className={`adm-pill adm-pill--${o.status}`}>{statusLabel(o.status, tx)}</span>
                  <div className="orow__buttons">
                    <button type="button" className="adm-btn adm-btn--small adm-btn--accept" disabled={o.status === 'confirmed'} onClick={() => updateStatus(o.id, 'confirmed')}>
                      <IconCheck /> {tx('Accepter', 'Accept')}
                    </button>
                    <button type="button" className="adm-btn adm-btn--small adm-btn--danger" disabled={o.status === 'cancelled'} onClick={() => updateStatus(o.id, 'cancelled')}>
                      <IconX /> {tx('Refuser', 'Refuse')}
                    </button>
                  </div>
                  <select className="adm-select adm-select--small" value={o.status} onChange={(e) => updateStatus(o.id, e.target.value)} aria-label={tx('Changer le statut', 'Change status')}>
                    {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s, tx)}</option>)}
                  </select>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </>
  )
}
