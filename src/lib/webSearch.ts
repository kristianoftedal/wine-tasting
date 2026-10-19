/**
 * Web search and page retrieval for wine-note enrichment.
 *
 * Replaces OpenAI's built-in web_search tool with an explicit three-step
 * pipeline: query a search API, fetch the pages ourselves, extract the passages
 * that actually discuss taste. The gain is not cost — it is control. With the
 * built-in tool, "don't cite Vivino" is an instruction the model may or may not
 * follow, and a run that cited a *different producer's* page proved it does not
 * always follow it. Here the domain policy is code: a blocked host is never
 * fetched, never reaches the prompt, and cannot be argued with.
 *
 * It also makes the source list honest. The built-in tool reports what it
 * consulted; this reports what we read, because we did the reading.
 *
 * Provider is chosen by whichever API key is set, so swapping vendors is an env
 * change rather than a code change — the free tiers in this space have been
 * shifting (Brave's free tier ended Feb 2026, Google CSE closed to new
 * customers), and the pipeline should outlive any one of them.
 */

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export type RetrievedDocument = SearchResult & {
  /** Extracted passages that mention taste, or '' when the fetch found nothing usable. */
  text: string;
};

export class WebSearchError extends Error {
  constructor(
    message: string,
    readonly code: 'not_configured' | 'request_failed'
  ) {
    super(message);
    this.name = 'WebSearchError';
  }
}

/**
 * Hosts that must never reach the prompt.
 *
 * Crowd review aggregates and marketplace listings merge vintages, producers
 * and often unrelated wines under one page, and their prose is sales copy. A
 * note distilled from them describes a category, not a bottle — which is the
 * exact failure this pipeline exists to prevent.
 *
 * wine-searcher.com is deliberately absent despite being a price aggregator:
 * its pages quote the producer's own vintage-specific note ("Producer tasting
 * notes: (2010 vintage) Color: Ruby red with garnet hints…"), which is
 * first-hand. It stays untrusted, and therefore ranked behind the critics, but
 * it is not silenced.
 */
const BLOCKED_HOSTS = [
  'vivino.com',
  'delectable.com',
  'untappd.com',
  'cellartracker.com',
  'catawiki.com',
  'ebay.com',
  'amazon.com',
  'idealwine.com',
  'bidforwine.co.uk',
  'drizly.com',
  'totalwine.com',
  'vivino.co',
  'pinterest.com',
  'facebook.com',
  'instagram.com',
  'reddit.com',
  'x.com',
  'youtube.com',
  'tiktok.com'
];

/**
 * Hosts whose tasting notes are written by someone who tasted the wine and
 * named the vintage. Ranked first; everything else is filler behind them.
 *
 * Measured caveat, and the reason snippets are a first-class source below: most
 * of these cannot be fetched directly. jancisrobinson.com and
 * wineenthusiast.com answer a plain request with 403, and decanter.com serves
 * 92 kB of HTML that reduces to 428 characters of metadata with the tasting
 * note nowhere in it — it is behind a paywall the markup never contains. What
 * does fetch cleanly is producer sites (ghisolfi.com yielded 2 005 characters
 * of vinification and tasting detail) and the Nordic monopolies. The critics
 * still reach us, but through the search engine's indexed snippet rather than
 * through their own server.
 */
const TRUSTED_HOSTS = [
  'jancisrobinson.com',
  'decanter.com',
  'vinous.com',
  'wineenthusiast.com',
  'jamessuckling.com',
  'robertparker.com',
  'winespectator.com',
  'wineanorak.com',
  'systembolaget.se',
  'alko.fi',
  'vinmonopolet.no',
  'aperitif.no',
  'vinbladet.no',
  'gismondionwine.com',
  'timatkin.com',
  'bbr.com',
  'jeb-dunnuck.com'
];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

export function isBlockedSource(url: string): boolean {
  const host = hostOf(url);
  if (!host) return true;
  return BLOCKED_HOSTS.some(blocked => host === blocked || host.endsWith(`.${blocked}`));
}

export function isTrustedSource(url: string): boolean {
  const host = hostOf(url);
  return TRUSTED_HOSTS.some(trusted => host === trusted || host.endsWith(`.${trusted}`));
}

/** Drop blocked hosts, dedupe by host, and float trusted sources to the front. */
export function rankSources(results: SearchResult[]): SearchResult[] {
  const seenHosts = new Set<string>();
  const kept: SearchResult[] = [];

  for (const result of results) {
    if (isBlockedSource(result.url)) continue;
    // One page per host: three Wine Enthusiast hits for three vintages of the
    // same wine add a vintage mismatch, not a second opinion.
    const host = hostOf(result.url);
    if (seenHosts.has(host)) continue;
    seenHosts.add(host);
    kept.push(result);
  }

  return kept.sort((a, b) => Number(isTrustedSource(b.url)) - Number(isTrustedSource(a.url)));
}

// ─── Providers ────────────────────────────────────────────────────────────────

type Provider = 'serper' | 'tavily' | 'brave';

export function activeProvider(): Provider | null {
  if (process.env.SERPER_API_KEY) return 'serper';
  if (process.env.TAVILY_API_KEY) return 'tavily';
  if (process.env.BRAVE_API_KEY) return 'brave';
  return null;
}

const SEARCH_TIMEOUT_MS = 15_000;

