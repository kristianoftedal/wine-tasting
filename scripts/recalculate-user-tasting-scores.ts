#!/usr/bin/env npx tsx
/**
 * Recalculate smell_score, taste_score, color_score, and overall_score for
 * every tasting belonging to the target user using the current production
 * similarity pipeline.
 *
 * Dry-run by default. Pass --execute to write back to the database.
 *
 *   npx tsx scripts/recalculate-user-tasting-scores.ts
 *   npx tsx scripts/recalculate-user-tasting-scores.ts --execute
 *
 * The overall_score recomputation mirrors the weighted average in
 * src/app/components/tasting/Summary.tsx: full weight for color/smell/taste
 * and the four numeric characteristics, 0.2 weight for price and alcohol %,
 * components are skipped when the wine lacks the comparable field.
 */
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local' });
dotenvConfig();

import { createClient } from '@supabase/supabase-js';
import { calculateServerSideScores } from '../src/actions/similarity';

const EMAIL = 'oftedal.kristian@gmail.com';
const execute = process.argv.includes('--execute');

type TastingRow = {
  id: string;
  wine_id: string | null;
  farge: string | null;
  lukt: string | null;
  smak: string | null;
  friskhet: number | null;
  fylde: number | null;
  sodme: number | null;
  snaerp: number | null;
  alkohol: string | null;
  pris: number | string | null;
  color_score: number | null;
  smell_score: number | null;
  taste_score: number | null;
  friskhet_score: number | null;
  fylde_score: number | null;
  sodme_score: number | null;
  snaerp_score: number | null;
  percentage_score: number | null;
  price_score: number | null;
  overall_score: number | null;
  karakter: number | null;
  created_at: string;
};

type WineRow = {
  id: string;
  name: string;
  color: string | null;
  smell: string | null;
  taste: string | null;
  friskhet: number | null;
  fylde: number | null;
  garvestoff: number | null;
  sodme: number | null;
  alcohol: string | null;
  price: unknown;
};

function computeOverall(
  wine: WineRow,
  scores: {
    farge: number;
    lukt: number;
    smak: number;
    friskhet: number | null;
    fylde: number | null;
    snaerp: number | null;
    sodme: number | null;
    pris: number | null;
    alkoholProsent: number | null;
  }
): number {
  const halfWeight = new Set(['pris', 'alkoholProsent']);
  const entries: Array<[string, number]> = [];

  entries.push(['farge', scores.farge]);
  if ((wine.smell ?? '').trim().length >= 10) entries.push(['lukt', scores.lukt]);
  if ((wine.taste ?? '').trim().length >= 10) entries.push(['smak', scores.smak]);
  if (wine.friskhet !== null && scores.friskhet !== null) entries.push(['friskhet', scores.friskhet]);
  if (wine.fylde !== null && scores.fylde !== null) entries.push(['fylde', scores.fylde]);
  if (wine.garvestoff !== null && scores.snaerp !== null) entries.push(['snaerp', scores.snaerp]);
  if (wine.sodme !== null && scores.sodme !== null) entries.push(['sodme', scores.sodme]);
  if (scores.pris !== null) entries.push(['pris', scores.pris]);
  if (scores.alkoholProsent !== null) entries.push(['alkoholProsent', scores.alkoholProsent]);

  let total = 0;
  let weightSum = 0;
  for (const [key, value] of entries) {
    const w = halfWeight.has(key) ? 0.2 : 1;
    total += value * w;
    weightSum += w;
  }
  return weightSum > 0 ? Math.round(total / weightSum) : 0;
}

