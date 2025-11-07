import { connectDB } from '@/lib/mongoose';
import { ObjectId } from 'mongodb';
import { getServerSession } from 'next-auth';
import Link from 'next/link';
import Event from '../../db-schemas/Event';
import Group from '../../db-schemas/Group';
import User from '../../db-schemas/User';
import { authOptions } from '../../lib/auth';
import styles from './UpcomingEvents.module.css';

export async function UpcomingEvents() {
  const session = await getServerSession(authOptions);

  await connectDB();

  const user = await User.findOne({ email: session?.user?.email });
  const groups = await Group.find({ members: new ObjectId(user?.id) });
  const groupIds = groups.map(x => x._id);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const events = await Event.find({
    group: { $in: groupIds },
    date: { $gte: today } // Only include future events
  });

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('nb-NO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
  };

  return (
    <section className={styles.upcomingEvents}>
      <h2 className={styles.title}>Kommende arrangementer</h2>

      <div className={styles.list}>
        {events.map(event => (
          <Link
            key={event._id}
            href={`/arrangement/${event._id}`}
            className={styles.eventCard}>
            <div
              key={event._id}
              className={styles.eventCard}>
              <div className={styles.header}>
                <h3 className={styles.eventTitle}>{event.name}</h3>
                <span className={styles.badge}>{event.wines.length} viner</span>
              </div>

              <p className={styles.description}>{event.description}</p>

              <div className={styles.footer}>
                <div className={styles.info}>
                  <svg
                    width="16"
                    height="16"
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
                  {formatDate(event.date)}
                </div>
                <div className={styles.info}>
                  <svg
                    width="16"
                    height="16"
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
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
