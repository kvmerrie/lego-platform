import { dutchAffiliateMerchantConfigs } from '@lego-platform/affiliate/data-access-server';
import type { AffiliateMerchantConfig } from '@lego-platform/affiliate/util';
import {
  DEFAULT_COMMERCE_STALE_DAYS,
  type CommerceOfferLatestRecordInput,
  type CommerceOfferSeedValidationStatus,
} from '@lego-platform/commerce/util';
import {
  dutchPricingReferenceValues,
  type PricingMerchantSummary,
  type PricingObservationSeed,
} from '@lego-platform/pricing/data-access-server';
import {
  DUTCH_REGION_CODE,
  EURO_CURRENCY_CODE,
  NEW_OFFER_CONDITION,
  type PricingAvailability,
} from '@lego-platform/pricing/util';
import {
  listActiveCommerceRefreshSeeds,
  type CommerceOfferSeedValidationUpdateInput,
  type CommerceRefreshSeed,
  updateCommerceOfferSeedValidationState,
  upsertCommerceOfferLatestRecord,
} from '@lego-platform/commerce/data-access-server';

const MERCHANT_REQUEST_TIMEOUT_MS = 15000;
const browserLikeMerchantUserAgent =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';
const browserLikeMerchantAcceptHeader =
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8';
const structuredDataScriptPattern =
  /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
const htmlTagPattern = /<[^>]+>/g;
const amazonPrimaryAvailabilityMarkers = [
  'availabilityInsideBuyBox_feature_div',
  'availability_feature_div',
  'id="availability"',
  "id='availability'",
  'id="outOfStock"',
  "id='outOfStock'",
] as const;
const amazonPrimaryPriceMarkers = [
  'corePriceDisplay_desktop_feature_div',
  'corePriceDisplay_mobile_feature_div',
  'corePrice_feature_div',
  'apex_desktop',
  'apex_offerDisplay_desktop',
  'apex_offerDisplay_mobile',
  'priceblock_ourprice',
  'priceblock_dealprice',
  'priceblock_saleprice',
  'priceToPay',
  'tp_price_block_total_price_ww',
] as const;
const amazonPrimaryActionMarkers = [
  'add-to-cart-button',
  'buy-now-button',
  'submit.add-to-cart',
  'submit.buy-now',
] as const;
const referencePriceMinorBySetId = new Map(
  dutchPricingReferenceValues.map((pricingReferenceValue) => [
    pricingReferenceValue.setId,
    pricingReferenceValue.referencePriceMinor,
  ]),
);

export interface CommerceRefreshLogger {
  error?: (message: string) => void;
  info?: (message: string) => void;
  warn?: (message: string) => void;
}

export interface CommerceRefreshSummary {
  invalidCount: number;
  staleCount: number;
  successCount: number;
  totalCount: number;
  unavailableCount: number;
}

export interface CommerceSyncInputs {
  activeMerchantCount: number;
  affiliateMerchantConfigs: readonly AffiliateMerchantConfig[];
  enabledSetIds: readonly string[];
  merchantSummaries: readonly PricingMerchantSummary[];
  pricingObservationSeeds: readonly PricingObservationSeed[];
}

export interface ParsedCommerceOfferSnapshot {
  availability: PricingAvailability;
  currencyCode?: string;
  priceMinor?: number;
}

interface CommerceOfferSnapshotExtractionResult {
  reason?: string;
  snapshot: ParsedCommerceOfferSnapshot | null;
}

type LatestOfferWriter = typeof upsertCommerceOfferLatestRecord;
type SeedValidationWriter = typeof updateCommerceOfferSeedValidationState;
type MerchantRequestProfile = 'default' | 'merchant-home';

function isHeadlineEligibleAvailability(availability: PricingAvailability) {
  return availability === 'in_stock' || availability === 'limited';
}

function isSupportedAvailability(
  availability: string | undefined,
): availability is PricingAvailability {
  return (
    availability === 'in_stock' ||
    availability === 'limited' ||
    availability === 'out_of_stock' ||
    availability === 'preorder' ||
    availability === 'unknown'
  );
}

function normalizeAvailability(
  availability: string | undefined,
): PricingAvailability {
  return isSupportedAvailability(availability) ? availability : 'unknown';
}

function normalizeCurrencyCode(currencyCode: string | undefined) {
  return (currencyCode ?? EURO_CURRENCY_CODE).trim().toUpperCase();
}

function parsePriceMinor(
  value: string | number | undefined,
): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value * 100);
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return undefined;
  }

  const compactValue = trimmedValue
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=.*\.)/g, '.');

  let normalizedValue = compactValue;
  const lastCommaIndex = compactValue.lastIndexOf(',');
  const lastDotIndex = compactValue.lastIndexOf('.');

  if (lastCommaIndex >= 0 && lastDotIndex >= 0) {
    if (lastCommaIndex > lastDotIndex) {
      normalizedValue = compactValue.replace(/\./g, '').replace(',', '.');
    } else {
      normalizedValue = compactValue.replace(/,/g, '');
    }
  } else if (lastCommaIndex >= 0) {
    normalizedValue =
      compactValue.length - lastCommaIndex - 1 === 2
        ? compactValue.replace(/\./g, '').replace(',', '.')
        : compactValue.replace(/,/g, '');
  } else if (lastDotIndex >= 0) {
    normalizedValue =
      compactValue.length - lastDotIndex - 1 === 2
        ? compactValue.replace(/,/g, '')
        : compactValue.replace(/\./g, '');
  }

  const parsedValue = Number(normalizedValue);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return undefined;
  }

  return Math.round(parsedValue * 100);
}

