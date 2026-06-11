import { PDFDocument } from '@cantoo/pdf-lib'
import { PdfError, classifyError } from './errors'

// Protect / unprotect using @cantoo/pdf-lib's encryption support.
// Phase-1 spike: probeEncryptionSupport() runs once at startup; if it returns
// false the UI disables protect/unprotect with an honest message rather than
// shipping a broken button.

export interface EncryptOptions {
  userPassword: string
  ownerPassword?: string
  /** Passed straight to pdf-lib; left permissive by default. */
  permissions?: Record<string, unknown>
}

type LoadOpts = { password?: string; updateMetadata?: boolean }

async function loadForEdit(bytes: Uint8Array, password?: string): Promise<PDFDocument> {
  const opts: LoadOpts = { updateMetadata: false }
  if (password !== undefined) opts.password = password
  try {
    return await PDFDocument.load(bytes, opts)
  } catch (err) {
    throw classifyError(err)
  }
}

/** Add (or change) a user password. `currentPassword` is required if `bytes` is already encrypted. */
export async function addPassword(
  bytes: Uint8Array,
  opts: EncryptOptions,
  currentPassword?: string,
): Promise<Uint8Array> {
  try {
    const doc = await loadForEdit(bytes, currentPassword)
    doc.encrypt({
      userPassword: opts.userPassword,
      ownerPassword: opts.ownerPassword ?? opts.userPassword,
      ...(opts.permissions ? { permissions: opts.permissions } : {}),
    })
    return await doc.save()
  } catch (err) {
    if (err instanceof PdfError) throw err
    throw new PdfError('save-failed', 'Encryption failed', err)
  }
}

/** Remove a password, producing an unencrypted copy. Needs the current password. */
export async function removePassword(
  bytes: Uint8Array,
  currentPassword: string,
): Promise<Uint8Array> {
  const doc = await loadForEdit(bytes, currentPassword)
  // Saving without calling encrypt() yields an unencrypted document.
  return doc.save()
}

/** True if the bytes are an encrypted PDF (i.e. need a password to open). */
export async function isEncrypted(bytes: Uint8Array): Promise<boolean> {
  try {
    await PDFDocument.load(bytes, { updateMetadata: false })
    return false
  } catch (err) {
    const e = classifyError(err)
    return e.kind === 'encrypted' || e.kind === 'wrong-password'
  }
}

/**
 * Runtime capability probe (the mandatory spike). Creates a tiny doc, encrypts
 * it, and confirms it reopens only with the password. Returns false on any
 * failure so the feature can be honestly disabled.
 */
export async function probeEncryptionSupport(): Promise<boolean> {
  try {
    const doc = await PDFDocument.create()
    doc.addPage([200, 200])
    doc.encrypt({ userPassword: 'probe-pw', ownerPassword: 'probe-pw' })
    const bytes = await doc.save()

    // Opens with the right password?
    const ok = await PDFDocument.load(bytes, { password: 'probe-pw' })
    if (ok.getPageCount() !== 1) return false

    // Refuses to open with no password?
    let refused = false
    try {
      await PDFDocument.load(bytes, { updateMetadata: false })
    } catch {
      refused = true
    }
    return refused
  } catch {
    return false
  }
}
