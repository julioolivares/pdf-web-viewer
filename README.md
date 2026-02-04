# 📄 PDF Web Viewer

PDF Web Viewer is a lightweight wrapper around the official PDF.js viewer for simple PDF previews in web apps. The project exposes a small API to create a viewer instance and mount it into your page.

## 🚀 Quick Start

1. Add a container to your HTML document where the viewer will be mounted:

   ```html
   <div class="pdf-container"></div>
   ```

2. Install the package (if published to a registry):

   ```bash
   pnpm add pdf-web-viewer
   # or
   npm install pdf-web-viewer
   # or
   yarn add pdf-web-viewer
   ```

3. Use the library according to your project type.

   #### ESM Projects

   ```js
   import { create } from 'pdf-web-viewer'

   // filePath must point to a .pdf file (see notes below)
   const pdfViewer = create('/assets/sample.pdf', {
     width: '800px',
     height: '600px',
   })
   pdfViewer.mount(document.querySelector('div.pdf-container'))
   ```

   #### Non-ESM Projects

   If you build a UMD bundle that exposes a `PdfViewer` global, use it like:

   ```html
   <script src="node_modules/pdf-web-viewer/dist/index.umd.js"></script>
   <script>
     window.onload = function () {
       const pdfViewer = PdfViewer.create('/assets/sample.pdf')
       pdfViewer.mount(document.querySelector('div.pdf-container'))
     }
   </script>
   ```

## 🎥 Gif Demo

![Demo](fixtures/videopdf-web-viewer-ezgif.com-video-to-gif-converter.gif)

## 🛠️ API Overview

### `create(filePath: string, options?: { width?: string; height?: string }): PdfWebViewer`

Creates a viewer instance and returns it. The instance exposes the `mount` and `setFile` methods.

- `filePath` (string): URL or path to the PDF file to display. The implementation currently validates that the path ends with `.pdf` (case-insensitive) and will throw an `Error` otherwise.
- `options` (optional):
  - `width` (string) — iframe width; default: `100%`.
  - `height` (string) — iframe height; default: `100%`.

#### Methods

- `mount(targetElement: HTMLElement): void`
  - Appends the viewer `iframe` into `targetElement`. Throws an `Error` if the `targetElement` is not provided.

- `setFile(filePath: string): void`
  - Updates the viewer to load a new PDF. The `filePath` must be provided and must end with `.pdf`, otherwise an `Error` is thrown.

## Error handling

- `create` and `setFile` will throw an `Error` if the provided `filePath` is missing or does not end with `.pdf`.
- `mount` will throw if a valid mount target is not provided.

## 📚 Additional resources

For advanced usage and detailed API references, see the [official PDF.js documentation](https://mozilla.github.io/pdf.js/).

## 🙏 Acknowledgments

Thanks to the Mozilla team and the PDF.js project for their excellent work and for providing a robust viewer that this package builds on.
