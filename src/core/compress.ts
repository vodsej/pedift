/**
 * Best-effort PDF compression engine.
 *
 * Finds embedded JPEG (DCTDecode) image XObjects that are larger than a
 * threshold, re-encodes them via a canvas at the requested quality, and
 * replaces the stream if the result is smaller. Non-JPEG images are skipped.
 * Never throws for a single bad image — errors are caught per-image.
 * Runs entirely in the browser (uses Image + HTMLCanvasElement).
 */
import { PDFDocument, PDFName, PDFNumber, PDFRawStream } from '@cantoo/pdf-lib'

export interface CompressResult {
  bytes: Uint8Array
  before: number
  after: number
}

const MIN_IMAGE_BYTES = 8 * 1024 // skip tiny images — < 8 KB

/** Decode a JPEG blob via an <img>, draw it to a canvas and re-encode. */
function reencodeJpeg(
  rawBytes: Uint8Array,
  quality: number,
): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      resolve(null)
      return
    }

    const blob = new Blob([rawBytes.buffer.slice(rawBytes.byteOffset, rawBytes.byteOffset + rawBytes.byteLength) as ArrayBuffer], { type: 'image/jpeg' })
    const url = URL.createObjectURL(blob)
    const img = new Image()

    const cleanup = () => URL.revokeObjectURL(url)

    img.onload = () => {
      cleanup()
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(null); return }
        ctx.drawImage(img, 0, 0)
        canvas.toBlob(
          (reblob) => {
            if (!reblob) { resolve(null); return }
            reblob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf))).catch(() => resolve(null))
          },
          'image/jpeg',
          quality,
        )
      } catch {
        resolve(null)
      }
    }

    img.onerror = () => {
      cleanup()
      resolve(null)
    }

    img.src = url
  })
}

/**
 * Compress a PDF by re-encoding embedded JPEG images at the given quality.
 * @param bytes   Raw PDF bytes.
 * @param opts    quality 0..1 (JPEG quality). password if the PDF is encrypted.
 */
export async function compressPdf(
  bytes: Uint8Array,
  opts: { quality: number; password?: string },
): Promise<CompressResult> {
  const { quality, password } = opts
  const before = bytes.length

  const doc = await PDFDocument.load(bytes, {
    password,
    updateMetadata: false,
  })

  const ctx = doc.context
  const entries = ctx.enumerateIndirectObjects()

  const nameSubtype = PDFName.of('Subtype')
  const nameFilter = PDFName.of('Filter')
  const Length = PDFName.Length

  for (const [, obj] of entries) {
    // We only care about raw streams
    if (!(obj instanceof PDFRawStream)) continue

    const dict = obj.dict

    // Must be an Image XObject (Subtype = /Image)
    const subtype = dict.lookupMaybe(nameSubtype, PDFName)
    if (!subtype || subtype.asString() !== '/Image') continue

    // Filter must be DCTDecode
    const filter = dict.lookupMaybe(nameFilter, PDFName)
    if (!filter || filter.asString() !== '/DCTDecode') continue

    // Skip small images
    const rawContents = obj.contents
    if (rawContents.length < MIN_IMAGE_BYTES) continue

    try {
      const reencoded = await reencodeJpeg(rawContents, quality)
      if (!reencoded) continue

      // Only replace if it actually saves space
      if (reencoded.length >= rawContents.length) continue

      // Replace stream contents and update Length
      obj.updateContents(reencoded)
      dict.set(Length, PDFNumber.of(reencoded.length))
      ctx.registerObjectChange(obj)
    } catch {
      // Best-effort: skip this image on any error
    }
  }

  const after = await doc.save({ useObjectStreams: true })

  return { bytes: after, before, after: after.length }
}
