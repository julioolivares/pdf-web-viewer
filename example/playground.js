const SOURCE_FILE = 'run.js'
const HOST_FILE = 'demo.html'

const HINTS = {
  source: 'The real code of this example, exactly as it runs on this page.',
  edit: "Try setting displayPagePanel to false or locale to 'es-ES', then press Run (Ctrl/⌘ + Enter).",
}

const $ = (selector) => document.querySelector(selector)
const $$ = (selector) => document.querySelectorAll(selector)

const preview = $('#preview')
const previewStatus = $('#preview-status')
const previewError = $('#preview-error')
const editorHost = $('#editor')
const fileTab = $('#file-tab')

const state = { mode: 'source' }
const docs = {}
let original
let hostHtml
let editor
let blobUrl

async function fetchText(name) {
  const res = await fetch(name, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`)
  return res.text()
}

async function loadSources() {
  ;[original, hostHtml] = await Promise.all([fetchText(SOURCE_FILE), fetchText(HOST_FILE)])
  docs.source = CodeMirror.Doc(original, 'javascript')
  docs.edit = CodeMirror.Doc(original, 'javascript')
}

const isModified = () => docs.edit.getValue() !== original

function updateMarker() {
  fileTab.classList.toggle('modified', state.mode === 'edit' && isModified())
}

function render() {
  const editing = state.mode === 'edit'
  editor.swapDoc(docs[state.mode])
  editor.setOption('readOnly', !editing)
  editorHost.classList.toggle('readonly', !editing)

  $$('[data-mode]').forEach((tab) => {
    tab.setAttribute('aria-selected', tab.dataset.mode === state.mode)
  })
  $('[data-action="run"]').hidden = !editing
  $('[data-action="reset"]').hidden = !editing
  $('#hint').textContent = HINTS[state.mode]
  updateMarker()
  if (editing) editor.focus()
}

function showPreview(src, edited) {
  previewError.hidden = true
  previewStatus.textContent = edited ? 'Your version' : 'Original'
  previewStatus.classList.toggle('edited', edited)
  preview.src = src
}

function buildPage(js) {
  const base = new URL('./', location.href).href
  const prelude =
    `<base href="${base}">` +
    '<script>' +
    "addEventListener('error', (e) => parent.postMessage({ type: 'playground-error', message: e.message }, '*'));" +
    "addEventListener('unhandledrejection', (e) => parent.postMessage({ type: 'playground-error', message: String(e.reason) }, '*'));" +
    '</script>'
  const inlineJs = `<script>\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>`

  return hostHtml
    .replace(/<script\s+src=["'](?:\.\/)?run\.js["']\s*><\/script>/i, () => inlineJs)
    .replace(/<head[^>]*>/i, (head) => head + prelude)
}

function run() {
  if (blobUrl) URL.revokeObjectURL(blobUrl)
  blobUrl = URL.createObjectURL(
    new Blob([buildPage(docs.edit.getValue())], { type: 'text/html;charset=utf-8' })
  )
  showPreview(blobUrl, true)
}

function reset() {
  if (isModified() && !confirm('Discard your changes and restore the original code?')) return
  docs.edit.setValue(original)
  showPreview(HOST_FILE, false)
  render()
}

async function copy(button) {
  const label = button.textContent
  try {
    await navigator.clipboard.writeText(editor.getValue())
    button.textContent = 'Copied!'
  } catch {
    button.textContent = 'Copy failed'
  }
  setTimeout(() => (button.textContent = label), 1500)
}

function bindUi() {
  $$('[data-mode]').forEach((tab) =>
    tab.addEventListener('click', () => {
      state.mode = tab.dataset.mode
      render()
    })
  )
  $('[data-action="run"]').addEventListener('click', run)
  $('[data-action="reset"]').addEventListener('click', reset)
  $('[data-action="copy"]').addEventListener('click', (e) => copy(e.currentTarget))

  window.addEventListener('message', (e) => {
    if (e.source !== preview.contentWindow || e.data?.type !== 'playground-error') return
    previewError.textContent = `Error: ${e.data.message}`
    previewError.hidden = false
  })
}

function showEditorMessage(text) {
  const message = document.createElement('p')
  message.className = 'editor-message'
  message.textContent = text
  editorHost.replaceChildren(message)
}

async function init() {
  if (!window.CodeMirror) {
    showEditorMessage('The code editor could not be loaded.')
    return
  }

  const runIfEditing = () => state.mode === 'edit' && run()
  editor = CodeMirror(editorHost, {
    lineNumbers: true,
    tabSize: 2,
    indentUnit: 2,
    readOnly: true,
    extraKeys: { 'Ctrl-Enter': runIfEditing, 'Cmd-Enter': runIfEditing },
  })
  editor.on('changes', updateMarker)
  bindUi()

  try {
    await loadSources()
    render()
  } catch (err) {
    showEditorMessage(`The source code could not be loaded (${err.message}).`)
  }
}

init()
