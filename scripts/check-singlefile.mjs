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

// Well-known XML namespace URIs are identifiers, never fetched — allowlist them.
const NS_ALLOWLIST = [
  'http://www.w3.org/2000/svg',
  'http://www.w3.org/1998/Math/MathML',
  'http://www.w3.org/1999/xhtml',
  'http://www.w3.org/1999/xlink',
  'http://www.w3.org/XML/1998/namespace',
  'http://www.w3.org/2000/xmlns/',
  // PDF/XMP metadata namespaces that may appear in embedded sample data
  'http://ns.adobe.com/',
  'http://purl.org/dc/',
]
const isAllowed = (u) => NS_ALLOWLIST.some((ns) => u.startsWith(ns))

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
