import { listCanonicalCatalogSets } from '@lego-platform/catalog/data-access-server';
import type { CatalogCanonicalSet } from '@lego-platform/catalog/util';
import {
  assessCommerceGeneratedSeedCandidate,
  buildCommercePrimaryCoverageRows,
  buildCommerceGeneratedSeedSearchUrl,
  buildGeneratedCommerceSeedCandidateNote,
  buildGeneratedCommerceSeedRejectedNote,
  buildGeneratedCommerceSeedStaleNote,
  buildGeneratedCommerceSeedValidatedNote,
  compareCommerceMerchantsByOperationalPriority,
  getCommerceGapRecoveryProfile,
  getCommerceMerchantSupportTier,
  includeCatalogSetInDefaultCommerceCoverage,
  includeCommerceMerchantInDefaultSeedGeneration,
  isGeneratedCommerceSeedNote,
  supportsCommerceMerchantSearch,
  type CommerceMerchant,
  type CommerceGapRecoveryPriority,
  type CommerceOfferLatestFetchStatus,
  type CommerceOfferSeed,
  type CommerceOfferSeedInput,
  type CommerceOfferSeedValidationStatus,
  type CommercePrimaryCoverageRow,
  type CommercePrimaryCoverageStatus,
} from '@lego-platform/commerce/util';
import {
  createCommerceOfferSeed,
  listCommerceBenchmarkSets,
  listCommerceMerchants,
  listCommerceOfferSeeds,
  updateCommerceOfferSeed,
} from './commerce-data-access-server';

