import { Utils } from './utils.util'
import { create as createLoading } from './loading'
import type { Locale } from './locale'

/**
 * Options accepted by `create`.
 */
export interface PdfWebViewerOptions {
  /**
   * Width of the viewer iframe (any CSS length).
   * @default '100%'
   */
  width?: string
  /**
   * Height of the viewer iframe (any CSS length).
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
}

/**
 * Class for previewing PDF files using an iframe and the PDF.js viewer.
 * @class
 */

/**
 * Class for previewing PDF files using an iframe and the PDF.js viewer.
 * Provides methods to mount the viewer and change the displayed PDF file.
 */
class PdfWebViewer {
  /**
   * Singleton instance of PdfWebViewer.
   * @type {PdfWebViewer}
   * @private
   */
  private static instance: PdfWebViewer

  private isMounted: boolean = false

  private loadingIndicator: ReturnType<typeof createLoading>

  private options: { displayPagePanel: boolean; width: string; height: string; viewerPath?: string; locale?: string } = {
    displayPagePanel: false,
    width: '100%',
    height: '100%'
  }

  /**
   * Iframe instance where the PDF viewer is loaded.
   * @type {HTMLIFrameElement}
   * @private
   */
  private iframeInstance: HTMLIFrameElement

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
   * Encodes and resolves the path of the PDF file to display.
   * If it is an absolute URL, it returns it encoded; if it is relative, it converts it to absolute.
   * @param {string} filePath - Path or URL of the PDF file
   * @returns {string} Encoded path for the viewer
   * @private
   */
  private static resolveFilePath(filePath: string): string {
    const prefix = filePath.trim().toLowerCase()
    if (prefix.startsWith('http:') || prefix.startsWith('https:')) {
      return encodeURIComponent(filePath.trim())
    }
    return encodeURIComponent(
      `${location.origin}${filePath.startsWith('/') ? filePath : '/' + filePath}`
    )
  }

  /**
   * Builds the complete viewer URL with the PDF file as a parameter.
   * @param {string} filePath - Path or URL of the PDF file
   * @param {boolean} [displayPagePanel=false] - Whether to display the page panel
   * @param {string} [viewerPath] - Custom path or URL of viewer.html
   * @returns {string} Viewer URL with the PDF loaded
   * @private
   */
  private static viewerUrlFor(filePath: string, displayPagePanel: boolean = false, viewerPath?: string): string {
    const base = PdfWebViewer.resolveViewerBase(viewerPath)
    const resolvedFile = PdfWebViewer.resolveFilePath(filePath)

    return `${base}?file=${resolvedFile}${displayPagePanel ? '#pagemode=thumbs' : '#pagemode=none'}`
  }

  private async onMount(targetElement: HTMLElement) {

    this.loadingIndicator.show()
    this.addLoadingIndicator(targetElement)
    this.iframeInstance.onload = async (ev: Event) => {

      await new Promise((resolve) => {
        setTimeout(() => { resolve(true) }, 180)
      })

      this.loadingIndicator.hide()
    }
  }

  private async addLoadingIndicator(targetElement: HTMLElement) {


    const visorContainer = document.querySelector(`iframe#${this.iframeInstance.id}`)

    if (visorContainer) {
      // visorContainer.appendChild(this.loadingIndicator.loadingElement)
    }

    targetElement.appendChild(this.loadingIndicator.loadingElement)
  }

