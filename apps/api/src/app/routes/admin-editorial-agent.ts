import {
  createCatalogSet as createCatalogSetDataAccess,
  listCatalogSetSummariesWithOverlay as listCatalogSetSummariesWithOverlayDataAccess,
  searchCatalogMissingSets as searchCatalogMissingSetsDataAccess,
} from '@lego-platform/catalog/data-access-server';
import {
  extractEditorialAgentFactsFromUrl,
  EditorialAgentFetchError,
  generateEditorialAgentDraftResult,
  prepareEditorialAgentExtractionForDraft,
  EditorialAgentUrlValidationError,
  publishContentArticle,
  ContentArticlePublishValidationError,
} from '@lego-platform/content/data-access-server';
import {
  normalizeContentArticleSetNumber,
  type ContentArticleFrontmatterInput,
  type ContentArticlePublishInput,
  type EditorialAgentCatalogImportStatus,
  type EditorialAgentCatalogMatch,
  type EditorialAgentDraftGenerationResult,
  type EditorialAgentFactExtractionResult,
} from '@lego-platform/content/util';
import {
  apiPaths,
  hasRebrickableApiConfig,
  hasServerSupabaseConfig,
} from '@lego-platform/shared/config';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export interface AdminEditorialAgentService {
  extractFacts(input: {
    url: string;
  }): Promise<EditorialAgentFactExtractionResult>;
  generateDraft(input: {
    extraction: EditorialAgentFactExtractionResult;
    importMissingSets: boolean;
    useAiRewrite: boolean;
  }): Promise<EditorialAgentDraftGenerationResult>;
  publishArticle(input: ContentArticlePublishInput): Promise<{ slug: string }>;
}

type EditorialAgentCatalogSummary = Pick<
  EditorialAgentCatalogMatch,
  'id' | 'name' | 'slug' | 'theme'
>;

interface AdminEditorialAgentDebugPayload {
  articleType: string;
  detectedSetNumbers: readonly string[];
  draftContainsFeaturedSet76339: boolean;
  draftContainsSetSpotlightList: boolean;
  importedSets: readonly EditorialAgentCatalogMatch[];
  matchedSetNumbers: readonly string[];
  pipelineVersion: 'debug-76339-rematch';
  primarySetNumber: string | null;
  stillMissingSetNumbers: readonly string[];
  templateKind: string;
  unmatchedSetNumbers: readonly string[];
}

export interface AdminEditorialAgentCatalogDependencies {
  createCatalogSet?: typeof createCatalogSetDataAccess;
  hasRebrickableApiConfig?: typeof hasRebrickableApiConfig;
  hasServerSupabaseConfig?: typeof hasServerSupabaseConfig;
  listCatalogSetSummariesWithOverlay?: typeof listCatalogSetSummariesWithOverlayDataAccess;
  searchCatalogMissingSets?: typeof searchCatalogMissingSetsDataAccess;
}

function normalizeCatalogSetNumberForArticleAgent(setNumber: string): string {
  return normalizeContentArticleSetNumber(setNumber) ?? setNumber.trim();
}

function createCatalogImportQueries(setNumber: string): string[] {
  const normalizedSetNumber = setNumber.trim();

  if (!normalizedSetNumber) {
    return [];
  }

  const articleSetNumber =
    normalizeCatalogSetNumberForArticleAgent(normalizedSetNumber);
  const queries = [normalizedSetNumber];

  if (/^\d+$/u.test(articleSetNumber)) {
    queries.push(`${articleSetNumber}-1`);
  }

  if (articleSetNumber !== normalizedSetNumber) {
    queries.push(articleSetNumber);
  }

  return [...new Set(queries)];
}

function createCatalogSummaryByIdMap(
  catalogSetSummaries: readonly EditorialAgentCatalogSummary[],
): Map<string, EditorialAgentCatalogSummary> {
  const catalogSetSummaryById = new Map<string, EditorialAgentCatalogSummary>();

  for (const catalogSetSummary of catalogSetSummaries) {
    const normalizedId = normalizeCatalogSetNumberForArticleAgent(
      catalogSetSummary.id,
    );
    const normalizedSummary = {
      id: normalizedId,
      name: catalogSetSummary.name,
      slug: catalogSetSummary.slug,
      theme: catalogSetSummary.theme,
    };

    catalogSetSummaryById.set(catalogSetSummary.id, normalizedSummary);
    catalogSetSummaryById.set(normalizedId, normalizedSummary);
  }

  return catalogSetSummaryById;
}

