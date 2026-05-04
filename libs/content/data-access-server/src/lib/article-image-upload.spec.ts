import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import {
  ContentArticleImageUploadValidationError,
  importContentArticleImageFromUrl,
  importContentArticleHeroImageFromUrl,
  uploadContentArticleImage,
  uploadContentArticleHeroImage,
} from './article-image-upload';

const { sharpMock, sharpResize } = vi.hoisted(() => {
  const toBuffer = vi.fn(async () => Buffer.from('optimized webp bytes'));
  const webp = vi.fn(() => ({
    toBuffer,
  }));
  const resize = vi.fn(() => ({
    webp,
  }));
  const rotate = vi.fn(() => ({
    resize,
  }));
  const sharp = vi.fn(() => ({
    rotate,
  }));

  return {
    sharpMock: sharp,
    sharpResize: resize,
    sharpToBuffer: toBuffer,
  };
});

vi.mock('sharp', () => ({
  default: sharpMock,
}));

function createStorageClientMock() {
  const upload = vi.fn(async () => ({
    data: {
      path: 'articles/lego-star-wars-set/hero.webp',
    },
    error: null,
  }));
  const getPublicUrl = vi.fn((path: string) => ({
    data: {
      publicUrl: `https://storage.example/${path}`,
    },
  }));
  const from = vi.fn(() => ({
    getPublicUrl,
    upload,
  }));

  return {
    client: {
      storage: {
        from,
      },
    },
    from,
    getPublicUrl,
    upload,
  };
}

