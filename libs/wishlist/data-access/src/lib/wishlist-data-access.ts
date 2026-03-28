import { WishlistItem, WishlistOverview } from '@lego-platform/wishlist/util';

const wishlistOverview: WishlistOverview = {
  trackedSets: 19,
  highPriority: 6,
  nextReviewWindow: 'Weekly',
};

const wishlistItems: readonly WishlistItem[] = [
  {
    id: '42177',
    name: 'Mercedes-Benz G 500 PROFESSIONAL Line',
    targetPrice: '$199',
    reason: 'Strong display presence with an approachable premium ceiling.',
    urgency: 'High',
  },
  {
    id: '10318',
    name: 'Concorde',
    targetPrice: '$169',
    reason: 'Aspirational display piece for a future feature collection.',
    urgency: 'Medium',
  },
  {
    id: '10294',
    name: 'Titanic',
    targetPrice: '$499',
    reason: 'Long-horizon acquisition with room-scale planning attached.',
    urgency: 'Low',
  },
];

export function getWishlistOverview(): WishlistOverview {
  return wishlistOverview;
}

export function listWishlistItems(): WishlistItem[] {
  return [...wishlistItems];
}
