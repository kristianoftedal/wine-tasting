#!/usr/bin/env npx tsx
/**
 * How well does the score agree with human judgement?
 *
 * Reads the frozen set and every rater file under
 * scripts/validation-results/ratings/rater-*.csv (the filled-in rating sheet,
 * one per rater, semicolon-separated, columns `key` and `rating` required) and
 * reports:
 *
 *   - inter-rater agreement: Spearman and quadratic-weighted kappa per pair
 *   - Spearman against the mean rating, with a bootstrap 95% interval, for
 *     four scorers: the stored score, the current engine recomputed now, the
 *     lexical half alone (soft term held at 0), and a plain direct-hit count
 *   - the scorers' correlations with each other, which needs no ratings
 *
 * The lexical-only and direct-hit rows are controls: if the full engine does
 * not beat them, the soft term is not earning its weight. Nothing is written
 * to the database.
 *
 *   npx tsx --env-file=.env.local scripts/evaluate-human-agreement.ts [--frozen=<file>] [--out=<file.md>]
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';
import { scoreFlavourNote } from '../src/actions/similarity';
import { combineScore, lexicalCredit } from '../src/lib/flavourScoring';
import { sanitizeText } from '../src/lib/lemmatizeAndWeight';
import { normalizeWineSynonyms } from '../src/lib/synonymNormalization';
import { applyNegation } from '../src/lib/negation';
import type { FrozenSet } from './export-frozen-set';

const RATINGS_DIR = 'scripts/validation-results/ratings';
const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const FROZEN = arg('frozen') ?? latestFrozen();
const OUT = arg('out');

function latestFrozen(): string {
  const files = readdirSync('scripts/validation-results').filter(f => /^frozen-set-.*\.json$/.test(f)).sort();
  if (!files.length) throw new Error('no frozen set; run scripts/export-frozen-set.ts first');
  return join('scripts/validation-results', files[files.length - 1]);
}

// ── statistics ──────────────────────────────────────────────────────────────
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
function ranks(a: number[]): number[] {
  const idx = a.map((v, i) => [v, i] as const).sort((x, y) => x[0] - y[0]);
  const r = new Array<number>(a.length);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}
function pearson(x: number[], y: number[]): number {
  const mx = mean(x), my = mean(y);
  let n = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < x.length; i++) { const dx = x[i] - mx, dy = y[i] - my; n += dx * dy; dx2 += dx * dx; dy2 += dy * dy; }
  return dx2 && dy2 ? n / Math.sqrt(dx2 * dy2) : 0;
}
const spearman = (x: number[], y: number[]) => pearson(ranks(x), ranks(y));
/** Quadratic-weighted Cohen's kappa for two raters on an integer scale 0..k. */
function weightedKappa(a: number[], b: number[], k = 4): number {
  const n = a.length; if (!n) return 0;
  const obs = Array.from({ length: k + 1 }, () => new Array<number>(k + 1).fill(0));
  const ha = new Array<number>(k + 1).fill(0), hb = new Array<number>(k + 1).fill(0);
  for (let i = 0; i < n; i++) { obs[a[i]][b[i]]++; ha[a[i]]++; hb[b[i]]++; }
  let num = 0, den = 0;
  for (let i = 0; i <= k; i++) for (let j = 0; j <= k; j++) {
    const w = ((i - j) ** 2) / (k ** 2);
    num += w * obs[i][j];
    den += w * (ha[i] * hb[j]) / n;
  }
  return den ? 1 - num / den : 1;
}
function bootstrapCi(x: number[], y: number[], reps = 1000): [number, number] {
  let seed = 20261028;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const vals: number[] = [];
  for (let r = 0; r < reps; r++) {
    const bx: number[] = [], by: number[] = [];
    for (let i = 0; i < x.length; i++) { const j = Math.floor(rnd() * x.length); bx.push(x[j]); by.push(y[j]); }
    vals.push(spearman(bx, by));
  }
  vals.sort((p, q) => p - q);
  return [vals[Math.floor(0.025 * reps)], vals[Math.floor(0.975 * reps)]];
}

// ── ratings ─────────────────────────────────────────────────────────────────
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ';') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows;
  return body.filter(r => r.some(Boolean)).map(r => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ''])));
}
function loadRatings(): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>(); // rater -> key -> rating
  if (!existsSync(RATINGS_DIR)) return out;
  for (const f of readdirSync(RATINGS_DIR).filter(f => /^rater-.*\.csv$/i.test(f))) {
    const m = new Map<string, number>();
    for (const r of parseCsv(readFileSync(join(RATINGS_DIR, f), 'utf8'))) {
      const v = Number(r.rating?.replace(',', '.'));
      if (r.key && r.rating !== '' && Number.isInteger(v) && v >= 0 && v <= 4) m.set(r.key, v);
    }
    if (m.size) out.set(f.replace(/^rater-|\.csv$/gi, ''), m);
  }
  return out;
}

// ── scorers ─────────────────────────────────────────────────────────────────
const prep = (t: string) => normalizeWineSynonyms(sanitizeText(applyNegation(t).text));

