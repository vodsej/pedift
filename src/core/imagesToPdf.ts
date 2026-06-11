import { PDFDocument } from '@cantoo/pdf-lib'
import { PdfError } from './errors'

export type PageSizeName = 'a4' | 'letter' | 'fit'
export type Orientation = 'portrait' | 'landscape'

export interface ImageInput {
  bytes: Uint8Array
  format: 'png' | 'jpg'
}

export interface ImagesToPdfOptions {
  pageSize: PageSizeName
  orientation: Orientation
  /** Margin in points (ignored for 'fit'). */
  margin: number
}

const SIZES: Record<'a4' | 'letter', [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
}

/** Detect PNG vs JPG from the magic bytes; defaults to jpg. */
export function detectImageFormat(bytes: Uint8Array): 'png' | 'jpg' {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'png'
  }
  return 'jpg'
}

export async function imagesToPdf(
  images: ImageInput[],
  opts: ImagesToPdfOptions,
): Promise<Uint8Array> {
  if (images.length === 0) throw new PdfError('generic', 'Add at least one image')
  const out = await PDFDocument.create()

  for (const img of images) {
    const embedded =
      img.format === 'png' ? await out.embedPng(img.bytes) : await out.embedJpg(img.bytes)
    const iw = embedded.width
    const ih = embedded.height

    if (opts.pageSize === 'fit') {
      const page = out.addPage([iw, ih])
      page.drawImage(embedded, { x: 0, y: 0, width: iw, height: ih })
      continue
    }

    let [pw, ph] = SIZES[opts.pageSize]
    if (opts.orientation === 'landscape') [pw, ph] = [ph, pw]
    const page = out.addPage([pw, ph])

    const m = Math.max(0, opts.margin)
    const cw = Math.max(1, pw - m * 2)
    const ch = Math.max(1, ph - m * 2)
    const scale = Math.min(cw / iw, ch / ih)
    const w = iw * scale
    const h = ih * scale
    page.drawImage(embedded, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h })
  }

  out.setProducer('pedift')
  return out.save()
}
