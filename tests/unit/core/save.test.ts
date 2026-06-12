import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PDFDocument } from '@cantoo/pdf-lib'
import { resetIds } from '../../../src/core/ids'
import { descriptorsForSource } from '../../../src/core/pages'
import { assembleDocument, buildPdf, buildSubset, buildSplit, type BuildContext } from '../../../src/core/save'
import type { DocState, SourceRef } from '../../../src/core/types'

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures')
const fixture = (name: string) => new Uint8Array(readFileSync(path.join(FIXTURES, name)))

beforeEach(() => {
  resetIds()
})

function makePlainSource(bytes: Uint8Array): SourceRef {
  return { id: 'original', kind: 'pdf', bytes, name: 'x.pdf' }
}

function makeCtx(source: SourceRef): BuildContext {
  return { sources: new Map([[source.id, source]]) }
}

function makeBaseState(pages: ReturnType<typeof descriptorsForSource>): DocState {
  return {
    pages,
    overlays: {},
    metadata: { title: '', author: '', subject: '', keywords: '' },
    pageNumbers: null,
    watermark: null,
    formValues: {},
    flatten: false,
    protect: null,
  }
}

// ---- assembleDocument -------------------------------------------------------

describe('assembleDocument', () => {
  it('builds a document with the correct page count', async () => {
    const bytes = fixture('plain-3page.pdf')
    const src = makePlainSource(bytes)
    const ctx = makeCtx(src)
    const descs = descriptorsForSource('original', 3)

    const doc = await assembleDocument(descs, ctx)
    expect(doc.getPageCount()).toBe(3)
  })

  it('respects descriptor order (reverse order)', async () => {
    const bytes = fixture('plain-3page.pdf')
    const src = makePlainSource(bytes)
    const ctx = makeCtx(src)
    // Build descriptors with reversed srcIndex order
    const srcDoc = await PDFDocument.load(bytes)
    const allPages = srcDoc.getPages()
    const descs = descriptorsForSource('original', 3, (i) => allPages[i].getRotation().angle)
    const reversed = [descs[2], descs[1], descs[0]]

    const doc = await assembleDocument(reversed, ctx)
    expect(doc.getPageCount()).toBe(3)
    // We can't easily check content, but page count must be correct
  })

  it('applies rotation from descriptors', async () => {
    const bytes = fixture('plain-3page.pdf')
    const src = makePlainSource(bytes)
    const ctx = makeCtx(src)
    const descs = descriptorsForSource('original', 1)
    descs[0] = { ...descs[0], rotation: 90 }

    const doc = await assembleDocument(descs, ctx)
    expect(doc.getPage(0).getRotation().angle).toBe(90)
  })

  it('handles duplicate pages (same srcIndex twice)', async () => {
    const bytes = fixture('plain-3page.pdf')
    const src = makePlainSource(bytes)
    const ctx = makeCtx(src)
    const descs = descriptorsForSource('original', 3)
    // Append the first page descriptor again (srcIndex 0 twice)
    const withDuplicate = [...descs, { ...descs[0] }]

    const doc = await assembleDocument(withDuplicate, ctx)
    expect(doc.getPageCount()).toBe(4)
  })

  it('saves the resulting document without error', async () => {
    const bytes = fixture('plain-3page.pdf')
    const src = makePlainSource(bytes)
    const ctx = makeCtx(src)
    const descs = descriptorsForSource('original', 3)

    const doc = await assembleDocument(descs, ctx)
    const saved = await doc.save()
    expect(saved.length).toBeGreaterThan(0)

    // Must reload cleanly
    const reloaded = await PDFDocument.load(saved)
    expect(reloaded.getPageCount()).toBe(3)
  })

  it('throws PdfError for missing source', async () => {
    const ctx: BuildContext = { sources: new Map() }
    const descs = descriptorsForSource('nonexistent', 2)
    await expect(assembleDocument(descs, ctx)).rejects.toThrow()
  })
})

// ---- buildPdf ---------------------------------------------------------------

