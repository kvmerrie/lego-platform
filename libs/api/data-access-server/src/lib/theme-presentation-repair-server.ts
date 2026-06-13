import { createSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import {
  buildThemePath,
  cacheTags,
  getMissingProductionSupabaseEnvKeys,
  getMissingStagingSupabaseEnvKeys,
  getProductionSupabaseConfig,
  getStagingSupabaseConfig,
  hasProductionSupabaseConfig,
  hasStagingSupabaseConfig,
  webPathnames,
} from '@lego-platform/shared/config';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  revalidatePublicWeb,
  type PublicWebRevalidationResult,
} from './public-web-revalidation-server';

const CATALOG_THEMES_TABLE = 'catalog_themes';
const THEME_PRESENTATION_REPAIR_PAGE_SIZE = 1000;

export const THEME_PRESENTATION_REPAIR_FIELDS = [
  'public_display_name',
  'public_image_url',
  'public_logo_url',
  'public_accent_color',
  'public_surface_color',
] as const;

export type ThemePresentationRepairField =
  (typeof THEME_PRESENTATION_REPAIR_FIELDS)[number];

type ThemePresentationRepairSupabaseClient = Pick<SupabaseClient, 'from'>;

interface CatalogThemePresentationRow {
  display_name: string;
  id: string;
  is_public: boolean;
  slug: string;
  status: string;
  public_accent_color: string | null;
  public_display_name: string | null;
  public_image_url: string | null;
  public_logo_url: string | null;
  public_surface_color: string | null;
}

export interface ThemePresentationFieldRepair {
  field: ThemePresentationRepairField;
  productionBefore: string | null;
  stagingValue: string;
}

export interface ThemePresentationThemeRepair {
  displayName: string;
  fields: ThemePresentationFieldRepair[];
  id: string;
  matchedBy: 'id' | 'slug';
  slug: string;
}

export interface ThemePresentationStillMissing {
  displayName: string;
  fields: ThemePresentationRepairField[];
  id: string;
  slug: string;
}

export interface ThemePresentationRepairOptions {
  dryRun?: boolean;
  revalidate?: boolean;
  write?: boolean;
}

export interface ThemePresentationRepairDependencies {
  createProductionSupabaseClient?: () => ThemePresentationRepairSupabaseClient;
  createStagingSupabaseClient?: () => ThemePresentationRepairSupabaseClient;
  now?: () => Date;
  productionSupabaseUrl?: string;
  revalidatePublicWebFn?: typeof revalidatePublicWeb;
  stagingSupabaseUrl?: string;
}

export interface ThemePresentationRepairResult {
  dryRun: boolean;
  durationMs: number;
  fieldsBackfilledCount: number;
  productionThemeCount: number;
  revalidation?: PublicWebRevalidationResult;
  revalidationWarning?: string;
  startedAt: string;
  stagingThemeCount: number;
  status: 'ok';
  themesBackfilled: ThemePresentationThemeRepair[];
  themesStillMissingPresentation: ThemePresentationStillMissing[];
  write: boolean;
}

function normalizeSupabaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function assertThemePresentationRepairConfig({
  productionSupabaseUrl,
  stagingSupabaseUrl,
}: {
  productionSupabaseUrl?: string;
  stagingSupabaseUrl?: string;
}) {
  if (!hasStagingSupabaseConfig() && !stagingSupabaseUrl) {
    throw new Error(
      `staging Supabase config missing: ${getMissingStagingSupabaseEnvKeys().join(', ')}`,
    );
  }

  if (!hasProductionSupabaseConfig() && !productionSupabaseUrl) {
    throw new Error(
      `production Supabase config missing: ${getMissingProductionSupabaseEnvKeys().join(', ')}`,
    );
  }

  const normalizedStagingUrl = normalizeSupabaseUrl(
    stagingSupabaseUrl ?? getStagingSupabaseConfig().url,
  );
  const normalizedProductionUrl = normalizeSupabaseUrl(
    productionSupabaseUrl ?? getProductionSupabaseConfig().url,
  );

  if (normalizedStagingUrl === normalizedProductionUrl) {
    throw new Error('refusing to repair identical Supabase targets');
  }
}

function createThemePresentationRepairClients(): {
  productionClient: ThemePresentationRepairSupabaseClient;
  productionSupabaseUrl: string;
  stagingClient: ThemePresentationRepairSupabaseClient;
  stagingSupabaseUrl: string;
} {
  const stagingConfig = getStagingSupabaseConfig();
  const productionConfig = getProductionSupabaseConfig();

  assertThemePresentationRepairConfig({
    productionSupabaseUrl: productionConfig.url,
    stagingSupabaseUrl: stagingConfig.url,
  });

  return {
    productionClient: createSupabaseAdminClient(productionConfig),
    productionSupabaseUrl: productionConfig.url,
    stagingClient: createSupabaseAdminClient(stagingConfig),
    stagingSupabaseUrl: stagingConfig.url,
  };
}

