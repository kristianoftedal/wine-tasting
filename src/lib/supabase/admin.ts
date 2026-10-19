import 'server-only';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client — bypasses RLS.
 *
 * The cookie-aware factory in ./server.ts carries the caller's session, which
 * is right for everything a user does. Batch maintenance has no session: the
 * note-enrichment routine is authenticated by a bearer token and writes to
 * `wines`, whose UPDATE policy requires auth.uid(). Hence this.
 *
 * Only import from server-only maintenance code. Anything reachable from a
 * user request must use ./server.ts so RLS still applies.
 *
 * Returns null when the service-role key is absent rather than throwing, so a
 * deployment without the key degrades to a clear 503 instead of a stack trace.
 */
export function createAdminClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) return null;

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
