import { normalizeCacheTags } from './cache-tags';

export const PUBLIC_WEB_REVALIDATION_PATH_BATCH_LIMIT = 25;
export const PUBLIC_WEB_REVALIDATION_TAG_BATCH_LIMIT = 100;
export const PUBLIC_WEB_REVALIDATION_REASON_MIN_LENGTH = 3;
export const PUBLIC_WEB_REVALIDATION_REASON_MAX_LENGTH = 120;

export interface RevalidationNormalizationResult {
  invalidValues: readonly string[];
  values: readonly string[];
  warnings: readonly string[];
}

export interface RevalidationBatchPayload {
  paths: readonly string[];
  reason: string;
  tags: readonly string[];
}

export interface RevalidationReasonValidationResult {
  reason?: string;
  error?: string;
}

function isProtocolOrDomainPath(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value) || value.startsWith('//');
}

function normalizePublicWebRevalidationPath(pathname: string):
  | {
      value: string;
    }
  | {
      error: string;
      value: string;
    } {
  const trimmedPathname = pathname.trim();

  if (!trimmedPathname) {
    return {
      error: 'Path is empty.',
      value: pathname,
    };
  }

  if (
    !trimmedPathname.startsWith('/') ||
    isProtocolOrDomainPath(trimmedPathname)
  ) {
    return {
      error: `Path must start with / and may not include a protocol or domain: ${trimmedPathname}`,
      value: trimmedPathname,
    };
  }

  if (/\s/.test(trimmedPathname)) {
    return {
      error: `Path may not contain whitespace: ${trimmedPathname}`,
      value: trimmedPathname,
    };
  }

  return {
    value:
      trimmedPathname === '/'
        ? trimmedPathname
        : trimmedPathname.replace(/\/+$/, '') || '/',
  };
}

export function normalizeRevalidationPaths(
  paths: readonly string[],
): RevalidationNormalizationResult {
  const values: string[] = [];
  const invalidValues: string[] = [];
  const warnings: string[] = [];
  const seenValues = new Set<string>();

  for (const path of paths) {
    const normalized = normalizePublicWebRevalidationPath(path);

    if ('error' in normalized) {
      invalidValues.push(normalized.value);
      warnings.push(normalized.error);
      continue;
    }

    if (seenValues.has(normalized.value)) {
      warnings.push(`Duplicate path skipped: ${normalized.value}`);
      continue;
    }

    seenValues.add(normalized.value);
    values.push(normalized.value);
  }

  return {
    invalidValues,
    values,
    warnings,
  };
}

export function normalizeRevalidationTags(
  tags: readonly string[],
): RevalidationNormalizationResult {
  const trimmedTags = tags.map((tag) => tag.trim());
  const normalizedTags = normalizeCacheTags(trimmedTags);
  const validInputCount = trimmedTags.filter(
    (tag) => tag && normalizeCacheTags([tag]).length > 0,
  ).length;
  const invalidValues = trimmedTags.filter(
    (tag) => tag && normalizeCacheTags([tag]).length === 0,
  );
  const warnings = [
    ...trimmedTags.filter((tag) => !tag).map(() => 'Empty tag skipped.'),
    ...invalidValues.map((tag) => `Invalid tag skipped: ${tag}`),
  ];

  if (normalizedTags.length < validInputCount) {
    warnings.push('Duplicate tags were skipped.');
  }

  return {
    invalidValues,
    values: normalizedTags,
    warnings,
  };
}

export function validateRevalidationReason(
  reason: unknown,
): RevalidationReasonValidationResult {
  if (typeof reason !== 'string') {
    return {
      error: 'Reason is required.',
    };
  }

  const normalizedReason = reason.trim();

  if (normalizedReason.length < PUBLIC_WEB_REVALIDATION_REASON_MIN_LENGTH) {
    return {
      error: `Reason must be at least ${PUBLIC_WEB_REVALIDATION_REASON_MIN_LENGTH} characters.`,
    };
  }

  if (normalizedReason.length > PUBLIC_WEB_REVALIDATION_REASON_MAX_LENGTH) {
    return {
      error: `Reason must be at most ${PUBLIC_WEB_REVALIDATION_REASON_MAX_LENGTH} characters.`,
    };
  }

  return {
    reason: normalizedReason,
  };
}

export function batchRevalidationPayloads({
  paths,
  reason,
  tags,
}: {
  paths?: readonly string[];
  reason: string;
  tags?: readonly string[];
}): RevalidationBatchPayload[] {
  const normalizedPaths = normalizeRevalidationPaths(paths ?? []).values;
  const normalizedTags = normalizeRevalidationTags(tags ?? []).values;
  const batchCount = Math.max(
    Math.ceil(
      normalizedPaths.length / PUBLIC_WEB_REVALIDATION_PATH_BATCH_LIMIT,
    ),
    Math.ceil(normalizedTags.length / PUBLIC_WEB_REVALIDATION_TAG_BATCH_LIMIT),
  );

  if (batchCount === 0) {
    return [];
  }

  return Array.from({ length: batchCount }, (_, batchIndex) => ({
    paths: normalizedPaths.slice(
      batchIndex * PUBLIC_WEB_REVALIDATION_PATH_BATCH_LIMIT,
      (batchIndex + 1) * PUBLIC_WEB_REVALIDATION_PATH_BATCH_LIMIT,
    ),
    reason,
    tags: normalizedTags.slice(
      batchIndex * PUBLIC_WEB_REVALIDATION_TAG_BATCH_LIMIT,
      (batchIndex + 1) * PUBLIC_WEB_REVALIDATION_TAG_BATCH_LIMIT,
    ),
  }));
}
