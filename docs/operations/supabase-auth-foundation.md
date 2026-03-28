# Supabase Auth Foundation

This document describes the current Supabase foundation for real auth and owned or wanted persistence. The repo now has the first browser and API wiring in place, while the sign-in UX still remains intentionally minimal.

## Current Intent

- Supabase Auth will become the real auth provider.
- Supabase Postgres will become the persistence layer for collector profile and owned or wanted state.
- `apps/api` remains the BFF, auth-verification boundary, and persistence boundary.
- `apps/web` remains static-friendly. Catalog and set-detail routes do not become auth-dependent at render time.
- The current `/api/v1` route shapes remain the long-term contract.
- Browser clients attach `Authorization: Bearer <token>` when a Supabase session exists.
- `GET /api/v1/session` returns an anonymous session when there is no valid bearer token.
- Owned or wanted mutations now require a valid bearer token and return `401` otherwise.

## Required Environment Variables

Browser-safe variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Server-only variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Notes:

- `SUPABASE_URL` may match `NEXT_PUBLIC_SUPABASE_URL`, but it is configured separately so server environments can stay explicit.
- `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to browser code, client bundles, or public docs.

## Local Setup

1. Create a Supabase project for the repo.
2. Copy the project URL into:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_URL`
3. Copy the public anon key into:
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Copy the service-role key into:
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Apply the SQL migration in `supabase/migrations/20260328223000_initial_auth_foundation.sql`.

This repo does not currently enforce a root `.env` convention. Keep local credentials in your normal untracked shell or environment-file workflow.

## Schema

The initial schema introduces:

- `public.profiles`
- `public.user_set_statuses`

Design intent:

- `profiles` stores product-facing collector identity defaults and future editable profile fields.
- `user_set_statuses` stores owned and wanted booleans in one row per `user_id + set_id`.
- owned and wanted remain independent booleans.
- repository code may later delete rows when both booleans are false.

## Safety Rules

- Do not use `SUPABASE_SERVICE_ROLE_KEY` in browser code.
- Do not let browser clients write directly to Postgres in this product slice.
- Keep runtime writes behind `apps/api`.
- Keep `collector.id` product-facing. It must not be repurposed as the raw Supabase user UUID.
- Keep unauthenticated behavior graceful: anonymous session reads may continue, but writes must stay protected.

## Current Repo Surface

- `libs/shared/data-access-auth`
  Browser-only Supabase client utilities.
- `libs/shared/data-access-auth-server`
  Server-only token verification helpers and admin-client access.
- `libs/user/data-access-server`
  Profile repository, user set status repository, and session assembly service.

The current UI and web routes remain unchanged. The `/api/v1` handlers now use Supabase-backed repositories, while the sign-in UX and richer profile management still wait for the next phase.
