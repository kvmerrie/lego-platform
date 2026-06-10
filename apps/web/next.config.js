//@ts-check

const { composePlugins, withNx } = require('@nx/next');

const snapshotBackedCollectionCacheControl =
  'public, s-maxage=21600, stale-while-revalidate=86400';
const snapshotBackedCollectionHeaderSources = [
  '/nieuwe-lego-sets',
  '/laatste-kans-lego-sets',
  '/lego-sets-onder-50-euro',
  '/lego-sets-onder-100-euro',
  '/lego-voor-volwassenen',
];
const catalogSetImagesStorageOrigin = (
  process.env.CATALOG_SET_IMAGES_STORAGE_ORIGIN ??
  process.env.SUPABASE_URL_PRODUCTION ??
  'https://ggqystcenwpbrjlkcmnt.supabase.co'
).replace(/\/$/, '');
const catalogSetImagesStoragePublicPath =
  '/storage/v1/object/public/catalog-set-images';

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.rebrickable.com',
        pathname: '/media/sets/**',
      },
    ],
  },
  nx: {},
  async headers() {
    return snapshotBackedCollectionHeaderSources.map((source) => ({
      headers: [
        {
          key: 'Cache-Control',
          value: snapshotBackedCollectionCacheControl,
        },
      ],
      source,
    }));
  },
  async redirects() {
    return [
      {
        source: '/retiring-lego-sets',
        destination: '/laatste-kans-lego-sets',
        statusCode: 301,
      },
    ];
  },
  async rewrites() {
    const apiProxyTarget =
      process.env.API_PROXY_TARGET ?? 'http://localhost:3333';

    return [
      {
        source: '/images/sets/:setId/gallery/:file',
        destination: `${catalogSetImagesStorageOrigin}${catalogSetImagesStoragePublicPath}/sets/:setId/gallery/:file`,
      },
      {
        source: '/images/sets/:setId/thumbs/:file',
        destination: `${catalogSetImagesStorageOrigin}${catalogSetImagesStoragePublicPath}/sets/:setId/thumbs/:file`,
      },
      {
        source: '/images/sets/:setId/:file',
        destination: `${catalogSetImagesStorageOrigin}${catalogSetImagesStoragePublicPath}/sets/:setId/:file`,
      },
      {
        source: '/api/:path*',
        destination: `${apiProxyTarget}/api/:path*`,
      },
    ];
  },
};

const plugins = [withNx];

module.exports = composePlugins(...plugins)(nextConfig);
