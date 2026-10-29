#!/usr/bin/env npx tsx
/**
 * Measure the hybrid soft term (src/lib/softEngines/hybrid.ts) for every
 * engine, off and on, against the human ratings, the LLM panel and the
 * constructed set. The property benchmark is the other half:
 * benchmark-scoring.ts --engines=… --hybrid=on.
 *
 *   npx tsx --env-file=.env.local scripts/measure-hybrid-soft.ts [--engines=openai,bert,colbert-word,colbert-token]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { sanitizeText } from '../src/lib/lemmatizeAndWeight';
import { normalizeWineSynonyms } from '../src/lib/synonymNormalization';
import { applyNegation } from '../src/lib/negation';
import { combineScoreScaled, hasScoreableFlavour, lexicalCredit } from '../src/lib/flavourScoring';
import { getSoftEngineById, isSoftEngineId, type NoteInput, type SoftEngineId, type SoftResult } from '../src/lib/softEngines';
import { hybridSoftScore } from '../src/lib/softEngines/hybrid';
import { bootstrapSpearmanCi, mean, spearman } from '../src/lib/stats';
import { loadRaterFiles } from './ratings-csv';
import type { FrozenSet } from './export-frozen-set';

const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ENGINE_IDS: SoftEngineId[] = (arg('engines') ?? 'openai,bert,colbert-word,colbert-token').split(',').map(s => s.trim()).filter(isSoftEngineId);
const OUT = `scripts/validation-results/hybrid-soft-${new Date().toISOString().slice(0, 10)}.md`;
const input = (t: string): NoteInput => { const n = applyNegation(t); return { raw: n.text, norm: normalizeWineSynonyms(sanitizeText(n.text)) }; };

async function main() {
  const frozen = JSON.parse(readFileSync('scripts/validation-results/frozen-set-2026-10.json', 'utf8')) as FrozenSet;
  const constructed = JSON.parse(readFileSync('scripts/validation-results/constructed-set-2026-10.json', 'utf8')) as { items: Array<{ referenceKey: string; note: string; referenceNote: string; level: number }> };
  const raters = loadRaterFiles();
  const human = raters.get('kristian');
  const panel = [...raters.entries()].filter(([k]) => k.startsWith('llm')).map(([, m]) => m);
  let commit = 'unknown';
  try { commit = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* ignore */ }

  const lines = [`# Hybrid soft term — ${new Date().toISOString().slice(0, 10)}`, '', `Commit \`${commit}\`. Human = ${human?.size ?? 0} ratings; panel = ${panel.length} models; constructed = ${constructed.items.length} notes.`, '', '| engine | hybrid | ρ human (95%) | ρ panel | ρ constructed | pairwise | mean score | mean soft |', '| --- | --- | --- | --- | --- | --- | --- | --- |'];
  const log = (s: string) => { lines.push(s); console.log(s); };

  for (const id of ENGINE_IDS) {
    const engine = getSoftEngineById(id);
    if (!(await engine.available()).ok) { log(`| ${id} | — | unavailable | | | | | |`); continue; }
    type P = { lexical: ReturnType<typeof lexicalCredit>; soft: SoftResult; human?: number; panel?: number; level?: number; group?: string };
    const fields: P[] = [], cons: P[] = [];
    for (const f of frozen.fields) {
      const u = input(f.userNote), r = input(f.referenceNote);
      if (!hasScoreableFlavour(r.norm)) continue;
      const p = panel.map(m => m.get(f.key)).filter((v): v is number => v !== undefined);
      fields.push({ lexical: lexicalCredit(u.norm, r.norm), soft: await engine.score(u, r), human: human?.get(f.key), panel: p.length ? mean(p) : undefined });
    }
    for (const item of constructed.items) {
      const u = input(item.note), r = input(item.referenceNote);
      cons.push({ lexical: lexicalCredit(u.norm, r.norm), soft: await engine.score(u, r), level: item.level, group: item.referenceKey });
    }
    for (const hybrid of [false, true]) {
      const softOf = (p: P) => (hybrid ? hybridSoftScore(p.soft, p.lexical) : p.soft.softScore);
      const scoreOf = (p: P) => combineScoreScaled(p.lexical, softOf(p)).score;
      const h = fields.filter(x => x.human !== undefined), pn = fields.filter(x => x.panel !== undefined);
      const rhoH = spearman(h.map(scoreOf), h.map(x => x.human!)), [lo, hi] = bootstrapSpearmanCi(h.map(scoreOf), h.map(x => x.human!));
      const rhoP = spearman(pn.map(scoreOf), pn.map(x => x.panel!));
      const rhoC = spearman(cons.map(scoreOf), cons.map(x => x.level!));
      let ok = 0, tot = 0;
      const groups = new Map<string, P[]>();
      for (const c of cons) (groups.get(c.group!) ?? groups.set(c.group!, []).get(c.group!)!).push(c);
      for (const g of groups.values()) for (const a of g) for (const b of g) if (a.level! > b.level!) { tot++; if (scoreOf(a) > scoreOf(b)) ok++; }
      log(`| ${id} | ${hybrid ? 'on' : 'off'} | ${rhoH.toFixed(3)} (${lo.toFixed(2)}–${hi.toFixed(2)}) | ${rhoP.toFixed(3)} | ${rhoC.toFixed(3)} | ${tot ? ((100 * ok) / tot).toFixed(1) : '—'}% | ${mean(fields.map(scoreOf)).toFixed(1)} | ${mean(fields.map(softOf)).toFixed(1)} |`);
    }
  }
  writeFileSync(OUT, lines.join('\n') + '\n');
  console.log(`\nwritten ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
