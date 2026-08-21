#!/usr/bin/env npx tsx
/**
 * Build the food-query lemma maps by scanning the vocabulary that actually
 * exists in the database, then asking an LLM to enumerate the Norwegian dishes,
 * ingredients and occasions a user might type for each canonical term.
 *
 * Three separate vocabularies are involved, because three different columns are
 * queried at runtime and their contents do not overlap:
 *
 *   food    wines.is_good_for            protein / food category, 12 terms
 *                                        e.g. Svin, Fisk, Ost, Aperitiff
 *   theme   wine_articles.food_tags      cuisine, season, occasion, 12 terms
 *                                        e.g. Jul og nyttår, Grillmat, Asiatisk
 *   course  wine_articles.occasion_tags  course / format, 7 terms
 *                                        e.g. Hovedrett, Forrett, Tilbehør
 *
 * The column names are misleading and worth stating plainly: the real
 * *occasions* (Jul og nyttår, 17. mai, Påske, Thanksgiving) live in
 * `food_tags`, while `occasion_tags` holds the course. Routing a query by
 * column name rather than by content sends "julemat" to the wrong table.
 *
 * Each vocabulary gets its own inverse map so the runtime can route a lemma to
 * the column it can actually be matched against. Emitting one merged map would
 * force the runtime to guess, and terms that cannot be matched anywhere would
 * silently filter out.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/build-food-lemmas.ts            # scan + print
 *   npx tsx --env-file=.env.local scripts/build-food-lemmas.ts --execute  # + call LLM and write
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local' });
dotenvConfig();

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { openai } from '@ai-sdk/openai';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { CURATED_LEMMAS } from '../src/lib/food-synonyms';

const execute = process.argv.includes('--execute');
const OUTPUT_PATH = join(process.cwd(), 'src/lib/food-synonyms.generated.json');

const supabase = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type Kind = 'food' | 'theme' | 'course';

// ── Scan canonical vocabulary ────────────────────────────────────────────

async function scanCanonicalTerms(): Promise<Record<Kind, string[]>> {
  const { data: articleRows, error: aErr } = await supabase
    .from('wine_articles')
    .select('food_tags, occasion_tags');
  if (aErr) throw new Error(`wine_articles scan failed: ${aErr.message}`);

  const themeCounts = new Map<string, number>();
  const courseCounts = new Map<string, number>();
  for (const r of articleRows ?? []) {
    for (const t of (r.food_tags ?? []) as string[]) themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1);
    for (const t of (r.occasion_tags ?? []) as string[]) courseCounts.set(t, (courseCounts.get(t) ?? 0) + 1);
  }

  // is_good_for is TEXT[] in the live DB; page through to count term frequency
  const foodCounts = new Map<string, number>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('wines')
      .select('is_good_for')
      .not('is_good_for', 'is', null)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`wines scan failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data) {
      for (const entry of (row.is_good_for ?? []) as unknown[]) {
        // Defensive: tolerate the legacy {name} shape if any rows still have it
        const name = typeof entry === 'string' ? entry : (entry as { name?: string })?.name;
        if (name) foodCounts.set(name, (foodCounts.get(name) ?? 0) + 1);
      }
    }
    if (data.length < PAGE) break;
  }

  const sortByCount = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);

  return {
    food: sortByCount(foodCounts),
    theme: sortByCount(themeCounts),
    course: sortByCount(courseCounts),
  };
}

// ── LLM lemma expansion ──────────────────────────────────────────────────

const LemmaSchema = z.object({
  synonyms: z
    .array(z.string())
    .describe('Norwegian dish names, ingredients, occasions, or close synonyms a user might type. Lowercase. No duplicates of the canonical term.'),
});

const PROMPTS: Record<Kind, (canonical: string) => string> = {
  food: c =>
    `Vinmonopolet-matkategori: "${c}".\n\nEksempler: kategorien "Svin" → ["ribbe", "svin", "skinke", "bacon", "svinekam", "pulled pork", "svinekoteletter", "spareribs", "schnitzel"].\n\nLag tilsvarende liste for "${c}". Konkrete retter og ingredienser.`,
  theme: c =>
    `Vinmonopolet-tema (kjøkken, sesong eller anledning): "${c}".\n\nEksempler: "Jul og nyttår" → ["jul", "julaften", "julemat", "julemiddag", "nyttår", "nyttårsaften", "romjul", "julebord"].\n\nLag tilsvarende liste for "${c}". Anledninger og kjøkkenbegreper, ikke enkeltingredienser.`,
  course: c =>
    `Vinmonopolet-rettstype: "${c}".\n\nEksempler: "Forrett" → ["forrett", "starter", "appetizer", "småretter til forrett", "første rett"].\n\nLag tilsvarende liste for "${c}". Ord for hvor i måltidet retten hører, ikke ingredienser.`,
};

async function expandCategory(canonical: string, kind: Kind): Promise<string[]> {
  const { output } = await generateText({
    model: openai('gpt-4o-mini'),
    output: Output.object({ schema: LemmaSchema }),
    temperature: 0,
    system:
      'Du genererer norske søkeord en bruker ville skrevet for å finne vin som passer til en gitt kategori fra Vinmonopolet. Returner konkrete ord på norsk, små bokstaver. 10-25 stk. Ikke gjenta selve kategorinavnet.',
    prompt: PROMPTS[kind](canonical),
  });
  return [...new Set(
    output.synonyms
      .map(s => s.toLowerCase().trim())
      .filter(s => s.length >= 2 && s !== canonical.toLowerCase()),
  )];
}

// ── Build inverse maps ───────────────────────────────────────────────────

/**
 * A lemma claimed by this many canonical terms in one channel carries almost no
 * discriminative signal. The LLM reliably produces a tail of generic social
 * words — "bursdag", "grillfest", "sommerfest", "familiesammenkomst" — that
 * every theme claims, and matching on them returns most of the corpus.
 */
