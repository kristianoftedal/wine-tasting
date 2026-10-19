import { describe, expect, it } from 'vitest';
import {
  assessNote,
  assessWineNotes,
  droppedDescriptors,
  isImprovement,
  isNotWorse,
  MAX_NOTE_CHARS,
  validateGeneratedNote
} from './noteQuality';

/**
 * The reference notes quoted here are verbatim from the live catalogue, so the
 * thresholds are tested against the data they were derived from rather than
 * against invented prose that happens to fit them.
 */

const RICH_SMELL =
  'Litt krydret og ungdommelig aroma av moden jordbær, nype, litt syltet frukt, blomst, kamfer og urt.';
const RICH_TASTE =
  'Saftig og fyldig, preg av modne jordbær, bringebær og syltet frukt, litt kamfer, fat, lakris og urt.';
const THIN_SMELL = 'Duft av røde bær.';
const STRUCTURE_ONLY_TASTE = 'Strukturert og kraftig med god dybde.';

describe('assessNote', () => {
  it('reads a rich catalogue note as rich', () => {
    const assessment = assessNote(RICH_SMELL);
    expect(assessment.verdict).toBe('rich');
    expect(assessment.scoreable).toBe(true);
    expect(assessment.aromaLemmas).toBeGreaterThanOrEqual(5);
    expect(assessment.mainCategories).toBeGreaterThan(1);
  });

  it('reads a one-descriptor note as thin', () => {
    const assessment = assessNote(THIN_SMELL);
    expect(assessment.verdict).toBe('thin');
    expect(assessment.aromaLemmas).toBe(1);
  });

  it('reads a structure-only note as unscoreable', () => {
    // This is the 18.7% case: the scoring engine drops the component entirely
    // rather than scoring it zero, so it outranks a thin note in the queue.
    const assessment = assessNote(STRUCTURE_ONLY_TASTE);
    expect(assessment.verdict).toBe('unscoreable');
    expect(assessment.scoreable).toBe(false);
  });

  it('treats missing text as empty rather than throwing', () => {
    expect(assessNote(null).verdict).toBe('empty');
    expect(assessNote('   ').verdict).toBe('empty');
  });

  it('counts sentences the way the corpus punctuates them', () => {
    expect(assessNote('Fyldig. Frisk i avslutning.').sentences).toBe(2);
    expect(assessNote(RICH_TASTE).sentences).toBe(1);
  });
});

describe('assessWineNotes', () => {
  it('ranks an unscoreable taste above a merely thin one', () => {
    const unscoreable = assessWineNotes(RICH_SMELL, STRUCTURE_ONLY_TASTE);
    const thin = assessWineNotes(RICH_SMELL, 'Fruktig med bærpreg.');
    expect(unscoreable.priority).toBeGreaterThan(thin.priority);
  });

  it('leaves a fully described wine out of the queue', () => {
    const assessment = assessWineNotes(RICH_SMELL, RICH_TASTE);
    expect(assessment.needsEnrichment).toBe(false);
    expect(assessment.priority).toBe(0);
  });

  it('explains why a wine was selected', () => {
    const assessment = assessWineNotes(THIN_SMELL, STRUCTURE_ONLY_TASTE);
    expect(assessment.needsEnrichment).toBe(true);
    expect(assessment.reasons.join(' ')).toMatch(/smell/);
    expect(assessment.reasons.join(' ')).toMatch(/taste/);
  });
});

