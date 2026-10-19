/**
 * How precise is a Vinmonopolet reference note?
 *
 * The scoring engine credits a taster for descriptors they named and never
 * penalises omissions (src/lib/scoringConfig.ts). That makes the *reference*
 * note the ceiling: a taster facing "Duft av røde bær." can earn at most one
 * direct hit no matter how well they taste, while everyone else in the same
 * club is scored against a note naming eight descriptors. This module measures
 * that ceiling so the enrichment pipeline can target the thinnest notes.
 *
 * Measured on the live catalogue (50 057 wines, scripts/build-note-style.ts):
 *
 *   aroma lemmas | smell notes | taste notes
 *   -------------+-------------+------------
 *   0            |  1.1%       | 19.8%
 *   1            |  6.1%       | 23.7%
 *   2            | 19.4%       | 20.7%
 *   >= 3         | 73.4%       | 35.8%
 *
 * 19.8% of taste notes name no aroma at all — the `scoreable: false` case the
 * engine already drops from the weighted average. Those wines are not scored
 * unfairly, they are scored on fewer components, which is its own unfairness:
 * a club comparing two wines compares a 3-component average against a
 * 2-component one. They are the top of the enrichment queue.
 *
 * Thresholds here are deliberately expressed against that distribution rather
 * than picked round: THIN = below 2 is the bottom quartile of smell notes and
 * the bottom 43.5% of taste notes.
 */
import { hasScoreableFlavour, lemmasWithWeight } from './flavourScoring';
import { norwegianLemmas, sanitizeText, stopwords, tokenizeSanitized } from './lemmatizeAndWeight';
import { normalizeWineSynonyms } from './synonymNormalization';

/** Below this many distinct aroma lemmas a note cannot carry a fair comparison. */
export const THIN_AROMA_LEMMAS = 2;
/** At or above this the note is as rich as the corpus median strong note. */
export const RICH_AROMA_LEMMAS = 4;

/**
 * Vinmonopolet's own notes never exceed 100 characters — measured max across
 * all 50 057 rows, on both fields. A generated note that exceeds it would be
 * visibly not-of-the-house, so the style gate treats it as a hard limit.
 */
export const MAX_NOTE_CHARS = 100;
/** Shortest authentic strong note measured in the corpus was 28 characters. */
export const MIN_NOTE_CHARS = 28;

/**
 * Share of content words the lemma dictionary does not know. Authentic notes
 * sit at p50 0.00 / p90 0.17 / p99 0.38 — the tail is real Norwegian wine prose
 * the dictionary has not absorbed ("ørlite", "streif", "flintrøyk"), not noise.
 * Gating at the 99th percentile rejects hallucinated vocabulary without
 * rejecting notes that merely use a word the dictionary lacks.
 */
export const MAX_OOV_RATIO = 0.4;

export type NoteVerdict = 'empty' | 'unscoreable' | 'thin' | 'adequate' | 'rich';

export type NoteAssessment = {
  /** Distinct non-GENERIC lemmas — what a taster can actually hit. */
  aromaLemmas: number;
  /** Distinct main categories covered; breadth, not just count. */
  mainCategories: number;
  /** Summed profile weight of the aroma lemmas. */
  aromaMass: number;
  /** Fraction of content words unknown to the lemma dictionary. */
  oovRatio: number;
  /** What `hasScoreableFlavour` says — false means the engine drops the component. */
  scoreable: boolean;
  charCount: number;
  sentences: number;
  verdict: NoteVerdict;
  /** The aroma lemmas found, for explaining a verdict in the audit output. */
  lemmas: string[];
  /**
   * Content words the lemma dictionary does not know. Named rather than just
   * counted: when a draft is rejected for drifting off-vocabulary, the retry
   * needs to know it was "amarena" and "sukkerspinn", not that 43% of something
   * was wrong.
   */
  unknownWords: string[];
};

const EMPTY_ASSESSMENT: NoteAssessment = {
  aromaLemmas: 0,
  mainCategories: 0,
  aromaMass: 0,
  oovRatio: 0,
  scoreable: false,
  charCount: 0,
  sentences: 0,
  verdict: 'empty',
  lemmas: [],
  unknownWords: []
};

/** Count sentences the way the corpus writes them — period-delimited clauses. */
export function countSentences(text: string): number {
  return text.split(/[.!?]+/).filter(part => part.trim().length > 0).length;
}

/**
 * Measure one reference note. Runs the same prep pipeline as
 * `scoreFlavourNote` (sanitise → synonym-normalise) so the lemma counts here
 * are the lemma counts scoring will see, not an approximation of them.
 */
