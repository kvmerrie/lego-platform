import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CommerceAdminApiService } from '@lego-platform/commerce/feature-admin';
import { App } from './app';
import { appRoutes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(appRoutes),
        {
          provide: CommerceAdminApiService,
          useValue: {
            listCatalogSets: async () => [],
            listCatalogSuggestedSets: async () => [],
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
          },
        },
      ],
    }).compileComponents();
  });

  it('creates the admin shell root component', () => {
    const fixture = TestBed.createComponent(App);

    fixture.detectChanges();

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows Workbench, New set and Sets as the primary IA', async () => {
    const fixture = TestBed.createComponent(App);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Workbench');
    expect(text).toContain('New set');
    expect(text).toContain('Sets');
    expect(text).not.toContain('Dashboard');
  });

  it('redirects the root and dashboard aliases to workbench', () => {
    const rootRoute = appRoutes[0]?.children?.find(
      (route) => route.path === '',
    );
    const dashboardRoute = appRoutes[0]?.children?.find(
      (route) => route.path === 'dashboard',
    );
    const workbenchRoute = appRoutes[0]?.children?.find(
      (route) => route.path === 'workbench',
    );
    const addSetAliasRoute = appRoutes[0]?.children?.find(
      (route) => route.path === 'add-set',
    );
    const bulkOnboardingRoute = appRoutes[0]?.children?.find(
      (route) => route.path === 'bulk-onboarding',
    );

    expect(rootRoute?.redirectTo).toBe('workbench');
    expect(dashboardRoute?.redirectTo).toBe('workbench');
    expect(workbenchRoute?.component).toBeTruthy();
    expect(addSetAliasRoute?.redirectTo).toBe('new-set');
    expect(bulkOnboardingRoute?.component).toBeTruthy();
  });
});
