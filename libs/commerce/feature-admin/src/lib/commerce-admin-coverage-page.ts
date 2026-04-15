import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommerceAdminStore } from './commerce-admin-store.service';

@Component({
  selector: 'lego-commerce-admin-coverage-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './commerce-admin-coverage-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommerceAdminCoveragePageComponent {
  readonly commerceAdminStore = inject(CommerceAdminStore);
  readonly selectedBenchmarkSetId = signal('');
  readonly availableBenchmarkSetOptions = computed(() =>
    this.commerceAdminStore.benchmarkCatalogSetOptions(),
  );

  get benchmarkSetSelection(): string {
    const selectedBenchmarkSetId = this.selectedBenchmarkSetId();

    if (
      this.availableBenchmarkSetOptions().some(
        (catalogSetOption) => catalogSetOption.id === selectedBenchmarkSetId,
      )
    ) {
      return selectedBenchmarkSetId;
    }

    return this.availableBenchmarkSetOptions()[0]?.id ?? '';
  }

  updateSelectedBenchmarkSet(value: string): void {
    this.selectedBenchmarkSetId.set(value);
  }

  async addBenchmarkSet(): Promise<void> {
    const setId = this.benchmarkSetSelection;

    if (!setId) {
      return;
    }

    try {
      await this.commerceAdminStore.addBenchmarkSet({
        setId,
      });
      this.selectedBenchmarkSetId.set('');
    } catch {
      return;
    }
  }

  async removeBenchmarkSet(setId: string): Promise<void> {
    try {
      await this.commerceAdminStore.removeBenchmarkSet(setId);
    } catch {
      return;
    }
  }
}
