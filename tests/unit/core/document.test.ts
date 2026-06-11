import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PDFDocument } from '@cantoo/pdf-lib'
import { resetIds } from '../../../src/core/ids'
import { EditorDocument } from '../../../src/core/document'

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures')
const fixture = (name: string) => new Uint8Array(readFileSync(path.join(FIXTURES, name)))

beforeEach(() => {
  resetIds()
})

// ---- open -------------------------------------------------------------------

describe('EditorDocument.open', () => {
  it('opens a 3-page plain PDF and reports pageCount 3', async () => {
    const doc = await EditorDocument.open(fixture('plain-3page.pdf'), 'plain.pdf')
    expect(doc.pageCount).toBe(3)
  })

  it('reads metadata title from plain-3page.pdf', async () => {
    const doc = await EditorDocument.open(fixture('plain-3page.pdf'), 'plain.pdf')
    expect(doc.state.metadata.title).toBe('Plain 3-page fixture')
  })

  it('reads metadata author from plain-3page.pdf', async () => {
    const doc = await EditorDocument.open(fixture('plain-3page.pdf'), 'plain.pdf')
    expect(doc.state.metadata.author).toBe('pedift tests')
  })

  it('opens encrypted PDF with correct password', async () => {
    const doc = await EditorDocument.open(fixture('encrypted.pdf'), 'encrypted.pdf', 'test1234')
    expect(doc.pageCount).toBe(1)
  })

  it('rejects encrypted PDF without password', async () => {
    await expect(EditorDocument.open(fixture('encrypted.pdf'), 'encrypted.pdf')).rejects.toThrow()
  })

  it('rejects encrypted PDF with wrong password', async () => {
    await expect(
      EditorDocument.open(fixture('encrypted.pdf'), 'encrypted.pdf', 'wrongpass'),
    ).rejects.toThrow()
  })

  it('starts with canUndo=false and canRedo=false', async () => {
    const doc = await EditorDocument.open(fixture('plain-3page.pdf'), 'plain.pdf')
    expect(doc.canUndo).toBe(false)
    expect(doc.canRedo).toBe(false)
  })

  it('exposes pages array matching pageCount', async () => {
    const doc = await EditorDocument.open(fixture('plain-3page.pdf'), 'plain.pdf')
    expect(doc.pages).toHaveLength(doc.pageCount)
  })
})

// ---- rotate + undo/redo -----------------------------------------------------

describe('rotate + undo/redo', () => {
  it('rotates page 0 by 90 and rebuild reflects it', async () => {
    const doc = await EditorDocument.open(fixture('plain-3page.pdf'), 'plain.pdf')
    const firstId = doc.pages[0].id
    doc.rotate([firstId], 90)

    const out = await doc.build()
    const reloaded = await PDFDocument.load(out)
    expect(reloaded.getPage(0).getRotation().angle).toBe(90)
  })

  it('undo reverts the rotation', async () => {
    const doc = await EditorDocument.open(fixture('plain-3page.pdf'), 'plain.pdf')
    const firstId = doc.pages[0].id
    doc.rotate([firstId], 90)
    expect(doc.canUndo).toBe(true)

    doc.undo()
    expect(doc.pages[0].rotation).toBe(0)

    const out = await doc.build()
    const reloaded = await PDFDocument.load(out)
    expect(reloaded.getPage(0).getRotation().angle).toBe(0)
  })

  it('redo restores the rotation after undo', async () => {
    const doc = await EditorDocument.open(fixture('plain-3page.pdf'), 'plain.pdf')
    const firstId = doc.pages[0].id
    doc.rotate([firstId], 90)
    doc.undo()
    expect(doc.canRedo).toBe(true)

    doc.redo()
    expect(doc.pages[0].rotation).toBe(90)

    const out = await doc.build()
    const reloaded = await PDFDocument.load(out)
    expect(reloaded.getPage(0).getRotation().angle).toBe(90)
  })

  it('undo returns false when history is at start', async () => {
    const doc = await EditorDocument.open(fixture('plain-3page.pdf'), 'plain.pdf')
    expect(doc.undo()).toBe(false)
  })

  it('redo returns false when at the latest state', async () => {
    const doc = await EditorDocument.open(fixture('plain-3page.pdf'), 'plain.pdf')
    expect(doc.redo()).toBe(false)
  })

  it('new action after undo truncates redo branch', async () => {
    const doc = await EditorDocument.open(fixture('plain-3page.pdf'), 'plain.pdf')
    const firstId = doc.pages[0].id
    doc.rotate([firstId], 90)
    doc.undo()
    doc.rotate([firstId], 180) // new action
    expect(doc.canRedo).toBe(false)
  })
})