export function assessNote(text: string | null | undefined): NoteAssessment {
  if (!text || !text.trim()) return { ...EMPTY_ASSESSMENT };

  const normalised = normalizeWineSynonyms(sanitizeText(text));
  const aroma = [...lemmasWithWeight(normalised).values()].filter(info => info.main && info.main !== 'GENERIC');

  const contentWords = tokenizeSanitized(normalised).filter(token => !stopwords.has(token));
  const unknown = contentWords.filter(token => !norwegianLemmas[token]);

  const assessment: NoteAssessment = {
    aromaLemmas: aroma.length,
    mainCategories: new Set(aroma.map(info => info.main)).size,
    aromaMass: aroma.reduce((sum, info) => sum + info.weight, 0),
    oovRatio: contentWords.length > 0 ? unknown.length / contentWords.length : 0,
    scoreable: hasScoreableFlavour(normalised),
    charCount: text.trim().length,
    sentences: countSentences(text),
    verdict: 'adequate',
    lemmas: aroma.map(info => info.lemma),
    unknownWords: [...new Set(unknown)]
  };

  assessment.verdict = verdictFor(assessment);
  return assessment;
}

function verdictFor(a: NoteAssessment): NoteVerdict {
  if (!a.scoreable) return 'unscoreable';
  if (a.aromaLemmas < THIN_AROMA_LEMMAS) return 'thin';
  if (a.aromaLemmas >= RICH_AROMA_LEMMAS) return 'rich';
  return 'adequate';
}

export type WineNoteAssessment = {
  smell: NoteAssessment;
  taste: NoteAssessment;
  /** True when at least one component is empty, unscoreable or thin. */
  needsEnrichment: boolean;
  /**
   * Enrichment queue ordering, higher first. Not a quality score — a measure of
   * how much a taster is disadvantaged by this particular pair of notes.
   */
  priority: number;
  reasons: string[];
};

/**
 * Deficit per component, summed. An unscoreable component costs more than a
 * thin one because the engine drops it entirely rather than scoring it badly,
 * and taste costs more than smell because taste is where the catalogue is thin
 * (19.8% unscoreable versus 1.1%).
 */
const COMPONENT_WEIGHT = { smell: 1, taste: 1.2 } as const;

export function assessWineNotes(
  smell: string | null | undefined,
  taste: string | null | undefined
): WineNoteAssessment {
  const assessments = { smell: assessNote(smell), taste: assessNote(taste) };
  const reasons: string[] = [];
  let priority = 0;

  for (const component of ['smell', 'taste'] as const) {
    const a = assessments[component];
    const weight = COMPONENT_WEIGHT[component];

    if (a.verdict === 'empty') {
      priority += 10 * weight;
      reasons.push(`${component}: mangler helt`);
    } else if (a.verdict === 'unscoreable') {
      priority += 8 * weight;
      reasons.push(`${component}: ingen aromaord — komponenten faller ut av snittet`);
    } else if (a.verdict === 'thin') {
      priority += 4 * weight;
      reasons.push(`${component}: bare ${a.aromaLemmas} aromaord`);
    } else if (a.verdict === 'adequate') {
      priority += (RICH_AROMA_LEMMAS - a.aromaLemmas) * weight;
    }
  }

  return {
    ...assessments,
    needsEnrichment: reasons.length > 0,
    priority,
    reasons
  };
}

/**
 * Words the catalogue does not use. Vinmonopolet's editorial rule bans praise,
 * emotive adjectives and any call to buy; a sweep of all 100 114 notes found 9
 * violations total, so the corpus itself is the evidence that this list belongs
 * in the gate rather than in a style suggestion.
 */
export const BANNED_MARKETING_TERMS = [
  'fantastisk',
  'nydelig',
  'deilig',
  'herlig',
  'vidunderlig',
  'praktfull',
  'perfekt',
  'suveren',
  'eksepsjonell',
  'enestående',
  'utrolig',
  'imponerende',
  'spennende',
  'forførende',
  'sensasjonell',
  'beste',
  'bestselger',
  'favoritt',
  'anbefales',
  'anbefaling',
  'må prøves',
  'verdt',
  'kjøp',
  'prisbelønt',
  'prisvinner',
  'kupp',
  'elsker',
  'nyt',
  'nytes',
  'unn deg',
  'garantert',
  'klassiker'
];

/**
 * Judgments, not observations.
 *
 * Vinmonopolet's rule says a note states what is there, not how good it is —
 * but their own notes break it: `kompleks` appears in 3 765 of the 99 722 live
 * notes (3.78%) and `fin` in 2 129 (2.13%), against `elegant` 1 090, `delikat`
 * 477, `flott` 25 and `harmonisk` 23. Blocking them therefore holds generated
 * notes to a stricter standard than the catalogue holds itself. That is
 * deliberate: the enrichment exists to produce notes a taster can be scored
 * against, and "kompleks" is a word no taster can earn credit for.
 *
 * Kept separate from BANNED_MARKETING_TERMS because the two lists answer
 * different questions — is this sales copy, versus is this an opinion.
 */
export const BANNED_EVALUATIVE_TERMS = ['elegant', 'delikat', 'kompleks', 'fin', 'flott', 'harmonisk'];

