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

## Don't do
- Never hardcode user IDs
- Never disable RLS
- Never commit .env files
