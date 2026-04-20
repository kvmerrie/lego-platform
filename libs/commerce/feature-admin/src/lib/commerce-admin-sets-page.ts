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
} from '@lego-platform/commerce/util';
import {
  CommerceAdminOfferSeedDialogComponent,
  type CommerceOfferSeedDialogPrefill,
} from './commerce-admin-offer-seed-dialog';
import { CommerceAdminSetWorkContextComponent } from './commerce-admin-set-work-context';
import {
  type CommerceCatalogSetOption,
  CommerceAdminStore,
} from './commerce-admin-store.service';

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

interface CommerceAdminSetListRow {
  activeSeedCount: number;
  coverageRow?: CommerceCoverageQueueRow;
  isBenchmark: boolean;
  latestCheckedAt?: string;
  needsReviewCount: number;
  setId: string;
  setName: string;
  source?: CommerceCoverageQueueRow['source'];
  sourceCreatedAt?: string;
  staleMerchantCount: number;
  statusSummary: string;
  theme: string;
  unavailableMerchantCount: number;
  validMerchantCount: number;
}

const setsHealthFilters: readonly CommerceCoverageQueueHealthFilter[] = [
  'all',
  'fully_covered',
  'needs_review',
  'stale',
  'under_covered',
  'zero_valid',
];
const setsSourceFilters: readonly CommerceCoverageQueueSourceFilter[] = [
  'all',
  'overlay',
  'snapshot',
];
const setsPriorityFilters: readonly CommerceCoverageQueuePriorityFilter[] = [
  'all',
  'benchmark_only',
];

