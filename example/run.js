// PDF to display. It must end with `.pdf`. Accepts:
// - A path resolved against this page, like the sample below.
// - An absolute URL to an external file, e.g. 'https://example.com/files/document.pdf'.
//   The server hosting it must allow CORS requests from this site.
const pdfUrl = new URL('Placeholder-PDF.pdf', document.baseURI).href

const visorPdf = PdfViewer.create(pdfUrl, {
  // Size of the viewer iframe (any CSS length). Default: '100%'.
  width: '100%',
  height: '100%',

  // Open the viewer with the page thumbnails panel visible. Default: false.
  displayPagePanel: true,

  // Path or URL of the bundled PDF.js viewer.html, resolved against this page.
  // Default: '/node_modules/pdf-web-viewer/dist/web/viewer.html' at the site root.
  viewerPath: 'lib/web/viewer.html',

  // Language of the viewer UI, e.g. 'en-US', 'es-ES', 'fr', 'de'.
  // Default: the browser language.
  locale: 'en-US',
})

window.onload = () => {
  const pdfContainer = document.querySelector('div.pdf-container')

  // Insert the viewer into the container.
  visorPdf.mount(pdfContainer)

  // Load a different PDF in the same viewer (same rules as `pdfUrl`):
  // visorPdf.setFile('https://example.com/files/another.pdf')
}