function readMetaContent({
  html,
  key,
}: {
  html: string;
  key: string;
}): string | undefined {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name|itemprop)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    'i',
  );
  const match = html.match(pattern);

  return match?.[1]?.trim() || undefined;
}

function extractTextContent(html: string) {
  return html
    .replace(/&nbsp;/gi, ' ')
    .replace(htmlTagPattern, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function toAvailabilityFromSchemaValue(
  value: string | undefined,
): PricingAvailability | undefined {
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
    normalizedValue.includes('limitedavailability') ||
    normalizedValue.includes('limited')
  ) {
    return 'limited';
  }

  if (
    normalizedValue.includes('outofstock') ||
    normalizedValue.includes('soldout') ||
    normalizedValue.includes('discontinued')
  ) {
    return 'out_of_stock';
  }

  if (
    normalizedValue.includes('preorder') ||
    normalizedValue.includes('presale')
  ) {
    return 'preorder';
  }

  return 'unknown';
}

function extractAvailabilityFromText(
  html: string,
): PricingAvailability | undefined {
  const textContent = extractTextContent(html);

  if (
    textContent.includes('uitverkocht') ||
    textContent.includes('niet op voorraad') ||
    textContent.includes('momenteel niet beschikbaar') ||
    textContent.includes('temporarily out of stock') ||
    textContent.includes('tijdelijk niet op voorraad') ||
    textContent.includes('currently unavailable') ||
    textContent.includes('out of stock')
  ) {
    return 'out_of_stock';
  }

  if (
    textContent.includes('pre-order') ||
    textContent.includes('preorder') ||
    textContent.includes('verwacht') ||
    textContent.includes('reserveer')
  ) {
    return 'preorder';
  }

  if (
    /only\s+\d+\s+left in stock/.test(textContent) ||
    /nog maar\s+\d+\s+op voorraad/.test(textContent) ||
    textContent.includes('limited stock') ||
    textContent.includes('beperkte voorraad')
  ) {
    return 'limited';
  }

  if (
    textContent.includes('op voorraad') ||
    textContent.includes('in stock') ||
    textContent.includes('direct leverbaar')
  ) {
    return 'in_stock';
  }

  return undefined;
}

function extractPriceFromText(html: string): number | undefined {
  const euroMatch = html.match(
    /(?:€|eur)\s*([0-9]{1,3}(?:[.\s][0-9]{3})*(?:,[0-9]{2})|[0-9]+(?:[.,][0-9]{2})?)/i,
  );

  return parsePriceMinor(euroMatch?.[1]);
}

function getHtmlSlicesAroundMarkers({
  charsAfter,
  charsBefore = 200,
  html,
  markers,
}: {
  charsAfter: number;
  charsBefore?: number;
  html: string;
  markers: readonly string[];
}): string[] {
  const htmlSlices: string[] = [];

  for (const marker of markers) {
    const markerIndex = html.indexOf(marker);

    if (markerIndex < 0) {
      continue;
    }

    htmlSlices.push(
      html.slice(
        Math.max(0, markerIndex - charsBefore),
        Math.min(html.length, markerIndex + charsAfter),
      ),
    );
  }

  return htmlSlices;
}

function safelyParseJson(value: string): unknown {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  try {
    return JSON.parse(trimmedValue);
  } catch {
    return null;
  }
}

interface StructuredDataOfferCandidate {
  availability?: PricingAvailability;
  currencyCode?: string;
  priceMinor?: number;
}

function collectStructuredDataOfferCandidates(
  value: unknown,
  candidates: StructuredDataOfferCandidate[] = [],
): StructuredDataOfferCandidate[] {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectStructuredDataOfferCandidates(entry, candidates);
    }

    return candidates;
  }

  if (!value || typeof value !== 'object') {
    return candidates;
  }

  const record = value as Record<string, unknown>;

  if (record['@graph']) {
    collectStructuredDataOfferCandidates(record['@graph'], candidates);
  }

  if (record.offers) {
    collectStructuredDataOfferCandidates(record.offers, candidates);
  }

  const priceMinor = parsePriceMinor(
    typeof record.price === 'string' || typeof record.price === 'number'
      ? record.price
      : typeof record.lowPrice === 'string' ||
          typeof record.lowPrice === 'number'
        ? record.lowPrice
        : undefined,
  );
  const availability = toAvailabilityFromSchemaValue(
    typeof record.availability === 'string' ? record.availability : undefined,
  );
  const currencyCode =
    typeof record.priceCurrency === 'string'
      ? record.priceCurrency.trim().toUpperCase()
      : undefined;

  if (priceMinor || availability) {
    candidates.push({
      priceMinor,
      availability,
      currencyCode,
    });
  }

  for (const nestedValue of Object.values(record)) {
    if (nestedValue && typeof nestedValue === 'object') {
      collectStructuredDataOfferCandidates(nestedValue, candidates);
    }
  }

  return candidates;
}

