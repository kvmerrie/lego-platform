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
            searchCatalogMissingSets: async () => [],
            createCatalogOverlaySet: async () => undefined,
            listBenchmarkSets: async () => [],
            createBenchmarkSet: async () => undefined,
            deleteBenchmarkSet: async () => undefined,
            listMerchants: async () => [],
            listDiscoveryRuns: async () => [],
            listDiscoveryCandidates: async () => [],
            runDiscovery: async () => ({
              candidates: [],
              run: {
                id: 'run-1',
                setId: '10316',
                merchantId: 'merchant-1',
                searchQuery: '10316',
                searchUrl:
                  'https://misterbricks.nl/catalogsearch/result/?q=10316',
                status: 'success',
                candidateCount: 0,
                createdAt: '2026-04-17T08:00:00.000Z',
                updatedAt: '2026-04-17T08:00:00.000Z',
              },
            }),
            approveDiscoveryCandidate: async () => ({
              candidate: undefined,
              message: 'ok',
              outcome: 'linked_existing_seed',
            }),
            rejectDiscoveryCandidate: async () => undefined,
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
});
