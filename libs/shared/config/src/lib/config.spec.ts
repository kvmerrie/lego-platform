import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  adtractionGoodbricksEnvKeys,
  articlePreviewEnvKeys,
  getAdtractionGoodbricksFeedConfig,
  getAwinCoolblueFeedConfig,
  getAdminPromotionConfig,
  buildArticlePath,
  buildCanonicalUrl,
  buildPublicSiteRobotsPolicy,
  buildPublicSetDetailUrl,
  buildThemePath,
  buildWebPath,
  createLocaleCode,
  getBrowserSupabaseConfig,
  getMissingAdtractionGoodbricksEnvKeys,
  getMissingAdminPromotionEnvKeys,
  getMissingAwinCoolblueEnvKeys,
  getDefaultAppLocaleContext,
  getDefaultFormattingLocale,
  getDefaultMarketScopeLabel,
  getMisterBricksFeedConfig,
  getWebNavigation,
  getMissingBrowserSupabaseEnvKeys,
  getMissingMisterBricksEnvKeys,
  getMissingPublicWebRevalidationEnvKeys,
  getMissingProductEmailEnvKeys,
  getMissingProductionSupabaseEnvKeys,
  getMissingStagingSupabaseEnvKeys,
  getMissingTradeTrackerEnvKeys,
  getMissingTradeTrackerCoppenswarenhuisEnvKeys,
  getMissingTradeTrackerConradEnvKeys,
  getMissingTradeTrackerLidlEnvKeys,
  getMissingTradeDoublerMediaMarktEnvKeys,
  getPublicWebRevalidationConfig,
  getPublicWebBaseUrl,
  getProductEmailConfig,
  getSetDetailPageRobotsDirective,
  isIndexablePage,
  isIndexableSetDetailPage,
  getProductionSupabaseConfig,
  getTradeTrackerAffiliateConfig,
  getTradeTrackerCoppenswarenhuisFeedConfig,
  getTradeTrackerConradFeedConfig,
  getTradeTrackerLidlFeedConfig,
  getTradeDoublerMediaMarktFeedConfig,
  getServerWebBaseUrl,
  getStagingSupabaseConfig,
  hasAdtractionGoodbricksFeedConfig,
  hasAdminPromotionConfig,
  hasAwinCoolblueFeedConfig,
  hasBrowserSupabaseConfig,
  hasMisterBricksFeedConfig,
  hasPublicWebRevalidationConfig,
  hasProductEmailConfig,
  hasProductionSupabaseConfig,
  hasStagingSupabaseConfig,
  hasTradeTrackerAffiliateConfig,
  hasTradeTrackerCoppenswarenhuisFeedConfig,
  hasTradeTrackerConradFeedConfig,
  hasTradeTrackerLidlFeedConfig,
  hasTradeDoublerMediaMarktFeedConfig,
  isArticlePreviewEnabled,
  publicSiteIndexingEnvKeys,
  publicSiteRobotsPolicy,
  resolvePublicSiteAllowIndexing,
  misterBricksEnvKeys,
  tradeDoublerMediaMarktEnvKeys,
  tradeTrackerCoppenswarenhuisEnvKeys,
  tradeTrackerConradEnvKeys,
  webNavigation,
} from './config';

