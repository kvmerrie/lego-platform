import {
  createCatalogSet as createCatalogSetDataAccess,
  listCatalogSetSummariesWithOverlay as listCatalogSetSummariesWithOverlayDataAccess,
  refreshZeroPieceSets as refreshZeroPieceSetsDataAccess,
  searchCatalogMissingSets as searchCatalogMissingSetsDataAccess,
} from '@lego-platform/catalog/data-access-server';
import {
  extractEditorialAgentFactsFromUrl,
  EditorialAgentFetchError,
  generateEditorialAgentDraftResult,
  getConfiguredEditorialFeeds,
  getEditorialFeedItemById,
  listEditorialFeedItems,
  prepareEditorialAgentExtractionForDraft,
  assertContentArticleReadyForPublication,
  ContentArticleDuplicateSourceError,
  ContentArticleNearDuplicateError,
  EditorialAgentUrlValidationError,
  publishContentArticle,
  ContentArticlePublishValidationError,
  syncEditorialFeed,
  updateEditorialFeedItemStatus,
  deleteAdminArticlePreviewsForPublishedDraft,
  importContentArticleHeroImageFromUrl,
  importContentArticleImageFromUrl,
  uploadContentArticleImage,
  uploadContentArticleHeroImage,
  ContentArticleImageUploadValidationError,
} from '@lego-platform/content/data-access-server';
import {
  editorialFeedItemStatuses,
  normalizeContentArticleSetNumber,
  type ContentArticleFrontmatterInput,
  type ContentArticlePublishInput,
  type EditorialAgentCatalogImportStatus,
  type EditorialAgentCatalogMatch,
  type EditorialAgentDraftGenerationResult,
  type EditorialFeedItem,
  type EditorialFeedSyncResult,
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
  generateDraftForFeedItem(input: {
    feedItemId: string;
    importMissingSets: boolean;
    useAiRewrite: boolean;
  }): Promise<{
    draftResult: EditorialAgentDraftGenerationResult;
    feedItem: EditorialFeedItem;
  }>;
  ignoreFeedItem(input: { feedItemId: string }): Promise<EditorialFeedItem>;
  listFeedItems(): Promise<readonly EditorialFeedItem[]>;
  publishArticle(input: ContentArticlePublishInput): Promise<{ slug: string }>;
  publishArticleFromFeedItem(input: {
    feedItemId: string;
    publishInput: ContentArticlePublishInput;
  }): Promise<{ slug: string }>;
  syncFeed(input?: {
    feedName?: string;
    rssUrl?: string;
  }): Promise<EditorialFeedSyncResult>;
  uploadHeroImage(input: {
    base64Data: string;
    contentType: string;
    fileName: string;
    slug: string;
  }): Promise<{ publicUrl: string }>;
  importHeroImageFromUrl(input: {
    imageUrl: string;
    slug: string;
  }): Promise<{ heroImage: string; heroImageCredit: string }>;
  uploadArticleImage(input: {
    base64Data?: string;
    contentType?: string;
    fileName?: string;
    imageId?: string;
    imageUrl?: string;
    slug: string;
    type: 'gallery' | 'hero';
  }): Promise<{ imageCredit?: string; imageUrl: string; publicUrl: string }>;
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
  refreshZeroPieceSets?: typeof refreshZeroPieceSetsDataAccess;
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
  refreshZeroPieceSets = refreshZeroPieceSetsDataAccess,
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
      await refreshZeroPieceSets({
        limit: 1,
        setIds: [normalizedSetNumber],
      });

      return (
        await getCatalogSetSummaryById({
          forceRefresh: true,
        })
      ).get(normalizedSetNumber);
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

  async function extractFactsFromUrl({ url }: { url: string }) {
    return extractEditorialAgentFactsFromUrl({
      findCatalogSetSummaryById: async (setId: string) =>
        (await getCatalogSetSummaryById()).get(setId),
      inputUrl: url,
    });
  }

  async function generateDraftFromExtraction({
    extraction,
    importMissingSets,
    useAiRewrite,
  }: {
    extraction: EditorialAgentFactExtractionResult;
    importMissingSets: boolean;
    useAiRewrite: boolean;
  }) {
    if (
      importMissingSets &&
      hasServerSupabaseConfigDependency() &&
      hasRebrickableApiConfigDependency()
    ) {
      const detectedSetIds = [
        ...new Set(
          extraction.detected.setNumbers
            .map(normalizeCatalogSetNumberForArticleAgent)
            .filter(Boolean),
        ),
      ];

      if (detectedSetIds.length > 0) {
        await refreshZeroPieceSets({
          limit: detectedSetIds.length,
          setIds: detectedSetIds,
        });
        await getCatalogSetSummaryById({
          forceRefresh: true,
        });
      }
    }

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
      stillMissingSetNumbers: effectiveExtraction.matching.unmatchedSetNumbers,
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
  }

  return {
    extractFacts: extractFactsFromUrl,
    generateDraft: generateDraftFromExtraction,
    generateDraftForFeedItem: async ({
      feedItemId,
      importMissingSets,
      useAiRewrite,
    }) => {
      const feedItem = await getEditorialFeedItemById({
        id: feedItemId,
      });

      if (!feedItem) {
        throw new EditorialAgentUrlValidationError(
          'Feed-item kon niet worden gevonden.',
        );
      }

      if (feedItem.status === 'low_value' || feedItem.status === 'ignored') {
        throw new EditorialAgentUrlValidationError(
          'Dit feed-item is gemarkeerd als lage waarde en wordt niet automatisch gedraft.',
        );
      }

      const extraction = await extractFactsFromUrl({
        url: feedItem.sourceUrl,
      });
      const draftResult = await generateDraftFromExtraction({
        extraction,
        importMissingSets,
        useAiRewrite,
      });
      const nextFeedItem = await updateEditorialFeedItemStatus({
        draftFrontmatter: draftResult.output.frontmatter,
        draftMdx: draftResult.output.mdx,
        id: feedItemId,
        status: 'drafted',
      });

      return {
        draftResult,
        feedItem: nextFeedItem,
      };
    },
    ignoreFeedItem: ({ feedItemId }) =>
      updateEditorialFeedItemStatus({
        id: feedItemId,
        status: 'ignored',
      }),
    listFeedItems: () =>
      listEditorialFeedItems({
        statuses: editorialFeedItemStatuses,
      }),
    publishArticle: (input) => publishContentArticle({ input }),
    publishArticleFromFeedItem: async ({ feedItemId, publishInput }) => {
      const result = await publishContentArticle({
        input: publishInput,
      });

      await updateEditorialFeedItemStatus({
        articleSlug: result.slug,
        clearDraft: true,
        id: feedItemId,
        status: 'published',
      });
      await deleteAdminArticlePreviewsForPublishedDraft({
        slug: result.slug,
        sourceUrl: publishInput.frontmatter.sourceUrl,
      });

      return result;
    },
    syncFeed: ({ feedName, rssUrl } = {}) =>
      syncEditorialFeed({
        feeds: rssUrl
          ? [
              {
                name: feedName?.trim() || 'Handmatige feed',
                url: rssUrl,
              },
            ]
          : getConfiguredEditorialFeeds(),
      }),
    uploadHeroImage: async (input) => {
      const result = await uploadContentArticleHeroImage({
        input,
      });

      return {
        publicUrl: result.publicUrl,
      };
    },
    importHeroImageFromUrl: async (input) => {
      const result = await importContentArticleHeroImageFromUrl({
        input,
      });

      return {
        heroImage: result.heroImage,
        heroImageCredit: result.heroImageCredit,
      };
    },
    uploadArticleImage: async (input) => {
      if (input.imageUrl) {
        const result = await importContentArticleImageFromUrl({
          input: {
            imageId: input.imageId,
            imageUrl: input.imageUrl,
            slug: input.slug,
            type: input.type,
          },
        });

        return {
          imageCredit: result.imageCredit,
          imageUrl: result.imageUrl,
          publicUrl: result.imageUrl,
        };
      }

      const result = await uploadContentArticleImage({
        input: {
          base64Data: input.base64Data ?? '',
          contentType: input.contentType ?? '',
          fileName: input.fileName ?? '',
          imageId: input.imageId,
          slug: input.slug,
          type: input.type,
        },
      });

      return {
        imageUrl: result.publicUrl,
        publicUrl: result.publicUrl,
      };
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

function readPublishInput(value: unknown): ContentArticlePublishInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ContentArticlePublishValidationError(
      'Publicatie-input ontbreekt.',
    );
  }

  const mdx = (value as { mdx?: unknown }).mdx;
  const frontmatter = (value as { frontmatter?: unknown }).frontmatter;
  const force = (value as { force?: unknown }).force;

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

  const publishInput = {
    frontmatter: frontmatter as ContentArticleFrontmatterInput,
    mdx,
    ...(force === true ? { force: true } : {}),
  };

  assertContentArticleReadyForPublication(publishInput);

  return publishInput;
}

function readOptionalFeedItemId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const feedItemId = (value as { feedItemId?: unknown }).feedItemId;

  return typeof feedItemId === 'string' && feedItemId.trim()
    ? feedItemId.trim()
    : undefined;
}

