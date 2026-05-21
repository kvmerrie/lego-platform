import type { MetadataRoute } from 'next';
import { platformConfig } from '@lego-platform/shared/config';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: platformConfig.productName,
    short_name: platformConfig.productName,
    description: platformConfig.tagline,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#d6452e',
    icons: [
      {
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
