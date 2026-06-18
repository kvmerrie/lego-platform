import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Fastify from 'fastify';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { CatalogCurrentOfferSummaryRecord } from '@lego-platform/catalog/data-access-server';
import type { CommerceMerchant } from '@lego-platform/commerce/util';
import {
  createPublicPartnerWidgetRoutes,
  partnerWidgetApiPath,
  type PublicPartnerWidgetRouteDependencies,
} from '../app/routes/public-partner-widget';

const allowedOrigin = 'https://www.uniekebricks.nl';
const allowedReferer = 'https://www.uniekebricks.nl/lego/rivendell/';
const partnerWidgetConfig = {
  enabled: true,
  allowedOrigins: [allowedOrigin, 'https://uniekebricks.nl'],
  allowedModes: ['all', 'top3', 'winner'],
} as const;
const checkedAt = '2026-06-18T10:00:00.000Z';

function createMerchant({
  name,
  slug,
}: {
  name?: string;
  slug: string;
}): CommerceMerchant {
  return {
    id: `merchant-${slug}`,
    slug,
    name: name ?? slug,
    isActive: true,
    sourceType: 'direct',
    notes: '',
    createdAt: '2026-06-18T09:00:00.000Z',
    updatedAt: '2026-06-18T09:00:00.000Z',
  };
}

function createOffer({
  merchantName,
  merchantSlug,
  priceCents,
}: {
  merchantName?: string;
  merchantSlug: string;
  priceCents: number;
}): CatalogCurrentOfferSummaryRecord['offers'][number] {
  return {
    availability: 'in_stock',
    checkedAt,
    condition: 'new',
    commercialUnitType: 'full_set',
    currency: 'EUR',
    market: 'NL',
    merchant: 'other',
    merchantName: merchantName ?? merchantSlug,
    merchantSlug,
    priceCents,
    setId: '10316',
    url: `https://${merchantSlug}.example.test/10316`,
  };
}

function createCurrentOfferSummary(
  offers: CatalogCurrentOfferSummaryRecord['offers'],
): CatalogCurrentOfferSummaryRecord {
  return {
    bestOffer: offers[0],
    offers,
    setId: '10316',
  };
}

async function createPartnerWidgetServer({
  getCatalogSetById = vi.fn(async (setId: string) =>
    setId === '10316'
      ? {
          name: 'Rivendell',
          setId: '10316',
          slug: 'lord-of-the-rings-rivendell-10316',
        }
      : undefined,
  ),
  isDevPreviewRuntime = vi.fn(() => false),
  getPartnerWidgetConfig = vi.fn(() => partnerWidgetConfig),
  listCatalogCurrentOfferSummariesBySetIds = vi.fn(async () => [
    createCurrentOfferSummary([
      createOffer({
        merchantName: 'Unieke Bricks',
        merchantSlug: 'uniekebricks',
        priceCents: 32999,
      }),
      createOffer({
        merchantName: 'Goodbricks',
        merchantSlug: 'goodbricks',
        priceCents: 34999,
      }),
    ]),
  ]),
  listCommerceMerchants = vi.fn(async () => [
    createMerchant({
      name: 'Unieke Bricks',
      slug: 'uniekebricks',
    }),
    createMerchant({
      name: 'Goodbricks',
      slug: 'goodbricks',
    }),
    createMerchant({
      name: 'Mister Bricks',
      slug: 'misterbricks',
    }),
    createMerchant({
      name: 'Brickspoint',
      slug: 'brickspoint',
    }),
  ]),
}: PublicPartnerWidgetRouteDependencies = {}) {
  const server = Fastify();

  await server.register(
    createPublicPartnerWidgetRoutes({
      getCatalogSetById,
      isDevPreviewRuntime,
      getPartnerWidgetConfig,
      listCatalogCurrentOfferSummariesBySetIds,
      listCommerceMerchants,
    }),
  );

  return server;
}

