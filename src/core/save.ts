import { PDFDocument, degrees, type PDFPage } from '@cantoo/pdf-lib'
import type { DocState, PageDescriptor, SourceRef, Metadata } from './types'
import { PdfError, classifyError } from './errors'

export interface BuildContext {
  sources: Map<string, SourceRef>
  /** Optional hook to bake overlay objects onto a page (added in Phase 3). */
  bakePage?: (out: PDFDocument, page: PDFPage, pageId: string) => Promise<void>
  /** Optional post-pass hooks (watermark, page numbers — Phase 4). */
  finalize?: (out: PDFDocument, state: DocState) => Promise<void>
}

async function loadSource(
  cache: Map<string, PDFDocument>,
  sources: Map<string, SourceRef>,
  sourceId: string,
): Promise<PDFDocument> {
  const cached = cache.get(sourceId)
  if (cached) return cached
  const ref = sources.get(sourceId)
  if (!ref) throw new PdfError('generic', `Missing source ${sourceId}`)
  if (ref.kind !== 'pdf') throw new PdfError('generic', `Source ${sourceId} is not a PDF`)
  try {
    const doc = await PDFDocument.load(ref.bytes, {
      password: ref.password,
      updateMetadata: false,
    })
    cache.set(sourceId, doc)
    return doc
  } catch (err) {
    throw classifyError(err)
  }
}

/**
 * Assembles a fresh PDFDocument from page descriptors by copying source pages in
 * order and applying rotation + crop. Pages from the same source are copied in a
 * single copyPages() call (dedups shared resources); duplicates are handled by
 * repeating indices. The loaded originals are never mutated.
 */
export async function assembleDocument(
  descriptors: PageDescriptor[],
  ctx: BuildContext,
): Promise<PDFDocument> {
  const out = await PDFDocument.create()
  const docCache = new Map<string, PDFDocument>()

  // Per-source ordered index lists (following global descriptor order).
  const perSource = new Map<string, number[]>()
  for (const pd of descriptors) {
    const arr = perSource.get(pd.sourceId)
    if (arr) arr.push(pd.srcIndex)
    else perSource.set(pd.sourceId, [pd.srcIndex])
  }

  // Copy each source's needed pages in one call; keep the resulting queue.
  const queues = new Map<string, { pages: PDFPage[]; ptr: number }>()
  for (const [sid, indices] of perSource) {
    const srcDoc = await loadSource(docCache, ctx.sources, sid)
    const copied = await out.copyPages(srcDoc, indices)
    queues.set(sid, { pages: copied, ptr: 0 })
  }

  for (const pd of descriptors) {
    const q = queues.get(pd.sourceId)
    if (!q) continue
    const page = q.pages[q.ptr++]
    page.setRotation(degrees(pd.rotation))
    if (pd.crop) page.setCropBox(pd.crop.x, pd.crop.y, pd.crop.width, pd.crop.height)
    out.addPage(page)
    if (ctx.bakePage) await ctx.bakePage(out, page, pd.id)
  }

  return out
}

function applyMetadata(out: PDFDocument, meta: Metadata): void {
  out.setTitle(meta.title ?? '')
  out.setAuthor(meta.author ?? '')
  out.setSubject(meta.subject ?? '')
  const keywords = (meta.keywords ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
  out.setKeywords(keywords)
  out.setProducer('pedift')
}

/** Build the full edited document from the current state into PDF bytes. */
export async function buildPdf(state: DocState, ctx: BuildContext): Promise<Uint8Array> {
  try {
    const out = await assembleDocument(state.pages, ctx)
    applyMetadata(out, state.metadata)
    if (ctx.finalize) await ctx.finalize(out, state)
    if (state.protect) {
      out.encrypt({
        userPassword: state.protect.userPassword,
        ownerPassword: state.protect.ownerPassword ?? state.protect.userPassword,
      })
    }
    return await out.save()
  } catch (err) {
    if (err instanceof PdfError) throw err
    throw new PdfError('save-failed', 'Could not build the PDF', err)
  }
}

/** Build a new PDF from a subset of descriptors (Extract feature). */
export async function buildSubset(
  descriptors: PageDescriptor[],
  ctx: BuildContext,
): Promise<Uint8Array> {
  try {
    const out = await assembleDocument(descriptors, ctx)
    out.setProducer('pedift')
    return await out.save()
  } catch (err) {
    if (err instanceof PdfError) throw err
    throw new PdfError('save-failed', 'Could not extract pages', err)
  }
}

/** Build multiple PDFs from groups of descriptors (Split feature). */
export async function buildSplit(
  groups: PageDescriptor[][],
  ctx: BuildContext,
): Promise<Uint8Array[]> {
  const out: Uint8Array[] = []
  for (const group of groups) {
    out.push(await buildSubset(group, ctx))
  }
  return out
}
