#!/usr/bin/env npx tsx
/**
 * Wine search benchmark.
 *
 * Compares our search_wines_fuzzy RPC against Vinmonopolet's own product
 * search (the SAP Commerce endpoint their site uses) on an identical query
 * set, so we have a real latency target rather than a guess.
 *
 * Usage:
 *   npx tsx scripts/benchmark-search.ts            # both engines
 *   npx tsx scripts/benchmark-search.ts --ours     # our RPC only
 *   npx tsx scripts/benchmark-search.ts --vmp      # Vinmonopolet only
 *
 * Caveats worth remembering when reading the numbers:
 *  - Both are measured over the public internet from this machine, so both
 *    include RTT. Neither number is a pure server-side query time.
 *  - Vinmonopolet's endpoint sits behind a CDN and only indexes products they
 *    currently list; our table has 50k rows including delisted vintages. A
 *    zero-result there is a catalogue difference, not a search defect.
 *  - Their endpoint returns HTTP 429 above roughly one request per second, so
 *    VMP runs are throttled and retried. Throttle/retry waiting is excluded
 *    from the reported latency, and errored runs are excluded entirely -- a
 *    fast failure is not a fast search.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { createClient } from '@supabase/supabase-js';

const REPEATS_OURS = 3;
const REPEATS_VMP = 2;   // be a polite guest: their endpoint rate-limits hard
const VMP_DELAY_MS = 900; // spacing between Vinmonopolet requests
const LIMIT = 20;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

const sb = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Fold to compare names across engines without tripping on accents. */
const fold = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/æ/gi, 'ae').replace(/ø/gi, 'o').replace(/å/gi, 'a')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

type Case = { q: string; expect: string; kind: 'exact-name' | 'partial' | 'id' };

/** 20 real wine names pulled from the wines table. */
const EXACT_NAMES = [
  'André Clouet Rosé',
  'André Clouet Dream Vintage 2014',
  'Étienne Calsac Clos Maladries Extra Brut 2014',
  'Ellena Giuseppe Barolo',
  'Fedellos do Couto Conasbrancas 2017',
  'Wageck Kalkmergel Chardonnay 2021',
  'Fanny Sabre Beaune Clos des Renardes 2020',
  'Gamle Tårnhuset Sablières 2015',
  'Ten. Scerscé Essenza Valtellina Superiore',
  'Pierre Chavin Côtes de Gascogne',
  'Dom. Castell-Reynoard Coeur de vigne',
  'M. Chapoutier Hermitage Chante-Alouette 2021',
  'Freixenet Prosecco Extra Dry Mini',
  'Welmoed Rosé 2018',
  'Cascas Lisboa Vinho Branco',
  'Julien de Savignac Lisa',
  'Fratelli Viticultori Langhe Rosso 2021',
  'Smak av Telemark',
  'Ruby White',
  'Ellena Giuseppe Langhe Nebbiolo',
];

/** What a user actually types on the way to those wines. */
const PARTIALS: Case[] = [
  { q: 'andre clouet',      expect: 'andre clouet',      kind: 'partial' },
  { q: 'clouet',            expect: 'clouet',            kind: 'partial' },
  { q: 'André Clouet',      expect: 'andre clouet',      kind: 'partial' },
  { q: 'andre clouett',     expect: 'andre clouet',      kind: 'partial' },
  { q: 'etienne calsac',    expect: 'etienne calsac',    kind: 'partial' },
  { q: 'ellena giuseppe',   expect: 'ellena giuseppe',   kind: 'partial' },
  { q: 'gamle tarnhuset',   expect: 'gamle tarnhuset',   kind: 'partial' },
  { q: 'chante-alouette',   expect: 'chante alouette',   kind: 'partial' },
  { q: 'cotes de gascogne', expect: 'cotes de gascogne', kind: 'partial' },
  { q: 'castell reynoard',  expect: 'castell reynoard',  kind: 'partial' },
  { q: 'scerse',            expect: 'scersce',           kind: 'partial' },
  { q: 'freixenet prosecco',expect: 'freixenet prosecco',kind: 'partial' },
  { q: 'kalkmergel',        expect: 'kalkmergel',        kind: 'partial' },
  { q: 'fanny sabre',       expect: 'fanny sabre',       kind: 'partial' },
  { q: 'barolo',            expect: 'barolo',            kind: 'partial' },
  { q: 'sancerre',          expect: 'sancerre',          kind: 'partial' },
  { q: 'amarone',           expect: 'amarone',           kind: 'partial' },
  { q: 'chardonnay',        expect: 'chardonnay',        kind: 'partial' },
  { q: '10902101',          expect: '10902101',          kind: 'id' },
  { q: '12784001',          expect: '12784001',          kind: 'id' },
];

const CASES: Case[] = [
  ...EXACT_NAMES.map(n => ({ q: n, expect: fold(n), kind: 'exact-name' as const })),
  ...PARTIALS,
];

type Hit = { code: string; name: string };
type Run = { ms: number; hits: Hit[]; error?: string };

