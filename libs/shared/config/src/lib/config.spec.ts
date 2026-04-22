import { afterEach, describe, expect, test } from 'vitest';
import {
  getAdminPromotionConfig,
  buildPublicSetDetailUrl,
  buildThemePath,
  buildWebPath,
  createLocaleCode,
  getBrowserSupabaseConfig,
  getMissingAdminPromotionEnvKeys,
  getDefaultAppLocaleContext,
  getDefaultFormattingLocale,
  getDefaultMarketScopeLabel,
  getMissingBrowserSupabaseEnvKeys,
  getMissingPublicWebRevalidationEnvKeys,
  getMissingProductEmailEnvKeys,
  getMissingStagingSupabaseEnvKeys,
  getMissingTradeTrackerEnvKeys,
  getPublicWebRevalidationConfig,
  getPublicWebBaseUrl,
  getProductEmailConfig,
  getTradeTrackerAffiliateConfig,
  getServerWebBaseUrl,
  getStagingSupabaseConfig,
  hasAdminPromotionConfig,
  hasBrowserSupabaseConfig,
  hasPublicWebRevalidationConfig,
  hasProductEmailConfig,
  hasStagingSupabaseConfig,
  hasTradeTrackerAffiliateConfig,
  publicSiteRobotsPolicy,
} from './config';

describe('shared config browser Supabase helpers', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('reads NEXT_PUBLIC browser config from direct process.env references by default', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

    expect(hasBrowserSupabaseConfig()).toBe(true);
    expect(getMissingBrowserSupabaseEnvKeys()).toEqual([]);
    expect(getBrowserSupabaseConfig()).toEqual({
      url: 'https://example.supabase.co',
      anonKey: 'anon-key',
    });
  });

  test('preserves explicit environment override behavior', () => {
    const environment = {
      NEXT_PUBLIC_SUPABASE_URL: 'https://override.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'override-anon-key',
    };

    expect(hasBrowserSupabaseConfig(environment)).toBe(true);
    expect(getMissingBrowserSupabaseEnvKeys(environment)).toEqual([]);
    expect(getBrowserSupabaseConfig(environment)).toEqual({
      url: 'https://override.supabase.co',
      anonKey: 'override-anon-key',
    });
  });
});

describe('shared config locale and market foundations', () => {
  test('keeps language, market, currency, and route locale separate in the default app context', () => {
    expect(getDefaultAppLocaleContext()).toEqual({
      languageCode: 'nl',
      marketCode: 'NL',
      currencyCode: 'EUR',
      localeCode: 'nl-nl',
      htmlLang: 'nl',
      formattingLocale: 'nl-NL',
      marketDisplayName: 'Nederlandse markt',
      marketAdjectiveName: 'Nederlandse',
      merchantRegionCode: 'NL',
      routeSegment: 'nl-nl',
    });
    expect(getDefaultFormattingLocale()).toBe('nl-NL');
  });

  test('builds unprefixed routes now while keeping locale-prefixed paths possible later', () => {
    expect(buildWebPath('/discover')).toBe('/discover');
    expect(buildWebPath('account')).toBe('/account');
    expect(buildPublicSetDetailUrl({ slug: 'rivendell-10316' })).toBe(
      'http://localhost:3000/sets/rivendell-10316',
    );
    expect(buildThemePath('icons')).toBe('/themes/icons');
    expect(buildWebPath('/', { forceLocalePrefix: true })).toBe('/nl-nl');
    expect(
      buildWebPath('/discover', {
        forceLocalePrefix: true,
        localeCode: createLocaleCode({
          languageCode: 'nl',
          marketCode: 'NL',
        }),
      }),
    ).toBe('/nl-nl/discover');
  });

  test('resolves public web base urls from the current admin origin', () => {
    expect(
      getPublicWebBaseUrl({
        currentOrigin: 'http://localhost:4200',
      }),
    ).toBe('http://localhost:3000');
    expect(
      getPublicWebBaseUrl({
        currentOrigin: 'https://staging-admin.brickhunt.nl',
      }),
    ).toBe('https://staging.brickhunt.nl');
    expect(
      getPublicWebBaseUrl({
        currentOrigin: 'https://ops.brickhunt.nl',
      }),
    ).toBe('https://brickhunt.nl');
  });

  test('renders reusable market scope labels from the default market config', () => {
    expect(
      getDefaultMarketScopeLabel({
        conditionLabel: 'new condition',
        suffix: '3 merchants shown',
      }),
    ).toBe('Nederlandse markt · EUR · new condition · 3 merchants shown');
  });

  test('keeps the public site globally blocked from indexing during pre-launch', () => {
    expect(publicSiteRobotsPolicy).toEqual({
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
    });
  });
});

