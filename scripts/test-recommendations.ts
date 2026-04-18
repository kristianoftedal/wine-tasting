#!/usr/bin/env npx tsx
/**
 * End-to-end test of findSimilarWinesSQL after the scoring rewrite
 * (per-wine embeddings + null-skip) and the SQL migration 014
 * (no more unused params, NULL category now means "no filter",
 *  sparse-metadata wines allowed through).
 *
 * Runs three cases for the target user:
 *   - Rødvin
 *   - Hvitvin
 *   - No filter (was broken — returned zero rows before migration 014)
 *
 * For each case, prints the six attribute sub-scores per wine plus the
 * total, then a spread summary (min / max / mean / stdev). The whole
 * point of the rewrite was to restore score variance across candidates,
 * so watching the spread is the acceptance criterion.
 *
 *   npx tsx scripts/test-recommendations.ts
 */
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local' });
dotenvConfig();

import { createClient } from '@supabase/supabase-js';
import { findSimilarWinesSQL } from '../src/actions/wine-recommendations-sql';
import { DEFAULT_THRESHOLDS, DEFAULT_WEIGHTS } from '../src/lib/recommendation-types';

const EMAIL = 'oftedal.kristian@gmail.com';

function stats(xs: number[]) {
  if (!xs.length) return { n: 0, min: 0, max: 0, mean: 0, stdev: 0 };
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length;
  return { n: xs.length, min: Math.min(...xs), max: Math.max(...xs), mean, stdev: Math.sqrt(variance) };
}

function fmt(n: number | null): string {
  return n === null ? ' —— ' : n.toFixed(0).padStart(4);
}

async function runCase(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  label: string,
  category?: 'Rødvin' | 'Hvitvin' | 'Musserende vin'
) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`CASE: ${label}${category ? ` (category=${category})` : ' (no category filter)'}`);
  console.log('='.repeat(80));

  const started = Date.now();
  const { scores } = await findSimilarWinesSQL(
    userId,
    10,
    DEFAULT_WEIGHTS,
    DEFAULT_THRESHOLDS,
    category,
    false,
    supabase
  );
  const ms = Date.now() - started;

  if (scores.length === 0) {
    console.log(`No recommendations (${ms}ms). This is a red flag if you have karakter>=8 tastings in scope.`);
    return;
  }

  console.log(`Returned ${scores.length} wines in ${ms}ms.\n`);
  const header = 'name                                           fyld  fris  snær  sødm  lukt  smak  TOTAL';
  console.log(header);
  console.log('-'.repeat(header.length));
  for (const s of scores) {
    const name = (s.wine.name || '').slice(0, 46).padEnd(46);
    const a = s.attributeScores;
    console.log(
      `${name}  ${fmt(a.fylde)}  ${fmt(a.friskhet)}  ${fmt(a.snaerp)}  ${fmt(a.sodme)}  ${fmt(a.smell)}  ${fmt(a.taste)}  ${fmt(s.similarityScore)}`
    );
  }

  const totals = scores.map(s => s.similarityScore);
  const st = stats(totals);
  console.log(`\nTotal spread: min=${st.min.toFixed(1)}  max=${st.max.toFixed(1)}  mean=${st.mean.toFixed(1)}  stdev=${st.stdev.toFixed(2)}  range=${(st.max - st.min).toFixed(1)}`);

  // Verdict heuristic: if stdev < 2 across 10 wines, scores are still flat.
  if (st.stdev < 2 && scores.length >= 5) {
    console.log('⚠  stdev is low — rankings may still be clustering. Investigate.');
  } else if (st.max - st.min < 5 && scores.length >= 5) {
    console.log('⚠  range is narrow — spread is present but compressed.');
  } else {
    console.log('✓  scores show real spread.');
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing Supabase env vars');
    process.exit(1);
  }
  const supabase = createClient(url, key);

  const { data: profile, error } = await supabase.from('profiles').select('id, email, name').eq('email', EMAIL).single();
  if (error || !profile) {
    console.error('Profile lookup failed:', error?.message);
    process.exit(1);
  }
  console.log(`User: ${profile.name} <${profile.email}>`);
  console.log(`Using DEFAULT_WEIGHTS and DEFAULT_THRESHOLDS (karakter>=${DEFAULT_THRESHOLDS.minKarakter}, candidates=${DEFAULT_THRESHOLDS.candidateLimit})`);

  // Cast past generic-arity mismatch between the service-role client here
  // and the SSR client shape the action's type expects — they're the same
  // runtime object, only the type parameters differ.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  await runCase(client, profile.id, 'Red wines', 'Rødvin');
  await runCase(client, profile.id, 'White wines', 'Hvitvin');
  await runCase(client, profile.id, 'All categories');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
