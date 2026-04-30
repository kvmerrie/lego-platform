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
  supportEmail: 'platform@example.test',
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

export const publicSiteRobotsPolicy = {
  allowIndexing: false,
  meta: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
  robotsTxt: {
    userAgent: '*',
    disallow: '/',
  },
} as const;

export type RuntimeName = keyof typeof platformConfig.runtimes;

export const webPathnames = {
  home: '/',
  articles: '/artikelen',
  discover: '/discover',
  themes: '/themes',
  search: '/search',
  following: '/volgt',
  account: '/account',
  collection: '/account/collection',
  wishlist: '/account/wishlist',
  sets: '/sets',
} as const;

const webNavigationItems = [
  {
    label: 'Ontdekken',
    pathname: webPathnames.discover,
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
  adminCommerceMerchants: '/api/v1/admin/commerce/merchants',
  adminCommerceOfferSeeds: '/api/v1/admin/commerce/offer-seeds',
  adminCommerceBenchmarkSets: '/api/v1/admin/commerce/benchmark-sets',
  adminCommerceCoverageQueue: '/api/v1/admin/commerce/coverage-queue',
  adminCommerceSetRefreshes: '/api/v1/admin/commerce/set-refreshes',
  adminCommerceAlternateFeedImports:
    '/api/v1/admin/commerce/alternate-feed/import',
  adminCatalogPromotion: '/api/admin/promote/catalog',
} as const;

export function buildCatalogSetLiveOffersApiPath(setId: string): string {
  return `${apiPaths.catalogSets}/${encodeURIComponent(setId)}/live-offers`;
}

export function buildCatalogDiscoverySignalsApiPath(): string {
  return apiPaths.catalogDiscoverySignals;
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

export const adminPromotionEnvKeys = {
  secret: 'ADMIN_PROMOTE_SECRET',
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

export const awinCoolblueEnvKeys = {
  feedUrl: 'AWIN_COOLBLUE_FEED_URL',
  merchantSlug: 'AWIN_COOLBLUE_MERCHANT_SLUG',
  merchantName: 'AWIN_COOLBLUE_MERCHANT_NAME',
} as const;

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

export interface AwinCoolblueFeedConfig {
  feedUrl: string;
  merchantName: string;
  merchantSlug: string;
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

export function buildArticlePath(slug: string): string {
  return buildWebPath(`${webPathnames.articles}/${slug}`);
}

export function buildThemePath(slug: string): string {
  return buildWebPath(`${webPathnames.themes}/${slug}`);
}

export const publicWebBaseUrls = {
  local: getRuntimeBaseUrl('web'),
  staging: 'https://staging.brickhunt.nl',
  production: 'https://brickhunt.nl',
} as const;

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

export const webNavigation = webNavigationItems.map((navigationItem) => ({
  label: navigationItem.label,
  href: buildWebPath(navigationItem.pathname),
})) as ReadonlyArray<{ href: string; label: string }>;

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

export function getRuntimeBaseUrl(runtimeName: RuntimeName): string {
  return platformConfig.runtimes[runtimeName].baseUrl;
}
