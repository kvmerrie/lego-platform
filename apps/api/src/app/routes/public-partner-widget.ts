import {
  getCanonicalCatalogSetById as getCanonicalCatalogSetByIdServer,
  listCatalogCurrentOfferSummariesBySetIds as listCatalogCurrentOfferSummariesBySetIdsServer,
  type CatalogCurrentOfferSummaryRecord,
} from '@lego-platform/catalog/data-access-server';
import type { CatalogCanonicalSet } from '@lego-platform/catalog/util';
import { listCommerceMerchants as listCommerceMerchantsServer } from '@lego-platform/commerce/data-access-server';
import {
  getAllowedPartnerWidgetRequestOrigin,
  getCommerceMerchantPartnerWidgetConfig,
  getCommercePartnerWidgetRequestOrigin,
  getCommercePartnerWidgetRanking,
  isCommercePartnerWidgetDevPreviewRequested,
  isCommercePartnerWidgetInternalRuntime,
  isCommercePartnerWidgetPlaygroundOriginBypassAllowed,
  isCommercePartnerWidgetPlaygroundOriginRequest,
  isAllowedCommercePartnerWidgetMode,
  isAllowedPartnerWidgetRequest,
  isCommercePartnerWidgetMode,
  normalizeCommerceSlug,
  shouldExposeCommercePartnerWidgetPlaygroundBypass,
  shouldRenderCommercePartnerWidgetMode,
  type CommerceMerchant,
  type CommerceMerchantPartnerWidgetConfig,
  type CommercePartnerWidgetMode,
} from '@lego-platform/commerce/util';
import {
  buildSetDetailPath,
  publicWebBaseUrls,
} from '@lego-platform/shared/config';
import { normalizeCatalogSetId } from '@lego-platform/shared/util';
import type { FastifyInstance, FastifyReply } from 'fastify';

export const partnerWidgetApiPath = '/api/public/partner-widget';

const partnerWidgetSuccessCacheControl =
  'public, max-age=300, s-maxage=600, stale-while-revalidate=600';
const partnerWidgetShortCacheControl =
  'public, max-age=60, s-maxage=300, stale-while-revalidate=300';
const partnerWidgetVaryHeader = 'Origin, Referer';
const partnerWidgetDevPreviewHeader = 'x-brickhunt-dev-widget-preview';

export interface PublicPartnerWidgetResponse {
  brickhuntUrl: string;
  isCheapest: boolean;
  isTop3: boolean;
  lastUpdated: string;
  lowestPrice: number;
  merchantName: string;
  merchantPrice: number;
  merchantSlug: string;
  playgroundBypass?: true;
  rank: number;
  setId: string;
  setTitle: string;
  status: 'winner' | 'top3' | 'checked';
  totalMerchantsCompared: number;
}

export interface PublicPartnerWidgetRouteDependencies {
  getCatalogSetById?: (
    setId: string,
  ) => Promise<
    Pick<CatalogCanonicalSet, 'name' | 'setId' | 'slug'> | undefined
  >;
  isDevPreviewRuntime?: () => boolean;
  getPartnerWidgetConfig?: (
    merchantSlug: string,
  ) => CommerceMerchantPartnerWidgetConfig | undefined;
  isPlaygroundBypassRuntime?: () => boolean;
  shouldExposePlaygroundBypass?: () => boolean;
  listCatalogCurrentOfferSummariesBySetIds?: (
    setIds: readonly string[],
  ) => Promise<CatalogCurrentOfferSummaryRecord[]>;
  listCommerceMerchants?: () => Promise<CommerceMerchant[]>;
}

function setPartnerWidgetCacheHeaders(
  reply: FastifyReply,
  cacheControl = partnerWidgetShortCacheControl,
) {
  reply.header('cache-control', cacheControl);
  reply.header('vary', partnerWidgetVaryHeader);
}

function setPartnerWidgetCorsHeaders(
  reply: FastifyReply,
  allowedRequestOrigin: string,
) {
  reply.header('access-control-allow-origin', allowedRequestOrigin);
  reply.header('access-control-expose-headers', partnerWidgetDevPreviewHeader);
}

function setPartnerWidgetDevPreviewHeaders(reply: FastifyReply) {
  reply.header(partnerWidgetDevPreviewHeader, '1');
}

function buildBrickhuntSetUrl(slug: string): string {
  return `${publicWebBaseUrls.production}${buildSetDetailPath(slug)}`;
}

