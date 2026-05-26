import { unstable_cache } from 'next/cache';

export type PublicLandingPageCacheParam =
  | boolean
  | null
  | number
  | string
  | undefined;

export function buildPublicLandingPageCacheKeyParts({
  page,
  params = [],
}: {
  page: string;
  params?: readonly PublicLandingPageCacheParam[];
}): string[] {
  return [
    'public-landing-page',
    page,
    ...params.map((param) => String(param ?? '')),
  ];
}

export async function getCachedPublicLandingPageData<TData>({
  load,
  page,
  params = [],
  revalidateSeconds,
  tags,
}: {
  load: () => Promise<TData>;
  page: string;
  params?: readonly PublicLandingPageCacheParam[];
  revalidateSeconds: number;
  tags: readonly string[];
}): Promise<TData> {
  return unstable_cache(
    load,
    buildPublicLandingPageCacheKeyParts({
      page,
      params,
    }),
    {
      revalidate: revalidateSeconds,
      tags: [...tags],
    },
  )();
}
