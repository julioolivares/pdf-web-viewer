import { Utils } from './utils.util'
import { create as createLoading } from './loading'

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

  /**
   * Iframe instance where the PDF viewer is loaded.
   * @type {HTMLIFrameElement}
   * @private
   */
  private iframeInstance: HTMLIFrameElement

  /**
   * Resolves the base path for the PDF.js viewer (viewer.html) based on the current script location.
   * @returns {string} Absolute URL to the viewer.html
   * @private
   */
  private static resolveViewerBase(): string {
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
   * @returns {string} Viewer URL with the PDF loaded
   * @private
   */
  private static viewerUrlFor(filePath: string): string {
    const base = PdfWebViewer.resolveViewerBase()
    const resolvedFile = PdfWebViewer.resolveFilePath(filePath)
    return `${base}?file=${resolvedFile}`
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
   * @private
   */
  private constructor(filePath: string, options?: { width?: string; height?: string }) {
    if (!/\.pdf($|[?#])/i.test(filePath)) {
      throw new Error('Only PDF files are supported.')
    }
    const width = options?.width || '100%'
    const height = options?.height || '100%'
    this.iframeInstance = document.createElement('iframe')
    this.iframeInstance.src = PdfWebViewer.viewerUrlFor(filePath)
    this.iframeInstance.style.width = width
    this.iframeInstance.style.height = height
    this.iframeInstance.style.border = 'none'
    this.iframeInstance.loading = 'lazy'
    this.iframeInstance.allow = 'fullscreen'
    this.iframeInstance.id = `pdf_${Utils.generateUUID()}`

    this.loadingIndicator = createLoading()
  }

  /**
   * Gets the singleton instance of PdfWebViewer.
   * @param {string} filePath - Path or URL of the PDF file to display.
   * @param {Object} [options] - Optional settings for the viewer.
   * @param {string} [options.width='100%'] - Width of the iframe.
   * @param {string} [options.height='100%'] - Height of the iframe.
   * @returns {PdfWebViewer} Instance of PdfWebViewer.
   */
  static getInstance(
    filePath: string,
    options?: { width?: string; height?: string }
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
    this.iframeInstance.src = PdfWebViewer.viewerUrlFor(filePath)
  }
}

/**
 * Exported instance of the PDF viewer.
 * @type {typeof PdfWebViewer.getInstance}
 */
const create = PdfWebViewer.getInstance

export { create }
