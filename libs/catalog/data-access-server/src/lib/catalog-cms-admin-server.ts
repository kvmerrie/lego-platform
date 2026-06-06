import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type CatalogCollectionPresentation,
  type PublicPageSection,
  type PublicPageSectionItem,
  type PublicPageSectionItemReferenceType,
} from '@lego-platform/catalog/util';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';

const CATALOG_THEMES_TABLE = 'catalog_themes';
const CATALOG_COLLECTION_PRESENTATIONS_TABLE =
  'catalog_collection_presentations';
const PUBLIC_PAGE_SECTIONS_TABLE = 'public_page_sections';
const PUBLIC_PAGE_SECTION_ITEMS_TABLE = 'public_page_section_items';
const ADMIN_THEME_SELECT =
  'id, slug, display_name, public_display_name, public_description, public_image_url, public_tile_image_url, public_logo_url, public_accent_color, public_surface_color, public_surface_text_color, public_hero_text_color, public_order, public_homepage_order, is_public, status, updated_at';
const ADMIN_COLLECTION_SELECT =
  'collection_slug, public_display_name, public_description, public_image_url, public_tile_image_url, public_logo_url, public_accent_color, public_surface_color, public_surface_text_color, public_hero_text_color, public_order, public_homepage_order, is_public, status, metadata_json, updated_at';

type CatalogCmsAdminSupabaseClient = Pick<SupabaseClient, 'from'>;

export interface AdminCatalogThemePresentation {
  displayName: string;
  id: string;
  isPublic: boolean;
  publicAccentColor?: string | null;
  publicDescription?: string | null;
  publicDisplayName?: string | null;
  publicHeroTextColor?: string | null;
  publicHomepageOrder?: number | null;
  publicImageUrl?: string | null;
  publicLogoUrl?: string | null;
  publicOrder?: number | null;
  publicSurfaceColor?: string | null;
  publicSurfaceTextColor?: string | null;
  publicTileImageUrl?: string | null;
  slug: string;
  status: string;
  updatedAt?: string | null;
}

export interface AdminCatalogThemePresentationInput {
  isPublic: boolean;
  publicAccentColor?: string | null;
  publicDescription?: string | null;
  publicDisplayName?: string | null;
  publicHeroTextColor?: string | null;
  publicHomepageOrder?: number | null;
  publicImageUrl?: string | null;
  publicLogoUrl?: string | null;
  publicOrder?: number | null;
  publicSurfaceColor?: string | null;
  publicSurfaceTextColor?: string | null;
  publicTileImageUrl?: string | null;
  status: string;
}

export type AdminCatalogCollectionPresentation = CatalogCollectionPresentation;

export interface AdminCatalogCollectionPresentationInput {
  isPublic: boolean;
  metadata?: Readonly<Record<string, unknown>>;
  publicAccentColor?: string | null;
  publicDescription?: string | null;
  publicDisplayName?: string | null;
  publicHeroTextColor?: string | null;
  publicHomepageOrder?: number | null;
  publicImageUrl?: string | null;
  publicLogoUrl?: string | null;
  publicOrder?: number | null;
  publicSurfaceColor?: string | null;
  publicSurfaceTextColor?: string | null;
  publicTileImageUrl?: string | null;
  status: string;
}

interface AdminCatalogThemePresentationRow {
  display_name: string;
  id: string;
  is_public: boolean;
  public_accent_color: string | null;
  public_description: string | null;
  public_display_name: string | null;
  public_hero_text_color: string | null;
  public_homepage_order: number | null;
  public_image_url: string | null;
  public_logo_url: string | null;
  public_order: number | null;
  public_surface_color: string | null;
  public_surface_text_color: string | null;
  public_tile_image_url: string | null;
  slug: string;
  status: string;
  updated_at: string | null;
}

interface AdminCatalogCollectionPresentationRow {
  collection_slug: string;
  is_public: boolean;
  metadata_json: Record<string, unknown> | null;
  public_accent_color: string | null;
  public_description: string | null;
  public_display_name: string | null;
  public_hero_text_color: string | null;
  public_homepage_order: number | null;
  public_image_url: string | null;
  public_logo_url: string | null;
  public_order: number | null;
  public_surface_color: string | null;
  public_surface_text_color: string | null;
  public_tile_image_url: string | null;
  status: string;
  updated_at: string | null;
}

interface PublicPageSectionRow {
  enabled: boolean;
  id: string;
  layout: string | null;
  metadata_json: Record<string, unknown> | null;
  page_key: string;
  section_key: string;
  sort_order: number;
  subtitle: string | null;
  title: string;
}

