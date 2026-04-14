import { Route } from '@angular/router';
import {
  CommerceAdminCoveragePageComponent,
  CommerceAdminDashboardPageComponent,
  CommerceAdminMerchantsPageComponent,
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
        path: 'merchants',
        component: CommerceAdminMerchantsPageComponent,
      },
      {
        path: 'offer-seeds',
        component: CommerceAdminOfferSeedsPageComponent,
      },
      {
        path: 'coverage',
        component: CommerceAdminCoveragePageComponent,
      },
    ],
  },
];