function readFeedSyncInput(value: unknown): {
  feedName?: string;
  rssUrl?: string;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const feedName = (value as { feedName?: unknown }).feedName;
  const rssUrl = (value as { rssUrl?: unknown }).rssUrl;

  return {
    ...(typeof feedName === 'string' && feedName.trim()
      ? { feedName: feedName.trim() }
      : {}),
    ...(typeof rssUrl === 'string' && rssUrl.trim()
      ? { rssUrl: rssUrl.trim() }
      : {}),
  };
}

function readHeroImageUploadInput(value: unknown): {
  base64Data: string;
  contentType: string;
  fileName: string;
  slug: string;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ContentArticleImageUploadValidationError(
      'Hero afbeelding upload ontbreekt.',
    );
  }

  const { base64Data, contentType, fileName, slug } = value as {
    base64Data?: unknown;
    contentType?: unknown;
    fileName?: unknown;
    slug?: unknown;
  };

  if (
    typeof base64Data !== 'string' ||
    typeof contentType !== 'string' ||
    typeof fileName !== 'string' ||
    typeof slug !== 'string'
  ) {
    throw new ContentArticleImageUploadValidationError(
      'Hero afbeelding upload is ongeldig.',
    );
  }

  return {
    base64Data,
    contentType,
    fileName,
    slug,
  };
}

