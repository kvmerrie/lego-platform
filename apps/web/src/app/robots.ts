import { publicSiteRobotsPolicy } from '@lego-platform/shared/config';
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: publicSiteRobotsPolicy.robotsTxt.userAgent,
      disallow: publicSiteRobotsPolicy.robotsTxt.disallow,
    },
  };
}
