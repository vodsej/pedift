# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

pedift is a privacy-first PDF editor that ships as **one self-contained HTML file** (`dist/pedift.html`) and must work fully offline from `file://` with networking disabled. This constraint shapes everything: no external URLs, no async chunks, no CDN fonts, all assets inlined. Design/plan docs live in `docs/superpowers/`.

## Commands

```bash
npm run dev                # Vite dev server
npm run build              # tsc --noEmit + vite build + postbuild → dist/pedift.html (exactly one file)
npm test                   # unit tests (vitest, Node environment, no DOM)
npx vitest run tests/unit/core/save.test.ts   # single test file
npm run test:e2e           # Playwright against the BUILT file — run `npm run build` first
npm run check:singlefile   # asserts dist/ is one .html with no external network refs
npm run fixtures           # regenerate tests/fixtures/*.pdf (outputs are committed)
```

Unit tests run in Node against fixture PDFs and cover `src/core/` only. E2E serves `dist/` over HTTP (download capture needs HTTP), so it always tests the built artifact, not the dev server.

## Architecture

Four layers with a strict one-way dependency rule — lower layers never import from higher:

```
ui → overlay → render → core        (everything may import core)
```

- **`src/core/`** — document model + save pipeline, wraps `@cantoo/pdf-lib`. **No DOM** (sole exception: `compress.ts` uses canvas for JPEG re-encoding behind a `typeof document` guard, which is why it stays testable). This is why core unit tests need no jsdom.
- **`src/render/`** — read-only pdf.js wrapper: page/thumbnail canvases, text layer. Imports core only.
- **`src/overlay/`** — interactive SVG/DOM annotation layer (select/move/resize). Imports core + strings only, not render or ui.
- **`src/ui/`** — Preact components; the integrating layer. `Workspace.tsx`/`PageStage.tsx` wire `EditorDocument` + `RenderRegistry` + `OverlayLayer` together.

### State model & save pipeline

`DocState` (`src/core/types.ts`) is the entire serializable editor state: ordered `PageDescriptor[]` (each points at immutable source bytes via `sourceId`/`srcIndex`), per-page `OverlayObject[]`, plus metadata/watermark/pageNumbers/protect config. Undo/redo is an array of `DocState` snapshots in `EditorDocument` (`src/core/document.ts`) — snapshots are cheap because they hold no PDF bytes.

Saving **rebuilds from fresh** (`src/core/save.ts`): a new `PDFDocument.create()`, `copyPages` from each source, then per-page rotation/crop/overlay-bake (`src/core/bake.ts`), then watermark/page-numbers, then optional encryption. **The loaded original bytes are never mutated** — this is the project's core guarantee; don't write code that mutates a source `PDFDocument`.

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

### Strings

All user-facing text goes through `t` from `src/strings/en.ts` (the single future-localization swap point). The convention is not lint-enforced — follow it anyway; don't hardcode UI strings in components.

### Single-file build rules

`vite.config.ts` comments explain the load-bearing settings (`base: './'`, inlined dynamic imports, `assetsInlineLimit: () => true`, `worker.format: 'es'`). Any change that introduces a runtime `fetch`, an external URL, or a separate emitted asset will fail `check:singlefile`. Run `npm run build && npm run check:singlefile` after changes that touch assets, workers, or imports.
