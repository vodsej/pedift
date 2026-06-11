import type { PDFPageProxy } from 'pdfjs-dist'

// Cheap, low-resolution page render for the thumbnail sidebar.
export async function renderThumbnail(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  thumbWidth: number,
  extraRotation = 0,
): Promise<void> {
  const rotation = (((page.rotate ?? 0) + extraRotation) % 360 + 360) % 360
  const base = page.getViewport({ scale: 1, rotation })
  const scale = thumbWidth / base.width
  const viewport = page.getViewport({ scale, rotation })

  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.render({ canvasContext: ctx, viewport, background: '#ffffff' } as any).promise
}
