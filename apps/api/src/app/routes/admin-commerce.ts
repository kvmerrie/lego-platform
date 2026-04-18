import { listCatalogSetSummaries } from '@lego-platform/catalog/data-access';
import { refreshCommerceSetOfferSeeds } from '@lego-platform/api/data-access-server';
import {
  findCatalogSetSummaryByIdWithOverlay,
  listCatalogOverlaySets,
} from '@lego-platform/catalog/data-access-server';
import {
  approveCommerceDiscoveryCandidate,
  createCommerceOfferSeedFromDiscoveryCandidate,
  createCommerceBenchmarkSet,
  createCommerceMerchant,
  createCommerceOfferSeed,
  deleteCommerceBenchmarkSet,
  listCommerceDiscoveryCandidates,
  listCommerceDiscoveryRuns,
  listCommerceBenchmarkSets,
  listCommerceMerchants,
  listCommerceOfferSeeds,
  rejectCommerceDiscoveryCandidate,
  runCommerceMerchantDiscovery,
  updateCommerceMerchant,
  updateCommerceOfferSeed,
} from '@lego-platform/commerce/data-access-server';
import {
  type CommerceDiscoveryApprovalResult,
  type CommerceDiscoveryCandidate,
  type CommerceDiscoveryRun,
  type CommerceDiscoveryRunInput,
  type CommerceBenchmarkSet,
  type CommerceBenchmarkSetInput,
  type CommerceCoverageQueueRow,
  type CommerceMerchant,
  type CommerceMerchantInput,
  type CommerceOfferSeed,
  type CommerceOfferSeedInput,
  type CommerceSetRefreshResult,
  buildCommerceCoverageQueueRows,
  validateCommerceDiscoveryRunInput,
  validateCommerceBenchmarkSetInput,
  validateCommerceMerchantInput,
  validateCommerceOfferSeedInput,
} from '@lego-platform/commerce/util';
import { apiPaths } from '@lego-platform/shared/config';
import type { FastifyInstance } from 'fastify';

export interface AdminCommerceService {
  approveDiscoveryCandidate(
    candidateId: string,
  ): Promise<CommerceDiscoveryApprovalResult>;
  createBenchmarkSet(
    input: CommerceBenchmarkSetInput,
  ): Promise<CommerceBenchmarkSet>;
  listCoverageQueue(): Promise<CommerceCoverageQueueRow[]>;
  refreshSet(setId: string): Promise<CommerceSetRefreshResult>;
  createMerchant(input: CommerceMerchantInput): Promise<CommerceMerchant>;
  createOfferSeed(input: {
    discoveryCandidateId?: string;
    input: CommerceOfferSeedInput;
  }): Promise<CommerceOfferSeed>;
  deleteBenchmarkSet(setId: string): Promise<void>;
  listDiscoveryCandidates(): Promise<CommerceDiscoveryCandidate[]>;
  listDiscoveryRuns(): Promise<CommerceDiscoveryRun[]>;
  listBenchmarkSets(): Promise<CommerceBenchmarkSet[]>;
  listMerchants(): Promise<CommerceMerchant[]>;
  listOfferSeeds(): Promise<CommerceOfferSeed[]>;
  rejectDiscoveryCandidate(
    candidateId: string,
  ): Promise<CommerceDiscoveryCandidate>;
  runDiscovery(input: CommerceDiscoveryRunInput): Promise<{
    candidates: CommerceDiscoveryCandidate[];
    run: CommerceDiscoveryRun;
  }>;
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
    listDiscoveryRuns: () => listCommerceDiscoveryRuns(),
    listDiscoveryCandidates: () => listCommerceDiscoveryCandidates(),
    runDiscovery: (input) => runCommerceMerchantDiscovery({ input }),
    approveDiscoveryCandidate: (candidateId) =>
      approveCommerceDiscoveryCandidate({ candidateId }),
    rejectDiscoveryCandidate: (candidateId) =>
      rejectCommerceDiscoveryCandidate({ candidateId }),
    listBenchmarkSets: () => listCommerceBenchmarkSets(),
    createBenchmarkSet: (input) => createCommerceBenchmarkSet({ input }),
    deleteBenchmarkSet: (setId) => deleteCommerceBenchmarkSet({ setId }),
    listCoverageQueue: async () => {
      const snapshotSummaries = listCatalogSetSummaries();
      const [
        benchmarkSets,
        discoveryCandidates,
        discoveryRuns,
        merchants,
        offerSeeds,
        overlaySets,
      ] = await Promise.all([
        listCommerceBenchmarkSets(),
        listCommerceDiscoveryCandidates(),
        listCommerceDiscoveryRuns(),
        listCommerceMerchants(),
        listCommerceOfferSeeds(),
        listCatalogOverlaySets(),
      ]);
      const snapshotSetIds = new Set(
        snapshotSummaries.map((catalogSetSummary) => catalogSetSummary.id),
      );
      const catalogSets = [
        ...snapshotSummaries.map((catalogSetSummary) => ({
          id: catalogSetSummary.id,
          name: catalogSetSummary.name,
          theme: catalogSetSummary.theme,
          slug: catalogSetSummary.slug,
          source: 'snapshot' as const,
        })),
        ...overlaySets
          .filter((overlaySet) => !snapshotSetIds.has(overlaySet.setId))
          .map((overlaySet) => ({
            id: overlaySet.setId,
            name: overlaySet.name,
            theme: overlaySet.theme,
            slug: overlaySet.slug,
            source: 'overlay' as const,
            createdAt: overlaySet.createdAt,
          })),
      ];

      return buildCommerceCoverageQueueRows({
        benchmarkSets,
        catalogSets,
        discoveryCandidates,
        discoveryRuns,
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
    createOfferSeed: ({ discoveryCandidateId, input }) =>
      discoveryCandidateId
        ? createCommerceOfferSeedFromDiscoveryCandidate({
            candidateId: discoveryCandidateId,
            input,
          })
        : createCommerceOfferSeed({ input }),
    updateOfferSeed: ({ input, offerSeedId }) =>
      updateCommerceOfferSeed({ input, offerSeedId }),
  };
}

function toBadRequestMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof Error ? error.message : fallbackMessage;
}

function readOptionalDiscoveryCandidateId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const candidateId = (value as { discoveryCandidateId?: unknown })
    .discoveryCandidateId;

