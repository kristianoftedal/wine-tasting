import Event from '@/db-schemas/Event';
import Group from '@/db-schemas/Group';
import User, { type UserDocument } from '@/db-schemas/User';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongoose';
import { format } from 'date-fns';
import { ObjectId } from 'mongodb';
import { getServerSession } from 'next-auth';
import Link from 'next/link';
import Member from './Member';
import styles from './page.module.css';

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  await connectDB();
  const session = await getServerSession(authOptions);

  const userId = session?.user?.id.toString();

  const groupCheck = await Group.findOne({ members: new ObjectId(userId) });
  const group = await Group.findOne({ _id: new ObjectId(id) });
  const users = (await User.find({ _id: { $in: group?.members } })) as Array<UserDocument>;

  if (group === null) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <h4 className={styles.emptyStateTitle}>Fant ingen gruppe</h4>
        </div>
      </div>
    );
  }
  const isMember = groupCheck !== null;
  const events = await Event.find({ group: group?._id });

  const addUser = async (id: string) => {
    'use server';
    const group = await Group.findOne({ _id: new ObjectId(id) });
    group.members.push(userId);
    await group.save();
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>{group.name}</h1>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Medlemmer</h2>
        <div className={styles.membersList}>
          {users?.map(x => (
            <article
              key={x._id}
              className={styles.memberCard}>
              <p className={styles.memberName}>{x.name}</p>
            </article>
          ))}
        </div>
        <Member
          addUser={addUser}
          userIsMember={isMember}
          groupId={group?._id.toString()}
        />
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Arrangement</h2>
          <Link
            href={`/gruppe/${id}/arrangement/opprett`}
            className={styles.addButton}>
            Legg til
          </Link>
        </div>
        <div className={styles.eventsList}>
          {events?.map(x => (
            <article
              key={x._id}
              className={styles.eventCard}>
              <h3 className={styles.eventTitle}>
                <Link
                  href={`/gruppe/${x._id}/arrangement/${x._id}`}
                  className={styles.eventLink}>
                  {x.name} {format(x.date, 'Pp')}
                </Link>
              </h3>
              <p className={styles.eventDescription}>{x.description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