function matchesDetectedCatalogSetNumber({
  detectedSetNumber,
  sourceSetNumber,
}: {
  detectedSetNumber: string;
  sourceSetNumber: string;
}): boolean {
  return (
    normalizeCatalogSetNumberForArticleAgent(sourceSetNumber) ===
    normalizeCatalogSetNumberForArticleAgent(detectedSetNumber)
  );
}

function resolveDebugTemplateKind({
  articleType,
  mdx = '',
  primarySetNumber,
}: {
  articleType: string;
  mdx?: string;
  primarySetNumber: string | null;
}): string {
  if (mdx.includes('<SetSpotlightList')) {
    return 'release_roundup';
  }

  if (mdx.includes('<FeaturedSet') || primarySetNumber) {
    return 'single_set';
  }

  return articleType;
}

function buildEditorialAgentDebugPayload({
  catalogImport,
  extraction,
  mdx = '',
}: {
  catalogImport?: EditorialAgentCatalogImportStatus;
  extraction: EditorialAgentFactExtractionResult;
  mdx?: string;
}): AdminEditorialAgentDebugPayload {
  const primarySetNumber = extraction.primarySet?.setNumber ?? null;

  return {
    articleType: extraction.matching.articleType,
    detectedSetNumbers: extraction.detected.setNumbers,
    draftContainsFeaturedSet76339: mdx.includes(
      '<FeaturedSet setNumber="76339"',
    ),
    draftContainsSetSpotlightList: mdx.includes('<SetSpotlightList'),
    importedSets: catalogImport?.importedSets ?? [],
    matchedSetNumbers: extraction.matching.matchedSets.map(
      (matchedSet) => matchedSet.setNumber,
    ),
    pipelineVersion: 'debug-76339-rematch',
    primarySetNumber,
    stillMissingSetNumbers: catalogImport?.stillMissingSetNumbers ?? [],
    templateKind: resolveDebugTemplateKind({
      articleType: extraction.matching.articleType,
      mdx,
      primarySetNumber,
    }),
    unmatchedSetNumbers: extraction.matching.unmatchedSetNumbers,
  };
}

