import { Route } from '@angular/router';
import {
  CommerceAdminAddSetPageComponent,
  CommerceAdminAffiliateDiscoveredSetsPageComponent,
  CommerceAdminBulkOnboardingPageComponent,
  CommerceAdminCacheRevalidationPageComponent,
  CommerceAdminCmsPageComponent,
  CommerceAdminCoveragePageComponent,
  CommerceAdminCoverageQueuePageComponent,
  CommerceAdminDashboardPageComponent,
  CommerceAdminDiscoveryCandidatesPageComponent,
  CommerceAdminHealthPageComponent,
  CommerceAdminMerchantsPageComponent,
  CommerceAdminOperationsPageComponent,
  CommerceAdminOperationsDashboardPageComponent,
  CommerceAdminOfferSeedsPageComponent,
  CommerceAdminSetsPageComponent,
  CommerceAdminSyncPromotePageComponent,
  CommerceFeatureAdminComponent,
} from '@lego-platform/commerce/feature-admin';
import { ContentAdminEditorialAgentPageComponent } from '@lego-platform/content/feature-admin';

export const appRoutes: Route[] = [
  {
    path: '',
    component: CommerceFeatureAdminComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        component: CommerceAdminOperationsDashboardPageComponent,
      },
      {
        path: 'catalog-intake',
        component: CommerceAdminBulkOnboardingPageComponent,
      },
      {
        path: 'discovery',
        component: CommerceAdminDiscoveryCandidatesPageComponent,
      },
      {
        path: 'sync-promote',
        component: CommerceAdminSyncPromotePageComponent,
      },
      {
        path: 'health',
        component: CommerceAdminHealthPageComponent,
      },
      {
        path: 'cms',
        component: CommerceAdminCmsPageComponent,
      },
      {
        path: 'workbench',
        component: CommerceAdminCoverageQueuePageComponent,
      },
      {
        path: 'workflow',
        component: CommerceAdminDashboardPageComponent,
      },
      {
        path: 'new-set',
        component: CommerceAdminAddSetPageComponent,
      },
      {
        path: 'bulk-onboarding',
        component: CommerceAdminBulkOnboardingPageComponent,
      },
      {
        path: 'affiliate-discovered-sets',
        component: CommerceAdminAffiliateDiscoveredSetsPageComponent,
      },
      {
        path: 'add-set',
        pathMatch: 'full',
        redirectTo: 'new-set',
      },
      {
        path: 'merchants',
        component: CommerceAdminMerchantsPageComponent,
      },
      {
        path: 'operations/cache-revalidation',
        component: CommerceAdminCacheRevalidationPageComponent,
      },
      {
        path: 'operations',
        component: CommerceAdminOperationsPageComponent,
      },
      {
        path: 'offer-seeds',
        component: CommerceAdminOfferSeedsPageComponent,
      },
      {
        path: 'sets',
        component: CommerceAdminSetsPageComponent,
      },
      {
        path: 'coverage-queue',
        pathMatch: 'full',
        redirectTo: 'workbench',
      },
      {
        path: 'coverage',
        component: CommerceAdminCoveragePageComponent,
      },
      {
        path: 'editorial-agent',
        component: ContentAdminEditorialAgentPageComponent,
      },
    ],
  },
];
