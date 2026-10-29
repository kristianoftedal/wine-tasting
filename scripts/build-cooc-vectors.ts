#!/usr/bin/env npx tsx
/**
 * Descriptor vectors from the catalogue itself: which words share a wine.
 *
 * Every pretrained engine measured here is weakest on the pairs the soft term
 * exists for (fat–vanilje at 0.09), and the two attempts to teach it the
 * ladder made the score worse. This is a different signal: across the
 * 59 423 Vinmonopolet notes, descriptors that are written about the same
 * wines are related — vanilje with fat, brioche with kjeks, tjære with
 * lakris — by the catalogue's own evidence, in Norwegian, with no model and
 * no dictionary involved. The RoboSomm work did the same with word2vec on
 * 180 000 English reviews and got tarragon next to sagebrush.
 *
 * Method: one document per wine (smell + taste content words after the same
 * sanitising, synonym and generic-stripping steps the scorer uses); a word ×
 * word co-occurrence matrix over words in ≥ MIN_DF wines; positive pointwise
 * mutual information with context-distribution smoothing (α = 0.75, Levy et
 * al. 2015); a randomised truncated SVD to DIM dimensions; rows scaled by
 * √σ and L2-normalised. Written in the same table format as the ColBERT
 * table (q = d, one vector per word) so the table engine serves it.
 *
 *   npx tsx --env-file=.env.local scripts/build-cooc-vectors.ts [--dim=128] [--min-df=5]
 */
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
import { sanitizeText } from '../src/lib/lemmatizeAndWeight';
import { normalizeWineSynonyms } from '../src/lib/synonymNormalization';
import { applyNegation } from '../src/lib/negation';
import { contentWords } from '../src/lib/softEngines/maxsim';
import { seededRandom } from '../src/lib/stats';

const OUT = 'src/lib/softEngines/cooc-table.generated.json';
const arg = (name: string, d: number) => Number(process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? d);
const DIM = arg('dim', 128), MIN_DF = arg('min-df', 5), ALPHA = 0.75;
const norm = (t: string) => normalizeWineSynonyms(sanitizeText(applyNegation(t).text));

/** Randomised truncated SVD of a symmetric dense matrix (Halko et al.), returning U·√Σ for the top k. */
function embedSymmetric(M: Float64Array, n: number, k: number, iters = 6): Float64Array {
  const rnd = seededRandom(20261029);
  const p = k + 16;
  let Q: Float64Array = new Float64Array(n * p);
  for (let i = 0; i < Q.length; i++) Q[i] = rnd() * 2 - 1;
  const mul = (X: Float64Array): Float64Array => { // M · X, X is n×p
    const Y = new Float64Array(n * p);
    for (let i = 0; i < n; i++) { const row = i * n; for (let j = 0; j < n; j++) { const m = M[row + j]; if (!m) continue; const xr = j * p, yr = i * p; for (let c = 0; c < p; c++) Y[yr + c] += m * X[xr + c]; } }
    return Y;
  };
  const orthonormalise = (X: Float64Array): Float64Array => { // Gram–Schmidt on columns
    for (let c = 0; c < p; c++) {
      for (let c2 = 0; c2 < c; c2++) { let d = 0; for (let i = 0; i < n; i++) d += X[i * p + c] * X[i * p + c2]; for (let i = 0; i < n; i++) X[i * p + c] -= d * X[i * p + c2]; }
      let nrm = 0; for (let i = 0; i < n; i++) nrm += X[i * p + c] ** 2; nrm = Math.sqrt(nrm) || 1; for (let i = 0; i < n; i++) X[i * p + c] /= nrm;
    }
    return X;
  };
  Q = orthonormalise(mul(Q));
  for (let t = 0; t < iters; t++) Q = orthonormalise(mul(Q));
  // B = Qᵀ M Q  (p×p), eigendecompose by Jacobi
  const MQ = mul(Q);
  const B = new Float64Array(p * p);
  for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) { let s = 0; for (let i = 0; i < n; i++) s += Q[i * p + a] * MQ[i * p + b]; B[a * p + b] = s; }
  const V = new Float64Array(p * p); for (let i = 0; i < p; i++) V[i * p + i] = 1;
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let a = 0; a < p; a++) for (let b = a + 1; b < p; b++) {
      const bab = B[a * p + b]; if (Math.abs(bab) < 1e-12) continue; off += bab * bab;
      const theta = 0.5 * Math.atan2(2 * bab, B[b * p + b] - B[a * p + a]);
      const c = Math.cos(theta), s = Math.sin(theta);
      for (let i = 0; i < p; i++) { const bia = B[i * p + a], bib = B[i * p + b]; B[i * p + a] = c * bia - s * bib; B[i * p + b] = s * bia + c * bib; }
      for (let i = 0; i < p; i++) { const bai = B[a * p + i], bbi = B[b * p + i]; B[a * p + i] = c * bai - s * bbi; B[b * p + i] = s * bai + c * bbi; }
      for (let i = 0; i < p; i++) { const via = V[i * p + a], vib = V[i * p + b]; V[i * p + a] = c * via - s * vib; V[i * p + b] = s * via + c * vib; }
    }
    if (off < 1e-10) break;
  }
  const order = [...Array(p).keys()].sort((a, b) => B[b * p + b] - B[a * p + a]).slice(0, k);
  const E = new Float64Array(n * k);
  for (let i = 0; i < n; i++) for (let c = 0; c < k; c++) {
    const j = order[c]; let s = 0; for (let a = 0; a < p; a++) s += Q[i * p + a] * V[a * p + j];
    E[i * k + c] = s * Math.sqrt(Math.max(0, B[j * p + j]));
  }
  return E;
}

