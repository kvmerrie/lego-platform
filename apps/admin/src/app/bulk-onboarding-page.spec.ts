import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import {
  CommerceAdminApiService,
  CommerceAdminBulkOnboardingPageComponent,
} from '@lego-platform/commerce/feature-admin';
import { type CatalogExternalSetSearchResult } from '@lego-platform/catalog/util';

const selectionStorageKey = 'brickhunt.admin.bulk-onboarding.selection';
const runIdStorageKey = 'brickhunt.admin.bulk-onboarding.active-run-id';

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
          useValue: {
            getCatalogBulkOnboardingRun: async () => null,
            getLatestCatalogBulkOnboardingRun: async () => null,
            searchCatalogMissingSets: async () => [],
            startCatalogBulkOnboarding: async () => {
              throw new Error('not used');
            },
          },
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

  it('starts bulk onboarding for the selected set ids and stores the active run id', async () => {
    const startCatalogBulkOnboarding = vi.fn(
      async (setIds: readonly string[]) => ({
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
      }),
    );

    await TestBed.configureTestingModule({
      imports: [CommerceAdminBulkOnboardingPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: CommerceAdminApiService,
          useValue: {
            getCatalogBulkOnboardingRun: async () => null,
            getLatestCatalogBulkOnboardingRun: async () => null,
            searchCatalogMissingSets: async () => [],
            startCatalogBulkOnboarding,
          },
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
});
