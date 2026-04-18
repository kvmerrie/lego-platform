import { Injectable, computed, inject, signal } from '@angular/core';
import {
  type CatalogExternalSetSearchResult,
  type CatalogOverlaySet,
  type CatalogSetSummary,
} from '@lego-platform/catalog/util';
import { listCatalogSetSummaries } from '@lego-platform/catalog/data-access';
import { buildPublicSetDetailUrl } from '@lego-platform/shared/config';
import {
  type CommerceDiscoveryApprovalResult,
  type CommerceDiscoveryCandidate,
  type CommerceDiscoveryCandidateReviewStatus,
  type CommerceDiscoveryCandidateStatus,
  type CommerceDiscoveryRun,
  type CommerceDiscoveryRunInput,
  buildCommerceMerchantSearchQuery,
  buildCommerceMerchantSearchUrl,
  buildCommerceBenchmarkCoverageRows,
  type CommerceCoverageQueueMerchantState,
  type CommerceCoverageQueueMerchantStatus,
  type CommerceCoverageQueueHealthFilter,
  type CommerceCoverageQueueNextAction,
  type CommerceCoverageQueuePriorityFilter,
  type CommerceCoverageQueueRow,
  type CommerceCoverageQueueSourceFilter,
  buildCommerceCoverageSnapshot,
  type CommerceBenchmarkCoverageRow,
  type CommerceBenchmarkMerchantCoverageStatus,
  type CommerceBenchmarkSet,
  type CommerceCoverageSetOption,
  type CommerceMerchant,
  type CommerceMerchantInput,
  type CommerceOfferSeed,
  type CommerceOfferSeedInput,
  type CommerceSetRefreshResult,
  supportsCommerceMerchantDiscovery,
  validateCommerceDiscoveryRunInput,
  validateCommerceBenchmarkSetInput,
  validateCommerceMerchantInput,
  validateCommerceOfferSeedInput,
} from '@lego-platform/commerce/util';
import { CommerceAdminApiService } from './commerce-admin-api.service';

export interface CommerceCatalogSetOption extends CommerceCoverageSetOption {
  collectorAngle?: string;
  slug: string;
}

export interface CommerceWorkbenchViewState {
  healthFilter: CommerceCoverageQueueHealthFilter;
  merchantGapFilter: string;
  priorityFilter: CommerceCoverageQueuePriorityFilter;
  search: string;
  sourceFilter: CommerceCoverageQueueSourceFilter;
}

export interface CommerceSetsViewState {
  healthFilter: CommerceCoverageQueueHealthFilter;
  priorityFilter: CommerceCoverageQueuePriorityFilter;
  search: string;
  sourceFilter: CommerceCoverageQueueSourceFilter;
}

export type CommerceCoverageQueueMerchantActionType =
  | 'open_discovery'
  | 'open_seed';

export interface CommerceCoverageQueueMerchantAction {
  label: string;
  type: CommerceCoverageQueueMerchantActionType;
}

const initialCatalogSetOptions = [...listCatalogSetSummaries()]
  .sort(
    (left, right) =>
      left.theme.localeCompare(right.theme) ||
      left.name.localeCompare(right.name),
  )
  .map(
    (catalogSetSummary): CommerceCatalogSetOption => ({
      id: catalogSetSummary.id,
      name: catalogSetSummary.name,
      theme: catalogSetSummary.theme,
      slug: catalogSetSummary.slug,
      collectorAngle: catalogSetSummary.collectorAngle,
    }),
  );

const initialWorkbenchViewState: CommerceWorkbenchViewState = {
  search: '',
  healthFilter: 'under_covered',
  sourceFilter: 'all',
  priorityFilter: 'all',
  merchantGapFilter: 'all',
};

const initialSetsViewState: CommerceSetsViewState = {
  search: '',
  sourceFilter: 'all',
  healthFilter: 'all',
  priorityFilter: 'all',
};

