'use client';

import { ZoomIn } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { CatalogSetCard } from '@lego-platform/catalog/ui';
import {
  ContentArticleSetSpotlightList,
  type ContentArticleSetSpotlightSection,
} from '@lego-platform/content/ui';
import { Button, ImageGallery } from '@lego-platform/shared/ui';
import { WishlistFeatureWishlistToggle } from '@lego-platform/wishlist/feature-wishlist-toggle';
import styles from './article-mdx-set-spotlight-list-client.module.css';
import {
  buildSpotlightSectionsForEditorialShowcase,
  type ArticleSetSpotlightHighlightContext,
} from './article-mdx-set-spotlight-highlight';
import type { ArticleSetSpotlightItem } from './article-mdx-set-spotlight-types';
import { ArticleSetClickTrackingRegion } from './article-set-click-tracking-region';

function buildGalleryImages(items: readonly ArticleSetSpotlightItem[]) {
  return items.flatMap((item) =>
    item.setSummary.imageUrl
      ? [
          {
            alt: `${item.setSummary.name} LEGO-set`,
            caption: `${item.setSummary.name} · Set ${item.setSummary.id}`,
            ctaHref: item.ctaHref,
            ctaLabel: item.ctaLabel ?? 'Bekijk set',
            src: item.setSummary.imageUrl,
          },
        ]
      : [],
  );
}

function dedupeSpotlightItems(
  items: readonly ArticleSetSpotlightItem[],
): ArticleSetSpotlightItem[] {
  const seenSetIds = new Set<string>();

  return items.filter((item) => {
    if (seenSetIds.has(item.setSummary.id)) {
      return false;
    }

    seenSetIds.add(item.setSummary.id);
    return true;
  });
}

export function ArticleMdxSetSpotlightListClient({
  articleDescription,
  articleSlug,
  articleTitle,
  items,
}: {
  articleDescription?: string;
  articleSlug?: string;
  articleTitle?: string;
  items: readonly ArticleSetSpotlightItem[];
}) {
  const articleContext = useMemo<ArticleSetSpotlightHighlightContext>(
    () => ({
      articleDescription,
      articleTitle,
    }),
    [articleDescription, articleTitle],
  );
  const dedupedItems = useMemo(() => dedupeSpotlightItems(items), [items]);
  const groupedSections = useMemo(
    () =>
      buildSpotlightSectionsForEditorialShowcase(dedupedItems, articleContext),
    [articleContext, dedupedItems],
  );
  const orderedSpotlightItems = useMemo(
    () => groupedSections.flatMap((section) => section.items),
    [groupedSections],
  );
  const galleryItems = useMemo(
    () => buildGalleryImages(orderedSpotlightItems),
    [orderedSpotlightItems],
  );
  const galleryIndexBySetId = useMemo(() => {
    const galleryIndexMap = new Map<string, number>();
    let imageIndex = 0;

    for (const item of orderedSpotlightItems) {
      if (!item.setSummary.imageUrl) {
        continue;
      }

      galleryIndexMap.set(item.setSummary.id, imageIndex);
      imageIndex += 1;
    }

    return galleryIndexMap;
  }, [orderedSpotlightItems]);
  const [lightboxRequest, setLightboxRequest] = useState<{
    index: number;
    key: number;
  } | null>(null);

  const spotlightSections = useMemo<
    readonly ContentArticleSetSpotlightSection[]
  >(
    () =>
      groupedSections.map((section) => ({
        description: section.description,
        highlightSetNumber: section.highlightSetNumber,
        id: section.id,
        layoutVariant: section.layoutVariant,
        title: section.title,
        body: (
          <div
            className={styles.sectionGrid}
            data-set-spotlight-card-system="catalog-set-card"
            data-set-spotlight-count={String(section.items.length)}
            data-set-spotlight-grid={section.layoutVariant}
          >
            {section.items.map((item) => {
              const setId = item.setSummary.id;
              const hasImage = Boolean(item.setSummary.imageUrl);
              const isHighlighted = setId === section.highlightSetNumber;

              return (
                <div
                  className={styles.cardSlot}
                  data-set-spotlight-card-system="catalog-set-card"
                  data-set-spotlight-card-variant="compact"
                  data-set-spotlight-highlighted={
                    isHighlighted ? 'true' : 'false'
                  }
                  data-set-spotlight-item={setId}
                  key={setId}
                >
                  <CatalogSetCard
                    actions={
                      <div className={styles.cardActions}>
                        <WishlistFeatureWishlistToggle
                          productIntent="wishlist"
                          setId={setId}
                          variant="inline"
                        />
                      </div>
                    }
                    contextBadge={
                      isHighlighted
                        ? {
                            label: 'Blikvanger',
                            tone: 'accent',
                          }
                        : undefined
                    }
                    ctaMode="default"
                    href={item.ctaHref}
                    priceContext={item.priceContext}
                    setSummary={item.setSummary}
                    showThemeBadge={false}
                    variant="compact"
                    visualActions={
                      hasImage ? (
                        <Button
                          aria-label="Bekijk afbeelding groot"
                          className={styles.lightboxButton}
                          data-set-spotlight-lightbox-placement="image-area"
                          data-set-spotlight-lightbox-set-id={setId}
                          data-set-spotlight-lightbox-tone="secondary"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            const imageIndex = galleryIndexBySetId.get(setId);

                            if (typeof imageIndex !== 'number') {
                              return;
                            }

                            setLightboxRequest((currentRequest) => ({
                              index: imageIndex,
                              key: (currentRequest?.key ?? 0) + 1,
                            }));
                          }}
                          size="compact"
                          title={`Bekijk ${item.setSummary.name} groot`}
                          tone="secondary"
                          type="button"
                        >
                          <ZoomIn
                            aria-hidden="true"
                            className={styles.lightboxButtonIcon}
                          />
                        </Button>
                      ) : undefined
                    }
                  />
                </div>
              );
            })}
          </div>
        ),
      })),
    [galleryIndexBySetId, groupedSections],
  );

  if (!orderedSpotlightItems.length) {
    return null;
  }

  return (
    <>
      <ArticleSetClickTrackingRegion
        articleSlug={articleSlug}
        items={orderedSpotlightItems.map((item) => ({
          href: item.ctaHref,
          setId: item.setSummary.id,
          setName: item.setSummary.name,
        }))}
      >
        <ContentArticleSetSpotlightList sections={spotlightSections} />
      </ArticleSetClickTrackingRegion>
      {galleryItems.length ? (
        <ImageGallery
          ariaLabel="Setgalerij"
          images={galleryItems}
          lightboxRequest={lightboxRequest}
          presentation="lightbox-only"
          variant="article"
        />
      ) : null}
    </>
  );
}
