#!/usr/bin/env npx tsx
/**
 * Training data for fine-tuning mLateOn (colbert-finetune-plan.md), built
 * around the question the score asks rather than the one ColBERT was trained
 * on.
 *
 * Measured 15 Nov 2026 (ColBERT used by the book, full notes, every token,
 * ranking the true wine among 150 of the same category): retrieval works —
 * the true wine sits at the 75th percentile — but the rank carries nothing
 * about the human ratings once the ladder is known (partial ρ 0.00). Retrieval
 * rewards words that are rare in the style; the rater rewards words that are
 * right. So the plan's contrastive phase is dropped and the training signal
 * is listwise per *document*: for one reference note, which of several
 * taster notes describes it best. That is the comparison a score makes.
 *
 * Rows are one reference note (one field of one wine; the score compares
 * lukt with lukt), carrying six candidate taster notes:
 *   - three written for it by gpt-4o-mini at rubric levels 4, 2 and 0,
 *   - the level-4 note padded with two words of the level-0 note, so the
 *     model learns that extra wrong words cost (without it the first pilot
 *     paid wrong guesses in 41 of 220 frozen fields),
 *   - the level-4 notes written for its two nearest training neighbours of
 *     the same category and field (by the cooc vectors) — plausible, partly
 *     right, the hard cases.
 * Every (note, reference) pair carries two teacher scores:
 *   teacher  the calibrated LLM rater (rate-with-llm.ts --calibrate=kristian
 *            prompt, gpt-4.1-mini by default), 0–4 — the opinion that is not
 *            the ladder;
 *   ladder   the lexical half of the production scorer, 0–100 — the same
 *            notes graded by the ladder, for the comparison run
 *            ("train on the ladder") without a second dataset.
 *
 * Held out, never in a training row and never a few-shot source: every wine
 * in the frozen evaluation set and every reference text equal to one of its
 * notes. A validation set of --val documents is carved out before sampling.
 * API results are cached in finetune/cache.json, so a rerun pays only for
 * what is new.
 *
 *   npx tsx scripts/build-colbert-pairs.ts [--docs=1000] [--val=200] [--gen-model=gpt-4o-mini] [--teacher=gpt-4.1-mini] [--strict] [--concurrency=8] [--out-suffix=-strict]
 *
 * Writes scripts/validation-results/finetune/{train,val}.jsonl (gitignored).
 */
import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { openai } from '@ai-sdk/openai';
import { generateText, Output } from 'ai';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { sanitizeText } from '../src/lib/lemmatizeAndWeight';
import { normalizeWineSynonyms } from '../src/lib/synonymNormalization';
import { applyNegation } from '../src/lib/negation';
import { combineScoreScaled, hasScoreableFlavour, lexicalCredit } from '../src/lib/flavourScoring';
import { contentWords } from '../src/lib/softEngines/maxsim';
import { seededRandom } from '../src/lib/stats';
import { loadRaterFiles, parseCsv } from './ratings-csv';
import type { FrozenSet } from './export-frozen-set';

loadEnv({ path: '.env.local', override: false });

const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const N_DOCS = Number(arg('docs') ?? 1000);
const N_VAL = Number(arg('val') ?? 200);
const GEN_MODEL = arg('gen-model') ?? 'gpt-4o-mini';
const TEACHER = arg('teacher') ?? 'gpt-4.1-mini';
const DIR = 'scripts/validation-results/finetune';
const CACHE = `${DIR}/cache.json`;
const FROZEN = 'scripts/validation-results/frozen-set-2026-10.json';
const CONCURRENCY = Number(arg('concurrency') ?? 8);
/**
 * --strict adds one rubric line: an unsupported descriptor lowers the rating.
 * The calibrated rubric alone lowered its rating for only 18 of 40 notes
 * padded with two wrong words (15 Nov 2026), and a model trained on it paid
 * wrong guesses in 41 of 220 frozen fields. Cached separately from the
 * lenient teacher.
 */
const STRICT = process.argv.includes('--strict');
const STRICT_LINE = `\n\nStrenghet: hvert stikkord vinen ikke støtter, trekker ned. Et notat med tre riktige og to ustøttede stikkord skal ha lavere vurdering enn de tre riktige alene; ustøttede tillegg kan aldri heve vurderingen.`;
const TEACHER_TAG = `${TEACHER}${STRICT ? '+strict' : ''}`;

