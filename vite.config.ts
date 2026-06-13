import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

// App version is baked in at build time (no runtime fetch — single-file/offline).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// pedift ships as ONE self-contained pedift.html that works offline from file://.
//
// The hard problem is pdf.js's Web Worker. We import it with `?worker&inline`
// (see src/render/pdfjs.ts), which base64-embeds the worker into the main bundle
// and constructs it via a blob: URL with a data: URL fallback — the fallback is
// what makes it work from file:// (blob:null is blocked there).
//
// Requirements that make the single-file/offline build correct:
// - base: './'                    → relative asset URLs, never /absolute (file:// breaks on absolute)
// - inlineDynamicImports: true    → no async chunks fetched at runtime (fetch fails on file://)
// - cssCodeSplit: false           → one CSS chunk, inlinable
// - assetsInlineLimit: () => true → inline every asset (fonts/icons/images) regardless of size
// - worker.format: 'es'           → ?worker&inline encodes ES-module workers correctly
//
// Two-edition build:
// - PEDIFT_OCR=1 → build:ocr produces dist/pedift-ocr.html (~8-9 MB, OCR assets inlined)
// - default      → build produces dist/pedift.html (~2.4 MB, lean, no OCR bytes)
// - @ocr/assets alias → real module (OCR) or stub-that-throws (lean); this is what keeps
//   the multi-MB base64 out of the lean bundle's module graph.
// - build.emptyOutDir: false → build:all keeps both editions; postbuild.mjs handles cleanup.
const isOcr = !!process.env.PEDIFT_OCR

// tesseract-wasm's bundled Emscripten glue references its wasm via
// `new URL('./tesseract-core.wasm', import.meta.url)` as a fallback. With
// assetsInlineLimit:()=>true, Vite inlines that as a ~2.3 MB (uncompressed)
// `data:application/wasm;base64,…` URL. That fallback is DEAD: we always pass
// `wasmBinary` (decoded from the gzipped @ocr/assets copy), and Emscripten skips
// the data-URL path when wasmBinary is set. Empty the dead URL so the OCR edition
// doesn't ship a second copy of the wasm. (OCR build only.)
const dropDeadTesseractWasm = {
  name: 'pedift:drop-dead-tesseract-wasm',
  apply: 'build' as const,
  enforce: 'post' as const,
  renderChunk(code: string) {
    const re = /data:application\/wasm;base64,[A-Za-z0-9+/=]+/g
    return re.test(code) ? code.replace(re, 'data:application/wasm;base64,') : null
  },
}

export default defineConfig({
  base: './',
  plugins: [
    preact(),
    viteSingleFile({ removeViteModuleLoader: true }),
    ...(isOcr ? [dropDeadTesseractWasm] : []),
  ],
  define: {
    __OCR__: JSON.stringify(isOcr),
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@ocr/assets': isOcr
        ? fileURLToPath(new URL('./src/ocr/assets.ts', import.meta.url))
        : fileURLToPath(new URL('./src/ocr/assets.stub.ts', import.meta.url)),
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: () => true,
    cssCodeSplit: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 8000,
    emptyOutDir: false,
  },
})
