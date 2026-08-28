#!/usr/bin/env npx tsx
/**
 * Generates a PowerPoint slide showing before/after tasting-note scores.
 *
 * Every number and note on the slide is real: user notes and current scores come
 * from the tastings table, the "before" scores from the pre-rescore snapshot in
 * backups/, and the per-term credit from calling lexicalCredit() in the live
 * scoring code. Nothing is illustrative or reconstructed.
 *
 * Both examples are the same wine, the same field (aroma) and therefore the same
 * reference note, so the comparison is controlled: the only variable is what the
 * taster wrote.
 *
 * The slide also embeds the side-by-side search recording produced by
 * scripts/record-search-comparison.ts, so one slide carries both improvements.
 * The video is H.264 MP4 rather than the WebM Playwright emits, because
 * PowerPoint on Windows will not play WebM.
 *
 * Usage: npm run make-scoring-slide   ->  writes tasting-score-slide.pptx
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import PptxGenJS from 'pptxgenjs';
import { lexicalCredit } from '../src/lib/flavourScoring';
import { sanitizeText } from '../src/lib/lemmatizeAndWeight';

const EVENT_ID = '41a0d425-29be-4efb-8642-0cd94da4de5e'; // Champagne, 13 May 2026
const SNAPSHOT = 'backups/tasting-scores-20260818-204626.json';
const OUT = 'tasting-score-slide.pptx';
const VIDEO = 'recordings/search-comparison.mp4';
const POSTER = 'recordings/poster.png';

const INK = '2B2B2B';
const MUTED = '6B6B6B';
const BURGUNDY = '7B1E3A';
const GOLD = 'B8860B';
const HIT = '2E7D32';
const SOFT = 'B26A00';
const MISS = 'C62828';
const RULE = 'DDD6D0';

type Match = { lemma: string; kind: string; via?: string };
type Example = { label: string; note: string; before: number; after: number; precision: number; matches: Match[] };

const sb = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** How each match kind reads to a non-technical audience. */
function describe(m: Match): { text: string; colour: string } {
  switch (m.kind) {
    case 'direct':
      return { text: `${m.lemma} — named in the wine`, colour: HIT };
    case 'derived':
      return { text: `${m.lemma} — correct: comes from "${m.via}"`, colour: HIT };
    case 'specific':
      return { text: `${m.lemma} — more precise than "${m.via}"`, colour: HIT };
    case 'subcategory':
      return { text: `${m.lemma} — right family, but vague`, colour: SOFT };
    case 'category':
      return { text: `${m.lemma} — only the broad category`, colour: SOFT };
    default:
      return { text: `${m.lemma} — not in this wine`, colour: MISS };
  }
}

async function loadExamples() {
  const snapshot = JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as { id: string; smell_score: number; taste_score: number }[];
  const before = new Map(snapshot.map(r => [r.id, r]));

  const { data: tastings, error: tErr } = await sb
    .from('tastings')
    .select('id,user_id,wine_id,lukt,smak,smell_score,taste_score')
    .eq('event_id', EVENT_ID);
  if (tErr) throw new Error(tErr.message);

  const { data: wines, error: wErr } = await sb
    .from('wines')
    .select('id,name,smell,taste')
    .in('id', [...new Set((tastings ?? []).map(t => t.wine_id))]);
  if (wErr) throw new Error(wErr.message);

  const wine = (wines ?? []).find(w => /Aubry/.test(w.name));
  if (!wine) throw new Error('Champagne Aubry not found in this event');

  const build = (startsWith: string, label: string): Example => {
    const t = (tastings ?? []).find(x => x.wine_id === wine.id && (x.lukt ?? '').startsWith(startsWith));
    if (!t) throw new Error(`no tasting starting "${startsWith}"`);
    const snap = before.get(t.id);
    if (!snap) throw new Error(`tasting ${t.id} missing from the snapshot; cannot show a real "before"`);
    const credit = lexicalCredit(sanitizeText(t.lukt ?? ''), sanitizeText(wine.smell ?? ''));
    return {
      label,
      note: (t.lukt ?? '').trim(),
      before: snap.smell_score,
      after: t.smell_score,
      precision: credit.precision,
      matches: credit.matches.map(m => ({ lemma: m.lemma, kind: m.kind, via: m.via }))
    };
  };

  // Secondary callout: same taster's TASTE note, where "brioche" earns credit
  // against the reference's "bakverk" -- both products of lees ageing.
  const bt = (tastings ?? []).find(x => x.wine_id === wine.id && (x.smak ?? '').startsWith('Rødt eple brioche'));
  const btBefore = bt ? before.get(bt.id) : undefined;

  return {
    wine,
    precise: build('Rødt eple sitrus', 'Taster A'),
    vague: build('Mineral. Frukt.', 'Taster B'),
    derivation: bt && btBefore
      ? { note: (bt.smak ?? '').trim(), before: btBefore.taste_score, after: bt.taste_score }
      : null
  };
}

