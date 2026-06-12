import type { PageDescriptor } from '../core/types'
import type { RedactRect } from '../core/save'
import type { RenderRegistry } from './registry'
import { canvasToBlob } from './exportImage'

// True redaction: any page carrying a redaction mark is re-rendered to a raster
// with solid bars painted over the redacted regions and rebuilt as a single
// image page (see assembleDocument in src/core/save.ts). The original page's
// text/image content is never copied into the output, so it is provably gone —
// not merely covered.
//
// The page is rendered UNROTATED so redaction rects (stored in unrotated PDF
// points, bottom-left origin — see src/overlay/geometry.ts) map to canvas
// pixels with a trivial scale + Y-flip, no rotation math. The save pipeline then
// re-applies /Rotate and the crop box to the fresh image page exactly as it
// would to a normal page, so the flattened page behaves identically.

const RENDER_SCALE = 2 // ~144 dpi: balances legibility against file size
const JPEG_QUALITY = 0.92

/** Renders a page unrotated, paints solid bars over the redacted rects, and
 *  returns JPEG bytes plus the unrotated page size in points. */
export async function rasterizeRedactedPage(
  registry: RenderRegistry,
  descriptor: PageDescriptor,
  rects: RedactRect[],
  scale = RENDER_SCALE,
): Promise<{ bytes: Uint8Array; widthPts: number; heightPts: number }> {
  const doc = await registry.get(descriptor.sourceId)
  const page = await doc.getPage(descriptor.srcIndex + 1)
  const viewport = page.getViewport({ scale, rotation: 0 })
  const heightPts = viewport.height / scale
  const widthPts = viewport.width / scale

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not available')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.render({ canvasContext: ctx, viewport, background: '#ffffff' } as any).promise

  // Paint the bars. Unrotated PDF points (bottom-left) -> device px (top-left).
  for (const r of rects) {
    ctx.fillStyle = r.color || '#000000'
    ctx.fillRect(r.x * scale, (heightPts - r.y - r.height) * scale, r.width * scale, r.height * scale)
  }

  try {
    await page.cleanup()
  } catch {
    /* ignore */
  }

  const blob = await canvasToBlob(canvas, 'jpg', JPEG_QUALITY)
  const bytes = new Uint8Array(await blob.arrayBuffer())
  return { bytes, widthPts, heightPts }
}
