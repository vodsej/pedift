import { openPdfDocument, type OpenedPdf } from '../render/pdfjs'
import { fileToBytes, isPdfFile } from '../io/fileio'
import { PdfError } from '../core/errors'

export interface OpenedSession {
  bytes: Uint8Array
  fileName: string
  password?: string
  opened: OpenedPdf
}

export interface OpenCallbacks {
  /** Show a password prompt; resolve with the password or null to cancel. */
  requestPassword: (previousWasWrong: boolean) => Promise<string | null>
}

/**
 * Reads a File, opens it for rendering, and returns a session. Throws a PdfError
 * (already classified) on failure; throws a PdfError of kind 'encrypted' when the
 * user cancels the password prompt (callers can treat that as a silent abort).
 */
export async function openFileAsSession(
  file: File,
  cb: OpenCallbacks,
): Promise<OpenedSession> {
  if (!isPdfFile(file)) throw new PdfError('not-a-pdf')
  const bytes = await fileToBytes(file)
  const opened = await openPdfDocument(bytes, { requestPassword: cb.requestPassword })
  return { bytes, fileName: file.name, password: opened.password, opened }
}
