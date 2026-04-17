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
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        component: CommerceAdminDashboardPageComponent,
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
