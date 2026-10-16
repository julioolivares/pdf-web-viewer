import { test, expect, type Page } from '@playwright/test'

declare global {
  interface Window {
    testkit: any
  }
}

const PLACEHOLDER = '/example/Placeholder-PDF.pdf' // 2 pages, with annotations
const TRACEMONKEY = '/web/compressed.tracemonkey-pldi-09.pdf' // 14 pages
const PROTECTED = '/test/fixtures/protected.pdf' // 2 pages, password "secret"
const MISSING = '/test/fixtures/does-not-exist.pdf'

type ViewerId = 'viewer-a' | 'viewer-b' | 'viewer-c'

/** Creates a viewer for `file` and mounts it in the element with `id`. */
function mount(page: Page, id: ViewerId, file: unknown, options: Record<string, unknown> = {}) {
  return page.evaluate(([id, file, options]) => void window.testkit.mount(id, file, options), [
    id,
    file,
    options,
  ] as const)
}

/** Calls a viewer method and resolves with its result, or with `{ error }` if it throws or rejects. */
function call(page: Page, id: ViewerId, method: string, ...args: unknown[]) {
  return page.evaluate(
    async ([id, method, args]) => {
      try {
        return { value: await window.testkit.viewers[id][method](...args) }
      } catch (error) {
        return { error: { name: error.name, message: error.message } }
      }
    },
    [id, method, args] as const
  )
}

/** Events recorded by the onLoad, onPageChange and onError callbacks of a viewer. */
function events(page: Page, id: ViewerId) {
  return page.evaluate((id) => window.testkit.events[id] as any[], id)
}

async function loads(page: Page, id: ViewerId) {
  return (await events(page, id)).filter((event) => event.type === 'load')
}

/** Waits until a viewer has fired `onLoad` at least `count` times. */
async function waitForLoads(page: Page, id: ViewerId, count = 1) {
  await expect.poll(async () => (await loads(page, id)).length).toBeGreaterThanOrEqual(count)
}

/** Current state of the PDF.js viewer running in a viewer's iframe. */
function state(page: Page, id: ViewerId) {
  return page.evaluate(async (id) => {
    const app = await window.testkit.viewers[id].getApplication()
    const iframe = document.querySelector<HTMLIFrameElement>(`#${id} iframe`)!
    return {
      url: app.url as string,
      pagesCount: app.pagesCount as number,
      page: app.page as number,
      scale: app.pdfViewer.currentScaleValue as string,
      panelOpen: Boolean(app.viewsManager?.isOpen),
      colorScheme: iframe.contentDocument!.documentElement.style.colorScheme,
      marker: ((iframe.contentWindow as any).__marker ?? null) as string | null,
    }
  }, id)
}

/** Tags the iframe window, so a later check can tell whether the iframe was reloaded. */
function markFrame(page: Page, id: ViewerId) {
  return page.evaluate((id) => {
    const iframe = document.querySelector<HTMLIFrameElement>(`#${id} iframe`)!
    ;(iframe.contentWindow as any).__marker = id
  }, id)
}

const spinner = (page: Page, id: ViewerId) =>
  page.locator(`#${id} .pdf-web-viewer-loading-indicator`)
const viewerFrame = (page: Page, id: ViewerId) => page.frameLocator(`#${id} iframe`)

test.beforeEach(async ({ page }) => {
  await page.goto('/test/fixtures/viewers.html')
  await page.waitForFunction(() => window.testkit)
})

