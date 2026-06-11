import { describe, it, expect, beforeEach } from 'vitest'
import { PDFDocument } from '@cantoo/pdf-lib'
import { resetIds } from '../../../src/core/ids'
import { imagesToPdf, detectImageFormat } from '../../../src/core/imagesToPdf'

// 1x1 red PNG (base64)
const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC'
function makePng(): Uint8Array {
  return new Uint8Array(Buffer.from(PNG_BASE64, 'base64'))
}

beforeEach(() => {
  resetIds()
})

// ---- detectImageFormat ------------------------------------------------------

describe('detectImageFormat', () => {
  it('detects PNG from magic bytes', () => {
    const png = makePng()
    expect(detectImageFormat(png)).toBe('png')
  })

  it('returns jpg for non-PNG bytes', () => {
    // A minimal JPEG starts with FF D8 FF
    const jpgBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
    expect(detectImageFormat(jpgBytes)).toBe('jpg')
  })

  it('returns jpg for random bytes (default)', () => {
    const random = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09])
    expect(detectImageFormat(random)).toBe('jpg')
  })

  it('returns jpg for empty-ish bytes', () => {
    const tooShort = new Uint8Array([0x89, 0x50]) // PNG header incomplete
    expect(detectImageFormat(tooShort)).toBe('jpg')
  })
})

// ---- imagesToPdf -------------------------------------------------------

describe('imagesToPdf', () => {
  it('converts one PNG to a 1-page PDF', async () => {
    const png = makePng()
    const out = await imagesToPdf(
      [{ bytes: png, format: 'png' }],
      { pageSize: 'a4', orientation: 'portrait', margin: 20 },
    )
    const reloaded = await PDFDocument.load(out)
    expect(reloaded.getPageCount()).toBe(1)
  })

  it('A4 portrait page size is approximately 595x842 (±1)', async () => {
    const png = makePng()
    const out = await imagesToPdf(
      [{ bytes: png, format: 'png' }],
      { pageSize: 'a4', orientation: 'portrait', margin: 20 },
    )
    const reloaded = await PDFDocument.load(out)
    const page = reloaded.getPage(0)
    const { width, height } = page.getSize()
    expect(width).toBeCloseTo(595.28, 0)
    expect(height).toBeCloseTo(841.89, 0)
  })

  it('A4 landscape swaps width and height', async () => {
    const png = makePng()
    const out = await imagesToPdf(
      [{ bytes: png, format: 'png' }],
      { pageSize: 'a4', orientation: 'landscape', margin: 20 },
    )
    const reloaded = await PDFDocument.load(out)
    const page = reloaded.getPage(0)
    const { width, height } = page.getSize()
    // landscape: width should be ~841.89, height ~595.28
    expect(width).toBeCloseTo(841.89, 0)
    expect(height).toBeCloseTo(595.28, 0)
  })

  it("pageSize 'fit' produces a page matching the image size (1x1)", async () => {
    const png = makePng()
    const out = await imagesToPdf(
      [{ bytes: png, format: 'png' }],
      { pageSize: 'fit', orientation: 'portrait', margin: 0 },
    )
    const reloaded = await PDFDocument.load(out)
    const page = reloaded.getPage(0)
    const { width, height } = page.getSize()
    expect(width).toBeCloseTo(1, 0)
    expect(height).toBeCloseTo(1, 0)
  })

  it('two images -> 2 pages', async () => {
    const png = makePng()
    const out = await imagesToPdf(
      [{ bytes: png, format: 'png' }, { bytes: png, format: 'png' }],
      { pageSize: 'a4', orientation: 'portrait', margin: 0 },
    )
    const reloaded = await PDFDocument.load(out)
    expect(reloaded.getPageCount()).toBe(2)
  })

  it('three images -> 3 pages', async () => {
    const png = makePng()
    const out = await imagesToPdf(
      [
        { bytes: png, format: 'png' },
        { bytes: png, format: 'png' },
        { bytes: png, format: 'png' },
      ],
      { pageSize: 'a4', orientation: 'portrait', margin: 10 },
    )
    const reloaded = await PDFDocument.load(out)
    expect(reloaded.getPageCount()).toBe(3)
  })

  it('throws when images array is empty', async () => {
    await expect(
      imagesToPdf([], { pageSize: 'a4', orientation: 'portrait', margin: 0 }),
    ).rejects.toThrow()
  })

  it('letter page size is approximately 612x792 (±1)', async () => {
    const png = makePng()
    const out = await imagesToPdf(
      [{ bytes: png, format: 'png' }],
      { pageSize: 'letter', orientation: 'portrait', margin: 0 },
    )
    const reloaded = await PDFDocument.load(out)
    const page = reloaded.getPage(0)
    const { width, height } = page.getSize()
    expect(width).toBeCloseTo(612, 0)
    expect(height).toBeCloseTo(792, 0)
  })

  it('zero margin does not crash and produces a valid page', async () => {
    const png = makePng()
    const out = await imagesToPdf(
      [{ bytes: png, format: 'png' }],
      { pageSize: 'a4', orientation: 'portrait', margin: 0 },
    )
    const reloaded = await PDFDocument.load(out)
    expect(reloaded.getPageCount()).toBe(1)
  })

  it('produces a saveable PDF output', async () => {
    const png = makePng()
    const out = await imagesToPdf(
      [{ bytes: png, format: 'png' }],
      { pageSize: 'a4', orientation: 'portrait', margin: 0 },
    )
    expect(out.length).toBeGreaterThan(0)
    // Must be a valid PDF (starts with %PDF)
    const header = String.fromCharCode(...out.slice(0, 4))
    expect(header).toBe('%PDF')
  })
})
