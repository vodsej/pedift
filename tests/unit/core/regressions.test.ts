import { describe, it, expect, beforeEach } from 'vitest'
import { PDFDocument, degrees } from '@cantoo/pdf-lib'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { EditorDocument } from '../../../src/core/document'
import { resetIds } from '../../../src/core/ids'
import type { OverlayObject } from '../../../src/core/types'

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures')
const fixture = (name: string) => new Uint8Array(readFileSync(path.join(FIXTURES, name)))

beforeEach(() => resetIds())

async function makeRotatedPdf(angle: number): Promise<Uint8Array> {
  const d = await PDFDocument.create()
  const p = d.addPage([400, 600])
  p.setRotation(degrees(angle))
  return d.save()
}

const textOverlay = (pageId: string): OverlayObject => ({
  id: 'ov_' + pageId,
  pageId,
  z: 1,
  type: 'text',
  x: 50,
  y: 700,
  width: 200,
  height: 30,
  text: 'baked overlay',
  fontSize: 14,
  font: 'Helvetica',
  color: '#000000',
  align: 'left',
})

describe('regression: inserted pages keep their source rotation', () => {
  it('preserves /Rotate on inserted pages', async () => {
    const editor = await EditorDocument.open(fixture('plain-3page.pdf'), 'a.pdf')
    const rotBytes = await makeRotatedPdf(90)
    const rdoc = await PDFDocument.load(rotBytes)
    const rotations = rdoc.getPages().map((p) => p.getRotation().angle)
    editor.addSource({ id: 'src1', kind: 'pdf', bytes: rotBytes, name: 'r.pdf', pageRotations: rotations })
    editor.insertSourcePages('src1', [0], 0)

    const out = await editor.build()
    const reloaded = await PDFDocument.load(out)
    expect(reloaded.getPageCount()).toBe(4)
    expect(reloaded.getPage(0).getRotation().angle).toBe(90)
  })
})

describe('regression: split with overlays bakes into every group', () => {
  it('bakes overlays in both split groups (not just the first)', async () => {
    const editor = await EditorDocument.open(fixture('plain-3page.pdf'), 'a.pdf')
    const [p0, p1, p2] = editor.pages
    editor.setOverlays(p0.id, [textOverlay(p0.id)])
    editor.setOverlays(p2.id, [textOverlay(p2.id)])

    const parts = await editor.buildSplitGroups([[p0], [p2]])
    expect(parts.length).toBe(2)
    for (const b of parts) {
      const d = await PDFDocument.load(b)
      expect(d.getPageCount()).toBe(1)
    }
    // Both groups must contain baked content (larger than a no-overlay subset).
    const plain = await editor.buildSubsetByIds([p1.id])
    expect(parts[0].length).toBeGreaterThan(plain.length)
    expect(parts[1].length).toBeGreaterThan(plain.length)
  })
})
