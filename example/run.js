// Resolve paths against the current page so the example works both locally
// and on GitHub Pages (https://<user>.github.io/pdf-web-viewer/).
const pdfUrl = new URL('Placeholder-PDF.pdf', document.baseURI).href

const visorPdf = PdfViewer.create(pdfUrl, {
  displayPagePanel: true,
  viewerPath: 'lib/web/viewer.html',
})

window.onload = () => {
  const pdfContainer = document.querySelector('div.pdf-container')
  visorPdf.mount(pdfContainer)
}
