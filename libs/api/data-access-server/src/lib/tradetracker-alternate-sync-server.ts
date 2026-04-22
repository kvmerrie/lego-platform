import {
  getTradeTrackerAffiliateConfig,
  type TradeTrackerAffiliateConfig,
} from '@lego-platform/shared/config';
import {
  importAlternateAffiliateFeedRows,
  type AlternateAffiliateFeedImportResult,
  type AlternateAffiliateFeedImportOptions,
  type AlternateAffiliateFeedRow,
  type AlternateAffiliateFeedUnmatchedSetSummary,
} from './alternate-affiliate-feed-server';
import { XMLParser } from 'fast-xml-parser';

const TRADETRACKER_WSI_SOAP_NAMESPACE =
  'https://ws.tradetracker.com/soap-literal-wsi/affiliate';
const TRADETRACKER_WSI_SOAP_ENDPOINT = TRADETRACKER_WSI_SOAP_NAMESPACE;
const TRADETRACKER_LOCALE = 'nl_NL';
const TRADETRACKER_PAGE_SIZE = 250;
const SOAP_12_CONTENT_TYPE = 'application/soap+xml; charset=utf-8';

const tradeTrackerSoapParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseTagValue: false,
  removeNSPrefix: true,
  textNodeName: '#text',
  trimValues: true,
});

type TradeTrackerSoapOperation =
  | 'authenticate'
  | 'getAffiliateSites'
  | 'getFeeds'
  | 'getFeedProducts';

interface TradeTrackerAffiliateSite {
  id: number;
  name: string;
  url?: string;
}

interface TradeTrackerFeed {
  assignmentStatus?: string;
  campaignId: number;
  campaignName: string;
  id: number;
  name: string;
  productCount: number;
  url?: string;
}

interface TradeTrackerFeedProduct {
  additional: Record<string, string>;
  description?: string;
  identifier?: string;
  imageUrl?: string;
  name?: string;
  price?: number;
  productCategoryName?: string;
  productUrl?: string;
}

export interface TradeTrackerAlternateFeedSyncResult
  extends AlternateAffiliateFeedImportResult {
  affiliateSiteId: number;
  affiliateSiteName: string;
  campaignId: number;
  campaignName: string;
  fetchedProductCount: number;
  feedId: number;
  feedName: string;
  normalizedRowCount: number;
  pageCount: number;
  selectionStrategy:
    | 'configured-campaign-id'
    | 'configured-feed-id'
    | 'heuristic';
  setNumberDebug?: TradeTrackerAlternateSetNumberDebugInfo;
}

export interface TradeTrackerAlternateFeedSyncDependencies {
  fetchFn?: typeof fetch;
  getTradeTrackerAffiliateConfigFn?: typeof getTradeTrackerAffiliateConfig;
  importAlternateAffiliateFeedRowsFn?: typeof importAlternateAffiliateFeedRows;
}

export interface TradeTrackerAlternateSetNumberDebugSample {
  additionalFieldKeys: readonly string[];
  candidateFields: Record<string, string>;
  normalizedLegoSetNumber?: string;
  price?: number;
  productIdentifier?: string;
  productTitle?: string;
  titleNumberCandidates: readonly string[];
}

export interface TradeTrackerAlternateSetNumberDebugInfo {
  legoProductCount: number;
  sampleCount: number;
  samples: readonly TradeTrackerAlternateSetNumberDebugSample[];
  uniqueAdditionalFieldKeys: readonly string[];
}

export interface TradeTrackerAlternateFeedSyncOptions {
  debugLegoSamples?: number;
  collectUnmatchedDebug?: boolean;
  unmatchedSampleLimit?: number;
}

export interface TradeTrackerAlternateOnboardingQueueEntry
  extends AlternateAffiliateFeedUnmatchedSetSummary {
  inferredTheme?: string;
  priorityReasons: readonly string[];
  priorityScore: number;
  themePriorityScore: number;
}

export interface TradeTrackerAlternateOnboardingQueue {
  batchSize: number;
  topBatch: readonly TradeTrackerAlternateOnboardingQueueEntry[];
  totalCandidateCount: number;
}

const TRADETRACKER_ALTERNATE_THEME_PRIORITY_SCORE_BY_THEME = new Map([
  ['Technic', 120],
  ['Disney', 110],
  ['Icons', 95],
  ['Harry Potter', 92],
  ['Botanicals', 90],
  ['Art', 72],
  ['Ideas', 70],
  ['Architecture', 48],
  ['Marvel', 45],
  ['Star Wars', 45],
  ['Speed Champions', 42],
  ['Super Mario', 40],
  ['Jurassic World', 35],
  ['Animal Crossing', 30],
  ['Minecraft', 28],
  ['Friends', 20],
  ['NINJAGO', 18],
  ['City', 15],
  ['DUPLO', 10],
  ['Dreamzzz', 10],
]);

