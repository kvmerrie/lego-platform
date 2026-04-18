import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type CatalogCanonicalSet,
  type CatalogSetOverlay,
  type CatalogSetRecord,
  type CatalogSnapshot,
  type CatalogSyncManifest,
  createCatalogSetRecord,
  getCanonicalCatalogSetId,
  getCatalogProductSlug,
  mergeCanonicalCatalogSets,
  resolveCatalogThemeIdentity,
  resolveCatalogThemeIdentityFromPersistence,
  sortCanonicalCatalogSets,
} from '@lego-platform/catalog/util';
import {
  catalogSetOverlays,
  catalogSnapshot,
} from '@lego-platform/catalog/data-access';
import { hasServerSupabaseConfig } from '@lego-platform/shared/config';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import {
  catalogSnapshotScopeSetNumbers,
  getHomepageFeaturedSnapshotSetIds,
} from './catalog-sync-curation';
import {
  checkCatalogGeneratedArtifacts,
  type CatalogGeneratedArtifactCheckResult,
  readCatalogGeneratedArtifacts,
  writeCatalogGeneratedArtifacts,
} from './catalog-artifact-writer';

const CATALOG_SETS_OVERLAY_TABLE = 'catalog_sets_overlay';
const CATALOG_SOURCE_THEMES_TABLE = 'catalog_source_themes';
const CATALOG_THEMES_TABLE = 'catalog_themes';
const CATALOG_THEME_MAPPINGS_TABLE = 'catalog_theme_mappings';

const CATALOG_SYNC_SOURCE = 'supabase-canonical-catalog';
const CATALOG_SYNC_NOTES =
  'Generated from the Supabase-first canonical catalog source. Snapshot records remain a transitional fallback and homepage featured ids stay locally curated.';

type CatalogSyncSupabaseClient = Pick<SupabaseClient, 'from'>;

interface CatalogOverlaySetRow {
  created_at: string;
  image_url: string | null;
  name: string;
  piece_count: number;
  primary_theme_id: string | null;
  release_year: number;
  set_id: string;
  slug: string;
  source: string;
  source_theme_id: string | null;
  source_set_number: string;
  status: string;
  theme: string;
  updated_at: string;
}

interface CatalogSourceThemeRow {
  id: string;
  source_theme_name: string;
}

interface CatalogThemeMappingRow {
  primary_theme_id: string;
  source_theme_id: string;
}

interface CatalogThemeRow {
  display_name: string;
  id: string;
  slug: string;
  status: 'active' | 'inactive';
}

export interface CatalogSyncArtifacts {
  catalogSnapshot: CatalogSnapshot;
  catalogSyncManifest: CatalogSyncManifest;
}

export interface CatalogSyncRunResult extends CatalogSyncArtifacts {
  artifactCheck: CatalogGeneratedArtifactCheckResult;
  mode: 'check' | 'write';
}

export interface BuildCatalogSyncArtifactsOptions {
  scopedSetNumbers?: readonly string[];
  listCanonicalCatalogSetsFn?: typeof listCatalogSyncCanonicalCatalogSets;
  now?: Date;
}

export interface RunCatalogSyncOptions {
  listCanonicalCatalogSetsFn?: typeof listCatalogSyncCanonicalCatalogSets;
  mode?: 'check' | 'write';
  now?: Date;
  workspaceRoot: string;
}

export interface LocalCatalogSyncCheckResult extends CatalogSyncArtifacts {
  artifactCheck: CatalogGeneratedArtifactCheckResult;
  mode: 'local-check';
}

const snapshotCanonicalCatalogSets = catalogSnapshot.setRecords.map(
  toCanonicalCatalogSetFromSnapshotRecord,
);

const snapshotCatalogRecordById = new Map(
  catalogSnapshot.setRecords.map((catalogSetRecord) => [
    catalogSetRecord.canonicalId,
    catalogSetRecord,
  ]),
);

function toCanonicalCatalogSetFromSnapshotRecord(
  catalogSetRecord: CatalogSetRecord,
): CatalogCanonicalSet {
  const themeIdentity = resolveCatalogThemeIdentity({
    rawTheme: catalogSetRecord.theme,
  });

  return {
    createdAt: catalogSnapshot.generatedAt,
    imageUrl: catalogSetRecord.imageUrl,
    name: catalogSetRecord.name,
    pieceCount: catalogSetRecord.pieces,
    primaryTheme: themeIdentity.primaryTheme,
    releaseYear: catalogSetRecord.releaseYear,
    secondaryLabels: themeIdentity.secondaryThemes,
    setId: catalogSetRecord.canonicalId,
    slug: catalogSetRecord.slug,
    source: 'snapshot',
    sourceSetNumber: catalogSetRecord.sourceSetNumber,
    status: 'active',
    updatedAt: catalogSnapshot.generatedAt,
  };
}

