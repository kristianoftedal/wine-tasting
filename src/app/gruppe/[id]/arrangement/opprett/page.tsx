import Event, { EventDocument } from '@/db-schemas/Event';
import Wine from '@/db-schemas/Wine';
import { connectDB } from '@/lib/mongoose';
import { ObjectId } from 'mongoose';
import CreateEventForm from './OpprettArrangement';

async function searchWines(query: string) {
  'use server';

  await connectDB();
  const wines = await Wine.find({
    $or: [{ name: { $regex: query, $options: 'i' } }, { code: { $regex: query, $options: 'i' } }]
  }).limit(10);
  return JSON.parse(JSON.stringify(wines.map(x => ({ name: x.name, code: x.code }))));
}

async function createEvent(formData: FormData): Promise<EventDocument> {
  'use server';

  await connectDB();
  const name = formData.get('name') as string;
  const description = formData.get('name') as string;
  const date = formData.get('date') as Date;
  const wines = formData.getAll('wines') as Wine[];
  const group = formData.get('group') as ObjectId;

  const event = new Event({
    name,
    description,
    date,
    wines,
    group
  });
  await event.save();
  return JSON.parse(JSON.stringify(event));
}

export default async function CreateEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <h1>Opprett nytt arrangement</h1>
      <section>
        <CreateEventForm
          createEvent={createEvent}
          searchWines={searchWines}
          groupId={id}
        />
      </section>
    </div>
  );
}
