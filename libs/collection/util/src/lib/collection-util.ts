import { MetricCard } from '@lego-platform/shared/types';
import { formatPercent } from '@lego-platform/shared/util';

export interface CollectionDashboardSnapshot {
  ownedSets: number;
  wantedSets: number;
  completionRate: number;
  insuredValue: string;
}

export interface CollectionShelf {
  name: string;
  completion: string;
  focus: string;
  notes: string;
}

export interface CollectionEditorSection {
  title: string;
  description: string;
  fields: readonly string[];
}

export interface OwnedSetState {
  setId: string;
  isOwned: boolean;
}

export function buildCollectionMetrics(
  collectionSnapshot: CollectionDashboardSnapshot,
): MetricCard[] {
  return [
    {
      label: 'Owned sets',
      value: String(collectionSnapshot.ownedSets),
      detail: 'Tracked in the curation workspace',
    },
    {
      label: 'Completion',
      value: formatPercent(collectionSnapshot.completionRate),
      detail: 'Across active shelf goals',
      tone: 'positive',
    },
    {
      label: 'Insured value',
      value: collectionSnapshot.insuredValue,
      detail: 'Estimated replacement coverage',
    },
  ];
}
