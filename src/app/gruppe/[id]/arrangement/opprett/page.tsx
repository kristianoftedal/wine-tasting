import { enrichEventNotes } from '@/actions/note-enrichment';
import { createClient } from '@/lib/supabase/server';
import type { Event } from '@/lib/types';
import { parseISO } from 'date-fns';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import CreateEventForm from './CreateEvent';
import styles from './page.module.css';

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

  const { data: allMemberships, error: allMembershipsError } = await supabase
    .from('group_members')
    .select('*')
    .eq('user_id', user.id);

  console.log('[v0] All memberships for user:', allMemberships, allMembershipsError?.message);

  const { data: groupMembers, error: groupMembersError } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId);

  console.log('[v0] All members of group:', groupMembers, groupMembersError?.message);

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

  // Fill in the thin reference notes for the wines that were just scheduled.
  //
  // This is the one moment the database learns which bottles will actually be
  // poured, and it happens days before anyone tastes them. Nearly half the
  // catalogue has a note too vague to grade a taster against, but only a few
  // dozen of those wines have ever reached a user — so enrichment is driven by
  // events rather than by sweeping the catalogue (src/lib/noteEnrichment.ts).
  //
  // after() so the organiser is not held while ~8 seconds per wine of research
  // runs, and try/catch because a failed enrichment must never look like a
  // failed event. Anything missed here is picked up by the upcoming-event
  // sweep, which is also what covers wines added later from the edit screen.
  after(async () => {
    try {
      const result = await enrichEventNotes(event.id);
      console.log('[note-enrichment] event', event.id, {
        processed: result.processed,
        enriched: result.enriched,
        rejected: result.rejected
      });
    } catch (enrichmentError) {
      console.error('[note-enrichment] event', event.id, enrichmentError);
    }
  });

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
          groupId={id}
        />
      </section>
    </div>
  );
}
