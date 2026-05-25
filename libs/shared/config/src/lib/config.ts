type ValueOf<T> = T[keyof T];

export const appLanguageConfigs = {
  nl: {
    code: 'nl',
    displayName: 'Nederlands',
    htmlLang: 'nl',
  },
} as const;

export const appMarketConfigs = {
  NL: {
    code: 'NL',
    displayName: 'Nederlandse markt',
    adjectiveName: 'Nederlandse',
    currencyCode: 'EUR',
    formattingLocale: 'nl-NL',
    merchantRegionCode: 'NL',
  },
} as const;

export type AppLanguageCode = keyof typeof appLanguageConfigs;
export type AppMarketCode = keyof typeof appMarketConfigs;
export type AppCurrencyCode = ValueOf<typeof appMarketConfigs>['currencyCode'];
export type AppLocaleCode = `${AppLanguageCode}-${Lowercase<AppMarketCode>}`;
export type AppRouteLocalePrefixStrategy = 'never' | 'always';

export interface AppLocaleContext {
  currencyCode: AppCurrencyCode;
  formattingLocale: string;
  htmlLang: string;
  languageCode: AppLanguageCode;
  localeCode: AppLocaleCode;
  marketAdjectiveName: string;
  marketCode: AppMarketCode;
  marketDisplayName: string;
  merchantRegionCode: string;
  routeSegment: string;
}

export const DEFAULT_APP_LANGUAGE_CODE: AppLanguageCode = 'nl';
export const DEFAULT_APP_MARKET_CODE: AppMarketCode = 'NL';

export const platformConfig = {
  workspaceName: 'lego-platform',
  productName: 'Brickhunt',
  tagline: 'LEGO sets vergelijken, ontdekken en slimmer kopen.',
  defaultThemeMode: 'light',
  supportEmail: 'hello@brickhunt.nl',
  experience: {
    defaultLanguageCode: DEFAULT_APP_LANGUAGE_CODE,
    defaultMarketCode: DEFAULT_APP_MARKET_CODE,
    routeLocalePrefixStrategy: 'never' as AppRouteLocalePrefixStrategy,
    supportedLanguageCodes: [DEFAULT_APP_LANGUAGE_CODE],
    supportedMarketCodes: [DEFAULT_APP_MARKET_CODE],
  },
  runtimes: {
    web: {
      port: 3000,
      baseUrl: 'http://localhost:3000',
    },
    admin: {
      port: 4200,
      baseUrl: 'http://localhost:4200',
    },
    api: {
      port: 3333,
      baseUrl: 'http://localhost:3333',
    },
  },
  integrations: [
    'Contentful',
    'Supabase',
    'Affiliate feeds',
    'Pricing history',
    'Native clients',
  ],
} as const;

export function resolvePublicMerchantDisplayName({
  merchantName,
  merchantSlug,
}: {
  merchantName: string;
  merchantSlug?: string | null;
}): string {
  const normalizedMerchantSlug = merchantSlug?.trim().toLowerCase();
  const normalizedMerchantName = merchantName.trim();

  if (
    normalizedMerchantSlug === 'rakuten-lego-eu' ||
    normalizedMerchantName.toLowerCase() === 'lego eu'
  ) {
    return 'LEGO®';
  }

  return normalizedMerchantName || merchantName;
}

export function buildPublicSiteRobotsPolicy({
  allowIndexing,
}: {
  allowIndexing: boolean;
}) {
  const blockedMeta = {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  } as const;

  return {
    allowIndexing,
    meta: allowIndexing ? undefined : blockedMeta,
    robotsTxt: allowIndexing
      ? {
          userAgent: '*',
          disallow: [
            '/api/',
            '/admin/',
            '/account/',
            '/auth/',
            '/search',
            '/volgt',
            '/*?*sort=',
            '/*?*filter=',
            '/*?*utm_',
            '/*?*ref=',
            '/*?*affiliate=',
          ],
        }
      : {
          userAgent: '*',
          disallow: '/',
        },
  } as const;
}

export const publicSiteIndexingEnvKeys = {
  allowIndexing: 'BRICKHUNT_ALLOW_INDEXING',
} as const;

export const legoNlDisplayTitleEnvKeys = {
  enabled: 'ENABLE_LEGO_NL_DISPLAY_TITLES',
} as const;

const canonicalProductionHost = 'www.brickhunt.nl';
const productionEnvironmentNames = new Set(['production', 'prod']);

function isTrueEnvValue(value?: string): boolean {
  return value?.trim().toLowerCase() === 'true';
}