function getStructuredDataOfferCandidateScore(
  candidate: StructuredDataOfferCandidate,
) {
  let score = candidate.priceMinor ? 10 : 0;

  if (candidate.availability === 'in_stock') {
    score += 5;
  } else if (candidate.availability === 'limited') {
    score += 4;
  } else if (candidate.availability === 'preorder') {
    score += 2;
  } else if (candidate.availability === 'out_of_stock') {
    score += 1;
  }

  if (normalizeCurrencyCode(candidate.currencyCode) === EURO_CURRENCY_CODE) {
    score += 2;
  }

  return score;
}

function extractGenericCommerceOfferSnapshotFromHtml(
  html: string,
): CommerceOfferSnapshotExtractionResult {
  const structuredDataCandidates: StructuredDataOfferCandidate[] = [];

  for (const match of html.matchAll(structuredDataScriptPattern)) {
    const structuredDataPayload = safelyParseJson(match[1] ?? '');

    if (structuredDataPayload) {
      collectStructuredDataOfferCandidates(
        structuredDataPayload,
        structuredDataCandidates,
      );
    }
  }

  const bestStructuredCandidate = [...structuredDataCandidates].sort(
    (left, right) =>
      getStructuredDataOfferCandidateScore(right) -
        getStructuredDataOfferCandidateScore(left) ||
      (right.priceMinor ?? Number.MAX_SAFE_INTEGER) -
        (left.priceMinor ?? Number.MAX_SAFE_INTEGER),
  )[0];

  if (bestStructuredCandidate) {
    return {
      snapshot: {
        priceMinor: bestStructuredCandidate.priceMinor,
        currencyCode: normalizeCurrencyCode(
          bestStructuredCandidate.currencyCode,
        ),
        availability: bestStructuredCandidate.availability ?? 'unknown',
      },
    };
  }

  const metaPriceMinor =
    parsePriceMinor(readMetaContent({ html, key: 'product:price:amount' })) ??
    parsePriceMinor(readMetaContent({ html, key: 'price' }));
  const metaCurrencyCode =
    readMetaContent({ html, key: 'product:price:currency' }) ??
    readMetaContent({ html, key: 'priceCurrency' });
  const metaAvailability =
    toAvailabilityFromSchemaValue(
      readMetaContent({ html, key: 'product:availability' }),
    ) ?? extractAvailabilityFromText(html);

  if (metaPriceMinor || metaAvailability) {
    return {
      snapshot: {
        priceMinor: metaPriceMinor,
        currencyCode: normalizeCurrencyCode(metaCurrencyCode),
        availability: metaAvailability ?? 'unknown',
      },
    };
  }

  const textPriceMinor = extractPriceFromText(html);
  const textAvailability = extractAvailabilityFromText(html);

  if (textPriceMinor || textAvailability) {
    return {
      snapshot: {
        priceMinor: textPriceMinor,
        currencyCode: EURO_CURRENCY_CODE,
        availability: textAvailability ?? 'unknown',
      },
    };
  }

  return {
    snapshot: null,
  };
}

function extractAmazonPriceFromHtmlSlice(
  htmlSlice: string,
): number | undefined {
  const offscreenPriceMatch = htmlSlice.match(
    /a-offscreen[^>]*>\s*(?:€|eur)\s*([0-9]{1,3}(?:[.\s][0-9]{3})*(?:,[0-9]{2})|[0-9]+(?:[.,][0-9]{2})?)/i,
  );

  if (offscreenPriceMatch?.[1]) {
    return parsePriceMinor(offscreenPriceMatch[1]);
  }

  const splitPriceMatch = htmlSlice.match(
    /a-price-whole[^>]*>\s*([0-9]{1,3}(?:[.\s][0-9]{3})*|[0-9]+)(?:<[^>]+>)*\s*(?:,|\.|<\/span>[\s\S]{0,80}a-price-decimal[^>]*>\s*(?:,|\.))?(?:<[^>]+>)*\s*(?:<\/span>[\s\S]{0,80})?a-price-fraction[^>]*>\s*([0-9]{2})/i,
  );

  if (splitPriceMatch?.[1] && splitPriceMatch?.[2]) {
    return parsePriceMinor(`${splitPriceMatch[1]},${splitPriceMatch[2]}`);
  }

  return extractPriceFromText(htmlSlice);
}

function extractAmazonAvailabilityFromHtmlSlice(
  htmlSlice: string,
): PricingAvailability | undefined {
  const textAvailability = extractAvailabilityFromText(htmlSlice);

  if (textAvailability) {
    return textAvailability;
  }

  const normalizedHtmlSlice = htmlSlice.toLowerCase();

  if (
    normalizedHtmlSlice.includes('add-to-cart-button') ||
    normalizedHtmlSlice.includes('submit.add-to-cart') ||
    normalizedHtmlSlice.includes('buy-now-button') ||
    normalizedHtmlSlice.includes('submit.buy-now')
  ) {
    return 'in_stock';
  }

  return undefined;
}

