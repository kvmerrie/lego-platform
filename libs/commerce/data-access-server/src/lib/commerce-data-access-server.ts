import {
  commerceMerchantSourceTypes,
  commerceOfferLatestFetchStatuses,
  commerceOfferSeedValidationStatuses,
  includeCommerceMerchantInDefaultRefresh,
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
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import type { SupabaseClient } from '@supabase/supabase-js';

export const COMMERCE_MERCHANTS_TABLE = 'commerce_merchants';
export const COMMERCE_OFFER_SEEDS_TABLE = 'commerce_offer_seeds';
export const COMMERCE_OFFER_LATEST_TABLE = 'commerce_offer_latest';
export const COMMERCE_BENCHMARK_SETS_TABLE = 'commerce_benchmark_sets';

type CommerceSupabaseClient = Pick<SupabaseClient, 'from'>;

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

export interface CommerceRefreshSeed {
  merchant: CommerceMerchant;
  offerSeed: CommerceOfferSeed;
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
  const { data, error } = await supabaseClient
    .from(COMMERCE_BENCHMARK_SETS_TABLE)
    .insert({
      set_id: input.setId,
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
  const { data, error } = await supabaseClient
    .from(COMMERCE_OFFER_SEEDS_TABLE)
    .insert({
      set_id: input.setId,
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
  const { data, error } = await supabaseClient
    .from(COMMERCE_OFFER_SEEDS_TABLE)
    .update({
      set_id: input.setId,
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
  const { error } = await supabaseClient
    .from(COMMERCE_BENCHMARK_SETS_TABLE)
    .delete()
    .eq('set_id', setId);

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
  const { data, error } = await supabaseClient
    .from(COMMERCE_OFFER_SEEDS_TABLE)
    .upsert(
      {
        set_id: input.setId,
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
