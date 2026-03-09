# Life OS — Project Context

## Stack
Next.js 14, TypeScript, Tailwind, shadcn/ui, Supabase, Recharts

## Key conventions
- All Supabase tables have RLS enabled — always
- user_id column on every table, FK to auth.users
- Components in /components, pages in /app, DB queries in /lib/supabase
- Use Zod for all validation
- Use Vercel AI SDK for Claude + Gemini calls

## Current phase
P0 — Foundation (auth, app shell, DB schema, deployment)

## Database
See /docs/schema.md for full table reference

## Environment variables (must be set in Vercel)
- `SUPABASE_SERVICE_ROLE_KEY` — used by cron endpoint (`/api/cron/daily-digest`) to bypass RLS
- `CRON_SECRET` — random secret; Vercel sends it as `Authorization: Bearer <secret>` header
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` — web push VAPID keys
  Generate at https://web-push-codelab.glitch.me/

## Don't do
- Never hardcode user IDs
- Never disable RLS
- Never commit .env files
- Never use `createServiceClient()` in browser-side code — service role bypasses all RLS
