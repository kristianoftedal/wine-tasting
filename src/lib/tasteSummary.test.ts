import { describe, expect, it } from 'vitest';
import { buildTasteSummaries, grapeName, parsePrice } from './tasteSummary';
import type { Tasting, Wine } from './types';

const wine = (over: Partial<Wine> & { id: string }): Wine =>
  ({
    product_id: over.id,
    name: 'Vin',
    color: null,
    smell: null,
    taste: null,
    year: '2020',
    price: null,
    volume: '75 cl',
    district: null,
    main_category: 'Rødvin',
    main_country: null,
    main_producer: null,
    sub_district: null,
    whole_saler: null,
    fylde: null,
    friskhet: null,
    garvestoff: null,
    sodme: null,
    alcohol: '13 prosent',
    grapes: [],
    sugar: 'Under 3 gram per liter',
    acidity: '5 gram per liter',
    is_good_for: [],
    ...over
  }) as Wine;

const tasting = (wineId: string, karakter: number | null): Tasting =>
  ({ id: `t-${wineId}`, user_id: 'u', wine_id: wineId, karakter }) as unknown as Tasting;

describe('grapeName', () => {
  it('strips both percent spellings', () => {
    expect(grapeName('Nebbiolo 95%')).toBe('Nebbiolo');
    expect(grapeName('Sauvignon Blanc 35 prosent')).toBe('Sauvignon Blanc');
    expect(grapeName('Merlot')).toBe('Merlot');
  });
});

describe('parsePrice', () => {
  it('reads Vinmonopolet display prices', () => {
    expect(parsePrice(wine({ id: 'a', price: 'Kr 5 950,00' }))).toBe(5950);
    expect(parsePrice(wine({ id: 'b', price: 'Kr 199,80' }))).toBeCloseTo(199.8);
    expect(parsePrice(wine({ id: 'c', price: null }))).toBeNull();
  });

  it('prefers the numeric column when present', () => {
    expect(parsePrice({ ...wine({ id: 'd', price: 'Kr 1,00' }), price_nok: 234.4 } as Wine)).toBe(234.4);
  });
});

describe('buildTasteSummaries', () => {
  const wines = [
    wine({ id: 'w1', fylde: 9, friskhet: 7, garvestoff: 8, main_country: 'Frankrike', district: 'Bordeaux', grapes: ['Merlot 60%'], price: 'Kr 300,00', smell: 'Duft av kirsebær og vanilje.' }),
    wine({ id: 'w2', fylde: 9, friskhet: 7, garvestoff: 8, main_country: 'Frankrike', district: 'Bordeaux', grapes: ['Merlot 55%'], price: 'Kr 400,00', smell: 'Preg av kirsebær og tobakk.' }),
    wine({ id: 'w3', fylde: 3, friskhet: 7, garvestoff: 2, main_country: 'Italia', grapes: ['Nebbiolo 100%'], price: 'Kr 150,00' }),
    wine({ id: 'w4', fylde: 3, friskhet: 7, garvestoff: 2, main_country: 'Italia', grapes: ['Nebbiolo 100%'], price: 'Kr 160,00' }),
    wine({ id: 'w5', main_category: 'Hvitvin', fylde: 5, friskhet: 10, sodme: 1, price: 'Kr 250,00' })
  ];

  const tastings = [
    tasting('w1', 9),
    tasting('w2', 9),
    tasting('w3', 4),
    tasting('w4', 5),
    tasting('w5', 8),
    tasting('missing', 10),
    tasting('w1', null)
  ];

  const summaries = buildTasteSummaries(tastings, wines);

  it('groups by wine type, most-tasted first', () => {
    expect(summaries.map(s => s.category)).toEqual(['Rødvin', 'Hvitvin']);
  });

  it('ignores tastings without a karakter or a matching wine', () => {
    expect(summaries[0].ratedCount).toBe(4);
  });

  it('summarises the high scorers, not everything tasted', () => {
    const red = summaries[0];
    expect(red.favouriteCount).toBe(2);
    expect(red.avgKarakter).toBe(9);
    expect(red.traits).toContain('Svært fyldig');
    expect(red.traits).toContain('Tydelige tanniner');
    expect(red.text).toContain('Frankrike');
    expect(red.text).toContain('Merlot');
    expect(red.aromas).toContain('kirsebær');
  });

  it('contrasts favourites against the low scorers', () => {
    expect(summaries[0].text).toContain('fyldigere');
  });

  it('falls back to the best-rated wines when nothing clears the bar', () => {
    const only = buildTasteSummaries([tasting('w3', 6), tasting('w4', 5)], wines);
    expect(only[0].favouriteCount).toBe(2);
    expect(only[0].text).toContain('Ingen rødviner har fått 8');
  });

  it('writes singular prose for a single wine', () => {
    const one = buildTasteSummaries([tasting('w5', 8)], wines);
    expect(one[0].text).toContain('Du har vurdert én hvitvin');
    expect(one[0].text).toContain('sylskarp i syren');
    expect(one[0].text).toContain('Vurder noen flere');
  });

  it('returns nothing when there is nothing rated', () => {
    expect(buildTasteSummaries([], wines)).toEqual([]);
  });
});
