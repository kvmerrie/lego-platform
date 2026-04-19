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

  @Input() contextLinkLabel?: string;
  @Input() contextLinkQueryParams: Record<string, string> = {};
  @Input() contextLinkRoute?: string;
  @Input({ required: true }) row: CommerceCoverageQueueRow | null = null;
  @Input() title = 'Set context';
  @Output() readonly merchantActionRequested = new EventEmitter<{
    merchantStatus: CommerceCoverageQueueMerchantStatus;
    row: CommerceCoverageQueueRow;
  }>();
  @Output() readonly refreshRequested =
    new EventEmitter<CommerceCoverageQueueRow>();
  @Output() readonly seedActionRequested =
    new EventEmitter<CommerceCoverageQueueRow>();

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

  triggerSeedAction(): void {
    if (this.row && this.seedActionMerchant()) {
      this.seedActionRequested.emit(this.row);
    }
  }

  triggerMerchantAction(
    merchantStatus: CommerceCoverageQueueMerchantStatus,
  ): void {
    if (!this.row) {
      return;
    }

    this.merchantActionRequested.emit({
      row: this.row,
      merchantStatus,
    });
  }

  triggerRefresh(): void {
    if (this.row?.activeSeedCount) {
      this.refreshRequested.emit(this.row);
    }
  }
}
