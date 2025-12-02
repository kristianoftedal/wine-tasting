import { TastingWizard } from '@/app/components/tasting/TastingWizard';
import { createClient } from '@/lib/supabase/server';
import type { Wine } from '@/lib/types';

export default async function Tasting({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  console.log('[v0] Smaking page - Looking for wine with product_id:', id);

  const { data: wine, error } = await supabase.from('wines').select('*').eq('product_id', id).single<Wine>();

  console.log('[v0] Smaking page - Query result:', { wine: wine?.name, error });

  return <TastingWizard wine={wine} />;
}
