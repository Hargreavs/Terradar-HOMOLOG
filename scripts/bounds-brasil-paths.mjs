import fs from 'node:fs'
const t = fs.readFileSync('src/data/brasil-ufs-paths.ts', 'utf8')
let minX = Infinity,
  maxX = -Infinity,
  minY = Infinity,
  maxY = -Infinity
for (const sub of t.matchAll(/: "([^"]+)"/g)) {
  const d = sub[1]
  for (const x of d.matchAll(/(\d+\.?\d*),(\d+\.?\d*)/g)) {
    const px = parseFloat(x[1])
    const py = parseFloat(x[2])
    minX = Math.min(minX, px)
    maxX = Math.max(maxX, px)
    minY = Math.min(minY, py)
    maxY = Math.max(maxY, py)
  }
}
const pad = 4
console.log({ minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY })
console.log(
  `viewBox "${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}"`,
)
