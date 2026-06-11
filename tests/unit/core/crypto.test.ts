import { describe, it, expect } from 'vitest'
import { PDFDocument } from '@cantoo/pdf-lib'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { addPassword, removePassword, isEncrypted, probeEncryptionSupport } from '../../../src/core/crypto'

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures')
const fixture = (name: string) => new Uint8Array(readFileSync(path.join(FIXTURES, name)))

describe('crypto — the mandatory encryption spike', () => {
  it('probeEncryptionSupport reports true (encrypt+decrypt round-trips)', async () => {
    expect(await probeEncryptionSupport()).toBe(true)
  })

  it('addPassword produces a PDF that opens only with the password', async () => {
    const out = await addPassword(fixture('plain-3page.pdf'), { userPassword: 'secret' })

    const ok = await PDFDocument.load(out, { password: 'secret' })
    expect(ok.getPageCount()).toBe(3)

    await expect(PDFDocument.load(out)).rejects.toThrow()
    await expect(PDFDocument.load(out, { password: 'nope' })).rejects.toThrow()
  })

  it('removePassword turns an encrypted PDF into one that opens with no password', async () => {
    const out = await removePassword(fixture('encrypted.pdf'), 'test1234')
    const reopened = await PDFDocument.load(out)
    expect(reopened.getPageCount()).toBe(1)
  })

  it('isEncrypted distinguishes encrypted from plain PDFs', async () => {
    expect(await isEncrypted(fixture('encrypted.pdf'))).toBe(true)
    expect(await isEncrypted(fixture('plain-3page.pdf'))).toBe(false)
  })
})
