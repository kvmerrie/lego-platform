export interface ImageZoomPoint {
  x: number;
  y: number;
}

export interface ImageZoomRect {
  height: number;
  left: number;
  top: number;
  width: number;
}

export interface ImageZoomTransform {
  scale: number;
  translateX: number;
  translateY: number;
}

export interface ImageZoomVelocity {
  x: number;
  y: number;
}

export interface ImageZoomViewport {
  height: number;
  width: number;
}

export interface ImageZoomTransformOptions {
  maxScale: number;
  minScale: number;
  viewport: ImageZoomViewport;
}

const MOMENTUM_FRAME_MS = 1000 / 60;
const ZOOM_MIN_SCALE_EPSILON = 0.01;

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function clampImageZoomScale({
  maxScale,
  minScale,
  scale,
}: {
  maxScale: number;
  minScale: number;
  scale: number;
}): number {
  if (!Number.isFinite(scale)) {
    return minScale;
  }

  return clampNumber(scale, minScale, maxScale);
}

export function getImageZoomDistance(
  firstPoint: ImageZoomPoint,
  secondPoint: ImageZoomPoint,
): number {
  return Math.hypot(secondPoint.x - firstPoint.x, secondPoint.y - firstPoint.y);
}

export function getImageZoomMidpoint(
  firstPoint: ImageZoomPoint,
  secondPoint: ImageZoomPoint,
): ImageZoomPoint {
  return {
    x: (firstPoint.x + secondPoint.x) / 2,
    y: (firstPoint.y + secondPoint.y) / 2,
  };
}

export function getCenteredImageZoomPoint({
  clientX,
  clientY,
  rect,
}: {
  clientX: number;
  clientY: number;
  rect: ImageZoomRect;
}): ImageZoomPoint {
  return {
    x: clientX - rect.left - rect.width / 2,
    y: clientY - rect.top - rect.height / 2,
  };
}

export function getImageZoomTranslateBounds({
  scale,
  viewport,
}: {
  scale: number;
  viewport: ImageZoomViewport;
}): {
  maxTranslateX: number;
  maxTranslateY: number;
  minTranslateX: number;
  minTranslateY: number;
} {
  const maxTranslateX = Math.max(0, (viewport.width * (scale - 1)) / 2);
  const maxTranslateY = Math.max(0, (viewport.height * (scale - 1)) / 2);

  return {
    maxTranslateX,
    maxTranslateY,
    minTranslateX: -maxTranslateX,
    minTranslateY: -maxTranslateY,
  };
}

export function clampImageZoomTransform(
  transform: ImageZoomTransform,
  { maxScale, minScale, viewport }: ImageZoomTransformOptions,
): ImageZoomTransform {
  const scale = clampImageZoomScale({
    maxScale,
    minScale,
    scale: transform.scale,
  });

  if (scale <= minScale + ZOOM_MIN_SCALE_EPSILON) {
    return {
      scale: minScale,
      translateX: 0,
      translateY: 0,
    };
  }

  const bounds = getImageZoomTranslateBounds({
    scale,
    viewport,
  });

  return {
    scale,
    translateX: clampNumber(
      transform.translateX,
      bounds.minTranslateX,
      bounds.maxTranslateX,
    ),
    translateY: clampNumber(
      transform.translateY,
      bounds.minTranslateY,
      bounds.maxTranslateY,
    ),
  };
}

export function getImageZoomContentPointForFocalPoint({
  focalPoint,
  transform,
}: {
  focalPoint: ImageZoomPoint;
  transform: ImageZoomTransform;
}): ImageZoomPoint {
  const scale = Math.max(transform.scale, ZOOM_MIN_SCALE_EPSILON);

  return {
    x: (focalPoint.x - transform.translateX) / scale,
    y: (focalPoint.y - transform.translateY) / scale,
  };
}

export function zoomImageTransformAroundContentPoint({
  contentPoint,
  focalPoint,
  targetScale,
  transformOptions,
}: {
  contentPoint: ImageZoomPoint;
  focalPoint: ImageZoomPoint;
  targetScale: number;
  transformOptions: ImageZoomTransformOptions;
}): ImageZoomTransform {
  return clampImageZoomTransform(
    {
      scale: targetScale,
      translateX: focalPoint.x - contentPoint.x * targetScale,
      translateY: focalPoint.y - contentPoint.y * targetScale,
    },
    transformOptions,
  );
}

export function zoomImageTransformAroundFocalPoint({
  currentTransform,
  focalPoint,
  targetScale,
  transformOptions,
}: {
  currentTransform: ImageZoomTransform;
  focalPoint: ImageZoomPoint;
  targetScale: number;
  transformOptions: ImageZoomTransformOptions;
}): ImageZoomTransform {
  return zoomImageTransformAroundContentPoint({
    contentPoint: getImageZoomContentPointForFocalPoint({
      focalPoint,
      transform: currentTransform,
    }),
    focalPoint,
    targetScale,
    transformOptions,
  });
}

export function stepImageZoomMomentum({
  elapsedMs,
  friction,
  minVelocity,
  transform,
  transformOptions,
  velocity,
}: {
  elapsedMs: number;
  friction: number;
  minVelocity: number;
  transform: ImageZoomTransform;
  transformOptions: ImageZoomTransformOptions;
  velocity: ImageZoomVelocity;
}): {
  shouldContinue: boolean;
  transform: ImageZoomTransform;
  velocity: ImageZoomVelocity;
} {
  const safeElapsedMs = Math.max(0, Math.min(elapsedMs, 64));
  const nextUnclampedTransform = {
    ...transform,
    translateX: transform.translateX + velocity.x * safeElapsedMs,
    translateY: transform.translateY + velocity.y * safeElapsedMs,
  };
  const nextTransform = clampImageZoomTransform(
    nextUnclampedTransform,
    transformOptions,
  );
  const frictionMultiplier = Math.pow(
    friction,
    safeElapsedMs / MOMENTUM_FRAME_MS,
  );
  const nextVelocity = {
    x:
      nextTransform.translateX === nextUnclampedTransform.translateX
        ? velocity.x * frictionMultiplier
        : 0,
    y:
      nextTransform.translateY === nextUnclampedTransform.translateY
        ? velocity.y * frictionMultiplier
        : 0,
  };

  return {
    shouldContinue:
      Math.hypot(nextVelocity.x, nextVelocity.y) >= minVelocity &&
      nextTransform.scale > transformOptions.minScale + ZOOM_MIN_SCALE_EPSILON,
    transform: nextTransform,
    velocity: nextVelocity,
  };
}
