import type { Slide } from "./pptx";

const ASSETS = "/pdfjs/";
const MAX_IMAGE_BYTES = 3_000_000; // total budget for page pictures sent to the server

export type Progress = (message: string) => void;
export type PdfSlide = Slide & { image?: string };

/**
 * Read the text of each page of a PDF, one "slide" per page. Runs in the browser.
 * Pages with no selectable text (scans, or slides exported as pictures) come back with a
 * small JPEG of the page instead, for the AI parser to read.
 */
export async function readPdf(file: File, onProgress: Progress = () => {}): Promise<PdfSlide[]> {
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
    const slides: PdfSlide[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      onProgress(`Reading page ${n} of ${doc.numPages}`);
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      slides.push({ n, text: linesFrom(content.items as TextItem[]) });
    }

    const blank = slides.filter((s) => s.text.replace(/\s/g, "").length < 8);
    if (blank.length > 0) {
      const perPage = Math.floor(MAX_IMAGE_BYTES / blank.length);
      for (const s of blank) {
        onProgress(`Page ${s.n} has no selectable text; taking a picture of it`);
        const page = await doc.getPage(s.n);
        const base = page.getViewport({ scale: 1 });
        const canvas = document.createElement("canvas");
        // shrink until the picture fits its share of the upload budget
        for (const width of [1400, 1100, 800, 600]) {
          const viewport = page.getViewport({ scale: width / base.width });
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
          const data = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
          s.image = data;
          if (data.length * 0.75 <= perPage) break;
        }
        canvas.width = canvas.height = 0;
      }
    }
    return slides;
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
