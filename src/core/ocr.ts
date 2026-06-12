import { PDFDocument, StandardFonts, TextRenderingMode } from '@cantoo/pdf-lib'
import type { DocState, OcrPageData, OcrWord, Rotation } from './types'

/**
 * The fontkit instance pdf-lib needs to embed a custom (Unicode) font. It is
 * injected rather than imported here so `@pdf-lib/fontkit` (OCR-only, ~0.7 MB)
 * never enters the lean bundle via core's always-imported module graph.
 */
export type Fontkit = Parameters<PDFDocument['registerFontkit']>[0]

// Pure coordinate transforms (no DOM, no pdf-lib).

/**
 * Image-px point (top-left, over the rotated raster at `scale`) →
 * unrotated PDF point (bottom-left origin).
 *
 * This is the inverse of viewToPdf in src/overlay/geometry.ts, with
 * cssX = ix, cssY = iy, cssScale = scale (uniform, no display width).
 */
export function imagePointToPdf(
  ix: number,
  iy: number,
  scale: number,
  rotation: Rotation,
  pageWidthPts: number,
  pageHeightPts: number,
): { x: number; y: number } {
  const rx = ix / scale
  const ry = iy / scale
  const W = pageWidthPts
  const H = pageHeightPts
  let xTl: number
  let yTl: number
  switch (rotation) {
    case 90:
      xTl = ry
      yTl = H - rx
      break
    case 180:
      xTl = W - rx
      yTl = H - ry
      break
    case 270:
      xTl = W - ry
      yTl = rx
      break
    default:
      xTl = rx
      yTl = ry
  }
  return { x: xTl, y: H - yTl }
}

/**
 * Word box (image px) → unrotated PDF rect (bottom-left origin).
 * Maps the two diagonal corners and takes the axis-aligned bounding box,
 * mirroring rectViewToPdf in src/overlay/geometry.ts.
 */
export function ocrWordToPdfRect(
  word: OcrWord,
  page: OcrPageData,
): { x: number; y: number; width: number; height: number } {
  const a = imagePointToPdf(word.x, word.y, page.scale, page.rotation, page.pageWidthPts, page.pageHeightPts)
  const b = imagePointToPdf(
    word.x + word.w,
    word.y + word.h,
    page.scale,
    page.rotation,
    page.pageWidthPts,
    page.pageHeightPts,
  )
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  }
}

/**
 * Bake invisible OCR text into the output PDF document.
 * Called after page assembly and before watermark/page-numbers.
 */
export async function applyOcrLayer(
  out: PDFDocument,
  state: DocState,
  fontBytes: Uint8Array | null,
  fontkit: Fontkit | null,
): Promise<void> {
  const ocrData = state.ocrData
  if (!ocrData || Object.keys(ocrData).length === 0) return

  let font
  if (fontBytes && fontkit) {
    out.registerFontkit(fontkit)
    font = await out.embedFont(fontBytes, { subset: true })
  } else {
    font = await out.embedFont(StandardFonts.Helvetica)
  }

  const pages = out.getPages()
  for (let i = 0; i < pages.length; i++) {
    const pd = state.pages[i]
    const data = pd ? ocrData[pd.id] : undefined
    if (!data) continue
    for (const word of data.words) {
      if (!word.text.trim()) continue
      const rect = ocrWordToPdfRect(word, data)
      // Font size = displayed glyph height in points (rotation-independent)
      const size = word.h / data.scale
      if (size <= 0) continue
      try {
        pages[i].drawText(word.text, {
          x: rect.x,
          y: rect.y,
          size,
          font,
          renderMode: TextRenderingMode.Invisible,
        })
      } catch {
        // Helvetica fallback cannot encode non-WinAnsi chars (e.g. Czech diacritics).
        // Skip such words rather than aborting the whole save. The DejaVu font path
        // (fontBytes provided) covers Latin Extended, so this only affects the fallback.
      }
    }
  }
}
