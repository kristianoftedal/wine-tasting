import { Wine as ProductModel } from '@/app/models/productModel';
import Event from '@/db-schemas/Event';
import Wine from '@/db-schemas/Wine';
import { connectDB } from '@/lib/mongoose';
import { ObjectId } from 'mongodb';
import Link from 'next/link';
import styles from './page.module.css';

export default async function Arrangement({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;

  await connectDB();
  const event = await Event.findOne({ _id: new ObjectId(eventId) });
  const wines = await Wine.find({ code: { $in: event.wines } });

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{event.name}</h1>
      <section className={styles.section}>
        <p className={styles.description}>{event.description}</p>
        {wines.map((x: ProductModel) => (
          <article
            key={x.code}
            className={styles.wineCard}>
            <h5 className={styles.wineTitle}>
              <Link href={`/smaking/${x.code}?eventId=${event._id}`}>{x.name}</Link>
            </h5>
            <p className={styles.wineDescription}>{x.description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
