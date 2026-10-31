import { openaiEngine } from './openai';
import { coocEngine, colbertTableEngine } from './colbertTable';
import type { NoteInput, SoftEngine, SoftResult } from './types';

/**
 * Two independent soft signals, averaged: OpenAI token synonymy and catalogue
 * co-occurrence association. Both are calibrated to 0–100 on their own; the
 * blend is the per-note mean of their soft scores, and the alignments are
 * OpenAI's with the co-occurrence best match noted where it differs. Neither
 * signal knows the ladder, so this is not the second-vote failure of the
 * hybrid and the projection; it is a different question asked twice.
 */
export const openaiCoocEngine: SoftEngine = {
  id: 'openai+cooc',
  model: `${openaiEngine.model} + catalogue co-occurrence`,
  async available() {
    const [a, b] = await Promise.all([openaiEngine.available(), coocEngine.available()]);
    return a.ok ? b : a;
  },
  async score(user: NoteInput, reference: NoteInput): Promise<SoftResult> {
    const started = performance.now();
    const [a, b] = await Promise.all([openaiEngine.score(user, reference), coocEngine.score(user, reference)]);
    const coocBest = new Map(b.alignments.map(x => [x.word, x]));
    return {
      engine: 'openai+cooc',
      model: openaiCoocEngine.model,
      raw: (a.raw + b.raw) / 2,
      baseline: b.baseline,
      softScore: (a.softScore + b.softScore) / 2,
      alignments: a.alignments.map(x => { const c = coocBest.get(x.word); return c && c.best !== x.best ? { ...x, best: `${x.best}|${c.best}` } : x; }),
      ms: performance.now() - started,
    };
  },
};

/** Two local signals, no API: the mLateOn vocabulary table and catalogue co-occurrence, averaged. */
export const colbertCoocEngine: SoftEngine = {
  id: 'colbert+cooc',
  model: `${colbertTableEngine.model} + catalogue co-occurrence`,
  async available() {
    const [a, b] = await Promise.all([colbertTableEngine.available(), coocEngine.available()]);
    return a.ok ? b : a;
  },
  async score(user: NoteInput, reference: NoteInput): Promise<SoftResult> {
    const started = performance.now();
    const [a, b] = await Promise.all([colbertTableEngine.score(user, reference), coocEngine.score(user, reference)]);
    const coocBest = new Map(b.alignments.map(x => [x.word, x]));
    return {
      engine: 'colbert+cooc',
      model: colbertCoocEngine.model,
      raw: (a.raw + b.raw) / 2,
      baseline: (a.baseline + b.baseline) / 2,
      softScore: (a.softScore + b.softScore) / 2,
      alignments: a.alignments.map(x => { const c = coocBest.get(x.word); return c && c.best !== x.best ? { ...x, best: `${x.best}|${c.best}` } : x; }),
      ms: performance.now() - started,
    };
  },
};
