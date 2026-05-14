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
  CommerceAdminApiService,
  type CommerceAdminCacheRevalidationResult,
} from './commerce-admin-api.service';

interface CacheRevalidationPreset {
  label: string;
  paths: readonly string[];
  reason: string;
  tags: readonly string[];
}

interface BrowserNormalizationResult {
  invalidValues: readonly string[];
  values: readonly string[];
  warnings: readonly string[];
}

const cacheRevalidationPresets: readonly CacheRevalidationPreset[] = [
  {
    label: 'Homepage + Deals',
    paths: ['/', '/deals'],
    reason: 'homepage_deals_refresh',
    tags: ['homepage', 'deals'],
  },
  {
    label: 'Single set page',
    paths: ['/sets/winnie-the-pooh-43300'],
    reason: 'manual_set_fix',
    tags: ['set:43300'],
  },
  {
    label: 'Theme page',
    paths: ['/themes/star-wars'],
    reason: 'theme_page_fix',
    tags: ['themes', 'theme:star-wars'],
  },
  {
    label: 'Promotions',
    paths: ['/', '/deals'],
    reason: 'promotions_refresh',
    tags: ['homepage', 'deals', 'prices'],
  },
  {
    label: 'Recently updated sets',
    paths: [],
    reason: 'recent_set_updates',
    tags: ['sets', 'homepage'],
  },
];

function splitLines(value: string): string[] {
  return value.split(/\r?\n/g);
}

function joinLines(values: readonly string[]): string {
  return values.join('\n');
}

function normalizeBrowserPaths(
  paths: readonly string[],
): BrowserNormalizationResult {
  const values: string[] = [];
  const invalidValues: string[] = [];
  const warnings: string[] = [];
  const seenValues = new Set<string>();

  for (const path of paths) {
    const trimmedPath = path.trim();

    if (!trimmedPath) {
      continue;
    }

    if (
      !trimmedPath.startsWith('/') ||
      trimmedPath.startsWith('//') ||
      /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmedPath) ||
      /\s/.test(trimmedPath)
    ) {
      invalidValues.push(trimmedPath);
      warnings.push(`Ongeldig path: ${trimmedPath}`);
      continue;
    }

    const normalizedPath =
      trimmedPath === '/'
        ? trimmedPath
        : trimmedPath.replace(/\/+$/, '') || '/';

    if (seenValues.has(normalizedPath)) {
      warnings.push(`Dubbel path overgeslagen: ${normalizedPath}`);
      continue;
    }

    seenValues.add(normalizedPath);
    values.push(normalizedPath);
  }

  return {
    invalidValues,
    values,
    warnings,
  };
}

function normalizeBrowserTags(
  tags: readonly string[],
): BrowserNormalizationResult {
  const values: string[] = [];
  const warnings: string[] = [];
  const seenValues = new Set<string>();

  for (const tag of tags) {
    const normalizedTag = tag.trim().toLowerCase();

    if (!normalizedTag) {
      continue;
    }

    if (seenValues.has(normalizedTag)) {
      warnings.push(`Dubbele tag overgeslagen: ${normalizedTag}`);
      continue;
    }

    seenValues.add(normalizedTag);
    values.push(normalizedTag);
  }

  return {
    invalidValues: [],
    values,
    warnings,
  };
}

function validateBrowserReason(reason: string): {
  error?: string;
  reason?: string;
} {
  const normalizedReason = reason.trim();

  if (normalizedReason.length < 3) {
    return {
      error: 'Reason is verplicht en moet minimaal 3 tekens zijn.',
    };
  }

  if (normalizedReason.length > 120) {
    return {
      error: 'Reason mag maximaal 120 tekens zijn.',
    };
  }

  return {
    reason: normalizedReason,
  };
}

function toAdminActionErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error && 'error' in error) {
    const errorRecord = error as {
      error?: {
        message?: string;
      };
    };

    return errorRecord.error?.message ?? 'Cache revalidation failed.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Cache revalidation failed.';
}