async function main() {
  const frozen = JSON.parse(readFileSync(FROZEN, 'utf8')) as FrozenSet;
  const fields = frozen.fields.filter(f => f.storedScore !== null);
  const lines: string[] = [];
  const log = (s = '') => { lines.push(s); console.log(s); };
  let commit = 'unknown';
  try { commit = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* ignore */ }

  log(`# Human agreement — ${new Date().toISOString().slice(0, 10)}`);
  log();
  log(`Frozen set \`${FROZEN}\` (${frozen.meta.fields} fields, ${frozen.meta.tasters} tasters); ${fields.length} fields with a stored score; commit \`${commit}\`.`);
  log();

  process.stderr.write('scoring with the current engine…\n');
  const stored: number[] = [], current: number[] = [], lexicalOnly: number[] = [], directHits: number[] = [], previous: (number | null)[] = [];
  const unscoreable: string[] = [];
  for (const f of fields) {
    const b = await scoreFlavourNote(f.userNote, f.referenceNote);
    if (!b.scoreable) unscoreable.push(f.key);
    stored.push(f.storedScore!);
    current.push(b.score);
    lexicalOnly.push(combineScore(lexicalCredit(prep(f.userNote), prep(f.referenceNote)), 0).score);
    directHits.push(b.matches.filter(m => m.kind === 'direct').length);
    previous.push(f.previousScore);
  }

  const drift = current.map((c, i) => c - stored[i]);
  const moved = drift.filter(d => d !== 0).length;
  log('## Stored score vs recomputed now');
  log();
  log(`| | value |`);
  log(`| --- | --- |`);
  log(`| fields where the recompute differs from the stored score | ${moved} of ${fields.length} |`);
  log(`| mean absolute difference | ${mean(drift.map(Math.abs)).toFixed(2)} |`);
  log(`| Spearman(stored, recomputed) | ${spearman(stored, current).toFixed(3)} |`);
  log(`| reference notes now unscoreable (names no aroma) | ${unscoreable.length} |`);
  log();
  log('A non-zero difference is expected: scores were stored with the flavour chips included in the text, and only the free text is on the row. The database is not changed.');
  log();

  const scorers: Array<[string, number[]]> = [
    ['stored score', stored],
    ['current engine (recomputed)', current],
    ['lexical half only (soft = 0)', lexicalOnly],
    ['direct-hit count', directHits],
  ];
  const withPrev = previous.every(p => p !== null);
  if (withPrev) scorers.push(['previous engine (Aug 2026 snapshot)', previous as number[]]);
  else {
    const idx = previous.map((p, i) => (p !== null ? i : -1)).filter(i => i >= 0);
    if (idx.length > 20) log(`Previous-engine scores exist for ${idx.length} fields; Spearman(previous, current) on those = ${spearman(idx.map(i => previous[i]!), idx.map(i => current[i])).toFixed(3)}.`);
    log();
  }

  log('## Scorers against each other (Spearman)');
  log();
  log(`| | ${scorers.map(s => s[0]).join(' | ')} |`);
  log(`| --- | ${scorers.map(() => '---').join(' | ')} |`);
  for (const [name, a] of scorers) log(`| ${name} | ${scorers.map(([, b]) => spearman(a, b).toFixed(3)).join(' | ')} |`);
  log();

  const ratings = loadRatings();
  if (ratings.size === 0) {
    log('## Human ratings');
    log();
    log(`No rater files found in \`${RATINGS_DIR}/rater-*.csv\`. Fill in the rating sheet (one copy per rater, named \`rater-<name>.csv\`) and re-run.`);
  } else {
    const raters = [...ratings.keys()];
    log(`## Inter-rater agreement (${raters.length} raters: ${raters.join(', ')})`);
    log();
    log('| rater A | rater B | fields both rated | Spearman | weighted kappa |');
    log('| --- | --- | --- | --- | --- |');
    for (let i = 0; i < raters.length; i++) for (let j = i + 1; j < raters.length; j++) {
      const a = ratings.get(raters[i])!, b = ratings.get(raters[j])!;
      const keys = [...a.keys()].filter(k => b.has(k));
      const x = keys.map(k => a.get(k)!), y = keys.map(k => b.get(k)!);
      log(`| ${raters[i]} | ${raters[j]} | ${keys.length} | ${spearman(x, y).toFixed(3)} | ${weightedKappa(x, y).toFixed(3)} |`);
    }
    log();

    const meanRating = new Map<string, number>();
    for (const f of fields) {
      const vs = raters.map(r => ratings.get(r)!.get(f.key)).filter((v): v is number => v !== undefined);
      if (vs.length) meanRating.set(f.key, mean(vs));
    }
    const idx = fields.map((f, i) => (meanRating.has(f.key) ? i : -1)).filter(i => i >= 0);
    const human = idx.map(i => meanRating.get(fields[i].key)!);
    log(`## Score vs mean human rating (${idx.length} rated fields)`);
    log();
    log('| scorer | Spearman | bootstrap 95% |');
    log('| --- | --- | --- |');
    for (const [name, a] of scorers) {
      const x = idx.map(i => a[i]);
      const [lo, hi] = bootstrapCi(x, human);
      log(`| ${name} | ${spearman(x, human).toFixed(3)} | ${lo.toFixed(3)} – ${hi.toFixed(3)} |`);
    }
    log();
    log('The current engine must beat the lexical-only and direct-hit rows by more than the interval width for the soft term to be earning its weight. A new engine must beat the current one the same way.');
  }

  if (OUT) {
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, lines.join('\n') + '\n');
    console.log(`\nwritten ${OUT}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
