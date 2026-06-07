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

  test('parses dedupe debug mode', () => {
    expect(parseDebugDedupe([])).toBe(false);
    expect(parseDebugDedupe(['--debug-dedupe'])).toBe(true);
  });

  test('parses public URL rewrite mode', () => {
    expect(parseRewritePublicUrls([])).toBe(false);
    expect(parseRewritePublicUrls(['--rewrite-public-urls'])).toBe(true);
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