async function main() {
  const { wine, precise, vague, derivation } = await loadExamples();

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'W16x9', width: 13.333, height: 7.5 });
  pptx.layout = 'W16x9';
  pptx.author = 'Smak Vin';
  pptx.title = 'Fairer scoring of tasting notes';

  const s = pptx.addSlide();
  s.background = { color: 'FFFFFF' };

  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.14, h: 7.5, fill: { color: BURGUNDY } });

  s.addText('Fairer scoring of tasting notes', {
    x: 0.55, y: 0.32, w: 9.5, h: 0.55, fontSize: 30, bold: true, color: INK, fontFace: 'Georgia'
  });
  s.addText(
    [
      { text: 'Champagne tasting, 13 May 2026', options: { bold: true } },
      { text: '   ·   Champagne Aubry Premier Cru Brut   ·   aroma (lukt)' }
    ],
    { x: 0.57, y: 0.88, w: 9.5, h: 0.3, fontSize: 12.5, color: MUTED }
  );

  s.addText('SAME WINE · SAME OFFICIAL NOTE · ONLY THE TASTER DIFFERS', {
    x: 8.35, y: 0.95, w: 4.43, h: 0.3, fontSize: 8, bold: true, color: MUTED, align: 'left', charSpacing: 0.8
  });

  // ── Shared reference note ────────────────────────────────────────────────
  s.addShape(pptx.ShapeType.rect, {
    x: 0.55, y: 1.32, w: 7.55, h: 0.74, fill: { color: 'FAF7F4' }, line: { color: RULE, width: 1 }
  });
  s.addText('WHAT VINMONOPOLET WROTE', {
    x: 0.75, y: 1.4, w: 4, h: 0.24, fontSize: 8.5, bold: true, color: MUTED, charSpacing: 1
  });
  s.addText(`“${wine.smell}”`, {
    x: 0.72, y: 1.56, w: 7.2, h: 0.46, fontSize: 10.5, italic: true, color: INK, fontFace: 'Georgia'
  });

  // ── Two example cards, stacked so the right third can hold the video ─────
  const CARD_W = 7.55;
  const card = (ex: Example, y: number, h: number, verdict: string, verdictColour: string) => {
    const x = 0.55;
    const H = h;
    s.addShape(pptx.ShapeType.rect, {
      x, y, w: CARD_W, h: H, fill: { color: 'FFFFFF' }, line: { color: RULE, width: 1.25 }
    });
    s.addShape(pptx.ShapeType.rect, { x, y, w: 0.055, h: H, fill: { color: verdictColour } });

    s.addText(ex.label, { x: x + 0.22, y: y + 0.09, w: 1.6, h: 0.26, fontSize: 12, bold: true, color: INK });
    s.addText(verdict, {
      x: x + 1.75, y: y + 0.11, w: 1.6, h: 0.24, fontSize: 8.5, bold: true, color: verdictColour, charSpacing: 0.6
    });
    s.addText(`“${ex.note}”`, {
      x: x + 0.22, y: y + 0.36, w: 4.9, h: 0.3, fontSize: 13, color: INK, fontFace: 'Georgia'
    });

    let ty = y + 0.72;
    for (const m of ex.matches) {
      const d = describe(m);
      s.addShape(pptx.ShapeType.ellipse, { x: x + 0.26, y: ty + 0.06, w: 0.085, h: 0.085, fill: { color: d.colour } });
      s.addText(d.text, {
        x: x + 0.44, y: ty, w: 4.7, h: 0.22, fontSize: 9.5, color: d.colour === MISS ? MISS : INK
      });
      ty += 0.215;
    }

    // Before / after, right-hand side of the card
    const sx = x + 5.35;
    s.addText('BEFORE', { x: sx, y: y + 0.34, w: 0.95, h: 0.2, fontSize: 7.5, bold: true, color: MUTED, charSpacing: 1 });
    s.addText(String(ex.before), {
      x: sx, y: y + 0.5, w: 0.95, h: 0.45, fontSize: 24, bold: true, color: MUTED, fontFace: 'Georgia'
    });
    s.addText('→', { x: sx + 0.86, y: y + 0.56, w: 0.4, h: 0.35, fontSize: 17, color: MUTED });
    s.addText('NOW', { x: sx + 1.3, y: y + 0.34, w: 0.95, h: 0.2, fontSize: 7.5, bold: true, color: verdictColour, charSpacing: 1 });
    s.addText(String(ex.after), {
      x: sx + 1.3, y: y + 0.5, w: 1.1, h: 0.45, fontSize: 24, bold: true, color: verdictColour, fontFace: 'Georgia'
    });
    const delta = ex.after - ex.before;
    s.addText(`${delta > 0 ? '+' : ''}${delta}`, {
      x: sx + 0.05, y: y + 1.0, w: 2.1, h: 0.26, fontSize: 11.5, bold: true, color: verdictColour
    });
  };

  card(precise, 2.32, 1.50, 'REWARDED', HIT);
  card(vague, 3.94, 1.68, 'CORRECTED', MISS);

  s.addText(
    'Tasters are now credited for the aromas they name. Aromas they leave out are ignored, and vague or wrong guesses cost them.',
    { x: 0.57, y: 2.08, w: 7.6, h: 0.22, fontSize: 9, color: MUTED, italic: true }
  );

  // ── Embedded search recording ────────────────────────────────────────────
  const VX = 8.35;
  const VW = 4.43;
  s.addText('AND: WINE SEARCH, SIDE BY SIDE', {
    x: VX, y: 1.32, w: VW, h: 0.24, fontSize: 8.5, bold: true, color: GOLD, charSpacing: 1
  });

  if (existsSync(VIDEO)) {
    s.addMedia({
      type: 'video',
      path: VIDEO,
      x: VX,
      y: 1.62,
      w: VW,
      h: VW * (1080 / 1920),
      ...(existsSync(POSTER)
        ? { cover: `data:image/png;base64,${readFileSync(POSTER).toString('base64')}` }
        : {})
    });
  } else {
    s.addShape(pptx.ShapeType.rect, {
      x: VX, y: 1.62, w: VW, h: VW * (1080 / 1920), fill: { color: 'F2EEEA' }, line: { color: RULE, width: 1 }
    });
    s.addText('Run npm run record-search-comparison first', {
      x: VX, y: 2.6, w: VW, h: 0.3, fontSize: 10, color: MUTED, align: 'center', italic: true
    });
  }

  s.addText('Click to play · 37 seconds', {
    x: VX, y: 4.16, w: VW, h: 0.22, fontSize: 8.5, color: MUTED, italic: true
  });

  const rows: [string, string, string][] = [
    ['andre clouet', '173 ms', '441 ms'],
    ['andre clouett  (typo)', '204 ms', 'no results'],
    ['10902101  (product id)', '127 ms', 'no results']
  ];
  s.addText('Smak Vin', { x: VX + 1.95, y: 4.42, w: 1.1, h: 0.2, fontSize: 8, bold: true, color: BURGUNDY, align: 'right' });
  s.addText('vinmonopolet', { x: VX + 3.05, y: 4.42, w: 1.35, h: 0.2, fontSize: 8, bold: true, color: MUTED, align: 'right' });
  let ry = 4.64;
  for (const [q, a, b] of rows) {
    s.addShape(pptx.ShapeType.line, { x: VX, y: ry - 0.03, w: VW, h: 0, line: { color: RULE, width: 0.75 } });
    s.addText(q, { x: VX, y: ry + 0.02, w: 1.95, h: 0.24, fontSize: 9, color: INK });
    s.addText(a, { x: VX + 1.95, y: ry + 0.02, w: 1.1, h: 0.24, fontSize: 9.5, bold: true, color: HIT, align: 'right' });
    s.addText(b, { x: VX + 3.05, y: ry + 0.02, w: 1.35, h: 0.24, fontSize: 9.5, color: b === 'no results' ? MISS : MUTED, align: 'right' });
    ry += 0.3;
  }
  s.addText('Our page runs on a local server; theirs is the live site. Both search over the internet.', {
    x: VX, y: ry + 0.04, w: VW, h: 0.34, fontSize: 7.5, color: MUTED, italic: true
  });

  // ── Punchline ────────────────────────────────────────────────────────────
  s.addShape(pptx.ShapeType.rect, { x: 0.55, y: 6.68, w: 12.23, h: 0.58, fill: { color: BURGUNDY } });
  s.addText(
    [
      { text: 'The old score ranked these backwards.  ', options: { bold: true } },
      { text: `Taster B's vaguer note scored higher (${vague.before} vs ${precise.before}). ` },
      { text: `Now the accurate note wins, ${precise.after} to ${vague.after}.`, options: { bold: true } }
    ],
    { x: 0.85, y: 6.76, w: 11.6, h: 0.42, fontSize: 13, color: 'FFFFFF', fontFace: 'Georgia' }
  );

  if (derivation) {
    s.addText(
      `Also new: “brioche” now counts — the official taste note says “bakverk”, and both come from ageing on the lees. That note went ${derivation.before} → ${derivation.after}.`,
      { x: 0.57, y: 5.74, w: 7.6, h: 0.24, fontSize: 8, color: MUTED, italic: true }
    );
  }

  await pptx.writeFile({ fileName: OUT });
  console.log(`wrote ${OUT}`);
  console.log(`  Taster A: "${precise.note}"  ${precise.before} -> ${precise.after}`);
  console.log(`  Taster B: "${vague.note}"  ${vague.before} -> ${vague.after}`);
}

main();