function extractAmazonCommerceOfferSnapshotFromHtmlDetailed(
  html: string,
): CommerceOfferSnapshotExtractionResult {
  const primaryAvailability = getHtmlSlicesAroundMarkers({
    html,
    markers: amazonPrimaryAvailabilityMarkers,
    charsAfter: 1200,
  })
    .map((htmlSlice) => extractAmazonAvailabilityFromHtmlSlice(htmlSlice))
    .find((availability) => availability !== undefined);
  const primaryActionAvailability = getHtmlSlicesAroundMarkers({
    html,
    markers: amazonPrimaryActionMarkers,
    charsAfter: 900,
    charsBefore: 400,
  })
    .map((htmlSlice) => extractAmazonAvailabilityFromHtmlSlice(htmlSlice))
    .find((availability) => availability !== undefined);
  const primaryPriceMinor = getHtmlSlicesAroundMarkers({
    html,
    markers: amazonPrimaryPriceMarkers,
    charsAfter: 1800,
    charsBefore: 300,
  })
    .map((htmlSlice) => extractAmazonPriceFromHtmlSlice(htmlSlice))
    .find((priceMinor) => typeof priceMinor === 'number');
  const sawMainOfferBlock =
    getHtmlSlicesAroundMarkers({
      html,
      markers: amazonPrimaryAvailabilityMarkers,
      charsAfter: 10,
      charsBefore: 10,
    }).length > 0 ||
    getHtmlSlicesAroundMarkers({
      html,
      markers: amazonPrimaryPriceMarkers,
      charsAfter: 10,
      charsBefore: 10,
    }).length > 0 ||
    getHtmlSlicesAroundMarkers({
      html,
      markers: amazonPrimaryActionMarkers,
      charsAfter: 10,
      charsBefore: 10,
    }).length > 0;
  const normalizedAvailability =
    primaryAvailability ?? primaryActionAvailability;

  if (!sawMainOfferBlock) {
    return {
      snapshot: null,
      reason: 'Amazon page resolved, but no main offer block was found.',
    };
  }

  if (
    typeof primaryPriceMinor !== 'number' &&
    typeof normalizedAvailability === 'undefined'
  ) {
    return {
      snapshot: null,
      reason:
        'Amazon page resolved, but the main offer block did not expose a usable price or stock signal.',
    };
  }

  return {
    snapshot: {
      priceMinor: primaryPriceMinor,
      currencyCode: EURO_CURRENCY_CODE,
      availability: normalizedAvailability ?? 'unknown',
    },
    reason:
      typeof primaryPriceMinor === 'number' ||
      normalizedAvailability === 'out_of_stock' ||
      normalizedAvailability === 'preorder'
        ? undefined
        : 'Amazon page resolved, but no usable main-offer price was found.',
  };
}

function extractCommerceOfferSnapshotFromHtmlDetailed({
  html,
  merchantSlug,
}: {
  html: string;
  merchantSlug?: string;
}): CommerceOfferSnapshotExtractionResult {
  if (merchantSlug === 'amazon-nl') {
    return extractAmazonCommerceOfferSnapshotFromHtmlDetailed(html);
  }

  return extractGenericCommerceOfferSnapshotFromHtml(html);
}

export function extractCommerceOfferSnapshotFromHtml({
  html,
  merchantSlug,
}: {
  html: string;
  merchantSlug?: string;
}): ParsedCommerceOfferSnapshot | null {
  return extractCommerceOfferSnapshotFromHtmlDetailed({
    html,
    merchantSlug,
  }).snapshot;
}

function getMerchantConfigBySlug(merchantSlug: string) {
  return dutchAffiliateMerchantConfigs.find(
    (merchantConfig) => merchantConfig.merchantId === merchantSlug,
  );
}

function toFetchErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown fetch error.';
}

function buildMerchantRequestHeaders({
  merchantSlug,
  productUrl,
  requestProfile,
}: {
  merchantSlug: string;
  productUrl: URL;
  requestProfile: MerchantRequestProfile;
}) {
  const headers: Record<string, string> = {
    accept: browserLikeMerchantAcceptHeader,
    'accept-language': 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7',
    'cache-control': 'no-cache',
    pragma: 'no-cache',
    'upgrade-insecure-requests': '1',
    'user-agent': browserLikeMerchantUserAgent,
  };

  if (merchantSlug === 'intertoys' && requestProfile === 'merchant-home') {
    headers.referer = `${productUrl.origin}/`;
  }

  if (merchantSlug === 'amazon-nl') {
    headers.referer = `${productUrl.origin}/`;
  }

  return headers;
}

async function fetchMerchantPage({
  fetchImpl,
  merchantSlug,
  productUrl,
}: {
  fetchImpl: typeof fetch;
  merchantSlug: string;
  productUrl: URL;
}) {
  const requestProfiles: readonly MerchantRequestProfile[] =
    merchantSlug === 'intertoys'
      ? (['default', 'merchant-home'] as const)
      : (['default'] as const);

  let lastResponse: Response | null = null;
  let lastRequestProfile: MerchantRequestProfile = requestProfiles[0];

  for (const requestProfile of requestProfiles) {
    const response = await fetchImpl(productUrl.toString(), {
      headers: buildMerchantRequestHeaders({
        merchantSlug,
        productUrl,
        requestProfile,
      }),
      redirect: 'follow',
      signal: AbortSignal.timeout(MERCHANT_REQUEST_TIMEOUT_MS),
    });

    lastResponse = response;
    lastRequestProfile = requestProfile;

    if (!(merchantSlug === 'intertoys' && response.status === 403)) {
      return {
        requestProfile,
        response,
      };
    }
  }

  return {
    requestProfile: lastRequestProfile,
    response: lastResponse as Response,
  };
}

