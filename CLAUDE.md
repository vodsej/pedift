# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

pedift is a privacy-first PDF editor that ships as **one self-contained HTML file** (`dist/pedift.html`) and must work fully offline from `file://` with networking disabled. This constraint shapes everything: no external URLs, no async chunks, no CDN fonts, all assets inlined. Design/plan docs live in `docs/superpowers/`.

## Commands

```bash
npm run dev                # Vite dev server
npm run build              # tsc --noEmit + vite build + postbuild → dist/pedift.html (exactly one file)
npm run build:ocr          # builds dist/pedift-ocr.html with OCR inlined (~9 MB)
npm run build:all          # both editions (lean + OCR)
npm test                   # unit tests (vitest, Node environment, no DOM)
npx vitest run tests/unit/core/save.test.ts   # single test file
npm run test:e2e           # Playwright against the BUILT file — run `npm run build` first
npm run check:singlefile   # asserts dist/ is one .html with no external network refs
npm run fixtures           # regenerate tests/fixtures/*.pdf (outputs are committed)
```

> **Note:** both `npm run build` and `npm run build:ocr` automatically run
> `scripts/prebuild-ocr.mjs` first. That script generates gitignored
> `src/ocr/vendor/*.gen.ts` from committed raw binaries so `tsc` resolves them.

Unit tests run in Node against fixture PDFs and cover `src/core/` only. E2E serves `dist/` over HTTP (download capture needs HTTP), so it always tests the built artifact, not the dev server.

## Architecture

Four layers with a strict one-way dependency rule — lower layers never import from higher:

```
ui → overlay → render → core        (everything may import core)
```

- **`src/core/`** — document model + save pipeline, wraps `@cantoo/pdf-lib`. **No DOM** (sole exception: `compress.ts` uses canvas for JPEG re-encoding behind a `typeof document` guard, which is why it stays testable). This is why core unit tests need no jsdom.
- **`src/render/`** — read-only pdf.js wrapper: page/thumbnail canvases, text layer, plus the pure (DOM/pdf.js-free) in-document search matcher (`search.ts`). Imports core only.
- **`src/overlay/`** — interactive SVG/DOM annotation layer (select/move/resize). Imports core + strings only, not render or ui.
- **`src/ui/`** — Preact components; the integrating layer. `Workspace.tsx`/`PageStage.tsx` wire `EditorDocument` + `RenderRegistry` + `OverlayLayer` together.

### State model & save pipeline

`DocState` (`src/core/types.ts`) is the entire serializable editor state: ordered `PageDescriptor[]` (each points at immutable source bytes via `sourceId`/`srcIndex`), per-page `OverlayObject[]`, plus metadata/watermark/pageNumbers/protect config and optional per-page `ocrData` (recognized words, used both for the in-app selectable-text overlay and the invisible-text bake). Undo/redo is an array of `DocState` snapshots in `EditorDocument` (`src/core/document.ts`) — snapshots are cheap because they hold no PDF bytes.

Saving **rebuilds from fresh** (`src/core/save.ts`): a new `PDFDocument.create()`, `copyPages` from each source, then per-page rotation/crop/overlay-bake (`src/core/bake.ts`), then watermark/page-numbers, then optional encryption. **The loaded original bytes are never mutated** — this is the project's core guarantee; don't write code that mutates a source `PDFDocument`.

**True redaction** is part of this rebuild. A page carrying a `RedactionObj` is *excluded from `copyPages`* (its source content never enters the output) and instead rebuilt as a flattened raster with the bars painted in — see the redacted-page branch in `assembleDocument` plus `src/render/redactRaster.ts`. The page is rendered **unrotated**, so `/Rotate`+crop are re-applied to the fresh image page exactly as to a copied page (no special-casing downstream). The rasterizer needs the render layer, so it's **injected from the UI** via `editor.setRedactionRasterizer(...)` (mirrors the OCR-fontkit injection); `buildContext` turns each page's `RedactionObj`s into the `redactions` map (`RedactRect[]`). Note `WhiteoutObj` is a *separate, cosmetic* cover that only draws an opaque box (still used by Replace-text) — it does **not** remove content; don't conflate the two.

