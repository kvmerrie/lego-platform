import { Route } from '@angular/router';
import {
  CommerceAdminAddSetPageComponent,
  CommerceAdminCoveragePageComponent,
  CommerceAdminCoverageQueuePageComponent,
  CommerceAdminDiscoveryPageComponent,
  CommerceAdminDashboardPageComponent,
  CommerceAdminMerchantsPageComponent,
  CommerceAdminOperationsPageComponent,
  CommerceAdminOfferSeedsPageComponent,
  CommerceAdminSetsPageComponent,
  CommerceFeatureAdminComponent,
} from '@lego-platform/commerce/feature-admin';

export const appRoutes: Route[] = [
  {
    path: '',
    component: CommerceFeatureAdminComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'workflow',
      },
      {
        path: 'workflow',
        component: CommerceAdminDashboardPageComponent,
      },
      {
        path: 'dashboard',
        pathMatch: 'full',
        redirectTo: 'workflow',
      },
      {
        path: 'add-set',
        component: CommerceAdminAddSetPageComponent,
      },
      {
        path: 'merchants',
        component: CommerceAdminMerchantsPageComponent,
      },
      {
        path: 'operations',
        component: CommerceAdminOperationsPageComponent,
      },
      {
        path: 'discovery',
        component: CommerceAdminDiscoveryPageComponent,
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
        component: CommerceAdminCoverageQueuePageComponent,
      },
      {
        path: 'coverage',
        component: CommerceAdminCoveragePageComponent,
      },
    ],
  },
];
