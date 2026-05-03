import Fastify from 'fastify';
import type {
  CatalogExternalSetSearchResult,
  CatalogSetSummary,
} from '@lego-platform/catalog/util';
import type {
  EditorialAgentDraftGenerationResult,
  EditorialFeedItem,
  EditorialAgentFactExtractionResult,
} from '@lego-platform/content/util';
import { ContentArticleDuplicateSourceError } from '@lego-platform/content/data-access-server';
import { describe, expect, test, vi } from 'vitest';
import {
  createAdminEditorialAgentService,
  createAdminEditorialAgentRoutes,
  type AdminEditorialAgentService,
} from '../app/routes/admin-editorial-agent';

function createExtractionResult(): EditorialAgentFactExtractionResult {
  return {
    detected: {
      dateSignals: [],
      keywords: ['Mario Kart', 'Spiny Shell'],
      prices: ['€9,99'],
      rumorSignals: [],
      setNumbers: ['40787'],
      themes: ['Mario Kart', 'Super Mario'],
    },
    extractedText:
      'De Spiny Shell is opnieuw beschikbaar als reward voor LEGO Insiders.',
    extractedTextPreview:
      'De Spiny Shell is opnieuw beschikbaar als reward voor LEGO Insiders.',
    event: {
      exists: false,
      fingerprint: {
        key: '40787',
        type: 'gwp_reward',
      },
    },
    facts: {
      isRumor: false,
      keyPoints: [],
      keywords: ['Mario Kart', 'Spiny Shell'],
      priceEUR: '€9,99',
      releaseDate: '',
      setNames: ['Mario Kart – Spiny Shell'],
      setNumbers: ['40787'],
      summary:
        'De Spiny Shell is opnieuw beschikbaar als reward voor LEGO Insiders.',
      theme: 'Super Mario',
      title: 'LEGO 40787 Mario Kart – Spiny Shell is terug',
      uncertainClaims: [],
    },
    matching: {
      articleType: 'gwp_reward',
      matchedSets: [
        {
          id: '40787',
          name: 'Mario Kart – Spiny Shell',
          setNumber: '40787',
          slug: 'mario-kart-spiny-shell-40787',
          theme: 'Super Mario',
        },
      ],
      unmatchedSetNumbers: [],
    },
    primarySet: {
      id: '40787',
      name: 'Mario Kart – Spiny Shell',
      reason: 'single_set',
      setNumber: '40787',
      slug: 'mario-kart-spiny-shell-40787',
      theme: 'Super Mario',
    },
    relatedCandidates: [],
    source: {
      byline: '',
      canonicalUrl: 'https://example.com/spiny-shell',
      description: 'Korte samenvatting.',
      domain: 'example.com',
      extractedAt: '2026-05-01T08:00:00.000Z',
      finalUrl: 'https://example.com/spiny-shell',
      inputUrl: 'https://example.com/spiny-shell',
      language: 'nl',
      siteName: 'Brick Example',
      textLength: 740,
      title: 'LEGO 40787 Mario Kart – Spiny Shell is terug',
    },
    warnings: [],
  };
}

