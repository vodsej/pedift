import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// pedift ships as ONE self-contained pedift.html that works offline from file://.
// - base './' so any (inlined) asset refs are relative, not root-absolute.
// - viteSingleFile inlines all JS/CSS into the single HTML.
// - assetsInlineLimit huge so fonts/icons/images get inlined too.
export default defineConfig({
  base: './',
  plugins: [preact(), viteSingleFile()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 100 * 1024 * 1024,
    cssCodeSplit: false,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        // single bundle; named file so the artifact is predictable
        entryFileNames: 'pedift.js',
      },
    },
  },
})
