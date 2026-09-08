#!/usr/bin/env npx tsx
/**
 * Generates a PowerPoint slide explaining how the wine search works.
 *
 * The nine ranking tiers are asserted against scripts/021-search-overhaul.sql at
 * generation time, so the slide cannot quietly drift out of step with the
 * function it describes. If a tier score changes in SQL, this script fails
 * rather than printing a stale ladder.
 *
 * Usage: npm run make-search-slide   ->  writes search-explained-slide.pptx
 */
import { readFileSync } from 'node:fs';
import PptxGenJS from 'pptxgenjs';

const MIGRATION = 'scripts/021-search-overhaul.sql';
const OUT = 'search-explained-slide.pptx';

const INK = '2B2B2B';
const MUTED = '6B6B6B';
const FAINT = '9A9A9A';
const BURGUNDY = '7B1E3A';
const GOLD = 'B8860B';
const RULE = 'DDD6D0';
const PANEL = 'FAF7F4';

/** One rung of the ladder in search_wines_fuzzy. `sql` must appear in the migration. */
type Tier = { score: string; sql: string; what: string; example: string };

const TIERS: Tier[] = [
  { score: '1.00', sql: "w.product_id = q.digits",             what: 'It is a product number',              example: '10902101' },
  { score: '0.98', sql: "w.search_name = q.n",                 what: 'The whole name, exactly',             example: 'andré clouet rosé' },
  { score: '0.92', sql: "w.search_name LIKE q.n || '%'",       what: 'The name starts with what you typed', example: 'andre clo…' },
  { score: '0.85', sql: "w.search_name LIKE '% ' || q.n",      what: 'You typed the start of a word in it', example: 'clouet' },
  { score: '0.80', sql: "w.search_tokens @> q.toks",           what: 'All your words, in any order',        example: 'clouet andre' },
  { score: '0.75', sql: "w.search_name LIKE '%' || q.n",       what: 'Your text appears somewhere in it',   example: 'louet' },
  { score: '0.60', sql: "0.60 * word_similarity(q.n, w.search_name)", what: 'Close, but misspelled',        example: 'andre clouett' },
  { score: '0.50', sql: "w.search_meta LIKE '%' || q.n",       what: 'Producer, region, or grape',          example: 'champagne · nebbiolo' },
  { score: '0.40', sql: "0.40 * word_similarity(q.n, w.search_meta)", what: 'Close on one of those',        example: 'burgund' }
];

const STEPS: { title: string; body: string }[] = [
  {
    title: 'You type at least three letters',
    body: 'The index stores names in three-letter chunks, so it cannot help with one or two. “an” would match thousands of wines anyway.'
  },
  {
    title: 'Your text is simplified',
    body: 'André becomes andre, Tårnhuset becomes tarnhuset, punctuation is dropped. Every wine name is stored the same way, so the two always meet.'
  },
  {
    title: 'Nine questions are asked at once',
    body: 'Each one is a different way a wine could match — from “is this a product number?” down to “is this a near-miss?”'
  },
  {
    title: 'The best answer wins',
    body: 'A wine found by several questions keeps its highest score. Equal scores are broken by the shorter name, which is the closer match.'
  },
  {
    title: 'Duplicates dropped, 20 sent back',
    body: 'Your browser remembers recent searches, so deleting a letter is instant and costs nothing.'
  }
];

function assertTiersMatchSql() {
  const sql = readFileSync(MIGRATION, 'utf8');
  const missing = TIERS.filter(t => !sql.includes(t.sql) || !sql.includes(t.score));
  if (missing.length) {
    throw new Error(
      `These tiers no longer match ${MIGRATION}: ${missing.map(m => m.score).join(', ')}. ` +
      'Update the slide to match the search function, not the other way round.'
    );
  }
}

