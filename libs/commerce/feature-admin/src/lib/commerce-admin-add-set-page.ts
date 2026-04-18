import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  type CatalogExternalSetSearchResult,
  type CatalogOverlaySet,
} from '@lego-platform/catalog/util';
import {
  type CommerceDiscoveryCandidate,
  type CommerceMerchant,
} from '@lego-platform/commerce/util';
import { CommerceAdminStore } from './commerce-admin-store.service';

type AdminFeedbackTone = 'danger' | 'neutral' | 'positive' | null;
type NewSetStepStatus = 'active' | 'complete' | 'upcoming';

@Component({
  selector: 'lego-commerce-admin-add-set-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './commerce-admin-add-set-page.html',
  styles: [
    `
      :host {
        display: block;
      }

      .admin-new-set {
        display: grid;
        gap: 1rem;
      }

      .admin-new-set__stepper {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .admin-new-set__step {
        background: color-mix(
          in srgb,
          var(--lego-surface-muted) 76%,
          transparent
        );
        border: 1px solid var(--lego-border-subtle);
        border-radius: var(--lego-radius-md);
        display: grid;
        gap: 0.35rem;
        min-height: 100%;
        padding: 0.9rem 1rem;
      }

      .admin-new-set__step.is-active {
        background: color-mix(
          in srgb,
          var(--lego-accent) 8%,
          var(--lego-surface)
        );
        border-color: color-mix(
          in srgb,
          var(--lego-accent) 38%,
          var(--lego-border) 62%
        );
      }

      .admin-new-set__step.is-complete {
        background: color-mix(in srgb, #16a34a 8%, var(--lego-surface));
        border-color: color-mix(in srgb, #16a34a 22%, var(--lego-border) 78%);
      }

      .admin-new-set__step-index {
        color: var(--lego-text-muted);
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .admin-new-set__step-title {
        color: var(--lego-text);
        font-weight: 700;
      }

      .admin-new-set__step-hint {
        color: var(--lego-text-muted);
        font-size: 0.92rem;
        line-height: 1.4;
      }

      .admin-new-set__status {
        display: grid;
        gap: 0.75rem;
      }

      .admin-new-set__status-actions {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        gap: 0.65rem;
      }

      .admin-new-set__activation-shell {
        display: grid;
        gap: 1rem;
      }

      .admin-new-set__merchant-picker {
        align-items: end;
        display: grid;
        gap: 0.75rem;
      }

      .admin-new-set__merchant-summary {
        display: grid;
        gap: 0.45rem;
      }

      .admin-new-set__candidate-section {
        display: grid;
        gap: 0.9rem;
      }

      .admin-new-set__helper-link {
        color: inherit;
        text-decoration: underline;
        text-underline-offset: 0.18em;
      }

      .admin-new-set__success {
        background: color-mix(in srgb, #16a34a 6%, var(--lego-surface));
      }

      .admin-bullet-list {
        display: grid;
        gap: 0.55rem;
        margin: 0;
        padding-left: 1rem;
      }

      .admin-bullet-list li {
        color: var(--lego-text);
      }

      @media (min-width: 1100px) {
        .admin-new-set__activation-shell {
          align-items: start;
          grid-template-columns: minmax(0, 1.3fr) minmax(20rem, 0.85fr);
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommerceAdminAddSetPageComponent {
  readonly commerceAdminStore = inject(CommerceAdminStore);
  readonly searchQuery = signal('');
  readonly searchResults = signal<CatalogExternalSetSearchResult[]>([]);
  readonly selectedResult = signal<CatalogExternalSetSearchResult | null>(null);
  readonly addedSet = signal<CatalogOverlaySet | null>(null);
  readonly activationMerchantId = signal('');
  readonly feedback = signal<string | null>(null);
  readonly feedbackTone = signal<AdminFeedbackTone>(null);
  readonly discoveryMessage = signal<string | null>(null);
  readonly discoveryMessageTone = signal<AdminFeedbackTone>(null);
  readonly isSearching = signal(false);
  readonly isAdding = signal(false);
  readonly isRunningDiscovery = signal(false);
  readonly isSavingSeed = signal(false);
  readonly isUpdatingCandidateId = signal<string | null>(null);
  readonly selectedCandidateId = signal<string | null>(null);
  readonly seedDraftUrl = signal('');

  readonly activeMerchants = computed(() =>
    [...this.commerceAdminStore.merchants()]
      .filter((merchant) => merchant.isActive)
      .sort((left, right) => {
        const leftDiscovery = Number(
          this.commerceAdminStore.supportsMerchantDiscovery(left.id),
        );
        const rightDiscovery = Number(
          this.commerceAdminStore.supportsMerchantDiscovery(right.id),
        );

        return (
          rightDiscovery - leftDiscovery || left.name.localeCompare(right.name)
        );
      }),
  );

  readonly activationMerchant = computed<CommerceMerchant | undefined>(
    () =>
      this.activeMerchants().find(
        (merchant) => merchant.id === this.activationMerchantId(),
      ) ?? this.activeMerchants()[0],
  );

  readonly supportsActivationDiscovery = computed(() => {
    const merchant = this.activationMerchant();

    return merchant
      ? this.commerceAdminStore.supportsMerchantDiscovery(merchant.id)
      : false;
  });

  readonly activationMerchantSearchUrl = computed(() => {
    const overlaySet = this.addedSet();
    const merchant = this.activationMerchant();

    if (!overlaySet || !merchant) {
      return undefined;
    }

    return this.commerceAdminStore.getMerchantSearchUrl({
      merchantId: merchant.id,
      setId: overlaySet.setId,
    });
  });

  readonly discoveryCandidates = computed(() => {
    const overlaySet = this.addedSet();
    const merchant = this.activationMerchant();

    if (!overlaySet || !merchant) {
      return [];
    }

    return this.commerceAdminStore.getDiscoveryCandidatesForSetMerchant({
      merchantId: merchant.id,
      setId: overlaySet.setId,
    });
  });

  readonly latestDiscoveryRun = computed(() => {
    const overlaySet = this.addedSet();
    const merchant = this.activationMerchant();

    if (!overlaySet || !merchant) {
      return undefined;
    }

    return this.commerceAdminStore.getLatestDiscoveryRun({
      merchantId: merchant.id,
      setId: overlaySet.setId,
    });
  });

  readonly addedSetCoverageRow = computed(() => {
    const overlaySet = this.addedSet();

    if (!overlaySet) {
      return null;
    }

    return (
      this.commerceAdminStore
        .coverageQueueRows()
        .find((row) => row.setId === overlaySet.setId) ?? null
    );
  });

  readonly validMerchantCount = computed(
    () => this.addedSetCoverageRow()?.validMerchantCount ?? 0,
  );

  readonly activeSeedCount = computed(() => {
    const coverageRow = this.addedSetCoverageRow();
    const overlaySet = this.addedSet();

    if (coverageRow) {
      return coverageRow.activeSeedCount;
    }

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

  readonly hasFirstValidOffer = computed(() => this.validMerchantCount() > 0);

  readonly publicSetUrl = computed(() => {
    const overlaySet = this.addedSet();

    return overlaySet
      ? this.commerceAdminStore.getPublicSetUrl(overlaySet.setId)
      : undefined;
  });

  readonly flowSteps = computed(() => {
    const hasSelection = !!this.selectedResult();
    const hasAddedSet = !!this.addedSet();
    const hasValidOffer = this.hasFirstValidOffer();
    const hasSearchContext =
      this.searchResults().length > 0 || hasSelection || hasAddedSet;

    const buildStatus = (
      step: 'search' | 'confirm' | 'overlay' | 'activation' | 'success',
    ): NewSetStepStatus => {
      switch (step) {
        case 'search':
          return hasSearchContext ? 'complete' : 'active';
        case 'confirm':
          return hasAddedSet
            ? 'complete'
            : hasSelection
              ? 'active'
              : 'upcoming';
        case 'overlay':
          return hasAddedSet
            ? 'complete'
            : hasSelection
              ? 'active'
              : 'upcoming';
        case 'activation':
          return hasValidOffer
            ? 'complete'
            : hasAddedSet
              ? 'active'
              : 'upcoming';
        case 'success':
          return hasValidOffer ? 'active' : 'upcoming';
        default:
          return 'upcoming';
      }
    };

    return [
      {
        hint: 'Vind een missende set in Rebrickable.',
        label: 'Zoek set',
        status: buildStatus('search'),
      },
      {
        hint: 'Controleer of dit echt de juiste set is.',
        label: 'Bevestig set',
        status: buildStatus('confirm'),
      },
      {
        hint: 'Zet de set in de overlay-catalogus.',
        label: 'Voeg toe',
        status: buildStatus('overlay'),
      },
      {
        hint: 'Pak meteen de eerste merchantroute op.',
        label: 'Eerste offer live',
        status: buildStatus('activation'),
      },
      {
        hint: 'Open de pagina of werk verder in Workbench.',
        label: 'Klaar',
        status: buildStatus('success'),
      },
    ] as const;
  });

  readonly activationSummary = computed(() => {
    const merchant = this.activationMerchant();

    if (this.hasFirstValidOffer()) {
      return `Deze set heeft nu ${this.validMerchantCount()} geldige merchant${
        this.validMerchantCount() === 1 ? '' : 's'
      }.`;
    }

    if (this.activeSeedCount() > 0) {
      return `Er staat al ${this.activeSeedCount()} actieve seed${
        this.activeSeedCount() === 1 ? '' : 's'
      } klaar. De set is toegevoegd, maar nog niet live als geldige deal.`;
    }

    if (!merchant) {
      return 'Kies of activeer eerst een merchant om deze set verder te brengen.';
    }

    if (this.supportsActivationDiscovery()) {
      return `Volgende stap: draai discovery bij ${merchant.name} en kies daarna de beste kandidaat.`;
    }

    return `Volgende stap: voeg handmatig de eerste seed toe voor ${merchant.name}.`;
  });

  constructor() {
    effect(
      () => {
        const merchants = this.activeMerchants();
        const activationMerchantId = this.activationMerchantId();

        if (merchants.length === 0) {
          if (activationMerchantId) {
            this.activationMerchantId.set('');
          }

          return;
        }

        const currentMerchantStillExists = merchants.some(
          (merchant) => merchant.id === activationMerchantId,
        );

        if (!activationMerchantId || !currentMerchantStillExists) {
          const preferredMerchant =
            merchants.find((merchant) =>
              this.commerceAdminStore.supportsMerchantDiscovery(merchant.id),
            ) ?? merchants[0];

          this.activationMerchantId.set(preferredMerchant?.id ?? '');
        }
      },
      { allowSignalWrites: true },
    );
  }

  updateSearchQuery(value: string): void {
    this.searchQuery.set(value);
  }

  updateActivationMerchant(value: string): void {
    this.activationMerchantId.set(value);
    this.selectedCandidateId.set(null);
    this.seedDraftUrl.set('');
    this.discoveryMessage.set(null);
    this.discoveryMessageTone.set(null);
  }

  selectSearchResult(result: CatalogExternalSetSearchResult): void {
    this.selectedResult.set(result);
    this.addedSet.set(null);
    this.feedback.set(null);
    this.feedbackTone.set(null);
    this.discoveryMessage.set(null);
    this.discoveryMessageTone.set(null);
    this.selectedCandidateId.set(null);
    this.seedDraftUrl.set('');
  }

  useCandidate(candidate: CommerceDiscoveryCandidate): void {
    this.selectedCandidateId.set(candidate.id);
    this.seedDraftUrl.set(candidate.canonicalUrl ?? candidate.candidateUrl);
    this.discoveryMessage.set(
      'Kandidaat overgenomen. Controleer de URL nog één keer en sla daarna de seed op.',
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
      this.discoveryMessage.set(null);
      this.discoveryMessageTone.set(null);
      this.selectedCandidateId.set(null);
      this.seedDraftUrl.set('');

      this.feedback.set(
        results.length === 0
          ? 'Geen missende sets gevonden. Deze set zit waarschijnlijk al in Brickhunt.'
          : `${results.length} missende set${
              results.length === 1 ? '' : 's'
            } klaar om toe te voegen.`,
      );
      this.feedbackTone.set(results.length === 0 ? 'neutral' : 'positive');
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

      const merchant = this.activationMerchant();

      this.discoveryMessage.set(
        merchant
          ? this.commerceAdminStore.supportsMerchantDiscovery(merchant.id)
            ? `Set toegevoegd. Volgende stap: run discovery bij ${merchant.name}.`
            : `Set toegevoegd. Volgende stap: voeg handmatig een seed toe voor ${merchant.name}.`
          : 'Set toegevoegd. Kies nu de merchant waarmee je de eerste route live zet.',
      );
      this.discoveryMessageTone.set('neutral');
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
    const merchant = this.activationMerchant();

    this.discoveryMessage.set(null);
    this.discoveryMessageTone.set(null);

    if (!overlaySet || !merchant) {
      this.discoveryMessage.set(
        'Voeg eerst een set toe en kies daarna een merchant.',
      );
      this.discoveryMessageTone.set('danger');
      return;
    }

    if (!this.supportsActivationDiscovery()) {
      this.discoveryMessage.set(
        `${merchant.name} heeft hier nog geen discovery-ondersteuning. Ga direct door met een handmatige seed.`,
      );
      this.discoveryMessageTone.set('neutral');
      return;
    }

    this.isRunningDiscovery.set(true);

    try {
      const result = await this.commerceAdminStore.runDiscovery({
        merchantId: merchant.id,
        setId: overlaySet.setId,
      });

      if (result.run.status === 'success' && result.run.candidateCount > 0) {
        this.discoveryMessage.set(
          `${result.run.candidateCount} kandidaat${
            result.run.candidateCount === 1 ? '' : 'en'
          } gevonden voor ${overlaySet.name}. Kies er één of vul hieronder meteen handmatig een URL in.`,
        );
        this.discoveryMessageTone.set('positive');
      } else if (result.run.status === 'success') {
        this.discoveryMessage.set(
          `${merchant.name} is gecheckt, maar leverde nog geen bruikbare kandidaat op. Ga hieronder verder met een handmatige seed.`,
        );
        this.discoveryMessageTone.set('neutral');
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
    const merchant = this.activationMerchant();
    const productUrl = this.seedDraftUrl().trim();

    if (!overlaySet || !merchant || !productUrl) {
      this.discoveryMessage.set(
        'Kies eerst een kandidaat of vul handmatig een product-URL in.',
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

      this.discoveryMessage.set(
        this.hasFirstValidOffer()
          ? 'Eerste geldige offer staat live voor deze set.'
          : 'Seed opgeslagen. De set is toegevoegd en de eerste route staat klaar.',
      );
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
