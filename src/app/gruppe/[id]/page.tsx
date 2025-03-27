import Event from '@/db-schemas/Event';
import Group from '@/db-schemas/Group';
import User from '@/db-schemas/User';
import { connectDB } from '@/lib/mongoose';
import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { authOptions } from '../../../lib/auth';
import Member from './Member';

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  await connectDB();
  const session = await getServerSession(authOptions);

  const group = await Group.findOne({ _id: id });
  const users = await User.find({ _id: { $in: group?.members } });
  const userIds = users.map(x => x.id);
  const userId = session?.user?.id;
  const isMember = userIds.includes(x => x === userId);
  console.log('userids: ' + userIds[0]);
  console.log(userIds[0]);
  const events = await Event.find({ group: group._id });

  const addUser = async id => {
    'use server';
    const group = await Group.findOne({ _id: id });
    group.members.push(userId);
    await group.save();
  };

  return (
    <main className="responsive">
      <header className="large-padding">
        <h1>{group.name}</h1>
      </header>
      <section className="small-padding">
        <h4>Medlemmer</h4>
        {users?.map(x => (
          <article key={x._id}>
            <h5>
              <Link href={`/klubbkveld/${x._id}`}>
                {x.name} {x.date}
              </Link>
            </h5>
          </article>
        ))}
        <Member
          addUser={addUser}
          userIsMember={isMember}
          groupId={group._id}
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
              <Link href={`/klubbkveld/${x._id}`}>
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
