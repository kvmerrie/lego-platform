create table if not exists public.article_previews (
  id uuid primary key default gen_random_uuid(),
  mdx text not null,
  frontmatter jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.article_previews enable row level security;

drop policy if exists "Only service role can select article previews" on public.article_previews;
create policy "Only service role can select article previews"
on public.article_previews
for select
using (auth.role() = 'service_role');

drop policy if exists "Only service role can insert article previews" on public.article_previews;
create policy "Only service role can insert article previews"
on public.article_previews
for insert
with check (auth.role() = 'service_role');

drop policy if exists "Only service role can update article previews" on public.article_previews;
create policy "Only service role can update article previews"
on public.article_previews
for update
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Only service role can delete article previews" on public.article_previews;
create policy "Only service role can delete article previews"
on public.article_previews
for delete
using (auth.role() = 'service_role');

create index if not exists article_previews_expires_at_idx
on public.article_previews (expires_at);
