import clientPromise from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id;
  console.log(id);
  try {
    const client = clientPromise;
    await client.connect();

    const db = client.db("Wines");
    const winesCollection = db.collection("WinesDetailed"); // Replace with your collection name

    // Query for a wine where 'code' matches the 'id' from the route parameter
    const wine = await winesCollection.findOne({ code: id });

    if (!wine) {
      return NextResponse.json({ message: "Wine not found" });
    }
    // Return the found wine document
    return NextResponse.json(wine);
  } catch (error) {
    console.error("Error fetching wine:", error);
    return NextResponse.json({ message: "Server error" });
  }
}
