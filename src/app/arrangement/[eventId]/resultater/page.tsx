import { createClient } from '@/lib/supabase/server';
import type { Event } from '@/lib/types';
import Link from 'next/link';
import { EventScoresRealtime } from './event-scores-realtime';
import styles from './page.module.css';

export default async function EventScoresPage({ params }: { params: Promise<{ eventId: string }> }) {
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

  const { data: wines } = await supabase
    .from('wines')
    .select('*')
    .in('id', event.wines.length > 0 ? event.wines : ['']);

  const sortedWines = wines?.sort((a, b) => event.wines.indexOf(a.id) - event.wines.indexOf(b.id)) || [];

  const { data: initialTastings } = await supabase
    .from('tastings')
    .select(
      'id, wine_id, user_id, overall_score, color_score, smell_score, taste_score, friskhet_score, fylde_score, sodme_score, snaerp_score, karakter, farge, lukt, smak, friskhet, fylde, sodme, snaerp'
    )
    .eq('event_id', eventId);

  // Fetch user profiles for the tastings
  const userIds = [...new Set(initialTastings?.map(t => t.user_id) || [])];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name')
    .in('id', userIds.length > 0 ? userIds : ['']);

  const profileMap = new Map(profiles?.map(p => [p.id, p.name]) || []);

  return (
    <div className={styles.container}>
      <Link
        href={`/arrangement/${eventId}`}
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
        Tilbake til arrangement
      </Link>

      <header className={styles.header}>
        <h1 className={styles.title}>Resultater</h1>
        <p className={styles.subtitle}>{event.name}</p>
        <div className={styles.liveIndicator}>
          <span className={styles.liveDot} />
          Live oppdateringer
        </div>
      </header>

      <EventScoresRealtime
        eventId={eventId}
        wines={sortedWines}
        initialTastings={initialTastings || []}
        initialProfileMap={Object.fromEntries(profileMap)}
      />
    </div>
  );
}