function widgetUrl({
  devPreview,
  merchantSlug = 'uniekebricks',
  mode = 'all',
  setId = '10316',
  status,
}: {
  devPreview?: string;
  merchantSlug?: string;
  mode?: string;
  setId?: string;
  status?: string;
} = {}) {
  const params = new URLSearchParams({
    merchantSlug,
    mode,
    setId,
  });

  if (devPreview) {
    params.set('devPreview', devPreview);
  }

  if (status) {
    params.set('status', status);
  }

  return `${partnerWidgetApiPath}?${params.toString()}`;
}

async function expectWidgetStatus({
  merchantSlug,
  mode,
  offers,
}: {
  merchantSlug: string;
  mode: string;
  offers: CatalogCurrentOfferSummaryRecord['offers'];
}) {
  const server = await createPartnerWidgetServer({
    listCatalogCurrentOfferSummariesBySetIds: vi.fn(async () => [
      createCurrentOfferSummary(offers),
    ]),
  });
  const response = await server.inject({
    method: 'GET',
    url: widgetUrl({ merchantSlug, mode }),
    headers: {
      origin: allowedOrigin,
    },
  });

  await server.close();

  return response;
}

describe('public partner widget endpoint', () => {
  test('allows a whitelisted Origin header', async () => {
    const server = await createPartnerWidgetServer();

    const response = await server.inject({
      method: 'GET',
      url: widgetUrl(),
      headers: {
        origin: allowedOrigin,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(allowedOrigin);
    expect(response.json()).toMatchObject({
      setId: '10316',
      setTitle: 'Rivendell',
      merchantSlug: 'uniekebricks',
      merchantName: 'Unieke Bricks',
      merchantPrice: 32999,
      lowestPrice: 32999,
      rank: 1,
      totalMerchantsCompared: 2,
      isCheapest: true,
      isTop3: true,
      status: 'winner',
      brickhuntUrl:
        'https://www.brickhunt.nl/sets/lord-of-the-rings-rivendell-10316',
      lastUpdated: checkedAt,
    });

    await server.close();
  });

  test('allows a whitelisted Referer fallback when Origin is missing', async () => {
    const server = await createPartnerWidgetServer();

    const response = await server.inject({
      method: 'GET',
      url: widgetUrl(),
      headers: {
        referer: allowedReferer,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(allowedOrigin);

    await server.close();
  });

  test('rejects requests without Origin or Referer', async () => {
    const server = await createPartnerWidgetServer();

    const response = await server.inject({
      method: 'GET',
      url: widgetUrl(),
    });

    expect(response.statusCode).toBe(403);

    await server.close();
  });

  test('rejects non-whitelisted origins', async () => {
    const server = await createPartnerWidgetServer();

    const response = await server.inject({
      method: 'GET',
      url: widgetUrl(),
      headers: {
        origin: 'https://shop.example.test',
      },
    });

    expect(response.statusCode).toBe(403);

    await server.close();
  });

  test('allows dev preview bypass without Origin in non-production', async () => {
    const server = await createPartnerWidgetServer({
      isDevPreviewRuntime: vi.fn(() => true),
    });

    const response = await server.inject({
      method: 'GET',
      url: widgetUrl({ devPreview: '1' }),
      headers: {
        'x-brickhunt-dev-widget-preview': '1',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-brickhunt-dev-widget-preview']).toBe('1');
    expect(response.json()).toMatchObject({
      merchantSlug: 'uniekebricks',
      status: 'winner',
    });

    await server.close();
  });

  test('ignores dev preview bypass in production', async () => {
    const server = await createPartnerWidgetServer({
      isDevPreviewRuntime: vi.fn(() => false),
    });

    const response = await server.inject({
      method: 'GET',
      url: widgetUrl({ devPreview: '1' }),
      headers: {
        'x-brickhunt-dev-widget-preview': '1',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.headers['x-brickhunt-dev-widget-preview']).toBeUndefined();

    await server.close();
  });

  test('serves mock states only during dev preview', async () => {
    const devServer = await createPartnerWidgetServer({
      isDevPreviewRuntime: vi.fn(() => true),
    });
    const productionServer = await createPartnerWidgetServer({
      isDevPreviewRuntime: vi.fn(() => false),
    });

    const devResponse = await devServer.inject({
      method: 'GET',
      url: widgetUrl({
        devPreview: '1',
        merchantSlug: 'future-woocommerce-shop',
        status: 'top3',
      }),
      headers: {
        'x-brickhunt-dev-widget-preview': '1',
      },
    });
    const productionResponse = await productionServer.inject({
      method: 'GET',
      url: widgetUrl({
        devPreview: '1',
        status: 'top3',
      }),
      headers: {
        'x-brickhunt-dev-widget-preview': '1',
      },
    });

    expect(devResponse.statusCode).toBe(200);
    expect(devResponse.headers['x-brickhunt-dev-widget-preview']).toBe('1');
    expect(devResponse.json()).toMatchObject({
      merchantSlug: 'future-woocommerce-shop',
      rank: 2,
      status: 'top3',
    });
    expect(productionResponse.statusCode).toBe(403);

    await devServer.close();
    await productionServer.close();
  });

  test('returns mock no-data as 204 during dev preview', async () => {
    const server = await createPartnerWidgetServer({
      isDevPreviewRuntime: vi.fn(() => true),
    });

    const response = await server.inject({
      method: 'GET',
      url: widgetUrl({
        devPreview: '1',
        status: 'no-data',
      }),
      headers: {
        'x-brickhunt-dev-widget-preview': '1',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['x-brickhunt-dev-widget-preview']).toBe('1');

    await server.close();
  });

  test('does not fall back to Referer when Origin is present', async () => {
    const server = await createPartnerWidgetServer();

    const response = await server.inject({
      method: 'GET',
      url: widgetUrl(),
      headers: {
        origin: 'https://shop.example.test',
        referer: allowedReferer,
      },
    });

    expect(response.statusCode).toBe(403);

    await server.close();
  });

  test('returns 404 for an unknown merchant', async () => {
    const server = await createPartnerWidgetServer();

    const response = await server.inject({
      method: 'GET',
      url: widgetUrl({ merchantSlug: 'unknown-shop' }),
      headers: {
        origin: allowedOrigin,
      },
    });

    expect(response.statusCode).toBe(404);

    await server.close();
  });

  test('returns 404 for an unknown set', async () => {
    const server = await createPartnerWidgetServer();

    const response = await server.inject({
      method: 'GET',
      url: widgetUrl({ setId: '99999' }),
      headers: {
        origin: allowedOrigin,
      },
    });

    expect(response.statusCode).toBe(404);

    await server.close();
  });

  test('rejects merchants with a disabled partnerWidget config', async () => {
    const server = await createPartnerWidgetServer({
      getPartnerWidgetConfig: vi.fn(() => ({
        ...partnerWidgetConfig,
        enabled: false,
      })),
    });

    const response = await server.inject({
      method: 'GET',
      url: widgetUrl(),
      headers: {
        origin: allowedOrigin,
      },
    });

    expect(response.statusCode).toBe(403);

    await server.close();
  });

  test('renders winner mode only for the cheapest merchant', async () => {
    const offers = [
      createOffer({ merchantSlug: 'uniekebricks', priceCents: 10000 }),
      createOffer({ merchantSlug: 'goodbricks', priceCents: 11000 }),
    ];
    const winnerResponse = await expectWidgetStatus({
      merchantSlug: 'uniekebricks',
      mode: 'winner',
      offers,
    });
    const checkedResponse = await expectWidgetStatus({
      merchantSlug: 'goodbricks',
      mode: 'winner',
      offers,
    });

    expect(winnerResponse.statusCode).toBe(200);
    expect(winnerResponse.json()).toMatchObject({
      rank: 1,
      status: 'winner',
    });
    expect(checkedResponse.statusCode).toBe(204);
  });

  test('renders top3 mode for price ranks 1, 2 and 3', async () => {
    const offers = [
      createOffer({ merchantSlug: 'uniekebricks', priceCents: 10000 }),
      createOffer({ merchantSlug: 'goodbricks', priceCents: 11000 }),
      createOffer({ merchantSlug: 'misterbricks', priceCents: 12000 }),
      createOffer({ merchantSlug: 'brickspoint', priceCents: 13000 }),
    ];
    const firstResponse = await expectWidgetStatus({
      merchantSlug: 'uniekebricks',
      mode: 'top3',
      offers,
    });
    const secondResponse = await expectWidgetStatus({
      merchantSlug: 'goodbricks',
      mode: 'top3',
      offers,
    });
    const thirdResponse = await expectWidgetStatus({
      merchantSlug: 'misterbricks',
      mode: 'top3',
      offers,
    });
    const fourthResponse = await expectWidgetStatus({
      merchantSlug: 'brickspoint',
      mode: 'top3',
      offers,
    });

    expect(firstResponse.statusCode).toBe(200);
    expect(firstResponse.json()).toMatchObject({ rank: 1, status: 'winner' });
    expect(secondResponse.statusCode).toBe(200);
    expect(secondResponse.json()).toMatchObject({ rank: 2, status: 'top3' });
    expect(thirdResponse.statusCode).toBe(200);
    expect(thirdResponse.json()).toMatchObject({ rank: 3, status: 'top3' });
    expect(fourthResponse.statusCode).toBe(204);
  });

  test('renders checked in all mode outside the top 3', async () => {
    const response = await expectWidgetStatus({
      merchantSlug: 'brickspoint',
      mode: 'all',
      offers: [
        createOffer({ merchantSlug: 'uniekebricks', priceCents: 10000 }),
        createOffer({ merchantSlug: 'goodbricks', priceCents: 11000 }),
        createOffer({ merchantSlug: 'misterbricks', priceCents: 12000 }),
        createOffer({ merchantSlug: 'brickspoint', priceCents: 13000 }),
      ],
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      rank: 4,
      status: 'checked',
      isCheapest: false,
      isTop3: false,
    });
  });

  test('treats tied lowest prices as winners', async () => {
    const response = await expectWidgetStatus({
      merchantSlug: 'goodbricks',
      mode: 'winner',
      offers: [
        createOffer({ merchantSlug: 'uniekebricks', priceCents: 10000 }),
        createOffer({ merchantSlug: 'goodbricks', priceCents: 10000 }),
        createOffer({ merchantSlug: 'misterbricks', priceCents: 12000 }),
      ],
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      lowestPrice: 10000,
      rank: 1,
      status: 'winner',
      isCheapest: true,
    });
  });

  test('returns 204 when the merchant has no current price for the set', async () => {
    const response = await expectWidgetStatus({
      merchantSlug: 'goodbricks',
      mode: 'all',
      offers: [
        createOffer({ merchantSlug: 'uniekebricks', priceCents: 10000 }),
      ],
    });

    expect(response.statusCode).toBe(204);
  });
});

function readPartnerBadgeScript() {
  return readFileSync(
    join(process.cwd(), '..', 'web', 'public', 'widgets', 'partner-badge.js'),
    'utf-8',
  );
}

function flushPartnerBadgePromises() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function runPartnerBadgeScript({
  attributes = '',
  response,
}: {
  attributes?: string;
  response: {
    headers?: {
      get: (headerName: string) => string | null;
    };
    json?: () => Promise<unknown>;
    ok: boolean;
    status: number;
  };
}) {
  const dom = new JSDOM(
    `<!doctype html><html><body><main><script src="https://www.brickhunt.nl/widgets/partner-badge.js" data-set-id="10316" data-merchant-slug="uniekebricks" data-mode="all" ${attributes}></script></main></body></html>`,
    {
      runScripts: 'outside-only',
      url: 'https://www.uniekebricks.nl/lego/rivendell/',
    },
  );
  const script = dom.window.document.querySelector('script');
  const fetchMock = vi.fn(async (input: string, init?: unknown) => {
    void input;
    void init;

    return response;
  });

  if (!script) {
    throw new Error('Expected partner widget script element.');
  }

  Object.defineProperty(dom.window.document, 'currentScript', {
    configurable: true,
    get: () => script,
  });
  Object.defineProperty(dom.window, 'fetch', {
    configurable: true,
    value: fetchMock,
  });

  dom.window.eval(readPartnerBadgeScript());
  await flushPartnerBadgePromises();

  return {
    dom,
    fetchMock,
  };
}

describe('partner badge embed script', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test.each([204, 403])('renders nothing for status %s', async (status) => {
    const { dom } = await runPartnerBadgeScript({
      response: {
        ok: false,
        status,
      },
    });

    expect(
      dom.window.document.querySelector('brickhunt-partner-badge'),
    ).toBeNull();
  });

  test('works without optional attributes and defaults to compact layout', async () => {
    const { dom, fetchMock } = await runPartnerBadgeScript({
      response: {
        ok: true,
        status: 200,
        json: async () => ({
          brickhuntUrl:
            'https://www.brickhunt.nl/sets/lord-of-the-rings-rivendell-10316?existing=1',
          status: 'winner',
        }),
      },
    });
    const badge = dom.window.document.querySelector('brickhunt-partner-badge');
    const link = badge?.shadowRoot?.querySelector('.cta');
    const poweredLink = badge?.shadowRoot?.querySelector('.powered a');
    const poweredIcon = badge?.shadowRoot?.querySelector('.powered img');
    const section = badge?.shadowRoot?.querySelector('section');
    const fetchUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    const fetchOptions = fetchMock.mock.calls[0]?.[1] as
      | { headers?: Record<string, string> }
      | undefined;
    const linkUrl = new URL(link?.getAttribute('href') ?? '');
    const poweredUrl = new URL(poweredLink?.getAttribute('href') ?? '');

    expect(fetchUrl.origin).toBe('https://www.brickhunt.nl');
    expect(fetchUrl.pathname).toBe('/api/public/partner-widget');
    expect(fetchUrl.searchParams.get('setId')).toBe('10316');
    expect(fetchUrl.searchParams.get('merchantSlug')).toBe('uniekebricks');
    expect(fetchUrl.searchParams.get('devPreview')).toBeNull();
    expect(fetchOptions?.headers).toBeUndefined();
    expect(section?.className).toContain('winner');
    expect(section?.className).toContain('compact');
    expect(section?.textContent).toContain(
      'Beste prijs gevalideerd door Brickhunt',
    );
    expect(section?.textContent).toContain('Powered by Brickhunt');
    expect(poweredIcon?.getAttribute('src')).toBe(
      'https://www.brickhunt.nl/favicon-32x32.png',
    );
    expect(poweredIcon?.getAttribute('alt')).toBe('');
    expect(linkUrl.origin).toBe('https://www.brickhunt.nl');
    expect(linkUrl.pathname).toBe('/sets/lord-of-the-rings-rivendell-10316');
    expect(linkUrl.searchParams.get('existing')).toBe('1');
    expect(linkUrl.searchParams.get('utm_source')).toBe('partner_badge');
    expect(linkUrl.searchParams.get('utm_medium')).toBe('widget');
    expect(linkUrl.searchParams.get('utm_campaign')).toBe('uniekebricks');
    expect(linkUrl.searchParams.get('utm_content')).toBe('winner_compact_all');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener sponsored');
    expect(link?.textContent).toBe('Bekijk validatie');
    expect(poweredUrl.origin).toBe('https://www.brickhunt.nl');
    expect(poweredUrl.pathname).toBe('/');
    expect(poweredUrl.searchParams.get('utm_source')).toBe('partner_badge');
    expect(poweredUrl.searchParams.get('utm_medium')).toBe('powered_by');
    expect(poweredUrl.searchParams.get('utm_campaign')).toBe('uniekebricks');
    expect(poweredUrl.searchParams.get('utm_content')).toBe(
      'winner_compact_all',
    );
    expect(poweredLink?.getAttribute('target')).toBe('_blank');
    expect(poweredLink?.getAttribute('rel')).toBe('noopener sponsored');
    expect(poweredLink?.textContent).toBe('Brickhunt');
  });

  test('renders the card layout with configurable API base URL', async () => {
    const { dom, fetchMock } = await runPartnerBadgeScript({
      attributes:
        'data-api-base-url="https://api.brickhunt.test" data-dev-preview="true" data-layout="card" data-mock-status="top3"',
      response: {
        ok: true,
        status: 200,
        json: async () => ({
          brickhuntUrl:
            'https://www.brickhunt.nl/sets/lord-of-the-rings-rivendell-10316',
          merchantName: 'Unieke Bricks',
          merchantPrice: 34999,
          status: 'top3',
        }),
      },
    });
    const badge = dom.window.document.querySelector('brickhunt-partner-badge');
    const section = badge?.shadowRoot?.querySelector('section');
    const fetchUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    const fetchOptions = fetchMock.mock.calls[0]?.[1] as
      | { headers?: Record<string, string> }
      | undefined;

    expect(fetchUrl.origin).toBe('https://api.brickhunt.test');
    expect(fetchUrl.searchParams.get('devPreview')).toBe('1');
    expect(fetchUrl.searchParams.get('status')).toBe('top3');
    expect(fetchOptions?.headers).toEqual({
      'x-brickhunt-dev-widget-preview': '1',
    });
    expect(section?.className).toContain('top3');
    expect(section?.className).toContain('card');
    expect(section?.textContent).toContain(
      '\u20ac\u00a0349,99 bij Unieke Bricks',
    );
  });

  test.each([
    {
      body: 'Brickhunt heeft bevestigd dat deze webshop momenteel de beste prijs heeft voor deze LEGO-set.',
      status: 'winner',
      title: 'Beste prijs gevalideerd',
    },
    {
      body: 'Brickhunt heeft bevestigd dat deze prijs tot de beste aanbiedingen behoort.',
      status: 'top3',
      title: 'Topaanbieding gevalideerd',
    },
    {
      body: 'Brickhunt heeft deze prijs gecontroleerd en vergeleken met andere LEGO-winkels.',
      status: 'checked',
      title: 'Prijs gecontroleerd',
    },
  ])('renders card copy for %s', async ({ body, status, title }) => {
    const { dom } = await runPartnerBadgeScript({
      attributes: 'data-layout="card"',
      response: {
        ok: true,
        status: 200,
        json: async () => ({
          brickhuntUrl:
            'https://www.brickhunt.nl/sets/lord-of-the-rings-rivendell-10316',
          merchantName: 'Unieke Bricks',
          merchantPrice: 34999,
          merchantSlug: 'uniekebricks',
          status,
        }),
      },
    });
    const section = dom.window.document
      .querySelector('brickhunt-partner-badge')
      ?.shadowRoot?.querySelector('section');
    const link = section?.querySelector('.cta');
    const linkUrl = new URL(link?.getAttribute('href') ?? '');

    expect(section?.className).toContain('card');
    expect(section?.textContent).toContain(title);
    expect(section?.textContent).toContain(body);
    expect(link?.textContent).toBe('Bekijk validatie');
    expect(linkUrl.searchParams.get('utm_content')).toBe(`${status}_card_all`);
  });

  test.each([
    {
      compactTitle: 'Beste prijs gevalideerd door Brickhunt',
      status: 'winner',
    },
    {
      compactTitle: 'Topaanbieding gevalideerd door Brickhunt',
      status: 'top3',
    },
    {
      compactTitle: 'Prijs gecontroleerd door Brickhunt',
      status: 'checked',
    },
  ])('renders compact copy for %s', async ({ compactTitle, status }) => {
    const { dom } = await runPartnerBadgeScript({
      response: {
        ok: true,
        status: 200,
        json: async () => ({
          brickhuntUrl:
            'https://www.brickhunt.nl/sets/lord-of-the-rings-rivendell-10316',
          status,
        }),
      },
    });
    const section = dom.window.document
      .querySelector('brickhunt-partner-badge')
      ?.shadowRoot?.querySelector('section');

    expect(section?.className).toContain('compact');
    expect(section?.textContent).toContain(compactTitle);
    expect(section?.textContent).not.toContain('Vergelijk prijzen');
  });
});
