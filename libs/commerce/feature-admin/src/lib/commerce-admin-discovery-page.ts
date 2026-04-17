import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  type CommerceDiscoveryCandidate,
  type CommerceDiscoveryCandidateReviewStatus,
  type CommerceDiscoveryCandidateStatus,
} from '@lego-platform/commerce/util';
import { ActivatedRoute } from '@angular/router';
import { CommerceAdminStore } from './commerce-admin-store.service';

type DiscoveryStatusFilter = 'all' | CommerceDiscoveryCandidateStatus;

type DiscoveryReviewFilter = 'all' | CommerceDiscoveryCandidateReviewStatus;

@Component({
  selector: 'lego-commerce-admin-discovery-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './commerce-admin-discovery-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommerceAdminDiscoveryPageComponent implements OnInit {
  readonly candidateFeedback = signal<string | null>(null);
  readonly candidateFeedbackTone = signal<'danger' | 'positive' | null>(null);
  readonly commerceAdminStore = inject(CommerceAdminStore);
  readonly activatedRoute = inject(ActivatedRoute);
  readonly search = signal('');
  readonly merchantFilter = signal('all');
  readonly reviewFilter = signal<DiscoveryReviewFilter>('all');
  readonly runFeedback = signal<string | null>(null);
  readonly runFeedbackTone = signal<'danger' | 'positive' | null>(null);
  readonly runMerchantId = signal('');
  readonly runSetId = signal('');
  readonly setFilter = signal('all');
  readonly statusFilter = signal<DiscoveryStatusFilter>('all');
  readonly isRunning = signal(false);
  readonly isUpdatingCandidateId = signal<string | null>(null);
  readonly recentRuns = computed(() =>
    this.commerceAdminStore.discoveryRuns().slice(0, 8),
  );
  readonly filteredCandidates = computed(() => {
    const searchValue = this.search().trim().toLowerCase();
    const merchantFilter = this.merchantFilter();
    const reviewFilter = this.reviewFilter();
    const setFilter = this.setFilter();
    const statusFilter = this.statusFilter();

    return this.commerceAdminStore.discoveryCandidates().filter((candidate) => {
      if (merchantFilter !== 'all' && candidate.merchantId !== merchantFilter) {
        return false;
      }

      if (setFilter !== 'all' && candidate.setId !== setFilter) {
        return false;
      }

      if (statusFilter !== 'all' && candidate.status !== statusFilter) {
        return false;
      }

      if (reviewFilter !== 'all' && candidate.reviewStatus !== reviewFilter) {
        return false;
      }

      if (!searchValue) {
        return true;
      }

      return (
        candidate.setId.toLowerCase().includes(searchValue) ||
        candidate.candidateTitle.toLowerCase().includes(searchValue) ||
        candidate.candidateUrl.toLowerCase().includes(searchValue) ||
        this.commerceAdminStore
          .getMerchantName(candidate.merchantId)
          .toLowerCase()
          .includes(searchValue) ||
        this.commerceAdminStore
          .getCatalogSetLabel(candidate.setId)
          .toLowerCase()
          .includes(searchValue)
      );
    });
  });

  ngOnInit(): void {
    const queryParamMap = this.activatedRoute.snapshot.queryParamMap;
    const requestedSetId = queryParamMap.get('set');
    const requestedMerchantId = queryParamMap.get('merchant');

    if (
      requestedSetId &&
      this.commerceAdminStore
        .catalogSetOptions()
        .some((catalogSet) => catalogSet.id === requestedSetId)
    ) {
      this.runSetId.set(requestedSetId);
      this.setFilter.set(requestedSetId);
    }

    if (
      requestedMerchantId &&
      this.commerceAdminStore
        .discoveryMerchants()
        .some((merchant) => merchant.id === requestedMerchantId)
    ) {
      this.runMerchantId.set(requestedMerchantId);
      this.merchantFilter.set(requestedMerchantId);
    }

    if (!this.runSetId()) {
      this.runSetId.set(
        this.commerceAdminStore.catalogSetOptions()[0]?.id ?? '',
      );
    }

    if (!this.runMerchantId()) {
      this.runMerchantId.set(
        this.commerceAdminStore.discoveryMerchants()[0]?.id ?? '',
      );
    }
  }

  updateMerchantFilter(value: string): void {
    this.merchantFilter.set(value);
  }

  updateReviewFilter(value: DiscoveryReviewFilter): void {
    this.reviewFilter.set(value);
  }

  updateSearch(value: string): void {
    this.search.set(value);
  }

  updateSetFilter(value: string): void {
    this.setFilter.set(value);
  }

  updateStatusFilter(value: DiscoveryStatusFilter): void {
    this.statusFilter.set(value);
  }

  async runDiscovery(): Promise<void> {
    this.runFeedback.set(null);
    this.runFeedbackTone.set(null);

    if (!this.runSetId() || !this.runMerchantId()) {
      this.runFeedback.set('Kies eerst een set en merchant voor discovery.');
      this.runFeedbackTone.set('danger');
      return;
    }

    this.isRunning.set(true);

    try {
      const result = await this.commerceAdminStore.runDiscovery({
        setId: this.runSetId(),
        merchantId: this.runMerchantId(),
      });

      if (result.run.status === 'success') {
        this.runFeedback.set(
          `${result.run.candidateCount} kandidaat${
            result.run.candidateCount === 1 ? '' : 'en'
          } gevonden voor ${this.commerceAdminStore.getCatalogSetLabel(
            result.run.setId,
          )}.`,
        );
        this.runFeedbackTone.set('positive');
      } else {
        this.runFeedback.set(
          result.run.errorMessage ??
            'Discovery liep vast voordat er kandidaten terugkwamen.',
        );
        this.runFeedbackTone.set('danger');
      }
    } catch (error) {
      this.runFeedback.set(
        error instanceof Error
          ? error.message
          : 'Discovery kon niet worden gestart.',
      );
      this.runFeedbackTone.set('danger');
    } finally {
      this.isRunning.set(false);
    }
  }

  async approveCandidate(candidate: CommerceDiscoveryCandidate): Promise<void> {
    this.isUpdatingCandidateId.set(candidate.id);
    this.candidateFeedback.set(null);
    this.candidateFeedbackTone.set(null);

    try {
      const result = await this.commerceAdminStore.approveDiscoveryCandidate(
        candidate.id,
      );

      this.candidateFeedback.set(result.message);
      this.candidateFeedbackTone.set('positive');
    } catch (error) {
      this.candidateFeedback.set(
        error instanceof Error
          ? error.message
          : 'Kandidaat kon niet worden goedgekeurd.',
      );
      this.candidateFeedbackTone.set('danger');
      return;
    } finally {
      this.isUpdatingCandidateId.set(null);
    }
  }

  async rejectCandidate(candidate: CommerceDiscoveryCandidate): Promise<void> {
    this.isUpdatingCandidateId.set(candidate.id);
    this.candidateFeedback.set(null);
    this.candidateFeedbackTone.set(null);

    try {
      await this.commerceAdminStore.rejectDiscoveryCandidate(candidate.id);
      this.candidateFeedback.set('Kandidaat gemarkeerd als afgewezen.');
      this.candidateFeedbackTone.set('positive');
    } catch (error) {
      this.candidateFeedback.set(
        error instanceof Error
          ? error.message
          : 'Kandidaat kon niet worden afgewezen.',
      );
      this.candidateFeedbackTone.set('danger');
      return;
    } finally {
      this.isUpdatingCandidateId.set(null);
    }
  }
}
