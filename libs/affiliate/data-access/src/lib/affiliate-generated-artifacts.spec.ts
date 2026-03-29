import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  renderAffiliateOfferSnapshotsModule,
  renderAffiliateSyncManifestModule,
} from '@lego-platform/affiliate/util';
import { affiliateOfferSnapshots } from './affiliate-offers.generated';
import { affiliateSyncManifest } from './affiliate-sync-manifest.generated';

describe('affiliate generated artifacts', () => {
  test('keep committed affiliate artifacts in canonical writer format', async () => {
    const workspaceRoot = resolve(__dirname, '../../../../..');
    const [offersModule, manifestModule] = await Promise.all([
      readFile(
        resolve(
          workspaceRoot,
          'libs/affiliate/data-access/src/lib/affiliate-offers.generated.ts',
        ),
        'utf8',
      ),
      readFile(
        resolve(
          workspaceRoot,
          'libs/affiliate/data-access/src/lib/affiliate-sync-manifest.generated.ts',
        ),
        'utf8',
      ),
    ]);

    expect(offersModule).toBe(
      renderAffiliateOfferSnapshotsModule(affiliateOfferSnapshots),
    );
    expect(manifestModule).toBe(
      renderAffiliateSyncManifestModule(affiliateSyncManifest),
    );
  });
});
