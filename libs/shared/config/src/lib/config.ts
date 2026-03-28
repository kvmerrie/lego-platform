export const platformConfig = {
  workspaceName: 'lego-platform',
  productName: 'Brick Ledger',
  tagline:
    'A collector platform for catalog discovery, collection curation, wishlist planning, and pricing intelligence.',
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
    label: 'Catalog',
    href: '#catalog',
    description: 'Set discovery and theme coverage.',
  },
  {
    label: 'Collection',
    href: '#collection',
    description: 'Collection health and curation.',
  },
  {
    label: 'Pricing',
    href: '#pricing',
    description: 'Value tracking and offer intelligence.',
  },
  {
    label: 'Content',
    href: '#content',
    description: 'Editorial storytelling and previews.',
  },
] as const;

export function getRuntimeBaseUrl(runtimeName: RuntimeName): string {
  return platformConfig.runtimes[runtimeName].baseUrl;
}
