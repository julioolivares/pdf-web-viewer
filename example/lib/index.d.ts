/**
 * Languages bundled with the PDF.js viewer (folders in `web/locale/`).
 */
type Locale = 'ach' | 'af' | 'an' | 'ar' | 'ast' | 'az' | 'be' | 'bg' | 'bn' | 'bo' | 'bqi' | 'br' | 'brx' | 'bs' | 'ca' | 'cak' | 'ckb' | 'cs' | 'cy' | 'da' | 'de' | 'dsb' | 'el' | 'en-CA' | 'en-GB' | 'en-US' | 'eo' | 'es-AR' | 'es-CL' | 'es-ES' | 'es-MX' | 'et' | 'eu' | 'fa' | 'ff' | 'fi' | 'fr' | 'fur' | 'fy-NL' | 'ga-IE' | 'gd' | 'gl' | 'gn' | 'gu-IN' | 'he' | 'hi-IN' | 'hr' | 'hsb' | 'hu' | 'hy-AM' | 'hye' | 'ia' | 'id' | 'is' | 'it' | 'ja' | 'ka' | 'kab' | 'kk' | 'km' | 'kn' | 'ko' | 'lij' | 'lo' | 'lt' | 'ltg' | 'lv' | 'meh' | 'mk' | 'ml' | 'mr' | 'ms' | 'my' | 'nb-NO' | 'ne-NP' | 'nl' | 'nn-NO' | 'oc' | 'pa-IN' | 'pl' | 'pt-BR' | 'pt-PT' | 'rm' | 'ro' | 'ru' | 'sat' | 'sc' | 'scn' | 'sco' | 'si' | 'sk' | 'skr' | 'sl' | 'son' | 'sq' | 'sr' | 'sv-SE' | 'szl' | 'ta' | 'te' | 'tg' | 'th' | 'tl' | 'tr' | 'trs' | 'uk' | 'ur' | 'uz' | 'vi' | 'wo' | 'xh' | 'zh-CN' | 'zh-TW';

/**
 * Options accepted by `create`.
 */
interface PdfWebViewerOptions {
    /**
     * Width of the viewer iframe (any CSS length).
     * @default '100%'
     */
    width?: string;
    /**
     * Height of the viewer iframe (any CSS length).
     * @default '100%'
     */
    height?: string;
    /**
     * Open the viewer with the page thumbnails panel visible.
     * @default false
     */
    displayPagePanel?: boolean;
    /**
     * Path or URL of the bundled PDF.js `viewer.html`, resolved against `document.baseURI`.
     * @default `${location.origin}/node_modules/pdf-web-viewer/dist/web/viewer.html`
     */
    viewerPath?: string;
    /**
     * Language of the viewer UI, e.g. 'en-US' or 'es-ES'. Unknown values fall back to English.
     * @default navigator.language
     */
    locale?: Locale | (string & {});
}
/**
 * Class for previewing PDF files using an iframe and the PDF.js viewer.
 * @class
 */
/**
 * Class for previewing PDF files using an iframe and the PDF.js viewer.
 * Provides methods to mount the viewer and change the displayed PDF file.
 */
declare class PdfWebViewer {
    /**
     * Singleton instance of PdfWebViewer.
     * @type {PdfWebViewer}
     * @private
     */
    private static instance;
    private isMounted;
    private loadingIndicator;
    private options;
    /**
     * Iframe instance where the PDF viewer is loaded.
     * @type {HTMLIFrameElement}
     * @private
     */
    private iframeInstance;
    /**
     * Resolves the URL of the PDF.js viewer (viewer.html).
     * By default it points to `node_modules/pdf-web-viewer/dist/web/viewer.html` at `location.origin`.
     * A custom `viewerPath` is resolved against `document.baseURI`, so relative paths work
     * when the page is not served from the domain root (e.g. GitHub Pages project sites).
     * @param {string} [viewerPath] - Custom path or URL of viewer.html
     * @returns {string} Absolute URL to the viewer.html
     * @private
     */
    private static resolveViewerBase;
    /**
     * Encodes and resolves the path of the PDF file to display.
     * If it is an absolute URL, it returns it encoded; if it is relative, it converts it to absolute.
     * @param {string} filePath - Path or URL of the PDF file
     * @returns {string} Encoded path for the viewer
     * @private
     */
    private static resolveFilePath;
    /**
     * Builds the complete viewer URL with the PDF file as a parameter.
     * @param {string} filePath - Path or URL of the PDF file
     * @param {boolean} [displayPagePanel=false] - Whether to display the page panel
     * @param {string} [viewerPath] - Custom path or URL of viewer.html
     * @returns {string} Viewer URL with the PDF loaded
     * @private
     */
    private static viewerUrlFor;
    private onMount;
    private addLoadingIndicator;
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
    private constructor();
    /**
     * Applies the configured locale before the PDF.js viewer initializes.
     * The viewer dispatches `webviewerloaded` on the parent document (same origin only),
     * which is the only point where `localeProperties` can still be changed.
     * @param {Event} event - The `webviewerloaded` event.
     * @private
     */
    private onViewerLoaded;
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
    static getInstance(filePath: string, options?: PdfWebViewerOptions): PdfWebViewer;
    /**
     * Mounts (inserts) the PDF viewer iframe inside a target HTML element.
     *
     * @param {HTMLElement} targetElement - The HTML element where the PDF viewer will be inserted.
     * @throws {Error} If the target element is not valid.
     */
    mount(targetElement: HTMLElement): void;
    /**
     * Changes the PDF file displayed in the viewer.
     *
     * @param {string} filePath - New path or URL of the PDF file. Must end with .pdf
     * @throws {Error} If a valid path is not provided or the file is not a PDF.
     */
    setFile(filePath: string): void;
}
/**
 * Exported instance of the PDF viewer.
 * @type {typeof PdfWebViewer.getInstance}
 */
declare const create: typeof PdfWebViewer.getInstance;

export { create };
export type { Locale, PdfWebViewerOptions };
export as namespace PdfViewer;
