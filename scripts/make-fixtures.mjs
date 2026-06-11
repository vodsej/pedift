// Generates small fixture PDFs/images used by unit + e2e tests.
// Run once with `npm run fixtures`; the outputs are committed to tests/fixtures/.
import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures')
mkdirSync(dir, { recursive: true })

async function save(name, doc) {
  const bytes = await doc.save()
  writeFileSync(path.join(dir, name), bytes)
  console.log(`wrote ${name} (${bytes.length} bytes)`)
}

// 1. plain-3page.pdf — A4, three numbered pages with some selectable text.
{
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 1; i <= 3; i++) {
    const page = doc.addPage([595, 842])
    page.drawText(`Page ${i}`, { x: 50, y: 792, size: 24, font, color: rgb(0, 0, 0) })
    page.drawText('The quick brown fox jumps over the lazy dog.', {
      x: 50,
      y: 740,
      size: 14,
      font,
      color: rgb(0.1, 0.1, 0.1),
    })
  }
  doc.setTitle('Plain 3-page fixture')
  doc.setAuthor('pedift tests')
  await save('plain-3page.pdf', doc)
}

// 2. encrypted.pdf — user password "test1234".
{
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.addPage([595, 842])
  page.drawText('Encrypted fixture', { x: 50, y: 792, size: 24, font, color: rgb(0, 0, 0) })
  doc.encrypt({
    userPassword: 'test1234',
    ownerPassword: 'ownerpass',
    permissions: { printing: 'highResolution' },
  })
  await save('encrypted.pdf', doc)
}

// 3. form.pdf — an AcroForm with a text field, checkbox, and dropdown.
{
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.addPage([595, 842])
  page.drawText('Please fill in:', { x: 50, y: 792, size: 16, font, color: rgb(0, 0, 0) })
  const form = doc.getForm()

  page.drawText('Name:', { x: 50, y: 744, size: 12, font })
  const name = form.createTextField('name')
  name.setText('')
  name.addToPage(page, { x: 120, y: 738, width: 220, height: 22 })

  page.drawText('Subscribe:', { x: 50, y: 700, size: 12, font })
  const subscribe = form.createCheckBox('subscribe')
  subscribe.addToPage(page, { x: 120, y: 696, width: 18, height: 18 })

  page.drawText('Plan:', { x: 50, y: 660, size: 12, font })
  const plan = form.createDropdown('plan')
  plan.addOptions(['Free', 'Pro', 'Team'])
  plan.select('Free')
  plan.addToPage(page, { x: 120, y: 654, width: 160, height: 22 })

  await save('form.pdf', doc)
}

// 4. landscape.pdf — single landscape page (for orientation/crop tests).
{
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.addPage([842, 595])
  page.drawText('Landscape', { x: 60, y: 520, size: 28, font, color: rgb(0, 0, 0) })
  await save('landscape.pdf', doc)
}

console.log('Fixtures ready. Commit tests/fixtures/*.pdf')
