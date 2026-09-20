import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase, PRODUCT_IMAGES_BUCKET } from '../../lib/supabaseClient'
import { apiFetch } from '../../lib/api.js'
import { fileToBase64, base64ToFile, prepareForUpload } from '../../lib/image.js'
import Modal from '../../components/Modal.jsx'
import { IconWand, IconUndo, IconX, IconPlus, IconImage } from '../../components/AdminIcons.jsx'
import { CATEGORIES } from '../../data/categories.js'
import { COLOR_PRESETS, colorName, normalizeHex } from '../../data/colors.js'
import { CLOTHING_SIZES, SHOE_SIZES } from '../../data/sizes.js'
import { useLanguage } from '../../i18n/LanguageContext.jsx'

const MAX_PHOTOS = 5

let uid = 0
const nextId = () => `p${++uid}`

function toPhotoItems(images = [], imageColors = {}) {
  return images.map((url) => ({
    id: nextId(), kind: 'existing', url, file: null,
    color: normalizeHex(imageColors?.[url]) || '', // '' = shared by every colour
  }))
}

// Add / edit product dialog. `product` is null when adding.
export default function ProductForm({ product, onClose, onSaved, notify }) {
  const { lang, tx } = useLanguage()
  const editing = !!product
  const [form, setForm] = useState({
    name: product?.name || '',
    price: product ? String(Number(product.price)) : '',
    category: product?.category && CATEGORIES.some((c) => c.id === product.category) ? product.category : 'tshirts',
    stock: product ? String(product.stock ?? 0) : '',
    description: product?.description || '',
  })
  // Stock tracking is optional: off = no quantity, never "sold out", no alerts.
  const [trackStock, setTrackStock] = useState(product ? product.track_stock !== false : true)
  const [colors, setColors] = useState((product?.colors || []).map(normalizeHex).filter(Boolean))
  const [hasSize, setHasSize] = useState(!!product?.has_size)
  const [sizes, setSizes] = useState(product?.sizes || [])
  const [customSize, setCustomSize] = useState('')
  const [photos, setPhotos] = useState(() => toPhotoItems(product?.images, product?.image_colors))
  const [customColor, setCustomColor] = useState('#6e1423')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)
  const photosRef = useRef(photos)
  photosRef.current = photos

  // Free object URLs when the dialog closes.
  useEffect(() => () => {
    photosRef.current.forEach((p) => {
      if (p.kind === 'new') URL.revokeObjectURL(p.url)
      if (p.original?.kind === 'new') URL.revokeObjectURL(p.original.url)
    })
  }, [])

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  /* ---------- colours ---------- */
  const toggleColor = (hex) =>
    setColors((list) => (list.includes(hex) ? list.filter((c) => c !== hex) : [...list, hex]))
  const addCustomColor = () => {
    const hex = normalizeHex(customColor)
    if (hex && !colors.includes(hex)) setColors((list) => [...list, hex])
  }

  /* ---------- sizes ---------- */
  const toggleSize = (s) => setSizes((list) => (list.includes(s) ? list.filter((x) => x !== s) : [...list, s]))
  const addCustomSizes = () => {
    const parts = customSize.split(',').map((s) => s.trim()).filter(Boolean)
    if (parts.length) setSizes((list) => [...new Set([...list, ...parts])])
    setCustomSize('')
  }
  const sizeOptions = useMemo(
    () => [...new Set([...(form.category === 'shoes' ? SHOE_SIZES : CLOTHING_SIZES), ...sizes])],
    [form.category, sizes]
  )

  /* ---------- photos ---------- */
  const addFiles = (e) => {
    const chosen = Array.from(e.target.files || [])
    e.target.value = ''
    setPhotos((list) => {
      const room = MAX_PHOTOS - list.length
      const added = chosen.slice(0, Math.max(0, room)).map((file) => ({
        id: nextId(), kind: 'new', file, url: URL.createObjectURL(file), color: '',
      }))
      return [...list, ...added]
    })
  }

  const removePhoto = (id) =>
    setPhotos((list) => {
      const gone = list.find((p) => p.id === id)
      if (gone?.kind === 'new') URL.revokeObjectURL(gone.url)
      return list.filter((p) => p.id !== id)
    })

  const patchPhoto = (id, patch) =>
    setPhotos((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)))

  const failureText = (err) => {
    if (err.code === 'no_keys') {
      return tx(
        "Aucune clé IA configurée. Ajoutez-en une dans Réglages > Suppression d'arrière-plan.",
        'No AI key configured. Add one in Settings > Background removal.'
      )
    }
    if (err.code === 'API_UNAVAILABLE') {
      return tx(
        "Les fonctions serveur ne répondent pas (déployez sur Cloudflare Pages ou lancez « npm run pages:dev »).",
        'Server functions are not responding (deploy to Cloudflare Pages or run "npm run pages:dev").'
      )
    }
    if (err.code === 'all_failed') {
      const reasons = {
        limit: tx('limite atteinte', 'limit reached'),
        invalid_key: tx('clé invalide', 'invalid key'),
        timeout: tx('trop long', 'timed out'),
        error: tx('erreur', 'error'),
      }
      const detail = (err.data?.tried || []).map((t) => `${t.label}: ${reasons[t.reason] || reasons.error}`).join(' → ')
      return tx('Aucun service IA n’a pu traiter la photo. ', 'No AI service could process this photo. ') + detail
    }
    if (err.status === 401 || err.status === 403) return tx('Session expirée ou accès refusé.', 'Session expired or access denied.')
    if (err.status === 413) return tx('Photo trop lourde.', 'Photo too large.')
    return err.message
  }

  const removeBackground = async (photo) => {
    patchPhoto(photo.id, { ai: 'working', aiMessage: '' })
    try {
      let file = photo.file
      if (!file) {
        const blob = await (await fetch(photo.url)).blob()
        file = new File([blob], 'photo.jpg', { type: blob.type || 'image/jpeg' })
      }
      const { b64, mime } = await fileToBase64(file)
      const result = await apiFetch('remove-bg', { method: 'POST', body: { image: b64, mime } })
      const out = base64ToFile(result.image, result.mime, 'product-cutout')
      setPhotos((list) =>
        list.map((p) =>
          p.id === photo.id
            ? {
                ...p,
                kind: 'new',
                file: out,
                url: URL.createObjectURL(out),
                ai: 'done',
                aiMessage: result.providerLabel,
                original: p.original || { kind: p.kind, file: p.file, url: p.url },
              }
            : p
        )
      )
    } catch (err) {
      patchPhoto(photo.id, { ai: 'error', aiMessage: failureText(err) })
    }
  }

  const undoAi = (photo) => {
    if (!photo.original) return
    if (photo.kind === 'new') URL.revokeObjectURL(photo.url)
    patchPhoto(photo.id, { ...photo.original, original: null, ai: null, aiMessage: '' })
  }

  /* ---------- save ---------- */
  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim() || form.price === '') {
      setError(tx('Le nom et le prix sont obligatoires.', 'Name and price are required.'))
      return
    }
    if (hasSize && sizes.length === 0) {
      setError(tx('Choisissez au moins une taille, ou désactivez les tailles.', 'Pick at least one size, or turn sizes off.'))
      return
    }

    setSaving(true)
    try {
      const urls = []
      const imageColors = {}
      for (const p of photos) {
        if (p.kind === 'existing') {
          urls.push(p.url)
          if (p.color && colors.includes(p.color)) imageColors[p.url] = p.color
          continue
        }
        const prepared = await prepareForUpload(p.file)
        const safeName = (prepared.name || 'photo').replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${crypto.randomUUID()}-${safeName}`
        const { error: upErr } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, prepared, { contentType: prepared.type })
        if (upErr) throw upErr
        const publicUrl = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl
        urls.push(publicUrl)
        if (p.color && colors.includes(p.color)) imageColors[publicUrl] = p.color
      }

      const row = {
        name: form.name.trim(),
        price: Number(form.price),
        category: form.category,
        has_size: hasSize,
        sizes: hasSize ? sizes : [],
        colors,
        images: urls,
        track_stock: trackStock,
        // Keep the last quantity when tracking is off, so switching it back on restores it.
        stock: Math.max(0, parseInt(form.stock, 10) || 0),
        description: form.description.trim(),
      }
      // Only send the colour tags when they are used (or being cleared), so nothing
      // breaks on a database that has not been given the image_colors column yet.
      const hadTags = Object.keys(product?.image_colors || {}).length > 0
      if (Object.keys(imageColors).length > 0 || hadTags) row.image_colors = imageColors
      const { error: dbErr } = editing
        ? await supabase.from('products').update(row).eq('id', product.id)
        : await supabase.from('products').insert(row)
      if (dbErr) throw dbErr

      notify(editing ? tx('Produit mis à jour.', 'Product updated.') : tx('Produit ajouté.', 'Product added.'))
      onSaved()
    } catch (err) {
      setError(err.message || tx('Une erreur est survenue.', 'Something went wrong.'))
      setSaving(false)
    }
  }

  const footer = (
    <>
      <button type="button" className="adm-btn" onClick={onClose} disabled={saving}>{tx('Annuler', 'Cancel')}</button>
      <button type="submit" form="product-form" className="adm-btn adm-btn--solid" disabled={saving}>
        {saving ? tx('Enregistrement…', 'Saving…') : editing ? tx('Enregistrer', 'Save changes') : tx('Ajouter le produit', 'Add product')}
      </button>
    </>
  )

  return (
    <Modal
      wide
      title={editing ? tx('Modifier le produit', 'Edit product') : tx('Nouveau produit', 'New product')}
      onClose={onClose}
      footer={footer}
      closeLabel={tx('Fermer', 'Close')}
    >
      <form id="product-form" className="pform" onSubmit={submit}>
        {/* Photos */}
        <section className="pform__section">
          <div className="pform__title">
            <h4>{tx('Photos', 'Photos')}</h4>
            <span>{photos.length}/{MAX_PHOTOS}</span>
          </div>
          <div className="pform__photos">
            {photos.map((p, i) => (
              <div key={p.id} className={`pphoto ${p.ai === 'working' ? 'is-working' : ''}`}>
                <div className="pphoto__img">
                  <img src={p.url} alt="" />
                  {i === 0 && <span className="pphoto__cover">{tx('Principale', 'Cover')}</span>}
                  <button type="button" className="pphoto__remove" onClick={() => removePhoto(p.id)} aria-label={tx('Retirer la photo', 'Remove photo')}>
                    <IconX />
                  </button>
                  {p.ai === 'working' && <span className="pphoto__busy">{tx('IA en cours…', 'AI working…')}</span>}
                </div>
                <div className="pphoto__actions">
                  {p.original ? (
                    <button type="button" className="adm-btn adm-btn--small" onClick={() => undoAi(p)}>
                      <IconUndo /> {tx('Annuler l’IA', 'Undo AI')}
                    </button>
                  ) : (
                    <button type="button" className="adm-btn adm-btn--small adm-btn--ai" onClick={() => removeBackground(p)} disabled={p.ai === 'working'}>
                      <IconWand /> {tx('Utiliser l’IA', 'Use AI')}
                    </button>
                  )}
                </div>
                {colors.length > 0 && (
                  <select
                    className="adm-select adm-select--small pphoto__color"
                    value={colors.includes(p.color) ? p.color : ''}
                    onChange={(e) => patchPhoto(p.id, { color: e.target.value })}
                    aria-label={tx('Couleur de cette photo', 'Colour shown in this photo')}
                  >
                    <option value="">{tx('Toutes les couleurs', 'All colours')}</option>
                    {colors.map((hex) => (
                      <option key={hex} value={hex}>{colorName(hex, lang === 'en' ? 'en' : 'fr') || hex}</option>
                    ))}
                  </select>
                )}
                {p.ai === 'done' && <p className="pphoto__note pphoto__note--ok">{tx('Fond retiré avec', 'Background removed with')} {p.aiMessage}</p>}
                {p.ai === 'error' && <p className="pphoto__note pphoto__note--err">{p.aiMessage}</p>}
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button type="button" className="pphoto-add" onClick={() => fileRef.current?.click()}>
                <IconImage />
                <span>{tx('Ajouter des photos', 'Add photos')}</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={addFiles} />
          </div>
          <p className="adm-hint">{tx('« Utiliser l’IA » retire l’arrière-plan de la photo.', '“Use AI” removes the photo’s background.')}</p>
          {colors.length > 0 && photos.length > 0 && (
            <p className="adm-hint">
              {tx(
                'Choisissez la couleur de chaque photo : quand le client clique sur une couleur, la photo change. « Toutes les couleurs » = photo commune.',
                'Pick the colour shown in each photo: when a customer clicks a colour, the photo changes. “All colours” = a shared photo.'
              )}
            </p>
          )}
        </section>

        {/* Basics */}
        <section className="pform__section pform__grid">
          <div className="field pform__wide">
            <label htmlFor="pf-name">{tx('Nom du produit', 'Product name')}</label>
            <input id="pf-name" type="text" value={form.name} onChange={set('name')} autoFocus={!editing} />
          </div>
          <div className="field">
            <label htmlFor="pf-price">{tx('Prix (DA)', 'Price (DA)')}</label>
            <input id="pf-price" type="number" min="0" step="1" inputMode="numeric" value={form.price} onChange={set('price')} />
          </div>
          <div className="field">
            <label htmlFor="pf-cat">{tx('Catégorie', 'Category')}</label>
            <select id="pf-cat" value={form.category} onChange={set('category')}>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{lang === 'en' ? c.label.en : c.label.fr}</option>
              ))}
            </select>
          </div>
          <div className="field pform__wide">
            <label className="adm-switch">
              <input type="checkbox" checked={trackStock} onChange={(e) => setTrackStock(e.target.checked)} />
              <span className="adm-switch__track" aria-hidden="true" />
              <span>
                {tx('Suivre le stock de ce produit', 'Track stock for this product')}
                <small>
                  {trackStock
                    ? tx('Activé : la quantité est suivie et le produit passe « Épuisé » à 0.', 'On: the quantity is tracked and the product shows “Sold out” at 0.')
                    : tx('Désactivé : pas de quantité, jamais « Épuisé », pas d’alerte de stock.', 'Off: no quantity, never “Sold out”, no low-stock alerts.')}
                </small>
              </span>
            </label>
          </div>
          {trackStock && (
            <div className="field">
              <label htmlFor="pf-stock">{tx('Quantité en stock', 'Stock quantity')}</label>
              <input id="pf-stock" type="number" min="0" step="1" inputMode="numeric" placeholder="0" value={form.stock} onChange={set('stock')} />
            </div>
          )}
          <div className="field pform__wide">
            <label htmlFor="pf-desc">{tx('Description', 'Description')}</label>
            <textarea
              id="pf-desc"
              rows={4}
              placeholder={tx('Matière, coupe, conseils d’entretien…', 'Material, fit, care instructions…')}
              value={form.description}
              onChange={set('description')}
            />
          </div>
        </section>

        {/* Colours */}
        <section className="pform__section">
          <div className="pform__title">
            <h4>{tx('Couleurs disponibles', 'Available colours')}</h4>
            <span>{colors.length > 0 ? colors.length : tx('aucune', 'none')}</span>
          </div>
          <div className="swatches" role="group" aria-label={tx('Couleurs', 'Colours')}>
            {COLOR_PRESETS.map((c) => {
              const on = colors.includes(c.hex)
              const name = colorName(c.hex, lang === 'en' ? 'en' : 'fr')
              return (
                <button
                  key={c.hex}
                  type="button"
                  className={`swatch ${on ? 'is-on' : ''}`}
                  aria-pressed={on}
                  title={name}
                  aria-label={name}
                  onClick={() => toggleColor(c.hex)}
                >
                  <span className="color-dot" style={{ '--c': c.hex, '--dot': '28px' }} />
                </button>
              )
            })}
          </div>
          <div className="pform__custom">
            <label className="pform__picker">
              <input type="color" value={customColor} onChange={(e) => setCustomColor(e.target.value)} aria-label={tx('Choisir une couleur', 'Pick a colour')} />
              <span>{tx('Autre couleur', 'Custom colour')}</span>
            </label>
            <button type="button" className="adm-btn adm-btn--small" onClick={addCustomColor}><IconPlus /> {tx('Ajouter', 'Add')}</button>
          </div>
          {colors.length > 0 && (
            <div className="chosen">
              {colors.map((hex) => (
                <button key={hex} type="button" className="chosen__chip" onClick={() => toggleColor(hex)} title={tx('Retirer', 'Remove')}>
                  <span className="color-dot" style={{ '--c': hex }} />
                  {colorName(hex, lang === 'en' ? 'en' : 'fr') || hex}
                  <IconX />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Sizes */}
        <section className="pform__section">
          <label className="adm-switch">
            <input type="checkbox" checked={hasSize} onChange={(e) => setHasSize(e.target.checked)} />
            <span className="adm-switch__track" aria-hidden="true" />
            <span>{tx('Ce produit a des tailles', 'This product has sizes')}</span>
          </label>
          {hasSize && (
            <>
              <div className="chips">
                {sizeOptions.map((s) => (
                  <button key={s} type="button" className={`chip ${sizes.includes(s) ? 'is-on' : ''}`} aria-pressed={sizes.includes(s)} onClick={() => toggleSize(s)}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="pform__custom">
                <input
                  className="pform__size-input"
                  type="text"
                  placeholder={tx('Autre taille, ex. 46, 48', 'Other size, e.g. 46, 48')}
                  value={customSize}
                  onChange={(e) => setCustomSize(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSizes() } }}
                />
                <button type="button" className="adm-btn adm-btn--small" onClick={addCustomSizes}><IconPlus /> {tx('Ajouter', 'Add')}</button>
              </div>
            </>
          )}
        </section>

        {error && <p className="adm-error" role="alert">{error}</p>}
      </form>
    </Modal>
  )
}
