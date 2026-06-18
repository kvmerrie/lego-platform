import { describe, expect, test } from 'vitest';
import { isPartnerBadgePlaygroundEnabled } from './partner-badge-playground-access';

describe('partner badge playground access', () => {
  test('is not available in production', () => {
    expect(
      isPartnerBadgePlaygroundEnabled({
        NODE_ENV: 'production',
      }),
    ).toBe(false);
    expect(
      isPartnerBadgePlaygroundEnabled({
        NODE_ENV: 'production',
        VERCEL_ENV: 'production',
      }),
    ).toBe(false);
  });

  test('is available in development and staging-like deployments', () => {
    expect(
      isPartnerBadgePlaygroundEnabled({
        NODE_ENV: 'development',
      }),
    ).toBe(true);
    expect(
      isPartnerBadgePlaygroundEnabled({
        NODE_ENV: 'production',
        VERCEL_ENV: 'preview',
      }),
    ).toBe(true);
    expect(
      isPartnerBadgePlaygroundEnabled({
        BRICKHUNT_DEPLOY_ENV: 'staging',
        NODE_ENV: 'production',
      }),
    ).toBe(true);
  });
});
