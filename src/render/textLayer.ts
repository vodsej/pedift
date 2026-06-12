import { TextLayer, Util } from 'pdfjs-dist'
import type { PDFPageProxy } from 'pdfjs-dist'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import type { PageViewport } from 'pdfjs-dist/types/src/display/page_viewport'

// Builds a selectable text layer over a rendered page (for highlight + replace
// text), and exposes per-item bounding boxes in CSS-pixel space.

export interface TextItemBox {
  str: string
  /** CSS-pixel rect relative to the page's top-left. */
  x: number
  y: number
  width: number
  height: number
  /** Index into the page's text items (stable for the same getTextContent call). */
  index: number
}

export interface BuiltTextLayer {
  layer: TextLayer
  boxes: TextItemBox[]
}

/**
 * Renders the pdf.js text layer into `container` and returns item boxes.
 * `container` must be positioned over the canvas at the same CSS size.
 * `dpr` is the device-pixel-ratio used when the page was rendered (device px ÷ dpr = CSS px).
 */
export async function buildTextLayer(
  page: PDFPageProxy,
  viewport: PageViewport,
  container: HTMLElement,
  dpr: number,
): Promise<BuiltTextLayer> {
  container.replaceChildren()
  container.style.setProperty('--scale-factor', String(viewport.scale))

  const textContent = await page.getTextContent()
  const layer = new TextLayer({ textContentSource: textContent, container, viewport })
  await layer.render()

  const boxes: TextItemBox[] = []
  let index = 0
  for (const raw of textContent.items) {
    const item = raw as TextItem
    if (typeof item.str !== 'string') {
      index++
      continue // skip TextMarkedContent markers
    }
    const box = textItemToCssBox(item, viewport, dpr)
    if (box.width > 0 && box.height > 0) boxes.push({ ...box, str: item.str, index })
    index++
  }
  return { layer, boxes }
}

/**
 * Renders a *selectable* pdf.js text layer into `container` and returns the
 * layer (so the caller can `.cancel()` it on cleanup). This powers in-app text
 * selection/copy, so — unlike buildTextLayer — `viewport` must be at CSS-px
 * scale (`cssScale`, NOT ×dpr): the text layer is DOM measured in CSS px, while
 * only the canvas uses device px. The `.textLayer` CSS in overlay.css consumes
 * the `--total-scale-factor` set here to size/position the spans.
 */
export async function buildSelectableTextLayer(
  page: PDFPageProxy,
  viewport: PageViewport,
  container: HTMLElement,
): Promise<TextLayer> {
  container.replaceChildren()
  // CSS px per point; read by setLayerDimensions + the per-span font-size/transform.
  container.style.setProperty('--total-scale-factor', String(viewport.scale))
  container.style.setProperty('--scale-factor', String(viewport.scale))
  container.style.setProperty('--scale-round-x', '1px')
  container.style.setProperty('--scale-round-y', '1px')

  const textContent = await page.getTextContent()
  const layer = new TextLayer({ textContentSource: textContent, container, viewport })
  await layer.render()
  // setLayerDimensions sizes the container from the unrotated raw dims; override
  // with the rotated display size (viewport already carries the rotation) so
  // spans are never clipped on 90°/270° pages.
  container.style.width = `${viewport.width}px`
  container.style.height = `${viewport.height}px`
  return layer
}

/** Get text-item boxes (CSS px) for a page without rendering a DOM text layer. */
export async function getTextItemBoxes(
  page: PDFPageProxy,
  viewport: PageViewport,
  dpr: number,
): Promise<TextItemBox[]> {
  const textContent = await page.getTextContent()
  const boxes: TextItemBox[] = []
  let index = 0
  for (const raw of textContent.items) {
    const item = raw as TextItem
    if (typeof item.str !== 'string' || item.str.trim() === '') {
      index++
      continue
    }
    const box = textItemToCssBox(item, viewport, dpr)
    if (box.width > 0 && box.height > 0) boxes.push({ ...box, str: item.str, index })
    index++
  }
  return boxes
}

/** Map a text item to a CSS-pixel rect (top-left origin) over the page. */
export function textItemToCssBox(
  item: TextItem,
  viewport: PageViewport,
  dpr: number,
): { x: number; y: number; width: number; height: number } {
  // item.transform is in PDF user space (origin bottom-left). Util.transform
  // composes it with the viewport transform to get device-pixel coordinates.
  const tx = Util.transform(viewport.transform, item.transform)
  const fontHeight = Math.hypot(tx[2], tx[3]) // device px
  const devX = tx[4]
  const devY = tx[5] - fontHeight // baseline rises by the glyph height
  const devW = item.width * viewport.scale // item.width is text-space; scale to device px

  const toCss = 1 / dpr
  return {
    x: devX * toCss,
    y: devY * toCss,
    width: devW * toCss,
    height: fontHeight * toCss,
  }
}
