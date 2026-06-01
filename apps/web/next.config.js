//@ts-check

const { composePlugins, withNx } = require('@nx/next');

const snapshotBackedCollectionCacheControl =
  'public, s-maxage=21600, stale-while-revalidate=86400';
const snapshotBackedCollectionHeaderSources = [
  '/nieuwe-lego-sets',
  '/retiring-lego-sets',
  '/lego-sets-onder-50-euro',
  '/lego-voor-volwassenen',
];

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
  async rewrites() {
    const apiProxyTarget =
      process.env.API_PROXY_TARGET ?? 'http://localhost:3333';

    return [
      {
        source: '/api/:path*',
        destination: `${apiProxyTarget}/api/:path*`,
      },
    ];
  },
};

const plugins = [withNx];

module.exports = composePlugins(...plugins)(nextConfig);
