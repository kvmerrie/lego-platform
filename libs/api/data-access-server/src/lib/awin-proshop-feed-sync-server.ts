import {
  getAwinProshopFeedConfig,
  type AwinProshopFeedConfig,
} from '@lego-platform/shared/config';
import {
  decodeAwinFeedBody,
  normalizeStrictAwinCsvRowToAffiliateFeedRow,
  parseAwinProductFeedCsv,
  syncAwinFeed,
  type AwinCsvRow,
  type AwinDebugInfo,
  type AwinDebugSample,
  type AwinFeedSyncDependencies,
  type AwinFeedSyncOptions,
  type AwinFeedSyncResult,
} from './awin-feed-sync-server';

export interface AwinProshopFeedSyncDependencies
  extends AwinFeedSyncDependencies {
  getAwinProshopFeedConfigFn?: typeof getAwinProshopFeedConfig;
}

export type AwinProshopFeedSyncOptions = AwinFeedSyncOptions;
export type AwinProshopDebugSample = AwinDebugSample;
export type AwinProshopDebugInfo = AwinDebugInfo;
export type AwinProshopFeedSyncResult = AwinFeedSyncResult;
export type AwinProshopCsvRow = AwinCsvRow;

export function parseAwinProshopProductFeedCsv(
  csvText: string,
): Promise<readonly AwinProshopCsvRow[]> {
  return parseAwinProductFeedCsv(csvText);
}

export const decodeAwinProshopFeedBody = decodeAwinFeedBody;
export function normalizeAwinProshopCsvRowToAffiliateFeedRow(
  row: AwinProshopCsvRow,
) {
  return normalizeStrictAwinCsvRowToAffiliateFeedRow(row, {
    useMpnSetNumber: true,
  });
}

export async function syncAwinProshopFeed({
  dependencies,
  options,
}: {
  dependencies?: AwinProshopFeedSyncDependencies;
  options?: AwinProshopFeedSyncOptions;
} = {}): Promise<AwinProshopFeedSyncResult> {
  const getAwinProshopFeedConfigFn =
    dependencies?.getAwinProshopFeedConfigFn ?? getAwinProshopFeedConfig;
  const config: AwinProshopFeedConfig = getAwinProshopFeedConfigFn();

  return syncAwinFeed({
    dependencies,
    definition: {
      config,
      merchantNotes:
        'Feed-driven merchant. Current offer state is imported from the Proshop Awin product feed.',
      normalizeRow: normalizeAwinProshopCsvRowToAffiliateFeedRow,
    },
    options,
  });
}
