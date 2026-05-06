import type { SeoFields } from '@lego-platform/content/util';
import {
  buildCanonicalUrl,
  platformConfig,
} from '@lego-platform/shared/config';
import type { Metadata } from 'next';

export function getMetadataFromSeoFields(
  seoFields: SeoFields,
  {
    canonicalPath,
  }: {
    canonicalPath?: string;
  } = {},
): Metadata {
  const canonicalUrl = canonicalPath
    ? buildCanonicalUrl(canonicalPath)
    : undefined;

  const openGraph = seoFields.openGraphImageUrl
    ? {
        description: seoFields.description,
        images: [seoFields.openGraphImageUrl],
        siteName: platformConfig.productName,
        title: seoFields.title,
        type: 'website' as const,
        ...(canonicalUrl ? { url: canonicalUrl } : {}),
      }
    : {
        description: seoFields.description,
        siteName: platformConfig.productName,
        title: seoFields.title,
        type: 'website' as const,
        ...(canonicalUrl ? { url: canonicalUrl } : {}),
      };

  return {
    title: seoFields.title,
    description: seoFields.description,
    ...(canonicalUrl
      ? {
          alternates: {
            canonical: canonicalUrl,
          },
        }
      : {}),
    robots: seoFields.noIndex
      ? {
          follow: false,
          index: false,
        }
      : undefined,
    openGraph,
    twitter: {
      card: seoFields.openGraphImageUrl ? 'summary_large_image' : 'summary',
      description: seoFields.description,
      title: seoFields.title,
    },
  };
}
