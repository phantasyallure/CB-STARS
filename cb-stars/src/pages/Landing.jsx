import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import ProductCard from '../components/ProductCard.jsx'
import SupportChat from '../components/SupportChat.jsx'
import SiteHeader from '../components/SiteHeader.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { CATEGORIES, categoryLabel, normalizeCategory } from '../data/categories.js'
import './Landing.css'

export default function Landing() {
  const { t, lang } = useLanguage()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [activeCategory, setActiveCategory] = useState('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef(null)

  // Close the category list on outside click or Escape.
  useEffect(() => {
    if (!filterOpen) return undefined
    const onDown = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setFilterOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [filterOpen])

  const pickCategory = (id) => {
    setActiveCategory(id)
    setFilterOpen(false)
  }

  const load = async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const { data, error } = await supabase
        .from('products_public')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setProducts(data || [])
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // Only show filter tabs for categories that actually have products.
  const availableCategories = useMemo(
    () => CATEGORIES.filter((c) => products.some((p) => normalizeCategory(p.category) === c.id)),
    [products]
  )

  const filteredProducts = useMemo(
    () => (activeCategory === 'all' ? products : products.filter((p) => normalizeCategory(p.category) === activeCategory)),
    [products, activeCategory]
  )

  return (
    <div className="landing">
      <SiteHeader />

      <section className="hero">
        <h1 className="sr-only">{t('meta.title')}</h1>
        <picture>
          <source media="(max-width: 768px)" srcSet="/images/hero-mobile.jpg" />
          <img className="hero__img" src="/images/hero-desktop.jpg" alt="" fetchpriority="high" />
        </picture>
        <a href="#collection" className="hero__cta">{t('hero.cta')}</a>
      </section>

      <section className="trust">
        <div className="container trust__row">
          <span>{t('trust.delivery')}</span>
          <span className="trust__divider" aria-hidden="true" />
          <span>{t('trust.cod')}</span>
          <span className="trust__divider" aria-hidden="true" />
          <span>{t('trust.curated')}</span>
        </div>
      </section>

      <main id="collection" className="container landing__main">
        <div className="landing__main-head">
          <h2>{t('collection.heading')}</h2>
          <p>{t('collection.subheading')}</p>
        </div>

        {loading && <p className="landing__status">{t('collection.loading')}</p>}

        {!loading && loadError && (
          <p className="landing__status">
            {t('collection.loadError') || (lang === 'ar' ? 'تعذر تحميل المنتجات.' : lang === 'en' ? 'Could not load products.' : "Impossible de charger les produits.")}
            {' '}
            <button type="button" className="landing__retry" onClick={load}>
              {lang === 'ar' ? 'إعادة المحاولة' : lang === 'en' ? 'Retry' : 'Réessayer'}
            </button>
          </p>
        )}

        {!loading && !loadError && products.length === 0 && (
          <p className="landing__status">{t('collection.empty')}</p>
        )}

        {!loading && !loadError && products.length > 0 && (
          <div className={`category-filter ${filterOpen ? 'is-open' : ''}`} ref={filterRef}>
            <button
              type="button"
              className={`category-filter__button ${activeCategory !== 'all' ? 'is-filtered' : ''}`}
              aria-haspopup="listbox"
              aria-expanded={filterOpen}
              aria-controls="category-list"
              aria-label={t('collection.filterLabel')}
              onClick={() => setFilterOpen((o) => !o)}
            >
              <svg className="category-filter__icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 6h16M7 12h10M10 18h4" />
              </svg>
              <span>
                {t('collection.filterButton')}
                {activeCategory !== 'all' && <span className="category-filter__current"> · {categoryLabel(activeCategory, lang)}</span>}
              </span>
              <svg className="category-filter__chevron" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            <div className="category-filter__panel" id="category-list" role="listbox" aria-label={t('collection.filterLabel')}>
              <button
                type="button"
                role="option"
                aria-selected={activeCategory === 'all'}
                className={`category-filter__option ${activeCategory === 'all' ? 'is-active' : ''}`}
                tabIndex={filterOpen ? 0 : -1}
                onClick={() => pickCategory('all')}
              >
                <span>{t('collection.filterAll')}</span>
                <span className="category-filter__count">{products.length}</span>
              </button>
              {availableCategories.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  role="option"
                  aria-selected={activeCategory === c.id}
                  className={`category-filter__option ${activeCategory === c.id ? 'is-active' : ''}`}
                  tabIndex={filterOpen ? 0 : -1}
                  onClick={() => pickCategory(c.id)}
                >
                  <span>{categoryLabel(c.id, lang)}</span>
                  <span className="category-filter__count">{products.filter((p) => normalizeCategory(p.category) === c.id).length}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!loading && products.length > 0 && filteredProducts.length === 0 && (
          <p className="landing__status">{t('collection.emptyCategory')}</p>
        )}

        <div className="landing__grid">
          {filteredProducts.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </main>

      <footer className="landing__footer">
        <div className="container landing__footer-inner">
          <div>
            <span className="brand-mark landing__footer-brand">CB</span>
            <p className="landing__footer-tagline">{t('footer.tagline')}</p>
          </div>
          <p className="landing__footer-rights">© {new Date().getFullYear()} CB Stars — {t('footer.rights')}</p>
        </div>
      </footer>

      <SupportChat />
    </div>
  )
}
