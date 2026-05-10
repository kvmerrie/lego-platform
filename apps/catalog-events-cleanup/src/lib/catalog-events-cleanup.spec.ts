import { describe, expect, test, vi } from 'vitest';
import {
  CATALOG_USER_EVENTS_TABLE,
  cleanupCatalogUserEvents,
  getCatalogUserEventsRetentionCutoff,
  type CatalogEventsCleanupClient,
} from './catalog-events-cleanup';

describe('catalog events cleanup', () => {
  test('builds a 90-day retention cutoff by default', () => {
    expect(
      getCatalogUserEventsRetentionCutoff({
        now: new Date('2026-05-10T12:00:00.000Z'),
      }),
    ).toBe('2026-02-09T12:00:00.000Z');
  });

  test('deletes catalog user events older than the cutoff and returns count', async () => {
    const lt = vi.fn().mockResolvedValue({
      count: 12,
      error: null,
    });
    const deleteMock = vi.fn(() => ({
      lt,
    }));
    const from = vi.fn(() => ({
      delete: deleteMock,
    }));

    const result = await cleanupCatalogUserEvents({
      now: new Date('2026-05-10T12:00:00.000Z'),
      supabaseClient: {
        from,
      } satisfies CatalogEventsCleanupClient,
    });

    expect(from).toHaveBeenCalledWith(CATALOG_USER_EVENTS_TABLE);
    expect(deleteMock).toHaveBeenCalledWith({ count: 'exact' });
    expect(lt).toHaveBeenCalledWith('created_at', '2026-02-09T12:00:00.000Z');
    expect(result).toEqual({
      cutoffIso: '2026-02-09T12:00:00.000Z',
      deletedRowCount: 12,
      retentionDays: 90,
    });
  });

  test('fails safe on invalid retention windows', () => {
    expect(() =>
      getCatalogUserEventsRetentionCutoff({
        retentionDays: 0,
      }),
    ).toThrow('Catalog event retention days must be between 1 and 366.');
  });
});
