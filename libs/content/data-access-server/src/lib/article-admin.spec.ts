import { describe, expect, test, vi } from 'vitest';
import {
  createAdminArticlePreview,
  deleteAdminPublishedArticleBySlug,
  getAdminPublishedArticleBySlug,
  listAdminPublishedArticles,
  updateAdminPublishedArticle,
} from './article-admin';

function createArticleRow(overrides: Record<string, unknown> = {}) {
  return {
    created_at: '2026-05-01T08:00:00.000Z',
    frontmatter: {
      date: '2026-05-01',
      description: 'Een korte beschrijving.',
      heroImage: '',
      slug: 'spiny-shell',
      status: 'published',
      theme: 'Super Mario',
      title: 'LEGO Spiny Shell',
    },
    mdx: '---\ntitle: "LEGO Spiny Shell"\n---\n\n## Wanneer kiezen?\n\nKort.',
    published_at: '2026-05-01T09:00:00.000Z',
    slug: 'spiny-shell',
    status: 'published',
    title: 'LEGO Spiny Shell',
    updated_at: '2026-05-01T10:00:00.000Z',
    ...overrides,
  };
}

function createSupabaseClientMock({
  rows = [createArticleRow()],
}: {
  rows?: Array<Record<string, unknown>>;
} = {}) {
  const updates: Array<Record<string, unknown>> = [];
  const inserts: Array<Record<string, unknown>> = [];
  const filters: Array<[string, unknown]> = [];

  function createReadBuilder(nextRows = rows) {
    return {
      eq: vi.fn((column: string, value: unknown) => {
        filters.push([column, value]);
        return createReadBuilder(
          nextRows.filter((row) => row[column] === value),
        );
      }),
      limit: vi.fn(async (limit: number) => ({
        data: nextRows.slice(0, limit),
        error: null,
      })),
      order: vi.fn(() => createReadBuilder(nextRows)),
      single: vi.fn(async () => {
        const row = nextRows[0];

        return row
          ? {
              data: row,
              error: null,
            }
          : {
              data: null,
              error: {
                code: 'PGRST116',
              },
            };
      }),
    };
  }

  function createUpdateBuilder(payload: Record<string, unknown>) {
    let nextRows = rows;

    return {
      eq: vi.fn((column: string, value: unknown) => {
        filters.push([column, value]);
        nextRows = nextRows.filter((row) => row[column] === value);

        return createUpdateBuilder(payload);
      }),
      select: vi.fn(() => ({
        single: vi.fn(async () => {
          const row = nextRows[0];

          if (!row) {
            return {
              data: null,
              error: {
                code: 'PGRST116',
              },
            };
          }

          const updatedRow = {
            ...row,
            ...payload,
          };

          updates.push(payload);

          return {
            data: updatedRow,
            error: null,
          };
        }),
      })),
    };
  }

  const from = vi.fn(() => ({
    insert: vi.fn((payload: Record<string, unknown>) => {
      inserts.push(payload);

      return {
        select: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: {
              id: '00000000-0000-4000-8000-000000000001',
              ...payload,
              created_at: '2026-05-03T10:00:00.000Z',
            },
            error: null,
          })),
        })),
      };
    }),
    select: vi.fn(() => createReadBuilder()),
    update: vi.fn((payload: Record<string, unknown>) =>
      createUpdateBuilder(payload),
    ),
  }));

  return {
    filters,
    from,
    inserts,
    updates,
  };
}

function toSupabaseClient(
  supabaseClient: ReturnType<typeof createSupabaseClientMock>,
) {
  return supabaseClient as unknown as NonNullable<
    NonNullable<
      Parameters<typeof listAdminPublishedArticles>[0]
    >['supabaseClient']
  >;
}

