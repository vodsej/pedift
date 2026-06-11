import { PDFDocument, StandardFonts, degrees } from '@cantoo/pdf-lib'
import type { WatermarkConfig } from './types'
import { hexToRgb } from './bake'

// Draws a diagonal text watermark across pages (save finalize pass).
export async function applyWatermark(out: PDFDocument, cfg: WatermarkConfig): Promise<void> {
  if (!cfg.text.trim()) return
  const font = await out.embedFont(StandardFonts.HelveticaBold)
  const pages = out.getPages()
  const [from, to] = cfg.range ?? [0, pages.length - 1]
  const color = hexToRgb(cfg.color)

  for (let i = 0; i < pages.length; i++) {
    if (i < from || i > to) continue
    const page = pages[i]
    const { width, height } = page.getSize()
    // Size the text to roughly span the page diagonal.
    const diag = Math.hypot(width, height)
    let size = cfg.fontSize
    const textW = font.widthOfTextAtSize(cfg.text, size)
    if (textW > diag * 0.9) size = (size * diag * 0.9) / textW
    const finalW = font.widthOfTextAtSize(cfg.text, size)
    const angle = Math.atan2(height, width)
    // Center the text, then offset back along the 45°-ish diagonal by half its length.
    const cx = width / 2
    const cy = height / 2
    const x = cx - (finalW / 2) * Math.cos(angle) + (size / 2) * Math.sin(angle)
    const y = cy - (finalW / 2) * Math.sin(angle) - (size / 2) * Math.cos(angle)

    page.drawText(cfg.text, {
      x,
      y,
      size,
      font,
      color,
      opacity: cfg.opacity,
      rotate: degrees((angle * 180) / Math.PI),
    })
  }
}
