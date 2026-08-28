#!/usr/bin/env npx tsx
/**
 * Records a split-screen comparison of our wine search against vinmonopolet.no.
 *
 * Both sites are loaded as iframes into a single 1920x1080 compositor page, which
 * is what Playwright records — so the two halves are genuinely simultaneous
 * rather than two clips stitched together afterwards. (Playwright's bundled
 * ffmpeg has no hstack filter, so post-production compositing is not available.)
 *
 * Timing is measured identically on both sides: from the moment typing starts to
 * the moment the first result element exists in that frame.
 *
 * HONEST FRAMING, please keep it:
 *  - Our app runs from a local `next start`; vinmonopolet.no is a live public
 *    site behind a CDN. Our page shell has no network hop, though our search
 *    still queries Supabase over the internet. The caption on the video says so.
 *  - The three terms are chosen to show one head-to-head speed test and two
 *    genuine capability gaps (typo tolerance, product-id lookup). Their
 *    typeahead handles accents and hyphens perfectly well; do not add a term
 *    implying otherwise.
 *
 * Prerequisites: `npm run build` then `npx next start -p 3200`.
 * Usage: npm run record-search-comparison
 */
import { chromium, type Page } from 'playwright';
import { createServer } from 'node:http';
import { renameSync, mkdirSync, existsSync } from 'node:fs';

const OURS_URL = process.env.OURS_URL ?? 'http://localhost:3200/';
const VMP_URL = 'https://www.vinmonopolet.no/';
const HOST_PORT = 3201;
const OUT_DIR = 'recordings';
const OUT_FILE = `${OUT_DIR}/search-comparison.webm`;

const COL_W = 960;
const IFRAME_H = 866;   // leaves 64px for the caption strip (78 + 72 + 866 = 1016)
const HEADER_H = 78;
const LABEL_H = 72;

const OURS_RESULT = '[role=listbox] li';
// Scoped to the search form's dropdown. A bare a[href*="/p/"] also matches one
// permanent product link on their homepage, which made the clock read 5 ms.
const VMP_RESULT = 'form ul li a[href*="/p/"]';

type Term = { query: string; caption: string };

const TERMS: Term[] = [
  { query: 'andre clouet',  caption: 'A producer both sites stock — a straight speed comparison' },
  { query: 'andre clouett', caption: 'The same search with a typo (double “t”)' },
  { query: '10902101',      caption: 'A Vinmonopolet product number — their own catalogue id' }
];

