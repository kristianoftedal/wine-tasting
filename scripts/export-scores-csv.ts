#!/usr/bin/env npx tsx
/**
 * One row per scored note field with every engine's score and the reason.
 *
 * Reads the frozen set, the static extract (engine scores and word
 * alignments) and the rater files; recomputes the ladder matches (no API).
 * The reason columns are mechanical, not editorial: which words earned
 * which tier, which words missed, and where each engine's soft term found
 * or failed to find a match. Semicolon-separated, UTF-8 with BOM.
 *
 *   npx tsx scripts/export-scores-csv.ts [--out=scripts/validation-results/scores-by-engine-<date>.csv]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { sanitizeText } from '../src/lib/lemmatizeAndWeight';
import { normalizeWineSynonyms } from '../src/lib/synonymNormalization';
import { applyNegation } from '../src/lib/negation';
import { combineScoreScaled, lexicalCredit, hasScoreableFlavour, type ScoringOptions } from '../src/lib/flavourScoring';
import { hybridSoftScore } from '../src/lib/softEngines/hybrid';
import { existsSync } from 'node:fs';
import { mean } from '../src/lib/stats';
import { loadRaterFiles } from './ratings-csv';
import type { FrozenSet } from './export-frozen-set';
import type { EngineComparison } from '../src/lib/softEngines/comparison';

const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const OUT = arg('out') ?? `scripts/validation-results/scores-by-engine-${new Date().toISOString().slice(0, 10)}.csv`;
const prep = (t: string) => normalizeWineSynonyms(sanitizeText(applyNegation(t).text));
const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

function main() {
  const frozen = JSON.parse(readFileSync('scripts/validation-results/frozen-set-2026-10.json', 'utf8')) as FrozenSet;
  const extract = JSON.parse(readFileSync('src/app/scoring-demo/engine-comparison.generated.json', 'utf8')) as EngineComparison;
  const byKey = new Map(extract.fields.map(f => [f.key, f]));
  const raters = loadRaterFiles();
  const human = raters.get('kristian');
  const panel = [...raters.entries()].filter(([k]) => k.startsWith('llm')).map(([, m]) => m);

  // Variants measured but not shipped, recomputed from the extract's soft
  // term (OpenAI engine) so every column is the same code at the same commit.
  const sidecar = 'scripts/validation-results/frozen-set-2026-10.categories.json';
  const categories = existsSync(sidecar) ? (JSON.parse(readFileSync(sidecar, 'utf8')) as Record<string, string | null>) : {};
  const VARIANTS: Array<{ column: string; options: ScoringOptions; hybrid?: boolean; category?: boolean }> = [
    { column: 'score_openai_style_weights', options: { styleWeights: true }, category: true },
    { column: 'score_openai_hybrid_soft', options: {}, hybrid: true },
    { column: 'score_openai_tuned_constants', options: { hitWeight: 0.9, tau: 3, precisionFloor: 0.9 } },
    { column: 'score_openai_no_specific_tier', options: { hypernymExclude: ['frukt', 'bær', 'sitrus', 'steinfrukt', 'kjernefrukt', 'urt', 'blomst', 'nøtt', 'treverk', 'mineral'] } },
    { column: 'score_openai_structural_out', options: { ignoreGeneric: true } },
  ];

  const header = ['key', 'event', 'wine', 'field', 'taster', 'user_note', 'reference_note', 'stored_score', 'score_previous_engine_aug_2026', 'rating_kristian', 'rating_llm_panel',
    'score_openai', 'score_bert', 'score_bert_iso', 'score_colbert_word', 'score_colbert_token', 'score_colbert_iso', 'score_colbert_table', 'score_colbert_tuned',
    ...VARIANTS.map(v => v.column),
    'reason_ladder', 'reason_soft_openai', 'reason_soft_bert', 'reason_soft_colbert', 'why_engines_differ'];
  const rows: string[] = [header.join(';')];

  for (const f of frozen.fields) {
    const x = byKey.get(f.key);
    const userNorm = prep(f.userNote), refNorm = prep(f.referenceNote);
    const scoreable = hasScoreableFlavour(refNorm);
    const lex = lexicalCredit(userNorm, refNorm);

    let ladder: string;
    if (!scoreable) ladder = 'Reference names no aroma (structure only): component excluded, score 0 for every engine.';
    else if (!lex.matches.length) ladder = 'No dictionary word in the note: nothing the ladder can credit; soft term only.';
    else {
      const by = (kind: string) => lex.matches.filter(m => m.kind === kind);
      const parts: string[] = [];
      if (by('direct').length) parts.push(`direct: ${by('direct').map(m => m.lemma).join(', ')}`);
      if (by('derived').length) parts.push(`derived: ${by('derived').map(m => `${m.lemma} (via ${m.via})`).join(', ')}`);
      if (by('specific').length) parts.push(`specific: ${by('specific').map(m => `${m.lemma} (under ${m.via})`).join(', ')}`);
      if (by('subcategory').length) parts.push(`right family only: ${by('subcategory').map(m => m.lemma).join(', ')}`);
      if (by('category').length) parts.push(`right category only: ${by('category').map(m => m.lemma).join(', ')}`);
      if (by('none').length) parts.push(`no credit: ${by('none').map(m => m.lemma).join(', ')}`);
      ladder = `${parts.join(' | ')} → hit mass ${lex.hitMass.toFixed(1)} of ${lex.userMass.toFixed(1)} (precision ${Math.round(lex.precision * 100)}%), hit score ${Math.round(lex.hitScore)}`;
    }

    const soft = (id: 'openai' | 'bert' | 'colbert-token') => {
      const s = x?.scores[id];
      if (!s || !scoreable) return '';
      const al = s.alignments;
      if (!al.length) return `soft ${Math.round(s.softScore)}: no content words with a vector`;
      const strong = al.filter(a => a.best && a.best !== a.word && a.sim >= 0.5).map(a => `${a.word}→${a.best} ${a.sim.toFixed(2)}`);
      const weak = al.filter(a => a.sim < 0.3).map(a => `${a.word}→${a.best ?? '∅'} ${a.sim.toFixed(2)}`);
      const exact = al.filter(a => a.best === a.word).map(a => a.word);
      const bits: string[] = [];
      if (exact.length) bits.push(`exact: ${exact.join(', ')}`);
      if (strong.length) bits.push(`near: ${strong.join(', ')}`);
      if (weak.length) bits.push(`far: ${weak.join(', ')}`);
      return `soft ${Math.round(s.softScore)} (raw ${s.raw.toFixed(2)}): ${bits.join(' | ')}`;
    };

    let why = '';
    if (x && scoreable) {
      const o = x.scores.openai, c = x.scores['colbert-token'], b = x.scores.bert;
      if (o && c && b) {
        const diffs: string[] = [];
        const oBest = new Map(o.alignments.map(a => [a.word, a.best]));
        for (const a of c.alignments) if (oBest.has(a.word) && oBest.get(a.word) !== a.best) diffs.push(`${a.word}: openai→${oBest.get(a.word)}, colbert→${a.best}`);
        const gap = c.score - o.score;
        if (Math.abs(gap) >= 15) why = `${gap > 0 ? 'colbert higher' : 'openai higher'} by ${Math.abs(gap)}: `;
        else why = 'engines agree within 15: ';
        if (!o.alignments.length) why += 'no content words, lexical part identical, difference is zero soft credit vs nothing.';
        else if (diffs.length) why += `different best match for ${diffs.join('; ')}.`;
        else why += 'same word matches; the local engines are rescaled against a measured floor, which gives common exact words less soft credit than the OpenAI scale does.';
        if (b.score - o.score >= 15) why += ` bert higher by ${b.score - o.score}.`;
        else if (o.score - b.score >= 15) why += ` bert lower by ${o.score - b.score}.`;
      }
    } else if (!scoreable) why = 'not scoreable';

    const p = panel.map(m => m.get(f.key)).filter((v): v is number => v !== undefined);
    const o = x?.scores.openai;
    const variantScores = VARIANTS.map(v => {
      if (!o || !scoreable) return '';
      const options: ScoringOptions = { ...v.options, category: v.category ? categories[f.wine.id] ?? null : null };
      const lexicalV = lexicalCredit(userNorm, refNorm, options);
      const softV = v.hybrid ? hybridSoftScore({ engine: 'openai', model: '', raw: o.raw, baseline: 0, softScore: o.softScore, alignments: o.alignments, ms: 0 }, lexicalV) : o.softScore;
      return combineScoreScaled(lexicalV, softV, true, options).score;
    });
    rows.push([
      f.key, f.event?.name ?? '', `${f.wine.name}${f.wine.year ? ` ${f.wine.year}` : ''}`, f.field, f.taster, f.userNote, f.referenceNote,
      f.storedScore ?? '', f.previousScore ?? '', human?.get(f.key) ?? '', p.length ? mean(p).toFixed(1) : '',
      o?.score ?? '', x?.scores.bert?.score ?? '', x?.scores['bert-iso']?.score ?? '', x?.scores['colbert-word']?.score ?? '', x?.scores['colbert-token']?.score ?? '', x?.scores['colbert-iso']?.score ?? '', x?.scores['colbert-table']?.score ?? '', x?.scores['colbert-tuned']?.score ?? '',
      ...variantScores,
      ladder, soft('openai'), soft('bert'), soft('colbert-token'), why,
    ].map(q).join(';'));
  }
  writeFileSync(OUT, '﻿' + rows.join('\n') + '\n');
  console.log(`written ${OUT}: ${rows.length - 1} rows`);
}

main();
