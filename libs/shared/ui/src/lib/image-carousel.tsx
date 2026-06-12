'use client';

import Image from 'next/image';
import { ChevronLeft, ChevronRight, Images, X, ZoomIn } from 'lucide-react';
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { lockDocumentScroll } from './document-scroll-lock';
import styles from './image-carousel.module.css';

export type CarouselImageOrientation = 'landscape' | 'portrait' | 'square';
export type CarouselImageMediaRole =
  | 'box'
  | 'detail'
  | 'lifestyle'
  | 'model'
  | 'product';
export type CarouselImageRole =
  | 'box_back'
  | 'box_front'
  | 'build'
  | 'detail'
  | 'lifestyle_people'
  | 'lifestyle_room'
  | 'logo'
  | 'minifigure'
  | 'model_primary'
  | 'model_secondary'
  | 'unknown';
type LightboxOverviewTileVariant =
  | 'fallback'
  | 'featured'
  | 'lifestyle'
  | 'standard'
  | 'wide';
type LightboxOverviewLayoutVariant = 'featured' | 'fullWidth' | 'standard';
type LightboxOverviewFrameVariant =
  | 'featured'
  | 'fullWidth'
  | 'landscape'
  | 'portrait'
  | 'square';

export interface GalleryImage {
  alt: string;
  aspectRatio?: number;
  caption?: string;
  ctaHref?: string;
  ctaLabel?: string;
  height?: number;
  imageRole?: CarouselImageRole;
  mediaRole?: CarouselImageMediaRole;
  orientation?: CarouselImageOrientation;
  src: string;
  thumbnailSrc?: string;
  width?: number;
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
type SwipeTarget = 'detail' | 'lightbox';
type SwipePhase = 'idle' | 'dragging' | 'resetting' | 'settling';

const SWIPE_AXIS_LOCK_THRESHOLD_PX = 10;
const SWIPE_AXIS_LOCK_RATIO = 1.6;
const SWIPE_DISTANCE_THRESHOLD_PX = 56;
const SWIPE_VELOCITY_THRESHOLD_PX_PER_MS = 0.42;
const SWIPE_TRACK_TRANSITION_MS = 240;
const LIGHTBOX_ZOOM_MIN_SCALE = 1;
const LIGHTBOX_ZOOM_MAX_SCALE = 3;
const LIGHTBOX_DOUBLE_TAP_MAX_DELAY_MS = 280;
const LIGHTBOX_DOUBLE_TAP_MAX_DISTANCE_PX = 26;

const INITIAL_SWIPE_VISUAL_STATE = {
  delta: 0,
  direction: 0,
  phase: 'idle',
} satisfies SwipeVisualState;

const INITIAL_LIGHTBOX_ZOOM_STATE = {
  scale: 1,
  translateX: 0,
  translateY: 0,
} satisfies LightboxZoomState;

interface SwipeVisualState {
  delta: number;
  direction: -1 | 0 | 1;
  phase: SwipePhase;
}

interface LightboxZoomState {
  scale: number;
  translateX: number;
  translateY: number;
}

interface LightboxZoomPointer {
  x: number;
  y: number;
}

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

function getGalleryImageKey(image: GalleryImage, imageIndex: number): string {
  return `${image.src}::${image.thumbnailSrc ?? ''}::${image.alt}::${imageIndex}`;
}

function getGalleryImageLabel(image: GalleryImage, imageIndex: number): string {
  return image.alt.trim() || `Afbeelding ${imageIndex + 1}`;
}

function getGalleryImageAspectRatio(image: GalleryImage): number | undefined {
  if (
    typeof image.aspectRatio === 'number' &&
    Number.isFinite(image.aspectRatio) &&
    image.aspectRatio > 0
  ) {
    return image.aspectRatio;
  }

  if (
    typeof image.width === 'number' &&
    Number.isFinite(image.width) &&
    image.width > 0 &&
    typeof image.height === 'number' &&
    Number.isFinite(image.height) &&
    image.height > 0
  ) {
    return image.width / image.height;
  }

  return undefined;
}

function getGalleryImageOrientation(
  image: GalleryImage,
): CarouselImageOrientation | undefined {
  if (image.orientation) {
    return image.orientation;
  }

  const aspectRatio = getGalleryImageAspectRatio(image);

  if (!aspectRatio) {
    return undefined;
  }

  if (aspectRatio > 1.08) {
    return 'landscape';
  }

  if (aspectRatio < 0.92) {
    return 'portrait';
  }

  return 'square';
}

function getGalleryImageFrameStyle(
  image: GalleryImage,
): CSSProperties | undefined {
  const aspectRatio = getGalleryImageAspectRatio(image);

  if (!aspectRatio) {
    return undefined;
  }

  return {
    '--gallery-image-aspect-ratio': aspectRatio.toFixed(4),
  } as CSSProperties;
}

function hasGalleryImageMetadata(image: GalleryImage): boolean {
  return Boolean(getGalleryImageAspectRatio(image));
}

function isGalleryImageProductLike(image: GalleryImage): boolean {
  return image.mediaRole === 'box' || image.mediaRole === 'product';
}

function getLightboxOverviewTileVariant({
  image,
}: {
  image: GalleryImage;
}): LightboxOverviewTileVariant {
  if (image.mediaRole === 'lifestyle') {
    return 'lifestyle';
  }

  if (image.mediaRole === 'model') {
    return 'standard';
  }

  if (isGalleryImageProductLike(image)) {
    return 'standard';
  }

  const aspectRatio = getGalleryImageAspectRatio(image);
  const orientation = getGalleryImageOrientation(image);

  if (!aspectRatio) {
    return 'fallback';
  }

  if (
    image.mediaRole === 'detail' &&
    (orientation === 'landscape' || aspectRatio >= 1.25)
  ) {
    return 'wide';
  }

  if (aspectRatio > 1.4) {
    return 'wide';
  }

  return 'standard';
}

function getLightboxOverviewFrameVariant({
  image,
  layoutVariant,
}: {
  image: GalleryImage;
  layoutVariant: LightboxOverviewLayoutVariant;
}): LightboxOverviewFrameVariant {
  if (layoutVariant === 'featured') {
    return 'featured';
  }

  if (layoutVariant === 'fullWidth') {
    return 'fullWidth';
  }

  if (isGalleryImageProductLike(image)) {
    return 'square';
  }

  const orientation = getGalleryImageOrientation(image);

  if (orientation === 'landscape') {
    return 'landscape';
  }

  if (orientation === 'portrait') {
    return 'portrait';
  }

  return 'square';
}

interface LightboxOverviewOrderedItem {
  image: GalleryImage;
  imageIndex: number;
  tileVariant: LightboxOverviewTileVariant;
}

interface LightboxOverviewItem extends LightboxOverviewOrderedItem {
  frameVariant: LightboxOverviewFrameVariant;
  layoutVariant: LightboxOverviewLayoutVariant;
  overviewIndex: number;
}

function createLightboxOverviewItem({
  item,
  layoutVariant,
  overviewIndex,
}: {
  item: LightboxOverviewOrderedItem;
  layoutVariant: LightboxOverviewLayoutVariant;
  overviewIndex: number;
}): LightboxOverviewItem {
  return {
    ...item,
    frameVariant: getLightboxOverviewFrameVariant({
      image: item.image,
      layoutVariant,
    }),
    layoutVariant,
    overviewIndex,
  };
}

function planLightboxOverviewItems(
  orderedItems: readonly LightboxOverviewOrderedItem[],
): LightboxOverviewItem[] {
  const plannedItems: LightboxOverviewItem[] = [];
  const remainingItems = [...orderedItems];
  let rowIndex = 0;

  function pushPlannedItem({
    item,
    layoutVariant,
  }: {
    item: LightboxOverviewOrderedItem;
    layoutVariant: LightboxOverviewLayoutVariant;
  }) {
    plannedItems.push(
      createLightboxOverviewItem({
        item,
        layoutVariant,
        overviewIndex: plannedItems.length,
      }),
    );
  }

  while (remainingItems.length > 0) {
    const patternRowSize = rowIndex % 2 === 0 ? 2 : 1;

    if (patternRowSize === 2) {
      if (remainingItems.length === 1) {
        const item = remainingItems.shift();

        if (item) {
          pushPlannedItem({
            item,
            layoutVariant: 'fullWidth',
          });
        }

        break;
      }

      const rowItems = remainingItems.splice(0, 2);

      for (const item of rowItems) {
        pushPlannedItem({
          item,
          layoutVariant: 'standard',
        });
      }

      rowIndex += 1;
      continue;
    }

    if (remainingItems.length === 2) {
      const rowItems = remainingItems.splice(0, 2);

      for (const item of rowItems) {
        pushPlannedItem({
          item,
          layoutVariant: 'standard',
        });
      }

      break;
    }

    const item = remainingItems.shift();

    if (item) {
      pushPlannedItem({
        item,
        layoutVariant: 'fullWidth',
      });
    }

    rowIndex += 1;
  }

  return plannedItems;
}

function getLightboxOverviewItems(
  images: readonly GalleryImage[],
): LightboxOverviewItem[] {
  const orderedItems = images.map((image, imageIndex) => ({
    image,
    imageIndex,
    tileVariant: getLightboxOverviewTileVariant({ image }),
  }));

  return planLightboxOverviewItems(orderedItems);
}

function getGalleryImageIntrinsicDimension({
  fallback,
  value,
}: {
  fallback: number;
  value?: number;
}): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : fallback;
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
      height={getGalleryImageIntrinsicDimension({
        fallback: kind === 'thumbnail' ? 160 : kind === 'detail' ? 900 : 1000,
        value: image.height,
      })}
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
      width={getGalleryImageIntrinsicDimension({
        fallback: kind === 'thumbnail' ? 224 : kind === 'detail' ? 900 : 1600,
        value: image.width,
      })}
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
  const swipeStateRef = useRef<{
    mode: 'horizontal' | 'vertical' | null;
    pointerId: number | null;
    startedAt: number;
    target: SwipeTarget | null;
    x: number;
    y: number;
  } | null>(null);
  const lightboxZoomPointersRef = useRef<Map<number, LightboxZoomPointer>>(
    new Map(),
  );
  const lightboxZoomGestureRef = useRef<{
    initialDistance: number;
    initialScale: number;
  } | null>(null);
  const lightboxPanGestureRef = useRef<{
    initialTranslateX: number;
    initialTranslateY: number;
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);
  const lightboxTapRef = useRef<{
    tappedAt: number;
    x: number;
    y: number;
  } | null>(null);
  const suppressDetailClickRef = useRef(false);
  const pendingOverviewFocusIndexRef = useRef<number | null>(null);
  const lightboxTriggerRef = useRef<HTMLElement | null>(null);
  const swipeSettleTimersRef = useRef<Record<SwipeTarget, number | null>>({
    detail: null,
    lightbox: null,
  });
  const swipeResetAnimationFramesRef = useRef<
    Record<SwipeTarget, number | null>
  >({
    detail: null,
    lightbox: null,
  });
  const [detailSwipeState, setDetailSwipeState] = useState<SwipeVisualState>(
    INITIAL_SWIPE_VISUAL_STATE,
  );
  const [lightboxSwipeState, setLightboxSwipeState] =
    useState<SwipeVisualState>(INITIAL_SWIPE_VISUAL_STATE);
  const [lightboxZoomState, setLightboxZoomState] = useState<LightboxZoomState>(
    INITIAL_LIGHTBOX_ZOOM_STATE,
  );

