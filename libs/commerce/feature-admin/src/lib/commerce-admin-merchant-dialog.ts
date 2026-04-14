import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  commerceMerchantSourceTypes,
  type CommerceMerchant,
  type CommerceMerchantInput,
} from '@lego-platform/commerce/util';
import { CommerceAdminStore } from './commerce-admin-store.service';

interface MerchantFormModel {
  affiliateNetwork: string;
  isActive: boolean;
  name: string;
  notes: string;
  slug: string;
  sourceType: CommerceMerchantInput['sourceType'];
}

function createDefaultMerchantForm(): MerchantFormModel {
  return {
    slug: '',
    name: '',
    isActive: true,
    sourceType: 'direct',
    affiliateNetwork: '',
    notes: '',
  };
}

@Component({
  selector: 'lego-commerce-admin-merchant-dialog',
  imports: [CommonModule, FormsModule],
  templateUrl: './commerce-admin-merchant-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommerceAdminMerchantDialogComponent {
  readonly commerceAdminStore = inject(CommerceAdminStore);

  @Input()
  set merchant(value: CommerceMerchant | null) {
    this._merchant = value;
    this.errorMessage = null;
    this.formModel = value
      ? {
          slug: value.slug,
          name: value.name,
          isActive: value.isActive,
          sourceType: value.sourceType,
          affiliateNetwork: value.affiliateNetwork ?? '',
          notes: value.notes,
        }
      : createDefaultMerchantForm();
  }

  get merchant(): CommerceMerchant | null {
    return this._merchant;
  }

  @Output() readonly closed = new EventEmitter<void>();

  private _merchant: CommerceMerchant | null = null;
  readonly merchantSourceTypes = commerceMerchantSourceTypes;

  errorMessage: string | null = null;
  formModel = createDefaultMerchantForm();
  isSaving = false;

  get isEditing(): boolean {
    return !!this.merchant;
  }

  cancel(): void {
    if (this.isSaving) {
      return;
    }

    this.closed.emit();
  }

  async save(): Promise<void> {
    this.errorMessage = null;
    this.isSaving = true;

    try {
      await this.commerceAdminStore.saveMerchant({
        merchantId: this.merchant?.id,
        input: {
          ...this.formModel,
          affiliateNetwork: this.formModel.affiliateNetwork || undefined,
        },
      });

      this.closed.emit();
    } catch (error) {
      this.errorMessage =
        error instanceof Error
          ? error.message
          : 'De merchant kon niet worden opgeslagen.';
    } finally {
      this.isSaving = false;
    }
  }
}
