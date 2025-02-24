import Tasting from "@/db-schemas/Tasting";
import Wine from "@/db-schemas/Wine";
import { connectDB } from "@/lib/mongoose";
import { getServerSession } from "next-auth";
import User from "../../db-schemas/User";
import { authOptions } from "../../lib/auth";

export default async function Page() {
  const session = await getServerSession(authOptions);

  await connectDB();

  const user = await User.findOne({ email: session?.user?.email });

  const tastings = await Tasting.find({ userId: user._id });
  const ids = tastings.map((x) => x.productId);
  const wines = await Wine.find({ code: { $in: ids } });

  return (
    <div>
      <h1>Din profil</h1>
      {wines.length === 0 ? (
        <p>No tastings found.</p>
      ) : (
        <ul className="list bordered">
          {wines.map((wine) => (
            <li key={wine.code}>
              Navn: <strong>{wine.name}</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
