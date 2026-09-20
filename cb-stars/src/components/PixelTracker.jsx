import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { initPixel, isValidPixelId, trackPixel } from '../lib/pixel.js'

// Loads the Facebook Pixel configured in Admin > Settings and reports a
// PageView on every storefront page. Renders nothing; skipped inside /admin.
export default function PixelTracker() {
  const { pathname } = useLocation()
  const [pixelId, setPixelId] = useState(null)
  const inAdmin = pathname.startsWith('/admin')

  useEffect(() => {
    if (inAdmin || pixelId !== null) return
    let cancelled = false
    supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'fb_pixel_id')
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        const id = (data?.value || '').trim()
        setPixelId(isValidPixelId(id) ? id : '')
      })
    return () => { cancelled = true }
  }, [inAdmin, pixelId])

  useEffect(() => {
    if (inAdmin || !pixelId) return
    initPixel(pixelId)
    trackPixel('PageView')
  }, [pixelId, pathname, inAdmin])

  return null
}
