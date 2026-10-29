#!/usr/bin/env npx tsx
/**
 * Measure the ladder's `specific` tier against the human ratings, the LLM
 * panel and the constructed set: its credit value, and which category words
 * license it (HYPERNYMS in src/lib/derivations.ts).
 *
 * Background: 109 of the 750 ladder matches on the frozen set are `specific`.
 * The licensing words that dominate are `krydder` (13, mostly pepper; mean
 * human rating 2.4) and `frukt` (sitrus, eple; 1.5–2.4), while `bær → solbær /
 * kirsebær` sits near 3. The six re-rating holdouts were all `pepper` against
 * `krydder` at 0.85 credit.
 *
 *   npx tsx --env-file=.env.local scripts/measure-specific-tier.ts [--engines=openai,colbert-token]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { sanitizeText } from '../src/lib/lemmatizeAndWeight';
import { normalizeWineSynonyms } from '../src/lib/synonymNormalization';
import { applyNegation } from '../src/lib/negation';
import { combineScoreScaled, hasScoreableFlavour, lexicalCredit, type ScoringOptions } from '../src/lib/flavourScoring';
import { getSoftEngineById, isSoftEngineId, type NoteInput, type SoftEngineId } from '../src/lib/softEngines';
import { bootstrapSpearmanCi, mean, spearman } from '../src/lib/stats';
import { loadRaterFiles } from './ratings-csv';
import type { FrozenSet } from './export-frozen-set';

const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ENGINE_IDS: SoftEngineId[] = (arg('engines') ?? 'openai,colbert-token').split(',').map(s => s.trim()).filter(isSoftEngineId);
const OUT = `scripts/validation-results/specific-tier-${new Date().toISOString().slice(0, 10)}.md`;
const input = (t: string): NoteInput => { const n = applyNegation(t); return { raw: n.text, norm: normalizeWineSynonyms(sanitizeText(n.text)) }; };

const VARIANTS: Array<{ name: string; opts: ScoringOptions }> = [
  { name: 'current (0.85, all hypernyms)', opts: {} },
  { name: 'credit 0.6 (= subcategory)', opts: { specificCredit: 0.6 } },
  { name: 'credit 0.3 (= category)', opts: { specificCredit: 0.3 } },
  { name: 'credit 1.0 (= direct)', opts: { specificCredit: 1.0 } },
  { name: 'no krydder', opts: { hypernymExclude: ['krydder'] } },
  { name: 'no frukt', opts: { hypernymExclude: ['frukt'] } },
  { name: 'no krydder, frukt', opts: { hypernymExclude: ['krydder', 'frukt'] } },
  { name: 'no krydder, frukt, mineral', opts: { hypernymExclude: ['krydder', 'frukt', 'mineral'] } },
  { name: 'only bær, sitrus, steinfrukt', opts: { hypernymExclude: ['frukt', 'kjernefrukt', 'krydder', 'urt', 'blomst', 'nøtt', 'treverk', 'mineral'] } },
  { name: 'no specific tier at all', opts: { hypernymExclude: ['frukt', 'bær', 'sitrus', 'steinfrukt', 'kjernefrukt', 'krydder', 'urt', 'blomst', 'nøtt', 'treverk', 'mineral'] } },
];

async function main() {
  const frozen = JSON.parse(readFileSync('scripts/validation-results/frozen-set-2026-10.json', 'utf8')) as FrozenSet;
  const constructed = JSON.parse(readFileSync('scripts/validation-results/constructed-set-2026-10.json', 'utf8')) as { items: Array<{ referenceKey: string; note: string; referenceNote: string; level: number }> };
  const raters = loadRaterFiles();
  const human = raters.get('kristian');
  const panel = [...raters.entries()].filter(([k]) => k.startsWith('llm')).map(([, m]) => m);
  let commit = 'unknown';
  try { commit = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* ignore */ }

  const lines = [`# Specific tier — ${new Date().toISOString().slice(0, 10)}`, '', `Commit \`${commit}\`. Human = ${human?.size ?? 0} ratings; panel = ${panel.length} models; constructed = ${constructed.items.length} notes.`, ''];
  const log = (s: string) => { lines.push(s); console.log(s); };

  for (const id of ENGINE_IDS) {
    const engine = getSoftEngineById(id);
    if (!(await engine.available()).ok) { log(`${id}: unavailable`); continue; }
    type P = { u: string; r: string; soft: number; human?: number; panel?: number; level?: number; group?: string };
    const fields: P[] = [], cons: P[] = [];
    for (const f of frozen.fields) {
      const u = input(f.userNote), r = input(f.referenceNote);
      if (!hasScoreableFlavour(r.norm)) continue;
      const p = panel.map(m => m.get(f.key)).filter((v): v is number => v !== undefined);
      fields.push({ u: u.norm, r: r.norm, soft: (await engine.score(u, r)).softScore, human: human?.get(f.key), panel: p.length ? mean(p) : undefined });
    }
    for (const item of constructed.items) {
      const u = input(item.note), r = input(item.referenceNote);
      cons.push({ u: u.norm, r: r.norm, soft: (await engine.score(u, r)).softScore, level: item.level, group: item.referenceKey });
    }
    log(`## ${id}`);
    log('');
    log('| variant | ρ human (95%) | ρ panel | ρ constructed | pairwise | mean score | specific matches |');
    log('| --- | --- | --- | --- | --- | --- | --- |');
    for (const v of VARIANTS) {
      const scoreOf = (p: P) => combineScoreScaled(lexicalCredit(p.u, p.r, v.opts), p.soft).score;
      const h = fields.filter(x => x.human !== undefined), pn = fields.filter(x => x.panel !== undefined);
      const rhoH = spearman(h.map(scoreOf), h.map(x => x.human!)), [lo, hi] = bootstrapSpearmanCi(h.map(scoreOf), h.map(x => x.human!));
      const rhoP = spearman(pn.map(scoreOf), pn.map(x => x.panel!));
      const rhoC = spearman(cons.map(scoreOf), cons.map(x => x.level!));
      let ok = 0, tot = 0;
      const groups = new Map<string, P[]>();
      for (const c of cons) (groups.get(c.group!) ?? groups.set(c.group!, []).get(c.group!)!).push(c);
      for (const g of groups.values()) for (const a of g) for (const b of g) if (a.level! > b.level!) { tot++; if (scoreOf(a) > scoreOf(b)) ok++; }
      const specifics = fields.reduce((n, p) => n + lexicalCredit(p.u, p.r, v.opts).matches.filter(m => m.kind === 'specific').length, 0);
      log(`| ${v.name} | ${rhoH.toFixed(3)} (${lo.toFixed(2)}–${hi.toFixed(2)}) | ${rhoP.toFixed(3)} | ${rhoC.toFixed(3)} | ${tot ? ((100 * ok) / tot).toFixed(1) : '—'}% | ${mean(fields.map(scoreOf)).toFixed(1)} | ${specifics} |`);
    }
    log('');
  }
  writeFileSync(OUT, lines.join('\n') + '\n');
  console.log(`written ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
