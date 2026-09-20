// Colour palette offered when adding a product. Products store the hex code
// (products.colors), the storefront looks the name up here in the visitor's language.
// Owners can also pick any custom colour; those show as a dot without a name.

export const COLOR_PRESETS = [
  { hex: '#111111', name: { fr: 'Noir', en: 'Black', ar: 'أسود' } },
  { hex: '#ffffff', name: { fr: 'Blanc', en: 'White', ar: 'أبيض' } },
  { hex: '#f3ecdd', name: { fr: 'Ivoire', en: 'Ivory', ar: 'عاجي' } },
  { hex: '#d8c4a0', name: { fr: 'Beige', en: 'Beige', ar: 'بيج' } },
  { hex: '#8b5a2b', name: { fr: 'Marron', en: 'Brown', ar: 'بني' } },
  { hex: '#8a8d91', name: { fr: 'Gris', en: 'Gray', ar: 'رمادي' } },
  { hex: '#2e3238', name: { fr: 'Anthracite', en: 'Charcoal', ar: 'فحمي' } },
  { hex: '#1f2a44', name: { fr: 'Bleu marine', en: 'Navy', ar: 'كحلي' } },
  { hex: '#3b6fb6', name: { fr: 'Bleu', en: 'Blue', ar: 'أزرق' } },
  { hex: '#9fcbe8', name: { fr: 'Bleu ciel', en: 'Sky blue', ar: 'سماوي' } },
  { hex: '#2f6b4f', name: { fr: 'Vert', en: 'Green', ar: 'أخضر' } },
  { hex: '#5b6236', name: { fr: 'Kaki', en: 'Khaki', ar: 'كاكي' } },
  { hex: '#e2c044', name: { fr: 'Jaune', en: 'Yellow', ar: 'أصفر' } },
  { hex: '#e27d2d', name: { fr: 'Orange', en: 'Orange', ar: 'برتقالي' } },
  { hex: '#c0392b', name: { fr: 'Rouge', en: 'Red', ar: 'أحمر' } },
  { hex: '#6e1423', name: { fr: 'Bordeaux', en: 'Burgundy', ar: 'عنابي' } },
  { hex: '#e8a0b4', name: { fr: 'Rose', en: 'Pink', ar: 'وردي' } },
  { hex: '#7d4a8c', name: { fr: 'Violet', en: 'Purple', ar: 'بنفسجي' } },
  { hex: '#c9a24d', name: { fr: 'Doré', en: 'Gold', ar: 'ذهبي' } },
  { hex: '#c4c6c9', name: { fr: 'Argenté', en: 'Silver', ar: 'فضي' } },
]

export function normalizeHex(hex) {
  const h = String(hex || '').trim().toLowerCase()
  return /^#[0-9a-f]{6}$/.test(h) ? h : null
}

export function colorName(hex, lang) {
  const found = COLOR_PRESETS.find((c) => c.hex === normalizeHex(hex))
  return found ? found.name[lang] || found.name.fr : ''
}
