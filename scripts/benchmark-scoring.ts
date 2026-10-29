#!/usr/bin/env npx tsx
/**
 * Regression gate for flavour scoring.
 *
 * Measures the properties the objective demands — reward correct picks, never
 * punish omissions — with controlled perturbations of real tastings, for every
 * soft engine asked for, and compares against the algorithm the directional
 * scorer replaced.
 *
 *   +HIT    user adds a descriptor the wine DOES have          want clearly > 0
 *   +WRONG  user adds a descriptor that is genuinely wrong      want <= 0
 *   +NEG    user NEGATES a descriptor the wine does have        want <= 0
 *           ("… ikke fat" on an oaked wine is a wrong call; without the
 *           negation rule it scored as a direct hit on "fat")
 *   MISS    reference note gains notes the user never said      want ~0
 *   r(len)  correlation of score with user note length          want ~0
 *   d/top1  discrimination guard: can it still tell the real
 *           wine from N random ones?
 *
 * "Genuinely wrong" is the load-bearing part. Sampling any lemma absent from the
 * reference silently includes legitimate inferences — a wine noted as "fat"
 * really does show vanilla — so a naive sampler measures the scorer punishing
 * correct reasoning and reports it as a virtue. Candidates here must be absent
 * from the reference, absent from its derivations, and outside its subcategories.
 *
 * The soft term comes from src/lib/softEngines, the same code production runs;
 * this file no longer carries a copy of it. The legacy comparison row is the
 * one piece that still embeds sentences itself, because nothing in production
 * does that any more.
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/benchmark-scoring.ts
 *     [--engines=openai,bert,colbert-word,colbert-token]   default: openai
 *     [--frozen=scripts/validation-results/frozen-set-2026-10.json]   cases from the frozen set instead of the live table
 *     [--style=on]   style-relative descriptor weights (STYLE_WEIGHTS_ENABLED) using the wine's category
 *     [--hybrid=on]  ladder-credited words count as full soft matches (SOFT_HYBRID_ENABLED)
 *     [--out=scripts/validation-results/<file>.md]   also writes <file>.json
 *
 * The sampler is seeded; two runs on the same data are identical.
 */
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  flavorOnlyText, norwegianLemmas, sanitizeText,
} from '../src/lib/lemmatizeAndWeight';
import { normalizeWineSynonyms } from '../src/lib/synonymNormalization';
import { derivedFrom } from '../src/lib/derivations';
import { combineScoreScaled, lexicalCredit, lemmasWithWeight } from '../src/lib/flavourScoring';
import { EMBEDDING_MODEL } from '../src/lib/scoringConfig';
import { cosineSimilarity } from '../src/lib/math';
import { applyNegation } from '../src/lib/negation';
import { getSoftEngineById, isSoftEngineId, type SoftEngine, type SoftEngineId } from '../src/lib/softEngines';
import { contentWords } from '../src/lib/softEngines/maxsim';
import { embedTokens } from '../src/lib/tokenEmbeddings';
import { mean, pearson, sd } from '../src/lib/stats';
import type { FrozenSet } from './export-frozen-set';
import { existsSync } from 'node:fs';
import { normalizeCategory } from '../src/lib/styleWeights';
import { hybridSoftScore } from '../src/lib/softEngines/hybrid';

const DISTRACTORS = 100;
const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const OUT = arg('out');
const FROZEN = arg('frozen');
const ENGINE_IDS: SoftEngineId[] = (arg('engines') ?? 'openai').split(',').map(s => s.trim()).filter(isSoftEngineId);
const STYLE = arg('style') === 'on';
const HYBRID = arg('hybrid') === 'on';
const SIDECAR = 'scripts/validation-results/frozen-set-2026-10.categories.json';
if (!ENGINE_IDS.length) throw new Error('--engines names no known engine');

// Everything printed is also collected, so --out can write it verbatim.
const lines: string[] = [];
const log = (...parts: unknown[]) => { const line = parts.join(' '); lines.push(line); console.log(line); };

