import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import { CATEGORIES } from '../../data/categories.js'
import { formatPrice, salePriceOf } from '../../lib/format.js'
import { ColorDotRow } from '../../components/ColorDots.jsx'
import { IconPlus, IconEdit, IconTrash, IconSearch, IconBox } from '../../components/AdminIcons.jsx'
import ProductForm from './ProductForm.jsx'

export default function ProductsTab() {
  const { lang, tx } = useLanguage()
  const { alerts, refreshAlerts, notify } = useOutletContext()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [formFor, setFormFor] = useState(undefined) // undefined = closed, null = new, object = edit
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')

  const load = useCallback(async () => {
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false })
    setProducts(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter(
      (p) => (category === 'all' || p.category === category) && (!q || p.name.toLowerCase().includes(q))
    )
  }, [products, query, category])

  const remove = async (p) => {
    if (!confirm(tx(`Supprimer « ${p.name} » ?`, `Delete “${p.name}”?`))) return
    const { error } = await supabase.from('products').delete().eq('id', p.id)
    if (error) { notify(error.message, 'err'); return }
    notify(tx('Produit supprimé.', 'Product deleted.'))
    load()
    refreshAlerts()
  }

  const stockPill = (p) => {
    if (p.track_stock === false) return null // stock tracking is off for this product
    const n = Number(p.stock)
    if (n <= 0) return <span className="adm-pill adm-pill--danger">{tx('Épuisé', 'Sold out')}</span>
    if (n <= alerts.threshold) return <span className="adm-pill adm-pill--warn">{tx(`Plus que ${n}`, `Only ${n} left`)}</span>
    return <span className="adm-pill adm-pill--ok">{n} {tx('en stock', 'in stock')}</span>
  }

  return (
    <>
      <div className="adm-head">
        <div>
          <h2>{tx('Produits', 'Products')}</h2>
          <p className="adm-sub">{products.length} {tx('produits au catalogue', 'products in the catalogue')}</p>
        </div>
        <button type="button" className="adm-btn adm-btn--solid" onClick={() => setFormFor(null)}>
          <IconPlus /> {tx('Ajouter un produit', 'Add product')}
        </button>
      </div>

      <div className="adm-toolbar">
        <label className="adm-search">
          <IconSearch aria-hidden="true" />
          <input
            type="search"
            placeholder={tx('Rechercher un produit', 'Search products')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={tx('Rechercher un produit', 'Search products')}
          />
        </label>
        <select className="adm-select" value={category} onChange={(e) => setCategory(e.target.value)} aria-label={tx('Catégorie', 'Category')}>
          <option value="all">{tx('Toutes les catégories', 'All categories')}</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{lang === 'en' ? c.label.en : c.label.fr}</option>
          ))}
        </select>
      </div>

      <div className="adm-card adm-card--flush">
        {loading && <p className="adm-hint adm-pad">{tx('Chargement…', 'Loading…')}</p>}
        {!loading && products.length === 0 && (
          <div className="adm-empty">
            <IconBox />
            <h3>{tx('Aucun produit pour l’instant', 'No products yet')}</h3>
            <p>{tx('Ajoutez votre première pièce avec le bouton ci-dessus.', 'Add your first piece with the button above.')}</p>
          </div>
        )}
        {!loading && products.length > 0 && visible.length === 0 && (
          <p className="adm-hint adm-pad">{tx('Aucun résultat.', 'No results.')}</p>
        )}

        <ul className="plist">
          {visible.map((p) => {
            const cat = CATEGORIES.find((c) => c.id === p.category)
            const sale = salePriceOf(p)
            return (
              <li key={p.id} className="prow">
                <div className="prow__thumb">
                  {p.images?.[0] ? <img src={p.images[0]} alt="" /> : <span className="signature">CB</span>}
                </div>
                <div className="prow__info">
                  <strong>{p.name}</strong>
                  <span className="prow__meta">
                    {sale !== null ? (
                      <span>
                        <s className="prow__old">{formatPrice(p.price, lang === 'en' ? 'en' : 'fr')}</s>{' '}
                        <b className="prow__sale">{formatPrice(sale, lang === 'en' ? 'en' : 'fr')}</b>
                      </span>
                    ) : (
                      formatPrice(p.price, lang === 'en' ? 'en' : 'fr')
                    )}
                    <i aria-hidden="true">/</i>
                    {cat ? (lang === 'en' ? cat.label.en : cat.label.fr) : tx('Autres', 'Other')}
                    {p.has_size && p.sizes?.length > 0 && (<><i aria-hidden="true">/</i>{p.sizes.join(' ')}</>)}
                  </span>
                  <ColorDotRow colors={p.colors || []} max={8} />
                </div>
                <div className="prow__stock">{stockPill(p)}</div>
                <div className="prow__actions">
                  <button type="button" className="adm-btn adm-btn--small" onClick={() => setFormFor(p)}>
                    <IconEdit /> {tx('Modifier', 'Edit')}
                  </button>
                  <button type="button" className="adm-btn adm-btn--small adm-btn--danger" onClick={() => remove(p)} aria-label={tx('Supprimer', 'Delete')}>
                    <IconTrash />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {formFor !== undefined && (
        <ProductForm
          key={formFor?.id || 'new'}
          product={formFor}
          notify={notify}
          onClose={() => setFormFor(undefined)}
          onSaved={() => { setFormFor(undefined); load(); refreshAlerts() }}
        />
      )}
    </>
  )
}
