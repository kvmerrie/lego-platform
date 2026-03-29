import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  renderPricePanelSnapshotsModule,
  renderPricingObservationsModule,
  renderPricingSyncManifestModule,
} from '@lego-platform/pricing/util';
import { pricePanelSnapshots } from './price-panel-snapshots.generated';
import { pricingObservations } from './pricing-observations.generated';
import { pricingSyncManifest } from './pricing-sync-manifest.generated';

describe('pricing generated artifacts', () => {
  test('keep committed pricing artifacts in canonical writer format', async () => {
    const workspaceRoot = resolve(__dirname, '../../../../..');
    const [observationsModule, panelSnapshotsModule, manifestModule] =
      await Promise.all([
        readFile(
          resolve(
            workspaceRoot,
            'libs/pricing/data-access/src/lib/pricing-observations.generated.ts',
          ),
          'utf8',
        ),
        readFile(
          resolve(
            workspaceRoot,
            'libs/pricing/data-access/src/lib/price-panel-snapshots.generated.ts',
          ),
          'utf8',
        ),
        readFile(
          resolve(
            workspaceRoot,
            'libs/pricing/data-access/src/lib/pricing-sync-manifest.generated.ts',
          ),
          'utf8',
        ),
      ]);

    expect(observationsModule).toBe(
      renderPricingObservationsModule(pricingObservations),
    );
    expect(panelSnapshotsModule).toBe(
      renderPricePanelSnapshotsModule(pricePanelSnapshots),
    );
    expect(manifestModule).toBe(
      renderPricingSyncManifestModule(pricingSyncManifest),
    );
  });
});
