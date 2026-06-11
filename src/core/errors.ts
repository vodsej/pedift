import { t } from '../strings/en'

// Typed, classifiable errors so the UI can show friendly, specific messages
// while never losing the user's loaded work.
export type PdfErrorKind =
  | 'not-a-pdf'
  | 'corrupt'
  | 'encrypted' // needs a password to open
  | 'wrong-password'
  | 'unsupported-encryption'
  | 'image-load'
  | 'save-failed'
  | 'generic'

export class PdfError extends Error {
  readonly kind: PdfErrorKind
  readonly cause?: unknown
  constructor(kind: PdfErrorKind, message?: string, cause?: unknown) {
    super(message ?? kind)
    this.name = 'PdfError'
    this.kind = kind
    this.cause = cause
  }
}

/** Maps a thrown error (pdf.js / pdf-lib / DOM) to a typed PdfError. */
export function classifyError(err: unknown): PdfError {
  if (err instanceof PdfError) return err
  const name = (err as { name?: string })?.name ?? ''
  const msg = String((err as { message?: string })?.message ?? err ?? '')
  const low = msg.toLowerCase()

  if (name === 'PasswordException' || /password/.test(low)) {
    if (/incorrect|invalid password|wrong/.test(low)) return new PdfError('wrong-password', msg, err)
    return new PdfError('encrypted', msg, err)
  }
  if (name === 'InvalidPDFException' || /invalid pdf|not a pdf|no pdf header|stream must/.test(low)) {
    return new PdfError('corrupt', msg, err)
  }
  if (/encrypt/.test(low)) {
    if (/unsupported|unknown|not supported|algorithm/.test(low)) {
      return new PdfError('unsupported-encryption', msg, err)
    }
    return new PdfError('encrypted', msg, err)
  }
  return new PdfError('generic', msg, err)
}

/** Friendly, user-facing message for a typed error. */
export function friendlyMessage(err: unknown): string {
  const e = classifyError(err)
  switch (e.kind) {
    case 'not-a-pdf':
      return t.errors.notAPdf
    case 'corrupt':
      return t.errors.corrupt
    case 'encrypted':
      return t.errors.encrypted
    case 'wrong-password':
      return t.errors.wrongPassword
    case 'unsupported-encryption':
      return t.errors.unsupportedEncryption
    case 'image-load':
      return t.errors.imageLoad
    case 'save-failed':
      return t.errors.saveFailed
    default:
      return t.errors.genericOpen
  }
}
