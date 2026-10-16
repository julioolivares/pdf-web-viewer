/**
 * Languages bundled with the PDF.js viewer (folders in `web/locale/`).
 */
type Locale = 'ach' | 'af' | 'an' | 'ar' | 'ast' | 'az' | 'be' | 'bg' | 'bn' | 'bo' | 'bqi' | 'br' | 'brx' | 'bs' | 'ca' | 'cak' | 'ckb' | 'cs' | 'cy' | 'da' | 'de' | 'dsb' | 'el' | 'en-CA' | 'en-GB' | 'en-US' | 'eo' | 'es-AR' | 'es-CL' | 'es-ES' | 'es-MX' | 'et' | 'eu' | 'fa' | 'ff' | 'fi' | 'fr' | 'fur' | 'fy-NL' | 'ga-IE' | 'gd' | 'gl' | 'gn' | 'gu-IN' | 'he' | 'hi-IN' | 'hr' | 'hsb' | 'hu' | 'hy-AM' | 'hye' | 'ia' | 'id' | 'is' | 'it' | 'ja' | 'ka' | 'kab' | 'kk' | 'km' | 'kn' | 'ko' | 'lij' | 'lo' | 'lt' | 'ltg' | 'lv' | 'meh' | 'mk' | 'ml' | 'mr' | 'ms' | 'my' | 'nb-NO' | 'ne-NP' | 'nl' | 'nn-NO' | 'oc' | 'pa-IN' | 'pl' | 'pt-BR' | 'pt-PT' | 'rm' | 'ro' | 'ru' | 'sat' | 'sc' | 'scn' | 'sco' | 'si' | 'sk' | 'skr' | 'sl' | 'son' | 'sq' | 'sr' | 'sv-SE' | 'szl' | 'ta' | 'te' | 'tg' | 'th' | 'tl' | 'tr' | 'trs' | 'uk' | 'ur' | 'uz' | 'vi' | 'wo' | 'xh' | 'zh-CN' | 'zh-TW';

/**
 * Zoom level: one of the PDF.js presets or a percentage (e.g. `150` for 150%).
 */
type Zoom = 'auto' | 'page-actual' | 'page-fit' | 'page-width' | number;
/**
 * Color theme of the viewer UI. `'auto'` follows the system preference.
 */
type Theme = 'auto' | 'light' | 'dark';
/**
 * Options accepted by `viewer.search`.
 */
interface SearchOptions {
    /** @default false */
    caseSensitive?: boolean;
    /** @default false */
    entireWord?: boolean;
    /** Highlight every match, not only the current one. @default true */
    highlightAll?: boolean;
}
/**
 * The PDF.js `PDFViewerApplication` running inside the viewer iframe.
 * Only the members used most often are typed; see the PDF.js source for the rest.
 */
interface PdfViewerApplication {
    /** Opens a new document in the running viewer. */
    open(args: {
        url: string;
    } & Record<string, any>): Promise<void>;
    /** Current page number (1-based). */
    page: number;
    /** Number of pages of the open document (0 while loading). */
    readonly pagesCount: number;
    readonly initializedPromise: Promise<void>;
    pdfViewer: any;
    pdfDocument: any;
    eventBus: {
        on(eventName: string, listener: (event: any) => void, options?: {
            once?: boolean;
            signal?: AbortSignal;
        }): void;
        off(eventName: string, listener: (event: any) => void): void;
        dispatch(eventName: string, data: Record<string, any>): void;
    };
    [key: string]: any;
}
/**
 * Options accepted by `create`.
 */