function getMerchantHttpErrorMessage({
  merchantSlug,
  productUrl,
  requestProfile,
  response,
}: {
  merchantSlug: string;
  productUrl: URL;
  requestProfile: MerchantRequestProfile;
  response: Response;
}) {
  const redirectedUrl = response.url;
  const redirectMessage =
    response.redirected &&
    redirectedUrl &&
    redirectedUrl !== productUrl.toString()
      ? ` Redirected to ${redirectedUrl}.`
      : '';

  if (merchantSlug === 'intertoys' && response.status === 403) {
    return `Intertoys returned 403 Forbidden${
      requestProfile === 'merchant-home'
        ? ' even after retrying with a merchant referer'
        : ''
    }. The product page blocked the refresh request.${redirectMessage}`;
  }

  return `Merchant returned ${response.status} ${response.statusText}.${redirectMessage}`;
}

function buildSuccessLatestOfferInput({
  availability,
  fetchedAt,
  offerSeedId,
  priceMinor,
}: {
  availability: PricingAvailability;
  fetchedAt: string;
  offerSeedId: string;
  priceMinor?: number;
}): CommerceOfferLatestRecordInput {
  return {
    offerSeedId,
    priceMinor,
    currencyCode: EURO_CURRENCY_CODE,
    availability,
    fetchStatus:
      availability === 'out_of_stock' || availability === 'preorder'
        ? 'unavailable'
        : 'success',
    observedAt: fetchedAt,
    fetchedAt,
  };
}

function buildErrorLatestOfferInput({
  errorMessage,
  fetchedAt,
  offerSeed,
  preservePreviousObservation,
}: {
  errorMessage: string;
  fetchedAt: string;
  offerSeed: CommerceRefreshSeed['offerSeed'];
  preservePreviousObservation: boolean;
}): CommerceOfferLatestRecordInput {
  const previousOffer = offerSeed.latestOffer;

  return {
    offerSeedId: offerSeed.id,
    priceMinor: preservePreviousObservation
      ? previousOffer?.priceMinor
      : undefined,
    currencyCode: preservePreviousObservation
      ? previousOffer?.currencyCode
      : undefined,
    availability: preservePreviousObservation
      ? previousOffer?.availability
      : undefined,
    observedAt: preservePreviousObservation
      ? previousOffer?.observedAt
      : undefined,
    fetchStatus: 'error',
    fetchedAt,
    errorMessage,
  };
}

function getSuspiciousPriceReason({
  availability,
  merchantSlug,
  offerSeed,
  priceMinor,
}: {
  availability: PricingAvailability;
  merchantSlug: string;
  offerSeed: CommerceRefreshSeed['offerSeed'];
  priceMinor?: number;
}): string | undefined {
  if (merchantSlug !== 'amazon-nl' || typeof priceMinor !== 'number') {
    return undefined;
  }

  const referencePriceMinor = referencePriceMinorBySetId.get(offerSeed.setId);
  const previousPriceMinor = offerSeed.latestOffer?.priceMinor;

  if (
    typeof referencePriceMinor === 'number' &&
    priceMinor < Math.round(referencePriceMinor * 0.35)
  ) {
    return `Amazon price ${priceMinor} is implausibly low versus the reference price ${referencePriceMinor}.`;
  }

  if (availability !== 'unknown') {
    return undefined;
  }

  if (
    typeof referencePriceMinor === 'number' &&
    priceMinor < Math.round(referencePriceMinor * 0.7)
  ) {
    return `Amazon price ${priceMinor} is too low to trust while the main offer availability is unknown.`;
  }

  if (
    typeof previousPriceMinor === 'number' &&
    priceMinor < Math.round(previousPriceMinor * 0.7)
  ) {
    return `Amazon price ${priceMinor} is too low to trust versus the previous verified price ${previousPriceMinor}.`;
  }

  return undefined;
}

function getSuccessfulValidationInput(
  nowIsoString: string,
): CommerceOfferSeedValidationUpdateInput {
  return {
    validationStatus: 'valid',
    lastVerifiedAt: nowIsoString,
  };
}

function getInvalidValidationInput(
  nowIsoString: string,
): CommerceOfferSeedValidationUpdateInput {
  return {
    validationStatus: 'invalid',
    lastVerifiedAt: nowIsoString,
  };
}

function getStaleValidationInput({
  nowIsoString,
  offerSeed,
}: {
  nowIsoString: string;
  offerSeed: CommerceRefreshSeed['offerSeed'];
}): CommerceOfferSeedValidationUpdateInput {
  const lastVerifiedAt = offerSeed.lastVerifiedAt;

  if (!lastVerifiedAt) {
    return {
      validationStatus: 'stale',
      lastVerifiedAt: null,
    };
  }

  const lastVerifiedTime = new Date(lastVerifiedAt).getTime();
  const staleThresholdTime =
    new Date(nowIsoString).getTime() -
    DEFAULT_COMMERCE_STALE_DAYS * 24 * 60 * 60 * 1000;

  return {
    validationStatus: 'stale',
    lastVerifiedAt:
      Number.isFinite(lastVerifiedTime) &&
      lastVerifiedTime >= staleThresholdTime
        ? lastVerifiedAt
        : null,
  };
}

