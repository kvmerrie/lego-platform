import {
  createCatalogSet,
  listCanonicalCatalogSets,
  searchCatalogMissingSets,
} from '@lego-platform/catalog/data-access-server';
import {
  type CatalogBulkOnboardingRunReadResult,
  type CatalogBulkOnboardingStartResult,
  getCatalogBulkOnboardingRun,
  getLatestCatalogBulkOnboardingRun,
  startCatalogBulkOnboardingRun,
} from '@lego-platform/api/data-access-server';
import {
  type CatalogExternalSetSearchResult,
  type CatalogSet,
} from '@lego-platform/catalog/util';
import { apiPaths } from '@lego-platform/shared/config';
import type { FastifyInstance } from 'fastify';

export interface AdminCatalogSetSummary {
  collectorAngle?: string;
  createdAt: string;
  id: string;
  imageUrl?: string;
  name: string;
  pieces: number;
  releaseYear: number;
  slug: string;
  theme: string;
  updatedAt: string;
}

export interface AdminCatalogService {
  getBulkOnboardingRun(
    runId: string,
  ): Promise<CatalogBulkOnboardingRunReadResult>;
  getLatestBulkOnboardingRun(): Promise<CatalogBulkOnboardingRunReadResult>;
  startBulkOnboarding(input: {
    setIds: readonly string[];
  }): Promise<CatalogBulkOnboardingStartResult>;
  createSet(input: CatalogExternalSetSearchResult): Promise<CatalogSet>;
  listCatalogSets(): Promise<AdminCatalogSetSummary[]>;
  searchMissingSets(query: string): Promise<CatalogExternalSetSearchResult[]>;
}

function createAdminCatalogService(): AdminCatalogService {
  return {
    getBulkOnboardingRun: async (runId) =>
      getCatalogBulkOnboardingRun({
        options: {
          workspaceRoot: process.cwd(),
        },
        runId,
      }),
    getLatestBulkOnboardingRun: async () =>
      getLatestCatalogBulkOnboardingRun({
        options: {
          workspaceRoot: process.cwd(),
        },
      }),
    startBulkOnboarding: async (input) =>
      startCatalogBulkOnboardingRun({
        options: {
          setIds: input.setIds,
          workspaceRoot: process.cwd(),
        },
      }),
    createSet: (input) => createCatalogSet({ input }),
    listCatalogSets: async () =>
      (await listCanonicalCatalogSets()).map((catalogSet) => ({
        createdAt: catalogSet.createdAt,
        id: catalogSet.setId,
        imageUrl: catalogSet.imageUrl,
        name: catalogSet.name,
        pieces: catalogSet.pieceCount,
        releaseYear: catalogSet.releaseYear,
        slug: catalogSet.slug,
        theme: catalogSet.primaryTheme,
        updatedAt: catalogSet.updatedAt,
      })),
    searchMissingSets: (query) => searchCatalogMissingSets({ query }),
  };
}

function toBadRequestMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof Error ? error.message : fallbackMessage;
}

function readSearchQuery(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Zoekquery ontbreekt.');
  }

  const query = (value as { query?: unknown }).query;

  if (typeof query !== 'string' || !query.trim()) {
    throw new Error('Zoekquery ontbreekt.');
  }

  return query.trim();
}

function readBulkOnboardingInput(value: unknown): { setIds: string[] } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Bulk onboarding input ontbreekt.');
  }

  const setIds = (value as { setIds?: unknown }).setIds;

  if (!Array.isArray(setIds)) {
    throw new Error('Bulk onboarding input mist een setIds-lijst.');
  }

  const normalizedSetIds = setIds
    .map((setId) => (typeof setId === 'string' ? setId.trim() : ''))
    .filter(Boolean);

  if (normalizedSetIds.length === 0) {
    throw new Error('Bulk onboarding input mist geldige setIds.');
  }

  return {
    setIds: normalizedSetIds,
  };
}

function readRunId(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Run id ontbreekt.');
  }

  const runId = (value as { runId?: unknown }).runId;

  if (typeof runId !== 'string' || !runId.trim()) {
    throw new Error('Run id ontbreekt.');
  }

  return runId.trim();
}

