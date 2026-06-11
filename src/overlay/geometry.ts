import type { Rotation, CropBox } from '../core/types'

// Maps between the on-screen overlay (CSS px, top-left origin, over the *rotated*
// displayed page) and PDF user space (points, bottom-left origin, *unrotated*
// page). Overlay objects are stored in unrotated PDF space so baking is a direct
// pdf-lib draw; the page's /Rotate then rotates baked content together with the
// page content, keeping everything aligned.

export interface PageGeometry {
  /** Unrotated page (MediaBox) size in points. */
  pageWidthPts: number
  pageHeightPts: number
  rotation: Rotation
  /** Rendered width of the (rotated) page on screen, in CSS px. */
  displayWidthCss: number
}

export interface ViewPoint {
  x: number
  y: number
}
export interface ViewRect {
  x: number
  y: number
  width: number
  height: number
}

/** Size of the page after applying display rotation, in points. */
export function rotatedSizePts(g: PageGeometry): { w: number; h: number } {
  return g.rotation === 90 || g.rotation === 270
    ? { w: g.pageHeightPts, h: g.pageWidthPts }
    : { w: g.pageWidthPts, h: g.pageHeightPts }
}

/** CSS px per point (uniform). */
export function cssScale(g: PageGeometry): number {
  return g.displayWidthCss / rotatedSizePts(g).w
}

export function displayHeightCss(g: PageGeometry): number {
  return rotatedSizePts(g).h * cssScale(g)
}

export function cssToPts(g: PageGeometry, lenCss: number): number {
  return lenCss / cssScale(g)
}
export function ptsToCss(g: PageGeometry, lenPts: number): number {
  return lenPts * cssScale(g)
}

/** PDF point (unrotated, bottom-left) → screen CSS px (top-left over rotated page). */
export function pdfToView(g: PageGeometry, ux: number, uy: number): ViewPoint {
  const W = g.pageWidthPts
  const H = g.pageHeightPts
  // To top-left, y-down image coords of the unrotated page:
  const xTl = ux
  const yTl = H - uy
  let xd: number
  let yd: number
  switch (g.rotation) {
    case 90:
      xd = H - yTl
      yd = xTl
      break
    case 180:
      xd = W - xTl
      yd = H - yTl
      break
    case 270:
      xd = yTl
      yd = W - xTl
      break
    default:
      xd = xTl
      yd = yTl
  }
  const s = cssScale(g)
  return { x: xd * s, y: yd * s }
}

/** Screen CSS px (top-left over rotated page) → PDF point (unrotated, bottom-left). */
export function viewToPdf(g: PageGeometry, cssX: number, cssY: number): ViewPoint {
  const W = g.pageWidthPts
  const H = g.pageHeightPts
  const s = cssScale(g)
  const xd = cssX / s
  const yd = cssY / s
  let xTl: number
  let yTl: number
  switch (g.rotation) {
    case 90:
      xTl = yd
      yTl = H - xd
      break
    case 180:
      xTl = W - xd
      yTl = H - yd
      break
    case 270:
      xTl = W - yd
      yTl = xd
      break
    default:
      xTl = xd
      yTl = yd
  }
  return { x: xTl, y: H - yTl }
}

/** Screen rect → PDF rect (axis-aligned; 90° rotations keep rects axis-aligned). */
export function rectViewToPdf(g: PageGeometry, r: ViewRect): CropBox {
  const a = viewToPdf(g, r.x, r.y)
  const b = viewToPdf(g, r.x + r.width, r.y + r.height)
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  }
}

/** PDF rect → screen rect. */
export function rectPdfToView(g: PageGeometry, r: CropBox): ViewRect {
  const a = pdfToView(g, r.x, r.y)
  const b = pdfToView(g, r.x + r.width, r.y + r.height)
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  }
}
