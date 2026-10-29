#!/usr/bin/env npx tsx
/**
 * Encode the scoring vocabulary once with isolated mLateOn and commit it.
 *
 * Vocabulary = every dictionary surface form + every synonym target + every
 * content word (after sanitising and synonym normalisation, generic terms
 * stripped) that appears in at least MIN_DF wines' notes in the catalogue +
 * every content word in the frozen set's taster notes. Each word is encoded
 * alone under [Q] and under [D]; vectors are L2-normalised, uncentred
 * (centring uses colbert-iso's measured mean at score time), float32,
 * base64, 128 dims. Output: src/lib/softEngines/colbert-table.generated.json.
 *
 *   npx tsx --env-file=.env.local scripts/build-colbert-table.ts
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { norwegianLemmas, sanitizeText } from '../src/lib/lemmatizeAndWeight';
import { WINE_SYNONYMS, normalizeWineSynonyms } from '../src/lib/synonymNormalization';
import { applyNegation } from '../src/lib/negation';
import { contentWords } from '../src/lib/softEngines/maxsim';
import { colbertIsolatedWordVector, COLBERT_REPO } from '../src/lib/softEngines/colbert';
import type { FrozenSet } from './export-frozen-set';

const OUT = 'src/lib/softEngines/colbert-table.generated.json';
const MIN_DF = 2;
const norm = (t: string) => normalizeWineSynonyms(sanitizeText(applyNegation(t).text));

async function main() {
  const sb = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const df = new Map<string, number>();
  let from = 0, wines = 0;
  for (;;) {
    const { data, error } = await sb.from('wines').select('smell,taste').order('id').range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const w of data) {
      const seen = new Set<string>();
      for (const t of [w.smell, w.taste]) if (t) for (const word of contentWords(norm(t))) seen.add(word);
      for (const word of seen) df.set(word, (df.get(word) ?? 0) + 1);
    }
    wines += data.length; from += 1000;
    process.stderr.write(`  ${wines} wines\r`);
  }
  const vocabulary = new Set<string>();
  for (const [word, n] of df) if (n >= MIN_DF) vocabulary.add(word);
  for (const key of Object.keys(norwegianLemmas)) for (const word of contentWords(normalizeWineSynonyms(key))) vocabulary.add(word);
  for (const target of Object.values(WINE_SYNONYMS)) for (const word of contentWords(target)) vocabulary.add(word);
  const frozen = JSON.parse(readFileSync('scripts/validation-results/frozen-set-2026-10.json', 'utf8')) as FrozenSet;
  for (const f of frozen.fields) for (const t of [f.userNote, f.referenceNote]) for (const word of contentWords(norm(t))) vocabulary.add(word);
  const words = [...vocabulary].sort((a, b) => a.localeCompare(b, 'nb'));
  console.log(`vocabulary: ${words.length} words (${[...df.values()].filter(n => n >= MIN_DF).length} from the catalogue at df ≥ ${MIN_DF}, ${wines} wines)`);

  const table: Record<string, { q: string; d: string }> = {};
  let dim = 0, done = 0;
  const b64 = (v: Float32Array) => Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString('base64');
  for (const word of words) {
    const q = await colbertIsolatedWordVector(word, 'Q');
    const d = await colbertIsolatedWordVector(word, 'D');
    if (!q.length || !d.length) continue;
    dim = q.length;
    table[word] = { q: b64(q), d: b64(d) };
    if (++done % 100 === 0) process.stderr.write(`  encoded ${done}/${words.length}\r`);
  }
  writeFileSync(OUT, JSON.stringify({ meta: { model: `${COLBERT_REPO}@int8 (isolated words)`, dimensions: dim, words: Object.keys(table).length, minDf: MIN_DF, catalogueWines: wines, builtAt: new Date().toISOString() }, words: table }) + '\n');
  console.log(`written ${OUT}: ${Object.keys(table).length} words × 2 prefixes × ${dim} dims`);
}

main().catch(e => { console.error(e); process.exit(1); });
