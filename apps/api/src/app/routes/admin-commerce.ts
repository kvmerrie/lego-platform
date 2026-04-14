import { listCatalogSetSummaries } from '@lego-platform/catalog/data-access';
import {
  createCommerceMerchant,
  createCommerceOfferSeed,
  listCommerceMerchants,
  listCommerceOfferSeeds,
  updateCommerceMerchant,
  updateCommerceOfferSeed,
} from '@lego-platform/commerce/data-access-server';
import {
  type CommerceMerchant,
  type CommerceMerchantInput,
  type CommerceOfferSeed,
  type CommerceOfferSeedInput,
  validateCommerceMerchantInput,
  validateCommerceOfferSeedInput,
} from '@lego-platform/commerce/util';
import { apiPaths } from '@lego-platform/shared/config';
import type { FastifyInstance } from 'fastify';

export interface AdminCommerceService {
  createMerchant(input: CommerceMerchantInput): Promise<CommerceMerchant>;
  createOfferSeed(input: CommerceOfferSeedInput): Promise<CommerceOfferSeed>;
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

function ensureCatalogSetExists(setId: string): void {
  const catalogSetExists = listCatalogSetSummaries().some(
    (catalogSetSummary) => catalogSetSummary.id === setId,
  );

  if (!catalogSetExists) {
    throw new Error(
      `Set ${setId} is not part of the synced Brickhunt catalog, so it cannot receive commerce seeds yet.`,
    );
  }
}

export function createAdminCommerceRoutes({
  commerceService = createAdminCommerceService(),
}: {
  commerceService?: AdminCommerceService;
} = {}) {
  return async function (fastify: FastifyInstance) {
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
      apiPaths.adminCommerceOfferSeeds,
      async function (request, reply) {
        try {
          const input = validateCommerceOfferSeedInput(request.body);
          ensureCatalogSetExists(input.setId);
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
          ensureCatalogSetExists(input.setId);

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
