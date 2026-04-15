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
  wishlistAlertsViewed: '/api/v1/me/profile/wishlist-alerts/viewed',
  ownedSets: '/api/v1/me/owned-sets',
  wantedSets: '/api/v1/me/wanted-sets',
  adminCommerceMerchants: '/api/v1/admin/commerce/merchants',
  adminCommerceOfferSeeds: '/api/v1/admin/commerce/offer-seeds',
  adminCommerceBenchmarkSets: '/api/v1/admin/commerce/benchmark-sets',
} as const;

export const supabaseEnvKeys = {
  browserUrl: 'NEXT_PUBLIC_SUPABASE_URL',
  browserAnonKey: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  serverUrl: 'SUPABASE_URL',
  serverServiceRoleKey: 'SUPABASE_SERVICE_ROLE_KEY',
} as const;

export const productEmailEnvKeys = {
  resendApiKey: 'RESEND_API_KEY',
  resendFromEmail: 'RESEND_FROM_EMAIL',
  resendFromName: 'RESEND_FROM_NAME',
  webBaseUrl: 'WEB_BASE_URL',
} as const;

export interface BrowserSupabaseConfig {
  anonKey: string;
  url: string;
}

export interface ServerSupabaseConfig {
  serviceRoleKey: string;
  url: string;
}

export interface ProductEmailConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  webBaseUrl: string;
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
      environment[supabaseEnvKeys.serverServiceRoleKey],
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

export function getServerWebBaseUrl(
  environment: Record<string, string | undefined> = process.env,
): string {
  return (
    environment[productEmailEnvKeys.webBaseUrl] ?? getRuntimeBaseUrl('web')
  );
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

export function getRuntimeBaseUrl(runtimeName: RuntimeName): string {
  return platformConfig.runtimes[runtimeName].baseUrl;
}
