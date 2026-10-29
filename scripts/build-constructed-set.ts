#!/usr/bin/env npx tsx
/**
 * A graded evaluation set with ratings known by construction.
 *
 * For every distinct reference note in the frozen set, an LLM writes four
 * taster-style notes, one per rubric level 4/3/2/0, in the register and
 * length real tasters use (two to seven words, median four). The rating is
 * not the model's opinion: each note is checked against the credit ladder
 * and kept only if it has the structure its level demands —
 *
 *   4  every descriptor earns direct, derived or specific credit; ≥ 2 of them
 *   3  all but one descriptor earn credit; ≥ 1 does
 *   2  no direct/derived/specific credit, but ≥ 1 category or subcategory hit
 *   0  no descriptor earns anything at any rung
 *
 * — so the set is independent of any rater, and of how the LLM would have
 * rated. Rejections are counted and reported. The scorer is then judged on
 * whether it orders the levels: Spearman(score, level) across the set and
 * the share of (higher level, lower level) pairs on the same reference that
 * it ranks correctly.
 *
 * The lexical half of the scorer sees the same ladder that validated the
 * notes, so this set cannot find a lexical failure by construction; what it
 * tests is whether the soft term and the combination preserve the order the
 * ladder established, on notes written the way people write them.
 *
 * Writes scripts/validation-results/constructed-set-<YYYY-MM>.json (frozen:
 * not overwritten without --force) and a results table per engine.
 *
 *   npx tsx --env-file=.env.local scripts/build-constructed-set.ts [--engines=openai,bert,colbert-word,colbert-token] [--model=gpt-4o-mini] [--force]
 */
import { openai } from '@ai-sdk/openai';
import { generateText, Output } from 'ai';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { sanitizeText } from '../src/lib/lemmatizeAndWeight';
import { normalizeWineSynonyms } from '../src/lib/synonymNormalization';
import { applyNegation } from '../src/lib/negation';
import { combineScoreScaled, hasScoreableFlavour, lexicalCredit } from '../src/lib/flavourScoring';
import { getSoftEngineById, isSoftEngineId, type SoftEngineId } from '../src/lib/softEngines';
import { mean, spearman } from '../src/lib/stats';
import type { FrozenSet } from './export-frozen-set';

const DATE = new Date().toISOString().slice(0, 7);
const OUT = `scripts/validation-results/constructed-set-${DATE}.json`;
const REPORT = `scripts/validation-results/constructed-set-${DATE}.md`;
const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const MODEL = arg('model') ?? 'gpt-4o-mini';
const ENGINE_IDS: SoftEngineId[] = (arg('engines') ?? 'openai,bert,colbert-word,colbert-token').split(',').map(s => s.trim()).filter(isSoftEngineId);
const FORCE = process.argv.includes('--force');
const LEVELS = [4, 3, 2, 0] as const;

const Schema = z.object({
  level4: z.string(), level3: z.string(), level2: z.string(), level0: z.string(),
});

const PROMPT = `Du skriver korte smakingsnotater slik vanlige smakere i en vinklubb skriver dem: to til sju ord, gjerne bare deskriptorer adskilt med komma, ingen hele setninger, ingen strukturord (fyldig, frisk, lang, balansert, tanniner). Du får Vinmonopolets referansenotat for en vin. Skriv fire notater:

level4: tre deskriptorer som alle stemmer med vinen, minst to spesifikke (f.eks. "solbær" heller enn "frukt"). Bruk gjerne andre ord enn referansen for samme ting (brioche for bakverk, vanilje for fat, grapefrukt for sitrus).
level3: tre deskriptorer der to stemmer og én er en liten bom i nærheten (feil bær, feil krydder).
level2: to-tre vage ord i riktig familie uten spesifikke treff ("frukt", "bær", "krydder" på en vin med solbær og pepper), eller ett spesifikt ord i riktig familie men feil ting.
level0: to-tre deskriptorer som ikke finnes i vinen og hører til en helt annen vinstil (f.eks. tropisk frukt og honning på en kraftig rødvin).

Bare notatene, på norsk, små bokstaver, ingen forklaring.`;

const prep = (t: string) => normalizeWineSynonyms(sanitizeText(applyNegation(t).text));

function levelOf(note: string, reference: string): 4 | 3 | 2 | 0 | null {
  const n = prep(note), r = prep(reference);
  const { matches } = lexicalCredit(n, r);
  if (matches.length < 2) return null;
  const words = n.split(' ').filter(Boolean).length;
  if (words < 2 || words > 7) return null;
  const strong = matches.filter(m => m.kind === 'direct' || m.kind === 'derived' || m.kind === 'specific').length;
  const weak = matches.filter(m => m.kind === 'subcategory' || m.kind === 'category').length;
  const none = matches.filter(m => m.kind === 'none').length;
  if (strong >= 2 && none === 0 && weak === 0) return 4;
  if (strong >= 1 && strong === matches.length - 1 && none + weak === 1) return 3;
  if (strong === 0 && weak >= 1) return 2;
  if (strong === 0 && weak === 0 && none === matches.length) return 0;
  return null;
}

function latestFrozen(): string {
  const files = readdirSync('scripts/validation-results').filter(f => /^frozen-set-.*\.json$/.test(f)).sort();
  return join('scripts/validation-results', files[files.length - 1]);
}

type Item = { referenceKey: string; wine: string; field: 'lukt' | 'smak'; referenceNote: string; note: string; level: 4 | 3 | 2 | 0 };

