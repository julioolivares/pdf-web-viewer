# 📄 PDF Web Viewer

Embed a full-featured PDF viewer in any web page with two lines of code.

PDF Web Viewer wraps the official [PDF.js](https://mozilla.github.io/pdf.js/) viewer (toolbar, thumbnails, search, zoom, print and download) in a small API: create a viewer for a PDF, mount it into an element, and switch files when you need to. No framework required.

> **[Try it in the playground →](https://julioolivares.github.io/pdf-web-viewer/)**

![Demo](fixtures/videopdf-web-viewer-ezgif.com-video-to-gif-converter.gif)

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

```js
const viewer = create('https://example.com/files/document.pdf', {
  width: '100%',
  height: '600px',
  displayPagePanel: true,
  locale: 'es-ES',
})
```

### `viewer.mount(targetElement)`

Inserts the viewer into `targetElement` (`HTMLElement`). Calling it again on a mounted viewer has no effect.

### `viewer.setFile(filePath)`

Loads a different PDF in the same viewer. Accepts the same values as `filePath` in `create`.

```js
viewer.setFile('/assets/another.pdf')
```

### Errors

- `create` and `setFile` throw an `Error` when `filePath` is missing or does not end with `.pdf`.
- `mount` throws an `Error` when no target element is provided.

## 🧩 TypeScript

Type declarations are included. Besides `create`, the package exports the option types:

```ts
import { create, type PdfWebViewerOptions, type Locale } from 'pdf-web-viewer'

const options: PdfWebViewerOptions = { locale: 'es-ES' }
```

`Locale` lists every language bundled with the viewer, so editors autocomplete the valid `locale` values.

## 🙏 Acknowledgments

Thanks to the Mozilla team and the [PDF.js](https://mozilla.github.io/pdf.js/) project for the viewer this package builds on.
