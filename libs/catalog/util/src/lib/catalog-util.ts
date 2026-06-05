import { MetricCard } from '@lego-platform/shared/types';
import {
  formatCompactNumber,
  normalizeCatalogSetId,
} from '@lego-platform/shared/util';
import {
  isThemeVisible,
  normalizeTheme,
  shouldMapThemeToParent,
} from './theme-registry';

export const catalogReleaseDatePrecisions = [
  'day',
  'month',
  'year',
  'unknown',
] as const;

export type CatalogReleaseDatePrecision =
  (typeof catalogReleaseDatePrecisions)[number];

export interface CatalogReleaseMetadata {
  createdAt?: string;
  releaseDate?: string;
  releaseDatePrecision: CatalogReleaseDatePrecision;
}

export interface CatalogSetSummary {
  catalogName?: string;
  createdAt?: string;
  displayTitle?: string;
  displayTitleSource?: CatalogSetDisplayTitleSource;
  id: string;
  slug: string;
  name: string;
  publicTheme?: CatalogPublicThemeReference;
  theme: string;
  secondaryLabels?: readonly string[];
  releaseYear: number;
  releaseDate?: string;
  releaseDatePrecision?: CatalogReleaseDatePrecision;
  pieces: number;
  // Transitional legacy copy field. New runtime reads should not depend on it.
  collectorAngle?: string;
  imageUrl?: string;
  images?: readonly CatalogSetImage[];
  primaryImage?: string;
}

export type CatalogSetImageType = 'hero' | 'detail' | 'minifig';

export interface CatalogSetImage {
  attributionText?: string;
  order?: number;
  thumbnailUrl?: string;
  type?: CatalogSetImageType;
  url: string;
}

export type CatalogSetImageSeed = CatalogSetImage | string;

export interface CatalogHomepageSetCard extends CatalogSetSummary {
  // Transitional legacy copy fields. Card UIs should prefer price context
  // and source metadata over local per-set prose.
  tagline?: string;
  availability?: string;
  minifigureCount?: number;
  minifigureHighlights?: readonly string[];
  recommendedAge?: number;
  setStatus?: CatalogSetStatus;
}

export interface CatalogDiscoverySignal {
  bestPriceMinor: number;
  merchantCount: number;
  nextBestPriceMinor?: number;
  observedAt: string;
  priceSpreadMinor: number;
  recentReferencePriceChangeMinor?: number;
  recentReferencePriceChangedAt?: string;
  referenceDeltaMinor?: number;
}

export interface CatalogSetCardSearchMatch<
  T extends Pick<
    CatalogHomepageSetCard,
    'id' | 'name' | 'releaseYear' | 'minifigureHighlights'
  > = CatalogHomepageSetCard,
> {
  score: number;
  setCard: T;
}

export interface CatalogSearchMatch {
  discoverRank: number;
  score: number;
  setCard: CatalogHomepageSetCard;
}

export interface CatalogThemeSearchMatch {
  score: number;
  theme: CatalogThemeDirectoryItem;
}

export interface CatalogSetDisplaySize {
  label?: string;
  value: string;
}

export interface CatalogProductFeature {
  body: string;
  title?: string;
}

export interface CatalogThemeIdentity {
  primaryTheme: string;
  publicTheme?: CatalogPublicThemeReference;
  secondaryThemes: readonly string[];
}

export interface CatalogPublicThemeReference {
  accentColor?: string;
  heroTextColor?: string;
  logoUrl?: string;
  name: string;
  slug: string;
  surfaceColor?: string;
  surfaceTextColor?: string;
}

export interface CatalogSetDetail extends CatalogSetSummary {
  tagline?: string;
  availability?: string;
  collectorHighlights?: readonly string[];
  legoProductDescription?: string;
  legoProductFeatures?: readonly CatalogProductFeature[];
  minifigureCount?: number;
  minifigureHighlights?: readonly string[];
  recommendedAge?: number;
  displaySize?: CatalogSetDisplaySize;
  setStatus?: CatalogSetStatus;
  subtheme?: string;
}

export type CatalogSetDisplayTitleSource = 'catalog' | 'rakuten-lego-eu';

export type CatalogSetStatus =
  | 'available'
  | 'backorder'
  | 'retiring_soon'
  | 'retired';

export type CatalogQuickFilterKey =
  | 'all'
  | 'best-deals'
  | 'with-minifigures'
  | 'star-wars'
  | 'harry-potter'
  | 'marvel'
  | 'icons';

export interface CatalogQuickFilterOption {
  key: CatalogQuickFilterKey;
  label: string;
  theme?: string;
}

const catalogQuickFilterOptions = [
  {
    key: 'all',
    label: 'Alles',
  },
  {
    key: 'best-deals',
    label: 'Beste deals',
  },
  {
    key: 'with-minifigures',
    label: 'Met minifiguren',
  },
  {
    key: 'star-wars',
    label: 'Star Wars',
    theme: 'Star Wars',
  },
  {
    key: 'harry-potter',
    label: 'Harry Potter',
    theme: 'Harry Potter',
  },
  {
    key: 'marvel',
    label: 'Marvel',
    theme: 'Marvel',
  },
  {
    key: 'icons',
    label: 'Icons',
    theme: 'Icons',
  },
] as const satisfies readonly CatalogQuickFilterOption[];

export function listCatalogQuickFilterOptions(): readonly CatalogQuickFilterOption[] {
  return catalogQuickFilterOptions;
}

export function normalizeCatalogQuickFilterKey(
  value?: string,
): CatalogQuickFilterKey {
  return catalogQuickFilterOptions.some(
    (catalogQuickFilterOption) => catalogQuickFilterOption.key === value,
  )
    ? (value as CatalogQuickFilterKey)
    : 'all';
}