const HOST_HTML = `
<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Search comparison</title>
<style>
  * { box-sizing: border-box; }
  body { margin:0; width:1920px; height:1080px; overflow:hidden; background:#14100f;
         font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  header { height:${HEADER_H}px; display:flex; align-items:center; justify-content:space-between;
           padding:0 26px; color:#fff; }
  header .t { font-size:24px; font-weight:650; letter-spacing:-.2px; }
  header .q { font-size:19px; color:#f0d9a0; font-variant-numeric:tabular-nums; }
  header .q b { color:#fff; font-weight:650; }
  .cols { display:flex; gap:0; }
  .col { width:${COL_W}px; }
  .label { height:${LABEL_H}px; display:flex; align-items:center; justify-content:space-between;
           padding:0 22px; color:#fff; }
  .col.a .label { background:#7B1E3A; }
  .col.b .label { background:#2f3b33; }
  .name { font-size:19px; font-weight:650; }
  .sub  { font-size:12px; opacity:.72; margin-top:3px; }
  .timer { font-size:30px; font-weight:700; font-variant-numeric:tabular-nums;
           font-feature-settings:"tnum"; min-width:150px; text-align:right; }
  .timer.idle { opacity:.35; }
  .timer.miss { color:#ffb4a8; font-size:22px; }
  iframe { width:${COL_W}px; height:${IFRAME_H}px; border:0; display:block; background:#fff; }
  .caption { position:absolute; bottom:0; left:0; width:1920px; height:${1080 - HEADER_H - LABEL_H - IFRAME_H}px;
             display:flex; align-items:center; padding:0 26px; color:#e8e2dc; font-size:15px; background:#14100f; }
</style></head><body>
<header>
  <div class="t">Wine search · side by side</div>
  <div class="q">Searching: <b id="q">—</b></div>
</header>
<div class="cols">
  <div class="col a">
    <div class="label"><div><div class="name">Smak Vin</div><div class="sub">local server · live database</div></div>
      <div class="timer idle" id="t-a">—</div></div>
    <iframe id="f-a" src="${OURS_URL}"></iframe>
  </div>
  <div class="col b">
    <div class="label"><div><div class="name">vinmonopolet.no</div><div class="sub">live public site</div></div>
      <div class="timer idle" id="t-b">—</div></div>
    <iframe id="f-b" src="${VMP_URL}"></iframe>
  </div>
</div>
<div class="caption" id="cap"></div>
<script>
  const el = { a: document.getElementById('t-a'), b: document.getElementById('t-b') };
  const running = {};
  window.setQuery = q => { document.getElementById('q').textContent = q; };
  window.setCaption = c => { document.getElementById('cap').textContent = c; };
  window.resetTimers = () => {
    for (const k of ['a','b']) {
      cancelAnimationFrame(running[k]);
      el[k].textContent = '—'; el[k].className = 'timer idle';
    }
  };
  window.startTimers = () => {
    const t0 = performance.now();
    for (const k of ['a','b']) {
      el[k].className = 'timer';
      const tick = () => {
        el[k].textContent = Math.round(performance.now() - t0) + ' ms';
        running[k] = requestAnimationFrame(tick);
      };
      tick();
    }
  };
  window.freeze = (k, ms) => {
    cancelAnimationFrame(running[k]);
    if (ms === null) { el[k].className = 'timer miss'; el[k].textContent = 'no results'; }
    else { el[k].className = 'timer'; el[k].textContent = ms + ' ms'; }
  };
</script></body></html>`;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function startHost(): Promise<() => void> {
  return new Promise(resolve => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(HOST_HTML);
    });
    server.listen(HOST_PORT, () => resolve(() => server.close()));
  });
}

/**
 * Time from `t0` until `selector` has at least one match inside the frame.
 * Count-based rather than existence-based: vinmonopolet's page already contains
 * product links from the previous query's dropdown, and waiting for "attached"
 * matched those instantly and reported an impossible 9 ms.
 */
async function timeToResult(
  page: Page,
  frameSel: string,
  selector: string,
  t0: number,
  budgetMs: number
): Promise<number | null> {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    const n = await page.frameLocator(frameSel).locator(selector).count().catch(() => 0);
    if (n > 0) return Math.round(performance.now() - t0);
    await sleep(25);
  }
  return null;
}