function isNonEmptyPresentationValue(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function readPresentationValue(
  row: CatalogThemePresentationRow,
  field: ThemePresentationRepairField,
): string | null {
  const value = row[field];

  return isNonEmptyPresentationValue(value) ? value.trim() : null;
}

async function readCatalogThemePresentationRows({
  client,
}: {
  client: ThemePresentationRepairSupabaseClient;
}): Promise<CatalogThemePresentationRow[]> {
  const rows: CatalogThemePresentationRow[] = [];

  for (let offset = 0; ; offset += THEME_PRESENTATION_REPAIR_PAGE_SIZE) {
    const { data, error } = await client
      .from(CATALOG_THEMES_TABLE)
      .select(
        'id, slug, display_name, status, is_public, public_display_name, public_image_url, public_logo_url, public_accent_color, public_surface_color',
      )
      .order('slug', { ascending: true })
      .range(offset, offset + THEME_PRESENTATION_REPAIR_PAGE_SIZE - 1);

    if (error) {
      throw new Error(
        `Unable to read ${CATALOG_THEMES_TABLE}: ${error.message}`,
      );
    }

    rows.push(...((data ?? []) as CatalogThemePresentationRow[]));

    if ((data ?? []).length < THEME_PRESENTATION_REPAIR_PAGE_SIZE) {
      return rows;
    }
  }
}

function indexThemesById(
  rows: readonly CatalogThemePresentationRow[],
): Map<string, CatalogThemePresentationRow> {
  return new Map(rows.map((row) => [row.id, row]));
}

function indexThemesBySlug(
  rows: readonly CatalogThemePresentationRow[],
): Map<string, CatalogThemePresentationRow> {
  return new Map(rows.map((row) => [row.slug, row]));
}

function findStagingThemeMatch({
  stagingById,
  stagingBySlug,
  theme,
}: {
  stagingById: ReadonlyMap<string, CatalogThemePresentationRow>;
  stagingBySlug: ReadonlyMap<string, CatalogThemePresentationRow>;
  theme: CatalogThemePresentationRow;
}): { matchedBy: 'id' | 'slug'; theme: CatalogThemePresentationRow } | null {
  const matchById = stagingById.get(theme.id);

  if (matchById) {
    return {
      matchedBy: 'id',
      theme: matchById,
    };
  }

  const matchBySlug = stagingBySlug.get(theme.slug);

  return matchBySlug
    ? {
        matchedBy: 'slug',
        theme: matchBySlug,
      }
    : null;
}

function planThemePresentationRepairs({
  productionThemes,
  stagingThemes,
}: {
  productionThemes: readonly CatalogThemePresentationRow[];
  stagingThemes: readonly CatalogThemePresentationRow[];
}): ThemePresentationThemeRepair[] {
  const stagingById = indexThemesById(stagingThemes);
  const stagingBySlug = indexThemesBySlug(stagingThemes);
  const repairs: ThemePresentationThemeRepair[] = [];

  for (const productionTheme of productionThemes) {
    const stagingMatch = findStagingThemeMatch({
      stagingById,
      stagingBySlug,
      theme: productionTheme,
    });

    if (!stagingMatch) {
      continue;
    }

    const fields = THEME_PRESENTATION_REPAIR_FIELDS.flatMap((field) => {
      const productionValue = readPresentationValue(productionTheme, field);
      const stagingValue = readPresentationValue(stagingMatch.theme, field);

      return !productionValue && stagingValue
        ? [
            {
              field,
              productionBefore: productionValue,
              stagingValue,
            },
          ]
        : [];
    });

    if (fields.length > 0) {
      repairs.push({
        displayName: productionTheme.display_name,
        fields,
        id: productionTheme.id,
        matchedBy: stagingMatch.matchedBy,
        slug: productionTheme.slug,
      });
    }
  }

  return repairs;
}

function listStillMissingPresentation({
  productionThemes,
  repairs,
}: {
  productionThemes: readonly CatalogThemePresentationRow[];
  repairs: readonly ThemePresentationThemeRepair[];
}): ThemePresentationStillMissing[] {
  const repairFieldsByThemeId = new Map(
    repairs.map((repair) => [
      repair.id,
      new Set(repair.fields.map((fieldRepair) => fieldRepair.field)),
    ]),
  );

  return productionThemes.flatMap((theme) => {
    if (theme.status !== 'active' || theme.is_public === false) {
      return [];
    }

    const repairedFields = repairFieldsByThemeId.get(theme.id) ?? new Set();
    const missingFields = THEME_PRESENTATION_REPAIR_FIELDS.filter(
      (field) =>
        !readPresentationValue(theme, field) && !repairedFields.has(field),
    );

    return missingFields.length > 0
      ? [
          {
            displayName: theme.display_name,
            fields: missingFields,
            id: theme.id,
            slug: theme.slug,
          },
        ]
      : [];
  });
}

async function applyThemePresentationRepairs({
  client,
  repairs,
}: {
  client: ThemePresentationRepairSupabaseClient;
  repairs: readonly ThemePresentationThemeRepair[];
}): Promise<void> {
  for (const repair of repairs) {
    const updatePayload = Object.fromEntries(
      repair.fields.map((fieldRepair) => [
        fieldRepair.field,
        fieldRepair.stagingValue,
      ]),
    );

    const { error } = await client
      .from(CATALOG_THEMES_TABLE)
      .update(updatePayload)
      .eq('id', repair.id);

    if (error) {
      throw new Error(
        `Unable to repair ${CATALOG_THEMES_TABLE} presentation for ${repair.slug}: ${error.message}`,
      );
    }
  }
}

async function revalidateThemePresentationRepair({
  revalidatePublicWebFn,
  repairs,
}: {
  revalidatePublicWebFn: typeof revalidatePublicWeb;
  repairs: readonly ThemePresentationThemeRepair[];
}): Promise<PublicWebRevalidationResult> {
  const affectedThemeSlugs = [...new Set(repairs.map((repair) => repair.slug))];

  return revalidatePublicWebFn({
    paths: [
      webPathnames.themes,
      ...affectedThemeSlugs.map((slug) => buildThemePath(slug)),
    ],
    reason: 'theme_presentation_repair',
    tags: [
      cacheTags.themes(),
      ...affectedThemeSlugs.map((slug) => cacheTags.theme(slug)),
    ],
  });
}

export async function repairThemePresentationFromStaging({
  dependencies = {},
  options = {},
}: {
  dependencies?: ThemePresentationRepairDependencies;
  options?: ThemePresentationRepairOptions;
} = {}): Promise<ThemePresentationRepairResult> {
  const startedAtDate = dependencies.now?.() ?? new Date();
  const dryRun = options.write !== true || options.dryRun === true;
  const write = options.write === true && options.dryRun !== true;
  const revalidate = options.revalidate !== false;
  const clients =
    dependencies.createProductionSupabaseClient &&
    dependencies.createStagingSupabaseClient
      ? {
          productionClient: dependencies.createProductionSupabaseClient(),
          productionSupabaseUrl: dependencies.productionSupabaseUrl,
          stagingClient: dependencies.createStagingSupabaseClient(),
          stagingSupabaseUrl: dependencies.stagingSupabaseUrl,
        }
      : createThemePresentationRepairClients();

  assertThemePresentationRepairConfig({
    productionSupabaseUrl: clients.productionSupabaseUrl,
    stagingSupabaseUrl: clients.stagingSupabaseUrl,
  });

  const [stagingThemes, productionThemes] = await Promise.all([
    readCatalogThemePresentationRows({
      client: clients.stagingClient,
    }),
    readCatalogThemePresentationRows({
      client: clients.productionClient,
    }),
  ]);
  const themesBackfilled = planThemePresentationRepairs({
    productionThemes,
    stagingThemes,
  });
  let revalidation: PublicWebRevalidationResult | undefined;
  let revalidationWarning: string | undefined;

  if (write && themesBackfilled.length > 0) {
    await applyThemePresentationRepairs({
      client: clients.productionClient,
      repairs: themesBackfilled,
    });

    if (revalidate) {
      try {
        revalidation = await revalidateThemePresentationRepair({
          revalidatePublicWebFn:
            dependencies.revalidatePublicWebFn ?? revalidatePublicWeb,
          repairs: themesBackfilled,
        });
      } catch (error) {
        revalidationWarning =
          error instanceof Error
            ? error.message
            : 'Public web revalidation failed after theme presentation repair.';
      }
    }
  }

  return {
    dryRun,
    durationMs: Date.now() - startedAtDate.getTime(),
    fieldsBackfilledCount: themesBackfilled.reduce(
      (sum, repair) => sum + repair.fields.length,
      0,
    ),
    productionThemeCount: productionThemes.length,
    ...(revalidation ? { revalidation } : {}),
    ...(revalidationWarning ? { revalidationWarning } : {}),
    startedAt: startedAtDate.toISOString(),
    stagingThemeCount: stagingThemes.length,
    status: 'ok',
    themesBackfilled,
    themesStillMissingPresentation: listStillMissingPresentation({
      productionThemes,
      repairs: themesBackfilled,
    }),
    write,
  };
}
