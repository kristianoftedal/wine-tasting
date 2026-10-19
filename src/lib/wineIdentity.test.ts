import { describe, expect, it } from 'vitest';
import { classifyVintage, normalizeWineName, sourceMentionsCuvee, verifyWineIdentity } from './wineIdentity';

/**
 * The two rejections here are the actual failures from the first live batch.
 * Both produced fluent notes that passed every style gate, and both were about
 * a different bottle than the one in the glass.
 */
describe('verifyWineIdentity', () => {
  it('rejects a different cuvée by the same producer', () => {
    // Both names contain "Kirnbauer". Without stripping the producer, that
    // shared word alone passed the check — which is how this got through.
    const verdict = verifyWineIdentity(
      'Kirnbauer K+K Konquest 2018',
      'K+K Kirnbauer Das Phantom 2018',
      'Weingut K+K Kirnbauer'
    );
    expect(verdict.sameWine).toBe(false);
    expect(verdict.reason).toMatch(/deler ingen særegne ord/);
  });

  it('rejects a different quality tier that shares every other word', () => {
    const verdict = verifyWineIdentity(
      'Santa Carolina Merlot 2015',
      'Santa Carolina Reserva Merlot 2015',
      'Viña Santa Carolina'
    );
    expect(verdict.sameWine).toBe(false);
    expect(verdict.reason).toMatch(/ulikt kvalitetsnivå/);
  });

  it('accepts the same wine named slightly differently', () => {
    expect(verifyWineIdentity('Guigal Châteauneuf-du-Pape 2022', 'E. Guigal Chateauneuf-du-Pape 2022').sameWine).toBe(
      true
    );
  });

  it('falls back to the full name when the wine is named after its producer', () => {
    // "Baron de L" is the producer's name. Stripping it would leave nothing.
    expect(verifyWineIdentity('Baron de L 2022', 'Baron de L Pouilly-Fumé 2022', 'Baron de Ladoucette').sameWine).toBe(
      true
    );
  });

  it('accepts a source that adds the appellation the catalogue omits', () => {
    // "Bordeaux Supérieur" names a place, not a tier — the catalogue row just
    // does not carry it. Rejecting this would throw away a correct source.
    expect(
      verifyWineIdentity('Ch. Timberlay 2018', 'Robert Giraud Château Timberlay Bordeaux Supérieur').sameWine
    ).toBe(true);
  });

  it('accepts a matching cru on both sides', () => {
    expect(
      verifyWineIdentity(
        'Daniel-Etienne Defaix Chablis 1er Cru Les Lys 2014',
        'Daniel-Etienne Defaix Chablis 1er Cru Les Lys'
      ).sameWine
    ).toBe(true);
  });

  it('does not accept two unrelated Bordeaux on shared boilerplate alone', () => {
    // Both are "Château", both are red. That is not evidence.
    expect(verifyWineIdentity('Ch. Timberlay 2018', 'Château Lafite Rothschild 2018').sameWine).toBe(false);
  });

  it('refuses when the source states no name', () => {
    expect(verifyWineIdentity('Ch. Timberlay 2018', '').sameWine).toBe(false);
  });

  it('strips vintages and accents when comparing', () => {
    expect(normalizeWineName('Guigal Châteauneuf-du-Pape 2022')).toBe('guigal chateauneuf du pape');
  });
});

describe('classifyVintage', () => {
  it('recognises the exact vintage', () => {
    expect(classifyVintage('2018', '2018')).toBe('exact');
  });

  it('treats a vintage within two years as a neighbour', () => {
    // The prompt permits neighbouring vintages when flagged; this is what marks
    // a 2014 wine written from a 2012 note for the reviewer.
    expect(classifyVintage('2014', '2012')).toBe('neighbour');
  });

  it('does not stretch to a distant vintage', () => {
    expect(classifyVintage('2014', '2021')).toBe('unknown');
  });

  it('handles a missing or non-numeric vintage', () => {
    expect(classifyVintage(null, '2018')).toBe('unknown');
    expect(classifyVintage('2018', 'ukjent')).toBe('unknown');
  });
});

describe('sourceMentionsCuvee', () => {
  it('accepts a page that names the cuvée', () => {
    expect(
      sourceMentionsCuvee('… K+K Kirnbauer Konquest, Cabernet Franc …', 'Kirnbauer K+K Konquest 2018', 'K+K Kirnbauer')
    ).toBe(true);
  });

  it('rejects a producer page that only discusses another cuvée', () => {
    expect(
      sourceMentionsCuvee(
        'Weingut K+K Kirnbauer — Das Phantom, our flagship Blaufränkisch blend.',
        'Kirnbauer K+K Konquest 2018',
        'K+K Kirnbauer'
      )
    ).toBe(false);
  });

  it('does not match a cuvée token inside a longer word', () => {
    expect(sourceMentionsCuvee('Konquestador Wines', 'Kirnbauer K+K Konquest 2018', 'K+K Kirnbauer')).toBe(false);
  });

  it('falls back to the producer token when the wine is named after its producer', () => {
    // "Baron de L" leaves nothing after stripping "Baron de Ladoucette", so the
    // check falls back to the full name — the source must still say "Baron".
    expect(sourceMentionsCuvee('Baron de L, Pouilly-Fumé', 'Baron de L 2022', 'Baron de Ladoucette')).toBe(true);
    expect(sourceMentionsCuvee('an unrelated Sancerre', 'Baron de L 2022', 'Baron de Ladoucette')).toBe(false);
  });
});
