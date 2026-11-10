import { createHash } from "crypto";
import JSZip from "jszip";
import initSqlJs from "sql.js/dist/sql-wasm-inline.js";

export type AnkiCard = {
  id: number;
  hanzi: string;
  pinyin: string;
  meaning: string;
  example: string;
  lessonId: number | null;
  lessonLabel: string; // e.g. "2026-11-09 Ordering food"
};

// Fixed ids so re-importing a newer export updates the same deck, note type and notes in Anki.
const MODEL_ID = 1731150000001;
const DECK_BASE = 1731150100000;
const NOTE_BASE = 1731160000000;
const ROOT_DECK = "Mandarin lessons";

const CSS = `.card { font-family: -apple-system, "Segoe UI", sans-serif; font-size: 22px; text-align: center; color: #000; background: #fcefd4; }
.hanzi { font-family: "Kaiti SC", STKaiti, KaiTi, "Noto Serif CJK SC", serif; font-size: 72px; line-height: 1.2; }
.pinyin { color: #97630c; font-size: 26px; margin-top: 8px; }
.meaning { font-size: 24px; margin-top: 8px; }
.example { font-family: "Kaiti SC", STKaiti, KaiTi, serif; font-size: 26px; margin-top: 18px; color: #492222; }
.lesson { font-size: 13px; color: #888; margin-top: 18px; }`;

const BACK_EXTRA = `{{#Example}}<div class="example">{{Example}}</div>{{/Example}}<div class="lesson">{{Lesson}}</div>`;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");

export async function buildApkg(cards: AnkiCard[]): Promise<Uint8Array> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  const now = Date.now();
  const sec = Math.floor(now / 1000);

  db.run(`
    CREATE TABLE col (id integer primary key, crt integer not null, mod integer not null, scm integer not null, ver integer not null, dty integer not null, usn integer not null, ls integer not null, conf text not null, models text not null, decks text not null, dconf text not null, tags text not null);
    CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null, mod integer not null, usn integer not null, tags text not null, flds text not null, sfld integer not null, csum integer not null, flags integer not null, data text not null);
    CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null, ord integer not null, mod integer not null, usn integer not null, type integer not null, queue integer not null, due integer not null, ivl integer not null, factor integer not null, reps integer not null, lapses integer not null, left integer not null, odue integer not null, odid integer not null, flags integer not null, data text not null);
    CREATE TABLE revlog (id integer primary key, cid integer not null, usn integer not null, ease integer not null, ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null, type integer not null);
    CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
    CREATE INDEX ix_notes_usn on notes (usn);
    CREATE INDEX ix_cards_usn on cards (usn);
    CREATE INDEX ix_revlog_usn on revlog (usn);
    CREATE INDEX ix_cards_nid on cards (nid);
    CREATE INDEX ix_cards_sched on cards (did, queue, due);
    CREATE INDEX ix_revlog_cid on revlog (cid);
    CREATE INDEX ix_notes_csum on notes (csum);
  `);

  const deck = (id: number, name: string) => ({
    id, name, mod: sec, usn: -1, lrnToday: [0, 0], revToday: [0, 0], newToday: [0, 0], timeToday: [0, 0],
    collapsed: false, browserCollapsed: false, desc: "", dyn: 0, conf: 1, extendNew: 0, extendRev: 0,
  });
  const decks: Record<string, ReturnType<typeof deck>> = { "1": deck(1, "Default"), [DECK_BASE]: deck(DECK_BASE, ROOT_DECK) };
  const deckFor = (c: AnkiCard) => {
    if (c.lessonId == null) return DECK_BASE;
    const id = DECK_BASE + c.lessonId;
    if (!decks[id]) decks[id] = deck(id, `${ROOT_DECK}::${c.lessonLabel.replace(/::/g, " ").replace(/"/g, "'")}`);
    return id;
  };

  const fld = (name: string, ord: number) => ({ name, ord, sticky: false, rtl: false, font: "Arial", size: 20, media: [] });
  const models = {
    [MODEL_ID]: {
      id: MODEL_ID, name: "Mandarin lesson vocab", type: 0, mod: sec, usn: -1, sortf: 0, did: DECK_BASE,
      flds: ["Hanzi", "Pinyin", "Meaning", "Example", "Lesson"].map(fld),
      tmpls: [
        {
          name: "Read", ord: 0, did: null, bqfmt: "", bafmt: "",
          qfmt: `<div class="hanzi">{{Hanzi}}</div>`,
          afmt: `<div class="hanzi">{{Hanzi}}</div><hr id="answer"><div class="pinyin">{{Pinyin}}</div><div class="meaning">{{Meaning}}</div>${BACK_EXTRA}`,
        },
        {
          name: "Recall", ord: 1, did: null, bqfmt: "", bafmt: "",
          qfmt: `<div class="meaning">{{Meaning}}</div>`,
          afmt: `<div class="meaning">{{Meaning}}</div><hr id="answer"><div class="hanzi">{{Hanzi}}</div><div class="pinyin">{{Pinyin}}</div>${BACK_EXTRA}`,
        },
      ],
      css: CSS, tags: [], vers: [], req: [[0, "any", [0]], [1, "any", [2]]],
      latexPre: "\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n",
      latexPost: "\\end{document}",
    },
  };

  const conf = {
    activeDecks: [1], curDeck: 1, newSpread: 0, collapseTime: 1200, timeLim: 0, estTimes: true, dueCounts: true,
    curModel: null, nextPos: 1, sortType: "noteFld", sortBackwards: false, addToCur: true,
  };
  const dconf = {
    "1": {
      id: 1, name: "Default", mod: 0, usn: 0, maxTaken: 60, autoplay: true, timer: 0, replayq: true, dyn: false,
      new: { bury: true, delays: [1, 10], initialFactor: 2500, ints: [1, 4, 7], order: 1, perDay: 20, separate: true },
      lapse: { delays: [10], leechAction: 0, leechFails: 8, minInt: 1, mult: 0 },
      rev: { bury: true, ease4: 1.3, fuzz: 0.05, ivlFct: 1, maxIvl: 36500, minSpace: 1, perDay: 100 },
    },
  };

  let pos = 1;
  for (const c of cards) {
    const did = deckFor(c);
    const nid = NOTE_BASE + c.id;
    const fields = [esc(c.hanzi), esc(c.pinyin), esc(c.meaning), esc(c.example), esc(c.lessonLabel)];
    const csum = parseInt(createHash("sha1").update(c.hanzi, "utf8").digest("hex").slice(0, 8), 16);
    const tags = c.lessonId == null ? "" : ` lesson-${c.lessonId} `;
    db.run("INSERT INTO notes VALUES (?,?,?,?,?,?,?,?,?,?,?)", [nid, `mlt-vocab-${c.id}`, MODEL_ID, sec, -1, tags, fields.join("\x1f"), c.hanzi, csum, 0, ""]);
    for (const ord of [0, 1]) {
      db.run("INSERT INTO cards VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [NOTE_BASE + c.id * 2 + ord + 500000000, nid, did, ord, sec, -1, 0, 0, pos++, 0, 0, 0, 0, 0, 0, 0, 0, ""]);
    }
  }

  db.run("INSERT INTO col VALUES (1,?,?,?,11,0,0,0,?,?,?,?,'{}')", [sec, now, now, JSON.stringify(conf), JSON.stringify(models), JSON.stringify(decks), JSON.stringify(dconf)]);

  const zip = new JSZip();
  zip.file("collection.anki2", db.export());
  zip.file("media", "{}");
  db.close();
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