async function main() {
  const sb = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const docs: string[][] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb.from('wines').select('smell,taste').order('id').range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const w of data) {
      const words = new Set<string>();
      for (const t of [w.smell, w.taste]) if (t) for (const x of contentWords(norm(t))) words.add(x);
      if (words.size >= 2) docs.push([...words]);
    }
    from += 1000;
    process.stderr.write(`  ${from} wines\r`);
  }
  const df = new Map<string, number>();
  for (const d of docs) for (const w of d) df.set(w, (df.get(w) ?? 0) + 1);
  const vocab = [...df.entries()].filter(([, n]) => n >= MIN_DF).map(([w]) => w).sort((a, b) => a.localeCompare(b, 'nb'));
  const index = new Map(vocab.map((w, i) => [w, i]));
  const n = vocab.length;
  console.log(`${docs.length} wines with ≥ 2 content words; vocabulary ${n} words at df ≥ ${MIN_DF}`);

  // Co-occurrence within a wine, then PPMI with α-smoothed context counts.
  const C = new Float64Array(n * n);
  const rowSum = new Float64Array(n);
  for (const d of docs) {
    const ids = d.map(w => index.get(w)).filter((i): i is number => i !== undefined);
    for (const i of ids) for (const j of ids) if (i !== j) { C[i * n + j] += 1; rowSum[i] += 1; }
  }
  const total = rowSum.reduce((a, b) => a + b, 0);
  const ctx = Float64Array.from(rowSum, v => v ** ALPHA);
  const ctxTotal = ctx.reduce((a, b) => a + b, 0);
  const P = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const c = C[i * n + j]; if (!c) continue;
    const pmi = Math.log((c / total) / ((rowSum[i] / total) * (ctx[j] / ctxTotal)));
    if (pmi > 0) P[i * n + j] = pmi;
  }
  process.stderr.write('  svd…\n');
  const E = embedSymmetric(P, n, DIM);
  const table: Record<string, { q: string; d: string }> = {};
  for (let i = 0; i < n; i++) {
    const v = new Float32Array(DIM);
    let nrm = 0; for (let c = 0; c < DIM; c++) { v[c] = E[i * DIM + c]; nrm += v[c] * v[c]; }
    nrm = Math.sqrt(nrm) || 1; for (let c = 0; c < DIM; c++) v[c] /= nrm;
    const b64 = Buffer.from(v.buffer).toString('base64');
    table[vocab[i]] = { q: b64, d: b64 };
  }
  writeFileSync(OUT, JSON.stringify({ meta: { model: `catalogue co-occurrence PPMI+SVD (${docs.length} wines, df ≥ ${MIN_DF}, α ${ALPHA})`, dimensions: DIM, words: n, builtAt: new Date().toISOString() }, words: table }) + '\n');
  // Sanity: nearest neighbours of a few descriptors.
  const vec = (w: string) => { const b = Buffer.from(table[w].q, 'base64'); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); };
  const cos = (a: Float32Array, b: Float32Array) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  for (const w of ['vanilje', 'brioche', 'tjære', 'solbær', 'sitrus', 'pepper']) {
    if (!table[w]) continue;
    const v = vec(w);
    const near = vocab.filter(x => x !== w).map(x => [x, cos(v, vec(x))] as const).sort((a, b) => b[1] - a[1]).slice(0, 6);
    console.log(`  ${w.padEnd(9)} → ${near.map(([x, c]) => `${x} ${c.toFixed(2)}`).join(', ')}`);
  }
  console.log(`written ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
