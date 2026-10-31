#!/usr/bin/env npx tsx
/**
 * Measure any ScoringOptions variant against the three validity targets.
 *
 * Scores every rated frozen field and the constructed set with the
 * production engine, once with the current options and once per variant,
 * and prints Spearman against the human ratings (with a bootstrap interval),
 * the LLM panel and the constructed levels. The property benchmark is the
 * other half of any gate (benchmark-scoring.ts has matching flags for most
 * options).
 *
 *   npx tsx --env-file=.env.local scripts/measure-options.ts '{"name":"no generic","options":{"ignoreGeneric":true}}' [more JSON variants…]
 *   npx tsx --env-file=.env.local scripts/measure-options.ts --preset=derivations   # the candidate sets defined below
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { sanitizeText } from '../src/lib/lemmatizeAndWeight';
import { normalizeWineSynonyms } from '../src/lib/synonymNormalization';
import { applyNegation } from '../src/lib/negation';
import { combineScoreScaled, hasScoreableFlavour, lexicalCredit, type ScoringOptions } from '../src/lib/flavourScoring';
import { getSoftEngineById, isSoftEngineId, type NoteInput, type SoftEngineId } from '../src/lib/softEngines';
import { bootstrapSpearmanCi, mean, spearman } from '../src/lib/stats';
import { loadRaterFiles, loadTarget } from './ratings-csv';
import type { FrozenSet } from './export-frozen-set';

const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ENGINE: SoftEngineId = isSoftEngineId(arg('engine')) ? (arg('engine') as SoftEngineId) : 'openai';
const OUT = `scripts/validation-results/options-${arg('preset') ?? 'adhoc'}-${new Date().toISOString().slice(0, 10)}.md`;

type Variant = { name: string; options: ScoringOptions };

/** Lees ageing: autolysis gives biscuit, brioche, nutty and buttery notes together. */
const LEES: Record<string, readonly string[]> = {
  kjeks: ['nøtt', 'mandel', 'smør', 'brioche', 'bakverk', 'gjær'],
  bakverk: ['nøtt', 'mandel', 'smør'],
  brioche: ['nøtt', 'mandel', 'smør'],
  gjær: ['smør'],
};
/** Oak gives spice: "fatkrydder" is the house word for it. */
const OAK_SPICE: Record<string, readonly string[]> = { fat: ['krydder'], eik: ['krydder'], fatlagret: ['krydder'] };

const PRESETS: Record<string, Variant[]> = {
  derivations: [
    { name: 'lees: kjeks/bakverk/brioche → nøtt, mandel, smør', options: { extraDerivations: LEES } },
    { name: 'oak → krydder', options: { extraDerivations: OAK_SPICE } },
    { name: 'both', options: { extraDerivations: { ...LEES, ...OAK_SPICE } } },
  ],
  generic: [
    { name: 'structural words out of the ladder', options: { ignoreGeneric: true } },
  ],
  exceptions: [
    { name: 'without the five review exceptions', options: { specificExceptions: {} } },
  ],
};

const input = (t: string): NoteInput => { const n = applyNegation(t); return { raw: n.text, norm: normalizeWineSynonyms(sanitizeText(n.text)) }; };

