import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { type CommerceOfferSeed } from '@lego-platform/commerce/util';
import { CommerceAdminOfferSeedDialogComponent } from './commerce-admin-offer-seed-dialog';
import { CommerceAdminStore } from './commerce-admin-store.service';

type OfferSeedFilter =
  | 'active'
  | 'all'
  | 'error'
  | 'inactive'
  | 'invalid'
  | 'pending'
  | 'stale'
  | 'success'
  | 'unavailable'
  | 'valid';

@Component({
  selector: 'lego-commerce-admin-offer-seeds-page',
  imports: [CommonModule, FormsModule, CommerceAdminOfferSeedDialogComponent],
  templateUrl: './commerce-admin-offer-seeds-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommerceAdminOfferSeedsPageComponent {
  readonly commerceAdminStore = inject(CommerceAdminStore);
  readonly merchantFilter = signal('all');
  readonly offerSeedFilter = signal<OfferSeedFilter>('all');
  readonly offerSeedSearch = signal('');
  readonly isDialogOpen = signal(false);
  readonly selectedOfferSeed = signal<CommerceOfferSeed | null>(null);
  readonly filteredOfferSeeds = computed(() => {
    const searchValue = this.offerSeedSearch().trim().toLowerCase();
    const merchantId = this.merchantFilter();
    const offerSeedFilter = this.offerSeedFilter();

    return this.commerceAdminStore.offerSeeds().filter((offerSeed) => {
      const merchantMatches =
        merchantId === 'all' || offerSeed.merchantId === merchantId;
      const statusMatches = this.matchesFilter(offerSeed, offerSeedFilter);

      if (!merchantMatches || !statusMatches) {
        return false;
      }

      if (!searchValue) {
        return true;
      }

      const catalogSetLabel = this.commerceAdminStore.getCatalogSetLabel(
        offerSeed.setId,
      );
      const merchantName = this.commerceAdminStore.getMerchantName(
        offerSeed.merchantId,
      );

      return (
        offerSeed.setId.toLowerCase().includes(searchValue) ||
        catalogSetLabel.toLowerCase().includes(searchValue) ||
        merchantName.toLowerCase().includes(searchValue) ||
        offerSeed.productUrl.toLowerCase().includes(searchValue)
      );
    });
  });

  openCreateDialog(): void {
    this.selectedOfferSeed.set(null);
    this.isDialogOpen.set(true);
  }

  openEditDialog(offerSeed: CommerceOfferSeed): void {
    this.selectedOfferSeed.set(offerSeed);
    this.isDialogOpen.set(true);
  }

  closeDialog(): void {
    this.selectedOfferSeed.set(null);
    this.isDialogOpen.set(false);
  }

  updateMerchantFilter(value: string): void {
    this.merchantFilter.set(value);
  }

  updateOfferSeedFilter(value: OfferSeedFilter): void {
    this.offerSeedFilter.set(value);
  }

  updateSearch(value: string): void {
    this.offerSeedSearch.set(value);
  }

  async toggleOfferSeedActive(offerSeed: CommerceOfferSeed): Promise<void> {
    try {
      await this.commerceAdminStore.toggleOfferSeedActive(offerSeed);
    } catch {
      return;
    }
  }

  private matchesFilter(
    offerSeed: CommerceOfferSeed,
    filter: OfferSeedFilter,
  ): boolean {
    switch (filter) {
      case 'active':
        return offerSeed.isActive;
      case 'inactive':
        return !offerSeed.isActive;
      case 'pending':
      case 'valid':
      case 'invalid':
      case 'stale':
        return offerSeed.validationStatus === filter;
      case 'error':
      case 'success':
      case 'unavailable':
        return offerSeed.latestOffer?.fetchStatus === filter;
      case 'all':
      default:
        return true;
    }
  }
}
