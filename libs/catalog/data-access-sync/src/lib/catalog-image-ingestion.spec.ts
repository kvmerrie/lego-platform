import { describe, expect, it, vi } from 'vitest';
import {
  extractBolProductImagesFromHtml,
  extractOfficialLegoProductImagesFromHtml,
  fetchCatalogSetImages,
} from './catalog-image-ingestion';

describe('catalog image ingestion', () => {
  it('detects official LEGO challenge pages and returns a blocked result', () => {
    expect(
      extractOfficialLegoProductImagesFromHtml({
        html: `
          <!doctype html>
          <html>
            <head><title>Just a moment...</title></head>
            <body>Enable JavaScript and cookies to continue<script>window._cf_chl_opt = {};</script></body>
          </html>
        `,
      }),
    ).toEqual({
      images: [],
      note: 'Officiele LEGO-pagina werd afgeschermd door een challengepagina.',
      status: 'blocked',
    });
  });

  it('extracts ordered bol gallery images and upgrades them to the best available size', () => {
    const result = extractBolProductImagesFromHtml({
      html: `
        <link rel="preload" as="image" href="https://media.s-bol.com/k3pv34E3Ggp5/KZO6Aol/550x550.jpg" fetchPriority="high" />
        <link rel="preload" as="image" href="https://media.s-bol.com/1nqADzR6AD3V/Bw6wXx/124x122.jpg" fetchPriority="high" />
        <link rel="preload" as="image" href="https://media.s-bol.com/v0Wyx33XyDwr/mw9ZqlA/124x69.jpg" fetchPriority="high" />
        <link rel="preload" as="image" href="https://bol.images.contentstack.eu/other/promo.png" />
        <script>
          window.__STATE__ = {
            "gallery": [
              "https://media.s-bol.com/k3pv34E3Ggp5/KZO6Aol/1199x1200.jpg",
              "https://media.s-bol.com/1nqADzR6AD3V/Bw6wXx/1200x1184.jpg",
              "https://media.s-bol.com/v0Wyx33XyDwr/mw9ZqlA/1200x675.jpg"
            ]
          };
        </script>
      `,
    });

    expect(result).toEqual({
      images: [
        {
          order: 0,
          type: 'hero',
          url: 'https://media.s-bol.com/k3pv34E3Ggp5/KZO6Aol/1199x1200.jpg',
        },
        {
          order: 1,
          type: 'detail',
          url: 'https://media.s-bol.com/1nqADzR6AD3V/Bw6wXx/1200x1184.jpg',
        },
        {
          order: 2,
          type: 'detail',
          url: 'https://media.s-bol.com/v0Wyx33XyDwr/mw9ZqlA/1200x675.jpg',
        },
      ],
      status: 'success',
    });
  });

  it('falls back from LEGO to bol when the official page is blocked', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);

      if (url.includes('lego.com')) {
        return new Response(
          '<title>Just a moment...</title><script>window._cf_chl_opt = {};</script>',
          {
            status: 200,
          },
        );
      }

      return new Response(
        `
          <link rel="preload" as="image" href="https://media.s-bol.com/k3pv34E3Ggp5/KZO6Aol/550x550.jpg" fetchPriority="high" />
          <link rel="preload" as="image" href="https://media.s-bol.com/1nqADzR6AD3V/Bw6wXx/124x122.jpg" fetchPriority="high" />
          <script>
            window.__STATE__ = {
              "gallery": [
                "https://media.s-bol.com/k3pv34E3Ggp5/KZO6Aol/1199x1200.jpg",
                "https://media.s-bol.com/1nqADzR6AD3V/Bw6wXx/1200x1184.jpg"
              ]
            };
          </script>
        `,
        {
          status: 200,
        },
      );
    });

    await expect(
      fetchCatalogSetImages({
        fetchImpl,
        setNumber: '10316',
      }),
    ).resolves.toEqual({
      attempts: [
        {
          note: 'Officiele LEGO-pagina werd afgeschermd door een challengepagina.',
          source: 'lego',
          status: 'blocked',
          url: 'https://www.lego.com/nl-nl/product/the-lord-of-the-rings-rivendell-10316',
        },
        {
          source: 'bol',
          status: 'success',
          url: 'https://www.bol.com/nl/nl/p/lego-10316-the-lord-of-the-rings-rivendell/9300000144104277/',
        },
      ],
      images: [
        {
          order: 0,
          type: 'hero',
          url: 'https://media.s-bol.com/k3pv34E3Ggp5/KZO6Aol/1199x1200.jpg',
        },
        {
          order: 1,
          type: 'detail',
          url: 'https://media.s-bol.com/1nqADzR6AD3V/Bw6wXx/1200x1184.jpg',
        },
      ],
      setNumber: '10316',
      source: 'bol',
      sourceUrl:
        'https://www.bol.com/nl/nl/p/lego-10316-the-lord-of-the-rings-rivendell/9300000144104277/',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
