import { NextResponse } from 'next/server';
import {
  auditNotes,
  DEFAULT_BATCH_SIZE,
  enrichNotes,
  enrichUpcomingEventNotes,
  MAX_BATCH_SIZE,
  NoteEnrichmentError
} from '@/actions/note-enrichment';

/**
 * Maintenance endpoint for wine-note enrichment.
 *
 *   GET  — audit only. Measures every reference note in the catalogue and
 *          reports how many are too vague to grade a taster against. No LLM
 *          calls, no writes.
 *   POST — run a batch. `{"scope":"events"}` enriches the wines in upcoming
 *          events, which is the scope worth scheduling; the default sweeps the
 *          catalogue by worst note. Dry run unless the body says otherwise.
 *
 * Not a server action: this is an operator tool driven by curl, a cron job or
 * a one-off deploy hook, and it must be callable without a browser session.
 * That also means it cannot rely on Supabase auth, so it is gated on a shared
 * bearer token and runs against the service role.
 *
 * Both verbs are uncached — an audit whose numbers are minutes stale would be
 * read as "the last run did nothing".
 */

export const runtime = 'nodejs';
/** A batch of 10 is 20 LLM calls, one per wine with web search. */
export const maxDuration = 300;

const NO_STORE = { 'Cache-Control': 'no-store' };

function authorize(request: Request): NextResponse | null {
  const expected = process.env.NOTE_ENRICHMENT_TOKEN;

  if (!expected) {
    return NextResponse.json(
      { error: 'not_configured', detail: 'NOTE_ENRICHMENT_TOKEN is not set' },
      { status: 503, headers: NO_STORE }
    );
  }

  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (provided !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });
  }

  return null;
}

function handleError(error: unknown): NextResponse {
  if (error instanceof NoteEnrichmentError) {
    console.error('[note-enrichment]', error.code, error.message);
    const status = error.code === 'not_configured' ? 503 : 500;
    return NextResponse.json({ error: error.code, detail: error.message }, { status, headers: NO_STORE });
  }

  console.error('[note-enrichment] unexpected failure', error);
  return NextResponse.json({ error: 'internal_error' }, { status: 500, headers: NO_STORE });
}

export async function GET(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const candidateLimit = Math.min(Number(url.searchParams.get('candidates') ?? 25) || 25, 200);

  try {
    const audit = await auditNotes({
      category: url.searchParams.get('category') ?? undefined,
      minPriority: url.searchParams.has('minPriority') ? Number(url.searchParams.get('minPriority')) : undefined,
      includeAttempted: url.searchParams.get('includeAttempted') === 'true',
      candidateLimit
    });

    return NextResponse.json(audit, { headers: NO_STORE });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;

  let body: Record<string, unknown> = {};
  if (request.headers.get('content-type')?.includes('application/json')) {
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers: NO_STORE });
    }
  }

  const limit = Number(body.limit ?? DEFAULT_BATCH_SIZE);
  if (!Number.isFinite(limit) || limit < 1 || limit > MAX_BATCH_SIZE) {
    return NextResponse.json(
      { error: 'invalid_limit', detail: `limit must be 1-${MAX_BATCH_SIZE}` },
      { status: 400, headers: NO_STORE }
    );
  }

  const productIds = Array.isArray(body.productIds) ? body.productIds.map(String) : undefined;

  // "events" is the scope worth scheduling. Event creation already triggers
  // enrichment for its own wines, but that runs in an after() callback the
  // platform may cut short, and wines added later are saved from the client
  // with no server action to hook — so a periodic sweep turns both of those
  // into a delay rather than a miss. "catalogue" sweeps by worst note, which
  // on the live data means wines no user has ever touched.
  const scope = body.scope === 'events' ? 'events' : 'catalogue';

  try {
    const options = {
      limit,
      // Writing is opt-in. A caller that forgets the flag gets a preview, not
      // 50 rewritten reference notes.
      dryRun: body.dryRun !== false,
      category: typeof body.category === 'string' ? body.category : undefined,
      minPriority: typeof body.minPriority === 'number' ? body.minPriority : undefined,
      includeAttempted: body.includeAttempted === true,
      requireSources: body.requireSources !== false,
      productIds
    };

    const result = scope === 'events' ? await enrichUpcomingEventNotes(options) : await enrichNotes(options);

    return NextResponse.json({ scope, ...result }, { headers: NO_STORE });
  } catch (error) {
    return handleError(error);
  }
}
