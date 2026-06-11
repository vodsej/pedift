import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PDFDocument } from '@cantoo/pdf-lib'
import { resetIds } from '../../../src/core/ids'
import { mergePdfs } from '../../../src/core/merge'

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures')
const fixture = (name: string) => new Uint8Array(readFileSync(path.join(FIXTURES, name)))

beforeEach(() => {
  resetIds()
})

describe('mergePdfs', () => {
  it('merging plain-3page with itself produces 6 pages', async () => {
    const bytes = fixture('plain-3page.pdf')
    const out = await mergePdfs([{ bytes }, { bytes }])
    const reloaded = await PDFDocument.load(out)
    expect(reloaded.getPageCount()).toBe(6)
  })

  it('merging 3-page + encrypted (with password) produces 4 pages', async () => {
    const plain = fixture('plain-3page.pdf')
    const enc = fixture('encrypted.pdf')
    const out = await mergePdfs([
      { bytes: plain },
      { bytes: enc, password: 'test1234' },
    ])
    const reloaded = await PDFDocument.load(out)
    expect(reloaded.getPageCount()).toBe(4)
  })

  it('throws when fewer than 2 items provided (1 item)', async () => {
    const bytes = fixture('plain-3page.pdf')
    await expect(mergePdfs([{ bytes }])).rejects.toThrow()
  })

  it('throws when 0 items provided', async () => {
    await expect(mergePdfs([])).rejects.toThrow()
  })

  it('throws when wrong password is used for encrypted source', async () => {
    const plain = fixture('plain-3page.pdf')
    const enc = fixture('encrypted.pdf')
    await expect(
      mergePdfs([{ bytes: plain }, { bytes: enc, password: 'wrongpass' }]),
    ).rejects.toThrow()
  })

  it('produces a valid PDF that can be saved and reloaded', async () => {
    const bytes = fixture('plain-3page.pdf')
    const out = await mergePdfs([{ bytes }, { bytes }])
    // Reload should not throw
    const reloaded = await PDFDocument.load(out)
    // And it must be saveable again
    const resaved = await reloaded.save()
    expect(resaved.length).toBeGreaterThan(0)
  })

  it('merges three documents: 3 + 3 + 1 (encrypted) = 7 pages', async () => {
    const plain = fixture('plain-3page.pdf')
    const enc = fixture('encrypted.pdf')
    const out = await mergePdfs([
      { bytes: plain },
      { bytes: plain },
      { bytes: enc, password: 'test1234' },
    ])
    const reloaded = await PDFDocument.load(out)
    expect(reloaded.getPageCount()).toBe(7)
  })

  it('does not mutate the input byte arrays', async () => {
    const bytes = fixture('plain-3page.pdf')
    const originalLength = bytes.length
    const first8 = Array.from(bytes.slice(0, 8))

    await mergePdfs([{ bytes }, { bytes }])

    expect(bytes.length).toBe(originalLength)
    expect(Array.from(bytes.slice(0, 8))).toEqual(first8)
  })

  it('output is not encrypted (merging plain files -> plain output)', async () => {
    const bytes = fixture('plain-3page.pdf')
    const out = await mergePdfs([{ bytes }, { bytes }])
    // Should load without any password
    const reloaded = await PDFDocument.load(out)
    expect(reloaded.getPageCount()).toBeGreaterThan(0)
  })

  it('merges landscape page correctly, preserving page dimensions', async () => {
    const plain = fixture('plain-3page.pdf')
    const landscape = fixture('landscape.pdf')
    const out = await mergePdfs([{ bytes: plain }, { bytes: landscape }])
    const reloaded = await PDFDocument.load(out)
    expect(reloaded.getPageCount()).toBe(4)
    // Last page should be landscape: width > height
    const lastPage = reloaded.getPage(3)
    const { width, height } = lastPage.getSize()
    expect(width).toBeGreaterThan(height)
  })
})