const norm = (t: string) => normalizeWineSynonyms(sanitizeText(applyNegation(t).text));

type Doc = { id: string; wineId: string; wine: string; field: 'lukt' | 'smak'; category: string; text: string };
type Query = { text: string; level: number | null; source: 'own' | 'padded' | 'neighbour'; teacher: number | null; ladder: number; words?: string[] };
/** `words` are the content words the table engine scores (contentWords after the scorer's own cleaning), for training word by word. */
type Row = Doc & { queries: Query[]; words?: string[] };

// ── cache ────────────────────────────────────────────────────────────────────
mkdirSync(DIR, { recursive: true });
const cache: Record<string, unknown> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
let dirty = 0;
const saveCache = () => { writeFileSync(CACHE, JSON.stringify(cache)); dirty = 0; };
async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (key in cache) return cache[key] as T;
  for (let attempt = 0; ; attempt++) {
    try {
      const v = await fn();
      cache[key] = v;
      if (++dirty >= 50) saveCache();
      return v;
    } catch (e) {
      if (attempt >= 3) throw e;
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
}
async function pool<T, R>(items: T[], fn: (t: T) => Promise<R>, label: string): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0, done = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
      if (++done % 25 === 0) process.stderr.write(`  ${label}: ${done}/${items.length}\r`);
    }
  }));
  process.stderr.write(`  ${label}: ${items.length}/${items.length}\n`);
  return out;
}

// ── generator: three taster-style notes per reference ────────────────────────
const GenSchema = z.object({ level4: z.string(), level2: z.string(), level0: z.string() });
const GEN_SYSTEM = `Du skriver korte smakingsnotater slik vanlige deltakere i en vinklubb skriver dem — ikke slik Vinmonopolet skriver. Stilen: 2–7 ord (oftest 3–5), stikkord adskilt med mellomrom, komma eller punktum, ingen hele setninger, ingen vurderinger ("god", "elegant"). Av og til en skrivefeil eller dialektform (brioch, citrus, meineralsk). Eksempler på stil (ikke på innhold): "Rødt eple sitrus mineralsk" · "Fersken, plomme," · "kirsebær lær litt krydder" · "Mørke bær. Fat. Vanilje".

Du får Vinmonopolets notat for én vin (lukt eller smak). Skriv tre notater:
- level4: alle stikkord stemmer med vinen; minst to er spesifikke (gjerne mer presise enn notatet eller en riktig slutning, f.eks. vanilje når notatet sier fat).
- level2: riktig stil og familier, men få spesifikke treff; ett eller to stikkord bommer.
- level0: stikkord som ikke passer denne vinen (en annen stil), men som er vanlige vinord.`;

async function generate(doc: Doc) {
  return cached(`gen:${GEN_MODEL}:${doc.field}:${doc.text}`, async () => {
    const { output } = await generateText({
      model: openai(GEN_MODEL),
      output: Output.object({ schema: GenSchema }),
      temperature: 0.8,
      system: GEN_SYSTEM,
      prompt: `Kategori: ${doc.category}\nFelt: ${doc.field === 'lukt' ? 'lukt (aroma)' : 'smak'}\nVinmonopolets notat: ${doc.text}`,
    });
    return output;
  });
}

// ── teacher: the calibrated rubric (same text as rate-with-llm.ts) ────────────
const RUBRIC = readFileSync('scripts/rate-with-llm.ts', 'utf8').match(/const RUBRIC = `([\s\S]*?)`;/)![1];
const RateSchema = z.object({ rating: z.number().int().min(0).max(4), reason: z.string().max(300) });

