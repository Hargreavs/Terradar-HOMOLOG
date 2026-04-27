/**
 * Re-reads src/lib/radar/*.ts and rewrites as UTF-8. Use when the editor saves UTF-16 (breaks Vite/oxc).
 * Run: node scripts/ensure-utf8-radar.cjs
 */
const fs = require('node:fs')
const path = require('node:path')

const dir = path.join(__dirname, '..', 'src', 'lib', 'radar')

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

let n = 0
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.ts')) continue
  const p = path.join(dir, f)
  const buf = fs.readFileSync(p)
  const s = readAsText(buf)
  fs.writeFileSync(p, s, { encoding: 'utf8' })
  const check = fs.readFileSync(p)
  const bad = check.length > 1 && check[1] === 0
  if (bad) {
    throw new Error(`Still UTF-16 after fix: ${p}`)
  }
  n += 1
  process.stdout.write(`utf-8: ${path.relative(path.join(__dirname, '..'), p)}\n`)
}
process.stdout.write(`OK ${n} file(s) in src/lib/radar\n`)
