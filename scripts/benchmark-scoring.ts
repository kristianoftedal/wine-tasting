#!/usr/bin/env npx tsx
/**
 * Regression gate for flavour scoring.
 *
 * Measures the properties the objective demands — reward correct picks, never
 * punish omissions — with controlled perturbations of real tastings, and
 * compares the current algorithm against the one it replaced.
 *
 *   +HIT    user adds a descriptor the wine DOES have          want clearly > 0
 *   +WRONG  user adds a descriptor that is genuinely wrong      want <= 0
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
 * Run: npx tsx --env-file=.env.local scripts/benchmark-scoring.ts
 */
import { createClient } from '@supabase/supabase-js';
import {
  flavorOnlyText, norwegianLemmas, sanitizeText, stripGenericTerms,
} from '../src/lib/lemmatizeAndWeight';
import { normalizeWineSynonyms } from '../src/lib/synonymNormalization';
import { derivedFrom } from '../src/lib/derivations';
import { combineScore, lexicalCredit, lemmasWithWeight } from '../src/lib/flavourScoring';
import { EMBEDDING_MODEL } from '../src/lib/scoringConfig';
import { centerEmbedding } from '../src/lib/embeddingCentering';
import { cosineSimilarity } from '../src/lib/math';

const DISTRACTORS = 100;

// ── embedding cache ─────────────────────────────────────────────────────────
const cache = new Map<string, Float32Array>();
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
async function warmCache(texts: string[], center: boolean) {
  const todo = [...new Set(texts.filter(t => t && !cache.has(t)))];
  for (let i = 0; i < todo.length; i += 256) {
    const chunk = todo.slice(i, i + 256);
    const embeddings = await embedBatch(chunk);
    embeddings.forEach((e, j) => cache.set(chunk[j], center ? centerEmbedding(e) : Float32Array.from(e)));
    process.stderr.write(`  embedding ${Math.min(i + 256, todo.length)}/${todo.length}\r`);
  }
}

const prep = (t: string) => normalizeWineSynonyms(sanitizeText(t));
const tokensOf = (t: string) => [...new Set(stripGenericTerms(t).split(' ').filter(Boolean))];

/** Token-level MaxSim precision, mirroring src/lib/semanticSimilarity.ts. */
function softRaw(userText: string, referenceText: string): number {
  const u = tokensOf(userText).map(t => cache.get(t)).filter(Boolean) as Float32Array[];
  const r = tokensOf(referenceText).map(t => cache.get(t)).filter(Boolean) as Float32Array[];
  if (!u.length || !r.length) return 0;
  let sum = 0;
  for (const uv of u) {
    let best = -Infinity;
    for (const rv of r) { const s = cosineSimilarity(uv, rv); if (s > best) best = s; }
    sum += best;
  }
  return sum / u.length;
}

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

  const userSentence = cache.get(`SENT:${flavorOnlyText(prep(userText))}`);
  const referenceSentence = cache.get(`SENT:${flavorOnlyText(prep(referenceText))}`);
  const semantic = userSentence && referenceSentence
    ? cosineSimilarity(userSentence, referenceSentence) * 100
    : 0;
  const precision = ((inter / denom) * 100 + (credit / denom) * 100) / 2;
  return Math.round(Math.min(100, semantic + precision * 0.35));
}

function currentScore(userText: string, referenceText: string): number {
  const u = prep(userText), r = prep(referenceText);
  return combineScore(lexicalCredit(u, r), softRaw(u, r)).score;
}

// ── statistics ──────────────────────────────────────────────────────────────
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const sd = (a: number[]) => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
const pearson = (x: number[], y: number[]) => {
  const mx = mean(x), my = mean(y);
  let n = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < x.length; i++) { const dx = x[i] - mx, dy = y[i] - my; n += dx * dy; dx2 += dx * dx; dy2 += dy * dy; }
  return dx2 && dy2 ? n / Math.sqrt(dx2 * dy2) : 0;
};