async function persistRefreshState({
  latestOfferInput,
  offerSeedId,
  upsertLatestRecord,
  updateSeedValidationState,
  validationInput,
}: {
  latestOfferInput: CommerceOfferLatestRecordInput;
  offerSeedId: string;
  upsertLatestRecord: LatestOfferWriter;
  updateSeedValidationState: SeedValidationWriter;
  validationInput: CommerceOfferSeedValidationUpdateInput;
}) {
  await upsertLatestRecord({
    input: latestOfferInput,
  });
  await updateSeedValidationState({
    offerSeedId,
    input: validationInput,
  });
}

function formatRefreshLogLine({
  availability,
  merchantSlug,
  offerSeedId,
  priceMinor,
  reason,
  setId,
  status,
  validationStatus,
}: {
  availability?: PricingAvailability;
  merchantSlug: string;
  offerSeedId: string;
  priceMinor?: number;
  reason?: string;
  setId: string;
  status: 'success' | 'unavailable' | 'invalid' | 'stale';
  validationStatus: CommerceOfferSeedValidationStatus;
}) {
  const parts = [
    '[commerce-sync] seed',
    `seed_id=${offerSeedId}`,
    `set_id=${setId}`,
    `merchant=${merchantSlug}`,
    `status=${status}`,
    `validation_status=${validationStatus}`,
  ];

  if (typeof priceMinor === 'number') {
    parts.push(`price_minor=${priceMinor}`);
  }

  if (availability) {
    parts.push(`availability=${availability}`);
  }

  if (reason) {
    parts.push(`reason=${JSON.stringify(reason)}`);
  }

  return parts.join(' ');
}

