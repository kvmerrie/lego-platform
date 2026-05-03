create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  mdx text not null,
  frontmatter jsonb not null default '{}'::jsonb,
  status text not null default 'published' check (status = 'published'),
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.articles
  add column if not exists published_at timestamptz;

update public.articles
set published_at = coalesce(published_at, created_at, now())
where published_at is null;

alter table public.articles
  alter column published_at set default now(),
  alter column published_at set not null;

create index if not exists articles_status_article_date_idx
  on public.articles (status, ((frontmatter ->> 'date')) desc);

alter table public.articles enable row level security;

drop policy if exists "Published articles are publicly readable" on public.articles;

create policy "Published articles are publicly readable"
  on public.articles
  for select
  using (status = 'published');

drop policy if exists "Only service role can insert" on public.articles;

create policy "Only service role can insert"
  on public.articles
  for insert
  with check (auth.role() = 'service_role');

create or replace function public.set_articles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_articles_updated_at on public.articles;

create trigger set_articles_updated_at
  before update on public.articles
  for each row
  execute function public.set_articles_updated_at();