### Invariants and gotchas

- **Coordinates:** all `OverlayObject` coordinates are PDF points, **unrotated page space, bottom-left origin**. `src/overlay/geometry.ts` (`viewToPdf`/`pdfToView`) converts to/from screen space (CSS px, top-left origin, rotated). Storing unrotated coords is what lets `bake.ts` use plain `page.drawX()` calls — the page's `/Rotate` entry rotates baked content along with existing content.
- Line/arrow `ShapeObj` uses **signed** `width`/`height` (`(x,y)` = start, `(x+w,y+h)` = end). Never assume positive dimensions; normalize via `boundsOf()` in `src/overlay/model.ts`.
- `EditorDocument.update(mutator)` treats a returned **same reference** as a no-op — mutators must return a new `DocState`.
- `deletePages` (`src/core/pages.ts`) silently refuses to empty the document; respect the same guard in UI flows.
- After `rebase()` (used by fill-forms/flatten, replaces the `'original'` source bytes), the caller must call `registry.evict('original')` so pdf.js reopens the new bytes (`RenderRegistry.version` drives re-render hooks).
- pdf.js **neuters ArrayBuffers** it receives — always pass `data.slice()` (see `src/render/pdfjs.ts`).
- The pdf.js worker is inlined as a `data:` URL built from `?raw` import (`src/render/pdfjs.ts`) because `blob:` workers fail on `file://`. Don't "simplify" this to a standard `?worker` import or the offline build breaks.
- Password protection is gated by a runtime capability probe (`probeEncryptionSupport()` in `src/core/crypto.ts`, run at startup); the feature is disabled if the probe fails.
- Page/overlay ids (`src/core/ids.ts`) are deterministic session-local counters — never persist them.
- **Redaction + OCR leak:** a flattened (redacted) page must not get the invisible OCR text layer re-drawn on top, or the redacted words become selectable again. `applyOcrLayer` takes a `skipPageIds` set (the redacted pages, supplied by `document.ts`'s `finalizeHook`) and skips them. If `rasterizeRedacted` is absent (headless/core-only — e.g. unit tests that don't wire it), redaction degrades to a cosmetic baked bar (`bake.ts` `'redaction'` case); true removal only happens when the UI rasterizer is wired.
- **Select-mode text layer:** in Select mode `OverlayLayer`'s root is `pointer-events:none`, so empty-area drags fall through to `SelectableTextLayer` (`src/ui/SelectableTextLayer.tsx`) below it — an always-on pdf.js text layer (`buildSelectableTextLayer` in `src/render/textLayer.ts`, at CSS-px scale, *not* ×dpr) plus invisible OCR word spans from `state.ocrData`, giving native text selection/copy. Annotation objects/handles re-enable `pointer-events` and `stopPropagation`, so clicks on them still reach the overlay; the deselect-on-empty-click handler therefore lives on the text layer, not the (unreachable) overlay root. Don't restore `pointer-events` on the overlay root in select mode.
- **Find / search (Ctrl+F):** whole-document. The cross-page match index + navigation live in `src/ui/hooks/useSearch.ts` (extraction cached per source page, invalidated on `registry.version`; `setCurrent` jumps to the active match's page); `SearchHighlightLayer` paints matches on the current page only. Both sides run the **same** pure matcher (`findInSegments` in `src/render/search.ts`) over the **same** segment list — native text via `buildPageSegments` (`textLayer.ts`) **plus** `ocrSegments` from `state.ocrData`. That shared segment ordering is load-bearing: the `N of M` counter and which highlight is "active" are aligned purely by match index, so if you change segment filtering/joining on one side you must change it on the other or they desync. `search.ts` is DOM/pdf.js-free on purpose and is unit-tested under `tests/unit/render/`. (Boxes differ by scale between the two sides; only strings/ordering must match, and those are scale-independent.)

### Strings

All user-facing text goes through `t` imported from `src/strings` (the index module). The convention is not lint-enforced — follow it anyway; don't hardcode UI strings in components.

Localization lives in `src/strings/`: `en.ts` is the canonical table whose shape (`Strings`) every locale must satisfy (`en` is intentionally *not* `as const` so locales can supply their own text); `cs.ts` is the Czech table; `index.ts` holds the active locale and exports `t` as a **live ES binding** that `setLocale` reassigns. Components read `t.x.y` at render time, so a single forced re-render at the app root (`useLocale` in `App.tsx`) cascades a locale change through the whole tree. To add a locale: add `<code>.ts` satisfying `Strings`, register it in `index.ts` (`tables`, `LOCALES`, `Locale`, detection), and extend `LangToggle`. **Gotcha:** never capture `t.*` into a module-level `const` — it freezes the value at the boot locale; build such lists inside the component instead (see `quickTools()` in `Landing.tsx`).

Three non-enforced UI conventions to preserve when adding menu items or dialogs: (1) A Document-menu label ends with `…` (U+2026) when it opens a dialog that **gathers input**; pure-confirmation actions (e.g. Flatten) do not. (2) A dialog's `<Dialog icon={…}>` must match the icon used for that action in `DocumentMenu.tsx` or the landing quick-tool tile. (3) `IconShield` is reserved solely for the "Private & offline" privacy badge; password-protection UI (landing tile, Document menu, ProtectDialog, ProtectWizard) uses `IconLock` everywhere.

### Two-edition build

pedift ships two artifacts from the same source tree:

- **`dist/pedift.html`** (~2.4 MB) — lean, no OCR.
- **`dist/pedift-ocr.html`** (~9 MB) — full OCR (tesseract-wasm + fontkit inlined).

The split is controlled by a `__OCR__` compile-time `define` flag in `vite.config.ts`. When `__OCR__` is false, the `@ocr/assets` Vite alias resolves to `src/ocr/assets.stub.ts` (a throwing stub), so tesseract and fontkit are never pulled into the lean graph. The OCR dialog in `Workspace.tsx` is behind a `__OCR__`-gated dynamic import for the same reason. `check:singlefile` validates both artifacts with per-file size ceilings (lean ≤ 6 MB, OCR ≤ 14 MB).

### `src/ocr/` layer

A new layer that sits above `src/render/` (may use DOM, tesseract-wasm, and the render registry):

- **`assets.ts`** / **`assets.stub.ts`** — gzip+base64 inlined vendor binaries (tesseract-wasm WASM/JS, trained data). Decoded at runtime via `DecompressionStream`. The stub resolves the `@ocr/assets` alias in the lean build and throws if called.
- **`engine.ts`** — runs tesseract-wasm on the main thread (page canvas → `OcrPageData`: word bounding boxes + text).

The DOM-free invisible-text bake lives in **`src/core/ocr.ts`** (`applyOcrLayer`), called from the save pipeline's `finalize` hook (before watermark/page-numbers). fontkit is **injected** into it via `editor.setOcrData(...)` so it stays out of the lean bundle; that same call also stores the recognized words in `DocState.ocrData`, so the always-on `SelectableTextLayer` can render OCR text as selectable spans without saving. Coordinates follow the same unrotated PDF-point convention as `src/overlay/geometry.ts` (`viewToPdf`/`pdfToView`).

### Single-file build rules

`vite.config.ts` comments explain the load-bearing settings (`base: './'`, inlined dynamic imports, `assetsInlineLimit: () => true`, `worker.format: 'es'`). Any change that introduces a runtime `fetch`, an external URL, or a separate emitted asset will fail `check:singlefile`. Run `npm run build && npm run check:singlefile` after changes that touch assets, workers, or imports.
