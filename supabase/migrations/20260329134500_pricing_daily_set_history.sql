create table if not exists public.pricing_daily_set_history (
  set_id text not null,
  region_code text not null,
  currency_code text not null,
  condition text not null,
  headline_price_minor integer not null check (headline_price_minor > 0),
  reference_price_minor integer null check (reference_price_minor > 0),
  lowest_merchant_id text null,
  observed_at timestamptz not null,
  recorded_on date not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (set_id, region_code, currency_code, condition, recorded_on)
);

create index if not exists pricing_daily_set_history_set_id_recorded_on_idx
on public.pricing_daily_set_history (set_id, recorded_on desc);

drop trigger if exists set_pricing_daily_set_history_updated_at on public.pricing_daily_set_history;
create trigger set_pricing_daily_set_history_updated_at
before update on public.pricing_daily_set_history
for each row
execute function public.set_updated_at();

alter table public.pricing_daily_set_history enable row level security;

create policy "pricing_daily_set_history_select_public"
on public.pricing_daily_set_history
for select
to anon, authenticated
using (
  region_code = 'NL' and
  currency_code = 'EUR' and
  condition = 'new'
);
