import { describe, expect, test } from 'vitest';
import { buildAffiliateSyncArtifacts } from './affiliate-data-access-server';

describe('affiliate data access server', () => {
  test('builds affiliate offer artifacts for the curated Dutch set-detail slice', () => {
    const result = buildAffiliateSyncArtifacts({
      enabledSetIds: ['10316'],
      offerCandidateInputs: [
        {
          setId: '10316',
          merchantId: 'lego-nl',
          merchantProductUrl: 'https://www.lego.com/nl-nl/product/lotr-10316',
          totalPriceMinor: 49999,
          availability: 'in_stock',
          observedAt: '2026-03-29T09:10:00.000Z',
          regionCode: 'NL',
          currencyCode: 'EUR',
          condition: 'new',
        },
      ],
    });

    expect(result.affiliateOfferSnapshots).toHaveLength(1);
    expect(result.affiliateSyncManifest.generatedAt).toBe(
      '2026-03-29T09:10:00.000Z',
    );
  });

  test('rejects missing affiliate config for enabled offers', () => {
    expect(() =>
      buildAffiliateSyncArtifacts({
        enabledSetIds: ['10316'],
        offerCandidateInputs: [
          {
            setId: '10316',
            merchantId: 'unknown-merchant',
            merchantProductUrl: 'https://example.com/product/10316',
            totalPriceMinor: 49999,
            availability: 'in_stock',
            observedAt: '2026-03-29T09:10:00.000Z',
            regionCode: 'NL',
            currencyCode: 'EUR',
            condition: 'new',
          },
        ],
      }),
    ).toThrow(
      'Missing affiliate config for enabled offer 10316/unknown-merchant.',
    );
  });

  test('rejects duplicate merchant display ranks within the Dutch market', () => {
    expect(() =>
      buildAffiliateSyncArtifacts({
        enabledSetIds: ['10316'],
        affiliateMerchantConfigs: [
          {
            merchantId: 'merchant-a',
            displayName: 'Merchant A',
            regionCode: 'NL',
            currencyCode: 'EUR',
            enabled: true,
            displayRank: 1,
            urlHost: 'example-a.test',
            disclosureCopy: 'Disclosure A',
            ctaLabel: 'View offer',
          },
          {
            merchantId: 'merchant-b',
            displayName: 'Merchant B',
            regionCode: 'NL',
            currencyCode: 'EUR',
            enabled: true,
            displayRank: 1,
            urlHost: 'example-b.test',
            disclosureCopy: 'Disclosure B',
            ctaLabel: 'View offer',
          },
        ],
        offerCandidateInputs: [],
      }),
    ).toThrow('Duplicate affiliate display rank 1 within NL.');
  });

  test('rejects commerce-enabled sets with no valid affiliate offer snapshot', () => {
    expect(() =>
      buildAffiliateSyncArtifacts({
        enabledSetIds: ['10316'],
        offerCandidateInputs: [],
      }),
    ).toThrow(
      'No valid affiliate offer snapshot was produced for commerce-enabled set 10316.',
    );
  });
});
