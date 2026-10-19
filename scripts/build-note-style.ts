#!/usr/bin/env npx tsx
/**
 * Derive the house style for Vinmonopolet tasting notes from the catalogue
 * itself and write src/lib/note-style.generated.json.
 *
 * The enrichment prompt (src/lib/notePrompt.ts) must not describe the style
 * from memory — it must describe the style the database actually contains, so
 * a generated note is indistinguishable from an imported one and, critically,
 * scores through the same lemma dictionary. This script extracts:
 *
 *   - hard length and sentence limits (measured, not chosen)
 *   - the aroma vocabulary each wine category actually uses, ranked by
 *     frequency, restricted to lemmas src/lib/lemmatizeAndWeight.ts knows
 *   - the structural openers the notes use ("Aroma av", "Saftig og ...")
 *   - few-shot exemplars: the richest, most distinct notes per category
 *
 * Rerun after a catalogue import or any change to the lemma dictionary.
 *
 * Usage:
 *   npx tsx scripts/build-note-style.ts            # writes the JSON
 *   npx tsx scripts/build-note-style.ts --report   # also prints the analysis
 */
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local' });
dotenvConfig();

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { assessNote, RICH_AROMA_LEMMAS } from '../src/lib/noteQuality';

const OUTPUT = resolve(__dirname, '../src/lib/note-style.generated.json');
const PAGE_SIZE = 1000;
const report = process.argv.includes('--report');

/** Exemplars per category shown to the model. Six is enough to fix tone. */
const EXEMPLARS_PER_CATEGORY = 6;
/** Vocabulary terms per category. Covers the long tail without flooding the prompt. */
const VOCAB_PER_CATEGORY = 60;
/** A note qualifies as an exemplar only if both components are at least this rich. */
const EXEMPLAR_MIN_SMELL = 6;
const EXEMPLAR_MIN_TASTE = 5;

type WineRow = {
  product_id: string;
  name: string;
  main_category: string | null;
  smell: string | null;
  taste: string | null;
};

async function fetchAllWines(): Promise<WineRow[]> {
  const supabase = createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const rows: WineRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    // order('id') keeps .range() pages from overlapping — PostgREST guarantees
    // no ordering without it, and an unordered scan silently double-counts some
    // rows while skipping others.
    const { data, error } = await supabase
      .from('wines')
      .select('product_id,name,main_category,smell,taste')
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`wines fetch failed at offset ${from}: ${error.message}`);
    if (!data?.length) break;

    rows.push(...(data as WineRow[]));
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

function topEntries(counts: Map<string, number>, n: number): string[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([term]) => term);
}

/**
 * Notes repeat verbatim across vintages and bottle sizes — the same Santa Rita
 * Syrah text appeared five times in the top-20 by aroma mass. Key on the note
 * text so the few-shot block shows six different styles, not one style six times.
 */
function pickExemplars(candidates: Array<{ wine: WineRow; smellCount: number; tasteCount: number }>) {
  const seen = new Set<string>();
  const picked: Array<{ name: string; smell: string; taste: string }> = [];

  for (const candidate of candidates.sort((a, b) => b.smellCount + b.tasteCount - (a.smellCount + a.tasteCount))) {
    const key = `${candidate.wine.smell}|${candidate.wine.taste}`;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push({
      name: candidate.wine.name,
      smell: candidate.wine.smell!.trim(),
      taste: candidate.wine.taste!.trim()
    });
    if (picked.length >= EXEMPLARS_PER_CATEGORY) break;
  }
  return picked;
}

