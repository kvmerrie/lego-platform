import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  CommerceAdminApiService,
  CommerceAdminOperationsDashboardPageComponent,
} from '@lego-platform/commerce/feature-admin';

describe('CommerceAdminOperationsDashboardPageComponent', () => {
  it('loads and renders the operations summary', async () => {
    await TestBed.configureTestingModule({
      imports: [CommerceAdminOperationsDashboardPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: CommerceAdminApiService,
          useValue: {
            getOperationsSummary: async () => ({
              apiHealth: {
                checkedAt: '2026-04-19T08:00:00.000Z',
                status: 'ok',
              },
              discoveryCandidates: {
                catalogDiscoveryCandidateCount: 3,
                highCount: 1,
                lowCount: 1,
                mediumCount: 1,
                newCount: 1,
                suggestedSetCount: null,
                totalCount: 3,
              },
              environments: {
                currentRuntimeEnvironment: 'staging',
                productionReadOnly: false,
                writableEnvironment: 'staging',
              },
              errors: [],
              activeBulkOnboardingRun: null,
              latestBulkOnboardingRun: {
                run: {
                  createdAt: '2026-04-19T08:00:00.000Z',
                  generateStep: { appliedSetIds: [], status: 'completed' },
                  importStep: { appliedSetIds: [], status: 'completed' },
                  requestedSetIds: ['10316'],
                  runId: 'bulk-10316',
                  setProgressById: {},
                  snapshotStep: { appliedSetIds: [], status: 'completed' },
                  status: 'completed',
                  syncStep: { appliedSetIds: [], status: 'completed' },
                  updatedAt: '2026-04-19T08:05:00.000Z',
                  validateStep: { appliedSetIds: [], status: 'completed' },
                },
                stateFilePath: '/tmp/catalog-bulk-onboarding-state.json',
              },
              latestBulkOnboardingRunStale: false,
              latestCompletedBulkOnboardingRun: {
                run: {
                  createdAt: '2026-04-19T08:00:00.000Z',
                  generateStep: { appliedSetIds: [], status: 'completed' },
                  importStep: { appliedSetIds: [], status: 'completed' },
                  requestedSetIds: ['10316'],
                  runId: 'bulk-10316',
                  setProgressById: {},
                  snapshotStep: { appliedSetIds: [], status: 'completed' },
                  status: 'completed',
                  syncStep: { appliedSetIds: [], status: 'completed' },
                  updatedAt: '2026-04-19T08:05:00.000Z',
                  validateStep: { appliedSetIds: [], status: 'completed' },
                },
                stateFilePath: '/tmp/catalog-bulk-onboarding-state.json',
              },
              latestProductionSync: null,
              pendingPromoteCount: 4,
              promotePreview: {
                generatedAt: '2026-04-19T08:06:00.000Z',
                skippedHeavyTables: ['collection_page_snapshots'],
                sourceEnvironment: 'staging',
                status: 'ok',
                targetEnvironment: 'production',
              },
              rebrickableLiveCallCount: 0,
            }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      CommerceAdminOperationsDashboardPageComponent,
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('staging');
    expect(text).toContain('4');
    expect(text).toContain('bulk-10316');
    expect(text).toContain('1');
    expect(text).toContain('ok');
  });

  it('renders partial summary errors when promote preview is unavailable', async () => {
    await TestBed.configureTestingModule({
      imports: [CommerceAdminOperationsDashboardPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: CommerceAdminApiService,
          useValue: {
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
              errors: [
                {
                  check: 'promote_preview',
                  message: 'collection_page_snapshots timed out',
                },
              ],
              activeBulkOnboardingRun: null,
              latestBulkOnboardingRun: null,
              latestBulkOnboardingRunStale: false,
              latestCompletedBulkOnboardingRun: null,
              latestProductionSync: null,
              pendingPromoteCount: null,
              promotePreview: null,
              rebrickableLiveCallCount: 0,
            }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      CommerceAdminOperationsDashboardPageComponent,
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('promote_preview');
    expect(text).toContain('collection_page_snapshots timed out');
    expect(text).toContain('unavailable');
    expect(text).not.toContain('Operations summary laden');
  });
});