async function main() {
  const preset = arg('preset');
  const variants: Variant[] = preset ? PRESETS[preset] : process.argv.slice(2).filter(a => a.startsWith('{')).map(a => JSON.parse(a) as Variant);
  if (!variants?.length) throw new Error('give JSON variants or --preset=derivations|generic');
  const frozen = JSON.parse(readFileSync('scripts/validation-results/frozen-set-2026-10.json', 'utf8')) as FrozenSet;
  const constructed = JSON.parse(readFileSync('scripts/validation-results/constructed-set-2026-10.json', 'utf8')) as { items: Array<{ referenceKey: string; note: string; referenceNote: string; level: number }> };
  const raters = loadRaterFiles();
  const human = raters.get('kristian')!;
  const target = loadTarget().ratings;
  const panel = [...raters.entries()].filter(([k]) => k.startsWith('llm')).map(([, m]) => m);
  const engine = getSoftEngineById(ENGINE);
  if (!(await engine.available()).ok) throw new Error(`${ENGINE} unavailable`);
  let commit = 'unknown';
  try { commit = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* ignore */ }

  type P = { u: string; r: string; soft: number; human?: number; target?: number; panel?: number; level?: number; group?: string };
  const fields: P[] = [], cons: P[] = [];
  for (const f of frozen.fields) {
    const u = input(f.userNote), r = input(f.referenceNote);
    if (!hasScoreableFlavour(r.norm)) continue;
    const p = panel.map(m => m.get(f.key)).filter((v): v is number => v !== undefined);
    fields.push({ u: u.norm, r: r.norm, soft: (await engine.score(u, r)).softScore, human: human.get(f.key), target: target.get(f.key), panel: p.length ? mean(p) : undefined });
  }
  for (const item of constructed.items) {
    const u = input(item.note), r = input(item.referenceNote);
    cons.push({ u: u.norm, r: r.norm, soft: (await engine.score(u, r)).softScore, level: item.level, group: item.referenceKey });
  }
  const lines = [`# Scoring option variants — ${new Date().toISOString().slice(0, 10)}`, '', `Engine ${ENGINE}, commit \`${commit}\`.`, '', '| variant | ρ human (95%) | ρ target all fields (95%) | ρ panel | ρ constructed | pairwise | mean score | matches changed |', '| --- | --- | --- | --- | --- | --- | --- | --- |'];
  const log = (s: string) => { lines.push(s); console.log(s); };
  const baseMatches = fields.map(p => lexicalCredit(p.u, p.r).matches.map(m => m.kind).join(','));
  for (const v of [{ name: 'current', options: {} as ScoringOptions }, ...variants]) {
    const scoreOf = (p: P) => combineScoreScaled(lexicalCredit(p.u, p.r, v.options), p.soft, true, v.options).score;
    const h = fields.filter(x => x.human !== undefined), pn = fields.filter(x => x.panel !== undefined), tg = fields.filter(x => x.target !== undefined);
    const rhoH = spearman(h.map(scoreOf), h.map(x => x.human!)), [lo, hi] = bootstrapSpearmanCi(h.map(scoreOf), h.map(x => x.human!));
    const rhoT = spearman(tg.map(scoreOf), tg.map(x => x.target!)), [tlo, thi] = bootstrapSpearmanCi(tg.map(scoreOf), tg.map(x => x.target!));
    const rhoP = spearman(pn.map(scoreOf), pn.map(x => x.panel!));
    const rhoC = spearman(cons.map(scoreOf), cons.map(x => x.level!));
    let ok = 0, tot = 0;
    const groups = new Map<string, P[]>();
    for (const c of cons) (groups.get(c.group!) ?? groups.set(c.group!, []).get(c.group!)!).push(c);
    for (const g of groups.values()) for (const a of g) for (const b of g) if (a.level! > b.level!) { tot++; if (scoreOf(a) > scoreOf(b)) ok++; }
    const changed = fields.filter((p, i) => lexicalCredit(p.u, p.r, v.options).matches.map(m => m.kind).join(',') !== baseMatches[i]).length;
    log(`| ${v.name} | ${rhoH.toFixed(3)} (${lo.toFixed(2)}–${hi.toFixed(2)}) | ${rhoT.toFixed(3)} (${tlo.toFixed(2)}–${thi.toFixed(2)}) | ${rhoP.toFixed(3)} | ${rhoC.toFixed(3)} | ${tot ? ((100 * ok) / tot).toFixed(1) : '—'}% | ${mean(fields.map(scoreOf)).toFixed(1)} | ${changed} fields |`);
  }
  writeFileSync(OUT, lines.join('\n') + '\n');
  console.log(`\nwritten ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
