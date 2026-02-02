'use client';

import { findSimilarWinesSQL } from '@/actions/wine-recommendations-sql';
import WineDetailsModal from '@/app/components/WineDetailsModal';
import {
  DEFAULT_THRESHOLDS,
  DEFAULT_WEIGHTS,
  type RecommendationThresholds,
  type RecommendationWeights,
  type WineSimilarityScore
} from '@/lib/recommendation-types';
import type { Tasting, Wine } from '@/lib/types';
import { decode } from 'he';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from '../page.module.css';

interface StylePreference {
  style: string;
  avgScore: number;
  count: number;
  liked: boolean;
}

interface PreferenceTabProps {
  tastings: Tasting[];
  wines: Wine[];
  allWines: Wine[];
}

interface CategoryRecommendations {
  wines: Wine[];
  scores: WineSimilarityScore[];
  loading: boolean;
}

export default function PreferenceTab({ tastings, wines, allWines }: PreferenceTabProps) {
  const [rodvinRecs, setRodvinRecs] = useState<CategoryRecommendations>({ wines: [], scores: [], loading: false });
  const [hvitvinRecs, setHvitvinRecs] = useState<CategoryRecommendations>({ wines: [], scores: [], loading: false });
  const [musserendeRecs, setMusserendeRecs] = useState<CategoryRecommendations>({
    wines: [],
    scores: [],
    loading: false
  });

  const [showTuningPanel, setShowTuningPanel] = useState(false);
  const [weights, setWeights] = useState<RecommendationWeights>(DEFAULT_WEIGHTS);
  const [thresholds, setThresholds] = useState<RecommendationThresholds>(DEFAULT_THRESHOLDS);
  const [selectedWine, setSelectedWine] = useState<Wine | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const stylePreferences = useMemo<StylePreference[]>(() => {
    const styleMap = new Map<string, { total: number; count: number }>();
    const highRatedTastings = tastings.filter(t => (t.karakter || 0) >= 8);

    highRatedTastings.forEach(t => {
      const wine = wines.find(w => w.product_id === t.product_id);
      const styleName = wine?.main_category;
      if (!styleName || styleName === 'Ukjent') {
        return;
      }

      if (!styleMap.has(styleName)) {
        styleMap.set(styleName, { total: 0, count: 0 });
      }

      const current = styleMap.get(styleName)!;
      current.total += t.karakter || 0;
      current.count++;
    });

    return Array.from(styleMap.entries())
      .map(([style, data]) => ({
        style,
        avgScore: data.total / data.count,
        count: data.count,
        liked: data.total / data.count >= 8
      }))
      .sort((a, b) => b.avgScore - a.avgScore);
  }, [tastings, wines]);

  const loadCategoryRecommendations = useCallback(
    async (category: 'Rødvin' | 'Hvitvin' | 'Musserende vin') => {
      const userId = tastings[0]?.user_id;
      if (!userId) return;

      const setter =
        category === 'Rødvin' ? setRodvinRecs : category === 'Hvitvin' ? setHvitvinRecs : setMusserendeRecs;

      setter(prev => ({ ...prev, loading: true }));

      try {
        const result = await findSimilarWinesSQL(userId, 6, weights, thresholds, category);
        setter({ wines: result.wines, scores: result.scores, loading: false });
      } catch (error) {
        console.error(`Error loading ${category} recommendations:`, error);
        setter({ wines: [], scores: [], loading: false });
      }
    },
    [tastings, weights, thresholds]
  );

  useEffect(() => {
    if (tastings.length > 0) {
      // Each call will filter both tastings and wine results by that specific category
      loadCategoryRecommendations('Rødvin');
      loadCategoryRecommendations('Hvitvin');
      loadCategoryRecommendations('Musserende vin');
    }
  }, [tastings.length, loadCategoryRecommendations]);

  const handleWeightChange = (key: keyof RecommendationWeights, value: number) => {
    setWeights(prev => ({ ...prev, [key]: value }));
  };

  const handleThresholdChange = (key: keyof RecommendationThresholds, value: number) => {
    setThresholds(prev => ({ ...prev, [key]: value }));
  };

  const applySettings = () => {
    loadCategoryRecommendations('Rødvin');
    loadCategoryRecommendations('Hvitvin');
    loadCategoryRecommendations('Musserende vin');
  };

  const resetSettings = () => {
    setWeights(DEFAULT_WEIGHTS);
    setThresholds(DEFAULT_THRESHOLDS);
  };

  const handleWineClick = useCallback((wine: Wine) => {
    console.log('[v0] Wine clicked:', wine.name);
    setSelectedWine(wine);
    setIsModalOpen(true);
    console.log('[v0] Modal state updated:', { isModalOpen: true, selectedWine: wine.name });
  }, []);

  const CategorySection = useCallback(
    ({ title, recs, color }: { title: string; recs: CategoryRecommendations; color: string }) => (
      <div className={styles.categorySection}>
        <h4
          className={styles.categoryTitle}
          style={{ borderLeftColor: color }}>
          {title}
        </h4>

        {recs.loading ? (
          <div className={styles.loadingRecommendations}>Laster anbefalinger...</div>
        ) : recs.wines.length > 0 ? (
          <>
            <div className={styles.recommendationsGrid}>
              {recs.wines.map(wine => {
                const score = recs.scores.find(s => s.wine.product_id === wine.product_id);
                return (
                  <div
                    key={wine.product_id}
                    className={styles.recommendationCard}
                    onClick={e => {
                      e.stopPropagation();
                      handleWineClick(wine);
                    }}
                    style={{ cursor: 'pointer' }}>
                    <div className={styles.recommendationImage}>
                      <Image
                        src={`/api/wine-image/${wine.product_id}`}
                        alt={decode(wine.name || '')}
                        width={60}
                        height={120}
                        style={{ objectFit: 'contain' }}
                        onError={e => {
                          const target = e.currentTarget;
                          if (!target.dataset.fallbackAttempted) {
                            target.dataset.fallbackAttempted = 'true';
                            target.src = '/elegant-wine-bottle.png';
                          } else {
                            target.style.display = 'none';
                          }
                        }}
                      />
                    </div>
                    <div className={styles.recommendationInfo}>
                      <h4 className={styles.recommendationName}>{decode(wine.name || '')}</h4>
                      <div className={styles.recommendationMeta}>
                        {wine.year}
                        {wine.main_category && <span className={styles.categoryBadge}>{wine.main_category}</span>}
                      </div>
                      <p className={styles.recommendationPrice}>{wine.price}</p>
                      {score && typeof score.similarityScore === 'number' && !Number.isNaN(score.similarityScore) && (
                        <div className={styles.similarityScore}>
                          <span className={styles.scoreLabel}>Match:</span>
                          <span className={styles.scoreValue}>{score.similarityScore.toFixed(0)}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {recs.scores.length > 0 && showTuningPanel && (
              <div className={styles.scoreBreakdown}>
                <h5 className={styles.breakdownTitle}>Score-detaljer</h5>
                <div className={styles.breakdownGrid}>
                  {recs.scores.map(score => (
                    <div
                      key={score.wine.product_id}
                      className={styles.breakdownCard}>
                      <span
                        className={styles.breakdownName}
                        title={decode(score.wine.name || '')}>
                        {decode(score.wine.name || '')}
                      </span>
                      <div className={styles.breakdownScores}>
                        <span>Fylde: {score.attributeScores.fylde.toFixed(0)}%</span>
                        <span>Friskhet: {score.attributeScores.friskhet.toFixed(0)}%</span>
                        <span>Snærp: {score.attributeScores.snaerp.toFixed(0)}%</span>
                        <span>Sødme: {score.attributeScores.sodme.toFixed(0)}%</span>
                        <span>Lukt: {score.attributeScores.smell.toFixed(0)}%</span>
                        <span>Smak: {score.attributeScores.taste.toFixed(0)}%</span>
                      </div>
                      <span className={styles.breakdownTotal}>Total: {score.similarityScore.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className={styles.noRecommendations}>
            Gi minst én {title.toLowerCase()} karakter 8+ for å få anbefalinger
          </p>
        )}
      </div>
    ),
    [handleWineClick, showTuningPanel]
  );

  return (
    <div className={styles.karakterContent}>
      <div className={styles.preferencesCard}>
        <h3 className={styles.sectionTitle}>Dine stilpreferanser</h3>
        {stylePreferences.length === 0 ? (
          <p className={styles.emptyText}>Gi minst én vin 8+ i karakter for å se dine preferanser</p>
        ) : (
          <div className={styles.preferencesList}>
            {stylePreferences.map(pref => (
              <div
                key={pref.style}
                className={styles.preferenceItem}>
                <div className={styles.preferenceHeader}>
                  <span className={styles.preferenceName}>{decode(pref.style)}</span>
                  <span className={styles.preferenceCount}>({pref.count} viner)</span>
                </div>
                <div className={styles.preferenceBar}>
                  <div
                    className={styles.preferenceProgress}
                    style={{
                      width: `${(pref.avgScore / 10) * 100}%`,
                      backgroundColor: pref.liked ? '#34d399' : '#f87171'
                    }}
                  />
                </div>
                <div className={styles.preferenceScore}>
                  {pref.avgScore.toFixed(1)}/10
                  {pref.liked ? (
                    <span className={styles.likedBadge}>Favoritt</span>
                  ) : (
                    <span className={styles.dislikedBadge}>Ikke din stil</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.recommendationsHeader}>
        <div>
          <h3 className={styles.sectionTitle}>Anbefalte viner for deg</h3>
          <p className={styles.sectionDescription}>
            Basert på likhet med viner du har gitt høy karakter (fylde, friskhet, snærp, sødme, smak og lukt)
          </p>
        </div>
        <button
          className={styles.tuneButton}
          onClick={() => setShowTuningPanel(!showTuningPanel)}
          title="Juster anbefalingsparametere">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2">
            <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
            <circle
              cx="12"
              cy="12"
              r="3"
            />
          </svg>
          Juster
        </button>
      </div>

      {showTuningPanel && (
        <div className={styles.tuningPanel}>
          <h4 className={styles.tuningTitle}>Juster anbefalingsparametere</h4>

          <div className={styles.tuningSection}>
            <h5 className={styles.tuningSectionTitle}>Vekting av egenskaper</h5>
            <p className={styles.tuningDescription}>
              Juster hvor mye hver egenskap skal påvirke anbefalingene. Totalt bør summen være 1.0.
            </p>

            <div className={styles.weightSliders}>
              {Object.entries(weights).map(([key, value]) => (
                <div
                  key={key}
                  className={styles.sliderRow}>
                  <label className={styles.sliderLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}</label>
                  <input
                    type="range"
                    min="0"
                    max="0.5"
                    step="0.05"
                    value={value}
                    onChange={e =>
                      handleWeightChange(key as keyof RecommendationWeights, Number.parseFloat(e.target.value))
                    }
                    className={styles.slider}
                  />
                  <span className={styles.sliderValue}>{(value * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>

            <p className={styles.weightSum}>
              Total vekting: {(Object.values(weights).reduce((a, b) => a + b, 0) * 100).toFixed(0)}%
              {Math.abs(Object.values(weights).reduce((a, b) => a + b, 0) - 1) > 0.01 && (
                <span className={styles.weightWarning}> (bør være 100%)</span>
              )}
            </p>
          </div>

          <div className={styles.tuningSection}>
            <h5 className={styles.tuningSectionTitle}>Terskler</h5>

            <div className={styles.thresholdInputs}>
              <div className={styles.thresholdRow}>
                <label className={styles.thresholdLabel}>Minimum karakter for "likte" viner</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={thresholds.minKarakter}
                  onChange={e => handleThresholdChange('minKarakter', Number.parseInt(e.target.value) || 8)}
                  className={styles.thresholdInput}
                />
              </div>

              <div className={styles.thresholdRow}>
                <label className={styles.thresholdLabel}>Antall kandidater å vurdere</label>
                <input
                  type="number"
                  min="50"
                  max="500"
                  step="50"
                  value={thresholds.candidateLimit}
                  onChange={e => handleThresholdChange('candidateLimit', Number.parseInt(e.target.value) || 100)}
                  className={styles.thresholdInput}
                />
              </div>
            </div>
          </div>

          <div className={styles.tuningActions}>
            <button
              onClick={resetSettings}
              className={styles.resetButton}>
              Nullstill
            </button>
            <button
              onClick={applySettings}
              className={styles.applyButton}>
              Oppdater anbefalinger
            </button>
          </div>
        </div>
      )}

      <CategorySection
        title="Rødvin"
        recs={rodvinRecs}
        color="#dc2626"
      />
      <CategorySection
        title="Hvitvin"
        recs={hvitvinRecs}
        color="#fbbf24"
      />
      <CategorySection
        title="Musserende vin"
        recs={musserendeRecs}
        color="#3b82f6"
      />

      <WineDetailsModal
        wine={selectedWine}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedWine(null);
        }}
      />
    </div>
  );
}
