import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFParse } from "pdf-parse";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfPath =
  process.env.ATLAS_PDF ||
  "C:\\Users\\alex-\\Downloads\\PLANILHAS OFICIAIS\\Atlas_CPT-2025-v4-digital-PGunica.pdf";
const outDir = process.env.OUT_DIR || path.join(__dirname, "atlas-cpt-extract");
fs.mkdirSync(outDir, { recursive: true });
const buf = fs.readFileSync(pdfPath);
const parser = new PDFParse({ data: new Uint8Array(buf) });
const result = await parser.getText();
await parser.destroy();
const txt = result.text || "";
fs.writeFileSync(path.join(outDir, "atlas-raw.txt"), txt, "utf8");
console.log("pages", result.total, "chars", txt.length, "->", path.join(outDir, "atlas-raw.txt"));