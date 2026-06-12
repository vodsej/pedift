import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES = path.resolve(__dirname, '../fixtures')
const APP = '/pedift.html'

async function openPdfViaChooser(page: import('@playwright/test').Page, filePath: string) {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('.dropzone').first().click(),
  ])
  await chooser.setFiles(filePath)
}

async function waitForCanvas(page: import('@playwright/test').Page) {
  await expect(page.locator('.pagecanvas__canvas').first()).toBeVisible({ timeout: 30_000 })
}

// The fixture has "The quick brown fox jumps over the lazy dog." + "Page N" on
// each of 3 pages, so "fox" → 3 matches and "Page 2" → 1 match on page 2.

test('find: Ctrl+F searches across pages, highlights, and navigates', async ({ page }) => {
  await page.goto(APP)
  await openPdfViaChooser(page, path.join(FIXTURES, 'plain-3page.pdf'))
  await waitForCanvas(page)

  // The toolbar Find button toggles the bar (and reflects open state).
  const findBtn = page.getByRole('button', { name: 'Find', exact: true })
  await findBtn.click()
  await expect(page.locator('.find-bar')).toBeVisible()
  await expect(findBtn).toHaveAttribute('aria-pressed', 'true')
  await findBtn.click()
  await expect(page.locator('.find-bar')).toHaveCount(0)

  // Open the find bar and search a word present on every page.
  await page.keyboard.press('Control+f')
  const input = page.locator('.find-bar__input')
  await expect(input).toBeFocused()
  await input.pressSequentially('fox')

  const count = page.locator('.find-bar__count')
  await expect(count).toHaveText('1 of 3', { timeout: 10_000 })
  // A highlight is painted over the current page.
  await expect(page.locator('.search-hl').first()).toBeVisible()

  // Next match jumps to page 2.
  await page.keyboard.press('Enter')
  await expect(count).toHaveText('2 of 3')
  await expect(page.locator('.stage__statusbar')).toHaveText(/Page 2 of 3/i)

  // Shift+Enter wraps back to the first match on page 1.
  await page.keyboard.press('Shift+Enter')
  await expect(count).toHaveText('1 of 3')
  await expect(page.locator('.stage__statusbar')).toHaveText(/Page 1 of 3/i)

  // A page-specific query navigates straight to that page.
  await input.fill('')
  await input.pressSequentially('Page 2')
  await expect(count).toHaveText('1 of 1', { timeout: 10_000 })
  await expect(page.locator('.stage__statusbar')).toHaveText(/Page 2 of 3/i)

  // A missing term reports no results and paints nothing.
  await input.fill('')
  await input.pressSequentially('zzzznotfound')
  await expect(count).toHaveText(/No results/i, { timeout: 10_000 })
  await expect(page.locator('.search-hl')).toHaveCount(0)

  // Escape closes the bar.
  await page.keyboard.press('Escape')
  await expect(page.locator('.find-bar')).toHaveCount(0)
})
