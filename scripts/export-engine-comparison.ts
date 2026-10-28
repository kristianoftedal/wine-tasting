#!/usr/bin/env npx tsx
/**
 * Static old-versus-new comparison for /scoring-demo.
 *
 * Scores every field of the frozen set with every engine asked for and writes
 * src/app/scoring-demo/engine-comparison.generated.json, which the demo page
 * imports and renders. The database is only read; stored scores are copied,
 * never recomputed into the row. Regenerate with this script, never on
 * request: an engine comparison over the corpus is a reviewable artefact,
 * not a live computation.
 *
 * Human ratings are folded in when rater files exist under
 * scripts/validation-results/ratings/rater-*.csv.
 *
 *   npx tsx --env-file=.env.local scripts/export-engine-comparison.ts
 *     [--engines=openai,bert,colbert-word,colbert-token]   default: openai
 *     [--frozen=<file>]   default: the newest frozen set
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sanitizeText } from '../src/lib/lemmatizeAndWeight';
import { normalizeWineSynonyms } from '../src/lib/synonymNormalization';
import { applyNegation } from '../src/lib/negation';
import { combineScoreScaled, hasScoreableFlavour, lexicalCredit } from '../src/lib/flavourScoring';
import { getSoftEngineById, isSoftEngineId, type SoftEngineId, type TokenAlignment } from '../src/lib/softEngines';
import { mean, sd, spearman } from '../src/lib/stats';
import type { FrozenSet } from './export-frozen-set';

const OUT = 'src/app/scoring-demo/engine-comparison.generated.json';
const RATINGS_DIR = 'scripts/validation-results/ratings';
const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ENGINE_IDS: SoftEngineId[] = (arg('engines') ?? 'openai').split(',').map(s => s.trim()).filter(isSoftEngineId);

export type { ComparisonField, EngineComparison, EngineFieldScore, EngineSummary } from '../src/lib/softEngines/comparison';
import type { ComparisonField, EngineComparison, EngineSummary } from '../src/lib/softEngines/comparison';

function latestFrozen(): string {
  const files = readdirSync('scripts/validation-results').filter(f => /^frozen-set-.*\.json$/.test(f)).sort();
  if (!files.length) throw new Error('no frozen set; run scripts/export-frozen-set.ts first');
  return join('scripts/validation-results', files[files.length - 1]);
}

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

function meanRatings(): { raters: number; byKey: Map<string, number> } {
  const perRater: Map<string, number>[] = [];
  if (existsSync(RATINGS_DIR)) {
    for (const f of readdirSync(RATINGS_DIR).filter(f => /^rater-.*\.csv$/i.test(f))) {
      const m = new Map<string, number>();
      for (const r of parseCsv(readFileSync(join(RATINGS_DIR, f), 'utf8'))) {
        const v = Number(r.rating?.replace(',', '.'));
        if (r.key && r.rating !== '' && Number.isInteger(v) && v >= 0 && v <= 4) m.set(r.key, v);
      }
      if (m.size) perRater.push(m);
    }
  }
  const byKey = new Map<string, number>();
  const keys = new Set(perRater.flatMap(m => [...m.keys()]));
  for (const k of keys) {
    const vs = perRater.map(m => m.get(k)).filter((v): v is number => v !== undefined);
    if (vs.length) byKey.set(k, mean(vs));
  }
  return { raters: perRater.length, byKey };
}

async function main() {
  const frozenPath = arg('frozen') ?? latestFrozen();
  const frozen = JSON.parse(readFileSync(frozenPath, 'utf8')) as FrozenSet;
  const ratings = meanRatings();
  let commit = 'unknown';
  try { commit = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* ignore */ }

  const engines = [] as Array<{ id: SoftEngineId; engine: ReturnType<typeof getSoftEngineById> }>;
  for (const id of ENGINE_IDS) {
    const engine = getSoftEngineById(id);
    const a = await engine.available();
    if (a.ok) engines.push({ id, engine });
    else console.error(`engine ${id} unavailable: ${a.reason}`);
  }

  const fields: ComparisonField[] = [];
  let n = 0;
  for (const f of frozen.fields) {
    const user = applyNegation(f.userNote), reference = applyNegation(f.referenceNote);
    const userNorm = normalizeWineSynonyms(sanitizeText(user.text));
    const refNorm = normalizeWineSynonyms(sanitizeText(reference.text));
    const scoreable = hasScoreableFlavour(refNorm);
    const lexical = lexicalCredit(userNorm, refNorm);
    const scores: ComparisonField['scores'] = {};
    for (const { id, engine } of engines) {
      const r = await engine.score({ raw: user.text, norm: userNorm }, { raw: reference.text, norm: refNorm });
      scores[id] = {
        score: scoreable ? combineScoreScaled(lexical, r.softScore, true).score : 0,
        softScore: Math.round(r.softScore * 10) / 10,
        raw: Math.round(r.raw * 1000) / 1000,
        alignments: r.alignments.map(a => ({ ...a, sim: Math.round(a.sim * 1000) / 1000, weight: Math.round(a.weight * 100) / 100 })),
      };
    }
    fields.push({
      key: f.key, taster: f.taster, event: f.event?.name ?? null,
      wine: `${f.wine.name}${f.wine.year ? ` ${f.wine.year}` : ''}`, field: f.field,
      userNote: f.userNote, referenceNote: f.referenceNote,
      storedScore: f.storedScore, previousScore: f.previousScore,
      humanRating: ratings.byKey.get(f.key) ?? null, scoreable, scores,
    });
    if (++n % 25 === 0) process.stderr.write(`  ${n}/${frozen.fields.length}\r`);
  }

  const summaries: EngineSummary[] = engines.map(({ id, engine }) => {
    const rows = fields.filter(f => f.scoreable && f.storedScore !== null && f.scores[id]);
    const x = rows.map(f => f.scores[id]!.score);
    const prevRows = rows.filter(f => f.previousScore !== null);
    const humanRows = rows.filter(f => f.humanRating !== null);
    return {
      id, model: engine.model, fields: rows.length, mean: mean(x), sd: sd(x),
      spearmanVsStored: spearman(x, rows.map(f => f.storedScore!)),
      spearmanVsPrevious: prevRows.length > 20 ? spearman(prevRows.map(f => f.scores[id]!.score), prevRows.map(f => f.previousScore!)) : null,
      spearmanVsHuman: humanRows.length > 20 ? spearman(humanRows.map(f => f.scores[id]!.score), humanRows.map(f => f.humanRating!)) : null,
    };
  });

  const out: EngineComparison = {
    meta: { generatedAt: new Date().toISOString(), commit, frozenSet: frozenPath, raters: ratings.raters, engines: summaries },
    fields,
  };
  writeFileSync(OUT, JSON.stringify(out) + '\n');
  console.log(`written ${OUT}: ${fields.length} fields × ${engines.length} engine(s)`);
  for (const s of summaries) console.log(`  ${s.id.padEnd(14)} mean ${s.mean.toFixed(1)}  sd ${s.sd.toFixed(1)}  ρ(stored) ${s.spearmanVsStored.toFixed(3)}  ρ(previous) ${s.spearmanVsPrevious?.toFixed(3) ?? '—'}  ρ(human) ${s.spearmanVsHuman?.toFixed(3) ?? '—'}`);
}

main().catch(e => { console.error(e); process.exit(1); });
