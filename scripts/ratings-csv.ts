/**
 * Reading rater files (scripts/validation-results/ratings/rater-*.csv).
 *
 * The sheet is written with semicolons so Norwegian Excel opens it, but a
 * rater may export from Numbers or Google Sheets, which write commas. The
 * delimiter is taken from the header line: whichever of ';' and ',' occurs
 * more. A file that is not text at all (a Numbers document renamed to .csv
 * starts with "PK") is reported, not silently treated as an empty rater.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const RATINGS_DIR = 'scripts/validation-results/ratings';

export function parseCsv(text: string): Record<string, string>[] {
  const src = text.replace(/^﻿/, '');
  const header = src.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = (header.match(/;/g)?.length ?? 0) >= (header.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  if (!head) return [];
  return body.filter(r => r.some(Boolean)).map(r => Object.fromEntries(head.map((h, i) => [h.trim().toLowerCase(), r[i] ?? ''])));
}

/**
 * The evaluation target: the human rater's rating where there is one, else
 * the calibrated gpt-4o panel member's (agreement with the human 0.61 on
 * fields it never saw rated), so every scoreable field has a rating.
 */
export function loadTarget(primary = 'kristian', fallback = 'llmcal-gpt-4o'): { ratings: Map<string, number>; fromHuman: number; fromFallback: number } {
  const raters = loadRaterFiles();
  const h = raters.get(primary) ?? new Map<string, number>();
  const f = raters.get(fallback) ?? new Map<string, number>();
  const ratings = new Map<string, number>(f);
  for (const [k, v] of h) ratings.set(k, v);
  return { ratings, fromHuman: h.size, fromFallback: ratings.size - h.size };
}

/** rater name → (field key → rating 0..4), one entry per readable rater file. */
export function loadRaterFiles(): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  if (!existsSync(RATINGS_DIR)) return out;
  for (const f of readdirSync(RATINGS_DIR).filter(f => /^rater-.*\.csv$/i.test(f))) {
    const path = join(RATINGS_DIR, f);
    const bytes = readFileSync(path);
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
      console.error(`${path}: this is a zip-based document (Numbers/Excel), not CSV. Use File → Export To → CSV and save over it.`);
      continue;
    }
    const m = new Map<string, number>();
    let seen = 0;
    for (const r of parseCsv(bytes.toString('utf8'))) {
      seen++;
      const v = Number(String(r.rating ?? '').replace(',', '.'));
      if (r.key && r.rating !== '' && Number.isInteger(v) && v >= 0 && v <= 4) m.set(r.key, v);
    }
    if (m.size) out.set(f.replace(/^rater-|\.csv$/gi, ''), m);
    else console.error(`${path}: ${seen} rows read, none with a key and a 0–4 rating; check the header names and the delimiter.`);
  }
  return out;
}
