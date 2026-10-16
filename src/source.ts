/**
 * A PDF to display: a path or URL ending with `.pdf`, a `Blob`, an `ArrayBuffer` or a `Uint8Array`.
 */
export type PdfSource = string | Blob | ArrayBuffer | Uint8Array

/**
 * A validated `PdfSource`: a URL or the PDF bytes.
 */
export type ResolvedSource =
  | { url: string }
  | { blob: Blob; filename?: string }

/**
 * Resolves the path of the PDF file to display to an absolute URL.
 * Absolute http(s) URLs are kept; other paths are resolved from the site root.
 * @param {string} filePath - Path or URL of the PDF file
 * @returns {string} Absolute URL of the PDF file
 */
const resolveFileUrl = (filePath: string): string => {
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
 */
const assertPdf = (filePath: string): void => {
  if (!filePath) {
    throw new Error('Source PDF URL is required.')
  }
  if (!/\.pdf($|[?#])/i.test(filePath)) {
    throw new Error('Only PDF files are supported.')
  }
}

/**
 * Validates a `PdfSource` and turns it into a URL or the PDF bytes.
 * @param {PdfSource} source - The PDF to display
 * @returns {ResolvedSource} The source ready to open
 * @throws {Error} If the source is missing, is not a PDF or has an unsupported type.
 */
const resolveSource = (source: PdfSource): ResolvedSource => {
  if (typeof source === 'string') {
    const trimmed = source.trim()
    assertPdf(trimmed)
    return { url: resolveFileUrl(trimmed) }
  }

  if (source instanceof Blob) {
    return { blob: source, filename: source instanceof File ? source.name : undefined }
  }

  if (source instanceof ArrayBuffer || source instanceof Uint8Array) {
    // The Blob keeps a copy, so changing the caller's buffer later does not affect the viewer.
    const bytes = new Uint8Array(source)
    return { blob: new Blob([bytes.buffer], { type: 'application/pdf' }) }
  }

  throw new Error(source ? 'Unsupported PDF source.' : 'Source PDF URL is required.')
}

/**
 * Whether the source can be passed to the viewer in its URL (`?file=`), which also works when
 * the viewer is served from another origin. Bytes need `PDFViewerApplication.open`.
 */
const isPlainUrl = (source: ResolvedSource): source is { url: string } =>
  'url' in source

/**
 * Builds the arguments of `PDFViewerApplication.open` (PDF.js `getDocument` parameters).
 * @param {ResolvedSource} source - The source to open
 */
const openArgs = async (source: ResolvedSource): Promise<Record<string, any>> => {
  if ('url' in source) {
    return { url: source.url }
  }
  // A fresh copy on every open: PDF.js transfers the bytes to its worker, which empties the buffer.
  return { data: new Uint8Array(await source.blob.arrayBuffer()), filename: source.filename }
}

export { resolveSource, isPlainUrl, openArgs }
