import {
  createCatalogSet,
  listCatalogSetSummariesWithOverlay,
  searchCatalogMissingSets,
} from '@lego-platform/catalog/data-access-server';
import {
  type CatalogExternalSetSearchResult,
  type CatalogSet,
  type CatalogSetSummary,
} from '@lego-platform/catalog/util';
import { apiPaths } from '@lego-platform/shared/config';
import type { FastifyInstance } from 'fastify';

export interface AdminCatalogService {
  createSet(input: CatalogExternalSetSearchResult): Promise<CatalogSet>;
  listCatalogSets(): Promise<CatalogSetSummary[]>;
  searchMissingSets(query: string): Promise<CatalogExternalSetSearchResult[]>;
}

function createAdminCatalogService(): AdminCatalogService {
  return {
    createSet: (input) => createCatalogSet({ input }),
    listCatalogSets: () => listCatalogSetSummariesWithOverlay(),
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
  };
}

export default createAdminCatalogRoutes();
