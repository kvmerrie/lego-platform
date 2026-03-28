import { MetricCard } from '@lego-platform/shared/types';

export interface WishlistOverview {
  trackedSets: number;
  highPriority: number;
  nextReviewWindow: string;
}

export interface WishlistItem {
  id: string;
  name: string;
  targetPrice: string;
  reason: string;
  urgency: 'High' | 'Medium' | 'Low';
}

export function buildWishlistMetrics(
  wishlistOverview: WishlistOverview,
): MetricCard[] {
  return [
    {
      label: 'Tracked sets',
      value: String(wishlistOverview.trackedSets),
      detail: 'Across personal and shared watchlists',
    },
    {
      label: 'High-priority items',
      value: String(wishlistOverview.highPriority),
      detail: 'Worth active offer monitoring',
      tone: 'warning',
    },
    {
      label: 'Next review',
      value: wishlistOverview.nextReviewWindow,
      detail: 'Suggested cadence for repricing and reminders',
    },
  ];
}