@Component({
  selector: 'lego-commerce-admin-cache-revalidation-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './commerce-admin-cache-revalidation-page.html',
  styles: [
    `
      .cache-revalidation-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
      }

      .cache-revalidation-result {
        max-height: 24rem;
        overflow: auto;
        white-space: pre-wrap;
      }

      @media (max-width: 760px) {
        .cache-revalidation-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommerceAdminCacheRevalidationPageComponent {
  private readonly commerceAdminApi = inject(CommerceAdminApiService);
  readonly presets = cacheRevalidationPresets;
  readonly pathsText = signal('/\n/deals');
  readonly tagsText = signal('homepage\ndeals');
  readonly reason = signal('homepage_hotfix');
  readonly isRunning = signal(false);
  readonly message = signal<string | null>(null);
  readonly result = signal<CommerceAdminCacheRevalidationResult | null>(null);
  readonly clientWarnings = computed(() => {
    const paths = normalizeBrowserPaths(splitLines(this.pathsText()));
    const tags = normalizeBrowserTags(splitLines(this.tagsText()));
    const warnings = [...paths.warnings, ...tags.warnings];
    const reasonValidation = validateBrowserReason(this.reason());

    if (reasonValidation.error) {
      warnings.push(reasonValidation.error);
    }

    if (paths.values.length > 25) {
      warnings.push('Maximaal 25 paths per handmatige aanvraag.');
    }

    if (tags.values.length > 100) {
      warnings.push('Maximaal 100 tags per handmatige aanvraag.');
    }

    return warnings;
  });
  readonly canSubmit = computed(() => {
    const paths = normalizeBrowserPaths(splitLines(this.pathsText()));
    const tags = normalizeBrowserTags(splitLines(this.tagsText()));
    const reasonValidation = validateBrowserReason(this.reason());

    return (
      !this.isRunning() &&
      !reasonValidation.error &&
      paths.invalidValues.length === 0 &&
      tags.invalidValues.length === 0 &&
      paths.values.length <= 25 &&
      tags.values.length <= 100 &&
      paths.values.length + tags.values.length > 0
    );
  });

  updatePaths(value: string): void {
    this.pathsText.set(value);
  }

  updateTags(value: string): void {
    this.tagsText.set(value);
  }

  updateReason(value: string): void {
    this.reason.set(value);
  }

  applyPreset(preset: CacheRevalidationPreset): void {
    this.pathsText.set(joinLines(preset.paths));
    this.tagsText.set(joinLines(preset.tags));
    this.reason.set(preset.reason);
    this.message.set(null);
    this.result.set(null);
  }

  resetForm(): void {
    this.pathsText.set('');
    this.tagsText.set('');
    this.reason.set('');
    this.message.set(null);
    this.result.set(null);
  }

  formatResult(result: CommerceAdminCacheRevalidationResult | null): string {
    return result ? JSON.stringify(result, null, 2) : '';
  }

  async revalidate(): Promise<void> {
    const paths = normalizeBrowserPaths(splitLines(this.pathsText()));
    const tags = normalizeBrowserTags(splitLines(this.tagsText()));
    const reasonValidation = validateBrowserReason(this.reason());

    if (
      reasonValidation.error ||
      paths.invalidValues.length > 0 ||
      tags.invalidValues.length > 0 ||
      paths.values.length > 25 ||
      tags.values.length > 100 ||
      paths.values.length + tags.values.length === 0
    ) {
      this.message.set('Controleer de velden voordat je revalideert.');
      return;
    }

    this.isRunning.set(true);
    this.message.set(null);
    this.result.set(null);

    try {
      const result = await this.commerceAdminApi.revalidatePublicWebCache({
        paths: paths.values,
        reason: reasonValidation.reason ?? '',
        tags: tags.values,
      });

      this.result.set(result);
      this.message.set(
        result.status === 'success'
          ? 'Cache revalidation is afgerond.'
          : 'Cache revalidation is deels mislukt. Controleer de waarschuwingen.',
      );
    } catch (error) {
      this.message.set(toAdminActionErrorMessage(error));
    } finally {
      this.isRunning.set(false);
    }
  }
}
