import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  renderCatalogSnapshotModule,
  renderCatalogSyncManifestModule,
} from '@lego-platform/catalog/util';
import { catalogSnapshot } from './catalog-snapshot.generated';
import { catalogSyncManifest } from './catalog-sync-manifest.generated';

describe('generated catalog artifacts', () => {
  test('stay in canonical writer format', async () => {
    const workspaceRoot = resolve(__dirname, '../../../../..');
    const snapshotPath = resolve(
      workspaceRoot,
      'libs/catalog/data-access/src/lib/catalog-snapshot.generated.ts',
    );
    const manifestPath = resolve(
      workspaceRoot,
      'libs/catalog/data-access/src/lib/catalog-sync-manifest.generated.ts',
    );

    expect(await readFile(snapshotPath, 'utf8')).toBe(
      renderCatalogSnapshotModule(catalogSnapshot),
    );
    expect(await readFile(manifestPath, 'utf8')).toBe(
      renderCatalogSyncManifestModule(catalogSyncManifest),
    );
  });
});
