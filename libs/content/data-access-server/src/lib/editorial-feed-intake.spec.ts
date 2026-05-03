import { describe, expect, test, vi } from 'vitest';
import {
  editorialFeedIntakeTestUtils,
  syncEditorialFeed,
  updateEditorialFeedItemStatus,
} from './editorial-feed-intake';

type FeedRow = Record<string, unknown>;

function createSupabaseClientMock(initialRows: readonly FeedRow[] = []) {
  const rows = [...initialRows];
  const insertCalls: FeedRow[][] = [];
  const updateCalls: FeedRow[] = [];

  function createQuery(tableName: string) {
    let selectedColumn = '';
    let inColumn = '';
    let inValues: readonly unknown[] = [];
    let eqColumn = '';
    let eqValue: unknown;
    let updatePayload: FeedRow | null = null;

    return {
      eq(column: string, value: unknown) {
        eqColumn = column;
        eqValue = value;
        return this;
      },
      in(column: string, values: readonly unknown[]) {
        inColumn = column;
        inValues = values;
        return Promise.resolve({
          data: rows.filter((row) => inValues.includes(row[inColumn])),
          error: null,
        });
      },
      insert(payload: FeedRow[]) {
        insertCalls.push(payload);
        const insertedRows = payload.map((row, index) => ({
          article_slug: null,
          created_at: '2026-05-03T10:00:00.000Z',
          id: `feed-${rows.length + index + 1}`,
          updated_at: '2026-05-03T10:00:00.000Z',
          ...row,
        }));

        rows.push(...insertedRows);

        return {
          select() {
            return Promise.resolve({
              data: insertedRows,
              error: null,
            });
          },
        };
      },
      maybeSingle() {
        return Promise.resolve({
          data: rows.find((row) => row[eqColumn] === eqValue) ?? null,
          error: null,
        });
      },
      order() {
        return Promise.resolve({
          data: rows,
          error: null,
        });
      },
      select(column = '*') {
        selectedColumn = column;

        if (updatePayload) {
          const row = rows.find((candidate) => candidate[eqColumn] === eqValue);

          if (row) {
            Object.assign(row, updatePayload, {
              updated_at: '2026-05-03T11:00:00.000Z',
            });
          }

          return {
            single() {
              return Promise.resolve({
                data: row,
                error: null,
              });
            },
          };
        }

        return this;
      },
      single() {
        return Promise.resolve({
          data: rows.find((row) => row[eqColumn] === eqValue) ?? null,
          error: null,
        });
      },
      update(payload: FeedRow) {
        updatePayload = payload;
        updateCalls.push(payload);
        return this;
      },
      get selectedColumn() {
        return selectedColumn;
      },
      tableName,
    };
  }

  return {
    client: {
      from: vi.fn(createQuery),
    },
    insertCalls,
    rows,
    updateCalls,
  };
}

const rssXml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Brick Example</title>
    <item>
      <title>LEGO 40787 Mario Kart Spiny Shell is terug</title>
      <link>https://example.com/spiny-shell#comments</link>
      <pubDate>Fri, 01 May 2026 08:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

describe('editorial feed intake', () => {
  test('parses configured feeds without requiring code changes per source', () => {
    expect(
      editorialFeedIntakeTestUtils.parseConfiguredEditorialFeeds(
        'BrickTastic|https://www.bricktastic.nl/feed/,https://example.com/rss',
      ),
    ).toEqual([
      {
        name: 'BrickTastic',
        url: 'https://www.bricktastic.nl/feed/',
      },
      {
        name: 'Feed 2',
        url: 'https://example.com/rss',
      },
    ]);
  });

  test('stores new feed items as draft-only source metadata', async () => {
    const supabase = createSupabaseClientMock();
    const result = await syncEditorialFeed({
      feeds: [{ name: 'Brick Example', url: 'https://example.com/rss' }],
      fetchFn: vi.fn(async () => new Response(rssXml)),
      supabaseClient: supabase.client,
    });

    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(0);
    expect(supabase.insertCalls[0]).toEqual([
      expect.objectContaining({
        feed_name: 'Brick Example',
        source_url: 'https://example.com/spiny-shell',
        status: 'new',
        title: 'LEGO 40787 Mario Kart Spiny Shell is terug',
      }),
    ]);
    expect(supabase.insertCalls[0]?.[0]).not.toHaveProperty('mdx');
  });

  test('skips duplicates by sourceUrl and event fingerprint', async () => {
    const eventFingerprint =
      editorialFeedIntakeTestUtils.createEventFingerprint({
        sourceUrl: 'https://example.com/spiny-shell',
        title: 'LEGO 40787 Mario Kart Spiny Shell is terug',
      });
    const supabase = createSupabaseClientMock([
      {
        article_slug: null,
        created_at: '2026-05-03T10:00:00.000Z',
        event_fingerprint: eventFingerprint,
        feed_name: 'Brick Example',
        id: 'feed-1',
        source_published_at: null,
        source_url: 'https://example.com/spiny-shell',
        status: 'new',
        title: 'LEGO 40787 Mario Kart Spiny Shell is terug',
        updated_at: '2026-05-03T10:00:00.000Z',
      },
    ]);

    const result = await syncEditorialFeed({
      feeds: [{ name: 'Brick Example', url: 'https://example.com/rss' }],
      fetchFn: vi.fn(async () => new Response(rssXml)),
      supabaseClient: supabase.client,
    });

    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(1);
    expect(supabase.insertCalls).toEqual([]);
  });

  test('links published status to an article slug only after manual publish', async () => {
    const supabase = createSupabaseClientMock([
      {
        article_slug: null,
        created_at: '2026-05-03T10:00:00.000Z',
        event_fingerprint: 'example.com:spiny',
        feed_name: 'Brick Example',
        id: 'feed-1',
        source_published_at: null,
        source_url: 'https://example.com/spiny-shell',
        status: 'drafted',
        title: 'LEGO 40787 Mario Kart Spiny Shell is terug',
        updated_at: '2026-05-03T10:00:00.000Z',
      },
    ]);

    const updatedItem = await updateEditorialFeedItemStatus({
      articleSlug: 'lego-40787-mario-kart-spiny-shell-is-terug',
      id: 'feed-1',
      status: 'published',
      supabaseClient: supabase.client,
    });

    expect(supabase.updateCalls[0]).toEqual({
      article_slug: 'lego-40787-mario-kart-spiny-shell-is-terug',
      status: 'published',
    });
    expect(updatedItem.articleSlug).toBe(
      'lego-40787-mario-kart-spiny-shell-is-terug',
    );
    expect(updatedItem.status).toBe('published');
  });
});
