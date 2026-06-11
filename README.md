# pedift

**A free, private PDF editor that runs entirely in your browser.** No install, no
server, no uploads. Download one HTML file, double-click it, and edit PDFs fully
offline — your files never leave your device.

## Why

Most "free PDF editors" upload your documents to a server. pedift doesn't. The
whole application ships as a single self-contained `pedift.html` (~2.3 MB) that
works from `file://` with networking disabled. All processing happens locally in
your browser.

## Features

**Landing quick tools** (one-shot jobs, no editor needed)

- **Merge PDFs** — combine several PDFs, drag to reorder
- **Images → PDF** — JPG/PNG → PDF (A4 / Letter / fit-to-image, orientation, margin)
- **Compress** — re-encode embedded images at a chosen quality (honest before/after sizes)
- **Protect / Unprotect** — add or remove a user password

**Workspace — Pages**

- Reorder (drag), rotate, delete, duplicate (per page or multi-select)
- Extract selected pages, split (by ranges or every N), insert pages from another PDF
- Crop (draw a box → set CropBox on one page or all)
- Export pages as PNG/JPG

**Workspace — Annotate**

- Text box, **Replace text** (cover + retype), highlight, pen, shapes
  (rectangle/ellipse/line/arrow), whiteout, insert image, signature (draw or type),
  stamps (✓ ✗ APPROVED DRAFT CONFIDENTIAL, date)
- All overlay objects select / move / resize / delete / undo-redo until saved

**Workspace — Document menu**

- Fill forms (text/checkbox/dropdown), flatten, metadata, watermark, page numbers,
  protect/unprotect, compress

Plus: warm light + dark themes, tooltips, keyboard shortcuts (undo/redo/save/zoom),
drag-and-drop, touch support, and a strict "the loaded original is never mutated"
guarantee — every save produces a new download.

## Develop

```bash
npm install
npm run dev          # Vite dev server
npm run build        # → dist/pedift.html (single self-contained file)
npm test             # unit tests (vitest, Node) against fixture PDFs
npm run test:e2e     # Playwright smoke tests against the BUILT single file
npm run check:singlefile   # asserts one .html, no external network references
npm run fixtures     # regenerate tests/fixtures/*.pdf
```

The build emits exactly one file, `dist/pedift.html`. Open it directly in a
browser (even offline) to use the app.

## Architecture

Four layers with strict boundaries (see `docs/superpowers/`):

- **`src/core/`** — document core (no DOM). Wraps [`@cantoo/pdf-lib`]. Holds the
  editable model + snapshot undo/redo and the rebuild-from-fresh **save pipeline**:
  it replays the current state into a brand-new pdf-lib document, so the loaded
  original is never touched.
- **`src/render/`** — wraps Mozilla **pdf.js** (read-only): page/thumbnail
  canvases, text layer, zoom. The worker is inlined as a `data:` URL so it runs
  from `file://`.
- **`src/overlay/`** — the interactive SVG/DOM editing layer. Overlay objects live
  here (selectable/movable/resizable) and are baked into page content on save.
- **`src/ui/`** — Preact components: landing, workspace, toolbars, dialogs, toasts,
  themes. All user-facing strings are centralized in `src/strings/en.ts`.

**Tech:** Vite + TypeScript + Preact + `vite-plugin-singlefile`, pdf.js, @cantoo/pdf-lib,
vitest, Playwright.

## Privacy & safety

- 100% client-side. No network calls, telemetry, or external fonts/CDNs (enforced
  by `check:singlefile` in the build).
- The original document is never modified in memory; "Discard changes" is always safe.
- Password protection is verified at startup (a runtime capability probe); if a
  browser can't support it, the feature is honestly disabled rather than broken.

## Out of scope

True glyph-level text reflow, OCR, cryptographic signatures (the signature tool is
visual only), any server features, and localization beyond English (strings are
centralized for later).

## License

MIT
