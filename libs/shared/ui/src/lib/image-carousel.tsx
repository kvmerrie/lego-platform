'use client';

import Image from 'next/image';
import { ChevronLeft, ChevronRight, Images, X, ZoomIn } from 'lucide-react';
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent as ReactSyntheticEvent,
  type TransitionEvent as ReactTransitionEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { lockDocumentScroll } from './document-scroll-lock';
import {
  clampImageZoomTransform,
  getCenteredImageZoomPoint,
  getImageZoomContentPointForFocalPoint,
  getImageZoomDistance,
  getImageZoomMidpoint,
  stepImageZoomMomentum,
  zoomImageTransformAroundContentPoint,
  zoomImageTransformAroundFocalPoint,
  type ImageZoomPoint,
  type ImageZoomTransform,
  type ImageZoomVelocity,
  type ImageZoomViewport,
} from './image-zoom-gestures';
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
  largeSrc?: string;
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
type LightboxOverviewReturnTransition = {
  imageIndex: number;
  key: number;
} | null;
type LightboxPresentationState = 'closed' | 'opening' | 'open' | 'closing';
type LightboxImageTransitionReason =
  | 'open'
  | 'return_to_gallery'
  | 'single_dialog_initial'
  | 'navigate_next_prev'
  | null;
type LightboxMotionMode = 'instant' | 'sheet';
type SwipeTarget = 'detail' | 'lightbox';
type SwipePhase = 'idle' | 'dragging' | 'resetting' | 'settling';

const SWIPE_AXIS_LOCK_THRESHOLD_PX = 10;
const SWIPE_AXIS_LOCK_RATIO = 1.6;
const SWIPE_DISTANCE_THRESHOLD_PX = 56;
const SWIPE_VELOCITY_THRESHOLD_PX_PER_MS = 0.42;
const SWIPE_TRACK_TRANSITION_MS = 240;
const LIGHTBOX_ZOOM_MIN_SCALE = 1;
const LIGHTBOX_ZOOM_MAX_SCALE = 3;
const LIGHTBOX_DOUBLE_TAP_TARGET_SCALE = 2.5;
const LIGHTBOX_DOUBLE_TAP_MAX_DELAY_MS = 280;
const LIGHTBOX_DOUBLE_TAP_MAX_DISTANCE_PX = 26;
const LIGHTBOX_DOUBLE_TAP_LOCK_MS = 320;
const LIGHTBOX_MOUSE_DRAG_CLICK_SUPPRESS_MS = 240;
const LIGHTBOX_IMAGE_FALLBACK_WIDTH = 1600;
const LIGHTBOX_IMAGE_FALLBACK_HEIGHT = 1000;
const LIGHTBOX_IMAGE_FALLBACK_ASPECT_RATIO =
  LIGHTBOX_IMAGE_FALLBACK_WIDTH / LIGHTBOX_IMAGE_FALLBACK_HEIGHT;
const LIGHTBOX_ZOOM_ANIMATION_MS = 220;
const LIGHTBOX_MOMENTUM_FRICTION = 0.92;
const LIGHTBOX_MOMENTUM_MIN_VELOCITY_PX_PER_MS = 0.018;
const LIGHTBOX_CLOSE_ANIMATION_MS = 320;
const LIGHTBOX_REDUCED_MOTION_CLOSE_ANIMATION_MS = 40;
const MOBILE_LIGHTBOX_SHEET_QUERY = '(max-width: 47.99rem)';

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

type LightboxZoomState = ImageZoomTransform;
type LightboxZoomPointer = ImageZoomPoint;

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
  return `${image.src}::${image.largeSrc ?? ''}::${image.thumbnailSrc ?? ''}::${image.alt}::${imageIndex}`;
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