function getEnvironmentHostname(value?: string): string | undefined {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return undefined;
  }

  try {
    return new URL(
      trimmedValue.startsWith('http')
        ? trimmedValue
        : `https://${trimmedValue}`,
    ).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function isCanonicalProductionIndexingEnvironment(
  environment: Record<string, string | undefined>,
): boolean {
  const vercelEnvironment = environment['VERCEL_ENV']?.trim().toLowerCase();

  if (vercelEnvironment && vercelEnvironment !== 'production') {
    return false;
  }

  const deploymentEnvironment = (
    environment['BRICKHUNT_DEPLOY_ENV'] ?? vercelEnvironment
  )
    ?.trim()
    .toLowerCase();
  const isProductionEnvironment =
    deploymentEnvironment !== undefined &&
    productionEnvironmentNames.has(deploymentEnvironment);

  if (!isProductionEnvironment) {
    return false;
  }

  const deploymentHostnames = [
    environment['BRICKHUNT_CANONICAL_HOST'],
    environment['WEB_BASE_URL'],
    environment['NEXT_PUBLIC_WEB_BASE_URL'],
    environment['NEXT_PUBLIC_SITE_URL'],
    environment['VERCEL_PROJECT_PRODUCTION_URL'],
  ].flatMap((value) => {
    const hostname = getEnvironmentHostname(value);

    return hostname ? [hostname] : [];
  });

  return deploymentHostnames.includes(canonicalProductionHost);
}

export function resolvePublicSiteAllowIndexing(
  environment: Record<string, string | undefined> = getRuntimeEnvironment(),
): boolean {
  return (
    isTrueEnvValue(environment[publicSiteIndexingEnvKeys.allowIndexing]) &&
    isCanonicalProductionIndexingEnvironment(environment)
  );
}

export function isLegoNlDisplayTitleEnrichmentEnabled(
  environment: Record<string, string | undefined> = getRuntimeEnvironment(),
): boolean {
  return isTrueEnvValue(environment[legoNlDisplayTitleEnvKeys.enabled]);
}

export const publicSiteRobotsPolicy = buildPublicSiteRobotsPolicy({
  allowIndexing: resolvePublicSiteAllowIndexing(),
});

export type PublicPageIndexabilityReason =
  | 'global-blocked'
  | 'non-public-route'
  | 'redirect-route'
  | 'preview-route'
  | 'page-noindex'
  | 'tracked-url'
  | 'page-one'
  | 'unintended-pagination'
  | 'thin-page';

export interface PublicPageRobotsDirective {
  follow: boolean;
  googleBot: {
    follow: boolean;
    index: boolean;
  };
  index: boolean;
}

const nonPublicIndexPathPrefixes = ['/api/', '/admin/', '/account/', '/auth/'];
const nonPublicIndexPathnames = new Set(['/account', '/search', '/volgt']);
const redirectOnlyIndexPathnames = new Set([
  '/collection',
  '/discover',
  '/wishlist',
]);
const trackedUrlSearchParamPrefixes = ['utm_'];
const trackedUrlSearchParamNames = new Set([
  'affiliate',
  'filter',
  'ref',
  'sort',
]);

function getPageIndexabilityUrl(pathnameOrUrl: string | URL): URL {
  return pathnameOrUrl instanceof URL
    ? pathnameOrUrl
    : new URL(pathnameOrUrl, publicWebBaseUrls.production);
}

export function getPageIndexabilityReason({
  allowIndexing = publicSiteRobotsPolicy.allowIndexing,
  isPreview = false,
  isRedirect = false,
  isThin = false,
  pageRobotsNoIndex = false,
  paginationIntended = false,
  pathname,
  seoNoIndex = false,
}: {
  allowIndexing?: boolean;
  isPreview?: boolean;
  isRedirect?: boolean;
  isThin?: boolean;
  pageRobotsNoIndex?: boolean;
  paginationIntended?: boolean;
  pathname: string | URL;
  seoNoIndex?: boolean;
}): PublicPageIndexabilityReason | undefined {
  if (!allowIndexing) {
    return 'global-blocked';
  }

  const url = getPageIndexabilityUrl(pathname);
  const normalizedPathname = normalizePathname(url.pathname);

  if (
    nonPublicIndexPathnames.has(normalizedPathname) ||
    nonPublicIndexPathPrefixes.some((prefix) =>
      normalizedPathname.startsWith(prefix),
    )
  ) {
    return 'non-public-route';
  }

  if (isRedirect || redirectOnlyIndexPathnames.has(normalizedPathname)) {
    return 'redirect-route';
  }

  if (isPreview || normalizedPathname.startsWith('/artikelen/preview/')) {
    return 'preview-route';
  }

  if (pageRobotsNoIndex || seoNoIndex) {
    return 'page-noindex';
  }

  for (const paramName of url.searchParams.keys()) {
    if (
      trackedUrlSearchParamNames.has(paramName) ||
      trackedUrlSearchParamPrefixes.some((prefix) =>
        paramName.startsWith(prefix),
      )
    ) {
      return 'tracked-url';
    }
  }

  const page = url.searchParams.get('page');

  if (page === '1') {
    return 'page-one';
  }

  if (page && !paginationIntended) {
    return 'unintended-pagination';
  }

  if (isThin) {
    return 'thin-page';
  }

  return undefined;
}

export function isIndexablePage(
  input: Parameters<typeof getPageIndexabilityReason>[0],
): boolean {
  return getPageIndexabilityReason(input) === undefined;
}

export function getPublicPageRobotsDirective(
  input: Parameters<typeof getPageIndexabilityReason>[0],
): PublicPageRobotsDirective {
  const indexable = isIndexablePage(input);

  return {
    follow: indexable,
    googleBot: {
      follow: indexable,
      index: indexable,
    },
    index: indexable,
  };
}

export type RuntimeName = keyof typeof platformConfig.runtimes;

export const webPathnames = {
  home: '/',
  articles: '/artikelen',
  deals: '/deals',
  themes: '/themes',
  search: '/search',
  following: '/volgt',
  account: '/account',
  affiliateDisclosure: '/affiliate-disclosure',
  collection: '/account/collection',
  contact: '/contact',
  cookiePolicy: '/cookiebeleid',
  wishlist: '/account/wishlist',
  privacy: '/privacy',
  sets: '/sets',
  pages: '/pages',
} as const;

export const PUBLIC_ARTICLE_CONTENT_MINIMUM = 5;
export const HAS_PUBLIC_ARTICLE_CONTENT = false;

export function hasPublicArticleContent(articleCount: number): boolean {
  return (
    HAS_PUBLIC_ARTICLE_CONTENT || articleCount >= PUBLIC_ARTICLE_CONTENT_MINIMUM
  );
}

const webNavigationItems = [
  {
    label: 'Nieuws',
    pathname: webPathnames.articles,
  },
  {
    href: buildWebPath(webPathnames.deals),
    label: 'Deals',
    pathname: webPathnames.deals,
  },
  {
    label: "Thema's",
    pathname: webPathnames.themes,
  },
] as const;

export const apiPaths = {
  session: '/api/v1/session',
  profile: '/api/v1/me/profile',
  catalogSets: '/api/v1/catalog/sets',
  catalogDiscoverySignals: '/api/v1/catalog/discovery-signals',
  catalogCurrentOfferSummaries: '/api/v1/catalog/current-offer-summaries',
  wishlistAlertsViewed: '/api/v1/me/profile/wishlist-alerts/viewed',
  ownedSets: '/api/v1/me/owned-sets',
  wantedSets: '/api/v1/me/wanted-sets',
  adminCatalogSets: '/api/v1/admin/catalog/sets',
  adminCatalogSetSearch: '/api/v1/admin/catalog/search',
  adminCatalogSuggestedSets: '/api/v1/admin/catalog/suggested-sets',
  adminCatalogBulkOnboardingRuns: '/api/v1/admin/catalog/bulk-onboarding/runs',
  adminRuntimeConfig: '/api/v1/admin/runtime-config',
  adminArticles: '/api/v1/admin/articles',
  adminArticlesPreview: '/api/v1/admin/articles/preview',
  adminEditorialAgentExtract: '/api/v1/admin/editorial-agent/extract',
  adminEditorialAgentDraft: '/api/v1/admin/editorial-agent/draft',
  adminEditorialAgentFeedItems: '/api/v1/admin/editorial-agent/feed-items',
  adminEditorialAgentFeedSync: '/api/v1/admin/editorial-agent/feed-sync',
  adminEditorialAgentHeroImage: '/api/v1/admin/editorial-agent/hero-image',
  adminEditorialAgentArticleImage:
    '/api/v1/admin/editorial-agent/article-image',
  adminEditorialAgentHeroImageUrl:
    '/api/v1/admin/editorial-agent/hero-image-url',
  adminEditorialAgentPublish: '/api/v1/admin/editorial-agent/publish',
  articles: '/articles',
  adminCommerceMerchants: '/api/v1/admin/commerce/merchants',
  adminCommerceOfferSeeds: '/api/v1/admin/commerce/offer-seeds',
  adminCommerceBenchmarkSets: '/api/v1/admin/commerce/benchmark-sets',
  adminCommerceCoverageQueue: '/api/v1/admin/commerce/coverage-queue',
  adminCommerceSetRefreshes: '/api/v1/admin/commerce/set-refreshes',
  adminCommerceProductionSync: '/api/v1/admin/commerce/production-sync',
  adminCommerceAlternateFeedImports:
    '/api/v1/admin/commerce/alternate-feed/import',
  adminCommerceAffiliateDiscoveredSets:
    '/api/v1/admin/commerce/affiliate-discovered-sets',
  adminCatalogPromotion: '/api/admin/promote/catalog',
  adminCacheRevalidation: '/api/admin/cache/revalidate',
} as const;

export function buildCatalogSetLiveOffersApiPath(setId: string): string {
  return `${apiPaths.catalogSets}/${encodeURIComponent(setId)}/live-offers`;
}

export function buildCatalogDiscoverySignalsApiPath(
  setIds: readonly string[] = [],
): string {
  if (!setIds.length) {
    return apiPaths.catalogDiscoverySignals;
  }

  const queryParams = new URLSearchParams({
    setIds: [...new Set(setIds)].join(','),
  });

  return `${apiPaths.catalogDiscoverySignals}?${queryParams.toString()}`;
}

export function buildCatalogCurrentOfferSummariesApiPath(
  setIds: readonly string[] = [],
): string {
  if (!setIds.length) {
    return apiPaths.catalogCurrentOfferSummaries;
  }

  const queryParams = new URLSearchParams({
    setIds: [...new Set(setIds)].join(','),
  });

  return `${apiPaths.catalogCurrentOfferSummaries}?${queryParams.toString()}`;
}

export const supabaseEnvKeys = {
  browserUrl: 'NEXT_PUBLIC_SUPABASE_URL',
  browserAnonKey: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  serverUrl: 'SUPABASE_URL',
  serverServiceRoleKey: 'SUPABASE_SERVICE_ROLE_KEY',
} as const;

export const stagingSupabaseEnvKeys = {
  url: 'SUPABASE_URL_STAGING',
  serviceRoleKey: 'SUPABASE_SERVICE_ROLE_KEY_STAGING',
} as const;

export const productionSupabaseEnvKeys = {
  url: 'SUPABASE_URL_PRODUCTION',
  serviceRoleKey: 'SUPABASE_SERVICE_ROLE_KEY_PRODUCTION',
} as const;

export const adminPromotionEnvKeys = {
  secret: 'ADMIN_PROMOTE_SECRET',
} as const;

export const adminCacheRevalidationEnvKeys = {
  secret: 'ADMIN_CACHE_REVALIDATE_SECRET',
} as const;

export const productEmailEnvKeys = {
  resendApiKey: 'RESEND_API_KEY',
  resendFromEmail: 'RESEND_FROM_EMAIL',
  resendFromName: 'RESEND_FROM_NAME',
  webBaseUrl: 'WEB_BASE_URL',
} as const;

export const publicWebRevalidationEnvKeys = {
  secret: 'WEB_REVALIDATE_SECRET',
} as const;

export const rebrickableEnvKeys = {
  apiKey: 'REBRICKABLE_API_KEY',
  baseUrl: 'REBRICKABLE_BASE_URL',
} as const;

export const editorialAgentAiEnvKeys = {
  apiKey: 'OPENAI_API_KEY',
  model: 'OPENAI_EDITORIAL_REWRITE_MODEL',
} as const;

export const editorialAgentFeedEnvKeys = {
  feeds: 'EDITORIAL_AGENT_RSS_FEEDS',
} as const;

export const articlePreviewEnvKeys = {
  enabled: 'ARTICLE_PREVIEW_ENABLED',
} as const;

export const tradeTrackerEnvKeys = {
  customerId: 'TRADETRACKER_CUSTOMER_ID',
  passphrase: 'TRADETRACKER_PASSPHRASE',
  affiliateSiteId: 'TRADETRACKER_AFFILIATE_SITE_ID',
  alternateFeedId: 'TRADETRACKER_ALTERNATE_FEED_ID',
  alternateCampaignId: 'TRADETRACKER_ALTERNATE_CAMPAIGN_ID',
} as const;

export const tradeTrackerLidlEnvKeys = {
  feedUrl: 'TRADETRACKER_LIDL_FEED_URL',
  merchantSlug: 'TRADETRACKER_LIDL_MERCHANT_SLUG',
  merchantName: 'TRADETRACKER_LIDL_MERCHANT_NAME',
} as const;

export const tradeTrackerCoppenswarenhuisEnvKeys = {
  feedUrl: 'TRADETRACKER_COPPENSWARENHUIS_FEED_URL',
  merchantSlug: 'TRADETRACKER_COPPENSWARENHUIS_MERCHANT_SLUG',
  merchantName: 'TRADETRACKER_COPPENSWARENHUIS_MERCHANT_NAME',
} as const;

export const tradeTrackerConradEnvKeys = {
  feedUrl: 'TRADETRACKER_CONRAD_FEED_URL',
  merchantSlug: 'TRADETRACKER_CONRAD_MERCHANT_SLUG',
  merchantName: 'TRADETRACKER_CONRAD_MERCHANT_NAME',
} as const;

export const awinCoolblueEnvKeys = {
  feedUrl: 'AWIN_COOLBLUE_FEED_URL',
  merchantSlug: 'AWIN_COOLBLUE_MERCHANT_SLUG',
  merchantName: 'AWIN_COOLBLUE_MERCHANT_NAME',
} as const;

export const awinJoybuyEnvKeys = {
  feedUrl: 'AWIN_JOYBUY_FEED_URL',
  merchantSlug: 'AWIN_JOYBUY_MERCHANT_SLUG',
  merchantName: 'AWIN_JOYBUY_MERCHANT_NAME',
} as const;

export const adtractionGoodbricksEnvKeys = {
  feedUrl: 'ADTRACTION_GOODBRICKS_FEED_URL',
  merchantSlug: 'ADTRACTION_GOODBRICKS_MERCHANT_SLUG',
  merchantName: 'ADTRACTION_GOODBRICKS_MERCHANT_NAME',
} as const;

export const tradeDoublerMediaMarktEnvKeys = {
  feedUrl: 'TRADEDOUBLER_MEDIAMARKT_FEED_URL',
  merchantSlug: 'TRADEDOUBLER_MEDIAMARKT_MERCHANT_SLUG',
  merchantName: 'TRADEDOUBLER_MEDIAMARKT_MERCHANT_NAME',
} as const;

export const misterBricksEnvKeys = {
  feedUrl: 'MISTERBRICKS_FEED_URL',
  merchantSlug: 'MISTERBRICKS_MERCHANT_SLUG',
  merchantName: 'MISTERBRICKS_MERCHANT_NAME',
} as const;

export const rakutenLegoEnvKeys = {
  enablePhaseOneImport: 'RAKUTEN_LEGO_PHASE1_IMPORT_ENABLED',
  host: 'RAKUTEN_LEGO_FEED_HOST',
  port: 'RAKUTEN_LEGO_FEED_PORT',
  username: 'RAKUTEN_LEGO_FEED_USERNAME',
  password: 'RAKUTEN_LEGO_FEED_PASSWORD',
  sid: 'RAKUTEN_LEGO_FEED_SID',
  mid: 'RAKUTEN_LEGO_FEED_MID',
  filename: 'RAKUTEN_LEGO_FEED_FILENAME',
  remoteDir: 'RAKUTEN_LEGO_REMOTE_DIR',
  merchantSlug: 'RAKUTEN_LEGO_MERCHANT_SLUG',
  merchantName: 'RAKUTEN_LEGO_MERCHANT_NAME',
} as const;

export const rakutenLegoDefaultNlFeedFilename =
  '/GLOBAL/NL-NL_EUR/50641_4682248_mp_NL-NL_EUR.xml.gz';

export interface BrowserSupabaseConfig {
  anonKey: string;
  url: string;
}

export interface ServerSupabaseConfig {
  serviceRoleKey: string;
  url: string;
}

export interface StagingSupabaseConfig {
  serviceRoleKey: string;
  url: string;
}

export interface ProductionSupabaseConfig {
  serviceRoleKey: string;
  url: string;
}

export interface AdminPromotionConfig {
  secret: string;
}

export interface ProductEmailConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  webBaseUrl: string;
}

