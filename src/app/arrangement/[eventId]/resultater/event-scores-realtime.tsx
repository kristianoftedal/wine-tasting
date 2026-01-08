'use client';

import { createClient } from '@/lib/supabase/client';
import he from 'he';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import styles from './page.module.css';

type TastingScore = {
  id: string;
  product_id: string;
  user_id: string;
  overall_score: number | null;
  color_score: number | null;
  smell_score: number | null;
  taste_score: number | null;
  friskhet_score: number | null;
  fylde_score: number | null;
  sodme_score: number | null;
  snaerp_score: number | null;
  karakter: number | null;
  farge: string | null;
  lukt: string | null;
  smak: string | null;
  friskhet: number | null;
  fylde: number | null;
  sodme: number | null;
  snaerp: number | null;
};

type WineInfo = {
  product_id: string;
  name: string;
  year: string | null;
  color: string | null;
  smell: string | null;
  taste: string | null;
  fylde: number | null;
  friskhet: number | null;
  garvestoff: number | null;
  sodme: number | null;
  content: {
    characteristics?: Array<{
      name: string;
      value: string;
      readableValue: string;
    }>;
  } | null;
  main_category?: string;
};

type Props = {
  eventId: string;
  wines: WineInfo[];
  initialTastings: TastingScore[];
  initialProfileMap: Record<string, string>;
};