function toCanonicalCatalogSetFromOverlayRow({
  row,
  themeIdentity = resolveCatalogThemeIdentity({
    rawTheme: row.theme,
  }),
}: {
  row: CatalogOverlaySetRow;
  themeIdentity?: ReturnType<typeof resolveCatalogThemeIdentity>;
}): CatalogCanonicalSet {
  return {
    createdAt: row.created_at,
    imageUrl: row.image_url ?? undefined,
    name: row.name,
    pieceCount: row.piece_count,
    primaryTheme: themeIdentity.primaryTheme,
    releaseYear: row.release_year,
    secondaryLabels: themeIdentity.secondaryThemes,
    setId: row.set_id,
    slug: row.slug,
    source: 'rebrickable',
    sourceSetNumber: row.source_set_number,
    status: row.status === 'inactive' ? 'inactive' : 'active',
    updatedAt: row.updated_at,
  };
}

function toCatalogSetRecordFromCanonicalCatalogSet(
  canonicalCatalogSet: CatalogCanonicalSet,
): CatalogSetRecord {
  const snapshotCatalogSetRecord = snapshotCatalogRecordById.get(
    canonicalCatalogSet.setId,
  );

  if (snapshotCatalogSetRecord) {
    return {
      ...snapshotCatalogSetRecord,
      sourceSetNumber:
        canonicalCatalogSet.sourceSetNumber ??
        snapshotCatalogSetRecord.sourceSetNumber,
      name: canonicalCatalogSet.name,
      theme: canonicalCatalogSet.primaryTheme,
      releaseYear: canonicalCatalogSet.releaseYear,
      pieces: canonicalCatalogSet.pieceCount,
      ...(canonicalCatalogSet.imageUrl
        ? {
            imageUrl: canonicalCatalogSet.imageUrl,
          }
        : {}),
    };
  }

  if (!canonicalCatalogSet.sourceSetNumber) {
    throw new Error(
      `Catalog sync source is missing sourceSetNumber for ${canonicalCatalogSet.setId}.`,
    );
  }

  return createCatalogSetRecord({
    sourceSetNumber: canonicalCatalogSet.sourceSetNumber,
    name: canonicalCatalogSet.name,
    theme: canonicalCatalogSet.primaryTheme,
    releaseYear: canonicalCatalogSet.releaseYear,
    pieces: canonicalCatalogSet.pieceCount,
    imageUrl: canonicalCatalogSet.imageUrl,
  });
}

function haveCatalogArtifactsChanged({
  currentCatalogSnapshot,
  currentCatalogSyncManifest,
  nextCatalogSnapshot,
  nextCatalogSyncManifest,
}: {
  currentCatalogSnapshot: CatalogSnapshot;
  currentCatalogSyncManifest: CatalogSyncManifest;
  nextCatalogSnapshot: CatalogSnapshot;
  nextCatalogSyncManifest: CatalogSyncManifest;
}): boolean {
  return (
    JSON.stringify({
      source: currentCatalogSnapshot.source,
      setRecords: currentCatalogSnapshot.setRecords,
    }) !==
      JSON.stringify({
        source: nextCatalogSnapshot.source,
        setRecords: nextCatalogSnapshot.setRecords,
      }) ||
    JSON.stringify({
      source: currentCatalogSyncManifest.source,
      recordCount: currentCatalogSyncManifest.recordCount,
      homepageFeaturedSetIds: currentCatalogSyncManifest.homepageFeaturedSetIds,
      notes: currentCatalogSyncManifest.notes,
    }) !==
      JSON.stringify({
        source: nextCatalogSyncManifest.source,
        recordCount: nextCatalogSyncManifest.recordCount,
        homepageFeaturedSetIds: nextCatalogSyncManifest.homepageFeaturedSetIds,
        notes: nextCatalogSyncManifest.notes,
      })
  );
}

function withCatalogGeneratedAt({
  artifacts,
  generatedAt,
}: {
  artifacts: CatalogSyncArtifacts;
  generatedAt: string;
}): CatalogSyncArtifacts {
  return {
    catalogSnapshot: {
      ...artifacts.catalogSnapshot,
      generatedAt,
    },
    catalogSyncManifest: {
      ...artifacts.catalogSyncManifest,
      generatedAt,
    },
  };
}

