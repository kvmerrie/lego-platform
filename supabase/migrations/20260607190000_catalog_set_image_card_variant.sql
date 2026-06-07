alter table public.catalog_set_images
drop constraint if exists catalog_set_images_image_type_check;

alter table public.catalog_set_images
add constraint catalog_set_images_image_type_check
check (image_type in ('hero', 'gallery', 'social', 'thumbnail', 'card'));

create index if not exists catalog_set_images_active_card_lookup_idx
on public.catalog_set_images (set_id)
where status = 'active' and image_type = 'card';
