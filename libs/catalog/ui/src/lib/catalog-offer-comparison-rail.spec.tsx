/** @vitest-environment jsdom */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ReactNode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogOfferItem } from './catalog-commerce-ui';
import { getMerchantFaviconUrl } from './catalog-merchant-brand';
import {
  CatalogOfferComparisonRail,
  getOfferRailPriceDeltaPresentation,
} from './catalog-offer-comparison-rail';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const offers = [
  {
    checkedLabel: 'Vandaag om 09:00',
    ctaHref: 'https://example.com/best',
    ctaLabel: 'Bekijk bij bol',
    isBest: true,
    merchantLabel: 'bol',
    price: '€ 89,99',
    rankingLabel: 'Laagste nagekeken prijs op voorraad.',
    stockLabel: 'Op voorraad',
    trackingEvent: {
      event: 'offer_click',
      properties: {
        offerPlacement: 'comparison_row',
        offerRole: 'best',
        rankPosition: 1,
        setId: '10316',
      },
    },
  },
  {
    checkedLabel: 'Vandaag om 09:05',
    ctaHref: 'https://example.com/alternative',
    ctaLabel: 'Bekijk bij LEGO',
    merchantLabel: 'LEGO',
    price: '€ 94,99',
    rankingLabel: '€ 5,00 hoger dan de beste optie.',
    stockLabel: 'Op voorraad',
    trackingEvent: {
      event: 'offer_click',
      properties: {
        offerPlacement: 'comparison_row',
        offerRole: 'alternative',
        rankPosition: 2,
        setId: '10316',
      },
    },
  },
];

function makeOverflowOffers(
  primaryOffers: readonly CatalogOfferItem[] = offers,
): CatalogOfferItem[] {
  return [
    ...primaryOffers,
    ...Array.from(
      { length: Math.max(0, 21 - primaryOffers.length) },
      (_, index) => ({
        checkedLabel: 'Vandaag om 09:10',
        ctaHref: `https://example.com/overflow-${index + 1}`,
        ctaLabel: `Bekijk bij Shop ${index + 1}`,
        merchantLabel: `Shop ${index + 1}`,
        price: `€ ${99 + index},99`,
        rankingLabel: `€ ${10 + index},00 hoger dan de beste optie.`,
        stockLabel: 'Op voorraad',
      }),
    ),
  ];
}

