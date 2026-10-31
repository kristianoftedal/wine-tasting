#!/usr/bin/env npx tsx
/**
 * Put a local engine's soft term on the level people are used to.
 *
 * The local engines are calibrated so that an unrelated pair reads 0 and an
 * exact match 100, which is principled and lands their typical soft term
 * near 33 where the OpenAI engine's lands near 64 (its fixed SOFT_SCALE was
 * chosen in August to make the range look like 0–100). Rankings within an
 * engine are what the measurements compare and they are unaffected; totals
 * are what tasters see, and a switch of engine must not read as everyone
 * suddenly scoring ten points lower.
 *
 * This fits, per engine, the least-squares line soft_openai ≈ a + b·soft_local
 * over the frozen set's scoreable fields and writes it as `scale` into
 * maxsim-baseline.generated.json. The engine applies it after its own
 * rescale, clamped to 0–100. Monotone, so every rank inside the engine is
 * preserved; only the level and spread move.
 *
 *   npx tsx --env-file=.env.local scripts/fit-soft-scale.ts [--engines=colbert-table,colbert+cooc,cooc,...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { sanitizeText } from '../src/lib/lemmatizeAndWeight';
import { normalizeWineSynonyms } from '../src/lib/synonymNormalization';
import { applyNegation } from '../src/lib/negation';
import { hasScoreableFlavour } from '../src/lib/flavourScoring';
import { getSoftEngineById, isSoftEngineId, type NoteInput, type SoftEngineId } from '../src/lib/softEngines';
import { mean, pearson, sd } from '../src/lib/stats';
import type { FrozenSet } from './export-frozen-set';

const BASELINE = 'src/lib/softEngines/maxsim-baseline.generated.json';
const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ENGINE_IDS: SoftEngineId[] = (arg('engines') ?? 'colbert-table,colbert+cooc,cooc,colbert-iso,colbert-token,colbert-word,bert').split(',').map(s => s.trim()).filter(isSoftEngineId);
const input = (t: string): NoteInput => { const n = applyNegation(t); return { raw: n.text, norm: normalizeWineSynonyms(sanitizeText(n.text)) }; };

async function main() {
  const frozen = JSON.parse(readFileSync('scripts/validation-results/frozen-set-2026-10.json', 'utf8')) as FrozenSet;
  const pairs = frozen.fields.map(f => ({ u: input(f.userNote), r: input(f.referenceNote) })).filter(p => hasScoreableFlavour(p.r.norm));
  const openai = getSoftEngineById('openai');
  if (!(await openai.available()).ok) throw new Error('openai unavailable (needed once, to fit against)');
  const target: number[] = [];
  for (const p of pairs) target.push((await openai.score(p.u, p.r)).softScore);
  const baselines = JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<string, Record<string, unknown>>;
  console.log(`openai soft term on ${pairs.length} fields: mean ${mean(target).toFixed(1)}, sd ${sd(target).toFixed(1)}`);
  for (const id of ENGINE_IDS) {
    const engine = getSoftEngineById(id);
    if (!(await engine.available()).ok) { console.log(`${id}: unavailable`); continue; }
    // Fit on the engine's *unscaled* output: temporarily clear any existing scale.
    const prev = baselines[id]?.scale;
    if (baselines[id]) delete baselines[id].scale;
    writeFileSync(BASELINE, JSON.stringify(baselines, null, 2) + '\n');
    const x: number[] = [];
    for (const p of pairs) x.push((await engine.score(p.u, p.r)).softScore);
    const mx = mean(x), my = mean(target);
    const b = x.reduce((s, xi, i) => s + (xi - mx) * (target[i] - my), 0) / (x.reduce((s, xi) => s + (xi - mx) ** 2, 0) || 1);
    const a = my - b * mx;
    baselines[id] = { ...(baselines[id] ?? {}), scale: { a: Number(a.toFixed(4)), b: Number(b.toFixed(4)), fittedOn: pairs.length, fittedAt: new Date().toISOString() } };
    console.log(`${id.padEnd(14)} mean ${mx.toFixed(1)} sd ${sd(x).toFixed(1)} r ${pearson(x, target).toFixed(3)} → soft' = ${a.toFixed(2)} + ${b.toFixed(3)}·soft${prev ? ' (refitted)' : ''}`);
  }
  writeFileSync(BASELINE, JSON.stringify(baselines, null, 2) + '\n');
  console.log(`written ${BASELINE}`);
}

main().catch(e => { console.error(e); process.exit(1); });
