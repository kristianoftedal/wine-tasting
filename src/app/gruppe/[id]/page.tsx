import Event from '@/db-schemas/Event';
import Group from '@/db-schemas/Group';
import { connectDB } from '@/lib/mongoose';
import { ObjectId } from 'mongodb';
import { getServerSession } from 'next-auth';
import Link from 'next/link';
import User, { UserDocument } from '../../../db-schemas/User';
import { authOptions } from '../../../lib/auth';
import Member from './Member';

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  await connectDB();
  const session = await getServerSession(authOptions);

  const userId = session?.user?.id.toString();
  const groupCheck = await Group.findOne({ members: new ObjectId(userId) });
  const group = await Group.findOne({ _id: new ObjectId(id) });
  const users = (await User.find({ _id: { $in: group?.members } })) as Array<UserDocument>;

  const isMember = groupCheck !== null;
  const events = await Event.find({ group: group._id });

  const addUser = async id => {
    'use server';
    const group = await Group.findOne({ _id: new ObjectId(id) });
    group.members.push(userId);
    await group.save();
  };

  return (
    <main className="responsive">
      <header className="large-padding">
        <h4>{group.name}</h4>
      </header>
      <section className="small-padding">
        <h4>Medlemmer</h4>
        {users?.map(x => (
          <article key={x._id}>
            <p>{x.name}</p>
          </article>
        ))}
        <Member
          addUser={addUser}
          userIsMember={isMember}
          groupId={group?._id.toString()}
        />
      </section>
      <section className="small-padding">
        <h4>Arrangement</h4>
        <div className="row">
          <button>Legg til</button>
        </div>
        {events?.map(x => (
          <article key={x._id}>
            <h5>
              <Link href={`/arrangement/${x._id}`}>
                {x.name} {x.date}
              </Link>
            </h5>
            <p>{x.description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
