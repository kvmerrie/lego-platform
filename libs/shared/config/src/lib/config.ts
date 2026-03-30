export const platformConfig = {
  workspaceName: 'lego-platform',
  productName: 'Brick Ledger',
  tagline:
    'Browse standout LEGO sets, then keep track of what you own and still want.',
  defaultThemeMode: 'light',
  supportEmail: 'platform@example.test',
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

export type RuntimeName = keyof typeof platformConfig.runtimes;

export const webNavigation = [
  {
    label: 'Discover',
    href: '/discover',
  },
  {
    label: 'Account',
    href: '/account',
  },
] as const;

export const apiPaths = {
  session: '/api/v1/session',
  profile: '/api/v1/me/profile',
  ownedSets: '/api/v1/me/owned-sets',
  wantedSets: '/api/v1/me/wanted-sets',
} as const;

export const supabaseEnvKeys = {
  browserUrl: 'NEXT_PUBLIC_SUPABASE_URL',
  browserAnonKey: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  serverUrl: 'SUPABASE_URL',
  serverServiceRoleKey: 'SUPABASE_SERVICE_ROLE_KEY',
} as const;

export interface BrowserSupabaseConfig {
  anonKey: string;
  url: string;
}

export interface ServerSupabaseConfig {
  serviceRoleKey: string;
  url: string;
}

function getDefaultBrowserSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function getDefaultBrowserSupabaseAnonKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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

export function getRuntimeBaseUrl(runtimeName: RuntimeName): string {
  return platformConfig.runtimes[runtimeName].baseUrl;
}
