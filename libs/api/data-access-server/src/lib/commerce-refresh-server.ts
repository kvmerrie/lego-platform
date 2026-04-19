import { dutchAffiliateMerchantConfigs } from '@lego-platform/affiliate/data-access-server';
import {
  normalizeAffiliateUrlHost,
  type AffiliateMerchantConfig,
} from '@lego-platform/affiliate/util';
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
const TOP1TOYS_REQUEST_TIMEOUT_MS = 30000;
const browserLikeMerchantUserAgent =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';
const browserLikeMerchantAcceptHeader =
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8';
const structuredDataScriptPattern =
  /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
const htmlTagPattern = /<[^>]+>/g;
const euroPriceTextPattern =
  /(?:€|eur)\s*((?:[0-9]{1,3}(?:[.\s][0-9]{3})+)(?:,\d{2}|,-)?|[0-9]+\.\d{1,2}|[0-9]+(?:,\d{2}|,-)?)/i;
const amazonPrimaryAvailabilityMarkers = [
  'availabilityInsideBuyBox_feature_div',
  'availability_feature_div',
  'id="availability"',
  "id='availability'",
  'id="outOfStock"',
  "id='outOfStock'",
] as const;
const amazonPrimaryContainerMarkers = [
  'desktop_qualifiedBuyBox',
  'buyBoxAccordion',
  'newAccordionRow_0',
] as const;
const amazonPrimaryPriceMarkers = [
  'corePriceDisplay_desktop_feature_div',
  'corePriceDisplay_mobile_feature_div',
  'corePrice_feature_div',
  'apex_desktop',
  'apex-price-to-pay-value',
  'apex_offerDisplay_desktop',
  'apex_offerDisplay_mobile',
  'priceblock_ourprice',
  'priceblock_dealprice',
  'priceblock_saleprice',
  'priceToPay',
  'tp_price_block_total_price_ww',
] as const;
const amazonPrimaryActionMarkers = [
  'id="add-to-cart-button"',
  "id='add-to-cart-button'",
  'id="add-to-cart-button-ubb"',
  "id='add-to-cart-button-ubb'",
  'id="submit.add-to-cart"',
  "id='submit.add-to-cart'",
  'id="submit.add-to-cart-ubb"',
  "id='submit.add-to-cart-ubb'",
  'id="buy-now-button"',
  "id='buy-now-button'",
  'id="submit.buy-now"',
  "id='submit.buy-now'",
] as const;
const bolMainOfferMarkers = [
  'Prijsinformatie en bestellen',
  'price information and ordering',
  'In winkelwagen',
  'Niet leverbaar',
  'Stuur mij een bericht',
  'Verkoop door bol',
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

export interface CommerceSyncInputFilters {
  merchantSlugs?: readonly string[];
  setIds?: readonly string[];
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
type MerchantRequestProfile = 'default' | 'merchant-home' | 'retry';

function normalizeMerchantProductUrlForFetch({
  merchantSlug,
  productUrl,
}: {
  merchantSlug: string;
  productUrl: URL;
}) {
  if (merchantSlug !== 'proshop') {
    return productUrl;
  }

  if (productUrl.hostname === 'proshop.nl') {
    const normalizedUrl = new URL(productUrl.toString());
    normalizedUrl.hostname = 'www.proshop.nl';
    return normalizedUrl;
  }

  return productUrl;
}

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
    .replace(/\u00a0/g, ' ')
    .replace(/,\s*-\s*$/u, ',00')
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=.*\.)/g, '.');

  if (
    !compactValue ||
    compactValue === '-' ||
    compactValue === ',' ||
    compactValue === '.'
  ) {
    return undefined;
  }

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
      compactValue.length - lastCommaIndex - 1 >= 1 &&
      compactValue.length - lastCommaIndex - 1 <= 2
        ? compactValue.replace(/\./g, '').replace(',', '.')
        : compactValue.replace(/,/g, '');
  } else if (lastDotIndex >= 0) {
    normalizedValue =
      compactValue.length - lastDotIndex - 1 >= 1 &&
      compactValue.length - lastDotIndex - 1 <= 2
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
    /nog slechts\s+\d+\s+op voorraad/.test(textContent) ||
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
  const euroMatch = html.match(euroPriceTextPattern);

  return parsePriceMinor(euroMatch?.[1]);
}

