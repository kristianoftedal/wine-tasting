#!/usr/bin/env npx tsx
/**
 * Calibrate the local soft engines: corpus mean for centring, then the
 * MaxSim floor per reference length.
 *
 * Why two steps. mLateOn's token vectors sit at cosine 0.89–0.94 for any two
 * descriptor words, matched or not; NorBERT's word vectors are less extreme
 * but share the same "Norwegian wine word" direction. Subtracting the corpus
 * mean (as embeddingCentering.ts does for OpenAI, where it moved unrelated
 * pairs from 0.459 to −0.004) removes that shared component. What remains
 * still has a floor that grows with the number of reference words (a max
 * over more candidates is higher by chance), so the second step measures
 * that floor per bucket by scoring every real taster note against 400
 * random wines from a slice of the catalogue the benchmark does not use as
 * distractors (ids 3000–3399 in id order), enough to populate every length
 * bucket; the benchmark's own 100 distractors stay out of sample.
 *
 * Writes src/lib/softEngines/centering.generated.json and
 * src/lib/softEngines/maxsim-baseline.generated.json (merged per engine) and
 * a report under scripts/validation-results/.
 *
 *   npx tsx --env-file=.env.local scripts/compute-maxsim-baseline.ts
 *     [--engines=bert,colbert-word,colbert-token,openai]   default: the three local engines
 *     [--frozen=<file>]   default: newest frozen set
 *     [--report=scripts/validation-results/calibration-<date>.md]
 */
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sanitizeText } from '../src/lib/lemmatizeAndWeight';
import { normalizeWineSynonyms } from '../src/lib/synonymNormalization';
import { applyNegation } from '../src/lib/negation';
import { getSoftEngineById, isSoftEngineId, type NoteInput, type SoftEngineId } from '../src/lib/softEngines';
import { bertCalibration } from '../src/lib/softEngines/bert';
import { colbertCalibration } from '../src/lib/softEngines/colbert';
import { BASELINE_BUCKETS, bucketFor, type BaselineBucket } from '../src/lib/softEngines/baseline';
import { contentWords } from '../src/lib/softEngines/maxsim';
import { mean, sd } from '../src/lib/stats';
import type { FrozenSet } from './export-frozen-set';

const CENTERING = 'src/lib/softEngines/centering.generated.json';
const BASELINE = 'src/lib/softEngines/maxsim-baseline.generated.json';
const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ENGINE_IDS: SoftEngineId[] = (arg('engines') ?? 'bert,colbert-word,colbert-token').split(',').map(s => s.trim()).filter(isSoftEngineId);
const REPORT = arg('report') ?? `scripts/validation-results/calibration-${new Date().toISOString().slice(0, 10)}.md`;

const input = (t: string): NoteInput => { const n = applyNegation(t); return { raw: n.text, norm: normalizeWineSynonyms(sanitizeText(n.text)) }; };

function latestFrozen(): string {
  const files = readdirSync('scripts/validation-results').filter(f => /^frozen-set-.*\.json$/.test(f)).sort();
  return join('scripts/validation-results', files[files.length - 1]);
}

