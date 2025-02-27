import clientPromise from '@/lib/mongodb';

export const getWineById = async (id: string) => {
  try {
    const client = clientPromise;
    await client.connect();

    const db = client.db('Wines');
    const winesCollection = db.collection('WinesDetailed'); // Replace with your collection name

    // Query for a wine where 'code' matches the 'id' from the route parameter
    const wine = await winesCollection.find({ code: id });

    if (!wine) {
      return null;
    }

    return JSON.parse(JSON.stringify(wine));
  } catch (error) {
    console.error('Error fetching wine:', error);
    return null;
  }
};
