import { afterEach, describe, expect, test } from 'vitest';
import {
  buildThemePath,
  buildWebPath,
  createLocaleCode,
  getBrowserSupabaseConfig,
  getDefaultAppLocaleContext,
  getDefaultFormattingLocale,
  getDefaultMarketScopeLabel,
  getMissingBrowserSupabaseEnvKeys,
  hasBrowserSupabaseConfig,
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
      languageCode: 'en',
      marketCode: 'NL',
      currencyCode: 'EUR',
      localeCode: 'en-nl',
      htmlLang: 'en',
      formattingLocale: 'nl-NL',
      marketDisplayName: 'Dutch market',
      marketAdjectiveName: 'Dutch',
      merchantRegionCode: 'NL',
      routeSegment: 'en-nl',
    });
    expect(getDefaultFormattingLocale()).toBe('nl-NL');
  });

  test('builds unprefixed routes now while keeping locale-prefixed paths possible later', () => {
    expect(buildWebPath('/discover')).toBe('/discover');
    expect(buildWebPath('account')).toBe('/account');
    expect(buildThemePath('icons')).toBe('/themes/icons');
    expect(buildWebPath('/', { forceLocalePrefix: true })).toBe('/en-nl');
    expect(
      buildWebPath('/discover', {
        forceLocalePrefix: true,
        localeCode: createLocaleCode({
          languageCode: 'en',
          marketCode: 'NL',
        }),
      }),
    ).toBe('/en-nl/discover');
  });

  test('renders reusable market scope labels from the default market config', () => {
    expect(
      getDefaultMarketScopeLabel({
        conditionLabel: 'new condition',
        suffix: '3 merchants shown',
      }),
    ).toBe('Dutch market · EUR · new condition · 3 merchants shown');
  });
});
