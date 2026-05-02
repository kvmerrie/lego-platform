import {
  createCatalogSet,
  listCatalogSetSummariesWithOverlay,
  searchCatalogMissingSets,
} from '@lego-platform/catalog/data-access-server';
import {
  extractEditorialAgentFactsFromUrl,
  EditorialAgentFetchError,
  generateEditorialAgentDraftResult,
  prepareEditorialAgentExtractionForDraft,
  EditorialAgentUrlValidationError,
} from '@lego-platform/content/data-access-server';
import type {
  EditorialAgentDraftGenerationResult,
  EditorialAgentFactExtractionResult,
  EditorialAgentCatalogMatch,
  EditorialAgentCatalogImportStatus,
} from '@lego-platform/content/util';
import {
  apiPaths,
  hasRebrickableApiConfig,
  hasServerSupabaseConfig,
} from '@lego-platform/shared/config';
import type { FastifyInstance } from 'fastify';

export interface AdminEditorialAgentService {
  extractFacts(input: {
    url: string;
  }): Promise<EditorialAgentFactExtractionResult>;
  generateDraft(input: {
    extraction: EditorialAgentFactExtractionResult;
    importMissingSets: boolean;
    useAiRewrite: boolean;
  }): Promise<EditorialAgentDraftGenerationResult>;
}

function normalizeCatalogImportQuery(setNumber: string): string {
  return /^\d+$/u.test(setNumber) ? `${setNumber}-1` : setNumber;
}

function createAdminEditorialAgentService(): AdminEditorialAgentService {
  let catalogSetSummaryByIdPromise: Promise<
    Map<
      string,
      Pick<EditorialAgentCatalogMatch, 'id' | 'name' | 'slug' | 'theme'>
    >
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
        (catalogSetSummaries) =>
          new Map(
            catalogSetSummaries.map((catalogSetSummary) => [
              catalogSetSummary.id,
              {
                id: catalogSetSummary.id,
                name: catalogSetSummary.name,
                slug: catalogSetSummary.slug,
                theme: catalogSetSummary.theme,
              },
            ]),
          ),
      );
    }

    return catalogSetSummaryByIdPromise;
  }

  async function importCatalogSetByNumber(setNumber: string) {
    const normalizedQuery = normalizeCatalogImportQuery(setNumber);
    const freshSummary = (
      await getCatalogSetSummaryById({
        forceRefresh: true,
      })
    ).get(setNumber);

    if (freshSummary) {
      return freshSummary;
    }

    const searchResults = await searchCatalogMissingSets({
      query: normalizedQuery,
    });
    const matchingSearchResult = searchResults.find(
      (searchResult) => searchResult.sourceSetNumber === normalizedQuery,
    );

    if (!matchingSearchResult) {
      return undefined;
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
      ).get(setNumber);

      if (concurrentSummary) {
        return concurrentSummary;
      }

      throw new Error(`Catalog import failed for ${setNumber}.`);
    }

    return (
      await getCatalogSetSummaryById({
        forceRefresh: true,
      })
    ).get(setNumber);
  }

  return {
    extractFacts: ({ url }) =>
      extractEditorialAgentFactsFromUrl({
        findCatalogSetSummaryById: async (setId: string) =>
          (await getCatalogSetSummaryById()).get(setId),
        inputUrl: url,
      }),
    generateDraft: async ({ extraction, importMissingSets, useAiRewrite }) => {
      let effectiveExtraction = extraction;
      let catalogImport: EditorialAgentCatalogImportStatus = {
        attempted: false,
        attemptedSetNumbers: [],
        enabled: importMissingSets,
        importedSets: [],
        stillMissingSetNumbers: extraction.matching.unmatchedSetNumbers,
        warnings: [],
      };

      if (importMissingSets) {
        const attemptedSetNumbers = [
          ...extraction.matching.unmatchedSetNumbers,
        ];

        if (attemptedSetNumbers.length > 0) {
          if (!hasServerSupabaseConfig() || !hasRebrickableApiConfig()) {
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
            const preparedExtraction =
              await prepareEditorialAgentExtractionForDraft({
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

          return editorialAgentService.extractFacts(input);
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
          return await editorialAgentService.generateDraft(
            readDraftInput(request.body),
          );
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
  };
}

export default createAdminEditorialAgentRoutes();
