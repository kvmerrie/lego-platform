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
