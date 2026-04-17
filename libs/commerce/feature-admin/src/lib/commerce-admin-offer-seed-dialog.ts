import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  commerceOfferSeedValidationStatuses,
  type CommerceDiscoveryCandidate,
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

export interface CommerceOfferSeedDialogPrefill {
  merchantId: string;
  setId: string;
}

type OfferSeedDialogMode = 'discover' | 'manual';

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
  readonly mode = signal<OfferSeedDialogMode>('manual');
  readonly selectedDiscoveryCandidateId = signal<string | null>(null);
  readonly selectedDiscoveryCandidateUrl = signal<string | null>(null);

  @Input()
  set offerSeed(value: CommerceOfferSeed | null) {
    this._offerSeed = value;
    this.syncFormModel();
  }

  get offerSeed(): CommerceOfferSeed | null {
    return this._offerSeed;
  }

  @Input()
  set prefill(value: CommerceOfferSeedDialogPrefill | null) {
    this._prefill = value;
    this.syncFormModel();
  }

  get prefill(): CommerceOfferSeedDialogPrefill | null {
    return this._prefill;
  }

  @Output() readonly closed = new EventEmitter<void>();

  private _offerSeed: CommerceOfferSeed | null = null;
  private _prefill: CommerceOfferSeedDialogPrefill | null = null;
  readonly validationStatuses = commerceOfferSeedValidationStatuses;

  discoveryMessage: string | null = null;
  discoveryMessageTone: 'danger' | 'neutral' | 'positive' | null = null;
  errorMessage: string | null = null;
  formModel = createDefaultOfferSeedForm();
  isDiscoveryRunning = false;
  isSaving = false;

  get canSave(): boolean {
    return this.commerceAdminStore.merchants().length > 0;
  }

  get isEditing(): boolean {
    return !!this.offerSeed;
  }

  get productUrlHref(): string | null {
    const productUrl = this.formModel.productUrl.trim();

    if (!productUrl) {
      return null;
    }

    try {
      return new URL(productUrl).toString();
    } catch {
      return null;
    }
  }

  get merchantSearchUrl(): string | null {
    return (
      this.commerceAdminStore.getMerchantSearchUrl({
        setId: this.formModel.setId,
        merchantId: this.formModel.merchantId,
      }) ?? null
    );
  }

  get supportsDiscovery(): boolean {
    return this.commerceAdminStore.supportsMerchantDiscovery(
      this.formModel.merchantId,
    );
  }

  get discoveryCandidates(): CommerceDiscoveryCandidate[] {
    return this.commerceAdminStore.getDiscoveryCandidatesForSetMerchant({
      setId: this.formModel.setId,
      merchantId: this.formModel.merchantId,
    });
  }

  get latestDiscoveryRun() {
    return this.commerceAdminStore.getLatestDiscoveryRun({
      setId: this.formModel.setId,
      merchantId: this.formModel.merchantId,
    });
  }

  get hasDiscoveryCandidates(): boolean {
    return this.discoveryCandidates.length > 0;
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
    const selectedDiscoveryCandidateId: string | undefined =
      this.selectedDiscoveryCandidateId() || undefined;

    try {
      await this.commerceAdminStore.saveOfferSeed({
        offerSeedId: this.offerSeed?.id,
        discoveryCandidateId:
          !this.offerSeed && selectedDiscoveryCandidateId
            ? selectedDiscoveryCandidateId
            : undefined,
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

  setMode(mode: OfferSeedDialogMode): void {
    if (mode === 'discover' && !this.supportsDiscovery) {
      return;
    }

    this.mode.set(mode);
  }

  async runDiscovery(): Promise<void> {
    this.discoveryMessage = null;
    this.discoveryMessageTone = null;

    if (!this.supportsDiscovery) {
      this.discoveryMessage =
        'Deze merchant heeft nog geen ingebouwde discovery-ondersteuning.';
      this.discoveryMessageTone = 'neutral';
      return;
    }

    this.isDiscoveryRunning = true;

    try {
      const result = await this.commerceAdminStore.runDiscovery({
        setId: this.formModel.setId,
        merchantId: this.formModel.merchantId,
      });

      if (result.run.status === 'success') {
        this.discoveryMessage =
          result.run.candidateCount > 0
            ? `${result.run.candidateCount} kandidaat${
                result.run.candidateCount === 1 ? '' : 'en'
              } klaar om te beoordelen.`
            : 'Discovery draaide, maar leverde nog geen bruikbare kandidaat op.';
        this.discoveryMessageTone = 'positive';
      } else {
        this.discoveryMessage =
          result.run.errorMessage ??
          'Discovery stopte zonder bruikbare kandidaat.';
        this.discoveryMessageTone = 'danger';
      }
    } catch (error) {
      this.discoveryMessage =
        error instanceof Error
          ? error.message
          : 'Discovery kon niet worden gestart.';
      this.discoveryMessageTone = 'danger';
    } finally {
      this.isDiscoveryRunning = false;
    }
  }

  selectDiscoveryCandidate(candidate: CommerceDiscoveryCandidate): void {
    if (candidate.reviewStatus === 'rejected') {
      return;
    }

    this.formModel.productUrl =
      candidate.canonicalUrl || candidate.candidateUrl;
    this.selectedDiscoveryCandidateId.set(candidate.id);
    this.selectedDiscoveryCandidateUrl.set(this.formModel.productUrl);
    this.discoveryMessage = 'URL ingevuld. Sla de seed nog expliciet op.';
    this.discoveryMessageTone = 'positive';
  }

  isDiscoveryCandidateSelected(candidateId: string): boolean {
    return this.selectedDiscoveryCandidateId() === candidateId;
  }

  updateMerchant(value: string): void {
    this.formModel.merchantId = value;
    this.resetDiscoverySelectionIfAutofilled();
    this.discoveryMessage = null;
    this.discoveryMessageTone = null;

    if (!this.supportsDiscovery && this.mode() === 'discover') {
      this.mode.set('manual');
    }

    if (!this.isEditing && this.supportsDiscovery) {
      this.mode.set('discover');
    }
  }

  updateSet(value: string): void {
    this.formModel.setId = value;
    this.resetDiscoverySelectionIfAutofilled();
    this.discoveryMessage = null;
    this.discoveryMessageTone = null;
  }

  updateProductUrl(value: string): void {
    this.formModel.productUrl = value;

    if (value.trim() !== this.selectedDiscoveryCandidateUrl()) {
      this.selectedDiscoveryCandidateId.set(null);
      this.selectedDiscoveryCandidateUrl.set(null);
    }
  }

  private syncFormModel(): void {
    this.errorMessage = null;
    this.discoveryMessage = null;
    this.discoveryMessageTone = null;
    this.formModel = this.offerSeed
      ? {
          setId: this.offerSeed.setId,
          merchantId: this.offerSeed.merchantId,
          productUrl: this.offerSeed.productUrl,
          isActive: this.offerSeed.isActive,
          validationStatus: this.offerSeed.validationStatus,
          lastVerifiedAt: this.commerceAdminStore.formatTimestampForInput(
            this.offerSeed.lastVerifiedAt,
          ),
          notes: this.offerSeed.notes,
        }
      : createDefaultOfferSeedForm(
          this.prefill?.merchantId ??
            this.commerceAdminStore.merchants()[0]?.id ??
            '',
          this.prefill?.setId ??
            this.commerceAdminStore.catalogSetOptions()[0]?.id ??
            '',
        );
    this.selectedDiscoveryCandidateId.set(null);
    this.selectedDiscoveryCandidateUrl.set(null);
    this.mode.set(
      !this.offerSeed && this.supportsDiscovery ? 'discover' : 'manual',
    );
  }

  private resetDiscoverySelectionIfAutofilled(): void {
    if (
      this.selectedDiscoveryCandidateUrl() &&
      this.formModel.productUrl.trim() === this.selectedDiscoveryCandidateUrl()
    ) {
      this.formModel.productUrl = '';
    }

    this.selectedDiscoveryCandidateId.set(null);
    this.selectedDiscoveryCandidateUrl.set(null);
  }
}