async function stabilizeCatalogGeneratedAt({
  catalogSnapshot,
  catalogSyncManifest,
  workspaceRoot,
}: {
  catalogSnapshot: CatalogSnapshot;
  catalogSyncManifest: CatalogSyncManifest;
  workspaceRoot: string;
}): Promise<CatalogSyncArtifacts> {
  const artifacts = {
    catalogSnapshot,
    catalogSyncManifest,
  };
  const currentArtifacts = await readCatalogGeneratedArtifacts({
    workspaceRoot,
  });

  if (!currentArtifacts) {
    return artifacts;
  }

  if (
    currentArtifacts.catalogSnapshot.generatedAt !==
    currentArtifacts.catalogSyncManifest.generatedAt
  ) {
    return artifacts;
  }

  if (
    haveCatalogArtifactsChanged({
      currentCatalogSnapshot: currentArtifacts.catalogSnapshot,
      currentCatalogSyncManifest: currentArtifacts.catalogSyncManifest,
      nextCatalogSnapshot: artifacts.catalogSnapshot,
      nextCatalogSyncManifest: artifacts.catalogSyncManifest,
    })
  ) {
    return artifacts;
  }

  return withCatalogGeneratedAt({
    artifacts,
    generatedAt: currentArtifacts.catalogSnapshot.generatedAt,
  });
}

async function listCatalogSyncOverlayRows({
  includeInactive = false,
  supabaseClient,
}: {
  includeInactive?: boolean;
  supabaseClient: CatalogSyncSupabaseClient;
}): Promise<CatalogOverlaySetRow[]> {
  let query = supabaseClient
    .from(CATALOG_SETS_OVERLAY_TABLE)
    .select(
      'set_id, slug, name, theme, piece_count, release_year, image_url, source, source_set_number, source_theme_id, primary_theme_id, status, created_at, updated_at',
    )
    .order('created_at', { ascending: true });

  if (!includeInactive) {
    query = query.eq('status', 'active');
  }

  const { data, error } = await query;

  if (error) {
    throw new Error('Unable to load the catalog sync source from Supabase.');
  }

  return (data as CatalogOverlaySetRow[] | null) ?? [];
}