function readHeroImageUrlImportInput(value: unknown): {
  imageUrl: string;
  slug: string;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ContentArticleImageUploadValidationError(
      'Afbeeldings-URL ontbreekt.',
    );
  }

  const { imageUrl, slug } = value as {
    imageUrl?: unknown;
    slug?: unknown;
  };

  if (typeof imageUrl !== 'string' || typeof slug !== 'string') {
    throw new ContentArticleImageUploadValidationError(
      'Afbeeldings-URL import is ongeldig.',
    );
  }

  return {
    imageUrl,
    slug,
  };
}

function readArticleImageInput(value: unknown): {
  base64Data?: string;
  contentType?: string;
  fileName?: string;
  imageId?: string;
  imageUrl?: string;
  slug: string;
  type: 'gallery' | 'hero';
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ContentArticleImageUploadValidationError(
      'Artikelafbeelding ontbreekt.',
    );
  }

  const { base64Data, contentType, fileName, imageId, imageUrl, slug, type } =
    value as {
      base64Data?: unknown;
      contentType?: unknown;
      fileName?: unknown;
      imageId?: unknown;
      imageUrl?: unknown;
      slug?: unknown;
      type?: unknown;
    };

  if (
    typeof slug !== 'string' ||
    (type !== 'hero' && type !== 'gallery') ||
    (typeof imageUrl !== 'string' &&
      (typeof base64Data !== 'string' ||
        typeof contentType !== 'string' ||
        typeof fileName !== 'string'))
  ) {
    throw new ContentArticleImageUploadValidationError(
      'Artikelafbeelding upload is ongeldig.',
    );
  }

  return {
    ...(typeof base64Data === 'string' ? { base64Data } : {}),
    ...(typeof contentType === 'string' ? { contentType } : {}),
    ...(typeof fileName === 'string' ? { fileName } : {}),
    ...(typeof imageId === 'string' && imageId.trim()
      ? { imageId: imageId.trim() }
      : {}),
    ...(typeof imageUrl === 'string' ? { imageUrl } : {}),
    slug,
    type,
  };
}

