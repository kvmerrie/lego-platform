import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import {
  CommerceAdminApiService,
  type CommerceAdminBulkOnboardingRun,
  type CommerceAdminBulkOnboardingStartResult,
  type CommerceAdminCatalogSetSummary,
  CommerceAdminBulkOnboardingPageComponent,
} from '@lego-platform/commerce/feature-admin';
import {
  type CatalogExternalSetSearchResult,
  type CatalogSuggestedSet,
} from '@lego-platform/catalog/util';

const selectionStorageKey = 'brickhunt.admin.bulk-onboarding.selection';
const runIdStorageKey = 'brickhunt.admin.bulk-onboarding.active-run-id';

type BulkOnboardingApiStub = Pick<
  CommerceAdminApiService,
  | 'getCatalogBulkOnboardingRun'
  | 'getLatestCatalogBulkOnboardingRun'
  | 'listCatalogSets'
  | 'listCatalogSuggestedSets'
  | 'searchCatalogMissingSets'
  | 'startCatalogBulkOnboarding'
>;

function createSearchResult(
  overrides: Partial<CatalogExternalSetSearchResult> = {},
): CatalogExternalSetSearchResult {
  return {
    imageUrl: 'https://images.example.test/10316.jpg',
    name: 'Rivendell',
    pieces: 6167,
    releaseYear: 2023,
    setId: '10316',
    slug: 'lord-of-the-rings-rivendell-10316',
    source: 'rebrickable',
    sourceSetNumber: '10316-1',
    theme: 'Icons',
    ...overrides,
  };
}

function createCatalogSetSummary(
  overrides: Partial<CommerceAdminCatalogSetSummary> = {},
): CommerceAdminCatalogSetSummary {
  return {
    createdAt: '2026-04-18T08:00:00.000Z',
    id: '10316',
    imageUrl: 'https://images.example.test/10316.jpg',
    name: 'Rivendell',
    pieces: 6167,
    releaseYear: 2023,
    slug: 'lord-of-the-rings-rivendell-10316',
    theme: 'Icons',
    updatedAt: '2026-04-18T08:00:00.000Z',
    ...overrides,
  };
}

function createSuggestedSet(
  overrides: Partial<CatalogSuggestedSet> = {},
): CatalogSuggestedSet {
  return {
    ...createSearchResult(),
    score: 118,
    ...overrides,
  };
}

function createStartResult(
  setIds: readonly string[],
): CommerceAdminBulkOnboardingStartResult {
  return {
    alreadyRunning: false,
    run: {
      createdAt: '2026-04-19T08:00:00.000Z',
      generateStep: { appliedSetIds: [], status: 'pending' },
      importStep: { appliedSetIds: [], status: 'pending' },
      requestedSetIds: [...setIds],
      runId: 'bulk-10316-21061',
      setProgressById: {},
      snapshotStep: { appliedSetIds: [], status: 'pending' },
      status: 'completed',
      syncStep: { appliedSetIds: [], status: 'pending' },
      updatedAt: '2026-04-19T08:05:00.000Z',
      validateStep: { appliedSetIds: [], status: 'pending' },
    },
    runCreated: true,
    runId: 'bulk-10316-21061',
    stateFilePath: '/tmp/catalog-bulk-onboarding-state.json',
  };
}

function createRun(
  overrides: Partial<CommerceAdminBulkOnboardingRun> = {},
): CommerceAdminBulkOnboardingRun {
  return {
    createdAt: '2026-04-19T08:00:00.000Z',
    generateStep: { appliedSetIds: [], status: 'completed' },
    importStep: { appliedSetIds: [], status: 'completed' },
    requestedSetIds: ['10316', '21061'],
    runId: 'bulk-10316-21061',
    setProgressById: {
      '10316': {
        catalogSetName: 'Rivendell',
        catalogSetTheme: 'Icons',
        importStatus: 'created',
        lastUpdatedAt: '2026-04-19T08:00:00.000Z',
        processingState: 'commerce_sync_completed',
        setId: '10316',
        snapshot: {
          coverageStatus: 'full_primary_coverage',
          gapMerchants: [],
          missingValidPrimaryOfferMerchantSlugs: [],
          setId: '10316',
          setName: 'Rivendell',
          theme: 'Icons',
        },
        sourceSetNumber: '10316-1',
      },
      '21061': {
        catalogSetName: 'Notre-Dame de Paris',
        catalogSetTheme: 'Architecture',
        importStatus: 'created',
        lastUpdatedAt: '2026-04-19T08:00:00.000Z',
        processingState: 'seed_validation_completed',
        setId: '21061',
        sourceSetNumber: '21061-1',
      },
    },
    snapshotStep: { appliedSetIds: [], status: 'completed' },
    status: 'completed',
    syncStep: { appliedSetIds: [], status: 'completed' },
    updatedAt: '2026-04-19T08:05:00.000Z',
    validateStep: { appliedSetIds: [], status: 'completed' },
    ...overrides,
  };
}

