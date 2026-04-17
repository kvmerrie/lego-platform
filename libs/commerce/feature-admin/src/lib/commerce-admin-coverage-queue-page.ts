import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  filterCommerceCoverageQueueRows,
  type CommerceCoverageQueueHealthFilter,
  type CommerceCoverageQueueMerchantStatus,
  type CommerceCoverageQueuePriorityFilter,
  type CommerceCoverageQueueRow,
  type CommerceCoverageQueueSourceFilter,
  type CommerceOfferSeed,
} from '@lego-platform/commerce/util';
import {
  CommerceAdminOfferSeedDialogComponent,
  type CommerceOfferSeedDialogPrefill,
} from './commerce-admin-offer-seed-dialog';
import { CommerceAdminStore } from './commerce-admin-store.service';

type CoverageQueueFeedbackTone = 'danger' | 'neutral' | 'positive';

@Component({
  selector: 'lego-commerce-admin-coverage-queue-page',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CommerceAdminOfferSeedDialogComponent,
  ],
  templateUrl: './commerce-admin-coverage-queue-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommerceAdminCoverageQueuePageComponent {
  readonly commerceAdminStore = inject(CommerceAdminStore);
  readonly healthFilter =
    signal<CommerceCoverageQueueHealthFilter>('under_covered');
  readonly isDialogOpen = signal(false);
  readonly merchantGapFilter = signal('all');
  readonly offerSeedPrefill = signal<CommerceOfferSeedDialogPrefill | null>(
    null,
  );
  readonly rowFeedback = signal<
    Record<
      string,
      {
        message: string;
        tone: CoverageQueueFeedbackTone;
      }
    >
  >({});
  readonly runningDiscoverySetId = signal<string | null>(null);
  readonly priorityFilter = signal<CommerceCoverageQueuePriorityFilter>('all');
  readonly search = signal('');
  readonly selectedOfferSeed = signal<CommerceOfferSeed | null>(null);
  readonly sourceFilter = signal<CommerceCoverageQueueSourceFilter>('all');
  readonly merchantGapOptions = computed(() =>
    this.commerceAdminStore
      .merchants()
      .filter((merchant) => merchant.isActive)
      .sort((left, right) => left.name.localeCompare(right.name)),
  );
  readonly filteredRows = computed(() =>
    filterCommerceCoverageQueueRows({
      rows: this.commerceAdminStore.coverageQueueRows(),
      healthFilter: this.healthFilter(),
      merchantGapMerchantId: this.merchantGapFilter(),
      priorityFilter: this.priorityFilter(),
      search: this.search(),
      sourceFilter: this.sourceFilter(),
    }),
  );

  updateHealthFilter(value: CommerceCoverageQueueHealthFilter): void {
    this.healthFilter.set(value);
  }

  updateMerchantGapFilter(value: string): void {
    this.merchantGapFilter.set(value);
  }

  updatePriorityFilter(value: CommerceCoverageQueuePriorityFilter): void {
    this.priorityFilter.set(value);
  }

  updateSearch(value: string): void {
    this.search.set(value);
  }

  updateSourceFilter(value: CommerceCoverageQueueSourceFilter): void {
    this.sourceFilter.set(value);
  }

  getCoverageQueueSourceLabel(
    source: CommerceCoverageQueueRow['source'],
  ): string {
    return source === 'overlay' ? 'Overlay' : 'Snapshot';
  }

  getDiscoveryQueryParams(
    row: CommerceCoverageQueueRow,
  ): Record<string, string> {
    return {
      set: row.setId,
      ...(row.recommendedMerchantId
        ? {
            merchant: row.recommendedMerchantId,
          }
        : {}),
    };
  }

  getDiscoveryTargetMerchant(
    row: CommerceCoverageQueueRow,
  ): CommerceCoverageQueueMerchantStatus | undefined {
    const recommendedMerchant = row.recommendedMerchantId
      ? row.merchantStatuses.find(
          (merchantStatus) =>
            merchantStatus.merchantId === row.recommendedMerchantId,
        )
      : undefined;

    if (
      recommendedMerchant &&
      recommendedMerchant.state === 'missing' &&
      this.commerceAdminStore.supportsMerchantDiscovery(
        recommendedMerchant.merchantId,
      )
    ) {
      return recommendedMerchant;
    }

    return row.merchantStatuses.find(
      (merchantStatus) =>
        merchantStatus.state === 'missing' &&
        this.commerceAdminStore.supportsMerchantDiscovery(
          merchantStatus.merchantId,
        ),
    );
  }

  getSeedActionMerchant(
    row: CommerceCoverageQueueRow,
  ): CommerceCoverageQueueMerchantStatus | undefined {
    const recommendedMerchant = row.recommendedMerchantId
      ? row.merchantStatuses.find(
          (merchantStatus) =>
            merchantStatus.merchantId === row.recommendedMerchantId,
        )
      : undefined;

    if (recommendedMerchant) {
      return recommendedMerchant;
    }

    return (
      row.merchantStatuses.find((merchantStatus) => merchantStatus.offerSeed) ??
      row.merchantStatuses.find(
        (merchantStatus) => merchantStatus.state !== 'valid',
      ) ??
      row.merchantStatuses[0]
    );
  }

  getSeedActionLabel(row: CommerceCoverageQueueRow): string {
    return this.getSeedActionMerchant(row)?.offerSeed
      ? 'Seed bewerken'
      : 'Seed toevoegen';
  }

  getMerchantStatusTitle(
    merchantStatus: CommerceCoverageQueueMerchantStatus,
  ): string | null {
    if (merchantStatus.offerSeed?.productUrl) {
      return merchantStatus.offerSeed.productUrl;
    }

    if (merchantStatus.state === 'missing') {
      return 'Nog geen seed';
    }

    return 'Open de seedflow voor deze merchant';
  }

  openOfferSeedDialogForMerchant(
    merchantStatus: CommerceCoverageQueueMerchantStatus,
    row: CommerceCoverageQueueRow,
  ): void {
    if (merchantStatus.offerSeed) {
      this.selectedOfferSeed.set(merchantStatus.offerSeed);
      this.offerSeedPrefill.set(null);
    } else {
      this.selectedOfferSeed.set(null);
      this.offerSeedPrefill.set({
        setId: row.setId,
        merchantId: merchantStatus.merchantId,
      });
    }

    this.isDialogOpen.set(true);
  }

  openOfferSeedDialogForRow(row: CommerceCoverageQueueRow): void {
    const merchantStatus = this.getSeedActionMerchant(row);

    if (!merchantStatus) {
      this.setRowFeedback(row.setId, {
        message: 'Voor deze set is nog geen logische merchantactie gevonden.',
        tone: 'neutral',
      });
      return;
    }

    this.openOfferSeedDialogForMerchant(merchantStatus, row);
  }

  closeDialog(): void {
    this.selectedOfferSeed.set(null);
    this.offerSeedPrefill.set(null);
    this.isDialogOpen.set(false);
  }

  async runDiscovery(row: CommerceCoverageQueueRow): Promise<void> {
    const merchantStatus = this.getDiscoveryTargetMerchant(row);

    if (!merchantStatus) {
      this.setRowFeedback(row.setId, {
        message: 'Geen discovery-merchant beschikbaar voor deze setrij.',
        tone: 'neutral',
      });
      return;
    }

    this.runningDiscoverySetId.set(row.setId);
    this.setRowFeedback(row.setId, {
      message: `Discovery gestart voor ${merchantStatus.merchantName}.`,
      tone: 'neutral',
    });

    try {
      const result = await this.commerceAdminStore.runDiscovery({
        setId: row.setId,
        merchantId: merchantStatus.merchantId,
      });

      if (result.run.status === 'success') {
        this.setRowFeedback(row.setId, {
          message: `${result.run.candidateCount} kandidaat${
            result.run.candidateCount === 1 ? '' : 'en'
          } gevonden via ${merchantStatus.merchantName}.`,
          tone: 'positive',
        });
      } else {
        this.setRowFeedback(row.setId, {
          message:
            result.run.errorMessage ??
            `${merchantStatus.merchantName} gaf geen bruikbare discovery-run terug.`,
          tone: 'danger',
        });
      }
    } catch (error) {
      this.setRowFeedback(row.setId, {
        message:
          error instanceof Error
            ? error.message
            : 'Discovery kon niet worden gestart.',
        tone: 'danger',
      });
    } finally {
      this.runningDiscoverySetId.set(null);
    }
  }

  private setRowFeedback(
    setId: string,
    feedback: { message: string; tone: CoverageQueueFeedbackTone },
  ): void {
    this.rowFeedback.update((currentFeedback) => ({
      ...currentFeedback,
      [setId]: feedback,
    }));
  }
}