test.describe('multiple viewers', () => {
  test('loads a different PDF in each element', async ({ page }) => {
    await mount(page, 'viewer-a', PLACEHOLDER)
    await mount(page, 'viewer-b', TRACEMONKEY)
    await mount(page, 'viewer-c', TRACEMONKEY, { page: 5, zoom: 'page-fit' })

    await expect(page.locator('.pdf-web-viewer iframe')).toHaveCount(3)
    await waitForLoads(page, 'viewer-a')
    await waitForLoads(page, 'viewer-b')
    await waitForLoads(page, 'viewer-c')

    expect(await loads(page, 'viewer-a')).toEqual([{ type: 'load', pagesCount: 2 }])
    expect(await loads(page, 'viewer-b')).toEqual([{ type: 'load', pagesCount: 14 }])
    await expect
      .poll(() => state(page, 'viewer-c'))
      .toMatchObject({ pagesCount: 14, page: 5, scale: 'page-fit' })
    await expect.poll(() => state(page, 'viewer-b')).toMatchObject({ page: 1 })
  })

  test('setFile on one viewer leaves the others untouched', async ({ page }) => {
    await mount(page, 'viewer-a', PLACEHOLDER)
    await mount(page, 'viewer-b', TRACEMONKEY)
    await mount(page, 'viewer-c', PLACEHOLDER)
    for (const id of ['viewer-a', 'viewer-b', 'viewer-c'] as const) {
      await waitForLoads(page, id)
      await markFrame(page, id)
    }
    await call(page, 'viewer-b', 'goToPage', 4)

    expect(await call(page, 'viewer-a', 'setFile', TRACEMONKEY)).toEqual({ value: undefined })

    expect(await state(page, 'viewer-a')).toMatchObject({ pagesCount: 14, marker: 'viewer-a' })
    expect(await state(page, 'viewer-b')).toMatchObject({
      pagesCount: 14,
      page: 4,
      marker: 'viewer-b',
    })
    expect(await state(page, 'viewer-c')).toMatchObject({ pagesCount: 2, marker: 'viewer-c' })
    expect(await loads(page, 'viewer-b')).toHaveLength(1)
    expect(await loads(page, 'viewer-c')).toHaveLength(1)
  })

  test('swaps files between two viewers at the same time', async ({ page }) => {
    await mount(page, 'viewer-a', PLACEHOLDER)
    await mount(page, 'viewer-b', TRACEMONKEY)
    await waitForLoads(page, 'viewer-a')
    await waitForLoads(page, 'viewer-b')

    await Promise.all([
      call(page, 'viewer-a', 'setFile', TRACEMONKEY),
      call(page, 'viewer-b', 'setFile', PLACEHOLDER),
    ])

    expect(await state(page, 'viewer-a')).toMatchObject({ pagesCount: 14 })
    expect(await state(page, 'viewer-b')).toMatchObject({ pagesCount: 2 })
  })

  test('destroying one viewer keeps the others working', async ({ page }) => {
    await mount(page, 'viewer-a', PLACEHOLDER)
    await mount(page, 'viewer-b', TRACEMONKEY)
    await waitForLoads(page, 'viewer-a')
    await waitForLoads(page, 'viewer-b')

    await call(page, 'viewer-a', 'destroy')

    await expect(page.locator('#viewer-a .pdf-web-viewer')).toHaveCount(0)
    expect(await call(page, 'viewer-a', 'goToPage', 1)).toEqual({
      error: { name: 'Error', message: 'The viewer has been destroyed.' },
    })
    expect(await call(page, 'viewer-b', 'goToPage', 3)).toEqual({ value: undefined })
    expect(await state(page, 'viewer-b')).toMatchObject({ page: 3 })
  })
})

