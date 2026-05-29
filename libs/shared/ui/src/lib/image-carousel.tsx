'use client';

import Image from 'next/image';
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import styles from './image-carousel.module.css';

export interface GalleryImage {
  alt: string;
  caption?: string;
  ctaHref?: string;
  ctaLabel?: string;
  src: string;
  thumbnailSrc?: string;
}

export type CarouselImage = GalleryImage;

type ImageGalleryVariant = 'article' | 'detail';
type GalleryImageMediaKind =
  | 'article'
  | 'detail'
  | 'lightbox'
  | 'overview'
  | 'thumbnail';
type LightboxMode = 'overview' | 'viewer';

function joinClasses(
  ...classNames: Array<string | false | null | undefined>
): string {
  return classNames.filter(Boolean).join(' ');
}

function isLocalImageSource(src: string): boolean {
  return (
    src.startsWith('/') || src.startsWith('data:') || src.startsWith('blob:')
  );
}

function clampIndex(index: number, imageCount: number): number {
  return Math.min(Math.max(index, 0), imageCount - 1);
}

function getGalleryImageLabel(image: GalleryImage, imageIndex: number): string {
  return image.alt.trim() || `Afbeelding ${imageIndex + 1}`;
}

function GalleryImageMedia({
  image,
  imageIndex,
  kind,
  isFallbackVisible,
  onImageError,
}: {
  image: GalleryImage;
  imageIndex: number;
  kind: GalleryImageMediaKind;
  isFallbackVisible: boolean;
  onImageError: (imageIndex: number) => void;
}) {
  const imageSource =
    kind === 'thumbnail' && image.thumbnailSrc ? image.thumbnailSrc : image.src;

  if (isFallbackVisible) {
    return (
      <div className={styles.imageFallback}>
        <span className={styles.imageFallbackLabel}>Beeld volgt nog</span>
        <p className={styles.imageFallbackCopy}>
          Deze afbeelding staat al gepland voor dit artikel of deze set, maar is
          nog niet toegevoegd.
        </p>
        {process.env.NODE_ENV === 'production' ? null : (
          <p className={styles.imageFallbackCopy}>{imageSource}</p>
        )}
      </div>
    );
  }

  if (isLocalImageSource(imageSource)) {
    return (
      <Image
        alt={image.alt}
        className={joinClasses(
          styles.galleryImage,
          kind === 'article'
            ? styles.galleryImageArticle
            : kind === 'thumbnail'
              ? styles.galleryImageThumbnail
              : kind === 'overview'
                ? styles.galleryImageOverview
                : styles.galleryImageDetail,
        )}
        fill
        onError={() => onImageError(imageIndex)}
        priority={imageIndex === 0 && kind !== 'overview'}
        sizes={
          kind === 'detail'
            ? '(max-width: 1024px) calc(100vw - 2rem), 900px'
            : kind === 'lightbox'
              ? '(max-width: 1280px) 100vw, 1400px'
              : kind === 'overview'
                ? '(max-width: 768px) calc(100vw - 2rem), (max-width: 1280px) 50vw, 640px'
                : kind === 'thumbnail'
                  ? '96px'
                  : '(max-width: 768px) calc(100vw - 2rem), 1120px'
        }
        src={imageSource}
      />
    );
  }

  return (
    <img
      alt={image.alt}
      className={joinClasses(
        styles.galleryImage,
        kind === 'article'
          ? styles.galleryImageArticle
          : kind === 'thumbnail'
            ? styles.galleryImageThumbnail
            : kind === 'overview'
              ? styles.galleryImageOverview
              : styles.galleryImageDetail,
      )}
      decoding="async"
      fetchPriority={kind === 'detail' && imageIndex === 0 ? 'high' : 'auto'}
      height={kind === 'thumbnail' ? 160 : kind === 'detail' ? 900 : 1000}
      loading={
        kind === 'overview'
          ? imageIndex < 3
            ? 'eager'
            : 'lazy'
          : imageIndex === 0
            ? 'eager'
            : 'lazy'
      }
      onError={() => onImageError(imageIndex)}
      src={imageSource}
      width={kind === 'thumbnail' ? 224 : kind === 'detail' ? 900 : 1600}
    />
  );
}

