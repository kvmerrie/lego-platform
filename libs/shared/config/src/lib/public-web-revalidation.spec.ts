import { describe, expect, test } from 'vitest';
import {
  batchRevalidationPayloads,
  normalizeRevalidationPaths,
  normalizeRevalidationTags,
  validateRevalidationReason,
} from './public-web-revalidation';

describe('public web revalidation utilities', () => {
  test('normalizes, trims, and dedupes paths', () => {
    const result = normalizeRevalidationPaths([
      ' /deals ',
      '/deals/',
      '/',
      '/sets/rivendell-10316',
    ]);

    expect(result.values).toEqual(['/deals', '/', '/sets/rivendell-10316']);
    expect(result.invalidValues).toEqual([]);
    expect(result.warnings).toContain('Duplicate path skipped: /deals');
  });

  test('rejects invalid public web paths', () => {
    const result = normalizeRevalidationPaths([
      'https://www.brickhunt.nl/deals',
      'sets/10316',
      '/sets/rivendell 10316',
    ]);

    expect(result.values).toEqual([]);
    expect(result.invalidValues).toEqual([
      'https://www.brickhunt.nl/deals',
      'sets/10316',
      '/sets/rivendell 10316',
    ]);
    expect(result.warnings).toHaveLength(3);
  });

  test('normalizes and dedupes tags', () => {
    const result = normalizeRevalidationTags([
      'homepage',
      'set:43300',
      'Set:43300',
      '',
      'theme:Star Wars',
    ]);

    expect(result.values).toEqual(['homepage', 'set:43300', 'theme:star-wars']);
    expect(result.warnings).toContain('Empty tag skipped.');
  });

  test('validates required reason length', () => {
    expect(validateRevalidationReason('manual_set_fix')).toEqual({
      reason: 'manual_set_fix',
    });
    expect(validateRevalidationReason('')).toEqual({
      error: 'Reason must be at least 3 characters.',
    });
    expect(validateRevalidationReason('x'.repeat(121))).toEqual({
      error: 'Reason must be at most 120 characters.',
    });
  });

  test('batches paths and tags within public web limits', () => {
    const batches = batchRevalidationPayloads({
      paths: Array.from({ length: 26 }, (_, index) => `/sets/${index}`),
      reason: 'manual_revalidation',
      tags: Array.from({ length: 101 }, (_, index) => `set:${index}`),
    });

    expect(batches).toHaveLength(2);
    expect(batches[0]?.paths).toHaveLength(25);
    expect(batches[0]?.tags).toHaveLength(100);
    expect(batches[1]?.paths).toHaveLength(1);
    expect(batches[1]?.tags).toHaveLength(1);
  });
});
