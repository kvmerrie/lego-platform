export const COLLECTION_PAGE_SNAPSHOT_MAX_AGE_MS = 72 * 60 * 60 * 1000;
export const PRICE_SNAPSHOT_PAGE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type SnapshotPageHealth = 'fresh' | 'missing' | 'stale';

export function getSnapshotPageHealth({
  generatedAt,
  maxAgeMs,
  nowMs = Date.now(),
}: {
  generatedAt?: string | null;
  maxAgeMs: number;
  nowMs?: number;
}): SnapshotPageHealth {
  if (!generatedAt) {
    return 'missing';
  }

  const generatedAtMs = Date.parse(generatedAt);

  if (!Number.isFinite(generatedAtMs)) {
    return 'missing';
  }

  return nowMs - generatedAtMs > maxAgeMs ? 'stale' : 'fresh';
}
