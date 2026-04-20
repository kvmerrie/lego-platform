import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AdminBatchSelectionBarComponent,
  AdminEmptyStateComponent,
  AdminPageComponent,
  AdminSectionHeaderComponent,
  AdminStatusBadgeComponent,
  type AdminStatusBadgeTone,
} from '@lego-platform/admin/ui';
import { type CatalogExternalSetSearchResult } from '@lego-platform/catalog/util';
import {
  CommerceAdminApiService,
  type CommerceAdminBulkOnboardingRun,
  type CommerceAdminBulkOnboardingRunReadResult,
  type CommerceAdminBulkOnboardingSnapshotSetSummary,
} from './commerce-admin-api.service';

type AdminFeedbackTone = 'danger' | 'neutral' | 'positive' | null;
type BulkOnboardingCartFilter = string;
type BulkOnboardingResultFilter =
  | 'all'
  | 'attention'
  | 'full'
  | 'in_progress'
  | 'no_commerce_context';
type BulkOnboardingResultTone = 'danger' | 'neutral' | 'positive' | 'warning';
type BulkOnboardingRunOutcome = 'attention' | 'completed' | 'running';
type BulkOnboardingStageTone = 'danger' | 'neutral' | 'positive' | 'warning';
type BulkOnboardingSearchSort =
  | 'name'
  | 'release_year_desc'
  | 'release_year_asc'
  | 'set_id';
type DirectSetIntakeStatus =
  | 'added'
  | 'already_in_catalog'
  | 'already_selected'
  | 'invalid'
  | 'not_found';

interface BulkOnboardingStageCard {
  label: string;
  status: string;
  summary: string;
  tone: BulkOnboardingStageTone;
}

interface BulkOnboardingSetRow {
  coverageLabel: string;
  generateLabel: string;
  hasCommerceContext: boolean;
  importLabel: string;
  isFullCoverage: boolean;
  lastUpdatedAt: string;
  missingMerchantLabel: string | null;
  outcome: BulkOnboardingRunOutcome;
  outcomeLabel: string;
  outcomeTone: BulkOnboardingResultTone;
  setId: string;
  setLabel: string;
  snapshot?: CommerceAdminBulkOnboardingSnapshotSetSummary;
  syncLabel: string;
  themeLabel: string | null;
  validateLabel: string;
}

interface DirectSetIntakeRow {
  input: string;
  normalizedSetId?: string;
  result?: CatalogExternalSetSearchResult;
  status: DirectSetIntakeStatus;
  statusLabel: string;
  statusTone: AdminStatusBadgeTone;
}

const BULK_ONBOARDING_SELECTION_STORAGE_KEY =
  'brickhunt.admin.bulk-onboarding.selection';
const BULK_ONBOARDING_RUN_ID_STORAGE_KEY =
  'brickhunt.admin.bulk-onboarding.active-run-id';
const BULK_ONBOARDING_SEARCH_STORAGE_KEY =
  'brickhunt.admin.bulk-onboarding.search-query';
const BULK_ONBOARDING_CART_SEARCH_STORAGE_KEY =
  'brickhunt.admin.bulk-onboarding.cart-search';
const BULK_ONBOARDING_DIRECT_INPUT_STORAGE_KEY =
  'brickhunt.admin.bulk-onboarding.direct-input';
const BULK_ONBOARDING_RESULT_FILTER_STORAGE_KEY =
  'brickhunt.admin.bulk-onboarding.result-filter';
const BULK_ONBOARDING_DIRECT_LOOKUP_CONCURRENCY = 12;

const processingStateOrder = {
  pending_import: 0,
  catalog_ready: 1,
  seed_generation_completed: 2,
  seed_validation_completed: 3,
  commerce_sync_completed: 4,
} as const;

function readStoredJson<T>(key: string, fallbackValue: T): T {
  if (typeof window === 'undefined') {
    return fallbackValue;
  }

  try {
    const rawValue = window.sessionStorage.getItem(key);

    if (!rawValue) {
      return fallbackValue;
    }

    return JSON.parse(rawValue) as T;
  } catch {
    return fallbackValue;
  }
}

function writeStoredJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(key, JSON.stringify(value));
}

function writeStoredString(key: string, value: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (!value) {
    window.sessionStorage.removeItem(key);

    return;
  }

  window.sessionStorage.setItem(key, value);
}

function readStoredString(key: string): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.sessionStorage.getItem(key) ?? '';
}

