import {
  commerceMerchantSourceTypes,
  commerceOfferLatestFetchStatuses,
  commerceOfferSeedValidationStatuses,
  includeCommerceMerchantInDefaultRefresh,
  buildCommerceSourceSetNumber,
  normalizeCommerceLegoSetNumber,
  scoreCommerceAffiliateDiscoveredSet,
  type CommerceAffiliateDiscoveredSet,
  type CommerceAffiliateDiscoveredSetConfidence,
  type CommerceAffiliateDiscoveredSetInput,
  type CommerceAffiliateDiscoveredSetStatus,
  type CommerceBenchmarkSet,
  type CommerceBenchmarkSetInput,
  type CommerceMerchant,
  type CommerceMerchantInput,
  type CommerceOfferLatestRecord,
  type CommerceOfferLatestRecordInput,
  type CommerceOfferSeed,
  type CommerceOfferSeedInput,
  type CommerceOfferSeedValidationStatus,
} from '@lego-platform/commerce/util';
import {
  getProductionSupabaseConfig,
  getServerSupabaseConfig,
} from '@lego-platform/shared/config';
import {
  createSupabaseAdminClient,
  getServerSupabaseAdminClient,
} from '@lego-platform/shared/data-access-auth-server';
import { normalizeCatalogSetId } from '@lego-platform/shared/util';
import type { SupabaseClient } from '@supabase/supabase-js';

export const COMMERCE_MERCHANTS_TABLE = 'commerce_merchants';
export const COMMERCE_OFFER_SEEDS_TABLE = 'commerce_offer_seeds';
export const COMMERCE_OFFER_LATEST_TABLE = 'commerce_offer_latest';
export const COMMERCE_BENCHMARK_SETS_TABLE = 'commerce_benchmark_sets';
export const COMMERCE_AFFILIATE_DISCOVERED_SETS_TABLE =
  'commerce_affiliate_discovered_sets';
export const PRICING_DAILY_SET_HISTORY_TABLE = 'pricing_daily_set_history';

type CommerceSupabaseClient = Pick<SupabaseClient, 'from'>;

type CommerceTableCopyClient = Pick<SupabaseClient, 'from'>;

const COMMERCE_PRODUCTION_COPY_TABLES = [
  {
    name: COMMERCE_MERCHANTS_TABLE,
    deleteKey: 'created_at',
  },
  {
    name: COMMERCE_BENCHMARK_SETS_TABLE,
    deleteKey: 'created_at',
  },
  {
    name: COMMERCE_OFFER_SEEDS_TABLE,
    deleteKey: 'created_at',
  },
  {
    name: COMMERCE_OFFER_LATEST_TABLE,
    deleteKey: 'created_at',
  },
  {
    name: COMMERCE_AFFILIATE_DISCOVERED_SETS_TABLE,
    deleteKey: 'created_at',
  },
  {
    name: PRICING_DAILY_SET_HISTORY_TABLE,
    deleteKey: 'recorded_on',
  },
] as const;

const COMMERCE_PRODUCTION_COPY_DELETE_ORDER = [
  PRICING_DAILY_SET_HISTORY_TABLE,
  COMMERCE_AFFILIATE_DISCOVERED_SETS_TABLE,
  COMMERCE_OFFER_LATEST_TABLE,
  COMMERCE_OFFER_SEEDS_TABLE,
  COMMERCE_BENCHMARK_SETS_TABLE,
  COMMERCE_MERCHANTS_TABLE,
] as const;

type CommerceProductionCopyTableName =
  (typeof COMMERCE_PRODUCTION_COPY_TABLES)[number]['name'];

const COMMERCE_PRODUCTION_COPY_SELECT_COLUMNS: Record<
  CommerceProductionCopyTableName,
  string
> = {
  [COMMERCE_AFFILIATE_DISCOVERED_SETS_TABLE]:
    'id, merchant_id, normalized_set_id, source_set_number, product_title, price_minor, currency_code, image_url, product_url, confidence, status, raw_payload, import_attempted_at, import_error, imported_set_id, first_seen_at, last_seen_at, created_at, updated_at',
  [COMMERCE_BENCHMARK_SETS_TABLE]: 'set_id, notes, created_at, updated_at',
  [COMMERCE_MERCHANTS_TABLE]:
    'id, slug, name, is_active, source_type, affiliate_network, notes, created_at, updated_at',
  [COMMERCE_OFFER_LATEST_TABLE]:
    'id, offer_seed_id, price_minor, currency_code, availability, fetch_status, observed_at, fetched_at, error_message, created_at, updated_at',
  [COMMERCE_OFFER_SEEDS_TABLE]:
    'id, set_id, merchant_id, product_url, is_active, validation_status, last_verified_at, notes, created_at, updated_at',
  [PRICING_DAILY_SET_HISTORY_TABLE]:
    'set_id, region_code, currency_code, condition, headline_price_minor, reference_price_minor, lowest_merchant_id, observed_at, recorded_on, created_at, updated_at',
};

