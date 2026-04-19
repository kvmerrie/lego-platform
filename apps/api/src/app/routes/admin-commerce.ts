import { refreshCommerceSetOfferSeeds } from '@lego-platform/api/data-access-server';
import {
  findCatalogSetSummaryByIdWithOverlay,
  listCanonicalCatalogSets,
} from '@lego-platform/catalog/data-access-server';
import {
  createCommerceBenchmarkSet,
  createCommerceMerchant,
  createCommerceOfferSeed,
  deleteCommerceBenchmarkSet,
  listCommerceBenchmarkSets,
  listCommerceMerchants,
  listCommerceOfferSeeds,
  updateCommerceMerchant,
  updateCommerceOfferSeed,
} from '@lego-platform/commerce/data-access-server';
import {
  type CommerceBenchmarkSet,
  type CommerceBenchmarkSetInput,
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
import { apiPaths } from '@lego-platform/shared/config';
import type { FastifyInstance } from 'fastify';

export interface AdminCommerceService {
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

  return setId.trim();
}

async function ensureCatalogSetExists(setId: string): Promise<void> {
  const catalogSet = await findCatalogSetSummaryByIdWithOverlay({
    setId,
  });

  if (!catalogSet) {
    throw new Error(
      `Set ${setId} is not part of the Brickhunt catalog, so it cannot receive commerce seeds yet.`,
    );
  }
}

export function createAdminCommerceRoutes({
  commerceService = createAdminCommerceService(),
}: {
  commerceService?: AdminCommerceService;
} = {}) {
  return async function (fastify: FastifyInstance) {
    fastify.get(apiPaths.adminCommerceCoverageQueue, async function () {
      return commerceService.listCoverageQueue();
    });

    fastify.get(apiPaths.adminCommerceBenchmarkSets, async function () {
      return commerceService.listBenchmarkSets();
    });

    fastify.post<{ Body: unknown }>(
      apiPaths.adminCommerceBenchmarkSets,
      async function (request, reply) {
        try {
          const input = validateCommerceBenchmarkSetInput(request.body);
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
      async function (request, reply) {
        try {
          await commerceService.deleteBenchmarkSet(request.params.setId);

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

    fastify.get(apiPaths.adminCommerceMerchants, async function () {
      return commerceService.listMerchants();
    });

    fastify.post<{ Body: unknown }>(
      apiPaths.adminCommerceMerchants,
      async function (request, reply) {
        try {
          const input = validateCommerceMerchantInput(request.body);
          const merchant = await commerceService.createMerchant(input);

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
      async function (request, reply) {
        try {
          const input = validateCommerceMerchantInput(request.body);

          return commerceService.updateMerchant({
            merchantId: request.params.merchantId,
            input,
          });
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

    fastify.get(apiPaths.adminCommerceOfferSeeds, async function () {
      return commerceService.listOfferSeeds();
    });

    fastify.post<{ Body: unknown }>(
      apiPaths.adminCommerceSetRefreshes,
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
      async function (request, reply) {
        try {
          const input = validateCommerceOfferSeedInput(request.body);
          await ensureCatalogSetExists(input.setId);
          const offerSeed = await commerceService.createOfferSeed(input);

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
      async function (request, reply) {
        try {
          const input = validateCommerceOfferSeedInput(request.body);
          await ensureCatalogSetExists(input.setId);

          return commerceService.updateOfferSeed({
            offerSeedId: request.params.offerSeedId,
            input,
          });
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