function createDraftResult(): EditorialAgentDraftGenerationResult {
  return {
    catalogImport: {
      attempted: true,
      attemptedSetNumbers: ['40787'],
      enabled: true,
      importedSets: [
        {
          id: '40787',
          name: 'Mario Kart – Spiny Shell',
          setNumber: '40787',
          slug: 'mario-kart-spiny-shell-40787',
          theme: 'Super Mario',
        },
      ],
      stillMissingSetNumbers: [],
      warnings: [],
    },
    deterministicDraft: {
      frontmatter: {
        date: '2026-05-01',
        description: 'Korte description.',
        heroImage: '',
        heroImageAlt: 'LEGO Mario Kart – Spiny Shell setbeeld',
        slug: 'lego-40787-mario-kart-spiny-shell-is-terug',
        sourceUrl: 'https://example.com/spiny-shell',
        status: 'draft',
        theme: 'Super Mario',
        title: 'LEGO 40787 Mario Kart – Spiny Shell is terug',
      },
      mdx: '---\ntitle: "LEGO 40787 Mario Kart – Spiny Shell is terug"\n---\n\n## Wanneer kopen?\n',
      primarySet: {
        name: 'Mario Kart – Spiny Shell',
        reason: 'Sterke primary match.',
        setNumber: '40787',
      },
      relatedSets: [],
      warnings: [],
    },
    effectiveExtraction: createExtractionResult(),
    output: {
      frontmatter: {
        date: '2026-05-01',
        description: 'Korte description.',
        heroImage: '',
        heroImageAlt: 'LEGO Mario Kart – Spiny Shell setbeeld',
        slug: 'lego-40787-mario-kart-spiny-shell-is-terug',
        sourceUrl: 'https://example.com/spiny-shell',
        status: 'draft',
        theme: 'Super Mario',
        title: 'LEGO 40787 Mario Kart – Spiny Shell is terug',
      },
      mdx: '---\ntitle: "LEGO 40787 Mario Kart – Spiny Shell is terug"\n---\n\n## Wanneer kopen?\n\nPak hem als je de punten al hebt.\n',
      primarySet: {
        name: 'Mario Kart – Spiny Shell',
        reason: 'Sterke primary match.',
        setNumber: '40787',
      },
      relatedSets: [],
      warnings: [],
    },
    rewrite: {
      applied: true,
      enabled: true,
      warnings: [],
    },
    rewrittenDraft: {
      frontmatter: {
        date: '2026-05-01',
        description: 'Korte description.',
        heroImage: '',
        heroImageAlt: 'LEGO Mario Kart – Spiny Shell setbeeld',
        slug: 'lego-40787-mario-kart-spiny-shell-is-terug',
        sourceUrl: 'https://example.com/spiny-shell',
        status: 'draft',
        theme: 'Super Mario',
        title: 'LEGO 40787 Mario Kart – Spiny Shell is terug',
      },
      mdx: '---\ntitle: "LEGO 40787 Mario Kart – Spiny Shell is terug"\n---\n\n## Wanneer kopen?\n\nPak hem als je de punten al hebt.\n',
      primarySet: {
        name: 'Mario Kart – Spiny Shell',
        reason: 'Sterke primary match.',
        setNumber: '40787',
      },
      relatedSets: [],
      warnings: [],
    },
  };
}

function createFeedItem(
  overrides: Partial<EditorialFeedItem> = {},
): EditorialFeedItem {
  return {
    createdAt: '2026-05-03T10:00:00.000Z',
    eventFingerprint: 'example.com:lego-40787-mario-kart-spiny-shell-is-terug',
    feedName: 'Brick Example',
    id: 'feed-item-1',
    sourcePublishedAt: '2026-05-01T08:00:00.000Z',
    sourceUrl: 'https://example.com/spiny-shell',
    status: 'new',
    title: 'LEGO 40787 Mario Kart – Spiny Shell is terug',
    updatedAt: '2026-05-03T10:00:00.000Z',
    ...overrides,
  };
}

function createMarvelHerbieExtractionResult(): EditorialAgentFactExtractionResult {
  return {
    detected: {
      dateSignals: [],
      keywords: ['Marvel', 'Fantastic Four', 'H.E.R.B.I.E.'],
      prices: [],
      rumorSignals: [],
      setNumbers: ['76339'],
      themes: ['Marvel'],
    },
    extractedText:
      'LEGO Marvel 76339 The Fantastic Four H.E.R.B.I.E. is onthuld met een bouwbare robot uit Fantastic Four.',
    extractedTextPreview:
      'LEGO Marvel 76339 The Fantastic Four H.E.R.B.I.E. is onthuld met een bouwbare robot uit Fantastic Four.',
    event: {
      exists: false,
      fingerprint: {
        key: '76339',
        type: 'single_set_news',
      },
    },
    facts: {
      isRumor: false,
      keyPoints: [
        'De set draait om H.E.R.B.I.E. uit Fantastic Four.',
        'Het gaat om een enkele LEGO Marvel-set.',
      ],
      keywords: ['Marvel', 'Fantastic Four', 'H.E.R.B.I.E.'],
      priceEUR: '',
      releaseDate: '',
      setNames: ['The Fantastic Four H.E.R.B.I.E.'],
      setNumbers: ['76339'],
      summary: 'LEGO Marvel 76339 The Fantastic Four H.E.R.B.I.E. is onthuld.',
      theme: 'Marvel',
      title:
        'LEGO Marvel 76339 The Fantastic Four H.E.R.B.I.E. onthuld: alles wat je moet weten',
      uncertainClaims: [],
    },
    matching: {
      articleType: 'single_set_news',
      matchedSets: [],
      unmatchedSetNumbers: ['76339'],
    },
    primarySet: null,
    relatedCandidates: [],
    source: {
      byline: '',
      canonicalUrl: 'https://example.com/lego-marvel-76339-herbie',
      description: 'Alles over de nieuwe LEGO Marvel H.E.R.B.I.E.-set.',
      domain: 'example.com',
      extractedAt: '2026-05-01T08:00:00.000Z',
      finalUrl: 'https://example.com/lego-marvel-76339-herbie',
      inputUrl: 'https://example.com/lego-marvel-76339-herbie',
      language: 'nl',
      siteName: 'Brick Example',
      textLength: 920,
      title:
        'LEGO Marvel 76339 The Fantastic Four H.E.R.B.I.E. onthuld: alles wat je moet weten',
    },
    warnings: [],
  };
}

