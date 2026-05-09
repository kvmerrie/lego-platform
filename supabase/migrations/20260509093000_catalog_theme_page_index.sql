create index if not exists catalog_sets_theme_page_order_idx
on public.catalog_sets (
  primary_theme_id,
  status,
  release_year desc,
  name asc,
  set_id asc
);
