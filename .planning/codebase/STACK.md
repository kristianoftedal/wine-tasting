# Technology Stack

**Analysis Date:** 2026-02-02

## Languages

**Primary:**
- TypeScript 5.x - Type-safe frontend and backend code
- JavaScript (Node.js) - Build and runtime environment

**Secondary:**
- JSX/TSX - React component syntax

## Runtime

**Environment:**
- Node.js 22.x - JavaScript runtime

**Package Manager:**
- npm - Dependency management
- Lockfile: `package-lock.json` (expected but not explicitly checked)

## Frameworks

**Core:**
- Next.js 16.1.6 - React meta-framework with App Router, API routes, and SSR/SSG
- React 19.2.1 - UI library
- React DOM 19.2.1 - React rendering for the browser

**State Management:**
- Jotai 2.15.1 - Primitive atom-based state management for React

**AI/ML:**
- @ai-sdk/openai 2.0.76 - OpenAI integration via Vercel AI SDK
- @ai-sdk/react 2.0.106 - React hooks for AI interactions (useChat)
- ai 5.0.106 - Vercel AI SDK core library with streaming and embedding support
- @xenova/transformers 2.17.2 - Local ML model runner (Xenova all-MiniLM-L6-v2 for embeddings)

**UI Components:**
- @radix-ui/react-dialog 1.1.4 - Accessible dialog/modal component
- @radix-ui/react-accordion 1.2.12 - Accessible accordion component
- @radix-ui/react-tabs 1.1.13 - Accessible tabs component
- @radix-ui/react-separator 1.1.8 - Visual separator component
- @radix-ui/react-slot 1.1.1 - Radix slot composition utility
- lucide-react 0.454.0 - Icon library

**Forms & Input:**
- react-hook-form 7.66.1 - Lightweight form state management and validation

**Database:**
- @supabase/supabase-js 2.84.0 - Supabase JS client for database and auth
- @supabase/ssr 0.7.0 - Supabase Server-Side Rendering utilities for Next.js

**Utilities:**
- date-fns 4.1.0 - Date manipulation and formatting
- react-markdown 10.1.0 - Render markdown as React components
- react-resizable-panels 2.1.9 - Resizable panel UI components
- react-hot-toast 2.6.0 - Toast notification system
- he 1.2.0 - HTML entity encoder/decoder

**Babel:**
- @babel/core 7.28.5 - JavaScript compiler core
- @babel/template 7.27.2 - Babel template utility

**PostCSS:**
- postcss 8.5.6 - CSS transformations and bundling

## Key Dependencies

**Critical:**
- @ai-sdk/openai - Provides GPT-4 integration for wine sommelier chatbot and embeddings
- @supabase/supabase-js - Core database, authentication, and real-time features
- @xenova/transformers - Local semantic similarity computation without external API calls

**Infrastructure:**
- @supabase/ssr - Handles Supabase session management in Server Components
- jotai - State management for multi-step tasting wizard UI state

## Configuration

**Environment:**
Environment variables configure external services (Supabase, OpenAI, Vercel):

**Public (client-side safe):**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key for client
- `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` - OAuth redirect URL (dev)
- `NEXT_PUBLIC_VERCEL_URL` - Vercel deployment URL (auto-set)

**Secret (server-side only):**
- `OPENAI_API_KEY` - OpenAI API key for embeddings and chat completions
- `SUPABASE_URL` - Supabase project URL (server-side backup)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key for privileged operations
- `VERCEL_URL` - Current deployment URL
- `AI_GATEWAY_API_KEY` - Optional AI gateway key for managed inference

**Build:**
- `tsconfig.json` - TypeScript configuration with strict type checking disabled (`strict: false`), ES2017 target, App Router plugin
- `next.config.ts` - Next.js configuration with:
  - Build error ignoring for TypeScript
  - Unoptimized images (for development flexibility)
  - SWC Jotai debug label and refresh plugins for better DX
- `.eslintrc.json` - ESLint configuration extending Next.js, TypeScript, and Prettier rules
- `.prettierrc` - Code formatting with 2-space indentation, no trailing commas, single quotes

## Platform Requirements

**Development:**
- Node.js 22.x
- npm for dependency management
- Next.js dev server on port 3000 (by default)
- Modern browser with ES2017 support

**Production:**
- Deployment target: Vercel (primary), self-hosted Next.js server (alternative)
- Environment variables required for Supabase and OpenAI
- maxDuration: 30 seconds for API routes (configured in `src/app/api/sommailer/route.ts`)

---

*Stack analysis: 2026-02-02*
