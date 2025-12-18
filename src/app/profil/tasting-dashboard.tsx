'use client';

import { findSimilarWines } from '@/actions/wine-similarity';
import ScoreBar from '@/app/components/ScoreBar'; // Declare the ScoreBar variable
import { wineAtom } from '@/app/store/tasting';
import {
  DEFAULT_THRESHOLDS,
  DEFAULT_WEIGHTS,
  type RecommendationThresholds,
  type RecommendationWeights,
  type WineSimilarityScore
} from '@/lib/recommendation-types';
import type { Group, Tasting, User, Wine, WineEvent } from '@/lib/types';
import { decode } from 'he';
import { useAtom } from 'jotai';
import Image from 'next/image';
import Link from 'next/link';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';

interface TastingDashboardProps {
  user: User;
  tastings: Tasting[];
  wines: Wine[];
  groups: Group[];
  events: WineEvent[];
}

type Accolade = {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  earned: boolean;
};

type StylePreference = {
  style: string;
  avgScore: number;
  count: number;
  liked: boolean;
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function TastingDashboard({ user, tastings, wines, groups, events }: TastingDashboardProps) {
  const [allWines] = useAtom(wineAtom);
  const [activeTab, setActiveTab] = useState<'overview' | 'awards' | 'karakter' | 'history'>('overview');
  const [expandedTastingId, setExpandedTastingId] = useState<number | null>(null);
  const [similarWineRecommendations, setSimilarWineRecommendations] = useState<Wine[]>([]);
  const [recommendationScores, setRecommendationScores] = useState<WineSimilarityScore[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [selectedWine, setSelectedWine] = useState<Wine | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [showTuningPanel, setShowTuningPanel] = useState(false);
  const [weights, setWeights] = useState<RecommendationWeights>(DEFAULT_WEIGHTS);
  const [thresholds, setThresholds] = useState<RecommendationThresholds>(DEFAULT_THRESHOLDS);

  const sortedTastings = useMemo(() => {
    return [...tastings].sort((a, b) => {
      const dateA = new Date(a.tasted_at).getTime();
      const dateB = new Date(b.tasted_at).getTime();
      return dateB - dateA; // Newest first
    });
  }, [tastings]);

  const avgScores = useMemo(() => {
    if (sortedTastings.length === 0) return null;

    const totals = {
      overall: 0,
      color: 0,
      smell: 0,
      taste: 0,
      friskhet: 0,
      fylde: 0,
      sodme: 0,
      snaerp: 0,
      karakter: 0
    };

    let count = 0;
    sortedTastings.forEach(t => {
      if (t.overall_score) {
        totals.overall += t.overall_score;
        totals.color += t.color_score || 0;
        totals.smell += t.smell_score || 0;
        totals.taste += t.taste_score || 0;
        totals.friskhet += t.friskhet || 0;
        totals.fylde += t.fylde || 0;
        totals.sodme += t.sodme || 0;
        totals.snaerp += t.snaerp || 0;
        totals.karakter += t.karakter || 0;
        count++;
      }
    });

    if (count === 0) return null;

    return {
      overall: totals.overall / count,
      color: totals.color / count,
      smell: totals.smell / count,
      taste: totals.taste / count,
      friskhet: totals.friskhet / count,
      fylde: totals.fylde / count,
      sodme: totals.sodme / count,
      snaerp: totals.snaerp / count,
      karakter: totals.karakter / count,
      count
    };
  }, [sortedTastings]);

  const accolades = useMemo<Accolade[]>(() => {
    const highSmellCount = sortedTastings.filter(t => (t.smell_score || 0) >= 70).length;
    const highTasteCount = sortedTastings.filter(t => (t.taste_score || 0) >= 70).length;
    const highOverallCount = sortedTastings.filter(t => (t.overall_score || 0) >= 70).length;
    const perfectKarakter = sortedTastings.filter(t => (t.karakter || 0) >= 9).length;
    const totalTastings = sortedTastings.length;

    const getTopWinesByCategory = (scoreKey: keyof Tasting, wineType: string) => {
      return sortedTastings
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

    // Attributes are based on friskhet, fylde, sodme, snaerp scores
    const getTopWinesByAttributes = (wineType: string) => {
      return sortedTastings
        .filter(t => {
          const wine = wines.find(w => w.product_id === t.product_id);
          const categoryName = wine?.main_category;
          const avgAttributeScore = (((t.friskhet || 0) + (t.fylde || 0) + (t.sodme || 0) + (t.snaerp || 0)) / 4) * 10; // Convert to 100 scale
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
  }, [sortedTastings, wines]);

  const stylePreferences = useMemo<StylePreference[]>(() => {
    const styleMap = new Map<string, { total: number; count: number }>();

    const highRatedTastings = sortedTastings.filter(t => (t.karakter || 0) >= 8);

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
  }, [sortedTastings, wines]);

  const loadRecommendations = useCallback(async () => {
    setLoadingRecommendations(true);
    const userId = sortedTastings[0]?.user_id;
    if (userId) {
      const result = await findSimilarWines(userId, 6, weights, thresholds);
      setSimilarWineRecommendations(result.wines);
      setRecommendationScores(result.scores);
    }
    setLoadingRecommendations(false);
  }, [sortedTastings, weights, thresholds]);

  useEffect(() => {
    if (activeTab === 'karakter' && sortedTastings.length > 0) {
      loadRecommendations();
    }
  }, [activeTab, sortedTastings.length]);

  const handleWeightChange = (key: keyof RecommendationWeights, value: number) => {
    setWeights(prev => ({ ...prev, [key]: value }));
  };

  const handleThresholdChange = (key: keyof RecommendationThresholds, value: number) => {
    setThresholds(prev => ({ ...prev, [key]: value }));
  };

  const applySettings = () => {
    loadRecommendations();
  };

  const resetSettings = () => {
    setWeights(DEFAULT_WEIGHTS);
    setThresholds(DEFAULT_THRESHOLDS);
  };

  const recommendations = useMemo(() => {
    if (similarWineRecommendations.length > 0) {
      return similarWineRecommendations;
    }

    if (stylePreferences.length === 0 || !allWines) return [];

    const likedStyles = stylePreferences.filter(s => s.liked).map(s => s.style);
    const tastedCodes = new Set(sortedTastings.map(t => t.product_id));

    const recommended = allWines
      .filter(wine => {
        const wineStyle = wine.main_category;
        return wineStyle && likedStyles.includes(wineStyle) && !tastedCodes.has(wine.product_id);
      })
      .slice(0, 6);

    if (recommended.length < 6) {
      const additional = allWines
        .filter(wine => !tastedCodes.has(wine.product_id) && !recommended.includes(wine))
        .slice(0, 6 - recommended.length);
      recommended.push(...additional);
    }

    return recommended;
  }, [stylePreferences, allWines, sortedTastings, similarWineRecommendations]);

  const earnedCount = accolades.filter(a => a.earned).length;

  const handleWineClick = (wine: Wine) => {
    console.log('[v0] Opening wine modal for:', wine.name);
    setSelectedWine(wine);
    setIsModalOpen(true);
  };

  return (
    <div className={styles.dashboard}>
      <div className={styles.tabNav}>
        <button
          className={`${styles.tab} ${activeTab === 'overview' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('overview')}>
          Oversikt
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'awards' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('awards')}>
          Utmerkelser ({earnedCount}/{accolades.length})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'karakter' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('karakter')}>
          Din smaksprofil
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'history' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('history')}>
          Historikk
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className={styles.overviewGrid}>
          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{sortedTastings.length}</div>
              <div className={styles.statLabel}>Viner smakt</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{avgScores?.overall.toFixed(1) || '-'}</div>
              <div className={styles.statLabel}>Snitt totalscore</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{avgScores?.karakter.toFixed(1) || '-'}</div>
              <div className={styles.statLabel}>Snitt karakter</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{earnedCount}</div>
              <div className={styles.statLabel}>Utmerkelser</div>
            </div>
          </div>

          {avgScores && (
            <div className={styles.scoreBreakdown}>
              <h3 className={styles.sectionTitle}>Dine gjennomsnittlige vurderinger</h3>
              <div className={styles.scoreGrid}>
                <ScoreBar
                  label="Farge"
                  value={avgScores.color}
                  max={100}
                  color="#a78bfa"
                />
                <ScoreBar
                  label="Lukt"
                  value={avgScores.smell}
                  max={100}
                  color="#f472b6"
                />
                <ScoreBar
                  label="Smak"
                  value={avgScores.taste}
                  max={100}
                  color="#c084fc"
                />
                <ScoreBar
                  label="Friskhet"
                  value={avgScores.friskhet}
                  max={10}
                  color="#34d399"
                />
                <ScoreBar
                  label="Fylde"
                  value={avgScores.fylde}
                  max={10}
                  color="#fbbf24"
                />
                <ScoreBar
                  label="Sødme"
                  value={avgScores.sodme}
                  max={10}
                  color="#fb923c"
                />
                <ScoreBar
                  label="Snærp"
                  value={avgScores.snaerp}
                  max={10}
                  color="#f87171"
                />
              </div>
            </div>
          )}

          <div className={styles.quickLinks}>
            <div className={styles.linkCard}>
              <h3 className={styles.linkTitle}>Dine grupper</h3>
              <div className={styles.linkList}>
                {groups.length === 0 ? (
                  <p className={styles.emptyText}>Ingen grupper ennå</p>
                ) : (
                  groups.slice(0, 3).map(group => (
                    <Link
                      key={group.id}
                      href={`/gruppe/${group.id}`}
                      className={styles.linkItem}>
                      {decode(group.name)} {/* Decode HTML entities */}
                    </Link>
                  ))
                )}
              </div>
              <Link
                href="/gruppe/opprett-gruppe"
                className={styles.linkButton}>
                Opprett gruppe
              </Link>
            </div>

            <div className={styles.linkCard}>
              <h3 className={styles.linkTitle}>Kommende arrangement</h3>
              <div className={styles.linkList}>
                {events.length === 0 ? (
                  <p className={styles.emptyText}>Ingen arrangement</p>
                ) : (
                  events.slice(0, 3).map(event => (
                    <div
                      key={event.id}
                      className={styles.eventItemWrapper}>
                      <Link
                        href={`/arrangement/${event.id}`}
                        className={styles.linkItem}>
                        <span className={styles.eventDate}>{formatDate(event.date)}</span>
                        <span>{decode(event.name)}</span>
                      </Link>
                      <Link
                        href={`/gruppe/${event.group_id}/arrangement/${event.id}`}
                        className={styles.editButton}
                        title="Rediger arrangement">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          <path d="m15 5 4 4" />
                        </svg>
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'awards' && (
        <div className={styles.accoladesGrid}>
          {accolades.map(accolade => (
            <div
              key={accolade.id}
              className={`${styles.accoladeCard} ${accolade.earned ? styles.accoladeEarned : styles.accoladeLocked}`}
              style={{ '--accolade-color': accolade.color } as React.CSSProperties}>
              <div className={styles.accoladeIcon}>{accolade.icon}</div>
              <h4 className={styles.accoladeTitle}>{decode(accolade.title)}</h4> {/* Decode HTML entities */}
              <p className={styles.accoladeDesc}>{decode(accolade.description)}</p> {/* Decode HTML entities */}
              {accolade.earned && <div className={styles.accoladeBadge}>Oppnådd!</div>}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'karakter' && (
        <div className={styles.karakterContent}>
          <div className={styles.preferencesCard}>
            <h3 className={styles.sectionTitle}>Dine stilpreferanser</h3>
            <p className={styles.sectionDesc}>Basert på viner du har gitt 8+ i karakter</p>

            {stylePreferences.length === 0 ? (
              <p className={styles.emptyText}>Gi minst én vin 8+ i karakter for å se dine preferanser</p>
            ) : (
              <div className={styles.preferencesList}>
                {stylePreferences.map(pref => (
                  <div
                    key={pref.style}
                    className={styles.preferenceItem}>
                    <div className={styles.preferenceHeader}>
                      <span className={styles.preferenceName}>{decode(pref.style)}</span> {/* Decode HTML entities */}
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

          {/* ... existing recommendations grid ... */}

          {loadingRecommendations ? (
            <div className={styles.loadingRecommendations}>Laster anbefalinger...</div>
          ) : recommendations.length > 0 ? (
            <>
              <div className={styles.recommendationsGrid}>
                {recommendations.map(wine => {
                  const score = recommendationScores.find(s => s.wine.product_id === wine.product_id);
                  return (
                    <div
                      key={wine.product_id}
                      className={styles.recommendationCard}
                      onClick={() => handleWineClick(wine)}>
                      <div className={styles.recommendationImage}>
                        <Image
                          src={`/api/wine-image/${wine.product_id}`}
                          alt={decode(wine.name || '')}
                          width={60}
                          height={120}
                          style={{ objectFit: 'contain' }}
                          onError={e => {
                            e.currentTarget.src = '/elegant-wine-bottle.png';
                          }}
                        />
                      </div>
                      <div className={styles.recommendationInfo}>
                        <span className={styles.recommendationName}>{decode(wine.name || '')}</span>
                        <span className={styles.recommendationMeta}>
                          {wine.year}
                          {wine.main_category && <span className={styles.categoryBadge}>{wine.main_category}</span>}
                        </span>
                        <span className={styles.recommendationPrice}>Kr {wine.price}</span>
                        {score && (
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

              {recommendationScores.length > 0 && showTuningPanel && (
                <div className={styles.scoreBreakdown}>
                  <h5 className={styles.breakdownTitle}>Score-detaljer for anbefalinger</h5>
                  <div className={styles.breakdownGrid}>
                    {recommendationScores.map(score => (
                      <div
                        key={score.wine.product_id}
                        className={styles.breakdownCard}>
                        <span className={styles.breakdownName}>
                          {decode(score.wine.name || '').substring(0, 30)}...
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
            <p className={styles.noRecommendations}>Gi flere viner 8+ i karakter for å få anbefalinger</p>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className={styles.historySection}>{/* History section content goes here */}</div>
      )}
    </div>
  );
}

export default TastingDashboard;
export { TastingDashboard };
