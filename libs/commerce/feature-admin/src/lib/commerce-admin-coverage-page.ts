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
import { RouterLink } from '@angular/router';
import {
  CommerceAdminOfferSeedDialogComponent,
  type CommerceOfferSeedDialogPrefill,
} from './commerce-admin-offer-seed-dialog';
import { CommerceAdminStore } from './commerce-admin-store.service';

@Component({
  selector: 'lego-commerce-admin-coverage-page',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CommerceAdminOfferSeedDialogComponent,
  ],
  templateUrl: './commerce-admin-coverage-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommerceAdminCoveragePageComponent {
  readonly commerceAdminStore = inject(CommerceAdminStore);
  readonly selectedBenchmarkSetId = signal('');
  readonly isDialogOpen = signal(false);
  readonly selectedOfferSeed = signal<CommerceOfferSeed | null>(null);
  readonly offerSeedPrefill = signal<CommerceOfferSeedDialogPrefill | null>(
    null,
  );
  readonly availableBenchmarkSetOptions = computed(() =>
    this.commerceAdminStore.benchmarkCatalogSetOptions(),
  );

  get benchmarkSetSelection(): string {
    const selectedBenchmarkSetId = this.selectedBenchmarkSetId();

    if (
      this.availableBenchmarkSetOptions().some(
        (catalogSetOption) => catalogSetOption.id === selectedBenchmarkSetId,
      )
    ) {
      return selectedBenchmarkSetId;
    }

    return this.availableBenchmarkSetOptions()[0]?.id ?? '';
  }

  updateSelectedBenchmarkSet(value: string): void {
    this.selectedBenchmarkSetId.set(value);
  }

  async addBenchmarkSet(): Promise<void> {
    const setId = this.benchmarkSetSelection;

    if (!setId) {
      return;
    }

    try {
      await this.commerceAdminStore.addBenchmarkSet({
        setId,
      });
      this.selectedBenchmarkSetId.set('');
    } catch {
      return;
    }
  }

  async removeBenchmarkSet(setId: string): Promise<void> {
    try {
      await this.commerceAdminStore.removeBenchmarkSet(setId);
    } catch {
      return;
    }
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
