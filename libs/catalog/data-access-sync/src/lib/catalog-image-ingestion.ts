import {
  catalogOffers,
  catalogSnapshot,
} from '@lego-platform/catalog/data-access';
import {
  CatalogSetImage,
  getCanonicalCatalogSetId,
  normalizeCatalogSetImages,
} from '@lego-platform/catalog/util';

type CatalogImageSource = 'bol' | 'lego';
type CatalogImageAttemptStatus = 'blocked' | 'error' | 'no-images' | 'success';

interface CatalogImageSourceCandidate {
  source: CatalogImageSource;
  url: string;
}

export interface CatalogSetImageFetchAttempt {
  note?: string;
  source: CatalogImageSource;
  status: CatalogImageAttemptStatus;
  url: string;
}

export interface CatalogSetImageFetchResult {
  attempts: readonly CatalogSetImageFetchAttempt[];
  images: readonly CatalogSetImage[];
  setNumber: string;
  source?: CatalogImageSource;
  sourceUrl?: string;
}

export interface FetchCatalogSetImagesOptions {
  fetchImpl?: typeof fetch;
  locale?: string;
  maxImages?: number;
  setNumber: string;
}

interface ExtractCatalogSetImagesResult {
  images: readonly CatalogSetImage[];
  note?: string;
  status: CatalogImageAttemptStatus;
}

function normalizeExtractedUrl(value: string): string | undefined {
  const normalizedValue = value
    .trim()
    .replace(/\\+$/g, '')
    .replace(/&amp;/g, '&');

  if (!normalizedValue) {
    return undefined;
  }

  try {
    return new URL(normalizedValue).toString();
  } catch {
    return undefined;
  }
}

function toCatalogSetImages(
  urls: readonly string[],
): readonly CatalogSetImage[] {
  return (
    normalizeCatalogSetImages({
      images: urls.map((url, index) => ({
        order: index,
        type: index === 0 ? 'hero' : 'detail',
        url,
      })),
      primaryImage: urls[0],
    }).images ?? []
  );
}

function isOfficialLegoChallengePage(html: string): boolean {
  return (
    html.includes('<title>Just a moment...</title>') ||
    html.includes('Enable JavaScript and cookies to continue') ||
    html.includes('window._cf_chl_opt')
  );
}

function isOfficialLegoImageUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);

    return (
      (parsedUrl.hostname === 'www.lego.com' &&
        parsedUrl.pathname.includes('/cdn/cs/set/assets/')) ||
      parsedUrl.hostname.endsWith('lego.scene7.com')
    );
  } catch {
    return false;
  }
}

function extractUrlsFromHtml(html: string): string[] {
  return [...html.matchAll(/https?:\/\/[^"'\\\s<>]+/g)]
    .map((match) => normalizeExtractedUrl(match[0]))
    .filter((url): url is string => Boolean(url));
}

export function extractOfficialLegoProductImagesFromHtml({
  html,
  maxImages = 6,
}: {
  html: string;
  maxImages?: number;
}): ExtractCatalogSetImagesResult {
  // TODO(brickhunt): upgrade this source to a JS-aware or cookie-backed fetch
  // path when we automate official LEGO image ingestion.
  if (isOfficialLegoChallengePage(html)) {
    return {
      images: [],
      note: 'Officiele LEGO-pagina werd afgeschermd door een challengepagina.',
      status: 'blocked',
    };
  }

  const imageUrls = [...new Set(extractUrlsFromHtml(html))]
    .filter(isOfficialLegoImageUrl)
    .slice(0, maxImages);

  if (imageUrls.length === 0) {
    return {
      images: [],
      note: 'Geen officiele LEGO-afbeeldingen gevonden in de product-HTML.',
      status: 'no-images',
    };
  }

  return {
    images: toCatalogSetImages(imageUrls),
    status: 'success',
  };
}

function getBolImageBaseKey(url: string): string | undefined {
  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.hostname !== 'media.s-bol.com') {
      return undefined;
    }

    const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);

    if (pathSegments.length < 3) {
      return undefined;
    }

    return pathSegments.slice(0, 2).join('/');
  } catch {
    return undefined;
  }
}

function getBolImageArea(url: string): number {
  try {
    const parsedUrl = new URL(url);
    const sizeMatch = parsedUrl.pathname.match(/\/(\d+)x(\d+)\.[a-z]+$/i);

    if (!sizeMatch) {
      return 0;
    }

    return Number(sizeMatch[1]) * Number(sizeMatch[2]);
  } catch {
    return 0;
  }
}

function isBolProductImageUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);

    return (
      parsedUrl.hostname === 'media.s-bol.com' &&
      /\.(?:jpg|jpeg|png|webp)$/i.test(parsedUrl.pathname)
    );
  } catch {
    return false;
  }
}

