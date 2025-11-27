import Event, { EventDocument } from '@/db-schemas/Event';
import Wine from '@/db-schemas/Wine';
import { connectDB } from '@/lib/mongoose';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import { ObjectId } from 'mongodb';
import Link from 'next/link';
import Group, { GroupDocument } from '../../../db-schemas/Group';
import NavButton from './NavButton';
import styles from './page.module.css';

export default async function Arrangement({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;

  await connectDB();
  const dbEvent = (await Event.findOne({ _id: new ObjectId(eventId) }).lean()) as unknown as EventDocument;
  const dbGroup = (await Group.findOne({ _id: new ObjectId(dbEvent.group) }).lean()) as unknown as GroupDocument;
  if (!dbEvent) throw new Error('Event not found');

  // Convert to ISO string or keep as Date object
  const event = {
    ...dbEvent,
    date: dbEvent.date.toISOString() // plain string safe for Next.js Client Components
  };
  let wines = await Wine.find({ code: { $in: event.wines } }).lean();

  wines = wines.sort((a, b) => event.wines.indexOf(a.code) - event.wines.indexOf(b.code));

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
              <span>{dbGroup.name}</span>
            </div>
          </div>
        </div>
      </header>

      <section className={styles.description}>
        <p>{event.description}</p>
      </section>

      <section className={styles.winesSection}>
        <h2 className={styles.sectionTitle}>Viner for kvelden</h2>
        <div className={styles.winesList}>
          {wines.map(wine => (
            <NavButton
              code={wine.code}
              eventId={eventId}
              key={wine.code}>
              <article className={styles.wineCard}>
                <div className={styles.wineHeader}>
                  <h3 className={styles.wineName}>{wine.name}</h3>
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