// ---- remove -----------------------------------------------------------------

describe('remove', () => {
  it('removes first two pages -> pageCount 1', async () => {
    const doc = await EditorDocument.open(fixture('plain-3page.pdf'), 'plain.pdf')
    const [id0, id1] = [doc.pages[0].id, doc.pages[1].id]
    doc.remove([id0, id1])
    expect(doc.pageCount).toBe(1)
  })

  it('build after remove -> reloaded PDF has 1 page', async () => {
    const doc = await EditorDocument.open(fixture('plain-3page.pdf'), 'plain.pdf')
    const [id0, id1] = [doc.pages[0].id, doc.pages[1].id]
    doc.remove([id0, id1])

    const out = await doc.build()
    const reloaded = await PDFDocument.load(out)
    expect(reloaded.getPageCount()).toBe(1)
  })

  it('undo after remove -> pageCount back to 3', async () => {
    const doc = await EditorDocument.open(fixture('plain-3page.pdf'), 'plain.pdf')
    const [id0, id1] = [doc.pages[0].id, doc.pages[1].id]
    doc.remove([id0, id1])
    doc.undo()
    expect(doc.pageCount).toBe(3)
  })

  it('does not allow removing all pages (guard)', async () => {
    const doc = await EditorDocument.open(fixture('plain-3page.pdf'), 'plain.pdf')
    const allIds = doc.pages.map((p) => p.id)
    doc.remove(allIds)
    // deletePages guard: when all removed, returns unchanged
    expect(doc.pageCount).toBe(3)
  })
})

// ---- duplicate --------------------------------------------------------------

describe('duplicate', () => {
  it('duplicate first page -> pageCount 4', async () => {
    const doc = await EditorDocument.open(fixture('plain-3page.pdf'), 'plain.pdf')
    const firstId = doc.pages[0].id
    doc.duplicate([firstId])
    expect(doc.pageCount).toBe(4)
  })

  it('build after duplicate -> reloaded PDF has 4 pages', async () => {
    const doc = await EditorDocument.open(fixture('plain-3page.pdf'), 'plain.pdf')
    const firstId = doc.pages[0].id
    doc.duplicate([firstId])

    const out = await doc.build()
    const reloaded = await PDFDocument.load(out)
    expect(reloaded.getPageCount()).toBe(4)
  })

  it('undo duplicate -> back to 3 pages', async () => {
    const doc = await EditorDocument.open(fixture('plain-3page.pdf'), 'plain.pdf')
    const firstId = doc.pages[0].id
    doc.duplicate([firstId])
    doc.undo()
    expect(doc.pageCount).toBe(3)
  })
})

// ---- reorder ----------------------------------------------------------------