/**
 * Norwegian inflections of a blocked stem, anchored at both ends.
 *
 * Substring matching cannot be used for a three-letter stem: `fin` would flag
 * `raffinert` and `definert`. An open suffix (`fin[a-zæøå]*`) is no better — it
 * swallows `finkornede`, a legitimate tannin texture. Enumerating the endings
 * catches fin/fint/fine and stops there.
 */
const INFLECTIONS = '(?:e|t|te|en|er|ere|est|este|itet|iteten)?';

function blockedTermsIn(text: string, terms: string[]): string[] {
  return terms.filter(term => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}${INFLECTIONS}\\b`, 'i').test(text);
  });
}

export type NoteValidation = { ok: boolean; problems: string[]; assessment: NoteAssessment };

/**
 * Gate a generated note before it is allowed near the database.
 *
 * Two jobs: it must read as a Vinmonopolet note (length, sentence count, no
 * marketing), and it must be *better* than what it replaces — otherwise the
 * pipeline burns tokens to swap one thin note for another.
 */
export function validateGeneratedNote(
  text: string,
  options: { minAromaLemmas?: number; maxSentences?: number } = {}
): NoteValidation {
  const minAroma = options.minAromaLemmas ?? 3;
  const maxSentences = options.maxSentences ?? 2;
  const trimmed = (text ?? '').trim();
  const assessment = assessNote(trimmed);
  const problems: string[] = [];

  if (trimmed.length === 0) {
    return { ok: false, problems: ['tom tekst'], assessment };
  }
  if (trimmed.length > MAX_NOTE_CHARS) {
    problems.push(`${trimmed.length} tegn overskrider grensen på ${MAX_NOTE_CHARS}`);
  }
  if (trimmed.length < MIN_NOTE_CHARS) {
    problems.push(`${trimmed.length} tegn er kortere enn korteste ekte note (${MIN_NOTE_CHARS})`);
  }
  if (!/[.]$/.test(trimmed)) {
    problems.push('mangler avsluttende punktum');
  }
  if (assessment.sentences > maxSentences) {
    problems.push(`${assessment.sentences} setninger overskrider grensen på ${maxSentences}`);
  }
  if (assessment.aromaLemmas < minAroma) {
    problems.push(`bare ${assessment.aromaLemmas} aromaord, krever minst ${minAroma}`);
  }
  if (!assessment.scoreable) {
    problems.push('ingen aromaord scoringsmotoren kjenner igjen');
  }
  if (assessment.oovRatio > MAX_OOV_RATIO) {
    problems.push(
      `${Math.round(assessment.oovRatio * 100)}% ukjente ord overskrider ${MAX_OOV_RATIO * 100}% — ` +
        `scoringsordboka kjenner ikke: ${assessment.unknownWords.join(', ')}`
    );
  }

  const lowered = trimmed.toLowerCase();
  const marketing = blockedTermsIn(lowered, BANNED_MARKETING_TERMS);
  if (marketing.length > 0) {
    problems.push(`markedsføringsord: ${marketing.join(', ')}`);
  }
  const evaluative = blockedTermsIn(lowered, BANNED_EVALUATIVE_TERMS);
  if (evaluative.length > 0) {
    problems.push(`vurderende ord — notatet skal si hva som er der, ikke hvor bra: ${evaluative.join(', ')}`);
  }
  if (/\b(jeg|vi|du|deg|din|ditt|dine)\b/.test(lowered)) {
    problems.push('henvender seg til leseren — notatet skal være upersonlig');
  }

  return { ok: problems.length === 0, problems, assessment };
}

/** True when the candidate names strictly more aromas than the note it replaces. */
export function isImprovement(before: NoteAssessment, after: NoteAssessment): boolean {
  if (!after.scoreable) return false;
  if (!before.scoreable) return true;
  return after.aromaLemmas > before.aromaLemmas;
}

/**
 * Aroma lemmas the original note named and the rewrite does not.
 *
 * Vinmonopolet's text is the catalogue of record: somebody tasted the wine and
 * wrote down what they found. An enrichment that swaps "jordbær" for "kirsebær"
 * because a critic's note for a neighbouring vintage said cherry is not adding
 * information, it is overwriting a first-hand observation with a second-hand
 * one — and it would silently cost credit to every taster who correctly named
 * the original descriptor. Enrichment extends the note; it never edits it.
 */
export function droppedDescriptors(before: NoteAssessment, after: NoteAssessment): string[] {
  const kept = new Set(after.lemmas);
  return before.lemmas.filter(lemma => !kept.has(lemma));
}

/**
 * True when the candidate does not lose ground.
 *
 * Applied per component, because the two components are rarely thin together —
 * only 4.8% of wines are weak in both. The common case is a catalogue-standard
 * smell note beside a taste note that names no aroma at all. Demanding that the
 * already-good smell note also improve would throw away a correct rewrite of
 * the broken one, so each component only has to hold its ground while the wine
 * as a whole has to gain somewhere.
 */
export function isNotWorse(before: NoteAssessment, after: NoteAssessment): boolean {
  if (!after.scoreable) return false;
  if (!before.scoreable) return true;
  return after.aromaLemmas >= before.aromaLemmas;
}
