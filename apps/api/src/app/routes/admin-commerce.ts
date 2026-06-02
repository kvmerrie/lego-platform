import {
  importAffiliateDiscoveredSets,
  importAlternateAffiliateFeedRows,
  refreshCommerceSetOfferSeeds,
  revalidatePublicWeb,
  updateAffiliateDiscoveredSetStatus,
  type AlternateAffiliateFeedRow,
  type AlternateAffiliateFeedImportResult,
} from '@lego-platform/api/data-access-server';
import {
  findCatalogSetSummaryByIdWithOverlay,
  listCanonicalCatalogSets,
} from '@lego-platform/catalog/data-access-server';
import {
  copyCommerceDataFromProduction,
  createCommerceBenchmarkSet,
  createCommerceMerchant,
  createCommerceOfferSeed,
  deleteCommerceBenchmarkSet,
  listCommerceAffiliateDiscoveredSets,
  listCommerceBenchmarkSets,
  listCommerceMerchants,
  listCommerceOfferSeeds,
  updateCommerceMerchant,
  updateCommerceOfferSeed,
  type CommerceProductionCopyResult,
} from '@lego-platform/commerce/data-access-server';
import {
  type CommerceBenchmarkSet,
  type CommerceBenchmarkSetInput,
  type CommerceAffiliateDiscoveredSet,
  type CommerceAffiliateDiscoveredSetConfidence,
  type CommerceAffiliateDiscoveredSetImportResult,
  type CommerceAffiliateDiscoveredSetStatus,
  type CommerceCoverageQueueRow,
  type CommerceMerchant,
  type CommerceMerchantInput,
  type CommerceOfferSeed,
  type CommerceOfferSeedInput,
  type CommerceSetRefreshResult,
  buildCommerceCoverageQueueRows,
  validateCommerceBenchmarkSetInput,
  validateCommerceMerchantInput,
  validateCommerceOfferSeedInput,
} from '@lego-platform/commerce/util';
import {
  apiPaths,
  buildCatalogSetRevalidationTags,
  buildMerchantRevalidationTags,
  buildSetDetailPath,
  buildThemePath,
  cacheTags,
  getAdminPromotionConfig,
} from '@lego-platform/shared/config';
import { buildCatalogThemeSlug } from '@lego-platform/catalog/util';
import { normalizeCatalogSetId } from '@lego-platform/shared/util';
import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { createAdminPreHandler } from '../lib/admin-authorization';

export interface AdminCommerceService {
  importAlternateFeed(
    rows: readonly AlternateAffiliateFeedRow[],
  ): Promise<AlternateAffiliateFeedImportResult>;
  importDiscoveredSets(input: {
    discoveredSetIds?: readonly string[];
    highConfidenceOnly?: boolean;
    maxBatchSize?: number;
  }): Promise<CommerceAffiliateDiscoveredSetImportResult>;
  listAffiliateDiscoveredSets(input?: {
    affiliateId?: string;
    confidence?: CommerceAffiliateDiscoveredSetConfidence | 'all';
    status?: CommerceAffiliateDiscoveredSetStatus | 'all';
  }): Promise<CommerceAffiliateDiscoveredSet[]>;
  updateDiscoveredSetStatus(input: {
    discoveredSetId: string;
    status: Exclude<CommerceAffiliateDiscoveredSetStatus, 'imported'>;
  }): Promise<CommerceAffiliateDiscoveredSet>;
  copyProductionCommerce(input: {
    allowDestructive: boolean;
    dryRun: boolean;
  }): Promise<CommerceProductionCopyResult>;
  createBenchmarkSet(
    input: CommerceBenchmarkSetInput,
  ): Promise<CommerceBenchmarkSet>;
  listCoverageQueue(): Promise<CommerceCoverageQueueRow[]>;
  refreshSet(setId: string): Promise<CommerceSetRefreshResult>;
  createMerchant(input: CommerceMerchantInput): Promise<CommerceMerchant>;
  createOfferSeed(input: CommerceOfferSeedInput): Promise<CommerceOfferSeed>;
  deleteBenchmarkSet(setId: string): Promise<void>;
  listBenchmarkSets(): Promise<CommerceBenchmarkSet[]>;
  listMerchants(): Promise<CommerceMerchant[]>;
  listOfferSeeds(): Promise<CommerceOfferSeed[]>;
  updateMerchant(input: {
    input: CommerceMerchantInput;
    merchantId: string;
  }): Promise<CommerceMerchant>;
  updateOfferSeed(input: {
    input: CommerceOfferSeedInput;
    offerSeedId: string;
  }): Promise<CommerceOfferSeed>;
}

