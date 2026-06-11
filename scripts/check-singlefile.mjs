// CI guard: asserts the build output is exactly ONE self-contained pedift.html with
// no external network references (no remote URLs, no leftover module/asset links).
// Run after `npm run build`.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const dist = 'dist'
let failed = false
const fail = (msg) => {
  console.error('FAIL: ' + msg)
  failed = true
}

// 1. Exactly one file, named pedift.html
const entries = readdirSync(dist)
if (entries.length !== 1 || entries[0] !== 'pedift.html') {
  fail(`dist/ must contain exactly one file (pedift.html); found: ${entries.join(', ')}`)
}

const htmlPath = join(dist, 'pedift.html')
const html = readFileSync(htmlPath, 'utf8')
const sizeMB = statSync(htmlPath).size / 1024 / 1024

// 2. Size sanity (spec target ~4-6 MB, allow headroom)
if (sizeMB > 12) fail(`artifact is ${sizeMB.toFixed(2)} MB, exceeds 12 MB ceiling`)

// 3. No external network references. Strip license/source-map comment URLs first.
// Allowlist: URLs that only appear inside comments (license headers) are fine.
const stripComments = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '') // /* ... */
    .replace(/<!--[\s\S]*?-->/g, '') // <!-- ... -->
    // strip single-line // comments only when they look like license/sourcemap lines
    .replace(/^[ \t]*\/\/[^\n]*$/gm, '')
    .replace(/\/\/# sourceMappingURL=[^\n"']*/g, '')

const code = stripComments(html)

// XML namespace / schema URIs and library placeholder hosts are string constants
// baked into pdf.js and Preact — they are identifiers, never fetched. Allowlist by
// host so the guard still catches a real CDN/font/script URL.
const ALLOWED_HOSTS = [
  'www.w3.org', // SVG / MathML / XHTML / XSL / xmldsig namespaces
  'www.xfa.org', // XFA form schemas inside pdf.js
  'ns.adobe.com', // XDP / XMP / XFDF namespaces inside pdf.js
  'purl.org', // Dublin Core metadata namespace
  'example.com', // pdf.js URL-handling placeholders
  'foo.bar', // pdf.js placeholders
]
const isAllowed = (u) => {
  if (u.includes('${')) return true // template-literal artifacts (e.g. http://${e})
  const m = u.match(/^(?:https?:|wss?:)\/\/([^/]+)/)
  const host = m ? m[1] : ''
  return ALLOWED_HOSTS.some((h) => host === h || host.endsWith('.' + h) || host === 'www.' + h)
}

// remote protocol references that would require the network
const remote = (code.match(/(https?:|wss?:)\/\/[^\s"'`)]+/g) || []).filter((u) => !isAllowed(u))
// data:, blob:, file: are fine offline. Filter those out (already excluded by regex).
if (remote.length) {
  // de-dupe for readable output
  const uniq = [...new Set(remote)].slice(0, 20)
  fail(`found ${remote.length} remote URL reference(s) in artifact:\n  ` + uniq.join('\n  '))
}

// 4. No leftover external module/script/link tags pointing at separate files
const externalScript = html.match(/<script[^>]+src=["'](?!data:)[^"']+["']/g) || []
if (externalScript.length) fail(`found external <script src>: ${externalScript.join(', ')}`)
const externalLink =
  html.match(/<link[^>]+href=["'](?!data:)[^"']+\.(css|js|woff2?|png|svg)["']/g) || []
if (externalLink.length) fail(`found external <link href>: ${externalLink.join(', ')}`)

if (failed) {
  console.error('\ncheck:singlefile FAILED')
  process.exit(1)
}
console.log(`check:singlefile OK — dist/pedift.html, ${sizeMB.toFixed(2)} MB, no external refs`)
