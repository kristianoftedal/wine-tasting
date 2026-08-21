#!/usr/bin/env npx tsx
/**
 * Validates scripts/021-search-overhaul.sql against a real PostgreSQL instance
 * before it is let anywhere near production.
 *
 * Pulls a sample of live rows out of Supabase (deliberately including the shapes
 * that broke the old function: "37,5 cl" volumes, NBSP-separated prices,
 * accented names, duplicate product_ids), loads them into a scratch local
 * database, applies the migration, and asserts on the results.
 *
 * Requires a local postgres on :5432. Usage:
 *   npx tsx scripts/verify-search-migration.ts          # ~7k row sample, fast
 *   npx tsx scripts/verify-search-migration.ts --full   # all 50k rows, real timings
 *
 * Timings printed at the end come from a single psql session with \timing on,
 * so they are server-side query time without process startup or network. They
 * are the closest honest predictor of production latency minus RTT.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const DB = 'wine_search_verify';
const psql = (sql: string, db = DB) =>
  execFileSync('psql', ['-d', db, '-v', 'ON_ERROR_STOP=1', '-qtAc', sql], { encoding: 'utf8' });
const psqlFile = (file: string, db = DB) =>
  execFileSync('psql', ['-d', db, '-v', 'ON_ERROR_STOP=1', '-f', file], { encoding: 'utf8' });

const sb = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Row = Record<string, unknown>;

const COLS = 'id, product_id, name, year, volume, price, main_category, main_country, main_producer, district, sub_district, grapes, is_good_for, search_text';

/** Every row, paginated — PostgREST caps a single response at 1000. */
async function fetchAll(): Promise<Row[]> {
  const rows: Row[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await sb.from('wines').select(COLS).order('id').range(from, from + page - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < page) break;
    if (from % 10000 === 0) process.stdout.write(`  ${rows.length}\r`);
  }
  return rows;
}

async function fetchFixture(): Promise<Row[]> {
  const cols = COLS;
  const rows: Row[] = [];

  // Everything from the producer that exposed the bug.
  const { data: clouet } = await sb.from('wines').select(cols).ilike('name', '%clouet%');
  rows.push(...(clouet ?? []));

  // The half-bottles whose "37,5 cl" volume crashed the NUMERIC cast.
  const { data: halves } = await sb.from('wines').select(cols).like('volume', '%,%').limit(400);
  rows.push(...(halves ?? []));

  // A general slice for realistic ranking and timing.
  const { data: bulk } = await sb.from('wines').select(cols).limit(6000);
  rows.push(...(bulk ?? []));

  // Named wines the benchmark asserts on, so they are certain to be present.
  for (const term of ['Étienne Calsac', 'Ellena Giuseppe', 'Gamle Tårnhuset', 'Scerscé', 'Pierre Chavin',
                      'Castell-Reynoard', 'Chante-Alouette', 'Freixenet Prosecco', 'Welmoed', 'Cascas Lisboa',
                      'Julien de Savignac', 'Fratelli Viticultori', 'Smak av Telemark', 'Ruby White',
                      'Fedellos', 'Wageck', 'Fanny Sabre', 'Barolo', 'Sancerre', 'Amarone', 'Chardonnay']) {
    const { data } = await sb.from('wines').select(cols).ilike('name', `%${term}%`).limit(60);
    rows.push(...(data ?? []));
  }

  const byId = new Map<string, Row>();
  for (const r of rows) byId.set(String(r.id), r);
  return [...byId.values()];
}

function setupSchema() {
  try { execFileSync('dropdb', ['--if-exists', DB], { stdio: 'ignore' }); } catch {}
  execFileSync('createdb', [DB]);
  // Mirrors the LIVE table shape, which is flat TEXT plus two JSON arrays --
  // not the `content` JSONB shape described in scripts/schema.sql.
  psql(`
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE TABLE wines (
      id            UUID PRIMARY KEY,
      product_id    TEXT,
      name          TEXT NOT NULL,
      year          TEXT,
      volume        TEXT,
      price         TEXT,
      main_category TEXT,
      main_country  TEXT,
      main_producer TEXT,
      district      TEXT,
      sub_district  TEXT,
      grapes        JSONB,
      is_good_for   JSONB,
      search_text   TEXT
    );
  `);
}

function load(rows: Row[]) {
  const cols = ['id','product_id','name','year','volume','price','main_category','main_country','main_producer','district','sub_district','grapes','is_good_for','search_text'];
  const tsv = rows.map(r => cols.map(c => {
    const v = r[c];
    if (v === null || v === undefined) return '\\N';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return s.replace(/\\/g, '\\\\').replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
  }).join('\t')).join('\n');

  writeFileSync('/tmp/wines-fixture.tsv', tsv);
  execFileSync('psql', ['-d', DB, '-v', 'ON_ERROR_STOP=1', '-c',
    `\\copy wines (${cols.join(',')}) FROM '/tmp/wines-fixture.tsv' WITH (FORMAT text, NULL '\\N')`],
    { encoding: 'utf8' });
}

