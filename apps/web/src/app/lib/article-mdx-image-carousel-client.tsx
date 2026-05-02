'use client';

import React from 'react';
import { ContentArticleImageGallery } from '@lego-platform/content/ui';
import type { CarouselImage } from '@lego-platform/shared/ui';
import { normalizeImageCarouselImages } from './article-mdx-embed-normalization';

export function ArticleMdxImageCarouselClient({
  images,
}: {
  images?: readonly CarouselImage[] | Record<string, CarouselImage> | string;
}) {
  const resolvedImages = normalizeImageCarouselImages(images);

  if (!resolvedImages.length) {
    return null;
  }

  return <ContentArticleImageGallery images={resolvedImages} />;
}
