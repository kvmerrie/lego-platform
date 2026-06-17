import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { CommerceAdminApiService } from '@lego-platform/commerce/feature-admin';
import { AdminAuthService } from './admin-auth.service';
import { App } from './app';
import { appRoutes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(appRoutes),
        {
          provide: AdminAuthService,
          useValue: {
            initialize: async () => undefined,
            loginNotice: signal(null),
            signInWithEmail: async () => undefined,
            signOut: async () => undefined,
            state: signal({
              email: 'kvmerrie@gmail.com',
              status: 'authenticated',
            }),
          },
        },
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
            listCatalogDiscoveryCandidates: async () => [],
            importCatalogDiscoveryCandidate: async () => {
              throw new Error('not used');
            },
            updateCatalogDiscoveryCandidateStatus: async () => {
              throw new Error('not used');
            },
            syncMerchantCatalogDiscoveryCandidates: async () => ({
              discoveredSetCount: 0,
              existingCatalogMatchCount: 0,
              existingDiscoveryCandidateCount: 0,
              highConfidenceCount: 0,
              invalidSetNumberCount: 0,
              lowConfidenceCount: 0,
              mediumConfidenceCount: 0,
              merchantOfferCount: 0,
              missingRebrickableMatchCount: 0,
              noiseFilteredCount: 0,
              nonNewFilteredCount: 0,
              persistedCandidateCount: 0,
              skippedExistingOfficialCandidateCount: 0,
              skippedTerminalMerchantCandidateCount: 0,
              uniqueCandidateCount: 0,
            }),
            listBenchmarkSets: async () => [],
            createBenchmarkSet: async () => undefined,
            deleteBenchmarkSet: async () => undefined,
            listMerchants: async () => [],
            createMerchant: async () => undefined,
            updateMerchant: async () => undefined,
            listOfferSeeds: async () => [],
            createOfferSeed: async () => undefined,
            updateOfferSeed: async () => undefined,
            listAffiliateDiscoveredSets: async () => [],
            importAffiliateDiscoveredSets: async () => ({
              alreadyCatalogedCount: 0,
              attachedOfferCount: 0,
              createdCatalogSetCount: 0,
              failedLookupCount: 0,
              importedCount: 0,
              requestedCount: 0,
              skippedCount: 0,
              uniqueSetCount: 0,
            }),
            updateAffiliateDiscoveredSetStatus: async () => undefined,
            syncCommerceFromProduction: async () => ({
              dryRun: true,
              durationMs: 0,
              startedAt: '2026-04-19T08:00:00.000Z',
              status: 'ok',
              tables: {},
            }),
            getOperationsSummary: async () => ({
              apiHealth: {
                checkedAt: '2026-04-19T08:00:00.000Z',
                status: 'ok',
              },
              discoveryCandidates: {
                catalogDiscoveryCandidateCount: 0,
                highCount: 0,
                lowCount: 0,
                mediumCount: 0,
                newCount: 0,
                suggestedSetCount: null,
                totalCount: 0,
              },
              environments: {
                currentRuntimeEnvironment: 'staging',
                productionReadOnly: false,
                writableEnvironment: 'staging',
              },
              errors: [],
              activeBulkOnboardingRun: null,
              latestBulkOnboardingRun: null,
              latestBulkOnboardingRunStale: false,
              latestCompletedBulkOnboardingRun: null,
              latestProductionSync: null,
              pendingPromoteCount: 0,
              promotePreview: {
                generatedAt: '2026-04-19T08:00:00.000Z',
                skippedHeavyTables: ['collection_page_snapshots'],
                sourceEnvironment: 'staging',
                status: 'ok',
                targetEnvironment: 'production',
              },
              rebrickableLiveCallCount: 0,
            }),
            getCatalogPromotionPreview: async () => ({
              generatedAt: '2026-04-19T08:00:00.000Z',
              meaningfulPendingPromoteCount: 0,
              operatorSummary: {
                mappings: {
                  insertedCount: 0,
                  readCount: 0,
                  skipped: false,
                  strategy: 'sample_diff',
                  updatedCount: 0,
                },
                sets: {
                  insertedCount: 0,
                  readCount: 0,
                  skipped: false,
                  strategy: 'sample_diff',
                  updatedCount: 0,
                },
                themes: {
                  insertedCount: 0,
                  readCount: 0,
                  skipped: false,
                  strategy: 'sample_diff',
                  updatedCount: 0,
                },
              },
              pendingPromoteCount: 0,
              samples: [],
              skippedHeavyTables: ['collection_page_snapshots'],
              sourceEnvironment: 'staging',
              status: 'ok',
              tables: {
                collection_page_snapshots: {
                  insertedCount: 0,
                  readCount: 0,
                  skipped: true,
                  strategy: 'heavy_skipped',
                  updatedCount: 0,
                  warning: 'Skipped in lightweight preview.',
                },
              },
              targetEnvironment: 'production',
            }),
            promoteCatalog: async () => ({
              changedThemeSlugs: [],
              durationMs: 0,
              startedAt: '2026-04-19T08:00:00.000Z',
              status: 'ok',
              tables: {},
            }),
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

  it('shows only the Operations Console V2 IA in the shell navigation', async () => {
    const fixture = TestBed.createComponent(App);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Dashboard');
    expect(text).toContain('Catalog Intake');
    expect(text).toContain('Discovery');
    expect(text).toContain('Sync & Promote');
    expect(text).toContain('Health');
    expect(text).not.toContain('Workbench');
    expect(text).not.toContain('New set');
    expect(text).not.toContain('Editorial agent');
  });

  it('routes V2 pages while keeping legacy routes reachable but hidden', () => {
    const rootRoute = appRoutes[0]?.children?.find(
      (route) => route.path === '',
    );
    const dashboardRoute = appRoutes[0]?.children?.find(
      (route) => route.path === 'dashboard',
    );
    const catalogIntakeRoute = appRoutes[0]?.children?.find(
      (route) => route.path === 'catalog-intake',
    );
    const discoveryRoute = appRoutes[0]?.children?.find(
      (route) => route.path === 'discovery',
    );
    const syncPromoteRoute = appRoutes[0]?.children?.find(
      (route) => route.path === 'sync-promote',
    );
    const healthRoute = appRoutes[0]?.children?.find(
      (route) => route.path === 'health',
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
    const editorialAgentRoute = appRoutes[0]?.children?.find(
      (route) => route.path === 'editorial-agent',
    );

    expect(rootRoute?.redirectTo).toBe('dashboard');
    expect(dashboardRoute?.component).toBeTruthy();
    expect(catalogIntakeRoute?.component).toBeTruthy();
    expect(discoveryRoute?.component).toBeTruthy();
    expect(syncPromoteRoute?.component).toBeTruthy();
    expect(healthRoute?.component).toBeTruthy();
    expect(workbenchRoute?.component).toBeTruthy();
    expect(addSetAliasRoute?.redirectTo).toBe('new-set');
    expect(bulkOnboardingRoute?.component).toBeTruthy();
    expect(editorialAgentRoute?.component).toBeTruthy();
  });
});