export interface PublicWebRevalidationConfig {
  secret: string;
  webBaseUrl: string;
}

export interface RebrickableApiConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface TradeTrackerAffiliateConfig {
  affiliateSiteId?: number;
  alternateCampaignId?: number;
  alternateFeedId?: number;
  customerId: number;
  passphrase: string;
}

export interface TradeTrackerLidlFeedConfig {
  feedUrl: string;
  merchantName: string;
  merchantSlug: string;
}

export interface TradeTrackerCoppenswarenhuisFeedConfig {
  feedUrl: string;
  merchantName: string;
  merchantSlug: string;
}

export interface TradeTrackerConradFeedConfig {
  feedUrl: string;
  merchantName: string;
  merchantSlug: string;
}

export interface AwinCoolblueFeedConfig {
  feedUrl: string;
  merchantName: string;
  merchantSlug: string;
}

export interface AwinJoybuyFeedConfig {
  feedUrl: string;
  merchantName: string;
  merchantSlug: string;
}

export interface AdtractionGoodbricksFeedConfig {
  feedUrl: string;
  merchantName: string;
  merchantSlug: string;
}

export interface TradeDoublerMediaMarktFeedConfig {
  feedUrl: string;
  merchantName: string;
  merchantSlug: string;
}

export interface MisterBricksFeedConfig {
  feedUrl: string;
  merchantName: string;
  merchantSlug: string;
}

