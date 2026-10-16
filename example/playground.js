const MONACO_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min'
const SOURCE_FILE = 'run.js'
const HOST_FILE = 'demo.html'
const TYPES_FILE = 'lib/index.d.ts'

const HINTS = {
  source: 'The real code of this example, exactly as it runs on this page. Hover over the API to see its docs.',
  edit: 'Edit the code with autocomplete from the library types (try the locale value), then press Run (Ctrl/⌘ + Enter).',
}

const THEMES = {
  light: { name: 'playground-light', base: 'vs', background: '#f6f8fa' },
  dark: { name: 'playground-dark', base: 'vs-dark', background: '#0d1117' },
}

const $ = (selector) => document.querySelector(selector)
const $$ = (selector) => document.querySelectorAll(selector)

const preview = $('#preview')
const previewStatus = $('#preview-status')
const previewError = $('#preview-error')
const editorHost = $('#editor')
const fileTab = $('#file-tab')
const darkScheme = matchMedia('(prefers-color-scheme: dark)')

const state = { mode: 'source' }
const models = {}
const viewStates = {}
let original
let hostHtml
let editor
let blobUrl

async function fetchText(name) {
  const res = await fetch(name, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`)
  return res.text()
}

function loadMonaco() {
  return new Promise((resolve, reject) => {
    if (!window.require?.config) {
      reject(new Error('Monaco loader unavailable'))
      return
    }
    const workerSource = `self.MonacoEnvironment = { baseUrl: '${MONACO_BASE}/' }; importScripts('${MONACO_BASE}/vs/base/worker/workerMain.js');`
    window.MonacoEnvironment = {
      getWorkerUrl: () => `data:text/javascript;charset=utf-8,${encodeURIComponent(workerSource)}`,
    }
    window.require.config({ paths: { vs: `${MONACO_BASE}/vs` } })
    window.require(['vs/editor/editor.main'], () => resolve(window.monaco), reject)
  })
}

function setupLanguage(monaco, types) {
  const js = monaco.languages.typescript.javascriptDefaults
  js.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    lib: ['esnext', 'dom'],
    allowNonTsExtensions: true,
  })
  js.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    diagnosticCodesToIgnore: [2451],
  })
  js.addExtraLib(types, 'file:///node_modules/pdf-web-viewer/index.d.ts')
}

function applyTheme(monaco) {
  Object.values(THEMES).forEach(({ name, base, background }) =>
    monaco.editor.defineTheme(name, {
      base,
      inherit: true,
      rules: [],
      colors: { 'editor.background': background, 'editor.lineHighlightBorder': '#00000000' },
    })
  )
  const update = () => monaco.editor.setTheme(THEMES[darkScheme.matches ? 'dark' : 'light'].name)
  update()
  darkScheme.addEventListener('change', update)
}

function createEditor(monaco) {
  models.source = monaco.editor.createModel(
    original,
    'javascript',
    monaco.Uri.parse('file:///original/run.js')
  )
  models.edit = monaco.editor.createModel(original, 'javascript', monaco.Uri.parse('file:///run.js'))
  models.edit.onDidChangeContent(updateMarker)

  editor = monaco.editor.create(editorHost, {
    model: models.source,
    readOnly: true,
    automaticLayout: true,
    fixedOverflowWidgets: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    fontSize: 13,
    tabSize: 2,
  })
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
    if (state.mode === 'edit') run()
  })
}

const isModified = () => models.edit.getValue() !== original

function updateMarker() {
  fileTab.classList.toggle('modified', state.mode === 'edit' && isModified())
}

function setMode(mode) {
  if (mode === state.mode) return
  viewStates[state.mode] = editor.saveViewState()
  state.mode = mode
  render()
}

function render() {
  const editing = state.mode === 'edit'
  editor.setModel(models[state.mode])
  if (viewStates[state.mode]) editor.restoreViewState(viewStates[state.mode])
  editor.updateOptions({ readOnly: !editing })

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
    new Blob([buildPage(models.edit.getValue())], { type: 'text/html;charset=utf-8' })
  )
  showPreview(blobUrl, true)
}

function reset() {
  if (isModified() && !confirm('Discard your changes and restore the original code?')) return
  models.edit.setValue(original)
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
  $$('[data-mode]').forEach((tab) => tab.addEventListener('click', () => setMode(tab.dataset.mode)))
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
  try {
    const [monaco, sources] = await Promise.all([
      loadMonaco(),
      Promise.all([fetchText(SOURCE_FILE), fetchText(HOST_FILE), fetchText(TYPES_FILE)]),
    ])
    let types
    ;[original, hostHtml, types] = sources

    setupLanguage(monaco, types)
    applyTheme(monaco)
    createEditor(monaco)
    bindUi()
    render()
  } catch (err) {
    showEditorMessage(`The code editor could not be loaded (${err?.message ?? err}).`)
  }
}

init()
