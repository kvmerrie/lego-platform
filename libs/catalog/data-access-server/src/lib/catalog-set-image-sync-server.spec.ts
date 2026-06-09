import { describe, expect, test, vi } from 'vitest';
import sharp = require('sharp');
import {
  copyCatalogSetImageMetadata,
  rewriteCatalogSetImagePublicUrls,
  syncCatalogSetImages,
  toBrickhuntCatalogSetImagePublicUrl,
} from './catalog-set-image-sync-server';

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);

function createSetImageSyncSupabaseMock({
  catalogRows,
  imageRows = [],
  sourceMetadataRows = [],
  uploadErrorsByPath = {},
}: {
  catalogRows: readonly Record<string, unknown>[];
  imageRows?: readonly Record<string, unknown>[];
  sourceMetadataRows?: readonly Record<string, unknown>[];
  uploadErrorsByPath?: Readonly<Record<string, unknown>>;
}) {
  const upsert = vi.fn(async () => ({
    error: null,
  }));
  const upload = vi.fn(async (path: string) => ({
    error: uploadErrorsByPath[path] ?? null,
  }));
  const getPublicUrl = vi.fn((path: string) => ({
    data: {
      publicUrl: `https://storage.example.com/${path}`,
    },
  }));
  const rowsByTable = new Map<string, readonly Record<string, unknown>[]>([
    ['catalog_sets', catalogRows],
    ['catalog_set_images', imageRows],
    ['catalog_set_source_metadata', sourceMetadataRows],
  ]);

  return {
    client: {
      from: vi.fn((table: string) => {
        const filters: Array<{
          column: string;
          type: 'eq' | 'in';
          value?: unknown;
          values?: readonly unknown[];
        }> = [];
        const builder = {
          eq(column: string, value: unknown) {
            filters.push({
              column,
              type: 'eq',
              value,
            });

            return builder;
          },
          in(column: string, values: readonly unknown[]) {
            filters.push({
              column,
              type: 'in',
              values,
            });

            return builder;
          },
          limit() {
            return builder;
          },
          order() {
            return builder;
          },
          range() {
            return builder;
          },
          select() {
            return builder;
          },
          then<
            TResult1 = {
              count: number;
              data: readonly Record<string, unknown>[];
              error: null;
            },
          >(
            onFulfilled?:
              | ((value: {
                  count: number;
                  data: readonly Record<string, unknown>[];
                  error: null;
                }) => TResult1 | PromiseLike<TResult1>)
              | null,
            onRejected?: ((reason: unknown) => PromiseLike<never>) | null,
          ) {
            const rows = [...(rowsByTable.get(table) ?? [])].filter((row) =>
              filters.every((filter) => {
                if (filter.type === 'eq') {
                  return row[filter.column] === filter.value;
                }

                return filter.values?.includes(row[filter.column]) ?? false;
              }),
            );

            return Promise.resolve({
              count: rows.length,
              data: rows,
              error: null,
            }).then(onFulfilled, onRejected ?? undefined);
          },
          upsert,
        };

        return builder;
      }),
      storage: {
        from: vi.fn(() => ({
          getPublicUrl,
          upload,
        })),
      },
    },
    getPublicUrl,
    upload,
    upsert,
  };
}

function createCatalogRow(overrides: Record<string, unknown> = {}) {
  return {
    created_at: '2026-06-07T10:00:00.000Z',
    image_url: 'https://cdn.example.com/10316.png',
    name: 'Rivendell',
    set_id: '10316',
    source_set_number: '10316-1',
    status: 'active',
    ...overrides,
  };
}

function createStoredImageRow(overrides: Record<string, unknown> = {}) {
  return {
    byte_size: 1024,
    content_type: 'image/webp',
    duplicate_distance: null,
    duplicate_of_id: null,
    duplicate_reason: null,
    height: 900,
    image_role: 'unknown',
    image_type: 'hero',
    metadata_json: {
      optimizedAt: '2026-06-07T10:00:00.000Z',
    },
    perceptual_hash: null,
    public_url:
      'https://production-storage.example.com/storage/v1/object/public/catalog-set-images/sets/10316/hero.webp',
    set_id: '10316',
    sha256: 'hero-sha',
    sort_order: 0,
    source: 'rebrickable',
    source_url: 'https://cdn.example.com/10316.png',
    status: 'active',
    storage_bucket: 'catalog-set-images',
    storage_path: 'sets/10316/hero.webp',
    width: 1280,
    ...overrides,
  };
}

function createImageFetch({
  bytes = tinyPng,
  ok = true,
}: {
  bytes?: Uint8Array;
  ok?: boolean;
} = {}) {
  return vi.fn(
    async () =>
      new Response(ok ? bytes : null, {
        headers: ok ? { 'content-type': 'image/png' } : {},
        status: ok ? 200 : 404,
      }),
  );
}

async function createTestImage({
  background = '#ffffff',
  box,
  format = 'png',
}: {
  background?: string;
  box?: {
    color: string;
    height: number;
    left: number;
    top: number;
    width: number;
  };
  format?: 'jpeg' | 'png';
} = {}): Promise<Buffer> {
  const base = sharp({
    create: {
      background,
      channels: 3,
      height: 120,
      width: 160,
    },
  });
  const image = box
    ? base.composite([
        {
          input: await sharp({
            create: {
              background: box.color,
              channels: 3,
              height: box.height,
              width: box.width,
            },
          })
            .png()
            .toBuffer(),
          left: box.left,
          top: box.top,
        },
      ])
    : base;

  return format === 'jpeg'
    ? image.jpeg({ quality: 82 }).toBuffer()
    : image.png().toBuffer();
}

async function createTransparentProductImage(): Promise<Buffer> {
  return sharp({
    create: {
      background: {
        alpha: 0,
        b: 0,
        g: 0,
        r: 0,
      },
      channels: 4,
      height: 420,
      width: 560,
    },
  })
    .composite([
      {
        input: await sharp({
          create: {
            background: '#31a366',
            channels: 4,
            height: 220,
            width: 320,
          },
        })
          .png()
          .toBuffer(),
        left: 120,
        top: 100,
      },
    ])
    .png()
    .toBuffer();
}

function createImageFetchByUrl(
  imagesByUrl: ReadonlyMap<
    string,
    {
      bytes: Uint8Array;
      contentType: string;
    }
  >,
) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const image = imagesByUrl.get(url);

    return new Response(image?.bytes ?? null, {
      headers: image ? { 'content-type': image.contentType } : {},
      status: image ? 200 : 404,
    });
  });
}

