import { describe, expect, test, vi } from 'vitest';
import {
  approveCommerceDiscoveryCandidate,
  createCommerceOfferSeedFromDiscoveryCandidate,
  runCommerceMerchantDiscovery,
} from './commerce-discovery-data-access-server';

describe('commerce discovery data access server', () => {
  test('runs discovery against a direct merchant hit and stores the candidate separately from offer seeds', async () => {
    const merchantOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'merchant-1',
          slug: 'misterbricks',
          name: 'MisterBricks',
          is_active: false,
          source_type: 'direct',
          affiliate_network: null,
          notes: null,
          created_at: '2026-04-16T08:00:00.000Z',
          updated_at: '2026-04-16T08:00:00.000Z',
        },
      ],
      error: null,
    });
    const discoveryRunInsertSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'run-1',
        set_id: '10316',
        merchant_id: 'merchant-1',
        search_query: '10316',
        search_url: 'https://misterbricks.nl/catalogsearch/result/?q=10316',
        status: 'running',
        candidate_count: 0,
        error_message: null,
        finished_at: null,
        created_at: '2026-04-16T08:00:00.000Z',
        updated_at: '2026-04-16T08:00:00.000Z',
      },
      error: null,
    });
    const discoveryRunInsertSelect = vi.fn(() => ({
      single: discoveryRunInsertSingle,
    }));
    const discoveryRunInsert = vi.fn(() => ({
      select: discoveryRunInsertSelect,
    }));
    const discoveryRunFinalizeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'run-1',
        set_id: '10316',
        merchant_id: 'merchant-1',
        search_query: '10316',
        search_url: 'https://misterbricks.nl/catalogsearch/result/?q=10316',
        status: 'success',
        candidate_count: 1,
        error_message: null,
        finished_at: '2026-04-16T08:01:00.000Z',
        created_at: '2026-04-16T08:00:00.000Z',
        updated_at: '2026-04-16T08:01:00.000Z',
      },
      error: null,
    });
    const discoveryRunFinalizeSelect = vi.fn(() => ({
      single: discoveryRunFinalizeSingle,
    }));
    const discoveryRunFinalizeEq = vi.fn(() => ({
      select: discoveryRunFinalizeSelect,
    }));
    const discoveryRunUpdate = vi.fn(() => ({
      eq: discoveryRunFinalizeEq,
    }));
    const discoveryCandidatesInsert = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'candidate-1',
          discovery_run_id: 'run-1',
          set_id: '10316',
          merchant_id: 'merchant-1',
          candidate_title: 'LEGO Icons 10316 The Lord of the Rings: Rivendell',
          candidate_url:
            'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html',
          canonical_url:
            'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html',
          price_minor: 49995,
          currency_code: 'EUR',
          availability: 'out_of_stock',
          detected_set_id: '10316',
          confidence_score: 100,
          status: 'auto_approved',
          match_reasons: [
            'Exact setnummer 10316 staat in de titel.',
            'Setnummer staat ook in de URL.',
          ],
          source_rank: 1,
          review_status: 'pending',
          offer_seed_id: null,
          created_at: '2026-04-16T08:00:10.000Z',
          updated_at: '2026-04-16T08:00:10.000Z',
        },
      ],
      error: null,
    });
    const discoveryCandidatesFromInsert = vi.fn(() => ({
      select: discoveryCandidatesInsert,
    }));
    const from = vi.fn((table: string) => {
      if (table === 'commerce_merchants') {
        return {
          select: vi.fn(() => ({
            order: merchantOrder,
          })),
        };
      }

      if (table === 'commerce_merchant_discovery_runs') {
        return {
          insert: discoveryRunInsert,
          update: discoveryRunUpdate,
        };
      }

      if (table === 'commerce_merchant_discovery_candidates') {
        return {
          insert: discoveryCandidatesFromInsert,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      text: async () => `
        <html>
          <head>
            <title>LEGO Icons 10316 The Lord of the Rings: Rivendell</title>
            <link rel="canonical" href="https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html" />
            <meta property="product:price:amount" content="499.95" />
            <meta property="product:price:currency" content="EUR" />
            <script type="application/ld+json">
              {
                "@context": "http://schema.org",
                "@type": "Product",
                "name": "LEGO Icons 10316 The Lord of the Rings: Rivendell",
                "sku": "10316",
                "offers": [
                  {
                    "@type": "Offer",
                    "availability": "http://schema.org/OutOfStock",
                    "price": 499.95,
                    "priceCurrency": "EUR",
                    "url": "https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html"
                  }
                ]
              }
            </script>
          </head>
        </html>
      `,
      url: 'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html',
    })) as typeof fetch;

    const result = await runCommerceMerchantDiscovery({
      input: {
        setId: '10316',
        merchantId: 'merchant-1',
      },
      fetchImpl,
      supabaseClient: { from } as never,
    });

    expect(result.run.status).toBe('success');
    expect(result.candidates).toEqual([
      expect.objectContaining({
        candidateTitle: 'LEGO Icons 10316 The Lord of the Rings: Rivendell',
        priceMinor: 49995,
        availability: 'out_of_stock',
        status: 'auto_approved',
      }),
    ]);
    expect(discoveryCandidatesFromInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        candidate_title: 'LEGO Icons 10316 The Lord of the Rings: Rivendell',
        canonical_url:
          'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html',
        confidence_score: 100,
        status: 'auto_approved',
      }),
    ]);
  });

  test('marks the discovery run as failed when the merchant search page is blocked', async () => {
    const merchantOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'merchant-2',
          slug: 'proshop',
          name: 'Proshop',
          is_active: false,
          source_type: 'direct',
          affiliate_network: null,
          notes: null,
          created_at: '2026-04-16T08:00:00.000Z',
          updated_at: '2026-04-16T08:00:00.000Z',
        },
      ],
      error: null,
    });
    const discoveryRunInsertSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'run-2',
        set_id: '10316',
        merchant_id: 'merchant-2',
        search_query: '10316',
        search_url: 'https://www.proshop.nl/?s=10316',
        status: 'running',
        candidate_count: 0,
        error_message: null,
        finished_at: null,
        created_at: '2026-04-16T08:00:00.000Z',
        updated_at: '2026-04-16T08:00:00.000Z',
      },
      error: null,
    });
    const discoveryRunFinalizeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'run-2',
        set_id: '10316',
        merchant_id: 'merchant-2',
        search_query: '10316',
        search_url: 'https://www.proshop.nl/?s=10316',
        status: 'failed',
        candidate_count: 0,
        error_message: 'Merchant search page returned a Cloudflare challenge.',
        finished_at: '2026-04-16T08:01:00.000Z',
        created_at: '2026-04-16T08:00:00.000Z',
        updated_at: '2026-04-16T08:01:00.000Z',
      },
      error: null,
    });
    const from = vi.fn((table: string) => {
      if (table === 'commerce_merchants') {
        return {
          select: vi.fn(() => ({
            order: merchantOrder,
          })),
        };
      }

      if (table === 'commerce_merchant_discovery_runs') {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: discoveryRunInsertSingle,
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: discoveryRunFinalizeSingle,
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      text: async () =>
        '<html><title>Just a moment...</title>Enable JavaScript and cookies to continue</html>',
      url: 'https://www.proshop.nl/?s=10316',
    })) as typeof fetch;

    const result = await runCommerceMerchantDiscovery({
      input: {
        setId: '10316',
        merchantId: 'merchant-2',
      },
      fetchImpl,
      supabaseClient: { from } as never,
    });

    expect(result.run.status).toBe('failed');
    expect(result.run.errorMessage).toBe(
      'Merchant search page returned a Cloudflare challenge.',
    );
    expect(result.candidates).toEqual([]);
  });

  test('approves a discovery candidate by creating a valid offer seed and linking it back', async () => {
    const merchantRow = {
      id: 'merchant-1',
      slug: 'misterbricks',
      name: 'MisterBricks',
      is_active: false,
      source_type: 'direct',
      affiliate_network: null,
      notes: null,
      created_at: '2026-04-16T08:00:00.000Z',
      updated_at: '2026-04-16T08:00:00.000Z',
    };
    const merchantsOrder = vi
      .fn()
      .mockResolvedValueOnce({
        data: [merchantRow],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [merchantRow],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [merchantRow],
        error: null,
      });
    const discoveryCandidateSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'candidate-1',
        discovery_run_id: 'run-1',
        set_id: '10316',
        merchant_id: 'merchant-1',
        candidate_title: 'LEGO Icons 10316 The Lord of the Rings: Rivendell',
        candidate_url:
          'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html?utm_source=test',
        canonical_url:
          'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html',
        price_minor: 49995,
        currency_code: 'EUR',
        availability: 'out_of_stock',
        detected_set_id: '10316',
        confidence_score: 100,
        status: 'auto_approved',
        match_reasons: ['Exact setnummer 10316 staat in de titel.'],
        source_rank: 1,
        review_status: 'pending',
        offer_seed_id: null,
        created_at: '2026-04-16T08:00:10.000Z',
        updated_at: '2026-04-16T08:00:10.000Z',
      },
      error: null,
    });
    const offerLatestSelect = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const offerSeedsOrder = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const createOfferSeedSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'seed-1',
        set_id: '10316',
        merchant_id: 'merchant-1',
        product_url:
          'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html',
        is_active: true,
        validation_status: 'valid',
        last_verified_at: '2026-04-16T08:02:00.000Z',
        notes: '',
        created_at: '2026-04-16T08:02:00.000Z',
        updated_at: '2026-04-16T08:02:00.000Z',
      },
      error: null,
    });
    const updateCandidateSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'candidate-1',
        discovery_run_id: 'run-1',
        set_id: '10316',
        merchant_id: 'merchant-1',
        candidate_title: 'LEGO Icons 10316 The Lord of the Rings: Rivendell',
        candidate_url:
          'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html?utm_source=test',
        canonical_url:
          'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html',
        price_minor: 49995,
        currency_code: 'EUR',
        availability: 'out_of_stock',
        detected_set_id: '10316',
        confidence_score: 100,
        status: 'auto_approved',
        match_reasons: ['Exact setnummer 10316 staat in de titel.'],
        source_rank: 1,
        review_status: 'approved',
        offer_seed_id: 'seed-1',
        created_at: '2026-04-16T08:00:10.000Z',
        updated_at: '2026-04-16T08:02:00.000Z',
      },
      error: null,
    });
    const createOfferSeedSelect = vi.fn(() => ({
      single: createOfferSeedSingle,
    }));
    const createOfferSeedInsert = vi.fn(() => ({
      select: createOfferSeedSelect,
    }));
    const from = vi.fn((table: string) => {
      if (table === 'commerce_merchant_discovery_candidates') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: discoveryCandidateSingle,
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: updateCandidateSingle,
              })),
            })),
          })),
        };
      }

      if (table === 'commerce_merchants') {
        return {
          select: vi.fn(() => ({
            order: merchantsOrder,
          })),
        };
      }

      if (table === 'commerce_offer_latest') {
        return {
          select: offerLatestSelect,
        };
      }

      if (table === 'commerce_offer_seeds') {
        return {
          select: vi.fn(() => ({
            order: offerSeedsOrder,
          })),
          insert: createOfferSeedInsert,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const result = await approveCommerceDiscoveryCandidate({
      candidateId: 'candidate-1',
      supabaseClient: { from } as never,
    });

    expect(createOfferSeedInsert).toHaveBeenCalledWith({
      set_id: '10316',
      merchant_id: 'merchant-1',
      product_url:
        'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html',
      is_active: true,
      validation_status: 'valid',
      last_verified_at: expect.any(String),
      notes: '',
    });
    expect(result.outcome).toBe('created_seed');
    expect(result.candidate.reviewStatus).toBe('approved');
    expect(result.candidate.offerSeedId).toBe('seed-1');
  });

  test('links and approves a discovery candidate when a seed is created from the dialog flow', async () => {
    const merchantRow = {
      id: 'merchant-1',
      slug: 'misterbricks',
      name: 'MisterBricks',
      is_active: false,
      source_type: 'direct',
      affiliate_network: null,
      notes: null,
      created_at: '2026-04-16T08:00:00.000Z',
      updated_at: '2026-04-16T08:00:00.000Z',
    };
    const merchantsOrder = vi
      .fn()
      .mockResolvedValueOnce({
        data: [merchantRow],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [merchantRow],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [merchantRow],
        error: null,
      });
    const discoveryCandidateSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'candidate-2',
        discovery_run_id: 'run-2',
        set_id: '10316',
        merchant_id: 'merchant-1',
        candidate_title: 'LEGO Icons 10316 The Lord of the Rings: Rivendell',
        candidate_url:
          'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html?utm_source=test',
        canonical_url:
          'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html',
        price_minor: 49995,
        currency_code: 'EUR',
        availability: 'out_of_stock',
        detected_set_id: '10316',
        confidence_score: 12,
        status: 'rejected',
        match_reasons: ['Ander setnummer gevonden: 10317.'],
        source_rank: 2,
        review_status: 'pending',
        offer_seed_id: null,
        created_at: '2026-04-16T08:00:10.000Z',
        updated_at: '2026-04-16T08:00:10.000Z',
      },
      error: null,
    });
    const offerLatestSelect = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const offerSeedsOrder = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const createOfferSeedSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'seed-2',
        set_id: '10316',
        merchant_id: 'merchant-1',
        product_url:
          'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html',
        is_active: true,
        validation_status: 'valid',
        last_verified_at: null,
        notes: '',
        created_at: '2026-04-16T08:02:00.000Z',
        updated_at: '2026-04-16T08:02:00.000Z',
      },
      error: null,
    });
    const updateCandidateSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'candidate-2',
        discovery_run_id: 'run-2',
        set_id: '10316',
        merchant_id: 'merchant-1',
        candidate_title: 'LEGO Icons 10316 The Lord of the Rings: Rivendell',
        candidate_url:
          'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html?utm_source=test',
        canonical_url:
          'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html',
        price_minor: 49995,
        currency_code: 'EUR',
        availability: 'out_of_stock',
        detected_set_id: '10316',
        confidence_score: 12,
        status: 'rejected',
        match_reasons: ['Ander setnummer gevonden: 10317.'],
        source_rank: 2,
        review_status: 'approved',
        offer_seed_id: 'seed-2',
        created_at: '2026-04-16T08:00:10.000Z',
        updated_at: '2026-04-16T08:02:00.000Z',
      },
      error: null,
    });
    const createOfferSeedSelect = vi.fn(() => ({
      single: createOfferSeedSingle,
    }));
    const createOfferSeedInsert = vi.fn(() => ({
      select: createOfferSeedSelect,
    }));
    const from = vi.fn((table: string) => {
      if (table === 'commerce_merchant_discovery_candidates') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: discoveryCandidateSingle,
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: updateCandidateSingle,
              })),
            })),
          })),
        };
      }

      if (table === 'commerce_merchants') {
        return {
          select: vi.fn(() => ({
            order: merchantsOrder,
          })),
        };
      }

      if (table === 'commerce_offer_latest') {
        return {
          select: offerLatestSelect,
        };
      }

      if (table === 'commerce_offer_seeds') {
        return {
          select: vi.fn(() => ({
            order: offerSeedsOrder,
          })),
          insert: createOfferSeedInsert,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const offerSeed = await createCommerceOfferSeedFromDiscoveryCandidate({
      candidateId: 'candidate-2',
      input: {
        setId: '10316',
        merchantId: 'merchant-1',
        productUrl:
          'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html',
        isActive: true,
        validationStatus: 'valid',
        notes: '',
      },
      supabaseClient: { from } as never,
    });

    expect(offerSeed.id).toBe('seed-2');
    expect(createOfferSeedInsert).toHaveBeenCalledOnce();
    expect(updateCandidateSingle).toHaveBeenCalledOnce();
  });

  test('approving an already-linked candidate does not create a duplicate seed', async () => {
    const merchantRow = {
      id: 'merchant-1',
      slug: 'misterbricks',
      name: 'MisterBricks',
      is_active: false,
      source_type: 'direct',
      affiliate_network: null,
      notes: null,
      created_at: '2026-04-16T08:00:00.000Z',
      updated_at: '2026-04-16T08:00:00.000Z',
    };
    const merchantsOrder = vi.fn().mockResolvedValue({
      data: [merchantRow],
      error: null,
    });
    const discoveryCandidateSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'candidate-3',
        discovery_run_id: 'run-3',
        set_id: '10316',
        merchant_id: 'merchant-1',
        candidate_title: 'LEGO Icons 10316 The Lord of the Rings: Rivendell',
        candidate_url:
          'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html',
        canonical_url:
          'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html',
        price_minor: 49995,
        currency_code: 'EUR',
        availability: 'out_of_stock',
        detected_set_id: '10316',
        confidence_score: 100,
        status: 'auto_approved',
        match_reasons: ['Exact setnummer 10316 staat in de titel.'],
        source_rank: 1,
        review_status: 'pending',
        offer_seed_id: 'seed-3',
        created_at: '2026-04-16T08:00:10.000Z',
        updated_at: '2026-04-16T08:00:10.000Z',
      },
      error: null,
    });
    const offerLatestSelect = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const offerSeedsOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'seed-3',
          set_id: '10316',
          merchant_id: 'merchant-1',
          product_url:
            'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html',
          is_active: true,
          validation_status: 'valid',
          last_verified_at: null,
          notes: '',
          created_at: '2026-04-16T08:02:00.000Z',
          updated_at: '2026-04-16T08:02:00.000Z',
        },
      ],
      error: null,
    });
    const updateCandidateSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'candidate-3',
        discovery_run_id: 'run-3',
        set_id: '10316',
        merchant_id: 'merchant-1',
        candidate_title: 'LEGO Icons 10316 The Lord of the Rings: Rivendell',
        candidate_url:
          'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html',
        canonical_url:
          'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html',
        price_minor: 49995,
        currency_code: 'EUR',
        availability: 'out_of_stock',
        detected_set_id: '10316',
        confidence_score: 100,
        status: 'auto_approved',
        match_reasons: ['Exact setnummer 10316 staat in de titel.'],
        source_rank: 1,
        review_status: 'approved',
        offer_seed_id: 'seed-3',
        created_at: '2026-04-16T08:00:10.000Z',
        updated_at: '2026-04-16T08:02:00.000Z',
      },
      error: null,
    });
    const createOfferSeedInsert = vi.fn();
    const from = vi.fn((table: string) => {
      if (table === 'commerce_merchant_discovery_candidates') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: discoveryCandidateSingle,
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: updateCandidateSingle,
              })),
            })),
          })),
        };
      }

      if (table === 'commerce_merchants') {
        return {
          select: vi.fn(() => ({
            order: merchantsOrder,
          })),
        };
      }

      if (table === 'commerce_offer_latest') {
        return {
          select: offerLatestSelect,
        };
      }

      if (table === 'commerce_offer_seeds') {
        return {
          select: vi.fn(() => ({
            order: offerSeedsOrder,
          })),
          insert: createOfferSeedInsert,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const result = await approveCommerceDiscoveryCandidate({
      candidateId: 'candidate-3',
      supabaseClient: { from } as never,
    });

    expect(result.outcome).toBe('already_linked');
    expect(result.candidate.offerSeedId).toBe('seed-3');
    expect(createOfferSeedInsert).not.toHaveBeenCalled();
  });

  test('approving a score-rejected candidate can still link an existing seed through operator review', async () => {
    const merchantRow = {
      id: 'merchant-1',
      slug: 'misterbricks',
      name: 'MisterBricks',
      is_active: false,
      source_type: 'direct',
      affiliate_network: null,
      notes: null,
      created_at: '2026-04-16T08:00:00.000Z',
      updated_at: '2026-04-16T08:00:00.000Z',
    };
    const merchantsOrder = vi.fn().mockResolvedValue({
      data: [merchantRow],
      error: null,
    });
    const discoveryCandidateSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'candidate-4',
        discovery_run_id: 'run-4',
        set_id: '10316',
        merchant_id: 'merchant-1',
        candidate_title: 'LEGO bundle 10316 light kit',
        candidate_url:
          'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html?campaign=1',
        canonical_url:
          'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html',
        price_minor: 49995,
        currency_code: 'EUR',
        availability: 'out_of_stock',
        detected_set_id: '10316',
        confidence_score: 12,
        status: 'rejected',
        match_reasons: ['Titel of URL lijkt op een accessoire of bundel.'],
        source_rank: 3,
        review_status: 'pending',
        offer_seed_id: null,
        created_at: '2026-04-16T08:00:10.000Z',
        updated_at: '2026-04-16T08:00:10.000Z',
      },
      error: null,
    });
    const offerLatestSelect = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const offerSeedsOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'seed-4',
          set_id: '10316',
          merchant_id: 'merchant-1',
          product_url:
            'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html',
          is_active: true,
          validation_status: 'valid',
          last_verified_at: null,
          notes: '',
          created_at: '2026-04-16T08:02:00.000Z',
          updated_at: '2026-04-16T08:02:00.000Z',
        },
      ],
      error: null,
    });
    const updateCandidateSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'candidate-4',
        discovery_run_id: 'run-4',
        set_id: '10316',
        merchant_id: 'merchant-1',
        candidate_title: 'LEGO bundle 10316 light kit',
        candidate_url:
          'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html?campaign=1',
        canonical_url:
          'https://misterbricks.nl/lego-icons-the-lord-of-the-rings-rivendell-10316.html',
        price_minor: 49995,
        currency_code: 'EUR',
        availability: 'out_of_stock',
        detected_set_id: '10316',
        confidence_score: 12,
        status: 'rejected',
        match_reasons: ['Titel of URL lijkt op een accessoire of bundel.'],
        source_rank: 3,
        review_status: 'approved',
        offer_seed_id: 'seed-4',
        created_at: '2026-04-16T08:00:10.000Z',
        updated_at: '2026-04-16T08:02:00.000Z',
      },
      error: null,
    });
    const createOfferSeedInsert = vi.fn();
    const from = vi.fn((table: string) => {
      if (table === 'commerce_merchant_discovery_candidates') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: discoveryCandidateSingle,
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: updateCandidateSingle,
              })),
            })),
          })),
        };
      }

      if (table === 'commerce_merchants') {
        return {
          select: vi.fn(() => ({
            order: merchantsOrder,
          })),
        };
      }

      if (table === 'commerce_offer_latest') {
        return {
          select: offerLatestSelect,
        };
      }

      if (table === 'commerce_offer_seeds') {
        return {
          select: vi.fn(() => ({
            order: offerSeedsOrder,
          })),
          insert: createOfferSeedInsert,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const result = await approveCommerceDiscoveryCandidate({
      candidateId: 'candidate-4',
      supabaseClient: { from } as never,
    });

    expect(result.outcome).toBe('linked_existing_seed');
    expect(result.candidate.status).toBe('rejected');
    expect(result.candidate.reviewStatus).toBe('approved');
    expect(result.candidate.offerSeedId).toBe('seed-4');
    expect(createOfferSeedInsert).not.toHaveBeenCalled();
  });
});
