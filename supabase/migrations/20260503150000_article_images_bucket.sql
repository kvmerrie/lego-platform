insert into storage.buckets (id, name, public)
values ('article-images', 'article-images', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Public can read article images" on storage.objects;

create policy "Public can read article images"
  on storage.objects
  for select
  using (bucket_id = 'article-images');

drop policy if exists "Only service role can manage article images" on storage.objects;

create policy "Only service role can manage article images"
  on storage.objects
  for all
  using (
    bucket_id = 'article-images'
    and auth.role() = 'service_role'
  )
  with check (
    bucket_id = 'article-images'
    and auth.role() = 'service_role'
  );