async function main() {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: tastings } = await sb.from('tastings').select('wine_id,lukt,smak').limit(500);
  const wineIds = [...new Set(tastings!.map(t => t.wine_id).filter(Boolean))] as string[];
  const { data: tasted } = await sb.from('wines').select('id,name,smell,taste').in('id', wineIds);
  const wineById = new Map(tasted!.map(w => [w.id, w]));

  const { data: pool } = await sb.from('wines').select('id,smell,taste')
    .not('taste', 'is', null).not('smell', 'is', null).range(2000, 2199);
  const distractors = pool!.filter(w => !wineIds.includes(w.id)).slice(0, DISTRACTORS);

  // Deterministic sampler — no Math.random, so runs are comparable.
  let seed = 20260818;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  const vocabulary = [...new Set(
    distractors.flatMap(d => [...lemmasWithWeight(prep(d.smell || '')).keys(), ...lemmasWithWeight(prep(d.taste || '')).keys()])
  )];

  type Case = { user: string; reference: string; plusHit: string; plusWrong: string; referencePlusExtra: string };
  const cases: Case[] = [];

  for (const t of tastings!) {
    const wine = wineById.get(t.wine_id!);
    if (!wine) continue;
    for (const [userNote, referenceNote] of [[t.lukt, wine.smell], [t.smak, wine.taste]] as const) {
      if (!userNote?.trim() || !referenceNote?.trim()) continue;

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

      cases.push({
        user: userNote,
        reference: referenceNote,
        plusHit: `${userNote} ${missed[Math.floor(rnd() * missed.length)]}`,
        plusWrong: `${userNote} ${wrong[0]}`,
        referencePlusExtra: `${referenceNote} ${extras.join(' ')}`,
      });
    }
  }

  // Warm both caches: individual tokens (centered, for MaxSim) and whole
  // sentences (uncentered, for the legacy comparison).
  const tokens = new Set<string>();
  const sentences = new Set<string>();
  const register = (t: string) => {
    if (!t?.trim()) return;
    for (const tok of tokensOf(prep(t))) tokens.add(tok);
    sentences.add(`SENT:${flavorOnlyText(prep(t))}`);
  };
  for (const c of cases) { register(c.user); register(c.reference); register(c.plusHit); register(c.plusWrong); register(c.referencePlusExtra); }
  for (const d of distractors) { register(d.smell || ''); register(d.taste || ''); }

  await warmCache([...tokens], true);
  const sentenceTexts = [...sentences];
  const rawSentences = sentenceTexts.map(s => s.slice(5));
  const todo = rawSentences.filter(s => s && !cache.has(`SENT:${s}`));
  for (let i = 0; i < todo.length; i += 256) {
    const chunk = todo.slice(i, i + 256);
    const embeddings = await embedBatch(chunk);
    embeddings.forEach((e, j) => cache.set(`SENT:${chunk[j]}`, Float32Array.from(e)));
    process.stderr.write(`  sentences ${Math.min(i + 256, todo.length)}/${todo.length}\r`);
  }

  const scorers: Array<[string, (u: string, w: string) => number]> = [
    ['previous (recall=ON)', legacyScore],
    ['current (directional)', currentScore],
  ];

  console.log(`\n${'='.repeat(104)}`);
  console.log(`SCORING BENCHMARK — ${cases.length} controlled cases, ${distractors.length} distractors each`);
  console.log(`Wrong-guess candidates exclude reference terms, their derivations, and their subcategories.`);
  console.log('='.repeat(104));
  console.log('scorer'.padEnd(26), 'base'.padStart(7), '+HIT'.padStart(8), '+WRONG'.padStart(8),
    'MISS'.padStart(8), 'r(len)'.padStart(8), 'd'.padStart(7), 'top1%'.padStart(7));
  console.log('-'.repeat(104));

  for (const [name, score] of scorers) {
    const base: number[] = [], dHit: number[] = [], dWrong: number[] = [], dMiss: number[] = [], lengths: number[] = [];
    for (const c of cases) {
      const b = score(c.user, c.reference);
      base.push(b);
      dHit.push(score(c.plusHit, c.reference) - b);
      dWrong.push(score(c.plusWrong, c.reference) - b);
      dMiss.push(score(c.user, c.referencePlusExtra) - b);
      lengths.push(prep(c.user).split(' ').filter(Boolean).length);
    }

    const trueScores: number[] = [], randomScores: number[] = [];
    let top1 = 0, n = 0;
    for (const t of tastings!) {
      const wine = wineById.get(t.wine_id!);
      if (!wine) continue;
      for (const [userNote, referenceNote, isSmell] of [[t.lukt, wine.smell, true], [t.smak, wine.taste, false]] as const) {
        if (!userNote?.trim() || !referenceNote?.trim()) continue;
        const s = score(userNote, referenceNote);
        trueScores.push(s); n++;
        const ds = distractors.map(d => score(userNote, (isSmell ? d.smell : d.taste) || ''));
        randomScores.push(...ds);
        if (!ds.some(x => x > s)) top1++;
      }
    }
    const d = (mean(trueScores) - mean(randomScores)) / (sd(randomScores) || 1);
    const fmt = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(1);

    console.log(name.padEnd(26), mean(base).toFixed(1).padStart(7), fmt(mean(dHit)).padStart(8),
      fmt(mean(dWrong)).padStart(8), fmt(mean(dMiss)).padStart(8),
      pearson(base, lengths).toFixed(2).padStart(8), d.toFixed(2).padStart(7),
      (top1 / n * 100).toFixed(0).padStart(7));
  }

  console.log('-'.repeat(104));
  console.log('+HIT   score change when the user adds a descriptor the wine DOES have    -> want clearly positive');
  console.log('+WRONG score change when the user adds a genuinely wrong descriptor       -> want <= 0');
  console.log('MISS   score change when the REFERENCE gains notes the user never said    -> want ~0');
  console.log('r(len) correlation of score with user note length                         -> want ~0');
  console.log('d      separation of real-wine from random-wine scores, in SD units       -> higher is better');
  console.log('top1%  how often the real wine outranks every distractor (chance = 1%)    -> higher is better');
}

main().catch(e => { console.error(e); process.exit(1); });
