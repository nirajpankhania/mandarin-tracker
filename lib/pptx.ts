import JSZip from "jszip";

export type Slide = { n: number; text: string };

/** Read the text of each slide from a .pptx, in presentation order. Runs in the browser. */
export async function readPptx(file: File): Promise<Slide[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = (s: string) => new DOMParser().parseFromString(s, "application/xml");
  const read = async (path: string) => {
    const f = zip.file(path);
    return f ? xml(await f.async("string")) : null;
  };

  let paths: string[] = [];
  const pres = await read("ppt/presentation.xml");
  const rels = await read("ppt/_rels/presentation.xml.rels");
  if (pres && rels) {
    const targets = new Map<string, string>();
    for (const r of Array.from(rels.getElementsByTagName("Relationship"))) {
      targets.set(r.getAttribute("Id") ?? "", r.getAttribute("Target") ?? "");
    }
    for (const el of Array.from(pres.getElementsByTagName("p:sldId"))) {
      const t = targets.get(el.getAttribute("r:id") ?? "");
      if (t) paths.push(t.startsWith("/") ? t.slice(1) : "ppt/" + t);
    }
  }
  if (paths.length === 0) {
    const num = (p: string) => Number(p.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
    paths = Object.keys(zip.files)
      .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
      .sort((a, b) => num(a) - num(b));
  }
  if (paths.length === 0) throw new Error("No slides found. Is this a .pptx file?");

  const slides: Slide[] = [];
  for (let i = 0; i < paths.length; i++) {
    const doc = await read(paths[i]);
    if (!doc) continue;
    const lines: string[] = [];
    walk(doc.documentElement, lines);
    slides.push({ n: i + 1, text: lines.filter((l) => l.trim()).join("\n") });
  }
  return slides;
}

function paraText(p: Element): string {
  return Array.from(p.getElementsByTagName("a:t")).map((t) => t.textContent ?? "").join("");
}

function walk(el: Element, lines: string[]) {
  for (const child of Array.from(el.children)) {
    if (child.tagName === "a:tbl") {
      // one line per table row, cells separated by tabs (vocab tables are common in lesson slides)
      for (const row of Array.from(child.getElementsByTagName("a:tr"))) {
        const cells = Array.from(row.getElementsByTagName("a:tc")).map((c) =>
          Array.from(c.getElementsByTagName("a:p")).map(paraText).join(" ").trim()
        );
        lines.push(cells.join("\t"));
      }
    } else if (child.tagName === "a:p") {
      lines.push(paraText(child));
    } else {
      walk(child, lines);
    }
  }
}
