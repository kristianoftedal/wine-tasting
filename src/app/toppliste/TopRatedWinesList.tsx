'use client';

import WineDetailsModal from '@/app/components/WineDetailsModal';
import type { Wine } from '@/lib/types';
import he from 'he';
import Image from 'next/image';
import { useState } from 'react';
import styles from './page.module.css';

interface TopRatedWine {
  wine: Wine;
  average_karakter: number;
  tasting_count: number;
}

interface TopRatedWinesListProps {
  topRatedWines: TopRatedWine[];
}

export default function TopRatedWinesList({ topRatedWines }: TopRatedWinesListProps) {
  const [selectedWine, setSelectedWine] = useState<Wine | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleWineClick = (wine: Wine) => {
    setSelectedWine(wine);
    setIsModalOpen(true);
  };

  return (
    <>
      <div className={styles.list}>
        {topRatedWines.map((item, index) => (
          <div
            key={`${item.wine.product_id}-${item.wine.year || 'no-year'}-${index}`}
            className={styles.wineCard}
            onClick={() => handleWineClick(item.wine)}
            style={{ cursor: 'pointer' }}>
            <div className={styles.rank}>#{index + 1}</div>

            <div className={styles.wineImage}>
              <Image
                src={`/api/wine-image/${item.wine.product_id}`}
                alt={he.decode(item.wine.name)}
                width={80}
                height={120}
                className={styles.image}
              />
            </div>

            <div className={styles.wineDetails}>
              <h2 className={styles.wineName}>{he.decode(item.wine.name)}</h2>
              <p className={styles.wineInfo}>
                {item.wine.main_country} • {item.wine.main_category}
              </p>
              {item.wine.volume && <p className={styles.wineVolume}>{item.wine.volume} cl</p>}
            </div>

            <div className={styles.wineScore}>
              <div className={styles.scoreValue}>{item.average_karakter.toFixed(1)}</div>
              <div className={styles.scoreSuffix}>/10</div>
              <div className={styles.tastingCount}>
                {item.tasting_count} {item.tasting_count === 1 ? 'vurdering' : 'vurderinger'}
              </div>
            </div>
          </div>
        ))}
      </div>

      <WineDetailsModal
        wine={selectedWine}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedWine(null);
        }}
      />
    </>
  );
}