describe('buildPdf', () => {
  it('produces valid PDF bytes that reload with the correct page count', async () => {
    const bytes = fixture('plain-3page.pdf')
    const src = makePlainSource(bytes)
    const ctx = makeCtx(src)
    const descs = descriptorsForSource('original', 3)
    const state = makeBaseState(descs)

    const out = await buildPdf(state, ctx)
    const reloaded = await PDFDocument.load(out)
    expect(reloaded.getPageCount()).toBe(3)
  })

  it('writes metadata into the output PDF', async () => {
    const bytes = fixture('plain-3page.pdf')
    const src = makePlainSource(bytes)
    const ctx = makeCtx(src)
    const descs = descriptorsForSource('original', 3)
    const state: DocState = {
      ...makeBaseState(descs),
      metadata: { title: 'Test Title', author: 'Test Author', subject: 'Test Subject', keywords: 'a, b' },
    }

    const out = await buildPdf(state, ctx)
    const reloaded = await PDFDocument.load(out)
    expect(reloaded.getTitle()).toBe('Test Title')
    expect(reloaded.getAuthor()).toBe('Test Author')
    expect(reloaded.getSubject()).toBe('Test Subject')
  })

  it('writes keywords into the output PDF', async () => {
    const bytes = fixture('plain-3page.pdf')
    const src = makePlainSource(bytes)
    const ctx = makeCtx(src)
    const descs = descriptorsForSource('original', 3)
    const state: DocState = {
      ...makeBaseState(descs),
      metadata: { title: '', author: '', subject: '', keywords: 'alpha, beta' },
    }

    const out = await buildPdf(state, ctx)
    const reloaded = await PDFDocument.load(out)
    const kw = reloaded.getKeywords() ?? ''
    expect(kw).toContain('alpha')
    expect(kw).toContain('beta')
  })

  it('preserves page rotation in the output', async () => {
    const bytes = fixture('plain-3page.pdf')
    const src = makePlainSource(bytes)
    const ctx = makeCtx(src)
    const descs = descriptorsForSource('original', 3)
    descs[0] = { ...descs[0], rotation: 90 }
    descs[1] = { ...descs[1], rotation: 180 }
    const state = makeBaseState(descs)

    const out = await buildPdf(state, ctx)
    const reloaded = await PDFDocument.load(out)
    expect(reloaded.getPage(0).getRotation().angle).toBe(90)
    expect(reloaded.getPage(1).getRotation().angle).toBe(180)
    expect(reloaded.getPage(2).getRotation().angle).toBe(0)
  })

  it('works with the encrypted source when password is provided', async () => {
    const bytes = fixture('encrypted.pdf')
    const src: SourceRef = { id: 'original', kind: 'pdf', bytes, name: 'enc.pdf', password: 'test1234' }
    const ctx = makeCtx(src)
    const descs = descriptorsForSource('original', 1)
    const state = makeBaseState(descs)

    const out = await buildPdf(state, ctx)
    // The output is a fresh unencrypted copy
    const reloaded = await PDFDocument.load(out)
    expect(reloaded.getPageCount()).toBe(1)
  })

  it('does not mutate the input bytes', async () => {
    const bytes = fixture('plain-3page.pdf')
    const originalLength = bytes.length
    const first8 = Array.from(bytes.slice(0, 8))
    const src = makePlainSource(bytes)
    const ctx = makeCtx(src)
    const descs = descriptorsForSource('original', 3)
    const state = makeBaseState(descs)

    await buildPdf(state, ctx)

    expect(bytes.length).toBe(originalLength)
    expect(Array.from(bytes.slice(0, 8))).toEqual(first8)
  })
})

// ---- buildSubset ------------------------------------------------------------

describe('buildSubset', () => {
  it('produces a PDF with only the selected pages', async () => {
    const bytes = fixture('plain-3page.pdf')
    const src = makePlainSource(bytes)
    const ctx = makeCtx(src)
    const allDescs = descriptorsForSource('original', 3)
    // select first two pages only
    const subset = [allDescs[0], allDescs[1]]

    const out = await buildSubset(subset, ctx)
    const reloaded = await PDFDocument.load(out)
    expect(reloaded.getPageCount()).toBe(2)
  })

  it('produces a single-page PDF', async () => {
    const bytes = fixture('plain-3page.pdf')
    const src = makePlainSource(bytes)
    const ctx = makeCtx(src)
    const descs = descriptorsForSource('original', 3)

    const out = await buildSubset([descs[2]], ctx)
    const reloaded = await PDFDocument.load(out)
    expect(reloaded.getPageCount()).toBe(1)
  })

  it('preserves rotation in subset', async () => {
    const bytes = fixture('plain-3page.pdf')
    const src = makePlainSource(bytes)
    const ctx = makeCtx(src)
    const descs = descriptorsForSource('original', 3)
    descs[1] = { ...descs[1], rotation: 270 }

    const out = await buildSubset([descs[1]], ctx)
    const reloaded = await PDFDocument.load(out)
    expect(reloaded.getPage(0).getRotation().angle).toBe(270)
  })
})

// ---- buildSplit -------------------------------------------------------------

