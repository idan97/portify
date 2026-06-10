-- Single schemaless records table: every app entity (AssetClass, Instrument,
-- Holding, ManualAsset, ManualAssetValue) is a row whose fields live in `data`.
-- RLS scopes all rows to their owner.
create table public.records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entity text not null,
  data jsonb not null default '{}'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create index records_user_entity_idx on public.records (user_id, entity);
create index records_created_date_idx on public.records (created_date desc);

alter table public.records enable row level security;

create policy "Users manage own records"
  on public.records
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
