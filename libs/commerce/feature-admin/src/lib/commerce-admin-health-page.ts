import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  AdminPageComponent,
  AdminSectionHeaderComponent,
  AdminStatusBadgeComponent,
} from '@lego-platform/admin/ui';
import {
  CommerceAdminApiService,
  type CommerceAdminOperationsSummary,
} from './commerce-admin-api.service';

const PROD_PAGE_CHECKS = [
  { label: 'Open Production Home', path: '/' },
  { label: 'Open Production Deals', path: '/deals' },
  { label: 'Open Production Nieuwe Sets', path: '/nieuwe-lego-sets' },
  { label: 'Open Production Themes', path: '/themes' },
] as const;
const PRODUCTION_WEB_BASE_URL = 'https://www.brickhunt.nl';
const FALLBACK_STAGING_WEB_BASE_URL = 'https://staging.brickhunt.nl';

declare global {
  interface Window {
    __BRICKHUNT_ADMIN_ENV__?: {
      NEXT_PUBLIC_STAGING_WEB_BASE_URL?: string;
    };
  }
}

function readConfiguredStagingWebBaseUrl(): string {
  if (typeof window === 'undefined') {
    return FALLBACK_STAGING_WEB_BASE_URL;
  }

  const configuredUrl =
    window.__BRICKHUNT_ADMIN_ENV__?.NEXT_PUBLIC_STAGING_WEB_BASE_URL?.trim();

  return configuredUrl || FALLBACK_STAGING_WEB_BASE_URL;
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
  selector: 'lego-commerce-admin-health-page',
  imports: [
    CommonModule,
    AdminPageComponent,
    AdminSectionHeaderComponent,
    AdminStatusBadgeComponent,
  ],
  template: `
    <lego-admin-page
      eyebrow="Operations Console"
      title="Health"
      description="Compacte checks voor API, intake, discovery, sync en belangrijke productiepagina's."
    >
      <div adminPageActions>
        <button
          class="admin-button admin-button--primary"
          type="button"
          [disabled]="isLoading()"
          (click)="loadSummary()"
        >
          Ververs
        </button>
      </div>

      @if (errorMessage()) {
        <p class="admin-inline-alert admin-inline-alert--danger">
          {{ errorMessage() }}
        </p>
      }
      @if (summary(); as summaryValue) {
        <section class="admin-panel admin-stack">
          <lego-admin-section-header
            title="Operational checks"
            description="Een scanbare statuslaag bovenop de bestaande API's."
          ></lego-admin-section-header>

          <div class="admin-data-table-shell">
            <table class="admin-data-table">
              <thead>
                <tr>
                  <th>Check</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>API health</td>
                  <td>
                    <lego-admin-status-badge tone="positive">
                      {{ summaryValue.apiHealth.status }}
                    </lego-admin-status-badge>
                  </td>
                  <td>{{ formatDate(summaryValue.apiHealth.checkedAt) }}</td>
                </tr>
                <tr>
                  <td>Latest bulk onboarding</td>
                  <td>
                    <lego-admin-status-badge [tone]="bulkRunTone()">
                      {{ bulkRunStatus() }}
                    </lego-admin-status-badge>
                  </td>
                  <td>{{ bulkRunDetails() }}</td>
                </tr>
                <tr>
                  <td>Candidate queue</td>
                  <td>
                    <lego-admin-status-badge
                      [tone]="
                        summaryValue.discoveryCandidates.totalCount > 0
                          ? 'warning'
                          : 'positive'
                      "
                    >
                      {{ summaryValue.discoveryCandidates.totalCount }} open
                    </lego-admin-status-badge>
                  </td>
                  <td>
                    {{ summaryValue.discoveryCandidates.newCount }} new ·
                    {{ summaryValue.discoveryCandidates.highCount }} high ·
                    {{ summaryValue.discoveryCandidates.mediumCount }} medium ·
                    {{ summaryValue.discoveryCandidates.lowCount }} low
                  </td>
                </tr>
                <tr>
                  <td>Production sync</td>
                  <td>
                    <lego-admin-status-badge
                      [tone]="
                        summaryValue.latestProductionSync
                          ? 'positive'
                          : 'neutral'
                      "
                    >
                      {{
                        summaryValue.latestProductionSync?.status ?? 'unknown'
                      }}
                    </lego-admin-status-badge>
                  </td>
                  <td>{{ latestSyncDetails() }}</td>
                </tr>
                <tr>
                  <td>Pending promote</td>
                  <td>
                    <lego-admin-status-badge
                      [tone]="
                        (summaryValue.pendingPromoteCount ?? 0) > 0
                          ? 'warning'
                          : summaryValue.pendingPromoteCount === null
                            ? 'neutral'
                            : 'positive'
                      "
                    >
                      {{ summaryValue.pendingPromoteCount ?? 'n/a' }}
                    </lego-admin-status-badge>
                  </td>
                  <td>
                    Preview
                    {{
                      summaryValue.promotePreview
                        ? formatDate(summaryValue.promotePreview.generatedAt)
                        : 'unavailable'
                    }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        @if (summaryValue.errors.length > 0) {
          <section class="admin-panel admin-stack">
            <lego-admin-section-header
              title="Partial errors"
              description="Een falende check breekt de Health-pagina niet."
            ></lego-admin-section-header>
            @for (
              summaryError of summaryValue.errors;
              track summaryError.check
            ) {
              <p class="admin-muted">
                {{ summaryError.check }}: {{ summaryError.message }}
              </p>
            }
          </section>
        }

        <section class="admin-panel admin-stack">
          <lego-admin-section-header
            title="Production page checks"
            description="Open de belangrijkste publieke routes na promote, sync of revalidation."
          ></lego-admin-section-header>

          <div class="admin-actions-inline">
            @for (pageCheck of prodPageChecks; track pageCheck.path) {
              <a
                class="admin-button admin-button--subtle"
                [href]="pageCheck.path"
                target="_blank"
                rel="noreferrer"
              >
                {{ pageCheck.label }}
              </a>
            }
          </div>
          @if (stagingUrl) {
            <a
              class="admin-button admin-button--subtle"
              [href]="stagingUrl"
              target="_blank"
              rel="noreferrer"
            >
              Open Staging
            </a>
          }
        </section>
      } @else {
        <p class="admin-muted">Health summary laden…</p>
      }
    </lego-admin-page>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommerceAdminHealthPageComponent implements OnInit {
  private readonly commerceAdminApi = inject(CommerceAdminApiService);
  readonly errorMessage = signal<string | null>(null);
  readonly isLoading = signal(false);
  readonly prodPageChecks = PROD_PAGE_CHECKS.map((pageCheck) => ({
    ...pageCheck,
    path: `${PRODUCTION_WEB_BASE_URL}${pageCheck.path}`,
  }));
  readonly stagingUrl = readConfiguredStagingWebBaseUrl();
  readonly summary = signal<CommerceAdminOperationsSummary | null>(null);
  readonly bulkRunStatus = computed(
    () => this.summary()?.latestBulkOnboardingRun?.run.status ?? 'unknown',
  );
  readonly bulkRunTone = computed(() => {
    const status = this.bulkRunStatus();

    if (status === 'completed') {
      return 'positive';
    }

    if (status === 'failed' || status === 'completed_with_errors') {
      return 'danger';
    }

    return status === 'unknown' ? 'neutral' : 'warning';
  });
  readonly bulkRunDetails = computed(() => {
    const run = this.summary()?.latestBulkOnboardingRun?.run;

    if (!run) {
      return 'Nog geen run gevonden.';
    }

    return `${run.runId} · ${run.requestedSetIds.length} sets · ${formatDateTime(
      run.updatedAt,
    )}`;
  });
  readonly latestSyncDetails = computed(() => {
    const latestProductionSync = this.summary()?.latestProductionSync;

    if (!latestProductionSync) {
      return 'Nog geen production sync in deze API runtime.';
    }

    return `${latestProductionSync.dryRun ? 'dry-run' : 'sync'} · ${formatDateTime(
      latestProductionSync.startedAt,
    )}`;
  });

  async ngOnInit(): Promise<void> {
    await this.loadSummary();
  }

  formatDate(value?: string): string {
    return formatDateTime(value);
  }

  async loadSummary(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      this.summary.set(await this.commerceAdminApi.getOperationsSummary());
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error
          ? error.message
          : 'Health summary kon niet worden geladen.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}
