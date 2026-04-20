import { TestBed } from '@angular/core/testing';
import { provideRouter, type Route, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import {
  CommerceAdminAddSetPageComponent,
  CommerceAdminApiService,
  CommerceAdminCoverageQueuePageComponent,
  CommerceAdminSetsPageComponent,
  CommerceAdminStore,
} from '@lego-platform/commerce/feature-admin';
import type {
  CommerceCoverageQueueMerchantStatus,
  CommerceCoverageQueueRow,
  CommerceOfferSeed,
} from '@lego-platform/commerce/util';

function createMerchantStatus(
  overrides: Partial<CommerceCoverageQueueMerchantStatus> = {},
): CommerceCoverageQueueMerchantStatus {
  return {
    merchantId: 'merchant-1',
    merchantName: 'MisterBricks',
    merchantSlug: 'misterbricks',
    state: 'missing',
    ...overrides,
  };
}

function createCoverageRow(
  overrides: Partial<CommerceCoverageQueueRow> = {},
): CommerceCoverageQueueRow {
  return {
    activeSeedCount: 0,
    isBenchmark: false,
    latestCheckedAt: '2026-04-18T08:00:00.000Z',
    merchantStatuses: [createMerchantStatus()],
    merchantsCheckedCount: 1,
    missingMerchantIds: ['merchant-1'],
    missingMerchantNames: ['MisterBricks'],
    missingMerchantSlugs: ['misterbricks'],
    needsReviewCount: 0,
    notAvailableConfirmedMerchantCount: 0,
    notAvailableConfirmedMerchantNames: [],
    recommendedMerchantId: 'merchant-1',
    recommendedMerchantName: 'MisterBricks',
    recommendedNextAction: 'add_seed_manually',
    setId: '72037',
    setName: 'Mario Kart - Mario & Standard Kart',
    source: 'overlay',
    sourceCreatedAt: '2026-04-18T08:00:00.000Z',
    staleMerchantCount: 0,
    statusSummary: '0 valid offers',
    theme: 'Super Mario',
    unavailableMerchantCount: 0,
    validMerchantCount: 0,
    ...overrides,
  };
}

function createCatalogSetOption(row: CommerceCoverageQueueRow) {
  return {
    createdAt: '2026-04-18T08:00:00.000Z',
    id: row.setId,
    name: row.setName,
    theme: row.theme,
    imageUrl: undefined,
    pieces: 1000,
    releaseYear: 2024,
    slug: `set-${row.setId.toLowerCase()}`,
    collectorAngle: undefined,
    updatedAt: '2026-04-18T08:00:00.000Z',
  };
}

function createOfferSeed(
  overrides: Partial<CommerceOfferSeed> = {},
): CommerceOfferSeed {
  return {
    createdAt: '2026-04-18T08:00:00.000Z',
    id: 'seed-1',
    isActive: true,
    merchantId: 'merchant-1',
    notes: '',
    productUrl: 'https://example.test/product',
    setId: '72037',
    updatedAt: '2026-04-18T08:00:00.000Z',
    validationStatus: 'valid',
    ...overrides,
  };
}

function createApiServiceStub(): CommerceAdminApiService {
  return {
    listCatalogSets: async () => [],
    searchCatalogMissingSets: async () => [],
    createCatalogSet: async () => undefined,
    startCatalogBulkOnboarding: async () => ({
      alreadyRunning: false,
      run: {
        createdAt: '2026-04-19T08:00:00.000Z',
        generateStep: { appliedSetIds: [], status: 'pending' },
        importStep: { appliedSetIds: [], status: 'pending' },
        requestedSetIds: [],
        runId: 'bulk-test',
        setProgressById: {},
        snapshotStep: { appliedSetIds: [], status: 'pending' },
        status: 'running',
        syncStep: { appliedSetIds: [], status: 'pending' },
        updatedAt: '2026-04-19T08:00:00.000Z',
        validateStep: { appliedSetIds: [], status: 'pending' },
      },
      runCreated: true,
      runId: 'bulk-test',
      stateFilePath: '/tmp/catalog-bulk-onboarding-state.json',
    }),
    getLatestCatalogBulkOnboardingRun: async () => null,
    getCatalogBulkOnboardingRun: async () => null,
    listBenchmarkSets: async () => [],
    createBenchmarkSet: async () => undefined,
    deleteBenchmarkSet: async () => undefined,
    listMerchants: async () => [],
    createMerchant: async () => undefined,
    updateMerchant: async () => undefined,
    listOfferSeeds: async () => [],
    createOfferSeed: async () => undefined,
    updateOfferSeed: async () => undefined,
    refreshSet: async () => ({
      setId: '72037',
      totalCount: 0,
      successCount: 0,
      unavailableCount: 0,
      invalidCount: 0,
      staleCount: 0,
    }),
    listCoverageQueue: async () => [],
  } as unknown as CommerceAdminApiService;
}

describe('operator context continuity', () => {
  async function configureHarness(routes: Route[]) {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        {
          provide: CommerceAdminApiService,
          useValue: createApiServiceStub(),
        },
      ],
    }).compileComponents();

    return {
      harness: await RouterTestingHarness.create(),
      store: TestBed.inject(CommerceAdminStore),
      router: TestBed.inject(Router),
    };
  }

  it('restores the selected workbench set and filters from query params', async () => {
    const { harness, store } = await configureHarness([
      {
        path: 'workbench',
        component: CommerceAdminCoverageQueuePageComponent,
      },
    ]);
    const primaryRow = createCoverageRow();
    const secondaryRow = createCoverageRow({
      setId: '10317',
      setName: 'Land Rover Classic Defender 90',
      theme: 'Icons',
      source: 'snapshot',
      statusSummary: '2 valid merchants',
      validMerchantCount: 2,
      missingMerchantIds: [],
      missingMerchantNames: [],
      missingMerchantSlugs: [],
      recommendedNextAction: 'add_seed_manually',
      recommendedMerchantId: 'merchant-2',
      recommendedMerchantName: 'Intertoys',
      merchantStatuses: [
        createMerchantStatus({
          merchantId: 'merchant-2',
          merchantName: 'Intertoys',
          merchantSlug: 'intertoys',
        }),
      ],
    });

    store.coverageQueueRows.set([primaryRow, secondaryRow]);
    store.catalogSetOptions.set([
      createCatalogSetOption(primaryRow),
      createCatalogSetOption(secondaryRow),
    ]);

    const component = await harness.navigateByUrl(
      '/workbench?set=72037&q=mario&health=zero_valid&source=overlay',
      CommerceAdminCoverageQueuePageComponent,
    );

    expect(component.selectedRow()?.setId).toBe('72037');
    expect(component.search()).toBe('mario');
    expect(component.healthFilter()).toBe('zero_valid');
    expect(component.sourceFilter()).toBe('overlay');
    expect(store.activeSetId()).toBe('72037');
  });

  it('restores the selected set in the Sets page from query params', async () => {
    const { harness, store } = await configureHarness([
      {
        path: 'sets',
        component: CommerceAdminSetsPageComponent,
      },
    ]);
    const primaryRow = createCoverageRow();
    const secondaryRow = createCoverageRow({
      setId: '10317',
      setName: 'Land Rover Classic Defender 90',
      theme: 'Icons',
      source: 'snapshot',
      statusSummary: '2 valid merchants',
      validMerchantCount: 2,
      missingMerchantIds: [],
      missingMerchantNames: [],
      missingMerchantSlugs: [],
      recommendedNextAction: 'add_seed_manually',
      recommendedMerchantId: 'merchant-2',
      recommendedMerchantName: 'Intertoys',
      merchantStatuses: [
        createMerchantStatus({
          merchantId: 'merchant-2',
          merchantName: 'Intertoys',
          merchantSlug: 'intertoys',
        }),
      ],
    });

    store.coverageQueueRows.set([primaryRow, secondaryRow]);
    store.catalogSetOptions.set([
      createCatalogSetOption(primaryRow),
      createCatalogSetOption(secondaryRow),
    ]);

    const component = await harness.navigateByUrl(
      '/sets?set=10317&q=land&source=snapshot&health=under_covered',
      CommerceAdminSetsPageComponent,
    );

    expect(component.selectedRow()?.setId).toBe('10317');
    expect(component.search()).toBe('land');
    expect(component.sourceFilter()).toBe('snapshot');
    expect(component.healthFilter()).toBe('under_covered');
    expect(store.activeSetId()).toBe('10317');
  });

  it('restores catalog filter and sort on the Sets page route', async () => {
    const { harness, store } = await configureHarness([
      {
        path: 'sets',
        component: CommerceAdminSetsPageComponent,
      },
    ]);

    store.coverageQueueRows.set([]);
    store.catalogSetOptions.set([
      {
        ...createCatalogSetOption(createCoverageRow()),
        createdAt: '2026-04-19T08:00:00.000Z',
        id: '75192',
        name: 'Millennium Falcon',
        slug: 'millennium-falcon-75192',
        theme: 'Star Wars',
        updatedAt: '2026-04-19T08:00:00.000Z',
      },
    ]);

    const component = await harness.navigateByUrl(
      '/sets?catalog=no_commerce_context&sort=recent_added&q=75192',
      CommerceAdminSetsPageComponent,
    );

    expect(component.catalogFilter()).toBe('no_commerce_context');
    expect(component.sort()).toBe('recent_added');
    expect(component.filteredRows().map((row) => row.setId)).toEqual(['75192']);
  });

  it('shows canonical catalog sets in the Sets page even when no coverage row exists yet', async () => {
    const { harness, store } = await configureHarness([
      {
        path: 'sets',
        component: CommerceAdminSetsPageComponent,
      },
    ]);
    const catalogOnlyRow = createCoverageRow({
      setId: '75192',
      setName: 'Millennium Falcon',
      theme: 'Star Wars',
    });

    store.coverageQueueRows.set([]);
    store.catalogSetOptions.set([createCatalogSetOption(catalogOnlyRow)]);

    const component = await harness.navigateByUrl(
      '/sets?q=75192',
      CommerceAdminSetsPageComponent,
    );

    expect(component.filteredRows().map((row) => row.setId)).toEqual(['75192']);
    expect(component.selectedRow()?.setId).toBe('75192');
    expect(component.selectedCoverageRow()).toBeNull();
  });

  it('applies recovery-first filters on the workbench queue', async () => {
    const { harness, store } = await configureHarness([
      {
        path: 'workbench',
        component: CommerceAdminCoverageQueuePageComponent,
      },
    ]);
    const recoverNowRow = createCoverageRow({
      setId: '72050',
      setName: 'Mario Kart - Baby Peach & Grand Prix Set',
      merchantStatuses: [
        createMerchantStatus({
          merchantId: 'merchant-1',
          merchantName: 'MisterBricks',
          merchantSlug: 'misterbricks',
          offerSeed: undefined,
          state: 'missing',
        }),
      ],
    });
    const parkedRow = createCoverageRow({
      setId: '10300',
      setName: 'Back to the Future Time Machine',
      merchantStatuses: [
        createMerchantStatus({
          merchantId: 'merchant-2',
          merchantName: 'Intertoys',
          merchantSlug: 'intertoys',
          offerSeed: createOfferSeed({
            id: 'seed-intertoys',
            merchantId: 'merchant-2',
            setId: '10300',
            validationStatus: 'invalid',
          }),
          state: 'review',
        }),
      ],
    });

    store.coverageQueueRows.set([parkedRow, recoverNowRow]);
    store.catalogSetOptions.set([
      createCatalogSetOption(recoverNowRow),
      createCatalogSetOption(parkedRow),
    ]);

    const component = await harness.navigateByUrl(
      '/workbench?recovery=recover_now',
      CommerceAdminCoverageQueuePageComponent,
    );

    expect(component.recoveryFilter()).toBe('recover_now');
    expect(component.filteredRows().map((row) => row.setId)).toEqual(['72050']);
  });

  it('sends a newly added set into Workbench with the focused set query param', async () => {
    const { harness, router, store } = await configureHarness([
      {
        path: 'new-set',
        component: CommerceAdminAddSetPageComponent,
      },
      {
        path: 'workbench',
        component: CommerceAdminCoverageQueuePageComponent,
      },
    ]);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const component = await harness.navigateByUrl(
      '/new-set',
      CommerceAdminAddSetPageComponent,
    );

    component.addedSet.set({
      setId: '72037',
      slug: 'mario-kart-mario-standard-kart-72037',
      name: 'Mario Kart - Mario & Standard Kart',
      theme: 'Super Mario',
      releaseYear: 2026,
      pieces: 1972,
      imageUrl: 'https://images.example.test/72037.png',
      source: 'rebrickable',
      sourceSetNumber: '72037-1',
      status: 'active',
      createdAt: '2026-04-18T08:00:00.000Z',
      updatedAt: '2026-04-18T08:00:00.000Z',
    });

    await component.continueToWorkbench();

    expect(store.activeSetId()).toBe('72037');
    expect(navigateSpy).toHaveBeenCalledWith(['/workbench'], {
      queryParams: {
        set: '72037',
      },
    });
  });
});