test.describe('setFile', () => {
  test('opens the new file in the running viewer, without reloading it', async ({ page }) => {
    await mount(page, 'viewer-a', PLACEHOLDER)
    await waitForLoads(page, 'viewer-a')
    await markFrame(page, 'viewer-a')

    await call(page, 'viewer-a', 'setFile', TRACEMONKEY)

    // setFile resolves once the file is loaded, so onLoad has already fired.
    expect(await loads(page, 'viewer-a')).toHaveLength(2)
    expect(await state(page, 'viewer-a')).toMatchObject({
      url: expect.stringContaining(TRACEMONKEY),
      pagesCount: 14,
      marker: 'viewer-a',
    })
    await expect(spinner(page, 'viewer-a')).toBeHidden()
  })

  test('the last file wins when switching quickly', async ({ page }) => {
    await mount(page, 'viewer-a', PLACEHOLDER)
    await waitForLoads(page, 'viewer-a')

    await page.evaluate(
      ([files]) =>
        Promise.allSettled(files.map((file) => window.testkit.viewers['viewer-a'].setFile(file))),
      [[TRACEMONKEY, PROTECTED, PLACEHOLDER, TRACEMONKEY]] as const
    )

    expect(await state(page, 'viewer-a')).toMatchObject({
      url: expect.stringContaining(TRACEMONKEY),
      pagesCount: 14,
    })
    expect((await events(page, 'viewer-a')).filter((event) => event.type === 'error')).toEqual([])
    await expect(viewerFrame(page, 'viewer-a').locator('#passwordDialog')).toBeHidden()
    await expect(spinner(page, 'viewer-a')).toBeHidden()
  })

  test('works before mount', async ({ page }) => {
    // `testkit.mount` mounts right away, so the viewer is created by hand here.
    await page.evaluate(
      ([first, second]) => {
        const events: any[] = (window.testkit.events['viewer-b'] = [])
        const viewer = window.testkit.create(first, {
          viewerPath: '/dist/web/viewer.html',
          onLoad: (info: any) => events.push({ type: 'load', ...info }),
        })
        viewer.setFile(second)
        viewer.mount(document.getElementById('viewer-b'))
        window.testkit.viewers['viewer-b'] = viewer
      },
      [PLACEHOLDER, TRACEMONKEY] as const
    )

    await waitForLoads(page, 'viewer-b')
    expect(await loads(page, 'viewer-b')).toEqual([{ type: 'load', pagesCount: 14 }])
  })

  test('rejects and calls onError when the file cannot be loaded', async ({ page }) => {
    await mount(page, 'viewer-a', PLACEHOLDER)
    await waitForLoads(page, 'viewer-a')

    const result = await call(page, 'viewer-a', 'setFile', MISSING)

    expect(result.error?.message).toContain('404')
    await expect
      .poll(async () => (await events(page, 'viewer-a')).filter((event) => event.type === 'error'))
      .toEqual([{ type: 'error', message: expect.stringContaining('404') }])
    await expect(spinner(page, 'viewer-a')).toBeHidden()

    // The viewer still works afterwards.
    expect(await call(page, 'viewer-a', 'setFile', TRACEMONKEY)).toEqual({ value: undefined })
    expect(await state(page, 'viewer-a')).toMatchObject({ pagesCount: 14 })
  })

  test('throws right away for paths that are not PDF files', async ({ page }) => {
    await mount(page, 'viewer-a', PLACEHOLDER)
    await waitForLoads(page, 'viewer-a')

    const errors = await page.evaluate(() => {
      const messages: string[] = []
      for (const run of [
        () => window.testkit.viewers['viewer-a'].setFile('/notes.txt'),
        () => window.testkit.viewers['viewer-a'].setFile(''),
        () => window.testkit.create('/notes.txt'),
      ]) {
        try {
          run()
          messages.push('no error')
        } catch (error) {
          messages.push(error.message)
        }
      }
      return messages
    })

    expect(errors).toEqual([
      'Only PDF files are supported.',
      'Source PDF URL is required.',
      'Only PDF files are supported.',
    ])
    await expect(spinner(page, 'viewer-a')).toBeHidden()
  })

  test('loads a PDF from another origin that allows CORS', async ({ page }) => {
    const remote = 'https://cdn.example.test/files/remote.pdf'
    await page.route(remote, (route) =>
      route.fulfill({
        path: 'example/Placeholder-PDF.pdf',
        headers: { 'access-control-allow-origin': '*', 'content-type': 'application/pdf' },
      })
    )

    await mount(page, 'viewer-a', remote)
    await mount(page, 'viewer-b', PLACEHOLDER)
    await waitForLoads(page, 'viewer-a')
    await waitForLoads(page, 'viewer-b')
    await call(page, 'viewer-b', 'setFile', remote)

    expect(await state(page, 'viewer-a')).toMatchObject({ url: remote, pagesCount: 2 })
    expect(await state(page, 'viewer-b')).toMatchObject({ url: remote, pagesCount: 2 })
  })
})

type SourceKind = 'file' | 'blob' | 'arrayBuffer' | 'uint8Array'

const CROSS_ORIGIN_ERROR =
  'This feature needs the viewer (viewerPath) to be served from the same origin as the page.'

/** Like `mount`, with the PDF at `path` given as `kind` (built in the page: it cannot be serialized). */
function mountSource(
  page: Page,
  id: ViewerId,
  kind: SourceKind,
  path: string,
  options: Record<string, unknown> = {}
) {
  return page.evaluate(
    async ([id, kind, path, options]) =>
      void window.testkit.mount(id, await window.testkit.source(kind, path), options),
    [id, kind, path, options] as const
  )
}

/** Like `call(page, id, 'setFile', ...)`, with the PDF at `path` given as `kind`. */
function setFileSource(page: Page, id: ViewerId, kind: SourceKind, path: string) {
  return page.evaluate(
    async ([id, kind, path]) => {
      try {
        const source = await window.testkit.source(kind, path)
        return { value: await window.testkit.viewers[id].setFile(source) }
      } catch (error) {
        return { error: { name: error.name, message: error.message } }
      }
    },
    [id, kind, path] as const
  )
}

