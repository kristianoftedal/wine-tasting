import { Group } from '../../../db-schemas/Group';
import User from '../../../db-schemas/User';
import { connectDB } from '../../../lib/mongoose';
import CreateGroupForm from './CreateGroupForm';

async function searchUsers(query: string) {
  'use server';

  await connectDB();
  return User.find({
    $or: [{ name: { $regex: query, $options: 'i' } }, { email: { $regex: query, $options: 'i' } }]
  }).limit(5);
}

async function createGroup(formData: FormData) {
  'use server';

  await connectDB();
  const name = formData.get('name') as string;
  const memberIds = formData.getAll('members') as string[];

  const group = new Group({
    name,
    members: memberIds
  });
  await group.save();
}

export default function CreateGroupPage() {
  return (
    <main className="responsive">
      <header className="large-padding">
        <h1>Opprett ny gruppe</h1>
      </header>
      <section className="small-padding">
        <CreateGroupForm
          createGroup={createGroup}
          searchUsers={searchUsers}
        />
      </section>
    </main>
  );
}