function formatDateTime(value?: string): string {
  if (!value) {
    return 'Nog niet bijgewerkt';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('nl-NL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function formatCoverageLabel(
  snapshot?: CommerceAdminBulkOnboardingSnapshotSetSummary,
): string {
  switch (snapshot?.coverageStatus) {
    case 'full_primary_coverage':
      return 'Full primary coverage';
    case 'partial_primary_coverage':
      return 'Partial primary coverage';
    case 'no_primary_seeds':
      return 'Geen primary seeds';
    case 'no_valid_primary_offers':
      return 'Geen geldige primary offers';
    default:
      return 'Nog geen coverage snapshot';
  }
}

function formatStageTone(
  status:
    | 'completed'
    | 'completed_with_errors'
    | 'failed'
    | 'pending'
    | 'running'
    | 'skipped',
): BulkOnboardingStageTone {
  switch (status) {
    case 'completed':
      return 'positive';
    case 'completed_with_errors':
    case 'running':
      return 'warning';
    case 'failed':
      return 'danger';
    default:
      return 'neutral';
  }
}

function formatStageLabel(
  status:
    | 'completed'
    | 'completed_with_errors'
    | 'failed'
    | 'pending'
    | 'running'
    | 'skipped',
): string {
  switch (status) {
    case 'completed':
      return 'klaar';
    case 'completed_with_errors':
      return 'klaar met fouten';
    case 'failed':
      return 'gefaald';
    case 'running':
      return 'bezig';
    case 'skipped':
      return 'overgeslagen';
    default:
      return 'wacht';
  }
}

function summarizeImportStep(run: CommerceAdminBulkOnboardingRun): string {
  const summary = run.importStep.summary;

  if (!summary) {
    return 'Nog geen importresultaat';
  }

  return `${summary.createdCount} nieuw · ${summary.alreadyPresentCount} al aanwezig · ${summary.failedCount} gefaald`;
}

function summarizeGenerateStep(run: CommerceAdminBulkOnboardingRun): string {
  const summary = run.generateStep.summary;

  if (!summary) {
    return 'Nog geen seed generation';
  }

  return `${summary.insertedCount} nieuw · ${summary.updatedCount} bijgewerkt · ${summary.skippedCount} overgeslagen`;
}

function summarizeValidateStep(run: CommerceAdminBulkOnboardingRun): string {
  const summary = run.validateStep.summary;

  if (!summary) {
    return 'Nog geen seed validatie';
  }

  return `${summary.validCount} valid · ${summary.staleCount} stale · ${summary.invalidCount} invalid`;
}

function summarizeSyncStep(run: CommerceAdminBulkOnboardingRun): string {
  const summary = run.syncStep.summary;

  if (!summary) {
    return 'Nog geen scoped sync';
  }

  return `${summary.refreshSuccessCount} success · ${summary.refreshUnavailableCount} unavailable · ${summary.refreshStaleCount} stale`;
}

function summarizeSnapshotStep(run: CommerceAdminBulkOnboardingRun): string {
  const summary = run.snapshotStep.summary;

  if (!summary) {
    return 'Nog geen snapshot';
  }

  return `${summary.fullPrimaryCoverageCount} full · ${summary.partialPrimaryCoverageCount} partial · ${summary.noValidPrimaryOffersCount} geen geldige offers`;
}

function deriveStageStatusLabel({
  appliedSetIds,
  failureStatus,
  processingState,
  setId,
  successThreshold,
  runningStatus,
}: {
  appliedSetIds: readonly string[];
  failureStatus:
    | 'completed'
    | 'completed_with_errors'
    | 'failed'
    | 'pending'
    | 'running'
    | 'skipped';
  processingState:
    | 'catalog_ready'
    | 'commerce_sync_completed'
    | 'pending_import'
    | 'seed_generation_completed'
    | 'seed_validation_completed';
  setId: string;
  successThreshold: keyof typeof processingStateOrder;
  runningStatus:
    | 'completed'
    | 'completed_with_errors'
    | 'failed'
    | 'pending'
    | 'running'
    | 'skipped';
}): string {
  if (
    processingStateOrder[processingState] >=
    processingStateOrder[successThreshold]
  ) {
    return 'klaar';
  }

  if (failureStatus === 'failed' && appliedSetIds.includes(setId)) {
    return 'gefaald';
  }

  if (runningStatus === 'running' && appliedSetIds.includes(setId)) {
    return 'bezig';
  }

  if (runningStatus === 'skipped') {
    return 'overgeslagen';
  }

  return 'wacht';
}

function buildRunSetRow(
  run: CommerceAdminBulkOnboardingRun,
  setId: string,
): BulkOnboardingSetRow {
  const progress = run.setProgressById[setId];

  if (!progress) {
    return {
      coverageLabel: 'Nog geen coverage snapshot',
      generateLabel: 'wacht',
      hasCommerceContext: false,
      importLabel: 'wacht',
      isFullCoverage: false,
      lastUpdatedAt: '',
      missingMerchantLabel: null,
      outcome: 'running',
      outcomeLabel: 'Bezig',
      outcomeTone: 'warning',
      setId,
      setLabel: setId,
      syncLabel: 'wacht',
      themeLabel: null,
      validateLabel: 'wacht',
    };
  }

  const snapshot = progress.snapshot;
  const setLabel =
    progress.catalogSetName ?? snapshot?.setName ?? `Set ${setId}`;
  const themeLabel = progress.catalogSetTheme ?? snapshot?.theme ?? null;
  const importLabel =
    progress.importStatus === 'created'
      ? 'nieuw'
      : progress.importStatus === 'already_present'
        ? 'al aanwezig'
        : progress.importStatus === 'failed'
          ? 'gefaald'
          : 'wacht';
  const generateLabel =
    progress.importStatus === 'failed'
      ? 'niet gestart'
      : deriveStageStatusLabel({
          appliedSetIds: run.generateStep.appliedSetIds,
          failureStatus: run.generateStep.status,
          processingState: progress.processingState,
          runningStatus: run.generateStep.status,
          setId,
          successThreshold: 'seed_generation_completed',
        });
  const validateLabel =
    progress.importStatus === 'failed'
      ? 'niet gestart'
      : deriveStageStatusLabel({
          appliedSetIds: run.validateStep.appliedSetIds,
          failureStatus: run.validateStep.status,
          processingState: progress.processingState,
          runningStatus: run.validateStep.status,
          setId,
          successThreshold: 'seed_validation_completed',
        });
  const syncLabel =
    progress.importStatus === 'failed'
      ? 'niet gestart'
      : deriveStageStatusLabel({
          appliedSetIds: run.syncStep.appliedSetIds,
          failureStatus: run.syncStep.status,
          processingState: progress.processingState,
          runningStatus: run.syncStep.status,
          setId,
          successThreshold: 'commerce_sync_completed',
        });
  const missingMerchantLabel = snapshot?.missingValidPrimaryOfferMerchantSlugs
    .length
    ? snapshot.missingValidPrimaryOfferMerchantSlugs.join(', ')
    : null;
  const coverageLabel = formatCoverageLabel(snapshot);
  const isFullCoverage = snapshot?.coverageStatus === 'full_primary_coverage';
  const isRunning =
    run.status === 'running' &&
    progress.processingState !== 'commerce_sync_completed' &&
    progress.importStatus !== 'failed';
  const outcome = isFullCoverage
    ? 'completed'
    : isRunning
      ? 'running'
      : 'attention';
  const outcomeLabel =
    outcome === 'completed'
      ? 'Volledig'
      : outcome === 'running'
        ? 'Bezig'
        : 'Aandacht';
  const outcomeTone =
    outcome === 'completed'
      ? 'positive'
      : outcome === 'running'
        ? 'warning'
        : 'danger';

  return {
    coverageLabel,
    generateLabel,
    hasCommerceContext: Boolean(snapshot),
    importLabel,
    isFullCoverage,
    lastUpdatedAt: progress.lastUpdatedAt,
    missingMerchantLabel,
    outcome,
    outcomeLabel,
    outcomeTone,
    setId,
    setLabel,
    snapshot,
    syncLabel,
    themeLabel,
    validateLabel,
  };
}

function normalizeDirectSetToken(value: string): string | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const match = trimmedValue.match(/^(\d+)(?:-\d+)?$/);

  return match?.[1] ?? null;
}

function parseDirectSetTokens(value: string): string[] {
  return value
    .split(/[\s,;]+/g)
    .map((token) => token.trim())
    .filter(Boolean);
}

async function mapWithConcurrency<TValue, TResult>({
  items,
  limit,
  mapFn,
}: {
  items: readonly TValue[];
  limit: number;
  mapFn: (item: TValue) => Promise<TResult>;
}): Promise<TResult[]> {
  const safeLimit = Math.max(1, limit);
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;

      nextIndex += 1;
      results[currentIndex] = await mapFn(items[currentIndex]);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(safeLimit, items.length) }, () => worker()),
  );

  return results;
}

