import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
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
  type AdminStatusBadgeTone,
} from '@lego-platform/admin/ui';
import {
  CommerceAdminApiService,
  type CommerceAdminCatalogImportResult,
  type CommerceAdminCatalogImportStageStatus,
  type CommerceAdminCatalogDiscoveryCandidate,
  type CommerceAdminCatalogDiscoveryCandidateConfidence,
  type CommerceAdminCatalogDiscoveryCandidateStatus,
  type CommerceAdminOperationsSummary,
} from './commerce-admin-api.service';
import {
  canRestoreDiscoveryCandidate,
  getDiscoveryCandidateRestoreDisabledReason,
  isDiscoveryCandidateSelectableForBulk,
} from './commerce-admin-discovery-candidate-actions';

type CandidateFilter =
  | CommerceAdminCatalogDiscoveryCandidateStatus
  | 'actionable'
  | 'all';
type ConfidenceFilter =
  | CommerceAdminCatalogDiscoveryCandidateConfidence
  | 'all';
type DiscoveryLaneFilter = 'merchant' | 'official';
type DiscoveryBulkProgressStatus =
  | 'completed'
  | 'failed'
  | 'pending'
  | 'running'
  | 'skipped'
  | 'warning';

interface DiscoveryBulkProgressItem {
  candidateId: string;
  enrichmentStatus?: CommerceAdminCatalogImportResult['enrichmentStatus'];
  error?: string;
  importedSlug?: string;
  setId: string;
  status: DiscoveryBulkProgressStatus;
  title: string;
  warnings: readonly string[];
}

interface MerchantDiscoverySummary {
  firstMerchantSource?: string;
  lowestPriceCurrencyCode?: string;
  lowestPriceMinor?: number;
  merchantCount: number;
  merchants: readonly {
    name: string;
    slug: string;
  }[];
}

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

function formatConfidence(
  confidence: CommerceAdminCatalogDiscoveryCandidateConfidence,
): string {
  return confidence.toUpperCase();
}

function readStringField(
  value: Readonly<Record<string, unknown>>,
  key: string,
): string | undefined {
  const fieldValue = value[key];

  return typeof fieldValue === 'string' && fieldValue.trim()
    ? fieldValue.trim()
    : undefined;
}

function statusTone(
  status: CommerceAdminCatalogDiscoveryCandidateStatus,
): AdminStatusBadgeTone {
  if (status === 'new') {
    return 'positive';
  }

  if (status === 'failed') {
    return 'danger';
  }

  if (status === 'processing' || status === 'onboarding_started') {
    return 'warning';
  }

  if (status === 'imported' || status === 'reviewed') {
    return 'neutral';
  }

  return 'warning';
}

function bulkStatusTone(
  status: DiscoveryBulkProgressStatus,
): AdminStatusBadgeTone {
  if (status === 'completed') {
    return 'positive';
  }

  if (status === 'failed') {
    return 'danger';
  }

  if (status === 'running' || status === 'warning') {
    return 'warning';
  }

  return 'neutral';
}

function getCandidateDiscoveryLane(
  candidate: CommerceAdminCatalogDiscoveryCandidate,
): DiscoveryLaneFilter {
  return candidate.source === 'merchant_discovery' ||
    candidate.evidence['discoveryLane'] === 'merchant' ||
    candidate.sourcePayload['discoveryLane'] === 'merchant'
    ? 'merchant'
    : 'official';
}

function getMerchantDiscoverySummary(
  candidate: CommerceAdminCatalogDiscoveryCandidate,
): MerchantDiscoverySummary | null {
  const merchantDiscovery = candidate.evidence['merchantDiscovery'];
  const sourcePayload = candidate.sourcePayload;
  const payload =
    merchantDiscovery && typeof merchantDiscovery === 'object'
      ? (merchantDiscovery as Readonly<Record<string, unknown>>)
      : sourcePayload;
  const merchantsValue = payload['merchants'];
  const merchants = Array.isArray(merchantsValue)
    ? merchantsValue
        .map((merchant) => {
          if (!merchant || typeof merchant !== 'object') {
            return null;
          }

          const merchantRecord = merchant as Readonly<Record<string, unknown>>;
          const slug = readStringField(merchantRecord, 'slug');
          const name = readStringField(merchantRecord, 'name') ?? slug;

          return slug && name ? { name, slug } : null;
        })
        .filter(
          (merchant): merchant is { name: string; slug: string } =>
            merchant !== null,
        )
    : [];
  const merchantCount =
    typeof payload['merchantCount'] === 'number'
      ? payload['merchantCount']
      : merchants.length;
  const lowestPriceMinor =
    typeof payload['lowestPriceMinor'] === 'number'
      ? payload['lowestPriceMinor']
      : candidate.sourcePriceMinor;
  const lowestPriceCurrencyCode =
    readStringField(payload, 'lowestPriceCurrencyCode') ??
    candidate.sourceCurrencyCode;
  const firstMerchantSource = readStringField(payload, 'firstMerchantSource');

  if (!merchantCount && merchants.length === 0) {
    return null;
  }

  return {
    firstMerchantSource,
    lowestPriceCurrencyCode,
    lowestPriceMinor,
    merchantCount,
    merchants,
  };
}

