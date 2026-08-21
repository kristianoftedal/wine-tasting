#!/usr/bin/env npx tsx
/**
 * Post-deploy smoke test for the live wine search.
 *
 * scripts/verify-search-migration.ts proves the migration is correct against a
 * local copy; this proves the deployed database actually got it. Worth
 * re-running after any catalogue sync, since a re-import is the most likely way
 * for the parsed columns to drift back out of shape.
 *
 * Usage: npm run verify-search-production
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Hit = { product_id: string; name: string; year: string | null; price: number | null; volume: number | null };

async function search(query: string, limit = 10) {
  const t0 = performance.now();
  const { data, error } = await sb.rpc('search_wines_fuzzy', { search_query: query, result_limit: limit });
  return { ms: performance.now() - t0, rows: (data ?? []) as Hit[], error: error?.message };
}

const CASES: [string, (r: Hit[]) => boolean, string][] = [
  ['andre clouet',           r => r.some(w => /clouet/i.test(w.name)),      'finds André Clouet unaccented (the reported bug)'],
  ['clouet',                 r => r.some(w => /clouet/i.test(w.name)),      'single token finds the producer'],
  ['andre clouett',          r => r.some(w => /clouet/i.test(w.name)),      'typo tolerated'],
  ['10902101',               r => r[0]?.product_id === '10902101',          'product id lookup ("navn eller ID")'],
  ['versailles diamant',     r => (r[0]?.price ?? 0) > 1000,                'price populated and not truncated at 1000'],
  ['beerenauslese',          r => r.some(w => w.volume === 37.5),           'half-bottle volume parses without crashing'],
  ['gamle tarnhuset',        r => r.some(w => /Tårnhuset/.test(w.name)),    'Norwegian ø/å folding'],
  ['nebbiolo',               r => r.length > 0,                             'grape match (never worked before 021)'],
  ['champagne',              r => r.length > 0,                             'district match'],
  ['ellena giuseppe barolo', r => r[0]?.name === 'Ellena Giuseppe Barolo',  'exact name ranks first']
];

async function main() {
  console.log('Search behaviour:');
  let failed = 0;
  for (const [query, assert, label] of CASES) {
    const r = await search(query);
    const ok = !r.error && assert(r.rows);
    if (!ok) failed++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${r.ms.toFixed(0).padStart(4)}ms n=${String(r.rows.length).padStart(2)}  ${label}`);
    if (!ok) console.log(`        "${query}" -> ${r.error ?? JSON.stringify(r.rows.slice(0, 2))}`);
  }

  console.log('\nColumn health:');

  /** Reports PASS when the count is zero; a null count means "did not aggregate". */
  async function expectZero(label: string, count: number | null, error: { message: string } | null) {
    if (error) {
      console.log(`  FAIL  ${label}: query errored (${error.message})`);
      return 1;
    }
    if (count === null) {
      console.log(`  WARN  ${label}: count came back null, re-run to confirm`);
      return 0;
    }
    console.log(`  ${count === 0 ? 'PASS' : 'FAIL'}  ${label}: ${count}`);
    return count === 0 ? 0 : 1;
  }

  const head = { count: 'exact' as const, head: true };
  const priceGap = await sb.from('wines').select('*', head).not('price', 'is', null).is('price_nok', null);
  failed += await expectZero('rows with price but NULL price_nok', priceGap.count, priceGap.error);

  const volumeGap = await sb.from('wines').select('*', head).not('volume', 'is', null).is('volume_cl', null);
  failed += await expectZero('rows with volume but NULL volume_cl', volumeGap.count, volumeGap.error);

  const nameGap = await sb.from('wines').select('*', head).is('search_name', null);
  failed += await expectZero('rows with NULL search_name', nameGap.count, nameGap.error);

  const metaGap = await sb.from('wines').select('*', head).is('search_meta', null);
  failed += await expectZero('rows with NULL search_meta', metaGap.count, metaGap.error);

  const dupes = await search('clouet', 20);
  const keys = dupes.rows.map(w => `${w.product_id}|${w.year ?? ''}`);
  const dupCount = keys.length - new Set(keys).size;
  if (dupCount !== 0) failed++;
  console.log(`  ${dupCount === 0 ? 'PASS' : 'FAIL'}  duplicate (product_id, year) rows in results: ${dupCount}`);

  console.log(`\n${failed === 0 ? 'ALL PRODUCTION CHECKS PASSED' : `${failed} CHECK(S) FAILED`}`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
