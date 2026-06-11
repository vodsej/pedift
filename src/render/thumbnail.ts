import type { PDFPageProxy, RenderTask } from 'pdfjs-dist'

export interface ThumbHandle {
  promise: Promise<void>
  cancel: () => void
}

// Cheap, low-resolution page render for the thumbnail sidebar. Returns a handle
// so the caller can cancel a stale render (e.g. when virtualized thumbs recycle).
// `rotation` is absolute; omit (undefined) to use the page's own rotation.
export function renderThumbnail(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  thumbWidth: number,
  rotation?: number,
): ThumbHandle {
  const rot = rotation == null ? (page.rotate ?? 0) : (((rotation % 360) + 360) % 360)
  const base = page.getViewport({ scale: 1, rotation: rot })
  const scale = thumbWidth / base.width
  const viewport = page.getViewport({ scale, rotation: rot })

  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))

  const ctx = canvas.getContext('2d')
  if (!ctx) return { promise: Promise.resolve(), cancel: () => {} }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const task: RenderTask = page.render({ canvasContext: ctx, viewport, background: '#ffffff' } as any)
  const promise = task.promise.then(
    () => {},
    (e: unknown) => {
      if ((e as { name?: string })?.name !== 'RenderingCancelledException') throw e
    },
  )
  return { promise, cancel: () => task.cancel() }
}