@Component({
  selector: 'lego-commerce-admin-bulk-onboarding-page',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    AdminBatchSelectionBarComponent,
    AdminEmptyStateComponent,
    AdminPageComponent,
    AdminSectionHeaderComponent,
    AdminStatusBadgeComponent,
  ],
  templateUrl: './commerce-admin-bulk-onboarding-page.html',
  styles: [
    `
      :host {
        display: block;
      }

      .bulk-onboarding__header-status,
      .bulk-onboarding__toolbar-actions,
      .bulk-onboarding__result-actions {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        justify-content: flex-start;
      }

      .bulk-onboarding__header-status {
        justify-content: flex-end;
      }

      .bulk-onboarding__workbench,
      .bulk-onboarding__main-column,
      .bulk-onboarding__side-column,
      .bulk-onboarding__panel,
      .bulk-onboarding__direct-intake,
      .bulk-onboarding__intake-zone,
      .bulk-onboarding__intake-subsection {
        display: grid;
        gap: 0.45rem;
      }

      .bulk-onboarding__subsection-header {
        border-bottom: 1px solid var(--lego-border-subtle);
        display: grid;
        gap: 0.15rem;
        padding-bottom: 0.35rem;
      }

      .bulk-onboarding__scroll-shell {
        overflow: auto;
      }

      .bulk-onboarding__textarea {
        min-height: 4rem;
        resize: vertical;
      }

      .bulk-onboarding__browse-shell {
        max-height: 16rem;
      }

      .bulk-onboarding__cart-shell {
        max-height: 12rem;
      }

      .bulk-onboarding__queue-shell {
        max-height: 22rem;
      }

      .bulk-onboarding__inline-notice {
        background: color-mix(
          in srgb,
          var(--lego-surface-muted) 28%,
          transparent
        );
        border: 1px solid var(--lego-border-subtle);
        border-radius: 0.65rem;
        color: var(--lego-text-muted);
        font-size: 0.83rem;
        line-height: 1.4;
        padding: 0.45rem 0.55rem;
      }

      .bulk-onboarding__inline-notice.is-danger {
        background: #fef3f2;
        border-color: color-mix(in srgb, #b42318 24%, var(--lego-border) 76%);
        color: #b42318;
      }

      .bulk-onboarding__inline-notice.is-positive {
        background: #ecfdf3;
        border-color: color-mix(in srgb, #166534 24%, var(--lego-border) 76%);
        color: #166534;
      }

      .bulk-onboarding__checkbox-cell {
        width: 2.2rem;
      }

      .bulk-onboarding__checkbox {
        accent-color: var(--lego-text);
        height: 0.95rem;
        width: 0.95rem;
      }

      .bulk-onboarding__set-cell {
        display: grid;
        gap: 0.35rem;
        grid-template-columns: auto minmax(0, 1fr);
      }

      .bulk-onboarding__thumb {
        aspect-ratio: 1;
        background: color-mix(
          in srgb,
          var(--lego-surface-muted) 70%,
          transparent
        );
        border-radius: 0.55rem;
        height: 2rem;
        object-fit: cover;
        width: 2rem;
      }

      .bulk-onboarding__thumb--empty {
        border: 1px dashed var(--lego-border-subtle);
      }

      .bulk-onboarding__meta {
        display: grid;
        gap: 0.1rem;
      }

      .bulk-onboarding__run-meta {
        border: 1px solid var(--lego-border-subtle);
        border-radius: 0.7rem;
        overflow: hidden;
      }

      .bulk-onboarding__run-meta-row {
        border-top: 1px solid var(--lego-border-subtle);
        display: grid;
        gap: 0.35rem;
        grid-template-columns: minmax(4.8rem, 5.5rem) minmax(0, 1fr);
        padding: 0.4rem 0.5rem;
      }

      .bulk-onboarding__run-meta-row:first-child {
        border-top: 0;
      }

      .bulk-onboarding__run-meta-label,
      .bulk-onboarding__metric-label,
      .bulk-onboarding__stage-label {
        color: var(--lego-text-muted);
        font-size: 0.64rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .bulk-onboarding__run-meta-value {
        color: var(--lego-text);
        font-size: 0.78rem;
        line-height: 1.35;
      }

      .bulk-onboarding__run-meta-value--path {
        overflow-wrap: anywhere;
      }

      .bulk-onboarding__stage-table-shell {
        border-radius: 0.7rem;
      }

      .bulk-onboarding__stage-table td,
      .bulk-onboarding__stage-table th {
        vertical-align: middle;
      }

      .bulk-onboarding__stage-name {
        font-size: 0.76rem;
        font-weight: 600;
        white-space: nowrap;
      }

      .bulk-onboarding__stage-summary {
        color: var(--lego-text-muted);
        font-size: 0.74rem;
        line-height: 1.3;
      }

      .bulk-onboarding__result-filter {
        min-width: 9rem;
      }

      @media (min-width: 1180px) {
        .bulk-onboarding__workbench {
          align-items: start;
          grid-template-columns: minmax(0, 1.55fr) minmax(20rem, 0.95fr);
        }

        .bulk-onboarding__intake-zone {
          align-items: start;
          gap: 0.5rem;
          grid-template-columns: minmax(15rem, 0.78fr) minmax(0, 1.22fr);
        }

        .bulk-onboarding__side-column {
          align-self: start;
          position: sticky;
          top: 0.75rem;
        }

        .bulk-onboarding__metric-strip {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .bulk-onboarding__metric-cell + .bulk-onboarding__metric-cell {
          border-left: 1px solid var(--lego-border-subtle);
          border-top: 0;
        }

        .bulk-onboarding__browse-shell {
          max-height: 18rem;
        }

        .bulk-onboarding__queue-shell {
          max-height: 24rem;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommerceAdminBulkOnboardingPageComponent
  implements OnInit, OnDestroy
{
  private readonly commerceAdminApi = inject(CommerceAdminApiService);
  private refreshTimeoutId: number | undefined;

  readonly searchQuery = signal(
    readStoredString(BULK_ONBOARDING_SEARCH_STORAGE_KEY),
  );
  readonly searchSort = signal<BulkOnboardingSearchSort>('release_year_desc');
  readonly directInput = signal(
    readStoredString(BULK_ONBOARDING_DIRECT_INPUT_STORAGE_KEY),
  );
  readonly cartSearch = signal<BulkOnboardingCartFilter>(
    readStoredString(BULK_ONBOARDING_CART_SEARCH_STORAGE_KEY),
  );
  readonly resultFilter = signal<BulkOnboardingResultFilter>(
    (readStoredString(
      BULK_ONBOARDING_RESULT_FILTER_STORAGE_KEY,
    ) as BulkOnboardingResultFilter) || 'all',
  );

  readonly searchResults = signal<CatalogExternalSetSearchResult[]>([]);
  readonly browseSelectionIds = signal<string[]>([]);
  readonly selectedSets = signal<CatalogExternalSetSearchResult[]>(
    readStoredJson<CatalogExternalSetSearchResult[]>(
      BULK_ONBOARDING_SELECTION_STORAGE_KEY,
      [],
    ),
  );
  readonly directIntakeRows = signal<DirectSetIntakeRow[]>([]);
  readonly activeRun = signal<CommerceAdminBulkOnboardingRun | null>(null);
  readonly activeRunStateFilePath = signal<string | null>(null);
  readonly catalogSetIds = signal<string[]>([]);

  readonly isLoadingCatalogIndex = signal(false);
  readonly isSearching = signal(false);
  readonly isResolvingDirectInput = signal(false);
  readonly isStarting = signal(false);
  readonly isLoadingRun = signal(false);
  readonly searchMessage = signal<string | null>(null);
  readonly searchMessageTone = signal<AdminFeedbackTone>(null);
  readonly runMessage = signal<string | null>(null);
  readonly runMessageTone = signal<AdminFeedbackTone>(null);

  readonly selectedSetIds = computed(() =>
    this.selectedSets().map((setItem) => setItem.setId),
  );

  readonly directInputStats = computed(() => {
    const rawTokens = parseDirectSetTokens(this.directInput());
    const normalizedTokens = rawTokens
      .map((token) => normalizeDirectSetToken(token))
      .filter((setId): setId is string => Boolean(setId));

    return {
      rawTokenCount: rawTokens.length,
      validTokenCount: normalizedTokens.length,
      uniqueValidTokenCount: new Set(normalizedTokens).size,
    };
  });

  readonly directIntakeSummary = computed(() => {
    const summary = {
      addedCount: 0,
      alreadyInCatalogCount: 0,
      alreadySelectedCount: 0,
      invalidCount: 0,
      notFoundCount: 0,
      processedCount: this.directIntakeRows().length,
    };

    for (const row of this.directIntakeRows()) {
      switch (row.status) {
        case 'added':
          summary.addedCount += 1;
          break;
        case 'already_in_catalog':
          summary.alreadyInCatalogCount += 1;
          break;
        case 'already_selected':
          summary.alreadySelectedCount += 1;
          break;
        case 'invalid':
          summary.invalidCount += 1;
          break;
        case 'not_found':
          summary.notFoundCount += 1;
          break;
      }
    }

    return summary;
  });

  readonly selectedBrowseResultCount = computed(
    () => this.browseSelectionIds().length,
  );

  readonly filteredSelectedSets = computed(() => {
    const normalizedSearch = this.cartSearch().trim().toLowerCase();

    if (!normalizedSearch) {
      return this.selectedSets();
    }

    return this.selectedSets().filter(
      (setItem) =>
        setItem.setId.toLowerCase().includes(normalizedSearch) ||
        setItem.name.toLowerCase().includes(normalizedSearch) ||
        setItem.theme.toLowerCase().includes(normalizedSearch),
    );
  });

  readonly sortedSearchResults = computed(() => {
    const sort = this.searchSort();

    return [...this.searchResults()].sort((left, right) => {
      if (sort === 'set_id') {
        return left.setId.localeCompare(right.setId);
      }

      if (sort === 'name') {
        return (
          left.name.localeCompare(right.name) ||
          left.setId.localeCompare(right.setId)
        );
      }

      if (sort === 'release_year_asc') {
        return (
          left.releaseYear - right.releaseYear ||
          left.setId.localeCompare(right.setId)
        );
      }

      return (
        right.releaseYear - left.releaseYear ||
        left.setId.localeCompare(right.setId)
      );
    });
  });

  readonly stageCards = computed<BulkOnboardingStageCard[]>(() => {
    const run = this.activeRun();

    if (!run) {
      return [];
    }

    return [
      {
        label: 'Import',
        status: formatStageLabel(run.importStep.status),
        summary: summarizeImportStep(run),
        tone: formatStageTone(run.importStep.status),
      },
      {
        label: 'Generate',
        status: formatStageLabel(run.generateStep.status),
        summary: summarizeGenerateStep(run),
        tone: formatStageTone(run.generateStep.status),
      },
      {
        label: 'Validate',
        status: formatStageLabel(run.validateStep.status),
        summary: summarizeValidateStep(run),
        tone: formatStageTone(run.validateStep.status),
      },
      {
        label: 'Scoped sync',
        status: formatStageLabel(run.syncStep.status),
        summary: summarizeSyncStep(run),
        tone: formatStageTone(run.syncStep.status),
      },
      {
        label: 'Snapshot',
        status: formatStageLabel(run.snapshotStep.status),
        summary: summarizeSnapshotStep(run),
        tone: formatStageTone(run.snapshotStep.status),
      },
    ];
  });

  readonly runResultRows = computed(() => {
    const run = this.activeRun();

    if (!run) {
      return [];
    }

    return run.requestedSetIds
      .map((setId) => buildRunSetRow(run, setId))
      .filter((row) => {
        const filter = this.resultFilter();

        if (filter === 'attention') {
          return row.outcome === 'attention';
        }

        if (filter === 'full') {
          return row.isFullCoverage;
        }

        if (filter === 'in_progress') {
          return row.outcome === 'running';
        }

        if (filter === 'no_commerce_context') {
          return !row.hasCommerceContext;
        }

        return true;
      })
      .sort((left, right) => {
        const outcomeOrder: Record<BulkOnboardingRunOutcome, number> = {
          attention: 0,
          running: 1,
          completed: 2,
        };

        return (
          outcomeOrder[left.outcome] - outcomeOrder[right.outcome] ||
          left.setId.localeCompare(right.setId)
        );
      });
  });

  readonly runOutcomeSummary = computed(() => {
    const run = this.activeRun();
    const rows = run
      ? run.requestedSetIds.map((setId) => buildRunSetRow(run, setId))
      : [];

    return {
      attentionCount: rows.filter((row) => row.outcome === 'attention').length,
      completedCount: rows.filter((row) => row.outcome === 'completed').length,
      runningCount: rows.filter((row) => row.outcome === 'running').length,
    };
  });

  constructor() {
    effect(() => {
      writeStoredJson(
        BULK_ONBOARDING_SELECTION_STORAGE_KEY,
        this.selectedSets(),
      );
    });
    effect(() => {
      writeStoredString(
        BULK_ONBOARDING_RUN_ID_STORAGE_KEY,
        this.activeRun()?.runId ?? null,
      );
    });
    effect(() => {
      writeStoredString(
        BULK_ONBOARDING_SEARCH_STORAGE_KEY,
        this.searchQuery().trim() || null,
      );
    });
    effect(() => {
      writeStoredString(
        BULK_ONBOARDING_DIRECT_INPUT_STORAGE_KEY,
        this.directInput().trim() || null,
      );
    });
    effect(() => {
      writeStoredString(
        BULK_ONBOARDING_CART_SEARCH_STORAGE_KEY,
        this.cartSearch().trim() || null,
      );
    });
    effect(() => {
      writeStoredString(
        BULK_ONBOARDING_RESULT_FILTER_STORAGE_KEY,
        this.resultFilter(),
      );
    });
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadCatalogIndex(), this.loadInitialRun()]);
  }

  ngOnDestroy(): void {
    this.clearRefreshTimer();
  }

  updateSearchQuery(value: string): void {
    this.searchQuery.set(value);
  }

  updateSearchSort(value: BulkOnboardingSearchSort): void {
    this.searchSort.set(value);
  }

  updateDirectInput(value: string): void {
    this.directInput.set(value);
  }

  updateCartSearch(value: string): void {
    this.cartSearch.set(value);
  }

  updateResultFilter(value: BulkOnboardingResultFilter): void {
    this.resultFilter.set(value);
  }

  isSelected(setId: string): boolean {
    return this.selectedSets().some((setItem) => setItem.setId === setId);
  }

  isBrowseSelected(setId: string): boolean {
    return this.browseSelectionIds().includes(setId);
  }

  areAllSearchResultsSelected(): boolean {
    const currentResults = this.sortedSearchResults();

    return (
      currentResults.length > 0 &&
      currentResults.every((result) => this.isBrowseSelected(result.setId))
    );
  }

  addSetToSelection(result: CatalogExternalSetSearchResult): void {
    const currentSelection = this.selectedSets();

    if (currentSelection.some((setItem) => setItem.setId === result.setId)) {
      return;
    }

    this.selectedSets.set(
      [...currentSelection, result].sort((left, right) =>
        left.setId.localeCompare(right.setId),
      ),
    );
  }

  addBrowseSelectionToCart(): void {
    const selection = new Set(this.browseSelectionIds());

    if (selection.size === 0) {
      return;
    }

    const rowsToAdd = this.searchResults().filter((result) =>
      selection.has(result.setId),
    );

    for (const result of rowsToAdd) {
      this.addSetToSelection(result);
    }

    this.browseSelectionIds.set([]);
  }

  removeSetFromSelection(setId: string): void {
    this.selectedSets.set(
      this.selectedSets().filter((setItem) => setItem.setId !== setId),
    );
  }

  clearSelection(): void {
    this.selectedSets.set([]);
  }

  removeVisibleSelection(): void {
    const visibleSetIds = new Set(
      this.filteredSelectedSets().map((setItem) => setItem.setId),
    );

    if (visibleSetIds.size === 0) {
      return;
    }

    this.selectedSets.set(
      this.selectedSets().filter(
        (setItem) => !visibleSetIds.has(setItem.setId),
      ),
    );
  }

  clearBrowseSelection(): void {
    this.browseSelectionIds.set([]);
  }

  clearDirectInput(): void {
    this.directInput.set('');
    this.directIntakeRows.set([]);
  }

  toggleBrowseSelection(setId: string, checked: boolean): void {
    const currentSelection = new Set(this.browseSelectionIds());

    if (checked) {
      currentSelection.add(setId);
    } else {
      currentSelection.delete(setId);
    }

    this.browseSelectionIds.set([...currentSelection].sort());
  }

  toggleAllBrowseSelection(checked: boolean): void {
    if (!checked) {
      this.browseSelectionIds.set([]);

      return;
    }

    this.browseSelectionIds.set(
      this.sortedSearchResults()
        .map((result) => result.setId)
        .sort((left, right) => left.localeCompare(right)),
    );
  }

  async search(): Promise<void> {
    const query = this.searchQuery().trim();

    if (!query) {
      this.searchResults.set([]);
      this.browseSelectionIds.set([]);
      this.searchMessage.set('Vul eerst een setnummer, naam of thema in.');
      this.searchMessageTone.set('neutral');

      return;
    }

    this.isSearching.set(true);
    this.searchMessage.set(null);
    this.searchMessageTone.set(null);

    try {
      const results =
        await this.commerceAdminApi.searchCatalogMissingSets(query);

      this.searchResults.set(results);
      this.browseSelectionIds.set(
        this.browseSelectionIds().filter((setId) =>
          results.some((result) => result.setId === setId),
        ),
      );
      this.searchMessage.set(
        results.length === 0
          ? 'Geen missende sets gevonden voor deze zoekopdracht.'
          : `${results.length} missende sets gevonden.`,
      );
      this.searchMessageTone.set(results.length === 0 ? 'neutral' : 'positive');
    } catch (error) {
      this.searchResults.set([]);
      this.browseSelectionIds.set([]);
      this.searchMessage.set(
        error instanceof Error
          ? error.message
          : 'Zoeken in Rebrickable mislukte.',
      );
      this.searchMessageTone.set('danger');
    } finally {
      this.isSearching.set(false);
    }
  }

  async addDirectSetIds(): Promise<void> {
    await this.ensureCatalogIndexLoaded();

    const rawTokens = parseDirectSetTokens(this.directInput());

    if (rawTokens.length === 0) {
      this.directIntakeRows.set([]);
      this.searchMessage.set(
        'Plak eerst één of meer setnummers. Komma’s, spaties en enters mogen allemaal.',
      );
      this.searchMessageTone.set('neutral');

      return;
    }

    this.isResolvingDirectInput.set(true);
    this.directIntakeRows.set([]);

    try {
      const currentSelectedSetIds = new Set(this.selectedSetIds());
      const currentCatalogSetIds = new Set(this.catalogSetIds());
      const lookupSetIds = [
        ...new Set(
          rawTokens
            .map((token) => normalizeDirectSetToken(token))
            .filter((setId): setId is string => {
              if (!setId) {
                return false;
              }

              return (
                !currentSelectedSetIds.has(setId) &&
                !currentCatalogSetIds.has(setId)
              );
            }),
        ),
      ];
      const lookupResults = await mapWithConcurrency({
        items: lookupSetIds,
        limit: BULK_ONBOARDING_DIRECT_LOOKUP_CONCURRENCY,
        mapFn: async (setId) => {
          const searchResults =
            await this.commerceAdminApi.searchCatalogMissingSets(setId);
          const exactMatch = searchResults.find(
            (searchResult) =>
              searchResult.setId === setId ||
              searchResult.sourceSetNumber === `${setId}-1`,
          );

          return [setId, exactMatch] as const;
        },
      });
      const exactResultBySetId = new Map(lookupResults);
      const addedInThisPass = new Set<string>();
      const setsToAdd = new Map<string, CatalogExternalSetSearchResult>();
      const intakeRows: DirectSetIntakeRow[] = rawTokens.map((token) => {
        const normalizedSetId = normalizeDirectSetToken(token);

        if (!normalizedSetId) {
          return {
            input: token,
            status: 'invalid',
            statusLabel: 'Ongeldig',
            statusTone: 'danger',
          };
        }

        if (
          currentSelectedSetIds.has(normalizedSetId) ||
          addedInThisPass.has(normalizedSetId)
        ) {
          return {
            input: token,
            normalizedSetId,
            status: 'already_selected',
            statusLabel: 'Al geselecteerd',
            statusTone: 'neutral',
          };
        }

        if (currentCatalogSetIds.has(normalizedSetId)) {
          return {
            input: token,
            normalizedSetId,
            status: 'already_in_catalog',
            statusLabel: 'Al in catalogus',
            statusTone: 'neutral',
          };
        }

        const exactResult = exactResultBySetId.get(normalizedSetId);

        if (!exactResult) {
          return {
            input: token,
            normalizedSetId,
            status: 'not_found',
            statusLabel: 'Niet gevonden',
            statusTone: 'warning',
          };
        }

        setsToAdd.set(normalizedSetId, exactResult);
        addedInThisPass.add(normalizedSetId);

        return {
          input: token,
          normalizedSetId,
          result: exactResult,
          status: 'added',
          statusLabel: 'Toegevoegd',
          statusTone: 'positive',
        };
      });

      for (const result of setsToAdd.values()) {
        this.addSetToSelection(result);
      }

      this.directIntakeRows.set(intakeRows);
    } finally {
      this.isResolvingDirectInput.set(false);
    }
  }

  async startBulkOnboarding(): Promise<void> {
    const setIds = this.selectedSetIds();

    if (setIds.length === 0) {
      this.runMessage.set('Selecteer eerst minstens één set.');
      this.runMessageTone.set('neutral');

      return;
    }

    this.isStarting.set(true);
    this.runMessage.set(null);
    this.runMessageTone.set(null);

    try {
      const result =
        await this.commerceAdminApi.startCatalogBulkOnboarding(setIds);

      this.activeRun.set(result.run);
      this.activeRunStateFilePath.set(result.stateFilePath);
      this.runMessage.set(
        result.alreadyRunning
          ? `Run ${result.runId} draaide al. Ik volg de bestaande run verder.`
          : `Run ${result.runId} gestart voor ${result.run.requestedSetIds.length} sets.`,
      );
      this.runMessageTone.set(result.alreadyRunning ? 'neutral' : 'positive');
      this.scheduleRunRefresh();
    } catch (error) {
      this.runMessage.set(
        error instanceof Error
          ? error.message
          : 'Bulk onboarding starten mislukte.',
      );
      this.runMessageTone.set('danger');
    } finally {
      this.isStarting.set(false);
    }
  }

  async refreshRun(): Promise<void> {
    const runId =
      this.activeRun()?.runId ||
      readStoredString(BULK_ONBOARDING_RUN_ID_STORAGE_KEY);

    if (!runId) {
      await this.loadLatestRun();

      return;
    }

    this.isLoadingRun.set(true);

    try {
      const runResult =
        await this.commerceAdminApi.getCatalogBulkOnboardingRun(runId);

      if (!runResult) {
        this.activeRun.set(null);
        this.activeRunStateFilePath.set(null);
        this.runMessage.set(
          'De opgeslagen bulk onboarding run is niet meer gevonden.',
        );
        this.runMessageTone.set('neutral');
        writeStoredString(BULK_ONBOARDING_RUN_ID_STORAGE_KEY, null);

        return;
      }

      this.applyRunReadResult(runResult);
    } catch (error) {
      this.runMessage.set(
        error instanceof Error ? error.message : 'Runstatus ophalen mislukte.',
      );
      this.runMessageTone.set('danger');
    } finally {
      this.isLoadingRun.set(false);
    }
  }

  getBrowseResultStatus(result: CatalogExternalSetSearchResult): {
    label: string;
    tone: AdminStatusBadgeTone;
  } {
    if (this.isSelected(result.setId)) {
      return {
        label: 'Al geselecteerd',
        tone: 'neutral',
      };
    }

    if (this.isBrowseSelected(result.setId)) {
      return {
        label: 'Klaar om toe te voegen',
        tone: 'positive',
      };
    }

    return {
      label: 'Beschikbaar',
      tone: 'neutral',
    };
  }

  private applyRunReadResult(
    result: CommerceAdminBulkOnboardingRunReadResult,
  ): void {
    this.activeRun.set(result.run);
    this.activeRunStateFilePath.set(result.stateFilePath);

    if (result.run.status === 'running') {
      this.scheduleRunRefresh();
    } else {
      this.clearRefreshTimer();
    }
  }

  private async loadInitialRun(): Promise<void> {
    const storedRunId = readStoredString(BULK_ONBOARDING_RUN_ID_STORAGE_KEY);

    if (storedRunId) {
      const runResult =
        await this.commerceAdminApi.getCatalogBulkOnboardingRun(storedRunId);

      if (runResult) {
        this.applyRunReadResult(runResult);

        return;
      }
    }

    await this.loadLatestRun();
  }

  private async loadLatestRun(): Promise<void> {
    this.isLoadingRun.set(true);

    try {
      const latestRun =
        await this.commerceAdminApi.getLatestCatalogBulkOnboardingRun();

      if (!latestRun) {
        this.activeRun.set(null);
        this.activeRunStateFilePath.set(null);

        return;
      }

      this.applyRunReadResult(latestRun);
    } catch (error) {
      this.runMessage.set(
        error instanceof Error
          ? error.message
          : 'Laatste run ophalen mislukte.',
      );
      this.runMessageTone.set('danger');
    } finally {
      this.isLoadingRun.set(false);
    }
  }

  private async loadCatalogIndex(): Promise<void> {
    this.isLoadingCatalogIndex.set(true);

    try {
      const catalogSets = await this.commerceAdminApi.listCatalogSets();

      this.catalogSetIds.set(catalogSets.map((catalogSet) => catalogSet.id));
    } finally {
      this.isLoadingCatalogIndex.set(false);
    }
  }

  private async ensureCatalogIndexLoaded(): Promise<void> {
    if (this.catalogSetIds().length > 0 || this.isLoadingCatalogIndex()) {
      return;
    }

    await this.loadCatalogIndex();
  }

  private scheduleRunRefresh(): void {
    this.clearRefreshTimer();

    if (
      typeof window === 'undefined' ||
      this.activeRun()?.status !== 'running'
    ) {
      return;
    }

    this.refreshTimeoutId = window.setTimeout(() => {
      void this.refreshRun();
    }, 2500);
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimeoutId) {
      clearTimeout(this.refreshTimeoutId);
      this.refreshTimeoutId = undefined;
    }
  }

  readonly formatDateTime = formatDateTime;
}
