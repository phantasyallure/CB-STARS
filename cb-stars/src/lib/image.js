// Shrinks a photo before it is sent to the AI function (keeps the upload
// small and fast) and converts results back into File objects.

export async function fileToBase64(file, maxDim = 1600, quality = 0.9) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff' // flatten transparency so JPEG doesn't turn black
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  return { b64: dataUrl.split(',')[1], mime: 'image/jpeg' }
}

export function base64ToFile(b64, mime, baseName = 'photo') {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'
  return new File([bytes], `${baseName}.${ext}`, { type: mime })
}
// Shrinks + compresses a photo before it's stored in Supabase — visitors
// download this file on every product-grid view, so an unresized camera
// photo (often several MB) makes the whole storefront feel slow. WebP is
// used so transparency survives (needed for AI-cutout photos), while still
// compressing far better than the original JPEG/PNG straight off a phone.
export async function prepareForUpload(file, maxDim = 1600, quality = 0.85) {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
    if (!blob) return file
    const baseName = (file.name || 'photo').replace(/\.[^.]+$/, '')
    return new File([blob], `${baseName}.webp`, { type: 'image/webp' })
  } catch {
    return file
  }
}