export interface RakutenLegoFeedConfig {
  enablePhaseOneImport: boolean;
  filename?: string;
  host: string;
  merchantName: string;
  merchantSlug: string;
  mid?: string;
  password: string;
  port: number;
  remoteDir?: string;
  sid: string;
  username: string;
}

function getRuntimeEnvironment(): Record<string, string | undefined> {
  return typeof process === 'undefined' ? {} : process.env;
}

export function isArticlePreviewEnabled(
  environment: Record<string, string | undefined> = getRuntimeEnvironment(),
): boolean {
  return (
    environment[articlePreviewEnvKeys.enabled]?.trim().toLowerCase() === 'true'
  );
}

function normalizePathname(pathname: string): string {
  if (!pathname) {
    return '/';
  }

  if (pathname === '/') {
    return pathname;
  }

  const withLeadingSlash = pathname.startsWith('/') ? pathname : `/${pathname}`;

  return withLeadingSlash.replace(/\/+$/, '') || '/';
}

export function createLocaleCode({
  languageCode,
  marketCode,
}: {
  languageCode: AppLanguageCode;
  marketCode: AppMarketCode;
}): AppLocaleCode {
  return `${languageCode}-${marketCode.toLowerCase()}` as AppLocaleCode;
}

export function getDefaultAppLocaleContext(): AppLocaleContext {
  const languageConfig =
    appLanguageConfigs[platformConfig.experience.defaultLanguageCode];
  const marketConfig =
    appMarketConfigs[platformConfig.experience.defaultMarketCode];
  const localeCode = createLocaleCode({
    languageCode: languageConfig.code,
    marketCode: marketConfig.code,
  });

  return {
    languageCode: languageConfig.code,
    marketCode: marketConfig.code,
    currencyCode: marketConfig.currencyCode,
    localeCode,
    htmlLang: languageConfig.htmlLang,
    formattingLocale: marketConfig.formattingLocale,
    marketDisplayName: marketConfig.displayName,
    marketAdjectiveName: marketConfig.adjectiveName,
    merchantRegionCode: marketConfig.merchantRegionCode,
    routeSegment: localeCode,
  };
}

export function getDefaultFormattingLocale(): string {
  return getDefaultAppLocaleContext().formattingLocale;
}

export function buildWebPath(
  pathname: string,
  {
    forceLocalePrefix,
    localeCode = getDefaultAppLocaleContext().localeCode,
  }: {
    forceLocalePrefix?: boolean;
    localeCode?: AppLocaleCode;
  } = {},
): string {
  const normalizedPathname = normalizePathname(pathname);
  const shouldPrefix =
    forceLocalePrefix ??
    platformConfig.experience.routeLocalePrefixStrategy === 'always';

  if (!shouldPrefix) {
    return normalizedPathname;
  }

  return normalizedPathname === '/'
    ? `/${localeCode}`
    : `/${localeCode}${normalizedPathname}`;
}

export function getDefaultMarketScopeLabel({
  conditionLabel,
  suffix,
}: {
  conditionLabel?: string;
  suffix?: string;
} = {}): string {
  const localeContext = getDefaultAppLocaleContext();
  const parts = [localeContext.marketDisplayName, localeContext.currencyCode];

  if (conditionLabel) {
    parts.push(conditionLabel);
  }

  if (suffix) {
    parts.push(suffix);
  }

  return parts.join(' · ');
}

export function getDefaultMarketAdjective(): string {
  return getDefaultAppLocaleContext().marketAdjectiveName;
}

export function buildSetDetailPath(slug: string): string {
  return buildWebPath(`${webPathnames.sets}/${slug}`);
}

const nonCatalogSetSlugPattern =
  /(?:^|[-])(dk-super-readers|reader|readers|magazine|activity-book|sticker-book|jersey|t-shirt|shirt|keychain|key-chain|storage|lunch-box|plush|costume|watch|clock|calendar|video-game|videogame|software)(?:[-]|$)/u;
const nonLegoSetIdentifierSlugPattern = /-\d{10,}$/u;

export function isLikelyPublicCatalogSetSlug(slug: string): boolean {
  const normalizedSlug = slug.trim().toLowerCase();

  return (
    Boolean(normalizedSlug) &&
    !nonCatalogSetSlugPattern.test(normalizedSlug) &&
    !nonLegoSetIdentifierSlugPattern.test(normalizedSlug)
  );
}

export function isIndexableSetDetailPage({
  allowIndexing = publicSiteRobotsPolicy.allowIndexing,
  slug,
}: {
  allowIndexing?: boolean;
  slug: string;
}): boolean {
  if (!isLikelyPublicCatalogSetSlug(slug)) {
    return false;
  }

  return isIndexablePage({
    allowIndexing,
    pathname: buildSetDetailPath(slug),
  });
}

export function getSetDetailPageRobotsDirective({
  allowIndexing = publicSiteRobotsPolicy.allowIndexing,
  slug,
}: {
  allowIndexing?: boolean;
  slug: string;
}): PublicPageRobotsDirective {
  if (!isLikelyPublicCatalogSetSlug(slug)) {
    return getPublicPageRobotsDirective({
      allowIndexing,
      isThin: true,
      pathname: buildSetDetailPath(slug),
    });
  }

  return getPublicPageRobotsDirective({
    allowIndexing,
    pathname: buildSetDetailPath(slug),
  });
}

export function buildArticleThemePath(themeSlug: string): string {
  return buildWebPath(`${webPathnames.articles}/${themeSlug}`);
}

export function buildArticlePath(slug: string, themeSlug = 'lego'): string {
  return buildWebPath(`${webPathnames.articles}/${themeSlug}/${slug}`);
}

export function buildArticlePreviewPath(previewId: string): string {
  return buildWebPath(`${webPathnames.articles}/preview/${previewId}`);
}

export function buildThemePath(slug: string): string {
  return buildWebPath(`${webPathnames.themes}/${slug}`);
}

export const publicWebBaseUrls = {
  local: getRuntimeBaseUrl('web'),
  staging: 'https://staging.brickhunt.nl',
  production: 'https://www.brickhunt.nl',
} as const;

export const canonicalUrlSearchParamAllowlist = ['page'] as const;

