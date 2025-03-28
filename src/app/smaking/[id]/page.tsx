import { TastingWizard } from '@/app/components/tasting/TastingWizard';
import clientPromise from '@/lib/mongodb';

export default async function Tasting({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const { id } = await params;
  const wine = await getWine(id);
  const eventId = searchParams?.eventId;

  return (
    <TastingWizard
      wine={wine}
      eventId={eventId}
    />
  );
}

const getWine = async (id: string) => {
  try {
    const client = clientPromise;
    await client.connect();

    const db = client.db('Wines');
    const winesCollection = db.collection('WinesDetailed'); // Replace with your collection name

    // Query for a wine where 'code' matches the 'id' from the route parameter
    const wine = await winesCollection.findOne({ code: id });

    if (!wine) {
      return null;
    }

    return JSON.parse(JSON.stringify(wine));
  } catch (error) {
    console.error('Error fetching wine:', error);
    return null;
  }
};
