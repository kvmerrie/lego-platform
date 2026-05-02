import Fastify from 'fastify';
import type {
  EditorialAgentDraftGenerationResult,
  EditorialAgentFactExtractionResult,
} from '@lego-platform/content/util';
import { describe, expect, test, vi } from 'vitest';
import {
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

async function createAdminEditorialAgentServer({
  editorialAgentService,
}: {
  editorialAgentService?: AdminEditorialAgentService;
} = {}) {
  const nextEditorialAgentService: AdminEditorialAgentService =
    editorialAgentService ?? {
      extractFacts: vi.fn(async () => createExtractionResult()),
      generateDraft: vi.fn(async () => createDraftResult()),
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
});
