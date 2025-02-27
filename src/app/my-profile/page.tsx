import Tasting from '@/db-schemas/Tasting';
import Wine from '@/db-schemas/Wine';
import { connectDB } from '@/lib/mongoose';
import { format } from 'date-fns';
import { getServerSession } from 'next-auth';
import User from '../../db-schemas/User';
import { authOptions } from '../../lib/auth';
import { SelectedFlavor } from '../models/flavorModel';
import { TastingModel } from '../models/tastingModel';

export default async function Page() {
  const session = await getServerSession(authOptions);

  await connectDB();

  const user = await User.findOne({ email: session?.user?.email });

  const userId = user?._id.toString();

  const tastings = await Tasting.find({ userId: userId });
  const ids = tastings.map(x => x.productId).filter(x => x);
  const wines = await Wine.find({ code: { $in: ids } });

  return (
    <div>
      <h1>Din profil</h1>
      {tastings.length === 0 ? (
        <p>Ingen smaksnotater funnet.</p>
      ) : (
        <ul className="list bordered">
          {tastings.map((tasting: TastingModel, index: number) => (
            <li key={index}>
              <details>
                <summary>
                  Navn: <strong>{wines.find(x => x.code === tasting.productId)?.name}</strong>,{' '}
                  {format(tasting.tastedAt, 'Pp')}
                </summary>
                <div className="max">
                  <p>Farge: {tasting.farge}</p>
                  <p>
                    Lukt: {tasting.selectedFlavorsLukt.map((x: SelectedFlavor) => x.flavor.name).join(', ') || '&nbsp;'}
                    , {tasting.lukt}
                  </p>
                  <p>
                    Smak: {tasting.selectedFlavorsSmak.map((x: SelectedFlavor) => x.flavor.name).join(', ')},{' '}
                    {tasting.smak}
                  </p>
                  <p>Friskhet: {tasting.friskhet}</p>
                  <p>Fylde: {tasting.fylde}</p>
                  <p>Sødme: {tasting.sødme}</p>
                  <p>Karakter: {tasting.karakter}</p>
                  <p>Kommentar: {tasting.egenskaper}</p>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