function parsePartnerWidgetMode(
  mode?: string,
): CommercePartnerWidgetMode | undefined {
  const normalizedMode = mode?.trim() || 'all';

  return isCommercePartnerWidgetMode(normalizedMode)
    ? normalizedMode
    : undefined;
}

type PartnerWidgetMockStatus =
  | PublicPartnerWidgetResponse['status']
  | 'forbidden'
  | 'no-data';

function parsePartnerWidgetMockStatus(
  status?: string,
): PartnerWidgetMockStatus | undefined {
  const normalizedStatus = status?.trim();

  if (
    normalizedStatus === 'winner' ||
    normalizedStatus === 'top3' ||
    normalizedStatus === 'checked' ||
    normalizedStatus === 'no-data' ||
    normalizedStatus === 'forbidden'
  ) {
    return normalizedStatus;
  }

  return undefined;
}

function buildMockPartnerWidgetResponse({
  merchantSlug,
  setId,
  status,
}: {
  merchantSlug: string;
  setId: string;
  status: PublicPartnerWidgetResponse['status'];
}): PublicPartnerWidgetResponse {
  const rank = status === 'winner' ? 1 : status === 'top3' ? 2 : 4;
  const merchantPrice =
    status === 'winner' ? 32999 : status === 'top3' ? 34999 : 42999;

  return {
    setId,
    setTitle: `Mock LEGO set ${setId}`,
    merchantSlug,
    merchantName: merchantSlug || 'Mock merchant',
    merchantPrice,
    lowestPrice: status === 'winner' ? merchantPrice : 29999,
    rank,
    totalMerchantsCompared: 5,
    isCheapest: status === 'winner',
    isTop3: status === 'winner' || status === 'top3',
    status,
    brickhuntUrl: `${publicWebBaseUrls.production}${buildSetDetailPath(
      `mock-lego-set-${setId}`,
    )}`,
    lastUpdated: '2026-06-18T10:00:00.000Z',
  };
}

function toPartnerWidgetMerchant({
  getPartnerWidgetConfig,
  merchant,
}: {
  getPartnerWidgetConfig: NonNullable<
    PublicPartnerWidgetRouteDependencies['getPartnerWidgetConfig']
  >;
  merchant: CommerceMerchant;
}): CommerceMerchant {
  const partnerWidget = getPartnerWidgetConfig(merchant.slug);

  return partnerWidget
    ? {
        ...merchant,
        partnerWidget,
      }
    : merchant;
}

