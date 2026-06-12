create table if not exists public.commerce_merchant_page_snapshots (
  merchant_id uuid not null references public.commerce_merchants(id) on delete cascade,
  merchant_slug text not null,
  merchant_name text not null,
  snapshot jsonb not null,
  generated_at timestamptz not null default timezone('utc', now()),
  source_version text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (merchant_slug)
);

create index if not exists commerce_merchant_page_snapshots_generated_idx
on public.commerce_merchant_page_snapshots (generated_at desc);

create index if not exists commerce_merchant_page_snapshots_merchant_id_idx
on public.commerce_merchant_page_snapshots (merchant_id);

drop trigger if exists set_commerce_merchant_page_snapshots_updated_at
on public.commerce_merchant_page_snapshots;
create trigger set_commerce_merchant_page_snapshots_updated_at
before update on public.commerce_merchant_page_snapshots
for each row
execute function public.set_updated_at();

alter table public.commerce_merchant_page_snapshots enable row level security;

drop policy if exists "commerce_merchant_page_snapshots_select_public"
on public.commerce_merchant_page_snapshots;
create policy "commerce_merchant_page_snapshots_select_public"
on public.commerce_merchant_page_snapshots
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.commerce_merchants
    where commerce_merchants.id = commerce_merchant_page_snapshots.merchant_id
      and commerce_merchants.slug = commerce_merchant_page_snapshots.merchant_slug
      and commerce_merchants.is_active = true
  )
);

drop policy if exists "commerce_merchant_page_snapshots_service_role_all"
on public.commerce_merchant_page_snapshots;
create policy "commerce_merchant_page_snapshots_service_role_all"
on public.commerce_merchant_page_snapshots
for all
to service_role
using (true)
with check (true);
