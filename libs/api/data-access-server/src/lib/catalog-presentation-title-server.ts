import type { CatalogCanonicalSet } from '@lego-platform/catalog/util';
import {
  applyCatalogSetPresentationTitle,
  CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_LOCALE,
  CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_MATCH_CONFIDENCE,
  CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_POLICY,
  CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_SOURCE,
  readCatalogRakutenLegoPresentationTitle,
  resolveCatalogSetPresentationTitle,
} from '@lego-platform/catalog/util';

const CATALOG_SET_SOURCE_METADATA_TABLE = 'catalog_set_source_metadata';
const PRESENTATION_TITLE_PAGE_SIZE = 100;

type CatalogPresentationTitleQuery = PromiseLike<{
  data: Record<string, unknown>[] | null;
  error: unknown;
}> & {
  eq?: (column: string, value: unknown) => CatalogPresentationTitleQuery;
  in?: (
    column: string,
    values: readonly unknown[],
  ) => PromiseLike<{
    data: Record<string, unknown>[] | null;
    error: unknown;
  }>;
};

interface CatalogPresentationTitleSupabaseClient {
  from(table: string): unknown;
}

interface CatalogPresentationTitleMetadataRow {
  catalog_set_id: string;
  metadata_json: unknown;
}

function chunkValues<TValue>(
  values: readonly TValue[],
  chunkSize: number,
): TValue[][] {
  const chunks: TValue[][] = [];

  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }

  return chunks;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function selectPresentationTitleMetadata(
  supabaseClient: CatalogPresentationTitleSupabaseClient,
): CatalogPresentationTitleQuery {
  const table = supabaseClient.from(CATALOG_SET_SOURCE_METADATA_TABLE);

  if (!isRecord(table) || typeof table['select'] !== 'function') {
    throw new Error(
      'Catalog presentation title query does not support select.',
    );
  }

  return (
    table as {
      select(columns: string): CatalogPresentationTitleQuery;
    }
  ).select('catalog_set_id, metadata_json');
}

function applyQueryEq({
  column,
  query,
  value,
}: {
  column: string;
  query: CatalogPresentationTitleQuery;
  value: unknown;
}): CatalogPresentationTitleQuery {
  if (typeof query.eq !== 'function') {
    throw new Error('Catalog presentation title query does not support eq.');
  }

  return query.eq(column, value);
}

function applyQueryIn({
  column,
  query,
  values,
}: {
  column: string;
  query: CatalogPresentationTitleQuery;
  values: readonly unknown[];
}): PromiseLike<{
  data: Record<string, unknown>[] | null;
  error: unknown;
}> {
  if (typeof query.in !== 'function') {
    throw new Error('Catalog presentation title query does not support in.');
  }

  return query.in(column, values);
}

export async function listCatalogRakutenLegoPresentationTitleBySetId({
  setIds,
  supabaseClient,
}: {
  setIds: readonly string[];
  supabaseClient: CatalogPresentationTitleSupabaseClient;
}): Promise<Map<string, string>> {
  const titleBySetId = new Map<string, string>();

  if (!setIds.length) {
    return titleBySetId;
  }

  for (const setIdChunk of chunkValues(setIds, PRESENTATION_TITLE_PAGE_SIZE)) {
    const query = selectPresentationTitleMetadata(supabaseClient);
    const filteredQuery = applyQueryEq({
      column: 'policy',
      query: applyQueryEq({
        column: 'match_confidence',
        query: applyQueryEq({
          column: 'locale',
          query: applyQueryEq({
            column: 'source',
            query,
            value: CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_SOURCE,
          }),
          value: CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_LOCALE,
        }),
        value: CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_MATCH_CONFIDENCE,
      }),
      value: CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_POLICY,
    });
    const { data, error } = await applyQueryIn({
      column: 'catalog_set_id',
      query: filteredQuery,
      values: setIdChunk,
    });

    if (error) {
      throw new Error('Unable to load catalog presentation title metadata.');
    }

    for (const row of (data as unknown as
      | CatalogPresentationTitleMetadataRow[]
      | null) ?? []) {
      const title = readCatalogRakutenLegoPresentationTitle(row.metadata_json);

      if (title) {
        titleBySetId.set(row.catalog_set_id, title);
      }
    }
  }

  return titleBySetId;
}

export async function enrichCatalogSetsWithPresentationTitles({
  catalogSets,
  supabaseClient,
}: {
  catalogSets: readonly CatalogCanonicalSet[];
  supabaseClient: CatalogPresentationTitleSupabaseClient;
}): Promise<CatalogCanonicalSet[]> {
  const titleBySetId = await listCatalogRakutenLegoPresentationTitleBySetId({
    setIds: catalogSets.map((catalogSet) => catalogSet.setId),
    supabaseClient,
  });

  return catalogSets.map((catalogSet) =>
    applyCatalogSetPresentationTitle(
      catalogSet,
      resolveCatalogSetPresentationTitle({
        fallbackTitle: catalogSet.name,
        rakutenMetadata: {
          locale: CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_LOCALE,
          matchConfidence:
            CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_MATCH_CONFIDENCE,
          metadataJson: titleBySetId.has(catalogSet.setId)
            ? { title: titleBySetId.get(catalogSet.setId) }
            : undefined,
          policy: CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_POLICY,
          source: CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_SOURCE,
        },
      }),
    ),
  );
}