type Check = { label: string; sql: string; assert: (out: string) => boolean; expect: string };

const CHECKS: Check[] = [
  { label: 'wine_fold strips accents',
    sql: `SELECT wine_fold('André Clouet Rosé')`,
    expect: 'andre clouet rose', assert: o => o === 'andre clouet rose' },
  { label: 'wine_fold folds UPPERCASE accents (collation-independent)',
    sql: `SELECT wine_fold('ÉTIENNE CALSAC CÔTES')`,
    expect: 'etienne calsac cotes', assert: o => o === 'etienne calsac cotes' },
  { label: 'wine_fold folds Norwegian ø/å/æ',
    sql: `SELECT wine_fold('Gamle Tårnhuset Rødvin Ærlig')`,
    expect: 'gamle tarnhuset rodvin aerlig', assert: o => o === 'gamle tarnhuset rodvin aerlig' },
  { label: 'wine_fold is idempotent',
    sql: `SELECT wine_fold(wine_fold('André Clouet Rosé')) = wine_fold('André Clouet Rosé')`,
    expect: 't', assert: o => o === 't' },
  { label: 'volume "37,5 cl" parses instead of crashing',
    sql: `SELECT wine_parse_amount('37,5 cl')`,
    expect: '37.5', assert: o => o === '37.5' },
  { label: 'price with NBSP parses (was always NULL)',
    sql: `SELECT wine_parse_amount('Kr 519,90')`,
    expect: '519.90', assert: o => o === '519.90' },
  { label: 'price with NBSP thousands separator is not truncated to 1',
    sql: `SELECT wine_parse_amount('Kr 1 224,90')`,
    expect: '1224.90', assert: o => o === '1224.90' },
  { label: 'wine_parse_amount cannot throw on garbage',
    sql: `SELECT coalesce(wine_parse_amount('n/a')::text, 'NULL')`,
    expect: 'NULL', assert: o => o === 'NULL' },
  { label: 'no NULL price_nok remains for priced rows',
    sql: `SELECT count(*) FROM wines WHERE price IS NOT NULL AND price_nok IS NULL`,
    expect: '0', assert: o => o === '0' },
  { label: 'no NULL volume_cl remains for sized rows',
    sql: `SELECT count(*) FROM wines WHERE volume IS NOT NULL AND volume_cl IS NULL`,
    expect: '0', assert: o => o === '0' },
  { label: '"andre clouet" finds André Clouet (the reported bug)',
    sql: `SELECT name FROM search_wines_fuzzy('andre clouet', 5) LIMIT 1`,
    expect: 'André Clouet…', assert: o => o.toLowerCase().includes('clouet') },
  { label: '"clouet" alone finds André Clouet',
    sql: `SELECT name FROM search_wines_fuzzy('clouet', 5) LIMIT 1`,
    expect: 'André Clouet…', assert: o => o.toLowerCase().includes('clouet') },
  { label: 'typo "andre clouett" still finds it',
    sql: `SELECT name FROM search_wines_fuzzy('andre clouett', 5) LIMIT 1`,
    expect: 'André Clouet…', assert: o => o.toLowerCase().includes('clouet') },
  { label: 'product id search works (UI promises "navn eller ID")',
    sql: `SELECT product_id FROM search_wines_fuzzy('10902101', 3) LIMIT 1`,
    expect: '10902101', assert: o => o === '10902101' },
  { label: 'half-bottle results return a volume instead of erroring',
    sql: `SELECT count(*) FROM search_wines_fuzzy('riesling', 20) WHERE volume IS NOT NULL`,
    expect: '> 0', assert: o => Number(o) > 0 },
  { label: 'price comes back populated, not NULL',
    sql: `SELECT count(*) FROM search_wines_fuzzy('clouet', 20) WHERE price IS NOT NULL`,
    expect: '> 0', assert: o => Number(o) > 0 },
  { label: 'exact name outranks partial matches',
    sql: `SELECT name FROM search_wines_fuzzy('Ellena Giuseppe Barolo', 5) LIMIT 1`,
    expect: 'Ellena Giuseppe Barolo', assert: o => o === 'Ellena Giuseppe Barolo' },
  { label: 'duplicate (product_id, year) rows are collapsed',
    sql: `SELECT count(*) - count(DISTINCT (product_id, coalesce(year,''))) FROM search_wines_fuzzy('clouet', 20)`,
    expect: '0', assert: o => o === '0' },
  { label: 'district match works (not just name)',
    sql: `SELECT count(*) FROM search_wines_fuzzy('champagne', 20)`,
    expect: '> 0', assert: o => Number(o) > 0 },
  { label: 'grape match works (never did before)',
    sql: `SELECT count(*) FROM search_wines_fuzzy('riesling', 20)`,
    expect: '> 0', assert: o => Number(o) > 0 },
  { label: 'search_meta carries grapes',
    sql: `SELECT count(*) FROM wines WHERE grapes IS NOT NULL AND search_meta NOT LIKE '%' || wine_fold((grapes->>0)) || '%'`,
    expect: '0', assert: o => o === '0' },
  { label: 'prose is NOT searchable from typeahead (kept out of search_meta)',
    sql: `SELECT count(*) FROM wines WHERE search_meta LIKE '%passer til%'`,
    expect: '0', assert: o => o === '0' },
  { label: 'no query in the suite errors',
    sql: `SELECT count(*) FROM (
            SELECT search_wines_fuzzy(q, 20) FROM unnest(ARRAY[
              'and','andr','andre','andre c','andre cl','andre clouet','clouet','bar','barolo',
              'chardonnay','champagne','sancerre','amarone','riesling','brut','2019','rose',
              'gamle tarnhuset','cotes de gascogne','scerse','ruby white','smak av telemark'
            ]) q) t`,
    expect: 'no exception', assert: o => Number(o) >= 0 }
];

