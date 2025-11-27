import Group, { type GroupDocument } from '../../../db-schemas/Group';
import User from '../../../db-schemas/User';
import { connectDB } from '../../../lib/mongoose';
import CreateGroupForm from './OpprettGruppe';
import styles from './page.module.css';

async function searchUsers(query: string) {
  'use server';

  await connectDB();
  const users = await User.find({
    $or: [{ name: { $regex: query, $options: 'i' } }, { email: { $regex: query, $options: 'i' } }]
  }).limit(5);

  return JSON.parse(JSON.stringify(users.map(x => ({ _id: x._id, name: x._name, email: x.email }))));
}

async function createGroup(formData: FormData): Promise<GroupDocument> {
  'use server';

  await connectDB();
  const name = formData.get('name') as string;
  const memberIds = formData.getAll('members') as string[];

  const group = new Group({
    name,
    members: memberIds
  });
  await group.save();
  return JSON.parse(JSON.stringify(group));
}

export default function CreateGroupPage() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Opprett ny gruppe</h1>
      <div className={styles.card}>
        <CreateGroupForm
          createGroup={createGroup}
          searchUsers={searchUsers}
        />
      </div>
    </div>
  );
}
