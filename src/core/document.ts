import { PDFDocument } from '@cantoo/pdf-lib'
import type { DocState, Metadata, OverlayObject, PageDescriptor, SourceRef } from './types'
import { classifyError } from './errors'
import { nextId } from './ids'
import {
  deletePages,
  duplicatePages,
  descriptorsForSource,
  insertPagesAt,
  movePages,
  normalizeRotation,
  rotatePages,
  setCrop,
} from './pages'
import { buildPdf, buildSubset, buildSplit, type BuildContext, type RedactRect } from './save'
import { createBakeAssets, bakeObjects, type BakeAssets } from './bake'
import { applyPageNumbers } from './pageNumbers'
import { applyWatermark } from './watermark'
import { applyOcrLayer, type Fontkit } from './ocr'
import type { OcrPageData, PageNumbersConfig, WatermarkConfig, ProtectConfig } from './types'

export interface ImageAsset {
  bytes: Uint8Array
  format: 'png' | 'jpg'
  width: number
  height: number
}

const HISTORY_LIMIT = 200

function readMetadata(doc: PDFDocument): Metadata {
  const safe = (fn: () => string | undefined) => {
    try {
      return fn() ?? ''
    } catch {
      return ''
    }
  }
  return {
    title: safe(() => doc.getTitle()),
    author: safe(() => doc.getAuthor()),
    subject: safe(() => doc.getSubject()),
    keywords: safe(() => doc.getKeywords()),
  }
}

/**
 * Owns the editable model: byte sources, the asset cache, and a snapshot history
 * for undo/redo. State snapshots contain only descriptors + overlay geometry (no
 * PDF bytes), so they are cheap to store. The loaded original is never mutated;
 * every save rebuilds from sources via the save pipeline.
 */
export class EditorDocument {
  readonly fileName: string
  private sources = new Map<string, SourceRef>()
  private images = new Map<string, ImageAsset>()
  private history: DocState[]
  private pointer = 0
  private listeners = new Set<() => void>()

  private ocrFontBytes: Uint8Array | null = null
  private ocrFontkit: Fontkit | null = null
  private redactionRasterizer: BuildContext['rasterizeRedacted'] = undefined

  private constructor(fileName: string, initial: DocState, original: SourceRef) {
    this.fileName = fileName
    this.history = [initial]
    this.sources.set(original.id, original)
  }

  static async open(bytes: Uint8Array, fileName: string, password?: string): Promise<EditorDocument> {
    let doc: PDFDocument
    try {
      doc = await PDFDocument.load(bytes, { password, updateMetadata: false })
    } catch (err) {
      throw classifyError(err)
    }
    const pages = doc.getPages()
    const original: SourceRef = { id: 'original', kind: 'pdf', bytes, name: fileName, password }
    const descriptors = descriptorsForSource('original', pages.length, (i) =>
      pages[i] ? pages[i].getRotation().angle : 0,
    )
    const state: DocState = {
      pages: descriptors,
      overlays: {},
      metadata: readMetadata(doc),
      pageNumbers: null,
      watermark: null,
      formValues: {},
      flatten: false,
      protect: null,
    }
    return new EditorDocument(fileName, state, original)
  }

  // ---- subscription ----
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  private emit(): void {
    for (const fn of this.listeners) fn()
  }

  // ---- state access ----
  get state(): DocState {
    return this.history[this.pointer]
  }
  get pages(): PageDescriptor[] {
    return this.state.pages
  }
  get pageCount(): number {
    return this.state.pages.length
  }
  pageById(id: string): PageDescriptor | undefined {
    return this.state.pages.find((p) => p.id === id)
  }
  indexOfPage(id: string): number {
    return this.state.pages.findIndex((p) => p.id === id)
  }

  // ---- history ----
  get canUndo(): boolean {
    return this.pointer > 0
  }
  get canRedo(): boolean {
    return this.pointer < this.history.length - 1
  }
  undo(): boolean {
    if (!this.canUndo) return false
    this.pointer--
    this.emit()
    return true
  }
  redo(): boolean {
    if (!this.canRedo) return false
    this.pointer++
    this.emit()
    return true
  }

