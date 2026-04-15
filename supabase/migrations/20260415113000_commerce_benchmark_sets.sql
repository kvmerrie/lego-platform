create table if not exists public.commerce_benchmark_sets (
  set_id text primary key,
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists commerce_benchmark_sets_created_at_idx
on public.commerce_benchmark_sets (created_at);

drop trigger if exists set_commerce_benchmark_sets_updated_at on public.commerce_benchmark_sets;
create trigger set_commerce_benchmark_sets_updated_at
before update on public.commerce_benchmark_sets
for each row
execute function public.set_updated_at();

alter table public.commerce_benchmark_sets enable row level security;
