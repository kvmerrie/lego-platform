import { XMLParser } from 'fast-xml-parser';
import type { SupabaseClient } from '@supabase/supabase-js';
import { editorialAgentFeedEnvKeys } from '@lego-platform/shared/config';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import type {
  EditorialFeedItem,
  EditorialFeedItemStatus,
  EditorialFeedSyncResult,
} from '@lego-platform/content/util';

const EDITORIAL_FEED_ITEMS_TABLE_NAME = 'editorial_feed_items';

type EditorialFeedSupabaseClient = Pick<SupabaseClient, 'from'>;

interface EditorialFeedItemRow {
  article_slug: string | null;
  created_at: string;
  event_fingerprint: string | null;
  feed_name: string;
  id: string;
  source_published_at: string | null;
  source_url: string;
  status: EditorialFeedItemStatus;
  title: string;
  updated_at: string;
}

interface ParsedFeedEntry {
  eventFingerprint: string;
  feedName: string;
  sourcePublishedAt?: string;
  sourceUrl: string;
  status: EditorialFeedItemStatus;
  title: string;
}

export interface EditorialFeedConfig {
  name: string;
  url: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toArray<T>(value: T | readonly T[] | undefined): readonly T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? (value as readonly T[]) : [value as T];
}

function readText(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (isRecord(value)) {
    return readText(value['#text'] ?? value['@_href'] ?? value['href']);
  }

  return '';
}

function normalizeSourceUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    url.hash = '';

    return url.toString();
  } catch {
    return undefined;
  }
}

function createEventFingerprint({
  sourceUrl,
  title,
}: {
  sourceUrl: string;
  title: string;
}): string {
  const normalizedTitle = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 120);
  const hostname = new URL(sourceUrl).hostname.replace(/^www\./u, '');

  return `${hostname}:${normalizedTitle || sourceUrl}`;
}

const LOW_VALUE_FEED_TITLE_PATTERNS = [
  /^review:/iu,
  /\brandom figure of the day\b/iu,
  /\brandom set of the day\b/iu,
  /\brandom minifig(?:ure)? of the day\b/iu,
  /\bthis week'?s top news articles\b/iu,
  /\bwhat'?s hot this week\b/iu,
  /\bvintage set of the week\b/iu,
  /\bthrowback thursday\b/iu,
  /\bsummer set summary\b/iu,
  /\bweekly (?:news )?(?:roundup|round-up|listing|list)\b/iu,
  /\bsite updates?\b/iu,
  /\bhousekeeping\b/iu,
] as const;

function classifyFeedItemStatus(title: string): EditorialFeedItemStatus {
  return LOW_VALUE_FEED_TITLE_PATTERNS.some((pattern) => pattern.test(title))
    ? 'low_value'
    : 'new';
}

function parseFeedLink(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const alternateLink = value.find(
      (item) =>
        isRecord(item) && (!item['@_rel'] || item['@_rel'] === 'alternate'),
    );

    return readText(alternateLink ?? value[0]);
  }

  return readText(value);
}

function parseFeedDate(value: unknown): string | undefined {
  const text = readText(value);

  if (!text) {
    return undefined;
  }

  const timestamp = Date.parse(text);

  return Number.isNaN(timestamp)
    ? undefined
    : new Date(timestamp).toISOString();
}

