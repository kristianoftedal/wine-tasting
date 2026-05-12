#!/usr/bin/env npx tsx
/**
 * Scrape Vinmonopolet food & wine pairing articles and save to wine_articles.
 *
 * Pages are server-rendered by Sanity CMS. Key structure per article:
 *   - Title:   <h1> inside <article class="sanity">
 *   - Summary: <meta property="og:description">
 *   - Tags:    <aside class="tags"><ul> — href prefix classifies type:
 *                /tag/maltid-*       → occasion_tags (meal course)
 *                /tag/anledning-*    → occasion_tags (special occasion)
 *                /tag/mattradisjon-* → food_tags
 *                everything else     → food_tags
 *   - Content: <p>, <h2>, <h3> inside <section> (excludes related-article
 *              grids and podcast iframes)
 *
 * NOTE: Articles describe wine styles (grape, region) not specific products —
 * Norwegian alcohol ad law prohibits product links. Use wine_articles for
 * editorial context; use search_wines_by_food() for actual wine results.
 *
 * Usage:
 *   npx tsx scripts/scrape-food-pairing-articles.ts            # dry run
 *   npx tsx scripts/scrape-food-pairing-articles.ts --execute  # save to DB
 *   npx tsx scripts/scrape-food-pairing-articles.ts --execute --limit=10
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local' });
dotenvConfig();

import { createClient } from '@supabase/supabase-js';
import { openai } from '@ai-sdk/openai';
import { embedMany } from 'ai';

const BASE_URL = 'https://www.vinmonopolet.no';
const INDEX_PATH = '/mat-og-drikke/drikke-til-mat';
const BATCH_SIZE = 20;
const REQUEST_DELAY_MS = 500;

const execute = process.argv.includes('--execute');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : Infinity;

const supabase = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#x27;/g, "'");
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

// ─── Targeted extractors (based on confirmed page structure) ──────────────────

function extractTitle(html: string): string {
  // Prefer <h1> inside <article class="sanity">
  const articleH1 = html.match(/<article[^>]*class="sanity"[^>]*>[\s\S]{0,500}?<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (articleH1) return stripTags(articleH1[1]);
  // Fallback: og:title
  const og = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/);
  return og ? decodeEntities(og[1]) : '';
}

function extractSummary(html: string): string {
  // og:description is clean editorial copy, used as the article intro
  const og = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/);
  return og ? decodeEntities(og[1]) : '';
}

// Tag hrefs follow /tag/[prefix]-[slug]. Prefix determines classification:
//   maltid-*          → meal course (Forrett, Hovedrett, Gryter…) → occasion
//   anledning-*       → special occasion (Julemat, Nyttår…)        → occasion
//   hoofdingrediens-* → main ingredient (Kjøtt, Fisk, Kylling…)   → food
//   mattradisjon-*    → food tradition                             → food
//   everything else                                                → food
function extractTags(html: string): { foodTags: string[]; occasionTags: string[] } {
  const foodTags: string[] = [];
  const occasionTags: string[] = [];

  const aside = html.match(/<aside[^>]*class="tags"[^>]*>([\s\S]*?)<\/aside>/);
  if (!aside) return { foodTags, occasionTags };

  const tagRe = /<a[^>]*href="\/tag\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(aside[1])) !== null) {
    const slug = m[1];
    const name = stripTags(m[2]);
    if (!name) continue;
    if (slug.startsWith('maltid-') || slug.startsWith('anledning-')) {
      occasionTags.push(name);
    } else {
      foodTags.push(name);
    }
  }

  return { foodTags, occasionTags };
}

// Removes all <div> blocks whose class attribute contains className.
// Tracks nesting depth so arbitrarily deep divs are fully removed.
function removeDivsByClass(html: string, className: string): string {
  let result = html;
  const openRe = new RegExp(`<div[^>]*\\b${className}\\b[^>]*>`, 'g');
  let match: RegExpExecArray | null;

  while ((match = openRe.exec(result)) !== null) {
    const start = match.index;
    let depth = 1;
    let i = start + match[0].length;

    while (i < result.length && depth > 0) {
      if (result[i] === '<') {
        if (result.startsWith('<div', i))        { depth++; i += 4; }
        else if (result.startsWith('</div', i))  {
          depth--;
          if (depth === 0) {
            const end = result.indexOf('>', i) + 1;
            result = result.slice(0, start) + result.slice(end);
            openRe.lastIndex = start;
            break;
          }
          i += 5;
        } else { i++; }
      } else { i++; }
    }
  }
  return result;
}

// Extract readable text from the article.
// Sources (in order):
//   1. Intro paragraph from <header class="wJZq290M"> (always present)
//   2. <h2>, <h3>, <p>, <li> from <section> with noise removed
//
// Noise removed before extraction:
//   - <div class="WBSZV9N6"> related-article card grids (inside section in
//     some articles — their <h2> card titles would otherwise be extracted)
//   - <div class="PTKy573E"> podcast iframe containers
//   - <a class="jm_ZjTp2"> inline recipe/article link cards (<h2>+<img>)
//   - <details> FAQ accordion boilerplate
//   - <skyra-survey> widgets
//   - Elements with class J3VQ_C7B (author/date footer lines)
function extractContent(html: string): string {
  const parts: string[] = [];

  // 1. Intro paragraph from article header (editorial summary not in <section>)
  const headerMatch = html.match(/<header[^>]*class="wJZq290M"[^>]*>([\s\S]*?)<\/header>/);
  if (headerMatch) {
    const pRe = /<p([^>]*)>([\s\S]*?)<\/p>/g;
    let m: RegExpExecArray | null;
    while ((m = pRe.exec(headerMatch[1])) !== null) {
      if (/J3VQ_C7B/.test(m[1])) continue;
      const t = stripTags(m[2]);
      if (t.length > 10) parts.push(t);
    }
  }

  // 2. Main section content
  const sectionMatch = html.match(/<section>([\s\S]*?)<\/section>/);
  if (!sectionMatch) return parts.join('\n\n');

  let scope = sectionMatch[1];

  // Remove noise containers (depth-aware so nested divs are fully stripped)
  scope = removeDivsByClass(scope, 'WBSZV9N6');  // related-article card grids
  scope = removeDivsByClass(scope, 'PTKy573E');  // podcast iframes
  // Remove other noise with simple regex (these don't have deeply nested structures)
  scope = scope.replace(/<a[^>]*\bjm_ZjTp2\b[^>]*>[\s\S]*?<\/a>/gi, '');  // inline recipe/article cards
  scope = scope.replace(/<details[\s\S]*?<\/details>/gi, '');
  scope = scope.replace(/<skyra-survey[^>]*\/?>/gi, '');

  const textRe = /<(h2|h3|p|li)([^>]*?)>([\s\S]*?)<\/\1>/g;
  let m: RegExpExecArray | null;
  while ((m = textRe.exec(scope)) !== null) {
    const [, tag, attrs, inner] = m;
    if (/J3VQ_C7B/.test(attrs)) continue;
    const t = stripTags(inner);
    if (t.length < 10) continue;
    parts.push(tag === 'li' ? `- ${t}` : t);
  }

  return parts.join('\n');
}

// ─── Article discovery ────────────────────────────────────────────────────────

async function fetchArticleUrls(): Promise<string[]> {
  console.log(`Fetching index: ${BASE_URL}${INDEX_PATH}`);
  const res = await fetch(`${BASE_URL}${INDEX_PATH}`, {
    headers: { 'Accept-Language': 'nb-NO,nb;q=0.9', 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) throw new Error(`Index fetch failed: ${res.status}`);
  const html = await res.text();

  // Collect all unique article slugs under the drikke-til-mat section
  const re = /href="(\/mat-og-drikke\/drikke-til-mat\/[a-z0-9\-]+)"/g;
  const paths = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) paths.add(m[1]);

  const urls = [...paths].map(p => `${BASE_URL}${p}`);
  console.log(`Found ${urls.length} article URLs\n`);
  return urls;
}

// ─── Article scraping ─────────────────────────────────────────────────────────

type ArticleData = {
  url: string;
  title: string;
  content: string;
  summary: string;
  foodTags: string[];
  occasionTags: string[];
};

async function scrapeArticle(url: string): Promise<ArticleData | null> {
  try {
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'nb-NO,nb;q=0.9', 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) { console.warn(`  SKIP ${url} — HTTP ${res.status}`); return null; }

    const html = await res.text();
    const title = extractTitle(html);
    const summary = extractSummary(html);
    const content = extractContent(html);
    const { foodTags, occasionTags } = extractTags(html);

    if (!title || content.length < 80) {
      console.warn(`  SKIP ${url} — insufficient content (title="${title}", chars=${content.length})`);
      return null;
    }

    return { url, title, content, summary, foodTags, occasionTags };
  } catch (err) {
    console.warn(`  ERROR ${url}:`, err);
    return null;
  }
}

// ─── Embedding ────────────────────────────────────────────────────────────────

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: openai.embedding('text-embedding-3-small'),
    values: texts,
  });
  return embeddings;
}

// ─── DB upsert ────────────────────────────────────────────────────────────────

async function upsertArticles(articles: ArticleData[], embeddings: number[][]): Promise<void> {
  const rows = articles.map((a, i) => ({
    url: a.url,
    title: a.title,
    content: a.content,
    summary: a.summary,
    category: a.foodTags[0] ?? null,
    food_tags: a.foodTags,
    occasion_tags: a.occasionTags,
    embedding: JSON.stringify(embeddings[i]),
    scraped_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('wine_articles')
    .upsert(rows, { onConflict: 'url' });

  if (error) throw new Error(`Upsert failed: ${error.message}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Mode: ${execute ? 'EXECUTE' : 'DRY RUN'}\n`);

  const allUrls = await fetchArticleUrls();
  const urls = allUrls.slice(0, limit);
  if (urls.length < allUrls.length) console.log(`Limited to ${urls.length} articles\n`);

  const articles: ArticleData[] = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    process.stdout.write(`[${i + 1}/${urls.length}] ${url.split('/').pop()} ... `);
    const article = await scrapeArticle(url);
    if (article) {
      const tags = [...article.foodTags, ...article.occasionTags].join(', ');
      console.log(`OK  (${article.content.length} chars) tags=[${tags}]`);
      articles.push(article);
    }
    if (i < urls.length - 1) await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
  }

  console.log(`\nScraped ${articles.length}/${urls.length} articles`);

  if (!execute) {
    console.log('\nDry run — pass --execute to embed and save\n');
    if (articles[0]) {
      const a = articles[0];
      console.log(`Sample: ${a.title}`);
      console.log(`  Food tags:    ${a.foodTags.join(', ')}`);
      console.log(`  Occasion tags: ${a.occasionTags.join(', ')}`);
      console.log(`  Summary: ${a.summary}`);
      console.log(`  Content (first 200): ${a.content.slice(0, 200)}…`);
    }
    return;
  }

  console.log(`\nGenerating embeddings in batches of ${BATCH_SIZE}…`);
  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    const texts = batch.map(a => `${a.title}\n\n${a.summary}\n\n${a.content}`);
    process.stdout.write(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(articles.length / BATCH_SIZE)} — ${batch.length} articles … `);
    const embeddings = await generateEmbeddings(texts);
    await upsertArticles(batch, embeddings);
    console.log('saved');
  }

  console.log(`\nDone — ${articles.length} articles saved to wine_articles`);
}

main().catch(err => { console.error(err); process.exit(1); });