/**
 * Server-side query time, measured inside one psql session so neither process
 * startup (~45ms) nor a network round trip is counted.
 */
function timings(rowCount: string) {
  const queries = [
    'and', 'andre', 'andre clouet', 'clouet', 'andre clouett', 'barolo', 'chardonnay',
    'champagne', 'riesling', 'sancerre', 'gamle tarnhuset', 'cotes de gascogne',
    'ellena giuseppe barolo', '10902101', 'rose', 'brut'
  ];
  const script = [
    '\\timing on',
    'SET jit = off;',
    // Warm the cache so we measure steady state, not first-touch disk reads.
    ...queries.map(q => `SELECT count(*) FROM search_wines_fuzzy('${q}', 20);`),
    ...queries.map(q => `SELECT count(*) FROM search_wines_fuzzy('${q}', 20);`)
  ].join('\n');

  const out = execFileSync('psql', ['-d', DB, '-v', 'ON_ERROR_STOP=1', '-q'], {
    encoding: 'utf8',
    input: script
  });

  // psql prints "Time: 13,299 ms" under a comma-decimal locale -- the same
  // formatting difference that broke the old search function.
  const times = [...out.matchAll(/Time: ([\d.,]+) ms/g)].map(m => Number(m[1].replace(',', '.')));
  const warm = times.slice(queries.length); // second pass only
  console.log(`\nServer-side query time over ${rowCount} rows (warm, no network):`);
  queries.forEach((q, i) => {
    if (warm[i] !== undefined) console.log(`  ${warm[i].toFixed(1).padStart(7)}ms  "${q}"`);
  });
  const sorted = [...warm].sort((a, b) => a - b);
  if (sorted.length) {
    console.log(`  p50 ${sorted[Math.floor(sorted.length / 2)].toFixed(1)}ms   p95 ${sorted[Math.floor(sorted.length * 0.95)].toFixed(1)}ms   max ${sorted[sorted.length - 1].toFixed(1)}ms`);
  }
}

async function main() {
  const full = process.argv.includes('--full');
  console.log(full ? 'Fetching ALL rows from Supabase...' : 'Fetching fixture rows from Supabase...');
  const rows = full ? await fetchAll() : await fetchFixture();
  console.log(`  ${rows.length} rows`);

  console.log('Creating scratch database + schema...');
  setupSchema();
  load(rows);
  console.log(`  loaded ${psql('SELECT count(*) FROM wines').trim()} rows`);

  console.log('Applying scripts/021-search-overhaul.sql...');
  const out = psqlFile('scripts/021-search-overhaul.sql');
  console.log(out.split('\n').filter(l => /ERROR|WARNING/.test(l)).join('\n') || '  applied cleanly');

  console.log('\nChecks:');
  let failed = 0;
  for (const c of CHECKS) {
    let got: string;
    try {
      got = psql(c.sql).trim();
    } catch (e) {
      got = `EXCEPTION: ${String((e as { stderr?: Buffer }).stderr ?? e).split('\n')[0]}`;
    }
    const ok = (() => { try { return c.assert(got); } catch { return false; } })();
    if (!ok) failed++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${c.label}`);
    if (!ok) console.log(`        expected ${c.expect}, got "${got}"`);
  }

  timings(psql('SELECT count(*) FROM wines').trim());

  console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`}`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