export function createAdminEditorialAgentService({
  createCatalogSet = createCatalogSetDataAccess,
  hasRebrickableApiConfig:
    hasRebrickableApiConfigDependency = hasRebrickableApiConfig,
  hasServerSupabaseConfig:
    hasServerSupabaseConfigDependency = hasServerSupabaseConfig,
  listCatalogSetSummariesWithOverlay = listCatalogSetSummariesWithOverlayDataAccess,
  searchCatalogMissingSets = searchCatalogMissingSetsDataAccess,
}: AdminEditorialAgentCatalogDependencies = {}): AdminEditorialAgentService {
  let catalogSetSummaryByIdPromise: Promise<
    Map<string, EditorialAgentCatalogSummary>
  > | null = null;

  async function getCatalogSetSummaryById({
    forceRefresh = false,
  }: {
    forceRefresh?: boolean;
  } = {}) {
    if (forceRefresh) {
      catalogSetSummaryByIdPromise = null;
    }

    if (!catalogSetSummaryByIdPromise) {
      catalogSetSummaryByIdPromise = listCatalogSetSummariesWithOverlay().then(
        createCatalogSummaryByIdMap,
      );
    }

    return catalogSetSummaryByIdPromise;
  }

  async function importCatalogSetByNumber(setNumber: string) {
    const normalizedSetNumber =
      normalizeCatalogSetNumberForArticleAgent(setNumber);
    const freshSummary = (
      await getCatalogSetSummaryById({
        forceRefresh: true,
      })
    ).get(normalizedSetNumber);

    if (freshSummary) {
      return freshSummary;
    }

    for (const query of createCatalogImportQueries(setNumber)) {
      const searchResults = await searchCatalogMissingSets({
        query,
      });
      const matchingSearchResult = searchResults.find((searchResult) =>
        matchesDetectedCatalogSetNumber({
          detectedSetNumber: normalizedSetNumber,
          sourceSetNumber: searchResult.sourceSetNumber,
        }),
      );

      if (!matchingSearchResult) {
        continue;
      }

      try {
        await createCatalogSet({
          input: matchingSearchResult,
        });
      } catch {
        const concurrentSummary = (
          await getCatalogSetSummaryById({
            forceRefresh: true,
          })
        ).get(normalizedSetNumber);

        if (concurrentSummary) {
          return concurrentSummary;
        }

        throw new Error(`Catalog import failed for ${setNumber}.`);
      }

      return (
        await getCatalogSetSummaryById({
          forceRefresh: true,
        })
      ).get(normalizedSetNumber);
    }

    return undefined;
  }

  return {
    extractFacts: ({ url }) =>
      extractEditorialAgentFactsFromUrl({
        findCatalogSetSummaryById: async (setId: string) =>
          (await getCatalogSetSummaryById()).get(setId),
        inputUrl: url,
      }),
    generateDraft: async ({ extraction, importMissingSets, useAiRewrite }) => {
      let preparedExtraction = await prepareEditorialAgentExtractionForDraft({
        extraction,
        findCatalogSetSummaryById: async (setId: string) =>
          (await getCatalogSetSummaryById()).get(setId),
        importMissingSets: false,
      });
      let effectiveExtraction = preparedExtraction.extraction;
      let catalogImport: EditorialAgentCatalogImportStatus = {
        attempted: false,
        attemptedSetNumbers: [],
        enabled: importMissingSets,
        importedSets: [],
        stillMissingSetNumbers:
          effectiveExtraction.matching.unmatchedSetNumbers,
        warnings: [],
      };

      if (importMissingSets) {
        const attemptedSetNumbers = [
          ...effectiveExtraction.matching.unmatchedSetNumbers,
        ];

        if (attemptedSetNumbers.length > 0) {
          if (
            !hasServerSupabaseConfigDependency() ||
            !hasRebrickableApiConfigDependency()
          ) {
            catalogImport = {
              attempted: true,
              attemptedSetNumbers,
              enabled: true,
              importedSets: [],
              stillMissingSetNumbers: attemptedSetNumbers,
              warnings: [
                'Gerichte catalog-import is niet beschikbaar omdat Rebrickable of Supabase-config ontbreekt.',
                ...attemptedSetNumbers.map(
                  (setNumber) =>
                    `Set ${setNumber} is genoemd in de bron, maar staat nog niet in de catalogus.`,
                ),
              ],
            };
          } else {
            preparedExtraction = await prepareEditorialAgentExtractionForDraft({
              extraction,
              findCatalogSetSummaryById: async (setId: string) =>
                (await getCatalogSetSummaryById()).get(setId),
              importCatalogSetByNumber,
              importMissingSets: true,
            });

            effectiveExtraction = preparedExtraction.extraction;
            catalogImport = preparedExtraction.catalogImport;
          }
        }
      }

      return generateEditorialAgentDraftResult({
        catalogImport,
        extraction: effectiveExtraction,
        useAiRewrite,
      });
    },
    publishArticle: (input) => publishContentArticle({ input }),
  };
}

function readExtractionInput(value: unknown): { url: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new EditorialAgentUrlValidationError(
      'Editorial Agent input ontbreekt.',
    );
  }

  const url = (value as { url?: unknown }).url;

  if (typeof url !== 'string' || url.trim().length === 0) {
    throw new EditorialAgentUrlValidationError('Voer een geldige bron-URL in.');
  }

  return {
    url: url.trim(),
  };
}

function readDraftInput(value: unknown): {
  extraction: EditorialAgentFactExtractionResult;
  importMissingSets: boolean;
  useAiRewrite: boolean;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new EditorialAgentUrlValidationError(
      'Editorial Agent draft input ontbreekt.',
    );
  }

  const extraction = (value as { extraction?: unknown }).extraction;
  const importMissingSets = (value as { importMissingSets?: unknown })
    .importMissingSets;
  const useAiRewrite = (value as { useAiRewrite?: unknown }).useAiRewrite;

  if (
    !extraction ||
    typeof extraction !== 'object' ||
    Array.isArray(extraction)
  ) {
    throw new EditorialAgentUrlValidationError(
      'Stuur eerst een geldige extraction mee voordat je een draft genereert.',
    );
  }

  if (
    !('source' in extraction) ||
    !('facts' in extraction) ||
    !('matching' in extraction)
  ) {
    throw new EditorialAgentUrlValidationError(
      'De draftinput mist de facts of matching-laag.',
    );
  }

  return {
    extraction: extraction as EditorialAgentFactExtractionResult,
    importMissingSets:
      typeof importMissingSets === 'boolean' ? importMissingSets : true,
    useAiRewrite: typeof useAiRewrite === 'boolean' ? useAiRewrite : false,
  };
}

