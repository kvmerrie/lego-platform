do $$
begin
  alter table public.catalog_set_images
    drop constraint if exists catalog_set_images_image_type_check;

  alter table public.catalog_set_images
    add constraint catalog_set_images_image_type_check
    check (image_type in ('hero', 'gallery', 'social', 'thumbnail', 'card', 'large'));
end
$$;

create index if not exists catalog_set_images_active_large_lookup_idx
  on public.catalog_set_images (set_id, sort_order)
  where status = 'active' and image_type = 'large';
