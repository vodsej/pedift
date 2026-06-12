import { createOCREngine } from 'tesseract-wasm'
import type { OCREngine, ProgressListener } from 'tesseract-wasm'
import { getWasmBytes, getEngTrainedData, getCesTrainedData, getFontBytes } from '@ocr/assets'
import type { PageDescriptor, OcrPageData, OcrWord } from '../core/types'
import type { RenderRegistry } from '../render/registry'
import { renderDescriptorToCanvas } from '../render/exportImage'

export type OcrLang = 'eng' | 'ces'

/** Render scale used for OCR rasterisation (≈216 dpi). Higher → better accuracy, slower. */
const RENDER_SCALE = 3

/**
 * Minimum confidence threshold for word inclusion (0..1).
 * Words below this are treated as noise and dropped from the result.
 * Tune upward to reduce junk; tune downward if valid text is missing.
 */
const MIN_CONFIDENCE = 0.3

/** Per-session engine cache keyed by language. Engines are expensive to initialise. */
const engineCache = new Map<OcrLang, Promise<OCREngine>>()

function getEngine(lang: OcrLang): Promise<OCREngine> {
  const cached = engineCache.get(lang)
  if (cached) return cached

  const p = getWasmBytes()
    .then((wasmBinary) => createOCREngine({ wasmBinary }))
    .then(async (engine) => {
      const modelBytes = lang === 'ces' ? await getCesTrainedData() : await getEngTrainedData()
      engine.loadModel(modelBytes)
      return engine
    })

  engineCache.set(lang, p)
  return p
}

/**
 * Run OCR on a single page and return word bounding boxes in image-px space
 * over the rotated raster, plus the metadata needed by the bake phase.
 */
export async function recognizePage(
  registry: RenderRegistry,
  descriptor: PageDescriptor,
  lang: OcrLang,
  onProgress?: ProgressListener,
): Promise<OcrPageData> {
  const canvas = await renderDescriptorToCanvas(registry, descriptor, RENDER_SCALE)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2d context not available')
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

  // Capture unrotated page dims before touching the engine.
  const doc = await registry.get(descriptor.sourceId)
  const page = await doc.getPage(descriptor.srcIndex + 1)
  const unrotatedVp = page.getViewport({ scale: 1, rotation: 0 })

  const engine = await getEngine(lang)
  engine.loadImage(imageData)
  let items
  try {
    items = engine.getTextBoxes('word', onProgress)
  } finally {
    engine.clearImage()
  }

  const words: OcrWord[] = []
  for (const item of items) {
    if (!item.text.trim() || item.confidence < MIN_CONFIDENCE) continue
    const { left, top, right, bottom } = item.rect
    words.push({ text: item.text, x: left, y: top, w: right - left, h: bottom - top })
  }

  return {
    words,
    scale: RENDER_SCALE,
    rotation: descriptor.rotation,
    pageWidthPts: unrotatedVp.width,
    pageHeightPts: unrotatedVp.height,
  }
}

/**
 * Returns true when the page has no selectable text, i.e. it is a scanned image
 * and OCR would be useful.
 */
export async function isScannedPage(
  registry: RenderRegistry,
  descriptor: PageDescriptor,
): Promise<boolean> {
  const doc = await registry.get(descriptor.sourceId)
  const page = await doc.getPage(descriptor.srcIndex + 1)
  const content = await page.getTextContent()
  return (
    content.items.filter((i) => 'str' in i && typeof (i as { str: unknown }).str === 'string' && (i as { str: string }).str.trim()).length === 0
  )
}

/** Returns the embedded OCR font bytes for use in the save pipeline. */
export function getOcrFont(): Promise<Uint8Array> {
  return getFontBytes()
}
