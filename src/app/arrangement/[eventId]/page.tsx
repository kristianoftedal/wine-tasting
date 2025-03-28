import Event from '@/db-schemas/Event';
import Wine from '@/db-schemas/Wine';
import { connectDB } from '@/lib/mongoose';
import { ObjectId } from 'mongodb';
import Link from 'next/link';
import { Wine as ProductModel } from '../../../../models/productModel';

export default async function Arrangement({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;

  await connectDB();
  const event = await Event.findOne({ _id: new ObjectId(eventId) });
  const wines = await Wine.find({ code: { $in: event.wines } });

  return (
    <div>
      <h1>{event.name}</h1>
      <section className="small-padding">
        <p>{event.description}</p>
        {wines.map((x: ProductModel) => (
          <article key={x.code}>
            <h5>
              <Link href={`/smaking/${x.code}?eventId=${x._id}`}>{x.name}</Link>
            </h5>
            <p>{x.description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
