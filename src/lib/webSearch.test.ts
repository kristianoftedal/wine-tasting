import { describe, expect, it } from 'vitest';
import { extractTastingPassages, htmlToText, isBlockedSource, isTrustedSource, rankSources } from './webSearch';

describe('domain policy', () => {
  it('blocks crowd reviews and marketplaces', () => {
    // These merge vintages and producers under one page; a note distilled from
    // them describes a category rather than the bottle in the glass.
    expect(isBlockedSource('https://www.vivino.com/en/some-barolo/w/123')).toBe(true);
    expect(isBlockedSource('https://www.catawiki.com/l/103549285')).toBe(true);
    expect(isBlockedSource('https://shop.ebay.com/item/1')).toBe(true);
  });

  it('blocks subdomains of a blocked host', () => {
    expect(isBlockedSource('https://api.vivino.com/wines/1')).toBe(true);
  });

  it('treats an unparseable URL as blocked rather than trusted', () => {
    expect(isBlockedSource('not a url')).toBe(true);
  });

  it('allows critics and Nordic monopolies', () => {
    expect(isBlockedSource('https://www.decanter.com/wine-reviews/x')).toBe(false);
    expect(isTrustedSource('https://www.jancisrobinson.com/tastings/13039')).toBe(true);
    expect(isTrustedSource('https://www.systembolaget.se/produkt/1')).toBe(true);
  });

  it('allows wine-searcher, which carries producer notes, without trusting it', () => {
    // Its pages quote the producer's own vintage-specific note, which is
    // first-hand. Ranked behind the critics, but not silenced.
    expect(isBlockedSource('https://www.wine-searcher.com/find/parusso+bussia/2010')).toBe(false);
    expect(isTrustedSource('https://www.wine-searcher.com/find/x')).toBe(false);
  });

  it('does not trust an arbitrary retailer', () => {
    expect(isTrustedSource('https://someshop.example/wine')).toBe(false);
  });
});

describe('rankSources', () => {
  const results = [
    { title: 'Vivino', url: 'https://www.vivino.com/w/1', snippet: '' },
    { title: 'Shop', url: 'https://someshop.example/a', snippet: '' },
    { title: 'Decanter', url: 'https://www.decanter.com/a', snippet: '' },
    { title: 'Decanter again', url: 'https://www.decanter.com/b', snippet: '' }
  ];

  it('drops blocked hosts, dedupes by host and floats trusted sources first', () => {
    const ranked = rankSources(results);
    expect(ranked.map(r => r.url)).toEqual(['https://www.decanter.com/a', 'https://someshop.example/a']);
  });
});

describe('htmlToText', () => {
  it('drops scripts, styles and chrome, and keeps block boundaries', () => {
    const html =
      '<nav>Meny</nav><script>var x=1</script><p>Duft av solb&aelig;r.</p><p>Fyldig smak.</p><footer>Kontakt</footer>';
    const text = htmlToText(html);
    expect(text).not.toMatch(/Meny|var x|Kontakt/);
    expect(text).toMatch(/Fyldig smak\./);
    expect(text.split('\n').length).toBeGreaterThan(1);
  });
});

describe('extractTastingPassages', () => {
  const page = [
    'Gratis frakt på ordre over 1000 kroner, og retur innen 30 dager uten spørsmål.',
    'On the nose it shows black cherry, dried rose and a hint of tar from long ageing.',
    'Vår butikk har vært drevet av samme familie i tre generasjoner siden 1962.',
    'The palate is firm with fine tannins, leather and a long savoury finish.'
  ].join('\n');

  it('keeps sentences about taste and discards shop boilerplate', () => {
    const extracted = extractTastingPassages(page);
    expect(extracted).toMatch(/black cherry/);
    expect(extracted).toMatch(/fine tannins/);
    expect(extracted).not.toMatch(/Gratis frakt/);
    expect(extracted).not.toMatch(/generasjoner/);
  });

  it('respects the character budget', () => {
    expect(extractTastingPassages(page, 90).length).toBeLessThanOrEqual(90);
  });

  it('returns empty for a page with nothing about taste', () => {
    expect(extractTastingPassages('Gratis frakt på ordre over 1000 kroner og rask levering.')).toBe('');
  });
});
