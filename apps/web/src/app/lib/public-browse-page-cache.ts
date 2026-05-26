import { unstable_cache } from 'next/cache';

export type PublicBrowsePageType = 'collection' | 'theme' | (string & {});

export type PublicBrowsePageCacheParam =
  | boolean
  | null
  | number
  | string
  | undefined;

export interface SerializablePublicBrowsePageResult<TSetCard> {
  readonly setCards: readonly TSetCard[];
  readonly totalSetCount: number;
}

export type PublicBrowsePagePriceMinorBySetId = Readonly<
  Record<string, number>
>;

export function toPublicBrowsePagePriceMinorRecord(
  priceMinorBySetId: ReadonlyMap<string, number>,
): PublicBrowsePagePriceMinorBySetId {
  return Object.fromEntries(priceMinorBySetId.entries());
}

export function buildPublicBrowsePageCacheKeyParts({
  pageType,
  params = [],
  slug,
}: {
  pageType: PublicBrowsePageType;
  params?: readonly PublicBrowsePageCacheParam[];
  slug: string;
}): string[] {
  return [
    'public-browse-page',
    pageType,
    slug,
    ...params.map((param) => String(param ?? '')),
  ];
}

export async function getCachedPublicBrowsePageData<TData>({
  load,
  pageType,
  params = [],
  revalidateSeconds,
  slug,
  tags,
}: {
  load: () => Promise<TData>;
  pageType: PublicBrowsePageType;
  params?: readonly PublicBrowsePageCacheParam[];
  revalidateSeconds: number;
  slug: string;
  tags: readonly string[];
}): Promise<TData> {
  return unstable_cache(
    load,
    buildPublicBrowsePageCacheKeyParts({
      pageType,
      params,
      slug,
    }),
    {
      revalidate: revalidateSeconds,
      tags: [...tags],
    },
  )();
}
