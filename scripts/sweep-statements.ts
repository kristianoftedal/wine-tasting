#!/usr/bin/env npx tsx
/**
 * The rater's statements as a sweep (31 Oct 2026).
 *
 *   1. "Adding a fourth correct word should matter the same as the second
 *      did."  → the reward for correct mass is linear up to a cap, not the
 *      saturating 100(1 − e^(−m/τ)): `linearMassForFull` = the hit mass at
 *      which the hit score reaches 100 (a specific descriptor carries ~2.0,
 *      so 8 means four of them).
 *   2. "You should be rewarded for picking the correct family even without
 *      the correct word (bær, fat, krydder)."  → higher subcategory and
 *      category credit, and `familyCredit`: naming the family word of a
 *      reference member is a family hit, not a category near-miss.
 *
 * Grid: shape × subcategory credit × category credit × family rule × soft
 * weight. Validity on every point (cheap: the soft term is cached per
 * field); the property benchmark on the shortlist is run separately with
 * benchmark-scoring.ts flags, since the gate is the other half.
 *
 *   npx tsx --env-file=.env.local scripts/sweep-statements.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { sanitizeText } from '../src/lib/lemmatizeAndWeight';
import { normalizeWineSynonyms } from '../src/lib/synonymNormalization';
import { applyNegation } from '../src/lib/negation';
import { combineScoreScaled, hasScoreableFlavour, lexicalCredit, type ScoringOptions } from '../src/lib/flavourScoring';
import { getSoftEngineById, type NoteInput } from '../src/lib/softEngines';
import { bootstrapSpearmanCi, mean, pearson, spearman } from '../src/lib/stats';
import { loadRaterFiles, loadTarget } from './ratings-csv';
import type { FrozenSet } from './export-frozen-set';

const OUT = `scripts/validation-results/statements-sweep-${new Date().toISOString().slice(0, 10)}.md`;
const input = (t: string): NoteInput => { const n = applyNegation(t); return { raw: n.text, norm: normalizeWineSynonyms(sanitizeText(n.text)) }; };

const SHAPES: Array<{ name: string; opts: ScoringOptions }> = [
  { name: 'saturating τ3 (current)', opts: {} },
  { name: 'saturating τ6', opts: { tau: 6 } },
  { name: 'linear, 100 at mass 6', opts: { linearMassForFull: 6 } },
  { name: 'linear, 100 at mass 8', opts: { linearMassForFull: 8 } },
  { name: 'linear, 100 at mass 10', opts: { linearMassForFull: 10 } },
];
const SUBS = [0.6, 0.75, 0.85];
const CATS = [0.3, 0.45, 0.6];
const FAMILY = [false, true];
const HITW = [0.55, 0.65];

async function main() {
  const frozen = JSON.parse(readFileSync('scripts/validation-results/frozen-set-2026-10.json', 'utf8')) as FrozenSet;
  const constructed = JSON.parse(readFileSync('scripts/validation-results/constructed-set-2026-10.json', 'utf8')) as { items: Array<{ referenceKey: string; note: string; referenceNote: string; level: number }> };
  const human = loadRaterFiles().get('kristian')!;
  const target = loadTarget().ratings;
  const engine = getSoftEngineById('openai');
  if (!(await engine.available()).ok) throw new Error('openai unavailable');
  let commit = 'unknown';
  try { commit = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* ignore */ }

  type P = { u: string; r: string; soft: number; human?: number; target?: number; level?: number; group?: string; words: number };
  const fields: P[] = [], cons: P[] = [];
  for (const f of frozen.fields) {
    const u = input(f.userNote), r = input(f.referenceNote);
    if (!hasScoreableFlavour(r.norm)) continue;
    fields.push({ u: u.norm, r: r.norm, soft: (await engine.score(u, r)).softScore, human: human.get(f.key), target: target.get(f.key), words: u.norm.split(' ').filter(Boolean).length });
  }
  for (const item of constructed.items) {
    const u = input(item.note), r = input(item.referenceNote);
    cons.push({ u: u.norm, r: r.norm, soft: (await engine.score(u, r)).softScore, level: item.level, group: item.referenceKey, words: 0 });
  }
  const rated = fields.filter(p => p.human !== undefined), targeted = fields.filter(p => p.target !== undefined);

  type Row = { name: string; opts: ScoringOptions; human: number; lo: number; hi: number; target: number; constructed: number; pairwise: number; rLen: number; meanScore: number };
  const rows: Row[] = [];
  for (const shape of SHAPES) for (const sub of SUBS) for (const cat of CATS) for (const family of FAMILY) for (const hitWeight of HITW) {
    const opts: ScoringOptions = { ...shape.opts, subcategoryCredit: sub, categoryCredit: cat, familyCredit: family, hitWeight };
    const scoreOf = (p: P) => combineScoreScaled(lexicalCredit(p.u, p.r, opts), p.soft, true, opts).score;
    const hs = rated.map(scoreOf), ts = targeted.map(scoreOf), cs = cons.map(scoreOf);
    const [lo, hi] = bootstrapSpearmanCi(hs, rated.map(p => p.human!), 300);
    let ok = 0, tot = 0;
    const groups = new Map<string, number[]>();
    cons.forEach((c, i) => (groups.get(c.group!) ?? groups.set(c.group!, []).get(c.group!)!).push(i));
    for (const g of groups.values()) for (const a of g) for (const b of g) if (cons[a].level! > cons[b].level!) { tot++; if (cs[a] > cs[b]) ok++; }
    rows.push({
      name: `${shape.name} · sub ${sub} · cat ${cat} · family ${family ? 'on' : 'off'} · hit ${hitWeight}`, opts,
      human: spearman(hs, rated.map(p => p.human!)), lo, hi,
      target: spearman(ts, targeted.map(p => p.target!)),
      constructed: spearman(cs, cons.map(c => c.level!)), pairwise: tot ? (100 * ok) / tot : 0,
      rLen: pearson(fields.map(scoreOf), fields.map(p => p.words)), meanScore: mean(fields.map(scoreOf)),
    });
  }
  const current = rows.find(r => r.name.startsWith('saturating τ3 (current) · sub 0.6 · cat 0.3 · family off · hit 0.55'))!;
  const fmt = (r: Row) => `| ${r.name} | ${r.human.toFixed(3)} (${r.lo.toFixed(2)}–${r.hi.toFixed(2)}) | ${r.target.toFixed(3)} | ${r.constructed.toFixed(3)} | ${r.pairwise.toFixed(1)}% | ${r.rLen.toFixed(2)} | ${r.meanScore.toFixed(1)} |`;
  const lines = [`# Statement sweep — ${new Date().toISOString().slice(0, 10)}`, '', `Commit \`${commit}\`, ${rows.length} grid points, OpenAI engine, ${rated.length} human-rated and ${targeted.length} target fields.`, '',
    '| constants | ρ human (95%) | ρ target | ρ constructed | pairwise | r(len) | mean |', '| --- | --- | --- | --- | --- | --- | --- |', fmt(current), ''];
  const log = (s: string) => { lines.push(s); console.log(s); };
  console.log(lines.slice(-3).join('\n'));
  log('## Top 12 by ρ target');
  log(''); log('| constants | ρ human (95%) | ρ target | ρ constructed | pairwise | r(len) | mean |'); log('| --- | --- | --- | --- | --- | --- | --- |');
  for (const r of [...rows].sort((a, b) => b.target - a.target).slice(0, 12)) log(fmt(r));
  log(''); log('## One statement at a time, the rest at current values'); log('');
  const pick = (f: (r: Row) => boolean) => rows.filter(f);
  log('| shape (sub 0.6, cat 0.3, family off, hit 0.55) | ρ human | ρ target | ρ constructed | r(len) |'); log('| --- | --- | --- | --- | --- |');
  for (const r of pick(r => r.name.includes('sub 0.6 · cat 0.3 · family off · hit 0.55'))) log(`| ${r.name.split(' · ')[0]} | ${r.human.toFixed(3)} | ${r.target.toFixed(3)} | ${r.constructed.toFixed(3)} | ${r.rLen.toFixed(2)} |`);
  log(''); log('| family credits (τ3, hit 0.55) | ρ human | ρ target | ρ constructed | r(len) |'); log('| --- | --- | --- | --- | --- |');
  for (const r of pick(r => r.name.startsWith('saturating τ3 (current)') && r.name.endsWith('hit 0.55'))) log(`| ${r.name.split(' · ').slice(1, 4).join(' · ')} | ${r.human.toFixed(3)} | ${r.target.toFixed(3)} | ${r.constructed.toFixed(3)} | ${r.rLen.toFixed(2)} |`);
  writeFileSync(OUT, lines.join('\n') + '\n');
  console.log(`\nwritten ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