export async function refreshCommerceOfferSeeds({
  fetchImpl = fetch,
  logger = console,
  now,
  refreshSeeds,
  updateSeedValidationState = updateCommerceOfferSeedValidationState,
  upsertLatestRecord = upsertCommerceOfferLatestRecord,
}: {
  fetchImpl?: typeof fetch;
  logger?: CommerceRefreshLogger;
  now?: Date;
  refreshSeeds: readonly CommerceRefreshSeed[];
  updateSeedValidationState?: SeedValidationWriter;
  upsertLatestRecord?: LatestOfferWriter;
}): Promise<CommerceRefreshSummary> {
  const summary: CommerceRefreshSummary = {
    totalCount: refreshSeeds.length,
    successCount: 0,
    unavailableCount: 0,
    invalidCount: 0,
    staleCount: 0,
  };

  for (const refreshSeed of refreshSeeds) {
    const offerSeedId = refreshSeed.offerSeed.id;
    const merchantSlug = refreshSeed.merchant.slug;
    const setId = refreshSeed.offerSeed.setId;
    const fetchedAt = (now ?? new Date()).toISOString();
    const staticMerchantConfig = getMerchantConfigBySlug(merchantSlug);

    try {
      const productUrl = new URL(refreshSeed.offerSeed.productUrl);

      if (
        staticMerchantConfig &&
        productUrl.host !== staticMerchantConfig.urlHost
      ) {
        await persistRefreshState({
          offerSeedId,
          upsertLatestRecord,
          updateSeedValidationState,
          latestOfferInput: buildErrorLatestOfferInput({
            errorMessage: `Seed URL host ${productUrl.host} does not match merchant host ${staticMerchantConfig.urlHost}.`,
            fetchedAt,
            offerSeed: refreshSeed.offerSeed,
            preservePreviousObservation: false,
          }),
          validationInput: getInvalidValidationInput(fetchedAt),
        });
        summary.invalidCount += 1;
        logger.warn?.(
          formatRefreshLogLine({
            offerSeedId,
            merchantSlug,
            reason: `Seed URL host ${productUrl.host} does not match merchant host ${staticMerchantConfig.urlHost}.`,
            setId,
            status: 'invalid',
            validationStatus: 'invalid',
          }),
        );
        continue;
      }

      const { response, requestProfile } = await fetchMerchantPage({
        fetchImpl,
        merchantSlug,
        productUrl,
      });

      if (response.status === 404 || response.status === 410) {
        await persistRefreshState({
          offerSeedId,
          upsertLatestRecord,
          updateSeedValidationState,
          latestOfferInput: buildErrorLatestOfferInput({
            errorMessage: `Merchant returned ${response.status} for the seed URL.`,
            fetchedAt,
            offerSeed: refreshSeed.offerSeed,
            preservePreviousObservation: false,
          }),
          validationInput: getInvalidValidationInput(fetchedAt),
        });
        summary.invalidCount += 1;
        logger.warn?.(
          formatRefreshLogLine({
            offerSeedId,
            merchantSlug,
            reason: `Merchant returned ${response.status} for the seed URL.`,
            setId,
            status: 'invalid',
            validationStatus: 'invalid',
          }),
        );
        continue;
      }

      if (!response.ok) {
        const errorMessage = getMerchantHttpErrorMessage({
          merchantSlug,
          productUrl,
          requestProfile,
          response,
        });

        await persistRefreshState({
          offerSeedId,
          upsertLatestRecord,
          updateSeedValidationState,
          latestOfferInput: buildErrorLatestOfferInput({
            errorMessage,
            fetchedAt,
            offerSeed: refreshSeed.offerSeed,
            preservePreviousObservation: true,
          }),
          validationInput: getStaleValidationInput({
            nowIsoString: fetchedAt,
            offerSeed: refreshSeed.offerSeed,
          }),
        });
        summary.staleCount += 1;
        logger.warn?.(
          formatRefreshLogLine({
            offerSeedId,
            merchantSlug,
            reason: errorMessage,
            setId,
            status: 'stale',
            validationStatus: 'stale',
          }),
        );
        continue;
      }

      const html = await response.text();
      const extractionResult = extractCommerceOfferSnapshotFromHtmlDetailed({
        html,
        merchantSlug,
      });
      const parsedOfferSnapshot = extractionResult.snapshot;

      if (!parsedOfferSnapshot) {
        const errorMessage =
          extractionResult.reason ??
          'Unable to parse a price or a stock signal from the merchant page.';

        await persistRefreshState({
          offerSeedId,
          upsertLatestRecord,
          updateSeedValidationState,
          latestOfferInput: buildErrorLatestOfferInput({
            errorMessage,
            fetchedAt,
            offerSeed: refreshSeed.offerSeed,
            preservePreviousObservation: true,
          }),
          validationInput: getStaleValidationInput({
            nowIsoString: fetchedAt,
            offerSeed: refreshSeed.offerSeed,
          }),
        });
        summary.staleCount += 1;
        logger.warn?.(
          formatRefreshLogLine({
            offerSeedId,
            merchantSlug,
            reason: errorMessage,
            setId,
            status: 'stale',
            validationStatus: 'stale',
          }),
        );
        continue;
      }

      const normalizedAvailability = normalizeAvailability(
        parsedOfferSnapshot.availability,
      );
      const suspiciousPriceReason = getSuspiciousPriceReason({
        availability: normalizedAvailability,
        merchantSlug,
        offerSeed: refreshSeed.offerSeed,
        priceMinor: parsedOfferSnapshot.priceMinor,
      });

      if (
        typeof parsedOfferSnapshot.priceMinor !== 'number' &&
        normalizedAvailability !== 'out_of_stock' &&
        normalizedAvailability !== 'preorder'
      ) {
        const errorMessage =
          extractionResult.reason ??
          'Merchant page resolved, but no usable price was found.';

        await persistRefreshState({
          offerSeedId,
          upsertLatestRecord,
          updateSeedValidationState,
          latestOfferInput: buildErrorLatestOfferInput({
            errorMessage,
            fetchedAt,
            offerSeed: refreshSeed.offerSeed,
            preservePreviousObservation: true,
          }),
          validationInput: getStaleValidationInput({
            nowIsoString: fetchedAt,
            offerSeed: refreshSeed.offerSeed,
          }),
        });
        summary.staleCount += 1;
        logger.warn?.(
          formatRefreshLogLine({
            offerSeedId,
            merchantSlug,
            reason: errorMessage,
            setId,
            status: 'stale',
            validationStatus: 'stale',
          }),
        );
        continue;
      }

      if (suspiciousPriceReason) {
        await persistRefreshState({
          offerSeedId,
          upsertLatestRecord,
          updateSeedValidationState,
          latestOfferInput: buildErrorLatestOfferInput({
            errorMessage: suspiciousPriceReason,
            fetchedAt,
            offerSeed: refreshSeed.offerSeed,
            preservePreviousObservation: true,
          }),
          validationInput: getStaleValidationInput({
            nowIsoString: fetchedAt,
            offerSeed: refreshSeed.offerSeed,
          }),
        });
        summary.staleCount += 1;
        logger.warn?.(
          formatRefreshLogLine({
            offerSeedId,
            merchantSlug,
            reason: suspiciousPriceReason,
            setId,
            status: 'stale',
            validationStatus: 'stale',
          }),
        );
        continue;
      }

      await persistRefreshState({
        offerSeedId,
        upsertLatestRecord,
        updateSeedValidationState,
        latestOfferInput: buildSuccessLatestOfferInput({
          offerSeedId,
          fetchedAt,
          availability: normalizedAvailability,
          priceMinor: parsedOfferSnapshot.priceMinor,
        }),
        validationInput: getSuccessfulValidationInput(fetchedAt),
      });

      if (
        normalizedAvailability === 'out_of_stock' ||
        normalizedAvailability === 'preorder'
      ) {
        summary.unavailableCount += 1;
        logger.info?.(
          formatRefreshLogLine({
            offerSeedId,
            merchantSlug,
            priceMinor: parsedOfferSnapshot.priceMinor,
            availability: normalizedAvailability,
            setId,
            status: 'unavailable',
            validationStatus: 'valid',
          }),
        );
      } else {
        summary.successCount += 1;
        logger.info?.(
          formatRefreshLogLine({
            offerSeedId,
            merchantSlug,
            priceMinor: parsedOfferSnapshot.priceMinor,
            availability: normalizedAvailability,
            setId,
            status: 'success',
            validationStatus: 'valid',
          }),
        );
      }
    } catch (error) {
      const errorMessage = toFetchErrorMessage(error);

      await persistRefreshState({
        offerSeedId,
        upsertLatestRecord,
        updateSeedValidationState,
        latestOfferInput: buildErrorLatestOfferInput({
          errorMessage,
          fetchedAt,
          offerSeed: refreshSeed.offerSeed,
          preservePreviousObservation: true,
        }),
        validationInput: getStaleValidationInput({
          nowIsoString: fetchedAt,
          offerSeed: refreshSeed.offerSeed,
        }),
      });
      summary.staleCount += 1;
      logger.warn?.(
        formatRefreshLogLine({
          offerSeedId,
          merchantSlug,
          reason: errorMessage,
          setId,
          status: 'stale',
          validationStatus: 'stale',
        }),
      );
    }
  }

  return summary;
}

