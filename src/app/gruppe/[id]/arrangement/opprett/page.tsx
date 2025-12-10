import { createClient } from '@/lib/supabase/server';
import type { Event, Wine } from '@/lib/types';
import { parseISO } from 'date-fns';
import { redirect } from 'next/navigation';
import CreateEventForm from './CreateEvent';
import styles from './page.module.css';

async function searchWines(query: string) {
  'use server';

  const supabase = await createClient();
  const { data: wines } = await supabase
    .from('wines')
    .select('name, product_id')
    .or(`name.ilike.%${query}%,product_id.ilike.%${query}%`)
    .limit(10);

  return (wines as Pick<Wine, 'name' | 'product_id'>[]) || [];
}

async function createEvent(formData: FormData): Promise<Event> {
  'use server';

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const date = parseISO(formData.get('date') as string);
  const wines = formData.getAll('wines') as string[];
  const groupId = formData.get('groupId') as string;

  console.log('[v0] Creating event with:', {
    name,
    description,
    date: date.toISOString(),
    wines,
    groupId,
    userId: user.id
  });

  // First, check all memberships for this user
  const { data: allMemberships, error: allMembershipsError } = await supabase
    .from('group_members')
    .select('*')
    .eq('user_id', user.id);

  console.log('[v0] All memberships for user:', allMemberships, allMembershipsError?.message);

  // Check all members of this group
  const { data: groupMembers, error: groupMembersError } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId);

  console.log('[v0] All members of group:', groupMembers, groupMembersError?.message);

  // Now check the specific membership
  const { data: membership, error: membershipError } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle();

  console.log('[v0] Membership check result:', { membership, error: membershipError?.message });

  if (membershipError) {
    console.log('[v0] Membership query error:', membershipError.message);
    throw new Error(`Membership check failed: ${membershipError.message}`);
  }

  if (!membership) {
    console.log('[v0] User is not a member of this group');
    throw new Error('You must be a member of this group to create events');
  }

  const { data: event, error } = await supabase
    .from('events')
    .insert({
      name,
      description,
      date: date.toISOString(),
      wines,
      group_id: groupId
    })
    .select()
    .single<Event>();

  if (error) {
    console.log('[v0] Supabase error creating event:', error.message, error.details, error.hint);
    throw new Error(`Failed to create event: ${error.message}`);
  }

  if (!event) {
    throw new Error('Failed to create event: No event returned');
  }

  return event;
}

export default async function CreateEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Opprett nytt arrangement</h1>
      <section className={styles.section}>
        <CreateEventForm
          createEvent={createEvent}
          searchWines={searchWines}
          groupId={id}
        />
      </section>
    </div>
  );
}
