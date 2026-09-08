import { createClient } from '@/lib/supabase/server';
import type { Wine } from '@/lib/types';
import { NextResponse } from 'next/server';

/**
 * Full wine record by primary key.
 *
 * The type-ahead search returns a trimmed WineSearchResult (enough for a
 * dropdown row), but the details modal needs the whole row. A GET keeps it
 * cacheable and abortable, same reasoning as /api/wine-search.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: 'not_configured' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }

  const { data, error } = await supabase.from('wines').select('*').eq('id', id).maybeSingle<Wine>();

  if (error) {
    console.error('[api/wine] lookup failed', { id, error });
    return NextResponse.json({ error: 'lookup_failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }

  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  return NextResponse.json(
    { wine: data },
    {
      headers: {
        // A wine row only changes when the catalogue is re-imported.
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600'
      }
    }
  );
}
