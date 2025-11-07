'use client';

import { Accordion } from '@/app/components/tasting/FlavorAccordion';
import { SelectedFlavors } from '@/app/components/tasting/SelectedFlavours';
import redWineFlavorsData from '@/app/data/red-flavor.json';
import whiteWineFlavorsData from '@/app/data/white-flavor.json';
import type { Category, Flavor, Subcategory } from '@/app/models/flavorModel';
import { useAtom } from 'jotai';
import type React from 'react';
import type { WineType } from '../../models/productModel';
import type { TastingModel } from '../../models/tastingModel';
import { tastingAtom } from '../../store/tasting';
import styles from './FlavorSelection.module.css';

interface Props {
  type?: 'lukt' | 'smak';
  vintype: WineType;
}

export const FlavorSelection: React.FC<Props> = ({ type = 'lukt', vintype }) => {
  const [tastingState, setTastingState] = useAtom(tastingAtom);
  const [tasting, setTasting] = useAtom(tastingAtom);

  let flavorData = redWineFlavorsData;

  if (vintype === 'rødvin') {
    flavorData = redWineFlavorsData;
  } else if (vintype === 'hvitvin' || vintype === 'musserende_vin') {
    flavorData = whiteWineFlavorsData;
  }

  const handleFlavorClick = (category: Category, subcategory: Subcategory, flavor: Flavor) => {
    setTastingState((prev: TastingModel) => {
      const key = type === 'lukt' ? 'selectedFlavorsLukt' : 'selectedFlavorsSmak';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = prev[key] as any[];
      const updatedFlavors = existing.some(x => x.flavor.name === flavor.name)
        ? existing.filter(x => x.flavor.name !== flavor.name)
        : [...existing, { category, subcategory, flavor }];

      return { ...prev, [key]: updatedFlavors };
    });
  };

  const onChangeIntensity = (value: 'lav' | 'middels' | 'høy') => {
    setTasting((prev: TastingModel) => {
      if (type === 'lukt') return { ...prev, luktIntensitet: value };
      return { ...prev, smaksIntensitet: value };
    });
  };

  const currentIntensity = type === 'lukt' ? tasting.luktIntensitet : tasting.smaksIntensitet;
  const selectedFlavors =
    tastingState[type === 'lukt' ? 'selectedFlavorsLukt' : 'selectedFlavorsSmak']?.map(x => x.flavor) || [];

  return (
    <div className={styles.flavorSelection}>
      <div className={styles.intensitySection}>
        <div className={styles.intensityLabel}>Intensitet</div>
        <div className={styles.intensityButtons}>
          <button
            className={`${styles.intensityButton} ${currentIntensity === 'lav' ? styles.active : ''}`}
            onClick={() => onChangeIntensity('lav')}>
            Lav
          </button>
          <button
            className={`${styles.intensityButton} ${currentIntensity === 'middels' ? styles.active : ''}`}
            onClick={() => onChangeIntensity('middels')}>
            Middels
          </button>
          <button
            className={`${styles.intensityButton} ${currentIntensity === 'høy' ? styles.active : ''}`}
            onClick={() => onChangeIntensity('høy')}>
            Høy
          </button>
        </div>
      </div>
      <div
        className={styles.commentField}
        style={{ marginBottom: '1rem' }}>
        <textarea
          className={styles.commentTextarea}
          value={tastingState[type]}
          onChange={event => setTastingState((prev: TastingModel) => ({ ...prev, [type]: event.target.value }))}
          placeholder="Legg til dine egne notater her..."
        />
      </div>

      <SelectedFlavors
        selectedFlavors={tastingState[type === 'lukt' ? 'selectedFlavorsLukt' : 'selectedFlavorsSmak']}
        onFlavorClick={handleFlavorClick}
      />

      <h5>Forslag:</h5>
      {flavorData.map(categoryItem => (
        <Accordion
          key={categoryItem.name}
          category={categoryItem}
          subcategories={categoryItem.subcategories}
          onFlavorClick={handleFlavorClick}
          selectedFlavors={selectedFlavors}
        />
      ))}
    </div>
  );
};