function calibrationBlock(frozen: FrozenSet): string {
  const ratings = loadRaterFiles().get('kristian');
  if (!ratings) throw new Error('no rater-kristian.csv');
  const byKey = new Map(frozen.fields.map(f => [f.key, f]));
  const keys = new Set<string>();
  const rerate = 'scripts/validation-results/ratings/rerate-2026-10.csv';
  if (existsSync(rerate)) for (const r of parseCsv(readFileSync(rerate, 'utf8'))) if (ratings.has(r.key)) keys.add(r.key);
  for (const v of [0, 1, 2, 3, 4]) {
    let n = 0;
    for (const [k, r] of ratings) if (r === v && !keys.has(k) && byKey.has(k)) { keys.add(k); if (++n >= 3) break; }
  }
  const lines = [...keys].map(k => { const f = byKey.get(k)!; return `- ${f.field}-referanse "${f.referenceNote}" · notat "${f.userNote}" → ${ratings.get(k)}`; });
  return `\n\nEksempler vurdert av en erfaren smaker fra klubben (bruk samme strenghet):\n${lines.join('\n')}`;
}

async function rate(system: string, doc: Doc, note: string): Promise<number | null> {
  try {
    return await cached(`rate:${TEACHER_TAG}:${doc.field}:${doc.text}:${note}`, async () => {
      const { output } = await generateText({
        model: openai(TEACHER),
        output: Output.object({ schema: RateSchema }),
        temperature: 0,
        system,
        prompt: `Vin: ${doc.wine}\nFelt: ${doc.field === 'lukt' ? 'lukt (aroma)' : 'smak'}\nReferansenotat: ${doc.text}\nSmakerens notat: ${note}`,
      });
      return output.rating;
    });
  } catch {
    return null;
  }
}

// ── cooc note vectors, for same-style neighbours ─────────────────────────────
const coocTable = JSON.parse(readFileSync('src/lib/softEngines/cooc-table.generated.json', 'utf8')) as { words: Record<string, { q: string }> };
const decode = (b: string) => { const buf = Buffer.from(b, 'base64'); return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4); };
function noteVector(text: string): Float32Array | null {
  const vecs = contentWords(norm(text)).map(w => coocTable.words[w]).filter(Boolean).map(e => decode(e.q));
  if (!vecs.length) return null;
  const out = new Float32Array(vecs[0].length);
  for (const v of vecs) for (let i = 0; i < v.length; i++) out[i] += v[i];
  let n = 0; for (const x of out) n += x * x; n = Math.sqrt(n) || 1;
  for (let i = 0; i < out.length; i++) out[i] /= n;
  return out;
}
const dot = (a: Float32Array, b: Float32Array) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

/** The level-4 note with the first two words of the level-0 note appended, in the taster's own list style. */
function padded(right: string, wrong: string): string {
  const extra = wrong.split(/[,.\s]+/).filter(Boolean).slice(0, 2);
  return `${right.replace(/[.,\s]+$/, '')}, ${extra.join(', ')}`;
}

