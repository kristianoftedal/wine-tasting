#!/usr/bin/env npx tsx
/**
 * Computes the corpus mean embedding direction used by src/lib/embeddingCentering.ts
 * to correct for anisotropy.
 *
 * The mean is taken over *descriptor tokens*, not whole notes, because that is
 * the population the scorer actually centers: token-level MaxSim compares
 * individual flavour words, never pooled sentences. Tokens are weighted by
 * corpus frequency so the mean reflects the descriptors that actually occur.
 *
 * Sampling starts at an offset rather than the head of the table so the mean
 * isn't dominated by whichever producer happens to sort first.
 *
 * Run: npx tsx --env-file=.env.local scripts/compute-corpus-mean.ts
 */
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { flavorOnlyText, sanitizeText } from '../src/lib/lemmatizeAndWeight';
import { normalizeWineSynonyms } from '../src/lib/synonymNormalization';
import { EMBEDDING_MODEL } from '../src/lib/scoringConfig';

const NOTES_TARGET = 6000;
const BATCH = 256;

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

async function main() {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const frequency = new Map<string, number>();
  let notes = 0;
  for (let from = 5000; notes < NOTES_TARGET && from < 30000; from += 1000) {
    const { data, error } = await sb.from('wines').select('smell,taste')
      .not('taste', 'is', null).range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const w of data) {
      for (const raw of [w.smell, w.taste]) {
        if (!raw) continue;
        notes++;
        for (const tok of flavorOnlyText(normalizeWineSynonyms(sanitizeText(raw))).split(' ')) {
          if (tok) frequency.set(tok, (frequency.get(tok) ?? 0) + 1);
        }
      }
    }
  }

  const vocab = [...frequency.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`Reference notes scanned : ${notes}`);
  console.log(`Distinct tokens         : ${vocab.length}`);
  console.log(`Embedding vocabulary with ${EMBEDDING_MODEL}...`);

  let mean: Float64Array | null = null;
  let totalWeight = 0;
  for (let i = 0; i < vocab.length; i += BATCH) {
    const chunk = vocab.slice(i, i + BATCH);
    const embeddings = await embedBatch(chunk.map(([tok]) => tok));
    embeddings.forEach((emb, j) => {
      mean ??= new Float64Array(emb.length);
      let norm = 0;
      for (const v of emb) norm += v * v;
      norm = Math.sqrt(norm);
      if (norm === 0) return;
      const weight = chunk[j][1];
      for (let d = 0; d < emb.length; d++) mean![d] += (emb[d] / norm) * weight;
      totalWeight += weight;
    });
    process.stdout.write(`  ${Math.min(i + BATCH, vocab.length)}/${vocab.length}\r`);
  }
  if (!mean) throw new Error('no embeddings produced');

  for (let d = 0; d < mean.length; d++) mean[d] /= totalWeight;
  const meanNorm = Math.sqrt(mean.reduce((s, v) => s + v * v, 0));

  const outPath = join(__dirname, '../src/lib/corpus-mean.generated.json');
  writeFileSync(outPath, JSON.stringify({
    model: EMBEDDING_MODEL,
    dimensions: mean.length,
    sampleSize: vocab.length,
    meanNorm: Number(meanNorm.toFixed(6)),
    vector: Array.from(mean, v => Number(v.toFixed(7))),
  }));

  console.log(`\nTokens averaged : ${vocab.length} (frequency-weighted, ${totalWeight} occurrences)`);
  console.log(`|mean vector|   : ${meanNorm.toFixed(4)}  (0 = isotropic, 1 = total collapse)`);
  console.log(`Written         : ${outPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