describe('reorder (via rotation markers)', () => {
  it('moving last page to index 0 changes rotation order on rebuild', async () => {
    const doc = await EditorDocument.open(fixture('plain-3page.pdf'), 'plain.pdf')
    // Mark pages with distinct rotations so we can track order after rebuild
    const [p0, p1, p2] = doc.pages
    doc.rotate([p0.id], 0)   // 0 deg (stays 0)
    doc.rotate([p1.id], 90)  // 90 deg
    doc.rotate([p2.id], 180) // 180 deg

    // Move last page (180 deg) to index 0
    doc.reorder([p2.id], 0)

    const out = await doc.build()
    const reloaded = await PDFDocument.load(out)
    // Order should now be: p2 (180), p0 (0), p1 (90)
    expect(reloaded.getPage(0).getRotation().angle).toBe(180)
    expect(reloaded.getPage(1).getRotation().angle).toBe(0)
    expect(reloaded.getPage(2).getRotation().angle).toBe(90)
  })

  it('pageCount stays stable after reorder', async () => {
    const doc = await EditorDocument.open(fixture('plain-3page.pdf'), 'plain.pdf')
    doc.reorder([doc.pages[2].id], 0)
    expect(doc.pageCount).toBe(3)

    const out = await doc.build()
    const reloaded = await PDFDocument.load(out)
    expect(reloaded.getPageCount()).toBe(3)
  })
})

// ---- setMetadata ------------------------------------------------------------

describe('setMetadata', () => {
  it('writes new metadata into the built PDF', async () => {
    const doc = await EditorDocument.open(fixture('plain-3page.pdf'), 'plain.pdf')
    doc.setMetadata({ title: 'New', author: 'A', subject: 'S', keywords: 'a, b' })

    const out = await doc.build()
    const reloaded = await PDFDocument.load(out)
    expect(reloaded.getTitle()).toBe('New')
    expect(reloaded.getAuthor()).toBe('A')
    expect(reloaded.getSubject()).toBe('S')
  })

  it('keywords appear in the built PDF', async () => {
    const doc = await EditorDocument.open(fixture('plain-3page.pdf'), 'plain.pdf')
    doc.setMetadata({ title: '', author: '', subject: '', keywords: 'alpha, beta' })

    const out = await doc.build()
    const reloaded = await PDFDocument.load(out)
    const kw = reloaded.getKeywords() ?? ''
    expect(kw).toContain('alpha')
    expect(kw).toContain('beta')
  })
})

// ---- build immutability -----------------------------------------------------

describe('immutability of input bytes', () => {
  it('input bytes are unchanged after build()', async () => {
    const bytes = fixture('plain-3page.pdf')
    const originalLength = bytes.length
    const first8 = Array.from(bytes.slice(0, 8))

    const doc = await EditorDocument.open(bytes, 'plain.pdf')
    // apply some mutations
    doc.rotate([doc.pages[0].id], 90)
    doc.setMetadata({ title: 'Changed', author: 'X', subject: 'Y', keywords: 'z' })
    await doc.build()

    expect(bytes.length).toBe(originalLength)
    expect(Array.from(bytes.slice(0, 8))).toEqual(first8)
  })
})

// ---- buildSubsetByIds -------------------------------------------------------

describe('buildSubsetByIds', () => {
  it('produces a PDF containing only the requested pages', async () => {
    const doc = await EditorDocument.open(fixture('plain-3page.pdf'), 'plain.pdf')
    const subset = await doc.buildSubsetByIds([doc.pages[0].id, doc.pages[1].id])
    const reloaded = await PDFDocument.load(subset)
    expect(reloaded.getPageCount()).toBe(2)
  })

  it('produces a 1-page PDF from a single id', async () => {
    const doc = await EditorDocument.open(fixture('plain-3page.pdf'), 'plain.pdf')
    const subset = await doc.buildSubsetByIds([doc.pages[2].id])
    const reloaded = await PDFDocument.load(subset)
    expect(reloaded.getPageCount()).toBe(1)
  })
})

// ---- subscription -----------------------------------------------------------

describe('subscribe', () => {
  it('calls listener when state changes', async () => {
    const doc = await EditorDocument.open(fixture('plain-3page.pdf'), 'plain.pdf')
    let callCount = 0
    const unsub = doc.subscribe(() => callCount++)

    doc.rotate([doc.pages[0].id], 90)
    expect(callCount).toBe(1)

    doc.undo()
    expect(callCount).toBe(2)

    unsub()
    doc.rotate([doc.pages[0].id], 180)
    expect(callCount).toBe(2) // no more calls after unsubscribe
  })
})
