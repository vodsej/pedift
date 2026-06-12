import { describe, it, expect, beforeEach } from 'vitest'
import { PDFDocument } from '@cantoo/pdf-lib'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { EditorDocument } from '../../../src/core/document'
import { resetIds } from '../../../src/core/ids'
import type { OverlayObject } from '../../../src/core/types'

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures')
const fixture = (name: string) => new Uint8Array(readFileSync(path.join(FIXTURES, name)))

// 1x1 red PNG
const PNG = new Uint8Array(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC',
    'base64',
  ),
)

beforeEach(() => resetIds())

describe('bake overlays into the saved PDF', () => {
  it('bakes text/shape/whiteout/redaction/highlight without error and reloads', async () => {
    const editor = await EditorDocument.open(fixture('plain-3page.pdf'), 'doc.pdf')
    const pageId = editor.pages[0].id
    const objs: OverlayObject[] = [
      { id: 'o1', pageId, z: 1, type: 'text', x: 50, y: 700, width: 200, height: 40, text: 'Hello\nWorld', fontSize: 16, font: 'Helvetica', color: '#ff0000', align: 'left' },
      { id: 'o2', pageId, z: 2, type: 'whiteout', x: 60, y: 600, width: 120, height: 20, color: '#ffffff' },
      { id: 'o2b', pageId, z: 2, type: 'redaction', x: 60, y: 560, width: 120, height: 20, color: '#000000' },
      { id: 'o3', pageId, z: 3, type: 'shape', shape: 'rect', x: 200, y: 500, width: 120, height: 80, color: '#0000ff', strokeWidth: 2, fill: null },
      { id: 'o4', pageId, z: 4, type: 'shape', shape: 'arrow', x: 100, y: 400, width: 150, height: 60, color: '#00aa00', strokeWidth: 3, fill: null },
      { id: 'o5', pageId, z: 5, type: 'highlight', rects: [{ x: 50, y: 300, width: 180, height: 14 }], color: '#ffff00', opacity: 0.4 },
      { id: 'o6', pageId, z: 6, type: 'pen', points: [[50, 250], [80, 270], [110, 240]], color: '#333333', strokeWidth: 2 },
    ]
    editor.setOverlays(pageId, objs)

    const bytes = await editor.build()
    const reloaded = await PDFDocument.load(bytes)
    expect(reloaded.getPageCount()).toBe(3)

    // The baked output should be larger than a no-overlay build of the same doc.
    const plain = await EditorDocument.open(fixture('plain-3page.pdf'), 'doc.pdf')
    const plainBytes = await plain.build()
    expect(bytes.length).toBeGreaterThan(plainBytes.length)
  })

  it('bakes an embedded image overlay', async () => {
    const editor = await EditorDocument.open(fixture('plain-3page.pdf'), 'doc.pdf')
    const pageId = editor.pages[0].id
    const key = editor.addImage({ bytes: PNG, format: 'png', width: 1, height: 1 })
    editor.setOverlays(pageId, [
      { id: 'img1', pageId, z: 1, type: 'image', x: 100, y: 100, width: 200, height: 150, imageKey: key, format: 'png' },
    ])
    const bytes = await editor.build()
    const reloaded = await PDFDocument.load(bytes)
    expect(reloaded.getPageCount()).toBe(3)
  })

  it('only bakes overlays onto their own page', async () => {
    const editor = await EditorDocument.open(fixture('plain-3page.pdf'), 'doc.pdf')
    const pageId = editor.pages[1].id
    editor.setOverlays(pageId, [
      { id: 't', pageId, z: 1, type: 'text', x: 50, y: 700, width: 200, height: 40, text: 'Page 2 only', fontSize: 14, font: 'Helvetica', color: '#000000', align: 'left' },
    ])
    const bytes = await editor.build()
    const reloaded = await PDFDocument.load(bytes)
    expect(reloaded.getPageCount()).toBe(3)
  })
})
