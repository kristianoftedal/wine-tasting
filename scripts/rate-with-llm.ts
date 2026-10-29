#!/usr/bin/env npx tsx
/**
 * LLM panel as stand-in raters for the frozen set.
 *
 * Each model rates every field with the same rubric and worked examples the
 * human sheet carries (ratings/README.md) and writes rater-llm-<model>.csv in
 * the sheet's format, so scripts/evaluate-human-agreement.ts and the demo's
 * extract treat it like any other rater. Run it with several *different*
 * models: temperature 0 everywhere, so disagreement between files is
 * disagreement between models, not sampling noise.
 *
 * A model and an embedding scorer can share blind spots, so a panel is only
 * a stand-in once it has been calibrated against a person: the agreement
 * script reports Spearman between every pair of rater files, which is where
 * a 40–60 field human sample (ratings/calibration-sample-*.csv) shows whether
 * the panel can be trusted on the rest.
 *
 *   npx tsx --env-file=.env.local scripts/rate-with-llm.ts [--models=gpt-4o-mini,gpt-4.1-mini,gpt-4o] [--limit=N]
 *
 * --calibrate=<rater>  adds that rater's ratings as worked examples in the
 * prompt (the fields the rater re-rated, plus a few spanning the scale),
 * writes rater-llmcal-<model>.csv, and leaves the example fields unrated so
 * the agreement measured afterwards is on fields the panel never saw rated.
 */
import { parseCsv, loadRaterFiles } from './ratings-csv';
import { openai } from '@ai-sdk/openai';
import { generateText, Output } from 'ai';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { FrozenSet } from './export-frozen-set';

const RATINGS_DIR = 'scripts/validation-results/ratings';
const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const MODELS = (arg('models') ?? 'gpt-4o-mini,gpt-4.1-mini,gpt-4o').split(',').map(s => s.trim()).filter(Boolean);
const LIMIT = Number(arg('limit') ?? 0) || Infinity;
const CALIBRATE = arg('calibrate');
const RERATE_SHEET = 'scripts/validation-results/ratings/rerate-2026-10.csv';
const CONCURRENCY = 6;

const RUBRIC = `Du vurderer hvor treffsikkert et smakingsnotat beskriver en vin. Du får Vinmonopolets referansenotat for vinen og det smakeren skrev. Vurder bare det smakeren skrev, opp mot vinen, ikke mot ordlyden i referansen: "vanilje" på en fatlagret vin er riktig selv om referansen bare sier "fat"; "brioche" er riktig der referansen sier "bakverk". Lengde er ingen dyd: ett presist, riktig deskriptorord slår fire vage. Strukturord (fyldig, frisk, lang, balansert) teller ikke som deskriptorer; består notatet bare av slike, har det ingen deskriptorer og får 1 eller 0.

Skala:
4 = Alle deskriptorer støttes av vinen; minst to er spesifikke
3 = Stort sett støttet, én mindre bom eller ett vagt ord
2 = Riktig stil og familier, få spesifikke treff
1 = Stort sett ustøttet, ett eller to heldige treff
0 = Ingenting støttes, eller motsier vinen

Eksempler (samme vin, Champagne Aubry Premier Cru Brut, lukt: "Litt utviklet og mineralsk, preg av gule epler, steinfrukt, kjeks, litt sitrus, røde bær og flint."):
- "Rødt eple sitrus mineralsk" → 4 (tre deskriptorer, alle i vinen, to spesifikke; rødt mot gult er en fargekrangel, ikke en bom)
- "Fersken, plomme," → 2 (steinfrukt er der, plomme er det ikke; riktig familie, ett spesifikt treff)
- "Mineral. Frukt. Nøtt. Krydder" → 2 (mineral riktig, frukt sier ingenting, nøtt forsvarlig på utviklet champagne, krydder ustøttet)
- smak-referanse "God fylde og lengde, preg av syrlige epler, sitrus, litt jordbær, fersken, bakverk og mineraler.", notat "Brioche, Sitrus" → 4 (to spesifikke, begge støttet; kort notat kan få 4)

Svar med rating (heltall 0–4) og én setning begrunnelse på norsk.`;

const Schema = z.object({ rating: z.number().int().min(0).max(4), reason: z.string().max(300) });

const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

