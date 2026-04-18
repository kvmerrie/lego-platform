import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  type CommerceCoverageQueueMerchantStatus,
  type CommerceCoverageQueueRow,
} from '@lego-platform/commerce/util';
import { CommerceAdminStore } from './commerce-admin-store.service';

@Component({
  selector: 'lego-commerce-admin-set-work-context',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './commerce-admin-set-work-context.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommerceAdminSetWorkContextComponent {
  readonly commerceAdminStore = inject(CommerceAdminStore);

  @Input({ required: true }) row: CommerceCoverageQueueRow | null = null;
  @Input() title = 'Set context';
  @Output() readonly runDiscoveryRequested =
    new EventEmitter<CommerceCoverageQueueRow>();
  @Output() readonly seedActionRequested =
    new EventEmitter<CommerceCoverageQueueRow>();

  readonly discoveryTargetMerchant = computed<
    CommerceCoverageQueueMerchantStatus | undefined
  >(() =>
    this.row
      ? this.commerceAdminStore.getCoverageQueueDiscoveryTargetMerchant(
          this.row,
        )
      : undefined,
  );
  readonly seedActionMerchant = computed<
    CommerceCoverageQueueMerchantStatus | undefined
  >(() =>
    this.row
      ? this.commerceAdminStore.getCoverageQueueSeedActionMerchant(this.row)
      : undefined,
  );
  readonly publicSetUrl = computed(() =>
    this.row
      ? this.commerceAdminStore.getPublicSetUrl(this.row.setId)
      : undefined,
  );
  readonly discoveryQueryParams = computed(() =>
    this.row
      ? this.commerceAdminStore.getCoverageQueueDiscoveryLinkParams(this.row)
      : {},
  );
  readonly latestRelevantDiscoveryRun = computed(() => {
    if (!this.row) {
      return undefined;
    }

    const merchantId =
      this.discoveryTargetMerchant()?.merchantId ??
      this.row.recommendedMerchantId;

    if (!merchantId) {
      return undefined;
    }

    return this.commerceAdminStore.getLatestDiscoveryRun({
      setId: this.row.setId,
      merchantId,
    });
  });
  readonly latestRelevantCandidateCount = computed(() => {
    if (!this.row) {
      return 0;
    }

    const merchantId =
      this.discoveryTargetMerchant()?.merchantId ??
      this.row.recommendedMerchantId;

    if (!merchantId) {
      return 0;
    }

    return this.commerceAdminStore.getDiscoveryCandidatesForSetMerchant({
      setId: this.row.setId,
      merchantId,
    }).length;
  });

  triggerRunDiscovery(): void {
    if (this.row && this.discoveryTargetMerchant()) {
      this.runDiscoveryRequested.emit(this.row);
    }
  }

  triggerSeedAction(): void {
    if (this.row && this.seedActionMerchant()) {
      this.seedActionRequested.emit(this.row);
    }
  }
}