async function main() {
  const frozen = JSON.parse(readFileSync(FROZEN, 'utf8')) as FrozenSet;
  const heldWines = new Set(frozen.fields.map(f => f.wine.id));
  const heldTexts = new Set(frozen.fields.map(f => f.referenceNote.trim()));

  // ── catalogue ──────────────────────────────────────────────────────────────
  const sb = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const wines: Array<{ id: string; name: string; smell: string | null; taste: string | null; main_category: string | null }> = [];
  for (let from = 0; ; from += 1000) {
    // .order('id') is load-bearing: PostgREST pages overlap without it (CLAUDE.md).
    const { data, error } = await sb.from('wines').select('id,name,smell,taste,main_category').order('id').range(from, from + 999);
    if (error) throw error;
    wines.push(...(data ?? []));
    process.stderr.write(`  catalogue: ${wines.length}\r`);
    if (!data || data.length < 1000) break;
  }
  process.stderr.write('\n');

  // One document per distinct (field, reference text); identical notes on
  // several bottlings are one training example, not several.
  const docs = new Map<string, Doc>();
  for (const w of wines) {
    if (heldWines.has(w.id) || !w.main_category) continue;
    for (const field of ['lukt', 'smak'] as const) {
      const text = (field === 'lukt' ? w.smell : w.taste)?.trim();
      if (!text || heldTexts.has(text) || !hasScoreableFlavour(norm(text))) continue;
      const key = `${field}|${text}`;
      if (!docs.has(key)) docs.set(key, { id: key, wineId: w.id, wine: w.name, field, category: w.main_category, text });
    }
  }
  const rnd = seededRandom(20261115);
  const all = [...docs.values()].sort((a, b) => a.id.localeCompare(b.id)).sort(() => rnd() - 0.5);
  const val = all.slice(0, N_VAL);
  const valWines = new Set(val.map(d => d.wineId));
  const train = all.slice(N_VAL).filter(d => !valWines.has(d.wineId)).slice(0, N_DOCS);
  console.log(`catalogue ${wines.length} wines → ${docs.size} scoreable documents; train ${train.length}, val ${val.length}; held out ${heldWines.size} frozen wines`);

  // ── generate notes ─────────────────────────────────────────────────────────
  const both = [...train, ...val];
  const gens = await pool(both, generate, 'generate');
  saveCache();
  const genOf = new Map(both.map((d, i) => [d.id, gens[i]]));

  // ── neighbours within each split, same category and field ───────────────────
  const vecs = new Map(both.map(d => [d.id, noteVector(d.text)]));
  const neighbours = (d: Doc, split: Doc[]) => {
    const v = vecs.get(d.id);
    if (!v) return [];
    return split
      .filter(o => o.id !== d.id && o.field === d.field && o.category === d.category && o.wineId !== d.wineId && vecs.get(o.id))
      .map(o => ({ o, s: dot(v, vecs.get(o.id)!) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 2)
      .map(x => x.o);
  };

  const system = RUBRIC + (STRICT ? STRICT_LINE : '') + calibrationBlock(frozen);
  const ladder = (note: string, ref: string) => combineScoreScaled(lexicalCredit(norm(note), norm(ref)), 0, true, { hitWeight: 1 }).score;

  for (const [name, split] of [['train', train], ['val', val]] as const) {
    const rows: Row[] = split.map(d => {
      const g = genOf.get(d.id)!;
      const qs: Query[] = [
        { text: g.level4, level: 4, source: 'own', teacher: null, ladder: 0 },
        { text: g.level2, level: 2, source: 'own', teacher: null, ladder: 0 },
        { text: g.level0, level: 0, source: 'own', teacher: null, ladder: 0 },
        // The padding case: a right note with two wrong words appended. Without
        // it the model never sees "right + wrong" and learned to pay for extra
        // words (first pilot: wrong guesses paid in 41 of 220 fields).
        { text: padded(g.level4, g.level0), level: null, source: 'padded', teacher: null, ladder: 0 },
        ...neighbours(d, split).map(o => ({ text: genOf.get(o.id)!.level4, level: null, source: 'neighbour' as const, teacher: null, ladder: 0 })),
      ];
      for (const q of qs) { q.ladder = ladder(q.text, d.text); q.words = contentWords(norm(q.text)); }
      return { ...d, queries: qs, words: contentWords(norm(d.text)) };
    });
    const pairs = rows.flatMap(r => r.queries.map(q => ({ r, q })));
    const scores = await pool(pairs, ({ r, q }) => rate(system, r, q.text), `teacher ${name}`);
    pairs.forEach((p, i) => { p.q.teacher = scores[i]; });
    saveCache();
    const kept = rows.filter(r => r.queries.filter(q => q.teacher !== null).length >= 3);
    writeFileSync(`${DIR}/${name}${arg('out-suffix') ?? ''}.jsonl`, kept.map(r => JSON.stringify(r)).join('\n') + '\n');
    const t = kept.flatMap(r => r.queries).filter(q => q.teacher !== null);
    const byLevel = (l: number | null) => { const x = t.filter(q => q.level === l).map(q => q.teacher!); return x.length ? (x.reduce((a, b) => a + b, 0) / x.length).toFixed(2) : '—'; };
    const mean = (x: number[]) => (x.length ? (x.reduce((a, b) => a + b, 0) / x.length).toFixed(2) : '—');
    console.log(`${name}: ${kept.length} documents, ${t.length} rated pairs; mean teacher by level 4/2/0: ${byLevel(4)} / ${byLevel(2)} / ${byLevel(0)}; padded ${mean(t.filter(q => q.source === 'padded').map(q => q.teacher!))}; neighbour ${mean(t.filter(q => q.source === 'neighbour').map(q => q.teacher!))}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