  /** Apply a pure transform to the current state and push the result as a new snapshot. */
  update(mutator: (state: DocState) => DocState): void {
    const next = mutator(this.state)
    if (next === this.state) return
    this.commit(next)
  }
  private commit(next: DocState): void {
    // Drop any redo tail, push, and cap history length.
    this.history = this.history.slice(0, this.pointer + 1)
    this.history.push(next)
    if (this.history.length > HISTORY_LIMIT) this.history.shift()
    this.pointer = this.history.length - 1
    this.emit()
  }

  // ---- sources & assets ----
  getSource(id: string): SourceRef | undefined {
    return this.sources.get(id)
  }
  addSource(ref: SourceRef): void {
    this.sources.set(ref.id, ref)
  }
  getImage(key: string): ImageAsset | undefined {
    return this.images.get(key)
  }
  addImage(asset: ImageAsset): string {
    const key = nextId('img')
    this.images.set(key, asset)
    return key
  }

  // ---- page operations ----
  reorder(ids: string[], toIndex: number): void {
    this.update((s) => ({ ...s, pages: movePages(s.pages, ids, toIndex) }))
  }
  rotate(ids: string[], deltaDeg: number): void {
    this.update((s) => ({ ...s, pages: rotatePages(s.pages, ids, deltaDeg) }))
  }
  remove(ids: string[]): void {
    this.update((s) => {
      const pages = deletePages(s.pages, ids)
      if (pages === s.pages) return s
      // Drop overlays + OCR data attached to removed pages.
      const kept = new Set(pages.map((p) => p.id))
      const overlays: Record<string, OverlayObject[]> = {}
      for (const [pid, objs] of Object.entries(s.overlays)) if (kept.has(pid)) overlays[pid] = objs
      const ocrData = s.ocrData
        ? Object.fromEntries(Object.entries(s.ocrData).filter(([pid]) => kept.has(pid)))
        : undefined
      return { ...s, pages, overlays, ocrData }
    })
  }
  duplicate(ids: string[]): void {
    this.update((s) => ({ ...s, pages: duplicatePages(s.pages, ids) }))
  }
  setCropOn(ids: string[], crop: PageDescriptor['crop']): void {
    this.update((s) => ({ ...s, pages: setCrop(s.pages, ids, crop) }))
  }

  /** Insert pages from another (already-registered) source at a position. */
  insertSourcePages(sourceId: string, srcIndices: number[], atIndex: number): void {
    const ref = this.sources.get(sourceId)
    if (!ref) return
    const inserted: PageDescriptor[] = srcIndices.map((srcIndex) => ({
      id: nextId('pg'),
      sourceId,
      srcIndex,
      rotation: normalizeRotation(ref.pageRotations?.[srcIndex] ?? 0),
      crop: null,
    }))
    this.update((s) => ({ ...s, pages: insertPagesAt(s.pages, atIndex, inserted) }))
  }

  setMetadata(meta: Metadata): void {
    this.update((s) => ({ ...s, metadata: { ...meta } }))
  }
  setPageNumbers(cfg: PageNumbersConfig | null): void {
    this.update((s) => ({ ...s, pageNumbers: cfg }))
  }
  setWatermark(cfg: WatermarkConfig | null): void {
    this.update((s) => ({ ...s, watermark: cfg }))
  }
  setProtect(cfg: ProtectConfig | null): void {
    this.update((s) => ({ ...s, protect: cfg }))
  }

  setOcrData(
    data: Record<string, OcrPageData>,
    fontBytes: Uint8Array | null,
    fontkit: Fontkit | null,
  ): void {
    this.ocrFontBytes = fontBytes
    this.ocrFontkit = fontkit
    this.update((s) => ({ ...s, ocrData: { ...(s.ocrData ?? {}), ...data } }))
  }

  /** Inject the page rasterizer used for true redaction (needs the render layer,
   *  so it is supplied by the UI). Wired once at startup. */
  setRedactionRasterizer(fn: BuildContext['rasterizeRedacted']): void {
    this.redactionRasterizer = fn
  }