function getLightboxMotionMode(): LightboxMotionMode {
  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(MOBILE_LIGHTBOX_SHEET_QUERY).matches
  ) {
    return 'sheet';
  }

  return 'instant';
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
  {
    fallbackAspectRatio,
    measuredAspectRatio,
  }: {
    fallbackAspectRatio?: number;
    measuredAspectRatio?: number;
  } = {},
): CSSProperties | undefined {
  const aspectRatio =
    measuredAspectRatio ??
    getGalleryImageAspectRatio(image) ??
    fallbackAspectRatio;

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

function getGalleryImageQuality(
  kind: GalleryImageMediaKind,
): number | undefined {
  return kind === 'detail' || kind === 'lightbox' ? 90 : undefined;
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
  onImageLoad,
}: {
  image: GalleryImage;
  imageIndex: number;
  kind: GalleryImageMediaKind;
  isFallbackVisible: boolean;
  onImageError: (imageIndex: number) => void;
  onImageLoad: (
    imageIndex: number,
    event: ReactSyntheticEvent<HTMLImageElement>,
  ) => void;
}) {
  const imageSource =
    kind === 'thumbnail' && image.thumbnailSrc
      ? image.thumbnailSrc
      : (kind === 'detail' || kind === 'lightbox') && image.largeSrc
        ? image.largeSrc
        : image.src;

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

  const imageClassName = joinClasses(
    styles.galleryImage,
    kind === 'article'
      ? styles.galleryImageArticle
      : kind === 'thumbnail'
        ? styles.galleryImageThumbnail
        : kind === 'overview'
          ? styles.galleryImageOverview
          : kind === 'lightbox'
            ? styles.galleryImageLightbox
            : styles.galleryImageDetail,
  );

  if (isLocalImageSource(imageSource)) {
    if (kind === 'lightbox') {
      return (
        <Image
          alt={image.alt}
          className={imageClassName}
          height={getGalleryImageIntrinsicDimension({
            fallback: LIGHTBOX_IMAGE_FALLBACK_HEIGHT,
            value: image.height,
          })}
          onError={() => onImageError(imageIndex)}
          onLoad={(event) => onImageLoad(imageIndex, event)}
          priority={imageIndex === 0}
          quality={getGalleryImageQuality(kind)}
          sizes="(max-width: 1280px) 100vw, 1400px"
          src={imageSource}
          width={getGalleryImageIntrinsicDimension({
            fallback: LIGHTBOX_IMAGE_FALLBACK_WIDTH,
            value: image.width,
          })}
        />
      );
    }

    return (
      <Image
        alt={image.alt}
        className={imageClassName}
        fill
        onError={() => onImageError(imageIndex)}
        onLoad={(event) => onImageLoad(imageIndex, event)}
        priority={imageIndex === 0 && kind !== 'overview'}
        quality={getGalleryImageQuality(kind)}
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
      className={imageClassName}
      decoding="async"
      fetchPriority={kind === 'detail' && imageIndex === 0 ? 'high' : 'auto'}
      height={getGalleryImageIntrinsicDimension({
        fallback:
          kind === 'thumbnail'
            ? 160
            : kind === 'detail'
              ? 900
              : LIGHTBOX_IMAGE_FALLBACK_HEIGHT,
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
      onLoad={(event) => onImageLoad(imageIndex, event)}
      src={imageSource}
      width={getGalleryImageIntrinsicDimension({
        fallback:
          kind === 'thumbnail'
            ? 224
            : kind === 'detail'
              ? 900
              : LIGHTBOX_IMAGE_FALLBACK_WIDTH,
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
  const [measuredImageAspectRatios, setMeasuredImageAspectRatios] = useState<
    Record<number, number>
  >({});
  const [detailImageIndex, setDetailImageIndex] = useState(0);
  const [lightboxImageIndex, setLightboxImageIndex] = useState<number | null>(
    null,
  );
  const [lightboxMode, setLightboxMode] = useState<LightboxMode>('viewer');
  const [
    lightboxOverviewReturnTransition,
    setLightboxOverviewReturnTransition,
  ] = useState<LightboxOverviewReturnTransition>(null);
  const [lightboxPresentationState, setLightboxPresentationState] =
    useState<LightboxPresentationState>('closed');
  const [lightboxImageTransitionReason, setLightboxImageTransitionReason] =
    useState<LightboxImageTransitionReason>(null);
  const [lightboxMotionMode, setLightboxMotionMode] =
    useState<LightboxMotionMode>('instant');
  const overviewImageButtonRefs = useRef<
    Record<number, HTMLButtonElement | null>
  >({});
  const lightboxPrimaryButtonRef = useRef<HTMLButtonElement>(null);
  const lightboxDialogRef = useRef<HTMLDivElement>(null);
  const lightboxMediaFrameRef = useRef<HTMLDivElement>(null);
  const pendingOverviewFocusIndexRef = useRef<number | null>(null);
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
    contentPoint: ImageZoomPoint;
    initialDistance: number;
    initialTransform: LightboxZoomState;
  } | null>(null);
  const lightboxPanGestureRef = useRef<{
    hasMoved: boolean;
    initialTranslateX: number;
    initialTranslateY: number;
    lastMovedAt: number;
    lastX: number;
    lastY: number;
    pointerId: number;
    pointerType: string;
    x: number;
    y: number;
  } | null>(null);
  const lightboxPanVelocityRef = useRef<ImageZoomVelocity>({ x: 0, y: 0 });
  const lightboxMomentumAnimationFrameRef = useRef<number | null>(null);
  const lightboxMomentumStateRef = useRef<{
    lastFrameAt: number;
    velocity: ImageZoomVelocity;
  } | null>(null);
  const lightboxTapRef = useRef<{
    tappedAt: number;
    x: number;
    y: number;
  } | null>(null);
  const lightboxDoubleTapLockUntilRef = useRef(0);
  const lightboxMouseClickGestureRef = useRef<{
    hasMoved: boolean;
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);
  const lightboxMouseClickSuppressUntilRef = useRef(0);
  const lightboxZoomAnimationTimerRef = useRef<number | null>(null);
  const lightboxOpenAnimationFrameRef = useRef<number | null>(null);
  const lightboxCloseFallbackTimerRef = useRef<number | null>(null);
  const suppressDetailClickRef = useRef(false);
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
  const lightboxZoomStateRef = useRef<LightboxZoomState>(
    INITIAL_LIGHTBOX_ZOOM_STATE,
  );
  const [isLightboxZoomAnimating, setIsLightboxZoomAnimating] = useState(false);
  const [isLightboxPanning, setIsLightboxPanning] = useState(false);

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

  const clearLightboxZoomAnimationTimer = useCallback(() => {
    const activeTimer = lightboxZoomAnimationTimerRef.current;

    if (activeTimer === null) {
      return;
    }

    window.clearTimeout(activeTimer);
    lightboxZoomAnimationTimerRef.current = null;
  }, []);

  const clearLightboxOpenAnimationFrame = useCallback(() => {
    const activeFrame = lightboxOpenAnimationFrameRef.current;

    if (activeFrame === null) {
      return;
    }

    window.cancelAnimationFrame(activeFrame);
    lightboxOpenAnimationFrameRef.current = null;
  }, []);

  const clearLightboxCloseFallbackTimer = useCallback(() => {
    const activeTimer = lightboxCloseFallbackTimerRef.current;

    if (activeTimer === null) {
      return;
    }

    window.clearTimeout(activeTimer);
    lightboxCloseFallbackTimerRef.current = null;
  }, []);

  const stopLightboxMomentum = useCallback(() => {
    const activeFrame = lightboxMomentumAnimationFrameRef.current;

    if (activeFrame !== null) {
      window.cancelAnimationFrame(activeFrame);
      lightboxMomentumAnimationFrameRef.current = null;
    }

    lightboxMomentumStateRef.current = null;
  }, []);

  const getLightboxZoomViewport = useCallback((): ImageZoomViewport | null => {
    const rect = lightboxMediaFrameRef.current?.getBoundingClientRect();

    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    return {
      height: rect.height,
      width: rect.width,
    };
  }, []);

  const getLightboxZoomTransformOptions = useCallback(() => {
    const viewport = getLightboxZoomViewport();

    if (!viewport) {
      return null;
    }

    return {
      maxScale: LIGHTBOX_ZOOM_MAX_SCALE,
      minScale: LIGHTBOX_ZOOM_MIN_SCALE,
      viewport,
    };
  }, [getLightboxZoomViewport]);

  const clampLightboxZoomTransform = useCallback(
    (transform: LightboxZoomState): LightboxZoomState => {
      const transformOptions = getLightboxZoomTransformOptions();

      if (!transformOptions) {
        const scale = Math.min(
          Math.max(transform.scale, LIGHTBOX_ZOOM_MIN_SCALE),
          LIGHTBOX_ZOOM_MAX_SCALE,
        );

        if (scale <= LIGHTBOX_ZOOM_MIN_SCALE + 0.01) {
          return INITIAL_LIGHTBOX_ZOOM_STATE;
        }

        return {
          ...transform,
          scale,
        };
      }

      return clampImageZoomTransform(transform, transformOptions);
    },
    [getLightboxZoomTransformOptions],
  );

  const startLightboxZoomAnimation = useCallback(() => {
    clearLightboxZoomAnimationTimer();
    setIsLightboxZoomAnimating(true);

    lightboxZoomAnimationTimerRef.current = window.setTimeout(() => {
      lightboxZoomAnimationTimerRef.current = null;
      setIsLightboxZoomAnimating(false);
    }, LIGHTBOX_ZOOM_ANIMATION_MS);
  }, [clearLightboxZoomAnimationTimer]);

  const setLightboxZoomTransform = useCallback(
    (
      nextTransform:
        | LightboxZoomState
        | ((currentTransform: LightboxZoomState) => LightboxZoomState),
    ) => {
      setLightboxZoomState((currentTransform) => {
        const resolvedTransform =
          typeof nextTransform === 'function'
            ? nextTransform(currentTransform)
            : nextTransform;

        lightboxZoomStateRef.current = resolvedTransform;

        return resolvedTransform;
      });
    },
    [],
  );

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

  const finishLightboxClose = useCallback(() => {
    clearLightboxOpenAnimationFrame();
    clearLightboxCloseFallbackTimer();
    setLightboxImageIndex(null);
    setLightboxMode('viewer');
    setLightboxMotionMode('instant');
    setLightboxOverviewReturnTransition(null);
    setLightboxImageTransitionReason(null);
    setLightboxPresentationState('closed');

    window.requestAnimationFrame(() => {
      lightboxTriggerRef.current?.focus({ preventScroll: true });
    });
  }, [clearLightboxCloseFallbackTimer, clearLightboxOpenAnimationFrame]);

  const beginLightboxOpen = useCallback(
    ({
      imageIndex,
      mode,
      transitionReason,
    }: {
      imageIndex: number;
      mode: LightboxMode;
      transitionReason: Exclude<LightboxImageTransitionReason, null>;
    }) => {
      const nextMotionMode = getLightboxMotionMode();

      clearLightboxOpenAnimationFrame();
      clearLightboxCloseFallbackTimer();
      setLightboxPresentationState(
        nextMotionMode === 'sheet' ? 'opening' : 'open',
      );
      setLightboxMotionMode(nextMotionMode);
      setLightboxMode(mode);
      setLightboxOverviewReturnTransition(null);
      setLightboxImageTransitionReason(transitionReason);
      setLightboxImageIndex(clampIndex(imageIndex, resolvedImages.length));

      if (nextMotionMode === 'instant') {
        return;
      }

      lightboxOpenAnimationFrameRef.current = window.requestAnimationFrame(
        () => {
          lightboxOpenAnimationFrameRef.current = null;
          setLightboxPresentationState((currentState) =>
            currentState === 'opening' ? 'open' : currentState,
          );
        },
      );
    },
    [
      clearLightboxCloseFallbackTimer,
      clearLightboxOpenAnimationFrame,
      resolvedImages.length,
    ],
  );

  const resetLightboxZoom = useCallback(() => {
    stopLightboxMomentum();
    clearLightboxZoomAnimationTimer();
    setIsLightboxZoomAnimating(false);
    lightboxZoomPointersRef.current.clear();
    lightboxZoomGestureRef.current = null;
    lightboxPanGestureRef.current = null;
    lightboxPanVelocityRef.current = { x: 0, y: 0 };
    lightboxTapRef.current = null;
    lightboxMouseClickGestureRef.current = null;
    lightboxMouseClickSuppressUntilRef.current = 0;
    setIsLightboxPanning(false);
    setLightboxZoomTransform(INITIAL_LIGHTBOX_ZOOM_STATE);
  }, [
    clearLightboxZoomAnimationTimer,
    setLightboxZoomTransform,
    stopLightboxMomentum,
  ]);

  const closeLightbox = useCallback(() => {
    if (
      lightboxImageIndex === null ||
      lightboxPresentationState === 'closing'
    ) {
      return;
    }

    clearSwipeSettleTimer('lightbox');
    clearSwipeResetAnimationFrame('lightbox');
    clearLightboxOpenAnimationFrame();
    clearLightboxCloseFallbackTimer();
    resetLightboxZoom();
    setLightboxSwipeState(INITIAL_SWIPE_VISUAL_STATE);
    setLightboxOverviewReturnTransition(null);

    if (lightboxMotionMode === 'instant') {
      finishLightboxClose();
      return;
    }

    setLightboxPresentationState('closing');

    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    lightboxCloseFallbackTimerRef.current = window.setTimeout(
      finishLightboxClose,
      prefersReducedMotion
        ? LIGHTBOX_REDUCED_MOTION_CLOSE_ANIMATION_MS
        : LIGHTBOX_CLOSE_ANIMATION_MS,
    );
  }, [
    clearLightboxCloseFallbackTimer,
    clearLightboxOpenAnimationFrame,
    clearSwipeResetAnimationFrame,
    clearSwipeSettleTimer,
    finishLightboxClose,
    lightboxImageIndex,
    lightboxMotionMode,
    lightboxPresentationState,
    resetLightboxZoom,
  ]);

  useEffect(() => {
    if (!resolvedImages.length) {
      setDetailImageIndex(0);
      setLightboxImageIndex(null);
      setLightboxMotionMode('instant');
      setLightboxImageTransitionReason(null);
      setLightboxPresentationState('closed');
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
    beginLightboxOpen({
      imageIndex: lightboxRequest.index,
      mode: 'viewer',
      transitionReason:
        resolvedImages.length <= 1 ? 'single_dialog_initial' : 'open',
    });
  }, [
    beginLightboxOpen,
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
        setLightboxImageTransitionReason('navigate_next_prev');
        setLightboxImageIndex((currentIndex) =>
          currentIndex === null
            ? 0
            : clampIndex(currentIndex + 1, resolvedImages.length),
        );
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        resetLightboxZoom();
        setLightboxImageTransitionReason('navigate_next_prev');
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
      const overviewButton =
        overviewImageButtonRefs.current[
          clampIndex(focusIndex, resolvedImages.length)
        ];

      overviewButton?.focus({ preventScroll: true });
      overviewButton?.scrollIntoView?.({
        block: 'nearest',
        inline: 'nearest',
      });
    });
  }, [lightboxMode, resolvedImages.length]);

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
      stopLightboxMomentum();
      clearLightboxZoomAnimationTimer();
      clearLightboxOpenAnimationFrame();
      clearLightboxCloseFallbackTimer();
    },
    [
      clearLightboxCloseFallbackTimer,
      clearLightboxOpenAnimationFrame,
      clearLightboxZoomAnimationTimer,
      stopLightboxMomentum,
    ],
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
  const lightboxOverviewReturnImage =
    lightboxOverviewReturnTransition === null
      ? null
      : resolvedImages[
          clampIndex(
            lightboxOverviewReturnTransition.imageIndex,
            resolvedImages.length,
          )
        ];
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
  const isDetailLightboxViewer =
    lightboxMode === 'viewer' && variant === 'detail';
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

  function handleImageLoad(
    imageIndex: number,
    event: ReactSyntheticEvent<HTMLImageElement>,
  ) {
    const { naturalHeight, naturalWidth } = event.currentTarget;

    if (
      !Number.isFinite(naturalWidth) ||
      !Number.isFinite(naturalHeight) ||
      naturalWidth <= 0 ||
      naturalHeight <= 0
    ) {
      return;
    }

    const measuredAspectRatio = naturalWidth / naturalHeight;

    setMeasuredImageAspectRatios((currentRatios) =>
      Math.abs((currentRatios[imageIndex] ?? 0) - measuredAspectRatio) < 0.001
        ? currentRatios
        : {
            ...currentRatios,
            [imageIndex]: measuredAspectRatio,
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
    const lightboxOpenMode =
      variant === 'detail' && resolvedImages.length > 1 ? 'overview' : 'viewer';

    beginLightboxOpen({
      imageIndex,
      mode: lightboxOpenMode,
      transitionReason:
        lightboxOpenMode === 'viewer' && resolvedImages.length <= 1
          ? 'single_dialog_initial'
          : 'open',
    });
  }

  function goToLightboxImage(nextIndex: number) {
    resetLightboxZoom();
    setLightboxOverviewReturnTransition(null);
    setLightboxImageTransitionReason(
      lightboxMode === 'overview' ? 'open' : 'navigate_next_prev',
    );
    setLightboxMode('viewer');
    setLightboxImageIndex(clampIndex(nextIndex, resolvedImages.length));
  }

  function returnToLightboxOverview() {
    if (safeLightboxImageIndex === null || !hasMultipleImages) {
      closeLightbox();
      return;
    }

    pendingOverviewFocusIndexRef.current = safeLightboxImageIndex;
    resetLightboxZoom();
    setLightboxOverviewReturnTransition(null);
    setLightboxImageTransitionReason('return_to_gallery');
    setLightboxMode('overview');
  }

  function handleLightboxCloseButtonClick() {
    if (isDetailLightboxViewer && hasMultipleImages) {
      returnToLightboxOverview();
      return;
    }

    closeLightbox();
  }

  function handleLightboxTransitionEnd(
    event: ReactTransitionEvent<HTMLDivElement>,
  ) {
    if (
      event.target === event.currentTarget &&
      lightboxMotionMode === 'sheet' &&
      lightboxPresentationState === 'closing'
    ) {
      finishLightboxClose();
    }
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

  function getZoomPointers(): LightboxZoomPointer[] {
    return Array.from(lightboxZoomPointersRef.current.values());
  }

  function getLightboxFocalPointFromClient({
    clientX,
    clientY,
  }: {
    clientX: number;
    clientY: number;
  }): ImageZoomPoint | null {
    const rect = lightboxMediaFrameRef.current?.getBoundingClientRect();

    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    return getCenteredImageZoomPoint({
      clientX,
      clientY,
      rect,
    });
  }

  function toggleLightboxZoomAtClientPoint({
    clientX,
    clientY,
  }: {
    clientX: number;
    clientY: number;
  }) {
    stopLightboxMomentum();
    startLightboxZoomAnimation();

    const focalPoint = getLightboxFocalPointFromClient({ clientX, clientY });
    const transformOptions = getLightboxZoomTransformOptions();

    setLightboxZoomTransform((currentTransform) => {
      if (currentTransform.scale > 1.01) {
        return INITIAL_LIGHTBOX_ZOOM_STATE;
      }

      if (!focalPoint || !transformOptions) {
        return {
          scale: LIGHTBOX_DOUBLE_TAP_TARGET_SCALE,
          translateX: 0,
          translateY: 0,
        };
      }

      return zoomImageTransformAroundFocalPoint({
        currentTransform,
        focalPoint,
        targetScale: LIGHTBOX_DOUBLE_TAP_TARGET_SCALE,
        transformOptions,
      });
    });
  }

  function startLightboxPanMomentum(velocity: ImageZoomVelocity) {
    const transformOptions = getLightboxZoomTransformOptions();

    if (
      !transformOptions ||
      Math.hypot(velocity.x, velocity.y) <
        LIGHTBOX_MOMENTUM_MIN_VELOCITY_PX_PER_MS
    ) {
      setLightboxZoomTransform((currentTransform) =>
        clampLightboxZoomTransform(currentTransform),
      );
      return;
    }

    stopLightboxMomentum();

    lightboxMomentumStateRef.current = {
      lastFrameAt: performance.now(),
      velocity,
    };

    const stepMomentum = (frameAt: number) => {
      const momentumState = lightboxMomentumStateRef.current;
      const activeTransformOptions = getLightboxZoomTransformOptions();

      if (!momentumState || !activeTransformOptions) {
        stopLightboxMomentum();
        return;
      }

      const momentumStep = stepImageZoomMomentum({
        elapsedMs: frameAt - momentumState.lastFrameAt,
        friction: LIGHTBOX_MOMENTUM_FRICTION,
        minVelocity: LIGHTBOX_MOMENTUM_MIN_VELOCITY_PX_PER_MS,
        transform: lightboxZoomStateRef.current,
        transformOptions: activeTransformOptions,
        velocity: momentumState.velocity,
      });

      setLightboxZoomTransform(momentumStep.transform);

      if (!momentumStep.shouldContinue) {
        stopLightboxMomentum();
        setLightboxZoomTransform((currentTransform) =>
          clampLightboxZoomTransform(currentTransform),
        );
        return;
      }

      lightboxMomentumStateRef.current = {
        lastFrameAt: frameAt,
        velocity: momentumStep.velocity,
      };
      lightboxMomentumAnimationFrameRef.current =
        window.requestAnimationFrame(stepMomentum);
    };

    lightboxMomentumAnimationFrameRef.current =
      window.requestAnimationFrame(stepMomentum);
  }

  function handleLightboxDoubleTap({
    clientX,
    clientY,
  }: {
    clientX: number;
    clientY: number;
  }): boolean {
    const tappedAt = performance.now();

    if (tappedAt < lightboxDoubleTapLockUntilRef.current) {
      lightboxTapRef.current = null;
      return true;
    }

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
    lightboxDoubleTapLockUntilRef.current =
      tappedAt + LIGHTBOX_DOUBLE_TAP_LOCK_MS;
    swipeStateRef.current = null;
    resetSwipeState('lightbox', { withoutTransition: true });
    toggleLightboxZoomAtClientPoint({ clientX, clientY });

    return true;
  }

  function handleDesktopLightboxClickZoom({
    clientX,
    clientY,
  }: {
    clientX: number;
    clientY: number;
  }): boolean {
    const clickedAt = performance.now();

    if (
      clickedAt < lightboxDoubleTapLockUntilRef.current ||
      clickedAt < lightboxMouseClickSuppressUntilRef.current
    ) {
      return true;
    }

    lightboxTapRef.current = null;
    lightboxDoubleTapLockUntilRef.current =
      clickedAt + LIGHTBOX_DOUBLE_TAP_LOCK_MS;
    swipeStateRef.current = null;
    resetSwipeState('lightbox', { withoutTransition: true });
    toggleLightboxZoomAtClientPoint({ clientX, clientY });

    return true;
  }

  function startLightboxPanGesture(
    event: ReactPointerEvent<HTMLElement>,
    initialTransform: LightboxZoomState,
  ): boolean {
    lightboxPanGestureRef.current = {
      hasMoved: false,
      initialTranslateX: initialTransform.translateX,
      initialTranslateY: initialTransform.translateY,
      lastMovedAt: performance.now(),
      lastX: event.clientX,
      lastY: event.clientY,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      x: event.clientX,
      y: event.clientY,
    };
    lightboxPanVelocityRef.current = { x: 0, y: 0 };
    setIsLightboxPanning(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();

    return true;
  }

  function handleLightboxZoomPointerDown(
    event: ReactPointerEvent<HTMLElement>,
  ): boolean {
    if (lightboxMode !== 'viewer') {
      return false;
    }

    if (event.pointerType === 'mouse') {
      if (event.button !== 0 || event.isPrimary === false) {
        return false;
      }

      lightboxMouseClickGestureRef.current = {
        hasMoved: false,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };

      const currentZoomState = lightboxZoomStateRef.current;

      if (currentZoomState.scale <= 1.01) {
        return false;
      }

      stopLightboxMomentum();
      clearLightboxZoomAnimationTimer();
      setIsLightboxZoomAnimating(false);

      lightboxZoomPointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });

      return startLightboxPanGesture(event, currentZoomState);
    }

    stopLightboxMomentum();
    clearLightboxZoomAnimationTimer();
    setIsLightboxZoomAnimating(false);

    lightboxZoomPointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const activePointers = getZoomPointers();

    if (activePointers.length >= 2) {
      const [firstPointer, secondPointer] = activePointers;
      const initialDistance = getImageZoomDistance(firstPointer, secondPointer);
      const centerPoint = getImageZoomMidpoint(firstPointer, secondPointer);
      const focalPoint = getLightboxFocalPointFromClient({
        clientX: centerPoint.x,
        clientY: centerPoint.y,
      });

      if (initialDistance > 0 && focalPoint) {
        lightboxZoomGestureRef.current = {
          contentPoint: getImageZoomContentPointForFocalPoint({
            focalPoint,
            transform: lightboxZoomStateRef.current,
          }),
          initialDistance,
          initialTransform: lightboxZoomStateRef.current,
        };
        lightboxPanGestureRef.current = null;
        lightboxPanVelocityRef.current = { x: 0, y: 0 };
        setIsLightboxPanning(false);
        swipeStateRef.current = null;
        resetSwipeState('lightbox', { withoutTransition: true });
        event.currentTarget.setPointerCapture?.(event.pointerId);
        event.preventDefault();

        return true;
      }
    }

    if (lightboxZoomStateRef.current.scale > 1.01) {
      return startLightboxPanGesture(event, lightboxZoomStateRef.current);
    }

    return false;
  }

  function handleLightboxZoomPointerMove(
    event: ReactPointerEvent<HTMLElement>,
  ): boolean {
    const mouseClickGesture = lightboxMouseClickGestureRef.current;

    if (
      event.pointerType === 'mouse' &&
      mouseClickGesture?.pointerId === event.pointerId &&
      !mouseClickGesture.hasMoved &&
      Math.hypot(
        event.clientX - mouseClickGesture.x,
        event.clientY - mouseClickGesture.y,
      ) > 3
    ) {
      lightboxMouseClickGestureRef.current = {
        ...mouseClickGesture,
        hasMoved: true,
      };
    }

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
      const nextDistance = getImageZoomDistance(firstPointer, secondPointer);
      const centerPoint = getImageZoomMidpoint(firstPointer, secondPointer);
      const focalPoint = getLightboxFocalPointFromClient({
        clientX: centerPoint.x,
        clientY: centerPoint.y,
      });
      const transformOptions = getLightboxZoomTransformOptions();

      event.preventDefault();

      if (!focalPoint || !transformOptions) {
        return true;
      }

      const zoomGesture = lightboxZoomGestureRef.current;
      const targetScale =
        (nextDistance / zoomGesture.initialDistance) *
        zoomGesture.initialTransform.scale;

      setLightboxZoomTransform(
        zoomImageTransformAroundContentPoint({
          contentPoint: zoomGesture.contentPoint,
          focalPoint,
          targetScale,
          transformOptions,
        }),
      );

      return true;
    }

    if (
      lightboxPanGestureRef.current &&
      lightboxPanGestureRef.current.pointerId === event.pointerId &&
      lightboxZoomStateRef.current.scale > 1.01
    ) {
      const panGesture = lightboxPanGestureRef.current;
      const movedAt = performance.now();
      const elapsedMs = Math.max(1, movedAt - panGesture.lastMovedAt);
      const deltaX = event.clientX - panGesture.x;
      const deltaY = event.clientY - panGesture.y;
      const moveDeltaX = event.clientX - panGesture.lastX;
      const moveDeltaY = event.clientY - panGesture.lastY;
      const nextVelocity = {
        x: moveDeltaX / elapsedMs,
        y: moveDeltaY / elapsedMs,
      };

      event.preventDefault();
      lightboxPanVelocityRef.current = {
        x: lightboxPanVelocityRef.current.x * 0.35 + nextVelocity.x * 0.65,
        y: lightboxPanVelocityRef.current.y * 0.35 + nextVelocity.y * 0.65,
      };
      lightboxPanGestureRef.current = {
        ...panGesture,
        hasMoved:
          panGesture.hasMoved ||
          Math.hypot(
            event.clientX - panGesture.x,
            event.clientY - panGesture.y,
          ) > 3,
        lastMovedAt: movedAt,
        lastX: event.clientX,
        lastY: event.clientY,
      };
      setLightboxZoomTransform((currentState) =>
        clampLightboxZoomTransform({
          ...currentState,
          translateX: panGesture.initialTranslateX + deltaX,
          translateY: panGesture.initialTranslateY + deltaY,
        }),
      );

      return true;
    }

    return lightboxZoomStateRef.current.scale > 1.01;
  }

  function handleLightboxZoomPointerEnd(
    event: ReactPointerEvent<HTMLElement>,
  ): boolean {
    const wasZoomInteraction =
      lightboxZoomGestureRef.current !== null ||
      lightboxPanGestureRef.current !== null ||
      lightboxZoomStateRef.current.scale > 1.01 ||
      lightboxZoomPointersRef.current.size > 1;
    const endedPanGesture =
      lightboxPanGestureRef.current?.pointerId === event.pointerId
        ? lightboxPanGestureRef.current
        : null;
    const endedMouseClickGesture =
      event.pointerType === 'mouse' &&
      lightboxMouseClickGestureRef.current?.pointerId === event.pointerId
        ? lightboxMouseClickGestureRef.current
        : null;

    lightboxZoomPointersRef.current.delete(event.pointerId);
    lightboxMouseClickGestureRef.current = null;

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
      setIsLightboxPanning(false);
    }

    if (
      endedPanGesture?.hasMoved &&
      lightboxZoomStateRef.current.scale > 1.01
    ) {
      if (endedPanGesture.pointerType === 'mouse') {
        lightboxMouseClickSuppressUntilRef.current =
          performance.now() + LIGHTBOX_MOUSE_DRAG_CLICK_SUPPRESS_MS;
      }

      startLightboxPanMomentum(lightboxPanVelocityRef.current);
    }

    if (endedMouseClickGesture?.hasMoved) {
      lightboxMouseClickSuppressUntilRef.current =
        performance.now() + LIGHTBOX_MOUSE_DRAG_CLICK_SUPPRESS_MS;
    }

    if (
      event.pointerType === 'touch' &&
      (!wasZoomInteraction || (endedPanGesture && !endedPanGesture.hasMoved)) &&
      handleLightboxDoubleTap({
        clientX: event.clientX,
        clientY: event.clientY,
      })
    ) {
      return true;
    }

    if (lightboxZoomStateRef.current.scale <= 1.01 && wasZoomInteraction) {
      setLightboxZoomTransform(INITIAL_LIGHTBOX_ZOOM_STATE);
    }

    return wasZoomInteraction;
  }

  function handleLightboxDoubleClick(event: ReactMouseEvent<HTMLElement>) {
    event.preventDefault();
    handleDesktopLightboxClickZoom({
      clientX: event.clientX,
      clientY: event.clientY,
    });
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
        setLightboxImageTransitionReason('navigate_next_prev');
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
    const renderMediaImage = ({
      image,
      imageIndex,
      isActiveLightboxImage = false,
    }: {
      image: GalleryImage;
      imageIndex: number;
      isActiveLightboxImage?: boolean;
    }) => {
      const shouldAnimateLightboxImageEnter =
        kind === 'lightbox' &&
        isActiveLightboxImage &&
        (lightboxImageTransitionReason === 'open' ||
          lightboxImageTransitionReason === 'single_dialog_initial');

      return (
        <span
          className={joinClasses(
            styles.swipeImageFrame,
            shouldAnimateLightboxImageEnter && styles.lightboxImageEnter,
          )}
          data-lightbox-image-enter={
            shouldAnimateLightboxImageEnter ? 'true' : undefined
          }
          data-lightbox-image-transition-reason={
            kind === 'lightbox' &&
            isActiveLightboxImage &&
            lightboxImageTransitionReason
              ? lightboxImageTransitionReason
              : undefined
          }
          key={
            shouldAnimateLightboxImageEnter
              ? `lightbox-enter-${lightboxImageTransitionReason}-${getGalleryImageKey(image, imageIndex)}`
              : undefined
          }
          style={getGalleryImageFrameStyle(image, {
            fallbackAspectRatio: LIGHTBOX_IMAGE_FALLBACK_ASPECT_RATIO,
            measuredAspectRatio: measuredImageAspectRatios[imageIndex],
          })}
        >
          <GalleryImageMedia
            image={image}
            imageIndex={imageIndex}
            kind={kind}
            isFallbackVisible={Boolean(failedImageIndexes[imageIndex])}
            onImageError={handleImageError}
            onImageLoad={handleImageLoad}
          />
        </span>
      );
    };

    return (
      <>
        <span className={styles.swipeStaticMedia}>
          <span className={styles.swipeStaticFrame}>
            {renderMediaImage({
              image: resolvedImages[currentIndex],
              imageIndex: currentIndex,
              isActiveLightboxImage: true,
            })}
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
                      {renderMediaImage({
                        image,
                        imageIndex,
                        isActiveLightboxImage: slideName === 'current',
                      })}
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
        data-lightbox-motion={lightboxMotionMode}
        data-lightbox-state={lightboxPresentationState}
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
          data-lightbox-motion={lightboxMotionMode}
          data-lightbox-state={lightboxPresentationState}
          data-lightbox-variant={variant}
          onClick={(event) => event.stopPropagation()}
          onTransitionEnd={handleLightboxTransitionEnd}
          ref={lightboxDialogRef}
          role="dialog"
          tabIndex={-1}
        >
          {isDetailLightboxViewer ? null : (
            <div className={styles.lightboxHeader}>
              {lightboxMode === 'overview' ? (
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
                data-lightbox-close="true"
                onClick={handleLightboxCloseButtonClick}
                ref={lightboxPrimaryButtonRef}
                type="button"
              >
                <X aria-hidden="true" size={18} strokeWidth={2.2} />
              </button>
            </div>
          )}

          {lightboxMode === 'overview' ? (
            <div className={styles.lightboxOverviewBody}>
              {lightboxOverviewReturnImage &&
              lightboxOverviewReturnTransition ? (
                <span
                  aria-hidden="true"
                  className={styles.lightboxOverviewReturnOverlay}
                  data-lightbox-overview-return-image="true"
                  key={`lightbox-overview-return-${lightboxOverviewReturnTransition.key}`}
                >
                  <span
                    className={styles.lightboxOverviewReturnFrame}
                    style={getGalleryImageFrameStyle(
                      lightboxOverviewReturnImage,
                      {
                        measuredAspectRatio:
                          measuredImageAspectRatios[
                            lightboxOverviewReturnTransition.imageIndex
                          ],
                      },
                    )}
                  >
                    <GalleryImageMedia
                      image={lightboxOverviewReturnImage}
                      imageIndex={lightboxOverviewReturnTransition.imageIndex}
                      kind="lightbox"
                      isFallbackVisible={Boolean(
                        failedImageIndexes[
                          lightboxOverviewReturnTransition.imageIndex
                        ],
                      )}
                      onImageError={handleImageError}
                      onImageLoad={handleImageLoad}
                    />
                  </span>
                </span>
              ) : null}
              <div
                className={joinClasses(
                  styles.lightboxOverview,
                  lightboxOverviewReturnTransition &&
                    styles.lightboxOverviewEnter,
                )}
                data-lightbox-overview-enter={
                  lightboxOverviewReturnTransition ? 'true' : undefined
                }
              >
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
                          style={getGalleryImageFrameStyle(image, {
                            measuredAspectRatio:
                              measuredImageAspectRatios[imageIndex],
                          })}
                        >
                          <GalleryImageMedia
                            image={image}
                            imageIndex={imageIndex}
                            kind="overview"
                            isFallbackVisible={Boolean(
                              failedImageIndexes[imageIndex],
                            )}
                            onImageError={handleImageError}
                            onImageLoad={handleImageLoad}
                          />
                        </span>
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          ) : (
            <div
              className={styles.lightboxViewport}
              data-lightbox-stage="viewer"
            >
              {isDetailLightboxViewer ? (
                <>
                  <p
                    aria-label={`Afbeelding ${safeLightboxImageIndex + 1} van ${resolvedImages.length}`}
                    aria-live="polite"
                    className={styles.lightboxCounterOverlay}
                  >
                    {safeLightboxImageIndex + 1}/{resolvedImages.length}
                  </p>
                  <button
                    aria-label={
                      hasMultipleImages
                        ? 'Terug naar overzicht'
                        : 'Sluit galerij'
                    }
                    className={styles.lightboxCloseButton}
                    data-lightbox-close="true"
                    data-lightbox-overlay-control="close"
                    onClick={handleLightboxCloseButtonClick}
                    ref={lightboxPrimaryButtonRef}
                    type="button"
                  >
                    <X aria-hidden="true" size={18} strokeWidth={2.2} />
                  </button>
                </>
              ) : null}
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
                data-lightbox-panning={isLightboxPanning ? 'true' : 'false'}
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
                ref={lightboxMediaFrameRef}
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
                  {
                    measuredAspectRatio:
                      measuredImageAspectRatios[safeLightboxImageIndex],
                  },
                )}
              >
                <span
                  className={styles.lightboxZoomSurface}
                  data-lightbox-zoom-animating={
                    isLightboxZoomAnimating ? 'true' : 'false'
                  }
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
                      onImageLoad={handleImageLoad}
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
                        onImageLoad={handleImageLoad}
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
                    {
                      measuredAspectRatio:
                        measuredImageAspectRatios[safeDetailImageIndex],
                    },
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
                          onImageLoad={handleImageLoad}
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
