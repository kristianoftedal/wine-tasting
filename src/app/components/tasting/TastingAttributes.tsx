'use client';

import { tastingAtom, wineAtom } from '@/app/store/tasting';
import { useAtom, useAtomValue } from 'jotai';
import type React from 'react';
import type { Wine } from '../../models/productModel';
import type { TastingModel } from '../../models/tastingModel';
import styles from './TastingAttributes.module.css';

export const TastingAttributes: React.FC = () => {
  const [tastingState, setTastingState] = useAtom(tastingAtom);
  const wine = useAtomValue<Wine>(wineAtom);

  const handleChange = (key: string, value: number) => {
    setTastingState((prev: TastingModel) => ({ ...prev, [key]: value }));
  };

  let attributes = ['friskhet', 'fylde', 'sødme', 'snærp', 'karakter'];

  if (wine?.mainCategory.code === 'rødvin') {
    attributes = attributes.filter(x => x !== 'sødme');
  }
  if (wine?.mainCategory.code === 'hvitvin') {
    attributes = attributes.filter(x => x !== 'snærp');
  }

  const getTastingAttribute = (attribute: string) => {
    if (attribute === 'friskhet') return tastingState.friskhet;
    if (attribute === 'fylde') return tastingState.fylde;
    if (attribute === 'sødme') return tastingState.sødme;
    if (attribute === 'snærp') return tastingState.snærp;
    if (attribute === 'karakter') return tastingState.karakter;
  };

  const getAttributeLabel = (attr: string) => {
    const labels: Record<string, string> = {
      friskhet: 'Friskhet',
      fylde: 'Fylde',
      sødme: 'Sødme',
      snærp: 'Snærp',
      karakter: 'Karakter'
    };
    return labels[attr] || attr;
  };

  const numbers = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  return (
    <div className={styles.tastingAttributes}>
      {attributes.map(attr => (
        <div
          className={styles.attributeRow}
          key={attr}>
          <div className={styles.attributeHeader}>
            <span className={styles.attributeName}>
              {getAttributeLabel(attr)}: <span className={styles.attributeValue}>{getTastingAttribute(attr)}</span>
            </span>
          </div>
          <div className={styles.attributeButtons}>
            <button
              className={`${styles.attributeButton} ${getTastingAttribute(attr) === 1 ? styles.active : ''}`}
              onClick={() => handleChange(attr, 1)}>
              1
            </button>
            {numbers
              .filter(x => attr !== 'karakter' || (attr === 'karakter' && x < 6))
              .map(x => (
                <button
                  key={x}
                  className={`${styles.attributeButton} ${getTastingAttribute(attr) === x ? styles.active : ''}`}
                  onClick={() => handleChange(attr, x)}>
                  {x}
                </button>
              ))}
            <button
              className={`${styles.attributeButton} ${getTastingAttribute(attr) === (attr === 'karakter' ? 6 : 12) ? styles.active : ''}`}
              onClick={() => handleChange(attr, attr === 'karakter' ? 6 : 12)}>
              {attr === 'karakter' ? 6 : 12}
            </button>
          </div>
          <div className={styles.attributeDivider} />
        </div>
      ))}

      <div className={styles.inputFields}>
        <div className={styles.inputField}>
          <label className={styles.inputLabel}>Alkohol (%)</label>
          <input
            className={styles.inputBox}
            value={tastingState.alkohol ?? ''}
            onChange={event => setTastingState((prev: TastingModel) => ({ ...prev, alkohol: event.target.value }))}
            placeholder="13.5"
          />
        </div>
        <div className={styles.inputField}>
          <label className={styles.inputLabel}>Pris (kr)</label>
          <input
            type="number"
            className={styles.inputBox}
            value={tastingState.pris ?? '0'}
            onChange={event =>
              setTastingState((prev: TastingModel) => ({ ...prev, pris: parseFloat(event.target.value || '0') }))
            }
            placeholder="250"
          />
        </div>
      </div>
    </div>
  );
};