function readFeedItemActionInput(value: unknown): {
  feedItemId: string;
  importMissingSets: boolean;
  useAiRewrite: boolean;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new EditorialAgentUrlValidationError('Feed-item input ontbreekt.');
  }

  const feedItemId = (value as { feedItemId?: unknown }).feedItemId;
  const importMissingSets = (value as { importMissingSets?: unknown })
    .importMissingSets;
  const useAiRewrite = (value as { useAiRewrite?: unknown }).useAiRewrite;

  if (typeof feedItemId !== 'string' || feedItemId.trim().length === 0) {
    throw new EditorialAgentUrlValidationError('Feed-item id ontbreekt.');
  }

  return {
    feedItemId: feedItemId.trim(),
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

    fastify.get(apiPaths.adminEditorialAgentFeedItems, async function () {
      return editorialAgentService.listFeedItems();
    });

    async function feedSyncHandler(
      request: FastifyRequest<{ Body: unknown }>,
      reply: FastifyReply,
    ) {
      try {
        return await editorialAgentService.syncFeed(
          readFeedSyncInput(request.body),
        );
      } catch (error) {
        request.log.error(
          {
            err: error,
          },
          'Editorial Agent feed sync failed',
        );

        return reply.status(500).send({
          message: 'RSS feed sync is mislukt.',
        });
      }
    }

    fastify.post<{ Body: unknown }>(
      apiPaths.adminEditorialAgentFeedSync,
      feedSyncHandler,
    );
    fastify.post<{ Body: unknown }>(
      '/admin/editorial-agent/feed-sync',
      feedSyncHandler,
    );

    fastify.post<{ Body: unknown }>(
      `${apiPaths.adminEditorialAgentFeedItems}/draft`,
      async function (request, reply) {
        try {
          const result = await editorialAgentService.generateDraftForFeedItem(
            readFeedItemActionInput(request.body),
          );

          return {
            ...result,
            draftResult: {
              ...result.draftResult,
              debug: buildEditorialAgentDebugPayload({
                catalogImport: result.draftResult.catalogImport,
                extraction: result.draftResult.effectiveExtraction,
                mdx: result.draftResult.output.mdx,
              }),
            },
          };
        } catch (error) {
          request.log.error(
            {
              err: error,
            },
            'Editorial Agent feed draft failed',
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
              error instanceof Error && error.message.trim()
                ? error.message
                : 'Feed-item draft generatie is mislukt.',
          });
        }
      },
    );

    fastify.post<{ Body: unknown }>(
      `${apiPaths.adminEditorialAgentFeedItems}/ignore`,
      async function (request, reply) {
        try {
          const input = readFeedItemActionInput(request.body);

          return await editorialAgentService.ignoreFeedItem({
            feedItemId: input.feedItemId,
          });
        } catch (error) {
          request.log.error(
            {
              err: error,
            },
            'Editorial Agent feed item ignore failed',
          );

          if (error instanceof EditorialAgentUrlValidationError) {
            return reply.status(400).send({
              message: error.message,
            });
          }

          return reply.status(500).send({
            message: 'Feed-item negeren is mislukt.',
          });
        }
      },
    );

    fastify.post<{ Body: unknown }>(
      apiPaths.adminEditorialAgentHeroImage,
      {
        bodyLimit: 7 * 1024 * 1024,
      },
      async function (request, reply) {
        try {
          return await editorialAgentService.uploadHeroImage(
            readHeroImageUploadInput(request.body),
          );
        } catch (error) {
          request.log.error(
            {
              err: error,
            },
            'Editorial Agent hero image upload failed',
          );

          if (error instanceof ContentArticleImageUploadValidationError) {
            return reply.status(400).send({
              message: error.message,
            });
          }

          return reply.status(500).send({
            message: 'Hero afbeelding uploaden is mislukt.',
          });
        }
      },
    );

    fastify.post<{ Body: unknown }>(
      apiPaths.adminEditorialAgentArticleImage,
      {
        bodyLimit: 7 * 1024 * 1024,
      },
      async function (request, reply) {
        try {
          return await editorialAgentService.uploadArticleImage(
            readArticleImageInput(request.body),
          );
        } catch (error) {
          request.log.error(
            {
              err: error,
            },
            'Editorial Agent article image upload failed',
          );

          if (error instanceof ContentArticleImageUploadValidationError) {
            return reply.status(400).send({
              message: error.message,
            });
          }

          return reply.status(500).send({
            message: 'Artikelafbeelding uploaden is mislukt.',
          });
        }
      },
    );

    fastify.post<{ Body: unknown }>(
      apiPaths.adminEditorialAgentHeroImageUrl,
      async function (request, reply) {
        try {
          return await editorialAgentService.importHeroImageFromUrl(
            readHeroImageUrlImportInput(request.body),
          );
        } catch (error) {
          request.log.error(
            {
              err: error,
            },
            'Editorial Agent hero image URL import failed',
          );

          if (error instanceof ContentArticleImageUploadValidationError) {
            return reply.status(400).send({
              message: error.message,
            });
          }

          return reply.status(500).send({
            message: 'Hero afbeelding importeren is mislukt.',
          });
        }
      },
    );

    async function publishArticleHandler(
      request: FastifyRequest<{ Body: unknown }>,
      reply: FastifyReply,
    ) {
      try {
        const publishInput = readPublishInput(request.body);
        const feedItemId = readOptionalFeedItemId(request.body);

        return feedItemId
          ? await editorialAgentService.publishArticleFromFeedItem({
              feedItemId,
              publishInput,
            })
          : await editorialAgentService.publishArticle(publishInput);
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

        if (error instanceof ContentArticleDuplicateSourceError) {
          return reply.status(409).send({
            code: 'duplicate_source',
            message: error.message,
            slug: error.existingSlug,
          });
        }

        if (error instanceof ContentArticleNearDuplicateError) {
          return reply.status(409).send({
            code: 'near_duplicate',
            matches: error.matches,
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
