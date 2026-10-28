/**
 * Small statistics used by the evaluation scripts and the demo's static
 * extract. Kept dependency-free and deterministic (seeded resampling) so a
 * number in a committed baseline file can be reproduced.
 */

export const mean = (a: number[]): number => a.reduce((x, y) => x + y, 0) / (a.length || 1);

export const sd = (a: number[]): number => {
  const m = mean(a);
  return Math.sqrt(mean(a.map(x => (x - m) ** 2)));
};

/** Average ranks, ties shared. */
export function ranks(a: number[]): number[] {
  const idx = a.map((v, i) => [v, i] as const).sort((x, y) => x[0] - y[0]);
  const r = new Array<number>(a.length);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

export function pearson(x: number[], y: number[]): number {
  const mx = mean(x), my = mean(y);
  let n = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < x.length; i++) { const dx = x[i] - mx, dy = y[i] - my; n += dx * dy; dx2 += dx * dx; dy2 += dy * dy; }
  return dx2 && dy2 ? n / Math.sqrt(dx2 * dy2) : 0;
}

export const spearman = (x: number[], y: number[]): number => pearson(ranks(x), ranks(y));

/** Quadratic-weighted Cohen's kappa for two raters on an integer scale 0..k. */
export function weightedKappa(a: number[], b: number[], k = 4): number {
  const n = a.length; if (!n) return 0;
  const obs = Array.from({ length: k + 1 }, () => new Array<number>(k + 1).fill(0));
  const ha = new Array<number>(k + 1).fill(0), hb = new Array<number>(k + 1).fill(0);
  for (let i = 0; i < n; i++) { obs[a[i]][b[i]]++; ha[a[i]]++; hb[b[i]]++; }
  let num = 0, den = 0;
  for (let i = 0; i <= k; i++) for (let j = 0; j <= k; j++) {
    const w = ((i - j) ** 2) / (k ** 2);
    num += w * obs[i][j];
    den += w * (ha[i] * hb[j]) / n;
  }
  return den ? 1 - num / den : 1;
}

/** Seeded LCG so resampling is reproducible between runs. */
export function seededRandom(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

export function bootstrapSpearmanCi(x: number[], y: number[], reps = 1000, seed = 20261028): [number, number] {
  const rnd = seededRandom(seed);
  const vals: number[] = [];
  for (let r = 0; r < reps; r++) {
    const bx: number[] = [], by: number[] = [];
    for (let i = 0; i < x.length; i++) { const j = Math.floor(rnd() * x.length); bx.push(x[j]); by.push(y[j]); }
    vals.push(spearman(bx, by));
  }
  vals.sort((p, q) => p - q);
  return [vals[Math.floor(0.025 * reps)], vals[Math.floor(0.975 * reps)]];
}
