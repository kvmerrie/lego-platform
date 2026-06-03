import { describe, expect, test } from 'vitest';
import type { CatalogCanonicalSet } from '@lego-platform/catalog/util';
import {
  buildSetDetailRelatedThemeSnapshotSlug,
  buildSetDetailRelatedThemeSnapshots,
} from './set-detail-related-theme-snapshot-server';

function createSet(
  overrides: Partial<CatalogCanonicalSet> & Pick<CatalogCanonicalSet, 'setId'>,
): CatalogCanonicalSet {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    name: `Set ${overrides.setId}`,
    pieceCount: 100,
    primaryTheme: 'Icons',
    releaseYear: 2024,
    secondaryLabels: [],
    slug: `set-${overrides.setId}`,
    source: 'manual',
    status: 'active',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('set detail related theme snapshots', () => {
  test('builds deterministic same-theme snapshots and excludes the current set', async () => {
    const result = await buildSetDetailRelatedThemeSnapshots({
      catalogSets: [
        createSet({
          name: 'Current Castle',
          pieceCount: 1000,
          primaryTheme: 'Icons',
          releaseYear: 2024,
          setId: '10000',
        }),
        createSet({
          name: 'Newest Icons',
          pieceCount: 900,
          primaryTheme: 'Icons',
          releaseYear: 2026,
          setId: '10001',
        }),
        createSet({
          name: 'Bigger Icons',
          pieceCount: 1200,
          primaryTheme: 'Icons',
          releaseYear: 2026,
          setId: '10002',
        }),
        createSet({
          name: 'Wrong Theme',
          primaryTheme: 'Star Wars',
          releaseYear: 2026,
          setId: '20001',
        }),
      ],
      now: new Date('2026-06-02T10:00:00.000Z'),
      priceSnapshots: new Map(),
    });

    const snapshot = result.snapshots.find(
      (candidate) => candidate.setId === '10000',
    );

    expect(snapshot?.snapshotSlug).toBe(
      buildSetDetailRelatedThemeSnapshotSlug('10000'),
    );
    expect(snapshot?.items.map((item) => item.id)).toEqual(['10002', '10001']);
    expect(snapshot?.items.map((item) => item.id)).not.toContain('10000');
    expect(snapshot?.items.map((item) => item.theme)).toEqual([
      'Icons',
      'Icons',
    ]);
    expect(result.summary.snapshotWithItemsCount).toBe(3);
  });

  test('prefers candidates with current offer snapshots and attaches price context', async () => {
    const result = await buildSetDetailRelatedThemeSnapshots({
      catalogSets: [
        createSet({ primaryTheme: 'Icons', setId: '10000' }),
        createSet({
          name: 'Priced Icons',
          primaryTheme: 'Icons',
          releaseYear: 2023,
          setId: '10001',
        }),
        createSet({
          name: 'Newer Without Price',
          primaryTheme: 'Icons',
          releaseYear: 2026,
          setId: '10002',
        }),
      ],
      now: new Date('2026-06-02T10:00:00.000Z'),
      priceSnapshots: new Map([
        [
          '10001',
          {
            best_availability: 'in_stock',
            best_checked_at: '2026-06-01T12:00:00.000Z',
            best_merchant_name: 'Goodbricks',
            best_price_minor: 6499,
            computed_at: '2026-06-01T12:00:00.000Z',
            set_id: '10001',
          },
        ],
      ]),
    });

    const snapshot = result.snapshots.find(
      (candidate) => candidate.setId === '10000',
    );

    expect(snapshot?.items.map((item) => item.id)).toEqual(['10001', '10002']);
    expect(snapshot?.items[0]?.priceContext).toMatchObject({
      coverageLabel: 'Actuele prijs gevonden',
      currentPrice: 'Vanaf € 64,99',
      merchantLabel: 'Laagst bij Goodbricks',
    });
  });

  test('spreads related-theme exposure across lower-linked same-theme sets', async () => {
    const catalogSets = Array.from({ length: 8 }, (_, index) =>
      createSet({
        name: `Icons Set ${index + 1}`,
        pieceCount: 1000 - index,
        primaryTheme: 'Icons',
        releaseYear: 2026,
        setId: `1000${index}`,
      }),
    );

    const result = await buildSetDetailRelatedThemeSnapshots({
      catalogSets,
      limit: 2,
      now: new Date('2026-06-02T10:00:00.000Z'),
      priceSnapshots: new Map(),
    });

    const linkedSetIds = new Set(
      result.snapshots.flatMap((snapshot) =>
        snapshot.items.map((item) => item.id),
      ),
    );

    expect(linkedSetIds.size).toBe(8);
  });

  test('keeps diversity deterministic and theme-scoped', async () => {
    const catalogSets = [
      createSet({
        name: 'Icons Current',
        primaryTheme: 'Icons',
        setId: '10000',
      }),
      createSet({
        name: 'Icons A',
        primaryTheme: 'Icons',
        setId: '10001',
      }),
      createSet({
        name: 'Icons B',
        primaryTheme: 'Icons',
        setId: '10002',
      }),
      createSet({
        name: 'Star Wars A',
        primaryTheme: 'Star Wars',
        setId: '20001',
      }),
      createSet({
        name: 'Star Wars B',
        primaryTheme: 'Star Wars',
        setId: '20002',
      }),
    ];

    const first = await buildSetDetailRelatedThemeSnapshots({
      catalogSets,
      limit: 2,
      now: new Date('2026-06-02T10:00:00.000Z'),
      priceSnapshots: new Map(),
    });
    const second = await buildSetDetailRelatedThemeSnapshots({
      catalogSets,
      limit: 2,
      now: new Date('2026-06-02T10:00:00.000Z'),
      priceSnapshots: new Map(),
    });
    const iconsSnapshot = first.snapshots.find(
      (snapshot) => snapshot.setId === '10000',
    );

    expect(first.snapshots).toEqual(second.snapshots);
    expect(iconsSnapshot?.items.map((item) => item.theme)).toEqual([
      'Icons',
      'Icons',
    ]);
    expect(iconsSnapshot?.items.map((item) => item.id)).not.toContain('10000');
  });
});
