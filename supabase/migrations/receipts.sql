-- Receipts table for scanned receipt history (Receipt Scanner + Receipt History)
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant text not null default '',
  total_amount numeric not null default 0,
  date date not null default current_date,
  category text not null default 'Other',
  items jsonb not null default '[]',
  image_url text,
  created_at timestamptz not null default now()
);

alter table public.receipts enable row level security;

create policy "Users can manage their own receipts"
  on public.receipts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists receipts_user_id_idx on public.receipts(user_id);
create index if not exists receipts_date_idx on public.receipts(date);