describe('shared config product email helpers', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('reads resend email delivery config from server env with a runtime fallback web URL', () => {
    process.env.RESEND_API_KEY = 'resend-key';
    process.env.RESEND_FROM_EMAIL = 'alerts@example.test';

    expect(hasProductEmailConfig()).toBe(true);
    expect(getMissingProductEmailEnvKeys()).toEqual([]);
    expect(getProductEmailConfig()).toEqual({
      apiKey: 'resend-key',
      fromEmail: 'alerts@example.test',
      fromName: 'Brickhunt',
      webBaseUrl: 'http://localhost:3000',
    });
  });

  test('prefers an explicit WEB_BASE_URL for product emails', () => {
    expect(
      getServerWebBaseUrl({
        WEB_BASE_URL: 'https://brickhunt.example',
      }),
    ).toBe('https://brickhunt.example');
  });

  test('reports missing resend env keys when product email delivery is not configured', () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;

    expect(hasProductEmailConfig()).toBe(false);
    expect(getMissingProductEmailEnvKeys()).toEqual([
      'RESEND_API_KEY',
      'RESEND_FROM_EMAIL',
    ]);
  });
});

describe('shared config public web revalidation helpers', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('reads revalidation config from server env with the shared web base url', () => {
    process.env.WEB_REVALIDATE_SECRET = 'revalidate-secret';
    process.env.WEB_BASE_URL = 'https://staging.brickhunt.nl';

    expect(hasPublicWebRevalidationConfig()).toBe(true);
    expect(getMissingPublicWebRevalidationEnvKeys()).toEqual([]);
    expect(getPublicWebRevalidationConfig()).toEqual({
      secret: 'revalidate-secret',
      webBaseUrl: 'https://staging.brickhunt.nl',
    });
  });

  test('reports the missing revalidation secret when public revalidation is not configured', () => {
    delete process.env.WEB_REVALIDATE_SECRET;

    expect(hasPublicWebRevalidationConfig()).toBe(false);
    expect(getMissingPublicWebRevalidationEnvKeys()).toEqual([
      'WEB_REVALIDATE_SECRET',
    ]);
  });
});

describe('shared config catalog promotion helpers', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('reads staging Supabase promotion config from dedicated env vars', () => {
    process.env.SUPABASE_URL_STAGING = 'https://staging.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY_STAGING = 'staging-service-role';

    expect(hasStagingSupabaseConfig()).toBe(true);
    expect(getMissingStagingSupabaseEnvKeys()).toEqual([]);
    expect(getStagingSupabaseConfig()).toEqual({
      serviceRoleKey: 'staging-service-role',
      url: 'https://staging.supabase.co',
    });
  });

  test('reports missing staging promotion env vars when staging access is not configured', () => {
    delete process.env.SUPABASE_URL_STAGING;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY_STAGING;

    expect(hasStagingSupabaseConfig()).toBe(false);
    expect(getMissingStagingSupabaseEnvKeys()).toEqual([
      'SUPABASE_URL_STAGING',
      'SUPABASE_SERVICE_ROLE_KEY_STAGING',
    ]);
  });

  test('reads the admin promotion secret from server env', () => {
    process.env.ADMIN_PROMOTE_SECRET = 'promote-secret';

    expect(hasAdminPromotionConfig()).toBe(true);
    expect(getMissingAdminPromotionEnvKeys()).toEqual([]);
    expect(getAdminPromotionConfig()).toEqual({
      secret: 'promote-secret',
    });
  });

  test('reports the missing admin promotion secret when promotion is not configured', () => {
    delete process.env.ADMIN_PROMOTE_SECRET;

    expect(hasAdminPromotionConfig()).toBe(false);
    expect(getMissingAdminPromotionEnvKeys()).toEqual(['ADMIN_PROMOTE_SECRET']);
  });
});

describe('shared config TradeTracker helpers', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('reads TradeTracker SOAP config with optional Alternate overrides', () => {
    process.env.TRADETRACKER_CUSTOMER_ID = '12345';
    process.env.TRADETRACKER_PASSPHRASE = 'tt-passphrase';
    process.env.TRADETRACKER_AFFILIATE_SITE_ID = '67890';
    process.env.TRADETRACKER_ALTERNATE_FEED_ID = '111';
    process.env.TRADETRACKER_ALTERNATE_CAMPAIGN_ID = '222';

    expect(hasTradeTrackerAffiliateConfig()).toBe(true);
    expect(getMissingTradeTrackerEnvKeys()).toEqual([]);
    expect(getTradeTrackerAffiliateConfig()).toEqual({
      affiliateSiteId: 67890,
      alternateCampaignId: 222,
      alternateFeedId: 111,
      customerId: 12345,
      passphrase: 'tt-passphrase',
    });
  });

  test('reports missing required TradeTracker env vars', () => {
    delete process.env.TRADETRACKER_CUSTOMER_ID;
    delete process.env.TRADETRACKER_PASSPHRASE;

    expect(hasTradeTrackerAffiliateConfig()).toBe(false);
    expect(getMissingTradeTrackerEnvKeys()).toEqual([
      'TRADETRACKER_CUSTOMER_ID',
      'TRADETRACKER_PASSPHRASE',
    ]);
  });
});
