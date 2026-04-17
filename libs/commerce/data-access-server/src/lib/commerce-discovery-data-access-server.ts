import { findCatalogSetSummaryByIdWithOverlay } from '@lego-platform/catalog/data-access-server';
import {
  type CommerceDiscoveryApprovalResult,
  buildCommerceDiscoveryCandidateAssessment,
  buildCommerceMerchantSearchQuery,
  buildCommerceMerchantSearchUrl,
  extractCommerceCandidateSetId,
  normalizeCommerceProductUrl,
  type CommerceDiscoveryCandidate,
  type CommerceDiscoveryCandidateReviewStatus,
  type CommerceDiscoveryRun,
  type CommerceDiscoveryRunInput,
  type CommerceMerchant,
  type CommerceOfferSeed,
  type CommerceOfferSeedInput,
} from '@lego-platform/commerce/util';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createCommerceOfferSeed,
  listCommerceMerchants,
  listCommerceOfferSeeds,
} from './commerce-data-access-server';

export const COMMERCE_DISCOVERY_RUNS_TABLE = 'commerce_merchant_discovery_runs';
export const COMMERCE_DISCOVERY_CANDIDATES_TABLE =
  'commerce_merchant_discovery_candidates';

type CommerceDiscoverySupabaseClient = Pick<SupabaseClient, 'from'>;

interface CommerceDiscoveryRunRow {
  candidate_count: number;
  created_at: string;
  error_message: string | null;
  finished_at: string | null;
  id: string;
  merchant_id: string;
  search_query: string;
  search_url: string;
  set_id: string;
  status: string;
  updated_at: string;
}

interface CommerceDiscoveryCandidateRow {
  availability: string | null;
  candidate_title: string;
  candidate_url: string;
  canonical_url: string;
  confidence_score: number;
  created_at: string;
  currency_code: string | null;
  detected_set_id: string | null;
  discovery_run_id: string;
  id: string;
  match_reasons: unknown;
  merchant_id: string;
  offer_seed_id: string | null;
  price_minor: number | null;
  review_status: string;
  set_id: string;
  source_rank: number;
  status: string;
  updated_at: string;
}

interface ParsedMerchantDiscoveryCandidate {
  availability?: string;
  candidateTitle: string;
  candidateUrl: string;
  currencyCode?: string;
  detectedSetId?: string;
  priceMinor?: number;
  sourceRank: number;
}

interface CommerceDiscoveryExecutionResult {
  candidates: CommerceDiscoveryCandidate[];
  run: CommerceDiscoveryRun;
}

interface CandidateOfferSeedLinkContext {
  candidateCanonicalUrl: string;
  candidateRow: CommerceDiscoveryCandidateRow;
  merchant: CommerceMerchant;
  offerSeeds: CommerceOfferSeed[];
}

interface MerchantDiscoveryAdapter {
  parseCandidates(input: {
    html: string;
    responseUrl: string;
    searchUrl: string;
    setId: string;
  }): ParsedMerchantDiscoveryCandidate[];
}

