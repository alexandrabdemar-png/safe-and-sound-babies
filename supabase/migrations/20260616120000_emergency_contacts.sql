-- Emergency contacts per user
create table if not exists public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text not null,
  relationship text,
  created_at timestamptz not null default now()
);

alter table public.emergency_contacts enable row level security;

create policy "Users manage own emergency contacts"
  on public.emergency_contacts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
