import { Wine as ProductModel } from '@/app/models/productModel';
import Event from '@/db-schemas/Event';
import Wine from '@/db-schemas/Wine';
import { connectDB } from '@/lib/mongoose';
import { ObjectId } from 'mongodb';
import ResetButton from './button';

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
              <ResetButton
                code={x.code.toString()}
                eventId={eventId}>
                {x.name.toString()}
              </ResetButton>
            </h5>
            <p>{x.description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
