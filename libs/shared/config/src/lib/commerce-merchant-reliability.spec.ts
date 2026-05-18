import { describe, expect, test } from 'vitest';
import {
  canStrategicManualOfferBeatProductionFeed,
  getCommerceMerchantReliabilityTier,
  isCommerceMerchantProductionFeed,
} from './commerce-merchant-reliability';

describe('commerce merchant reliability config', () => {
  test('classifies production feed merchants as trusted for deal confidence', () => {
    expect(getCommerceMerchantReliabilityTier('goodbricks')).toBe(
      'production_feed',
    );
    expect(getCommerceMerchantReliabilityTier(' mediamarkt ')).toBe(
      'production_feed',
    );
    expect(isCommerceMerchantProductionFeed('conrad')).toBe(true);
    expect(isCommerceMerchantProductionFeed('alternate')).toBe(true);
  });

  test('classifies strategic manual merchants conservatively', () => {
    expect(getCommerceMerchantReliabilityTier('coppenswarenhuis')).toBe(
      'strategic_manual',
    );
    expect(getCommerceMerchantReliabilityTier('lego-nl')).toBe(
      'strategic_manual',
    );
    expect(getCommerceMerchantReliabilityTier('unknown-merchant')).toBe(
      'strategic_manual',
    );
  });

  test('allows strategic manual best-offer wins only on a large price advantage', () => {
    expect(
      canStrategicManualOfferBeatProductionFeed({
        productionFeedPriceMinor: 10000,
        strategicManualPriceMinor: 9000,
      }),
    ).toBe(false);
    expect(
      canStrategicManualOfferBeatProductionFeed({
        productionFeedPriceMinor: 10000,
        strategicManualPriceMinor: 7400,
      }),
    ).toBe(true);
  });
});