export function createPublicPartnerWidgetRoutes({
  getCatalogSetById = (setId) => getCanonicalCatalogSetByIdServer({ setId }),
  isDevPreviewRuntime = () =>
    isCommercePartnerWidgetInternalRuntime(process.env),
  getPartnerWidgetConfig = getCommerceMerchantPartnerWidgetConfig,
  isPlaygroundBypassRuntime = () =>
    isCommercePartnerWidgetPlaygroundOriginBypassAllowed(process.env),
  shouldExposePlaygroundBypass = () =>
    shouldExposeCommercePartnerWidgetPlaygroundBypass(process.env),
  listCatalogCurrentOfferSummariesBySetIds = (setIds) =>
    listCatalogCurrentOfferSummariesBySetIdsServer({ setIds }),
  listCommerceMerchants = () => listCommerceMerchantsServer(),
}: PublicPartnerWidgetRouteDependencies = {}) {
  return async function publicPartnerWidgetRoutes(fastify: FastifyInstance) {
    fastify.get<{
      Querystring: {
        merchantSlug?: string;
        mode?: string;
        setId?: string;
        status?: string;
      };
    }>(partnerWidgetApiPath, async function (request, reply) {
      setPartnerWidgetCacheHeaders(reply);

      const setId = normalizeCatalogSetId(request.query.setId ?? '');
      const merchantSlug = normalizeCommerceSlug(
        request.query.merchantSlug ?? '',
      );
      const mode = parsePartnerWidgetMode(request.query.mode);
      const allowDevPreview = isDevPreviewRuntime();
      const devPreviewAllowed =
        allowDevPreview && isCommercePartnerWidgetDevPreviewRequested(request);
      const allowPlaygroundOrigin = isPlaygroundBypassRuntime();
      const playgroundBypassActive =
        allowPlaygroundOrigin &&
        isCommercePartnerWidgetPlaygroundOriginRequest(request);
      const mockStatus = parsePartnerWidgetMockStatus(request.query.status);

      if (!setId || !merchantSlug || !mode) {
        return reply.status(400).send({
          message:
            'partner widget requires setId, merchantSlug and a valid mode.',
        });
      }

      if (devPreviewAllowed) {
        setPartnerWidgetDevPreviewHeaders(reply);
      }

      if (mockStatus && devPreviewAllowed) {
        const requestOrigin = getCommercePartnerWidgetRequestOrigin(request);

        if (requestOrigin) {
          setPartnerWidgetCorsHeaders(reply, requestOrigin);
        }

        if (mockStatus === 'forbidden') {
          return reply.status(403).send({
            message: 'Mock partner widget forbidden response.',
          });
        }

        if (mockStatus === 'no-data') {
          return reply.status(204).send();
        }

        if (
          !shouldRenderCommercePartnerWidgetMode({
            mode,
            status: mockStatus,
          })
        ) {
          return reply.status(204).send();
        }

        setPartnerWidgetCacheHeaders(reply, partnerWidgetSuccessCacheControl);

        return buildMockPartnerWidgetResponse({
          merchantSlug,
          setId,
          status: mockStatus,
        });
      }

      const merchants = await listCommerceMerchants();
      const merchant = merchants.find(
        (candidateMerchant) =>
          normalizeCommerceSlug(candidateMerchant.slug) === merchantSlug,
      );

      if (!merchant) {
        return reply.status(404).send({
          message: 'Merchant not found.',
        });
      }

      const partnerWidgetMerchant = toPartnerWidgetMerchant({
        getPartnerWidgetConfig,
        merchant,
      });

      if (
        partnerWidgetMerchant.partnerWidget?.enabled !== true ||
        !isAllowedCommercePartnerWidgetMode({
          merchant: partnerWidgetMerchant,
          mode,
        })
      ) {
        return reply.status(403).send({
          message: 'Partner widget is not allowed for this merchant.',
        });
      }

      if (
        !isAllowedPartnerWidgetRequest(request, partnerWidgetMerchant, {
          allowDevPreview,
          allowPlaygroundOrigin,
        })
      ) {
        return reply.status(403).send({
          message: 'Partner widget origin is not allowed.',
        });
      }

      const allowedRequestOrigin = getAllowedPartnerWidgetRequestOrigin(
        request,
        partnerWidgetMerchant,
        {
          allowDevPreview,
          allowPlaygroundOrigin,
        },
      );

      if (!allowedRequestOrigin && !devPreviewAllowed) {
        return reply.status(403).send({
          message: 'Partner widget origin is not allowed.',
        });
      }

      if (allowedRequestOrigin) {
        setPartnerWidgetCorsHeaders(reply, allowedRequestOrigin);
      }

      if (playgroundBypassActive) {
        request.log.debug(
          `[partner-widget]\nPlayground origin bypass active\norigin=${allowedRequestOrigin}\nmerchantSlug=${merchantSlug}`,
        );
      }

      const catalogSet = await getCatalogSetById(setId);

      if (!catalogSet) {
        return reply.status(404).send({
          message: 'Set not found.',
        });
      }

      const currentOfferSummaries =
        await listCatalogCurrentOfferSummariesBySetIds([setId]);
      const currentOfferSummary = currentOfferSummaries.find(
        (summary) => normalizeCatalogSetId(summary.setId) === setId,
      );
      const ranking = getCommercePartnerWidgetRanking({
        merchantSlug,
        offers: currentOfferSummary?.offers ?? [],
      });

      if (
        !ranking ||
        !shouldRenderCommercePartnerWidgetMode({
          mode,
          status: ranking.status,
        })
      ) {
        return reply.status(204).send();
      }

      setPartnerWidgetCacheHeaders(reply, partnerWidgetSuccessCacheControl);

      const response: PublicPartnerWidgetResponse = {
        setId: catalogSet.setId,
        setTitle: catalogSet.name,
        merchantSlug: partnerWidgetMerchant.slug,
        merchantName: partnerWidgetMerchant.name,
        merchantPrice: ranking.merchantOffer.priceCents,
        lowestPrice: ranking.lowestPrice,
        rank: ranking.rank,
        totalMerchantsCompared: ranking.totalMerchantsCompared,
        isCheapest: ranking.isCheapest,
        isTop3: ranking.isTop3,
        status: ranking.status,
        brickhuntUrl: buildBrickhuntSetUrl(catalogSet.slug),
        lastUpdated: ranking.merchantOffer.checkedAt,
      };

      if (playgroundBypassActive && shouldExposePlaygroundBypass()) {
        return {
          ...response,
          playgroundBypass: true,
        } satisfies PublicPartnerWidgetResponse;
      }

      return response;
    });
  };
}

export default createPublicPartnerWidgetRoutes();