function createAdminCommerceService(): AdminCommerceService {
  return {
    importAlternateFeed: (rows) =>
      importAlternateAffiliateFeedRows({
        rows,
      }),
    importDiscoveredSets: (input) => importAffiliateDiscoveredSets(input),
    listAffiliateDiscoveredSets: (input) =>
      listCommerceAffiliateDiscoveredSets(input),
    updateDiscoveredSetStatus: (input) =>
      updateAffiliateDiscoveredSetStatus(input),
    copyProductionCommerce: ({ allowDestructive, dryRun }) =>
      copyCommerceDataFromProduction({
        allowDestructive,
        dryRun,
      }),
    listBenchmarkSets: () => listCommerceBenchmarkSets(),
    createBenchmarkSet: (input) => createCommerceBenchmarkSet({ input }),
    deleteBenchmarkSet: (setId) => deleteCommerceBenchmarkSet({ setId }),
    listCoverageQueue: async () => {
      const [benchmarkSets, catalogSets, merchants, offerSeeds] =
        await Promise.all([
          listCommerceBenchmarkSets(),
          listCanonicalCatalogSets(),
          listCommerceMerchants(),
          listCommerceOfferSeeds(),
        ]);

      return buildCommerceCoverageQueueRows({
        benchmarkSets,
        catalogSets: catalogSets.map((catalogSet) => ({
          id: catalogSet.setId,
          name: catalogSet.name,
          theme: catalogSet.primaryTheme,
          slug: catalogSet.slug,
          source: 'overlay',
          createdAt: catalogSet.createdAt,
        })),
        merchants,
        offerSeeds,
      });
    },
    refreshSet: async (setId) => ({
      setId,
      ...(await refreshCommerceSetOfferSeeds({ setId })),
    }),
    listMerchants: () => listCommerceMerchants(),
    createMerchant: (input) => createCommerceMerchant({ input }),
    updateMerchant: ({ input, merchantId }) =>
      updateCommerceMerchant({ input, merchantId }),
    listOfferSeeds: () => listCommerceOfferSeeds(),
    createOfferSeed: (input) => createCommerceOfferSeed({ input }),
    updateOfferSeed: ({ input, offerSeedId }) =>
      updateCommerceOfferSeed({ input, offerSeedId }),
  };
}

function readAdminSecretHeader(
  headerValue: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(headerValue)) {
    return typeof headerValue[0] === 'string'
      ? headerValue[0].trim()
      : undefined;
  }

  return typeof headerValue === 'string' ? headerValue.trim() : undefined;
}

function matchesAdminSecret({
  expectedSecret,
  providedSecret,
}: {
  expectedSecret: string;
  providedSecret?: string;
}): boolean {
  if (!providedSecret) {
    return false;
  }

  const expectedBuffer = Buffer.from(expectedSecret, 'utf8');
  const providedBuffer = Buffer.from(providedSecret, 'utf8');

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

function readCommerceProductionSyncBody(value: unknown): {
  allowDestructive: boolean;
  dryRun: boolean;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      allowDestructive: false,
      dryRun: true,
    };
  }

  return {
    allowDestructive:
      (value as { allowDestructive?: unknown }).allowDestructive === true,
    dryRun: (value as { dryRun?: unknown }).dryRun !== false,
  };
}

function toBadRequestMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof Error ? error.message : fallbackMessage;
}

function readRequiredSetId(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Kies eerst een set om opnieuw te checken.');
  }

  const setId = (value as { setId?: unknown }).setId;

  if (typeof setId !== 'string' || !setId.trim()) {
    throw new Error('Kies eerst een set om opnieuw te checken.');
  }

  return normalizeCatalogSetId(setId);
}

