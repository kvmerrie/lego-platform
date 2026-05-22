import {
  getAwinCoolblueFeedConfig,
  type AwinCoolblueFeedConfig,
} from '@lego-platform/shared/config';
import {
  decodeAwinFeedBody,
  normalizeAwinCsvRowToAffiliateFeedRow,
  parseAwinProductFeedCsv,
  syncAwinFeed,
  type AwinCsvRow,
  type AwinDebugInfo,
  type AwinDebugSample,
  type AwinFeedSyncDependencies,
  type AwinFeedSyncOptions,
  type AwinFeedSyncResult,
} from './awin-feed-sync-server';

export interface AwinCoolblueFeedSyncDependencies
  extends AwinFeedSyncDependencies {
  getAwinCoolblueFeedConfigFn?: typeof getAwinCoolblueFeedConfig;
}

export type AwinCoolblueFeedSyncOptions = AwinFeedSyncOptions;
export type AwinCoolblueDebugSample = AwinDebugSample;
export type AwinCoolblueDebugInfo = AwinDebugInfo;
export type AwinCoolblueFeedSyncResult = AwinFeedSyncResult;
export type AwinCoolblueCsvRow = AwinCsvRow;

export function parseAwinCoolblueProductFeedCsv(
  csvText: string,
): Promise<readonly AwinCoolblueCsvRow[]> {
  return parseAwinProductFeedCsv(csvText);
}

export const decodeAwinCoolblueFeedBody = decodeAwinFeedBody;
export const normalizeAwinCoolblueCsvRowToAffiliateFeedRow =
  normalizeAwinCsvRowToAffiliateFeedRow;

export async function syncAwinCoolblueFeed({
  dependencies,
  options,
}: {
  dependencies?: AwinCoolblueFeedSyncDependencies;
  options?: AwinCoolblueFeedSyncOptions;
} = {}): Promise<AwinCoolblueFeedSyncResult> {
  const getAwinCoolblueFeedConfigFn =
    dependencies?.getAwinCoolblueFeedConfigFn ?? getAwinCoolblueFeedConfig;
  const config: AwinCoolblueFeedConfig = getAwinCoolblueFeedConfigFn();

  return syncAwinFeed({
    dependencies,
    definition: {
      config,
      merchantNotes:
        'Feed-driven merchant. Current offer state is imported from the Coolblue Awin product feed.',
      normalizeRow: normalizeAwinCoolblueCsvRowToAffiliateFeedRow,
    },
    options,
  });
}
