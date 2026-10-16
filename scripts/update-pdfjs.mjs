// Syncs the bundled PDF.js viewer (build/ and web/) with the `pdfjs-dist` version in package.json.
//
// npm's `pdfjs-dist` ships the library but not the viewer app (viewer.html, viewer.mjs, locales),
// so the matching release zip is downloaded from GitHub instead.
// `pdfjs-dist` is a devDependency only to pin the version and let pnpm/Renovate track updates.
//
// The legacy build is used by default: the modern one relies on the newest JavaScript features
// (PDF.js 6 needs `Map.prototype.getOrInsertComputed`) and breaks in browsers a few months old.
//
// Usage:
//   pnpm up pdfjs-dist --latest   # pick the version
//   pnpm update:pdfjs             # download it, patch it and rebuild
//   node scripts/update-pdfjs.mjs [version] [--modern] && pnpm build:example

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))

const args = process.argv.slice(2)
const modern = args.includes('--modern')
const version =
  args.find((arg) => !arg.startsWith('--')) ??
  pkg.devDependencies?.['pdfjs-dist']?.replace(/^[\^~=v]/, '')
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  fail(`Expected an exact pdfjs-dist version in package.json devDependencies, got "${version}".`)
}

/**
 * Edits applied to the PDF.js viewer after each update. If PDF.js changes the code around one of
 * them, the script stops so it can be reviewed instead of shipping an unpatched viewer.
 */
const PATCHES = [
  {
    file: 'web/viewer.mjs',
    why: 'Allow PDF files from other origins (the server must allow CORS).',
    find: `    const ex = new Error("file origin does not match viewer's");`,
    replace: `    // pdf-web-viewer patch: allow PDF files from other origins (the server must allow CORS).
    return;
    const ex = new Error("file origin does not match viewer's");`,
  },
  {
    file: 'web/viewer.mjs',
    why: 'Avoid a console error when a page re-renders before its annotation layer finishes.',
    find: `    if (this.#annotations === null) {
      throw new Error("\`render\` method must be called before \`injectLinkAnnotations\`.");
    }`,
    replace: `    if (this.#annotations === null) {
      // pdf-web-viewer patch: a re-render (zoom, resize, sidebar) can get here while the first
      // \`render\` is still in progress; that render injects the links itself once it finishes.
      return;
    }`,
  },
]

const zipName = `pdfjs-${version}${modern ? '' : '-legacy'}-dist.zip`
const url = `https://github.com/mozilla/pdf.js/releases/download/v${version}/${zipName}`
console.log(`Downloading PDF.js ${version} (${modern ? 'modern' : 'legacy'} build)\n  ${url}`)
const res = await fetch(url)
if (!res.ok) fail(`Download failed: HTTP ${res.status}. Is ${version} a published PDF.js release?`)
const entries = readZip(Buffer.from(await res.arrayBuffer()))

const viewer = entries.get('web/viewer.mjs')
const bundledVersion = viewer && /pdfjsVersion = (\S+)/.exec(viewer.toString('utf8'))?.[1]
if (bundledVersion !== version)
  fail(`The zip contains PDF.js ${bundledVersion}, expected ${version}.`)

// Patch in memory first, so a failed patch leaves the current viewer untouched.
for (const patch of PATCHES) {
  const source = entries.get(patch.file).toString('utf8')
  const count = source.split(patch.find).length - 1
  if (count !== 1) {
    fail(`Patch not applied to ${patch.file} (found ${count} matches): ${patch.why}
Review the PDF.js code and update PATCHES in scripts/update-pdfjs.mjs.`)
  }
  entries.set(patch.file, Buffer.from(source.replace(patch.find, () => patch.replace)))
}

for (const dir of ['build', 'web']) {
  fs.rmSync(path.join(root, dir), { recursive: true, force: true })
}
let written = 0
for (const [name, data] of entries) {
  if (!name.startsWith('build/') && !name.startsWith('web/')) continue
  const target = path.join(root, name)
  if (!target.startsWith(root + path.sep)) fail(`Unsafe path in zip: ${name}`)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, data)
  written++
}
console.log(`Wrote ${written} files to build/ and web/, applied ${PATCHES.length} patches.`)

writeLocaleType()
console.log(`PDF.js ${version} is in place in build/ and web/.`)

/**
 * Regenerates the `Locale` type from the folders in web/locale/, keeping the existing names.
 */
function writeLocaleType() {
  const file = path.join(root, 'src/locale.ts')
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
  const known = new Map([...current.matchAll(/\| '([^']+)' \/\/ (.+)/g)].map((m) => [m[1], m[2]]))
  const displayNames = new Intl.DisplayNames('en', {
    type: 'language',
    languageDisplay: 'standard',
  })

  const codes = fs
    .readdirSync(path.join(root, 'web/locale'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

  const lines = codes.map((code) => {
    let name = known.get(code)
    if (!name) {
      try {
        name = displayNames.of(code)
      } catch {
        name = code
      }
    }
    return `  | '${code}' // ${name}`
  })

  const body = current.replace(
    /export type Locale =\n(  \| .+\n)+/,
    `export type Locale =\n${lines.join('\n')}\n`
  )
  fs.writeFileSync(file, body)

  const added = codes.filter((code) => !known.has(code))
  const removed = [...known.keys()].filter((code) => !codes.includes(code))
  console.log(
    `Locales: ${codes.length}` +
      (added.length ? `, added ${added.join(', ')}` : '') +
      (removed.length ? `, removed ${removed.join(', ')}` : '')
  )
}

/**
 * Minimal ZIP reader (stored and deflated entries), enough for the PDF.js release zip.
 * @param {Buffer} zip
 * @returns {Map<string, Buffer>} File name to contents, directories excluded.
 */
function readZip(zip) {
  const EOCD = 0x06054b50
  let eocd = zip.length - 22
  while (eocd >= 0 && zip.readUInt32LE(eocd) !== EOCD) eocd--
  if (eocd < 0) fail('Invalid zip file.')

  const count = zip.readUInt16LE(eocd + 10)
  let offset = zip.readUInt32LE(eocd + 16)
  const files = new Map()

  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) fail('Invalid zip central directory.')
    const method = zip.readUInt16LE(offset + 10)
    const compressedSize = zip.readUInt32LE(offset + 20)
    const nameLength = zip.readUInt16LE(offset + 28)
    const extraLength = zip.readUInt16LE(offset + 30)
    const commentLength = zip.readUInt16LE(offset + 32)
    const localOffset = zip.readUInt32LE(offset + 42)
    const name = zip.toString('utf8', offset + 46, offset + 46 + nameLength)
    offset += 46 + nameLength + extraLength + commentLength

    if (name.endsWith('/')) continue
    if (compressedSize === 0xffffffff || localOffset === 0xffffffff)
      fail('ZIP64 archives are not supported.')

    const dataStart =
      localOffset + 30 + zip.readUInt16LE(localOffset + 26) + zip.readUInt16LE(localOffset + 28)
    const data = zip.subarray(dataStart, dataStart + compressedSize)
    if (method === 0) files.set(name, Buffer.from(data))
    else if (method === 8) files.set(name, zlib.inflateRawSync(data))
    else fail(`Unsupported zip compression method ${method} for ${name}.`)
  }
  return files
}

function fail(message) {
  console.error(`update-pdfjs: ${message}`)
  process.exit(1)
}
