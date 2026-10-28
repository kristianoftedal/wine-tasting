#!/usr/bin/env npx tsx
/**
 * Tune the unknown-word mapping threshold (src/lib/oovMapping.ts).
 *
 * Labelled set:
 *   positives  the synonym map's keys that are not dictionary words, each
 *              paired with the aroma lemma it stands for, plus unknown words
 *              from real taster notes whose intended descriptor is obvious
 *   negatives  unknown words from real notes that are not aroma descriptors
 *              (colour, structure, verbs, foreign fillers) and must stay unmapped
 *
 * For every candidate threshold: a positive counts as correct when its
 * nearest aroma lemma is the expected one AND clears the threshold; a
 * negative counts as a false accept when it clears the threshold at all.
 * The chosen threshold maximises correct − 2·false accepts: a wrong mapping
 * grades the taster on a word they did not write, which is worse than a
 * missed one. Writes src/lib/oov-threshold.generated.json and a report.
 *
 *   npx tsx --env-file=.env.local scripts/tune-oov-threshold.ts
 */
import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { norwegianLemmas } from '../src/lib/lemmatizeAndWeight';
import { WINE_SYNONYMS } from '../src/lib/synonymNormalization';
import { AROMA_CANDIDATES, isUnknownWord, nearestAromaLemmas } from '../src/lib/oovMapping';

const OUT = 'src/lib/oov-threshold.generated.json';
const REPORT = `scripts/validation-results/oov-threshold-${new Date().toISOString().slice(0, 10)}.md`;

/** Unknown words seen in the frozen set's user notes, hand-labelled. */
const REAL_POSITIVES: Record<string, string> = {
  brioch: 'brioche', toasty: 'toast', chili: 'chili', hibiscus: 'blomst', aske: 'røyk', autolyse: 'bakverk', bakt: 'bakverk',
};
const REAL_NEGATIVES = [
  'gult', 'mindre', 'sur', 'organisk', 'saft', 'vet', 'forrige', 'annet', 'kjerne', 'temper', 'lys', 'alkohol', 'søtere',
  'melne', 'melende', 'hard', 'bobler', 'fortynna', 'besk', 'portvin', 'boozy', 'flor', 'skarp', 'maling', 'juicy', 'smooth',
];

async function main() {
  const aroma = new Set(AROMA_CANDIDATES.map(c => c.lemma));
  const positives: Array<{ word: string; expected: string; source: string }> = [];
  for (const [key, canonical] of Object.entries(WINE_SYNONYMS)) {
    if (!isUnknownWord(key)) continue;
    const lemma = norwegianLemmas[canonical]?.lemma;
    if (lemma && aroma.has(lemma)) positives.push({ word: key, expected: lemma, source: 'synonym map' });
  }
  for (const [word, expected] of Object.entries(REAL_POSITIVES)) {
    if (!aroma.has(expected)) { console.warn(`skip ${word}: ${expected} is not an aroma lemma`); continue; }
    if (isUnknownWord(word)) positives.push({ word, expected, source: 'real note' });
  }
  const negatives = REAL_NEGATIVES.filter(isUnknownWord);

  const nearest = await nearestAromaLemmas([...positives.map(p => p.word), ...negatives]);
  const rows = [
    ...positives.map(p => ({ ...p, kind: 'positive' as const, got: nearest.get(p.word) })),
    ...negatives.map(word => ({ word, expected: '—', source: 'real note', kind: 'negative' as const, got: nearest.get(word) })),
  ];

  const lines: string[] = [];
  const log = (s = '') => { lines.push(s); console.log(s); };
  let commit = 'unknown';
  try { commit = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* ignore */ }
  log(`# Unknown-word mapping threshold — ${new Date().toISOString().slice(0, 10)}`);
  log();
  log(`Commit \`${commit}\`. ${positives.length} positives, ${negatives.length} negatives, ${AROMA_CANDIDATES.length} aroma lemmas as targets.`);
  log();
  log('| word | kind | expected | nearest | cosine | nearest is expected |');
  log('| --- | --- | --- | --- | --- | --- |');
  for (const r of rows.sort((a, b) => (b.got?.sim ?? -1) - (a.got?.sim ?? -1))) {
    log(`| ${r.word} | ${r.kind} | ${r.expected} | ${r.got?.lemma ?? '—'} | ${r.got ? r.got.sim.toFixed(3) : '—'} | ${r.kind === 'positive' ? (r.got?.lemma === r.expected ? 'yes' : 'no') : ''} |`);
  }
  log();
  log('| threshold | correct positives | missed positives | wrong positives accepted | negatives accepted | objective |');
  log('| --- | --- | --- | --- | --- | --- |');
  let best = { t: 0.5, objective: -Infinity };
  for (let t = 0.1; t <= 0.9001; t += 0.05) {
    let correct = 0, missed = 0, wrongAccepted = 0, negAccepted = 0;
    for (const r of rows) {
      const accepted = !!r.got && r.got.sim >= t;
      if (r.kind === 'positive') {
        if (accepted && r.got!.lemma === r.expected) correct++;
        else if (accepted) wrongAccepted++;
        else missed++;
      } else if (accepted) negAccepted++;
    }
    const objective = correct - 2 * (wrongAccepted + negAccepted);
    if (objective > best.objective) best = { t: Number(t.toFixed(2)), objective };
    log(`| ${t.toFixed(2)} | ${correct} | ${missed} | ${wrongAccepted} | ${negAccepted} | ${objective} |`);
  }
  log();
  log(`Chosen threshold: **${best.t}** (objective ${best.objective}).`);
  writeFileSync(OUT, JSON.stringify({ threshold: best.t, tunedAt: new Date().toISOString(), commit, positives: positives.length, negatives: negatives.length, objective: 'correct − 2·(wrong + negative accepts)' }, null, 2) + '\n');
  writeFileSync(REPORT, lines.join('\n') + '\n');
  console.log(`\nwritten ${OUT} and ${REPORT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
