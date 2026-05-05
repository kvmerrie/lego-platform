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
  CommerceAdminApiService,
  type CommerceAdminProductionSyncResult,
} from './commerce-admin-api.service';
import {
  CommerceAdminOfferSeedDialogComponent,
  type CommerceOfferSeedDialogPrefill,
} from './commerce-admin-offer-seed-dialog';
import { CommerceAdminStore } from './commerce-admin-store.service';

type OperationsCoverageFilter = 'all' | 'benchmark' | 'missing' | 'review';

function toAdminActionErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error && 'error' in error) {
    const errorRecord = error as {
      error?: {
        message?: string;
      };
    };

    return errorRecord.error?.message ?? 'De actie kon niet worden afgerond.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'De actie kon niet worden afgerond.';
}

@Component({
  selector: 'lego-commerce-admin-operations-page',
  imports: [CommonModule, FormsModule, CommerceAdminOfferSeedDialogComponent],
  templateUrl: './commerce-admin-operations-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommerceAdminOperationsPageComponent {
  private readonly commerceAdminApi = inject(CommerceAdminApiService);
  readonly commerceAdminStore = inject(CommerceAdminStore);
  readonly search = signal('');
  readonly filter = signal<OperationsCoverageFilter>('all');
  readonly productionSyncSecret = signal('');
  readonly isProductionSyncRunning = signal(false);
  readonly productionSyncMessage = signal<string | null>(null);
  readonly productionSyncResult =
    signal<CommerceAdminProductionSyncResult | null>(null);
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

  updateProductionSyncSecret(value: string): void {
    this.productionSyncSecret.set(value);
  }

  getProductionSyncTableNames(): string[] {
    return Object.keys(this.productionSyncResult()?.tables ?? {});
  }

  async syncCommerceFromProduction(dryRun: boolean): Promise<void> {
    const adminSecret = this.productionSyncSecret().trim();

    if (!adminSecret) {
      this.productionSyncMessage.set('Vul eerst de admin secret in.');

      return;
    }

    if (
      !dryRun &&
      !globalThis.confirm(
        'Dit wist en vervangt commerce-data in deze omgeving met productiegegevens. Artikelen en gebruikersdata blijven ongemoeid. Doorgaan?',
      )
    ) {
      return;
    }

    this.isProductionSyncRunning.set(true);
    this.productionSyncMessage.set(null);

    try {
      const result = await this.commerceAdminApi.syncCommerceFromProduction({
        adminSecret,
        dryRun,
      });

      this.productionSyncResult.set(result);
      this.productionSyncMessage.set(
        dryRun
          ? 'Dry-run afgerond. Controleer de aantallen voordat je synchroniseert.'
          : 'Commerce-data uit productie is gesynchroniseerd.',
      );

      if (!dryRun) {
        await this.commerceAdminStore.reload();
      }
    } catch (error) {
      this.productionSyncMessage.set(toAdminActionErrorMessage(error));
    } finally {
      this.isProductionSyncRunning.set(false);
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
