import { describe, it, expect } from 'vitest'
import {
  pdfToView,
  viewToPdf,
  rectViewToPdf,
  rectPdfToView,
  rotatedSizePts,
  displayHeightCss,
  type PageGeometry,
} from '../../../src/overlay/geometry'

const ROTATIONS = [0, 90, 180, 270] as const

function geom(rotation: (typeof ROTATIONS)[number]): PageGeometry {
  return { pageWidthPts: 600, pageHeightPts: 800, rotation, displayWidthCss: 300 }
}

describe('overlay geometry', () => {
  it('round-trips view <-> pdf for all rotations', () => {
    for (const r of ROTATIONS) {
      const g = geom(r)
      const h = displayHeightCss(g)
      for (const [vx, vy] of [
        [0, 0],
        [g.displayWidthCss, 0],
        [0, h],
        [g.displayWidthCss, h],
        [73.5, 119.2],
        [200, 50],
      ]) {
        const p = viewToPdf(g, vx, vy)
        const back = pdfToView(g, p.x, p.y)
        expect(back.x).toBeCloseTo(vx, 4)
        expect(back.y).toBeCloseTo(vy, 4)
      }
    }
  })

  it('maps PDF bottom-left origin to the view bottom-left (rotation 0)', () => {
    const g = geom(0) // scale 0.5, display 300x400
    expect(displayHeightCss(g)).toBeCloseTo(400)
    expect(pdfToView(g, 0, 0)).toMatchObject({ x: 0, y: 400 }) // bottom-left
    expect(pdfToView(g, 600, 800)).toMatchObject({ x: 300, y: 0 }) // top-right
  })

  it('rotation 90 swaps display dimensions', () => {
    const g = geom(90)
    const { w, h } = rotatedSizePts(g)
    expect(w).toBe(800)
    expect(h).toBe(600)
    // scale = 300/800 = 0.375 -> display height = 600*0.375 = 225
    expect(displayHeightCss(g)).toBeCloseTo(225)
  })

  it('round-trips rectangles', () => {
    for (const r of ROTATIONS) {
      const g = geom(r)
      const rect = { x: 40, y: 30, width: 120, height: 60 }
      const pdf = rectViewToPdf(g, rect)
      const back = rectPdfToView(g, pdf)
      expect(back.x).toBeCloseTo(rect.x, 3)
      expect(back.y).toBeCloseTo(rect.y, 3)
      expect(back.width).toBeCloseTo(rect.width, 3)
      expect(back.height).toBeCloseTo(rect.height, 3)
    }
  })
})