function normalizeBenchmarkSetInput(
  input: CommerceBenchmarkSetInput,
): CommerceBenchmarkSetInput {
  return {
    ...input,
    setId: normalizeCatalogSetId(input.setId),
  };
}

function normalizeOfferSeedInput(
  input: CommerceOfferSeedInput,
): CommerceOfferSeedInput {
  return {
    ...input,
    setId: normalizeCatalogSetId(input.setId),
  };
}

function readOptionalStringQuery(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readAffiliateDiscoveredSetFilters(value: {
  affiliateId?: string;
  confidence?: string;
  status?: string;
}): {
  affiliateId?: string;
  confidence?: CommerceAffiliateDiscoveredSetConfidence | 'all';
  status?: CommerceAffiliateDiscoveredSetStatus | 'all';
} {
  const confidence = readOptionalStringQuery(value.confidence);
  const status = readOptionalStringQuery(value.status);

  if (
    confidence &&
    !(['all', 'high', 'low'] as const).includes(confidence as never)
  ) {
    throw new Error('Confidence filter is ongeldig.');
  }

  if (
    status &&
    !(['all', 'new', 'imported', 'ignored', 'non_set'] as const).includes(
      status as never,
    )
  ) {
    throw new Error('Status filter is ongeldig.');
  }

  return {
    affiliateId: readOptionalStringQuery(value.affiliateId),
    confidence: confidence as CommerceAffiliateDiscoveredSetConfidence | 'all',
    status: status as CommerceAffiliateDiscoveredSetStatus | 'all',
  };
}

function readDiscoveredSetIds(value: unknown): string[] | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const discoveredSetIds = (value as { discoveredSetIds?: unknown })
    .discoveredSetIds;

  if (typeof discoveredSetIds === 'undefined') {
    return undefined;
  }

  if (!Array.isArray(discoveredSetIds)) {
    throw new Error('Discovered-set input mist een geldige id-lijst.');
  }

  return discoveredSetIds
    .map((discoveredSetId) =>
      typeof discoveredSetId === 'string' ? discoveredSetId.trim() : '',
    )
    .filter(Boolean);
}

function readAffiliateDiscoveredSetImportBody(value: unknown): {
  discoveredSetIds?: string[];
  highConfidenceOnly: boolean;
  maxBatchSize: number;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      highConfidenceOnly: true,
      maxBatchSize: 50,
    };
  }
  const rawMaxBatchSize = (value as { maxBatchSize?: unknown }).maxBatchSize;
  const maxBatchSize =
    typeof rawMaxBatchSize === 'number' &&
    Number.isInteger(rawMaxBatchSize) &&
    rawMaxBatchSize > 0
      ? Math.min(rawMaxBatchSize, 50)
      : 50;

  return {
    discoveredSetIds: readDiscoveredSetIds(value),
    highConfidenceOnly:
      (value as { highConfidenceOnly?: unknown }).highConfidenceOnly !== false,
    maxBatchSize,
  };
}

function readAffiliateDiscoveredSetStatusBody(value: unknown): {
  status: Exclude<CommerceAffiliateDiscoveredSetStatus, 'imported'>;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Reviewstatus ontbreekt.');
  }

  const status = (value as { status?: unknown }).status;

  if (status !== 'ignored' && status !== 'non_set' && status !== 'new') {
    throw new Error('Reviewstatus is ongeldig.');
  }

  return {
    status,
  };
}

