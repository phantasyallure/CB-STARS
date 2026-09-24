import { useLanguage } from '../i18n/LanguageContext.jsx'
import { formatPrice, salePriceOf } from '../lib/format.js'
import { ColorDotRow } from './ColorDots.jsx'
import './ProductCard.css'

export default function ProductCard({ product }) {
  const { lang, t } = useLanguage()
  const cover = product.images?.[0]
  const hover = product.images?.[1]
  const soldOut = !!product.sold_out
  const sale = soldOut ? null : salePriceOf(product)

  const openProduct = () => {
    window.open(`/product/${product.id}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <button className={`product-card ${soldOut ? 'is-sold-out' : ''}`} onClick={openProduct}>
      <div className="product-card__image">
        {cover ? (
          <>
            <img className="product-card__img" src={cover} alt={product.name} loading="lazy" />
            {hover && <img className="product-card__img product-card__img--hover" src={hover} alt="" loading="lazy" />}
          </>
        ) : (
          <div className="product-card__placeholder signature">CB Stars</div>
        )}
        {soldOut && <span className="product-card__badge">{t('product.soldOut')}</span>}
        {sale !== null && <span className="product-card__promo">{t('product.promo')}</span>}
      </div>
      <div className="product-card__info">
        <h3>{product.name}</h3>
        <span className="product-card__price">
          {sale !== null ? (
            <>
              <s className="product-card__price-old">{formatPrice(product.price, lang)}</s>
              <span className="product-card__price-now">{formatPrice(sale, lang)}</span>
            </>
          ) : (
            formatPrice(product.price, lang)
          )}
        </span>
        <ColorDotRow colors={product.colors || []} />
      </div>
    </button>
  )
}
