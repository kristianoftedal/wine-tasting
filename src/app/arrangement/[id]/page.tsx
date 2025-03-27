import Event from '@/db-schemas/Group';
import { connectDB } from '../../../lib/mongoose';

export default async function Arrangement({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  await connectDB();
  const event = await Event.findOne({ _id: id });

  return (
    <main className="responsive">
      <header className="large-padding">
        <h1>{event.name}</h1>
      </header>
      <section className="small-padding">
        <p>{event.description}</p>
        {/* {event.wines.map((x: unknown) => (
          <article key={x._id}>
            <h5>
              <Link href={``}>
                {x.name} {x.date}
              </Link>
            </h5>
            <p>{x.description}</p>
          </article>
        ))} */}
      </section>
    </main>
  );
}