function readCatalogSetInput(value: unknown): CatalogExternalSetSearchResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Set-input ontbreekt.');
  }

  const record = value as Record<string, unknown>;
  const readString = (key: string) => {
    const fieldValue = record[key];

    if (typeof fieldValue !== 'string' || !fieldValue.trim()) {
      throw new Error(`Set-input mist een geldige ${key}.`);
    }

    return fieldValue.trim();
  };
  const readPositiveInteger = (key: string) => {
    const fieldValue = record[key];

    if (
      typeof fieldValue !== 'number' ||
      !Number.isInteger(fieldValue) ||
      fieldValue <= 0
    ) {
      throw new Error(`Set-input mist een geldige ${key}.`);
    }

    return fieldValue;
  };
  const imageUrl = record['imageUrl'];

  return {
    ...(typeof imageUrl === 'string' && imageUrl.trim()
      ? {
          imageUrl: imageUrl.trim(),
        }
      : {}),
    name: readString('name'),
    pieces: readPositiveInteger('pieces'),
    releaseYear: readPositiveInteger('releaseYear'),
    setId: readString('setId'),
    slug: readString('slug'),
    source:
      readString('source') === 'rebrickable' ? 'rebrickable' : 'rebrickable',
    sourceSetNumber: readString('sourceSetNumber'),
    theme: readString('theme'),
  };
}

export function createAdminCatalogRoutes({
  catalogService = createAdminCatalogService(),
}: {
  catalogService?: AdminCatalogService;
} = {}) {
  return async function (fastify: FastifyInstance) {
    fastify.get(apiPaths.adminCatalogSets, async function () {
      return catalogService.listCatalogSets();
    });

    fastify.get<{ Querystring: { query?: string } }>(
      apiPaths.adminCatalogSetSearch,
      async function (request, reply) {
        try {
          const query = readSearchQuery(request.query);

          return catalogService.searchMissingSets(query);
        } catch (error) {
          return reply.status(400).send({
            message: toBadRequestMessage(
              error,
              'Catalog search input is invalid.',
            ),
          });
        }
      },
    );

    fastify.get(
      `${apiPaths.adminCatalogBulkOnboardingRuns}/latest`,
      async function (_request, reply) {
        const latestRunResult =
          await catalogService.getLatestBulkOnboardingRun();

        if (!latestRunResult.run) {
          return reply.status(404).send({
            message: 'Er is nog geen bulk onboarding run gestart.',
          });
        }

        return latestRunResult;
      },
    );

    fastify.get<{ Params: { runId?: string } }>(
      `${apiPaths.adminCatalogBulkOnboardingRuns}/:runId`,
      async function (request, reply) {
        try {
          const runId = readRunId(request.params);
          const runResult = await catalogService.getBulkOnboardingRun(runId);

          if (!runResult.run) {
            return reply.status(404).send({
              message: 'Bulk onboarding run niet gevonden.',
            });
          }

          return runResult;
        } catch (error) {
          return reply.status(400).send({
            message: toBadRequestMessage(
              error,
              'Bulk onboarding run input is invalid.',
            ),
          });
        }
      },
    );

    fastify.post<{ Body: unknown }>(
      apiPaths.adminCatalogSets,
      async function (request, reply) {
        try {
          const input = readCatalogSetInput(request.body);
          const catalogSet = await catalogService.createSet(input);

          return reply.status(201).send(catalogSet);
        } catch (error) {
          return reply.status(400).send({
            message: toBadRequestMessage(
              error,
              'Catalog set input is invalid.',
            ),
          });
        }
      },
    );

    fastify.post<{ Body: unknown }>(
      apiPaths.adminCatalogBulkOnboardingRuns,
      async function (request, reply) {
        try {
          const input = readBulkOnboardingInput(request.body);
          const result = await catalogService.startBulkOnboarding(input);

          return reply.status(202).send(result);
        } catch (error) {
          return reply.status(400).send({
            message: toBadRequestMessage(
              error,
              'Bulk onboarding input is invalid.',
            ),
          });
        }
      },
    );
  };
}

export default createAdminCatalogRoutes();
