import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import {
  renderCatalogSnapshotModule,
  renderCatalogSyncManifestModule,
} from '@lego-platform/catalog/util';
import { catalogSnapshot } from './catalog-snapshot.generated';
import { catalogSyncManifest } from './catalog-sync-manifest.generated';

describe('generated catalog artifacts', () => {
  test('stay in canonical writer format', async () => {
    const snapshotPath = fileURLToPath(
      new URL('./catalog-snapshot.generated.ts', import.meta.url),
    );
    const manifestPath = fileURLToPath(
      new URL('./catalog-sync-manifest.generated.ts', import.meta.url),
    );

    expect(await readFile(snapshotPath, 'utf8')).toBe(
      renderCatalogSnapshotModule(catalogSnapshot),
    );
    expect(await readFile(manifestPath, 'utf8')).toBe(
      renderCatalogSyncManifestModule(catalogSyncManifest),
    );
  });
});
