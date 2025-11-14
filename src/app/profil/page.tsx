import Tasting from '@/db-schemas/Tasting';
import Wine from '@/db-schemas/Wine';
import { connectDB } from '@/lib/mongoose';
import { format } from 'date-fns';
import { ObjectId } from 'mongodb';
import { getServerSession } from 'next-auth';
import Link from 'next/link';
import Event from '../../db-schemas/Event';
import Group from '../../db-schemas/Group';
import User from '../../db-schemas/User';
import { authOptions } from '../../lib/auth';
import type { SelectedFlavor } from '../models/flavorModel';
import type { TastingModel } from '../models/tastingModel';
import styles from './page.module.css';

export default async function Page() {
  const session = await getServerSession(authOptions);

  await connectDB();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const users = await User.find();
  const user = await User.findOne({ email: session?.user?.email });
  const groups = await Group.find({ members: new ObjectId(user?.id) });
  const groupIds = groups.map(x => x._id);
  const events = await Event.find({ group: { $in: groupIds } });

  const userId = user?._id.toString();

  const tastings = await Tasting.find({ userId: userId });
  const ids = tastings.map(x => x.productId).filter(x => x);
  const wines = await Wine.find({ code: { $in: ids } });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{user.name}</h1>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Tidligere smaksnotater</h2>
          </div>
          <div className={styles.cardContent}>
            {tastings.length === 0 ? (
              <p className={styles.emptyState}>Ingen smaksnotater funnet.</p>
            ) : (
              tastings.map((tasting: TastingModel, index: number) => (
                <details
                  key={index}
                  className={styles.details}>
                  <summary>
                    <h5 className={styles.tastingTitle}>{wines.find(x => x.code === tasting.productId)?.name}</h5>
                    <p className={styles.tastingDate}>{format(tasting.tastedAt, 'Pp')}</p>
                  </summary>
                  <div className={styles.detailsContent}>
                    <p className={styles.tastingAttribute}>
                      <strong>Farge:</strong> {tasting.farge}
                    </p>
                    <p className={styles.tastingAttribute}>
                      <strong>Lukt:</strong>{' '}
                      {tasting.selectedFlavorsLukt.map((x: SelectedFlavor) => x.flavor.name).join(', ')}, {tasting.lukt}
                    </p>
                    <p className={styles.tastingAttribute}>
                      <strong>Smak:</strong>{' '}
                      {tasting.selectedFlavorsSmak.map((x: SelectedFlavor) => x.flavor.name).join(', ')}, {tasting.smak}
                    </p>
                    <p className={styles.tastingAttribute}>
                      <strong>Friskhet:</strong> {tasting.friskhet}
                    </p>
                    <p className={styles.tastingAttribute}>
                      <strong>Fylde:</strong> {tasting.fylde}
                    </p>
                    <p className={styles.tastingAttribute}>
                      <strong>Sødme:</strong> {tasting.sødme}
                    </p>
                    <p className={styles.tastingAttribute}>
                      <strong>Karakter:</strong> {tasting.karakter}
                    </p>
                    <p className={styles.tastingAttribute}>
                      <strong>Kommentar:</strong> {tasting.egenskaper}
                    </p>
                  </div>
                </details>
              ))
            )}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Dine grupper</h2>
          </div>
          <div className={styles.cardContent}>
            <ul className={styles.list}>
              {groups.length === 0 && <li className={styles.emptyState}>Ingen funnet</li>}
              {groups.map(group => (
                <li
                  key={group._id.toString()}
                  className={styles.listItem}>
                  <Link href={`/gruppe/${group._id}`}>{group.name}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.cardFooter}>
            <Link
              href="/gruppe/opprett-gruppe"
              className={styles.button}>
              Opprett gruppe
            </Link>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Mine arrangement</h2>
          </div>
          <div className={styles.cardContent}>
            {events.length === 0 && <p className={styles.emptyState}>Ingen funnet</p>}
            {events?.map(event => (
              <Link
                key={event._id.toString()}
                href={`/gruppe/${event.group}/arrangement/${event._id}`}
                className={styles.eventItem}>
                <p className={styles.eventDate}>{new Date(event.date).toLocaleDateString()}</p>
                <p className={styles.eventTitle}>{event.name}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
