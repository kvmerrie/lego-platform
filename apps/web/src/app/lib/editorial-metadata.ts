import type { SeoFields } from '@lego-platform/content/util';
import type { Metadata } from 'next';

export function getMetadataFromSeoFields(seoFields: SeoFields): Metadata {
  return {
    title: seoFields.title,
    description: seoFields.description,
    robots: seoFields.noIndex
      ? {
          follow: false,
          index: false,
        }
      : undefined,
    openGraph: seoFields.openGraphImageUrl
      ? {
          description: seoFields.description,
          images: [seoFields.openGraphImageUrl],
          title: seoFields.title,
        }
      : {
          description: seoFields.description,
          title: seoFields.title,
        },
  };
}