function hasCatalogMinifigureSignal({
  minifigureCount,
  minifigureHighlights,
}: Pick<CatalogHomepageSetCard, 'minifigureCount' | 'minifigureHighlights'>) {
  return (
    typeof minifigureCount === 'number' || Boolean(minifigureHighlights?.length)
  );
}

export function matchesCatalogQuickFilter({
  filter,
  setCard,
  strongDealSetIds = [],
}: {
  filter: CatalogQuickFilterKey;
  setCard: Pick<
    CatalogHomepageSetCard,
    'id' | 'theme' | 'minifigureCount' | 'minifigureHighlights'
  >;
  strongDealSetIds?: readonly string[];
}): boolean {
  if (filter === 'all') {
    return true;
  }

  if (filter === 'best-deals') {
    return strongDealSetIds.includes(setCard.id);
  }

  if (filter === 'with-minifigures') {
    return hasCatalogMinifigureSignal(setCard);
  }

  const catalogQuickFilterOption = catalogQuickFilterOptions.find(
    (quickFilterOption) => quickFilterOption.key === filter,
  );

  if (!catalogQuickFilterOption || !('theme' in catalogQuickFilterOption)) {
    return false;
  }

  return catalogQuickFilterOption.theme === setCard.theme;
}

function normalizeCatalogSearchText(value: string): string {
  return normalizeCatalogAsciiText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeCatalogSearchToken(value: string): string {
  return normalizeCatalogAsciiText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function getCatalogSetCardSearchScore<
  T extends Pick<
    CatalogHomepageSetCard,
    'catalogName' | 'id' | 'name' | 'minifigureHighlights'
  >,
>({
  queryText,
  queryToken,
  setCard,
}: {
  queryText: string;
  queryToken: string;
  setCard: T;
}): number | undefined {
  const canonicalIdToken = normalizeCatalogSearchToken(setCard.id);
  const normalizedName = normalizeCatalogSearchText(setCard.name);
  const compactName = normalizeCatalogSearchToken(setCard.name);
  const normalizedCatalogName = setCard.catalogName
    ? normalizeCatalogSearchText(setCard.catalogName)
    : undefined;
  const compactCatalogName = setCard.catalogName
    ? normalizeCatalogSearchToken(setCard.catalogName)
    : undefined;
  const highlightText = setCard.minifigureHighlights?.join(' ');
  const normalizedHighlights = highlightText
    ? normalizeCatalogSearchText(highlightText)
    : undefined;
  const compactHighlights = highlightText
    ? normalizeCatalogSearchToken(highlightText)
    : undefined;

  if (canonicalIdToken === queryToken) {
    return 0;
  }

  if (canonicalIdToken.startsWith(queryToken)) {
    return 1;
  }

  if (
    normalizedName.startsWith(queryText) ||
    compactName.startsWith(queryToken)
  ) {
    return 2;
  }

  if (
    normalizedCatalogName?.startsWith(queryText) ||
    compactCatalogName?.startsWith(queryToken)
  ) {
    return 2.5;
  }

  if (
    normalizedName
      .split(' ')
      .some((normalizedNameWord) => normalizedNameWord.startsWith(queryText))
  ) {
    return 3;
  }

  if (normalizedName.includes(queryText) || compactName.includes(queryToken)) {
    return 4;
  }

  if (
    normalizedCatalogName?.includes(queryText) ||
    compactCatalogName?.includes(queryToken)
  ) {
    return 4.5;
  }

  if (
    normalizedHighlights
      ?.split(' ')
      .some((normalizedHighlightWord) =>
        normalizedHighlightWord.startsWith(queryText),
      )
  ) {
    return 5;
  }

  if (
    normalizedHighlights?.includes(queryText) ||
    compactHighlights?.includes(queryToken)
  ) {
    return 6;
  }

  return undefined;
}

export function listCatalogSetCardSearchMatches<
  T extends Pick<
    CatalogHomepageSetCard,
    'catalogName' | 'id' | 'name' | 'releaseYear' | 'minifigureHighlights'
  >,
>({
  limit = 6,
  query,
  setCards,
}: {
  limit?: number;
  query: string;
  setCards: readonly T[];
}): CatalogSetCardSearchMatch<T>[] {
  const normalizedQueryText = normalizeCatalogSearchText(query);
  const normalizedQueryToken = normalizeCatalogSearchToken(query);
  const suggestionLimit = Math.max(0, Math.floor(limit));

  if (!normalizedQueryText || !normalizedQueryToken || suggestionLimit === 0) {
    return [];
  }

  return setCards
    .flatMap((setCard) => {
      const score = getCatalogSetCardSearchScore({
        queryText: normalizedQueryText,
        queryToken: normalizedQueryToken,
        setCard,
      });

      return typeof score === 'number'
        ? [
            {
              score,
              setCard,
            } satisfies CatalogSetCardSearchMatch<T>,
          ]
        : [];
    })
    .sort(
      (left, right) =>
        left.score - right.score ||
        right.setCard.releaseYear - left.setCard.releaseYear ||
        left.setCard.name.localeCompare(right.setCard.name),
    )
    .slice(0, suggestionLimit);
}

export interface CatalogThemeSnapshot {
  name: string;
  slug: string;
  setCount: number;
  momentum: string;
  signatureSet: string;
}

export interface CatalogThemeVisual {
  backgroundColor?: string;
  imageUrl?: string;
  textColor?: string;
}

export interface CatalogThemeDefinition {
  name: string;
  slug: string;
  visual: CatalogThemeVisual;
}

export function getCatalogThemeVisual(
  themeName?: string,
): CatalogThemeVisual | undefined {
  void themeName;
  return undefined;
}

export function getCatalogThemeDisplayName(
  themeName?: string,
  context?: Parameters<typeof normalizeTheme>[1],
): string | undefined {
  if (!themeName) {
    return undefined;
  }

  const primaryTheme = getCatalogPrimaryTheme({
    rawTheme: themeName,
  });

  return normalizeTheme(primaryTheme, context)?.displayName ?? primaryTheme;
}

export interface CatalogSetRecord {
  canonicalId: string;
  sourceSetNumber: string;
  slug: string;
  name: string;
  theme: string;
  releaseYear: number;
  releaseDate?: string;
  releaseDatePrecision?: CatalogReleaseDatePrecision;
  pieces: number;
  imageUrl?: string;
  images?: readonly CatalogSetImage[];
  primaryImage?: string;
}

export const catalogOverlaySetSources = ['rebrickable'] as const;

export const catalogOverlaySetStatuses = ['active', 'inactive'] as const;

export type CatalogOverlaySetSource = (typeof catalogOverlaySetSources)[number];

export type CatalogOverlaySetStatus =
  (typeof catalogOverlaySetStatuses)[number];

export interface CatalogAddableSetRecord {
  imageUrl?: string;
  name: string;
  pieces: number;
  releaseYear: number;
  releaseDate?: string;
  releaseDatePrecision?: CatalogReleaseDatePrecision;
  setId: string;
  slug: string;
  source: CatalogOverlaySetSource;
  sourceSetNumber: string;
  theme: string;
}

export type CatalogExternalSetSearchResult = CatalogAddableSetRecord;

export type CatalogSuggestedSetConfidence = 'experimental' | 'high' | 'medium';

export interface CatalogSuggestedSet extends CatalogExternalSetSearchResult {
  confidence: CatalogSuggestedSetConfidence;
  isRetailFriendlyTheme: boolean;
  score: number;
}

export interface CatalogSet extends CatalogAddableSetRecord {
  createdAt: string;
  primaryThemeId?: string;
  secondaryThemeLabels?: readonly string[];
  sourceThemeId?: string;
  status: CatalogOverlaySetStatus;
  updatedAt: string;
}

// Transitional read alias. New write paths should use CatalogSet.
export type CatalogOverlaySet = CatalogSet;

export const catalogCanonicalSetSources = [
  'snapshot',
  ...catalogOverlaySetSources,
] as const;

export type CatalogCanonicalSetSource =
  (typeof catalogCanonicalSetSources)[number];

export type CatalogCanonicalSetStatus = CatalogOverlaySetStatus;

export interface CatalogCanonicalSet {
  catalogName?: string;
  createdAt: string;
  displayTitle?: string;
  displayTitleSource?: CatalogSetDisplayTitleSource;
  images?: readonly CatalogSetImage[];
  imageUrl?: string;
  legoProductDescription?: string;
  legoProductFeatures?: readonly CatalogProductFeature[];
  minifigureCount?: number;
  name: string;
  pieceCount: number;
  primaryTheme: string;
  publicTheme?: CatalogPublicThemeReference;
  releaseYear: number;
  releaseDate?: string;
  releaseDatePrecision?: CatalogReleaseDatePrecision;
  secondaryLabels: readonly string[];
  setId: string;
  slug: string;
  source: CatalogCanonicalSetSource;
  sourceSetNumber?: string;
  status: CatalogCanonicalSetStatus;
  updatedAt: string;
}

export interface CatalogSnapshot {
  source: string;
  generatedAt: string;
  setRecords: readonly CatalogSetRecord[];
}

export type CatalogPopularityEventType =
  | 'set_view'
  | 'catalog_set_click'
  | 'offer_click';

export interface CatalogPopularitySetCounts {
  set_view: number;
  catalog_set_click: number;
  offer_click: number;
}

export interface CatalogPopularitySetSnapshot {
  set_num: string;
  score: number;
  unique_sessions: number;
  counts: CatalogPopularitySetCounts;
}

export interface CatalogPopularitySnapshot {
  generatedAt: string;
  windows: {
    day: readonly CatalogPopularitySetSnapshot[];
    week: readonly CatalogPopularitySetSnapshot[];
  };
}

export interface CatalogSetOverlay {
  canonicalId: string;
  productSlug?: string;
  displayName?: string;
  displayTheme?: string;
  // Transitional legacy copy fields. Keep them optional during cleanup while
  // older adapters finish moving off local per-set prose.
  collectorAngle?: string;
  tagline?: string;
  availability?: string;
  collectorHighlights?: readonly string[];
  minifigureCount?: number;
  minifigureHighlights?: readonly string[];
  recommendedAge?: number;
  displaySize?: CatalogSetDisplaySize;
  setStatus?: CatalogSetStatus;
  subtheme?: string;
  images?: readonly CatalogSetImageSeed[];
  primaryImage?: string;
}

export interface CatalogBrowseThemeGroup {
  slug: string;
  setCards: CatalogHomepageSetCard[];
  theme: string;
  totalSetCount?: number;
}

export interface CatalogThemeLandingPage {
  setCards: CatalogHomepageSetCard[];
  themeSnapshot: CatalogThemeSnapshot;
  visual?: CatalogThemeVisual;
}

export interface CatalogThemeDirectoryItem {
  imageUrl?: string;
  themeSnapshot: CatalogThemeSnapshot;
  visual?: CatalogThemeVisual;
}

export const catalogHomepageFeaturedSetIds = [
  '10316',
  '10333',
  '21333',
] as const;

export const catalogHomepageDealCandidateIds = [
  '76269',
  '21348',
  '10294',
  '21349',
  '10332',
  '10305',
  '21061',
] as const;

export const catalogDiscoverDealCandidateIds = [
  '76269',
  '10316',
  '21348',
  '10333',
  '10294',
  '21333',
  '21349',
  '10332',
  '10305',
  '21061',
] as const;

export const catalogDiscoverSetOrder = [
  '10316',
  '10333',
  '10294',
  '76269',
  '76178',
  '75367',
  '75313',
  '75331',
  '76417',
  '76419',
  '76437',
  '21348',
  '21350',
  '10300',
  '21333',
  '10280',
  '10311',
  '31208',
  '21345',
  '21349',
  '10305',
  '10326',
  '10332',
  '10318',
  '10341',
  '10317',
  '76218',
  '42143',
  '42115',
  '43222',
  '71411',
  '71741',
] as const;

export interface CatalogSyncManifest {
  source: string;
  generatedAt: string;
  recordCount: number;
  homepageFeaturedSetIds: readonly string[];
  notes?: string;
}

export interface CatalogSetSeed {
  sourceSetNumber: string;
  name: string;
  theme: string;
  releaseYear: number;
  releaseDate?: string;
  releaseDatePrecision?: CatalogReleaseDatePrecision;
  pieces: number;
  imageUrl?: string;
  images?: readonly CatalogSetImageSeed[];
  primaryImage?: string;
}

function parseCatalogReleaseDate(releaseDate?: string): Date | undefined {
  if (!releaseDate) {
    return undefined;
  }

  const parsedDate = new Date(`${releaseDate}T00:00:00Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    return undefined;
  }

  return parsedDate;
}

export function resolveCatalogReleaseDatePrecision({
  releaseDate,
  releaseDatePrecision,
  releaseYear,
}: {
  releaseDate?: string;
  releaseDatePrecision?: CatalogReleaseDatePrecision;
  releaseYear?: number;
}): CatalogReleaseDatePrecision {
  const parsedDate = parseCatalogReleaseDate(releaseDate);

  if (
    parsedDate &&
    (releaseDatePrecision === 'day' || releaseDatePrecision === 'month')
  ) {
    return releaseDatePrecision;
  }

  if (typeof releaseYear === 'number') {
    return 'year';
  }

  if (parsedDate) {
    return 'day';
  }

  return 'unknown';
}

export function getCatalogReleaseYear({
  releaseDate,
  releaseYear,
}: {
  releaseDate?: string;
  releaseYear?: number;
}): number | undefined {
  if (typeof releaseYear === 'number') {
    return releaseYear;
  }

  return parseCatalogReleaseDate(releaseDate)?.getUTCFullYear();
}

function formatCatalogReleaseMonthYear(date: Date): string {
  return new Intl.DateTimeFormat('nl-NL', {
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(date);
}

function formatCatalogReleaseDay(date: Date): string {
  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(date);
}

function getCatalogReleaseAgeDays({
  now = new Date(),
  releaseDate,
}: {
  now?: Date;
  releaseDate: Date;
}): number {
  return Math.floor(
    (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
      Date.UTC(
        releaseDate.getUTCFullYear(),
        releaseDate.getUTCMonth(),
        releaseDate.getUTCDate(),
      )) /
      86_400_000,
  );
}

export function buildCatalogReleaseLabel({
  now = new Date(),
  releaseDate,
  releaseDatePrecision,
  releaseYear,
  variant = 'detail',
}: {
  now?: Date;
  releaseDate?: string;
  releaseDatePrecision?: CatalogReleaseDatePrecision;
  releaseYear?: number;
  variant?: 'compact' | 'detail';
}):
  | {
      label: string;
      value: string;
    }
  | undefined {
  const resolvedPrecision = resolveCatalogReleaseDatePrecision({
    releaseDate,
    releaseDatePrecision,
    releaseYear,
  });
  const resolvedReleaseYear = getCatalogReleaseYear({
    releaseDate,
    releaseYear,
  });
  const parsedReleaseDate = parseCatalogReleaseDate(releaseDate);

  if (resolvedPrecision === 'unknown') {
    return undefined;
  }

  if (variant === 'compact') {
    if (
      parsedReleaseDate &&
      (resolvedPrecision === 'day' || resolvedPrecision === 'month')
    ) {
      const releaseAgeDays = getCatalogReleaseAgeDays({
        now,
        releaseDate: parsedReleaseDate,
      });

      if (releaseAgeDays >= 0 && releaseAgeDays <= 45) {
        return {
          label: 'Release',
          value: 'Net uit',
        };
      }
    }

    if (
      typeof resolvedReleaseYear === 'number' &&
      resolvedReleaseYear >= now.getUTCFullYear()
    ) {
      return {
        label: 'Release',
        value: `Nieuw in ${resolvedReleaseYear}`,
      };
    }

    return undefined;
  }

  if (resolvedPrecision === 'day' && parsedReleaseDate) {
    return {
      label: 'Release',
      value: formatCatalogReleaseDay(parsedReleaseDate),
    };
  }

  if (resolvedPrecision === 'month' && parsedReleaseDate) {
    const monthYearLabel = formatCatalogReleaseMonthYear(parsedReleaseDate);

    return {
      label: 'Release',
      value:
        parsedReleaseDate.getTime() > now.getTime()
          ? `Verwacht ${monthYearLabel}`
          : `Uitgebracht ${monthYearLabel}`,
    };
  }

  if (typeof resolvedReleaseYear === 'number') {
    return {
      label: 'Release',
      value:
        resolvedReleaseYear >= now.getUTCFullYear()
          ? `Nieuw in ${resolvedReleaseYear}`
          : `Uitgebracht in ${resolvedReleaseYear}`,
    };
  }

  return undefined;
}

function normalizeCatalogText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

interface CatalogThemeNormalizationRule {
  primaryTheme: string;
  secondaryTheme?: string;
}

const catalogCanonicalThemeNames = new Map<string, string>([
  ['LEGO Art', 'Art'],
  ['LEGO Ideas and CUUSOO', 'Ideas'],
  ['Ninjago', 'NINJAGO'],
]);

const catalogThemeNormalizationRulesByRawTheme = new Map<
  string,
  CatalogThemeNormalizationRule
>([
  ['Airport', { primaryTheme: 'City', secondaryTheme: 'Airport' }],
  ['Arctic', { primaryTheme: 'City', secondaryTheme: 'Arctic' }],
  ['Avengers', { primaryTheme: 'Marvel', secondaryTheme: 'Avengers' }],
  ['Basic Set', { primaryTheme: 'Duplo', secondaryTheme: 'Basic Set' }],
  ['Batman', { primaryTheme: 'DC', secondaryTheme: 'Batman' }],
  ['Botanical Collection', { primaryTheme: 'Botanicals' }],
  ['Chinese (Lunar) New Year', { primaryTheme: 'Seasonal' }],
  ['Christmas', { primaryTheme: 'Seasonal', secondaryTheme: 'Christmas' }],
  ['Coast Guard', { primaryTheme: 'City', secondaryTheme: 'Coast Guard' }],
  [
    'Creator 3-in-1',
    { primaryTheme: 'Creator', secondaryTheme: 'Creator 3-in-1' },
  ],
  ['Easter', { primaryTheme: 'Seasonal', secondaryTheme: 'Easter' }],
  ['Editions', { primaryTheme: 'Editions' }],
  [
    'Educational and Dacta',
    { primaryTheme: 'Other', secondaryTheme: 'Educational and Dacta' },
  ],
  ['Frozen', { primaryTheme: 'Disney', secondaryTheme: 'Frozen' }],
  [
    'LEGO Exclusive',
    { primaryTheme: 'Other', secondaryTheme: 'LEGO Exclusive' },
  ],
  [
    'Learning at Home',
    { primaryTheme: 'Other', secondaryTheme: 'Learning at Home' },
  ],
  [
    'Legoland Parks',
    { primaryTheme: 'Other', secondaryTheme: 'Legoland Parks' },
  ],
  [
    'Modular Buildings',
    { primaryTheme: 'Icons', secondaryTheme: 'Modular Buildings' },
  ],
  ['Other', { primaryTheme: 'Other' }],
  ['Police', { primaryTheme: 'City', secondaryTheme: 'Police' }],
  ['Spider-Man', { primaryTheme: 'Marvel', secondaryTheme: 'Spider-Man' }],
  ['Skylines', { primaryTheme: 'Architecture', secondaryTheme: 'Skylines' }],
  [
    'Spidey and His Amazing Friends',
    {
      primaryTheme: 'Marvel',
      secondaryTheme: 'Spidey and His Amazing Friends',
    },
  ],
  ['Super Heroes DC', { primaryTheme: 'DC' }],
  ['Super Heroes Marvel', { primaryTheme: 'Marvel' }],
  ['The Botanical Collection', { primaryTheme: 'Botanicals' }],
  [
    'The Infinity Saga',
    { primaryTheme: 'Marvel', secondaryTheme: 'The Infinity Saga' },
  ],
  ['Toy Story', { primaryTheme: 'Disney', secondaryTheme: 'Toy Story' }],
  [
    'Ultimate Collector Series',
    {
      primaryTheme: 'Star Wars',
      secondaryTheme: 'Ultimate Collector Series',
    },
  ],
  [
    'Winnie the Pooh',
    { primaryTheme: 'Disney', secondaryTheme: 'Winnie the Pooh' },
  ],
  ['X-Men', { primaryTheme: 'Marvel', secondaryTheme: 'X-Men' }],
]);

const catalogParkedPrimaryThemes = new Set(['Other', 'Unknown']);

function canonicalizeCatalogThemeName(themeName: string): string {
  const normalizedThemeName = normalizeCatalogText(themeName);

  return (
    catalogCanonicalThemeNames.get(normalizedThemeName) ?? normalizedThemeName
  );
}

function getCatalogThemeNormalizationRule(
  themeName: string,
): CatalogThemeNormalizationRule | undefined {
  return catalogThemeNormalizationRulesByRawTheme.get(
    canonicalizeCatalogThemeName(themeName),
  );
}

function getResolvedCatalogPrimaryThemeName(themeName: string): string {
  const canonicalThemeName = canonicalizeCatalogThemeName(themeName);

  return (
    getCatalogThemeNormalizationRule(canonicalThemeName)?.primaryTheme ??
    canonicalThemeName
  );
}

function dedupeCatalogSecondaryThemes({
  primaryTheme,
  secondaryThemes,
}: CatalogThemeIdentity): readonly string[] {
  const seenThemes = new Set<string>();

  return secondaryThemes.filter((secondaryTheme) => {
    if (!secondaryTheme || secondaryTheme === primaryTheme) {
      return false;
    }

    if (seenThemes.has(secondaryTheme)) {
      return false;
    }

    seenThemes.add(secondaryTheme);

    return true;
  });
}

export function resolveCatalogThemeIdentity({
  parentTheme,
  rawTheme,
}: {
  parentTheme?: string;
  rawTheme: string;
}): CatalogThemeIdentity {
  const normalizedRawTheme = normalizeCatalogText(rawTheme);
  const rawThemeSegments = normalizedRawTheme
    .split('>')
    .map((segment) => canonicalizeCatalogThemeName(segment))
    .filter(Boolean);
  const canonicalRawTheme =
    rawThemeSegments.length > 0
      ? rawThemeSegments[rawThemeSegments.length - 1]
      : canonicalizeCatalogThemeName(normalizedRawTheme);
  const canonicalParentTheme = parentTheme
    ? getResolvedCatalogPrimaryThemeName(parentTheme)
    : undefined;
  const directThemeRule = getCatalogThemeNormalizationRule(canonicalRawTheme);

  if (!canonicalParentTheme && rawThemeSegments.length > 1) {
    const [rootSegment, ...nestedSegments] = rawThemeSegments;

    return resolveCatalogThemeIdentity({
      parentTheme: rootSegment,
      rawTheme: nestedSegments.join(' > '),
    });
  }

  if (directThemeRule) {
    return {
      primaryTheme: directThemeRule.primaryTheme,
      secondaryThemes: dedupeCatalogSecondaryThemes({
        primaryTheme: directThemeRule.primaryTheme,
        secondaryThemes: directThemeRule.secondaryTheme
          ? [directThemeRule.secondaryTheme]
          : [],
      }),
    };
  }

  if (
    canonicalParentTheme &&
    shouldMapThemeToParent({
      parentTheme: canonicalParentTheme,
      rawTheme: canonicalRawTheme,
    })
  ) {
    const secondaryThemes =
      rawThemeSegments.length > 1
        ? rawThemeSegments[0] === canonicalParentTheme
          ? rawThemeSegments.slice(1)
          : rawThemeSegments
        : canonicalRawTheme !== canonicalParentTheme
          ? [canonicalRawTheme]
          : [];

    return {
      primaryTheme: canonicalParentTheme,
      secondaryThemes: dedupeCatalogSecondaryThemes({
        primaryTheme: canonicalParentTheme,
        secondaryThemes,
      }),
    };
  }

  if (rawThemeSegments.length > 1) {
    const primaryTheme = rawThemeSegments[0];

    return {
      primaryTheme,
      secondaryThemes: dedupeCatalogSecondaryThemes({
        primaryTheme,
        secondaryThemes: rawThemeSegments.slice(1),
      }),
    };
  }

  return {
    primaryTheme: canonicalRawTheme,
    secondaryThemes: [],
  };
}

export function getCatalogPrimaryTheme({
  parentTheme,
  rawTheme,
}: {
  parentTheme?: string;
  rawTheme: string;
}): string {
  return resolveCatalogThemeIdentity({
    parentTheme,
    rawTheme,
  }).primaryTheme;
}

export function resolveCatalogThemeIdentityFromPersistence({
  legacyTheme,
  primaryThemeName,
  sourceThemeName,
}: {
  legacyTheme?: string;
  primaryThemeName?: string;
  sourceThemeName?: string;
}): CatalogThemeIdentity {
  const fallbackThemeName =
    legacyTheme ?? sourceThemeName ?? primaryThemeName ?? 'Unknown';

  if (!primaryThemeName) {
    return resolveCatalogThemeIdentity({
      rawTheme: fallbackThemeName,
    });
  }

  if (!sourceThemeName) {
    return resolveCatalogThemeIdentity({
      rawTheme: primaryThemeName,
    });
  }

  return resolveCatalogThemeIdentity({
    parentTheme: primaryThemeName,
    rawTheme: sourceThemeName,
  });
}

export function isCatalogBrowsablePrimaryTheme(themeName?: string): boolean {
  if (!themeName) {
    return false;
  }

  const primaryThemeName = getResolvedCatalogPrimaryThemeName(themeName);

  return (
    !catalogParkedPrimaryThemes.has(primaryThemeName) &&
    isThemeVisible(primaryThemeName)
  );
}

export function getCatalogThemeDefinition(
  themeName?: string,
): CatalogThemeDefinition | undefined {
  void themeName;
  return undefined;
}

function usesLightCatalogThemeText(textColor?: string): boolean {
  const normalizedTextColor = textColor?.trim().toLowerCase();

  return Boolean(
    normalizedTextColor &&
      [
        '#fff',
        '#ffffff',
        'white',
        'rgb(255, 255, 255)',
        'rgb(255,255,255)',
      ].includes(normalizedTextColor),
  );
}

export function getCatalogThemeMutedTextColor(textColor?: string): string {
  return usesLightCatalogThemeText(textColor) ? '#f4f7fb' : '#425066';
}

export function getCatalogThemeSurfaceTone(
  themeName?: string,
): 'dark' | 'light' {
  void themeName;
  return 'light';
}

function normalizeCatalogImageUrl(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalizedValue = value.trim().replace(/\\+$/g, '');

  return normalizedValue ? normalizedValue : undefined;
}

function toCatalogSetImageSeed(
  image: CatalogSetImageSeed,
): CatalogSetImage | undefined {
  if (typeof image === 'string') {
    const normalizedUrl = normalizeCatalogImageUrl(image);

    return normalizedUrl
      ? {
          url: normalizedUrl,
        }
      : undefined;
  }

  const normalizedUrl = normalizeCatalogImageUrl(image.url);
  const normalizedThumbnailUrl = normalizeCatalogImageUrl(image.thumbnailUrl);

  if (!normalizedUrl) {
    return undefined;
  }

  return {
    ...(image.attributionText
      ? {
          attributionText: image.attributionText,
        }
      : {}),
    ...(typeof image.order === 'number' ? { order: image.order } : {}),
    ...(normalizedThumbnailUrl
      ? {
          thumbnailUrl: normalizedThumbnailUrl,
        }
      : {}),
    ...(image.type
      ? {
          type: image.type,
        }
      : {}),
    url: normalizedUrl,
  };
}

export function normalizeCatalogSetImages({
  imageUrl,
  images,
  primaryImage,
}: {
  imageUrl?: string;
  images?: readonly CatalogSetImageSeed[];
  primaryImage?: string;
}): {
  imageUrl?: string;
  images?: readonly CatalogSetImage[];
  primaryImage?: string;
} {
  const normalizedPrimaryImage = normalizeCatalogImageUrl(primaryImage);
  const normalizedImageUrl = normalizeCatalogImageUrl(imageUrl);
  const seededImages = [
    ...(normalizedPrimaryImage
      ? [
          {
            order: 0,
            type: 'hero' as const,
            url: normalizedPrimaryImage,
          },
        ]
      : []),
    ...(images ?? []),
    ...(normalizedImageUrl ? [normalizedImageUrl] : []),
  ];

  if (seededImages.length === 0) {
    return {
      ...(normalizedImageUrl
        ? {
            imageUrl: normalizedImageUrl,
          }
        : {}),
      ...(normalizedPrimaryImage
        ? {
            primaryImage: normalizedPrimaryImage,
          }
        : {}),
    };
  }

  const normalizedImagesByUrl = new Map<
    string,
    CatalogSetImage & { insertionIndex: number; isPrimary: boolean }
  >();

  seededImages.forEach((catalogSetImageSeed, index) => {
    const normalizedCatalogSetImage =
      toCatalogSetImageSeed(catalogSetImageSeed);

    if (!normalizedCatalogSetImage) {
      return;
    }

    const existingCatalogSetImage = normalizedImagesByUrl.get(
      normalizedCatalogSetImage.url,
    );

    if (!existingCatalogSetImage) {
      normalizedImagesByUrl.set(normalizedCatalogSetImage.url, {
        ...normalizedCatalogSetImage,
        insertionIndex: index,
        isPrimary: normalizedCatalogSetImage.url === normalizedPrimaryImage,
      });

      return;
    }

    normalizedImagesByUrl.set(normalizedCatalogSetImage.url, {
      insertionIndex: Math.min(existingCatalogSetImage.insertionIndex, index),
      isPrimary:
        existingCatalogSetImage.isPrimary ||
        normalizedCatalogSetImage.url === normalizedPrimaryImage,
      attributionText:
        existingCatalogSetImage.attributionText ??
        normalizedCatalogSetImage.attributionText,
      order:
        typeof existingCatalogSetImage.order === 'number'
          ? existingCatalogSetImage.order
          : normalizedCatalogSetImage.order,
      thumbnailUrl:
        existingCatalogSetImage.thumbnailUrl ??
        normalizedCatalogSetImage.thumbnailUrl,
      type: existingCatalogSetImage.type ?? normalizedCatalogSetImage.type,
      url: normalizedCatalogSetImage.url,
    });
  });

  const normalizedImages = [...normalizedImagesByUrl.values()]
    .sort(
      (left, right) =>
        Number(right.isPrimary) - Number(left.isPrimary) ||
        Number(right.type === 'hero') - Number(left.type === 'hero') ||
        (left.order ?? Number.MAX_SAFE_INTEGER) -
          (right.order ?? Number.MAX_SAFE_INTEGER) ||
        left.insertionIndex - right.insertionIndex,
    )
    .map((catalogSetImage, index) => ({
      order:
        typeof catalogSetImage.order === 'number'
          ? catalogSetImage.order
          : index,
      ...(catalogSetImage.attributionText
        ? {
            attributionText: catalogSetImage.attributionText,
          }
        : {}),
      ...(catalogSetImage.thumbnailUrl
        ? {
            thumbnailUrl: catalogSetImage.thumbnailUrl,
          }
        : {}),
      ...(catalogSetImage.type
        ? {
            type: catalogSetImage.type,
          }
        : index === 0
          ? {
              type: 'hero' as const,
            }
          : {}),
      url: catalogSetImage.url,
    }));

  const resolvedPrimaryImage =
    normalizedPrimaryImage ?? normalizedImages[0]?.url;

  return {
    ...(resolvedPrimaryImage
      ? {
          imageUrl: resolvedPrimaryImage,
          primaryImage: resolvedPrimaryImage,
        }
      : {}),
    ...(normalizedImages.length
      ? {
          images: normalizedImages,
        }
      : {}),
  };
}

function stripCatalogDiacritics(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeCatalogAsciiText(value: string): string {
  return stripCatalogDiacritics(normalizeCatalogText(value));
}

function buildCatalogSlugBase({
  canonicalId,
  name,
  stripDiacritics,
}: {
  canonicalId: string;
  name: string;
  stripDiacritics: boolean;
}): string {
  const normalizedName = (
    stripDiacritics ? normalizeCatalogAsciiText(name) : name
  )
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${normalizedName}-${canonicalId}`;
}

export function getCanonicalCatalogSetId(sourceSetNumber: string): string {
  return normalizeCatalogSetId(sourceSetNumber);
}

export function buildCatalogSetSlug(name: string, canonicalId: string): string {
  return buildCatalogSlugBase({
    canonicalId,
    name,
    stripDiacritics: true,
  });
}

export function buildCatalogThemeSlug(themeName: string): string {
  const registryTheme = normalizeTheme(themeName);

  if (registryTheme) {
    return registryTheme.key;
  }

  return normalizeCatalogAsciiText(
    getCatalogPrimaryTheme({ rawTheme: themeName }),
  )
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getCatalogProductSlug({
  catalogSetRecord,
  catalogSetOverlay,
}: {
  catalogSetRecord: CatalogSetRecord;
  catalogSetOverlay?: Pick<CatalogSetOverlay, 'productSlug'>;
}): string {
  return catalogSetOverlay?.productSlug ?? catalogSetRecord.slug;
}

export function createCatalogSetRecord(
  catalogSetSeed: CatalogSetSeed,
): CatalogSetRecord {
  const normalizedSourceSetNumber = normalizeCatalogText(
    catalogSetSeed.sourceSetNumber,
  );
  const canonicalId = getCanonicalCatalogSetId(normalizedSourceSetNumber);
  const catalogSetImages = normalizeCatalogSetImages({
    imageUrl: catalogSetSeed.imageUrl,
    images: catalogSetSeed.images,
    primaryImage: catalogSetSeed.primaryImage,
  });
  const hasExplicitGalleryImages = Boolean(
    catalogSetSeed.primaryImage || catalogSetSeed.images?.length,
  );

  return {
    canonicalId,
    sourceSetNumber: normalizedSourceSetNumber,
    slug: buildCatalogSetSlug(catalogSetSeed.name, canonicalId),
    name: normalizeCatalogText(catalogSetSeed.name),
    theme: getCatalogPrimaryTheme({
      rawTheme: catalogSetSeed.theme,
    }),
    releaseYear: catalogSetSeed.releaseYear,
    ...(catalogSetSeed.releaseDate
      ? {
          releaseDate: catalogSetSeed.releaseDate,
        }
      : {}),
    ...(catalogSetSeed.releaseDate || catalogSetSeed.releaseDatePrecision
      ? {
          releaseDatePrecision: resolveCatalogReleaseDatePrecision({
            releaseDate: catalogSetSeed.releaseDate,
            releaseDatePrecision: catalogSetSeed.releaseDatePrecision,
            releaseYear: catalogSetSeed.releaseYear,
          }),
        }
      : {}),
    pieces: catalogSetSeed.pieces,
    imageUrl: catalogSetImages.imageUrl,
    ...(hasExplicitGalleryImages && catalogSetImages.images
      ? {
          images: catalogSetImages.images,
        }
      : {}),
    ...(hasExplicitGalleryImages && catalogSetImages.primaryImage
      ? {
          primaryImage: catalogSetImages.primaryImage,
        }
      : {}),
  };
}

function renderCatalogGeneratedModule<
  T extends CatalogSnapshot | CatalogSyncManifest | CatalogPopularitySnapshot,
>({
  generatedBy = 'apps/catalog-sync',
  exportName,
  importName,
  payload,
}: {
  generatedBy?: string;
  exportName:
    | 'catalogSnapshot'
    | 'catalogSyncManifest'
    | 'catalogPopularitySnapshot';
  importName:
    | 'CatalogSnapshot'
    | 'CatalogSyncManifest'
    | 'CatalogPopularitySnapshot';
  payload: T;
}): string {
  const payloadVariableName = `${exportName}Payload`;

  return `import type { ${importName} } from '@lego-platform/catalog/util';

// Generated by ${generatedBy}. Do not edit by hand.
const ${payloadVariableName} = String.raw\`${JSON.stringify(payload, null, 2)}\`;

export const ${exportName}: ${importName} = JSON.parse(
  ${payloadVariableName},
) as ${importName};
`;
}

export function renderCatalogSnapshotModule(
  catalogSnapshot: CatalogSnapshot,
): string {
  return renderCatalogGeneratedModule({
    exportName: 'catalogSnapshot',
    importName: 'CatalogSnapshot',
    payload: catalogSnapshot,
  });
}

export function renderCatalogSyncManifestModule(
  catalogSyncManifest: CatalogSyncManifest,
): string {
  return renderCatalogGeneratedModule({
    exportName: 'catalogSyncManifest',
    importName: 'CatalogSyncManifest',
    payload: catalogSyncManifest,
  });
}

export function renderCatalogPopularitySnapshotModule(
  catalogPopularitySnapshot: CatalogPopularitySnapshot,
): string {
  return renderCatalogGeneratedModule({
    generatedBy: 'apps/catalog-popularity-sync',
    exportName: 'catalogPopularitySnapshot',
    importName: 'CatalogPopularitySnapshot',
    payload: catalogPopularitySnapshot,
  });
}

export function sortCatalogSetSummaries(
  setSummaries: readonly CatalogSetSummary[],
): CatalogSetSummary[] {
  return [...setSummaries].sort(
    (left, right) =>
      (getCatalogReleaseYear({
        releaseDate: right.releaseDate,
        releaseYear: right.releaseYear,
      }) ?? 0) -
        (getCatalogReleaseYear({
          releaseDate: left.releaseDate,
          releaseYear: left.releaseYear,
        }) ?? 0) || left.name.localeCompare(right.name),
  );
}

export function sortCanonicalCatalogSets(
  canonicalCatalogSets: readonly CatalogCanonicalSet[],
): CatalogCanonicalSet[] {
  return [...canonicalCatalogSets].sort(
    (left, right) =>
      (getCatalogReleaseYear({
        releaseDate: right.releaseDate,
        releaseYear: right.releaseYear,
      }) ?? 0) -
        (getCatalogReleaseYear({
          releaseDate: left.releaseDate,
          releaseYear: left.releaseYear,
        }) ?? 0) || left.name.localeCompare(right.name),
  );
}

export function mergeCanonicalCatalogSets({
  fallbackSets,
  preferredSets,
}: {
  fallbackSets: readonly CatalogCanonicalSet[];
  preferredSets: readonly CatalogCanonicalSet[];
}): CatalogCanonicalSet[] {
  const preferredSetIds = new Set(
    preferredSets.map((canonicalCatalogSet) => canonicalCatalogSet.setId),
  );
  const preferredSlugs = new Set(
    preferredSets.map((canonicalCatalogSet) => canonicalCatalogSet.slug),
  );

  return [
    ...preferredSets,
    ...fallbackSets.filter(
      (canonicalCatalogSet) =>
        !preferredSetIds.has(canonicalCatalogSet.setId) &&
        !preferredSlugs.has(canonicalCatalogSet.slug),
    ),
  ];
}

export function buildCatalogMetrics(
  setSummaries: readonly CatalogSetSummary[],
): MetricCard[] {
  const pieceCount = setSummaries.reduce(
    (total, setSummary) => total + setSummary.pieces,
    0,
  );

  return [
    {
      label: 'Gevolgde sets',
      value: String(setSummaries.length),
      detail: 'Samengestelde vlaggenschipselectie',
    },
    {
      label: 'Geindexeerde steentjes',
      value: formatCompactNumber(pieceCount),
      detail: 'Verspreid over uitgelichte catalogusitems',
    },
    {
      label: 'Nieuwste release',
      value: String(
        Math.max(
          ...setSummaries.map(
            (setSummary) =>
              getCatalogReleaseYear({
                releaseDate: setSummary.releaseDate,
                releaseYear: setSummary.releaseYear,
              }) ?? 0,
          ),
        ),
      ),
      detail: 'Laatste verzamelklare lancering',
      tone: 'accent',
    },
  ];
}