function normalizeCanonicalPathname(pathname: string): string {
  const normalizedPathname = pathname
    .replace(/\/{2,}/g, '/')
    .replace(/\/+$/u, '');

  return normalizedPathname ? normalizedPathname : '/';
}

export function buildCanonicalUrl(
  input: string | URL,
  {
    allowedSearchParams = [],
  }: {
    allowedSearchParams?: readonly string[];
  } = {},
): string {
  const parsedUrl =
    input instanceof URL ? input : new URL(input, publicWebBaseUrls.production);
  const canonicalUrl = new URL(publicWebBaseUrls.production);
  canonicalUrl.pathname = normalizeCanonicalPathname(parsedUrl.pathname);
  canonicalUrl.search = '';
  canonicalUrl.hash = '';

  for (const paramName of allowedSearchParams) {
    const value = parsedUrl.searchParams.get(paramName);

    if (!value || (paramName === 'page' && value === '1')) {
      continue;
    }

    canonicalUrl.searchParams.set(paramName, value);
  }

  return canonicalUrl.toString();
}

export function getPublicWebBaseUrl({
  currentOrigin,
}: {
  currentOrigin?: string;
} = {}): string {
  if (!currentOrigin) {
    return publicWebBaseUrls.local;
  }

  try {
    const currentUrl = new URL(currentOrigin);
    const hostname = currentUrl.hostname.toLowerCase();

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return publicWebBaseUrls.local;
    }

    if (
      hostname === 'staging.brickhunt.nl' ||
      hostname.startsWith('staging.') ||
      hostname.startsWith('staging-')
    ) {
      return publicWebBaseUrls.staging;
    }

    return publicWebBaseUrls.production;
  } catch {
    return publicWebBaseUrls.local;
  }
}

export function buildPublicSetDetailUrl({
  currentOrigin,
  slug,
}: {
  currentOrigin?: string;
  slug: string;
}): string {
  return `${getPublicWebBaseUrl({ currentOrigin })}${buildSetDetailPath(slug)}`;
}

export function getWebNavigation(
  articleCount = 0,
): ReadonlyArray<{ href: string; label: string }> {
  const showArticles = hasPublicArticleContent(articleCount);

  return webNavigationItems
    .map((navigationItem) => ({
      label: navigationItem.label,
      href:
        'href' in navigationItem
          ? navigationItem.href
          : buildWebPath(navigationItem.pathname),
    }))
    .filter(
      (navigationItem) =>
        navigationItem.href !== buildWebPath(webPathnames.articles) ||
        showArticles,
    );
}

export const webNavigation = getWebNavigation(0);

function getDefaultBrowserSupabaseUrl(): string | undefined {
  return process.env['NEXT_PUBLIC_SUPABASE_URL'];
}

function getDefaultBrowserSupabaseAnonKey(): string | undefined {
  return process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
}

function getBrowserSupabaseUrl(
  environment: Record<string, string | undefined>,
): string | undefined {
  return environment === process.env
    ? getDefaultBrowserSupabaseUrl()
    : environment[supabaseEnvKeys.browserUrl];
}

function getBrowserSupabaseAnonKey(
  environment: Record<string, string | undefined>,
): string | undefined {
  return environment === process.env
    ? getDefaultBrowserSupabaseAnonKey()
    : environment[supabaseEnvKeys.browserAnonKey];
}

function getSupabaseServerUrl(
  environment: Record<string, string | undefined>,
): string | undefined {
  return (
    environment[supabaseEnvKeys.serverUrl] ??
    environment[supabaseEnvKeys.browserUrl]
  );
}

function getSupabaseProjectRefFromUrl(url?: string): string | undefined {
  if (!url) {
    return undefined;
  }

  try {
    const parsedUrl = new URL(url);

    return parsedUrl.hostname.split('.')[0] || undefined;
  } catch {
    return undefined;
  }
}

function getSupabaseProjectRefFromJwt(token?: string): string | undefined {
  if (!token) {
    return undefined;
  }

  const payload = token.split('.')[1];

  if (!payload) {
    return undefined;
  }

  try {
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(
      Math.ceil(normalizedPayload.length / 4) * 4,
      '=',
    );
    const parsedPayload = JSON.parse(
      Buffer.from(paddedPayload, 'base64').toString('utf8'),
    ) as { ref?: unknown };

    return typeof parsedPayload.ref === 'string'
      ? parsedPayload.ref
      : undefined;
  } catch {
    return undefined;
  }
}

function formatSupabaseProjectLabel({
  fallbackValue,
  projectRef,
}: {
  fallbackValue?: string;
  projectRef?: string;
}): string {
  return projectRef ?? fallbackValue ?? 'onbekend project';
}

export function getServerSupabaseUrlSource(
  environment: Record<string, string | undefined> = process.env,
): string | undefined {
  if (environment[supabaseEnvKeys.serverUrl]) {
    return supabaseEnvKeys.serverUrl;
  }

  return getBrowserSupabaseUrl(environment)
    ? supabaseEnvKeys.browserUrl
    : undefined;
}

export function getServerSupabaseProjectRef(
  environment: Record<string, string | undefined> = process.env,
): string | undefined {
  return getSupabaseProjectRefFromUrl(getSupabaseServerUrl(environment));
}

export function getServerSupabaseEnvIssues(
  environment: Record<string, string | undefined> = process.env,
): string[] {
  const issues: string[] = [];
  const explicitServerUrl = environment[supabaseEnvKeys.serverUrl];
  const browserUrl = getBrowserSupabaseUrl(environment);
  const serviceRoleKey = environment[supabaseEnvKeys.serverServiceRoleKey];
  const browserAnonKey = getBrowserSupabaseAnonKey(environment);
  const explicitServerProjectRef =
    getSupabaseProjectRefFromUrl(explicitServerUrl);
  const browserProjectRef = getSupabaseProjectRefFromUrl(browserUrl);
  const serviceRoleProjectRef = getSupabaseProjectRefFromJwt(serviceRoleKey);
  const browserAnonProjectRef = getSupabaseProjectRefFromJwt(browserAnonKey);

  if (
    explicitServerUrl &&
    browserUrl &&
    explicitServerProjectRef &&
    browserProjectRef &&
    explicitServerProjectRef !== browserProjectRef
  ) {
    issues.push(
      `${supabaseEnvKeys.serverUrl} points to ${formatSupabaseProjectLabel({
        fallbackValue: explicitServerUrl,
        projectRef: explicitServerProjectRef,
      })}, but ${supabaseEnvKeys.browserUrl} points to ${formatSupabaseProjectLabel(
        {
          fallbackValue: browserUrl,
          projectRef: browserProjectRef,
        },
      )}. Server writes always use ${supabaseEnvKeys.serverUrl}.`,
    );
  }

  if (
    explicitServerProjectRef &&
    serviceRoleProjectRef &&
    explicitServerProjectRef !== serviceRoleProjectRef
  ) {
    issues.push(
      `${supabaseEnvKeys.serverServiceRoleKey} belongs to ${formatSupabaseProjectLabel(
        {
          projectRef: serviceRoleProjectRef,
        },
      )}, but ${supabaseEnvKeys.serverUrl} points to ${formatSupabaseProjectLabel(
        {
          fallbackValue: explicitServerUrl,
          projectRef: explicitServerProjectRef,
        },
      )}.`,
    );
  }

  if (
    browserProjectRef &&
    browserAnonProjectRef &&
    browserProjectRef !== browserAnonProjectRef
  ) {
    issues.push(
      `${supabaseEnvKeys.browserAnonKey} belongs to ${formatSupabaseProjectLabel(
        {
          projectRef: browserAnonProjectRef,
        },
      )}, but ${supabaseEnvKeys.browserUrl} points to ${formatSupabaseProjectLabel(
        {
          fallbackValue: browserUrl,
          projectRef: browserProjectRef,
        },
      )}.`,
    );
  }

  return issues;
}