  /**
   * Replace the document's base bytes (e.g. after filling/flattening a form),
   * resetting pages/overlays to the new document. Pushed as an undoable snapshot.
   * Returns the loaded page count. The caller must evict the source from any
   * RenderRegistry so it re-opens the new bytes.
   */
  async rebase(bytes: Uint8Array, password?: string): Promise<void> {
    let doc: PDFDocument
    try {
      doc = await PDFDocument.load(bytes, { password, updateMetadata: false })
    } catch (err) {
      throw classifyError(err)
    }
    const pages = doc.getPages()
    this.sources.set('original', { id: 'original', kind: 'pdf', bytes, name: this.fileName, password })
    const descriptors = descriptorsForSource('original', pages.length, (i) =>
      pages[i] ? pages[i].getRotation().angle : 0,
    )
    this.commit({
      pages: descriptors,
      overlays: {},
      metadata: readMetadata(doc),
      pageNumbers: null,
      watermark: null,
      formValues: {},
      flatten: false,
      protect: this.state.protect,
    })
  }

  // ---- overlay operations ----
  overlaysFor(pageId: string): OverlayObject[] {
    return this.state.overlays[pageId] ?? []
  }
  setOverlays(pageId: string, objs: OverlayObject[]): void {
    this.update((s) => ({ ...s, overlays: { ...s.overlays, [pageId]: objs } }))
  }

  // ---- build context & save ----
  /** A bakePage hook that draws this document's overlay objects onto each page. */
  private bakeHook(): Pick<BuildContext, 'bakePage'> {
    const overlays = this.state.overlays
    const images = this.images
    // Assets (embedded fonts/images) are bound to a specific output document.
    // Split builds reuse this hook across several docs, so re-create when `out` changes.
    let assets: BakeAssets | null = null
    let lastOut: PDFDocument | null = null
    return {
      bakePage: async (out, page, pageId) => {
        const objs = overlays[pageId]
        if (!objs || objs.length === 0) return
        if (!assets || out !== lastOut) {
          assets = createBakeAssets(out, images)
          lastOut = out
        }
        await bakeObjects(page, objs, assets)
      },
    }
  }
  /** Collect redaction bars per page from the overlay objects. */
  private collectRedactions(): Map<string, RedactRect[]> {
    const map = new Map<string, RedactRect[]>()
    for (const [pageId, objs] of Object.entries(this.state.overlays)) {
      const bars: RedactRect[] = objs
        .filter((o): o is Extract<OverlayObject, { type: 'redaction' }> => o.type === 'redaction')
        .map((o) => ({ x: o.x, y: o.y, width: o.width, height: o.height, color: o.color }))
      if (bars.length) map.set(pageId, bars)
    }
    return map
  }
  /** A finalize hook that draws OCR layer, watermark, and page numbers after assembly. */
  private finalizeHook(skipPageIds: Set<string>): Pick<BuildContext, 'finalize'> {
    const ocrFontBytes = this.ocrFontBytes
    const ocrFontkit = this.ocrFontkit
    return {
      finalize: async (out, state) => {
        // Skip the invisible OCR text on redacted (flattened) pages — otherwise
        // the persisted ocrData would re-introduce the redacted words as
        // selectable text on top of the raster.
        if (state.ocrData) await applyOcrLayer(out, state, ocrFontBytes, ocrFontkit, skipPageIds)
        if (state.watermark) await applyWatermark(out, state.watermark)
        if (state.pageNumbers) await applyPageNumbers(out, state.pageNumbers)
      },
    }
  }
  buildContext(extra?: Partial<BuildContext>): BuildContext {
    const rasterizeRedacted = extra?.rasterizeRedacted ?? this.redactionRasterizer
    const redactions = this.collectRedactions()
    const redactedIds = rasterizeRedacted
      ? new Set([...redactions].filter(([, r]) => r.length).map(([id]) => id))
      : new Set<string>()
    return {
      sources: this.sources,
      ...this.bakeHook(),
      ...this.finalizeHook(redactedIds),
      redactions,
      rasterizeRedacted,
      ...extra,
    }
  }
  build(extra?: Partial<BuildContext>): Promise<Uint8Array> {
    return buildPdf(this.state, this.buildContext(extra))
  }
  buildSubsetByIds(ids: string[], extra?: Partial<BuildContext>): Promise<Uint8Array> {
    const idSet = new Set(ids)
    const subset = this.state.pages.filter((p) => idSet.has(p.id))
    return buildSubset(subset, this.buildContext(extra))
  }
  buildSplitGroups(groups: PageDescriptor[][], extra?: Partial<BuildContext>): Promise<Uint8Array[]> {
    return buildSplit(groups, this.buildContext(extra))
  }
}
