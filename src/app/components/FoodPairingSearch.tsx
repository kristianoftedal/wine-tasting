'use client';

import { searchFoodPairing, type FoodPairingResult } from '@/actions/food-pairing';
import he from 'he';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useRef, useState, useTransition } from 'react';
import styles from './FoodPairingSearch.module.css';

const EXAMPLES = [
  'Laks', 'Pizza', 'Ribbe', 'Sushi', 'Kylling',
  'Ostebord', 'Taco', 'Biff', 'Hummer', 'Sopp',
];

function formatPrice(price: number | null): string | null {
  if (price == null) return null;
  return `${price.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} kr`;
}

export function FoodPairingSearch() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<FoodPairingResult | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const requestIdRef = useRef(0);

  const runSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResult(null);
      setHasSearched(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      const id = ++requestIdRef.current;
      startTransition(async () => {
        const r = await searchFoodPairing(q);
        // Ignore stale responses
        if (id !== requestIdRef.current) return;
        setResult(r);
        setHasSearched(true);
      });
    }, 500);
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    runSearch(e.target.value);
  };

  const handleExample = (example: string) => {
    setQuery(example);
    runSearch(example);
  };

  const hasResults = result && result.wines.length > 0;

  return (
    <div className={styles.wrapper}>
      <div className={styles.inputWrapper}>
        <svg className={styles.searchIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={handleInput}
          placeholder="Hva skal du spise? (f.eks. laks, pizza, ribbe...)"
          className={styles.input}
        />
        {isPending && (
          <div className={styles.spinner}>
            <svg className={styles.spinnerIcon} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
            </svg>
          </div>
        )}
      </div>

      <div className={styles.examples}>
        {EXAMPLES.map(ex => (
          <button key={ex} className={`${styles.chip} ${query === ex ? styles.chipActive : ''}`} onClick={() => handleExample(ex)} type="button">
            {ex}
          </button>
        ))}
      </div>

      {hasSearched && !isPending && result && (
        <>
          {result.recommendation && (
            <div className={styles.recommendation}>
              <div className={styles.recommendationIcon}>🍷</div>
              <div>
                <p className={styles.recommendationText}>{result.recommendation}</p>
                {(result.categories.length > 0 || result.grapes.length > 0 || result.regions.length > 0) && (
                  <div className={styles.criteriaTags}>
                    {result.categories.map(c => (
                      <span key={`cat-${c}`} className={styles.categoryChip}>{c}</span>
                    ))}
                    {result.grapes.map(g => (
                      <span key={`grape-${g}`} className={styles.grapeChip}>{g}</span>
                    ))}
                    {result.regions.map(r => (
                      <span key={`region-${r}`} className={styles.regionChip}>{r}</span>
                    ))}
                    {/* Occasion and course the query was understood as. Shown
                        because these drive which articles get cited, and a
                        seasonal query like "julemat" resolves to nothing else. */}
                    {result.themeTerms.map(t => (
                      <span key={`theme-${t}`} className={styles.occasionChip}>{t}</span>
                    ))}
                    {result.courseTerms.map(c => (
                      <span key={`course-${c}`} className={styles.courseChip}>{c}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {hasResults ? (
            <div className={styles.wineGrid}>
              {result.wines.map(wine => (
                <Link key={wine.id} href={`/smaking/${wine.id}`} className={styles.wineCard}>
                  <div className={styles.wineImageWrap}>
                    <Image
                      src={`/api/wine-image/${wine.product_id}`}
                      alt=""
                      width={48}
                      height={72}
                      className={styles.wineImage}
                    />
                  </div>
                  <div className={styles.wineInfo}>
                    <h3 className={styles.wineName}>{he.decode(wine.name)}</h3>
                    <div className={styles.wineMeta}>
                      {wine.year && <span>{wine.year}</span>}
                      {wine.main_country && <span>{wine.main_country}</span>}
                      {wine.district && <span>{wine.district}</span>}
                    </div>
                    <div className={styles.wineFooter}>
                      {wine.main_category && (
                        <span className={styles.wineCategory}>{wine.main_category}</span>
                      )}
                      {formatPrice(wine.price) && (
                        <span className={styles.winePrice}>{formatPrice(wine.price)}</span>
                      )}
                    </div>
                    {(wine.matchedFood || wine.matchedGrape) && (
                      <div className={styles.matchReason}>
                        {wine.matchedFood && <span className={styles.matchPill}>Passer til {wine.matchedFood}</span>}
                        {wine.matchedGrape && <span className={styles.matchPill}>{wine.matchedGrape}</span>}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>Fant ingen viner som matcher «{query}» i databasen.</p>
          )}

          {result.articles.length > 0 && (
            <details className={styles.sources}>
              <summary className={styles.sourcesSummary}>
                Basert på {result.articles.length} {result.articles.length === 1 ? 'artikkel' : 'artikler'} fra Vinmonopolet
              </summary>
              <div className={styles.sourceList}>
                {result.articles.map(a => (
                  <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className={styles.sourceCard}>
                    <span className={styles.sourceTitle}>{a.title}</span>
                    {a.summary && <span className={styles.sourceSummary}>{a.summary}</span>}
                    {a.matchedTags.length > 0 && (
                      <span className={styles.sourceReason}>
                        {a.matchedTags.map(t => (
                          <span key={t} className={styles.sourceTag}>{t}</span>
                        ))}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
