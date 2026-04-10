'use client';

import { type SyntheticEvent, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type PhotoSwipe from 'photoswipe';
import styles from './catalog-ui.module.css';

const fallbackGalleryImageDimensions = {
  height: 1200,
  width: 1600,
} as const;

export interface CatalogSetGalleryImageItem {
  altLabel: string;
  url: string;
}

export function CatalogSetImageGalleryClient({
  galleryImages,
  name,
}: {
  galleryImages: readonly CatalogSetGalleryImageItem[];
  name: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [imageDimensions, setImageDimensions] = useState<
    Record<string, { height: number; width: number }>
  >({});
  const [isLightboxTransitioning, setIsLightboxTransitioning] = useState(false);
  const mainImageRef = useRef<HTMLImageElement>(null);
  const photoSwipeRef = useRef<PhotoSwipe | null>(null);

  const activeImage = galleryImages[activeIndex] ?? galleryImages[0];
  const totalImages = galleryImages.length;
  const isSingleImage = totalImages <= 1;

  function getResolvedImageDimensions(imageUrl: string) {
    const mainImage = mainImageRef.current;

    if (
      imageUrl === activeImage?.url &&
      mainImage?.naturalWidth &&
      mainImage?.naturalHeight
    ) {
      return {
        height: mainImage.naturalHeight,
        width: mainImage.naturalWidth,
      };
    }

    return imageDimensions[imageUrl] ?? fallbackGalleryImageDimensions;
  }

  useEffect(() => {
    return () => {
      photoSwipeRef.current?.destroy();
      photoSwipeRef.current = null;
    };
  }, []);

  function handleImageLoad(
    imageUrl: string,
    event: SyntheticEvent<HTMLImageElement>,
  ) {
    const { naturalHeight, naturalWidth } = event.currentTarget;

    if (!naturalWidth || !naturalHeight) {
      return;
    }

    setImageDimensions((currentImageDimensions) => {
      const existingImageDimensions = currentImageDimensions[imageUrl];

      if (
        existingImageDimensions?.width === naturalWidth &&
        existingImageDimensions?.height === naturalHeight
      ) {
        return currentImageDimensions;
      }

      return {
        ...currentImageDimensions,
        [imageUrl]: {
          height: naturalHeight,
          width: naturalWidth,
        },
      };
    });
  }

  async function openLightbox(startIndex: number) {
    if (!galleryImages.length || typeof window === 'undefined') {
      return;
    }

    if (photoSwipeRef.current) {
      photoSwipeRef.current.goTo(startIndex);
      return;
    }

    setIsLightboxTransitioning(true);

    try {
      const { default: PhotoSwipe } = await import('photoswipe');
      const startImage = galleryImages[startIndex] ?? activeImage;
      const startImageDimensions = startImage
        ? getResolvedImageDimensions(startImage.url)
        : fallbackGalleryImageDimensions;
      const mainImagePlaceholderSource =
        mainImageRef.current?.currentSrc ||
        mainImageRef.current?.src ||
        activeImage.url;
      const photoSwipe = new PhotoSwipe({
        arrowNextTitle: 'Volgende foto',
        arrowPrevTitle: 'Vorige foto',
        bgOpacity: 1,
        closeTitle: 'Sluiten',
        dataSource: galleryImages.map((galleryImage, index) => {
          const imageSize =
            index === startIndex
              ? startImageDimensions
              : getResolvedImageDimensions(galleryImage.url);

          return {
            alt: galleryImage.altLabel,
            height: imageSize.height,
            h: imageSize.height,
            msrc:
              index === startIndex
                ? mainImagePlaceholderSource
                : galleryImage.url,
            src: galleryImage.url,
            width: imageSize.width,
            w: imageSize.width,
          };
        }),
        index: startIndex,
        initialZoomLevel: 'fit',
        loop: false,
        maxZoomLevel: 4,
        secondaryZoomLevel: 2.5,
        showAnimationDuration: 180,
        showHideAnimationType: 'zoom',
        zoomTitle: 'Zoom',
      });

      const fallbackThumbBounds = {
        w: window.innerWidth,
        x: 0,
        y: 0,
      };

      photoSwipe.addFilter('thumbBounds', (thumbBounds, _itemData, index) => {
        const currentIndex = photoSwipe.currIndex;

        if (index !== currentIndex) {
          return thumbBounds ?? fallbackThumbBounds;
        }

        const mainImage = mainImageRef.current;

        if (!mainImage) {
          return thumbBounds ?? fallbackThumbBounds;
        }

        const imageBounds = mainImage.getBoundingClientRect();
        const imageSize = getResolvedImageDimensions(
          galleryImages[index]?.url ?? '',
        );
        const imageAspectRatio = imageSize.width / imageSize.height;
        const boundsAspectRatio = imageBounds.width / imageBounds.height;

        if (!imageAspectRatio || !Number.isFinite(imageAspectRatio)) {
          return {
            w: imageBounds.width,
            x: imageBounds.left,
            y: imageBounds.top,
          };
        }

        if (imageAspectRatio > boundsAspectRatio) {
          const renderedHeight = imageBounds.width / imageAspectRatio;

          return {
            w: imageBounds.width,
            x: imageBounds.left,
            y: imageBounds.top + (imageBounds.height - renderedHeight) / 2,
          };
        }

        const renderedWidth = imageBounds.height * imageAspectRatio;

        return {
          w: renderedWidth,
          x: imageBounds.left + (imageBounds.width - renderedWidth) / 2,
          y: imageBounds.top,
        };
      });

      photoSwipe.on('change', () => {
        setActiveIndex(photoSwipe.currIndex);
      });

      photoSwipe.on('openingAnimationStart', () => {
        setIsLightboxTransitioning(true);
      });

      photoSwipe.on('openingAnimationEnd', () => {
        setIsLightboxTransitioning(false);
      });

      photoSwipe.on('closingAnimationStart', () => {
        setIsLightboxTransitioning(true);
      });

      photoSwipe.on('closingAnimationEnd', () => {
        setIsLightboxTransitioning(false);
      });

      photoSwipe.on('destroy', () => {
        setIsLightboxTransitioning(false);
        photoSwipeRef.current = null;
      });

      photoSwipeRef.current = photoSwipe;
      photoSwipe.init();
    } catch {
      setIsLightboxTransitioning(false);
    }
  }

  if (!activeImage) {
    return null;
  }

  return (
    <div
      className={`${styles.galleryShell}${
        isSingleImage ? ` ${styles.galleryShellSingle}` : ''
      }`}
    >
      <div className={styles.galleryMain}>
        <div className={styles.galleryMainFrame}>
          <button
            aria-label={
              totalImages > 1
                ? `Open foto ${activeIndex + 1} van ${totalImages} van ${name} in volledig scherm`
                : `Open foto van ${name} in volledig scherm`
            }
            className={styles.galleryMainButton}
            onClick={() => void openLightbox(activeIndex)}
            type="button"
          >
            <div
              className={`${styles.setVisual} ${styles.heroVisual} ${styles.galleryMainVisual}`}
            >
              <div
                className={styles.visualMedia}
                data-hidden={isLightboxTransitioning ? 'true' : undefined}
              >
                <div className={styles.galleryMainImageLayer}>
                  <img
                    alt={activeImage.altLabel}
                    className={styles.setImage}
                    decoding="async"
                    loading="eager"
                    onLoad={(event) => handleImageLoad(activeImage.url, event)}
                    ref={mainImageRef}
                    src={activeImage.url}
                  />
                </div>
              </div>
            </div>
          </button>

          {totalImages > 1 ? (
            <div
              className={styles.galleryMainChrome}
              data-hidden={isLightboxTransitioning ? 'true' : undefined}
            >
              <span className={styles.galleryCounter}>
                {activeIndex + 1} / {totalImages}
              </span>
              <div
                aria-label={`${name} productfoto navigatie`}
                className={styles.galleryNavGroup}
              >
                <button
                  aria-label="Vorige foto"
                  className={styles.galleryNavButton}
                  disabled={activeIndex === 0}
                  onClick={() =>
                    setActiveIndex((currentIndex) =>
                      Math.max(0, currentIndex - 1),
                    )
                  }
                  type="button"
                >
                  <ChevronLeft
                    aria-hidden="true"
                    className={styles.galleryNavIcon}
                  />
                </button>
                <button
                  aria-label="Volgende foto"
                  className={styles.galleryNavButton}
                  disabled={activeIndex >= totalImages - 1}
                  onClick={() =>
                    setActiveIndex((currentIndex) =>
                      Math.min(totalImages - 1, currentIndex + 1),
                    )
                  }
                  type="button"
                >
                  <ChevronRight
                    aria-hidden="true"
                    className={styles.galleryNavIcon}
                  />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {totalImages > 1 ? (
        <div
          aria-label={`${name} productfoto's`}
          className={styles.galleryThumbRail}
        >
          {galleryImages.map((galleryImage, index) => (
            <button
              aria-label={`Kies foto ${index + 1} van ${totalImages}`}
              aria-pressed={index === activeIndex}
              className={styles.galleryThumbButton}
              data-active={index === activeIndex ? 'true' : undefined}
              key={galleryImage.url}
              onClick={() => setActiveIndex(index)}
              type="button"
            >
              <img
                alt=""
                className={styles.galleryThumbImage}
                decoding="async"
                loading="lazy"
                onLoad={(event) => handleImageLoad(galleryImage.url, event)}
                src={galleryImage.url}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default CatalogSetImageGalleryClient;
