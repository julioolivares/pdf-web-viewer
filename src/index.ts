import { Utils } from './utils.util'
import { create as createLoading } from './loading'
import type { Locale } from './locale'

/**
 * Zoom level: one of the PDF.js presets or a percentage (e.g. `150` for 150%).
 */
export type Zoom = 'auto' | 'page-actual' | 'page-fit' | 'page-width' | number

/**
 * Color theme of the viewer UI. `'auto'` follows the system preference.
 */
export type Theme = 'auto' | 'light' | 'dark'

/**
 * Options accepted by `viewer.search`.
 */
export interface SearchOptions {
  /** @default false */
  caseSensitive?: boolean
  /** @default false */
  entireWord?: boolean
  /** Highlight every match, not only the current one. @default true */
  highlightAll?: boolean
}

/**
 * The PDF.js `PDFViewerApplication` running inside the viewer iframe.
 * Only the members used most often are typed; see the PDF.js source for the rest.
 */
export interface PdfViewerApplication {
  /** Opens a new document in the running viewer. */
  open(args: { url: string } & Record<string, any>): Promise<void>
  /** Current page number (1-based). */
  page: number
  /** Number of pages of the open document (0 while loading). */
  readonly pagesCount: number
  readonly initializedPromise: Promise<void>
  pdfViewer: any
  pdfDocument: any
  eventBus: {
    on(
      eventName: string,
      listener: (event: any) => void,
      options?: { once?: boolean; signal?: AbortSignal }
    ): void
    off(eventName: string, listener: (event: any) => void): void
    dispatch(eventName: string, data: Record<string, any>): void
  }
  [key: string]: any
}

/**
 * Options accepted by `create`.
 */
export interface PdfWebViewerOptions {
  /**
   * Width of the viewer (any CSS length).
   * @default '100%'
   */
  width?: string
  /**
   * Height of the viewer (any CSS length).
   * @default '100%'
   */
  height?: string
  /**
   * Open the viewer with the page thumbnails panel visible.
   * @default false
   */
  displayPagePanel?: boolean
  /**
   * Path or URL of the bundled PDF.js `viewer.html`, resolved against `document.baseURI`.
   * @default `${location.origin}/node_modules/pdf-web-viewer/dist/web/viewer.html`
   */
  viewerPath?: string
  /**
   * Language of the viewer UI, e.g. 'en-US' or 'es-ES'. Unknown values fall back to English.
   * @default navigator.language
   */
  locale?: Locale | (string & {})
  /**
   * Page shown when the first document opens (1-based).
   * @default 1
   */
  page?: number
  /**
   * Zoom applied when a document opens: a preset or a percentage (e.g. `150`).
   * @default 'auto'
   */
  zoom?: Zoom
  /**
   * Color theme of the viewer UI.
   * @default 'auto'
   */
  theme?: Theme
  /** Called every time a document finishes loading. */
  onLoad?: (info: { pagesCount: number }) => void
  /** Called when the current page changes. */
  onPageChange?: (info: { page: number; pagesCount: number }) => void
  /** Called when a document fails to load. */
  onError?: (error: Error) => void
}

const CROSS_ORIGIN_ERROR =
  'This feature needs the viewer (viewerPath) to be served from the same origin as the page.'
const DESTROYED_ERROR = 'The viewer has been destroyed.'
const LOAD_ERROR = 'The PDF file could not be loaded.'

/**
 * Messages PDF.js reports for a document that was already closed, e.g. replaced by `setFile`
 * while its pages were still loading. They do not concern the current document.
 */
const CLOSED_DOCUMENT_ERROR = /^(Transport destroyed|Worker was destroyed|Loading aborted)/

/**
 * Turns a PDF.js `documenterror` event into an `Error`, or `null` if it belongs to a closed document.
 */
const documentError = (event: { reason?: string | null; message?: string }): Error | null => {
  if (event.reason && CLOSED_DOCUMENT_ERROR.test(event.reason)) return null
  return new Error(event.reason ?? event.message ?? LOAD_ERROR)
}

/**
 * Resolves on the next `eventName` of the viewer, rejects on the next error of the current document.
 */
const nextDocumentEvent = (app: PdfViewerApplication, eventName: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const controller = new AbortController()
    const { signal } = controller
    app.eventBus.on(
      eventName,
      () => {
        controller.abort()
        resolve()
      },
      { signal }
    )
    app.eventBus.on(
      'documenterror',
      (event) => {
        const error = documentError(event)
        if (!error) return
        controller.abort()
        reject(error)
      },
      { signal }
    )
  })

