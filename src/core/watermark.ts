import { PDFDocument, StandardFonts, degrees } from '@cantoo/pdf-lib'
import type { WatermarkConfig } from './types'
import { hexToRgb } from './bake'

// Draws a diagonal text watermark across pages (save finalize pass).
// The watermark must read as a clean bottom-left → top-right diagonal on the page
// AS DISPLAYED. Since pages can carry a /Rotate entry that the viewer applies, we
// compute the angle from the displayed dimensions and add the page rotation to the
// draw angle so it lands correctly after the viewer rotates the page. (This mirrors
// the live preview in src/overlay/PreviewLayer.tsx.)
export async function applyWatermark(out: PDFDocument, cfg: WatermarkConfig): Promise<void> {
  if (!cfg.text.trim()) return
  const font = await out.embedFont(StandardFonts.HelveticaBold)
  const pages = out.getPages()
  const [from, to] = cfg.range ?? [0, pages.length - 1]
  const color = hexToRgb(cfg.color)

  for (let i = 0; i < pages.length; i++) {
    if (i < from || i > to) continue
    const page = pages[i]
    const { width, height } = page.getSize() // unrotated MediaBox
    const rot = (((page.getRotation().angle % 360) + 360) % 360)
    const swap = rot === 90 || rot === 270
    const dispW = swap ? height : width
    const dispH = swap ? width : height

    // Size the text to roughly span the displayed diagonal.
    const diag = Math.hypot(dispW, dispH)
    let size = cfg.fontSize
    const textW = font.widthOfTextAtSize(cfg.text, size)
    if (textW > diag * 0.9) size = (size * diag * 0.9) / textW
    const finalW = font.widthOfTextAtSize(cfg.text, size)

    // Draw angle = displayed diagonal angle + page rotation, so that after the
    // viewer applies /Rotate the watermark reads bottom-left → top-right, upright.
    const drawAngle = Math.atan2(dispH, dispW) + (rot * Math.PI) / 180
    const cx = width / 2
    const cy = height / 2
    const x = cx - (finalW / 2) * Math.cos(drawAngle) + (size / 2) * Math.sin(drawAngle)
    const y = cy - (finalW / 2) * Math.sin(drawAngle) - (size / 2) * Math.cos(drawAngle)

    page.drawText(cfg.text, {
      x,
      y,
      size,
      font,
      color,
      opacity: cfg.opacity,
      rotate: degrees((drawAngle * 180) / Math.PI),
    })
  }
}
