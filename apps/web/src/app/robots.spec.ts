import { describe, expect, it } from 'vitest';
import { buildPublicSiteRobotsPolicy } from '@lego-platform/shared/config';
import robots, { buildRobotsRoute } from './robots';

describe('robots route', () => {
  it('uses the pre-launch robots policy by default', () => {
    expect(robots()).toEqual({
      rules: {
        userAgent: '*',
        disallow: '/',
      },
    });
  });

  it('allows public routes and blocks utility and crawl-trap routes in launch mode', () => {
    expect(
      buildRobotsRoute(
        buildPublicSiteRobotsPolicy({
          allowIndexing: true,
        }),
      ),
    ).toEqual({
      rules: {
        userAgent: '*',
        disallow: [
          '/api/',
          '/admin/',
          '/account/',
          '/auth/',
          '/search',
          '/volgt',
          '/*?*sort=',
          '/*?*filter=',
          '/*?*utm_',
          '/*?*ref=',
          '/*?*affiliate=',
        ],
      },
      sitemap: 'https://www.brickhunt.nl/sitemap.xml',
    });
  });
});
