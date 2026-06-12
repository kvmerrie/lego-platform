import {
  getAwinJoybuyFeedConfig,
  type AwinJoybuyFeedConfig,
} from '@lego-platform/shared/config';
import {
  extractAwinSetNumberFromHumanFields,
  isStrictAwinLegoCandidate,
  normalizeStrictAwinCsvRowToAffiliateFeedRow,
  syncAwinFeed,
  type AwinCsvRow,
  type AwinDebugInfo,
  type AwinDebugSample,
  type AwinFeedSyncDependencies,
  type AwinFeedSyncOptions,
  type AwinFeedSyncResult,
} from './awin-feed-sync-server';

export interface AwinJoybuyFeedSyncDependencies
  extends AwinFeedSyncDependencies {
  getAwinJoybuyFeedConfigFn?: typeof getAwinJoybuyFeedConfig;
}

export type AwinJoybuyFeedSyncOptions = AwinFeedSyncOptions;
export type AwinJoybuyDebugSample = AwinDebugSample;
export type AwinJoybuyDebugInfo = AwinDebugInfo;
export type AwinJoybuyFeedSyncResult = AwinFeedSyncResult;
export type AwinJoybuyCsvRow = AwinCsvRow;

export function isStrictAwinJoybuyLegoCandidate(
  row: AwinJoybuyCsvRow,
): boolean {
  return isStrictAwinLegoCandidate(row);
}

export function extractAwinJoybuySetNumberFromHumanFields(
  row: AwinJoybuyCsvRow,
): string | undefined {
  return extractAwinSetNumberFromHumanFields(row);
}

export const normalizeAwinJoybuyCsvRowToAffiliateFeedRow =
  normalizeStrictAwinCsvRowToAffiliateFeedRow;

export async function syncAwinJoybuyFeed({
  dependencies,
  options,
}: {
  dependencies?: AwinJoybuyFeedSyncDependencies;
  options?: AwinJoybuyFeedSyncOptions;
} = {}): Promise<AwinJoybuyFeedSyncResult> {
  const getAwinJoybuyFeedConfigFn =
    dependencies?.getAwinJoybuyFeedConfigFn ?? getAwinJoybuyFeedConfig;
  const config: AwinJoybuyFeedConfig = getAwinJoybuyFeedConfigFn();

  return syncAwinFeed({
    dependencies,
    definition: {
      config,
      merchantNotes:
        'Feed-driven merchant. Current offer state is imported from the Joybuy Awin product feed.',
      normalizeRow: normalizeAwinJoybuyCsvRowToAffiliateFeedRow,
    },
    options,
  });
}