async function build(): Promise<{ items: Item[]; generated: number; rejected: Record<string, number> }> {
  const frozen = JSON.parse(readFileSync(latestFrozen(), 'utf8')) as FrozenSet;
  const refs = new Map<string, { wine: string; field: 'lukt' | 'smak'; referenceNote: string }>();
  for (const f of frozen.fields) {
    if (!hasScoreableFlavour(prep(f.referenceNote))) continue;
    refs.set(`${f.wine.id}:${f.field}`, { wine: f.wine.name, field: f.field, referenceNote: f.referenceNote });
  }
  const items: Item[] = [];
  const rejected: Record<string, number> = {};
  let generated = 0, done = 0;
  const entries = [...refs.entries()];
  for (let i = 0; i < entries.length; i += 5) {
    await Promise.all(entries.slice(i, i + 5).map(async ([key, ref]) => {
      let output: z.infer<typeof Schema> | null = null;
      for (let attempt = 0; attempt < 3 && !output; attempt++) {
        try {
          ({ output } = await generateText({ model: openai(MODEL), output: Output.object({ schema: Schema }), temperature: 0.7, system: PROMPT, prompt: `Felt: ${ref.field}\nReferansenotat: ${ref.referenceNote}` }));
        } catch { await new Promise(r => setTimeout(r, 1500 * (attempt + 1))); }
      }
      if (!output) return;
      for (const level of LEVELS) {
        const note = output[`level${level}` as keyof typeof output].trim();
        generated++;
        const got = levelOf(note, ref.referenceNote);
        if (got === level) items.push({ referenceKey: key, wine: ref.wine, field: ref.field, referenceNote: ref.referenceNote, note, level });
        else rejected[`asked ${level}, ladder says ${got ?? 'unusable'}`] = (rejected[`asked ${level}, ladder says ${got ?? 'unusable'}`] ?? 0) + 1;
      }
    }));
    done += Math.min(5, entries.length - i);
    process.stderr.write(`  generated ${done}/${entries.length} references\r`);
  }
  return { items, generated, rejected };
}

async function main() {
  let set: { meta: Record<string, unknown>; items: Item[] };
  if (existsSync(OUT) && !FORCE) {
    set = JSON.parse(readFileSync(OUT, 'utf8'));
    console.log(`using existing ${OUT} (${set.items.length} items)`);
  } else {
    const { items, generated, rejected } = await build();
    let commit = 'unknown';
    try { commit = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* ignore */ }
    set = { meta: { builtAt: new Date().toISOString(), commit, model: MODEL, generated, kept: items.length, rejected }, items };
    writeFileSync(OUT, JSON.stringify(set, null, 2) + '\n');
    console.log(`written ${OUT}: kept ${items.length} of ${generated} generated notes`);
  }

  const lines: string[] = [`# Constructed set — ${new Date().toISOString().slice(0, 10)}`, '', `Set \`${OUT}\`: ${set.items.length} notes over ${new Set(set.items.map(i => i.referenceKey)).size} references, built by ${set.meta.model}, kept ${set.meta.kept} of ${set.meta.generated} generated (${JSON.stringify(set.meta.rejected)}).`, ''];
  const log = (s = '') => { lines.push(s); console.log(s); };
  const byLevel: Record<number, number> = {};
  for (const i of set.items) byLevel[i.level] = (byLevel[i.level] ?? 0) + 1;
  log(`Notes per level: ${LEVELS.map(l => `${l}: ${byLevel[l] ?? 0}`).join(', ')}.`);
  log();
  log('| engine | Spearman(score, level) | pairwise order accuracy | mean score at 4 / 3 / 2 / 0 |');
  log('| --- | --- | --- | --- |');
  for (const id of ENGINE_IDS) {
    const engine = getSoftEngineById(id);
    if (!(await engine.available()).ok) { log(`| ${id} | unavailable | | |`); continue; }
    const scores = new Map<Item, number>();
    for (const item of set.items) {
      const n = prep(item.note), r = prep(item.referenceNote);
      const soft = await engine.score({ raw: applyNegation(item.note).text, norm: n }, { raw: applyNegation(item.referenceNote).text, norm: r });
      scores.set(item, combineScoreScaled(lexicalCredit(n, r), soft.softScore).score);
    }
    const rho = spearman(set.items.map(i => scores.get(i)!), set.items.map(i => i.level));
    let correct = 0, total = 0;
    const groups = new Map<string, Item[]>();
    for (const i of set.items) (groups.get(i.referenceKey) ?? groups.set(i.referenceKey, []).get(i.referenceKey)!).push(i);
    for (const g of groups.values()) for (const a of g) for (const b of g) if (a.level > b.level) { total++; if (scores.get(a)! > scores.get(b)!) correct++; }
    const means = LEVELS.map(l => { const xs = set.items.filter(i => i.level === l).map(i => scores.get(i)!); return xs.length ? mean(xs).toFixed(1) : '—'; });
    log(`| ${id} | ${rho.toFixed(3)} | ${total ? ((correct / total) * 100).toFixed(1) : '—'}% (${correct}/${total}) | ${means.join(' / ')} |`);
  }
  log();
  log('Pairwise accuracy counts every (higher, lower) level pair on the same reference; chance is 50%. The lexical half shares the ladder that validated the notes, so this measures whether the soft term and the combination keep that order on notes written the way tasters write them.');
  writeFileSync(REPORT, lines.join('\n') + '\n');
  console.log(`\nwritten ${REPORT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
