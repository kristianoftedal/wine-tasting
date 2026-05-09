/**
 * Computes per-lemma IDF weights from the wine note corpus (taste + smell).
 * IDF = 1 + ln(N / (1 + df))  where N=total docs, df=docs containing that lemma.
 *
 * Output: src/lib/idf-weights.generated.json
 *   { [lemma]: multiplier }
 *
 * Multiplier is IDF-over-median, floored at 1.0:
 *   - Common terms (frisk, god, lang)  → 1.0 (no change)
 *   - Rare terms  (brioche, eukalyptus) → > 1.0 (upward boost)
 * This guarantees no existing score ever decreases.
 *
 * Run: npx tsx scripts/compute-idf-weights.ts
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { sanitizeText, norwegianLemmas } from '../src/lib/lemmatizeAndWeight';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getDocumentLemmas(text: string): Set<string> {
  const lemmas = new Set<string>();
  if (!text) return lemmas;
  const tokens = sanitizeText(text).split(' ').filter(Boolean);
  for (const token of tokens) {
    const entry = norwegianLemmas[token];
    if (entry) lemmas.add(entry.lemma);
  }
  return lemmas;
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('Fetching wine notes from corpus...');
  const PAGE = 1000;
  const data: { taste: string | null; smell: string | null }[] = [];
  let from = 0;
  while (true) {
    const { data: page, error } = await supabase
      .from('wines')
      .select('taste, smell')
      .range(from, from + PAGE - 1);
    if (error) { console.error('Fetch failed:', error); process.exit(1); }
    if (!page || page.length === 0) break;
    data.push(...page);
    if (page.length < PAGE) break;
    from += PAGE;
  }

  const docs: Set<string>[] = [];
  for (const wine of data) {
    if (wine.taste) docs.push(getDocumentLemmas(wine.taste));
    if (wine.smell) docs.push(getDocumentLemmas(wine.smell));
  }
  const N = docs.length;
  console.log(`Corpus: ${N} documents from ${data.length} wines`);

  // Count document frequency per lemma
  const df = new Map<string, number>();
  for (const docLemmas of docs) {
    for (const lemma of docLemmas) {
      df.set(lemma, (df.get(lemma) ?? 0) + 1);
    }
  }

  // Compute IDF = 1 + ln(N / (1 + df))
  const idf = new Map<string, number>();
  for (const [lemma, count] of df) {
    idf.set(lemma, 1 + Math.log(N / (1 + count)));
  }

  // Find median IDF across all known lemmas with at least 1 document occurrence
  const idfValues = [...idf.values()].sort((a, b) => a - b);
  const median = idfValues[Math.floor(idfValues.length / 2)];
  console.log(`Median IDF: ${median.toFixed(3)}, range: ${idfValues[0].toFixed(3)} – ${idfValues[idfValues.length - 1].toFixed(3)}`);

  // Multiplier = idf / median, floored at 1.0 so scores never decrease
  const weights: Record<string, number> = {};
  for (const [lemma, score] of idf) {
    const multiplier = score / median;
    weights[lemma] = parseFloat(Math.max(1.0, multiplier).toFixed(4));
  }

  // Sort by multiplier descending for readability
  const sorted = Object.fromEntries(
    Object.entries(weights).sort(([, a], [, b]) => b - a)
  );

  const outPath = join(__dirname, '../src/lib/idf-weights.generated.json');
  writeFileSync(outPath, JSON.stringify(sorted, null, 2));

  console.log('\nTop 15 boosted lemmas (rarest):');
  Object.entries(sorted).slice(0, 15).forEach(([lemma, w]) => {
    console.log(`  ${lemma.padEnd(20)} × ${w.toFixed(3)}  (df=${df.get(lemma)})`);
  });

  console.log('\nBottom 10 (most common, floored at 1.0):');
  Object.entries(sorted).slice(-10).forEach(([lemma, w]) => {
    console.log(`  ${lemma.padEnd(20)} × ${w.toFixed(3)}  (df=${df.get(lemma)})`);
  });

  console.log(`\nWritten to ${outPath}`);
}

main().catch(console.error);
