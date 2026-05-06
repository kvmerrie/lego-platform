import { isIndexablePage } from '@lego-platform/shared/config';
import type { Metadata } from 'next';

const noindexMetadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
};

export function getUtilityRouteMetadata(pathname: string): Metadata {
  if (
    isIndexablePage({
      allowIndexing: true,
      pathname,
    })
  ) {
    throw new Error(`Expected ${pathname} to be classified as non-indexable.`);
  }

  return noindexMetadata;
}
