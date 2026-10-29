#!/usr/bin/env npx tsx
/**
 * Fit a 128×128 projection on the table vectors so that the metric agrees
 * with the credit ladder.
 *
 * The soft term exists for words the ladder cannot link, and every
 * pretrained engine is weakest exactly there (fat–vanilje at 0.09). The
 * dictionary already says which pairs belong together and how strongly:
 *
 *   derivation edge      target 1.0   fat → vanilje, kjeks → nøtt
 *   hypernym member      target 0.85  frukt ↔ solbær
 *   same subcategory     target 0.6   jordbær ↔ bringebær
 *   same main category   target 0.3   kirsebær ↔ sitron
 *   different category   target 0.0   solbær ↔ vanilje (unless derived)
 *   same word            target 1.0   q and d vectors of one word
 *
 * One matrix W is learned for both sides so that cos(W q_u, W d_r) ≈ target,
 * by plain gradient descent on the squared error with the identity as the
 * starting point and an L2 pull toward it (the vectors are good; the fix is
 * a nudge). 20% of the pairs are held out and reported, so an overfit
 * dictionary is visible. Writes src/lib/softEngines/colbert-projection.generated.json.
 *
 *   npx tsx scripts/train-soft-projection.ts [--epochs=300] [--lr=0.05] [--ridge=0.01]
 */
import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { norwegianLemmas } from '../src/lib/lemmatizeAndWeight';
import { normalizeWineSynonyms } from '../src/lib/synonymNormalization';
import { DERIVATIONS, HYPERNYMS } from '../src/lib/derivations';
import { contentWords } from '../src/lib/softEngines/maxsim';
import { centered, loadMean } from '../src/lib/softEngines/words';
import { cosineSimilarity } from '../src/lib/math';
import { seededRandom, mean } from '../src/lib/stats';
import tableRaw from '../src/lib/softEngines/colbert-table.generated.json';

const OUT = 'src/lib/softEngines/colbert-projection.generated.json';
const arg = (name: string, d: number) => Number(process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? d);
const EPOCHS = arg('epochs', 300), LR = arg('lr', 0.05), RIDGE = arg('ridge', 0.01);

type Table = { meta: { dimensions: number }; words: Record<string, { q: string; d: string }> };
const TABLE = tableRaw as Table;
const DIM = TABLE.meta.dimensions;
const decode = (b64: string) => { const buf = Buffer.from(b64, 'base64'); return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4); };
const MEAN = loadMean('colbert-iso');

/** Surface key in the table for a lemma: the key that spells the lemma, else any key with that lemma. */
function surfaceOf(lemma: string): string | null {
  const direct = contentWords(normalizeWineSynonyms(lemma))[0];
  if (direct && TABLE.words[direct]) return direct;
  for (const [key, e] of Object.entries(norwegianLemmas)) if (e.lemma === lemma) { const w = contentWords(normalizeWineSynonyms(key))[0]; if (w && TABLE.words[w]) return w; }
  return null;
}

