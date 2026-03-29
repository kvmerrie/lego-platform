import { afterEach, describe, expect, test } from 'vitest';
import {
  getBrowserSupabaseConfig,
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