  /**
   * Private constructor. Initializes the iframe with the provided PDF file and options.
   * @param {string} filePath - Path or URL of the PDF file to display.
   * @param {Object} [options] - Optional settings for the viewer.
   * @param {string} [options.width='100%'] - Width of the iframe.
   * @param {string} [options.height='100%'] - Height of the iframe.
   * @param {boolean} [options.displayPagePanel=false] - Whether to display the page panel.
   * @param {string} [options.viewerPath] - Custom path or URL of the PDF.js viewer.html.
   * @param {string} [options.locale] - Language of the viewer UI (e.g. 'es-ES'). Defaults to the browser language.
   * @private
   */
  private constructor(filePath: string, options?: PdfWebViewerOptions) {
    if (!/\.pdf($|[?#])/i.test(filePath)) {
      throw new Error('Only PDF files are supported.')
    }
    this.options.width = options?.width ?? '100%'
    this.options.height = options?.height ?? '100%'
    this.options.displayPagePanel = options?.displayPagePanel ?? this.options.displayPagePanel
    this.options.viewerPath = options?.viewerPath
    this.options.locale = options?.locale
    this.iframeInstance = document.createElement('iframe')
    this.iframeInstance.src = PdfWebViewer.viewerUrlFor(filePath, this.options.displayPagePanel, this.options.viewerPath)
    this.iframeInstance.style.width = this.options.width
    this.iframeInstance.style.height = this.options.height
    this.iframeInstance.style.border = 'none'
    this.iframeInstance.loading = 'lazy'
    this.iframeInstance.allow = 'fullscreen'
    this.iframeInstance.id = `pdf_${Utils.generateUUID()}`

    this.loadingIndicator = createLoading()

    if (this.options.locale) {
      document.addEventListener('webviewerloaded', this.onViewerLoaded)
    }
  }

  /**
   * Applies the configured locale before the PDF.js viewer initializes.
   * The viewer dispatches `webviewerloaded` on the parent document (same origin only),
   * which is the only point where `localeProperties` can still be changed.
   * @param {Event} event - The `webviewerloaded` event.
   * @private
   */
  private onViewerLoaded = (event: Event): void => {
    const source = (event as CustomEvent<{ source: any }>).detail?.source
    if (!source || source !== this.iframeInstance.contentWindow) return

    source.PDFViewerApplicationOptions?.set('localeProperties', { lang: this.options.locale })
  }

  /**
   * Gets the singleton instance of PdfWebViewer.
   * @param {string} filePath - Path or URL of the PDF file to display.
   * @param {Object} [options] - Optional settings for the viewer.
   * @param {string} [options.width='100%'] - Width of the iframe.
   * @param {string} [options.height='100%'] - Height of the iframe.
   * @param {boolean} [options.displayPagePanel=false] - Whether to display the page panel. 
   * @param {string} [options.viewerPath] - Custom path or URL of the PDF.js viewer.html.
   * @param {string} [options.locale] - Language of the viewer UI (e.g. 'es-ES'). Defaults to the browser language.
   * @returns {PdfWebViewer} Instance of PdfWebViewer.
   */
  static getInstance(
    filePath: string,
    options?: PdfWebViewerOptions
  ): PdfWebViewer {
    this.instance = new PdfWebViewer(filePath, options)
    return this.instance
  }

  /**
   * Mounts (inserts) the PDF viewer iframe inside a target HTML element.
   *
   * @param {HTMLElement} targetElement - The HTML element where the PDF viewer will be inserted.
   * @throws {Error} If the target element is not valid.
   */
  public mount(targetElement: HTMLElement): void {

    if (this.isMounted) return

    if (!targetElement) {
      throw new Error('Target element is required to mount the PDF viewer.')
    }

    targetElement.appendChild(this.iframeInstance)
    this.onMount(targetElement)
    this.isMounted = true
  }

  /**
   * Changes the PDF file displayed in the viewer.
   *
   * @param {string} filePath - New path or URL of the PDF file. Must end with .pdf
   * @throws {Error} If a valid path is not provided or the file is not a PDF.
   */
  public setFile(filePath: string): void {
    this.loadingIndicator.show()

    if (!filePath) {
      throw new Error('Source PDF URL is required.')
    }
    if (!/\.pdf($|[?#])/i.test(filePath)) {
      throw new Error('Only PDF files are supported.')
    }
    this.iframeInstance.src = PdfWebViewer.viewerUrlFor(filePath, this.options.displayPagePanel, this.options.viewerPath)
  }
}

/**
 * Exported instance of the PDF viewer.
 * @type {typeof PdfWebViewer.getInstance}
 */
const create = PdfWebViewer.getInstance

export { create }
export type { Locale }