// ── sentence embeddings, legacy comparison only ─────────────────────────────
const sentenceCache = new Map<string, Float32Array>();
async function embedBatch(input: string[]): Promise<number[][]> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input }),
    });
    if (res.ok) {
      const json = (await res.json()) as { data: { embedding: number[]; index: number }[] };
      return json.data.sort((a, b) => a.index - b.index).map(d => d.embedding);
    }
    if (res.status < 500 && res.status !== 429) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
  }
  throw new Error('OpenAI retries exhausted');
}

/** Negation, sanitising and synonym normalisation: what the ladder sees. */
const prep = (t: string) => normalizeWineSynonyms(sanitizeText(applyNegation(t).text));
/** Lightly cleaned original, for engines that need words in context. */
const rawOf = (t: string) => applyNegation(t).text;

// ── the algorithm being replaced, for comparison ────────────────────────────
const sumW = (m: Map<string, { weight: number }>) => [...m.values()].reduce((s, v) => s + v.weight, 0);
function legacyScore(userText: string, referenceText: string): number {
  const a = lemmasWithWeight(prep(userText));
  const b = lemmasWithWeight(prep(referenceText));
  if (!a.size || !b.size) return 0;
  const denom = Math.max(sumW(a), sumW(b)) || 1;

  let inter = 0;
  for (const [lemma, info] of a) if (b.has(lemma)) inter += info.weight;

  const mains = new Set([...b.values()].map(v => v.main).filter(Boolean));
  const subs = new Set([...b.values()].filter(v => v.main && v.sub).map(v => `${v.main}/${v.sub}`));
  let credit = 0;
  for (const info of a.values()) {
    if (!info.main) continue;
    const key = info.sub ? `${info.main}/${info.sub}` : null;
    if (key && subs.has(key)) credit += info.weight;
    else if (mains.has(info.main)) credit += info.weight * 0.5;
  }

  const userSentence = sentenceCache.get(flavorOnlyText(prep(userText)));
  const referenceSentence = sentenceCache.get(flavorOnlyText(prep(referenceText)));
  const semantic = userSentence && referenceSentence
    ? cosineSimilarity(userSentence, referenceSentence) * 100
    : 0;
  const precision = ((inter / denom) * 100 + (credit / denom) * 100) / 2;
  return Math.round(Math.min(100, semantic + precision * 0.35));
}

/** The wine's category for a reference note, when --style=on; null otherwise. */
const categoryOfReference = new Map<string, string | null>();

/** The production formula with the given engine supplying the soft term. */
function engineScorer(engine: SoftEngine) {
  const memo = new Map<string, number>();
  return async (userText: string, referenceText: string): Promise<number> => {
    const key = `${userText}\u0000${referenceText}`;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    const u = prep(userText), r = prep(referenceText);
    const soft = await engine.score({ raw: rawOf(userText), norm: u }, { raw: rawOf(referenceText), norm: r });
    const category = STYLE ? categoryOfReference.get(referenceText) ?? null : null;
    const lexical = lexicalCredit(u, r, { styleWeights: STYLE, category });
    const score = combineScoreScaled(lexical, HYBRID ? hybridSoftScore(soft, lexical) : soft.softScore).score;
    memo.set(key, score);
    return score;
  };
}

type Scorer = (u: string, w: string) => Promise<number> | number;

