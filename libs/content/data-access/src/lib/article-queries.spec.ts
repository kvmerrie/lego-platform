import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  getArticlePreviewById,
  getPublishedArticleBySlug,
  getPopularArticles,
  listPublishedArticlesByPrimarySetNumber,
  listPublishedArticles,
  listPublishedArticleSlugs,
  logArticleClickEvent,
  resetContentArticleQueryStateForTests,
  type ContentArticleSupabaseRow,
} from './article-queries';

function createArticleRow(
  overrides: Partial<ContentArticleSupabaseRow>,
): ContentArticleSupabaseRow {
  return {
    created_at: '2026-05-03T11:00:00.000Z',
    frontmatter: {
      date: '2026-05-03',
      description: 'Beschrijving.',
    },
    mdx: '---\ntitle: "Artikel"\n---\n\n## Intro\n\nBody.',
    published_at: '2026-05-03T11:00:00.000Z',
    slug: 'artikel',
    status: 'published',
    title: 'Artikel',
    updated_at: '2026-05-03T11:00:00.000Z',
    ...overrides,
  };
}

function createArticlesSupabaseClient(
  rows: readonly ContentArticleSupabaseRow[],
) {
  const calls: Array<readonly unknown[]> = [];

  function createBuilder(sourceRows: readonly ContentArticleSupabaseRow[]) {
    const filters: Array<
      | { type: 'eq'; fieldName: string; value: string }
      | { type: 'ilike'; fieldName: string; value: string }
      | { type: 'in'; fieldName: string; values: readonly string[] }
      | { type: 'notIn'; fieldName: string; values: readonly string[] }
      | { type: 'or'; value: string }
      | { type: 'order'; fieldName: string; ascending: boolean }
      | { type: 'range'; from: number; to: number }
    > = [];
    const builder = {
      eq: vi.fn((fieldName: string, value: string) => {
        calls.push(['eq', fieldName, value]);
        filters.push({ fieldName, type: 'eq', value });

        return builder;
      }),
      ilike: vi.fn((fieldName: string, value: string) => {
        calls.push(['ilike', fieldName, value]);
        filters.push({ fieldName, type: 'ilike', value });

        return builder;
      }),
      in: vi.fn((fieldName: string, values: readonly string[]) => {
        calls.push(['in', fieldName, values]);
        filters.push({ fieldName, type: 'in', values });

        return builder;
      }),
      not: vi.fn((fieldName: string, operator: string, value: string) => {
        calls.push(['not', fieldName, operator, value]);

        if (operator === 'in') {
          filters.push({
            fieldName,
            type: 'notIn',
            values: value
              .replace(/^\(/u, '')
              .replace(/\)$/u, '')
              .split(',')
              .filter(Boolean),
          });
        }

        return builder;
      }),
      or: vi.fn((value: string) => {
        calls.push(['or', value]);
        filters.push({ type: 'or', value });

        return builder;
      }),
      order: vi.fn((fieldName: string, options: { ascending: boolean }) => {
        calls.push(['order', fieldName, options]);
        filters.push({
          ascending: options.ascending,
          fieldName,
          type: 'order',
        });

        return builder;
      }),
      range: vi.fn((from: number, to: number) => {
        calls.push(['range', from, to]);
        filters.push({ from, to, type: 'range' });

        return builder;
      }),
      select: vi.fn((fields: string) => {
        calls.push(['select', fields]);

        return builder;
      }),
      then<TResult1 = { data: ContentArticleSupabaseRow[]; error: null }>(
        onFulfilled?:
          | ((value: {
              data: ContentArticleSupabaseRow[];
              error: null;
            }) => TResult1 | PromiseLike<TResult1>)
          | null,
      ) {
        const filteredRows = filters.reduce<
          readonly ContentArticleSupabaseRow[]
        >((resultRows, filter) => {
          if (filter.type === 'eq') {
            return resultRows.filter((row) => {
              if (filter.fieldName === 'status') {
                return row.status === filter.value;
              }

              return (
                row[filter.fieldName as keyof ContentArticleSupabaseRow] ===
                filter.value
              );
            });
          }

          if (filter.type === 'in') {
            return filter.fieldName === 'slug'
              ? resultRows.filter((row) => filter.values.includes(row.slug))
              : resultRows;
          }

          if (filter.type === 'notIn') {
            return filter.fieldName === 'slug'
              ? resultRows.filter((row) => !filter.values.includes(row.slug))
              : resultRows;
          }

          if (filter.type === 'ilike') {
            const needle = filter.value
              .replaceAll('%', '')
              .replaceAll('\\_', '_')
              .replaceAll('\\%', '%')
              .toLowerCase();

            if (filter.fieldName === 'frontmatter->>theme') {
              return resultRows.filter((row) =>
                String(row.frontmatter?.['theme'] ?? '')
                  .toLowerCase()
                  .includes(needle),
              );
            }

            return resultRows;
          }

          if (filter.type === 'or') {
            const needles = filter.value.split(',').map((entry) =>
              entry
                .replace(/^mdx\.ilike\.%/u, '')
                .replace(/%$/u, '')
                .toLowerCase(),
            );

            return resultRows.filter((row) =>
              needles.some((needle) => row.mdx.toLowerCase().includes(needle)),
            );
          }

          if (filter.type === 'order') {
            const sortedRows = [...resultRows].sort((left, right) => {
              const leftValue =
                filter.fieldName === 'frontmatter->>date'
                  ? left.frontmatter?.['date']
                  : left[filter.fieldName as keyof ContentArticleSupabaseRow];
              const rightValue =
                filter.fieldName === 'frontmatter->>date'
                  ? right.frontmatter?.['date']
                  : right[filter.fieldName as keyof ContentArticleSupabaseRow];

              return String(leftValue ?? '').localeCompare(
                String(rightValue ?? ''),
              );
            });

            return filter.ascending ? sortedRows : sortedRows.reverse();
          }

          if (filter.type === 'range') {
            return resultRows.slice(filter.from, filter.to + 1);
          }

          return resultRows;
        }, sourceRows);

        return Promise.resolve({
          data: [...filteredRows],
          error: null,
        }).then(onFulfilled ?? undefined);
      },
    };

    return builder;
  }

  const client = {
    calls,
    from: vi.fn(() => createBuilder(rows)),
  };

  return client;
}

