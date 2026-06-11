import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib'
import type { PageNumbersConfig } from './types'
import { hexToRgb } from './bake'

// Draws page numbers onto an already-assembled output document (save finalize pass).

function formatNumber(n: number, total: number, cfg: PageNumbersConfig): string {
  switch (cfg.format) {
    case 'slash':
      return `${n} / ${total}`
    case 'long':
      return `Page ${n} of ${total}`
    default:
      return String(n)
  }
}

export async function applyPageNumbers(out: PDFDocument, cfg: PageNumbersConfig): Promise<void> {
  const font = await out.embedFont(StandardFonts.Helvetica)
  const pages = out.getPages()
  const total = pages.length
  const [from, to] = cfg.range ?? [0, total - 1]
  const margin = 28
  const size = cfg.fontSize
  const color = cfg.color ? hexToRgb(cfg.color) : rgb(0.2, 0.2, 0.2)

  for (let i = 0; i < pages.length; i++) {
    if (i < from || i > to) continue
    const page = pages[i]
    const { width, height } = page.getSize()
    const label = formatNumber(cfg.startAt + (i - from), total, cfg)
    const textW = font.widthOfTextAtSize(label, size)

    const pos = cfg.position
    let x = margin
    if (pos.endsWith('center')) x = (width - textW) / 2
    else if (pos.endsWith('right')) x = width - margin - textW
    const y = pos.startsWith('top') ? height - margin - size : margin

    page.drawText(label, { x, y, size, font, color })
  }
}