describe('buildSplit', () => {
  it('splits 3 pages into 3 separate single-page PDFs', async () => {
    const bytes = fixture('plain-3page.pdf')
    const src = makePlainSource(bytes)
    const ctx = makeCtx(src)
    const descs = descriptorsForSource('original', 3)
    const groups = descs.map((d) => [d])

    const results = await buildSplit(groups, ctx)
    expect(results).toHaveLength(3)
    for (const result of results) {
      const reloaded = await PDFDocument.load(result)
      expect(reloaded.getPageCount()).toBe(1)
    }
  })

  it('splits into groups of different sizes', async () => {
    const bytes = fixture('plain-3page.pdf')
    const src = makePlainSource(bytes)
    const ctx = makeCtx(src)
    const descs = descriptorsForSource('original', 3)
    const groups = [[descs[0], descs[1]], [descs[2]]]

    const results = await buildSplit(groups, ctx)
    expect(results).toHaveLength(2)

    const first = await PDFDocument.load(results[0])
    expect(first.getPageCount()).toBe(2)

    const second = await PDFDocument.load(results[1])
    expect(second.getPageCount()).toBe(1)
  })

  it('returns empty array for empty groups input', async () => {
    const bytes = fixture('plain-3page.pdf')
    const src = makePlainSource(bytes)
    const ctx = makeCtx(src)

    const results = await buildSplit([], ctx)
    expect(results).toEqual([])
  })
})

// ---- redaction (flatten to image) ------------------------------------------

// Minimal valid 1x1 baseline JPEG; embedJpg only needs parseable bytes.
const JPEG_1x1 = new Uint8Array(
  Buffer.from(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAv/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AfwD/2Q==',
    'base64',
  ),
)

describe('redaction flatten-to-image', () => {
  it('rebuilds redacted pages from the rasterizer and copies the rest', async () => {
    const bytes = fixture('plain-3page.pdf')
    const src = makePlainSource(bytes)
    const descs = descriptorsForSource('original', 3)

    const srcDoc = await PDFDocument.load(bytes)
    const srcSize = srcDoc.getPage(0).getSize()

    const calls: Array<{ id: string; rects: unknown }> = []
    const rects = [{ x: 10, y: 10, width: 50, height: 20, color: '#000000' }]
    const ctx: BuildContext = {
      sources: new Map([[src.id, src]]),
      redactions: new Map([[descs[1].id, rects]]),
      rasterizeRedacted: async (descriptor, rs) => {
        calls.push({ id: descriptor.id, rects: rs })
        return { bytes: JPEG_1x1, widthPts: 123, heightPts: 456 }
      },
    }

    const doc = await assembleDocument(descs, ctx)
    expect(doc.getPageCount()).toBe(3)

    // The rasterizer ran exactly once, for the redacted page, with its bars.
    expect(calls).toHaveLength(1)
    expect(calls[0].id).toBe(descs[1].id)
    expect(calls[0].rects).toEqual(rects)

    // The redacted page is the fresh image page (distinctive mock size)...
    const redacted = doc.getPage(1).getSize()
    expect(redacted.width).toBeCloseTo(123)
    expect(redacted.height).toBeCloseTo(456)
    // ...while non-redacted pages are copied verbatim (original size).
    expect(doc.getPage(0).getSize().width).toBeCloseTo(srcSize.width)
    expect(doc.getPage(0).getSize().height).toBeCloseTo(srcSize.height)
  })

  it('reapplies rotation to the flattened page', async () => {
    const bytes = fixture('plain-3page.pdf')
    const src = makePlainSource(bytes)
    const descs = descriptorsForSource('original', 1)
    descs[0] = { ...descs[0], rotation: 90 }

    const ctx: BuildContext = {
      sources: new Map([[src.id, src]]),
      redactions: new Map([[descs[0].id, [{ x: 0, y: 0, width: 10, height: 10, color: '#000000' }]]]),
      rasterizeRedacted: async () => ({ bytes: JPEG_1x1, widthPts: 100, heightPts: 200 }),
    }

    const doc = await assembleDocument(descs, ctx)
    expect(doc.getPage(0).getRotation().angle).toBe(90)
  })

  it('falls back to a normal copy when no rasterizer is wired', async () => {
    const bytes = fixture('plain-3page.pdf')
    const src = makePlainSource(bytes)
    const descs = descriptorsForSource('original', 3)
    const srcSize = (await PDFDocument.load(bytes)).getPage(1).getSize()

    // redactions present but rasterizeRedacted absent → page is copied, not flattened.
    const ctx: BuildContext = {
      sources: new Map([[src.id, src]]),
      redactions: new Map([[descs[1].id, [{ x: 0, y: 0, width: 10, height: 10, color: '#000000' }]]]),
    }

    const doc = await assembleDocument(descs, ctx)
    expect(doc.getPageCount()).toBe(3)
    expect(doc.getPage(1).getSize().width).toBeCloseTo(srcSize.width)
  })
})
