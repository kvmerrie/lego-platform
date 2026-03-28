import { MetricCard } from '@lego-platform/shared/types';
import { formatCompactNumber } from '@lego-platform/shared/util';

export interface CatalogSetSummary {
  id: string;
  slug: string;
  name: string;
  theme: string;
  releaseYear: number;
  pieces: number;
  priceRange: string;
  collectorAngle: string;
}

export interface CatalogSetDetail extends CatalogSetSummary {
  tagline: string;
  availability: string;
  collectorHighlights: readonly string[];
}

export interface CatalogThemeSnapshot {
  name: string;
  setCount: number;
  momentum: string;
  signatureSet: string;
}

export function sortCatalogSetSummaries(
  setSummaries: readonly CatalogSetSummary[],
): CatalogSetSummary[] {
  return [...setSummaries].sort(
    (left, right) =>
      right.releaseYear - left.releaseYear ||
      left.name.localeCompare(right.name),
  );
}

export function buildCatalogMetrics(
  setSummaries: readonly CatalogSetSummary[],
): MetricCard[] {
  const pieceCount = setSummaries.reduce(
    (total, setSummary) => total + setSummary.pieces,
    0,
  );

  return [
    {
      label: 'Tracked sets',
      value: String(setSummaries.length),
      detail: 'Curated flagship inventory',
    },
    {
      label: 'Pieces indexed',
      value: formatCompactNumber(pieceCount),
      detail: 'Across featured catalog entries',
    },
    {
      label: 'Freshest release',
      value: String(
        Math.max(...setSummaries.map((setSummary) => setSummary.releaseYear)),
      ),
      detail: 'Latest collector-ready launch',
      tone: 'accent',
    },
  ];
}
