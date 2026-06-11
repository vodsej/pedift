import * as pdfjsLib from 'pdfjs-dist'
import { GlobalWorkerOptions } from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
// Build the pdf.js worker from a data: URL (NOT blob:) so it runs from file://.
// Vite's ?worker&inline only falls back to data: on a *synchronous* throw, but a
// blob:null worker fails asynchronously on file:// — so the fallback never fires.
// We construct the data: URL module worker directly (mirrors Vite's known-good fallback).
import pdfWorkerSource from 'pdfjs-dist/build/pdf.worker.min.mjs?raw'
import { PdfError, classifyError } from '../core/errors'

function createPdfWorker(): Worker {
  const url = 'data:text/javascript;charset=utf-8,' + encodeURIComponent(pdfWorkerSource)
  return new Worker(url, { type: 'module' })
}

GlobalWorkerOptions.workerPort = createPdfWorker()

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
        // User cancelled — surface as 'encrypted' so callers can treat it as a
        // silent abort (distinct from the 'wrong-password' max-attempts failure).
        if (pw == null) throw new PdfError('encrypted', 'Cancelled', e)
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
    // loadingTask.destroy() tears down the worker-side document + releases buffers.
    await doc.loadingTask.destroy()
  } catch {
    /* ignore */
  }
}