test.describe('file sources', () => {
  for (const kind of ['file', 'blob', 'arrayBuffer', 'uint8Array'] as const) {
    test(`opens a PDF given as ${kind}`, async ({ page }) => {
      await mountSource(page, 'viewer-a', kind, TRACEMONKEY, { page: 3 })
      await mount(page, 'viewer-b', PLACEHOLDER)
      await waitForLoads(page, 'viewer-a')
      await waitForLoads(page, 'viewer-b')

      await expect.poll(() => state(page, 'viewer-a')).toMatchObject({ pagesCount: 14, page: 3 })
      await expect(spinner(page, 'viewer-a')).toBeHidden()

      await markFrame(page, 'viewer-b')
      expect(await setFileSource(page, 'viewer-b', kind, TRACEMONKEY)).toEqual({ value: undefined })
      expect(await state(page, 'viewer-b')).toMatchObject({ pagesCount: 14, marker: 'viewer-b' })
      await expect(spinner(page, 'viewer-b')).toBeHidden()
    })
  }

  test('uses the name of a File for the download', async ({ page }) => {
    await mountSource(page, 'viewer-a', 'file', PLACEHOLDER)
    await waitForLoads(page, 'viewer-a')

    const filename = await page.evaluate(
      async () => (await window.testkit.viewers['viewer-a'].getApplication())._docFilename
    )
    expect(filename).toBe('Placeholder-PDF.pdf')
  })

  test('opens a Blob fetched from a URL that does not end with .pdf', async ({ page }) => {
    // An API that returns the PDF with a generic content type.
    await page.route('**/api/reports/*', async (route) => {
      const pdf = new URL(route.request().url()).pathname.endsWith('/1') ? PLACEHOLDER : TRACEMONKEY
      const response = await route.fetch({ url: new URL(pdf, page.url()).href })
      await route.fulfill({
        body: await response.body(),
        contentType: 'application/octet-stream',
      })
    })

    await page.evaluate(async () => {
      const response = await fetch('/api/reports/1')
      window.testkit.mount('viewer-a', await response.blob())
    })
    await waitForLoads(page, 'viewer-a')
    expect(await state(page, 'viewer-a')).toMatchObject({ pagesCount: 2 })

    const result = await page.evaluate(async () => {
      const response = await fetch('/api/reports/2')
      return window.testkit.viewers['viewer-a'].setFile(await response.blob())
    })
    expect(result).toBeUndefined()
    expect(await state(page, 'viewer-a')).toMatchObject({ pagesCount: 14 })
  })

  test('opens the File picked in an <input type="file">', async ({ page }) => {
    await mount(page, 'viewer-a', PLACEHOLDER)
    await waitForLoads(page, 'viewer-a')
    await page.evaluate(() => {
      const input = document.createElement('input')
      input.type = 'file'
      input.id = 'pdf-file'
      input.addEventListener('change', () => {
        ;(window as any).picked = window.testkit.viewers['viewer-a'].setFile(input.files![0])
      })
      document.body.append(input)
    })

    await page.locator('#pdf-file').setInputFiles('web/compressed.tracemonkey-pldi-09.pdf')
    await page.waitForFunction(() => (window as any).picked)
    expect(await page.evaluate(() => (window as any).picked)).toBeUndefined()

    const app = await page.evaluate(async () => {
      const app = await window.testkit.viewers['viewer-a'].getApplication()
      return { pagesCount: app.pagesCount, filename: app._docFilename }
    })
    expect(app).toEqual({ pagesCount: 14, filename: 'compressed.tracemonkey-pldi-09.pdf' })
  })

  test('leaves the bytes passed by the caller untouched', async ({ page }) => {
    await page.evaluate(async (path) => {
      const bytes = await window.testkit.source('uint8Array', path)
      ;(window as any).bytes = bytes
      window.testkit.mount('viewer-a', bytes)
    }, PLACEHOLDER)
    await waitForLoads(page, 'viewer-a')

    const result = await page.evaluate(async () => {
      const bytes: Uint8Array = (window as any).bytes
      const before = bytes.byteLength
      await window.testkit.viewers['viewer-a'].setFile(bytes)
      return { before, after: bytes.byteLength }
    })
    expect(result.before).toBeGreaterThan(0)
    expect(result.after).toBe(result.before)
    expect(await loads(page, 'viewer-a')).toHaveLength(2)
  })

  test('throws right away for unsupported sources', async ({ page }) => {
    const errors = await page.evaluate(() => {
      const messages: string[] = []
      for (const source of [
        42,
        null,
        { url: '/example/Placeholder-PDF.pdf' },
        new Uint16Array([1, 2]),
        new DataView(new ArrayBuffer(1)),
        '',
        'JVBERi0 not base64!',
        'data:application/pdf;base64,JVBERi0',
      ]) {
        try {
          window.testkit.create(source)
          messages.push('no error')
        } catch (error) {
          messages.push(error.message)
        }
      }
      return messages
    })

    expect(errors).toEqual([
      'Unsupported PDF source.',
      'Source PDF URL is required.',
      'Unsupported PDF source.',
      'Unsupported PDF source.',
      'Unsupported PDF source.',
      'Source PDF URL is required.',
      'Only PDF files are supported.',
      'Only PDF files are supported.',
    ])
  })

  test('rejects bytes that are not a PDF', async ({ page }) => {
    await mount(page, 'viewer-a', PLACEHOLDER)
    await waitForLoads(page, 'viewer-a')

    const result = await page.evaluate(async () => {
      try {
        await window.testkit.viewers['viewer-a'].setFile(new Uint8Array([1, 2, 3]))
        return 'no error'
      } catch (error) {
        return error.message
      }
    })
    expect(result).not.toBe('no error')
    await expect(spinner(page, 'viewer-a')).toBeHidden()
  })

  test('bytes need a viewer on the same origin', async ({ page }) => {
    // Serve the viewer from another origin, backed by the test server.
    const viewerOrigin = 'http://viewer.test'
    await page.route(`${viewerOrigin}/**`, async (route) => {
      const { pathname, search } = new URL(route.request().url())
      const response = await route.fetch({ url: new URL(pathname + search, page.url()).href })
      await route.fulfill({ response })
    })
    const requested: string[] = []
    page.on('request', (request) => requested.push(request.url()))

    await mountSource(page, 'viewer-a', 'uint8Array', PLACEHOLDER, {
      viewerPath: `${viewerOrigin}/dist/web/viewer.html`,
    })
    await expect
      .poll(() => events(page, 'viewer-a'))
      .toEqual([{ type: 'error', message: CROSS_ORIGIN_ERROR }])
    await expect(spinner(page, 'viewer-a')).toBeHidden()

    expect(await setFileSource(page, 'viewer-a', 'uint8Array', PLACEHOLDER)).toEqual({
      error: { name: 'Error', message: CROSS_ORIGIN_ERROR },
    })
    await expect(spinner(page, 'viewer-a')).toBeHidden()

    // Plain URLs still work there.
    expect(await call(page, 'viewer-a', 'setFile', `${viewerOrigin}${PLACEHOLDER}`)).toEqual({
      value: undefined,
    })
    await expect(viewerFrame(page, 'viewer-a').locator('#viewer .page')).toHaveCount(2)
    // The viewer started empty instead of opening the PDF.js sample file.
    expect(requested.some((url) => url.includes('tracemonkey'))).toBe(false)
  })
})

