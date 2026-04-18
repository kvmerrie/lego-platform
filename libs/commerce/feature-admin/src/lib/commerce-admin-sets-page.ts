import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  type CommerceCoverageQueueHealthFilter,
  type CommerceCoverageQueueMerchantStatus,
  type CommerceCoverageQueuePriorityFilter,
  type CommerceCoverageQueueRow,
  type CommerceCoverageQueueSourceFilter,
  type CommerceOfferSeed,
  filterCommerceCoverageQueueRows,
} from '@lego-platform/commerce/util';
import {
  CommerceAdminOfferSeedDialogComponent,
  type CommerceOfferSeedDialogPrefill,
} from './commerce-admin-offer-seed-dialog';
import { CommerceAdminSetWorkContextComponent } from './commerce-admin-set-work-context';
import { CommerceAdminStore } from './commerce-admin-store.service';

type SetManagementSort =
  | 'benchmark_first'
  | 'lowest_coverage'
  | 'recent_activity'
  | 'newly_added'
  | 'alphabetical';

type SetsRowFeedbackTone = 'danger' | 'neutral' | 'positive';

interface SetsRowFeedback {
  message: string;
  tone: SetsRowFeedbackTone;
}

@Component({
  selector: 'lego-commerce-admin-sets-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CommerceAdminOfferSeedDialogComponent,
    CommerceAdminSetWorkContextComponent,
  ],
  templateUrl: './commerce-admin-sets-page.html',
  styles: [
    `
      :host {
        display: block;
      }

      .admin-sets-page {
        display: grid;
        gap: 1rem;
      }

      .admin-sets-page__bar {
        align-items: start;
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        justify-content: space-between;
      }

      .admin-sets-page__toolbar {
        display: grid;
        gap: 0.75rem;
      }

      .admin-sets-page__filters {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
      }

      .admin-sets-page__shell {
        display: grid;
        gap: 1rem;
      }

      .admin-sets-page__list {
        display: grid;
        gap: 0.85rem;
      }

      .admin-sets-page__row {
        display: grid;
        gap: 0.85rem;
        transition:
          border-color 120ms ease,
          background 120ms ease;
      }

      .admin-sets-page__row.is-selected {
        background: color-mix(
          in srgb,
          var(--lego-accent) 6%,
          var(--lego-surface)
        );
        border-color: color-mix(
          in srgb,
          var(--lego-accent) 35%,
          var(--lego-border) 65%
        );
      }

      .admin-sets-page__row-summary {
        appearance: none;
        background: transparent;
        border: 0;
        color: inherit;
        cursor: pointer;
        display: grid;
        gap: 0.8rem;
        padding: 0;
        text-align: left;
        width: 100%;
      }

      .admin-sets-page__row-heading {
        align-items: start;
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        justify-content: space-between;
      }

      .admin-sets-page__row-title {
        display: grid;
        gap: 0.35rem;
      }

      .admin-sets-page__row-title h3 {
        margin: 0;
      }

      .admin-sets-page__row-grid {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
      }

      .admin-sets-page__row-cell {
        display: grid;
        gap: 0.2rem;
      }

      .admin-sets-page__row-cell strong {
        color: var(--lego-text);
        font-size: 1rem;
      }

      .admin-sets-page__row-merchant-strip,
      .admin-sets-page__row-actions {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .admin-sets-page__empty {
        min-height: 12rem;
        place-items: center;
        text-align: center;
      }

      .admin-sets-page__context {
        align-self: start;
      }

      @media (min-width: 1180px) {
        .admin-sets-page__shell {
          align-items: start;
          grid-template-columns: minmax(0, 1.55fr) minmax(21rem, 0.95fr);
        }

        .admin-sets-page__context {
          position: sticky;
          top: 1rem;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommerceAdminSetsPageComponent {
  readonly commerceAdminStore = inject(CommerceAdminStore);
  private readonly router = inject(Router);
  readonly search = signal('');
  readonly sourceFilter = signal<CommerceCoverageQueueSourceFilter>('all');
  readonly healthFilter = signal<CommerceCoverageQueueHealthFilter>('all');
  readonly priorityFilter = signal<CommerceCoverageQueuePriorityFilter>('all');
  readonly themeFilter = signal('all');
  readonly sort = signal<SetManagementSort>('benchmark_first');
  readonly selectedSetId = signal<string | null>(null);
  readonly runningDiscoverySetId = signal<string | null>(null);
  readonly refreshingSetId = signal<string | null>(null);
  readonly rowFeedback = signal<Record<string, SetsRowFeedback>>({});
  readonly isDialogOpen = signal(false);
  readonly selectedOfferSeed = signal<CommerceOfferSeed | null>(null);
  readonly offerSeedPrefill = signal<CommerceOfferSeedDialogPrefill | null>(
    null,
  );

  readonly themeOptions = computed(() =>
    [
      ...new Set(
        this.commerceAdminStore.coverageQueueRows().map((row) => row.theme),
      ),
    ].sort((left, right) => left.localeCompare(right)),
  );

  readonly filteredRows = computed(() => {
    const themeFilter = this.themeFilter();
    const sort = this.sort();

    const rows = filterCommerceCoverageQueueRows({
      rows: this.commerceAdminStore.coverageQueueRows(),
      healthFilter: this.healthFilter(),
      merchantGapMerchantId: 'all',
      minimumValidMerchantCount: 3,
      priorityFilter: this.priorityFilter(),
      search: this.search(),
      sourceFilter: this.sourceFilter(),
    }).filter((row) => themeFilter === 'all' || row.theme === themeFilter);

    return [...rows].sort((left, right) => {
      switch (sort) {
        case 'lowest_coverage':
          return (
            left.validMerchantCount - right.validMerchantCount ||
            right.needsReviewCount - left.needsReviewCount ||
            right.staleMerchantCount - left.staleMerchantCount ||
            left.setName.localeCompare(right.setName)
          );
        case 'recent_activity':
          return (
            (right.latestCheckedAt ?? '').localeCompare(
              left.latestCheckedAt ?? '',
            ) || left.setName.localeCompare(right.setName)
          );
        case 'newly_added':
          return (
            (right.sourceCreatedAt ?? '').localeCompare(
              left.sourceCreatedAt ?? '',
            ) || left.setName.localeCompare(right.setName)
          );
        case 'alphabetical':
          return (
            left.theme.localeCompare(right.theme) ||
            left.setName.localeCompare(right.setName)
          );
        case 'benchmark_first':
        default:
          return (
            Number(right.isBenchmark) - Number(left.isBenchmark) ||
            left.validMerchantCount - right.validMerchantCount ||
            right.needsReviewCount - left.needsReviewCount ||
            left.setName.localeCompare(right.setName)
          );
      }
    });
  });

  readonly selectedRow = computed(() => {
    const selectedSetId = this.selectedSetId();

    return (
      this.filteredRows().find((row) => row.setId === selectedSetId) ??
      this.filteredRows()[0] ??
      null
    );
  });

  constructor() {
    effect(
      () => {
        const rows = this.filteredRows();
        const selectedSetId = this.selectedSetId();

        if (rows.length === 0) {
          if (selectedSetId !== null) {
            this.selectedSetId.set(null);
          }

          return;
        }

        const hasSelectedRow = rows.some((row) => row.setId === selectedSetId);

        if (!selectedSetId || !hasSelectedRow) {
          const firstRow = rows[0];

          if (firstRow) {
            this.selectedSetId.set(firstRow.setId);
          }
        }
      },
      { allowSignalWrites: true },
    );
  }

  updateSearch(value: string): void {
    this.search.set(value);
  }

  updateSourceFilter(value: CommerceCoverageQueueSourceFilter): void {
    this.sourceFilter.set(value);
  }

  updateHealthFilter(value: CommerceCoverageQueueHealthFilter): void {
    this.healthFilter.set(value);
  }

  updatePriorityFilter(value: CommerceCoverageQueuePriorityFilter): void {
    this.priorityFilter.set(value);
  }

  updateThemeFilter(value: string): void {
    this.themeFilter.set(value);
  }

  updateSort(value: SetManagementSort): void {
    this.sort.set(value);
  }

  selectRow(row: CommerceCoverageQueueRow): void {
    this.selectedSetId.set(row.setId);
  }

  isSelectedRow(row: CommerceCoverageQueueRow): boolean {
    return this.selectedRow()?.setId === row.setId;
  }

  getCoverageQueueSourceLabel(
    source: CommerceCoverageQueueRow['source'],
  ): string {
    return source === 'overlay' ? 'Overlay' : 'Snapshot';
  }

  getMerchantStatusTitle(
    merchantStatus: CommerceCoverageQueueMerchantStatus,
    row?: CommerceCoverageQueueRow,
  ): string {
    const parts = [
      merchantStatus.merchantName,
      this.commerceAdminStore.getCoverageQueueMerchantStateLabel(
        merchantStatus.state,
      ),
    ];

    if (merchantStatus.lastCheckedAt) {
      parts.push(
        this.commerceAdminStore.formatRelativeTimestamp(
          merchantStatus.lastCheckedAt,
        ),
      );
    }

    if (row) {
      parts.push(
        this.commerceAdminStore.getCoverageQueueMerchantActionLabel(
          row,
          merchantStatus,
        ),
      );
    }

    return parts.join(' · ');
  }

  getDiscoveryTargetMerchant(
    row: CommerceCoverageQueueRow,
  ): CommerceCoverageQueueMerchantStatus | undefined {
    return this.commerceAdminStore.getCoverageQueueDiscoveryTargetMerchant(row);
  }

  getSeedActionMerchant(
    row: CommerceCoverageQueueRow,
  ): CommerceCoverageQueueMerchantStatus | undefined {
    return this.commerceAdminStore.getCoverageQueueSeedActionMerchant(row);
  }

  getSeedActionLabel(row: CommerceCoverageQueueRow): string {
    return this.getSeedActionMerchant(row)?.offerSeed
      ? 'Seed bewerken'
      : 'Seed toevoegen';
  }

  getDiscoveryQueryParams(
    row: CommerceCoverageQueueRow,
  ): Record<string, string> {
    return this.commerceAdminStore.getCoverageQueueDiscoveryLinkParams(row);
  }

  handleMerchantStatusAction(input: {
    merchantStatus: CommerceCoverageQueueMerchantStatus;
    row: CommerceCoverageQueueRow;
  }): void {
    const { merchantStatus, row } = input;
    const action = this.commerceAdminStore.getCoverageQueueMerchantAction(
      row,
      merchantStatus,
    );

    this.selectRow(row);

    if (action.type === 'open_discovery') {
      void this.router.navigate(['/discovery'], {
        queryParams:
          this.commerceAdminStore.getCoverageQueueDiscoveryLinkParamsForMerchant(
            row,
            merchantStatus.merchantId,
          ),
      });
      return;
    }

    this.openOfferSeedDialogForMerchant(merchantStatus, row);
  }

  openOfferSeedDialogForMerchant(
    merchantStatus: CommerceCoverageQueueMerchantStatus,
    row: CommerceCoverageQueueRow,
  ): void {
    this.selectRow(row);

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
      return;
    }

    this.selectRow(row);
    this.runningDiscoverySetId.set(row.setId);

    try {
      const result = await this.commerceAdminStore.runDiscovery({
        setId: row.setId,
        merchantId: merchantStatus.merchantId,
      });
      const candidateCount = result.candidates.length;

      this.rowFeedback.update((feedback) => ({
        ...feedback,
        [row.setId]: {
          tone: candidateCount > 0 ? 'positive' : 'neutral',
          message:
            candidateCount > 0
              ? `${candidateCount} kandidaat${
                  candidateCount === 1 ? '' : 'en'
                } gevonden bij ${merchantStatus.merchantName}`
              : `${merchantStatus.merchantName} gecheckt, geen kandidaten gevonden`,
        },
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Discovery kon niet starten.';

      this.rowFeedback.update((feedback) => ({
        ...feedback,
        [row.setId]: {
          tone: 'danger',
          message,
        },
      }));
    } finally {
      this.runningDiscoverySetId.set(null);
    }
  }

  async refreshSet(row: CommerceCoverageQueueRow): Promise<void> {
    if (row.activeSeedCount === 0) {
      return;
    }

    this.selectRow(row);
    this.refreshingSetId.set(row.setId);

    try {
      const result = await this.commerceAdminStore.refreshSet(row.setId);

      this.rowFeedback.update((feedback) => ({
        ...feedback,
        [row.setId]: {
          tone: 'positive',
          message: this.commerceAdminStore.formatSetRefreshResult(result),
        },
      }));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'De prijscheck kon niet opnieuw starten.';

      this.rowFeedback.update((feedback) => ({
        ...feedback,
        [row.setId]: {
          tone: 'danger',
          message,
        },
      }));
    } finally {
      this.refreshingSetId.set(null);
    }
  }
}
