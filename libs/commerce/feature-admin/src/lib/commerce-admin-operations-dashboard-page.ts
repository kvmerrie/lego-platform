import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AdminPageComponent,
  AdminSectionHeaderComponent,
  AdminStatusBadgeComponent,
} from '@lego-platform/admin/ui';
import {
  CommerceAdminApiService,
  type CommerceAdminOperationsSummary,
} from './commerce-admin-api.service';

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
  selector: 'lego-commerce-admin-operations-dashboard-page',
  imports: [
    CommonModule,
    RouterLink,
    AdminPageComponent,
    AdminSectionHeaderComponent,
    AdminStatusBadgeComponent,
  ],
  template: `
    <lego-admin-page
      eyebrow="Operations Console"
      title="Dashboard"
      description="Het korte overzicht voor intake, discovery, sync en promotie."
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
            title="Omgeving"
            description="Staging is de normale schrijfomgeving. Productie blijft read-only behalve de expliciete promote."
          >
            <div adminSectionMeta>
              <lego-admin-status-badge
                [tone]="
                  summaryValue.environments.productionReadOnly
                    ? 'warning'
                    : 'positive'
                "
              >
                {{
                  summaryValue.environments.productionReadOnly
                    ? 'production read-only'
                    : 'staging writable'
                }}
              </lego-admin-status-badge>
            </div>
          </lego-admin-section-header>

          <div class="admin-metric-strip">
            <div class="admin-metric-cell">
              <span class="admin-metric-label">Runtime</span>
              <strong class="admin-metric-value">
                {{ summaryValue.environments.currentRuntimeEnvironment }}
              </strong>
            </div>
            <div class="admin-metric-cell">
              <span class="admin-metric-label">Writable</span>
              <strong class="admin-metric-value">
                {{ summaryValue.environments.writableEnvironment }}
              </strong>
            </div>
            <div class="admin-metric-cell">
              <span class="admin-metric-label">Pending promote</span>
              <strong class="admin-metric-value">
                {{ summaryValue.pendingPromoteCount ?? 'n/a' }}
              </strong>
            </div>
            <div class="admin-metric-cell">
              <span class="admin-metric-label">API</span>
              <strong class="admin-metric-value">
                {{ summaryValue.apiHealth.status }}
              </strong>
            </div>
          </div>
        </section>

        @if (summaryValue.errors.length > 0) {
          <section class="admin-panel admin-stack">
            <lego-admin-section-header
              title="Partial checks"
              description="De summary blijft beschikbaar als een subcheck faalt."
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

        <section class="admin-dashboard-grid">
          <article class="admin-panel admin-stack">
            <lego-admin-section-header
              title="Catalog Intake"
              description="Actieve run apart van de laatste afgeronde intake."
            ></lego-admin-section-header>
            @if (summaryValue.activeBulkOnboardingRun?.run; as activeRun) {
              <div class="admin-metric-strip">
                <div class="admin-metric-cell">
                  <span class="admin-metric-label">Actieve run</span>
                  <strong class="admin-metric-value">{{
                    activeRun.runId
                  }}</strong>
                </div>
                <div class="admin-metric-cell">
                  <span class="admin-metric-label">Status</span>
                  <strong class="admin-metric-value">{{
                    activeRun.status
                  }}</strong>
                </div>
                <div class="admin-metric-cell">
                  <span class="admin-metric-label">Sets</span>
                  <strong class="admin-metric-value">
                    {{ activeRun.requestedSetIds.length }}
                  </strong>
                </div>
              </div>
              <p class="admin-muted">
                Bijgewerkt {{ formatDate(activeRun.updatedAt) }}
              </p>
            } @else {
              <p class="admin-muted">Geen actieve intake-run.</p>
            }
            @if (
              summaryValue.latestCompletedBulkOnboardingRun?.run;
              as completedRun
            ) {
              <p class="admin-muted">
                Laatst afgerond: {{ completedRun.runId }} ·
                {{ completedRun.status }} ·
                {{ formatDate(completedRun.updatedAt) }}
              </p>
            } @else if (summaryValue.latestBulkOnboardingRunStale) {
              <p class="admin-muted">
                Laatste run staat nog op running, maar is stale en wordt niet
                als actief getoond.
              </p>
            }
            <a
              class="admin-button admin-button--subtle"
              routerLink="/catalog-intake"
            >
              Open intake
            </a>
          </article>

          <article class="admin-panel admin-stack">
            <lego-admin-section-header
              title="Discovery"
              description="Persisted catalog discovery candidates."
            ></lego-admin-section-header>
            <div class="admin-metric-strip">
              <div class="admin-metric-cell">
                <span class="admin-metric-label">Nieuw</span>
                <strong class="admin-metric-value">
                  {{ summaryValue.discoveryCandidates.newCount }}
                </strong>
              </div>
              <div class="admin-metric-cell">
                <span class="admin-metric-label">HIGH</span>
                <strong class="admin-metric-value">
                  {{ summaryValue.discoveryCandidates.highCount }}
                </strong>
              </div>
              <div class="admin-metric-cell">
                <span class="admin-metric-label">MEDIUM</span>
                <strong class="admin-metric-value">
                  {{ summaryValue.discoveryCandidates.mediumCount }}
                </strong>
              </div>
              <div class="admin-metric-cell">
                <span class="admin-metric-label">LOW</span>
                <strong class="admin-metric-value">
                  {{ summaryValue.discoveryCandidates.lowCount }}
                </strong>
              </div>
            </div>
            <a
              class="admin-button admin-button--subtle"
              routerLink="/discovery"
            >
              Review discovery
            </a>
          </article>

          <article class="admin-panel admin-stack">
            <lego-admin-section-header
              title="Sync & Promote"
              description="Productie naar staging synchroniseren en daarna bewust promoveren."
            ></lego-admin-section-header>
            <p class="admin-muted">
              Laatste production sync:
              {{ latestSyncLabel() }}
            </p>
            <p class="admin-muted">
              Promote preview:
              {{
                summaryValue.promotePreview
                  ? formatDate(summaryValue.promotePreview.generatedAt)
                  : 'unavailable'
              }}
            </p>
            <a
              class="admin-button admin-button--subtle"
              routerLink="/sync-promote"
            >
              Open sync & promote
            </a>
          </article>
        </section>
      } @else {
        <p class="admin-muted">Operations summary laden…</p>
      }
    </lego-admin-page>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .admin-dashboard-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommerceAdminOperationsDashboardPageComponent implements OnInit {
  private readonly commerceAdminApi = inject(CommerceAdminApiService);
  readonly errorMessage = signal<string | null>(null);
  readonly isLoading = signal(false);
  readonly summary = signal<CommerceAdminOperationsSummary | null>(null);
  readonly latestSyncLabel = computed(() => {
    const latestProductionSync = this.summary()?.latestProductionSync;

    if (!latestProductionSync) {
      return 'nog niet bekend';
    }

    return `${latestProductionSync.status} · ${formatDateTime(
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
          : 'Operations summary kon niet worden geladen.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}