function requireEnvValue({
  environment,
  key,
}: {
  environment: Record<string, string | undefined>;
  key: string;
}): string {
  const value = environment[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}.`);
  }

  return value;
}

function readOptionalPositiveIntegerEnvValue({
  environment,
  key,
}: {
  environment: Record<string, string | undefined>;
  key: string;
}): number | undefined {
  const rawValue = environment[key]?.trim();

  if (!rawValue) {
    return undefined;
  }

  const parsedValue = Number(rawValue);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(
      `Invalid environment variable: ${key} must be a positive integer.`,
    );
  }

  return parsedValue;
}

function requirePositiveIntegerEnvValue({
  environment,
  key,
}: {
  environment: Record<string, string | undefined>;
  key: string;
}): number {
  const parsedValue = readOptionalPositiveIntegerEnvValue({
    environment,
    key,
  });

  if (parsedValue === undefined) {
    throw new Error(`Missing required environment variable: ${key}.`);
  }

  return parsedValue;
}

export function getBrowserSupabaseConfig(
  environment: Record<string, string | undefined> = process.env,
): BrowserSupabaseConfig {
  const url = getBrowserSupabaseUrl(environment);
  const anonKey = getBrowserSupabaseAnonKey(environment);

  if (!url) {
    throw new Error(
      `Missing required environment variable: ${supabaseEnvKeys.browserUrl}.`,
    );
  }

  if (!anonKey) {
    throw new Error(
      `Missing required environment variable: ${supabaseEnvKeys.browserAnonKey}.`,
    );
  }

  return {
    url,
    anonKey,
  };
}

export function hasBrowserSupabaseConfig(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(
    getBrowserSupabaseUrl(environment) &&
      getBrowserSupabaseAnonKey(environment),
  );
}

export function getMissingBrowserSupabaseEnvKeys(
  environment: Record<string, string | undefined> = process.env,
): string[] {
  const missingKeys: string[] = [];

  if (!getBrowserSupabaseUrl(environment)) {
    missingKeys.push(supabaseEnvKeys.browserUrl);
  }

  if (!getBrowserSupabaseAnonKey(environment)) {
    missingKeys.push(supabaseEnvKeys.browserAnonKey);
  }

  return missingKeys;
}

export function getServerSupabaseConfig(
  environment: Record<string, string | undefined> = process.env,
): ServerSupabaseConfig {
  const issues = getServerSupabaseEnvIssues(environment);

  if (issues.length > 0) {
    throw new Error(
      `Inconsistent Supabase server configuration: ${issues.join(' ')}`,
    );
  }

  return {
    url:
      getSupabaseServerUrl(environment) ??
      requireEnvValue({
        environment,
        key: supabaseEnvKeys.browserUrl,
      }),
    serviceRoleKey: requireEnvValue({
      environment,
      key: supabaseEnvKeys.serverServiceRoleKey,
    }),
  };
}

export function hasServerSupabaseConfig(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(
    getSupabaseServerUrl(environment) &&
      environment[supabaseEnvKeys.serverServiceRoleKey] &&
      getServerSupabaseEnvIssues(environment).length === 0,
  );
}

export function getMissingServerSupabaseEnvKeys(
  environment: Record<string, string | undefined> = process.env,
): string[] {
  const missingKeys: string[] = [];

  if (!getSupabaseServerUrl(environment)) {
    missingKeys.push(
      `${supabaseEnvKeys.serverUrl} (or ${supabaseEnvKeys.browserUrl})`,
    );
  }

  if (!environment[supabaseEnvKeys.serverServiceRoleKey]) {
    missingKeys.push(supabaseEnvKeys.serverServiceRoleKey);
  }

  return missingKeys;
}

export function getStagingSupabaseConfig(
  environment: Record<string, string | undefined> = process.env,
): StagingSupabaseConfig {
  return {
    url: requireEnvValue({
      environment,
      key: stagingSupabaseEnvKeys.url,
    }),
    serviceRoleKey: requireEnvValue({
      environment,
      key: stagingSupabaseEnvKeys.serviceRoleKey,
    }),
  };
}

export function hasStagingSupabaseConfig(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(
    environment[stagingSupabaseEnvKeys.url] &&
      environment[stagingSupabaseEnvKeys.serviceRoleKey],
  );
}

export function getMissingStagingSupabaseEnvKeys(
  environment: Record<string, string | undefined> = process.env,
): string[] {
  const missingKeys: string[] = [];

  if (!environment[stagingSupabaseEnvKeys.url]) {
    missingKeys.push(stagingSupabaseEnvKeys.url);
  }

  if (!environment[stagingSupabaseEnvKeys.serviceRoleKey]) {
    missingKeys.push(stagingSupabaseEnvKeys.serviceRoleKey);
  }

  return missingKeys;
}

export function getProductionSupabaseConfig(
  environment: Record<string, string | undefined> = process.env,
): ProductionSupabaseConfig {
  return {
    url: requireEnvValue({
      environment,
      key: productionSupabaseEnvKeys.url,
    }),
    serviceRoleKey: requireEnvValue({
      environment,
      key: productionSupabaseEnvKeys.serviceRoleKey,
    }),
  };
}

export function hasProductionSupabaseConfig(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(
    environment[productionSupabaseEnvKeys.url] &&
      environment[productionSupabaseEnvKeys.serviceRoleKey],
  );
}

export function getMissingProductionSupabaseEnvKeys(
  environment: Record<string, string | undefined> = process.env,
): string[] {
  const missingKeys: string[] = [];

  if (!environment[productionSupabaseEnvKeys.url]) {
    missingKeys.push(productionSupabaseEnvKeys.url);
  }

  if (!environment[productionSupabaseEnvKeys.serviceRoleKey]) {
    missingKeys.push(productionSupabaseEnvKeys.serviceRoleKey);
  }

  return missingKeys;
}

export function getAdminPromotionConfig(
  environment: Record<string, string | undefined> = process.env,
): AdminPromotionConfig {
  return {
    secret: requireEnvValue({
      environment,
      key: adminPromotionEnvKeys.secret,
    }),
  };
}

export function hasAdminPromotionConfig(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(environment[adminPromotionEnvKeys.secret]);
}

export function getMissingAdminPromotionEnvKeys(
  environment: Record<string, string | undefined> = process.env,
): string[] {
  return environment[adminPromotionEnvKeys.secret]
    ? []
    : [adminPromotionEnvKeys.secret];
}

export function getServerWebBaseUrl(
  environment: Record<string, string | undefined> = process.env,
): string {
  return (
    environment[productEmailEnvKeys.webBaseUrl] ?? getRuntimeBaseUrl('web')
  );
}

export function getPublicWebRevalidationConfig(
  environment: Record<string, string | undefined> = process.env,
): PublicWebRevalidationConfig {
  return {
    secret: requireEnvValue({
      environment,
      key: publicWebRevalidationEnvKeys.secret,
    }),
    webBaseUrl: getServerWebBaseUrl(environment),
  };
}

export function hasPublicWebRevalidationConfig(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(environment[publicWebRevalidationEnvKeys.secret]);
}

export function getMissingPublicWebRevalidationEnvKeys(
  environment: Record<string, string | undefined> = process.env,
): string[] {
  return environment[publicWebRevalidationEnvKeys.secret]
    ? []
    : [publicWebRevalidationEnvKeys.secret];
}

export function getProductEmailConfig(
  environment: Record<string, string | undefined> = process.env,
): ProductEmailConfig {
  return {
    apiKey: requireEnvValue({
      environment,
      key: productEmailEnvKeys.resendApiKey,
    }),
    fromEmail: requireEnvValue({
      environment,
      key: productEmailEnvKeys.resendFromEmail,
    }),
    fromName:
      environment[productEmailEnvKeys.resendFromName] ??
      platformConfig.productName,
    webBaseUrl: getServerWebBaseUrl(environment),
  };
}

export function hasProductEmailConfig(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(
    environment[productEmailEnvKeys.resendApiKey] &&
      environment[productEmailEnvKeys.resendFromEmail],
  );
}

export function getMissingProductEmailEnvKeys(
  environment: Record<string, string | undefined> = process.env,
): string[] {
  const missingKeys: string[] = [];

  if (!environment[productEmailEnvKeys.resendApiKey]) {
    missingKeys.push(productEmailEnvKeys.resendApiKey);
  }

  if (!environment[productEmailEnvKeys.resendFromEmail]) {
    missingKeys.push(productEmailEnvKeys.resendFromEmail);
  }

  return missingKeys;
}

export function getRebrickableApiConfig(
  environment: Record<string, string | undefined> = process.env,
): RebrickableApiConfig {
  return {
    apiKey: requireEnvValue({
      environment,
      key: rebrickableEnvKeys.apiKey,
    }),
    baseUrl: environment[rebrickableEnvKeys.baseUrl],
  };
}

export function hasRebrickableApiConfig(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(environment[rebrickableEnvKeys.apiKey]);
}

export function getMissingRebrickableEnvKeys(
  environment: Record<string, string | undefined> = process.env,
): string[] {
  return environment[rebrickableEnvKeys.apiKey]
    ? []
    : [rebrickableEnvKeys.apiKey];
}

export function getTradeTrackerAffiliateConfig(
  environment: Record<string, string | undefined> = process.env,
): TradeTrackerAffiliateConfig {
  return {
    customerId: requirePositiveIntegerEnvValue({
      environment,
      key: tradeTrackerEnvKeys.customerId,
    }),
    passphrase: requireEnvValue({
      environment,
      key: tradeTrackerEnvKeys.passphrase,
    }),
    affiliateSiteId: readOptionalPositiveIntegerEnvValue({
      environment,
      key: tradeTrackerEnvKeys.affiliateSiteId,
    }),
    alternateFeedId: readOptionalPositiveIntegerEnvValue({
      environment,
      key: tradeTrackerEnvKeys.alternateFeedId,
    }),
    alternateCampaignId: readOptionalPositiveIntegerEnvValue({
      environment,
      key: tradeTrackerEnvKeys.alternateCampaignId,
    }),
  };
}

export function getTradeTrackerLidlFeedConfig(
  environment: Record<string, string | undefined> = process.env,
): TradeTrackerLidlFeedConfig {
  return {
    feedUrl: requireEnvValue({
      environment,
      key: tradeTrackerLidlEnvKeys.feedUrl,
    }),
    merchantSlug:
      environment[tradeTrackerLidlEnvKeys.merchantSlug]?.trim() || 'lidl',
    merchantName:
      environment[tradeTrackerLidlEnvKeys.merchantName]?.trim() || 'Lidl',
  };
}

export function getTradeTrackerCoppenswarenhuisFeedConfig(
  environment: Record<string, string | undefined> = process.env,
): TradeTrackerCoppenswarenhuisFeedConfig {
  return {
    feedUrl: requireEnvValue({
      environment,
      key: tradeTrackerCoppenswarenhuisEnvKeys.feedUrl,
    }),
    merchantSlug:
      environment[tradeTrackerCoppenswarenhuisEnvKeys.merchantSlug]?.trim() ||
      'coppenswarenhuis',
    merchantName:
      environment[tradeTrackerCoppenswarenhuisEnvKeys.merchantName]?.trim() ||
      'Coppenswarenhuis',
  };
}

export function getTradeTrackerConradFeedConfig(
  environment: Record<string, string | undefined> = process.env,
): TradeTrackerConradFeedConfig {
  return {
    feedUrl: requireEnvValue({
      environment,
      key: tradeTrackerConradEnvKeys.feedUrl,
    }),
    merchantSlug:
      environment[tradeTrackerConradEnvKeys.merchantSlug]?.trim() || 'conrad',
    merchantName:
      environment[tradeTrackerConradEnvKeys.merchantName]?.trim() || 'Conrad',
  };
}

export function getAwinCoolblueFeedConfig(
  environment: Record<string, string | undefined> = process.env,
): AwinCoolblueFeedConfig {
  return {
    feedUrl: requireEnvValue({
      environment,
      key: awinCoolblueEnvKeys.feedUrl,
    }),
    merchantSlug:
      environment[awinCoolblueEnvKeys.merchantSlug]?.trim() || 'coolblue',
    merchantName:
      environment[awinCoolblueEnvKeys.merchantName]?.trim() || 'Coolblue',
  };
}

export function getAwinJoybuyFeedConfig(
  environment: Record<string, string | undefined> = process.env,
): AwinJoybuyFeedConfig {
  return {
    feedUrl: requireEnvValue({
      environment,
      key: awinJoybuyEnvKeys.feedUrl,
    }),
    merchantSlug:
      environment[awinJoybuyEnvKeys.merchantSlug]?.trim() || 'joybuy',
    merchantName:
      environment[awinJoybuyEnvKeys.merchantName]?.trim() || 'Joybuy',
  };
}

export function getAdtractionGoodbricksFeedConfig(
  environment: Record<string, string | undefined> = process.env,
): AdtractionGoodbricksFeedConfig {
  return {
    feedUrl: requireEnvValue({
      environment,
      key: adtractionGoodbricksEnvKeys.feedUrl,
    }),
    merchantSlug:
      environment[adtractionGoodbricksEnvKeys.merchantSlug]?.trim() ||
      'goodbricks',
    merchantName:
      environment[adtractionGoodbricksEnvKeys.merchantName]?.trim() ||
      'Goodbricks',
  };
}

export function getTradeDoublerMediaMarktFeedConfig(
  environment: Record<string, string | undefined> = process.env,
): TradeDoublerMediaMarktFeedConfig {
  return {
    feedUrl: requireEnvValue({
      environment,
      key: tradeDoublerMediaMarktEnvKeys.feedUrl,
    }),
    merchantSlug:
      environment[tradeDoublerMediaMarktEnvKeys.merchantSlug]?.trim() ||
      'mediamarkt',
    merchantName:
      environment[tradeDoublerMediaMarktEnvKeys.merchantName]?.trim() ||
      'MediaMarkt',
  };
}

export function getMisterBricksFeedConfig(
  environment: Record<string, string | undefined> = process.env,
): MisterBricksFeedConfig {
  return {
    feedUrl: requireEnvValue({
      environment,
      key: misterBricksEnvKeys.feedUrl,
    }),
    merchantSlug:
      environment[misterBricksEnvKeys.merchantSlug]?.trim() || 'misterbricks',
    merchantName:
      environment[misterBricksEnvKeys.merchantName]?.trim() || 'MisterBricks',
  };
}

export function getRakutenLegoFeedConfig(
  environment: Record<string, string | undefined> = process.env,
): RakutenLegoFeedConfig {
  return {
    host:
      environment[rakutenLegoEnvKeys.host]?.trim() ||
      environment['RAKUTEN_LEGO_FTP_HOST']?.trim() ||
      'aftp.linksynergy.com',
    port:
      readOptionalPositiveIntegerEnvValue({
        environment,
        key: rakutenLegoEnvKeys.port,
      }) ??
      readOptionalPositiveIntegerEnvValue({
        environment,
        key: 'RAKUTEN_LEGO_FTP_PORT',
      }) ??
      22,
    username: requireEnvValue({
      environment,
      key: rakutenLegoEnvKeys.username,
    }),
    password: requireEnvValue({
      environment,
      key: rakutenLegoEnvKeys.password,
    }),
    sid:
      environment[rakutenLegoEnvKeys.sid]?.trim() ||
      environment['RAKUTEN_LEGO_SID']?.trim() ||
      '4682248',
    mid: environment[rakutenLegoEnvKeys.mid]?.trim() || undefined,
    filename:
      environment[rakutenLegoEnvKeys.filename]?.trim() ||
      rakutenLegoDefaultNlFeedFilename,
    remoteDir: environment[rakutenLegoEnvKeys.remoteDir]?.trim() || undefined,
    enablePhaseOneImport: isTrueEnvValue(
      environment[rakutenLegoEnvKeys.enablePhaseOneImport],
    ),
    merchantSlug:
      environment[rakutenLegoEnvKeys.merchantSlug]?.trim() || 'rakuten-lego-eu',
    merchantName:
      environment[rakutenLegoEnvKeys.merchantName]?.trim() || 'LEGO',
  };
}

export function resolveRakutenLegoFeedFilename(
  config: Pick<RakutenLegoFeedConfig, 'filename' | 'mid' | 'sid'>,
): string {
  if (config.filename?.trim()) {
    return config.filename.trim();
  }

  if (config.mid?.trim()) {
    return `${config.mid.trim()}_${config.sid.trim()}_mp.xml.gz`;
  }

  throw new Error(
    `Missing Rakuten LEGO feed filename. Set ${rakutenLegoEnvKeys.filename} or ${rakutenLegoEnvKeys.mid}.`,
  );
}

export function hasAwinCoolblueFeedConfig(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(environment[awinCoolblueEnvKeys.feedUrl]);
}

export function getMissingAwinCoolblueEnvKeys(
  environment: Record<string, string | undefined> = process.env,
): string[] {
  return environment[awinCoolblueEnvKeys.feedUrl]
    ? []
    : [awinCoolblueEnvKeys.feedUrl];
}

export function hasAwinJoybuyFeedConfig(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(environment[awinJoybuyEnvKeys.feedUrl]);
}

export function getMissingAwinJoybuyEnvKeys(
  environment: Record<string, string | undefined> = process.env,
): string[] {
  return environment[awinJoybuyEnvKeys.feedUrl]
    ? []
    : [awinJoybuyEnvKeys.feedUrl];
}

export function hasAdtractionGoodbricksFeedConfig(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(environment[adtractionGoodbricksEnvKeys.feedUrl]);
}

export function getMissingAdtractionGoodbricksEnvKeys(
  environment: Record<string, string | undefined> = process.env,
): string[] {
  return environment[adtractionGoodbricksEnvKeys.feedUrl]
    ? []
    : [adtractionGoodbricksEnvKeys.feedUrl];
}

export function hasTradeDoublerMediaMarktFeedConfig(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(environment[tradeDoublerMediaMarktEnvKeys.feedUrl]);
}

export function getMissingTradeDoublerMediaMarktEnvKeys(
  environment: Record<string, string | undefined> = process.env,
): string[] {
  return environment[tradeDoublerMediaMarktEnvKeys.feedUrl]
    ? []
    : [tradeDoublerMediaMarktEnvKeys.feedUrl];
}

export function hasMisterBricksFeedConfig(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(environment[misterBricksEnvKeys.feedUrl]);
}

export function getMissingMisterBricksEnvKeys(
  environment: Record<string, string | undefined> = process.env,
): string[] {
  return environment[misterBricksEnvKeys.feedUrl]
    ? []
    : [misterBricksEnvKeys.feedUrl];
}

export function hasRakutenLegoFeedConfig(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(
    environment[rakutenLegoEnvKeys.username] &&
      environment[rakutenLegoEnvKeys.password],
  );
}

export function getMissingRakutenLegoEnvKeys(
  environment: Record<string, string | undefined> = process.env,
): string[] {
  const missingKeys: string[] = [];

  if (!environment[rakutenLegoEnvKeys.username]) {
    missingKeys.push(rakutenLegoEnvKeys.username);
  }

  if (!environment[rakutenLegoEnvKeys.password]) {
    missingKeys.push(rakutenLegoEnvKeys.password);
  }

  return missingKeys;
}

export function hasTradeTrackerAffiliateConfig(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(
    environment[tradeTrackerEnvKeys.customerId] &&
      environment[tradeTrackerEnvKeys.passphrase],
  );
}

export function getMissingTradeTrackerEnvKeys(
  environment: Record<string, string | undefined> = process.env,
): string[] {
  const missingKeys: string[] = [];

  if (!environment[tradeTrackerEnvKeys.customerId]) {
    missingKeys.push(tradeTrackerEnvKeys.customerId);
  }

  if (!environment[tradeTrackerEnvKeys.passphrase]) {
    missingKeys.push(tradeTrackerEnvKeys.passphrase);
  }

  return missingKeys;
}

export function hasTradeTrackerLidlFeedConfig(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(environment[tradeTrackerLidlEnvKeys.feedUrl]);
}

export function getMissingTradeTrackerLidlEnvKeys(
  environment: Record<string, string | undefined> = process.env,
): string[] {
  return environment[tradeTrackerLidlEnvKeys.feedUrl]
    ? []
    : [tradeTrackerLidlEnvKeys.feedUrl];
}

export function hasTradeTrackerCoppenswarenhuisFeedConfig(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(environment[tradeTrackerCoppenswarenhuisEnvKeys.feedUrl]);
}

export function getMissingTradeTrackerCoppenswarenhuisEnvKeys(
  environment: Record<string, string | undefined> = process.env,
): string[] {
  return environment[tradeTrackerCoppenswarenhuisEnvKeys.feedUrl]
    ? []
    : [tradeTrackerCoppenswarenhuisEnvKeys.feedUrl];
}

export function hasTradeTrackerConradFeedConfig(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(environment[tradeTrackerConradEnvKeys.feedUrl]);
}

export function getMissingTradeTrackerConradEnvKeys(
  environment: Record<string, string | undefined> = process.env,
): string[] {
  return environment[tradeTrackerConradEnvKeys.feedUrl]
    ? []
    : [tradeTrackerConradEnvKeys.feedUrl];
}

export function getRuntimeBaseUrl(runtimeName: RuntimeName): string {
  return platformConfig.runtimes[runtimeName].baseUrl;
}
