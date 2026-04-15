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
import {
  CommerceAdminOfferSeedDialogComponent,
  type CommerceOfferSeedDialogPrefill,
} from './commerce-admin-offer-seed-dialog';
import { CommerceAdminStore } from './commerce-admin-store.service';

type OperationsCoverageFilter = 'all' | 'benchmark' | 'missing' | 'review';

@Component({
  selector: 'lego-commerce-admin-operations-page',
  imports: [CommonModule, FormsModule, CommerceAdminOfferSeedDialogComponent],
  templateUrl: './commerce-admin-operations-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommerceAdminOperationsPageComponent {
  readonly commerceAdminStore = inject(CommerceAdminStore);
  readonly search = signal('');
  readonly filter = signal<OperationsCoverageFilter>('all');
  readonly isDialogOpen = signal(false);
  readonly selectedOfferSeed = signal<CommerceOfferSeed | null>(null);
  readonly offerSeedPrefill = signal<CommerceOfferSeedDialogPrefill | null>(
    null,
  );
  readonly filteredCoverageRows = computed(() => {
    const searchValue = this.search().trim().toLowerCase();
    const filter = this.filter();

    return this.commerceAdminStore
      .commerceRelevantCoverageRows()
      .filter((coverageRow) => {
        if (
          filter === 'benchmark' &&
          !this.commerceAdminStore.isBenchmarkSet(coverageRow.setId)
        ) {
          return false;
        }

        if (
          filter === 'missing' &&
          coverageRow.missingMerchantNames.length === 0
        ) {
          return false;
        }

        if (
          filter === 'review' &&
          coverageRow.reviewMerchantNames.length === 0 &&
          coverageRow.pendingMerchantNames.length === 0
        ) {
          return false;
        }

        if (!searchValue) {
          return true;
        }

        return (
          coverageRow.setId.toLowerCase().includes(searchValue) ||
          coverageRow.setName.toLowerCase().includes(searchValue) ||
          coverageRow.theme.toLowerCase().includes(searchValue)
        );
      });
  });

  updateFilter(value: OperationsCoverageFilter): void {
    this.filter.set(value);
  }

  updateSearch(value: string): void {
    this.search.set(value);
  }

  openOfferSeedDialog(input: {
    merchantCoverage: {
      merchantId: string;
      offerSeed?: CommerceOfferSeed;
    };
    setId: string;
  }): void {
    if (input.merchantCoverage.offerSeed) {
      this.selectedOfferSeed.set(input.merchantCoverage.offerSeed);
      this.offerSeedPrefill.set(null);
    } else {
      this.selectedOfferSeed.set(null);
      this.offerSeedPrefill.set({
        setId: input.setId,
        merchantId: input.merchantCoverage.merchantId,
      });
    }

    this.isDialogOpen.set(true);
  }

  closeDialog(): void {
    this.selectedOfferSeed.set(null);
    this.offerSeedPrefill.set(null);
    this.isDialogOpen.set(false);
  }
}