const MERCHANT_VALIDATION_TIMEOUT_MS = 15000;
const browserLikeMerchantUserAgent =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';
const browserLikeMerchantAcceptHeader =
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8';
const htmlAnchorPattern =
  /<a\b([^>]*?)href=(["'])(.*?)\2([^>]*)>([\s\S]*?)<\/a>/gi;
const titleAttributePattern = /\btitle=(["'])(.*?)\1/i;
const ariaLabelAttributePattern = /\baria-label=(["'])(.*?)\1/i;
const imageAltAttributePattern = /\balt=(["'])(.*?)\1/gi;
const htmlTagPattern = /<[^>]+>/g;
const htmlTitlePattern = /<title\b[^>]*>([\s\S]*?)<\/title>/i;
const htmlHeadingPattern = /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi;
const htmlMetaContentPattern =
  /<meta\b[^>]*(?:name|property)=(["'])([^"']+)\1[^>]*content=(["'])([\s\S]*?)\3[^>]*>/gi;
const htmlScriptJsonLdPattern =
  /<script\b[^>]*type=(["'])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi;
const htmlNextDataPattern =
  /<script\b[^>]*id=(["'])__NEXT_DATA__\1[^>]*type=(["'])application\/json\2[^>]*>([\s\S]*?)<\/script>/i;
const htmlQuotedNamePattern = /"name"\s*:\s*"([^"]+)"/gi;
const htmlQuotedBrandPattern =
  /"brand"\s*:\s*(?:"([^"]+)"|\{[\s\S]*?"name"\s*:\s*"([^"]+)")/gi;
const htmlProductItemPattern =
  /<li\b[^>]*class=(["'])[^"']*\bproduct-item\b[^"']*\1[^>]*>([\s\S]*?)<\/li>/gi;
const misterbricksProductAnchorClassPattern =
  /\bproduct-item-(?:link|photo)\b/i;
const wehkampProductTilePattern =
  /<article\b[^>]*class=(["'])[^"']*\bUI_ProductTile_productTile\b[^"']*\1[^>]*>([\s\S]*?)<\/article>/gi;
const wehkampProductTileLinkClassPattern = /\bUI_ProductTileLink_tileLink\b/i;
const disallowedProductUrlPathFragments = [
  '/account',
  '/cart',
  '/checkout',
  '/customer',
  '/login',
  '/search',
  'catalogsearch',
] as const;

export interface CommerceSeedGenerationFilters {
  batchIndex?: number;
  batchSize?: number;
  benchmarkOnly?: boolean;
  includeNonActive?: boolean;
  limit?: number;
  merchantSlugs?: readonly string[];
  primaryCoverageStatus?: CommercePrimaryCoverageStatus | 'all';
  recheckGenerated?: boolean;
  setIds?: readonly string[];
}

export interface CommerceSeedGenerationSummary {
  candidateCount: number;
  insertedCount: number;
  skippedCount: number;
  supportedMerchantSlugs: readonly string[];
  updatedCount: number;
}

export interface CommerceSeedValidationSummary {
  invalidCount: number;
  processedCount: number;
  skippedCount: number;
  staleCount: number;
  validCount: number;
}

export interface CommercePrimaryCoverageReport {
  fullPrimaryCoverageCount: number;
  noPrimarySeedsCount: number;
  noValidPrimaryOffersCount: number;
  partialPrimaryCoverageCount: number;
  primaryMerchantSlugs: readonly string[];
  rows: readonly CommercePrimaryCoverageRow[];
  selectedSetCount: number;
  totalSetCount: number;
}

export const commercePrimaryCoverageGapTypes = [
  'missing_seed',
  'seed_pending',
  'seed_invalid',
  'seed_stale',
  'no_latest_refresh',
  'refresh_pending',
  'refresh_unavailable',
  'refresh_error',
] as const;

export type CommercePrimaryCoverageGapType =
  (typeof commercePrimaryCoverageGapTypes)[number];

export interface CommercePrimaryCoverageGapMerchantAuditRow {
  gapType: CommercePrimaryCoverageGapType;
  hasSeed: boolean;
  latestRefreshReason?: string;
  latestRefreshStatus?: CommerceOfferLatestFetchStatus;
  merchantId: string;
  merchantName: string;
  merchantSlug: string;
  recoveryPriority: CommerceGapRecoveryPriority;
  recoveryReason: string;
  seedIsActive?: boolean;
  seedValidationStatus?: CommerceOfferSeedValidationStatus;
}

export interface CommercePrimaryCoverageGapAuditRow {
  merchantGaps: readonly CommercePrimaryCoverageGapMerchantAuditRow[];
  missingValidPrimaryOfferMerchantNames: readonly string[];
  missingValidPrimaryOfferMerchantSlugs: readonly string[];
  primaryMerchantTargetCount: number;
  primarySeedCount: number;
  setId: string;
  setName: string;
  status: CommercePrimaryCoverageStatus;
  theme: string;
  validPrimaryOfferCount: number;
}

export interface CommercePrimaryCoverageGapAuditMerchantSummary {
  merchantName: string;
  merchantSlug: string;
  missingValidOfferCount: number;
}

export interface CommercePrimaryCoverageGapAuditTypeSummary {
  count: number;
  gapType: CommercePrimaryCoverageGapType;
}

export interface CommercePrimaryCoverageGapAuditSummary {
  actionablePartialSetCount: number;
  countsByRecoveryPriority: readonly CommercePrimaryCoverageGapAuditRecoverySummary[];
  gapCountsByType: readonly CommercePrimaryCoverageGapAuditTypeSummary[];
  missingValidOfferCountsByMerchant: readonly CommercePrimaryCoverageGapAuditMerchantSummary[];
  parkedCount: number;
  recoverNowCount: number;
  setsMissingSeedCount: number;
  setsWithFullSeedButMissingOfferCount: number;
  verifyFirstCount: number;
}

export interface CommercePrimaryCoverageGapAuditReport {
  auditedMerchantSlugs: readonly string[];
  primaryMerchantSlugs: readonly string[];
  rows: readonly CommercePrimaryCoverageGapAuditRow[];
  selectedSetCount: number;
  summary: CommercePrimaryCoverageGapAuditSummary;
  totalSetCount: number;
}

export interface CommercePrimaryCoverageGapAuditRecoverySummary {
  count: number;
  recoveryPriority: CommerceGapRecoveryPriority;
}

export interface CommerceSeedValidationDebugCandidate {
  decision: 'invalid' | 'stale' | 'valid';
  pageAssessmentReason?: string;
  pageStatus?: number;
  pageUrl?: string;
  reason: string;
  score: number;
  text: string;
  url: string;
}

export interface CommerceSeedValidationDebugResult {
  decision: 'invalid' | 'stale' | 'valid';
  fallbackDecision?: 'invalid' | 'stale';
  merchantSlug: string;
  rankedCandidates: CommerceSeedValidationDebugCandidate[];
  searchPageAssessmentReason: string;
  searchPageDecision: 'invalid' | 'stale' | 'valid';
  searchPageStatus: number;
  searchPageUrl: string;
  seedUrl: string;
  setId: string;
}

interface CommerceHtmlLinkCandidate {
  source?: 'html-anchor' | 'intertoys-partner-search';
  text: string;
  url: string;
}

interface CommerceFetchedHtmlPage {
  html: string;
  status: number;
  url: string;
}

interface LegoGraphQlSearchResponse {
  data?: {
    searchProducts?: {
      __typename?: 'RedirectAction';
      url?: string;
    } | null;
  };
}

interface IntertoysPartnerSearchResponse {
  result?: Array<{
    brand?: string | null;
    description?: string | null;
    extraData?: {
      legoNr?: string | null;
    } | null;
    keywords?: string | null;
    originalUrl?: string | null;
    productNumber?: string | null;
    title?: string | null;
    trackingCode?: string | null;
    url?: string | null;
  } | null>;
}

function normalizeCommerceSeedHost(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^www\./, '');
}

function normalizeRequestedSlugs(values?: readonly string[]) {
  return new Set((values ?? []).map((value) => value.trim()).filter(Boolean));
}

function compareCatalogSetsForBatchWork(
  left: CatalogCanonicalSet,
  right: CatalogCanonicalSet,
): number {
  return (
    left.setId.localeCompare(right.setId) ||
    left.name.localeCompare(right.name) ||
    left.slug.localeCompare(right.slug)
  );
}

function trimHtmlToText(value: string): string {
  return value
    .replace(htmlTagPattern, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeBasicHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, codePoint) =>
      String.fromCodePoint(Number(codePoint)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) =>
      String.fromCodePoint(Number.parseInt(codePoint, 16)),
    )
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function trimDecodedHtmlText(value: string): string {
  return decodeBasicHtmlEntities(trimHtmlToText(value));
}

function isLikelySearchUrl(value: URL): boolean {
  return (
    value.pathname.toLowerCase().includes('/search') ||
    value.pathname.toLowerCase().includes('catalogsearch') ||
    value.searchParams.has('q') ||
    value.searchParams.has('k') ||
    value.searchParams.has('s') ||
    value.searchParams.has('text') ||
    value.searchParams.has('searchtext') ||
    value.searchParams.has('searchTerm')
  );
}

function isDisallowedCandidateProductUrl({
  candidateUrl,
  seedUrl,
}: {
  candidateUrl: URL;
  seedUrl: URL;
}): boolean {
  const normalizedPath = candidateUrl.pathname.toLowerCase();

  if (candidateUrl.protocol !== 'http:' && candidateUrl.protocol !== 'https:') {
    return true;
  }

  if (candidateUrl.hash && !candidateUrl.pathname) {
    return true;
  }

  if (
    normalizeCommerceSeedHost(candidateUrl.host) !==
    normalizeCommerceSeedHost(seedUrl.host)
  ) {
    return true;
  }

  if (candidateUrl.toString() === seedUrl.toString()) {
    return true;
  }

  if (/\.(?:jpe?g|png|gif|svg|webp|pdf)$/i.test(normalizedPath)) {
    return true;
  }

  if (
    disallowedProductUrlPathFragments.some((fragment) =>
      normalizedPath.includes(fragment),
    )
  ) {
    return true;
  }

  return isLikelySearchUrl(candidateUrl);
}

function extractAttributeValue(
  pattern: RegExp,
  attributes: string,
): string | undefined {
  const match = attributes.match(pattern);

  return decodeBasicHtmlEntities(match?.[2]?.trim() || '') || undefined;
}

function extractAnchorImageAltTexts(value: string): string[] {
  return [...value.matchAll(imageAltAttributePattern)]
    .map((match) => decodeBasicHtmlEntities(match[2]?.trim() || ''))
    .filter(Boolean);
}

function extractCommercePageValidationContextText(html: string): string {
  const segments = new Set<string>();
  const addSegment = (value?: string) => {
    const normalizedValue = trimDecodedHtmlText(value ?? '');

    if (normalizedValue) {
      segments.add(normalizedValue);
    }
  };

  const titleMatch = html.match(htmlTitlePattern);
  addSegment(titleMatch?.[1]);

  for (const match of html.matchAll(htmlHeadingPattern)) {
    addSegment(match[1]);
  }

  for (const match of html.matchAll(htmlMetaContentPattern)) {
    const propertyName = match[2]?.toLowerCase();

    if (
      propertyName === 'description' ||
      propertyName === 'og:description' ||
      propertyName === 'og:title' ||
      propertyName === 'title' ||
      propertyName === 'twitter:title'
    ) {
      addSegment(match[4]);
    }
  }

  for (const scriptMatch of html.matchAll(htmlScriptJsonLdPattern)) {
    const scriptBody = decodeBasicHtmlEntities(scriptMatch[2] ?? '');

    for (const nameMatch of scriptBody.matchAll(htmlQuotedNamePattern)) {
      addSegment(nameMatch[1]);
    }

    for (const brandMatch of scriptBody.matchAll(htmlQuotedBrandPattern)) {
      addSegment(brandMatch[1] ?? brandMatch[2]);
    }
  }

  return [...segments].join(' ');
}

function dedupeCommerceHtmlLinkCandidates(
  candidates: readonly CommerceHtmlLinkCandidate[],
): CommerceHtmlLinkCandidate[] {
  const seenUrls = new Set<string>();
  const dedupedCandidates: CommerceHtmlLinkCandidate[] = [];

  for (const candidate of candidates) {
    if (!candidate.url || seenUrls.has(candidate.url)) {
      continue;
    }

    seenUrls.add(candidate.url);
    dedupedCandidates.push(candidate);
  }

  return dedupedCandidates;
}

function extractSearchTermFromSeedUrl({
  catalogSet,
  seedUrl,
}: {
  catalogSet: CatalogCanonicalSet;
  seedUrl: URL;
}): string {
  const searchTerm =
    seedUrl.searchParams.get('q') ||
    seedUrl.searchParams.get('k') ||
    seedUrl.searchParams.get('s') ||
    seedUrl.searchParams.get('text') ||
    seedUrl.searchParams.get('searchtext') ||
    seedUrl.searchParams.get('searchTerm');

  return searchTerm?.trim() || catalogSet.setId;
}

function resolveCandidateUrlAgainstSeedUrl({
  candidateUrl,
  seedUrl,
}: {
  candidateUrl: string;
  seedUrl: URL;
}): string | undefined {
  const trimmedUrl = candidateUrl.trim();

  if (!trimmedUrl) {
    return undefined;
  }

  try {
    const resolvedUrl = new URL(trimmedUrl, seedUrl);

    if (
      isDisallowedCandidateProductUrl({ candidateUrl: resolvedUrl, seedUrl })
    ) {
      return undefined;
    }

    return resolvedUrl.toString();
  } catch {
    return undefined;
  }
}

function parseCommerceNextDataJson(
  html: string,
): Record<string, unknown> | undefined {
  const nextDataMatch = html.match(htmlNextDataPattern);

  if (!nextDataMatch?.[3]) {
    return undefined;
  }

  try {
    return JSON.parse(decodeBasicHtmlEntities(nextDataMatch[3])) as Record<
      string,
      unknown
    >;
  } catch {
    return undefined;
  }
}

function extractIntertoysSearchConfigFromHtml(html: string): {
  configKey?: string;
  langId?: string;
  storeId?: string;
  websiteUuid?: string;
} {
  const nextData = parseCommerceNextDataJson(html);
  const props = (nextData?.props as Record<string, unknown> | undefined)
    ?.pageProps as Record<string, unknown> | undefined;
  const settings = props?.settings as Record<string, unknown> | undefined;

  return {
    storeId:
      typeof settings?.storeId === 'string' ? settings.storeId : undefined,
    langId:
      typeof settings?.defaultLanguageId === 'string'
        ? settings.defaultLanguageId
        : undefined,
    configKey:
      typeof (settings?.userData as Record<string, unknown> | undefined)
        ?.HelloretailSearchConfigKey === 'string'
        ? ((settings?.userData as Record<string, unknown>)
            .HelloretailSearchConfigKey as string)
        : undefined,
    websiteUuid:
      typeof (settings?.userData as Record<string, unknown> | undefined)
        ?.HelloRetailUUID === 'string'
        ? ((settings?.userData as Record<string, unknown>)
            .HelloRetailUUID as string)
        : undefined,
  };
}

function normalizeLegoCandidateUrlToSeedLocale({
  candidateUrl,
  seedUrl,
}: {
  candidateUrl: string;
  seedUrl: URL;
}): string {
  const localeMatch = seedUrl.pathname.match(/^\/([a-z]{2}-[a-z]{2})(?:\/|$)/i);

  if (!localeMatch) {
    return candidateUrl;
  }

  try {
    const resolvedUrl = new URL(candidateUrl, seedUrl);
    const normalizedPathname = resolvedUrl.pathname.replace(
      /^\/[a-z]{2}-[a-z]{2}(\/product\/)/i,
      `/${localeMatch[1]}$1`,
    );

    if (normalizedPathname !== resolvedUrl.pathname) {
      resolvedUrl.pathname = normalizedPathname;
    }

    return resolvedUrl.toString();
  } catch {
    return candidateUrl;
  }
}

function hasPromisingGenericSearchCandidates({
  candidates,
  set,
}: {
  candidates: readonly CommerceHtmlLinkCandidate[];
  set: CatalogCanonicalSet;
}) {
  return candidates.some((candidate) => {
    if (
      candidate.url.includes(set.setId) ||
      candidate.text.includes(set.setId)
    ) {
      return true;
    }

    const assessment = assessCommerceGeneratedSeedCandidate({
      target: {
        setId: set.setId,
        setName: set.name,
        pieceCount: set.pieceCount,
      },
      contextText: candidate.text,
      url: candidate.url,
    });

    return assessment.decision === 'valid' || assessment.score >= 60;
  });
}

function normalizeResolvedCandidateUrl(value: string): string {
  try {
    const resolvedUrl = new URL(value);

    resolvedUrl.hash = '';

    return resolvedUrl.toString();
  } catch {
    return value;
  }
}

function isLikelyMisterbricksProductDetailUrl(value: string): boolean {
  try {
    const candidateUrl = new URL(value);

    return candidateUrl.pathname.toLowerCase().endsWith('.html');
  } catch {
    return false;
  }
}

function isLikelyKruidvatProductDetailUrl(value: string): boolean {
  try {
    const candidateUrl = new URL(value);

    return /\/p\/\d+\/?$/i.test(candidateUrl.pathname);
  } catch {
    return false;
  }
}

function isLikelyWehkampProductDetailUrl(value: string): boolean {
  try {
    const candidateUrl = new URL(value);

    return /\/[^/?#]+-\d{5,}\/?$/i.test(candidateUrl.pathname);
  } catch {
    return false;
  }
}

function extractMisterbricksProductItemCandidates({
  html,
  seedUrl,
}: {
  html: string;
  seedUrl: URL;
}): CommerceHtmlLinkCandidate[] {
  const candidates: CommerceHtmlLinkCandidate[] = [];

  for (const match of html.matchAll(htmlProductItemPattern)) {
    const blockHtml = match[2] ?? '';
    const blockText = trimDecodedHtmlText(blockHtml);

    for (const anchorMatch of blockHtml.matchAll(htmlAnchorPattern)) {
      const attributes =
        `${anchorMatch[1] ?? ''} ${anchorMatch[4] ?? ''}`.trim();

      if (!misterbricksProductAnchorClassPattern.test(attributes)) {
        continue;
      }

      const resolvedCandidateUrl = resolveCandidateUrlAgainstSeedUrl({
        candidateUrl: anchorMatch[3] ?? '',
        seedUrl,
      });

      if (
        !resolvedCandidateUrl ||
        !isLikelyMisterbricksProductDetailUrl(resolvedCandidateUrl)
      ) {
        continue;
      }

      const candidateText = [
        trimDecodedHtmlText(anchorMatch[5] ?? ''),
        extractAttributeValue(titleAttributePattern, attributes),
        extractAttributeValue(ariaLabelAttributePattern, attributes),
        ...extractAnchorImageAltTexts(anchorMatch[5] ?? ''),
        blockText,
      ]
        .filter(Boolean)
        .join(' ')
        .trim();

      candidates.push({
        source: 'html-anchor',
        text: candidateText || blockText,
        url: normalizeResolvedCandidateUrl(resolvedCandidateUrl),
      });
    }
  }

  return dedupeCommerceHtmlLinkCandidates(candidates);
}

function extractWehkampProductTileCandidates({
  html,
  seedUrl,
}: {
  html: string;
  seedUrl: URL;
}): CommerceHtmlLinkCandidate[] {
  const candidates: CommerceHtmlLinkCandidate[] = [];

  for (const match of html.matchAll(wehkampProductTilePattern)) {
    const blockHtml = match[2] ?? '';
    const blockText = trimDecodedHtmlText(blockHtml);

    for (const anchorMatch of blockHtml.matchAll(htmlAnchorPattern)) {
      const attributes =
        `${anchorMatch[1] ?? ''} ${anchorMatch[4] ?? ''}`.trim();

      if (!wehkampProductTileLinkClassPattern.test(attributes)) {
        continue;
      }

      const resolvedCandidateUrl = resolveCandidateUrlAgainstSeedUrl({
        candidateUrl: anchorMatch[3] ?? '',
        seedUrl,
      });

      if (
        !resolvedCandidateUrl ||
        !isLikelyWehkampProductDetailUrl(resolvedCandidateUrl)
      ) {
        continue;
      }

      candidates.push({
        source: 'html-anchor',
        text: blockText,
        url: normalizeResolvedCandidateUrl(resolvedCandidateUrl),
      });
    }
  }

  return dedupeCommerceHtmlLinkCandidates(candidates);
}

async function fetchMerchantJson<T>({
  fetchImpl,
  headers,
  merchantSlug,
  method = 'GET',
  timeoutMs = MERCHANT_VALIDATION_TIMEOUT_MS,
  url,
  body,
}: {
  body?: string;
  fetchImpl: typeof fetch;
  headers?: Record<string, string>;
  merchantSlug: string;
  method?: 'GET' | 'POST';
  timeoutMs?: number;
  url: string;
}): Promise<T | undefined> {
  const requestUrl = new URL(url);
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const response = await fetchImpl(requestUrl.toString(), {
      body,
      headers: {
        ...buildMerchantRequestHeaders({
          merchantSlug,
          requestUrl,
        }),
        ...headers,
      },
      method,
      redirect: 'follow',
      signal: abortController.signal,
    });

    if (response.status < 200 || response.status >= 300) {
      return undefined;
    }

    return (await response.json()) as T;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

async function extractLegoSearchCandidates({
  catalogSet,
  fetchImpl,
  seedUrl,
}: {
  catalogSet: CatalogCanonicalSet;
  fetchImpl: typeof fetch;
  seedUrl: URL;
}): Promise<CommerceHtmlLinkCandidate[]> {
  const searchTerm = extractSearchTermFromSeedUrl({
    catalogSet,
    seedUrl,
  });
  const response = await fetchMerchantJson<LegoGraphQlSearchResponse>({
    fetchImpl,
    merchantSlug: 'lego-nl',
    method: 'POST',
    url: 'https://www.lego.com/api/graphql',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      origin: seedUrl.origin,
      referer: seedUrl.toString(),
    },
    body: JSON.stringify({
      operationName: 'SearchProductsQuery',
      query: `
        query SearchProductsQuery(
          $searchSessionId: Int
          $q: String!
          $page: Int!
          $perPage: Int!
          $sort: SortInput
          $filters: [Filter!]
          $visibility: ProductVisibility
        ) {
          searchProducts(
            searchSession: $searchSessionId
            query: $q
            page: $page
            perPage: $perPage
            filters: $filters
            sort: $sort
            visibility: $visibility
          ) {
            ... on RedirectAction {
              __typename
              url
            }
          }
        }
      `,
      variables: {
        searchSessionId: 1,
        q: searchTerm,
        page: 1,
        perPage: 24,
        sort: {
          key: 'RELEVANCE',
          direction: 'DESC',
        },
        filters: [],
        visibility: {
          includeFreeProducts: false,
          includeRetiredProducts: true,
        },
      },
    }),
  });
  const searchProducts = response?.data?.searchProducts;

  if (!searchProducts) {
    return [];
  }

  if (
    searchProducts.__typename === 'RedirectAction' &&
    typeof searchProducts.url === 'string'
  ) {
    const candidateUrl = resolveCandidateUrlAgainstSeedUrl({
      candidateUrl: searchProducts.url,
      seedUrl,
    });

    return candidateUrl
      ? [
          {
            text: `LEGO ${catalogSet.setId} ${catalogSet.name}`.trim(),
            url: normalizeLegoCandidateUrlToSeedLocale({
              candidateUrl,
              seedUrl,
            }),
          },
        ]
      : [];
  }

  return [];
}

async function extractIntertoysSearchCandidates({
  catalogSet,
  fetchImpl,
  searchHtml,
  seedUrl,
}: {
  catalogSet: CatalogCanonicalSet;
  fetchImpl: typeof fetch;
  searchHtml: string;
  seedUrl: URL;
}): Promise<CommerceHtmlLinkCandidate[]> {
  const { configKey, websiteUuid } =
    extractIntertoysSearchConfigFromHtml(searchHtml);
  const searchTerm = extractSearchTermFromSeedUrl({
    catalogSet,
    seedUrl,
  });

  if (!configKey) {
    return [];
  }

  const runPartnerSearch = async (term: string) => {
    const requestBody = new URLSearchParams();

    requestBody.set('key', configKey);
    requestBody.set('q', term);
    requestBody.set('device_type', 'DESKTOP');
    requestBody.set('format', 'json');
    requestBody.set('return_filters', 'true');
    requestBody.set('sorting', '');
    requestBody.set('product_count', '36');
    requestBody.set('product_start', '0');
    requestBody.set('category_count', '25');
    requestBody.set('category_start', '0');
    requestBody.set('redirects_count', '2');
    requestBody.set('redirects_start', '0');

    if (websiteUuid) {
      requestBody.set('websiteUuid', websiteUuid);
    }

    return fetchMerchantJson<IntertoysPartnerSearchResponse>({
      fetchImpl,
      merchantSlug: 'intertoys',
      method: 'POST',
      url: 'https://core.helloretail.com/api/v1/search/partnerSearch',
      body: requestBody.toString(),
      headers: {
        accept: 'application/json, text/plain, */*',
        'content-type': 'application/x-www-form-urlencoded',
        origin: seedUrl.origin,
        referer: seedUrl.toString(),
      },
    });
  };
  const searchTerms = new Set<string>([searchTerm]);

  if (searchTerm === catalogSet.setId) {
    searchTerms.add(`LEGO ${catalogSet.setId}`);
  }

  const partnerSearchResponses = await Promise.all(
    [...searchTerms].map((term) => runPartnerSearch(term)),
  );

  return dedupeCommerceHtmlLinkCandidates(
    partnerSearchResponses.flatMap((response) =>
      (response?.result ?? []).flatMap((entry) => {
        const candidateUrl =
          entry?.originalUrl?.trim() || entry?.url?.split('#')[0]?.trim() || '';
        const resolvedCandidateUrl = candidateUrl
          ? resolveCandidateUrlAgainstSeedUrl({
              candidateUrl,
              seedUrl,
            })
          : undefined;
        const candidateText = [
          entry?.brand?.trim(),
          entry?.title?.trim(),
          entry?.description?.trim(),
          entry?.keywords?.trim(),
          entry?.extraData?.legoNr?.trim(),
          entry?.productNumber?.trim(),
        ]
          .filter(Boolean)
          .join(' ')
          .trim();

        return resolvedCandidateUrl
          ? [
              {
                source: 'intertoys-partner-search' as const,
                text:
                  candidateText ||
                  `LEGO ${catalogSet.setId} ${catalogSet.name}`.trim(),
                url: resolvedCandidateUrl,
              },
            ]
          : [];
      }),
    ),
  );
}

async function extractMerchantSearchCandidates({
  catalogSet,
  fetchImpl,
  merchant,
  searchPage,
}: {
  catalogSet: CatalogCanonicalSet;
  fetchImpl: typeof fetch;
  merchant: CommerceMerchant;
  searchPage: CommerceFetchedHtmlPage;
}): Promise<CommerceHtmlLinkCandidate[]> {
  const resolvedSearchUrl = new URL(searchPage.url);
  const genericCandidates = extractCommerceHtmlLinkCandidates({
    html: searchPage.html,
    seedUrl: resolvedSearchUrl,
  });

  if (merchant.slug === 'lego-nl') {
    if (
      genericCandidates.length > 0 &&
      hasPromisingGenericSearchCandidates({
        candidates: genericCandidates,
        set: catalogSet,
      })
    ) {
      return genericCandidates;
    }

    return dedupeCommerceHtmlLinkCandidates([
      ...(await extractLegoSearchCandidates({
        catalogSet,
        fetchImpl,
        seedUrl: resolvedSearchUrl,
      })),
      ...genericCandidates,
    ]);
  }

  if (merchant.slug === 'intertoys') {
    if (
      genericCandidates.length > 0 &&
      hasPromisingGenericSearchCandidates({
        candidates: genericCandidates,
        set: catalogSet,
      })
    ) {
      return genericCandidates;
    }

    return dedupeCommerceHtmlLinkCandidates([
      ...(await extractIntertoysSearchCandidates({
        catalogSet,
        fetchImpl,
        searchHtml: searchPage.html,
        seedUrl: resolvedSearchUrl,
      })),
      ...genericCandidates,
    ]);
  }

  if (merchant.slug === 'misterbricks') {
    const productItemCandidates = extractMisterbricksProductItemCandidates({
      html: searchPage.html,
      seedUrl: resolvedSearchUrl,
    });

    if (productItemCandidates.length > 0) {
      return productItemCandidates;
    }

    return genericCandidates.filter(
      (candidate) =>
        isLikelyMisterbricksProductDetailUrl(candidate.url) &&
        (candidate.url.includes(catalogSet.setId) ||
          candidate.text.includes(catalogSet.setId)),
    );
  }

  if (merchant.slug === 'kruidvat') {
    return genericCandidates.filter(
      (candidate) =>
        isLikelyKruidvatProductDetailUrl(candidate.url) &&
        (candidate.url.includes(catalogSet.setId) ||
          candidate.text.includes(catalogSet.setId)),
    );
  }

  if (merchant.slug === 'wehkamp') {
    const productTileCandidates = extractWehkampProductTileCandidates({
      html: searchPage.html,
      seedUrl: resolvedSearchUrl,
    });

    if (productTileCandidates.length > 0) {
      return productTileCandidates.filter(
        (candidate) =>
          candidate.url.includes(catalogSet.setId) ||
          candidate.text.includes(catalogSet.setId),
      );
    }

    return genericCandidates.filter(
      (candidate) =>
        isLikelyWehkampProductDetailUrl(candidate.url) &&
        (candidate.url.includes(catalogSet.setId) ||
          candidate.text.includes(catalogSet.setId)),
    );
  }

  return genericCandidates;
}

function extractCommerceHtmlLinkCandidates({
  html,
  seedUrl,
}: {
  html: string;
  seedUrl: URL;
}): CommerceHtmlLinkCandidate[] {
  const candidates: CommerceHtmlLinkCandidate[] = [];
  const seenUrls = new Set<string>();

  for (const match of html.matchAll(htmlAnchorPattern)) {
    const href = match[3]?.trim();

    if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
      continue;
    }

    let candidateUrl: URL;

    try {
      candidateUrl = new URL(href, seedUrl);
    } catch {
      continue;
    }

    if (isDisallowedCandidateProductUrl({ candidateUrl, seedUrl })) {
      continue;
    }

    const attributes = `${match[1] ?? ''} ${match[4] ?? ''}`.trim();
    const rawText = [
      trimDecodedHtmlText(match[5] ?? ''),
      extractAttributeValue(titleAttributePattern, attributes),
      extractAttributeValue(ariaLabelAttributePattern, attributes),
      ...extractAnchorImageAltTexts(match[5] ?? ''),
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    if (!rawText) {
      continue;
    }

    const candidateUrlString = candidateUrl.toString();

    if (seenUrls.has(candidateUrlString)) {
      continue;
    }

    seenUrls.add(candidateUrlString);
    candidates.push({
      source: 'html-anchor',
      text: rawText,
      url: candidateUrlString,
    });
  }

  return candidates;
}

function buildMerchantRequestHeaders({
  merchantSlug,
  requestUrl,
}: {
  merchantSlug: string;
  requestUrl: URL;
}) {
  const headers: Record<string, string> = {
    accept: browserLikeMerchantAcceptHeader,
    'accept-language': 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7',
    'cache-control': 'no-cache',
    pragma: 'no-cache',
    'upgrade-insecure-requests': '1',
    'user-agent': browserLikeMerchantUserAgent,
  };

  if (
    merchantSlug === 'amazon-nl' ||
    merchantSlug === 'intertoys' ||
    merchantSlug === 'kruidvat'
  ) {
    headers.referer = `${requestUrl.origin}/`;
  }

  return headers;
}

async function fetchMerchantHtmlPage({
  fetchImpl,
  merchantSlug,
  url,
}: {
  fetchImpl: typeof fetch;
  merchantSlug: string;
  url: string;
}): Promise<CommerceFetchedHtmlPage> {
  const requestUrl = new URL(url);
  const abortController = new AbortController();
  const timeout = setTimeout(
    () => abortController.abort(),
    MERCHANT_VALIDATION_TIMEOUT_MS,
  );

  try {
    const response = await fetchImpl(requestUrl.toString(), {
      headers: buildMerchantRequestHeaders({
        merchantSlug,
        requestUrl,
      }),
      redirect: 'follow',
      signal: abortController.signal,
    });

    return {
      html: await response.text(),
      status: response.status,
      url: response.url || requestUrl.toString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function toCoverageCatalogSetOption(catalogSet: CatalogCanonicalSet) {
  return {
    id: catalogSet.setId,
    name: catalogSet.name,
    theme: catalogSet.primaryTheme,
  };
}

function buildPrimaryCoverageRowBySetId({
  merchants,
  offerSeeds,
  sets,
}: {
  merchants: readonly CommerceMerchant[];
  offerSeeds: readonly CommerceOfferSeed[];
  sets: readonly CatalogCanonicalSet[];
}) {
  return new Map(
    buildCommercePrimaryCoverageRows({
      catalogSets: sets.map(toCoverageCatalogSetOption),
      merchants,
      offerSeeds,
    }).map((row) => [row.setId, row] as const),
  );
}

function applySetFilters({
  filters,
  primaryCoverageRowBySetId,
  sets,
}: {
  filters: CommerceSeedGenerationFilters;
  primaryCoverageRowBySetId?: ReadonlyMap<string, CommercePrimaryCoverageRow>;
  sets: readonly CatalogCanonicalSet[];
}): CatalogCanonicalSet[] {
  const requestedSetIds = new Set(filters.setIds ?? []);
  let nextSets =
    requestedSetIds.size > 0
      ? sets.filter((set) => requestedSetIds.has(set.setId))
      : [...sets];

  if (requestedSetIds.size === 0 && filters.includeNonActive !== true) {
    nextSets = nextSets.filter((set) =>
      includeCatalogSetInDefaultCommerceCoverage(set.setId),
    );
  }

  if (
    requestedSetIds.size === 0 &&
    filters.primaryCoverageStatus &&
    filters.primaryCoverageStatus !== 'all' &&
    primaryCoverageRowBySetId
  ) {
    nextSets = nextSets.filter(
      (set) =>
        primaryCoverageRowBySetId.get(set.setId)?.status ===
        filters.primaryCoverageStatus,
    );
  }

  nextSets.sort(compareCatalogSetsForBatchWork);

  if (typeof filters.batchSize === 'number' && filters.batchSize > 0) {
    const batchIndex =
      typeof filters.batchIndex === 'number' && filters.batchIndex > 0
        ? filters.batchIndex
        : 0;
    const startIndex = batchIndex * filters.batchSize;

    nextSets = nextSets.slice(startIndex, startIndex + filters.batchSize);
  }

  return typeof filters.limit === 'number' && filters.limit > 0
    ? nextSets.slice(0, filters.limit)
    : nextSets;
}

function applyMerchantFilters({
  filters,
  merchants,
}: {
  filters: CommerceSeedGenerationFilters;
  merchants: readonly CommerceMerchant[];
}) {
  const requestedMerchantSlugs = normalizeRequestedSlugs(filters.merchantSlugs);

  return merchants.filter((merchant) => {
    if (!merchant.isActive || !supportsCommerceMerchantSearch(merchant.slug)) {
      return false;
    }

    if (requestedMerchantSlugs.size > 0) {
      return requestedMerchantSlugs.has(merchant.slug);
    }

    return includeCommerceMerchantInDefaultSeedGeneration(merchant.slug);
  });
}

function listActivePrimaryMerchants(
  merchants: readonly CommerceMerchant[],
): CommerceMerchant[] {
  return merchants
    .filter(
      (merchant) =>
        merchant.isActive &&
        getCommerceMerchantSupportTier(merchant.slug) === 'primary',
    )
    .sort(compareCommerceMerchantsByOperationalPriority);
}

function filterAuditPrimaryMerchants({
  filters,
  primaryMerchants,
}: {
  filters: CommerceSeedGenerationFilters;
  primaryMerchants: readonly CommerceMerchant[];
}): CommerceMerchant[] {
  const requestedMerchantSlugs = normalizeRequestedSlugs(filters.merchantSlugs);

  if (requestedMerchantSlugs.size === 0) {
    return [...primaryMerchants];
  }

  return primaryMerchants.filter((merchant) =>
    requestedMerchantSlugs.has(merchant.slug),
  );
}

function getComparableSeedTimestampMs(offerSeed: CommerceOfferSeed): number {
  const comparableValue =
    offerSeed.latestOffer?.fetchedAt ||
    offerSeed.lastVerifiedAt ||
    offerSeed.updatedAt ||
    offerSeed.createdAt;
  const comparableTimestamp = new Date(comparableValue).getTime();

  return Number.isFinite(comparableTimestamp) ? comparableTimestamp : 0;
}

function getValidationStatusPriority(
  validationStatus: CommerceOfferSeedValidationStatus,
): number {
  switch (validationStatus) {
    case 'valid':
      return 0;
    case 'pending':
      return 1;
    case 'stale':
      return 2;
    case 'invalid':
    default:
      return 3;
  }
}

function selectMostRelevantOfferSeed(
  offerSeeds: readonly CommerceOfferSeed[],
): CommerceOfferSeed | undefined {
  return [...offerSeeds].sort((left, right) => {
    return (
      Number(right.isActive) - Number(left.isActive) ||
      getValidationStatusPriority(left.validationStatus) -
        getValidationStatusPriority(right.validationStatus) ||
      getComparableSeedTimestampMs(right) -
        getComparableSeedTimestampMs(left) ||
      right.updatedAt.localeCompare(left.updatedAt) ||
      right.createdAt.localeCompare(left.createdAt) ||
      left.id.localeCompare(right.id)
    );
  })[0];
}

function getRecoveryPrioritySortOrder(
  recoveryPriority: CommerceGapRecoveryPriority,
): number {
  switch (recoveryPriority) {
    case 'recover_now':
      return 0;
    case 'verify_first':
      return 1;
    case 'parked':
    default:
      return 2;
  }
}

function buildCommercePrimaryCoverageGapMerchantAuditRow({
  merchant,
  offerSeed,
}: {
  merchant: CommerceMerchant;
  offerSeed?: CommerceOfferSeed;
}): CommercePrimaryCoverageGapMerchantAuditRow {
  if (!offerSeed) {
    const recoveryProfile = getCommerceGapRecoveryProfile({
      merchantSlug: merchant.slug,
      gapType: 'missing_seed',
    });

    return {
      gapType: 'missing_seed',
      hasSeed: false,
      merchantId: merchant.id,
      merchantName: merchant.name,
      merchantSlug: merchant.slug,
      recoveryPriority: recoveryProfile.priority,
      recoveryReason: recoveryProfile.reason,
    };
  }

  if (offerSeed.validationStatus === 'pending') {
    const recoveryProfile = getCommerceGapRecoveryProfile({
      merchantSlug: merchant.slug,
      gapType: 'seed_pending',
    });

    return {
      gapType: 'seed_pending',
      hasSeed: true,
      latestRefreshReason: offerSeed.latestOffer?.errorMessage,
      latestRefreshStatus: offerSeed.latestOffer?.fetchStatus,
      merchantId: merchant.id,
      merchantName: merchant.name,
      merchantSlug: merchant.slug,
      recoveryPriority: recoveryProfile.priority,
      recoveryReason: recoveryProfile.reason,
      seedIsActive: offerSeed.isActive,
      seedValidationStatus: offerSeed.validationStatus,
    };
  }

  if (offerSeed.validationStatus === 'invalid') {
    const recoveryProfile = getCommerceGapRecoveryProfile({
      merchantSlug: merchant.slug,
      gapType: 'seed_invalid',
    });

    return {
      gapType: 'seed_invalid',
      hasSeed: true,
      latestRefreshReason: offerSeed.latestOffer?.errorMessage,
      latestRefreshStatus: offerSeed.latestOffer?.fetchStatus,
      merchantId: merchant.id,
      merchantName: merchant.name,
      merchantSlug: merchant.slug,
      recoveryPriority: recoveryProfile.priority,
      recoveryReason: recoveryProfile.reason,
      seedIsActive: offerSeed.isActive,
      seedValidationStatus: offerSeed.validationStatus,
    };
  }

  if (offerSeed.validationStatus === 'stale') {
    const recoveryProfile = getCommerceGapRecoveryProfile({
      merchantSlug: merchant.slug,
      gapType: 'seed_stale',
    });

    return {
      gapType: 'seed_stale',
      hasSeed: true,
      latestRefreshReason: offerSeed.latestOffer?.errorMessage,
      latestRefreshStatus: offerSeed.latestOffer?.fetchStatus,
      merchantId: merchant.id,
      merchantName: merchant.name,
      merchantSlug: merchant.slug,
      recoveryPriority: recoveryProfile.priority,
      recoveryReason: recoveryProfile.reason,
      seedIsActive: offerSeed.isActive,
      seedValidationStatus: offerSeed.validationStatus,
    };
  }

  if (!offerSeed.latestOffer) {
    const recoveryProfile = getCommerceGapRecoveryProfile({
      merchantSlug: merchant.slug,
      gapType: 'no_latest_refresh',
    });

    return {
      gapType: 'no_latest_refresh',
      hasSeed: true,
      merchantId: merchant.id,
      merchantName: merchant.name,
      merchantSlug: merchant.slug,
      recoveryPriority: recoveryProfile.priority,
      recoveryReason: recoveryProfile.reason,
      seedIsActive: offerSeed.isActive,
      seedValidationStatus: offerSeed.validationStatus,
    };
  }

  switch (offerSeed.latestOffer.fetchStatus) {
    case 'pending': {
      const recoveryProfile = getCommerceGapRecoveryProfile({
        merchantSlug: merchant.slug,
        gapType: 'refresh_pending',
      });

      return {
        gapType: 'refresh_pending',
        hasSeed: true,
        latestRefreshReason: offerSeed.latestOffer.errorMessage,
        latestRefreshStatus: offerSeed.latestOffer.fetchStatus,
        merchantId: merchant.id,
        merchantName: merchant.name,
        merchantSlug: merchant.slug,
        recoveryPriority: recoveryProfile.priority,
        recoveryReason: recoveryProfile.reason,
        seedIsActive: offerSeed.isActive,
        seedValidationStatus: offerSeed.validationStatus,
      };
    }
    case 'unavailable': {
      const recoveryProfile = getCommerceGapRecoveryProfile({
        merchantSlug: merchant.slug,
        gapType: 'refresh_unavailable',
      });

      return {
        gapType: 'refresh_unavailable',
        hasSeed: true,
        latestRefreshReason: offerSeed.latestOffer.errorMessage,
        latestRefreshStatus: offerSeed.latestOffer.fetchStatus,
        merchantId: merchant.id,
        merchantName: merchant.name,
        merchantSlug: merchant.slug,
        recoveryPriority: recoveryProfile.priority,
        recoveryReason: recoveryProfile.reason,
        seedIsActive: offerSeed.isActive,
        seedValidationStatus: offerSeed.validationStatus,
      };
    }
    case 'error': {
      const recoveryProfile = getCommerceGapRecoveryProfile({
        merchantSlug: merchant.slug,
        gapType: 'refresh_error',
      });

      return {
        gapType: 'refresh_error',
        hasSeed: true,
        latestRefreshReason: offerSeed.latestOffer.errorMessage,
        latestRefreshStatus: offerSeed.latestOffer.fetchStatus,
        merchantId: merchant.id,
        merchantName: merchant.name,
        merchantSlug: merchant.slug,
        recoveryPriority: recoveryProfile.priority,
        recoveryReason: recoveryProfile.reason,
        seedIsActive: offerSeed.isActive,
        seedValidationStatus: offerSeed.validationStatus,
      };
    }
    case 'success':
    default: {
      const recoveryProfile = getCommerceGapRecoveryProfile({
        merchantSlug: merchant.slug,
        gapType: 'no_latest_refresh',
      });

      return {
        gapType: 'no_latest_refresh',
        hasSeed: true,
        latestRefreshReason: offerSeed.latestOffer.errorMessage,
        latestRefreshStatus: offerSeed.latestOffer.fetchStatus,
        merchantId: merchant.id,
        merchantName: merchant.name,
        merchantSlug: merchant.slug,
        recoveryPriority: recoveryProfile.priority,
        recoveryReason: recoveryProfile.reason,
        seedIsActive: offerSeed.isActive,
        seedValidationStatus: offerSeed.validationStatus,
      };
    }
  }
}

function compareGapTypeSummary(
  left: CommercePrimaryCoverageGapAuditTypeSummary,
  right: CommercePrimaryCoverageGapAuditTypeSummary,
): number {
  return right.count - left.count || left.gapType.localeCompare(right.gapType);
}

function compareGapRecoverySummary(
  left: CommercePrimaryCoverageGapAuditRecoverySummary,
  right: CommercePrimaryCoverageGapAuditRecoverySummary,
): number {
  return (
    getRecoveryPrioritySortOrder(left.recoveryPriority) -
      getRecoveryPrioritySortOrder(right.recoveryPriority) ||
    right.count - left.count ||
    left.recoveryPriority.localeCompare(right.recoveryPriority)
  );
}

function compareGapMerchantSummary(
  left: CommercePrimaryCoverageGapAuditMerchantSummary,
  right: CommercePrimaryCoverageGapAuditMerchantSummary,
): number {
  return (
    right.missingValidOfferCount - left.missingValidOfferCount ||
    compareCommerceMerchantsByOperationalPriority(
      { name: left.merchantName, slug: left.merchantSlug },
      { name: right.merchantName, slug: right.merchantSlug },
    )
  );
}

function compareGapMerchantAuditRows(
  left: CommercePrimaryCoverageGapMerchantAuditRow,
  right: CommercePrimaryCoverageGapMerchantAuditRow,
): number {
  return (
    getRecoveryPrioritySortOrder(left.recoveryPriority) -
      getRecoveryPrioritySortOrder(right.recoveryPriority) ||
    compareCommerceMerchantsByOperationalPriority(
      { name: left.merchantName, slug: left.merchantSlug },
      { name: right.merchantName, slug: right.merchantSlug },
    ) ||
    left.gapType.localeCompare(right.gapType)
  );
}

function getHighestRecoveryPriority(
  merchantGaps: readonly CommercePrimaryCoverageGapMerchantAuditRow[],
): CommerceGapRecoveryPriority {
  let highestRecoveryPriority: CommerceGapRecoveryPriority = 'parked';
  let highestRecoveryPrioritySortOrder = getRecoveryPrioritySortOrder(
    highestRecoveryPriority,
  );

  for (const gap of merchantGaps) {
    const gapRecoveryPrioritySortOrder = getRecoveryPrioritySortOrder(
      gap.recoveryPriority,
    );

    if (gapRecoveryPrioritySortOrder < highestRecoveryPrioritySortOrder) {
      highestRecoveryPriority = gap.recoveryPriority;
      highestRecoveryPrioritySortOrder = gapRecoveryPrioritySortOrder;
    }
  }

  return highestRecoveryPriority;
}

function compareGapAuditRows(
  left: CommercePrimaryCoverageGapAuditRow,
  right: CommercePrimaryCoverageGapAuditRow,
): number {
  return (
    getRecoveryPrioritySortOrder(
      getHighestRecoveryPriority(left.merchantGaps),
    ) -
      getRecoveryPrioritySortOrder(
        getHighestRecoveryPriority(right.merchantGaps),
      ) ||
    left.merchantGaps.length - right.merchantGaps.length ||
    left.setId.localeCompare(right.setId) ||
    left.setName.localeCompare(right.setName)
  );
}

function shouldUpdateGeneratedCandidate({
  existingSeed,
  nextSearchUrl,
}: {
  existingSeed: CommerceOfferSeed;
  nextSearchUrl: string;
}): boolean {
  return (
    isGeneratedCommerceSeedNote(existingSeed.notes) &&
    existingSeed.validationStatus === 'pending' &&
    (!existingSeed.isActive ||
      existingSeed.productUrl !== nextSearchUrl ||
      existingSeed.notes !==
        buildGeneratedCommerceSeedCandidateNote({
          merchantSlug: existingSeed.merchant?.slug ?? '',
          setId: existingSeed.setId,
        }))
  );
}

function buildGeneratedCandidateInput({
  merchant,
  set,
  searchUrl,
}: {
  merchant: CommerceMerchant;
  searchUrl: string;
  set: CatalogCanonicalSet;
}): CommerceOfferSeedInput {
  return {
    setId: set.setId,
    merchantId: merchant.id,
    productUrl: searchUrl,
    isActive: false,
    validationStatus: 'pending',
    notes: buildGeneratedCommerceSeedCandidateNote({
      merchantSlug: merchant.slug,
      setId: set.setId,
    }),
  };
}

function buildCandidateValidationUpdateInput({
  decision,
  existingSeed,
  merchant,
  nowIsoString,
  productUrl,
}: {
  decision: 'invalid' | 'stale' | 'valid';
  existingSeed: CommerceOfferSeed;
  merchant: CommerceMerchant;
  nowIsoString: string;
  productUrl: string;
}): CommerceOfferSeedInput {
  if (decision === 'valid') {
    return {
      setId: existingSeed.setId,
      merchantId: existingSeed.merchantId,
      productUrl,
      isActive: true,
      validationStatus: 'valid',
      lastVerifiedAt: nowIsoString,
      notes: buildGeneratedCommerceSeedValidatedNote({
        merchantSlug: merchant.slug,
        setId: existingSeed.setId,
      }),
    };
  }

  if (decision === 'invalid') {
    return {
      setId: existingSeed.setId,
      merchantId: existingSeed.merchantId,
      productUrl,
      isActive: false,
      validationStatus: 'invalid',
      lastVerifiedAt: nowIsoString,
      notes: buildGeneratedCommerceSeedRejectedNote({
        merchantSlug: merchant.slug,
        setId: existingSeed.setId,
      }),
    };
  }

  return {
    setId: existingSeed.setId,
    merchantId: existingSeed.merchantId,
    productUrl,
    isActive: false,
    validationStatus: 'stale',
    lastVerifiedAt: nowIsoString,
    notes: buildGeneratedCommerceSeedStaleNote({
      merchantSlug: merchant.slug,
      setId: existingSeed.setId,
    }),
  };
}

function rankLinkCandidates({
  candidates,
  set,
}: {
  candidates: readonly CommerceHtmlLinkCandidate[];
  set: CatalogCanonicalSet;
}) {
  return [...candidates]
    .map((candidate) => ({
      ...candidate,
      assessment: assessCommerceGeneratedSeedCandidate({
        target: {
          setId: set.setId,
          setName: set.name,
          pieceCount: set.pieceCount,
        },
        contextText: candidate.text,
        url: candidate.url,
      }),
    }))
    .filter(
      (candidate) =>
        candidate.assessment.score > 0 ||
        candidate.assessment.decision === 'invalid',
    )
    .sort((left, right) => right.assessment.score - left.assessment.score)
    .slice(0, 5);
}

function canTrustIntertoysPartnerSearchCandidate(input: {
  assessment: ReturnType<typeof assessCommerceGeneratedSeedCandidate>;
  linkCandidate: CommerceHtmlLinkCandidate;
}): boolean {
  if (
    input.linkCandidate.source !== 'intertoys-partner-search' ||
    input.assessment.decision !== 'valid'
  ) {
    return false;
  }

  if (
    !input.assessment.signals.exactSetIdMatch ||
    !input.assessment.signals.legoBrandSignal ||
    input.assessment.signals.accessorySignal ||
    input.assessment.signals.marketplaceNoiseSignal ||
    input.assessment.signals.otherSetNumbers.length > 0
  ) {
    return false;
  }

  const matchedNameTokenCount =
    input.assessment.signals.matchedNameTokens.length;

  if (
    input.assessment.signals.nameMatchRatio >= 0.5 ||
    matchedNameTokenCount >= 2 ||
    input.assessment.signals.pieceCountMatch
  ) {
    return true;
  }

  return false;
}

async function inspectGeneratedCommerceSeedValidation({
  catalogSet,
  fetchImpl,
  merchant,
  seedUrl,
}: {
  catalogSet: CatalogCanonicalSet;
  fetchImpl: typeof fetch;
  merchant: CommerceMerchant;
  seedUrl: string;
}): Promise<CommerceSeedValidationDebugResult> {
  const searchPage = await fetchMerchantHtmlPage({
    fetchImpl,
    merchantSlug: merchant.slug,
    url: seedUrl,
  });
  const searchPageAssessment = assessCommerceGeneratedSeedCandidate({
    target: {
      setId: catalogSet.setId,
      setName: catalogSet.name,
      pieceCount: catalogSet.pieceCount,
    },
    contextText: extractCommercePageValidationContextText(searchPage.html),
    url: searchPage.url,
  });
  const resolvedSearchUrl = new URL(searchPage.url);
  const rankedLinkCandidates = rankLinkCandidates({
    candidates: await extractMerchantSearchCandidates({
      catalogSet,
      fetchImpl,
      merchant,
      searchPage,
    }),
    set: catalogSet,
  });
  const debugCandidates: CommerceSeedValidationDebugCandidate[] = [];
  let finalDecision: 'invalid' | 'stale' | 'valid' = 'stale';
  let fallbackDecision: 'invalid' | 'stale' | undefined;
  let didValidate = false;
  let sawCandidateMismatch = false;
  let sawPlausibleCandidate = false;

  if (
    searchPage.status >= 200 &&
    searchPage.status < 300 &&
    !isLikelySearchUrl(resolvedSearchUrl) &&
    searchPageAssessment.decision === 'valid'
  ) {
    return {
      setId: catalogSet.setId,
      merchantSlug: merchant.slug,
      seedUrl,
      searchPageStatus: searchPage.status,
      searchPageUrl: searchPage.url,
      searchPageDecision: searchPageAssessment.decision,
      searchPageAssessmentReason: searchPageAssessment.reason,
      rankedCandidates: [],
      decision: 'valid',
    };
  }

  for (const linkCandidate of rankedLinkCandidates) {
    if (linkCandidate.assessment.decision === 'invalid') {
      sawCandidateMismatch = true;
      debugCandidates.push({
        url: linkCandidate.url,
        text: linkCandidate.text,
        decision: linkCandidate.assessment.decision,
        reason: linkCandidate.assessment.reason,
        score: linkCandidate.assessment.score,
      });
      continue;
    }

    sawPlausibleCandidate = true;

    if (
      merchant.slug === 'intertoys' &&
      canTrustIntertoysPartnerSearchCandidate({
        linkCandidate,
        assessment: linkCandidate.assessment,
      })
    ) {
      debugCandidates.push({
        url: linkCandidate.url,
        text: linkCandidate.text,
        decision: 'valid',
        reason: linkCandidate.assessment.reason,
        score: linkCandidate.assessment.score,
        pageUrl: linkCandidate.url,
        pageAssessmentReason:
          'Validated from the Intertoys product result card with exact LEGO and set-number signals.',
      });
      finalDecision = 'valid';
      didValidate = true;
      break;
    }

    const candidatePage = await fetchMerchantHtmlPage({
      fetchImpl,
      merchantSlug: merchant.slug,
      url: linkCandidate.url,
    });

    if (candidatePage.status < 200 || candidatePage.status >= 300) {
      debugCandidates.push({
        url: linkCandidate.url,
        text: linkCandidate.text,
        decision: 'stale',
        reason: `Candidate page returned HTTP ${candidatePage.status}.`,
        score: linkCandidate.assessment.score,
        pageStatus: candidatePage.status,
        pageUrl: candidatePage.url,
      });
      continue;
    }

    const candidateAssessment = assessCommerceGeneratedSeedCandidate({
      target: {
        setId: catalogSet.setId,
        setName: catalogSet.name,
        pieceCount: catalogSet.pieceCount,
      },
      contextText: extractCommercePageValidationContextText(candidatePage.html),
      url: candidatePage.url,
    });

    debugCandidates.push({
      url: linkCandidate.url,
      text: linkCandidate.text,
      decision: candidateAssessment.decision,
      reason: linkCandidate.assessment.reason,
      score: linkCandidate.assessment.score,
      pageAssessmentReason: candidateAssessment.reason,
      pageStatus: candidatePage.status,
      pageUrl: candidatePage.url,
    });

    if (candidateAssessment.decision === 'valid') {
      finalDecision = 'valid';
      didValidate = true;
      break;
    }

    if (candidateAssessment.decision === 'invalid') {
      sawCandidateMismatch = true;
    }
  }

  if (!didValidate) {
    fallbackDecision =
      !sawPlausibleCandidate &&
      (searchPageAssessment.decision === 'invalid' || sawCandidateMismatch)
        ? 'invalid'
        : 'stale';
    finalDecision = fallbackDecision;
  }

  return {
    setId: catalogSet.setId,
    merchantSlug: merchant.slug,
    seedUrl,
    searchPageStatus: searchPage.status,
    searchPageUrl: searchPage.url,
    searchPageDecision: searchPageAssessment.decision,
    searchPageAssessmentReason: searchPageAssessment.reason,
    rankedCandidates: debugCandidates,
    decision: finalDecision,
    fallbackDecision,
  };
}

export async function listCommercePrimaryCoverageReport({
  filters = {},
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  listCommerceBenchmarkSetsFn = listCommerceBenchmarkSets,
  listCommerceMerchantsFn = listCommerceMerchants,
  listCommerceOfferSeedsFn = listCommerceOfferSeeds,
}: {
  filters?: CommerceSeedGenerationFilters;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  listCommerceBenchmarkSetsFn?: typeof listCommerceBenchmarkSets;
  listCommerceMerchantsFn?: typeof listCommerceMerchants;
  listCommerceOfferSeedsFn?: typeof listCommerceOfferSeeds;
} = {}): Promise<CommercePrimaryCoverageReport> {
  const [catalogSets, benchmarkSets, merchants, offerSeeds] = await Promise.all(
    [
      listCanonicalCatalogSetsFn(),
      listCommerceBenchmarkSetsFn(),
      listCommerceMerchantsFn(),
      listCommerceOfferSeedsFn(),
    ],
  );
  const benchmarkSetIds = new Set(
    benchmarkSets.map((benchmarkSet) => benchmarkSet.setId),
  );
  const scopedCatalogSets =
    filters.benchmarkOnly === true
      ? catalogSets.filter((set) => benchmarkSetIds.has(set.setId))
      : catalogSets;
  const allPrimaryCoverageRows = buildCommercePrimaryCoverageRows({
    catalogSets: scopedCatalogSets.map(toCoverageCatalogSetOption),
    merchants,
    offerSeeds,
  });
  const reportSetIds = new Set(
    (filters.includeNonActive === true
      ? scopedCatalogSets
      : scopedCatalogSets.filter((set) =>
          includeCatalogSetInDefaultCommerceCoverage(set.setId),
        )
    ).map((set) => set.setId),
  );
  const reportPrimaryCoverageRows = allPrimaryCoverageRows.filter((row) =>
    reportSetIds.has(row.setId),
  );
  const primaryCoverageRowBySetId = new Map(
    allPrimaryCoverageRows.map((row) => [row.setId, row] as const),
  );
  const selectedSetIds = applySetFilters({
    filters,
    sets: scopedCatalogSets,
    primaryCoverageRowBySetId,
  }).map((catalogSet) => catalogSet.setId);
  const reportPrimaryCoverageRowBySetId = new Map(
    reportPrimaryCoverageRows.map((row) => [row.setId, row] as const),
  );
  const allPrimaryCoverageRowBySetId = new Map(
    allPrimaryCoverageRows.map((row) => [row.setId, row] as const),
  );
  const selectedRows = selectedSetIds
    .map(
      (setId) =>
        reportPrimaryCoverageRowBySetId.get(setId) ??
        allPrimaryCoverageRowBySetId.get(setId),
    )
    .filter((row): row is CommercePrimaryCoverageRow => Boolean(row));
  const primaryMerchantSlugs = merchants
    .filter(
      (merchant) =>
        merchant.isActive &&
        includeCommerceMerchantInDefaultSeedGeneration(merchant.slug),
    )
    .sort((left, right) => left.slug.localeCompare(right.slug))
    .map((merchant) => merchant.slug);

  return {
    totalSetCount: reportPrimaryCoverageRows.length,
    selectedSetCount: selectedRows.length,
    rows: selectedRows,
    primaryMerchantSlugs,
    noPrimarySeedsCount: reportPrimaryCoverageRows.filter(
      (row) => row.status === 'no_primary_seeds',
    ).length,
    noValidPrimaryOffersCount: reportPrimaryCoverageRows.filter(
      (row) => row.status === 'no_valid_primary_offers',
    ).length,
    partialPrimaryCoverageCount: reportPrimaryCoverageRows.filter(
      (row) => row.status === 'partial_primary_coverage',
    ).length,
    fullPrimaryCoverageCount: reportPrimaryCoverageRows.filter(
      (row) => row.status === 'full_primary_coverage',
    ).length,
  };
}

export async function listCommercePrimaryCoverageGapAudit({
  filters = {},
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  listCommerceBenchmarkSetsFn = listCommerceBenchmarkSets,
  listCommerceMerchantsFn = listCommerceMerchants,
  listCommerceOfferSeedsFn = listCommerceOfferSeeds,
}: {
  filters?: CommerceSeedGenerationFilters;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  listCommerceBenchmarkSetsFn?: typeof listCommerceBenchmarkSets;
  listCommerceMerchantsFn?: typeof listCommerceMerchants;
  listCommerceOfferSeedsFn?: typeof listCommerceOfferSeeds;
} = {}): Promise<CommercePrimaryCoverageGapAuditReport> {
  const [catalogSets, benchmarkSets, merchants, offerSeeds] = await Promise.all(
    [
      listCanonicalCatalogSetsFn(),
      listCommerceBenchmarkSetsFn(),
      listCommerceMerchantsFn(),
      listCommerceOfferSeedsFn(),
    ],
  );
  const benchmarkSetIds = new Set(
    benchmarkSets.map((benchmarkSet) => benchmarkSet.setId),
  );
  const scopedCatalogSets =
    filters.benchmarkOnly === true
      ? catalogSets.filter((set) => benchmarkSetIds.has(set.setId))
      : catalogSets;
  const allPrimaryCoverageRows = buildCommercePrimaryCoverageRows({
    catalogSets: scopedCatalogSets.map(toCoverageCatalogSetOption),
    merchants,
    offerSeeds,
  });
  const reportSetIds = new Set(
    (filters.includeNonActive === true
      ? scopedCatalogSets
      : scopedCatalogSets.filter((set) =>
          includeCatalogSetInDefaultCommerceCoverage(set.setId),
        )
    ).map((set) => set.setId),
  );
  const reportPrimaryCoverageRows = allPrimaryCoverageRows.filter((row) =>
    reportSetIds.has(row.setId),
  );
  const primaryCoverageRowBySetId = new Map(
    allPrimaryCoverageRows.map((row) => [row.setId, row] as const),
  );
  const selectedSetIds = applySetFilters({
    filters,
    sets: scopedCatalogSets,
    primaryCoverageRowBySetId,
  }).map((catalogSet) => catalogSet.setId);
  const allPrimaryMerchants = listActivePrimaryMerchants(merchants);
  const auditedPrimaryMerchants = filterAuditPrimaryMerchants({
    filters,
    primaryMerchants: allPrimaryMerchants,
  });
  const offerSeedsBySetId = new Map<string, CommerceOfferSeed[]>();

  for (const offerSeed of offerSeeds) {
    const nextOfferSeeds = offerSeedsBySetId.get(offerSeed.setId) ?? [];
    nextOfferSeeds.push(offerSeed);
    offerSeedsBySetId.set(offerSeed.setId, nextOfferSeeds);
  }

  const rows = selectedSetIds
    .map((setId) => {
      const coverageRow = primaryCoverageRowBySetId.get(setId);

      if (!coverageRow) {
        return undefined;
      }

      const setOfferSeeds = offerSeedsBySetId.get(setId) ?? [];
      const merchantGaps = auditedPrimaryMerchants
        .filter((merchant) =>
          coverageRow.missingValidPrimaryOfferMerchantSlugs.includes(
            merchant.slug,
          ),
        )
        .map((merchant) =>
          buildCommercePrimaryCoverageGapMerchantAuditRow({
            merchant,
            offerSeed: selectMostRelevantOfferSeed(
              setOfferSeeds.filter(
                (offerSeed) => offerSeed.merchantId === merchant.id,
              ),
            ),
          }),
        );

      if (filters.merchantSlugs?.length && merchantGaps.length === 0) {
        return undefined;
      }

      return {
        merchantGaps: [...merchantGaps].sort(compareGapMerchantAuditRows),
        missingValidPrimaryOfferMerchantNames:
          coverageRow.missingValidPrimaryOfferMerchantNames,
        missingValidPrimaryOfferMerchantSlugs:
          coverageRow.missingValidPrimaryOfferMerchantSlugs,
        primaryMerchantTargetCount: coverageRow.primaryMerchantTargetCount,
        primarySeedCount: coverageRow.primarySeedCount,
        setId: coverageRow.setId,
        setName: coverageRow.setName,
        status: coverageRow.status,
        theme: coverageRow.theme,
        validPrimaryOfferCount: coverageRow.validPrimaryOfferCount,
      } satisfies CommercePrimaryCoverageGapAuditRow;
    })
    .filter(Boolean)
    .sort(compareGapAuditRows) as CommercePrimaryCoverageGapAuditRow[];

  const missingValidOfferCountsByMerchant = auditedPrimaryMerchants
    .map((merchant) => ({
      merchantName: merchant.name,
      merchantSlug: merchant.slug,
      missingValidOfferCount: rows.filter((row) =>
        row.merchantGaps.some((gap) => gap.merchantSlug === merchant.slug),
      ).length,
    }))
    .filter((row) => row.missingValidOfferCount > 0)
    .sort(compareGapMerchantSummary);
  const gapCountByTypeMap = new Map<CommercePrimaryCoverageGapType, number>();
  const recoveryCountByPriorityMap = new Map<
    CommerceGapRecoveryPriority,
    number
  >();

  for (const row of rows) {
    for (const gap of row.merchantGaps) {
      gapCountByTypeMap.set(
        gap.gapType,
        (gapCountByTypeMap.get(gap.gapType) ?? 0) + 1,
      );
      recoveryCountByPriorityMap.set(
        gap.recoveryPriority,
        (recoveryCountByPriorityMap.get(gap.recoveryPriority) ?? 0) + 1,
      );
    }
  }

  return {
    totalSetCount: reportPrimaryCoverageRows.length,
    selectedSetCount: rows.length,
    rows,
    primaryMerchantSlugs: allPrimaryMerchants.map((merchant) => merchant.slug),
    auditedMerchantSlugs: auditedPrimaryMerchants.map(
      (merchant) => merchant.slug,
    ),
    summary: {
      actionablePartialSetCount: reportPrimaryCoverageRows.filter(
        (row) => row.status === 'partial_primary_coverage',
      ).length,
      countsByRecoveryPriority: [...recoveryCountByPriorityMap.entries()]
        .map(([recoveryPriority, count]) => ({
          recoveryPriority,
          count,
        }))
        .sort(compareGapRecoverySummary),
      gapCountsByType: [...gapCountByTypeMap.entries()]
        .map(([gapType, count]) => ({
          gapType,
          count,
        }))
        .sort(compareGapTypeSummary),
      missingValidOfferCountsByMerchant,
      parkedCount: recoveryCountByPriorityMap.get('parked') ?? 0,
      recoverNowCount: recoveryCountByPriorityMap.get('recover_now') ?? 0,
      setsMissingSeedCount: rows.filter((row) =>
        row.merchantGaps.some((gap) => gap.gapType === 'missing_seed'),
      ).length,
      setsWithFullSeedButMissingOfferCount: rows.filter(
        (row) =>
          row.primarySeedCount === row.primaryMerchantTargetCount &&
          row.validPrimaryOfferCount < row.primaryMerchantTargetCount,
      ).length,
      verifyFirstCount: recoveryCountByPriorityMap.get('verify_first') ?? 0,
    },
  };
}

export async function inspectCommerceGeneratedSeedCandidates({
  fetchImpl = fetch,
  filters = {},
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  listCommerceMerchantsFn = listCommerceMerchants,
  listCommerceOfferSeedsFn = listCommerceOfferSeeds,
}: {
  fetchImpl?: typeof fetch;
  filters?: CommerceSeedGenerationFilters;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  listCommerceMerchantsFn?: typeof listCommerceMerchants;
  listCommerceOfferSeedsFn?: typeof listCommerceOfferSeeds;
} = {}): Promise<CommerceSeedValidationDebugResult[]> {
  const [catalogSets, merchants, offerSeeds] = await Promise.all([
    listCanonicalCatalogSetsFn(),
    listCommerceMerchantsFn(),
    listCommerceOfferSeedsFn(),
  ]);
  const selectedSets = applySetFilters({
    filters,
    sets: catalogSets,
  });
  const selectedMerchants = applyMerchantFilters({
    filters,
    merchants,
  });
  const existingSeedByKey = new Map(
    offerSeeds.map((offerSeed) => [
      `${offerSeed.setId}:${offerSeed.merchantId}`,
      offerSeed,
    ]),
  );
  const results: CommerceSeedValidationDebugResult[] = [];

  for (const catalogSet of selectedSets) {
    for (const merchant of selectedMerchants) {
      const existingSeed = existingSeedByKey.get(
        `${catalogSet.setId}:${merchant.id}`,
      );
      const seedUrl =
        existingSeed?.productUrl ??
        buildCommerceGeneratedSeedSearchUrl({
          merchantSlug: merchant.slug,
          setId: catalogSet.setId,
        });

      if (!seedUrl) {
        continue;
      }

      try {
        results.push(
          await inspectGeneratedCommerceSeedValidation({
            catalogSet,
            fetchImpl,
            merchant,
            seedUrl,
          }),
        );
      } catch (error) {
        results.push({
          setId: catalogSet.setId,
          merchantSlug: merchant.slug,
          seedUrl,
          searchPageStatus: 0,
          searchPageUrl: seedUrl,
          searchPageDecision: 'stale',
          searchPageAssessmentReason:
            error instanceof Error ? error.message : 'Unknown fetch failure.',
          rankedCandidates: [],
          decision: 'stale',
          fallbackDecision: 'stale',
        });
      }
    }
  }

  return results;
}

export async function generateCommerceOfferSeedCandidates({
  createCommerceOfferSeedFn = createCommerceOfferSeed,
  filters = {},
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  listCommerceBenchmarkSetsFn = listCommerceBenchmarkSets,
  listCommerceMerchantsFn = listCommerceMerchants,
  listCommerceOfferSeedsFn = listCommerceOfferSeeds,
  updateCommerceOfferSeedFn = updateCommerceOfferSeed,
  write = false,
}: {
  createCommerceOfferSeedFn?: typeof createCommerceOfferSeed;
  filters?: CommerceSeedGenerationFilters;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  listCommerceBenchmarkSetsFn?: typeof listCommerceBenchmarkSets;
  listCommerceMerchantsFn?: typeof listCommerceMerchants;
  listCommerceOfferSeedsFn?: typeof listCommerceOfferSeeds;
  updateCommerceOfferSeedFn?: typeof updateCommerceOfferSeed;
  write?: boolean;
} = {}): Promise<CommerceSeedGenerationSummary> {
  const [catalogSets, benchmarkSets, merchants, offerSeeds] = await Promise.all(
    [
      listCanonicalCatalogSetsFn(),
      listCommerceBenchmarkSetsFn(),
      listCommerceMerchantsFn(),
      listCommerceOfferSeedsFn(),
    ],
  );
  const benchmarkSetIds = new Set(
    benchmarkSets.map((benchmarkSet) => benchmarkSet.setId),
  );
  const scopedCatalogSets =
    filters.benchmarkOnly === true
      ? catalogSets.filter((set) => benchmarkSetIds.has(set.setId))
      : catalogSets;
  const primaryCoverageRowBySetId = buildPrimaryCoverageRowBySetId({
    sets: scopedCatalogSets,
    merchants,
    offerSeeds,
  });
  const candidateSets = applySetFilters({
    filters,
    sets: scopedCatalogSets,
    primaryCoverageRowBySetId,
  });
  const candidateMerchants = applyMerchantFilters({
    filters,
    merchants,
  });
  const existingSeedByKey = new Map(
    offerSeeds.map((offerSeed) => [
      `${offerSeed.setId}:${offerSeed.merchantId}`,
      offerSeed,
    ]),
  );
  let insertedCount = 0;
  let skippedCount = 0;
  let updatedCount = 0;
  let candidateCount = 0;

  for (const set of candidateSets) {
    for (const merchant of candidateMerchants) {
      const searchUrl = buildCommerceGeneratedSeedSearchUrl({
        merchantSlug: merchant.slug,
        setId: set.setId,
      });

      if (!searchUrl) {
        skippedCount += 1;
        continue;
      }

      candidateCount += 1;
      const nextInput = buildGeneratedCandidateInput({
        merchant,
        set,
        searchUrl,
      });
      const existingSeed = existingSeedByKey.get(`${set.setId}:${merchant.id}`);

      if (!existingSeed) {
        if (write) {
          await createCommerceOfferSeedFn({
            input: nextInput,
          });
        }

        insertedCount += 1;
        continue;
      }

      if (
        shouldUpdateGeneratedCandidate({
          existingSeed,
          nextSearchUrl: searchUrl,
        })
      ) {
        if (write) {
          await updateCommerceOfferSeedFn({
            offerSeedId: existingSeed.id,
            input: nextInput,
          });
        }

        updatedCount += 1;
        continue;
      }

      skippedCount += 1;
    }
  }

  return {
    candidateCount,
    insertedCount,
    skippedCount,
    supportedMerchantSlugs: candidateMerchants.map((merchant) => merchant.slug),
    updatedCount,
  };
}

export async function validateGeneratedCommerceOfferSeedCandidates({
  fetchImpl = fetch,
  filters = {},
  listCanonicalCatalogSetsFn = listCanonicalCatalogSets,
  listCommerceBenchmarkSetsFn = listCommerceBenchmarkSets,
  listCommerceMerchantsFn = listCommerceMerchants,
  listCommerceOfferSeedsFn = listCommerceOfferSeeds,
  now = new Date(),
  updateCommerceOfferSeedFn = updateCommerceOfferSeed,
  write = false,
}: {
  fetchImpl?: typeof fetch;
  filters?: CommerceSeedGenerationFilters;
  listCanonicalCatalogSetsFn?: typeof listCanonicalCatalogSets;
  listCommerceBenchmarkSetsFn?: typeof listCommerceBenchmarkSets;
  listCommerceMerchantsFn?: typeof listCommerceMerchants;
  listCommerceOfferSeedsFn?: typeof listCommerceOfferSeeds;
  now?: Date;
  updateCommerceOfferSeedFn?: typeof updateCommerceOfferSeed;
  write?: boolean;
} = {}): Promise<CommerceSeedValidationSummary> {
  const [catalogSets, benchmarkSets, merchants, offerSeeds] = await Promise.all(
    [
      listCanonicalCatalogSetsFn(),
      listCommerceBenchmarkSetsFn(),
      listCommerceMerchantsFn(),
      listCommerceOfferSeedsFn(),
    ],
  );
  const benchmarkSetIds = new Set(
    benchmarkSets.map((benchmarkSet) => benchmarkSet.setId),
  );
  const scopedCatalogSets =
    filters.benchmarkOnly === true
      ? catalogSets.filter((set) => benchmarkSetIds.has(set.setId))
      : catalogSets;
  const primaryCoverageRowBySetId = buildPrimaryCoverageRowBySetId({
    sets: scopedCatalogSets,
    merchants,
    offerSeeds,
  });
  const targetCatalogSets = applySetFilters({
    filters,
    sets: scopedCatalogSets,
    primaryCoverageRowBySetId,
  });
  const targetSetIds = new Set(
    targetCatalogSets.map((catalogSet) => catalogSet.setId),
  );

  if (targetCatalogSets.length === 0) {
    return {
      processedCount: 0,
      validCount: 0,
      invalidCount: 0,
      staleCount: 0,
      skippedCount: 0,
    };
  }
  const catalogSetById = new Map(
    catalogSets.map((catalogSet) => [catalogSet.setId, catalogSet] as const),
  );
  const merchantById = new Map(
    merchants.map((merchant) => [merchant.id, merchant] as const),
  );
  const requestedMerchantSlugs = normalizeRequestedSlugs(filters.merchantSlugs);
  const pendingSeeds = offerSeeds.filter((offerSeed) => {
    const merchant =
      offerSeed.merchant ?? merchantById.get(offerSeed.merchantId);

    if (!merchant || !supportsCommerceMerchantSearch(merchant.slug)) {
      return false;
    }

    if (!isGeneratedCommerceSeedNote(offerSeed.notes)) {
      return false;
    }

    const isRecheckableGeneratedSeed =
      filters.recheckGenerated === true &&
      !offerSeed.isActive &&
      (offerSeed.validationStatus === 'invalid' ||
        offerSeed.validationStatus === 'stale');

    if (
      offerSeed.validationStatus !== 'pending' &&
      !isRecheckableGeneratedSeed
    ) {
      return false;
    }

    if (!targetSetIds.has(offerSeed.setId)) {
      return false;
    }

    if (requestedMerchantSlugs.size > 0) {
      return requestedMerchantSlugs.has(merchant.slug);
    }

    return includeCommerceMerchantInDefaultSeedGeneration(merchant.slug);
  });
  const candidateSeeds =
    typeof filters.limit === 'number' && filters.limit > 0
      ? pendingSeeds.slice(0, filters.limit)
      : pendingSeeds;
  const nowIsoString = now.toISOString();
  let invalidCount = 0;
  let processedCount = 0;
  let skippedCount = 0;
  let staleCount = 0;
  let validCount = 0;

  for (const offerSeed of candidateSeeds) {
    const merchant =
      offerSeed.merchant ?? merchantById.get(offerSeed.merchantId);
    const catalogSet = catalogSetById.get(offerSeed.setId);

    if (!merchant || !catalogSet) {
      skippedCount += 1;
      continue;
    }

    processedCount += 1;

    try {
      const searchPage = await fetchMerchantHtmlPage({
        fetchImpl,
        merchantSlug: merchant.slug,
        url: offerSeed.productUrl,
      });

      if (searchPage.status === 404 || searchPage.status === 410) {
        if (write) {
          await updateCommerceOfferSeedFn({
            offerSeedId: offerSeed.id,
            input: buildCandidateValidationUpdateInput({
              decision: 'invalid',
              existingSeed: offerSeed,
              merchant,
              nowIsoString,
              productUrl: offerSeed.productUrl,
            }),
          });
        }

        invalidCount += 1;
        continue;
      }

      if (searchPage.status < 200 || searchPage.status >= 300) {
        if (write) {
          await updateCommerceOfferSeedFn({
            offerSeedId: offerSeed.id,
            input: buildCandidateValidationUpdateInput({
              decision: 'stale',
              existingSeed: offerSeed,
              merchant,
              nowIsoString,
              productUrl: offerSeed.productUrl,
            }),
          });
        }

        staleCount += 1;
        continue;
      }

      const resolvedSearchUrl = new URL(searchPage.url);
      const searchPageAssessment = assessCommerceGeneratedSeedCandidate({
        target: {
          setId: catalogSet.setId,
          setName: catalogSet.name,
          pieceCount: catalogSet.pieceCount,
        },
        contextText: extractCommercePageValidationContextText(searchPage.html),
        url: searchPage.url,
      });

      if (
        !isLikelySearchUrl(resolvedSearchUrl) &&
        searchPageAssessment.decision === 'valid'
      ) {
        if (write) {
          await updateCommerceOfferSeedFn({
            offerSeedId: offerSeed.id,
            input: buildCandidateValidationUpdateInput({
              decision: 'valid',
              existingSeed: offerSeed,
              merchant,
              nowIsoString,
              productUrl: searchPage.url,
            }),
          });
        }

        validCount += 1;
        continue;
      }

      const rankedLinkCandidates = rankLinkCandidates({
        candidates: await extractMerchantSearchCandidates({
          catalogSet,
          fetchImpl,
          merchant,
          searchPage,
        }),
        set: catalogSet,
      });
      let didValidate = false;
      let sawCandidateMismatch = false;
      let sawPlausibleCandidate = false;

      for (const linkCandidate of rankedLinkCandidates) {
        if (linkCandidate.assessment.decision === 'invalid') {
          sawCandidateMismatch = true;
          continue;
        }

        sawPlausibleCandidate = true;

        if (
          merchant.slug === 'intertoys' &&
          canTrustIntertoysPartnerSearchCandidate({
            linkCandidate,
            assessment: linkCandidate.assessment,
          })
        ) {
          if (write) {
            await updateCommerceOfferSeedFn({
              offerSeedId: offerSeed.id,
              input: buildCandidateValidationUpdateInput({
                decision: 'valid',
                existingSeed: offerSeed,
                merchant,
                nowIsoString,
                productUrl: linkCandidate.url,
              }),
            });
          }

          validCount += 1;
          didValidate = true;
          break;
        }

        const candidatePage = await fetchMerchantHtmlPage({
          fetchImpl,
          merchantSlug: merchant.slug,
          url: linkCandidate.url,
        });

        if (candidatePage.status < 200 || candidatePage.status >= 300) {
          continue;
        }

        const candidateAssessment = assessCommerceGeneratedSeedCandidate({
          target: {
            setId: catalogSet.setId,
            setName: catalogSet.name,
            pieceCount: catalogSet.pieceCount,
          },
          contextText: extractCommercePageValidationContextText(
            candidatePage.html,
          ),
          url: candidatePage.url,
        });

        if (candidateAssessment.decision === 'valid') {
          if (write) {
            await updateCommerceOfferSeedFn({
              offerSeedId: offerSeed.id,
              input: buildCandidateValidationUpdateInput({
                decision: 'valid',
                existingSeed: offerSeed,
                merchant,
                nowIsoString,
                productUrl: candidatePage.url,
              }),
            });
          }

          validCount += 1;
          didValidate = true;
          break;
        }

        if (candidateAssessment.decision === 'invalid') {
          sawCandidateMismatch = true;
        }
      }

      if (didValidate) {
        continue;
      }

      const fallbackDecision =
        !sawPlausibleCandidate &&
        (searchPageAssessment.decision === 'invalid' || sawCandidateMismatch)
          ? 'invalid'
          : 'stale';

      if (write) {
        await updateCommerceOfferSeedFn({
          offerSeedId: offerSeed.id,
          input: buildCandidateValidationUpdateInput({
            decision: fallbackDecision,
            existingSeed: offerSeed,
            merchant,
            nowIsoString,
            productUrl: offerSeed.productUrl,
          }),
        });
      }

      if (fallbackDecision === 'invalid') {
        invalidCount += 1;
      } else {
        staleCount += 1;
      }
    } catch {
      if (write) {
        await updateCommerceOfferSeedFn({
          offerSeedId: offerSeed.id,
          input: buildCandidateValidationUpdateInput({
            decision: 'stale',
            existingSeed: offerSeed,
            merchant,
            nowIsoString,
            productUrl: offerSeed.productUrl,
          }),
        });
      }

      staleCount += 1;
    }
  }

  return {
    invalidCount,
    processedCount,
    skippedCount,
    staleCount,
    validCount,
  };
}
