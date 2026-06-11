import * as pdfjsLib from 'pdfjs-dist'
import { GlobalWorkerOptions } from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
// `?worker&inline` base64-embeds the pdf.js worker into the bundle and builds it
// via a blob: URL with a data: URL fallback — the fallback is what makes it run
// from file:// in the single-file artifact. See vite.config.ts.
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline'
import { PdfError, classifyError } from '../core/errors'

GlobalWorkerOptions.workerPort = new PdfWorker()

export const pdfjsVersion: string = pdfjsLib.version

export interface OpenOptions {
  /** Called when a password is needed. Resolve with the password, or null to cancel. */
  requestPassword?: (previousWasWrong: boolean) => Promise<string | null>
  initialPassword?: string
}

export interface OpenedPdf {
  document: PDFDocumentProxy
  /** The password that successfully opened the document, if any. */
  password?: string
}

const MAX_PASSWORD_ATTEMPTS = 8

/**
 * Opens a PDF for rendering. pdf.js neuters the buffer it receives, so we always
 * pass a fresh copy — the caller's original bytes stay intact.
 */
export async function openPdfDocument(
  data: Uint8Array,
  opts: OpenOptions = {},
): Promise<OpenedPdf> {
  let password = opts.initialPassword
  let lastWasWrong = false

  for (let attempt = 0; attempt < MAX_PASSWORD_ATTEMPTS; attempt++) {
    try {
      const params: Record<string, unknown> = { data: data.slice() }
      if (password != null) params.password = password
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const document = await pdfjsLib.getDocument(params as any).promise
      return { document, password }
    } catch (err) {
      const e = classifyError(err)
      if ((e.kind === 'encrypted' || e.kind === 'wrong-password') && opts.requestPassword) {
        lastWasWrong = e.kind === 'wrong-password' || lastWasWrong
        const pw = await opts.requestPassword(lastWasWrong)
        if (pw == null) throw e
        password = pw
        lastWasWrong = true
        continue
      }
      throw e
    }
  }
  throw new PdfError('wrong-password', 'Too many password attempts')
}

export async function destroyPdf(doc: PDFDocumentProxy | null | undefined): Promise<void> {
  if (!doc) return
  try {
    await doc.cleanup()
    await (doc as unknown as { destroy?: () => Promise<void> }).destroy?.()
  } catch {
    /* ignore */
  }
}