function main() {
  if (!Object.keys(TABLE.words).length) throw new Error('table is empty; run build-colbert-table.ts first');
  const lemmas = new Map<string, { surface: string; main: string; sub: string }>();
  for (const [key, e] of Object.entries(norwegianLemmas)) {
    if (!e.categoryPath?.main || e.categoryPath.main === 'GENERIC' || lemmas.has(e.lemma)) continue;
    const surface = surfaceOf(e.lemma); if (!surface) continue;
    lemmas.set(e.lemma, { surface, main: e.categoryPath.main, sub: e.categoryPath.sub ?? '' });
  }
  const list = [...lemmas.entries()];
  const pairs: Array<{ a: string; b: string; t: number; kind: string }> = [];
  const push = (a: string, b: string, t: number, kind: string) => { const sa = lemmas.get(a)?.surface, sb = lemmas.get(b)?.surface; if (sa && sb) pairs.push({ a: sa, b: sb, t, kind }); };
  for (const [src, targets] of Object.entries(DERIVATIONS)) for (const d of targets) push(src, d, 1, 'derived');
  for (const [hyper, scope] of Object.entries(HYPERNYMS)) for (const [l, info] of list) if (info.main === scope.main && (!scope.sub || scope.sub === info.sub) && l !== hyper) push(hyper, l, 0.85, 'specific');
  const rnd = seededRandom(20261029);
  const derivedSet = new Set(pairs.map(p => `${p.a}|${p.b}`));
  for (let k = 0; k < 4000; k++) {
    const [la, ia] = list[Math.floor(rnd() * list.length)], [lb, ib] = list[Math.floor(rnd() * list.length)];
    if (la === lb || derivedSet.has(`${ia.surface}|${ib.surface}`)) continue;
    const t = ia.main === ib.main && ia.sub === ib.sub && ia.sub ? 0.6 : ia.main === ib.main ? 0.3 : 0;
    push(la, lb, t, t === 0.6 ? 'subcategory' : t === 0.3 ? 'category' : 'unrelated');
  }
  for (const [, info] of list) pairs.push({ a: info.surface, b: info.surface, t: 1, kind: 'same' });

  // Vectors: q for the user side, d for the reference side, centred.
  const q = (w: string) => centered(decode(TABLE.words[w].q), MEAN), d = (w: string) => centered(decode(TABLE.words[w].d), MEAN);
  const shuffled = [...pairs].sort(() => rnd() - 0.5);
  const held = shuffled.slice(0, Math.floor(shuffled.length * 0.2)), train = shuffled.slice(held.length);
  const X = train.map(p => ({ x: q(p.a), y: d(p.b), t: p.t }));

  // W starts at identity; minimise Σ (cos(Wx, Wy) − t)² + ridge·‖W − I‖².
  const W = new Float32Array(DIM * DIM); for (let i = 0; i < DIM; i++) W[i * DIM + i] = 1;
  const mul = (x: Float32Array) => { const o = new Float32Array(DIM); for (let i = 0; i < DIM; i++) { let s = 0; for (let j = 0; j < DIM; j++) s += W[i * DIM + j] * x[j]; o[i] = s; } return o; };
  const dot = (a: Float32Array, b: Float32Array) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  const loss = (ps: typeof X) => mean(ps.map(p => (cosineSimilarity(mul(p.x), mul(p.y)) - p.t) ** 2));
  const evalOn = (ps: Array<{ a: string; b: string; t: number; kind: string }>) => {
    const by = new Map<string, number[]>();
    for (const p of ps) { const c = cosineSimilarity(mul(q(p.a)), mul(d(p.b))); (by.get(p.kind) ?? by.set(p.kind, []).get(p.kind)!).push(c); }
    return Object.fromEntries([...by.entries()].map(([k, v]) => [k, Number(mean(v).toFixed(3))]));
  };
  console.log('pairs', pairs.length, 'train', train.length, 'held out', held.length, '| before, held-out mean cosine by kind:', JSON.stringify(evalOn(held)));
  const grad = new Float32Array(DIM * DIM);
  for (let epoch = 0; epoch < EPOCHS; epoch++) {
    grad.fill(0);
    for (const p of X) {
      const u = mul(p.x), v = mul(p.y);
      const nu = Math.sqrt(dot(u, u)) || 1e-9, nv = Math.sqrt(dot(v, v)) || 1e-9;
      const c = dot(u, v) / (nu * nv);
      const g = 2 * (c - p.t);
      // d cos / d u = v/(nu nv) − c·u/nu²;  d u_i / d W_ij = x_j
      for (let i = 0; i < DIM; i++) {
        const du = g * (v[i] / (nu * nv) - c * u[i] / (nu * nu));
        const dv = g * (u[i] / (nu * nv) - c * v[i] / (nv * nv));
        const row = i * DIM;
        for (let j = 0; j < DIM; j++) grad[row + j] += du * p.x[j] + dv * p.y[j];
      }
    }
    const n = X.length;
    for (let i = 0; i < DIM; i++) for (let j = 0; j < DIM; j++) {
      const k = i * DIM + j;
      W[k] -= LR * (grad[k] / n + 2 * RIDGE * (W[k] - (i === j ? 1 : 0)));
    }
    if (epoch % 50 === 0 || epoch === EPOCHS - 1) console.log(`epoch ${epoch}: train loss ${loss(X).toFixed(4)}, held-out loss ${loss(held.map(p => ({ x: q(p.a), y: d(p.b), t: p.t }))).toFixed(4)}`);
  }
  const fit = { heldOut: evalOn(held), train: evalOn(train) };
  console.log('after, held-out mean cosine by kind:', JSON.stringify(fit.heldOut));
  let commit = 'unknown';
  try { commit = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* ignore */ }
  writeFileSync(OUT, JSON.stringify({ dimensions: DIM, trainedAt: new Date().toISOString(), commit, pairs: pairs.length, epochs: EPOCHS, lr: LR, ridge: RIDGE, fit, matrix: Buffer.from(W.buffer).toString('base64') }) + '\n');
  console.log(`written ${OUT}`);
}

main();
