create index if not exists catalog_themes_public_navigation_idx
on public.catalog_themes (
  status,
  is_public,
  public_order,
  display_name
);
