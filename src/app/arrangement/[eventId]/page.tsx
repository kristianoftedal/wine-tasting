import { createClient } from '@/lib/supabase/server';
import type { Event, Group, Wine } from '@/lib/types';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import he from 'he';
import Link from 'next/link';
import NavButton from './NavButton';
import styles from './page.module.css';

export default async function Arrangement({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single<Event>();

  if (!event) {
    return (
      <div className={styles.container}>
        <p>Arrangement ikke funnet</p>
      </div>
    );
  }

  const { data: group } = await supabase.from('groups').select('*').eq('id', event.group_id).single<Group>();

  const { data: wines } = await supabase
    .from('wines')
    .select('*')
    .in('product_id', event.wines.length > 0 ? event.wines : ['']);

  const sortedWines =
    wines?.sort((a, b) => event.wines.indexOf(a.product_id) - event.wines.indexOf(b.product_id)) || [];

  const formattedDate = format(new Date(event.date), 'EEEE dd. MMMM yyyy', { locale: nb });

  return (
    <div className={styles.container}>
      <Link
        href="/"
        className={styles.backButton}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Tilbake til oversikt
      </Link>

      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>{event.name}</h1>
          <div className={styles.meta}>
            <div className={styles.metaItem}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2">
                <rect
                  x="3"
                  y="4"
                  width="18"
                  height="18"
                  rx="2"
                  ry="2"
                />
                <line
                  x1="16"
                  y1="2"
                  x2="16"
                  y2="6"
                />
                <line
                  x1="8"
                  y1="2"
                  x2="8"
                  y2="6"
                />
                <line
                  x1="3"
                  y1="10"
                  x2="21"
                  y2="10"
                />
              </svg>
              <span>{formattedDate}</span>
            </div>
            <div className={styles.metaItem}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle
                  cx="9"
                  cy="7"
                  r="4"
                />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>{group?.name}</span>
            </div>
          </div>
        </div>
      </header>

      <section className={styles.description}>
        <p>{event.description}</p>
      </section>

      <Link
        href={`/arrangement/${eventId}/resultater`}
        className={styles.resultsLink}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2">
          <path d="M18 20V10M12 20V4M6 20v-6" />
        </svg>
        Se live resultater
        <span className={styles.liveBadge}>
          <span className={styles.liveDot} />
          Live
        </span>
      </Link>

      <section className={styles.winesSection}>
        <h2 className={styles.sectionTitle}>Viner for kvelden</h2>
        <div className={styles.winesList}>
          {sortedWines.map((wine: Wine) => (
            <NavButton
              code={wine.product_id}
              eventId={eventId}
              key={wine.product_id}>
              <article className={styles.wineCard}>
                <div className={styles.wineHeader}>
                  <h3 className={styles.wineName}>{he.decode(wine.name)}</h3>
                </div>
                <p className={styles.wineDescription}>{wine.description}</p>
              </article>
            </NavButton>
          ))}
        </div>
      </section>
    </div>
  );
}