export interface CommerceProductionCopyTableSummary {
  deletedCount: number;
  insertedCount: number;
  sourceCount: number;
  targetBeforeCount: number;
}

export interface CommerceProductionCopyResult {
  dryRun: boolean;
  durationMs: number;
  startedAt: string;
  status: 'ok';
  tables: Record<
    CommerceProductionCopyTableName,
    CommerceProductionCopyTableSummary
  >;
}

export class CommerceProductionCopyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommerceProductionCopyError';
  }
}

export interface CommerceOfferSeedValidationUpdateInput {
  lastVerifiedAt?: string | null;
  validationStatus: CommerceOfferSeedValidationStatus;
}

interface CommerceMerchantRow {
  affiliate_network: string | null;
  created_at: string;
  id: string;
  is_active: boolean;
  name: string;
  notes: string | null;
  slug: string;
  source_type: string;
  updated_at: string;
}

interface CommerceOfferSeedRow {
  created_at: string;
  id: string;
  is_active: boolean;
  last_verified_at: string | null;
  merchant_id: string;
  notes: string | null;
  product_url: string;
  set_id: string;
  updated_at: string;
  validation_status: string;
}

interface CommerceOfferLatestRow {
  availability: string | null;
  created_at: string;
  currency_code: string | null;
  error_message: string | null;
  fetched_at: string | null;
  fetch_status: string;
  id: string;
  observed_at: string | null;
  offer_seed_id: string;
  price_minor: number | null;
  updated_at: string;
}

interface CommerceBenchmarkSetRow {
  created_at: string;
  notes: string | null;
  set_id: string;
  updated_at: string;
}

interface CommerceAffiliateDiscoveredSetRow {
  commerce_merchants?:
    | {
        id: string;
        name: string;
        slug: string;
      }
    | {
        id: string;
        name: string;
        slug: string;
      }[]
    | null;
  confidence: string;
  created_at: string;
  currency_code: string | null;
  first_seen_at: string;
  id: string;
  image_url: string | null;
  import_attempted_at: string | null;
  import_error: string | null;
  imported_set_id: string | null;
  last_seen_at: string;
  merchant_id: string;
  normalized_set_id: string;
  price_minor: number | null;
  product_title: string;
  product_url: string;
  raw_payload: Readonly<Record<string, unknown>> | null;
  source_set_number: string;
  status: string;
  updated_at: string;
}

export interface CommerceRefreshSeed {
  merchant: CommerceMerchant;
  offerSeed: CommerceOfferSeed;
}

interface CommerceSupabaseLikeError {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
}

function assertAllowedValue<TValue extends string>(
  value: string,
  allowedValues: readonly TValue[],
  label: string,
): TValue {
  if (!allowedValues.includes(value as TValue)) {
    throw new Error(`${label} has an unsupported value: ${value}.`);
  }

  return value as TValue;
}

