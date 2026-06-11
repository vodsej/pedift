# pedift — Single-File Browser PDF Editor

**Date:** 2026-06-11
**Status:** Approved design, ready for implementation planning
**Repository:** `pedift` (currently empty)

## 1. What it is

pedift is a free PDF editor that runs entirely in the browser. The whole
application ships as **one HTML file** (`pedift.html`, ~4–6 MB) that a user can
download, double-click, and use **fully offline** from `file://`. No install,
no server, no network calls. Files never leave the user's machine — the UI
states this privacy guarantee prominently.

**Audience:** the general public. The UI must be friendly: tooltips, clear
empty states, undo safety nets, plain wording, progress indicators. English
only, but all UI strings centralized in one module so languages can be added
later.

## 2. Constraints

- **Single-file artifact.** `npm run build` must emit exactly one
  self-contained HTML file with all JS, CSS, fonts, icons, and the pdf.js
  worker inlined. It must work opened directly from `file://` with no network.
- **Offline.** No CDN references, no telemetry, no external fonts.
- **Privacy.** All processing happens in the browser. Nothing is uploaded.
- **No data loss.** The loaded original is never mutated; every save produces a
  new downloaded file. "Discard changes" must always be safe.
- **Large files.** Warn (don't freeze) above ~100 MB. Heavy work runs in the
  pdf.js worker or is chunked with visible progress.

## 3. Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Build | Vite + TypeScript + `vite-plugin-singlefile` | Normal module source in repo; single HTML out |
| UI | Preact | ~4 KB react-like; used for all chrome/dialogs/state |
| Rendering | pdf.js (Mozilla) | Page canvases, thumbnails, text layer, zoom. Read-only |
| Writing | `@cantoo/pdf-lib` | pdf-lib fork with encryption support; all document surgery |
| Unit tests | vitest (Node) | Document-core operations against fixture PDFs |
| E2E tests | Playwright | Smoke tests against the **built** single file |

**Phase-1 spike (mandatory):** verify `@cantoo/pdf-lib` encrypt/decrypt
actually works in-browser before committing to the protect/unprotect features.
If it fails, ship those features as "not supported" with an honest UI message —
never a broken button.

## 4. Architecture

Four layers with strict boundaries:

1. **Document core** (`src/core/`) — no DOM, no UI imports. Wraps
   `@cantoo/pdf-lib`. Owns the open document and an **operations log** (merge,
   rotate, deletePage, addAnnotation, …). Every feature is a pure operation on
   this model. Undo/redo = replay the log minus the undone tail. Each
   operation is unit-testable in Node.
2. **Renderer** (`src/render/`) — wraps pdf.js. Renders pages and thumbnails
   to canvases, exposes the text layer (for highlight + replace-text), handles
   zoom. Never writes PDFs.
3. **Overlay editor** (`src/overlay/`) — a transparent SVG layer positioned
   over each rendered page. All interactive objects (text boxes, pen strokes,
   shapes, highlights, whiteout rects, images, signatures, stamps) live here
   while editing: selectable, movable, resizable, deletable. On save, each
   overlay object converts to pdf-lib drawing operations and is baked in.
4. **UI shell** (`src/ui/`) — Preact components: landing screen, workspace,
   toolbars, dialogs, toasts, theme switcher.

**Save pipeline:** document core replays the operations log into a fresh
pdf-lib document → serialized bytes → browser download. The in-memory original
stays untouched.

**Error handling:** every file operation is wrapped; corrupt files, wrong
passwords, and unsupported encryption produce friendly, specific messages.
Failures never lose loaded work.

## 5. UI / UX

**Layout — hybrid (decided):**

- **Landing screen:** a large drop-zone ("Drop a PDF here or click to open")
  plus quick-tool tiles for one-shot jobs: **Merge**, **Images → PDF**,
  **Compress**, **Protect/Unprotect**. Quick tools are small focused wizards:
  drop files → set options → download. They do not open the workspace.
- **Workspace:** opens when a PDF is dropped/opened for editing. Left sidebar
  of page thumbnails; top toolbar of annotation tools; main zoomable page
  canvas; a Document menu for document-level actions; Save button downloads
  the result.

**Visual style (decided):** "Warm & Friendly" — cream background, warm amber
accent, rounded corners, friendly typography — **plus a dark-mode toggle**
(dark slate variant). Theme choice persisted in `localStorage`; default
follows `prefers-color-scheme`. All colors via CSS custom properties; both
themes ship in the single file.

**General-public polish requirements:** tooltips on every tool, empty states
that explain what to do, confirmation only for destructive actions
(delete pages), undo/redo prominent, progress bars for slow operations,
drag-and-drop accepted everywhere files can be chosen, keyboard shortcuts for
common actions (undo, redo, save, zoom), usable on tablet touch screens.

## 6. Features

### Landing quick tools
| Feature | Behavior |
|---|---|
| Merge PDFs | Add 2+ PDFs, drag to reorder the list, merge → download |
| Images → PDF | Add JPG/PNG images, reorder, choose page size (A4/Letter/fit-image) and orientation → download |
| Compress | Open PDF → re-encode embedded raster images as lower-quality JPEG (quality slider) → report honest before/after sizes → download. Best-effort; never promise a ratio |
| Protect / Unprotect | Add or remove a user password (requires knowing the current password to remove). Depends on phase-1 spike |

### Workspace — Pages panel (thumbnail grid)
| Feature | Behavior |
|---|---|
| Reorder | Drag-and-drop thumbnails |
| Rotate / Delete / Duplicate | Per page or multi-selection |
| Extract | Selected pages → new PDF download |
| Split | By custom ranges or every N pages → multiple downloads (zip not required; sequential downloads acceptable) |
| Insert | Insert all/some pages from another PDF at a chosen position |
| Crop | Draw a rectangle on a page → set page CropBox; apply to one page or all |
| Export as image | Selected pages → PNG or JPG at chosen scale |

### Workspace — Annotate toolbar (overlay objects)
| Feature | Behavior |
|---|---|
| Text box | Place/type text; font size, color; standard fonts (Helvetica/Times/Courier) |
| Replace text (best effort) | Click existing text via the text layer → cover with background-matched rectangle + editable text box pre-sized to match, standard font. UI labels it "Replace text", with a one-time note that fonts may differ. Glyph-level true editing is **out of scope** |
| Highlight | Select text via text layer → semi-transparent highlight |
| Pen | Freehand drawing; color + stroke width |
| Shapes | Rectangle, ellipse, line, arrow; color, stroke width, optional fill |
| Whiteout / remove region | Opaque rectangle matching page background; one-click white default |
| Insert image | Place PNG/JPG; move/resize |
| Signature | Draw with mouse/touch or type in a script font; reusable within session; place/resize |
| Stamps | ✓, ✗, APPROVED, DRAFT, CONFIDENTIAL, date stamp |
| Page numbers | Position (6 presets), format (`1`, `1 / N`, `Page 1 of N`), range, starting number |
| Watermark | Diagonal text watermark; text, color, opacity, all/range of pages |

All overlay objects: select, move, resize, delete, z-order, undo/redo until
saved. Saving bakes them into page content.

### Workspace — Document menu
| Feature | Behavior |
|---|---|
| Fill forms | Detect AcroForm fields; fill text fields, checkboxes, dropdowns; save filled |
| Flatten | Bake form fields and annotations into static page content |
| Metadata | View/edit title, author, subject, keywords |
| Protect / Unprotect | Same engine as quick tool |
| Compress | Same engine as quick tool |
| Undo / Redo | Operation-log based, covers all workspace operations |
| Save | Download edited PDF; filename `<original>-edited.pdf` by default |

## 7. Build phases

Ordered so the tool is usable early and every phase is independently
verifiable. **Each phase ends with `npm run build && npm test` green and the
built single file manually loadable from `file://`.**

1. **Skeleton.** Vite single-file pipeline; theming (both themes + toggle);
   landing screen with drop-zone; open and render a PDF (pages + thumbnails,
   zoom); save an untouched copy; friendly open-error handling; **encryption
   spike** for `@cantoo/pdf-lib`.
2. **Page operations.** Full Pages panel (reorder, rotate, delete, duplicate,
   extract, split, insert, export-as-image); landing quick tools Merge and
   Images → PDF.
3. **Overlay editing.** Overlay layer with selection model and undo/redo;
   text box, whiteout, shapes, pen, highlight, insert image, signature,
   stamps; baked-in save.
4. **Document tools.** Forms fill, flatten, metadata, crop, watermark, page
   numbers, protect/unprotect (per spike outcome), compress — including the
   corresponding landing quick tools (Compress, Protect/Unprotect).
5. **Hard extras & polish.** Replace-text; keyboard shortcuts; drag-drop
   everywhere; touch/tablet usability pass; performance pass on 100+ page
   documents; final accessibility/wording review.

## 8. Testing

- **Unit (vitest, Node):** every document-core operation against small fixture
  PDFs committed to the repo — merge page counts, split ranges, rotation
  values, metadata round-trip, form fill values, operations-log undo/redo.
- **E2E (Playwright):** run against the **built single file**, not the dev
  server: open fixture → add text box → save → downloaded file is non-empty
  and re-opens with the text present. One smoke per phase's headline feature.
- **Build checks in CI:** output is exactly one `.html`; no external URL
  references in the artifact (grep for `https://` in output, allowlist for
  in-comment license links).

## 9. Out of scope

- True glyph-level editing of existing text (font-preserving reflow)
- OCR of scanned documents
- Digital (cryptographic) signatures — the signature tool is visual only
- Server features of any kind: accounts, sharing, cloud storage
- Localization beyond English (strings centralized for later)
- Guaranteed compression ratios

## 10. Success criteria

1. `npm run build` emits one HTML file ≤ ~6 MB that fully works from `file://`
   with networking disabled.
2. A non-technical user can: merge two PDFs; sign and date a form and send it
   back; whiteout a line and replace the text — each without instructions.
3. All listed features function on current Chrome and Firefox (Safari
   best-effort).
4. All unit + E2E tests pass; no operation can destroy the loaded original.
