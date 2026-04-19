import { Route } from '@angular/router';
import {
  CommerceAdminAddSetPageComponent,
  CommerceAdminCoveragePageComponent,
  CommerceAdminCoverageQueuePageComponent,
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
        redirectTo: 'workbench',
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
        path: 'dashboard',
        pathMatch: 'full',
        redirectTo: 'workbench',
      },
      {
        path: 'new-set',
        component: CommerceAdminAddSetPageComponent,
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
    ],
  },
];
