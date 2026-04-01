import type { SeoFields } from '@lego-platform/content/util';
import { platformConfig } from '@lego-platform/shared/config';
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
          siteName: platformConfig.productName,
          title: seoFields.title,
          type: 'website',
        }
      : {
          description: seoFields.description,
          siteName: platformConfig.productName,
          title: seoFields.title,
          type: 'website',
        },
    twitter: {
      card: seoFields.openGraphImageUrl ? 'summary_large_image' : 'summary',
      description: seoFields.description,
      title: seoFields.title,
    },
  };
}