async function listCatalogThemeIdentityBySetId({
  overlayRows,
  supabaseClient,
}: {
  overlayRows: readonly CatalogOverlaySetRow[];
  supabaseClient: CatalogSyncSupabaseClient;
}): Promise<Map<string, ReturnType<typeof resolveCatalogThemeIdentity>>> {
  const fallbackThemeIdentityBySetId = new Map(
    overlayRows.map((overlayRow) => [
      overlayRow.set_id,
      resolveCatalogThemeIdentity({
        rawTheme: overlayRow.theme,
      }),
    ]),
  );
  const sourceThemeIds = [
    ...new Set(
      overlayRows
        .map((overlayRow) => overlayRow.source_theme_id)
        .filter((sourceThemeId): sourceThemeId is string =>
          Boolean(sourceThemeId),
        ),
    ),
  ];
  const primaryThemeIds = [
    ...new Set(
      overlayRows
        .map((overlayRow) => overlayRow.primary_theme_id)
        .filter((primaryThemeId): primaryThemeId is string =>
          Boolean(primaryThemeId),
        ),
    ),
  ];

  if (!sourceThemeIds.length && !primaryThemeIds.length) {
    return fallbackThemeIdentityBySetId;
  }

  try {
    const [sourceThemeResponse, themeMappingResponse] = await Promise.all([
      sourceThemeIds.length
        ? supabaseClient
            .from(CATALOG_SOURCE_THEMES_TABLE)
            .select('id, source_theme_name')
            .in('id', sourceThemeIds)
        : Promise.resolve({ data: [], error: null }),
      sourceThemeIds.length
        ? supabaseClient
            .from(CATALOG_THEME_MAPPINGS_TABLE)
            .select('source_theme_id, primary_theme_id')
            .in('source_theme_id', sourceThemeIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (sourceThemeResponse.error || themeMappingResponse.error) {
      return fallbackThemeIdentityBySetId;
    }

    const sourceThemes =
      (sourceThemeResponse.data as CatalogSourceThemeRow[] | null) ?? [];
    const themeMappings =
      (themeMappingResponse.data as CatalogThemeMappingRow[] | null) ?? [];
    const primaryThemeIdsToLoad = [
      ...new Set([
        ...primaryThemeIds,
        ...themeMappings.map((themeMapping) => themeMapping.primary_theme_id),
      ]),
    ];
    const primaryThemeResponse = primaryThemeIdsToLoad.length
      ? await supabaseClient
          .from(CATALOG_THEMES_TABLE)
          .select('id, slug, display_name, status')
          .in('id', primaryThemeIdsToLoad)
      : { data: [], error: null };

    if (primaryThemeResponse.error) {
      return fallbackThemeIdentityBySetId;
    }

    const sourceThemeById = new Map(
      sourceThemes.map((sourceTheme) => [sourceTheme.id, sourceTheme]),
    );
    const primaryThemeById = new Map(
      ((primaryThemeResponse.data as CatalogThemeRow[] | null) ?? []).map(
        (catalogTheme) => [catalogTheme.id, catalogTheme],
      ),
    );
    const primaryThemeIdBySourceThemeId = new Map(
      themeMappings.map((themeMapping) => [
        themeMapping.source_theme_id,
        themeMapping.primary_theme_id,
      ]),
    );

    return new Map(
      overlayRows.map((overlayRow) => {
        const sourceThemeName = overlayRow.source_theme_id
          ? sourceThemeById.get(overlayRow.source_theme_id)?.source_theme_name
          : undefined;
        const primaryThemeId =
          overlayRow.primary_theme_id ??
          (overlayRow.source_theme_id
            ? primaryThemeIdBySourceThemeId.get(overlayRow.source_theme_id)
            : undefined);
        const primaryThemeName = primaryThemeId
          ? primaryThemeById.get(primaryThemeId)?.display_name
          : undefined;

        return [
          overlayRow.set_id,
          resolveCatalogThemeIdentityFromPersistence({
            legacyTheme: overlayRow.theme,
            primaryThemeName,
            sourceThemeName,
          }),
        ] as const;
      }),
    );
  } catch {
    return fallbackThemeIdentityBySetId;
  }
}

async function listCatalogSyncCanonicalCatalogSets({
  includeInactive = false,
  supabaseClient,
}: {
  includeInactive?: boolean;
  supabaseClient?: CatalogSyncSupabaseClient;
} = {}): Promise<CatalogCanonicalSet[]> {
  if (!supabaseClient && !hasServerSupabaseConfig()) {
    return snapshotCanonicalCatalogSets;
  }

  try {
    const activeSupabaseClient =
      supabaseClient ?? getServerSupabaseAdminClient();
    const overlayRows = await listCatalogSyncOverlayRows({
      includeInactive,
      supabaseClient: activeSupabaseClient,
    });
    const themeIdentityBySetId = await listCatalogThemeIdentityBySetId({
      overlayRows,
      supabaseClient: activeSupabaseClient,
    });
    const canonicalOverlaySets = overlayRows.map((overlayRow) =>
      toCanonicalCatalogSetFromOverlayRow({
        row: overlayRow,
        themeIdentity: themeIdentityBySetId.get(overlayRow.set_id),
      }),
    );

    return sortCanonicalCatalogSets(
      mergeCanonicalCatalogSets({
        fallbackSets: snapshotCanonicalCatalogSets,
        preferredSets: canonicalOverlaySets,
      }),
    );
  } catch (error) {
    if (!supabaseClient) {
      return snapshotCanonicalCatalogSets;
    }

    throw error;
  }
}

async function resolveCatalogSyncScopedCanonicalSets({
  scopedSetNumbers = catalogSnapshotScopeSetNumbers,
  listCanonicalCatalogSetsFn = listCatalogSyncCanonicalCatalogSets,
}: {
  scopedSetNumbers?: readonly string[];
  listCanonicalCatalogSetsFn?: typeof listCatalogSyncCanonicalCatalogSets;
}): Promise<CatalogCanonicalSet[]> {
  const canonicalCatalogSets = await listCanonicalCatalogSetsFn();
  const canonicalCatalogSetBySourceSetNumber = new Map(
    canonicalCatalogSets
      .filter(
        (
          canonicalCatalogSet,
        ): canonicalCatalogSet is CatalogCanonicalSet & {
          sourceSetNumber: string;
        } => Boolean(canonicalCatalogSet.sourceSetNumber),
      )
      .map((canonicalCatalogSet) => [
        canonicalCatalogSet.sourceSetNumber,
        canonicalCatalogSet,
      ]),
  );

  return scopedSetNumbers.map((scopedSetNumber) => {
    const canonicalCatalogSet =
      canonicalCatalogSetBySourceSetNumber.get(scopedSetNumber);

    if (!canonicalCatalogSet) {
      throw new Error(
        `Catalog sync source is missing scoped set ${scopedSetNumber}.`,
      );
    }

    return canonicalCatalogSet;
  });
}

export function validateCatalogSyncArtifacts({
  catalogSnapshot,
  catalogSyncManifest,
  catalogSetOverlays: configuredCatalogSetOverlays = catalogSetOverlays,
}: CatalogSyncArtifacts & {
  catalogSetOverlays?: readonly CatalogSetOverlay[];
}): void {
  if (catalogSnapshot.setRecords.length === 0) {
    throw new Error('Catalog sync produced no set records.');
  }

  if (catalogSyncManifest.recordCount !== catalogSnapshot.setRecords.length) {
    throw new Error(
      'Catalog sync manifest recordCount does not match the snapshot record count.',
    );
  }

  const canonicalIds = new Set<string>();
  const productSlugs = new Set<string>();
  const sourceSetNumbers = new Set<string>();
  const slugs = new Set<string>();
  const catalogSetOverlayById = new Map(
    configuredCatalogSetOverlays.map((catalogSetOverlay) => [
      catalogSetOverlay.canonicalId,
      catalogSetOverlay,
    ]),
  );

  for (const catalogSetRecord of catalogSnapshot.setRecords) {
    const catalogSetOverlay = catalogSetOverlayById.get(
      catalogSetRecord.canonicalId,
    );

    if (canonicalIds.has(catalogSetRecord.canonicalId)) {
      throw new Error(
        `Catalog sync produced a duplicate canonicalId: ${catalogSetRecord.canonicalId}.`,
      );
    }

    if (sourceSetNumbers.has(catalogSetRecord.sourceSetNumber)) {
      throw new Error(
        `Catalog sync produced a duplicate sourceSetNumber: ${catalogSetRecord.sourceSetNumber}.`,
      );
    }

    if (slugs.has(catalogSetRecord.slug)) {
      throw new Error(
        `Catalog sync produced a duplicate slug: ${catalogSetRecord.slug}.`,
      );
    }

    canonicalIds.add(catalogSetRecord.canonicalId);
    sourceSetNumbers.add(catalogSetRecord.sourceSetNumber);
    slugs.add(catalogSetRecord.slug);

    const productSlug = catalogSetOverlay
      ? getCatalogProductSlug({
          catalogSetRecord,
          catalogSetOverlay,
        })
      : catalogSetRecord.slug;

    if (productSlugs.has(productSlug)) {
      throw new Error(
        `Catalog sync produced a duplicate product slug: ${productSlug}.`,
      );
    }

    productSlugs.add(productSlug);
  }

  for (const homepageFeaturedSetId of catalogSyncManifest.homepageFeaturedSetIds) {
    if (!canonicalIds.has(homepageFeaturedSetId)) {
      throw new Error(
        `Homepage featured set ${homepageFeaturedSetId} is missing from the generated catalog snapshot.`,
      );
    }
  }
}

function validateCatalogArtifactsAgainstLocalCuration({
  catalogSnapshot,
  catalogSyncManifest,
  scopedSetNumbers = catalogSnapshotScopeSetNumbers,
}: CatalogSyncArtifacts & {
  scopedSetNumbers?: readonly string[];
}): void {
  const expectedSourceSetNumbers = [...scopedSetNumbers];
  const actualSourceSetNumbers = catalogSnapshot.setRecords.map(
    (catalogSetRecord) => catalogSetRecord.sourceSetNumber,
  );

  if (
    actualSourceSetNumbers.length !== expectedSourceSetNumbers.length ||
    actualSourceSetNumbers.some(
      (sourceSetNumber, index) =>
        sourceSetNumber !== expectedSourceSetNumbers[index],
    )
  ) {
    throw new Error(
      'Committed catalog snapshot no longer matches the current catalog sync scope. Run the live catalog sync to regenerate artifacts before pushing.',
    );
  }

  const expectedCanonicalIds = scopedSetNumbers.map(getCanonicalCatalogSetId);
  const actualCanonicalIds = catalogSnapshot.setRecords.map(
    (catalogSetRecord) => catalogSetRecord.canonicalId,
  );

  if (
    actualCanonicalIds.length !== expectedCanonicalIds.length ||
    actualCanonicalIds.some(
      (canonicalId, index) => canonicalId !== expectedCanonicalIds[index],
    )
  ) {
    throw new Error(
      'Committed catalog snapshot canonical ids no longer match the current catalog sync scope. Run the live catalog sync to regenerate artifacts before pushing.',
    );
  }

  const expectedHomepageFeaturedSetIds = getHomepageFeaturedSnapshotSetIds();

  if (
    catalogSyncManifest.homepageFeaturedSetIds.length !==
      expectedHomepageFeaturedSetIds.length ||
    catalogSyncManifest.homepageFeaturedSetIds.some(
      (homepageFeaturedSetId, index) =>
        homepageFeaturedSetId !== expectedHomepageFeaturedSetIds[index],
    )
  ) {
    throw new Error(
      'Committed catalog manifest homepage featured ids no longer match the current curated homepage set list. Run the live catalog sync to regenerate artifacts before pushing.',
    );
  }

  if (catalogSyncManifest.recordCount !== scopedSetNumbers.length) {
    throw new Error(
      'Committed catalog manifest recordCount no longer matches the current catalog sync scope. Run the live catalog sync to regenerate artifacts before pushing.',
    );
  }
}

export async function buildCatalogSyncArtifacts({
  scopedSetNumbers = catalogSnapshotScopeSetNumbers,
  listCanonicalCatalogSetsFn = listCatalogSyncCanonicalCatalogSets,
  now = new Date(),
}: BuildCatalogSyncArtifactsOptions): Promise<CatalogSyncArtifacts> {
  const scopedCanonicalCatalogSets =
    await resolveCatalogSyncScopedCanonicalSets({
      scopedSetNumbers,
      listCanonicalCatalogSetsFn,
    });
  const setRecords = scopedCanonicalCatalogSets.map(
    toCatalogSetRecordFromCanonicalCatalogSet,
  );
  const generatedAt = now.toISOString();
  const artifacts = {
    catalogSnapshot: {
      source: CATALOG_SYNC_SOURCE,
      generatedAt,
      setRecords,
    },
    catalogSyncManifest: {
      source: CATALOG_SYNC_SOURCE,
      generatedAt,
      recordCount: setRecords.length,
      homepageFeaturedSetIds: getHomepageFeaturedSnapshotSetIds(),
      notes: CATALOG_SYNC_NOTES,
    },
  };

  validateCatalogSyncArtifacts(artifacts);

  return artifacts;
}

export async function runLocalCatalogSyncCheck({
  workspaceRoot,
}: {
  workspaceRoot: string;
}): Promise<LocalCatalogSyncCheckResult> {
  const currentArtifacts = await readCatalogGeneratedArtifacts({
    workspaceRoot,
  });

  if (!currentArtifacts) {
    throw new Error(
      'Generated catalog artifacts are missing. Restore the committed snapshot files or run the live catalog sync first.',
    );
  }

  validateCatalogSyncArtifacts(currentArtifacts);
  validateCatalogArtifactsAgainstLocalCuration(currentArtifacts);

  const artifactCheck = await checkCatalogGeneratedArtifacts({
    catalogSnapshot: currentArtifacts.catalogSnapshot,
    catalogSyncManifest: currentArtifacts.catalogSyncManifest,
    workspaceRoot,
  });

  return {
    ...currentArtifacts,
    artifactCheck,
    mode: 'local-check',
  };
}

export async function runCatalogSync({
  listCanonicalCatalogSetsFn,
  mode = 'write',
  now,
  workspaceRoot,
}: RunCatalogSyncOptions): Promise<CatalogSyncRunResult> {
  const nextArtifacts = await buildCatalogSyncArtifacts({
    listCanonicalCatalogSetsFn,
    now,
  });
  const artifacts = await stabilizeCatalogGeneratedAt({
    ...nextArtifacts,
    workspaceRoot,
  });
  const artifactCheck =
    mode === 'check'
      ? await checkCatalogGeneratedArtifacts({
          catalogSnapshot: artifacts.catalogSnapshot,
          catalogSyncManifest: artifacts.catalogSyncManifest,
          workspaceRoot,
        })
      : await writeCatalogGeneratedArtifacts({
          catalogSnapshot: artifacts.catalogSnapshot,
          catalogSyncManifest: artifacts.catalogSyncManifest,
          workspaceRoot,
        });

  return {
    ...artifacts,
    artifactCheck,
    mode,
  };
}

export function toHomepageFeaturedSetIds(
  sourceSetNumbers: readonly string[],
): string[] {
  return sourceSetNumbers.map(getCanonicalCatalogSetId);
}