function formatCommerceSupabaseLikeError(
  error: CommerceSupabaseLikeError | null,
): string {
  if (!error) {
    return 'No Supabase error object was returned.';
  }

  return [
    error.message ? `message=${JSON.stringify(error.message)}` : undefined,
    error.code ? `code=${JSON.stringify(error.code)}` : undefined,
    error.details ? `details=${JSON.stringify(error.details)}` : undefined,
    error.hint ? `hint=${JSON.stringify(error.hint)}` : undefined,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ');
}

function formatAffiliateDiscoveredSetAttempt(input: {
  affiliateId: string;
  confidence: CommerceAffiliateDiscoveredSetConfidence;
  normalizedSetId: string;
  productUrl: string;
  status: CommerceAffiliateDiscoveredSetStatus;
}): string {
  return [
    `merchant_id=${JSON.stringify(input.affiliateId)}`,
    `source=${JSON.stringify(input.productUrl)}`,
    `source_set_number=${JSON.stringify(
      buildCommerceSourceSetNumber(input.normalizedSetId),
    )}`,
    `normalized_set_number=${JSON.stringify(input.normalizedSetId)}`,
    `status=${JSON.stringify(input.status)}`,
    `confidence=${JSON.stringify(input.confidence)}`,
  ].join(' ');
}

function toCommerceMerchant(row: CommerceMerchantRow): CommerceMerchant {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    isActive: row.is_active,
    sourceType: assertAllowedValue(
      row.source_type,
      commerceMerchantSourceTypes,
      'Commerce merchant sourceType',
    ),
    affiliateNetwork: row.affiliate_network ?? undefined,
    notes: row.notes ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCommerceOfferLatestRecord({
  row,
  seed,
}: {
  row: CommerceOfferLatestRow;
  seed: CommerceOfferSeedRow;
}): CommerceOfferLatestRecord {
  return {
    id: row.id,
    offerSeedId: row.offer_seed_id,
    setId: seed.set_id,
    merchantId: seed.merchant_id,
    productUrl: seed.product_url,
    fetchStatus: assertAllowedValue(
      row.fetch_status,
      commerceOfferLatestFetchStatuses,
      'Commerce offer latest fetchStatus',
    ),
    availability: row.availability ?? undefined,
    currencyCode: row.currency_code ?? undefined,
    errorMessage: row.error_message ?? undefined,
    fetchedAt: row.fetched_at ?? undefined,
    observedAt: row.observed_at ?? undefined,
    priceMinor: row.price_minor ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCommerceOfferSeed({
  latestOfferBySeedId,
  merchantById,
  row,
}: {
  latestOfferBySeedId: ReadonlyMap<string, CommerceOfferLatestRow>;
  merchantById: ReadonlyMap<string, CommerceMerchant>;
  row: CommerceOfferSeedRow;
}): CommerceOfferSeed {
  const latestOfferRow = latestOfferBySeedId.get(row.id);

  return {
    id: row.id,
    setId: row.set_id,
    merchantId: row.merchant_id,
    productUrl: row.product_url,
    isActive: row.is_active,
    validationStatus: assertAllowedValue(
      row.validation_status,
      commerceOfferSeedValidationStatuses,
      'Commerce offer seed validationStatus',
    ),
    lastVerifiedAt: row.last_verified_at ?? undefined,
    notes: row.notes ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    merchant: merchantById.get(row.merchant_id),
    latestOffer: latestOfferRow
      ? toCommerceOfferLatestRecord({
          row: latestOfferRow,
          seed: row,
        })
      : undefined,
  };
}

function toCommerceBenchmarkSet(
  row: CommerceBenchmarkSetRow,
): CommerceBenchmarkSet {
  return {
    setId: row.set_id,
    notes: row.notes ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCommerceAffiliateDiscoveredSet(
  row: CommerceAffiliateDiscoveredSetRow,
): CommerceAffiliateDiscoveredSet {
  const joinedMerchant = Array.isArray(row.commerce_merchants)
    ? row.commerce_merchants[0]
    : row.commerce_merchants;

  return {
    id: row.id,
    affiliate: {
      id: joinedMerchant?.id ?? row.merchant_id,
      name: joinedMerchant?.name ?? row.merchant_id,
      slug: joinedMerchant?.slug ?? row.merchant_id,
    },
    confidence: assertAllowedValue(
      row.confidence,
      ['high', 'low'] as const,
      'Affiliate discovered set confidence',
    ),
    createdAt: row.created_at,
    currencyCode: row.currency_code ?? undefined,
    firstSeenAt: row.first_seen_at,
    imageUrl: row.image_url ?? undefined,
    importAttemptedAt: row.import_attempted_at ?? undefined,
    importError: row.import_error ?? undefined,
    importedSetId: row.imported_set_id ?? undefined,
    lastSeenAt: row.last_seen_at,
    normalizedSetId: row.normalized_set_id,
    priceMinor: row.price_minor ?? undefined,
    productTitle: row.product_title,
    productUrl: row.product_url,
    rawPayload: row.raw_payload ?? {},
    sourceSetNumber: row.source_set_number,
    status: assertAllowedValue(
      row.status,
      ['new', 'imported', 'ignored', 'non_set'] as const,
      'Affiliate discovered set status',
    ),
    updatedAt: row.updated_at,
  };
}

function chunkCommerceRows<TRow>(
  rows: readonly TRow[],
  size: number,
): TRow[][] {
  const chunks: TRow[][] = [];

  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }

  return chunks;
}

function getCommerceProductionCopyTableConfig(
  table: CommerceProductionCopyTableName,
) {
  return COMMERCE_PRODUCTION_COPY_TABLES.find(
    (tableConfig) => tableConfig.name === table,
  );
}

function normalizeSupabaseRows(
  data: unknown,
): Readonly<Record<string, unknown>>[] {
  return Array.isArray(data)
    ? (data as Readonly<Record<string, unknown>>[])
    : [];
}

async function readCommerceProductionCopyRows({
  supabaseClient,
  table,
}: {
  supabaseClient: CommerceTableCopyClient;
  table: CommerceProductionCopyTableName;
}): Promise<Readonly<Record<string, unknown>>[]> {
  const rows: Readonly<Record<string, unknown>>[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabaseClient
      .from(table)
      .select(COMMERCE_PRODUCTION_COPY_SELECT_COLUMNS[table])
      .range(from, to);

    if (error) {
      throw new Error(`Unable to read ${table} for commerce production sync.`);
    }

    const pageRows = normalizeSupabaseRows(data);

    rows.push(...pageRows);

    if (pageRows.length < pageSize) {
      return rows;
    }
  }
}

async function deleteCommerceProductionCopyRows({
  supabaseClient,
  table,
}: {
  supabaseClient: CommerceTableCopyClient;
  table: CommerceProductionCopyTableName;
}): Promise<number> {
  const tableConfig = getCommerceProductionCopyTableConfig(table);

  if (!tableConfig) {
    throw new Error(`Commerce production sync table ${table} is not allowed.`);
  }

  const { count, error } = await supabaseClient
    .from(table)
    .delete({ count: 'exact' })
    .not(tableConfig.deleteKey, 'is', null);

  if (error) {
    throw new Error(
      `Unable to clear ${table} before commerce production sync.`,
    );
  }

  return count ?? 0;
}

async function insertCommerceProductionCopyRows({
  rows,
  supabaseClient,
  table,
}: {
  rows: readonly Readonly<Record<string, unknown>>[];
  supabaseClient: CommerceTableCopyClient;
  table: CommerceProductionCopyTableName;
}): Promise<number> {
  let insertedCount = 0;

  for (const chunk of chunkCommerceRows(rows, 500)) {
    const { error } = await supabaseClient.from(table).insert(chunk);

    if (error) {
      throw new Error(
        `Unable to insert ${table} during commerce production sync.`,
      );
    }

    insertedCount += chunk.length;
  }

  return insertedCount;
}

function assertCommerceProductionCopyTargetsNonProduction(): void {
  const productionConfig = getProductionSupabaseConfig();
  const targetConfig = getServerSupabaseConfig();

  if (productionConfig.url.trim() === targetConfig.url.trim()) {
    throw new CommerceProductionCopyError(
      'Commerce production sync cannot run against the production Supabase project.',
    );
  }
}

export async function copyCommerceDataFromProduction({
  allowDestructive = false,
  createProductionSupabaseClient,
  createTargetSupabaseClient,
  dryRun = true,
  logger = console,
  now = () => new Date(),
}: {
  allowDestructive?: boolean;
  createProductionSupabaseClient?: () => CommerceTableCopyClient;
  createTargetSupabaseClient?: () => CommerceTableCopyClient;
  dryRun?: boolean;
  logger?: Pick<Console, 'info' | 'warn'>;
  now?: () => Date;
} = {}): Promise<CommerceProductionCopyResult> {
  const startedAt = now();

  if (!createProductionSupabaseClient && !createTargetSupabaseClient) {
    assertCommerceProductionCopyTargetsNonProduction();
  }

  const productionSupabaseClient =
    createProductionSupabaseClient?.() ??
    createSupabaseAdminClient(getProductionSupabaseConfig());
  const targetSupabaseClient =
    createTargetSupabaseClient?.() ?? getServerSupabaseAdminClient();
  const tableRowsByName = new Map<
    CommerceProductionCopyTableName,
    Readonly<Record<string, unknown>>[]
  >();
  const targetRowsByName = new Map<
    CommerceProductionCopyTableName,
    Readonly<Record<string, unknown>>[]
  >();

  for (const tableConfig of COMMERCE_PRODUCTION_COPY_TABLES) {
    const [sourceRows, targetRows] = await Promise.all([
      readCommerceProductionCopyRows({
        supabaseClient: productionSupabaseClient,
        table: tableConfig.name,
      }),
      readCommerceProductionCopyRows({
        supabaseClient: targetSupabaseClient,
        table: tableConfig.name,
      }),
    ]);

    tableRowsByName.set(tableConfig.name, sourceRows);
    targetRowsByName.set(tableConfig.name, targetRows);
  }

  const tables = Object.fromEntries(
    COMMERCE_PRODUCTION_COPY_TABLES.map((tableConfig) => [
      tableConfig.name,
      {
        deletedCount: 0,
        insertedCount: 0,
        sourceCount: tableRowsByName.get(tableConfig.name)?.length ?? 0,
        targetBeforeCount: targetRowsByName.get(tableConfig.name)?.length ?? 0,
      },
    ]),
  ) as CommerceProductionCopyResult['tables'];

  logger.info(
    `[commerce-production-copy] dry_run=${dryRun} allow_destructive=${allowDestructive} row_counts=${JSON.stringify(
      Object.fromEntries(
        COMMERCE_PRODUCTION_COPY_TABLES.map((tableConfig) => [
          tableConfig.name,
          {
            source: tables[tableConfig.name].sourceCount,
            targetBefore: tables[tableConfig.name].targetBeforeCount,
          },
        ]),
      ),
    )}`,
  );

  if (!dryRun) {
    const populatedTargetTables = COMMERCE_PRODUCTION_COPY_TABLES.filter(
      (tableConfig) => tables[tableConfig.name].targetBeforeCount > 0,
    );

    if (populatedTargetTables.length > 0 && !allowDestructive) {
      throw new CommerceProductionCopyError(
        [
          'Commerce production copy would delete rows from the target environment.',
          'Re-run with allowDestructive=true after reviewing the dry-run row counts.',
          `Populated tables: ${populatedTargetTables
            .map(
              (tableConfig) =>
                `${tableConfig.name}=${tables[tableConfig.name].targetBeforeCount}`,
            )
            .join(', ')}.`,
        ].join(' '),
      );
    }

    logger.warn(
      `[commerce-production-copy] proceeding_with_destructive_delete row_counts=${JSON.stringify(
        Object.fromEntries(
          populatedTargetTables.map((tableConfig) => [
            tableConfig.name,
            tables[tableConfig.name].targetBeforeCount,
          ]),
        ),
      )}`,
    );

    for (const table of COMMERCE_PRODUCTION_COPY_DELETE_ORDER) {
      tables[table].deletedCount = await deleteCommerceProductionCopyRows({
        supabaseClient: targetSupabaseClient,
        table,
      });
    }

    for (const tableConfig of COMMERCE_PRODUCTION_COPY_TABLES) {
      tables[tableConfig.name].insertedCount =
        await insertCommerceProductionCopyRows({
          rows: tableRowsByName.get(tableConfig.name) ?? [],
          supabaseClient: targetSupabaseClient,
          table: tableConfig.name,
        });
    }
  }

  return {
    dryRun,
    durationMs: now().getTime() - startedAt.getTime(),
    startedAt: startedAt.toISOString(),
    status: 'ok',
    tables,
  };
}

async function listCommerceOfferLatestRows({
  supabaseClient,
}: {
  supabaseClient: CommerceSupabaseClient;
}): Promise<CommerceOfferLatestRow[]> {
  const { data, error } = await supabaseClient
    .from(COMMERCE_OFFER_LATEST_TABLE)
    .select(
      'id, offer_seed_id, price_minor, currency_code, availability, fetch_status, observed_at, fetched_at, error_message, created_at, updated_at',
    );

  if (error) {
    throw new Error('Unable to load commerce latest offers.');
  }

  return (data as CommerceOfferLatestRow[] | null) ?? [];
}

export async function listCommerceMerchants({
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  supabaseClient?: CommerceSupabaseClient;
} = {}): Promise<CommerceMerchant[]> {
  const { data, error } = await supabaseClient
    .from(COMMERCE_MERCHANTS_TABLE)
    .select(
      'id, slug, name, is_active, source_type, affiliate_network, notes, created_at, updated_at',
    )
    .order('name', { ascending: true });

  if (error) {
    throw new Error('Unable to load commerce merchants.');
  }

  return ((data as CommerceMerchantRow[] | null) ?? []).map(toCommerceMerchant);
}

export async function listCommerceBenchmarkSets({
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  supabaseClient?: CommerceSupabaseClient;
} = {}): Promise<CommerceBenchmarkSet[]> {
  const { data, error } = await supabaseClient
    .from(COMMERCE_BENCHMARK_SETS_TABLE)
    .select('set_id, notes, created_at, updated_at')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error('Unable to load commerce benchmark sets.');
  }

  return ((data as CommerceBenchmarkSetRow[] | null) ?? []).map(
    toCommerceBenchmarkSet,
  );
}

export async function listCommerceAffiliateDiscoveredSets({
  affiliateId,
  confidence,
  status,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  affiliateId?: string;
  confidence?: CommerceAffiliateDiscoveredSetConfidence | 'all';
  status?: CommerceAffiliateDiscoveredSetStatus | 'all';
  supabaseClient?: CommerceSupabaseClient;
} = {}): Promise<CommerceAffiliateDiscoveredSet[]> {
  let query = supabaseClient
    .from(COMMERCE_AFFILIATE_DISCOVERED_SETS_TABLE)
    .select(
      'id, merchant_id, normalized_set_id, source_set_number, product_title, price_minor, currency_code, image_url, product_url, confidence, status, raw_payload, import_attempted_at, import_error, imported_set_id, first_seen_at, last_seen_at, created_at, updated_at, commerce_merchants(id, slug, name)',
    )
    .order('last_seen_at', { ascending: false });

  if (affiliateId?.trim()) {
    query = query.eq('merchant_id', affiliateId.trim());
  }

  if (confidence && confidence !== 'all') {
    query = query.eq('confidence', confidence);
  }

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error('Unable to load affiliate discovered sets.');
  }

  return ((data as CommerceAffiliateDiscoveredSetRow[] | null) ?? []).map(
    toCommerceAffiliateDiscoveredSet,
  );
}

export async function upsertCommerceAffiliateDiscoveredSet({
  input,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  input: CommerceAffiliateDiscoveredSetInput;
  supabaseClient?: CommerceSupabaseClient;
}): Promise<CommerceAffiliateDiscoveredSet | undefined> {
  const normalizedSetId = normalizeCommerceLegoSetNumber(input.setNumber);
  const productUrl = input.productUrl?.trim();

  if (!normalizedSetId || !productUrl) {
    return undefined;
  }

  const productTitle = input.productTitle?.trim() || normalizedSetId;
  const confidence = scoreCommerceAffiliateDiscoveredSet(input);
  const existingResponse = await supabaseClient
    .from(COMMERCE_AFFILIATE_DISCOVERED_SETS_TABLE)
    .select('first_seen_at, status')
    .eq('merchant_id', input.affiliateId)
    .eq('product_url', productUrl)
    .maybeSingle();

  if (existingResponse.error) {
    throw new Error('Unable to inspect the affiliate discovered set.');
  }

  const existingRow = existingResponse.data as {
    first_seen_at?: string;
    status?: string;
  } | null;
  const status =
    existingRow?.status === 'ignored' || existingRow?.status === 'non_set'
      ? existingRow.status
      : 'new';
  const { data, error } = await supabaseClient
    .from(COMMERCE_AFFILIATE_DISCOVERED_SETS_TABLE)
    .upsert(
      {
        merchant_id: input.affiliateId,
        normalized_set_id: normalizedSetId,
        source_set_number: buildCommerceSourceSetNumber(normalizedSetId),
        product_title: productTitle,
        price_minor: input.priceMinor ?? null,
        currency_code: input.currencyCode?.trim().toUpperCase() || null,
        image_url: input.imageUrl?.trim() || null,
        product_url: productUrl,
        confidence,
        status,
        raw_payload: input.rawPayload,
        first_seen_at: existingRow?.first_seen_at ?? input.observedAt,
        last_seen_at: input.observedAt,
      },
      {
        onConflict: 'merchant_id,product_url',
      },
    )
    .select(
      'id, merchant_id, normalized_set_id, source_set_number, product_title, price_minor, currency_code, image_url, product_url, confidence, status, raw_payload, import_attempted_at, import_error, imported_set_id, first_seen_at, last_seen_at, created_at, updated_at, commerce_merchants(id, slug, name)',
    )
    .single();

  if (error || !data) {
    throw new Error(
      [
        'Unable to persist the affiliate discovered set.',
        formatCommerceSupabaseLikeError(error),
        formatAffiliateDiscoveredSetAttempt({
          affiliateId: input.affiliateId,
          confidence,
          normalizedSetId,
          productUrl,
          status,
        }),
      ].join(' '),
    );
  }

  return toCommerceAffiliateDiscoveredSet(
    data as CommerceAffiliateDiscoveredSetRow,
  );
}

export async function updateCommerceAffiliateDiscoveredSetReviewState({
  discoveredSetId,
  importAttemptedAt,
  importError,
  importedSetId,
  status,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  discoveredSetId: string;
  importAttemptedAt?: string;
  importError?: string | null;
  importedSetId?: string;
  status: CommerceAffiliateDiscoveredSetStatus;
  supabaseClient?: CommerceSupabaseClient;
}): Promise<CommerceAffiliateDiscoveredSet> {
  const { data, error } = await supabaseClient
    .from(COMMERCE_AFFILIATE_DISCOVERED_SETS_TABLE)
    .update({
      status,
      imported_set_id: importedSetId ?? null,
      ...(typeof importAttemptedAt === 'string'
        ? {
            import_attempted_at: importAttemptedAt,
          }
        : {}),
      ...(typeof importError !== 'undefined'
        ? {
            import_error: importError,
          }
        : {}),
    })
    .eq('id', discoveredSetId)
    .select(
      'id, merchant_id, normalized_set_id, source_set_number, product_title, price_minor, currency_code, image_url, product_url, confidence, status, raw_payload, import_attempted_at, import_error, imported_set_id, first_seen_at, last_seen_at, created_at, updated_at, commerce_merchants(id, slug, name)',
    )
    .single();

  if (error || !data) {
    throw new Error('Unable to update the affiliate discovered set.');
  }

  return toCommerceAffiliateDiscoveredSet(
    data as CommerceAffiliateDiscoveredSetRow,
  );
}

export async function createCommerceMerchant({
  input,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  input: CommerceMerchantInput;
  supabaseClient?: CommerceSupabaseClient;
}): Promise<CommerceMerchant> {
  const { data, error } = await supabaseClient
    .from(COMMERCE_MERCHANTS_TABLE)
    .insert({
      slug: input.slug,
      name: input.name,
      is_active: input.isActive,
      source_type: input.sourceType,
      affiliate_network: input.affiliateNetwork ?? null,
      notes: input.notes ?? '',
    })
    .select(
      'id, slug, name, is_active, source_type, affiliate_network, notes, created_at, updated_at',
    )
    .single();

  if (error || !data) {
    throw new Error('Unable to create the commerce merchant.');
  }

  return toCommerceMerchant(data as CommerceMerchantRow);
}

export async function createCommerceBenchmarkSet({
  input,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  input: CommerceBenchmarkSetInput;
  supabaseClient?: CommerceSupabaseClient;
}): Promise<CommerceBenchmarkSet> {
  const canonicalSetId = normalizeCatalogSetId(input.setId);
  const { data, error } = await supabaseClient
    .from(COMMERCE_BENCHMARK_SETS_TABLE)
    .insert({
      set_id: canonicalSetId,
      notes: input.notes ?? '',
    })
    .select('set_id, notes, created_at, updated_at')
    .single();

  if (error || !data) {
    throw new Error('Unable to create the commerce benchmark set.');
  }

  return toCommerceBenchmarkSet(data as CommerceBenchmarkSetRow);
}

export async function updateCommerceMerchant({
  input,
  merchantId,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  input: CommerceMerchantInput;
  merchantId: string;
  supabaseClient?: CommerceSupabaseClient;
}): Promise<CommerceMerchant> {
  const { data, error } = await supabaseClient
    .from(COMMERCE_MERCHANTS_TABLE)
    .update({
      slug: input.slug,
      name: input.name,
      is_active: input.isActive,
      source_type: input.sourceType,
      affiliate_network: input.affiliateNetwork ?? null,
      notes: input.notes ?? '',
    })
    .eq('id', merchantId)
    .select(
      'id, slug, name, is_active, source_type, affiliate_network, notes, created_at, updated_at',
    )
    .single();

  if (error || !data) {
    throw new Error('Unable to update the commerce merchant.');
  }

  return toCommerceMerchant(data as CommerceMerchantRow);
}

export async function listCommerceOfferSeeds({
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  supabaseClient?: CommerceSupabaseClient;
} = {}): Promise<CommerceOfferSeed[]> {
  const [merchants, latestOfferRows, offerSeedRowsResponse] = await Promise.all(
    [
      listCommerceMerchants({ supabaseClient }),
      listCommerceOfferLatestRows({ supabaseClient }),
      supabaseClient
        .from(COMMERCE_OFFER_SEEDS_TABLE)
        .select(
          'id, set_id, merchant_id, product_url, is_active, validation_status, last_verified_at, notes, created_at, updated_at',
        )
        .order('updated_at', { ascending: false }),
    ],
  );

  if (offerSeedRowsResponse.error) {
    throw new Error('Unable to load commerce offer seeds.');
  }

  const merchantById = new Map(
    merchants.map((merchant) => [merchant.id, merchant] as const),
  );
  const latestOfferBySeedId = new Map(
    latestOfferRows.map((latestOfferRow) => [
      latestOfferRow.offer_seed_id,
      latestOfferRow,
    ]),
  );

  return (
    (offerSeedRowsResponse.data as CommerceOfferSeedRow[] | null) ?? []
  ).map((row) =>
    toCommerceOfferSeed({
      latestOfferBySeedId,
      merchantById,
      row,
    }),
  );
}

export async function createCommerceOfferSeed({
  input,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  input: CommerceOfferSeedInput;
  supabaseClient?: CommerceSupabaseClient;
}): Promise<CommerceOfferSeed> {
  const canonicalSetId = normalizeCatalogSetId(input.setId);
  const { data, error } = await supabaseClient
    .from(COMMERCE_OFFER_SEEDS_TABLE)
    .insert({
      set_id: canonicalSetId,
      merchant_id: input.merchantId,
      product_url: input.productUrl,
      is_active: input.isActive,
      validation_status: input.validationStatus,
      last_verified_at: input.lastVerifiedAt ?? null,
      notes: input.notes ?? '',
    })
    .select(
      'id, set_id, merchant_id, product_url, is_active, validation_status, last_verified_at, notes, created_at, updated_at',
    )
    .single();

  if (error || !data) {
    throw new Error('Unable to create the commerce offer seed.');
  }

  const merchants = await listCommerceMerchants({ supabaseClient });

  return toCommerceOfferSeed({
    row: data as CommerceOfferSeedRow,
    merchantById: new Map(
      merchants.map((merchant) => [merchant.id, merchant] as const),
    ),
    latestOfferBySeedId: new Map(),
  });
}

export async function updateCommerceOfferSeed({
  input,
  offerSeedId,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  input: CommerceOfferSeedInput;
  offerSeedId: string;
  supabaseClient?: CommerceSupabaseClient;
}): Promise<CommerceOfferSeed> {
  const canonicalSetId = normalizeCatalogSetId(input.setId);
  const { data, error } = await supabaseClient
    .from(COMMERCE_OFFER_SEEDS_TABLE)
    .update({
      set_id: canonicalSetId,
      merchant_id: input.merchantId,
      product_url: input.productUrl,
      is_active: input.isActive,
      validation_status: input.validationStatus,
      last_verified_at: input.lastVerifiedAt ?? null,
      notes: input.notes ?? '',
    })
    .eq('id', offerSeedId)
    .select(
      'id, set_id, merchant_id, product_url, is_active, validation_status, last_verified_at, notes, created_at, updated_at',
    )
    .single();

  if (error || !data) {
    throw new Error('Unable to update the commerce offer seed.');
  }

  const [merchants, latestOfferRows] = await Promise.all([
    listCommerceMerchants({ supabaseClient }),
    listCommerceOfferLatestRows({ supabaseClient }),
  ]);

  return toCommerceOfferSeed({
    row: data as CommerceOfferSeedRow,
    merchantById: new Map(
      merchants.map((merchant) => [merchant.id, merchant] as const),
    ),
    latestOfferBySeedId: new Map(
      latestOfferRows.map((latestOfferRow) => [
        latestOfferRow.offer_seed_id,
        latestOfferRow,
      ]),
    ),
  });
}

export async function listActiveCommerceRefreshSeeds({
  includeBlockedMerchants = false,
  merchantSlugs,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  includeBlockedMerchants?: boolean;
  merchantSlugs?: readonly string[];
  supabaseClient?: CommerceSupabaseClient;
} = {}): Promise<CommerceRefreshSeed[]> {
  const offerSeeds = await listCommerceOfferSeeds({ supabaseClient });
  const requestedMerchantSlugs = new Set(
    (merchantSlugs ?? [])
      .map((merchantSlug) => merchantSlug.trim())
      .filter(Boolean),
  );

  return offerSeeds
    .filter(
      (offerSeed) =>
        offerSeed.isActive && offerSeed.merchant?.isActive === true,
    )
    .filter(
      (offerSeed) =>
        includeBlockedMerchants ||
        requestedMerchantSlugs.has(offerSeed.merchant?.slug ?? '') ||
        includeCommerceMerchantInDefaultRefresh(offerSeed.merchant?.slug ?? ''),
    )
    .map((offerSeed) => ({
      merchant: offerSeed.merchant as CommerceMerchant,
      offerSeed,
    }));
}

export async function listActiveCommerceSyncSeeds({
  merchantSlugs,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  merchantSlugs?: readonly string[];
  supabaseClient?: CommerceSupabaseClient;
} = {}): Promise<CommerceRefreshSeed[]> {
  const offerSeeds = await listCommerceOfferSeeds({ supabaseClient });
  const requestedMerchantSlugs = new Set(
    (merchantSlugs ?? [])
      .map((merchantSlug) => merchantSlug.trim())
      .filter(Boolean),
  );

  return offerSeeds
    .filter(
      (offerSeed) =>
        offerSeed.isActive && offerSeed.merchant?.isActive === true,
    )
    .filter(
      (offerSeed) =>
        requestedMerchantSlugs.size === 0 ||
        requestedMerchantSlugs.has(offerSeed.merchant?.slug ?? ''),
    )
    .map((offerSeed) => ({
      merchant: offerSeed.merchant as CommerceMerchant,
      offerSeed,
    }));
}

export async function deleteCommerceBenchmarkSet({
  setId,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  setId: string;
  supabaseClient?: CommerceSupabaseClient;
}): Promise<void> {
  const canonicalSetId = normalizeCatalogSetId(setId);
  const { error } = await supabaseClient
    .from(COMMERCE_BENCHMARK_SETS_TABLE)
    .delete()
    .eq('set_id', canonicalSetId);

  if (error) {
    throw new Error('Unable to delete the commerce benchmark set.');
  }
}

export async function upsertCommerceOfferLatestRecord({
  input,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  input: CommerceOfferLatestRecordInput;
  supabaseClient?: CommerceSupabaseClient;
}): Promise<void> {
  const { error } = await supabaseClient
    .from(COMMERCE_OFFER_LATEST_TABLE)
    .upsert(
      {
        offer_seed_id: input.offerSeedId,
        price_minor: input.priceMinor ?? null,
        currency_code: input.currencyCode ?? null,
        availability: input.availability ?? null,
        fetch_status: input.fetchStatus,
        observed_at: input.observedAt ?? null,
        fetched_at: input.fetchedAt ?? null,
        error_message: input.errorMessage ?? null,
      },
      {
        onConflict: 'offer_seed_id',
      },
    );

  if (error) {
    throw new Error('Unable to persist the commerce latest offer record.');
  }
}

export async function upsertCommerceOfferSeedByCompositeKey({
  input,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  input: CommerceOfferSeedInput;
  supabaseClient?: CommerceSupabaseClient;
}): Promise<CommerceOfferSeed> {
  const canonicalSetId = normalizeCatalogSetId(input.setId);
  const { data, error } = await supabaseClient
    .from(COMMERCE_OFFER_SEEDS_TABLE)
    .upsert(
      {
        set_id: canonicalSetId,
        merchant_id: input.merchantId,
        product_url: input.productUrl,
        is_active: input.isActive,
        validation_status: input.validationStatus,
        last_verified_at: input.lastVerifiedAt ?? null,
        notes: input.notes ?? '',
      },
      {
        onConflict: 'set_id,merchant_id',
      },
    )
    .select(
      'id, set_id, merchant_id, product_url, is_active, validation_status, last_verified_at, notes, created_at, updated_at',
    )
    .single();

  if (error || !data) {
    throw new Error('Unable to upsert the commerce offer seed.');
  }

  const [merchants, latestOfferRows] = await Promise.all([
    listCommerceMerchants({ supabaseClient }),
    listCommerceOfferLatestRows({ supabaseClient }),
  ]);

  return toCommerceOfferSeed({
    row: data as CommerceOfferSeedRow,
    merchantById: new Map(
      merchants.map((merchant) => [merchant.id, merchant] as const),
    ),
    latestOfferBySeedId: new Map(
      latestOfferRows.map((latestOfferRow) => [
        latestOfferRow.offer_seed_id,
        latestOfferRow,
      ]),
    ),
  });
}

export async function updateCommerceOfferSeedValidationState({
  input,
  offerSeedId,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  input: CommerceOfferSeedValidationUpdateInput;
  offerSeedId: string;
  supabaseClient?: CommerceSupabaseClient;
}): Promise<void> {
  const { error } = await supabaseClient
    .from(COMMERCE_OFFER_SEEDS_TABLE)
    .update({
      validation_status: input.validationStatus,
      last_verified_at: input.lastVerifiedAt ?? null,
    })
    .eq('id', offerSeedId);

  if (error) {
    throw new Error(
      'Unable to update the commerce offer seed validation state.',
    );
  }
}
