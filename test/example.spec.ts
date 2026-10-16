import { test, expect, type Page } from '@playwright/test'

// The playground preview (example/demo.html + run.js). It runs the prebuilt example/lib,
// so run `pnpm build:example` after changing src/.

/** The PDF.js viewer application running in the demo page. */
function app(page: Page) {
  const frame = page.frames().find((frame) => frame.url().includes('/lib/web/viewer.html'))
  if (!frame) return null
  return frame
    .evaluate(() => {
      const app = (window as any).PDFViewerApplication
      return app?.pdfDocument
        ? { pagesCount: app.pagesCount as number, filename: app._docFilename as string }
        : null
    })
    .catch(() => null)
}

test('the demo shows the sample PDF and opens the file picked by the user', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  await page.goto('/example/demo.html')
  await expect.poll(() => app(page)).toEqual({ pagesCount: 2, filename: 'Placeholder-PDF.pdf' })

  const viewer = page.frameLocator('.pdf-container iframe')
  await viewer.locator('body').evaluate(() => ((window as any).__marker = 'first load'))

  await page.locator('#pdf-file').setInputFiles('web/compressed.tracemonkey-pldi-09.pdf')
  await expect
    .poll(() => app(page))
    .toEqual({ pagesCount: 14, filename: 'compressed.tracemonkey-pldi-09.pdf' })

  // The file opened in the running viewer, without reloading it.
  expect(await viewer.locator('body').evaluate(() => (window as any).__marker)).toBe('first load')
  expect(errors).toEqual([])
})
