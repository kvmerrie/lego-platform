import { describe, expect, test, vi } from 'vitest';
import {
  editorialFeedIntakeTestUtils,
  listEditorialFeedItems,
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
        return this;
      },
      then(
        onFulfilled: (value: {
          data: readonly FeedRow[];
          error: null;
        }) => unknown,
      ) {
        return Promise.resolve({
          data: rows,
          error: null,
        }).then(onFulfilled);
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

const mixedBricksetRssXml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Brickset</title>
    <item>
      <title>Random figure of the day: coltlnm17</title>
      <link>https://brickset.com/article/random-figure-of-the-day-coltlnm17</link>
    </item>
    <item>
      <title>This week's top news articles</title>
      <link>https://brickset.com/article/this-weeks-top-news-articles</link>
    </item>
    <item>
      <title>Three beautiful botanical sets revealed!</title>
      <link>https://brickset.com/article/three-beautiful-botanical-sets-revealed</link>
    </item>
    <item>
      <title>LEGO Marvel 76339 The Fantastic Four H.E.R.B.I.E. onthuld</title>
      <link>https://www.bricktastic.nl/lego/lego-marvel-76339-the-fantastic-four-h-e-r-b-i-e-onthuld/</link>
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

  test('normalizes Brickset http feed URLs to https source metadata', async () => {
    const supabase = createSupabaseClientMock();
    await syncEditorialFeed({
      feeds: [{ name: 'Brickset', url: 'https://brickset.com/feed' }],
      fetchFn: vi.fn(
        async () =>
          new Response(`<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>LEGO Star Wars Up-Scaled Darth Vader and AT-RT Driver Helmet revealed!</title>
      <link>http://brickset.com/article/131538/</link>
    </item>
  </channel>
</rss>`),
      ),
      supabaseClient: supabase.client,
    });

    expect(supabase.insertCalls[0]?.[0]).toEqual(
      expect.objectContaining({
        source_url: 'https://brickset.com/article/131538',
        status: 'new',
      }),
    );
  });

  test('marks low-value Brickset utility posts during feed sync', async () => {
    const supabase = createSupabaseClientMock();
    const result = await syncEditorialFeed({
      feeds: [{ name: 'Brickset', url: 'https://brickset.com/feed' }],
      fetchFn: vi.fn(async () => new Response(mixedBricksetRssXml)),
      supabaseClient: supabase.client,
    });

    expect(result.inserted).toBe(4);
    expect(
      supabase.insertCalls[0]?.find(
        (row) => row['title'] === 'Random figure of the day: coltlnm17',
      ),
    ).toEqual(
      expect.objectContaining({
        status: 'low_value',
      }),
    );
    expect(
      supabase.insertCalls[0]?.find(
        (row) => row['title'] === "This week's top news articles",
      ),
    ).toEqual(
      expect.objectContaining({
        status: 'low_value',
      }),
    );
  });

  test('keeps normal Brickset and BrickTastic articles draftable', async () => {
    const entries = editorialFeedIntakeTestUtils.parseRssXml({
      feedName: 'Brickset',
      xml: mixedBricksetRssXml,
    });

    expect(
      entries.find(
        (entry) => entry.title === 'Three beautiful botanical sets revealed!',
      )?.status,
    ).toBe('new');
    expect(
      entries.find((entry) =>
        entry.title.includes('The Fantastic Four H.E.R.B.I.E.'),
      )?.status,
    ).toBe('new');
  });

  test('marks recurring Brickset summary and community posts as low value', () => {
    expect(
      editorialFeedIntakeTestUtils.classifyFeedItemStatus(
        'Review: 42685 Heartlake City Fashion Show',
      ),
    ).toBe('low_value');
    expect(
      editorialFeedIntakeTestUtils.classifyFeedItemStatus(
        "What's hot this week",
      ),
    ).toBe('low_value');
    expect(
      editorialFeedIntakeTestUtils.classifyFeedItemStatus(
        'Vintage set of the week: 6399 Airport Shuttle',
      ),
    ).toBe('low_value');
    expect(
      editorialFeedIntakeTestUtils.classifyFeedItemStatus(
        'Throwback Thursday: classic space returns',
      ),
    ).toBe('low_value');
    expect(
      editorialFeedIntakeTestUtils.classifyFeedItemStatus('Summer set summary'),
    ).toBe('low_value');
  });

  test('keeps reveal and unveiled news articles draftable', () => {
    expect(
      editorialFeedIntakeTestUtils.classifyFeedItemStatus(
        'Three beautiful botanical sets revealed!',
      ),
    ).toBe('new');
    expect(
      editorialFeedIntakeTestUtils.classifyFeedItemStatus(
        'Summer LEGO Harry Potter sets unveiled',
      ),
    ).toBe('new');
    expect(
      editorialFeedIntakeTestUtils.classifyFeedItemStatus(
        'LEGO Marvel 76339 The Fantastic Four H.E.R.B.I.E. revealed',
      ),
    ).toBe('new');
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

  test('stores generated draft content on drafted feed items', async () => {
    const supabase = createSupabaseClientMock([
      {
        article_slug: null,
        created_at: '2026-05-03T10:00:00.000Z',
        event_fingerprint: 'example.com:spiny',
        feed_name: 'Brick Example',
        id: 'feed-1',
        source_published_at: null,
        source_url: 'https://example.com/spiny-shell',
        status: 'new',
        title: 'LEGO 40787 Mario Kart Spiny Shell is terug',
        updated_at: '2026-05-03T10:00:00.000Z',
      },
    ]);

    const updatedItem = await updateEditorialFeedItemStatus({
      draftFrontmatter: {
        sourceUrl: 'https://example.com/spiny-shell',
        title: 'LEGO 40787 Mario Kart Spiny Shell is terug',
      },
      draftMdx: '## Concept\n\nDrafttekst.',
      id: 'feed-1',
      status: 'drafted',
      supabaseClient: supabase.client,
    });

    expect(supabase.updateCalls[0]).toEqual(
      expect.objectContaining({
        draft_frontmatter: {
          sourceUrl: 'https://example.com/spiny-shell',
          title: 'LEGO 40787 Mario Kart Spiny Shell is terug',
        },
        draft_mdx: '## Concept\n\nDrafttekst.',
        status: 'drafted',
      }),
    );
    expect(supabase.updateCalls[0]?.['drafted_at']).toEqual(expect.any(String));
    expect(updatedItem.draftMdx).toBe('## Concept\n\nDrafttekst.');
    expect(updatedItem.draftFrontmatter).toEqual(
      expect.objectContaining({
        title: 'LEGO 40787 Mario Kart Spiny Shell is terug',
      }),
    );
    expect(updatedItem.draftedAt).toEqual(expect.any(String));
  });

  test('clears saved draft content after publish', async () => {
    const supabase = createSupabaseClientMock([
      {
        article_slug: null,
        created_at: '2026-05-03T10:00:00.000Z',
        draft_frontmatter: {
          title: 'LEGO 40787 Mario Kart Spiny Shell is terug',
        },
        draft_mdx: '## Concept\n\nDrafttekst.',
        drafted_at: '2026-05-03T11:00:00.000Z',
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
      clearDraft: true,
      id: 'feed-1',
      status: 'published',
      supabaseClient: supabase.client,
    });

    expect(supabase.updateCalls[0]).toEqual({
      article_slug: 'lego-40787-mario-kart-spiny-shell-is-terug',
      draft_frontmatter: null,
      draft_mdx: null,
      drafted_at: null,
      status: 'published',
    });
    expect(updatedItem.draftMdx).toBeUndefined();
    expect(updatedItem.draftFrontmatter).toBeUndefined();
    expect(updatedItem.draftedAt).toBeUndefined();
    expect(updatedItem.status).toBe('published');
  });

  test('stores separate drafts for overlapping feed items without changing fingerprints', async () => {
    const overlappingRows = [
      {
        article_slug: null,
        created_at: '2026-05-03T10:00:00.000Z',
        event_fingerprint: 'brickset.com:lego-star-wars-75459',
        feed_name: 'Brickset',
        id: 'feed-brickset-75459',
        source_published_at: null,
        source_url: 'https://brickset.com/article/131598',
        status: 'new',
        title: 'LEGO Star Wars 75459 set revealed',
        updated_at: '2026-05-03T10:00:00.000Z',
      },
      {
        article_slug: null,
        created_at: '2026-05-03T10:05:00.000Z',
        event_fingerprint: 'bricktastic.nl:lego-star-wars-75459',
        feed_name: 'BrickTastic',
        id: 'feed-bricktastic-75459',
        source_published_at: null,
        source_url: 'https://www.bricktastic.nl/lego/star-wars-75459/',
        status: 'new',
        title: 'LEGO Star Wars 75459 onthuld',
        updated_at: '2026-05-03T10:05:00.000Z',
      },
    ];
    const supabase = createSupabaseClientMock(overlappingRows);

    const bricksetDraft = await updateEditorialFeedItemStatus({
      draftFrontmatter: {
        sourceUrl: 'https://brickset.com/article/131598',
        title: 'LEGO Star Wars 75459 set revealed',
      },
      draftMdx: '## Brickset concept\n\nDrafttekst.',
      id: 'feed-brickset-75459',
      status: 'drafted',
      supabaseClient: supabase.client,
    });
    const bricktasticDraft = await updateEditorialFeedItemStatus({
      draftFrontmatter: {
        sourceUrl: 'https://www.bricktastic.nl/lego/star-wars-75459/',
        title: 'LEGO Star Wars 75459 onthuld',
      },
      draftMdx: '## BrickTastic concept\n\nDrafttekst.',
      id: 'feed-bricktastic-75459',
      status: 'drafted',
      supabaseClient: supabase.client,
    });

    expect(bricksetDraft.draftMdx).toBe('## Brickset concept\n\nDrafttekst.');
    expect(bricktasticDraft.draftMdx).toBe(
      '## BrickTastic concept\n\nDrafttekst.',
    );
    expect(bricksetDraft.eventFingerprint).toBe(
      'brickset.com:lego-star-wars-75459',
    );
    expect(bricktasticDraft.eventFingerprint).toBe(
      'bricktastic.nl:lego-star-wars-75459',
    );
    expect(supabase.updateCalls).toEqual([
      expect.not.objectContaining({
        event_fingerprint: expect.any(String),
      }),
      expect.not.objectContaining({
        event_fingerprint: expect.any(String),
      }),
    ]);

    const reverseSupabase = createSupabaseClientMock(overlappingRows);
    const reverseFirstDraft = await updateEditorialFeedItemStatus({
      draftFrontmatter: {
        sourceUrl: 'https://www.bricktastic.nl/lego/star-wars-75459/',
        title: 'LEGO Star Wars 75459 onthuld',
      },
      draftMdx: '## BrickTastic concept\n\nDrafttekst.',
      id: 'feed-bricktastic-75459',
      status: 'drafted',
      supabaseClient: reverseSupabase.client,
    });
    const reverseSecondDraft = await updateEditorialFeedItemStatus({
      draftFrontmatter: {
        sourceUrl: 'https://brickset.com/article/131598',
        title: 'LEGO Star Wars 75459 set revealed',
      },
      draftMdx: '## Brickset concept\n\nDrafttekst.',
      id: 'feed-brickset-75459',
      status: 'drafted',
      supabaseClient: reverseSupabase.client,
    });

    expect(reverseFirstDraft.draftMdx).toBe(
      '## BrickTastic concept\n\nDrafttekst.',
    );
    expect(reverseSecondDraft.draftMdx).toBe(
      '## Brickset concept\n\nDrafttekst.',
    );
    expect(reverseSupabase.updateCalls).toEqual([
      expect.not.objectContaining({
        event_fingerprint: expect.any(String),
      }),
      expect.not.objectContaining({
        event_fingerprint: expect.any(String),
      }),
    ]);
  });

  test('lists feed items ordered by source published date descending', async () => {
    const supabase = createSupabaseClientMock([]);
    const orderCalls: Array<{
      column: string;
      options?: Record<string, unknown>;
    }> = [];
    const query = {
      in: vi.fn(() => query),
      order: vi.fn((column: string, options?: Record<string, unknown>) => {
        orderCalls.push({ column, options });
        return query;
      }),
      select: vi.fn(() => query),
      then: vi.fn(
        (
          onFulfilled: (value: {
            data: readonly FeedRow[];
            error: null;
          }) => unknown,
        ) =>
          Promise.resolve({
            data: [],
            error: null,
          }).then(onFulfilled),
      ),
    };
    const client = {
      from: vi.fn(() => query),
    };

    await listEditorialFeedItems({
      supabaseClient: client,
    });

    expect(query.order).toHaveBeenCalledWith('source_published_at', {
      ascending: false,
      nullsFirst: false,
    });
    expect(query.order).toHaveBeenCalledWith('created_at', {
      ascending: false,
    });
    expect(orderCalls.map((call) => call.column)).toEqual([
      'source_published_at',
      'created_at',
    ]);
    expect(supabase.client).toBeDefined();
  });
});
