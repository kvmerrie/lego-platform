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
import { type CatalogExternalSetSearchResult } from '@lego-platform/catalog/util';
import {
  CommerceAdminApiService,
  type CommerceAdminBulkOnboardingRun,
  type CommerceAdminBulkOnboardingRunReadResult,
  type CommerceAdminBulkOnboardingSnapshotSetSummary,
} from './commerce-admin-api.service';

type AdminFeedbackTone = 'danger' | 'neutral' | 'positive' | null;
type BulkOnboardingResultFilter = 'all' | 'attention' | 'completed' | 'running';
type BulkOnboardingResultTone = 'danger' | 'neutral' | 'positive' | 'warning';
type BulkOnboardingRunOutcome = 'attention' | 'completed' | 'running';
type BulkOnboardingStageTone = 'danger' | 'neutral' | 'positive' | 'warning';

interface BulkOnboardingStageCard {
  label: string;
  status: string;
  summary: string;
  tone: BulkOnboardingStageTone;
}

interface BulkOnboardingSetRow {
  coverageLabel: string;
  generateLabel: string;
  importLabel: string;
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

const BULK_ONBOARDING_SELECTION_STORAGE_KEY =
  'brickhunt.admin.bulk-onboarding.selection';
const BULK_ONBOARDING_RUN_ID_STORAGE_KEY =
  'brickhunt.admin.bulk-onboarding.active-run-id';
const BULK_ONBOARDING_SEARCH_STORAGE_KEY =
  'brickhunt.admin.bulk-onboarding.search-query';

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
      importLabel: 'wacht',
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
    importLabel,
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

@Component({
  selector: 'lego-commerce-admin-bulk-onboarding-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './commerce-admin-bulk-onboarding-page.html',
  styles: [
    `
      :host {
        display: block;
      }

      .admin-bulk-onboarding {
        display: grid;
        gap: 1rem;
      }

      .admin-bulk-onboarding__layout,
      .admin-bulk-onboarding__run-summary,
      .admin-bulk-onboarding__stage-grid {
        display: grid;
        gap: 1rem;
      }

      .admin-bulk-onboarding__search-results,
      .admin-bulk-onboarding__selection-list,
      .admin-bulk-onboarding__result-list {
        display: grid;
        gap: 0.75rem;
      }

      .admin-bulk-onboarding__search-result,
      .admin-bulk-onboarding__selection-card,
      .admin-bulk-onboarding__stage-card,
      .admin-bulk-onboarding__result-card {
        border: 1px solid var(--lego-border-subtle);
        border-radius: var(--lego-radius-md);
        display: grid;
        gap: 0.55rem;
        padding: 0.9rem 1rem;
      }

      .admin-bulk-onboarding__search-result {
        align-items: start;
        background: transparent;
        grid-template-columns: auto minmax(0, 1fr) auto;
        text-align: left;
        width: 100%;
      }

      .admin-bulk-onboarding__search-result.is-selected {
        background: color-mix(
          in srgb,
          var(--lego-accent) 8%,
          var(--lego-surface)
        );
        border-color: color-mix(
          in srgb,
          var(--lego-accent) 35%,
          var(--lego-border) 65%
        );
      }

      .admin-bulk-onboarding__thumb {
        border-radius: var(--lego-radius-sm);
        height: 4.5rem;
        object-fit: cover;
        width: 4.5rem;
      }

      .admin-bulk-onboarding__card-header,
      .admin-bulk-onboarding__selection-meta,
      .admin-bulk-onboarding__run-meta,
      .admin-bulk-onboarding__result-meta,
      .admin-bulk-onboarding__result-statuses {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .admin-bulk-onboarding__run-meta,
      .admin-bulk-onboarding__result-statuses {
        row-gap: 0.35rem;
      }

      .admin-bulk-onboarding__state-file {
        overflow-wrap: anywhere;
      }

      .admin-bulk-onboarding__result-card {
        grid-template-columns: minmax(0, 1fr) auto;
      }

      .admin-bulk-onboarding__result-main {
        display: grid;
        gap: 0.4rem;
      }

      .admin-bulk-onboarding__pill {
        border: 1px solid var(--lego-border-subtle);
        border-radius: 999px;
        color: var(--lego-text-muted);
        font-size: 0.83rem;
        padding: 0.16rem 0.55rem;
      }

      @media (min-width: 960px) {
        .admin-bulk-onboarding__layout {
          align-items: start;
          grid-template-columns: minmax(0, 1.35fr) minmax(20rem, 0.9fr);
        }

        .admin-bulk-onboarding__run-summary {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .admin-bulk-onboarding__stage-grid {
          grid-template-columns: repeat(5, minmax(0, 1fr));
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
  readonly searchResults = signal<CatalogExternalSetSearchResult[]>([]);
  readonly selectedSets = signal<CatalogExternalSetSearchResult[]>(
    readStoredJson<CatalogExternalSetSearchResult[]>(
      BULK_ONBOARDING_SELECTION_STORAGE_KEY,
      [],
    ),
  );
  readonly activeRun = signal<CommerceAdminBulkOnboardingRun | null>(null);
  readonly activeRunStateFilePath = signal<string | null>(null);
  readonly resultFilter = signal<BulkOnboardingResultFilter>('all');
  readonly isSearching = signal(false);
  readonly isStarting = signal(false);
  readonly isLoadingRun = signal(false);
  readonly searchMessage = signal<string | null>(null);
  readonly searchMessageTone = signal<AdminFeedbackTone>(null);
  readonly runMessage = signal<string | null>(null);
  readonly runMessageTone = signal<AdminFeedbackTone>(null);

  readonly selectedSetIds = computed(() =>
    this.selectedSets().map((setItem) => setItem.setId),
  );

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

    const filteredRows = run.requestedSetIds
      .map((setId) => buildRunSetRow(run, setId))
      .filter((row) => {
        const filter = this.resultFilter();

        if (filter === 'attention') {
          return row.outcome === 'attention';
        }

        if (filter === 'completed') {
          return row.outcome === 'completed';
        }

        if (filter === 'running') {
          return row.outcome === 'running';
        }

        return true;
      });

    return filteredRows.sort((left, right) => {
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
  }

  async ngOnInit(): Promise<void> {
    await this.loadInitialRun();
  }

  ngOnDestroy(): void {
    this.clearRefreshTimer();
  }

  updateSearchQuery(value: string): void {
    this.searchQuery.set(value);
  }

  updateResultFilter(value: BulkOnboardingResultFilter): void {
    this.resultFilter.set(value);
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

  removeSetFromSelection(setId: string): void {
    this.selectedSets.set(
      this.selectedSets().filter((setItem) => setItem.setId !== setId),
    );
  }

  clearSelection(): void {
    this.selectedSets.set([]);
  }

  isSelected(setId: string): boolean {
    return this.selectedSets().some((setItem) => setItem.setId === setId);
  }

  async search(): Promise<void> {
    const query = this.searchQuery().trim();

    if (!query) {
      this.searchResults.set([]);
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
      this.searchMessage.set(
        results.length === 0
          ? 'Geen missende sets gevonden voor deze zoekopdracht.'
          : `${results.length} missende sets gevonden.`,
      );
      this.searchMessageTone.set(results.length === 0 ? 'neutral' : 'positive');
    } catch (error) {
      this.searchResults.set([]);
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