function latestFrozen(): string {
  const files = readdirSync('scripts/validation-results').filter(f => /^frozen-set-.*\.json$/.test(f)).sort();
  return join('scripts/validation-results', files[files.length - 1]);
}

/** Few-shot block from a human rater: the re-rated fields plus a spread across the scale. Returns the block and the keys used. */
function calibrationExamples(frozen: FrozenSet, rater: string): { block: string; keys: Set<string> } {
  const ratings = loadRaterFiles().get(rater);
  if (!ratings) throw new Error(`no rater file for ${rater}`);
  const byKey = new Map(frozen.fields.map(f => [f.key, f]));
  const keys = new Set<string>();
  const rerated = existsSync(RERATE_SHEET) ? parseCsv(readFileSync(RERATE_SHEET, 'utf8')).map(r => r.key).filter(k => ratings.has(k)) : [];
  for (const k of rerated) keys.add(k);
  // Spread: up to three fields per rating value not already included, deterministic.
  for (const v of [0, 1, 2, 3, 4]) {
    let n = 0;
    for (const [k, r] of ratings) { if (r === v && !keys.has(k) && byKey.has(k)) { keys.add(k); if (++n >= 3) break; } }
  }
  const lines = [...keys].map(k => { const f = byKey.get(k)!; return `- ${f.field}-referanse "${f.referenceNote}" · notat "${f.userNote}" → ${ratings.get(k)}`; });
  return { block: `\n\nEksempler vurdert av en erfaren smaker fra klubben (bruk samme strenghet):\n${lines.join('\n')}`, keys };
}

async function rateOne(model: string, field: FrozenSet['fields'][number], extra = '') {
  const { output } = await generateText({
    model: openai(model),
    output: Output.object({ schema: Schema }),
    temperature: 0,
    system: RUBRIC + extra,
    prompt: `Vin: ${field.wine.name}${field.wine.year ? ` ${field.wine.year}` : ''}\nFelt: ${field.field === 'lukt' ? 'lukt (aroma)' : 'smak'}\nReferansenotat: ${field.referenceNote}\nSmakerens notat: ${field.userNote}`,
  });
  return output;
}

async function main() {
  const frozen = JSON.parse(readFileSync(arg('frozen') ?? latestFrozen(), 'utf8')) as FrozenSet;
  const calibration = CALIBRATE ? calibrationExamples(frozen, CALIBRATE) : null;
  if (calibration) console.log(`calibrating on ${calibration.keys.size} examples from ${CALIBRATE}; those fields are left unrated`);
  const fields = frozen.fields.filter(f => !calibration?.keys.has(f.key)).slice(0, LIMIT);
  mkdirSync(RATINGS_DIR, { recursive: true });
  for (const model of MODELS) {
    const out = join(RATINGS_DIR, `rater-${calibration ? 'llmcal' : 'llm'}-${model}.csv`);
    if (existsSync(out)) { console.log(`${out} exists, skipping (delete it to re-rate)`); continue; }
    const rows: string[] = [];
    let failed = 0, done = 0;
    try { await rateOne(model, fields[0], calibration?.block); } catch (e) { console.error(`${model}: ${e instanceof Error ? e.message.split('\n')[0] : e}; skipping model`); continue; }
    for (let i = 0; i < fields.length; i += CONCURRENCY) {
      const batch = fields.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map(async f => {
        for (let attempt = 0; attempt < 3; attempt++) {
          try { return { f, r: await rateOne(model, f, calibration?.block) }; } catch { await new Promise(r => setTimeout(r, 1500 * (attempt + 1))); }
        }
        failed++;
        return { f, r: null };
      }));
      for (const { f, r } of results) {
        rows.push([f.key, f.event?.name ?? '', f.event?.date?.slice(0, 10) ?? '', `${f.wine.name}${f.wine.year ? ` ${f.wine.year}` : ''}`, f.field, f.referenceNote, f.userNote, r ? r.rating : '', r ? r.reason : '', ''].map(q).join(';'));
      }
      done += batch.length;
      process.stderr.write(`  ${model}: ${done}/${fields.length}\r`);
    }
    const header = ['key', 'event', 'event_date', 'wine', 'field', 'reference_note', 'user_note', 'rating', 'comment', 'attended'].join(';');
    writeFileSync(out, '﻿' + [header, ...rows].join('\n') + '\n');
    console.log(`written ${out}: ${rows.length} rows, ${failed} failed`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