async function main() {
  const sb = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  type Field = { user: string; reference: string; isSmell: boolean; wineId: string | null };
  let fields: Field[];
  let source: string;
  // Every wine any tasting points at is kept out of the distractor pool, notes
  // or not — the pool, and with it the sampled perturbations, must not shift
  // when a tasting gains or loses a note.
  const tastedWineIds = new Set<string>();
  if (FROZEN) {
    const frozen = JSON.parse(readFileSync(FROZEN, 'utf8')) as FrozenSet;
    fields = frozen.fields.map(f => ({ user: f.userNote, reference: f.referenceNote, isSmell: f.field === 'lukt', wineId: f.wine.id }));
    for (const f of frozen.fields) tastedWineIds.add(f.wine.id);
    if (STYLE) {
      const sidecar = existsSync(SIDECAR) ? JSON.parse(readFileSync(SIDECAR, 'utf8')) as Record<string, string | null> : {};
      for (const f of frozen.fields) categoryOfReference.set(f.referenceNote, sidecar[f.wine.id] ?? null);
    }
    source = `${FROZEN} (${frozen.meta.fields} fields)${STYLE ? ', style weights on' : ''}${HYBRID ? ', hybrid soft on' : ''}`;
  } else {
    // Ordered: PostgREST guarantees nothing without it, and the seeded sampler
    // consumes randomness in row order, so an unordered query made every run
    // sample different perturbations (the phase 06 numbers suffered from this).
    const { data: tastings } = await sb.from('tastings').select('wine_id,lukt,smak').order('created_at').order('id').limit(500);
    const wineIds = [...new Set(tastings!.map(t => t.wine_id).filter(Boolean))] as string[];
    for (const id of wineIds) tastedWineIds.add(id);
    const { data: tasted } = await sb.from('wines').select('id,name,smell,taste,main_category').in('id', wineIds);
    const wineById = new Map(tasted!.map(w => [w.id, w]));
    fields = [];
    for (const t of tastings!) {
      const wine = wineById.get(t.wine_id!);
      if (!wine) continue;
      if (STYLE) { for (const ref of [wine.smell, wine.taste]) if (ref) categoryOfReference.set(ref, normalizeCategory(wine.main_category)); }
      if (t.lukt?.trim() && wine.smell?.trim()) fields.push({ user: t.lukt, reference: wine.smell, isSmell: true, wineId: wine.id });
      if (t.smak?.trim() && wine.taste?.trim()) fields.push({ user: t.smak, reference: wine.taste, isSmell: false, wineId: wine.id });
    }
    source = `live tastings table (${tastings!.length} tastings, ${fields.length} note fields)${STYLE ? ', style weights on' : ''}`;
  }

  const { data: pool } = await sb.from('wines').select('id,smell,taste,main_category')
    .not('taste', 'is', null).not('smell', 'is', null).order('id').range(2000, 2199);
  const distractors = pool!.filter(w => !tastedWineIds.has(w.id)).slice(0, DISTRACTORS);
  if (STYLE) for (const d of distractors) for (const ref of [d.smell, d.taste]) if (ref) categoryOfReference.set(ref, normalizeCategory(d.main_category));

  // Deterministic sampler — no Math.random, so runs are comparable.
  let seed = 20260818;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  const vocabulary = [...new Set(
    distractors.flatMap(d => [...lemmasWithWeight(prep(d.smell || '')).keys(), ...lemmasWithWeight(prep(d.taste || '')).keys()])
  )];

  type Case = { user: string; reference: string; plusHit: string; plusWrong: string; plusNeg: string; referencePlusExtra: string };
  const cases: Case[] = [];

  for (const f of fields) {
    const userNote = f.user, referenceNote = f.reference;
    const userLemmas = lemmasWithWeight(prep(userNote));
    const referenceLemmas = lemmasWithWeight(prep(referenceNote));
    const referenceSet = new Set(referenceLemmas.keys());
    const derived = derivedFrom(referenceSet);
    const referenceSubs = new Set(
      [...referenceLemmas.values()].filter(v => v.main && v.sub).map(v => `${v.main}/${v.sub}`)
    );

    const missed = [...referenceSet].filter(l => !userLemmas.has(l));
    if (!missed.length) continue;

    // A candidate is genuinely wrong only if the reference neither names it,
    // implies it, nor shares its subcategory.
    const isGenuinelyWrong = (lemma: string) => {
      if (referenceSet.has(lemma) || derived.has(lemma) || userLemmas.has(lemma)) return false;
      const entry = norwegianLemmas[lemma]?.categoryPath;
      if (entry?.main && entry.sub && referenceSubs.has(`${entry.main}/${entry.sub}`)) return false;
      return true;
    };

    const wrong: string[] = [];
    for (let k = 0; k < 200 && wrong.length < 1; k++) {
      const c = vocabulary[Math.floor(rnd() * vocabulary.length)];
      if (c && isGenuinelyWrong(c)) wrong.push(c);
    }
    const extras: string[] = [];
    for (let k = 0; k < 200 && extras.length < 3; k++) {
      const c = vocabulary[Math.floor(rnd() * vocabulary.length)];
      if (c && isGenuinelyWrong(c) && !extras.includes(c)) extras.push(c);
    }
    if (!wrong.length || extras.length < 3) continue;

    const hit = missed[Math.floor(rnd() * missed.length)];
    // The perturbed reference is the same wine: it must carry the same category.
    if (STYLE) categoryOfReference.set(`${referenceNote} ${extras.join(' ')}`, categoryOfReference.get(referenceNote) ?? null);
    cases.push({
      user: userNote,
      reference: referenceNote,
      plusHit: `${userNote} ${hit}`,
      plusWrong: `${userNote} ${wrong[0]}`,
      // Same descriptor as +HIT, but denied. The wine has it, so this is a
      // wrong call and must not pay.
      plusNeg: `${userNote} ikke ${hit}`,
      referencePlusExtra: `${referenceNote} ${extras.join(' ')}`,
    });
  }

  // Every text any scorer will see: warm the OpenAI token cache in one go
  // (the other engines cache per text internally) and the legacy sentences.
  const texts = new Set<string>();
  for (const c of cases) for (const t of [c.user, c.reference, c.plusHit, c.plusWrong, c.plusNeg, c.referencePlusExtra]) texts.add(t);
  for (const d of distractors) { if (d.smell) texts.add(d.smell); if (d.taste) texts.add(d.taste); }
  for (const f of fields) { texts.add(f.user); texts.add(f.reference); }

  if (ENGINE_IDS.includes('openai')) {
    const tokens = new Set<string>();
    for (const t of texts) for (const w of contentWords(prep(t))) tokens.add(w);
    process.stderr.write(`  warming ${tokens.size} token embeddings\n`);
    await embedTokens([...tokens]);
  }
  const sentences = [...new Set([...texts].map(t => flavorOnlyText(prep(t))).filter(Boolean))].filter(s => !sentenceCache.has(s));
  for (let i = 0; i < sentences.length; i += 256) {
    const chunk = sentences.slice(i, i + 256);
    const embeddings = await embedBatch(chunk);
    embeddings.forEach((e, j) => sentenceCache.set(chunk[j], Float32Array.from(e)));
    process.stderr.write(`  sentences ${Math.min(i + 256, sentences.length)}/${sentences.length}\r`);
  }

  const scorers: Array<[string, Scorer]> = [['previous (recall=ON)', legacyScore]];
  for (const id of ENGINE_IDS) {
    const engine = getSoftEngineById(id);
    const a = await engine.available();
    if (!a.ok) { log(`engine ${id} unavailable: ${a.reason}`); continue; }
    scorers.push([`current + ${id}`, engineScorer(engine)]);
  }

  let commit = 'unknown';
  try { commit = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* not a git checkout */ }

  log(`\n${'='.repeat(112)}`);
  log(`SCORING BENCHMARK — ${cases.length} controlled cases, ${distractors.length} distractors each`);
  log(`${new Date().toISOString().slice(0, 10)} · commit ${commit} · source: ${source}`);
  log(`Wrong-guess candidates exclude reference terms, their derivations, and their subcategories.`);
  log('='.repeat(112));
  log('scorer'.padEnd(26), 'base'.padStart(7), '+HIT'.padStart(8), '+WRONG'.padStart(8), '+NEG'.padStart(8),
    'MISS'.padStart(8), 'r(len)'.padStart(8), 'd'.padStart(7), 'top1%'.padStart(7));
  log('-'.repeat(112));

  type Row = { scorer: string; base: number; hit: number; wrong: number; neg: number; miss: number; rLen: number; d: number; top1: number; ms: number };
  const rows: Row[] = [];

  for (const [name, score] of scorers) {
    const started = performance.now();
    const base: number[] = [], dHit: number[] = [], dWrong: number[] = [], dNeg: number[] = [], dMiss: number[] = [], lengths: number[] = [];
    for (const c of cases) {
      const b = await score(c.user, c.reference);
      base.push(b);
      dHit.push((await score(c.plusHit, c.reference)) - b);
      dWrong.push((await score(c.plusWrong, c.reference)) - b);
      dNeg.push((await score(c.plusNeg, c.reference)) - b);
      dMiss.push((await score(c.user, c.referencePlusExtra)) - b);
      lengths.push(prep(c.user).split(' ').filter(Boolean).length);
    }

    const trueScores: number[] = [], randomScores: number[] = [];
    let top1 = 0, n = 0;
    for (const f of fields) {
      const s = await score(f.user, f.reference);
      trueScores.push(s); n++;
      const ds: number[] = [];
      for (const d of distractors) ds.push(await score(f.user, (f.isSmell ? d.smell : d.taste) || ''));
      randomScores.push(...ds);
      if (!ds.some(x => x > s)) top1++;
    }
    const d = (mean(trueScores) - mean(randomScores)) / (sd(randomScores) || 1);
    const fmt = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(1);
    const row: Row = {
      scorer: name, base: mean(base), hit: mean(dHit), wrong: mean(dWrong), neg: mean(dNeg), miss: mean(dMiss),
      rLen: pearson(base, lengths), d, top1: (top1 / n) * 100, ms: performance.now() - started,
    };
    rows.push(row);

    log(name.padEnd(26), row.base.toFixed(1).padStart(7), fmt(row.hit).padStart(8),
      fmt(row.wrong).padStart(8), fmt(row.neg).padStart(8), fmt(row.miss).padStart(8),
      row.rLen.toFixed(2).padStart(8), row.d.toFixed(2).padStart(7),
      row.top1.toFixed(0).padStart(7));
  }

  log('-'.repeat(112));
  log('+HIT   score change when the user adds a descriptor the wine DOES have    -> want clearly positive');
  log('+WRONG score change when the user adds a genuinely wrong descriptor       -> want <= 0');
  log('+NEG   score change when the user NEGATES a descriptor the wine has       -> want <= 0');
  log('MISS   score change when the REFERENCE gains notes the user never said    -> want ~0');
  log('r(len) correlation of score with user note length                         -> want ~0');
  log('d      separation of real-wine from random-wine scores, in SD units       -> higher is better');
  log('top1%  how often the real wine outranks every distractor (chance = 1%)    -> higher is better');

  if (OUT) {
    mkdirSync(dirname(OUT), { recursive: true });
    const md = [
      `# Scoring benchmark — ${new Date().toISOString().slice(0, 10)}`,
      '',
      `Generated by \`scripts/benchmark-scoring.ts\` at commit \`${commit}\`. Seeded sampler; re-running on the same data reproduces this table.`,
      '',
      '```text',
      ...lines.map(l => l.replace(/^\n/, '')),
      '```',
      '',
    ].join('\n');
    writeFileSync(OUT, md);
    const json = OUT.replace(/\.md$/, '') + '.json';
    writeFileSync(json, JSON.stringify({
      meta: { date: new Date().toISOString(), commit, source, cases: cases.length, distractors: distractors.length, engines: ENGINE_IDS, styleWeights: STYLE, hybridSoft: HYBRID },
      rows,
    }, null, 2) + '\n');
    console.log(`\nwritten ${OUT} and ${json}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