function createDeleteSupabaseClientMock() {
  const filters: Array<[string, unknown]> = [];
  const updates: Array<{
    payload: Record<string, unknown>;
    table: string;
  }> = [];
  const deletedTables: string[] = [];
  const removedStoragePaths: string[][] = [];
  const storageListCalls: string[] = [];
  const tableCounts: Record<string, number> = {
    article_events: 2,
    article_previews: 1,
    articles: 1,
    editorial_feed_items: 1,
  };

  function createFilterableMutationBuilder({
    count,
    table,
  }: {
    count: number;
    table: string;
  }) {
    return {
      eq: vi.fn((column: string, value: unknown) => {
        filters.push([column, value]);
        return createFilterableMutationBuilder({
          count,
          table,
        });
      }),
      then: (
        resolve: (value: { count: number; data: null; error: null }) => void,
      ) => {
        deletedTables.push(table);
        resolve({
          count,
          data: null,
          error: null,
        });
      },
    };
  }

  function createUpdateMutationBuilder({
    count,
    payload,
    table,
  }: {
    count: number;
    payload: Record<string, unknown>;
    table: string;
  }) {
    return {
      eq: vi.fn((column: string, value: unknown) => {
        filters.push([column, value]);
        return createUpdateMutationBuilder({
          count,
          payload,
          table,
        });
      }),
      then: (
        resolve: (value: { count: number; data: null; error: null }) => void,
      ) => {
        updates.push({
          payload,
          table,
        });
        resolve({
          count,
          data: null,
          error: null,
        });
      },
    };
  }

  const from = vi.fn((table: string) => ({
    delete: vi.fn(() =>
      createFilterableMutationBuilder({
        count: tableCounts[table] ?? 0,
        table,
      }),
    ),
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({
            data:
              table === 'articles'
                ? createArticleRow({
                    slug: 'spiny-shell',
                  })
                : null,
            error: null,
          })),
        })),
      })),
    })),
    update: vi.fn((payload: Record<string, unknown>) =>
      createUpdateMutationBuilder({
        count: tableCounts[table] ?? 0,
        payload,
        table,
      }),
    ),
  }));
  const list = vi.fn(async (prefix: string) => {
    storageListCalls.push(prefix);

    if (prefix === 'articles/spiny-shell') {
      return {
        data: [
          {
            id: 'hero-webp',
            metadata: {
              size: 100,
            },
            name: 'hero.webp',
            updated_at: '2026-05-03T10:00:00.000Z',
          },
          {
            id: 'hero-jpg',
            metadata: {
              size: 100,
            },
            name: 'hero.jpg',
            updated_at: '2026-05-03T10:00:00.000Z',
          },
          {
            id: null,
            metadata: null,
            name: 'gallery',
            updated_at: null,
          },
        ],
        error: null,
      };
    }

    if (prefix === 'articles/spiny-shell/gallery') {
      return {
        data: [
          {
            id: 'gallery-one',
            metadata: {
              size: 100,
            },
            name: 'one.webp',
            updated_at: '2026-05-03T10:00:00.000Z',
          },
        ],
        error: null,
      };
    }

    return {
      data: [],
      error: null,
    };
  });
  const remove = vi.fn(async (paths: string[]) => {
    removedStoragePaths.push(paths);

    return {
      data: paths.map((name) => ({ name })),
      error: null,
    };
  });
  const storage = {
    from: vi.fn(() => ({
      list,
      remove,
    })),
  };

  return {
    deletedTables,
    filters,
    from,
    removedStoragePaths,
    storage,
    storageListCalls,
    updates,
  };
}

function toDeleteSupabaseClient(
  supabaseClient: ReturnType<typeof createDeleteSupabaseClientMock>,
) {
  return supabaseClient as unknown as NonNullable<
    Parameters<typeof deleteAdminPublishedArticleBySlug>[0]
  >['supabaseClient'];
}

