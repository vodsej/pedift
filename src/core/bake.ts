import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  StandardFonts,
  rgb,
  type RGB,
} from '@cantoo/pdf-lib'
import type { ImageAsset } from './document'
import type { OverlayObject, StandardFontName, TextObj } from './types'

// Bakes overlay objects into a page's content using pdf-lib draw operations.
// Geometry is in unrotated PDF user space (bottom-left origin), matching how the
// overlay layer stores it (see src/overlay/geometry.ts).

const STD: Record<StandardFontName, StandardFonts> = {
  Helvetica: StandardFonts.Helvetica,
  TimesRoman: StandardFonts.TimesRoman,
  Courier: StandardFonts.Courier,
}

export function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return rgb(0, 0, 0)
  const n = parseInt(m[1], 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

/** Per-output-document cache of embedded fonts and images. */
export interface BakeAssets {
  fontFor(name: StandardFontName): Promise<PDFFont>
  imageFor(key: string): Promise<PDFImage | null>
}

export function createBakeAssets(out: PDFDocument, images: Map<string, ImageAsset>): BakeAssets {
  const fonts = new Map<StandardFontName, Promise<PDFFont>>()
  const imgs = new Map<string, Promise<PDFImage | null>>()
  return {
    fontFor(name) {
      let p = fonts.get(name)
      if (!p) {
        p = out.embedFont(STD[name] ?? StandardFonts.Helvetica)
        fonts.set(name, p)
      }
      return p
    },
    imageFor(key) {
      let p = imgs.get(key)
      if (!p) {
        const asset = images.get(key)
        p = asset
          ? asset.format === 'png'
            ? out.embedPng(asset.bytes)
            : out.embedJpg(asset.bytes)
          : Promise.resolve(null)
        imgs.set(key, p)
      }
      return p
    },
  }
}

export async function bakeObjects(
  page: PDFPage,
  objects: OverlayObject[],
  assets: BakeAssets,
): Promise<void> {
  const ordered = [...objects].sort((a, b) => a.z - b.z)
  for (const obj of ordered) {
    await bakeOne(page, obj, assets)
  }
}

async function bakeOne(page: PDFPage, obj: OverlayObject, assets: BakeAssets): Promise<void> {
  switch (obj.type) {
    case 'text':
      await bakeText(page, obj, assets)
      break
    case 'whiteout':
      page.drawRectangle({
        x: obj.x,
        y: obj.y,
        width: obj.width,
        height: obj.height,
        color: hexToRgb(obj.color || '#ffffff'),
      })
      break
    case 'highlight':
      for (const r of obj.rects) {
        page.drawRectangle({
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          color: hexToRgb(obj.color),
          opacity: obj.opacity,
        })
      }
      break
    case 'shape':
      bakeShape(page, obj)
      break
    case 'pen':
      for (let i = 1; i < obj.points.length; i++) {
        const [x1, y1] = obj.points[i - 1]
        const [x2, y2] = obj.points[i]
        page.drawLine({
          start: { x: x1, y: y1 },
          end: { x: x2, y: y2 },
          thickness: obj.strokeWidth,
          color: hexToRgb(obj.color),
        })
      }
      break
    case 'image':
    case 'signature': {
      const img = await assets.imageFor(obj.imageKey)
      if (img) page.drawImage(img, { x: obj.x, y: obj.y, width: obj.width, height: obj.height })
      break
    }
    case 'stamp': {
      const font = await assets.fontFor('Helvetica')
      // Match the on-screen flex-centered stamp: center the text in its box.
      const textWidth = font.widthOfTextAtSize(obj.text, obj.fontSize)
      page.drawText(obj.text, {
        x: obj.x + (obj.width - textWidth) / 2,
        y: obj.y + (obj.height - obj.fontSize) / 2,
        size: obj.fontSize,
        font,
        color: hexToRgb(obj.color),
      })
      break
    }
  }
}

async function bakeText(page: PDFPage, obj: TextObj, assets: BakeAssets): Promise<void> {
  const font = await assets.fontFor(obj.font)
  const color = hexToRgb(obj.color)
  const lineHeight = obj.fontSize * 1.18
  const lines = obj.text.split('\n')
  // First line's baseline near the top of the box.
  let y = obj.y + obj.height - obj.fontSize
  for (const line of lines) {
    const textWidth = font.widthOfTextAtSize(line, obj.fontSize)
    let x = obj.x
    if (obj.align === 'center') x = obj.x + (obj.width - textWidth) / 2
    else if (obj.align === 'right') x = obj.x + (obj.width - textWidth)
    page.drawText(line, { x, y, size: obj.fontSize, font, color })
    y -= lineHeight
  }
}

function bakeShape(page: PDFPage, obj: Extract<OverlayObject, { type: 'shape' }>): void {
  const stroke = hexToRgb(obj.color)
  const fill = obj.fill ? hexToRgb(obj.fill) : undefined
  if (obj.shape === 'rect') {
    page.drawRectangle({
      x: obj.x,
      y: obj.y,
      width: obj.width,
      height: obj.height,
      borderColor: stroke,
      borderWidth: obj.strokeWidth,
      color: fill,
    })
  } else if (obj.shape === 'ellipse') {
    page.drawEllipse({
      x: obj.x + obj.width / 2,
      y: obj.y + obj.height / 2,
      xScale: Math.abs(obj.width / 2),
      yScale: Math.abs(obj.height / 2),
      borderColor: stroke,
      borderWidth: obj.strokeWidth,
      color: fill,
    })
  } else {
    // line / arrow: endpoints are (x,y) -> (x+width, y+height) with signed deltas.
    const start = { x: obj.x, y: obj.y }
    const end = { x: obj.x + obj.width, y: obj.y + obj.height }
    page.drawLine({ start, end, thickness: obj.strokeWidth, color: stroke })
    if (obj.shape === 'arrow') {
      const angle = Math.atan2(end.y - start.y, end.x - start.x)
      const head = Math.max(8, obj.strokeWidth * 3)
      const a1 = angle + Math.PI - Math.PI / 7
      const a2 = angle + Math.PI + Math.PI / 7
      page.drawLine({
        start: end,
        end: { x: end.x + head * Math.cos(a1), y: end.y + head * Math.sin(a1) },
        thickness: obj.strokeWidth,
        color: stroke,
      })
      page.drawLine({
        start: end,
        end: { x: end.x + head * Math.cos(a2), y: end.y + head * Math.sin(a2) },
        thickness: obj.strokeWidth,
        color: stroke,
      })
    }
  }
}
