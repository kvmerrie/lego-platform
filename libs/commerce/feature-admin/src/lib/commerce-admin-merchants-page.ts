import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { type CommerceMerchant } from '@lego-platform/commerce/util';
import { CommerceAdminMerchantDialogComponent } from './commerce-admin-merchant-dialog';
import { CommerceAdminStore } from './commerce-admin-store.service';

@Component({
  selector: 'lego-commerce-admin-merchants-page',
  imports: [CommonModule, FormsModule, CommerceAdminMerchantDialogComponent],
  templateUrl: './commerce-admin-merchants-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommerceAdminMerchantsPageComponent {
  readonly commerceAdminStore = inject(CommerceAdminStore);
  readonly merchantSearch = signal('');
  readonly isDialogOpen = signal(false);
  readonly selectedMerchant = signal<CommerceMerchant | null>(null);
  readonly filteredMerchants = computed(() => {
    const searchValue = this.merchantSearch().trim().toLowerCase();

    if (!searchValue) {
      return this.commerceAdminStore.merchants();
    }

    return this.commerceAdminStore
      .merchants()
      .filter(
        (merchant) =>
          merchant.name.toLowerCase().includes(searchValue) ||
          merchant.slug.toLowerCase().includes(searchValue) ||
          (merchant.affiliateNetwork ?? '').toLowerCase().includes(searchValue),
      );
  });

  openCreateDialog(): void {
    this.selectedMerchant.set(null);
    this.isDialogOpen.set(true);
  }

  openEditDialog(merchant: CommerceMerchant): void {
    this.selectedMerchant.set(merchant);
    this.isDialogOpen.set(true);
  }

  closeDialog(): void {
    this.selectedMerchant.set(null);
    this.isDialogOpen.set(false);
  }

  updateSearch(value: string): void {
    this.merchantSearch.set(value);
  }

  async toggleMerchantActive(merchant: CommerceMerchant): Promise<void> {
    try {
      await this.commerceAdminStore.toggleMerchantActive(merchant);
    } catch {
      return;
    }
  }
}
