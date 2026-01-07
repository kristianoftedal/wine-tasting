'use client';

import type { Tasting, Wine } from '@/lib/types';
import { decode } from 'he';
import type React from 'react';
import { useMemo } from 'react';
import styles from '../page.module.css';

type Accolade = {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  earned: boolean;
};

interface AwardsTabProps {
  tastings: Tasting[];
  wines: Wine[];
}

export default function AwardsTab({ tastings, wines }: AwardsTabProps) {
  const accolades = useMemo<Accolade[]>(() => {
    const highSmellCount = tastings.filter(t => (t.smell_score || 0) >= 70).length;
    const highTasteCount = tastings.filter(t => (t.taste_score || 0) >= 70).length;
    const highOverallCount = tastings.filter(t => (t.overall_score || 0) >= 70).length;
    const perfectKarakter = tastings.filter(t => (t.karakter || 0) >= 9).length;
    const totalTastings = tastings.length;

    const getTopWinesByCategory = (scoreKey: keyof Tasting, wineType: string) => {
      return tastings
        .filter(t => {
          const wine = wines.find(w => w.product_id === t.product_id);
          const categoryName = wine?.main_category;
          return categoryName === wineType && ((t[scoreKey] as number) || 0) >= 70;
        })
        .slice(0, 5);
    };

    const redColorCount = getTopWinesByCategory('color_score', 'Rødvin').length;
    const whiteColorCount = getTopWinesByCategory('color_score', 'Hvitvin').length;
    const sparklingColorCount = getTopWinesByCategory('color_score', 'Musserende vin').length;

    const redSmellCount = getTopWinesByCategory('smell_score', 'Rødvin').length;
    const whiteSmellCount = getTopWinesByCategory('smell_score', 'Hvitvin').length;
    const sparklingSmellCount = getTopWinesByCategory('smell_score', 'Musserende vin').length;

    const redTasteCount = getTopWinesByCategory('taste_score', 'Rødvin').length;
    const whiteTasteCount = getTopWinesByCategory('taste_score', 'Hvitvin').length;
    const sparklingTasteCount = getTopWinesByCategory('taste_score', 'Musserende vin').length;

    const getTopWinesByAttributes = (wineType: string) => {
      return tastings
        .filter(t => {
          const wine = wines.find(w => w.product_id === t.product_id);
          const categoryName = wine?.main_category;
          const avgAttributeScore = (((t.friskhet || 0) + (t.fylde || 0) + (t.sodme || 0) + (t.snaerp || 0)) / 4) * 10;
          return categoryName === wineType && avgAttributeScore >= 70;
        })
        .slice(0, 5);
    };

    const redAttributeCount = getTopWinesByAttributes('Rødvin').length;
    const whiteAttributeCount = getTopWinesByAttributes('Hvitvin').length;
    const sparklingAttributeCount = getTopWinesByAttributes('Musserende vin').length;

    return [
      {
        id: 'nose-master',
        title: 'Nesemester',
        description: 'Ga 70+ i lukt til 5 viner',
        icon: '👃',
        color: '#a78bfa',
        earned: highSmellCount >= 5
      },
      {
        id: 'taste-connoisseur',
        title: 'Smakskjenner',
        description: 'Ga 70+ i smak til 5 viner',
        icon: '👅',
        color: '#f472b6',
        earned: highTasteCount >= 5
      },
      {
        id: 'wine-expert',
        title: 'Vinekspert',
        description: 'Vurdert 10 viner totalt',
        icon: '🍷',
        color: '#c084fc',
        earned: totalTastings >= 10
      },
      {
        id: 'quality-hunter',
        title: 'Kvalitetsjeger',
        description: 'Funnet 3 viner med 70+ totalscore',
        icon: '⭐',
        color: '#fbbf24',
        earned: highOverallCount >= 3
      },
      {
        id: 'perfectionist',
        title: 'Perfeksjonist',
        description: 'Ga 9+ i karakter til 3 viner',
        icon: '💎',
        color: '#34d399',
        earned: perfectKarakter >= 3
      },
      {
        id: 'sommelier',
        title: 'Sommelier',
        description: 'Vurdert 25 viner totalt',
        icon: '🏆',
        color: '#f59e0b',
        earned: totalTastings >= 25
      },
      {
        id: 'red-color-expert',
        title: 'Rødvinsfarge-ekspert',
        description: '5 rødviner med 70+ i farge',
        icon: '🔴',
        color: '#dc2626',
        earned: redColorCount >= 5
      },
      {
        id: 'red-smell-expert',
        title: 'Rødvinsduft-ekspert',
        description: '5 rødviner med 70+ i lukt',
        icon: '🍷',
        color: '#dc2626',
        earned: redSmellCount >= 5
      },
      {
        id: 'red-taste-expert',
        title: 'Rødvinssmak-ekspert',
        description: '5 rødviner med 70+ i smak',
        icon: '🍇',
        color: '#dc2626',
        earned: redTasteCount >= 5
      },
      {
        id: 'red-attribute-expert',
        title: 'Rødvinskarakter-ekspert',
        description: '5 rødviner med 70+ i egenskaper',
        icon: '📊',
        color: '#dc2626',
        earned: redAttributeCount >= 5
      },
      {
        id: 'white-color-expert',
        title: 'Hvitvinsfarge-ekspert',
        description: '5 hvitviner med 70+ i farge',
        icon: '⚪',
        color: '#fbbf24',
        earned: whiteColorCount >= 5
      },
      {
        id: 'white-smell-expert',
        title: 'Hvitvinsduft-ekspert',
        description: '5 hvitviner med 70+ i lukt',
        icon: '🥂',
        color: '#fbbf24',
        earned: whiteSmellCount >= 5
      },
      {
        id: 'white-taste-expert',
        title: 'Hvitvinssmak-ekspert',
        description: '5 hvitviner med 70+ i smak',
        icon: '🍋',
        color: '#fbbf24',
        earned: whiteTasteCount >= 5
      },
      {
        id: 'white-attribute-expert',
        title: 'Hvitvinskarakter-ekspert',
        description: '5 hvitviner med 70+ i egenskaper',
        icon: '📊',
        color: '#fbbf24',
        earned: whiteAttributeCount >= 5
      },
      {
        id: 'sparkling-color-expert',
        title: 'Musserende-farge-ekspert',
        description: '5 musserende viner med 70+ i farge',
        icon: '✨',
        color: '#a78bfa',
        earned: sparklingColorCount >= 5
      },
      {
        id: 'sparkling-smell-expert',
        title: 'Musserende-duft-ekspert',
        description: '5 musserende viner med 70+ i lukt',
        icon: '🍾',
        color: '#a78bfa',
        earned: sparklingSmellCount >= 5
      },
      {
        id: 'sparkling-taste-expert',
        title: 'Musserende-smak-ekspert',
        description: '5 musserende viner med 70+ i smak',
        icon: '🥂',
        color: '#a78bfa',
        earned: sparklingTasteCount >= 5
      },
      {
        id: 'sparkling-attribute-expert',
        title: 'Musserende-karakter-ekspert',
        description: '5 musserende viner med 70+ i egenskaper',
        icon: '📊',
        color: '#a78bfa',
        earned: sparklingAttributeCount >= 5
      }
    ];
  }, [tastings, wines]);

  return (
    <div className={styles.accoladesGrid}>
      {accolades.map(accolade => (
        <div
          key={accolade.id}
          className={`${styles.accoladeCard} ${accolade.earned ? styles.accoladeEarned : styles.accoladeLocked}`}
          style={{ '--accolade-color': accolade.color } as React.CSSProperties}>
          <div className={styles.accoladeIcon}>{accolade.icon}</div>
          <h4 className={styles.accoladeTitle}>{decode(accolade.title)}</h4>
          <p className={styles.accoladeDesc}>{decode(accolade.description)}</p>
          {accolade.earned && <div className={styles.accoladeBadge}>Oppnådd!</div>}
        </div>
      ))}
    </div>
  );
}
