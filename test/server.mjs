// Static server for the Playwright tests: serves the repository root, so test pages can load
// dist/ (the built package) and the sample PDFs.

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const port = Number(process.env.PORT ?? 4173)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.ftl': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.png': 'image/png',
  '.pdf': 'application/pdf',
  '.wasm': 'application/wasm',
}

http
  .createServer((req, res) => {
    let pathname
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    } catch {
      res.writeHead(400).end()
      return
    }
    const file = path.join(root, pathname)
    if (!file.startsWith(root)) {
      res.writeHead(403).end()
      return
    }
    fs.readFile(file, (error, data) => {
      if (error) {
        res.writeHead(404).end()
        return
      }
      res.writeHead(200, {
        'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
      })
      res.end(data)
    })
  })
  .listen(port, '127.0.0.1', () => console.log(`Test server on http://127.0.0.1:${port}`))
