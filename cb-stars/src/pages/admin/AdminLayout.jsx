import { useCallback, useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext.jsx'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import {
  IconBox, IconReceipt, IconLayers, IconChart, IconChat, IconUsers, IconSettings,
  IconLogout, IconMenu, IconX, IconCheck, IconWarning,
} from '../../components/AdminIcons.jsx'
import '../admin.css'

const NAV = [
  { to: 'products', perm: 'products', icon: IconBox, fr: 'Produits', en: 'Products' },
  { to: 'orders', perm: 'orders', icon: IconReceipt, fr: 'Commandes', en: 'Orders', badge: 'orders' },
  { to: 'stock', perm: 'stock', icon: IconLayers, fr: 'Stock', en: 'Stock', badge: 'stock' },
  { to: 'analytics', perm: 'analytics', icon: IconChart, fr: 'Statistiques', en: 'Analytics' },
  { to: 'messages', perm: 'chat', icon: IconChat, fr: 'Messages', en: 'Messages' },
  { to: 'team', perm: 'team', icon: IconUsers, fr: 'Équipe', en: 'Team' },
  { to: 'settings', perm: 'settings', icon: IconSettings, fr: 'Réglages', en: 'Settings' },
]

// 'team' is owner-only, so it never appears in the permission list a staff member can hold.
function allowed(auth, perm) {
  if (perm === 'team') return auth.profile?.role === 'owner'
  return auth.can(perm)
}

export function AdminHome() {
  const auth = useAuth()
  const first = ['orders', 'products', 'stock', 'analytics', 'messages', 'settings', 'team']
    .map((to) => NAV.find((n) => n.to === to))
    .find((n) => allowed(auth, n.perm))
  return <Navigate to={first ? `/admin/${first.to}` : '/admin'} replace />
}

export function Guard({ perm, children }) {
  const auth = useAuth()
  const { tx } = useLanguage()
  if (!allowed(auth, perm)) {
    return (
      <div className="adm-card adm-empty">
        <IconWarning />
        <h3>{tx("Accès refusé", 'No access')}</h3>
        <p>{tx("Votre compte n'a pas la permission d'ouvrir cette page.", "Your account doesn't have permission to open this page.")}</p>
      </div>
    )
  }
  return children
}

export default function AdminLayout() {
  const auth = useAuth()
  const { lang, setLang, tx } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [alerts, setAlerts] = useState({ newOrders: 0, lowStock: 0, outOfStock: 0, threshold: 3 })
  const [toast, setToast] = useState(null)

  const canOrders = auth.can('orders')
  const canStock = auth.can('stock')

  const refreshAlerts = useCallback(async () => {
    const next = {}
    if (canOrders) {
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'new')
      next.newOrders = count || 0
    }
    if (canStock) {
      const [{ data: products }, { data: setting }] = await Promise.all([
        supabase.from('products').select('stock, track_stock'),
        supabase.from('site_settings').select('value').eq('key', 'low_stock_threshold').maybeSingle(),
      ])
      const threshold = Math.max(0, parseInt(setting?.value ?? '3', 10) || 0)
      const list = (products || []).filter((p) => p.track_stock !== false)
      next.threshold = threshold
      next.outOfStock = list.filter((p) => Number(p.stock) <= 0).length
      next.lowStock = list.filter((p) => Number(p.stock) > 0 && Number(p.stock) <= threshold).length
    }
    setAlerts((prev) => ({ ...prev, ...next }))
  }, [canOrders, canStock])

  useEffect(() => {
    if (!auth.profile) return
    refreshAlerts()
    const id = setInterval(refreshAlerts, 60000)
    return () => clearInterval(id)
  }, [auth.profile, refreshAlerts])

  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3600)
    return () => clearTimeout(id)
  }, [toast])

  const notify = useCallback((text, type = 'ok') => setToast({ text, type }), [])

  if (auth.loading) {
    return <div className="adm-boot">{tx('Chargement…', 'Loading…')}</div>
  }
  if (!auth.session || !auth.profile) {
    return <Navigate to="/admin" replace />
  }

  const logout = async () => {
    await auth.signOut()
    navigate('/admin')
  }

  const badgeFor = (key) => {
    if (key === 'orders') return alerts.newOrders > 0 ? { n: alerts.newOrders, tone: 'info' } : null
    if (key === 'stock') {
      const n = alerts.lowStock + alerts.outOfStock
      return n > 0 ? { n, tone: 'warn' } : null
    }
    return null
  }

  const visible = NAV.filter((n) => allowed(auth, n.perm))
  const displayName = auth.profile.full_name || auth.profile.email

  return (
    <div className="adm">
      <button
        type="button"
        className="adm-scrim"
        data-open={menuOpen}
        aria-label={tx('Fermer le menu', 'Close menu')}
        onClick={() => setMenuOpen(false)}
        tabIndex={menuOpen ? 0 : -1}
      />

      <aside className="adm-side" data-open={menuOpen}>
        <div className="adm-side__brand">
          <span className="signature adm-side__logo">CB Stars</span>
          <span className="adm-side__tag">{tx('Administration', 'Admin')}</span>
        </div>

        <nav className="adm-side__nav" aria-label={tx('Navigation admin', 'Admin navigation')}>
          {visible.map((n) => {
            const Icon = n.icon
            const badge = n.badge ? badgeFor(n.badge) : null
            return (
              <NavLink key={n.to} to={`/admin/${n.to}`} className="adm-side__link">
                <Icon aria-hidden="true" />
                <span>{tx(n.fr, n.en)}</span>
                {badge && (
                  <span
                    className={`adm-badge adm-badge--${badge.tone}`}
                    title={n.badge === 'stock' ? tx('Produits presque épuisés ou épuisés', 'Products running low or sold out') : tx('Nouvelles commandes', 'New orders')}
                  >
                    {badge.n}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>

        <div className="adm-side__foot">
          <div className="adm-side__who">
            <strong>{displayName}</strong>
            <span>{auth.profile.role === 'owner' ? tx('Propriétaire', 'Owner') : tx('Équipe', 'Staff')}</span>
          </div>
          <div className="adm-side__actions">
            <div className="adm-langs" role="group" aria-label={tx('Langue', 'Language')}>
              <button type="button" className={lang !== 'en' ? 'is-active' : ''} onClick={() => setLang('fr')}>FR</button>
              <button type="button" className={lang === 'en' ? 'is-active' : ''} onClick={() => setLang('en')}>EN</button>
            </div>
            <button type="button" className="adm-side__logout" onClick={logout}>
              <IconLogout aria-hidden="true" />
              {tx('Déconnexion', 'Sign out')}
            </button>
          </div>
        </div>
      </aside>

      <div className="adm-main">
        <header className="adm-top">
          <button type="button" className="adm-top__menu" onClick={() => setMenuOpen((v) => !v)} aria-label={tx('Ouvrir le menu', 'Open menu')} aria-expanded={menuOpen}>
            {menuOpen ? <IconX /> : <IconMenu />}
          </button>
          <span className="signature adm-top__logo">CB Stars</span>
        </header>
        <main className="adm-content">
          <Outlet context={{ alerts, refreshAlerts, notify }} />
        </main>
      </div>

      {toast && (
        <div className={`adm-toast adm-toast--${toast.type}`} role="status">
          {toast.type === 'ok' ? <IconCheck /> : <IconWarning />}
          {toast.text}
        </div>
      )}
    </div>
  )
}