describe('shared config article preview helper', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('does not throw and returns false when process is unavailable', () => {
    vi.stubGlobal('process', undefined);

    expect(() => isArticlePreviewEnabled()).not.toThrow();
    expect(isArticlePreviewEnabled()).toBe(false);
  });

  test('returns false by default', () => {
    expect(isArticlePreviewEnabled({})).toBe(false);
  });

  test('returns true only when explicitly configured', () => {
    expect(
      isArticlePreviewEnabled({
        [articlePreviewEnvKeys.enabled]: 'true',
      }),
    ).toBe(true);
    expect(
      isArticlePreviewEnabled({
        [articlePreviewEnvKeys.enabled]: 'false',
      }),
    ).toBe(false);
  });
});

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
    expect(buildWebPath('/deals')).toBe('/deals');
    expect(buildWebPath('account')).toBe('/account');
    expect(buildArticlePath('star-wars-day-2026', 'star-wars')).toBe(
      '/artikelen/star-wars/star-wars-day-2026',
    );
    expect(buildPublicSetDetailUrl({ slug: 'rivendell-10316' })).toBe(
      'http://localhost:3000/sets/rivendell-10316',
    );
    expect(buildThemePath('icons')).toBe('/themes/icons');
    expect(buildWebPath('/', { forceLocalePrefix: true })).toBe('/nl-nl');
    expect(
      buildWebPath('/deals', {
        forceLocalePrefix: true,
        localeCode: createLocaleCode({
          languageCode: 'nl',
          marketCode: 'NL',
        }),
      }),
    ).toBe('/nl-nl/deals');
  });

  test('builds production canonical URLs without tracking, affiliate, sort, or trailing slash noise', () => {
    expect(
      buildCanonicalUrl(
        'https://staging.brickhunt.nl/sets/rivendell-10316/?utm_source=wa&awc=123&sort=price#reviews',
      ),
    ).toBe('https://www.brickhunt.nl/sets/rivendell-10316');
    expect(
      buildCanonicalUrl('/artikelen/star-wars/star-wars-day/?fbclid=abc'),
    ).toBe('https://www.brickhunt.nl/artikelen/star-wars/star-wars-day');
    expect(buildCanonicalUrl('/sets//rivendell-10316//')).toBe(
      'https://www.brickhunt.nl/sets/rivendell-10316',
    );
    expect(
      buildCanonicalUrl('/sets/rivendell-10316?slug=rivendell-10316-copy'),
    ).toBe('https://www.brickhunt.nl/sets/rivendell-10316');
  });

  test('keeps only explicitly whitelisted SEO search params for paginated canonicals', () => {
    expect(
      buildCanonicalUrl('/deals?page=2&sort=discount&utm_medium=email', {
        allowedSearchParams: ['page'],
      }),
    ).toBe('https://www.brickhunt.nl/deals?page=2');
    expect(
      buildCanonicalUrl('/deals?page=1&sort=discount', {
        allowedSearchParams: ['page'],
      }),
    ).toBe('https://www.brickhunt.nl/deals');
  });

  test('exposes primary public navigation in Brickhunt order', () => {
    expect(webNavigation).toEqual([
      {
        href: '/deals',
        label: 'Deals',
      },
      {
        href: '/themes',
        label: "Thema's",
      },
    ]);

    expect(getWebNavigation(4)).toEqual(webNavigation);
    expect(getWebNavigation(5)).toEqual([
      {
        href: '/artikelen',
        label: 'Nieuws',
      },
      {
        href: '/deals',
        label: 'Deals',
      },
      {
        href: '/themes',
        label: "Thema's",
      },
    ]);
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
    ).toBe('https://www.brickhunt.nl');
    expect(
      getPublicWebBaseUrl({
        currentOrigin: 'https://brickhunt.nl',
      }),
    ).toBe('https://www.brickhunt.nl');
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
        },
      },
      robotsTxt: {
        userAgent: '*',
        disallow: '/',
      },
    });
  });

  test('keeps indexing disabled by default without the explicit launch env flag', () => {
    expect(resolvePublicSiteAllowIndexing({})).toBe(false);
    expect(
      resolvePublicSiteAllowIndexing({
        BRICKHUNT_DEPLOY_ENV: 'production',
        WEB_BASE_URL: 'https://www.brickhunt.nl',
      }),
    ).toBe(false);
  });

  test('enables indexing only with the explicit flag on the canonical production host', () => {
    expect(
      resolvePublicSiteAllowIndexing({
        [publicSiteIndexingEnvKeys.allowIndexing]: 'true',
        BRICKHUNT_DEPLOY_ENV: 'production',
        WEB_BASE_URL: 'https://www.brickhunt.nl',
      }),
    ).toBe(true);
    expect(
      resolvePublicSiteAllowIndexing({
        [publicSiteIndexingEnvKeys.allowIndexing]: 'true',
        VERCEL_ENV: 'production',
        VERCEL_PROJECT_PRODUCTION_URL: 'www.brickhunt.nl',
      }),
    ).toBe(true);
  });

  test('keeps staging, preview, and development blocked even with the launch flag', () => {
    expect(
      resolvePublicSiteAllowIndexing({
        [publicSiteIndexingEnvKeys.allowIndexing]: 'true',
        BRICKHUNT_DEPLOY_ENV: 'production',
        WEB_BASE_URL: 'https://brickhunt.nl',
      }),
    ).toBe(false);
    expect(
      resolvePublicSiteAllowIndexing({
        [publicSiteIndexingEnvKeys.allowIndexing]: 'true',
        BRICKHUNT_DEPLOY_ENV: 'staging',
        WEB_BASE_URL: 'https://www.brickhunt.nl',
      }),
    ).toBe(false);
    expect(
      resolvePublicSiteAllowIndexing({
        [publicSiteIndexingEnvKeys.allowIndexing]: 'true',
        VERCEL_ENV: 'preview',
        VERCEL_PROJECT_PRODUCTION_URL: 'www.brickhunt.nl',
      }),
    ).toBe(false);
    expect(
      resolvePublicSiteAllowIndexing({
        [publicSiteIndexingEnvKeys.allowIndexing]: 'true',
        BRICKHUNT_DEPLOY_ENV: 'production',
        WEB_BASE_URL: 'https://staging.brickhunt.nl',
      }),
    ).toBe(false);
    expect(
      resolvePublicSiteAllowIndexing({
        [publicSiteIndexingEnvKeys.allowIndexing]: 'true',
        BRICKHUNT_DEPLOY_ENV: 'development',
        WEB_BASE_URL: 'https://www.brickhunt.nl',
      }),
    ).toBe(false);
  });

  test('builds the launch robots policy for public indexing', () => {
    expect(
      buildPublicSiteRobotsPolicy({
        allowIndexing: true,
      }),
    ).toEqual({
      allowIndexing: true,
      meta: undefined,
      robotsTxt: {
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
      },
    });
  });

  test('classifies indexable public paths behind the launch switch', () => {
    expect(
      isIndexablePage({
        allowIndexing: true,
        pathname: '/deals',
      }),
    ).toBe(true);
    expect(
      isIndexablePage({
        allowIndexing: false,
        pathname: '/deals',
      }),
    ).toBe(false);
    expect(
      isIndexablePage({
        allowIndexing: true,
        pathname: '/search?q=rivendell',
      }),
    ).toBe(false);
    expect(
      isIndexablePage({
        allowIndexing: true,
        pathname: '/deals?utm_source=newsletter',
      }),
    ).toBe(false);
    expect(
      isIndexablePage({
        allowIndexing: true,
        pageRobotsNoIndex: true,
        pathname: '/sets/rivendell-10316',
      }),
    ).toBe(false);
  });

  test('derives set detail indexability from the shared launch policy', () => {
    expect(
      isIndexableSetDetailPage({
        allowIndexing: false,
        slug: 'lord-of-the-rings-rivendell-10316',
      }),
    ).toBe(false);
    expect(
      getSetDetailPageRobotsDirective({
        allowIndexing: false,
        slug: 'lord-of-the-rings-rivendell-10316',
      }),
    ).toEqual({
      follow: false,
      googleBot: {
        follow: false,
        index: false,
      },
      index: false,
    });
    expect(
      isIndexableSetDetailPage({
        allowIndexing: true,
        slug: 'lord-of-the-rings-rivendell-10316',
      }),
    ).toBe(true);
    expect(
      getSetDetailPageRobotsDirective({
        allowIndexing: true,
        slug: 'lord-of-the-rings-rivendell-10316',
      }),
    ).toEqual({
      follow: true,
      googleBot: {
        follow: true,
        index: true,
      },
      index: true,
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

  test('reads production Supabase config for commerce staging sync', () => {
    process.env.SUPABASE_URL_PRODUCTION = 'https://production.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY_PRODUCTION =
      'production-service-role';

    expect(hasProductionSupabaseConfig()).toBe(true);
    expect(getMissingProductionSupabaseEnvKeys()).toEqual([]);
    expect(getProductionSupabaseConfig()).toEqual({
      serviceRoleKey: 'production-service-role',
      url: 'https://production.supabase.co',
    });
  });

  test('reports missing production Supabase env vars for commerce staging sync', () => {
    delete process.env.SUPABASE_URL_PRODUCTION;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY_PRODUCTION;

    expect(hasProductionSupabaseConfig()).toBe(false);
    expect(getMissingProductionSupabaseEnvKeys()).toEqual([
      'SUPABASE_URL_PRODUCTION',
      'SUPABASE_SERVICE_ROLE_KEY_PRODUCTION',
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

describe('shared config Awin Coolblue feed helpers', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('reads the Awin Coolblue feed config with sensible merchant defaults', () => {
    process.env.AWIN_COOLBLUE_FEED_URL =
      'https://feeds.awin.example/coolblue.csv.gz';

    expect(hasAwinCoolblueFeedConfig()).toBe(true);
    expect(getMissingAwinCoolblueEnvKeys()).toEqual([]);
    expect(getAwinCoolblueFeedConfig()).toEqual({
      feedUrl: 'https://feeds.awin.example/coolblue.csv.gz',
      merchantSlug: 'coolblue',
      merchantName: 'Coolblue',
    });
  });

  test('allows explicit Coolblue merchant overrides for the Awin feed config', () => {
    process.env.AWIN_COOLBLUE_FEED_URL =
      'https://feeds.awin.example/coolblue.csv.gz';
    process.env.AWIN_COOLBLUE_MERCHANT_SLUG = 'coolblue-nl';
    process.env.AWIN_COOLBLUE_MERCHANT_NAME = 'Coolblue Nederland';

    expect(getAwinCoolblueFeedConfig()).toEqual({
      feedUrl: 'https://feeds.awin.example/coolblue.csv.gz',
      merchantSlug: 'coolblue-nl',
      merchantName: 'Coolblue Nederland',
    });
  });

  test('reports the missing Awin Coolblue feed URL', () => {
    delete process.env.AWIN_COOLBLUE_FEED_URL;

    expect(hasAwinCoolblueFeedConfig()).toBe(false);
    expect(getMissingAwinCoolblueEnvKeys()).toEqual(['AWIN_COOLBLUE_FEED_URL']);
  });
});

describe('shared config Adtraction Goodbricks feed helpers', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('reads the Adtraction Goodbricks feed config with sensible merchant defaults', () => {
    process.env.ADTRACTION_GOODBRICKS_FEED_URL =
      'https://adtraction.example/goodbricks.xml';

    expect(hasAdtractionGoodbricksFeedConfig()).toBe(true);
    expect(getMissingAdtractionGoodbricksEnvKeys()).toEqual([]);
    expect(getAdtractionGoodbricksFeedConfig()).toEqual({
      feedUrl: 'https://adtraction.example/goodbricks.xml',
      merchantSlug: 'goodbricks',
      merchantName: 'Goodbricks',
    });
  });

  test('allows explicit Goodbricks merchant overrides for the Adtraction feed config', () => {
    process.env.ADTRACTION_GOODBRICKS_FEED_URL =
      'https://adtraction.example/goodbricks.xml';
    process.env.ADTRACTION_GOODBRICKS_MERCHANT_SLUG = 'goodbricks-nl';
    process.env.ADTRACTION_GOODBRICKS_MERCHANT_NAME = 'Goodbricks NL';

    expect(getAdtractionGoodbricksFeedConfig()).toEqual({
      feedUrl: 'https://adtraction.example/goodbricks.xml',
      merchantSlug: 'goodbricks-nl',
      merchantName: 'Goodbricks NL',
    });
  });

  test('reports the missing Adtraction Goodbricks feed URL', () => {
    delete process.env.ADTRACTION_GOODBRICKS_FEED_URL;

    expect(hasAdtractionGoodbricksFeedConfig()).toBe(false);
    expect(getMissingAdtractionGoodbricksEnvKeys()).toEqual([
      adtractionGoodbricksEnvKeys.feedUrl,
    ]);
  });
});

describe('shared config TradeDoubler MediaMarkt feed helpers', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('reads the TradeDoubler MediaMarkt feed config with sensible merchant defaults', () => {
    process.env.TRADEDOUBLER_MEDIAMARKT_FEED_URL =
      'https://api.tradedoubler.example/mediamarkt.xml';

    expect(hasTradeDoublerMediaMarktFeedConfig()).toBe(true);
    expect(getMissingTradeDoublerMediaMarktEnvKeys()).toEqual([]);
    expect(getTradeDoublerMediaMarktFeedConfig()).toEqual({
      feedUrl: 'https://api.tradedoubler.example/mediamarkt.xml',
      merchantSlug: 'mediamarkt',
      merchantName: 'MediaMarkt',
    });
  });

  test('allows explicit MediaMarkt merchant overrides for the TradeDoubler feed config', () => {
    process.env.TRADEDOUBLER_MEDIAMARKT_FEED_URL =
      'https://api.tradedoubler.example/mediamarkt.xml';
    process.env.TRADEDOUBLER_MEDIAMARKT_MERCHANT_SLUG = 'mediamarkt-nl';
    process.env.TRADEDOUBLER_MEDIAMARKT_MERCHANT_NAME = 'MediaMarkt NL';

    expect(getTradeDoublerMediaMarktFeedConfig()).toEqual({
      feedUrl: 'https://api.tradedoubler.example/mediamarkt.xml',
      merchantSlug: 'mediamarkt-nl',
      merchantName: 'MediaMarkt NL',
    });
  });

  test('reports the missing TradeDoubler MediaMarkt feed URL', () => {
    delete process.env.TRADEDOUBLER_MEDIAMARKT_FEED_URL;

    expect(hasTradeDoublerMediaMarktFeedConfig()).toBe(false);
    expect(getMissingTradeDoublerMediaMarktEnvKeys()).toEqual([
      tradeDoublerMediaMarktEnvKeys.feedUrl,
    ]);
  });
});

describe('shared config TradeTracker Lidl feed helpers', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('reads the TradeTracker Lidl feed config with sensible merchant defaults', () => {
    process.env.TRADETRACKER_LIDL_FEED_URL =
      'https://pf.tradetracker.net/example/lidl.xml';

    expect(hasTradeTrackerLidlFeedConfig()).toBe(true);
    expect(getMissingTradeTrackerLidlEnvKeys()).toEqual([]);
    expect(getTradeTrackerLidlFeedConfig()).toEqual({
      feedUrl: 'https://pf.tradetracker.net/example/lidl.xml',
      merchantSlug: 'lidl',
      merchantName: 'Lidl',
    });
  });

  test('allows explicit Lidl merchant overrides for the TradeTracker feed config', () => {
    process.env.TRADETRACKER_LIDL_FEED_URL =
      'https://pf.tradetracker.net/example/lidl.xml';
    process.env.TRADETRACKER_LIDL_MERCHANT_SLUG = 'lidl-nl';
    process.env.TRADETRACKER_LIDL_MERCHANT_NAME = 'Lidl Nederland';

    expect(getTradeTrackerLidlFeedConfig()).toEqual({
      feedUrl: 'https://pf.tradetracker.net/example/lidl.xml',
      merchantSlug: 'lidl-nl',
      merchantName: 'Lidl Nederland',
    });
  });

  test('reports the missing TradeTracker Lidl feed URL', () => {
    delete process.env.TRADETRACKER_LIDL_FEED_URL;

    expect(hasTradeTrackerLidlFeedConfig()).toBe(false);
    expect(getMissingTradeTrackerLidlEnvKeys()).toEqual([
      'TRADETRACKER_LIDL_FEED_URL',
    ]);
  });
});

describe('shared config TradeTracker Coppenswarenhuis feed helpers', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('reads the TradeTracker Coppenswarenhuis feed config with sensible merchant defaults', () => {
    process.env.TRADETRACKER_COPPENSWARENHUIS_FEED_URL =
      'https://pf.tradetracker.net/example/coppenswarenhuis.xml';

    expect(hasTradeTrackerCoppenswarenhuisFeedConfig()).toBe(true);
    expect(getMissingTradeTrackerCoppenswarenhuisEnvKeys()).toEqual([]);
    expect(getTradeTrackerCoppenswarenhuisFeedConfig()).toEqual({
      feedUrl: 'https://pf.tradetracker.net/example/coppenswarenhuis.xml',
      merchantSlug: 'coppenswarenhuis',
      merchantName: 'Coppenswarenhuis',
    });
  });

  test('allows explicit Coppenswarenhuis merchant overrides for the TradeTracker feed config', () => {
    process.env.TRADETRACKER_COPPENSWARENHUIS_FEED_URL =
      'https://pf.tradetracker.net/example/coppenswarenhuis.xml';
    process.env.TRADETRACKER_COPPENSWARENHUIS_MERCHANT_SLUG = 'coppens';
    process.env.TRADETRACKER_COPPENSWARENHUIS_MERCHANT_NAME = 'Coppens';

    expect(getTradeTrackerCoppenswarenhuisFeedConfig()).toEqual({
      feedUrl: 'https://pf.tradetracker.net/example/coppenswarenhuis.xml',
      merchantSlug: 'coppens',
      merchantName: 'Coppens',
    });
  });

  test('reports the missing TradeTracker Coppenswarenhuis feed URL', () => {
    delete process.env.TRADETRACKER_COPPENSWARENHUIS_FEED_URL;

    expect(hasTradeTrackerCoppenswarenhuisFeedConfig()).toBe(false);
    expect(getMissingTradeTrackerCoppenswarenhuisEnvKeys()).toEqual([
      tradeTrackerCoppenswarenhuisEnvKeys.feedUrl,
    ]);
  });
});

describe('shared config TradeTracker Conrad feed helpers', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('reads the TradeTracker Conrad feed config with sensible merchant defaults', () => {
    process.env.TRADETRACKER_CONRAD_FEED_URL =
      'https://pf.tradetracker.net/example/conrad.xml';

    expect(hasTradeTrackerConradFeedConfig()).toBe(true);
    expect(getMissingTradeTrackerConradEnvKeys()).toEqual([]);
    expect(getTradeTrackerConradFeedConfig()).toEqual({
      feedUrl: 'https://pf.tradetracker.net/example/conrad.xml',
      merchantSlug: 'conrad',
      merchantName: 'Conrad',
    });
  });

  test('allows explicit Conrad merchant overrides for the TradeTracker feed config', () => {
    process.env.TRADETRACKER_CONRAD_FEED_URL =
      'https://pf.tradetracker.net/example/conrad.xml';
    process.env.TRADETRACKER_CONRAD_MERCHANT_SLUG = 'conrad-nl';
    process.env.TRADETRACKER_CONRAD_MERCHANT_NAME = 'Conrad Nederland';

    expect(getTradeTrackerConradFeedConfig()).toEqual({
      feedUrl: 'https://pf.tradetracker.net/example/conrad.xml',
      merchantSlug: 'conrad-nl',
      merchantName: 'Conrad Nederland',
    });
  });

  test('reports the missing TradeTracker Conrad feed URL', () => {
    delete process.env.TRADETRACKER_CONRAD_FEED_URL;

    expect(hasTradeTrackerConradFeedConfig()).toBe(false);
    expect(getMissingTradeTrackerConradEnvKeys()).toEqual([
      tradeTrackerConradEnvKeys.feedUrl,
    ]);
  });
});

describe('shared config MisterBricks feed helpers', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('reads the MisterBricks feed config with sensible merchant defaults', () => {
    process.env.MISTERBRICKS_FEED_URL =
      'https://files.channable.com/misterbricks.xml';

    expect(hasMisterBricksFeedConfig()).toBe(true);
    expect(getMissingMisterBricksEnvKeys()).toEqual([]);
    expect(getMisterBricksFeedConfig()).toEqual({
      feedUrl: 'https://files.channable.com/misterbricks.xml',
      merchantSlug: 'misterbricks',
      merchantName: 'MisterBricks',
    });
  });

  test('allows explicit MisterBricks merchant overrides', () => {
    process.env.MISTERBRICKS_FEED_URL =
      'https://files.channable.com/misterbricks.xml';
    process.env.MISTERBRICKS_MERCHANT_SLUG = 'misterbricks-nl';
    process.env.MISTERBRICKS_MERCHANT_NAME = 'Mister Bricks NL';

    expect(getMisterBricksFeedConfig()).toEqual({
      feedUrl: 'https://files.channable.com/misterbricks.xml',
      merchantSlug: 'misterbricks-nl',
      merchantName: 'Mister Bricks NL',
    });
  });

  test('reports the missing MisterBricks feed URL', () => {
    delete process.env.MISTERBRICKS_FEED_URL;

    expect(hasMisterBricksFeedConfig()).toBe(false);
    expect(getMissingMisterBricksEnvKeys()).toEqual([
      misterBricksEnvKeys.feedUrl,
    ]);
  });
});