function readAlternateAffiliateFeedRows(
  value: unknown,
): AlternateAffiliateFeedRow[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Alternate feed input mist een rows-lijst.');
  }

  const rows = (value as { rows?: unknown }).rows;

  if (!Array.isArray(rows)) {
    throw new Error('Alternate feed input mist een rows-lijst.');
  }

  return rows.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error(`Alternate feed row ${index + 1} is ongeldig.`);
    }

    const record = row as Record<string, unknown>;

    return {
      affiliateDeeplink:
        typeof record['affiliateDeeplink'] === 'string'
          ? record['affiliateDeeplink']
          : '',
      availabilityText:
        typeof record['availabilityText'] === 'string'
          ? record['availabilityText']
          : undefined,
      brand: typeof record['brand'] === 'string' ? record['brand'] : undefined,
      category:
        typeof record['category'] === 'string' ? record['category'] : undefined,
      condition:
        typeof record['condition'] === 'string'
          ? record['condition']
          : undefined,
      currency:
        typeof record['currency'] === 'string' ? record['currency'] : undefined,
      description:
        typeof record['description'] === 'string'
          ? record['description']
          : undefined,
      ean: typeof record['ean'] === 'string' ? record['ean'] : undefined,
      imageUrl:
        typeof record['imageUrl'] === 'string' ? record['imageUrl'] : undefined,
      legoSetNumber:
        typeof record['legoSetNumber'] === 'string'
          ? record['legoSetNumber']
          : undefined,
      price:
        typeof record['price'] === 'number' ||
        typeof record['price'] === 'string'
          ? record['price']
          : undefined,
      productTitle:
        typeof record['productTitle'] === 'string'
          ? record['productTitle']
          : undefined,
      shippingCost:
        typeof record['shippingCost'] === 'number' ||
        typeof record['shippingCost'] === 'string'
          ? record['shippingCost']
          : undefined,
    };
  });
}

async function ensureCatalogSetExists(setId: string) {
  const catalogSet = await findCatalogSetSummaryByIdWithOverlay({
    setId,
  });

  if (!catalogSet) {
    throw new Error(
      `Set ${setId} is not part of the Brickhunt catalog, so it cannot receive commerce seeds yet.`,
    );
  }

  return catalogSet;
}

async function revalidateCommerceOfferSeedSurfaces({
  setId,
}: {
  setId: string;
}): Promise<void> {
  try {
    const catalogSet = await ensureCatalogSetExists(setId);
    const themeSlug = buildCatalogThemeSlug(catalogSet.theme);

    await revalidatePublicWeb({
      paths: [buildSetDetailPath(catalogSet.slug), buildThemePath(themeSlug)],
      reason: 'admin_commerce_offer_seed_mutation',
      tags: [
        ...buildCatalogSetRevalidationTags({
          affectsHomepage: true,
          setNumberOrSlug: catalogSet.id,
          themeSlug,
        }),
        cacheTags.deals(),
      ],
    });
  } catch (error) {
    console.warn(
      error instanceof Error
        ? error.message
        : 'Public web commerce offer seed revalidation failed.',
    );
  }
}

async function revalidateMerchantSurfaces({
  merchantSlug,
}: {
  merchantSlug: string;
}): Promise<void> {
  try {
    await revalidatePublicWeb({
      reason: 'admin_commerce_merchant_mutation',
      tags: buildMerchantRevalidationTags({
        includeGlobalPrices: false,
        merchantSlug,
      }),
    });
  } catch (error) {
    console.warn(
      error instanceof Error
        ? error.message
        : 'Public web commerce merchant revalidation failed.',
    );
  }
}

