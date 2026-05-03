'use client';

import type { MouseEvent, ReactNode } from 'react';
import React from 'react';
import { trackArticleSetClick } from '@lego-platform/content/ui';

export interface ArticleSetClickTrackingItem {
  href: string;
  setId: string;
  setName: string;
}

function normalizeTrackingHref(href: string): string {
  try {
    return new URL(href, 'https://brickhunt.local').pathname;
  } catch {
    return href;
  }
}

export function ArticleSetClickTrackingRegion({
  articleSlug,
  children,
  items,
}: {
  articleSlug?: string;
  children: ReactNode;
  items: readonly ArticleSetClickTrackingItem[];
}) {
  const itemByHref = new Map(
    items.map((item) => [normalizeTrackingHref(item.href), item]),
  );

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const link = target.closest('a[href]');

    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }

    const trackingItem = itemByHref.get(normalizeTrackingHref(link.href));

    if (!trackingItem) {
      return;
    }

    trackArticleSetClick({
      articleSlug,
      setId: trackingItem.setId,
      setName: trackingItem.setName,
    });
  }

  return <div onClick={handleClick}>{children}</div>;
}

export default ArticleSetClickTrackingRegion;