function buildOfferSeedHealthLabel(offerSeed: CommerceOfferSeed): string {
  if (offerSeed.latestOffer?.fetchStatus === 'error') {
    return 'Refresh fout';
  }

  if (offerSeed.latestOffer?.fetchStatus === 'unavailable') {
    return 'Niet leverbaar';
  }

  if (offerSeed.validationStatus === 'invalid') {
    return 'Seed ongeldig';
  }

  if (offerSeed.validationStatus === 'stale') {
    return 'Seed stale';
  }

  if (offerSeed.latestOffer?.fetchStatus === 'success') {
    return 'Refresh ok';
  }

  return 'Nog niet geverifieerd';
}

function buildOfferSeedHealthTone(
  offerSeed: CommerceOfferSeed,
): 'danger' | 'neutral' | 'positive' | 'warning' {
  if (
    offerSeed.latestOffer?.fetchStatus === 'error' ||
    offerSeed.validationStatus === 'invalid'
  ) {
    return 'danger';
  }

  if (
    offerSeed.latestOffer?.fetchStatus === 'unavailable' ||
    offerSeed.validationStatus === 'stale'
  ) {
    return 'warning';
  }

  if (offerSeed.latestOffer?.fetchStatus === 'success') {
    return 'positive';
  }

  return 'neutral';
}

function toApiErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error && 'error' in error) {
    const errorRecord = error as {
      error?: {
        message?: string;
      };
    };

    return (
      errorRecord.error?.message ??
      'De commerce-admin kon de actie niet afronden.'
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'De commerce-admin kon de actie niet afronden.';
}

function formatTimestampForDateTimeLocal(value?: string): string {
  if (!value) {
    return '';
  }

  const parsedValue = new Date(value);

  if (Number.isNaN(parsedValue.getTime())) {
    return '';
  }

  const timezoneOffset = parsedValue.getTimezoneOffset() * 60_000;

  return new Date(parsedValue.getTime() - timezoneOffset)
    .toISOString()
    .slice(0, 16);
}

function toMerchantInput(merchant: CommerceMerchant): CommerceMerchantInput {
  return {
    slug: merchant.slug,
    name: merchant.name,
    isActive: merchant.isActive,
    sourceType: merchant.sourceType,
    affiliateNetwork: merchant.affiliateNetwork,
    notes: merchant.notes,
  };
}

function toOfferSeedInput(
  offerSeed: CommerceOfferSeed,
): CommerceOfferSeedInput {
  return {
    setId: offerSeed.setId,
    merchantId: offerSeed.merchantId,
    productUrl: offerSeed.productUrl,
    isActive: offerSeed.isActive,
    validationStatus: offerSeed.validationStatus,
    lastVerifiedAt: offerSeed.lastVerifiedAt,
    notes: offerSeed.notes,
  };
}

@Injectable({ providedIn: 'root' })
export class CommerceAdminStore {
  private readonly commerceAdminApi = inject(CommerceAdminApiService);

  readonly catalogSetOptions = signal<CommerceCatalogSetOption[]>(
    initialCatalogSetOptions,
  );
  readonly benchmarkSets = signal<CommerceBenchmarkSet[]>([]);
  readonly coverageQueueRows = signal<CommerceCoverageQueueRow[]>([]);
  readonly discoveryRuns = signal<CommerceDiscoveryRun[]>([]);
  readonly discoveryCandidates = signal<CommerceDiscoveryCandidate[]>([]);
  readonly merchants = signal<CommerceMerchant[]>([]);
  readonly offerSeeds = signal<CommerceOfferSeed[]>([]);
  readonly activeSetId = signal<string | null>(null);
  readonly workbenchViewState = signal<CommerceWorkbenchViewState>(
    initialWorkbenchViewState,
  );
  readonly setsViewState = signal<CommerceSetsViewState>(initialSetsViewState);
  readonly isLoading = signal(false);
  readonly hasLoaded = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly benchmarkSetIds = computed(
    () =>
      new Set(this.benchmarkSets().map((benchmarkSet) => benchmarkSet.setId)),
  );
  readonly coverage = computed(() =>
    buildCommerceCoverageSnapshot({
      catalogSets: this.catalogSetOptions(),
      merchants: this.merchants(),
      offerSeeds: this.offerSeeds(),
    }),
  );
  readonly benchmarkCoverageRows = computed(() =>
    buildCommerceBenchmarkCoverageRows({
      benchmarkSets: this.benchmarkSets(),
      catalogSets: this.catalogSetOptions(),
      merchants: this.merchants(),
      offerSeeds: this.offerSeeds(),
    }),
  );
  readonly commerceRelevantCoverageRows = computed(() => {
    const benchmarkSetById = new Map(
      this.benchmarkSets().map(
        (benchmarkSet) => [benchmarkSet.setId, benchmarkSet] as const,
      ),
    );
    const relevantSetIds = new Set(
      this.benchmarkSets().map((benchmarkSet) => benchmarkSet.setId),
    );

    for (const offerSeed of this.offerSeeds()) {
      if (offerSeed.isActive || offerSeed.latestOffer) {
        relevantSetIds.add(offerSeed.setId);
      }
    }

    return buildCommerceBenchmarkCoverageRows({
      benchmarkSets: [...relevantSetIds].map((setId) => {
        const benchmarkSet = benchmarkSetById.get(setId);

        return {
          setId,
          notes: benchmarkSet?.notes ?? '',
          createdAt: benchmarkSet?.createdAt ?? '',
          updatedAt: benchmarkSet?.updatedAt ?? '',
        };
      }),
      catalogSets: this.catalogSetOptions(),
      merchants: this.merchants(),
      offerSeeds: this.offerSeeds(),
    });
  });
  readonly benchmarkCatalogSetOptions = computed(() =>
    this.catalogSetOptions().filter(
      (catalogSetOption) => !this.benchmarkSetIds().has(catalogSetOption.id),
    ),
  );
  readonly coverageIssues = computed(() => [
    ...this.coverage().brokenSeeds,
    ...this.coverage().staleSeeds,
  ]);
  readonly merchantActiveSeedCounts = computed(() => {
    const counts = new Map<string, number>();

    for (const offerSeed of this.offerSeeds()) {
      if (!offerSeed.isActive) {
        continue;
      }

      counts.set(
        offerSeed.merchantId,
        (counts.get(offerSeed.merchantId) ?? 0) + 1,
      );
    }

    return counts;
  });
  readonly discoveryMerchants = computed(() =>
    this.merchants().filter((merchant) =>
      supportsCommerceMerchantDiscovery(merchant.slug),
    ),
  );

  async ensureLoaded(): Promise<void> {
    if (this.hasLoaded() || this.isLoading()) {
      return;
    }

    await this.reload();
  }

  async reload(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      const [
        catalogSets,
        benchmarkSets,
        coverageQueueRows,
        discoveryCandidates,
        discoveryRuns,
        merchants,
        offerSeeds,
      ] = await Promise.all([
        this.commerceAdminApi.listCatalogSets(),
        this.commerceAdminApi.listBenchmarkSets(),
        this.commerceAdminApi.listCoverageQueue(),
        this.commerceAdminApi.listDiscoveryCandidates(),
        this.commerceAdminApi.listDiscoveryRuns(),
        this.commerceAdminApi.listMerchants(),
        this.commerceAdminApi.listOfferSeeds(),
      ]);

      this.catalogSetOptions.set(this.toCatalogSetOptions(catalogSets));
      this.benchmarkSets.set(benchmarkSets);
      this.coverageQueueRows.set(coverageQueueRows);
      this.discoveryCandidates.set(discoveryCandidates);
      this.discoveryRuns.set(discoveryRuns);
      this.merchants.set(merchants);
      this.offerSeeds.set(offerSeeds);
      this.hasLoaded.set(true);
    } catch (error) {
      this.errorMessage.set(toApiErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  async saveMerchant(input: {
    input: CommerceMerchantInput;
    merchantId?: string;
  }): Promise<void> {
    const validatedInput = validateCommerceMerchantInput(input.input);

    try {
      if (input.merchantId) {
        await this.commerceAdminApi.updateMerchant({
          merchantId: input.merchantId,
          input: validatedInput,
        });
      } else {
        await this.commerceAdminApi.createMerchant(validatedInput);
      }

      await this.reload();
    } catch (error) {
      const message = toApiErrorMessage(error);

      this.errorMessage.set(message);
      throw new Error(message);
    }
  }

  async toggleMerchantActive(merchant: CommerceMerchant): Promise<void> {
    await this.saveMerchant({
      merchantId: merchant.id,
      input: {
        ...toMerchantInput(merchant),
        isActive: !merchant.isActive,
      },
    });
  }

  async saveOfferSeed(input: {
    discoveryCandidateId?: string;
    input: CommerceOfferSeedInput;
    offerSeedId?: string;
  }): Promise<void> {
    const validatedInput = validateCommerceOfferSeedInput(input.input);

    try {
      if (input.offerSeedId) {
        await this.commerceAdminApi.updateOfferSeed({
          offerSeedId: input.offerSeedId,
          input: validatedInput,
        });
      } else {
        await this.commerceAdminApi.createOfferSeed({
          input: validatedInput,
          discoveryCandidateId: input.discoveryCandidateId,
        });
      }

      await this.reload();
    } catch (error) {
      const message = toApiErrorMessage(error);

      this.errorMessage.set(message);
      throw new Error(message);
    }
  }

  async toggleOfferSeedActive(offerSeed: CommerceOfferSeed): Promise<void> {
    await this.saveOfferSeed({
      offerSeedId: offerSeed.id,
      input: {
        ...toOfferSeedInput(offerSeed),
        isActive: !offerSeed.isActive,
      },
    });
  }

  async runDiscovery(input: CommerceDiscoveryRunInput): Promise<{
    candidates: CommerceDiscoveryCandidate[];
    run: CommerceDiscoveryRun;
  }> {
    const validatedInput = validateCommerceDiscoveryRunInput(input);

    try {
      const result = await this.commerceAdminApi.runDiscovery(validatedInput);
      await this.reload();
      return result;
    } catch (error) {
      const message = toApiErrorMessage(error);

      this.errorMessage.set(message);
      throw new Error(message);
    }
  }

  async approveDiscoveryCandidate(
    candidateId: string,
  ): Promise<CommerceDiscoveryApprovalResult> {
    try {
      const result =
        await this.commerceAdminApi.approveDiscoveryCandidate(candidateId);
      await this.reload();
      return result;
    } catch (error) {
      const message = toApiErrorMessage(error);

      this.errorMessage.set(message);
      throw new Error(message);
    }
  }

  async rejectDiscoveryCandidate(candidateId: string): Promise<void> {
    try {
      await this.commerceAdminApi.rejectDiscoveryCandidate(candidateId);
      await this.reload();
    } catch (error) {
      const message = toApiErrorMessage(error);

      this.errorMessage.set(message);
      throw new Error(message);
    }
  }

  async addBenchmarkSet(input: {
    notes?: string;
    setId: string;
  }): Promise<void> {
    const validatedInput = validateCommerceBenchmarkSetInput(input);

    try {
      await this.commerceAdminApi.createBenchmarkSet(validatedInput);
      await this.reload();
    } catch (error) {
      const message = toApiErrorMessage(error);

      this.errorMessage.set(message);
      throw new Error(message);
    }
  }

  async removeBenchmarkSet(setId: string): Promise<void> {
    try {
      await this.commerceAdminApi.deleteBenchmarkSet(setId);
      await this.reload();
    } catch (error) {
      const message = toApiErrorMessage(error);

      this.errorMessage.set(message);
      throw new Error(message);
    }
  }

  async searchCatalogMissingSets(
    query: string,
  ): Promise<CatalogExternalSetSearchResult[]> {
    try {
      return await this.commerceAdminApi.searchCatalogMissingSets(query);
    } catch (error) {
      const message = toApiErrorMessage(error);

      this.errorMessage.set(message);
      throw new Error(message);
    }
  }

  async createCatalogOverlaySet(
    input: CatalogExternalSetSearchResult,
  ): Promise<CatalogOverlaySet> {
    try {
      const result = await this.commerceAdminApi.createCatalogOverlaySet(input);
      await this.reload();
      return result;
    } catch (error) {
      const message = toApiErrorMessage(error);

      this.errorMessage.set(message);
      throw new Error(message);
    }
  }

  getCatalogSetById(setId: string): CommerceCatalogSetOption | undefined {
    return this.catalogSetOptions().find(
      (catalogSetOption) => catalogSetOption.id === setId,
    );
  }

  getCatalogSetLabel(setId: string): string {
    const catalogSet = this.getCatalogSetById(setId);

    return catalogSet ? `${catalogSet.name} (${catalogSet.id})` : setId;
  }

  getMerchantName(merchantId: string): string {
    return (
      this.merchants().find((merchant) => merchant.id === merchantId)?.name ??
      merchantId
    );
  }

  getMerchantById(merchantId: string): CommerceMerchant | undefined {
    return this.merchants().find((merchant) => merchant.id === merchantId);
  }

  supportsMerchantDiscovery(merchantId: string): boolean {
    const merchant = this.getMerchantById(merchantId);

    return merchant ? supportsCommerceMerchantDiscovery(merchant.slug) : false;
  }

  async refreshSet(setId: string): Promise<CommerceSetRefreshResult> {
    try {
      const result = await this.commerceAdminApi.refreshSet(setId);
      await this.reload();
      return result;
    } catch (error) {
      const message = toApiErrorMessage(error);

      this.errorMessage.set(message);
      throw new Error(message);
    }
  }

  getMerchantActiveSeedCount(merchantId: string): number {
    return this.merchantActiveSeedCounts().get(merchantId) ?? 0;
  }

  isBenchmarkSet(setId: string): boolean {
    return this.benchmarkSetIds().has(setId);
  }

  setActiveSetId(setId: string | null): void {
    this.activeSetId.set(setId?.trim() ? setId : null);
  }

  updateWorkbenchViewState(input: Partial<CommerceWorkbenchViewState>): void {
    this.workbenchViewState.update((state) => ({
      ...state,
      ...input,
    }));
  }

  updateSetsViewState(input: Partial<CommerceSetsViewState>): void {
    this.setsViewState.update((state) => ({
      ...state,
      ...input,
    }));
  }

  buildSetFocusQueryParams(setId?: string | null): Record<string, string> {
    return setId?.trim()
      ? {
          set: setId.trim(),
        }
      : {};
  }

  getPublicSetUrl(setId: string): string | undefined {
    const catalogSet = this.getCatalogSetById(setId);

    if (!catalogSet?.slug) {
      return undefined;
    }

    return buildPublicSetDetailUrl({
      slug: catalogSet.slug,
      currentOrigin:
        typeof window === 'undefined' ? undefined : window.location.origin,
    });
  }

  getMerchantSearchUrl(input: {
    merchantId: string;
    setId: string;
  }): string | undefined {
    const merchant = this.getMerchantById(input.merchantId);
    const catalogSet = this.getCatalogSetById(input.setId);

    if (!merchant || !catalogSet) {
      return undefined;
    }

    const query = buildCommerceMerchantSearchQuery({
      setId: catalogSet.id,
    });

    return buildCommerceMerchantSearchUrl({
      merchantSlug: merchant.slug,
      query,
    });
  }

  getLatestDiscoveryRun(input: {
    merchantId: string;
    setId: string;
  }): CommerceDiscoveryRun | undefined {
    return this.discoveryRuns().find(
      (run) => run.merchantId === input.merchantId && run.setId === input.setId,
    );
  }

  getDiscoveryCandidatesForSetMerchant(input: {
    merchantId: string;
    setId: string;
  }): CommerceDiscoveryCandidate[] {
    const runById = new Map(
      this.discoveryRuns().map((run) => [run.id, run] as const),
    );

    return this.discoveryCandidates()
      .filter(
        (candidate) =>
          candidate.merchantId === input.merchantId &&
          candidate.setId === input.setId,
      )
      .sort((left, right) => {
        const leftRunCreatedAt =
          runById.get(left.discoveryRunId)?.createdAt ?? left.createdAt;
        const rightRunCreatedAt =
          runById.get(right.discoveryRunId)?.createdAt ?? right.createdAt;

        return (
          rightRunCreatedAt.localeCompare(leftRunCreatedAt) ||
          right.confidenceScore - left.confidenceScore ||
          left.sourceRank - right.sourceRank
        );
      });
  }

  getOfferSeedHealthLabel(offerSeed: CommerceOfferSeed): string {
    return buildOfferSeedHealthLabel(offerSeed);
  }

  getOfferSeedHealthTone(
    offerSeed: CommerceOfferSeed,
  ): 'danger' | 'neutral' | 'positive' | 'warning' {
    return buildOfferSeedHealthTone(offerSeed);
  }

  getBenchmarkMerchantCoverageTone(
    status: CommerceBenchmarkMerchantCoverageStatus,
  ): 'danger' | 'neutral' | 'positive' | 'warning' {
    switch (status) {
      case 'covered':
        return 'positive';
      case 'review':
        return 'warning';
      case 'missing':
        return 'danger';
      case 'pending':
      default:
        return 'neutral';
    }
  }

  getBenchmarkCoverageSummary(
    benchmarkCoverageRow: CommerceBenchmarkCoverageRow,
  ): string {
    return `${benchmarkCoverageRow.latestValidMerchantCount}/${benchmarkCoverageRow.activeMerchantTargetCount} merchants valide`;
  }

  getMerchantCoverageTitle(input: {
    offerSeed?: CommerceOfferSeed;
    status: CommerceBenchmarkMerchantCoverageStatus;
  }): string | null {
    if (input.offerSeed?.productUrl) {
      return input.offerSeed.productUrl;
    }

    if (input.status === 'missing') {
      return 'Nog geen seed';
    }

    if (input.offerSeed) {
      return 'Nog geen product-URL';
    }

    return null;
  }

  getDiscoveryRunTone(
    status: CommerceDiscoveryRun['status'],
  ): 'danger' | 'neutral' | 'positive' {
    switch (status) {
      case 'success':
        return 'positive';
      case 'failed':
        return 'danger';
      case 'running':
      default:
        return 'neutral';
    }
  }

  getDiscoveryCandidateStatusLabel(
    status: CommerceDiscoveryCandidateStatus,
  ): string {
    switch (status) {
      case 'auto_approved':
        return 'Auto-goedgekeurd';
      case 'needs_review':
        return 'Review nodig';
      case 'rejected':
      default:
        return 'Afgewezen';
    }
  }

  getDiscoveryCandidateStatusTone(
    status: CommerceDiscoveryCandidateStatus,
  ): 'danger' | 'positive' | 'warning' {
    switch (status) {
      case 'auto_approved':
        return 'positive';
      case 'needs_review':
        return 'warning';
      case 'rejected':
      default:
        return 'danger';
    }
  }

  getDiscoveryReviewStatusLabel(
    reviewStatus: CommerceDiscoveryCandidateReviewStatus,
  ): string {
    switch (reviewStatus) {
      case 'approved':
        return 'Goedgekeurd';
      case 'rejected':
        return 'Afgewezen';
      case 'pending':
      default:
        return 'Wacht op review';
    }
  }

  getDiscoveryReviewStatusTone(
    reviewStatus: CommerceDiscoveryCandidateReviewStatus,
  ): 'danger' | 'neutral' | 'positive' {
    switch (reviewStatus) {
      case 'approved':
        return 'positive';
      case 'rejected':
        return 'danger';
      case 'pending':
      default:
        return 'neutral';
    }
  }

  getDiscoveryCandidateLinkLabel(
    candidate: CommerceDiscoveryCandidate,
  ): string {
    return candidate.offerSeedId ? 'Seed gekoppeld' : 'Nog geen seed';
  }

  getDiscoveryCandidateLinkTone(
    candidate: CommerceDiscoveryCandidate,
  ): 'neutral' | 'positive' {
    return candidate.offerSeedId ? 'positive' : 'neutral';
  }

  getDiscoveryAvailabilityLabel(availability?: string): string {
    switch (availability) {
      case 'in_stock':
        return 'Op voorraad';
      case 'limited':
        return 'Beperkt';
      case 'out_of_stock':
        return 'Uitverkocht';
      case 'preorder':
        return 'Pre-order';
      default:
        return 'Onbekend';
    }
  }

  getCoverageQueueActionLabel(action: CommerceCoverageQueueNextAction): string {
    switch (action) {
      case 'run_discovery':
        return 'Run discovery';
      case 'review_candidates':
        return 'Review candidates';
      case 'edit_seed':
        return 'Seed bijwerken';
      case 'add_seed_manually':
        return 'Seed toevoegen';
      case 'recheck_later':
        return 'Later opnieuw checken';
      case 'no_action_needed':
      default:
        return 'Geen actie nodig';
    }
  }

  getCoverageQueueMerchantAction(
    row: CommerceCoverageQueueRow,
    merchantStatus: CommerceCoverageQueueMerchantStatus,
  ): CommerceCoverageQueueMerchantAction {
    switch (merchantStatus.state) {
      case 'pending':
      case 'review':
        return {
          type: 'open_discovery',
          label: 'Open discovery',
        };
      case 'not_available_confirmed':
        return this.supportsMerchantDiscovery(merchantStatus.merchantId)
          ? {
              type: 'open_discovery',
              label: 'Open laatste check',
            }
          : {
              type: 'open_seed',
              label: merchantStatus.offerSeed
                ? 'Bekijk seed'
                : 'Seed toevoegen',
            };
      case 'stale':
      case 'unavailable':
      case 'valid':
        return {
          type: 'open_seed',
          label: merchantStatus.offerSeed ? 'Bekijk seed' : 'Seed toevoegen',
        };
      case 'missing':
      default:
        return {
          type: 'open_seed',
          label:
            row.recommendedMerchantId === merchantStatus.merchantId &&
            row.recommendedNextAction === 'edit_seed'
              ? 'Seed bewerken'
              : 'Seed toevoegen',
        };
    }
  }

  getCoverageQueueMerchantActionLabel(
    row: CommerceCoverageQueueRow,
    merchantStatus: CommerceCoverageQueueMerchantStatus,
  ): string {
    return this.getCoverageQueueMerchantAction(row, merchantStatus).label;
  }

  formatSetRefreshResult(result: CommerceSetRefreshResult): string {
    const parts = [
      `${result.totalCount} seed${result.totalCount === 1 ? '' : 's'} gecheckt`,
    ];

    if (result.successCount > 0) {
      parts.push(
        `${result.successCount} geldig${
          result.successCount === 1 ? '' : 'e'
        } prijs${result.successCount === 1 ? '' : 'en'}`,
      );
    }

    if (result.unavailableCount > 0) {
      parts.push(`${result.unavailableCount} niet leverbaar`);
    }

    if (result.staleCount > 0) {
      parts.push(`${result.staleCount} stale`);
    }

    if (result.invalidCount > 0) {
      parts.push(`${result.invalidCount} ongeldig`);
    }

    return parts.join(' · ');
  }

  getCoverageQueueMerchantStateTone(
    state: CommerceCoverageQueueMerchantState,
  ): 'danger' | 'neutral' | 'positive' | 'warning' {
    switch (state) {
      case 'valid':
        return 'positive';
      case 'review':
      case 'stale':
        return 'warning';
      case 'missing':
      case 'unavailable':
        return 'danger';
      case 'not_available_confirmed':
      case 'pending':
      default:
        return 'neutral';
    }
  }

  getCoverageQueueMerchantStateLabel(
    state: CommerceCoverageQueueMerchantState,
  ): string {
    switch (state) {
      case 'valid':
        return 'valid';
      case 'stale':
        return 'stale';
      case 'unavailable':
        return 'unavailable';
      case 'not_available_confirmed':
        return 'niet beschikbaar';
      case 'review':
        return 'review';
      case 'pending':
        return 'pending';
      case 'missing':
      default:
        return 'mist';
    }
  }

  formatPriceMinor(value?: number, currencyCode = 'EUR'): string {
    if (value === undefined) {
      return 'Nog geen prijs';
    }

    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(value / 100);
  }

  formatTimestampForInput(value?: string): string {
    return formatTimestampForDateTimeLocal(value);
  }

  formatRelativeTimestamp(value?: string): string {
    if (!value) {
      return 'Nog niet gecheckt';
    }

    const parsedValue = new Date(value);

    if (Number.isNaN(parsedValue.getTime())) {
      return value;
    }

    const timeLabel = new Intl.DateTimeFormat('nl-NL', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(parsedValue);
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfValueDay = new Date(
      parsedValue.getFullYear(),
      parsedValue.getMonth(),
      parsedValue.getDate(),
    );
    const dayDiff = Math.round(
      (startOfToday.getTime() - startOfValueDay.getTime()) / 86_400_000,
    );

    if (dayDiff === 0) {
      return `Vandaag om ${timeLabel}`;
    }

    if (dayDiff === 1) {
      return `Gisteren om ${timeLabel}`;
    }

    if (dayDiff === 2) {
      return `Eergisteren om ${timeLabel}`;
    }

    const dateLabel = new Intl.DateTimeFormat('nl-NL', {
      day: 'numeric',
      month: 'short',
    }).format(parsedValue);

    return `${dateLabel} om ${timeLabel}`;
  }

  private toCatalogSetOptions(
    catalogSetSummaries: readonly CatalogSetSummary[],
  ): CommerceCatalogSetOption[] {
    return [...catalogSetSummaries]
      .sort(
        (left, right) =>
          left.theme.localeCompare(right.theme) ||
          left.name.localeCompare(right.name),
      )
      .map(
        (catalogSetSummary): CommerceCatalogSetOption => ({
          id: catalogSetSummary.id,
          name: catalogSetSummary.name,
          theme: catalogSetSummary.theme,
          slug: catalogSetSummary.slug,
          collectorAngle: catalogSetSummary.collectorAngle,
        }),
      );
  }

  formatTimestamp(value?: string): string {
    if (!value) {
      return 'Nog niet gecheckt';
    }

    const parsedValue = new Date(value);

    if (Number.isNaN(parsedValue.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('nl-NL', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(parsedValue);
  }

  getCoverageQueueDiscoveryTargetMerchant(
    row: CommerceCoverageQueueRow,
  ): CommerceCoverageQueueMerchantStatus | undefined {
    const recommendedMerchant = row.recommendedMerchantId
      ? row.merchantStatuses.find(
          (merchantStatus) =>
            merchantStatus.merchantId === row.recommendedMerchantId,
        )
      : undefined;

    if (
      recommendedMerchant &&
      recommendedMerchant.state === 'missing' &&
      this.supportsMerchantDiscovery(recommendedMerchant.merchantId)
    ) {
      return recommendedMerchant;
    }

    return row.merchantStatuses.find(
      (merchantStatus) =>
        merchantStatus.state === 'missing' &&
        this.supportsMerchantDiscovery(merchantStatus.merchantId),
    );
  }

  getCoverageQueueSeedActionMerchant(
    row: CommerceCoverageQueueRow,
  ): CommerceCoverageQueueMerchantStatus | undefined {
    const recommendedMerchant = row.recommendedMerchantId
      ? row.merchantStatuses.find(
          (merchantStatus) =>
            merchantStatus.merchantId === row.recommendedMerchantId,
        )
      : undefined;

    if (recommendedMerchant) {
      return recommendedMerchant;
    }

    return (
      row.merchantStatuses.find((merchantStatus) => merchantStatus.offerSeed) ??
      row.merchantStatuses.find(
        (merchantStatus) => merchantStatus.state !== 'valid',
      ) ??
      row.merchantStatuses[0]
    );
  }

  getCoverageQueueDiscoveryLinkParams(
    row: CommerceCoverageQueueRow,
  ): Record<string, string> {
    return this.getCoverageQueueDiscoveryLinkParamsForMerchant(
      row,
      row.recommendedMerchantId,
    );
  }

  getCoverageQueueDiscoveryLinkParamsForMerchant(
    row: CommerceCoverageQueueRow,
    merchantId?: string,
  ): Record<string, string> {
    return {
      set: row.setId,
      ...(merchantId
        ? {
            merchant: merchantId,
          }
        : {}),
    };
  }
}
