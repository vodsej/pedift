// Renames the Vite output (dist/index.html) to the shipped artifact name and
// removes any stray emitted asset files so the build output contains only the
// allowed artifacts (pedift.html and/or pedift-ocr.html).
//
// Usage: node scripts/postbuild.mjs lean | ocr
import { readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

const edition = process.argv[2]
if (edition !== 'lean' && edition !== 'ocr') {
  console.error('postbuild: expected argument "lean" or "ocr"')
  process.exit(1)
}

const dist = 'dist'
const src = join(dist, 'index.html')
const dest = join(dist, edition === 'ocr' ? 'pedift-ocr.html' : 'pedift.html')

renameSync(src, dest)

// vite-plugin-singlefile inlines everything, but defensively drop anything that
// isn't one of the two allowed artifacts (e.g. empty asset dirs, .vite cache).
const ALLOWED = new Set(['pedift.html', 'pedift-ocr.html'])
for (const entry of readdirSync(dist)) {
  if (ALLOWED.has(entry)) continue
  const p = join(dist, entry)
  rmSync(p, { recursive: true, force: true })
}

const bytes = statSync(dest).size
console.log(`postbuild: artifact ${dest} (${(bytes / 1024 / 1024).toFixed(2)} MB)`)
