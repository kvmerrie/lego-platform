create table if not exists public.editorial_feed_items (
  id uuid primary key default gen_random_uuid(),
  source_url text not null unique,
  title text not null,
  feed_name text not null,
  event_fingerprint text,
  source_published_at timestamptz,
  status text not null default 'new' check (status in ('new', 'drafted', 'ignored', 'low_value', 'published')),
  article_slug text,
  draft_mdx text,
  draft_frontmatter jsonb,
  drafted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists editorial_feed_items_event_fingerprint_idx
  on public.editorial_feed_items (event_fingerprint)
  where event_fingerprint is not null;

create index if not exists editorial_feed_items_status_created_at_idx
  on public.editorial_feed_items (status, created_at desc);

alter table public.editorial_feed_items enable row level security;

drop policy if exists "Only service role can manage editorial feed items" on public.editorial_feed_items;

create policy "Only service role can manage editorial feed items"
  on public.editorial_feed_items
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function public.set_editorial_feed_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_editorial_feed_items_updated_at on public.editorial_feed_items;

create trigger set_editorial_feed_items_updated_at
  before update on public.editorial_feed_items
  for each row
  execute function public.set_editorial_feed_items_updated_at();