function readPublishInput(value: unknown): ContentArticlePublishInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ContentArticlePublishValidationError(
      'Publicatie-input ontbreekt.',
    );
  }

  const mdx = (value as { mdx?: unknown }).mdx;
  const frontmatter = (value as { frontmatter?: unknown }).frontmatter;

  if (typeof mdx !== 'string' || mdx.trim().length === 0) {
    throw new ContentArticlePublishValidationError('Artikel-MDX ontbreekt.');
  }

  if (
    !frontmatter ||
    typeof frontmatter !== 'object' ||
    Array.isArray(frontmatter)
  ) {
    throw new ContentArticlePublishValidationError(
      'Artikel-frontmatter ontbreekt.',
    );
  }

  return {
    frontmatter: frontmatter as ContentArticleFrontmatterInput,
    mdx,
  };
}

export function createAdminEditorialAgentRoutes({
  editorialAgentService = createAdminEditorialAgentService(),
}: {
  editorialAgentService?: AdminEditorialAgentService;
} = {}) {
  return async function (fastify: FastifyInstance) {
    fastify.post<{ Body: unknown }>(
      apiPaths.adminEditorialAgentExtract,
      async function (request, reply) {
        let inputUrl = '';

        try {
          const input = readExtractionInput(request.body);
          inputUrl = input.url;
          const extraction = await editorialAgentService.extractFacts(input);

          return {
            ...extraction,
            debug: buildEditorialAgentDebugPayload({
              extraction,
            }),
          };
        } catch (error) {
          request.log.error(
            {
              err: error,
              sourceUrl: inputUrl || undefined,
            },
            'Editorial Agent extraction failed',
          );

          if (error instanceof EditorialAgentUrlValidationError) {
            return reply.status(400).send({
              message: error.message,
            });
          }

          if (error instanceof EditorialAgentFetchError) {
            return reply.status(502).send({
              message: error.message,
            });
          }

          return reply.status(500).send({
            message:
              'De extractiestap liep vast. Probeer het zo nog een keer met een publieke artikel-URL.',
          });
        }
      },
    );

    fastify.post<{ Body: unknown }>(
      apiPaths.adminEditorialAgentDraft,
      async function (request, reply) {
        try {
          const draftResult = await editorialAgentService.generateDraft(
            readDraftInput(request.body),
          );

          return {
            ...draftResult,
            debug: buildEditorialAgentDebugPayload({
              catalogImport: draftResult.catalogImport,
              extraction: draftResult.effectiveExtraction,
              mdx: draftResult.output.mdx,
            }),
          };
        } catch (error) {
          request.log.error(
            {
              err: error,
            },
            'Editorial Agent draft generation failed',
          );

          if (error instanceof EditorialAgentUrlValidationError) {
            return reply.status(400).send({
              message: error.message,
            });
          }

          return reply.status(500).send({
            message:
              'De draft generatie liep vast. Gebruik voorlopig de deterministic draft.',
          });
        }
      },
    );

    async function publishArticleHandler(
      request: FastifyRequest<{ Body: unknown }>,
      reply: FastifyReply,
    ) {
      try {
        return await editorialAgentService.publishArticle(
          readPublishInput(request.body),
        );
      } catch (error) {
        request.log.error(
          {
            err: error,
          },
          'Editorial Agent article publish failed',
        );

        if (error instanceof ContentArticlePublishValidationError) {
          return reply.status(400).send({
            message: error.message,
          });
        }

        return reply.status(500).send({
          message: 'Artikel publiceren naar Supabase is mislukt.',
        });
      }
    }

    fastify.post<{ Body: unknown }>(
      apiPaths.adminEditorialAgentPublish,
      publishArticleHandler,
    );
    fastify.post<{ Body: unknown }>(
      '/admin/editorial-agent/publish',
      publishArticleHandler,
    );
  };
}

export default createAdminEditorialAgentRoutes();
