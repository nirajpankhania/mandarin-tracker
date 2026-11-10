import type { Slide } from "./pptx";

const HAN = /[㐀-鿿]/;
const ASSETS = "/pdfjs/";

export type Progress = (message: string) => void;

/**
 * Read the text of each page of a PDF, one "slide" per page. Runs in the browser.
 * Pages that are only pictures (scans, or slides exported as images) are read with OCR instead.
 */
export async function readPdf(file: File, onProgress: Progress = () => {}): Promise<{ slides: Slide[]; ocrPages: number }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = ASSETS + "pdf.worker.min.mjs";
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    cMapUrl: ASSETS + "cmaps/",
    cMapPacked: true,
    wasmUrl: ASSETS + "wasm/",
    standardFontDataUrl: ASSETS + "standard_fonts/",
  });
  const doc = await task.promise;

  try {
    const texts: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      onProgress(`Reading page ${n} of ${doc.numPages}`);
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      texts.push(linesFrom(content.items as TextItem[]));
    }

    // OCR pages with next to no text. If the whole file has no Chinese at all, the Chinese is
    // probably inside pictures, so OCR every page.
    const noChinese = !texts.some((t) => HAN.test(t));
    const needOcr = texts.map((t) => noChinese || t.replace(/\s/g, "").length < 8);
    const ocrPages = needOcr.filter(Boolean).length;

    if (ocrPages > 0) {
      onProgress("Loading the text recogniser (first time takes longest)");
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker(["chi_sim", "eng"]);
      try {
        let done = 0;
        for (let n = 1; n <= doc.numPages; n++) {
          if (!needOcr[n - 1]) continue;
          onProgress(`Recognising text in page images (${++done} of ${ocrPages})`);
          const page = await doc.getPage(n);
          const base = page.getViewport({ scale: 1 });
          // whole-number scale keeps picture pages sharp; aim for roughly 2000px across
          const viewport = page.getViewport({ scale: Math.min(3, Math.max(1, Math.round(2200 / base.width))) });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
          const { data } = await worker.recognize(canvas);
          const ocr = tidyOcr(data.text);
          // keep whichever reading found more
          if (ocr.replace(/\s/g, "").length > texts[n - 1].replace(/\s/g, "").length) texts[n - 1] = ocr;
          canvas.width = canvas.height = 0;
        }
      } finally {
        await worker.terminate();
      }
    }
    return { slides: texts.map((text, i) => ({ n: i + 1, text })), ocrPages };
  } finally {
    await task.destroy();
  }
}

type TextItem = { str: string; transform: number[]; width: number; height: number };

/** Rebuild lines of text from positioned fragments: same baseline = same line, big gaps = column breaks. */
function linesFrom(items: TextItem[]): string {
  const frags = items
    .filter((i) => typeof i.str === "string" && i.str.trim() !== "")
    .map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width, h: i.height || Math.abs(i.transform[3]) || 10 }));
  const lines: { y: number; h: number; frags: typeof frags }[] = [];
  for (const f of frags) {
    const line = lines.find((l) => Math.abs(l.y - f.y) < Math.max(l.h, f.h) * 0.5);
    if (line) line.frags.push(f);
    else lines.push({ y: f.y, h: f.h, frags: [f] });
  }
  lines.sort((a, b) => b.y - a.y); // PDF y runs upwards
  return lines
    .map((l) => {
      l.frags.sort((a, b) => a.x - b.x);
      let out = "";
      let end = 0;
      for (const [i, f] of l.frags.entries()) {
        if (i > 0) {
          const gap = f.x - end;
          if (gap > f.h * 1.5) out += "\t";
          else if (gap > f.h * 0.2 && !out.endsWith(" ") && !f.str.startsWith(" ")) out += " ";
        }
        out += f.str;
        end = f.x + f.w;
      }
      return out.trim();
    })
    .filter(Boolean)
    .join("\n");
}

/** OCR puts spaces between Chinese characters and adds stray blank lines; remove both. */
function tidyOcr(text: string): string {
  return text
    .split("\n")
    .map((l) => l.replace(/(?<=[㐀-鿿，。！？、：；])[ \t]+(?=[㐀-鿿，。！？、：；])/g, "").trim())
    .filter(Boolean)
    .join("\n");
}
