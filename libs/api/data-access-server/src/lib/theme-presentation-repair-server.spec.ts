import { describe, expect, test, vi } from 'vitest';
import { repairThemePresentationFromStaging } from './theme-presentation-repair-server';

function createSelectBuilder(rows: readonly Record<string, unknown>[]) {
  let rangeStart = 0;
  let rangeEnd = 999;
  const builder = {
    order: vi.fn(() => builder),
    range: vi.fn((from: number, to: number) => {
      rangeStart = from;
      rangeEnd = to;

      return builder;
    }),
    select: vi.fn(() => builder),
    then<TResult1 = { data: Record<string, unknown>[]; error: null }>(
      onFulfilled?:
        | ((value: {
            data: Record<string, unknown>[];
            error: null;
          }) => TResult1 | PromiseLike<TResult1>)
        | null,
      onRejected?: ((reason: unknown) => PromiseLike<never>) | null,
    ) {
      return Promise.resolve({
        data: rows.slice(rangeStart, rangeEnd + 1),
        error: null,
      }).then(onFulfilled, onRejected ?? undefined);
    },
  };

  return builder;
}

function createThemePresentationClient(
  rows: readonly Record<string, unknown>[],
) {
  const updates: { id: string; payload: Record<string, unknown> }[] = [];
  const from = vi.fn(() => ({
    select: vi.fn(() => createSelectBuilder(rows)),
    update: vi.fn((payload: Record<string, unknown>) => ({
      eq: vi.fn((column: string, id: string) => {
        if (column === 'id') {
          updates.push({
            id,
            payload,
          });
        }

        return Promise.resolve({
          error: null,
        });
      }),
    })),
  }));

  return {
    from,
    updates,
  };
}

const baseTheme = {
  display_name: 'Marvel',
  id: 'marvel',
  is_public: true,
  public_accent_color: null,
  public_display_name: null,
  public_hero_text_color: null,
  public_image_url: null,
  public_logo_url: null,
  public_surface_color: null,
  public_surface_text_color: null,
  slug: 'marvel',
  status: 'active',
};

describe('theme presentation repair server', () => {
  test('dry-run reports blank production fields without writing', async () => {
    const stagingClient = createThemePresentationClient([
      {
        ...baseTheme,
        public_display_name: 'Marvel',
        public_image_url: 'https://cdn.example.com/marvel.jpg',
        public_logo_url: '/themes/logos/marvel_logo.png',
      },
    ]);
    const productionClient = createThemePresentationClient([
      {
        ...baseTheme,
        public_logo_url: '/themes/logos/existing_logo.png',
      },
    ]);

    const result = await repairThemePresentationFromStaging({
      dependencies: {
        createProductionSupabaseClient: () => productionClient,
        createStagingSupabaseClient: () => stagingClient,
        productionSupabaseUrl: 'https://production.supabase.co',
        stagingSupabaseUrl: 'https://staging.supabase.co',
      },
      options: {
        dryRun: true,
      },
    });

    expect(result.dryRun).toBe(true);
    expect(result.write).toBe(false);
    expect(result.themesBackfilled).toEqual([
      {
        displayName: 'Marvel',
        fields: [
          {
            field: 'public_display_name',
            productionBefore: null,
            stagingValue: 'Marvel',
          },
          {
            field: 'public_image_url',
            productionBefore: null,
            stagingValue: 'https://cdn.example.com/marvel.jpg',
          },
        ],
        id: 'marvel',
        matchedBy: 'id',
        slug: 'marvel',
      },
    ]);
    expect(productionClient.updates).toEqual([]);
  });

  test('write only backfills blank production fields and revalidates affected themes', async () => {
    const stagingClient = createThemePresentationClient([
      {
        ...baseTheme,
        public_display_name: 'Marvel',
        public_image_url: 'https://cdn.example.com/marvel.jpg',
        public_logo_url: '/themes/logos/marvel_logo.png',
      },
    ]);
    const productionClient = createThemePresentationClient([
      {
        ...baseTheme,
        public_logo_url: '/themes/logos/existing_logo.png',
      },
    ]);
    const revalidatePublicWebFn = vi.fn(async () => ({
      attempted: true,
      pathCount: 2,
      paths: ['/themes', '/themes/marvel'],
      skipped: false,
      tagCount: 2,
      tags: ['themes', 'theme:marvel'],
    }));

    const result = await repairThemePresentationFromStaging({
      dependencies: {
        createProductionSupabaseClient: () => productionClient,
        createStagingSupabaseClient: () => stagingClient,
        productionSupabaseUrl: 'https://production.supabase.co',
        revalidatePublicWebFn,
        stagingSupabaseUrl: 'https://staging.supabase.co',
      },
      options: {
        write: true,
      },
    });

    expect(result.write).toBe(true);
    expect(productionClient.updates).toEqual([
      {
        id: 'marvel',
        payload: {
          public_display_name: 'Marvel',
          public_image_url: 'https://cdn.example.com/marvel.jpg',
        },
      },
    ]);
    expect(revalidatePublicWebFn).toHaveBeenCalledWith({
      paths: ['/themes', '/themes/marvel'],
      reason: 'theme_presentation_repair',
      tags: ['themes', 'theme:marvel'],
    });
  });

  test('refuses to compare identical Supabase targets', async () => {
    const stagingClient = createThemePresentationClient([]);
    const productionClient = createThemePresentationClient([]);

    await expect(
      repairThemePresentationFromStaging({
        dependencies: {
          createProductionSupabaseClient: () => productionClient,
          createStagingSupabaseClient: () => stagingClient,
          productionSupabaseUrl: 'https://same.supabase.co',
          stagingSupabaseUrl: 'https://same.supabase.co/',
        },
      }),
    ).rejects.toThrow('refusing to repair identical Supabase targets');
  });
});