const TRADETRACKER_ALTERNATE_THEME_ALIAS_BY_PREFIX = new Map([
  ['animalcrossing', 'Animal Crossing'],
  ['architecture', 'Architecture'],
  ['art', 'Art'],
  ['botanicalcollection', 'Botanicals'],
  ['city', 'City'],
  ['creatorexpert', 'Icons'],
  ['disney', 'Disney'],
  ['dreamzzz', 'Dreamzzz'],
  ['dreamzz', 'Dreamzzz'],
  ['duplo', 'DUPLO'],
  ['duplostad', 'DUPLO'],
  ['friends', 'Friends'],
  ['harrypotter', 'Harry Potter'],
  ['icons', 'Icons'],
  ['ideas', 'Ideas'],
  ['jurassicworld', 'Jurassic World'],
  ['marvel', 'Marvel'],
  ['minecraft', 'Minecraft'],
  ['mariokart', 'Super Mario'],
  ['ninjago', 'NINJAGO'],
  ['speedchampions', 'Speed Champions'],
  ['starwars', 'Star Wars'],
  ['superheroesmarvel', 'Marvel'],
  ['supermario', 'Super Mario'],
  ['technic', 'Technic'],
  ['thebotanicalcollection', 'Botanicals'],
]);

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function renderSoapElement(
  name: string,
  value: string | number | boolean | undefined,
): string {
  if (value === undefined) {
    return '';
  }

  return `<tns:${name}>${escapeXml(String(value))}</tns:${name}>`;
}

