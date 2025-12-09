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
  score_overall: number | null;
  score_farge: number | null;
  score_lukt: number | null;
  score_smak: number | null;
  score_friskhet: number | null;
  score_fylde: number | null;
  score_sodme: number | null;
  score_snaerp: number | null;
  score_alkohol: number | null;
  score_pris: number | null;
  karakter: number | null;
};

type WineInfo = {
  product_id: string;
  name: string;
  year: string | null;
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

            // Fetch profile if not in map
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

  // Calculate average scores per wine
  const wineScores = wines.map(wine => {
    const wineTastings = tastings.filter(t => t.product_id === wine.product_id);
    const count = wineTastings.length;

    if (count === 0) {
      return {
        ...wine,
        avgOverall: null,
        avgKarakter: null,
        avgFarge: null,
        avgLukt: null,
        avgSmak: null,
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
      avgOverall: sum('score_overall') / count,
      avgKarakter: sum('karakter') / count,
      avgFarge: sum('score_farge') / count,
      avgLukt: sum('score_lukt') / count,
      avgSmak: sum('score_smak') / count,
      avgFriskhet: sum('score_friskhet') / count,
      avgFylde: sum('score_fylde') / count,
      avgSodme: sum('score_sodme') / count,
      avgSnaerp: sum('score_snaerp') / count,
      count,
      tastings: wineTastings.map(t => ({
        ...t,
        userName: profileMap[t.user_id] || 'Ukjent'
      }))
    };
  });

  // Sort by average overall score (highest first)
  const sortedWineScores = [...wineScores].sort((a, b) => {
    if (a.avgOverall === null) return 1;
    if (b.avgOverall === null) return -1;
    return b.avgOverall - a.avgOverall;
  });

  return (
    <div className={styles.scoresContainer}>
      {sortedWineScores.map((wine, index) => (
        <div
          key={wine.product_id}
          className={styles.wineScoreCard}>
          <div className={styles.wineRank}>
            {wine.avgOverall !== null && <span className={styles.rankNumber}>#{index + 1}</span>}
          </div>
          <div className={styles.wineImageWrapper}>
            <Image
              src={`/api/wine-image/${wine.product_id}?size=200x200`}
              alt={he.decode(wine.name)}
              width={60}
              height={180}
              className={styles.wineImage}
              unoptimized
            />
          </div>
          <div className={styles.wineScoreContent}>
            <div className={styles.wineScoreHeader}>
              <h3 className={styles.wineScoreName}>{he.decode(wine.name)}</h3>
              {wine.year && <span className={styles.wineYear}>{wine.year}</span>}
            </div>

            {wine.count > 0 ? (
              <>
                <div className={styles.mainScores}>
                  <div className={styles.scoreItem}>
                    <span className={styles.scoreLabel}>Totalpoeng</span>
                    <span className={styles.scoreValue}>{wine.avgOverall?.toFixed(1)}</span>
                  </div>
                  <div className={styles.scoreItem}>
                    <span className={styles.scoreLabel}>Karakter</span>
                    <span className={styles.scoreValue}>{wine.avgKarakter?.toFixed(1)}</span>
                  </div>
                  <div className={styles.scoreItem}>
                    <span className={styles.scoreLabel}>Vurderinger</span>
                    <span className={styles.scoreValue}>{wine.count}</span>
                  </div>
                </div>

                <div className={styles.detailedScores}>
                  <ScoreBar
                    label="Farge"
                    value={wine.avgFarge}
                    max={10}
                  />
                  <ScoreBar
                    label="Lukt"
                    value={wine.avgLukt}
                    max={20}
                  />
                  <ScoreBar
                    label="Smak"
                    value={wine.avgSmak}
                    max={20}
                  />
                  <ScoreBar
                    label="Friskhet"
                    value={wine.avgFriskhet}
                    max={10}
                  />
                  <ScoreBar
                    label="Fylde"
                    value={wine.avgFylde}
                    max={10}
                  />
                  <ScoreBar
                    label="Sødme"
                    value={wine.avgSodme}
                    max={10}
                  />
                  <ScoreBar
                    label="Snærp"
                    value={wine.avgSnaerp}
                    max={10}
                  />
                  {/* Removed alkohol and pris score bars */}
                </div>

                <div className={styles.participantsList}>
                  <h4 className={styles.participantsTitle}>Deltakere</h4>
                  <div className={styles.participants}>
                    {wine.tastings.map(tasting => (
                      <div
                        key={tasting.id}
                        className={styles.participant}>
                        <span className={styles.participantName}>{tasting.userName}</span>
                        <span className={styles.participantScore}>{tasting.score_overall?.toFixed(1) || '-'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className={styles.noTastings}>Ingen vurderinger ennå</p>
            )}
          </div>
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

function ScoreBar({ label, value, max }: { label: string; value?: number; max: number }) {
  const percentage = value ? (value / max) * 100 : 0;

  return (
    <div className={styles.scoreBar}>
      <span className={styles.scoreBarLabel}>{label}</span>
      <div className={styles.scoreBarTrack}>
        <div
          className={styles.scoreBarFill}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className={styles.scoreBarValue}>
        {value?.toFixed(1) || '-'}/{max}
      </span>
    </div>
  );
}
