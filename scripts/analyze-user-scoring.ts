#!/usr/bin/env npx tsx
/**
 * Diagnostic: inspect a user's last N tastings and decompose the
 * smell/taste scoring pipeline to see where points are lost.
 *
 * Pipeline (from src/actions/similarity.ts):
 *   serverSideSimilarity = avg(lemmaJaccard, categoryJaccard, semanticOfLemmatizedText)
 * This script reproduces all three components plus a "coverage" signal
 * (share of user words that exist in the lemma dictionary).
 */
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local' });
dotenvConfig();
import { createClient } from '@supabase/supabase-js';
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { lemmatizeAndWeight, norwegianLemmas, sanitizeText } from '../src/lib/lemmatizeAndWeight';
import { cosineSimilarity } from '../src/lib/math';

const EMAIL = 'oftedal.kristian@gmail.com';
const LIMIT = 20;

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (x: number) => (x * 100).toFixed(0);

async function embedText(text: string): Promise<number[] | null> {
  const clean = sanitizeText(text);
  if (!clean) return null;
  const { embedding } = await embed({ model: openai.embedding('text-embedding-3-small'), value: clean });
  return embedding;
}

type WInfo = { lemma: string; weight: number; main?: string; sub?: string };

function weightedMap(a: ReturnType<typeof lemmatizeAndWeight>): Map<string, WInfo> {
  const out = new Map<string, WInfo>();
  for (const item of a.lemmatized) {
    if (item.category === 'ukjent') continue;
    const path = (norwegianLemmas[item.original] ?? norwegianLemmas[item.lemma])?.categoryPath;
    const existing = out.get(item.lemma);
    if (!existing || item.weight > existing.weight) {
      out.set(item.lemma, { lemma: item.lemma, weight: item.weight, main: path?.main, sub: path?.sub });
    }
  }
  return out;
}

const sumW = (m: Map<string, WInfo>) => [...m.values()].reduce((s, v) => s + v.weight, 0);

function lemmaOverlap(a: ReturnType<typeof lemmatizeAndWeight>, b: ReturnType<typeof lemmatizeAndWeight>) {
  const ma = weightedMap(a);
  const mb = weightedMap(b);
  if (!ma.size || !mb.size) return 0;
  let inter = 0;
  for (const [lemma, info] of ma) if (mb.has(lemma)) inter += info.weight;
  const smaller = Math.min(sumW(ma), sumW(mb));
  return smaller ? inter / smaller : 0;
}

function categoryHierarchical(a: ReturnType<typeof lemmatizeAndWeight>, b: ReturnType<typeof lemmatizeAndWeight>) {
  const ma = weightedMap(a);
  const mb = weightedMap(b);
  if (!ma.size || !mb.size) return 0;
  const mainsB = new Set([...mb.values()].map(v => v.main).filter(Boolean));
  const fullB = new Set([...mb.values()].filter(v => v.main && v.sub).map(v => `${v.main}/${v.sub}`));
  let credit = 0;
  for (const info of ma.values()) {
    if (!info.main) continue;
    const key = info.sub ? `${info.main}/${info.sub}` : null;
    if (key && fullB.has(key)) credit += info.weight;
    else if (mainsB.has(info.main)) credit += info.weight * 0.5;
  }
  const smaller = Math.min(sumW(ma), sumW(mb));
  return smaller ? credit / smaller : 0;
}

