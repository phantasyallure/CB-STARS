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

function toPhotoItems(images = []) {
  return images.map((url) => ({ id: nextId(), kind: 'existing', url, file: null }))
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
  const [photos, setPhotos] = useState(() => toPhotoItems(product?.images))
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
        id: nextId(), kind: 'new', file, url: URL.createObjectURL(file),
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
      for (const p of photos) {
        if (p.kind === 'existing') { urls.push(p.url); continue }
        const prepared = await prepareForUpload(p.file)
        const safeName = (prepared.name || 'photo').replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${crypto.randomUUID()}-${safeName}`
        const { error: upErr } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, prepared, { contentType: prepared.type })
        if (upErr) throw upErr
        urls.push(supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl)
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
                    <button type="button"
