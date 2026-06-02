import {
  logAdminOperation,
  type AdminOperationLogInput,
} from '@lego-platform/api/data-access-server';
import {
  adminCacheRevalidationEnvKeys,
  adminPromotionEnvKeys,
  apiPaths,
  batchRevalidationPayloads,
  normalizeRevalidationPaths,
  normalizeRevalidationTags,
  productEmailEnvKeys,
  publicWebRevalidationEnvKeys,
  validateRevalidationReason,
} from '@lego-platform/shared/config';
import type { FastifyInstance } from 'fastify';
import {
  authorizeAdminRequest,
  readAdminSecretHeader,
  type AdminAuthorizationActor,
} from '../lib/admin-authorization';

const REVALIDATION_TIMEOUT_MS = 10_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const RESPONSE_BODY_EXCERPT_LIMIT = 500;

interface AdminCacheRevalidationRequestBody {
  paths?: unknown;
  reason?: unknown;
  tags?: unknown;
}

interface AdminCacheRevalidationBatchResult {
  batchIndex: number;
  pathCount: number;
  paths: readonly string[];
  responseBody?: unknown;
  status: number;
  success: boolean;
  tagCount: number;
  tags: readonly string[];
  warning?: string;
}

interface AdminCacheRevalidationAggregateResult {
  durationMs: number;
  pathCount: number;
  paths: readonly string[];
  reason: string;
  results: readonly AdminCacheRevalidationBatchResult[];
  status: 'partial_failure' | 'success';
  tagCount: number;
  tags: readonly string[];
  warnings: readonly string[];
}

type FetchImpl = typeof fetch;
type LogAdminOperationFn = typeof logAdminOperation;

const rateLimitState = new Map<string, number[]>();

type AdminCacheRevalidationActor = AdminAuthorizationActor;