async function runOurs(q: string): Promise<Run> {
  const t0 = performance.now();
  const { data, error } = await sb.rpc('search_wines_fuzzy', { search_query: q, result_limit: LIMIT });
  const ms = performance.now() - t0;
  if (error) return { ms, hits: [], error: error.message };
  return { ms, hits: (data ?? []).map((d: { product_id: string; name: string }) => ({ code: d.product_id, name: d.name })) };
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function runVmp(q: string): Promise<Run> {
  const url = `https://www.vinmonopolet.no/vmpws/v2/vmp/products/search?query=${encodeURIComponent(q)}&pageSize=${LIMIT}&fields=FULL`;

  for (let attempt = 0; attempt < 4; attempt++) {
    const t0 = performance.now();
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
      const ms = performance.now() - t0;
      if (res.status === 429) {
        await sleep(2000 * (attempt + 1)); // back off, then retry; not counted
        continue;
      }
      if (!res.ok) return { ms, hits: [], error: `HTTP ${res.status}` };
      const json = await res.json();
      return { ms, hits: (json.products ?? []).map((p: { code: string; name: string }) => ({ code: p.code, name: p.name })) };
    } catch (e) {
      return { ms: performance.now() - t0, hits: [], error: String(e) };
    }
  }
  return { ms: NaN, hits: [], error: 'HTTP 429 (gave up after 4 attempts)' };
}

/** Did the intended wine come back, and at what rank? */
function rank(c: Case, hits: Hit[]): number {
  const idx = hits.findIndex(h =>
    c.kind === 'id' ? h.code === c.expect : fold(h.name).includes(c.expect)
  );
  return idx; // -1 = absent
}

const pct = (xs: number[], p: number) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

async function benchmark(label: string, run: (q: string) => Promise<Run>, repeats: number, delayMs = 0) {
  await run('warmup chardonnay'); // prime TLS + any server cache
  if (delayMs) await sleep(delayMs);

  const lat: number[] = [];
  const rows: { c: Case; r: Run; rk: number }[] = [];

  for (const c of CASES) {
    let best: Run | null = null;
    for (let i = 0; i < repeats; i++) {
      const r = await run(c.q);
      // A fast error is not a fast search -- keep failures out of the latency
      // distribution so the percentiles describe working queries only.
      if (!r.error) lat.push(r.ms);
      if (!best || (!r.error && (best.error || r.ms < best.ms))) best = r;
      if (delayMs) await sleep(delayMs);
    }
    rows.push({ c, r: best!, rk: rank(c, best!.hits) });
  }

  const errs = rows.filter(r => r.r.error).length;
  const empty = rows.filter(r => !r.r.error && r.r.hits.length === 0).length;
  const top1 = rows.filter(r => r.rk === 0).length;
  const top5 = rows.filter(r => r.rk >= 0 && r.rk < 5).length;
  const found = rows.filter(r => r.rk >= 0).length;

  console.log(`\n================ ${label} ================`);
  console.log(`latency   p50 ${pct(lat, 50).toFixed(0)}ms   p95 ${pct(lat, 95).toFixed(0)}ms   max ${Math.max(...lat).toFixed(0)}ms  (successful runs only, n=${lat.length})`);
  console.log(`accuracy  top1 ${top1}/${CASES.length}   top5 ${top5}/${CASES.length}   found-anywhere ${found}/${CASES.length}`);
  console.log(`failures  query errors ${errs}   zero-result ${empty}`);

  console.log('rank  ms    query                              top result');
  for (const { c, r, rk } of rows) {
    const mark = rk === 0 ? '  1 ' : rk > 0 ? `${String(rk + 1).padStart(3)} ` : r.error ? ' ERR' : ' ---';
    console.log(`${mark} ${r.ms.toFixed(0).padStart(5)}  ${c.q.slice(0, 34).padEnd(34)} ${r.error ?? r.hits[0]?.name ?? '(none)'}`);
  }
  return { lat, top1, found, errs, empty };
}

async function main() {
  const only = process.argv.slice(2);
  const doOurs = !only.includes('--vmp');
  const doVmp = !only.includes('--ours');

  const ours = doOurs ? await benchmark('OURS  (search_wines_fuzzy)', runOurs, REPEATS_OURS) : null;
  const vmp = doVmp ? await benchmark('VINMONOPOLET  (vmpws products/search)', runVmp, REPEATS_VMP, VMP_DELAY_MS) : null;

  if (ours && vmp) {
    console.log('\n================ VERDICT ================');
    console.log(`p50   ours ${pct(ours.lat, 50).toFixed(0)}ms  vs  vmp ${pct(vmp.lat, 50).toFixed(0)}ms`);
    console.log(`p95   ours ${pct(ours.lat, 95).toFixed(0)}ms  vs  vmp ${pct(vmp.lat, 95).toFixed(0)}ms`);
    console.log(`top1  ours ${ours.top1}/${CASES.length}      vs  vmp ${vmp.top1}/${CASES.length}`);
    console.log(`errors ours ${ours.errs}          vs  vmp ${vmp.errs}`);
  }
}

main();
