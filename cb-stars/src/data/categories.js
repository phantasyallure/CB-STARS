// Product categories shared by the admin "add product" form and the
// storefront filter. Keep `id` stable — it is what is stored on the product
// row (products.category). Labels can be edited freely.

export const CATEGORIES = [
  { id: 'jackets', label: { fr: 'Vestes', en: 'Jackets', ar: 'جاكيتات' } },
  { id: 'coats', label: { fr: 'Manteaux', en: 'Coats', ar: 'معاطف' } },
  { id: 'tshirts', label: { fr: 'T-shirts', en: 'T-shirts', ar: 'تيشرتات' } },
  { id: 'shirts', label: { fr: 'Chemises', en: 'Shirts', ar: 'قمصان' } },
  { id: 'sweaters', label: { fr: 'Pulls et sweats', en: 'Sweaters and hoodies', ar: 'كنزات وسترات' } },
  { id: 'pants', label: { fr: 'Pantalons', en: 'Pants', ar: 'سراويل' } },
  { id: 'jeans', label: { fr: 'Jeans', en: 'Jeans', ar: 'جينز' } },
  { id: 'dresses', label: { fr: 'Robes', en: 'Dresses', ar: 'فساتين' } },
  { id: 'skirts', label: { fr: 'Jupes', en: 'Skirts', ar: 'تنانير' } },
  { id: 'sets', label: { fr: 'Ensembles', en: 'Sets', ar: 'أطقم' } },
  { id: 'shoes', label: { fr: 'Chaussures', en: 'Shoes', ar: 'أحذية' } },
  { id: 'accessories', label: { fr: 'Accessoires', en: 'Accessories', ar: 'إكسسوارات' } },
  { id: 'other', label: { fr: 'Autres', en: 'Other', ar: 'أخرى' } },
]

// Products saved under an old category (e.g. jewellery from the HJZ shop)
// are shown under "Other" until they are edited.
export function normalizeCategory(id) {
  return CATEGORIES.some((c) => c.id === id) ? id : 'other'
}

export function categoryLabel(id, lang) {
  const found = CATEGORIES.find((c) => c.id === normalizeCategory(id))
  return found.label[lang] || found.label.fr
}
