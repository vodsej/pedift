import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resetIds } from '../../../src/core/ids'
import { EditorDocument } from '../../../src/core/document'
import { imagePointToPdf, ocrWordToPdfRect } from '../../../src/core/ocr'
import type { OcrPageData, OcrWord } from '../../../src/core/types'

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures')
const fixture = (name: string) => new Uint8Array(readFileSync(path.join(FIXTURES, name)))

const DEJAVU_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../src/ocr/vendor/raw/DejaVuSans.ttf',
)
const WORKER_SRC = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
)

beforeEach(() => {
  resetIds()
})

/** Extract all text from PDF bytes using pdfjs-dist legacy in Node. */
async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = `file://${WORKER_SRC}`
  const task = pdfjs.getDocument({
    data: bytes.slice(),
    useWorkerFetch: false,
    useSystemFonts: false,
  })
  const doc = await task.promise
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const pg = await doc.getPage(i)
    const content = await pg.getTextContent()
    text += content.items.map((it) => ('str' in it ? it.str : '')).join(' ')
  }
  return text
}

/**
 * Search saved PDF bytes for the invisible-text operator "3 Tr".
 * Content streams may be Flate-compressed, so we try to inflate every
 * stream...endstream block. If raw bytes don't contain the needle, inflate
 * each stream and search the inflated content.
 */
function containsInvisibleTextOperator(bytes: Uint8Array): boolean {
  const needle = '3 Tr'
  const buf = Buffer.from(bytes)

  // First check the raw bytes
  if (buf.toString('latin1').includes(needle)) return true

  // Try to inflate every stream...endstream block (whether FlateDecode or not)
  const markers: [Buffer, number][] = [
    [Buffer.from('stream\r\n'), 8],
    [Buffer.from('stream\n'), 7],
  ]
  for (const [marker, markerLen] of markers) {
    let pos = 0
    while (pos < buf.length) {
      const si = buf.indexOf(marker, pos)
      if (si === -1) break
      const dataStart = si + markerLen
      const endMark = buf.indexOf(Buffer.from('endstream'), dataStart)
      if (endMark !== -1 && endMark - dataStart < 10_000_000) {
        try {
          const inflated = inflateSync(buf.subarray(dataStart, endMark))
          if (inflated.toString('latin1').includes(needle)) return true
        } catch {
          // Not a deflate stream — skip
        }
      }
      pos = si + 1
    }
  }

  return false
}

// ─── 1. Transform correctness: all 4 rotations ────────────────────────────────

describe('imagePointToPdf', () => {
  // Page: W=600, H=800 pts, scale=2
  // Word box: image (x=100, y=50, w=80, h=20)
  // Corners in rotated-page pixels: TL=(100,50), BR=(180,70)
  // Divide by scale=2 to get rotated-page points: TL=(50,25), BR=(90,35)

  it('rotation=0: maps image pixels to unrotated PDF bottom-left coords', () => {
    // rotation=0: xTl=rx, yTl=ry → pdf (xTl, H-yTl)
    // TL=(50,25) → pdf (50, 800-25=775)
    // BR=(90,35) → pdf (90, 800-35=765)
    const a = imagePointToPdf(100, 50, 2, 0, 600, 800)
    expect(a.x).toBeCloseTo(50)
    expect(a.y).toBeCloseTo(775)

    const b = imagePointToPdf(180, 70, 2, 0, 600, 800)
    expect(b.x).toBeCloseTo(90)
    expect(b.y).toBeCloseTo(765)
  })

  it('rotation=90: maps correctly (raster rotated 90° CW from unrotated)', () => {
    // rotation=90: xTl=ry, yTl=H-rx → pdf (xTl, H-yTl)
    // TL: rx=50,ry=25 → xTl=25, yTl=800-50=750 → pdf (25, 800-750=50)
    // BR: rx=90,ry=35 → xTl=35, yTl=800-90=710 → pdf (35, 800-710=90)
    const a = imagePointToPdf(100, 50, 2, 90, 600, 800)
    expect(a.x).toBeCloseTo(25)
    expect(a.y).toBeCloseTo(50)

    const b = imagePointToPdf(180, 70, 2, 90, 600, 800)
    expect(b.x).toBeCloseTo(35)
    expect(b.y).toBeCloseTo(90)
  })

  it('rotation=180: maps correctly (raster rotated 180°)', () => {
    // rotation=180: xTl=W-rx, yTl=H-ry → pdf (xTl, H-yTl)
    // TL: rx=50,ry=25 → xTl=600-50=550, yTl=800-25=775 → pdf (550, 800-775=25)
    // BR: rx=90,ry=35 → xTl=600-90=510, yTl=800-35=765 → pdf (510, 800-765=35)
    const a = imagePointToPdf(100, 50, 2, 180, 600, 800)
    expect(a.x).toBeCloseTo(550)
    expect(a.y).toBeCloseTo(25)

    const b = imagePointToPdf(180, 70, 2, 180, 600, 800)
    expect(b.x).toBeCloseTo(510)
    expect(b.y).toBeCloseTo(35)
  })

  it('rotation=270: maps correctly (raster rotated 270° CW / 90° CCW)', () => {
    // rotation=270: xTl=W-ry, yTl=rx → pdf (xTl, H-yTl)
    // TL: rx=50,ry=25 → xTl=600-25=575, yTl=50 → pdf (575, 800-50=750)
    // BR: rx=90,ry=35 → xTl=600-35=565, yTl=90 → pdf (565, 800-90=710)
    const a = imagePointToPdf(100, 50, 2, 270, 600, 800)
    expect(a.x).toBeCloseTo(575)
    expect(a.y).toBeCloseTo(750)

    const b = imagePointToPdf(180, 70, 2, 270, 600, 800)
    expect(b.x).toBeCloseTo(565)
    expect(b.y).toBeCloseTo(710)
  })
})

