import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  type CatalogExternalSetSearchResult,
  type CatalogOverlaySet,
} from '@lego-platform/catalog/util';
import { type CommerceDiscoveryCandidate } from '@lego-platform/commerce/util';
import { CommerceAdminStore } from './commerce-admin-store.service';

@Component({
  selector: 'lego-commerce-admin-add-set-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './commerce-admin-add-set-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommerceAdminAddSetPageComponent {
  readonly commerceAdminStore = inject(CommerceAdminStore);
  readonly searchQuery = signal('');
  readonly searchResults = signal<CatalogExternalSetSearchResult[]>([]);
  readonly selectedResult = signal<CatalogExternalSetSearchResult | null>(null);
  readonly addedSet = signal<CatalogOverlaySet | null>(null);
  readonly feedback = signal<string | null>(null);
  readonly feedbackTone = signal<'danger' | 'positive' | null>(null);
  readonly discoveryMessage = signal<string | null>(null);
  readonly discoveryMessageTone = signal<'danger' | 'positive' | null>(null);
  readonly isSearching = signal(false);
  readonly isAdding = signal(false);
  readonly isRunningDiscovery = signal(false);
  readonly isSavingSeed = signal(false);
  readonly isUpdatingCandidateId = signal<string | null>(null);
  readonly selectedCandidateId = signal<string | null>(null);
  readonly seedDraftUrl = signal('');
  readonly discoveryMerchant = computed(() =>
    this.commerceAdminStore
      .discoveryMerchants()
      .find((merchant) => merchant.slug === 'misterbricks'),
  );
  readonly discoveryCandidates = computed(() => {
    const overlaySet = this.addedSet();
    const merchantId = this.discoveryMerchant()?.id;

    if (!overlaySet || !merchantId) {
      return [];
    }

    return this.commerceAdminStore.getDiscoveryCandidatesForSetMerchant({
      merchantId,
      setId: overlaySet.setId,
    });
  });
  readonly latestDiscoveryRun = computed(() => {
    const overlaySet = this.addedSet();
    const merchantId = this.discoveryMerchant()?.id;

    if (!overlaySet || !merchantId) {
      return undefined;
    }

    return this.commerceAdminStore.getLatestDiscoveryRun({
      merchantId,
      setId: overlaySet.setId,
    });
  });
  readonly activeOfferCount = computed(() => {
    const overlaySet = this.addedSet();

    if (!overlaySet) {
      return 0;
    }

    return this.commerceAdminStore
      .offerSeeds()
      .filter(
        (offerSeed) =>
          offerSeed.setId === overlaySet.setId &&
          offerSeed.isActive &&
          offerSeed.validationStatus !== 'invalid',
      ).length;
  });
  readonly publicSetUrl = computed(() => {
    const overlaySet = this.addedSet();

    return overlaySet
      ? this.commerceAdminStore.getPublicSetUrl(overlaySet.setId)
      : undefined;
  });

  updateSearchQuery(value: string): void {
    this.searchQuery.set(value);
  }

  selectSearchResult(result: CatalogExternalSetSearchResult): void {
    this.selectedResult.set(result);
    this.addedSet.set(null);
    this.discoveryMessage.set(null);
    this.discoveryMessageTone.set(null);
    this.selectedCandidateId.set(null);
    this.seedDraftUrl.set('');
  }

  useCandidate(candidate: CommerceDiscoveryCandidate): void {
    this.selectedCandidateId.set(candidate.id);
    this.seedDraftUrl.set(candidate.canonicalUrl ?? candidate.candidateUrl);
    this.discoveryMessage.set(
      'URL klaargezet. Je kunt hem nog aanpassen voordat je de seed opslaat.',
    );
    this.discoveryMessageTone.set('positive');
  }

  async search(): Promise<void> {
    const query = this.searchQuery().trim();

    this.feedback.set(null);
    this.feedbackTone.set(null);

    if (!query) {
      this.feedback.set('Typ eerst een setnummer of naam om te zoeken.');
      this.feedbackTone.set('danger');
      return;
    }

    this.isSearching.set(true);

    try {
      const results =
        await this.commerceAdminStore.searchCatalogMissingSets(query);
      this.searchResults.set(results);
      this.selectedResult.set(results[0] ?? null);
      this.addedSet.set(null);

      this.feedback.set(
        results.length === 0
          ? 'Geen missende sets gevonden. Dit resultaat zit waarschijnlijk al in Brickhunt.'
          : `${results.length} missende set${results.length === 1 ? '' : 's'} klaar om toe te voegen.`,
      );
      this.feedbackTone.set(results.length === 0 ? 'danger' : 'positive');
    } catch (error) {
      this.feedback.set(
        error instanceof Error
          ? error.message
          : 'Zoeken in Rebrickable liep vast.',
      );
      this.feedbackTone.set('danger');
    } finally {
      this.isSearching.set(false);
    }
  }

  async addSelectedSet(): Promise<void> {
    const selectedResult = this.selectedResult();

    if (!selectedResult) {
      this.feedback.set('Kies eerst een zoekresultaat om toe te voegen.');
      this.feedbackTone.set('danger');
      return;
    }

    this.isAdding.set(true);
    this.feedback.set(null);
    this.feedbackTone.set(null);

    try {
      const overlaySet =
        await this.commerceAdminStore.createCatalogOverlaySet(selectedResult);

      this.addedSet.set(overlaySet);
      this.feedback.set(
        `${overlaySet.name} (${overlaySet.setId}) staat nu in de catalog-overlay.`,
      );
      this.feedbackTone.set('positive');
    } catch (error) {
      this.feedback.set(
        error instanceof Error
          ? error.message
          : 'Set kon niet aan de catalog-overlay worden toegevoegd.',
      );
      this.feedbackTone.set('danger');
    } finally {
      this.isAdding.set(false);
    }
  }

  async runDiscovery(): Promise<void> {
    const overlaySet = this.addedSet();
    const merchant = this.discoveryMerchant();

    this.discoveryMessage.set(null);
    this.discoveryMessageTone.set(null);

    if (!overlaySet || !merchant) {
      this.discoveryMessage.set(
        'Voeg eerst een set toe voordat je discovery start.',
      );
      this.discoveryMessageTone.set('danger');
      return;
    }

    this.isRunningDiscovery.set(true);

    try {
      const result = await this.commerceAdminStore.runDiscovery({
        merchantId: merchant.id,
        setId: overlaySet.setId,
      });

      if (result.run.status === 'success') {
        this.discoveryMessage.set(
          `${result.run.candidateCount} kandidaat${
            result.run.candidateCount === 1 ? '' : 'en'
          } gevonden voor ${overlaySet.name}.`,
        );
        this.discoveryMessageTone.set('positive');
      } else {
        this.discoveryMessage.set(
          result.run.errorMessage ??
            'Discovery kwam terug zonder bruikbare kandidaten.',
        );
        this.discoveryMessageTone.set('danger');
      }
    } catch (error) {
      this.discoveryMessage.set(
        error instanceof Error
          ? error.message
          : 'Discovery kon niet worden gestart.',
      );
      this.discoveryMessageTone.set('danger');
    } finally {
      this.isRunningDiscovery.set(false);
    }
  }

  async saveSeedFromDraft(): Promise<void> {
    const overlaySet = this.addedSet();
    const merchant = this.discoveryMerchant();
    const productUrl = this.seedDraftUrl().trim();

    if (!overlaySet || !merchant || !productUrl) {
      this.discoveryMessage.set(
        'Kies eerst een kandidaat of vul een product-URL in.',
      );
      this.discoveryMessageTone.set('danger');
      return;
    }

    this.isSavingSeed.set(true);

    try {
      await this.commerceAdminStore.saveOfferSeed({
        discoveryCandidateId: this.selectedCandidateId() ?? undefined,
        input: {
          setId: overlaySet.setId,
          merchantId: merchant.id,
          productUrl,
          isActive: true,
          validationStatus: 'pending',
          notes: '',
        },
      });

      this.discoveryMessage.set('Offer seed opgeslagen voor deze set.');
      this.discoveryMessageTone.set('positive');
    } catch (error) {
      this.discoveryMessage.set(
        error instanceof Error
          ? error.message
          : 'Offer seed kon niet worden opgeslagen.',
      );
      this.discoveryMessageTone.set('danger');
    } finally {
      this.isSavingSeed.set(false);
    }
  }

  async approveCandidate(candidate: CommerceDiscoveryCandidate): Promise<void> {
    this.isUpdatingCandidateId.set(candidate.id);
    this.discoveryMessage.set(null);
    this.discoveryMessageTone.set(null);

    try {
      const result = await this.commerceAdminStore.approveDiscoveryCandidate(
        candidate.id,
      );

      this.discoveryMessage.set(result.message);
      this.discoveryMessageTone.set('positive');
    } catch (error) {
      this.discoveryMessage.set(
        error instanceof Error
          ? error.message
          : 'Kandidaat kon niet worden goedgekeurd.',
      );
      this.discoveryMessageTone.set('danger');
    } finally {
      this.isUpdatingCandidateId.set(null);
    }
  }

  async rejectCandidate(candidate: CommerceDiscoveryCandidate): Promise<void> {
    this.isUpdatingCandidateId.set(candidate.id);
    this.discoveryMessage.set(null);
    this.discoveryMessageTone.set(null);

    try {
      await this.commerceAdminStore.rejectDiscoveryCandidate(candidate.id);
      this.discoveryMessage.set('Kandidaat gemarkeerd als afgewezen.');
      this.discoveryMessageTone.set('positive');
    } catch (error) {
      this.discoveryMessage.set(
        error instanceof Error
          ? error.message
          : 'Kandidaat kon niet worden afgewezen.',
      );
      this.discoveryMessageTone.set('danger');
    } finally {
      this.isUpdatingCandidateId.set(null);
    }
  }
}
