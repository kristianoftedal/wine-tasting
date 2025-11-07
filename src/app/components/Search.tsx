'use client';
import type React from 'react';
import { useState } from 'react';
import keyValues from '../data/wines-key-value.json';
import type { searchModel } from '../models/searchModel';
import styles from './Search.module.css';

export const Search: React.FC = () => {
  const [wines, setWines] = useState<searchModel[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const searchTerm = e.target.value.toLowerCase();
    setSearchValue(e.target.value);

    if (searchTerm.length < 2) {
      setWines([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Simulate async search with slight delay to show loading state
    setTimeout(() => {
      const results = keyValues
        .map(product => {
          const nameLower = product.productShortName.toLowerCase();
          const idMatch = product.productId.includes(searchTerm);
          const nameMatch = nameLower.includes(searchTerm);
          const startsWithMatch = nameLower.split(' ').some(word => word.startsWith(searchTerm));

          // Calculate relevance score
          let score = 0;
          if (idMatch) score += 10;
          if (startsWithMatch) score += 5;
          if (nameMatch) score += 1;

          return { ...product, score };
        })
        .filter(item => item.score && item.score > 0)
        .sort((a, b) => (b.score || 0) - (a.score || 0));

      setWines(results);
      setIsOpen(results.length > 0);
      setIsLoading(false);
    }, 300);
  };

  const handleSelected = (wine: searchModel) => {
    setWines([]);
    setIsOpen(false);
    setSearchValue('');
    setIsLoading(false);
    onWineSelected(wine);
  };

  const handleClear = () => {
    setSearchValue('');
    setWines([]);
    setIsOpen(false);
    setIsLoading(false);
  };

  return (
    <div className={styles.search}>
      <div className={styles.inputWrapper}>
        <svg
          className={styles.icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2">
          <circle
            cx="11"
            cy="11"
            r="8"
          />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Søk etter vin (navn eller ID)..."
          onChange={handleChange}
          value={searchValue}
          className={styles.input}
        />
        {searchValue && (
          <button
            onClick={handleClear}
            aria-label="Clear search"
            className={styles.clear}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2">
              <line
                x1="18"
                y1="6"
                x2="6"
                y2="18"
              />
              <line
                x1="6"
                y1="6"
                x2="18"
                y2="18"
              />
            </svg>
          </button>
        )}
      </div>

      {isLoading && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>Søker...</span>
        </div>
      )}

      {isOpen && wines.length > 0 && !isLoading && (
        <div className={styles.results}>
          {wines.map(wine => (
            <button
              key={wine.productId}
              onClick={() => handleSelected(wine)}
              className={styles.resultItem}>
              <div className={styles.resultName}>{wine.productShortName}</div>
              <div className={styles.resultId}>ID: {wine.productId}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
