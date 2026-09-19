import { useEffect, useMemo, useState } from 'react'
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
  const [activeCategory, setActiveCategory] = useState('all')

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('products_public')
        .select('*')
        .order('created_at', { ascending: false })
      setProducts(data || [])
      setLoading(false)
    }
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

        {!loading && products.length === 0 && (
          <p className="landing__status">{t('collection.empty')}</p>
        )}

        {!loading && products.length > 0 && (
          <div className="category-filter" role="group" aria-label={t('collection.filterLabel')}>
            <button
              type="button"
              className={`category-filter__tab ${activeCategory === 'all' ? 'is-active' : ''}`}
              aria-pressed={activeCategory === 'all'}
              onClick={() => setActiveCategory('all')}
            >
              {t('collection.filterAll')}
            </button>
            {availableCategories.map((c) => (
              <button
                type="button"
                key={c.id}
                className={`category-filter__tab ${activeCategory === c.id ? 'is-active' : ''}`}
                aria-pressed={activeCategory === c.id}
                onClick={() => setActiveCategory(c.id)}
              >
                {categoryLabel(c.id, lang)}
              </button>
            ))}
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
            <span className="signature landing__footer-brand">CB Stars</span>
            <p className="landing__footer-tagline">{t('footer.tagline')}</p>
          </div>
          <p className="landing__footer-rights">© {new Date().getFullYear()} CB Stars — {t('footer.rights')}</p>
        </div>
      </footer>

      <SupportChat />
    </div>
  )
}