const uploadedHeroImage =
  'https://project.supabase.co/storage/v1/object/public/article-images/articles/star-wars-day-2026/hero.webp';

const sampleRows: readonly ContentArticleSupabaseRow[] = [
  createArticleRow({
    created_at: '2026-04-24T09:00:00.000Z',
    frontmatter: {
      authorName: 'Kasper van Merrienboer',
      date: '2026-04-24',
      description: 'Waar wil je nu op letten?',
      heroImage: uploadedHeroImage,
      heroImageAlt: 'Star Wars hero',
      theme: 'Star Wars',
      updatedAt: '2026-04-25T12:00:00.000Z',
    },
    mdx: '---\ntitle: "Star Wars Day 2026"\n---\n\n## Intro\n\nDit is een gepubliceerd artikel.',
    published_at: '2026-04-24T09:00:00.000Z',
    slug: 'star-wars-day-2026',
    title: 'Star Wars Day 2026',
    updated_at: '2026-04-25T12:00:00.000Z',
  }),
  createArticleRow({
    frontmatter: {
      cardImage: 'https://storage.example/draft-card.webp',
      date: '2026-04-23',
      description: 'Nog niet live',
      heroImage: 'https://storage.example/draft-hero.webp',
    },
    slug: 'draft-guide',
    status: 'draft',
    title: 'Draft guide',
  }),
  createArticleRow({
    frontmatter: {
      date: '2026-05-01',
      description: 'Waarom deze reward nu telt.',
      heroImage: '',
    },
    mdx: [
      '---',
      'title: "Spiny Shell terug"',
      'heroImage: ""',
      '---',
      '',
      'LEGO 40787 is terug als reward.',
      '',
      '<FeaturedSet setNumber="40787" />',
    ].join('\n'),
    slug: 'spiny-shell-terug',
    title: 'Spiny Shell terug',
  }),
  createArticleRow({
    frontmatter: {
      date: '2026-05-03',
      description: 'Voor wie deze helm opvalt.',
      theme: 'Other',
    },
    mdx: 'LEGO Lewis Hamilton Helmet is onthuld.',
    slug: 'lewis-hamilton-helmet',
    title: 'LEGO Lewis Hamilton Helmet onthuld',
  }),
];

