import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type {
  CommerceAffiliateDiscoveredSet,
  CommerceAffiliateDiscoveredSetConfidence,
  CommerceAffiliateDiscoveredSetStatus,
} from '@lego-platform/commerce/util';
import { CommerceAdminStore } from './commerce-admin-store.service';

type AffiliateDiscoveredSetStatusFilter =
  | CommerceAffiliateDiscoveredSetStatus
  | 'all';
type AffiliateDiscoveredSetConfidenceFilter =
  | CommerceAffiliateDiscoveredSetConfidence
  | 'all';

@Component({
  selector: 'lego-commerce-admin-affiliate-discovered-sets-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './commerce-admin-affiliate-discovered-sets-page.html',
  styles: [
    `
      :host {
        display: block;
      }

      .admin-discovered-page {
        display: grid;
        gap: 0.75rem;
      }

      .admin-discovered-page__bar {
        align-items: start;
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        justify-content: space-between;
      }

      .admin-discovered-page__image {
        aspect-ratio: 1;
        background: var(--admin-surface-muted);
        border-radius: 0.375rem;
        height: 3rem;
        object-fit: contain;
        width: 3rem;
      }

      .admin-discovered-page__url {
        max-width: 18rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommerceAdminAffiliateDiscoveredSetsPageComponent {
  readonly commerceAdminStore = inject(CommerceAdminStore);
  readonly affiliateFilter = signal('all');
  readonly confidenceFilter =
    signal<AffiliateDiscoveredSetConfidenceFilter>('all');
  readonly statusFilter = signal<AffiliateDiscoveredSetStatusFilter>('new');
  readonly search = signal('');
  readonly busyAction = signal<string | null>(null);
  readonly feedback = signal<string | null>(null);
  readonly importProgress = signal<string | null>(null);
  readonly maxBatchSize = signal(50);

  readonly affiliateOptions = computed(() =>
    [
      ...new Map(
        this.commerceAdminStore
          .affiliateDiscoveredSets()
          .map((row) => [row.affiliate.id, row.affiliate] as const),
      ).values(),
    ].sort((left, right) => left.name.localeCompare(right.name)),
  );

  readonly filteredRows = computed(() => {
    const affiliateFilter = this.affiliateFilter();
    const confidenceFilter = this.confidenceFilter();
    const statusFilter = this.statusFilter();
    const query = this.search().trim().toLowerCase();

    return this.commerceAdminStore.affiliateDiscoveredSets().filter((row) => {
      if (affiliateFilter !== 'all' && row.affiliate.id !== affiliateFilter) {
        return false;
      }

      if (confidenceFilter !== 'all' && row.confidence !== confidenceFilter) {
        return false;
      }

      if (statusFilter !== 'all' && row.status !== statusFilter) {
        return false;
      }

      return (
        !query ||
        row.normalizedSetId.includes(query) ||
        row.productTitle.toLowerCase().includes(query) ||
        row.affiliate.name.toLowerCase().includes(query)
      );
    });
  });

  readonly highConfidenceRows = computed(() =>
    this.filteredRows().filter(
      (row) => row.status === 'new' && row.confidence === 'high',
    ),
  );
  readonly highConfidenceBatchRows = computed(() =>
    this.highConfidenceRows().slice(0, this.maxBatchSize()),
  );
  readonly highConfidenceBatchUniqueSetCount = computed(
    () =>
      new Set(this.highConfidenceBatchRows().map((row) => row.normalizedSetId))
        .size,
  );

  formatPrice(row: CommerceAffiliateDiscoveredSet): string {
    if (typeof row.priceMinor !== 'number') {
      return '-';
    }

    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: row.currencyCode ?? 'EUR',
    }).format(row.priceMinor / 100);
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('nl-NL', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  getConfidenceLabel(
    confidence: CommerceAffiliateDiscoveredSetConfidence,
  ): string {
    return confidence === 'high' ? 'Hoog' : 'Laag';
  }

  getStatusLabel(status: CommerceAffiliateDiscoveredSetStatus): string {
    switch (status) {
      case 'imported':
        return 'Geimporteerd';
      case 'ignored':
        return 'Genegeerd';
      case 'non_set':
        return 'Geen set';
      default:
        return 'Nieuw';
    }
  }

  updateMaxBatchSize(value: number | string): void {
    const parsedValue =
      typeof value === 'number' ? value : Number.parseInt(value, 10);

    this.maxBatchSize.set(
      Number.isInteger(parsedValue)
        ? Math.min(50, Math.max(1, parsedValue))
        : 50,
    );
  }

  async importRow(row: CommerceAffiliateDiscoveredSet): Promise<void> {
    this.busyAction.set(`import:${row.id}`);
    this.feedback.set(null);
    this.importProgress.set(`Import gestart voor ${row.normalizedSetId}.`);

    try {
      const result =
        await this.commerceAdminStore.importAffiliateDiscoveredSets({
          discoveredSetIds: [row.id],
          highConfidenceOnly: false,
          maxBatchSize: 1,
        });

      this.feedback.set(
        `${result.importedCount} rij geimporteerd, ${result.failedLookupCount} lookup mislukt, ${result.skippedCount} overgeslagen.`,
      );
    } finally {
      this.busyAction.set(null);
      this.importProgress.set(null);
    }
  }

  async bulkImportHighConfidence(): Promise<void> {
    this.busyAction.set('bulk-import');
    this.feedback.set(null);
    this.importProgress.set(
      `Import gestart voor ${this.highConfidenceBatchRows().length} rijen en ${this.highConfidenceBatchUniqueSetCount()} unieke setnummers.`,
    );

    try {
      const result =
        await this.commerceAdminStore.importAffiliateDiscoveredSets({
          discoveredSetIds: this.highConfidenceBatchRows().map((row) => row.id),
          highConfidenceOnly: true,
          maxBatchSize: this.maxBatchSize(),
        });

      this.feedback.set(
        `${result.importedCount} rijen geimporteerd, ${result.createdCatalogSetCount} catalogussets aangemaakt, ${result.failedLookupCount} lookups mislukt, ${result.skippedCount} overgeslagen.`,
      );
    } finally {
      this.busyAction.set(null);
      this.importProgress.set(null);
    }
  }

  async markStatus(
    row: CommerceAffiliateDiscoveredSet,
    status: 'ignored' | 'non_set',
  ): Promise<void> {
    this.busyAction.set(`${status}:${row.id}`);
    this.feedback.set(null);

    try {
      await this.commerceAdminStore.updateAffiliateDiscoveredSetStatus({
        discoveredSetId: row.id,
        status,
      });
      this.feedback.set('Reviewstatus bijgewerkt.');
    } finally {
      this.busyAction.set(null);
    }
  }
}