describe('validateGeneratedNote', () => {
  it('accepts a note written in the catalogue style', () => {
    const result = validateGeneratedNote(RICH_SMELL);
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('rejects marketing language', () => {
    const result = validateGeneratedNote(
      'Fantastisk aroma av modne jordbær, nype, blomst, kamfer og urt som anbefales.'
    );
    expect(result.ok).toBe(false);
    expect(result.problems.join(' ')).toMatch(/markedsføringsord/);
  });

  it('rejects a note longer than any note in the catalogue', () => {
    const tooLong = `${RICH_SMELL.slice(0, -1)}, samt tobakk, lær, sjokolade, lakris, pepper og vanilje.`;
    expect(tooLong.length).toBeGreaterThan(MAX_NOTE_CHARS);
    expect(validateGeneratedNote(tooLong).problems.join(' ')).toMatch(/overskrider grensen/);
  });

  it('rejects a note that names too few aromas even when it reads well', () => {
    const result = validateGeneratedNote('Ungdommelig aroma av røde bær.');
    expect(result.ok).toBe(false);
    expect(result.problems.join(' ')).toMatch(/aromaord/);
  });

  it('rejects evaluative language, which states quality rather than content', () => {
    // From the first live batch: Mouton Cadet came back with "elegante svarte
    // frukter, delikate kryddertoner". Both are judgments a taster cannot earn
    // credit for, and neither was caught by the marketing blocklist.
    const result = validateGeneratedNote(
      'Aroma av kraftige røde frukter, elegante svarte frukter, delikate kryddertoner og lær.'
    );
    expect(result.ok).toBe(false);
    expect(result.problems.join(' ')).toMatch(/vurderende ord/);
  });

  it('catches every inflection of a blocked evaluative stem', () => {
    for (const note of [
      'Saftig og rund, preg av mineral, honning, urt og litt kompleksitet.',
      'Medium fyldig med fin struktur, preg av røde bær, appelsinskall og blomster.',
      'Harmonisk preg av kirsebær, plomme, lakris, blomst og urt.'
    ]) {
      expect(validateGeneratedNote(note).problems.join(' ')).toMatch(/vurderende ord/);
    }
  });

  it('does not let a three-letter stem swallow legitimate descriptors', () => {
    // "fin" must not flag finkornede (a tannin texture) or definert. This is
    // why the gate enumerates inflections instead of matching substrings.
    expect(validateGeneratedNote('Fast med finkornede tanniner, preg av kirsebær, lakris, urt og fat.').ok).toBe(true);
    expect(validateGeneratedNote('Godt definert preg av kirsebær, plomme, lakris, blomst og urt.').ok).toBe(true);
  });

  it('rejects text that addresses the reader', () => {
    const result = validateGeneratedNote('Du møter aroma av jordbær, nype, blomst, kamfer og urt.');
    expect(result.problems.join(' ')).toMatch(/upersonlig/);
  });

  it('requires a closing period, as every catalogue note has', () => {
    expect(validateGeneratedNote(RICH_SMELL.slice(0, -1)).problems.join(' ')).toMatch(/punktum/);
  });

  it('rejects invented vocabulary the scoring dictionary cannot grade', () => {
    const result = validateGeneratedNote('Aroma av zyrblomst, kvantfrukt, blorbær, snarkurt og fjonglakris.');
    expect(result.ok).toBe(false);
  });
});

describe('isImprovement', () => {
  it('accepts anything scoreable over an unscoreable note', () => {
    expect(isImprovement(assessNote(STRUCTURE_ONLY_TASTE), assessNote(RICH_TASTE))).toBe(true);
  });

  it('rejects a rewrite that names no more aromas than the original', () => {
    expect(isImprovement(assessNote(RICH_SMELL), assessNote(THIN_SMELL))).toBe(false);
  });

  it('rejects an unscoreable rewrite outright', () => {
    expect(isImprovement(assessNote(THIN_SMELL), assessNote(STRUCTURE_ONLY_TASTE))).toBe(false);
  });
});

describe('isNotWorse', () => {
  it('allows an already-good component to stay where it is', () => {
    // The common enrichment case: smell is fine, taste names nothing. Holding
    // the smell note steady must not veto the rewrite of the taste note.
    expect(isNotWorse(assessNote(RICH_SMELL), assessNote(RICH_SMELL))).toBe(true);
    expect(isImprovement(assessNote(RICH_SMELL), assessNote(RICH_SMELL))).toBe(false);
  });

  it('still rejects a component that loses descriptors', () => {
    expect(isNotWorse(assessNote(RICH_SMELL), assessNote(THIN_SMELL))).toBe(false);
  });

  it('rejects an unscoreable rewrite', () => {
    expect(isNotWorse(assessNote(RICH_TASTE), assessNote(STRUCTURE_ONLY_TASTE))).toBe(false);
  });
});

describe('droppedDescriptors', () => {
  it('names descriptors the rewrite lost', () => {
    const before = assessNote('Aroma av jordbær, valnøtt og kjøtt. Toner av røyk og krydder.');
    const after = assessNote('Aroma av modne kirsebær, kamfer, lær, tobakk og hint av valnøtt.');
    expect(droppedDescriptors(before, after)).toContain('jordbær');
  });

  it('is empty when the rewrite only adds', () => {
    const before = assessNote('Duft av røde bær.');
    const after = assessNote('Aroma av røde bær, kirsebær, lakris, blomst og litt fat.');
    expect(droppedDescriptors(before, after)).toEqual([]);
  });
});