/** Wait until the frame shows no results, so the next measurement starts clean. */
async function waitForClear(page: Page, frameSel: string, selector: string, budgetMs = 6000) {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    const n = await page.frameLocator(frameSel).locator(selector).count().catch(() => 1);
    if (n === 0) return true;
    await sleep(50);
  }
  return false;
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const stopHost = await startHost();

  const browser = await chromium.launch({ channel: 'chromium' });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: 'nb-NO',
    recordVideo: { dir: OUT_DIR, size: { width: 1920, height: 1080 } }
  });
  const page: Page = await context.newPage();

  console.log('loading both sites...');
  await page.goto(`http://localhost:${HOST_PORT}/`, { waitUntil: 'load', timeout: 60000 });
  await sleep(4000);

  const ours = () => page.frameLocator('#f-a');
  const vmp = () => page.frameLocator('#f-b');
  console.log('  frames:', page.frames().map(f => f.url()).join(' | '));

  // Their consent dialog would otherwise sit over the results.
  try {
    await vmp().locator('button.btn-primary', { hasText: 'Godkjenn alle' }).click({ timeout: 12000 });
    console.log('  dismissed consent banner');
  } catch {
    console.log('  no consent banner');
  }
  await sleep(1500);

  const oursInput = ours().locator('input[type=text]').first();
  const vmpInput = vmp().locator('input[type=search][name=q]').first();

  // Warm both sides with a throwaway search before measuring. The first query
  // after page load pays for lazy route-handler init and the TLS handshake to
  // Supabase -- it measured 1080ms cold against 206ms warm. Their site is a
  // long-warm production service, so timing our cold start against it would
  // understate us by a factor of five for reasons that have nothing to do with
  // the search itself.
  console.log('warming both sides...');
  await oursInput.fill('barolo');
  await vmpInput.fill('barolo');
  await Promise.all([
    timeToResult(page, '#f-a', OURS_RESULT, performance.now(), 9000),
    timeToResult(page, '#f-b', VMP_RESULT, performance.now(), 9000)
  ]);
  await oursInput.fill('');
  await vmpInput.fill('');
  await sleep(1500);

  const results: { query: string; ours: number | null; vmp: number | null }[] = [];

  for (const term of TERMS) {
    console.log(`\n"${term.query}"`);
    await page.evaluate(c => (window as never as { setCaption: (s: string) => void }).setCaption(c), term.caption);
    await page.evaluate(q => (window as never as { setQuery: (s: string) => void }).setQuery(q), term.query);
    await page.evaluate(() => (window as never as { resetTimers: () => void }).resetTimers());

    await oursInput.fill('');
    await vmpInput.fill('');
    // Their dropdown lingers after clearing; both sides must read zero before the
    // clock starts or the previous query's results count as this query's.
    await Promise.all([
      waitForClear(page, '#f-a', OURS_RESULT),
      waitForClear(page, '#f-b', VMP_RESULT)
    ]);
    await sleep(700);

    await page.evaluate(() => (window as never as { startTimers: () => void }).startTimers());

    // The query is inserted rather than typed key by key. Playwright's type()
    // dispatches keystrokes to whatever the page's focused element is, so two
    // concurrent type() calls fight over focus and every character ends up in
    // one iframe. fill() writes to the element itself, so both searches start
    // cleanly. Each side is timed from its own insertion, which also removes any
    // advantage from being filled first.
    const oursT0 = performance.now();
    await oursInput.fill(term.query);
    const vmpT0 = performance.now();
    await vmpInput.fill(term.query);

    const watch = Promise.all([
      timeToResult(page, '#f-a', OURS_RESULT, oursT0, 9000).then(async ms => {
        await page.evaluate(([k, v]) => (window as never as { freeze: (a: string, b: number | null) => void }).freeze(k as string, v as number | null), ['a', ms]);
        return ms;
      }),
      timeToResult(page, '#f-b', VMP_RESULT, vmpT0, 9000).then(async ms => {
        await page.evaluate(([k, v]) => (window as never as { freeze: (a: string, b: number | null) => void }).freeze(k as string, v as number | null), ['b', ms]);
        return ms;
      })
    ]);

    const [o, v] = await watch;
    results.push({ query: term.query, ours: o, vmp: v });
    const oursN = await ours().locator(OURS_RESULT).count().catch(() => -1);
    const vmpN = await vmp().locator(VMP_RESULT).count().catch(() => -1);
    console.log(`  ours ${o ?? 'no results'} (${oursN} rows)   vmp ${v ?? 'no results'} (${vmpN} rows)`);
    await sleep(3200);
  }

  await page.evaluate(() => (window as never as { setCaption: (s: string) => void })
    .setCaption('Timings are wall-clock from first keystroke to first result rendered, measured identically on both sides.'));
  await sleep(2500);

  const video = page.video();
  await context.close();
  await browser.close();
  stopHost();

  if (video) {
    const raw = await video.path();
    renameSync(raw, OUT_FILE);
    console.log(`\nwrote ${OUT_FILE}`);
  }

  console.log('\nsummary');
  for (const r of results) {
    console.log(`  ${r.query.padEnd(15)} ours ${String(r.ours ?? 'none').padStart(6)}   vinmonopolet ${String(r.vmp ?? 'none').padStart(6)}`);
  }
}

main();