function fmt(n: number | null | undefined): string {
  return n === null || n === undefined ? ' -- ' : String(n).padStart(3);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing Supabase env vars');
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

  const { data: tastings, error: tErr } = await supabase
    .from('tastings')
    .select(
      'id, wine_id, farge, lukt, smak, friskhet, fylde, sodme, snaerp, alkohol, pris, color_score, smell_score, taste_score, friskhet_score, fylde_score, sodme_score, snaerp_score, percentage_score, price_score, overall_score, karakter, created_at'
    )
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false });
  if (tErr || !tastings?.length) {
    console.error('No tastings:', tErr?.message);
    process.exit(1);
  }

  const wineIds = [...new Set(tastings.map(t => t.wine_id).filter(Boolean) as string[])];
  const { data: wines } = await supabase
    .from('wines')
    .select('id, name, color, smell, taste, friskhet, fylde, garvestoff, sodme, alcohol, price')
    .in('id', wineIds);
  const wineById = new Map(((wines as WineRow[] | null) ?? []).map(w => [w.id, w]));

  console.log(`User: ${profile.name} <${profile.email}>`);
  console.log(`Mode: ${execute ? 'EXECUTE (will write)' : 'DRY RUN'}`);
  console.log(`Tastings: ${tastings.length}\n`);

  const header = 'wine                                         col   smell          taste          overall';
  console.log(header);
  console.log('-'.repeat(header.length));

  let wrote = 0;
  let skipped = 0;
  const deltas = { smell: [] as number[], taste: [] as number[], overall: [] as number[] };

  for (const t of tastings as TastingRow[]) {
    const wine = t.wine_id ? wineById.get(t.wine_id) : null;
    if (!wine) {
      skipped++;
      continue;
    }

    const { colorScore, smellScore, tasteScore } = await calculateServerSideScores(
      t.farge ?? '',
      t.lukt ?? '',
      t.smak ?? '',
      wine.color ?? '',
      wine.smell ?? '',
      wine.taste ?? ''
    );

    const newOverall = computeOverall(wine, {
      farge: colorScore,
      lukt: smellScore,
      smak: tasteScore,
      friskhet: t.friskhet_score,
      fylde: t.fylde_score,
      snaerp: t.snaerp_score,
      sodme: t.sodme_score,
      pris: t.price_score,
      alkoholProsent: t.percentage_score
    });

    const dSmell = smellScore - (t.smell_score ?? 0);
    const dTaste = tasteScore - (t.taste_score ?? 0);
    const dOverall = newOverall - (t.overall_score ?? 0);
    deltas.smell.push(dSmell);
    deltas.taste.push(dTaste);
    deltas.overall.push(dOverall);

    const name = wine.name.slice(0, 44).padEnd(44);
    console.log(
      `${name} ${fmt(t.color_score)}→${fmt(colorScore)}  ${fmt(t.smell_score)}→${fmt(smellScore)} (${dSmell >= 0 ? '+' : ''}${dSmell})  ${fmt(t.taste_score)}→${fmt(tasteScore)} (${dTaste >= 0 ? '+' : ''}${dTaste})  ${fmt(t.overall_score)}→${fmt(newOverall)} (${dOverall >= 0 ? '+' : ''}${dOverall})`
    );

    if (execute) {
      const { error: uErr } = await supabase
        .from('tastings')
        .update({
          color_score: colorScore,
          smell_score: smellScore,
          taste_score: tasteScore,
          overall_score: newOverall,
          updated_at: new Date().toISOString()
        })
        .eq('id', t.id);
      if (uErr) {
        console.error(`  ! update failed for ${t.id}: ${uErr.message}`);
      } else {
        wrote++;
      }
    }
  }

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  console.log('\n' + '='.repeat(header.length));
  console.log(`Avg Δ smell   : ${avg(deltas.smell).toFixed(1)}`);
  console.log(`Avg Δ taste   : ${avg(deltas.taste).toFixed(1)}`);
  console.log(`Avg Δ overall : ${avg(deltas.overall).toFixed(1)}`);
  console.log(`Skipped (no wine joined): ${skipped}`);
  if (execute) console.log(`Wrote ${wrote} rows.`);
  else console.log(`\nDRY RUN — rerun with --execute to write these changes.`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
