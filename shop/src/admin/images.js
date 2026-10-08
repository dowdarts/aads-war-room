import { supabase } from './api.js'

const MAX_BYTES = 10 * 1024 * 1024
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp']
export const IMAGE_ACCEPT = ACCEPT.join(',')

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`${file.name} couldn’t be read as an image.`)) }
    img.src = url
  })
}

/** Resizes to max 2000px on the long side and re-encodes as WebP (JPEG fallback). */
export async function compressImage(file, maxSide = 2000) {
  if (!ACCEPT.includes(file.type)) throw new Error(`${file.name}: use JPG, PNG or WebP.`)
  if (file.size > MAX_BYTES) throw new Error(`${file.name}: images must be 10 MB or smaller.`)
  const img = await loadImage(file)
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  canvas.getContext('2d').drawImage(img, 0, 0, w, h)
  const blob = await new Promise(r => canvas.toBlob(r, 'image/webp', 0.86))
  if (blob && blob.type === 'image/webp') return { blob, ext: 'webp', type: 'image/webp' }
  const jpg = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.88))
  return { blob: jpg, ext: 'jpg', type: 'image/jpeg' }
}

/** Compresses + uploads to the public shop-products bucket; returns the public URL. */
export async function uploadProductImage(file, folder, name) {
  const { blob, ext, type } = await compressImage(file)
  const path = `${folder}/${name}-${Date.now().toString(36)}.${ext}`
  const { error } = await supabase.storage.from('shop-products').upload(path, blob, { contentType: type, cacheControl: '31536000', upsert: false })
  if (error) throw new Error(error.message)
  return supabase.storage.from('shop-products').getPublicUrl(path).data.publicUrl
}

/** Deletes an uploaded image if it lives in our bucket (external URLs are left alone). */
export async function removeProductImage(url) {
  const marker = '/storage/v1/object/public/shop-products/'
  const i = url?.indexOf(marker) ?? -1
  if (i < 0) return
  await supabase.storage.from('shop-products').remove([decodeURIComponent(url.slice(i + marker.length))])
}

/**
 * Parses bulk-upload filenames: "<product-slug>-<side>[-n].<ext>" where side is
 * front | back | gallery, or "<product-slug>--<colour>-front.jpg" for a colour variant.
 */
export function parseImageFilename(name, productSlugs) {
  const base = name.toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[\s_]+/g, '-')
  const m = base.match(/^(.*?)(?:--([a-z0-9-]+?))?-(front|back|gallery)(?:-\d+)?$/)
  if (!m) return null
  const [, slug, colour, side] = m
  if (!productSlugs.includes(slug)) return null
  return { slug, colour: colour || null, side }
}
