#!/usr/bin/env npx tsx
/**
 * Search latency on a random sample: our search_wines_fuzzy RPC against
 * Vinmonopolet's product search, written out as an HTML table for a slide.
 *
 * scripts/benchmark-search.ts uses 40 hand-picked queries; a hand-picked set
 * invites the objection that the queries flatter one side. Here the queries
 * are the full names of N wines drawn at random from the wines table, with a
 * seeded sampler so a rerun on the same catalogue draws the same wines.
 *
 * By default a wine Vinmonopolet does not return in its top 20 is replaced
 * by a fresh draw (one probe request, not counted in latency), so every row is
 * a wine both engines can find. Without that, about half the sample is
 * delisted vintages, and an empty result is not the same query as a hit.
 * --any keeps every draw.
 *
 * Per wine, the two engines run back to back (ours first, then theirs), so
 * both see the same network conditions instead of one engine getting a quiet
 * minute and the other a busy one.
 *
 * The caveats from benchmark-search.ts apply unchanged:
 *  - Both are measured over the public internet from this machine, so both
 *    include RTT. Neither number is a pure server-side query time.
 *  - Vinmonopolet only indexes products they currently list; our table holds
 *    delisted vintages too. "Fant vinen" on their side is therefore partly a
 *    catalogue difference, not a search defect — the table says so.
 *  - Their endpoint returns HTTP 429 above roughly one request per second.
 *    Throttle/retry waiting is excluded from latency, and errored runs are
 *    excluded entirely — a fast failure is not a fast search.
 *
 * Usage:
 *   npx tsx scripts/benchmark-search-random.ts                 # 100 wines
 *   npx tsx scripts/benchmark-search-random.ts --n=50 --seed=7 --out=x.html
 *   npx tsx scripts/benchmark-search-random.ts --any            # keep wines VMP lacks
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const arg = (name: string, fallback: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;

const N = Number(arg('n', '100'));
const SEED = Number(arg('seed', '20261115'));
const OUT = arg('out', 'search-speed-table.html');
const REQUIRE_VMP = !process.argv.includes('--any');

const REPEATS_OURS = 3;
const REPEATS_VMP = 2; // be a polite guest: their endpoint rate-limits hard
const VMP_DELAY_MS = 900;
const LIMIT = 20;
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

const sb = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

type Run = { ms: number; codes: string[]; error?: string };

async function runOurs(q: string): Promise<Run> {
  const t0 = performance.now();
  const { data, error } = await sb.rpc('search_wines_fuzzy', { search_query: q, result_limit: LIMIT });
  const ms = performance.now() - t0;
  if (error) return { ms, codes: [], error: error.message };
  return { ms, codes: (data ?? []).map((d: { product_id: string }) => d.product_id) };
}

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
      if (!res.ok) return { ms, codes: [], error: `HTTP ${res.status}` };
      const json = await res.json();
      return { ms, codes: (json.products ?? []).map((p: { code: string }) => p.code) };
    } catch (e) {
      return { ms: performance.now() - t0, codes: [], error: String(e) };
    }
  }
  return { ms: NaN, codes: [], error: 'HTTP 429 (gave up after 4 attempts)' };
}

/** Deterministic sampler — no Math.random, so runs are comparable. Never repeats a row. */
async function* drawWines(): AsyncGenerator<{ product_id: string; name: string }> {
  const { count, error } = await sb.from('wines').select('id', { count: 'exact', head: true });
  if (error || !count) throw new Error(`could not count wines: ${error?.message}`);

  let seed = SEED;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const seen = new Set<number>();
  while (seen.size < count) {
    const o = Math.floor(rnd() * count);
    if (seen.has(o)) continue;
    seen.add(o);
    // Ordered: PostgREST guarantees no ordering without it, so an offset
    // would not name the same row twice.
    const { data } = await sb.from('wines').select('product_id, name').order('id').range(o, o);
    const w = data?.[0];
    if (w?.name && w.product_id) yield w;
  }
}

type Measured = { runs: Run[]; ms: number; rank: number; error?: string };

