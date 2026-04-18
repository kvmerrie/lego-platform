import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommerceAdminStore } from './commerce-admin-store.service';

@Component({
  selector: 'lego-commerce-admin-dashboard-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './commerce-admin-dashboard-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommerceAdminDashboardPageComponent {
  readonly commerceAdminStore = inject(CommerceAdminStore);
  readonly firstOfferCount = computed(
    () =>
      this.commerceAdminStore
        .coverageQueueRows()
        .filter((row) => row.validMerchantCount === 0).length,
  );
  readonly underCoveredCount = computed(
    () =>
      this.commerceAdminStore
        .coverageQueueRows()
        .filter(
          (row) => row.validMerchantCount > 0 && row.validMerchantCount < 3,
        ).length,
  );
  readonly recentlyAddedOverlayCount = computed(
    () =>
      this.commerceAdminStore
        .coverageQueueRows()
        .filter((row) => row.source === 'overlay').length,
  );
  readonly reviewQueueCount = computed(
    () =>
      this.commerceAdminStore
        .coverageQueueRows()
        .filter((row) => row.needsReviewCount > 0).length,
  );
  readonly workQueuePreview = computed(() =>
    this.commerceAdminStore
      .coverageQueueRows()
      .filter(
        (row) =>
          row.recommendedNextAction !== 'no_action_needed' &&
          row.recommendedNextAction !== 'recheck_later',
      )
      .slice(0, 4)
      .map((row) => ({
        id: row.setId,
        label: `${row.setName} (${row.setId})`,
        meta: `${this.commerceAdminStore.getCoverageQueueActionLabel(
          row.recommendedNextAction,
        )}${
          row.recommendedMerchantName ? ` · ${row.recommendedMerchantName}` : ''
        }`,
      })),
  );
  readonly latestOverlayRow = computed(
    () =>
      [...this.commerceAdminStore.coverageQueueRows()]
        .filter((row) => row.source === 'overlay')
        .sort(
          (left, right) =>
            (Date.parse(right.sourceCreatedAt ?? '') || 0) -
            (Date.parse(left.sourceCreatedAt ?? '') || 0),
        )[0],
  );
  readonly latestOverlayPublicUrl = computed(() => {
    const latestOverlayRow = this.latestOverlayRow();

    return latestOverlayRow
      ? this.commerceAdminStore.getPublicSetUrl(latestOverlayRow.setId)
      : undefined;
  });
}