async function main() {
  assertTiersMatchSql();

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'W16x9', width: 13.333, height: 7.5 });
  pptx.layout = 'W16x9';
  pptx.author = 'Smak Vin';
  pptx.title = 'How the wine search works';

  const s = pptx.addSlide();
  s.background = { color: 'FFFFFF' };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.14, h: 7.5, fill: { color: BURGUNDY } });

  s.addText('How the wine search works', {
    x: 0.55, y: 0.3, w: 9, h: 0.55, fontSize: 30, bold: true, color: INK, fontFace: 'Georgia'
  });
  s.addText('From keystroke to results, across 50 057 wines', {
    x: 0.57, y: 0.86, w: 9, h: 0.3, fontSize: 13, color: MUTED
  });

  // ── Left: the journey of one keystroke ───────────────────────────────────
  const LX = 0.55;
  const LW = 4.95;
  s.addText('WHAT HAPPENS WHEN YOU TYPE', {
    x: LX, y: 1.35, w: LW, h: 0.24, fontSize: 8.5, bold: true, color: GOLD, charSpacing: 1
  });

  let sy = 1.72;
  STEPS.forEach((step, i) => {
    s.addShape(pptx.ShapeType.ellipse, {
      x: LX, y: sy + 0.02, w: 0.3, h: 0.3, fill: { color: BURGUNDY }
    });
    s.addText(String(i + 1), {
      x: LX, y: sy + 0.05, w: 0.3, h: 0.25, fontSize: 12, bold: true, color: 'FFFFFF', align: 'center'
    });
    s.addText(step.title, {
      x: LX + 0.42, y: sy, w: LW - 0.42, h: 0.26, fontSize: 12.5, bold: true, color: INK
    });
    s.addText(step.body, {
      x: LX + 0.42, y: sy + 0.27, w: LW - 0.42, h: 0.6, fontSize: 9.5, color: MUTED
    });
    // Connector between the numbered markers
    if (i < STEPS.length - 1) {
      s.addShape(pptx.ShapeType.line, {
        x: LX + 0.15, y: sy + 0.34, w: 0, h: 0.58, line: { color: RULE, width: 1.25 }
      });
    }
    sy += 0.92;
  });

  // ── Right: the ranking ladder ────────────────────────────────────────────
  const RX = 5.85;
  const RW = 6.93;
  s.addText('HOW RESULTS ARE PUT IN ORDER', {
    x: RX, y: 1.35, w: RW, h: 0.24, fontSize: 8.5, bold: true, color: GOLD, charSpacing: 1
  });

  s.addShape(pptx.ShapeType.rect, {
    x: RX, y: 1.68, w: RW, h: 4.52, fill: { color: PANEL }, line: { color: RULE, width: 1 }
  });

  let ry = 1.78;
  TIERS.forEach((t, i) => {
    // The badge fades down the ladder: the top rungs are certainties, the
    // bottom rungs are guesses.
    const strength = 1 - i / (TIERS.length - 1);
    const colour = strength > 0.6 ? BURGUNDY : strength > 0.25 ? '9A6070' : FAINT;

    s.addShape(pptx.ShapeType.roundRect, {
      x: RX + 0.16, y: ry + 0.04, w: 0.62, h: 0.31, fill: { color: colour }, rectRadius: 0.05
    });
    s.addText(t.score, {
      x: RX + 0.16, y: ry + 0.08, w: 0.62, h: 0.24, fontSize: 10, bold: true, color: 'FFFFFF', align: 'center'
    });
    s.addText(t.what, {
      x: RX + 0.92, y: ry + 0.05, w: 3.3, h: 0.28, fontSize: 11.5, color: INK
    });
    s.addText(t.example, {
      x: RX + 4.25, y: ry + 0.07, w: 2.5, h: 0.26, fontSize: 10, color: MUTED, italic: true, align: 'right'
    });
    if (i < TIERS.length - 1) {
      s.addShape(pptx.ShapeType.line, {
        x: RX + 0.16, y: ry + 0.4, w: RW - 0.32, h: 0, line: { color: RULE, width: 0.75 }
      });
    }
    ry += 0.48;
  });

  s.addText('Every wine is checked against all nine at the same time; it keeps the highest score it earns.', {
    x: RX, y: 6.24, w: RW, h: 0.24, fontSize: 9, color: MUTED, italic: true
  });

  // ── Bottom: why it is quick ──────────────────────────────────────────────
  s.addShape(pptx.ShapeType.rect, { x: 0.55, y: 6.62, w: 12.23, h: 0.66, fill: { color: BURGUNDY } });

  const facts: [string, string][] = [
    ['50 057', 'wines searched'],
    ['5,5 ms', 'typical database time'],
    ['173 ms', 'keystroke to results on screen'],
    ['441 ms', 'vinmonopolet.no, same search']
  ];
  // Spacing chosen so the fourth caption ends inside the band (12.68 < 12.78);
  // at 3.02 apart it ran past the right edge.
  facts.forEach(([big, small], i) => {
    const fx = 0.8 + i * 2.98;
    s.addText(big, { x: fx, y: 6.72, w: 1.3, h: 0.34, fontSize: 17, bold: true, color: 'FFFFFF', fontFace: 'Georgia' });
    s.addText(small, { x: fx + 1.32, y: 6.79, w: 1.62, h: 0.3, fontSize: 9, color: 'E8D6DC' });
  });

  s.addText(
    'The messy source text — “37,5 cl”, “Kr 1 224,90”, accents — is tidied once when a wine is imported, not on every search. That is what makes it quick.',
    { x: 0.57, y: 7.26, w: 12.2, h: 0.2, fontSize: 8, color: FAINT, italic: true }
  );

  await pptx.writeFile({ fileName: OUT });
  console.log(`wrote ${OUT} (${TIERS.length} tiers verified against ${MIGRATION})`);
}

main();