function toCommerceDiscoveryRun(
  row: CommerceDiscoveryRunRow,
): CommerceDiscoveryRun {
  return {
    id: row.id,
    setId: row.set_id,
    merchantId: row.merchant_id,
    searchQuery: row.search_query,
    searchUrl: row.search_url,
    status:
      row.status === 'running' || row.status === 'success'
        ? row.status
        : 'failed',
    errorMessage: row.error_message ?? undefined,
    candidateCount: row.candidate_count,
    finishedAt: row.finished_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMatchReasons(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

function toCommerceDiscoveryCandidate(
  row: CommerceDiscoveryCandidateRow,
): CommerceDiscoveryCandidate {
  return {
    id: row.id,
    discoveryRunId: row.discovery_run_id,
    setId: row.set_id,
    merchantId: row.merchant_id,
    candidateTitle: row.candidate_title,
    candidateUrl: row.candidate_url,
    canonicalUrl: row.canonical_url,
    priceMinor: row.price_minor ?? undefined,
    currencyCode: row.currency_code ?? undefined,
    availability: row.availability ?? undefined,
    detectedSetId: row.detected_set_id ?? undefined,
    confidenceScore: row.confidence_score,
    status:
      row.status === 'auto_approved' || row.status === 'needs_review'
        ? row.status
        : 'rejected',
    matchReasons: toMatchReasons(row.match_reasons),
    sourceRank: row.source_rank,
    reviewStatus:
      row.review_status === 'approved' || row.review_status === 'rejected'
        ? row.review_status
        : 'pending',
    offerSeedId: row.offer_seed_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(
    value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '),
  ).trim();
}

function extractMetaContent({
  html,
  key,
}: {
  html: string;
  key: string;
}): string | undefined {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([^"']+)["']`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${key}["']`,
      'i',
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (match?.[1]) {
      return decodeHtmlEntities(match[1]);
    }
  }

  return undefined;
}

function extractCanonicalUrl(html: string): string | undefined {
  const match = html.match(
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
  );

  return match?.[1];
}

function extractJsonLdRecords(html: string): unknown[] {
  const matches = [
    ...html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];

  return matches.flatMap((match) => {
    const rawValue = match[1]?.trim();

    if (!rawValue) {
      return [];
    }

    try {
      const parsedValue = JSON.parse(rawValue) as unknown;

      return Array.isArray(parsedValue) ? parsedValue : [parsedValue];
    } catch {
      return [];
    }
  });
}

function parsePriceMinor(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 100);
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value
    .trim()
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  const parsedValue = Number.parseFloat(normalizedValue);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return undefined;
  }

  return Math.round(parsedValue * 100);
}

function normalizeAvailability(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalizedValue = value.toLowerCase();

  if (
    normalizedValue.includes('instock') ||
    normalizedValue.includes('in_stock')
  ) {
    return 'in_stock';
  }

  if (
    normalizedValue.includes('limited') ||
    normalizedValue.includes('lowstock') ||
    normalizedValue.includes('beperkt')
  ) {
    return 'limited';
  }

  if (
    normalizedValue.includes('outofstock') ||
    normalizedValue.includes('soldout') ||
    normalizedValue.includes('out_of_stock') ||
    normalizedValue.includes('uitverkocht')
  ) {
    return 'out_of_stock';
  }

  if (
    normalizedValue.includes('preorder') ||
    normalizedValue.includes('pre-order')
  ) {
    return 'preorder';
  }

  return undefined;
}

function detectBlockedMerchantSearch(html: string): string | undefined {
  if (
    html.includes('Just a moment...') ||
    html.includes('Enable JavaScript and cookies to continue') ||
    html.includes('__cf_chl')
  ) {
    return 'Merchant search page returned a Cloudflare challenge.';
  }

  if (
    html.includes('Incapsula incident ID') ||
    html.includes('_Incapsula_Resource')
  ) {
    return 'Merchant search page was blocked by Imperva or Incapsula.';
  }

  return undefined;
}

function buildDiscoveryFetchHeaders(): HeadersInit {
  return {
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
  };
}

function extractStructuredProductCandidate({
  html,
  responseUrl,
}: {
  html: string;
  responseUrl: string;
}): ParsedMerchantDiscoveryCandidate | undefined {
  const productRecord = extractJsonLdRecords(html).find((record) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      return false;
    }

    const typeValue = (record as { ['@type']?: unknown })['@type'];

    if (typeof typeValue === 'string') {
      return typeValue.toLowerCase() === 'product';
    }

    return Array.isArray(typeValue)
      ? typeValue.some(
          (entry) =>
            typeof entry === 'string' && entry.toLowerCase() === 'product',
        )
      : false;
  }) as
    | {
        brand?: { name?: string };
        name?: string;
        offers?:
          | {
              availability?: string;
              price?: number | string;
              priceCurrency?: string;
              url?: string;
            }
          | Array<{
              availability?: string;
              price?: number | string;
              priceCurrency?: string;
              url?: string;
            }>;
        sku?: string;
      }
    | undefined;

  const offerRecord = Array.isArray(productRecord?.offers)
    ? productRecord.offers[0]
    : productRecord?.offers;
  const candidateTitle =
    productRecord?.name ??
    extractMetaContent({ html, key: 'title' }) ??
    extractMetaContent({ html, key: 'og:title' }) ??
    stripHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const candidateUrl =
    offerRecord?.url ?? extractCanonicalUrl(html) ?? responseUrl;

  if (!candidateTitle || !candidateUrl) {
    return undefined;
  }

  return {
    candidateTitle,
    candidateUrl,
    priceMinor:
      parsePriceMinor(offerRecord?.price) ??
      parsePriceMinor(
        extractMetaContent({ html, key: 'product:price:amount' }),
      ),
    currencyCode:
      offerRecord?.priceCurrency ??
      extractMetaContent({ html, key: 'product:price:currency' }) ??
      'EUR',
    availability: normalizeAvailability(offerRecord?.availability),
    detectedSetId:
      (typeof productRecord?.sku === 'string'
        ? productRecord.sku
        : undefined) ??
      extractCommerceCandidateSetId(candidateTitle) ??
      extractCommerceCandidateSetId(candidateUrl),
    sourceRank: 1,
  };
}

function extractLinkedProductCandidates({
  html,
  responseUrl,
  setId,
}: {
  html: string;
  responseUrl: string;
  setId: string;
}): ParsedMerchantDiscoveryCandidate[] {
  const baseUrl = new URL(responseUrl);
  const anchorMatches = [
    ...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi),
  ];
  const candidates: ParsedMerchantDiscoveryCandidate[] = [];
  const seenUrls = new Set<string>();

  for (const [index, match] of anchorMatches.entries()) {
    const href = match[1];
    const title = stripHtml(match[2] ?? '');

    if (!href || !title) {
      continue;
    }

    if (!href.includes(setId) && !title.includes(setId)) {
      continue;
    }

    if (
      href.startsWith('#') ||
      href.startsWith('javascript:') ||
      href.includes('/search') ||
      href.includes('/account')
    ) {
      continue;
    }

    let resolvedUrl: string;

    try {
      resolvedUrl = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }

    if (seenUrls.has(resolvedUrl)) {
      continue;
    }

    seenUrls.add(resolvedUrl);
    candidates.push({
      candidateTitle: title,
      candidateUrl: resolvedUrl,
      detectedSetId:
        extractCommerceCandidateSetId(title) ??
        extractCommerceCandidateSetId(resolvedUrl),
      sourceRank: index + 1,
    });
  }

  return candidates.slice(0, 12);
}

function parseMisterbricksCandidates(input: {
  html: string;
  responseUrl: string;
  setId: string;
}): ParsedMerchantDiscoveryCandidate[] {
  const structuredCandidate = extractStructuredProductCandidate(input);

  if (structuredCandidate) {
    return [structuredCandidate];
  }

  return extractLinkedProductCandidates(input);
}

function parseGenericMerchantCandidates(input: {
  html: string;
  responseUrl: string;
  setId: string;
}): ParsedMerchantDiscoveryCandidate[] {
  const structuredCandidate = extractStructuredProductCandidate(input);

  if (structuredCandidate) {
    return [structuredCandidate];
  }

  return extractLinkedProductCandidates(input);
}

const merchantDiscoveryAdapterBySlug: Record<string, MerchantDiscoveryAdapter> =
  {
    misterbricks: {
      parseCandidates: parseMisterbricksCandidates,
    },
    proshop: {
      parseCandidates: parseGenericMerchantCandidates,
    },
    'smyths-toys': {
      parseCandidates: parseGenericMerchantCandidates,
    },
  };

async function createCommerceDiscoveryRun({
  input,
  supabaseClient,
}: {
  input: CommerceDiscoveryRunInput & {
    searchQuery: string;
    searchUrl: string;
    status: 'running';
  };
  supabaseClient: CommerceDiscoverySupabaseClient;
}): Promise<CommerceDiscoveryRun> {
  const { data, error } = await supabaseClient
    .from(COMMERCE_DISCOVERY_RUNS_TABLE)
    .insert({
      set_id: input.setId,
      merchant_id: input.merchantId,
      search_query: input.searchQuery,
      search_url: input.searchUrl,
      status: input.status,
      candidate_count: 0,
    })
    .select(
      'id, set_id, merchant_id, search_query, search_url, status, candidate_count, error_message, finished_at, created_at, updated_at',
    )
    .single();

  if (error || !data) {
    throw new Error('Unable to create the merchant discovery run.');
  }

  return toCommerceDiscoveryRun(data as CommerceDiscoveryRunRow);
}

async function finalizeCommerceDiscoveryRun({
  candidateCount,
  errorMessage,
  runId,
  status,
  supabaseClient,
}: {
  candidateCount: number;
  errorMessage?: string;
  runId: string;
  status: 'failed' | 'success';
  supabaseClient: CommerceDiscoverySupabaseClient;
}): Promise<CommerceDiscoveryRun> {
  const finishedAt = new Date().toISOString();
  const { data, error } = await supabaseClient
    .from(COMMERCE_DISCOVERY_RUNS_TABLE)
    .update({
      candidate_count: candidateCount,
      error_message: errorMessage ?? null,
      finished_at: finishedAt,
      status,
    })
    .eq('id', runId)
    .select(
      'id, set_id, merchant_id, search_query, search_url, status, candidate_count, error_message, finished_at, created_at, updated_at',
    )
    .single();

  if (error || !data) {
    throw new Error('Unable to finalize the merchant discovery run.');
  }

  return toCommerceDiscoveryRun(data as CommerceDiscoveryRunRow);
}

async function insertCommerceDiscoveryCandidates({
  candidates,
  discoveryRunId,
  merchant,
  setId,
  setName,
  supabaseClient,
}: {
  candidates: ParsedMerchantDiscoveryCandidate[];
  discoveryRunId: string;
  merchant: CommerceMerchant;
  setId: string;
  setName: string;
  supabaseClient: CommerceDiscoverySupabaseClient;
}): Promise<CommerceDiscoveryCandidate[]> {
  if (candidates.length === 0) {
    return [];
  }

  const rows = candidates.map((candidate) => {
    const canonicalUrl = normalizeCommerceProductUrl({
      merchantSlug: merchant.slug,
      url: candidate.candidateUrl,
    });
    const assessment = buildCommerceDiscoveryCandidateAssessment({
      setId,
      setName,
      candidateTitle: candidate.candidateTitle,
      candidateUrl: canonicalUrl,
      detectedSetId: candidate.detectedSetId,
    });
    const matchReasons = [...assessment.matchReasons];

    if (candidate.priceMinor !== undefined) {
      matchReasons.push('Prijs gevonden op de merchantpagina.');
    }

    if (candidate.availability) {
      matchReasons.push('Beschikbaarheid gevonden op de merchantpagina.');
    }

    return {
      discovery_run_id: discoveryRunId,
      set_id: setId,
      merchant_id: merchant.id,
      candidate_title: candidate.candidateTitle,
      candidate_url: candidate.candidateUrl,
      canonical_url: canonicalUrl,
      price_minor: candidate.priceMinor ?? null,
      currency_code: candidate.currencyCode ?? null,
      availability: candidate.availability ?? null,
      detected_set_id: candidate.detectedSetId ?? null,
      confidence_score: assessment.confidenceScore,
      status: assessment.status,
      match_reasons: matchReasons,
      source_rank: candidate.sourceRank,
      review_status: 'pending',
      offer_seed_id: null,
    };
  });

  const { data, error } = await supabaseClient
    .from(COMMERCE_DISCOVERY_CANDIDATES_TABLE)
    .insert(rows)
    .select(
      'id, discovery_run_id, set_id, merchant_id, candidate_title, candidate_url, canonical_url, price_minor, currency_code, availability, detected_set_id, confidence_score, status, match_reasons, source_rank, review_status, offer_seed_id, created_at, updated_at',
    );

  if (error) {
    throw new Error('Unable to persist merchant discovery candidates.');
  }

  return ((data as CommerceDiscoveryCandidateRow[] | null) ?? []).map(
    toCommerceDiscoveryCandidate,
  );
}

async function getCommerceDiscoveryCandidateRow({
  candidateId,
  supabaseClient,
}: {
  candidateId: string;
  supabaseClient: CommerceDiscoverySupabaseClient;
}): Promise<CommerceDiscoveryCandidateRow> {
  const { data, error } = await supabaseClient
    .from(COMMERCE_DISCOVERY_CANDIDATES_TABLE)
    .select(
      'id, discovery_run_id, set_id, merchant_id, candidate_title, candidate_url, canonical_url, price_minor, currency_code, availability, detected_set_id, confidence_score, status, match_reasons, source_rank, review_status, offer_seed_id, created_at, updated_at',
    )
    .eq('id', candidateId)
    .single();

  if (error || !data) {
    throw new Error('Unable to load the merchant discovery candidate.');
  }

  return data as CommerceDiscoveryCandidateRow;
}

async function updateCommerceDiscoveryCandidateReviewStatus({
  candidateId,
  offerSeedId,
  reviewStatus,
  supabaseClient,
}: {
  candidateId: string;
  offerSeedId?: string;
  reviewStatus: CommerceDiscoveryCandidateReviewStatus;
  supabaseClient: CommerceDiscoverySupabaseClient;
}): Promise<CommerceDiscoveryCandidate> {
  const { data, error } = await supabaseClient
    .from(COMMERCE_DISCOVERY_CANDIDATES_TABLE)
    .update({
      offer_seed_id: offerSeedId ?? null,
      review_status: reviewStatus,
    })
    .eq('id', candidateId)
    .select(
      'id, discovery_run_id, set_id, merchant_id, candidate_title, candidate_url, canonical_url, price_minor, currency_code, availability, detected_set_id, confidence_score, status, match_reasons, source_rank, review_status, offer_seed_id, created_at, updated_at',
    )
    .single();

  if (error || !data) {
    throw new Error('Unable to update the merchant discovery candidate.');
  }

  return toCommerceDiscoveryCandidate(data as CommerceDiscoveryCandidateRow);
}

function findExistingOfferSeedForDiscoveryCandidate({
  candidateCanonicalUrl,
  candidateRow,
  merchant,
  offerSeeds,
}: CandidateOfferSeedLinkContext): CommerceOfferSeed | undefined {
  const existingSeedForSetMerchant = offerSeeds.find(
    (offerSeed) =>
      offerSeed.setId === candidateRow.set_id &&
      offerSeed.merchantId === candidateRow.merchant_id,
  );

  if (existingSeedForSetMerchant) {
    return existingSeedForSetMerchant;
  }

  return offerSeeds.find((offerSeed) => {
    try {
      return (
        normalizeCommerceProductUrl({
          merchantSlug: merchant.slug,
          url: offerSeed.productUrl,
        }) === candidateCanonicalUrl
      );
    } catch {
      return false;
    }
  });
}

async function ensureCatalogSetExists({
  setId,
  supabaseClient,
}: {
  setId: string;
  supabaseClient: CommerceDiscoverySupabaseClient;
}): Promise<{
  id: string;
  name: string;
}> {
  const catalogSet = await findCatalogSetSummaryByIdWithOverlay({
    setId,
    supabaseClient,
  });

  if (!catalogSet) {
    throw new Error(
      `Set ${setId} is not part of the Brickhunt catalog, so discovery cannot run yet.`,
    );
  }

  return {
    id: catalogSet.id,
    name: catalogSet.name,
  };
}

export async function listCommerceDiscoveryRuns({
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  supabaseClient?: CommerceDiscoverySupabaseClient;
} = {}): Promise<CommerceDiscoveryRun[]> {
  const { data, error } = await supabaseClient
    .from(COMMERCE_DISCOVERY_RUNS_TABLE)
    .select(
      'id, set_id, merchant_id, search_query, search_url, status, candidate_count, error_message, finished_at, created_at, updated_at',
    )
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Unable to load merchant discovery runs.');
  }

  return ((data as CommerceDiscoveryRunRow[] | null) ?? []).map(
    toCommerceDiscoveryRun,
  );
}

export async function listCommerceDiscoveryCandidates({
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  supabaseClient?: CommerceDiscoverySupabaseClient;
} = {}): Promise<CommerceDiscoveryCandidate[]> {
  const { data, error } = await supabaseClient
    .from(COMMERCE_DISCOVERY_CANDIDATES_TABLE)
    .select(
      'id, discovery_run_id, set_id, merchant_id, candidate_title, candidate_url, canonical_url, price_minor, currency_code, availability, detected_set_id, confidence_score, status, match_reasons, source_rank, review_status, offer_seed_id, created_at, updated_at',
    )
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Unable to load merchant discovery candidates.');
  }

  return ((data as CommerceDiscoveryCandidateRow[] | null) ?? []).map(
    toCommerceDiscoveryCandidate,
  );
}

export async function runCommerceMerchantDiscovery({
  fetchImpl = globalThis.fetch.bind(globalThis),
  input,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  fetchImpl?: typeof fetch;
  input: CommerceDiscoveryRunInput;
  supabaseClient?: CommerceDiscoverySupabaseClient;
}): Promise<CommerceDiscoveryExecutionResult> {
  const catalogSet = await ensureCatalogSetExists({
    setId: input.setId,
    supabaseClient,
  });
  const merchants = await listCommerceMerchants({ supabaseClient });
  const merchant = merchants.find(
    (candidateMerchant) => candidateMerchant.id === input.merchantId,
  );

  if (!merchant) {
    throw new Error('Merchant not found for merchant discovery.');
  }

  const searchQuery = buildCommerceMerchantSearchQuery({
    setId: input.setId,
  });
  const searchUrl = buildCommerceMerchantSearchUrl({
    merchantSlug: merchant.slug,
    query: searchQuery,
  });
  const discoveryAdapter = merchantDiscoveryAdapterBySlug[merchant.slug];

  if (!searchUrl || !discoveryAdapter) {
    throw new Error(
      `${merchant.name} heeft nog geen discovery-adapter of zoek-URL in Brickhunt.`,
    );
  }

  const discoveryRun = await createCommerceDiscoveryRun({
    input: {
      ...input,
      searchQuery,
      searchUrl,
      status: 'running',
    },
    supabaseClient,
  });

  try {
    const response = await fetchImpl(searchUrl, {
      headers: buildDiscoveryFetchHeaders(),
      redirect: 'follow',
    });
    const html = await response.text();
    const blockedReason = detectBlockedMerchantSearch(html);

    if (blockedReason) {
      const run = await finalizeCommerceDiscoveryRun({
        runId: discoveryRun.id,
        status: 'failed',
        candidateCount: 0,
        errorMessage: blockedReason,
        supabaseClient,
      });

      console.error('[commerce-discovery] merchant blocked search page', {
        merchant: merchant.slug,
        searchUrl,
        setId: input.setId,
        reason: blockedReason,
      });

      return {
        run,
        candidates: [],
      };
    }

    if (!response.ok) {
      const run = await finalizeCommerceDiscoveryRun({
        runId: discoveryRun.id,
        status: 'failed',
        candidateCount: 0,
        errorMessage: `${merchant.name} search returned HTTP ${response.status}.`,
        supabaseClient,
      });

      console.error('[commerce-discovery] merchant search failed', {
        merchant: merchant.slug,
        searchUrl,
        setId: input.setId,
        status: response.status,
      });

      return {
        run,
        candidates: [],
      };
    }

    const parsedCandidates = discoveryAdapter.parseCandidates({
      html,
      responseUrl: response.url || searchUrl,
      searchUrl,
      setId: input.setId,
    });

    if (parsedCandidates.length === 0) {
      const run = await finalizeCommerceDiscoveryRun({
        runId: discoveryRun.id,
        status: 'failed',
        candidateCount: 0,
        errorMessage: `${merchant.name} leverde geen bruikbare discovery-kandidaten op.`,
        supabaseClient,
      });

      console.error('[commerce-discovery] no discovery candidates found', {
        merchant: merchant.slug,
        responseUrl: response.url,
        searchUrl,
        setId: input.setId,
      });

      return {
        run,
        candidates: [],
      };
    }

    const candidates = await insertCommerceDiscoveryCandidates({
      candidates: parsedCandidates,
      discoveryRunId: discoveryRun.id,
      merchant,
      setId: input.setId,
      setName: catalogSet.name,
      supabaseClient,
    });
    const run = await finalizeCommerceDiscoveryRun({
      runId: discoveryRun.id,
      status: 'success',
      candidateCount: candidates.length,
      supabaseClient,
    });

    console.info('[commerce-discovery] run completed', {
      merchant: merchant.slug,
      setId: input.setId,
      candidateCount: candidates.length,
      runId: run.id,
    });

    return {
      run,
      candidates,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Merchant discovery failed unexpectedly.';
    const run = await finalizeCommerceDiscoveryRun({
      runId: discoveryRun.id,
      status: 'failed',
      candidateCount: 0,
      errorMessage: message,
      supabaseClient,
    });

    console.error('[commerce-discovery] run crashed', {
      merchant: merchant.slug,
      setId: input.setId,
      searchUrl,
      message,
    });

    return {
      run,
      candidates: [],
    };
  }
}

export async function createCommerceOfferSeedFromDiscoveryCandidate({
  candidateId,
  input,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  candidateId: string;
  input: CommerceOfferSeedInput;
  supabaseClient?: CommerceDiscoverySupabaseClient;
}): Promise<CommerceOfferSeed> {
  const [candidateRow, merchants, offerSeeds] = await Promise.all([
    getCommerceDiscoveryCandidateRow({ candidateId, supabaseClient }),
    listCommerceMerchants({ supabaseClient }),
    listCommerceOfferSeeds({ supabaseClient }),
  ]);
  const merchant = merchants.find(
    (candidateMerchant) => candidateMerchant.id === candidateRow.merchant_id,
  );

  if (!merchant) {
    throw new Error('Merchant for discovery candidate no longer exists.');
  }

  if (
    candidateRow.set_id !== input.setId ||
    candidateRow.merchant_id !== input.merchantId
  ) {
    throw new Error(
      'Deze discovery-kandidaat hoort niet bij dezelfde set en merchant als de seed die je opslaat.',
    );
  }

  const candidateCanonicalUrl =
    candidateRow.canonical_url ||
    normalizeCommerceProductUrl({
      merchantSlug: merchant.slug,
      url: candidateRow.candidate_url,
    });
  const existingOfferSeed = findExistingOfferSeedForDiscoveryCandidate({
    candidateCanonicalUrl,
    candidateRow,
    merchant,
    offerSeeds,
  });

  if (existingOfferSeed) {
    await updateCommerceDiscoveryCandidateReviewStatus({
      candidateId,
      offerSeedId: existingOfferSeed.id,
      reviewStatus: 'approved',
      supabaseClient,
    });

    return existingOfferSeed;
  }

  const offerSeed = await createCommerceOfferSeed({
    input,
    supabaseClient,
  });

  await updateCommerceDiscoveryCandidateReviewStatus({
    candidateId,
    offerSeedId: offerSeed.id,
    reviewStatus: 'approved',
    supabaseClient,
  });

  return offerSeed;
}

export async function approveCommerceDiscoveryCandidate({
  candidateId,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  candidateId: string;
  supabaseClient?: CommerceDiscoverySupabaseClient;
}): Promise<CommerceDiscoveryApprovalResult> {
  const [candidateRow, merchants, offerSeeds] = await Promise.all([
    getCommerceDiscoveryCandidateRow({ candidateId, supabaseClient }),
    listCommerceMerchants({ supabaseClient }),
    listCommerceOfferSeeds({ supabaseClient }),
  ]);
  const merchant = merchants.find(
    (candidateMerchant) => candidateMerchant.id === candidateRow.merchant_id,
  );

  if (!merchant) {
    throw new Error('Merchant for discovery candidate no longer exists.');
  }

  if (candidateRow.offer_seed_id) {
    const candidate = await updateCommerceDiscoveryCandidateReviewStatus({
      candidateId,
      offerSeedId: candidateRow.offer_seed_id,
      reviewStatus: 'approved',
      supabaseClient,
    });

    return {
      candidate,
      outcome: 'already_linked',
      message:
        'Deze kandidaat was al gekoppeld aan een offer seed. De reviewstatus staat nu op goedgekeurd.',
    };
  }

  const candidateCanonicalUrl =
    candidateRow.canonical_url ||
    normalizeCommerceProductUrl({
      merchantSlug: merchant.slug,
      url: candidateRow.candidate_url,
    });
  const existingOfferSeed = findExistingOfferSeedForDiscoveryCandidate({
    candidateCanonicalUrl,
    candidateRow,
    merchant,
    offerSeeds,
  });

  if (existingOfferSeed) {
    const candidate = await updateCommerceDiscoveryCandidateReviewStatus({
      candidateId,
      offerSeedId: existingOfferSeed.id,
      reviewStatus: 'approved',
      supabaseClient,
    });

    return {
      candidate,
      outcome: 'linked_existing_seed',
      message:
        'Er bestond al een offer seed voor deze match. De kandidaat is nu aan die seed gekoppeld en op goedgekeurd gezet.',
    };
  }

  const offerSeed = await createCommerceOfferSeed({
    input: {
      setId: candidateRow.set_id,
      merchantId: candidateRow.merchant_id,
      productUrl: candidateCanonicalUrl,
      isActive: true,
      validationStatus: 'valid',
      lastVerifiedAt: new Date().toISOString(),
      notes: '',
    },
    supabaseClient,
  });

  const candidate = await updateCommerceDiscoveryCandidateReviewStatus({
    candidateId,
    offerSeedId: offerSeed.id,
    reviewStatus: 'approved',
    supabaseClient,
  });

  return {
    candidate,
    outcome: 'created_seed',
    message: 'Offer seed aangemaakt en discovery-kandidaat gekoppeld.',
  };
}

export async function rejectCommerceDiscoveryCandidate({
  candidateId,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  candidateId: string;
  supabaseClient?: CommerceDiscoverySupabaseClient;
}): Promise<CommerceDiscoveryCandidate> {
  return updateCommerceDiscoveryCandidateReviewStatus({
    candidateId,
    reviewStatus: 'rejected',
    supabaseClient,
  });
}