function parseRssXml({
  feedName,
  xml,
}: {
  feedName: string;
  xml: string;
}): readonly ParsedFeedEntry[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
  });
  const parsed = parser.parse(xml) as unknown;

  if (!isRecord(parsed)) {
    return [];
  }

  const rssChannel = isRecord(parsed['rss']) ? parsed['rss']['channel'] : null;
  const rssItems = isRecord(rssChannel) ? toArray(rssChannel['item']) : [];
  const atomFeed = isRecord(parsed['feed']) ? parsed['feed'] : null;
  const atomEntries = isRecord(atomFeed) ? toArray(atomFeed['entry']) : [];
  const rawEntries = rssItems.length ? rssItems : atomEntries;

  return rawEntries.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const title = readText(entry['title']);
    const sourceUrl = normalizeSourceUrl(
      parseFeedLink(entry['link'] ?? entry['guid'] ?? entry['id']),
    );

    if (!title || !sourceUrl) {
      return [];
    }

    return [
      {
        eventFingerprint: createEventFingerprint({
          sourceUrl,
          title,
        }),
        feedName,
        sourcePublishedAt: parseFeedDate(
          entry['pubDate'] ?? entry['published'] ?? entry['updated'],
        ),
        sourceUrl,
        status: classifyFeedItemStatus(title),
        title,
      },
    ];
  });
}

function toEditorialFeedItem(row: EditorialFeedItemRow): EditorialFeedItem {
  return {
    ...(row.article_slug ? { articleSlug: row.article_slug } : {}),
    createdAt: row.created_at,
    ...(row.event_fingerprint
      ? { eventFingerprint: row.event_fingerprint }
      : {}),
    feedName: row.feed_name,
    id: row.id,
    ...(row.source_published_at
      ? { sourcePublishedAt: row.source_published_at }
      : {}),
    sourceUrl: row.source_url,
    status: row.status,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

function parseConfiguredEditorialFeeds(
  value?: string,
): readonly EditorialFeedConfig[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry, index) => {
      const [nameOrUrl, maybeUrl] = entry.split('|').map((part) => part.trim());
      const url = maybeUrl ?? nameOrUrl;
      const name = maybeUrl ? nameOrUrl : `Feed ${index + 1}`;

      return normalizeSourceUrl(url) ? [{ name, url }] : [];
    });
}

export function getConfiguredEditorialFeeds(): readonly EditorialFeedConfig[] {
  return parseConfiguredEditorialFeeds(
    process.env[editorialAgentFeedEnvKeys.feeds],
  );
}

