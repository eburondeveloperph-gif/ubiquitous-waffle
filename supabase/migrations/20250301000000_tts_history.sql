-- TTS History: per-user storage for generated TTS (text + audio path).
-- Run this in Supabase SQL Editor or via Supabase CLI.

-- Table for TTS history records (metadata; audio is in Storage).
create table if not exists public.tts_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  voice_id text not null,
  voice_name text not null,
  audio_path text not null,
  created_at timestamptz not null default now()
);

-- RLS: users can only see and manage their own rows.
alter table public.tts_history enable row level security;

create policy "Users can select own tts_history"
  on public.tts_history for select
  using (auth.uid() = user_id);

create policy "Users can insert own tts_history"
  on public.tts_history for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own tts_history"
  on public.tts_history for delete
  using (auth.uid() = user_id);

-- Storage bucket for TTS audio files (private; paths like user_id/filename.mp3).
insert into storage.buckets (id, name, public)
values ('tts-audio', 'tts-audio', false)
on conflict (id) do nothing;

-- Storage RLS: users can read/insert/delete only under their own folder.
create policy "Users can read own tts-audio"
  on storage.objects for select
  using (bucket_id = 'tts-audio' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can insert own tts-audio"
  on storage.objects for insert
  with check (bucket_id = 'tts-audio' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete own tts-audio"
  on storage.objects for delete
  using (bucket_id = 'tts-audio' and (storage.foldername(name))[1] = auth.uid()::text);
