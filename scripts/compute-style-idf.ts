#!/usr/bin/env npx tsx
/**
 * Descriptor rarity within the wine's own style.
 *
 * The global idf (compute-idf-weights.ts) asks how rare a descriptor is
 * across the whole catalogue and never lets a common one fall below 1.0.
 * Measured against 149 human ratings (bert-integration-plan.md, phase 06),
 * that is the scorer's largest systematic error: "sitrus", "eple" and
 * "mineral" on a white earn as much as "solbær" on a red, while a taster
 * discounts the descriptors that are the default for the style.
 *
 * This script counts, per main category (Rødvin, Hvitvin, Musserende vin,
 * Rosévin), in how many wines each aroma lemma appears in the smell or taste
 * note, and writes idf / median-idf per lemma and category — unfloored, so
 * the floor is a runtime constant (STYLE_WEIGHT_FLOOR) that can be tuned
 * without regenerating. A category needs MIN_WINES wines and a lemma
 * MIN_DF occurrences in it to get a value; otherwise the scorer falls back
 * to the global multiplier.
 *
 * Also writes the categories of the frozen set's wines as a sidecar, so the
 * frozen file itself stays untouched.
 *
 *   npx tsx --env-file=.env.local scripts/compute-style-idf.ts
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { sanitizeText } from '../src/lib/lemmatizeAndWeight';
import { normalizeWineSynonyms } from '../src/lib/synonymNormalization';
import { lemmasWithWeight } from '../src/lib/flavourScoring';
import { normalizeCategory } from '../src/lib/styleWeights';
import type { FrozenSet } from './export-frozen-set';

const OUT = 'src/lib/style-idf.generated.json';
const FROZEN = 'scripts/validation-results/frozen-set-2026-10.json';
const SIDECAR = 'scripts/validation-results/frozen-set-2026-10.categories.json';
const MIN_WINES = 1000;
const MIN_DF = 5;

async function main() {
  const sb = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const byCat = new Map<string, { wines: number; df: Map<string, number> }>();
  const frozen = JSON.parse(readFileSync(FROZEN, 'utf8')) as FrozenSet;
  const frozenWines = new Set(frozen.fields.map(f => f.wine.id));
  const sidecar: Record<string, string | null> = {};

  let from = 0, total = 0;
  for (;;) {
    const { data, error } = await sb.from('wines').select('id,main_category,smell,taste').order('id').range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const w of data) {
      const cat = normalizeCategory(w.main_category);
      if (frozenWines.has(w.id)) sidecar[w.id] = cat;
      if (!cat) continue;
      const entry = byCat.get(cat) ?? byCat.set(cat, { wines: 0, df: new Map() }).get(cat)!;
      entry.wines++;
      const lemmas = new Set<string>();
      for (const text of [w.smell, w.taste]) {
        if (!text) continue;
        for (const info of lemmasWithWeight(normalizeWineSynonyms(sanitizeText(text))).values()) {
          if (info.main && info.main !== 'GENERIC') lemmas.add(info.lemma);
        }
      }
      for (const l of lemmas) entry.df.set(l, (entry.df.get(l) ?? 0) + 1);
    }
    total += data.length; from += 1000;
    process.stderr.write(`  ${total} wines\r`);
  }

  const categories: Record<string, { wines: number; medianIdf: number; ratio: Record<string, number> }> = {};
  for (const [cat, { wines, df }] of byCat) {
    if (wines < MIN_WINES) { console.log(`skip ${cat}: ${wines} wines`); continue; }
    const idf = new Map<string, number>();
    for (const [l, n] of df) if (n >= MIN_DF) idf.set(l, 1 + Math.log(wines / (1 + n)));
    const sorted = [...idf.values()].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const ratio: Record<string, number> = {};
    for (const [l, v] of idf) ratio[l] = Number((v / median).toFixed(4));
    categories[cat] = { wines, medianIdf: Number(median.toFixed(4)), ratio };
    const common = [...df.entries()].filter(([l]) => ratio[l] !== undefined).sort((a, b) => b[1] - a[1]).slice(0, 8);
    console.log(`${cat}: ${wines} wines, ${idf.size} lemmas; most common: ${common.map(([l, n]) => `${l} ${(100 * n / wines).toFixed(0)}% (${ratio[l]})`).join(', ')}`);
  }
  writeFileSync(OUT, JSON.stringify({ meta: { generatedAt: new Date().toISOString(), wines: total, minWines: MIN_WINES, minDf: MIN_DF, formula: 'idf = 1 + ln(wines / (1 + df)); ratio = idf / median idf of the category; floor and cap applied at runtime' }, categories }) + '\n');
  writeFileSync(SIDECAR, JSON.stringify(sidecar, null, 2) + '\n');
  console.log(`written ${OUT} (${Object.keys(categories).length} categories) and ${SIDECAR} (${Object.keys(sidecar).length} wines)`);
}

main().catch(e => { console.error(e); process.exit(1); });
