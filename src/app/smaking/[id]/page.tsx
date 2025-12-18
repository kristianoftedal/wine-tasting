import { TastingWizard } from '@/app/components/tasting/TastingWizard';
import { createClient } from '@/lib/supabase/server';
import type { Wine } from '@/lib/types';

export default async function Tasting({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string; eventId?: string }>;
}) {
  const { id } = await params;
  const { year, eventId } = await searchParams;
  const supabase = await createClient();

  let query = supabase.from('wines').select('*').eq('product_id', id);

  if (year) {
    query = query.eq('year', year);
  }

  const { data: wine } = await query.single<Wine>();

  return (
    <TastingWizard
      wine={wine}
      eventId={eventId}
    />
  );
}
