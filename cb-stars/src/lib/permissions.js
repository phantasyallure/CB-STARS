// What each permission unlocks in the admin. Keep ids in sync with
// api/_lib/permissions.js and the has_perm(...) checks in supabase/schema.sql.
export const PERMISSIONS = [
  {
    id: 'products',
    fr: { label: 'Produits', hint: 'Produits et prix de livraison par wilaya' },
    en: { label: 'Products', hint: 'Products and delivery prices per wilaya' },
  },
  {
    id: 'stock',
    fr: { label: 'Stock', hint: 'Voir et mettre à jour les quantités' },
    en: { label: 'Stock', hint: 'See and update quantities' },
  },
  {
    id: 'orders',
    fr: { label: 'Commandes', hint: 'Voir les commandes et changer leur statut' },
    en: { label: 'Orders', hint: 'See orders and change their status' },
  },
  {
    id: 'analytics',
    fr: { label: 'Statistiques', hint: 'Voir les graphiques et les chiffres de vente' },
    en: { label: 'Analytics', hint: 'See charts and sales figures' },
  },
  {
    id: 'chat',
    fr: { label: 'Messages', hint: 'Répondre aux clients dans le chat' },
    en: { label: 'Messages', hint: 'Reply to customers in the chat' },
  },
  {
    id: 'settings',
    fr: { label: 'Réglages', hint: 'Pixel Facebook et clés API de l’IA' },
    en: { label: 'Settings', hint: 'Facebook Pixel and AI API keys' },
  },
]

export const ROLE_PRESETS = [
  {
    id: 'manager',
    fr: 'Gérant',
    en: 'Manager',
    permissions: ['products', 'stock', 'orders', 'analytics', 'chat'],
  },
  {
    id: 'orders',
    fr: 'Confirmation des commandes',
    en: 'Order handler',
    permissions: ['orders', 'chat'],
  },
  {
    id: 'catalog',
    fr: 'Catalogue et stock',
    en: 'Catalogue and stock',
    permissions: ['products', 'stock'],
  },
]

export function can(profile, permission) {
  if (!profile) return false
  return profile.role === 'owner' || (profile.permissions || []).includes(permission)
}