describe('admin article editing', () => {
  test('lists published articles with frontmatter metadata', async () => {
    const supabaseClient = createSupabaseClientMock({
      rows: [
        createArticleRow({
          frontmatter: {
            date: '2026-05-03',
            description: 'Nieuwste beschrijving.',
            slug: 'nieuwste',
            status: 'published',
            title: 'Nieuwste artikel',
          },
          slug: 'nieuwste',
          title: 'Nieuwste artikel',
        }),
        createArticleRow({
          frontmatter: {
            date: '2026-05-01',
            description: 'Oudere beschrijving.',
            slug: 'ouder',
            status: 'published',
            title: 'Ouder artikel',
          },
          slug: 'ouder',
          title: 'Ouder artikel',
        }),
      ],
    });

    await expect(
      listAdminPublishedArticles({
        supabaseClient: toSupabaseClient(supabaseClient),
      }),
    ).resolves.toMatchObject([
      {
        date: '2026-05-03',
        slug: 'nieuwste',
        status: 'published',
        title: 'Nieuwste artikel',
      },
      {
        date: '2026-05-01',
        slug: 'ouder',
        status: 'published',
        title: 'Ouder artikel',
      },
    ]);
  });

  test('loads a published article by slug', async () => {
    const supabaseClient = createSupabaseClientMock();

    await expect(
      getAdminPublishedArticleBySlug({
        slug: 'spiny-shell',
        supabaseClient: toSupabaseClient(supabaseClient),
      }),
    ).resolves.toMatchObject({
      description: 'Een korte beschrijving.',
      mdx: expect.stringContaining('## Wanneer kiezen?'),
      publishedAt: '2026-05-01T09:00:00.000Z',
      slug: 'spiny-shell',
      theme: 'Super Mario',
      title: 'LEGO Spiny Shell',
    });
  });

  test('updates frontmatter and mdx without changing published_at', async () => {
    const supabaseClient = createSupabaseClientMock();

    const result = await updateAdminPublishedArticle({
      input: {
        frontmatter: {
          date: '2026-05-02',
          description: 'Nieuwe beschrijving.',
          heroImage: 'https://storage.example/hero.webp',
          slug: 'probeer-te-wijzigen',
          theme: 'LEGO Super Mario',
          title: 'Nieuwe titel',
        },
        mdx: '---\ntitle: "Nieuwe titel"\n---\n\n## Nieuwe heading\n\nNieuwe copy.',
      },
      slug: 'spiny-shell',
      supabaseClient: toSupabaseClient(supabaseClient),
    });

    expect(result).toMatchObject({
      date: '2026-05-02',
      description: 'Nieuwe beschrijving.',
      heroImage: 'https://storage.example/hero.webp',
      publishedAt: '2026-05-01T09:00:00.000Z',
      slug: 'spiny-shell',
      theme: 'LEGO Super Mario',
      title: 'Nieuwe titel',
    });
    expect(supabaseClient.updates[0]).toMatchObject({
      mdx: expect.stringContaining('## Nieuwe heading'),
      title: 'Nieuwe titel',
    });
    expect(supabaseClient.updates[0]).not.toHaveProperty('published_at');
    expect(
      (supabaseClient.updates[0]?.['frontmatter'] as Record<string, unknown>)
        .slug,
    ).toBe('spiny-shell');
  });

  test('removes a manual hero image when heroImage is empty', async () => {
    const supabaseClient = createSupabaseClientMock();

    await updateAdminPublishedArticle({
      input: {
        frontmatter: {
          date: '2026-05-02',
          description: 'Nieuwe beschrijving.',
          heroImage: '',
          theme: 'Super Mario',
          title: 'Nieuwe titel',
        },
        mdx: '## Nieuwe heading\n\nNieuwe copy.',
      },
      slug: 'spiny-shell',
      supabaseClient: toSupabaseClient(supabaseClient),
    });

    expect(
      (supabaseClient.updates[0]?.['frontmatter'] as Record<string, unknown>)
        .heroImage,
    ).toBe('');
  });

  test('rejects empty mdx and mdx without a heading', async () => {
    const supabaseClient = createSupabaseClientMock();

    await expect(
      updateAdminPublishedArticle({
        input: {
          frontmatter: {
            date: '2026-05-02',
            description: 'Nieuwe beschrijving.',
            title: 'Nieuwe titel',
          },
          mdx: '',
        },
        slug: 'spiny-shell',
        supabaseClient: toSupabaseClient(supabaseClient),
      }),
    ).rejects.toThrow('Artikel-MDX ontbreekt.');

    await expect(
      updateAdminPublishedArticle({
        input: {
          frontmatter: {
            date: '2026-05-02',
            description: 'Nieuwe beschrijving.',
            title: 'Nieuwe titel',
          },
          mdx: 'Alleen tekst.',
        },
        slug: 'spiny-shell',
        supabaseClient: toSupabaseClient(supabaseClient),
      }),
    ).rejects.toThrow('Artikel-MDX moet minimaal één heading bevatten.');
  });

  test('creates preview rows without touching published articles', async () => {
    const supabaseClient = createSupabaseClientMock();

    await expect(
      createAdminArticlePreview({
        input: {
          frontmatter: {
            date: '2026-05-03',
            description: 'Preview beschrijving.',
            heroImage: 'https://storage.example/hero.webp',
            title: 'Preview artikel',
          },
          mdx: '## Preview heading\n\nPreview copy.',
        },
        now: new Date('2026-05-03T10:00:00.000Z'),
        supabaseClient: toSupabaseClient(supabaseClient),
      }),
    ).resolves.toEqual({
      expiresAt: '2026-05-04T10:00:00.000Z',
      previewId: '00000000-0000-4000-8000-000000000001',
    });

    expect(supabaseClient.from).toHaveBeenCalledWith('article_previews');
    expect(supabaseClient.inserts[0]).toMatchObject({
      expires_at: '2026-05-04T10:00:00.000Z',
      frontmatter: {
        date: '2026-05-03',
        description: 'Preview beschrijving.',
        heroImage: 'https://storage.example/hero.webp',
        status: 'draft',
        title: 'Preview artikel',
      },
      mdx: '## Preview heading\n\nPreview copy.',
    });
    expect(supabaseClient.updates).toEqual([]);
  });

  test('rejects invalid preview mdx', async () => {
    const supabaseClient = createSupabaseClientMock();

    await expect(
      createAdminArticlePreview({
        input: {
          frontmatter: {
            title: 'Preview artikel',
          },
          mdx: '',
        },
        supabaseClient: toSupabaseClient(supabaseClient),
      }),
    ).rejects.toThrow('Artikel-MDX ontbreekt.');

    await expect(
      createAdminArticlePreview({
        input: {
          frontmatter: {
            title: 'Preview artikel',
          },
          mdx: 'Geen heading.',
        },
        supabaseClient: toSupabaseClient(supabaseClient),
      }),
    ).rejects.toThrow('Artikel-MDX moet minimaal één heading bevatten.');

    expect(supabaseClient.inserts).toEqual([]);
  });

  test('deletes an article and related events, previews, feed links and storage', async () => {
    const supabaseClient = createDeleteSupabaseClientMock();

    await expect(
      deleteAdminPublishedArticleBySlug({
        slug: 'spiny-shell',
        supabaseClient: toDeleteSupabaseClient(supabaseClient),
      }),
    ).resolves.toEqual({
      clearedFeedItems: 1,
      deletedArticle: true,
      deletedEvents: 2,
      deletedPreviews: 1,
      deletedStorageObjects: 3,
    });

    expect(supabaseClient.storage.from).toHaveBeenCalledWith('article-images');
    expect(supabaseClient.storageListCalls).toEqual([
      'articles/spiny-shell',
      'articles/spiny-shell/gallery',
    ]);
    expect(supabaseClient.removedStoragePaths).toEqual([
      [
        'articles/spiny-shell/hero.webp',
        'articles/spiny-shell/hero.jpg',
        'articles/spiny-shell/gallery/one.webp',
      ],
    ]);
    expect(supabaseClient.from).toHaveBeenCalledWith('article_events');
    expect(supabaseClient.from).toHaveBeenCalledWith('article_previews');
    expect(supabaseClient.from).toHaveBeenCalledWith('editorial_feed_items');
    expect(supabaseClient.from).toHaveBeenCalledWith('articles');
    expect(supabaseClient.filters).toContainEqual(['slug', 'spiny-shell']);
    expect(supabaseClient.filters).toContainEqual([
      'frontmatter->>slug',
      'spiny-shell',
    ]);
    expect(supabaseClient.filters).toContainEqual([
      'article_slug',
      'spiny-shell',
    ]);
    expect(supabaseClient.updates).toContainEqual({
      payload: {
        article_slug: null,
        status: 'new',
      },
      table: 'editorial_feed_items',
    });
  });

  test('rejects invalid delete slugs without touching storage', async () => {
    const supabaseClient = createDeleteSupabaseClientMock();

    await expect(
      deleteAdminPublishedArticleBySlug({
        slug: '../spiny-shell',
        supabaseClient: toDeleteSupabaseClient(supabaseClient),
      }),
    ).rejects.toThrow('Artikel-slug is ongeldig.');

    expect(supabaseClient.storage.from).not.toHaveBeenCalled();
  });
});
