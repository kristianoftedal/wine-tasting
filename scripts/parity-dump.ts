#!/usr/bin/env npx tsx
/**
 * Node half of the ONNX parity check: tokenises five real notes, runs both
 * local graphs (NorBERT3 int8 via transformers.js, mLateOn int8 via
 * onnxruntime-node) and writes token ids plus per-token vectors. The Python
 * half, scripts/parity-check.py, runs the PyTorch originals on the same ids
 * and reports per-token cosine. Pass condition in the plan: mean > 0.99.
 *
 *   npx tsx scripts/parity-dump.ts /tmp/parity-dump.json
 */
import { writeFileSync } from 'node:fs';
const NOTES = [
  'Rødt eple sitrus mineralsk',
  'Litt utviklet og mineralsk, preg av gule epler, steinfrukt, kjeks, litt sitrus, røde bær og flint.',
  'Brioche, Sitrus',
  'Mørke bær, kirsebær og sjokolade. Fyldige tanniner og lang finish.',
  'Saftig, litt pepret og krydret, preg av moden kirsebær, krekling og bringebær, litt fat og urt.',
];
const MODEL_DIR = process.env.SOFT_MODEL_DIR ?? 'models';
async function main() {
  const out = process.argv[2];
  if (!out) throw new Error('usage: parity-dump.ts <output.json>');
  const tjs = await import('@huggingface/transformers');
  const ort = await import('onnxruntime-node');
  tjs.env.localModelPath = MODEL_DIR; tjs.env.allowRemoteModels = false;
  const dump: Record<string, Array<{ text: string; ids: number[]; vectors: number[][] }>> = { bert: [], colbert: [] };

  const btok = await tjs.AutoTokenizer.from_pretrained('lebchen/norbert3-base-onnx');
  const bmodel = await tjs.AutoModel.from_pretrained('lebchen/norbert3-base-onnx', { dtype: 'q8' });
  for (const text of NOTES) {
    const enc = btok(text, { add_special_tokens: true });
    const ids = Array.from(enc.input_ids.data as ArrayLike<number | bigint>, Number);
    const res = await bmodel({ input_ids: enc.input_ids, attention_mask: enc.attention_mask }) as Record<string, { data: Float32Array; dims: number[] }>;
    const h = res.last_hidden_state ?? Object.values(res)[0];
    const dim = h.dims[h.dims.length - 1];
    dump.bert.push({ text, ids, vectors: ids.map((_, t) => Array.from(h.data.subarray(t * dim, (t + 1) * dim))) });
  }

  const ctok = await tjs.AutoTokenizer.from_pretrained('lightonai/mLateOn');
  const session = await ort.InferenceSession.create(`${MODEL_DIR}/lightonai/mLateOn/model_int8.onnx`, { executionProviders: ['cpu'] });
  for (const text of NOTES) {
    const enc = ctok(`[Q] ${text}`, { add_special_tokens: true });
    const ids = Array.from(enc.input_ids.data as ArrayLike<number | bigint>, Number);
    const feeds = {
      input_ids: new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
      attention_mask: new ort.Tensor('int64', BigInt64Array.from(ids.map(() => BigInt(1))), [1, ids.length]),
    };
    const r = await session.run(feeds);
    const t = r[session.outputNames[0]];
    const dim = t.dims[t.dims.length - 1];
    const data = t.data as Float32Array;
    dump.colbert.push({ text, ids, vectors: ids.map((_, i) => Array.from(data.subarray(i * dim, (i + 1) * dim))) });
  }
  writeFileSync(out, JSON.stringify(dump));
  console.log(`dumped ${dump.bert.length} + ${dump.colbert.length} notes to ${out}`);
}
main().catch(e => { console.error(e); process.exit(1); });