interface PublicPageSectionItemRow {
  alt_override: string | null;
  cta_label: string | null;
  cta_url: string | null;
  enabled: boolean;
  id: string;
  image_set_id: string | null;
  image_url: string | null;
  metadata_json: Record<string, unknown> | null;
  reference_id: string | null;
  reference_type: PublicPageSectionItemReferenceType;
  section_id: string;
  sort_order: number;
  title_override: string | null;
  use_custom_image?: boolean | null;
}

export interface AdminHomepageSectionSaveInput
  extends Omit<PublicPageSection, 'items'> {
  items: readonly PublicPageSectionItem[];
}

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readOptionalInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function toThemePresentation(
  row: AdminCatalogThemePresentationRow,
): AdminCatalogThemePresentation {
  return {
    displayName: row.display_name,
    id: row.id,
    isPublic: row.is_public,
    publicAccentColor: row.public_accent_color,
    publicDescription: row.public_description,
    publicDisplayName: row.public_display_name,
    publicHeroTextColor: row.public_hero_text_color,
    publicHomepageOrder: row.public_homepage_order,
    publicImageUrl: row.public_image_url,
    publicLogoUrl: row.public_logo_url,
    publicOrder: row.public_order,
    publicSurfaceColor: row.public_surface_color,
    publicSurfaceTextColor: row.public_surface_text_color,
    publicTileImageUrl: row.public_tile_image_url,
    slug: row.slug,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

function toCollectionPresentation(
  row: AdminCatalogCollectionPresentationRow,
): AdminCatalogCollectionPresentation {
  return {
    collectionSlug: row.collection_slug,
    isPublic: row.is_public,
    ...(row.metadata_json ? { metadata: row.metadata_json } : {}),
    publicAccentColor: row.public_accent_color,
    publicDescription: row.public_description,
    publicDisplayName: row.public_display_name,
    publicHeroTextColor: row.public_hero_text_color,
    publicHomepageOrder: row.public_homepage_order,
    publicImageUrl: row.public_image_url,
    publicLogoUrl: row.public_logo_url,
    publicOrder: row.public_order,
    publicSurfaceColor: row.public_surface_color,
    publicSurfaceTextColor: row.public_surface_text_color,
    publicTileImageUrl: row.public_tile_image_url,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

function toPublicPageSectionItem(
  row: PublicPageSectionItemRow,
): PublicPageSectionItem {
  return {
    ...(row.alt_override ? { altOverride: row.alt_override } : {}),
    ...(row.cta_label ? { ctaLabel: row.cta_label } : {}),
    ...(row.cta_url ? { ctaUrl: row.cta_url } : {}),
    enabled: row.enabled,
    id: row.id,
    ...(row.image_set_id ? { imageSetId: row.image_set_id } : {}),
    ...(row.image_url ? { imageUrl: row.image_url } : {}),
    ...(row.metadata_json ? { metadata: row.metadata_json } : {}),
    ...(row.reference_id ? { referenceId: row.reference_id } : {}),
    referenceType: row.reference_type,
    sortOrder: row.sort_order,
    ...(row.title_override ? { titleOverride: row.title_override } : {}),
    ...(typeof row.use_custom_image === 'boolean'
      ? { useCustomImage: row.use_custom_image }
      : {}),
  };
}

function toPublicPageSection({
  items,
  row,
}: {
  items: readonly PublicPageSectionItem[];
  row: PublicPageSectionRow;
}): PublicPageSection {
  return {
    enabled: row.enabled,
    id: row.id,
    items,
    ...(row.layout ? { layout: row.layout } : {}),
    ...(row.metadata_json ? { metadata: row.metadata_json } : {}),
    pageKey: row.page_key,
    sectionKey: row.section_key,
    sortOrder: row.sort_order,
    ...(row.subtitle ? { subtitle: row.subtitle } : {}),
    title: row.title,
  };
}

function getCmsAdminClient(
  supabaseClient?: CatalogCmsAdminSupabaseClient,
): CatalogCmsAdminSupabaseClient {
  return supabaseClient ?? getServerSupabaseAdminClient();
}

export async function listAdminCatalogThemePresentations({
  query,
  supabaseClient,
}: {
  query?: string;
  supabaseClient?: CatalogCmsAdminSupabaseClient;
} = {}): Promise<AdminCatalogThemePresentation[]> {
  const activeSupabaseClient = getCmsAdminClient(supabaseClient);
  let builder = activeSupabaseClient
    .from(CATALOG_THEMES_TABLE)
    .select(ADMIN_THEME_SELECT)
    .order('public_order', { ascending: true, nullsFirst: false })
    .order('display_name', { ascending: true });

  if (query?.trim()) {
    const escapedQuery = query.trim().replace(/[%_,]/gu, '');
    builder = builder.or(
      `display_name.ilike.%${escapedQuery}%,public_display_name.ilike.%${escapedQuery}%,slug.ilike.%${escapedQuery}%`,
    );
  }

  const { data, error } = await builder.limit(250);

  if (error) {
    throw new Error('Unable to load catalog theme presentations.');
  }

  return ((data as AdminCatalogThemePresentationRow[] | null) ?? []).map(
    toThemePresentation,
  );
}

export async function updateAdminCatalogThemePresentation({
  input,
  slug,
  supabaseClient,
}: {
  input: AdminCatalogThemePresentationInput;
  slug: string;
  supabaseClient?: CatalogCmsAdminSupabaseClient;
}): Promise<AdminCatalogThemePresentation> {
  const activeSupabaseClient = getCmsAdminClient(supabaseClient);
  const payload = {
    is_public: input.isPublic,
    public_accent_color: readOptionalString(input.publicAccentColor),
    public_description: readOptionalString(input.publicDescription),
    public_display_name: readOptionalString(input.publicDisplayName),
    public_hero_text_color: readOptionalString(input.publicHeroTextColor),
    public_homepage_order: readOptionalInteger(input.publicHomepageOrder),
    public_image_url: readOptionalString(input.publicImageUrl),
    public_logo_url: readOptionalString(input.publicLogoUrl),
    public_order: readOptionalInteger(input.publicOrder),
    public_surface_color: readOptionalString(input.publicSurfaceColor),
    public_surface_text_color: readOptionalString(input.publicSurfaceTextColor),
    public_tile_image_url: readOptionalString(input.publicTileImageUrl),
    status: input.status === 'inactive' ? 'inactive' : 'active',
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await activeSupabaseClient
    .from(CATALOG_THEMES_TABLE)
    .update(payload)
    .eq('slug', slug)
    .select(ADMIN_THEME_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error('Unable to save catalog theme presentation.');
  }

  if (!data) {
    throw new Error('Theme not found.');
  }

  return toThemePresentation(data as AdminCatalogThemePresentationRow);
}

export async function listAdminCatalogCollectionPresentations({
  query,
  supabaseClient,
}: {
  query?: string;
  supabaseClient?: CatalogCmsAdminSupabaseClient;
} = {}): Promise<AdminCatalogCollectionPresentation[]> {
  const activeSupabaseClient = getCmsAdminClient(supabaseClient);
  let builder = activeSupabaseClient
    .from(CATALOG_COLLECTION_PRESENTATIONS_TABLE)
    .select(ADMIN_COLLECTION_SELECT)
    .order('public_order', { ascending: true, nullsFirst: false })
    .order('collection_slug', { ascending: true });

  if (query?.trim()) {
    const escapedQuery = query.trim().replace(/[%_,]/gu, '');
    builder = builder.or(
      `collection_slug.ilike.%${escapedQuery}%,public_display_name.ilike.%${escapedQuery}%`,
    );
  }

  const { data, error } = await builder.limit(250);

  if (error) {
    throw new Error('Unable to load catalog collection presentations.');
  }

  return ((data as AdminCatalogCollectionPresentationRow[] | null) ?? []).map(
    toCollectionPresentation,
  );
}

export async function updateAdminCatalogCollectionPresentation({
  input,
  slug,
  supabaseClient,
}: {
  input: AdminCatalogCollectionPresentationInput;
  slug: string;
  supabaseClient?: CatalogCmsAdminSupabaseClient;
}): Promise<AdminCatalogCollectionPresentation> {
  const activeSupabaseClient = getCmsAdminClient(supabaseClient);
  const payload = {
    collection_slug: slug,
    is_public: input.isPublic,
    metadata_json: input.metadata ?? {},
    public_accent_color: readOptionalString(input.publicAccentColor),
    public_description: readOptionalString(input.publicDescription),
    public_display_name: readOptionalString(input.publicDisplayName),
    public_hero_text_color: readOptionalString(input.publicHeroTextColor),
    public_homepage_order: readOptionalInteger(input.publicHomepageOrder),
    public_image_url: readOptionalString(input.publicImageUrl),
    public_logo_url: readOptionalString(input.publicLogoUrl),
    public_order: readOptionalInteger(input.publicOrder),
    public_surface_color: readOptionalString(input.publicSurfaceColor),
    public_surface_text_color: readOptionalString(input.publicSurfaceTextColor),
    public_tile_image_url: readOptionalString(input.publicTileImageUrl),
    status: input.status === 'inactive' ? 'inactive' : 'active',
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await activeSupabaseClient
    .from(CATALOG_COLLECTION_PRESENTATIONS_TABLE)
    .upsert(payload, { onConflict: 'collection_slug' })
    .select(ADMIN_COLLECTION_SELECT)
    .maybeSingle();

  if (error || !data) {
    throw new Error('Unable to save catalog collection presentation.');
  }

  return toCollectionPresentation(
    data as AdminCatalogCollectionPresentationRow,
  );
}

export async function listAdminHomepageSections({
  supabaseClient,
}: {
  supabaseClient?: CatalogCmsAdminSupabaseClient;
} = {}): Promise<PublicPageSection[]> {
  const activeSupabaseClient = getCmsAdminClient(supabaseClient);
  const { data: sectionData, error: sectionError } = await activeSupabaseClient
    .from(PUBLIC_PAGE_SECTIONS_TABLE)
    .select(
      'id, page_key, section_key, title, subtitle, layout, sort_order, enabled, metadata_json',
    )
    .eq('page_key', 'homepage')
    .order('sort_order', { ascending: true })
    .order('section_key', { ascending: true });

  if (sectionError) {
    throw new Error('Unable to load homepage sections.');
  }

  const sectionRows = (sectionData as PublicPageSectionRow[] | null) ?? [];

  if (sectionRows.length === 0) {
    return [];
  }

  const { data: itemData, error: itemError } = await activeSupabaseClient
    .from(PUBLIC_PAGE_SECTION_ITEMS_TABLE)
    .select(
      'id, section_id, reference_type, reference_id, image_set_id, image_url, title_override, alt_override, cta_label, cta_url, sort_order, enabled, use_custom_image, metadata_json',
    )
    .in(
      'section_id',
      sectionRows.map((sectionRow) => sectionRow.id),
    )
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });

  if (itemError) {
    throw new Error('Unable to load homepage section items.');
  }

  const itemRows = (itemData as PublicPageSectionItemRow[] | null) ?? [];
  const itemsBySectionId = new Map<string, PublicPageSectionItem[]>();

  for (const row of itemRows) {
    const sectionItems = itemsBySectionId.get(row.section_id) ?? [];
    sectionItems.push(toPublicPageSectionItem(row));
    itemsBySectionId.set(row.section_id, sectionItems);
  }

  return sectionRows.map((row) =>
    toPublicPageSection({
      items: itemsBySectionId.get(row.id) ?? [],
      row,
    }),
  );
}

export async function saveAdminHomepageSection({
  input,
  supabaseClient,
}: {
  input: AdminHomepageSectionSaveInput;
  supabaseClient?: CatalogCmsAdminSupabaseClient;
}): Promise<PublicPageSection> {
  const activeSupabaseClient = getCmsAdminClient(supabaseClient);
  const sectionPayload = {
    enabled: input.enabled,
    layout: readOptionalString(input.layout),
    metadata_json: input.metadata ?? {},
    page_key: 'homepage',
    section_key: input.sectionKey,
    sort_order: input.sortOrder,
    subtitle: readOptionalString(input.subtitle),
    title: input.title.trim(),
    updated_at: new Date().toISOString(),
  };
  const { data: sectionData, error: sectionError } = await activeSupabaseClient
    .from(PUBLIC_PAGE_SECTIONS_TABLE)
    .upsert(sectionPayload, { onConflict: 'page_key,section_key' })
    .select(
      'id, page_key, section_key, title, subtitle, layout, sort_order, enabled, metadata_json',
    )
    .maybeSingle();

  if (sectionError || !sectionData) {
    throw new Error('Unable to save homepage section.');
  }

  const sectionRow = sectionData as PublicPageSectionRow;
  const { error: deleteError } = await activeSupabaseClient
    .from(PUBLIC_PAGE_SECTION_ITEMS_TABLE)
    .delete()
    .eq('section_id', sectionRow.id);

  if (deleteError) {
    throw new Error('Unable to replace homepage section items.');
  }

  if (input.items.length > 0) {
    const itemPayload = input.items.map((item, index) => ({
      alt_override: readOptionalString(item.altOverride),
      cta_label: readOptionalString(item.ctaLabel),
      cta_url: readOptionalString(item.ctaUrl),
      enabled: item.enabled,
      image_set_id: readOptionalString(item.imageSetId),
      image_url: readOptionalString(item.imageUrl),
      metadata_json: item.metadata ?? {},
      reference_id: readOptionalString(item.referenceId),
      reference_type: item.referenceType,
      section_id: sectionRow.id,
      sort_order: Number.isInteger(item.sortOrder)
        ? item.sortOrder
        : (index + 1) * 10,
      title_override: readOptionalString(item.titleOverride),
      use_custom_image: item.useCustomImage === true,
    }));
    const { error: insertError } = await activeSupabaseClient
      .from(PUBLIC_PAGE_SECTION_ITEMS_TABLE)
      .insert(itemPayload);

    if (insertError) {
      throw new Error('Unable to save homepage section items.');
    }
  }

  return (
    await listAdminHomepageSections({
      supabaseClient: activeSupabaseClient,
    })
  ).find(
    (section) => section.sectionKey === input.sectionKey,
  ) as PublicPageSection;
}
