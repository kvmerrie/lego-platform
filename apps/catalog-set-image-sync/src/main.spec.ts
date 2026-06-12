import { describe, expect, test } from 'vitest';
import {
  assertUnambiguousTargets,
  parseDebugDedupe,
  parseCopyMetadataMode,
  parseMetadataTarget,
  parseRefreshCard,
  parseRefreshImageMetadata,
  parseRefreshSocial,
  parseRefreshThumbnails,
  parseRewritePublicUrls,
  parseUploadRetries,
  parseVariantBackfill,
} from './main';

describe('catalog set image sync CLI', () => {
  test('defaults image metadata writes to staging', () => {
    expect(parseMetadataTarget([])).toBe('staging');
  });

  test('requires an explicit flag for production metadata writes', () => {
    expect(parseMetadataTarget(['--metadata-target=production'])).toBe(
      'production',
    );
    expect(parseMetadataTarget(['--metadata-target', 'production'])).toBe(
      'production',
    );
  });

  test('parses production to staging metadata copy mode', () => {
    expect(
      parseCopyMetadataMode(['--copy-metadata', 'production-to-staging']),
    ).toBe('production-to-staging');
  });

  test('parses thumbnail refresh mode', () => {
    expect(parseRefreshThumbnails([])).toBe(false);
    expect(parseRefreshThumbnails(['--refresh-thumbnails'])).toBe(true);
  });

  test('parses social refresh mode', () => {
    expect(parseRefreshSocial([])).toBe(false);
    expect(parseRefreshSocial(['--refresh-social'])).toBe(true);
  });

  test('parses card refresh mode', () => {
    expect(parseRefreshCard([])).toBe(false);
    expect(parseRefreshCard(['--refresh-card'])).toBe(true);
  });

  test('parses image metadata refresh mode', () => {
    expect(parseRefreshImageMetadata([])).toBe(false);
    expect(parseRefreshImageMetadata(['--refresh-image-metadata'])).toBe(true);
  });

  test('parses large variant backfill mode', () => {
    expect(parseVariantBackfill([])).toBeUndefined();
    expect(parseVariantBackfill(['--variant=large'])).toBe('large');
    expect(parseVariantBackfill(['--variant', 'large'])).toBe('large');
    expect(() => parseVariantBackfill(['--variant=thumbnail'])).toThrow(
      'Use --variant=large.',
    );
  });

  test('parses dedupe debug mode', () => {
    expect(parseDebugDedupe([])).toBe(false);
    expect(parseDebugDedupe(['--debug-dedupe'])).toBe(true);
  });

  test('parses public URL rewrite mode', () => {
    expect(parseRewritePublicUrls([])).toBe(false);
    expect(parseRewritePublicUrls(['--rewrite-public-urls'])).toBe(true);
  });

  test('parses optional upload retry count', () => {
    expect(parseUploadRetries([])).toBeUndefined();
    expect(parseUploadRetries(['--upload-retries=2'])).toBe(2);
    expect(parseUploadRetries(['--upload-retries', '0'])).toBe(0);
    expect(() => parseUploadRetries(['--upload-retries=-1'])).toThrow(
      'Use --upload-retries <non-negative-integer>.',
    );
  });

  test('refuses ambiguous staging metadata and production storage targets', () => {
    expect(() =>
      assertUnambiguousTargets({
        metadataTarget: 'staging',
        metadataTargetUrl: 'https://same.supabase.co',
        storageTargetUrl: 'https://same.supabase.co',
      }),
    ).toThrow('Refusing to use the same Supabase URL');
  });
});