describe('content article hero image upload', () => {
  test('imports an official LEGO image URL, optimizes it and stores a copy', async () => {
    const storageClient = createStorageClientMock();
    const fetchFn = vi.fn(async () => {
      return new Response(Buffer.from('lego image bytes'), {
        headers: {
          'content-length': '16',
          'content-type': 'image/jpeg',
        },
        status: 200,
      });
    });

    await expect(
      importContentArticleHeroImageFromUrl({
        fetchFn,
        input: {
          imageUrl: 'https://www.lego.com/cdn/product-assets/hero.jpg',
          slug: 'lego-star-wars-set',
        },
        supabaseClient: storageClient.client,
      }),
    ).resolves.toEqual({
      heroImage:
        'https://storage.example/articles/lego-star-wars-set/hero.webp',
      heroImageCredit: 'Beeld: © The LEGO Group',
      path: 'articles/lego-star-wars-set/hero.webp',
    });

    expect(fetchFn).toHaveBeenCalledWith(
      new URL('https://www.lego.com/cdn/product-assets/hero.jpg'),
    );
    expect(sharpMock).toHaveBeenCalledWith(expect.any(Uint8Array));
    expect(sharpResize).toHaveBeenCalledWith({
      width: 1600,
      withoutEnlargement: true,
    });
    expect(storageClient.upload).toHaveBeenCalledWith(
      'articles/lego-star-wars-set/hero.webp',
      Buffer.from('optimized webp bytes'),
      {
        contentType: 'image/webp',
        upsert: true,
      },
    );
  });

  test('rejects Brickset and BrickTastic image URLs', async () => {
    const storageClient = createStorageClientMock();
    const fetchFn = vi.fn();

    await expect(
      importContentArticleHeroImageFromUrl({
        fetchFn,
        input: {
          imageUrl: 'https://images.brickset.com/news/example.jpg',
          slug: 'lego-star-wars-set',
        },
        supabaseClient: storageClient.client,
      }),
    ).rejects.toThrow(
      'Alleen officiële LEGO afbeeldings-URL’s zijn toegestaan.',
    );

    await expect(
      importContentArticleHeroImageFromUrl({
        fetchFn,
        input: {
          imageUrl: 'https://www.bricktastic.nl/wp-content/example.jpg',
          slug: 'lego-star-wars-set',
        },
        supabaseClient: storageClient.client,
      }),
    ).rejects.toBeInstanceOf(ContentArticleImageUploadValidationError);

    expect(fetchFn).not.toHaveBeenCalled();
    expect(storageClient.upload).not.toHaveBeenCalled();
  });

  test('rejects unknown image domains', async () => {
    const storageClient = createStorageClientMock();

    await expect(
      importContentArticleHeroImageFromUrl({
        fetchFn: vi.fn(),
        input: {
          imageUrl: 'https://cdn.example.com/hero.jpg',
          slug: 'lego-star-wars-set',
        },
        supabaseClient: storageClient.client,
      }),
    ).rejects.toBeInstanceOf(ContentArticleImageUploadValidationError);

    expect(storageClient.upload).not.toHaveBeenCalled();
  });

  test('rejects non-image remote content', async () => {
    const storageClient = createStorageClientMock();

    await expect(
      importContentArticleHeroImageFromUrl({
        fetchFn: vi.fn(async () => {
          return new Response('html', {
            headers: {
              'content-type': 'text/html',
            },
            status: 200,
          });
        }),
        input: {
          imageUrl: 'https://assets.lego.com/not-an-image',
          slug: 'lego-star-wars-set',
        },
        supabaseClient: storageClient.client,
      }),
    ).rejects.toThrow(
      'Afbeeldings-URL moet een jpg, png of webp afbeelding zijn.',
    );

    expect(storageClient.upload).not.toHaveBeenCalled();
  });

  test('rejects remote images larger than 5 MB', async () => {
    const storageClient = createStorageClientMock();

    await expect(
      importContentArticleHeroImageFromUrl({
        fetchFn: vi.fn(async () => {
          return new Response(Buffer.from('large'), {
            headers: {
              'content-length': String(5 * 1024 * 1024 + 1),
              'content-type': 'image/png',
            },
            status: 200,
          });
        }),
        input: {
          imageUrl: 'https://assets.lego.com/too-large.png',
          slug: 'lego-star-wars-set',
        },
        supabaseClient: storageClient.client,
      }),
    ).rejects.toThrow('Hero afbeelding is te groot. Gebruik maximaal 5 MB.');

    expect(storageClient.upload).not.toHaveBeenCalled();
  });

  test('uploads a supported hero image to the article-images bucket', async () => {
    const storageClient = createStorageClientMock();

    await expect(
      uploadContentArticleHeroImage({
        input: {
          base64Data: Buffer.from('fake webp bytes').toString('base64'),
          contentType: 'image/webp',
          fileName: 'source.png',
          slug: 'lego-star-wars-set',
        },
        supabaseClient: storageClient.client,
      }),
    ).resolves.toEqual({
      path: 'articles/lego-star-wars-set/hero.webp',
      publicUrl:
        'https://storage.example/articles/lego-star-wars-set/hero.webp',
    });

    expect(storageClient.from).toHaveBeenCalledWith('article-images');
    expect(storageClient.upload).toHaveBeenCalledWith(
      'articles/lego-star-wars-set/hero.webp',
      expect.any(Uint8Array),
      {
        contentType: 'image/webp',
        upsert: true,
      },
    );
  });

  test('uploads a supported gallery image to the article-images bucket', async () => {
    const storageClient = createStorageClientMock();

    await expect(
      uploadContentArticleImage({
        input: {
          base64Data: Buffer.from('fake webp bytes').toString('base64'),
          contentType: 'image/webp',
          fileName: 'gallery.webp',
          imageId: 'gallery-one',
          slug: 'lego-star-wars-set',
          type: 'gallery',
        },
        supabaseClient: storageClient.client,
      }),
    ).resolves.toEqual({
      path: 'articles/lego-star-wars-set/gallery/gallery-one.webp',
      publicUrl:
        'https://storage.example/articles/lego-star-wars-set/gallery/gallery-one.webp',
    });

    expect(storageClient.upload).toHaveBeenCalledWith(
      'articles/lego-star-wars-set/gallery/gallery-one.webp',
      expect.any(Uint8Array),
      {
        contentType: 'image/webp',
        upsert: true,
      },
    );
  });

  test('imports a LEGO gallery image URL and stores it under gallery', async () => {
    const storageClient = createStorageClientMock();
    const fetchFn = vi.fn(async () => {
      return new Response(Buffer.from('lego image bytes'), {
        headers: {
          'content-length': '16',
          'content-type': 'image/png',
        },
        status: 200,
      });
    });

    await expect(
      importContentArticleImageFromUrl({
        fetchFn,
        input: {
          imageId: 'gallery-two',
          imageUrl: 'https://assets.lego.com/gallery.png',
          slug: 'lego-star-wars-set',
          type: 'gallery',
        },
        supabaseClient: storageClient.client,
      }),
    ).resolves.toEqual({
      imageCredit: 'Beeld: © The LEGO Group',
      imageUrl:
        'https://storage.example/articles/lego-star-wars-set/gallery/gallery-two.webp',
      path: 'articles/lego-star-wars-set/gallery/gallery-two.webp',
    });

    expect(storageClient.upload).toHaveBeenCalledWith(
      'articles/lego-star-wars-set/gallery/gallery-two.webp',
      Buffer.from('optimized webp bytes'),
      {
        contentType: 'image/webp',
        upsert: true,
      },
    );
  });

  test('rejects unsupported hero image file types', async () => {
    const storageClient = createStorageClientMock();

    await expect(
      uploadContentArticleHeroImage({
        input: {
          base64Data: Buffer.from('svg').toString('base64'),
          contentType: 'image/svg+xml',
          fileName: 'hero.svg',
          slug: 'lego-star-wars-set',
        },
        supabaseClient: storageClient.client,
      }),
    ).rejects.toBeInstanceOf(ContentArticleImageUploadValidationError);

    expect(storageClient.upload).not.toHaveBeenCalled();
  });

  test('rejects unoptimized non-webp uploads', async () => {
    const storageClient = createStorageClientMock();

    await expect(
      uploadContentArticleHeroImage({
        input: {
          base64Data: Buffer.from('png').toString('base64'),
          contentType: 'image/png',
          fileName: 'hero.png',
          slug: 'lego-star-wars-set',
        },
        supabaseClient: storageClient.client,
      }),
    ).rejects.toThrow('Hero afbeelding moet als webp worden geüpload.');

    expect(storageClient.upload).not.toHaveBeenCalled();
  });
});

describe('content article image storage policy', () => {
  test('creates a public article-images bucket managed by service role', async () => {
    const workspaceRoot = process
      .cwd()
      .endsWith(path.join('libs', 'content', 'data-access-server'))
      ? path.resolve(process.cwd(), '..', '..', '..')
      : process.cwd();
    const migration = await readFile(
      path.join(
        workspaceRoot,
        'supabase',
        'migrations',
        '20260503150000_article_images_bucket.sql',
      ),
      'utf8',
    );

    expect(migration).toContain("'article-images'");
    expect(migration).toContain('public)');
    expect(migration).toContain('for select');
    expect(migration).toContain("bucket_id = 'article-images'");
    expect(migration).toContain("auth.role() = 'service_role'");
  });
});
