#!/usr/bin/env npx tsx
/**
 * Tune and measure style-relative descriptor weights (src/lib/styleWeights.ts).
 *
 * For each candidate floor (1.0 = the flag off, since no multiplier can then
 * drop below the global one), every frozen field is scored with the
 * production engine and compared with the human ratings, the LLM panel and
 * the constructed set. The floor that agrees best with the human ratings
 * without losing ground on the others is what STYLE_WEIGHT_FLOOR should be;
 * the property benchmark (benchmark-scoring.ts --style=on) is the other
 * half of the gate.
 *
 *   npx tsx --env-file=.env.local scripts/measure-style-weights.ts [--engine=openai] [--out=<file.md>]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { sanitizeText } from '../src/lib/lemmatizeAndWeight';
import { normalizeWineSynonyms } from '../src/lib/synonymNormalization';
import { applyNegation } from '../src/lib/negation';
import { combineScoreScaled, hasScoreableFlavour, lexicalCredit } from '../src/lib/flavourScoring';
import { getSoftEngineById, isSoftEngineId, type NoteInput, type SoftEngineId } from '../src/lib/softEngines';
import { bootstrapSpearmanCi, mean, spearman } from '../src/lib/stats';
import { loadRaterFiles } from './ratings-csv';
import type { FrozenSet } from './export-frozen-set';

const FROZEN = 'scripts/validation-results/frozen-set-2026-10.json';
const SIDECAR = 'scripts/validation-results/frozen-set-2026-10.categories.json';
const CONSTRUCTED = 'scripts/validation-results/constructed-set-2026-10.json';
const FLOORS = [1.0, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2];
const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ENGINE: SoftEngineId = isSoftEngineId(arg('engine')) ? (arg('engine') as SoftEngineId) : 'openai';
const OUT = arg('out') ?? `scripts/validation-results/style-weights-${new Date().toISOString().slice(0, 10)}.md`;

const input = (t: string): NoteInput => { const n = applyNegation(t); return { raw: n.text, norm: normalizeWineSynonyms(sanitizeText(n.text)) }; };

async function main() {
  const frozen = JSON.parse(readFileSync(FROZEN, 'utf8')) as FrozenSet;
  const categories = JSON.parse(readFileSync(SIDECAR, 'utf8')) as Record<string, string | null>;
  const constructed = JSON.parse(readFileSync(CONSTRUCTED, 'utf8')) as { items: Array<{ referenceKey: string; note: string; referenceNote: string; level: number }> };
  const raters = loadRaterFiles();
  const human = raters.get('kristian');
  const panel = [...raters.entries()].filter(([k]) => k.startsWith('llm')).map(([, m]) => m);
  const engine = getSoftEngineById(ENGINE);
  if (!(await engine.available()).ok) throw new Error(`${ENGINE} unavailable`);
  let commit = 'unknown';
  try { commit = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* ignore */ }

  // Soft term once per field (it does not depend on the weights).
  type Prepared = { user: NoteInput; reference: NoteInput; category: string | null; soft: number; human?: number; panel?: number; scoreable: boolean };
  const fields: Prepared[] = [];
  for (const f of frozen.fields) {
    const user = input(f.userNote), reference = input(f.referenceNote);
    const scoreable = hasScoreableFlavour(reference.norm);
    const soft = scoreable ? (await engine.score(user, reference)).softScore : 0;
    const p = panel.map(m => m.get(f.key)).filter((v): v is number => v !== undefined);
    fields.push({ user, reference, category: categories[f.wine.id] ?? null, soft, human: human?.get(f.key), panel: p.length ? mean(p) : undefined, scoreable });
  }
  const constructedPrepared = [] as Array<{ user: NoteInput; reference: NoteInput; category: string | null; soft: number; level: number; group: string }>;
  for (const item of constructed.items) {
    const user = input(item.note), reference = input(item.referenceNote);
    constructedPrepared.push({ user, reference, category: categories[item.referenceKey.split(':')[0]] ?? null, soft: (await engine.score(user, reference)).softScore, level: item.level, group: item.referenceKey });
  }

  const lines: string[] = [`# Style-weight floor sweep — ${new Date().toISOString().slice(0, 10)}`, '', `Engine ${ENGINE}, commit \`${commit}\`. Floor 1.0 is the flag off. Human = ${human?.size ?? 0} ratings by one club member; panel = ${panel.length} model raters; constructed = ${constructed.items.length} notes with ratings known by construction.`, '', '| floor | ρ human (95%) | ρ panel | ρ constructed | pairwise | mean score | fields with a style table |', '| --- | --- | --- | --- | --- | --- | --- |'];
  const log = (s: string) => { lines.push(s); console.log(s); };
  for (const floor of FLOORS) {
    const opts = floor >= 1 ? { styleWeights: false } : { styleWeights: true, styleFloor: floor };
    const scoreOf = (p: { user: NoteInput; reference: NoteInput; category: string | null; soft: number }) =>
      combineScoreScaled(lexicalCredit(p.user.norm, p.reference.norm, { ...opts, category: p.category }), p.soft).score;
    const scored = fields.filter(f => f.scoreable).map(f => ({ f, s: scoreOf(f) }));
    const h = scored.filter(x => x.f.human !== undefined), pnl = scored.filter(x => x.f.panel !== undefined);
    const rhoH = spearman(h.map(x => x.s), h.map(x => x.f.human!)), [lo, hi] = bootstrapSpearmanCi(h.map(x => x.s), h.map(x => x.f.human!));
    const rhoP = spearman(pnl.map(x => x.s), pnl.map(x => x.f.panel!));
    const cs = constructedPrepared.map(c => ({ c, s: scoreOf(c) }));
    const rhoC = spearman(cs.map(x => x.s), cs.map(x => x.c.level));
    let ok = 0, tot = 0;
    const groups = new Map<string, typeof cs>();
    for (const x of cs) (groups.get(x.c.group) ?? groups.set(x.c.group, []).get(x.c.group)!).push(x);
    for (const g of groups.values()) for (const a of g) for (const b of g) if (a.c.level > b.c.level) { tot++; if (a.s > b.s) ok++; }
    const withTable = fields.filter(f => f.scoreable && f.category).length;
    log(`| ${floor.toFixed(1)} | ${rhoH.toFixed(3)} (${lo.toFixed(2)}–${hi.toFixed(2)}) | ${rhoP.toFixed(3)} | ${rhoC.toFixed(3)} | ${tot ? ((100 * ok) / tot).toFixed(1) : '—'}% | ${mean(scored.map(x => x.s)).toFixed(1)} | ${withTable}/${scored.length} |`);
  }
  writeFileSync(OUT, lines.join('\n') + '\n');
  console.log(`\nwritten ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
