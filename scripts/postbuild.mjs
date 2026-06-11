// Renames the Vite output (dist/index.html) to the shipped artifact name (dist/pedift.html)
// and removes any stray emitted asset files so the build output is exactly one .html file.
import { readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

const dist = 'dist'
const src = join(dist, 'index.html')
const dest = join(dist, 'pedift.html')

renameSync(src, dest)

// vite-plugin-singlefile inlines everything, but defensively drop anything that
// isn't the single artifact (e.g. empty asset dirs, .vite cache).
for (const entry of readdirSync(dist)) {
  if (entry === 'pedift.html') continue
  const p = join(dist, entry)
  rmSync(p, { recursive: true, force: true })
}

const bytes = statSync(dest).size
console.log(`postbuild: artifact dist/pedift.html (${(bytes / 1024 / 1024).toFixed(2)} MB)`)