describe('ocrWordToPdfRect', () => {
  it('rotation=0: correct bounding rect', () => {
    const word: OcrWord = { text: 'hi', x: 100, y: 50, w: 80, h: 20 }
    const page: OcrPageData = { words: [word], scale: 2, rotation: 0, pageWidthPts: 600, pageHeightPts: 800 }
    const rect = ocrWordToPdfRect(word, page)
    // TL pdf (50,775), BR pdf (90,765) → {x:50,y:765,width:40,height:10}
    expect(rect.x).toBeCloseTo(50)
    expect(rect.y).toBeCloseTo(765)
    expect(rect.width).toBeCloseTo(40)
    expect(rect.height).toBeCloseTo(10)
  })

  it('rotation=90: correct bounding rect', () => {
    const word: OcrWord = { text: 'hi', x: 100, y: 50, w: 80, h: 20 }
    const page: OcrPageData = { words: [word], scale: 2, rotation: 90, pageWidthPts: 600, pageHeightPts: 800 }
    const rect = ocrWordToPdfRect(word, page)
    // TL pdf (25,50), BR pdf (35,90) → {x:25,y:50,width:10,height:40}
    expect(rect.x).toBeCloseTo(25)
    expect(rect.y).toBeCloseTo(50)
    expect(rect.width).toBeCloseTo(10)
    expect(rect.height).toBeCloseTo(40)
  })

  it('rotation=180: correct bounding rect', () => {
    const word: OcrWord = { text: 'hi', x: 100, y: 50, w: 80, h: 20 }
    const page: OcrPageData = { words: [word], scale: 2, rotation: 180, pageWidthPts: 600, pageHeightPts: 800 }
    const rect = ocrWordToPdfRect(word, page)
    // TL pdf (550,25), BR pdf (510,35) → {x:510,y:25,width:40,height:10}
    expect(rect.x).toBeCloseTo(510)
    expect(rect.y).toBeCloseTo(25)
    expect(rect.width).toBeCloseTo(40)
    expect(rect.height).toBeCloseTo(10)
  })

  it('rotation=270: correct bounding rect', () => {
    const word: OcrWord = { text: 'hi', x: 100, y: 50, w: 80, h: 20 }
    const page: OcrPageData = { words: [word], scale: 2, rotation: 270, pageWidthPts: 600, pageHeightPts: 800 }
    const rect = ocrWordToPdfRect(word, page)
    // TL pdf (575,750), BR pdf (565,710) → {x:565,y:710,width:10,height:40}
    expect(rect.x).toBeCloseTo(565)
    expect(rect.y).toBeCloseTo(710)
    expect(rect.width).toBeCloseTo(10)
    expect(rect.height).toBeCloseTo(40)
  })
})

// ─── 2. Round-trip / searchable text ─────────────────────────────────────────