describe('content article queries', () => {
  afterEach(() => {
    resetContentArticleQueryStateForTests();
    vi.restoreAllMocks();
  });

  test('lists published Supabase articles and falls back cardImage to heroImage', async () => {
    const result = await listPublishedArticles({
      supabaseClient: createArticlesSupabaseClient(sampleRows),
    });

    expect(result).toHaveLength(3);
    expect(
      result.find((article) => article.slug === 'star-wars-day-2026'),
    ).toMatchObject({
      cardImage: uploadedHeroImage,
      cardImageAlt: 'Star Wars hero',
      cardImageSource: 'manual',
      authorName: 'Kasper van Merrienboer',
      heroImage: uploadedHeroImage,
      heroImageSource: 'manual',
      slug: 'star-wars-day-2026',
      status: 'published',
      theme: 'Star Wars',
      title: 'Star Wars Day 2026',
      updatedAt: '2026-04-25T12:00:00.000Z',
    });
  });

  test('does not expose Other as a public article theme', async () => {
    const result = await listPublishedArticles({
      supabaseClient: createArticlesSupabaseClient(sampleRows),
    });

    expect(
      result.find((article) => article.slug === 'lewis-hamilton-helmet')?.theme,
    ).toBeUndefined();
  });

  test('defaults article author when frontmatter does not provide one', async () => {
    const result = await listPublishedArticles({
      supabaseClient: createArticlesSupabaseClient([
        createArticleRow({
          frontmatter: {
            date: '2026-05-03',
            description: 'Beschrijving.',
            title: 'Artikel zonder auteur',
          },
          slug: 'artikel-zonder-auteur',
          title: 'Artikel zonder auteur',
        }),
      ]),
    });

    expect(result[0]?.authorName).toBe('Kasper van Merrienboer');
  });

  test('hides updatedAt for first-publish timestamps within tolerance', async () => {
    const result = await listPublishedArticles({
      supabaseClient: createArticlesSupabaseClient([
        createArticleRow({
          created_at: '2026-05-03T11:00:00.000Z',
          frontmatter: {
            date: '2026-05-03',
            description: 'Net gepubliceerd.',
            title: 'Net gepubliceerd',
          },
          published_at: '2026-05-03T11:00:00.000Z',
          slug: 'net-gepubliceerd',
          title: 'Net gepubliceerd',
          updated_at: '2026-05-03T11:00:30.000Z',
        }),
      ]),
    });

    expect(result[0]?.updatedAt).toBeUndefined();
  });

  test('shows updatedAt after a real post-publication edit', async () => {
    const result = await listPublishedArticles({
      supabaseClient: createArticlesSupabaseClient([
        createArticleRow({
          created_at: '2026-05-03T11:00:00.000Z',
          frontmatter: {
            date: '2026-05-03',
            description: 'Later bijgewerkt.',
            title: 'Later bijgewerkt',
          },
          published_at: '2026-05-03T11:00:00.000Z',
          slug: 'later-bijgewerkt',
          title: 'Later bijgewerkt',
          updated_at: '2026-05-03T11:02:01.000Z',
        }),
      ]),
    });

    expect(result[0]?.updatedAt).toBe('2026-05-03T11:02:01.000Z');
  });

  test('hides draft slugs and draft detail pages from public queries', async () => {
    const supabaseClient = createArticlesSupabaseClient(sampleRows);
    const slugs = await listPublishedArticleSlugs({ supabaseClient });
    const publishedArticle = await getPublishedArticleBySlug(
      'star-wars-day-2026',
      { supabaseClient },
    );
    const draftArticle = await getPublishedArticleBySlug('draft-guide', {
      supabaseClient,
    });

    expect(slugs).toEqual([
      'lewis-hamilton-helmet',
      'spiny-shell-terug',
      'star-wars-day-2026',
    ]);
    expect(publishedArticle?.slug).toBe('star-wars-day-2026');
    expect(draftArticle).toBeNull();
  });

  test('drops legacy local public image paths instead of returning broken image urls', async () => {
    const [result] = await listPublishedArticles({
      supabaseClient: createArticlesSupabaseClient([
        createArticleRow({
          frontmatter: {
            cardImage: '/articles/local/card.jpg',
            date: '2026-05-03',
            description: 'Lokaal pad is legacy.',
            heroImage: '/articles/local/hero.jpg',
          },
          slug: 'legacy-local-image',
          title: 'Legacy local image',
        }),
      ]),
    });

    expect(result?.heroImage).toBeUndefined();
    expect(result?.cardImage).toBeUndefined();
  });

  test('allows empty heroImage and extracts the primary set from FeaturedSet', async () => {
    const publishedArticle = await getPublishedArticleBySlug(
      'spiny-shell-terug',
      { supabaseClient: createArticlesSupabaseClient(sampleRows) },
    );

    expect(publishedArticle).toMatchObject({
      heroImage: undefined,
      primarySetNumber: '40787',
      slug: 'spiny-shell-terug',
      title: 'Spiny Shell terug',
    });
  });

  test('lists articles for an exact primary set number only', async () => {
    const result = await listPublishedArticlesByPrimarySetNumber({
      setNumber: '40787-1',
      supabaseClient: createArticlesSupabaseClient([
        createArticleRow({
          frontmatter: {
            date: '2026-05-04',
            description: 'Deze hoort bij de Spiny Shell.',
          },
          mdx: '<FeaturedSet setNumber="40787" />',
          slug: 'spiny-shell-update',
          title: 'Spiny Shell update',
        }),
        createArticleRow({
          frontmatter: {
            date: '2026-05-03',
            description: 'Zelfde thema, andere set.',
          },
          mdx: '<FeaturedSet setNumber="72037" />',
          slug: 'mario-kart-andere-set',
          title: 'Andere Mario Kart set',
        }),
        createArticleRow({
          frontmatter: {
            date: '2026-05-02',
            description: 'Roundup mag niet meetellen.',
          },
          mdx: '<SetSpotlightList setIds="40787, 72037" />',
          slug: 'mario-kart-roundup',
          title: 'Mario Kart roundup',
        }),
      ]),
    });

    expect(result.map((article) => article.slug)).toEqual([
      'spiny-shell-update',
    ]);
  });

  test('keeps sourceUrl internal and resolves a subtle public source attribution', async () => {
    const publishedArticle = await getPublishedArticleBySlug(
      'bricktastic-source',
      {
        supabaseClient: createArticlesSupabaseClient([
          createArticleRow({
            frontmatter: {
              date: '2026-05-03',
              description: 'Publieke bronvermelding blijft subtiel.',
              sourceUrl: 'https://www.bricktastic.nl/lego/voorbeeld/',
            },
            mdx: [
              '## Intro',
              '',
              'Dit artikel is gecontroleerd met setinformatie.',
              '',
              'Bron: [www.bricktastic.nl](https://www.bricktastic.nl/lego/voorbeeld/)',
            ].join('\n'),
            slug: 'bricktastic-source',
            title: 'BrickTastic artikel',
          }),
        ]),
      },
    );

    expect(publishedArticle?.bodySource).not.toContain('Bron:');
    expect(publishedArticle?.bodySource).not.toContain('bricktastic.nl');
    expect(publishedArticle?.sourceAttribution).toMatchObject({
      label: 'Bronnen: officiële setinformatie en openbare berichtgeving.',
      signalSourceName: 'BrickTastic',
      tone: 'subtle',
    });
  });

  test('sorts Supabase articles by article date instead of publish timestamp', async () => {
    const supabaseClient = createArticlesSupabaseClient([
      createArticleRow({
        created_at: '2026-05-03T11:00:00.000Z',
        frontmatter: {
          date: '2026-04-15',
          description: 'Eerder gepubliceerd, maar ouder nieuws.',
        },
        slug: 'april-nieuws',
        title: 'April nieuws',
      }),
      createArticleRow({
        created_at: '2026-05-02T09:00:00.000Z',
        frontmatter: {
          date: '2026-05-01',
          description: 'Historisch artikel met latere artikeldatum.',
        },
        published_at: '2026-05-04T09:00:00.000Z',
        slug: 'mei-nieuws',
        title: 'Mei nieuws',
      }),
    ]);
    const result = await listPublishedArticles({
      limit: 1,
      supabaseClient,
    });

    expect(result.map((article) => article.slug)).toEqual(['mei-nieuws']);
    expect(result[0]?.date).toBe('2026-05-01');
    expect(supabaseClient.calls).toEqual(
      expect.arrayContaining([
        ['eq', 'status', 'published'],
        ['order', 'frontmatter->>date', { ascending: false }],
        ['order', 'published_at', { ascending: false }],
        ['range', 0, 0],
      ]),
    );
  });

  test('filters themed article lists in Supabase before parsing rows', async () => {
    const supabaseClient = createArticlesSupabaseClient([
      createArticleRow({
        frontmatter: {
          date: '2026-05-03',
          description: 'Star Wars nieuws.',
          theme: 'Star Wars',
        },
        slug: 'star-wars-nieuws',
        title: 'Star Wars nieuws',
      }),
      createArticleRow({
        frontmatter: {
          date: '2026-05-02',
          description: 'Technic nieuws.',
          theme: 'Technic',
        },
        slug: 'technic-nieuws',
        title: 'Technic nieuws',
      }),
    ]);

    const result = await listPublishedArticles({
      limit: 4,
      supabaseClient,
      themeQuery: 'star-wars',
    });

    expect(result.map((article) => article.slug)).toEqual(['star-wars-nieuws']);
    expect(supabaseClient.calls).toContainEqual([
      'ilike',
      'frontmatter->>theme',
      '%star wars%',
    ]);
    expect(supabaseClient.calls).toContainEqual(['range', 0, 3]);
  });

  test('queries primary-set article candidates in Supabase before exact matching', async () => {
    const supabaseClient = createArticlesSupabaseClient([
      createArticleRow({
        frontmatter: {
          date: '2026-05-04',
          description: 'Deze hoort bij de Spiny Shell.',
        },
        mdx: '<FeaturedSet setNumber="40787" />',
        slug: 'spiny-shell-update',
        title: 'Spiny Shell update',
      }),
      createArticleRow({
        frontmatter: {
          date: '2026-05-03',
          description: 'Zelfde thema, andere set.',
        },
        mdx: '<FeaturedSet setNumber="72037" />',
        slug: 'mario-kart-andere-set',
        title: 'Andere Mario Kart set',
      }),
    ]);
    const result = await listPublishedArticlesByPrimarySetNumber({
      limit: 1,
      setNumber: '40787-1',
      supabaseClient,
    });

    expect(result.map((article) => article.slug)).toEqual([
      'spiny-shell-update',
    ]);
    expect(supabaseClient.calls).toContainEqual([
      'or',
      'mdx.ilike.%40787%,mdx.ilike.%40787-1%',
    ]);
    expect(supabaseClient.calls).toContainEqual(['range', 0, 23]);
  });

  test('prefers non-empty DB frontmatter heroImage over empty MDX frontmatter', async () => {
    const article = await getPublishedArticleBySlug('spiny-shell', {
      supabaseClient: createArticlesSupabaseClient([
        createArticleRow({
          frontmatter: {
            date: '2026-05-01',
            description: 'Handmatig verrijkt artikel.',
            heroImage: uploadedHeroImage,
            heroImageAlt: 'Geuploade Spiny Shell hero',
            theme: 'Super Mario',
          },
          mdx: [
            '---',
            'title: "Spiny Shell terug"',
            'heroImage: ""',
            'heroImageAlt: "Draft hero"',
            '---',
            '',
            '<FeaturedSet setNumber="40787" />',
          ].join('\n'),
          slug: 'spiny-shell',
          title: 'Spiny Shell terug',
        }),
      ]),
    });

    expect(article).toMatchObject({
      cardImage: uploadedHeroImage,
      cardImageAlt: 'Geuploade Spiny Shell hero',
      cardImageSource: 'manual',
      heroImage: uploadedHeroImage,
      heroImageAlt: 'Geuploade Spiny Shell hero',
      heroImageSource: 'manual',
      primarySetNumber: '40787',
      slug: 'spiny-shell',
    });
  });

  test('loads non-expired article previews from Supabase', async () => {
    const supabaseClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: {
                created_at: '2026-05-03T10:00:00.000Z',
                expires_at: '2026-05-04T10:00:00.000Z',
                frontmatter: {
                  date: '2026-05-03',
                  description: 'Preview beschrijving.',
                  heroImage: 'https://storage.example/hero.webp',
                  heroImageAlt: 'Preview hero',
                  theme: 'Star Wars',
                  title: 'Preview artikel',
                },
                id: '00000000-0000-4000-8000-000000000001',
                mdx: '---\nheroImage: ""\n---\n\n## Preview\n\n<FeaturedSet setNumber="75461" />',
              },
              error: null,
            })),
          })),
        })),
      })),
    };

    await expect(
      getArticlePreviewById({
        now: new Date('2026-05-03T11:00:00.000Z'),
        previewId: '00000000-0000-4000-8000-000000000001',
        supabaseClient,
      }),
    ).resolves.toMatchObject({
      bodySource: '## Preview\n\n<FeaturedSet setNumber="75461" />',
      heroImage: 'https://storage.example/hero.webp',
      heroImageAlt: 'Preview hero',
      heroImageSource: 'manual',
      primarySetNumber: '75461',
      slug: 'preview-00000000-0000-4000-8000-000000000001',
      status: 'draft',
      theme: 'Star Wars',
      title: 'Preview artikel',
      updatedAt: undefined,
    });
  });

  test('returns null for expired article previews', async () => {
    const supabaseClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: {
                created_at: '2026-05-03T10:00:00.000Z',
                expires_at: '2026-05-03T10:30:00.000Z',
                frontmatter: {
                  title: 'Preview artikel',
                },
                id: '00000000-0000-4000-8000-000000000001',
                mdx: '## Preview\n\nCopy.',
              },
              error: null,
            })),
          })),
        })),
      })),
    };

    await expect(
      getArticlePreviewById({
        now: new Date('2026-05-03T11:00:00.000Z'),
        previewId: '00000000-0000-4000-8000-000000000001',
        supabaseClient,
      }),
    ).resolves.toBeNull();
  });

  test('stores article click events server-side', async () => {
    const insert = vi.fn(async () => ({
      data: null,
      error: null,
    }));
    const supabaseClient = {
      from: vi.fn(() => ({
        insert,
      })),
    };

    await logArticleClickEvent({
      slug: 'star-wars-day-2026',
      supabaseClient,
    });

    expect(supabaseClient.from).toHaveBeenCalledWith('article_events');
    expect(insert).toHaveBeenCalledWith({
      event_name: 'article_click',
      slug: 'star-wars-day-2026',
    });
  });

  test('returns popular articles sorted by weekly click count', async () => {
    const supabaseClient = {
      from: vi.fn((tableName: string) => {
        if (tableName === 'article_events') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                gte: vi.fn(async () => ({
                  data: [
                    { slug: 'middle-update' },
                    { slug: 'popular-update' },
                    { slug: 'popular-update' },
                    { slug: 'popular-update' },
                    { slug: 'middle-update' },
                    { slug: 'draft-update' },
                  ],
                  error: null,
                })),
              })),
            })),
          };
        }

        return createArticlesSupabaseClient([
          createArticleRow({
            frontmatter: {
              date: '2026-05-02',
              description: 'Populair artikel.',
              theme: 'Star Wars',
            },
            mdx: '---\ntitle: "Populair"\n---\n\n<FeaturedSet setNumber="40787" />',
            slug: 'popular-update',
            title: 'Populair',
          }),
          createArticleRow({
            frontmatter: {
              date: '2026-05-01',
              description: 'Ook gelezen.',
              theme: 'Marvel',
            },
            slug: 'middle-update',
            title: 'Midden',
          }),
        ]).from(tableName);
      }),
    };

    const result = await getPopularArticles({
      days: 7,
      limit: 6,
      supabaseClient,
    });

    expect(result.map((article) => article.slug)).toEqual([
      'popular-update',
      'middle-update',
    ]);
    expect(result[0]).toMatchObject({
      description: 'Populair artikel.',
      primarySetNumber: '40787',
      slug: 'popular-update',
      theme: 'Star Wars',
      title: 'Populair',
    });
  });

  test('does not return articles without events in popular articles', async () => {
    const supabaseClient = {
      from: vi.fn((tableName: string) => {
        if (tableName === 'article_events') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                gte: vi.fn(async () => ({
                  data: [{ slug: 'popular-update' }],
                  error: null,
                })),
              })),
            })),
          };
        }

        return createArticlesSupabaseClient([
          createArticleRow({
            frontmatter: {
              date: '2026-05-02',
              description: 'Populair artikel.',
            },
            slug: 'popular-update',
            title: 'Populair',
          }),
          createArticleRow({
            frontmatter: {
              date: '2026-05-01',
              description: 'Geen event.',
            },
            slug: 'quiet-update',
            title: 'Stil',
          }),
        ]).from(tableName);
      }),
    };

    await expect(
      getPopularArticles({
        supabaseClient,
      }),
    ).resolves.toHaveLength(1);
  });
});
