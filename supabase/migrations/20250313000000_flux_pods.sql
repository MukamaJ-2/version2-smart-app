-- Budget Ports (flux_pods) - run if table doesn't exist
create table if not exists public.flux_pods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  allocated numeric not null default 0,
  spent numeric not null default 0,
  status text not null default 'healthy' check (status in ('healthy', 'warning', 'critical')),
  velocity numeric not null default 0,
  children jsonb,
  created_at timestamptz not null default now()
);

alter table public.flux_pods enable row level security;

create policy "Users can manage their own flux_pods"
  on public.flux_pods
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists flux_pods_user_id_idx on public.flux_pods(user_id);
