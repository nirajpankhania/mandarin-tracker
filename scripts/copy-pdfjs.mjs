// Copies the PDF reader's worker and CJK character maps into public/ so the browser can load them.
// Runs automatically after `npm install` (locally and on Vercel).
import { cpSync, mkdirSync, copyFileSync } from "node:fs";

const src = "node_modules/pdfjs-dist";
const out = "public/pdfjs";
mkdirSync(out, { recursive: true });
copyFileSync(`${src}/legacy/build/pdf.worker.min.mjs`, `${out}/pdf.worker.min.mjs`);
for (const dir of ["cmaps", "wasm", "standard_fonts"]) cpSync(`${src}/${dir}`, `${out}/${dir}`, { recursive: true });
console.log("pdfjs assets copied to public/pdfjs");
