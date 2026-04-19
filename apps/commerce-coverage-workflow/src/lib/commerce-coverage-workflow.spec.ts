import { describe, expect, test, vi } from 'vitest';

import { runCommerceCoverageWorkflow } from './commerce-coverage-workflow';

describe('commerce coverage workflow', () => {
  test('stops early when the selected batch is empty', async () => {
    const listCommercePrimaryCoverageReportFn = vi.fn().mockResolvedValue({
      totalSetCount: 47,
      selectedSetCount: 0,
      rows: [],
      primaryMerchantSlugs: ['bol', 'intertoys', 'lego-nl', 'misterbricks'],
      noPrimarySeedsCount: 0,
      noValidPrimaryOffersCount: 1,
      partialPrimaryCoverageCount: 32,
      fullPrimaryCoverageCount: 14,
    });
    const generateCommerceOfferSeedCandidatesFn = vi.fn();
    const validateGeneratedCommerceOfferSeedCandidatesFn = vi.fn();
    const runCommerceSyncFn = vi.fn();

    const result = await runCommerceCoverageWorkflow({
      dependencies: {
        generateCommerceOfferSeedCandidatesFn,
        listCommercePrimaryCoverageReportFn,
        runCommerceSyncFn,
        validateGeneratedCommerceOfferSeedCandidatesFn,
      },
      options: {
        batchIndex: 2,
        batchSize: 10,
        merchantSlugs: ['misterbricks'],
        primaryCoverageStatus: 'partial_primary_coverage',
        workspaceRoot: '/tmp/brickhunt',
      },
    });

    expect(result).toMatchObject({
      selectedSetIds: [],
      skipped: true,
    });
    expect(generateCommerceOfferSeedCandidatesFn).not.toHaveBeenCalled();
    expect(
      validateGeneratedCommerceOfferSeedCandidatesFn,
    ).not.toHaveBeenCalled();
    expect(runCommerceSyncFn).not.toHaveBeenCalled();
  });

  test('excludes retired sets from the default workflow batch, but can include them explicitly', async () => {
    const defaultListCommercePrimaryCoverageReportFn = vi
      .fn()
      .mockResolvedValueOnce({
        totalSetCount: 46,
        selectedSetCount: 1,
        rows: [
          {
            setId: '76437',
            setName: 'The Burrow - Collectors’ Edition',
            theme: 'Harry Potter',
            status: 'no_valid_primary_offers',
            primaryMerchantTargetCount: 4,
            primarySeedCount: 2,
            validPrimaryOfferCount: 0,
            missingPrimarySeedMerchantSlugs: ['lego-nl', 'misterbricks'],
            missingValidPrimaryOfferMerchantSlugs: [
              'bol',
              'intertoys',
              'lego-nl',
              'misterbricks',
            ],
          },
        ],
        primaryMerchantSlugs: ['bol', 'intertoys', 'lego-nl', 'misterbricks'],
        noPrimarySeedsCount: 0,
        noValidPrimaryOffersCount: 1,
        partialPrimaryCoverageCount: 32,
        fullPrimaryCoverageCount: 14,
      })
      .mockResolvedValueOnce({
        totalSetCount: 46,
        selectedSetCount: 1,
        rows: [
          {
            setId: '76437',
            setName: 'The Burrow - Collectors’ Edition',
            theme: 'Harry Potter',
            status: 'no_valid_primary_offers',
            primaryMerchantTargetCount: 4,
            primarySeedCount: 2,
            validPrimaryOfferCount: 0,
            missingPrimarySeedMerchantSlugs: ['lego-nl', 'misterbricks'],
            missingValidPrimaryOfferMerchantSlugs: [
              'bol',
              'intertoys',
              'lego-nl',
              'misterbricks',
            ],
          },
        ],
        primaryMerchantSlugs: ['bol', 'intertoys', 'lego-nl', 'misterbricks'],
        noPrimarySeedsCount: 0,
        noValidPrimaryOffersCount: 1,
        partialPrimaryCoverageCount: 32,
        fullPrimaryCoverageCount: 14,
      });
    const includedListCommercePrimaryCoverageReportFn = vi
      .fn()
      .mockResolvedValueOnce({
        totalSetCount: 47,
        selectedSetCount: 2,
        rows: [
          {
            setId: '70728',
            setName: 'Battle for NINJAGO City',
            theme: 'NINJAGO',
            status: 'no_valid_primary_offers',
            primaryMerchantTargetCount: 4,
            primarySeedCount: 1,
            validPrimaryOfferCount: 0,
            missingPrimarySeedMerchantSlugs: ['bol', 'intertoys', 'lego-nl'],
            missingValidPrimaryOfferMerchantSlugs: [
              'bol',
              'intertoys',
              'lego-nl',
              'misterbricks',
            ],
          },
          {
            setId: '76437',
            setName: 'The Burrow - Collectors’ Edition',
            theme: 'Harry Potter',
            status: 'no_valid_primary_offers',
            primaryMerchantTargetCount: 4,
            primarySeedCount: 2,
            validPrimaryOfferCount: 0,
            missingPrimarySeedMerchantSlugs: ['lego-nl', 'misterbricks'],
            missingValidPrimaryOfferMerchantSlugs: [
              'bol',
              'intertoys',
              'lego-nl',
              'misterbricks',
            ],
          },
        ],
        primaryMerchantSlugs: ['bol', 'intertoys', 'lego-nl', 'misterbricks'],
        noPrimarySeedsCount: 0,
        noValidPrimaryOffersCount: 2,
        partialPrimaryCoverageCount: 32,
        fullPrimaryCoverageCount: 14,
      })
      .mockResolvedValueOnce({
        totalSetCount: 47,
        selectedSetCount: 2,
        rows: [
          {
            setId: '70728',
            setName: 'Battle for NINJAGO City',
            theme: 'NINJAGO',
            status: 'no_valid_primary_offers',
            primaryMerchantTargetCount: 4,
            primarySeedCount: 1,
            validPrimaryOfferCount: 0,
            missingPrimarySeedMerchantSlugs: ['bol', 'intertoys', 'lego-nl'],
            missingValidPrimaryOfferMerchantSlugs: [
              'bol',
              'intertoys',
              'lego-nl',
              'misterbricks',
            ],
          },
          {
            setId: '76437',
            setName: 'The Burrow - Collectors’ Edition',
            theme: 'Harry Potter',
            status: 'no_valid_primary_offers',
            primaryMerchantTargetCount: 4,
            primarySeedCount: 2,
            validPrimaryOfferCount: 0,
            missingPrimarySeedMerchantSlugs: ['lego-nl', 'misterbricks'],
            missingValidPrimaryOfferMerchantSlugs: [
              'bol',
              'intertoys',
              'lego-nl',
              'misterbricks',
            ],
          },
        ],
        primaryMerchantSlugs: ['bol', 'intertoys', 'lego-nl', 'misterbricks'],
        noPrimarySeedsCount: 0,
        noValidPrimaryOffersCount: 2,
        partialPrimaryCoverageCount: 32,
        fullPrimaryCoverageCount: 14,
      });

    const result = await runCommerceCoverageWorkflow({
      dependencies: {
        generateCommerceOfferSeedCandidatesFn: vi.fn().mockResolvedValue({
          candidateCount: 1,
          insertedCount: 0,
          skippedCount: 1,
          supportedMerchantSlugs: ['misterbricks'],
          updatedCount: 0,
        }),
        listCommercePrimaryCoverageReportFn:
          defaultListCommercePrimaryCoverageReportFn,
        runCommerceSyncFn: vi.fn().mockResolvedValue({
          scoped: true,
          scopedMerchantSlugs: ['misterbricks'],
          scopedSetIds: ['76437'],
          pricingArtifactCheck: { isClean: true, stalePaths: [] },
          affiliateArtifactCheck: { isClean: true, stalePaths: [] },
          affiliateOfferCount: 0,
          dailyHistoryPointCount: 0,
          enabledSetCount: 1,
          merchantCount: 1,
          mode: 'write',
          pricePanelSnapshotCount: 0,
          pricingObservationCount: 0,
          refreshInvalidCount: 0,
          refreshStaleCount: 0,
          refreshSuccessCount: 0,
          refreshUnavailableCount: 0,
        }),
        validateGeneratedCommerceOfferSeedCandidatesFn: vi
          .fn()
          .mockResolvedValue({
            processedCount: 0,
            validCount: 0,
            invalidCount: 0,
            staleCount: 0,
            skippedCount: 0,
          }),
      },
      options: {
        merchantSlugs: ['misterbricks'],
        primaryCoverageStatus: 'no_valid_primary_offers',
        workspaceRoot: '/tmp/brickhunt',
      },
    });

    expect(defaultListCommercePrimaryCoverageReportFn).toHaveBeenNthCalledWith(
      1,
      {
        filters: {
          batchIndex: undefined,
          batchSize: undefined,
          includeNonActive: undefined,
          primaryCoverageStatus: 'no_valid_primary_offers',
        },
      },
    );
    expect(result.selectedSetIds).toEqual(['76437']);

    const includedResult = await runCommerceCoverageWorkflow({
      dependencies: {
        generateCommerceOfferSeedCandidatesFn: vi.fn().mockResolvedValue({
          candidateCount: 2,
          insertedCount: 0,
          skippedCount: 2,
          supportedMerchantSlugs: ['misterbricks'],
          updatedCount: 0,
        }),
        listCommercePrimaryCoverageReportFn:
          includedListCommercePrimaryCoverageReportFn,
        runCommerceSyncFn: vi.fn().mockResolvedValue({
          scoped: true,
          scopedMerchantSlugs: ['misterbricks'],
          scopedSetIds: ['70728', '76437'],
          pricingArtifactCheck: { isClean: true, stalePaths: [] },
          affiliateArtifactCheck: { isClean: true, stalePaths: [] },
          affiliateOfferCount: 0,
          dailyHistoryPointCount: 0,
          enabledSetCount: 2,
          merchantCount: 1,
          mode: 'write',
          pricePanelSnapshotCount: 0,
          pricingObservationCount: 0,
          refreshInvalidCount: 0,
          refreshStaleCount: 0,
          refreshSuccessCount: 0,
          refreshUnavailableCount: 0,
        }),
        validateGeneratedCommerceOfferSeedCandidatesFn: vi
          .fn()
          .mockResolvedValue({
            processedCount: 0,
            validCount: 0,
            invalidCount: 0,
            staleCount: 0,
            skippedCount: 0,
          }),
      },
      options: {
        includeNonActive: true,
        merchantSlugs: ['misterbricks'],
        primaryCoverageStatus: 'no_valid_primary_offers',
        workspaceRoot: '/tmp/brickhunt',
      },
    });

    expect(includedListCommercePrimaryCoverageReportFn).toHaveBeenNthCalledWith(
      1,
      {
        filters: {
          batchIndex: undefined,
          batchSize: undefined,
          includeNonActive: true,
          primaryCoverageStatus: 'no_valid_primary_offers',
        },
      },
    );
    expect(includedResult.selectedSetIds).toEqual(['70728', '76437']);
  });

  test('runs the existing batch steps for the selected set ids', async () => {
    const listCommercePrimaryCoverageReportFn = vi
      .fn()
      .mockResolvedValueOnce({
        totalSetCount: 47,
        selectedSetCount: 2,
        rows: [
          {
            setId: '10316',
            setName: 'Rivendell',
            theme: 'Icons',
            status: 'partial_primary_coverage',
            primaryMerchantTargetCount: 4,
            primarySeedCount: 2,
            validPrimaryOfferCount: 2,
            missingPrimarySeedMerchantSlugs: ['bol', 'lego-nl'],
            missingValidPrimaryOfferMerchantSlugs: ['bol', 'lego-nl'],
          },
          {
            setId: '76437',
            setName: 'The Burrow - Collectors’ Edition',
            theme: 'Harry Potter',
            status: 'partial_primary_coverage',
            primaryMerchantTargetCount: 4,
            primarySeedCount: 3,
            validPrimaryOfferCount: 3,
            missingPrimarySeedMerchantSlugs: ['lego-nl'],
            missingValidPrimaryOfferMerchantSlugs: ['lego-nl'],
          },
        ],
        primaryMerchantSlugs: ['bol', 'intertoys', 'lego-nl', 'misterbricks'],
        noPrimarySeedsCount: 0,
        noValidPrimaryOffersCount: 1,
        partialPrimaryCoverageCount: 32,
        fullPrimaryCoverageCount: 14,
      })
      .mockResolvedValueOnce({
        totalSetCount: 47,
        selectedSetCount: 2,
        rows: [
          {
            setId: '10316',
            setName: 'Rivendell',
            theme: 'Icons',
            status: 'full_primary_coverage',
            primaryMerchantTargetCount: 4,
            primarySeedCount: 4,
            validPrimaryOfferCount: 4,
            missingPrimarySeedMerchantSlugs: [],
            missingValidPrimaryOfferMerchantSlugs: [],
          },
          {
            setId: '76437',
            setName: 'The Burrow - Collectors’ Edition',
            theme: 'Harry Potter',
            status: 'full_primary_coverage',
            primaryMerchantTargetCount: 4,
            primarySeedCount: 4,
            validPrimaryOfferCount: 4,
            missingPrimarySeedMerchantSlugs: [],
            missingValidPrimaryOfferMerchantSlugs: [],
          },
        ],
        primaryMerchantSlugs: ['bol', 'intertoys', 'lego-nl', 'misterbricks'],
        noPrimarySeedsCount: 0,
        noValidPrimaryOffersCount: 1,
        partialPrimaryCoverageCount: 30,
        fullPrimaryCoverageCount: 16,
      });
    const generateCommerceOfferSeedCandidatesFn = vi.fn().mockResolvedValue({
      candidateCount: 8,
      insertedCount: 2,
      skippedCount: 6,
      supportedMerchantSlugs: ['bol', 'intertoys', 'lego-nl', 'misterbricks'],
      updatedCount: 0,
    });
    const validateGeneratedCommerceOfferSeedCandidatesFn = vi
      .fn()
      .mockResolvedValue({
        processedCount: 2,
        validCount: 2,
        invalidCount: 0,
        staleCount: 0,
        skippedCount: 0,
      });
    const runCommerceSyncFn = vi.fn().mockResolvedValue({
      scoped: true,
      scopedMerchantSlugs: ['misterbricks'],
      scopedSetIds: ['10316', '76437'],
      pricingArtifactCheck: {
        isClean: true,
        stalePaths: [],
      },
      affiliateArtifactCheck: {
        isClean: true,
        stalePaths: [],
      },
      affiliateOfferCount: 8,
      dailyHistoryPointCount: 2,
      enabledSetCount: 2,
      merchantCount: 4,
      mode: 'write',
      pricePanelSnapshotCount: 2,
      pricingObservationCount: 8,
      refreshInvalidCount: 0,
      refreshStaleCount: 0,
      refreshSuccessCount: 8,
      refreshUnavailableCount: 0,
    });

    const result = await runCommerceCoverageWorkflow({
      dependencies: {
        generateCommerceOfferSeedCandidatesFn,
        listCommercePrimaryCoverageReportFn,
        runCommerceSyncFn,
        validateGeneratedCommerceOfferSeedCandidatesFn,
      },
      options: {
        batchIndex: 0,
        batchSize: 10,
        merchantSlugs: ['misterbricks'],
        primaryCoverageStatus: 'partial_primary_coverage',
        workspaceRoot: '/tmp/brickhunt',
      },
    });

    expect(generateCommerceOfferSeedCandidatesFn).toHaveBeenCalledWith({
      filters: {
        merchantSlugs: ['misterbricks'],
        setIds: ['10316', '76437'],
      },
      write: true,
    });
    expect(validateGeneratedCommerceOfferSeedCandidatesFn).toHaveBeenCalledWith(
      {
        filters: {
          merchantSlugs: ['misterbricks'],
          setIds: ['10316', '76437'],
        },
        write: true,
      },
    );
    expect(runCommerceSyncFn).toHaveBeenCalledWith({
      merchantSlugs: ['misterbricks'],
      mode: 'write',
      setIds: ['10316', '76437'],
      workspaceRoot: '/tmp/brickhunt',
    });
    expect(listCommercePrimaryCoverageReportFn).toHaveBeenNthCalledWith(2, {
      filters: {
        setIds: ['10316', '76437'],
      },
    });
    expect(result).toMatchObject({
      selectedSetIds: ['10316', '76437'],
      skipped: false,
      status: 'completed',
      generateSummary: {
        candidateCount: 8,
      },
      validateSummary: {
        validCount: 2,
      },
      scopedSyncSummary: {
        refreshSuccessCount: 8,
      },
      finalReport: {
        selectedSetCount: 2,
      },
      syncExecuted: true,
    });
  });

  test('keeps sync enabled by default on a no-op merchant batch', async () => {
    const listCommercePrimaryCoverageReportFn = vi.fn().mockResolvedValue({
      totalSetCount: 47,
      selectedSetCount: 1,
      rows: [
        {
          setId: '10316',
          setName: 'Rivendell',
          theme: 'Icons',
          status: 'partial_primary_coverage',
          primaryMerchantTargetCount: 4,
          primarySeedCount: 3,
          validPrimaryOfferCount: 3,
          missingPrimarySeedMerchantSlugs: ['misterbricks'],
          missingValidPrimaryOfferMerchantSlugs: ['misterbricks'],
        },
      ],
      primaryMerchantSlugs: ['bol', 'intertoys', 'lego-nl', 'misterbricks'],
      noPrimarySeedsCount: 0,
      noValidPrimaryOffersCount: 1,
      partialPrimaryCoverageCount: 26,
      fullPrimaryCoverageCount: 20,
    });
    const generateCommerceOfferSeedCandidatesFn = vi.fn().mockResolvedValue({
      candidateCount: 1,
      insertedCount: 0,
      skippedCount: 1,
      supportedMerchantSlugs: ['misterbricks'],
      updatedCount: 0,
    });
    const validateGeneratedCommerceOfferSeedCandidatesFn = vi
      .fn()
      .mockResolvedValue({
        processedCount: 0,
        validCount: 0,
        invalidCount: 0,
        staleCount: 0,
        skippedCount: 0,
      });
    const runCommerceSyncFn = vi.fn().mockResolvedValue({
      scoped: true,
      scopedMerchantSlugs: ['misterbricks'],
      scopedSetIds: ['10316'],
      pricingArtifactCheck: {
        isClean: true,
        stalePaths: [],
      },
      affiliateArtifactCheck: {
        isClean: true,
        stalePaths: [],
      },
      affiliateOfferCount: 1,
      dailyHistoryPointCount: 1,
      enabledSetCount: 1,
      merchantCount: 1,
      mode: 'write',
      pricePanelSnapshotCount: 1,
      pricingObservationCount: 1,
      refreshInvalidCount: 0,
      refreshStaleCount: 0,
      refreshSuccessCount: 1,
      refreshUnavailableCount: 0,
    });

    const result = await runCommerceCoverageWorkflow({
      dependencies: {
        generateCommerceOfferSeedCandidatesFn,
        listCommercePrimaryCoverageReportFn,
        runCommerceSyncFn,
        validateGeneratedCommerceOfferSeedCandidatesFn,
      },
      options: {
        batchIndex: 0,
        batchSize: 10,
        merchantSlugs: ['misterbricks'],
        primaryCoverageStatus: 'partial_primary_coverage',
        workspaceRoot: '/tmp/brickhunt',
      },
    });

    expect(runCommerceSyncFn).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      noSeedWork: true,
      skipped: false,
      status: 'no_seed_work',
      syncExecuted: true,
    });
    expect(result.statusMessage).toContain(
      'Geen nieuwe candidates geschreven en niets gevalideerd',
    );
  });

  test('skips sync on a no-op merchant batch when requested', async () => {
    const listCommercePrimaryCoverageReportFn = vi.fn().mockResolvedValue({
      totalSetCount: 47,
      selectedSetCount: 1,
      rows: [
        {
          setId: '10316',
          setName: 'Rivendell',
          theme: 'Icons',
          status: 'partial_primary_coverage',
          primaryMerchantTargetCount: 4,
          primarySeedCount: 3,
          validPrimaryOfferCount: 3,
          missingPrimarySeedMerchantSlugs: ['misterbricks'],
          missingValidPrimaryOfferMerchantSlugs: ['misterbricks'],
        },
      ],
      primaryMerchantSlugs: ['bol', 'intertoys', 'lego-nl', 'misterbricks'],
      noPrimarySeedsCount: 0,
      noValidPrimaryOffersCount: 1,
      partialPrimaryCoverageCount: 26,
      fullPrimaryCoverageCount: 20,
    });
    const generateCommerceOfferSeedCandidatesFn = vi.fn().mockResolvedValue({
      candidateCount: 1,
      insertedCount: 0,
      skippedCount: 1,
      supportedMerchantSlugs: ['misterbricks'],
      updatedCount: 0,
    });
    const validateGeneratedCommerceOfferSeedCandidatesFn = vi
      .fn()
      .mockResolvedValue({
        processedCount: 0,
        validCount: 0,
        invalidCount: 0,
        staleCount: 0,
        skippedCount: 0,
      });
    const runCommerceSyncFn = vi.fn();

    const result = await runCommerceCoverageWorkflow({
      dependencies: {
        generateCommerceOfferSeedCandidatesFn,
        listCommercePrimaryCoverageReportFn,
        runCommerceSyncFn,
        validateGeneratedCommerceOfferSeedCandidatesFn,
      },
      options: {
        batchIndex: 0,
        batchSize: 10,
        merchantSlugs: ['misterbricks'],
        primaryCoverageStatus: 'partial_primary_coverage',
        skipSyncWhenNoSeedWork: true,
        workspaceRoot: '/tmp/brickhunt',
      },
    });

    expect(runCommerceSyncFn).not.toHaveBeenCalled();
    expect(listCommercePrimaryCoverageReportFn).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      noSeedWork: true,
      skipped: false,
      status: 'no_seed_work',
      syncExecuted: false,
    });
    expect(result.finalReport).toEqual(result.initialReport);
    expect(result.statusMessage).toContain('scoped sync is overgeslagen');
  });

  test('force sync wins over skip on a no-op merchant batch', async () => {
    const listCommercePrimaryCoverageReportFn = vi.fn().mockResolvedValue({
      totalSetCount: 47,
      selectedSetCount: 1,
      rows: [
        {
          setId: '10316',
          setName: 'Rivendell',
          theme: 'Icons',
          status: 'partial_primary_coverage',
          primaryMerchantTargetCount: 4,
          primarySeedCount: 3,
          validPrimaryOfferCount: 3,
          missingPrimarySeedMerchantSlugs: ['misterbricks'],
          missingValidPrimaryOfferMerchantSlugs: ['misterbricks'],
        },
      ],
      primaryMerchantSlugs: ['bol', 'intertoys', 'lego-nl', 'misterbricks'],
      noPrimarySeedsCount: 0,
      noValidPrimaryOffersCount: 1,
      partialPrimaryCoverageCount: 26,
      fullPrimaryCoverageCount: 20,
    });
    const generateCommerceOfferSeedCandidatesFn = vi.fn().mockResolvedValue({
      candidateCount: 1,
      insertedCount: 0,
      skippedCount: 1,
      supportedMerchantSlugs: ['misterbricks'],
      updatedCount: 0,
    });
    const validateGeneratedCommerceOfferSeedCandidatesFn = vi
      .fn()
      .mockResolvedValue({
        processedCount: 0,
        validCount: 0,
        invalidCount: 0,
        staleCount: 0,
        skippedCount: 0,
      });
    const runCommerceSyncFn = vi.fn().mockResolvedValue({
      scoped: true,
      scopedMerchantSlugs: ['misterbricks'],
      scopedSetIds: ['10316'],
      pricingArtifactCheck: {
        isClean: true,
        stalePaths: [],
      },
      affiliateArtifactCheck: {
        isClean: true,
        stalePaths: [],
      },
      affiliateOfferCount: 1,
      dailyHistoryPointCount: 1,
      enabledSetCount: 1,
      merchantCount: 1,
      mode: 'write',
      pricePanelSnapshotCount: 1,
      pricingObservationCount: 1,
      refreshInvalidCount: 0,
      refreshStaleCount: 0,
      refreshSuccessCount: 1,
      refreshUnavailableCount: 0,
    });

    const result = await runCommerceCoverageWorkflow({
      dependencies: {
        generateCommerceOfferSeedCandidatesFn,
        listCommercePrimaryCoverageReportFn,
        runCommerceSyncFn,
        validateGeneratedCommerceOfferSeedCandidatesFn,
      },
      options: {
        batchIndex: 0,
        batchSize: 10,
        forceSync: true,
        merchantSlugs: ['misterbricks'],
        primaryCoverageStatus: 'partial_primary_coverage',
        skipSyncWhenNoSeedWork: true,
        workspaceRoot: '/tmp/brickhunt',
      },
    });

    expect(runCommerceSyncFn).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      noSeedWork: true,
      status: 'no_seed_work',
      syncExecuted: true,
    });
    expect(result.statusMessage).toContain('scoped sync draaide toch door');
  });
});