export function ImageGallery({
  ariaLabel = 'Afbeeldingen',
  className,
  detailMobileFullBleed = false,
  images,
  lightboxRequest,
  onImageClick,
  presentation = 'full',
  variant = 'detail',
}: {
  ariaLabel?: string;
  className?: string;
  detailMobileFullBleed?: boolean;
  images: readonly GalleryImage[];
  lightboxRequest?: {
    index: number;
    key: number;
  } | null;
  onImageClick?: (imageIndex: number) => void;
  presentation?: 'full' | 'lightbox-only';
  variant?: ImageGalleryVariant;
}) {
  const resolvedImages = useMemo(
    () =>
      images.filter(
        (image): image is GalleryImage =>
          Boolean(image?.src?.trim()) && Boolean(image?.alt?.trim()),
      ),
    [images],
  );
  const [failedImageIndexes, setFailedImageIndexes] = useState<
    Record<number, true>
  >({});
  const [detailImageIndex, setDetailImageIndex] = useState(0);
  const [lightboxImageIndex, setLightboxImageIndex] = useState<number | null>(
    null,
  );
  const [lightboxMode, setLightboxMode] = useState<LightboxMode>('viewer');
  const overviewImageButtonRefs = useRef<
    Record<number, HTMLButtonElement | null>
  >({});
  const lightboxPrimaryButtonRef = useRef<HTMLButtonElement>(null);
  const lightboxDialogRef = useRef<HTMLDivElement>(null);
  const lightboxPointerStartX = useRef<number | null>(null);
  const pendingOverviewFocusIndexRef = useRef<number | null>(null);
  const lightboxTriggerRef = useRef<HTMLElement | null>(null);

  const rememberLightboxTrigger = useCallback(
    (trigger?: HTMLElement | null) => {
      if (trigger) {
        lightboxTriggerRef.current = trigger;
        return;
      }

      lightboxTriggerRef.current =
        typeof document !== 'undefined' &&
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    },
    [],
  );

  const closeLightbox = useCallback(() => {
    setLightboxImageIndex(null);
    setLightboxMode('viewer');

    window.requestAnimationFrame(() => {
      lightboxTriggerRef.current?.focus({ preventScroll: true });
    });
  }, []);

  useEffect(() => {
    if (!resolvedImages.length) {
      setDetailImageIndex(0);
      setLightboxImageIndex(null);
      return;
    }

    setDetailImageIndex((currentIndex) =>
      clampIndex(currentIndex, resolvedImages.length),
    );
    setLightboxImageIndex((currentIndex) =>
      typeof currentIndex === 'number'
        ? clampIndex(currentIndex, resolvedImages.length)
        : null,
    );
  }, [resolvedImages.length]);

  useEffect(() => {
    if (!lightboxRequest || !resolvedImages.length) {
      return;
    }

    rememberLightboxTrigger();
    setLightboxMode('viewer');
    setLightboxImageIndex(
      clampIndex(lightboxRequest.index, resolvedImages.length),
    );
  }, [lightboxRequest, rememberLightboxTrigger, resolvedImages.length]);

  useEffect(() => {
    if (lightboxImageIndex === null) {
      return undefined;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    window.requestAnimationFrame(() => {
      lightboxPrimaryButtonRef.current?.focus({ preventScroll: true });
    });

    function getFocusableDialogElements() {
      const dialog = lightboxDialogRef.current;

      if (!dialog) {
        return [];
      }

      return Array.from(
        dialog.querySelectorAll<HTMLElement>(
          [
            'a[href]',
            'button:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])',
          ].join(','),
        ),
      ).filter(
        (element) =>
          !element.hasAttribute('disabled') &&
          element.getAttribute('aria-hidden') !== 'true',
      );
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeLightbox();
        return;
      }

      if (event.key === 'Tab') {
        const focusableElements = getFocusableDialogElements();

        if (!focusableElements.length) {
          event.preventDefault();
          lightboxDialogRef.current?.focus({ preventScroll: true });
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus({ preventScroll: true });
          return;
        }

        if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus({ preventScroll: true });
        }
      }

      if (resolvedImages.length <= 1 || lightboxMode !== 'viewer') {
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setLightboxImageIndex((currentIndex) =>
          currentIndex === null
            ? 0
            : clampIndex(currentIndex + 1, resolvedImages.length),
        );
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setLightboxImageIndex((currentIndex) =>
          currentIndex === null
            ? 0
            : clampIndex(currentIndex - 1, resolvedImages.length),
        );
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [closeLightbox, lightboxImageIndex, lightboxMode, resolvedImages.length]);

  useEffect(() => {
    if (lightboxMode !== 'overview') {
      return;
    }

    const focusIndex = pendingOverviewFocusIndexRef.current;

    if (focusIndex === null) {
      return;
    }

    pendingOverviewFocusIndexRef.current = null;

    window.requestAnimationFrame(() => {
      overviewImageButtonRefs.current[focusIndex]?.focus({
        preventScroll: true,
      });
    });
  }, [lightboxMode]);

  if (!resolvedImages.length) {
    return null;
  }

  const safeDetailImageIndex = clampIndex(
    detailImageIndex,
    resolvedImages.length,
  );
  const safeLightboxImageIndex =
    lightboxImageIndex === null
      ? null
      : clampIndex(lightboxImageIndex, resolvedImages.length);
  const lightboxImage =
    safeLightboxImageIndex === null
      ? null
      : resolvedImages[safeLightboxImageIndex];
  const hasMultipleImages = resolvedImages.length > 1;
  const visibleArticleImages =
    variant === 'article' && resolvedImages.length > 4
      ? resolvedImages.slice(0, 4)
      : resolvedImages;
  const hiddenArticleImageCount =
    variant === 'article'
      ? resolvedImages.length - visibleArticleImages.length
      : 0;
  const articleGridCount =
    variant === 'article'
      ? resolvedImages.length > 4
        ? '5-plus'
        : resolvedImages.length.toString()
      : undefined;
  const lightboxAttributionTexts = [
    ...new Set(
      resolvedImages.flatMap((image) =>
        image.caption?.toLowerCase().includes('courtesy')
          ? [image.caption]
          : [],
      ),
    ),
  ];

  function handleImageError(imageIndex: number) {
    setFailedImageIndexes((currentIndexes) =>
      currentIndexes[imageIndex]
        ? currentIndexes
        : {
            ...currentIndexes,
            [imageIndex]: true,
          },
    );
  }

  function openLightbox(imageIndex: number, trigger?: HTMLElement | null) {
    if (onImageClick) {
      onImageClick(clampIndex(imageIndex, resolvedImages.length));
      return;
    }

    rememberLightboxTrigger(trigger);
    setLightboxMode(
      variant === 'detail' && resolvedImages.length > 1 ? 'overview' : 'viewer',
    );
    setLightboxImageIndex(clampIndex(imageIndex, resolvedImages.length));
  }

  function goToLightboxImage(nextIndex: number) {
    setLightboxMode('viewer');
    setLightboxImageIndex(clampIndex(nextIndex, resolvedImages.length));
  }

  function returnToLightboxOverview() {
    pendingOverviewFocusIndexRef.current = safeLightboxImageIndex;
    setLightboxMode('overview');
  }

  function handleLightboxPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    lightboxPointerStartX.current = event.clientX;
  }

  function handleLightboxPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const startClientX = lightboxPointerStartX.current;

    lightboxPointerStartX.current = null;

    if (!hasMultipleImages || startClientX === null) {
      return;
    }

    const pointerDelta = event.clientX - startClientX;

    if (Math.abs(pointerDelta) < 42) {
      return;
    }

    if (pointerDelta < 0) {
      goToLightboxImage((safeLightboxImageIndex ?? 0) + 1);
      return;
    }

    goToLightboxImage((safeLightboxImageIndex ?? 0) - 1);
  }

  function handleGalleryKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (variant !== 'detail' || !hasMultipleImages) {
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setDetailImageIndex((currentIndex) =>
        clampIndex(currentIndex + 1, resolvedImages.length),
      );
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setDetailImageIndex((currentIndex) =>
        clampIndex(currentIndex - 1, resolvedImages.length),
      );
    }
  }

  function goToDetailImage(nextIndex: number) {
    setDetailImageIndex(clampIndex(nextIndex, resolvedImages.length));
  }

  const lightbox =
    lightboxImage && safeLightboxImageIndex !== null ? (
      <div
        className={styles.lightboxBackdrop}
        data-lightbox-backdrop="true"
        data-lightbox-mode={lightboxMode}
        data-lightbox-variant={variant}
        onClick={closeLightbox}
        role="presentation"
      >
        <div
          aria-label={ariaLabel}
          aria-modal="true"
          className={styles.lightboxDialog}
          data-lightbox-active-index={safeLightboxImageIndex}
          data-lightbox-mode={lightboxMode}
          data-lightbox-variant={variant}
          onClick={(event) => event.stopPropagation()}
          ref={lightboxDialogRef}
          role="dialog"
          tabIndex={-1}
        >
          <div className={styles.lightboxHeader}>
            {lightboxMode === 'viewer' &&
            variant === 'detail' &&
            hasMultipleImages ? (
              <div className={styles.lightboxViewerHeaderStart}>
                <button
                  aria-label="Terug naar alle afbeeldingen"
                  className={styles.lightboxBackButton}
                  onClick={returnToLightboxOverview}
                  ref={lightboxPrimaryButtonRef}
                  type="button"
                >
                  <ChevronLeft aria-hidden="true" size={20} strokeWidth={2.3} />
                </button>
                <p aria-live="polite" className={styles.lightboxIndicator}>
                  {safeLightboxImageIndex + 1}/{resolvedImages.length}
                </p>
              </div>
            ) : lightboxMode === 'overview' ? (
              <p aria-live="polite" className={styles.lightboxIndicator}>
                Alle afbeeldingen
              </p>
            ) : hasMultipleImages ? (
              <p aria-live="polite" className={styles.lightboxIndicator}>
                {safeLightboxImageIndex + 1} / {resolvedImages.length}
              </p>
            ) : (
              <span />
            )}
            <button
              aria-label="Sluit galerij"
              className={styles.lightboxCloseButton}
              onClick={closeLightbox}
              ref={
                lightboxMode === 'viewer' &&
                variant === 'detail' &&
                hasMultipleImages
                  ? undefined
                  : lightboxPrimaryButtonRef
              }
              type="button"
            >
              <X aria-hidden="true" size={18} strokeWidth={2.2} />
            </button>
          </div>

          {lightboxMode === 'overview' ? (
            <div className={styles.lightboxOverviewBody}>
              <div className={styles.lightboxOverview}>
                {resolvedImages.map((image, imageIndex) => (
                  <button
                    aria-label={`Bekijk afbeelding ${imageIndex + 1}`}
                    className={styles.lightboxOverviewButton}
                    data-lightbox-grid-index={imageIndex}
                    key={`${image.src}-lightbox-grid-${imageIndex}`}
                    onClick={() => goToLightboxImage(imageIndex)}
                    ref={(element) => {
                      overviewImageButtonRefs.current[imageIndex] = element;
                    }}
                    type="button"
                  >
                    <span className={styles.lightboxOverviewFrame}>
                      <GalleryImageMedia
                        image={image}
                        imageIndex={imageIndex}
                        kind="overview"
                        isFallbackVisible={Boolean(
                          failedImageIndexes[imageIndex],
                        )}
                        onImageError={handleImageError}
                      />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.lightboxViewport}>
              {hasMultipleImages ? (
                <button
                  aria-label="Vorige afbeelding"
                  className={joinClasses(
                    styles.lightboxNavButton,
                    styles.lightboxNavButtonPrev,
                  )}
                  data-lightbox-control="previous"
                  disabled={safeLightboxImageIndex === 0}
                  onClick={() => goToLightboxImage(safeLightboxImageIndex - 1)}
                  type="button"
                >
                  <ChevronLeft aria-hidden="true" size={18} strokeWidth={2.2} />
                </button>
              ) : null}

              <div
                className={styles.lightboxMediaFrame}
                data-lightbox-media-surface="light"
                onPointerDown={handleLightboxPointerDown}
                onPointerUp={handleLightboxPointerUp}
              >
                <GalleryImageMedia
                  image={lightboxImage}
                  imageIndex={safeLightboxImageIndex}
                  kind="lightbox"
                  isFallbackVisible={Boolean(
                    failedImageIndexes[safeLightboxImageIndex],
                  )}
                  onImageError={handleImageError}
                />
              </div>

              {hasMultipleImages ? (
                <button
                  aria-label="Volgende afbeelding"
                  className={joinClasses(
                    styles.lightboxNavButton,
                    styles.lightboxNavButtonNext,
                  )}
                  data-lightbox-control="next"
                  disabled={
                    safeLightboxImageIndex === resolvedImages.length - 1
                  }
                  onClick={() => goToLightboxImage(safeLightboxImageIndex + 1)}
                  type="button"
                >
                  <ChevronRight
                    aria-hidden="true"
                    size={18}
                    strokeWidth={2.2}
                  />
                </button>
              ) : null}
            </div>
          )}

          {lightboxMode === 'overview' && lightboxAttributionTexts.length ? (
            <div className={styles.lightboxFooter}>
              <p className={styles.lightboxAttribution}>
                {lightboxAttributionTexts.join(' · ')}
              </p>
            </div>
          ) : null}

          {lightboxMode === 'viewer' && lightboxImage.caption ? (
            <p className={styles.lightboxCaption}>{lightboxImage.caption}</p>
          ) : null}

          {lightboxMode === 'viewer' && lightboxImage.ctaHref ? (
            <div className={styles.lightboxMetaActions}>
              <a
                className={styles.lightboxMetaLink}
                href={lightboxImage.ctaHref}
              >
                {lightboxImage.ctaLabel ?? 'Bekijk set'}
              </a>
            </div>
          ) : null}

          {lightboxMode === 'viewer' &&
          variant !== 'detail' &&
          hasMultipleImages ? (
            <div className={styles.lightboxThumbStrip}>
              {resolvedImages.map((image, imageIndex) => (
                <button
                  aria-label={`Bekijk afbeelding ${imageIndex + 1}`}
                  className={styles.lightboxThumbButton}
                  data-active={imageIndex === safeLightboxImageIndex}
                  data-lightbox-thumb-index={imageIndex}
                  key={`${image.src}-lightbox-thumb-${imageIndex}`}
                  onClick={() => goToLightboxImage(imageIndex)}
                  type="button"
                >
                  <div className={styles.lightboxThumbFrame}>
                    <GalleryImageMedia
                      image={image}
                      imageIndex={imageIndex}
                      kind="thumbnail"
                      isFallbackVisible={Boolean(
                        failedImageIndexes[imageIndex],
                      )}
                      onImageError={handleImageError}
                    />
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    ) : null;

  return (
    <>
      {presentation === 'lightbox-only' ? null : (
        <section
          aria-label={ariaLabel}
          className={joinClasses(styles.root, className)}
          data-detail-mobile-full-bleed={
            variant === 'detail' && detailMobileFullBleed ? 'true' : undefined
          }
          onKeyDown={handleGalleryKeyDown}
          tabIndex={variant === 'detail' ? 0 : -1}
        >
          {variant === 'article' ? (
            <div className={styles.articleGrid} data-count={articleGridCount}>
              {visibleArticleImages.map((image, imageIndex) => (
                <figure
                  className={styles.articleFigure}
                  key={`${image.src}-${imageIndex}`}
                >
                  <button
                    aria-label={`Open ${getGalleryImageLabel(image, imageIndex)} in volledig scherm`}
                    className={styles.articleImageButton}
                    data-gallery-tile-index={imageIndex}
                    onClick={(event) =>
                      openLightbox(imageIndex, event.currentTarget)
                    }
                    type="button"
                  >
                    <div className={styles.articleMediaFrame}>
                      <GalleryImageMedia
                        image={image}
                        imageIndex={imageIndex}
                        kind="article"
                        isFallbackVisible={Boolean(
                          failedImageIndexes[imageIndex],
                        )}
                        onImageError={handleImageError}
                      />
                      {hiddenArticleImageCount > 0 &&
                      imageIndex === visibleArticleImages.length - 1 ? (
                        <span
                          aria-hidden="true"
                          className={styles.articleMoreOverlay}
                        >
                          +{hiddenArticleImageCount}
                        </span>
                      ) : null}
                      <span
                        aria-hidden="true"
                        className={styles.articleZoomOverlay}
                        data-gallery-zoom-overlay="true"
                      >
                        <span className={styles.articleZoomIconShell}>
                          <ZoomIn
                            aria-hidden="true"
                            className={styles.articleZoomIcon}
                            strokeWidth={2.2}
                          />
                        </span>
                      </span>
                    </div>
                  </button>
                  {image.caption ? (
                    <figcaption className={styles.articleCaption}>
                      {image.caption}
                    </figcaption>
                  ) : null}
                </figure>
              ))}
            </div>
          ) : (
            <div
              className={styles.detailGallery}
              data-has-multiple-images={hasMultipleImages ? 'true' : 'false'}
            >
              <button
                aria-label={`Open ${getGalleryImageLabel(
                  resolvedImages[safeDetailImageIndex],
                  safeDetailImageIndex,
                )} in volledig scherm`}
                className={styles.detailMainButton}
                onClick={(event) =>
                  openLightbox(safeDetailImageIndex, event.currentTarget)
                }
                type="button"
              >
                <div className={styles.detailMainFrame}>
                  <GalleryImageMedia
                    image={resolvedImages[safeDetailImageIndex]}
                    imageIndex={safeDetailImageIndex}
                    kind="detail"
                    isFallbackVisible={Boolean(
                      failedImageIndexes[safeDetailImageIndex],
                    )}
                    onImageError={handleImageError}
                  />
                </div>
              </button>
              {hasMultipleImages ? (
                <div
                  aria-label="Galerijbediening"
                  className={styles.detailGalleryControls}
                >
                  <span className={styles.detailGalleryCounter}>
                    {safeDetailImageIndex + 1}/{resolvedImages.length}
                  </span>
                  <div className={styles.detailGalleryActions}>
                    <button
                      aria-label="Alle afbeeldingen weergeven"
                      className={styles.detailGalleryShowAllButton}
                      onClick={(event) =>
                        openLightbox(safeDetailImageIndex, event.currentTarget)
                      }
                      type="button"
                    >
                      Alles weergeven
                    </button>
                    <button
                      aria-label="Vorige afbeelding"
                      className={styles.detailGalleryNavButton}
                      disabled={safeDetailImageIndex === 0}
                      onClick={() => goToDetailImage(safeDetailImageIndex - 1)}
                      type="button"
                    >
                      <ChevronLeft
                        aria-hidden="true"
                        size={18}
                        strokeWidth={2.3}
                      />
                    </button>
                    <button
                      aria-label="Volgende afbeelding"
                      className={styles.detailGalleryNavButton}
                      disabled={
                        safeDetailImageIndex === resolvedImages.length - 1
                      }
                      onClick={() => goToDetailImage(safeDetailImageIndex + 1)}
                      type="button"
                    >
                      <ChevronRight
                        aria-hidden="true"
                        size={18}
                        strokeWidth={2.3}
                      />
                    </button>
                  </div>
                </div>
              ) : null}
              {hasMultipleImages ? (
                <div className={styles.detailThumbRow} role="tablist">
                  {resolvedImages.map((image, imageIndex) => (
                    <button
                      aria-label={`Bekijk afbeelding ${imageIndex + 1}`}
                      className={styles.detailThumbButton}
                      data-active={imageIndex === safeDetailImageIndex}
                      key={`${image.src}-thumb-${imageIndex}`}
                      onClick={() => setDetailImageIndex(imageIndex)}
                      role="tab"
                      type="button"
                    >
                      <div className={styles.detailThumbFrame}>
                        <GalleryImageMedia
                          image={image}
                          imageIndex={imageIndex}
                          kind="thumbnail"
                          isFallbackVisible={Boolean(
                            failedImageIndexes[imageIndex],
                          )}
                          onImageError={handleImageError}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </section>
      )}

      {lightbox && typeof document !== 'undefined'
        ? createPortal(lightbox, document.body)
        : lightbox}
    </>
  );
}

export function ImageCarousel(props: {
  ariaLabel?: string;
  className?: string;
  images: readonly GalleryImage[];
  variant?: ImageGalleryVariant;
}) {
  return <ImageGallery {...props} />;
}
