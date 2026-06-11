# pedift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build pedift — a free, private, fully-offline PDF editor that ships as one self-contained `pedift.html` openable from `file://`.

**Architecture:** Four layers with strict boundaries — Document core (`src/core`, no DOM, wraps `@cantoo/pdf-lib`, owns an operations/state model + save pipeline), Renderer (`src/render`, wraps pdf.js, read-only canvases + text layer), Overlay editor (`src/overlay`, interactive objects baked on save), UI shell (`src/ui`, Preact). The original bytes are immutable; every save rebuilds a fresh pdf-lib document from a derived state and downloads it.

**Tech stack (versions verified 2026-06-11):** Vite 8 + TypeScript 6 + Preact 10 + vite-plugin-singlefile 2.3.3 · pdfjs-dist 6.0.227 · @cantoo/pdf-lib 2.7.1 · vitest 4.1.8 · @playwright/test 1.60.0 · serve 14.2.6.

---

## Key technical decisions (from stack research)

**Single-file offline build (verified working):**
- `base: './'`, `viteSingleFile({ removeViteModuleLoader: true })`, `build.cssCodeSplit:false`, `build.assetsInlineLimit:() => true`, `rollupOptions.output.inlineDynamicImports:true`, `worker.format:'es'`.
- pdf.js worker: `import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline'` then `GlobalWorkerOptions.workerPort = new PdfWorker()`. `?worker&inline` base64-embeds it and constructs via blob: URL with a **data: URL fallback** — the fallback is what makes it work from `file://`. Plain `?worker`/`?url` will NOT be inlined and break offline.
- CI guard `scripts/check-singlefile.mjs`: exactly one `dist/pedift.html`, no remote URLs (allowlist W3C XML namespace URIs + in-comment license links).

**@cantoo/pdf-lib:**
- Decrypt: `PDFDocument.load(bytes, { password })`. `ignoreEncryption:true` skips decryption and yields a broken doc — don't use it for real opens.
- Encrypt: `doc.encrypt({ userPassword, ownerPassword, permissions })` **before** `save()`.
- `copyPages()` does NOT carry AcroForm fields/bookmarks. The rebuild-from-fresh save pipeline therefore flattens forms (bake appearance into page content) whenever structural page edits or overlays exist.
- Rotation: `page.setRotation(degrees(n))`, `page.getRotation().angle`. Crop: `page.setCropBox(x, y, w, h)`. Text sizing: `font.widthOfTextAtSize`, `font.heightAtSize`.
- Standard fonts are WinAnsi only (Latin). English-only scope — acceptable.

**pdf.js (read-only):**
- `getDocument({ data: Uint8Array })`; `loadingTask.onPassword` + `PasswordResponses`; errors `PasswordException` / `InvalidPDFException`.
- Render with DPR: `scale = cssWidth / baseWidth * devicePixelRatio`; cancel previous `RenderTask` on zoom; `page.cleanup()` to free memory.
- Text layer: `new TextLayer({ textContentSource, container, viewport }).render()`; container needs `position:absolute` + `--scale-factor`. Map text item to canvas px via `Util.transform(viewport.transform, item.transform)`.

---

## The state / operations model (core of the app)

Document state is a plain serializable object derived by reducing an ordered command log. Undo/redo = move a pointer in the log; current state = reduce(commands[0..pointer]). Save replays state into a fresh pdf-lib doc.

```ts
// src/core/types.ts
export type Rotation = 0 | 90 | 180 | 270
export interface CropBox { x: number; y: number; width: number; height: number } // PDF points

export interface PageDescriptor {
  id: string            // stable slot id (nanoid-ish, generated without Math.random in tests)
  sourceId: string      // key into DocState.sources; 'original' for the opened file
  srcIndex: number      // 0-based page index within that source
  rotation: Rotation    // absolute desired rotation (initialised from source page rotation)
  crop: CropBox | null
}

export type OverlayObject =
  | TextObj | PenObj | ShapeObj | HighlightObj | WhiteoutObj
  | ImageObj | SignatureObj | StampObj
// All geometry in PDF points relative to the (unrotated) page, origin bottom-left.

export interface DocState {
  sources: Record<string, SourceRef>     // bytes for original + any imported PDFs/images
  pages: PageDescriptor[]
  overlays: Record<string, OverlayObject[]>   // keyed by PageDescriptor.id
  metadata: Metadata
  pageNumbers: PageNumbersConfig | null
  watermark: WatermarkConfig | null
  formValues: Record<string, string | boolean> // fieldName -> value
  flatten: boolean
  protect: { userPassword?: string; ownerPassword?: string } | null
}
```