function rewardStack(lemma: number, category: number, semantic: number) {
  const precision = (lemma + category) / 2;
  const bonus = Math.max(0, precision - 30) * 0.35;
  return Math.min(100, semantic + bonus);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing Supabase env vars.');
    process.exit(1);
  }
  const supabase = createClient(url, key);

  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('id, email, name')
    .eq('email', EMAIL)
    .single();
  if (profErr || !profile) {
    console.error('Profile lookup failed:', profErr?.message);
    process.exit(1);
  }
  console.log(`User: ${profile.name} <${profile.email}>  (${profile.id})`);

  const { data: tastings, error: tErr } = await supabase
    .from('tastings')
    .select('id, wine_id, lukt, smak, smell_score, taste_score, overall_score, karakter, created_at, tasted_at')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(LIMIT);
  if (tErr || !tastings?.length) {
    console.error('No tastings:', tErr?.message);
    process.exit(1);
  }

  const wineIds = [...new Set(tastings.map(t => t.wine_id).filter(Boolean))];
  const { data: wines } = await supabase
    .from('wines')
    .select('id, name, smell, taste')
    .in('id', wineIds);
  const wineById = new Map((wines || []).map(w => [w.id, w]));

  const agg = {
    storedSmell: [] as number[],
    storedTaste: [] as number[],
    smellCoverage: [] as number[],
    tasteCoverage: [] as number[],
    smellLemma: [] as number[],
    tasteLemma: [] as number[],
    smellCat: [] as number[],
    tasteCat: [] as number[],
    smellSem: [] as number[],
    tasteSem: [] as number[],
    smellAvg: [] as number[],
    tasteAvg: [] as number[],
    userSmellLen: [] as number[],
    userTasteLen: [] as number[],
    wineSmellLen: [] as number[],
    wineTasteLen: [] as number[]
  };
  const unknowns = new Map<string, number>();

  console.log(`\nAnalyzing ${tastings.length} tastings...\n`);

  for (const t of tastings) {
    const wine = wineById.get(t.wine_id);
    if (!wine) {
      console.log(`[skip] no wine for wine_id=${t.wine_id}`);
      continue;
    }

    const userSmell = (t.lukt || '').trim();
    const userTaste = (t.smak || '').trim();
    const wineSmell = wine.smell || '';
    const wineTaste = wine.taste || '';

    const us = lemmatizeAndWeight(userSmell);
    const ws = lemmatizeAndWeight(wineSmell);
    const ut = lemmatizeAndWeight(userTaste);
    const wt = lemmatizeAndWeight(wineTaste);

    // Coverage: share of user tokens that hit the lemma dictionary
    const smellKnown = us.lemmatized.filter(l => l.category !== 'ukjent').length;
    const tasteKnown = ut.lemmatized.filter(l => l.category !== 'ukjent').length;
    const smellCov = us.lemmatized.length ? smellKnown / us.lemmatized.length : 0;
    const tasteCov = ut.lemmatized.length ? tasteKnown / ut.lemmatized.length : 0;

    const smellLem = lemmaOverlap(us, ws);
    const tasteLem = lemmaOverlap(ut, wt);
    const smellCat = categoryHierarchical(us, ws);
    const tasteCat = categoryHierarchical(ut, wt);

    // Semantic similarity on lemmatized-only text (matches lemmatizedTextSimilarity in prod)
    const smellTxt1 = us.lemmatized.map(l => l.lemma).join(' ');
    const smellTxt2 = ws.lemmatized.map(l => l.lemma).join(' ');
    const tasteTxt1 = ut.lemmatized.map(l => l.lemma).join(' ');
    const tasteTxt2 = wt.lemmatized.map(l => l.lemma).join(' ');

    const [smellE1, smellE2, tasteE1, tasteE2] = await Promise.all([
      embedText(smellTxt1),
      embedText(smellTxt2),
      embedText(tasteTxt1),
      embedText(tasteTxt2)
    ]);
    const smellSem = smellE1 && smellE2 ? cosineSimilarity(smellE1, smellE2) : 0;
    const tasteSem = tasteE1 && tasteE2 ? cosineSimilarity(tasteE1, tasteE2) : 0;

    const smellAvg = rewardStack(smellLem * 100, smellCat * 100, smellSem * 100) / 100;
    const tasteAvg = rewardStack(tasteLem * 100, tasteCat * 100, tasteSem * 100) / 100;

    agg.storedSmell.push(t.smell_score ?? 0);
    agg.storedTaste.push(t.taste_score ?? 0);
    agg.smellCoverage.push(smellCov);
    agg.tasteCoverage.push(tasteCov);
    agg.smellLemma.push(smellLem);
    agg.tasteLemma.push(tasteLem);
    agg.smellCat.push(smellCat);
    agg.tasteCat.push(tasteCat);
    agg.smellSem.push(smellSem);
    agg.tasteSem.push(tasteSem);
    agg.smellAvg.push(smellAvg);
    agg.tasteAvg.push(tasteAvg);
    agg.userSmellLen.push(us.lemmatized.length);
    agg.userTasteLen.push(ut.lemmatized.length);
    agg.wineSmellLen.push(ws.lemmatized.length);
    agg.wineTasteLen.push(wt.lemmatized.length);

    [...us.lemmatized, ...ut.lemmatized]
      .filter(l => l.category === 'ukjent')
      .forEach(l => unknowns.set(l.lemma, (unknowns.get(l.lemma) || 0) + 1));

    console.log(`— ${wine.name}  (karakter=${t.karakter ?? '?'}, stored overall=${t.overall_score ?? '?'})`);
    console.log(`  USER smell : "${userSmell}"`);
    console.log(`  WINE smell : "${wineSmell}"`);
    console.log(
      `    stored=${t.smell_score}  lemma=${pct(smellLem)}  cat=${pct(smellCat)}  sem=${pct(smellSem)}  -> avg=${pct(smellAvg)}  cov=${pct(smellCov)}%  (user ${us.lemmatized.length} / wine ${ws.lemmatized.length} terms)`
    );
    console.log(`  USER taste : "${userTaste}"`);
    console.log(`  WINE taste : "${wineTaste}"`);
    console.log(
      `    stored=${t.taste_score}  lemma=${pct(tasteLem)}  cat=${pct(tasteCat)}  sem=${pct(tasteSem)}  -> avg=${pct(tasteAvg)}  cov=${pct(tasteCov)}%  (user ${ut.lemmatized.length} / wine ${wt.lemmatized.length} terms)\n`
    );
  }

  console.log('='.repeat(72));
  console.log('AGGREGATE (means)');
  console.log('='.repeat(72));
  console.log(`Stored smell_score : ${avg(agg.storedSmell).toFixed(1)}`);
  console.log(`Stored taste_score : ${avg(agg.storedTaste).toFixed(1)}`);
  console.log(`Recomputed smell   : ${pct(avg(agg.smellAvg))}  (lemma=${pct(avg(agg.smellLemma))}  cat=${pct(avg(agg.smellCat))}  sem=${pct(avg(agg.smellSem))})`);
  console.log(`Recomputed taste   : ${pct(avg(agg.tasteAvg))}  (lemma=${pct(avg(agg.tasteLemma))}  cat=${pct(avg(agg.tasteCat))}  sem=${pct(avg(agg.tasteSem))})`);
  console.log(`User term count    : smell=${avg(agg.userSmellLen).toFixed(1)}  taste=${avg(agg.userTasteLen).toFixed(1)}`);
  console.log(`Wine term count    : smell=${avg(agg.wineSmellLen).toFixed(1)}  taste=${avg(agg.wineTasteLen).toFixed(1)}`);
  console.log(`User dict coverage : smell=${pct(avg(agg.smellCoverage))}%  taste=${pct(avg(agg.tasteCoverage))}%`);

  const topUnknown = [...unknowns.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
  console.log(`\nTop unknown user words (not in norwegianLemmas):`);
  topUnknown.forEach(([w, c]) => console.log(`  ${w.padEnd(24)} ${c}x`));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