describe('catalog set image sync server', () => {
  test('converts catalog set image storage paths to Brickhunt public image URLs', () => {
    expect(toBrickhuntCatalogSetImagePublicUrl('sets/10309/hero.webp')).toBe(
      '/images/sets/10309/hero.webp',
    );
    expect(
      toBrickhuntCatalogSetImagePublicUrl('sets/10309/gallery/1.webp'),
    ).toBe('/images/sets/10309/gallery/1.webp');
    expect(
      toBrickhuntCatalogSetImagePublicUrl('articles/hero.webp'),
    ).toBeNull();
  });

  test('dedupes identical Rebrickable and Brickset images in dry-run', async () => {
    const { client, upload, upsert } = createSetImageSyncSupabaseMock({
      catalogRows: [createCatalogRow()],
      sourceMetadataRows: [
        {
          catalog_set_id: '10316',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            images: [
              {
                imageUrl: 'https://brickset.example.com/10316-alt.png',
                sourceField: 'additionalImages',
                type: 'additional',
              },
            ],
          },
          source: 'brickset',
        },
      ],
    });

    const result = await syncCatalogSetImages({
      dryRun: true,
      fetchFn: createImageFetch(),
      supabaseClient: client,
    });

    expect(result.processedSetCount).toBe(1);
    expect(result.duplicateSourceCount).toBe(1);
    expect(result.exactDuplicateCount).toBe(1);
    expect(result.perceptualDuplicateCount).toBe(0);
    expect(result.duplicateGroups).toEqual([
      {
        duplicateDistance: 0,
        duplicateReason: 'sha256',
        duplicateSlot: 'gallery:1',
        keptSlot: 'hero:0',
      },
    ]);
    expect(result.results[0]?.heroImageStored).toBe(true);
    expect(result.results[0]?.galleryImageCount).toBe(0);
    expect(result.estimatedUploadBytes).toBeGreaterThan(0);
    expect(result.activeCatalogSetCount).toBe(1);
    expect(result.footprintReport.byType.card.averageBytes).toBeGreaterThan(0);
    expect(result.footprintReport.byType.hero.averageBytes).toBeGreaterThan(0);
    expect(result.footprintReport.byType.gallery.averageBytes).toBe(0);
    expect(result.footprintReport.byType.social.averageBytes).toBeGreaterThan(
      0,
    );
    expect(
      result.footprintReport.byType.thumbnail.averageBytes,
    ).toBeGreaterThan(0);
    expect(
      result.footprintReport.projections.sets100.storageGb,
    ).toBeGreaterThan(0);
    expect(result.footprintReport.projections.currentCatalog.setCount).toBe(1);
    expect(result.uploadedBytes).toBe(0);
    expect(upload).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  test('marks exact duplicate gallery rows as duplicate in write mode', async () => {
    const { client, upload, upsert } = createSetImageSyncSupabaseMock({
      catalogRows: [createCatalogRow()],
      sourceMetadataRows: [
        {
          catalog_set_id: '10316',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            images: [
              {
                imageUrl: 'https://brickset.example.com/10316-alt.png',
                sourceField: 'additionalImages',
                type: 'additional',
              },
            ],
          },
          source: 'brickset',
        },
      ],
    });

    const result = await syncCatalogSetImages({
      dryRun: false,
      fetchFn: createImageFetch(),
      supabaseClient: client,
    });

    expect(result.exactDuplicateCount).toBe(1);
    expect(upload).toHaveBeenCalledTimes(4);
    expect(upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          duplicate_distance: 0,
          duplicate_reason: 'sha256',
          image_type: 'gallery',
          public_url: null,
          set_id: '10316',
          sort_order: 1,
          status: 'duplicate',
          storage_path: null,
        }),
      ]),
      {
        onConflict: 'set_id,image_type,sort_order',
      },
    );
  });

  test('marks visually identical differently compressed images as perceptual duplicates', async () => {
    const pngImage = await createTestImage({
      box: {
        color: '#111111',
        height: 54,
        left: 50,
        top: 34,
        width: 62,
      },
      format: 'png',
    });
    const jpegImage = await createTestImage({
      box: {
        color: '#111111',
        height: 54,
        left: 50,
        top: 34,
        width: 62,
      },
      format: 'jpeg',
    });
    const { client, upsert } = createSetImageSyncSupabaseMock({
      catalogRows: [createCatalogRow()],
      sourceMetadataRows: [
        {
          catalog_set_id: '10316',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            images: [
              {
                imageUrl: 'https://brickset.example.com/10316-alt.jpg',
                sourceField: 'additionalImages',
                type: 'additional',
              },
            ],
          },
          source: 'brickset',
        },
      ],
    });

    const result = await syncCatalogSetImages({
      dryRun: false,
      fetchFn: createImageFetchByUrl(
        new Map([
          [
            'https://cdn.example.com/10316.png',
            {
              bytes: pngImage,
              contentType: 'image/png',
            },
          ],
          [
            'https://brickset.example.com/10316-alt.jpg',
            {
              bytes: jpegImage,
              contentType: 'image/jpeg',
            },
          ],
        ]),
      ),
      supabaseClient: client,
    });

    expect(result.exactDuplicateCount).toBe(0);
    expect(result.perceptualDuplicateCount).toBe(1);
    expect(result.duplicateGroups[0]).toEqual(
      expect.objectContaining({
        duplicateReason: 'perceptual',
        duplicateSlot: 'gallery:1',
        keptSlot: 'hero:0',
      }),
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          duplicate_reason: 'perceptual',
          image_type: 'gallery',
          status: 'duplicate',
        }),
      ]),
      {
        onConflict: 'set_id,image_type,sort_order',
      },
    );
  });

  test('keeps hero-similar gallery images active but suppresses them from visible gallery', async () => {
    const heroImage = await createTestImage({
      box: {
        color: '#111111',
        height: 48,
        left: 24,
        top: 32,
        width: 52,
      },
    });
    const galleryImage = await createTestImage({
      box: {
        color: '#111111',
        height: 48,
        left: 92,
        top: 32,
        width: 52,
      },
    });
    const { client, upsert } = createSetImageSyncSupabaseMock({
      catalogRows: [createCatalogRow()],
      sourceMetadataRows: [
        {
          catalog_set_id: '10316',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            images: [
              {
                imageUrl: 'https://brickset.example.com/10316-alt.png',
                sourceField: 'additionalImages',
                type: 'additional',
              },
            ],
          },
          source: 'brickset',
        },
      ],
    });

    const result = await syncCatalogSetImages({
      dryRun: false,
      fetchFn: createImageFetchByUrl(
        new Map([
          [
            'https://cdn.example.com/10316.png',
            {
              bytes: heroImage,
              contentType: 'image/png',
            },
          ],
          [
            'https://brickset.example.com/10316-alt.png',
            {
              bytes: galleryImage,
              contentType: 'image/png',
            },
          ],
        ]),
      ),
      supabaseClient: client,
    });

    expect(result.duplicateSourceCount).toBe(0);
    expect(result.results[0]?.galleryImageCount).toBe(0);
    expect(result.results[0]?.heroSimilaritySuppressedCount).toBe(1);
    expect(result.results[0]?.suppressedImages).toEqual([
      expect.objectContaining({
        slot: 'gallery:1',
      }),
    ]);
    expect(upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          image_type: 'gallery',
          metadata_json: expect.objectContaining({
            gallerySuppressed: true,
            gallerySuppressionReason: expect.stringContaining(
              'too similar to hero',
            ),
            storagePublicUrl:
              'https://storage.example.com/sets/10316/gallery/1.webp',
          }),
          public_url: '/images/sets/10316/gallery/1.webp',
          status: 'active',
        }),
      ]),
      {
        onConflict: 'set_id,image_type,sort_order',
      },
    );
  });

  test('reports debug dedupe candidates and pair distances without writing', async () => {
    const heroImage = await createTestImage({
      box: {
        color: '#111111',
        height: 48,
        left: 24,
        top: 32,
        width: 52,
      },
    });
    const galleryImage = await createTestImage({
      box: {
        color: '#111111',
        height: 48,
        left: 92,
        top: 32,
        width: 52,
      },
    });
    const { client, upload, upsert } = createSetImageSyncSupabaseMock({
      catalogRows: [createCatalogRow()],
      sourceMetadataRows: [
        {
          catalog_set_id: '10316',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            images: [
              {
                imageUrl: 'https://brickset.example.com/10316-alt.png',
                sourceField: 'additionalImages',
                type: 'additional',
              },
            ],
          },
          source: 'brickset',
        },
      ],
    });

    const result = await syncCatalogSetImages({
      debugDedupe: true,
      dryRun: true,
      fetchFn: createImageFetchByUrl(
        new Map([
          [
            'https://cdn.example.com/10316.png',
            {
              bytes: heroImage,
              contentType: 'image/png',
            },
          ],
          [
            'https://brickset.example.com/10316-alt.png',
            {
              bytes: galleryImage,
              contentType: 'image/png',
            },
          ],
        ]),
      ),
      supabaseClient: client,
    });

    expect(result.debugDedupe).toBe(true);
    expect(result.dedupeAudits).toHaveLength(1);
    expect(result.dedupeAudits[0]?.candidates).toEqual([
      expect.objectContaining({
        filename: '10316.png',
        imageTypeCandidate: 'hero',
        sha256Prefix: expect.any(String),
        slot: 'hero:0',
      }),
      expect.objectContaining({
        filename: '10316-alt.png',
        galleryRank: 1,
        gallerySuppressed: expect.any(Boolean),
        heroSimilarityDistance: expect.any(Number),
        imageTypeCandidate: 'gallery',
        perceptualHash: expect.any(String),
        slot: 'gallery:1',
      }),
    ]);
    expect(result.dedupeAudits[0]?.pairs).toEqual([
      expect.objectContaining({
        exactDuplicate: false,
        leftSlot: 'hero:0',
        pairType: 'hero-gallery',
        perceptualDistance: expect.any(Number),
        rightSlot: 'gallery:1',
        wouldDuplicateAtThresholds: expect.objectContaining({
          '5': expect.any(Boolean),
          '8': expect.any(Boolean),
          '10': expect.any(Boolean),
          '12': expect.any(Boolean),
          '16': expect.any(Boolean),
        }),
      }),
    ]);
    expect(result.dedupeAudits[0]?.recommendation).toContain('threshold');
    expect(result.heroSimilaritySuppressedCount).toEqual(expect.any(Number));
    expect(result.suppressedImages).toEqual(expect.any(Array));
    expect(upload).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  test('refuses debug dedupe in write mode', async () => {
    const { client } = createSetImageSyncSupabaseMock({
      catalogRows: [createCatalogRow()],
    });

    await expect(
      syncCatalogSetImages({
        debugDedupe: true,
        dryRun: false,
        fetchFn: createImageFetch(),
        supabaseClient: client,
      }),
    ).rejects.toThrow('--debug-dedupe is dry-run only');
  });

  test('writes hero, card, social, and thumbnail rows when write mode is enabled', async () => {
    const { client, upload, upsert } = createSetImageSyncSupabaseMock({
      catalogRows: [createCatalogRow()],
    });

    const result = await syncCatalogSetImages({
      dryRun: false,
      fetchFn: createImageFetch(),
      supabaseClient: client,
    });

    expect(result.uploadedBytes).toBeGreaterThan(0);
    expect(upload).toHaveBeenCalledTimes(4);
    expect(upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          image_type: 'hero',
          metadata_json: expect.objectContaining({
            storagePublicUrl:
              'https://storage.example.com/sets/10316/hero.webp',
          }),
          public_url: '/images/sets/10316/hero.webp',
          set_id: '10316',
          status: 'active',
          storage_path: 'sets/10316/hero.webp',
        }),
        expect.objectContaining({
          image_type: 'card',
          metadata_json: expect.objectContaining({
            storagePublicUrl:
              'https://storage.example.com/sets/10316/card.webp',
          }),
          public_url: '/images/sets/10316/card.webp',
          set_id: '10316',
          status: 'active',
          storage_path: 'sets/10316/card.webp',
        }),
        expect.objectContaining({
          image_type: 'social',
          metadata_json: expect.objectContaining({
            storagePublicUrl:
              'https://storage.example.com/sets/10316/social.jpg',
          }),
          public_url: '/images/sets/10316/social.jpg',
          set_id: '10316',
          status: 'active',
          storage_path: 'sets/10316/social.jpg',
        }),
        expect.objectContaining({
          image_type: 'thumbnail',
          metadata_json: expect.objectContaining({
            storagePublicUrl:
              'https://storage.example.com/sets/10316/thumbs/0.webp',
          }),
          public_url: '/images/sets/10316/thumbs/0.webp',
          set_id: '10316',
          status: 'active',
          storage_path: 'sets/10316/thumbs/0.webp',
        }),
      ]),
      {
        onConflict: 'set_id,image_type,sort_order',
      },
    );
  });

  test('marks a failed thumbnail upload without aborting the remaining variants', async () => {
    const storageError = {
      details: 'storage object write failed',
      message: 'Gateway timeout',
      statusCode: 504,
    };
    const { client, upload, upsert } = createSetImageSyncSupabaseMock({
      catalogRows: [createCatalogRow()],
      uploadErrorsByPath: {
        'sets/10316/thumbs/0.webp': storageError,
      },
    });

    const result = await syncCatalogSetImages({
      dryRun: false,
      fetchFn: createImageFetch(),
      supabaseClient: client,
    });

    expect(upload).toHaveBeenCalledTimes(4);
    expect(result.failedSetCount).toBe(0);
    expect(result.failedSourceCount).toBe(0);
    expect(result.failedVariantCount).toBe(1);
    expect(result.failedVariantSamples).toEqual([
      expect.objectContaining({
        bucket: 'catalog-set-images',
        details: 'storage object write failed',
        imageType: 'thumbnail',
        message: 'Gateway timeout',
        setId: '10316',
        sortOrder: 0,
        status: '504',
        storagePath: 'sets/10316/thumbs/0.webp',
      }),
    ]);
    expect(result.results[0]?.heroImageStored).toBe(true);
    expect(result.results[0]?.cardImageStored).toBe(true);
    expect(result.results[0]?.socialImageStored).toBe(true);
    expect(result.results[0]?.thumbnailImageStored).toBe(false);
    expect(result.uploadedBytes).toBeGreaterThan(0);
    expect(upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          image_type: 'hero',
          public_url: '/images/sets/10316/hero.webp',
          status: 'active',
          storage_path: 'sets/10316/hero.webp',
        }),
        expect.objectContaining({
          image_type: 'card',
          public_url: '/images/sets/10316/card.webp',
          status: 'active',
          storage_path: 'sets/10316/card.webp',
        }),
        expect.objectContaining({
          image_type: 'social',
          public_url: '/images/sets/10316/social.jpg',
          status: 'active',
          storage_path: 'sets/10316/social.jpg',
        }),
        expect.objectContaining({
          byte_size: expect.any(Number),
          content_type: 'image/webp',
          image_type: 'thumbnail',
          metadata_json: expect.objectContaining({
            uploadError: expect.objectContaining({
              bucket: 'catalog-set-images',
              byteSize: expect.any(Number),
              details: 'storage object write failed',
              message: 'Gateway timeout',
              retryCount: 0,
              status: '504',
              storagePath: 'sets/10316/thumbs/0.webp',
            }),
          }),
          public_url: null,
          set_id: '10316',
          status: 'failed',
          storage_bucket: 'catalog-set-images',
          storage_path: 'sets/10316/thumbs/0.webp',
        }),
      ]),
      {
        onConflict: 'set_id,image_type,sort_order',
      },
    );
  });

  test('generates social images as 1200x630 JPEGs on a white canvas', async () => {
    const { client, upload, upsert } = createSetImageSyncSupabaseMock({
      catalogRows: [createCatalogRow()],
    });

    await syncCatalogSetImages({
      dryRun: false,
      fetchFn: createImageFetch({
        bytes: await createTransparentProductImage(),
      }),
      supabaseClient: client,
    });

    const socialUpload = upload.mock.calls.find(
      ([storagePath]) => storagePath === 'sets/10316/social.jpg',
    );
    expect(socialUpload).toBeDefined();
    expect(socialUpload?.[2]).toEqual(
      expect.objectContaining({
        contentType: 'image/jpeg',
        upsert: true,
      }),
    );

    const socialBytes = socialUpload?.[1] as Buffer;
    const metadata = await sharp(socialBytes).metadata();
    expect(metadata.format).toBe('jpeg');
    expect(metadata.width).toBe(1200);
    expect(metadata.height).toBe(630);

    const raw = await sharp(socialBytes).raw().toBuffer({
      resolveWithObject: true,
    });
    const topLeftPixel = [...raw.data.slice(0, 3)];
    expect(topLeftPixel[0]).toBeGreaterThanOrEqual(245);
    expect(topLeftPixel[1]).toBeGreaterThanOrEqual(245);
    expect(topLeftPixel[2]).toBeGreaterThanOrEqual(245);
    expect(upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          content_type: 'image/jpeg',
          height: 630,
          image_type: 'social',
          public_url: '/images/sets/10316/social.jpg',
          storage_path: 'sets/10316/social.jpg',
          width: 1200,
        }),
      ]),
      {
        onConflict: 'set_id,image_type,sort_order',
      },
    );
  });

  test('classifies box filenames as box front and the current hero as primary model', async () => {
    const { client, upsert } = createSetImageSyncSupabaseMock({
      catalogRows: [
        createCatalogRow({
          image_url: 'https://cdn.example.com/10316-product.png',
        }),
      ],
      sourceMetadataRows: [
        {
          catalog_set_id: '10316',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            images: [
              {
                imageUrl: 'https://brickset.example.com/10316-box-front.png',
                sourceField: 'additionalImages',
                type: 'additional',
              },
              {
                imageUrl: 'https://brickset.example.com/10316_boxprod_v29.jpg',
                sourceField: 'additionalImages',
                type: 'additional',
              },
            ],
          },
          source: 'brickset',
        },
      ],
    });
    const heroImage = await createTestImage({
      box: {
        color: '#0d5f9a',
        height: 58,
        left: 48,
        top: 32,
        width: 64,
      },
    });
    const boxImage = await createTestImage({
      background: '#f5f5f5',
      box: {
        color: '#c82020',
        height: 72,
        left: 34,
        top: 24,
        width: 92,
      },
    });

    const result = await syncCatalogSetImages({
      dryRun: false,
      fetchFn: createImageFetchByUrl(
        new Map([
          [
            'https://cdn.example.com/10316-product.png',
            {
              bytes: heroImage,
              contentType: 'image/png',
            },
          ],
          [
            'https://brickset.example.com/10316-box-front.png',
            {
              bytes: boxImage,
              contentType: 'image/png',
            },
          ],
          [
            'https://brickset.example.com/10316_boxprod_v29.jpg',
            {
              bytes: await createTestImage({
                background: '#f6f6f6',
                box: {
                  color: '#d42020',
                  height: 70,
                  left: 38,
                  top: 28,
                  width: 86,
                },
              }),
              contentType: 'image/jpeg',
            },
          ],
        ]),
      ),
      supabaseClient: client,
    });

    expect(result.roleCounts.model_primary).toBe(1);
    expect(result.roleCounts.box_front).toBe(2);
    expect(upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          image_role: 'model_primary',
          image_type: 'hero',
          metadata_json: expect.objectContaining({
            heroCandidate: true,
            imageUsePreferences: expect.objectContaining({
              collectionPage: 1,
              newsArticle: 3,
              themePage: 1,
            }),
            roleClassification: expect.objectContaining({
              reason: 'current catalog hero image',
              role: 'model_primary',
              source: 'deterministic-v2',
            }),
          }),
        }),
        expect.objectContaining({
          image_role: 'box_front',
          image_type: 'gallery',
          metadata_json: expect.objectContaining({
            galleryRank: 1,
            galleryRoleRank: 0,
            gallerySuppressed: false,
            heroCandidate: false,
            imageUsePreferences: expect.objectContaining({
              collectionPage: 2,
              newsArticle: null,
              themePage: null,
            }),
            roleClassification: expect.objectContaining({
              reason: 'filename contains box/package language',
              role: 'box_front',
              source: 'deterministic-v2',
            }),
          }),
        }),
        expect.objectContaining({
          image_role: 'box_front',
          image_type: 'gallery',
          source_url: 'https://brickset.example.com/10316_boxprod_v29.jpg',
          metadata_json: expect.objectContaining({
            gallerySuppressed: false,
            roleClassification: expect.objectContaining({
              reason: 'filename contains box/package language',
              role: 'box_front',
              source: 'deterministic-v2',
            }),
          }),
        }),
      ]),
      {
        onConflict: 'set_id,image_type,sort_order',
      },
    );
  });

  test('ranks gallery roles in LEGO-like order while suppressing near-hero model images', async () => {
    const heroImage = await createTestImage({
      box: {
        color: '#111111',
        height: 48,
        left: 24,
        top: 32,
        width: 52,
      },
    });
    const imageByUrl = new Map([
      [
        'https://cdn.example.com/10316.png',
        {
          bytes: heroImage,
          contentType: 'image/png',
        },
      ],
      [
        'https://brickset.example.com/10316-near-model.png',
        {
          bytes: await createTestImage({
            box: {
              color: '#111111',
              height: 48,
              left: 92,
              top: 32,
              width: 52,
            },
          }),
          contentType: 'image/png',
        },
      ],
      [
        'https://brickset.example.com/10316-box-front.png',
        {
          bytes: await createTestImage({
            box: {
              color: '#c82020',
              height: 72,
              left: 34,
              top: 24,
              width: 92,
            },
          }),
          contentType: 'image/png',
        },
      ],
      [
        'https://brickset.example.com/10316-detail-closeup.png',
        {
          bytes: await createTestImage({
            background: '#f2f2f2',
            box: {
              color: '#1658a8',
              height: 80,
              left: 20,
              top: 20,
              width: 120,
            },
          }),
          contentType: 'image/png',
        },
      ],
      [
        'https://brickset.example.com/10316-minifigure.png',
        {
          bytes: await createTestImage({
            background: '#e8e8e8',
            box: {
              color: '#f4c542',
              height: 70,
              left: 55,
              top: 25,
              width: 50,
            },
          }),
          contentType: 'image/png',
        },
      ],
      [
        'https://brickset.example.com/10316-lifestyle-room.png',
        {
          bytes: await createTestImage({
            background: '#d0cbc4',
            box: {
              color: '#446b48',
              height: 55,
              left: 50,
              top: 40,
              width: 70,
            },
          }),
          contentType: 'image/png',
        },
      ],
      [
        'https://brickset.example.com/10316-build-parts.png',
        {
          bytes: await createTestImage({
            background: '#ececec',
            box: {
              color: '#777777',
              height: 30,
              left: 28,
              top: 45,
              width: 108,
            },
          }),
          contentType: 'image/png',
        },
      ],
      [
        'https://brickset.example.com/10316-box-back.png',
        {
          bytes: await createTestImage({
            background: '#f3f3f3',
            box: {
              color: '#8d2a2a',
              height: 82,
              left: 18,
              top: 16,
              width: 62,
            },
          }),
          contentType: 'image/png',
        },
      ],
      [
        'https://brickset.example.com/10316-lifestyle-people.png',
        {
          bytes: await createTestImage({
            background: '#d6d0c5',
            box: {
              color: '#2e6d52',
              height: 45,
              left: 52,
              top: 42,
              width: 56,
            },
          }),
          contentType: 'image/png',
        },
      ],
      [
        'https://brickset.example.com/10316-logo.png',
        {
          bytes: await createTestImage({
            background: '#f8f8f8',
            box: {
              color: '#e02424',
              height: 60,
              left: 45,
              top: 30,
              width: 70,
            },
          }),
          contentType: 'image/png',
        },
      ],
      [
        'https://brickset.example.com/10316-alt-model.png',
        {
          bytes: await createTestImage({
            box: {
              color: '#205f3f',
              height: 88,
              left: 8,
              top: 16,
              width: 128,
            },
          }),
          contentType: 'image/png',
        },
      ],
      [
        'https://brickset.example.com/10316-alt-view.png',
        {
          bytes: await createTestImage({
            background: '#777777',
            box: {
              color: '#222222',
              height: 40,
              left: 60,
              top: 40,
              width: 40,
            },
          }),
          contentType: 'image/png',
        },
      ],
    ]);
    const sourceImages = [...imageByUrl.keys()]
      .filter((url) => !url.includes('cdn.example.com'))
      .map((imageUrl) => ({
        imageUrl,
        sourceField: 'additionalImages',
        type: 'additional',
      }));
    const { client, upsert } = createSetImageSyncSupabaseMock({
      catalogRows: [createCatalogRow()],
      sourceMetadataRows: [
        {
          catalog_set_id: '10316',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            images: sourceImages,
          },
          source: 'brickset',
        },
      ],
    });

    const result = await syncCatalogSetImages({
      dryRun: false,
      fetchFn: createImageFetchByUrl(imageByUrl),
      supabaseClient: client,
    });

    const upsertRows = upsert.mock.calls[0]?.[0] as
      | readonly Record<string, unknown>[]
      | undefined;
    const galleryRowsBySourceUrl = new Map(
      (upsertRows ?? [])
        .filter((row) => row['image_type'] === 'gallery')
        .map((row) => [row['source_url'], row]),
    );
    const metadataFor = (sourceUrl: string) =>
      galleryRowsBySourceUrl.get(sourceUrl)?.['metadata_json'] as
        | Record<string, unknown>
        | undefined;

    expect(result.results[0]?.heroSimilaritySuppressedCount).toBe(1);
    expect(
      metadataFor('https://brickset.example.com/10316-box-front.png'),
    ).toMatchObject({
      galleryRank: 1,
      galleryRoleRank: 0,
      gallerySuppressed: false,
      roleClassification: expect.objectContaining({
        role: 'box_front',
      }),
    });
    expect(
      metadataFor('https://brickset.example.com/10316-lifestyle-room.png'),
    ).toMatchObject({
      galleryRank: 2,
      galleryRoleRank: 1,
      roleClassification: expect.objectContaining({
        role: 'lifestyle_room',
      }),
    });
    expect(
      metadataFor('https://brickset.example.com/10316-alt-model.png'),
    ).toMatchObject({
      galleryRank: 3,
      galleryRoleRank: 2,
      gallerySuppressed: false,
      roleClassification: expect.objectContaining({
        role: 'model_secondary',
      }),
    });
    expect(
      metadataFor('https://brickset.example.com/10316-detail-closeup.png'),
    ).toMatchObject({
      galleryRank: 4,
      galleryRoleRank: 3,
    });
    expect(
      metadataFor('https://brickset.example.com/10316-minifigure.png'),
    ).toMatchObject({
      galleryRank: 5,
      galleryRoleRank: 4,
    });
    expect(
      metadataFor('https://brickset.example.com/10316-build-parts.png'),
    ).toMatchObject({
      galleryRank: 6,
      galleryRoleRank: 5,
    });
    expect(
      metadataFor('https://brickset.example.com/10316-box-back.png'),
    ).toMatchObject({
      galleryRank: 7,
      galleryRoleRank: 6,
      roleClassification: expect.objectContaining({
        role: 'box_back',
      }),
    });
    expect(
      metadataFor('https://brickset.example.com/10316-lifestyle-people.png'),
    ).toMatchObject({
      galleryRank: 8,
      galleryRoleRank: 7,
      roleClassification: expect.objectContaining({
        role: 'lifestyle_people',
      }),
    });
    expect(
      metadataFor('https://brickset.example.com/10316-near-model.png'),
    ).toMatchObject({
      galleryRank: 9,
      galleryRoleRank: 8,
      gallerySuppressed: true,
      roleClassification: expect.objectContaining({
        role: 'model_primary',
      }),
    });
    expect(
      metadataFor('https://brickset.example.com/10316-logo.png'),
    ).toMatchObject({
      galleryRank: 10,
      galleryRoleRank: 9,
    });
    expect(
      metadataFor('https://brickset.example.com/10316-alt-view.png'),
    ).toMatchObject({
      galleryRank: 11,
      galleryRoleRank: 10,
    });
    expect(
      result.results[0]?.visibleGalleryOrder.map((image) => image.slot),
    ).toEqual([
      'gallery:2',
      'gallery:5',
      'gallery:10',
      'gallery:3',
      'gallery:4',
      'gallery:6',
      'gallery:7',
      'gallery:8',
      'gallery:9',
      'gallery:11',
    ]);
    expect(
      (upsertRows ?? [])
        .filter((row) => row['image_type'] === 'thumbnail')
        .map((row) => row['sort_order'])
        .sort((left, right) => Number(left) - Number(right)),
    ).toEqual([0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  test('uses unknown role when classification is not confident', async () => {
    const { client, upsert } = createSetImageSyncSupabaseMock({
      catalogRows: [
        createCatalogRow({
          image_url: 'https://cdn.example.com/10316.png',
        }),
      ],
      sourceMetadataRows: [
        {
          catalog_set_id: '10316',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            images: [
              {
                imageUrl: 'https://brickset.example.com/10316-alt-view.png',
                sourceField: 'additionalImages',
                type: 'additional',
              },
            ],
          },
          source: 'brickset',
        },
      ],
    });

    await syncCatalogSetImages({
      dryRun: false,
      fetchFn: createImageFetchByUrl(
        new Map([
          [
            'https://cdn.example.com/10316.png',
            {
              bytes: await createTestImage(),
              contentType: 'image/png',
            },
          ],
          [
            'https://brickset.example.com/10316-alt-view.png',
            {
              bytes: await createTestImage({
                background: '#335577',
              }),
              contentType: 'image/png',
            },
          ],
        ]),
      ),
      supabaseClient: client,
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          image_role: 'unknown',
          image_type: 'gallery',
          metadata_json: expect.objectContaining({
            roleClassification: expect.objectContaining({
              reason: 'no reliable filename or background signal',
              role: 'unknown',
            }),
          }),
        }),
      ]),
      {
        onConflict: 'set_id,image_type,sort_order',
      },
    );
  });

  test('refreshes thumbnails without re-uploading full images', async () => {
    const { client, upload, upsert } = createSetImageSyncSupabaseMock({
      catalogRows: [createCatalogRow()],
    });

    const result = await syncCatalogSetImages({
      dryRun: false,
      fetchFn: createImageFetch(),
      refreshThumbnails: true,
      supabaseClient: client,
    });

    expect(result.refreshThumbnails).toBe(true);
    expect(result.results[0]?.imageCountByType.hero).toBe(0);
    expect(result.results[0]?.imageCountByType.card).toBe(0);
    expect(result.results[0]?.imageCountByType.social).toBe(0);
    expect(result.results[0]?.imageCountByType.thumbnail).toBe(1);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledWith(
      'sets/10316/thumbs/0.webp',
      expect.any(Buffer),
      expect.objectContaining({
        contentType: 'image/webp',
        upsert: true,
      }),
    );
    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          image_type: 'thumbnail',
          metadata_json: expect.objectContaining({
            storagePublicUrl:
              'https://storage.example.com/sets/10316/thumbs/0.webp',
          }),
          public_url: '/images/sets/10316/thumbs/0.webp',
          set_id: '10316',
          status: 'active',
          storage_path: 'sets/10316/thumbs/0.webp',
        }),
      ],
      {
        onConflict: 'set_id,image_type,sort_order',
      },
    );
  });

  test('refreshes thumbnails for hero and visible gallery images only', async () => {
    const imageByUrl = new Map([
      [
        'https://cdn.example.com/10316.png',
        {
          bytes: await createTestImage({
            background: '#ffffff',
            box: {
              color: '#205f3f',
              height: 80,
              left: 40,
              top: 20,
              width: 80,
            },
          }),
          contentType: 'image/png',
        },
      ],
      [
        'https://brickset.example.com/10316-box-front.png',
        {
          bytes: await createTestImage({
            background: '#eeeeee',
            box: {
              color: '#111111',
              height: 84,
              left: 20,
              top: 18,
              width: 120,
            },
          }),
          contentType: 'image/png',
        },
      ],
      [
        'https://brickset.example.com/10316-detail-closeup.png',
        {
          bytes: await createTestImage({
            background: '#f3f3f3',
            box: {
              color: '#1658a8',
              height: 70,
              left: 35,
              top: 25,
              width: 90,
            },
          }),
          contentType: 'image/png',
        },
      ],
    ]);
    const { client, upload, upsert } = createSetImageSyncSupabaseMock({
      catalogRows: [createCatalogRow()],
      sourceMetadataRows: [
        {
          catalog_set_id: '10316',
          locale: 'en-US',
          match_confidence: 'exact_set_number',
          metadata_json: {
            images: [
              {
                imageUrl: 'https://brickset.example.com/10316-box-front.png',
                sourceField: 'additionalImages',
                type: 'additional',
              },
              {
                imageUrl:
                  'https://brickset.example.com/10316-detail-closeup.png',
                sourceField: 'additionalImages',
                type: 'additional',
              },
            ],
          },
          source: 'brickset',
        },
      ],
    });

    const result = await syncCatalogSetImages({
      dryRun: false,
      fetchFn: createImageFetchByUrl(imageByUrl),
      refreshThumbnails: true,
      supabaseClient: client,
    });

    expect(result.failedSetCount).toBe(0);
    expect(result.results[0]?.imageCountByType.hero).toBe(0);
    expect(result.results[0]?.imageCountByType.card).toBe(0);
    expect(result.results[0]?.imageCountByType.social).toBe(0);
    expect(result.results[0]?.imageCountByType.thumbnail).toBe(3);
    expect(upload.mock.calls.map(([storagePath]) => storagePath)).toEqual([
      'sets/10316/thumbs/0.webp',
      'sets/10316/thumbs/1.webp',
      'sets/10316/thumbs/2.webp',
    ]);
    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          image_type: 'thumbnail',
          sort_order: 0,
          storage_path: 'sets/10316/thumbs/0.webp',
        }),
        expect.objectContaining({
          image_type: 'thumbnail',
          sort_order: 1,
          storage_path: 'sets/10316/thumbs/1.webp',
        }),
        expect.objectContaining({
          image_type: 'thumbnail',
          sort_order: 2,
          storage_path: 'sets/10316/thumbs/2.webp',
        }),
      ],
      {
        onConflict: 'set_id,image_type,sort_order',
      },
    );
  });

  test('reports orphan thumbnail rows in dry-run diagnostics', async () => {
    const { client, upload, upsert } = createSetImageSyncSupabaseMock({
      catalogRows: [createCatalogRow()],
      imageRows: [
        createStoredImageRow(),
        createStoredImageRow({
          image_type: 'gallery',
          metadata_json: {
            gallerySuppressed: true,
          },
          public_url: '/images/sets/10316/gallery/1.webp',
          sort_order: 1,
          storage_path: 'sets/10316/gallery/1.webp',
        }),
        createStoredImageRow({
          image_type: 'thumbnail',
          public_url: '/images/sets/10316/thumbs/1.webp',
          sort_order: 1,
          storage_path: 'sets/10316/thumbs/1.webp',
        }),
        createStoredImageRow({
          image_type: 'gallery',
          metadata_json: {
            gallerySuppressed: false,
          },
          public_url: '/images/sets/10316/gallery/2.webp',
          sort_order: 2,
          storage_path: 'sets/10316/gallery/2.webp',
        }),
        createStoredImageRow({
          image_type: 'thumbnail',
          public_url: '/images/sets/10316/thumbs/2.webp',
          sort_order: 2,
          storage_path: 'sets/10316/thumbs/2.webp',
        }),
      ],
    });

    const result = await syncCatalogSetImages({
      dryRun: true,
      fetchFn: createImageFetch(),
      refreshThumbnails: true,
      supabaseClient: client,
    });

    expect(upload).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(result.orphanThumbnailRowCount).toBe(1);
    expect(result.orphanThumbnailRows).toEqual([
      {
        publicUrl: '/images/sets/10316/thumbs/1.webp',
        reason: 'no matching active visible hero/gallery image',
        setId: '10316',
        sortOrder: 1,
        storagePath: 'sets/10316/thumbs/1.webp',
      },
    ]);
  });

  test('refreshes card images without re-uploading other variants', async () => {
    const { client, upload, upsert } = createSetImageSyncSupabaseMock({
      catalogRows: [createCatalogRow()],
    });

    const result = await syncCatalogSetImages({
      dryRun: false,
      fetchFn: createImageFetch(),
      refreshCard: true,
      supabaseClient: client,
    });

    expect(result.refreshCard).toBe(true);
    expect(result.results[0]?.imageCountByType.hero).toBe(0);
    expect(result.results[0]?.imageCountByType.card).toBe(1);
    expect(result.results[0]?.imageCountByType.gallery).toBe(0);
    expect(result.results[0]?.imageCountByType.social).toBe(0);
    expect(result.results[0]?.imageCountByType.thumbnail).toBe(0);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledWith(
      'sets/10316/card.webp',
      expect.any(Buffer),
      expect.objectContaining({
        contentType: 'image/webp',
        upsert: true,
      }),
    );
    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          content_type: 'image/webp',
          image_type: 'card',
          public_url: '/images/sets/10316/card.webp',
          set_id: '10316',
          status: 'active',
          storage_path: 'sets/10316/card.webp',
          width: 1,
        }),
      ],
      {
        onConflict: 'set_id,image_type,sort_order',
      },
    );
  });

  test('refreshes social images without re-uploading other variants', async () => {
    const { client, upload, upsert } = createSetImageSyncSupabaseMock({
      catalogRows: [createCatalogRow()],
    });

    const result = await syncCatalogSetImages({
      dryRun: false,
      fetchFn: createImageFetch({
        bytes: await createTransparentProductImage(),
      }),
      refreshSocial: true,
      supabaseClient: client,
    });

    expect(result.refreshSocial).toBe(true);
    expect(result.results[0]?.imageCountByType.hero).toBe(0);
    expect(result.results[0]?.imageCountByType.card).toBe(0);
    expect(result.results[0]?.imageCountByType.gallery).toBe(0);
    expect(result.results[0]?.imageCountByType.social).toBe(1);
    expect(result.results[0]?.imageCountByType.thumbnail).toBe(0);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledWith(
      'sets/10316/social.jpg',
      expect.any(Buffer),
      expect.objectContaining({
        contentType: 'image/jpeg',
        upsert: true,
      }),
    );
    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          content_type: 'image/jpeg',
          height: 630,
          image_type: 'social',
          public_url: '/images/sets/10316/social.jpg',
          set_id: '10316',
          status: 'active',
          storage_path: 'sets/10316/social.jpg',
          width: 1200,
        }),
      ],
      {
        onConflict: 'set_id,image_type,sort_order',
      },
    );
  });

  test('refreshes image metadata without uploading full images', async () => {
    const { client, upload, upsert } = createSetImageSyncSupabaseMock({
      catalogRows: [createCatalogRow()],
      imageRows: [
        createStoredImageRow(),
        createStoredImageRow({
          image_type: 'social',
          public_url:
            'https://production-storage.example.com/storage/v1/object/public/catalog-set-images/sets/10316/social.jpg',
          storage_path: 'sets/10316/social.jpg',
        }),
      ],
    });

    const result = await syncCatalogSetImages({
      dryRun: false,
      fetchFn: createImageFetch({
        bytes: await createTestImage({
          box: {
            color: '#123456',
            height: 54,
            left: 52,
            top: 34,
            width: 56,
          },
        }),
      }),
      refreshImageMetadata: true,
      supabaseClient: client,
    });

    expect(result.refreshImageMetadata).toBe(true);
    expect(result.estimatedUploadBytes).toBe(0);
    expect(upload).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          image_role: 'model_primary',
          image_type: 'hero',
          perceptual_hash: expect.any(String),
          metadata_json: expect.objectContaining({
            storagePublicUrl:
              'https://production-storage.example.com/storage/v1/object/public/catalog-set-images/sets/10316/hero.webp',
          }),
          public_url: '/images/sets/10316/hero.webp',
          status: 'active',
        }),
        expect.objectContaining({
          image_role: 'model_primary',
          image_type: 'social',
          perceptual_hash: expect.any(String),
          metadata_json: expect.objectContaining({
            storagePublicUrl:
              'https://production-storage.example.com/storage/v1/object/public/catalog-set-images/sets/10316/social.jpg',
          }),
          public_url: '/images/sets/10316/social.jpg',
          status: 'active',
        }),
      ],
      {
        onConflict: 'set_id,image_type,sort_order',
      },
    );
  });

  test('refresh thumbnail missing-only mode selects stored-image sets without thumbnails', async () => {
    const { client } = createSetImageSyncSupabaseMock({
      catalogRows: [
        createCatalogRow(),
        createCatalogRow({
          image_url: 'https://cdn.example.com/10317.png',
          name: 'Bag End',
          set_id: '10317',
          source_set_number: '10317-1',
        }),
        createCatalogRow({
          image_url: 'https://cdn.example.com/10318.png',
          name: 'Minas Tirith',
          set_id: '10318',
          source_set_number: '10318-1',
        }),
      ],
      imageRows: [
        createStoredImageRow(),
        createStoredImageRow({
          public_url:
            'https://production-storage.example.com/storage/v1/object/public/catalog-set-images/sets/10317/hero.webp',
          set_id: '10317',
          storage_path: 'sets/10317/hero.webp',
        }),
        createStoredImageRow({
          image_type: 'thumbnail',
          public_url:
            'https://production-storage.example.com/storage/v1/object/public/catalog-set-images/sets/10317/thumbs/0.webp',
          set_id: '10317',
          storage_path: 'sets/10317/thumbs/0.webp',
        }),
      ],
    });

    const result = await syncCatalogSetImages({
      dryRun: true,
      fetchFn: createImageFetch(),
      missingOnly: true,
      refreshThumbnails: true,
      supabaseClient: client,
    });

    expect(result.selectedSetCount).toBe(1);
    expect(result.results.map((item) => item.setId)).toEqual(['10316']);
    expect(result.results[0]?.imageCountByType.thumbnail).toBe(1);
  });

  test('writes metadata rows to the metadata client while storage stays on the storage client', async () => {
    const metadata = createSetImageSyncSupabaseMock({
      catalogRows: [createCatalogRow()],
    });
    const storage = createSetImageSyncSupabaseMock({
      catalogRows: [],
    });

    await syncCatalogSetImages({
      dryRun: false,
      fetchFn: createImageFetch(),
      metadataSupabaseClient: metadata.client,
      storageSupabaseClient: storage.client,
    });

    expect(storage.upload).toHaveBeenCalledTimes(4);
    expect(storage.getPublicUrl).toHaveBeenCalledWith('sets/10316/hero.webp');
    expect(storage.getPublicUrl).toHaveBeenCalledWith('sets/10316/card.webp');
    expect(storage.getPublicUrl).toHaveBeenCalledWith(
      'sets/10316/thumbs/0.webp',
    );
    expect(storage.upsert).not.toHaveBeenCalled();
    expect(metadata.upload).not.toHaveBeenCalled();
    expect(metadata.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          image_type: 'hero',
          metadata_json: expect.objectContaining({
            storagePublicUrl:
              'https://storage.example.com/sets/10316/hero.webp',
          }),
          public_url: '/images/sets/10316/hero.webp',
          set_id: '10316',
        }),
      ]),
      {
        onConflict: 'set_id,image_type,sort_order',
      },
    );
  });

  test('copies production image metadata to staging without storage writes', async () => {
    const source = createSetImageSyncSupabaseMock({
      catalogRows: [],
      imageRows: [
        createStoredImageRow(),
        createStoredImageRow({
          image_type: 'social',
          public_url:
            'https://production-storage.example.com/storage/v1/object/public/catalog-set-images/sets/10316/social.jpg',
          storage_path: 'sets/10316/social.jpg',
        }),
      ],
    });
    const target = createSetImageSyncSupabaseMock({
      catalogRows: [],
    });

    const result = await copyCatalogSetImageMetadata({
      dryRun: false,
      setIds: ['10316'],
      sourceSupabaseClient: source.client,
      targetSupabaseClient: target.client,
    });

    expect(result).toEqual({
      copiedCount: 2,
      dryRun: false,
      readCount: 2,
      setIds: ['10316'],
      skippedCount: 0,
      source: 'production',
      target: 'staging',
    });
    expect(target.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          image_type: 'hero',
          metadata_json: expect.objectContaining({
            storagePublicUrl:
              'https://production-storage.example.com/storage/v1/object/public/catalog-set-images/sets/10316/hero.webp',
          }),
          public_url: '/images/sets/10316/hero.webp',
        }),
        expect.objectContaining({
          image_type: 'social',
          metadata_json: expect.objectContaining({
            storagePublicUrl:
              'https://production-storage.example.com/storage/v1/object/public/catalog-set-images/sets/10316/social.jpg',
          }),
          public_url: '/images/sets/10316/social.jpg',
        }),
      ]),
      {
        onConflict: 'set_id,image_type,sort_order',
      },
    );
    expect(source.upload).not.toHaveBeenCalled();
    expect(target.upload).not.toHaveBeenCalled();
  });

  test('rewrites existing image metadata public URLs without storage writes', async () => {
    const { client, upload, upsert } = createSetImageSyncSupabaseMock({
      catalogRows: [],
      imageRows: [
        createStoredImageRow(),
        createStoredImageRow({
          image_type: 'social',
          public_url: 'https://www.brickhunt.nl/images/sets/10316/social.jpg',
          storage_path: 'sets/10316/social.jpg',
        }),
      ],
    });

    const result = await rewriteCatalogSetImagePublicUrls({
      dryRun: false,
      setIds: ['10316'],
      supabaseClient: client,
    });

    expect(result).toEqual({
      dryRun: false,
      readCount: 2,
      rewrittenCount: 2,
      setIds: ['10316'],
      skippedCount: 0,
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          image_type: 'hero',
          metadata_json: expect.objectContaining({
            storagePublicUrl:
              'https://production-storage.example.com/storage/v1/object/public/catalog-set-images/sets/10316/hero.webp',
          }),
          public_url: '/images/sets/10316/hero.webp',
        }),
        expect.objectContaining({
          image_type: 'social',
          public_url: '/images/sets/10316/social.jpg',
        }),
      ]),
      {
        onConflict: 'set_id,image_type,sort_order',
      },
    );
    expect(upload).not.toHaveBeenCalled();
  });

  test('dry-run metadata copy performs no writes', async () => {
    const source = createSetImageSyncSupabaseMock({
      catalogRows: [],
      imageRows: [createStoredImageRow()],
    });
    const target = createSetImageSyncSupabaseMock({
      catalogRows: [],
    });

    const result = await copyCatalogSetImageMetadata({
      dryRun: true,
      sourceSupabaseClient: source.client,
      targetSupabaseClient: target.client,
    });

    expect(result.copiedCount).toBe(0);
    expect(result.readCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(target.upsert).not.toHaveBeenCalled();
    expect(source.upload).not.toHaveBeenCalled();
    expect(target.upload).not.toHaveBeenCalled();
  });

  test('failed downloads do not break the sync run', async () => {
    const { client } = createSetImageSyncSupabaseMock({
      catalogRows: [createCatalogRow()],
    });

    const result = await syncCatalogSetImages({
      dryRun: true,
      fetchFn: createImageFetch({
        ok: false,
      }),
      supabaseClient: client,
    });

    expect(result.failedSetCount).toBe(1);
    expect(result.failedSourceCount).toBe(1);
    expect(result.results[0]?.heroImageStored).toBe(false);
    expect(result.results[0]?.warnings[0]).toContain(
      'Remote image returned 404',
    );
  });
});