test.describe('view controls', () => {
  test('applies the initial options', async ({ page }) => {
    await mount(page, 'viewer-a', TRACEMONKEY, {
      page: 3,
      zoom: 'page-width',
      displayPagePanel: true,
      theme: 'dark',
      locale: 'es-ES',
    })
    await waitForLoads(page, 'viewer-a')

    await expect
      .poll(() => state(page, 'viewer-a'))
      .toMatchObject({ page: 3, scale: 'page-width', panelOpen: true, colorScheme: 'dark' })
    await expect(viewerFrame(page, 'viewer-a').locator('#viewFindButton')).toHaveAttribute(
      'title',
      'Buscar en el documento'
    )
  })

  test('goToPage and setZoom called right after mount are not overwritten', async ({ page }) => {
    await page.evaluate(
      ([file]) => {
        const viewer = window.testkit.mount('viewer-a', file, { zoom: 'page-width' })
        viewer.goToPage(5)
        viewer.setZoom(150)
      },
      [TRACEMONKEY] as const
    )
    await waitForLoads(page, 'viewer-a')

    await expect.poll(() => state(page, 'viewer-a')).toMatchObject({ page: 5, scale: '1.5' })
    const pageChanges = (await events(page, 'viewer-a')).filter((event) => event.type === 'page')
    expect(pageChanges.at(-1)).toEqual({ type: 'page', page: 5, pagesCount: 14 })
  })

  test('changes page, zoom, page panel and theme', async ({ page }) => {
    await mount(page, 'viewer-a', TRACEMONKEY)
    await waitForLoads(page, 'viewer-a')

    await call(page, 'viewer-a', 'goToPage', 7)
    await call(page, 'viewer-a', 'setZoom', 'page-fit')
    await call(page, 'viewer-a', 'setPagePanel', true)
    await call(page, 'viewer-a', 'setTheme', 'dark')
    await expect
      .poll(() => state(page, 'viewer-a'))
      .toMatchObject({ page: 7, scale: 'page-fit', panelOpen: true, colorScheme: 'dark' })

    await call(page, 'viewer-a', 'setZoom', 80)
    await call(page, 'viewer-a', 'setPagePanel', false)
    await call(page, 'viewer-a', 'setTheme', 'auto')
    await expect
      .poll(() => state(page, 'viewer-a'))
      .toMatchObject({ scale: '0.8', panelOpen: false, colorScheme: '' })
  })

  test('rejects pages and zoom levels that are out of range', async ({ page }) => {
    await mount(page, 'viewer-a', PLACEHOLDER)
    await waitForLoads(page, 'viewer-a')

    expect(await call(page, 'viewer-a', 'goToPage', 3)).toEqual({
      error: { name: 'RangeError', message: 'Page 3 is out of range (1-2).' },
    })
    expect(await call(page, 'viewer-a', 'goToPage', 0)).toMatchObject({
      error: { name: 'RangeError' },
    })
    expect(await call(page, 'viewer-a', 'setZoom', 0)).toMatchObject({
      error: { name: 'RangeError' },
    })
  })

  test('search highlights the matches', async ({ page }) => {
    await mount(page, 'viewer-a', TRACEMONKEY)
    await waitForLoads(page, 'viewer-a')

    await call(page, 'viewer-a', 'search', 'Trace')

    await expect(
      viewerFrame(page, 'viewer-a').locator('.textLayer .highlight').first()
    ).toBeVisible()
  })
})

