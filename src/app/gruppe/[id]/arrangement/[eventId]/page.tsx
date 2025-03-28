import Event from '@/db-schemas/Group';
import WineDetailed from '@/db-schemas/Wine';
import { connectDB } from '@/lib/mongoose';
import { Wine } from '@/models/productModel';
import { Link } from 'lucide-react';
import { ObjectId } from 'mongodb';

export default async function Arrangement({ params }: { params: Promise<{ id: string; eventId: string }> }) {
  const { id, eventId } = await params;

  await connectDB();
  const events = await Event.find();
  const event = await Event.findOne({ _id: new ObjectId(eventId) });
  const wines = await WineDetailed.find({ code: { $in: event.wines } });

  return (
    <div>
      <h1>{event.name}</h1>
      <section className="small-padding">
        <p>{event.description}</p>
        {wines.map((x: Wine) => (
          <article key={x._id}>
            <h5>
              <Link href={``}>
                {x.name} {x.date}
              </Link>
            </h5>
            <p>{x.description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