function createFallbackAffiliateMerchantConfig({
  displayRank,
  merchantName,
  merchantSlug,
  urlHost,
}: {
  displayRank: number;
  merchantName: string;
  merchantSlug: string;
  urlHost: string;
}): AffiliateMerchantConfig {
  return {
    merchantId: merchantSlug,
    displayName: merchantName,
    regionCode: DUTCH_REGION_CODE,
    currencyCode: EURO_CURRENCY_CODE,
    enabled: true,
    displayRank,
    urlHost,
    disclosureCopy: 'Direct merchant link.',
    ctaLabel: `Bekijk bij ${merchantName}`,
  };
}

export function buildCommerceSyncInputs({
  refreshSeeds,
}: {
  refreshSeeds: readonly CommerceRefreshSeed[];
}): CommerceSyncInputs {
  const uniqueMerchants = new Map(
    refreshSeeds.map((refreshSeed) => [
      refreshSeed.merchant.slug,
      refreshSeed.merchant,
    ]),
  );
  const hostByMerchantSlug = new Map<string, string>();

  for (const refreshSeed of refreshSeeds) {
    const merchantSlug = refreshSeed.merchant.slug;

    if (!hostByMerchantSlug.has(merchantSlug)) {
      hostByMerchantSlug.set(
        merchantSlug,
        new URL(refreshSeed.offerSeed.productUrl).host,
      );
    }
  }

  let dynamicDisplayRank =
    Math.max(
      0,
      ...dutchAffiliateMerchantConfigs.map(
        (affiliateMerchantConfig) => affiliateMerchantConfig.displayRank,
      ),
    ) + 1;
  const affiliateMerchantConfigs = [...uniqueMerchants.values()]
    .map((merchant) => {
      const staticMerchantConfig = getMerchantConfigBySlug(merchant.slug);

      if (staticMerchantConfig) {
        return {
          ...staticMerchantConfig,
          displayName: merchant.name,
          enabled: true,
        } satisfies AffiliateMerchantConfig;
      }

      return createFallbackAffiliateMerchantConfig({
        merchantSlug: merchant.slug,
        merchantName: merchant.name,
        urlHost: hostByMerchantSlug.get(merchant.slug) ?? '',
        displayRank: dynamicDisplayRank++,
      });
    })
    .sort(
      (left, right) =>
        left.displayRank - right.displayRank ||
        left.displayName.localeCompare(right.displayName),
    );
  const observationSeedByKey = new Map<string, PricingObservationSeed>();

  for (const refreshSeed of refreshSeeds) {
    const latestOffer = refreshSeed.offerSeed.latestOffer;

    if (
      !latestOffer ||
      refreshSeed.offerSeed.validationStatus === 'invalid' ||
      typeof latestOffer.priceMinor !== 'number' ||
      latestOffer.priceMinor <= 0 ||
      normalizeCurrencyCode(latestOffer.currencyCode) !== EURO_CURRENCY_CODE ||
      !latestOffer.observedAt
    ) {
      continue;
    }

    const observationSeed: PricingObservationSeed = {
      setId: refreshSeed.offerSeed.setId,
      merchantId: refreshSeed.merchant.slug,
      merchantProductUrl: refreshSeed.offerSeed.productUrl,
      totalPriceMinor: latestOffer.priceMinor,
      availability: normalizeAvailability(latestOffer.availability),
      observedAt: latestOffer.observedAt,
      regionCode: DUTCH_REGION_CODE,
      currencyCode: EURO_CURRENCY_CODE,
      condition: NEW_OFFER_CONDITION,
    };
    const observationKey = `${observationSeed.setId}:${observationSeed.merchantId}`;
    const previousObservationSeed = observationSeedByKey.get(observationKey);

    if (
      !previousObservationSeed ||
      observationSeed.observedAt > previousObservationSeed.observedAt
    ) {
      observationSeedByKey.set(observationKey, observationSeed);
    }
  }

  const pricingObservationSeeds = [...observationSeedByKey.values()].sort(
    (left, right) =>
      left.setId.localeCompare(right.setId) ||
      left.totalPriceMinor - right.totalPriceMinor ||
      left.merchantId.localeCompare(right.merchantId),
  );
  const enabledSetIds = [
    ...new Set(
      pricingObservationSeeds
        .filter((observationSeed) =>
          isHeadlineEligibleAvailability(observationSeed.availability),
        )
        .map((observationSeed) => observationSeed.setId),
    ),
  ];

  return {
    activeMerchantCount: uniqueMerchants.size,
    affiliateMerchantConfigs,
    enabledSetIds,
    merchantSummaries: affiliateMerchantConfigs.map(
      (affiliateMerchantConfig) => ({
        merchantId: affiliateMerchantConfig.merchantId,
        displayName: affiliateMerchantConfig.displayName,
      }),
    ),
    pricingObservationSeeds,
  };
}

export async function loadCommerceSyncInputs() {
  const refreshSeeds = await listActiveCommerceRefreshSeeds();

  return {
    refreshSeeds,
    syncInputs: buildCommerceSyncInputs({
      refreshSeeds,
    }),
  };
}