function parseNumericPriceAmountMinor(
  value: string | undefined,
): number | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();

  if (!/^\d+(?:\.\d+)?$/.test(trimmedValue)) {
    return undefined;
  }

  const parsedValue = Number(trimmedValue);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return undefined;
  }

  return Math.round(parsedValue * 100);
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
    let searchStartIndex = 0;

    while (searchStartIndex < html.length) {
      const markerIndex = html.indexOf(marker, searchStartIndex);

      if (markerIndex < 0) {
        break;
      }

      htmlSlices.push(
        html.slice(
          Math.max(0, markerIndex - charsBefore),
          Math.min(html.length, markerIndex + charsAfter),
        ),
      );
      searchStartIndex = markerIndex + marker.length;
    }
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

function getBestStructuredDataOfferCandidate(html: string) {
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

  return [...structuredDataCandidates].sort(
    (left, right) =>
      getStructuredDataOfferCandidateScore(right) -
        getStructuredDataOfferCandidateScore(left) ||
      (right.priceMinor ?? Number.MAX_SAFE_INTEGER) -
        (left.priceMinor ?? Number.MAX_SAFE_INTEGER),
  )[0];
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
  const bestStructuredCandidate = getBestStructuredDataOfferCandidate(html);

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
  const customerVisibleAmountMatch = htmlSlice.match(
    /customerVisiblePrice\]\[amount\][^>]*value=["']([0-9]+(?:\.[0-9]+)?)["']/i,
  );

  if (customerVisibleAmountMatch?.[1]) {
    const customerVisibleAmountMinor = parseNumericPriceAmountMinor(
      customerVisibleAmountMatch[1],
    );

    if (typeof customerVisibleAmountMinor === 'number') {
      return customerVisibleAmountMinor;
    }
  }

  const customerVisibleDisplayStringMatch = htmlSlice.match(
    /customerVisiblePrice\]\[displayString\][^>]*value=["']([^"']+)["']/i,
  );

  if (customerVisibleDisplayStringMatch?.[1]) {
    const customerVisibleDisplayMinor = parsePriceMinor(
      customerVisibleDisplayStringMatch[1],
    );

    if (typeof customerVisibleDisplayMinor === 'number') {
      return customerVisibleDisplayMinor;
    }
  }

  const twisterPriceMatch = htmlSlice.match(
    /id=["']twister-plus-price-data-price["'][^>]*value=["']([0-9]+(?:\.[0-9]+)?)["']/i,
  );

  if (twisterPriceMatch?.[1]) {
    const twisterPriceMinor =
      parseNumericPriceAmountMinor(twisterPriceMatch[1]) ??
      parsePriceMinor(twisterPriceMatch[1]);

    if (typeof twisterPriceMinor === 'number') {
      return twisterPriceMinor;
    }
  }

  const offscreenPriceMatch = htmlSlice.match(
    /a-offscreen[^>]*>\s*((?:€|eur)\s*(?:[0-9]{1,3}(?:[.\s][0-9]{3})+)(?:,\d{2}|,-)?|(?:€|eur)\s*[0-9]+\.\d{1,2}|(?:€|eur)\s*[0-9]+(?:,\d{2}|,-)?)/i,
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

function extractBolPriceFromHtmlSlice(htmlSlice: string): number | undefined {
  const collapsedEuroPriceMatch = htmlSlice.match(
    /(?:€|eur)\s*([0-9]{1,3}(?:[.\s][0-9]{3})+)(\d{2})(?!\d)/i,
  );

  if (collapsedEuroPriceMatch?.[1] && collapsedEuroPriceMatch?.[2]) {
    const collapsedEuroPriceMinor = parsePriceMinor(
      `${collapsedEuroPriceMatch[1]},${collapsedEuroPriceMatch[2]}`,
    );

    if (typeof collapsedEuroPriceMinor === 'number') {
      return collapsedEuroPriceMinor;
    }
  }

  const narratedEuroCentMatch = htmlSlice.match(
    /de prijs van dit product is[\s\S]{0,240}?([0-9]{1,3}(?:[.\s][0-9]{3})+|[0-9]+)\s*euro\s*en\s*([0-9]{2})\s*cent/i,
  );

  if (narratedEuroCentMatch?.[1] && narratedEuroCentMatch?.[2]) {
    const narratedPriceMinor = parsePriceMinor(
      `${narratedEuroCentMatch[1]},${narratedEuroCentMatch[2]}`,
    );

    if (typeof narratedPriceMinor === 'number') {
      return narratedPriceMinor;
    }
  }

  const bolNarratedPriceBlock = htmlSlice.match(
    /de prijs van dit product is[\s\S]{0,200}/i,
  )?.[0];

  if (bolNarratedPriceBlock) {
    const priceCandidates = [
      ...bolNarratedPriceBlock.matchAll(
        /(?:€|eur)\s*((?:[0-9]{1,3}(?:[.\s][0-9]{3})+|[0-9]+)(?:,\d{2}|,-))/gi,
      ),
    ]
      .map((match) => parsePriceMinor(match[1]))
      .filter(
        (priceMinor): priceMinor is number => typeof priceMinor === 'number',
      );

    if (priceCandidates.length > 0) {
      return Math.max(...priceCandidates);
    }

    const collapsedNarratedPriceCandidates = [
      ...bolNarratedPriceBlock.matchAll(
        /([0-9]{1,3}(?:[.\s][0-9]{3})+)(\d{2})(?!\d)/g,
      ),
    ]
      .map((match) => parsePriceMinor(`${match[1]},${match[2]}`))
      .filter(
        (priceMinor): priceMinor is number => typeof priceMinor === 'number',
      );

    if (collapsedNarratedPriceCandidates.length > 0) {
      return Math.max(...collapsedNarratedPriceCandidates);
    }
  }

  return extractPriceFromText(htmlSlice);
}

function extractBolStructuredDataPriceFromHtml(
  html: string,
): number | undefined {
  const bestStructuredCandidate = getBestStructuredDataOfferCandidate(html);

  if (
    typeof bestStructuredCandidate?.priceMinor === 'number' &&
    normalizeCurrencyCode(bestStructuredCandidate.currencyCode) ===
      EURO_CURRENCY_CODE
  ) {
    return bestStructuredCandidate.priceMinor;
  }

  return undefined;
}

function getStructuredDataOfferCandidateForEuro(
  html: string,
): StructuredDataOfferCandidate | undefined {
  const candidate = getBestStructuredDataOfferCandidate(html);

  if (!candidate) {
    return undefined;
  }

  if (normalizeCurrencyCode(candidate.currencyCode) !== EURO_CURRENCY_CODE) {
    return undefined;
  }

  return candidate;
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
    normalizedHtmlSlice.includes('wordt gewoonlijk verzonden binnen') ||
    normalizedHtmlSlice.includes('meestal verzonden binnen') ||
    normalizedHtmlSlice.includes('usually dispatched within') ||
    normalizedHtmlSlice.includes('ontvang het') ||
    normalizedHtmlSlice.includes('je hebt het al in huis op')
  ) {
    return 'in_stock';
  }

  if (
    (normalizedHtmlSlice.includes('geen aanbevolen aanbod beschikbaar') ||
      normalizedHtmlSlice.includes('no featured offers available')) &&
    (normalizedHtmlSlice.includes('alle koopopties bekijken') ||
      normalizedHtmlSlice.includes('buybox-see-all-buying-choices') ||
      normalizedHtmlSlice.includes('all-offers-display'))
  ) {
    return 'limited';
  }

  if (
    normalizedHtmlSlice.includes('id="add-to-cart-button"') ||
    normalizedHtmlSlice.includes("id='add-to-cart-button'") ||
    normalizedHtmlSlice.includes('id="add-to-cart-button-ubb"') ||
    normalizedHtmlSlice.includes("id='add-to-cart-button-ubb'") ||
    normalizedHtmlSlice.includes('id="submit.add-to-cart"') ||
    normalizedHtmlSlice.includes("id='submit.add-to-cart'") ||
    normalizedHtmlSlice.includes('id="submit.add-to-cart-ubb"') ||
    normalizedHtmlSlice.includes("id='submit.add-to-cart-ubb'") ||
    normalizedHtmlSlice.includes('id="buy-now-button"') ||
    normalizedHtmlSlice.includes("id='buy-now-button'") ||
    normalizedHtmlSlice.includes('id="submit.buy-now"') ||
    normalizedHtmlSlice.includes("id='submit.buy-now'")
  ) {
    return 'in_stock';
  }

  return undefined;
}

function extractAmazonCommerceOfferSnapshotFromHtmlDetailed(
  html: string,
): CommerceOfferSnapshotExtractionResult {
  const structuredDataCandidate = getStructuredDataOfferCandidateForEuro(html);
  const mainOfferContainerSlices = getHtmlSlicesAroundMarkers({
    html,
    markers: amazonPrimaryContainerMarkers,
    charsAfter: 2600,
    charsBefore: 500,
  });
  const mainOfferActionSlices = getHtmlSlicesAroundMarkers({
    html,
    markers: amazonPrimaryActionMarkers,
    charsAfter: 1200,
    charsBefore: 500,
  });
  const mainOfferAvailabilitySlices = getHtmlSlicesAroundMarkers({
    html,
    markers: amazonPrimaryAvailabilityMarkers,
    charsAfter: 1400,
    charsBefore: 300,
  });
  const mainOfferPriceSlices = getHtmlSlicesAroundMarkers({
    html,
    markers: amazonPrimaryPriceMarkers,
    charsAfter: 2200,
    charsBefore: 500,
  });
  const primaryAvailability = [
    ...mainOfferAvailabilitySlices,
    ...mainOfferActionSlices,
    ...mainOfferContainerSlices,
  ]
    .map((htmlSlice) => extractAmazonAvailabilityFromHtmlSlice(htmlSlice))
    .find((availability) => availability !== undefined);
  const primaryPriceMinor = [
    ...mainOfferPriceSlices,
    ...mainOfferContainerSlices,
  ]
    .map((htmlSlice) => extractAmazonPriceFromHtmlSlice(htmlSlice))
    .find((priceMinor) => typeof priceMinor === 'number');
  const structuredAvailability = normalizeAvailability(
    structuredDataCandidate?.availability,
  );
  const structuredPriceMinor = structuredDataCandidate?.priceMinor;
  const sawMainOfferBlock =
    mainOfferContainerSlices.length > 0 ||
    mainOfferAvailabilitySlices.length > 0 ||
    mainOfferActionSlices.length > 0 ||
    mainOfferPriceSlices.length > 0;
  const normalizedAvailability = primaryAvailability;

  if (!sawMainOfferBlock) {
    return {
      snapshot: null,
      reason: 'Amazon page resolved, but no main offer block was found.',
    };
  }

  if (
    typeof primaryPriceMinor !== 'number' &&
    typeof normalizedAvailability === 'undefined' &&
    typeof structuredPriceMinor !== 'number' &&
    structuredAvailability === 'unknown'
  ) {
    return {
      snapshot: null,
      reason:
        'Amazon page resolved, but the main offer block did not expose a usable price or stock signal.',
    };
  }

  if (
    typeof primaryPriceMinor !== 'number' &&
    typeof structuredPriceMinor === 'number'
  ) {
    if (
      normalizedAvailability === 'out_of_stock' ||
      normalizedAvailability === 'preorder'
    ) {
      return {
        snapshot: {
          availability: normalizedAvailability,
          currencyCode: EURO_CURRENCY_CODE,
        },
      };
    }

    return {
      snapshot: {
        priceMinor: structuredPriceMinor,
        currencyCode: EURO_CURRENCY_CODE,
        availability:
          normalizedAvailability ??
          (structuredAvailability === 'unknown'
            ? 'unknown'
            : structuredAvailability),
      },
      reason:
        normalizedAvailability === undefined &&
        structuredAvailability === 'unknown'
          ? 'Amazon page resolved, but the main offer price came from structured data while availability stayed ambiguous.'
          : undefined,
    };
  }

  if (typeof primaryPriceMinor !== 'number') {
    return {
      snapshot: {
        availability: normalizedAvailability ?? 'unknown',
        currencyCode: EURO_CURRENCY_CODE,
      },
      reason:
        'Amazon page resolved, but the main offer block was found without a usable main-offer price.',
    };
  }

  return {
    snapshot: {
      priceMinor: primaryPriceMinor,
      currencyCode: EURO_CURRENCY_CODE,
      availability: normalizedAvailability ?? 'unknown',
    },
    reason:
      normalizedAvailability === 'out_of_stock' ||
      normalizedAvailability === 'preorder'
        ? undefined
        : normalizedAvailability === 'unknown'
          ? 'Amazon page resolved, but main offer availability remained ambiguous.'
          : undefined,
  };
}

function extractBolMainOfferSlice(html: string) {
  const primarySlice = getHtmlSlicesAroundMarkers({
    html,
    markers: ['Prijsinformatie en bestellen'],
    charsBefore: 200,
    charsAfter: 1800,
  })[0];

  if (primarySlice) {
    return primarySlice;
  }

  return getHtmlSlicesAroundMarkers({
    html,
    markers: bolMainOfferMarkers,
    charsBefore: 300,
    charsAfter: 1600,
  }).find((htmlSlice) => {
    const normalizedSlice = extractTextContent(htmlSlice);

    return (
      normalizedSlice.includes('in winkelwagen') ||
      normalizedSlice.includes('niet leverbaar') ||
      normalizedSlice.includes('verkoop door bol') ||
      normalizedSlice.includes('stuur mij een bericht')
    );
  });
}

function extractBolCommerceOfferSnapshotFromHtmlDetailed(
  html: string,
): CommerceOfferSnapshotExtractionResult {
  const mainOfferSlice = extractBolMainOfferSlice(html);
  const structuredDataCandidate = getStructuredDataOfferCandidateForEuro(html);

  if (!mainOfferSlice) {
    return {
      snapshot: null,
      reason:
        'bol page resolved, but no trustworthy bol main-offer block was found.',
    };
  }

  const normalizedMainOfferText = extractTextContent(mainOfferSlice);
  const pageText = extractTextContent(html);
  const structuredDataPriceMinor =
    structuredDataCandidate?.priceMinor ??
    extractBolStructuredDataPriceFromHtml(html);
  const structuredAvailability = normalizeAvailability(
    structuredDataCandidate?.availability,
  );
  const slicePriceMinor = extractBolPriceFromHtmlSlice(mainOfferSlice);
  const priceMinor =
    typeof structuredDataPriceMinor === 'number'
      ? structuredDataPriceMinor
      : slicePriceMinor;
  const textualAvailability = extractAvailabilityFromText(mainOfferSlice);
  const hasBuyBoxSignal =
    normalizedMainOfferText.includes('in winkelwagen') ||
    normalizedMainOfferText.includes('verkoop door bol') ||
    normalizedMainOfferText.includes('verstuurd door bol');
  const hasDeliverySignal =
    normalizedMainOfferText.includes('morgen in huis') ||
    normalizedMainOfferText.includes('voor 23:00 uur besteld') ||
    normalizedMainOfferText.includes('voor 23.00 uur besteld');
  const hasExplicitUnavailableSignal =
    normalizedMainOfferText.includes('niet leverbaar') &&
    normalizedMainOfferText.includes('stuur mij een bericht');
  const hasExplicitStockSignal =
    textualAvailability === 'in_stock' ||
    textualAvailability === 'limited' ||
    hasBuyBoxSignal ||
    hasDeliverySignal;
  const hasPageWideBuySignal =
    pageText.includes('in winkelwagen') ||
    pageText.includes('verkoop door bol') ||
    pageText.includes('verstuurd door bol');
  const hasStructuredStockSignal =
    structuredAvailability === 'in_stock' ||
    structuredAvailability === 'limited';
  const hasStructuredUnavailableSignal =
    structuredAvailability === 'out_of_stock' ||
    structuredAvailability === 'preorder';

  if (hasExplicitUnavailableSignal && !hasExplicitStockSignal) {
    return {
      snapshot: {
        availability: 'out_of_stock',
        currencyCode: EURO_CURRENCY_CODE,
      },
    };
  }

  if (
    hasExplicitStockSignal ||
    (typeof priceMinor === 'number' &&
      hasStructuredStockSignal &&
      hasPageWideBuySignal)
  ) {
    if (typeof priceMinor === 'number') {
      return {
        snapshot: {
          availability:
            textualAvailability === 'limited' ? 'limited' : 'in_stock',
          currencyCode: EURO_CURRENCY_CODE,
          priceMinor,
        },
      };
    }

    return {
      snapshot: {
        availability:
          textualAvailability === 'limited' ? 'limited' : 'in_stock',
        currencyCode: EURO_CURRENCY_CODE,
      },
      reason:
        typeof slicePriceMinor === 'number'
          ? 'bol page resolved, but the bol main-offer price fragment was incomplete.'
          : 'bol page resolved, but no trustworthy bol main-offer price was found.',
    };
  }

  if (
    hasStructuredUnavailableSignal &&
    !hasPageWideBuySignal &&
    !hasExplicitStockSignal
  ) {
    return {
      snapshot: {
        availability:
          structuredAvailability === 'preorder' ? 'preorder' : 'out_of_stock',
        currencyCode: EURO_CURRENCY_CODE,
        priceMinor,
      },
    };
  }

  return {
    snapshot: null,
    reason:
      typeof priceMinor === 'number'
        ? 'bol page resolved, but main offer state was ambiguous.'
        : 'bol page resolved, but no trustworthy bol main-offer availability signal was found.',
  };
}

function extractLegoCommerceOfferSnapshotFromHtmlDetailed(
  html: string,
): CommerceOfferSnapshotExtractionResult {
  const extractionResult = extractGenericCommerceOfferSnapshotFromHtml(html);
  const snapshot = extractionResult.snapshot;

  if (!snapshot) {
    return extractionResult;
  }

  if (snapshot.availability === 'unknown') {
    return {
      snapshot: null,
      reason:
        'LEGO page resolved, but no trustworthy stock signal was found alongside the price.',
    };
  }

  return extractionResult;
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

  if (merchantSlug === 'bol') {
    return extractBolCommerceOfferSnapshotFromHtmlDetailed(html);
  }

  if (merchantSlug === 'lego-nl') {
    return extractLegoCommerceOfferSnapshotFromHtmlDetailed(html);
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

  if (
    (merchantSlug === 'intertoys' || merchantSlug === 'proshop') &&
    requestProfile === 'merchant-home'
  ) {
    headers.referer =
      merchantSlug === 'proshop'
        ? 'https://www.proshop.nl/'
        : `${productUrl.origin}/`;
  }

  if (merchantSlug === 'amazon-nl') {
    headers.referer = `${productUrl.origin}/`;
  }

  if (merchantSlug === 'proshop') {
    headers['sec-ch-ua'] =
      '"Google Chrome";v="135", "Chromium";v="135", "Not:A-Brand";v="8"';
    headers['sec-ch-ua-mobile'] = '?0';
    headers['sec-ch-ua-platform'] = '"macOS"';
    headers['sec-fetch-dest'] = 'document';
    headers['sec-fetch-mode'] = 'navigate';
    headers['sec-fetch-site'] = 'same-origin';
    headers['sec-fetch-user'] = '?1';
  }

  return headers;
}

function getMerchantRequestTimeoutMs(merchantSlug: string): number {
  return merchantSlug === 'top1toys'
    ? TOP1TOYS_REQUEST_TIMEOUT_MS
    : MERCHANT_REQUEST_TIMEOUT_MS;
}

function shouldRetryAfterTimeout({
  attempt,
  error,
  merchantSlug,
}: {
  attempt: number;
  error: unknown;
  merchantSlug: string;
}) {
  if (merchantSlug !== 'top1toys' || attempt > 0) {
    return false;
  }

  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  );
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
    merchantSlug === 'intertoys' || merchantSlug === 'proshop'
      ? (['default', 'merchant-home'] as const)
      : merchantSlug === 'top1toys'
        ? (['default', 'retry'] as const)
        : (['default'] as const);
  const lastRetryableProfile = requestProfiles.at(-1) ?? requestProfiles[0];

  let lastResponse: Response | null = null;
  let lastRequestProfile: MerchantRequestProfile = requestProfiles[0];
  let activeProductUrl = normalizeMerchantProductUrlForFetch({
    merchantSlug,
    productUrl,
  });

  for (const requestProfile of requestProfiles) {
    let response: Response | null = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        response = await fetchImpl(activeProductUrl.toString(), {
          headers: buildMerchantRequestHeaders({
            merchantSlug,
            productUrl: activeProductUrl,
            requestProfile,
          }),
          redirect: 'follow',
          signal: AbortSignal.timeout(
            getMerchantRequestTimeoutMs(merchantSlug),
          ),
        });
        break;
      } catch (error) {
        if (!shouldRetryAfterTimeout({ attempt, error, merchantSlug })) {
          throw error;
        }
      }
    }

    lastResponse = response as Response;
    lastRequestProfile = requestProfile;

    if (
      merchantSlug === 'proshop' &&
      response?.status === 403 &&
      response.redirected &&
      response.url &&
      response.url !== activeProductUrl.toString()
    ) {
      activeProductUrl = normalizeMerchantProductUrlForFetch({
        merchantSlug,
        productUrl: new URL(response.url),
      });
    }

    if (
      response?.status === 403 &&
      (merchantSlug === 'intertoys' || merchantSlug === 'proshop') &&
      requestProfile !== lastRetryableProfile
    ) {
      continue;
    }

    return {
      productUrl: activeProductUrl,
      requestProfile,
      response: response as Response,
    };
  }

  return {
    productUrl: activeProductUrl,
    requestProfile: lastRequestProfile,
    response: lastResponse as Response,
  };
}