export function createAdminCommerceRoutes({
  adminOrMachinePreHandler,
  adminPreHandler,
  commerceService = createAdminCommerceService(),
  getExpectedAdminSecret = () => getAdminPromotionConfig().secret,
  isProductionEnvironment = () =>
    process.env['BRICKHUNT_ENV'] === 'production' ||
    process.env['APP_ENV'] === 'production' ||
    process.env['VERCEL_ENV'] === 'production',
}: {
  adminOrMachinePreHandler?: ReturnType<typeof createAdminPreHandler>;
  adminPreHandler?: ReturnType<typeof createAdminPreHandler>;
  commerceService?: AdminCommerceService;
  getExpectedAdminSecret?: () => string;
  isProductionEnvironment?: () => boolean;
} = {}) {
  return async function (fastify: FastifyInstance) {
    const requireAdmin = adminPreHandler ?? createAdminPreHandler();
    const requireAdminOrMachineSecret =
      adminOrMachinePreHandler ??
      createAdminPreHandler({
        allowMachineSecret: true,
        getExpectedMachineSecret: getExpectedAdminSecret,
      });
    const adminRouteOptions = {
      preHandler: requireAdmin,
    };
    const machineRouteOptions = {
      preHandler: requireAdminOrMachineSecret,
    };

    fastify.get(
      apiPaths.adminCommerceCoverageQueue,
      adminRouteOptions,
      async function () {
        return commerceService.listCoverageQueue();
      },
    );

    fastify.get(
      apiPaths.adminCommerceBenchmarkSets,
      adminRouteOptions,
      async function () {
        return commerceService.listBenchmarkSets();
      },
    );

    fastify.post<{ Body: unknown }>(
      apiPaths.adminCommerceBenchmarkSets,
      adminRouteOptions,
      async function (request, reply) {
        try {
          const input = normalizeBenchmarkSetInput(
            validateCommerceBenchmarkSetInput(request.body),
          );
          await ensureCatalogSetExists(input.setId);
          const benchmarkSet = await commerceService.createBenchmarkSet(input);

          return reply.status(201).send(benchmarkSet);
        } catch (error) {
          return reply.status(400).send({
            message: toBadRequestMessage(
              error,
              'Commerce benchmark set input is invalid.',
            ),
          });
        }
      },
    );

    fastify.delete<{ Params: { setId: string } }>(
      `${apiPaths.adminCommerceBenchmarkSets}/:setId`,
      adminRouteOptions,
      async function (request, reply) {
        try {
          await commerceService.deleteBenchmarkSet(
            normalizeCatalogSetId(request.params.setId),
          );

          return reply.status(204).send();
        } catch (error) {
          return reply.status(400).send({
            message: toBadRequestMessage(
              error,
              'Commerce benchmark set could not be removed.',
            ),
          });
        }
      },
    );

    fastify.get(
      apiPaths.adminCommerceMerchants,
      adminRouteOptions,
      async function () {
        return commerceService.listMerchants();
      },
    );

    fastify.post<{ Body: unknown }>(
      apiPaths.adminCommerceMerchants,
      adminRouteOptions,
      async function (request, reply) {
        try {
          const input = validateCommerceMerchantInput(request.body);
          const merchant = await commerceService.createMerchant(input);
          await revalidateMerchantSurfaces({
            merchantSlug: merchant.slug,
          });

          return reply.status(201).send(merchant);
        } catch (error) {
          return reply.status(400).send({
            message: toBadRequestMessage(
              error,
              'Commerce merchant input is invalid.',
            ),
          });
        }
      },
    );

    fastify.put<{ Body: unknown; Params: { merchantId: string } }>(
      `${apiPaths.adminCommerceMerchants}/:merchantId`,
      adminRouteOptions,
      async function (request, reply) {
        try {
          const input = validateCommerceMerchantInput(request.body);

          const merchant = await commerceService.updateMerchant({
            merchantId: request.params.merchantId,
            input,
          });
          await revalidateMerchantSurfaces({
            merchantSlug: merchant.slug,
          });

          return merchant;
        } catch (error) {
          return reply.status(400).send({
            message: toBadRequestMessage(
              error,
              'Commerce merchant input is invalid.',
            ),
          });
        }
      },
    );

    fastify.get(
      apiPaths.adminCommerceOfferSeeds,
      adminRouteOptions,
      async function () {
        return commerceService.listOfferSeeds();
      },
    );

    fastify.get<{
      Querystring: {
        affiliateId?: string;
        confidence?: string;
        status?: string;
      };
    }>(
      apiPaths.adminCommerceAffiliateDiscoveredSets,
      adminRouteOptions,
      async function (request, reply) {
        try {
          return commerceService.listAffiliateDiscoveredSets(
            readAffiliateDiscoveredSetFilters(request.query),
          );
        } catch (error) {
          return reply.status(400).send({
            message: toBadRequestMessage(
              error,
              'Affiliate discovered-set filters are invalid.',
            ),
          });
        }
      },
    );

    fastify.post<{ Body: unknown }>(
      `${apiPaths.adminCommerceAffiliateDiscoveredSets}/import`,
      adminRouteOptions,
      async function (request, reply) {
        try {
          return await commerceService.importDiscoveredSets(
            readAffiliateDiscoveredSetImportBody(request.body),
          );
        } catch (error) {
          return reply.status(400).send({
            message: toBadRequestMessage(
              error,
              'Affiliate discovered sets could not be imported.',
            ),
          });
        }
      },
    );

    fastify.post<{ Body: unknown; Params: { discoveredSetId: string } }>(
      `${apiPaths.adminCommerceAffiliateDiscoveredSets}/:discoveredSetId/status`,
      adminRouteOptions,
      async function (request, reply) {
        try {
          const { status } = readAffiliateDiscoveredSetStatusBody(request.body);

          return await commerceService.updateDiscoveredSetStatus({
            discoveredSetId: request.params.discoveredSetId,
            status,
          });
        } catch (error) {
          return reply.status(400).send({
            message: toBadRequestMessage(
              error,
              'Affiliate discovered set reviewstatus is invalid.',
            ),
          });
        }
      },
    );

    fastify.post<{ Body: unknown }>(
      apiPaths.adminCommerceAlternateFeedImports,
      adminRouteOptions,
      async function (request, reply) {
        try {
          const rows = readAlternateAffiliateFeedRows(request.body);

          return await commerceService.importAlternateFeed(rows);
        } catch (error) {
          return reply.status(400).send({
            message: toBadRequestMessage(
              error,
              'Alternate feed input is invalid.',
            ),
          });
        }
      },
    );

    fastify.post<{ Body: unknown }>(
      apiPaths.adminCommerceProductionSync,
      machineRouteOptions,
      async function (request, reply) {
        if (isProductionEnvironment()) {
          return reply.status(403).send({
            message:
              'Commerce production sync is only available outside production.',
            status: 'error',
          });
        }

        let expectedAdminSecret: string;

        try {
          expectedAdminSecret = getExpectedAdminSecret();
        } catch {
          return reply.status(503).send({
            message: 'Commerce production sync is not configured.',
            status: 'error',
          });
        }

        if (
          !matchesAdminSecret({
            expectedSecret: expectedAdminSecret,
            providedSecret: readAdminSecretHeader(
              request.headers['x-admin-secret'],
            ),
          })
        ) {
          return reply.status(401).send({
            message: 'Admin secret is missing or invalid.',
            status: 'error',
          });
        }

        try {
          return await commerceService.copyProductionCommerce(
            readCommerceProductionSyncBody(request.body),
          );
        } catch (error) {
          return reply.status(400).send({
            message: toBadRequestMessage(
              error,
              'Commerce production sync could not run.',
            ),
            status: 'error',
          });
        }
      },
    );

    fastify.post<{ Body: unknown }>(
      apiPaths.adminCommerceSetRefreshes,
      adminRouteOptions,
      async function (request, reply) {
        try {
          const setId = readRequiredSetId(request.body);
          await ensureCatalogSetExists(setId);

          return await commerceService.refreshSet(setId);
        } catch (error) {
          return reply.status(400).send({
            message: toBadRequestMessage(
              error,
              'Commerce set refresh kon niet starten.',
            ),
          });
        }
      },
    );

    fastify.post<{ Body: unknown }>(
      apiPaths.adminCommerceOfferSeeds,
      adminRouteOptions,
      async function (request, reply) {
        try {
          const input = normalizeOfferSeedInput(
            validateCommerceOfferSeedInput(request.body),
          );
          await ensureCatalogSetExists(input.setId);
          const offerSeed = await commerceService.createOfferSeed(input);
          await revalidateCommerceOfferSeedSurfaces({
            setId: offerSeed.setId,
          });

          return reply.status(201).send(offerSeed);
        } catch (error) {
          return reply.status(400).send({
            message: toBadRequestMessage(
              error,
              'Commerce offer seed input is invalid.',
            ),
          });
        }
      },
    );

    fastify.put<{ Body: unknown; Params: { offerSeedId: string } }>(
      `${apiPaths.adminCommerceOfferSeeds}/:offerSeedId`,
      adminRouteOptions,
      async function (request, reply) {
        try {
          const input = normalizeOfferSeedInput(
            validateCommerceOfferSeedInput(request.body),
          );
          await ensureCatalogSetExists(input.setId);

          const offerSeed = await commerceService.updateOfferSeed({
            offerSeedId: request.params.offerSeedId,
            input,
          });
          await revalidateCommerceOfferSeedSurfaces({
            setId: offerSeed.setId,
          });

          return offerSeed;
        } catch (error) {
          return reply.status(400).send({
            message: toBadRequestMessage(
              error,
              'Commerce offer seed input is invalid.',
            ),
          });
        }
      },
    );
  };
}

export default createAdminCommerceRoutes();
