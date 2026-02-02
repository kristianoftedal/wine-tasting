# External Integrations

**Analysis Date:** 2026-02-02

## APIs & External Services

**OpenAI:**
- Service: OpenAI GPT API for embeddings and chat completions
  - SDK/Client: `@ai-sdk/openai` (Vercel AI SDK)
  - Auth: `OPENAI_API_KEY` (server-side secret)
  - Models:
    - `gpt-4o-mini` - Wine sommelier chatbot (`src/app/api/sommailer/route.ts`)
    - `text-embedding-3-small` - Text embeddings for semantic search (both endpoints)
  - Usage: Wine recommendations, semantic similarity search, context enrichment

**Vinmonopolet (Norwegian Wine Store):**
- Service: Wine product image and data source
  - URL: `https://bilder.vinmonopolet.no/cache/{size}/{productId}-1.jpg`
  - Auth: None (public, with Referer header spoofing in `src/app/api/wine-image/[productId]/route.ts`)
  - Usage: Wine product images proxied through `/api/wine-image/[productId]` with caching

## Data Storage

**Databases:**
- PostgreSQL (via Supabase)
  - Connection: `NEXT_PUBLIC_SUPABASE_URL` (public), `SUPABASE_URL` (server-side)
  - Client: `@supabase/supabase-js` for frontend, `@supabase/ssr` for SSR
  - Auth:
    - Client: `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anonymous, row-level security enforced)
    - Server: `SUPABASE_SERVICE_ROLE_KEY` (full admin access, server-only)
  - Features Used:
    - Database queries and mutations
    - Real-time subscriptions via WebSocket
    - Row-level security (RLS) for user data isolation
    - Custom SQL functions: `match_wines()`, `match_wine_articles()` (vector similarity search)

**File Storage:**
- Vinmonopolet images proxied via `/api/wine-image/[productId]` route
- No persistent file storage in application (images are external)

**Caching:**
- HTTP Cache-Control headers on image proxy: `public, max-age=86400` (24 hours)
- In-memory model cache for Transformers.js: `src/lib/localSemanticSimilarity.ts` line 5

## Authentication & Identity

**Auth Provider:**
- Supabase Auth
  - Implementation: Email/password authentication via Supabase
  - SSR Setup: `src/lib/supabase/server.ts` with cookie management
  - Client Setup: `src/lib/supabase/client.ts` with singleton pattern
  - OAuth redirect: `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`
  - Session persistence via cookies (handled by `@supabase/ssr`)

## Monitoring & Observability

**Error Tracking:**
- None detected - console.error logging used throughout

**Logs:**
- Browser console (client-side)
- Server console (Node.js stdout)
- Sentry not integrated

## CI/CD & Deployment

**Hosting:**
- Vercel (primary) - Detected via `VERCEL_URL` and `NEXT_PUBLIC_VERCEL_URL` environment variables
- Self-hosted Node.js server (alternative via `npm start` and `next start`)

**CI Pipeline:**
- Not detected - No GitHub Actions, GitLab CI, or other CI config files found

## Environment Configuration

**Required env vars for development:**
- `NEXT_PUBLIC_SUPABASE_URL` - e.g., `https://ocjatvqejudmvpbnbttd.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous API key
- `OPENAI_API_KEY` - For `/api/embeddings` and `/api/sommailer` endpoints
- `SUPABASE_URL` - Server-side Supabase URL (can be same as public)
- `SUPABASE_SERVICE_ROLE_KEY` - Server-side admin key for privileged operations

**Optional env vars:**
- `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` - OAuth callback URL (defaults to origin)
- `NEXT_PUBLIC_VERCEL_URL` - Vercel deployment URL
- `VERCEL_URL` - Auto-set by Vercel in production
- `AI_GATEWAY_API_KEY` - For managed inference (optional, fallback to local embeddings)

**Secrets location:**
- `.env.local` - Local development secrets (not committed)
- `.env` - Public configuration (committed, keys redacted in actual use)
- Vercel Environment Variables dashboard (production)

## Webhooks & Callbacks

**Incoming:**
- `/api/sommailer` (POST) - Chat API endpoint for wine sommelier
- `/api/embeddings` (POST) - Embedding generation endpoint

**Outgoing:**
- None detected - No external webhook triggers

## Real-time Features

**Supabase Real-time Subscriptions:**
- Used in `src/app/arrangement/[eventId]/resultater/event-scores-realtime.tsx`
- WebSocket connection for live score updates during tasting events

## API Rate Limiting

**OpenAI:**
- No explicit rate limiting in code
- Relies on OpenAI account limits

**Supabase:**
- No explicit rate limiting in code
- Supabase project tier determines limits

## Error Handling Strategy

**Embeddings endpoint** (`src/app/api/embeddings/route.ts`):
- Retry logic with exponential backoff (3 attempts max: 1s, 2s, 4s)
- Catches OpenAI timeouts and network errors

**Sommelier endpoint** (`src/app/api/sommailer/route.ts`):
- Graceful fallback when articles/wines not found
- Returns empty arrays if embedding search fails
- AI responses degrade gracefully without product context

**Supabase client initialization:**
- `src/lib/supabase/client.ts` throws error if env vars missing
- `src/lib/supabase/server.ts` returns null safely if env vars missing

---

*Integration audit: 2026-02-02*