**Save pipeline (`src/core/save.ts`):**
1. `out = await PDFDocument.create()`.
2. For each `PageDescriptor`: `copyPages(sourceDoc, [srcIndex])` → `addPage`; `setRotation(degrees(rotation))`; if `crop`, `setCropBox(...)`.
3. Bake overlays for that page (drawText/drawRectangle/drawEllipse/drawLine/drawSvgPath/drawImage).
4. Apply watermark + page numbers passes.
5. Apply metadata.
6. If `formValues`/forms: handled on the source-preserving path (see Task group 4) — fill then flatten.
7. If `protect`: `out.encrypt(...)`.
8. `bytes = await out.save()` → download. Original bytes untouched.

---

## File structure

```
src/
  main.tsx                 app bootstrap + render
  strings/en.ts            ALL UI strings (done)
  core/
    types.ts               state & op types
    ids.ts                 deterministic id generator (counter-based; no Math.random)
    document.ts            EditorDocument: holds original bytes + command log + derived state
    commands.ts            command definitions + reducer (apply each command to DocState)
    history.ts             undo/redo pointer over the command log
    pages.ts               page-list ops (reorder/rotate/delete/duplicate/insert/extract/split)
    save.ts                rebuild-from-fresh save pipeline → Uint8Array
    bake.ts                overlay object → pdf-lib draw calls
    merge.ts               merge PDFs (quick tool)
    imagesToPdf.ts         images → PDF (quick tool)
    compress.ts            re-encode raster images (quick tool + doc menu)
    crypto.ts              protect/unprotect (encrypt/decrypt) + capability probe
    forms.ts               detect/fill/flatten AcroForm
    metadata.ts            read/write metadata
    pageNumbers.ts         page numbers bake
    watermark.ts           watermark bake
    exportImage.ts         page → PNG/JPG (uses renderer)
    errors.ts              typed errors + friendly-message mapping
    fileio.ts              read File→Uint8Array, trigger download (Blob+anchor)
  render/
    pdfjs.ts               worker setup + getDocument wrapper + password handling
    renderPage.ts          render a PageDescriptor to a canvas (rotation-aware, DPR)
    textLayer.ts           build selectable text layer; text-item bbox mapping
    thumbnail.ts           cheap low-scale render
  overlay/
    model.ts               overlay object factory + hit-testing + transforms
    coords.ts              screen px <-> PDF points conversions
    OverlayLayer.tsx       SVG overlay over a page: select/move/resize/delete
    tools/                 per-tool interaction handlers
  ui/
    theme.css theme.ts     (done)
    App.tsx                routes landing <-> workspace
    Landing.tsx            drop-zone + quick-tool tiles
    Workspace.tsx          toolbars + sidebar + canvas + document menu
    components/            Button, Dialog, Toast, Tooltip, Slider, DropZone, FileList...
    quicktools/            Merge, ImagesToPdf, Compress, Protect wizards
    dialogs/               Split, Insert, Crop, ExportImage, Metadata, PageNumbers, Watermark, Signature, FillForms, Flatten, Stamp
    icons.tsx              inline SVG icon set
    hooks/                 useToasts, useKeyboardShortcuts, useEditor (state binding)
tests/
  fixtures/*.pdf           (done)
  unit/core/*.test.ts      one suite per core module
  e2e/*.spec.ts            smoke per phase headline feature
scripts/                   postbuild, check-singlefile, make-fixtures (done)
```

---

## Phases & tasks

Each phase ends with `npm run build && npm test` green and the built single file manually loadable. Commit per task group.

### Phase 0 — Toolchain (DONE)
- [x] Vite+Preact+singlefile pipeline; `dist/pedift.html` verified single-file, no external refs.
- [x] Theme system (both themes + toggle, FOUC-free), centralized strings.
- [x] vitest + playwright configs; fixtures; check-singlefile guard; `.gitattributes`.

