import { createClient } from '@/lib/supabase/server';
import type { Event, Group, Profile, Tasting, Wine } from '@/lib/types';
import { redirect } from 'next/navigation';
import styles from './page.module.css';
import { TastingDashboard } from './tasting-dashboard';

export default async function Page() {
  const supabase = await createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user profile
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single<Profile>();

  // Get user's groups via group_members junction table
  const { data: groupMemberships } = await supabase.from('group_members').select('group_id').eq('user_id', user.id);

  const groupIds = groupMemberships?.map(gm => gm.group_id) || [];

  const { data: groups } = await supabase
    .from('groups')
    .select('*')
    .in('id', groupIds.length > 0 ? groupIds : ['00000000-0000-0000-0000-000000000000']);

  // Get events for user's groups
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .in('group_id', groupIds.length > 0 ? groupIds : ['00000000-0000-0000-0000-000000000000']);

  // Get user's tastings
  const { data: tastings, error: tastingsError } = await supabase.from('tastings').select('*').eq('user_id', user.id);

  // Get wines for tastings
  const productIds = tastings?.map(t => t.product_id).filter(Boolean) || [];

  const { data: wines } = await supabase
    .from('wines')
    .select('*')
    .in('product_id', productIds.length > 0 ? productIds : ['']);

  const { data: allWines } = await supabase.from('wines').select('*').limit(500);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{profile?.name || user.email}</h1>
        <p className={styles.subtitle}>Din personlige vinprofil</p>
      </div>

      <TastingDashboard
        tastings={(tastings as Tasting[]) || []}
        wines={(wines as Wine[]) || []}
        allWines={(allWines as Wine[]) || []}
        groups={(groups as Group[]) || []}
        events={(events as Event[]) || []}
      />
    </div>
  );
}
