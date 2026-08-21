import { searchWines } from '@/actions/wine-search';
import { WINE_SEARCH_LIMIT } from '@/lib/constants';
import { isValidSearchQuery } from '@/lib/validation';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Type-ahead search endpoint.
 *
 * This exists instead of calling the server action straight from the client.
 * Server actions are POSTs: uncacheable by the browser and any CDN in front of
 * the app, and they are dispatched through the router rather than as plain
 * fetches, so an in-flight one cannot be cancelled when the user keeps typing.
 * A GET lets us set Cache-Control (a typist revisits the same prefixes
 * constantly, and different users search the same famous producers) and lets
 * the client abort superseded requests.
 */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') ?? '';
  const limitParam = Number(request.nextUrl.searchParams.get('limit'));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : WINE_SEARCH_LIMIT;

  if (!isValidSearchQuery(query)) {
    return NextResponse.json({ results: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const results = await searchWines(query, limit);
    return NextResponse.json(
      { results },
      {
        headers: {
          // Results change only when the wine catalogue is re-imported.
          'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600'
        }
      }
    );
  } catch (error) {
    console.error('[api/wine-search] failed', error);
    return NextResponse.json(
      { results: [], error: 'search_failed' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
