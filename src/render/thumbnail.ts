import type { PDFPageProxy } from 'pdfjs-dist'

// Cheap, low-resolution page render for the thumbnail sidebar.
// `rotation` is absolute; omit (undefined) to use the page's own rotation.
export async function renderThumbnail(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  thumbWidth: number,
  rotation?: number,
): Promise<void> {
  const rot =
    rotation == null ? (page.rotate ?? 0) : (((rotation % 360) + 360) % 360)
  const base = page.getViewport({ scale: 1, rotation: rot })
  const scale = thumbWidth / base.width
  const viewport = page.getViewport({ scale, rotation: rot })

  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.render({ canvasContext: ctx, viewport, background: '#ffffff' } as any).promise
}
