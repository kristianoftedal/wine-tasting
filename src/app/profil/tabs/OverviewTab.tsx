'use client';

import ScoreBar from '@/app/components/ScoreBar';
import type { Event, Group, Tasting, Wine } from '@/lib/types';
import { decode } from 'he';
import Link from 'next/link';
import { useMemo } from 'react';
import styles from '../page.module.css';

interface OverviewTabProps {
  tastings: Tasting[];
  wines: Wine[];
  groups: Group[];
  events: Event[];
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

export default function OverviewTab({ tastings, wines, groups, events }: OverviewTabProps) {
  const avgScores = useMemo(() => {
    if (tastings.length === 0) return null;

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
    tastings.forEach(t => {
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
  }, [tastings]);

  const earnedCount = useMemo(() => {
    const highSmellCount = tastings.filter(t => (t.smell_score || 0) >= 70).length;
    const highTasteCount = tastings.filter(t => (t.taste_score || 0) >= 70).length;
    const highOverallCount = tastings.filter(t => (t.overall_score || 0) >= 70).length;
    const perfectKarakter = tastings.filter(t => (t.karakter || 0) >= 9).length;
    const totalTastings = tastings.length;

    let earned = 0;
    if (highSmellCount >= 5) earned++;
    if (highTasteCount >= 5) earned++;
    if (totalTastings >= 10) earned++;
    if (highOverallCount >= 3) earned++;
    if (perfectKarakter >= 3) earned++;
    if (totalTastings >= 25) earned++;
    // Add other accolades...
    return earned;
  }, [tastings]);

  return (
    <div className={styles.overviewGrid}>
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{tastings.length}</div>
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
                  {decode(group.name)}
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
  );
}
