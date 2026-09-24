import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { initPixels, trackPixel } from '../lib/pixel.js'

// Loads the Facebook and TikTok pixels configured in Admin > Settings and reports a
// PageView on every storefront page. Renders nothing; skipped inside /admin.
export default function PixelTracker() {
  const { pathname } = useLocation()
  const [ids, setIds] = useState(null) // null = not fetched yet, { fb, tiktok } once known
  const inAdmin = pathname.startsWith('/admin')

  useEffect(() => {
    if (inAdmin || ids !== null) return
    let cancelled = false
    supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['fb_pixel_id', 'tiktok_pixel_id'])
      .then(({ data }) => {
        if (cancelled) return
        const map = Object.fromEntries((data || []).map((row) => [row.key, (row.value || '').trim()]))
        setIds({ fb: map.fb_pixel_id || '', tiktok: map.tiktok_pixel_id || '' })
      })
    return () => { cancelled = true }
  }, [inAdmin, ids])

  useEffect(() => {
    if (inAdmin || !ids) return
    // On the first run PageView is queued and sent right after the pixels load.
    trackPixel('PageView')
    initPixels(ids)
  }, [ids, pathname, inAdmin])

  return null
}
