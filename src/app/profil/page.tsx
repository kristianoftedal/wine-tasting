import Tasting from '@/db-schemas/Tasting';
import Wine from '@/db-schemas/Wine';
import { connectDB } from '@/lib/mongoose';
import { format } from 'date-fns';
import { getServerSession } from 'next-auth';
import Link from 'next/link';
import Group from '../../db-schemas/Group';
import User from '../../db-schemas/User';
import { authOptions } from '../../lib/auth';
import { SelectedFlavor } from '../models/flavorModel';
import { TastingModel } from '../models/tastingModel';
import Event from '../../db-schemas/Event';

export default async function Page() {
  const session = await getServerSession(authOptions);

  await connectDB();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const users = await User.find();
  const user = await User.findOne({ email: session?.user?.email });
  const groups = await Group.find({ members: user?.id });
  const groupIds = groups.map(x => x._id);
  const events = await Event.find({ group: { $in: groupIds } });

  const userId = user?._id.toString();

  const tastings = await Tasting.find({ userId: userId });
  const ids = tastings.map(x => x.productId).filter(x => x);
  const wines = await Wine.find({ code: { $in: ids } });

  return (
    <main className="responsive">
      <header className="large-padding ">
        <div className="row">
          <div className="col s12 m9">
            <h1 className="no-margin">{user.name}</h1>
          </div>
        </div>
      </header>

      <section className="grid">
        <div className="col s12 m6">
          <div className="card">
            <div className="card-content">
              <span className="card-title">Tidligere smaksnotater</span>
              {tastings.length === 0 ? (
                <p>Ingen smaksnotater funnet.</p>
              ) : (
                tastings.map((tasting: TastingModel, index: number) => (
                  <details key={index}>
                    <summary>
                      <article>
                        <h5>{wines.find(x => x.code === tasting.productId)?.name}</h5>
                        <p>{format(tasting.tastedAt, 'Pp')}</p>
                      </article>
                    </summary>
                    <div className="max">
                      <p>Farge: {tasting.farge}</p>
                      <p>
                        Lukt:{' '}
                        {tasting.selectedFlavorsLukt.map((x: SelectedFlavor) => x.flavor.name).join(', ') || '&nbsp;'},{' '}
                        {tasting.lukt}
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
                ))
              )}
            </div>
          </div>
        </div>

        <div className="col s12 m6">
          <div className="card">
            <div className="card-content">
              <span className="card-title">Your Groups</span>
              <ul>
                {groups.map(group => (
                  <li key={group._id.toString()}>
                    <Link href={`/gruppe/${group._id}`}>{group.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card-action">
              <Link
                href="/gruppe/opprett-gruppe"
                className="button">
                Opprett gruppe
              </Link>
            </div>
          </div>
        </div>

        <div className="col s12">
          <div className="card">
            <div className="card-content">
              <span className="card-title">Upcoming Group Events</span>
              <ul className="collection">
                {events?.map(event => (
                  <li
                    key={event._id.toString()}
                    className="collection-item avatar">
                    <i className="material-icons circle">event</i>
                    <span className="title">{event.name}</span>
                    <p>
                      {new Date(event.date).toLocaleDateString()}
                      <br />
                      {event.group.name}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card-action">
              <Link
                href="/create-event"
                className="btn">
                Create Event
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
