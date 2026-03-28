export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function sortByLabel<T extends { label: string }>(
  items: readonly T[],
): T[] {
  return [...items].sort((left, right) =>
    left.label.localeCompare(right.label),
  );
}

export function uniqueBy<T, K>(
  items: readonly T[],
  getKey: (item: T) => K,
): T[] {
  const seen = new Set<K>();

  return items.filter((item) => {
    const key = getKey(item);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function readStringArrayProperty(
  payload: unknown,
  propertyName: string,
): string[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const propertyValue = (payload as Record<string, unknown>)[propertyName];

  if (!Array.isArray(propertyValue)) {
    return [];
  }

  return propertyValue.filter(
    (value): value is string => typeof value === 'string',
  );
}