@Component({
  selector: 'lego-commerce-admin-discovery-candidates-page',
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
      title="Discovery"
      description="Review persisted catalog discovery candidates. Page load never calls Rebrickable."
    >
      <div adminPageActions>
        <button
          class="admin-button admin-button--subtle"
          type="button"
          [disabled]="
            isLoading() ||
            environmentIsReadOnly() ||
            busyAction() === 'recompute-confidence'
          "
          (click)="recomputeConfidence()"
        >
          Recompute confidence
        </button>
        <button
          class="admin-button admin-button--subtle"
          type="button"
          [disabled]="
            isLoading() ||
            environmentIsReadOnly() ||
            busyAction() === 'sync-merchant-candidates'
          "
          (click)="syncMerchantCandidates()"
        >
          Sync merchant lane
        </button>
        <button
          class="admin-button admin-button--primary"
          type="button"
          [disabled]="isLoading()"
          (click)="loadCandidates()"
        >
          Ververs
        </button>
      </div>

      @if (environmentIsReadOnly()) {
        <p class="admin-inline-alert">
          Productie is read-only. Importeren en status wijzigen zijn
          uitgeschakeld.
        </p>
      }
      @if (feedbackMessage()) {
        <p class="admin-muted">{{ feedbackMessage() }}</p>
      }
      @if (errorMessage()) {
        <p class="admin-inline-alert admin-inline-alert--danger">
          {{ errorMessage() }}
        </p>
      }
      @if (environmentSummary(); as env) {
        <p class="admin-muted">
          Runtime {{ env.environments.currentRuntimeEnvironment }} · writable
          {{ env.environments.writableEnvironment }} · production read-only
          {{ env.environments.productionReadOnly ? 'yes' : 'no' }}
        </p>
      }

      <section class="admin-panel admin-stack">
        <lego-admin-section-header
          title="Persisted candidates"
          description="Deze queue leest alleen catalog_discovery_candidates. Ontbrekende enrichment blijft zichtbaar als cached data."
        >
          <div adminSectionMeta>
            <lego-admin-status-badge tone="neutral">
              {{ candidates().length }} kandidaten
            </lego-admin-status-badge>
          </div>
        </lego-admin-section-header>

        <div
          class="admin-discovery-lanes"
          role="tablist"
          aria-label="Discovery lanes"
        >
          <button
            class="admin-discovery-lane"
            [class.admin-discovery-lane--active]="laneFilter() === 'official'"
            type="button"
            role="tab"
            [attr.aria-selected]="laneFilter() === 'official'"
            (click)="laneFilter.set('official')"
          >
            <span>Official Candidates</span>
            <strong>{{ laneCount('official') }}</strong>
          </button>
          <button
            class="admin-discovery-lane"
            [class.admin-discovery-lane--active]="laneFilter() === 'merchant'"
            type="button"
            role="tab"
            [attr.aria-selected]="laneFilter() === 'merchant'"
            (click)="laneFilter.set('merchant')"
          >
            <span>Merchant Candidates</span>
            <strong>{{ laneCount('merchant') }}</strong>
          </button>
        </div>

        <div class="admin-toolbar admin-toolbar--filters">
          <input
            class="admin-input admin-search"
            type="search"
            placeholder="Zoek op setnummer, titel of bron"
            [ngModel]="search()"
            (ngModelChange)="search.set($event)"
          />
          <select
            class="admin-input"
            [ngModel]="statusFilter()"
            (ngModelChange)="statusFilter.set($event)"
          >
            <option value="all">Alle statussen</option>
            <option value="actionable">Actionable</option>
            <option value="new">new</option>
            <option value="processing">processing</option>
            <option value="onboarding_started">onboarding started</option>
            <option value="reviewed">reviewed</option>
            <option value="imported">imported</option>
            <option value="ignored">ignored</option>
            <option value="non_set">non-set</option>
            <option value="failed">failed</option>
          </select>
          <select
            class="admin-input"
            [ngModel]="confidenceFilter()"
            (ngModelChange)="confidenceFilter.set($event)"
          >
            <option value="all">Alle confidence</option>
            <option value="high">HIGH</option>
            <option value="medium">MEDIUM</option>
            <option value="low">LOW</option>
          </select>
        </div>

        <div class="admin-metric-strip">
          <div class="admin-metric-cell">
            <span class="admin-metric-label">Nieuw</span>
            <strong class="admin-metric-value">{{ newCount() }}</strong>
          </div>
          <div class="admin-metric-cell">
            <span class="admin-metric-label">HIGH</span>
            <strong class="admin-metric-value">{{
              confidenceCount('high')
            }}</strong>
          </div>
          <div class="admin-metric-cell">
            <span class="admin-metric-label">MEDIUM</span>
            <strong class="admin-metric-value">{{
              confidenceCount('medium')
            }}</strong>
          </div>
          <div class="admin-metric-cell">
            <span class="admin-metric-label">LOW</span>
            <strong class="admin-metric-value">{{
              confidenceCount('low')
            }}</strong>
          </div>
        </div>

        <div class="admin-bulk-toolbar">
          <span class="admin-bulk-toolbar__count">
            {{ selectedCount() }} geselecteerd
          </span>
          <button
            class="admin-button admin-button--small admin-button--subtle"
            type="button"
            [disabled]="visibleBulkSelectableCandidates().length === 0"
            (click)="selectVisibleCandidates()"
          >
            Selecteer zichtbaar
          </button>
          <button
            class="admin-button admin-button--small admin-button--subtle"
            type="button"
            [disabled]="filteredBulkSelectableCandidates().length === 0"
            (click)="selectFilteredCandidates()"
          >
            Selecteer filter
          </button>
          <button
            class="admin-button admin-button--small admin-button--subtle"
            type="button"
            [disabled]="selectedCount() === 0"
            (click)="clearSelection()"
          >
            Wis selectie
          </button>
          <span class="admin-bulk-toolbar__divider"></span>
          <button
            class="admin-button admin-button--small admin-button--primary"
            type="button"
            [title]="getBulkImportDisabledReason() ?? 'Import selected'"
            [disabled]="getBulkImportDisabledReason() !== null"
            (click)="bulkImportSelected()"
          >
            Import selected
          </button>
          <button
            class="admin-button admin-button--small admin-button--subtle"
            type="button"
            [title]="getBulkReviewDisabledReason() ?? 'Ignore selected'"
            [disabled]="getBulkReviewDisabledReason() !== null"
            (click)="bulkUpdateSelectedStatus('ignored')"
          >
            Ignore selected
          </button>
          <button
            class="admin-button admin-button--small admin-button--subtle"
            type="button"
            [title]="
              getBulkReviewDisabledReason() ?? 'Mark selected as non-set'
            "
            [disabled]="getBulkReviewDisabledReason() !== null"
            (click)="bulkUpdateSelectedStatus('non_set')"
          >
            Mark non-set
          </button>
          <button
            class="admin-button admin-button--small admin-button--subtle"
            type="button"
            [title]="getBulkRestoreDisabledReason() ?? 'Restore selected'"
            [disabled]="getBulkRestoreDisabledReason() !== null"
            (click)="bulkUpdateSelectedStatus('new')"
          >
            Restore selected
          </button>
          @if (getBulkImportDisabledReason(); as bulkImportReason) {
            <span class="admin-data-table__cell-meta">
              Import disabled: {{ bulkImportReason }}
            </span>
          }
          @if (getBulkReviewDisabledReason(); as bulkReviewReason) {
            <span class="admin-data-table__cell-meta">
              Review disabled: {{ bulkReviewReason }}
            </span>
          }
          @if (getBulkRestoreDisabledReason(); as bulkRestoreReason) {
            <span class="admin-data-table__cell-meta">
              Restore disabled: {{ bulkRestoreReason }}
            </span>
          }
        </div>

        @if (bulkProgressItems().length > 0) {
          <div class="admin-bulk-progress">
            <div class="admin-bulk-progress__summary">
              <strong>{{ bulkProgressSummary() }}</strong>
              <span class="admin-muted"
                >Concurrency 1 · geen commerce sync</span
              >
            </div>
            <div class="admin-bulk-progress__list">
              @for (item of bulkProgressItems(); track item.candidateId) {
                <div class="admin-bulk-progress__item">
                  <lego-admin-status-badge [tone]="bulkStatusTone(item.status)">
                    {{ item.status }}
                  </lego-admin-status-badge>
                  <div>
                    <strong>{{ item.setId }}</strong>
                    <span>{{ item.title }}</span>
                    @if (item.importedSlug) {
                      <span class="admin-data-table__cell-meta">
                        {{ item.importedSlug }}
                      </span>
                    }
                    @if (item.enrichmentStatus) {
                      <span class="admin-data-table__cell-meta">
                        enrichment {{ item.enrichmentStatus }}
                      </span>
                    }
                    @if (item.warnings.length > 0) {
                      <span class="admin-data-table__cell-meta">
                        waarschuwing: {{ item.warnings.join(', ') }}
                      </span>
                    }
                    @if (item.error) {
                      <span class="admin-data-table__cell-meta">
                        fout: {{ item.error }}
                      </span>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <div class="admin-data-table-shell">
          <table class="admin-data-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="Select all visible candidates"
                    [checked]="allVisibleCandidatesSelected()"
                    [indeterminate]="visibleSelectionIsPartial()"
                    [disabled]="visibleBulkSelectableCandidates().length === 0"
                    (click)="$event.stopPropagation()"
                    (change)="toggleVisibleSelection($event)"
                  />
                </th>
                <th>Set</th>
                <th>Title</th>
                <th>Source</th>
                <th>Confidence</th>
                <th>Reasons</th>
                <th>Status</th>
                <th>Image</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (candidate of filteredCandidates(); track candidate.id) {
                <tr
                  class="admin-discovery-row"
                  tabindex="0"
                  (click)="viewDetails(candidate)"
                  (keydown.enter)="viewDetails(candidate)"
                >
                  <td>
                    <input
                      type="checkbox"
                      [attr.aria-label]="'Select ' + candidate.normalizedSetId"
                      [checked]="isSelected(candidate)"
                      [disabled]="!isCandidateSelectableForBulk(candidate)"
                      (click)="$event.stopPropagation()"
                      (change)="toggleCandidateSelection(candidate, $event)"
                    />
                  </td>
                  <td>
                    <strong>{{ candidate.normalizedSetId }}</strong>
                    <span class="admin-data-table__cell-meta">
                      {{ candidate.sourceSetNumber }}
                    </span>
                  </td>
                  <td>
                    <span class="admin-data-table__cell-title">
                      {{ getCandidateTitle(candidate) }}
                    </span>
                    @if (!candidate.rebrickablePayload) {
                      <span class="admin-data-table__cell-meta">
                        Cached Rebrickable enrichment ontbreekt.
                      </span>
                    }
                  </td>
                  <td>
                    <strong>{{ getLaneLabel(candidate) }}</strong>
                    <span class="admin-data-table__cell-meta">
                      {{ candidate.source }}
                    </span>
                    @if (getMerchantSummary(candidate); as merchantSummary) {
                      <span class="admin-data-table__cell-meta">
                        {{ merchantSummary.merchantCount }} merchants ·
                        {{ formatMerchantPrice(merchantSummary) }} · first
                        {{ merchantSummary.firstMerchantSource || 'unknown' }}
                      </span>
                      @if (merchantSummary.merchants.length > 0) {
                        <span class="admin-data-table__cell-meta">
                          {{ formatMerchantNames(merchantSummary) }}
                        </span>
                      }
                    }
                  </td>
                  <td>
                    <strong>{{
                      formatConfidence(candidate.operatorConfidence)
                    }}</strong>
                    <span class="admin-data-table__cell-meta">
                      auto-create {{ formatConfidence(candidate.confidence) }}
                    </span>
                  </td>
                  <td>
                    @if (candidate.operatorConfidenceReasons.length > 0) {
                      <div class="admin-discovery-reasons">
                        @for (
                          reason of candidate.operatorConfidenceReasons;
                          track reason
                        ) {
                          <code>{{ reason }}</code>
                        }
                      </div>
                    } @else {
                      <span class="admin-muted">Geen reason</span>
                    }
                  </td>
                  <td>
                    <lego-admin-status-badge
                      [tone]="statusTone(candidate.status)"
                    >
                      {{ displayStatus(candidate.status) }}
                    </lego-admin-status-badge>
                    @if (getImportResult(candidate); as importResult) {
                      <span class="admin-data-table__cell-meta">
                        enrichment
                        {{ importResult.enrichmentStatus || 'unknown' }}
                      </span>
                    }
                  </td>
                  <td>
                    @if (getCandidateImageUrl(candidate); as imageUrl) {
                      <img
                        class="admin-discovery-image"
                        [src]="imageUrl"
                        alt=""
                      />
                    } @else {
                      <span class="admin-muted">Geen image</span>
                    }
                  </td>
                  <td class="admin-actions-inline">
                    @if (isProcessingCandidate(candidate)) {
                      <span class="admin-muted">
                        Onboarding gestart
                        @if (getBulkOnboardingRunId(candidate); as runId) {
                          · {{ runId }}
                        }
                      </span>
                    } @else {
                      <button
                        class="admin-button admin-button--small admin-button--primary"
                        type="button"
                        [title]="
                          getImportDisabledReason(candidate) ??
                          'Import candidate'
                        "
                        [disabled]="
                          getImportDisabledReason(candidate) !== null ||
                          busyAction() === 'import:' + candidate.id
                        "
                        (click)="
                          importCandidate(candidate); $event.stopPropagation()
                        "
                      >
                        {{
                          candidate.status === 'failed'
                            ? 'Retry import'
                            : 'Import'
                        }}
                      </button>
                    }
                    <button
                      class="admin-button admin-button--small admin-button--subtle"
                      type="button"
                      [title]="
                        getStatusActionDisabledReason(candidate) ??
                        'Ignore candidate'
                      "
                      [disabled]="
                        getStatusActionDisabledReason(candidate) !== null
                      "
                      (click)="
                        updateStatus(candidate, 'ignored');
                        $event.stopPropagation()
                      "
                    >
                      Ignore
                    </button>
                    <button
                      class="admin-button admin-button--small admin-button--subtle"
                      type="button"
                      [title]="
                        getStatusActionDisabledReason(candidate) ??
                        'Mark as non-set'
                      "
                      [disabled]="
                        getStatusActionDisabledReason(candidate) !== null
                      "
                      (click)="
                        updateStatus(candidate, 'non_set');
                        $event.stopPropagation()
                      "
                    >
                      Non-set
                    </button>
                    @if (canRestoreCandidate(candidate)) {
                      <button
                        class="admin-button admin-button--small admin-button--subtle"
                        type="button"
                        [title]="
                          getRestoreDisabledReason(candidate) ??
                          'Restore candidate'
                        "
                        [disabled]="
                          getRestoreDisabledReason(candidate) !== null
                        "
                        (click)="
                          updateStatus(candidate, 'new');
                          $event.stopPropagation()
                        "
                      >
                        Restore
                      </button>
                    }
                    @if (getImportDisabledReason(candidate); as importReason) {
                      <span class="admin-data-table__cell-meta">
                        Import disabled: {{ importReason }}
                      </span>
                    }
                    @if (
                      getStatusActionDisabledReason(candidate);
                      as statusReason
                    ) {
                      <span class="admin-data-table__cell-meta">
                        Review disabled: {{ statusReason }}
                      </span>
                    }
                    @if (
                      canRestoreCandidate(candidate) &&
                        getRestoreDisabledReason(candidate);
                      as restoreReason
                    ) {
                      <span class="admin-data-table__cell-meta">
                        Restore disabled: {{ restoreReason }}
                      </span>
                    }
                    <button
                      class="admin-button admin-button--small admin-button--subtle"
                      type="button"
                      (click)="viewDetails(candidate); $event.stopPropagation()"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              }
              @if (filteredCandidates().length === 0) {
                <tr>
                  <td class="admin-table__empty" colspan="9">
                    Geen persisted discovery candidates gevonden.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      @if (selectedCandidate(); as candidate) {
        <div
          class="admin-discovery-drawer-backdrop"
          role="presentation"
          (click)="closeDetails()"
        ></div>
        <aside
          class="admin-discovery-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Discovery candidate details"
        >
          <div class="admin-discovery-drawer__header">
            <div>
              <p class="admin-muted">Discovery candidate</p>
              <h2>{{ candidate.normalizedSetId }}</h2>
            </div>
            <button
              class="admin-button admin-button--subtle"
              type="button"
              aria-label="Close details"
              (click)="closeDetails()"
            >
              X
            </button>
          </div>

          <dl class="admin-discovery-drawer__meta">
            <dt>Title</dt>
            <dd>{{ getCandidateTitle(candidate) }}</dd>
            <dt>Source</dt>
            <dd>{{ candidate.source }}</dd>
            <dt>Lane</dt>
            <dd>{{ getLaneLabel(candidate) }}</dd>
            @if (getMerchantSummary(candidate); as merchantSummary) {
              <dt>Merchants</dt>
              <dd>
                {{ merchantSummary.merchantCount }} ·
                {{ formatMerchantPrice(merchantSummary) }} · first
                {{ merchantSummary.firstMerchantSource || 'unknown' }}
              </dd>
            }
            <dt>Strict confidence</dt>
            <dd>{{ formatConfidence(candidate.confidence) }}</dd>
            <dt>Operator confidence</dt>
            <dd>{{ formatConfidence(candidate.operatorConfidence) }}</dd>
            <dt>Status</dt>
            <dd>{{ displayStatus(candidate.status) }}</dd>
            <dt>Bulk run</dt>
            <dd>
              {{ getBulkOnboardingRunId(candidate) || 'Geen linked run' }}
            </dd>
            <dt>Import error</dt>
            <dd>{{ candidate.importError || 'Geen fout' }}</dd>
            <dt>Imported set</dt>
            <dd>{{ getImportedSetLabel(candidate) }}</dd>
          </dl>

          @if (getImportResult(candidate); as importResult) {
            <section class="admin-stack">
              <h3>Import pipeline</h3>
              <ol class="admin-discovery-pipeline">
                <li>
                  <lego-admin-status-badge tone="positive">
                    Catalog set created
                  </lego-admin-status-badge>
                  <span>{{
                    importResult.importedSetId || candidate.importedSetId
                  }}</span>
                </li>
                <li>
                  <lego-admin-status-badge
                    [tone]="stageTone(importResult.bricksetStatus)"
                  >
                    Brickset
                    {{ displayStageStatus(importResult.bricksetStatus) }}
                  </lego-admin-status-badge>
                  <span>{{ getStageWarning(importResult, 'brickset') }}</span>
                </li>
                <li>
                  <lego-admin-status-badge
                    [tone]="stageTone(importResult.minifigStatus)"
                  >
                    Minifigs
                    {{ displayStageStatus(importResult.minifigStatus) }}
                  </lego-admin-status-badge>
                  <span>{{ getStageWarning(importResult, 'minifig') }}</span>
                </li>
                <li>
                  <lego-admin-status-badge
                    [tone]="stageTone(importResult.themeStatus)"
                  >
                    Theme mappings
                    {{ displayStageStatus(importResult.themeStatus) }}
                  </lego-admin-status-badge>
                  <span>{{ getStageWarning(importResult, 'theme') }}</span>
                </li>
              </ol>
              @if (importResult.warnings?.length) {
                <div class="admin-discovery-warnings">
                  @for (warning of importResult.warnings; track warning) {
                    <p>{{ warning }}</p>
                  }
                </div>
              }
            </section>
          }

          <section class="admin-stack">
            <h3>Reason labels</h3>
            @if (candidate.operatorConfidenceReasons.length > 0) {
              <div class="admin-discovery-reasons">
                @for (
                  reason of candidate.operatorConfidenceReasons;
                  track reason
                ) {
                  <code>{{ reason }}</code>
                }
              </div>
            } @else {
              <p class="admin-muted">Geen reason labels.</p>
            }
          </section>

          @if (candidate.sourceProductUrl) {
            <a
              class="admin-button admin-button--subtle"
              [href]="candidate.sourceProductUrl"
              target="_blank"
              rel="noreferrer"
            >
              Open source URL
            </a>
          }

          @if (getBulkOnboardingRunId(candidate); as runId) {
            <a class="admin-button admin-button--subtle" href="/catalog-intake">
              Open Catalog Intake · {{ runId }}
            </a>
          }

          <section class="admin-stack">
            <h3>Evidence / cached payload</h3>
            <pre class="admin-pre">{{ stringifyCandidate(candidate) }}</pre>
          </section>
        </aside>
      }
    </lego-admin-page>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .admin-discovery-lanes {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .admin-discovery-lane {
        align-items: center;
        background: var(--admin-surface-muted);
        border: 1px solid var(--admin-border-subtle, #d9dee8);
        border-radius: 0.375rem;
        color: var(--admin-text, #0f172a);
        cursor: pointer;
        display: inline-flex;
        gap: 0.5rem;
        min-height: 2.25rem;
        padding: 0.35rem 0.65rem;
      }

      .admin-discovery-lane--active {
        background: var(--admin-surface, #fff);
        border-color: var(--admin-focus-ring, #2563eb);
      }

      .admin-discovery-image {
        aspect-ratio: 1;
        background: var(--admin-surface-muted);
        border-radius: 0.375rem;
        height: 3rem;
        object-fit: contain;
        width: 3rem;
      }

      .admin-discovery-row {
        cursor: pointer;
      }

      .admin-discovery-row:focus-visible {
        outline: 2px solid var(--admin-focus-ring, #2563eb);
        outline-offset: -2px;
      }

      .admin-bulk-toolbar {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .admin-bulk-toolbar__count {
        color: var(--admin-text-muted, #64748b);
        font-size: 0.78rem;
        font-weight: 700;
      }

      .admin-bulk-toolbar__divider {
        background: var(--admin-border-subtle, #d9dee8);
        height: 1.5rem;
        width: 1px;
      }

      .admin-bulk-progress {
        background: var(--admin-surface-muted);
        border-radius: 0.375rem;
        display: grid;
        gap: 0.75rem;
        padding: 0.75rem;
      }

      .admin-bulk-progress__summary {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        justify-content: space-between;
      }

      .admin-bulk-progress__list {
        display: grid;
        gap: 0.4rem;
        max-height: 16rem;
        overflow: auto;
      }

      .admin-bulk-progress__item {
        align-items: start;
        background: var(--admin-surface, #fff);
        border-radius: 0.25rem;
        display: grid;
        gap: 0.5rem;
        grid-template-columns: max-content minmax(0, 1fr);
        padding: 0.5rem;
      }

      .admin-bulk-progress__item div {
        display: grid;
        gap: 0.15rem;
        min-width: 0;
      }

      .admin-pre {
        overflow: auto;
        white-space: pre-wrap;
      }

      .admin-discovery-reasons {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
      }

      .admin-discovery-reasons code {
        background: var(--admin-surface-muted);
        border-radius: 0.25rem;
        font-size: 0.68rem;
        padding: 0.1rem 0.25rem;
      }

      .admin-discovery-pipeline {
        display: grid;
        gap: 0.5rem;
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .admin-discovery-pipeline li {
        align-items: center;
        display: grid;
        gap: 0.5rem;
        grid-template-columns: max-content minmax(0, 1fr);
      }

      .admin-discovery-warnings {
        background: var(--admin-surface-muted);
        border-radius: 0.375rem;
        display: grid;
        gap: 0.25rem;
        padding: 0.5rem;
      }

      .admin-discovery-warnings p {
        margin: 0;
      }

      .admin-discovery-drawer-backdrop {
        background: rgb(15 23 42 / 0.18);
        inset: 0;
        position: fixed;
        z-index: 20;
      }

      .admin-discovery-drawer {
        background: var(--admin-surface, #fff);
        border-left: 1px solid var(--admin-border-subtle, #d9dee8);
        bottom: 0;
        box-shadow: -12px 0 30px rgb(15 23 42 / 0.18);
        display: grid;
        gap: 1rem;
        max-width: min(34rem, 92vw);
        overflow: auto;
        padding: 1rem;
        position: fixed;
        right: 0;
        top: 0;
        width: 34rem;
        z-index: 21;
      }

      .admin-discovery-drawer__header {
        align-items: start;
        display: flex;
        gap: 1rem;
        justify-content: space-between;
      }

      .admin-discovery-drawer__header h2 {
        font-size: 1.1rem;
        margin: 0;
      }

      .admin-discovery-drawer__meta {
        display: grid;
        gap: 0.4rem 0.75rem;
        grid-template-columns: max-content minmax(0, 1fr);
      }

      .admin-discovery-drawer__meta dt {
        color: var(--admin-text-muted, #64748b);
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
      }

      .admin-discovery-drawer__meta dd {
        margin: 0;
        min-width: 0;
        overflow-wrap: anywhere;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommerceAdminDiscoveryCandidatesPageComponent implements OnInit {
  private readonly commerceAdminApi = inject(CommerceAdminApiService);
  readonly busyAction = signal<string | null>(null);
  readonly bulkProgressItems = signal<DiscoveryBulkProgressItem[]>([]);
  readonly candidates = signal<CommerceAdminCatalogDiscoveryCandidate[]>([]);
  readonly environmentIsReadOnly = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly environmentSummary = signal<CommerceAdminOperationsSummary | null>(
    null,
  );
  readonly feedbackMessage = signal<string | null>(null);
  readonly isLoading = signal(false);
  readonly search = signal('');
  readonly confidenceFilter = signal<ConfidenceFilter>('all');
  readonly laneFilter = signal<DiscoveryLaneFilter>('official');
  readonly selectedCandidate =
    signal<CommerceAdminCatalogDiscoveryCandidate | null>(null);
  readonly statusFilter = signal<CandidateFilter>('actionable');
  readonly filteredCandidates = computed(() => {
    const query = this.search().trim().toLowerCase();
    const statusFilter = this.statusFilter();
    const confidenceFilter = this.confidenceFilter();

    return this.candidates()
      .filter((candidate) => {
        if (getCandidateDiscoveryLane(candidate) !== this.laneFilter()) {
          return false;
        }

        if (
          statusFilter === 'actionable' &&
          !['failed', 'new', 'onboarding_started', 'processing'].includes(
            candidate.status,
          )
        ) {
          return false;
        }

        if (
          statusFilter !== 'all' &&
          statusFilter !== 'actionable' &&
          candidate.status !== statusFilter
        ) {
          return false;
        }

        if (
          confidenceFilter !== 'all' &&
          candidate.operatorConfidence !== confidenceFilter
        ) {
          return false;
        }

        return (
          !query ||
          candidate.normalizedSetId.toLowerCase().includes(query) ||
          candidate.sourceSetNumber.toLowerCase().includes(query) ||
          candidate.source.toLowerCase().includes(query) ||
          this.getLaneLabel(candidate).toLowerCase().includes(query) ||
          (this.getMerchantSummary(candidate)?.merchants.some(
            (merchant) =>
              merchant.name.toLowerCase().includes(query) ||
              merchant.slug.toLowerCase().includes(query),
          ) ??
            false) ||
          (candidate.sourceProductTitle ?? '').toLowerCase().includes(query)
        );
      })
      .sort((left, right) => {
        const confidenceOrder = {
          high: 0,
          medium: 1,
          low: 2,
        } as const;

        return (
          confidenceOrder[left.operatorConfidence] -
            confidenceOrder[right.operatorConfidence] ||
          right.lastSeenAt.localeCompare(left.lastSeenAt) ||
          left.normalizedSetId.localeCompare(right.normalizedSetId)
        );
      });
  });
  readonly filteredBulkSelectableCandidates = computed(() =>
    this.filteredCandidates().filter((candidate) =>
      this.isCandidateSelectableForBulk(candidate),
    ),
  );
  readonly visibleBulkSelectableCandidates = computed(() =>
    this.filteredBulkSelectableCandidates(),
  );
  readonly selectedCandidateIds = signal<ReadonlySet<string>>(new Set());
  readonly selectedCandidates = computed(() => {
    const selectedIds = this.selectedCandidateIds();

    return this.candidates().filter((candidate) =>
      selectedIds.has(candidate.id),
    );
  });
  readonly selectedCount = computed(() => this.selectedCandidates().length);
  readonly bulkProgressSummary = computed(() => {
    const items = this.bulkProgressItems();
    const count = (status: DiscoveryBulkProgressStatus) =>
      items.filter((item) => item.status === status).length;

    return [
      `${count('completed')} completed`,
      `${count('warning')} warning`,
      `${count('failed')} failed`,
      `${count('running')} running`,
      `${count('pending')} pending`,
      `${count('skipped')} skipped`,
    ].join(' · ');
  });
  readonly newCount = computed(
    () =>
      this.candidates().filter(
        (candidate) =>
          candidate.status === 'new' &&
          getCandidateDiscoveryLane(candidate) === this.laneFilter(),
      ).length,
  );

  async ngOnInit(): Promise<void> {
    await this.loadCandidates();
  }

  @HostListener('document:keydown.escape')
  closeDetailsOnEscape(): void {
    this.closeDetails();
  }

  canImportCandidate(
    candidate: CommerceAdminCatalogDiscoveryCandidate,
  ): boolean {
    return this.getImportDisabledReason(candidate) === null;
  }

  isCandidateSelectableForBulk(
    candidate: CommerceAdminCatalogDiscoveryCandidate,
  ): boolean {
    return isDiscoveryCandidateSelectableForBulk(candidate);
  }

  isSelected(candidate: CommerceAdminCatalogDiscoveryCandidate): boolean {
    return this.selectedCandidateIds().has(candidate.id);
  }

  allVisibleCandidatesSelected(): boolean {
    const visibleCandidates = this.visibleBulkSelectableCandidates();

    return (
      visibleCandidates.length > 0 &&
      visibleCandidates.every((candidate) => this.isSelected(candidate))
    );
  }

  visibleSelectionIsPartial(): boolean {
    const visibleCandidates = this.visibleBulkSelectableCandidates();
    const selectedVisibleCount = visibleCandidates.filter((candidate) =>
      this.isSelected(candidate),
    ).length;

    return (
      selectedVisibleCount > 0 &&
      selectedVisibleCount < visibleCandidates.length
    );
  }

  toggleVisibleSelection(event: Event): void {
    const checked =
      event.target instanceof HTMLInputElement && event.target.checked;

    if (checked) {
      this.selectVisibleCandidates();
    } else {
      this.clearVisibleSelection();
    }
  }

  toggleCandidateSelection(
    candidate: CommerceAdminCatalogDiscoveryCandidate,
    event: Event,
  ): void {
    const checked =
      event.target instanceof HTMLInputElement && event.target.checked;
    const selectedIds = new Set(this.selectedCandidateIds());

    if (checked) {
      selectedIds.add(candidate.id);
    } else {
      selectedIds.delete(candidate.id);
    }

    this.selectedCandidateIds.set(selectedIds);
  }

  selectVisibleCandidates(): void {
    this.addCandidatesToSelection(this.visibleBulkSelectableCandidates());
  }

  selectFilteredCandidates(): void {
    this.addCandidatesToSelection(this.filteredBulkSelectableCandidates());
  }

  clearVisibleSelection(): void {
    const selectedIds = new Set(this.selectedCandidateIds());

    for (const candidate of this.visibleBulkSelectableCandidates()) {
      selectedIds.delete(candidate.id);
    }

    this.selectedCandidateIds.set(selectedIds);
  }

  clearSelection(): void {
    this.selectedCandidateIds.set(new Set());
  }

  private addCandidatesToSelection(
    candidates: readonly CommerceAdminCatalogDiscoveryCandidate[],
  ): void {
    const selectedIds = new Set(this.selectedCandidateIds());

    for (const candidate of candidates) {
      selectedIds.add(candidate.id);
    }

    this.selectedCandidateIds.set(selectedIds);
  }

  private removeCandidateFromSelection(candidateId: string): void {
    const selectedIds = new Set(this.selectedCandidateIds());
    selectedIds.delete(candidateId);
    this.selectedCandidateIds.set(selectedIds);
  }

  getImportDisabledReason(
    candidate: CommerceAdminCatalogDiscoveryCandidate,
  ): string | null {
    if (this.environmentIsReadOnly()) {
      return 'writable environment is not staging';
    }

    if (candidate.status !== 'new' && candidate.status !== 'failed') {
      return `status is ${candidate.status}`;
    }

    if (!/^\d{5,6}$/.test(candidate.normalizedSetId)) {
      return 'set number is invalid or missing';
    }

    return null;
  }

  getStatusActionDisabledReason(
    candidate: CommerceAdminCatalogDiscoveryCandidate,
  ): string | null {
    if (this.environmentIsReadOnly()) {
      return 'writable environment is not staging';
    }

    if (candidate.status !== 'new') {
      return `status is ${candidate.status}`;
    }

    return null;
  }

  canRestoreCandidate(
    candidate: CommerceAdminCatalogDiscoveryCandidate,
  ): boolean {
    return canRestoreDiscoveryCandidate(candidate);
  }

  getRestoreDisabledReason(
    candidate: CommerceAdminCatalogDiscoveryCandidate,
  ): string | null {
    return getDiscoveryCandidateRestoreDisabledReason({
      candidate,
      environmentIsReadOnly: this.environmentIsReadOnly(),
    });
  }

  getBulkImportDisabledReason(): string | null {
    if (this.environmentIsReadOnly()) {
      return 'writable environment is not staging';
    }

    if (this.busyAction()) {
      return `action ${this.busyAction()} is already running`;
    }

    if (this.selectedCount() === 0) {
      return 'no candidates selected';
    }

    const importableCount = this.selectedCandidates().filter(
      (candidate) => this.getImportDisabledReason(candidate) === null,
    ).length;

    if (importableCount === 0) {
      return 'no selected candidate can be imported';
    }

    return null;
  }

  getBulkReviewDisabledReason(): string | null {
    if (this.environmentIsReadOnly()) {
      return 'writable environment is not staging';
    }

    if (this.busyAction()) {
      return `action ${this.busyAction()} is already running`;
    }

    if (this.selectedCount() === 0) {
      return 'no candidates selected';
    }

    const reviewableCount = this.selectedCandidates().filter(
      (candidate) => this.getStatusActionDisabledReason(candidate) === null,
    ).length;

    if (reviewableCount === 0) {
      return 'no selected candidate can be reviewed';
    }

    return null;
  }

  getBulkRestoreDisabledReason(): string | null {
    if (this.environmentIsReadOnly()) {
      return 'writable environment is not staging';
    }

    if (this.busyAction()) {
      return `action ${this.busyAction()} is already running`;
    }

    if (this.selectedCount() === 0) {
      return 'no candidates selected';
    }

    const restorableCount = this.selectedCandidates().filter(
      (candidate) => this.getRestoreDisabledReason(candidate) === null,
    ).length;

    if (restorableCount === 0) {
      return 'no selected candidate can be restored';
    }

    return null;
  }

  bulkStatusTone = bulkStatusTone;

  isProcessingCandidate(
    candidate: CommerceAdminCatalogDiscoveryCandidate,
  ): boolean {
    return (
      candidate.status === 'processing' ||
      candidate.status === 'onboarding_started'
    );
  }

  confidenceCount(
    confidence: CommerceAdminCatalogDiscoveryCandidateConfidence,
  ): number {
    return this.candidates().filter(
      (candidate) =>
        candidate.operatorConfidence === confidence &&
        getCandidateDiscoveryLane(candidate) === this.laneFilter(),
    ).length;
  }

  laneCount(lane: DiscoveryLaneFilter): number {
    return this.candidates().filter(
      (candidate) => getCandidateDiscoveryLane(candidate) === lane,
    ).length;
  }

  getLaneLabel(candidate: CommerceAdminCatalogDiscoveryCandidate): string {
    return getCandidateDiscoveryLane(candidate) === 'merchant'
      ? 'Merchant'
      : 'Official';
  }

  getMerchantSummary(
    candidate: CommerceAdminCatalogDiscoveryCandidate,
  ): MerchantDiscoverySummary | null {
    return getMerchantDiscoverySummary(candidate);
  }

  formatMerchantPrice(summary: MerchantDiscoverySummary): string {
    if (typeof summary.lowestPriceMinor !== 'number') {
      return 'geen prijs';
    }

    return new Intl.NumberFormat('nl-NL', {
      currency: summary.lowestPriceCurrencyCode ?? 'EUR',
      style: 'currency',
    }).format(summary.lowestPriceMinor / 100);
  }

  formatMerchantNames(summary: MerchantDiscoverySummary): string {
    return summary.merchants
      .slice(0, 4)
      .map((merchant) => merchant.name)
      .join(', ');
  }

  displayStatus(status: CommerceAdminCatalogDiscoveryCandidateStatus): string {
    return status === 'rejected' ? 'non-set' : status.replace('_', '-');
  }

  formatConfidence = formatConfidence;
  statusTone = statusTone;

  getCandidateTitle(candidate: CommerceAdminCatalogDiscoveryCandidate): string {
    const payloadName = candidate.rebrickablePayload?.['name'];

    if (candidate.sourceProductTitle) {
      return candidate.sourceProductTitle;
    }

    return typeof payloadName === 'string' && payloadName.trim()
      ? payloadName
      : 'Geen titel';
  }

  getCandidateImageUrl(
    candidate: CommerceAdminCatalogDiscoveryCandidate,
  ): string | null {
    const payloadImageUrl = candidate.rebrickablePayload?.['imageUrl'];

    if (candidate.sourceImageUrl) {
      return candidate.sourceImageUrl;
    }

    return typeof payloadImageUrl === 'string' && payloadImageUrl.trim()
      ? payloadImageUrl
      : null;
  }

  getBulkOnboardingRunId(
    candidate: CommerceAdminCatalogDiscoveryCandidate,
  ): string | null {
    const runId = candidate.evidence['bulkOnboardingRunId'];

    return typeof runId === 'string' && runId.trim() ? runId : null;
  }

  getImportResult(
    candidate: CommerceAdminCatalogDiscoveryCandidate,
  ): CommerceAdminCatalogImportResult | null {
    const importResult = candidate.evidence['importResult'];

    return typeof importResult === 'object' && importResult
      ? (importResult as CommerceAdminCatalogImportResult)
      : null;
  }

  getImportedSetLabel(
    candidate: CommerceAdminCatalogDiscoveryCandidate,
  ): string {
    const importResult = this.getImportResult(candidate);
    const importedSetId =
      importResult?.importedSetId ?? candidate.importedSetId;
    const importedSlug = importResult?.importedSlug;

    if (!importedSetId) {
      return 'Nog niet geimporteerd';
    }

    return importedSlug ? `${importedSetId} · ${importedSlug}` : importedSetId;
  }

  displayStageStatus(
    status: CommerceAdminCatalogImportStageStatus | undefined,
  ): string {
    return status ?? 'unknown';
  }

  stageTone(
    status: CommerceAdminCatalogImportStageStatus | undefined,
  ): AdminStatusBadgeTone {
    if (status === 'success') {
      return 'positive';
    }

    if (status === 'failed') {
      return 'danger';
    }

    return 'neutral';
  }

  getStageWarning(
    importResult: CommerceAdminCatalogImportResult,
    stage: 'brickset' | 'minifig' | 'theme',
  ): string {
    return importResult.stages?.[stage]?.warning ?? 'OK';
  }

  async loadCandidates(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      const [summary, candidates] = await Promise.all([
        this.commerceAdminApi.getOperationsSummary(),
        this.commerceAdminApi.listCatalogDiscoveryCandidates({
          status: 'all',
        }),
      ]);

      this.environmentSummary.set(summary);
      this.environmentIsReadOnly.set(
        summary.environments.writableEnvironment !== 'staging',
      );
      this.candidates.set(candidates);
      console.debug('[admin-v2-discovery] action state', {
        currentRuntimeEnvironment:
          summary.environments.currentRuntimeEnvironment,
        productionReadOnly: summary.environments.productionReadOnly,
        writableEnvironment: summary.environments.writableEnvironment,
        disabledCandidates: candidates
          .map((candidate) => ({
            id: candidate.id,
            importDisabledReason: this.getImportDisabledReason(candidate),
            normalizedSetId: candidate.normalizedSetId,
            operatorConfidence: candidate.operatorConfidence,
            restoreDisabledReason: this.getRestoreDisabledReason(candidate),
            status: candidate.status,
            statusActionDisabledReason:
              this.getStatusActionDisabledReason(candidate),
          }))
          .filter(
            (candidate) =>
              candidate.importDisabledReason ||
              candidate.restoreDisabledReason ||
              candidate.statusActionDisabledReason,
          ),
      });
    } catch (error) {
      this.errorMessage.set(toApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  async importCandidate(
    candidate: CommerceAdminCatalogDiscoveryCandidate,
  ): Promise<void> {
    if (
      candidate.operatorConfidence === 'low' &&
      !window.confirm(
        `Import ${candidate.normalizedSetId} met LOW confidence? Controleer titel en bron voordat je doorgaat.`,
      )
    ) {
      return;
    }

    this.busyAction.set(`import:${candidate.id}`);
    this.feedbackMessage.set(null);
    this.errorMessage.set(null);

    try {
      await this.commerceAdminApi.importCatalogDiscoveryCandidate(candidate.id);
      this.feedbackMessage.set('Discovery candidate geimporteerd.');
      await this.loadCandidates();
    } catch (error) {
      const errorMessage = toApiErrorMessage(error);
      this.statusFilter.set('failed');
      await this.loadCandidates();
      this.errorMessage.set(errorMessage);
    } finally {
      this.busyAction.set(null);
    }
  }

  async bulkImportSelected(): Promise<void> {
    const disabledReason = this.getBulkImportDisabledReason();

    if (disabledReason) {
      this.errorMessage.set(`Import disabled: ${disabledReason}`);
      return;
    }

    const selectedCandidates = this.selectedCandidates();
    const lowConfidenceCandidates = selectedCandidates.filter(
      (candidate) =>
        candidate.operatorConfidence === 'low' &&
        this.getImportDisabledReason(candidate) === null,
    );

    if (
      lowConfidenceCandidates.length > 0 &&
      !window.confirm(
        `Import ${lowConfidenceCandidates.length} LOW confidence candidates? Controleer titel en bron voordat je doorgaat.`,
      )
    ) {
      return;
    }

    this.busyAction.set('bulk-import');
    this.feedbackMessage.set(null);
    this.errorMessage.set(null);
    this.bulkProgressItems.set(
      selectedCandidates.map((candidate) => ({
        candidateId: candidate.id,
        setId: candidate.normalizedSetId,
        status: 'pending',
        title: this.getCandidateTitle(candidate),
        warnings: [],
      })),
    );

    for (const candidate of selectedCandidates) {
      const skipReason = this.getImportDisabledReason(candidate);

      if (skipReason) {
        this.updateBulkProgressItem(candidate.id, {
          error: skipReason,
          status: 'skipped',
          warnings: [skipReason],
        });
        continue;
      }

      this.updateBulkProgressItem(candidate.id, { status: 'running' });

      try {
        const importedCandidate =
          await this.commerceAdminApi.importCatalogDiscoveryCandidate(
            candidate.id,
          );
        const importResult = this.getImportResult(importedCandidate);
        const warnings = importResult?.warnings ?? [];
        const status =
          warnings.length > 0 || importResult?.enrichmentStatus === 'partial'
            ? 'warning'
            : 'completed';

        this.replaceCandidate(importedCandidate);
        this.removeCandidateFromSelection(candidate.id);
        this.updateBulkProgressItem(candidate.id, {
          enrichmentStatus: importResult?.enrichmentStatus,
          importedSlug: importResult?.importedSlug,
          setId: importedCandidate.normalizedSetId,
          status,
          title: this.getCandidateTitle(importedCandidate),
          warnings,
        });
      } catch (error) {
        this.updateBulkProgressItem(candidate.id, {
          error: toApiErrorMessage(error),
          status: 'failed',
        });
      }
    }

    await this.loadCandidates();
    this.feedbackMessage.set(
      `Bulk import klaar. ${this.bulkProgressSummary()}`,
    );
    this.busyAction.set(null);
  }

  async bulkUpdateSelectedStatus(
    status: 'ignored' | 'new' | 'non_set',
  ): Promise<void> {
    const isRestoreAction = status === 'new';
    const disabledReason = isRestoreAction
      ? this.getBulkRestoreDisabledReason()
      : this.getBulkReviewDisabledReason();

    if (disabledReason) {
      this.errorMessage.set(
        `${isRestoreAction ? 'Restore' : 'Review'} disabled: ${disabledReason}`,
      );
      return;
    }

    const selectedCandidates = this.selectedCandidates();
    this.busyAction.set('bulk-review');
    this.feedbackMessage.set(null);
    this.errorMessage.set(null);
    this.bulkProgressItems.set(
      selectedCandidates.map((candidate) => ({
        candidateId: candidate.id,
        setId: candidate.normalizedSetId,
        status: 'pending',
        title: this.getCandidateTitle(candidate),
        warnings: [],
      })),
    );

    for (const candidate of selectedCandidates) {
      const skipReason = isRestoreAction
        ? this.getRestoreDisabledReason(candidate)
        : this.getStatusActionDisabledReason(candidate);

      if (skipReason) {
        this.updateBulkProgressItem(candidate.id, {
          error: skipReason,
          status: 'skipped',
          warnings: [skipReason],
        });
        continue;
      }

      this.updateBulkProgressItem(candidate.id, { status: 'running' });

      try {
        const updatedCandidate =
          await this.commerceAdminApi.updateCatalogDiscoveryCandidateStatus({
            candidateId: candidate.id,
            status,
          });

        this.replaceCandidate(updatedCandidate);
        this.removeCandidateFromSelection(candidate.id);
        this.updateBulkProgressItem(candidate.id, {
          status: 'completed',
          title: this.getCandidateTitle(updatedCandidate),
        });
      } catch (error) {
        this.updateBulkProgressItem(candidate.id, {
          error: toApiErrorMessage(error),
          status: 'failed',
        });
      }
    }

    await this.loadCandidates();
    this.feedbackMessage.set(
      `Bulk ${isRestoreAction ? 'restore' : 'review'} klaar. ${this.bulkProgressSummary()}`,
    );
    this.busyAction.set(null);
  }

  private replaceCandidate(
    updatedCandidate: CommerceAdminCatalogDiscoveryCandidate,
  ): void {
    this.candidates.set(
      this.candidates().map((candidate) =>
        candidate.id === updatedCandidate.id ? updatedCandidate : candidate,
      ),
    );
  }

  private updateBulkProgressItem(
    candidateId: string,
    patch: Partial<DiscoveryBulkProgressItem>,
  ): void {
    this.bulkProgressItems.set(
      this.bulkProgressItems().map((item) =>
        item.candidateId === candidateId ? { ...item, ...patch } : item,
      ),
    );
  }

  async recomputeConfidence(): Promise<void> {
    this.busyAction.set('recompute-confidence');
    this.feedbackMessage.set(null);
    this.errorMessage.set(null);

    try {
      const result =
        await this.commerceAdminApi.recomputeCatalogDiscoveryCandidateConfidence();
      this.feedbackMessage.set(
        `Confidence herberekend: ${result.modifiedCount}/${result.processedCount} bijgewerkt · HIGH ${result.highCount} · MEDIUM ${result.mediumCount} · LOW ${result.lowCount}.`,
      );
      await this.loadCandidates();
    } catch (error) {
      this.errorMessage.set(toApiErrorMessage(error));
    } finally {
      this.busyAction.set(null);
    }
  }

  async syncMerchantCandidates(): Promise<void> {
    if (this.environmentIsReadOnly()) {
      this.errorMessage.set('Merchant lane sync disabled: read-only runtime.');
      return;
    }

    this.busyAction.set('sync-merchant-candidates');
    this.feedbackMessage.set(null);
    this.errorMessage.set(null);

    try {
      const result =
        await this.commerceAdminApi.syncMerchantCatalogDiscoveryCandidates();
      this.laneFilter.set('merchant');
      this.feedbackMessage.set(
        `Merchant lane gesynchroniseerd: ${result.persistedCandidateCount}/${result.uniqueCandidateCount} candidates · ${result.merchantOfferCount} offers · ${result.noiseFilteredCount} noise gefilterd.`,
      );
      await this.loadCandidates();
    } catch (error) {
      this.errorMessage.set(toApiErrorMessage(error));
    } finally {
      this.busyAction.set(null);
    }
  }

  async updateStatus(
    candidate: CommerceAdminCatalogDiscoveryCandidate,
    status: 'ignored' | 'new' | 'non_set' | 'reviewed',
  ): Promise<void> {
    const disabledReason =
      status === 'new'
        ? this.getRestoreDisabledReason(candidate)
        : this.getStatusActionDisabledReason(candidate);

    if (disabledReason) {
      this.errorMessage.set(
        `${status === 'new' ? 'Restore' : 'Review'} disabled: ${disabledReason}`,
      );
      return;
    }

    this.busyAction.set(`${status}:${candidate.id}`);
    this.feedbackMessage.set(null);
    this.errorMessage.set(null);

    try {
      await this.commerceAdminApi.updateCatalogDiscoveryCandidateStatus({
        candidateId: candidate.id,
        status,
      });
      this.feedbackMessage.set(
        status === 'new'
          ? 'Discovery candidate hersteld.'
          : 'Discovery candidate bijgewerkt.',
      );
      await this.loadCandidates();
    } catch (error) {
      this.errorMessage.set(toApiErrorMessage(error));
    } finally {
      this.busyAction.set(null);
    }
  }

  viewDetails(candidate: CommerceAdminCatalogDiscoveryCandidate): void {
    this.selectedCandidate.set(candidate);
  }

  closeDetails(): void {
    this.selectedCandidate.set(null);
  }

  stringifyCandidate(
    candidate: CommerceAdminCatalogDiscoveryCandidate,
  ): string {
    return JSON.stringify(candidate, null, 2);
  }
}
