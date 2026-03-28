export const platformConfig = {
  workspaceName: 'lego-platform',
  productName: 'Brick Ledger',
  tagline:
    'Browse standout LEGO sets and build a cleaner ledger for what you own and want next.',
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
    label: 'Home',
    href: '/',
    description: 'Phase-1 collector landing page.',
  },
  {
    label: 'Featured sets',
    href: '/#featured-sets',
    description: 'Static-friendly discovery slice.',
  },
] as const;

export const apiPaths = {
  session: '/api/v1/session',
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
  return {
    url: requireEnvValue({
      environment,
      key: supabaseEnvKeys.browserUrl,
    }),
    anonKey: requireEnvValue({
      environment,
      key: supabaseEnvKeys.browserAnonKey,
    }),
  };
}

export function getServerSupabaseConfig(
  environment: Record<string, string | undefined> = process.env,
): ServerSupabaseConfig {
  return {
    url:
      environment[supabaseEnvKeys.serverUrl] ??
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

export function getRuntimeBaseUrl(runtimeName: RuntimeName): string {
  return platformConfig.runtimes[runtimeName].baseUrl;
}
