import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import { publishContentArticle } from './article-publish';

function createPublishInput(slug = 'lego-star-wars-set') {
  return {
    frontmatter: {
      date: '2026-05-02',
      description: 'Waarom deze doos nu telt.',
      slug,
      title: 'LEGO Star Wars set',
    },
    mdx: '---\ntitle: "LEGO Star Wars set"\n---\n\n## Wanneer kopen?\n',
  };
}

function createSupabaseClientMock(existingSlugs: readonly string[] = []) {
  const slugs = [...existingSlugs];
  const insertedRows: Array<Record<string, unknown>> = [];
  const from = vi.fn(() => ({
    insert: vi.fn((payload: Record<string, unknown> & { slug: string }) => {
      insertedRows.push(payload);

      return {
        select: vi.fn(() => ({
          single: vi.fn(async () => {
            if (slugs.includes(payload.slug)) {
              return {
                data: null,
                error: {
                  code: '23505',
                  message: 'duplicate key value violates unique constraint',
                },
              };
            }

            slugs.push(payload.slug);

            return {
              data: {
                slug: payload.slug,
              },
              error: null,
            };
          }),
        })),
      };
    }),
    select: vi.fn(() => ({
      like: vi.fn(async () => ({
        data: slugs.map((slug) => ({
          slug,
        })),
        error: null,
      })),
    })),
  }));

  return {
    from,
    insertedRows,
    slugs,
  };
}

function toPublishSupabaseClient(
  supabaseClient: ReturnType<typeof createSupabaseClientMock>,
) {
  return supabaseClient as unknown as NonNullable<
    Parameters<typeof publishContentArticle>[0]['supabaseClient']
  >;
}

describe('content article publishing', () => {
  test('uses the base slug for the first insert', async () => {
    const supabaseClient = createSupabaseClientMock();

    await expect(
      publishContentArticle({
        input: createPublishInput(),
        supabaseClient: toPublishSupabaseClient(supabaseClient),
      }),
    ).resolves.toEqual({
      slug: 'lego-star-wars-set',
    });
  });

  test('blocks Bugatti fallback drafts with publication-unsafe copy', async () => {
    const supabaseClient = createSupabaseClientMock();

    await expect(
      publishContentArticle({
        input: {
          frontmatter: {
            date: '2026-05-03',
            description:
              'Conceptdraft op basis van extraction en exacte catalog matches.',
            slug: 'lego-bugatti-tourbillon',
            title: 'LEGO Technic Bugatti Tourbillon',
          },
          mdx: [
            '---',
            'title: "LEGO Technic Bugatti Tourbillon"',
            '---',
            '',
            'Conceptdraft.',
            '',
            'Controleer de bron, want nog niet alles hangt strak genoeg.',
            'Gebruik deze draft niet als af verhaal.',
          ].join('\n'),
        },
        supabaseClient: toPublishSupabaseClient(supabaseClient),
      }),
    ).rejects.toThrow('Dit artikel is nog niet klaar voor publicatie.');

    expect(supabaseClient.insertedRows).toHaveLength(0);
  });

  test('appends -2 for a duplicate base slug', async () => {
    const supabaseClient = createSupabaseClientMock(['lego-star-wars-set']);

    await expect(
      publishContentArticle({
        input: createPublishInput(),
        supabaseClient: toPublishSupabaseClient(supabaseClient),
      }),
    ).resolves.toEqual({
      slug: 'lego-star-wars-set-2',
    });
  });

  test('skips gaps and appends the next highest suffix', async () => {
    const supabaseClient = createSupabaseClientMock([
      'lego-star-wars-set',
      'lego-star-wars-set-2',
      'lego-star-wars-set-4',
      'lego-star-wars-set-extra',
    ]);

    await expect(
      publishContentArticle({
        input: createPublishInput(),
        supabaseClient: toPublishSupabaseClient(supabaseClient),
      }),
    ).resolves.toEqual({
      slug: 'lego-star-wars-set-5',
    });
  });

  test('keeps historical article date while storing the real publish timestamp', async () => {
    const supabaseClient = createSupabaseClientMock();
    const beforePublish = Date.now();

    await publishContentArticle({
      input: createPublishInput('mei-2026-nieuws'),
      supabaseClient: toPublishSupabaseClient(supabaseClient),
    });

    const afterPublish = Date.now();
    const insertedRow = supabaseClient.insertedRows[0];
    const frontmatter = insertedRow?.['frontmatter'] as
      | Record<string, unknown>
      | undefined;
    const publishedAt = Date.parse(String(insertedRow?.['published_at']));

    expect(frontmatter?.['date']).toBe('2026-05-02');
    expect(publishedAt).toBeGreaterThanOrEqual(beforePublish - 1000);
    expect(publishedAt).toBeLessThanOrEqual(afterPublish + 1000);
  });
});

describe('content articles Supabase policy', () => {
  test('allows inserts only for service role while keeping public read scoped to published articles', async () => {
    const workspaceRoot = process
      .cwd()
      .endsWith(path.join('libs', 'content', 'data-access-server'))
      ? path.resolve(process.cwd(), '..', '..', '..')
      : process.cwd();
    const migration = await readFile(
      path.join(
        workspaceRoot,
        'supabase',
        'migrations',
        '20260502120000_content_articles.sql',
      ),
      'utf8',
    );

    expect(migration).toContain(
      'alter table public.articles enable row level security',
    );
    expect(migration).toContain('for select');
    expect(migration).toContain("using (status = 'published')");
    expect(migration).toContain('for insert');
    expect(migration).toContain("with check (auth.role() = 'service_role')");
    expect(migration).not.toContain('with check (true)');
    expect(migration).toContain(
      'published_at timestamptz not null default now()',
    );
    expect(migration).toContain("((frontmatter ->> 'date')) desc");
  });
});