function createBricktasticMarvelHerbieRoundupRegressionExtractionResult(): EditorialAgentFactExtractionResult {
  const title =
    'LEGO Marvel 76339 The Fantastic Four H.E.R.B.I.E. onthuld: alles wat je moet weten';

  return {
    detected: {
      dateSignals: ['augustus 2026'],
      keywords: ['Marvel', 'Fantastic Four', 'H.E.R.B.I.E.', '76316'],
      prices: [],
      rumorSignals: [],
      setNumbers: ['76339', '76316'],
      themes: ['Marvel'],
    },
    extractedText:
      'LEGO Marvel 76339 The Fantastic Four H.E.R.B.I.E. is onthuld. In de tekst wordt ook kort LEGO Marvel 76316 genoemd als eerdere Marvel-release.',
    extractedTextPreview:
      'LEGO Marvel 76339 The Fantastic Four H.E.R.B.I.E. is onthuld.',
    event: {
      exists: false,
      fingerprint: {
        key: '2026-08',
        type: 'release_roundup',
      },
    },
    facts: {
      isRumor: false,
      keyPoints: [
        'De titel draait om LEGO Marvel 76339.',
        'LEGO Marvel 76316 wordt alleen in de body genoemd.',
      ],
      keywords: ['Marvel', 'Fantastic Four', 'H.E.R.B.I.E.'],
      priceEUR: '',
      releaseDate: 'augustus 2026',
      setNames: ['The Fantastic Four H.E.R.B.I.E.'],
      setNumbers: ['76339', '76316'],
      summary: 'LEGO Marvel 76339 The Fantastic Four H.E.R.B.I.E. is onthuld.',
      theme: 'Marvel',
      title,
      uncertainClaims: [],
    },
    matching: {
      articleType: 'release_roundup',
      matchedSets: [
        {
          id: '76316',
          name: 'Iron Man MK4 Bust',
          setNumber: '76316',
          slug: 'iron-man-mk4-bust-76316',
          theme: 'Marvel',
        },
      ],
      unmatchedSetNumbers: ['76339'],
    },
    primarySet: null,
    relatedCandidates: [
      {
        id: '76316',
        name: 'Iron Man MK4 Bust',
        reason: 'same_article',
        setNumber: '76316',
        slug: 'iron-man-mk4-bust-76316',
        theme: 'Marvel',
      },
    ],
    source: {
      byline: '',
      canonicalUrl:
        'https://www.bricktastic.nl/lego/lego-marvel-76339-the-fantastic-four-h-e-r-b-i-e-onthuld-alles-wat-je-moet-weten/',
      description:
        'LEGO Marvel 76339 The Fantastic Four H.E.R.B.I.E. is onthuld. Ook 76316 komt kort voorbij.',
      domain: 'www.bricktastic.nl',
      extractedAt: '2026-05-01T08:00:00.000Z',
      finalUrl:
        'https://www.bricktastic.nl/lego/lego-marvel-76339-the-fantastic-four-h-e-r-b-i-e-onthuld-alles-wat-je-moet-weten/',
      inputUrl:
        'https://www.bricktastic.nl/lego/lego-marvel-76339-the-fantastic-four-h-e-r-b-i-e-onthuld-alles-wat-je-moet-weten/',
      language: 'nl',
      siteName: 'Bricktastic',
      textLength: 1280,
      title,
    },
    warnings: [],
  };
}