describe('applyOcrLayer round-trip', () => {
  it('saved PDF contains the OCR token as extractable text', async () => {
    const bytes = fixture('plain-3page.pdf')
    const dejaVuBytes = new Uint8Array(readFileSync(DEJAVU_PATH))
    const doc = await EditorDocument.open(bytes, 'plain-3page.pdf')
    const firstPageId = doc.pages[0].id

    // Get page dimensions from the loaded pdf
    const { PDFDocument } = await import('@cantoo/pdf-lib')
    const srcDoc = await PDFDocument.load(bytes)
    const page0 = srcDoc.getPages()[0]
    const { width: pageWidthPts, height: pageHeightPts } = page0.getSize()

    const ocrData: OcrPageData = {
      words: [{ text: 'KUFRPENIZE', x: 100, y: 100, w: 300, h: 40 }],
      scale: 3,
      rotation: 0,
      pageWidthPts,
      pageHeightPts,
    }

    doc.setOcrData({ [firstPageId]: ocrData }, dejaVuBytes)
    const saved = await doc.build()
    const text = await extractPdfText(saved)
    expect(text).toContain('KUFRPENIZE')
  }, 30_000)
})

// ─── 3. Render mode 3 (invisible text) ────────────────────────────────────────

describe('invisible text operator', () => {
  it('saved PDF contains the "3 Tr" text rendering mode operator', async () => {
    const bytes = fixture('plain-3page.pdf')
    const dejaVuBytes = new Uint8Array(readFileSync(DEJAVU_PATH))
    const doc = await EditorDocument.open(bytes, 'plain-3page.pdf')
    const firstPageId = doc.pages[0].id

    const { PDFDocument } = await import('@cantoo/pdf-lib')
    const srcDoc = await PDFDocument.load(bytes)
    const { width: pageWidthPts, height: pageHeightPts } = srcDoc.getPages()[0].getSize()

    const ocrData: OcrPageData = {
      words: [{ text: 'INVISWORD', x: 50, y: 50, w: 200, h: 30 }],
      scale: 2,
      rotation: 0,
      pageWidthPts,
      pageHeightPts,
    }

    doc.setOcrData({ [firstPageId]: ocrData }, dejaVuBytes)
    const saved = await doc.build()
    expect(containsInvisibleTextOperator(saved)).toBe(true)
  }, 30_000)
})

// ─── 4. Czech codepoints ──────────────────────────────────────────────────────

describe('Czech Unicode text', () => {
  it('embeds Czech characters correctly with DejaVu font', async () => {
    const bytes = fixture('plain-3page.pdf')
    const dejaVuBytes = new Uint8Array(readFileSync(DEJAVU_PATH))
    const doc = await EditorDocument.open(bytes, 'plain-3page.pdf')
    const firstPageId = doc.pages[0].id

    const { PDFDocument } = await import('@cantoo/pdf-lib')
    const srcDoc = await PDFDocument.load(bytes)
    const { width: pageWidthPts, height: pageHeightPts } = srcDoc.getPages()[0].getSize()

    const ocrData: OcrPageData = {
      words: [{ text: 'příliš', x: 50, y: 200, w: 150, h: 30 }],
      scale: 2,
      rotation: 0,
      pageWidthPts,
      pageHeightPts,
    }

    doc.setOcrData({ [firstPageId]: ocrData }, dejaVuBytes)
    const saved = await doc.build()
    const text = await extractPdfText(saved)
    expect(text).toContain('příliš')
  }, 30_000)
})

// ─── 5. Empty / no-op ─────────────────────────────────────────────────────────

describe('empty ocrData', () => {
  it('build succeeds and contains no injected token when ocrData is absent', async () => {
    const bytes = fixture('plain-3page.pdf')
    const doc = await EditorDocument.open(bytes, 'plain-3page.pdf')
    const saved = await doc.build()
    const text = await extractPdfText(saved)
    expect(text).not.toContain('KUFRPENIZE')
    expect(saved.length).toBeGreaterThan(0)
  }, 30_000)

  it('build succeeds when ocrData is an empty record', async () => {
    const bytes = fixture('plain-3page.pdf')
    const doc = await EditorDocument.open(bytes, 'plain-3page.pdf')
    // Directly call with empty ocrData via setOcrData
    doc.setOcrData({}, null)
    const saved = await doc.build()
    expect(saved.length).toBeGreaterThan(0)
  }, 30_000)
})
