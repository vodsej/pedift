import type { PDFPageProxy, RenderTask } from 'pdfjs-dist'
import type { PageViewport } from 'pdfjs-dist/types/src/display/page_viewport'

export interface RenderOptions {
  /** Target on-screen CSS width in px. Height follows the aspect ratio. */
  cssWidth: number
  /** Absolute viewport rotation in degrees. Omit to use the page's own rotation. */
  rotation?: number
  /** Device pixel ratio override (defaults to window.devicePixelRatio). */
  dpr?: number
  /** Fill the canvas white before drawing (PDFs may be transparent). */
  background?: string
}

export interface RenderResult {
  viewport: PageViewport
  cssWidth: number
  cssHeight: number
  dpr: number
}

export interface RenderHandle {
  /** Resolves with the result, or null if the render was cancelled. */
  promise: Promise<RenderResult | null>
  cancel: () => void
}

/**
 * Renders a page to a canvas at the requested CSS width with crisp DPR scaling.
 * Sizes the canvas synchronously, then starts an async render that can be
 * cancelled (important when the user zooms quickly).
 */
export function renderPageToCanvas(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  opts: RenderOptions,
): RenderHandle {
  const dpr = opts.dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
  // rotation is absolute (overrides the page's own); omit to use the page default.
  const rotation = opts.rotation == null ? (page.rotate ?? 0) : normalizeRotation(opts.rotation)

  const base = page.getViewport({ scale: 1, rotation })
  const scale = (opts.cssWidth / base.width) * dpr
  const viewport = page.getViewport({ scale, rotation })

  const cssWidth = Math.floor(viewport.width / dpr)
  const cssHeight = Math.floor(viewport.height / dpr)

  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))
  canvas.style.width = `${cssWidth}px`
  canvas.style.height = `${cssHeight}px`

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return { promise: Promise.resolve(null), cancel: () => {} }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: any = { canvasContext: ctx, viewport }
  if (opts.background) params.background = opts.background
  const task: RenderTask = page.render(params)

  const promise = task.promise.then(
    (): RenderResult => ({ viewport, cssWidth, cssHeight, dpr }),
    (err: unknown): null => {
      if ((err as { name?: string })?.name === 'RenderingCancelledException') return null
      throw err
    },
  )

  return { promise, cancel: () => task.cancel() }
}

export function normalizeRotation(deg: number): number {
  return ((Math.round(deg / 90) * 90) % 360 + 360) % 360
}
