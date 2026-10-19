import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

// Not `ReturnType<typeof createBrowserClient>`: that erases the generics to `any`,
// so typed calls like `.single<Event>()` fail to compile.
let client: SupabaseClient | null = null

export function createClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables. Please check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    )
  }

  if (client) return client

  client = createBrowserClient(supabaseUrl, supabaseAnonKey)
  return client
}
