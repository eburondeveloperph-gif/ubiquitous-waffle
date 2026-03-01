-- User assistants: one VAPI assistant per user (unique reference).
-- Run this in Supabase SQL Editor or via Supabase CLI.

create table if not exists public.user_assistants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  assistant_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS: users can only see and manage their own row.
alter table public.user_assistants enable row level security;

create policy "Users can select own user_assistants"
  on public.user_assistants for select
  using (auth.uid() = user_id);

create policy "Users can insert own user_assistants"
  on public.user_assistants for insert
  with check (auth.uid() = user_id);

create policy "Users can update own user_assistants"
  on public.user_assistants for update
  using (auth.uid() = user_id);

create policy "Users can delete own user_assistants"
  on public.user_assistants for delete
  using (auth.uid() = user_id);
