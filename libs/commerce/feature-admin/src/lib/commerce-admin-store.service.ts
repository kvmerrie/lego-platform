import { Injectable, computed, inject, signal } from '@angular/core';
import { listCatalogSetSummaries } from '@lego-platform/catalog/data-access';
import {
  buildCommerceBenchmarkCoverageRows,
  buildCommerceCoverageSnapshot,
  type CommerceBenchmarkCoverageRow,
  type CommerceBenchmarkMerchantCoverageStatus,
  type CommerceBenchmarkSet,
  type CommerceCoverageSetOption,
  type CommerceMerchant,
  type CommerceMerchantInput,
  type CommerceOfferSeed,
  type CommerceOfferSeedInput,
  validateCommerceBenchmarkSetInput,
  validateCommerceMerchantInput,
  validateCommerceOfferSeedInput,
} from '@lego-platform/commerce/util';
import { CommerceAdminApiService } from './commerce-admin-api.service';

export interface CommerceCatalogSetOption extends CommerceCoverageSetOption {
  collectorAngle?: string;
  slug: string;
}

const catalogSetOptions = [...listCatalogSetSummaries()]
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

  readonly catalogSetOptions = catalogSetOptions;
  readonly benchmarkSets = signal<CommerceBenchmarkSet[]>([]);
  readonly merchants = signal<CommerceMerchant[]>([]);
  readonly offerSeeds = signal<CommerceOfferSeed[]>([]);
  readonly isLoading = signal(false);
  readonly hasLoaded = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly benchmarkSetIds = computed(
    () =>
      new Set(this.benchmarkSets().map((benchmarkSet) => benchmarkSet.setId)),
  );
  readonly coverage = computed(() =>
    buildCommerceCoverageSnapshot({
      catalogSets: this.catalogSetOptions,
      merchants: this.merchants(),
      offerSeeds: this.offerSeeds(),
    }),
  );
  readonly benchmarkCoverageRows = computed(() =>
    buildCommerceBenchmarkCoverageRows({
      benchmarkSets: this.benchmarkSets(),
      catalogSets: this.catalogSetOptions,
      merchants: this.merchants(),
      offerSeeds: this.offerSeeds(),
    }),
  );
  readonly benchmarkCatalogSetOptions = computed(() =>
    this.catalogSetOptions.filter(
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
      const [benchmarkSets, merchants, offerSeeds] = await Promise.all([
        this.commerceAdminApi.listBenchmarkSets(),
        this.commerceAdminApi.listMerchants(),
        this.commerceAdminApi.listOfferSeeds(),
      ]);

      this.benchmarkSets.set(benchmarkSets);
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
        await this.commerceAdminApi.createOfferSeed(validatedInput);
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

  getCatalogSetById(setId: string): CommerceCatalogSetOption | undefined {
    return this.catalogSetOptions.find(
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

  getMerchantActiveSeedCount(merchantId: string): number {
    return this.merchantActiveSeedCounts().get(merchantId) ?? 0;
  }

  isBenchmarkSet(setId: string): boolean {
    return this.benchmarkSetIds().has(setId);
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
}