/**
 * Class for previewing PDF files using an iframe and the PDF.js viewer.
 * Provides methods to mount the viewer, change the displayed PDF file and control
 * the running viewer (page, zoom, search, page panel and theme).
 */
class PdfWebViewer {
  /**
   * Last instance created by `create`.
   * @type {PdfWebViewer}
   * @private
   */
  private static instance: PdfWebViewer

  private isMounted: boolean = false

  private isDestroyed: boolean = false

  private loadingIndicator: ReturnType<typeof createLoading>

  private options: Omit<PdfWebViewerOptions, 'width' | 'height' | 'displayPagePanel' | 'theme'> & {
    width: string
    height: string
    displayPagePanel: boolean
    theme: Theme
  } = {
    displayPagePanel: false,
    width: '100%',
    height: '100%',
    theme: 'auto',
  }

  /**
   * Element inserted by `mount`: holds the iframe and the loading indicator.
   * @private
   */
  private wrapper: HTMLDivElement

  /**
   * Iframe instance where the PDF viewer is loaded.
   * @type {HTMLIFrameElement}
   * @private
   */
  private iframeInstance: HTMLIFrameElement

  /**
   * `PDFViewerApplication` of the current iframe document, once initialized.
   * @private
   */
  private app: PdfViewerApplication | null = null

  /**
   * Resolves with the initialized `PDFViewerApplication`, or `null` when it is not reachable
   * (viewer served from another origin) or the viewer was destroyed.
   * @private
   */
  private appReady: Promise<PdfViewerApplication | null>

  private resolveApp: (app: PdfViewerApplication | null) => void

  /**
   * Increments on every `setFile`, so only the latest load hides the loading indicator.
   * @private
   */
  private loadId: number = 0

  /**
   * Settles when the latest `setFile` finishes (it never rejects), so view changes target the new file.
   * @private
   */
  private pendingFile: Promise<void> = Promise.resolve()

  /**
   * Resolves the URL of the PDF.js viewer (viewer.html).
   * By default it points to `node_modules/pdf-web-viewer/dist/web/viewer.html` at `location.origin`.
   * A custom `viewerPath` is resolved against `document.baseURI`, so relative paths work
   * when the page is not served from the domain root (e.g. GitHub Pages project sites).
   * @param {string} [viewerPath] - Custom path or URL of viewer.html
   * @returns {string} Absolute URL to the viewer.html
   * @private
   */
  private static resolveViewerBase(viewerPath?: string): string {
    if (viewerPath) {
      return new URL(viewerPath, document.baseURI).href
    }
    return `${location.origin}/node_modules/pdf-web-viewer/dist/web/viewer.html`
  }

  /**
   * Resolves the path of the PDF file to display to an absolute URL.
   * Absolute http(s) URLs are kept; other paths are resolved from the site root.
   * @param {string} filePath - Path or URL of the PDF file
   * @returns {string} Absolute URL of the PDF file
   * @private
   */
  private static resolveFileUrl(filePath: string): string {
    const trimmed = filePath.trim()
    const prefix = trimmed.toLowerCase()
    if (prefix.startsWith('http:') || prefix.startsWith('https:')) {
      return trimmed
    }
    return `${location.origin}${trimmed.startsWith('/') ? trimmed : '/' + trimmed}`
  }

