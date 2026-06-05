import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AdminPageComponent,
  AdminSectionHeaderComponent,
  AdminStatusBadgeComponent,
} from '@lego-platform/admin/ui';
import {
  CommerceAdminApiService,
  type CommerceAdminOperationsSummary,
  type CommerceAdminProductionSyncResult,
  type CommerceAdminPromotionPreviewResult,
  type CommerceAdminPromotionResult,
  type CommerceAdminRuntimeConfig,
} from './commerce-admin-api.service';

const PROMOTE_CONFIRMATION_PHRASE = 'PROMOTE CATALOG';

function toApiErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error && 'error' in error) {
    const errorRecord = error as {
      error?: {
        message?: string;
      };
    };

    return errorRecord.error?.message ?? 'De actie kon niet worden afgerond.';
  }

  return error instanceof Error
    ? error.message
    : 'De actie kon niet worden afgerond.';
}

function formatDateTime(value?: string): string {
  if (!value) {
    return 'Nog niet bekend';
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('nl-NL', {
        dateStyle: 'short',
        timeStyle: 'short',
      });
}

@Component({
  selector: 'lego-commerce-admin-sync-promote-page',
  imports: [
    CommonModule,
    FormsModule,
    AdminPageComponent,
    AdminSectionHeaderComponent,
    AdminStatusBadgeComponent,
  ],
  template: `
    <lego-admin-page
      eyebrow="Operations Console"
      title="Sync & Promote"
      description="Kopieer productiegegevens naar staging, bekijk de staging-productie diff en promoveer alleen expliciet."
    >
      <div adminPageActions>
        <button
          class="admin-button admin-button--primary"
          type="button"
          [disabled]="isLoadingPreview()"
          (click)="loadPreview()"
        >
          Ververs diff
        </button>
      </div>

      @if (errorMessage()) {
        <p class="admin-inline-alert admin-inline-alert--danger">
          {{ errorMessage() }}
        </p>
      }
      @if (feedbackMessage()) {
        <p class="admin-muted">{{ feedbackMessage() }}</p>
      }
      @if (operationsSummary(); as summary) {
        <p class="admin-muted">
          Runtime {{ summary.environments.currentRuntimeEnvironment }} ·
          writable {{ summary.environments.writableEnvironment }} · normal
          production writes
          {{ summary.environments.productionReadOnly ? 'locked' : 'unlocked' }}
          · promote is explicit production action
        </p>
      }

      <section class="admin-panel admin-stack">
        <lego-admin-section-header
          title="Production -> staging"
          description="Deze actie is buiten productie beschikbaar en schrijft alleen naar de staging-target."
        ></lego-admin-section-header>

        <div class="admin-input-with-action">
          <input
            class="admin-input"
            type="password"
            autocomplete="off"
            placeholder="ADMIN_PROMOTE_SECRET"
            [ngModel]="promoteSecret()"
            (ngModelChange)="promoteSecret.set($event)"
          />
          <div class="admin-input-actions">
            <button
              class="admin-button admin-button--subtle"
              type="button"
              [disabled]="isSyncRunning()"
              (click)="syncProductionToStaging(true)"
            >
              Dry-run
            </button>
            <button
              class="admin-button admin-button--primary"
              type="button"
              [disabled]="isSyncRunning()"
              (click)="syncProductionToStaging(false)"
            >
              Sync naar staging
            </button>
          </div>
        </div>

        @if (syncResult(); as result) {
          <div class="admin-data-table-shell">
            <table class="admin-data-table">
              <thead>
                <tr>
                  <th>Tabel</th>
                  <th>Productie</th>
                  <th>Staging voor sync</th>
                  <th>Verwijderd</th>
                  <th>Geplaatst</th>
                </tr>
              </thead>
              <tbody>
                @for (tableName of syncTableNames(); track tableName) {
                  <tr>
                    <td>
                      <strong>{{ tableName }}</strong>
                      @if (result.dryRun) {
                        <lego-admin-status-badge tone="neutral"
                          >dry-run</lego-admin-status-badge
                        >
                      }
                    </td>
                    <td>{{ result.tables[tableName].sourceCount }}</td>
                    <td>{{ result.tables[tableName].targetBeforeCount }}</td>
                    <td>{{ result.tables[tableName].deletedCount }}</td>
                    <td>{{ result.tables[tableName].insertedCount }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <section class="admin-panel admin-stack">
        <lego-admin-section-header
          title="Staging vs production diff"
          description="Read-only preview van wat een catalog promote zou wijzigen."
        >
          <div adminSectionMeta>
            <lego-admin-status-badge tone="warning">
              {{ preview()?.meaningfulPendingPromoteCount ?? 0 }} meaningful
              pending
            </lego-admin-status-badge>
          </div>
        </lego-admin-section-header>

        @if (preview(); as previewValue) {
          <p class="admin-muted">
            Preview {{ formatDate(previewValue.generatedAt) }} ·
            {{ previewValue.sourceEnvironment }} ->
            {{ previewValue.targetEnvironment }}
          </p>
          @if (previewValue.skippedHeavyTables.length > 0) {
            <p class="admin-inline-alert">
              Snapshot tables skipped in lightweight preview:
              {{ previewValue.skippedHeavyTables.join(', ') }}.
            </p>
          }
          <div class="admin-metric-strip">
            <div class="admin-metric-cell">
              <span class="admin-metric-label">Sets</span>
              <strong class="admin-metric-value">
                {{ previewValue.operatorSummary.sets.insertedCount }} new ·
                {{ previewValue.operatorSummary.sets.updatedCount }} updated
              </strong>
            </div>
            <div class="admin-metric-cell">
              <span class="admin-metric-label">Themes</span>
              <strong class="admin-metric-value">
                {{ previewValue.operatorSummary.themes.insertedCount }} new ·
                {{ previewValue.operatorSummary.themes.updatedCount }} updated
              </strong>
            </div>
            <div class="admin-metric-cell">
              <span class="admin-metric-label">Mappings</span>
              <strong class="admin-metric-value">
                {{ previewValue.operatorSummary.mappings.insertedCount }} new ·
                {{ previewValue.operatorSummary.mappings.updatedCount }} updated
              </strong>
            </div>
          </div>
          <div class="admin-data-table-shell">
            <table class="admin-data-table">
              <thead>
                <tr>
                  <th>Tabel</th>
                  <th>Staging rows</th>
                  <th>Nieuw</th>
                  <th>Updates</th>
                  <th>Strategy</th>
                </tr>
              </thead>
              <tbody>
                @for (tableName of previewTableNames(); track tableName) {
                  <tr>
                    <td>
                      <strong>{{ tableName }}</strong>
                    </td>
                    <td>{{ previewValue.tables[tableName].readCount }}</td>
                    <td>{{ previewValue.tables[tableName].insertedCount }}</td>
                    <td>{{ previewValue.tables[tableName].updatedCount }}</td>
                    <td>
                      @if (previewValue.tables[tableName].skipped) {
                        <lego-admin-status-badge tone="warning">
                          skipped heavy
                        </lego-admin-status-badge>
                      } @else {
                        <lego-admin-status-badge tone="positive">
                          sampled
                        </lego-admin-status-badge>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (previewValue.samples.length > 0) {
            <div class="admin-data-table-shell">
              <table class="admin-data-table">
                <thead>
                  <tr>
                    <th>Sample</th>
                    <th>Type</th>
                    <th>Velden</th>
                  </tr>
                </thead>
                <tbody>
                  @for (
                    sample of previewValue.samples;
                    track sample.table + sample.key
                  ) {
                    <tr>
                      <td>
                        <strong>{{ sample.table }}</strong>
                        <span class="admin-data-table__cell-meta">{{
                          sample.key
                        }}</span>
                      </td>
                      <td>{{ sample.changeType }}</td>
                      <td>{{ sample.changedFields.join(', ') }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        } @else {
          <p class="admin-muted">Diff preview laden…</p>
        }
      </section>

      <section class="admin-panel admin-stack">
        <lego-admin-section-header
          title="Promote"
          description="De enige productie-write in Admin V2. Bevestig bewust voordat de bestaande promote endpoint wordt aangeroepen."
        ></lego-admin-section-header>

        <label class="admin-field">
          <span>Bevestiging</span>
          <input
            class="admin-input"
            type="text"
            [placeholder]="confirmationPhrase"
            [ngModel]="promoteConfirmation()"
            (ngModelChange)="promoteConfirmation.set($event)"
          />
        </label>

        <button
          class="admin-button admin-button--primary"
          type="button"
          [title]="
            promoteDisabledReason() ?? 'Promote staging catalog to production'
          "
          [disabled]="promoteDisabledReason() !== null || isPromoting()"
          (click)="promoteCatalog()"
        >
          Promote staging naar productie
        </button>
        @if (promoteDisabledReason(); as disabledReason) {
          <p class="admin-inline-alert">
            Promote disabled: {{ disabledReason }}
          </p>
        }

        @if (promoteResult(); as result) {
          <div class="admin-stack">
            <p class="admin-muted">
              Promote afgerond: {{ result.status }} · {{ result.durationMs }}ms.
            </p>
            <div class="admin-metric-strip">
              <div class="admin-metric-cell">
                <span class="admin-metric-label">Catalog sets</span>
                <strong class="admin-metric-value">
                  {{ tableInserted(result, 'catalog_sets') }} new ·
                  {{ tableUpdated(result, 'catalog_sets') }} updated
                </strong>
              </div>
              <div class="admin-metric-cell">
                <span class="admin-metric-label">Source metadata</span>
                <strong class="admin-metric-value">
                  {{ tableUpserted(result, 'catalog_set_source_metadata') }}
                  rows
                </strong>
                <span class="admin-data-table__cell-meta">
                  Brickset {{ bricksetMetadataCount(result) }} · Rakuten
                  {{ rakutenMetadataCount(result) }}
                </span>
              </div>
              <div class="admin-metric-cell">
                <span class="admin-metric-label">Minifigs</span>
                <strong class="admin-metric-value">
                  {{ tableUpserted(result, 'catalog_set_minifig_summaries') }}
                  rows
                </strong>
              </div>
              <div class="admin-metric-cell">
                <span class="admin-metric-label">Affected themes</span>
                <strong class="admin-metric-value">
                  {{ affectedThemeCount(result) }}
                </strong>
                <span class="admin-data-table__cell-meta">
                  {{ affectedThemeLabel(result) }}
                </span>
              </div>
              <div class="admin-metric-cell">
                <span class="admin-metric-label">Snapshots</span>
                <strong class="admin-metric-value">
                  {{ collectionSnapshotUpsertedCount(result) }} updated
                </strong>
                <span class="admin-data-table__cell-meta">
                  {{ collectionSnapshotReadCount(result) }} read
                </span>
              </div>
              <div class="admin-metric-cell">
                <span class="admin-metric-label">Revalidation</span>
                <strong class="admin-metric-value">
                  {{ revalidationStatus(result) }}
                </strong>
                <span class="admin-data-table__cell-meta">
                  {{ result.revalidation?.pathCount ?? 0 }} paths ·
                  {{ result.revalidation?.tagCount ?? 0 }} tags
                </span>
              </div>
            </div>
            @if (result.themeSummaryRefresh) {
              <p class="admin-muted">
                Theme summaries:
                {{ result.themeSummaryRefresh.status }} ·
                {{ result.themeSummaryRefresh.affectedThemeCount }} affected.
              </p>
            }
            @if (result.revalidation?.paths?.length) {
              <p class="admin-muted">
                Revalidated paths:
                {{ revalidatedPathLabel(result) }}
              </p>
            }
            @if (result.revalidation?.tags?.length) {
              <p class="admin-muted">
                Revalidated tags:
                {{ revalidatedTagLabel(result) }}
              </p>
            }
            @if (result.revalidationWarning) {
              <p class="admin-inline-alert admin-inline-alert--danger">
                Revalidation warning: {{ result.revalidationWarning }}
              </p>
            }
          </div>
        }
      </section>
    </lego-admin-page>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommerceAdminSyncPromotePageComponent implements OnInit {
  private readonly commerceAdminApi = inject(CommerceAdminApiService);
  readonly confirmationPhrase = PROMOTE_CONFIRMATION_PHRASE;
  readonly errorMessage = signal<string | null>(null);
  readonly feedbackMessage = signal<string | null>(null);
  readonly isLoadingPreview = signal(false);
  readonly isPromoting = signal(false);
  readonly isSyncRunning = signal(false);
  readonly operationsSummary = signal<CommerceAdminOperationsSummary | null>(
    null,
  );
  readonly preview = signal<CommerceAdminPromotionPreviewResult | null>(null);
  readonly promoteConfirmation = signal('');
  readonly promoteResult = signal<CommerceAdminPromotionResult | null>(null);
  readonly promoteSecret = signal('');
  readonly runtimeConfig = signal<CommerceAdminRuntimeConfig | null>(null);
  readonly syncResult = signal<CommerceAdminProductionSyncResult | null>(null);
  readonly previewTableNames = computed(() =>
    Object.keys(this.preview()?.tables ?? {}),
  );
  readonly syncTableNames = computed(() =>
    Object.keys(this.syncResult()?.tables ?? {}),
  );
  readonly promoteDisabledReason = computed(() => {
    const preview = this.preview();

    if (!preview) {
      return 'preview unavailable';
    }

    if (preview.meaningfulPendingPromoteCount <= 0) {
      return 'no meaningful pending changes';
    }

    if (this.runtimeConfig()?.hasAdminPromotionSecret === false) {
      return 'ADMIN_PROMOTE_SECRET not configured on API';
    }

    if (this.promoteConfirmation().trim() !== PROMOTE_CONFIRMATION_PHRASE) {
      return 'confirmation phrase missing';
    }

    return null;
  });
  readonly canPromote = computed(() => this.promoteDisabledReason() === null);

  async ngOnInit(): Promise<void> {
    await this.loadPreview();
  }

  formatDate(value?: string): string {
    return formatDateTime(value);
  }

  tableInserted(
    result: CommerceAdminPromotionResult,
    tableName: string,
  ): number {
    return result.tables[tableName]?.insertedCount ?? 0;
  }

  tableUpdated(
    result: CommerceAdminPromotionResult,
    tableName: string,
  ): number {
    return result.tables[tableName]?.updatedCount ?? 0;
  }

  tableUpserted(
    result: CommerceAdminPromotionResult,
    tableName: string,
  ): number {
    return result.tables[tableName]?.upsertedCount ?? 0;
  }

  bricksetMetadataCount(result: CommerceAdminPromotionResult): number {
    return (
      result.brickset_source_metadata_promoted_count ??
      result.bricksetSourceMetadataPromotedCount ??
      0
    );
  }

  rakutenMetadataCount(result: CommerceAdminPromotionResult): number {
    return (
      result.rakuten_source_metadata_promoted_count ??
      result.rakutenSourceMetadataPromotedCount ??
      0
    );
  }

  affectedThemeCount(result: CommerceAdminPromotionResult): number {
    return (
      result.affectedThemeCount ??
      result.affectedThemeSlugs?.length ??
      result.changedThemeSlugs.length
    );
  }

  affectedThemeLabel(result: CommerceAdminPromotionResult): string {
    const themeSlugs = result.affectedThemeSlugs ?? result.changedThemeSlugs;

    if (themeSlugs.length === 0) {
      return 'Geen theme detail paths';
    }

    return themeSlugs.slice(0, 6).join(', ');
  }

  collectionSnapshotReadCount(result: CommerceAdminPromotionResult): number {
    return (
      result.collection_page_snapshots_read_count ??
      result.collectionPageSnapshotsReadCount ??
      0
    );
  }

  collectionSnapshotUpsertedCount(
    result: CommerceAdminPromotionResult,
  ): number {
    return (
      result.collection_page_snapshots_upserted_count ??
      result.collectionPageSnapshotsUpsertedCount ??
      result.tables['collection_page_snapshots']?.upsertedCount ??
      0
    );
  }

  revalidationStatus(result: CommerceAdminPromotionResult): string {
    if (result.revalidationWarning) {
      return 'warning';
    }

    if (result.revalidation?.attempted) {
      return result.revalidation.skipped ? 'skipped' : 'success';
    }

    return 'not configured';
  }

  revalidatedPathLabel(result: CommerceAdminPromotionResult): string {
    return result.revalidation?.paths.join(', ') ?? '';
  }

  revalidatedTagLabel(result: CommerceAdminPromotionResult): string {
    return result.revalidation?.tags.join(', ') ?? '';
  }

  async loadPreview(): Promise<void> {
    this.isLoadingPreview.set(true);
    this.errorMessage.set(null);

    try {
      const [preview, operationsSummary, runtimeConfig] = await Promise.all([
        this.commerceAdminApi.getCatalogPromotionPreview(),
        this.commerceAdminApi.getOperationsSummary(),
        this.commerceAdminApi.getAdminRuntimeConfig(),
      ]);

      this.preview.set(preview);
      this.operationsSummary.set(operationsSummary);
      this.runtimeConfig.set(runtimeConfig);
      console.debug('[admin-v2-sync-promote] action state', {
        currentRuntimeEnvironment:
          operationsSummary.environments.currentRuntimeEnvironment,
        hasAdminPromotionSecret: runtimeConfig.hasAdminPromotionSecret,
        meaningfulPendingPromoteCount: preview.meaningfulPendingPromoteCount,
        productionReadOnly: operationsSummary.environments.productionReadOnly,
        promoteDisabledReason: this.promoteDisabledReason(),
        writableEnvironment: operationsSummary.environments.writableEnvironment,
      });
    } catch (error) {
      this.errorMessage.set(toApiErrorMessage(error));
    } finally {
      this.isLoadingPreview.set(false);
    }
  }

  async syncProductionToStaging(dryRun: boolean): Promise<void> {
    if (!this.promoteSecret().trim()) {
      this.errorMessage.set('Vul eerst ADMIN_PROMOTE_SECRET in.');

      return;
    }

    if (
      !dryRun &&
      !globalThis.confirm(
        'Dit wist en vervangt staging commerce-data met productiegegevens. Doorgaan?',
      )
    ) {
      return;
    }

    this.isSyncRunning.set(true);
    this.errorMessage.set(null);
    this.feedbackMessage.set(null);

    try {
      this.syncResult.set(
        await this.commerceAdminApi.syncCommerceFromProduction({
          adminSecret: this.promoteSecret().trim(),
          allowDestructive: !dryRun,
          dryRun,
        }),
      );
      this.feedbackMessage.set(
        dryRun ? 'Dry-run afgerond.' : 'Staging is gesynchroniseerd.',
      );
      await this.loadPreview();
    } catch (error) {
      this.errorMessage.set(toApiErrorMessage(error));
    } finally {
      this.isSyncRunning.set(false);
    }
  }

  async promoteCatalog(): Promise<void> {
    if (!this.canPromote()) {
      this.errorMessage.set(
        `Promote kan niet worden gestart: ${this.promoteDisabledReason()}.`,
      );

      return;
    }

    this.isPromoting.set(true);
    this.errorMessage.set(null);
    this.feedbackMessage.set(null);

    try {
      this.promoteResult.set(
        await this.commerceAdminApi.promoteCatalog({
          adminSecret: this.promoteSecret().trim() || undefined,
          confirmationPhrase: this.promoteConfirmation().trim(),
        }),
      );
      this.feedbackMessage.set('Catalogus is naar productie gepromoveerd.');
      this.promoteConfirmation.set('');
      await this.loadPreview();
    } catch (error) {
      this.errorMessage.set(toApiErrorMessage(error));
    } finally {
      this.isPromoting.set(false);
    }
  }
}