async function listExistingFeedItems({
  eventFingerprints,
  sourceUrls,
  supabaseClient,
}: {
  eventFingerprints: readonly string[];
  sourceUrls: readonly string[];
  supabaseClient: EditorialFeedSupabaseClient;
}): Promise<readonly EditorialFeedItemRow[]> {
  const [sourceUrlResult, fingerprintResult] = await Promise.all([
    sourceUrls.length
      ? supabaseClient
          .from(EDITORIAL_FEED_ITEMS_TABLE_NAME)
          .select('*')
          .in('source_url', sourceUrls)
      : Promise.resolve({ data: [], error: null }),
    eventFingerprints.length
      ? supabaseClient
          .from(EDITORIAL_FEED_ITEMS_TABLE_NAME)
          .select('*')
          .in('event_fingerprint', eventFingerprints)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (sourceUrlResult.error || fingerprintResult.error) {
    throw new Error('Feed-items konden niet worden gecontroleerd.');
  }

  return [
    ...((sourceUrlResult.data ?? []) as EditorialFeedItemRow[]),
    ...((fingerprintResult.data ?? []) as EditorialFeedItemRow[]),
  ];
}

export async function syncEditorialFeed({
  feeds = getConfiguredEditorialFeeds(),
  fetchFn = fetch,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  feeds?: readonly EditorialFeedConfig[];
  fetchFn?: typeof fetch;
  supabaseClient?: EditorialFeedSupabaseClient;
} = {}): Promise<EditorialFeedSyncResult> {
  const parsedEntries = (
    await Promise.all(
      feeds.map(async (feed) => {
        const response = await fetchFn(feed.url);

        if (!response.ok) {
          throw new Error(`RSS feed kon niet worden opgehaald: ${feed.name}.`);
        }

        return parseRssXml({
          feedName: feed.name,
          xml: await response.text(),
        });
      }),
    )
  ).flat();
  const existingRows = await listExistingFeedItems({
    eventFingerprints: parsedEntries.map((entry) => entry.eventFingerprint),
    sourceUrls: parsedEntries.map((entry) => entry.sourceUrl),
    supabaseClient,
  });
  const existingSourceUrls = new Set(existingRows.map((row) => row.source_url));
  const existingFingerprints = new Set(
    existingRows.flatMap((row) =>
      row.event_fingerprint ? [row.event_fingerprint] : [],
    ),
  );
  const seenSourceUrls = new Set<string>();
  const seenFingerprints = new Set<string>();
  const rowsToInsert = parsedEntries.filter((entry) => {
    if (
      existingSourceUrls.has(entry.sourceUrl) ||
      existingFingerprints.has(entry.eventFingerprint) ||
      seenSourceUrls.has(entry.sourceUrl) ||
      seenFingerprints.has(entry.eventFingerprint)
    ) {
      return false;
    }

    seenSourceUrls.add(entry.sourceUrl);
    seenFingerprints.add(entry.eventFingerprint);
    return true;
  });

  if (!rowsToInsert.length) {
    return {
      inserted: 0,
      items: existingRows.map(toEditorialFeedItem),
      skipped: parsedEntries.length,
      total: parsedEntries.length,
    };
  }

  const { data, error } = await supabaseClient
    .from(EDITORIAL_FEED_ITEMS_TABLE_NAME)
    .insert(
      rowsToInsert.map((entry) => ({
        event_fingerprint: entry.eventFingerprint,
        feed_name: entry.feedName,
        source_published_at: entry.sourcePublishedAt ?? null,
        source_url: entry.sourceUrl,
        status: entry.status,
        title: entry.title,
      })),
    )
    .select('*');

  if (error) {
    throw new Error('Feed-items konden niet worden opgeslagen.');
  }

  return {
    inserted: rowsToInsert.length,
    items: ((data ?? []) as EditorialFeedItemRow[]).map(toEditorialFeedItem),
    skipped: parsedEntries.length - rowsToInsert.length,
    total: parsedEntries.length,
  };
}

export async function listEditorialFeedItems({
  statuses = ['new', 'drafted', 'low_value'],
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  statuses?: readonly EditorialFeedItemStatus[];
  supabaseClient?: EditorialFeedSupabaseClient;
} = {}): Promise<readonly EditorialFeedItem[]> {
  const { data, error } = await supabaseClient
    .from(EDITORIAL_FEED_ITEMS_TABLE_NAME)
    .select('*')
    .in('status', statuses)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Feed-items konden niet worden opgehaald.');
  }

  return ((data ?? []) as EditorialFeedItemRow[]).map(toEditorialFeedItem);
}

export async function getEditorialFeedItemById({
  id,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  id: string;
  supabaseClient?: EditorialFeedSupabaseClient;
}): Promise<EditorialFeedItem | null> {
  const { data, error } = await supabaseClient
    .from(EDITORIAL_FEED_ITEMS_TABLE_NAME)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error('Feed-item kon niet worden opgehaald.');
  }

  return data ? toEditorialFeedItem(data as EditorialFeedItemRow) : null;
}

export async function updateEditorialFeedItemStatus({
  articleSlug,
  eventFingerprint,
  id,
  status,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  articleSlug?: string;
  eventFingerprint?: string;
  id: string;
  status: EditorialFeedItemStatus;
  supabaseClient?: EditorialFeedSupabaseClient;
}): Promise<EditorialFeedItem> {
  const { data, error } = await supabaseClient
    .from(EDITORIAL_FEED_ITEMS_TABLE_NAME)
    .update({
      ...(articleSlug ? { article_slug: articleSlug } : {}),
      ...(eventFingerprint ? { event_fingerprint: eventFingerprint } : {}),
      status,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new Error('Feed-item kon niet worden bijgewerkt.');
  }

  return toEditorialFeedItem(data as EditorialFeedItemRow);
}

export const editorialFeedIntakeTestUtils = {
  classifyFeedItemStatus,
  createEventFingerprint,
  parseConfiguredEditorialFeeds,
  parseRssXml,
};
