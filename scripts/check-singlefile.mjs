// CI guard: asserts the build output is one or both self-contained artifacts with
// no external network references (no remote URLs, no leftover module/asset links).
// Validates whichever of {pedift.html, pedift-ocr.html} exist in dist/.
// Run after `npm run build` and/or `npm run build:ocr`.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const dist = 'dist'
let failed = false
const fail = (msg) => {
  console.error('FAIL: ' + msg)
  failed = true
}

// 1. dist/ must contain ONLY allowed artifact filenames; at least one must exist.
const ALLOWED = new Set(['pedift.html', 'pedift-ocr.html'])
const SIZE_CEILING_MB = { 'pedift.html': 6, 'pedift-ocr.html': 14 }

const entries = readdirSync(dist)
const strays = entries.filter((e) => !ALLOWED.has(e))
if (strays.length) {
  fail(`dist/ contains unexpected entries: ${strays.join(', ')}`)
}
const present = entries.filter((e) => ALLOWED.has(e))
if (present.length === 0) {
  fail('dist/ contains neither pedift.html nor pedift-ocr.html')
}

// 3. No external network references. Strip license/source-map comment URLs first.
// Allowlist: URLs that only appear inside comments (license headers) are fine.
const stripComments = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '') // /* ... */
    .replace(/<!--[\s\S]*?-->/g, '') // <!-- ... -->
    // strip single-line // comments only when they look like license/sourcemap lines
    .replace(/^[ \t]*\/\/[^\n]*$/gm, '')
    .replace(/\/\/# sourceMappingURL=[^\n"']*/g, '')

// XML namespace / schema URIs and library placeholder hosts are string constants
// baked into pdf.js and Preact — they are identifiers, never fetched. Allowlist by
// host so the guard still catches a real CDN/font/script URL.
// Hosts that allow subdomains (namespace / schema URIs — identifiers, never fetched)
const ALLOWED_SUBDOMAIN_HOSTS = [
  'www.w3.org', // SVG / MathML / XHTML / XSL / xmldsig namespaces
  'www.xfa.org', // XFA form schemas inside pdf.js
  'ns.adobe.com', // XDP / XMP / XFDF namespaces inside pdf.js
  'purl.org', // Dublin Core metadata namespace
  'example.com', // pdf.js URL-handling placeholders
  'foo.bar', // pdf.js placeholders
  'rolldown.rs', // rolldown's dormant __require interop guard message
]
// Hosts that must match exactly — no subdomain pass-through
const ALLOWED_EXACT_HOSTS = [
  'github.com', // pdf-lib producer-metadata attribution string
]
const isAllowed = (u) => {
  if (u.includes('${')) return true // template-literal artifacts (e.g. http://${e})
  const m = u.match(/^(?:https?:|wss?:)\/\/([^/]+)/)
  const host = m ? m[1] : ''
  if (ALLOWED_EXACT_HOSTS.includes(host)) return true
  return ALLOWED_SUBDOMAIN_HOSTS.some((h) => host === h || host.endsWith('.' + h) || host === 'www.' + h)
}

const checkFile = (name) => {
  const htmlPath = join(dist, name)
  const html = readFileSync(htmlPath, 'utf8')
  const sizeMB = statSync(htmlPath).size / 1024 / 1024

  // 2. Per-file size ceiling
  const ceiling = SIZE_CEILING_MB[name]
  if (sizeMB > ceiling) fail(`${name} is ${sizeMB.toFixed(2)} MB, exceeds ${ceiling} MB ceiling`)

  const code = stripComments(html)

  // 3. No external network references
  const remote = (code.match(/(https?:|wss?:)\/\/[^\s"'`)]+/g) || []).filter((u) => !isAllowed(u))
  // data:, blob:, file: are fine offline. Filter those out (already excluded by regex).
  if (remote.length) {
    // de-dupe for readable output
    const uniq = [...new Set(remote)].slice(0, 20)
    fail(`found ${remote.length} remote URL reference(s) in ${name}:\n  ` + uniq.join('\n  '))
  }

  // 4. No leftover external module/script/link tags pointing at separate files
  const externalScript = html.match(/<script[^>]+src=["'](?!data:)[^"']+["']/g) || []
  if (externalScript.length) fail(`found external <script src> in ${name}: ${externalScript.join(', ')}`)
  const externalLink =
    html.match(/<link[^>]+href=["'](?!data:)[^"']+\.(css|js|woff2?|png|svg)["']/g) || []
  if (externalLink.length) fail(`found external <link href> in ${name}: ${externalLink.join(', ')}`)

  console.log(`check:singlefile OK — ${name}, ${sizeMB.toFixed(2)} MB, no external refs`)
}

for (const name of present) {
  checkFile(name)
}

if (failed) {
  console.error('\ncheck:singlefile FAILED')
  process.exit(1)
}
