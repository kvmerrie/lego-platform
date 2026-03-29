import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { listAffiliateOffers } from '@lego-platform/affiliate/data-access';
import { listCatalogSetSummaries } from '@lego-platform/catalog/data-access';
import { getCollectionSnapshot } from '@lego-platform/collection/data-access';
import { getPreviewPanel } from '@lego-platform/content/data-access';
import { getPricePanelSnapshot } from '@lego-platform/pricing/data-access';
import { formatPriceMinor, getPriceDirection } from '@lego-platform/pricing/util';
import { platformConfig } from '@lego-platform/shared/config';
import {
  applyThemeMode,
  getPreferredThemeMode,
  getThemeStyles,
  persistThemeMode,
  toggleThemeMode,
} from '@lego-platform/shared/design-tokens';
import { ThemeMode } from '@lego-platform/shared/types';
import { getThemeToggleLabel } from '@lego-platform/shared/util';
import { getUserProfile } from '@lego-platform/user/data-access';
import { getWishlistOverview } from '@lego-platform/wishlist/data-access';

interface AdminCard {
  label: string;
  value: string;
  detail: string;
}

interface AdminQueueItem {
  domain: string;
  summary: string;
  nextStep: string;
}

@Component({
  selector: 'lego-shell-admin',
  imports: [CommonModule],
  templateUrl: './shell-admin.html',
  styleUrl: './shell-admin.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellAdminComponent {
  readonly commerceReferenceSetId = '10316';
  readonly themeStyles = getThemeStyles();
  readonly productName = platformConfig.productName;
  readonly themeMode = signal<ThemeMode>(getPreferredThemeMode());
  readonly collectorName = getUserProfile().name;
  readonly overviewCards = computed<AdminCard[]>(() => {
    const collectionSnapshot = getCollectionSnapshot();
    const wishlistOverview = getWishlistOverview();
    const pricePanelSnapshot = getPricePanelSnapshot(this.commerceReferenceSetId);
    const commerceReferenceSet = listCatalogSetSummaries().find(
      (catalogSetSummary) => catalogSetSummary.id === this.commerceReferenceSetId,
    );

    return [
      {
        label: 'Catalog breadth',
        value: `${listCatalogSetSummaries().length} featured sets`,
        detail: 'Static-first now, CMS-backed later.',
      },
      {
        label: 'Collection posture',
        value: `${collectionSnapshot.ownedSets} owned / ${collectionSnapshot.wantedSets} wanted`,
        detail: `Completion ${collectionSnapshot.completionRate}%`,
      },
      {
        label: 'Wishlist urgency',
        value: `${wishlistOverview.highPriority} priority items`,
        detail: `${wishlistOverview.trackedSets} tracked sets total`,
      },
      {
        label: 'Market signal',
        value: pricePanelSnapshot
          ? `${getPriceDirection(pricePanelSnapshot.deltaMinor)} ${formatPriceMinor({
              currencyCode: pricePanelSnapshot.currencyCode,
              minorUnits: Math.abs(pricePanelSnapshot.deltaMinor ?? 0),
            })}`
          : 'No snapshot',
        detail: pricePanelSnapshot
          ? `${commerceReferenceSet?.name ?? this.commerceReferenceSetId} currently ${formatPriceMinor({
              currencyCode: pricePanelSnapshot.currencyCode,
              minorUnits: pricePanelSnapshot.headlinePriceMinor,
            })}`
          : 'Pricing snapshot still unavailable.',
      },
    ];
  });
  readonly deliveryQueue: readonly AdminQueueItem[] = [
    {
      domain: 'Catalog',
      summary: 'Schema and entrypoints are ready for Contentful enrichment.',
      nextStep: 'Model catalog set and theme content types.',
    },
    {
      domain: 'Pricing',
      summary:
        'Price panel and history libraries can absorb persisted timeseries cleanly.',
      nextStep: 'Introduce Supabase tables and background sync.',
    },
    {
      domain: 'Affiliate',
      summary: `${listAffiliateOffers(this.commerceReferenceSetId).length} Dutch-market offers demonstrate a bounded commerce layer.`,
      nextStep: 'Wire merchant adapters without leaking into feature shells.',
    },
    {
      domain: 'Content',
      summary: getPreviewPanel().summary,
      nextStep: 'Add preview auth and draft resolution.',
    },
  ];

  constructor() {
    const preferredThemeMode = this.themeMode();

    applyThemeMode(preferredThemeMode);
    persistThemeMode(preferredThemeMode);
  }

  get themeToggleLabel(): string {
    return getThemeToggleLabel(this.themeMode());
  }

  toggleTheme(): void {
    this.themeMode.update(toggleThemeMode);
    applyThemeMode(this.themeMode());
    persistThemeMode(this.themeMode());
  }
}
