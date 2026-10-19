'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * Editorial review of generated wine notes.
 *
 * Approving a note promotes it from a draft to reference data the scoring
 * engine is allowed to grade people against, so it is a deliberate human act
 * and never something the pipeline does for itself (see src/lib/noteEnrichment.ts).
 *
 * These run under the caller's session rather than the service-role client used
 * by the batch route: RLS already requires an authenticated user to update
 * `wines`, and review is a normal logged-in action, not a maintenance job.
 */

/**
 * Who may review. There is no role column on `profiles`, so the allowlist lives
 * in the environment — deliberately fail-closed: an unset variable means nobody
 * can approve, rather than everybody.
 */
function adminEmails(): string[] {
  return (process.env.NOTE_REVIEW_ADMINS ?? '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);
}

export type ReviewResult = { ok: true; error?: never } | { ok: false; error: string };

/**
 * Resolve the caller and confirm they may review. Every action re-checks: the
 * page already hides the buttons, but a hidden button is not authorisation.
 */
async function requireReviewer() {
  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase er ikke konfigurert' } as const;

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.email) return { error: 'Du må være innlogget' } as const;

  const allowed = adminEmails();
  if (allowed.length === 0) return { error: 'NOTE_REVIEW_ADMINS er ikke satt' } as const;
  if (!allowed.includes(user.email.toLowerCase()))
    return { error: 'Du har ikke tilgang til notatgodkjenning' } as const;

  return { supabase, user } as const;
}

export async function canReviewNotes(): Promise<boolean> {
  const result = await requireReviewer();
  return !('error' in result);
}

async function setStatus(wineId: string, status: 'approved' | 'rejected'): Promise<ReviewResult> {
  const result = await requireReviewer();
  if ('error' in result) return { ok: false, error: result.error };

  const { supabase, user } = result;

  // Only a pending row may be decided. Without this, a double-submitted form or
  // a stale tab could flip an already-approved note back, and the audit trail
  // would show the second reviewer as the only one who ever touched it.
  const { data, error } = await supabase
    .from('wines')
    .update({
      enrichment_status: status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id
    })
    .eq('id', wineId)
    .eq('enrichment_status', 'pending')
    .select('id');

  if (error) {
    console.error('[note-review] update failed', { wineId, status, error });
    return { ok: false, error: 'Kunne ikke lagre avgjørelsen' };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: 'Notatet er allerede behandlet' };
  }

  revalidatePath('/admin/notater');
  return { ok: true };
}

export async function approveNote(wineId: string): Promise<ReviewResult> {
  return setStatus(wineId, 'approved');
}

export async function rejectNote(wineId: string): Promise<ReviewResult> {
  return setStatus(wineId, 'rejected');
}
