alter table public.catalog_set_images
add column if not exists image_role text not null default 'unknown',
add column if not exists duplicate_of_id uuid null references public.catalog_set_images(id) on delete set null,
add column if not exists duplicate_reason text null,
add column if not exists duplicate_distance integer null;

alter table public.catalog_set_images
drop constraint if exists catalog_set_images_image_role_check;

alter table public.catalog_set_images
add constraint catalog_set_images_image_role_check
check (
  image_role in (
    'model',
    'box',
    'lifestyle',
    'detail',
    'build',
    'minifigure',
    'logo',
    'unknown'
  )
);

alter table public.catalog_set_images
drop constraint if exists catalog_set_images_duplicate_reason_check;

alter table public.catalog_set_images
add constraint catalog_set_images_duplicate_reason_check
check (
  duplicate_reason is null
  or duplicate_reason in ('sha256', 'perceptual')
);

create index if not exists catalog_set_images_perceptual_hash_idx
on public.catalog_set_images (perceptual_hash)
where perceptual_hash is not null;

create index if not exists catalog_set_images_role_idx
on public.catalog_set_images (image_role);

create index if not exists catalog_set_images_duplicate_of_idx
on public.catalog_set_images (duplicate_of_id)
where duplicate_of_id is not null;
