#!/usr/bin/env npx tsx
/**
 * Download the local soft-engine models into models/ (gitignored).
 *
 *   lebchen/norbert3-base-onnx   NorBERT3 base, int8 ONNX (142 MB), Apache 2.0
 *   lightonai/mLateOn            multilingual ColBERT on mmBERT-base, int8 ONNX
 *                                with the 128-dim projection and L2 norm baked
 *                                in (313 MB) plus a 34 MB tokenizer, Apache 2.0
 *
 * Plain HTTPS from the Hub; no token needed, nothing is cached elsewhere. The
 * engines look in SOFT_MODEL_DIR (default models/) and report themselves
 * unavailable when a file is missing, so the demo and the benchmark work
 * without this having run.
 *
 *   npx tsx scripts/fetch-soft-models.ts [--fp32]   also fetch the float32 graphs (553 MB + 1.2 GB)
 */
import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const ROOT = process.env.SOFT_MODEL_DIR ?? 'models';
const FP32 = process.argv.includes('--fp32');

type Item = { repo: string; file: string; optional?: boolean };
const ITEMS: Item[] = [
  { repo: 'lebchen/norbert3-base-onnx', file: 'config.json' },
  { repo: 'lebchen/norbert3-base-onnx', file: 'tokenizer.json' },
  { repo: 'lebchen/norbert3-base-onnx', file: 'tokenizer_config.json' },
  { repo: 'lebchen/norbert3-base-onnx', file: 'special_tokens_map.json' },
  { repo: 'lebchen/norbert3-base-onnx', file: 'onnx/model_quantized.onnx' },
  { repo: 'lebchen/norbert3-base-onnx', file: 'onnx/model.onnx', optional: true },
  { repo: 'lightonai/mLateOn', file: 'config.json' },
  { repo: 'lightonai/mLateOn', file: 'tokenizer.json' },
  { repo: 'lightonai/mLateOn', file: 'tokenizer_config.json' },
  { repo: 'lightonai/mLateOn', file: 'config_sentence_transformers.json' },
  { repo: 'lightonai/mLateOn', file: 'model_int8.onnx' },
  { repo: 'lightonai/mLateOn', file: 'model.onnx', optional: true },
];

async function fetchOne({ repo, file }: Item) {
  const dest = join(ROOT, repo, file);
  const url = `https://huggingface.co/${repo}/resolve/main/${file}`;
  const head = await fetch(url, { method: 'HEAD', redirect: 'follow' });
  if (!head.ok) throw new Error(`${url}: HTTP ${head.status}`);
  const size = Number(head.headers.get('content-length') ?? 0);
  if (existsSync(dest) && size && statSync(dest).size === size) {
    console.log(`  ok       ${repo}/${file}`);
    return;
  }
  mkdirSync(dirname(dest), { recursive: true });
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`${url}: HTTP ${res.status}`);
  let done = 0, lastPct = -1;
  const progress = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      done += chunk.length;
      const pct = size ? Math.floor((done / size) * 100) : -1;
      if (pct !== lastPct && pct % 10 === 0) { process.stderr.write(`  ${pct}%  ${repo}/${file}\r`); lastPct = pct; }
      controller.enqueue(chunk);
    },
  });
  await pipeline(Readable.fromWeb(res.body.pipeThrough(progress) as import('node:stream/web').ReadableStream), createWriteStream(dest));
  console.log(`  fetched  ${repo}/${file} (${(done / 1e6).toFixed(0)} MB)`);
}

async function main() {
  console.log(`models → ${ROOT}/`);
  for (const item of ITEMS) {
    if (item.optional && !FP32) continue;
    await fetchOne(item);
  }
  console.log('done');
}

main().catch(e => { console.error(e); process.exit(1); });