@Component({
  selector: 'lego-commerce-admin-sets-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
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
        gap: 0.75rem;
      }

      .admin-sets-page__bar {
        align-items: start;
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        justify-content: space-between;
      }

      .admin-sets-page__toolbar {
        display: grid;
        gap: 0.5rem;
      }

      .admin-sets-page__merchant-cell {
        min-width: 16rem;
      }

      .admin-sets-page__actions-cell {
        min-width: 18rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommerceAdminSetsPageComponent {
  readonly commerceAdminStore = inject(CommerceAdminStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly search = signal(this.commerceAdminStore.setsViewState().search);
  readonly sourceFilter = signal<CommerceCoverageQueueSourceFilter>(
    this.commerceAdminStore.setsViewState().sourceFilter,
  );
  readonly healthFilter = signal<CommerceCoverageQueueHealthFilter>(
    this.commerceAdminStore.setsViewState().healthFilter,
  );
  readonly priorityFilter = signal<CommerceCoverageQueuePriorityFilter>(
    this.commerceAdminStore.setsViewState().priorityFilter,
  );
  readonly themeFilter = signal('all');
  readonly sort = signal<SetManagementSort>('benchmark_first');
  readonly refreshingSetId = signal<string | null>(null);
  readonly rowFeedback = signal<Record<string, SetsRowFeedback>>({});
  readonly isDialogOpen = signal(false);
  readonly selectedOfferSeed = signal<CommerceOfferSeed | null>(null);
  readonly offerSeedPrefill = signal<CommerceOfferSeedDialogPrefill | null>(
    null,
  );
  readonly coverageRowsBySetId = computed(
    () =>
      new Map(
        this.commerceAdminStore
          .coverageQueueRows()
          .map((row) => [row.setId, row] as const),
      ),
  );

  readonly themeOptions = computed(() =>
    [
      ...new Set(
        this.commerceAdminStore.catalogSetOptions().map((row) => row.theme),
      ),
    ].sort((left, right) => left.localeCompare(right)),
  );

  readonly catalogRows = computed<CommerceAdminSetListRow[]>(() =>
    this.commerceAdminStore.catalogSetOptions().map((catalogSet) =>
      this.toCatalogRow({
        catalogSet,
        coverageRow: this.coverageRowsBySetId().get(catalogSet.id),
      }),
    ),
  );

  readonly filteredRows = computed<CommerceAdminSetListRow[]>(() => {
    const themeFilter = this.themeFilter();
    const sort = this.sort();
    const normalizedSearch = this.search().trim().toLowerCase();

    const rows = this.catalogRows().filter((row) => {
      if (themeFilter !== 'all' && row.theme !== themeFilter) {
        return false;
      }

      if (this.priorityFilter() === 'benchmark_only' && !row.isBenchmark) {
        return false;
      }

      if (this.sourceFilter() !== 'all' && row.source !== this.sourceFilter()) {
        return false;
      }

      if (this.healthFilter() === 'zero_valid' && row.validMerchantCount > 0) {
        return false;
      }

      if (
        this.healthFilter() === 'under_covered' &&
        row.validMerchantCount >= 3
      ) {
        return false;
      }

      if (this.healthFilter() === 'stale' && row.staleMerchantCount === 0) {
        return false;
      }

      if (
        this.healthFilter() === 'needs_review' &&
        row.needsReviewCount === 0
      ) {
        return false;
      }

      if (
        this.healthFilter() === 'fully_covered' &&
        !(
          row.validMerchantCount >= 3 &&
          row.needsReviewCount === 0 &&
          row.staleMerchantCount === 0 &&
          row.unavailableMerchantCount === 0
        )
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return (
        row.setId.toLowerCase().includes(normalizedSearch) ||
        row.setName.toLowerCase().includes(normalizedSearch) ||
        row.theme.toLowerCase().includes(normalizedSearch)
      );
    });

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
    const selectedSetId = this.commerceAdminStore.activeSetId();

    return (
      this.filteredRows().find((row) => row.setId === selectedSetId) ??
      this.filteredRows()[0] ??
      null
    );
  });
  readonly selectedCoverageRow = computed(
    () => this.selectedRow()?.coverageRow ?? null,
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
      this.commerceAdminStore.updateSetsViewState({
        search: this.search(),
        sourceFilter: this.sourceFilter(),
        healthFilter: this.healthFilter(),
        priorityFilter: this.priorityFilter(),
      });
      this.syncRouteContext();
    });
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

  selectRow(row: CommerceAdminSetListRow): void {
    this.commerceAdminStore.setActiveSetId(row.setId);
  }

  isSelectedRow(row: CommerceAdminSetListRow): boolean {
    return this.selectedRow()?.setId === row.setId;
  }

  getCoverageQueueSourceLabel(
    source?: CommerceCoverageQueueRow['source'],
  ): string {
    if (source === 'overlay') {
      return 'Overlay';
    }

    if (source === 'snapshot') {
      return 'Snapshot';
    }

    return 'Catalogus';
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

  handleMerchantStatusAction(input: {
    merchantStatus: CommerceCoverageQueueMerchantStatus;
    row: CommerceCoverageQueueRow;
  }): void {
    const { merchantStatus, row } = input;
    this.selectRow(row);
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

  getWorkbenchQueryParams(
    row?: Pick<CommerceAdminSetListRow, 'setId'> | null,
  ): Record<string, string> {
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

    if (typeof setId === 'string' && setId.trim()) {
      this.commerceAdminStore.setActiveSetId(setId);
    }

    if (typeof search === 'string') {
      this.search.set(search);
    }

    if (
      typeof healthFilter === 'string' &&
      setsHealthFilters.includes(
        healthFilter as CommerceCoverageQueueHealthFilter,
      )
    ) {
      this.healthFilter.set(healthFilter as CommerceCoverageQueueHealthFilter);
    }

    if (
      typeof sourceFilter === 'string' &&
      setsSourceFilters.includes(
        sourceFilter as CommerceCoverageQueueSourceFilter,
      )
    ) {
      this.sourceFilter.set(sourceFilter as CommerceCoverageQueueSourceFilter);
    }

    if (
      typeof priorityFilter === 'string' &&
      setsPriorityFilters.includes(
        priorityFilter as CommerceCoverageQueuePriorityFilter,
      )
    ) {
      this.priorityFilter.set(
        priorityFilter as CommerceCoverageQueuePriorityFilter,
      );
    }
  }

  private syncRouteContext(): void {
    const queryParams = {
      set: this.commerceAdminStore.activeSetId() ?? null,
      q: this.search().trim() || null,
      health: this.healthFilter() === 'all' ? null : this.healthFilter(),
      source: this.sourceFilter() === 'all' ? null : this.sourceFilter(),
      priority: this.priorityFilter() === 'all' ? null : this.priorityFilter(),
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

  private toCatalogRow(input: {
    catalogSet: CommerceCatalogSetOption;
    coverageRow?: CommerceCoverageQueueRow;
  }): CommerceAdminSetListRow {
    const { catalogSet, coverageRow } = input;

    return {
      activeSeedCount: coverageRow?.activeSeedCount ?? 0,
      coverageRow,
      isBenchmark: coverageRow?.isBenchmark ?? false,
      latestCheckedAt: coverageRow?.latestCheckedAt,
      needsReviewCount: coverageRow?.needsReviewCount ?? 0,
      setId: catalogSet.id,
      setName: catalogSet.name,
      source: coverageRow?.source,
      sourceCreatedAt: coverageRow?.sourceCreatedAt,
      staleMerchantCount: coverageRow?.staleMerchantCount ?? 0,
      statusSummary: coverageRow?.statusSummary ?? 'Nog geen commerce-context',
      theme: catalogSet.theme,
      unavailableMerchantCount: coverageRow?.unavailableMerchantCount ?? 0,
      validMerchantCount: coverageRow?.validMerchantCount ?? 0,
    };
  }
}