async function createAdminEditorialAgentServer({
  editorialAgentService,
}: {
  editorialAgentService?: AdminEditorialAgentService;
} = {}) {
  const nextEditorialAgentService: AdminEditorialAgentService =
    editorialAgentService ?? {
      extractFacts: vi.fn(async () => createExtractionResult()),
      generateDraft: vi.fn(async () => createDraftResult()),
      generateDraftForFeedItem: vi.fn(async () => ({
        draftResult: createDraftResult(),
        feedItem: createFeedItem({ status: 'drafted' }),
      })),
      ignoreFeedItem: vi.fn(async () =>
        createFeedItem({
          status: 'ignored',
        }),
      ),
      listFeedItems: vi.fn(async () => [createFeedItem()]),
      publishArticle: vi.fn(async () => ({
        slug: 'lego-40787-mario-kart-spiny-shell-is-terug',
      })),
      publishArticleFromFeedItem: vi.fn(async () => ({
        slug: 'lego-40787-mario-kart-spiny-shell-is-terug',
      })),
      syncFeed: vi.fn(async () => ({
        inserted: 1,
        items: [createFeedItem()],
        skipped: 0,
        total: 1,
      })),
    };
  const server = Fastify();

  await server.register(
    createAdminEditorialAgentRoutes({
      editorialAgentService: nextEditorialAgentService,
    }),
  );

  return {
    editorialAgentService: nextEditorialAgentService,
    server,
  };
}