export function extractBolProductImagesFromHtml({
  html,
  maxImages = 6,
}: {
  html: string;
  maxImages?: number;
}): ExtractCatalogSetImagesResult {
  const preloadImageUrls = [
    ...html.matchAll(
      /<link[^>]+rel="preload"[^>]+as="image"[^>]+href="([^"]+)"/g,
    ),
  ]
    .map((match) => normalizeExtractedUrl(match[1]))
    .filter((url): url is string => Boolean(url))
    .filter(isBolProductImageUrl);

  const uniquePreloadImageUrls = [...new Set(preloadImageUrls)];

  if (uniquePreloadImageUrls.length === 0) {
    return {
      images: [],
      note: 'Geen bol-galerijafbeeldingen gevonden in preload-tags.',
      status: 'no-images',
    };
  }

  const allBolImageUrls = [...new Set(extractUrlsFromHtml(html))]
    .filter(isBolProductImageUrl)
    .reduce<Map<string, string>>((bestUrlByBaseKey, url) => {
      const baseKey = getBolImageBaseKey(url);

      if (!baseKey) {
        return bestUrlByBaseKey;
      }

      const existingUrl = bestUrlByBaseKey.get(baseKey);

      if (!existingUrl || getBolImageArea(url) > getBolImageArea(existingUrl)) {
        bestUrlByBaseKey.set(baseKey, url);
      }

      return bestUrlByBaseKey;
    }, new Map());

  const orderedImageUrls = uniquePreloadImageUrls
    .map((preloadImageUrl) => {
      const baseKey = getBolImageBaseKey(preloadImageUrl);

      return baseKey
        ? (allBolImageUrls.get(baseKey) ?? preloadImageUrl)
        : undefined;
    })
    .filter((url): url is string => Boolean(url))
    .slice(0, maxImages);

  return {
    images: toCatalogSetImages(orderedImageUrls),
    status: orderedImageUrls.length > 0 ? 'success' : 'no-images',
    ...(orderedImageUrls.length === 0
      ? {
          note: 'Geen bruikbare bol-productafbeeldingen gevonden.',
        }
      : {}),
  };
}

function buildCatalogImageSourceCandidates({
  locale = 'nl-nl',
  setNumber,
}: {
  locale?: string;
  setNumber: string;
}): CatalogImageSourceCandidate[] {
  const canonicalId = getCanonicalCatalogSetId(setNumber);
  const catalogSetRecord = catalogSnapshot.setRecords.find(
    (catalogSetRecordCandidate) =>
      catalogSetRecordCandidate.canonicalId === canonicalId,
  );
  const catalogSetOffers = catalogOffers.filter(
    (catalogOfferRecord) => catalogOfferRecord.setId === canonicalId,
  );
  const legoOfferUrls = catalogSetOffers
    .filter((catalogOfferRecord) => catalogOfferRecord.merchant === 'lego')
    .map((catalogOfferRecord) => ({
      source: 'lego' as const,
      url: catalogOfferRecord.url,
    }));
  const candidateUrls = [
    ...legoOfferUrls,
    ...(legoOfferUrls.length === 0 && catalogSetRecord
      ? [
          {
            source: 'lego' as const,
            url: `https://www.lego.com/${locale}/product/${catalogSetRecord.slug}`,
          },
        ]
      : []),
    ...catalogSetOffers
      .filter((catalogOfferRecord) => catalogOfferRecord.merchant === 'bol')
      .map((catalogOfferRecord) => ({
        source: 'bol' as const,
        url: catalogOfferRecord.url,
      })),
  ];

  return candidateUrls.filter((candidateUrl, index, sourceCandidates) => {
    return (
      sourceCandidates.findIndex(
        (sourceCandidate) =>
          sourceCandidate.source === candidateUrl.source &&
          sourceCandidate.url === candidateUrl.url,
      ) === index
    );
  });
}

async function fetchCatalogImageSource({
  fetchImpl,
  sourceCandidate,
}: {
  fetchImpl: typeof fetch;
  sourceCandidate: CatalogImageSourceCandidate;
}): Promise<ExtractCatalogSetImagesResult> {
  const response = await fetchImpl(sourceCandidate.url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'Brickhunt image sync/1.0',
    },
  });

  if (!response.ok) {
    return {
      images: [],
      note: `Bron reageerde met status ${response.status}.`,
      status: 'error',
    };
  }

  const html = await response.text();

  return sourceCandidate.source === 'lego'
    ? extractOfficialLegoProductImagesFromHtml({ html })
    : extractBolProductImagesFromHtml({ html });
}

export async function fetchCatalogSetImages({
  fetchImpl = fetch,
  locale = 'nl-nl',
  maxImages = 6,
  setNumber,
}: FetchCatalogSetImagesOptions): Promise<CatalogSetImageFetchResult> {
  // TODO(brickhunt): persist successful multi-image results into curated overlays
  // or the generated catalog snapshot once ingestion coverage is broad enough.
  const canonicalId = getCanonicalCatalogSetId(setNumber);
  const sourceCandidates = buildCatalogImageSourceCandidates({
    locale,
    setNumber: canonicalId,
  });
  const attempts: CatalogSetImageFetchAttempt[] = [];

  for (const sourceCandidate of sourceCandidates) {
    try {
      const extractionResult = await fetchCatalogImageSource({
        fetchImpl,
        sourceCandidate,
      });
      const limitedImages = extractionResult.images.slice(0, maxImages);

      attempts.push({
        ...(extractionResult.note
          ? {
              note: extractionResult.note,
            }
          : {}),
        source: sourceCandidate.source,
        status:
          extractionResult.status === 'success' && limitedImages.length === 0
            ? 'no-images'
            : extractionResult.status,
        url: sourceCandidate.url,
      });

      if (limitedImages.length > 0) {
        return {
          attempts,
          images: limitedImages,
          setNumber: canonicalId,
          source: sourceCandidate.source,
          sourceUrl: sourceCandidate.url,
        };
      }
    } catch (error) {
      attempts.push({
        note:
          error instanceof Error
            ? error.message
            : 'Onbekende fout tijdens het ophalen van afbeeldingen.',
        source: sourceCandidate.source,
        status: 'error',
        url: sourceCandidate.url,
      });
    }
  }

  return {
    attempts,
    images: [],
    setNumber: canonicalId,
  };
}
