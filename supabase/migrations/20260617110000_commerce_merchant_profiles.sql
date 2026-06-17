create table if not exists public.commerce_merchant_profiles (
  merchant_id uuid primary key references public.commerce_merchants(id) on delete cascade,
  internal_slug text not null,
  public_slug text not null unique,
  display_name text not null,
  seo_title text null,
  seo_description text null,
  short_description text null,
  long_description text null,
  logo_url text null,
  favicon_url text null,
  brand_color text null,
  brand_text_color text null,
  canonical_path text null,
  is_public boolean not null default true,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint commerce_merchant_profiles_internal_slug_format_check check (
    internal_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint commerce_merchant_profiles_public_slug_format_check check (
    public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint commerce_merchant_profiles_brand_color_check check (
    brand_color is null or brand_color ~ '^#[0-9A-Fa-f]{6}$'
  ),
  constraint commerce_merchant_profiles_brand_text_color_check check (
    brand_text_color is null or brand_text_color ~ '^#[0-9A-Fa-f]{6}$'
  )
);

create index if not exists commerce_merchant_profiles_internal_slug_idx
  on public.commerce_merchant_profiles (internal_slug);

create index if not exists commerce_merchant_profiles_public_visibility_idx
  on public.commerce_merchant_profiles (is_public, public_slug);

create or replace function public.set_commerce_merchant_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_commerce_merchant_profiles_updated_at
  on public.commerce_merchant_profiles;

create trigger set_commerce_merchant_profiles_updated_at
  before update on public.commerce_merchant_profiles
  for each row
  execute function public.set_commerce_merchant_profiles_updated_at();

alter table public.commerce_merchant_profiles enable row level security;

drop policy if exists "Public can read public commerce merchant profiles"
  on public.commerce_merchant_profiles;

create policy "Public can read public commerce merchant profiles"
  on public.commerce_merchant_profiles
  for select
  using (
    is_public = true
    and exists (
      select 1
      from public.commerce_merchants merchants
      where merchants.id = commerce_merchant_profiles.merchant_id
        and merchants.slug = commerce_merchant_profiles.internal_slug
        and merchants.is_active = true
    )
  );

drop policy if exists "Service role can manage commerce merchant profiles"
  on public.commerce_merchant_profiles;

create policy "Service role can manage commerce merchant profiles"
  on public.commerce_merchant_profiles
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

insert into public.commerce_merchant_profiles (
  merchant_id,
  internal_slug,
  public_slug,
  display_name,
  seo_title,
  seo_description,
  short_description,
  logo_url,
  favicon_url,
  brand_color,
  brand_text_color,
  canonical_path,
  is_public
)
select
  merchants.id,
  merchants.slug,
  'lego',
  'LEGO®',
  'LEGO aanbiedingen en prijzen vergelijken',
  'Vergelijk actuele LEGO prijzen en aanbiedingen bij de officiële LEGO winkel op Brickhunt.',
  'Officiële LEGO winkel met actuele prijzen en aanbiedingen.',
  '/merchant-favicons/lego-nl.png',
  '/merchant-favicons/lego-nl.png',
  '#ffd500',
  '#111111',
  '/winkels/lego',
  true
from public.commerce_merchants merchants
where merchants.slug = 'rakuten-lego-eu'
on conflict (merchant_id) do update
set
  internal_slug = excluded.internal_slug,
  public_slug = coalesce(
    public.commerce_merchant_profiles.public_slug,
    excluded.public_slug
  ),
  display_name = coalesce(
    public.commerce_merchant_profiles.display_name,
    excluded.display_name
  ),
  seo_title = coalesce(
    public.commerce_merchant_profiles.seo_title,
    excluded.seo_title
  ),
  seo_description = coalesce(
    public.commerce_merchant_profiles.seo_description,
    excluded.seo_description
  ),
  short_description = coalesce(
    public.commerce_merchant_profiles.short_description,
    excluded.short_description
  ),
  logo_url = coalesce(
    public.commerce_merchant_profiles.logo_url,
    excluded.logo_url
  ),
  favicon_url = coalesce(
    public.commerce_merchant_profiles.favicon_url,
    excluded.favicon_url
  ),
  brand_color = coalesce(
    public.commerce_merchant_profiles.brand_color,
    excluded.brand_color
  ),
  brand_text_color = coalesce(
    public.commerce_merchant_profiles.brand_text_color,
    excluded.brand_text_color
  ),
  canonical_path = coalesce(
    public.commerce_merchant_profiles.canonical_path,
    excluded.canonical_path
  ),
  is_public = public.commerce_merchant_profiles.is_public,
  updated_at = timezone('utc', now());
