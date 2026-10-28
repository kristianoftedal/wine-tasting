/**
 * Negation scope for tasting notes, applied before `sanitizeText`.
 *
 * `ikke` is a stopword, so without this "ikke noe fat" reached the ladder as
 * "fat" and earned a direct hit for the opposite of what the taster said.
 * Measured on the live corpus (28 Oct 2026) this touches 2 of 236 user notes
 * and 0 of 82 reference notes, so it is a correctness rule, not a scoring
 * lever; the benchmark's +NEG perturbation keeps it honest.
 *
 * Rule: after a negator, drop the first word that is not a filler, within a
 * short window, and drop the negator itself. The window stops at clause
 * boundaries ("men", "og", punctuation). "ikke bare X" is affirmation, not
 * negation ("ikke bare bær, men også krydder"), so "bare"/"kun" right after
 * the negator cancels it.
 *
 * Both notes go through this. The dropped words are returned so a negated
 * descriptor the reference *does* name can be surfaced as a contradiction;
 * it is reported, not scored.
 */

export const NEGATORS = new Set(['ikke', 'uten', 'ingen', 'intet', 'aldri']);

/** Words that may sit between a negator and the descriptor it negates. */
const FILLERS = new Set([
  'noe', 'noen', 'særlig', 'mye', 'spesielt', 'så', 'veldig', 'helt', 'spor', 'av', 'preg', 'innslag',
  'tydelig', 'lett', 'litt', 'mer', 'meget', 'stor', 'store', 'direkte', 'egentlig', 'markert',
  'antydning', 'til', 'den', 'det', 'de', 'en', 'et', 'noe', 'som', 'helst', 'nevneverdig', 'merkbar', 'merkbart',
]);

/** "ikke bare X" affirms X. */
const CANCEL = new Set(['bare', 'kun']);

const CLAUSE_END = new Set(['men', 'og', 'samt', 'eller', 'mens']);

/** Tokens scanned after a negator before giving up, fillers included. */
const WINDOW = 4;

const TRAILING_PUNCT = /[.,;:!?]+$/;
const PUNCT = /[.,;:!?()"'«»]/g;

const bare = (token: string) => token.toLowerCase().replace(PUNCT, '');

export type NegationResult = { text: string; negated: string[] };

export function applyNegation(text: string): NegationResult {
  if (!text || !text.trim()) return { text: text ?? '', negated: [] };

  const tokens = text.split(/\s+/).filter(Boolean);
  const drop = new Set<number>();
  const negated: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    if (drop.has(i)) continue;
    const word = bare(tokens[i]);
    if (!NEGATORS.has(word)) continue;
    // A negator ending a clause ("… ikke.") negates nothing we can see.
    if (TRAILING_PUNCT.test(tokens[i])) continue;

    // Fillers between the negator and the descriptor go with it ("ikke noe
    // fat" drops all three), so the remaining text reads as the taster's
    // positive claims only. They are stopwords, so scoring never saw them.
    const span = [i];
    for (let j = i + 1; j < tokens.length && j <= i + WINDOW; j++) {
      const candidate = bare(tokens[j]);
      if (j === i + 1 && CANCEL.has(candidate)) break;
      if (CLAUSE_END.has(candidate)) break;
      // "vet ikke, ikke sitrus": the inner negator takes over; a negator is
      // never the thing being negated.
      if (NEGATORS.has(candidate)) break;
      const endsClause = TRAILING_PUNCT.test(tokens[j]);
      if (FILLERS.has(candidate) || !candidate) {
        if (endsClause) break;
        span.push(j);
        continue;
      }
      span.push(j);
      for (const k of span) drop.add(k);
      negated.push(candidate);
      break;
    }
  }

  if (drop.size === 0) return { text, negated };
  return { text: tokens.filter((_, i) => !drop.has(i)).join(' '), negated };
}
