#!/usr/bin/env npx tsx
/**
 * Tune the combine constants against the human ratings, with cross-validation.
 *
 * HIT_WEIGHT / SOFT_WEIGHT (0.55 / 0.45), SATURATION_TAU (3.0) and
 * PRECISION_FLOOR (0.6) were set by reasoning (scoringConfig.ts), never
 * against a human target. This sweeps a grid, scores every rated frozen
 * field with the production engine, and reports:
 *
 *   - the current constants' Spearman against the ratings
 *   - 5-fold cross-validation: the best grid point on four folds, evaluated on
 *     the fifth, averaged — the honest estimate of what tuning buys
 *   - the best point on all data, for information, with the panel and the
 *     constructed set beside it so a gain on one target that costs another
 *     is visible
 *
 * The property benchmark is the other half of any gate:
 *   benchmark-scoring.ts --hit-weight=… --tau=… --floor=…
 *
 *   npx tsx --env-file=.env.local scripts/tune-combine-constants.ts [--engine=openai]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { sanitizeText } from '../src/lib/lemmatizeAndWeight';
import { normalizeWineSynonyms } from '../src/lib/synonymNormalization';
import { applyNegation } from '../src/lib/negation';
import { combineScoreScaled, hasScoreableFlavour, lexicalCredit, type ScoringOptions } from '../src/lib/flavourScoring';
import { HIT_WEIGHT, PRECISION_FLOOR, SATURATION_TAU } from '../src/lib/scoringConfig';
import { getSoftEngineById, isSoftEngineId, type NoteInput, type SoftEngineId } from '../src/lib/softEngines';
import { bootstrapSpearmanCi, mean, seededRandom, spearman } from '../src/lib/stats';
import { loadRaterFiles } from './ratings-csv';
import type { FrozenSet } from './export-frozen-set';

const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ENGINE: SoftEngineId = isSoftEngineId(arg('engine')) ? (arg('engine') as SoftEngineId) : 'openai';
const OUT = `scripts/validation-results/combine-constants-${new Date().toISOString().slice(0, 10)}.md`;
const GRID = {
  hitWeight: [0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.8, 0.9],
  tau: [1.5, 2, 2.5, 3, 3.5, 4, 5, 6],
  floor: [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
};
const input = (t: string): NoteInput => { const n = applyNegation(t); return { raw: n.text, norm: normalizeWineSynonyms(sanitizeText(n.text)) }; };

type P = { u: string; r: string; soft: number; human?: number; panel?: number; level?: number; group?: string };
type Point = { hitWeight: number; tau: number; floor: number };

function scoreOf(p: P, pt: Point): number {
  const opts: ScoringOptions = { tau: pt.tau, hitWeight: pt.hitWeight, precisionFloor: pt.floor };
  return combineScoreScaled(lexicalCredit(p.u, p.r, opts), p.soft, true, opts).score;
}
const rho = (ps: P[], pt: Point, target: (p: P) => number) => spearman(ps.map(p => scoreOf(p, pt)), ps.map(target));

async function main() {
  const frozen = JSON.parse(readFileSync('scripts/validation-results/frozen-set-2026-10.json', 'utf8')) as FrozenSet;
  const constructed = JSON.parse(readFileSync('scripts/validation-results/constructed-set-2026-10.json', 'utf8')) as { items: Array<{ referenceKey: string; note: string; referenceNote: string; level: number }> };
  const raters = loadRaterFiles();
  const human = raters.get('kristian')!;
  const panel = [...raters.entries()].filter(([k]) => k.startsWith('llm')).map(([, m]) => m);
  const engine = getSoftEngineById(ENGINE);
  if (!(await engine.available()).ok) throw new Error(`${ENGINE} unavailable`);
  let commit = 'unknown';
  try { commit = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* ignore */ }

  const fields: P[] = [], cons: P[] = [];
  for (const f of frozen.fields) {
    const u = input(f.userNote), r = input(f.referenceNote);
    if (!hasScoreableFlavour(r.norm)) continue;
    const p = panel.map(m => m.get(f.key)).filter((v): v is number => v !== undefined);
    fields.push({ u: u.norm, r: r.norm, soft: (await engine.score(u, r)).softScore, human: human.get(f.key), panel: p.length ? mean(p) : undefined });
  }
  for (const item of constructed.items) {
    const u = input(item.note), r = input(item.referenceNote);
    cons.push({ u: u.norm, r: r.norm, soft: (await engine.score(u, r)).softScore, level: item.level, group: item.referenceKey });
  }
  const rated = fields.filter(p => p.human !== undefined);
  const withPanel = fields.filter(p => p.panel !== undefined);
  const points: Point[] = [];
  for (const hitWeight of GRID.hitWeight) for (const tau of GRID.tau) for (const floor of GRID.floor) points.push({ hitWeight, tau, floor });
  const current: Point = { hitWeight: HIT_WEIGHT, tau: SATURATION_TAU, floor: PRECISION_FLOOR };
  const fmt = (pt: Point) => `hit ${pt.hitWeight.toFixed(2)} / soft ${(1 - pt.hitWeight).toFixed(2)}, τ ${pt.tau}, floor ${pt.floor}`;

  const lines = [`# Combine constants — ${new Date().toISOString().slice(0, 10)}`, '', `Engine ${ENGINE}, commit \`${commit}\`, ${rated.length} rated fields, ${points.length} grid points.`, ''];
  const log = (s = '') => { lines.push(s); console.log(s); };

  // Current
  const [lo, hi] = bootstrapSpearmanCi(rated.map(p => scoreOf(p, current)), rated.map(p => p.human!));
  log(`Current constants (${fmt(current)}): ρ human ${rho(rated, current, p => p.human!).toFixed(3)} (${lo.toFixed(2)}–${hi.toFixed(2)}), ρ panel ${rho(withPanel, current, p => p.panel!).toFixed(3)}, ρ constructed ${rho(cons, current, p => p.level!).toFixed(3)}.`);
  log();

  // 5-fold CV, seeded
  const rnd = seededRandom(20261029);
  const order = rated.map((_, i) => i).sort(() => rnd() - 0.5);
  const folds = Array.from({ length: 5 }, (_, k) => order.filter((_, i) => i % 5 === k));
  const heldOut: number[] = [], heldOutCurrent: number[] = [], chosen: Point[] = [];
  for (const fold of folds) {
    const test = fold.map(i => rated[i]), train = rated.filter((_, i) => !fold.includes(i));
    let best = current, bestRho = -Infinity;
    for (const pt of points) { const r = rho(train, pt, p => p.human!); if (r > bestRho) { bestRho = r; best = pt; } }
    chosen.push(best);
    heldOut.push(rho(test, best, p => p.human!));
    heldOutCurrent.push(rho(test, current, p => p.human!));
  }
  log('## 5-fold cross-validation (tune on four folds, score the fifth)');
  log();
  log('| fold | chosen on the other four | held-out ρ tuned | held-out ρ current |');
  log('| --- | --- | --- | --- |');
  folds.forEach((_, k) => log(`| ${k + 1} | ${fmt(chosen[k])} | ${heldOut[k].toFixed(3)} | ${heldOutCurrent[k].toFixed(3)} |`));
  log(`| mean | | **${mean(heldOut).toFixed(3)}** | **${mean(heldOutCurrent).toFixed(3)}** |`);
  log();

  // Best on all data, with the other targets
  const ranked = points.map(pt => ({ pt, h: rho(rated, pt, p => p.human!) })).sort((a, b) => b.h - a.h);
  log('## Best points on all rated data (for information; in-sample)');
  log();
  log('| constants | ρ human | ρ panel | ρ constructed | mean score |');
  log('| --- | --- | --- | --- | --- |');
  for (const { pt, h } of ranked.slice(0, 8)) log(`| ${fmt(pt)} | ${h.toFixed(3)} | ${rho(withPanel, pt, p => p.panel!).toFixed(3)} | ${rho(cons, pt, p => p.level!).toFixed(3)} | ${mean(fields.map(p => scoreOf(p, pt))).toFixed(1)} |`);
  log();
  // One-dimensional views around the current point
  log('## One constant at a time, the others at their current values');
  log();
  for (const [name, values] of Object.entries(GRID) as Array<[keyof Point, number[]]>) {
    log(`| ${name} | ${values.map(v => v).join(' | ')} |`);
    log(`| --- | ${values.map(() => '---').join(' | ')} |`);
    log(`| ρ human | ${values.map(v => rho(rated, { ...current, [name]: v }, p => p.human!).toFixed(3)).join(' | ')} |`);
    log(`| ρ panel | ${values.map(v => rho(withPanel, { ...current, [name]: v }, p => p.panel!).toFixed(3)).join(' | ')} |`);
    log();
  }
  writeFileSync(OUT, lines.join('\n') + '\n');
  console.log(`written ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
