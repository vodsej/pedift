import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { SourceRef } from '../core/types'
import { openPdfDocument, destroyPdf, type OpenedPdf } from './pdfjs'

/**
 * Maps source ids to opened pdf.js documents for rendering. The workspace renders
 * page descriptors that point at sources (original + inserted PDFs); this opens
 * each source's pdf.js doc lazily and caches it.
 */
export class RenderRegistry {
  private docs = new Map<string, PDFDocumentProxy>()
  private pending = new Map<string, Promise<PDFDocumentProxy>>()
  /** Bumped on evict so hooks can re-resolve a source after its bytes change. */
  version = 0

  constructor(private getSource: (id: string) => SourceRef | undefined) {}

  /** Pre-register an already-opened document (e.g. the original from the open flow). */
  seed(sourceId: string, opened: OpenedPdf): void {
    this.docs.set(sourceId, opened.document)
  }

  get(sourceId: string): Promise<PDFDocumentProxy> {
    const have = this.docs.get(sourceId)
    if (have) return Promise.resolve(have)
    const inflight = this.pending.get(sourceId)
    if (inflight) return inflight

    const ref = this.getSource(sourceId)
    if (!ref) return Promise.reject(new Error(`Unknown source ${sourceId}`))

    const p = openPdfDocument(ref.bytes, { initialPassword: ref.password }).then((opened) => {
      this.docs.set(sourceId, opened.document)
      this.pending.delete(sourceId)
      return opened.document
    })
    this.pending.set(sourceId, p)
    return p
  }

  /** Forget a source's cached document so the next get() re-opens its (new) bytes. */
  async evict(sourceId: string): Promise<void> {
    const doc = this.docs.get(sourceId)
    this.docs.delete(sourceId)
    this.pending.delete(sourceId)
    this.version++
    if (doc) await destroyPdf(doc)
  }

  async destroy(): Promise<void> {
    for (const doc of this.docs.values()) await destroyPdf(doc)
    this.docs.clear()
    this.pending.clear()
  }
}
