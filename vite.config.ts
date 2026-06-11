import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

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
export default defineConfig({
  base: './',
  plugins: [preact(), viteSingleFile({ removeViteModuleLoader: true })],
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: () => true,
    cssCodeSplit: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 8000,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})