function createApiServiceStub(
  overrides: Partial<BulkOnboardingApiStub> = {},
): BulkOnboardingApiStub {
  const baseValue: BulkOnboardingApiStub = {
    getCatalogBulkOnboardingRun: async () => null,
    getLatestCatalogBulkOnboardingRun: async () => null,
    listCatalogSets: async () => [],
    listCatalogSuggestedSets: async () => [],
    searchCatalogMissingSets: async () => [],
    startCatalogBulkOnboarding: async () => {
      throw new Error('not used');
    },
  };

  return {
    ...baseValue,
    ...overrides,
  };
}

describe('CommerceAdminBulkOnboardingPageComponent', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('restores the session selection and prevents duplicate adds', async () => {
    const storedSelection = [createSearchResult()];

    window.sessionStorage.setItem(
      selectionStorageKey,
      JSON.stringify(storedSelection),
    );

    await TestBed.configureTestingModule({
      imports: [CommerceAdminBulkOnboardingPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: CommerceAdminApiService,
          useValue: createApiServiceStub(),
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      CommerceAdminBulkOnboardingPageComponent,
    );

    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    const duplicateSet = createSearchResult();
    const extraSet = createSearchResult({
      name: 'Great Deku Tree 2-in-1',
      pieces: 2500,
      releaseYear: 2024,
      setId: '77092',
      slug: 'great-deku-tree-2-in-1-77092',
      sourceSetNumber: '77092-1',
      theme: 'The Legend of Zelda',
    });

    expect(component.selectedSets().map((setItem) => setItem.setId)).toEqual([
      '10316',
    ]);

    component.addSetToSelection(duplicateSet);
    component.addSetToSelection(extraSet);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.selectedSets().map((setItem) => setItem.setId)).toEqual([
      '10316',
      '77092',
    ]);
    expect(
      JSON.parse(window.sessionStorage.getItem(selectionStorageKey) ?? '[]'),
    ).toEqual(component.selectedSets());
  });

  it('normalizes direct set ids, dedupes, and flags already present or invalid input', async () => {
    const searchCatalogMissingSets = vi.fn(
      async (query: string): Promise<CatalogExternalSetSearchResult[]> => {
        if (query === '21061') {
          return [
            createSearchResult({
              imageUrl: 'https://images.example.test/21061.jpg',
              name: 'Notre-Dame de Paris',
              pieces: 4383,
              releaseYear: 2024,
              setId: '21061',
              slug: 'notre-dame-de-paris-21061',
              sourceSetNumber: '21061-1',
              theme: 'Architecture',
            }),
          ];
        }

        return [];
      },
    );

    await TestBed.configureTestingModule({
      imports: [CommerceAdminBulkOnboardingPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: CommerceAdminApiService,
          useValue: createApiServiceStub({
            listCatalogSets: async () => [
              createCatalogSetSummary({
                collectorAngle: 'Rivendell blijft groot en rustig op je plank.',
              }),
            ],
            searchCatalogMissingSets,
          }),
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      CommerceAdminBulkOnboardingPageComponent,
    );

    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;

    component.updateDirectInput('10316, 21061 21061 foo');
    await component.addDirectSetIds();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(searchCatalogMissingSets).toHaveBeenCalledTimes(1);
    expect(searchCatalogMissingSets).toHaveBeenCalledWith('21061');
    expect(component.selectedSets().map((setItem) => setItem.setId)).toEqual([
      '21061',
    ]);
    expect(
      component.directIntakeRows().map((row) => ({
        normalizedSetId: row.normalizedSetId,
        status: row.status,
      })),
    ).toEqual([
      {
        normalizedSetId: '10316',
        status: 'already_in_catalog',
      },
      {
        normalizedSetId: '21061',
        status: 'added',
      },
      {
        normalizedSetId: '21061',
        status: 'already_selected',
      },
      {
        normalizedSetId: undefined,
        status: 'invalid',
      },
    ]);
    expect(component.directInputStats()).toEqual({
      rawTokenCount: 4,
      validTokenCount: 3,
      uniqueValidTokenCount: 2,
    });
    expect(component.directIntakeSummary()).toEqual({
      addedCount: 1,
      alreadyInCatalogCount: 1,
      alreadySelectedCount: 1,
      invalidCount: 1,
      notFoundCount: 0,
      processedCount: 4,
    });
  });

  it('filters and removes only the visible sets in the batch cart', async () => {
    await TestBed.configureTestingModule({
      imports: [CommerceAdminBulkOnboardingPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: CommerceAdminApiService,
          useValue: createApiServiceStub(),
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      CommerceAdminBulkOnboardingPageComponent,
    );

    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;

    component.selectedSets.set([
      createSearchResult(),
      createSearchResult({
        name: 'Notre-Dame de Paris',
        pieces: 4383,
        releaseYear: 2024,
        setId: '21061',
        slug: 'notre-dame-de-paris-21061',
        sourceSetNumber: '21061-1',
        theme: 'Architecture',
      }),
      createSearchResult({
        name: 'The Burrow - Collectors’ Edition',
        pieces: 2405,
        releaseYear: 2024,
        setId: '76437',
        slug: 'the-burrow-collectors-edition-76437',
        sourceSetNumber: '76437-1',
        theme: 'Harry Potter',
      }),
    ]);

    component.updateCartSearch('Paris');

    expect(component.filteredSelectedSets().map((row) => row.setId)).toEqual([
      '21061',
    ]);

    component.removeVisibleSelection();

    expect(component.selectedSets().map((row) => row.setId)).toEqual([
      '10316',
      '76437',
    ]);
  });

  it('loads suggested sets and adds the selected suggestion to the batch cart', async () => {
    await TestBed.configureTestingModule({
      imports: [CommerceAdminBulkOnboardingPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: CommerceAdminApiService,
          useValue: createApiServiceStub({
            listCatalogSuggestedSets: async () => [
              createSuggestedSet({
                imageUrl: 'https://images.example.test/10312.jpg',
                name: 'Jazz Club',
                pieces: 2899,
                releaseYear: 2023,
                score: 112,
                setId: '10312',
                slug: 'jazz-club-10312',
                sourceSetNumber: '10312-1',
                theme: 'Icons',
              }),
            ],
          }),
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      CommerceAdminBulkOnboardingPageComponent,
    );

    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;

    expect(
      component.sortedSuggestedSets().map((setItem) => setItem.setId),
    ).toEqual(['10312']);

    component.toggleSuggestedSelection('10312', true);
    component.addSuggestedSelectionToCart();

    expect(component.selectedSets().map((setItem) => setItem.setId)).toEqual([
      '10312',
    ]);
    expect(component.selectedSuggestedSetCount()).toBe(0);
  });

  it('starts bulk onboarding for the selected set ids and stores the active run id', async () => {
    const startCatalogBulkOnboarding = vi.fn(
      async (setIds: readonly string[]) => createStartResult(setIds),
    );

    await TestBed.configureTestingModule({
      imports: [CommerceAdminBulkOnboardingPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: CommerceAdminApiService,
          useValue: createApiServiceStub({
            startCatalogBulkOnboarding,
          }),
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      CommerceAdminBulkOnboardingPageComponent,
    );

    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;

    component.selectedSets.set([
      createSearchResult(),
      createSearchResult({
        name: 'Notre-Dame de Paris',
        pieces: 4383,
        releaseYear: 2024,
        setId: '21061',
        slug: 'notre-dame-de-paris-21061',
        sourceSetNumber: '21061-1',
        theme: 'Architecture',
      }),
    ]);

    await component.startBulkOnboarding();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(startCatalogBulkOnboarding).toHaveBeenCalledWith(['10316', '21061']);
    expect(component.activeRun()?.runId).toBe('bulk-10316-21061');
    expect(component.activeRunStateFilePath()).toBe(
      '/tmp/catalog-bulk-onboarding-state.json',
    );
    expect(window.sessionStorage.getItem(runIdStorageKey)).toBe(
      'bulk-10316-21061',
    );
  });

  it('filters the per-set queue for sets without commerce context', async () => {
    await TestBed.configureTestingModule({
      imports: [CommerceAdminBulkOnboardingPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: CommerceAdminApiService,
          useValue: createApiServiceStub(),
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      CommerceAdminBulkOnboardingPageComponent,
    );

    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;

    component.activeRun.set(createRun());
    component.updateResultFilter('no_commerce_context');

    expect(component.runResultRows().map((row) => row.setId)).toEqual([
      '21061',
    ]);
  });
});
