import {
  buildCanonicalUrl,
  publicSiteRobotsPolicy,
} from '@lego-platform/shared/config';
import type { buildPublicSiteRobotsPolicy } from '@lego-platform/shared/config';
import type { MetadataRoute } from 'next';

type PublicSiteRobotsPolicy = ReturnType<typeof buildPublicSiteRobotsPolicy>;

export function buildRobotsRoute(
  policy: PublicSiteRobotsPolicy = publicSiteRobotsPolicy,
): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: policy.robotsTxt.userAgent,
      disallow: policy.robotsTxt.disallow,
    },
    ...(policy.allowIndexing
      ? {
          sitemap: buildCanonicalUrl('/sitemap.xml'),
        }
      : {}),
  };
}

export default function robots(): MetadataRoute.Robots {
  return buildRobotsRoute();
}