function buildSoapEnvelope({
  operation,
  payloadXml,
}: {
  operation: TradeTrackerSoapOperation;
  payloadXml: string;
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:tns="${TRADETRACKER_WSI_SOAP_NAMESPACE}">
  <soap12:Body>
    <tns:${operation}>
      ${payloadXml}
    </tns:${operation}>
  </soap12:Body>
</soap12:Envelope>`;
}

function ensureArray<T>(value: T | readonly T[] | undefined): readonly T[] {
  if (Array.isArray(value)) {
    return value;
  }

  return value === undefined ? [] : [value as T];
}

function readString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmedValue = value.trim();

    return trimmedValue ? trimmedValue : undefined;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (record['nil'] === 'true') {
    return undefined;
  }

  return readString(record['#text']);
}

function readPositiveInteger(value: unknown, label: string): number {
  const rawValue = readString(value);
  const parsedValue = Number(rawValue);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`TradeTracker response is missing a valid ${label}.`);
  }

  return parsedValue;
}

function readNonNegativeInteger(
  value: unknown,
  label: string,
  fallbackValue = 0,
): number {
  const rawValue = readString(value);

  if (!rawValue) {
    return fallbackValue;
  }

  const parsedValue = Number(rawValue);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw new Error(`TradeTracker response is missing a valid ${label}.`);
  }

  return parsedValue;
}

function readDecimal(value: unknown): number | undefined {
  const rawValue = readString(value);

  if (!rawValue) {
    return undefined;
  }

  const parsedValue = Number(rawValue);

  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}

function normalizeLookupKey(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function normalizeSearchText(value: string | undefined): string {
  return (
    value
      ?.normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim() ?? ''
  );
}

function formatEuroMinor(value: number): string {
  return new Intl.NumberFormat('nl-NL', {
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    style: 'currency',
  }).format(value / 100);
}

function getTradeTrackerLeadThemeText(
  productTitle?: string,
): string | undefined {
  const trimmedTitle = productTitle?.trim();

  if (!trimmedTitle) {
    return undefined;
  }

  const withoutLegoPrefix = trimmedTitle.replace(/^lego\s+/i, '').trim();

  if (!withoutLegoPrefix) {
    return undefined;
  }

  const [leadSegment] = withoutLegoPrefix.split(/\s+-\s+|:\s+/u);
  const normalizedLeadSegment = leadSegment?.trim();

  return normalizedLeadSegment ? normalizedLeadSegment : undefined;
}

function inferTradeTrackerThemeFromProductTitle(
  productTitle?: string,
): string | undefined {
  const leadThemeText = getTradeTrackerLeadThemeText(productTitle);

  if (!leadThemeText) {
    return undefined;
  }

  return TRADETRACKER_ALTERNATE_THEME_ALIAS_BY_PREFIX.get(
    normalizeLookupKey(leadThemeText),
  );
}

function getTradeTrackerThemePriorityScore(theme?: string): number {
  return theme
    ? (TRADETRACKER_ALTERNATE_THEME_PRIORITY_SCORE_BY_THEME.get(theme) ?? 0)
    : 0;
}

function matchesAlternateFeed(feed: TradeTrackerFeed): boolean {
  const searchText = normalizeSearchText(
    [feed.name, feed.campaignName, feed.url].filter(Boolean).join(' '),
  );

  return searchText.includes('alternate');
}

function readSetCookieHeaders(headers: Headers): string[] {
  const headerRecord = headers as Headers & {
    getSetCookie?: () => string[];
    raw?: () => Record<string, string[]>;
  };

  if (typeof headerRecord.getSetCookie === 'function') {
    return headerRecord.getSetCookie();
  }

  if (typeof headerRecord.raw === 'function') {
    return headerRecord.raw()['set-cookie'] ?? [];
  }

  const singleValue = headers.get('set-cookie');

  return singleValue ? [singleValue] : [];
}

function mergeCookieHeader(
  currentCookieHeader: string | undefined,
  setCookieHeaders: readonly string[],
): string | undefined {
  const cookieEntries = new Map<string, string>();

  for (const cookie of currentCookieHeader?.split(';') ?? []) {
    const trimmedCookie = cookie.trim();

    if (!trimmedCookie) {
      continue;
    }

    const [name, ...valueParts] = trimmedCookie.split('=');

    if (name && valueParts.length > 0) {
      cookieEntries.set(name, `${name}=${valueParts.join('=')}`);
    }
  }

  for (const headerValue of setCookieHeaders) {
    const cookieValue = headerValue.split(';')[0]?.trim();

    if (!cookieValue) {
      continue;
    }

    const [name, ...valueParts] = cookieValue.split('=');

    if (name && valueParts.length > 0) {
      cookieEntries.set(name, `${name}=${valueParts.join('=')}`);
    }
  }

  if (!cookieEntries.size) {
    return currentCookieHeader;
  }

  return [...cookieEntries.values()].join('; ');
}

function readSoapFaultMessage(parsedResponse: Record<string, unknown>): string {
  const body = parsedResponse['Envelope'];
  const bodyRecord =
    body && typeof body === 'object' && !Array.isArray(body)
      ? ((body as Record<string, unknown>)['Body'] as Record<string, unknown>)
      : undefined;
  const fault =
    bodyRecord &&
    typeof bodyRecord === 'object' &&
    !Array.isArray(bodyRecord) &&
    bodyRecord['Fault'] &&
    typeof bodyRecord['Fault'] === 'object' &&
    !Array.isArray(bodyRecord['Fault'])
      ? (bodyRecord['Fault'] as Record<string, unknown>)
      : undefined;

  if (!fault) {
    return 'Unknown SOAP fault';
  }

  const reason =
    fault['Reason'] &&
    typeof fault['Reason'] === 'object' &&
    !Array.isArray(fault['Reason'])
      ? (fault['Reason'] as Record<string, unknown>)
      : undefined;
  const text = reason ? readString(reason['Text']) : undefined;

  return text ?? readString(fault['faultstring']) ?? 'Unknown SOAP fault';
}

function getSoapBodyResponse(
  xml: string,
  operation: TradeTrackerSoapOperation,
): Record<string, unknown> {
  const parsedResponse = tradeTrackerSoapParser.parse(xml) as Record<
    string,
    unknown
  >;
  const envelope =
    parsedResponse['Envelope'] &&
    typeof parsedResponse['Envelope'] === 'object' &&
    !Array.isArray(parsedResponse['Envelope'])
      ? (parsedResponse['Envelope'] as Record<string, unknown>)
      : undefined;
  const body =
    envelope?.['Body'] &&
    typeof envelope['Body'] === 'object' &&
    !Array.isArray(envelope['Body'])
      ? (envelope['Body'] as Record<string, unknown>)
      : undefined;

  if (!body) {
    throw new Error(
      `TradeTracker SOAP response for ${operation} is missing a body.`,
    );
  }

  if (body['Fault']) {
    throw new Error(
      `TradeTracker SOAP ${operation} failed: ${readSoapFaultMessage(
        parsedResponse,
      )}.`,
    );
  }

  const responseNode = body[`${operation}Response`];

  if (
    operation === 'authenticate' &&
    (responseNode === undefined || responseNode === '')
  ) {
    return {};
  }

  if (
    !responseNode ||
    typeof responseNode !== 'object' ||
    Array.isArray(responseNode)
  ) {
    throw new Error(
      `TradeTracker SOAP response for ${operation} is missing ${operation}Response.`,
    );
  }

  return responseNode as Record<string, unknown>;
}

function toTradeTrackerAffiliateSite(
  value: unknown,
): TradeTrackerAffiliateSite {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('TradeTracker affiliate site response is invalid.');
  }

  const record = value as Record<string, unknown>;

  return {
    id: readPositiveInteger(record['ID'], 'affiliate site ID'),
    name:
      readString(record['name']) ??
      `Affiliate site ${readPositiveInteger(record['ID'], 'affiliate site ID')}`,
    url: readString(record['URL']),
  };
}

function toTradeTrackerFeed(value: unknown): TradeTrackerFeed {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('TradeTracker feed response is invalid.');
  }

  const record = value as Record<string, unknown>;
  const campaign =
    record['campaign'] &&
    typeof record['campaign'] === 'object' &&
    !Array.isArray(record['campaign'])
      ? (record['campaign'] as Record<string, unknown>)
      : undefined;

  if (!campaign) {
    throw new Error('TradeTracker feed response is missing campaign info.');
  }

  return {
    id: readPositiveInteger(record['ID'], 'feed ID'),
    campaignId: readPositiveInteger(campaign['ID'], 'campaign ID'),
    campaignName:
      readString(campaign['name']) ??
      `Campaign ${readPositiveInteger(campaign['ID'], 'campaign ID')}`,
    name:
      readString(record['name']) ??
      `Feed ${readPositiveInteger(record['ID'], 'feed ID')}`,
    productCount: readNonNegativeInteger(
      record['productCount'],
      'feed product count',
    ),
    assignmentStatus: readString(record['assignmentStatus']),
    url: readString(record['URL']),
  };
}

function toTradeTrackerAdditionalFields(
  value: unknown,
): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const additionalValue = (value as Record<string, unknown>)[
    'feedProductAdditionalElement'
  ];

  return ensureArray(additionalValue).reduce<Record<string, string>>(
    (additionalFields, additionalElement) => {
      if (
        !additionalElement ||
        typeof additionalElement !== 'object' ||
        Array.isArray(additionalElement)
      ) {
        return additionalFields;
      }

      const elementRecord = additionalElement as Record<string, unknown>;
      const fieldName = readString(elementRecord['name']);
      const fieldValue = readString(elementRecord['value']);

      if (!fieldName || !fieldValue) {
        return additionalFields;
      }

      additionalFields[normalizeLookupKey(fieldName)] = fieldValue;

      return additionalFields;
    },
    {},
  );
}

function toTradeTrackerFeedProduct(value: unknown): TradeTrackerFeedProduct {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('TradeTracker feed product response is invalid.');
  }

  const record = value as Record<string, unknown>;

  return {
    identifier: readString(record['identifier']),
    name: readString(record['name']),
    productCategoryName: readString(record['productCategoryName']),
    description: readString(record['description']),
    price: readDecimal(record['price']),
    productUrl: readString(record['productURL']),
    imageUrl: readString(record['imageURL']),
    additional: toTradeTrackerAdditionalFields(record['additional']),
  };
}

function pickAdditionalField(
  additional: Record<string, string>,
  aliases: readonly string[],
): string | undefined {
  for (const alias of aliases) {
    const value = additional[alias];

    if (value?.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function isLegoTradeTrackerFeedProduct(
  product: TradeTrackerFeedProduct,
): boolean {
  const brand = pickAdditionalField(product.additional, ['brand', 'merk']);

  return brand?.trim().toLowerCase() === 'lego';
}

function getTitleNumberCandidates(productTitle?: string): string[] {
  const candidateMatches =
    productTitle?.match(/\b\d{4,6}\b/g)?.map((candidate) => candidate.trim()) ??
    [];

  return [...new Set(candidateMatches)];
}

function getTradeTrackerSetNumberCandidateFields(
  product: TradeTrackerFeedProduct,
): Record<string, string> {
  const candidateFields: Record<string, string> = {};
  const normalizedRow =
    normalizeTradeTrackerFeedProductToAlternateAffiliateFeedRow(product);
  const relevantAdditionalFieldEntries = Object.entries(product.additional)
    .filter(
      ([fieldKey]) =>
        /(set|number|sku|item|article|productcode|productnr|model|mpn|ean|gtin|code|id)$/i.test(
          fieldKey,
        ) ||
        /(set|sku|item|article|model|mpn|ean|gtin|number|nummer|nr|code)/i.test(
          fieldKey,
        ),
    )
    .sort(([left], [right]) => left.localeCompare(right));

  for (const [fieldKey, fieldValue] of relevantAdditionalFieldEntries) {
    candidateFields[`additional.${fieldKey}`] = fieldValue;
  }

  if (product.identifier?.trim()) {
    candidateFields['topLevel.identifier'] = product.identifier.trim();
  }

  for (const [index, candidate] of getTitleNumberCandidates(
    product.name,
  ).entries()) {
    candidateFields[`title.numberCandidate${index + 1}`] = candidate;
  }

  if (normalizedRow.legoSetNumber) {
    candidateFields['normalized.legoSetNumber'] = normalizedRow.legoSetNumber;
  }

  return candidateFields;
}

function buildTradeTrackerSetNumberDebugInfo({
  debugLegoSamples,
  products,
}: {
  debugLegoSamples?: number;
  products: readonly TradeTrackerFeedProduct[];
}): TradeTrackerAlternateSetNumberDebugInfo | undefined {
  if (!debugLegoSamples || debugLegoSamples <= 0) {
    return undefined;
  }

  const legoProducts = products.filter(isLegoTradeTrackerFeedProduct);

  if (!legoProducts.length) {
    return {
      legoProductCount: 0,
      sampleCount: 0,
      samples: [],
      uniqueAdditionalFieldKeys: [],
    };
  }

  const uniqueAdditionalFieldKeys = [
    ...new Set(
      legoProducts.flatMap((product) => Object.keys(product.additional)),
    ),
  ].sort((left, right) => left.localeCompare(right));
  const samples = legoProducts
    .slice(0, debugLegoSamples)
    .map<TradeTrackerAlternateSetNumberDebugSample>((product) => {
      const normalizedRow =
        normalizeTradeTrackerFeedProductToAlternateAffiliateFeedRow(product);

      return {
        additionalFieldKeys: Object.keys(product.additional).sort(
          (left, right) => left.localeCompare(right),
        ),
        candidateFields: getTradeTrackerSetNumberCandidateFields(product),
        normalizedLegoSetNumber: normalizedRow.legoSetNumber,
        price: product.price,
        productIdentifier: product.identifier,
        productTitle: product.name,
        titleNumberCandidates: getTitleNumberCandidates(product.name),
      };
    });

  return {
    legoProductCount: legoProducts.length,
    sampleCount: samples.length,
    samples,
    uniqueAdditionalFieldKeys,
  };
}

export function buildTradeTrackerAlternateOnboardingQueue({
  batchSize = 25,
  unmatchedSets,
}: {
  batchSize?: number;
  unmatchedSets: readonly AlternateAffiliateFeedUnmatchedSetSummary[];
}): TradeTrackerAlternateOnboardingQueue {
  const resolvedBatchSize =
    Number.isInteger(batchSize) && batchSize > 0 ? batchSize : 25;
  const rankedCandidates = unmatchedSets
    .map<TradeTrackerAlternateOnboardingQueueEntry>((unmatchedSet) => {
      const inferredTheme = inferTradeTrackerThemeFromProductTitle(
        unmatchedSet.productTitle,
      );
      const themePriorityScore =
        getTradeTrackerThemePriorityScore(inferredTheme);
      const repeatPresenceScore =
        Math.min(unmatchedSet.count, 3) * 60 +
        Math.max(unmatchedSet.count - 3, 0) * 10;
      const priceStrengthScore =
        typeof unmatchedSet.lowestPriceMinor === 'number'
          ? Math.min(Math.round(unmatchedSet.lowestPriceMinor / 150), 220)
          : 0;
      const lowPricePenalty =
        typeof unmatchedSet.lowestPriceMinor === 'number' &&
        unmatchedSet.lowestPriceMinor < 1500
          ? 40
          : 0;
      const priorityReasons = [
        `verschijnt ${unmatchedSet.count}x in de feed`,
        ...(inferredTheme
          ? [`themafit: ${inferredTheme} (${themePriorityScore})`]
          : ['themafit: onbekend']),
        ...(typeof unmatchedSet.lowestPriceMinor === 'number'
          ? [
              `prijsniveau vanaf ${formatEuroMinor(
                unmatchedSet.lowestPriceMinor,
              )}`,
            ]
          : ['prijsniveau onbekend']),
      ];

      return {
        ...unmatchedSet,
        inferredTheme,
        priorityReasons,
        priorityScore:
          repeatPresenceScore +
          themePriorityScore +
          priceStrengthScore -
          lowPricePenalty,
        themePriorityScore,
      };
    })
    .sort((left, right) => {
      return (
        right.priorityScore - left.priorityScore ||
        right.themePriorityScore - left.themePriorityScore ||
        right.count - left.count ||
        (right.lowestPriceMinor ?? 0) - (left.lowestPriceMinor ?? 0) ||
        left.legoSetNumber.localeCompare(right.legoSetNumber) ||
        (left.productTitle ?? '').localeCompare(right.productTitle ?? '')
      );
    });

  return {
    batchSize: resolvedBatchSize,
    topBatch: rankedCandidates.slice(0, resolvedBatchSize),
    totalCandidateCount: rankedCandidates.length,
  };
}

export function normalizeTradeTrackerFeedProductToAlternateAffiliateFeedRow(
  product: TradeTrackerFeedProduct,
): AlternateAffiliateFeedRow {
  const normalizedCurrency =
    pickAdditionalField(product.additional, [
      'currency',
      'currencycode',
      'valuta',
    ]) ??
    (typeof product.price === 'number' && Number.isFinite(product.price)
      ? 'EUR'
      : undefined);

  return {
    affiliateDeeplink: product.productUrl ?? '',
    availabilityText: pickAdditionalField(product.additional, [
      'availability',
      'availabilitytext',
      'stock',
      'stockstatus',
      'voorraad',
    ]),
    brand: pickAdditionalField(product.additional, ['brand', 'merk']),
    category:
      product.productCategoryName ??
      pickAdditionalField(product.additional, ['category', 'categorie']),
    condition: pickAdditionalField(product.additional, [
      'condition',
      'conditie',
      'staat',
    ]),
    currency: normalizedCurrency,
    description:
      product.description ??
      pickAdditionalField(product.additional, ['description', 'omschrijving']),
    ean: pickAdditionalField(product.additional, [
      'ean',
      'ean13',
      'gtin',
      'barcode',
    ]),
    imageUrl: product.imageUrl,
    legoSetNumber: pickAdditionalField(product.additional, [
      'legosetnumber',
      'setnumber',
      'setnr',
      'legosetid',
      'mpn',
      'itemnumber',
    ]),
    price: product.price,
    productTitle: product.name,
    shippingCost: pickAdditionalField(product.additional, [
      'shippingcost',
      'shipping',
      'shippingprice',
      'deliverycost',
      'verzendkosten',
    ]),
  };
}

class TradeTrackerSoapAffiliateClient {
  private cookieHeader: string | undefined;

  constructor(private readonly fetchFn: typeof fetch) {}

  async authenticate(config: TradeTrackerAffiliateConfig): Promise<void> {
    await this.call({
      operation: 'authenticate',
      payloadXml: [
        renderSoapElement('customerID', config.customerId),
        renderSoapElement('passphrase', config.passphrase),
        renderSoapElement('sandbox', false),
        renderSoapElement('locale', TRADETRACKER_LOCALE),
        renderSoapElement('demo', false),
      ].join(''),
    });

    if (!this.cookieHeader) {
      throw new Error(
        'TradeTracker authentication did not return a session cookie.',
      );
    }
  }

  async getAffiliateSites(input: {
    affiliateSiteId?: number;
  }): Promise<readonly TradeTrackerAffiliateSite[]> {
    const payloadXml = [
      '<tns:options>',
      renderSoapElement('ID', input.affiliateSiteId),
      renderSoapElement(
        'affiliateSiteStatus',
        input.affiliateSiteId ? undefined : 'accepted',
      ),
      '</tns:options>',
    ].join('');
    const response = await this.call({
      operation: 'getAffiliateSites',
      payloadXml,
    });
    const affiliateSitesValue =
      response['affiliateSites'] &&
      typeof response['affiliateSites'] === 'object' &&
      !Array.isArray(response['affiliateSites'])
        ? (response['affiliateSites'] as Record<string, unknown>)[
            'affiliateSite'
          ]
        : undefined;

    return ensureArray(affiliateSitesValue).map(toTradeTrackerAffiliateSite);
  }

  async getFeeds(input: {
    affiliateSiteId: number;
    campaignId?: number;
  }): Promise<readonly TradeTrackerFeed[]> {
    const payloadXml = [
      renderSoapElement('affiliateSiteID', input.affiliateSiteId),
      '<tns:options>',
      renderSoapElement('campaignID', input.campaignId),
      renderSoapElement('assignmentStatus', 'accepted'),
      '</tns:options>',
    ].join('');
    const response = await this.call({
      operation: 'getFeeds',
      payloadXml,
    });
    const feedsValue =
      response['feeds'] &&
      typeof response['feeds'] === 'object' &&
      !Array.isArray(response['feeds'])
        ? (response['feeds'] as Record<string, unknown>)['feed']
        : undefined;

    return ensureArray(feedsValue).map(toTradeTrackerFeed);
  }

  async getFeedProducts(input: {
    affiliateSiteId: number;
    feedId: number;
    limit: number;
    offset: number;
  }): Promise<readonly TradeTrackerFeedProduct[]> {
    const payloadXml = [
      renderSoapElement('affiliateSiteID', input.affiliateSiteId),
      '<tns:options>',
      renderSoapElement('feedID', input.feedId),
      renderSoapElement('limit', input.limit),
      renderSoapElement('offset', input.offset),
      '</tns:options>',
    ].join('');
    const response = await this.call({
      operation: 'getFeedProducts',
      payloadXml,
    });
    const feedProductsValue =
      response['feedProducts'] &&
      typeof response['feedProducts'] === 'object' &&
      !Array.isArray(response['feedProducts'])
        ? (response['feedProducts'] as Record<string, unknown>)['feedProduct']
        : undefined;

    return ensureArray(feedProductsValue).map(toTradeTrackerFeedProduct);
  }

  private async call({
    operation,
    payloadXml,
  }: {
    operation: TradeTrackerSoapOperation;
    payloadXml: string;
  }): Promise<Record<string, unknown>> {
    const soapAction = `${TRADETRACKER_WSI_SOAP_NAMESPACE}/${operation}`;
    const response = await this.fetchFn(TRADETRACKER_WSI_SOAP_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/soap+xml, application/xml, text/xml',
        'Content-Type': `${SOAP_12_CONTENT_TYPE}; action="${soapAction}"`,
        SOAPAction: soapAction,
        ...(this.cookieHeader ? { Cookie: this.cookieHeader } : {}),
      },
      body: buildSoapEnvelope({
        operation,
        payloadXml,
      }),
    });
    const responseText = await response.text();

    this.cookieHeader = mergeCookieHeader(
      this.cookieHeader,
      readSetCookieHeaders(response.headers),
    );

    if (!response.ok) {
      let errorMessage = `${response.status} ${response.statusText}`;

      try {
        errorMessage = readSoapFaultMessage(
          tradeTrackerSoapParser.parse(responseText) as Record<string, unknown>,
        );
      } catch {
        // Keep the HTTP-level error if the SOAP body is not parseable.
      }

      throw new Error(
        `TradeTracker SOAP ${operation} returned ${errorMessage}.`,
      );
    }

    return getSoapBodyResponse(responseText, operation);
  }
}

function selectAffiliateSite({
  affiliateSites,
  configuredAffiliateSiteId,
}: {
  affiliateSites: readonly TradeTrackerAffiliateSite[];
  configuredAffiliateSiteId?: number;
}): TradeTrackerAffiliateSite {
  if (configuredAffiliateSiteId !== undefined) {
    const configuredAffiliateSite = affiliateSites.find(
      (affiliateSite) => affiliateSite.id === configuredAffiliateSiteId,
    );

    if (!configuredAffiliateSite) {
      throw new Error(
        `TradeTracker affiliate site ${configuredAffiliateSiteId} is not available for this account.`,
      );
    }

    return configuredAffiliateSite;
  }

  if (affiliateSites.length === 1) {
    return affiliateSites[0];
  }

  throw new Error(
    `TradeTracker returned ${affiliateSites.length} affiliate sites. Set TRADETRACKER_AFFILIATE_SITE_ID to choose one.`,
  );
}

function selectAlternateFeed({
  configuredAlternateCampaignId,
  configuredAlternateFeedId,
  feeds,
}: {
  configuredAlternateCampaignId?: number;
  configuredAlternateFeedId?: number;
  feeds: readonly TradeTrackerFeed[];
}): {
  feed: TradeTrackerFeed;
  selectionStrategy:
    | 'configured-campaign-id'
    | 'configured-feed-id'
    | 'heuristic';
} {
  if (configuredAlternateFeedId !== undefined) {
    const configuredFeed = feeds.find(
      (feed) => feed.id === configuredAlternateFeedId,
    );

    if (!configuredFeed) {
      throw new Error(
        `TradeTracker feed ${configuredAlternateFeedId} is not available for the selected affiliate site.`,
      );
    }

    return {
      feed: configuredFeed,
      selectionStrategy: 'configured-feed-id',
    };
  }

  const feedsInScope =
    configuredAlternateCampaignId === undefined
      ? feeds
      : feeds.filter(
          (feed) => feed.campaignId === configuredAlternateCampaignId,
        );

  if (!feedsInScope.length) {
    throw new Error(
      `TradeTracker returned no feeds for campaign ${configuredAlternateCampaignId}.`,
    );
  }

  if (
    configuredAlternateCampaignId !== undefined &&
    feedsInScope.length === 1
  ) {
    return {
      feed: feedsInScope[0],
      selectionStrategy: 'configured-campaign-id',
    };
  }

  const alternateFeeds = feedsInScope.filter(matchesAlternateFeed);

  if (alternateFeeds.length === 1) {
    return {
      feed: alternateFeeds[0],
      selectionStrategy: configuredAlternateCampaignId
        ? 'configured-campaign-id'
        : 'heuristic',
    };
  }

  if (!alternateFeeds.length) {
    throw new Error(
      'TradeTracker returned no unambiguous Alternate feed. Set TRADETRACKER_ALTERNATE_FEED_ID or TRADETRACKER_ALTERNATE_CAMPAIGN_ID.',
    );
  }

  throw new Error(
    `TradeTracker returned ${alternateFeeds.length} Alternate-like feeds. Set TRADETRACKER_ALTERNATE_FEED_ID to choose one explicitly.`,
  );
}

async function loadAllFeedProducts({
  affiliateSiteId,
  client,
  feed,
}: {
  affiliateSiteId: number;
  client: TradeTrackerSoapAffiliateClient;
  feed: TradeTrackerFeed;
}): Promise<{
  pageCount: number;
  products: readonly TradeTrackerFeedProduct[];
}> {
  const products: TradeTrackerFeedProduct[] = [];
  let offset = 0;
  let pageCount = 0;

  while (true) {
    const pageProducts = await client.getFeedProducts({
      affiliateSiteId,
      feedId: feed.id,
      limit: TRADETRACKER_PAGE_SIZE,
      offset,
    });

    pageCount += 1;

    if (!pageProducts.length) {
      break;
    }

    products.push(...pageProducts);
    offset += pageProducts.length;

    if (
      pageProducts.length < TRADETRACKER_PAGE_SIZE ||
      offset >= feed.productCount
    ) {
      break;
    }
  }

  return {
    pageCount,
    products,
  };
}

export async function syncAlternateTradeTrackerFeed({
  dependencies,
  options,
}: {
  dependencies?: TradeTrackerAlternateFeedSyncDependencies;
  options?: TradeTrackerAlternateFeedSyncOptions;
} = {}): Promise<TradeTrackerAlternateFeedSyncResult> {
  const fetchFn = dependencies?.fetchFn ?? fetch;
  const getTradeTrackerAffiliateConfigFn =
    dependencies?.getTradeTrackerAffiliateConfigFn ??
    getTradeTrackerAffiliateConfig;
  const importAlternateAffiliateFeedRowsFn =
    dependencies?.importAlternateAffiliateFeedRowsFn ??
    importAlternateAffiliateFeedRows;
  const config = getTradeTrackerAffiliateConfigFn();
  const client = new TradeTrackerSoapAffiliateClient(fetchFn);

  await client.authenticate(config);

  const affiliateSites = await client.getAffiliateSites({
    affiliateSiteId: config.affiliateSiteId,
  });
  const affiliateSite = selectAffiliateSite({
    affiliateSites,
    configuredAffiliateSiteId: config.affiliateSiteId,
  });
  const feeds = await client.getFeeds({
    affiliateSiteId: affiliateSite.id,
    campaignId: config.alternateCampaignId,
  });
  const { feed, selectionStrategy } = selectAlternateFeed({
    configuredAlternateCampaignId: config.alternateCampaignId,
    configuredAlternateFeedId: config.alternateFeedId,
    feeds,
  });
  const { pageCount, products } = await loadAllFeedProducts({
    affiliateSiteId: affiliateSite.id,
    client,
    feed,
  });
  const setNumberDebug = buildTradeTrackerSetNumberDebugInfo({
    debugLegoSamples: options?.debugLegoSamples,
    products,
  });
  const rows = products.map(
    normalizeTradeTrackerFeedProductToAlternateAffiliateFeedRow,
  );
  const importResult = await importAlternateAffiliateFeedRowsFn({
    options: {
      collectUnmatchedDebug: options?.collectUnmatchedDebug,
      unmatchedSampleLimit: options?.unmatchedSampleLimit,
    } satisfies AlternateAffiliateFeedImportOptions,
    rows,
  });

  return {
    affiliateSiteId: affiliateSite.id,
    affiliateSiteName: affiliateSite.name,
    campaignId: feed.campaignId,
    campaignName: feed.campaignName,
    feedId: feed.id,
    feedName: feed.name,
    fetchedProductCount: products.length,
    normalizedRowCount: rows.length,
    pageCount,
    selectionStrategy,
    setNumberDebug,
    ...importResult,
  };
}
