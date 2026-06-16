-- Room-by-room checklist completion state per user
create table if not exists public.checklist_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  room text not null,
  item_key text not null,
  completed_at timestamptz not null default now(),
  unique(user_id, room, item_key)
);

alter table public.checklist_completions enable row level security;

create policy "Users manage own checklist completions"
  on public.checklist_completions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