  return typeof candidateId === 'string' && candidateId.trim()
    ? candidateId.trim()
    : undefined;
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

    fastify.get(apiPaths.adminCommerceDiscoveryRuns, async function () {
      return commerceService.listDiscoveryRuns();
    });

    fastify.get(apiPaths.adminCommerceDiscoveryCandidates, async function () {
      return commerceService.listDiscoveryCandidates();
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
      apiPaths.adminCommerceDiscoveryRuns,
      async function (request, reply) {
        try {
          const input = validateCommerceDiscoveryRunInput(request.body);
          await ensureCatalogSetExists(input.setId);

          const result = await commerceService.runDiscovery(input);

          return reply.status(201).send(result);
        } catch (error) {
          return reply.status(400).send({
            message: toBadRequestMessage(
              error,
              'Commerce discovery run input is invalid.',
            ),
          });
        }
      },
    );

    fastify.post<{ Params: { candidateId: string } }>(
      `${apiPaths.adminCommerceDiscoveryCandidates}/:candidateId/approve`,
      async function (request, reply) {
        try {
          return await commerceService.approveDiscoveryCandidate(
            request.params.candidateId,
          );
        } catch (error) {
          return reply.status(400).send({
            message: toBadRequestMessage(
              error,
              'Commerce discovery candidate could not be approved.',
            ),
          });
        }
      },
    );

    fastify.post<{ Params: { candidateId: string } }>(
      `${apiPaths.adminCommerceDiscoveryCandidates}/:candidateId/reject`,
      async function (request, reply) {
        try {
          return await commerceService.rejectDiscoveryCandidate(
            request.params.candidateId,
          );
        } catch (error) {
          return reply.status(400).send({
            message: toBadRequestMessage(
              error,
              'Commerce discovery candidate could not be rejected.',
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
          const discoveryCandidateId = readOptionalDiscoveryCandidateId(
            request.body,
          );
          await ensureCatalogSetExists(input.setId);
          const offerSeed = await commerceService.createOfferSeed({
            input,
            discoveryCandidateId,
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
