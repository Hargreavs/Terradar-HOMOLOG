/**
 * Re-reads RefinarSubstanciaSheet.tsx and rewrites as UTF-8. Some Windows tools save .tsx as UTF-16 (breaks Vite/oxc).
 * Run: npm run fix:utf8:refinar
 */
const fs = require('node:fs')
const path = require('node:path')

const p = path.join(__dirname, '..', 'src', 'components', 'dashboard', 'RefinarSubstanciaSheet.tsx')

function readAsText(buf) {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.slice(2).toString('utf16le')
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return buf.swap16().slice(2).toString('utf16le')
  }
  if (buf.length >= 4 && buf[1] === 0 && buf[3] === 0 && buf[5] === 0) {
    return buf.toString('utf16le')
  }
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.slice(3).toString('utf8')
  }
  return buf.toString('utf8')
}

const buf = fs.readFileSync(p)
const s = readAsText(buf)
fs.writeFileSync(p, s, { encoding: 'utf8' })
const check = fs.readFileSync(p)
if (check.length > 1 && check[1] === 0) {
  throw new Error(`Still UTF-16 after fix: ${p}`)
}
process.stdout.write(`utf-8: ${path.relative(path.join(__dirname, '..'), p)}\n`)
