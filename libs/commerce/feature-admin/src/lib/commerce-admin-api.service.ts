import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  type CatalogExternalSetSearchResult,
  type CatalogSet,
  type CatalogSetSummary,
} from '@lego-platform/catalog/util';
import {
  type CommerceBenchmarkSet,
  type CommerceCoverageQueueRow,
  type CommerceMerchant,
  type CommerceMerchantInput,
  type CommerceOfferSeed,
  type CommerceOfferSeedInput,
  type CommerceSetRefreshResult,
} from '@lego-platform/commerce/util';
import { apiPaths } from '@lego-platform/shared/config';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CommerceAdminApiService {
  private readonly http = inject(HttpClient);

  async listCatalogSets(): Promise<CatalogSetSummary[]> {
    return firstValueFrom(
      this.http.get<CatalogSetSummary[]>(apiPaths.adminCatalogSets),
    );
  }

  async searchCatalogMissingSets(
    query: string,
  ): Promise<CatalogExternalSetSearchResult[]> {
    return firstValueFrom(
      this.http.get<CatalogExternalSetSearchResult[]>(
        apiPaths.adminCatalogSetSearch,
        {
          params: {
            query,
          },
        },
      ),
    );
  }

  async createCatalogSet(
    input: CatalogExternalSetSearchResult,
  ): Promise<CatalogSet> {
    return firstValueFrom(
      this.http.post<CatalogSet>(apiPaths.adminCatalogSets, input),
    );
  }

  async listBenchmarkSets(): Promise<CommerceBenchmarkSet[]> {
    return firstValueFrom(
      this.http.get<CommerceBenchmarkSet[]>(
        apiPaths.adminCommerceBenchmarkSets,
      ),
    );
  }

  async listCoverageQueue(): Promise<CommerceCoverageQueueRow[]> {
    return firstValueFrom(
      this.http.get<CommerceCoverageQueueRow[]>(
        apiPaths.adminCommerceCoverageQueue,
      ),
    );
  }

  async refreshSet(setId: string): Promise<CommerceSetRefreshResult> {
    return firstValueFrom(
      this.http.post<CommerceSetRefreshResult>(
        apiPaths.adminCommerceSetRefreshes,
        { setId },
      ),
    );
  }

  async createBenchmarkSet(input: {
    notes?: string;
    setId: string;
  }): Promise<CommerceBenchmarkSet> {
    return firstValueFrom(
      this.http.post<CommerceBenchmarkSet>(
        apiPaths.adminCommerceBenchmarkSets,
        input,
      ),
    );
  }

  async deleteBenchmarkSet(setId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(`${apiPaths.adminCommerceBenchmarkSets}/${setId}`),
    );
  }

  async listMerchants(): Promise<CommerceMerchant[]> {
    return firstValueFrom(
      this.http.get<CommerceMerchant[]>(apiPaths.adminCommerceMerchants),
    );
  }

  async createMerchant(
    input: CommerceMerchantInput,
  ): Promise<CommerceMerchant> {
    return firstValueFrom(
      this.http.post<CommerceMerchant>(apiPaths.adminCommerceMerchants, input),
    );
  }

  async updateMerchant(input: {
    input: CommerceMerchantInput;
    merchantId: string;
  }): Promise<CommerceMerchant> {
    return firstValueFrom(
      this.http.put<CommerceMerchant>(
        `${apiPaths.adminCommerceMerchants}/${input.merchantId}`,
        input.input,
      ),
    );
  }

  async listOfferSeeds(): Promise<CommerceOfferSeed[]> {
    return firstValueFrom(
      this.http.get<CommerceOfferSeed[]>(apiPaths.adminCommerceOfferSeeds),
    );
  }

  async createOfferSeed(
    input: CommerceOfferSeedInput,
  ): Promise<CommerceOfferSeed> {
    return firstValueFrom(
      this.http.post<CommerceOfferSeed>(
        apiPaths.adminCommerceOfferSeeds,
        input,
      ),
    );
  }

  async updateOfferSeed(input: {
    input: CommerceOfferSeedInput;
    offerSeedId: string;
  }): Promise<CommerceOfferSeed> {
    return firstValueFrom(
      this.http.put<CommerceOfferSeed>(
        `${apiPaths.adminCommerceOfferSeeds}/${input.offerSeedId}`,
        input.input,
      ),
    );
  }
}