async function searchSerper(query: string, limit: number): Promise<SearchResult[]> {
  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': process.env.SERPER_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, num: limit }),
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new WebSearchError(`serper responded ${response.status}`, 'request_failed');
  }

  const body = (await response.json()) as { organic?: Array<{ title?: string; link?: string; snippet?: string }> };
  return (body.organic ?? [])
    .filter(item => item.link)
    .map(item => ({ title: item.title ?? '', url: item.link!, snippet: item.snippet ?? '' }));
}

async function searchTavily(query: string, limit: number): Promise<SearchResult[]> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.TAVILY_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, max_results: limit, search_depth: 'basic' }),
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new WebSearchError(`tavily responded ${response.status}`, 'request_failed');
  }

  const body = (await response.json()) as { results?: Array<{ title?: string; url?: string; content?: string }> };
  return (body.results ?? [])
    .filter(item => item.url)
    .map(item => ({ title: item.title ?? '', url: item.url!, snippet: item.content ?? '' }));
}

async function searchBrave(query: string, limit: number): Promise<SearchResult[]> {
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(limit));

  const response = await fetch(url, {
    headers: { 'X-Subscription-Token': process.env.BRAVE_API_KEY!, Accept: 'application/json' },
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new WebSearchError(`brave responded ${response.status}`, 'request_failed');
  }

  const body = (await response.json()) as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
  };
  return (body.web?.results ?? [])
    .filter(item => item.url)
    .map(item => ({ title: item.title ?? '', url: item.url!, snippet: item.description ?? '' }));
}

export async function searchWeb(query: string, limit = 10): Promise<SearchResult[]> {
  const provider = activeProvider();
  if (!provider) {
    throw new WebSearchError(
      'No search provider configured — set SERPER_API_KEY, TAVILY_API_KEY or BRAVE_API_KEY',
      'not_configured'
    );
  }

  if (provider === 'serper') return searchSerper(query, limit);
  if (provider === 'tavily') return searchTavily(query, limit);
  return searchBrave(query, limit);
}

// ─── Page retrieval ───────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 12_000;
/** Stop reading a page after this much HTML. Tasting notes are near the top. */
const MAX_HTML_BYTES = 600_000;

const USER_AGENT =
  'SmakVin-note-enrichment/1.0 (+https://vinmonopolet.no; tasting-note research; contact via repository)';

function decodeEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * HTML to text. Block-level tags become paragraph breaks rather than spaces so
 * `extractTastingPassages` still has sentence boundaries to select on — the
 * same regex approach as scripts/scrape-food-pairing-articles.ts, which has
 * held up against Vinmonopolet's markup without a DOM parser.
 */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<(nav|header|footer|aside|form)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\/(p|div|section|article|li|h[1-6]|br|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

/**
 * Norwegian and English markers that a passage is describing what the wine
 * smells and tastes like, rather than its price, its shipping or its awards.
 */
const TASTING_MARKERS = [
  'aroma',
  'nose',
  'palate',
  'tasting note',
  'notes of',
  'flavou',
  'flavor',
  'bouquet',
  'finish',
  'tannin',
  'acidity',
  'duft',
  'lukt',
  'smak',
  'ettersmak',
  'garvestoff',
  'doft',
  'eftersmak',
  'inslag av',
  'preg av',
  'cherry',
  'berr',
  'bær',
  'oak',
  'fat',
  'spice',
  'krydder',
  'plum',
  'citrus',
  'sitrus',
  'floral',
  'blomst',
  'leather',
  'lær'
];

/**
 * Keep only the sentences that discuss taste, capped at `maxChars`.
 *
 * A fetched wine page is mostly navigation, shipping terms and related-product
 * grids. Sending it whole would cost more tokens than OpenAI's built-in search
 * block and bury the three sentences that matter.
 */
export function extractTastingPassages(text: string, maxChars = 2200): string {
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length >= 30 && sentence.length <= 600);

  const relevant: string[] = [];
  let used = 0;

  for (const sentence of sentences) {
    const lowered = sentence.toLowerCase();
    if (!TASTING_MARKERS.some(marker => lowered.includes(marker))) continue;
    if (used + sentence.length > maxChars) break;
    relevant.push(sentence);
    used += sentence.length;
  }

  return relevant.join(' ');
}

/** Fetch one page and reduce it to its tasting passages. Never throws. */
export async function retrieveDocument(result: SearchResult): Promise<RetrievedDocument> {
  try {
    const response = await fetch(result.url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'follow'
    });

    if (!response.ok || !(response.headers.get('content-type') ?? '').includes('html')) {
      return { ...result, text: '' };
    }

    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    return { ...result, text: extractTastingPassages(htmlToText(html)) };
  } catch {
    // A page that times out, blocks us or serves a JS shell is not an error —
    // it is one source fewer. The snippet from the search result still stands.
    return { ...result, text: '' };
  }
}

/** Fetch several pages concurrently, preserving rank order in the result. */
export async function retrieveDocuments(results: SearchResult[], concurrency = 4): Promise<RetrievedDocument[]> {
  const documents = new Array<RetrievedDocument>(results.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(concurrency, results.length) }, async () => {
    while (cursor < results.length) {
      const index = cursor++;
      documents[index] = await retrieveDocument(results[index]);
    }
  });

  await Promise.all(runners);
  return documents;
}
