import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import {
  auditNoteQuality,
  eventWineIds,
  NoteEnrichmentError,
  runEnrichmentBatch,
  SERVERLESS_BATCH_SIZE,
  upcomingEventWineIds,
  type BatchOptions,
  type BatchResult,
  type NoteQualityAudit,
  type ScanOptions
} from '@/lib/noteEnrichment';

/**
 * Server-side entry points for wine-note enrichment.
 *
 * The pipeline itself is in src/lib/noteEnrichment.ts so the offline script can
 * run the same code. This module's only job is to supply the one thing the
 * library refuses to construct for itself: a service-role Supabase client.
 *
 * Not a 'use server' module — that would restrict the file to async function
 * exports, and it re-exports NoteEnrichmentError. `server-only` gives the same
 * guarantee that it can never reach a client bundle; the caller is the route
 * handler at src/app/api/admin/note-enrichment/route.ts.
 */

export { NoteEnrichmentError, DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE, SERVERLESS_BATCH_SIZE } from '@/lib/noteEnrichment';
export type {
  BatchItemResult,
  BatchOptions,
  BatchResult,
  EnrichmentCandidate,
  EnrichmentOutcome,
  NoteQualityAudit,
  ScanOptions
} from '@/lib/noteEnrichment';

function requireAdminClient() {
  const supabase = createAdminClient();
  if (!supabase) {
    throw new NoteEnrichmentError('SUPABASE_SERVICE_ROLE_KEY is not configured', 'not_configured');
  }
  return supabase;
}

/** Measure every reference note in the catalogue. No LLM calls, no writes. */
export async function auditNotes(options: ScanOptions & { candidateLimit?: number } = {}): Promise<NoteQualityAudit> {
  return auditNoteQuality(requireAdminClient(), options);
}

/** Research and rewrite the worst notes. Dry run unless options.dryRun is false. */
export async function enrichNotes(options: BatchOptions = {}): Promise<BatchResult> {
  return runEnrichmentBatch(requireAdminClient(), options);
}

/**
 * Enrich the notes for the wines attached to one event.
 *
 * Called when an event is created, because that is the moment the database
 * first learns which bottles will actually be poured — and it happens days or
 * weeks before anyone tastes them, which is the lead time both the research
 * (~8s per wine) and the human review in /admin/notater need.
 *
 * Writes by default: a note sitting in `pending` is still inert until a
 * reviewer approves it, so there is nothing here for a dry run to protect.
 */
export async function enrichEventNotes(eventId: string, options: BatchOptions = {}): Promise<BatchResult> {
  const supabase = requireAdminClient();
  const wineIds = await eventWineIds(supabase, eventId);

  // SERVERLESS_BATCH_SIZE, not MAX_BATCH_SIZE: this runs in an after() callback
  // bounded by the platform's function timeout. The cap counts wines needing
  // enrichment rather than bottles, so it does not bind on a normal tasting;
  // anything over it falls to the sweep instead of being cut off mid-run.
  return runEnrichmentBatch(supabase, { limit: SERVERLESS_BATCH_SIZE, dryRun: false, ...options, wineIds });
}

/**
 * Sweep every wine in every event that has not happened yet.
 *
 * The backstop. Event creation triggers enrichment directly, but that runs in
 * an `after()` callback the platform may cut short, and wines added to an
 * existing event are saved from the client with no server action to hook. A
 * periodic sweep makes both of those a delay rather than a miss.
 */
export async function enrichUpcomingEventNotes(options: BatchOptions = {}): Promise<BatchResult> {
  const supabase = requireAdminClient();
  const wineIds = await upcomingEventWineIds(supabase);

  return runEnrichmentBatch(supabase, { limit: SERVERLESS_BATCH_SIZE, ...options, wineIds });
}