async function main() {
  const frozenPath = arg('frozen') ?? latestFrozen();
  const frozen = JSON.parse(readFileSync(frozenPath, 'utf8')) as FrozenSet;
  const sb = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const tasted = new Set(frozen.fields.map(f => f.wine.id));
  const { data: pool } = await sb.from('wines').select('id,smell,taste').not('taste', 'is', null).not('smell', 'is', null).order('id').range(3000, 3399);
  const distractors = pool!.filter(w => !tasted.has(w.id));
  let commit = 'unknown';
  try { commit = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* ignore */ }

  const centering = JSON.parse(readFileSync(CENTERING, 'utf8')) as Record<string, unknown>;
  const baselines = JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<string, unknown>;
  const lines: string[] = [`# Soft-engine calibration — ${new Date().toISOString().slice(0, 10)}`, '', `Commit \`${commit}\`; frozen set \`${frozenPath}\` (${frozen.fields.length} fields); ${distractors.length} calibration wines (catalogue ids 3000–3399, none tasted).`, ''];
  const log = (s = '') => { lines.push(s); console.log('\n' + s); };

  const corpusNotes = [...new Set([
    ...frozen.fields.flatMap(f => [f.userNote, f.referenceNote]),
    ...distractors.flatMap(d => [d.smell!, d.taste!]),
  ])].map(input);

  // ── step 1: corpus means ─────────────────────────────────────────────────
  const families: Array<{ key: 'bert' | 'colbert'; model: string; collect: (n: NoteInput) => Promise<Float32Array[]>; set: (m: Float32Array | null) => void }> = [];
  if (ENGINE_IDS.includes('bert')) families.push({ key: 'bert', model: getSoftEngineById('bert').model, collect: n => bertCalibration.contentVectors(n), set: m => bertCalibration.setMean(m) });
  if (ENGINE_IDS.some(id => id.startsWith('colbert'))) families.push({ key: 'colbert', model: getSoftEngineById('colbert-word').model, collect: n => colbertCalibration.tokenVectors(n), set: m => colbertCalibration.setMean(m) });

  log('## Centring');
  log();
  log('| family | model | vectors | dims | ‖mean‖ (0 = isotropic, 1 = collapsed) |');
  log('| --- | --- | --- | --- | --- |');
  for (const fam of families) {
    const engine = getSoftEngineById(fam.key === 'bert' ? 'bert' : 'colbert-word');
    const a = await engine.available();
    if (!a.ok) { log(`| ${fam.key} | unavailable: ${a.reason} | | | |`); continue; }
    fam.set(null);
    let sum: Float64Array | null = null, n = 0;
    for (const note of corpusNotes) {
      for (const v of await fam.collect(note)) {
        if (!sum) sum = new Float64Array(v.length);
        for (let i = 0; i < v.length; i++) sum[i] += v[i];
        n++;
      }
      if (n % 2000 < 10) process.stderr.write(`  ${fam.key}: ${n} vectors\r`);
    }
    if (!sum || !n) continue;
    const vector = Array.from(sum, x => x / n);
    const meanNorm = Math.sqrt(vector.reduce((s, x) => s + x * x, 0));
    centering[fam.key] = { model: fam.model, dimensions: vector.length, sampleSize: n, meanNorm, measuredAt: new Date().toISOString(), vector: vector.map(x => Number(x.toFixed(6))) };
    fam.set(Float32Array.from(vector));
    log(`| ${fam.key} | ${fam.model} | ${n} | ${vector.length} | ${meanNorm.toFixed(3)} |`);
  }
  writeFileSync(CENTERING, JSON.stringify(centering) + '\n');
  log();

  // ── step 2: floors per reference length, on centred vectors ─────────────
  log('## MaxSim floor per reference-length bucket (centred vectors)');
  log();
  log('Random pairs: every taster note against each calibration wine\'s note of the same field. True pairs: the note against its own wine. Separation = (true − random) / sd(random).');
  log();
  log('| engine | bucket | random pairs | b = mean random | sd random | true pairs | mean true | separation |');
  log('| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const id of ENGINE_IDS) {
    const engine = getSoftEngineById(id);
    const a = await engine.available();
    if (!a.ok) { log(`| ${id} | unavailable: ${a.reason} | | | | | | |`); continue; }
    const random: Record<BaselineBucket, number[]> = { '1-3': [], '4-6': [], '7-10': [], '11+': [] };
    const truePairs: Record<BaselineBucket, number[]> = { '1-3': [], '4-6': [], '7-10': [], '11+': [] };
    let done = 0;
    for (const f of frozen.fields) {
      const user = input(f.userNote);
      if (!contentWords(user.norm).length) continue;
      const own = input(f.referenceNote);
      const ownWords = contentWords(own.norm).length;
      if (ownWords) truePairs[bucketFor(ownWords)].push((await engine.score(user, own)).raw);
      for (const d of distractors) {
        const ref = input((f.field === 'lukt' ? d.smell : d.taste) || '');
        const words = contentWords(ref.norm).length;
        if (!words) continue;
        random[bucketFor(words)].push((await engine.score(user, ref)).raw);
      }
      if (++done % 20 === 0) process.stderr.write(`  ${id}: ${done}/${frozen.fields.length}\r`);
    }
    const buckets: Partial<Record<BaselineBucket, number>> = {};
    let pairs = 0;
    for (const b of BASELINE_BUCKETS) {
      const r = random[b], t = truePairs[b];
      if (!r.length) continue;
      buckets[b] = Number(mean(r).toFixed(4));
      pairs += r.length;
      const sep = t.length ? (mean(t) - mean(r)) / (sd(r) || 1) : NaN;
      log(`| ${id} | ${b} | ${r.length} | ${mean(r).toFixed(3)} | ${sd(r).toFixed(3)} | ${t.length} | ${t.length ? mean(t).toFixed(3) : '—'} | ${Number.isNaN(sep) ? '—' : sep.toFixed(2)} |`);
    }
    baselines[id] = { model: engine.model, measuredAt: new Date().toISOString(), pairs, centered: id !== 'openai', buckets };
  }
  writeFileSync(BASELINE, JSON.stringify(baselines, null, 2) + '\n');
  log();
  log('The OpenAI engine is listed for comparison only; it centres instead of rescaling and ignores this file.');
  writeFileSync(REPORT, lines.join('\n') + '\n');
  console.log(`\nwritten ${CENTERING}, ${BASELINE}, ${REPORT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