interface PdfWebViewerOptions {
    /**
     * Width of the viewer (any CSS length).
     * @default '100%'
     */
    width?: string;
    /**
     * Height of the viewer (any CSS length).
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
    /**
     * Page shown when the first document opens (1-based).
     * @default 1
     */
    page?: number;
    /**
     * Zoom applied when a document opens: a preset or a percentage (e.g. `150`).
     * @default 'auto'
     */
    zoom?: Zoom;
    /**
     * Color theme of the viewer UI.
     * @default 'auto'
     */
    theme?: Theme;
    /** Called every time a document finishes loading. */
    onLoad?: (info: {
        pagesCount: number;
    }) => void;
    /** Called when the current page changes. */
    onPageChange?: (info: {
        page: number;
        pagesCount: number;
    }) => void;
    /** Called when a document fails to load. */
    onError?: (error: Error) => void;
}
/**
 * Class for previewing PDF files using an iframe and the PDF.js viewer.
 * Provides methods to mount the viewer, change the displayed PDF file and control
 * the running viewer (page, zoom, search, page panel and theme).
 */
declare class PdfWebViewer {
    /**
     * Last instance created by `create`.
     * @type {PdfWebViewer}
     * @private
     */
    private static instance;
    private isMounted;
    private isDestroyed;
    private loadingIndicator;
    private options;
    /**
     * Element inserted by `mount`: holds the iframe and the loading indicator.
     * @private
     */
    private wrapper;
    /**
     * Iframe instance where the PDF viewer is loaded.
     * @type {HTMLIFrameElement}
     * @private
     */
    private iframeInstance;
    /**
     * `PDFViewerApplication` of the current iframe document, once initialized.
     * @private
     */
    private app;
    /**
     * Resolves with the initialized `PDFViewerApplication`, or `null` when it is not reachable
     * (viewer served from another origin) or the viewer was destroyed.
     * @private
     */
    private appReady;
    private resolveApp;
    /**
     * Increments on every `setFile`, so only the latest load hides the loading indicator.
     * @private
     */
    private loadId;
    /**
     * Settles when the latest `setFile` finishes (it never rejects), so view changes target the new file.
     * @private
     */
    private pendingFile;
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
     * Resolves the path of the PDF file to display to an absolute URL.
     * Absolute http(s) URLs are kept; other paths are resolved from the site root.
     * @param {string} filePath - Path or URL of the PDF file
     * @returns {string} Absolute URL of the PDF file
     * @private
     */
    private static resolveFileUrl;
    /**
     * Throws when `filePath` is missing or is not a PDF.
     * @param {string} filePath - Path or URL of the PDF file
     * @private
     */
    private static assertPdf;
    /**
     * Builds the PDF.js hash parameters (page, zoom and page panel) applied when a document opens.
     * @param {boolean} includePage - Whether to include the initial `page` option.
     * @returns {string} Hash parameters without the leading `#`
     * @private
     */
    private viewHash;
    /**
     * Builds the complete viewer URL with the PDF file as a parameter.
     * @param {string} fileUrl - Absolute URL of the PDF file
     * @returns {string} Viewer URL with the PDF loaded
     * @private
     */
    private viewerUrlFor;
    /**
     * Starts waiting for a new `PDFViewerApplication` (first load or iframe reload).
     * @private
     */
    private resetApp;
    /**
     * Private constructor. Initializes the iframe with the provided PDF file and options.
     * @param {string} filePath - Path or URL of the PDF file to display.
     * @param {PdfWebViewerOptions} [options] - Optional settings for the viewer.
     * @private
     */
    private constructor();
    /**
     * Configures the PDF.js viewer before it initializes.
     * The viewer dispatches `webviewerloaded` on the parent document (same origin only),
     * which is the only point where options like `localeProperties` can still be changed.
     * @param {Event} event - The `webviewerloaded` event.
     * @private
     */
    private onViewerLoaded;
    /**
     * Hides the initial loading indicator and detects a viewer served from another origin,
     * where `PDFViewerApplication` cannot be reached.
     * @private
     */
    private onIframeLoad;
    /**
     * Forwards PDF.js events to the `onLoad`, `onPageChange` and `onError` callbacks, and hides
     * the loading indicator when PDF.js asks for a password (it has no event for that).
     * The listeners go away with the iframe document, so they need no cleanup.
     * @param {PdfViewerApplication} app - The initialized viewer application.
     * @private
     */
    private bindEvents;
    /**
     * Applies the configured theme to the viewer document. PDF.js styles follow `color-scheme`.
     * @param {Document | null} doc - The viewer document.
     * @private
     */
    private applyTheme;
    /**
     * Throws if the viewer was destroyed.
     * @private
     */
    private assertAlive;
    /**
     * Waits for the viewer application. Throws when it is not reachable.
     * @private
     */
    private requireApp;
    /**
     * Waits until PDF.js has applied the initial view (page and zoom from the options or its
     * history) to the current document. Changing page or zoom earlier would be overwritten.
     * @private
     */
    private requireDocument;
    /**
     * Creates a viewer for the given PDF.
     * @param {string} filePath - Path or URL of the PDF file to display.
     * @param {PdfWebViewerOptions} [options] - Optional settings for the viewer.
     * @returns {PdfWebViewer} Instance of PdfWebViewer.
     */
    static getInstance(filePath: string, options?: PdfWebViewerOptions): PdfWebViewer;
    /**
     * Mounts (inserts) the PDF viewer inside a target HTML element.
     *
     * @param {HTMLElement} targetElement - The HTML element where the PDF viewer will be inserted.
     * @throws {Error} If the target element is not valid or the viewer was destroyed.
     */
    mount(targetElement: HTMLElement): void;
    /**
     * Changes the PDF file displayed in the viewer. The running viewer opens the new file
     * without reloading; if the viewer is served from another origin, the iframe is reloaded.
     *
     * @param {string} filePath - New path or URL of the PDF file. Must end with .pdf
     * @returns {Promise<void>} Resolves when the file is loaded; rejects if it fails to load.
     * @throws {Error} If a valid path is not provided or the file is not a PDF.
     */
    setFile(filePath: string): Promise<void>;
    /**
     * Scrolls the viewer to a page.
     *
     * @param {number} page - Page number, from 1 to the number of pages.
     * @throws {RangeError} If the page does not exist in the open document.
     */
    goToPage(page: number): Promise<void>;
    /**
     * Changes the zoom of the open document.
     *
     * @param {Zoom} zoom - A preset ('auto', 'page-fit', 'page-width', 'page-actual') or a percentage.
     * @throws {RangeError} If a percentage is not a positive number.
     */
    setZoom(zoom: Zoom): Promise<void>;
    /**
     * Searches the open document and highlights the matches. An empty query clears the search.
     *
     * @param {string} query - Text to find.
     * @param {SearchOptions} [options] - Search settings.
     */
    search(query: string, options?: SearchOptions): Promise<void>;
    /**
     * Shows or hides the page thumbnails panel. Also applies to files opened later.
     *
     * @param {boolean} visible - Whether the panel is visible.
     */
    setPagePanel(visible: boolean): Promise<void>;
    /**
     * Changes the color theme of the viewer UI.
     *
     * @param {Theme} theme - 'auto' (system preference), 'light' or 'dark'.
     */
    setTheme(theme: Theme): Promise<void>;
    /**
     * Gives full access to the PDF.js `PDFViewerApplication` running in the viewer.
     * Resolves once the viewer is mounted and initialized.
     *
     * @returns {Promise<PdfViewerApplication>} The viewer application.
     * @throws {Error} If the viewer is served from another origin or was destroyed.
     */
    getApplication(): Promise<PdfViewerApplication>;
    /**
     * Removes the viewer from the page and releases its listeners. The instance cannot be used afterwards.
     */
    destroy(): void;
}
/**
 * Creates a PDF viewer.
 * @type {typeof PdfWebViewer.getInstance}
 */
declare const create: typeof PdfWebViewer.getInstance;

export { PdfWebViewer, create };
export type { Locale, PdfViewerApplication, PdfWebViewerOptions, SearchOptions, Theme, Zoom };
export as namespace PdfViewer;
