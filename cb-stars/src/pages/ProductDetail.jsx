import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { WILAYAS, WILAYAS_AR } from '../data/wilayas'
import { COMMUNES, COMMUNES_AR } from '../data/communes'
import SupportChat from '../components/SupportChat.jsx'
import SiteHeader from '../components/SiteHeader.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { formatPrice, salePriceOf, currentPrice } from '../lib/format.js'
import { ColorPicker } from '../components/ColorDots.jsx'
import { normalizeHex } from '../data/colors.js'
import { trackPixel } from '../lib/pixel.js'
import './ProductDetail.css'

export default function ProductDetail() {
  const { id } = useParams()
  const { t, lang } = useLanguage()
  const wilayaLabels = lang === 'ar' ? WILAYAS_AR : WILAYAS  // French names are used for fr and en
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [activeImage, setActiveImage] = useState(0)
  const [photoColor, setPhotoColor] = useState('') // last picked colour that has its own photos

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    wilaya: '',
    commune: '',
    size: '',
    color: '',
    deliveryType: 'home', // 'home' | 'office'
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [rates, setRates] = useState({}) // wilaya -> { home, office } delivery prices (DA)

  const load = async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const { data, error } = await supabase.from('products_public').select('*').eq('id', id).single()
      if (error) throw error
      setProduct(data)
      if (data) {
        trackPixel('ViewContent', {
          content_ids: [data.id],
          content_name: data.name,
          content_type: 'product',
          value: currentPrice(data),
          currency: 'DZD',
        })
      }
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  // Delivery prices are set per wilaya in the admin. If they can't be loaded the page
  // simply shows no delivery line.
  useEffect(() => {
    supabase
      .from('delivery_rates')
      .select('wilaya, price, office_price')
      .then(({ data }) => {
        const num = (v) => (v === null || v === undefined ? null : Number(v))
        setRates(Object.fromEntries((data || []).map((r) => [r.wilaya, { home: num(r.price), office: num(r.office_price) }])))
      })
      .catch(() => {})
  }, [])

  const updateField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  // Changing wilaya resets the commune. If the chosen delivery method is not offered in the
  // new wilaya but the other one is, switch to the other one.
  const updateWilaya = (e) => {
    const wilaya = e.target.value
    setForm((f) => {
      const r = rates[wilaya]
      let deliveryType = f.deliveryType
      if (r && r[deliveryType] == null) {
        const other = deliveryType === 'home' ? 'office' : 'home'
        if (r[other] != null) deliveryType = other
      }
      return { ...f, wilaya, commune: '', deliveryType }
    })
  }
  const communeOptions = form.wilaya ? (COMMUNES[form.wilaya] || []) : []
  const communeLabels = form.wilaya ? (lang === 'ar' ? (COMMUNES_AR[form.wilaya] || []) : communeOptions) : []
  const colorList = (product?.colors || []).map(normalizeHex).filter(Boolean)
  const hasColors = colorList.length > 0
  const sale = product && !product.sold_out ? salePriceOf(product) : null
  const wilayaRate = form.wilaya ? rates[form.wilaya] : undefined
  const feeFor = (type) => (wilayaRate && wilayaRate[type] != null ? wilayaRate[type] : null)
  const delivery = feeFor(form.deliveryType)
  const deliveryLabel = form.deliveryType === 'office' ? t('productDetail.deliveryOffice') : t('productDetail.deliveryHome')
  const soldSizes = product?.sold_sizes || []
  const unitPrice = product ? (sale ?? Number(product.price)) : 0

  const submitOrder = async (e) => {
    e.preventDefault()
    setError('')

    if (!form.firstName.trim() || !form.lastName.trim() || !form.phone.trim() || !form.wilaya || !form.commune) {
      setError(t('productDetail.errorRequired'))
      return
    }
    if (product.sold_out) return
    if (hasColors && !form.color) {
      setError(t('productDetail.errorColor'))
      return
    }
    if (product.has_size && !form.size) {
      setError(t('productDetail.errorSize'))
      return
    }
    if (product.has_size && soldSizes.includes(form.size)) {
      setError(t('productDetail.errorSize'))
      return
    }

    setSubmitting(true)
    const { error: insertError } = await supabase.from('orders').insert({
      product_id: product.id,
      first_name: form.firstName.trim(),
      last_name: form.lastName.trim(),
      phone: form.phone.trim(),
      wilaya: form.wilaya,
      commune: form.commune,
      size: product.has_size ? form.size : null,
      color: hasColors ? form.color : null,
      delivery_type: delivery !== null ? form.deliveryType : null,
    })
    setSubmitting(false)

    if (insertError) {
      setError(t('productDetail.errorSubmit'))
      return
    }
    trackPixel('Purchase', {
      content_ids: [product.id],
      content_name: product.name,
      content_type: 'product',
      num_items: 1,
      value: currentPrice(product) + (delivery ?? 0),
      currency: 'DZD',
    })
    setSubmitted(true)
  }

  if (loading) {
    return (
      <div className="product-page">
        <SiteHeader />
        <div className="container product-page__status">
          <p>{t('productDetail.loading')}</p>
        </div>
      </div>
    )
  }

  if (!product && loadError) {
    return (
      <div className="product-page">
        <SiteHeader />
        <div className="container product-page__status">
          <p>{lang === 'ar' ? 'تعذر تحميل هذا المنتج.' : lang === 'en' ? 'Could not load this product.' : 'Impossible de charger ce produit.'}</p>
          <button type="button" className="btn" onClick={load}>
            {lang === 'ar' ? 'إعادة المحاولة' : lang === 'en' ? 'Retry' : 'Réessayer'}
          </button>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="product-page">
        <SiteHeader />
        <div className="container product-page__status">
          <p>{t('productDetail.notFound')}</p>
          <Link to="/" className="btn">{t('productDetail.backToShop')}</Link>
        </div>
      </div>
    )
  }

  // Photos can be tagged with a colour in the admin (product.image_colors). When the
  // customer picks a colour that has photos, those photos come first (then the shared
  // ones). A colour without any photo of its own leaves the gallery as it is.
  const allImages = product.images || []
  const imageColors = product.image_colors || {}
  const isColorPhoto = (url, hex) => normalizeHex(imageColors[url]) === hex
  const colorPhotos = photoColor ? allImages.filter((url) => isColorPhoto(url, photoColor)) : []
  const images = colorPhotos.length > 0
    ? [...colorPhotos, ...allImages.filter((url) => !normalizeHex(imageColors[url]))]
    : (allImages.length ? allImages : [null])

  const pickColor = (hex) => {
    setForm((f) => ({ ...f, color: hex }))
    if (allImages.some((url) => isColorPhoto(url, hex))) {
      setPhotoColor(hex)
      setActiveImage(0)
    }
  }

  return (
    <div className="product-page">
      <SiteHeader />

      <div className="container product-page__top">
        <Link to="/" className="product-page__back">← {t('productDetail.back')}</Link>
      </div>

      <div className="container product-page__grid">
        <div className="product-gallery">
          <div className="product-gallery__main">
            {sale !== null && <span className="product-gallery__promo">{t('product.promo')}</span>}
            {images[activeImage] ? (
              <img key={images[activeImage]} src={images[activeImage]} alt={product.name} />
            ) : (
              <div className="product-gallery__placeholder signature">CB Stars</div>
            )}
          </div>
          {images.length > 1 && (
            <div className="product-gallery__thumbs">
              {images.map((src, i) => (
                <button
                  key={i}
                  className={`product-gallery__thumb ${i === activeImage ? 'is-active' : ''}`}
                  onClick={() => setActiveImage(i)}
                >
                  {src && <img src={src} alt={`${product.name} ${i + 1}`} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="product-info">
          <h1>{product.name}</h1>
          {product.sold_out && <span className="product-info__badge">{t('product.soldOut')}</span>}
          <div className="product-info__pricing">
            <p className="product-info__price">
              {sale !== null ? (
                <>
                  <s className="product-info__price-old">{formatPrice(product.price, lang)}</s>
                  <span className="product-info__price-now">{formatPrice(sale, lang)}</span>
                </>
              ) : (
                formatPrice(product.price, lang)
              )}
            </p>
          </div>
          {product.description && <p className="product-info__description">{product.description}</p>}

          {hasColors && !submitted && !product.sold_out && (
            <ColorPicker
              colors={colorList}
              value={form.color}
              onChange={pickColor}
              label={t('productDetail.color')}
            />
          )}

          {submitted ? (
            <div className="order-success">
              <h3>{t('productDetail.successTitle')}</h3>
              <p>{t('productDetail.successMessage', { name: form.firstName, phone: form.phone })}</p>
            </div>
          ) : product.sold_out ? (
            <div className="order-form order-form--sold-out">
              <h3>{t('productDetail.soldOutTitle')}</h3>
              <p>{t('productDetail.soldOutMessage')}</p>
            </div>
          ) : (
            <form className="order-form" onSubmit={submitOrder}>
              <h3>{t('productDetail.formTitle')}</h3>

              <div className="order-form__row">
                <div className="field">
                  <label>{t('productDetail.firstName')}</label>
                  <input type="text" value={form.firstName} onChange={updateField('firstName')} />
                </div>
                <div className="field">
                  <label>{t('productDetail.lastName')}</label>
                  <input type="text" value={form.lastName} onChange={updateField('lastName')} />
                </div>
              </div>

              <div className="field">
                <label>{t('productDetail.phone')}</label>
                <input type="tel" placeholder={t('productDetail.phonePlaceholder')} value={form.phone} onChange={updateField('phone')} />
              </div>

              <div className="field">
                <label>{t('productDetail.wilaya')}</label>
                <select value={form.wilaya} onChange={updateWilaya}>
                  <option value="">{t('productDetail.wilayaPlaceholder')}</option>
                  {WILAYAS.map((w, i) => (
                    <option key={w} value={w}>{wilayaLabels[i]}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>{t('productDetail.commune')}</label>
                <select value={form.commune} onChange={updateField('commune')} disabled={!form.wilaya}>
                  <option value="">
                    {form.wilaya ? t('productDetail.communePlaceholder') : t('productDetail.communePlaceholderNoWilaya')}
                  </option>
                  {communeOptions.map((c, i) => (
                    <option key={c} value={c}>{communeLabels[i]}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <span className="field__label" id="delivery-type-label">{t('productDetail.deliveryType')}</span>
                <div className="delivery-options" role="radiogroup" aria-labelledby="delivery-type-label">
                  {[['home', 'deliveryHome'], ['office', 'deliveryOffice']].map(([type, key]) => {
                    const fee = feeFor(type)
                    const anyOffered = !!wilayaRate && (wilayaRate.home != null || wilayaRate.office != null)
                    const unavailable = anyOffered && fee === null
                    const selected = form.deliveryType === type
                    return (
                      <button
                        key={type}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={unavailable}
                        className={`delivery-option ${selected ? 'is-selected' : ''}`}
                        onClick={() => setForm((f) => ({ ...f, deliveryType: type }))}
                      >
                        <span className="delivery-option__name">{t(`productDetail.${key}`)}</span>
                        <span className="delivery-option__fee">
                          {unavailable
                            ? t('productDetail.deliveryUnavailable')
                            : fee === null
                              ? (form.wilaya ? '' : t('productDetail.deliveryPickWilaya'))
                              : fee === 0 ? t('productDetail.summaryFree') : formatPrice(fee, lang)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {product.has_size && (
                <div className="field">
                  <span className="field__label" id="size-label">{t('productDetail.size')}</span>
                  <div className="size-chips" role="radiogroup" aria-labelledby="size-label">
                    {product.sizes.map((sz) => {
                      const sold = soldSizes.includes(sz)
                      return (
                        <button
                          key={sz}
                          type="button"
                          role="radio"
                          aria-checked={form.size === sz}
                          disabled={sold}
                          title={sold ? t('productDetail.sizeSoldOut') : undefined}
                          className={`size-chip ${form.size === sz ? 'is-selected' : ''} ${sold ? 'is-sold' : ''}`}
                          onClick={() => setForm((f) => ({ ...f, size: sz }))}
                        >
                          {sz}
                          {sold && <small className="size-chip__sold">{t('productDetail.sizeSoldOut')}</small>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {delivery !== null && (
                <dl className="order-summary">
                  <div>
                    <dt>{t('productDetail.summaryProduct')}</dt>
                    <dd>{formatPrice(unitPrice, lang)}</dd>
                  </div>
                  <div>
                    <dt>{t('productDetail.summaryDelivery')} · {deliveryLabel}</dt>
                    <dd>{delivery === 0 ? t('productDetail.summaryFree') : formatPrice(delivery, lang)}</dd>
                  </div>
                  <div className="order-summary__total">
                    <dt>{t('productDetail.summaryTotal')}</dt>
                    <dd>{formatPrice(unitPrice + delivery, lang)}</dd>
                  </div>
                </dl>
              )}

              {error && <p className="order-form__error">{error}</p>}

              <button type="submit" className="btn btn-solid" disabled={submitting}>
                {submitting ? t('productDetail.submitting') : t('productDetail.submit')}
              </button>
            </form>
          )}
        </div>
      </div>

      <SupportChat />
    </div>
  )
}