### Phase 1 — Skeleton + render + encryption spike
- [ ] **core/errors.ts, core/fileio.ts** — typed errors + friendly messages; `fileToBytes`, `downloadBytes`.
- [ ] **core/ids.ts** — deterministic counter id generator (test-friendly, no Math.random).
- [ ] **render/pdfjs.ts** — worker via `?worker&inline`; `openPdf(bytes, getPassword)` returning a handle; map errors.
- [ ] **render/renderPage.ts, textLayer.ts, thumbnail.ts** — DPR-correct render, rotation-aware viewport, text layer, thumbs.
- [ ] **core/crypto.ts + tests** — `encryptPdf`, `decryptPdf`, `probeEncryptionSupport()`; **unit test encrypt→reload-with-password round-trip** (the spike). If probe fails, UI disables protect with honest message.
- [ ] **core/document.ts (minimal)** — load original bytes, expose page list, `saveCopy()` (untouched round-trip).
- [ ] **ui/App, Landing, DropZone, Workspace (render-only), theme toggle, toasts** — open a PDF, show thumbnails + zoomable page, Save downloads an untouched copy, friendly open errors (incl. password prompt).
- [ ] **e2e smoke**: open fixture → save → downloaded file is a non-empty `%PDF-`.
- [ ] Verify built `dist/pedift.html` opens from `file://`, renders, and the encryption spike works in-browser.

### Phase 2 — Page operations + Merge/Images quick tools
- [ ] **core/commands.ts + history.ts + tests** — command log reducer + undo/redo over DocState.
- [ ] **core/pages.ts + save.ts + tests** — reorder/rotate/delete/duplicate/extract/split/insert reflected in rebuild-from-fresh save; unit tests assert page counts/order/rotation round-trip.
- [ ] **ui Pages panel** — thumbnail grid: drag reorder, multi-select, rotate/delete(confirm)/duplicate, extract, split dialog, insert dialog, export-as-image dialog.
- [ ] **core/merge.ts + imagesToPdf.ts + tests**; **quick-tool wizards** Merge and Images→PDF on landing.
- [ ] **e2e**: reorder+delete+save reopens with expected page count; merge two fixtures → 6 pages.

### Phase 3 — Overlay editing
- [ ] **overlay/coords.ts, model.ts + tests** — px↔points; object factories; hit-test; resize handles.
- [ ] **overlay/OverlayLayer.tsx + tools/** — SVG layer with select/move/resize/delete/z-order, wired to undo/redo.
- [ ] **core/bake.ts + tests** — each overlay type → pdf-lib draw calls; baked output reopens with content present.
- [ ] Tools: text box, whiteout, rectangle/ellipse/line/arrow, pen (freehand→SVG path), highlight (text-layer rects), insert image, signature (draw/type, reusable), stamps.
- [ ] **e2e**: add text box → save → reopened PDF contains the text (extract via pdf-lib/pdf.js).

### Phase 4 — Document tools
- [ ] **core/metadata.ts + tests** — read/write title/author/subject/keywords round-trip.
- [ ] **core/forms.ts + tests** — detect AcroForm; fill text/checkbox/dropdown; flatten. Save path preserves source for fillable docs.
- [ ] **core/crop** (page CropBox; one/all), **core/watermark.ts**, **core/pageNumbers.ts** + tests.
- [ ] **core/compress.ts + tests** — re-encode embedded raster images to JPEG at quality; honest before/after; quick tool + doc menu.
- [ ] **core/crypto** protect/unprotect wired into quick tool + doc menu (per spike; honest disable if unsupported).
- [ ] Document menu UI for all of the above; dialogs.
- [ ] **e2e**: fill form → save → values present; protect → reopen requires password (if supported).

### Phase 5 — Hard extras & polish
- [ ] **Replace text** — click text item (text layer) → whiteout matched rect + pre-sized editable text box; one-time font-difference note.
- [ ] **Keyboard shortcuts** — undo/redo/save/zoom; **drag-drop everywhere**; **touch/tablet** pass (pointer events, larger targets).
- [ ] **Performance** — 100+ page docs: virtualize thumbnails, lazy page render, progress bars; large-file (>100MB) warning.
- [ ] **Accessibility/wording** — tooltips on every tool, empty states, focus management, ARIA, final copy review.
- [ ] Final `check:singlefile`, size budget (≤~6MB target / 12MB ceiling), Chrome+Firefox pass, full unit+e2e green.

---

## Testing strategy
- **Unit (vitest/Node):** every `src/core` module against committed fixtures — merge counts, split ranges, rotation values, metadata round-trip, form fill, encrypt/decrypt, bake content present, undo/redo log.
- **E2E (Playwright):** against the BUILT `dist/pedift.html` served over HTTP; one smoke per phase headline feature; assert downloads are non-empty valid PDFs.
- **CI:** `check:singlefile` (one html, no remote refs); build size budget.

## Out of scope (per spec)
Glyph-level text editing, OCR, cryptographic signatures, any server features, localization beyond English (strings centralized), guaranteed compression ratios.
