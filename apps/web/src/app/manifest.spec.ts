import { describe, expect, it } from 'vitest';
import manifest from './manifest';

describe('web app manifest', () => {
  it('uses Brickhunt brand icons instead of default framework icons', () => {
    expect(manifest()).toMatchObject({
      name: 'Brickhunt',
      short_name: 'Brickhunt',
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
    });
  });
});
