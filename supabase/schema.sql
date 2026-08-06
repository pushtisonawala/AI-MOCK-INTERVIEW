-- AI Mock Interview — Supabase schema
-- Run this in your Supabase project's SQL Editor (Project → SQL Editor → New query).
-- Safe to re-run: every statement below is idempotent.

create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  company text,
  difficulty text not null,
  setup jsonb not null,
  transcript jsonb not null,
  feedback jsonb,
  tailored_resume jsonb,
  overall_score int,
  -- Shareable read-only link support
  share_token text unique,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

-- If the table already existed from an earlier version of this schema, add the new
-- sharing columns without dropping any data.
alter table public.interviews add column if not exists share_token text unique;
alter table public.interviews add column if not exists is_public boolean not null default false;

create index if not exists interviews_user_created_idx on public.interviews (user_id, created_at desc);
create index if not exists interviews_share_token_idx on public.interviews (share_token) where share_token is not null;

alter table public.interviews enable row level security;

-- Owners can fully manage their own rows.
drop policy if exists "interviews_select_own" on public.interviews;
create policy "interviews_select_own"
  on public.interviews for select
  using (auth.uid() = user_id);

drop policy if exists "interviews_insert_own" on public.interviews;
create policy "interviews_insert_own"
  on public.interviews for insert
  with check (auth.uid() = user_id);

drop policy if exists "interviews_update_own" on public.interviews;
create policy "interviews_update_own"
  on public.interviews for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "interviews_delete_own" on public.interviews;
create policy "interviews_delete_own"
  on public.interviews for delete
  using (auth.uid() = user_id);

-- Anyone (including signed-out visitors) can read a row that the owner has explicitly
-- marked public via a share link — but only the columns the app selects, and only while
-- is_public stays true. Row ownership/auth is unaffected; this is purely additive.
drop policy if exists "interviews_select_public" on public.interviews;
create policy "interviews_select_public"
  on public.interviews for select
  using (is_public = true);
