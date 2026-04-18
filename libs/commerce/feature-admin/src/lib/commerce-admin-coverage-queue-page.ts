import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
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

type CoverageQueueRowFeedbackTone = 'danger' | 'neutral' | 'positive';

interface CoverageQueueRowFeedback {
  message: string;
  tone: CoverageQueueRowFeedbackTone;
}

const workbenchHealthFilters: readonly CommerceCoverageQueueHealthFilter[] = [
  'all',
  'fully_covered',
  'needs_review',
  'stale',
  'under_covered',
  'zero_valid',
];
const workbenchSourceFilters: readonly CommerceCoverageQueueSourceFilter[] = [
  'all',
  'overlay',
  'snapshot',
];
const workbenchPriorityFilters: readonly CommerceCoverageQueuePriorityFilter[] =
  ['all', 'benchmark_only'];

@Component({
  selector: 'lego-commerce-admin-coverage-queue-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CommerceAdminOfferSeedDialogComponent,
    CommerceAdminSetWorkContextComponent,
  ],
  templateUrl: './commerce-admin-coverage-queue-page.html',
  styles: [
    `
      :host {
        display: block;
      }

      .admin-workbench {
        display: grid;
        gap: 1rem;
      }

      .admin-workbench__bar {
        align-items: start;
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        justify-content: space-between;
      }

      .admin-workbench__summary {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
      }

      .admin-workbench__summary-card {
        background: color-mix(
          in srgb,
          var(--lego-surface-muted) 72%,
          transparent
        );
        border: 1px solid var(--lego-border-subtle);
        border-radius: var(--lego-radius-md);
        display: grid;
        gap: 0.3rem;
        padding: 0.9rem 1rem;
      }

      .admin-workbench__summary-value {
        color: var(--lego-text);
        font-size: 1.4rem;
        font-weight: 700;
        line-height: 1;
      }

      .admin-workbench__toolbar {
        align-items: center;
        display: grid;
        gap: 0.75rem;
      }

      .admin-workbench__filters {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
      }

      .admin-workbench__shell {
        display: grid;
        gap: 1rem;
      }

      .admin-workbench__queue {
        display: grid;
        gap: 0.85rem;
      }

      .admin-workbench__queue-list {
        display: grid;
        gap: 0.85rem;
      }

      .admin-workbench__row {
        display: grid;
        gap: 0.85rem;
        transition:
          border-color 120ms ease,
          background 120ms ease;
      }

      .admin-workbench__row.is-selected {
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

      .admin-workbench__row-summary {
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

      .admin-workbench__row-heading {
        align-items: start;
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        justify-content: space-between;
      }

      .admin-workbench__row-title {
        display: grid;
        gap: 0.35rem;
      }

      .admin-workbench__row-title h3 {
        margin: 0;
      }

      .admin-workbench__row-meta,
      .admin-workbench__row-merchant-strip,
      .admin-workbench__row-actions {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .admin-workbench__row-stats {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
      }

      .admin-workbench__row-stat {
        display: grid;
        gap: 0.2rem;
      }

      .admin-workbench__row-stat strong {
        color: var(--lego-text);
        font-size: 1rem;
      }

      .admin-workbench__queue-empty {
        min-height: 12rem;
        place-items: center;
        text-align: center;
      }

      .admin-workbench__context {
        align-self: start;
      }

      @media (min-width: 1120px) {
        .admin-workbench__shell {
          align-items: start;
          grid-template-columns: minmax(0, 1.45fr) minmax(20rem, 0.95fr);
        }

        .admin-workbench__context {
          position: sticky;
          top: 1rem;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommerceAdminCoverageQueuePageComponent {
  readonly commerceAdminStore = inject(CommerceAdminStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly search = signal(this.commerceAdminStore.workbenchViewState().search);
  readonly healthFilter = signal<CommerceCoverageQueueHealthFilter>(
    this.commerceAdminStore.workbenchViewState().healthFilter,
  );
  readonly sourceFilter = signal<CommerceCoverageQueueSourceFilter>(
    this.commerceAdminStore.workbenchViewState().sourceFilter,
  );
  readonly priorityFilter = signal<CommerceCoverageQueuePriorityFilter>(
    this.commerceAdminStore.workbenchViewState().priorityFilter,
  );
  readonly merchantGapFilter = signal(
    this.commerceAdminStore.workbenchViewState().merchantGapFilter,
  );
  readonly runningDiscoverySetId = signal<string | null>(null);
  readonly refreshingSetId = signal<string | null>(null);
  readonly rowFeedback = signal<Record<string, CoverageQueueRowFeedback>>({});
  readonly isDialogOpen = signal(false);
  readonly selectedOfferSeed = signal<CommerceOfferSeed | null>(null);
  readonly offerSeedPrefill = signal<CommerceOfferSeedDialogPrefill | null>(
    null,
  );

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
      minimumValidMerchantCount: 3,
      priorityFilter: this.priorityFilter(),
      search: this.search(),
      sourceFilter: this.sourceFilter(),
    }),
  );

  readonly selectedRow = computed(() => {
    const selectedSetId = this.commerceAdminStore.activeSetId();

    return (
      this.filteredRows().find((row) => row.setId === selectedSetId) ??
      this.filteredRows()[0] ??
      null
    );
  });

  readonly noFirstOfferCount = computed(
    () =>
      this.commerceAdminStore
        .coverageQueueRows()
        .filter((row) => row.validMerchantCount === 0).length,
  );
  readonly underCoveredCount = computed(
    () =>
      this.commerceAdminStore
        .coverageQueueRows()
        .filter((row) => row.validMerchantCount < 3).length,
  );
  readonly overlayWorkCount = computed(
    () =>
      this.commerceAdminStore
        .coverageQueueRows()
        .filter(
          (row) =>
            row.source === 'overlay' &&
            row.recommendedNextAction !== 'no_action_needed',
        ).length,
  );
  readonly reviewOrStaleCount = computed(
    () =>
      this.commerceAdminStore
        .coverageQueueRows()
        .filter((row) => row.needsReviewCount > 0 || row.staleMerchantCount > 0)
        .length,
  );

  constructor() {
    this.applyRouteContext(this.route.snapshot.queryParams);
    this.route.queryParams
      .pipe(takeUntilDestroyed())
      .subscribe((params) => this.applyRouteContext(params));

    effect(
      () => {
        const rows = this.filteredRows();
        const selectedSetId = this.commerceAdminStore.activeSetId();

        if (rows.length === 0) {
          if (selectedSetId !== null) {
            this.commerceAdminStore.setActiveSetId(null);
          }

          return;
        }

        const hasSelectedRow = rows.some((row) => row.setId === selectedSetId);

        if (!selectedSetId || !hasSelectedRow) {
          const firstRow = rows[0];

          if (firstRow) {
            this.commerceAdminStore.setActiveSetId(firstRow.setId);
          }
        }
      },
      { allowSignalWrites: true },
    );

    effect(() => {
      this.commerceAdminStore.updateWorkbenchViewState({
        search: this.search(),
        healthFilter: this.healthFilter(),
        sourceFilter: this.sourceFilter(),
        priorityFilter: this.priorityFilter(),
        merchantGapFilter: this.merchantGapFilter(),
      });
      this.syncRouteContext();
    });
  }

  updateSearch(value: string): void {
    this.search.set(value);
  }

  updateHealthFilter(value: CommerceCoverageQueueHealthFilter): void {
    this.healthFilter.set(value);
  }

  updateSourceFilter(value: CommerceCoverageQueueSourceFilter): void {
    this.sourceFilter.set(value);
  }

  updatePriorityFilter(value: CommerceCoverageQueuePriorityFilter): void {
    this.priorityFilter.set(value);
  }

  updateMerchantGapFilter(value: string): void {
    this.merchantGapFilter.set(value);
  }

  selectRow(row: CommerceCoverageQueueRow): void {
    this.commerceAdminStore.setActiveSetId(row.setId);
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

  getSetsQueryParams(row?: CommerceCoverageQueueRow): Record<string, string> {
    return this.commerceAdminStore.buildSetFocusQueryParams(
      row?.setId ?? this.selectedRow()?.setId,
    );
  }

  private applyRouteContext(params: Params): void {
    const setId = params['set'];
    const search = params['q'];
    const healthFilter = params['health'];
    const sourceFilter = params['source'];
    const priorityFilter = params['priority'];
    const merchantGapFilter = params['merchant'];

    if (typeof setId === 'string' && setId.trim()) {
      this.commerceAdminStore.setActiveSetId(setId);
    }

    if (typeof search === 'string') {
      this.search.set(search);
    }

    if (
      typeof healthFilter === 'string' &&
      workbenchHealthFilters.includes(
        healthFilter as CommerceCoverageQueueHealthFilter,
      )
    ) {
      this.healthFilter.set(healthFilter as CommerceCoverageQueueHealthFilter);
    }

    if (
      typeof sourceFilter === 'string' &&
      workbenchSourceFilters.includes(
        sourceFilter as CommerceCoverageQueueSourceFilter,
      )
    ) {
      this.sourceFilter.set(sourceFilter as CommerceCoverageQueueSourceFilter);
    }

    if (
      typeof priorityFilter === 'string' &&
      workbenchPriorityFilters.includes(
        priorityFilter as CommerceCoverageQueuePriorityFilter,
      )
    ) {
      this.priorityFilter.set(
        priorityFilter as CommerceCoverageQueuePriorityFilter,
      );
    }

    if (typeof merchantGapFilter === 'string') {
      this.merchantGapFilter.set(merchantGapFilter);
    }
  }

  private syncRouteContext(): void {
    const queryParams = {
      set: this.commerceAdminStore.activeSetId() ?? null,
      q: this.search().trim() || null,
      health:
        this.healthFilter() === 'under_covered' ? null : this.healthFilter(),
      source: this.sourceFilter() === 'all' ? null : this.sourceFilter(),
      priority: this.priorityFilter() === 'all' ? null : this.priorityFilter(),
      merchant:
        this.merchantGapFilter() === 'all' ? null : this.merchantGapFilter(),
    };

    if (this.hasMatchingQueryParams(queryParams)) {
      return;
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      replaceUrl: true,
    });
  }

  private hasMatchingQueryParams(
    queryParams: Record<string, string | null>,
  ): boolean {
    const queryParamMap = this.route.snapshot.queryParamMap;

    return Object.entries(queryParams).every(([key, value]) => {
      const currentValue = queryParamMap.get(key);

      return (value ?? null) === currentValue;
    });
  }
}
