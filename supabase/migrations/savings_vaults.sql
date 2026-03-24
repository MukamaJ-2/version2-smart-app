-- Run this in the Supabase SQL editor to create the savings_vaults table

create table if not exists public.savings_vaults (
  id           text        primary key,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  name         text        not null,
  amount       numeric     not null default 0,
  lock_days    integer     not null default 30,
  created_at   timestamptz not null default now(),
  unlock_date  timestamptz not null,
  status       text        not null default 'locked' check (status in ('locked', 'unlocked', 'broken')),
  interest_rate numeric    not null default 0.08
);

-- Row Level Security
alter table public.savings_vaults enable row level security;

create policy "Users can manage their own vaults"
  on public.savings_vaults
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for fast lookups
create index if not exists savings_vaults_user_id_idx on public.savings_vaults(user_id);
