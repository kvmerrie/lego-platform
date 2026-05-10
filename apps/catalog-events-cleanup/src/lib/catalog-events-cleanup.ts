export const CATALOG_USER_EVENTS_TABLE = 'catalog_user_events';
export const DEFAULT_CATALOG_USER_EVENT_RETENTION_DAYS = 90;

export interface CatalogEventsCleanupResult {
  cutoffIso: string;
  deletedRowCount: number;
  retentionDays: number;
}

export interface CatalogEventsCleanupClient {
  from(tableName: string): {
    delete(options: { count: 'exact' }): {
      lt(
        columnName: string,
        value: string,
      ): PromiseLike<{
        count: number | null;
        error: { message?: string } | null;
      }>;
    };
  };
}

export function getCatalogUserEventsRetentionCutoff({
  now = new Date(),
  retentionDays = DEFAULT_CATALOG_USER_EVENT_RETENTION_DAYS,
}: {
  now?: Date;
  retentionDays?: number;
} = {}): string {
  if (
    !Number.isInteger(retentionDays) ||
    retentionDays < 1 ||
    retentionDays > 366
  ) {
    throw new Error('Catalog event retention days must be between 1 and 366.');
  }

  return new Date(
    now.getTime() - retentionDays * 24 * 60 * 60 * 1000,
  ).toISOString();
}

export async function cleanupCatalogUserEvents({
  now = new Date(),
  retentionDays = DEFAULT_CATALOG_USER_EVENT_RETENTION_DAYS,
  supabaseClient,
}: {
  now?: Date;
  retentionDays?: number;
  supabaseClient: CatalogEventsCleanupClient;
}): Promise<CatalogEventsCleanupResult> {
  const cutoffIso = getCatalogUserEventsRetentionCutoff({
    now,
    retentionDays,
  });
  const { count, error } = await supabaseClient
    .from(CATALOG_USER_EVENTS_TABLE)
    .delete({ count: 'exact' })
    .lt('created_at', cutoffIso);

  if (error) {
    throw new Error(
      `Catalog user event cleanup failed: ${error.message ?? 'Unknown Supabase error.'}`,
    );
  }

  return {
    cutoffIso,
    deletedRowCount: count ?? 0,
    retentionDays,
  };
}