async function measure(q: string, code: string, run: (q: string) => Promise<Run>, repeats: number, delayMs: number) {
  const runs: Run[] = [];
  for (let i = 0; i < repeats; i++) {
    runs.push(await run(q));
    if (delayMs) await sleep(delayMs);
  }
  const ok = runs.filter(r => !r.error);
  const ms = ok.length ? ok.reduce((s, r) => s + r.ms, 0) / ok.length : NaN;
  const rank = ok.length ? ok[0].codes.indexOf(code) : -1;
  return { runs, ms, rank, error: ok.length ? undefined : runs[0]?.error } satisfies Measured;
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

function summarise(rows: Measured[]) {
  const lat = rows.flatMap(r => r.runs.filter(x => !x.error).map(x => x.ms));
  return {
    mean: mean(lat),
    p50: pct(lat, 50),
    p95: pct(lat, 95),
    found: rows.filter(r => r.rank >= 0).length,
    top1: rows.filter(r => r.rank === 0).length,
    errors: rows.filter(r => r.error).length,
    n: lat.length
  };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmt = (ms: number) => (Number.isFinite(ms) ? `${Math.round(ms).toLocaleString('nb-NO')} ms` : '–');

function html(
  wines: { product_id: string; name: string }[],
  ours: Measured[],
  vmp: Measured[],
  date: string,
  replaced: number
) {
  const a = summarise(ours);
  const b = summarise(vmp);
  const both = wines.map((_, i) => i).filter(i => Number.isFinite(ours[i].ms) && Number.isFinite(vmp[i].ms));
  const oursWins = both.filter(i => ours[i].ms < vmp[i].ms).length;
  const factor = b.mean / a.mean;
  const winner = a.mean < b.mean ? 'Smak Vin' : 'Vinmonopolet';
  const faster = (x: number, y: number) => (x < y ? ' class="win"' : '');

  const summaryRows: [string, string, string, boolean | null][] = [
    ['Snitt responstid', fmt(a.mean), fmt(b.mean), a.mean < b.mean],
    ['Median (p50)', fmt(a.p50), fmt(b.p50), a.p50 < b.p50],
    ['95-persentil (p95)', fmt(a.p95), fmt(b.p95), a.p95 < b.p95],
    ['Raskest per vin', `${oursWins} av ${both.length}`, `${both.length - oursWins} av ${both.length}`, oursWins * 2 > both.length],
    ['Fant vinen (topp 20)', `${a.found} av ${wines.length}`, `${b.found} av ${wines.length}`, null]
  ];

  const detail = wines
    .map(
      (w, i) => `<tr><td class="num">${i + 1}</td><td>${esc(w.name)}</td>` +
        `<td class="num"${faster(ours[i].ms, vmp[i].ms)}>${ours[i].error ? 'feil' : fmt(ours[i].ms)}</td>` +
        `<td class="num"${faster(vmp[i].ms, ours[i].ms)}>${vmp[i].error ? 'feil' : fmt(vmp[i].ms)}</td></tr>`
    )
    .join('\n');

  return `<!doctype html>
<html lang="no"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Søkehastighet</title>
<style>
  :root { --ink:#2b2b2b; --muted:#6b6b6b; --rule:#ddd6d0; --panel:#faf7f4; --wine:#7b1e3a; --win:#e9f3ec; --winInk:#1f6b3a; --bg:#fff; }
  * { box-sizing:border-box; }
  body { margin:0; padding:48px 16px; background:var(--bg); color:var(--ink);
         font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  .slide { max-width:1100px; margin:0 auto; }
  h1 { font-size:34px; margin:0 0 6px; letter-spacing:-.4px; }
  .lede { color:var(--muted); font-size:18px; margin:0 0 28px; }
  .lede b { color:var(--wine); }
  table { width:100%; border-collapse:collapse; font-variant-numeric:tabular-nums; }
  th, td { padding:14px 18px; border-bottom:1px solid var(--rule); text-align:left; }
  thead th { font-size:14px; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); font-weight:600; }
  thead th.ours { color:var(--wine); }
  .summary td { font-size:22px; }
  .summary td:first-child { color:var(--muted); font-size:18px; }
  .num { text-align:right; white-space:nowrap; }
  td.win { background:var(--win); color:var(--winInk); font-weight:650; }
  .note { color:var(--muted); font-size:13px; line-height:1.5; margin-top:18px; }
  details { margin-top:40px; }
  summary { cursor:pointer; color:var(--muted); font-size:15px; }
  .detail td { font-size:14px; padding:6px 12px; }
  @media (max-width:640px) { .summary td { font-size:16px; } h1 { font-size:26px; } th, td { padding:10px 8px; } }
</style></head>
<body><div class="slide">
  <h1>Søkehastighet: Smak Vin mot Vinmonopolet</h1>
  <p class="lede">${wines.length} tilfeldige viner, søkt på fullt navn. <b>${winner}</b> er raskest i snitt — ${
    factor >= 1 ? `${factor.toFixed(1)}× raskere enn Vinmonopolet` : `${(1 / factor).toFixed(1)}× raskere enn Smak Vin`
  }.</p>
  <table class="summary">
    <thead><tr><th></th><th class="num ours">Smak Vin</th><th class="num">Vinmonopolet</th></tr></thead>
    <tbody>
${summaryRows
  .map(
    ([label, x, y, oursBetter]) =>
      `      <tr><td>${label}</td><td class="num${oursBetter === true ? ' win' : ''}">${x}</td>` +
      `<td class="num${oursBetter === false ? ' win' : ''}">${y}</td></tr>`
  )
  .join('\n')}
    </tbody>
  </table>
  <p class="note">
    Målt ${date} fra samme maskin over offentlig internett; begge tall inkluderer nettverkstid.
    Smak Vin: ${REPEATS_OURS} søk per vin (n=${a.n}), Vinmonopolet: ${REPEATS_VMP} søk per vin (n=${b.n}), kjørt etter hverandre per vin.
    ${
      REQUIRE_VMP
        ? `Bare viner Vinmonopolet fører er med: ${replaced} trukne viner som Vinmonopolet ikke fant, ble byttet ut med en ny tilfeldig vin.`
        : `Vinmonopolet indekserer bare varer de fører i dag, mens utvalget er trukket fra hele katalogen inkludert utgåtte årganger —
    «fant vinen» er derfor delvis en forskjell i sortiment, ikke i søket.`
    }${b.errors ? ` ${b.errors} viner ga feil hos Vinmonopolet og er holdt utenfor tidene.` : ''}
  </p>
  <details>
    <summary>Alle ${wines.length} viner</summary>
    <table class="detail">
      <thead><tr><th class="num">#</th><th>Vin</th><th class="num ours">Smak Vin</th><th class="num">Vinmonopolet</th></tr></thead>
      <tbody>
${detail}
      </tbody>
    </table>
  </details>
</div></body></html>
`;
}

async function main() {
  await runOurs('warmup chardonnay'); // prime TLS + any server cache
  await runVmp('warmup chardonnay');
  await sleep(VMP_DELAY_MS);

  const wines: { product_id: string; name: string }[] = [];
  const ours: Measured[] = [];
  const vmp: Measured[] = [];
  let replaced = 0;
  for await (const w of drawWines()) {
    if (wines.length >= N) break;
    if (REQUIRE_VMP) {
      const probe = await runVmp(w.name); // not counted: it only decides eligibility
      await sleep(VMP_DELAY_MS);
      if (probe.error || !probe.codes.includes(w.product_id)) {
        replaced++;
        console.log(`  skip (not at VMP)  ${w.name}`);
        continue;
      }
    }
    const i = wines.length;
    wines.push(w);
    ours.push(await measure(w.name, w.product_id, runOurs, REPEATS_OURS, 0));
    vmp.push(await measure(w.name, w.product_id, runVmp, REPEATS_VMP, VMP_DELAY_MS));
    console.log(
      `${String(i + 1).padStart(3)}  ours ${fmt(ours[i].ms).padStart(9)}  vmp ${fmt(vmp[i].ms).padStart(9)}  ${w.name}`
    );
  }

  const a = summarise(ours);
  const b = summarise(vmp);
  console.log(`\nmean  ours ${fmt(a.mean)}  vs  vmp ${fmt(b.mean)}`);
  console.log(`p50   ours ${fmt(a.p50)}  vs  vmp ${fmt(b.p50)}`);
  console.log(`p95   ours ${fmt(a.p95)}  vs  vmp ${fmt(b.p95)}`);
  console.log(`found ours ${a.found}/${wines.length}  vs  vmp ${b.found}/${wines.length}   errors vmp ${b.errors}`);
  console.log(`replaced ${replaced} draws Vinmonopolet did not find (seed ${SEED})`);

  const date = new Date().toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
  writeFileSync(OUT, html(wines, ours, vmp, date, replaced));
  console.log(`wrote ${OUT}`);
}

main();
