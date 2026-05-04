'use client';

import { ZoomIn } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { ImageGallery } from '@lego-platform/shared/ui';
import { useContentArticleGalleryRegistration } from './content-article-gallery-lightbox';
import styles from './content-article-ui.module.css';

export function ContentArticleFeaturedSetLightbox({
  children,
  imageAlt,
  imageUrl,
  name,
}: {
  children: ReactNode;
  imageAlt: string;
  imageUrl?: string;
  name: string;
}) {
  const [lightboxRequest, setLightboxRequest] = useState<{
    index: number;
    key: number;
  } | null>(null);
  const featuredImages = useMemo(
    () =>
      imageUrl
        ? [
            {
              alt: imageAlt,
              caption: `${name} · LEGO-set`,
              src: imageUrl,
            },
          ]
        : [],
    [imageAlt, imageUrl, name],
  );
  const { entryId, openImage } = useContentArticleGalleryRegistration({
    images: featuredImages,
    kind: 'featured',
  });

  if (!imageUrl) {
    return <div className={styles.featuredSetVisualLightbox}>{children}</div>;
  }

  return (
    <>
      <button
        aria-label={`Bekijk ${name} groot`}
        className={styles.featuredSetVisualButton}
        data-featured-set-lightbox-trigger="true"
        onClick={() => {
          if (openImage) {
            openImage(entryId, 0);
            return;
          }

          setLightboxRequest((currentRequest) => ({
            index: 0,
            key: (currentRequest?.key ?? 0) + 1,
          }));
        }}
        type="button"
      >
        {children}
        <span
          aria-hidden="true"
          className={styles.featuredSetZoomOverlay}
          data-featured-set-zoom-overlay="true"
        >
          <span className={styles.featuredSetZoomIconShell}>
            <ZoomIn
              aria-hidden="true"
              className={styles.featuredSetZoomIcon}
              strokeWidth={2.2}
            />
          </span>
        </span>
      </button>
      {openImage ? null : (
        <ImageGallery
          ariaLabel={`${name} afbeelding`}
          images={featuredImages}
          lightboxRequest={lightboxRequest}
          presentation="lightbox-only"
          variant="article"
        />
      )}
    </>
  );
}
