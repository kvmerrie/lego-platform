export const editorialFeedItemStatuses = [
  'new',
  'drafted',
  'ignored',
  'low_value',
  'published',
] as const;

export type EditorialFeedItemStatus =
  (typeof editorialFeedItemStatuses)[number];

export interface EditorialFeedItem {
  articleSlug?: string;
  createdAt: string;
  eventFingerprint?: string;
  feedName: string;
  id: string;
  sourcePublishedAt?: string;
  sourceUrl: string;
  status: EditorialFeedItemStatus;
  title: string;
  updatedAt: string;
}

export interface EditorialFeedSyncResult {
  inserted: number;
  skipped: number;
  total: number;
  items: readonly EditorialFeedItem[];
}
