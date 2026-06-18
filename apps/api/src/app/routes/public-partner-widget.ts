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
  getCommercePartnerWidgetRanking,
  isAllowedCommercePartnerWidgetMode,
  isAllowedPartnerWidgetRequest,
  isCommercePartnerWidgetMode,
  normalizeCommerceSlug,
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

export interface PublicPartnerWidgetResponse {
  brickhuntUrl: string;
  isCheapest: boolean;
  isTop3: boolean;
  lastUpdated: string;
  lowestPrice: number;
  merchantName: string;
  merchantPrice: number;
  merchantSlug: string;
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
  getPartnerWidgetConfig?: (
    merchantSlug: string,
  ) => CommerceMerchantPartnerWidgetConfig | undefined;
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
  getPartnerWidgetConfig = getCommerceMerchantPartnerWidgetConfig,
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
      };
    }>(partnerWidgetApiPath, async function (request, reply) {
      setPartnerWidgetCacheHeaders(reply);

      const setId = normalizeCatalogSetId(request.query.setId ?? '');
      const merchantSlug = normalizeCommerceSlug(
        request.query.merchantSlug ?? '',
      );
      const mode = parsePartnerWidgetMode(request.query.mode);

      if (!setId || !merchantSlug || !mode) {
        return reply.status(400).send({
          message:
            'partner widget requires setId, merchantSlug and a valid mode.',
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

      if (!isAllowedPartnerWidgetRequest(request, partnerWidgetMerchant)) {
        return reply.status(403).send({
          message: 'Partner widget origin is not allowed.',
        });
      }

      const allowedRequestOrigin = getAllowedPartnerWidgetRequestOrigin(
        request,
        partnerWidgetMerchant,
      );

      if (!allowedRequestOrigin) {
        return reply.status(403).send({
          message: 'Partner widget origin is not allowed.',
        });
      }

      setPartnerWidgetCorsHeaders(reply, allowedRequestOrigin);

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

      return {
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
      } satisfies PublicPartnerWidgetResponse;
    });
  };
}

export default createPublicPartnerWidgetRoutes();
