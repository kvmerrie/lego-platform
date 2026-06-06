import { createSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import {
  getProductionSupabaseConfig,
  getStagingSupabaseConfig,
} from '@lego-platform/shared/config';
import type { SupabaseClient } from '@supabase/supabase-js';

const CATALOG_COLLECTION_PRESENTATIONS_TABLE =
  'catalog_collection_presentations';
const CATALOG_THEMES_TABLE = 'catalog_themes';
const CMS_PROMOTION_PAGE_SIZE = 1000;
const PUBLIC_PAGE_SECTION_ITEMS_TABLE = 'public_page_section_items';
const PUBLIC_PAGE_SECTIONS_TABLE = 'public_page_sections';

const CMS_THEME_PRESENTATION_FIELDS = [
  'public_display_name',
  'public_description',
  'public_image_url',
  'public_tile_image_url',
  'public_logo_url',
  'public_accent_color',
  'public_surface_color',
  'public_surface_text_color',
  'public_hero_text_color',
  'public_order',
  'public_homepage_order',
  'is_public',
  'status',
] as const;

const CMS_COLLECTION_PRESENTATION_FIELDS = [
  'public_display_name',
  'public_description',
  'public_image_url',
  'public_tile_image_url',
  'public_logo_url',
  'public_accent_color',
  'public_surface_color',
  'public_surface_text_color',
  'public_hero_text_color',
  'public_order',
  'public_homepage_order',
  'is_public',
  'status',
  'metadata_json',
] as const;

const CMS_PAGE_SECTION_FIELDS = [
  'title',
  'subtitle',
  'layout',
  'sort_order',
  'enabled',
  'metadata_json',
] as const;

const CMS_PAGE_SECTION_ITEM_FIELDS = [
  'reference_type',
  'reference_id',
  'image_set_id',
  'image_url',
  'title_override',
  'alt_override',
  'cta_label',
  'cta_url',
  'sort_order',
  'enabled',
  'use_custom_image',
  'metadata_json',
] as const;

type CmsPromotionSupabaseClient = Pick<SupabaseClient, 'from'>;
type CmsPromotionFieldValue =
  | boolean
  | number
  | Readonly<Record<string, unknown>>
  | string
  | null;
type CmsPromotionRow = Record<string, CmsPromotionFieldValue>;

interface PublicPageSectionPromotionRow extends CmsPromotionRow {
  enabled: boolean;
  id: string;
  layout: string | null;
  metadata_json: Readonly<Record<string, unknown>>;
  page_key: string;
  section_key: string;
  sort_order: number;
  subtitle: string | null;
  title: string;
}

interface PublicPageSectionItemPromotionRow extends CmsPromotionRow {
  alt_override: string | null;
  cta_label: string | null;
  cta_url: string | null;
  enabled: boolean;
  id: string;
  image_set_id: string | null;
  image_url: string | null;
  metadata_json: Readonly<Record<string, unknown>>;
  reference_id: string | null;
  reference_type: string;
  section_id: string;
  sort_order: number;
  title_override: string | null;
  use_custom_image: boolean;
}

interface CatalogCollectionPresentationPromotionRow extends CmsPromotionRow {
  collection_slug: string;
  is_public: boolean;
  metadata_json: Readonly<Record<string, unknown>>;
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
}

interface CatalogThemePresentationPromotionRow extends CmsPromotionRow {
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
}

export interface CmsPromotionTablePreview {
  insertedCount: number;
  readCount: number;
  replacedCount?: number;
  skippedMissingProductionCount?: number;
  updatedCount: number;
}

export interface CmsPromotionPreviewSample {
  changeType: 'insert' | 'replace' | 'skip_missing_production' | 'update';
  changedFields: string[];
  key: string;
  table: string;
}

export interface CmsPromotionPreviewResult {
  affectedCollectionSlugs: string[];
  affectedThemeSlugs: string[];
  generatedAt: string;
  pendingPromoteCount: number;
  samples: CmsPromotionPreviewSample[];
  sourceEnvironment: 'staging';
  status: 'ok';
  tables: {
    catalog_collection_presentations: CmsPromotionTablePreview;
    catalog_themes: CmsPromotionTablePreview;
    public_page_section_items: CmsPromotionTablePreview;
    public_page_sections: CmsPromotionTablePreview;
  };
  targetEnvironment: 'production';
}

export interface CmsPromotionResult extends CmsPromotionPreviewResult {
  applied: boolean;
  durationMs: number;
  startedAt: string;
}

export interface PromoteCmsFromStagingToProductionDependencies {
  createProductionSupabaseClient?: () => CmsPromotionSupabaseClient;
  createStagingSupabaseClient?: () => CmsPromotionSupabaseClient;
  now?: () => Date;
}

interface CmsPromotionSnapshot {
  collectionPresentations: CatalogCollectionPresentationPromotionRow[];
  pageSectionItems: PublicPageSectionItemPromotionRow[];
  pageSections: PublicPageSectionPromotionRow[];
  themePresentations: CatalogThemePresentationPromotionRow[];
}

interface CmsPromotionPlan extends CmsPromotionPreviewResult {
  productionSectionIdByStagingSectionId: Map<string, string>;
  snapshot: CmsPromotionSnapshot;
}

function createCmsPromotionClients(): {
  productionSupabaseClient: CmsPromotionSupabaseClient;
  stagingSupabaseClient: CmsPromotionSupabaseClient;
} {
  const stagingSupabaseConfig = getStagingSupabaseConfig();
  const productionSupabaseConfig = getProductionSupabaseConfig();

  if (stagingSupabaseConfig.url === productionSupabaseConfig.url) {
    throw new Error('refusing to compare/promote identical Supabase targets');
  }

  return {
    productionSupabaseClient: createSupabaseAdminClient(
      productionSupabaseConfig,
    ),
    stagingSupabaseClient: createSupabaseAdminClient(stagingSupabaseConfig),
  };
}

function valuesAreEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }

  if (left == null && right == null) {
    return true;
  }

  if (
    typeof left === 'object' &&
    left !== null &&
    typeof right === 'object' &&
    right !== null
  ) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  return false;
}