describe('CatalogOfferComparisonRail overlay', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.innerHTML = '';
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  });

  async function flushAnimationFrame() {
    await act(async () => {
      await new Promise<void>((resolvePromise) => {
        window.requestAnimationFrame(() => resolvePromise());
      });
    });
  }

  async function finishOverlayClose() {
    const dialog = document.body.querySelector(
      '[data-offer-comparison-dialog="true"]',
    );

    expect(dialog?.getAttribute('data-responsive-dialog-state')).toBe(
      'closing',
    );

    await act(async () => {
      dialog?.dispatchEvent(new Event('transitionend', { bubbles: true }));
    });
    await flushAnimationFrame();
  }

  async function openOverlay({
    overlayOffers = makeOverflowOffers(),
    summaryLabel = '21 winkels nagekeken',
  }: {
    overlayOffers?: readonly CatalogOfferItem[];
    summaryLabel?: string;
  } = {}) {
    act(() => {
      root.render(
        <CatalogOfferComparisonRail
          offers={overlayOffers}
          summaryLabel={summaryLabel}
        />,
      );
    });

    const trigger = container.querySelector(
      `h2 button[aria-label="Vergelijk alle ${overlayOffers.length} winkels"]`,
    ) as HTMLButtonElement | null;

    expect(trigger).not.toBeNull();
    trigger?.focus();

    act(() => {
      trigger?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await flushAnimationFrame();

    return trigger;
  }

  function getVisibleOfferCard(merchantLabel: string): HTMLElement {
    const card = Array.from(
      container.querySelectorAll<HTMLElement>(
        'article[class*="offerRailCard"]',
      ),
    ).find((candidate) => candidate.textContent?.includes(merchantLabel));

    expect(card).not.toBeUndefined();

    return card as HTMLElement;
  }

  it('does not duplicate the LEGO merchant label in compact offer text', () => {
    act(() => {
      root.render(
        <CatalogOfferComparisonRail
          offers={[
            {
              checkedLabel: 'Vandaag om 09:00',
              ctaHref: 'https://example.com/lego',
              ctaLabel: 'Bekijk deal bij LEGO®',
              isBest: true,
              merchantLabel: 'LEGO®',
              price: '€ 59,99',
              rankingLabel: 'Laagste nagekeken prijs op voorraad.',
              stockLabel: 'Op voorraad',
            },
          ]}
          summaryLabel="1 winkel nagekeken"
        />,
      );
    });

    expect(container.textContent).toContain('LEGO®');
    expect(container.textContent).not.toContain('LEGO® LEGO®');
  });

  it('uses the canonical best offer for the best-deal badge even when a stale lower price is visible', () => {
    act(() => {
      root.render(
        <CatalogOfferComparisonRail
          offers={[
            {
              checkedLabel: 'Vandaag om 06:06',
              ctaHref: 'https://example.com/proshop',
              ctaLabel: 'Bekijk bij Proshop',
              isBest: true,
              merchantLabel: 'Proshop',
              merchantSlug: 'proshop',
              price: '€ 176,67',
              rankingLabel: 'Laagste prijs op voorraad',
              stockLabel: 'Op voorraad',
            },
            {
              checkedLabel: '7 mei om 05:01',
              ctaHref: 'https://example.com/mediamarkt',
              ctaLabel: 'Bekijk bij MediaMarkt',
              merchantLabel: 'MediaMarkt',
              merchantSlug: 'mediamarkt',
              price: '€ 175,00',
              rankingLabel: '€ 1,67 lager, maar niet recent genoeg',
              stockLabel: 'Op voorraad',
            },
            {
              checkedLabel: 'Vandaag om 09:02',
              ctaHref: 'https://example.com/lego',
              ctaLabel: 'Bekijk bij LEGO',
              merchantLabel: 'LEGO',
              merchantSlug: 'lego-nl',
              price: '€ 249,99',
              rankingLabel: 'LEGO adviesprijs',
              stockLabel: 'Op voorraad',
            },
          ]}
          summaryLabel="3 winkels nagekeken"
        />,
      );
    });

    const proshopCard = getVisibleOfferCard('Proshop');
    const mediaMarktCard = getVisibleOfferCard('MediaMarkt');

    expect(proshopCard.getAttribute('data-best')).toBe('true');
    expect(proshopCard.textContent).toContain('Beste deal');
    expect(proshopCard.textContent).toContain('Naar winkel');
    expect(mediaMarktCard.getAttribute('data-best')).toBe('false');
    expect(mediaMarktCard.textContent).not.toContain('Beste deal');
    expect(mediaMarktCard.textContent).toContain(
      '€ 1,67 lager, maar niet recent genoeg',
    );
  });

  it('treats a one-cent price difference as enough for a single best deal badge', () => {
    act(() => {
      root.render(
        <CatalogOfferComparisonRail
          offers={[
            {
              checkedLabel: 'Vandaag om 09:00',
              ctaHref: 'https://example.com/proshop',
              ctaLabel: 'Bekijk bij Proshop',
              merchantLabel: 'Proshop',
              price: '€ 178,74',
              stockLabel: 'Op voorraad',
            },
            {
              checkedLabel: 'Vandaag om 09:01',
              ctaHref: 'https://example.com/coolblue',
              ctaLabel: 'Bekijk bij Coolblue',
              merchantLabel: 'Coolblue',
              price: '€ 178,75',
              stockLabel: 'Op voorraad',
            },
          ]}
          summaryLabel="2 winkels nagekeken"
        />,
      );
    });

    const proshopCard = getVisibleOfferCard('Proshop');
    const coolblueCard = getVisibleOfferCard('Coolblue');

    expect(proshopCard.getAttribute('data-best')).toBe('true');
    expect(coolblueCard.getAttribute('data-best')).toBe('false');
    expect(coolblueCard.textContent).not.toContain('€0,01 duurder');
  });

  it('marks exact price ties as shared best deal cards', () => {
    act(() => {
      root.render(
        <CatalogOfferComparisonRail
          offers={[
            {
              checkedLabel: 'Vandaag om 09:00',
              ctaHref: 'https://example.com/proshop',
              ctaLabel: 'Bekijk bij Proshop',
              merchantLabel: 'Proshop',
              price: '€ 178,74',
              stockLabel: 'Op voorraad',
            },
            {
              checkedLabel: 'Vandaag om 09:01',
              ctaHref: 'https://example.com/coolblue',
              ctaLabel: 'Bekijk bij Coolblue',
              merchantLabel: 'Coolblue',
              price: '€ 178,74',
              stockLabel: 'Op voorraad',
            },
          ]}
          summaryLabel="2 winkels nagekeken"
        />,
      );
    });

    const proshopCard = getVisibleOfferCard('Proshop');
    const coolblueCard = getVisibleOfferCard('Coolblue');

    expect(proshopCard.getAttribute('data-best')).toBe('true');
    expect(coolblueCard.getAttribute('data-best')).toBe('true');
    expect(proshopCard.textContent).toContain('Beste deal');
    expect(coolblueCard.textContent).toContain('Beste deal');
  });

  it('renders a favicon for a known merchant while keeping the merchant name visible', () => {
    act(() => {
      root.render(
        <CatalogOfferComparisonRail
          offers={[
            {
              checkedLabel: 'Vandaag om 09:00',
              ctaHref: 'https://example.com/lego',
              ctaLabel: 'Bekijk bij LEGO',
              isBest: true,
              merchantLabel: 'LEGO',
              merchantSlug: 'lego-nl',
              price: '€ 59,99',
              rankingLabel: 'Laagste nagekeken prijs op voorraad.',
              stockLabel: 'Op voorraad',
            },
          ]}
          summaryLabel="1 winkel nagekeken"
        />,
      );
    });

    const favicon = container.querySelector<HTMLImageElement>(
      'img[src="/merchant-favicons/lego-nl.png"]',
    );

    expect(favicon).not.toBeNull();
    expect(favicon?.getAttribute('alt')).toBe('');
    expect(favicon?.getAttribute('loading')).toBe('lazy');
    expect(favicon?.getAttribute('decoding')).toBe('async');
    expect(container.textContent).toContain('LEGO');
  });

  it('renders the full merchant name as a native title only on the merchant text', () => {
    act(() => {
      root.render(
        <CatalogOfferComparisonRail
          offers={[
            {
              checkedLabel: 'Vandaag om 09:00',
              ctaHref: 'https://example.com/goodbricks',
              ctaLabel: 'Bekijk bij Goodbricks',
              isBest: true,
              merchantLabel: 'Goodbricks',
              merchantSlug: 'goodbricks',
              price: '€ 59,99',
              rankingLabel: 'Laagste nagekeken prijs op voorraad.',
              stockLabel: 'Op voorraad',
            },
          ]}
          summaryLabel="1 winkel nagekeken"
        />,
      );
    });

    const merchantText = container.querySelector(
      '[class*="merchantBrandName"]',
    );
    const card = container.querySelector('[class*="offerRailCard"]');
    const action = container.querySelector('[class*="offerRailAction"]');

    expect(merchantText?.getAttribute('title')).toBe('Goodbricks');
    expect(card?.getAttribute('title')).toBeNull();
    expect(action?.getAttribute('title')).toBeNull();
  });

  it('resolves newly added merchant favicon mappings', () => {
    expect(
      getMerchantFaviconUrl({
        merchantLabel: 'Coolblue',
        merchantSlug: 'coolblue',
      }),
    ).toBe('/merchant-favicons/coolblue.png');
    expect(
      getMerchantFaviconUrl({
        merchantLabel: 'MisterBricks',
        merchantSlug: 'misterbricks',
      }),
    ).toBe('/merchant-favicons/misterbricks.png');
    expect(
      getMerchantFaviconUrl({
        merchantLabel: 'Unieke Bricks',
        merchantSlug: 'uniekebricks',
      }),
    ).toBe('/merchant-favicons/uniekebricks.png');
    expect(
      getMerchantFaviconUrl({
        merchantLabel: 'Top1Toys',
        merchantSlug: 'top1toys',
      }),
    ).toBe('/merchant-favicons/top1toys.png');
    expect(
      getMerchantFaviconUrl({
        merchantLabel: 'wehkamp',
        merchantSlug: 'wehkamp',
      }),
    ).toBe('/merchant-favicons/wehkamp.ico');
  });

  it('keeps merchant favicon resolving case-insensitive and tolerant for name variants', () => {
    expect(
      getMerchantFaviconUrl({
        merchantLabel: 'Nu het laagst bij COOLBLUE',
      }),
    ).toBe('/merchant-favicons/coolblue.png');
    expect(
      getMerchantFaviconUrl({
        merchantId: 'merchant-proshop',
        merchantLabel: 'Proshop',
      }),
    ).toBe('/merchant-favicons/proshop.png');
    expect(
      getMerchantFaviconUrl({
        merchantLabel: 'Bij Top 1 Toys',
      }),
    ).toBe('/merchant-favicons/top1toys.png');
    expect(
      getMerchantFaviconUrl({
        merchantSlug: 'lego-eu',
        merchantLabel: 'LEGO®',
      }),
    ).toBe('/merchant-favicons/lego-nl.png');
    expect(
      getMerchantFaviconUrl({
        merchantSlug: 'rakuten-lego-eu',
        merchantLabel: 'LEGO®',
      }),
    ).toBe('/merchant-favicons/lego-nl.png');
    expect(
      getMerchantFaviconUrl({
        merchantLabel: 'Unieke Bricks',
      }),
    ).toBe('/merchant-favicons/uniekebricks.png');
  });

  it('does not render a broken favicon image for an unknown merchant', () => {
    act(() => {
      root.render(
        <CatalogOfferComparisonRail
          offers={[
            {
              checkedLabel: 'Vandaag om 09:00',
              ctaHref: 'https://example.com/unknown',
              ctaLabel: 'Bekijk bij onbekend',
              isBest: true,
              merchantLabel: 'Onbekende winkel',
              merchantSlug: 'unknown-shop',
              price: '€ 59,99',
              rankingLabel: 'Laagste nagekeken prijs op voorraad.',
              stockLabel: 'Op voorraad',
            },
          ]}
          summaryLabel="1 winkel nagekeken"
        />,
      );
    });

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('Onbekende winkel');
  });

  it('uses commercial price-delta labels only when the difference is meaningful', () => {
    const baseOffer: CatalogOfferItem = {
      checkedLabel: 'Vandaag om 09:00',
      ctaHref: 'https://example.com/proshop',
      ctaLabel: 'Bekijk bij Proshop',
      merchantLabel: 'Proshop',
      price: '€ 178,74',
      stockLabel: 'Op voorraad',
    };

    expect(
      getOfferRailPriceDeltaPresentation({
        bestPriceMinor: 17874,
        comparedOfferCount: 3,
        currentPriceMinor: 17874,
        highestComparablePriceMinor: 24999,
        isBestDeal: true,
        legoReferencePriceMinor: 24999,
        nextBestPriceMinor: 17900,
        offer: baseOffer,
        reviewedInStockOfferCount: 3,
      }),
    ).toEqual({
      label: '€71 goedkoper dan LEGO',
      reasonCode: 'best_significant_lego_reference',
      tone: 'positive',
    });

    expect(
      getOfferRailPriceDeltaPresentation({
        bestPriceMinor: 18000,
        comparedOfferCount: 3,
        currentPriceMinor: 18000,
        highestComparablePriceMinor: 24999,
        isBestDeal: true,
        nextBestPriceMinor: 20000,
        offer: baseOffer,
        reviewedInStockOfferCount: 3,
      }),
    ).toEqual({
      label: '€20 goedkoper dan de rest',
      reasonCode: 'best_significant_next_best',
      tone: 'positive',
    });

    expect(
      getOfferRailPriceDeltaPresentation({
        bestPriceMinor: 18000,
        comparedOfferCount: 3,
        currentPriceMinor: 18000,
        highestComparablePriceMinor: 22600,
        isBestDeal: true,
        nextBestPriceMinor: 18100,
        offer: baseOffer,
        reviewedInStockOfferCount: 3,
      }),
    ).toEqual({
      label: 'Bespaar tot €46',
      reasonCode: 'best_significant_highest_comparable',
      tone: 'positive',
    });

    expect(
      getOfferRailPriceDeltaPresentation({
        bestPriceMinor: 17874,
        comparedOfferCount: 3,
        currentPriceMinor: 17874,
        highestComparablePriceMinor: 17900,
        isBestDeal: true,
        nextBestPriceMinor: 17900,
        offer: baseOffer,
        reviewedInStockOfferCount: 3,
      }),
    ).toEqual({
      reasonCode: 'best_no_significant_delta',
      tone: 'neutral',
    });

    expect(
      getOfferRailPriceDeltaPresentation({
        bestPriceMinor: 17874,
        currentPriceMinor: 17900,
        isBestDeal: false,
        offer: {
          ...baseOffer,
          merchantLabel: 'Coolblue',
          price: '€ 179,00',
        },
      }),
    ).toEqual({
      reasonCode: 'alternative_tiny_delta_hidden',
      tone: 'muted',
    });

    expect(
      getOfferRailPriceDeltaPresentation({
        bestPriceMinor: 17874,
        currentPriceMinor: 20299,
        isBestDeal: false,
        offer: {
          ...baseOffer,
          merchantLabel: 'Alternate',
          price: '€ 202,99',
        },
      }),
    ).toEqual({
      label: '€24,25 duurder',
      reasonCode: 'alternative_higher',
      tone: 'neutral',
    });

    expect(
      getOfferRailPriceDeltaPresentation({
        bestPriceMinor: 10000,
        currentPriceMinor: 10000,
        isBestDeal: true,
        nextBestPriceMinor: 10400,
        offer: baseOffer,
        reviewedInStockOfferCount: 2,
      }),
    ).toMatchObject({
      label: '€4 goedkoper dan de rest',
      reasonCode: 'best_significant_next_best',
    });

    expect(
      getOfferRailPriceDeltaPresentation({
        isBestDeal: true,
        offer: baseOffer,
      }),
    ).toEqual({
      reasonCode: 'invalid_comparison_data',
      tone: 'muted',
    });
  });

  it('uses the same merchant favicon resolver and inline brand component in rail and overlay offers', async () => {
    const knownMerchantOffer: CatalogOfferItem = {
      checkedLabel: 'Vandaag om 09:00',
      ctaHref: 'https://example.com/lego',
      ctaLabel: 'Bekijk bij LEGO',
      isBest: true,
      merchantLabel: 'LEGO',
      merchantSlug: 'lego-nl',
      price: '€ 89,99',
      rankingLabel: 'Laagste nagekeken prijs op voorraad.',
      stockLabel: 'Op voorraad',
    };
    const expectedFaviconUrl = getMerchantFaviconUrl(knownMerchantOffer);

    await openOverlay({
      overlayOffers: makeOverflowOffers([knownMerchantOffer, offers[1]]),
      summaryLabel: '2 winkels nagekeken',
    });

    const dialog = document.body.querySelector(
      '[data-offer-comparison-dialog="true"]',
    );
    const railMerchant = container.querySelector(
      '[class*="offerRailMerchant"][class*="merchantBrandInline"]',
    );
    const overlayMerchant = dialog?.querySelector(
      '[class*="offerOverlayMerchant"][class*="merchantBrandInline"]',
    );
    const railFavicon = railMerchant?.querySelector<HTMLImageElement>('img');
    const overlayFavicon =
      overlayMerchant?.querySelector<HTMLImageElement>('img');

    expect(expectedFaviconUrl).toBe('/merchant-favicons/lego-nl.png');
    expect(railFavicon?.getAttribute('src')).toBe(expectedFaviconUrl);
    expect(overlayFavicon?.getAttribute('src')).toBe(expectedFaviconUrl);
    expect(railFavicon?.className).toBe(overlayFavicon?.className);
    expect(railMerchant?.className).toContain('merchantBrandInline');
    expect(overlayMerchant?.className).toContain('merchantBrandInline');
    expect(container.textContent).toContain('LEGO');
    expect(dialog?.textContent).toContain('LEGO');
  });

  it('renders offer rail CTAs with design-system primary and secondary button variants while keeping the full card clickable', () => {
    act(() => {
      root.render(
        <CatalogOfferComparisonRail
          offers={offers}
          summaryLabel="2 winkels nagekeken"
        />,
      );
    });

    const bestDealCard = container.querySelector<HTMLAnchorElement>(
      'a[href="https://example.com/best"]',
    );
    const alternativeCard = container.querySelector<HTMLAnchorElement>(
      'a[href="https://example.com/alternative"]',
    );
    const bestDealAction = bestDealCard?.querySelector<HTMLElement>(
      '[class*="buttonAccent"]',
    );
    const alternativeAction = alternativeCard?.querySelector<HTMLElement>(
      '[class*="buttonSecondary"]',
    );

    expect(bestDealCard?.className).toContain('offerRailCardLink');
    expect(bestDealCard?.getAttribute('aria-label')).toBe(
      'Naar winkel bij bol',
    );
    expect(bestDealCard?.getAttribute('target')).toBe('_blank');
    expect(bestDealCard?.getAttribute('rel')).toBe(
      'noopener noreferrer sponsored',
    );
    expect(bestDealCard?.getAttribute('data-brickhunt-event')).toBe(
      'offer_click',
    );
    expect(bestDealCard?.getAttribute('data-brickhunt-properties')).toContain(
      'comparison_row',
    );
    expect(bestDealAction?.className).toContain('offerRailAction');
    expect(bestDealAction?.className).toContain('buttonAccent');
    expect(bestDealAction?.textContent).toContain('Naar winkel');
    expect(bestDealAction?.innerHTML).toContain('lucide-store');
    expect(alternativeCard?.className).toContain('offerRailCardLink');
    expect(alternativeCard?.getAttribute('aria-label')).toBe(
      'Naar winkel bij LEGO',
    );
    expect(alternativeAction?.className).toContain('offerRailAction');
    expect(alternativeAction?.className).toContain('buttonSecondary');
    expect(alternativeAction?.textContent).toContain('Naar winkel');
  });

  it('keeps the best current offer as a deal card with a merchant CTA', () => {
    act(() => {
      root.render(
        <CatalogOfferComparisonRail
          offers={[
            {
              checkedLabel: 'Vandaag om 09:00',
              ctaHref: 'https://example.com/proshop',
              ctaLabel: 'Bekijk bij Proshop',
              merchantLabel: 'Proshop',
              price: '€ 158,00',
              rankingLabel: '€61 goedkoper dan LEGO',
              stockLabel: 'Op voorraad',
            },
            {
              checkedLabel: 'Vandaag om 09:05',
              ctaHref: 'https://example.com/coolblue',
              ctaLabel: 'Bekijk bij Coolblue',
              merchantLabel: 'Coolblue',
              price: '€ 219,00',
              rankingLabel: 'LEGO referentieprijs',
              stockLabel: 'Op voorraad',
            },
          ]}
          summaryLabel="3 winkels nagekeken"
        />,
      );
    });

    const bestDealCard = container.querySelector<HTMLAnchorElement>(
      'a[href="https://example.com/proshop"]',
    );
    const bestDealAction = bestDealCard?.querySelector<HTMLElement>(
      '[class*="buttonAccent"]',
    );

    expect(bestDealCard).not.toBeNull();
    expect(bestDealCard?.textContent).toContain('Beste deal');
    expect(bestDealCard?.getAttribute('aria-label')).toBe(
      'Naar winkel bij Proshop',
    );
    expect(bestDealAction?.textContent).toContain('Naar winkel');
  });

  it('renders the full comparison trigger on the heading for normal multi-shop rails', () => {
    act(() => {
      root.render(
        <CatalogOfferComparisonRail
          offers={offers}
          summaryLabel="2 winkels nagekeken"
        />,
      );
    });

    const trigger = container.querySelector(
      'h2 button[aria-label="Vergelijk alle 2 winkels"]',
    ) as HTMLButtonElement | null;

    expect(trigger).not.toBeNull();
    expect(trigger?.textContent).toContain('Nu bij 2 winkels');
    expect(trigger?.querySelector('svg')).not.toBeNull();
    expect(container.textContent).not.toContain('Bekijk alle winkels');
  });

  it('does not render the full comparison trigger for a single offer', () => {
    act(() => {
      root.render(
        <CatalogOfferComparisonRail
          offers={[offers[0]]}
          summaryLabel="1 winkel nagekeken"
        />,
      );
    });

    expect(container.textContent).not.toContain('Bekijk alle winkels');
    expect(
      container.querySelector('button[aria-label="Vergelijk alle 1 winkel"]'),
    ).toBeNull();
  });

  it('uses the shared full-screen overlay layer and locks background scroll', async () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );

    await openOverlay();

    const backdrop = document.body.querySelector(
      '[data-offer-comparison-backdrop="true"]',
    );
    const dialog = document.body.querySelector(
      '[data-offer-comparison-dialog="true"]',
    );

    expect(backdrop).not.toBeNull();
    expect(backdrop?.parentElement).toBe(
      document.body.querySelector('[data-responsive-dialog-layer="true"]'),
    );
    expect(dialog).not.toBeNull();
    expect(
      document.body.querySelector('[data-responsive-dialog-panel="true"]'),
    ).toBe(dialog);
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(css).toContain('.offerOverlayBackdrop {');
    expect(css).toContain('background: rgba(12, 18, 32, 0.82);');
    expect(css).toContain('position: fixed;');
    expect(css).toContain('inset: 0;');
    expect(css).toContain('z-index: 1400;');
  });

  it('traps focus, closes on Escape and restores focus to the trigger', async () => {
    const trigger = await openOverlay();
    const dialog = document.body.querySelector<HTMLDivElement>(
      '[data-offer-comparison-dialog="true"]',
    );
    const closeButton = document.body.querySelector<HTMLButtonElement>(
      '[data-offer-comparison-dialog="true"] button[aria-label="Vergelijking sluiten"]',
    );
    const offerLinks = document.body.querySelectorAll<HTMLAnchorElement>(
      '[data-offer-comparison-dialog="true"] a[href]',
    );

    expect(document.activeElement).toBe(closeButton);

    act(() => {
      closeButton?.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'Tab',
          shiftKey: true,
        }),
      );
    });

    expect(document.activeElement).toBe(offerLinks[offerLinks.length - 1]);

    act(() => {
      offerLinks[offerLinks.length - 1]?.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'Tab',
        }),
      );
    });

    expect(document.activeElement).toBe(closeButton);

    act(() => {
      dialog?.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'Escape',
        }),
      );
    });
    await flushAnimationFrame();

    expect(
      document.body.querySelector('[data-offer-comparison-dialog="true"]'),
    ).not.toBeNull();

    await finishOverlayClose();

    expect(
      document.body.querySelector('[data-offer-comparison-dialog="true"]'),
    ).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
    expect(document.activeElement).toBe(trigger);
  });

  it('closes from backdrop click and restores focus to the trigger', async () => {
    const trigger = await openOverlay();
    const backdrop = document.body.querySelector(
      '[data-offer-comparison-backdrop="true"]',
    );

    act(() => {
      backdrop?.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await flushAnimationFrame();

    expect(
      document.body.querySelector('[data-offer-comparison-dialog="true"]'),
    ).not.toBeNull();

    await finishOverlayClose();

    expect(
      document.body.querySelector('[data-offer-comparison-dialog="true"]'),
    ).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('renders compact comparison rows with right-aligned prices and accessible short CTAs', async () => {
    const overlayOffers = makeOverflowOffers();
    await openOverlay({
      overlayOffers,
      summaryLabel: '2 winkels nagekeken · Vandaag om 09:00',
    });

    const dialog = document.body.querySelector(
      '[data-offer-comparison-dialog="true"]',
    );
    const rows = Array.from(
      document.body.querySelectorAll('article[class*="offerOverlayRow"]'),
    );
    const priceCells = Array.from(
      document.body.querySelectorAll('[class*="offerOverlayPriceCell"]'),
    );
    const statusLabels = Array.from(
      document.body.querySelectorAll(
        '[data-offer-comparison-dialog="true"] [class*="offerAvailabilityStatus"]',
      ),
    );
    const links = Array.from(
      document.body.querySelectorAll<HTMLAnchorElement>(
        '[data-offer-comparison-dialog="true"] a[href]',
      ),
    );

    expect(dialog?.textContent).toContain('2 winkels nagekeken');
    expect(dialog?.textContent).not.toContain(
      '2 winkels nagekeken · Vandaag om 09:00',
    );
    expect(rows).toHaveLength(overlayOffers.length);
    expect(priceCells).toHaveLength(overlayOffers.length);
    expect(dialog?.textContent).toContain('Beste deal');
    expect(dialog?.textContent).toContain('Naar winkel');
    expect(dialog?.textContent).toContain('LEGO');
    expect(dialog?.textContent).not.toContain('LEGO LEGO');
    expect(dialog?.textContent).toContain('€5 duurder');
    expect(statusLabels).toHaveLength(overlayOffers.length);
    expect(
      document.body.querySelector(
        '[data-offer-comparison-dialog="true"] [class*="offerRailStock"]',
      ),
    ).toBeNull();
    expect(
      document.body.querySelector(
        '[data-offer-comparison-dialog="true"] [class*="offerOverlayStock"]',
      ),
    ).toBeNull();
    expect(
      document.body.querySelector(
        '[data-offer-comparison-dialog="true"] [class*="offerOverlayAction"]',
      ),
    ).toBeNull();
    expect(
      document.body.querySelector(
        '[data-offer-comparison-dialog="true"] [class*="offerOverlayChevron"]',
      ),
    ).not.toBeNull();
    expect(links[1]?.getAttribute('aria-label')).toBe('Naar winkel bij LEGO');
    expect(links[0]?.getAttribute('target')).toBe('_blank');
    expect(links[0]?.getAttribute('rel')).toBe('noopener noreferrer sponsored');
    expect(links[0]?.getAttribute('data-brickhunt-event')).toBe('offer_click');
    expect(links[0]?.getAttribute('data-brickhunt-properties')).toContain(
      'comparison_row',
    );
    expect(links[0]?.getAttribute('data-brickhunt-properties')).toContain(
      'rankPosition',
    );
  });

  it('keeps unavailable overlay states readable in the compact price list', async () => {
    const overlayOffers = makeOverflowOffers([
      offers[0],
      {
        ...offers[1],
        checkedLabel: 'Gisteren om 11:00',
        ctaHref: 'https://example.com/sold-out',
        merchantLabel: 'Sold Out Shop',
        price: '€ 84,99',
        stockLabel: 'Uitverkocht',
      },
      {
        ...offers[1],
        checkedLabel: '2 apr om 11:00',
        ctaHref: 'https://example.com/unknown',
        merchantLabel: 'Unknown Shop',
        price: '€ 84,99',
        stockLabel: 'Voorraad onbekend',
      },
    ]);

    await openOverlay({
      overlayOffers,
      summaryLabel: '3 winkels nagekeken',
    });

    const dialog = document.body.querySelector(
      '[data-offer-comparison-dialog="true"]',
    );

    expect(dialog?.textContent).toContain('Uitverkocht');
    expect(dialog?.textContent).toContain('Uitverkocht maar lager');
    expect(dialog?.textContent).toContain('Voorraad onbekend');
    expect(dialog?.textContent).toContain('Voorraad onbekend, lager');
  });

  it('uses the same compact dot status style in rail cards and modal rows', async () => {
    const statusOffers = makeOverflowOffers([
      offers[0],
      {
        ...offers[1],
        ctaHref: 'https://example.com/unknown',
        merchantLabel: 'Unknown Shop',
        stockLabel: 'Voorraad onbekend',
      },
      {
        ...offers[1],
        ctaHref: 'https://example.com/sold-out',
        merchantLabel: 'Sold Out Shop',
        stockLabel: 'Uitverkocht',
      },
    ]);

    await openOverlay({
      overlayOffers: statusOffers,
      summaryLabel: '3 winkels nagekeken',
    });

    const railStatuses = Array.from(
      container.querySelectorAll('[class*="offerAvailabilityStatus"]'),
    );
    const modalStatuses = Array.from(
      document.body.querySelectorAll(
        '[data-offer-comparison-dialog="true"] [class*="offerAvailabilityStatus"]',
      ),
    );

    expect(railStatuses).toHaveLength(20);
    expect(modalStatuses).toHaveLength(statusOffers.length);
    expect(container.textContent).toContain('Op voorraad');
    expect(container.textContent).toContain('Voorraad onbekend');
    expect(container.textContent).toContain('Uitverkocht');
    expect(document.body.textContent).toContain('Op voorraad');
    expect(document.body.textContent).toContain('Voorraad onbekend');
    expect(document.body.textContent).toContain('Uitverkocht');
    expect(container.querySelector('[class*="offerRailStock"]')).toBeNull();
    expect(
      document.body.querySelector('[class*="offerOverlayStock"]'),
    ).toBeNull();
  });

  it('keeps long delta text inside the fixed price column', async () => {
    const overlayOffers = makeOverflowOffers([
      offers[0],
      {
        ...offers[1],
        ctaHref: 'https://example.com/premium-marketplace',
        merchantLabel: 'Coppenswarenhuis Met Een Extra Lange Winkelnaam',
        price: '€ 1.234,56',
      },
    ]);

    await openOverlay({
      overlayOffers,
      summaryLabel: '2 winkels nagekeken',
    });

    const dialog = document.body.querySelector(
      '[data-offer-comparison-dialog="true"]',
    );
    const priceCells = Array.from(
      document.body.querySelectorAll('[class*="offerOverlayPriceCell"]'),
    );

    expect(priceCells).toHaveLength(overlayOffers.length);
    expect(dialog?.textContent).toContain(
      'Coppenswarenhuis Met Een Extra Lange Winkelnaam',
    );
    expect(dialog?.textContent).toContain('€10 goedkoper dan de rest');
    expect(dialog?.textContent).toContain('€1.144,57 duurder');
  });

  it('keeps the overlay list flat and compact without decorative card effects', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'libs/catalog/ui/src/lib/catalog-ui.module.css'),
      'utf-8',
    );
    const ruleBody = (selector: string) =>
      css.match(new RegExp(`(?:^|\\n)\\s*${selector} \\{[^}]+\\}`, 'u'))?.[0] ??
      '';
    const rowRule = ruleBody('\\.offerOverlayRow');
    const overlayRule = ruleBody('\\.offerOverlay');
    const headerRule = ruleBody('\\.offerOverlayHeader');
    const bodyRule = ruleBody('\\.offerOverlayBody');
    const listRule = ruleBody('\\.offerOverlayList');
    const merchantCellRule =
      css.match(/\.offerOverlayMerchantCell \{[^}]+\}/u)?.[0] ?? '';
    const merchantRule =
      css.match(/\.offerOverlayMerchant \{[^}]+\}/u)?.[0] ?? '';
    const badgesRule = css.match(/\.offerOverlayBadges \{[^}]+\}/u)?.[0] ?? '';
    const statusRule =
      css.match(/\.offerAvailabilityStatus \{[^}]+\}/u)?.[0] ?? '';
    const statusDotRule =
      css.match(/\.offerAvailabilityStatus::before \{[^}]+\}/u)?.[0] ?? '';
    const priceCellRule =
      css.match(/\.offerOverlayPriceCell \{[^}]+\}/u)?.[0] ?? '';
    const chevronRule =
      css.match(/\.offerOverlayChevron \{[^}]+\}/u)?.[0] ?? '';
    const mobileRuleBodies = (selector: string) =>
      [...css.matchAll(new RegExp(`${selector} \\{([^}]+)\\}`, 'gu'))].map(
        (match) => match[1] ?? '',
      );
    const mobileHeaderRule =
      mobileRuleBodies('\\.offerOverlayHeader').find((rule) =>
        rule.includes('padding: 0 var(--lego-space-2);'),
      ) ?? '';
    const mobileOverlayRule =
      mobileRuleBodies('\\.offerOverlay').find((rule) =>
        rule.includes('grid-template-rows: 64px minmax(0, 1fr);'),
      ) ?? '';
    const mobileRowRule =
      mobileRuleBodies('\\.offerOverlayRow').find((rule) =>
        rule.includes('minmax(0, 1fr) 8rem 1.5rem'),
      ) ?? '';

    expect(overlayRule).toContain('display: grid;');
    expect(overlayRule).toContain('grid-template-rows: 72px minmax(0, 1fr);');
    expect(headerRule).toContain('align-items: center;');
    expect(headerRule).not.toMatch(/(?:^|\n)\s*height:/u);
    expect(headerRule).not.toContain('min-height: 4');
    expect(headerRule).toContain('min-height: 0;');
    expect(headerRule).toContain('padding: 0 var(--lego-space-3);');
    expect(bodyRule).toContain('margin-top: 0;');
    expect(bodyRule).toContain('min-height: 0;');
    expect(bodyRule).toContain('overflow-y: auto;');
    expect(bodyRule).toContain('padding: 0;');
    expect(bodyRule).toContain('padding-top: 0;');
    expect(listRule).toContain('margin: 0;');
    expect(listRule).toContain('padding: 0;');
    expect(rowRule).toContain('min-height: 4.75rem;');
    expect(rowRule).toContain('padding: 0.5rem var(--lego-space-3);');
    expect(rowRule).toContain('grid-template-columns:');
    expect(rowRule).toContain('minmax(11.25rem, 1fr)');
    expect(rowRule).toContain('10rem');
    expect(rowRule).toContain('11.25rem');
    expect(rowRule).toContain('13.75rem 2rem');
    expect(rowRule).not.toContain('linear-gradient');
    expect(rowRule).not.toContain('box-shadow');
    expect(rowRule).not.toContain('border-radius');
    expect(merchantCellRule).toContain('min-width: 0;');
    expect(merchantRule).toContain('overflow: hidden;');
    expect(merchantRule).toContain('text-overflow: ellipsis;');
    expect(merchantRule).toContain('white-space: nowrap;');
    expect(badgesRule).toContain('max-width: 100%;');
    expect(badgesRule).toContain('overflow: hidden;');
    expect(statusRule).toContain('display: inline-flex;');
    expect(statusRule).toContain('white-space: nowrap;');
    expect(statusRule).not.toContain('padding:');
    expect(statusRule).not.toContain('background:');
    expect(statusRule).not.toContain('border-radius:');
    expect(statusDotRule).toContain('background: currentColor;');
    expect(statusDotRule).toContain('border-radius: var(--lego-radius-pill);');
    expect(priceCellRule).toContain('width: 13.75rem;');
    expect(priceCellRule).toContain('max-width: 13.75rem;');
    expect(priceCellRule).toContain('justify-items: end;');
    expect(priceCellRule).toContain('text-align: right;');
    expect(chevronRule).toContain('width: 2rem;');
    expect(mobileOverlayRule).toContain(
      'grid-template-rows: 64px minmax(0, 1fr);',
    );
    expect(mobileHeaderRule).toContain('padding: 0 var(--lego-space-2);');
    expect(mobileRowRule).toContain('minmax(0, 1fr) 8rem 1.5rem');
    expect(mobileRowRule).toContain('padding: 0.48rem var(--lego-space-2);');
  });
});
