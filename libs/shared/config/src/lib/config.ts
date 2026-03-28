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

export function getRuntimeBaseUrl(runtimeName: RuntimeName): string {
  return platformConfig.runtimes[runtimeName].baseUrl;
}