function readStringArray(value: unknown, fieldName: string): string[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array.`);
  }

  return value.map((item) => {
    if (typeof item !== 'string') {
      throw new Error(`${fieldName} must contain only strings.`);
    }

    return item;
  });
}

function readExpectedAdminCacheRevalidationSecret(): string | undefined {
  return (
    process.env[adminCacheRevalidationEnvKeys.secret]?.trim() ||
    process.env[adminPromotionEnvKeys.secret]?.trim() ||
    undefined
  );
}

function getRateLimitKey({
  actor,
  ip,
}: {
  actor: AdminCacheRevalidationActor;
  ip: string;
}): string {
  return actor.kind === 'bearer_session'
    ? (actor.email ?? actor.id)
    : `${actor.id}:${ip}`;
}

function isRateLimited({
  key,
  nowMs = Date.now(),
}: {
  key: string;
  nowMs?: number;
}): boolean {
  const recentRequests = (rateLimitState.get(key) ?? []).filter(
    (timestamp) => nowMs - timestamp < RATE_LIMIT_WINDOW_MS,
  );

  if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitState.set(key, recentRequests);
    return true;
  }

  recentRequests.push(nowMs);
  rateLimitState.set(key, recentRequests);
  return false;
}

function buildRevalidationUrl(): URL {
  const webBaseUrl = process.env[productEmailEnvKeys.webBaseUrl]?.trim();

  if (!webBaseUrl) {
    throw new Error(`Missing ${productEmailEnvKeys.webBaseUrl}.`);
  }

  return new URL('/api/revalidate', webBaseUrl);
}

async function readSafeResponseBody(response: Response): Promise<unknown> {
  const bodyText = await response.text();

  if (!bodyText) {
    return undefined;
  }

  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    return bodyText.slice(0, RESPONSE_BODY_EXCERPT_LIMIT);
  }
}

async function postRevalidationBatch({
  batchIndex,
  fetchImpl,
  payload,
  targetUrl,
}: {
  batchIndex: number;
  fetchImpl: FetchImpl;
  payload: ReturnType<typeof batchRevalidationPayloads>[number];
  targetUrl: URL;
}): Promise<AdminCacheRevalidationBatchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REVALIDATION_TIMEOUT_MS);

  try {
    const response = await fetchImpl(targetUrl.toString(), {
      body: JSON.stringify(payload),
      headers: {
        'content-type': 'application/json',
        'x-revalidate-secret':
          process.env[publicWebRevalidationEnvKeys.secret] ?? '',
      },
      method: 'POST',
      signal: controller.signal,
    });
    const responseBody = await readSafeResponseBody(response);

    return {
      batchIndex,
      pathCount: payload.paths.length,
      paths: payload.paths,
      responseBody,
      status: response.status,
      success: response.ok,
      tagCount: payload.tags.length,
      tags: payload.tags,
      ...(response.ok
        ? {}
        : {
            warning: `Public web revalidation batch ${batchIndex + 1} failed with status ${response.status}.`,
          }),
    };
  } catch (error) {
    return {
      batchIndex,
      pathCount: payload.paths.length,
      paths: payload.paths,
      status: 0,
      success: false,
      tagCount: payload.tags.length,
      tags: payload.tags,
      warning:
        error instanceof Error
          ? `Public web revalidation batch ${batchIndex + 1} failed: ${error.message}`
          : `Public web revalidation batch ${batchIndex + 1} failed.`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function auditAdminCacheRevalidation({
  aggregateResult,
  actor,
  auditLogger,
  responseStatus,
}: {
  aggregateResult: AdminCacheRevalidationAggregateResult;
  actor: AdminCacheRevalidationActor;
  auditLogger: LogAdminOperationFn;
  responseStatus: number;
}): Promise<void> {
  const input: AdminOperationLogInput = {
    actorEmail: actor.email,
    actorId: actor.id,
    durationMs: aggregateResult.durationMs,
    metadata: {
      authKind: actor.kind,
      batchCount: aggregateResult.results.length,
      warnings: aggregateResult.warnings,
    },
    operationType: 'cache_revalidation',
    paths: aggregateResult.paths,
    reason: aggregateResult.reason,
    responseStatus,
    success: aggregateResult.status === 'success',
    tags: aggregateResult.tags,
  };

  await auditLogger({ input });
}

export function createAdminCacheRevalidationRoutes({
  auditLogger = logAdminOperation,
  fetchImpl = fetch,
}: {
  auditLogger?: LogAdminOperationFn;
  fetchImpl?: FetchImpl;
} = {}) {
  return async function (fastify: FastifyInstance) {
    fastify.post<{ Body: AdminCacheRevalidationRequestBody }>(
      apiPaths.adminCacheRevalidation,
      async function (request, reply) {
        const requestPrincipal = request.requestPrincipal;
        const authorization = authorizeAdminRequest({
          allowMachineSecret: true,
          getExpectedMachineSecret: readExpectedAdminCacheRevalidationSecret,
          providedMachineSecret: readAdminSecretHeader(
            request.headers['x-admin-secret'],
          ),
          requestPrincipal,
        });

        if (authorization.authorized === false) {
          return reply.status(authorization.statusCode).send({
            message: authorization.message,
            status: 'error',
          });
        }

        const actor = authorization.actor;

        if (
          isRateLimited({
            key: getRateLimitKey({
              actor,
              ip: request.ip,
            }),
          })
        ) {
          return reply.status(429).send({
            message: 'Too many cache revalidation requests.',
            status: 'error',
          });
        }

        if (!process.env[publicWebRevalidationEnvKeys.secret]) {
          return reply.status(503).send({
            message: `Public web revalidation is not configured: missing ${publicWebRevalidationEnvKeys.secret}.`,
            status: 'error',
          });
        }

        let pathsInput: string[];
        let tagsInput: string[];

        try {
          pathsInput = readStringArray(request.body?.paths, 'paths');
          tagsInput = readStringArray(request.body?.tags, 'tags');
        } catch (error) {
          return reply.status(400).send({
            message:
              error instanceof Error
                ? error.message
                : 'Invalid cache revalidation payload.',
            status: 'error',
          });
        }

        const normalizedPaths = normalizeRevalidationPaths(pathsInput);
        const normalizedTags = normalizeRevalidationTags(tagsInput);
        const reasonValidation = validateRevalidationReason(
          request.body?.reason,
        );

        if (reasonValidation.error) {
          return reply.status(400).send({
            message: reasonValidation.error,
            status: 'error',
          });
        }

        if (
          normalizedPaths.invalidValues.length > 0 ||
          normalizedTags.invalidValues.length > 0
        ) {
          return reply.status(400).send({
            invalidPaths: normalizedPaths.invalidValues,
            invalidTags: normalizedTags.invalidValues,
            message: 'Invalid cache revalidation targets.',
            status: 'error',
          });
        }

        if (
          normalizedPaths.values.length === 0 &&
          normalizedTags.values.length === 0
        ) {
          return reply.status(400).send({
            message: 'Provide at least one path or tag to revalidate.',
            status: 'error',
          });
        }

        let targetUrl: URL;

        try {
          targetUrl = buildRevalidationUrl();
        } catch (error) {
          request.log.error(
            {
              errorName: error instanceof Error ? error.name : typeof error,
              route: apiPaths.adminCacheRevalidation,
            },
            'Admin cache revalidation target is not configured.',
          );

          return reply.status(503).send({
            message: 'Public web revalidation target is not configured.',
            status: 'error',
          });
        }

        const reason = reasonValidation.reason ?? '';
        const batches = batchRevalidationPayloads({
          paths: normalizedPaths.values,
          reason,
          tags: normalizedTags.values,
        });
        const startedAt = Date.now();

        request.log.info(
          {
            batchCount: batches.length,
            pathCount: normalizedPaths.values.length,
            reason,
            route: apiPaths.adminCacheRevalidation,
            tagCount: normalizedTags.values.length,
            targetHost: targetUrl.host,
            targetPathname: targetUrl.pathname,
          },
          'Admin cache revalidation requested.',
        );

        const results: AdminCacheRevalidationBatchResult[] = [];

        for (const [batchIndex, payload] of batches.entries()) {
          results.push(
            await postRevalidationBatch({
              batchIndex,
              fetchImpl,
              payload,
              targetUrl,
            }),
          );
        }

        const warnings = [
          ...normalizedPaths.warnings,
          ...normalizedTags.warnings,
          ...results
            .map((result) => result.warning)
            .filter((warning): warning is string => Boolean(warning)),
        ];
        const hasFailures = results.some((result) => !result.success);
        const aggregateResult: AdminCacheRevalidationAggregateResult = {
          durationMs: Date.now() - startedAt,
          pathCount: normalizedPaths.values.length,
          paths: normalizedPaths.values,
          reason,
          results,
          status: hasFailures ? 'partial_failure' : 'success',
          tagCount: normalizedTags.values.length,
          tags: normalizedTags.values,
          warnings,
        };
        const responseStatus = hasFailures ? 207 : 200;

        try {
          await auditAdminCacheRevalidation({
            aggregateResult,
            actor,
            auditLogger,
            responseStatus,
          });
        } catch (error) {
          request.log.error(
            {
              errorName: error instanceof Error ? error.name : typeof error,
              route: apiPaths.adminCacheRevalidation,
            },
            'Admin cache revalidation audit logging failed.',
          );

          return reply.status(500).send({
            message: 'Cache revalidation audit logging failed.',
            status: 'error',
          });
        }

        request.log.info(
          {
            batchCount: results.length,
            durationMs: aggregateResult.durationMs,
            failedBatchCount: results.filter((result) => !result.success)
              .length,
            pathCount: aggregateResult.pathCount,
            reason,
            route: apiPaths.adminCacheRevalidation,
            status: aggregateResult.status,
            tagCount: aggregateResult.tagCount,
          },
          'Admin cache revalidation completed.',
        );

        return reply.status(responseStatus).send(aggregateResult);
      },
    );
  };
}

export default createAdminCacheRevalidationRoutes();