test.describe('loading indicator', () => {
  test('is centered in its own container', async ({ page }) => {
    await page.route(PLACEHOLDER, async (route) => {
      // Delay the PDF so the indicator stays visible while it is measured.
      await new Promise((resolve) => setTimeout(resolve, 1500))
      await route.continue()
    })
    await mount(page, 'viewer-b', PLACEHOLDER)

    const indicator = await spinner(page, 'viewer-b').boundingBox()
    const container = await page.locator('#viewer-b').boundingBox()
    expect(indicator).not.toBeNull()
    expect(indicator!.x + indicator!.width / 2).toBeCloseTo(container!.x + container!.width / 2, 0)
    expect(indicator!.y + indicator!.height / 2).toBeCloseTo(
      container!.y + container!.height / 2,
      0
    )
  })

  test('hides while the password dialog is open', async ({ page }) => {
    await mount(page, 'viewer-a', PLACEHOLDER)
    await waitForLoads(page, 'viewer-a')

    const loaded = call(page, 'viewer-a', 'setFile', PROTECTED)
    const frame = viewerFrame(page, 'viewer-a')
    await expect(frame.locator('#passwordDialog')).toBeVisible()
    await expect(spinner(page, 'viewer-a')).toBeHidden()

    await frame.locator('#password').fill('secret')
    await frame.locator('#passwordSubmit').click()

    expect(await loaded).toEqual({ value: undefined })
    expect(await state(page, 'viewer-a')).toMatchObject({ pagesCount: 2 })
  })

  test('cancelling the password dialog rejects setFile', async ({ page }) => {
    await mount(page, 'viewer-a', PLACEHOLDER)
    await waitForLoads(page, 'viewer-a')

    const loaded = call(page, 'viewer-a', 'setFile', PROTECTED)
    const frame = viewerFrame(page, 'viewer-a')
    await expect(frame.locator('#passwordDialog')).toBeVisible()
    await frame.locator('#passwordCancel').click()

    expect((await loaded).error?.message).toBe('No password given')
    await expect(spinner(page, 'viewer-a')).toBeHidden()
  })
})
