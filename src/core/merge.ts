import { PDFDocument } from '@cantoo/pdf-lib'
import { PdfError, classifyError } from './errors'

export interface MergeItem {
  bytes: Uint8Array
  password?: string
}

/** Merge several PDFs (in order) into one. Originals are not mutated. */
export async function mergePdfs(items: MergeItem[]): Promise<Uint8Array> {
  if (items.length < 2) throw new PdfError('generic', 'Add at least two PDFs to merge')
  const out = await PDFDocument.create()
  for (const item of items) {
    let src: PDFDocument
    try {
      src = await PDFDocument.load(item.bytes, { password: item.password, updateMetadata: false })
    } catch (err) {
      throw classifyError(err)
    }
    const copied = await out.copyPages(src, src.getPageIndices())
    for (const page of copied) out.addPage(page)
  }
  out.setProducer('pedift')
  return out.save()
}