describe('admin editorial agent routes', () => {
  test('extracts facts for a valid public URL', async () => {
    const { editorialAgentService, server } =
      await createAdminEditorialAgentServer();

    const response = await server.inject({
      method: 'POST',
      payload: {
        url: 'https://example.com/spiny-shell',
      },
      url: '/api/v1/admin/editorial-agent/extract',
    });

    expect(response.statusCode).toBe(200);
    expect(editorialAgentService.extractFacts).toHaveBeenCalledWith({
      url: 'https://example.com/spiny-shell',
    });
    expect(response.json()).toEqual(
      expect.objectContaining({
        facts: expect.objectContaining({
          setNumbers: ['40787'],
        }),
      }),
    );

    await server.close();
  });

  test('returns a safe validation error for missing urls', async () => {
    const { server } = await createAdminEditorialAgentServer();

    const response = await server.inject({
      method: 'POST',
      payload: {},
      url: '/api/v1/admin/editorial-agent/extract',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: 'Voer een geldige bron-URL in.',
    });

    await server.close();
  });

  test('generates a draft bundle from a valid extraction payload', async () => {
    const { editorialAgentService, server } =
      await createAdminEditorialAgentServer();

    const response = await server.inject({
      method: 'POST',
      payload: {
        extraction: createExtractionResult(),
        importMissingSets: true,
        useAiRewrite: true,
      },
      url: '/api/v1/admin/editorial-agent/draft',
    });

    expect(response.statusCode).toBe(200);
    expect(editorialAgentService.generateDraft).toHaveBeenCalledWith({
      extraction: createExtractionResult(),
      importMissingSets: true,
      useAiRewrite: true,
    });
    expect(response.json()).toEqual(
      expect.objectContaining({
        catalogImport: expect.objectContaining({
          attempted: true,
        }),
        effectiveExtraction: expect.objectContaining({
          matching: expect.objectContaining({
            articleType: 'gwp_reward',
          }),
        }),
        output: expect.objectContaining({
          mdx: expect.stringContaining('Pak hem als je de punten al hebt.'),
        }),
        rewrite: expect.objectContaining({
          applied: true,
          enabled: true,
        }),
      }),
    );

    await server.close();
  });

  test('publishes generated mdx and returns the public slug', async () => {
    const { editorialAgentService, server } =
      await createAdminEditorialAgentServer();
    const draftResult = createDraftResult();

    const response = await server.inject({
      method: 'POST',
      payload: {
        frontmatter: draftResult.output.frontmatter,
        mdx: draftResult.output.mdx,
      },
      url: '/api/v1/admin/editorial-agent/publish',
    });

    expect(response.statusCode).toBe(200);
    expect(editorialAgentService.publishArticle).toHaveBeenCalledWith({
      frontmatter: draftResult.output.frontmatter,
      mdx: draftResult.output.mdx,
    });
    expect(response.json()).toEqual({
      slug: 'lego-40787-mario-kart-spiny-shell-is-terug',
    });

    await server.close();
  });

  test('blocks Bugatti fallback drafts before publishing', async () => {
    const { editorialAgentService, server } =
      await createAdminEditorialAgentServer();

    const response = await server.inject({
      method: 'POST',
      payload: {
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
      url: '/api/v1/admin/editorial-agent/publish',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: 'Dit artikel is nog niet klaar voor publicatie.',
    });
    expect(editorialAgentService.publishArticle).not.toHaveBeenCalled();

    await server.close();
  });

  test('returns an existing slug when a source article was already published', async () => {
    const duplicateSourceError = new ContentArticleDuplicateSourceError(
      'Dit bronartikel is al gepubliceerd.',
      'bestaand-artikel',
    );
    const publishArticle = vi.fn(async () => {
      throw duplicateSourceError;
    });
    const { server } = await createAdminEditorialAgentServer({
      editorialAgentService: {
        extractFacts: vi.fn(async () => createExtractionResult()),
        generateDraft: vi.fn(async () => createDraftResult()),
        generateDraftForFeedItem: vi.fn(async () => ({
          draftResult: createDraftResult(),
          feedItem: createFeedItem({ status: 'drafted' }),
        })),
        ignoreFeedItem: vi.fn(async () =>
          createFeedItem({ status: 'ignored' }),
        ),
        listFeedItems: vi.fn(async () => [createFeedItem()]),
        publishArticle,
        publishArticleFromFeedItem: vi.fn(async () => ({
          slug: 'lego-40787-mario-kart-spiny-shell-is-terug',
        })),
        syncFeed: vi.fn(async () => ({
          inserted: 1,
          items: [createFeedItem()],
          skipped: 0,
          total: 1,
        })),
      },
    });
    const draftResult = createDraftResult();

    const response = await server.inject({
      method: 'POST',
      payload: {
        frontmatter: draftResult.output.frontmatter,
        mdx: draftResult.output.mdx,
      },
      url: '/api/v1/admin/editorial-agent/publish',
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      message: 'Dit bronartikel is al gepubliceerd.',
      slug: 'bestaand-artikel',
    });

    await server.close();
  });

  test('syncs RSS feed items without generating or publishing drafts', async () => {
    const { editorialAgentService, server } =
      await createAdminEditorialAgentServer();

    const response = await server.inject({
      method: 'POST',
      payload: {
        feedName: 'BrickTastic',
        rssUrl: 'https://www.bricktastic.nl/feed/',
      },
      url: '/api/v1/admin/editorial-agent/feed-sync',
    });

    expect(response.statusCode).toBe(200);
    expect(editorialAgentService.syncFeed).toHaveBeenCalledWith({
      feedName: 'BrickTastic',
      rssUrl: 'https://www.bricktastic.nl/feed/',
    });
    expect(editorialAgentService.generateDraft).not.toHaveBeenCalled();
    expect(editorialAgentService.publishArticle).not.toHaveBeenCalled();
    expect(response.json()).toEqual(
      expect.objectContaining({
        inserted: 1,
        skipped: 0,
      }),
    );

    await server.close();
  });

  test('supports the non-versioned feed sync endpoint for cron triggers', async () => {
    const { editorialAgentService, server } =
      await createAdminEditorialAgentServer();

    const response = await server.inject({
      method: 'POST',
      payload: {},
      url: '/admin/editorial-agent/feed-sync',
    });

    expect(response.statusCode).toBe(200);
    expect(editorialAgentService.syncFeed).toHaveBeenCalledWith({});

    await server.close();
  });

  test('lists new editorial feed items for admin review', async () => {
    const { editorialAgentService, server } =
      await createAdminEditorialAgentServer();

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/editorial-agent/feed-items',
    });

    expect(response.statusCode).toBe(200);
    expect(editorialAgentService.listFeedItems).toHaveBeenCalled();
    expect(response.json()).toEqual([createFeedItem()]);

    await server.close();
  });

  test('generates a draft for a feed item through the existing pipeline', async () => {
    const { editorialAgentService, server } =
      await createAdminEditorialAgentServer();

    const response = await server.inject({
      method: 'POST',
      payload: {
        feedItemId: 'feed-item-1',
        importMissingSets: true,
        useAiRewrite: false,
      },
      url: '/api/v1/admin/editorial-agent/feed-items/draft',
    });

    expect(response.statusCode).toBe(200);
    expect(editorialAgentService.generateDraftForFeedItem).toHaveBeenCalledWith(
      {
        feedItemId: 'feed-item-1',
        importMissingSets: true,
        useAiRewrite: false,
      },
    );
    expect(response.json()).toEqual(
      expect.objectContaining({
        draftResult: expect.objectContaining({
          output: expect.objectContaining({
            mdx: expect.stringContaining('Pak hem als je de punten al hebt.'),
          }),
        }),
        feedItem: expect.objectContaining({
          status: 'drafted',
        }),
      }),
    );

    await server.close();
  });

  test('marks feed items ignored without publishing', async () => {
    const { editorialAgentService, server } =
      await createAdminEditorialAgentServer();

    const response = await server.inject({
      method: 'POST',
      payload: {
        feedItemId: 'feed-item-1',
      },
      url: '/api/v1/admin/editorial-agent/feed-items/ignore',
    });

    expect(response.statusCode).toBe(200);
    expect(editorialAgentService.ignoreFeedItem).toHaveBeenCalledWith({
      feedItemId: 'feed-item-1',
    });
    expect(editorialAgentService.publishArticle).not.toHaveBeenCalled();
    expect(response.json()).toEqual(
      expect.objectContaining({
        status: 'ignored',
      }),
    );

    await server.close();
  });

  test('links published feed items to the generated article slug', async () => {
    const { editorialAgentService, server } =
      await createAdminEditorialAgentServer();
    const draftResult = createDraftResult();

    const response = await server.inject({
      method: 'POST',
      payload: {
        feedItemId: 'feed-item-1',
        frontmatter: draftResult.output.frontmatter,
        mdx: draftResult.output.mdx,
      },
      url: '/api/v1/admin/editorial-agent/publish',
    });

    expect(response.statusCode).toBe(200);
    expect(
      editorialAgentService.publishArticleFromFeedItem,
    ).toHaveBeenCalledWith({
      feedItemId: 'feed-item-1',
      publishInput: {
        frontmatter: draftResult.output.frontmatter,
        mdx: draftResult.output.mdx,
      },
    });
    expect(editorialAgentService.publishArticle).not.toHaveBeenCalled();
    expect(response.json()).toEqual({
      slug: 'lego-40787-mario-kart-spiny-shell-is-terug',
    });

    await server.close();
  });
});

