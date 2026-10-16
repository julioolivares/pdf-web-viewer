# 📄 PDF Web Viewer

Embed a full-featured PDF viewer in any web page with two lines of code.

PDF Web Viewer wraps the official [PDF.js](https://mozilla.github.io/pdf.js/) viewer (toolbar, thumbnails, search, zoom, print and download) in a small API: create a viewer for a PDF, mount it into an element, then switch files, pages, zoom or theme without reloading the viewer. No framework required.

> **[Try it in the playground →](https://julioolivares.github.io/pdf-web-viewer/)**

![Demo](https://raw.githubusercontent.com/julioolivares/pdf-web-viewer/main/fixtures/videopdf-web-viewer-ezgif.com-video-to-gif-converter.gif)

## 📦 Installation

```bash
npm install pdf-web-viewer
# or
pnpm add pdf-web-viewer
# or
yarn add pdf-web-viewer
```

## 🚀 Usage

Add a container where the viewer will be displayed:

```html
<div class="pdf-container" style="height: 600px"></div>
```

### ES modules

```js
import { create } from 'pdf-web-viewer'

const viewer = create('/assets/sample.pdf')
viewer.mount(document.querySelector('.pdf-container'))
```

### Script tag

The UMD bundle exposes a `PdfViewer` global:

```html
<script src="node_modules/pdf-web-viewer/dist/index.umd.js"></script>
<script>
  window.onload = () => {
    const viewer = PdfViewer.create('/assets/sample.pdf')
    viewer.mount(document.querySelector('.pdf-container'))
  }
</script>
```

### Serving the viewer files

The viewer runs from the PDF.js files shipped in the package (`dist/web/` and `dist/build/`). By default it loads them from `/node_modules/pdf-web-viewer/dist/web/viewer.html` at your site root.

If your app does not serve `node_modules` (for example, a production bundle), copy both folders, side by side, into your public assets and point `viewerPath` to them:

```js
const viewer = create('/assets/sample.pdf', {
  viewerPath: '/vendor/pdf-web-viewer/web/viewer.html',
})
```

## 🛠️ API

### `create(filePath, options?)`

Creates a viewer for the given PDF and returns a `PdfWebViewer` instance.

- **`filePath`** (`string`) — the PDF to display. It must end with `.pdf`.
  - **Relative path**, e.g. `'/assets/sample.pdf'`, resolved from your site root.
  - **Absolute URL**, e.g. `'https://example.com/files/document.pdf'`. The server hosting it must allow CORS requests from your site.
- **`options`** (`PdfWebViewerOptions`, optional):

| Option             | Type      | Default                                               | Description                                                                                        |
| ------------------ | --------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `width`            | `string`  | `'100%'`                                              | Width of the viewer (any CSS length).                                                              |
| `height`           | `string`  | `'100%'`                                              | Height of the viewer (any CSS length).                                                             |
| `displayPagePanel` | `boolean` | `false`                                               | Opens the viewer with the page thumbnails panel visible.                                           |
| `viewerPath`       | `string`  | `'/node_modules/pdf-web-viewer/dist/web/viewer.html'` | Path or URL of the bundled `viewer.html`. Relative paths are resolved against the current page.    |
| `locale`           | `Locale`  | Browser language                                      | Language of the viewer UI, e.g. `'en-US'`, `'es-ES'`, `'fr'`. Unknown values fall back to English. |
| `page`             | `number`  | `1`                                                   | Page shown when the first document opens.                                                          |
| `zoom`             | `Zoom`    | `'auto'`                                              | `'auto'`, `'page-fit'`, `'page-width'`, `'page-actual'` or a percentage such as `150`.             |
| `theme`            | `Theme`   | `'auto'`                                              | `'auto'` (system preference), `'light'` or `'dark'`.                                               |
| `onLoad`           | function  | —                                                     | Called with `{ pagesCount }` every time a document finishes loading.                               |
| `onPageChange`     | function  | —                                                     | Called with `{ page, pagesCount }` when the current page changes.                                  |
| `onError`          | function  | —                                                     | Called with an `Error` when a document fails to load.                                              |

```js
const viewer = create('https://example.com/files/document.pdf', {
  width: '100%',
  height: '600px',
  displayPagePanel: true,
  locale: 'es-ES',
  zoom: 'page-width',
  onPageChange: ({ page, pagesCount }) => console.log(`Page ${page} of ${pagesCount}`),
})
```

### `viewer.mount(targetElement)`

Inserts the viewer into `targetElement` (`HTMLElement`). Calling it again on a mounted viewer has no effect.

### `viewer.setFile(filePath)`

Opens a different PDF in the running viewer, without reloading it. Accepts the same values as `filePath` in `create`. Returns a promise that resolves when the file is loaded and rejects if it fails to load.

```js
await viewer.setFile('/assets/another.pdf')
```

### Controlling the viewer

These methods return a promise. Called before the document is ready, they wait for it.

| Method                    | Description                                                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `goToPage(page)`          | Scrolls to a page (1-based).                                                                                                                 |
| `setZoom(zoom)`           | Changes the zoom: a preset such as `'page-width'` or a percentage such as `150`.                                                             |
| `search(query, options?)` | Highlights the matches and jumps to the first one. Options: `caseSensitive`, `entireWord`, `highlightAll`. An empty query clears the search. |
| `setPagePanel(visible)`   | Shows or hides the page thumbnails panel.                                                                                                    |
| `setTheme(theme)`         | Switches between `'auto'`, `'light'` and `'dark'`.                                                                                           |
| `getApplication()`        | Resolves with the PDF.js [`PDFViewerApplication`](https://github.com/mozilla/pdf.js/blob/master/web/app.js) for full control.                |

```js
await viewer.goToPage(3)
await viewer.setZoom(150)
await viewer.search('invoice')

const app = await viewer.getApplication()
app.eventBus.on('scalechanging', ({ scale }) => console.log(scale))
```

These methods need the viewer files to be served from the same origin as your page, which is the case by default. With a `viewerPath` on another origin, `setFile` falls back to reloading the viewer and the other methods reject.

### `viewer.destroy()`

Removes the viewer from the page and releases its listeners. The instance cannot be used afterwards.

### Errors

- `create` and `setFile` throw an `Error` when `filePath` is missing or does not end with `.pdf`.
- `mount` throws an `Error` when no target element is provided.
- `goToPage` and `setZoom` reject with a `RangeError` for a page that does not exist or a zoom that is not positive.
- Every method throws an `Error` after `destroy()`.

## 🧩 TypeScript

Type declarations are included. Besides `create`, the package exports the option types:

```ts
import {
  create,
  type PdfWebViewerOptions,
  type Locale,
  type Zoom,
  type Theme,
} from 'pdf-web-viewer'

const options: PdfWebViewerOptions = { locale: 'es-ES' }
```

`Locale` lists every language bundled with the viewer, so editors autocomplete the valid `locale` values.

## 🔧 Updating PDF.js

The viewer in `build/` and `web/` comes from the official PDF.js release zip, because the `pdfjs-dist` npm package does not include the viewer app. `pdfjs-dist` is a dev dependency only to pin the version:

```bash
pnpm up pdfjs-dist --latest
pnpm update:pdfjs
```

`update:pdfjs` downloads the matching release, applies the patches listed in `scripts/update-pdfjs.mjs`, regenerates the `Locale` type and rebuilds. It stops with an error if a patch no longer applies.

## 🙏 Acknowledgments

Thanks to the Mozilla team and the [PDF.js](https://mozilla.github.io/pdf.js/) project for the viewer this package builds on.
