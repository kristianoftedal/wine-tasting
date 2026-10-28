import { stripPunctuation } from '../lemmatizeAndWeight';
import { normalizeWineSynonyms } from '../synonymNormalization';
import { contentWords } from './maxsim';
import type { NoteInput } from './types';

/**
 * Word-level view of a note for engines that encode it in context.
 *
 * `raw` keeps stopwords, so the model sees natural text; every word is then
 * mapped to the surface form the ladder would see (lowercased, punctuation
 * stripped, synonym-normalised), and marked as a content word if that form
 * is among `contentWords(norm)`. Engines encode all the words and read
 * vectors only for the content ones, so every engine scores the same word
 * set as the OpenAI engine and the ladder.
 */
export type NoteWord = { text: string; key: string; content: boolean };

export function noteWords(note: NoteInput): NoteWord[] {
  const content = new Set(contentWords(note.norm));
  const seen = new Set<string>();
  const out: NoteWord[] = [];
  for (const text of stripPunctuation(note.raw).split(' ').filter(Boolean)) {
    const key = normalizeWineSynonyms(text);
    // A content word that appears twice is scored once, like the token set
    // on the OpenAI side; the second occurrence still provides context.
    const isContent = content.has(key) && !seen.has(key);
    if (isContent) seen.add(key);
    out.push({ text, key, content: isContent });
  }
  return out;
}

/** Bounded insertion-order cache for encoded notes, keyed by raw text. */
export class EncodingCache<T> {
  private map = new Map<string, T>();
  constructor(private readonly capacity = 4000) {}
  get(key: string): T | undefined {
    const v = this.map.get(key);
    if (v !== undefined) { this.map.delete(key); this.map.set(key, v); }
    return v;
  }
  set(key: string, value: T) {
    if (this.map.size >= this.capacity) this.map.delete(this.map.keys().next().value!);
    this.map.set(key, value);
  }
  get size() { return this.map.size; }
}

export function l2normalize(vec: Float32Array): Float32Array {
  let n = 0;
  for (let i = 0; i < vec.length; i++) n += vec[i] * vec[i];
  n = Math.sqrt(n);
  if (n === 0) return vec;
  const out = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] / n;
  return out;
}

export function meanPool(rows: Float32Array[]): Float32Array {
  const dim = rows[0].length;
  const out = new Float32Array(dim);
  for (const r of rows) for (let i = 0; i < dim; i++) out[i] += r[i];
  for (let i = 0; i < dim; i++) out[i] /= rows.length;
  return out;
}

export const MODEL_DIR = () => process.env.SOFT_MODEL_DIR ?? 'models';

/**
 * Word-start markers of the two tokenizers: byte-level BPE writes a leading
 * space as "Ġ" (NorBERT3), sentencepiece as "▁" (mLateOn). The first token of
 * a text carries no marker, so the first non-marker token also opens a word.
 */
const WORD_START = /^[Ġ▁]/;

/**
 * Group whole-text tokens into words by their markers. Returns one array of
 * token indexes per word, or null if the grouping does not produce exactly
 * `expected` words (then the caller falls back to per-word tokenisation).
 * `leading` is how many groups to drop from the front — the "[Q]" / "[D]"
 * prefix of a ColBERT input.
 */
export function groupTokensIntoWords(tokens: string[], expected: number, leading = 0): number[][] | null {
  const groups: number[][] = [];
  tokens.forEach((tok, i) => {
    if (i === 0 || WORD_START.test(tok)) groups.push([i]);
    else groups[groups.length - 1].push(i);
  });
  const words = groups.slice(leading);
  return words.length === expected ? words : null;
}

/** How often span recovery had to fall back; read by the engine tests. */
export const spanStats = { whole: 0, fallback: 0 };

export type Tokenizer = {
  tokenize(text: string): string[];
  encode(text: string, opts?: { add_special_tokens?: boolean }): number[];
};

/**
 * Token ids with special tokens and one [start, end) span per word, from a
 * single whole-text tokenisation. If the marker grouping fails, every word is
 * tokenised on its own and concatenated (sentence-initial forms, no context
 * merge), which is always well-formed but can differ from what the model saw
 * in training; spanStats counts both paths.
 */
export function tokenizeWithSpans(tokenizer: Tokenizer, words: string[], cls: number[], sep: number[], prefix = ''): { ids: number[]; spans: Array<[number, number]> } {
  // A leading space so the first word is tokenised like every other word
  // ("Ġsol bær", not "sol bær"): otherwise a one-word taster note and the
  // same word mid-sentence in the reference get different subwords and
  // therefore different vectors. With a prefix the words are never first.
  const text = prefix ? `${prefix} ${words.join(' ')}` : ` ${words.join(' ')}`;
  const tokens = tokenizer.tokenize(text);
  const body = tokenizer.encode(text, { add_special_tokens: false });
  const groups = body.length === tokens.length ? groupTokensIntoWords(tokens, words.length, prefix ? 1 : 0) : null;
  if (groups) {
    spanStats.whole++;
    const ids = [...cls, ...body, ...sep];
    const spans = groups.map(g => [cls.length + g[0], cls.length + g[g.length - 1] + 1] as [number, number]);
    return { ids, spans };
  }
  spanStats.fallback++;
  const ids: number[] = [...cls, ...(prefix ? tokenizer.encode(prefix, { add_special_tokens: false }) : [])];
  const spans: Array<[number, number]> = [];
  for (const w of words) {
    const t = tokenizer.encode(` ${w}`, { add_special_tokens: false });
    spans.push([ids.length, ids.length + t.length]);
    ids.push(...t);
  }
  ids.push(...sep);
  return { ids, spans };
}