const MAX_TARGETS_PER_LEMMA = 3;

function buildInverseMap(
  expansions: Array<{ canonical: string; synonyms: string[] }>,
): Record<string, string[]> {
  const inv = new Map<string, Set<string>>();
  const add = (key: string, canonical: string) => {
    if (!inv.has(key)) inv.set(key, new Set());
    inv.get(key)!.add(canonical);
  };

  for (const { canonical, synonyms } of expansions) {
    add(canonical.toLowerCase(), canonical);
    for (const syn of synonyms) add(syn, canonical);
  }

  const out: Record<string, string[]> = {};
  for (const [key, set] of [...inv.entries()].sort()) out[key] = [...set].sort();
  return out;
}

/**
 * Prune the raw sweep on two rules, both checked against the curated layer:
 *
 *   ambiguity  a lemma claimed by MAX_TARGETS_PER_LEMMA or more canonical terms
 *              is a generic word, not a synonym.
 *   channel    a lemma the curated layer places in a *different* channel does
 *              not belong here. The curated map decides which column a term can
 *              be matched against; the sweep only fills in synonyms.
 *
 * Curated lemmas already shadow the generated map at lookup time, so pruning
 * them loses nothing at runtime and keeps the artifact honest about its own
 * coverage.
 */
function pruneMap(
  map: Record<string, string[]>,
  kind: Kind,
): { pruned: Record<string, string[]>; droppedAmbiguous: string[]; droppedChannel: string[] } {
  const curatedHere = new Set(Object.keys(CURATED_LEMMAS[kind]));
  const curatedAnywhere = new Set(Object.values(CURATED_LEMMAS).flatMap(m => Object.keys(m)));

  const droppedAmbiguous: string[] = [];
  const droppedChannel: string[] = [];
  const pruned: Record<string, string[]> = {};

  for (const [lemma, targets] of Object.entries(map)) {
    if (targets.length >= MAX_TARGETS_PER_LEMMA) { droppedAmbiguous.push(lemma); continue; }
    if (curatedAnywhere.has(lemma) && !curatedHere.has(lemma)) { droppedChannel.push(lemma); continue; }
    if (targets.length === 0) continue;
    pruned[lemma] = targets;
  }

  return { pruned, droppedAmbiguous, droppedChannel };
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Mode: ${execute ? 'EXECUTE (will call LLM and write file)' : 'DRY RUN (scan only)'}\n`);

  console.log('Scanning canonical vocabulary…');
  const vocab = await scanCanonicalTerms();

  const LABELS: Record<Kind, string> = {
    food: 'wines.is_good_for',
    theme: 'wine_articles.food_tags',
    course: 'wine_articles.occasion_tags',
  };
  for (const kind of ['food', 'theme', 'course'] as Kind[]) {
    console.log(`\n${kind} — ${LABELS[kind]}: ${vocab[kind].length} unique`);
    console.log(`  ${vocab[kind].join(', ')}`);
  }

  if (!execute) {
    console.log('\nDry run — pass --execute to call the LLM and write the generated file\n');
    return;
  }

  const maps: Record<Kind, Record<string, string[]>> = { food: {}, theme: {}, course: {} };
  for (const kind of ['food', 'theme', 'course'] as Kind[]) {
    console.log(`\nExpanding ${vocab[kind].length} ${kind} terms via LLM…`);
    const expansions: Array<{ canonical: string; synonyms: string[] }> = [];
    for (let i = 0; i < vocab[kind].length; i++) {
      const canonical = vocab[kind][i];
      process.stdout.write(`  [${i + 1}/${vocab[kind].length}] ${canonical} … `);
      try {
        const synonyms = await expandCategory(canonical, kind);
        console.log(`${synonyms.length} synonyms`);
        expansions.push({ canonical, synonyms });
      } catch (err) {
        console.log(`FAILED: ${(err as Error).message}`);
        expansions.push({ canonical, synonyms: [] });
      }
    }
    const raw = buildInverseMap(expansions);
    const { pruned, droppedAmbiguous, droppedChannel } = pruneMap(raw, kind);
    maps[kind] = pruned;
    console.log(`  ${Object.keys(raw).length} lemmas -> ${Object.keys(pruned).length} after pruning`);
    if (droppedAmbiguous.length) console.log(`    too ambiguous (${droppedAmbiguous.length}): ${droppedAmbiguous.join(', ')}`);
    if (droppedChannel.length) console.log(`    curated elsewhere (${droppedChannel.length}): ${droppedChannel.join(', ')}`);
  }

  const payload = {
    generated_at: new Date().toISOString(),
    vocabularies: {
      food: vocab.food,
      theme: vocab.theme,
      course: vocab.course,
    },
    lemma_counts: {
      food: Object.keys(maps.food).length,
      theme: Object.keys(maps.theme).length,
      course: Object.keys(maps.course).length,
    },
    maps,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2));
  console.log(`\nWrote lemmas → ${OUTPUT_PATH}`);
  console.log(`  food: ${payload.lemma_counts.food}, theme: ${payload.lemma_counts.theme}, course: ${payload.lemma_counts.course}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
