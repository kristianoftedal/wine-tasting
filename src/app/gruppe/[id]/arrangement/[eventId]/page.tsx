import { Wine } from '@/app/models/productModel';
import Event from '@/db-schemas/Group';
import WineDetailed from '@/db-schemas/Wine';
import { connectDB } from '@/lib/mongoose';
import { Link } from 'lucide-react';
import { ObjectId } from 'mongodb';

export default async function Arrangement({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;

  await connectDB();
  const event = await Event.findOne({ _id: new ObjectId(eventId) });
  const wines = await WineDetailed.find({ code: { $in: event.wines } });

  return (
    <div>
      <h1>{event.name}</h1>
      <section className="small-padding">
        <p>{event.description}</p>
        {wines.map((x: Wine) => (
          <article key={x.code}>
            <h5>
              <Link href={``}>{x.name}</Link>
            </h5>
            <p>{x.description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