function isCloudflareChallengeResponse(response: Response) {
  return response.headers.get('cf-mitigated') === 'challenge';
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

  if (
    merchantSlug === 'proshop' &&
    response.status === 403 &&
    isCloudflareChallengeResponse(response)
  ) {
    return `Proshop returned a Cloudflare challenge${
      requestProfile === 'merchant-home'
        ? ' even after retrying with the canonical www referer'
        : ''
    }. The lightweight refresh request did not receive a parseable product page.${redirectMessage}`;
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
  if (typeof priceMinor !== 'number') {
    return undefined;
  }

  const referencePriceMinor = referencePriceMinorBySetId.get(offerSeed.setId);
  const previousPriceMinor = offerSeed.latestOffer?.priceMinor;
  const merchantLabel = merchantSlug === 'bol' ? 'bol' : 'Amazon';

  if (
    merchantSlug === 'bol' &&
    typeof referencePriceMinor === 'number' &&
    priceMinor < Math.round(referencePriceMinor * 0.2)
  ) {
    return `${merchantLabel} price ${priceMinor} looks like a malformed or partial price parse versus the reference price ${referencePriceMinor}.`;
  }

  if (
    merchantSlug === 'bol' &&
    typeof previousPriceMinor === 'number' &&
    priceMinor < Math.round(previousPriceMinor * 0.2)
  ) {
    return `${merchantLabel} price ${priceMinor} looks like a malformed or partial price parse versus the previous verified price ${previousPriceMinor}.`;
  }

  if (merchantSlug !== 'amazon-nl' && merchantSlug !== 'bol') {
    return undefined;
  }

  if (
    typeof referencePriceMinor === 'number' &&
    priceMinor < Math.round(referencePriceMinor * 0.1)
  ) {
    return `${merchantLabel} price ${priceMinor} looks like a malformed or partial price parse versus the reference price ${referencePriceMinor}.`;
  }

  if (
    typeof previousPriceMinor === 'number' &&
    priceMinor < Math.round(previousPriceMinor * 0.1)
  ) {
    return `${merchantLabel} price ${priceMinor} looks like a malformed or partial price parse versus the previous verified price ${previousPriceMinor}.`;
  }

  if (
    typeof referencePriceMinor === 'number' &&
    priceMinor < Math.round(referencePriceMinor * 0.5)
  ) {
    return `${merchantLabel} price ${priceMinor} is implausibly low versus the reference price ${referencePriceMinor}.`;
  }

  if (
    typeof previousPriceMinor === 'number' &&
    priceMinor < Math.round(previousPriceMinor * 0.5)
  ) {
    return `${merchantLabel} price ${priceMinor} is implausibly low versus the previous verified price ${previousPriceMinor}.`;
  }

  if (merchantSlug === 'bol' || availability !== 'unknown') {
    return undefined;
  }

  if (
    typeof referencePriceMinor === 'number' &&
    priceMinor < Math.round(referencePriceMinor * 0.7)
  ) {
    return `${merchantLabel} price ${priceMinor} is too low to trust while the main offer availability is unknown.`;
  }

  if (
    typeof previousPriceMinor === 'number' &&
    priceMinor < Math.round(previousPriceMinor * 0.7)
  ) {
    return `${merchantLabel} price ${priceMinor} is too low to trust versus the previous verified price ${previousPriceMinor}.`;
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
        normalizeAffiliateUrlHost(productUrl.host) !==
          normalizeAffiliateUrlHost(staticMerchantConfig.urlHost)
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

      const {
        productUrl: resolvedProductUrl,
        response,
        requestProfile,
      } = await fetchMerchantPage({
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
          productUrl: resolvedProductUrl,
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
        normalizeAffiliateUrlHost(
          new URL(refreshSeed.offerSeed.productUrl).host,
        ),
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

function filterCommerceRefreshSeeds({
  filters,
  refreshSeeds,
}: {
  filters?: CommerceSyncInputFilters;
  refreshSeeds: readonly CommerceRefreshSeed[];
}) {
  const requestedSetIds = new Set(
    (filters?.setIds ?? []).map((setId) => setId.trim()).filter(Boolean),
  );
  const requestedMerchantSlugs = new Set(
    (filters?.merchantSlugs ?? [])
      .map((merchantSlug) => merchantSlug.trim())
      .filter(Boolean),
  );

  if (requestedSetIds.size === 0 && requestedMerchantSlugs.size === 0) {
    return [...refreshSeeds];
  }

  return refreshSeeds.filter((refreshSeed) => {
    if (
      requestedSetIds.size > 0 &&
      !requestedSetIds.has(refreshSeed.offerSeed.setId)
    ) {
      return false;
    }

    if (
      requestedMerchantSlugs.size > 0 &&
      !requestedMerchantSlugs.has(refreshSeed.merchant.slug)
    ) {
      return false;
    }

    return true;
  });
}

export async function loadCommerceSyncInputs({
  listActiveCommerceRefreshSeedsFn = listActiveCommerceRefreshSeeds,
  merchantSlugs,
  setIds,
}: CommerceSyncInputFilters & {
  listActiveCommerceRefreshSeedsFn?: typeof listActiveCommerceRefreshSeeds;
} = {}) {
  const refreshSeeds = filterCommerceRefreshSeeds({
    filters: {
      merchantSlugs,
      setIds,
    },
    refreshSeeds: await listActiveCommerceRefreshSeedsFn(),
  });

  return {
    refreshSeeds,
    syncInputs: buildCommerceSyncInputs({
      refreshSeeds,
    }),
  };
}

export async function refreshCommerceSetOfferSeeds({
  fetchImpl = fetch,
  logger = console,
  now,
  setId,
}: {
  fetchImpl?: typeof fetch;
  logger?: CommerceRefreshLogger;
  now?: Date;
  setId: string;
}): Promise<CommerceRefreshSummary> {
  const refreshSeeds = (await listActiveCommerceRefreshSeeds()).filter(
    (refreshSeed) => refreshSeed.offerSeed.setId === setId,
  );

  if (refreshSeeds.length === 0) {
    throw new Error(
      `Set ${setId} heeft nog geen actieve seeds om opnieuw te checken.`,
    );
  }

  return refreshCommerceOfferSeeds({
    fetchImpl,
    logger,
    now,
    refreshSeeds,
  });
}
