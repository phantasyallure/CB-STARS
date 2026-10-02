// One-time tool: copies every product photo into Cloudflare R2 (smaller, cached for a year)
// and writes a SQL file that points the products at the new photo addresses.
//
// Usage (on your computer, in this folder):
//   npm install
//   npx wrangler login                      # once, opens the browser
//   node migrate.mjs products.json cbstars-images https://img.cbstars.store [folder]
//
//   folder (optional) = a folder with the photos you downloaded from the old Supabase Storage.
//   When given, photos are read from it (matched by file name) instead of being downloaded.
//   Use it when the old project still refuses to serve photos (HTTP 402).
//
//   products.json = result of this query in the OLD Supabase SQL Editor ("Copy as JSON"):
//     select id, images, image_colors from products;
//
// Output: update-products.sql  -> run it in the NEW Supabase SQL Editor, after the products are imported.
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, basename } from 'node:path'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'

const [, , inputFile, bucket, publicBase, localFolder] = process.argv
if (!inputFile || !bucket || !publicBase) {
  console.error('Usage: node migrate.mjs products.json <bucket-name> <public-url> [folder-with-photos]')
  process.exit(1)
}
const base = publicBase.replace(/\/+$/, '')
const products = JSON.parse(readFileSync(inputFile, 'utf8'))
const tmp = mkdtempSync(join(tmpdir(), 'cbphotos-'))
const done = new Map() // old url -> new url (the same photo is never uploaded twice)
const failed = []

// Index of the local folder (all sub-folders), by file name
const local = new Map()
function scan(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) scan(full)
    else local.set(name.toLowerCase(), full)
  }
}
if (localFolder) {
  if (!existsSync(localFolder)) { console.error(`Folder not found: ${localFolder}`); process.exit(1) }
  scan(localFolder)
  console.log(`Found ${local.size} file(s) in ${localFolder}`)
}

const q = (v) => `'${String(v).replace(/'/g, "''")}'`

async function migrate(url) {
  if (done.has(url)) return done.get(url)
  try {
    let input
    if (localFolder) {
      const name = decodeURIComponent(basename(new URL(url).pathname)).toLowerCase()
      const file = local.get(name)
      if (!file) throw new Error(`not found in the folder: ${name}`)
      input = readFileSync(file)
    } else {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`download failed (HTTP ${res.status})`)
      input = Buffer.from(await res.arrayBuffer())
    }
    const out = await sharp(input)
      .rotate()                                       // respect phone orientation
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer()
    const key = `${randomUUID()}.webp`
    const file = join(tmp, key)
    writeFileSync(file, out)
    execFileSync(
      'npx',
      ['wrangler', 'r2', 'object', 'put', `${bucket}/${key}`, `--file=${file}`,
       '--content-type=image/webp', '--cache-control=public, max-age=31536000, immutable', '--remote'],
      { stdio: 'pipe', shell: process.platform === 'win32' }
    )
    const next = `${base}/${key}`
    done.set(url, next)
    console.log(`✓ ${(input.length / 1024).toFixed(0)} KB -> ${(out.length / 1024).toFixed(0)} KB  ${next}`)
    return next
  } catch (err) {
    failed.push({ url, reason: err.message })
    console.error(`✗ ${url}\n  ${err.message}`)
    return null
  }
}

const sql = ['-- Run in the NEW Supabase project, after the products table has been imported.', 'begin;']
for (const p of products) {
  const images = []
  const colors = {}
  for (const old of p.images || []) {
    const next = await migrate(old)
    if (!next) { images.push(old); continue }            // keep the old link if this photo failed
    images.push(next)
    if (p.image_colors?.[old]) colors[next] = p.image_colors[old]  // colour tags follow the photo
  }
  // Colour tags of photos that failed keep their old key
  for (const [old, hex] of Object.entries(p.image_colors || {})) if (!done.has(old)) colors[old] = hex
  sql.push(
    `update products set images = array[${images.map(q).join(', ')}]::text[], image_colors = ${q(JSON.stringify(colors))}::jsonb where id = ${q(p.id)};`
  )
}
sql.push('commit;')
writeFileSync('update-products.sql', sql.join('\n') + '\n')
rmSync(tmp, { recursive: true, force: true })

console.log(`\nDone: ${done.size} photo(s) copied, ${failed.length} failed.`)
if (failed.length) console.log('Failed photos keep their old link. Re-upload them from the admin.')
console.log('Now run update-products.sql in the new Supabase SQL Editor.')