  const clearSwipeSettleTimer = useCallback((target: SwipeTarget) => {
    const activeTimer = swipeSettleTimersRef.current[target];

    if (activeTimer === null) {
      return;
    }

    window.clearTimeout(activeTimer);
    swipeSettleTimersRef.current[target] = null;
  }, []);

  const clearSwipeResetAnimationFrame = useCallback((target: SwipeTarget) => {
    const activeFrame = swipeResetAnimationFramesRef.current[target];

    if (activeFrame === null) {
      return;
    }

    window.cancelAnimationFrame(activeFrame);
    swipeResetAnimationFramesRef.current[target] = null;
  }, []);

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

  const resetLightboxZoom = useCallback(() => {
    lightboxZoomPointersRef.current.clear();
    lightboxZoomGestureRef.current = null;
    lightboxPanGestureRef.current = null;
    lightboxTapRef.current = null;
    setLightboxZoomState(INITIAL_LIGHTBOX_ZOOM_STATE);
  }, []);

  const closeLightbox = useCallback(() => {
    clearSwipeSettleTimer('lightbox');
    clearSwipeResetAnimationFrame('lightbox');
    resetLightboxZoom();
    setLightboxSwipeState(INITIAL_SWIPE_VISUAL_STATE);
    setLightboxImageIndex(null);
    setLightboxMode('viewer');

    window.requestAnimationFrame(() => {
      lightboxTriggerRef.current?.focus({ preventScroll: true });
    });
  }, [clearSwipeResetAnimationFrame, clearSwipeSettleTimer, resetLightboxZoom]);

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
    resetLightboxZoom();
    setLightboxMode('viewer');
    setLightboxImageIndex(
      clampIndex(lightboxRequest.index, resolvedImages.length),
    );
  }, [
    lightboxRequest,
    rememberLightboxTrigger,
    resetLightboxZoom,
    resolvedImages.length,
  ]);

  useEffect(() => {
    if (lightboxImageIndex === null) {
      return undefined;
    }

    const unlockDocumentScroll = lockDocumentScroll();

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
        resetLightboxZoom();
        setLightboxImageIndex((currentIndex) =>
          currentIndex === null
            ? 0
            : clampIndex(currentIndex + 1, resolvedImages.length),
        );
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        resetLightboxZoom();
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
      unlockDocumentScroll();
    };
  }, [
    closeLightbox,
    lightboxImageIndex,
    lightboxMode,
    resetLightboxZoom,
    resolvedImages.length,
  ]);

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

  useEffect(
    () => () => {
      Object.values(swipeSettleTimersRef.current).forEach((timer) => {
        if (timer !== null) {
          window.clearTimeout(timer);
        }
      });
      Object.values(swipeResetAnimationFramesRef.current).forEach((frame) => {
        if (frame !== null) {
          window.cancelAnimationFrame(frame);
        }
      });
    },
    [],
  );

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
    resetLightboxZoom();
    setLightboxMode(
      variant === 'detail' && resolvedImages.length > 1 ? 'overview' : 'viewer',
    );
    setLightboxImageIndex(clampIndex(imageIndex, resolvedImages.length));
  }

  function goToLightboxImage(nextIndex: number) {
    resetLightboxZoom();
    setLightboxMode('viewer');
    setLightboxImageIndex(clampIndex(nextIndex, resolvedImages.length));
  }

  function returnToLightboxOverview() {
    pendingOverviewFocusIndexRef.current = safeLightboxImageIndex;
    resetLightboxZoom();
    setLightboxMode('overview');
  }

  function handleLightboxCloseButtonClick() {
    if (
      lightboxMode === 'viewer' &&
      variant === 'detail' &&
      hasMultipleImages
    ) {
      returnToLightboxOverview();
      return;
    }

    closeLightbox();
  }

  function getSwipeDeltaForBounds({
    delta,
    imageIndex,
  }: {
    delta: number;
    imageIndex: number;
  }): number {
    const isAtFirstImage = imageIndex <= 0;
    const isAtLastImage = imageIndex >= resolvedImages.length - 1;

    if ((isAtFirstImage && delta > 0) || (isAtLastImage && delta < 0)) {
      return delta * 0.28;
    }

    return delta;
  }

  function updateSwipeState(target: SwipeTarget, nextState: SwipeVisualState) {
    clearSwipeSettleTimer(target);
    clearSwipeResetAnimationFrame(target);

    if (target === 'detail') {
      setDetailSwipeState(nextState);
      return;
    }

    setLightboxSwipeState(nextState);
  }

  function setSwipeDelta(target: SwipeTarget, delta: number) {
    updateSwipeState(target, {
      delta,
      direction: 0,
      phase: 'dragging',
    });
  }

  function setSwipeState(target: SwipeTarget, nextState: SwipeVisualState) {
    if (target === 'detail') {
      setDetailSwipeState(nextState);
      return;
    }

    setLightboxSwipeState(nextState);
  }

  function resetSwipeState(
    target: SwipeTarget,
    { withoutTransition = false }: { withoutTransition?: boolean } = {},
  ) {
    clearSwipeSettleTimer(target);
    clearSwipeResetAnimationFrame(target);

    if (!withoutTransition) {
      setSwipeState(target, INITIAL_SWIPE_VISUAL_STATE);
      return;
    }

    setSwipeState(target, {
      delta: 0,
      direction: 0,
      phase: 'resetting',
    });

    swipeResetAnimationFramesRef.current[target] = window.requestAnimationFrame(
      () => {
        swipeResetAnimationFramesRef.current[target] = null;
        setSwipeState(target, INITIAL_SWIPE_VISUAL_STATE);
      },
    );
  }

  function getSwipeTrackTransform(swipeState: SwipeVisualState): string {
    if (swipeState.phase === 'settling' && swipeState.direction === -1) {
      return 'translate3d(0%, 0, 0)';
    }

    if (swipeState.phase === 'settling' && swipeState.direction === 1) {
      return 'translate3d(-66.666667%, 0, 0)';
    }

    return `translate3d(calc(-33.333333% + ${swipeState.delta}px), 0, 0)`;
  }

  function clampLightboxZoomScale(scale: number): number {
    return Math.min(
      Math.max(scale, LIGHTBOX_ZOOM_MIN_SCALE),
      LIGHTBOX_ZOOM_MAX_SCALE,
    );
  }

  function getPointerDistance(
    firstPointer: LightboxZoomPointer,
    secondPointer: LightboxZoomPointer,
  ): number {
    return Math.hypot(
      secondPointer.x - firstPointer.x,
      secondPointer.y - firstPointer.y,
    );
  }

  function getZoomPointers(): LightboxZoomPointer[] {
    return Array.from(lightboxZoomPointersRef.current.values());
  }

  function handleLightboxDoubleTap({
    clientX,
    clientY,
  }: {
    clientX: number;
    clientY: number;
  }): boolean {
    const tappedAt = performance.now();
    const previousTap = lightboxTapRef.current;

    lightboxTapRef.current = {
      tappedAt,
      x: clientX,
      y: clientY,
    };

    if (!previousTap) {
      return false;
    }

    const tapDelay = tappedAt - previousTap.tappedAt;
    const tapDistance = Math.hypot(
      clientX - previousTap.x,
      clientY - previousTap.y,
    );

    if (
      tapDelay > LIGHTBOX_DOUBLE_TAP_MAX_DELAY_MS ||
      tapDistance > LIGHTBOX_DOUBLE_TAP_MAX_DISTANCE_PX
    ) {
      return false;
    }

    lightboxTapRef.current = null;
    swipeStateRef.current = null;
    resetSwipeState('lightbox', { withoutTransition: true });

    setLightboxZoomState((currentState) =>
      currentState.scale > 1.01
        ? INITIAL_LIGHTBOX_ZOOM_STATE
        : {
            scale: 2,
            translateX: 0,
            translateY: 0,
          },
    );

    return true;
  }

  function handleLightboxZoomPointerDown(
    event: ReactPointerEvent<HTMLElement>,
  ): boolean {
    if (lightboxMode !== 'viewer' || event.pointerType === 'mouse') {
      return false;
    }

    lightboxZoomPointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const activePointers = getZoomPointers();

    if (activePointers.length >= 2) {
      const [firstPointer, secondPointer] = activePointers;
      const initialDistance = getPointerDistance(firstPointer, secondPointer);

      if (initialDistance > 0) {
        lightboxZoomGestureRef.current = {
          initialDistance,
          initialScale: lightboxZoomState.scale,
        };
        lightboxPanGestureRef.current = null;
        swipeStateRef.current = null;
        resetSwipeState('lightbox', { withoutTransition: true });
        event.currentTarget.setPointerCapture?.(event.pointerId);

        return true;
      }
    }

    if (lightboxZoomState.scale > 1.01) {
      lightboxPanGestureRef.current = {
        initialTranslateX: lightboxZoomState.translateX,
        initialTranslateY: lightboxZoomState.translateY,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);

      return true;
    }

    return false;
  }

  function handleLightboxZoomPointerMove(
    event: ReactPointerEvent<HTMLElement>,
  ): boolean {
    if (!lightboxZoomPointersRef.current.has(event.pointerId)) {
      return false;
    }

    lightboxZoomPointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const activePointers = getZoomPointers();

    if (lightboxZoomGestureRef.current && activePointers.length >= 2) {
      const [firstPointer, secondPointer] = activePointers;
      const nextDistance = getPointerDistance(firstPointer, secondPointer);

      event.preventDefault();
      setLightboxZoomState((currentState) => ({
        ...currentState,
        scale: clampLightboxZoomScale(
          lightboxZoomGestureRef.current
            ? (nextDistance / lightboxZoomGestureRef.current.initialDistance) *
                lightboxZoomGestureRef.current.initialScale
            : currentState.scale,
        ),
      }));

      return true;
    }

    if (
      lightboxPanGestureRef.current &&
      lightboxPanGestureRef.current.pointerId === event.pointerId &&
      lightboxZoomState.scale > 1.01
    ) {
      const panGesture = lightboxPanGestureRef.current;

      event.preventDefault();
      setLightboxZoomState((currentState) => ({
        ...currentState,
        translateX: panGesture.initialTranslateX + event.clientX - panGesture.x,
        translateY: panGesture.initialTranslateY + event.clientY - panGesture.y,
      }));

      return true;
    }

    return lightboxZoomState.scale > 1.01;
  }

  function handleLightboxZoomPointerEnd(
    event: ReactPointerEvent<HTMLElement>,
  ): boolean {
    const wasZoomInteraction =
      lightboxZoomGestureRef.current !== null ||
      lightboxPanGestureRef.current !== null ||
      lightboxZoomState.scale > 1.01 ||
      lightboxZoomPointersRef.current.size > 1;

    lightboxZoomPointersRef.current.delete(event.pointerId);

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (lightboxZoomPointersRef.current.size < 2) {
      lightboxZoomGestureRef.current = null;
    }

    if (
      lightboxPanGestureRef.current?.pointerId === event.pointerId ||
      lightboxZoomPointersRef.current.size === 0
    ) {
      lightboxPanGestureRef.current = null;
    }

    if (
      event.pointerType === 'touch' &&
      !wasZoomInteraction &&
      handleLightboxDoubleTap({
        clientX: event.clientX,
        clientY: event.clientY,
      })
    ) {
      return true;
    }

    if (lightboxZoomState.scale <= 1.01 && wasZoomInteraction) {
      setLightboxZoomState(INITIAL_LIGHTBOX_ZOOM_STATE);
    }

    return wasZoomInteraction;
  }

  function handleLightboxDoubleClick() {
    setLightboxZoomState((currentState) =>
      currentState.scale > 1.01
        ? INITIAL_LIGHTBOX_ZOOM_STATE
        : {
            scale: 2,
            translateX: 0,
            translateY: 0,
          },
    );
  }

  function settleSwipe({
    direction,
    target,
  }: {
    direction: -1 | 0 | 1;
    target: SwipeTarget;
  }) {
    updateSwipeState(target, {
      delta: 0,
      direction,
      phase: 'settling',
    });

    swipeSettleTimersRef.current[target] = window.setTimeout(() => {
      swipeSettleTimersRef.current[target] = null;

      if (direction === 0) {
        resetSwipeState(target);
        return;
      }

      if (target === 'detail') {
        setDetailImageIndex((currentIndex) =>
          clampIndex(currentIndex + direction, resolvedImages.length),
        );
      } else {
        resetLightboxZoom();
        setLightboxImageIndex((currentIndex) =>
          currentIndex === null
            ? 0
            : clampIndex(currentIndex + direction, resolvedImages.length),
        );
      }

      resetSwipeState(target, { withoutTransition: true });
    }, SWIPE_TRACK_TRANSITION_MS);
  }

  function endSwipe({
    delta,
    durationMs,
    target,
  }: {
    delta: number;
    durationMs: number;
    target: SwipeTarget;
  }) {
    const velocity = Math.abs(delta) / Math.max(durationMs, 1);
    const shouldNavigate =
      Math.abs(delta) >= SWIPE_DISTANCE_THRESHOLD_PX ||
      (Math.abs(delta) >= SWIPE_DISTANCE_THRESHOLD_PX * 0.7 &&
        velocity >= SWIPE_VELOCITY_THRESHOLD_PX_PER_MS);

    if (!shouldNavigate) {
      settleSwipe({ direction: 0, target });
      return;
    }

    if (target === 'detail') {
      const direction = delta < 0 ? 1 : -1;
      const nextIndex = safeDetailImageIndex + direction;

      settleSwipe({
        direction:
          nextIndex >= 0 && nextIndex < resolvedImages.length ? direction : 0,
        target,
      });
      return;
    }

    const currentLightboxIndex = safeLightboxImageIndex ?? 0;
    const direction = delta < 0 ? 1 : -1;
    const nextIndex = currentLightboxIndex + direction;

    settleSwipe({
      direction:
        nextIndex >= 0 && nextIndex < resolvedImages.length ? direction : 0,
      target,
    });
  }

  function handleSwipePointerDown({
    event,
    target,
  }: {
    event: ReactPointerEvent<HTMLElement>;
    target: SwipeTarget;
  }) {
    if (!hasMultipleImages || event.pointerType === 'mouse') {
      return;
    }

    if (
      target === 'lightbox' &&
      (lightboxZoomState.scale > 1.01 ||
        lightboxZoomPointersRef.current.size > 1)
    ) {
      return;
    }

    swipeStateRef.current = {
      mode: null,
      pointerId: event.pointerId,
      startedAt: performance.now(),
      target,
      x: event.clientX,
      y: event.clientY,
    };
  }

  function handleSwipePointerMove(event: ReactPointerEvent<HTMLElement>) {
    const swipeState = swipeStateRef.current;

    if (
      !swipeState ||
      swipeState.pointerId !== event.pointerId ||
      !swipeState.target
    ) {
      return;
    }

    const deltaX = event.clientX - swipeState.x;
    const deltaY = event.clientY - swipeState.y;
    const absoluteDeltaX = Math.abs(deltaX);
    const absoluteDeltaY = Math.abs(deltaY);

    if (swipeState.mode === null) {
      if (
        absoluteDeltaX < SWIPE_AXIS_LOCK_THRESHOLD_PX &&
        absoluteDeltaY < SWIPE_AXIS_LOCK_THRESHOLD_PX
      ) {
        return;
      }

      swipeState.mode =
        absoluteDeltaX > absoluteDeltaY * SWIPE_AXIS_LOCK_RATIO
          ? 'horizontal'
          : 'vertical';

      if (swipeState.mode === 'horizontal') {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } else {
        swipeStateRef.current = null;
        resetSwipeState(swipeState.target);
        return;
      }
    }

    if (swipeState.mode !== 'horizontal') {
      return;
    }

    event.preventDefault();

    const imageIndex =
      swipeState.target === 'detail'
        ? safeDetailImageIndex
        : (safeLightboxImageIndex ?? 0);

    setSwipeDelta(
      swipeState.target,
      getSwipeDeltaForBounds({
        delta: deltaX,
        imageIndex,
      }),
    );
  }

  function handleSwipePointerEnd(event: ReactPointerEvent<HTMLElement>) {
    const swipeState = swipeStateRef.current;

    if (
      !swipeState ||
      swipeState.pointerId !== event.pointerId ||
      !swipeState.target
    ) {
      return;
    }

    swipeStateRef.current = null;

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (swipeState.mode !== 'horizontal') {
      resetSwipeState(swipeState.target);
      return;
    }

    const delta = event.clientX - swipeState.x;

    if (Math.abs(delta) > SWIPE_AXIS_LOCK_THRESHOLD_PX) {
      suppressDetailClickRef.current = swipeState.target === 'detail';
    }

    endSwipe({
      delta,
      durationMs: performance.now() - swipeState.startedAt,
      target: swipeState.target,
    });
  }

  function handleSwipePointerCancel() {
    const swipeState = swipeStateRef.current;

    swipeStateRef.current = null;

    if (!swipeState?.target) {
      return;
    }

    settleSwipe({ direction: 0, target: swipeState.target });
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

  function renderSwipeableMedia({
    currentIndex,
    kind,
    swipeState,
    target,
  }: {
    currentIndex: number;
    kind: Extract<GalleryImageMediaKind, 'detail' | 'lightbox'>;
    swipeState: SwipeVisualState;
    target: SwipeTarget;
  }) {
    const slideIndexes = [currentIndex - 1, currentIndex, currentIndex + 1];

    return (
      <>
        <span className={styles.swipeStaticMedia}>
          <span className={styles.swipeStaticFrame}>
            <GalleryImageMedia
              image={resolvedImages[currentIndex]}
              imageIndex={currentIndex}
              kind={kind}
              isFallbackVisible={Boolean(failedImageIndexes[currentIndex])}
              onImageError={handleImageError}
            />
          </span>
        </span>
        <span className={styles.swipeViewport} aria-hidden="true">
          <span
            className={styles.swipeTrack}
            data-swipe-direction={swipeState.direction}
            data-swipe-phase={swipeState.phase}
            data-swipe-track={target}
            style={{
              transform: getSwipeTrackTransform(swipeState),
            }}
          >
            {slideIndexes.map((imageIndex, slideIndex) => {
              const image = resolvedImages[imageIndex];
              const slideName =
                slideIndex === 0
                  ? 'previous'
                  : slideIndex === 1
                    ? 'current'
                    : 'next';

              return (
                <span
                  className={styles.swipeSlide}
                  data-swipe-slide={slideName}
                  key={
                    image
                      ? `${target}-${getGalleryImageKey(image, imageIndex)}`
                      : `${target}-${slideName}-placeholder`
                  }
                >
                  {image ? (
                    <span className={styles.swipeSlideFrame}>
                      <GalleryImageMedia
                        image={image}
                        imageIndex={imageIndex}
                        kind={kind}
                        isFallbackVisible={Boolean(
                          failedImageIndexes[imageIndex],
                        )}
                        onImageError={handleImageError}
                      />
                    </span>
                  ) : (
                    <span className={styles.swipeSlidePlaceholder} />
                  )}
                </span>
              );
            })}
          </span>
        </span>
      </>
    );
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
              <p aria-live="polite" className={styles.lightboxIndicator}>
                {safeLightboxImageIndex + 1}/{resolvedImages.length}
              </p>
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
              aria-label={
                lightboxMode === 'viewer' &&
                variant === 'detail' &&
                hasMultipleImages
                  ? 'Toon alle afbeeldingen'
                  : 'Sluit galerij'
              }
              className={styles.lightboxCloseButton}
              data-lightbox-close="true"
              onClick={handleLightboxCloseButtonClick}
              ref={lightboxPrimaryButtonRef}
              type="button"
            >
              <X aria-hidden="true" size={18} strokeWidth={2.2} />
            </button>
          </div>

          {lightboxMode === 'overview' ? (
            <div className={styles.lightboxOverviewBody}>
              <div className={styles.lightboxOverview}>
                {getLightboxOverviewItems(resolvedImages).map(
                  ({
                    frameVariant,
                    image,
                    imageIndex,
                    layoutVariant,
                    overviewIndex,
                    tileVariant,
                  }) => {
                    return (
                      <button
                        aria-label={`Bekijk afbeelding ${overviewIndex + 1}`}
                        className={styles.lightboxOverviewButton}
                        data-has-image-metadata={
                          hasGalleryImageMetadata(image) ? 'true' : undefined
                        }
                        data-image-role={image.imageRole}
                        data-image-media-role={image.mediaRole}
                        data-image-orientation={getGalleryImageOrientation(
                          image,
                        )}
                        data-lightbox-featured={
                          layoutVariant === 'featured' ? 'true' : undefined
                        }
                        data-lightbox-frame={frameVariant}
                        data-lightbox-grid-index={imageIndex}
                        data-lightbox-layout-variant={layoutVariant}
                        data-lightbox-tile={tileVariant}
                        key={`${image.src}-lightbox-grid-${imageIndex}`}
                        onClick={() => goToLightboxImage(imageIndex)}
                        ref={(element) => {
                          overviewImageButtonRefs.current[imageIndex] = element;
                        }}
                        type="button"
                      >
                        <span
                          className={styles.lightboxOverviewFrame}
                          style={getGalleryImageFrameStyle(image)}
                        >
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
                    );
                  },
                )}
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
                data-lightbox-zoomed={
                  lightboxZoomState.scale > 1.01 ? 'true' : 'false'
                }
                data-lightbox-media-surface="light"
                data-image-role={
                  resolvedImages[safeLightboxImageIndex].imageRole
                }
                data-image-media-role={
                  resolvedImages[safeLightboxImageIndex].mediaRole
                }
                data-image-orientation={getGalleryImageOrientation(
                  resolvedImages[safeLightboxImageIndex],
                )}
                data-swipe-target="lightbox"
                onPointerCancel={(event) => {
                  handleLightboxZoomPointerEnd(event);
                  handleSwipePointerCancel();
                }}
                onDoubleClick={handleLightboxDoubleClick}
                onPointerDown={(event) => {
                  const isZoomPointerHandled =
                    handleLightboxZoomPointerDown(event);

                  if (isZoomPointerHandled) {
                    return;
                  }

                  handleSwipePointerDown({
                    event,
                    target: 'lightbox',
                  });
                }}
                onPointerMove={(event) => {
                  const isZoomPointerHandled =
                    handleLightboxZoomPointerMove(event);

                  if (isZoomPointerHandled) {
                    return;
                  }

                  handleSwipePointerMove(event);
                }}
                onPointerUp={(event) => {
                  const isZoomPointerHandled =
                    handleLightboxZoomPointerEnd(event);

                  if (isZoomPointerHandled) {
                    return;
                  }

                  handleSwipePointerEnd(event);
                }}
                style={getGalleryImageFrameStyle(
                  resolvedImages[safeLightboxImageIndex],
                )}
              >
                <span
                  className={styles.lightboxZoomSurface}
                  style={{
                    transform: `translate3d(${lightboxZoomState.translateX}px, ${lightboxZoomState.translateY}px, 0) scale(${lightboxZoomState.scale})`,
                  }}
                >
                  {renderSwipeableMedia({
                    currentIndex: safeLightboxImageIndex,
                    kind: 'lightbox',
                    swipeState: lightboxSwipeState,
                    target: 'lightbox',
                  })}
                </span>
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
                onClick={(event) => {
                  if (suppressDetailClickRef.current) {
                    suppressDetailClickRef.current = false;
                    event.preventDefault();
                    return;
                  }

                  openLightbox(safeDetailImageIndex, event.currentTarget);
                }}
                onPointerCancel={handleSwipePointerCancel}
                onPointerDown={(event) =>
                  handleSwipePointerDown({
                    event,
                    target: 'detail',
                  })
                }
                onPointerMove={handleSwipePointerMove}
                onPointerUp={handleSwipePointerEnd}
                type="button"
              >
                <div
                  className={styles.detailMainFrame}
                  data-image-role={
                    resolvedImages[safeDetailImageIndex].imageRole
                  }
                  data-image-media-role={
                    resolvedImages[safeDetailImageIndex].mediaRole
                  }
                  data-image-orientation={getGalleryImageOrientation(
                    resolvedImages[safeDetailImageIndex],
                  )}
                  data-swipe-target="detail"
                  style={getGalleryImageFrameStyle(
                    resolvedImages[safeDetailImageIndex],
                  )}
                >
                  {renderSwipeableMedia({
                    currentIndex: safeDetailImageIndex,
                    kind: 'detail',
                    swipeState: detailSwipeState,
                    target: 'detail',
                  })}
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
                      <Images aria-hidden="true" size={16} strokeWidth={2.2} />
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
