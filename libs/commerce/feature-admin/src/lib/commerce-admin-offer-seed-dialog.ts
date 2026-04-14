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
  commerceOfferSeedValidationStatuses,
  type CommerceOfferSeed,
  type CommerceOfferSeedInput,
} from '@lego-platform/commerce/util';
import { CommerceAdminStore } from './commerce-admin-store.service';

interface OfferSeedFormModel {
  isActive: boolean;
  lastVerifiedAt: string;
  merchantId: string;
  notes: string;
  productUrl: string;
  setId: string;
  validationStatus: CommerceOfferSeedInput['validationStatus'];
}

function createDefaultOfferSeedForm(
  merchantId = '',
  setId = '',
): OfferSeedFormModel {
  return {
    setId,
    merchantId,
    productUrl: '',
    isActive: true,
    validationStatus: 'pending',
    lastVerifiedAt: '',
    notes: '',
  };
}

@Component({
  selector: 'lego-commerce-admin-offer-seed-dialog',
  imports: [CommonModule, FormsModule],
  templateUrl: './commerce-admin-offer-seed-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommerceAdminOfferSeedDialogComponent {
  readonly commerceAdminStore = inject(CommerceAdminStore);

  @Input()
  set offerSeed(value: CommerceOfferSeed | null) {
    this._offerSeed = value;
    this.errorMessage = null;
    this.formModel = value
      ? {
          setId: value.setId,
          merchantId: value.merchantId,
          productUrl: value.productUrl,
          isActive: value.isActive,
          validationStatus: value.validationStatus,
          lastVerifiedAt: this.commerceAdminStore.formatTimestampForInput(
            value.lastVerifiedAt,
          ),
          notes: value.notes,
        }
      : createDefaultOfferSeedForm(
          this.commerceAdminStore.merchants()[0]?.id ?? '',
          this.commerceAdminStore.catalogSetOptions[0]?.id ?? '',
        );
  }

  get offerSeed(): CommerceOfferSeed | null {
    return this._offerSeed;
  }

  @Output() readonly closed = new EventEmitter<void>();

  private _offerSeed: CommerceOfferSeed | null = null;
  readonly validationStatuses = commerceOfferSeedValidationStatuses;

  errorMessage: string | null = null;
  formModel = createDefaultOfferSeedForm();
  isSaving = false;

  get canSave(): boolean {
    return this.commerceAdminStore.merchants().length > 0;
  }

  get isEditing(): boolean {
    return !!this.offerSeed;
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
      await this.commerceAdminStore.saveOfferSeed({
        offerSeedId: this.offerSeed?.id,
        input: {
          ...this.formModel,
          lastVerifiedAt: this.formModel.lastVerifiedAt || undefined,
        },
      });

      this.closed.emit();
    } catch (error) {
      this.errorMessage =
        error instanceof Error
          ? error.message
          : 'De offer seed kon niet worden opgeslagen.';
    } finally {
      this.isSaving = false;
    }
  }
}