export function EventScoresRealtime({ eventId, wines, initialTastings, initialProfileMap }: Props) {
  const [tastings, setTastings] = useState<TastingScore[]>(initialTastings);
  const [profileMap, setProfileMap] = useState<Record<string, string>>(initialProfileMap);
  const [expandedWine, setExpandedWine] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Record<string, string>>({});
  const [expandedParticipant, setExpandedParticipant] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel(`event-tastings-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tastings',
          filter: `event_id=eq.${eventId}`
        },
        async payload => {
          if (payload.eventType === 'INSERT') {
            const newTasting = payload.new as TastingScore;
            setTastings(prev => [...prev, newTasting]);

            if (!profileMap[newTasting.user_id]) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('id, name')
                .eq('id', newTasting.user_id)
                .single();
              if (profile) {
                setProfileMap(prev => ({ ...prev, [profile.id]: profile.name }));
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedTasting = payload.new as TastingScore;
            setTastings(prev => prev.map(t => (t.id === updatedTasting.id ? updatedTasting : t)));
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setTastings(prev => prev.filter(t => t.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, supabase, profileMap]);

  const wineScores = wines.map(wine => {
    const wineTastings = tastings.filter(t => t.product_id === wine.product_id);
    const count = wineTastings.length;

    if (count === 0) {
      return {
        ...wine,
        avgOverall: null,
        avgKarakter: null,
        avgColor: null,
        avgSmell: null,
        avgTaste: null,
        avgFriskhet: null,
        avgFylde: null,
        avgSodme: null,
        avgSnaerp: null,
        count: 0,
        tastings: [] as Array<TastingScore & { userName: string }>
      };
    }

    const sum = (key: keyof TastingScore) => wineTastings.reduce((acc, t) => acc + (Number(t[key]) || 0), 0);

    return {
      ...wine,
      avgOverall: sum('overall_score') / count,
      avgKarakter: sum('karakter') / count,
      avgColor: sum('color_score') / count,
      avgSmell: sum('smell_score') / count,
      avgTaste: sum('taste_score') / count,
      avgFriskhet: sum('friskhet_score') / count,
      avgFylde: sum('fylde_score') / count,
      avgSodme: sum('sodme_score') / count,
      avgSnaerp: sum('snaerp_score') / count,
      count,
      tastings: wineTastings.map(t => ({
        ...t,
        userName: profileMap[t.user_id] || 'Ukjent'
      }))
    };
  });

  const sortedWineScores = [...wineScores].sort((a, b) => {
    if (a.avgOverall === null) return 1;
    if (b.avgOverall === null) return -1;
    return b.avgOverall - a.avgOverall;
  });

  const toggleWine = (productId: string) => {
    setExpandedWine(expandedWine === productId ? null : productId);
    if (!activeTab[productId]) {
      setActiveTab(prev => ({ ...prev, [productId]: 'overall' }));
    }
  };

  const toggleParticipant = (tastingId: string) => {
    setExpandedParticipant(expandedParticipant === tastingId ? null : tastingId);
  };

  const getActiveTab = (productId: string) => activeTab[productId] || 'overall';

  const getCharacteristic = (content: WineInfo['content'], key: string): string | null => {
    if (!content?.characteristics || !Array.isArray(content.characteristics)) return null;
    const char = content.characteristics.find(c => c.name.toLowerCase() === key.toLowerCase());
    return char?.readableValue || char?.value || null;
  };

  return (
    <div className={styles.scoresContainer}>
      {sortedWineScores.map((wine, index) => (
        <div
          key={wine.product_id}
          className={`${styles.wineAccordion} ${expandedWine === wine.product_id ? styles.wineAccordionExpanded : ''}`}>
          {/* Wine Accordion Header */}
          <button
            className={styles.wineAccordionTrigger}
            onClick={() => toggleWine(wine.product_id)}
            aria-expanded={expandedWine === wine.product_id}>
            <div className={styles.wineAccordionHeader}>
              <div className={styles.wineImageWrapper}>
                {wine.avgOverall !== null && (
                  <div className={styles.wineRank}>
                    <span className={styles.rankNumber}>{index + 1}</span>
                  </div>
                )}
                <Image
                  src={`/api/wine-image/${wine.product_id}?size=300x300`}
                  alt={he.decode(wine.name)}
                  width={100}
                  height={140}
                  className={styles.wineImage}
                  unoptimized
                />
              </div>
              <div className={styles.wineHeaderInfo}>
                <h3 className={styles.wineScoreName}>{he.decode(wine.name)}</h3>
                {wine.year && <span className={styles.wineYear}>{wine.year}</span>}
                {wine.count > 0 ? (
                  <div className={styles.quickScores}>
                    <div className={styles.quickScore}>
                      <strong>{wine.avgOverall?.toFixed(1)}</strong>
                      <span className={styles.quickScoreLabel}>Totalpoeng</span>
                    </div>
                    <div className={styles.quickScore}>
                      <strong>{wine.avgKarakter?.toFixed(1)}</strong>
                      <span className={styles.quickScoreLabel}>Karakter</span>
                    </div>
                    <span className={styles.quickScoreCount}>
                      {wine.count} {wine.count === 1 ? 'vurdering' : 'vurderinger'}
                    </span>
                  </div>
                ) : (
                  <p className={styles.noTastings}>Ingen vurderinger ennå</p>
                )}
                <div className={styles.accordionChevron}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className={expandedWine === wine.product_id ? styles.chevronRotated : ''}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
              </div>
            </div>
          </button>

          {/* Wine Accordion Content */}
          {expandedWine === wine.product_id && wine.count > 0 && (
            <div className={styles.wineAccordionContent}>
              {/* Wine Properties Section */}
              <div className={styles.winePropertiesSection}>
                <h4 className={styles.winePropertiesTitle}>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2">
                    <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
                  </svg>
                  Vinens egenskaper (fra Vinmonopolet)
                </h4>
                <div className={styles.winePropertiesGrid}>
                  {wine.color && (
                    <div className={styles.winePropertyItem}>
                      <span className={styles.winePropertyLabel}>Farge</span>
                      <span className={styles.winePropertyValue}>{wine.color}</span>
                    </div>
                  )}
                  {wine.smell && (
                    <div className={styles.winePropertyItem}>
                      <span className={styles.winePropertyLabel}>Lukt</span>
                      <span className={styles.winePropertyValue}>{wine.smell}</span>
                    </div>
                  )}
                  {wine.taste && (
                    <div className={styles.winePropertyItem}>
                      <span className={styles.winePropertyLabel}>Smak</span>
                      <span className={styles.winePropertyValue}>{wine.taste}</span>
                    </div>
                  )}
                  {!wine.main_category?.toLowerCase().includes('rød') && wine.sodme !== null && (
                    <div className={styles.winePropertyItem}>
                      <span className={styles.winePropertyLabel}>Sødme</span>
                      <span className={styles.winePropertyValue}>{wine.sodme}</span>
                    </div>
                  )}
                  {wine.main_category?.toLowerCase().includes('rød') && wine.garvestoff !== null && (
                    <div className={styles.winePropertyItem}>
                      <span className={styles.winePropertyLabel}>Garvestoffer</span>
                      <span className={styles.winePropertyValue}>{wine.garvestoff}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Styled Tabs */}
              <div className={styles.tabsContainer}>
                <div className={styles.tabsList}>
                  {[
                    { id: 'overall', label: 'Overall' },
                    { id: 'farge', label: 'Farge' },
                    { id: 'lukt', label: 'Lukt' },
                    { id: 'smak', label: 'Smak' },
                    { id: 'attributter', label: 'Attributter' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      className={`${styles.tabButton} ${
                        getActiveTab(wine.product_id) === tab.id ? styles.tabButtonActive : ''
                      }`}
                      onClick={() => setActiveTab(prev => ({ ...prev, [wine.product_id]: tab.id }))}>
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div className={styles.tabContent}>
                {getActiveTab(wine.product_id) === 'overall' && (
                  <ParticipantAccordionList
                    tastings={wine.tastings}
                    scoreKey="overall_score"
                    expandedParticipant={expandedParticipant}
                    toggleParticipant={toggleParticipant}
                    showField="overall"
                    maxScore={100}
                  />
                )}

                {getActiveTab(wine.product_id) === 'farge' && (
                  <ParticipantAccordionList
                    tastings={wine.tastings}
                    scoreKey="color_score"
                    expandedParticipant={expandedParticipant}
                    toggleParticipant={toggleParticipant}
                    showField="farge"
                    maxScore={100}
                  />
                )}

                {getActiveTab(wine.product_id) === 'lukt' && (
                  <ParticipantAccordionList
                    tastings={wine.tastings}
                    scoreKey="smell_score"
                    expandedParticipant={expandedParticipant}
                    toggleParticipant={toggleParticipant}
                    showField="lukt"
                    maxScore={100}
                  />
                )}

                {getActiveTab(wine.product_id) === 'smak' && (
                  <ParticipantAccordionList
                    tastings={wine.tastings}
                    scoreKey="taste_score"
                    expandedParticipant={expandedParticipant}
                    toggleParticipant={toggleParticipant}
                    showField="smak"
                    maxScore={100}
                  />
                )}

                {getActiveTab(wine.product_id) === 'attributter' && (
                  <ParticipantAccordionList
                    tastings={wine.tastings}
                    scoreKey="overall_score"
                    expandedParticipant={expandedParticipant}
                    toggleParticipant={toggleParticipant}
                    showField="attributes"
                    maxScore={100}
                  />
                )}
              </div>
            </div>
          )}

          {expandedWine === wine.product_id && wine.count === 0 && (
            <div className={styles.wineAccordionContent}>
              <p className={styles.noTastingsExpanded}>Ingen har smakt denne vinen ennå.</p>
            </div>
          )}
        </div>
      ))}

      {wines.length === 0 && (
        <div className={styles.emptyState}>
          <p>Ingen viner er lagt til i dette arrangementet ennå.</p>
        </div>
      )}
    </div>
  );
}

function ParticipantAccordionList({
  tastings,
  scoreKey,
  expandedParticipant,
  toggleParticipant,
  showField,
  maxScore
}: {
  tastings: Array<TastingScore & { userName: string }>;
  scoreKey: keyof TastingScore;
  expandedParticipant: string | null;
  toggleParticipant: (id: string) => void;
  showField: string;
  maxScore: number;
}) {
  // Sort by score (highest first)
  const sortedTastings = [...tastings].sort((a, b) => {
    const aScore = Number(a[scoreKey]) || 0;
    const bScore = Number(b[scoreKey]) || 0;
    return bScore - aScore;
  });

  return (
    <div className={styles.participantsList}>
      <h5 className={styles.participantsTitle}>Deltakere (sortert etter høyest poeng)</h5>
      <div className={styles.participantsAccordion}>
        {sortedTastings.map((tasting, index) => {
          const score = Number(tasting[scoreKey]) || 0;
          const percentage = (score / maxScore) * 100;

          return (
            <div
              key={tasting.id}
              className={`${styles.participantAccordionItem} ${
                expandedParticipant === tasting.id ? styles.participantAccordionItemExpanded : ''
              }`}>
              <button
                className={styles.participantAccordionTrigger}
                onClick={() => toggleParticipant(tasting.id)}
                aria-expanded={expandedParticipant === tasting.id}>
                <div className={styles.participantRank}>#{index + 1}</div>
                <div className={styles.participantInfo}>
                  <span className={styles.participantName}>{tasting.userName}</span>
                  <div className={styles.participantScoreBar}>
                    <div
                      className={styles.participantScoreBarFill}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
                <span className={styles.participantScore}>
                  {score.toFixed(1)}/{maxScore}
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`${styles.participantChevron} ${
                    expandedParticipant === tasting.id ? styles.chevronRotated : ''
                  }`}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {expandedParticipant === tasting.id && (
                <div className={styles.participantAccordionContent}>
                  {showField === 'overall' && (
                    <div className={styles.tastingNoteGrid}>
                      <div className={styles.tastingNoteField}>
                        <span className={styles.tastingNoteLabel}>Karakter:</span>
                        <span className={styles.tastingNoteValue}>{tasting.karakter || '-'}/10</span>
                      </div>
                      <div className={styles.tastingNoteField}>
                        <span className={styles.tastingNoteLabel}>Totalpoeng:</span>
                        <span className={styles.tastingNoteValue}>{tasting.overall_score?.toFixed(1) || '-'}/100</span>
                      </div>
                      <div className={styles.tastingNoteField}>
                        <span className={styles.tastingNoteLabel}>Farge:</span>
                        <span className={styles.tastingNoteValue}>{tasting.color_score?.toFixed(1) || '-'}/100</span>
                      </div>
                      <div className={styles.tastingNoteField}>
                        <span className={styles.tastingNoteLabel}>Lukt:</span>
                        <span className={styles.tastingNoteValue}>{tasting.smell_score?.toFixed(1) || '-'}/100</span>
                      </div>
                      <div className={styles.tastingNoteField}>
                        <span className={styles.tastingNoteLabel}>Smak:</span>
                        <span className={styles.tastingNoteValue}>{tasting.taste_score?.toFixed(1) || '-'}/100</span>
                      </div>
                    </div>
                  )}
                  {showField === 'farge' && (
                    <div className={styles.tastingNoteField}>
                      <span className={styles.tastingNoteLabel}>Farge beskrivelse:</span>
                      <span className={styles.tastingNoteValue}>{tasting.farge || 'Ingen beskrivelse'}</span>
                    </div>
                  )}
                  {showField === 'lukt' && (
                    <div className={styles.tastingNoteField}>
                      <span className={styles.tastingNoteLabel}>Lukt beskrivelse:</span>
                      <span className={styles.tastingNoteValue}>{tasting.lukt || 'Ingen beskrivelse'}</span>
                    </div>
                  )}
                  {showField === 'smak' && (
                    <div className={styles.tastingNoteField}>
                      <span className={styles.tastingNoteLabel}>Smak beskrivelse:</span>
                      <span className={styles.tastingNoteValue}>{tasting.smak || 'Ingen beskrivelse'}</span>
                    </div>
                  )}
                  {showField === 'attributes' && (
                    <div className={styles.tastingNoteGrid}>
                      <div className={styles.tastingNoteField}>
                        <span className={styles.tastingNoteLabel}>Friskhet:</span>
                        <span className={styles.tastingNoteValue}>
                          {tasting.friskhet || '-'}/12 → {tasting.friskhet_score?.toFixed(0) || '-'}/100
                        </span>
                      </div>
                      <div className={styles.tastingNoteField}>
                        <span className={styles.tastingNoteLabel}>Fylde:</span>
                        <span className={styles.tastingNoteValue}>
                          {tasting.fylde || '-'}/12 → {tasting.fylde_score?.toFixed(0) || '-'}/100
                        </span>
                      </div>
                      {!tasting.wine.main_category?.toLowerCase().includes('rød') && (
                        <div className={styles.tastingNoteField}>
                          <span className={styles.tastingNoteLabel}>Sødme:</span>
                          <span className={styles.tastingNoteValue}>
                            {tasting.sodme || '-'}/12 → {tasting.sodme_score?.toFixed(0) || '-'}/100
                          </span>
                        </div>
                      )}
                      {tasting.wine.main_category?.toLowerCase().includes('rød') && (
                        <div className={styles.tastingNoteField}>
                          <span className={styles.tastingNoteLabel}>Snærp:</span>
                          <span className={styles.tastingNoteValue}>
                            {tasting.snaerp || '-'}/12 → {tasting.snaerp_score?.toFixed(0) || '-'}/100
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