  /**
   * Throws when `filePath` is missing or is not a PDF.
   * @param {string} filePath - Path or URL of the PDF file
   * @private
   */
  private static assertPdf(filePath: string): void {
    if (!filePath) {
      throw new Error('Source PDF URL is required.')
    }
    if (!/\.pdf($|[?#])/i.test(filePath)) {
      throw new Error('Only PDF files are supported.')
    }
  }

  /**
   * Builds the PDF.js hash parameters (page, zoom and page panel) applied when a document opens.
   * @param {boolean} includePage - Whether to include the initial `page` option.
   * @returns {string} Hash parameters without the leading `#`
   * @private
   */
  private viewHash(includePage: boolean): string {
    const params: string[] = []
    if (includePage && this.options.page) params.push(`page=${this.options.page}`)
    if (this.options.zoom !== undefined) params.push(`zoom=${this.options.zoom}`)
    params.push(`pagemode=${this.options.displayPagePanel ? 'thumbs' : 'none'}`)
    return params.join('&')
  }

  /**
   * Builds the complete viewer URL with the PDF file as a parameter.
   * @param {string} fileUrl - Absolute URL of the PDF file
   * @returns {string} Viewer URL with the PDF loaded
   * @private
   */
  private viewerUrlFor(fileUrl: string): string {
    const base = PdfWebViewer.resolveViewerBase(this.options.viewerPath)
    return `${base}?file=${encodeURIComponent(fileUrl)}#${this.viewHash(true)}`
  }

  /**
   * Starts waiting for a new `PDFViewerApplication` (first load or iframe reload).
   * @private
   */
  private resetApp(): void {
    this.app = null
    this.appReady = new Promise((resolve) => {
      this.resolveApp = resolve
    })
  }

  /**
   * Private constructor. Initializes the iframe with the provided PDF file and options.
   * @param {string} filePath - Path or URL of the PDF file to display.
   * @param {PdfWebViewerOptions} [options] - Optional settings for the viewer.
   * @private
   */
  private constructor(filePath: string, options?: PdfWebViewerOptions) {
    PdfWebViewer.assertPdf(filePath)
    this.options = {
      ...options,
      width: options?.width ?? '100%',
      height: options?.height ?? '100%',
      displayPagePanel: options?.displayPagePanel ?? false,
      theme: options?.theme ?? 'auto',
    }

    this.wrapper = document.createElement('div')
    this.wrapper.className = 'pdf-web-viewer'
    this.wrapper.style.position = 'relative'
    this.wrapper.style.width = this.options.width
    this.wrapper.style.height = this.options.height

    this.iframeInstance = document.createElement('iframe')
    this.iframeInstance.src = this.viewerUrlFor(PdfWebViewer.resolveFileUrl(filePath))
    this.iframeInstance.style.display = 'block'
    this.iframeInstance.style.width = '100%'
    this.iframeInstance.style.height = '100%'
    this.iframeInstance.style.border = 'none'
    this.iframeInstance.loading = 'lazy'
    this.iframeInstance.allow = 'fullscreen'
    this.iframeInstance.id = `pdf_${Utils.generateUUID()}`

    this.loadingIndicator = createLoading()
    this.wrapper.append(this.iframeInstance, this.loadingIndicator.loadingElement)

    this.resetApp()
  }

  /**
   * Configures the PDF.js viewer before it initializes.
   * The viewer dispatches `webviewerloaded` on the parent document (same origin only),
   * which is the only point where options like `localeProperties` can still be changed.
   * @param {Event} event - The `webviewerloaded` event.
   * @private
   */
  private onViewerLoaded = (event: Event): void => {
    const source = (event as CustomEvent<{ source: any }>).detail?.source
    if (!source || source !== this.iframeInstance.contentWindow) return

    if (this.options.locale) {
      source.PDFViewerApplicationOptions?.set('localeProperties', { lang: this.options.locale })
    }
    this.applyTheme(source.document)

    const app: PdfViewerApplication | undefined = source.PDFViewerApplication
    app?.initializedPromise.then(() => {
      if (this.isDestroyed || source !== this.iframeInstance.contentWindow) return
      this.app = app
      this.bindEvents(app)
      this.resolveApp(app)
    })
  }

  /**
   * Hides the initial loading indicator and detects a viewer served from another origin,
   * where `PDFViewerApplication` cannot be reached.
   * @private
   */
  private onIframeLoad = async (): Promise<void> => {
    if (!this.app) {
      let reachable = false
      try {
        reachable = Boolean((this.iframeInstance.contentWindow as any)?.PDFViewerApplication)
      } catch {
        reachable = false
      }
      if (!reachable) this.resolveApp(null)
    }

    await new Promise((resolve) => setTimeout(resolve, 180))
    this.loadingIndicator.hide()
  }

  /**
   * Forwards PDF.js events to the `onLoad`, `onPageChange` and `onError` callbacks, and hides
   * the loading indicator when PDF.js asks for a password (it has no event for that).
   * The listeners go away with the iframe document, so they need no cleanup.
   * @param {PdfViewerApplication} app - The initialized viewer application.
   * @private
   */
  private bindEvents(app: PdfViewerApplication): void {
    const passwordPrompt = app.passwordPrompt
    if (typeof passwordPrompt?.open === 'function') {
      const openPasswordPrompt = passwordPrompt.open.bind(passwordPrompt)
      passwordPrompt.open = (...args: unknown[]) => {
        this.loadingIndicator.hide()
        return openPasswordPrompt(...args)
      }
    }

    app.eventBus.on('documentloaded', () => {
      this.options.onLoad?.({ pagesCount: app.pagesCount })
    })
    app.eventBus.on('pagechanging', (event) => {
      this.options.onPageChange?.({ page: event.pageNumber, pagesCount: app.pagesCount })
    })
    app.eventBus.on('documenterror', (event) => {
      const error = documentError(event)
      if (error) this.options.onError?.(error)
    })
  }

  /**
   * Applies the configured theme to the viewer document. PDF.js styles follow `color-scheme`.
   * @param {Document | null} doc - The viewer document.
   * @private
   */
  private applyTheme(doc: Document | null | undefined): void {
    if (!doc) return
    if (this.options.theme === 'auto') {
      doc.documentElement.style.removeProperty('color-scheme')
    } else {
      doc.documentElement.style.setProperty('color-scheme', this.options.theme)
    }
  }

  /**
   * Throws if the viewer was destroyed.
   * @private
   */
  private assertAlive(): void {
    if (this.isDestroyed) {
      throw new Error(DESTROYED_ERROR)
    }
  }

  /**
   * Waits for the viewer application. Throws when it is not reachable.
   * @private
   */
  private async requireApp(): Promise<PdfViewerApplication> {
    this.assertAlive()
    const app = await this.appReady
    this.assertAlive()
    if (!app) {
      throw new Error(CROSS_ORIGIN_ERROR)
    }
    return app
  }

  /**
   * Waits until PDF.js has applied the initial view (page and zoom from the options or its
   * history) to the current document. Changing page or zoom earlier would be overwritten.
   * @private
   */
  private async requireDocument(): Promise<PdfViewerApplication> {
    const app = await this.requireApp()
    await this.pendingFile
    this.assertAlive()
    if (app.pdfDocument && app.isInitialViewSet) return app

    await nextDocumentEvent(app, 'documentinit')
    return app
  }

  /**
   * Creates a viewer for the given PDF.
   * @param {string} filePath - Path or URL of the PDF file to display.
   * @param {PdfWebViewerOptions} [options] - Optional settings for the viewer.
   * @returns {PdfWebViewer} Instance of PdfWebViewer.
   */
  static getInstance(filePath: string, options?: PdfWebViewerOptions): PdfWebViewer {
    PdfWebViewer.instance = new PdfWebViewer(filePath, options)
    return PdfWebViewer.instance
  }

  /**
   * Mounts (inserts) the PDF viewer inside a target HTML element.
   *
   * @param {HTMLElement} targetElement - The HTML element where the PDF viewer will be inserted.
   * @throws {Error} If the target element is not valid or the viewer was destroyed.
   */
  public mount(targetElement: HTMLElement): void {
    this.assertAlive()

    if (this.isMounted) return

    if (!targetElement) {
      throw new Error('Target element is required to mount the PDF viewer.')
    }

    document.addEventListener('webviewerloaded', this.onViewerLoaded)
    this.iframeInstance.onload = this.onIframeLoad
    this.loadingIndicator.show()
    targetElement.appendChild(this.wrapper)
    this.isMounted = true
  }

  /**
   * Changes the PDF file displayed in the viewer. The running viewer opens the new file
   * without reloading; if the viewer is served from another origin, the iframe is reloaded.
   *
   * @param {string} filePath - New path or URL of the PDF file. Must end with .pdf
   * @returns {Promise<void>} Resolves when the file is loaded; rejects if it fails to load.
   * @throws {Error} If a valid path is not provided or the file is not a PDF.
   */
  public setFile(filePath: string): Promise<void> {
    this.assertAlive()
    PdfWebViewer.assertPdf(filePath)

    const fileUrl = PdfWebViewer.resolveFileUrl(filePath)

    if (!this.isMounted) {
      this.iframeInstance.src = this.viewerUrlFor(fileUrl)
      return Promise.resolve()
    }

    const loadId = ++this.loadId
    this.loadingIndicator.show()

    const loading = this.appReady.then(async (app) => {
      if (this.isDestroyed || loadId !== this.loadId) return

      if (!app) {
        // Cross-origin viewer: reload the iframe; `onIframeLoad` hides the indicator.
        this.resetApp()
        this.iframeInstance.src = this.viewerUrlFor(fileUrl)
        return
      }

      app.initialBookmark = this.viewHash(false)
      const loaded = nextDocumentEvent(app, 'documentloaded')
      loaded.catch(() => {}) // `open` reports the same failure.
      try {
        await app.open({ url: fileUrl })
        // `open` settles once the file is parsed; wait for its first page, like `onLoad`.
        if (loadId === this.loadId) await loaded
      } finally {
        if (loadId === this.loadId) this.loadingIndicator.hide()
      }
    })
    this.pendingFile = loading.catch(() => {})
    return loading
  }

  /**
   * Scrolls the viewer to a page.
   *
   * @param {number} page - Page number, from 1 to the number of pages.
   * @throws {RangeError} If the page does not exist in the open document.
   */
  public async goToPage(page: number): Promise<void> {
    const app = await this.requireDocument()
    if (!Number.isInteger(page) || page < 1 || page > app.pagesCount) {
      throw new RangeError(`Page ${page} is out of range (1-${app.pagesCount}).`)
    }
    app.page = page
  }

  /**
   * Changes the zoom of the open document.
   *
   * @param {Zoom} zoom - A preset ('auto', 'page-fit', 'page-width', 'page-actual') or a percentage.
   * @throws {RangeError} If a percentage is not a positive number.
   */
  public async setZoom(zoom: Zoom): Promise<void> {
    if (typeof zoom === 'number' && !(zoom > 0)) {
      throw new RangeError('Zoom percentage must be a positive number.')
    }
    const app = await this.requireDocument()
    if (typeof zoom === 'number') {
      app.pdfViewer.currentScale = zoom / 100
    } else {
      app.pdfViewer.currentScaleValue = zoom
    }
  }

  /**
   * Searches the open document and highlights the matches. An empty query clears the search.
   *
   * @param {string} query - Text to find.
   * @param {SearchOptions} [options] - Search settings.
   */
  public async search(query: string, options?: SearchOptions): Promise<void> {
    const app = await this.requireApp()
    app.eventBus.dispatch('find', {
      source: app,
      type: '',
      query,
      caseSensitive: options?.caseSensitive ?? false,
      entireWord: options?.entireWord ?? false,
      highlightAll: options?.highlightAll ?? true,
      findPrevious: false,
      matchDiacritics: false,
    })
  }

  /**
   * Shows or hides the page thumbnails panel. Also applies to files opened later.
   *
   * @param {boolean} visible - Whether the panel is visible.
   */
  public async setPagePanel(visible: boolean): Promise<void> {
    this.assertAlive()
    this.options.displayPagePanel = visible
    const app = await this.requireApp()
    app.eventBus.dispatch('pagemode', { source: app, mode: visible ? 'thumbs' : 'none' })
  }

  /**
   * Changes the color theme of the viewer UI.
   *
   * @param {Theme} theme - 'auto' (system preference), 'light' or 'dark'.
   */
  public async setTheme(theme: Theme): Promise<void> {
    this.assertAlive()
    this.options.theme = theme
    await this.requireApp()
    this.applyTheme(this.iframeInstance.contentDocument)
  }

  /**
   * Gives full access to the PDF.js `PDFViewerApplication` running in the viewer.
   * Resolves once the viewer is mounted and initialized.
   *
   * @returns {Promise<PdfViewerApplication>} The viewer application.
   * @throws {Error} If the viewer is served from another origin or was destroyed.
   */
  public getApplication(): Promise<PdfViewerApplication> {
    return this.requireApp()
  }

  /**
   * Removes the viewer from the page and releases its listeners. The instance cannot be used afterwards.
   */
  public destroy(): void {
    if (this.isDestroyed) return
    this.isDestroyed = true
    document.removeEventListener('webviewerloaded', this.onViewerLoaded)
    this.iframeInstance.onload = null
    this.wrapper.remove()
    this.app = null
    this.isMounted = false
    this.resolveApp(null)
  }
}

/**
 * Creates a PDF viewer.
 * @type {typeof PdfWebViewer.getInstance}
 */
const create = PdfWebViewer.getInstance

export { create }
export type { Locale, PdfWebViewer }
