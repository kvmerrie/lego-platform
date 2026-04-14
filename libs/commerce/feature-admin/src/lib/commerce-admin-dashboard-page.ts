import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommerceAdminStore } from './commerce-admin-store.service';

@Component({
  selector: 'lego-commerce-admin-dashboard-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './commerce-admin-dashboard-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommerceAdminDashboardPageComponent {
  readonly commerceAdminStore = inject(CommerceAdminStore);
  readonly needsAttention = computed(() => [
    ...this.commerceAdminStore
      .coverage()
      .brokenSeeds.slice(0, 4)
      .map((offerSeed) => ({
        id: offerSeed.id,
        label: this.commerceAdminStore.getCatalogSetLabel(offerSeed.setId),
        meta: `${this.commerceAdminStore.getMerchantName(
          offerSeed.merchantId,
        )} · ${this.commerceAdminStore.getOfferSeedHealthLabel(offerSeed)}`,
      })),
    ...this.commerceAdminStore
      .coverage()
      .staleSeeds.slice(0, 4)
      .map((offerSeed) => ({
        id: offerSeed.id,
        label: this.commerceAdminStore.getCatalogSetLabel(offerSeed.setId),
        meta: `${this.commerceAdminStore.getMerchantName(
          offerSeed.merchantId,
        )} · ${this.commerceAdminStore.getOfferSeedHealthLabel(offerSeed)}`,
      })),
  ]);
}