function buildKey({
  keyColumns,
  row,
}: {
  keyColumns: readonly string[];
  row: Readonly<Record<string, unknown>>;
}): string {
  return keyColumns
    .map((keyColumn) => `${keyColumn}:${String(row[keyColumn] ?? '')}`)
    .join('|');
}

function indexRowsByKey<TRow extends Readonly<Record<string, unknown>>>({
  keyColumns,
  rows,
}: {
  keyColumns: readonly string[];
  rows: readonly TRow[];
}): Map<string, TRow> {
  return new Map(
    rows.map((row) => [
      buildKey({
        keyColumns,
        row,
      }),
      row,
    ]),
  );
}

async function readRows<TRow>({
  columns,
  orderBy,
  supabaseClient,
  table,
}: {
  columns: string;
  orderBy: string;
  supabaseClient: CmsPromotionSupabaseClient;
  table: string;
}): Promise<TRow[]> {
  const rows: TRow[] = [];

  for (let from = 0; ; from += CMS_PROMOTION_PAGE_SIZE) {
    const { data, error } = await supabaseClient
      .from(table)
      .select(columns)
      .order(orderBy, { ascending: true })
      .range(from, from + CMS_PROMOTION_PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Unable to read ${table}. ${JSON.stringify(error)}`);
    }

    const pageRows = (data as unknown as TRow[] | null) ?? [];
    rows.push(...pageRows);

    if (pageRows.length < CMS_PROMOTION_PAGE_SIZE) {
      return rows;
    }
  }
}

async function readCmsPromotionSnapshot(
  supabaseClient: CmsPromotionSupabaseClient,
): Promise<CmsPromotionSnapshot> {
  const [pageSections, collectionPresentations, themePresentations] =
    await Promise.all([
      readRows<PublicPageSectionPromotionRow>({
        columns:
          'id, page_key, section_key, title, subtitle, layout, sort_order, enabled, metadata_json',
        orderBy: 'page_key',
        supabaseClient,
        table: PUBLIC_PAGE_SECTIONS_TABLE,
      }),
      readRows<CatalogCollectionPresentationPromotionRow>({
        columns:
          'collection_slug, public_display_name, public_description, public_image_url, public_tile_image_url, public_logo_url, public_accent_color, public_surface_color, public_surface_text_color, public_hero_text_color, public_order, public_homepage_order, is_public, status, metadata_json',
        orderBy: 'collection_slug',
        supabaseClient,
        table: CATALOG_COLLECTION_PRESENTATIONS_TABLE,
      }),
      readRows<CatalogThemePresentationPromotionRow>({
        columns:
          'id, slug, display_name, public_display_name, public_description, public_image_url, public_tile_image_url, public_logo_url, public_accent_color, public_surface_color, public_surface_text_color, public_hero_text_color, public_order, public_homepage_order, is_public, status',
        orderBy: 'slug',
        supabaseClient,
        table: CATALOG_THEMES_TABLE,
      }),
    ]);
  const pageSectionIds = pageSections.map((section) => section.id);
  const pageSectionItems = pageSectionIds.length
    ? await readRows<PublicPageSectionItemPromotionRow>({
        columns:
          'id, section_id, reference_type, reference_id, image_set_id, image_url, title_override, alt_override, cta_label, cta_url, sort_order, enabled, use_custom_image, metadata_json',
        orderBy: 'section_id',
        supabaseClient,
        table: PUBLIC_PAGE_SECTION_ITEMS_TABLE,
      }).then((rows) =>
        rows.filter((row) => pageSectionIds.includes(row.section_id)),
      )
    : [];

  return {
    collectionPresentations,
    pageSectionItems,
    pageSections,
    themePresentations,
  };
}

function diffRows({
  fields,
  keyColumns,
  productionRows,
  samples,
  stagingRows,
  table,
}: {
  fields: readonly string[];
  keyColumns: readonly string[];
  productionRows: readonly Readonly<Record<string, unknown>>[];
  samples: CmsPromotionPreviewSample[];
  stagingRows: readonly Readonly<Record<string, unknown>>[];
  table: string;
}): CmsPromotionTablePreview {
  const productionByKey = indexRowsByKey({
    keyColumns,
    rows: productionRows,
  });
  let insertedCount = 0;
  let updatedCount = 0;

  for (const stagingRow of stagingRows) {
    const key = buildKey({
      keyColumns,
      row: stagingRow,
    });
    const productionRow = productionByKey.get(key);

    if (!productionRow) {
      insertedCount += 1;

      if (samples.length < 50) {
        samples.push({
          changeType: 'insert',
          changedFields: [...fields],
          key,
          table,
        });
      }

      continue;
    }

    const changedFields = fields.filter((field) =>
      Object.prototype.hasOwnProperty.call(stagingRow, field)
        ? !valuesAreEqual(stagingRow[field], productionRow[field])
        : false,
    );

    if (changedFields.length > 0) {
      updatedCount += 1;

      if (samples.length < 50) {
        samples.push({
          changeType: 'update',
          changedFields,
          key,
          table,
        });
      }
    }
  }

  return {
    insertedCount,
    readCount: stagingRows.length,
    updatedCount,
  };
}

function diffThemePresentationRows({
  productionRows,
  samples,
  stagingRows,
}: {
  productionRows: readonly CatalogThemePresentationPromotionRow[];
  samples: CmsPromotionPreviewSample[];
  stagingRows: readonly CatalogThemePresentationPromotionRow[];
}): CmsPromotionTablePreview {
  const productionBySlug = new Map(
    productionRows.map((row) => [row.slug, row] as const),
  );
  let skippedMissingProductionCount = 0;
  let updatedCount = 0;

  for (const stagingRow of stagingRows) {
    const productionRow = productionBySlug.get(stagingRow.slug);
    const key = `slug:${stagingRow.slug}`;

    if (!productionRow) {
      skippedMissingProductionCount += 1;

      if (samples.length < 50) {
        samples.push({
          changeType: 'skip_missing_production',
          changedFields: ['slug'],
          key,
          table: CATALOG_THEMES_TABLE,
        });
      }

      continue;
    }

    const changedFields = CMS_THEME_PRESENTATION_FIELDS.filter(
      (field) => !valuesAreEqual(stagingRow[field], productionRow[field]),
    );

    if (changedFields.length > 0) {
      updatedCount += 1;

      if (samples.length < 50) {
        samples.push({
          changeType: 'update',
          changedFields: [...changedFields],
          key,
          table: CATALOG_THEMES_TABLE,
        });
      }
    }
  }

  return {
    insertedCount: 0,
    readCount: stagingRows.length,
    skippedMissingProductionCount,
    updatedCount,
  };
}

function diffSectionItemRows({
  productionRows,
  samples,
  stagingRows,
}: {
  productionRows: readonly PublicPageSectionItemPromotionRow[];
  samples: CmsPromotionPreviewSample[];
  stagingRows: readonly PublicPageSectionItemPromotionRow[];
}): CmsPromotionTablePreview {
  const baseDiff = diffRows({
    fields: CMS_PAGE_SECTION_ITEM_FIELDS,
    keyColumns: ['id'],
    productionRows,
    samples,
    stagingRows,
    table: PUBLIC_PAGE_SECTION_ITEMS_TABLE,
  });

  return {
    ...baseDiff,
    replacedCount: productionRows.length,
  };
}

function listAffectedCollectionSlugs({
  productionRows,
  stagingRows,
}: {
  productionRows: readonly CatalogCollectionPresentationPromotionRow[];
  stagingRows: readonly CatalogCollectionPresentationPromotionRow[];
}): string[] {
  const productionBySlug = new Map(
    productionRows.map((row) => [row.collection_slug, row] as const),
  );

  return stagingRows
    .filter((stagingRow) => {
      const productionRow = productionBySlug.get(stagingRow.collection_slug);

      return (
        !productionRow ||
        CMS_COLLECTION_PRESENTATION_FIELDS.some(
          (field) => !valuesAreEqual(stagingRow[field], productionRow[field]),
        )
      );
    })
    .map((row) => row.collection_slug)
    .sort((left, right) => left.localeCompare(right));
}

function listAffectedThemeSlugs({
  productionRows,
  stagingRows,
}: {
  productionRows: readonly CatalogThemePresentationPromotionRow[];
  stagingRows: readonly CatalogThemePresentationPromotionRow[];
}): string[] {
  const productionBySlug = new Map(
    productionRows.map((row) => [row.slug, row] as const),
  );

  return stagingRows
    .filter((stagingRow) => {
      const productionRow = productionBySlug.get(stagingRow.slug);

      return (
        productionRow &&
        CMS_THEME_PRESENTATION_FIELDS.some(
          (field) => !valuesAreEqual(stagingRow[field], productionRow[field]),
        )
      );
    })
    .map((row) => row.slug)
    .sort((left, right) => left.localeCompare(right));
}

function buildProductionSectionIdByStagingSectionId({
  productionRows,
  stagingRows,
}: {
  productionRows: readonly PublicPageSectionPromotionRow[];
  stagingRows: readonly PublicPageSectionPromotionRow[];
}): Map<string, string> {
  const productionByPageSectionKey = new Map(
    productionRows.map(
      (row) => [`${row.page_key}:${row.section_key}`, row.id] as const,
    ),
  );

  return new Map(
    stagingRows.flatMap((stagingRow) => {
      const productionId = productionByPageSectionKey.get(
        `${stagingRow.page_key}:${stagingRow.section_key}`,
      );

      return productionId ? [[stagingRow.id, productionId] as const] : [];
    }),
  );
}

async function buildCmsPromotionPlan({
  now,
  productionSupabaseClient,
  stagingSupabaseClient,
}: {
  now: () => Date;
  productionSupabaseClient: CmsPromotionSupabaseClient;
  stagingSupabaseClient: CmsPromotionSupabaseClient;
}): Promise<CmsPromotionPlan> {
  const [stagingSnapshot, productionSnapshot] = await Promise.all([
    readCmsPromotionSnapshot(stagingSupabaseClient),
    readCmsPromotionSnapshot(productionSupabaseClient),
  ]);
  const samples: CmsPromotionPreviewSample[] = [];
  const tables = {
    public_page_sections: diffRows({
      fields: CMS_PAGE_SECTION_FIELDS,
      keyColumns: ['page_key', 'section_key'],
      productionRows: productionSnapshot.pageSections,
      samples,
      stagingRows: stagingSnapshot.pageSections,
      table: PUBLIC_PAGE_SECTIONS_TABLE,
    }),
    public_page_section_items: diffSectionItemRows({
      productionRows: productionSnapshot.pageSectionItems,
      samples,
      stagingRows: stagingSnapshot.pageSectionItems,
    }),
    catalog_collection_presentations: diffRows({
      fields: CMS_COLLECTION_PRESENTATION_FIELDS,
      keyColumns: ['collection_slug'],
      productionRows: productionSnapshot.collectionPresentations,
      samples,
      stagingRows: stagingSnapshot.collectionPresentations,
      table: CATALOG_COLLECTION_PRESENTATIONS_TABLE,
    }),
    catalog_themes: diffThemePresentationRows({
      productionRows: productionSnapshot.themePresentations,
      samples,
      stagingRows: stagingSnapshot.themePresentations,
    }),
  };
  const affectedCollectionSlugs = listAffectedCollectionSlugs({
    productionRows: productionSnapshot.collectionPresentations,
    stagingRows: stagingSnapshot.collectionPresentations,
  });
  const affectedThemeSlugs = listAffectedThemeSlugs({
    productionRows: productionSnapshot.themePresentations,
    stagingRows: stagingSnapshot.themePresentations,
  });
  const pendingPromoteCount = Object.values(tables).reduce(
    (total, table) =>
      total +
      table.insertedCount +
      table.updatedCount +
      (table.replacedCount ?? 0),
    0,
  );

  return {
    affectedCollectionSlugs,
    affectedThemeSlugs,
    generatedAt: now().toISOString(),
    pendingPromoteCount,
    productionSectionIdByStagingSectionId:
      buildProductionSectionIdByStagingSectionId({
        productionRows: productionSnapshot.pageSections,
        stagingRows: stagingSnapshot.pageSections,
      }),
    samples,
    snapshot: stagingSnapshot,
    sourceEnvironment: 'staging',
    status: 'ok',
    tables,
    targetEnvironment: 'production',
  };
}

function toSectionPayload(row: PublicPageSectionPromotionRow) {
  return {
    enabled: row.enabled,
    layout: row.layout,
    metadata_json: row.metadata_json ?? {},
    page_key: row.page_key,
    section_key: row.section_key,
    sort_order: row.sort_order,
    subtitle: row.subtitle,
    title: row.title,
  };
}

function toSectionItemPayload({
  productionSectionId,
  row,
}: {
  productionSectionId: string;
  row: PublicPageSectionItemPromotionRow;
}) {
  return {
    alt_override: row.alt_override,
    cta_label: row.cta_label,
    cta_url: row.cta_url,
    enabled: row.enabled,
    id: row.id,
    image_set_id: row.image_set_id,
    image_url: row.image_url,
    metadata_json: row.metadata_json ?? {},
    reference_id: row.reference_id,
    reference_type: row.reference_type,
    section_id: productionSectionId,
    sort_order: row.sort_order,
    title_override: row.title_override,
    use_custom_image: row.use_custom_image === true,
  };
}

function toCollectionPayload(row: CatalogCollectionPresentationPromotionRow) {
  return {
    collection_slug: row.collection_slug,
    is_public: row.is_public,
    metadata_json: row.metadata_json ?? {},
    public_accent_color: row.public_accent_color,
    public_description: row.public_description,
    public_display_name: row.public_display_name,
    public_hero_text_color: row.public_hero_text_color,
    public_homepage_order: row.public_homepage_order,
    public_image_url: row.public_image_url,
    public_logo_url: row.public_logo_url,
    public_order: row.public_order,
    public_surface_color: row.public_surface_color,
    public_surface_text_color: row.public_surface_text_color,
    public_tile_image_url: row.public_tile_image_url,
    status: row.status,
  };
}

function toThemePresentationPayload(row: CatalogThemePresentationPromotionRow) {
  return Object.fromEntries(
    CMS_THEME_PRESENTATION_FIELDS.map((field) => [field, row[field]]),
  );
}

async function applyCmsPromotionPlan({
  plan,
  productionSupabaseClient,
}: {
  plan: CmsPromotionPlan;
  productionSupabaseClient: CmsPromotionSupabaseClient;
}): Promise<Map<string, string>> {
  if (plan.snapshot.pageSections.length) {
    const { data, error } = await productionSupabaseClient
      .from(PUBLIC_PAGE_SECTIONS_TABLE)
      .upsert(plan.snapshot.pageSections.map(toSectionPayload), {
        onConflict: 'page_key,section_key',
      })
      .select('id, page_key, section_key');

    if (error) {
      throw new Error(
        `Unable to promote public_page_sections. ${JSON.stringify(error)}`,
      );
    }

    const productionSectionIdByPageSectionKey = new Map(
      (
        (data as Array<{
          id: string;
          page_key: string;
          section_key: string;
        }> | null) ?? []
      ).map((row) => [`${row.page_key}:${row.section_key}`, row.id] as const),
    );

    plan.productionSectionIdByStagingSectionId = new Map(
      plan.snapshot.pageSections.flatMap((stagingRow) => {
        const productionId = productionSectionIdByPageSectionKey.get(
          `${stagingRow.page_key}:${stagingRow.section_key}`,
        );

        return productionId ? [[stagingRow.id, productionId] as const] : [];
      }),
    );
  }

  const productionSectionIds = [
    ...new Set([...plan.productionSectionIdByStagingSectionId.values()]),
  ];

  if (productionSectionIds.length) {
    const { error: deleteError } = await productionSupabaseClient
      .from(PUBLIC_PAGE_SECTION_ITEMS_TABLE)
      .delete()
      .in('section_id', productionSectionIds);

    if (deleteError) {
      throw new Error(
        `Unable to replace public_page_section_items. ${JSON.stringify(deleteError)}`,
      );
    }

    const itemPayload = plan.snapshot.pageSectionItems.flatMap((row) => {
      const productionSectionId =
        plan.productionSectionIdByStagingSectionId.get(row.section_id);

      return productionSectionId
        ? [
            toSectionItemPayload({
              productionSectionId,
              row,
            }),
          ]
        : [];
    });

    if (itemPayload.length) {
      const { error } = await productionSupabaseClient
        .from(PUBLIC_PAGE_SECTION_ITEMS_TABLE)
        .insert(itemPayload);

      if (error) {
        throw new Error(
          `Unable to promote public_page_section_items. ${JSON.stringify(error)}`,
        );
      }
    }
  }

  if (plan.snapshot.collectionPresentations.length) {
    const { error } = await productionSupabaseClient
      .from(CATALOG_COLLECTION_PRESENTATIONS_TABLE)
      .upsert(plan.snapshot.collectionPresentations.map(toCollectionPayload), {
        onConflict: 'collection_slug',
      });

    if (error) {
      throw new Error(
        `Unable to promote catalog_collection_presentations. ${JSON.stringify(error)}`,
      );
    }
  }

  for (const row of plan.snapshot.themePresentations) {
    const { error } = await productionSupabaseClient
      .from(CATALOG_THEMES_TABLE)
      .update(toThemePresentationPayload(row))
      .eq('slug', row.slug);

    if (error) {
      throw new Error(
        `Unable to promote catalog_themes presentation for ${row.slug}. ${JSON.stringify(error)}`,
      );
    }
  }

  return plan.productionSectionIdByStagingSectionId;
}

function getCmsPromotionClients({
  createProductionSupabaseClient,
  createStagingSupabaseClient,
}: PromoteCmsFromStagingToProductionDependencies): {
  productionSupabaseClient: CmsPromotionSupabaseClient;
  stagingSupabaseClient: CmsPromotionSupabaseClient;
} {
  if (createProductionSupabaseClient || createStagingSupabaseClient) {
    const fallbackClients = createCmsPromotionClients();

    return {
      productionSupabaseClient:
        createProductionSupabaseClient?.() ??
        fallbackClients.productionSupabaseClient,
      stagingSupabaseClient:
        createStagingSupabaseClient?.() ??
        fallbackClients.stagingSupabaseClient,
    };
  }

  return createCmsPromotionClients();
}

export async function previewCmsPromotionFromStagingToProduction(
  dependencies: PromoteCmsFromStagingToProductionDependencies = {},
): Promise<CmsPromotionPreviewResult> {
  const now = dependencies.now ?? (() => new Date());
  const { productionSupabaseClient, stagingSupabaseClient } =
    getCmsPromotionClients(dependencies);
  const plan = await buildCmsPromotionPlan({
    now,
    productionSupabaseClient,
    stagingSupabaseClient,
  });

  return {
    affectedCollectionSlugs: plan.affectedCollectionSlugs,
    affectedThemeSlugs: plan.affectedThemeSlugs,
    generatedAt: plan.generatedAt,
    pendingPromoteCount: plan.pendingPromoteCount,
    samples: plan.samples,
    sourceEnvironment: plan.sourceEnvironment,
    status: plan.status,
    tables: plan.tables,
    targetEnvironment: plan.targetEnvironment,
  };
}

export async function promoteCmsFromStagingToProduction(
  dependencies: PromoteCmsFromStagingToProductionDependencies = {},
): Promise<CmsPromotionResult> {
  const now = dependencies.now ?? (() => new Date());
  const startedAt = now();
  const { productionSupabaseClient, stagingSupabaseClient } =
    getCmsPromotionClients(dependencies);
  const plan = await buildCmsPromotionPlan({
    now,
    productionSupabaseClient,
    stagingSupabaseClient,
  });

  await applyCmsPromotionPlan({
    plan,
    productionSupabaseClient,
  });

  return {
    affectedCollectionSlugs: plan.affectedCollectionSlugs,
    affectedThemeSlugs: plan.affectedThemeSlugs,
    applied: true,
    durationMs: now().getTime() - startedAt.getTime(),
    generatedAt: plan.generatedAt,
    pendingPromoteCount: plan.pendingPromoteCount,
    samples: plan.samples,
    sourceEnvironment: plan.sourceEnvironment,
    startedAt: startedAt.toISOString(),
    status: plan.status,
    tables: plan.tables,
    targetEnvironment: plan.targetEnvironment,
  };
}
