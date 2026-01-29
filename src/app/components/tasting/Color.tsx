'use client';

import type { TastingFormData, Wine } from '@/lib/types';
import { useAtom, useAtomValue } from 'jotai';
import type React from 'react';
import { tastingAtom, wineAtom } from '../../store/tasting';
import styles from './Color.module.css';

export const Color: React.FC = () => {
  const [tasting, setTasting] = useAtom(tastingAtom);
  const wine = useAtomValue<Wine | null>(wineAtom);

  const onChange = (value: string) => {
    setTasting((prev: TastingFormData) => {
      return { ...prev, farge: value };
    });
  };

  if (!wine) {
    return <p>Ingen vin valgt</p>;
  }

  const getCountry = () => {
    if (wine.main_country) {
      return wine.main_country;
    }
    return null;
  };

  const hasGrapes = wine.grapes && wine.grapes.length > 0;
  return (
    <div className={styles.colorContainer}>
      <div className={styles.wineInfoCard}>
        <div className={styles.wineInfoRow}>
          <span className={styles.wineInfoLabel}>Druer:</span>
          {hasGrapes ? (
            <div className={styles.grapeList}>
              {wine.grapes.map((x, index) => (
                <div
                  key={x || `grape-${index}`}
                  className={styles.grapeItem}>
                  • {x}
                </div>
              ))}
            </div>
          ) : (
            <span className={styles.wineInfoValue}>Ikke oppgitt</span>
          )}
        </div>
        <div className={styles.wineInfoRow}>
          <span className={styles.wineInfoLabel}>Land:</span>
          <span className={styles.wineInfoValue}>{getCountry() || 'Ikke oppgitt'}</span>
        </div>
        <div className={styles.wineInfoRow}>
          <span className={styles.wineInfoLabel}>Område:</span>
          <span className={styles.wineInfoValue}>{wine.district || wine.sub_district || 'Ikke oppgitt'}</span>
        </div>
        <div className={styles.wineInfoRow}>
          <span className={styles.wineInfoLabel}>Årgang:</span>
          <span className={styles.wineInfoValue}>{wine.year || 'Ikke oppgitt'}</span>
        </div>
      </div>

      <div className={styles.colorInputField}>
        <label className={styles.colorInputLabel}>Farge</label>
        <input
          type="text"
          className={styles.colorInputBox}
          value={tasting.farge ?? ''}
          onChange={event => onChange(event.target.value)}
          placeholder="Beskriv vinens farge..."
        />
      </div>
    </div>
  );
};
