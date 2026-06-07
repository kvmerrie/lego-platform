create table if not exists public.catalog_set_images (
  id uuid primary key default gen_random_uuid(),
  set_id text not null references public.catalog_sets(set_id) on delete cascade,
  source text not null check (source in ('rebrickable', 'brickset', 'manual')),
  source_url text not null,
  image_type text not null check (image_type in ('hero', 'gallery', 'social')),
  sort_order integer not null default 0,
  storage_bucket text null,
  storage_path text null,
  public_url text null,
  width integer null,
  height integer null,
  content_type text null,
  byte_size bigint null,
  sha256 text null,
  perceptual_hash text null,
  status text not null default 'active' check (status in ('active', 'duplicate', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata_json jsonb not null default '{}'::jsonb,
  constraint catalog_set_images_slot_unique unique (set_id, image_type, sort_order)
);

create index if not exists catalog_set_images_active_lookup_idx
on public.catalog_set_images (set_id, image_type, sort_order)
where status = 'active';

create index if not exists catalog_set_images_sha256_idx
on public.catalog_set_images (sha256)
where sha256 is not null;

drop trigger if exists set_catalog_set_images_updated_at
on public.catalog_set_images;
create trigger set_catalog_set_images_updated_at
before update on public.catalog_set_images
for each row
execute function public.set_updated_at();

alter table public.catalog_set_images enable row level security;

drop policy if exists "Public can read active catalog set images"
on public.catalog_set_images;
create policy "Public can read active catalog set images"
on public.catalog_set_images
for select
using (status = 'active');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'catalog-set-images',
  'catalog-set-images',
  true,
  5242880,
  array['image/webp', 'image/jpeg']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read catalog set image objects"
on storage.objects;
create policy "Public can read catalog set image objects"
on storage.objects
for select
using (bucket_id = 'catalog-set-images');