describe('admin editorial agent catalog import', () => {
  test('imports a detected bare set number through the Rebrickable -1 variant and matches it for draft output', async () => {
    const importedSummaries: CatalogSetSummary[] = [];
    const rebrickableHerbieResult: CatalogExternalSetSearchResult = {
      imageUrl: 'https://cdn.rebrickable.com/media/sets/76339-1/154089.jpg',
      name: 'The Fantastic Four H.E.R.B.I.E.',
      pieces: 427,
      releaseYear: 2025,
      setId: '76339',
      slug: 'the-fantastic-four-herbie-76339',
      source: 'rebrickable',
      sourceSetNumber: '76339-1',
      theme: 'Marvel',
    };
    const searchCatalogMissingSets = vi.fn(
      async ({ query }: { query: string }) =>
        query === '76339-1' ? [rebrickableHerbieResult] : [],
    );
    const createCatalogSet = vi.fn(async ({ input }) => {
      importedSummaries.push({
        id: input.sourceSetNumber,
        name: input.name,
        pieces: input.pieces,
        releaseYear: input.releaseYear,
        slug: input.slug,
        theme: input.theme,
      });

      return {
        ...input,
        createdAt: '2026-05-01T08:00:00.000Z',
      };
    });
    const service = createAdminEditorialAgentService({
      createCatalogSet,
      hasRebrickableApiConfig: () => true,
      hasServerSupabaseConfig: () => true,
      listCatalogSetSummariesWithOverlay: vi.fn(async () => importedSummaries),
      searchCatalogMissingSets,
    });

    const result = await service.generateDraft({
      extraction: createMarvelHerbieExtractionResult(),
      importMissingSets: true,
      useAiRewrite: false,
    });

    expect(searchCatalogMissingSets).toHaveBeenNthCalledWith(1, {
      query: '76339',
    });
    expect(searchCatalogMissingSets).toHaveBeenNthCalledWith(2, {
      query: '76339-1',
    });
    expect(createCatalogSet).toHaveBeenCalledWith({
      input: rebrickableHerbieResult,
    });
    expect(result.catalogImport.importedSets).toEqual([
      expect.objectContaining({
        setNumber: '76339',
        theme: 'Marvel',
      }),
    ]);
    expect(result.effectiveExtraction.matching.articleType).toBe(
      'single_set_news',
    );
    expect(result.effectiveExtraction.primarySet).toEqual(
      expect.objectContaining({
        setNumber: '76339',
        theme: 'Marvel',
      }),
    );
    expect(result.output.frontmatter.theme).toBe('Marvel');
    expect(result.output.mdx).toContain('<FeaturedSet setNumber="76339" />');
    expect(result.output.mdx).not.toContain('<SetSpotlightList');
    expect(result.output.mdx).not.toContain('Multiple');
    expect(result.output.mdx).not.toContain(
      'Overzicht van de LEGO-sets uit augustus',
    );
  });

  test('rebuilds the Bricktastic Marvel 76339 analysis after targeted import before drafting', async () => {
    const initialExtraction =
      createBricktasticMarvelHerbieRoundupRegressionExtractionResult();
    const importedSummaries: CatalogSetSummary[] = [
      {
        id: '76316',
        name: 'Iron Man MK4 Bust',
        pieces: 436,
        releaseYear: 2025,
        slug: 'iron-man-mk4-bust-76316',
        theme: 'Marvel',
      },
    ];
    const rebrickableHerbieResult: CatalogExternalSetSearchResult = {
      imageUrl: 'https://cdn.rebrickable.com/media/sets/76339-1/154089.jpg',
      name: 'The Fantastic Four H.E.R.B.I.E.',
      pieces: 427,
      releaseYear: 2026,
      setId: '76339',
      slug: 'the-fantastic-four-herbie-76339',
      source: 'rebrickable',
      sourceSetNumber: '76339-1',
      theme: 'Marvel',
    };
    const searchCatalogMissingSets = vi.fn(
      async ({ query }: { query: string }) =>
        query === '76339-1' ? [rebrickableHerbieResult] : [],
    );
    const createCatalogSet = vi.fn(async ({ input }) => {
      importedSummaries.push({
        id: input.sourceSetNumber,
        name: input.name,
        pieces: input.pieces,
        releaseYear: input.releaseYear,
        slug: input.slug,
        theme: input.theme,
      });

      return {
        ...input,
        createdAt: '2026-05-01T08:00:00.000Z',
      };
    });
    const service = createAdminEditorialAgentService({
      createCatalogSet,
      hasRebrickableApiConfig: () => true,
      hasServerSupabaseConfig: () => true,
      listCatalogSetSummariesWithOverlay: vi.fn(async () => importedSummaries),
      searchCatalogMissingSets,
    });

    expect(initialExtraction.detected.setNumbers).toContain('76339');
    expect(initialExtraction.detected.setNumbers).toContain('76316');
    expect(initialExtraction.matching.articleType).toBe('release_roundup');

    const result = await service.generateDraft({
      extraction: initialExtraction,
      importMissingSets: true,
      useAiRewrite: false,
    });

    expect(result.catalogImport.attemptedSetNumbers).toEqual(['76339']);
    expect(searchCatalogMissingSets).toHaveBeenNthCalledWith(1, {
      query: '76339',
    });
    expect(searchCatalogMissingSets).toHaveBeenNthCalledWith(2, {
      query: '76339-1',
    });
    expect(result.catalogImport.importedSets).toEqual([
      expect.objectContaining({
        setNumber: '76339',
        theme: 'Marvel',
      }),
    ]);
    expect(result.effectiveExtraction.matching.matchedSets).toEqual([
      expect.objectContaining({
        setNumber: '76339',
      }),
      expect.objectContaining({
        setNumber: '76316',
      }),
    ]);
    expect(result.effectiveExtraction.matching.articleType).toBe(
      'single_set_news',
    );
    expect(result.effectiveExtraction.primarySet).toEqual(
      expect.objectContaining({
        setNumber: '76339',
        theme: 'Marvel',
      }),
    );
    expect(result.output.frontmatter.theme).toBe('Marvel');
    expect(result.output.primarySet).toEqual(
      expect.objectContaining({
        setNumber: '76339',
      }),
    );
    expect(result.output.mdx).toContain('<FeaturedSet setNumber="76339" />');
    expect(result.output.mdx).not.toContain('<SetSpotlightList');
    expect(result.output.mdx).not.toContain(
      'Augustus 2026 wordt zo\u2019n maand',
    );
  });

  test('rebuilds stale Ideas multi-set analysis before drafting', async () => {
    const staleExtraction: EditorialAgentFactExtractionResult = {
      ...createExtractionResult(),
      detected: {
        dateSignals: [],
        keywords: ['Ideas'],
        prices: [],
        rumorSignals: [],
        setNumbers: ['21330', '99991', '99992'],
        themes: ['Ideas'],
      },
      facts: {
        ...createExtractionResult().facts,
        keywords: ['Ideas'],
        priceEUR: '',
        releaseDate: '',
        setNames: ['Home Alone'],
        setNumbers: ['21330', '99991', '99992'],
        summary:
          'LEGO Ideas heeft meerdere projecten goedgekeurd. Home Alone wordt alleen als eerdere Ideas-set genoemd.',
        theme: 'Ideas',
        title: 'Deze LEGO Ideas-projecten worden als set uitgebracht',
      },
      matching: {
        articleType: 'multi_set_announcement',
        matchedSets: [
          {
            id: '21330',
            name: 'Home Alone',
            setNumber: '21330',
            slug: 'home-alone-21330',
            theme: 'Ideas',
          },
        ],
        unmatchedSetNumbers: [],
      },
      primarySet: {
        id: '21330',
        name: 'Home Alone',
        reason: 'first_detected',
        setNumber: '21330',
        slug: 'home-alone-21330',
        theme: 'Ideas',
      },
      relatedCandidates: [],
      source: {
        ...createExtractionResult().source,
        description:
          'Home Alone wordt genoemd als voorbeeld van een eerder verschenen LEGO Ideas-set.',
        finalUrl:
          'https://www.bricktastic.nl/lego/deze-lego-ideas-projecten-worden-als-set-uitgebracht/',
        inputUrl:
          'https://www.bricktastic.nl/lego/deze-lego-ideas-projecten-worden-als-set-uitgebracht/',
        title: 'Deze LEGO Ideas-projecten worden als set uitgebracht',
      },
    };
    const service = createAdminEditorialAgentService({
      hasRebrickableApiConfig: () => false,
      hasServerSupabaseConfig: () => true,
      listCatalogSetSummariesWithOverlay: vi.fn(async () => [
        {
          id: '21330',
          name: 'Home Alone',
          pieces: 3955,
          releaseYear: 2021,
          slug: 'home-alone-21330',
          theme: 'Ideas',
        },
      ]),
    });

    const result = await service.generateDraft({
      extraction: staleExtraction,
      importMissingSets: true,
      useAiRewrite: false,
    });

    expect(result.effectiveExtraction.matching.articleType).toBe(
      'multi_set_announcement',
    );
    expect(result.effectiveExtraction.primarySet).toBeNull();
    expect(result.output.frontmatter.theme).toBe('Ideas');
    expect(result.output.frontmatter.description).not.toContain('Home Alone');
    expect(result.output.mdx).not.toContain('Home Alone');
    expect(result.output.mdx).not.toContain('<FeaturedSet');
  });
});
