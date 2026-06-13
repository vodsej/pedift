import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Every annotate tool's option bar must be exactly one row tall, so switching
// tools never changes the toolbar height. Regression guard for the text tool,
// whose four option fields used to wrap the bar onto a second line.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES = path.resolve(__dirname, '../fixtures')
const APP = '/pedift.html'

// 'Select' has no options (bare button row); the rest each render an option bar.
const TOOLS = ['Select', 'Text box', 'Highlight', 'Pen'] as const

async function openDoc(page: import('@playwright/test').Page) {
  await page.goto(APP)
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('.dropzone').first().click(),
  ])
  await chooser.setFiles(path.join(FIXTURES, 'plain-3page.pdf'))
  await expect(page.locator('.pagecanvas__canvas').first()).toBeVisible({ timeout: 30_000 })
}

// Checked at a roomy and a tight width: the tight one is where the text tool
// previously wrapped onto a second row.
for (const width of [1280, 1000]) {
  test(`annotate toolbar stays one row for every tool at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await openDoc(page)

    const heights: number[] = []
    for (const tool of TOOLS) {
      await page.getByRole('button', { name: tool, exact: true }).click()
      const box = await page.locator('.annotate-toolbar').boundingBox()
      heights.push(box!.height)
    }

    // All tools share one height …
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1)
    // … and it's a single row (a wrapped two-row bar is ~2x taller).
    expect(Math.max(...heights)).toBeLessThan(60)
  })
}