async function main() {
  console.log('Fetching catalogue…');
  const wines = await fetchAllWines();
  console.log(`  ${wines.length} wines`);

  const vocabByCategory = new Map<string, Map<string, number>>();
  const openersByField = { smell: new Map<string, number>(), taste: new Map<string, number>() };
  const exemplarPool = new Map<string, Array<{ wine: WineRow; smellCount: number; tasteCount: number }>>();
  const lengths = { smell: [] as number[], taste: [] as number[] };
  const sentenceCounts = { smell: [] as number[], taste: [] as number[] };
  const verdictTally = { smell: new Map<string, number>(), taste: new Map<string, number>() };

  for (const wine of wines) {
    const category = wine.main_category?.trim() || 'Ukjent';
    const smell = assessNote(wine.smell);
    const taste = assessNote(wine.taste);

    for (const field of ['smell', 'taste'] as const) {
      const assessment = field === 'smell' ? smell : taste;
      verdictTally[field].set(assessment.verdict, (verdictTally[field].get(assessment.verdict) ?? 0) + 1);
    }

    const isStrong = smell.aromaLemmas >= RICH_AROMA_LEMMAS + 1 && taste.aromaLemmas >= RICH_AROMA_LEMMAS;
    if (!isStrong) continue;

    // Style facts come only from notes that already demonstrate the style.
    const vocab = vocabByCategory.get(category) ?? new Map<string, number>();
    for (const lemma of [...smell.lemmas, ...taste.lemmas]) {
      vocab.set(lemma, (vocab.get(lemma) ?? 0) + 1);
    }
    vocabByCategory.set(category, vocab);

    for (const field of ['smell', 'taste'] as const) {
      const text = (field === 'smell' ? wine.smell : wine.taste)!.trim();
      const assessment = field === 'smell' ? smell : taste;
      lengths[field].push(text.length);
      sentenceCounts[field].push(assessment.sentences);

      const opener = text.toLowerCase().split(/\s+/).slice(0, 2).join(' ').replace(/[,.]$/, '');
      openersByField[field].set(opener, (openersByField[field].get(opener) ?? 0) + 1);
    }

    if (smell.aromaLemmas >= EXEMPLAR_MIN_SMELL && taste.aromaLemmas >= EXEMPLAR_MIN_TASTE) {
      const pool = exemplarPool.get(category) ?? [];
      pool.push({ wine, smellCount: smell.aromaLemmas, tasteCount: taste.aromaLemmas });
      exemplarPool.set(category, pool);
    }
  }

  const categories: Record<
    string,
    { vocabulary: string[]; exemplars: Array<{ name: string; smell: string; taste: string }> }
  > = {};
  for (const [category, vocab] of vocabByCategory) {
    categories[category] = {
      vocabulary: topEntries(vocab, VOCAB_PER_CATEGORY),
      exemplars: pickExemplars(exemplarPool.get(category) ?? [])
    };
  }

  const style = {
    generatedAt: new Date().toISOString(),
    source: 'scripts/build-note-style.ts',
    corpusSize: wines.length,
    strongNoteCount: lengths.smell.length,
    limits: {
      smell: {
        maxChars: Math.max(...lengths.smell),
        medianChars: percentile(lengths.smell, 0.5),
        maxSentences: percentile(sentenceCounts.smell, 0.95)
      },
      taste: {
        maxChars: Math.max(...lengths.taste),
        medianChars: percentile(lengths.taste, 0.5),
        maxSentences: percentile(sentenceCounts.taste, 0.95)
      }
    },
    openers: {
      smell: topEntries(openersByField.smell, 12),
      taste: topEntries(openersByField.taste, 12)
    },
    categories
  };

  writeFileSync(OUTPUT, `${JSON.stringify(style, null, 2)}\n`);
  console.log(`Wrote ${OUTPUT}`);
  console.log(`  ${Object.keys(categories).length} categories, ${style.strongNoteCount} strong notes`);

  if (report) {
    for (const field of ['smell', 'taste'] as const) {
      const tally = [...verdictTally[field].entries()].sort((a, b) => b[1] - a[1]);
      console.log(
        `\n${field}: ` + tally.map(([v, c]) => `${v} ${c} (${((100 * c) / wines.length).toFixed(1)}%)`).join(', ')
      );
    }
    for (const [category, data] of Object.entries(categories)) {
      console.log(`\n== ${category} ==\n  vocab: ${data.vocabulary.slice(0, 25).join(', ')}`);
      console.log(`  exemplar: ${data.exemplars[0]?.smell ?? '(none)'}`);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
